import { useCallback, useEffect, useState } from "react";
import { listPhotos, signUrls } from "./photoApi.js";
import { fetchEngagement } from "./photoSocial.js";
import { useAuth } from "../auth/AuthContext.jsx";

/**
 * Loads visible photos and signed thumbnail URLs.
 * Returns { status, photos, thumbs, engagement, reload, refreshEngagement }.
 */
export function usePhotos({ courseId, type, limit } = {}) {
  const { status: authStatus } = useAuth();
  const [state, setState] = useState({ status: "loading", photos: [], thumbs: {} });
  const [engagement, setEngagement] = useState({});

  const refreshEngagement = useCallback(() => {
    fetchEngagement().then(setEngagement).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setState((current) => ({ ...current, status: "loading" }));
    try {
      const photos = await listPhotos({ courseId, type, limit });
      const thumbs = await signUrls(photos.map((photo) => photo.thumb_path));
      setState({ status: "ready", photos, thumbs });
      refreshEngagement();
    } catch {
      setState({ status: "error", photos: [], thumbs: {} });
    }
  }, [courseId, type, limit, refreshEngagement]);

  useEffect(() => {
    if (authStatus === "signedIn") load();
  }, [authStatus, load]);

  return { ...state, engagement, reload: load, refreshEngagement };
}
