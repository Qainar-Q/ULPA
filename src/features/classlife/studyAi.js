import { supabase } from "../../lib/supabase.js";

// Study helpers on the server (Edge Function "study-ai"). The server checks that the
// student may see the photo / notes, and counts a daily limit.

async function call(body) {
  const { data, error } = await supabase.functions.invoke("study-ai", { body });
  if (error) {
    let code = "network";
    try {
      const payload = await error.context?.json?.();
      if (payload?.error) code = payload.error;
    } catch {
      /* not JSON */
    }
    throw new Error(code);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

/** Blackboard photo → { title, body, course_id, lesson_date, remaining }. */
export const photoToNote = (photoId) => call({ action: "photo_note", photoId });

/** Read the text on a photo so search can find it (fire and forget after upload). */
export const indexPhoto = (photoId) => call({ action: "photo_index", photoId });

/** Practice questions from a course's notes: { questions: [{ q, options[4], answer, explain }], remaining }. */
export const makeQuiz = (courseId, count = 5) => call({ action: "quiz", courseId, count });

export const AI_ERRORS = {
  limit: "Бүгінгі AI лимиті бітті (күніне 10 рет). Ертең қайта көр.",
  class_limit: "Бүгін бүкіл топтың AI лимиті бітті. Ертең қайта көр.",
  busy: "AI қазір бос емес. Бір минуттан кейін қайта көр.",
  no_notes: "Бұл пән бойынша конспект әлі аз. Алдымен конспект қосыңдар.",
  no_text: "Суреттен оқу мәтіні табылмады.",
  not_found: "Фото табылмады.",
  not_configured: "AI әзірге қосылмаған.",
  network: "Интернетті тексер.",
};
export const aiErrorText = (code) => AI_ERRORS[code] ?? "Болмады. Қайта көр.";
