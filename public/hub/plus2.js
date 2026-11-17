// 1% Better: exam countdowns with an AI revision plan, and focus mode (white noise, full screen, distraction count).
(function(){
"use strict";
const H=window.H,$=H.$,esc=H.esc,ic=H.ic,L3=(a,b,c)=>H.L3(a,b,c),t=H.t,S=()=>H.S;
const today=H.today;
const exams=()=>{const s=S();if(!Array.isArray(s.exams))s.exams=[];return s.exams;};
const daysTo=d=>Math.round((new Date(d+"T00:00:00")-new Date(today()+"T00:00:00"))/86400000);
const LANG=()=>({zh:"Simplified Chinese",en:"English",kk:"Kazakh (Cyrillic)"}[S().settings.lang]||"Simplified Chinese");

// ---------- exam countdown ----------
H.examStrip=()=>{
  const list=exams().filter(x=>daysTo(x.date)>=0).sort((a,b)=>a.date<b.date?-1:1);
  return `<div class="exs">${list.map(x=>{const d=daysTo(x.date);return `<button class="exc" data-exam="${x.id}" style="--ec:${d<=7?"var(--move)":d<=30?"var(--todo)":"var(--study)"}"><b class="num">${d===0?L3("今天","Today","Бүгін"):d}</b><small>${d===0?"":L3("天","days","күн")}</small><span>${esc(x.name)}</span></button>`;}).join("")}
   <button class="exc add" data-exam="new">${ic("i-plus")}<span>${list.length?L3("加考试","Add","Қосу"):L3("加考试倒计时","Add an exam countdown","Емтихан қосу")}</span></button></div>`;
};
function examSheet(id){
  const isNew=id==="new";const x=isNew?{id:H.uid(),name:"",date:"",kind:"ielts"}:exams().find(e=>e.id===id);if(!x)return;
  const d=x.date?daysTo(x.date):null;
  H.openSheet(`<h3>${isNew?L3("新的考试","New exam","Жаңа емтихан"):esc(x.name)}<button data-close>${t("close")}</button></h3>
   ${!isNew&&d!=null?`<div class="exbig"><b class="num">${d}</b><span>${L3("天后","days to go","күн қалды")}</span><small>${H.kit.fmtDay(x.date)}</small></div>`:""}
   <div class="fl">${L3("名称","Name","Атауы")}</div><input class="field" id="ex-name" maxlength="40" value="${esc(x.name)}" placeholder="${L3("比如：雅思、高数期末","e.g. IELTS, Calculus final","мысалы: IELTS")}">
   ${isNew?`<div class="chips" style="justify-content:flex-start;margin-top:8px">${["IELTS",...S().subjects.slice(0,6).map(s=>s.name)].map(n=>`<button class="chip" data-exn="${esc(n)}">${esc(n)}</button>`).join("")}</div>`:""}
   <div class="fl">${L3("考试日期","Date","Күні")}</div><input class="field" type="date" id="ex-date" value="${x.date}" min="${today()}">
   <div class="fl">${L3("目标（可选）","Goal (optional)","Мақсат")}</div><input class="field" id="ex-goal" maxlength="60" value="${esc(x.goal||"")}" placeholder="${L3("比如：雅思 6.5、期末 90 分","e.g. band 6.5, 90 points","мысалы: 6.5")}">
   <button class="go" id="ex-save" style="background:var(--study);margin-top:16px">${t("save")}</button>
   ${isNew?"":`<button class="pill" id="ex-plan" style="width:100%;margin-top:10px">${ic("i-spark")} <span>${x.plan?L3("重新生成复习计划","Make a new revision plan","Жаңа жоспар"):L3("让 AI 安排复习计划","AI revision plan","AI дайындық жоспары")}</span></button>
   <div id="ex-out">${x.plan?planHtml(x.plan):""}</div>
   <button class="linkbtn" id="ex-del" style="color:var(--move)">${L3("删除这个考试","Delete this exam","Жою")}</button>`}`,()=>{
    $("#sheet-body").addEventListener("click",e=>{const b=e.target.closest("[data-exn]");if(b)$("#ex-name").value=b.dataset.exn;});
    $("#ex-save").onclick=()=>{const name=$("#ex-name").value.trim(),date=$("#ex-date").value;if(!name||!date){H.toast(L3("填上名称和日期","Add a name and a date","Атауы мен күні"));return;}
      Object.assign(x,{name,date,goal:$("#ex-goal").value.trim()});if(isNew)exams().push(x);H.save();H.toast(L3("已保存","Saved","Сақталды"));if(isNew)examSheet(x.id);else H.closeSheet();};
    if(isNew)return;
    $("#ex-del").onclick=()=>{if(!confirm(L3("删除这个考试？","Delete this exam?","Жою керек пе?")))return;S().exams=exams().filter(e=>e.id!==x.id);H.save();H.closeSheet();};
    $("#ex-plan").onclick=async()=>{const b=$("#ex-plan");b.disabled=true;const t0=Date.now();const tk=setInterval(()=>{b.querySelector("span").textContent=t("thinking")+" "+Math.round((Date.now()-t0)/1000)+"s";},500);
      const ielts=/ielts|雅思/i.test(x.name);const subj=S().subjects.find(s=>s.name===x.name);
      const ctx={exam:x.name,goal:x.goal||null,daysLeft:daysTo(x.date),studyMinutesGoalPerDay:S().settings.goal,
        englishLevel:ielts&&S().eng.level?S().eng.level:undefined,
        topics:subj&&subj.topics?subj.topics.map(tp=>({name:tp.name||tp.t||tp,done:!!tp.done})).slice(0,40):undefined};
      try{const r=await H.aiJson(`You are a study coach for a university student. Make a realistic revision plan for this exam: ${JSON.stringify(ctx)}.
${ielts?"It is IELTS Academic: cover Listening, Reading, Writing (Task 1 and 2) and Speaking, with full mock tests in the last weeks.":"Use the topics if given (focus on ones not done), and leave the last days for past papers and review."}
Split the time left into phases (by week, or by days if under 2 weeks; at most 8 phases). Write in ${LANG()}, short and concrete.
Reply with only JSON: {"summary":"one sentence","daily":"what to do every day, with minutes","phases":[{"when":"e.g. Week 1 (Nov 17–23)","focus":"main goal","tasks":["2-4 concrete tasks"]}]}`);
        x.plan=r;H.save(true);$("#ex-out").innerHTML=planHtml(r);
      }catch(err){H.toast(H.aiErr(err));}finally{clearInterval(tk);b.disabled=false;b.querySelector("span").textContent=L3("重新生成复习计划","Make a new revision plan","Жаңа жоспар");}};
  });
}
function planHtml(p){return `<div class="panel" style="background:var(--s2);margin-top:12px">${p.summary?`<div style="font-weight:800;line-height:1.5">${esc(p.summary)}</div>`:""}${p.daily?`<div class="exd">${ic("i-today")}<span>${esc(p.daily)}</span></div>`:""}
  <ol class="exp">${(p.phases||[]).map(ph=>`<li><b>${esc(ph.when||"")}</b><span>${esc(ph.focus||"")}</span><ul class="tips">${(ph.tasks||[]).map(tk=>`<li>${esc(tk)}</li>`).join("")}</ul></li>`).join("")}</ol></div>`;}
document.addEventListener("click",e=>{const b=e.target.closest("[data-exam]");if(b)examSheet(b.dataset.exam);});

// ---------- focus mode: noise, full screen, distractions ----------
const NOISES=[["off",()=>L3("安静","Silent","Тыныш")],["rain",()=>L3("雨声","Rain","Жаңбыр")],["ocean",()=>L3("海浪","Waves","Толқын")],["brown",()=>L3("低噪音","Brown noise","Қоңыр шу")],["fire",()=>L3("篝火","Fire","От")]];
const F=()=>{const s=S();s.settings.focusX=Object.assign({noise:"off",vol:.5},s.settings.focusX||{});return s.settings.focusX;};
let ctx=null,nodes=null,playing="";
function noiseBuffer(kind){const sr=ctx.sampleRate,len=sr*4,buf=ctx.createBuffer(2,len,sr);
  for(let ch=0;ch<2;ch++){const d=buf.getChannelData(ch);let last=0,b0=0,b1=0,b2=0;
    for(let i=0;i<len;i++){const w=Math.random()*2-1;
      if(kind==="brown"||kind==="ocean"){last=(last+0.02*w)/1.02;d[i]=last*3.2;}
      else{b0=0.99765*b0+w*0.099046;b1=0.963*b1+w*0.2965164;b2=0.57*b2+w*1.0526913;d[i]=(b0+b1+b2+w*0.1848)*0.18;}
      if(kind==="fire"&&Math.random()<0.0009){const n=Math.floor(sr*0.004);for(let k=0;k<n&&i+k<len;k++)d[i+k]+= (Math.random()*2-1)*(1-k/n)*0.9;}
    }
    const f=Math.floor(sr*0.05);for(let i=0;i<f;i++){const a=i/f;d[i]=d[i]*a+d[len-f+i]*(1-a);} // smooth loop seam
  }return buf;}
function startNoise(kind){stopNoise();if(kind==="off")return;
  try{ctx=ctx||new(window.AudioContext||window.webkitAudioContext)();ctx.resume&&ctx.resume();}catch(e){return;}
  const src=ctx.createBufferSource();src.buffer=noiseBuffer(kind);src.loop=true;
  const g=ctx.createGain();g.gain.value=0;const out=ctx.createGain();out.gain.value=F().vol;
  let chain=src;
  if(kind==="rain"){const hp=ctx.createBiquadFilter();hp.type="highpass";hp.frequency.value=900;const lp=ctx.createBiquadFilter();lp.type="lowpass";lp.frequency.value=7000;chain.connect(hp);hp.connect(lp);chain=lp;}
  if(kind==="fire"){const lp=ctx.createBiquadFilter();lp.type="lowpass";lp.frequency.value=2500;chain.connect(lp);chain=lp;}
  chain.connect(g);g.connect(out);out.connect(ctx.destination);
  let lfo=null;
  if(kind==="ocean"){lfo=ctx.createOscillator();lfo.frequency.value=0.09;const depth=ctx.createGain();depth.gain.value=0.45;lfo.connect(depth);depth.connect(g.gain);lfo.start();}
  g.gain.setTargetAtTime(kind==="ocean"?0.55:1,ctx.currentTime,0.6);
  src.start();nodes={src,g,out,lfo};playing=kind;}
function stopNoise(){if(!nodes)return;const n=nodes;nodes=null;playing="";try{n.g.gain.setTargetAtTime(0,ctx.currentTime,0.2);setTimeout(()=>{try{n.src.stop();n.lfo&&n.lfo.stop();}catch(e){}},700);}catch(e){}}
function setVol(v){F().vol=v;if(nodes)nodes.out.gain.setTargetAtTime(v,ctx.currentTime,0.1);}

let distract=0,wasHidden=false;
document.addEventListener("visibilitychange",()=>{const st=H.timerState&&H.timerState();if(!st)return;
  if(document.visibilityState==="hidden"&&st.running&&st.mode==="focus"){wasHidden=true;}
  else if(document.visibilityState==="visible"&&wasHidden){wasHidden=false;distract++;H.toast(L3(`离开了专注页面（第 ${distract} 次）`,`You left focus mode (${distract})`,`Назар бөлінді (${distract})`));renderFocus();}});

function renderFocus(){
  const box=$("#plus-focus");if(!box)return;const f=F(),st=H.timerState?H.timerState():{};
  box.innerHTML=`<div class="fx"><div class="chips" id="fx-noise" style="justify-content:center">${NOISES.map(([k,n])=>`<button class="chip ${f.noise===k?"on":""}" data-noise="${k}" style="--cc:var(--study)">${n()}</button>`).join("")}</div>
   ${f.noise!=="off"?`<input type="range" class="fxvol" id="fx-vol" min="0" max="1" step="0.05" value="${f.vol}" aria-label="volume">`:""}
   <button class="pill" id="fx-full" style="width:100%;margin-top:10px">${ic("i-focus")} ${L3("全屏专注","Full-screen focus","Толық экран")}</button>
   ${st.running&&st.mode==="focus"?`<div class="hint" style="text-align:center">${L3(`这次分心 ${distract} 次（离开页面就算）`,`Distractions this session: ${distract}`,`Назар бөлінуі: ${distract}`)}</div>`:""}</div>`;
}
let fullOn=false;
function fullView(){fullOn=true;const o=document.createElement("div");o.id="fxo";o.innerHTML=`<div class="fxo-in"><div class="fxo-s" id="fxo-s"></div><div class="fxo-t num" id="fxo-t"></div><div class="fxo-b"><button id="fxo-play" aria-label="start/pause"></button></div><div class="fxo-n" id="fxo-n"></div><button class="fxo-x" id="fxo-x">${L3("退出全屏","Exit","Шығу")}</button></div>`;
  document.body.appendChild(o);try{o.requestFullscreen&&o.requestFullscreen().catch(()=>{});}catch(e){}
  let wl=null;try{navigator.wakeLock&&navigator.wakeLock.request("screen").then(l=>wl=l).catch(()=>{});}catch(e){}
  $("#fxo-play").onclick=()=>{H.timerToggle();drawFull();};
  $("#fxo-x").onclick=()=>{fullOn=false;try{document.fullscreenElement&&document.exitFullscreen();}catch(e){}try{wl&&wl.release();}catch(e){}o.remove();};
  drawFull();}
function drawFull(){if(!fullOn)return;const st=H.timerState();$("#fxo-t").textContent=st.text;
  $("#fxo-s").textContent=st.mode==="break"?L3("休息一下","Break","Демалыс"):(st.subject||L3("专注","Focus","Назар"));
  $("#fxo-play").innerHTML=ic(st.running?"i-pause":"i-play");
  $("#fxo-n").textContent=(F().noise!=="off"?NOISES.find(n=>n[0]===F().noise)[1]()+" · ":"")+L3(`分心 ${distract} 次`,`${distract} distractions`,`${distract} рет`);}

document.addEventListener("click",e=>{
  const n=e.target.closest("[data-noise]");if(n){F().noise=n.dataset.noise;H.save(true);try{ctx=ctx||new(window.AudioContext||window.webkitAudioContext)();ctx.resume&&ctx.resume();}catch(err){}playing="";sync();renderFocus();return;}
  if(e.target.closest("#fx-full")){fullView();return;}
  if(e.target.closest("#tm-start")){setTimeout(()=>{const st=H.timerState();if(st.running&&st.mode==="focus"&&st.left>=st.total-2)distract=0;sync();renderFocus();},50);}
});
document.addEventListener("input",e=>{if(e.target.id==="fx-vol")setVol(+e.target.value);});
function sync(){const st=H.timerState?H.timerState():null;if(!st)return;const want=st.running&&st.mode==="focus"?F().noise:"off";if(want!==playing){if(want==="off")stopNoise();else startNoise(want);}}
let lastRun=null;
setInterval(()=>{if(!H.timerState)return;sync();drawFull();const r=H.timerState().running;if(r!==lastRun){lastRun=r;if(location.hash==="#study")renderFocus();}},1000);
H.renderFocus=renderFocus;
})();
