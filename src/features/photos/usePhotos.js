import { useCallback, useEffect, useState } from "react";
import { listPhotos, signUrls } from "./photoApi.js";
import { useAuth } from "../auth/AuthContext.jsx";

/**
 * Loads visible photos and signed thumbnail URLs.
 * Returns { status: "loading" | "ready" | "error", photos, thumbs, reload }.
 */
export function usePhotos({ courseId, type, limit } = {}) {
  const { status: authStatus } = useAuth();
  const [state, setState] = useState({ status: "loading", photos: [], thumbs: {} });

  const load = useCallback(async () => {
    setState((current) => ({ ...current, status: "loading" }));
    try {
      const photos = await listPhotos({ courseId, type, limit });
      const thumbs = await signUrls(photos.map((photo) => photo.thumb_path));
      setState({ status: "ready", photos, thumbs });
    } catch {
      setState({ status: "error", photos: [], thumbs: {} });
    }
  }, [courseId, type, limit]);

  useEffect(() => {
    if (authStatus === "signedIn") load();
  }, [authStatus, load]);

  return { ...state, reload: load };
}
