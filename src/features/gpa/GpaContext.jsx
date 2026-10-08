import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../lib/supabase.js";
import { useAuth } from "../auth/AuthContext.jsx";
import { useCatalog } from "../catalog/CatalogContext.jsx";
import { parseScore } from "../../lib/gpa.js";

// Calculator inputs, saved to the student's own private row in student_grades
// (only that student can read them). Saves ~0.8 s after typing stops.

const GpaContext = createContext(null);

export const emptyEntry = { ab1: "", ab2: "", exam: "" };

const toInput = (value) => (value === null || value === undefined ? "" : String(Number(value)));

export function GpaProvider({ children }) {
  const { status: authStatus, student } = useAuth();
  const { courses } = useCatalog();
  const [entries, setEntries] = useState({}); // { [slug]: { ab1, ab2, exam } }
  const [saveState, setSaveState] = useState("idle"); // idle | saving | saved | error
  const [feedback, setFeedback] = useState({ sound: false, vibration: false });
  const timers = useRef({});
  const pending = useRef(new Set()); // slugs typed but not saved yet

  // Load saved grades once courses are known.
  useEffect(() => {
    if (authStatus !== "signedIn" || courses.length === 0) return;
    let cancelled = false;
    supabase
      .from("student_grades")
      .select("course_id, ab1, ab2, exam")
      .then(({ data, error }) => {
        if (cancelled || error || !data) return;
        const bySlug = {};
        for (const row of data) {
          const course = courses.find((item) => item.id === row.course_id);
          if (course) bySlug[course.slug] = { ab1: toInput(row.ab1), ab2: toInput(row.ab2), exam: toInput(row.exam) };
        }
        // Never overwrite what the student is typing right now.
        setEntries((current) => {
          const merged = { ...bySlug };
          for (const slug of pending.current) if (current[slug]) merged[slug] = current[slug];
          return merged;
        });
      });
    return () => {
      cancelled = true;
    };
  }, [authStatus, student?.id, courses]);

  useEffect(() => {
    if (authStatus === "signedOut") setEntries({});
  }, [authStatus]);

  const persist = useCallback(
    async (slug, entry) => {
      const course = courses.find((item) => item.slug === slug);
      if (!course) return;
      const values = [entry.ab1, entry.ab2, entry.exam].map(parseScore);
      pending.current.delete(slug);
      if (values.some((value) => Number.isNaN(value))) return; // never save invalid input
      setSaveState("saving");
      const [ab1, ab2, exam] = values;
      const { error } =
        ab1 === null && ab2 === null && exam === null
          ? await supabase.from("student_grades").delete().eq("course_id", course.id)
          : await supabase
              .from("student_grades")
              .upsert({ course_id: course.id, ab1, ab2, exam }, { onConflict: "student_id,course_id" });
      setSaveState(error ? "error" : "saved");
    },
    [courses]
  );

  const updateEntry = useCallback(
    (slug, field, raw) => {
      setEntries((current) => {
        const next = { ...emptyEntry, ...current[slug], [field]: raw };
        pending.current.add(slug);
        clearTimeout(timers.current[slug]);
        timers.current[slug] = setTimeout(() => persist(slug, next), 800);
        return { ...current, [slug]: next };
      });
    },
    [persist]
  );

  const clearAll = useCallback(async () => {
    setEntries({});
    setSaveState("saving");
    const { error } = await supabase.from("student_grades").delete().not("course_id", "is", null);
    setSaveState(error ? "error" : "saved");
  }, []);

  const value = useMemo(
    () => ({ entries, feedback, setFeedback, updateEntry, clearAll, saveState }),
    [entries, feedback, updateEntry, clearAll, saveState]
  );

  return <GpaContext.Provider value={value}>{children}</GpaContext.Provider>;
}

export function useGpa() {
  const context = useContext(GpaContext);
  if (!context) throw new Error("useGpa must be used inside <GpaProvider>");
  return context;
}
