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
