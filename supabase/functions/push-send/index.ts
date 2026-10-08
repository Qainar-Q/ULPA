// ULPA · push-send
//
// Called two ways:
//   1. By the database (triggers / nightly cron via pg_net) with header
//      x-ulpa-hook: <secret from Vault>. Body { type: "task"|"announcement"|"poll"|"comment"|"deadlines"|"wish"|"suggestion"|"birthdays"|"init", id }.
//   2. By a signed-in student (Authorization: Bearer <their session token>)
//      with { type: "test" } — sends a test notification to that student's own devices.
// Recipients follow the same visibility rules as the app (group items only to
// that group + admin) and each student's notification preferences.
// The service-role key and the VAPID private key exist only here and in Vault.

import { createClient } from "npm:@supabase/supabase-js@2";
import { generateVapidKeys, sendPush, type VapidKeys } from "./webpush.ts";

const SUBJECT = "https://kainar.online";
const ALLOWED_ORIGINS = new Set([
  "https://kainar.online",
  "https://www.kainar.online",
  "http://localhost:5173",
  "http://localhost:4173",
]);

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type Student = { id: string; full_name: string; group_no: number; role: string };
type Message = { title: string; body: string; url: string; tag: string };
type PrefKey = "tasks" | "announcements" | "polls" | "comments" | "deadlines";

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

