import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase.js";
import { IMMUTABLE_CACHE, signedUrls } from "../../lib/signedUrls.js";
import { useAuth } from "../auth/AuthContext.jsx";
import { resizeToJpeg } from "../photos/imageProcessing.js";

export const TEACHER_BUCKET = "teacher-photos";
const FIELDS = "id, full_name, position, phone, email, office, office_hours, note, photo_path, sort_order, course_teachers(course_id)";

/** All teachers (class members only, enforced by RLS) with signed photo links. */
export function useTeachers() {
  const { status: authStatus } = useAuth();
  const [state, setState] = useState({ status: "loading", teachers: [], photos: {} });

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("teachers").select(FIELDS).order("sort_order").order("full_name");
    if (error) return setState({ status: "error", teachers: [], photos: {} });
    const teachers = data.map((teacher) => ({ ...teacher, courseIds: (teacher.course_teachers ?? []).map((row) => row.course_id) }));
    let photos = {};
    try {
      photos = await signedUrls(TEACHER_BUCKET, teachers.map((teacher) => teacher.photo_path));
    } catch {
      /* show initials instead */
    }
    setState({ status: "ready", teachers, photos });
  }, []);

  useEffect(() => {
    if (authStatus === "signedIn") load();
  }, [authStatus, load]);

  return { ...state, reload: load };
}

const clean = (value) => (value ?? "").trim() || null;

/** Admin: create or update a teacher, their courses and (optionally) a new photo. */
export async function saveTeacher(existing, values, courseIds, photoFile) {
  const payload = {
    full_name: values.full_name.trim(),
    position: clean(values.position),
    phone: clean(values.phone),
    email: clean(values.email),
    office: clean(values.office),
    office_hours: clean(values.office_hours),
    note: clean(values.note),
  };
  const query = existing
    ? supabase.from("teachers").update(payload).eq("id", existing.id).select("id").single()
    : supabase.from("teachers").insert(payload).select("id").single();
  const { data, error } = await query;
  if (error) throw error;
  const id = data.id;

  // Courses: add the new links, remove the dropped ones.
  const before = new Set(existing?.courseIds ?? []);
  const after = new Set(courseIds);
  const added = [...after].filter((courseId) => !before.has(courseId));
  const removed = [...before].filter((courseId) => !after.has(courseId));
  if (added.length) {
    const { error: addError } = await supabase.from("course_teachers").insert(added.map((course_id) => ({ course_id, teacher_id: id })));
    if (addError) throw addError;
  }
  if (removed.length) {
    const { error: removeError } = await supabase.from("course_teachers").delete().eq("teacher_id", id).in("course_id", removed);
    if (removeError) throw removeError;
  }

  if (photoFile) {
    const blob = await resizeToJpeg(photoFile, 640, 0.82);
    const path = `${id}/${Date.now()}.jpg`;
    const { error: uploadError } = await supabase.storage
      .from(TEACHER_BUCKET)
      .upload(path, blob, { contentType: "image/jpeg", cacheControl: IMMUTABLE_CACHE, upsert: false });
    if (uploadError) throw uploadError;
    const { error: photoError } = await supabase.from("teachers").update({ photo_path: path }).eq("id", id);
    if (photoError) throw photoError;
    if (existing?.photo_path) await supabase.storage.from(TEACHER_BUCKET).remove([existing.photo_path]);
  }
  return id;
}

export async function removeTeacherPhoto(teacher) {
  if (!teacher.photo_path) return;
  const { error } = await supabase.from("teachers").update({ photo_path: null }).eq("id", teacher.id);
  if (error) throw error;
  await supabase.storage.from(TEACHER_BUCKET).remove([teacher.photo_path]);
}

export async function deleteTeacher(teacher) {
  if (teacher.photo_path) await supabase.storage.from(TEACHER_BUCKET).remove([teacher.photo_path]);
  const { error } = await supabase.from("teachers").delete().eq("id", teacher.id);
  if (error) throw error;
}

/** "+7 701 123 45 67" → "77011234567" for WhatsApp links. */
export function whatsappNumber(phone) {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("8")) return `7${digits.slice(1)}`;
  return digits.length >= 10 ? digits : null;
}
