const KEY = 'cb-session-id';
let memoryId: string | undefined;

const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `s-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;

/**
 * Per-tab session id used as the server's rate-limit key. Stored in
 * sessionStorage when available; falls back to memory (private mode, SSR).
 */
export function getSessionId(): string {
  try {
    const existing = window.sessionStorage.getItem(KEY);
    if (existing) return existing;
    const id = newId();
    window.sessionStorage.setItem(KEY, id);
    return id;
  } catch {
    return (memoryId ??= newId());
  }
}
