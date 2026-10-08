import { useEffect, useState } from "react";
import { teacherSchedule } from "./teacherApi.js";

let cache = null;

/** Weekly lessons the caller may mark (teacher: own courses; admin: all). */
export function useTeacherSchedule() {
  const [state, setState] = useState(() => (cache ? { status: "ready", rows: cache } : { status: "loading", rows: [] }));
  useEffect(() => {
    let alive = true;
    teacherSchedule()
      .then((rows) => {
        cache = rows;
        if (alive) setState({ status: "ready", rows });
      })
      .catch(() => alive && setState((current) => (current.status === "ready" ? current : { status: "error", rows: [] })));
    return () => {
      alive = false;
    };
  }, []);
  return state;
}

export function coursesOf(rows) {
  const map = new Map();
  for (const row of rows) if (!map.has(row.course_id)) map.set(row.course_id, { id: row.course_id, code: row.course_code, name: row.course_name, hue: row.hue });
  return [...map.values()];
}
