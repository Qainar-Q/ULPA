// 1% Better: IELTS Speaking mock test. The AI examiner reads each question aloud, the student answers by voice
// (recorded and transcribed with Whisper on the server), and at the end gets band scores and feedback.
(function(){
"use strict";
const H=window.H,$=H.$,esc=H.esc,ic=H.ic,L3=(a,b,c)=>H.L3(a,b,c),t=H.t;
const MOCK=window.MOCK={};
let M=null,rec=null,stream=null,chunks=[],recStart=0,tick=null;
const canRec=()=>!!(navigator.mediaDevices&&navigator.mediaDevices.getUserMedia&&window.MediaRecorder);
const fmt=s=>Math.floor(s/60)+":"+String(Math.floor(s%60)).padStart(2,"0");
const LIMIT={1:40,2:120,3:75};

function view(html,mount){H.openSheet(`<div class="mk">${html}</div>`,mount,true);}
function head(){const n=M.items.length,i=M.i;const part=M.items[i]?M.items[i].part:3;
  return `<div class="mkh"><button class="linkbtn" id="mk-quit" style="margin:0;padding:0">${L3("退出","Quit","Шығу")}</button><b>Part ${part}</b><span class="num">${Math.min(i+1,n)} / ${n}</span></div><div class="pbar" style="margin:6px 0 16px"><div style="width:${i/n*100}%;background:#ff7aa8"></div></div>`;}

MOCK.start=async()=>{
  stopAll();
  view(`<div class="mkintro"><div class="mkav">${ic("i-mic")}</div><b>${L3("雅思口语模拟考","IELTS Speaking mock test","IELTS сөйлеу сынағы")}</b>
    <p>${L3("和真实考试一样：Part 1 四个日常问题，Part 2 准备 1 分钟、讲 2 分钟，Part 3 三个深入问题。考官会把问题读出来，你直接用英语回答。全部答完后 AI 按雅思四项标准打分。","Like the real exam: Part 1 has 4 everyday questions, Part 2 gives 1 minute to prepare and 2 minutes to talk, Part 3 has 3 discussion questions. The examiner reads each question aloud and you answer in English. At the end the AI gives band scores.","Нақты емтихан сияқты: Part 1 – 4 сұрақ, Part 2 – 1 минут дайындық және 2 минут сөйлеу, Part 3 – 3 сұрақ.")}</p>
    <ul class="tips"><li>${L3("找个安静的地方，戴耳机更好","Find a quiet place; headphones help","Тыныш жер табыңыз")}</li><li>${L3("第一次会请求麦克风权限，点允许","Allow the microphone when asked","Микрофонға рұқсат беріңіз")}</li><li>${L3("发音分数只是参考（AI 只能听到文字）","Pronunciation is only estimated (the AI sees the transcript)","Айтылым тек болжам")}</li></ul>
    ${canRec()?"":`<div class="prompt">${L3("这个浏览器不能录音，你可以打字回答。","This browser can't record; you can type your answers.","Бұл браузер жаза алмайды, теріп жазыңыз.")}</div>`}
    <button class="go" id="mk-go" style="background:#ff7aa8">${L3("开始考试","Start the test","Бастау")}</button></div>`,()=>{
    $("#mk-go").onclick=async()=>{const b=$("#mk-go");b.disabled=true;b.textContent=t("thinking");
      try{if(canRec()&&!stream)stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true}});}catch(e){stream=null;}
      try{const q=await H.aiJson(`You are an IELTS Speaking examiner preparing one full test for a CEFR ${ENG.lvl()} candidate. Use common real-exam topics; Part 3 must follow the Part 2 theme.
Reply with only JSON: {"p1topic":"short topic name","p1":["4 Part 1 questions"],"p2":{"task":"Describe ...","cue":["You should say: ...","...","..."],"last":"and explain ..."},"p3":["3 Part 3 questions"]}`,{modelTier:"quick"});
        if(!q||!Array.isArray(q.p1)||!q.p2||!Array.isArray(q.p3))throw {code:"invalid_json"};
        M={i:0,items:[...q.p1.slice(0,4).map(x=>({part:1,q:x})),{part:2,q:q.p2.task,cue:[...(q.p2.cue||[]),q.p2.last].filter(Boolean)},...q.p3.slice(0,3).map(x=>({part:3,q:x}))],topic:q.p1topic};
        ENG.beginWork();ask();
      }catch(err){H.toast(H.aiErr(err));b.disabled=false;b.textContent=L3("开始考试","Start the test","Бастау");}};
  });
};

