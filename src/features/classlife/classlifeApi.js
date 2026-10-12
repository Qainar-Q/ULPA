import { supabase } from "../../lib/supabase.js";

// ---- Draws (random groups / lottery) ----
export async function classRoster() {
  const { data, error } = await supabase.rpc("class_roster");
  if (error) throw error;
  return data ?? [];
}

export async function listDraws() {
  const { data, error } = await supabase
    .from("draws")
    .select("id, title, mode, amount, pool, result, created_by, creator_name, created_at")
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) throw error;
  return data ?? [];
}

const isNetworkError = (error) => !error?.code && /fetch|load failed|network|timeout|abort/i.test(`${error?.name ?? ""} ${error?.message ?? error ?? ""}`);
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * One request: the server shuffles, saves and sends the finished draw back.
 * A weak phone connection is retried automatically; the request id makes a retry return the
 * same draw instead of a new one, so a lost answer can never turn into a "re-roll".
 */
export async function makeDraw({ title, mode, amount, codes, extra, perGroup = null }) {
  const request = crypto.randomUUID?.() ?? "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) => (c ^ (Math.random() * 16) >> (c / 4)).toString(16));
  const args = { p_title: title, p_mode: mode, p_amount: amount, p_codes: codes, p_extra: extra, p_request: request, p_per_group: perGroup };
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (attempt) await wait(attempt === 1 ? 700 : 1800);
    const { data, error } = await supabase.rpc("draw_v2", args).abortSignal(AbortSignal.timeout?.(12000));
    if (!error) return data;
    lastError = error;
    if (error.code === "PGRST202") return makeDrawOld({ title, mode, amount, codes, extra }); // server not updated yet
    if (!isNetworkError(error)) break;
  }
  if (isNetworkError(lastError)) lastError.network = true;
  throw lastError;
}

async function makeDrawOld({ title, mode, amount, codes, extra }) {
  const { data, error } = await supabase.rpc("make_draw", { p_title: title, p_mode: mode, p_amount: amount, p_codes: codes, p_extra: extra });
  if (error) throw error;
  const { data: row, error: readError } = await supabase.from("draws").select("*").eq("id", data).single();
  if (readError) throw readError;
  return row;
}

export async function deleteDraw(id) {
  const { error } = await supabase.from("draws").delete().eq("id", id);
  if (error) throw error;
}

// ---- Suggestion box ----
export async function listSuggestions() {
  const { data, error } = await supabase
    .from("suggestions")
    .select("id, category, body, status, reply, replied_at, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return data ?? [];
}

export async function sendSuggestion({ category, body }) {
  const { error } = await supabase.from("suggestions").insert({ category, body });
  if (error) throw error;
}

export async function updateSuggestion(id, patch) {
  const { error } = await supabase.from("suggestions").update(patch).eq("id", id);
  if (error) throw error;
}

export async function suggestionAuthor(id) {
  const { data, error } = await supabase.rpc("admin_suggestion_author", { p_id: id });
  if (error) throw error;
  return data;
}

// ---- Birthdays ----
export async function birthdayWall(code) {
  const { data, error } = await supabase.rpc("birthday_wall", { p_code: code });
  if (error) throw error;
  return data ?? [];
}

export async function sendWish(code, emoji, body) {
  const { error } = await supabase.rpc("send_birthday_wish", { p_code: code, p_emoji: emoji, p_body: body });
  if (error) throw error;
}

// ---- Badges ----
export async function myBadges() {
  const { data, error } = await supabase.rpc("my_badges");
  if (error) throw error;
  return data ?? [];
}

// ---- Translation ----
export async function listTranslations() {
  const { data, error } = await supabase.from("translations").select("id, source_kind, result, created_at").order("created_at", { ascending: false }).limit(30);
  if (error) throw error;
  return data ?? [];
}

export async function deleteTranslation(id) {
  const { error } = await supabase.from("translations").delete().eq("id", id);
  if (error) throw error;
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** { result, remaining, truncated } or throws Error(code). */
export async function translate({ imageBlob = null, text = "" }) {
  const body = imageBlob ? { image: await blobToBase64(imageBlob), mediaType: imageBlob.type || "image/jpeg" } : { text };
  const { data, error } = await supabase.functions.invoke("translate", { body });
  if (error) {
    let code = "network";
    try {
      const payload = await error.context?.json?.();
      if (payload?.error) code = payload.error;
    } catch {
      /* not JSON */
    }
    throw new Error(code);
  }
  return data;
}
