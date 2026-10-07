import { supabase } from "../../lib/supabase.js";

export const REACTIONS = ["❤️", "😂", "🔥", "😮", "👏", "👍"];

/** Reactions (with names) and comments for one photo. The database checks visibility. */
export async function fetchSocial(photoId) {
  const [reactions, comments] = await Promise.all([
    supabase.from("photo_reactions").select("student_id, student_name, emoji, created_at").eq("photo_id", photoId).order("created_at"),
    supabase.from("photo_comments").select("id, student_id, author_name, body, created_at").eq("photo_id", photoId).order("created_at"),
  ]);
  if (reactions.error) throw reactions.error;
  if (comments.error) throw comments.error;
  return { reactions: reactions.data, comments: comments.data };
}

export async function setReaction(photoId, emoji, on) {
  const { error } = on
    ? await supabase.from("photo_reactions").insert({ photo_id: photoId, emoji })
    : await supabase.from("photo_reactions").delete().eq("photo_id", photoId).eq("emoji", emoji); // RLS: own rows only
  if (error && error.code !== "23505") throw error;
}

export async function addComment(photoId, body) {
  const { data, error } = await supabase
    .from("photo_comments")
    .insert({ photo_id: photoId, body: body.trim() })
    .select("id, student_id, author_name, body, created_at")
    .single();
  if (error) throw error;
  return data;
}

export async function deleteComment(commentId) {
  const { error } = await supabase.from("photo_comments").delete().eq("id", commentId);
  if (error) throw error;
}

/** { photoId: { reactions, comments } } for the thumbnail grid. */
export async function fetchEngagement() {
  const { data, error } = await supabase.rpc("photo_engagement");
  if (error) throw error;
  return Object.fromEntries(data.map((row) => [row.photo_id, { reactions: row.reactions, comments: row.comments }]));
}
