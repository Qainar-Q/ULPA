// ULPA · study-ai
//
// Three study helpers for signed-in students, using the same AI provider as `translate`
// (Claude if ANTHROPIC_API_KEY is set, otherwise Google Gemini with GEMINI_API_KEY):
//   photo_note  – a blackboard photo → a clean Kazakh note (the student reviews it before saving)
//   photo_index – read the text on a photo so search can find it (runs after an upload)
//   quiz        – practice questions from a course's shared notes
//
// Permissions: the photo / notes are read with the student's OWN token, so Row Level
// Security decides what they may use; only then is the image downloaded with the service key.
// Limits: AI_DAILY_LIMIT per student per day (default 10, photo_index not counted) and
// AI_CLASS_DAILY_LIMIT for everything together (default 250), in Almaty days.

import { createClient } from "npm:@supabase/supabase-js@2";
import { encodeBase64 } from "jsr:@std/encoding@1/base64";

const ALLOWED_ORIGINS = new Set(["https://kainar.online", "https://www.kainar.online", "http://localhost:5173", "http://localhost:4173"]);
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
// Public key (same one the website uses); only used together with the student's own token.
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "sb_publishable_fnfShtPMuOUc2g3CNX-ydA_PAob-rU6";
const db = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false, autoRefreshToken: false } });

const PER_STUDENT = Number(Deno.env.get("AI_DAILY_LIMIT") ?? 10);
const PER_CLASS = Number(Deno.env.get("AI_CLASS_DAILY_LIMIT") ?? 250);
const MAX_IMAGE_BYTES = 6_000_000;

const BASE = `Сен — ҚазҰУ механика-математика факультетінің студенттеріне (мамандығы: ғарыштық техника және технологиялар) көмектесетін оқу көмекшісісің.
Қазақ тілінің әдеби нормасын және математика, механика, физика, ғарыш техникасы саласындағы қалыптасқан қазақша терминдерді қолдан
(производная → туынды, уравнение → теңдеу, ускорение → үдеу, скорость → жылдамдық, сила → күш, доказательство → дәлелдеу).
Формулаларды LaTeX-сіз, оқуға оңай түрде жаз (x², √x, ∫, ∑, ≤, ≥, ≠, π, α, Δ, →) және \`формула\` деп бэктиктермен қоршап жаз.
Жауапты ТЕК сұралған JSON түрінде қайтар, басқа ештеңе жазба.`;

const PHOTO_NOTE = `${BASE}

Тапсырма: суретте сабақтағы тақта (немесе дәптер, слайд) бар. Одан студенттерге арналған таза, реттелген конспект жаса.
- Тақтада не жазылса, соның бәрін қамт: анықтамалар, формулалар, теоремалар, есептер мен шешімдері. Өзіңнен жаңа тақырып қоспа.
- Орысша жазылғанын қазақшаға аудар. Формулалар, сандар, белгілер өзгермейді.
- Құрылым: "## " тақырыпшалар, "- " тізімдер, маңызды терминдер **қалың**. Өшіріліп қалған немесе оқылмайтын жерге [оқылмайды] деп жаз.
- "title": конспектінің қысқа атауы (тақырып), 60 таңбадан аспасын.
- "body": конспектінің өзі (Markdown).
- "text": тақтадағы мәтін түпнұсқа тілінде, сөзбе-сөз, ешбір өңдеусіз (іздеу үшін). Формулаларды да қос.
- Суретте оқу мәтіні мүлдем болмаса: {"title":"","body":"","text":""}.
JSON: {"title": string, "body": string, "text": string}`;

const PHOTO_INDEX = `Суреттегі барлық жазуды түпнұсқа тілінде (қазақша/орысша/ағылшынша), сөзбе-сөз көшіріп жаз. Формулаларды қарапайым түрде жаз (x², ∫, √).
Түсініктеме қоспа. Жазу болмаса, бос жол қайтар.
Жауапты ТЕК JSON түрінде қайтар: {"text": string}`;

const quizPrompt = (count: number) => `${BASE}

Тапсырма: төмендегі конспектілер бойынша студенттің білімін тексеретін ${count} тест сұрағын құрастыр.
- Сұрақтар тек конспектідегі материалға негізделсін. Әртүрлі тақырыптан алуға тырыс.
- Әр сұрақта 4 жауап нұсқасы, тек біреуі дұрыс. Қате нұсқалар сенімді көрінсін, бірақ анық қате болсын.
- Дұрыс жауаптың орнын әр сұрақта ауыстырып отыр.
- "explain": дұрыс жауаптың неге дұрыс екенін 1–2 сөйлеммен түсіндір.
JSON: {"questions": [{"q": string, "options": [string, string, string, string], "answer": 0-3, "explain": string}]}`;

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

type Media = { data: string; mime: string } | null;

