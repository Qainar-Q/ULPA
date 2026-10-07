import { supabase } from "./supabase.js";

// Web Push on this device. The server (Edge Function "push-send") decides who
// receives what; this file only registers/unregisters the device.

export function pushSupport() {
  const hasApis = typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone = window.matchMedia?.("(display-mode: standalone)").matches || navigator.standalone === true;
  if (hasApis) return { supported: true, ios, standalone };
  // iPhone only offers push to apps added to the Home Screen.
  return { supported: false, ios, standalone, needsInstall: ios && !standalone };
}

function keyToBytes(base64url) {
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((base64url.length + 3) % 4);
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}

async function registration() {
  return navigator.serviceWorker.ready;
}

export async function currentSubscription() {
  if (!pushSupport().supported) return null;
  const reg = await registration();
  return reg.pushManager.getSubscription();
}

async function saveSubscription(subscription) {
  const json = subscription.toJSON();
  const { error } = await supabase.rpc("push_subscribe", {
    p_endpoint: json.endpoint,
    p_p256dh: json.keys.p256dh,
    p_auth: json.keys.auth,
    p_user_agent: navigator.userAgent,
  });
  if (error) throw error;
}

/** Must be called from a tap (the permission prompt needs a user gesture on iPhone). */
export async function enablePush() {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission; // "denied" | "default"
  const { data: publicKey, error } = await supabase.rpc("push_public_key");
  if (error || !publicKey) throw error ?? new Error("no_key");
  const reg = await registration();
  let subscription = await reg.pushManager.getSubscription();
  if (!subscription) {
    subscription = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(publicKey) });
  }
  await saveSubscription(subscription);
  return "granted";
}

export async function disablePush() {
  const subscription = await currentSubscription();
  if (!subscription) return;
  await supabase.from("push_subscriptions").delete().eq("endpoint", subscription.endpoint);
  await subscription.unsubscribe().catch(() => {});
}

/** On app start: make sure this device's subscription belongs to whoever is signed in now. */
export async function syncPush() {
  try {
    if (!pushSupport().supported || Notification.permission !== "granted") return;
    const subscription = await currentSubscription();
    if (subscription) await saveSubscription(subscription);
  } catch {
    /* best effort */
  }
}

export async function sendTestPush() {
  const { data, error } = await supabase.functions.invoke("push-send", { body: { type: "test" } });
  if (error) throw error;
  return data;
}

export const PREF_LABELS = [
  { key: "tasks", label: "Жаңа тапсырмалар" },
  { key: "deadlines", label: "Мерзімі жақындаған тапсырмалар (кешкі 20:00)" },
  { key: "announcements", label: "Хабарландырулар" },
  { key: "polls", label: "Жаңа сауалнамалар" },
  { key: "comments", label: "Менің фотоларыма және пікірлеріме жауап" },
];

export async function loadPrefs() {
  const { data } = await supabase.from("notification_prefs").select("tasks, announcements, polls, comments, deadlines").maybeSingle();
  return data ?? { tasks: true, announcements: true, polls: true, comments: true, deadlines: true };
}

export async function savePref(key, on) {
  const { error } = await supabase.rpc("set_notification_pref", { p_key: key, p_on: on });
  if (error) throw error;
}
