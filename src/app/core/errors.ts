export function friendlyError(e: any): string {
  if (!e) return 'Something went wrong';
  const code = e.code ?? e?.error?.code;
  const msg = e.message ?? e?.error?.message ?? String(e);
  switch (code) {
    case '23505': return 'That item already exists.';
    case '23503': case '23001': return 'This item is still referenced elsewhere.';
    case '42501': return 'You do not have permission to do that.';
    case '23514': return 'Some values are invalid: ' + msg;
    case 'P0001': return msg;
    case 'AI_NOT_CONFIGURED': return 'Gemini is not configured on the server yet (GEMINI_API_KEY).';
    case 'AI_RATE_LIMITED': return 'Gemini rate limit hit — wait a moment and retry.';
    case 'AI_TIMEOUT': return 'Gemini took too long — please retry.';
    case 'UNAUTHENTICATED': return 'Your session expired. Please sign in again.';
  }
  if (/Invalid login credentials/i.test(msg)) return 'Wrong email or password.';
  if (/Failed to fetch|NetworkError/i.test(msg)) return 'Network error — check your connection.';
  return msg;
}
