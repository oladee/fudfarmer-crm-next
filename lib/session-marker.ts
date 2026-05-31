/** First-party cookie so Next.js middleware can gate routes when auth cookies live on the API domain. */
const MARKER_NAME = 'crm_authed';
const MAX_AGE_SEC = 7 * 24 * 60 * 60;

export function setSessionMarker(): void {
  if (typeof document === 'undefined') return;
  const secure = window.location.protocol === 'https:' ? '; secure' : '';
  document.cookie = `${MARKER_NAME}=1; path=/; max-age=${MAX_AGE_SEC}; samesite=lax${secure}`;
}

export function clearSessionMarker(): void {
  if (typeof document === 'undefined') return;
  const secure = window.location.protocol === 'https:' ? '; secure' : '';
  document.cookie = `${MARKER_NAME}=; path=/; max-age=0; samesite=lax${secure}`;
}

export function hasSessionMarker(): boolean {
  if (typeof document === 'undefined') return false;
  return document.cookie.split(';').some((c) => c.trim().startsWith(`${MARKER_NAME}=1`));
}
