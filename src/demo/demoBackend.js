// In-browser stand-in for the Supabase API, used only in demo mode. The demo Supabase
// client sends every request here instead of the network, so the real project is never
// contacted. Supports the small part of PostgREST the app uses: filters (eq, neq, gt, gte,
// lt, lte, in, is, not.is), order, limit, single-row responses, insert/upsert/update/delete
// and the embedded child lists the app selects.
import { buildDemoStore, DEMO_NAME } from "./demoData.js";
import { DEMO_USER_ID, demoRole, rememberDemoUpload } from "./demoMode.js";

const STORE_KEY = "ulpa-demo-store";
let store = null;

function load() {
  if (store) return store;
  try {
    const saved = sessionStorage.getItem(STORE_KEY);
    if (saved) store = JSON.parse(saved);
  } catch {
    store = null;
  }
  if (!store) store = buildDemoStore(demoRole());
  return store;
}
let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      sessionStorage.setItem(STORE_KEY, JSON.stringify(store));
    } catch {
      /* storage full: changes last until reload */
    }
  }, 150);
}

const table = (name) => {
  const db = load();
  if (!db[name]) db[name] = [];
  return db[name];
};
const me = () => load().students.find((row) => row.user_id === DEMO_USER_ID);
const now = () => new Date().toISOString();
const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);

function respond(body, { status = 200, headers = {} } = {}) {
  const text = body === undefined ? null : JSON.stringify(body);
  return new Response(status === 204 ? null : text, { status, headers: { "Content-Type": "application/json", ...headers } });
}
const fail = (status, code, message = code) => respond({ code, message, details: null, hint: null }, { status });

// ---------------------------------------------------------------- filters

function parseValue(raw) {
  if (raw === "null") return null;
  if (raw === "true") return true;
  if (raw === "false") return false;
  return raw;
}
function same(a, b) {
  if (a === null || a === undefined) return b === null;
  return String(a) === String(b);
}
function compare(a, b) {
  const na = Number(a);
  const nb = Number(b);
  if (a !== null && a !== "" && !Number.isNaN(na) && !Number.isNaN(nb) && typeof a !== "boolean") return na - nb;
  return String(a ?? "").localeCompare(String(b ?? ""));
}
function makeFilter(column, expr) {
  let negate = false;
  let rest = expr;
  if (rest.startsWith("not.")) {
    negate = true;
    rest = rest.slice(4);
  }
  const dot = rest.indexOf(".");
  const op = rest.slice(0, dot);
  const raw = rest.slice(dot + 1);
  let test;
  switch (op) {
    case "eq":
      test = (v) => same(v, parseValue(raw));
      break;
    case "neq":
      test = (v) => !same(v, parseValue(raw));
      break;
    case "gt":
      test = (v) => v !== null && v !== undefined && compare(v, raw) > 0;
      break;
    case "gte":
      test = (v) => v !== null && v !== undefined && compare(v, raw) >= 0;
      break;
    case "lt":
      test = (v) => v !== null && v !== undefined && compare(v, raw) < 0;
      break;
    case "lte":
      test = (v) => v !== null && v !== undefined && compare(v, raw) <= 0;
      break;
    case "in": {
      const list = raw.replace(/^\(|\)$/g, "").split(",").map((item) => item.replace(/^"|"$/g, ""));
      test = (v) => list.some((item) => same(v, item));
      break;
    }
    case "is":
      test = (v) => (raw === "null" ? v === null || v === undefined : same(v, parseValue(raw)));
      break;
    case "ilike":
    case "like": {
      const pattern = new RegExp(`^${raw.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/[%*]/g, ".*")}$`, op === "ilike" ? "i" : "");
      test = (v) => pattern.test(String(v ?? ""));
      break;
    }
    default:
      test = () => true;
  }
  return (row) => (negate ? !test(row[column]) : test(row[column]));
}

const RESERVED = new Set(["select", "order", "limit", "offset", "on_conflict", "columns"]);
function filtersOf(params) {
  const filters = [];
  for (const [key, value] of params) {
    if (RESERVED.has(key) || key.includes(".")) continue;
    filters.push(makeFilter(key, value));
  }
  return (row) => filters.every((f) => f(row));
}

