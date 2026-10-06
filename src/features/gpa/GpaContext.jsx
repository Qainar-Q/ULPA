import { createContext, useContext, useMemo, useState } from "react";

// Keeps calculator inputs while the student moves between pages.
// Inputs are NOT saved to the server yet; that comes in stage 7.

const GpaContext = createContext(null);

export const emptyEntry = { ab1: "", ab2: "", exam: "" };

export function GpaProvider({ children }) {
  // { [courseSlug]: { ab1, ab2, exam } } — missing courses mean "nothing entered yet".
  const [entries, setEntries] = useState({});
  const [feedback, setFeedback] = useState({ sound: false, vibration: false });

  const value = useMemo(
    () => ({
      entries,
      feedback,
      setFeedback,
      updateEntry(slug, field, raw) {
        setEntries((current) => ({ ...current, [slug]: { ...emptyEntry, ...current[slug], [field]: raw } }));
      },
      clearAll() {
        setEntries({});
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
