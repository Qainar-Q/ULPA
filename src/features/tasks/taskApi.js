import { supabase } from "../../lib/supabase.js";
import { compressImageFile } from "../photos/imageProcessing.js";

export const TASK_BUCKET = "assignment-files";
export const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;
export const ALLOWED_ATTACHMENT_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "application/zip",
];

export const TASK_FIELDS =
  "id, course_id, title, description, due_at, group_no, created_at, updated_at, assignment_attachments(id, file_name, mime_type, size_bytes, storage_path, uploaded)";

export async function fetchTasks() {
  const [tasks, statuses] = await Promise.all([
    supabase.from("assignments").select(TASK_FIELDS).order("due_at", { ascending: true, nullsFirst: false }),
    supabase.from("assignment_status").select("assignment_id, student_id, completed_at"),
  ]);
  if (tasks.error) throw tasks.error;
  if (statuses.error) throw statuses.error;
  return { tasks: tasks.data, statuses: statuses.data };
}

/** Mark/unmark done for the signed-in student only (the server fills in who). */
export async function setDone(assignmentId, done) {
  if (done) {
    const { error } = await supabase.from("assignment_status").insert({ assignment_id: assignmentId });
    if (error && error.code !== "23505") throw error; // already done = fine
  } else {
    const { error } = await supabase.from("assignment_status").delete().eq("assignment_id", assignmentId);
    if (error) throw error;
  }
}

// ---- Admin ----

export async function saveTask(id, values) {
  const payload = {
    course_id: values.courseId,
    title: values.title.trim(),
    description: values.description.trim() || null,
    due_at: values.dueAt,
    group_no: values.groupNo === "both" ? null : Number(values.groupNo),
  };
  const query = id
    ? supabase.from("assignments").update(payload).eq("id", id).select("id").single()
    : supabase.from("assignments").insert(payload).select("id").single();
  const { data, error } = await query;
  if (error) throw error;
  return data.id;
}

export async function deleteTask(task) {
  const paths = (task.assignment_attachments ?? []).map((file) => file.storage_path);
  if (paths.length) {
    const { error } = await supabase.storage.from(TASK_BUCKET).remove(paths);
    if (error) throw error;
  }
  const { error } = await supabase.from("assignments").delete().eq("id", task.id);
  if (error) throw error;
}

export function attachmentProblem(file) {
  if (file.size > MAX_ATTACHMENT_BYTES) return "too_large";
  if (!ALLOWED_ATTACHMENT_TYPES.includes(file.type)) return "type";
  return null;
}

export async function uploadAttachment(assignmentId, original) {
  const file = await compressImageFile(original);
  const { data: row, error } = await supabase
    .from("assignment_attachments")
    .insert({ assignment_id: assignmentId, file_name: file.name.slice(0, 200), mime_type: file.type, size_bytes: file.size })
    .select("id, storage_path")
    .single();
  if (error) throw error;

  const storage = supabase.storage.from(TASK_BUCKET);
  const { error: uploadError } = await storage.upload(row.storage_path, file, { contentType: file.type, upsert: false });
  if (uploadError) {
    await supabase.from("assignment_attachments").delete().eq("id", row.id);
    throw uploadError;
  }
  const { error: markError } = await supabase.from("assignment_attachments").update({ uploaded: true }).eq("id", row.id);
  if (markError) throw markError;
}

export async function deleteAttachment(file) {
  const { error } = await supabase.storage.from(TASK_BUCKET).remove([file.storage_path]);
  if (error) throw error;
  const { error: rowError } = await supabase.from("assignment_attachments").delete().eq("id", file.id);
  if (rowError) throw rowError;
}

/** Short-lived link for showing a file inline (image preview, PDF in the browser). */
export async function attachmentViewUrls(files) {
  const paths = files.map((file) => file.storage_path);
  if (paths.length === 0) return {};
  const { data, error } = await supabase.storage.from(TASK_BUCKET).createSignedUrls(paths, 60 * 60);
  if (error) throw error;
  return Object.fromEntries(data.filter((item) => item.signedUrl).map((item) => [item.path, item.signedUrl]));
}

/** Short-lived download link that saves under the original file name. */
export async function attachmentUrl(file) {
  const { data, error } = await supabase.storage
    .from(TASK_BUCKET)
    .createSignedUrl(file.storage_path, 60 * 10, { download: file.file_name });
  if (error) throw error;
  return data.signedUrl;
}