function applyOrder(rows, order) {
  if (!order) return rows;
  const keys = order.split(",").map((part) => {
    const [column, ...mods] = part.split(".");
    return { column, desc: mods.includes("desc"), nullsFirst: mods.includes("nullsfirst") };
  });
  return [...rows].sort((a, b) => {
    for (const { column, desc, nullsFirst } of keys) {
      const av = a[column];
      const bv = b[column];
      if (av === bv) continue;
      if (av === null || av === undefined) return nullsFirst ? -1 : 1;
      if (bv === null || bv === undefined) return nullsFirst ? 1 : -1;
      const diff = compare(av, bv);
      if (diff) return desc ? -diff : diff;
    }
    return 0;
  });
}

// ---------------------------------------------------------------- embeds & defaults

const EMBEDS = {
  assignments: { assignment_attachments: "assignment_id" },
  polls: { poll_options: "poll_id" },
  teachers: { course_teachers: "teacher_id" },
};
const PARENTS = { courses: "course_id" };

function withEmbeds(name, rows, select = "") {
  const children = EMBEDS[name] ?? {};
  return rows.map((row) => {
    const out = { ...row };
    for (const [child, fk] of Object.entries(children)) {
      if (select.includes(`${child}(`)) out[child] = table(child).filter((item) => item[fk] === row.id);
    }
    for (const [parent, fk] of Object.entries(PARENTS)) {
      if (select.includes(`${parent}(`) && row[fk]) out[parent] = table(parent).find((item) => item.id === row[fk]) ?? null;
    }
    return out;
  });
}

const PRIMARY = {
  assignment_status: ["assignment_id", "student_id"],
  student_grades: ["student_id", "course_id"],
  photo_reactions: ["photo_id", "student_id", "emoji"],
  poll_votes: ["option_id", "student_id"],
  course_teachers: ["course_id", "teacher_id"],
  notification_prefs: ["student_id"],
  onboarding_done: ["student_id"],
  attendance_marks: ["student_id", "schedule_entry_id", "session_date"],
  campus_markers: ["id"],
};

/** What the database triggers would fill in on insert. */
function stamp(name, row) {
  const student = me();
  const out = { ...row };
  const has = (key) => out[key] !== undefined;
  if (!PRIMARY[name] && !has("id")) out.id = uuid();
  if (!has("created_at")) out.created_at = now();
  out.updated_at = now();
  const who = { id: student.id, name: student.full_name };
  switch (name) {
    case "assignments":
    case "polls":
      Object.assign(out, { created_by: who.id, creator_name: who.name });
      if (name === "polls") out.closed = out.closed ?? false;
      break;
    case "announcements":
      Object.assign(out, { author_id: who.id, author_name: who.name, author_role: student.role, pinned: out.pinned ?? false });
      break;
    case "course_photos":
      Object.assign(out, { uploaded_by: who.id, uploader_name: who.name, uploaded: false, storage_path: `${out.id}/full.jpg`, thumb_path: `${out.id}/thumb.jpg` });
      break;
    case "course_materials":
      Object.assign(out, { uploaded_by: who.id, uploader_name: who.name, uploaded: false, storage_path: `${out.id}/${out.file_name}` });
      break;
    case "assignment_attachments":
      Object.assign(out, { uploaded: false, storage_path: `${out.assignment_id}/${out.id}` });
      break;
    case "photo_reactions":
      Object.assign(out, { student_id: who.id, student_name: who.name });
      break;
    case "photo_comments":
      Object.assign(out, { student_id: who.id, author_name: who.name });
      break;
    case "assignment_status":
      Object.assign(out, { student_id: who.id, completed_at: out.completed_at ?? now() });
      break;
    case "poll_votes":
    case "student_grades":
      out.student_id = who.id;
      break;
    case "suggestions":
      Object.assign(out, { author_id: who.id, status: "new", reply: null, replied_at: null });
      break;
    default:
  }
  return out;
}

function sameKey(name, a, b) {
  const keys = PRIMARY[name] ?? ["id"];
  return keys.every((key) => same(a[key], b[key]));
}

// ---------------------------------------------------------------- REST

function single(rows, accept) {
  if (!accept.includes("vnd.pgrst.object")) return null;
  if (rows.length !== 1) return fail(406, "PGRST116", "JSON object requested, multiple (or no) rows returned");
  return respond(rows[0]);
}

