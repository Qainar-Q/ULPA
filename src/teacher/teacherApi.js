import { supabase } from "../lib/supabase.js";

async function rpc(name, args) {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw error;
  return data;
}

export const teacherSchedule = () => rpc("teacher_schedule");
export const teacherRoll = (entryId, date) => rpc("teacher_roll", { p_entry: entryId, p_date: date });
export const teacherMark = (entryId, date, marks) => rpc("teacher_mark", { p_entry: entryId, p_date: date, p_marks: marks });
export const courseStats = (courseId) => rpc("teacher_course_stats", { p_course: courseId });
export const courseSheet = (courseId) => rpc("teacher_course_sheet", { p_course: courseId });
export const openCheckin = (entryId, date) => rpc("teacher_open_checkin", { p_entry: entryId, p_date: date });
export const checkinStatus = (sessionId) => rpc("teacher_checkin_status", { p_session: sessionId });
export const closeCheckin = (sessionId) => rpc("teacher_close_checkin", { p_session: sessionId });
export const announce = ({ title, body, groupNo }) => rpc("teacher_announce", { p_title: title, p_body: body, p_group_no: groupNo });
export const myAnnouncements = () => rpc("teacher_my_announcements");

// Admin
export const teacherAccounts = () => rpc("admin_teacher_accounts");
export const issueTeacherCode = (teacherId, purpose = "activation") => rpc("admin_issue_teacher_code", { p_teacher_id: teacherId, p_purpose: purpose });

// Students
export const myOfficialAttendance = () => rpc("my_official_attendance");
export const myOpenCheckins = () => rpc("my_open_checkins");
export const studentCheckin = (code, sessionId = null) => rpc("student_checkin", { p_code: code, p_session: sessionId });

export const STATUS = {
  present: { label: "Келді", short: "✓", tone: "ok" },
  late: { label: "Кешікті", short: "⏰", tone: "warn" },
  absent: { label: "Жоқ", short: "✕", tone: "bad" },
  excused: { label: "Себепті", short: "📝", tone: "info" },
};

/** "2026-10-08" in Almaty. */
export function almatyIso(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Almaty" }).format(date);
}

/** ISO weekday (1 = Monday) of a YYYY-MM-DD date. */
export function isoWeekday(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay() || 7;
}

/** Most recent date (today or earlier) that falls on `weekday`. */
export function lastDateFor(weekday, today = almatyIso()) {
  const back = (isoWeekday(today) - weekday + 7) % 7;
  const [y, m, d] = today.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) - back * 86400000).toISOString().slice(0, 10);
}

export function shiftDate(iso, days) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) + days * 86400000).toISOString().slice(0, 10);
}

export const clock = (time) => (time ? time.slice(0, 5) : "");
export const percent = (row) => {
  const counted = row.present + row.late + row.absent;
  return counted ? Math.round(((row.present + row.late) / counted) * 100) : null;
};
