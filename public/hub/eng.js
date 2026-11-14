(function(){
"use strict";
const {$,esc,ic,t,toast,today,dkey,daysAgo,uid}=H;
const $$=s=>document.querySelectorAll(s);
const E=()=>H.S.eng;
const ENG=window.ENG={};
const SUBJ="IELTS English";

// ---------- helpers ----------
const addDays=(k,n)=>{const[y,m,d]=k.split("-").map(Number);const x=new Date(y,m-1,d,12);x.setDate(x.getDate()+n);return dkey(x);};
function day(){const k=today();const e=E();return e.days[k]||(e.days[k]={w:0,r:0,d:0,wr:0,sp:0});}
function touch(){day();}
function streak(){const e=E();let n=0,i=e.days[today()]&&act(e.days[today()])?0:1;while(true){const d=e.days[dkey(daysAgo(i))];if(d&&act(d)){n++;i++;}else break;}return n;}
const act=d=>d.w||d.r||d.d||d.wr||d.sp;
function cache(){const e=E(),k=today();for(const x in e.cache)if(x!==k)delete e.cache[x];return e.cache[k]||(e.cache[k]={});}
const lvl=()=>E().level?E().level.cefr:"B2 (self-reported, untested)";
function explainRule(){return ["Write every explanation in Simplified Chinese.","Write every explanation bilingually: first one or two sentences in Simplified Chinese, then the same in English, separated by ' / '.","Write every explanation in clear simple English."][E().prefs.explain||0];}
const due=()=>Object.values(E().vocab).filter(c=>c.due<=today());
const learnedCount=()=>Object.keys(E().vocab).length;
const masteredCount=()=>Object.values(E().vocab).filter(c=>c.ivl>=21).length;
// Study time = only the time you are actually working: each tap/keystroke adds the gap since the last one,
// capped at 90 s (so leaving the page open or waiting for the AI does not count).
let work=null;
function actBegin(){if(!work)work={last:Date.now(),ms:0};}
["pointerdown","keydown","input"].forEach(ev=>document.addEventListener(ev,()=>{if(!work)return;const n=Date.now();work.ms+=Math.min(n-work.last,90000);work.last=n;},true));
ENG.endWork=()=>logTime();
function logTime(){if(!work)return;const m=Math.round(work.ms/60000);work=null;
  if(m>=1){H.addStudy(m,SUBJ,true);toast(({zh:"记录了 "+m+" 分钟英语学习",en:"Logged "+m+" min of English",kk:m+" мин ағылшын жазылды"})[H.lang()]);}}
const bandOf={A1:"3.0–3.5",A2:"4.0–4.5",B1:"4.5–5.5",B2:"5.5–6.5",C1:"7.0–8.0",C2:"8.5–9.0"};

// pronunciation (browser voice, British English if available)
let voice=null;
function pickVoice(){try{const v=speechSynthesis.getVoices();voice=v.find(x=>/en-GB/i.test(x.lang))||v.find(x=>/^en/i.test(x.lang))||null;}catch(e){}}
try{pickVoice();speechSynthesis.onvoiceschanged=pickVoice;}catch(e){}
async function speak(text){
  try{const u=new SpeechSynthesisUtterance(text);u.lang=voice?voice.lang:"en-GB";if(voice)u.voice=voice;u.rate=.92;speechSynthesis.cancel();speechSynthesis.speak(u);}catch(e){}
}
ENG.speak=speak;

// ---------- summary for Today ----------
ENG.todaySummary=()=>{const d=E().days[today()]||{};const goal=E().prefs.words;const dn=due().length;
  return `<span class="eb ${d.w>=goal?"ok":""}">${t("newWords")} ${d.w||0}/${goal}</span><span class="eb ${dn===0&&learnedCount()>0?"ok":""}">${t("review")} ${dn}</span><span class="eb ${d.d?"ok":""}">${t("drill")}${d.d?" ✓":""}</span>`;};

ENG.todayState=()=>{const d=E().days[today()]||{};return {w:d.w||0,goal:E().prefs.words,due:due().length,drill:!!d.d,learned:learnedCount()};};
ENG.weekStats=(keys)=>{const e=E();let w=0,drills=0,right=0,total=0;keys.forEach(k=>{const d=e.days[k]||{};w+=d.w||0;});
  e.drills.filter(x=>keys.includes(x.date)).forEach(x=>{drills++;right+=+x.s||0;total+=+x.n||0;});
  return {words:w,drills,acc:total?Math.round(right/total*100):null,mistakes:e.mistakes.filter(m=>keys.includes(m.date)).length,writings:e.writings.filter(x=>keys.includes(x.date)).length};};
// ---------- main render ----------
ENG.render=()=>{
  const root=$("#eng-root"); if(!root) return; const e=E(),d=e.days[today()]||{},goal=e.prefs.words,dn=due().length,st=streak();
  const acc=e.drills.slice(-7);const accP=acc.length?Math.round(acc.reduce((a,x)=>a+x.s,0)/acc.reduce((a,x)=>a+x.n,0)*100):null;
  root.innerHTML=`
   <div class="top"><div><div class="sub dsub"></div><h1>${t("eng")}</h1></div><button class="iconbtn" id="eng-prefs" aria-label="${t("settings")}">${ic("i-gear")}</button></div>
   ${e.level?`<div class="lvcard"><div><div class="k">${t("level")} · IELTS</div><div class="lv num">${esc(e.level.cefr)}</div><div class="ms">${t("estBand",{b:esc(e.level.band)})}</div></div><div style="text-align:right"><div class="k">${t("engStreak",{n:st})}</div><button class="linkbtn" id="eng-test">${t("retest")}</button></div></div>`
    :`<div class="lvcard intro"><div><b>${t("takeTest")}</b><p>${t("testIntro")}</p></div><button class="go" id="eng-test" style="background:var(--eng);margin-top:12px">${t("startTest")}</button></div>`}
   <h2>${t("todayPlan")} ${d.w>=goal&&dn===0&&d.d?`<span class="side" style="color:var(--habit)">${t("engDoneToday")}</span>`:""}</h2>
   <div class="tasks">
    ${task("eng-new","i-cards","var(--eng)",t("newWords"),`${d.w||0} / ${goal}`,d.w>=goal)}
    ${task("eng-rev","i-reset","#5b8cff",t("review"),dn?t("dueN",{n:dn}):t("noDue"),dn===0&&(d.r>0||learnedCount()>0))}
    ${task("eng-drill","i-target","#ffb340",t("drill"),d.d?`${t("score",{a:d.ds||0,b:d.dn||0})}`:`${e.prefs.drill} Q`,!!d.d)}
    ${task("eng-write","h-pen","#3ddc97",t("writing"),"IELTS Task 2",!!d.wr)}
    ${task("eng-speak","i-mic","#ff7aa8",t("speaking"),"IELTS Part 1–3",!!d.sp)}
   </div>
   <h2>${t("progress")}</h2>
   <div class="panel"><div class="kpi" style="margin:0"><div><div class="k">${t("learned")}</div><div class="v num">${learnedCount()}<small>${t("words")}</small></div></div><div><div class="k">${t("masteredW")}</div><div class="v num">${masteredCount()}</div></div><div><div class="k">${t("accuracy")}</div><div class="v num">${accP==null?"--":accP+"<small>%</small>"}</div></div></div>
    <div class="engweek">${Array.from({length:14},(_,i)=>{const k=dkey(daysAgo(13-i));const x=e.days[k];const n=x?(x.w||0)+(x.r||0):0;return `<i title="${k}" style="height:${Math.min(100,8+n*3)}%;background:${x&&act(x)?"var(--eng)":"var(--s2)"}"></i>`;}).join("")}</div></div>
   <div class="btnrow" style="margin-top:12px"><button class="pill" id="eng-mist">${ic("i-x")} ${t("mistakes")} <span class="num" style="color:var(--t2)">${e.mistakes.length}</span></button><button class="pill" id="eng-hist">${ic("i-list")} ${t("history")}</button></div>`;
  const now=new Date(), l=I18N[H.lang()]||I18N.zh; root.querySelector(".dsub").textContent=l.dateFmt.replace("{m}",l.months[now.getMonth()]).replace("{d}",now.getDate()).replace("{w}",l.wdLong[now.getDay()]);
};
function task(id,icn,col,name,sub,ok){return `<button class="task ${ok?"ok":""}" id="${id}"><span class="ti" style="background:color-mix(in srgb,${col} 20%,transparent)">${ic(icn,"","stroke:"+col)}</span><span class="tm"><b>${name}</b><small>${sub}</small></span><span class="tc">${ok?ic("i-check"):ic("i-chev")}</span></button>`;}

document.addEventListener("click",ev=>{const b=ev.target.closest("button");if(!b)return;
  switch(b.id){case"eng-test":testIntro();break;case"eng-new":newWords();break;case"eng-rev":review();break;case"eng-drill":drill();break;
    case"eng-write":writing();break;case"eng-speak":speaking();break;case"eng-mist":mistakes();break;case"eng-prefs":prefs();break;case"eng-hist":history();break;}
  if(b.dataset.say){ev.stopPropagation();speak(b.dataset.say);}
});

// ---------- generic UI ----------
const full=(html,mount)=>H.openSheet(html,mount,true);
const hdr=(title,right)=>`<h3>${title}${right||`<button data-close>${t("close")}</button>`}</h3>`;
function loading(title,msg){full(hdr(title)+`<div class="gen"><div class="spin"></div><div id="gen-msg">${msg||t("generating")}</div></div>`);}
function fail(title,e,retry){full(hdr(title)+`<div class="gen"><div>${esc(H.aiErr(e))}</div>${retry?`<button class="go" id="retry" style="background:var(--eng)">${t("tryAgain")}</button>`:""}</div>`,()=>{if(retry)$("#retry").onclick=retry;});}
let busy=false;
async function gen(title,prompt,opts,countKey){
  if(busy) return null; busy=true; loading(title); const t0=Date.now();
  const tick=setInterval(()=>{const m=$("#gen-msg");if(m)m.textContent=t("generating")+" "+Math.round((Date.now()-t0)/1000)+"s";},1000);
  try{ return await H.aiJson(prompt,Object.assign({modelTier:"default"},opts||{})); }
  finally{ busy=false; clearInterval(tick); }
}
function mcqView(q,i,total,onDone,title,passage){
  const letters="ABCD";
  full(hdr(title,`<span class="num" style="font-size:14px;color:var(--t2)">${i+1} / ${total}</span>`)+
   `<div class="qbar"><i style="width:${i/total*100}%"></i></div>`+
   (passage&&q.sec==="reading"?`<details class="passage" open><summary>${t("reading")} · ${esc(passage.title||"")}</summary><div>${esc(passage.text).replace(/\n/g,"<br>")}</div></details>`:"")+
   `<div class="qtag">${esc({vocab:t("vocab"),grammar:t("grammar"),reading:t("reading")}[q.sec]||q.lv||"")}</div><div class="qtext">${esc(q.q)}</div>
   <div class="opts">${q.opts.map((o,j)=>`<button class="opt" data-o="${j}"><span class="ol">${letters[j]||j+1}</span><span>${esc(o)}</span></button>`).join("")}</div><div id="qexp"></div>`,()=>{
    let done=false;
    $("#sheet-body .opts").onclick=e=>{const b=e.target.closest(".opt");if(!b||done)return;done=true;const j=+b.dataset.o,ok=j===q.a;
      $$("#sheet-body .opt").forEach((x,k)=>{if(k===q.a)x.classList.add("right");else if(k===j)x.classList.add("wrong");x.disabled=true;});
      $("#qexp").innerHTML=expBox(q,j)+`<button class="go" id="qnext" style="background:var(--eng)">${i+1<total?t("next"):t("finish")}</button>`;
      $("#qnext").onclick=()=>onDone(ok,j); $("#qnext").scrollIntoView({behavior:"smooth",block:"nearest"});};
  });
}

const L3=(zh,en,kk)=>({zh,en,kk})[H.lang()]||zh;
function expBox(q,j){const ok=j===q.a,letters="ABCD",why=Array.isArray(q.why)?q.why:[];
  return `<div class="exp ${ok?"ok":"no"}"><b>${ok?"✓ "+L3("答对了","Correct","Дұрыс"):"✗ "+L3("答错了","Not quite","Қате")}</b>
   ${!ok&&j!=null?`<p class="whyline"><span class="wl no">${letters[j]}</span>${L3("你选的","Your choice","Сіздің таңдау")}「${esc(q.opts[j]??"")}」${why[j]?" — "+esc(why[j]):""}</p>`:""}
   <p class="whyline"><span class="wl ok">${letters[q.a]}</span>${L3("正确答案","Answer","Дұрыс жауап")}「${esc(q.opts[q.a])}」</p>
   <p>${esc(q.exp||"")}</p>
   ${why.length?`<details class="others"><summary>${L3("看每个选项为什么对/错","Why each option is right or wrong","Әр нұсқаның түсіндірмесі")}</summary>${q.opts.map((o,k)=>`<p class="whyline"><span class="wl ${k===q.a?"ok":""}">${letters[k]}</span>${esc(o)}${why[k]?" — "+esc(why[k]):""}</p>`).join("")}</details>`:""}</div>`;}

// ---------- placement test ----------
function testIntro(){full(hdr(t("takeTest"))+`<p class="lead">${t("testIntro")}</p><button class="go" id="t-go" style="background:var(--eng)">${t("startTest")}</button>`,()=>{$("#t-go").onclick=runTest;});}
async function runTest(){
  const title=t("takeTest"); if(busy) return; busy=true; loading(title); const t0=Date.now();
  const tick=setInterval(()=>{const m=$("#gen-msg");if(m)m.textContent=t("generating")+" "+Math.round((Date.now()-t0)/1000)+"s";},1000);
  const one=lv=>H.aiJson(`You are an expert IELTS examiner writing part of a placement test for a Chinese/Kazakh-speaking university student preparing for IELTS Academic (graduate study).
Write exactly 5 multiple-choice questions at CEFR level ${lv}: mix grammar, vocabulary-in-context and one short reading-inference item (put any short text inside the question). Each has exactly 4 options and one unambiguous correct answer; vary its position.
${explainRule()} Explanations under 35 words.
Reply with only a JSON array of 5 objects: {"lv":"${lv}","sec":"grammar"|"vocab"|"reading","q":"...","opts":["","","",""],"a":0,"exp":"why the answer is right","why":["one short reason per option: why it is right or wrong"]}`,{modelTier:"default"}).then(a=>Array.isArray(a)?a.map(q=>Object.assign(q,{lv})):[]);
  let qs;
  try{ const parts=await Promise.allSettled(["A2","B1","B2","C1","C2"].map(one)); qs=parts.flatMap(p=>p.status==="fulfilled"?p.value:[]);
    if(qs.length<10){ const err=parts.find(p=>p.status==="rejected"); throw err?err.reason:{code:"invalid_json"}; } }
  catch(e){ busy=false; clearInterval(tick); fail(title,e,runTest); return; }
  busy=false; clearInterval(tick);
  qs=qs.filter(q=>q&&Array.isArray(q.opts)&&q.opts.length>=2&&Number.isInteger(q.a));
  const res=[]; actBegin();
  const step=i=>{ if(i>=qs.length) return testResult(qs,res,start); mcqView(qs[i],i,qs.length,(ok,j)=>{res.push(ok);if(!ok)addMistake(qs[i],j);step(i+1);},title); };
  step(0);
}
function testResult(qs,res,start){
  const L=["A2","B1","B2","C1","C2"];const by={};L.forEach(l=>by[l]={c:0,n:0});
  qs.forEach((q,i)=>{const l=L.includes(q.lv)?q.lv:"B1";by[l].n++;if(res[i])by[l].c++;});
  let est="A1";for(const l of L){const x=by[l];if(x.n&&x.c/x.n>=.6)est=l;else break;}
  if(est==="A1"&&by.A2.n&&by.A2.c/by.A2.n>=.4)est="A2";
  const lv={cefr:est,band:bandOf[est],date:today(),detail:by};
  const e=E(); e.level=lv; e.tests.push({date:today(),cefr:est,score:res.filter(Boolean).length,n:res.length}); day().d=day().d||0; logTime(); H.save(true);
  full(hdr(t("levelResult",{l:est}))+`<div class="lvbig num">${est}</div><div class="ms" style="text-align:center;margin-bottom:18px">${t("estBand",{b:bandOf[est]})}</div>
   <div class="fl">${t("levelDetail")}</div>${L.map(l=>{const x=by[l];const p=x.n?Math.round(x.c/x.n*100):0;return `<div class="srow"><span style="width:34px" class="num">${l}</span><span style="flex:1"><div class="pbar"><div style="width:${p}%;background:${p>=60?"var(--eng)":"var(--s3)"}"></div></div></span><span class="num">${x.c}/${x.n}</span></div>`;}).join("")}
   <button class="go" data-close style="background:var(--eng)">${t("done")}</button>`);
  H.render();
}

// ---------- vocab ----------
async function newWords(){
  const c=cache(), e=E(), goal=e.prefs.words, title=t("newWords");
  if(!c.nw||!c.nw.length){
    const known=Object.keys(e.vocab).slice(-500).join(", ");
    let arr; try{ arr=await gen(title,`Generate ${goal} IELTS Academic vocabulary items for a learner at CEFR ${lvl()} aiming for band 7+ (graduate study abroad, engineering background). Prefer high-value academic words and collocations useful in IELTS Writing Task 2 and Reading; slightly above the learner's level. Do not include any of these already-learned words: ${known||"(none)"}.
For each item give: "w" (the word or short phrase), "ipa" (British IPA), "pos" (n./v./adj./adv./phr.), "zh" (concise Simplified Chinese meaning), "en" (simple English definition, max 12 words), "ex" (one natural academic example sentence), "exZh" (Chinese translation of the example), "col" (one or two common collocations).
Reply with only a JSON array of ${goal} objects.`,{}); }catch(err){ fail(title,err,newWords); return; }
    if(!Array.isArray(arr)||!arr.length){fail(title,{code:"invalid_json"},newWords);return;}
    c.nw=arr.filter(x=>x&&x.w&&!e.vocab[String(x.w).toLowerCase()]).map(x=>({w:String(x.w),ipa:x.ipa||"",pos:x.pos||"",zh:x.zh||"",en:x.en||"",ex:x.ex||"",exZh:x.exZh||"",col:x.col||""})); H.save(true);
  }
  const queue=c.nw.filter(x=>!e.vocab[x.w.toLowerCase()]);
  if(!queue.length){ full(hdr(title)+`<div class="gen"><div>${t("sessionDone")} ✓</div><button class="go" id="more" style="background:var(--eng)">+ ${goal}</button></div>`,()=>{$("#more").onclick=()=>{c.nw=[];newWords();};}); return; }
  cards(queue.map(x=>Object.assign({},x,{_new:true})),title);
}
function review(){const q=due().sort(()=>Math.random()-.5).slice(0,80); if(!q.length){toast(t("noDue"));return;} cards(q.map(x=>Object.assign({},x)),t("review"));}
function cards(queue,title){
  actBegin(); let i=0, total=queue.length, doneN=0;
  const show=()=>{
    if(i>=queue.length){ logTime(); H.save(); full(hdr(title)+`<div class="gen"><div class="lvbig num" style="font-size:44px">✓</div><div>${t("sessionDone")} · ${doneN}</div><button class="go" data-close style="background:var(--eng)">${t("done")}</button></div>`); return; }
    const c=queue[i];
    full(hdr(title,`<span class="num" style="font-size:14px;color:var(--t2)">${Math.min(doneN+1,total)} / ${total}</span>`)+`<div class="qbar"><i style="width:${doneN/total*100}%"></i></div>
     <div class="card" id="fc"><div class="cw">${esc(c.w)}</div><div class="cipa">${esc(c.ipa)} <button class="say" data-say="${esc(c.w)}">${ic("i-sound")}</button></div>
      <div class="cback"><div class="cpos">${esc(c.pos)}</div><div class="czh">${esc(c.zh)}</div><div class="cen">${esc(c.en)}</div>
       <div class="cex">${esc(c.ex)} <button class="say sm" data-say="${esc(c.ex)}">${ic("i-sound")}</button><small>${esc(c.exZh)}</small></div>${c.col?`<div class="ccol">${esc(c.col)}</div>`:""}</div>
      <div class="chint">${t("flip")}</div></div>
     <div class="grades" id="gr" style="visibility:hidden">${[["again","var(--move)"],["hard","#ffb340"],["good","var(--eng)"],["easy","var(--habit)"]].map(([g,col],k)=>`<button data-g="${k}" style="--gc:${col}">${t(g)}</button>`).join("")}</div>`,()=>{
      const fc=$("#fc"); fc.onclick=e=>{if(e.target.closest(".say"))return;fc.classList.add("flipped");$("#gr").style.visibility="visible";};
      if(c._new) setTimeout(()=>speak(c.w),250);
      $("#gr").onclick=e=>{const b=e.target.closest("button");if(!b)return;grade(c,+b.dataset.g);
        if(+b.dataset.g===0){queue.push(Object.assign({},c,{_new:false,_again:true}));}else doneN++;
        i++; show();};
    });
  };
  show();
}
function grade(c,g){
  const e=E(),k=c.w.toLowerCase(),tk=today(); let card=e.vocab[k];
  const isNew=!card;
  if(!card){card=e.vocab[k]={w:c.w,ipa:c.ipa,pos:c.pos,zh:c.zh,en:c.en,ex:c.ex,exZh:c.exZh,col:c.col,ivl:0,ef:2.5,reps:0,lap:0,add:tk,due:tk};day().w++;}
  else if(!c._again) day().r++;
  if(g===0){card.ivl=0;card.lap++;card.ef=Math.max(1.3,card.ef-.2);card.due=tk;card.reps=0;}
  else{ if(g===1){card.ivl=Math.max(1,Math.round(card.ivl*1.2));card.ef=Math.max(1.3,card.ef-.15);}
    else if(g===2){card.ivl=card.reps===0?1:card.reps===1?3:Math.round(card.ivl*card.ef);}
    else {card.ivl=card.reps===0?3:Math.round(Math.max(card.ivl,1)*card.ef*1.3)+1;card.ef+=.15;}
    card.reps++; card.due=addDays(tk,card.ivl); }
  H.save(true);
}

// ---------- drill ----------
async function drill(){
  const c=cache(), e=E(), n=e.prefs.drill, title=t("drill");
  if(e.days[today()]&&e.days[today()].d&&c.drillDone){ drillReview(c.dr,c.drillRes); return; }
  if(!c.dr){
    const words=Object.values(e.vocab).sort((a,b)=>b.add<a.add?-1:1).slice(0,40).map(v=>v.w).join(", ");
    const mist=e.mistakes.slice(-6).map(m=>"- "+m.q).join("\n");
    let r; try{ r=await gen(title,`Create today's IELTS Academic practice set for a learner at CEFR ${lvl()} (target band 7, graduate study).
Exactly ${n} multiple-choice questions in this mix: about 40% "vocab" (meaning, collocation or word form in an academic sentence; reuse these recently learned words where possible: ${words||"none yet"}), about 30% "grammar" (errors typical in IELTS writing at this level: articles, tense, agreement, relative clauses, conditionals, passive, prepositions, sentence structure), and about 30% "reading": write one short academic passage (130-170 words, IELTS style, any science/society topic) and ask TRUE / FALSE / NOT GIVEN or multiple-choice questions about it.
${mist?"Also re-test the concepts behind some of these earlier mistakes (new wording):\n"+mist:""}
Every question: exactly one correct answer; TRUE/FALSE/NOT GIVEN items use opts ["TRUE","FALSE","NOT GIVEN"]; otherwise 4 options. Vary the correct position. ${explainRule()} Explanations under 45 words and say why the wrong choice is wrong when useful.
Reply with only JSON: {"passage":{"title":"...","text":"..."},"questions":[{"sec":"vocab"|"grammar"|"reading","q":"...","opts":["..."],"a":0,"exp":"why the answer is right","why":["one short reason per option, same order as opts: why it is right or wrong"]}]}  Put the reading questions last.`,{}); }
    catch(err){ fail(title,err,drill); return; }
    if(!r||!Array.isArray(r.questions)){fail(title,{code:"invalid_json"},drill);return;}
    r.questions=r.questions.filter(q=>q&&Array.isArray(q.opts)&&q.opts.length>=2&&Number.isInteger(q.a));
    c.dr=r; H.save(true);
  }
  const r=c.dr, res=[], picks=[]; actBegin();
  const step=i=>{ if(i>=r.questions.length){ const s=res.filter(Boolean).length; const d=day(); d.d=1; d.ds=s; d.dn=res.length; e.drills.push({date:today(),s,n:res.length}); c.drillDone=1; c.drillRes=picks; logTime(); H.save();
      full(hdr(title)+`<div class="gen"><div class="lvbig num">${s}/${res.length}</div><div>${t("score",{a:s,b:res.length})}</div><button class="go" data-close style="background:var(--eng)">${t("done")}</button></div>`); return; }
    mcqView(r.questions[i],i,r.questions.length,(ok,j)=>{res.push(ok);picks.push(j);if(!ok)addMistake(r.questions[i],j,r.passage);step(i+1);},title,r.passage); };
  step(0);
}
function drillReview(r,picks){
  full(hdr(t("drill"))+(r.passage?`<details class="passage"><summary>${t("reading")} · ${esc(r.passage.title||"")}</summary><div>${esc(r.passage.text)}</div></details>`:"")+
   r.questions.map((q,i)=>{const p=picks?picks[i]:null;const ok=p===q.a;return `<div class="rv ${ok?"ok":"no"}"><div class="qtext" style="font-size:15px">${i+1}. ${esc(q.q)}</div><div class="ms">${p!=null&&!ok?`${t("yourAns")}: ${esc(q.opts[p])} · `:""}${t("correct")}: <b>${esc(q.opts[q.a])}</b></div><p class="ms">${esc(q.exp||"")}</p></div>`;}).join(""));
}
function addMistake(q,j,passage){const e=E();
  e.mistakes.push({id:H.uid(),q:q.q,opts:q.opts,a:q.a,p:j,exp:q.exp,why:Array.isArray(q.why)?q.why:[],sec:q.sec,lv:q.lv||"",date:today(),
    ctx:q.sec==="reading"&&passage?passage.title:"",ptext:q.sec==="reading"&&passage?String(passage.text||"").slice(0,1600):"",right:0});
  if(e.mistakes.length>150)e.mistakes=e.mistakes.slice(-150);}
let mFilter="all";
function mistakes(){
  const all=E().mistakes; all.forEach(x=>{if(!x.id)x.id=H.uid();});
  const list=all.filter(x=>mFilter==="all"||x.sec===mFilter).slice().reverse();
  const cnt=k=>all.filter(x=>k==="all"||x.sec===k).length;
  const tabs=[["all",L3("全部","All","Барлығы")],["vocab",t("vocab")],["grammar",t("grammar")],["reading",t("reading")]];
  full(hdr(t("mistakes"))+
   `<div class="chips" style="justify-content:flex-start;margin:0 0 12px" id="mf">${tabs.map(([k,n])=>`<button class="chip ${mFilter===k?"on":""}" data-mf="${k}" style="--cc:var(--eng)">${n} ${cnt(k)}</button>`).join("")}</div>`+
   (list.length?`<button class="go" id="m-redo" style="background:var(--eng);margin:0 0 14px">${L3("重做错题","Retry mistakes","Қателерді қайта шешу")} (${Math.min(list.length,15)})</button>`:"")+
   (list.length?list.map(x=>mCard(x)).join(""):`<div class="empty">${t("noMistakes")}</div>`)+
   `<div class="hint">${L3("重做时连续答对 2 次，会自动移出错题本","Answer one right twice in a retry and it leaves the book","Екі рет дұрыс жауап берсеңіз, тізімнен шығады")}</div>`,()=>{
    $("#sheet-body").onclick=async e=>{const b=e.target.closest("[data-mf],[data-mdel],[data-mdeep],#m-redo");if(!b)return;
      if(b.dataset.mf){mFilter=b.dataset.mf;mistakes();return;}
      if(b.dataset.mdel){E().mistakes=E().mistakes.filter(x=>x.id!==b.dataset.mdel);H.save(true);mistakes();return;}
      if(b.id==="m-redo"){redo(list.slice(0,15));return;}
      if(b.dataset.mdeep){const x=E().mistakes.find(y=>y.id===b.dataset.mdeep);if(!x)return;b.disabled=true;b.textContent=t("thinking");
        try{const r=await H.aiJson(`A CEFR ${lvl()} IELTS learner got this question wrong.
${x.ptext?`Reading passage:\n"""${x.ptext}"""\n`:""}Question: ${x.q}
Options: ${x.opts.map((o,k)=>"ABCD"[k]+". "+o).join(" | ")}
Correct: ${"ABCD"[x.a]}. The learner chose: ${"ABCD"[x.p]}.
Teach it like a patient tutor. ${explainRule()}
Reply with only JSON: {"rule":"the rule or key idea, 2-4 sentences","trap":"why the learner's choice was tempting and why it is wrong","examples":["2 or 3 new example sentences that use the rule correctly (English), each followed by a short translation in brackets"],"tip":"one memory tip"}`,{modelTier:"default"});
          x.deep=r;H.save(true);mistakes();}catch(err){toast(H.aiErr(err));b.disabled=false;b.textContent=L3("AI 详细讲解","Explain in depth","AI толық түсіндіру");}}
    };});
}
function mCard(x){const letters="ABCD";const d=x.deep;
  return `<div class="rv no mcard"><div class="ms">${H.fmtDay(x.date)} · ${esc({vocab:t("vocab"),grammar:t("grammar"),reading:t("reading")}[x.sec]||"")}${x.lv?" · "+esc(x.lv):""}${x.right?` · ${L3("已对","right","дұрыс")} ${x.right}/2`:""}</div>
   ${x.ptext?`<details class="passage" style="margin:6px 0"><summary>${t("reading")} · ${esc(x.ctx||"")}</summary><div>${esc(x.ptext)}</div></details>`:""}
   <div class="qtext" style="font-size:15.5px;margin-bottom:8px">${esc(x.q)}</div>
   <div class="mopts">${x.opts.map((o,k)=>`<div class="mo ${k===x.a?"ok":k===x.p?"no":""}"><span class="ol">${letters[k]}</span><span>${esc(o)}${Array.isArray(x.why)&&x.why[k]&&(k===x.a||k===x.p)?`<small>${esc(x.why[k])}</small>`:""}</span></div>`).join("")}</div>
   <div class="exp" style="margin-top:10px"><b>${t("explain")}</b><p>${esc(x.exp||"")}</p></div>
   ${d?`<div class="deep"><b>${L3("规则","Rule","Ереже")}</b><p>${esc(d.rule||"")}</p><b>${L3("为什么会选错","Why it was a trap","Неге қателестіңіз")}</b><p>${esc(d.trap||"")}</p><b>${L3("例句","Examples","Мысалдар")}</b><ul class="tips">${(d.examples||[]).map(s=>`<li>${esc(s)}</li>`).join("")}</ul><b>${L3("记忆技巧","Tip","Кеңес")}</b><p>${esc(d.tip||"")}</p></div>`
     :`<button class="pill" data-mdeep="${x.id}" style="width:100%;margin-top:10px">${ic("i-spark")} ${L3("AI 详细讲解","Explain in depth","AI толық түсіндіру")}</button>`}
   <button class="linkbtn" data-mdel="${x.id}">${L3("我已经会了，移出错题本","I've got it — remove","Түсіндім — өшіру")}</button></div>`;}
function redo(items){const title=L3("重做错题","Retry mistakes","Қателерді қайта шешу");let right=0;actBegin();
  const step=i=>{if(i>=items.length){logTime();H.save(true);full(hdr(title)+`<div class="gen"><div class="lvbig num">${right}/${items.length}</div><div>${L3("移出了","Removed","Шығарылды")} ${items.filter(x=>x._gone).length}</div><button class="go" id="back-m" style="background:var(--eng)">${t("mistakes")}</button></div>`,()=>{$("#back-m").onclick=mistakes;});H.render();return;}
    const x=items[i];const q={q:x.q,opts:x.opts,a:x.a,exp:x.exp,why:x.why,sec:x.sec,lv:x.lv};
    mcqView(q,i,items.length,(ok,j)=>{const m=E().mistakes.find(y=>y.id===x.id);
      if(m){if(ok){right++;m.right=(m.right||0)+1;if(m.right>=2){E().mistakes=E().mistakes.filter(y=>y.id!==m.id);x._gone=1;}}else{m.right=0;m.p=j;m.date=today();}}
      step(i+1);},title,x.ptext?{title:x.ctx,text:x.ptext}:null);};
  step(0);}

// ---------- writing ----------
async function writing(){
  const c=cache(), title=t("writing");
  if(!c.wp){ let r; try{ r=await gen(title,`Write one IELTS Academic Writing Task 2 question suitable for a CEFR ${lvl()} candidate aiming for band 7. Choose a common real-exam topic area (education, technology, environment, society, work, health, government). Also give 3 short planning tips for this specific question. ${explainRule()} (tips only; the question itself in English).
Reply with only JSON: {"type":"opinion|discussion|problem-solution|advantages|two-part","prompt":"...","tips":["...","...","..."]}`,{modelTier:"quick"}); }catch(err){ fail(title,err,writing); return; } if(!r||!r.prompt){fail(title,{code:"invalid_json"},writing);return;} c.wp=r; H.save(true); }
  const p=c.wp; actBegin();
  const done=c.wFeedback;
  full(hdr(title)+`<div class="fl">${t("writePrompt")} · ${esc(p.type||"Task 2")}</div><div class="prompt">${esc(p.prompt)}</div>
   ${p.tips?`<details class="passage"><summary>${t("tips")}</summary><ul class="tips">${p.tips.map(x=>`<li>${esc(x)}</li>`).join("")}</ul></details>`:""}
   <textarea class="field ta" id="wt" placeholder="Start writing…" ${done?"readonly":""}>${esc(c.wText||"")}</textarea>
   <div class="wc"><span id="wcount" class="num"></span><span>${t("writeMin")}</span></div>
   ${done?"":`<button class="go" id="w-submit" style="background:var(--habit)">${t("submit")}</button><button class="linkbtn" id="w-new">${t("newPrompt")}</button>`}
   <div id="wfb"></div>`,()=>{
    const ta=$("#wt"),cnt=()=>{const n=(ta.value.trim().match(/\S+/g)||[]).length;$("#wcount").textContent=t("wordCount",{n});return n;};cnt();
    ta.addEventListener("input",()=>{cnt();c.wText=ta.value;clearTimeout(ta._t);ta._t=setTimeout(()=>H.save(true),1000);});
    if(done) showWriteFb(done);
    if(!done){ $("#w-new").onclick=()=>{c.wp=null;c.wText="";writing();};
      $("#w-submit").onclick=async()=>{const n=cnt();if(n<40){toast(t("wordCount",{n})+" < 40");return;} const b=$("#w-submit");b.disabled=true;b.textContent=t("thinking");
        try{ const fb=await H.aiJson(`You are a strict, experienced IELTS Writing examiner. Assess this Task 2 response from a CEFR ${lvl()} candidate using the official public band descriptors (Task Response, Coherence & Cohesion, Lexical Resource, Grammatical Range & Accuracy). Be honest: under 250 words loses TR marks.
Question: ${p.prompt}
Response (${n} words):
"""${ta.value.slice(0,6000)}"""
${explainRule()}
Reply with only JSON: {"overall":6.0,"TR":6,"CC":6,"LR":6,"GRA":6,"summary":"2-3 sentences","corrections":[{"orig":"exact phrase from the text","fix":"corrected version","why":"short reason"}],"improved":"a band-8 rewrite of the candidate's own essay (keep their ideas, 260-300 words)","tips":["3 specific things to improve next time"]}
Give 5-10 of the most useful corrections.`,{modelTier:"default"});
          c.wFeedback=fb; const d=day(); d.wr=1; E().writings.push({date:today(),prompt:p.prompt,words:n,band:fb.overall}); logTime(); H.save(true); writing(); H.render();
        }catch(err){ toast(H.aiErr(err)); b.disabled=false; b.textContent=t("submit"); } };
    }
  });
}
function showWriteFb(fb){
  const cr=["TR","CC","LR","GRA"];
  $("#wfb").innerHTML=`<div class="fbbox"><div class="bandrow"><div><div class="k">${t("band")}</div><div class="lv num">${esc(fb.overall)}</div></div>${cr.map(k=>`<div><div class="k">${k}</div><b class="num">${esc(fb[k]??"-")}</b></div>`).join("")}</div><p>${esc(fb.summary||"")}</p></div>
   <div class="fl">${t("corrections")}</div>${(fb.corrections||[]).map(c=>`<div class="corr"><s>${esc(c.orig)}</s><b>${esc(c.fix)}</b><small>${esc(c.why)}</small></div>`).join("")}
   <div class="fl">${t("tips")}</div><ul class="tips">${(fb.tips||[]).map(x=>`<li>${esc(x)}</li>`).join("")}</ul>
   <details class="passage"><summary>${t("improved")}</summary><div>${esc(fb.improved||"").replace(/\n/g,"<br>")}</div></details>
   <button class="linkbtn" id="w-again">${t("newPrompt")}</button>`;
  $("#w-again").onclick=()=>{const c=cache();c.wp=null;c.wText="";c.wFeedback=null;c.wStart=null;writing();};
}

// ---------- speaking ----------
function makeDictation(){
  const R=window.SpeechRecognition||window.webkitSpeechRecognition; if(!R) return null;
  let rec=null,cb={p:()=>{},f:()=>{},s:()=>{}};
  return {onPartial:f=>cb.p=f,onFinal:f=>cb.f=f,onState:f=>cb.s=f,
    start:async()=>{rec=new R();rec.lang="en-GB";rec.interimResults=true;rec.continuous=true;
      rec.onresult=e=>{let interim="";for(let i=e.resultIndex;i<e.results.length;i++){const r=e.results[i];if(r.isFinal)cb.f({text:r[0].transcript.trim()});else interim+=r[0].transcript;}cb.p({text:interim.trim()});};
      rec.onend=()=>cb.s({state:"idle"});rec.onerror=ev=>{cb.s({state:"idle"});if(ev.error==="not-allowed")throw {code:"not_granted"};};
      rec.start();cb.s({state:"listening"});},
    stop:async()=>{try{rec&&rec.stop();}catch(e){}}};
}
let dict=undefined;
async function speaking(){
  const c=cache(), title=t("speaking");
  if(!c.sq){ let r; try{ r=await gen(title,`Write one IELTS Speaking question for a CEFR ${lvl()} candidate. Pick Part 1, 2 or 3 at random (Part 2 must include the cue-card bullet points). Use a common real-exam topic.
Reply with only JSON: {"part":2,"q":"...","cue":["...","...","..."],"time":"answer length advice, e.g. 1-2 minutes"}`,{modelTier:"quick"}); }catch(err){ fail(title,err,speaking); return; } if(!r||!r.q){fail(title,{code:"invalid_json"},speaking);return;} c.sq=r; H.save(true); }
  const q=c.sq, done=c.sFeedback; actBegin();
  if(dict===undefined) dict=makeDictation();
  full(hdr(title)+`<div class="fl">${t("speakQ")} · ${t("part",{n:q.part||1})}</div><div class="prompt">${esc(q.q)}${q.cue&&q.cue.length?`<ul class="tips">${q.cue.map(x=>`<li>${esc(x)}</li>`).join("")}</ul>`:""}<div class="ms">${esc(q.time||"")}</div></div>
   <button class="pill" data-say="${esc(q.q+(q.cue?". "+q.cue.join(". "):""))}" style="width:100%">${ic("i-sound")} ${t("listen")}</button>
   ${dict&&!done?`<button class="mic" id="mic">${ic("i-mic")}<span>${t("record")}</span></button>`:""}
   <textarea class="field ta" id="st" placeholder="${t("typeInstead")}" style="min-height:140px" ${done?"readonly":""}>${esc(c.sText||"")}</textarea>
   <div class="hint">${t("speakNote")}</div>
   ${done?"":`<button class="go" id="s-submit" style="background:#ff7aa8">${t("submit")}</button><button class="linkbtn" id="s-new">${t("newPrompt")}</button>`}
   <div id="sfb"></div>`,()=>{
    const ta=$("#st"); ta.addEventListener("input",()=>{c.sText=ta.value;});
    if(done) showSpeakFb(done);
    if(dict&&!done){ const mic=$("#mic"); let listening=false, base="";
      dict.onPartial(({text})=>{ta.value=(base+" "+text).trim();});
      dict.onFinal(({text})=>{base=(base+" "+text).trim();ta.value=base;c.sText=base;});
      dict.onState(({state})=>{listening=state==="listening";mic.classList.toggle("on",listening);mic.querySelector("span").textContent=listening?t("stopRec"):t("record");});
      mic.onclick=()=>{ if(listening){dict.stop().catch(()=>{});} else { base=ta.value.trim(); dict.start().catch(e=>{ if(e&&e.code==="not_granted") mic.remove(); }); } };
    }
    if(!done){ $("#s-new").onclick=()=>{c.sq=null;c.sText="";speaking();};
      $("#s-submit").onclick=async()=>{const txt=ta.value.trim();if(txt.split(/\s+/).length<15){toast("15+ words");return;} const b=$("#s-submit");b.disabled=true;b.textContent=t("thinking");
        try{ const fb=await H.aiJson(`You are an experienced IELTS Speaking examiner. Below is a transcript (from speech-to-text, so ignore punctuation and minor transcription noise) of a CEFR ${lvl()} candidate answering this Part ${q.part||1} question: "${q.q}".
Transcript: """${txt.slice(0,5000)}"""
Estimate Fluency & Coherence, Lexical Resource and Grammatical Range & Accuracy from the words only (pronunciation cannot be judged). ${explainRule()}
Reply with only JSON: {"overall":6.0,"FC":6,"LR":6,"GRA":6,"summary":"2-3 sentences","corrections":[{"orig":"...","fix":"...","why":"..."}],"better":"a natural band-8 answer to the same question (Part 1: 3-4 sentences; Part 2: ~200 words; Part 3: ~100 words)","phrases":["5 useful phrases or idioms for this topic with short meaning"]}`,{modelTier:"default"});
          c.sFeedback=fb; day().sp=1; E().speaks.push({date:today(),q:q.q,band:fb.overall}); logTime(); H.save(true); speaking(); H.render();
        }catch(err){ toast(H.aiErr(err)); b.disabled=false; b.textContent=t("submit"); } };
    }
  });
}
function showSpeakFb(fb){
  $("#sfb").innerHTML=`<div class="fbbox"><div class="bandrow"><div><div class="k">${t("band")}</div><div class="lv num">${esc(fb.overall)}</div></div>${["FC","LR","GRA"].map(k=>`<div><div class="k">${k}</div><b class="num">${esc(fb[k]??"-")}</b></div>`).join("")}</div><p>${esc(fb.summary||"")}</p></div>
   <div class="fl">${t("corrections")}</div>${(fb.corrections||[]).map(c=>`<div class="corr"><s>${esc(c.orig)}</s><b>${esc(c.fix)}</b><small>${esc(c.why)}</small></div>`).join("")}
   <div class="fl">${t("better")} <button class="say sm" data-say="${esc(fb.better||"")}">${ic("i-sound")}</button></div><div class="prompt" style="font-weight:600">${esc(fb.better||"")}</div>
   <div class="fl">${t("tips")}</div><ul class="tips">${(fb.phrases||[]).map(x=>`<li>${esc(x)}</li>`).join("")}</ul>
   <button class="linkbtn" id="s-again">${t("newPrompt")}</button>`;
  $("#s-again").onclick=()=>{const c=cache();c.sq=null;c.sText="";c.sFeedback=null;speaking();};
}

// ---------- history / prefs ----------
function history(){const e=E();
  const rows=[...e.tests.map(x=>({d:x.date,t:t("takeTest"),v:x.cefr+" · "+x.score+"/"+x.n})),...e.drills.map(x=>({d:x.date,t:t("drill"),v:x.s+"/"+x.n})),...e.writings.map(x=>({d:x.date,t:t("writing"),v:t("band")+" "+x.band+" · "+x.words+" "+t("words")})),...e.speaks.map(x=>({d:x.date,t:t("speaking"),v:t("band")+" "+x.band}))].sort((a,b)=>a.d<b.d?1:-1).slice(0,60);
  full(hdr(t("history"))+(rows.length?`<ul class="log">${rows.map(r=>`<li><div class="mid"><b>${esc(r.t)}</b><small>${H.fmtDay(r.d)}</small></div><div class="rt num">${esc(r.v)}</div></li>`).join("")}</ul>`:`<div class="empty">—</div>`));}
function prefs(){const p=E().prefs;
  H.openSheet(`<h3>${t("eng")} · ${t("settings")}<button data-close>${t("done")}</button></h3>
   <div class="fl">${t("explainLang")}</div><div class="seg" id="p-ex" style="margin:0;width:auto">${t("explainOpts").map((x,i)=>`<button data-v="${i}" class="${p.explain===i?"on":""}">${x}</button>`).join("")}</div>
   <div class="fl">${t("wordsPerDay")}</div><div class="seg" id="p-w" style="margin:0;width:auto">${[5,10,15,20,30].map(n=>`<button data-v="${n}" class="${p.words===n?"on":""}">${n}</button>`).join("")}</div>
   <div class="fl">${t("drillSize")}</div><div class="seg" id="p-d" style="margin:0;width:auto">${[5,10,15,20].map(n=>`<button data-v="${n}" class="${p.drill===n?"on":""}">${n}</button>`).join("")}</div>`,()=>{
    const g=(id,k)=>{$(id).onclick=e=>{const b=e.target.closest("button");if(!b)return;p[k]=+b.dataset.v;$$(id+" button").forEach(x=>x.classList.toggle("on",x===b));H.save();};};
    g("#p-ex","explain");g("#p-w","words");g("#p-d","drill");});}
})();
