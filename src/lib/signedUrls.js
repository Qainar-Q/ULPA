import { supabase } from "./supabase.js";
import { demoFileUrl, isDemo } from "../demo/demoMode.js";

// Private files need signed links. Every new signature is a different URL, which
// defeats caching, so a link is reused until shortly before it expires.
// (The service worker additionally keeps the image bytes on the device.)
const TTL_SECONDS = 60 * 60 * 6;
const REFRESH_MARGIN_MS = 10 * 60 * 1000;
const STORE_KEY = "ulpa-signed-links-v1";
const MAX_STORED = 800;

// The links are also kept on this device (until they expire, wiped on sign-out), so
// reopening the app shows photos at once instead of first asking the server for new links.
const cache = loadStored(); // "bucket/path" → { url, expiresAt }
let storeTimer = null;

function loadStored() {
  const map = new Map();
  try {
    const now = Date.now();
    for (const [key, value] of JSON.parse(localStorage.getItem(STORE_KEY) ?? "[]")) {
      if (value?.url && value.expiresAt - now > REFRESH_MARGIN_MS) map.set(key, value);
    }
  } catch {
    /* storage unavailable: memory only */
  }
  return map;
}

function persist() {
  clearTimeout(storeTimer);
  storeTimer = setTimeout(() => {
    try {
      const now = Date.now();
      const live = [...cache].filter(([, value]) => value.expiresAt - now > REFRESH_MARGIN_MS).slice(-MAX_STORED);
      localStorage.setItem(STORE_KEY, JSON.stringify(live));
    } catch {
      /* storage full or blocked */
    }
  }, 300);
}

/** Already-signed link, without asking the server (null if none is valid). */
export function cachedSignedUrl(bucket, path) {
  const hit = path && cache.get(`${bucket}/${path}`);
  return hit && hit.expiresAt - Date.now() > REFRESH_MARGIN_MS ? hit.url : null;
}

/** { path: signedUrl } for the given paths, signing only the ones not cached. */
export async function signedUrls(bucket, paths) {
  const unique = [...new Set(paths.filter(Boolean))];
  if (isDemo()) return Object.fromEntries(unique.map((path) => [path, demoFileUrl(path)]));
  const now = Date.now();
  const result = {};
  const missing = [];
  for (const path of unique) {
    const hit = cache.get(`${bucket}/${path}`);
    if (hit && hit.expiresAt - now > REFRESH_MARGIN_MS) result[path] = hit.url;
    else missing.push(path);
  }
  if (missing.length) {
    const { data, error } = await supabase.storage.from(bucket).createSignedUrls(missing, TTL_SECONDS);
    if (error) throw error;
    for (const item of data) {
      if (!item.signedUrl) continue;
      cache.set(`${bucket}/${item.path}`, { url: item.signedUrl, expiresAt: now + TTL_SECONDS * 1000 });
      result[item.path] = item.signedUrl;
    }
    persist();
  }
  return result;
}

export async function signedUrl(bucket, path) {
  const urls = await signedUrls(bucket, [path]);
  if (!urls[path]) throw new Error("not_signed");
  return urls[path];
}

/** Warm the browser/service-worker cache so the next image shows instantly. */
export function preloadImage(url) {
  if (!url) return;
  const img = new Image();
  img.decoding = "async";
  img.src = url;
}

/** On sign-out: forget links and remove cached images from this device. */
export async function clearPrivateFileCache() {
  cache.clear();
  clearTimeout(storeTimer);
  try {
    localStorage.removeItem(STORE_KEY);
  } catch {
    /* ignore */
  }
  try {
    if ("caches" in window) await caches.delete("ulpa-private-images");
  } catch {
    /* ignore */
  }
}

export const IMMUTABLE_CACHE = "31536000"; // file paths are unique and never overwritten
