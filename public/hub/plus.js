// 1% Better: today's plan, friends' check-ins, onboarding, reminders (Web Push) and the weekly report.
(function(){
"use strict";
const H=window.H,K=()=>H.kit,S=()=>H.S,$=H.$,esc=H.esc,ic=H.ic,L3=(a,b,c)=>H.L3(a,b,c),t=H.t;
const today=H.today,dkey=H.dkey,daysAgo=H.daysAgo;
const P=()=>{const s=S();if(!s.plus||typeof s.plus!=="object")s.plus={};const p=s.plus;if(!p.rest||typeof p.rest!=="object")p.rest={};return p;};
const AREAS=[
  {k:"fast",icon:"i-fast",col:"var(--fast)",href:"#body",seg:"fast"},
  {k:"train",icon:"i-body",col:"var(--move)",href:"#body",seg:"train"},
  {k:"eng",icon:"i-eng",col:"var(--eng)",href:"#eng"},
  {k:"study",icon:"i-study",col:"var(--study)",href:"#study"},
  {k:"kcal",icon:"i-food",col:"var(--todo)",href:"#body",seg:"food"},
];
const NAME={fast:()=>L3("断食","Fasting","Ораза"),train:()=>L3("训练","Training","Жаттығу"),eng:()=>L3("英语","English","Ағылшын"),study:()=>L3("学习","Study","Оқу"),kcal:()=>L3("饮食","Eating","Тамақ")};
const myName=()=>{const s=S();if(s.profile.name)return s.profile.name;const e=(window.HUB&&HUB.email)||"";return H.role==="owner"?"Kainar":(e.split("@")[0]||"me");};

// ---------- what counts as done on day k ----------
function dayItems(k){
  const s=S(),kit=K(),tk=today(),fh=s.settings.fastH||16;
  const fastDone=s.fasts.some(x=>dkey(new Date(x.e))===k&&(x.e-x.s)>=fh*3600000*0.95)||(k===tk&&s.fast.on&&(Date.now()-s.fast.start)>=fh*3600000);
  const cp=kit.curPlan();const restToday=k===tk&&cp&&(cp.day.rest||!(cp.day.ex||[]).length)&&!(s.plan&&s.plan.doneDate===tk);
  if(restToday)P().rest[k]=1;
  const trainDone=s.workouts.some(w=>w.date===k)||(s.plan&&s.plan.doneDate===k)||!!P().rest[k];
  const ed=(s.eng.days||{})[k]||{},goal=s.eng.prefs.words||15;
  const engDone=!!ed.d||(ed.w||0)>=goal;
  const studyDone=H.studyOn(k)>=(s.settings.goal||120);
  const kt=kit.kcalTarget(),kc=kit.kcalOn(k);
  const kcalDone=!!kt&&kc>0&&kc<=kt*1.05;
  return {fast:fastDone,train:trainDone,eng:engDone,study:studyDone,kcal:kcalDone,rest:!!P().rest[k]};
}
const scoreOf=it=>AREAS.filter(a=>it[a.k]).length;
H.dayItems=dayItems;
function streak(){let n=0;const tk=today();if(scoreOf(dayItems(tk))>=3)n++;for(let i=1;i<400;i++){const k=dkey(daysAgo(i));if(scoreOf(dayItems(k))>=3)n++;else break;}return n;}

function details(){
  const s=S(),kit=K(),tk=today(),fs=kit.fastState(),cp=kit.curPlan(),kt=kit.kcalTarget(),kc=kit.kcalOn(tk);
  const es=window.ENG&&ENG.todayState?ENG.todayState():{w:0,goal:15,drill:false};
  return {
    fast:fs.on?L3(`已断食 ${kit.fmtHM(fs.el*60)} / ${s.settings.fastH}h`,`${kit.fmtHM(fs.el*60)} of ${s.settings.fastH}h`,`${kit.fmtHM(fs.el*60)} / ${s.settings.fastH} сағ`):fs.small,
    train:cp?(s.plan.doneDate===tk?L3("今天练完了","Done today","Бүгін бітті"):cp.day.rest||!(cp.day.ex||[]).length?L3("今天休息","Rest day","Демалыс күні"):H.pick(cp.day.name)):(kit.moveOn(tk)?kit.moveOn(tk)+" "+t("min"):L3("还没选计划","No plan yet","Жоспар жоқ")),
    eng:L3(`单词 ${es.w}/${es.goal} · 练习${es.drill?" ✓":""}`,`Words ${es.w}/${es.goal} · drill${es.drill?" ✓":""}`,`Сөз ${es.w}/${es.goal} · жаттығу${es.drill?" ✓":""}`),
    study:H.studyOn(tk)+" / "+s.settings.goal+" "+t("min"),
    kcal:kt?(kc?`${kc} / ${kt} ${t("kcal")}`:L3("还没记录","Nothing logged","Жазылмаған")):L3("先填身体数据","Add your body data","Дене деректерін енгізіңіз"),
  };
}

// ---------- today card ----------
H.plusToday=()=>{
  const box=$("#plus-today");if(!box)return;
  const it=dayItems(today()),sc=scoreOf(it),st=streak(),d=details();
  const C=2*Math.PI*26;
  const dow=new Date().getDay();
  box.innerHTML=`<div class="p1 panel"><div class="p1h"><div class="p1r"><svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="26" fill="none" stroke="var(--s2)" stroke-width="7"/><circle cx="32" cy="32" r="26" fill="none" stroke="var(--habit)" stroke-width="7" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C*(1-sc/5)}" transform="rotate(-90 32 32)" style="transition:stroke-dashoffset .5s"/></svg><b class="num">${sc}<small>/5</small></b></div>
    <div class="p1t"><b>${L3("今天的 1%","Today's 1%","Бүгінгі 1%")}</b><span>${sc>=5?L3("全部完成，比昨天更好一点","All five done. Better than yesterday.","Бәрі орындалды"):sc>=3?L3("达标了，再多做一件更好","Goal reached. One more is a bonus.","Мақсатқа жеттіңіз"):L3(`再完成 ${3-sc} 件就达标`,`${3-sc} more to reach today's goal`,`Тағы ${3-sc} іс қалды`)}</span></div>
    <div class="p1s" title="${L3("连续达标天数","Days in a row","Қатарынан күн")}">${ic("i-flame","","stroke:var(--todo)")}<b class="num">${st}</b><small>${L3("天","days","күн")}</small></div></div>
    <ul class="p1l">${AREAS.map(a=>`<li><a href="${a.href}"${a.seg?` data-seg="${a.seg}"`:""} class="${it[a.k]?"on":""}" style="--ac:${a.col}"><span class="p1i">${ic(it[a.k]?"i-check":a.icon)}</span><span class="p1n"><b>${NAME[a.k]()}</b><small>${esc(d[a.k]||"")}</small></span>${ic("i-chev","p1c")}</a></li>`).join("")}</ul>
    ${H.examStrip?H.examStrip():""}
    ${dow===0||dow===1?`<button class="p1w" id="open-week">${ic("i-cards","","stroke:var(--study)")}<span>${dow===0?L3("本周报告出来了","This week's report is ready","Апталық есеп дайын"):L3("看看上周报告","See last week's report","Өткен аптаның есебі")}</span>${ic("i-chev")}</button>`:""}</div>`;
  renderBuddies();
};

// ---------- friends' check-ins ----------
let buddies=null,ciT=null,lastSent="";
async function sendCheckin(){
  if(!window.HUB||!HUB.uid)return;
  const k=today(),it=dayItems(k),row={user_id:HUB.uid,day:k,name:myName().slice(0,24),items:{fast:it.fast,train:it.train,eng:it.eng,study:it.study,kcal:it.kcal,rest:it.rest},score:scoreOf(it),updated_at:new Date().toISOString()};
  const sig=JSON.stringify([row.day,row.name,row.items]);if(sig===lastSent)return;
  const {error}=await HUB.sb.from("hub_checkins").upsert(row);if(!error){lastSent=sig;loadBuddies();}
}
async function loadBuddies(){
  if(!window.HUB||!HUB.uid)return;
  const since=dkey(daysAgo(13));
  const {data,error}=await HUB.sb.from("hub_checkins").select("user_id,day,name,items,score").gte("day",since);
  if(error)return;
  const by={};(data||[]).forEach(r=>{if(r.user_id===HUB.uid)return;(by[r.user_id]=by[r.user_id]||{name:r.name,days:{}}).days[r.day]=r;if(r.day>=(by[r.user_id].last||""))(by[r.user_id].name=r.name,by[r.user_id].last=r.day);});
  buddies=Object.values(by);renderBuddies();
}
function bStreak(b){let n=0;const tk=today();if(b.days[tk]&&b.days[tk].score>=3)n++;for(let i=1;i<14;i++){const r=b.days[dkey(daysAgo(i))];if(r&&r.score>=3)n++;else break;}return n;}
function renderBuddies(){
  const box=$("#plus-buddies");if(!box)return;
  if(!buddies||!buddies.length){box.innerHTML="";return;}
  const tk=today();
  box.innerHTML=`<h2><span>${L3("伙伴","Buddies","Достар")}</span><span class="side">${L3("只显示完成了没有","Only done / not done","Тек орындалды ма")}</span></h2>
   <div class="panel"><ul class="bud">${buddies.sort((a,b)=>((b.days[tk]||{}).score||0)-((a.days[tk]||{}).score||0)).map(b=>{const r=b.days[tk];const it=(r&&r.items)||{};
     return `<li><div class="ba">${esc((b.name||"?").slice(0,1).toUpperCase())}</div><div class="bm"><b>${esc(b.name)}</b><small>${r?L3(`今天 ${r.score}/5`,`Today ${r.score}/5`,`Бүгін ${r.score}/5`):L3("今天还没打开","Not opened today","Бүгін ашпаған")} · ${ic("i-flame","bf")} ${bStreak(b)}</small></div><div class="bd">${AREAS.map(a=>`<i class="${it[a.k]?"on":""}" style="--ac:${a.col}" title="${NAME[a.k]()}">${ic(a.icon)}</i>`).join("")}</div></li>`;}).join("")}</ul>
   <div class="hint">${L3("五个图标：断食、训练、英语、学习、饮食。亮了就是完成了。","Icons: fasting, training, English, study, eating. Lit means done.","Белгілер: ораза, жаттығу, ағылшын, оқу, тамақ.")}</div></div>`;
}
H.onFlush=()=>{clearTimeout(ciT);ciT=setTimeout(()=>{sendCheckin();pushSync();},1500);};

// ---------- weekly report ----------
function weekKeysAt(off){const dow=(new Date().getDay()+6)%7;const o=[];for(let i=0;i<7;i++)o.push(dkey(daysAgo(dow-i+off*7)));return o;}
function weekStats(keys){
  const s=S(),kit=K(),fh=s.settings.fastH||16;
  const study=keys.reduce((a,k)=>a+H.studyOn(k),0);
  const trainDays=keys.filter(k=>s.workouts.some(w=>w.date===k)).length;
  const fastDays=keys.filter(k=>s.fasts.some(x=>dkey(new Date(x.e))===k&&(x.e-x.s)>=fh*3600000*0.95)).length;
  const kt=kit.kcalTarget(),kd=keys.map(k=>kit.kcalOn(k)).filter(x=>x>0);
  const kcalAvg=kd.length?Math.round(kd.reduce((a,b)=>a+b,0)/kd.length):0;
  const ws=s.weights.filter(w=>w.date>=keys[0]&&w.date<=keys[6]).sort((a,b)=>a.date<b.date?-1:1);
  const prevW=s.weights.filter(w=>w.date<keys[0]).sort((a,b)=>a.date<b.date?-1:1).pop();
  const w0=prevW?prevW.kg:(ws[0]&&ws[0].kg),w1=ws.length?ws[ws.length-1].kg:null;
  const hab=s.habits.length?Math.round(keys.reduce((a,k)=>a+kit.habitFrac(k),0)/7*100):null;
  const scores=keys.map(k=>k>today()?null:scoreOf(dayItems(k)));
  const eng=window.ENG&&ENG.weekStats?ENG.weekStats(keys):{words:0,drills:0,acc:null};
  return {study,trainDays,fastDays,kcalAvg,kt,kcalDays:kd.length,w1,dw:w1!=null&&w0!=null?+(w1-w0).toFixed(1):null,hab,scores,good:scores.filter(x=>x!=null&&x>=3).length,eng};
}
function weekSheet(off){
  off=off||((new Date().getDay()===1)?-1:0);
  const keys=weekKeysAt(off),a=weekStats(keys),b=weekStats(weekKeysAt(off-1)),kit=K(),wd=kit.L().wdMon;
  const diff=(x,y,u)=>y?`<em class="${x>=y?"up":"dn"}">${x>=y?"▲":"▼"} ${Math.abs(Math.round((x-y)/y*100))}%</em>`:(x?`<em class="up">▲</em>`:"");
  const card=(lbl,val,sub,col)=>`<div class="wc"><div class="k" style="color:${col}">${lbl}</div><div class="v num">${val}</div><div class="ms">${sub||""}</div></div>`;
  const range=`${kit.fmtDay(keys[0])} – ${kit.fmtDay(keys[6])}`;
  const html=`<h3>${L3("周报告","Weekly report","Апталық есеп")}<button data-close>${t("close")}</button></h3>
   <div class="wnav"><button class="iconbtn" data-wk="${off-1}" aria-label="prev" style="transform:scaleX(-1)">${ic("i-chev")}</button><b>${range}</b><button class="iconbtn" data-wk="${off+1}" aria-label="next" ${off>=0?"disabled":""}>${ic("i-chev")}</button></div>
   <div class="panel wsc" style="background:var(--s2)"><div class="k">${L3("达标天数（5 件里完成 3 件以上）","Good days (3 of 5 or more)","Жақсы күндер (5-тен 3+)")}</div>
    <div class="wbars">${a.scores.map((x,i)=>`<div><div class="wb"><i style="height:${x==null?0:Math.max(6,x/5*100)}%;background:${x!=null&&x>=3?"var(--habit)":"var(--s3)"}"></i></div><small>${wd[i]}</small></div>`).join("")}</div>
    <div class="v num" style="margin-top:6px">${a.good}<small>/7</small> ${diff(a.good,b.good)}</div></div>
   <div class="wgrid">
    ${card(L3("学习","Study","Оқу"),H.hmTxt(a.study),diff(a.study,b.study),"var(--study)")}
    ${card(L3("训练","Training","Жаттығу"),a.trainDays+" "+L3("天","days","күн"),diff(a.trainDays,b.trainDays),"var(--move)")}
    ${card(L3("断食达标","Fasts completed","Ораза"),a.fastDays+" "+L3("天","days","күн"),diff(a.fastDays,b.fastDays),"var(--fast)")}
    ${card(L3("平均热量","Avg calories","Орташа калория"),a.kcalAvg?a.kcalAvg:"--",a.kcalAvg&&a.kt?L3(`目标 ${a.kt}`,`target ${a.kt}`,`мақсат ${a.kt}`):L3(`记录 ${a.kcalDays} 天`,`${a.kcalDays} days logged`,`${a.kcalDays} күн`),"var(--todo)")}
    ${card(L3("体重","Weight","Салмақ"),a.w1!=null?a.w1+" kg":"--",a.dw!=null?(a.dw>0?"+":a.dw===0?"±":"")+a.dw+" kg":"","var(--move)")}
    ${card(L3("英语单词","English words","Ағылшын сөздер"),a.eng.words,L3(`练习 ${a.eng.drills} 次`,`${a.eng.drills} drills`,`${a.eng.drills} жаттығу`)+(a.eng.acc!=null?` · ${a.eng.acc}%`:""),"var(--eng)")}
    ${a.hab!=null?card(L3("习惯","Habits","Әдеттер"),a.hab+"%","", "var(--habit)"):""}
   </div>
   <button class="pill" id="wk-ai" style="width:100%;margin-top:14px">${ic("i-spark")} <span>${L3("让 AI 点评这一周","AI review of this week","AI талдауы")}</span></button>
   <div id="wk-out"></div>`;
  H.openSheet(html,()=>{
    $("#sheet-body").onclick=e=>{const w=e.target.closest("[data-wk]");if(w&&!w.disabled){weekSheet(+w.dataset.wk);}};
    $("#wk-ai").onclick=async()=>{const btn=$("#wk-ai");btn.disabled=true;const t0=Date.now();const tk=setInterval(()=>{btn.querySelector("span").textContent=t("thinking")+" "+Math.round((Date.now()-t0)/1000)+"s";},500);
      const lang={zh:"Simplified Chinese",en:"English",kk:"Kazakh (Cyrillic)"}[S().settings.lang]||"Simplified Chinese";
      const facts={week:range,goodDays:a.good,dailyScores:a.scores,studyMin:a.study,studyMinPrevWeek:b.study,studyGoalPerDay:S().settings.goal,trainingDays:a.trainDays,trainingDaysPrev:b.trainDays,fastsCompleted:a.fastDays,fastPlan:S().settings.fastH+":"+(24-S().settings.fastH),avgKcal:a.kcalAvg,kcalTarget:a.kt,weightNow:a.w1,weightChange:a.dw,englishWords:a.eng.words,englishDrills:a.eng.drills,englishAccuracyPct:a.eng.acc,habitsPct:a.hab};
      try{const r=await H.aiJson(`You are a friendly, honest coach for a university student who wants to get 1% better every day (study, IELTS English, gym 4-day split, 16:8 fasting, calories). Here are this week's numbers as JSON: ${JSON.stringify(facts)}. Write in ${lang}, plain and short. Reply with only JSON: {"summary":"2 sentences about the week","wins":["up to 3 concrete things that went well"],"next":["3 small concrete goals for next week, each with a number"]}. Do not invent numbers that are not in the data.`,{modelTier:"quick"});
        $("#wk-out").innerHTML=`<div class="panel" style="background:var(--s2);margin-top:12px"><div style="font-weight:800;line-height:1.5">${esc(r.summary||"")}</div>${(r.wins||[]).length?`<div class="fl" style="color:var(--habit)">${L3("做得好","Went well","Жақсы болды")}</div><ul class="tips">${r.wins.map(x=>`<li>${esc(x)}</li>`).join("")}</ul>`:""}${(r.next||[]).length?`<div class="fl" style="color:var(--study)">${L3("下周","Next week","Келесі апта")}</div><ul class="tips">${r.next.map(x=>`<li>${esc(x)}</li>`).join("")}</ul>`:""}</div>`;
      }catch(err){H.toast(H.aiErr(err));}finally{clearInterval(tk);btn.disabled=false;btn.querySelector("span").textContent=L3("再点评一次","Review again","Қайта талдау");}};
  });
}
H.weekSheet=weekSheet;

