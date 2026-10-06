import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase.js";
import { classifyAuthError, classifyPasskeyError } from "./errors.js";
import { normalizeStudentCode, studentEmail } from "./studentCode.js";

const AuthContext = createContext(null);

// status: "loading" → "signedIn" | "signedOut"
export function AuthProvider({ children }) {
  const [status, setStatus] = useState("loading");
  const [session, setSession] = useState(null);
  const [student, setStudent] = useState(null);
  const [notice, setNotice] = useState(null); // e.g. "session_expired", "not_linked"

  const loadStudent = useCallback(async (nextSession) => {
    if (!nextSession) {
      setSession(null);
      setStudent(null);
      setStatus("signedOut");
      return;
    }

    // RLS returns only the caller's own row (admins can read all, so filter by user_id).
    const { data, error } = await supabase
      .from("students")
      .select("id, code, full_name, group_no, role, is_monitor, birth_month, birth_day, avatar_path, activated_at")
      .eq("user_id", nextSession.user.id)
      .maybeSingle();

    if (error || !data) {
      await supabase.auth.signOut();
      setNotice(error ? "server_error" : "not_linked");
      setSession(null);
      setStudent(null);
      setStatus("signedOut");
      return;
    }

    setSession(nextSession);
    setStudent(data);
    setStatus("signedIn");
  }, []);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (active) loadStudent(data.session);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!active) return;
      if (event === "SIGNED_OUT") {
        setSession(null);
        setStudent(null);
        setStatus("signedOut");
      } else if (event === "TOKEN_REFRESHED" && nextSession) {
        setSession(nextSession);
      } else if (event === "SIGNED_IN" && nextSession) {
        // Defer: calling Supabase inside this callback can deadlock the auth client.
        setTimeout(() => active && loadStudent(nextSession), 0);
      }
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [loadStudent]);

  const signIn = useCallback(async (rawCode, password) => {
    const code = normalizeStudentCode(rawCode);
    if (!code) return { error: "code_format" };
    if (!password) return { error: "invalid_credentials" };

    setNotice(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: studentEmail(code), password });
      if (error) return { error: classifyAuthError(error) };
      return { error: null };
    } catch {
      return { error: "network" };
    }
  }, []);

  const activate = useCallback(
    async (rawCode, accessCode, password) => {
      const code = normalizeStudentCode(rawCode);
      if (!code) return { error: "code_format" };
      if (password.length < 8) return { error: "weak_password" };

      try {
        const { data, error } = await supabase.functions.invoke("account-activate", {
          body: { studentCode: code, accessCode, password },
        });

        if (error) {
          // Non-2xx: read our JSON error code from the response body.
          let errorCode = "server_error";
          try {
            const body = await error.context?.json();
            if (body?.error) errorCode = body.error;
          } catch {
            if (String(error.name).includes("FetchError")) errorCode = "network";
          }
          return { error: errorCode };
        }
        if (!data?.ok) return { error: data?.error ?? "server_error" };
      } catch {
        return { error: "network" };
      }

      // Password is set — sign straight in.
      return signIn(code, password);
    },
    [signIn]
  );

  const signInWithPasskey = useCallback(async () => {
    if (!window.PublicKeyCredential) return { error: "passkey_unsupported" };
    setNotice(null);
    try {
      const { error } = await supabase.auth.signInWithPasskey();
      if (error) return { error: classifyPasskeyError(error) };
      return { error: null };
    } catch (error) {
      return { error: classifyPasskeyError(error) };
    }
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const refreshStudent = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    await loadStudent(data.session);
  }, [loadStudent]);

  const value = useMemo(
    () => ({
      status,
      session,
      student,
      isAdmin: student?.role === "admin",
      notice,
      clearNotice: () => setNotice(null),
      signIn,
      signInWithPasskey,
      activate,
      signOut,
      refreshStudent,
    }),
    [status, session, student, notice, signIn, signInWithPasskey, activate, signOut, refreshStudent]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside <AuthProvider>");
  return context;
}
