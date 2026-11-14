// Connects the personal hub to ULPA's Supabase: same login as kainar.online (code 01 only).
(function(){
  "use strict";
  const URL_ = "https://lxrjogpmmatpuzellnyu.supabase.co";
  const KEY = "sb_publishable_fnfShtPMuOUc2g3CNX-ydA_PAob-rU6";
  const HUB = window.HUB = { sb: null, uid: null };
  const lang = (()=>{ try{ const s=JSON.parse(localStorage.getItem("efficiency-hub-v1")||"{}"); return (s.settings&&s.settings.lang)||"zh"; }catch(e){ return "zh"; } })();
  const T = {
    zh:{wait:"正在连接…",login:"登录",loginBtn:"登录",loginHint:"登录一次以后会一直记住",pw:"密码",user:"用户名",bad:"密码不对，再试一次",priv:"这个账号没有开通，请找 Қайнар",privHint:"只有页面主人可以使用。",home:"回到 ULPA",off:"连不上服务器，请检查网络后刷新。",retry:"刷新"},
    en:{wait:"Connecting…",login:"Sign in",loginBtn:"Sign in",loginHint:"You stay signed in after this.",pw:"Password",user:"Username",bad:"Wrong password, try again",priv:"This account has no access. Ask Kainar.",privHint:"Only its owner can use it.",home:"Back to ULPA",off:"Can't reach the server. Check your connection and refresh.",retry:"Refresh"},
    kk:{wait:"Қосылуда…",login:"Кіру",loginBtn:"Кіру",loginHint:"Бір рет кірсеңіз, есте сақталады.",pw:"Құпиясөз",user:"Пайдаланушы аты",bad:"Құпиясөз қате, қайталаңыз",priv:"Бұл аккаунтқа рұқсат жоқ. Қайнарға жазыңыз.",privHint:"Тек иесі ғана қолдана алады.",home:"ULPA-ға оралу",off:"Серверге қосылу мүмкін емес. Интернетті тексеріп, жаңартыңыз.",retry:"Жаңарту"}
  }[lang] || {};
  const gate = (title, hint, btn, href) => {
    const g = document.getElementById("gate");
    g.innerHTML = `<div class="gate-in"><svg class="gate-logo" viewBox="0 0 100 100"><circle cx="50" cy="50" r="42" fill="none" stroke="#5b8cff" stroke-width="9" stroke-dasharray="200 300" stroke-linecap="round" transform="rotate(-90 50 50)"/><circle cx="50" cy="50" r="29" fill="none" stroke="#ff5a5f" stroke-width="9" stroke-dasharray="120 300" stroke-linecap="round" transform="rotate(-90 50 50)"/><circle cx="50" cy="50" r="16" fill="none" stroke="#3ddc97" stroke-width="9" stroke-dasharray="80 300" stroke-linecap="round" transform="rotate(-90 50 50)"/></svg><b>${title}</b><p>${hint||""}</p>${btn?`<a class="go" href="${href}">${btn}</a>`:""}</div>`;
    g.classList.add("on");
  };
  const lastLogin = () => { try { return localStorage.getItem("hub-last-login") || ""; } catch (e) { return ""; } };
  const LOGO = () => document.querySelector("#gate .gate-logo") ? document.querySelector("#gate .gate-logo").outerHTML : "";
  function loginForm(msg){
    const g = document.getElementById("gate"); const logo = LOGO();
    g.innerHTML = `<form class="gate-in" id="hub-login" autocomplete="on">${logo}<b>${T.login}</b><p>${msg?`<span style="color:var(--move)">${msg}</span>`:T.loginHint}</p>
      <input class="field" type="text" id="hub-user" name="username" autocomplete="username" autocapitalize="none" spellcheck="false" placeholder="${T.user}" value="${lastLogin()}" required style="margin-bottom:8px;text-align:center">
      <input class="field" type="password" id="hub-pw" name="password" autocomplete="current-password" placeholder="${T.pw}" required style="margin-bottom:12px;text-align:center">
      <button class="go" type="submit" style="background:var(--study);margin:0">${T.loginBtn}</button></form>`;
    g.classList.add("on");
    const f = document.getElementById("hub-login");
    setTimeout(()=>document.getElementById("hub-pw").focus(), 100);
    f.onsubmit = async (e) => {
      e.preventDefault(); const btn = f.querySelector("button"); btn.disabled = true; btn.textContent = T.wait;
      const login = document.getElementById("hub-user").value.trim().toLowerCase();
      try { localStorage.setItem("hub-last-login", login); } catch (e) {}
      const email = /^\d{2}$/.test(login) ? `s${login}@students.kainar.online` : `${login}@hub.kainar.online`;
      const { error } = await HUB.sb.auth.signInWithPassword({ email, password: document.getElementById("hub-pw").value });
      if (error) { loginForm(T.bad); return; }
      start();
    };
  }
  async function start(){
    gate(T.wait);
    if (!window.supabase) { gate(T.off, "", T.retry, location.href); return; }
    HUB.sb = HUB.sb || window.supabase.createClient(URL_, KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });
    let session = null;
    try { session = (await HUB.sb.auth.getSession()).data.session; } catch (e) {}
    if (!session) { loginForm(); return; }
    const { data: role, error } = await HUB.sb.rpc("hub_role");
    if (error) { gate(T.off, "", T.retry, location.href); return; }
    if (!role) { await HUB.sb.auth.signOut().catch(()=>{}); loginForm(T.priv); return; }
    HUB.uid = session.user.id; HUB.role = role;
    H.useUser(session.user.id, role);
    document.getElementById("gate").classList.remove("on");
    H.boot();
    H.pull();
  }
  start();
})();