// ---------- reminders (Web Push through /hub/sw.js) ----------
const RD={on:false,eng:"20:00",train:"18:00",fast:true,week:true};
const R=()=>{const s=S();s.settings.remind=Object.assign({},RD,s.settings.remind||{});return s.settings.remind;};
const pushOK=()=>"serviceWorker" in navigator&&"PushManager" in window&&"Notification" in window;
const isIOS=/iPhone|iPad|iPod/.test(navigator.userAgent),standalone=window.matchMedia("(display-mode: standalone)").matches||navigator.standalone;
async function swReg(){return navigator.serviceWorker.register("/hub/sw.js",{scope:"/hub/"});}
const keyBytes=k=>{const p="=".repeat((4-k.length%4)%4),b=atob((k+p).replace(/-/g,"+").replace(/_/g,"/"));return Uint8Array.from(b,c=>c.charCodeAt(0));};
async function subscribe(){
  const perm=await Notification.requestPermission();if(perm!=="granted")throw new Error("denied");
  const reg=await swReg();await navigator.serviceWorker.ready;
  const {data:key,error}=await HUB.sb.rpc("hub_push_key");if(error||!key)throw new Error("nokey");
  let sub=await reg.pushManager.getSubscription();
  if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:keyBytes(key)});
  const j=sub.toJSON();
  const {error:e2}=await HUB.sb.from("hub_push").upsert({endpoint:j.endpoint,user_id:HUB.uid,p256dh:j.keys.p256dh,auth:j.keys.auth,...pushFields()});
  if(e2)throw e2;
}
function pushFields(){const s=S(),r=R(),f=s.fast,fh=s.settings.fastH||16;
  return {lang:s.settings.lang,tz:Intl.DateTimeFormat().resolvedOptions().timeZone||"Asia/Almaty",prefs:{eng:r.eng||null,train:r.train||null,fast:!!r.fast,week:!!r.week},
    fast_end:f.on?new Date(f.start+fh*3600000).toISOString():null,
    eat_end:!f.on&&f.lastEnd&&Date.now()-f.lastEnd<(24-fh)*3600000?new Date(f.lastEnd+(24-fh)*3600000).toISOString():null,
    updated_at:new Date().toISOString()};}
