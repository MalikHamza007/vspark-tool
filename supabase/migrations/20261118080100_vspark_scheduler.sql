-- Reminder scheduler: pg_cron calls the vs-dispatch-reminders Edge Function every minute
-- with a random shared secret stored in a table no client role can read.
create table if not exists public.vs_private_config (key text primary key, value text not null);
alter table public.vs_private_config enable row level security;
revoke all on public.vs_private_config from anon, authenticated;
insert into public.vs_private_config values ('cron_secret', encode(gen_random_bytes(24),'hex')) on conflict do nothing;

create or replace function public.vs_due_reminders() returns setof public.vs_posts
language sql stable security definer set search_path = public as $$
  select p.* from public.vs_posts p
  join public.vs_notification_settings s on s.user_id = p.user_id
  where p.status in ('scheduled','published') and p.notify and p.reminder_sent_at is null
    and s.enabled and s.send_reminder
    and p.scheduled_at <= now() + make_interval(mins => s.lead_minutes)
    and p.scheduled_at > now() - interval '1 day'
  limit 50;
$$;
revoke execute on function public.vs_due_reminders() from public, anon, authenticated;

-- Replace <project-ref> when deploying to a different project.
select cron.schedule('vs-dispatch-reminders', '* * * * *', $$
  select net.http_post(
    url := 'https://tayonxytmisuhbiqimhm.supabase.co/functions/v1/vs-dispatch-reminders',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret',(select value from public.vs_private_config where key='cron_secret')),
    body := '{}'::jsonb, timeout_milliseconds := 20000);
  update public.vs_posts set status='published' where status='scheduled' and scheduled_at <= now();
$$);