function rest(name, method, params, body, headers) {
  const accept = headers.get("accept") ?? "";
  const prefer = headers.get("prefer") ?? "";
  const rows = table(name);
  const match = filtersOf(params);
  const select = params.get("select") ?? "*";

  if (method === "GET" || method === "HEAD") {
    let found = applyOrder(rows.filter(match), params.get("order"));
    const total = found.length;
    const offset = Number(params.get("offset") ?? 0);
    if (params.get("limit")) found = found.slice(offset, offset + Number(params.get("limit")));
    found = withEmbeds(name, found, select);
    const range = { "Content-Range": `0-${Math.max(0, found.length - 1)}/${total}` };
    if (method === "HEAD") return new Response(null, { status: 200, headers: range });
    return single(found, accept) ?? respond(found, { headers: range });
  }

  if (method === "POST") {
    const incoming = (Array.isArray(body) ? body : [body]).map((row) => stamp(name, row));
    const upsert = prefer.includes("resolution=merge-duplicates") || prefer.includes("resolution=ignore-duplicates");
    const written = [];
    for (const row of incoming) {
      const existing = rows.findIndex((item) => sameKey(name, item, row));
      if (existing >= 0) {
        if (!upsert) return fail(409, "23505", "duplicate key value violates unique constraint");
        if (prefer.includes("ignore-duplicates")) continue;
        rows[existing] = { ...rows[existing], ...row, id: rows[existing].id ?? row.id, created_at: rows[existing].created_at };
        written.push(rows[existing]);
      } else {
        rows.push(row);
        written.push(row);
      }
    }
    save();
    if (!prefer.includes("return=representation")) return new Response(null, { status: 201 });
    const out = withEmbeds(name, written, select);
    return single(out, accept) ?? respond(out, { status: 201 });
  }

  if (method === "PATCH") {
    const changed = [];
    rows.forEach((row, index) => {
      if (!match(row)) return;
      rows[index] = { ...row, ...body, updated_at: now() };
      if (name === "suggestions" && body.reply !== undefined) rows[index].replied_at = body.reply ? now() : null;
      changed.push(rows[index]);
    });
    save();
    if (!prefer.includes("return=representation")) return new Response(null, { status: 204 });
    return single(changed, accept) ?? respond(changed);
  }

  if (method === "DELETE") {
    const removed = rows.filter(match);
    load()[name] = rows.filter((row) => !match(row));
    // Cascade the children the app relies on.
    if (name === "polls") for (const row of removed) {
      load().poll_options = table("poll_options").filter((item) => item.poll_id !== row.id);
      load().poll_votes = table("poll_votes").filter((item) => item.poll_id !== row.id);
    }
    if (name === "notes") for (const row of removed) load().note_revisions = table("note_revisions").filter((item) => item.note_id !== row.id);
    if (name === "assignments") for (const row of removed) load().assignment_attachments = table("assignment_attachments").filter((item) => item.assignment_id !== row.id);
    save();
    if (!prefer.includes("return=representation")) return new Response(null, { status: 204 });
    return respond(removed);
  }
  return fail(405, "method");
}

// ---------------------------------------------------------------- RPC

const almatyDate = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Almaty" }).format(new Date());
const norm = (text) => String(text ?? "").toLowerCase().replace(/[әіңғүұқөһё]/g, (ch) => ({ ә: "а", і: "и", ң: "н", ғ: "г", ү: "у", ұ: "у", қ: "к", ө: "о", һ: "х", ё: "е" })[ch]);

function engagement(photoIds) {
  return photoIds.map((photoId) => ({
    photo_id: photoId,
    reactions: table("photo_reactions").filter((row) => row.photo_id === photoId).length,
    comments: table("photo_comments").filter((row) => row.photo_id === photoId).length,
  }));
}

const myTeacher = () => load().teachers.find((row) => row.user_id === DEMO_USER_ID) ?? null;
function myCourseIds() {
  const teacher = myTeacher();
  if (!teacher) return null; // admin: all courses
  return load().course_teachers.filter((row) => row.teacher_id === teacher.id).map((row) => row.course_id);
}

function scheduleRows() {
  const db = load();
  const allowed = myCourseIds();
  return db.schedule_entries
    .filter((e) => !allowed || allowed.includes(e.course_id))
    .map((e) => {
      const course = db.courses.find((c) => c.id === e.course_id);
      return { id: e.id, course_id: e.course_id, course_code: course?.code, course_name: course?.name, hue: course?.hue, weekday: e.weekday, start_time: e.start_time, end_time: e.end_time, room: e.room, session_type: e.session_type, group_no: e.group_no };
    })
    .sort((a, b) => a.weekday - b.weekday || a.start_time.localeCompare(b.start_time));
}
const officialRows = () => table("official_attendance");