let lastPush="";
async function pushSync(){if(!R().on||!window.HUB||!HUB.uid)return;const f=pushFields();const sig=JSON.stringify([f.lang,f.prefs,f.fast_end,f.eat_end]);if(sig===lastPush)return;
  const {error}=await HUB.sb.from("hub_push").update(f).eq("user_id",HUB.uid);if(!error)lastPush=sig;}
async function unsubscribe(){try{const reg=await navigator.serviceWorker.getRegistration("/hub/");const sub=reg&&await reg.pushManager.getSubscription();if(sub){await HUB.sb.from("hub_push").delete().eq("endpoint",sub.endpoint);await sub.unsubscribe();}}catch(e){}}
function remindSheet(){
  const r=R();
  const body=()=>`<h3>${L3("提醒","Reminders","Еске салу")}<button data-close>${t("done")}</button></h3>
   ${!pushOK()?`<div class="prompt">${isIOS&&!standalone?L3("iPhone 要先把这个网站加到主屏幕（分享 → 添加到主屏幕），再从主屏幕打开，才能收到提醒。","On iPhone: Share → Add to Home Screen, then open it from the home screen to get reminders.","iPhone: Бөлісу → Басты экранға қосу, сосын сол жерден ашыңыз."):L3("这个浏览器不支持通知。","This browser can't show notifications.","Бұл браузер хабарлама көрсетпейді.")}</div>`:`
   <label class="rrow"><span><b>${L3("打开提醒","Turn on reminders","Еске салуды қосу")}</b><small>${L3("关掉网页也能收到","Arrive even when the page is closed","Бет жабық болса да келеді")}</small></span><input type="checkbox" class="sw" id="r-on" ${r.on?"checked":""}></label>
   <div id="r-more" style="${r.on?"":"opacity:.4;pointer-events:none"}">
   <label class="rrow"><span><b>${L3("断食","Fasting","Ораза")}</b><small>${L3("断食到点、进食窗口结束时","When the fast is done and when the eating window closes","Ораза біткенде және тамақ уақыты аяқталғанда")}</small></span><input type="checkbox" class="sw" id="r-fast" ${r.fast?"checked":""}></label>
   <label class="rrow"><span><b>${L3("英语","English","Ағылшын")}</b><small>${L3("这个时间还没做就提醒","If not done by this time","Осы уақытқа дейін жасалмаса")}</small></span><input type="time" class="field tm" id="r-eng" value="${r.eng||""}"></label>
   <label class="rrow"><span><b>${L3("训练","Training","Жаттығу")}</b><small>${L3("训练日这个时间还没练就提醒","On training days, if not done by this time","Жаттығу күні, осы уақытқа дейін")}</small></span><input type="time" class="field tm" id="r-train" value="${r.train||""}"></label>
   <label class="rrow"><span><b>${L3("周报告","Weekly report","Апталық есеп")}</b><small>${L3("每周日 20:00","Sundays at 20:00","Жексенбі 20:00")}</small></span><input type="checkbox" class="sw" id="r-week" ${r.week?"checked":""}></label>
   <button class="pill" id="r-test" style="width:100%;margin-top:14px">${L3("发一条测试提醒","Send a test reminder","Сынақ хабарлама")}</button></div>`}`;
  H.openSheet(body(),()=>{
    if(!pushOK())return;
    const set=async()=>{r.fast=$("#r-fast").checked;r.week=$("#r-week").checked;r.eng=$("#r-eng").value;r.train=$("#r-train").value;H.save(true);lastPush="";pushSync();};
    ["#r-fast","#r-week","#r-eng","#r-train"].forEach(id=>$(id).addEventListener("change",set));
    $("#r-on").onchange=async e=>{const on=e.target.checked;
      if(on){try{await subscribe();r.on=true;H.toast(L3("提醒已打开","Reminders on","Қосылды"));}catch(err){e.target.checked=false;r.on=false;H.toast(String(err.message)==="denied"?L3("通知被拒绝了，请在浏览器设置里允许","Notifications blocked. Allow them in browser settings.","Хабарламаға рұқсат жоқ"):L3("没打开成功，再试一次","Couldn't turn on. Try again.","Қосылмады"));}}
      else{await unsubscribe();r.on=false;}
      H.save(true);$("#r-more").style.cssText=r.on?"":"opacity:.4;pointer-events:none";};
    $("#r-test").onclick=async()=>{const b=$("#r-test");b.disabled=true;
      try{const {error}=await HUB.sb.functions.invoke("hub-push",{body:{action:"test"}});if(error)throw error;H.toast(L3("已发送，几秒内会收到","Sent. It should arrive in a few seconds.","Жіберілді"));}catch(e){H.toast(L3("发送失败","Couldn't send","Жіберілмеді"));}finally{b.disabled=false;}};
  });
}
H.remindSheet=remindSheet;

