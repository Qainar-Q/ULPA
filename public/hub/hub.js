// Connects the personal hub to ULPA's Supabase: same login as kainar.online (code 01 only).
(function(){
  "use strict";
  const URL_ = "https://lxrjogpmmatpuzellnyu.supabase.co";
  const KEY = "sb_publishable_fnfShtPMuOUc2g3CNX-ydA_PAob-rU6";
  const HUB = window.HUB = { sb: null, uid: null };
  const lang = (()=>{ try{ const s=JSON.parse(localStorage.getItem("efficiency-hub-v1")||"{}"); return (s.settings&&s.settings.lang)||"zh"; }catch(e){ return "zh"; } })();
  const T = {
    zh:{wait:"正在连接…",login:"请先登录 ULPA",loginBtn:"去登录",loginHint:"登录后再打开 kainar.online/hub",priv:"这是私人页面",privHint:"只有页面主人可以使用。",home:"回到 ULPA",off:"连不上服务器，请检查网络后刷新。",retry:"刷新"},
    en:{wait:"Connecting…",login:"Sign in to ULPA first",loginBtn:"Sign in",loginHint:"Then open kainar.online/hub again",priv:"This page is private",privHint:"Only its owner can use it.",home:"Back to ULPA",off:"Can't reach the server. Check your connection and refresh.",retry:"Refresh"},
    kk:{wait:"Қосылуда…",login:"Алдымен ULPA-ға кіріңіз",loginBtn:"Кіру",loginHint:"Содан кейін kainar.online/hub ашыңыз",priv:"Бұл жеке бет",privHint:"Тек иесі ғана қолдана алады.",home:"ULPA-ға оралу",off:"Серверге қосылу мүмкін емес. Интернетті тексеріп, жаңартыңыз.",retry:"Жаңарту"}
  }[lang] || {};
  const gate = (title, hint, btn, href) => {
    const g = document.getElementById("gate");
    g.innerHTML = `<div class="gate-in"><svg class="gate-logo" viewBox="0 0 100 100"><circle cx="50" cy="50" r="42" fill="none" stroke="#5b8cff" stroke-width="9" stroke-dasharray="200 300" stroke-linecap="round" transform="rotate(-90 50 50)"/><circle cx="50" cy="50" r="29" fill="none" stroke="#ff5a5f" stroke-width="9" stroke-dasharray="120 300" stroke-linecap="round" transform="rotate(-90 50 50)"/><circle cx="50" cy="50" r="16" fill="none" stroke="#3ddc97" stroke-width="9" stroke-dasharray="80 300" stroke-linecap="round" transform="rotate(-90 50 50)"/></svg><b>${title}</b><p>${hint||""}</p>${btn?`<a class="go" href="${href}">${btn}</a>`:""}</div>`;
    g.classList.add("on");
  };
  async function start(){
    gate(T.wait);
    if (!window.supabase) { gate(T.off, "", T.retry, location.href); return; }
    HUB.sb = window.supabase.createClient(URL_, KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });
    let session = null;
    try { session = (await HUB.sb.auth.getSession()).data.session; } catch (e) {}
    if (!session) { gate(T.login, T.loginHint, T.loginBtn, "/"); return; }
    const { data: ok, error } = await HUB.sb.rpc("hub_is_owner");
    if (error) { gate(T.off, "", T.retry, location.href); return; }
    if (!ok) { gate(T.priv, T.privHint, T.home, "/"); return; }
    HUB.uid = session.user.id;
    document.getElementById("gate").classList.remove("on");
    H.boot();
    H.pull();
  }
  start();
})();
