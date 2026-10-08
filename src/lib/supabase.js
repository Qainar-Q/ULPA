import { createClient } from "@supabase/supabase-js";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "../config/supabase.js";
import { DEMO_AUTH_KEY, isDemo } from "../demo/demoMode.js";

// Demo mode: same app, but every request is answered inside the browser with made-up
// data (src/demo/demoBackend.js). The real project is never contacted.
const demoFetch = async (...args) => (await import("../demo/demoBackend.js")).demoFetch(...args);

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
    });
