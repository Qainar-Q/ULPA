import { useEffect, useRef } from "react";

/**
 * Run `callback` now, every `ms` while the app is on screen, and right away when it
 * comes back to the foreground. Nothing runs while the app is in the background.
 */
export function useVisiblePolling(callback, ms, enabled = true) {
  const saved = useRef(callback);
  saved.current = callback;
  useEffect(() => {
    if (!enabled) return undefined;
    const run = () => {
      if (document.visibilityState === "visible") saved.current();
    };
    run();
    const timer = setInterval(run, ms);
    document.addEventListener("visibilitychange", run);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", run);
    };
  }, [ms, enabled]);
}
