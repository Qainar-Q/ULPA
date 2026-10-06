import { STUDENT_EMAIL_DOMAIN } from "../../config/supabase.js";

/** "5" → "05", " 12 " → "12". Returns null if it is not a valid class code (01–99). */
export function normalizeStudentCode(raw) {
  const digits = String(raw ?? "").trim();
  if (!/^[0-9]{1,2}$/.test(digits)) return null;
  const code = digits.padStart(2, "0");
  return code === "00" ? null : code;
}

export function studentEmail(code) {
  return `s${code}@${STUDENT_EMAIL_DOMAIN}`;
}
