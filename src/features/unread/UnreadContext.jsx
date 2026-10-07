import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase.js";
import { useAuth } from "../auth/AuthContext.jsx";
import { syncPush } from "../../lib/push.js";

const EMPTY = { tasks: 0, photos: 0, announcements: 0, polls: 0, materials: 0 };
const UnreadContext = createContext({ counts: EMPTY, refresh: () => {}, markSeen: () => {} });

/** "New" counts per area (server decides what is new and visible). Refreshes on focus and every 2 min. */
export function UnreadProvider({ children }) {
  const { status } = useAuth();
  const [counts, setCounts] = useState(EMPTY);

  const refresh = useCallback(async () => {
    const { data, error } = await supabase.rpc("unread_counts");
    if (error || !data) return;
    const next = { ...EMPTY };
    for (const row of data) next[row.area] = row.unread;
    setCounts(next);
  }, []);

  const markSeen = useCallback(async (area) => {
    setCounts((current) => (current[area] ? { ...current, [area]: 0 } : current));
    await supabase.rpc("mark_seen", { p_area: area });
  }, []);

  useEffect(() => {
    if (status !== "signedIn") {
      setCounts(EMPTY);
      return undefined;
    }
    // Presence for the admin dashboard: about once a minute while the app is in the foreground.
    const touch = () => {
      if (document.visibilityState === "visible") supabase.rpc("touch_presence").then(() => {}, () => {});
    };
    refresh();
    syncPush();
    touch();
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      refresh();
      touch();
    };
    document.addEventListener("visibilitychange", onVisible);
    const timer = setInterval(refresh, 2 * 60 * 1000);
    const presence = setInterval(touch, 60 * 1000);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(timer);
      clearInterval(presence);
    };
  }, [status, refresh]);

  // Number on the home-screen app icon (where the phone supports it).
  useEffect(() => {
    const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
    try {
      if (total > 0) navigator.setAppBadge?.(total);
      else navigator.clearAppBadge?.();
    } catch {
      /* not supported */
    }
  }, [counts]);

  const value = useMemo(() => ({ counts, refresh, markSeen }), [counts, refresh, markSeen]);
  return <UnreadContext.Provider value={value}>{children}</UnreadContext.Provider>;
}

export function useUnread() {
  return useContext(UnreadContext);
}

/** Call on a page: marks the area as seen when the page opens (and again when leaving). */
export function useMarkSeen(area) {
  const { markSeen } = useUnread();
  const { status } = useAuth();
  useEffect(() => {
    if (status !== "signedIn") return undefined;
    markSeen(area);
    return () => {
      markSeen(area);
    };
  }, [area, status, markSeen]);
}
