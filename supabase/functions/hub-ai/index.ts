// ULPA · hub-ai
//
// AI for the owner's personal hub (kainar.online/hub): IELTS practice questions, vocabulary,
// essay and speaking feedback, syllabus topics. The page sends a finished prompt; this returns
// the model's answer parsed as JSON. Same provider as study-ai (Claude if ANTHROPIC_API_KEY is
// set, otherwise Gemini with GEMINI_API_KEY). HUB_ANTHROPIC_API_KEY switches only the hub to Claude;
// HUB_GROQ_API_KEY (free, fast) is tried before Gemini, which stays the fallback.
//
// Who may call it: student 01 (the site owner) and friends he invited (table hub_members).
// The owner can also invite / list / remove friends here (actions "invite", "members", "remove", "invite_code").
// A friend with an invite code signs himself up with action "join" (no sign-in needed; code is single-use, 7 days).
// Limits per Almaty day: HUB_AI_DAILY_LIMIT for the owner (default 120), HUB_AI_MEMBER_LIMIT for friends (default 60).

import { createClient } from "npm:@supabase/supabase-js@2";

const ALLOWED_ORIGINS = new Set(["https://kainar.online", "https://www.kainar.online", "http://localhost:5173", "http://localhost:4173"]);
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const db = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false, autoRefreshToken: false } });
const DAILY = Number(Deno.env.get("HUB_AI_DAILY_LIMIT") ?? 120);
const MEMBER_DAILY = Number(Deno.env.get("HUB_AI_MEMBER_LIMIT") ?? 60);
const LOGIN_RE = /^[a-z][a-z0-9_.-]{2,23}$/;
const memberEmail = (login: string) => `${login}@hub.kainar.online`;
const MAX_PROMPT = 40_000;

const SYSTEM = `You are a precise assistant inside a student's personal study app. Follow the user's instructions exactly.
Reply with ONLY the JSON value that is asked for: no Markdown fences, no text before or after it.`;

function cors(origin: string | null): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origin && ALLOWED_ORIGINS.has(origin) ? origin : "https://kainar.online",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    Vary: "Origin",
  };
}
const json = (body: unknown, status: number, origin: string | null) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors(origin), "Content-Type": "application/json" } });

class UpstreamError extends Error {
  constructor(public code: string, detail = "") {
    super(`${code} ${detail}`.trim());
  }
}

async function askClaude(key: string, prompt: string, quick: boolean): Promise<string> {
  const model = quick ? (Deno.env.get("ANTHROPIC_QUICK_MODEL") ?? "claude-haiku-5-5") : (Deno.env.get("ANTHROPIC_MODEL") ?? "claude-sonnet-5-5");
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model, max_tokens: 12000, system: SYSTEM, messages: [{ role: "user", content: prompt }] }),
  });
  if (!response.ok) {
    const detail = await response.text();
    console.error("anthropic error", response.status, detail.slice(0, 400));
    throw new UpstreamError(response.status === 401 ? "bad_key" : response.status === 429 || response.status === 529 ? "busy" : "upstream");
  }
  const result = await response.json();
  return (result.content ?? []).filter((b: { type: string }) => b.type === "text").map((b: { text: string }) => b.text).join("\n");
}

// Groq: free, very fast (OpenAI-compatible). HUB_GROQ_API_KEY turns it on; on failure the next model, then Gemini.
const GROQ_MODELS = (Deno.env.get("GROQ_MODEL") ?? "openai/gpt-oss-120b,openai/gpt-oss-20b").split(",").map((m) => m.trim()).filter(Boolean);
async function askGroq(key: string, prompt: string, quick: boolean): Promise<string> {
  const models = quick ? [...GROQ_MODELS].reverse() : GROQ_MODELS;
  let last: unknown = null;
  for (const model of models) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), quick ? 20000 : 40000);
    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST", signal: ctl.signal,
        headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
        body: JSON.stringify({ model, max_completion_tokens: 8000, reasoning_effort: "low",
          messages: [{ role: "system", content: SYSTEM }, { role: "user", content: prompt }] }),
      });
      if (!response.ok) {
        console.error("groq error", model, response.status, (await response.text()).slice(0, 300));
        last = new UpstreamError(response.status === 401 ? "bad_key" : response.status === 429 ? "busy" : "upstream");
        continue;
      }
      const result = await response.json();
      const text = result.choices?.[0]?.message?.content ?? "";
      if (text.trim()) return text;
    } catch (error) { console.error("groq failed", model, String(error)); last = error; }
    finally { clearTimeout(timer); }
  }
  throw last ?? new UpstreamError("upstream");
}