const RPC = {
  touch_presence: () => null,
  teacher_me: () => {
    const teacher = myTeacher();
    if (!teacher) return null;
    const db = load();
    return {
      id: teacher.id,
      full_name: teacher.full_name,
      login_code: teacher.login_code,
      courses: myCourseIds().map((id) => db.courses.find((c) => c.id === id)).map(({ id, slug, code, name, hue }) => ({ id, slug, code, name, hue })),
    };
  },
  teacher_announce: ({ p_title, p_body, p_group_no }) => {
    const teacher = myTeacher();
    const row = { id: uuid(), title: p_title, body: p_body || null, group_no: p_group_no, pinned: false, author_id: null, author_name: teacher?.full_name, author_role: "teacher", created_at: now(), updated_at: now() };
    table("announcements").push(row);
    save();
    return row.id;
  },
  teacher_my_announcements: () => table("announcements").filter((row) => row.author_role === "teacher" && row.author_name === myTeacher()?.full_name).reverse(),
  teacher_schedule: () => scheduleRows(),
  teacher_roll: ({ p_entry, p_date }) => {
    const db = load();
    const entry = db.schedule_entries.find((e) => e.id === p_entry);
    return db.students
      .filter((s) => !entry?.group_no || s.group_no === entry.group_no)
      .map((s) => {
        const mark = officialRows().find((a) => a.schedule_entry_id === p_entry && a.session_date === p_date && a.student_id === s.id);
        return { student_id: s.id, code: s.code, full_name: s.full_name, group_no: s.group_no, status: mark?.status ?? null, method: mark?.method ?? null, updated_at: mark?.updated_at ?? null };
      })
      .sort((a, b) => a.full_name.localeCompare(b.full_name));
  },
  teacher_mark: ({ p_entry, p_date, p_marks }) => {
    const rows = officialRows();
    for (const mark of p_marks) {
      const index = rows.findIndex((a) => a.schedule_entry_id === p_entry && a.session_date === p_date && a.student_id === mark.student_id);
      if (!mark.status) {
        if (index >= 0) rows.splice(index, 1);
      } else if (index >= 0) Object.assign(rows[index], { status: mark.status, method: "teacher", updated_at: now() });
      else rows.push({ schedule_entry_id: p_entry, session_date: p_date, student_id: mark.student_id, status: mark.status, method: "teacher", updated_at: now() });
    }
    save();
    return p_marks.length;
  },
  teacher_course_stats: ({ p_course }) => {
    const db = load();
    const entries = db.schedule_entries.filter((e) => e.course_id === p_course).map((e) => e.id);
    return db.students.map((s) => {
      const mine = officialRows().filter((a) => a.student_id === s.id && entries.includes(a.schedule_entry_id));
      const count = (status) => mine.filter((a) => a.status === status).length;
      return { student_id: s.id, code: s.code, full_name: s.full_name, group_no: s.group_no, present: count("present"), late: count("late"), absent: count("absent"), excused: count("excused"), lessons: mine.length };
    });
  },
  teacher_course_sheet: ({ p_course }) => {
    const db = load();
    return officialRows()
      .map((a) => ({ a, e: db.schedule_entries.find((e) => e.id === a.schedule_entry_id) }))
      .filter(({ e }) => e?.course_id === p_course)
      .map(({ a, e }) => ({ session_date: a.session_date, start_time: e.start_time, group_no: e.group_no, student_id: a.student_id, status: a.status }));
  },
  teacher_open_checkin: () => "demo-checkin",
  teacher_checkin_status: () => {
    const window = Math.floor(Date.now() / 20000);
    return { open: true, code: String((window * 7919) % 1000000).padStart(6, "0"), seconds_left: 20 - (Math.floor(Date.now() / 1000) % 20), expires_at: now(), checked_in: ["Аружан", "Нұрлан", "Дильназ"] };
  },
  teacher_close_checkin: () => null,
  my_open_checkins: () => [],
  my_official_attendance: () => {
    const db = load();
    return officialRows()
      .filter((a) => a.student_id === me().id)
      .map((a) => {
        const e = db.schedule_entries.find((x) => x.id === a.schedule_entry_id);
        return { schedule_entry_id: a.schedule_entry_id, course_id: e?.course_id, session_date: a.session_date, start_time: e?.start_time, status: a.status, method: a.method };
      });
  },
  student_checkin: () => ({ ok: false, error: "wrong_code" }),
  admin_teacher_accounts: () =>
    load().teachers.map((t, index) => ({
      id: t.id, full_name: t.full_name, login_code: `9${index + 1}`, activated: index < 4, activated_at: index < 4 ? now() : null,
      last_seen: index < 4 ? new Date(Date.now() - index * 5_400_000).toISOString() : null, online: index === 0, days_7: index < 4 ? 4 - index : 0, days_30: index < 4 ? 12 - index * 2 : 0,
      minutes_7: index < 4 ? 60 - index * 12 : 0, open_code_expires_at: null,
      courses: load().course_teachers.filter((ct) => ct.teacher_id === t.id).map((ct) => load().courses.find((c) => c.id === ct.course_id)?.name),
      lessons_marked: index < 4 ? 6 - index : 0, last_marked: index < 4 ? new Date(Date.now() - 86400000 * (index + 1)).toISOString() : null,
    })),
  admin_issue_teacher_code: ({ p_teacher_id }) => {
    const index = load().teachers.findIndex((t) => t.id === p_teacher_id);
    return { code: "DEMO-4321", expires_at: new Date(Date.now() + 3 * 86400000).toISOString(), login_code: `9${index + 1}` };
  },
  mark_seen: ({ p_area }) => {
    load().seen[p_area] = 0;
    save();
    return null;
  },
  unread_counts: () => Object.entries(load().seen).filter(([, n]) => n > 0).map(([area, unread]) => ({ area, unread })),
  complete_onboarding: () => {
    const rows = table("onboarding_done");
    if (!rows.length) rows.push({ student_id: me().id, done_at: now() });
    else rows[0].done_at = now();
    save();
    return null;
  },
  set_notification_pref: ({ p_key, p_on }) => {
    table("notification_prefs")[0][p_key] = p_on;
    save();
    return null;
  },
  push_public_key: () => null,
  push_subscribe: () => null,
  class_birthdays: () => load().students.filter((row) => row.birth_month).map(({ code, full_name, birth_month, birth_day }) => ({ code, full_name, birth_month, birth_day })),
  class_roster: () => load().students.map(({ code, full_name, group_no }) => ({ code, full_name, group_no })),
  student_display_name: ({ p_code }) => load().students.find((row) => row.code === p_code)?.full_name ?? null,
  birthday_wall: ({ p_code }) => {
    const person = load().students.find((row) => row.code === p_code);
    return table("birthday_wishes")
      .filter((row) => row.student_id === person?.id)
      .map((row) => ({ id: row.id, author_name: row.author_name, emoji: row.emoji, body: row.body, created_at: row.created_at, mine: row.author_id === me().id }));
  },
  send_birthday_wish: ({ p_code, p_emoji, p_body }) => {
    const person = load().students.find((row) => row.code === p_code);
    const wishes = table("birthday_wishes");
    const mine = wishes.find((row) => row.student_id === person.id && row.author_id === me().id);
    if (mine) Object.assign(mine, { emoji: p_emoji, body: p_body, created_at: now() });
    else wishes.push({ id: uuid(), student_id: person.id, wish_year: new Date().getFullYear(), author_id: me().id, author_name: me().full_name, emoji: p_emoji, body: p_body, created_at: now() });
    save();
    return null;
  },
  photo_engagement: () => engagement(table("course_photos").map((row) => row.id)),
  weekly_top_photos: ({ p_limit = 6 }) =>
    engagement(table("course_photos").filter((row) => row.uploaded).map((row) => row.id))
      .filter((row) => row.reactions + row.comments > 0)
      .sort((a, b) => b.reactions * 2 + b.comments - (a.reactions * 2 + a.comments))
      .slice(0, p_limit),
  poll_results: () => {
    const db = load();
    return db.poll_options.map((option) => {
      const poll = db.polls.find((row) => row.id === option.poll_id);
      const votes = db.poll_votes.filter((row) => row.option_id === option.id);
      const voters = new Set(db.poll_votes.filter((row) => row.poll_id === option.poll_id).map((row) => row.student_id));
      return {
        poll_id: option.poll_id,
        option_id: option.id,
        votes: votes.length,
        voters: poll?.anonymous ? null : votes.map((row) => db.students.find((student) => student.id === row.student_id)?.full_name).filter(Boolean),
        total_voters: voters.size,
      };
    });
  },
  set_attendance: ({ p_entry, p_date, p_status }) => {
    const rows = table("attendance_marks");
    const key = { student_id: me().id, schedule_entry_id: p_entry, session_date: p_date };
    const existing = rows.find((row) => sameKey("attendance_marks", row, key));
    if (existing) Object.assign(existing, { status: p_status, updated_at: now() });
    else rows.push({ ...key, status: p_status, updated_at: now() });
    save();
    return null;
  },
  search_all: ({ p_query }) => {
    const q = norm(p_query).trim();
    if (q.length < 2) return [];
    const db = load();
    const hit = (...parts) => norm(parts.join(" ")).includes(q);
    const out = [];
    const add = (kind, row, title, body, course_id = null, created_at = row.created_at) => out.push({ kind, id: row.id, title, body, course_id, group_no: row.group_no ?? null, created_at });
    db.courses.filter((r) => hit(r.name, r.code, r.teacher)).forEach((r) => add("course", r, r.name, [r.code, r.teacher].join(" · "), r.id));
    db.assignments.filter((r) => hit(r.title, r.description)).forEach((r) => add("task", r, r.title, r.description, r.course_id));
    db.notes.filter((r) => hit(r.title, r.body)).forEach((r) => add("note", r, r.title, r.body.slice(0, 300), r.course_id, r.updated_at));
    db.course_materials.filter((r) => hit(r.title, r.description, r.file_name)).forEach((r) => add("material", r, r.title, r.description ?? r.file_name, r.course_id));
    db.teachers.filter((r) => hit(r.full_name, r.position, r.office)).forEach((r) => add("teacher", r, r.full_name, [r.position, r.office].filter(Boolean).join(" · ")));
    db.announcements.filter((r) => hit(r.title, r.body)).forEach((r) => add("announcement", r, r.title, r.body));
    db.polls.filter((r) => hit(r.question, r.details)).forEach((r) => add("poll", r, r.question, r.details));
    db.course_photos.filter((r) => r.caption && hit(r.caption)).forEach((r) => add("photo", r, r.caption, r.uploader_name, r.course_id));
    return out;
  },
  save_note: ({ p_id, p_course, p_title, p_body, p_lesson_date, p_base_version }) => {
    const notes = table("notes");
    const student = me();
    let note;
    if (!p_id) {
      note = { id: uuid(), course_id: p_course, title: p_title, body: p_body ?? "", lesson_date: p_lesson_date, version: 1, created_by: student.id, creator_name: student.full_name, updated_by: student.id, updated_by_name: student.full_name, created_at: now(), updated_at: now() };
      notes.push(note);
    } else {
      note = notes.find((row) => row.id === p_id);
      if (!note) throw Object.assign(new Error("not_found"), { code: "P0002" });
      if (note.version !== p_base_version) throw Object.assign(new Error("conflict"), { code: "40001" });
      Object.assign(note, { course_id: p_course, title: p_title, body: p_body ?? "", lesson_date: p_lesson_date, version: note.version + 1, updated_by: student.id, updated_by_name: student.full_name, updated_at: now() });
    }
    table("note_revisions").push({ id: Date.now(), note_id: note.id, version: note.version, title: note.title, body: note.body, edited_by: student.id, editor_name: student.full_name, created_at: now() });
    save();
    return [{ id: note.id, version: note.version }];
  },
  make_draw: ({ p_title, p_mode, p_amount, p_codes, p_extra }) => {
    const names = [...load().students.filter((row) => (p_codes ?? []).includes(row.code)).map((row) => row.full_name), ...(p_extra ?? []).map((name) => name.trim()).filter(Boolean)];
    if (names.length < 2) throw Object.assign(new Error("bad_pool"), { code: "22023" });
    const shuffled = names.map((name) => [Math.random(), name]).sort((a, b) => a[0] - b[0]).map(([, name]) => name);
    let result;
    if (p_mode === "groups") {
      result = Array.from({ length: p_amount }, () => []);
      shuffled.forEach((name, index) => result[index % p_amount].push(name));
    } else if (p_mode === "pick") result = shuffled.slice(0, p_amount);
    else result = shuffled;
    const row = { id: uuid(), title: p_title, mode: p_mode, amount: p_mode === "order" ? names.length : p_amount, pool: names, result, created_by: me().id, creator_name: me().full_name, created_at: now() };
    table("draws").push(row);
    save();
    return row.id;
  },
  my_badges: () => {
    const db = load();
    const id = me().id;
    const myPhotos = db.course_photos.filter((row) => row.uploaded_by === id);
    return [
      ["welcome", 1, 1],
      ["photographer", myPhotos.length, 10],
      ["star", db.photo_reactions.filter((row) => myPhotos.some((photo) => photo.id === row.photo_id) && row.student_id !== id).length, 30],
      ["talker", db.photo_comments.filter((row) => row.student_id === id).length, 20],
      ["voter", new Set(db.poll_votes.filter((row) => row.student_id === id).map((row) => row.poll_id)).size, 5],
      ["doer", db.assignment_status.filter((row) => row.student_id === id).length, 15],
      ["early", 1, 5],
      ["streak", 3, 7],
      ["regular", 12, 30],
      ["notes", db.note_revisions.filter((row) => row.edited_by === id).length, 5],
      ["kind", db.birthday_wishes.filter((row) => row.author_id === id).length, 3],
      ["translator", db.translations.filter((row) => row.student_id === id).length, 5],
      ["helper", db.assignments.filter((row) => row.created_by === id).length + db.course_materials.filter((row) => row.uploaded_by === id).length, 5],
    ].map(([badge, progress, goal]) => ({ badge, progress, goal }));
  },
  admin_suggestion_author: ({ p_id }) => {
    const row = table("suggestions").find((item) => item.id === p_id);
    const author = load().students.find((student) => student.id === row?.author_id);
    return author ? `${author.full_name} (${author.code})` : null;
  },
  admin_list_students: () => load().students.map(({ code, full_name, group_no, role, is_monitor, birth_month, birth_day, activated_at }) => ({ code, full_name, group_no, role, is_monitor, birth_month, birth_day, activated_at })),
  admin_list_accounts: () => load().students.map(({ code, full_name, group_no, role, activated_at }) => ({ code, full_name, group_no, role, activated_at, open_code_purpose: null, open_code_expires_at: null })),
  admin_issue_account_code: () => ({ code: "DEMO-1234", expires_at: new Date(Date.now() + 86400000).toISOString() }),
  admin_update_student: ({ p_code, p_full_name, p_group_no, p_birth_month, p_birth_day, p_is_monitor }) => {
    const row = load().students.find((student) => student.code === p_code);
    if (row) Object.assign(row, { full_name: p_full_name, group_no: p_group_no, birth_month: p_birth_month, birth_day: p_birth_day, is_monitor: p_is_monitor });
    save();
    return null;
  },
  admin_storage_usage: () => [{ bytes: 18_500_000, files: 14, photos: load().course_photos.length }],
  admin_presence: () => {
    const today = almatyDate();
    return load().students.map((row, index) => ({
      code: row.code,
      full_name: row.full_name,
      group_no: row.group_no,
      activated: Boolean(row.activated_at),
      last_seen: row.activated_at ? new Date(Date.now() - index * 3_600_000 * 3).toISOString() : null,
      online: index === 0 || index === 4,
      days_7: row.activated_at ? 7 - (index % 5) : 0,
      days_30: row.activated_at ? 28 - index : 0,
      minutes_7: row.activated_at ? 140 - index * 6 : 0,
      minutes_today: index < 6 ? 25 - index * 3 : 0,
      last_14: Array.from({ length: 14 }, (_, day) => (row.activated_at && (day + index) % 3 ? 10 + ((day * index) % 30) : 0)),
      today,
    }));
  },
  admin_dashboard: () => {
    const db = load();
    return {
      students: db.students.length,
      activated: db.students.filter((row) => row.activated_at).length,
      announcements: db.announcements.length,
      not_activated: db.students.filter((row) => !row.activated_at).map(({ code, full_name, group_no }) => ({ code, full_name, group_no })),
      assignments: db.assignments.map((row) => ({
        id: row.id, title: row.title, course_id: row.course_id, due_at: row.due_at, group_no: row.group_no,
        done: db.assignment_status.filter((item) => item.assignment_id === row.id).length + 4,
        target: db.students.filter((student) => row.group_no === null || student.group_no === row.group_no).length,
      })),
      courses: db.courses.map((course) => ({
        course_id: course.id,
        photos: db.course_photos.filter((row) => row.course_id === course.id).length,
        materials: db.course_materials.filter((row) => row.course_id === course.id).length,
        assignments: db.assignments.filter((row) => row.course_id === course.id).length,
      })),
    };
  },
};

