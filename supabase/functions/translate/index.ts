// ULPA · translate
//
// A signed-in student sends a photo/screenshot of a Russian textbook page (or pasted
// Russian text); an AI model reads it and returns a Kazakh translation in simple Markdown.
// Provider: Claude if the secret ANTHROPIC_API_KEY is set, otherwise Google Gemini
// (free tier) with GEMINI_API_KEY. TRANSLATE_PROVIDER=claude|gemini forces one.
// API keys live only in Edge Function secrets, never in the browser.
// Limits: TRANSLATE_DAILY_LIMIT per student per day (default 15) and
// TRANSLATE_CLASS_DAILY_LIMIT for the whole class (default 200), counted in Almaty days.

import { createClient } from "npm:@supabase/supabase-js@2";

const ALLOWED_ORIGINS = new Set([
  "https://kainar.online",
  "https://www.kainar.online",
  "http://localhost:5173",
  "http://localhost:4173",
]);
const MEDIA_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_IMAGE_B64 = 6_000_000; // ≈ 4.5 MB of image data
const MAX_TEXT = 12_000;

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const SYSTEM = `Сен — ҚазҰУ механика-математика факультетінің студенттеріне (мамандығы: ғарыштық техника және технологиялар) арналған кәсіби аудармашысың.
Тапсырма: суреттегі немесе берілген орыс тіліндегі мәтінді қазақ тіліне толық және дәл аудар.

Ережелер:
- Тек аударманы жаз: кіріспе, түсініктеме, «міне аударма» деген сөздер керек емес.
- Қазақ тілінің әдеби нормасын және математика, механика, физика, ғарыш техникасы саласындағы қалыптасқан қазақша терминдерді қолдан (мысалы: производная → туынды, интеграл → интеграл, уравнение → теңдеу, ускорение → үдеу, скорость → жылдамдық, сила → күш, теорема → теорема, доказательство → дәлелдеу).
- Түпнұсқаның құрылымын сақта: тақырыптар үшін "# ", "## ", тізімдер үшін "- " немесе "1. ", маңызды сөздер үшін **қалың**.
- Формулалар, сандар, белгілер, бірліктер өзгермейді. Формулаларды LaTeX-сіз, оқуға оңай түрде жаз (x², √x, ∫, ∑, ≤, ≥, ≠, π, α, Δ) және \`формула\` деп бэктиктермен қоршап жаз.
- Суреттегі мәтін бұлыңғыр немесе оқылмаса, сол жерге [оқылмайды] деп жаз.
- Суретте орысша мәтін мүлдем болмаса, тек мынаны жаз: «Суретте аударатын орысша мәтін табылмады.»`;

function cors(origin: string | null): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origin && ALLOWED_ORIGINS.has(origin) ? origin : "https://kainar.online",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    Vary: "Origin",
  };
}

function json(body: unknown, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...cors(origin), "Content-Type": "application/json" } });
}

/** Start of the current day in Almaty, as an ISO timestamp. */
function almatyDayStart(): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Almaty", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23", minute: "2-digit", second: "2-digit" })
      .formatToParts(new Date())
      .map((p) => [p.type, p.value])
  );
  const elapsed = (Number(parts.hour) * 3600 + Number(parts.minute) * 60 + Number(parts.second)) * 1000;
  const now = Date.now();
  return new Date(now - elapsed - (now % 1000)).toISOString();
}

type Answer = { text: string; inputTokens: number | null; outputTokens: number | null; truncated: boolean };

class UpstreamError extends Error {
  constructor(public code: string, detail = "") {
    super(`${code} ${detail}`.trim());
  }
}

async function askClaude(apiKey: string, ask: string, image: string, mediaType?: string): Promise<Answer> {
  const content = image
    ? [{ type: "image", source: { type: "base64", media_type: mediaType, data: image } }, { type: "text", text: ask }]
    : [{ type: "text", text: ask }];
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: Deno.env.get("ANTHROPIC_MODEL") ?? "claude-sonnet-5-5",
      max_tokens: 6000,
      system: SYSTEM,
      messages: [{ role: "user", content }],
    }),
  });
  if (!response.ok) {
    const detail = await response.text();
    console.error("anthropic error", response.status, detail.slice(0, 500));
    throw new UpstreamError(
      response.status === 401 ? "bad_key" : response.status === 429 || response.status === 529 ? "busy" : response.status === 400 && /credit/i.test(detail) ? "no_credit" : "upstream"
    );
  }
  const result = await response.json();
  return {
    text: (result.content ?? []).filter((b: { type: string }) => b.type === "text").map((b: { text: string }) => b.text).join("\n"),
    inputTokens: result.usage?.input_tokens ?? null,
    outputTokens: result.usage?.output_tokens ?? null,
    truncated: result.stop_reason === "max_tokens",
  };
}