function say(text){try{ENG.speak(text);}catch(e){}}
function ask(){
  const it=M.items[M.i];if(!it){finish();return;}
  if(it.part===2&&!it.prepped){prep(it);return;}
  const intro=M.i===0?"Let's talk about "+(M.topic||"you")+". ":M.items[M.i-1]&&M.items[M.i-1].part!==it.part?(it.part===3?"We've been talking about this topic. Let's discuss some more general questions. ":""):"";
  const spoken=it.part===2?"Please start speaking now. You have up to two minutes.":intro+it.q;
  view(head()+`<div class="mkq"><div class="mkav sm">${ic("i-sound")}</div><div><div class="k">${L3("考官","Examiner","Емтихан алушы")}</div><div class="mkqt">${esc(it.q)}</div>${it.cue?`<ul class="tips">${it.cue.map(c=>`<li>${esc(c)}</li>`).join("")}</ul>`:""}<button class="linkbtn" id="mk-again" style="margin:6px 0 0;padding:0">${ic("i-sound")} ${L3("再听一遍","Hear again","Қайта тыңдау")}</button></div></div>
    ${canRec()&&stream?`<button class="mkrec" id="mk-rec"><span class="dot"></span><b>${L3("开始回答","Start answering","Жауап беру")}</b><small class="num" id="mk-time">${L3(`建议 ${it.part===1?"20–30 秒":it.part===2?"1.5–2 分钟":"40–60 秒"}`,`Aim for ${it.part===1?"20–30 s":it.part===2?"1.5–2 min":"40–60 s"}`,"")}</small></button>`
      :`<textarea class="field ta" id="mk-ta" style="min-height:140px" placeholder="${L3("用英语打字回答","Type your answer in English","Ағылшынша жазыңыз")}"></textarea><button class="go" id="mk-next" style="background:#ff7aa8">${L3("下一题","Next","Келесі")}</button>`}`,()=>{
    $("#mk-quit").onclick=quit;$("#mk-again").onclick=()=>say(it.part===2?it.q+". "+(it.cue||[]).join(". "):it.q);
    setTimeout(()=>say(spoken),250);
    if($("#mk-next"))$("#mk-next").onclick=()=>{const txt=$("#mk-ta").value.trim();it.text=txt;it.sec=0;M.i++;ask();};
    const b=$("#mk-rec");if(!b)return;
    b.onclick=()=>{if(rec&&rec.state==="recording"){stopRec(it);return;}try{speechSynthesis.cancel();}catch(e){}startRec(it);b.classList.add("on");b.querySelector("b").textContent=L3("答完了，下一题","Done, next question","Дайын, келесі");};
  });
}
function prep(it){
  let left=60;
  view(head()+`<div class="mkq"><div class="mkav sm">${ic("i-list")}</div><div><div class="k">Part 2 · ${L3("准备 1 分钟","1 minute to prepare","1 минут дайындық")}</div><div class="mkqt">${esc(it.q)}</div><ul class="tips">${(it.cue||[]).map(c=>`<li>${esc(c)}</li>`).join("")}</ul></div></div>
    <div class="mkprep num" id="mk-prep">1:00</div><textarea class="field ta" id="mk-notes" style="min-height:110px" placeholder="${L3("可以记几个关键词（考试时也有纸笔）","Jot down a few key words (you get paper in the exam)","Түйін сөздер")}"></textarea>
    <button class="go" id="mk-ready" style="background:#ff7aa8">${L3("准备好了，开始讲","I'm ready, start talking","Дайынмын")}</button>`,()=>{
    $("#mk-quit").onclick=quit;
    say("Now, I'm going to give you a topic, and I'd like you to talk about it for one to two minutes. You have one minute to think about what you're going to say. "+it.q);
    const go=()=>{clearInterval(tick);it.prepped=true;it.notes=($("#mk-notes")||{}).value||"";ask();};
    tick=setInterval(()=>{left--;const el=$("#mk-prep");if(!el){clearInterval(tick);return;}el.textContent=fmt(Math.max(0,left));if(left<=0)go();},1000);
    $("#mk-ready").onclick=go;
  });
}
function startRec(it){
  chunks=[];const types=["audio/webm;codecs=opus","audio/mp4","audio/webm","audio/ogg"];const type=types.find(x=>MediaRecorder.isTypeSupported&&MediaRecorder.isTypeSupported(x))||"";
  rec=new MediaRecorder(stream,type?{mimeType:type,audioBitsPerSecond:32000}:undefined);rec.ondataavailable=e=>{if(e.data&&e.data.size)chunks.push(e.data);};
  rec.start(1000);recStart=Date.now();
  clearInterval(tick);tick=setInterval(()=>{const s=(Date.now()-recStart)/1000;const el=$("#mk-time");if(el)el.textContent=fmt(s)+" / "+fmt(LIMIT[it.part]);if(s>=LIMIT[it.part])stopRec(it);},250);
}
function stopRec(it){
  if(!rec||rec.state!=="recording")return;clearInterval(tick);const r=rec;rec=null;it.sec=Math.round((Date.now()-recStart)/1000);
  it.job=new Promise(res=>{r.onstop=()=>res(new Blob(chunks,{type:r.mimeType||"audio/webm"}));r.stop();}).then(upload).then(txt=>{it.text=txt;return txt;}).catch(e=>{it.text="";it.err=true;return "";});
  M.i++;ask();
}
async function upload(blob){
  const b64=await new Promise((res,rej)=>{const fr=new FileReader();fr.onload=()=>res(String(fr.result).split(",")[1]||"");fr.onerror=rej;fr.readAsDataURL(blob);});
  for(let k=0;k<2;k++){const {data,error}=await HUB.sb.functions.invoke("hub-ai",{body:{action:"transcribe",audio:b64,mime:blob.type}});if(!error&&data&&typeof data.text==="string")return data.text;await new Promise(r=>setTimeout(r,1500));}
  throw new Error("transcribe");
}
function quit(){if(!confirm(L3("退出这次模拟考？已经答的不会保存。","Quit this mock test? Answers so far won't be saved.","Шығасыз ба?")))return;stopAll();H.closeSheet();}
function stopAll(){clearInterval(tick);try{rec&&rec.state==="recording"&&rec.stop();}catch(e){}rec=null;try{speechSynthesis.cancel();}catch(e){}}
function release(){try{stream&&stream.getTracks().forEach(tr=>tr.stop());}catch(e){}stream=null;}

