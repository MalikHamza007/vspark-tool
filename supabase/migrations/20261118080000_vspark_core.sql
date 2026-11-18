-- VSpark core schema: profiles + roles, posts, notification settings/log, caption cache, private media bucket.
-- All tables are prefixed vs_ so they can share a Supabase project safely.
create extension if not exists pg_cron;
create extension if not exists pg_net;

create table public.vs_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null default '',
  role text not null default 'creator' check (role in ('admin','creator')),
  created_at timestamptz not null default now()
);

create or replace function public.vs_is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.vs_profiles where id = auth.uid() and role = 'admin');
$$;

-- First signup whose email is listed here becomes admin (only while no admin exists).
create table public.vs_admin_bootstrap (email text primary key);

create table public.vs_notification_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  enabled boolean not null default true,
  send_on_schedule boolean not null default true,
  send_reminder boolean not null default true,
  lead_minutes int not null default 15 check (lead_minutes between 0 and 1440),
  subject_template text not null default 'Scheduled: {{platform}} post at {{time}}' check (char_length(subject_template) between 3 and 200),
  body_template text not null default E'Hi {{name}},\n\nYour {{platform}} post is scheduled for {{time}}.\n\n{{caption}}\n\n{{hashtags}}' check (char_length(body_template) between 3 and 4000),
  timezone text not null default 'Asia/Karachi',
  updated_at timestamptz not null default now()
);

create or replace function public.vs_handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare r text := 'creator';
begin
  if exists(select 1 from public.vs_admin_bootstrap b where lower(b.email)=lower(new.email))
     and not exists(select 1 from public.vs_profiles where role='admin') then r := 'admin'; end if;
  insert into public.vs_profiles(id,email,full_name,role)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)), r)
  on conflict (id) do nothing;
  insert into public.vs_notification_settings(user_id, email) values (new.id, new.email) on conflict do nothing;
  return new;
end $$;

create table public.vs_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 2 and 120),
  prompt text not null default '' check (char_length(prompt) <= 1000),
  platform text not null default 'instagram' check (platform in ('instagram','x','linkedin','facebook','tiktok')),
  tone text not null default 'friendly',
  caption text not null check (char_length(caption) between 1 and 2200),
  hashtags text[] not null default '{}',
  scheduled_at timestamptz,
  status text not null default 'draft' check (status in ('draft','scheduled','published','failed')),
  task_notes text not null default '' check (char_length(task_notes) <= 1000),
  notify boolean not null default true,
  reminder_sent_at timestamptz,
  media_path text, media_name text, media_type text, media_size int,
  drive_file_id text, drive_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vs_sched_needs_time check (status <> 'scheduled' or scheduled_at is not null)
);
create index on public.vs_posts(user_id, scheduled_at);

create table public.vs_notification_log (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references public.vs_posts(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('scheduled','reminder','manual')),
  recipient text not null,
  subject text not null,
  status text not null check (status in ('sent','failed','skipped')),
  error text,
  created_at timestamptz not null default now()
);

create table public.vs_caption_cache (key text primary key, response jsonb not null, created_at timestamptz not null default now());

create trigger vs_on_auth_user_created after insert on auth.users for each row execute function public.vs_handle_new_user();

create or replace function public.vs_touch() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
create trigger vs_posts_touch before update on public.vs_posts for each row execute function public.vs_touch();
create trigger vs_settings_touch before update on public.vs_notification_settings for each row execute function public.vs_touch();

create or replace function public.vs_reset_reminder() returns trigger language plpgsql as $$
begin
  if new.scheduled_at is distinct from old.scheduled_at then new.reminder_sent_at := null; end if;
  if new.user_id <> old.user_id then raise exception 'owner cannot change' using errcode='P0001'; end if;
  return new;
end $$;
create trigger vs_posts_reset before update on public.vs_posts for each row execute function public.vs_reset_reminder();

alter table public.vs_profiles enable row level security;
alter table public.vs_admin_bootstrap enable row level security;
alter table public.vs_notification_settings enable row level security;
alter table public.vs_posts enable row level security;
alter table public.vs_notification_log enable row level security;
alter table public.vs_caption_cache enable row level security;

create policy vs_profiles_read on public.vs_profiles for select to authenticated using (id = auth.uid() or public.vs_is_admin());
-- intentionally no UPDATE policy on vs_profiles: users cannot promote themselves
create policy vs_settings_rw on public.vs_notification_settings for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy vs_posts_read on public.vs_posts for select to authenticated using (user_id = auth.uid() or public.vs_is_admin());
create policy vs_posts_insert on public.vs_posts for insert to authenticated with check (user_id = auth.uid());
create policy vs_posts_update on public.vs_posts for update to authenticated using (user_id = auth.uid() or public.vs_is_admin()) with check (user_id = auth.uid() or public.vs_is_admin());
create policy vs_posts_delete on public.vs_posts for delete to authenticated using (user_id = auth.uid() or public.vs_is_admin());
create policy vs_log_read on public.vs_notification_log for select to authenticated using (user_id = auth.uid() or public.vs_is_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('vs-post-media','vs-post-media', false, 10485760, array['image/png','image/jpeg','image/webp','image/gif','application/pdf','text/plain','text/csv'])
on conflict (id) do nothing;
create policy "vs media read" on storage.objects for select to authenticated
  using (bucket_id='vs-post-media' and ((storage.foldername(name))[1] = auth.uid()::text or public.vs_is_admin()));
create policy "vs media insert" on storage.objects for insert to authenticated
  with check (bucket_id='vs-post-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "vs media delete" on storage.objects for delete to authenticated
  using (bucket_id='vs-post-media' and ((storage.foldername(name))[1] = auth.uid()::text or public.vs_is_admin()));
