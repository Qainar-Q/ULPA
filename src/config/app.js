// Global app settings. Change values here instead of scattering them in components.

export const APP_NAME = "ULPA";
export const CLASS_LABEL = "ҒТТ"; // whole class (both groups)
export const PROGRAM_NAME = "Ғарыштық техника және технология";

// All dates and times are interpreted in Almaty local time.
export const APP_TIME_ZONE = "Asia/Almaty";
export const APP_LOCALE = "kk-KZ";

export const GROUPS = [
  { id: 1, label: "1-топ" },
  { id: 2, label: "2-топ" },
];

// EASYФОТО: exactly two photo types. Do not add more.
export const PHOTO_TYPES = [
  { id: "lecture", label: "Дәріс" },
  { id: "lab", label: "Зертханалық жұмыс" },
];

// Session types used by the schedule.
export const SESSION_TYPES = {
  lecture: "Дәріс",
  lab: "Зертханалық жұмыс",
};

// Supabase free plan file storage. Admins see a warning from 70 % onwards.
export const STORAGE_LIMIT_BYTES = 1e9;
export const STORAGE_WARN_RATIO = 0.7;

// First day counted by the personal attendance log (change if the semester started on another day).
export const SEMESTER_START = "2026-09-01";
