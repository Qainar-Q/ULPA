(function(){
"use strict";
const H = window.H = {};
const $ = H.$ = s=>document.querySelector(s);
const $$ = s=>document.querySelectorAll(s);
const pad = H.pad = n=>String(n).padStart(2,"0");
const dkey = H.dkey = d=>d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate());
const today = H.today = ()=>dkey(new Date());
const daysAgo = H.daysAgo = n=>{const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()-n);return d;};
const uid = H.uid = ()=>Math.random().toString(36).slice(2,9)+Date.now().toString(36).slice(-4);
const esc = H.esc = s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const ic = H.ic = (id,cls,style)=>`<svg class="${cls||""}" style="${style||""}"><use href="#${id}"/></svg>`;
let tT; const toast = H.toast = m=>{const el=$("#toast");el.textContent=m;el.classList.add("on");clearTimeout(tT);tT=setTimeout(()=>el.classList.remove("on"),2000);};

const HCOLORS=["#3ddc97","#5b8cff","#ff5a5f","#ffb340","#bf7cff","#40c8e0"];
const HICONS=["h-drop","h-book","h-moon","h-run","h-leaf","h-pen","h-sun","h-code","h-heart","h-phone","h-music","h-lang"];
const SCOLORS=["#5b8cff","#bf7cff","#ff7a59","#40c8e0","#3ddc97","#ffb340","#ff7aa8","#a1a1a6"];
const KIND={力量:"var(--move)",有氧:"#ffb340",球类:"#40c8e0",拉伸:"#3ddc97",其他:"#a1a1a6"};

// ---------- state ----------
const LS="efficiency-hub-v1";
function defaults(){
  const lang=(navigator.language||"zh").toLowerCase().startsWith("kk")?"kk":(navigator.language||"").toLowerCase().startsWith("zh")?"zh":"zh";
  return {v:3,updatedAt:0,_stamps:{},todos:[],study:[],workouts:[],weights:[],food:[],fasts:[],
  fast:{on:false,start:0,lastEnd:0},
  habits:[{id:"h1",icon:"h-drop",color:"#40c8e0",name:"喝够 8 杯水"},{id:"h2",icon:"h-book",color:"#ffb340",name:"阅读 20 分钟"},{id:"h3",icon:"h-moon",color:"#bf7cff",name:"11 点前睡"}],
  habitLog:{},subjects:null,plan:null,planChecks:{},
  profile:{sex:"m",age:20,h:0,w:0,act:1,goal:1},
  eng:{level:null,tests:[],vocab:{},newLog:{},drills:[],mistakes:[],writings:[],speaks:[],days:{},prefs:{explain:0,words:15,drill:10},cache:{}},
  settings:{focus:25,brk:5,goal:120,moveGoal:30,fastH:16,lang}};
}
function normalize(s){
  const d=defaults(); s=s&&typeof s==="object"?s:{};
  for(const k of Object.keys(d)) if(s[k]===undefined||s[k]===null&&d[k]!==null) s[k]=d[k];
  s.settings=Object.assign({},d.settings,s.settings||{});
  s.profile=Object.assign({},d.profile,s.profile||{});
  s.fast=Object.assign({},d.fast,s.fast||{});
  s.eng=Object.assign({},d.eng,s.eng||{}); s.eng.prefs=Object.assign({},d.eng.prefs,s.eng.prefs||{});
  ["vocab","newLog","days","cache"].forEach(k=>{if(!s.eng[k]||typeof s.eng[k]!=="object")s.eng[k]={};});
  ["tests","drills","mistakes","writings","speaks"].forEach(k=>{if(!Array.isArray(s.eng[k]))s.eng[k]=[];});
  s.habits.forEach((h,i)=>{if(!HICONS.includes(h.icon))h.icon=HICONS[i%HICONS.length];if(!h.color)h.color=HCOLORS[i%HCOLORS.length];});
  s.workouts.forEach(w=>{if(w.min==null)w.min=0;});
  if(!Array.isArray(s.subjects)){
    s.subjects=DATA.SUBJECTS.map(x=>({id:uid(),name:x.name,color:x.color,tag:x.tag,topics:[]}));
    [...new Set(s.study.map(x=>x.subject).filter(Boolean))].forEach((n,i)=>{if(!s.subjects.some(x=>x.name===n))s.subjects.push({id:uid(),name:n,color:SCOLORS[(s.subjects.length)%SCOLORS.length],topics:[]});});
  }
  if(!s.profile.h){s.profile.h=180;s.profile.w=83;s.profile.act=2;s.profile.goal=0;if(!s.weights.length)s.weights.push({date:dkey(new Date()),kg:83});}
  if(!s._stamps)s._stamps={};
  // prune old bulky logs
  const cut=dkey(daysAgo(200)); s.food=s.food.filter(f=>f.date>=cut);
  if(s.eng.drills.length>80)s.eng.drills=s.eng.drills.slice(-80);
  if(s.eng.mistakes.length>150)s.eng.mistakes=s.eng.mistakes.slice(-150);
  if(s.eng.writings.length>40)s.eng.writings=s.eng.writings.slice(-40);
  if(s.eng.speaks.length>40)s.eng.speaks=s.eng.speaks.slice(-40);
  return s;
}
let S; try{S=normalize(JSON.parse(localStorage.getItem(LS)));}catch(e){S=normalize(null);}
Object.defineProperty(H,"S",{get:()=>S});

// ---------- i18n ----------
function L(){return I18N[S.settings.lang]||I18N.zh;}
const t = H.t = (k,v)=>{let s=L()[k]; if(s==null) s=I18N.zh[k]; if(s==null) return k; if(typeof s!=="string") return s; if(v) for(const x in v) s=s.split("{"+x+"}").join(v[x]); return s;};
H.lang=()=>S.settings.lang;
function fmtDate(d){const l=L();return l.dateFmt.replace("{m}",l.months[d.getMonth()]).replace("{d}",d.getDate()).replace("{w}",l.wdLong[d.getDay()]);}
const fmtDay = H.fmtDay = k=>{if(k===today())return t("today");if(k===dkey(daysAgo(1)))return t("yesterday");const[y,m,d]=k.split("-");const l=L();return l.dayFmt.replace("{m}",l.months[+m-1]).replace("{d}",+d);};
const hm = H.hm = m=>m>=60?Math.floor(m/60)+`<small>${t("hShort")}</small>`+(m%60?(m%60)+`<small>${t("mShort")}</small>`:""):m+`<small>${t("min")}</small>`;
const hmTxt = H.hmTxt = m=>m>=60?Math.floor(m/60)+" "+t("hShort")+(m%60?" "+(m%60)+" "+t("mShort"):""):m+" "+t("min");
const foodName=f=>{const i={zh:1,en:2,kk:3}[S.settings.lang]||1;return f[i];};
const foodUnit=f=>{const i={zh:0,en:1,kk:2}[S.settings.lang]||0;return f[4][i];};
const pick=o=>o&&typeof o==="object"?(o[S.settings.lang]||o.zh||o.en):o;
H.pick=pick;

// ---------- sync: one row in ULPA's Supabase (table hub_state, owner-only RLS) ----------
let writing=false,dirty=false,saveT=null,ready=false;
const save = H.save = (noRender)=>{
  S.updatedAt=Date.now();
  try{localStorage.setItem(LS,JSON.stringify(S));}catch(e){}
  if(!noRender) render();
  if(ready){dirty=true;clearTimeout(saveT);saveT=setTimeout(flush,800);}
};
async function flush(){
  if(!ready||writing||!dirty) return; writing=true; dirty=false;
  try{
    const {error}=await HUB.sb.from("hub_state").upsert({user_id:HUB.uid,data:JSON.parse(JSON.stringify(S)),updated_at:new Date(S.updatedAt).toISOString()});
    if(error) throw error; setSync("ok",t("synced"));
  }catch(e){ setSync("warn",t("syncFail")); }
  writing=false; if(dirty) flush();
}
function setSync(c,txt){const el=$("#sync");if(el){el.className="sync "+c;el.title=txt;}}
async function pull(){
  if(!HUB.uid) return;
  const {data,error}=await HUB.sb.from("hub_state").select("data,updated_at").eq("user_id",HUB.uid).maybeSingle();
  if(error){setSync("warn",t("offline"));return;}
  ready=true;
  if(data&&data.data){const r=normalize(data.data);
    if((r.updatedAt||0)>(S.updatedAt||0)){S=r;try{localStorage.setItem(LS,JSON.stringify(S));}catch(e){}render();drawTimer();}
    else if((S.updatedAt||0)>(r.updatedAt||0)){dirty=true;flush();}}
  else if(S.updatedAt){dirty=true;flush();}
  setSync("ok",t("synced"));
}
H.pull=pull;
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible"&&!dirty&&!writing)pull();});

// ---------- AI (Supabase Edge Function "hub-ai", owner only) ----------
H.aiReady=async()=>!!HUB.uid;
H.aiJson=async(prompt,opts)=>{
  if(!HUB.uid) throw {code:"unavailable"};
  const {data,error}=await HUB.sb.functions.invoke("hub-ai",{body:{prompt,tier:(opts&&opts.modelTier)||"default"}});
  if(error){let code="upstream";try{const b=await error.context.json();code=b.error||code;}catch(e){}throw {code};}
  if(!data||data.result===undefined) throw {code:"invalid_json"};
  return data.result;
};
H.aiErr=e=>e&&(e.code==="busy"||e.code==="limit")?t("rateLimited"):e&&e.code==="unavailable"?t("aiNeeded"):t("err",{x:(e&&(e.code||e.message))||"?"});

