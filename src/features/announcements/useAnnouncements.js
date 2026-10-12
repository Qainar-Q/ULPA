import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase.js";
import { useAuth } from "../auth/AuthContext.jsx";
import { readCache, writeCache } from "../../lib/cache.js";
import { IMMUTABLE_CACHE } from "../../lib/signedUrls.js";
import { resizeToJpeg } from "../photos/imageProcessing.js";

const FIELDS =
  "id, title, body, group_no, pinned, author_id, author_name, author_role, created_at, updated_at, announcement_images(id, storage_path, width, height, position, uploaded)";
export const ANNOUNCEMENT_BUCKET = "announcement-images";
export const MAX_ANNOUNCEMENT_IMAGES = 6;

/** Uploaded photos of an announcement, in order. */
export function announcementImages(item) {
  return (item?.announcement_images ?? []).filter((image) => image.uploaded).sort((a, b) => a.position - b.position);
}

/** Announcements visible to the current student (database filters by group). Pinned first. */
export function useAnnouncements(limit = 50) {
  const { status: authStatus, student } = useAuth();
  const userId = student?.id ?? null;
  const cacheName = `announcements-${limit}`;
  // Last copy from this device first (shows instantly), then fresh data.
  const [state, setState] = useState(() => {
    const cached = readCache(cacheName, userId);
    return cached ? { status: "ready", items: cached } : { status: "loading", items: [] };
  });

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("announcements")
      .select(FIELDS)
      .order("pinned", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) {
      setState((current) => (current.items.length ? current : { status: "error", items: [] }));
      return;
    }
    setState({ status: "ready", items: data });
    writeCache(cacheName, userId, data);
  }, [limit, cacheName, userId]);

  useEffect(() => {
    if (authStatus === "signedIn") load();
  }, [authStatus, load]);

  return { ...state, reload: load };
}

export async function saveAnnouncement(id, values) {
  const payload = {
    title: values.title.trim(),
    body: values.body.trim() || null,
    group_no: values.groupNo === "both" ? null : Number(values.groupNo),
    pinned: Boolean(values.pinned),
  };
  const { data, error } = id
    ? await supabase.from("announcements").update(payload).eq("id", id).select("id").single()
    : await supabase.from("announcements").insert(payload).select("id").single();
  if (error) throw error;
  return data.id;
}

/**
 * Add photos to an announcement: the server picks each file path, then the file is
 * uploaded and marked done. A failed photo is removed again so nothing half-done stays.
 */
export async function addAnnouncementImages(announcementId, files, startPosition = 0) {
  const storage = supabase.storage.from(ANNOUNCEMENT_BUCKET);
  let position = startPosition;
  for (const file of files) {
    const blob = await resizeToJpeg(file, 2000, 0.8); // posters and boards stay readable
    const size = await imageSize(blob);
    const { data: row, error } = await supabase
      .from("announcement_images")
      .insert({ announcement_id: announcementId, width: size.width, height: size.height, position })
      .select("id, storage_path")
      .single();
    if (error) throw error;
    try {
      const { error: uploadError } = await storage.upload(row.storage_path, blob, { contentType: "image/jpeg", cacheControl: IMMUTABLE_CACHE, upsert: false });
      if (uploadError) throw uploadError;
      const { error: markError } = await supabase.from("announcement_images").update({ uploaded: true }).eq("id", row.id);
      if (markError) throw markError;
    } catch (uploadFailure) {
      await storage.remove([row.storage_path]).catch(() => {});
      await supabase.from("announcement_images").delete().eq("id", row.id);
      throw uploadFailure;
    }
    position += 1;
  }
}

/** Remove photos: files first (their permission check needs the row), then the rows. */
export async function removeAnnouncementImages(images) {
  if (!images.length) return;
  await supabase.storage.from(ANNOUNCEMENT_BUCKET).remove(images.map((image) => image.storage_path));
  const { error } = await supabase.from("announcement_images").delete().in("id", images.map((image) => image.id));
  if (error) throw error;
}

async function imageSize(blob) {
  try {
    const bitmap = await createImageBitmap(blob);
    const size = { width: bitmap.width, height: bitmap.height };
    bitmap.close?.();
    return size;
  } catch {
    return { width: null, height: null };
  }
}

export async function deleteAnnouncement(id) {
  // Photos first, so no files are left behind in storage.
  const { data: images } = await supabase.from("announcement_images").select("id, storage_path").eq("announcement_id", id);
  if (images?.length) await removeAnnouncementImages(images);
  const { error } = await supabase.from("announcements").delete().eq("id", id);
  if (error) throw error;
}
