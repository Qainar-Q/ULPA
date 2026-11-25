// Connects the personal hub to ULPA's Supabase: same login as kainar.online (code 01 only).
(function(){
  "use strict";
  const URL_ = "https://lxrjogpmmatpuzellnyu.supabase.co";
  const KEY = "sb_publishable_fnfShtPMuOUc2g3CNX-ydA_PAob-rU6";
  const HUB = window.HUB = { sb: null, uid: null };
  let lang = (()=>{ try{ const s=JSON.parse(localStorage.getItem("efficiency-hub-v1")||"{}"); return (s.settings&&s.settings.lang)||localStorage.getItem("hub-lang")||"kk"; }catch(e){ return "kk"; } })();
  const TT = {
    zh:{wait:"正在连接…",login:"登录",loginBtn:"登录",loginHint:"登录一次以后会一直记住",pw:"密码",user:"用户名",pw2:"再输一次密码",join:"注册",joinT:"创建你的账号",joinHint:"自己设一个用户名（英文字母开头，3–24 位）和密码（至少 8 位）",haveCode:"有邀请码？注册",haveAcc:"已经有账号？登录",code:"邀请码",mism:"两次密码不一样",badCode:"邀请码无效或已经用过了",taken:"这个用户名已经有人用了",badLogin:"用户名要英文字母开头，3–24 位",badPw:"密码至少 8 位",bad:"密码不对，再试一次",priv:"这个账号没有开通，请找 Қайнар",privHint:"只有页面主人可以使用。",home:"回到 ULPA",off:"连不上服务器，请检查网络后刷新。",retry:"刷新"},
    en:{wait:"Connecting…",login:"Sign in",loginBtn:"Sign in",loginHint:"You stay signed in after this.",pw:"Password",user:"Username",pw2:"Repeat password",join:"Sign up",joinT:"Create your account",joinHint:"Pick a username (starts with a letter, 3–24) and a password (8+)",haveCode:"Have an invite code? Sign up",haveAcc:"Have an account? Sign in",code:"Invite code",mism:"Passwords don't match",badCode:"The invite code is invalid or used",taken:"That username is taken",badLogin:"Username: a letter first, 3–24 characters",badPw:"Password needs 8+ characters",bad:"Wrong password, try again",priv:"This account has no access. Ask Kainar.",privHint:"Only its owner can use it.",home:"Back to ULPA",off:"Can't reach the server. Check your connection and refresh.",retry:"Refresh"},
    kk:{wait:"Қосылуда…",login:"Кіру",loginBtn:"Кіру",loginHint:"Бір рет кірсеңіз, есте сақталады.",pw:"Құпиясөз",user:"Пайдаланушы аты",pw2:"Құпиясөзді қайталаңыз",join:"Тіркелу",joinT:"Аккаунт ашу",joinHint:"Пайдаланушы аты (әріптен басталсын, 3–24) және құпиясөз (8+)",haveCode:"Шақыру коды бар ма? Тіркелу",haveAcc:"Аккаунт бар ма? Кіру",code:"Шақыру коды",mism:"Құпиясөздер сәйкес емес",badCode:"Шақыру коды жарамсыз",taken:"Бұл ат бос емес",badLogin:"Аты әріптен басталсын, 3–24 таңба",badPw:"Құпиясөз 8+ таңба",bad:"Құпиясөз қате, қайталаңыз",priv:"Бұл аккаунтқа рұқсат жоқ. Қайнарға жазыңыз.",privHint:"Тек иесі ғана қолдана алады.",home:"ULPA-ға оралу",off:"Серверге қосылу мүмкін емес. Интернетті тексеріп, жаңартыңыз.",retry:"Жаңарту"}
  };
  let T = TT[lang] || TT.kk;
  const gate = (title, hint, btn, href) => {
    const g = document.getElementById("gate");
    g.innerHTML = `<div class="gate-in"><svg class="gate-logo" viewBox="0 0 100 100"><circle cx="50" cy="50" r="42" fill="none" stroke="#5b8cff" stroke-width="9" stroke-dasharray="200 300" stroke-linecap="round" transform="rotate(-90 50 50)"/><circle cx="50" cy="50" r="29" fill="none" stroke="#ff5a5f" stroke-width="9" stroke-dasharray="120 300" stroke-linecap="round" transform="rotate(-90 50 50)"/><circle cx="50" cy="50" r="16" fill="none" stroke="#3ddc97" stroke-width="9" stroke-dasharray="80 300" stroke-linecap="round" transform="rotate(-90 50 50)"/></svg><b>${title}</b><p>${hint||""}</p>${btn?`<a class="go" href="${href}">${btn}</a>`:""}</div>`;
    g.classList.add("on");
  };
  let redraw = null;
  const langBar = () => `<div class="gate-lang">${[["kk","Қазақша"],["zh","中文"],["en","English"]].map(([l,n])=>`<button type="button" data-gl="${l}" class="${lang===l?"on":""}">${n}</button>`).join("")}</div>`;
  const wireLang = (again) => { redraw = again; document.querySelectorAll("#gate [data-gl]").forEach(b => b.onclick = () => {
    const keep = {}; document.querySelectorAll("#gate input").forEach(i => { if (i.id) keep[i.id] = i.value; });
    lang = b.dataset.gl; T = TT[lang]; try { localStorage.setItem("hub-lang", lang); } catch (e) {}
    try { if (window.H && H.S) { H.S.settings.lang = lang; const st = JSON.parse(localStorage.getItem("efficiency-hub-v1") || "null"); if (st && st.settings) { st.settings.lang = lang; localStorage.setItem("efficiency-hub-v1", JSON.stringify(st)); } H.render && H.render(); } } catch (e) {}
    again(); Object.keys(keep).forEach(id => { const el = document.getElementById(id); if (el) el.value = keep[id]; });
  }); };
  const lastLogin = () => { try { return localStorage.getItem("hub-last-login") || ""; } catch (e) { return ""; } };
  const LOGO = () => document.querySelector("#gate .gate-logo") ? document.querySelector("#gate .gate-logo").outerHTML : "";
  function loginForm(msg){
    const g = document.getElementById("gate"); const logo = LOGO();
    g.innerHTML = `<form class="gate-in" id="hub-login" autocomplete="on">${langBar()}${logo}<b>1% Better</b><p>${msg?`<span style="color:var(--move)">${msg}</span>`:T.loginHint}</p>
      <input class="field" type="text" id="hub-user" name="username" autocomplete="username" autocapitalize="none" spellcheck="false" placeholder="${T.user}" value="${lastLogin()}" required style="margin-bottom:8px;text-align:center">
      <input class="field" type="password" id="hub-pw" name="password" autocomplete="current-password" placeholder="${T.pw}" required style="margin-bottom:12px;text-align:center">
      <button class="go" type="submit" style="background:var(--study);margin:0">${T.loginBtn}</button>
      <button class="linkbtn" type="button" id="to-join">${T.haveCode}</button></form>`;
    g.classList.add("on");
    const f = document.getElementById("hub-login");
    document.getElementById("to-join").onclick = () => joinForm("");
    wireLang(() => loginForm(msg));
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
  const inviteCode = () => new URLSearchParams(location.search).get("invite") || "";
  function joinForm(msg){
    const g = document.getElementById("gate"); const logo = LOGO();
    g.innerHTML = `<form class="gate-in" id="hub-join" autocomplete="on">${langBar()}${logo}<b>${T.joinT}</b><p>${msg?`<span style="color:var(--move)">${msg}</span>`:T.joinHint}</p>
      <input class="field" id="j-code" placeholder="${T.code}" value="${inviteCode()}" autocapitalize="characters" spellcheck="false" style="margin-bottom:8px;text-align:center;letter-spacing:2px">
      <input class="field" id="j-user" name="username" autocomplete="username" autocapitalize="none" spellcheck="false" placeholder="${T.user}" style="margin-bottom:8px;text-align:center">
      <input class="field" type="password" id="j-pw" name="new-password" autocomplete="new-password" placeholder="${T.pw}" style="margin-bottom:8px;text-align:center">
      <input class="field" type="password" id="j-pw2" autocomplete="new-password" placeholder="${T.pw2}" style="margin-bottom:12px;text-align:center">
      <button class="go" type="submit" style="background:var(--habit);margin:0">${T.join}</button>
      <button class="linkbtn" type="button" id="to-login">${T.haveAcc}</button></form>`;
    g.classList.add("on");
    document.getElementById("to-login").onclick = () => loginForm();
    wireLang(() => joinForm(msg));
    const f = document.getElementById("hub-join");
    f.onsubmit = async (e) => {
      e.preventDefault();
      const code = document.getElementById("j-code").value.trim().toUpperCase(), login = document.getElementById("j-user").value.trim().toLowerCase();
      const pw = document.getElementById("j-pw").value, pw2 = document.getElementById("j-pw2").value;
      if (!/^[a-z][a-z0-9_.-]{2,23}$/.test(login)) { joinForm(T.badLogin); return; }
      if (pw.length < 8) { joinForm(T.badPw); return; }
      if (pw !== pw2) { joinForm(T.mism); return; }
      const btn = f.querySelector("button[type=submit]"); btn.disabled = true; btn.textContent = T.wait;
      const { error } = await HUB.sb.functions.invoke("hub-ai", { body: { action: "join", code, login, password: pw } });
      if (error) { let c = ""; try { c = (await error.context.json()).error; } catch (x) {} joinForm(c === "taken" ? T.taken : c === "bad_login" ? T.badLogin : c === "bad_password" ? T.badPw : c === "bad_code" ? T.badCode : T.off); return; }
      try { localStorage.setItem("hub-last-login", login); } catch (x) {}
      const { error: e2 } = await HUB.sb.auth.signInWithPassword({ email: `${login}@hub.kainar.online`, password: pw });
      history.replaceState(null, "", location.pathname);
      if (e2) { loginForm(); return; }
      start();
    };
  }
  async function start(){
    gate(T.wait);
    if (!window.supabase) { gate(T.off, "", T.retry, location.href); return; }
    HUB.sb = HUB.sb || window.supabase.createClient(URL_, KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });
    let session = null;
    try { session = (await HUB.sb.auth.getSession()).data.session; } catch (e) {}
    if (!session) { if (inviteCode()) joinForm(""); else loginForm(); return; }
    const { data: role, error } = await HUB.sb.rpc("hub_role");
    if (error) { gate(T.off, "", T.retry, location.href); return; }
    if (!role) { await HUB.sb.auth.signOut().catch(()=>{}); loginForm(T.priv); return; }
    HUB.uid = session.user.id; HUB.role = role; HUB.email = session.user.email || "";
    H.useUser(session.user.id, role);
    document.getElementById("gate").classList.remove("on");
    H.boot();
    if (role === "owner" && window.BATTLE) { try { BATTLE.boot(); } catch (e) { console.error(e); } }
    Promise.resolve(H.pull()).catch(()=>{}).finally(()=>{ if (H.plusStart) H.plusStart(); });
  }
  start();
})();
