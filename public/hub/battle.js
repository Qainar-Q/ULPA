/* Exam battle: countdowns, launch track, daily missions */
(function(){
"use strict";
const pad=n=>String(n).padStart(2,"0");
const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const dk=d=>d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate());
const at=(s)=>new Date(s+":00+05:00");

const START=at("2026-11-26T00:00"), END=at("2026-12-28T13:00");
const EXAMS=[
  {id:"ielts",name:"雅思 IELTS",kk:"IELTS",t:"2026-12-10T09:00",key:true,color:"#bf7cff",goal:"目标 6.5 · 至少 6"},
  {id:"aero",name:"空气动力学",kk:"Аэродинамика",t:"2026-12-15T09:00",cons:"12/14 18:00",color:"#40c8e0"},
  {id:"space",name:"航天系统设计 1",kk:"Ғарыштық жүйелерді жобалау 1",t:"2026-12-17T09:00",cons:"12/15 18:00",easy:true,color:"#6e6e73"},
  {id:"plc",name:"可编程逻辑器件",kk:"Бағдарламаланатын логикалық құрылғылар",t:"2026-12-19T09:00",cons:"12/18 18:00",easy:true,color:"#6e6e73"},
  {id:"gyro",name:"陀螺仪应用理论",kk:"Гироскоптардың қолданбалы теориясы",t:"2026-12-23T09:00",cons:"12/22 18:00",key:true,color:"#ffb340"},
  {id:"rocket",name:"火箭动力学",kk:"Ракетодинамика",t:"2026-12-26T09:00",cons:"12/25 18:00",key:true,color:"#ff5a5f"},
  {id:"sat",name:"卫星通信系统",kk:"Серіктік байланыс жүйелері",t:"2026-12-28T11:00",cons:"12/28 08:00",color:"#5b8cff"}
].map(e=>Object.assign(e,{d:at(e.t)}));

const LINES=[
  "火箭不是一下子飞上天的，是一秒一秒推上去的。",
  "今天多学一讲，12 月就少慌一天。",
  "Еңбек етсең ерінбей, тояды қарның тіленбей. — Абай",
  "你在美国待过 3.5 个月，雅思口语就是你的主场。",
  "陀螺仪会保持方向，你也一样。",
  "累了就去健身房，回来接着干。",
  "比昨天的自己多一点点，就够了。",
  "现在吃的苦，12 月 28 日之后都会变成笑。",
  "Алға! 一步一步，全都拿下。",
  "Tsiolkovsky 说：推力要持续，Δv 才会累积。"
];

function missions(k){
  const D={
    "2026-11-26":["雅思：剑桥真题一套 听力+阅读（摸底）","陀螺仪：过大纲 + 第 1–2 讲","大作文一篇","17:00 健身"],
    "2026-11-27":["雅思：真题第二套","火箭动力学：过大纲 + 第 1–2 讲","小作文一篇","给 Байсбаева 老师发消息要题单"],
    "2026-11-28":["雅思：真题第三套","陀螺仪：第 3–4 讲","口语 Part 2 录音并回听","17:00 健身"],
    "2026-11-29":["雅思：真题第四套 + 错题复盘","火箭动力学：第 3–4 讲","大作文一篇","把摸底分数发给 Claude"],
    "2026-12-09":["雅思模考（轻一点）","作文模板最后过一遍","早点睡，今天不去健身房"],
    "2026-12-10":["雅思考试 — 冲！","考完好好吃一顿"],
    "2026-12-14":["空气动力学复习","18:00 空气动力学答疑"],
    "2026-12-15":["09:00 空气动力学考试","18:00 航天系统设计答疑","晚上过一遍航天系统设计"],
    "2026-12-16":["陀螺仪 / 火箭动力学 各 2 小时","晚上再看一遍航天系统设计"],
    "2026-12-17":["09:00 航天系统设计考试","下午：陀螺仪复习"],
    "2026-12-18":["火箭动力学复习","18:00 可编程逻辑器件答疑","晚上看一遍可编程逻辑"],
    "2026-12-19":["09:00 可编程逻辑器件考试","下午开始：陀螺仪全力冲刺"],
    "2026-12-22":["陀螺仪：题单最后过一遍","18:00 陀螺仪答疑","早睡"],
    "2026-12-23":["09:00 陀螺仪考试","下午开始：火箭动力学冲刺"],
    "2026-12-24":["火箭动力学：按题单逐题过，并讲出来"],
    "2026-12-25":["火箭动力学：题单最后过一遍","18:00 火箭动力学答疑","早睡"],
    "2026-12-26":["09:00 火箭动力学考试 — 最难的一关！"],
    "2026-12-27":["卫星通信系统复习"],
    "2026-12-28":["08:00 卫星通信答疑","11:00 卫星通信系统考试","全部结束，你做到了"]
  };
  if(D[k])return D[k];
  if(k<"2026-11-26")return["今天休息，明天正式开战"];
  const day=Math.round((new Date(k+"T12:00:00+05:00")-START)/864e5);
  const sub=day%2===0?"陀螺仪":"火箭动力学";
  if(k<="2026-12-06")return["雅思：听力 + 阅读一套，订正错题（上午 3h）",sub+"：学下一讲，合上讲义讲一遍（下午 2–3h）",(day%2?"小作文":"大作文")+"一篇 + 口语 20 分钟"];
  if(k<="2026-12-08")return["雅思全真模考（按考试时间）","口语 Part 2 题卡练习","作文模板过一遍"];
  if(k<="2026-12-13")return["空气动力学复习","陀螺仪 / 火箭动力学 各 1 小时保温"];
  if(k<="2026-12-21")return["陀螺仪：按题单逐题过，并讲出来"];
  return[];
}

const LS="exam-battle-v1";
let B={checks:{}};try{B=JSON.parse(localStorage.getItem(LS))||B;}catch(e){}
const save=()=>{try{localStorage.setItem(LS,JSON.stringify(B));}catch(e){}};
function dayDone(k){const m=missions(k);const c=B.checks[k]||{};return m.length&&m.every((_,i)=>c[i]);}
function streak(){let n=0;const d=new Date();if(!dayDone(dk(d)))d.setDate(d.getDate()-1);
  while(dayDone(dk(d))&&d>=START){n++;d.setDate(d.getDate()-1);}return n;}

const css=`
.bt{margin:-4px 0 26px}
.bt-hero{position:relative;overflow:hidden;border-radius:26px;padding:18px 18px 16px;background:radial-gradient(120% 90% at 85% 0%,color-mix(in srgb,var(--xc) 38%,#1c1c1e),#111113 70%);border:1px solid color-mix(in srgb,var(--xc) 30%,transparent)}
.bt-hero .tag{display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:900;color:var(--xc);background:color-mix(in srgb,var(--xc) 16%,transparent);padding:5px 10px;border-radius:999px}
.bt-hero .tag svg{width:14px;height:14px;stroke:currentColor}
.bt-hero h3{font-size:22px;font-weight:900;margin:10px 0 2px;line-height:1.2}
.bt-hero .when{font-size:13px;color:var(--t2);font-weight:700}
.bt-cd{display:flex;align-items:flex-end;gap:12px;margin:12px 0 4px}
.bt-cd .dd{font-size:clamp(64px,22vw,96px);line-height:.9;letter-spacing:-3px;color:var(--xc)}
.bt-cd .du{font-size:16px;font-weight:900;color:var(--t2);margin-bottom:8px}
.bt-cd .hms{margin-left:auto;text-align:right;font-size:22px;margin-bottom:6px;color:var(--t1)}
.bt-cd .hms small{display:block;font-size:11.5px;color:var(--t3);font-weight:800}
.bt-line{font-size:14px;font-weight:800;line-height:1.5;color:var(--t1);margin-top:12px;padding-top:12px;border-top:1px solid rgba(255,255,255,.08)}
.bt-track{position:relative;height:64px;margin:16px 4px 0}
.bt-track .rail{position:absolute;left:0;right:0;top:30px;height:4px;border-radius:2px;background:rgba(255,255,255,.1)}
.bt-track .fill{position:absolute;left:0;top:30px;height:4px;border-radius:2px;background:linear-gradient(90deg,#ffb340,#ff5a5f)}
.bt-track .ms{position:absolute;top:24px;width:16px;height:16px;margin-left:-8px;border-radius:50%;background:#111113;border:3px solid var(--mc)}
.bt-track .ms.key{width:20px;height:20px;margin-left:-10px;top:22px}
.bt-track .ms.done{background:var(--mc)}
.bt-track .ml{position:absolute;top:46px;transform:translateX(-50%);font-size:10.5px;font-weight:800;color:var(--t3);white-space:nowrap}
.bt-track .rk{position:absolute;top:2px;width:30px;height:24px;margin-left:-15px;transition:left 1s ease}
.bt-track .rk svg{width:30px;height:24px}
.bt-stats{display:flex;gap:10px;margin-top:10px}
.bt-stat{flex:1;background:var(--s1);border-radius:16px;padding:11px 13px}
.bt-stat .k{font-size:12px;font-weight:800;color:var(--t2)}
.bt-stat .v{font-size:24px;line-height:1.15}
.bt-stat .v small{font-size:12px;color:var(--t2);font-weight:700;margin-left:2px}
.bt h2{margin-top:22px}
.bt-ms{list-style:none;display:grid;gap:6px}
.bt-ms button{display:flex;align-items:center;gap:12px;width:100%;text-align:left;background:var(--s1);border-radius:14px;padding:12px 13px;font-weight:700}
.bt-ms .cb{flex:0 0 24px}
.bt-ms .on{color:var(--t3);text-decoration:line-through}
.bt-ms .on .cb{background:var(--habit);border-color:var(--habit)}
.bt-ms .on .cb svg{opacity:1}
.bt-all{margin-top:8px;text-align:center;color:var(--habit);font-weight:900;font-size:14px;min-height:20px}
.bt-ex{list-style:none;background:var(--s1);border-radius:20px;padding:4px 14px}
.bt-ex li{display:flex;align-items:center;gap:12px;padding:11px 0;border-bottom:1px solid var(--s2)}
.bt-ex li:last-child{border-bottom:none}
.bt-ex .bar{width:5px;align-self:stretch;border-radius:3px;background:var(--ec);flex:0 0 5px}
.bt-ex .mid{flex:1;min-width:0}
.bt-ex b{display:flex;align-items:center;gap:6px;font-weight:900;font-size:15px}
.bt-ex b svg{width:15px;height:15px;stroke:var(--ec);flex:0 0 15px}
.bt-ex small{display:block;font-size:12px;color:var(--t2);font-weight:700;margin-top:1px}
.bt-ex .left{text-align:right;white-space:nowrap}
.bt-ex .left .num{font-size:22px;color:var(--ec)}
.bt-ex .left small{font-size:11px}
.bt-ex li.easy{opacity:.6}
.bt-ex li.past{opacity:.4}
.bt-ex li.past b{text-decoration:line-through}
@media(prefers-reduced-motion:reduce){.bt-track .rk{transition:none}}
`;

const ROCKET=`<svg viewBox="0 0 30 24"><path d="M3 12c4-6 13-8 24-0-11 8-20 6-24 0z" fill="#f5f5f7"/><circle cx="18" cy="12" r="2.6" fill="#5b8cff"/><path d="M8 8l-4-5h5l4 4zM8 16l-4 5h5l4-4z" fill="#ff5a5f"/><path d="M3 12l-3-2.5v5z" fill="#ffb340"/></svg>`;
const FLAME=`<svg viewBox="0 0 24 24" fill="none" stroke-width="2.2" stroke-linejoin="round"><path d="M12 21c-4 0-6.5-2.6-6.5-6 0-4 4-6 4-10 2.5 1.5 4 3.5 4 6 1-1 1.5-2 1.5-3 2 1.5 3.5 4 3.5 7 0 3.4-2.5 6-6.5 6z"/></svg>`;
const CHECK=`<svg><use href="#i-check"/></svg>`;

let root;
function mount(){
  const st=document.createElement("style");st.textContent=css;document.head.appendChild(st);
  root=document.createElement("div");root.className="bt";root.id="battle";
  const top=document.querySelector("#v-today .top");top.after(root);
  root.addEventListener("click",e=>{const b=e.target.closest("[data-mi]");if(!b)return;
    const k=dk(new Date());B.checks[k]=B.checks[k]||{};const i=+b.dataset.mi;B.checks[k][i]=!B.checks[k][i];save();
    if(dayDone(k)&&window.H&&H.toast)H.toast("今天的任务全部完成！");draw();});
}
function next(now){return EXAMS.find(e=>e.d>now);}
function left(ms){ms=Math.max(0,ms);const s=Math.floor(ms/1000);return{d:Math.floor(s/86400),h:Math.floor(s%86400/3600),m:Math.floor(s%3600/60),s:s%60};}
const fmt=d=>(d.getMonth()+1)+"/"+d.getDate()+" "+["周日","周一","周二","周三","周四","周五","周六"][d.getDay()]+" "+pad(d.getHours())+":"+pad(d.getMinutes());

function draw(){
  if(!root)return;
  const now=new Date(),k=dk(now),nx=next(now);
  const frac=Math.max(0,Math.min(1,(now-START)/(END-START)));
  const pos=d=>((d-START)/(END-START)*100).toFixed(2)+"%";
  const dayN=Math.floor((now-START)/864e5)+1, total=Math.ceil((END-START)/864e5);
  const ms=missions(k),ch=B.checks[k]||{},done=ms.filter((_,i)=>ch[i]).length;
  const line=LINES[(Math.floor(now/864e5))%LINES.length];
  let hero;
  if(!nx){hero=`<div class="bt-hero" style="--xc:var(--habit)"><span class="tag">全部完成</span><h3>7 场考试，全部拿下</h3><div class="bt-line">这个学期你扛住了，好好休息。</div></div>`;}
  else{const l=left(nx.d-now);
    hero=`<div class="bt-hero" style="--xc:${nx.key?nx.color:"#5b8cff"}">
      <span class="tag">${nx.key?FLAME:""}${nx.key?"重点战役":"下一场考试"}</span>
      <h3>${esc(nx.name)}</h3><div class="when">${fmt(nx.d)}${nx.goal?" · "+esc(nx.goal):""}${nx.cons?" · 答疑 "+esc(nx.cons):""}</div>
      <div class="bt-cd"><span class="dd num">${l.d}</span><span class="du">天</span><span class="hms num" id="bt-hms">${pad(l.h)}:${pad(l.m)}:${pad(l.s)}<small>小时 · 分 · 秒</small></span></div>
      <div class="bt-track"><div class="rail"></div><div class="fill" style="width:${(frac*100).toFixed(2)}%"></div>
        ${EXAMS.map(e=>`<i class="ms ${e.key?"key":""} ${e.d<=now?"done":""}" style="left:${pos(e.d)};--mc:${e.easy?"#6e6e73":e.color}"></i>`).join("")}
        <span class="ml" style="left:${pos(EXAMS[0].d)}">雅思 12/10</span><span class="ml" style="left:${pos(EXAMS[4].d)}">陀螺仪 · 火箭</span>
        <span class="rk" style="left:${(frac*100).toFixed(2)}%">${ROCKET}</span></div></div>`;}
  const sk=streak();
  const stats=`<div class="bt-stats"><div class="bt-stat"><div class="k">备考第</div><div class="v num">${now<START?0:Math.min(dayN,total)}<small>/ ${total} 天</small></div></div><div class="bt-stat"><div class="k">连续完成</div><div class="v num">${sk}<small>天</small></div></div><div class="bt-stat"><div class="k">今日任务</div><div class="v num">${done}<small>/ ${ms.length}</small></div></div></div>`;
  const mis=ms.length?`<h2><span>今日任务</span><span class="side">${now<START?"明天开始":fmt(now).split(" ").slice(0,2).join(" ")}</span></h2><ul class="bt-ms">${ms.map((m,i)=>`<li><button data-mi="${i}" class="${ch[i]?"on":""}"><span class="cb">${CHECK}</span><span>${esc(m)}</span></button></li>`).join("")}</ul><div class="bt-all">${ms.length&&done===ms.length?"今天的任务全部完成，干得漂亮！":""}</div>`:"";
  const list=`<h2><span>考试倒计时</span><span class="side">${EXAMS.filter(e=>e.d>now).length} 场待考</span></h2><ul class="bt-ex">${EXAMS.map(e=>{const p=e.d<=now;const l=left(e.d-now);
    return `<li class="${p?"past":""} ${e.easy&&!p?"easy":""}" style="--ec:${e.easy?"#a1a1a6":e.color}"><span class="bar"></span><span class="mid"><b>${e.key?FLAME:""}${esc(e.name)}</b><small>${fmt(e.d)}${e.easy?" · 轻松拿下":""}</small></span><span class="left">${p?`<small>已完成</small>`:`<span class="num">${l.d}</span><small> 天 ${l.h} 小时</small>`}</span></li>`;}).join("")}</ul>`;
  root.innerHTML=hero+stats+mis+list;
  if(window.BOOST)try{BOOST.attach(root);}catch(e){}
}
function tick(){const el=document.getElementById("bt-hms");const now=new Date();const nx=next(now);
  if(!el||!nx)return;const l=left(nx.d-now);
  if(l.h===23&&l.m===59&&l.s===59||l.d===0&&l.h===0&&l.m===0&&l.s===0){draw();return;}
  el.firstChild.textContent=`${pad(l.h)}:${pad(l.m)}:${pad(l.s)}`;}
let last=dk(new Date());
window.BATTLE={boot(){if(root)return;mount();draw();setInterval(tick,1000);setInterval(()=>{const k=dk(new Date());if(k!==last){last=k;draw();}},30000);}};
})();
