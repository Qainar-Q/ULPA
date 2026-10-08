// "Don't reload me now": the app update waits while something is in progress.
let holds = 0;

/** Mark work in progress (upload, translation…). Call the returned function when done. */
export function holdBusy() {
  holds += 1;
  let released = false;
  return () => {
    if (!released) {
      released = true;
      holds -= 1;
    }
  };
}

/** Something would be lost by a reload: running work, an open form dialog, or typed text. */
export function isBusy() {
  if (holds > 0) return true;
  if (document.querySelector(".modal")) return true;
  return [...document.querySelectorAll("textarea, input[type='text']:not([readonly]), input:not([type])")].some((field) => field.value.trim().length > 0 && !field.closest("[data-ignore-busy]"));
}