// ---------------------------------------------------------------- functions, auth, storage

const DEMO_TRANSLATION = (text) =>
  `# Демо аударма\n\nДемо нұсқада нақты AI қосылмаған — мұнда тек үлгі көрсетіледі. Нағыз ULPA-да осы жерде мәтіннің қазақша аудармасы шығады.\n\n- Формулалар сақталады: \`F = m·a\`\n- Тақырыптар мен тізімдер сақталады\n\n${text ? `> Сен жіберген мәтін: ${text.slice(0, 160)}…` : ""}`;

async function functions(name, body) {
  if (name === "translate") {
    await new Promise((resolve) => setTimeout(resolve, 900));
    const result = DEMO_TRANSLATION(body?.text ?? "");
    const row = { id: uuid(), student_id: me().id, source_kind: body?.image ? "image" : "text", result, created_at: now() };
    table("translations").push(row);
    save();
    return respond({ id: row.id, created_at: row.created_at, result, remaining: 14, truncated: false });
  }
  if (name === "push-send") return respond({ devices: 0, sent: 0, gone: 0, failed: 0 });
  return respond({ error: "demo" }, { status: 400 });
}

function demoUser() {
  return { id: DEMO_USER_ID, aud: "authenticated", role: "authenticated", email: "demo@ulpa.local", app_metadata: {}, user_metadata: { name: DEMO_NAME } };
}

