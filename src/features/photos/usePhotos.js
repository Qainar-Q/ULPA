import { useCallback, useEffect, useState } from "react";
import { listPhotos, PHOTO_BUCKET, signUrls } from "./photoApi.js";
import { fetchEngagement } from "./photoSocial.js";
import { useAuth } from "../auth/AuthContext.jsx";
import { readCache, writeCache } from "../../lib/cache.js";
import { cachedSignedUrl } from "../../lib/signedUrls.js";

/** Thumbnail + full-size links for these photos in ONE request (opening a photo then needs none). */
export async function signPhotoLinks(photos) {
  return signUrls(photos.flatMap((photo) => [photo.thumb_path, photo.storage_path]));
}

/** Links already on this device for every thumbnail, or null if any is missing. */
function cachedThumbs(photos) {
  const out = {};
  for (const photo of photos) {
    const url = cachedSignedUrl(PHOTO_BUCKET, photo.thumb_path);
    if (!url) return null;
    out[photo.thumb_path] = url;
  }
  return out;
}

/**
 * Loads visible photos and signed thumbnail URLs.
 * The last list from this device shows at once (with its still-valid links), then refreshes.
 * Returns { status, photos, thumbs, engagement, reload, refreshEngagement }.
 */
export function usePhotos({ courseId, type, limit } = {}) {
  const { status: authStatus, student } = useAuth();
  const userId = student?.id ?? null;
  const cacheName = `photos-${courseId ?? "all"}-${type ?? "all"}-${limit ?? "all"}`;
  const [state, setState] = useState(() => {
    const photos = readCache(cacheName, userId);
    const thumbs = photos && cachedThumbs(photos);
    return thumbs ? { status: "ready", photos, thumbs } : { status: "loading", photos: [], thumbs: {} };
  });
  const [engagement, setEngagement] = useState({});

  const refreshEngagement = useCallback(() => {
    fetchEngagement().then(setEngagement).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    // This filter's own last list (if any) right away; otherwise "loading".
    const saved = readCache(cacheName, userId);
    const savedThumbs = saved && cachedThumbs(saved);
    setState(savedThumbs ? { status: "ready", photos: saved, thumbs: savedThumbs } : { status: "loading", photos: [], thumbs: {} });
    try {
      const photos = await listPhotos({ courseId, type, limit });
      const thumbs = await signPhotoLinks(photos);
      setState({ status: "ready", photos, thumbs });
      writeCache(cacheName, userId, photos);
      refreshEngagement();
    } catch {
      // Offline with a list on screen: keep it.
      setState((current) => (current.photos.length ? current : { status: "error", photos: [], thumbs: {} }));
    }
  }, [courseId, type, limit, refreshEngagement, cacheName, userId]);

  useEffect(() => {
    if (authStatus === "signedIn") load();
  }, [authStatus, load]);

  return { ...state, engagement, reload: load, refreshEngagement };
}
