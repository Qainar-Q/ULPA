import { supabase } from "../../lib/supabase.js";

// Admin-only writes. The database rejects these for students (RLS), whatever the UI shows.

function toPayload(form) {
  return {
    course_id: form.courseId,
    weekday: Number(form.weekday),
    start_time: form.startTime,
    end_time: form.endTime || null,
    room: form.room.trim() || null,
    session_type: form.sessionType,
    group_no: form.groupNo === "both" ? null : Number(form.groupNo),
  };
}

export function scheduleErrorMessage(error) {
  if (!error) return null;
  if (error.code === "23505") return "Бұл уақытта бұл топта сабақ бар.";
  if (error.code === "23514") {
    if (String(error.message).includes("lab_has_group")) return "Зертханалық жұмысқа топ таңдау керек.";
    if (String(error.message).includes("end_after_start")) return "Аяқталу уақыты басталу уақытынан кейін болуы керек.";
    return "Деректер дұрыс емес.";
  }
  if (error.code === "42501") return "Бұл әрекетке рұқсатың жоқ.";
  return "Сақталмады. Қайта көр.";
}

export async function createSession(form) {
  const { error } = await supabase.from("schedule_entries").insert(toPayload(form));
  if (error) throw error;
}

export async function updateSession(id, form) {
  const { error } = await supabase.from("schedule_entries").update(toPayload(form)).eq("id", id);
  if (error) throw error;
}

export async function deleteSession(id) {
  const { error } = await supabase.from("schedule_entries").delete().eq("id", id);
  if (error) throw error;
}

/** Fill in missing end times as start + minutes (only rows without an end time). */
export async function setMissingEndTimes(sessions, minutes) {
  const missing = sessions.filter((session) => !session.end_time);
  for (const session of missing) {
    const [h, m] = session.start_time.split(":").map(Number);
    const total = h * 60 + m + minutes;
    if (total >= 24 * 60) continue;
    const end = `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
    const { error } = await supabase.from("schedule_entries").update({ end_time: end }).eq("id", session.id);
    if (error) throw error;
  }
  return missing.length;
}
