// ULPA · hub-ai
//
// AI for the owner's personal hub (kainar.online/hub): IELTS practice questions, vocabulary,
// essay and speaking feedback, syllabus topics. The page sends a finished prompt; this returns
// the model's answer parsed as JSON. Same provider as study-ai (Claude if ANTHROPIC_API_KEY is
// set, otherwise Gemini with GEMINI_API_KEY).
//
// Only student 01 (the site owner) may call it, checked with the caller's own token.
// Limit: HUB_AI_DAILY_LIMIT calls per Almaty day (default 120).

import { createClient } from "npm:@supabase/supabase-js@2";

const ALLOWED_ORIGINS = new Set(["https://kainar.online", "https://www.kainar.online", "http://localhost:5173", "http://localhost:4173"]);
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const db = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false, autoRefreshToken: false } });
const DAILY = Number(Deno.env.get("HUB_AI_DAILY_LIMIT") ?? 120);
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

const PREFERRED = (Deno.env.get("GEMINI_MODEL") ?? "gemini-flash-latest,gemini-flash-lite-latest").split(",").map((m) => m.trim()).filter(Boolean);

async function askGemini(apiKey: string, prompt: string): Promise<string> {
  let lastError = new UpstreamError("upstream");
  let thinkingHint = true;
  for (let i = 0; i < PREFERRED.length; i += 1) {
    const model = PREFERRED[i];
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "x-goog-api-key": apiKey, "content-type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM }] },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 16000, responseMimeType: "application/json", ...(thinkingHint ? { thinkingConfig: { thinkingLevel: "low" } } : {}) },
      }),
    });
    if (response.ok) {
      const result = await response.json();
      const parts = result.candidates?.[0]?.content?.parts ?? [];
      return parts.filter((p: { text?: string; thought?: boolean }) => p.text && !p.thought).map((p: { text: string }) => p.text).join("");
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
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Almaty" }).format(new Date());

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });
  if (req.method !== "POST") return json({ error: "method" }, 405, origin);

  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: userData } = await db.auth.getUser(token);
  if (!userData?.user) return json({ error: "unauthorized" }, 401, origin);
  const { data: owner } = await db.from("students").select("id").eq("user_id", userData.user.id).eq("code", "01").maybeSingle();
  if (!owner) return json({ error: "forbidden" }, 403, origin);

  let body: { prompt?: unknown; tier?: unknown };
  try { body = await req.json(); } catch { return json({ error: "bad_request" }, 400, origin); }
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt || prompt.length > MAX_PROMPT) return json({ error: "bad_request" }, 400, origin);
  const quick = body.tier === "quick";

  const day = today();
  for (const key of used.keys()) if (key !== day) used.delete(key);
  const n = (used.get(day) ?? 0) + 1;
  if (n > DAILY) return json({ error: "limit", limit: DAILY }, 429, origin);
  used.set(day, n);

  const claude = Deno.env.get("ANTHROPIC_API_KEY");
  const gemini = Deno.env.get("GEMINI_API_KEY");
  if (!claude && !gemini) return json({ error: "not_configured" }, 503, origin);

  try {
    const raw = claude ? await askClaude(claude, prompt, quick) : await askGemini(gemini!, prompt);
    return json({ result: parseJson(raw) }, 200, origin);
  } catch (error) {
    const code = error instanceof UpstreamError ? error.code : "upstream";
    console.error("hub-ai failed", String(error));
    return json({ error: code }, code === "busy" ? 429 : 502, origin);
  }
});
