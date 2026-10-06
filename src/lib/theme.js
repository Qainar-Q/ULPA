// Theme preference: "dark" (default), "light" or "system". Stored per device.
// index.html applies it before React starts so the page never flashes the wrong colours.

const KEY = "ulpa-theme";
const COLORS = { dark: "#050a14", light: "#f3f5fa" };

export function getThemePreference() {
  try {
    return localStorage.getItem(KEY) || "dark";
  } catch {
    return "dark";
  }
}

function resolve(preference) {
  if (preference === "system") {
    return window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark";
  }
  return preference === "light" ? "light" : "dark";
}

export function applyTheme(preference = getThemePreference()) {
  const theme = resolve(preference);
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", COLORS[theme]);
  return theme;
}

export function setThemePreference(preference) {
  try {
    localStorage.setItem(KEY, preference);
  } catch {
    /* storage blocked: still apply for this visit */
  }
  return applyTheme(preference);
}

/** Follow the OS when the preference is "system". */
export function watchSystemTheme() {
  const query = window.matchMedia?.("(prefers-color-scheme: light)");
  if (!query) return () => {};
  const onChange = () => getThemePreference() === "system" && applyTheme("system");
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}
