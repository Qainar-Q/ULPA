import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { readCache, writeCache } from "../../lib/cache.js";
import { supabase } from "../../lib/supabase.js";
import { useAuth } from "../auth/AuthContext.jsx";

// Courses + weekly schedule, loaded once after sign-in.
// The database (RLS) already hides other groups' labs; nothing is filtered for security here.

const CatalogContext = createContext(null);

export function CatalogProvider({ children }) {
  const { status: authStatus, student, isAdmin } = useAuth();
  const [adminGroup, setAdminGroup] = useState(null);
  const [courses, setCourses] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [status, setStatus] = useState("idle"); // idle | loading | ready | error

  const userId = student?.id ?? null;
  const hasData = useRef(false);

  const load = useCallback(async () => {
    // With a saved copy on screen, refresh quietly instead of showing "loading".
    if (!hasData.current) setStatus("loading");
    const [coursesResult, sessionsResult] = await Promise.all([
      supabase.from("courses").select("id, slug, code, name, teacher, description, hue, sort_order").order("sort_order"),
      supabase
        .from("schedule_entries")
        .select("id, course_id, weekday, start_time, end_time, room, session_type, group_no, note")
        .order("weekday")
        .order("start_time"),
    ]);

    if (coursesResult.error || sessionsResult.error) {
      // Offline: keep showing the last copy if there is one.
      setStatus(hasData.current ? "ready" : "error");
      return;
    }
    hasData.current = true;
    setCourses(coursesResult.data);
    setSessions(sessionsResult.data);
    setStatus("ready");
    writeCache("catalog", userId, { courses: coursesResult.data, sessions: sessionsResult.data });
  }, [userId]);

  useEffect(() => {
    if (authStatus === "signedIn") {
      const cached = readCache("catalog", userId);
      if (cached?.courses?.length && !hasData.current) {
        hasData.current = true;
        setCourses(cached.courses);
        setSessions(cached.sessions);
        setStatus("ready");
      }
      load();
    }
    if (authStatus === "signedOut") {
      hasData.current = false;
      setCourses([]);
      setSessions([]);
      setStatus("idle");
    }
  }, [authStatus, userId, load]);

  const value = useMemo(() => {
    const byId = new Map(courses.map((course) => [course.id, course]));
    const bySlug = new Map(courses.map((course) => [course.slug, course]));
    // Students always see their own group; an admin may switch between groups.
    const viewerGroup = isAdmin && adminGroup ? adminGroup : student?.group_no ?? null;
    return {
      status,
      courses,
      sessions,
      viewerGroup,
      canSwitchGroup: Boolean(isAdmin),
      setViewerGroup: setAdminGroup,
      mySessions: viewerGroup ? visibleSessions(sessions, viewerGroup) : sessions,
      reload: load,
      courseById: (id) => byId.get(id) ?? null,
      courseBySlug: (slug) => bySlug.get(slug) ?? null,
    };
  }, [status, courses, sessions, load, isAdmin, adminGroup, student?.group_no]);

  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}

export function useCatalog() {
  const context = useContext(CatalogContext);
  if (!context) throw new Error("useCatalog must be used inside <CatalogProvider>");
  return context;
}

/**
 * Sessions the current viewer should see. Students: what RLS returned.
 * Admins (who can read both groups) pick which group to view.
 */
export function visibleSessions(sessions, group) {
  return sessions.filter((session) => session.group_no === null || session.group_no === group);
}
