import { supabase } from "../../lib/supabase.js";
import { indexPhoto } from "../classlife/studyAi.js";
import { IMMUTABLE_CACHE, signedUrls } from "../../lib/signedUrls.js";

export const PHOTO_BUCKET = "course-photos";

const PHOTO_FIELDS =
  "id, course_id, photo_type, group_no, caption, storage_path, thumb_path, width, height, uploaded_by, uploader_name, created_at";

/** Visible photos (RLS decides which), newest first. */
export async function listPhotos({ courseId, type, ids, limit = 60 } = {}) {
  let query = supabase.from("course_photos").select(PHOTO_FIELDS).eq("uploaded", true).order("created_at", { ascending: false }).limit(limit);
  if (ids) query = query.in("id", ids);
  if (courseId) query = query.eq("course_id", courseId);
  if (type) query = query.eq("photo_type", type);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

/** Signed links for private files (reused while valid). Returns { path: url }. */
export function signUrls(paths) {
  return signedUrls(PHOTO_BUCKET, paths);
}

/**
 * 1) create the row (the server fixes uploader, group and file paths)
 * 2) upload both files to those paths
 * 3) mark as uploaded. On failure, undo so no half-finished photo remains.
 */
export async function uploadPhoto({ courseId, photoType, groupNo, caption, prepared }) {
  const { data: row, error: insertError } = await supabase
    .from("course_photos")
    .insert({
      course_id: courseId,
      photo_type: photoType,
      group_no: groupNo ?? null,
      caption: caption?.trim() || null,
      width: prepared.full.width,
      height: prepared.full.height,
    })
    .select(PHOTO_FIELDS)
    .single();
  if (insertError) throw insertError;

  const storage = supabase.storage.from(PHOTO_BUCKET);
  try {
    const options = { contentType: "image/jpeg", cacheControl: IMMUTABLE_CACHE, upsert: false };
    const [fullResult, thumbResult] = await Promise.all([
      storage.upload(row.storage_path, prepared.full.blob, options),
      storage.upload(row.thumb_path, prepared.thumb.blob, options),
    ]);
    if (fullResult.error) throw fullResult.error;
    if (thumbResult.error) throw thumbResult.error;

    const { error: markError } = await supabase.from("course_photos").update({ uploaded: true }).eq("id", row.id);
    if (markError) throw markError;
    // In the background: let the AI read the board so search can find this photo later.
    indexPhoto(row.id).catch(() => {});
    return row;
  } catch (error) {
    await storage.remove([row.storage_path, row.thumb_path]).catch(() => {});
    await supabase.from("course_photos").delete().eq("id", row.id);
    throw error;
  }
}

/** Files first (their permission check needs the row), then the row. */
export async function deletePhoto(photo) {
  const { error: storageError } = await supabase.storage.from(PHOTO_BUCKET).remove([photo.storage_path, photo.thumb_path]);
  if (storageError) throw storageError;
  const { error } = await supabase.from("course_photos").delete().eq("id", photo.id);
  if (error) throw error;
}

export async function updateCaption(photoId, caption) {
  const { error } = await supabase
    .from("course_photos")
    .update({ caption: caption.trim() || null })
    .eq("id", photoId);
  if (error) throw error;
}

/** This week's most-reacted photos, in rank order, with weekly counts. */
export async function listTopPhotos(limit = 6) {
  const { data: ranking, error } = await supabase.rpc("weekly_top_photos", { p_limit: limit });
  if (error) throw error;
  if (ranking.length === 0) return { photos: [], weekly: {} };
  const ids = ranking.map((row) => row.photo_id);
  const order = new Map(ids.map((id, index) => [id, index]));
  const photos = (await listPhotos({ ids, limit })).filter((photo) => order.has(photo.id));
  photos.sort((a, b) => order.get(a.id) - order.get(b.id));
  const weekly = Object.fromEntries(ranking.map((row) => [row.photo_id, { reactions: row.reactions, comments: row.comments }]));
  return { photos, weekly };
}
