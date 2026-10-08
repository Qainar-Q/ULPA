// Achievement badges. Progress comes from public.my_badges() (server-side counts).
export const BADGES = {
  welcome: { emoji: "🚀", name: "Алғашқы қадам", text: "ULPA-ға қосылдың" },
  photographer: { emoji: "📸", name: "Фотограф", text: "10 фото жүкте" },
  star: { emoji: "⭐", name: "Жұлдыз", text: "Фотоларың 30 реакция жинасын" },
  talker: { emoji: "💬", name: "Сөзшең", text: "20 пікір жаз" },
  voter: { emoji: "🗳", name: "Белсенді азамат", text: "5 сауалнамаға дауыс бер" },
  doer: { emoji: "✅", name: "Тапсырма шебері", text: "15 тапсырманы орында" },
  early: { emoji: "🐦", name: "Ерте құс", text: "5 тапсырманы мерзімінен бір күн бұрын бітір" },
  streak: { emoji: "🔥", name: "Апталық серия", text: "7 күн қатарынан кір" },
  regular: { emoji: "📅", name: "Тұрақты қонақ", text: "30 түрлі күні кір" },
  notes: { emoji: "📝", name: "Конспектші", text: "Конспектілерді 5 рет толықтыр" },
  kind: { emoji: "🎂", name: "Мейірімді", text: "3 сыныптасыңды туған күнімен құттықта" },
  translator: { emoji: "🌐", name: "Аудармашы", text: "5 бетті қазақшаға аудар" },
  helper: { emoji: "🤝", name: "Көмекші", text: "Тапсырма не материал 5 рет жарияла" },
};

export const isEarned = (row) => row.progress >= row.goal;

const SEEN_KEY = "ulpa-badges-seen";
export function seenBadges() {
  try {
    return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]"));
  } catch {
    return new Set();
  }
}
export function rememberBadges(ids) {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify([...ids]));
  } catch {
    /* storage unavailable */
  }
}
