import { registerSW } from "virtual:pwa-register";
import { isBusy } from "./busy.js";

// Keeps the installed app (home-screen icon) up to date.
//  * checks for a new version when the app comes back to the foreground and every 30 min
//  * when one is ready: tells the UI (toast with "update" button) and applies it
//    automatically the next time the app goes to the background — never mid-typing.

const listeners = new Set();
let ready = false;
let applyUpdate = null;

export function onUpdateReady(callback) {
  listeners.add(callback);
  if (ready) callback();
  return () => listeners.delete(callback);
}

export function updateNow() {
  applyUpdate?.(true);
}

export function startPwaUpdates() {
  if (!("serviceWorker" in navigator)) return;

  applyUpdate = registerSW({
    immediate: true,
    onNeedRefresh() {
      ready = true;
      listeners.forEach((callback) => callback());
    },
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      const check = () => {
        if (navigator.onLine !== false && !registration.installing) registration.update().catch(() => {});
      };
      setInterval(check, 30 * 60 * 1000);
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") check();
      });
    },
  });

  // Leaving the app with an update waiting → apply it now, unseen — unless an upload,
  // a translation or a half-written form would be lost; then wait for the next time.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden" && ready && !isBusy()) updateNow();
  });
}
