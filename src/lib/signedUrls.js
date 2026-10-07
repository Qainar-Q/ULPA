import { supabase } from "./supabase.js";

// Private files need signed links. Every new signature is a different URL, which
// defeats caching, so a link is reused until shortly before it expires.
// (The service worker additionally keeps the image bytes on the device.)
const TTL_SECONDS = 60 * 60 * 6;
const REFRESH_MARGIN_MS = 10 * 60 * 1000;
const cache = new Map(); // "bucket/path" → { url, expiresAt }

/** { path: signedUrl } for the given paths, signing only the ones not cached. */
export async function signedUrls(bucket, paths) {
  const unique = [...new Set(paths.filter(Boolean))];
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
  try {
    if ("caches" in window) await caches.delete("ulpa-private-images");
  } catch {
    /* ignore */
  }
}

export const IMMUTABLE_CACHE = "31536000"; // file paths are unique and never overwritten
