// ULPA · hub-push: reminders for the personal hub (1% Better, kainar.online/hub).
//
//   1. Every 5 minutes pg_cron (private.hub_push_tick) posts { action: "tick" } with header x-ulpa-hook.
//      For each subscribed device: fast done, eating window over, English / training not done by the
//      chosen time (read from today's hub_checkins), and the weekly report on Sunday 20:00.
//   2. A signed-in hub user posts { action: "test" } to get a test notification on his own devices.
// Uses ULPA's VAPID keys and hook secret (push_server_config); the private key never leaves the server.

import { createClient } from "npm:@supabase/supabase-js@2";
import { sendPush, type VapidKeys } from "./webpush.ts";

const SUBJECT = "https://kainar.online";
const ALLOWED_ORIGINS = new Set(["https://kainar.online", "https://www.kainar.online", "http://localhost:5173", "http://localhost:4173"]);
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false, autoRefreshToken: false } });

const cors = (origin: string | null) => ({
  "Access-Control-Allow-Origin": origin && ALLOWED_ORIGINS.has(origin) ? origin : "https://kainar.online",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  Vary: "Origin",
});
const json = (body: unknown, status: number, origin: string | null) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors(origin), "Content-Type": "application/json" } });

function sameSecret(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function config(): Promise<{ hookSecret: string; keys: VapidKeys }> {
  const { data, error } = await db.rpc("push_server_config");
  if (error) throw error;
  if (!data?.vapid_private_jwk) throw new Error("no_vapid");
  return { hookSecret: data.hook_secret, keys: { privateJwk: JSON.parse(data.vapid_private_jwk), publicKey: data.vapid_public_key } };
}

type Lang = "zh" | "en" | "kk";
const TXT: Record<string, Record<Lang, [string, string]>> = {
  fast: { zh: ["断食完成 🎉", "到时间了，可以吃饭了。记得在 1% Better 里点“结束断食”。"], en: ["Fast complete 🎉", "Time's up, you can eat now. Tap “End fast” in 1% Better."], kk: ["Ораза аяқталды 🎉", "Уақыт болды, тамақтана аласыз. 1% Better-де «Аяқтау» басыңыз."] },
  eat: { zh: ["进食时间结束", "现在开始下一次断食吧。"], en: ["Eating window is over", "Time to start your next fast."], kk: ["Тамақ уақыты бітті", "Келесі оразаны бастаңыз."] },
  eng: { zh: ["今天的英语还没做", "背几个单词、做一组练习，5 分钟就够。"], en: ["English isn't done yet today", "A few words and one drill: five minutes is enough."], kk: ["Бүгін ағылшын әлі жасалмады", "Бірнеше сөз және бір жаттығу: 5 минут жеткілікті."] },
  train: { zh: ["今天还没训练", "打开今天的计划，先热身 15 分钟。"], en: ["No training yet today", "Open today's plan and start with a 15-minute warm-up."], kk: ["Бүгін жаттығу әлі жоқ", "Бүгінгі жоспарды ашып, 15 минут қыздырыңыз."] },
  week: { zh: ["本周报告出来了", "看看这一周进步了多少。"], en: ["Your weekly report is ready", "See how much better this week was."], kk: ["Апталық есеп дайын", "Осы аптаны қараңыз."] },
  test: { zh: ["测试提醒 ✓", "提醒已经打开，会按时通知你。"], en: ["Test reminder ✓", "Reminders are on and will arrive on time."], kk: ["Сынақ ✓", "Еске салу қосулы."] },
};
const URLS: Record<string, string> = { fast: "/hub/#body", eat: "/hub/#body", eng: "/hub/#eng", train: "/hub/#body", week: "/hub/#today", test: "/hub/" };
const msg = (kind: string, lang: string) => {
  const [title, body] = TXT[kind][(["zh", "en", "kk"].includes(lang) ? lang : "zh") as Lang];
  return { title, body, url: URLS[kind], tag: "hub-" + kind };
};

function local(tz: string, at = new Date()) {
  let zone = tz;
  try { new Intl.DateTimeFormat("en-CA", { timeZone: zone }); } catch { zone = "Asia/Almaty"; }
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short", hourCycle: "h23" })
    .formatToParts(at).map((p) => [p.type, p.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, hm: `${parts.hour}:${parts.minute}`, sunday: parts.weekday === "Sun" };
}
const minutes = (hm: string) => { const [h, m] = hm.split(":").map(Number); return h * 60 + m; };
// Due if it is at or after the chosen time, but at most 3 hours later (no reminders in the middle of the night).
const dueAt = (now: string, pref: unknown) => typeof pref === "string" && /^\d\d:\d\d$/.test(pref) && minutes(now) >= minutes(pref) && minutes(now) - minutes(pref) <= 180;

type Row = { endpoint: string; user_id: string; p256dh: string; auth: string; lang: string; tz: string; prefs: Record<string, unknown>; fast_end: string | null; eat_end: string | null; sent: Record<string, string> };

async function deliver(row: Row, kind: string, keys: VapidKeys): Promise<boolean> {
  const status = await sendPush({ endpoint: row.endpoint, p256dh: row.p256dh, auth: row.auth }, msg(kind, row.lang), keys, SUBJECT, { ttl: 3600, urgency: "high", topic: "hub-" + kind });
  if (status === 404 || status === 410) { await db.from("hub_push").delete().eq("endpoint", row.endpoint); return false; }
  if (status >= 400) console.error("push failed", kind, status);
  return status < 400;
}

async function tick(keys: VapidKeys) {
  const { data: rows, error } = await db.from("hub_push").select("*");
  if (error) throw error;
  if (!rows?.length) return { sent: 0 };
  const since = new Date(Date.now() - 2 * 86400_000).toISOString().slice(0, 10);
  const { data: checks } = await db.from("hub_checkins").select("user_id, day, items").gte("day", since).in("user_id", [...new Set(rows.map((r) => r.user_id))]);
  const items = (uid: string, day: string) => (checks ?? []).find((c) => c.user_id === uid && c.day === day)?.items ?? null;
  const now = Date.now();
  let sent = 0;
  for (const row of rows as Row[]) {
    const p = row.prefs ?? {};
    const s = { ...(row.sent ?? {}) };
    const l = local(row.tz);
    const due: string[] = [];
    if (p.fast && row.fast_end && Date.parse(row.fast_end) <= now && now - Date.parse(row.fast_end) < 6 * 3600_000 && s.fast !== row.fast_end) { due.push("fast"); s.fast = row.fast_end; }
    if (p.fast && row.eat_end && Date.parse(row.eat_end) <= now && now - Date.parse(row.eat_end) < 3 * 3600_000 && s.eat !== row.eat_end) { due.push("eat"); s.eat = row.eat_end; }
    const it = items(row.user_id, l.date) as Record<string, boolean> | null;
    if (dueAt(l.hm, p.eng) && s.eng !== l.date) { s.eng = l.date; if (!it?.eng) due.push("eng"); }
    if (dueAt(l.hm, p.train) && s.train !== l.date) { s.train = l.date; if (!it?.train && !it?.rest) due.push("train"); }
    if (p.week && l.sunday && dueAt(l.hm, "20:00") && s.week !== l.date) { due.push("week"); s.week = l.date; }
    if (JSON.stringify(s) === JSON.stringify(row.sent ?? {})) continue;
    let alive = true;
    for (const kind of due) { if (!alive) break; alive = await deliver(row, kind, keys); if (alive) sent += 1; }
    if (alive) await db.from("hub_push").update({ sent: s }).eq("endpoint", row.endpoint);
  }
  return { sent };
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });
  if (req.method !== "POST") return json({ error: "method" }, 405, origin);
  let body: { action?: string } = {};
  try { body = await req.json(); } catch { /* empty */ }
  try {
    const { hookSecret, keys } = await config();
    if (body.action === "tick") {
      if (!sameSecret(req.headers.get("x-ulpa-hook") ?? "", hookSecret)) return json({ error: "forbidden" }, 403, origin);
      return json(await tick(keys), 200, origin);
    }
    if (body.action === "test") {
      const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
      const { data: u } = await db.auth.getUser(token);
      if (!u?.user) return json({ error: "unauthorized" }, 401, origin);
      const { data: rows } = await db.from("hub_push").select("*").eq("user_id", u.user.id);
      let n = 0;
      for (const row of (rows ?? []) as Row[]) if (await deliver(row, "test", keys)) n += 1;
      return json({ sent: n }, n ? 200 : 404, origin);
    }
    return json({ error: "bad_request" }, 400, origin);
  } catch (error) {
    console.error("hub-push failed", String(error));
    return json({ error: "upstream" }, 500, origin);
  }
});