// Pictures (food photos, textbook pages): a Groq vision model, then Gemini.
const GROQ_VISION_PREF = (Deno.env.get("GROQ_VISION_MODEL") ?? "qwen/qwen3.6-27b,meta-models/muse-spark-open,meta-llama/llama-4-scout-17b-16e-instruct").split(",").map((m) => m.trim()).filter(Boolean);
let visionModels: string[] | null = null;
// Groq retires vision models often: keep the preferred ones that still exist, plus any other vision-looking model it lists.
async function groqVisionModels(key: string): Promise<string[]> {
  if (visionModels) return visionModels;
  try {
    const r = await fetch("https://api.groq.com/openai/v1/models", { headers: { authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(5000) });
    if (r.ok) {
      const ids: string[] = ((await r.json()).data ?? []).filter((m: { active?: boolean }) => m.active !== false).map((m: { id: string }) => m.id);
      const extra = ids.filter((id) => /vision|-vl|llava|scout|maverick|muse|qwen3\.[6-9]|gemma-?[3-9]|pixtral/i.test(id) && !GROQ_VISION_PREF.includes(id));
      const list = [...GROQ_VISION_PREF.filter((m) => ids.includes(m)), ...extra].slice(0, 4);
      console.log("groq vision models", list.join(","));
      if (list.length) return (visionModels = list);
    }
  } catch (e) { console.error("groq models list failed", String(e)); }
  return GROQ_VISION_PREF;
}
async function askGroqVision(key: string, prompt: string, image: string): Promise<string> {
  let last: unknown = null;
  for (const model of await groqVisionModels(key)) {
    for (const strict of [true, false]) {
      try {
        const body: Record<string, unknown> = { model, max_completion_tokens: 4000, temperature: 0.3,
          messages: [{ role: "system", content: SYSTEM }, { role: "user", content: [{ type: "text", text: prompt }, { type: "image_url", image_url: { url: image } }] }] };
        if (strict) body.response_format = { type: "json_object" };
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST", signal: AbortSignal.timeout(30000),
          headers: { authorization: `Bearer ${key}`, "content-type": "application/json" }, body: JSON.stringify(body) });
        if (!response.ok) {
          console.error("groq vision error", model, response.status, (await response.text()).slice(0, 300));
          last = new UpstreamError(response.status === 429 ? "busy" : "upstream");
          if (response.status === 400 && strict) continue;
          break;
        }
        const result = await response.json();
        const text = String(result.choices?.[0]?.message?.content ?? "").replace(/<think>[\s\S]*?<\/think>/g, "").trim();
        if (text) { console.log("groq vision ok", model); return text; }
        break;
      } catch (error) { console.error("groq vision failed", model, String(error)); last = error; break; }
    }
  }
  throw last ?? new UpstreamError("upstream");
}

// Speech to text (IELTS speaking): Groq Whisper.
async function transcribe(key: string, audio: string, mime: string): Promise<string> {
  const bytes = Uint8Array.from(atob(audio), (c) => c.charCodeAt(0));
  const ext = /mp4|m4a|aac/.test(mime) ? "m4a" : /ogg/.test(mime) ? "ogg" : /wav/.test(mime) ? "wav" : "webm";
  let last: unknown = null;
  for (const model of ["whisper-large-v3-turbo", "whisper-large-v3"]) {
    const form = new FormData();
    form.append("file", new Blob([bytes], { type: mime || "audio/webm" }), `answer.${ext}`);
    form.append("model", model);
    form.append("language", "en");
    form.append("response_format", "json");
    const response = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", { method: "POST", headers: { authorization: `Bearer ${key}` }, body: form });
    if (response.ok) return String((await response.json()).text ?? "").trim();
    console.error("whisper error", model, response.status, (await response.text()).slice(0, 300));
    last = new UpstreamError(response.status === 429 ? "busy" : "upstream");
  }
  throw last ?? new UpstreamError("upstream");
}

