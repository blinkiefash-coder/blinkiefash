// Lightweight cross-navigation cache for catalog-style pages.
//
// Why not just useState/useEffect alone?
// Men.jsx/Women.jsx/Kids.jsx/Shop.jsx all re-fetch every time the page
// mounts, which means tapping "Electronics", then "Home", then
// "Electronics" again re-hits the API for data that hasn't changed.
// This module keeps results in memory (module scope survives unmount,
// since React only destroys the component instance, not the JS module)
// so a return visit within TTL is instant and issues zero requests.
//
// This is intentionally NOT localStorage/sessionStorage:
//   - it must not leak into artifacts/other tabs
//   - it should reset on a hard page reload (stale category data is
//     worse than one extra fetch after a refresh)
// If persistence across full page reloads is ever needed, swap the Map
// below for sessionStorage with the same get/set/isFresh contract.

const cache = new Map();

const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes

function isFresh(entry, ttlMs) {
  return Boolean(entry) && Date.now() - entry.savedAt < ttlMs;
}

/**
 * Read a cached value for `key` if it's still fresh.
 * Returns undefined on a miss or stale entry (never throws).
 */
export function getCached(key, ttlMs = DEFAULT_TTL_MS) {
  const entry = cache.get(key);
  return isFresh(entry, ttlMs) ? entry.value : undefined;
}

/** Store a value for `key`, timestamped for TTL checks. */
export function setCached(key, value) {
  cache.set(key, { value, savedAt: Date.now() });
}

/** Drop one key (e.g. after a mutation that invalidates it), or clear all. */
export function invalidateCache(key) {
  if (key === undefined) {
    cache.clear();
  } else {
    cache.delete(key);
  }
}