async function askClaude(key: string, system: string, prompt: string, media: Media): Promise<string> {
  const content = media
    ? [{ type: "image", source: { type: "base64", media_type: media.mime, data: media.data } }, { type: "text", text: prompt }]
    : [{ type: "text", text: prompt }];
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: Deno.env.get("ANTHROPIC_MODEL") ?? "claude-sonnet-5-5", max_tokens: 8000, system, messages: [{ role: "user", content }] }),
  });
  if (!response.ok) {
    const detail = await response.text();
    console.error("anthropic error", response.status, detail.slice(0, 400));
    throw new UpstreamError(response.status === 401 ? "bad_key" : response.status === 429 || response.status === 529 ? "busy" : "upstream");
  }
  const result = await response.json();
  return (result.content ?? []).filter((b: { type: string }) => b.type === "text").map((b: { text: string }) => b.text).join("\n");
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


async function askGemini(apiKey: string, system: string, prompt: string, media: Media): Promise<string> {
  const parts = media ? [{ inline_data: { mime_type: media.mime, data: media.data } }, { text: prompt }] : [{ text: prompt }];
  let lastError = new UpstreamError("upstream");
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
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: "user", parts }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 16000, responseMimeType: "application/json", ...(quick ? { thinkingConfig: { thinkingLevel: "low" } } : {}) },
        }),
      });
      if (response.ok) {
        const result = await response.json();
        const candidate = result.candidates?.[0];
        const text = (candidate?.content?.parts ?? []).filter((p: { text?: string; thought?: boolean }) => p.text && !p.thought).map((p: { text: string }) => p.text).join("");
        if (!text && candidate?.finishReason && candidate.finishReason !== "STOP") throw new UpstreamError(candidate.finishReason === "SAFETY" ? "blocked" : "upstream", candidate.finishReason);
        return text;
      }
      const detail = await response.text();
      console.error("gemini error", model, response.status, detail.slice(0, 400));
      if (response.status === 400 && quick && /thinking/i.test(detail)) {
        quick = false;
        i -= 1; // same model again, without the hint
        continue;
      }
      if (response.status === 404) continue;
      if (/API_KEY_INVALID|API key not valid/i.test(detail) || response.status === 401 || response.status === 403) throw new UpstreamError("bad_key");
      if (response.status === 429 || response.status === 503) {
        lastError = new UpstreamError("busy");
        continue;
      }
      throw new UpstreamError("upstream");
    }
  }
  throw lastError;
}

function provider() {
  const claude = Deno.env.get("ANTHROPIC_API_KEY");
  const gemini = Deno.env.get("GEMINI_API_KEY");
  if (claude) return (s: string, p: string, m: Media) => askClaude(claude, s, p, m);
  if (gemini) return (s: string, p: string, m: Media) => askGemini(gemini, s, p, m);
  return null;
}

/** The model's answer as JSON (tolerates ```json fences or text around it). */
function parseJson(raw: string): Record<string, unknown> {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
    throw new UpstreamError("bad_output");
  }
}

const str = (value: unknown, max: number) => (typeof value === "string" ? value.trim().slice(0, max) : "");

function cleanQuiz(raw: Record<string, unknown>, count: number) {
  const list = Array.isArray(raw.questions) ? raw.questions : [];
  return list
    .map((item: Record<string, unknown>) => ({
      q: str(item?.q, 600),
      options: Array.isArray(item?.options) ? item.options.map((o: unknown) => str(o, 300)).filter(Boolean).slice(0, 4) : [],
      answer: Number(item?.answer),
      explain: str(item?.explain, 800),
    }))
    .filter((item) => item.q && item.options.length === 4 && Number.isInteger(item.answer) && item.answer >= 0 && item.answer < 4)
    .slice(0, count);
}