const PREFERRED = (Deno.env.get("GEMINI_MODEL") ?? "gemini-flash-latest,gemini-flash-lite-latest").split(",").map((m) => m.trim()).filter(Boolean);
let discovered: Promise<string[]> | null = null;
const versionOf = (name: string) => Number((name.match(/gemini-(\d+(?:\.\d+)?)/) ?? [])[1] ?? 0);

// Whatever "flash" models this key can use, newest first (Google renames them over time).
async function availableFlash(apiKey: string): Promise<string[]> {
  try {
    const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=200", { headers: { "x-goog-api-key": apiKey } });
    if (!r.ok) return [];
    const { models = [] } = await r.json();
    return models
      .filter((m: { name: string; supportedGenerationMethods?: string[] }) => /flash/i.test(m.name) && !/image|tts|audio|live|embed|preview|exp/i.test(m.name) && (m.supportedGenerationMethods ?? []).includes("generateContent"))
      .map((m: { name: string }) => m.name.replace(/^models\//, ""))
      .sort((a: string, b: string) => versionOf(b) - versionOf(a) || Number(/lite/.test(a)) - Number(/lite/.test(b)));
  } catch { return []; }
}

// Each model gets a time box: a busy model that hangs no longer eats the whole 150 s request.
async function askGemini(apiKey: string, prompt: string, quick: boolean, image?: string): Promise<string> {
  discovered ??= availableFlash(apiKey);
  const found = await discovered;
  if (!found.length) discovered = null;
  let models = [...new Set([...PREFERRED, ...found.slice(0, 4)])];
  if (quick) models = [...models.filter((m) => /lite/.test(m)), ...models.filter((m) => !/lite/.test(m))];
  const deadline = Date.now() + 135_000;
  let lastError = new UpstreamError("upstream");
  let thinkingHint = true;
  for (let i = 0; i < models.length; i += 1) {
    const left = deadline - Date.now();
    if (left < 8000) break;
    const model = models[i];
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), Math.min(quick ? 25_000 : 45_000, left));
    let response: Response;
    try {
      response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: "POST",
        signal: ctrl.signal,
        headers: { "x-goog-api-key": apiKey, "content-type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM }] },
          contents: [{ role: "user", parts: image ? [{ text: prompt }, { inline_data: { mime_type: image.slice(5, image.indexOf(";")), data: image.slice(image.indexOf(",") + 1) } }] : [{ text: prompt }] }],
          generationConfig: { temperature: 0.4, maxOutputTokens: 12000, responseMimeType: "application/json", ...(thinkingHint ? { thinkingConfig: { thinkingLevel: "low" } } : {}) },
        }),
      });
    } catch {
      clearTimeout(timer);
      console.error("gemini timeout", model);
      lastError = new UpstreamError("busy");
      continue;
    }
    clearTimeout(timer);
    if (response.ok) {
      const result = await response.json();
      const parts = result.candidates?.[0]?.content?.parts ?? [];
      const text = parts.filter((p: { text?: string; thought?: boolean }) => p.text && !p.thought).map((p: { text: string }) => p.text).join("");
      if (text) return text;
      lastError = new UpstreamError("upstream");
      continue;
    }
    const detail = await response.text();
    console.error("gemini error", model, response.status, detail.slice(0, 300));
    if (response.status === 400 && thinkingHint && /thinking/i.test(detail)) { thinkingHint = false; i -= 1; continue; }
    if (response.status === 429 || response.status === 503) { lastError = new UpstreamError("busy"); continue; }
    if (response.status === 404) continue;
    if (response.status === 401 || response.status === 403) throw new UpstreamError("bad_key");
  }
  throw lastError;
}

/** The answer as one JSON value (object or array); tolerates fences or a sentence around it. */
function parseJson(raw: string): unknown {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const starts = [cleaned.indexOf("{"), cleaned.indexOf("[")].filter((i) => i >= 0);
    if (!starts.length) throw new UpstreamError("bad_output");
    const start = Math.min(...starts);
    const end = Math.max(cleaned.lastIndexOf("}"), cleaned.lastIndexOf("]"));
    if (end > start) {
      try { return JSON.parse(cleaned.slice(start, end + 1)); } catch { /* fall through */ }
    }
    throw new UpstreamError("bad_output");
  }
}