async function finish(){
  release();
  view(`<div class="mkintro"><div class="mkav">${ic("i-spark")}</div><b>${L3("考官正在评分…","The examiner is scoring…","Бағалап жатыр…")}</b><p id="mk-wait">${L3("正在把你的回答转成文字","Turning your answers into text","Жауаптар мәтінге айналуда")}</p></div>`,()=>{});
  await Promise.all(M.items.map(it=>it.job||Promise.resolve()));
  const answers=M.items.map((it,i)=>({n:i+1,part:it.part,question:it.q,seconds:it.sec||null,words:(it.text||"").split(/\s+/).filter(Boolean).length,transcript:it.text||"(no answer)"}));
  const w=$("#mk-wait");if(w)w.textContent=L3("AI 考官正在按雅思标准打分","Scoring against the IELTS descriptors","IELTS бойынша бағалау");
  try{
    const r=await H.aiJson(`You are a certified IELTS Speaking examiner. Score this full test (CEFR ${ENG.lvl()} candidate) using the public IELTS band descriptors. Transcripts come from speech-to-text, so ignore punctuation and small transcription errors; use seconds and word counts to judge fluency (speech rate, very short answers). Pronunciation cannot be heard: give a cautious estimate from fluency only and say so.
Answers: ${JSON.stringify(answers)}
${ENG.explainRule()} Quotes from the candidate and model answers stay in English.
Reply with only JSON: {"overall":6.0,"FC":6,"LR":6,"GRA":6,"P":6,"summary":"3 sentences: level now and the single biggest thing to fix","per":[{"n":1,"comment":"one or two sentences","better":"a natural band-8 version of this answer (Part 1: 2-3 sentences; Part 2: ~180 words; Part 3: 4-5 sentences)"}],"fixes":[{"orig":"candidate's words","fix":"corrected","why":"short reason"}],"phrases":["5 useful phrases or collocations for these topics"]}`);
    M.result=r;ENG.markMock(r.overall,r.summary);showResult();
  }catch(err){
    view(`<div class="mkintro"><b>${L3("打分没成功","Scoring failed","Бағалау сәтсіз")}</b><p>${esc(H.aiErr(err))}</p><button class="go" id="mk-retry" style="background:#ff7aa8">${L3("再试一次","Try again","Қайталау")}</button></div>`,()=>{$("#mk-retry").onclick=finish;});
  }
}
function showResult(){
  const r=M.result;const per=new Map((r.per||[]).map(p=>[+p.n,p]));
  view(`<div class="mkh"><b>${L3("考试结果","Result","Нәтиже")}</b><button class="linkbtn" data-close style="margin:0;padding:0">${t("close")}</button></div>
   <div class="fbbox"><div class="bandrow"><div><div class="k">${t("band")}</div><div class="lv num">${esc(r.overall)}</div></div>${["FC","LR","GRA","P"].map(k=>`<div><div class="k">${k}</div><b class="num">${esc(r[k]??"-")}</b></div>`).join("")}</div>
   <div style="font-weight:700;line-height:1.55;margin-top:8px">${esc(r.summary||"")}</div><div class="hint">FC ${L3("流利连贯","fluency","еркіндік")} · LR ${L3("词汇","vocabulary","сөздік")} · GRA ${L3("语法","grammar","грамматика")} · P ${L3("发音（估计）","pronunciation (estimate)","айтылым")}</div></div>
   ${M.items.map((it,i)=>{const p=per.get(i+1)||{};return `<details class="mka"><summary><span class="mkp">P${it.part}</span><span>${esc(it.q)}</span></summary>
     <div class="k">${L3("你说的","You said","Сіз айттыңыз")}${it.sec?` · ${fmt(it.sec)}`:""}</div><div class="mkt">${esc(it.text||(it.err?L3("（这段没转成文字）","(couldn't transcribe)","(мәтін жоқ)"):"—"))}</div>
     ${p.comment?`<div class="k">${L3("考官点评","Examiner","Пікір")}</div><div>${esc(p.comment)}</div>`:""}
     ${p.better?`<div class="k">${L3("8 分示范","Band 8 version","8 балл үлгісі")} <button class="say sm" data-say="${esc(p.better)}">${ic("i-sound")}</button></div><div class="prompt" style="font-weight:600">${esc(p.better)}</div>`:""}</details>`;}).join("")}
   ${(r.fixes||[]).length?`<div class="fl">${t("corrections")}</div>${r.fixes.map(c=>`<div class="corr"><s>${esc(c.orig)}</s><b>${esc(c.fix)}</b><small>${esc(c.why)}</small></div>`).join("")}`:""}
   ${(r.phrases||[]).length?`<div class="fl">${t("tips")}</div><ul class="tips">${r.phrases.map(x=>`<li>${esc(x)}</li>`).join("")}</ul>`:""}
   <button class="go" id="mk-new" style="background:#ff7aa8;margin-top:14px">${L3("再考一套","Take another test","Тағы бір сынақ")}</button>`,()=>{
    $("#mk-new").onclick=MOCK.start;
    $("#sheet-body").addEventListener("click",e=>{const b=e.target.closest("[data-say]");if(b){e.stopPropagation();ENG.speak(b.dataset.say);}});
  });
}
H.onSheetCloseMock=()=>{stopAll();release();};
})();
