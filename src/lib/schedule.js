import { APP_TIME_ZONE } from "../config/app.js";
import { almatyWeekday } from "./time.js";

/** "08:00:00" → "08:00" */
export function formatClock(time) {
  return time ? time.slice(0, 5) : "";
}

export function toMinutes(time) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

/** Minutes since midnight in Almaty right now. */
export function almatyMinutes(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: APP_TIME_ZONE,
  }).formatToParts(date);
  const get = (type) => Number(parts.find((part) => part.type === type)?.value);
  return get("hour") * 60 + get("minute");
}

export function sessionsOnDay(sessions, weekday) {
  return sessions
    .filter((session) => session.weekday === weekday)
    .sort((a, b) => a.start_time.localeCompare(b.start_time));
}

/**
 * The next session that has not started yet (searching up to a week ahead).
 * Returns { session, daysAhead } or null.
 */
export function nextSession(sessions, date = new Date()) {
  if (sessions.length === 0) return null;
  const today = almatyWeekday(date);
  const nowMinutes = almatyMinutes(date);

  for (let offset = 0; offset < 8; offset += 1) {
    const weekday = ((today - 1 + offset) % 7) + 1;
    const candidates = sessionsOnDay(sessions, weekday).filter(
      (session) => offset > 0 || toMinutes(session.start_time) > nowMinutes
    );
    if (candidates.length > 0) return { session: candidates[0], daysAhead: offset };
  }
  return null;
}

export const DEFAULT_LESSON_MINUTES = 50;

/** End of a class in minutes since midnight (end_time, or start + 50 min when missing). */
export function endMinutes(session) {
  return session.end_time ? toMinutes(session.end_time) : toMinutes(session.start_time) + DEFAULT_LESSON_MINUTES;
}

/** True while the class is in progress (today only — pass today's sessions). */
export function isInProgress(session, date = new Date()) {
  const now = almatyMinutes(date);
  return toMinutes(session.start_time) <= now && now < endMinutes(session);
}

/** The class happening right now, if any. */
export function currentSession(sessions, date = new Date()) {
  return sessionsOnDay(sessions, almatyWeekday(date)).find((session) => isInProgress(session, date)) ?? null;
}

/** 0–1 share of the class already gone, and whole minutes left. */
export function sessionProgress(session, date = new Date()) {
  const start = toMinutes(session.start_time);
  const end = endMinutes(session);
  const now = almatyMinutes(date);
  return { ratio: Math.min(1, Math.max(0, (now - start) / (end - start))), minutesLeft: Math.max(0, end - now) };
}

/** "now" | "past" | "next" | "later" for today's list. */
export function sessionState(session, nextId, date = new Date()) {
  if (isInProgress(session, date)) return "now";
  if (session.id === nextId) return "next";
  return endMinutes(session) <= almatyMinutes(date) ? "past" : "later";
}