// Google retires model names over time, so the list is not fixed: GEMINI_MODEL (comma list)
// is tried first, then whatever "flash" models this key can actually use (asked from Google
// once per server start). "Busy" (429/503) or "gone" (404) moves on to the next model.
const PREFERRED = (Deno.env.get("GEMINI_MODEL") ?? "gemini-flash-latest,gemini-flash-lite-latest").split(",").map((m) => m.trim()).filter(Boolean);
let discovered: Promise<string[]> | null = null;

function versionOf(name: string): number {
  const match = name.match(/gemini-(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : 0;
}

async function availableFlashModels(apiKey: string): Promise<string[]> {
  try {
    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=200", { headers: { "x-goog-api-key": apiKey } });
    if (!response.ok) return [];
    const { models = [] } = await response.json();
    return models
      .filter((m: { name: string; supportedGenerationMethods?: string[] }) =>
        /flash/i.test(m.name) && !/image|tts|audio|live|embed|preview|exp/i.test(m.name) && (m.supportedGenerationMethods ?? []).includes("generateContent"))
      .map((m: { name: string }) => m.name.replace(/^models\//, ""))
      .sort((a: string, b: string) => versionOf(b) - versionOf(a) || Number(/lite/.test(a)) - Number(/lite/.test(b)));
  } catch {
    return [];
  }
}

async function geminiModels(apiKey: string): Promise<string[]> {
  discovered ??= availableFlashModels(apiKey);
  const found = await discovered;
  if (!found.length) discovered = null; // ask again next time
  return [...new Set([...PREFERRED, ...found.slice(0, 4)])];
}


async function askGemini(apiKey: string, ask: string, image: string, mediaType?: string): Promise<Answer> {
  const parts = image ? [{ inline_data: { mime_type: mediaType, data: image } }, { text: ask }] : [{ text: ask }];
  let lastError: UpstreamError = new UpstreamError("upstream");
  const models = await geminiModels(apiKey);
  let quick = true; // ask for little "thinking" (much faster); dropped if a model rejects it
  // Pass 2 (only when every model was busy): wait a moment, try the first two again.
  for (let pass = 0; pass < 2; pass += 1) {
    if (pass === 1) {
      if (lastError.code !== "busy") break;
      await new Promise((resolve) => setTimeout(resolve, 2500));
    }
    const list = pass === 0 ? models : models.slice(0, 2);
    for (let i = 0; i < list.length; i += 1) {
      const model = list[i];
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: "POST",
        headers: { "x-goog-api-key": apiKey, "content-type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM }] },
          contents: [{ role: "user", parts }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 16000, ...(quick ? { thinkingConfig: { thinkingLevel: "low" } } : {}) },
        }),
      });
      if (response.ok) {
        const result = await response.json();
        const candidate = result.candidates?.[0];
        const text = (candidate?.content?.parts ?? []).filter((p: { text?: string; thought?: boolean }) => p.text && !p.thought).map((p: { text: string }) => p.text).join("");
        if (!text && candidate?.finishReason && candidate.finishReason !== "STOP") {
          throw new UpstreamError(candidate.finishReason === "SAFETY" || candidate.finishReason === "RECITATION" ? "blocked" : "upstream", candidate.finishReason);
        }
        return {
          text,
          inputTokens: result.usageMetadata?.promptTokenCount ?? null,
          outputTokens: result.usageMetadata?.candidatesTokenCount ?? null,
          truncated: candidate?.finishReason === "MAX_TOKENS",
        };
      }
      const detail = await response.text();
      console.error("gemini error", model, response.status, detail.slice(0, 500));
      if (response.status === 400 && quick && /thinking/i.test(detail)) {
        quick = false;
        i -= 1; // same model again, without the hint
        continue;
      }
      if (response.status === 404) {
        lastError = new UpstreamError("upstream", "model not found");
        continue; // try the next model
      }
      if (/API_KEY_INVALID|API key not valid/i.test(detail) || response.status === 401 || response.status === 403) throw new UpstreamError("bad_key");
      if (/location is not supported/i.test(detail)) throw new UpstreamError("region");
      if (response.status === 429 || response.status === 503) {
        lastError = new UpstreamError("busy"); // this model's free quota is used up: try the next one
        continue;
      }
      throw new UpstreamError("upstream");
    }
  }
  throw lastError;
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });
  if (req.method !== "POST") return json({ error: "method" }, 405, origin);

  // Health check from the database (pg_net) with the push hook secret: translates a fixed
  // sample with the configured provider. Nothing is saved; no student data involved.
  const hook = req.headers.get("x-ulpa-hook");
  if (hook) {
    const { data: config } = await db.rpc("push_server_config");
    if (!config?.hook_secret || hook !== config.hook_secret) return json({ error: "unauthorized" }, 401, origin);
    const claude = Deno.env.get("ANTHROPIC_API_KEY");
    const gemini = Deno.env.get("GEMINI_API_KEY");
    const which = claude ? "claude" : gemini ? "gemini" : null;
    if (!which) return json({ error: "not_configured" }, 200, origin);
    const sample = "Мына орысша мәтінді қазақ тіліне аудар:\n\nПроизводная функции в точке — это предел отношения приращения функции к приращению аргумента, когда приращение аргумента стремится к нулю.";
    try {
      const started = Date.now();
      const answer = which === "claude" ? await askClaude(claude!, sample, "") : await askGemini(gemini!, sample, "");
      return json({ ok: true, provider: which, ms: Date.now() - started, result: answer.text }, 200, origin);
    } catch (error) {
      return json({ ok: false, provider: which, error: error instanceof UpstreamError ? error.message : String(error) }, 200, origin);
    }
  }

  // Who is asking (must be an activated student).
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: userData } = await db.auth.getUser(token);
  if (!userData?.user) return json({ error: "unauthorized" }, 401, origin);
  const { data: student } = await db.from("students").select("id").eq("user_id", userData.user.id).maybeSingle();
  if (!student) return json({ error: "unauthorized" }, 401, origin);

  let body: { image?: string; mediaType?: string; text?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad_request" }, 400, origin);
  }
  const image = typeof body.image === "string" ? body.image : "";
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!image && !text) return json({ error: "empty" }, 400, origin);
  if (image && (!MEDIA_TYPES.has(String(body.mediaType)) || image.length > MAX_IMAGE_B64 || !/^[A-Za-z0-9+/=]+$/.test(image.slice(0, 200)))) {
    return json({ error: "bad_image" }, 400, origin);
  }
  if (text.length > MAX_TEXT) return json({ error: "too_long" }, 400, origin);

  const claudeKey = Deno.env.get("ANTHROPIC_API_KEY");
  const geminiKey = Deno.env.get("GEMINI_API_KEY");
  const forced = Deno.env.get("TRANSLATE_PROVIDER");
  const provider = forced === "gemini" && geminiKey ? "gemini" : forced === "claude" && claudeKey ? "claude" : claudeKey ? "claude" : geminiKey ? "gemini" : null;
  if (!provider) return json({ error: "not_configured" }, 503, origin);

  // Daily limits.
  const perStudent = Number(Deno.env.get("TRANSLATE_DAILY_LIMIT") ?? 15);
  const perClass = Number(Deno.env.get("TRANSLATE_CLASS_DAILY_LIMIT") ?? 200);
  const since = almatyDayStart();
  const { count: mine } = await db.from("translations").select("id", { count: "exact", head: true }).eq("student_id", student.id).gte("created_at", since);
  if ((mine ?? 0) >= perStudent) return json({ error: "limit", limit: perStudent }, 429, origin);
  const { count: all } = await db.from("translations").select("id", { count: "exact", head: true }).gte("created_at", since);
  if ((all ?? 0) >= perClass) return json({ error: "class_limit" }, 429, origin);

  const ask = image ? "Осы беттегі орысша мәтінді қазақ тіліне аудар." : `Мына орысша мәтінді қазақ тіліне аудар:\n\n${text}`;
  let out: Answer;
  try {
    out = provider === "claude"
      ? await askClaude(claudeKey!, ask, image, body.mediaType)
      : await askGemini(geminiKey!, ask, image, body.mediaType);
  } catch (error) {
    const code = error instanceof UpstreamError ? error.code : "upstream";
    if (!(error instanceof UpstreamError)) console.error(`${provider} failed`, error);
    return json({ error: code }, 502, origin);
  }
  const translated = out.text.trim().slice(0, 30000);
  if (!translated) return json({ error: "empty_result" }, 502, origin);

  const { data: saved } = await db
    .from("translations")
    .insert({
      student_id: student.id,
      source_kind: image ? "image" : "text",
      result: translated,
      input_tokens: out.inputTokens,
      output_tokens: out.outputTokens,
    })
    .select("id, created_at")
    .single();

  return json({ id: saved?.id, created_at: saved?.created_at, result: translated, remaining: Math.max(0, perStudent - (mine ?? 0) - 1), truncated: out.truncated, provider }, 200, origin);
});
