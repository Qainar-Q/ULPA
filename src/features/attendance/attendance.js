import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase.js";
import { useAuth } from "../auth/AuthContext.jsx";
import { almatyDateParts } from "../../lib/time.js";
import { almatyMinutes, toMinutes } from "../../lib/schedule.js";

export const STATUSES = [
  { id: "present", label: "Болдым", short: "✓" },
  { id: "absent", label: "Болмадым", short: "Жоқ" },
  { id: "late", label: "Кешіктім", short: "Кеш" },
  { id: "excused", label: "Себепті", short: "Себепті" },
  { id: "cancelled", label: "Сабақ болмады", short: "Болмады" },
];

const pad = (n) => String(n).padStart(2, "0");
const isoOf = (date) => `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;

export function todayIso(now = new Date()) {
  const { year, month, day } = almatyDateParts(now);
  return `${year}-${pad(month)}-${pad(day)}`;
}

export const markKey = (entryId, date) => `${entryId}|${date}`;

/**
 * Every class of my timetable that has already started, from `since` to now (Almaty),
 * newest first: [{ key, date, session }].
 */
export function pastOccurrences(sessions, since, now = new Date()) {
  const today = todayIso(now);
  const nowMinutes = almatyMinutes(now);
  const [y, m, d] = since.split("-").map(Number);
  const cursor = new Date(Date.UTC(y, m - 1, d));
  const out = [];
  for (let guard = 0; guard < 400; guard += 1) {
    const iso = isoOf(cursor);
    if (iso > today) break;
    const weekday = cursor.getUTCDay() || 7;
    for (const session of sessions) {
      if (session.weekday !== weekday) continue;
      if (iso === today && toMinutes(session.start_time) > nowMinutes) continue;
      out.push({ key: markKey(session.id, iso), date: iso, session });
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out.sort((a, b) => (a.date === b.date ? toMinutes(b.session.start_time) - toMinutes(a.session.start_time) : a.date < b.date ? 1 : -1));
}

/** Per-course and overall counts. Cancelled classes do not count. */
export function summarize(occurrences, marks) {
  const empty = () => ({ held: 0, absent: 0, excused: 0, late: 0 });
  const byCourse = {};
  const total = empty();
  for (const { key, session } of occurrences) {
    const status = marks[key];
    if (status === "cancelled") continue;
    const course = (byCourse[session.course_id] ??= empty());
    for (const bucket of [course, total]) {
      bucket.held += 1;
      if (status === "absent") bucket.absent += 1;
      if (status === "excused") bucket.excused += 1;
      if (status === "late") bucket.late += 1;
    }
  }
  const rate = (s) => (s.held ? Math.round(((s.held - s.absent - s.excused) / s.held) * 100) : 100);
  return { byCourse, total, rate };
}

/** My marks: { "entry|date": status }. Only the signed-in student's rows are readable. */
export function useAttendanceMarks() {
  const { status: authStatus } = useAuth();
  const [state, setState] = useState({ status: "loading", marks: {} });

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("attendance_marks").select("schedule_entry_id, session_date, status");
    if (error) return setState({ status: "error", marks: {} });
    setState({ status: "ready", marks: Object.fromEntries(data.map((row) => [markKey(row.schedule_entry_id, row.session_date), row.status])) });
  }, []);

  useEffect(() => {
    if (authStatus === "signedIn") load();
  }, [authStatus, load]);

  const setMark = useCallback(async (entryId, date, status) => {
    const key = markKey(entryId, date);
    let previous;
    setState((current) => {
      previous = current.marks[key];
      const marks = { ...current.marks };
      if (status === "present") delete marks[key];
      else marks[key] = status;
      return { ...current, marks };
    });
    const { error } =
      status === "present"
        ? await supabase.from("attendance_marks").delete().eq("schedule_entry_id", entryId).eq("session_date", date)
        : await supabase.rpc("set_attendance", { p_entry: entryId, p_date: date, p_status: status });
    if (error) {
      setState((current) => {
        const marks = { ...current.marks };
        if (previous) marks[key] = previous;
        else delete marks[key];
        return { ...current, marks };
      });
      throw error;
    }
  }, []);

  return { ...state, setMark, reload: load };
}
