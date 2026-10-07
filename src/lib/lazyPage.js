import { lazy } from "react";

// lazy() that survives a deploy: if an old tab asks for a page file that no longer
// exists on the server, reload once to get the new version instead of crashing.
const KEY = "ulpa-chunk-reload";

export function lazyPage(load) {
  return lazy(() =>
    load()
      .then((module) => {
        try {
          sessionStorage.removeItem(KEY);
        } catch {
          /* ignore */
        }
        return module;
      })
      .catch((error) => {
        let reloaded = false;
        try {
          reloaded = sessionStorage.getItem(KEY) === "1";
          sessionStorage.setItem(KEY, "1");
        } catch {
          /* ignore */
        }
        if (!reloaded && navigator.onLine !== false) {
          window.location.reload();
          return new Promise(() => {}); // keep showing the loading state until the reload
        }
        throw error;
      })
  );
}
