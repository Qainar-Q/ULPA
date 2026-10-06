import { createClient } from "@supabase/supabase-js";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "../config/supabase.js";

// Single shared client. Supabase keeps the login session in browser storage
// and refreshes it automatically, so a page reload keeps the user signed in.
export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    // Face ID / fingerprint sign-in (WebAuthn passkeys). Experimental in supabase-js.
    experimental: { passkey: true },
  },
});
