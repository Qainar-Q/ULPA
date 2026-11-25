/* Illustrated motivation cards (inline SVG, no remote images) */
(function(){
"use strict";
const stars=(n,seed,h)=>{let s="",x=seed;for(let i=0;i<n;i++){x=(x*9301+49297)%233280;const a=x/233280;x=(x*9301+49297)%233280;const b=x/233280;s+=`<circle cx="${(a*360).toFixed(1)}" cy="${(b*h).toFixed(1)}" r="${(a*b*1.6+.4).toFixed(2)}" fill="#fff" opacity="${(.35+b*.6).toFixed(2)}"/>`;}return s;};
const G=(id,a,b,v)=>`<linearGradient id="${id}" x1="0" y1="0" x2="${v?0:1}" y2="${v?1:0}"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`;

const SCENES=[
{c:"#ff7a3d",q:"拜科努尔就在哈萨克斯坦的草原上。梦想离你，从来没那么远。",a:"— 点火倒计时",svg:`<defs>${G("s1","#0b1030","#3a2a5c",1)}${G("f1","#fff3b0","#ff5a1f",1)}</defs>
<rect width="360" height="200" fill="url(#s1)"/>${stars(40,7,120)}
<path d="M0 165 Q90 150 180 160 T360 155 V200 H0z" fill="#2b1f2e"/>
<g class="rk-up"><ellipse cx="180" cy="168" rx="70" ry="14" fill="#fff" opacity=".18"/><ellipse cx="150" cy="166" rx="34" ry="12" fill="#fff" opacity=".22"/><ellipse cx="212" cy="167" rx="36" ry="11" fill="#fff" opacity=".2"/>
<path d="M172 128 Q180 175 188 128z" fill="url(#f1)"/>
<path d="M180 30 C193 48 195 75 194 128 H166 C165 75 167 48 180 30z" fill="#f2f2f5"/><path d="M180 30 C186 38 190 48 191 60 H169 C170 48 174 38 180 30z" fill="#ff5a5f"/>
<circle cx="180" cy="80" r="6" fill="#5b8cff" stroke="#c9d6ff" stroke-width="2"/><path d="M166 104 L152 132 H166z M194 104 L208 132 H194z" fill="#ff5a5f"/><rect x="178.5" y="96" width="3" height="30" fill="#d0d0d8"/></g>`},
{c:"#ffb340",q:"山顶的风景，只留给一步一步爬上来的人。",a:"— 今天也往上走一步",svg:`<defs>${G("s2","#ff9a5a","#ffe0a8",1)}</defs>
<rect width="360" height="200" fill="url(#s2)"/><circle cx="270" cy="70" r="30" fill="#fff6d8"/>
<path d="M0 200 L110 70 L150 110 L190 40 L260 130 L300 100 L360 150 V200z" fill="#7a3b4a"/>
<path d="M190 40 L176 58 L184 56 L190 64 L196 54 L204 58z" fill="#fff"/>
<path d="M0 200 L70 140 L130 170 L210 120 L290 175 L360 150 V200z" fill="#4a2338"/>
<line x1="190" y1="40" x2="190" y2="14" stroke="#2b1020" stroke-width="2.5"/><path d="M190 14 L214 20 L190 27z" fill="#ff5a5f"/>`},
{c:"#5b8cff",q:"地球是人类的摇篮，但人不能永远生活在摇篮里。",a:"— 齐奥尔科夫斯基",svg:`<defs><radialGradient id="e3" cx=".45" cy=".25" r=".8"><stop offset="0" stop-color="#7ec8ff"/><stop offset=".6" stop-color="#2a63c8"/><stop offset="1" stop-color="#0d2a6b"/></radialGradient></defs>
<rect width="360" height="200" fill="#05060f"/>${stars(55,3,200)}
<circle cx="180" cy="420" r="300" fill="#5b8cff" opacity=".25"/><circle cx="180" cy="420" r="290" fill="url(#e3)"/>
<path d="M60 175 Q110 150 150 165 T230 150 Q270 145 300 170" fill="none" stroke="#3ddc97" stroke-width="10" opacity=".55" stroke-linecap="round"/>
<g transform="translate(250 62) rotate(-20)"><rect x="-8" y="-6" width="16" height="12" rx="2" fill="#d9d9e0"/><rect x="-40" y="-5" width="28" height="10" fill="#3a5fb8" stroke="#9fb6ff"/><rect x="12" y="-5" width="28" height="10" fill="#3a5fb8" stroke="#9fb6ff"/><line x1="0" y1="-6" x2="0" y2="-16" stroke="#d9d9e0" stroke-width="2"/></g>`},
{c:"#ffcf4a",q:"Алға! 草原上的雄鹰，从不低头看风。",a:"— 向前冲",svg:`<defs>${G("s4","#ffcf6a","#ff7a59",1)}</defs>
<rect width="360" height="200" fill="url(#s4)"/><circle cx="180" cy="150" r="56" fill="#fff4c2" opacity=".9"/>
<path d="M0 160 Q90 140 180 155 T360 150 V200 H0z" fill="#c2552f"/><path d="M0 178 Q120 165 240 176 T360 172 V200 H0z" fill="#8a3322"/>
<g fill="#3a1a14"><path d="M180 70 Q150 48 104 52 Q140 60 156 78 Q168 80 180 84 Q192 80 204 78 Q220 60 256 52 Q210 48 180 70z"/><path d="M176 82 L180 98 L184 82z"/></g>
<g fill="#3a1a14" opacity=".5" transform="translate(70 36) scale(.4)"><path d="M180 70 Q150 48 104 52 Q140 60 156 78 Q168 80 180 84 Q192 80 204 78 Q220 60 256 52 Q210 48 180 70z"/></g>`},
{c:"#ffb340",q:"外界再怎么晃，陀螺仪始终指着自己的方向。你也一样。",a:"— 定轴性",svg:`<defs><radialGradient id="g5" cx=".5" cy=".5" r=".6"><stop offset="0" stop-color="#3a2a10"/><stop offset="1" stop-color="#0c0a08"/></radialGradient></defs>
<rect width="360" height="200" fill="url(#g5)"/><circle cx="180" cy="100" r="80" fill="#ffb340" opacity=".08"/>
<g class="gy" fill="none" stroke-width="5"><ellipse cx="180" cy="100" rx="78" ry="78" stroke="#a07a3a"/><ellipse cx="180" cy="100" rx="78" ry="26" stroke="#ffb340"/><ellipse cx="180" cy="100" rx="26" ry="62" stroke="#ff7a3d"/></g>
<ellipse cx="180" cy="100" rx="38" ry="12" fill="#ffd27a"/><line x1="180" y1="10" x2="180" y2="190" stroke="#fff" stroke-width="3" stroke-dasharray="6 5"/><circle cx="180" cy="100" r="6" fill="#fff"/>`},
{c:"#bf7cff",q:"夜深了还在坚持的人，就是在这时候拉开差距的。",a:"— 图书馆的灯还亮着",svg:`<defs>${G("s6","#120c2a","#2d1b4e",1)}${G("l6","#ffe9a8","#ffe9a800",1)}</defs>
<rect width="360" height="200" fill="url(#s6)"/>${stars(25,11,90)}<circle cx="290" cy="46" r="20" fill="#f3e9ff"/><circle cx="282" cy="40" r="20" fill="url(#s6)"/>
<path d="M90 40 L130 40 L170 150 L50 150z" fill="url(#l6)" opacity=".5"/>
<rect x="30" y="150" width="300" height="10" rx="3" fill="#5a3f2a"/>
<path d="M88 40 L120 40 L112 30 L96 30z" fill="#bf7cff"/><line x1="104" y1="40" x2="104" y2="150" stroke="#7a6a90" stroke-width="3"/>
<rect x="180" y="118" width="70" height="10" rx="2" fill="#ff5a5f"/><rect x="186" y="108" width="62" height="10" rx="2" fill="#5b8cff"/><rect x="182" y="98" width="66" height="10" rx="2" fill="#3ddc97"/>
<path d="M120 148 Q150 136 175 148 Q150 142 120 148z" fill="#fff"/><path d="M120 148 L120 138 Q148 130 175 138 L175 148" fill="#f5f5f7"/>`},
{c:"#3ddc97",q:"终点线在 12 月 28 日。冲过去，整个寒假都是你的。",a:"— 最后的冲刺",svg:`<defs>${G("s7","#7fe0ff","#d8fff0",1)}</defs>
<rect width="360" height="200" fill="url(#s7)"/><circle cx="300" cy="40" r="18" fill="#fff"/>
<path d="M120 80 L240 80 L360 200 L0 200z" fill="#e0573a"/><g stroke="#fff" stroke-width="3"><line x1="160" y1="80" x2="100" y2="200"/><line x1="200" y1="80" x2="260" y2="200"/><line x1="180" y1="80" x2="180" y2="200" stroke-dasharray="8 8"/></g>
<rect x="0" y="70" width="360" height="12" fill="#1f8a5a"/>
<line x1="120" y1="40" x2="120" y2="90" stroke="#333" stroke-width="4"/><line x1="240" y1="40" x2="240" y2="90" stroke="#333" stroke-width="4"/>
<path d="M120 52 Q180 64 240 52" stroke="#fff" stroke-width="6" fill="none"/><text x="180" y="40" text-anchor="middle" font-size="18" font-weight="900" fill="#1f5a3a" font-family="Nunito,sans-serif">FINISH 12/28</text>`},
{c:"#40c8e0",q:"Еңбек етсең ерінбей, тояды қарның тіленбей.（只要不偷懒地付出，就一定会有收获。）",a:"— 阿拜",svg:`<defs>${G("s8","#0e3a4a","#40c8e0",1)}</defs>
<rect width="360" height="200" fill="url(#s8)"/><circle cx="180" cy="200" r="90" fill="#ffe9a8" opacity=".9"/>
<g stroke="#ffe9a8" stroke-width="3" opacity=".6">${Array.from({length:9},(_,i)=>{const a=Math.PI*(i+1)/10;return `<line x1="${180-Math.cos(a)*100}" y1="${200-Math.sin(a)*100}" x2="${180-Math.cos(a)*150}" y2="${200-Math.sin(a)*150}"/>`;}).join("")}</g>
<path d="M0 185 Q60 170 120 182 T240 178 T360 184 V200 H0z" fill="#0a2a36"/>
<g fill="#0a2a36"><path d="M60 182 v-24 q14-16 28 0 v24z"/><path d="M60 158 q14-22 28 0" fill="none" stroke="#0a2a36" stroke-width="3"/></g>`}
];

const css=`.bo{margin-top:12px;border-radius:22px;overflow:hidden;background:var(--s1);position:relative}
.bo svg.pic{display:block;width:100%;height:auto;aspect-ratio:9/5}
.bo .q{padding:14px 16px 4px;font-size:17px;font-weight:900;line-height:1.5}
.bo .a{padding:0 16px 14px;font-size:13px;font-weight:800;color:var(--bc)}
.bo .nav{position:absolute;top:10px;right:10px;display:flex;gap:6px}
.bo .nav button{width:36px;height:36px;border-radius:50%;background:rgba(0,0,0,.45);color:#fff;font-weight:900;font-size:18px;display:grid;place-items:center;backdrop-filter:blur(6px)}
.bo .lbl{position:absolute;top:12px;left:12px;font-size:12px;font-weight:900;color:#fff;background:rgba(0,0,0,.45);padding:6px 10px;border-radius:999px;backdrop-filter:blur(6px)}
.bo .dots{display:flex;gap:5px;justify-content:center;padding:0 0 12px}
.bo .dots i{width:6px;height:6px;border-radius:3px;background:var(--s3);transition:.2s}
.bo .dots i.on{width:16px;background:var(--bc)}
.bo .pic{animation:boIn .45s ease}
@keyframes boIn{from{opacity:0;transform:scale(1.04)}to{opacity:1;transform:none}}
.bo .rk-up{animation:rkUp 3.5s ease-in-out infinite alternate}
@keyframes rkUp{to{transform:translateY(-8px)}}
.bo .gy{transform-origin:180px 100px;animation:gy 9s linear infinite}
@keyframes gy{to{transform:rotate(360deg)}}
@media(prefers-reduced-motion:reduce){.bo *{animation:none!important}}`;

let idx=Math.floor(Date.now()/864e5)%SCENES.length, el;
function draw(){const s=SCENES[idx];
  el.style.setProperty("--bc",s.c);
  el.innerHTML=`<svg class="pic" viewBox="0 0 360 200" preserveAspectRatio="xMidYMid slice" role="img" aria-label="鼓励插图">${s.svg}</svg>
  <span class="lbl">今日能量</span><div class="nav"><button data-bo="-1" aria-label="上一张">‹</button><button data-bo="1" aria-label="下一张">›</button></div>
  <div class="q"></div><div class="a"></div><div class="dots">${SCENES.map((_,i)=>`<i class="${i===idx?"on":""}"></i>`).join("")}</div>`;
  el.querySelector(".q").textContent=s.q;el.querySelector(".a").textContent=s.a;}
window.BOOST={mount(after){
  const st=document.createElement("style");st.textContent=css;document.head.appendChild(st);
  el=document.createElement("div");el.className="bo";
  el.addEventListener("click",e=>{const b=e.target.closest("[data-bo]");if(!b)return;idx=(idx+ +b.dataset.bo+SCENES.length)%SCENES.length;draw();});
  let x0=null;el.addEventListener("touchstart",e=>{x0=e.touches[0].clientX;},{passive:true});
  el.addEventListener("touchend",e=>{if(x0==null)return;const dx=e.changedTouches[0].clientX-x0;x0=null;if(Math.abs(dx)>40){idx=(idx+(dx<0?1:-1)+SCENES.length)%SCENES.length;draw();}},{passive:true});
  draw();return el;},
  attach(root){if(!el)this.mount();const h=root.querySelector(".bt-hero");if(h)h.after(el);}};
})();