// ---------- router ----------
const VIEWS=["today","study","eng","body","habits"];
function route(){const v=VIEWS.includes(location.hash.slice(1))?location.hash.slice(1):"today";
  $$("section").forEach(s=>s.classList.toggle("on",s.id==="v-"+v));
  $$(".tabbar a").forEach(a=>a.classList.toggle("on",a.dataset.v===v)); window.scrollTo(0,0); if(v==="eng"&&window.ENG) ENG.render();}
window.addEventListener("hashchange",route);

// ---------- calc ----------
const studyOn=H.studyOn=k=>S.study.filter(x=>x.date===k).reduce((a,x)=>a+x.min,0);
const moveOn=k=>S.workouts.filter(x=>x.date===k).reduce((a,x)=>a+(+x.min||0),0);
const kcalOn=k=>S.food.filter(x=>x.date===k).reduce((a,x)=>a+(+x.kcal||0),0);
const hDone=(id,k)=>(S.habitLog[k]||[]).includes(id);
const habitFrac=k=>S.habits.length?S.habits.filter(h=>hDone(h.id,k)).length/S.habits.length:0;
function streak(id){let n=0,i=hDone(id,today())?0:1;while(hDone(id,dkey(daysAgo(i)))){n++;i++;}return n;}
function weekKeys(){const dow=(new Date().getDay()+6)%7;const o=[];for(let i=0;i<7;i++)o.push(dkey(daysAgo(dow-i)));return o;}
function subjColor(name){const s=S.subjects.find(x=>x.name===name);if(s)return s.color;const all=[...new Set(S.study.map(x=>x.subject||""))];return SCOLORS[(all.indexOf(name||"")+3)%SCOLORS.length];}
function latestWeight(){const w=S.weights.slice().sort((a,b)=>a.date<b.date?-1:1).pop();return w?w.kg:(+S.profile.w||0);}
function kcalTarget(){const p=S.profile;const w=latestWeight();if(!(p.h>0&&p.age>0&&w>0))return 0;
  const bmr=10*w+6.25*p.h-5*p.age+(p.sex==="f"?-161:5);const tdee=bmr*[1.2,1.375,1.55,1.725][p.act||0];return Math.round((tdee+[-400,0,300][p.goal??1])/10)*10;}
H.addStudy=(min,subject,auto)=>{const n=new Date();S.study.push({id:uid(),date:today(),min,subject:subject||"",auto,ts:Date.now(),time:pad(n.getHours())+":"+pad(n.getMinutes())});save();};

