import { createContext, useContext, useMemo, useState } from "react";
import { COURSES } from "../../data/courses.js";

// Keeps calculator inputs while the student moves between pages.
// Inputs are NOT saved to the server yet; that comes in stage 7.

const GpaContext = createContext(null);

const emptyEntry = { ab1: "", ab2: "", exam: "" };

export function GpaProvider({ children }) {
  const [entries, setEntries] = useState(() =>
    Object.fromEntries(COURSES.map((course) => [course.slug, { ...emptyEntry }]))
  );
  const [feedback, setFeedback] = useState({ sound: false, vibration: false });

  const value = useMemo(
    () => ({
      entries,
      feedback,
      setFeedback,
      updateEntry(slug, field, raw) {
        setEntries((current) => ({ ...current, [slug]: { ...current[slug], [field]: raw } }));
      },
      clearAll() {
        setEntries(Object.fromEntries(COURSES.map((course) => [course.slug, { ...emptyEntry }])));
      },
    }),
    [entries, feedback]
  );

  return <GpaContext.Provider value={value}>{children}</GpaContext.Provider>;
}

export function useGpa() {
  const context = useContext(GpaContext);
  if (!context) throw new Error("useGpa must be used inside <GpaProvider>");
  return context;
}
