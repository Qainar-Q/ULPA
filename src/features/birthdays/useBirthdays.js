import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase.js";
import { useAuth } from "../auth/AuthContext.jsx";
import { almatyDateParts } from "../../lib/time.js";

/** Days from today (Almaty) until the next occurrence of day/month (0 = today). */
function daysUntil(month, day, now) {
  const { year, month: m, day: d } = almatyDateParts(now);
  const today = Date.UTC(year, m - 1, d);
  let next = Date.UTC(year, month - 1, day);
  if (next < today) next = Date.UTC(year + 1, month - 1, day);
  return Math.round((next - today) / 86400000);
}

/** Class birthdays (first name + day/month only), with today's and upcoming ones. */
export function useBirthdays(windowDays = 7) {
  const { status: authStatus } = useAuth();
  const [rows, setRows] = useState([]);

  useEffect(() => {
    if (authStatus !== "signedIn") return;
    supabase.rpc("class_birthdays").then(({ data, error }) => {
      if (!error && data) setRows(data);
    });
  }, [authStatus]);

  const now = new Date();
  const withDays = rows
    .map((row) => ({ ...row, inDays: daysUntil(row.birth_month, row.birth_day, now) }))
    .sort((a, b) => a.inDays - b.inDays);

  return {
    all: withDays,
    today: withDays.filter((row) => row.inDays === 0),
    upcoming: withDays.filter((row) => row.inDays > 0 && row.inDays <= windowDays),
  };
}