async function readBody(init) {
  const body = init?.body;
  if (body === undefined || body === null) return null;
  if (typeof body === "string") {
    try {
      return JSON.parse(body);
    } catch {
      return body;
    }
  }
  return body; // Blob / File / FormData (storage uploads)
}

/** fetch() replacement for the demo Supabase client. */
export async function demoFetch(input, init = {}) {
  const url = new URL(typeof input === "string" ? input : input.url);
  const method = (init.method ?? (typeof input === "string" ? "GET" : input.method) ?? "GET").toUpperCase();
  const headers = new Headers(init.headers ?? (typeof input === "string" ? undefined : input.headers));
  const path = url.pathname;
  try {
    if (path.startsWith("/rest/v1/rpc/")) {
      const name = path.slice("/rest/v1/rpc/".length);
      const handler = RPC[name];
      if (!handler) return respond(null);
      const args = method === "GET" ? Object.fromEntries(url.searchParams) : (await readBody(init)) ?? {};
      return respond(handler(args) ?? null);
    }
    if (path.startsWith("/rest/v1/")) {
      return rest(path.slice("/rest/v1/".length), method, url.searchParams, await readBody(init), headers);
    }
    if (path.startsWith("/functions/v1/")) return functions(path.slice("/functions/v1/".length), await readBody(init));
    if (path.startsWith("/auth/v1/")) {
      if (path.endsWith("/user")) return respond(demoUser());
      if (path.endsWith("/logout")) return new Response(null, { status: 204 });
      return respond({ error: "demo", error_description: "Демо режимде қолжетімсіз" }, { status: 400 });
    }
    if (path.startsWith("/storage/v1/object/")) {
      const objectPath = decodeURIComponent(path.slice("/storage/v1/object/".length));
      if ((method === "POST" || method === "PUT") && !objectPath.startsWith("sign/")) {
        const [, ...rest] = objectPath.split("/");
        const body = init.body;
        if (body instanceof Blob) rememberDemoUpload(rest.join("/"), body);
        else if (body instanceof FormData) {
          const file = [...body.values()].find((value) => value instanceof Blob);
          if (file) rememberDemoUpload(rest.join("/"), file);
        }
        return respond({ Key: objectPath, Id: uuid() });
      }
      if (method === "DELETE") return respond([]);
      return respond([]);
    }
    return respond({ error: "not_in_demo" }, { status: 404 });
  } catch (error) {
    return fail(400, error.code ?? "demo_error", error.message);
  }
}
