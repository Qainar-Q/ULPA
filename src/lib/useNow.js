import { useEffect, useState } from "react";

/** Current time, refreshed every `ms` and when the app comes back to the foreground. */
export function useNow(ms = 30 * 1000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const tick = () => setNow(new Date());
    const timer = setInterval(tick, ms);
    const onVisible = () => document.visibilityState === "visible" && tick();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [ms]);
  return now;
}
