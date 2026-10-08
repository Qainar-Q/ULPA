// ULPA · account-activate
//
// Public endpoint (no login yet — that is the point): a student sends
//   { studentCode: "05", accessCode: "K7QM-4XTP", password: "..." }
// The one-time access code is checked and consumed inside Postgres
// (public.consume_account_code, callable only with the service role).
// If valid, the auth user is created (first activation) or its password is
// replaced (reset). The service-role key exists only here, on the server.
// Teachers use the same flow with their login code (90–99): their code is checked
// against private.teacher_codes and the auth user is linked to public.teachers.

import { createClient } from "npm:@supabase/supabase-js@2";

const ALLOWED_ORIGINS = new Set([
  "https://kainar.online",
  "https://www.kainar.online",
  "https://qainar-q.github.io",
  "http://localhost:5173",
  "http://localhost:4173",
]);

const EMAIL_DOMAIN = "students.kainar.online";
const STUDENT_CODE = /^[0-9]{2}$/;
const MIN_PASSWORD = 8;
const MAX_PASSWORD = 72;

function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = origin && ALLOWED_ORIGINS.has(origin) ? origin : "https://kainar.online";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Vary": "Origin",
  };
}

function reply(origin: string | null, status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");

  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(origin) });
  if (req.method !== "POST") return reply(origin, 405, { ok: false, error: "method_not_allowed" });

  let input: { studentCode?: unknown; accessCode?: unknown; password?: unknown };
  try {
    input = await req.json();
  } catch {
    return reply(origin, 400, { ok: false, error: "bad_request" });
  }

  const studentCode = typeof input.studentCode === "string" ? input.studentCode.trim() : "";
  const accessCode = typeof input.accessCode === "string" ? input.accessCode : "";
  const password = typeof input.password === "string" ? input.password : "";

  if (!STUDENT_CODE.test(studentCode) || accessCode.length < 8 || accessCode.length > 20) {
    return reply(origin, 400, { ok: false, error: "invalid_code" });
  }
  if (password.length < MIN_PASSWORD || password.length > MAX_PASSWORD) {
    return reply(origin, 400, { ok: false, error: "weak_password" });
  }

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return reply(origin, 500, { ok: false, error: "server_misconfigured" });

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Teacher login codes live in public.teachers (90–99).
  const { data: teacher } = await admin.from("teachers").select("id").eq("login_code", studentCode).maybeSingle();
  const isTeacher = Boolean(teacher);

  // 1. Check + consume the one-time code (wrong attempts are counted in the DB).
  const { data: check, error: checkError } = isTeacher
    ? await admin.rpc("consume_teacher_code", { p_login: studentCode, p_code: accessCode })
    : await admin.rpc("consume_account_code", { p_student_code: studentCode, p_code: accessCode });
  if (checkError) {
    console.error("consume_account_code failed", checkError.code);
    return reply(origin, 500, { ok: false, error: "server_error" });
  }
  if (!check?.ok) {
    return reply(origin, 400, { ok: false, error: check?.error ?? "invalid_code" });
  }

  const studentId: string = isTeacher ? check.teacher_id : check.student_id;
  let userId: string | null = check.user_id;
  const email = `s${studentCode}@${EMAIL_DOMAIN}`;

  // 2. Create the auth user on first activation, otherwise replace the password.
  if (!userId) {
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: isTeacher ? { teacher_code: studentCode } : { student_code: studentCode },
    });

    if (createError) {
      // An auth user with this email may exist without being linked (e.g. after a manual fix).
      const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
      const existing = list?.users.find((user) => user.email === email);
      if (!existing) {
        console.error("createUser failed", createError.status);
        return reply(origin, 500, { ok: false, error: "server_error" });
      }
      userId = existing.id;
      const { error: updateError } = await admin.auth.admin.updateUserById(userId, { password });
      if (updateError) {
        console.error("updateUserById failed", updateError.status);
        return reply(origin, 500, { ok: false, error: "server_error" });
      }
    } else {
      userId = created.user.id;
    }
  } else {
    const { error: updateError } = await admin.auth.admin.updateUserById(userId, { password });
    if (updateError) {
      console.error("updateUserById failed", updateError.status);
      return reply(origin, 500, { ok: false, error: "server_error" });
    }
  }

  // 3. Link the student (or teacher) row to the auth user.
  const { error: linkError } = isTeacher
    ? await admin.rpc("finish_teacher_activation", { p_teacher_id: studentId, p_user_id: userId })
    : await admin.rpc("finish_account_activation", { p_student_id: studentId, p_user_id: userId });
  if (linkError) {
    console.error("finish_account_activation failed", linkError.code);
    return reply(origin, 500, { ok: false, error: "server_error" });
  }

  return reply(origin, 200, { ok: true });
});
