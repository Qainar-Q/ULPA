// Fetch the code of the most used pages while the phone is idle, so the first
// tap on the bottom bar opens instantly. (Afterwards the service worker keeps them.)
const COMMON = [
  () => import("../pages/SchedulePage.jsx"),
  () => import("../pages/TasksPage.jsx"),
  () => import("../pages/PhotosPage.jsx"),
  () => import("../pages/GpaPage.jsx"),
  () => import("../pages/ProfilePage.jsx"),
];

export function prefetchPages() {
  if (navigator.connection?.saveData) return undefined;
  const idle = window.requestIdleCallback ?? ((fn) => setTimeout(fn, 1500));
  const cancel = window.cancelIdleCallback ?? clearTimeout;
  const handle = idle(() => COMMON.forEach((load) => load().catch(() => {})), { timeout: 4000 });
  return () => cancel(handle);
}