// Calls per Almaty day, kept in memory per server instance (a soft limit for the owner's own use).
const used = new Map<string, number>();
const joinTries = new Map<string, number[]>();
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Almaty" }).format(new Date());

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });
  if (req.method !== "POST") return json({ error: "method" }, 405, origin);

  let body: { prompt?: unknown; tier?: unknown; action?: unknown; login?: unknown; password?: unknown; code?: unknown; image?: unknown; audio?: unknown; mime?: unknown };
  try { body = await req.json(); } catch { return json({ error: "bad_request" }, 400, origin); }

  // A friend signs himself up with an invite code: no account yet, so no token.
  if (body.action === "join") {
    const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "?";
    const tries = (joinTries.get(ip) ?? []).filter((t) => Date.now() - t < 3600_000);
    if (tries.length >= 10) return json({ error: "busy" }, 429, origin);
    joinTries.set(ip, [...tries, Date.now()]);
    const code = String(body.code ?? "").trim().toUpperCase();
    const login = String(body.login ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    if (!/^[A-Z0-9]{8}$/.test(code)) return json({ error: "bad_code" }, 400, origin);
    if (!LOGIN_RE.test(login)) return json({ error: "bad_login" }, 400, origin);
    if (password.length < 8 || password.length > 72) return json({ error: "bad_password" }, 400, origin);
    const { data: invite } = await db.from("hub_invites").select("code, expires_at, used_by").eq("code", code).maybeSingle();
    if (!invite || invite.used_by || new Date(invite.expires_at) < new Date()) return json({ error: "bad_code" }, 400, origin);
    const { data: created, error } = await db.auth.admin.createUser({ email: memberEmail(login), password, email_confirm: true, user_metadata: { hub_login: login } });
    if (error || !created?.user) return json({ error: /already/i.test(error?.message ?? "") ? "taken" : "create_failed" }, 409, origin);
    // Claim the code only if nobody claimed it in the meantime.
    const { data: claimed } = await db.from("hub_invites").update({ used_by: created.user.id, used_at: new Date().toISOString() }).eq("code", code).is("used_by", null).select("code");
    if (!claimed?.length) { await db.auth.admin.deleteUser(created.user.id); return json({ error: "bad_code" }, 400, origin); }
    const { error: insertError } = await db.from("hub_members").insert({ user_id: created.user.id, login });
    if (insertError) { await db.auth.admin.deleteUser(created.user.id); return json({ error: "taken" }, 409, origin); }
    return json({ ok: true, login }, 200, origin);
  }

  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: userData } = await db.auth.getUser(token);
  if (!userData?.user) return json({ error: "unauthorized" }, 401, origin);
  const { data: owner } = await db.from("students").select("id").eq("user_id", userData.user.id).eq("code", "01").maybeSingle();
  const { data: member } = owner ? { data: null } : await db.from("hub_members").select("login").eq("user_id", userData.user.id).maybeSingle();
  if (!owner && !member) return json({ error: "forbidden" }, 403, origin);

  // Speech to text for the speaking test (any hub user).
  if (body.action === "transcribe") {
    const audio = typeof body.audio === "string" ? body.audio : "";
    if (!audio || audio.length > 12_000_000) return json({ error: "bad_request" }, 400, origin);
    const key = Deno.env.get("HUB_GROQ_API_KEY") ?? Deno.env.get("GROQ_API_KEY");
    if (!key) return json({ error: "not_configured" }, 503, origin);
    try {
      const t0 = Date.now();
      const text = await transcribe(key, audio, String(body.mime ?? ""));
      console.log(`hub-ai transcribe ${Date.now() - t0}ms ${text.length} chars`);
      return json({ text }, 200, origin);
    } catch (error) {
      const code = error instanceof UpstreamError ? error.code : "upstream";
      return json({ error: code }, code === "busy" ? 429 : 502, origin);
    }
  }

  // Owner-only: manage friends' accounts.
  if (body.action) {
    if (!owner) return json({ error: "forbidden" }, 403, origin);
    if (body.action === "invite_code") {
      const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      const bytes = crypto.getRandomValues(new Uint8Array(8));
      const code = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
      const { error } = await db.from("hub_invites").insert({ code });
      if (error) return json({ error: "create_failed" }, 500, origin);
      return json({ code }, 200, origin);
    }
    if (body.action === "members") {
      const { data } = await db.from("hub_members").select("login, created_at").order("created_at");
      return json({ members: data ?? [] }, 200, origin);
    }
    const login = String(body.login ?? "").trim().toLowerCase();
    if (!LOGIN_RE.test(login)) return json({ error: "bad_login" }, 400, origin);
    if (body.action === "invite") {
      const password = String(body.password ?? "");
      if (password.length < 8 || password.length > 72) return json({ error: "bad_password" }, 400, origin);
      const { data: created, error } = await db.auth.admin.createUser({ email: memberEmail(login), password, email_confirm: true, user_metadata: { hub_login: login } });
      if (error || !created?.user) return json({ error: /already/i.test(error?.message ?? "") ? "taken" : "create_failed" }, 409, origin);
      const { error: insertError } = await db.from("hub_members").insert({ user_id: created.user.id, login });
      if (insertError) { await db.auth.admin.deleteUser(created.user.id); return json({ error: "taken" }, 409, origin); }
      return json({ ok: true, login }, 200, origin);
    }
    if (body.action === "remove") {
      const { data: row } = await db.from("hub_members").select("user_id").eq("login", login).maybeSingle();
      if (!row) return json({ error: "not_found" }, 404, origin);
      await db.from("hub_state").delete().eq("user_id", row.user_id);
      await db.auth.admin.deleteUser(row.user_id); // cascades to hub_members
      return json({ ok: true }, 200, origin);
    }
    return json({ error: "bad_request" }, 400, origin);
  }

  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt || prompt.length > MAX_PROMPT) return json({ error: "bad_request" }, 400, origin);
  const quick = body.tier === "quick";
  const image = typeof body.image === "string" && /^data:image\/(jpeg|png|webp);base64,/.test(body.image) && body.image.length < 4_000_000 ? body.image : undefined;

  const day = today();
  for (const key of used.keys()) if (!key.startsWith(day)) used.delete(key);
  const key = `${day}:${userData.user.id}`;
  const n = (used.get(key) ?? 0) + 1;
  const cap = owner ? DAILY : MEMBER_DAILY;
  if (n > cap) return json({ error: "limit", limit: cap }, 429, origin);
  used.set(key, n);

  // HUB_ANTHROPIC_API_KEY: a Claude key used only by the hub (so the class's study-ai keeps its own provider).
  const claude = Deno.env.get("HUB_ANTHROPIC_API_KEY") ?? Deno.env.get("ANTHROPIC_API_KEY");
  const gemini = Deno.env.get("GEMINI_API_KEY");
  const groq = Deno.env.get("HUB_GROQ_API_KEY") ?? Deno.env.get("GROQ_API_KEY");
  if (!claude && !gemini && !groq) return json({ error: "not_configured" }, 503, origin);

  try {
    let raw: string;
    let via = claude ? "claude" : groq ? "groq" : "gemini";
    const t0 = Date.now();
    if (image) {
      if (groq) {
        try { raw = await askGroqVision(groq, prompt, image); via = "groq-vision"; }
        catch (error) { if (!gemini) throw error; via = "gemini"; raw = await askGemini(gemini, prompt, false, image); }
      } else if (gemini) { via = "gemini"; raw = await askGemini(gemini, prompt, false, image); }
      else return json({ error: "not_configured" }, 503, origin);
    } else if (claude) raw = await askClaude(claude, prompt, quick);
    else if (groq) {
      try { raw = await askGroq(groq, prompt, quick); }
      catch (error) { if (!gemini) throw error; console.error("groq gave up, using gemini"); via = "gemini"; raw = await askGemini(gemini, prompt, quick); }
    } else raw = await askGemini(gemini!, prompt, quick);
    console.log(`hub-ai via ${via} ${Date.now() - t0}ms quick=${quick}`);
    return json({ result: parseJson(raw) }, 200, origin);
  } catch (error) {
    const code = error instanceof UpstreamError ? error.code : "upstream";
    console.error("hub-ai failed", String(error));
    return json({ error: code }, code === "busy" ? 429 : 502, origin);
  }
});
