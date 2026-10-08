import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { exitDemo, isDemo } from "../../demo/demoMode.js";
import { supabase } from "../../lib/supabase.js";
import { clearPrivateFileCache } from "../../lib/signedUrls.js";
import { disablePush } from "../../lib/push.js";
import { classifyAuthError, classifyPasskeyError } from "./errors.js";
import { normalizeStudentCode, studentEmail } from "./studentCode.js";

const AuthContext = createContext(null);

// Last known profile (name, code, group, role — nothing secret) so the app still opens
// offline or when the server is briefly unreachable, instead of signing the student out.
const PROFILE_KEY = isDemo() ? "ulpa-demo-profile" : "ulpa-profile";
function rememberProfile(userId, profile) {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify({ userId, ...profile }));
  } catch {
    /* storage unavailable */
  }
}
function cachedProfile(userId) {
  try {
    const saved = JSON.parse(localStorage.getItem(PROFILE_KEY) ?? "null");
    return saved?.userId === userId ? { kind: saved.kind, data: saved.data } : null;
  } catch {
    return null;
  }
}
function forgetProfile() {
  try {
    localStorage.removeItem(PROFILE_KEY);
  } catch {
    /* ignore */
  }
}

// status: "loading" → "signedIn" | "signedOut"
export function AuthProvider({ children }) {
  const [status, setStatus] = useState("loading");
  const [session, setSession] = useState(null);
  const [student, setStudent] = useState(null);
  const [teacher, setTeacher] = useState(null); // teacher accounts have no student row
  const [notice, setNotice] = useState(null); // e.g. "session_expired", "not_linked"

  const loadedUser = useRef(null);

  const loadStudent = useCallback(async (nextSession) => {
    if (!nextSession) {
      loadedUser.current = null;
      setSession(null);
      setStudent(null);
      setTeacher(null);
      setStatus("signedOut");
      return;
    }

    const apply = (profile) => {
      loadedUser.current = nextSession.user.id;
      setSession(nextSession);
      setStudent(profile.kind === "student" ? profile.data : null);
      setTeacher(profile.kind === "teacher" ? profile.data : null);
      setStatus("signedIn");
      rememberProfile(nextSession.user.id, profile);
    };

    // A few quick retries: right after unlocking the phone the network is often not ready.
    let lastError = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      if (attempt) await new Promise((resolve) => setTimeout(resolve, attempt * 1500));
      // RLS returns only the caller's own row (admins can read all, so filter by user_id).
      const { data, error } = await supabase
        .from("students")
        .select("id, code, full_name, group_no, role, is_monitor, birth_month, birth_day, avatar_path, activated_at")
        .eq("user_id", nextSession.user.id)
        .maybeSingle();
      if (data) return apply({ kind: "student", data });
      if (error) {
        lastError = error;
        continue;
      }
      // Not a student: maybe a teacher account.
      const { data: teacherData, error: teacherError } = await supabase.rpc("teacher_me");
      if (teacherData?.id) return apply({ kind: "teacher", data: teacherData });
      if (teacherError) {
        lastError = teacherError;
        continue;
      }
      // The server answered: this login belongs to nobody. Only now sign out.
      loadedUser.current = null;
      await supabase.auth.signOut();
      setNotice("not_linked");
      setSession(null);
      setStudent(null);
      setTeacher(null);
      setStatus("signedOut");
      return;
    }

    // Offline / server trouble: keep the session. Use the last known profile if we have it.
    const cached = cachedProfile(nextSession.user.id);
    if (cached) {
      apply(cached);
      return;
    }
    console.warn("profile load failed", lastError?.message);
    setNotice("server_error");
    setSession(nextSession);
    setStatus("signedOut");
  }, []);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (active) loadStudent(data.session);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!active) return;
      if (event === "SIGNED_OUT") {
        loadedUser.current = null;
        setSession(null);
        setStudent(null);
        setTeacher(null);
        setStatus("signedOut");
      } else if (event === "TOKEN_REFRESHED" && nextSession) {
        setSession(nextSession);
      } else if (event === "SIGNED_IN" && nextSession) {
        // The auth client repeats SIGNED_IN whenever the app returns to the foreground:
        // no need to reload the same person's profile each time.
        if (nextSession.user.id === loadedUser.current) {
          setSession(nextSession);
          return;
        }
        // Defer: calling Supabase inside this callback can deadlock the auth client.
        setTimeout(() => active && loadStudent(nextSession), 0);
      }
    });

    // Came back online after a failed start: try again.
    const onOnline = () => {
      if (!loadedUser.current) supabase.auth.getSession().then(({ data }) => active && data.session && loadStudent(data.session));
    };
    window.addEventListener("online", onOnline);

    return () => {
      active = false;
      listener.subscription.unsubscribe();
      window.removeEventListener("online", onOnline);
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
    if (isDemo()) return exitDemo("/login");
    // This device should stop receiving this student's notifications.
    await disablePush().catch(() => {});
    await clearPrivateFileCache();
    forgetProfile();
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
      teacher,
      isTeacher: Boolean(teacher),
      isAdmin: student?.role === "admin",
      notice,
      clearNotice: () => setNotice(null),
      signIn,
      signInWithPasskey,
      activate,
      signOut,
      refreshStudent,
    }),
    [status, session, student, teacher, notice, signIn, signInWithPasskey, activate, signOut, refreshStudent]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside <AuthProvider>");
  return context;
}
