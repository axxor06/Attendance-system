/**
 * Tiny in-process cache with in-flight de-duplication and optional stale-while-revalidate.
 *
 * Meant for expensive, read-only aggregates whose exact freshness is not critical (the HOD
 * dashboard). If ten HODs open the dashboard in the same second, the aggregate runs once.
 *
 *   ttlMs    entry is fresh and returned as-is.
 *   staleMs  after ttlMs, for this much longer the old value is returned immediately while ONE
 *            background refresh recomputes it, so users do not wait on a heavy aggregate.
 *
 * It is per-process by design (no new infrastructure) and failures are never cached.
 */
const entries = new Map();
const MAX_ENTRIES = 200;

function store(key, promise, ttlMs, staleMs) {
  const now = Date.now();
  const entry = { promise, freshUntil: now + ttlMs, staleUntil: now + ttlMs + staleMs, refreshing: false };
  entries.set(key, entry);
  promise.catch(() => { if (entries.get(key) === entry) entries.delete(key); });
  if (entries.size > MAX_ENTRIES) {
    for (const [storedKey, value] of entries) if (value.staleUntil <= now) entries.delete(storedKey);
    if (entries.size > MAX_ENTRIES) entries.delete(entries.keys().next().value);
  }
  return entry;
}

export async function memoize(key, ttlMs, compute, { staleMs = 0 } = {}) {
  const now = Date.now();
  const hit = entries.get(key);
  if (hit && hit.freshUntil > now) return hit.promise;
  if (hit && hit.staleUntil > now) {
    if (!hit.refreshing) {
      hit.refreshing = true;
      const next = Promise.resolve().then(compute);
      next.then(
        () => store(key, next, ttlMs, staleMs),
        () => { hit.refreshing = false; }, // keep serving the stale value; try again next request
      );
    }
    return hit.promise;
  }
  return store(key, Promise.resolve().then(compute), ttlMs, staleMs).promise;
}

export function clearMemoryCache() {
  entries.clear();
}

/** Drops every entry whose key starts with `prefix` (e.g. after the underlying data changed). */
export function invalidateMemoryCache(prefix) {
  for (const key of [...entries.keys()]) if (key.startsWith(prefix)) entries.delete(key);
}
