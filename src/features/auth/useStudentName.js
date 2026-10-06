import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase.js";
import { normalizeStudentCode } from "./studentCode.js";

const cache = new Map();

/**
 * Looks up the display name for a typed student code (only after 2 digits).
 * Returns { state: "idle" | "loading" | "found" | "missing", name }.
 */
export function useStudentName(rawCode) {
  const code = String(rawCode ?? "").length === 2 ? normalizeStudentCode(rawCode) : null;
  const [result, setResult] = useState({ state: "idle", name: null });

  useEffect(() => {
    if (!code) {
      setResult({ state: "idle", name: null });
      return undefined;
    }
    if (cache.has(code)) {
      const name = cache.get(code);
      setResult({ state: name ? "found" : "missing", name });
      return undefined;
    }

    let cancelled = false;
    setResult({ state: "loading", name: null });
    const timer = setTimeout(async () => {
      const { data, error } = await supabase.rpc("student_display_name", { p_code: code });
      if (cancelled) return;
      if (error) {
        setResult({ state: "idle", name: null }); // network issue: just show nothing
        return;
      }
      cache.set(code, data ?? null);
      setResult({ state: data ? "found" : "missing", name: data ?? null });
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [code]);

  return result;
}
