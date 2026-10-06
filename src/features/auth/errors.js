// Every auth error the user can see, in Kazakh. Keys are internal error codes.
export const AUTH_ERRORS = {
  invalid_credentials: "Код немесе құпия сөз қате.",
  code_format: "Студент коды 01-ден 18-ге дейінгі сан болуы керек.",
  invalid_code: "Белсендіру коды қате немесе мерзімі өткен.",
  code_locked: "Қате әрекет тым көп болды. Әкімшіден жаңа код сұра.",
  weak_password: "Құпия сөз кемінде 8 таңбадан тұруы керек.",
  password_mismatch: "Құпия сөздер сәйкес келмейді.",
  rate_limited: "Әрекет тым көп. Бір минут күтіп, қайта көр.",
  network: "Желі қатесі. Интернет байланысын тексеріп, қайта көр.",
  not_linked: "Аккаунт студент тізімімен байланыспаған. Әкімшіге хабарлас.",
  session_expired: "Сессия аяқталды. Қайта кір.",
  forbidden: "Бұл әрекетке рұқсатың жоқ.",
  server_error: "Сервер қатесі. Біраз уақыттан кейін қайта көр.",
  passkey_disabled: "Face ID / саусақ ізімен кіру әлі қосылмаған.",
  passkey_unknown: "Бұл құрылғыда тіркелген кілт табылмады. Алдымен кодпен кіріп, профильде Face ID-ді қос.",
  passkey_cancelled: "Тексеру тоқтатылды.",
  passkey_unsupported: "Бұл браузер Face ID / саусақ ізін қолдамайды.",
};

export function authErrorMessage(code) {
  return AUTH_ERRORS[code] ?? AUTH_ERRORS.server_error;
}

/** Map a Supabase auth error to one of our codes. */
export function classifyAuthError(error) {
  if (!error) return null;
  const message = String(error.message ?? "").toLowerCase();
  if (error.status === 429 || message.includes("rate limit")) return "rate_limited";
  if (error.status === 400 || message.includes("invalid login")) return "invalid_credentials";
  if (message.includes("fetch") || message.includes("network")) return "network";
  return "server_error";
}

/** Map a passkey (WebAuthn) error to one of our codes. */
export function classifyPasskeyError(error) {
  const code = String(error?.code ?? error?.error_code ?? "");
  const name = String(error?.name ?? "");
  const message = String(error?.message ?? "").toLowerCase();
  if (code === "passkey_disabled") return "passkey_disabled";
  if (code === "webauthn_credential_not_found") return "passkey_unknown";
  if (name === "NotAllowedError" || code.includes("ABORT") || message.includes("cancel") || message.includes("not allowed")) {
    return "passkey_cancelled";
  }
  if (message.includes("not supported")) return "passkey_unsupported";
  return "server_error";
}
