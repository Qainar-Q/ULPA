import { createClient } from "@supabase/supabase-js";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "../config/supabase.js";
import { DEMO_AUTH_KEY, isDemo } from "../demo/demoMode.js";

// Demo mode: same app, but every request is answered inside the browser with made-up
// data (src/demo/demoBackend.js). The real project is never contacted.
const demoFetch = async (...args) => (await import("../demo/demoBackend.js")).demoFetch(...args);

// Phones lose the network for a moment all the time (lifts, a tab woken from the background).
// Reads (GET) get a 20-second limit and one quiet retry; writes are never repeated here.
async function resilientFetch(input, init = {}) {
  const method = (init.method || (typeof input === "object" && input?.method) || "GET").toUpperCase();
  const url = typeof input === "string" ? input : input?.url ?? String(input);
  // Only data reads: sign-in checks must fail fast so the app can fall back to the login screen.
  if ((method !== "GET" && method !== "HEAD") || !/\/rest\/v1\//.test(url)) return fetch(input, init);
  for (let attempt = 0; ; attempt += 1) {
    const controller = new AbortController();
    const outer = init.signal;
    const forward = () => controller.abort(outer.reason);
    if (outer) outer.aborted ? controller.abort(outer.reason) : outer.addEventListener("abort", forward, { once: true });
    const timer = setTimeout(() => controller.abort(new DOMException("Request timed out", "TimeoutError")), 20000);
    try {
      return await fetch(input, { ...init, signal: controller.signal });
    } catch (error) {
      if (outer?.aborted || attempt >= 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, 600));
    } finally {
      clearTimeout(timer);
      outer?.removeEventListener("abort", forward);
    }
  }
}

// Single shared client. Supabase keeps the login session in browser storage
// and refreshes it automatically, so a page reload keeps the user signed in.
export const supabase = isDemo()
  ? createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: true, autoRefreshToken: false, detectSessionInUrl: false, storageKey: DEMO_AUTH_KEY },
      global: { fetch: demoFetch },
    })
  : createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        // Face ID / fingerprint sign-in (WebAuthn passkeys). Experimental in supabase-js.
        experimental: { passkey: true },
      },
      global: { fetch: resilientFetch },
    });
