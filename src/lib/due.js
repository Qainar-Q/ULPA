import { APP_TIME_ZONE } from "../config/app.js";
import { almatyDateParts, weekdayLabel, almatyWeekday } from "./time.js";

const pad = (value) => String(value).padStart(2, "0");

/** "GMT+05:00" style offset of Almaty at a given moment. */
function almatyOffset(date) {
  try {
    const part = new Intl.DateTimeFormat("en-US", { timeZone: APP_TIME_ZONE, timeZoneName: "longOffset" })
      .formatToParts(date)
      .find((item) => item.type === "timeZoneName")?.value;
    const match = part?.match(/GMT([+-]\d{2}):?(\d{2})?/);
    if (match) return `${match[1]}:${match[2] ?? "00"}`;
  } catch {
    /* older browsers */
  }
  return "+05:00";
}

/** <input type="datetime-local"> value (Almaty wall clock) → ISO string. */
export function localInputToIso(value) {
  if (!value) return null;
  const guess = new Date(`${value}:00Z`);
  return new Date(`${value}:00${almatyOffset(guess)}`).toISOString();
}

/** ISO string → "YYYY-MM-DDTHH:mm" in Almaty for <input type="datetime-local">. */
export function isoToLocalInput(iso) {
  if (!iso) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const get = (type) => parts.find((part) => part.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

function clock(date) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: APP_TIME_ZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(date);
}

function dayNumber(date) {
  const { year, month, day } = almatyDateParts(date);
  return Math.floor(Date.UTC(year, month - 1, day) / 86400000);
}

/**
 * Human label + tone for a due date.
 * tone: "none" | "overdue" | "today" | "soon" (≤3 days) | "later"
 */
export function dueInfo(iso, now = new Date()) {
  if (!iso) return { tone: "none", label: "Мерзімі жоқ" };
  const due = new Date(iso);
  const days = dayNumber(due) - dayNumber(now);
  const time = clock(due);
  const { day, month } = almatyDateParts(due);
  const shortDate = `${pad(day)}.${pad(month)}`;

  if (due.getTime() < now.getTime()) return { tone: "overdue", label: `Мерзімі өтті · ${shortDate} ${time}` };
  if (days === 0) return { tone: "today", label: `Бүгін ${time} дейін` };
  if (days === 1) return { tone: "soon", label: `Ертең ${time} дейін` };
  if (days <= 6) {
    return { tone: days <= 3 ? "soon" : "later", label: `${days} күн қалды · ${weekdayLabel(almatyWeekday(due))} ${time}` };
  }
  return { tone: "later", label: `${shortDate} · ${time}` };
}

export function formatDateTime(iso) {
  if (!iso) return "—";
  const date = new Date(iso);
  const { day, month, year } = almatyDateParts(date);
  return `${pad(day)}.${pad(month)}.${year} ${clock(date)}`;
}