// ---------- settings additions ----------
H.plusSettings=()=>`<div class="btnrow" style="margin-top:12px"><button class="pill" id="open-remind">${ic("i-sound")} ${L3("提醒","Reminders","Еске салу")}</button><button class="pill" id="open-week2">${ic("i-cards")} ${L3("周报告","Weekly report","Апталық есеп")}</button></div>
  <button class="pill" id="open-onboard" style="width:100%;margin-top:12px">${ic("i-target")} ${L3("重新设置（名字、科目、目标）","Set up again (name, subjects, goals)","Қайта баптау")}</button>`;

// ---------- onboarding for a new account ----------
const SUBJ_SUGGEST={zh:["高等数学","物理","编程","英语","化学","线性代数","理论力学","工程制图"],en:["Calculus","Physics","Programming","English","Chemistry","Linear algebra","Mechanics","Drawing"],kk:["Жоғары математика","Физика","Бағдарламалау","Ағылшын тілі","Химия","Сызықтық алгебра","Механика","Сызу"]};
function onboard(step){
  const s=S(),p=s.profile;step=step||0;const N=5;
  const dots=`<div class="obd">${Array.from({length:N},(_,i)=>`<i class="${i<=step?"on":""}"></i>`).join("")}</div>`;
  const nav=(next,label)=>`<div class="btnrow" style="margin-top:22px">${step?`<button class="pill" data-ob="${step-1}" style="flex:0 0 auto;padding:14px 18px">${L3("上一步","Back","Артқа")}</button>`:""}<button class="pill pri" id="ob-next" data-next="${next}">${label||L3("下一步","Next","Келесі")}</button></div>`;
  let html="",mount=()=>{};
  if(step===0){
    html=`${dots}<div class="obh"><b>${L3("欢迎来到 1% Better","Welcome to 1% Better","1% Better-ке қош келдіңіз")}</b><p>${L3("每天进步一点点。先花一分钟设置一下。","Get a little better every day. One minute to set up.","Күн сайын сәл жақсырақ. Бір минут баптау.")}</p></div>
     <div class="fl">${t("language")}</div><div class="seg" id="ob-lang" style="margin:0;width:auto">${["zh","en","kk"].map(l=>`<button data-l="${l}" class="${s.settings.lang===l?"on":""}">${I18N[l]._name}</button>`).join("")}</div>
     <div class="fl">${L3("你的名字（朋友会看到）","Your name (friends see it)","Атыңыз (достарыңыз көреді)")}</div><input class="field" id="ob-name" maxlength="24" value="${esc(p.name||myName())}">`+nav(1);
    mount=()=>{$("#ob-lang").onclick=e=>{const b=e.target.closest("button");if(!b)return;s.settings.lang=b.dataset.l;p.name=$("#ob-name").value.trim();H.save();onboard(0);};
      $("#ob-next").onclick=()=>{p.name=$("#ob-name").value.trim().slice(0,24);H.save(true);onboard(1);};};
  }else if(step===1){
    let tmp={sex:p.sex||"m",act:p.act??1,goal:p.goal??1};
    html=`${dots}<div class="obh"><b>${L3("身体数据","Your body","Дене деректері")}</b><p>${L3("用来算每天该吃多少热量。","Used to work out your daily calories.","Күнделікті калорияны есептеу үшін.")}</p></div>
     <div class="seg" id="ob-sex" style="margin:0 0 8px;width:auto"><button data-v="m" class="${tmp.sex!=="f"?"on":""}">${t("male")}</button><button data-v="f" class="${tmp.sex==="f"?"on":""}">${t("female")}</button></div>
     <div class="steps">${H.stepper("age",t("age"),p.age||19,1)}${H.stepper("h",t("heightCm"),p.h||175,1)}${H.stepper("pw",t("weightKg"),K().latestWeight()||70,.5)}</div>
     <div class="fl">${t("activity")}</div><div class="chips" style="justify-content:flex-start;margin:0" id="ob-act">${K().L().acts.map((a,i)=>`<button class="chip ${tmp.act===i?"on":""}" data-v="${i}">${a}</button>`).join("")}</div>
     <div class="fl">${t("wgoal")}</div><div class="chips" style="justify-content:flex-start;margin:0" id="ob-goal">${K().L().wgoals.map((a,i)=>`<button class="chip ${tmp.goal===i?"on":""}" data-v="${i}">${a}</button>`).join("")}</div>`+nav(2);
    mount=()=>{const grp=(id,f)=>{$(id).onclick=e=>{const b=e.target.closest("button");if(!b)return;document.querySelectorAll(id+" button").forEach(x=>x.classList.toggle("on",x===b));f(b);};};
      grp("#ob-sex",b=>tmp.sex=b.dataset.v);grp("#ob-act",b=>tmp.act=+b.dataset.v);grp("#ob-goal",b=>tmp.goal=+b.dataset.v);
      $("#ob-next").onclick=()=>{const w=+$("#st-pw").value||0;Object.assign(p,tmp,{age:+$("#st-age").value||0,h:+$("#st-h").value||0,w});
        if(w&&!s.weights.some(x=>x.date===today()))s.weights.push({date:today(),kg:w});H.save(true);onboard(2);};};
  }else if(step===2){
    const sug=(SUBJ_SUGGEST[s.settings.lang]||SUBJ_SUGGEST.zh).filter(n=>!s.subjects.some(x=>x.name===n));
    html=`${dots}<div class="obh"><b>${L3("你在学的科目","Your subjects","Пәндеріңіз")}</b><p>${L3("学习计时和进度会按科目记录。之后也可以改。","Study time and progress are kept per subject. You can change them later.","Оқу уақыты пән бойынша жазылады.")}</p></div>
     <ul class="obs">${s.subjects.map(x=>`<li><i style="background:${x.color}"></i><span>${esc(x.name)}</span><button class="del" data-obdel="${x.id}">${ic("i-x")}</button></li>`).join("")||`<li class="empty" style="display:block">${L3("还没有科目","No subjects yet","Пән жоқ")}</li>`}</ul>
     <form class="add" id="ob-sf" style="margin-top:10px"><input id="ob-sin" maxlength="60" autocomplete="off" placeholder="${L3("输入科目名称","Subject name","Пән атауы")}"><button class="plus">${ic("i-plus")}</button></form>
     ${sug.length?`<div class="chips" style="justify-content:flex-start;margin-top:10px">${sug.map(n=>`<button class="chip" data-obadd="${esc(n)}">+ ${esc(n)}</button>`).join("")}</div>`:""}`+nav(3);
    const COLS=["#5b8cff","#bf7cff","#ff7a59","#40c8e0","#3ddc97","#ffb340","#ff7aa8","#a1a1a6"];
    const add=n=>{n=n.trim();if(!n||s.subjects.some(x=>x.name===n))return;s.subjects.push({id:H.uid(),name:n,color:COLS[s.subjects.length%COLS.length],topics:[]});H.save(true);onboard(2);setTimeout(()=>$("#ob-sin")&&$("#ob-sin").focus(),50);};
    mount=()=>{$("#ob-sf").onsubmit=e=>{e.preventDefault();add($("#ob-sin").value);};
      $("#sheet-body").addEventListener("click",e=>{const a=e.target.closest("[data-obadd]");if(a){add(a.dataset.obadd);return;}const d=e.target.closest("[data-obdel]");if(d){s.subjects=s.subjects.filter(x=>x.id!==d.dataset.obdel);H.save(true);onboard(2);}});
      $("#ob-next").onclick=()=>onboard(3);};
  }else if(step===3){
    const pl=s.plan&&s.plan.id;
    html=`${dots}<div class="obh"><b>${L3("每天的目标","Daily goals","Күнделікті мақсат")}</b><p>${L3("每天完成这 5 件里的 3 件，就算进步了 1%。","Finish 3 of these 5 each day and you're 1% better.","Осы 5-тің 3-ін орындасаңыз, 1% жақсардыңыз.")}</p></div>
     <div class="fl">${L3("训练计划","Training plan","Жаттығу жоспары")}</div><div class="obp">${DATA.PLANS.map(x=>`<button data-obplan="${x.id}" class="${pl===x.id?"on":""}"><b>${esc(H.pick(x.name))}</b><small>${x.days.length} ${L3("天一轮","-day cycle","күндік цикл")}</small></button>`).join("")}<button data-obplan="" class="${!pl?"on":""}"><b>${L3("先不选","Not now","Кейін")}</b><small>${L3("之后在“身体”里选","Pick later under Body","Кейін таңдау")}</small></button></div>
     <div class="fl">${L3("轻断食","Intermittent fasting","Аралық ораза")}</div><div class="dur" id="ob-fast" style="margin:0">${[14,16,18].map(h=>`<button data-h="${h}" class="${s.settings.fastH===h?"on":""}">${h}:${24-h}</button>`).join("")}</div>
     <div class="steps" style="grid-template-columns:1fr 1fr;margin-top:16px">${H.stepper("sg",t("studyGoal"),s.settings.goal,10)}${H.stepper("ew",L3("每天新单词","New words a day","Күніне жаңа сөз"),s.eng.prefs.words||15,5)}</div>`+nav(4);
    mount=()=>{$("#sheet-body").addEventListener("click",e=>{const b=e.target.closest("[data-obplan]");if(b){const id=b.dataset.obplan;s.plan=id?{id,idx:0,doneDate:null}:null;s.planChecks={};document.querySelectorAll("[data-obplan]").forEach(x=>x.classList.toggle("on",x===b));}
        const f=e.target.closest("#ob-fast button");if(f){s.settings.fastH=+f.dataset.h;document.querySelectorAll("#ob-fast button").forEach(x=>x.classList.toggle("on",x===f));}});
      $("#ob-next").onclick=()=>{s.settings.goal=Math.max(10,+$("#st-sg").value||120);s.eng.prefs.words=Math.max(5,Math.min(40,+$("#st-ew").value||15));H.save(true);onboard(4);};};
  }else{
    html=`${dots}<div class="obh"><b>${L3("最后一步：提醒","Last step: reminders","Соңғы қадам: еске салу")}</b><p>${L3("断食到点、英语和训练没做的时候提醒你。也可以以后在设置里打开。","Get a nudge when your fast is done or English and training are still open. You can also turn this on later in Settings.","Ораза біткенде, ағылшын мен жаттығу жасалмағанда еске салады.")}</p></div>
     <button class="pill" id="ob-remind" style="width:100%">${ic("i-sound")} ${L3("打开提醒","Turn on reminders","Еске салуды қосу")}</button>
     ${isIOS&&!standalone?`<div class="hint">${L3("iPhone：先点分享 → 添加到主屏幕，从主屏幕打开后才能收到提醒。","iPhone: Share → Add to Home Screen first, then open it from there.","iPhone: Бөлісу → Басты экранға қосу.")}</div>`:""}`+nav(5,L3("开始","Start","Бастау"));
    mount=()=>{$("#ob-remind").onclick=()=>remindSheetFromOnboard();$("#ob-next").onclick=()=>{s.onboarded=true;H.save();H.closeSheet();H.toast(L3("开始吧！今天的 1%","Let's go. Today's 1%.","Бастайық!"));};};
  }
  H.openSheet(html,()=>{$("#sheet-body").addEventListener("click",e=>{const b=e.target.closest("[data-ob]");if(b)onboard(+b.dataset.ob);});mount();},true);
}
function remindSheetFromOnboard(){H.onSheetClose=()=>setTimeout(()=>{if(!S().onboarded)onboard(4);},50);remindSheet();}
H.onboard=onboard;

// ---------- wiring ----------
document.addEventListener("click",e=>{const b=e.target.closest("#open-week,#open-week2,#open-remind,#open-onboard");if(!b)return;
  if(b.id==="open-remind")remindSheet();else if(b.id==="open-onboard")onboard(0);else weekSheet();});
H.plusStart=()=>{
  const s=S();
  if(!s.onboarded){if(H.role==="owner"||s.study.length>3||s.profile.h){s.onboarded=true;}else setTimeout(()=>onboard(0),400);}
  loadBuddies();setTimeout(sendCheckin,2500);
  if(R().on&&pushOK())swReg().catch(()=>{});
  setInterval(()=>{if(document.visibilityState==="visible")loadBuddies();},120000);
  document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible"){sendCheckin();pushSync();}});
};
})();
