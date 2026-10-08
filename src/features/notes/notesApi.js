import { supabase } from "../../lib/supabase.js";

const LIST_COLUMNS = "id, course_id, title, body, lesson_date, version, created_by, creator_name, updated_by_name, updated_at, created_at";

export async function listNotes() {
  const { data, error } = await supabase.from("notes").select(LIST_COLUMNS).order("updated_at", { ascending: false }).limit(300);
  if (error) throw error;
  return data ?? [];
}

export async function getNote(id) {
  const { data, error } = await supabase.from("notes").select(LIST_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function getRevisions(noteId) {
  const { data, error } = await supabase
    .from("note_revisions")
    .select("id, version, title, body, editor_name, created_at")
    .eq("note_id", noteId)
    .order("version", { ascending: false })
    .limit(100);
  if (error) throw error;
  return data ?? [];
}

/** Returns { id, version }. Throws { code: "40001" } when someone else saved first. */
export async function saveNote({ id = null, courseId = null, title, body, lessonDate = null, baseVersion = 0 }) {
  const { data, error } = await supabase.rpc("save_note", {
    p_id: id,
    p_course: courseId,
    p_title: title,
    p_body: body,
    p_lesson_date: lessonDate || null,
    p_base_version: baseVersion,
  });
  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
}

export async function deleteNote(id) {
  const { error } = await supabase.from("notes").delete().eq("id", id);
  if (error) throw error;
}

// Unsaved edits survive a closed tab (this device only).
const draftKey = (id) => `ulpa-note-draft-${id ?? "new"}`;
export function loadDraft(id) {
  try {
    return JSON.parse(localStorage.getItem(draftKey(id)) ?? "null");
  } catch {
    return null;
  }
}
export function storeDraft(id, draft) {
  try {
    if (draft) localStorage.setItem(draftKey(id), JSON.stringify(draft));
    else localStorage.removeItem(draftKey(id));
  } catch {
    /* storage unavailable: drafts are a convenience only */
  }
}
