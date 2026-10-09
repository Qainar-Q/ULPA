import { isDemo } from "../demo/demoMode.js";

// A small copy of the last real data this person loaded, kept on their own
// device, so pages show instantly on the next visit and then quietly refresh.
// Never used in demo mode; wiped on sign-out.

const PREFIX = "ulpa-cache:";
const VERSION = 1;

function key(name, userId) {
  return `${PREFIX}${name}:${userId}`;
}

export function readCache(name, userId) {
  if (!userId || isDemo()) return null;
  try {
    const raw = JSON.parse(localStorage.getItem(key(name, userId)) ?? "null");
    return raw?.v === VERSION ? raw.data : null;
  } catch {
    return null;
  }
}

export function writeCache(name, userId, data) {
  if (!userId || isDemo()) return;
  try {
    localStorage.setItem(key(name, userId), JSON.stringify({ v: VERSION, at: Date.now(), data }));
  } catch {
    /* storage full or blocked: just skip caching */
  }
}

/** Remove every cached copy (called on sign-out). */
export function clearCaches() {
  try {
    for (let i = localStorage.length - 1; i >= 0; i -= 1) {
      const name = localStorage.key(i);
      if (name?.startsWith(PREFIX) || name?.startsWith("ulpa-catalog-")) localStorage.removeItem(name);
    }
  } catch {
    /* ignore */
  }
}
