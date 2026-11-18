export interface TemplateVars { name: string; platform: string; time: string; caption: string; hashtags: string; title: string; notes: string }

export function render(tpl: string, v: TemplateVars): string {
  return tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, k: string) => (k in v ? String((v as any)[k]) : ''));
}

export function formatTime(iso: string | null, tz: string): string {
  if (!iso) return 'not scheduled';
  try {
    return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: tz }).format(new Date(iso)) + ` (${tz})`;
  } catch { return new Date(iso).toUTCString(); }
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

/** Sends with Resend. Returns {status, error}. */
export async function sendEmail(to: string, subject: string, text: string): Promise<{ status: 'sent' | 'failed' | 'skipped'; error?: string }> {
  const key = Deno.env.get('RESEND_API_KEY');
  if (!key) return { status: 'skipped', error: 'EMAIL_PROVIDER_NOT_CONFIGURED' };
  const from = Deno.env.get('EMAIL_FROM') ?? 'VSpark <onboarding@resend.dev>';
  const html = `<div style="font-family:system-ui,sans-serif;max-width:560px;margin:auto;padding:24px;border:1px solid #e5e7eb;border-radius:12px"><h2 style="color:#7c3aed;margin-top:0">VSpark</h2><div style="white-space:pre-wrap;line-height:1.5">${escapeHtml(text)}</div></div>`;
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [to], subject, text, html }),
      signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) return { status: 'failed', error: `RESEND_${r.status}: ${(await r.text()).slice(0, 300)}` };
    return { status: 'sent' };
  } catch (e) {
    return { status: 'failed', error: String(e).slice(0, 300) };
  }
}

// deno-lint-ignore no-explicit-any
export async function notifyPost(admin: any, post: any, kind: 'scheduled' | 'reminder' | 'manual') {
  const { data: s } = await admin.from('vs_notification_settings').select('*').eq('user_id', post.user_id).maybeSingle();
  const { data: p } = await admin.from('vs_profiles').select('full_name').eq('id', post.user_id).maybeSingle();
  if (!s) return { status: 'skipped' as const, error: 'NO_SETTINGS' };
  const vars: TemplateVars = {
    name: p?.full_name || 'creator',
    platform: post.platform,
    time: formatTime(post.scheduled_at, s.timezone),
    caption: post.caption,
    hashtags: (post.hashtags ?? []).map((h: string) => (h.startsWith('#') ? h : '#' + h)).join(' '),
    title: post.title,
    notes: post.task_notes ?? '',
  };
  const subject = (kind === 'reminder' ? '⏰ Reminder: ' : '') + render(s.subject_template, vars);
  let result: { status: 'sent' | 'failed' | 'skipped'; error?: string };
  if (!s.enabled && kind !== 'manual') result = { status: 'skipped', error: 'NOTIFICATIONS_DISABLED' };
  else if (kind === 'scheduled' && !s.send_on_schedule) result = { status: 'skipped', error: 'SCHEDULE_EMAIL_OFF' };
  else result = await sendEmail(s.email, subject, render(s.body_template, vars) + (vars.notes ? `\n\nTask notes: ${vars.notes}` : ''));
  await admin.from('vs_notification_log').insert({ post_id: post.id, user_id: post.user_id, kind, recipient: s.email, subject, status: result.status, error: result.error ?? null });
  return result;
}
