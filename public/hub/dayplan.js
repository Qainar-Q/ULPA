// 1% Better: AI day plan. Each morning (first open after sync) the AI looks at every exam and how many days are left,
// yesterday's unfinished tasks, today's training, English level and the user's note for the day, and writes today's
// to-dos with times. "Make a new plan" replaces the AI tasks that are not done yet; done ones and the user's own stay.
(function(){
"use strict";
const H=window.H,$=H.$,esc=H.esc,ic=H.ic,L3=(a,b,c)=>H.L3(a,b,c),S=()=>H.S,today=H.today;
const daysTo=(d,from)=>Math.round((new Date(d+"T00:00:00")-new Date((from||today())+"T00:00:00"))/86400000);
// After 20:00 the plan is for tomorrow (you plan the next day the night before).
const target=()=>new Date().getHours()>=20?H.dkey(H.daysAgo(-1)):today();
const LANG=()=>({zh:"Simplified Chinese",en:"English",kk:"Kazakh (Cyrillic)"}[S().settings.lang]||"Simplified Chinese");
const st=()=>{const s=S();if(!s.dayPlan||typeof s.dayPlan!=="object")s.dayPlan={};return s.dayPlan;};
let busy=false,openNote=false;

function context(note,tk){
  const s=S(),now=new Date(),isToday=tk===today(),y=H.dkey(new Date(new Date(tk+"T12:00:00").getTime()-86400000));
  const exams=(s.exams||[]).filter(x=>x.date&&daysTo(x.date,tk)>=0).sort((a,b)=>a.date<b.date?-1:1)
    .map(x=>{const sub=(s.subjects||[]).find(q=>q.name===x.name);return {name:x.name,date:x.date,daysLeft:daysTo(x.date,tk),goal:x.goal||undefined,
      topicsNotDone:sub&&sub.topics?sub.topics.filter(tp=>!tp.done).map(tp=>tp.name||tp.t||tp).slice(0,15):undefined};});
  let training=null;try{const cp=H.kit.curPlan();if(cp&&isToday)training=cp.day.rest||!(cp.day.ex||[]).length?"rest day":H.pick(cp.day.name);}catch(e){}
  const yTodos=(s.todos||[]).filter(x=>x.date===y||(x.date<tk&&!x.done));
  const eng=s.eng||{};
  return {
    planDate:tk,weekday:new Date(tk+"T12:00:00").toLocaleDateString("en-US",{weekday:"long"}),startFrom:isToday?H.pad(now.getHours())+":"+H.pad(now.getMinutes()):"wake-up time (07:00 unless the note says otherwise)",
    exams,trainingToday:training,studyGoalMinutes:s.settings.goal,fastingHours:s.settings.fastH||undefined,
    englishLevel:eng.level||undefined,recentEnglishTests:(eng.tests||[]).slice(-3),
    dayBeforeUnfinished:yTodos.filter(x=>!x.done).map(x=>x.text).slice(0,12),
    dayBeforeDone:yTodos.filter(x=>x.done).length,
    ownTasksThatDay:(s.todos||[]).filter(x=>!x.ai&&!x.done&&x.date===tk).map(x=>x.text).slice(0,12),
    userNote:note||undefined,
  };
}

async function make(auto){
  if(busy)return;busy=true;render();
  const tk=target(),p=st(),note=(p.date===tk?p.note:"")||"",ctx=context(note,tk);
  try{
    const r=await H.aiJson(`You plan the day for a university student who uses a habit app. Here is everything the app knows: ${JSON.stringify(ctx).slice(0,6000)}.
Write the plan for ${ctx.planDate} (${ctx.weekday}) as time blocks from ${ctx.startFrom} until about 23:00. If the note gives a wake-up time, start there.
Rules:
- The user's note is fixed: keep every time, trip and meeting in it exactly, and leave travel time.
- Share study time by urgency: the closer and harder the exam, the more time. Exams within 14 days get daily practice.
- IELTS: rotate Listening, Reading, Writing and Speaking; timed practice; say exactly what to do (e.g. "1 full Listening test, 30 min, then check spelling").
- University exams: name the concrete step (syllabus, one lecture, past questions), not just "study".
- Carry over yesterday's unfinished tasks if they still matter. Keep the user's own tasks; do not repeat them.
- Include training if it is not a rest day, short breaks, and no meal blocks if the user fasts or says they skip a meal.
- 6 to 12 blocks, each one short line. Be realistic, not overloaded.
Write in ${LANG()}. Return JSON: {"items":[{"time":"HH:MM","text":"..."}],"tip":"one short sentence of focus for that day"}`);
    const items=(r&&Array.isArray(r.items)?r.items:[]).filter(x=>x&&x.text).slice(0,14);
    if(!items.length)throw {code:"empty"};
    const s=S();
    s.todos=(s.todos||[]).filter(x=>!(x.ai&&!x.done&&x.date<=tk));
    const base=Date.now();
    items.forEach(x=>{const m=String(x.time||"").trim();x._t=/^\d{1,2}:\d{2}$/.test(m)?m.padStart(5,"0"):"";});
    items.sort((a,b)=>(a._t||"99").localeCompare(b._t||"99")).forEach((x,i)=>{
      s.todos.push({id:H.uid(),text:((x._t?x._t+" ":"")+String(x.text).trim()).slice(0,160),done:false,date:tk,ts:base+i,ai:true});
    });
    Object.assign(st(),{date:tk,note,tip:r.tip?String(r.tip).slice(0,200):"",made:Date.now(),auto:!!auto});
    busy=false;H.save();
    if(!auto)H.toast(tk===today()?L3("今天的计划排好了","Today's plan is ready","Бүгінгі жоспар дайын"):L3("明天的计划排好了","Tomorrow's plan is ready","Ертеңгі жоспар дайын"));
  }catch(e){
    busy=false;
    if(auto)Object.assign(st(),{date:tk,note,tip:"",made:0,failed:true});
    render();H.toast(H.aiErr(e));
  }
}
H.makeDayPlan=make;

function render(){
  const box=$("#plus-dayplan");if(!box)return;
  const s=S(),p=st(),tk=target(),tom=tk!==today(),has=p.date===tk&&p.made,autoOn=s.settings.autoPlan!==false;
  const noteVal=p.date===tk?(p.note||""):"";
  box.innerHTML=`<div class="dp panel">
    <div class="dph">${ic("i-spark","","stroke:var(--eng)")}<b>${tom?L3("AI 明日计划","AI plan for tomorrow","AI ертеңгі жоспар"):L3("AI 今日计划","AI day plan","AI күн жоспары")}</b>
      <label class="dpa"><input type="checkbox" id="dp-auto" ${autoOn?"checked":""}> ${L3("每天自动排","Every morning","Күн сайын")}</label></div>
    ${has&&p.tip?`<p class="dpt">${esc(p.tip)}</p>`:""}
    ${!has&&!busy?`<p class="dpt dim">${L3("AI 会看你所有考试还剩几天、昨天没做完的事和今天的训练，排好今天的待办。","The AI looks at every exam countdown, yesterday's unfinished tasks and today's training, then fills in today's to-dos.","AI барлық емтиханды, кешегі істерді және жаттығуды қарап, бүгінгі тізімді жасайды.")}</p>`:""}
    ${openNote||noteVal?`<textarea class="field dpn" id="dp-note" rows="2" maxlength="300" placeholder="${tom?L3("明天的固定安排，比如：7 点起床，12:30 出门，14:00 见老师，不吃午饭","Fixed plans tomorrow, e.g. up at 7, leave at 12:30","Ертеңгі нақты істер"):L3("今天的固定安排，比如：7 点起床，12:30 出门，14:00 见老师，不吃午饭","Fixed plans today, e.g. up at 7, leave at 12:30, meet teacher at 14:00","Бүгінгі нақты істер")}">${esc(noteVal)}</textarea>`:""}
    <div class="btnrow dpb">
      <button class="pill" id="dp-go" ${busy?"disabled":""} style="background:var(--eng);color:#fff">${ic("i-spark")}<span>${busy?L3("正在排…","Planning…","Жоспарлап жатыр…"):has?L3("重新排","Make a new plan","Қайта жасау"):tom?L3("让 AI 排明天","Plan tomorrow","Ертеңді жоспарла"):L3("让 AI 排今天","Plan my day","Күнімді жоспарла")}</span></button>
      ${openNote||noteVal?"":`<button class="pill" id="dp-addnote">${tom?L3("加明天的安排","Add fixed plans","Нақты істер қосу"):L3("加今天的安排","Add fixed plans","Нақты істер қосу")}</button>`}
    </div></div>`;
  $("#dp-go").onclick=()=>{const n=$("#dp-note");const pp=st();if(pp.date!==tk){Object.keys(pp).forEach(k=>delete pp[k]);pp.date=tk;}if(n)pp.note=n.value.trim();make(false);};
  const an=$("#dp-addnote");if(an)an.onclick=()=>{openNote=true;render();const n=$("#dp-note");if(n)n.focus();};
  const n=$("#dp-note");if(n)n.onchange=()=>{const pp=st();if(pp.date!==tk){Object.keys(pp).forEach(k=>delete pp[k]);pp.date=tk;pp.made=0;}pp.note=n.value.trim();H.save(true);};
  $("#dp-auto").onchange=e=>{S().settings.autoPlan=e.target.checked;H.save(true);};
}
H.dayPlanRender=render;

// Auto plan: once a day, only after the cloud copy is loaded (so two devices don't both plan), between 05:00 and 21:00.
function maybeAuto(){
  if(busy||!H.synced||!window.HUB||!HUB.uid||document.visibilityState!=="visible")return;
  const s=S(),p=st(),h=new Date().getHours();
  if(s.settings.autoPlan===false||p.date===today()||h<5||h>=21)return;
  make(true);
}
H.onPulled=()=>setTimeout(maybeAuto,1200);
setInterval(maybeAuto,5*60*1000);
})();