// ---------- rings ----------
function arc(cx,cy,r,w,frac,color,anim){const C=2*Math.PI*r;const f=Math.max(0,Math.min(1,frac));
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-opacity=".2" stroke-width="${w}"/>`+(f>0?`<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${anim?C:C*(1-f)}" data-to="${C*(1-f)}" transform="rotate(-90 ${cx} ${cy})" style="transition:stroke-dashoffset 1.1s cubic-bezier(.3,.8,.3,1)"/>`:"");}
const rings=H.rings=(size,vals,w,gap,anim)=>{const c=size/2;let r=c-w/2;let s="";vals.forEach(([f,col])=>{s+=arc(c,c,r,w,f,col,anim);r-=w+gap;});return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${s}</svg>`;};
function kick(el){requestAnimationFrame(()=>requestAnimationFrame(()=>el.querySelectorAll("[data-to]").forEach(c=>c.setAttribute("stroke-dashoffset",c.dataset.to))));}

// ---------- static labels ----------
function applyStatic(){document.documentElement.lang=L().locale;$$("[data-t]").forEach(el=>el.textContent=t(el.dataset.t));}

// ---------- render ----------
let firstRender=true, editing=false, bodySeg="train";
function render(){
  applyStatic();
  const now=new Date(), ds=fmtDate(now); $$(".dsub").forEach(e=>e.textContent=ds);
  renderToday(); renderStudy(); renderBody(); renderHabits(); if(window.ENG) ENG.render();
  firstRender=false;
}
H.render=render;

function renderToday(){
  const tk=today(),sm=studyOn(tk),mm=moveOn(tk),g=S.settings.goal,mg=S.settings.moveGoal,hd=S.habits.filter(h=>hDone(h.id,tk)).length;
  const R=$("#rings");R.innerHTML=rings(Math.min(176,window.innerWidth-60),[[sm/g,"var(--study)"],[mm/mg,"var(--move)"],[habitFrac(tk),"var(--habit)"]],20,4,firstRender);kick(R);
  $("#lg").innerHTML=[["study",sm,g,t("min")],["move",mm,mg,t("min")],["habit",hd,S.habits.length,t("count")]].map(([c,a,b,u])=>`<div class="item"><div class="lbl c-${c}">${t(c==="habit"?"habits":c)}</div><div class="val num">${a}<small>/${b} ${u}</small></div></div>`).join("");
  // mini cards
  const kt=kcalTarget(),kc=kcalOn(tk);
  const fs=fastState();
  const eng=window.ENG?ENG.todaySummary():null;
  $("#minis").innerHTML=
   `<a class="mini" href="#body" data-seg="fast"><div class="mt" style="color:var(--fast)">${ic("i-fast")} ${t("fasting")}</div><div class="mv num">${fs.big}</div><div class="ms">${esc(fs.small)}</div></a>`+
   `<a class="mini" href="#body" data-seg="food"><div class="mt" style="color:var(--todo)">${ic("i-food")} ${t("calories")}</div><div class="mv num">${kc}<small>${kt?" / "+kt:""} ${t("kcal")}</small></div><div class="ms">${kt?(kc<=kt?t("remain")+" "+(kt-kc):t("over")+" "+(kc-kt)):t("setProfileShort")}</div></a>`+
   (eng?`<a class="mini wide" href="#eng"><div class="mt" style="color:var(--eng)">${ic("i-eng")} ${t("eng")} · IELTS</div><div class="mrow2">${eng}</div></a>`:"");
  // habits
  $("#t-habits").innerHTML=S.habits.map(h=>tile(h,tk,70,5)).join("")+`<a class="tile addtile" href="#habits" style="text-decoration:none"><div class="disc"><div class="ic" style="inset:11px">${ic("i-plus","","stroke:var(--t3)")}</div></div><div class="nm">${t("newHabit")}</div></a>`;
  // todos
  const vis=S.todos.filter(x=>!x.done||x.doneDate===tk).sort((a,b)=>(a.done-b.done)||(a.ts-b.ts));const left=vis.filter(x=>!x.done).length;
  $("#td-left").textContent=vis.length?(left?t("left",{n:left}):t("allDone")):"";
  $("#todo-in").placeholder=t("todoPh");
  $("#todo-list").innerHTML=vis.length?vis.map(x=>`<li class="${x.done?"done":""}"><button class="cb ${x.done?"on":""}" data-tg="${x.id}" aria-label="done">${ic("i-check")}</button><span class="t">${esc(x.text)}</span>${!x.done&&x.date<tk?`<span class="when">${fmtDay(x.date)}</span>`:""}<button class="del" data-td="${x.id}" aria-label="${t("del")}">${ic("i-x")}</button></li>`).join(""):`<li class="empty" style="display:block;border:none">${t("noTodo")}</li>`;
  // week
  const wk=weekKeys(),wd=L().wdMon;
  $("#week").innerHTML=wk.map((k,i)=>`<div><div class="d ${k===tk?"today":""}">${wd[i]}</div>${k>tk?`<svg viewBox="0 0 44 44"><circle cx="22" cy="22" r="19" fill="none" stroke="var(--s2)" stroke-width="5"/></svg>`:rings(44,[[studyOn(k)/g,"var(--study)"],[moveOn(k)/mg,"var(--move)"],[habitFrac(k),"var(--habit)"]],5,1.5,false).replace('<svg width="44" height="44"','<svg')}</div>`).join("");
}
function tile(h,k,size,w){const on=hDone(h.id,k);const c=size/2,r=c-w/2-1,C=2*Math.PI*r;const s=streak(h.id);
  return `<button class="tile ${on?"on":""}" data-hk="${h.id}|${k}" style="--hc:${h.color}"><div class="disc"><svg class="r" viewBox="0 0 ${size} ${size}"><circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${h.color}" stroke-opacity=".22" stroke-width="${w}"/><circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${h.color}" stroke-width="${w}" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${on?0:C}" transform="rotate(-90 ${c} ${c})" style="transition:stroke-dashoffset .45s ease"/></svg><div class="ic">${ic(h.icon,"","stroke:"+h.color)}</div></div><div class="nm">${esc(h.name)}</div>${size>80?`<div class="st">${s?t("streak",{n:s}):t("notStarted")}</div>`:""}</button>`;}

// ---------- study ----------
function renderStudy(){
  const tk=today(),wk=weekKeys(),wd=L().wdMon;
  const wv=wk.map(k=>studyOn(k));const tot=wv.reduce((a,b)=>a+b,0);const passed=wk.filter(k=>k<=tk).length||1;
  $("#k-study").innerHTML=`<div><div class="k">${t("total")}</div><div class="v num">${hm(tot)}</div></div><div><div class="k">${t("avg")}</div><div class="v num">${hm(Math.round(tot/passed))}</div></div><div><div class="k">${t("today")}</div><div class="v num">${hm(studyOn(tk))}</div></div>`;
  barChart($("#week-chart"),wk.map((k,i)=>({lbl:wd[i],v:studyOn(k),today:k===tk})),S.settings.goal,"var(--study)",t("min"));
  // heat
  const dow=(new Date().getDay()+6)%7;const start=7*15+dow;let cells="",sum=0;
  const max=Math.max(60,...Array.from({length:start+1},(_,i)=>studyOn(dkey(daysAgo(i)))));
  for(let i=start;i>=-(6-dow);i--){if(i<0){cells+=`<i style="visibility:hidden"></i>`;continue;}const k=dkey(daysAgo(i));const v=studyOn(k);sum+=v;
    const lv=v<=0?0:v<max*.25?1:v<max*.5?2:v<max*.75?3:4;cells+=`<i style="background:${["var(--s2)","#26407a","#3a5fb8","#4b78e6","#7ea6ff"][lv]}" title="${fmtDay(k)}: ${v}"></i>`;}
  $("#heat").innerHTML=cells;$("#heat-total").textContent=hmTxt(sum);
  $("#heat-wd").innerHTML=wd.map((x,i)=>`<span>${i%2===0?x:""}</span>`).join("");
  // subject split
  const cut=dkey(daysAgo(29));const by={};S.study.filter(x=>x.date>=cut).forEach(x=>{const n=x.subject||"—";by[n]=(by[n]||0)+x.min;});
  const arr=Object.entries(by).sort((a,b)=>b[1]-a[1]);const all=arr.reduce((a,x)=>a+x[1],0);
  $("#subj-split").innerHTML=arr.length?`<div class="stack">${arr.map(([n,v])=>`<div style="flex:${v};background:${subjColor(n)}"></div>`).join("")}</div>`+arr.map(([n,v])=>`<div class="srow"><i style="background:${subjColor(n)}"></i><span>${esc(n)}</span><span class="num">${hmTxt(v)} · ${Math.round(v/all*100)}%</span></div>`).join(""):`<div class="empty">${t("subjSplitEmpty")}</div>`;
  // progress
  $("#subj-prog").innerHTML=S.subjects.length?S.subjects.map(s=>{const n=s.topics.length,d=s.topics.filter(x=>x.s===2).length,l=s.topics.filter(x=>x.s===1).length;const cur=s.topics.find(x=>x.s===1);
    return `<button class="subj" data-subj-open="${s.id}"><div class="sh"><i style="background:${s.color}"></i><b>${esc(s.name)}</b><span class="num">${n?Math.round(d/n*100)+"%":""}</span></div><div class="pbar"><div style="width:${n?d/n*100:0}%;background:${s.color}"></div><div style="width:${n?l/n*100:0}%;background:${s.color};opacity:.35"></div></div><div class="ss">${n?(cur?t("now",{x:esc(cur.n)})+" · ":"")+t("mastered",{a:d,b:n}):t("addTopic")+" ›"}</div></button>`;}).join("")+`<button class="subj add" id="add-subj">${ic("i-plus")} ${t("addSubj")}</button>`:`<div class="empty">${t("subjEmpty")}</div><button class="subj add" id="add-subj">${ic("i-plus")} ${t("addSubj")}</button>`;
  // log
  const log=S.study.slice().sort((a,b)=>b.ts-a.ts).slice(0,10);
  $("#study-log").innerHTML=log.length?log.map(x=>`<li><div class="bul" style="background:color-mix(in srgb,${subjColor(x.subject)} 20%,transparent)">${ic("i-focus","","stroke:"+subjColor(x.subject))}</div><div class="mid"><b>${esc(x.subject||"—")}</b><small>${fmtDay(x.date)} ${x.time||""} · ${x.auto?t("pomo"):t("manual")}</small></div><div class="rt num">${x.min} ${t("min")}</div><button class="del" data-sd="${x.id}">${ic("i-x")}</button></li>`).join(""):`<li class="empty" style="display:block">${t("noStudy")}</li>`;
  // chips
  const names=S.subjects.map(s=>s.name);
  $("#subj-chips").innerHTML=names.map(s=>`<button class="chip ${T.subject===s?"on":""}" style="--cc:${subjColor(s)}" data-subj="${esc(s)}">${esc(short(s))}</button>`).join("")+`<button class="chip dashed" id="new-subj">${t("subjPlus")}</button>`;
  drawTimer();
}
const short=s=>s.length>16?s.slice(0,15)+"…":s;

function barChart(el,data,goal,color,unit){
  const W=340,H2=150,pl=34,pr=4,pt=10,pb=22,iw=W-pl-pr,ih=H2-pt-pb;
  const mx=Math.max(goal*1.1,...data.map(d=>d.v),10);const st=mx<=40?10:mx<=80?20:mx<=180?30:mx<=360?60:mx<=1000?200:mx<=2000?500:1000;const top=Math.ceil(mx/st)*st;
  const y=v=>pt+ih-v/top*ih;const bw=iw/data.length;const w=Math.min(22,bw*.5);let s="";
  for(let v=0;v<=top;v+=st)s+=`<line x1="${pl}" x2="${W-pr}" y1="${y(v)}" y2="${y(v)}" stroke="var(--s2)"/><text class="ax" x="${pl-6}" y="${y(v)+4}" text-anchor="end">${v}</text>`;
  if(goal) s+=`<line x1="${pl}" x2="${W-pr}" y1="${y(goal)}" y2="${y(goal)}" stroke="${color}" stroke-opacity=".55" stroke-dasharray="3 4" stroke-width="1.5"/><text class="ax" x="${W-pr}" y="${y(goal)-5}" text-anchor="end" style="fill:${color}">${t("goal")} ${goal}</text>`;
  data.forEach((d,i)=>{const cx=pl+bw*i+bw/2,yy=y(d.v),h=pt+ih-yy;
    if(d.v>0){const r=Math.min(4,h);s+=`<path d="M${cx-w/2},${pt+ih}V${yy+r}Q${cx-w/2},${yy} ${cx-w/2+r},${yy}H${cx+w/2-r}Q${cx+w/2},${yy} ${cx+w/2},${yy+r}V${pt+ih}Z" fill="${color}" opacity="${d.today?1:.55}"/>`;}
    s+=`<text class="ax" x="${cx}" y="${H2-5}" text-anchor="middle" style="${d.today?"fill:var(--t1)":""}">${d.lbl}</text><rect x="${pl+bw*i}" y="${pt}" width="${bw}" height="${ih}" fill="transparent" data-tip="${d.lbl}: ${d.v} ${unit}" data-x="${cx}" data-y="${yy}"/>`;});
  el.innerHTML=`<svg viewBox="0 0 ${W} ${H2}" role="img">${s}</svg><div class="tip"></div><details><summary>${t("showData")}</summary><table>${data.map(d=>`<tr><td>${d.lbl}</td><td>${d.v} ${unit}</td></tr>`).join("")}</table></details>`;tips(el,W);}
H.barChart=barChart;
function lineChart(el,data,color){
  if(data.length<2){el.innerHTML=`<div class="empty">${data.length?t("wEmpty2"):t("wEmpty1")}</div>`;return;}
  const W=340,H2=140,pl=34,pr=8,pt=12,pb=22,iw=W-pl-pr,ih=H2-pt-pb;const vs=data.map(d=>d.kg);
  let lo=Math.min(...vs),hi=Math.max(...vs);const p=Math.max(.5,(hi-lo)*.25);lo=Math.floor((lo-p)*2)/2;hi=Math.ceil((hi+p)*2)/2;
  const x=i=>pl+i/(data.length-1)*iw,y=v=>pt+ih-(v-lo)/(hi-lo)*ih;let s="";
  for(let i=0;i<=3;i++){const v=lo+(hi-lo)*i/3;s+=`<line x1="${pl}" x2="${W-pr}" y1="${y(v)}" y2="${y(v)}" stroke="var(--s2)"/><text class="ax" x="${pl-6}" y="${y(v)+4}" text-anchor="end">${v.toFixed(1)}</text>`;}
  const path=data.map((d,i)=>(i?"L":"M")+x(i).toFixed(1)+","+y(d.kg).toFixed(1)).join(" ");const LL=data.length-1;
  s+=`<defs><linearGradient id="wg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".28"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs><path d="${path} L${x(LL)},${pt+ih} L${x(0)},${pt+ih}Z" fill="url(#wg)"/><path d="${path}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><circle cx="${x(LL)}" cy="${y(data[LL].kg)}" r="5" fill="${color}" stroke="var(--s1)" stroke-width="2.5"/>`;
  s+=`<text class="ax" x="${x(0)}" y="${H2-5}">${fmtDay(data[0].date)}</text><text class="ax" x="${x(LL)}" y="${H2-5}" text-anchor="end">${fmtDay(data[LL].date)}</text>`;
  const half=iw/LL/2;s+=data.map((d,i)=>`<rect x="${x(i)-half}" y="${pt}" width="${half*2}" height="${ih}" fill="transparent" data-tip="${fmtDay(d.date)}: ${d.kg} kg" data-x="${x(i)}" data-y="${y(d.kg)}"/>`).join("");
  el.innerHTML=`<svg viewBox="0 0 ${W} ${H2}" role="img">${s}</svg><div class="tip"></div>`;tips(el,W);}
function tips(el,W){const tip=el.querySelector(".tip"),svg=el.querySelector("svg");el.querySelectorAll("[data-tip]").forEach(r=>{
  const sh=()=>{const sc=svg.getBoundingClientRect().width/W;tip.textContent=r.dataset.tip;tip.style.left=(+r.dataset.x*sc)+"px";tip.style.top=(+r.dataset.y*sc-4)+"px";tip.classList.add("on");};
  r.addEventListener("mouseenter",sh);r.addEventListener("touchstart",sh,{passive:true});r.addEventListener("mouseleave",()=>tip.classList.remove("on"));});}

// ---------- body ----------
const kindName=k=>(L().kinds||{})[k]||k;
function moveLine(w){return w.kind==="力量"?[w.sets&&w.reps?`${w.sets} ${t("sets")} × ${w.reps} ${t("reps")}`:"",w.kg?`${w.kg} kg`:"",w.detail||""].filter(Boolean).join(" · "):[w.km?`${w.km} ${t("km")}`:"",w.detail||""].filter(Boolean).join(" · ");}
function moveItem(w,showDay){return `<li><div class="bul" style="background:color-mix(in srgb,${KIND[w.kind]||KIND.其他} 20%,transparent)">${ic(w.kind==="有氧"?"h-run":"i-move","","stroke:"+(KIND[w.kind]||KIND.其他))}</div><div class="mid"><b>${esc(w.name)}</b><small>${esc(kindName(w.kind))}${moveLine(w)?" · "+esc(moveLine(w)):""}${showDay?" · "+fmtDay(w.date):""}</small></div><div class="rt num">${w.min?w.min+" "+t("min"):""}</div><button class="del" data-wd="${w.id}">${ic("i-x")}</button></li>`;}
function curPlan(){if(!S.plan)return null;const p=DATA.PLANS.find(x=>x.id===S.plan.id);if(!p)return null;const idx=S.plan.idx%p.days.length;return {p,idx,day:p.days[idx]};}
function renderBody(){
  $$("#body-seg button").forEach(b=>b.classList.toggle("on",b.dataset.s===bodySeg));
  $$(".bseg").forEach(x=>x.style.display=x.dataset.s===bodySeg?"block":"none");
  const tk=today(),wk=weekKeys(),wd=L().wdMon;
  // plan
  const cp=curPlan();
  if(!cp){$("#plan-card").innerHTML=`<div class="empty" style="padding:6px 0 12px">${t("noPlan")}</div><button class="pill" id="choose-plan" style="width:100%">${ic("i-list")} ${t("choosePlan")}</button>`;}
  else{const {p,idx,day}=cp;const doneToday=S.plan.doneDate===tk;const sets=(S.planChecks.date===tk&&S.planChecks.sets)||{};
    const exs=day.ex||[];const totalSets=exs.reduce((a,x)=>a+x[1],0),doneSets=exs.reduce((a,x,i)=>a+Math.min(x[1],sets[i]||0),0);
    $("#plan-card").innerHTML=`<div class="ph"><div><div class="k">${esc(pick(p.name))}</div><b>${t("planDay",{n:idx+1,x:esc(day.name?pick(day.name):t("restDay"))})}</b></div><button class="tbtn" id="choose-plan">${t("changePlan")}</button></div>`+
     (doneToday?`<div class="donebox">${ic("i-check")} ${t("planDone")}</div>`:
      (day.rest||!exs.length?"":`${totalSets?`<div class="pbar" style="margin:4px 0 12px"><div style="width:${doneSets/totalSets*100}%;background:var(--move)"></div></div>`:""}
       ${day.warm?`<button class="warmrow" id="open-warm">${ic("i-flame","","stroke:var(--todo)")}<span><b>${{zh:"热身",en:"Warm-up",kk:"Жаттығу алды қыздыру"}[S.settings.lang]}</b><small>${day.warm.map(w=>esc(pick(DATA.WARM[w].name))).join(" · ")}</small></span>${ic("i-chev")}</button>`:""}
       <ul class="exl">${exs.map((e,i)=>{const n=sets[i]||0,full=n>=e[1];return `<li class="${full?"on":""}"><div class="et"><span class="t">${esc(e[0])}</span><span class="num sr">${e[1]} × ${esc(e[2])}${e[3]?` · ${e[3]>=60?(e[3]/60)+"′":e[3]+"″"}`:""}</span></div>${e[4]?`<div class="en">${esc(e[4])}</div>`:""}<div class="setdots">${Array.from({length:e[1]},(_,k)=>`<button class="sd ${k<n?"on":""}" data-set="${i}|${k}" aria-label="set ${k+1}">${k<n?ic("i-check"):k+1}</button>`).join("")}</div></li>`;}).join("")}</ul>`)+
      `<div class="btnrow" style="margin-top:12px"><button class="pill pri" id="plan-finish">${day.rest||!exs.length?t("done"):t("finishDay")}</button><button class="pill" id="plan-skip" style="flex:0 0 auto;padding:14px 18px">${t("skipDay")}</button></div>`);}
  const tm=S.workouts.filter(w=>w.date===tk).sort((a,b)=>b.ts-a.ts);
  $("#mv-today").textContent=tm.length?moveOn(tk)+" / "+S.settings.moveGoal+" "+t("min"):"";
  $("#today-moves").innerHTML=tm.length?tm.map(w=>moveItem(w,false)).join(""):`<li class="empty" style="display:block">${t("noMoveToday")}</li>`;
  const days=new Set(S.workouts.filter(w=>wk.includes(w.date)).map(w=>w.date)).size;
  $("#mv-week").textContent=t("activeDays",{n:days});
  barChart($("#move-chart"),wk.map((k,i)=>({lbl:wd[i],v:moveOn(k),today:k===tk})),S.settings.moveGoal,"var(--move)",t("min"));
  const ws=S.weights.slice().sort((a,b)=>a.date<b.date?-1:1).slice(-30);
  $("#w-kpi").innerHTML=`<div><div class="k">${t("current")}</div><div class="v num">${ws.length?ws[ws.length-1].kg+"<small>kg</small>":"--"}</div></div><div><div class="k">${t("lowest")}</div><div class="v num">${ws.length?Math.min(...ws.map(w=>w.kg))+"<small>kg</small>":"--"}</div></div><div><div class="k">${t("entries")}</div><div class="v num">${S.weights.length}<small>${t("times")}</small></div></div>`;
  $("#w-delta").textContent=ws.length>=2?((ws[ws.length-1].kg-ws[0].kg)>0?"+":"")+(ws[ws.length-1].kg-ws[0].kg).toFixed(1)+" kg":"";
  lineChart($("#w-chart"),ws,"var(--move)");
  const hist=S.workouts.filter(w=>w.date!==tk).sort((a,b)=>b.ts-a.ts).slice(0,25);
  $("#move-log").innerHTML=hist.length?hist.map(w=>moveItem(w,true)).join(""):`<li class="empty" style="display:block">${t("historyEmpty")}</li>`;
  renderFood(); renderFast();
}
function renderFood(){
  const tk=today(),kt=kcalTarget(),kc=kcalOn(tk);
  const frac=kt?kc/kt:0;
  $("#kcal-hero").innerHTML=`<div class="khero">${rings(132,[[Math.min(frac,1),kc>kt&&kt?"var(--move)":"var(--todo)"]],14,0,false)}<div class="kc"><div class="num" style="font-size:30px;line-height:1">${kt?Math.abs(kt-kc):kc}</div><div class="ms">${kt?(kc<=kt?t("remain"):t("over")):t("eaten")} · ${t("kcal")}</div></div></div>
   <div class="kpi" style="margin:0;flex-direction:column;gap:10px"><div><div class="k">${t("eaten")}</div><div class="v num">${kc}<small>${t("kcal")}</small></div></div><div><div class="k">${t("target")}</div><div class="v num">${kt||"--"}<small>${kt?t("kcal"):""}</small></div></div></div>`;
  $("#kcal-note").innerHTML=kt?"":`<button class="linkbtn" data-open-settings>${t("setProfile")} ›</button>`;
  const items=S.food.filter(f=>f.date===tk);
  $("#meals").innerHTML=items.length?L().meals.map((m,i)=>{const its=items.filter(f=>f.meal===i);if(!its.length)return"";const sum=its.reduce((a,f)=>a+f.kcal,0);
    return `<div class="meal"><div class="mh"><b>${m}</b><span class="num">${sum} ${t("kcal")}</span></div><ul class="log">${its.map(f=>{const fd=f.fid&&DATA.FOODS.find(x=>x[0]===f.fid);return `<li><div class="mid"><b>${esc(fd?foodName(fd):f.name)}</b><small>${fd?(f.qty!==1?f.qty+" × ":"")+esc(foodUnit(fd)):t("custom")}</small></div><div class="rt num">${f.kcal}</div><button class="del" data-fd="${f.id}">${ic("i-x")}</button></li>`;}).join("")}</ul></div>`;}).join(""):`<div class="empty">${t("noFood")}</div>`;
  const wk=weekKeys(),wd=L().wdMon;
  barChart($("#kcal-chart"),wk.map((k,i)=>({lbl:wd[i],v:kcalOn(k),today:k===tk})),kt,"var(--todo)",t("kcal"));
}
function fastState(){const f=S.fast,H8=S.settings.fastH,now=Date.now();
  if(f.on){const el=(now-f.start)/3600000;return {on:true,el,frac:el/H8,big:fmtHM(el*60),small:el>=H8?t("fastReached",{h:H8}):t("remaining")+" "+fmtHM((H8-el)*60)};}
  if(f.lastEnd){const el=(now-f.lastEnd)/3600000,win=24-H8;if(el<win)return {on:false,el,frac:el/win,big:fmtHM((win-el)*60),small:t("eatingNow")};return {on:false,frac:0,big:"--",small:t("windowOver")};}
  return {on:false,frac:0,big:"--",small:t("notFasting")};}
const fmtHM=m=>{m=Math.max(0,Math.floor(m));return Math.floor(m/60)+":"+pad(m%60);};
function renderFast(){
  const fs=fastState(),H8=S.settings.fastH,f=S.fast;
  const col=fs.on?"var(--fast)":"var(--todo)";
  $("#fast-hero").innerHTML=`<div class="fring">${rings(240,[[fs.frac,col]],18,0,false)}<div class="fc"><div class="ms" style="color:${col}">${fs.on?t("fastingNow"):f.lastEnd&&fs.big!=="--"?t("eatingNow"):""}</div><div class="num" style="font-size:46px;line-height:1.05">${fs.on?fmtHM(fs.el*60):fs.big}</div><div class="ms">${esc(fs.on?fs.small:fs.big!=="--"?t("windowLeft",{t:fs.big}):fs.small)}</div></div></div>
   ${fs.on?`<div class="ftimes"><div><div class="k">${t("startFast")}</div><b class="num">${tm(f.start)}</b></div><div><div class="k">${H8}h</div><b class="num">${tm(f.start+H8*3600000)}</b></div></div>`:""}
   <button class="go" id="fast-toggle" style="background:${fs.on?"var(--s2)":"var(--fast)"};color:${fs.on?"var(--t1)":"#000"}">${fs.on?t("endFast"):t("startFast")}</button>
   <div class="dur" id="fast-plan">${[14,16,18,20].map(h=>`<button data-fh="${h}" class="${H8===h?"on":""}">${h}:${24-h}</button>`).join("")}</div>`;
  const last=S.fasts.slice(-7);
  $("#fast-hist").innerHTML=last.length?`<div class="fbars">${last.map(x=>{const h=(x.e-x.s)/3600000;return `<div><div class="fb"><i style="height:${Math.min(100,h/24*100)}%;background:${h>=H8?"var(--fast)":"var(--s3)"}"></i></div><div class="num">${h.toFixed(1)}</div><small>${fmtDay(dkey(new Date(x.e)))}</small></div>`;}).join("")}</div>`:`<div class="empty">—</div>`;
}
const tm=ts=>{const d=new Date(ts);return pad(d.getHours())+":"+pad(d.getMinutes());};

// ---------- habits ----------
function renderHabits(){
  const tk=today();$("#h-wrap").classList.toggle("editing",editing);$("#h-edit").textContent=editing?t("done"):t("edit");
  $("#h-grid").innerHTML=S.habits.map(h=>tile(h,tk,88,6).replace('<div class="disc">',`<div class="disc"><span class="x" data-hdel="${h.id}">${ic("i-x")}</span>`)).join("")+`<button class="tile addtile" id="add-habit"><div class="disc"><div class="ic">${ic("i-plus","","stroke:var(--t3)")}</div></div><div class="nm">${t("add")}</div></button>`;
  const days=[];for(let i=27;i>=0;i--)days.push(dkey(daysAgo(i)));
  $("#h-month").innerHTML=S.habits.length?S.habits.map(h=>`<div class="mrow">${ic(h.icon,"hi","stroke:"+h.color)}<div class="mcells">${days.map(k=>`<i style="${hDone(h.id,k)?"background:"+h.color:""}"></i>`).join("")}</div></div>`).join(""):`<div class="empty">${t("habitsEmpty")}</div>`;
}

// ---------- sheet ----------
const openSheet=H.openSheet=(html,onMount,full)=>{$("#sheet-body").innerHTML=html;$("#sheet").classList.toggle("full",!!full);$("#scrim").classList.add("on");$("#sheet").classList.add("on");onMount&&onMount();};
const closeSheet=H.closeSheet=()=>{$("#scrim").classList.remove("on");$("#sheet").classList.remove("on");if(H.onSheetClose){const f=H.onSheetClose;H.onSheetClose=null;f();}};
$("#scrim").addEventListener("click",closeSheet);
document.addEventListener("keydown",e=>{if(e.key==="Escape")closeSheet();});
const stepper=H.stepper=(f,lbl,val,step)=>`<div class="step"><div class="sv"><button type="button" data-step="${f}|-${step}">−</button><input id="st-${f}" inputmode="decimal" value="${val}"><button type="button" data-step="${f}|${step}">+</button></div><div class="sl">${lbl}</div></div>`;
const head=(title)=>`<h3>${title}<button data-close>${t("cancel")}</button></h3>`;

function workoutSheet(){
  const recent=[...new Set(S.workouts.slice().sort((a,b)=>b.ts-a.ts).map(w=>w.name))];
  const presets=["卧推","深蹲","硬拉","引体向上","俯卧撑","跑步","跳绳","骑车","游泳","篮球","足球","拉伸"];
  const quick=[...new Set([...recent,...presets])].slice(0,14);let kind="力量";
  openSheet(head(t("logWorkout"))+`<div class="seg" id="w-kind" style="margin:0;flex-wrap:wrap;width:auto">${Object.keys(KIND).map(k=>`<button data-k="${k}" class="${k===kind?"on":""}">${kindName(k)}</button>`).join("")}</div>
    <div class="fl">${t("exercise")}</div><input class="field" id="w-name" placeholder="${t("exercisePh")}" maxlength="30">
    <div class="chips" style="justify-content:flex-start;margin-top:10px" id="w-quick">${quick.map(q=>`<button class="chip" data-q="${esc(q)}">${esc(q)}</button>`).join("")}</div>
    <div class="hint" id="w-last"></div><div id="w-detail"></div><button class="go" id="w-save" style="background:var(--move)">${t("save")}</button>`,()=>{
    const setKind=k=>{kind=k;$$("#w-kind button").forEach(b=>b.classList.toggle("on",b.dataset.k===kind));det();};
    const det=()=>{$("#w-detail").innerHTML=kind==="力量"?`<div class="fl">${t("setsRepsKg")}</div><div class="steps">${stepper("sets",t("sets"),4,1)}${stepper("reps",t("reps"),10,1)}${stepper("kg","kg",20,2.5)}</div><div class="fl">${t("duration")}</div><div class="steps" style="grid-template-columns:1fr">${stepper("min",t("min"),20,5)}</div>`
      :`<div class="fl">${t("duration")}${kind==="有氧"?" / "+t("distance"):""}</div><div class="steps" style="grid-template-columns:${kind==="有氧"?"1fr 1fr":"1fr"}">${stepper("min",t("min"),30,5)}${kind==="有氧"?stepper("km",t("km"),3,.5):""}</div><div class="fl">${t("note")}</div><input class="field" id="w-note" placeholder="${t("optional")}" maxlength="40">`;};
    det();
    const last=()=>{const n=$("#w-name").value.trim();const p=n&&S.workouts.slice().sort((a,b)=>b.ts-a.ts).find(w=>w.name===n);
      $("#w-last").textContent=p?t("lastTime",{d:fmtDay(p.date),x:moveLine(p)||p.min+" "+t("min")}):"";
      if(p){setKind(p.kind);["sets","reps","kg","min","km"].forEach(f=>{const el=$("#st-"+f);if(el&&p[f])el.value=p[f];});}};
    $("#w-kind").onclick=e=>{const b=e.target.closest("button");if(b)setKind(b.dataset.k);};
    $("#w-quick").onclick=e=>{const b=e.target.closest("[data-q]");if(!b)return;$("#w-name").value=b.dataset.q;$$("#w-quick .chip").forEach(x=>x.classList.toggle("on",x===b));
      if(!S.workouts.some(w=>w.name===b.dataset.q)){const q=b.dataset.q;if(["跑步","跳绳","骑车","游泳"].includes(q))setKind("有氧");else if(["篮球","足球"].includes(q))setKind("球类");else if(q==="拉伸")setKind("拉伸");}last();};
    $("#w-name").addEventListener("change",last);
    $("#w-save").onclick=()=>{const n=$("#w-name").value.trim();if(!n){$("#w-name").focus();toast(t("needExercise"));return;}
      const v=f=>{const el=$("#st-"+f);return el?Math.max(0,parseFloat(el.value)||0):0;};
      const w={id:uid(),kind,name:n,date:today(),ts:Date.now(),min:Math.round(v("min"))};
      if(kind==="力量"){w.sets=v("sets");w.reps=v("reps");w.kg=v("kg");}else{if(kind==="有氧")w.km=v("km");w.detail=($("#w-note")||{}).value||"";}
      S.workouts.push(w);save();closeSheet();toast(t("logged",{x:n}));};
  });}
function weightSheet(){const last=S.weights.slice().sort((a,b)=>a.date<b.date?-1:1).pop();
  openSheet(head(t("logWeight"))+`<div class="steps" style="grid-template-columns:1fr">${stepper("w","kg",last?last.kg:(S.profile.w||65),.1)}</div><div class="hint">${last?t("lastTime",{d:fmtDay(last.date),x:last.kg+" kg"}):t("wSameDay")}</div><button class="go" id="wt-save" style="background:var(--move)">${t("save")}</button>`,()=>{
    $("#wt-save").onclick=()=>{const v=parseFloat($("#st-w").value);if(!(v>20&&v<300)){toast(t("wBad"));return;}const tk=today();S.weights=S.weights.filter(w=>w.date!==tk);S.weights.push({date:tk,kg:Math.round(v*10)/10});save();closeSheet();toast(t("logged",{x:v.toFixed(1)+" kg"}));};});}
function planSheet(){
  openSheet(head(t("choosePlan"))+DATA.PLANS.map(p=>`<div class="plan-opt"><div class="ph"><div><b>${esc(pick(p.name))}</b><div class="k">${t("planBy",{x:esc(p.author)})} · ${t("planCycle",{n:p.days.length})}</div></div><button class="tbtn" data-use-plan="${p.id}">${t("startPlan")}</button></div><div class="pdays">${p.days.map((d,i)=>`<button class="pday ${S.plan&&S.plan.id===p.id&&S.plan.idx%p.days.length===i?"on":""}" data-plan-day="${p.id}|${i}"><span class="num">${i+1}</span>${esc(d.name?pick(d.name):t("restDay"))}</button>`).join("")}</div></div>`).join("")+`<div class="hint">${t("chooseDay")}</div>`);}
function foodSheet(){
  const h=new Date().getHours();let meal=h<11?0:h<16?1:h<21?2:3,cat=h<11?"c":0,sel=null;
  openSheet(head(t("logFood"))+`<div class="seg" id="f-meal" style="margin:0 0 12px;width:auto">${L().meals.map((m,i)=>`<button data-m="${i}" class="${i===meal?"on":""}">${m}</button>`).join("")}</div>
   <input class="field" id="f-q" placeholder="${t("searchFood")}" autocomplete="off">
   <div class="chips" style="justify-content:flex-start;margin:10px 0 4px" id="f-cat"><button class="chip ${cat==="c"?"on":""}" data-c="c" style="--cc:var(--todo)">${{zh:"早餐套餐",en:"Breakfast combos",kk:"Таңғы ас жиындары"}[S.settings.lang]}</button>${L().cats.map((c,i)=>`<button class="chip ${i===cat?"on":""}" data-c="${i}" style="--cc:var(--todo)">${c}</button>`).join("")}<button class="chip dashed" data-c="x">${t("custom")}</button></div>
   <div id="f-list" class="flist"></div><div id="f-pick"></div><div class="hint">${t("approx")}</div>`,()=>{
    const list=()=>{const q=$("#f-q").value.trim().toLowerCase();
      if(cat==="x"){$("#f-list").innerHTML=`<div class="fl">${t("customName")}</div><input class="field" id="fc-n" maxlength="30"><div class="fl">${t("kcal")}</div><div class="steps" style="grid-template-columns:1fr">${stepper("fk",t("kcal"),200,10)}</div><button class="go" id="fc-save" style="background:var(--todo)">${t("save")}</button>`;
        $("#fc-save").onclick=()=>{const n=$("#fc-n").value.trim();const k=Math.round(parseFloat($("#st-fk").value)||0);if(!n||!(k>0))return;S.food.push({id:uid(),date:today(),meal,name:n,kcal:k,qty:1,ts:Date.now()});save();closeSheet();toast(t("logged",{x:n}));};return;}
      if(cat==="c"&&!q){$("#f-list").innerHTML=DATA.COMBOS.map(c=>{const k=c.items.reduce((s,[id,n])=>s+DATA.FOODS.find(f=>f[0]===id)[5]*n,0);return `<button class="fitem combo" data-combo="${c.id}"><span><b>${esc(pick(c.name))}</b><small>${esc(pick(c.note))} · ~${c.p}g ${{zh:"蛋白质",en:"protein",kk:"ақуыз"}[S.settings.lang]}</small></span><span class="num">${k}</span></button>`;}).join("");return;}
      const fs=DATA.FOODS.filter(f=>q?(f[1]+f[2]+f[3]).toLowerCase().includes(q):f[6]===cat);
      $("#f-list").innerHTML=fs.map(f=>`<button class="fitem ${sel&&sel[0]===f[0]?"on":""}" data-fid="${f[0]}"><span><b>${esc(foodName(f))}</b><small>${esc(foodUnit(f))}</small></span><span class="num">${f[5]}</span></button>`).join("");};
    const pickF=()=>{if(!sel){$("#f-pick").innerHTML="";return;}$("#f-pick").innerHTML=`<div class="fpick"><b>${esc(foodName(sel))}</b><div class="steps" style="grid-template-columns:1fr;margin-top:8px">${stepper("fq",t("servings")+" · "+esc(foodUnit(sel)),1,.5)}</div><button class="go" id="f-save" style="background:var(--todo)">${t("save")} · <span id="f-tot">${sel[5]}</span> ${t("kcal")}</button></div>`;
      const upd=()=>{$("#f-tot").textContent=Math.round(sel[5]*(parseFloat($("#st-fq").value)||0));};$("#f-pick").addEventListener("click",()=>setTimeout(upd,0));$("#st-fq").addEventListener("input",upd);
      $("#f-save").onclick=()=>{const qn=parseFloat($("#st-fq").value)||0;if(!(qn>0))return;S.food.push({id:uid(),date:today(),meal,fid:sel[0],qty:qn,kcal:Math.round(sel[5]*qn),ts:Date.now()});save();closeSheet();toast(t("logged",{x:foodName(sel)}));};
      $("#f-pick").scrollIntoView({behavior:"smooth",block:"nearest"});};
    list();
    $("#f-meal").onclick=e=>{const b=e.target.closest("button");if(!b)return;meal=+b.dataset.m;$$("#f-meal button").forEach(x=>x.classList.toggle("on",x===b));};
    $("#f-cat").onclick=e=>{const b=e.target.closest("button");if(!b)return;cat=b.dataset.c==="x"||b.dataset.c==="c"?b.dataset.c:+b.dataset.c;$$("#f-cat .chip").forEach(x=>x.classList.toggle("on",x===b));$("#f-q").value="";sel=null;pickF();list();};
    $("#f-q").addEventListener("input",()=>{if(cat==="x")cat=0;list();});
    $("#f-list").addEventListener("click",e=>{const cb=e.target.closest("[data-combo]");if(cb){const c=DATA.COMBOS.find(x=>x.id===cb.dataset.combo);const now=Date.now();c.items.forEach(([id,n],i)=>{const f=DATA.FOODS.find(x=>x[0]===id);S.food.push({id:uid(),date:today(),meal,fid:id,qty:n,kcal:Math.round(f[5]*n),ts:now+i});});save();closeSheet();toast(t("logged",{x:pick(c.name)}));return;}
      const b=e.target.closest("[data-fid]");if(!b)return;sel=DATA.FOODS.find(f=>f[0]===b.dataset.fid);$$(".fitem").forEach(x=>x.classList.toggle("on",x===b));pickF();});
  });}
function habitSheet(){let icon=HICONS[S.habits.length%HICONS.length],color=HCOLORS[S.habits.length%HCOLORS.length];
  openSheet(head(t("newHabitT"))+`<input class="field" id="hn" placeholder="${t("habitPh")}" maxlength="20"><div class="fl">${t("icon")}</div><div class="icpick" id="hip">${HICONS.map(i=>`<button data-i="${i}" class="${i===icon?"on":""}">${ic(i)}</button>`).join("")}</div><div class="fl">${t("color")}</div><div class="colpick" id="hcp">${HCOLORS.map(c=>`<button data-c="${c}" class="${c===color?"on":""}" style="background:${c}"></button>`).join("")}</div><button class="go" id="h-save">${t("addHabit")}</button>`,()=>{
    $("#hip").onclick=e=>{const b=e.target.closest("button");if(!b)return;icon=b.dataset.i;$$("#hip button").forEach(x=>x.classList.toggle("on",x===b));};
    $("#hcp").onclick=e=>{const b=e.target.closest("button");if(!b)return;color=b.dataset.c;$$("#hcp button").forEach(x=>x.classList.toggle("on",x===b));};
    $("#h-save").onclick=()=>{const n=$("#hn").value.trim();if(!n){$("#hn").focus();return;}S.habits.push({id:uid(),name:n,icon,color});save();closeSheet();toast(t("logged",{x:n}));};});}
function manualSheet(){openSheet(head(t("manualT"))+`<input class="field" id="ms" placeholder="${t("subject")}" maxlength="40" value="${esc(T.subject||"")}"><div class="chips" style="justify-content:flex-start;margin-top:10px" id="msq">${S.subjects.map(s=>`<button class="chip" data-q="${esc(s.name)}" style="--cc:${s.color}">${esc(short(s.name))}</button>`).join("")}</div><div class="fl">${t("duration")}</div><div class="steps" style="grid-template-columns:1fr">${stepper("sm",t("min"),30,5)}</div><button class="go" id="ms-save" style="background:var(--study)">${t("save")}</button>`,()=>{
  $("#msq").onclick=e=>{const b=e.target.closest("[data-q]");if(b){$("#ms").value=b.dataset.q;$$("#msq .chip").forEach(x=>x.classList.toggle("on",x===b));}};
  $("#ms-save").onclick=()=>{const m=Math.round(parseFloat($("#st-sm").value));if(!(m>0))return;H.addStudy(m,$("#ms").value.trim(),false);closeSheet();toast(t("logged",{x:m+" "+t("min")}));};});}
function newSubjSheet(){openSheet(head(t("newSubj"))+`<input class="field" id="ns" placeholder="${t("subjPh")}" maxlength="60"><button class="go" id="ns-save" style="background:var(--study)">${t("addSubj")}</button>`,()=>{
  $("#ns-save").onclick=()=>{const n=$("#ns").value.trim();if(!n)return;S.subjects.push({id:uid(),name:n,color:SCOLORS[S.subjects.length%SCOLORS.length],topics:[]});save();closeSheet();};setTimeout(()=>$("#ns").focus(),300);});}
function subjSheet(id){const s=S.subjects.find(x=>x.id===id);if(!s)return;
  const body=()=>`<h3 style="align-items:flex-start;gap:10px"><span style="display:flex;gap:10px;align-items:center"><i style="width:12px;height:12px;border-radius:4px;background:${s.color};flex:0 0 12px"></i>${esc(s.name)}</span><button data-close>${t("close")}</button></h3>
   <div class="hint" style="margin:-8px 0 10px">${s.tag?esc(s.tag)+" · ":""}${t("tapCycle")}</div>
   <ul class="topics">${s.topics.map((x,i)=>`<li><button class="tp s${x.s}" data-tp="${i}" style="--sc:${s.color}"><span class="dot"></span><span class="t">${esc(x.n)}</span><span class="st">${t("st"+x.s)}</span></button><button class="del" data-tpdel="${i}">${ic("i-x")}</button></li>`).join("")}</ul>
   <form class="add" id="tp-form" style="margin-top:10px"><input id="tp-in" placeholder="${t("topicPh")}" maxlength="60" autocomplete="off"><button class="plus">${ic("i-plus")}</button></form>
   <button class="pill" id="tp-ai" style="width:100%;margin-top:10px">${ic("i-spark")} <span>${{zh:"用 AI 生成常见章节",en:"Suggest topics with AI",kk:"AI арқылы тақырып ұсыну"}[S.settings.lang]}</span></button>
   <button class="linkbtn danger" id="subj-del" style="margin-top:16px">${t("deleteSubj")}</button>`;
  const mount=()=>{
    $("#sheet-body").onclick=e=>{const b=e.target.closest("[data-tp],[data-tpdel]");if(!b)return;
      if(b.dataset.tp!==undefined){const x=s.topics[+b.dataset.tp];x.s=(x.s+1)%3;}else s.topics.splice(+b.dataset.tpdel,1);save();re();};
    $("#tp-form").onsubmit=e=>{e.preventDefault();const v=$("#tp-in").value.trim();if(!v)return;s.topics.push({id:uid(),n:v,s:0});save();re();setTimeout(()=>$("#tp-in").focus(),0);};
    $("#tp-ai").onclick=async()=>{const b=$("#tp-ai");b.disabled=true;b.querySelector("span").textContent=t("generating");
      try{const lang={zh:"Chinese",en:"English",kk:"Kazakh"}[S.settings.lang];
        const arr=await H.aiJson(`A university student in Kazakhstan (aerospace engineering, courses taught in Kazakh) takes the course "${s.name}". List the 10-14 main topics of a typical syllabus for this course, in teaching order. Write each topic title in Kazakh${lang!=="Kazakh"?` followed by a short ${lang} translation in parentheses`:""}, under 60 characters. Reply with only a JSON array of strings.`,{modelTier:"default"});
        if(Array.isArray(arr)){arr.slice(0,16).forEach(x=>{const n=String(x).trim();if(n&&!s.topics.some(y=>y.n===n))s.topics.push({id:uid(),n,s:0});});save();re();}
      }catch(e){toast(H.aiErr(e));b.disabled=false;b.querySelector("span").textContent=t("tryAgain");}};
    $("#subj-del").onclick=()=>openSheet(`<h3>${t("delSubjQ",{x:esc(s.name)})}<button data-close>${t("cancel")}</button></h3><div class="hint">${t("delSubjHint")}</div><button class="go" id="sd-ok" style="background:var(--move)">${t("del")}</button>`,()=>{$("#sd-ok").onclick=()=>{S.subjects=S.subjects.filter(x=>x.id!==s.id);save();closeSheet();};});
  };
  const re=()=>{const y=$("#sheet .in").scrollTop;$("#sheet-body").innerHTML=body();mount();$("#sheet .in").scrollTop=y;};
  openSheet(body(),mount);
}
function settingsSheet(){const p=S.profile,st=S.settings;
  openSheet(`<h3>${t("settings")}<button data-close>${t("done")}</button></h3>
   <div class="fl">${t("language")}</div><div class="seg" id="s-lang" style="margin:0;width:auto">${["zh","en","kk"].map(l=>`<button data-l="${l}" class="${st.lang===l?"on":""}">${I18N[l]._name}</button>`).join("")}</div>
   <div class="fl">${t("body")}</div>
   <div class="seg" id="s-sex" style="margin:0 0 8px;width:auto"><button data-v="m" class="${p.sex!=="f"?"on":""}">${t("male")}</button><button data-v="f" class="${p.sex==="f"?"on":""}">${t("female")}</button></div>
   <div class="steps">${stepper("age",t("age"),p.age||20,1)}${stepper("h",t("heightCm"),p.h||175,1)}${stepper("pw",t("weightKg"),latestWeight()||70,.5)}</div>
   <div class="fl">${t("activity")}</div><div class="chips" style="justify-content:flex-start;margin:0" id="s-act">${L().acts.map((a,i)=>`<button class="chip ${p.act===i?"on":""}" data-v="${i}">${a}</button>`).join("")}</div>
   <div class="fl">${t("wgoal")}</div><div class="chips" style="justify-content:flex-start;margin:0" id="s-goal">${L().wgoals.map((a,i)=>`<button class="chip ${(p.goal??1)===i?"on":""}" data-v="${i}">${a}</button>`).join("")}</div>
   <div class="hint" id="s-kcal"></div>
   <div class="fl">${t("goal")}</div><div class="steps" style="grid-template-columns:1fr 1fr">${stepper("sg",t("studyGoal"),st.goal,10)}${stepper("mg",t("moveGoal"),st.moveGoal,5)}</div>
   <button class="go" id="s-save">${t("save")}</button>`,()=>{
    const grp=(id,fn)=>{$(id).onclick=e=>{const b=e.target.closest("button");if(!b)return;$$(id+" button").forEach(x=>x.classList.toggle("on",x===b));fn(b);upd();};};
    let tmp={sex:p.sex,act:p.act||0,goal:p.goal??1};
    const upd=()=>{const save0=Object.assign({},S.profile);Object.assign(S.profile,tmp,{age:+$("#st-age").value,h:+$("#st-h").value,w:+$("#st-pw").value});const k=kcalTarget();Object.assign(S.profile,save0);$("#s-kcal").textContent=k?t("dailyTarget",{k}):"";};
    grp("#s-sex",b=>tmp.sex=b.dataset.v);grp("#s-act",b=>tmp.act=+b.dataset.v);grp("#s-goal",b=>tmp.goal=+b.dataset.v);
    $("#s-lang").onclick=e=>{const b=e.target.closest("button");if(!b)return;S.settings.lang=b.dataset.l;save();settingsSheet();};
    $("#sheet-body").addEventListener("click",()=>setTimeout(upd,0));$("#sheet-body").addEventListener("input",upd);upd();
    $("#s-save").onclick=()=>{Object.assign(S.profile,tmp,{age:+$("#st-age").value||0,h:+$("#st-h").value||0,w:+$("#st-pw").value||0});
      if(!S.weights.length&&S.profile.w>0)S.weights.push({date:today(),kg:S.profile.w});
      S.settings.goal=Math.max(10,+$("#st-sg").value||120);S.settings.moveGoal=Math.max(5,+$("#st-mg").value||30);save();closeSheet();};
  });}

// ---------- rest timer & warm-up ----------
let rest=null;
function startRest(sec,name){rest={end:Date.now()+sec*1000,total:sec,name};try{actx=actx||new(window.AudioContext||window.webkitAudioContext)();actx.resume&&actx.resume();}catch(e){}drawRest();}
function drawRest(){const el=$("#restbar");if(!rest){el.classList.remove("on");return;}const l=Math.max(0,Math.round((rest.end-Date.now())/1000));
  if(l<=0){rest=null;el.classList.remove("on");beep();toast({zh:"休息结束，开始下一组",en:"Rest over, next set",kk:"Демалыс бітті, келесі тәсіл"}[S.settings.lang]);return;}
  el.classList.add("on");el.innerHTML=`<div class="rb-fill" style="width:${(1-l/rest.total)*100}%"></div><div class="rb-in"><span>${{zh:"组间休息",en:"Rest",kk:"Демалыс"}[S.settings.lang]}</span><b class="num">${Math.floor(l/60)}:${pad(l%60)}</b><button id="rest-plus">+15″</button><button id="rest-skip">${t("skipDay")}</button></div>`;}
H.restTick=()=>{if(rest)drawRest();};
function warmSheet(){const cp=curPlan();if(!cp||!cp.day.warm)return;
  openSheet(head({zh:"热身",en:"Warm-up",kk:"Қыздыру"}[S.settings.lang])+cp.day.warm.map((w,i)=>{const x=DATA.WARM[w];return `<div class="warm"><svg viewBox="0 0 200 160" class="fig">${x.svg}</svg><div><div class="k num">${i+1}</div><b>${esc(pick(x.name))}</b><div class="ms">${esc(pick(x.reps))}</div></div></div>`;}).join(""));}

// ---------- events ----------
document.addEventListener("click",e=>{
  const a=e.target.closest("[data-seg]");if(a){bodySeg=a.dataset.seg;renderBody();}
  const b=e.target.closest("button,[data-hdel],[data-pex]");if(!b)return;const d=b.dataset;
  if(d.close!==undefined){closeSheet();return;}
  if(d.step){const[f,s]=d.step.split("|");const el=$("#st-"+f);const dec=(s.split(".")[1]||"").length;el.value=Math.max(0,+((parseFloat(el.value)||0)+parseFloat(s)).toFixed(dec));el.dispatchEvent(new Event("input",{bubbles:true}));return;}
  if(d.openSettings!==undefined){settingsSheet();return;}
  if(d.hdel){const h=S.habits.find(x=>x.id===d.hdel);if(!h)return;e.stopPropagation();
    openSheet(`<h3>${t("delHabitQ",{x:esc(h.name)})}<button data-close>${t("cancel")}</button></h3><div class="hint">${t("delHabitHint")}</div><button class="go" id="hdel-ok" style="background:var(--move)">${t("del")}</button>`,()=>{
      $("#hdel-ok").onclick=()=>{S.habits=S.habits.filter(x=>x.id!==h.id);Object.keys(S.habitLog).forEach(k=>{S.habitLog[k]=S.habitLog[k].filter(x=>x!==h.id);if(!S.habitLog[k].length)delete S.habitLog[k];});save();closeSheet();};});return;}
  if(d.hk){if(editing)return;const[id,k]=d.hk.split("|");const arr=S.habitLog[k]||(S.habitLog[k]=[]);const i=arr.indexOf(id);
    if(i>=0)arr.splice(i,1);else{arr.push(id);const s=streak(id);toast(s>1?t("streak",{n:s}):t("checked"));}
    if(!arr.length)delete S.habitLog[k];save();$$(`[data-hk="${d.hk}"] .disc`).forEach(x=>x.classList.add("pop"));return;}
  if(d.tg){const x=S.todos.find(q=>q.id===d.tg);if(x){x.done=!x.done;x.doneDate=x.done?today():null;save();}return;}
  if(d.td){S.todos=S.todos.filter(q=>q.id!==d.td);save();return;}
  if(d.sd){S.study=S.study.filter(x=>x.id!==d.sd);save();return;}
  if(d.wd){S.workouts=S.workouts.filter(x=>x.id!==d.wd);save();return;}
  if(d.fd){S.food=S.food.filter(x=>x.id!==d.fd);save();return;}
  if(d.subj!==undefined){if(T.running)return;T.subject=T.subject===d.subj?"":d.subj;persistT();renderStudy();return;}
  if(d.subjOpen){subjSheet(d.subjOpen);return;}
  if(d.set){const[i,k]=d.set.split("|").map(Number);const tk=today();if(S.planChecks.date!==tk||!S.planChecks.sets)S.planChecks={date:tk,sets:{}};const sets=S.planChecks.sets;const cur=sets[i]||0;
    if(k<cur){sets[i]=k;rest=null;}else{sets[i]=k+1;const cp=curPlan();const ex=cp&&cp.day.ex[i];if(ex&&ex[3]&&!(i===cp.day.ex.length-1&&k+1>=ex[1]))startRest(ex[3],ex[0]);}save();return;}
  if(d.pex!==undefined){const tk=today();if(S.planChecks.date!==tk)S.planChecks={date:tk,c:[]};const i=+d.pex,c=S.planChecks.c,j=c.indexOf(i);if(j>=0)c.splice(j,1);else c.push(i);save();return;}
  if(d.usePlan){S.plan={id:d.usePlan,idx:0,doneDate:null};save();closeSheet();return;}
  if(d.planDay){const[id,i]=d.planDay.split("|");S.plan={id,idx:+i,doneDate:null};S.planChecks={};save();closeSheet();return;}
  if(d.fh){S.settings.fastH=+d.fh;save();return;}
  switch(b.id){
    case "new-subj": case "add-subj": newSubjSheet();break;
    case "add-habit": habitSheet();break;
    case "open-workout": workoutSheet();break;
    case "open-weight": weightSheet();break;
    case "open-food": foodSheet();break;
    case "open-manual": manualSheet();break;
    case "open-settings": settingsSheet();break;
    case "choose-plan": planSheet();break;
    case "open-warm": warmSheet();break;
    case "rest-skip": rest=null;drawRest();break;
    case "rest-plus": if(rest){rest.end+=15000;rest.total+=15;drawRest();}break;
    case "h-edit": editing=!editing;renderHabits();break;
    case "plan-skip": if(S.plan){S.plan.idx++;S.planChecks={};save();}break;
    case "plan-finish": {const cp=curPlan();if(!cp)break;const tk=today();
      if(!cp.day.rest&&cp.day.ex&&cp.day.ex.length){const sets=(S.planChecks.date===tk&&S.planChecks.sets)||{};const done=cp.day.ex.filter((x,i)=>sets[i]>0);const list=done.length?done:cp.day.ex;
        const nSets=done.length?done.reduce((a,x)=>a+Math.min(x[1],sets[cp.day.ex.indexOf(x)]),0):cp.day.ex.reduce((a,x)=>a+x[1],0);
        S.workouts.push({id:uid(),kind:"力量",name:pick(cp.day.name),date:tk,ts:Date.now(),min:Math.max(30,Math.round(nSets*2.5)),detail:list.map(x=>x[0]).join("、")});toast(t("logged",{x:pick(cp.day.name)}));}
      S.plan.idx++;S.plan.doneDate=tk;S.planChecks={};rest=null;save();break;}
    case "fast-toggle": {const f=S.fast;if(f.on){const now=Date.now();S.fasts.push({s:f.start,e:now});if(S.fasts.length>60)S.fasts=S.fasts.slice(-60);f.on=false;f.lastEnd=now;toast(t("fastEnded",{t:fmtHM((now-f.start)/60000)}));}else{f.on=true;f.start=Date.now();toast(t("fastStarted"));}save();break;}
  }
});
$("#todo-form").addEventListener("submit",e=>{e.preventDefault();const v=$("#todo-in").value.trim();if(!v)return;S.todos.push({id:uid(),text:v,done:false,date:today(),ts:Date.now()});$("#todo-in").value="";save();});
$("#body-seg").addEventListener("click",e=>{const b=e.target.closest("button");if(!b)return;bodySeg=b.dataset.s;renderBody();});

// ---------- timer ----------
const TK="efficiency-hub-timer";
let T={mode:"focus",running:false,paused:false,endAt:0,left:0,total:0,subject:""};
try{const x=JSON.parse(localStorage.getItem(TK));if(x)T=Object.assign(T,x);}catch(e){}
function persistT(){try{localStorage.setItem(TK,JSON.stringify(T));}catch(e){}}
const durOf=m=>(m==="focus"?S.settings.focus:S.settings.brk)*60;
function resetTimer(){T.running=false;T.paused=false;T.total=durOf(T.mode);T.left=T.total;persistT();drawTimer();}
const leftNow=()=>T.running?Math.max(0,Math.round((T.endAt-Date.now())/1000)):T.left;
function drawDial(frac,color){let s="";const c=150;for(let i=0;i<60;i++){const a=i/60*2*Math.PI-Math.PI/2;const long=i%5===0;const r1=long?118:124,r2=136;const lit=i/60<frac;
  s+=`<line x1="${(c+r1*Math.cos(a)).toFixed(1)}" y1="${(c+r1*Math.sin(a)).toFixed(1)}" x2="${(c+r2*Math.cos(a)).toFixed(1)}" y2="${(c+r2*Math.sin(a)).toFixed(1)}" stroke="${lit?color:"var(--s2)"}" stroke-width="${long?4:3}" stroke-linecap="round"/>`;}
  const a=frac*2*Math.PI-Math.PI/2;if(frac>0&&frac<1)s+=`<circle cx="${(c+146*Math.cos(a)).toFixed(1)}" cy="${(c+146*Math.sin(a)).toFixed(1)}" r="4" fill="${color}"/>`;$("#dial-svg").innerHTML=s;}
function drawTimer(){const l=leftNow();if(!T.total)T.total=durOf(T.mode);
  $("#tm").textContent=pad(Math.floor(l/60))+":"+pad(l%60);
  const active=T.running||T.paused;const color=T.mode==="focus"?(T.subject?subjColor(T.subject):"var(--study)"):"var(--habit)";
  drawDial(active?1-l/T.total:1,active?color:"var(--s3)");
  $("#tm-what").textContent=T.mode==="break"?(T.running?t("onBreak"):t("brk")+" "+S.settings.brk+" "+t("min")):T.running?(short(T.subject||t("focusing"))):T.paused?t("paused"):(T.subject?short(T.subject):t("pickSubj"));
  $("#tm-start").innerHTML=ic(T.running?"i-pause":"i-play");$("#tm-start").style.background=T.mode==="focus"?"var(--study)":"var(--habit)";
  $("#tm-stop").disabled=!(T.mode==="focus"&&active);$("#tm-reset").disabled=!active;
  $$("#mode-seg button").forEach(b=>{b.classList.toggle("on",b.dataset.m===T.mode);b.textContent=t(b.dataset.m==="focus"?"focus":"brk");});
  $("#dur").innerHTML=(T.mode==="focus"?[15,25,45,60,90]:[5,10,15]).map(m=>`<button data-dur="${m}" class="${(T.mode==="focus"?S.settings.focus:S.settings.brk)===m?"on":""}">${m} ${t("min")}</button>`).join("");
  $("#f-sub").textContent=T.mode==="focus"?t("todayFocused",{m:studyOn(today())}):t("brk");
  document.title=T.running?$("#tm").textContent+" · "+(T.mode==="focus"?short(T.subject||t("focus")):t("brk")):baseTitle;}
let actx=null;const baseTitle=document.title;
function beep(){try{actx=actx||new(window.AudioContext||window.webkitAudioContext)();[0,.3,.6].forEach(x=>{const o=actx.createOscillator(),g=actx.createGain();o.frequency.value=x===.6?1175:880;o.connect(g);g.connect(actx.destination);g.gain.setValueAtTime(.0001,actx.currentTime+x);g.gain.exponentialRampToValueAtTime(.28,actx.currentTime+x+.02);g.gain.exponentialRampToValueAtTime(.0001,actx.currentTime+x+.28);o.start(actx.currentTime+x);o.stop(actx.currentTime+x+.3);});}catch(e){}}
let tickN=0;
function tick(){tickN++;
  if(T.running&&Date.now()>=T.endAt){T.running=false;T.paused=false;
    if(T.mode==="focus"){const m=Math.round(T.total/60);H.addStudy(m,T.subject,true);toast(t("finished",{m}));T.mode="break";}else{toast(t("breakOver"));T.mode="focus";}
    beep();T.total=durOf(T.mode);T.left=T.total;persistT();}
  const v=location.hash.slice(1);
  if(v==="study"||T.running)drawTimer();
  H.restTick();
  if(tickN%20===0&&(v==="body"||v===""||v==="today")){ if(v==="body")renderFast(); else renderToday(); }
}
$("#tm-start").onclick=()=>{try{actx=actx||new(window.AudioContext||window.webkitAudioContext)();actx.resume&&actx.resume();}catch(e){}
  if(T.running){T.left=leftNow();T.running=false;T.paused=true;}else{if(!T.paused){T.total=durOf(T.mode);T.left=T.total;}T.endAt=Date.now()+T.left*1000;T.running=true;T.paused=false;}persistT();drawTimer();};
$("#tm-reset").onclick=resetTimer;
$("#tm-stop").onclick=()=>{const done=Math.floor((T.total-leftNow())/60);if(done>0)H.addStudy(done,T.subject,true);toast(done>0?t("stopped",{m:done}):t("stopNone"));T.mode="focus";resetTimer();};
$("#mode-seg").onclick=e=>{const b=e.target.closest("button");if(!b||T.running)return;T.mode=b.dataset.m;resetTimer();};
$("#dur").onclick=e=>{const b=e.target.closest("button");if(!b||T.running||T.paused)return;const m=+b.dataset.dur;if(T.mode==="focus")S.settings.focus=m;else S.settings.brk=m;save();resetTimer();};

// ---------- boot ----------
H.boot=()=>{route();render();if(!T.running&&!T.paused)resetTimer();setInterval(tick,1000);
  let lastDay=today();setInterval(()=>{if(today()!==lastDay){lastDay=today();render();}},60000);
  window.addEventListener("resize",()=>{clearTimeout(window.__rz);window.__rz=setTimeout(render,200);});};
})();
