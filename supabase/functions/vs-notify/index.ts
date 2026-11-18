import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
import { cors, fail, json } from '../_shared/http.ts';
import { notifyPost } from '../_shared/email.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const url = Deno.env.get('SUPABASE_URL')!;
  const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } });
  const { data: u } = await userClient.auth.getUser();
  if (!u?.user) return fail(401, 'UNAUTHENTICATED', 'Sign in first');
  let body: any;
  try { body = await req.json(); } catch { return fail(400, 'BAD_JSON', 'Body must be JSON'); }
  const kind = body?.kind === 'manual' ? 'manual' : 'scheduled';
  // RLS-scoped read: the caller must own (or administer) the post
  const { data: post, error } = await userClient.from('vs_posts').select('*').eq('id', String(body?.postId ?? '')).maybeSingle();
  if (error) return fail(400, 'BAD_REQUEST', error.message);
  if (!post) return fail(404, 'POST_NOT_FOUND', 'Post not found or not yours');
  if (!post.notify && kind !== 'manual') return json({ status: 'skipped', error: 'POST_NOTIFY_OFF' });
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const res = await notifyPost(admin, post, kind);
  return json(res);
});
