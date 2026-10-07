import { supabase } from "../../lib/supabase.js";

/** Same folding as the database: case and Kazakh letters (қ→к, ә→а, …). Keeps length 1:1. */
const FOLD = { ә: "а", і: "и", ң: "н", ғ: "г", ү: "у", ұ: "у", қ: "к", ө: "о", һ: "х", ё: "е" };
export function fold(text = "") {
  return Array.from(text.toLowerCase(), (char) => FOLD[char] ?? char).join("");
}

export async function searchAll(query) {
  const { data, error } = await supabase.rpc("search_all", { p_query: query });
  if (error) throw error;
  return data ?? [];
}

/** Split text into [{text, hit}] parts around the first match (for highlighting). */
export function highlight(text, query) {
  if (!text) return [];
  const q = fold(query.trim());
  const index = q ? fold(text).indexOf(q) : -1;
  if (index < 0) return [{ text, hit: false }];
  return [
    { text: text.slice(0, index), hit: false },
    { text: text.slice(index, index + q.length), hit: true },
    { text: text.slice(index + q.length), hit: false },
  ];
}

/** ~140 characters around the match, or the beginning. */
export function snippet(text, query, size = 140) {
  if (!text) return "";
  const clean = text.replace(/\s+/g, " ").trim();
  const index = fold(clean).indexOf(fold(query.trim()));
  if (index < 0 || clean.length <= size) return clean.length > size ? `${clean.slice(0, size)}…` : clean;
  const start = Math.max(0, index - 50);
  const end = Math.min(clean.length, start + size);
  return `${start > 0 ? "…" : ""}${clean.slice(start, end)}${end < clean.length ? "…" : ""}`;
}

const RECENT_KEY = "ulpa-recent-searches";
export function recentSearches() {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]").slice(0, 6);
  } catch {
    return [];
  }
}
export function rememberSearch(query) {
  const value = query.trim();
  if (value.length < 2) return;
  try {
    const next = [value, ...recentSearches().filter((item) => item.toLowerCase() !== value.toLowerCase())].slice(0, 6);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}
export function clearRecentSearches() {
  try {
    localStorage.removeItem(RECENT_KEY);
  } catch {
    /* ignore */
  }
}
