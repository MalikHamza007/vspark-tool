import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
import { cors, fail, json } from '../_shared/http.ts';
import { notifyPost } from '../_shared/email.ts';

// Called every minute by pg_cron. Authenticated by a shared secret kept in vs_private_config.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: cfg } = await admin.from('vs_private_config').select('value').eq('key', 'cron_secret').maybeSingle();
  if (!cfg || req.headers.get('x-cron-secret') !== cfg.value) return fail(401, 'UNAUTHORIZED', 'Bad cron secret');

  const { data: due, error } = await admin.rpc('vs_due_reminders');
  if (error) return fail(500, 'QUERY_FAILED', error.message);
  const results = [];
  for (const post of due ?? []) {
    const r = await notifyPost(admin, post, 'reminder');
    await admin.from('vs_posts').update({ reminder_sent_at: new Date().toISOString(), status: post.scheduled_at <= new Date().toISOString() ? 'published' : post.status }).eq('id', post.id);
    results.push({ id: post.id, ...r });
  }
  return json({ processed: results.length, results });
});
