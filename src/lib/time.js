import { APP_TIME_ZONE } from "../config/app.js";

/** Current hour (0–23) in Almaty, regardless of the device time zone. */
export function almatyHour(date = new Date()) {
  const hour = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    hourCycle: "h23",
    timeZone: APP_TIME_ZONE,
  }).format(date);
  return Number(hour);
}

export function greetingFor(date = new Date()) {
  const hour = almatyHour(date);
  if (hour < 5) return "Қайырлы түн";
  if (hour < 12) return "Қайырлы таң";
  if (hour < 18) return "Қайырлы күн";
  return "Қайырлы кеш";
}

// Kazakh names are written out here because not every browser ships kk-KZ date data
// (some silently fall back to English).
const MONTHS_KK = [
  "қаңтар", "ақпан", "наурыз", "сәуір", "мамыр", "маусым",
  "шілде", "тамыз", "қыркүйек", "қазан", "қараша", "желтоқсан",
];
const WEEKDAYS_KK = ["Дүйсенбі", "Сейсенбі", "Сәрсенбі", "Бейсенбі", "Жұма", "Сенбі", "Жексенбі"];

/** Calendar parts (year, month 1–12, day) in Almaty time. */
export function almatyDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: APP_TIME_ZONE,
  }).formatToParts(date);
  const get = (type) => Number(parts.find((part) => part.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day") };
}

/** e.g. "6 қазан, Сейсенбі" */
export function formatLongDate(date = new Date()) {
  const { month, day } = almatyDateParts(date);
  return `${day} ${MONTHS_KK[month - 1]}, ${WEEKDAYS_KK[almatyWeekday(date) - 1]}`;
}


export const WEEKDAYS = [
  { id: 1, short: "Дс", label: "Дүйсенбі" },
  { id: 2, short: "Сс", label: "Сейсенбі" },
  { id: 3, short: "Ср", label: "Сәрсенбі" },
  { id: 4, short: "Бс", label: "Бейсенбі" },
  { id: 5, short: "Жм", label: "Жұма" },
  { id: 6, short: "Сб", label: "Сенбі" },
];

/** ISO weekday (1 = Monday … 7 = Sunday) in Almaty. */
export function almatyWeekday(date = new Date()) {
  const name = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    timeZone: APP_TIME_ZONE,
  }).format(date);
  return ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(name) + 1;
}
