// The only signal that means "we're offline, queue/retry later" — axios sets `request` but no
// `response` when the request never reached the server at all (offline, DNS failure, connection
// refused). A response WITH a status code (409 stock unavailable, 400 validation, etc.) is a real
// business rejection and must surface to the cashier immediately, not get silently retried forever.
// Shared by both the web (Dexie) and native (SQLite) offline-sync engines.
export function isNetworkError(err: unknown): boolean {
  const e = err as { response?: unknown; request?: unknown };
  return !!e?.request && !e.response;
}
