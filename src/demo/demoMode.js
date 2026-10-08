// Demo mode: a visitor explores ULPA with made-up data. Everything runs in the browser —
// the demo client never talks to the real database (see demoBackend.js), so no real
// student data can be seen or changed.

const FLAG = "ulpa-demo";
export const DEMO_AUTH_KEY = "ulpa-demo-auth";
export const DEMO_USER_ID = "00000000-0000-4000-8000-00000000d3e0";

export function isDemo() {
  try {
    return sessionStorage.getItem(FLAG) === "1";
  } catch {
    return false;
  }
}

const b64 = (value) => btoa(JSON.stringify(value)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

/** "student" (class view, as the admin) or "teacher" (teacher cabinet). */
export function demoRole() {
  try {
    return sessionStorage.getItem(`${FLAG}-role`) === "teacher" ? "teacher" : "student";
  } catch {
    return "student";
  }
}

/** Turn demo mode on for this tab and seed a local (fake) session. */
export function enterDemo(role = "student") {
  try {
    sessionStorage.setItem(FLAG, "1");
    sessionStorage.setItem(`${FLAG}-role`, role === "teacher" ? "teacher" : "student");
    sessionStorage.removeItem("ulpa-demo-store");
    const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30;
    const user = { id: DEMO_USER_ID, aud: "authenticated", role: "authenticated", email: "demo@ulpa.local", app_metadata: {}, user_metadata: {} };
    const session = {
      access_token: `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: DEMO_USER_ID, exp, role: "authenticated" })}.demo`,
      token_type: "bearer",
      expires_in: 60 * 60 * 24 * 30,
      expires_at: exp,
      refresh_token: "demo",
      user,
    };
    localStorage.setItem(DEMO_AUTH_KEY, JSON.stringify(session));
  } catch {
    /* storage blocked: the demo cannot start */
  }
}

/** Leave demo mode: forget the fake session and data, go back to the real sign-in page. */
export function exitDemo(to = "/login") {
  try {
    sessionStorage.removeItem(FLAG);
    sessionStorage.removeItem(`${FLAG}-role`);
    sessionStorage.removeItem("ulpa-demo-store");
    localStorage.removeItem(DEMO_AUTH_KEY);
  } catch {
    /* ignore */
  }
  window.location.replace(to);
}

/** Local file URL for a demo storage path (uploaded in this visit, or a bundled sample). */
const uploads = new Map();
export function rememberDemoUpload(path, blob) {
  uploads.set(path, URL.createObjectURL(blob));
}
export function demoFileUrl(path) {
  if (!path) return null;
  if (uploads.has(path)) return uploads.get(path);
  if (path.startsWith("demo/")) return `/${path}`;
  if (/\.pdf$/i.test(path)) return "/demo/sample.pdf";
  return "/demo/p1.jpg";
}