/** Almaty calendar date of a timestamp (yyyy-mm-dd). */
const almatyDate = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Almaty" }).format(new Date(iso));

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });
  if (req.method !== "POST") return json({ error: "method" }, 405, origin);

  const ask = provider();

  // Health check (database hook secret): a tiny quiz from a fixed sample. No student data.
  const hook = req.headers.get("x-ulpa-hook");
  if (hook) {
    const { data: config } = await db.rpc("push_server_config");
    if (!config?.hook_secret || hook !== config.hook_secret) return json({ error: "unauthorized" }, 401, origin);
    if (!ask) return json({ error: "not_configured" }, 200, origin);
    const probe = await req.json().catch(() => ({}));
    if (probe?.test === "photo") {
      // A made-up demo blackboard from the public website, never a class photo.
      try {
        const started = Date.now();
        const image = await fetch("https://kainar.online/demo/p1.jpg");
        const media = { data: encodeBase64(new Uint8Array(await image.arrayBuffer())), mime: "image/jpeg" };
        const out = parseJson(await ask(PHOTO_NOTE, "Осы суреттен конспект жаса.", media));
        return json({ ok: true, ms: Date.now() - started, title: out.title, body: out.body, text: out.text }, 200, origin);
      } catch (error) {
        return json({ ok: false, error: String(error) }, 200, origin);
      }
    }
    try {
      const started = Date.now();
      const raw = await ask(quizPrompt(2), "Конспект:\n## Туынды\nФункцияның нүктедегі туындысы — функция өсімшесінің аргумент өсімшесіне қатынасының шегі. `(xⁿ)' = n·xⁿ⁻¹`, `(sin x)' = cos x`.", null);
      const gemini = Deno.env.get("GEMINI_API_KEY");
      const models = !Deno.env.get("ANTHROPIC_API_KEY") && gemini ? await geminiModels(gemini) : [];
      return json({ ok: true, ms: Date.now() - started, models, questions: cleanQuiz(parseJson(raw), 2) }, 200, origin);
    } catch (error) {
      return json({ ok: false, error: String(error) }, 200, origin);
    }
  }

  // Who is asking: an activated student. A client with THEIR token reads data under RLS.
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: userData } = await db.auth.getUser(token);
  if (!userData?.user) return json({ error: "unauthorized" }, 401, origin);
  const { data: student } = await db.from("students").select("id").eq("user_id", userData.user.id).maybeSingle();
  if (!student) return json({ error: "unauthorized" }, 401, origin);
  const asUser = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let body: { action?: string; photoId?: string; courseId?: string; count?: number };
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad_request" }, 400, origin);
  }
  const action = body.action;
  if (!["photo_note", "photo_index", "quiz"].includes(String(action))) return json({ error: "bad_request" }, 400, origin);
  if (!ask) return json({ error: "not_configured" }, 503, origin);

  const uuid = /^[0-9a-f-]{36}$/i;
  let photo: { id: string; course_id: string; storage_path: string; created_at: string; ocr_at: string | null } | null = null;
  let notesText = "";
  const count = Math.min(10, Math.max(3, Number(body.count) || 5));

  // Check access BEFORE spending any quota.
  if (action === "photo_note" || action === "photo_index") {
    if (!uuid.test(String(body.photoId))) return json({ error: "bad_request" }, 400, origin);
    const { data } = await asUser.from("course_photos").select("id, course_id, storage_path, created_at, ocr_at, uploaded").eq("id", body.photoId).maybeSingle();
    if (!data || !data.uploaded) return json({ error: "not_found" }, 404, origin);
    photo = data;
    if (action === "photo_index" && photo.ocr_at) return json({ ok: true, skipped: true }, 200, origin);
  } else {
    if (!uuid.test(String(body.courseId))) return json({ error: "bad_request" }, 400, origin);
    const { data: notes } = await asUser.from("notes").select("title, body").eq("course_id", body.courseId).order("updated_at", { ascending: false }).limit(25);
    notesText = (notes ?? []).map((n: { title: string; body: string }) => `# ${n.title}\n${n.body ?? ""}`).join("\n\n").slice(0, 40_000);
    if (notesText.replace(/\s/g, "").length < 80) return json({ error: "no_notes" }, 400, origin);
  }

  const { data: quota } = await db.rpc("ai_take_quota", {
    p_student: student.id,
    p_kind: action,
    p_per_student: action === "photo_index" ? 0 : PER_STUDENT,
    p_per_class: PER_CLASS,
  });
  if (!quota?.ok) return json({ error: quota?.error ?? "limit", limit: PER_STUDENT }, 429, origin);

  try {
    if (photo) {
      const { data: file, error } = await db.storage.from("course-photos").download(photo.storage_path);
      if (error || !file) throw new UpstreamError("image_missing");
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (bytes.length > MAX_IMAGE_BYTES) throw new UpstreamError("image_too_large");
      const media = { data: encodeBase64(bytes), mime: file.type && file.type.startsWith("image/") ? file.type : "image/jpeg" };

      if (action === "photo_index") {
        const out = parseJson(await ask(PHOTO_INDEX, "Суреттегі жазуды көшір.", media));
        await db.rpc("set_photo_ocr", { p_photo: photo.id, p_text: str(out.text, 8000) });
        return json({ ok: true }, 200, origin);
      }
      const out = parseJson(await ask(PHOTO_NOTE, "Осы суреттен конспект жаса.", media));
      const text = str(out.text, 8000);
      if (text) await db.rpc("set_photo_ocr", { p_photo: photo.id, p_text: text }); // search gets it for free
      const noteBody = str(out.body, 30_000);
      if (!noteBody) {
        await db.rpc("ai_refund", { p_id: quota.id });
        return json({ error: "no_text" }, 200, origin);
      }
      return json(
        { ok: true, title: str(out.title, 120) || "Тақтадан конспект", body: noteBody, course_id: photo.course_id, lesson_date: almatyDate(photo.created_at), remaining: quota.remaining },
        200,
        origin
      );
    }

    const out = parseJson(await ask(quizPrompt(count), `Конспектілер:\n\n${notesText}`, null));
    const questions = cleanQuiz(out, count);
    if (questions.length < 2) throw new UpstreamError("bad_output");
    return json({ ok: true, questions, remaining: quota.remaining }, 200, origin);
  } catch (error) {
    await db.rpc("ai_refund", { p_id: quota.id });
    const code = error instanceof UpstreamError ? error.code : "upstream";
    if (!(error instanceof UpstreamError)) console.error("study-ai failed", error);
    return json({ error: code }, 502, origin);
  }
});
