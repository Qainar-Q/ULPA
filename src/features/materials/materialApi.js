import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase.js";
import { useAuth } from "../auth/AuthContext.jsx";
import { ALLOWED_ATTACHMENT_TYPES } from "../tasks/taskApi.js";

export const MATERIAL_BUCKET = "course-materials";
export const MAX_MATERIAL_BYTES = 25 * 1024 * 1024;

const FIELDS =
  "id, course_id, title, description, group_no, file_name, mime_type, size_bytes, storage_path, uploaded_by, uploader_name, created_at";

/** Visible materials (database filters by group), newest first. */
export function useMaterials({ courseId, limit = 200 } = {}) {
  const { status: authStatus } = useAuth();
  const [state, setState] = useState({ status: "loading", items: [] });

  const load = useCallback(async () => {
    let query = supabase.from("course_materials").select(FIELDS).eq("uploaded", true).order("created_at", { ascending: false }).limit(limit);
    if (courseId) query = query.eq("course_id", courseId);
    const { data, error } = await query;
    setState(error ? { status: "error", items: [] } : { status: "ready", items: data });
  }, [courseId, limit]);

  useEffect(() => {
    if (authStatus === "signedIn") load();
  }, [authStatus, load]);

  return { ...state, reload: load };
}

export function materialProblem(file) {
  if (file.size > MAX_MATERIAL_BYTES) return "too_large";
  if (!ALLOWED_ATTACHMENT_TYPES.includes(file.type)) return "type";
  return null;
}

/** Row first (server decides uploader, group and path), then the file, then mark uploaded. */
export async function uploadMaterial({ courseId, title, description, groupNo, file }) {
  const { data: row, error } = await supabase
    .from("course_materials")
    .insert({
      course_id: courseId,
      title: title.trim(),
      description: description?.trim() || null,
      group_no: groupNo === "both" ? null : Number(groupNo),
      file_name: file.name.slice(0, 200),
      mime_type: file.type,
      size_bytes: file.size,
    })
    .select("id, storage_path")
    .single();
  if (error) throw error;

  const { error: uploadError } = await supabase.storage
    .from(MATERIAL_BUCKET)
    .upload(row.storage_path, file, { contentType: file.type, upsert: false });
  if (uploadError) {
    await supabase.from("course_materials").delete().eq("id", row.id);
    throw uploadError;
  }
  const { error: markError } = await supabase.from("course_materials").update({ uploaded: true }).eq("id", row.id);
  if (markError) throw markError;
}

export async function deleteMaterial(item) {
  const { error } = await supabase.storage.from(MATERIAL_BUCKET).remove([item.storage_path]);
  if (error) throw error;
  const { error: rowError } = await supabase.from("course_materials").delete().eq("id", item.id);
  if (rowError) throw rowError;
}

export async function materialUrl(item) {
  const { data, error } = await supabase.storage
    .from(MATERIAL_BUCKET)
    .createSignedUrl(item.storage_path, 60 * 10, { download: item.file_name });
  if (error) throw error;
  return data.signedUrl;
}
