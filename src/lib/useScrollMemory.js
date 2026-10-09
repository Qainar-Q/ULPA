import { useEffect, useLayoutEffect, useRef } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

// Where each visited screen was scrolled to, by history entry.
const positions = new Map();

/**
 * Opening a new page starts at the top; going back (or forward) returns to
 * the spot where you left that page — even when its content loads a moment later.
 */
export function useScrollMemory() {
  const location = useLocation();
  const navigationType = useNavigationType();
  const currentKey = useRef(location.key);
  const lastPath = useRef(location.pathname);

  useEffect(() => {
    if ("scrollRestoration" in window.history) window.history.scrollRestoration = "manual";
    let frame = 0;
    const remember = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => positions.set(currentKey.current, window.scrollY));
    };
    window.addEventListener("scroll", remember, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", remember);
    };
  }, []);

  useLayoutEffect(() => {
    currentKey.current = location.key;
    const samePage = lastPath.current === location.pathname;
    lastPath.current = location.pathname;

    if (navigationType !== "POP") {
      // Only a filter or search text changed: stay where you are.
      if (!samePage) window.scrollTo(0, 0);
      return undefined;
    }

    const target = positions.get(location.key);
    if (!target) {
      if (!samePage) window.scrollTo(0, 0);
      return undefined;
    }

    // The page may still be loading: keep trying until it is tall enough (max 2 s),
    // and stop at once if the person starts scrolling themselves.
    let frame = 0;
    let stopped = false;
    const started = performance.now();
    const stop = () => {
      stopped = true;
    };
    const attempt = () => {
      if (stopped) return;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (max >= target - 2 || performance.now() - started > 2000) {
        window.scrollTo(0, Math.min(target, Math.max(max, 0)));
        return;
      }
      frame = requestAnimationFrame(attempt);
    };
    attempt();
    window.addEventListener("wheel", stop, { passive: true, once: true });
    window.addEventListener("touchstart", stop, { passive: true, once: true });
    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      window.removeEventListener("wheel", stop);
      window.removeEventListener("touchstart", stop);
    };
  }, [location.key, location.pathname, navigationType]);
}
