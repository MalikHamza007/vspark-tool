import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
import { cors, fail, json } from '../_shared/http.ts';

const PLATFORMS = ['instagram', 'x', 'linkedin', 'facebook', 'tiktok'];
const TONES = ['friendly', 'professional', 'witty', 'inspirational', 'bold', 'casual'];
const MODEL = Deno.env.get('GEMINI_MODEL') ?? 'gemini-2.5-flash';

async function sha(s: string) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return fail(405, 'METHOD_NOT_ALLOWED', 'Use POST');
  const url = Deno.env.get('SUPABASE_URL')!;
  const authHeader = req.headers.get('Authorization') ?? '';
  const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });
  const { data: u } = await userClient.auth.getUser();
  if (!u?.user) return fail(401, 'UNAUTHENTICATED', 'Sign in to generate captions');

  let body: any;
  try { body = await req.json(); } catch { return fail(400, 'BAD_JSON', 'Body must be JSON'); }
  const prompt = String(body?.prompt ?? '').trim();
  const platform = PLATFORMS.includes(body?.platform) ? body.platform : 'instagram';
  const tone = TONES.includes(body?.tone) ? body.tone : 'friendly';
  const count = Math.min(3, Math.max(2, Number(body?.count) || 3));
  if (prompt.length < 3 || prompt.length > 1000) return fail(422, 'INVALID_PROMPT', 'Prompt must be 3–1000 characters');

  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const key = await sha(`${MODEL}|${platform}|${tone}|${count}|${prompt.toLowerCase()}`);
  const fresh = body?.fresh === true;
  const { data: cached } = await admin.from('vs_caption_cache').select('response,created_at').eq('key', key).maybeSingle();
  if (cached && !fresh && Date.now() - new Date(cached.created_at).getTime() < 24 * 3600e3) {
    return json({ ...cached.response, cached: true });
  }

  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) return fail(503, 'AI_NOT_CONFIGURED', 'GEMINI_API_KEY secret is not set on the server');

  const instruction = `You are a social media copywriter. Write exactly ${count} distinct ${platform} captions in a ${tone} tone for: "${prompt}".
Rules: each caption fits ${platform === 'x' ? '260' : '600'} characters, includes 1-2 relevant emojis, and has 4-8 relevant hashtags (without spaces) returned separately. No hashtags inside the caption text.`;
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      signal: AbortSignal.timeout(25000),
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: instruction }] }],
        generationConfig: {
          temperature: 0.9,
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'ARRAY',
            items: { type: 'OBJECT', properties: { caption: { type: 'STRING' }, hashtags: { type: 'ARRAY', items: { type: 'STRING' } } }, required: ['caption', 'hashtags'] },
          },
        },
      }),
    });
    if (!r.ok) {
      const t = await r.text();
      if (cached) return json({ ...cached.response, cached: true, stale: true });
      return fail(502, r.status === 429 ? 'AI_RATE_LIMITED' : 'AI_UPSTREAM_ERROR', `Gemini returned ${r.status}`, t.slice(0, 400));
    }
    const data = await r.json();
    const text = data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? '').join('') ?? '';
    let arr: any[];
    try { arr = JSON.parse(text); } catch { return fail(502, 'AI_BAD_RESPONSE', 'Gemini returned unparseable output'); }
    const captions = (Array.isArray(arr) ? arr : [])
      .filter((c) => typeof c?.caption === 'string' && c.caption.trim())
      .slice(0, count)
      .map((c) => ({
        caption: c.caption.trim().slice(0, 2200),
        hashtags: (Array.isArray(c.hashtags) ? c.hashtags : []).map((h: unknown) => '#' + String(h).replace(/^#+/, '').replace(/\s+/g, '')).filter((h: string) => h.length > 1).slice(0, 10),
      }));
    if (!captions.length) return fail(502, 'AI_EMPTY', 'Gemini returned no captions');
    const response = { captions, model: MODEL, platform, tone };
    await admin.from('vs_caption_cache').upsert({ key, response, created_at: new Date().toISOString() });
    return json({ ...response, cached: false });
  } catch (e) {
    if (cached) return json({ ...cached.response, cached: true, stale: true });
    return fail(504, 'AI_TIMEOUT', 'Gemini did not respond in time', String(e));
  }
});
