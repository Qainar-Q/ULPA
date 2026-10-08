// ULPA · translate
//
// A signed-in student sends a photo/screenshot of a Russian textbook page (or pasted
// Russian text); Claude reads it and returns a Kazakh translation in simple Markdown.
// The Anthropic API key lives only here (Edge Function secret ANTHROPIC_API_KEY).
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

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });
  if (req.method !== "POST") return json({ error: "method" }, 405, origin);

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

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return json({ error: "not_configured" }, 503, origin);

  // Daily limits.
  const perStudent = Number(Deno.env.get("TRANSLATE_DAILY_LIMIT") ?? 15);
  const perClass = Number(Deno.env.get("TRANSLATE_CLASS_DAILY_LIMIT") ?? 200);
  const since = almatyDayStart();
  const { count: mine } = await db.from("translations").select("id", { count: "exact", head: true }).eq("student_id", student.id).gte("created_at", since);
  if ((mine ?? 0) >= perStudent) return json({ error: "limit", limit: perStudent }, 429, origin);
  const { count: all } = await db.from("translations").select("id", { count: "exact", head: true }).gte("created_at", since);
  if ((all ?? 0) >= perClass) return json({ error: "class_limit" }, 429, origin);

  const content = image
    ? [
        { type: "image", source: { type: "base64", media_type: body.mediaType, data: image } },
        { type: "text", text: "Осы беттегі орысша мәтінді қазақ тіліне аудар." },
      ]
    : [{ type: "text", text: `Мына орысша мәтінді қазақ тіліне аудар:\n\n${text}` }];

  let response: Response;
  try {
    response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: Deno.env.get("ANTHROPIC_MODEL") ?? "claude-sonnet-5-5",
        max_tokens: 6000,
        system: SYSTEM,
        messages: [{ role: "user", content }],
      }),
    });
  } catch (error) {
    console.error("anthropic fetch failed", error);
    return json({ error: "upstream" }, 502, origin);
  }
  if (!response.ok) {
    const detail = await response.text();
    console.error("anthropic error", response.status, detail.slice(0, 500));
    const code = response.status === 401 ? "bad_key" : response.status === 429 || response.status === 529 ? "busy" : response.status === 400 && /credit/i.test(detail) ? "no_credit" : "upstream";
    return json({ error: code }, 502, origin);
  }
  const result = await response.json();
  const translated = (result.content ?? [])
    .filter((block: { type: string }) => block.type === "text")
    .map((block: { text: string }) => block.text)
    .join("\n")
    .trim()
    .slice(0, 30000);
  if (!translated) return json({ error: "empty_result" }, 502, origin);

  const { data: saved } = await db
    .from("translations")
    .insert({
      student_id: student.id,
      source_kind: image ? "image" : "text",
      result: translated,
      input_tokens: result.usage?.input_tokens ?? null,
      output_tokens: result.usage?.output_tokens ?? null,
    })
    .select("id, created_at")
    .single();

  return json({ id: saved?.id, created_at: saved?.created_at, result: translated, remaining: Math.max(0, perStudent - (mine ?? 0) - 1), truncated: result.stop_reason === "max_tokens" }, 200, origin);
});