function sameSecret(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function loadConfig(): Promise<{ hookSecret: string; keys: VapidKeys }> {
  const { data, error } = await db.rpc("push_server_config");
  if (error) throw error;
  if (!data.vapid_private_jwk) {
    const generated = await generateVapidKeys();
    const { error: storeError } = await db.rpc("push_store_vapid", {
      p_private_jwk: JSON.stringify(generated.privateJwk),
      p_public_key: generated.publicKey,
    });
    if (storeError) throw storeError;
    return loadConfig(); // read back whatever is stored (another call may have won the race)
  }
  return { hookSecret: data.hook_secret, keys: { privateJwk: JSON.parse(data.vapid_private_jwk), publicKey: data.vapid_public_key } };
}

const almaty = new Intl.DateTimeFormat("ru-RU", {
  timeZone: "Asia/Almaty",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

const clip = (text: string | null | undefined, max = 140) =>
  !text ? "" : text.length > max ? `${text.slice(0, max - 1)}…` : text;

async function classMembers(): Promise<Student[]> {
  const { data, error } = await db.from("students").select("id, full_name, group_no, role").not("user_id", "is", null);
  if (error) throw error;
  return data as Student[];
}

const canSee = (student: Student, groupNo: number | null) => groupNo === null || student.role === "admin" || student.group_no === groupNo;

/** Send one message to every device of the given students (respecting a preference unless it is null). */
async function deliver(studentIds: string[], message: Message, pref: PrefKey | null, keys: VapidKeys) {
  const ids = [...new Set(studentIds)];
  if (ids.length === 0) return { devices: 0, sent: 0, gone: 0, failed: 0 };

  const allowed = new Set(ids);
  if (pref) {
    const { data: prefs } = await db.from("notification_prefs").select(`student_id, ${pref}`).in("student_id", ids);
    for (const row of prefs ?? []) if ((row as Record<string, unknown>)[pref] === false) allowed.delete(row.student_id);
  }
  if (allowed.size === 0) return { devices: 0, sent: 0, gone: 0, failed: 0 };

  const { data: subs, error } = await db
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth, student_id")
    .in("student_id", [...allowed]);
  if (error) throw error;

  const results = await Promise.allSettled(
    (subs ?? []).map((sub) => sendPush(sub, message, keys, SUBJECT, { ttl: 60 * 60 * 24, urgency: "normal", topic: message.tag.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 32) }))
  );
  const gone: string[] = [];
  const ok: string[] = [];
  let failed = 0;
  results.forEach((result, index) => {
    const endpoint = subs![index].endpoint;
    if (result.status === "fulfilled" && result.value >= 200 && result.value < 300) ok.push(endpoint);
    else if (result.status === "fulfilled" && (result.value === 404 || result.value === 410)) gone.push(endpoint);
    else failed += 1;
  });
  if (gone.length) await db.from("push_subscriptions").delete().in("endpoint", gone); // phone unsubscribed / app removed
  if (ok.length) await db.from("push_subscriptions").update({ last_success_at: new Date().toISOString() }).in("endpoint", ok);
  return { devices: subs?.length ?? 0, sent: ok.length, gone: gone.length, failed };
}

async function onTask(id: string, keys: VapidKeys) {
  const { data: task } = await db.from("assignments").select("id, title, due_at, group_no, created_by, courses(code)").eq("id", id).maybeSingle();
  if (!task) return { skipped: "not found" };
  const members = await classMembers();
  const to = members.filter((s) => canSee(s, task.group_no) && s.id !== task.created_by).map((s) => s.id);
  const code = (task.courses as { code?: string } | null)?.code;
  return deliver(to, {
    title: `📚 Жаңа тапсырма${code ? ` · ${code}` : ""}`,
    body: `${clip(task.title, 110)}${task.due_at ? ` — мерзімі ${almaty.format(new Date(task.due_at))}` : ""}`,
    url: `/tasks/${task.id}`,
    tag: `task-${task.id}`,
  }, "tasks", keys);
}

async function onAnnouncement(id: string, keys: VapidKeys) {
  const { data: item } = await db.from("announcements").select("id, title, body, group_no, author_id, author_name").eq("id", id).maybeSingle();
  if (!item) return { skipped: "not found" };
  const members = await classMembers();
  const to = members.filter((s) => canSee(s, item.group_no) && s.id !== item.author_id).map((s) => s.id);
  return deliver(to, {
    title: `📢 ${clip(item.title, 80)}`,
    body: clip(item.body, 140) || `${item.author_name ?? ""}`,
    url: "/announcements",
    tag: `announcement-${item.id}`,
  }, "announcements", keys);
}

async function onPoll(id: string, keys: VapidKeys) {
  const { data: poll } = await db.from("polls").select("id, question, group_no, created_by, creator_name").eq("id", id).maybeSingle();
  if (!poll) return { skipped: "not found" };
  const members = await classMembers();
  const to = members.filter((s) => canSee(s, poll.group_no) && s.id !== poll.created_by).map((s) => s.id);
  return deliver(to, {
    title: "🗳 Жаңа сауалнама",
    body: `${clip(poll.question, 120)}${poll.creator_name ? ` — ${poll.creator_name}` : ""}`,
    url: "/polls",
    tag: `poll-${poll.id}`,
  }, "polls", keys);
}

async function onComment(id: string, keys: VapidKeys) {
  const { data: comment } = await db.from("photo_comments").select("id, photo_id, student_id, author_name, body").eq("id", id).maybeSingle();
  if (!comment) return { skipped: "not found" };
  const { data: photo } = await db.from("course_photos").select("id, uploaded_by, group_no").eq("id", comment.photo_id).maybeSingle();
  if (!photo) return { skipped: "photo not found" };
  // The uploader and everyone who already commented on this photo.
  const { data: thread } = await db.from("photo_comments").select("student_id").eq("photo_id", photo.id);
  const involved = new Set([photo.uploaded_by, ...(thread ?? []).map((row) => row.student_id)].filter(Boolean));
  involved.delete(comment.student_id);
  const members = await classMembers();
  const to = members.filter((s) => involved.has(s.id) && canSee(s, photo.group_no)).map((s) => s.id);
  return deliver(to, {
    title: `💬 ${comment.author_name ?? "Пікір"} фотоға пікір жазды`,
    body: clip(comment.body, 140),
    url: "/photos",
    tag: `comment-${photo.id}`,
  }, "comments", keys);
}

async function onDeadlines(keys: VapidKeys) {
  const now = new Date();
  const until = new Date(now.getTime() + 28 * 60 * 60 * 1000); // tonight + all of tomorrow
  const { data: tasks } = await db
    .from("assignments")
    .select("id, title, due_at, group_no")
    .gt("due_at", now.toISOString())
    .lte("due_at", until.toISOString())
    .order("due_at");
  if (!tasks?.length) return { skipped: "nothing due" };
  const { data: done } = await db.from("assignment_status").select("assignment_id, student_id").in("assignment_id", tasks.map((t) => t.id));
  const doneSet = new Set((done ?? []).map((row) => `${row.assignment_id}:${row.student_id}`));
  const members = await classMembers();
  const totals = { devices: 0, sent: 0, gone: 0, failed: 0 };
  for (const student of members) {
    const mine = tasks.filter((t) => canSee(student, t.group_no) && !doneSet.has(`${t.id}:${student.id}`));
    if (mine.length === 0) continue;
    const names = mine.slice(0, 3).map((t) => clip(t.title, 50)).join("; ");
    const result = await deliver([student.id], {
      title: mine.length === 1 ? "⏰ Тапсырма мерзімі жақындады" : `⏰ ${mine.length} тапсырманың мерзімі жақындады`,
      body: `${names}${mine.length > 3 ? ` және тағы ${mine.length - 3}` : ""}`,
      url: mine.length === 1 ? `/tasks/${mine[0].id}` : "/tasks",
      tag: "deadlines",
    }, "deadlines", keys);
    totals.devices += result.devices;
    totals.sent += result.sent;
    totals.gone += result.gone;
    totals.failed += result.failed;
  }
  return totals;
}

async function onWish(id: string, keys: VapidKeys) {
  const { data: wish } = await db.from("birthday_wishes").select("id, student_id, author_name, emoji, body").eq("id", id).maybeSingle();
  if (!wish) return { skipped: "not found" };
  return deliver([wish.student_id], {
    title: `${wish.emoji} ${wish.author_name ?? "Сыныптасың"} сені құттықтады!`,
    body: clip(wish.body, 140),
    url: "/",
    tag: `wish-${wish.id}`,
  }, "comments", keys);
}

async function onSuggestion(id: string, keys: VapidKeys) {
  const { data: item } = await db.from("suggestions").select("id, body").eq("id", id).maybeSingle();
  if (!item) return { skipped: "not found" };
  const members = await classMembers();
  const admins = members.filter((s) => s.role === "admin").map((s) => s.id);
  // No author name here: the box is anonymous to everyone but the admin's own lookup.
  return deliver(admins, { title: "📮 Жаңа ұсыныс", body: clip(item.body, 120), url: "/suggestions", tag: `suggestion-${item.id}` }, null, keys);
}

const almatyParts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Almaty", year: "numeric", month: "numeric", day: "numeric" });

async function onBirthdays(keys: VapidKeys) {
  const parts = Object.fromEntries(almatyParts.formatToParts(new Date()).map((p) => [p.type, Number(p.value)]));
  const { year, month, day } = parts as unknown as { year: number; month: number; day: number };
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const { data: rows } = await db.from("students").select("id, full_name, birth_month, birth_day, user_id").not("birth_month", "is", null);
  const today = (rows ?? []).filter(
    (s) => s.birth_month === month && (s.birth_day === day || (!leap && month === 2 && day === 28 && s.birth_day === 29))
  );
  if (today.length === 0) return { skipped: "no birthdays" };
  const members = await classMembers();
  const names = today.map((s) => s.full_name).join(", ");
  const heroes = new Set(today.map((s) => s.id));
  const totals = { devices: 0, sent: 0, gone: 0, failed: 0 };
  const add = (r: typeof totals) => {
    totals.devices += r.devices; totals.sent += r.sent; totals.gone += r.gone; totals.failed += r.failed;
  };
  for (const hero of today) {
    add(await deliver([hero.id], { title: `🎉 Туған күніңмен, ${hero.full_name}!`, body: "Бүкіл топ атынан құттықтаймыз! ULPA-ны ашып, тілектерді оқы 🎂", url: "/", tag: "birthday-me" }, null, keys));
  }
  const others = members.filter((s) => !heroes.has(s.id)).map((s) => s.id);
  add(await deliver(others, { title: `🎂 Бүгін туған күн: ${names}`, body: "Құттықтауды ұмытпа — ULPA басты бетінде тілек жаз!", url: "/", tag: "birthdays" }, "announcements", keys));
  return totals;
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });
  if (req.method !== "POST") return json({ error: "method" }, 405, origin);

  let body: { type?: string; id?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad_request" }, 400, origin);
  }

  try {
    const { hookSecret, keys } = await loadConfig();

    if (body.type === "test") {
      const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
      const { data: userData } = await db.auth.getUser(token);
      if (!userData?.user) return json({ error: "unauthorized" }, 401, origin);
      const { data: student } = await db.from("students").select("id").eq("user_id", userData.user.id).maybeSingle();
      if (!student) return json({ error: "unauthorized" }, 401, origin);
      const result = await deliver([student.id], {
        title: "ULPA",
        body: "Хабарландырулар жұмыс істейді ✓",
        url: "/profile",
        tag: "test",
      }, null, keys);
      return json(result, 200, origin);
    }

    if (!sameSecret(req.headers.get("x-ulpa-hook") ?? "", hookSecret)) return json({ error: "unauthorized" }, 401, origin);

    const id = String(body.id ?? "");
    switch (body.type) {
      case "init":
        return json({ ok: true }, 200, origin);
      case "task":
        return json(await onTask(id, keys), 200, origin);
      case "announcement":
        return json(await onAnnouncement(id, keys), 200, origin);
      case "poll":
        return json(await onPoll(id, keys), 200, origin);
      case "comment":
        return json(await onComment(id, keys), 200, origin);
      case "deadlines":
        return json(await onDeadlines(keys), 200, origin);
      case "wish":
        return json(await onWish(id, keys), 200, origin);
      case "suggestion":
        return json(await onSuggestion(id, keys), 200, origin);
      case "birthdays":
        return json(await onBirthdays(keys), 200, origin);
      default:
        return json({ error: "unknown_type" }, 400, origin);
    }
  } catch (error) {
    console.error("push-send failed", error);
    return json({ error: "server_error" }, 500, origin);
  }
});
