/* ════════════════════════════════════════════════════════════════
   Интерфейс. Вся разметка собрана из компонентов дизайн-системы
   (game/ui.html): panel, btn, table, stat, meter, chip, tag, stamp.
   Игровая логика в этот файл не заходит.
   ════════════════════════════════════════════════════════════════ */

/* ─── диалоги ────────────────────────────────────────────────── */
const mq=[]; let mopen=false;
let SHEET_T='';          // заголовок листа, из которого потрачен ход
function sheetOpen(m){ mq.push(m); if(!mopen)mnext(); }
function mnext(){
  const m=mq.shift();
  const wrap=document.getElementById('modal'), sh=document.getElementById('msheet');
  if(!m){ mopen=false; wrap.classList.remove('show'); return; }
  mopen=true; SHEET_T=m.title||'';
  const acts=(m.acts||[{label:'Закрыть'}]).map((a,i)=>
    `<button class="btn ${i===0?'pri':''}" data-a="${i}">${a.label}</button>`).join('');
  const opts=(m.opts||[]).map((o,i)=>
    `<button class="opt" data-o="${i}"><b>${o.label}</b>${o.hint?`<span>${o.hint}</span>`:''}</button>`).join('');
  sh.innerHTML=`<div class="mh"><i>${m.eye||''}</i><h2>${m.title||''}</h2></div>
    <div class="mb">${m.body||''}${opts?'<div style="margin-top:10px">'+opts+'</div>':''}</div>
    ${m.opts?'':`<div class="mf">${acts}</div>`}`;
  wrap.classList.add('show'); wrap.scrollTop=0;
  // окно отвечает один раз: повторное нажатие по уже закрытому листу игнорируется
  let answered=false;
  // обработчик может открыть следующее окно сам — тогда очередь не двигаем
  sh.querySelectorAll('[data-a]').forEach(b=>b.onclick=()=>{
    if(answered)return; answered=true;
    const a=(m.acts||[{}])[+b.dataset.a]; mopen=false;
    if(a&&a.fn)a.fn();
    if(!mopen)mnext();
    render();
  });
  sh.querySelectorAll('[data-o]').forEach(b=>b.onclick=()=>{
    if(answered)return; answered=true;
    const o=m.opts[+b.dataset.o]; mopen=false;
    if(o.fn)o.fn();
    if(!mopen)mnext();
    render();
  });
  if(m.after)m.after();
}
function modalClose(){ mopen=false; document.getElementById('modal').classList.remove('show'); }

/* ─── кирпичи разметки ───────────────────────────────────────── */
function panel(o){
  return `<div class="panel ${o.cls||''}">`+
    (o.title?`<header><h4>${o.title}</h4>${o.meta?`<span class="meta">${o.meta}</span>`:''}</header>`:'')+
    `<div class="body${o.flush?' flush':''}">${o.body}</div>`+
    (o.foot?`<footer>${o.foot}</footer>`:'')+`</div>`;
}
function stat(k,v,d,cls){
  return `<div class="stat ${cls||''}"><div class="k">${k}</div><div class="v">${v}</div>`+
    (d?`<div class="d">${d}</div>`:'')+`</div>`;
}
function bar(parts,h){
  return `<div class="meter" style="height:${h||8}px">${parts.map(p=>
    `<i style="width:${p[0]}%;background:${p[1]}"></i>`).join('')}<span class="mid"></span></div>`;
}
/* Порог не всегда половина: у клотура и у преодоления вето он свой,
   и планка на шкале должна стоять там, где он на самом деле. */
function voteBar(yes,no,need){
  const t=yes+no||1, th=need||Math.floor(t/2)+1;
  return `<div class="meter tall" style="margin:8px 0 4px">
      <i style="width:${yes/t*100}%;background:var(--good)"></i>
      <i style="width:${no/t*100}%;background:var(--bad)"></i>
      <span class="mid" style="left:${clamp(th/t*100,0,100)}%"></span></div>
    <div style="display:flex;justify-content:space-between;font-size:12px">
      <span class="good">за ${yes}</span><span class="dim">порог ${th}</span><span class="bad">против ${no}</span></div>`;
}
/* Полоса с тремя долями и честным порогом: за, колеблющиеся, против.
   Прогноз голосования — это не «да или нет», а «да, нет и ещё не знаю». */
function splitBar(yes,und,no,need,tot){
  const t=tot||(yes+und+no)||1;
  return `<div class="meter tall" style="margin:8px 0 4px">
      <i style="width:${yes/t*100}%;background:var(--good)"></i>
      <i style="width:${und/t*100}%;background:var(--line-2)"></i>
      <i style="width:${no/t*100}%;background:var(--bad)"></i>
      <span class="mid" style="left:${clamp(need/t*100,0,100)}%"></span></div>
    <div style="display:flex;justify-content:space-between;font-size:12px">
      <span class="good">за ${yes}</span><span class="dim">колеблются ${und} · порог ${need}</span>
      <span class="bad">против ${no}</span></div>`;
}
function mini(v,color){ return `<span class="mini"><i style="width:${clamp(v,0,100)}%;background:${color||'var(--ink-2)'}"></i></span>`; }
function chip(p){ return `<span class="chip">${emblem(p,15)}${p.short}</span>`; }
/* ═══ ПОЛУКРУГ ЗАЛА ═══════════════════════════════════════════════
   Ровный зал, как на схемах настоящих парламентов. Ряды концентрические,
   шаг кресла вдоль ряда равен шагу между рядами, а крайние кресла
   каждого ряда стоят на одной прямой — на полу зала. Места раздаются
   рядам по длине дуги, потом весь зал сортируется по углу слева
   направо: каждая фракция получает свой клин от первого ряда
   до последнего, и граница между фракциями идёт по радиусу. */
const ARCH_GEO={};
function archGeom(n,rin){
  const key=n+'|'+rin; if(ARCH_GEO[key])return ARCH_GEO[key];
  // рядов ровно столько, чтобы при равном шаге поместились все места
  let R=2;
  for(;R<48;R++){ const d=(1-rin)/(R-1); let cap=0;
    for(let k=0;k<R;k++)cap+=Math.floor(Math.PI*(rin+k*d)/d)+1;
    if(cap>=n)break; }
  const dr=(1-rin)/(R-1), rad=[];
  for(let k=0;k<R;k++)rad.push(rin+k*dr);
  const sum=rad.reduce((a,b)=>a+b,0), raw=rad.map(r=>n*r/sum), cnt=raw.map(Math.floor);
  let left=n-cnt.reduce((a,b)=>a+b,0);
  raw.map((v,i)=>[v-cnt[i],i]).sort((a,b)=>b[0]-a[0]).slice(0,left).forEach(x=>cnt[x[1]]++);
  const slots=[];
  cnt.forEach((m,k)=>{ for(let j=0;j<m;j++){
    const a=m===1?Math.PI/2:Math.PI*(1-j/(m-1));      // π — левый край пола, 0 — правый
    slots.push({a,r:rad[k],k});
  }});
  slots.sort((p,q)=>q.a-p.a||p.r-q.r);
  return (ARCH_GEO[key]={slots,rows:R,dr,cnt});
}
/* seats — кресла слева направо: {f:цвет} для раскладки по фракциям
   или {v:'yes'|'no'|'und'} для итогов голосования.
   o.ring — фракции для внешней дуги: [{p,n}] в том же порядке. */
function archSvg(seats,o){
  o=o||{};
  const n=seats.length, rin=o.rin||0.4, g=archGeom(n,rin);
  const R=o.R||230, dot=g.dr*R*(o.sq?0.33:0.37);
  const padX=o.ring?74:dot+4, padT=o.ring?40:dot+10, padB=dot+8;
  const W=2*R+2*padX, cx=W/2, cy=R+padT, H=cy+padB;
  const P=(a,r)=>[cx+Math.cos(a)*r, cy-Math.sin(a)*r];
  let body='';
  seats.forEach((s,i)=>{
    const sl=g.slots[i]; if(!sl)return;
    const [x,y]=P(sl.a,sl.r*R);
    const cls=s.v?' class="s-'+s.v+'"':'';
    const fill=s.f?` fill="${s.f}"`:'';
    const t=s.t?`<title>${s.t}</title>`:'';
    if(o.sq){
      // квадраты не поворачиваем: ровные ряды читаются спокойнее, чем веер ромбов
      const h=dot*0.9;
      body+=`<rect${cls}${fill} x="${(x-h).toFixed(1)}" y="${(y-h).toFixed(1)}" width="${(2*h).toFixed(1)}" height="${(2*h).toFixed(1)}">${t}</rect>`;
    } else body+=`<circle${cls}${fill} cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${dot.toFixed(2)}">${t}</circle>`;
  });
  // пол зала: волосяная линейка под крайними креслами
  const floor=`<line class="a-floor" x1="${(cx-R-dot-6).toFixed(1)}" x2="${(cx+R+dot+6).toFixed(1)}" y1="${(cy+dot+4).toFixed(1)}" y2="${(cy+dot+4).toFixed(1)}"/>`;
  // внешняя дуга фракций с подписями
  let ring='';
  if(o.ring){
    // граница клина — идеальный радиус по доле мест, а не зубчатый край кресел
    let c=0; const rr=R+dot+8, gap=0.011;
    o.ring.forEach(f=>{
      if(!f.n)return;
      const a0=Math.PI*(1-c/n), a1=Math.PI*(1-(c+f.n)/n); c+=f.n;
      let s0=a0-gap, s1=a1+gap;
      if(s1>=s0){ const m=(a0+a1)/2; s0=m+0.003; s1=m-0.003; }
      const [x0,y0]=P(s0,rr), [x1,y1]=P(s1,rr);
      ring+=`<path class="a-ring" stroke="${f.p.color}" d="M${x0.toFixed(1)} ${y0.toFixed(1)}A${rr} ${rr} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)}"/>`;
      if(a0-a1>0.13){
        const am=(a0+a1)/2, [lx,ly]=P(am,rr+15);
        const anc=Math.cos(am)>0.28?'start':Math.cos(am)<-0.28?'end':'middle';
        ring+=`<text class="a-lab" x="${lx.toFixed(1)}" y="${(ly+3).toFixed(1)}" text-anchor="${anc}">${f.p.short} ${f.n}</text>`;
      }
    });
  }
  // черта большинства: засечка над залом по вертикали
  const maj=o.maj?(()=>{ const [x,y]=P(Math.PI/2,R+dot+(o.ring?4:3));
    return `<line class="a-maj" x1="${x}" x2="${x}" y1="${(y-9).toFixed(1)}" y2="${(y+1).toFixed(1)}"/>`; })():'';
  // в проёме зала — главное число
  const inner=g.slots.length?rin*R:0;
  // размеры подписей — в долях проёма, чтобы при любом масштабе не наезжать на кресла
  const ctr=o.big!==undefined?`<text class="a-big" x="${cx}" y="${(cy-inner*0.3).toFixed(1)}" text-anchor="middle" style="font-size:${(inner*0.5).toFixed(0)}px">${o.big}</text>`
    +(o.sub?`<text class="a-sub" x="${cx}" y="${(cy-inner*0.08).toFixed(1)}" text-anchor="middle" style="font-size:${(inner*0.1).toFixed(1)}px">${o.sub}</text>`:''):'';
  return `<svg class="arch${o.sq?' sq':''}" viewBox="0 0 ${W.toFixed(0)} ${H.toFixed(0)}" role="img">${floor}${ring}${maj}${body}${ctr}</svg>`;
}
/* раскладка палаты по фракциям: партии слева направо по курсу */
function archParty(counts,o){
  const seats=[], ring=[];
  seatOrder().forEach(p=>{ const k=counts(p.id)||0; if(!k)return;
    ring.push({p,n:k});
    for(let i=0;i<k;i++)seats.push({f:p.color,t:p.name}); });
  return archSvg(seats,Object.assign({ring:null},o||{}));
}
/* подпись к залу: эмблема, имя, места — в порядке клиньев */
function archLegend(counts){
  return '<div class="arch-leg">'+seatOrder().filter(p=>counts(p.id)).map(p=>
    `<span>${emblem(p,22)}${p.name} <b>${counts(p.id)}</b>${inCoal(p.id)?'<u>коалиция</u>':''}</span>`).join('')+'</div>';
}
function hemicycle(){
  return archParty(seatsOf,{R:236,big:SEATS,sub:'мандатов'});
}

/* ─── кто как голосует ────────────────────────────────────────────
   Итог не выдумывается кресло за креслом: самые расположенные к проекту
   голосуют «за», самые враждебные — «против», середина колеблется.
   Так на табло ровно столько зелёных и красных мест, сколько в счёте. */
function seatVotes(list,yes,no){
  const s=list.slice().sort((a,b)=>b.v-a.v), out=new Map();
  s.forEach((x,i)=>out.set(x.d,i<yes?'yes':i>=s.length-no?'no':'und'));
  return out;
}
/* группировка по фракциям в порядке зала */
function voteFactions(pool,vote){
  const rows=[];
  seatOrder().forEach(p=>{
    const mine=pool.filter(d=>d.party===p.id); if(!mine.length)return;
    let y=0,n=0,u=0; mine.forEach(d=>{ const v=vote.get(d); v==='yes'?y++:v==='no'?n++:u++; });
    rows.push({p,y,n,u,tot:mine.length});
  });
  return rows;
}
/* ═══ ТАБЛО ГОЛОСОВАНИЯ ════════════════════════════════════════════
   Слева зал: кресла стоят на своих местах, клин фракции подписан по
   внешней дуге, а цвет кресла — как оно проголосовало. Справа табло:
   счёт крупными цифрами на чёрном, как на табло в настоящем зале,
   и итог. Внизу фракции, у каждой своя эмблема и своя полоса. */
function voteBoard(o){
  const tot=o.tot||(o.yes+o.no+(o.und||0));
  const seats=[];
  o.rows.forEach(r=>{                       // внутри клина: «за», колеблющиеся, «против»
    for(let i=0;i<r.y;i++)seats.push({v:'yes'});
    for(let i=0;i<r.u;i++)seats.push({v:'und'});
    for(let i=0;i<r.n;i++)seats.push({v:'no'});
  });
  const pass=o.yes>=o.need, fc=o.final===false;
  const lack=Math.max(0,o.need-o.yes);
  const svg=archSvg(seats,{R:o.R||232,ring:o.rows.map(r=>({p:r.p,n:r.tot})),sq:o.sq,
    big:o.yes,sub:'за · нужно '+o.need});
  const pct=v=>(v/Math.max(1,tot)*100).toFixed(2);
  const fr=o.rows.map(r=>`<tr>
      <td class="vb-e">${emblem(r.p,20)}</td>
      <td class="vb-n"><b>${r.p.name}</b>${r.p.id===PL?' <span class="tag">вы</span>':inCoal(r.p.id)?' <span class="tag y">коал.</span>':''}</td>
      <td class="vb-bar hide-s"><span>${r.y?`<i class="y" style="width:${(r.y/r.tot*100).toFixed(1)}%"></i>`:''}${
        r.u?`<i class="u" style="width:${(r.u/r.tot*100).toFixed(1)}%"></i>`:''}${
        r.n?`<i class="n" style="width:${(r.n/r.tot*100).toFixed(1)}%"></i>`:''}</span></td>
      <td class="n good">${r.y}</td><td class="n bad">${r.n}</td>${o.und!==undefined&&!o.noUnd?`<td class="n dim">${r.u}</td>`:''}
    </tr>`).join('');
  const und=o.und!==undefined&&!o.noUnd;
  return `<div class="vb">
    <div class="vb-h"><span><b>${o.house||'Народное собрание'}</b>${o.what?' · '+o.what:''}</span>
      <span>${fc?'прогноз':'итог'} · порог ${o.need} из ${tot}</span></div>
    <div class="vb-m">
      <div class="vb-a">${svg}</div>
      <div class="vb-r">
        <div class="vb-sc">
          <div class="${pass?'on':''}"><i class="s-yes"></i><span>за</span><b>${o.yes}</b></div>
          <div class="${!pass&&!fc?'on':''}"><i class="s-no"></i><span>против</span><b>${o.no}</b></div>
          ${und?`<div><i class="s-und"></i><span>${o.undWord||'колеблются'}</span><b>${o.und}</b></div>`:''}
          <div class="t"><i></i><span>нужно</span><b>${o.need}</b></div>
        </div>
        <div class="vb-v ${fc?'f':pass?'y':'n'}">${fc
          ?(pass?'хватает с запасом '+(o.yes-o.need):'не хватает '+lack)
          :(o.verdict||(pass?'решение принято':'решение не принято'))}</div>
      </div>
    </div>
    <table class="vb-f"><thead><tr><th colspan="2">Фракция</th><th class="hide-s"></th>
      <th class="n">За</th><th class="n">Против</th>${und?'<th class="n">?</th>':''}</tr></thead>
      <tbody>${fr}</tbody></table>
  </div>`;
}
/* доска Собрания по списку депутатов с оценкой v */
function houseBoard(list,yes,no,need,o){
  const vote=seatVotes(list,yes,no);
  const und=SEATS-yes-no;
  return voteBoard(Object.assign({rows:voteFactions(S.deputies,vote),yes,no,
    und:o&&(o.final===false||o.showUnd)?und:undefined,need,tot:SEATS},o||{}));
}
function senBoard(list,yes,no,need,o){
  const vote=seatVotes(list,yes,no);
  const und=SEN_SEATS-yes-no;
  return voteBoard(Object.assign({rows:voteFactions(S.senate,vote),yes,no,und:o&&o.final===false?und:undefined,
    need,tot:SEN_SEATS,house:'Сенат',sq:true,R:200},o||{}));
}

/* ═══ ЭМБЛЕМЫ ПАРТИЙ ═══════════════════════════════════════════════
   Эмблема собирается из четырёх решений: форма щита, знак, цвет знака
   и кайма. Цвет поля — цвет фракции, тот же, что на полукруге, поэтому
   эмблема и клин в зале узнаются друг по другу. */
const EMB_SH=[
  {id:'circle', name:'Круг',     d:'<circle cx="12" cy="12" r="11.2"/>', cy:12, k:0.96},
  {id:'shield', name:'Щит',      d:'<path d="M2.6 1.8h18.8v8.6c0 6-4.2 9.8-9.4 12C6.8 20.2 2.6 16.4 2.6 10.4z"/>', cy:10.9, k:0.9},
  {id:'square', name:'Квадрат',  d:'<rect x="1.4" y="1.4" width="21.2" height="21.2"/>', cy:12, k:1.0},
  {id:'diamond',name:'Ромб',     d:'<path d="M12 .6 23.4 12 12 23.4.6 12z"/>', cy:12, k:0.76},
  {id:'hex',    name:'Шестигранник', d:'<path d="M12 .6l9.9 5.7v11.4L12 23.4l-9.9-5.7V6.3z"/>', cy:12, k:0.9},
  {id:'banner', name:'Стяг',     d:'<path d="M2.4 1.2h19.2v21.6L12 17.4l-9.6 5.4z"/>', cy:9.6, k:0.86},
];
const EMB_C2=[
  {id:'paper',name:'Белый',  c:'#FBF9F3'},
  {id:'gold', name:'Золото', c:'#E2C36B'},
  {id:'ink',  name:'Чёрный', c:'#14130F'},
];
const EMB_RIM=[{id:'none',name:'Без каймы'},{id:'ring',name:'Кайма'},{id:'double',name:'Двойная'}];
const EMB_COLORS=['#9A7211','#94271F','#28496F','#17706B','#4E6B22','#5C3A6E','#2E2B26','#B0552A'];
/* знаки нарисованы в квадрате ±7 вокруг нуля */
const EMB_SY=(()=>{
  const poly=(pts)=>'M'+pts.map(p=>p[0].toFixed(2)+' '+p[1].toFixed(2)).join('L')+'Z';
  const star=(n,ro,ri,rot)=>{ const pts=[]; for(let i=0;i<n*2;i++){ const a=(rot+i*180/n)*Math.PI/180, r=i%2?ri:ro;
    pts.push([Math.cos(a)*r,Math.sin(a)*r]); } return poly(pts); };
  const gear=(()=>{ const pts=[]; for(let k=0;k<8;k++){ const b=k*45;
    [[b-15,5.2],[b-8,7.1],[b+8,7.1],[b+15,5.2]].forEach(([a,r])=>{ const t=a*Math.PI/180; pts.push([Math.cos(t)*r,Math.sin(t)*r]); }); }
    return poly(pts)+'M2.5 0A2.5 2.5 0 1 0-2.5 0A2.5 2.5 0 1 0 2.5 0Z'; })();
  const rays=(()=>{ let d=''; for(let i=0;i<5;i++){ const a=Math.PI*(1-i/4), c=Math.cos(a), s=-Math.sin(a);
    const w=0.55, x0=c*5.4, y0=s*5.4+2.6, x1=c*7.3, y1=s*7.3+2.6, nx=-s*w, ny=c*w;
    d+=poly([[x0+nx,y0+ny],[x1+nx,y1+ny],[x1-nx,y1-ny],[x0-nx,y0-ny]]); } return d; })();
  const grain=(x,y,r)=>`<ellipse cx="${x}" cy="${y}" rx="1.25" ry="2.3" transform="rotate(${r} ${x} ${y})"/>`;
  return [
    {id:'star',    name:'Звезда',      g:`<path d="${star(5,7.4,3,-90)}"/>`},
    {id:'compass', name:'Роза ветров', g:`<path d="${star(4,7.4,1.9,-90)}"/><path d="${star(4,4.2,1.2,-45)}" opacity=".7"/>`},
    {id:'dawn',    name:'Рассвет',     g:`<path d="M-4.4 2.6A4.4 4.4 0 0 1 4.4 2.6Z"/><path d="${rays}"/><path d="M-7.2 3.7h14.4v1.4h-14.4z"/>`},
    {id:'gear',    name:'Шестерня',    g:`<path fill-rule="evenodd" d="${gear}"/>`},
    {id:'wheat',   name:'Колос',       g:`<path d="M-.55-5h1.1v12h-1.1z"/>${grain(-1.5,-3.4,-32)}${grain(1.5,-3.4,32)}${grain(-1.5,-.3,-32)}${grain(1.5,-.3,32)}${grain(-1.5,2.8,-32)}${grain(1.5,2.8,32)}${grain(0,-6.2,0)}`},
    {id:'oak',     name:'Дуб',         g:`<circle cx="-2.7" cy="-1.4" r="3.4"/><circle cx="2.7" cy="-1.4" r="3.4"/><circle cx="0" cy="-4" r="3.6"/><path d="M-1 0h2v7h-2z"/><path d="M-4 6.2h8v1.1h-8z"/>`},
    {id:'torch',   name:'Факел',       g:`<path d="M0-7.4C3.4-4.2 3.4-1.6 1.7.4C1.5-.9.9-1.7 0-2.2C-.5-1.2-1.9-.5-1.7.4C-3.5-1.6-3-4.4 0-7.4Z"/><path d="M-3.2 1.2h6.4l-1.3 2.3h-3.8z"/><path d="M-.9 3.3h1.8v4h-1.8z"/>`},
    {id:'orb',     name:'Держава',     g:`<path fill-rule="evenodd" d="M4.8 2A4.8 4.8 0 1 1-4.8 2A4.8 4.8 0 1 1 4.8 2ZM-4.8 1.3h9.6v1.2h-9.6z"/><path d="M-.7-7.4h1.4v4.8h-1.4z"/><path d="M-2.1-6.1h4.2v1.3h-4.2z"/>`},
    {id:'tower',   name:'Башня',       g:`<path fill-rule="evenodd" d="M-4.4-3.4h8.8V7.2h-8.8zM-1.3 7.2V4.6a1.3 1.3 0 0 1 2.6 0v2.6z"/><path d="M-4.4-6.6h2v3.4h-2zM-1 -6.6h2v3.4h-2zM2.4-6.6h2v3.4h-2z"/>`},
    {id:'book',    name:'Книга',       g:`<path d="M-.5-3.9C-2.2-5.5-4.9-5.8-7.2-4.8V5.4C-4.9 4.4-2.2 4.7-.5 6.2Z"/><path d="M.5-3.9C2.2-5.5 4.9-5.8 7.2-4.8V5.4C4.9 4.4 2.2 4.7.5 6.2Z"/>`},
    {id:'anchor',  name:'Якорь',       g:`<g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="0" cy="-5.3" r="1.5"/><path d="M0-3.8V6.6"/><path d="M-3.2-1.8h6.4"/><path d="M-5.6 2.4A5.8 5.8 0 0 0 5.6 2.4"/></g>`},
    {id:'peaks',   name:'Горы',        g:`<path d="M-7.6 5.6-2.4-3.8.5 1.2 2.7-2.2 7.6 5.6Z"/>`},
    {id:'wave',    name:'Волна',       g:`<g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M-7-2q1.75-2.4 3.5 0t3.5 0 3.5 0 3.5 0"/><path d="M-7 2.6q1.75-2.4 3.5 0t3.5 0 3.5 0 3.5 0"/></g>`},
  ];
})();
/* эмблема по умолчанию для партии, у которой её ещё нет */
function embFor(p){
  if(p.emb)return p.emb;
  const ai=AIPARTIES.find(x=>x.id===p.id); if(ai&&ai.emb)return ai.emb;
  const h=[...String(p.name||p.id)].reduce((a,c)=>(a*31+c.charCodeAt(0))>>>0,7);
  // сдвиг беззнаковый: знаковый на больших хешах даёт отрицательный индекс;
  // знак берём первый свободный от соперников, чтобы не повторить чужую эмблему
  const taken=AIPARTIES.map(x=>x.emb&&x.emb.sy);
  let k=(h>>>3)%EMB_SY.length;
  for(let i=0;i<EMB_SY.length&&taken.indexOf(EMB_SY[k].id)>=0;i++)k=(k+1)%EMB_SY.length;
  return {sh:EMB_SH[h%EMB_SH.length].id, sy:EMB_SY[k].id, c2:'paper', rim:'ring'};
}
function emblem(p,size,e){
  e=e||embFor(p);
  const s=size||24, sh=EMB_SH.find(x=>x.id===e.sh)||EMB_SH[0];
  const sy=EMB_SY.find(x=>x.id===e.sy);
  const c2=(EMB_C2.find(x=>x.id===e.c2)||EMB_C2[0]).c;
  const small=s<17, rim=small?'none':(e.rim||'none');
  const k=sh.k*(rim==='none'?1:0.8)*(small?1.06:1);
  const inset=(f,w)=>`<g transform="translate(12 12) scale(${f}) translate(-12 -12)" fill="none" stroke="${c2}" stroke-width="${(w/f).toFixed(2)}">${sh.d}</g>`;
  const rims=rim==='ring'?inset(0.84,0.9):rim==='double'?inset(0.86,0.7)+inset(0.76,0.7):'';
  return `<svg class="emb" viewBox="0 0 24 24" width="${s}" height="${s}" aria-hidden="true">`+
    `<g fill="${p.color||'#807B70'}">${sh.d}</g>${rims}`+
    (sy?`<g transform="translate(12 ${sh.cy}) scale(${k.toFixed(3)})" fill="${c2}" color="${c2}">${sy.g}</g>`:'')+
    `</svg>`;
}
/* ─── конструктор эмблемы ─────────────────────────────────────────
   Перед присягой и потом в разделе партии. Живой образец крупно,
   под ним четыре ряда решений и соперники — чтобы не нарисовать
   чужую эмблему своими руками. */
function embRandom(){
  return {sh:pick(EMB_SH).id, sy:pick(EMB_SY).id, c2:pick(EMB_C2).id, rim:pick(EMB_RIM).id};
}
function embKit(base,rivals){
  const e=base.emb||(base.emb=embFor(base));
  const P0={color:base.color,short:base.short};
  const btn=(key,val,inner,label,on)=>`<button class="ek${on?' on':''}" data-k="${key}" data-v="${val}" title="${label}">${inner}</button>`;
  const row=(t,items)=>`<div class="ek-row"><i>${t}</i><div>${items}</div></div>`;
  return `<div class="ek-kit">
    <div class="ek-prev">${emblem(P0,112,e)}
      <b>${base.name||'Новая партия'}</b><span>${base.short||''}</span></div>
    <div class="ek-opts">
      ${row('Форма',EMB_SH.map(s=>btn('sh',s.id,emblem(P0,28,{...e,sh:s.id,sy:null,rim:'none'}),s.name,e.sh===s.id)).join(''))}
      ${row('Знак',EMB_SY.map(s=>btn('sy',s.id,emblem(P0,28,{...e,sy:s.id,rim:'none'}),s.name,e.sy===s.id)).join(''))}
      ${row('Цвет поля',EMB_COLORS.map(c=>btn('color',c,`<s style="background:${c}"></s>`,c,base.color===c)).join(''))}
      ${row('Цвет знака',EMB_C2.map(c=>btn('c2',c.id,emblem(P0,28,{...e,c2:c.id,rim:'none'}),c.name,e.c2===c.id)).join(''))}
      ${row('Кайма',EMB_RIM.map(r=>btn('rim',r.id,emblem(P0,28,{...e,rim:r.id,sy:null}),r.name,e.rim===r.id)).join(''))}
      <div class="ek-row"><i></i><div><button class="btn sm" data-k="rnd" data-v="1">Случайная эмблема</button></div></div>
    </div>
    ${rivals&&rivals.length?`<div class="ek-riv"><i>Соперники</i>${rivals.map(p=>
      `<span>${emblem(p,34)}<u>${p.short}</u></span>`).join('')}</div>`:''}
  </div>`;
}
function embBind(base,rivals){
  const box=document.getElementById('ek');
  if(!box)return;
  box.innerHTML=embKit(base,rivals);
  box.querySelectorAll('[data-k]').forEach(b=>b.onclick=()=>{
    const k=b.dataset.k, v=b.dataset.v;
    if(k==='rnd'){ base.emb=embRandom(); base.color=pick(EMB_COLORS); }
    else if(k==='color')base.color=v;
    else base.emb={...base.emb,[k]:v};
    embBind(base,rivals);
  });
}
/* правка эмблемы действующей партии: бесплатно, но видно всем */
function askEmblem(){
  const p=me(), draft={name:p.name,short:p.short,color:p.color,emb:{...embFor(p)}};
  const rivals=S.parties.filter(x=>x.id!==PL);
  sheetOpen({eye:'Партия · эмблема',title:'Эмблема «'+p.name+'»',
    body:`<div id="ek"></div><p class="hint">Цвет поля — это и цвет фракции на полукруге и во всех таблицах.</p>`,
    acts:[{label:'Сохранить',fn(){ p.emb=draft.emb; p.color=draft.color;
        logMsg('«'+p.name+'» сменила эмблему.'); render(); }},
      {label:'Оставить как было'}],
    after(){ embBind(draft,rivals); }});
}

function est(v,exact){ return exact?v:`<span class="est" title="оценка без свежего опроса">${v}</span>`; }
function stanceLine(b){
  const t=T(b.topic);
  const word=b.stance===0?'без изменений':(b.stance<0?t.l:t.r)+(Math.abs(b.stance)>1?', решительно':', умеренно');
  return t.name+' — '+word+(b.riders.length?'. Поправки: '+b.riders.map(r=>RIDERS.find(x=>x.id===r).name.toLowerCase()).join(', '):'');
}
function moodWord(v){ return v>=66?'опора':v>=56?'скорее за':v>=46?'колеблется':v>=34?'скорее против':'враждебна'; }
function unrestWord(v){ return v<12?'спокойно':v<24?'ропот':v<38?'тревожно':v<55?'митинги':'на грани'; }
function partyRow(p){ return chip(p)+' '+p.name; }
/* склонение: 21 мандат, 22 мандата, 25 мандатов */
function plural(n,one,few,many){
  const a=Math.abs(n)%100, b=a%10;
  return n+' '+(a>10&&a<20?many:b===1?one:b>1&&b<5?few:many);
}
const mandates=n=>plural(n,'мандат','мандата','мандатов');
const posts=n=>plural(n,'портфель','портфеля','портфелей');
const quarters=n=>plural(n,'квартал','квартала','кварталов');

/* ─── шапка и меню ───────────────────────────────────────────── */
/* Разделы сгруппированы: их семнадцать, и без рубрик указатель
   превращается в список. Группа — это ответ на «где я сейчас». */
const TABS=[
  {id:'brief',  name:'Кабинет',      grp:'Вы', n:()=>S.ap+'/'+AP_MAX, dot:()=>!!S.ap&&S.q<=2},
  {id:'self',   name:'Мой политик',  short:'Досье', n:()=>Math.round(ageOf())},
  {id:'party',  name:'Партия',       n:()=>seatsOf(PL), dot:()=>!!S.challenge},
  {id:'parl',   name:'Собрание',     grp:'Палаты', n:()=>seatsOf(PL)+'/'+SEATS},
  {id:'senate', name:'Сенат',        n:()=>senSeatsOf(PL)+'/'+SEN_SEATS},
  {id:'fac',    name:'Фракции',      n:()=>dealsLive().length||'', dot:()=>(S.deals||[]).some(d=>d.iou&&!d.iou.done&&!d.iou.broken&&d.iou.due-S.q<=1)},
  {id:'bill',   name:'Законы',       n:()=>S.laws.length, dot:()=>!!S.bill||!!S.vetoed},
  {id:'budget', name:'Бюджет',       n:()=>sign(Math.round(balance()))},
  {id:'pm',     name:'Премьер-министр',short:'Премьер', grp:'Власть', n:()=>Math.round(cabinetPower()*100),
   dot:()=>isPM()&&POSTS.some(x=>S.q-minOf(x.id).since>MIN_TERM)},
  {id:'gov',    name:'Правительство',short:'Кабинет', n:()=>coalSeats(), dot:()=>isPM()&&coalSeats()<MAJ},
  {id:'pres',   name:'Президент',    n:()=>presLeft(), dot:()=>!!S.vetoed},
  {id:'court',  name:'Суд и надзор',  short:'Суд', n:()=>Math.round(trail()),
   dot:()=>!!S.probe},
  {id:'const',  name:'Конституция',    n:()=>legit(), dot:()=>legit()<LEGIT_LOW},
  {id:'country',name:'Регионы',      grp:'Страна', n:()=>Math.round(avgUnrest())},
  {id:'society',name:'Общество',     n:()=>Math.round(approval())+'%'},
  {id:'press',  name:'Печать',       n:()=>sign(Math.round(pressTone())), dot:()=>pressTone()<-14},
  {id:'firms',  name:'Бизнес',       n:()=>captureLevel(), dot:()=>captureLevel()>CAP_HIGH},
  {id:'world',  name:'Соседи',       n:()=>Math.round(nbTrade())},
  {id:'camp',   name:'Кампания',     n:()=>Math.round(S.funds), only:()=>!!S.camp},
  {id:'arch',   name:'Летопись',     grp:'Прочее', n:()=>S.chron.length},
  {id:'hist',   name:'Правители',     n:()=>rulers().pres.length},
  {id:'help',   name:'Справка',      n:()=>''},
];
function renderStrip(){
  const ap=approval(), bal=balance();
  const cells=[
    ['квартал',dateLabel()+' · '+(S.q-S.termStart+1)+'/'+aTerm(),''],
    ['действия','',S.ap?'act':'warn'],
    ['одобрение',Math.round(shown(ap,'nat'))+'%',ap<35?'bad':ap>55?'good':''],
    ['мандаты',seatsOf(PL)+' · коалиция '+coalSeats(),coalSeats()>=MAJ?'good':'warn'],
    ['казна',Math.round(S.treasury)+' млрд',S.treasury<25?'bad':''],
    ['баланс',sign(Math.round(bal)),bal<0?'bad':'good'],
    ['вес',Math.round(S.cap),S.cap<15?'warn':''],
    ...(chief()?[]:[['влияние',Math.round(S.you.inf)+' / '+CONGRESS_INF,S.you.inf>=CONGRESS_INF?'good':'']]),
    ['касса',Math.round(S.funds)+' млн',''],
  ];
  document.getElementById('strip').innerHTML=cells.map(c=>c[0]==='действия'
    ? `<button class="sv act apcell" id="apbtn" title="Ход квартала: на что ушли действия и что делать дальше"><i>действия</i><b>${apPips()} ${S.ap} из ${AP_MAX}</b></button>`
    : `<div class="sv ${c[2]==='act'?'act':''}"><i>${c[0]}</i><b class="${c[2]==='act'?'':c[2]}">${c[1]}</b></div>`).join('');
  const apb=document.getElementById('apbtn'); if(apb)apb.onclick=askPlan;
  document.getElementById('subtitle').textContent =
    seatTitle().toLowerCase()+' · '+me().name;
}
const NAV_MAIN=['brief','parl','senate','bill'];
const isNarrow=()=>window.matchMedia('(max-width:900px)').matches;
function navItems(){ return TABS.filter(t=>!t.only||t.only()); }
function navBtn(t,i){
  return `<button class="nav ${S.tab===t.id?'on':''}" data-t="${t.id}" title="${t.name}${
    i!==undefined?' · клавиша '+(i+1):''}">${icon(t.id)}<span>${(i===undefined||t.name.length>13)&&t.short?t.short:t.name}</span>${
    t.dot&&t.dot()?'<span class="dot"></span>':''}<u>${t.n()}</u></button>`;
}
function renderNav(){
  const items=navItems(), side=document.getElementById('side');
  if(isNarrow()){
    const shown=items.filter(t=>NAV_MAIN.indexOf(t.id)>=0||t.id===S.tab).slice(0,4);
    side.innerHTML=shown.map(t=>navBtn(t)).join('')+
      `<button class="nav" data-more="1">${icon('more')}<span>Ещё</span></button>`;
  } else {
    let out='';
    items.forEach((t,i)=>{ if(t.grp)out+='<div class="navsec">'+t.grp+'</div>'; out+=navBtn(t,i); });
    side.innerHTML=out+
      `<div class="navkeys"><b>1</b>—<b>${Math.min(9,items.length)}</b> разделы · <b>←</b> <b>→</b> листать · <b>Q</b> завершить квартал</div>`;
  }
  side.querySelectorAll('[data-t]').forEach(b=>b.onclick=()=>goTab(b.dataset.t));
  const m=side.querySelector('[data-more]'); if(m)m.onclick=openSections;
}
function goTab(id){ S.tab=id; S.shown=24; window.scrollTo(0,0); render(); }
function setFilter(id){ S.filter=id; S.shown=24; render(); }
function openSections(){
  sheetOpen({eye:'Навигация',title:'Разделы',
    opts:navItems().map(t=>({label:icon(t.id)+t.name,hint:t.n()?'счётчик: '+t.n():'',fn:()=>goTab(t.id)}))});
}
/* клавиатура: цифры — разделы, стрелки — соседний, Q — конец квартала */
document.addEventListener('keydown',e=>{
  if(!S||mopen||e.metaKey||e.ctrlKey||e.altKey)return;
  const tag=(e.target&&e.target.tagName||'').toLowerCase();
  if(tag==='input'||tag==='select'||tag==='textarea')return;
  const items=navItems(), cur=items.findIndex(t=>t.id===S.tab);
  if(/^Digit[1-9]$/.test(e.code)){ const t=items[+e.code.slice(5)-1]; if(t){goTab(t.id);e.preventDefault();} return; }
  if(e.code==='ArrowRight'||e.code==='BracketRight'){ goTab(items[(cur+1)%items.length].id); e.preventDefault(); return; }
  if(e.code==='ArrowLeft'||e.code==='BracketLeft'){ goTab(items[(cur-1+items.length)%items.length].id); e.preventDefault(); return; }
  if(e.code==='KeyQ'&&!S.over){ askEndQuarter(); e.preventDefault(); }
});
addEventListener('resize',()=>{ if(S)renderNav(); });
function render(){
  if(!S)return;
  S.tutSaw=S.tutSaw||{}; S.tutSaw[S.tab]=true;         // курс отмечает открытые разделы
  renderStrip(); renderNav();
  const f=({brief:tabBrief,self:tabSelf,party:tabParty,parl:tabParl,senate:tabSenate,bill:tabBill,
            budget:tabBudget,pm:tabPM,gov:tabGov,pres:tabPres,court:tabCourt,country:tabCountry,
            society:tabSociety,press:tabPress,world:tabWorld,camp:tabCamp,firms:tabFirms,
            const:tabConst,hist:tabHist,fac:tabFac,
            arch:tabArch,help:tabHelp})[S.tab]||tabBrief;
  document.getElementById('view').innerHTML=f();
  bindActions();
}
function bindActions(){
  document.querySelectorAll('[data-act]').forEach(b=>b.onclick=()=>{
    const fn=ACT[b.dataset.act]; if(fn){fn(b.dataset.arg);render();} });
  document.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>{
    S.tab=b.dataset.go; window.scrollTo(0,0); render(); });
  const e=document.getElementById('endq'); if(e)e.onclick=()=>askEndQuarter();
  const hq=document.getElementById('helpq');
  if(hq){ hq.oninput=()=>{ HELPQ=hq.value; const pos=hq.selectionStart; render();
    const h2=document.getElementById('helpq'); if(h2){ h2.focus(); try{ h2.setSelectionRange(pos,pos); }catch(e){} } }; }
}

/* ─── ваш ход ─────────────────────────────────────────────────────
   Главный вопрос новичка — «что мне делать». Ответ в трёх частях:
   сколько ходов осталось и на что ушли прошлые; что стоит сделать
   сейчас, с кнопкой прямо туда; и когда закрывать квартал. */
const prefOn=k=>{ try{ return localStorage.getItem('nov.'+k)!=='0'; }catch(e){ return true; } };
const prefSet=(k,v)=>{ try{ localStorage.setItem('nov.'+k,v?'1':'0'); }catch(e){} };
function apPips(){
  let h='<span class="pips">';
  for(let i=0;i<AP_MAX;i++)h+=`<s class="${i<S.ap?'on':''}"></s>`;
  return h+'</span>';
}
/* три ячейки квартала: что уже сделано и сколько свободно */
function apSlots(){
  const done=apSpent().slice(-(AP_MAX-S.ap));
  let h='<div class="apslots">';
  for(let i=0;i<AP_MAX;i++){
    const d=done[i];
    h+=d?`<div class="done"><u>${i+1}</u><b>${d.t}</b><i>сделано</i></div>`
        :`<div><u>${i+1}</u><b>свободно</b><i>${i===AP_MAX-S.ap?'следующий ход':'в запасе'}</i></div>`;
  }
  return h+'</div>';
}
/* что стоит сделать сейчас: до трёх советов, каждый с кнопкой туда */
function nextSteps(){
  const out=[], add=(t,why,label,js,go)=>{ if(out.length<4)out.push({t,why,label,js,go}); };
  const m=S.motion, cr=S.crisis, imp=S.imp;
  if(S.bcrisis&&fpCan())add(S.bcrisis.stage===2?'Кризис на границе':'Инцидент на границе','«'+NB_(S.bcrisis.nb).name+'» у '+R(S.bcrisis.rid).cap+'. Край горячеет, внешний спрос проседает.','Решать','askCrisis()');
  const snc=NEIGHBOURS.find(x=>sancOn(x.id));
  if(snc&&fpCan())add('Санкции «'+snc.short+'»','«'+snc.name+'» держит санкции до '+dateLabel(nbOf(snc.id).sanc.until)+'. Уступка, обход или визит поднимут отношения.','Соседи','',"world");
  if(S.rref&&centralPower())add('Референдум в крае',R(S.rref.rid).name+' голосует '+RREF_NAME[S.rref.kind]+' — '+dateLabel(S.rref.due)+'. Прогноз «за» '+Math.round(rrefYes()*100)+'%.',
    'Решить','askRref()');
  const sovR=REGIONS.find(r=>regSov(r.id));
  if(sovR&&centralPower())add('Край объявил суверенитет',sovR.name+' не платит налоги в центр. Каждый квартал без решения стоит легитимности.','Решить',"askSov('"+sovR.id+"')");
  if(blocOn())add('Расколите блок','Против кабинета голосуют вместе '+S.bloc.members.map(id=>P(id).short).join(', ')+' — '+blocSeats()+' мандатов. Сделка с одной из фракций может его расколоть.','Фракции','',"fac");
  const sc=scMine().find(x=>!x.resp||x.heat>=60);
  if(sc)add('Ответьте на скандал','«'+sc.title+'»: температура '+Math.round(sc.heat)+'. Молчание дешевле всего, но горит дольше.','Ответить','askScandal('+sc.id+')');
  const da=deskAdvice(); if(da)add(da[0],da[1],da[2],da[3]);
  if(cr&&cr.form===PL)add('Соберите большинство','Поручение сформировать правительство у вас, раунд '+cr.round+' из 2. Не соберёте до конца квартала — поручение уйдёт другому.',
    'Переговоры','askFormation()');
  if(m&&m.against===PL)add('Отбейте вотум недоверия','Оппозиция внесла вотум, голосование '+(m.due>S.q?'в конце квартала':'сейчас')+'. Прогноз за отставку: '+motionForecast().yes+' из '+MAJ+'.',
    'К вотуму','askMotion()');
  if(m&&m.by===PL)add('Доведите вотум','Ваш вотум внесён: за отставку сейчас '+motionForecast().yes+' из '+MAJ+'. Поработайте с фракциями или ставьте на голосование.',
    'К вотуму','askMotion()');
  if(imp&&imp.stage&&imp.stage!=='done')add(imp.kind==='you'?'Защищайтесь от импичмента':'Ведите импичмент',
    impStageWord(imp)+'.','К импичменту','askImpeachStage()');
  if(isPM()){
    const shaky=coalition().filter(id=>id!==PL&&(S.partners[id]||{}).anger>=3);
    if(shaky.length)add('Удержите партнёра','«'+P(shaky[0]).name+'» на грани выхода из коалиции. Уступка или встреча с лидером снимут напряжение.',
      'Коалиция','askCoalition()');
    const hung=budgetDue()&&!S.budget.submitted?coalition().filter(id=>id!==PL&&!bAskMet(bAsk(id))):[];
    if(hung.length)add('Впишите строку партнёра','«'+P(hung[0]).name+'» ждёт в бюджете: '+bAskName(bAsk(hung[0]))+'. Без строки партнёр голосует хуже и обидится.',
      'Бюджет','',"budget");
    if(coalSeats()<MAJ&&!cr)add('Расширьте коалицию','Правительство меньшинства: '+coalSeats()+' из '+MAJ+'. Без союзника любой вотум может стать последним.',
      'Позвать фракцию','askCoalition()');
  }
  if(S.vetoed)add('Преодолейте вето','Закон вернулся от президента. Нужно '+superN()+' голосов Собрания.','К закону','',"bill");
  if(S.bill){
    const tl=tally(S.bill);
    if(tl.und&&tl.yes<MAJ)add('Обработайте колеблющихся','По проекту «'+T(S.bill.topic).name+'» колеблются '+tl.und+', а до '+MAJ+' не хватает '+(MAJ-tl.yes)+'.',
      'Работать','ACT.whip();render()');
    else add('Внесите проект','«'+T(S.bill.topic).name+'» готов: прогноз '+tl.yes+' из '+MAJ+'.','К проекту','',"bill");
  } else if(canBill())add('Подготовьте закон','Закон — главный способ менять страну. Выберите направление и тему, позицию подберите так, чтобы прошла.',
    'Законы','',"bill");
  if(!isPM()&&budgetDue()&&bReqOpen()&&S.ap)add('Потребуйте строку бюджета','Кабинет готовит бюджет на '+budgetYear()+' год. Голоса «'+me().short+'» можно обменять на статью для ваших избирателей.',
    'Строка','askBudgetLine()');
  if(!isPM()&&!m&&noconfKind()!=='none'&&!(S.noConfCool>0)&&coalSeats()<MAJ+25)
    add('Раскачайте кабинет','Правительство держится на '+coalSeats()+' голосах из '+MAJ+'. Раскол коалиции или вотум недоверия могут его уронить.',
      'Собрание','',"parl");
  const ordered=GROUPS.slice().sort((x,y)=>S.mood[x.id]-S.mood[y.id]);
  const INS={work:'рабочими',agro:'селом',urban:'горожанами',biz:'предпринимателями',patr:'патриотами',
    intel:'интеллигенцией',youth:'молодёжью',pens:'пенсионерами'};
  if(S.mood[ordered[0].id]<38)add('Поговорите с '+(INS[ordered[0].id]||ordered[0].name.toLowerCase()),
    'Настроение группы '+Math.round(S.mood[ordered[0].id])+' — хуже всех. Обращение поднимет его, но заденет её противников.',
    'Обращение','askGroup()');
  const hot=REGIONS.slice().sort((a,b)=>S.unrest[b.id]-S.unrest[a.id])[0];
  if(S.unrest[hot.id]>36)add('Съездите в '+hot.cap,hot.name+': напряжённость '+Math.round(S.unrest[hot.id])+'. Поездка сбивает её и поднимает поддержку.',
    'Поездка','askRegion()');
  add('Поработайте с депутатами','Отношение депутата к вам решает спорные голосования. Начните с тех, кто относится хуже всех.',
    'Собрание','',"parl");
  return out.slice(0,3);
}
let STEPS=[];
function stepsHtml(){
  STEPS=nextSteps();
  return STEPS.map((x,i)=>`<div class="todo-i"><u>${i+1}</u><div><b>${x.t}</b><span>${x.why}</span></div>
    <button class="btn sm" onclick="stepRun(${i})">${x.label}</button></div>`).join('');
}
/* совет выполняется одинаково из «Кабинета» и из листа: сначала лист
   закрывается, потом открывается то, куда ведёт совет */
function stepRun(i){
  const x=STEPS[i]; if(!x)return;
  if(mopen){ const m=document.getElementById('modal'); m.classList.remove('show'); mopen=false; mq.length=0; }
  if(x.go){ goTab(x.go); return; }
  (new Function(x.js))();
}
function turnPanel(){
  const left=S.ap;
  return panel({cls:'lead-p turn',title:'Ваш ход · '+dateLabel(),
    meta:left?'осталось '+plural(left,'действие','действия','действий')+' из '+AP_MAX:'действия кончились',
    body:`${apSlots()}
      <p class="hint" style="margin:8px 0 0">${left
        ?'Действие — любая кнопка, которая тратит ход: закон, поездка, депутат, вотум. Вес, казна и касса тратятся вместе с ним и копятся, а действия — нет: три на квартал.'
        :'Все три хода сделаны. Закройте квартал: страна проживёт три месяца, и вы увидите последствия.'}</p>
      <h3 class="sub">Что сделать сейчас</h3>
      <div class="todo">${stepsHtml()}</div>`,
    foot:`<button class="btn ${left?'':'pri'}" onclick="askEndQuarter()" ${S.over?'disabled':''}>Завершить квартал${
        left?`<span class="cost">сгорит ${left}</span>`:''}</button>
      <span class="hint">клавиша Q</span>`});
}
/* обучение первых кварталов: три шага, каждый отмечается сам */
/* Курс молодого политика: уроки по системам, каждый отмечается сам —
   когда вы действительно это сделали или открыли нужный раздел.
   Состав зависит от кресла: министру не нужен урок о законопроекте,
   премьеру — урок о столе кресла. */
const COURSE=[
  {id:'ap',   t:'Три действия', why:'Квартал — это три хода. Любая кнопка с пометкой «ход» тратит один. Вес, казна и касса копятся, ходы — нет.',
   how:'Потратьте три действия. Что сделать — подсказывает панель «Ваш ход».', done:()=>apSpent().length>=AP_MAX||S.q>1, go:'askPlan()'},
  {id:'desk', t:'Ваш стол', when:()=>!(chief()&&['pm','lead'].indexOf(mySeat())>=0),
   why:'У кресла свои рычаги и своя цифра, по которой вас судят. Министра — по цифре ведомства, губернатора — по краю.',
   how:'Нажмите любой рычаг в панели «Ваше кресло».', done:()=>!!S.deskUsed, go:"goTab('brief')"},
  {id:'bill', t:'Закон', when:()=>canBill(),
   why:'Закон идёт через комитет, зал Собрания, Сенат и подпись президента. Позиция от −2 до +2: чем резче, тем сильнее и тем меньше сторонников.',
   how:'Раздел «Законы»: направление, тема, позиция — и внести.', done:()=>S.votes.length>0||S.laws.some(l=>l.by===PL), go:"goTab('bill')"},
  {id:'end',  t:'Конец квартала', why:'Страна проживает три месяца: экономика, настроения, события. Несгоревших ходов не бывает — они просто пропадают.',
   how:'Кнопка «Завершить квартал» или клавиша Q.', done:()=>S.q>1, go:'askEndQuarter()'},
  {id:'parl', t:'Зал и комитеты', why:'Комитет голосует первым: его «за» добавляет голоса в зале, его «против» отнимает, а чужой председатель может положить проект под сукно.',
   how:'Откройте «Собрание» и посмотрите пульт, полукруг и комитеты.', done:()=>!!(S.tutSaw&&S.tutSaw.parl), go:"goTab('parl')"},
  {id:'deal', t:'Сделка с лидером фракции', why:'У каждой фракции два лидера — в Собрании и в Сенате. За плату — портфель, комитет, деньги краю, ответный закон — лидер ведёт фракцию за вами по одному предмету.',
   how:'Вкладка «Фракции»: «Переговоры», предмет, плата. Раунд переговоров — один ход на квартал.', done:()=>(S.deals||[]).length>0, go:"goTab('fac')"},
  {id:'sen',  t:'Сенат и клотур', why:()=>'В Сенате меньшинство тянет прения: пока за их прекращение нет '+cloture()+' голосов, закон не голосуют по существу.',
   how:'Откройте «Сенат»: лидеры сенаторов и повестка палаты.', done:()=>!!(S.tutSaw&&S.tutSaw.senate), go:"goTab('senate')"},
  {id:'press',t:'Печать и скандалы', why:'Скандал горит кварталами и каждый квартал отнимает одобрение. Отрицать дёшево, пока документов мало; извинение и отставка помощника остужают быстрее.',
   how:'Откройте «Печать»: скандалы, первая полоса, издания и их владельцы.', done:()=>!!(S.tutSaw&&S.tutSaw.press), go:"goTab('press')"},
  {id:'biz',  t:'Капитал', why:'Деловой климат двигает инвестиции. Довольный капитал открывает заводы в краях, обиженный — сокращает людей и выводит деньги.',
   how:'Откройте «Бизнес»: климат и то, что делают корпорации.', done:()=>!!(S.tutSaw&&S.tutSaw.firms), go:"goTab('firms')"},
  {id:'party',t:'Влияние и съезд', when:()=>!chief(),
   why:'Партию ведёте не вы. Влияние решает номер в списке, пойдёт ли фракция за вашим законом и выиграете ли вы съезд.',
   how:'Откройте «Партию»: руководство, влияние и шанс на съезде.', done:()=>!!(S.tutSaw&&S.tutSaw.party), go:"goTab('party')"},
  {id:'race', t:'Выборный календарь', why:'Выборы идут по своим часам: Сенат третями, края и мэры по срокам, президент раз в шесть лет. Выдвинуться можно самому.',
   how:'Откройте выборный календарь.', done:()=>!!(S.tutSaw&&S.tutSaw.races), go:'askRaces()'},
  {id:'self', t:'Личное дело', why:'Молва по четырём шкалам работает на выборах и в сделках: честному верят в долг, народному прощают больше.',
   how:'Откройте «Мой политик».', done:()=>!!(S.tutSaw&&S.tutSaw.self), go:"goTab('self')"},
];
function courseList(){ return COURSE.filter(x=>!x.when||x.when()); }
function tutCard(){
  if(S.over||(S.tut&&S.tut.off)||S.q>12)return '';
  const L=courseList(), n=L.filter(x=>x.done()).length;
  if(n>=L.length)return '';
  const cur=L.find(x=>!x.done());
  const row=x=>`<li class="${x.done()?'ok':''}${x===cur?' now':''}" onclick="${x.go};render()"><s></s><div><b>${x.t}</b></div></li>`;
  return `<div class="tut course"><div class="tut-h"><b>Курс молодого политика · ${n} из ${L.length}</b>
      <button class="btn sm ghost" onclick="S.tut={off:true};render()">Скрыть курс</button></div>
    <div class="tut-now"><i>Урок ${L.indexOf(cur)+1}</i><b>${cur.t}</b><p>${typeof cur.why==='function'?cur.why():cur.why}</p>
      <div class="tut-do"><span>${cur.how}</span><button class="btn sm pri" onclick="${cur.go};render()">Показать</button></div></div>
    <ol class="all">${L.map(row).join('')}</ol></div>`;
}
/* лист «ход квартала» — из шапки, по щелчку на квадраты действий */
function askPlan(){
  sheetOpen({eye:'Ход квартала · '+dateLabel(),title:S.ap?'Осталось '+plural(S.ap,'действие','действия','действий'):'Действия кончились',
    body:`${apSlots()}<h3 class="sub">Что сделать сейчас</h3><div class="todo">${stepsHtml()}</div>`,
    acts:[{label:'Вернуться к игре'},{label:'Завершить квартал',fn:askEndQuarter}]});
}
/* закрыть квартал с несгоревшими ходами — только после вопроса */
function askEndQuarter(){
  if(S.over)return;
  if(!S.ap||!prefOn('askend')){ endQuarter(); return; }
  sheetOpen({eye:'Конец квартала · '+dateLabel(),title:'Осталось '+plural(S.ap,'действие','действия','действий'),
    body:`<p class="lead">Действия не переносятся: если закрыть квартал сейчас, ${S.ap===1?'оставшееся сгорит':'оставшиеся сгорят'}.
        Вес, казна и касса останутся при вас.</p>
      <h3 class="sub">На что их можно потратить</h3><div class="todo">${stepsHtml()}</div>`,
    opts:[{label:'Закрыть квартал',hint:'ходы сгорят',fn:()=>endQuarter()},
      {label:'Вернуться и доиграть',hint:'остаться в этом квартале',fn(){}},
      {label:'Закрыть и больше не спрашивать',hint:'вернуть вопрос можно в настройках',fn(){ prefSet('askend',false); endQuarter(); }}]});
}

/* ─── ваше кресло ─────────────────────────────────────────────────
   Стол того кресла, в котором вы сидите: чем распоряжаетесь, по какой
   цифре вас судят, рычаги на ход и дорога дальше. У премьера и лидера
   фракции стол — весь «Кабинет», поэтому своей панели у них нет. */
function deskLead(){
  const s=mySeat(), d=desk();
  if(s==='min'){ const p=POSTS.find(x=>x.id===S.you.post)||POSTS[0];
    return 'Ведомство «'+p.name+'»: '+p.eff+'. Премьер '+(S.pm?S.pm.name:'')+' судит вас по одной цифре — '+MIN_DESK[p.id].kpi.toLowerCase()+'.'; }
  if(s==='gov')return R(d.rid).name+', столица — '+R(d.rid).cap+'. У края своя казна: трансферты центра, стройки, законы заксобрания. '+
    (govElected()?'Главу выбирает край.':'Главу назначает кабинет — ссора с центром стоит кресла.');
  if(s==='mayor')return R(d.rid).cap+(R(d.rid).capital?', столица республики':'')+'. Дороги, трубы и дворы ветшают каждый квартал; горожане судят по ним. Срок — до '+shortDate(d.till)+'.';
  if(s==='sen')return 'Сенатор от края '+R(d.rid).name+'. Ваш голос в палате — ваш: за свои законы, против чужих по совести. Прения держат закон кабинета, слушания — министров.';
  if(s==='pres')return 'Законы кабинета ложатся к вам на подпись: подписать или вернуть. Указы и референдум — в «Законах» и «Президенте», роспуск — по конституции.';
  if(s==='vp')return 'Вы ведёте Сенат и разбиваете равенство голосов. Если кресло президента '+(S.pres?S.pres.name+' ':'')+'освободится, оно ваше.';
  if(s==='dep')return chief()?'Мандат у вас есть, кабинета нет.':'Место в рядах фракции «'+me().short+'». Законы можно вносить своей рукой, но номер в списке и слово на съезде решает влияние.';
  if(s==='none')return chief()?'Мандат потерян. Партия ваша, но действовать приходится чужими руками — до довыборов или нового созыва.'
    :'Ни мандата, ни поста — только партийный билет. До выборов '+quarters(Math.max(0,aTerm()-(S.q-S.termStart)))+'; влияние решает номер в списке и исход съезда.';
  return seatName()+'.';
}
function deskPanel(){
  const s=mySeat();
  if(['pm','vice','lead'].indexOf(s)>=0&&chief())return '';
  const d=desk(), acts=deskActs(), kp=deskKpis(), path=deskPath(), role=SR(s)||{};
  const rows=acts.map(a=>{ const why=a.ok?a.ok():true;
    const cost=[a.ap===0?'':'ход',a.cap?capCost(a.cap)+' веса':'',a.gold?a.gold+' млрд':'',a.funds?a.funds+' млн':'',
      a.purse?a.purse+' млрд '+(s==='mayor'?'города':'края'):''].filter(Boolean).join(' · ');
    return `<tr><td><b>${a.name}</b><div class="sub2">${a.txt}${why!==true?' · <span class="warn-t">'+why.toLowerCase()+'</span>':''}</div></td>
      <td class="r" style="width:150px"><button class="btn sm" onclick="deskAct('${a.id}')" ${(a.ap===0||S.ap)&&why===true?'':'disabled'}>${a.pick?'Выбрать':'Сделать'}${cost?`<span class="cost">${cost}</span>`:''}</button></td></tr>`; }).join('');
  return panel({cls:'desk',title:'Ваше кресло · '+seatTitle(),meta:'оценка работы '+Math.round(d.score)+' из 100',
    body:`<div class="desk-h">${icon(role.icon||'self',30)}<p class="lead">${deskLead()}</p></div>
      <div class="levers">${kp.map(x=>`<div class="lever ${x.cls||''}"><i>${x.i}</i><b>${x.v}</b><span>${x.sp}</span></div>`).join('')}</div>
      <h3 class="sub">Рычаги кресла</h3>
      <table><tbody>${rows}</tbody></table>
      ${path.length?`<h3 class="sub">Дорога дальше</h3>
      <div class="rules">${path.map(x=>`<div class="${x.ok===true?'ok':x.ok===false?'no':''}"><s></s><b>${x.t}</b><i>${x.i}</i></div>`).join('')}</div>`:''}`,
    foot:`<button class="btn sm" onclick="askRaces()">Выборный календарь</button>
      <span class="hint">${chief()?'Партию ведёте вы.':'Партию ведёт '+me().leader+' · отношение к вам '+Math.round(S.you.lrel)+' · номер в списке '+listRank()}</span>`});
}
/* руководство партии: кто ведёт и как его сменить */
function leadPanel(){
  if(chief())return '';
  const ok=congressWhy()===true, ch=congressOdds();
  return panel({cls:'warn',title:'Руководство партии',meta:'лидер — '+me().leader,
    body:`<p class="lead">Партию ведёт ${me().leader}: линия, коалиция и программа — его решения. Сменить лидера может только съезд,
        и делегаты смотрят на ваше влияние.</p>
      <div class="levers">
        <div class="lever ${S.you.inf>=CONGRESS_INF?'on':''}"><i>Ваше влияние</i><b>${Math.round(S.you.inf)}</b><span>съезд — с ${CONGRESS_INF}</span></div>
        <div class="lever ${S.you.lrel<35?'bad':''}"><i>Отношение лидера</i><b>${Math.round(S.you.lrel)}</b><span>${S.you.lrel>=60?'доверяет':S.you.lrel>=35?'терпит':'ждёт промаха'}</span></div>
        <div class="lever ${listRank()<=seatsOf(PL)?'on':'warn'}"><i>Номер в списке</i><b>№${listRank()}</b><span>у фракции ${mandates(seatsOf(PL))}</span></div>
        <div class="lever"><i>Шанс на съезде</i><b>${Math.round(ch*100)}%</b><span>${ok?'можно созывать':congressWhy()}</span></div>
      </div>`,
    foot:`<button class="btn pri" onclick="askCongress()" ${ok&&S.ap?'':'disabled'}>Созвать съезд<span class="cost">ход · ${CONGRESS_CAP} веса · ${CONGRESS_FUNDS} млн</span></button>
      <span class="hint">Влияние растёт от работы в партии и кресла, падает от проигранного съезда.</span>`});
}

/* ─── 1 · Кабинет ────────────────────────────────────────────── */
function advice(){
  const ap=approval();
  if(S.over)return['Правление окончено','Летопись открыта, начать заново можно из итогов.'];
  if(S.challenge)return['Вызов лидерству во фракции',
    S.challenge.name+' идёт против вас по оси «'+AXNAME[S.challenge.ax]+'». Уступите крылу или переубедите его поимённо.'];
  const hot=scMine().sort((a,b)=>b.heat-a.heat)[0];
  if(hot&&hot.heat>=40)return['Скандал: '+hot.title,'Температура '+Math.round(hot.heat)+' — каждый квартал он отнимает одобрение и честность. Раздел «Печать».'];
  if(S.probe)return['Дело: '+caseSt(S.probe).name.toLowerCase(),
    'Фигурант — '+caseWho(S.probe)+'. Улики '+caseWord(S.probe.ev)+'. Раздел «Суд и надзор».'];
  if(pressTone()<-16)return['Печать травит',
    'Тон печати '+Math.round(pressTone())+': плохие новости звучат громче хороших. Дайте интервью тому, кто ещё слушает.'];
  if(trail()>62)return['След слишком заметен',
    'Накоплено '+Math.round(trail())+' — '+trailWord()+'. Риск дела '+Math.round(probeRisk()*100)+'% за квартал.'];
  if(S.vetoed)return['Закон вернулся с вето',
    'Президент не подписал «'+T(S.vetoed.bill.topic).name+'». Настоять можно только двумя третями Собрания — '+superN()+' голосами.'];
  if(isPM()&&coalSeats()<MAJ)return['Правительство меньшинства',
    'В коалиции '+coalSeats()+' из '+MAJ+' нужных мандатов. Отдайте портфель фракции или готовьтесь к вотуму.'];
  if(isPM()&&senCoalSeats()<SEN_MAJ)return['Сенат не ваш',
    'У коалиции '+senCoalSeats()+' сенаторов из '+SEN_MAJ+'. Собрание примет закон, а вторая палата его остановит.'];
  if(!isPres()&&presLeft()<=2)return['Скоро президентские выборы',
    (presLeft()?'Через '+quarters(presLeft()):'Уже в этом квартале')+
    ' страна выбирает главу государства. Вето, поручение кабинета и роспуск Собрания — на кону.'];
  if(S.treasury<20&&balance()<0)return['Казна на исходе',
    'Дефицит '+Math.round(balance())+' млрд в квартал. Поднимите ставку, срежьте статью или ждите долга.'];
  if(S.rec>1)return['Рецессия',
    'Второй квартал падения подряд. Инфраструктура и низкий налог на прибыль вытягивают быстрее прочего.'];
  if(S.econ.inf>8)return['Инфляция',
    'Цены растут на '+S.econ.inf+'% — сильнее всего бьёт по пенсионерам и селу. Помогает сокращение дефицита и снижение НДС.'];
  if(S.econ.unemp>11)return['Безработица',
    S.econ.unemp+'% без работы. Рабочие места даёт инфраструктура и рост инвестиций.'];
  if(avgUnrest()>34)return['Регионы кипят',
    'Средняя напряжённость '+Math.round(avgUnrest())+'. Поездки, соцвыплаты и полиция сбивают её по-разному.'];
  if(ap<40)return['Рейтинг у черты',
    'Одобрение '+Math.round(ap)+'%. Посмотрите на вкладке «Общество», какие группы ушли, и работайте адресно.'];
  if(S.camp)return['Идёт кампания','До выборов '+quarters(aTerm()-(S.q-S.termStart))+'. Штаб тратит кассу, а не казну.'];
  if(!S.bill)return['Собрание ждёт',
    'Внесите законопроект: подберите позицию так, чтобы её приняли, но она ещё что-то меняла.'];
  return['Курс держится','Пользуйтесь спокойным кварталом: договаривайтесь с фракциями впрок.'];
}
function tabBrief(){
  const a=advice(), ap=approval(), ordered=GROUPS.slice().sort((x,y)=>S.mood[y.id]-S.mood[x.id]);
  const best=ordered[0], worst=ordered[ordered.length-1];
  // цены показываем те, что реально спишутся: черты характера их меняют
  const acts=[
    ['visit','Поездка в регион','поддержка и спокойствие в одном субъекте'+(visitCost().funds?' · за счёт партии':''),visitCost().label,'askRegion()'],
    ['address','Обращение к нации','плюс одной группе, минус её противникам','6 веса','askGroup()'],
    ['whip','Работа с колеблющимися','разом обработать всех сомневающихся по проекту',capCost(11,'lobby')+' веса',''],
    ['fundraise','Сбор средств','деньги в партийную кассу, интеллигенция морщится','',''],
    ['poll','Заказать социологию','точные цифры вместо оценок','9 млн',''],
  ];
  acts.push(['press','Работа с печатью','интервью, утечка или отлучение издания','','askPress()']);
  if(isPres()||(isPM()&&seatsOf(PL)>=superN()))
    acts.push(['ref','Назначить референдум','вопрос стране мимо палат и мимо подписи',REF_CAP+' веса','askReferendum()']);
  if(isPM())acts.push(['cabinet','Заседание правительства','приоритет кабинета на полгода: министры работают на одну цель','5 веса','askCabinet()']);
  if(!isPM())acts.push(['noconf','Вотум недоверия','подписи, голосование, отставка кабинета',MOT_CAP+' веса','askMotion()']);
  if(!isPM()&&regOn('qtime'))acts.push(['question','Запрос правительству','правительственный час: неудобный вопрос кабинету','4 веса','']);
  const actRows=acts.map(x=>`<tr><td><b>${x[1]}</b><div class="sub2">${x[2]}</div></td>
    <td class="r" style="width:160px">${x[4]
      ? `<button class="btn sm" onclick="${x[4]}" ${S.ap?'':'disabled'}>Выбрать${x[3]?`<span class="cost">${x[3]}</span>`:''}</button>`
      : `<button class="btn sm" data-act="${x[0]}" ${S.ap?'':'disabled'}>Сделать${x[3]?`<span class="cost">${x[3]}</span>`:''}</button>`}</td></tr>`).join('');

  const partners=coalition().filter(x=>x!==PL).map(id=>{
    const st=S.partners[id]||{anger:0};
    return `<div class="dep"><div class="who"><b>${P(id).name}</b><span>${mandates(seatsOf(id))} · ${
      posts(Object.values(S.gov.posts).filter(x=>x===id).length)}</span></div>${
      st.anger>=3?'<span class="tag r">на грани выхода</span>':
      st.anger>=2?'<span class="tag y">недовольны</span>':'<span class="tag g">лояльны</span>'}</div>`;}).join('')
    ||'<p class="hint">Однопартийное правительство: делить портфели не с кем.</p>';

  const promBlock=(S.promises&&S.promises.length)?panel({title:'Обещания',
      meta:'спросят через '+quarters(Math.max(0,aTerm()-(S.q-S.termStart))),
      body:S.promises.map(pp=>{const pr=PR(pp.id); if(!pr)return '';
        const ok=pr.ok(), w=Math.round(pr.prog());
        return `<div style="padding:6px 0;border-bottom:var(--hair-2)">
          <div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px">
            <b style="font-size:13.5px">${pr.name}</b><span class="num-s ${ok?'good':'bad'}">${pr.val()}</span></div>
          <div class="sub2">нужно ${pr.goal}${ok?' · выполнено':''}</div>
          ${bar([[w,ok?'var(--good)':'var(--mark)']],7)}</div>`;}).join('')+
        '<p class="hint" style="margin-top:8px">Выполненное обещание даёт поддержку и вес, проваленное отнимает вдвое больше.</p>'}):'';

  const billBlock=S.bill?(()=>{ const tl=tally(S.bill), sl=senTally(S.bill), vc=vetoChance(S.bill);
    const stuck=tl.yes<MAJ?'Собрании':sl.yes<SEN_MAJ?'Сенате':vc>=0.5?'подписи':'';
    return panel({title:'На столе',body:
      `<div style="font:700 17px/1.2 var(--f-display);margin-bottom:3px">${T(S.bill.topic).name}</div>
       <p class="lead">${stanceLine(S.bill)}</p>
       <div class="whip"><div><i>собрание</i><b class="${tl.yes>=MAJ?'good':'bad'}">${tl.yes}</b></div>
         <div><i>сенат</i><b class="${sl.yes>=SEN_MAJ?'good':'bad'}">${sl.yes}</b></div>
         <div><i>подпись</i><b class="${vc<0.35?'good':'bad'}">${Math.round((1-vc)*100)}%</b></div></div>
       <p class="hint" style="margin-top:6px">${stuck?'Слабое место — в '+stuck+'.':'Проходит все три ступени.'}</p>`,
      foot:`<button class="btn sm pri" data-go="bill">К проекту</button>
            <button class="btn sm" onclick="askDeals({k:'b',topic:S.bill.topic,stance:S.bill.stance,bill:S.bill})">Сделки с фракциями</button>
            <button class="btn sm" data-go="parl">Депутаты</button>`});})()
    : panel({title:'На столе',body:'<div class="empty">Законопроект не подготовлен.<br>'+
        '<button class="btn sm" data-go="bill" style="margin-top:8px">Выбрать направление</button></div>'});

  return `${tutCard()}<div class="pin ${a[0]==='Рецессия'||a[0]==='Казна на исходе'?'warn':''}">
      <b>Записка помощника</b>${a[0]}. ${a[1]}</div>
  <div class="cols c21">
    <div>
      ${turnPanel()}
      ${deskPanel()}
      ${panel({title:'Положение дел',meta:dateLabel(),body:
        `<div class="grid g4">
          ${stat('Одобрение',Math.round(shown(ap,'nat'))+'<u>%</u>','',ap<38?'alert':'')}
          ${stat('Рост ВВП',sign(S.econ.growth)+'<u>%</u>',cyclePhase())}
          ${stat('Инфляция',S.econ.inf+'<u>%</u>',S.econ.inf>7?'выше нормы':'в норме',S.econ.inf>9?'alert':'')}
          ${stat('Напряжённость',Math.round(avgUnrest()),unrestWord(avgUnrest()))}
        </div>
        <h3 class="sub">Опора и слабое место</h3>
        <div class="dep"><div class="who"><b>${best.name}</b><span>${moodWord(S.mood[best.id])}</span></div>
          ${mini(S.mood[best.id],'var(--good)')}<b class="num-s">${Math.round(S.mood[best.id])}</b></div>
        <div class="dep"><div class="who"><b>${worst.name}</b><span>${moodWord(S.mood[worst.id])}</span></div>
          ${mini(S.mood[worst.id],'var(--bad)')}<b class="num-s">${Math.round(S.mood[worst.id])}</b></div>`,
        foot:`<button class="btn sm" data-go="society">Разбор по группам</button>
              <span class="hint">${polled()?'цифры из свежего опроса':'оценка штаба, ±3 пункта'}</span>`})}
      ${panel({title:'Общие действия',meta:'каждое — один ход',flush:true,
        body:`<table><tbody>${actRows}</tbody></table>`})}
      <button class="btn pri lg block" id="endq" ${S.over?'disabled':''}>Завершить квартал · ${dateLabel()}</button>
    </div>
    <div>
      ${panel({cls:coalSeats()<MAJ&&isPM()?'warn':'',title:'Три власти',meta:'чтобы провести закон',body:
        `<div class="sub2" style="margin-bottom:3px">Собрание · нужно ${MAJ} из ${SEATS}</div>
        ${bar(S.parties.slice().sort((x,y)=>(inCoal(y.id)?1:0)-(inCoal(x.id)?1:0)).map(p=>
          [seatsOf(p.id)/SEATS*100,inCoal(p.id)?p.color:p.color+'70']),15)}
        <div class="sub2" style="margin:8px 0 3px">Сенат · нужно ${SEN_MAJ} из ${SEN_SEATS}</div>
        ${bar(S.parties.slice().sort((x,y)=>(inCoal(y.id)?1:0)-(inCoal(x.id)?1:0)).map(p=>
          [senSeatsOf(p.id)/SEN_SEATS*100,inCoal(p.id)?p.color:p.color+'70']),15)}
        <div class="res" style="margin:9px 0 8px"><span>У коалиции</span>
          <b class="${coalSeats()>=MAJ?'good':'bad'}">${coalSeats()} · ${senCoalSeats()}</b>
          <span>Президент</span><b class="${isPres()?'good':''}">${isPres()?'это вы':S.pres.name+' · '+P(S.pres.party).short}</b></div>
        ${partners}`,
        foot:`<button class="btn sm" data-go="parl">Собрание</button>
              <button class="btn sm" data-go="senate">Сенат</button>
              <button class="btn sm" data-go="pres">Президент</button>`})}
      ${billBlock}
      ${promBlock}
      ${panel({title:'Журнал',meta:'последнее',body:'<div class="log">'+
        (S.log.slice(0,7).map(l=>`<div class="${l.key?'key':''}"><s>${l.d}</s>${l.t}</div>`).join('')
         ||'<div class="dim">Пока тихо.</div>')+'</div>',
        foot:`<button class="btn sm ghost" data-go="arch">Вся летопись</button>`})}
    </div>
  </div>`;
}
function askRegion(){
  sheetOpen({eye:'Поездка · 1 действие и '+visitCost().label,title:'Куда поедете',
    body:'<p class="lead">Визит поднимает поддержку в субъекте и сбивает напряжённость. Эффект выдыхается за несколько кварталов.</p>',
    opts:REGIONS.map(r=>({label:r.name+' · '+r.cap,
      hint:'поддержка '+Math.round(shown(regApproval(r.id),r.id))+'% · напряжённость '+Math.round(S.unrest[r.id]),
      fn:()=>ACT.visit(r.id)}))});
}
function askGroup(){
  sheetOpen({eye:'Обращение · 1 действие и 6 веса',title:'К кому обращаетесь',
    body:'<p class="lead">Речь под одну группу поднимает её настроение, но её идейные противники это заметят.</p>',
    opts:GROUPS.map(g=>({label:g.name,
      hint:'настроение '+Math.round(S.mood[g.id])+' · '+moodWord(S.mood[g.id]),
      fn:()=>ACT.address(g.id)}))});
}

/* ─── 2 · Собрание ───────────────────────────────────────────── */
/* партии рассаживаются слева направо по хозяйственно-правовой оси */
function seatOrder(){
  return S.parties.slice().sort((a,b)=>(a.st.econ+a.st.tax+a.st.free)-(b.st.econ+b.st.tax+b.st.free));
}
/* ─── зал Сената ──────────────────────────────────────────────────
   Тот же ровный полукруг, что у Собрания, но кресла квадратные:
   вторую палату узнают с первого взгляда.
   Сто мест — семь рядов; делегации субъектов — в таблице ниже. */
function senHemi(){
  return archParty(senSeatsOf,{R:230,sq:true,big:SEN_SEATS,sub:'мест'});
}
/* линейка порогов: где стоит коалиция относительно 51 и клотура */
function senThresholds(){
  const c=senCoalSeats(), need=cloture();
  const pos=v=>clamp(v,0,SEN_SEATS)/SEN_SEATS*100;
  return `<div class="meter tall" style="margin-top:var(--x4)">`+
      seatOrder().map(p=>`<i style="width:${senSeatsOf(p.id)}%;background:${p.color}"></i>`).join('')+
      `<span class="mid" style="left:${pos(SEN_MAJ)}%"></span></div>
    <div class="thr">
      <i style="left:${pos(SEN_MAJ)}%"></i><span style="left:${pos(SEN_MAJ)}%">51 · принять</span>
      <i style="left:${pos(need)}%"></i><span style="left:${pos(need)}%">${need} · клотур</span>
      <i style="left:${pos(c)}%;background:var(--mark);width:2px"></i>
      <span style="left:${pos(c)}%;top:14px;color:var(--mark)">коалиция ${c}</span>
    </div>`;
}
/* ─── разбор фракций ──────────────────────────────────────────────
   Каждая фракция целиком: два лидера, дисциплина, чего хочет, где
   стоит по каждой оси рядом с вами, какие сделки и долги открыты,
   какие скандалы горят. Отсюда же — переговоры. */
function tabFac(){
  flSync();
  const sh=raceShares(0);
  const sum=S.parties.slice().sort(bySeats).map(p=>{
    const dis=Math.round(S.deputies.filter(d=>d.party===p.id).reduce((a,d)=>a+d.loyal,0)/Math.max(1,seatsOf(p.id)));
    const h=flLeader(p.id,'h'), s=flLeader(p.id,'s');
    return `<tr class="${p.id===PL?'mine':''}"><td>${emblem(p,18)}</td><td><b>${p.name}</b><div class="sub2">${p.id===PL?'ваша':inCoal(p.id)?'в коалиции':'оппозиция'}</div></td>
      <td class="n">${seatsOf(p.id)}</td><td class="n">${senSeatsOf(p.id)}</td><td class="n hide-s">${dis}</td>
      <td class="n">${sh[p.id]}%</td>
      <td class="n ${p.id===PL?'':h.rel>=60?'good':h.rel<35?'bad':''}">${p.id===PL?'—':Math.round(h.rel)}</td>
      <td class="n hide-s ${p.id===PL||!s?'':s.rel>=60?'good':s.rel<35?'bad':''}">${p.id===PL||!s?'—':Math.round(s.rel)}</td></tr>`; }).join('');
  const cards=S.parties.filter(p=>p.id!==PL).sort(bySeats).map(p=>facCard(p)).join('');
  const bloc=blocOn()?`<div class="crisis"><b>Оппозиционный блок до ${shortDate(S.bloc.until)}</b>
      <span>${S.bloc.members.map(id=>P(id).name).join(', ')} — ${blocSeats()} мандатов голосуют вместе против ваших законов и бюджета.
        Сделка с одной из фракций может расколоть блок.</span></div>`:'';
  return bloc+panel({cls:'lead-p',title:'Фракции',meta:'Собрание · Сенат · отношение лидеров',flush:true,
    body:`<table class="tight"><thead><tr><th></th><th>Фракция</th><th class="n">Собр.</th><th class="n">Сенат</th>
      <th class="n hide-s">Дисц.</th><th class="n">Опрос</th><th class="n">Лидер</th><th class="n hide-s">Сенаторы</th></tr></thead><tbody>${sum}</tbody>
      <caption>Дисциплина — насколько депутаты идут за линией фракции: у дисциплинированной сделка с лидером приносит почти все голоса,
        у рыхлой — половину. Отношение — к вам лично, от него зависит цена сделки.</caption></table>`})
    +`<div class="cols c11">${cards}</div>`;
}
function facCard(p){
  const h=flLeader(p.id,'h'), s=flLeader(p.id,'s');
  const deps=S.deputies.filter(d=>d.party===p.id);
  const dis=Math.round(deps.reduce((a,d)=>a+d.loyal,0)/Math.max(1,deps.length));
  const friends=deps.filter(d=>d.rel>=62).length, foes=deps.filter(d=>d.rel<35).length;
  const pc=pactFor(p.id,PL);
  const deals=dealsLive().filter(d=>d.pid===p.id);
  const ious=(S.deals||[]).filter(d=>d.pid===p.id&&d.iou&&!d.iou.done&&!d.iou.broken);
  const scs=scLive().filter(x=>x.who===p.id);
  const lead=(L,house)=>L?`<div class="dep"><div class="who"><b>${L.name}</b><span>${house} · ${FT(L.trait).name.toLowerCase()} · ${flWord(L.rel)}${L.owe?' · должок':''}</span></div>
      ${mini(L.rel,L.rel>=60?'var(--good)':L.rel<35?'var(--bad)':'var(--ink-2)')}<b class="num-s">${Math.round(L.rel)}</b></div>`:'';
  const axes=AXES.map(a=>{ const them=p.st[a.id]||0, mine=me().st[a.id]||0, d=Math.abs(them-mine);
    return `<div class="fac-ax"><span>${a.name}</span><div class="ruler"><i style="left:${(them+2)/4*100}%;background:${p.color}"></i>
      <i style="left:${(mine+2)/4*100}%;background:var(--ink);border-radius:50%"></i></div><b class="${d>=2?'bad':d<1?'good':''}">${d.toFixed(1)}</b></div>`; }).join('');
  return panel({title:p.name,meta:(inCoal(p.id)?'в коалиции':'оппозиция')+' · '+mandates(seatsOf(p.id))+' · '+senSeatsOf(p.id)+' в Сенате',
    body:`<div class="fac-h">${emblem(p,40)}<p class="lead" style="margin:0">Хотят: ${pactText(pc)}.
        ${scs.length?'<span class="warn-t">Горит: '+scs.map(x=>x.title).join('; ')+'.</span>':''}</p></div>
      ${lead(h,'Собрание')}${lead(s,'Сенат')}
      <div class="res"><span>Дисциплина</span><b>${dis}</b>
        <span>Ваших людей / врагов</span><b>${friends} / ${foes}</b>
        <span>Импульс</span><b class="${(p.mom||0)<0?'bad':''}">${sign(r1(p.mom||0))}</b>
        ${deals.length?`<span>Сделки</span><b class="w">${deals.map(d=>(d.house==='s'?'Сенат: ':'')+d.label+' до '+shortDate(d.due)).join('; ')}</b>`:''}
        ${ious.length?`<span>Вы должны</span><b class="w warn-t">${ious.map(d=>pactText(d.iou)+' до '+shortDate(d.iou.due)).join('; ')}</b>`:''}</div>
      <div class="fac-axes"><div class="sub2">квадрат — фракция, круг — вы, справа — расстояние по оси</div>${axes}</div>`,
    foot:`<button class="btn sm" onclick="askFaction('${p.id}','h')">Переговоры · Собрание</button>
      ${s?`<button class="btn sm" onclick="askFaction('${p.id}','s')">Переговоры · Сенат</button>`:''}`});
}

/* ─── фракции и их лидеры ─────────────────────────────────────────
   У каждой фракции два лица: лидер в Собрании и лидер сенаторов.
   Таблица показывает, с кем и за сколько можно договориться. */
function factionPanel(house){
  flSync();
  const rows=S.parties.slice().sort((a,b)=>flSeats(b.id,house)-flSeats(a.id,house)).map(p=>{
    const L=flLeader(p.id,house); if(!L||!flSeats(p.id,house))return '';
    const n=dealsLive().filter(d=>d.pid===p.id&&d.house===house).length;
    const me_=p.id===PL;
    return `<tr class="${me_?'mine':''}"><td>${emblem(p,20)}</td>
      <td><b>${L.name}</b><div class="sub2">«${p.short}» · ${me_?(chief()&&house==='h'?'это вы':'ваша фракция'):FT(L.trait).name.toLowerCase()}${inCoal(p.id)?' · в коалиции':''}</div></td>
      <td class="n">${flSeats(p.id,house)}</td>
      <td class="n ${me_?'':L.rel>=60?'good':L.rel<35?'bad':''}">${me_?'—':Math.round(L.rel)}</td>
      <td class="n hide-s ${L.trust<40?'bad':''}">${me_?'—':Math.round(L.trust)}</td>
      <td class="n hide-s">${n?'<span class="tag g">'+n+'</span>':''}${L.owe?' <span class="tag y">должок</span>':''}</td>
      <td class="r">${me_?'':`<button class="btn sm" onclick="askFaction('${p.id}','${house}')">Переговоры</button>`}</td></tr>`;}).join('');
  return panel({title:house==='s'?'Лидеры сенаторов':'Лидеры фракций',meta:'договариваются с ними, а не с партией',flush:true,
    body:`<table class="tight"><thead><tr><th></th><th>Лидер</th><th class="n">Мест</th><th class="n">Отнош.</th>
      <th class="n hide-s">Доверие</th><th class="n hide-s">Сделки</th><th></th></tr></thead><tbody>${rows}</tbody>
      <caption>Доверие — верят ли вашему слову: падает, когда вы не возвращаете долги, и тогда дорожает каждая сделка.
        Сделка ведёт фракцию за вами по одному предмету: закону, поправке, бюджету или вотуму.</caption></table>`});
}
function askFaction(pid,house){
  const L=flLeader(pid,house), p=P(pid), t=FT(L.trait);
  const subs=[];
  if(S.bill)subs.push({k:'b',topic:S.bill.topic,stance:S.bill.stance,bill:S.bill});
  if(S.motion)subs.push({k:'m'});
  if(isPM()&&budgetDue()&&!S.budget.submitted)subs.push({k:'budget'});
  cnList().slice(0,3).forEach(c=>subs.push({k:'c',id:c.id}));
  const live=dealsLive().filter(d=>d.pid===pid&&d.house===house);
  sheetOpen({eye:(house==='s'?'Сенаторы':'Фракция')+' «'+p.name+'» · '+flSeats(pid,house)+' мест',title:L.name,
    body:`<p class="lead">${t.name}. ${t.txt}</p>
      <div class="res"><span>Отношение к вам</span><b>${Math.round(L.rel)} · ${flWord(L.rel)}</b>
        <span>Верит вашему слову</span><b class="${L.trust<40?'bad':''}">${Math.round(L.trust)}</b>
        <span>Любимая плата</span><b class="w">${DEAL_PAY.find(x=>x.id===t.likes).name.toLowerCase()}</b>
        <span>Держит фракцию</span><b>${t.whip>=1.2?'железно':t.whip>=1?'крепко':'как получится'}</b>
        ${live.length?`<span>Действующие сделки</span><b class="w">${live.map(d=>d.label).join('; ')}</b>`:''}</div>`,
    opts:subs.map(sb=>{ const dem=dealDemand(pid,house,sb), has=dealFor(pid,house,subjKey(sb));
      return {label:(has?'✓ ':'')+subjName(sb),hint:has?'уже договорились':dem===null?'не пойдёт ни за что':'цена '+dem,
        fn(){ if(has||dem===null){ askFaction(pid,house); return; } askDealWith(pid,house,sb); }}; })
      .concat([{label:'Встреча с лидером',hint:'ход и 4 веса · отношение +8…14, без предмета',fn:()=>flMeet(pid,house)},
        {label:'Закрыть',hint:'',fn(){}}])});
}
/* комитеты палаты: председатель, состав, слушания */
function commPanel(){
  const rows=AXES.map(a=>{
    const d=commChair(a.id), m=commMembers(a.id), post=COMM_MIN[a.id], mn=minOf(post);
    const by={}; m.forEach(x=>by[x.party]=(by[x.party]||0)+1);
    const comp=S.parties.filter(p=>by[p.id]).map(p=>`<i style="width:${by[p.id]/m.length*100}%;background:${p.color}"></i>`).join('');
    const ours=d&&(d.party===PL||inCoal(d.party)&&inCoal(PL));
    return `<tr><td><b>${a.name}</b><div class="sub2">${mn?'министр '+mn.name:''}</div>
        <div class="meter" style="height:6px;margin-top:4px">${comp}</div></td>
      <td>${d?`<b>${d.name}</b><div class="sub2">${P(d.party).short} · ${ours?'свой':'чужой'} · отнош. ${Math.round(d.rel)}</div>`:'<span class="dim">вакансия</span>'}</td>
      <td class="r"><button class="btn sm" onclick="askHearing('${a.id}')" ${S.ap?'':'disabled'}>Слушания</button>
        ${isPM()?`<button class="btn sm ghost" onclick="askChair('${a.id}')" ${S.ap&&S.cap>=6?'':'disabled'}>${d?'Сменить':'Назначить'}</button>`:''}</td></tr>`;
  }).join('');
  const hl=(S.hearLog||[]).slice(0,3).map(h=>`<div><s>${shortDate(h.q)}</s>${h.you?'Ваши слушания':'Комитет «'+AXNAME[h.ax]+'»'}: ${h.name}</div>`).join('');
  return panel({title:'Комитеты',meta:COMM_SIZE+' членов · места по фракциям',flush:true,
    body:`<table class="tight"><tbody>${rows}</tbody>
      <caption>Комитет голосует первым: за — проект идёт в зал с рекомендацией и лишними голосами, против — с минусом,
        а чужой председатель при поддержке комитета может положить его под сукно. Чужие комитеты сами вызывают ваших министров.</caption></table>
      ${hl?'<div class="log" style="padding:var(--x4) var(--x5)">'+hl+'</div>':''}`});
}
/* повестка Сената: что палата делала сама */
function senAgendaPanel(){
  const L=S.senLead, log=(S.senLog||[]).slice(0,5);
  return panel({title:'Повестка Сената',meta:L?'ведёт '+L.name+' · «'+P(L.party).short+'»':'лидера большинства нет',
    body:log.length?'<div class="log">'+log.map(x=>`<div><s>${shortDate(x.q)}</s>${x.t}</div>`).join('')+'</div>'
      :'<div class="empty">Палата пока занята вашими проектами. Чужое большинство найдёт себе дело само: резолюции о министрах, свои законы, выездные заседания.</div>'});
}

function tabParl(){
  const b=S.bill;
  let deps=S.deputies.slice();
  if(S.filter!=='all')deps=deps.filter(d=>d.party===S.filter);
  if(b)deps.sort((x,y)=>Math.abs(support(x,b))-Math.abs(support(y,b)));
  else deps.sort((x,y)=>x.rel-y.rel);
  const shown=Math.min(S.shown||24,deps.length);
  const rows=deps.slice(0,shown).map(d=>{
    const v=b?support(d,b):null;
    const st=v===null?'':v>10?'<span class="tag g">за</span>':v<-10?'<span class="tag r">против</span>':'<span class="tag y">колеблется</span>';
    return `<tr><td><b>${d.name}</b><div class="sub2">${R(d.region).name}${d.note?' · '+d.note:''}</div></td>
      <td>${chip(P(d.party))}</td><td class="n hide-s">${d.loyal}</td>
      <td class="n">${Math.round(d.rel)} ${mini(d.rel)}</td><td>${st}</td>
      <td class="r"><button class="btn sm" onclick="openDep('${d.id}')" ${S.ap?'':'disabled'}>Работать</button></td></tr>`;}).join('');
  const filters=`<div class="seg"><button class="${S.filter==='all'?'on':''}" onclick="setFilter('all')">Все<u>${SEATS}</u></button>`+
    S.parties.map(p=>`<button class="${S.filter===p.id?'on':''}" onclick="setFilter('${p.id}')">${p.short}<u>${seatsOf(p.id)}</u></button>`).join('')+'</div>';
  const votes=S.votes.slice(0,10).map(v=>
    `<tr><td>${v.name} <span class="dim">${STEP[v.stance+2]}</span></td>
     <td class="dim hide-s">${v.house==='сен'?'Сенат':'Собрание'}</td><td class="n good">${v.yes}</td>
     <td class="n bad">${v.no}</td><td>${v.pass?'<span class="tag g">принят</span>':'<span class="tag r">отклонён</span>'}</td>
     <td class="n">${shortDate(v.q)}</td></tr>`).join('')
    ||'<tr><td colspan="6" class="dim">Голосований ещё не было.</td></tr>';
  const tl=b?tally(b):null;

  return parlPult()+factionPanel('h')
  +panel({cls:'info',title:'Народное собрание',
    meta:mandates(SEATS)+' · большинство '+MAJ+' · коалиция '+coalSeats(),
    body:hemicycle()+archLegend(seatsOf)})
  +`<div class="cols c21"><div>`
  +panel({title:'Депутаты',meta:b?'по проекту «'+T(b.topic).name+'»':'сортировка: кто хуже к вам относится',flush:true,
    body:`<div style="padding:var(--x4) var(--x5);border-bottom:var(--hair-2)" class="row">
        ${filters}
        ${tl?`<span class="dim" style="margin-left:auto;font-size:11.5px">колеблются ${tl.und}</span>`:''}</div>
      <div class="scrollx"><table><thead><tr><th>Депутат</th><th>Фракция</th><th class="n hide-s">Дисц.</th>
        <th class="n">Отношение</th><th>Позиция</th><th></th></tr></thead><tbody>${rows}</tbody>
        <caption>Показаны ${shown} из ${deps.length}. ${b?'Сверху — те, чей голос ещё не предрешён.':'Сверху — те, кто хуже к вам относится.'}
          Дисциплина — насколько депутат идёт за фракцией, отношение — как он относится лично к вам.</caption></table></div>`,
    foot:shown<deps.length?`<button class="btn sm" onclick="S.shown=${shown+40};render()">Показать ещё<span class="cost">${Math.min(40,deps.length-shown)}</span></button>
        <span class="hint">осталось ${deps.length-shown}</span>`:''})
  +`</div><div>`
  +(b?panel({cls:'lead-p',title:'Расклад по проекту',body:
      `<div class="whip"><div><i>за</i><b class="good">${tl.yes}</b></div><div><i>?</i><b>${tl.und}</b></div>
        <div><i>против</i><b class="bad">${tl.no}</b></div></div>
       ${bar([[tl.yes/SEATS*100,'var(--good)'],[tl.und/SEATS*100,'var(--line)'],[tl.no/SEATS*100,'var(--bad)']],12)}
       <p class="hint" style="margin-top:6px">Нужно ${MAJ}. Колеблющихся ${tl.und} — их и стоит перетягивать.</p>`,
      foot:`<button class="btn sm pri" data-act="whip" ${S.ap&&S.cap>=11&&tl.und?'':'disabled'}>Обработать колеблющихся<span class="cost">11</span></button>
            <button class="btn sm" data-go="bill">К проекту</button>`})
    :panel({title:'Расклад по проекту',body:'<div class="empty">Проект не внесён — позиции депутатов покажутся, когда он появится.</div>'}))
  +regPanel()
  +commPanel()
  +`</div></div>`
  +cnParlPanel()
  +panel({title:'Прошедшие голосования',flush:true,body:`<table class="tight"><tbody>${votes}</tbody></table>`});
}

/* ─── пульт палаты ────────────────────────────────────────────────
   Всё, что решает судьбу кабинета, собрано над полукругом: кто правит
   и на скольких голосах, и четыре рычага — коалиция, вотум, роспуск,
   импичмент. У каждого видно состояние и следующий шаг. */
function lever(title,state,detail,btn,cls){
  return `<div class="lever ${cls||''}"><i>${title}</i><b>${state}</b><span>${detail}</span>${btn}</div>`;
}
function parlPult(){
  const lead=P(S.gov.lead), mine=S.gov.lead===PL, cs=coalSeats(), cr=S.crisis, m=S.motion, imp=S.imp;
  const left=aTerm()-(S.q-S.termStart);
  const coalLine=coalition().map(id=>`<span class="chip">${emblem(P(id),16)}${P(id).short} ${seatsOf(id)}</span>`).join(' ');
  // коалиция
  const strong=coalStrength();
  const cL=lever('Коалиция',cs+' из '+MAJ,
    cs<MAJ?'меньшинство: любой вотум опасен':'самый слабый партнёр держится на '+strong+'%',
    `<button class="btn sm" onclick="askCoalition()">${mine?'Партнёры и уступки':'Трещины кабинета'}</button>`,
    cs<MAJ||strong<40?'warn':'');
  // вотум
  let mState='нет', mDet='', mBtn='', mCls='';
  const bl=motionBlock();
  if(m){ const f=motionForecast(); mState='внесён · '+f.yes+' из '+MAJ;
    mDet=(m.against===PL?'против вашего кабинета':'внесла «'+P(m.by).short+'»')+', голосование '+(m.due>S.q?'в следующем квартале':'в конце квартала');
    mBtn=`<button class="btn sm pri" onclick="askMotion()">К вотуму</button>`; mCls=m.against===PL?'bad':'on'; }
  else if(bl){ mState='недоступен'; mDet=bl; }
  else if(mine){ mState='не внесён'; mDet='оппозиции нужно '+MOT_SIG+' подписей и '+MAJ+' голосов'; }
  else { mState='можно внести'; mDet=MOT_SIG+' подписей, потом '+MAJ+' голосов · сейчас '+motionSigs()+' подписей';
    mBtn=`<button class="btn sm" onclick="askMotion()">Внести вотум<span class="cost">${MOT_CAP}</span></button>`; }
  const mL=lever('Вотум недоверия',mState,mDet,mBtn,mCls);
  // роспуск
  const ok=dissAllowed(), th=dissThreat();
  const dState=CN().dissolve==='none'?'запрещён':canDissolve()?(ok?'в ваших руках':'пока нельзя'):'у '+(CN().dissolve==='pres'?'президента':'премьера');
  const dDet=th&&th.gain>=10?'<b class="warn-t">'+(CN().dissolve==='pres'?'президент':'премьер')+' может распустить: «'+P(th.holder).short+'» прибавила бы '+th.gain+'</b>'
    :(()=>{ const f=dissRules().find(x=>!x.ok); return f?'нельзя: '+f.fail:'все условия соблюдены'; })();
  const dL=lever('Роспуск',dState,dDet,`<button class="btn sm" onclick="askDissolve()">Правила и прогноз</button>`,th&&th.gain>=10?'warn':'');
  // импичмент
  let iState='нет', iDet=IMP_SIG+' подписей, комиссия, '+impH()+' в Собрании, '+impS()+' в Сенате', iBtn=`<button class="btn sm" onclick="askImpeach()">Начать</button>`, iCls='';
  if(imp&&imp.stage){ iState=(imp.kind==='you'?'против вас · ':'')+IMP_STAGE_NAME[imp.stage].toLowerCase();
    iDet=imp.who.name+' · сила дела '+Math.round(imp.case)+' из 100'; iBtn=`<button class="btn sm pri" onclick="askImpeachStage()">К делу</button>`;
    iCls=imp.kind==='you'?'bad':'on'; }
  const iL=lever('Импичмент',iState,iDet,iBtn,iCls);

  const crisisBar=cr?`<div class="crisis"><b>Правительственный кризис · раунд ${cr.round} из ${FORM_ROUNDS}</b>
      <span>${cr.why[0].toUpperCase()+cr.why.slice(1)}. ${cr.form?'Поручение у '+(cr.form===PL?'вас':P(cr.form).leader)+'.':'Поручение ещё не дано.'}
        ${cr.prev?'Кабинет '+P(cr.prev).leader+' исполняет обязанности.':''} Два провала подряд — обязательный роспуск.</span>
      ${cr.form===PL?`<button class="btn sm pri" onclick="askFormation()">Переговоры · ${formSeats()} из ${MAJ}</button>`:''}</div>`:'';
  return panel({cls:cr||cs<MAJ?'warn':'info',title:'Палата сейчас',
    meta:'созыв '+S.term+' · квартал '+(S.q-S.termStart+1)+' из '+aTerm()+' · до выборов '+quarters(Math.max(0,left)),
    body:`${crisisBar}
      <div class="gov-line"><div><i>Правительство</i><b>${mine?'ваше':lead.leader+' · «'+lead.name+'»'}${cr?' <span class="tag r">и. о.</span>':''}</b>
          <span>${coalLine}</span></div>
        <div><i>Ваша роль</i><b>${mine?'премьер':S.role==='junior'?'младший партнёр':'оппозиция'}</b>
          <span>${mandates(seatsOf(PL))} · ${seatName().toLowerCase()}</span></div>
        <div><i>Кабинет работает</i><b>${quarters(S.govAge||0)}</b><span>${(S.govAge||0)<4?'первый год: роспуск закрыт':'роспуск возможен'}</span></div></div>
      <div class="levers">${cL}${mL}${dL}${iL}</div>`,
    foot:`<button class="btn sm" onclick="askReg()">Регламент Собрания</button>
      ${regOn('qtime')&&!mine?`<button class="btn sm" onclick="askQuestion()">Запрос правительству<span class="cost">4</span></button>`:''}
      <span class="hint">Процедуры палаты тратят действия так же, как законы: смотрите цену на кнопке.</span>`});
}
/* регламент — отдельной панелью под пультом: что действует и что можно поправить */
function regPanel(){
  return panel({title:'Регламент Собрания',meta:'простое большинство · без Сената',flush:true,
    body:`<table class="tight"><tbody>${REGS.map(r=>{ const on=regOn(r.id);
      return `<tr><td><b>${r.name}</b><div class="sub2">${r.eff}</div></td>
        <td class="n">${on?'<span class="tag g">действует</span>':'<span class="dim">нет</span>'}</td></tr>`; }).join('')}</tbody></table>`,
    foot:`<button class="btn sm" onclick="askReg()">Править регламент<span class="cost">${REG_CAP}</span></button>`});
}

/* ─── конституционные законы в палате ────────────────────────────
   Поправку принимает не президент и не суд, а эти самые скамьи —
   значит и лежать она должна здесь, рядом с обычными законами.
   И разбирают её тоже здесь: комиссия смотрит не на статью, а на то,
   как за неё голосовали. */
function cnParlPanel(){
  const log=(CN().log||[]).slice().reverse();
  const inq=S.inq&&S.inq.kind==='amend'?(CN().log||[]).find(x=>x.id===S.inq.who):null;
  const rows=log.map(a=>{
    const under=inq&&inq.id===a.id;
    return `<tr class="${under?'mine':''}"><td><b>${a.name}</b>${under?' <span class="tag r">под комиссией</span>':''}
        <div class="sub2">${a.art} · ${a.eff}</div></td>
      <td class="n">${shortDate(a.q)}</td>
      <td class="n hide-s">${a.ref?a.ref+'%':'<span class="dim">без реф.</span>'}</td>
      <td class="n ${a.cost<0?'bad':'good'}">${sign(a.cost)}</td>
      <td class="r">${under?'<span class="dim">разбирают</span>'
        :`<button class="btn sm" onclick="openInquiry('amend','${a.id}')"
            ${S.ap&&S.cap>=INQ_CAP&&!S.inq?'':'disabled'}>Расследовать</button>`}</td></tr>`;
  }).join('')||`<tr><td colspan="5" class="dim">Конституция в первоначальной редакции: разбирать нечего.</td></tr>`;
  const soon=cnList().slice(0,4).map(c=>{ const f=cnForecast(c);
    return `<tr><td><b>${c.name}</b><div class="sub2">${c.art} · ${c.eff}</div></td>
      <td class="n ${f.h>=f.needH?'good':'bad'}">${f.h}/${f.needH}</td>
      <td class="n ${f.s>=f.needS?'good':'bad'} hide-s">${f.s}/${f.needS}</td>
      <td class="r"><button class="btn sm" onclick="askAmendOne('${c.id}')"
        ${S.ap&&S.cap>=CN_CAP?'':'disabled'}>Вносить</button></td></tr>`;}).join('');

  return `<div class="cols c11"><div>`
  +panel({cls:inq?'warn':'',title:'Конституционные законы',
    meta:plural(log.length,'поправка','поправки','поправок')+' в силе',flush:true,
    body:`<div style="padding:var(--x4) var(--x5) 0"><p class="hint" style="margin:0">
        Поправку принимают эти самые скамьи — две трети здесь и две трети в Сенате, без подписи
        президента. Разбирают её тоже здесь: комиссия смотрит не на статью, а на то, как за неё голосовали.</p></div>
      <div class="scrollx"><table class="tight"><thead><tr><th>Поправка</th><th class="n">Принята</th>
        <th class="n hide-s">Реф.</th><th class="n">Лег.</th><th></th></tr></thead>
        <tbody>${rows}</tbody></table></div>`,
    foot:`<span class="hint">Комиссия работает ${quarters(INQ_LEN)} и стоит ${INQ_CAP} веса.
      Полный состав даёт палате право отменить поправку как принятую с нарушением порядка —
      всенародное голосование такую комиссию сильно осложняет.</span>`})
  +`</div><div>`
  +(inq?panel({cls:'warn',title:'Комиссия по поправке',meta:'улик '+Math.round(S.inq.ev),
    body:`<div class="res" style="margin-top:0"><span>Разбирают</span><b class="w">${inq.name}</b>
        <span>Созвал</span><b class="w">${P(S.inq.by)?P(S.inq.by).name:'палата'}</b>
        <span>Улик собрано</span><b class="${S.inq.ev>=62?'bad':''}">${Math.round(S.inq.ev)} · ${inqWord(S.inq.ev)}</b>
        <span>Осталось работать</span><b>${quarters(S.inq.left)}</b></div>
      ${bar([[S.inq.ev,S.inq.ev>=62?'var(--bad)':'var(--ink-2)']],10)}
      <p class="hint">Собранное на поправку зависит от того, насколько она была выгодна тому, кто её провёл,
        и сколько следа осталось от сделок в те кварталы.</p>`,
    foot:`<button class="btn sm" data-go="court">К надзору</button>`})
   :panel({title:'Что можно внести',meta:'прогноз голосов',flush:true,
    body:soon?`<table class="tight"><tbody>${soon}</tbody></table>`
      :'<div class="empty">Вносить нечего: всё, что можно было изменить, изменено.</div>',
    foot:`<button class="btn" data-go="const">К конституции</button>`}))
  +`</div></div>`;
}
function openDep(id){
  const d=S.deputies.find(x=>x.id===id); if(!d)return;
  const b=S.bill, v=b?support(d,b):null;
  sheetOpen({eye:P(d.party).name+' · '+R(d.region).name,title:d.name,
    body:`<div class="res">
        <span>Дисциплина фракции</span><b>${d.loyal}</b>
        <span>Отношение к вам</span><b class="${d.rel<40?'bad':d.rel>62?'good':''}">${Math.round(d.rel)}</b>
        <span>Неподкупность</span><b>${d.integ}</b>
        <span>Сделок с вами</span><b>${d.deals}</b>
        ${b?`<span>По проекту «${T(b.topic).name}»</span><b class="${v>10?'good':v<-10?'bad':''}">${v>10?'за':v<-10?'против':'колеблется'}</b>`:''}
      </div>
      <p class="hint">Взгляды: ${AXES.map(a=>a.name.toLowerCase()+' '+STEP[Math.round(d.st[a.id])+2]).join(', ')}.</p>`,
    opts:LOBBY.filter(l=>!l.need||l.need(d)).map(l=>({
      label:l.name+' · '+[l.cap?l.cap+' веса':'',l.gold?l.gold+' млрд':''].filter(Boolean).join(' и '),
      hint:l.txt, fn:()=>lobby(d.id,l.id)}))});
}
function askChair(ax){
  const busy=Object.entries(S.comm||{}).filter(([k])=>k!==ax).map(([,v])=>v);
  const cand=S.deputies.filter(d=>busy.indexOf(d.id)<0)
    .sort((a,b)=>(Math.abs(a.st[ax]-me().st[ax])-Math.abs(b.st[ax]-me().st[ax]))+(b.rel-a.rel)*0.01).slice(0,10);
  sheetOpen({eye:'Комитет по теме «'+AXNAME[ax]+'» · 1 действие и 6 веса',title:'Кого поставить',
    body:'<p class="lead">Председатель тянет за собой свою фракцию на профильных проектах. Список отсортирован по близости взглядов к вашим.</p>',
    opts:cand.map(d=>({label:d.name+' · '+P(d.party).short,
      hint:'позиция '+STEP[Math.round(d.st[ax])+2]+' · отношение '+Math.round(d.rel)+' · '+R(d.region).name,
      fn:()=>setChair(ax,d.id)}))});
}

/* ─── 2 · Мой политик ────────────────────────────────────────────
   До сих пор игрок был партией. Здесь он человек: откуда пришёл,
   что за характер, какая молва и что после него останется. */
function repBar(k){
  const r=REPS.find(x=>x.id===k), v=rep(k);
  return `<div class="repline"><i>${r.name}</i>
    <div class="repscale"><span style="left:${v}%"></span></div>
    <b class="${v>=62?'good':v<38?'bad':''}">${Math.round(v)}</b>
    <u>${v>=62?r.r:v<38?r.l:'посередине'}</u></div>`;
}
function tabSelf(){
  const y=S.you, or0=origin(), p=me();
  const role=seatTitle().toLowerCase()+' · '+(isPM()?'кабинет ваш'
    :S.gov.lead===PL?'кабинет партии':S.role==='junior'?'младший партнёр':'оппозиция');
  const tr=(y.traits||[]).map(id=>{const t=TR(id); return t?
    `<div class="dep"><div class="who"><b>${t.name}</b><span>${t.desc}</span></div></div>`:'';}).join('')
    ||'<p class="hint">Без выраженных черт: ровный политик без сильных сторон и без слабых.</p>';
  const car=(y.career||[]).slice().reverse().slice(0,26).map(c=>
    `<div class="crow"><s>${c.y}</s><span>${c.t}</span></div>`).join('')
    ||'<div class="dim">Карьера ещё не началась.</div>';
  // позиция партии — дробная, поэтому печатаем число, а не деление шкалы
  const stance=AXES.map(a=>{const v=r1(p.st[a.id]||0);
    return `<tr><td>${a.name}</td><td class="n">${v>0?'+'+v:v}</td>
      <td class="dim">${v<-0.3?a.l:v>0.3?a.r:'середина'}</td></tr>`;}).join('');
  const old=ageOf()>=64;

  return panel({cls:'lead-p',title:'Личное дело',meta:role,body:
    `<div class="cols c12"><div>
      <div class="stat"><i>${or0?or0.name:'политик'}</i><div class="v">${y.name}</div>
        <span>«${p.name}» · ${Math.round(y.age)} ${plural(Math.round(y.age),'год','года','лет').split(' ')[1]}</span></div>
      <p class="hint" style="margin-top:8px">${or0?or0.desc:''}</p>
     </div><div>
      <h3 class="sub" style="margin-top:0">Молва</h3>
      ${REPS.map(r=>repBar(r.id)).join('')}
      <p class="hint">Молва движется от решений, а не от рейтинга: она влияет на выборы,
        на терпение союзников и на то, верят ли вашему слову.</p>
     </div></div>`})
  +`<div class="cols c11"><div>`
  +panel({title:'Черты характера',meta:(y.traits||[]).length+' из 2',body:tr})
  +panel({cls:old?'warn':'',title:'Возраст и форма',body:
    `<div class="res" style="margin:0"><span>Лет</span><b>${Math.round(y.age)}</b>
      <span>В политике</span><b>${quarters(S.q)}</b>
      <span>Созывов</span><b>${S.term} из 3</b>
      <span>Износ от возраста</span><b class="${agePenalty()>2?'bad':''}">${agePenalty()?'−'+r1(agePenalty()):'нет'}</b></div>
     <p class="hint" style="margin-top:8px">${old
       ? 'После шестидесяти четырёх каждый год отнимает часть кредита доверия: страна начинает смотреть на преемника.'
       : 'Пока возраст не мешает. Он начнёт стоить рейтинга после шестидесяти четырёх.'}</p>`})
  +`</div><div>`
  +panel({title:'Политическая позиция',meta:'курс партии',flush:true,
    body:`<table class="tight"><tbody>${stance}</tbody></table>`,
    foot:`<button class="btn sm" data-go="society">Менять курс</button>`})
  +panel({cls:hasMandate()||['gov','mayor','sen','pres','vp','min'].indexOf(mySeat())>=0?'':'warn',title:'Кресло',meta:seatName(),
    body:`<div class="res" style="margin-top:0">
        <span>Должность</span><b class="w">${seatTitle()}</b>
        <span>В ней с</span><b>${shortDate(y.seatQ||1)}</b>
        <span>Партию ведёт</span><b class="w">${chief()?'вы':me().leader}</b>
        ${chief()?'':`<span>Влияние в партии</span><b class="${y.inf>=CONGRESS_INF?'good':''}">${Math.round(y.inf)}</b>`}
        <span>Мандат в Собрании</span><b class="${hasMandate()?'good':mySeat()==='none'?'bad':''}">${hasMandate()?'есть':mySeat()==='none'?'нет':'не нужен креслу'}</b>
        <span>Вес кресла</span><b>${seatPower().toFixed(2)}</b>
        <span>Праймериз пройдено</span><b>${y.primaries||0}</b>
        <span>Риск отзыва мандата</span><b class="${recallRisk()>0.05?'bad':''}">${
          recallRisk()?Math.round(recallRisk()*100)+'% за квартал':'нет'}</b></div>
      <p class="hint">${(SEATS_YOU[mySeat()]||{}).txt||''} ${hasMandate()
        ? 'Мандат отбирают за след от сделок: чем он длиннее, тем ближе представление надзора.'
        : 'Без мандата законы вносят чужими руками. Вернуться можно довыборами или следующим созывом.'}</p>`,
    foot:`${hasMandate()||['gov','mayor','sen','pres','vp','min'].indexOf(mySeat())>=0?'':`<button class="btn pri" onclick="byElection()" ${S.ap&&S.cap>=12&&S.funds>=30?'':'disabled'}>Идти на довыборы<span class="cost">12 · 30 млн</span></button>`}
      <button class="btn" onclick="askRaces()">Выборный календарь</button>
      <button class="btn" onclick="askPrimary()" ${S.ap&&S.cap>=PRIM_CAP&&!S.prim?'':'disabled'}>Праймериз<span class="cost">${PRIM_CAP}</span></button>
      <button class="btn danger" onclick="askResign()">Отставка</button>`})
  +panel({title:'Карьера',meta:(y.career||[]).length+' записей',flush:true,
    body:`<div class="career">${car}</div>`})
  +`</div></div>`;
}

/* ─── Бизнес ─────────────────────────────────────────────────────
   Деньги не сидят в палате, но платят тем, кто сидит. Раздел
   показывает не только, кто сколько дал, но и сколько власти
   при этом ушло — захват и есть цена всех этих щедростей. */
function tabFirms(){
  const cap=captureLevel();
  const rows=FIRMS.map(d=>{
    const f=firmOf(d.id); if(!f)return '';
    const owed=firmOwed(f);
    return `<tr><td><b>${d.name}</b>${f.nat?' <span class="tag">в казне</span>':''}
        ${f.angry?' <span class="tag r">злится</span>':''}
        <div class="sub2">${d.sec} · ${R(d.reg).name}${owed?' · обещано: '+owed.t.name:''}</div></td>
      <td class="n">${Math.round(f.cash)}</td>
      <td class="n ${f.given>25?'warn':''}">${Math.round(f.given)}</td>
      <td class="n">${Math.round(f.rel)} ${mini(f.rel)}</td>
      <td class="r"><button class="btn sm" onclick="askFirm('${d.id}')" ${S.ap&&!f.nat?'':'disabled'}>Работать</button></td></tr>`;
  }).join('');
  const owedList=FIRMS.map(d=>{ const f=firmOf(d.id); const o=f&&firmOwed(f);
    return o&&!o.done?`<tr><td><b>${d.name}</b><div class="sub2">${o.t.name} · ${STEP[f.owed.stance+2]}</div></td>
      <td class="n ${o.left<=2?'bad':'warn'}">${quarters(o.left)}</td>
      <td class="r"><button class="btn sm" onclick="newBill('${f.owed.topic}');S.bill.stance=${f.owed.stance};S.tab='bill';render()"
        ${S.bill?'disabled':''}>Готовить</button></td></tr>`:'';}).join('')
    ||'<tr><td colspan="3" class="dim">Никому ничего не обещано. Пока.</td></tr>';
  const top=FIRMS.slice().sort((a,b)=>firmWeight(firmOf(b.id))-firmWeight(firmOf(a.id)))[0];

  return bizPanel()+panel({cls:cap>CAP_HIGH?'warn':'info',title:'Захват власти',
    meta:'деньги в политике · '+captureWord(cap),
    body:`<div class="cols c12"><div>
      <div class="stat ${cap>CAP_HIGH?'bad':''}"><i>индекс захвата</i><div class="v">${cap}</div>
        <span>${captureWord(cap)}</span></div>
      ${bar([[cap,cap>CAP_HIGH?'var(--bad)':'var(--ink-2)']],12)}
     </div><div>
      <p class="lead">Корпорация не голосует и не сидит в палате. Она платит тем, кто сидит, и помнит,
        кто как проголосовал. Захват — мера того, сколько власти уже куплено: страна чувствует его
        раньше, чем узнаёт подробности.</p>
      <div class="res"><span>Всего дано вам</span><b>${Math.round(FIRMS.reduce((a,d)=>a+(firmOf(d.id).given||0),0))} млн</b>
        <span>Обещаний висит</span><b class="${FIRMS.filter(d=>{const o=firmOf(d.id);return o&&o.owed;}).length?'warn':''}">${
          FIRMS.filter(d=>{const o=firmOf(d.id);return o&&o.owed;}).length}</b>
        <span>Самая тяжёлая</span><b class="w">${top.name}</b>
        <span>След от денег</span><b class="${trail()>50?'bad':''}">${Math.round(trail())}</b></div>
      <p class="hint">${cap>CAP_HIGH
        ? 'Захват перевалил за '+CAP_HIGH+': рабочие и интеллигенция это видят, надзор — тоже.'
        : 'Пока деньги в политике не бросаются в глаза. Дальше '+CAP_HIGH+' начнётся другой разговор.'}</p>
     </div></div>`})
  +`<div class="cols c21"><div>`
  +panel({title:'Корпорации',meta:'капитал · дано вам · отношение',flush:true,
    body:`<div class="scrollx"><table><thead><tr><th>Кто</th><th class="n">Капитал</th>
      <th class="n">Дано</th><th class="n">Отношение</th><th></th></tr></thead><tbody>${rows}</tbody>
      <caption>Деньги не покупают убеждений — они покупают внимание депутатов того края,
        где корпорация работает. Обещанный и непроведённый закон помнят четыре квартала.</caption></table></div>`})
  +`</div><div>`
  +panel({cls:FIRMS.some(d=>{const o=firmOf(d.id);return o&&o.owed&&firmOwed(o)&&firmOwed(o).left<=2;})?'warn':'',
    title:'Долги по обещаниям',meta:'что и кому обещано',flush:true,
    body:`<table class="tight"><tbody>${owedList}</tbody></table>`})
  +panel({title:'Что они могут',flush:true,
    body:`<table class="tight"><tbody>
      <tr><td><b>Пожертвование</b><div class="sub2">деньги в партийную кассу, след в надзоре</div></td></tr>
      <tr><td><b>Тяга в палате</b><div class="sub2">депутаты их края голосуют по их интересу</div></td></tr>
      <tr><td><b>Вложения в край</b><div class="sub2">инвестиции и спокойствие в обмен на отношение</div></td></tr>
      <tr><td><b>Уход к сопернику</b><div class="sub2">обманутая корпорация финансирует другую партию</div></td></tr>
      </tbody></table>`,
    foot:`<span class="hint">Национализация: ${NAT_CAP} веса, деньги в казну, инвесторы разбегаются.</span>`})
  +`</div></div>`;
}

/* ─── 3 · Сенат ──────────────────────────────────────────────────
   Палата субъектов: сто мест по населению, обновление третями.
   Здесь смотрят не на фракцию, а на то, что закон сделает с краем. */
function tabSenate(){
  const b=S.bill, tl=b?senTally(b):null;
  const cnt=b?senCount(b,tl):null, cl=b?clotureCount(b,tl):null, need=cloture();
  let sens=S.senate.slice();
  if(S.filter!=='all')sens=sens.filter(s=>s.party===S.filter);
  if(b)sens.sort((x,y)=>Math.abs(senSupport(x,b))-Math.abs(senSupport(y,b)));
  else sens.sort((x,y)=>x.rel-y.rel||senRank(y)-senRank(x));
  const shown=Math.min(S.shown||24,sens.length);
  const rows=sens.slice(0,shown).map(s=>{
    const v=b?senSupport(s,b):null;
    const st=v===null?'':v>10?'<span class="tag g">за</span>':v<-10?'<span class="tag r">против</span>':'<span class="tag y">колеблется</span>';
    const lead=S.senLead&&S.senLead.id===s.id;
    return `<tr><td><b>${s.name}</b>${lead?' <span class="tag y">лидер</span>':s.life?' <span class="tag">пожизненно</span>':senElder(s)?' <span class="tag">старейшина</span>':''}
      <div class="sub2">${R(s.region).name} · класс ${QUARTERS[s.cls]}${s.note?' · '+s.note:''}</div></td>
      <td>${chip(P(s.party))}</td><td class="n hide-s">${senRank(s)}</td>
      <td class="n">${Math.round(s.rel)} ${mini(s.rel)}</td><td>${st}</td>
      <td class="r"><button class="btn sm" onclick="askSen('${s.id}')" ${S.ap?'':'disabled'}>Работать</button></td></tr>`;}).join('');
  const filters=`<div class="seg"><button class="${S.filter==='all'?'on':''}" onclick="setFilter('all')">Все<u>${SEN_SEATS}</u></button>`+
    S.parties.map(p=>`<button class="${S.filter===p.id?'on':''}" onclick="setFilter('${p.id}')">${p.short}<u>${senSeatsOf(p.id)}</u></button>`).join('')+'</div>';
  const byReg=REGIONS.map(r=>{
    const here=S.senate.filter(s=>s.region===r.id);
    const mine=here.filter(s=>inCoal(s.party)).length;
    const dean=senDean(r.id);
    return `<tr><td><b>${r.name}</b><div class="sub2">старший — ${dean?dean.name:'—'}</div></td><td class="n">${r.sen}</td>
      <td class="n ${mine*2>=r.sen?'good':'bad'}">${mine}</td>
      <td style="width:110px">${bar(seatOrder().map(p=>
        [here.filter(s=>s.party===p.id).length/r.sen*100,p.color]),8)}</td></tr>`;}).join('');
  const cls=S.senCls, due=senCyc()-((S.q-1)%senCyc());
  const upFor=S.senate.filter(s=>s.cls===cls).length;
  const elders=S.senate.filter(senElder).length;

  /* Палата описывается двумя числами, а не одним: пятьдесят один
     проводит закон, шестьдесят даёт его хотя бы поставить. */
  const head=panel({cls:'info',title:'Сенат',
    meta:SEN_SEATS+' мест · большинство '+SEN_MAJ+' · клотур '+need+(nuked()?' · регламент изменён':''),
    body:`<p class="lead">Вторая палата собрана по субъектам, а не по стране: маленький край весит здесь больше.
        Но главное её правило не в подсчёте голосов, а в прениях: пока за клотур нет ${need} голосов,
        до голосования по существу дело не доходит вовсе.</p>
      ${senHemi()}
      ${senThresholds()}
      ${archLegend(senSeatsOf)}
      <div class="res"><span>У коалиции</span><b class="${senCoalSeats()>=SEN_MAJ?'good':'bad'}">${senCoalSeats()} из ${SEN_MAJ}</b>
        <span>До клотура</span><b class="${senCoalSeats()>=need?'good':'warn'}">${senCoalSeats()} из ${need}</b>
        <span>Следующее переизбрание</span><b>${quarters(due)}</b>
        <span>Пойдёт на выборы</span><b>${upFor} из ${SEN_SEATS} · класс ${QUARTERS[cls]}</b>
        <span>Старейшин в палате</span><b>${elders}</b></div>`});

  /* Председатель палаты — вице-президент. Кресло у него здесь, а не
     в разделе президента: там он гость, здесь работает. */
  const v=S.vp, vparty=vpParty(), vmine=isVP();
  const senSplit=Math.abs(senCoalSeats()-(SEN_SEATS-senCoalSeats()));
  const chair=v?panel({cls:vmine?'lead-p':'',title:'Председатель палаты',
    meta:'вице-президент · '+(vparty?vparty.name:''),
    body:`<div class="stat"><i>${vpKind().name}${v.dropped?' · сменил предшественника':''}</i>
        <div class="v" style="font-family:var(--f-display);font-size:26px;letter-spacing:0">${v.name}</div>
        <span>${vmine?'ваш человек ведёт заседания':'заседания ведёт не ваш человек'}</span></div>
      <div class="res"><span>Умение вести палату</span><b class="${v.sen>=70?'good':v.sen<40?'bad':''}">${v.sen} ${mini(v.sen)}</b>
        <span>Известность в стране</span><b>${v.pop} ${mini(v.pop)}</b>
        <span>Честолюбие</span><b class="${v.amb>=VP_AMB?'bad':''}">${Math.round(v.amb)} ${mini(v.amb)}</b>
        <span>Родом из</span><b class="w">${R(v.region||REGIONS[0].id).name}</b>
        <span>Поручение</span><b class="w">${vpJob().name}</b>
        <span>Разбито равенств</span><b>${v.ties||0}</b>
        <span>Сверх равенства уговорит</span><b>${vpMargin()?plural(vpMargin(),'голос','голоса','голосов'):'нет'}</b>
        <span>Разрыв в палате</span><b class="${senSplit<=6?'warn':''}">${senSplit}</b></div>
      <p class="hint">${senSplit<=6
        ? 'Палата расколота почти поровну: голос председателя будет звучать часто.'
        : 'Пока разрыв велик, председатель молчит — но уговаривать в кулуарах он может и без равенства.'}
        ${vpRestless()?' Дела ему не дано, и он начинает искать его сам.':''}</p>`,
    foot:vmine?`<button class="btn" onclick="askVPJob()" ${S.q-(v.jobQ||0)>=VP_TERM?'':'disabled'}>Дать поручение</button>
        <button class="btn danger" onclick="dropVP()" ${S.ap&&S.cap>=VP_DROP?'':'disabled'}>Сменить вице<span class="cost">${VP_DROP}</span></button>
        <span class="hint">${S.q-(v.jobQ||0)<VP_TERM?'поручение меняют не чаще раза в год':'замену утверждает Сенат'}</span>`
      :`<span class="hint">Председатель приходит в связке с президентом: своего сюда сажают, только выиграв президентские выборы.</span>
        <button class="btn sm" data-go="pres">К президенту</button>`})
  :panel({cls:'warn',title:'Председатель палаты',
    body:'<div class="empty">Кресло вице-президента пусто. Равенство в палате никто не разбивает — а при ста местах оно случается.</div>'});

  /* Лидер большинства ведёт календарь: он не голосует против вас,
     он просто не называет дату. */
  const lf=leadFavour();
  const lead=S.senLead?panel({cls:S.senHold?'warn':'',title:'Лидер большинства',
    meta:P(S.senLead.party).name,
    body:`<div class="res" style="margin-top:0"><span>Кто ведёт повестку</span><b class="w">${S.senLead.name}</b>
        <span>В кресле с</span><b>${shortDate(S.senLead.since)}</b>
        <span>Расположение к вам</span><b class="${lf<40?'bad':lf>=70?'good':'warn'}">${lf} ${mini(lf)}</b>
        <span>Сделок</span><b>${S.senLead.deals||0}</b></div>
      ${S.senHold?`<p class="hint"><b>Под сукном:</b> «${T(S.senHold.bill.topic).name}» — ${STEP[S.senHold.bill.stance+2]}.
          Выйдет на голосование само через ${quarters(S.senHold.left)}.</p>`
        :'<p class="hint">Кресло достаётся самому заслуженному сенатору крупнейшей фракции. Чужой лидер не отклоняет законы — он не ставит их в календарь.</p>'}`,
    foot:`<button class="btn" onclick="askLead()" ${S.ap&&S.cap>=LEAD_DEAL?'':'disabled'}>Договориться<span class="cost">${capCost(LEAD_DEAL,'lobby')}</span></button>
      ${S.senHold?`<button class="btn pri" onclick="pushCalendar()" ${S.ap&&S.cap>=LEAD_DEAL?'':'disabled'}>Вытащить проект<span class="cost">${capCost(LEAD_DEAL,'lobby')}</span></button>`:''}`}):'';

  /* Регламент: одно число, которое меняют раз в поколение. */
  const rules=panel({title:'Регламент',meta:nuked()?'изменён в '+shortDate(S.senRules.nukedQ):'в первоначальном виде',
    body:`<table class="tight"><tbody>
        <tr><td><b>Простое большинство</b><div class="sub2">чтобы принять закон</div></td><td class="n">${SEN_MAJ}</td></tr>
        <tr><td><b>Клотур</b><div class="sub2">чтобы прекратить прения и дойти до голосования</div></td>
          <td class="n ${nuked()?'warn':''}">${need}</td></tr>
        <tr><td><b>Обструкция</b><div class="sub2">столько голосов держат трибуну сколько угодно</div></td>
          <td class="n">${SEN_SEATS-need+1}</td></tr>
        <tr><td><b>Голос председателя</b><div class="sub2">при равенстве и около него</div></td>
          <td class="n">${v?'+'+(1+vpMargin()):'—'}</td></tr>
      </tbody></table>`,
    foot:canNuke()
      ? `<button class="btn danger" onclick="askNukeSolo()" ${S.cap>=NUKE_COST?'':'disabled'}>Опустить порог клотура<span class="cost">${NUKE_COST}</span></button>
         <span class="hint">навсегда и для всех, кто придёт после</span>`
      : `<span class="hint">${nuked()?'Порог уже опущен: обратного хода нет.'
          :'Менять регламент можно, имея '+NUKE_MIN+' своих в палате и своего председателя. Сейчас у коалиции '+senCoalSeats()+(isVP()?'':', и председатель не ваш')+'.'}</span>`});

  const board=b?panel({cls:'lead-p',title:'Расклад в Сенате',meta:'по проекту «'+T(b.topic).name+'»',body:
      `<div class="whip"><div><i>за</i><b class="good">${cnt.yes}</b></div><div><i>?</i><b>${tl.und}</b></div>
        <div><i>против</i><b class="bad">${cnt.no}</b></div></div>
       ${bar([[tl.yes/SEN_SEATS*100,'var(--good)'],[tl.und/SEN_SEATS*100,'var(--line)'],[tl.no/SEN_SEATS*100,'var(--bad)']],12)}
       <div class="res" style="margin-top:8px"><span>Большинство</span><b class="${cnt.yes>=SEN_MAJ?'good':'bad'}">${cnt.yes} из ${SEN_MAJ}</b>
         <span>Клотур</span><b class="${cl>=need?'good':'bad'}">${cl} из ${need}</b>
         <span>Обструкция</span><b class="${cl>=need?'good':'bad'}">${cl>=need?'не грозит':'вероятна'}</b></div>
       <p class="hint" style="margin-top:6px">${cl>=need
         ? 'Прения закроют без боя: проект дойдёт до голосования по существу.'
         : 'Голосов на закон может хватать, но до голосования не дойдёт: не хватает '+(need-cl)+' до клотура.'}</p>`,
      foot:`<button class="btn sm" data-go="bill">К проекту</button>`})
    :panel({title:'Расклад в Сенате',body:'<div class="empty">Проект не внесён — позиции сенаторов и счёт по клотуру покажутся, когда он появится.</div>'});

  return head+factionPanel('s')+senAgendaPanel()
  +`<div class="cols c21"><div>`
  +panel({title:'Сенаторы',meta:b?'по проекту «'+T(b.topic).name+'»':'сортировка: кто хуже к вам относится',flush:true,
    body:`<div style="padding:var(--x4) var(--x5);border-bottom:var(--hair-2)" class="row">${filters}
        ${tl?`<span class="dim" style="margin-left:auto;font-size:11.5px">колеблются ${tl.und}</span>`:''}</div>
      <div class="scrollx"><table><thead><tr><th>Сенатор</th><th>Фракция</th><th class="n hide-s">Сроков</th>
        <th class="n">Отношение</th><th>Позиция</th><th></th></tr></thead><tbody>${rows}</tbody>
        <caption>Показаны ${shown} из ${sens.length}. Сенатор меньше слушает фракцию и больше — свой субъект.
          Старейшина сидит четвёртый срок и тянет за собой делегацию своего края.</caption></table></div>`,
    foot:shown<sens.length?`<button class="btn sm" onclick="S.shown=${shown+40};render()">Показать ещё<span class="cost">${Math.min(40,sens.length-shown)}</span></button>`:''})
  +panel({title:'Делегации субъектов',meta:'мест в палате · из них у коалиции',flush:true,
    body:`<div class="scrollx"><table class="tight"><tbody>${byReg}</tbody></table></div>`})
  +`</div><div>`+chair+board+lead+rules+`</div></div>`;
}
/* тот же ядерный вариант, но вне спора о конкретном законе */
function askNukeSolo(){
  if(!canNuke()){toast('Для правки регламента нужны '+NUKE_MIN+' своих и свой председатель');return;}
  sheetOpen({eye:'Регламент Сената',title:'Опустить порог клотура?',
    body:`<p class="lead">Председатель ставит вопрос о толковании регламента, и палата решает его
        простым большинством. С этого дня прения прекращаются ${SEN_MAJ} голосами, а не ${cloture()}.</p>
      <div class="res"><span>У коалиции в Сенате</span><b class="good">${senCoalSeats()}</b>
        <span>Нужно</span><b>${NUKE_MIN}</b>
        <span>Председатель</span><b class="w">${S.vp?S.vp.name:'—'}</b>
        <span>Цена</span><b>вес ${NUKE_COST}</b></div>
      <p class="hint">Обратного хода нет. Правило останется и тогда, когда большинство будет чужим.</p>`,
    opts:[{label:'Опустить порог',hint:'вес '+NUKE_COST+' · навсегда',fn(){ doNuke(); render(); }},
          {label:'Не трогать регламент',hint:'закрыть',fn(){}}]});
}

/* ─── 4 · Законы ─────────────────────────────────────────────── */
/* ─── законы по направлениям ──────────────────────────────────────
   Шесть направлений — те же шесть осей, по которым расходятся партии.
   Внутри направления видно, что действует, кто это провёл и куда тянут
   соперники: решение «чем заняться» принимается здесь, а не в общем списке. */
function dirCount(ax){ return S.laws.filter(l=>T(l.topic)&&T(l.topic).ax===ax).length; }
function dirSeg(){
  const cur=S.dir||'all';
  return `<div class="seg wide"><button class="${cur==='all'?'on':''}" onclick="S.dir='all';render()">Все<u>${S.laws.length}</u></button>`+
    AXES.map(a=>`<button class="${cur===a.id?'on':''}" onclick="S.dir='${a.id}';render()">${a.name}<u>${dirCount(a.id)}</u></button>`).join('')+'</div>';
}
/* линейка: где по этой оси стоят партии и где действующий закон */
function axisRuler(ax){
  const pos=v=>((v+2)/4*100).toFixed(1);
  const laws=S.laws.filter(l=>T(l.topic)&&T(l.topic).ax===ax);
  return `<div class="ruler">
    ${S.parties.map(p=>`<i style="left:${pos(p.st[ax]||0)}%;background:${p.color}" title="${p.name}: ${r1(p.st[ax]||0)}"></i>`).join('')}
    ${laws.map(l=>`<s style="left:${pos(l.stance)}%" title="${l.name}"></s>`).join('')}</div>`;
}
function dirPanel(a){
  const topics=TOPICS.filter(t=>t.ax===a.id);
  const rows=topics.map(t=>{ const l=lawOn(t.id);
    return `<tr><td><b>${t.name}</b><div class="sub2">${t.l} ↔ ${t.r}</div></td>
      <td class="n">${l?`<b>${STEP[l.stance+2]}</b>${l.decree?' <span class="tag y">указ</span>':''}`:'<span class="dim">нет закона</span>'}</td>
      <td class="hide-s">${l?chip(P(l.by))+' <span class="dim">'+shortDate(l.q)+'</span>':''}</td>
      <td class="r"><button class="btn sm ${l?'':'pri'}" onclick="newBill('${t.id}');S.tab='bill';render()"
        ${S.bill?'disabled':''}>${l?'Переписать':'Готовить'}</button></td></tr>`;}).join('');
  const rivals=S.parties.slice().sort((x,y)=>(x.st[a.id]||0)-(y.st[a.id]||0))
    .map(p=>`<span class="chip">${emblem(p,15)}${p.short} ${sign(r1(p.st[a.id]||0))}</span>`).join('');
  return panel({title:a.name,meta:a.l+' ↔ '+a.r,flush:true,
    body:`<div style="padding:var(--x4) var(--x5) 0">${axisRuler(a.id)}
        <div class="legend" style="margin:6px 0 2px">${rivals}</div></div>
      <table class="tight"><tbody>${rows}</tbody></table>`});
}
function tabBill(){
  const b=S.bill;
  if(!b){
    const cur=S.dir||'all';
    const dirs=(cur==='all'?AXES:AXES.filter(a=>a.id===cur)).map(dirPanel).join('');
    const veto=S.vetoed?panel({cls:'warn',title:'Возвращён президентом',meta:'вето от '+shortDate(S.vetoed.q),
      body:`<p class="lead">${T(S.vetoed.bill.topic).name} — ${stanceLine(S.vetoed.bill)}</p>
        <p>Обе палаты закон приняли, подписи не будет. Собрание может настоять: нужно ${superN()} голосов из ${SEATS},
          то есть две трети, а не половина. ${S.vetoed.tries?'Попытка была одна и не удалась — осталась последняя.':'Попыток две.'}</p>
        <div class="res"><span>Было в Собрании</span><b>${S.vetoed.low.yes} : ${S.vetoed.low.no}</b>
          <span>Нужно теперь</span><b class="w">${superN()}</b>
          <span>Прогноз сейчас</span><b class="${tally(S.vetoed.bill).yes>=superN()?'good':'bad'}">${tally(S.vetoed.bill).yes}</b></div>`,
      foot:`<button class="btn pri" onclick="overrideVeto()" ${S.ap&&S.cap>=capCost(14,'veto')?'':'disabled'}>Преодолеть вето<span class="cost">${capCost(14,'veto')}</span></button>
        <button class="btn" data-go="parl">Работать с депутатами</button>`}):'';
    const decree=isPres()?panel({title:'Указ президента',meta:DECREE_COST+' веса · '+quarters(DECREE_LEN),
      body:`<p class="hint" style="margin:0">Указ обходит обе палаты, но действует ${Math.round(DECREE_POWER*100)}% силы закона
        и всего ${quarters(DECREE_LEN)}. Каждый действующий указ раздражает интеллигенцию и горожан.
        Сейчас в силе: ${activeDecrees().length}.</p>`,
      foot:`<button class="btn" onclick="askDecree()" ${S.ap&&S.cap>=DECREE_COST?'':'disabled'}>Подписать указ<span class="cost">${DECREE_COST}</span></button>`}):'';
    return veto+panel({cls:'lead-p',title:'Законы по направлениям',meta:'внесение — 1 действие и 8 веса',
      body:`<p class="hint" style="margin-top:0">Закон идёт через Собрание, Сенат и подпись президента.
        По каждой теме действует только последняя редакция: новый закон отменяет и прежний закон, и указ.</p>
        ${dirSeg()}`})+decree+dirs;
  }
  const t=T(b.topic), tl=tally(b), sl=senTally(b), vc=vetoChance(b), sum=billSum(b);
  const eff=[];
  if(sum.money)eff.push(['Бюджет каждый квартал',sign(r1(sum.money))+' млрд',sum.money>0]);
  if(sum.once)eff.push(['Разовые расходы',r1(sum.once)+' млрд',false]);
  if(sum.growth)eff.push(['Рост ВВП',sign(r2(sum.growth))+' п.п.',sum.growth>0]);
  if(sum.inf)eff.push(['Инфляция',sign(r2(sum.inf))+' п.п.',sum.inf<0]);
  if(sum.unemp)eff.push(['Безработица',sign(r2(sum.unemp*4))+' п.п.',sum.unemp<0]);
  if(sum.invest)eff.push(['Инвестиции',sign(r1(sum.invest)),sum.invest>0]);
  if(sum.unrest)eff.push(['Напряжённость',sign(r1(sum.unrest*2)),sum.unrest<0]);
  if(sum.stab)eff.push(['Устойчивость власти',sign(r1(sum.stab)),sum.stab>0]);
  const gr=Object.entries(sum.gr||{}).filter(([,v])=>Math.abs(v)>0.2).sort((a,c)=>c[1]-a[1]).map(([g,v])=>
    `<tr><td>${G(g).name}</td><td class="n ${v>0?'good':'bad'}">${sign(r1(v*1.5))}</td>
     <td class="n">${Math.round(S.mood[g])}</td></tr>`).join('');
  const byParty=S.parties.map(p=>{
    const l=tl.list.filter(x=>x.d.party===p.id), n=l.length||1;
    const y=l.filter(x=>x.st==='yes').length, no=l.filter(x=>x.st==='no').length, u=l.length-y-no;
    return `<tr><td>${chip(p)}</td><td class="n good">${y}</td><td class="n">${u}</td><td class="n bad">${no}</td>
      <td style="width:90px">${bar([[y/n*100,'var(--good)'],[u/n*100,'var(--line)'],[no/n*100,'var(--bad)']],7)}</td></tr>`;}).join('');

  return panel({cls:'lead-p',title:'Проект закона № '+(S.billNo+1),meta:t.name,body:
    `<div class="ax"><div class="axh"><span>${t.l}</span><span>${AXNAME[t.ax]}</span><span>${t.r}</span></div>
      <div class="axr">${[-2,-1,0,1,2].map(v=>
        `<button class="${b.stance===v?'on':''}" onclick="S.bill.stance=${v};render()">${STEP[v+2]}</button>`).join('')}</div>
      <div class="now">${stanceLine(b)}</div></div>
     <h3 class="sub">Поправки</h3>
     <div class="row">${RIDERS.map(rd=>{const on=b.riders.indexOf(rd.id)>=0;
       return `<button class="btn sm ${on?'sel':''}" onclick="toggleRider('${rd.id}')">${rd.name}${rd.cost?`<span class="cost">${rd.cost} млрд</span>`:''}</button>`;}).join('')}</div>
     <p class="hint" style="margin-top:6px">${b.riders.map(id=>RIDERS.find(x=>x.id===id).desc).join(' ')
       ||'Поправки покупают голоса ценой денег или силы закона.'}</p>
     ${b.riders.indexOf('money')>=0?`<div style="margin-top:8px" class="row"><span class="hint">Транш уходит в:</span>
       <select style="width:auto" onchange="S.bill.regTarget=this.value;render()">
       ${REGIONS.map(r=>`<option value="${r.id}" ${b.regTarget===r.id?'selected':''}>${r.name}</option>`).join('')}</select></div>`:''}`})
  +`<div class="cols c11"><div>`
  +panel({cls:'lead-p',title:'Путь закона',meta:'оценка секретариата',body:
    `<div class="gates">
      <div class="gate ${tl.yes>=MAJ?'ok':'no'}"><i>Народное собрание</i>
        <b class="${tl.yes>=MAJ?'good':'bad'}">${tl.yes}</b><u>нужно ${MAJ} из ${SEATS}</u>
        ${bar([[tl.yes/SEATS*100,'var(--good)'],[tl.und/SEATS*100,'var(--line)'],[tl.no/SEATS*100,'var(--bad)']],9)}
        <span class="dim">колеблются ${tl.und}</span></div>
      <div class="gate ${sl.yes>=SEN_MAJ?'ok':'no'}"><i>Сенат</i>
        <b class="${sl.yes>=SEN_MAJ?'good':'bad'}">${sl.yes}</b><u>нужно ${SEN_MAJ} из ${SEN_SEATS}</u>
        ${bar([[sl.yes/SEN_SEATS*100,'var(--good)'],[sl.und/SEN_SEATS*100,'var(--line)'],[sl.no/SEN_SEATS*100,'var(--bad)']],9)}
        <span class="dim">колеблются ${sl.und}</span></div>
      <div class="gate ${vc<0.35?'ok':'no'}"><i>Президент</i>
        <b class="${vc<0.35?'good':'bad'}">${Math.round((1-vc)*100)}%</b><u>${isPres()?'это вы':S.pres.name}</u>
        ${bar([[(1-vc)*100,'var(--good)'],[vc*100,'var(--bad)']],9)}
        <span class="dim">${isPres()?'свой закон подпишете':vetoWord(vc)}</span></div>
     </div>
     <p class="hint" style="margin:8px 0 10px">Достаточно провалиться на одной ступени, чтобы проект остановился.
       Вето снимается двумя третями Собрания — ${superN()} голосами.</p>
     <table class="tight"><thead><tr><th>Фракция</th><th class="n">За</th><th class="n">?</th><th class="n">Против</th><th></th></tr></thead>
       <tbody>${byParty}</tbody></table>`,
    foot:`<button class="btn pri" onclick="submitBill()" ${S.ap&&S.cap>=8?'':'disabled'}>Внести на голосование<span class="cost">8</span></button>
          <button class="btn" data-act="whip" ${S.ap&&S.cap>=capCost(11,'lobby')&&tl.und?'':'disabled'}>Обработать колеблющихся<span class="cost">${capCost(11,'lobby')}</span></button>
          <button class="btn danger" onclick="S.bill=null;render()">Отозвать</button>`})
  +`</div><div>`
  +panel({title:'Что изменит закон',body:
    `<table class="tight"><tbody>${eff.map(e=>
      `<tr><td>${e[0]}</td><td class="n ${e[2]?'good':'bad'}">${e[1]}</td></tr>`).join('')
      ||'<tr><td class="dim">Нейтральная редакция: ничего не меняет.</td></tr>'}</tbody></table>
     <h3 class="sub">Реакция групп</h3>
     <table class="tight"><thead><tr><th>Группа</th><th class="n">Сдвиг</th><th class="n">Сейчас</th></tr></thead>
       <tbody>${gr||'<tr><td colspan="3" class="dim">Обществу всё равно.</td></tr>'}</tbody></table>`})
  +`</div></div>`;
}
function toggleRider(id){
  const b=S.bill,i=b.riders.indexOf(id);
  if(i>=0)b.riders.splice(i,1); else b.riders.push(id);
  render();
}

/* ─── 4 · Бюджет ─────────────────────────────────────────────── */
function tabBudget(){
  if(!isPM())return panel({cls:'info',title:'Бюджет',meta:'не ваш',body:
    `<p class="lead">Казной распоряжается правительство ${P(S.gov.lead).leader}. Оппозиция видит цифры, но не двигает ставки.</p>
     <div class="res"><span>Доходы</span><b class="good">${revenue()}</b>
       <span>Расходы</span><b class="bad">−${outlay()}</b>
       <span>Проценты по долгу</span><b class="bad">−${interest()}</b>
       <span>Итог квартала</span><b class="${balance()<0?'bad':'good'}">${sign(balance())} млрд</b></div>
     <p class="hint">Чтобы вернуть бюджет себе, нужно большинство в Собрании или вотум недоверия.</p>`})+bReqPanel();
  const bal=balance();
  const bt=isPM()?budgetTally():null;
  const budgetPanel=!isPM()?'':budgetDue()&&!S.budget.submitted
    ? panel({cls:'lead-p',title:'Проект бюджета на '+budgetYear()+' год',meta:'вносится в этом квартале',body:
        `<p class="lead">Ставки и статьи ниже — и есть проект. Двигайте их, пока расклад не сойдётся: Собрание голосует за цифры, а не за намерения.</p>
         <div class="whip"><div><i>за</i><b class="good">${bt.yes}</b></div><div><i>колеблются</i><b>${bt.und}</b></div>
           <div><i>против</i><b class="bad">${bt.no}</b></div></div>
         ${bar([[bt.yes/SEATS*100,'var(--good)'],[bt.und/SEATS*100,'var(--line)'],[bt.no/SEATS*100,'var(--bad)']],12)}
         <p class="hint" style="margin-top:6px">Нужно ${MAJ} голосов. Провал откатывает бюджет к прошлогоднему и открывает дорогу вотуму недоверия${
           S.budget.fails?'; это уже второй год подряд':''}.</p>`,
        foot:`<button class="btn pri" onclick="submitBudget()" ${S.ap&&S.cap>=6?'':'disabled'}>Внести бюджет<span class="cost">6 веса</span></button>
              <button class="btn" onclick="askDeals({k:'budget'})">Договориться с фракциями</button>
              <span class="hint">1 действие</span>`})
    : panel({cls:'info',title:'Бюджетный год',meta:S.budget.submitted?'проект рассмотрен':'до защиты '+quarters(3-((S.q-S.termStart)%4)),
        body:`<p class="hint">Ставки и статьи можно менять когда угодно, но раз в год правительство защищает их в Собрании.
          ${S.lastBudget?'Последний утверждённый бюджет: налоги '+Object.values(S.lastBudget.tax).join('/')+', статьи '+Object.values(S.lastBudget.spend).join('/')+'.':''}</p>`});

  const taxRows=TAXES.map(t=>`<tr><td><b>${t.name}</b><div class="sub2">недовольны: ${t.hates.map(h=>G(h).name.toLowerCase()).join(', ')}</div></td>
    <td class="n">${r1(t.yield*(S.tax[t.id]/2)*S.econ.gdp/100)}</td>
    <td style="width:190px"><div class="steps">${[0,1,2,3,4].map(v=>
      `<button class="${S.tax[t.id]===v?'on':''}" onclick="setTax('${t.id}',${v})">${v}</button>`).join('')}</div>
      <div class="sub2">${RATE_NAME[S.tax[t.id]]}</div></td></tr>`).join('');
  const spRows=SPEND.map(s=>`<div class="bline"><div><b>${s.name}</b><div class="who">ждут: ${
      s.likes.map(h=>G(h).name.toLowerCase()).join(', ')||'—'}</div></div>
    <div class="num-s" style="text-align:right">${r1(s.base*(S.spend[s.id]/2)*(0.55+S.econ.gdp/100*0.45))}</div>
    <div><div class="steps">${[0,1,2,3,4].map(v=>
      `<button class="${S.spend[s.id]===v?'on':''}" onclick="setSpend('${s.id}',${v})">${v}</button>`).join('')}</div>
      <div class="sub2">${['нет','урезано','норма','щедро','максимум'][S.spend[s.id]]}</div></div></div>`).join('');

  return budgetPanel+bAskPanel()+`<div class="cols c11">
    ${panel({cls:'calm',title:'Доходы',meta:revenue()+' млрд за квартал',flush:true,
      body:`<table><thead><tr><th>Налог</th><th class="n">Сбор</th><th>Ставка 0—4</th></tr></thead><tbody>${taxRows}</tbody></table>`})}
    ${panel({cls:'warn',title:'Расходы',meta:outlay()+' млрд за квартал',body:spRows})}
  </div>
  <div class="cols c21">
    ${panel({title:'Динамика',meta:quarters(S.hist.length),body:
      `<div class="grid g2">${spark('gdp','var(--good)','ВВП, индекс')}${spark('inf','var(--bad)','Инфляция, %')}
        ${spark('un','#6B4A1E','Безработица, %')}${spark('debt','var(--p6)','Долг, млрд')}</div>`})}
    <div>
      ${panel({title:'Свод',body:`<div class="res" style="margin:0;border:0;padding:0">
        <span>Доходы</span><b class="good">${revenue()}</b>
        <span>в том числе сырьё</span><b class="${resIncome()<0?'bad':''}">${sign(resIncome())}</b>
        <span>Расходы</span><b class="bad">−${outlay()}</b>
        <span>Проценты по долгу</span><b class="bad">−${interest()}</b>
        <span>Итог квартала</span><b class="${bal<0?'bad':'good'}">${sign(bal)} млрд</b>
        <span>В казне</span><b>${Math.round(S.treasury)}</b>
        <span>Долг</span><b class="${S.debt>300?'bad':''}">${Math.round(S.debt)}</b></div>
        <p class="hint" style="margin-top:8px">Дефицит уходит в долг и разгоняет инфляцию. Профицит выше 90 млрд идёт на погашение.</p>`})}
      ${panel({cls:'info',title:'Конъюнктура',meta:'на это вы не влияете',body:
        gauge('фаза цикла',(cycleImpulse()+2)/4*100,cyclePhase())+
        gauge('внешний спрос',(S.world.demand-55)/87*100,Math.round(S.world.demand),S.world.demand<90?'bad':S.world.demand>110?'good':'')+
        gauge('цены на сырьё',(S.world.res-45)/123*100,Math.round(S.world.res),S.world.res<90?'bad':S.world.res>110?'good':'')+
        `<p class="hint" style="margin-top:8px">Цикл идёт сам: подъём сменяется охлаждением независимо от вашей политики.</p>`})}
    </div>
  </div>`;
}
function gauge(label,pos,val,cls){
  return `<div class="gauge"><span class="t-micro" style="width:96px;flex:none">${label}</span>
    <div class="track"><i style="left:${clamp(pos,0,99)}%"></i></div>
    <b class="num-s ${cls||''}" style="width:82px;text-align:right">${val}</b></div>`;
}
function setTax(id,v){ if(!isPM())return; S.tax[id]=v; logMsg('Ставка «'+TAXES.find(t=>t.id===id).name+'» — '+RATE_NAME[v]+'.'); render(); }
function setSpend(id,v){ if(!isPM())return;
  // социальный минимум главы 2: ниже этого уровня статью не опустить
  if(socFloor()&&(id==='soc'||id==='med')&&v<socFloor()){
    toast('Ст. 39 ч. 2: ниже уровня '+socFloor()+' эту статью опустить нельзя'); return; }
  S.spend[id]=v; logMsg('Статья «'+SPEND.find(s=>s.id===id).name+'» — уровень '+v+'.'); render(); }

/* ─── 5 · Правительство ──────────────────────────────────────── */
function tabGov(){
  const posts=POSTS.map(p=>{ const h=S.gov.posts[p.id];
    return `<tr><td><b>${p.name}</b><div class="sub2">${p.eff}</div></td>
      <td>${h?partyRow(P(h)):'<span class="dim">вакансия</span>'}</td>
      <td class="r"><button class="btn sm ${h?'':'pri'}" onclick="askPost('${p.id}')" ${S.ap&&isPM()?'':'disabled'}>${h?'Передать':'Назначить'}</button></td></tr>`;}).join('');
  const allies=coalition().filter(x=>x!==PL).map(id=>{
    const st=S.partners[id]||{anger:0}, p=P(id);
    const got=Object.values(S.gov.posts).filter(x=>x===id).length;
    return `<div class="dep"><div class="who"><b>${p.name}</b><span>${mandates(seatsOf(id))} · ${got} из ${partyPrice(id)} портфелей · расхождение ${axDist(p.st,me().st).toFixed(1)}</span></div>
      ${st.anger>=3?'<span class="tag r">на грани</span>':st.anger>=2?'<span class="tag y">недовольны</span>':'<span class="tag g">лояльны</span>'}</div>`;}).join('')
    ||'<p class="hint">Союзников нет: правительство однопартийное.</p>';
  const outside=S.parties.filter(p=>p.id!==PL&&!inCoal(p.id)).map(p=>
    `<tr><td>${partyRow(p)}</td><td class="n">${seatsOf(p.id)}</td><td class="n">${axDist(p.st,me().st).toFixed(1)}</td>
     <td>${axDist(p.st,me().st)<2.05?'<span class="tag y">сядут за стол</span>':'<span class="dim">не пойдут</span>'}</td>
     <td class="r"><button class="btn sm" data-act="talk" data-arg="${p.id}" ${S.ap&&S.cap>=5?'':'disabled'}>Переговоры<span class="cost">5</span></button></td></tr>`).join('');

  return `<div class="cols c21">
    ${panel({cls:'lead-p',title:'Портфели',meta:'отданный портфель покупает голоса фракции',flush:true,
      body:`<table><thead><tr><th>Министерство</th><th>Держит</th><th></th></tr></thead><tbody>${posts}</tbody></table>`})}
    <div>
      ${panel({cls:coalSeats()<MAJ&&isPM()?'warn':'',title:'Коалиция',meta:coalSeats()+' из '+MAJ,body:
        bar(S.parties.slice().sort((x,y)=>(inCoal(y.id)?1:0)-(inCoal(x.id)?1:0)).map(p=>
          [seatsOf(p.id)/SEATS*100,inCoal(p.id)?p.color:p.color+'70']),15)+
        '<div style="margin-top:10px">'+allies+'</div>'})}
      ${panel({title:'Устойчивость',foot:`<button class="btn" data-go="pres">К президенту</button>`,
        body:`<div class="res" style="margin:0;border:0;padding:0">
        <span>Роль</span><b class="w">${isPM()?'глава кабинета':S.role==='junior'?'младший партнёр':'оппозиция'}</b>
        <span>Возраст кабинета</span><b>${quarters(S.govAge||0)}</b>
        <span>Усталость избирателя</span><b class="${(S.fatigue||0)>6?'bad':''}">${r1(S.fatigue||0)}</b>
        <span>Вотум недоверия</span><b class="w">${S.noConfCool>0?'не раньше чем через '+S.noConfCool:'возможен'}</b>
        <span>Поручение кабинета</span><b class="w">${isPres()?'ваше':S.pres.name}</b>
        <span>Опора в Сенате</span><b class="${senCoalSeats()>=SEN_MAJ?'good':'bad'}">${senCoalSeats()} из ${SEN_MAJ}</b></div>
        <p class="hint" style="margin-top:8px">Кабинет отвечает перед Собранием, но живёт поручением президента,
          а законы проводит через Сенат. Три опоры, и ни одна не подчиняется другой.</p>`})}
    </div>
  </div>
  ${panel({title:'Фракции вне правительства',flush:true,body:
    `<table><thead><tr><th>Фракция</th><th class="n">Мандаты</th><th class="n">Расхождение</th><th>Готовность</th><th></th></tr></thead>
      <tbody>${outside||'<tr><td class="dim">Все фракции в коалиции.</td></tr>'}</tbody>
      <caption>Расхождение выше 2,0 — партия не сядет за стол ни за какие портфели.</caption></table>`})}`;
}
function askPost(post){
  sheetOpen({eye:'Кадровое решение · 1 действие',title:POSTS.find(p=>p.id===post).name,
    body:'<p class="lead">Портфель чужой фракции покупает её голоса и терпение. Свой человек надёжнее, но ничего не приносит сверх работы министерства.</p>',
    opts:S.parties.map(p=>({label:p.name+(p.id===PL?' (своя фракция)':''),
      hint:p.id===PL?'без политической цены':mandates(seatsOf(p.id))+' · расхождение '+axDist(p.st,me().st).toFixed(1),
      fn:()=>offerPost(p.id,post)}))});
}

/* ─── 7 · Премьер-министр ────────────────────────────────────────
   Кресло, которое отвечает перед Собранием. Здесь не коалиционная
   арифметика — она рядом, во «Правительстве», — а работа кабинета:
   кто именно сидит в министерствах и что это даёт стране. */
function tabPM(){
  const p=S.pm, mine=isPM(), power=cabinetPower();
  const tired=POSTS.filter(x=>S.q-minOf(x.id).since>MIN_TERM);
  const rows=POSTS.map(x=>{ const m=minOf(x.id), pw=minPower(x.id), old=S.q-m.since>MIN_TERM;
    return `<tr><td><b>${m.name}</b><div class="sub2">${x.name} · ${x.eff}</div></td>
      <td>${chip(P(m.party))}</td>
      <td class="n ${m.comp<40?'bad':m.comp>=72?'good':''}">${m.comp}</td>
      <td class="hide-s dim">${old?'<span class="tag y">засиделся</span>':quarters(S.q-m.since)}</td>
      <td class="n ${pw<0?'bad':'good'}">${sign(Math.round(pw*100))}%</td>
      <td class="r"><button class="btn sm" onclick="askMinister('${x.id}')" ${S.ap&&mine?'':'disabled'}>Кресло</button></td></tr>`;}).join('');
  const best=POSTS.slice().sort((a,b)=>minOf(b.id).comp-minOf(a.id).comp)[0];
  const worst=POSTS.slice().sort((a,b)=>minOf(a.id).comp-minOf(b.id).comp)[0];

  return panel({cls:mine?'lead-p':'info',title:mine?'Правительство под вашим началом':'Кабинет ведёт не ваша партия',
    meta:'мандат от Собрания',body:
    `<div class="cols c12"><div>
      <div class="stat"><i>${P(p.party).name}</i><div class="v" style="font-family:var(--f-display);font-size:23px;letter-spacing:0">${p.name}</div>
        <span>премьер-министр · ${quarters(S.q-p.since)} в должности</span></div>
     </div><div>
      <div class="res" style="margin:0">
        <span>Сила кабинета</span><b class="${power<0?'bad':'good'}">${sign(Math.round(power*100))}%</b>
        <span>Опора в Собрании</span><b class="${coalSeats()>=MAJ?'good':'bad'}">${coalSeats()} · нужно ${MAJ}</b>
        <span>Опора в Сенате</span><b class="${senCoalSeats()>=SEN_MAJ?'good':'bad'}">${senCoalSeats()} · нужно ${SEN_MAJ}</b>
        <span>Перестановок</span><b>${p.reshuffles||0}</b>
        <span>Вотум недоверия</span><b class="w">${S.noConfCool>0?'не раньше чем через '+S.noConfCool:'возможен'}</b></div>
      <p class="hint">Сила кабинета — среднее по шести ведомствам. Она не политика, а качество работы:
        сильный министр вытягивает свою статью, слабый тянет вниз даже при верной программе.</p>
     </div></div>`})
  +panel({title:'Министры',meta:mine?'перестановка — '+PM_COST+' веса':'кресла не ваши',flush:true,
    body:`<div class="scrollx"><table><thead><tr><th>Министр</th><th>Фракция</th><th class="n">Компет.</th>
      <th class="hide-s">В должности</th><th class="n">Вклад</th><th></th></tr></thead><tbody>${rows}</tbody>
      <caption>Партия портфеля — это коалиция; человек в кресле — это работа ведомства. Заменить министра
        можно, не трогая расклад: та же фракция, другое лицо. После ${quarters(MIN_TERM)} в должности
        министр начинает выдыхаться.</caption></table></div>`})
  +`<div class="cols c11"><div>`
  +panel({cls:tired.length?'warn':'',title:'Что требует внимания',body:
    tired.length
      ? `<p class="lead">Засиделись: ${tired.map(x=>x.name.toLowerCase()).join(', ')}.</p>
         <p>Каждое такое кресло отнимает у ведомства шесть процентов отдачи. Перестановка возвращает их
            и обычно приводит человека сильнее — но фракция, чей министр ушёл, это заметит.</p>`
      : `<p class="lead">Кабинет свежий: никто не пересидел срок.</p>
         <p class="hint">Присматривайте за компетентностью: она важнее партийной принадлежности
            там, где нужен результат, а не голоса.</p>`,
    foot:tired.length&&mine?`<button class="btn pri" onclick="askMinister('${tired[0].id}')" ${S.ap&&S.cap>=PM_COST?'':'disabled'}>Заняться креслом<span class="cost">${PM_COST}</span></button>`:''})
  +`</div><div>`
  +panel({title:'Сильное и слабое звено',body:
    `<div class="dep"><div class="who"><b>${minOf(best.id).name}</b>
        <span>${best.name} · ${minWord(minOf(best.id))}</span></div>
       <b class="num-s good">${minOf(best.id).comp}</b></div>
     <div class="dep"><div class="who"><b>${minOf(worst.id).name}</b>
        <span>${worst.name} · ${minWord(minOf(worst.id))}</span></div>
       <b class="num-s bad">${minOf(worst.id).comp}</b></div>
     <p class="hint" style="margin-top:8px">Министр финансов прямо меняет сборы, остальные — свои статьи
       и настроение групп, которые за ними следят.</p>`,
    foot:`<button class="btn" data-go="gov">К коалиции и портфелям</button>`})
  +`</div></div>`;
}

/* ─── 8 · Президент ──────────────────────────────────────────────
   Отдельная власть с отдельным сроком: подписывает или заворачивает
   законы, поручает кабинет, распускает Собрание, правит указами.
   Вкладка живая и когда кресло чужое — тогда это карточка соперника. */
function tabPres(){
  const p=presParty(), mine=isPres(), gap=presGap();
  const v=S.vp, vparty=vpParty(), vmine=isVP();
  const dec=activeDecrees();
  const relWord=x=>x>=70?'союзник':x>=52?'работает с вами':x>=34?'холодно':x>=18?'противостояние':'открытая война';

  /* два кресла рядом: избирались одним списком, полномочия разные */
  const ticket=panel({cls:mine?'lead-p':'info',title:mine?'Президент — это вы':'Глава государства',
    meta:'полномочия до: '+dateLabel(S.pres.until),body:
    `<div class="cols c11"><div>
      <div class="stat"><i>${p.name}${S.pres.succeeded?' · принял полномочия досрочно':''}</i>
        <div class="v" style="font-family:var(--f-display);font-size:26px;letter-spacing:0">${S.pres.name}</div>
        <span>${mine?'ваш мандат — от всей страны':'мандат от всей страны, не от Собрания'}</span></div>
     </div><div>
      <div class="stat"><i>${vparty?vparty.name:''} · вице-президент</i>
        <div class="v" style="font-family:var(--f-display);font-size:26px;letter-spacing:0">${v?v.name:'—'}</div>
        <span>${vmine?'ваш человек председательствует в Сенате':'председательствует в Сенате'}</span></div>
     </div></div>
     <div class="res">
       <span>Осталось в кресле</span><b>${quarters(presLeft())}</b>
       <span>Срок подряд</span><b class="${S.pres.term>=2?'warn':''}">${S.pres.term} из 2${S.pres.term>=2?' · предел':''}</b>
       <span>Наложено вето</span><b class="${S.pres.vetoes?'bad':''}">${S.pres.vetoes}</b>
       <span>Указов подписано</span><b>${S.pres.decrees}</b>
       <span>Равенств разбито в Сенате</span><b>${v?v.ties||0:0}</b>
       ${mine?'':`<span>Отношения с вами</span><b class="${S.presRel<34?'bad':S.presRel>=52?'good':'warn'}">${Math.round(S.presRel)} · ${relWord(S.presRel)}</b>
       <span>Расхождение с кабинетом</span><b class="${gap>2?'bad':''}">${gap.toFixed(1)}</b>`}</div>`});

  const powers=panel({title:'Кто что может',flush:true,
    body:`<table class="tight"><thead><tr><th>Полномочие</th><th>Кресло</th><th class="r">У вас</th></tr></thead><tbody>
      <tr><td><b>Подпись и вето</b><div class="sub2">закон, прошедший обе палаты, вступает в силу только с подписью</div></td>
        <td class="dim">президент</td><td class="r">${mine?'<span class="tag g">да</span>':'<span class="tag r">нет</span>'}</td></tr>
      <tr><td><b>Поручение кабинета</b><div class="sub2">после выборов решает, кто собирает правительство</div></td>
        <td class="dim">президент</td><td class="r">${mine?'<span class="tag g">да</span>':'<span class="tag r">нет</span>'}</td></tr>
      <tr><td><b>Роспуск Собрания</b><div class="sub2">досрочные выборы без предвыборного штаба</div></td>
        <td class="dim">президент</td><td class="r">${mine?'<span class="tag g">да</span>':'<span class="tag r">нет</span>'}</td></tr>
      <tr><td><b>Указ</b><div class="sub2">${Math.round(DECREE_POWER*100)}% силы закона на ${quarters(DECREE_LEN)}, мимо палат</div></td>
        <td class="dim">президент</td><td class="r">${mine?'<span class="tag g">да</span>':'<span class="tag r">нет</span>'}</td></tr>
      <tr><td><b>Решающий голос в Сенате</b><div class="sub2">равенство разбивает председатель палаты${v&&vpMargin()?', а счёт в '+vpMargin()+' голоса он ещё и уговаривает':''}</div></td>
        <td class="dim">вице-президент</td><td class="r">${vmine?'<span class="tag g">да</span>':'<span class="tag r">нет</span>'}</td></tr>
      <tr><td><b>Порученное дело</b><div class="sub2">палата, объезд субъектов, представительство вовне или партия</div></td>
        <td class="dim">вице-президент</td><td class="r">${vmine?'<span class="tag g">да</span>':'<span class="tag r">нет</span>'}</td></tr>
      <tr><td><b>Наследование кресла</b><div class="sub2">если президент уходит досрочно, срок доводит вице</div></td>
        <td class="dim">вице-президент</td><td class="r">${vmine?'<span class="tag g">да</span>':'<span class="tag r">нет</span>'}</td></tr>
      </tbody></table>`,
    foot:mine?`<button class="btn" onclick="askDecree()" ${S.ap&&S.cap>=DECREE_COST?'':'disabled'}>Подписать указ<span class="cost">${DECREE_COST}</span></button>
        <button class="btn danger" onclick="callSnapElection()" ${canDissolve()&&(S.govAge||0)>=4&&!S.camp?'':'disabled'}>Распустить Собрание<span class="cost">25</span></button>
        <span class="hint">${(S.govAge||0)<4?'роспуск — не раньше пятого квартала кабинета':'выборы пройдут сразу, без штаба'}</span>`
      :`<span class="hint">Кресло берут на выборах: ${presLeft()?'они пройдут через '+quarters(presLeft()):'они уже в этом квартале'}.
        Вице идёт тем же списком, поэтому выигрываются оба кресла разом.</span>`});

  const decRows=dec.map(l=>`<tr><td><b>${l.name}</b><div class="sub2">${AXNAME[T(l.topic).ax]} · ${STEP[l.stance+2]}</div></td>
      <td class="n">до ${dateLabel(l.until)}</td><td class="r"><span class="tag y">указ</span></td></tr>`).join('')
    ||'<tr><td colspan="3" class="dim">Указов в силе нет: страна живёт по законам.</td></tr>';

  const vetoP=S.vetoed?panel({cls:'warn',title:'Закон на возврате',
    body:`<p class="lead">${T(S.vetoed.bill.topic).name} — ${stanceLine(S.vetoed.bill)}</p>
      <p>Прошёл обе палаты и завернут президентом. Настоять можно только двумя третями Собрания: ${superN()} из ${SEATS}.</p>`,
    foot:`<button class="btn pri" onclick="overrideVeto()" ${S.ap&&S.cap>=capCost(14,'veto')?'':'disabled'}>Преодолеть вето<span class="cost">${capCost(14,'veto')}</span></button>
      <button class="btn" data-go="bill">К законам</button>`}):'';

  /* Второе кресло описано в разделе Сената — там оно и работает.
     Здесь остаётся только связка: кто идёт вторым номером и что будет,
     если первый номер уйдёт раньше срока. */
  const senSplit=Math.abs(senCoalSeats()-(SEN_SEATS-senCoalSeats()));
  const vpPanel=panel({cls:vpRestless()?'warn':'',title:'Второй номер списка',
    meta:v?vpKind().name:'кресло пусто',
    body:v?`<div class="res" style="margin-top:0"><span>Кто</span><b class="w">${v.name}</b>
        <span>Партия</span><b class="w">${vparty?vparty.name:'—'}</b>
        <span>Умение вести палату</span><b class="${v.sen>=70?'good':v.sen<40?'bad':''}">${v.sen}</b>
        <span>Известность</span><b>${v.pop}</b>
        <span>Честолюбие</span><b class="${v.amb>=VP_AMB?'bad':''}">${Math.round(v.amb)}</b>
        <span>Поручение</span><b class="w">${vpJob().name}</b>
        <span>Разбито равенств</span><b>${v.ties||0}</b>
        <span>Разрыв в Сенате</span><b class="${senSplit<=6?'warn':''}">${senSplit}</b></div>
      <p class="hint">${vpRestless()
        ? 'Ему нечего делать, а честолюбия хватает на двоих: рано или поздно он заговорит сам.'
        : 'Идёт с президентом одним списком, председательствует в Сенате и наследует кресло, если оно освободится.'}
        Работа с ним — в разделе Сената.</p>`
      :'<div class="empty">Кресло вице-президента пусто: наследовать полномочия некому.</div>',
    foot:`<button class="btn" data-go="senate">К Сенату</button>
      ${isPres()&&v?`<button class="btn" onclick="askReplaceVP()" ${S.ap&&S.cap>=10?'':'disabled'}>Сменить вице<span class="cost">ход · 10 веса</span></button>`:''}
      ${mySeat()==='vp'?`<button class="btn danger" onclick="askResign()">Уйти в отставку</button>`:''}`});

  const race=panel({title:'Как выбирают главу государства',
    body:`<p class="hint" style="margin:0">Всенародно, в два тура, раз в ${quarters(pTerm())} — по своим часам,
      не совпадающим с созывом Собрания (${quarters(aTerm())}). Президент и вице идут одним списком: голосуют
      за пару, а не за человека. Если в первом туре никто не берёт половину, во второй выходят двое,
      а голоса выбывших расходятся по близости взглядов. Партия, не дошедшая до второго тура, решает,
      кого поддержать. Два срока подряд — предел для человека, но не для партии: она выставляет новое лицо.</p>`});

  return presRacePanel()+ticket+vetoP+`<div class="cols c11"><div>`+powers+`</div><div>`+vpPanel
    +panel({title:'Указы в силе',meta:'закон Собрания отменяет указ',flush:true,
      body:`<table class="tight"><tbody>${decRows}</tbody></table>`})
    +race+`</div></div>`;
}

/* ─── Печать ─────────────────────────────────────────────────────
   Первая полоса номера: что вышло об этом квартале и в каком тоне.
   Тон печати умножает всё, что страна о вас узнаёт. */
/* ─── скандалы и капитал ──────────────────────────────────────────
   Скандал виден температурой: пока она высока, он каждый квартал
   отнимает одобрение и честность. Капитал виден климатом. */
function scandalPanel(){
  const L=scLive();
  const rows=L.map(x=>{ const mine=x.who==='you', p=mine?null:P(x.who);
    return `<tr><td><b>${x.title}</b><div class="sub2">${mine?'против вас':'«'+p.short+'»'} · с ${shortDate(x.q)}${mine&&x.resp?' · ваш ответ: '+({deny:'отрицать',sorry:'извинение',scape:'сдан помощник',agenda:'смена повестки',sue:'суд',none:'молчание'}[x.resp]||''):''}</div></td>
      <td style="width:110px">${bar([[x.heat,mine?'var(--bad)':'var(--ink-3)']],8)}</td>
      <td class="n ${mine&&x.heat>=50?'bad':''}">${Math.round(x.heat)}</td>
      <td class="r">${mine?`<button class="btn sm ${x.resp?'':'pri'}" onclick="askScandal(${x.id})">${x.resp?'Сменить тактику':'Ответить'}</button>`:''}</td></tr>`; }).join('');
  return panel({cls:scMine().some(x=>x.heat>=50)?'warn':'',title:'Скандалы',meta:L.length?scMine().length+' против вас · '+(L.length-scMine().length)+' у соперников':'тихо',
    body:L.length?`<table class="tight"><tbody>${rows}</tbody><caption>Температура — сколько о скандале пишут. Враждебная печать её разогревает,
      извинение и отставка — остужают. Отрицание дёшево, пока документов мало.</caption></table>`
      :'<div class="empty">Скандалов нет. Утечки растут из следа сделок, конвертов и чужих денег в кассе.</div>',
    foot:`<button class="btn" onclick="askDirt()" ${S.ap&&S.cap>=PRESS_LEAK?'':'disabled'}>Компромат на соперника<span class="cost">ход · ${PRESS_LEAK} веса</span></button>`});
}
function bizPanel(){
  const c=bizClimate(), log=(S.bizLog||[]).slice(0,6);
  return panel({cls:c<35?'warn':'lead-p',title:'Деловой климат',meta:bizWord(c),
    body:`<div class="grid g4">
        ${stat('Климат',c,bizWord(c),c<35?'alert':'')}
        ${stat('К инвестициям',sign(r1((c-50)*0.22)),'в квартал к цели')}
        ${stat('Инвестиции',Math.round(S.econ.invest),'индекс')}
        ${stat('Захват',captureLevel(),captureWord(captureLevel()),captureLevel()>CAP_HIGH?'alert':'')}</div>
      ${log.length?'<h3 class="sub">Что делает капитал</h3><div class="log">'+log.map(x=>`<div class="${x.k==='b'?'key':''}"><s>${shortDate(x.q)}</s>${x.t}</div>`).join('')+'</div>'
        :'<p class="hint">Довольный капитал открывает заводы в краях, обиженный — сокращает людей и выводит деньги. Каждый закон по их теме они встречают заявлением.</p>'}`,
    foot:`<button class="btn" onclick="bizCouncil()" ${S.ap&&S.cap>=6?'':'disabled'}>Деловой совет<span class="cost">ход · 6 веса</span></button>
      <button class="btn" onclick="askProject()" ${S.ap&&S.cap>=8?'':'disabled'}>Попросить проект в край<span class="cost">ход · 8 веса</span></button>`});
}

function tabPress(){
  const tone=pressTone(), free=pressFree();
  const heads=(S.press.heads||[]).slice(0,14).map(h=>{
    const o=PRS(h.o);
    return `<div class="head ${h.k}"><s>${shortDate(h.q)}</s>
      <div><b>${h.t}</b><span>${o.name}</span></div></div>`;}).join('')
    ||'<div class="dim" style="padding:var(--x5)">Пока о вас не писали.</div>';
  const rows=PRESS.map(o=>{const st=pressOf(o.id);
    return `<tr class="${st.banned?'dim':''}"><td><b>${o.name}</b><div class="sub2">${o.kind}${pressOwner(o.id)?' · владелец '+pressOwner(o.id).name:' · независимая'} · читают ${
      o.base.map(g=>G(g).name.toLowerCase()).join(', ')}</div></td>
      <td class="n">${Math.round(o.reach*100)}%</td>
      <td class="n ${st.rel<36?'bad':st.rel>=60?'good':''}">${Math.round(st.rel)}</td>
      <td class="hide-s dim">${st.banned?'<span class="tag r">отлучено</span>':pressWord(st.rel-50)}</td>
      <td style="width:96px">${bar([[st.rel,st.rel<40?'var(--bad)':'var(--good)']],8)}</td></tr>`;}).join('');

  return scandalPanel()+panel({cls:tone<-14?'warn':'lead-p',title:'Первая полоса',meta:dateLabel(),body:
    `<div class="cols c12"><div>
      <div class="stat ${tone<0?'alert':''}"><i>тон печати</i><div class="v">${sign(Math.round(tone))}</div>
        <span>${pressWord(tone)}</span></div>
     </div><div>
      <p class="lead">Печать стоит между вашим решением и тем, что о нём подумают. Доброжелательная
        удваивает хорошую новость и глушит плохую, враждебная делает обратное.</p>
      <div class="res" style="margin-bottom:0"><span>Множитель к хорошим новостям</span><b>×${r2(pressMul(1))}</b>
        <span>Множитель к плохим</span><b>×${r2(pressMul(-1))}</b>
        <span>Доверие к печати</span><b>${Math.round(pressTrust()*100)}%</b>
        <span>Закон о печати</span><b class="w">${free>0?'независимая':free<0?'под надзором':'не принят'}</b></div>
     </div></div>`,
    foot:`<button class="btn pri" onclick="askPress()" ${S.ap?'':'disabled'}>Работать с печатью</button>
      <span class="hint">${free<0
        ? 'Под надзором издания сговорчивее, но им меньше верят — множитель слабеет в обе стороны.'
        : 'Чем свободнее печать, тем сильнее её слово — и в вашу пользу, и против вас.'}</span>`})
  +`<div class="cols c21"><div>`
  +panel({title:'Что вышло',meta:'последние номера',flush:true,body:`<div class="heads">${heads}</div>`})
  +`</div><div>`
  +panel({title:'Издания',flush:true,body:
    `<div class="scrollx"><table class="tight"><thead><tr><th>Издание</th><th class="n">Охват</th>
      <th class="n">К вам</th><th class="hide-s">Тон</th><th></th></tr></thead><tbody>${rows}</tbody>
      <caption>Охват — доля аудитории; суммы больше сотни, потому что люди читают не по одному изданию.
        Каждое двигает своих читателей, а не страну целиком.</caption></table></div>`})
  +`</div></div>`;
}

/* ─── Суд и надзор ───────────────────────────────────────────────
   Четвёртая власть по счёту и первая по сроку: судьи сидят дольше
   любого президента. Рядом — прокуратура, которая помнит сделки. */
function tabCourt(){
  const free=courtFree(), byMe=courtSeats(PL);
  const judges=S.court.slice().sort((a,b)=>a.until-b.until).map(j=>
    `<tr><td><b>${j.name}</b><div class="sub2">назначен ${shortDate(j.since)} · ${P(j.by).name}</div></td>
      <td>${chip(P(j.by))}</td>
      <td class="n hide-s">${quarters(Math.max(0,j.until-S.q))}</td>
      <td class="dim">${AXES.slice(0,3).map(a=>a.name[0]+(j.st[a.id]>0?'+':'')+r1(j.st[a.id])).join(' ')}</td></tr>`).join('');
  const laws=S.laws.filter(l=>T(l.topic)).slice().sort((a,b)=>courtStrike(b)-courtStrike(a)).slice(0,6).map(l=>{
    const n=courtStrike(l);
    return `<tr><td><b>${l.name}</b><div class="sub2">${P(l.by).short} · ${STEP[l.stance+2]}${l.decree?' · указ':''}${
      l.ref?' · референдум':''}</div></td>
      <td class="n ${n>=COURT_MAJ?'bad':''}">${n}</td>
      <td class="r">${l.ref?'<span class="tag y">защищён</span>':
        `<button class="btn sm" onclick="petition('${l.topic}')" ${S.ap&&S.cap>=PETITION?'':'disabled'}>Оспорить</button>`}</td></tr>`;}).join('')
    ||'<tr><td colspan="3" class="dim">Действующих законов нет.</td></tr>';
  const pr=S.probe;

  return panel({cls:'lead-p',title:'Конституционный суд',meta:courtN()+' судей · нужно '+courtMaj()+' для отмены',body:
    `<div class="cols c12"><div>
      <div class="stat"><i>назначено вами</i><div class="v">${byMe}<u>из ${courtN()}</u></div>
        <span>${byMe>=courtMaj()?'суд ваш надолго':'состав вам не подчиняется'}</span></div>
     </div><div>
      <p class="lead">Судья садится на ${quarters(judgeLife())} — дольше, чем правит любой президент.
        Кресло освобождается редко, назначает президент, утверждает Сенат. Поэтому состав суда — это
        наследство, а не текущая политика.</p>
      <div class="res" style="margin-bottom:0"><span>Независимость</span>
        <b class="w">${free>0?'высокая':free<0?'низкая':'обычная'}</b>
        <span>Указов под ударом</span><b class="${activeDecrees().length?'warn':''}">${activeDecrees().length}</b>
        <span>Ближайшая вакансия</span><b>${quarters(Math.max(0,Math.min(...S.court.map(j=>j.until))-S.q))}</b></div>
     </div></div>`,
    foot:`<button class="btn" onclick="askPetition()" ${S.ap&&S.cap>=PETITION?'':'disabled'}>Запрос в суд<span class="cost">${PETITION}</span></button>
      <span class="hint">Суд смотрит не на пользу закона, а на то, как далеко он зашёл. Указы отменяют охотнее.</span>`})
  +`<div class="cols c11"><div>`
  +panel({title:'Судьи',meta:'по сроку',flush:true,
    body:`<div class="scrollx"><table class="tight"><thead><tr><th>Судья</th><th>Кем назначен</th>
      <th class="n hide-s">Осталось</th><th>Взгляды</th></tr></thead><tbody>${judges}</tbody></table></div>`})
  +`</div><div>`
  +panel({cls:pr?'warn':'',title:'Надзор',meta:'след от сделок',body:
    `<div class="res" style="margin-top:0"><span>След</span>
       <b class="${trail()>55?'bad':trail()<20?'good':'warn'}">${Math.round(trail())} · ${trailWord()}</b>
       <span>Независимость прокуратуры</span><b>${r1(prosFree())}</b>
       <span>Риск дела за квартал</span><b class="${probeRisk()>0.2?'bad':''}">${Math.round(probeRisk()*100)}%</b>
       ${pr?`<span>Идёт дело</span><b class="w">${caseWho(pr)}</b>
       <span>Улики</span><b class="${pr.ev>=50?'bad':''}">${pr.ev} · ${caseWord(pr.ev)}</b>`:''}</div>
     ${pr?`<div class="case-steps">${CASE_ST.map((s,k)=>`<span class="${k<caseIdx(pr)?'done':k===caseIdx(pr)?'on':''}">${s.name}</span>`).join('')}</div>`:''}
     <p class="hint">След копится от каждой сделки: стройка в округе, нажим на депутата, утечка,
       отставка главы края. Честного собеседника след стоит дороже — он скорее заговорит.</p>
     ${(S.trailLog||[]).slice(0,5).map(x=>
       `<div class="crow"><s>${shortDate(x.q)}</s><span>${x.t} <b class="num-s bad">+${x.v}</b></span></div>`).join('')}`,
    foot:pr?`<button class="btn danger" onclick="askCase()">Дело: ${caseSt(pr).name.toLowerCase()}</button>
      <span class="hint">Давить, нанять адвокатов, сдать фигуранта, кричать о преследовании — у каждого шага своя цена.</span>`:''})
  +rcasePanel()
  +panel({title:'Под ударом',meta:'прогноз голосов за отмену',flush:true,
    body:`<table class="tight"><tbody>${laws}</tbody></table>`})
  +`</div></div>`
  +inqPanel();
}

/* ─── следственная комиссия и импичмент ──────────────────────────
   Палата умеет не только принимать законы. Комиссия копает
   четыре квартала, обвинение выдвигают внизу, судят наверху. */
function inqPanel(){
  const i=S.inq, im=S.imp;
  const box=i?panel({cls:i.kind==='you'?'warn':'',title:'Следственная комиссия',
    meta:i.kind==='you'?'по вашим делам':'созвана '+shortDate(i.q),
    body:`<div class="res" style="margin-top:0">
        <span>Кого разбирают</span><b class="w">${inqTarget()}</b>
        <span>Кто созвал</span><b class="w">${P(i.by)?P(i.by).name:'палата'}</b>
        <span>Улик собрано</span><b class="${i.ev>=62?(i.kind==='you'?'bad':'good'):''}">${Math.round(i.ev)} · ${inqWord(i.ev)}</b>
        <span>Осталось работать</span><b>${quarters(i.left)}</b>
        <span>Утечек по ходу</span><b>${i.leaks}</b></div>
      ${bar([[i.ev,i.kind==='you'?'var(--bad)':'var(--ink-2)']],10)}
      <p class="hint">${i.kind==='you'
        ? 'Помешать комиссии нельзя. Можно чистить хвосты, пока она копает: след, который она найдёт, — тот, что есть сегодня.'
        : 'Выводы зачитают с трибуны. Полный состав открывает дорогу отставке или импичменту, пустой — бьёт по тому, кто созывал.'}</p>`})
    :panel({title:'Следственная комиссия',
      body:'<div class="empty">Комиссий не работает. Созвать можно одну — против министра, главы края, президента или корпорации.</div>',
      foot:`<button class="btn" onclick="askInquiry()" ${S.ap&&S.cap>=INQ_CAP?'':'disabled'}>Созвать комиссию<span class="cost">${INQ_CAP}</span></button>
        <span class="hint">Работает ${quarters(INQ_LEN)}. Пустые выводы стоят дороже, чем несозванная комиссия.</span>`});

  const impBox=panel({cls:im?'warn':'',title:'Импичмент',
    meta:'Собрание '+impH()+' · Сенат '+impS(),
    body:`<table class="tight"><tbody>
        <tr><td><b>Обвинение</b><div class="sub2">выдвигает нижняя палата</div></td>
          <td class="n">${impH()} из ${SEATS}</td></tr>
        <tr><td><b>Отрешение</b><div class="sub2">судит верхняя, две трети</div></td>
          <td class="n">${impS()} из ${SEN_SEATS}</td></tr>
        <tr><td><b>Материалы комиссии</b><div class="sub2">прибавляют голосов в обеих палатах</div></td>
          <td class="n ${S.impReady?'good':'dim'}">${S.impReady?'на руках':'нет'}</td></tr>
        <tr><td><b>Провал</b><div class="sub2">укрепляет того, против кого он был</div></td>
          <td class="n bad">−14 веса</td></tr>
      </tbody></table>
      ${isPres()?`<p class="hint">Вы президент — значит обвинение могут внести и против вас.
        Оппозиция держит ${SEATS-coalSeats()} мандатов при нужных ${impH()}.</p>`:''}`,
    foot:`<button class="btn danger" onclick="askImpeach()" ${S.ap&&S.cap>=IMP_CAP&&!S.imp?'':'disabled'}>Внести обвинение<span class="cost">${IMP_CAP}</span></button>`});

  return `<div class="cols c11"><div>`+box+`</div><div>`+impBox+`</div></div>`;
}

/* ─── Партия ─────────────────────────────────────────────────────
   Своя фракция не монолит: у неё есть крылья, и они расходятся
   с лидером по той оси, где расхождение больше всего. */
function tabParty(){
  const w=wings(), c=S.challenge, p=me();
  const wingRow=(k,list)=>{
    const m=wingMood(list);
    return `<tr class="${c&&c.wing===k?'sel':''}"><td><b>${WINGNAME[k][0].toUpperCase()+WINGNAME[k].slice(1)}</b>
      <div class="sub2">${list.length?'средняя позиция '+sign(r1(list.reduce((s,d)=>s+d.st[w.ax],0)/list.length)):'пусто'}</div></td>
      <td class="n">${list.length}</td>
      <td class="n ${m<40?'bad':m>=58?'good':''}">${m}</td>
      <td style="width:110px">${bar([[m,m<40?'var(--bad)':'var(--good)']],8)}</td></tr>`;};
  const axr=AXES.map(a=>`<div class="ax"><div class="axh"><span>${a.l}</span><span>${a.name}${
      a.id===w.ax?' · ось спора':''}</span><span>${a.r}</span></div>
    <div class="axr">${[-2,-1,0,1,2].map(v=>
      `<button class="${Math.round(p.st[a.id])===v?'on':''}" onclick="moveAxis('${a.id}',${v})">${STEP[v+2]}</button>`).join('')}</div>
    </div>`).join('');

  const chal=c?panel({cls:'warn',title:'Вызов лидерству',meta:'решится через '+quarters(c.left),body:
    `<p class="lead">${c.name} собрал подписи ${WINGNAME[c.wing]} и предлагает себя вместо вас.
      Спор идёт по оси «${AXNAME[c.ax]}».</p>
     <div class="res"><span>Настроение крыла</span><b class="bad">${wingMood(w[c.wing])}</b>
       <span>Депутатов в крыле</span><b>${w[c.wing].length}</b>
       <span>Ваше одобрение</span><b class="${approval()<44?'bad':''}">${Math.round(approval())}%</b>
       <span>Ваша твёрдость</span><b>${Math.round(rep('firm'))}</b></div>
     <p class="hint">Проигрыш не снимает вас с поста, но часть крыла уйдёт вместе с мандатами.</p>`,
    foot:`<button class="btn pri" onclick="yieldWing()" ${S.ap&&S.cap>=8?'':'disabled'}>Уступить крылу<span class="cost">8</span></button>
      <button class="btn" data-go="parl">Работать с депутатами</button>`}):'';

  // эмблемы всех партий Новарии — одной строкой, своя первой
  const embRow=`<div class="emb-row">${[p,...S.parties.filter(x=>x.id!==PL)].map(x=>
      `<span class="${x.id===PL?'on':''}">${emblem(x,x.id===PL?46:34)}<b>${x.short}</b><u>${seatsOf(x.id)}</u></span>`).join('')}</div>`;
  return chal+leadPanel()+panel({cls:'lead-p',title:'«'+p.name+'» изнутри',meta:mandates(seatsOf(PL)),body:
    `<div class="cols c12"><div>
      <div class="emb-card">${emblem(p,96)}
        <div><b>${p.name}</b><span>${p.short} · ${mandates(seatsOf(PL))}</span>
          <button class="btn sm" onclick="askEmblem()">Изменить эмблему</button></div></div>
      <div class="stat"><i>ось расхождения</i><div class="v" style="font-family:var(--f-display);font-size:24px;letter-spacing:0">${AXNAME[w.ax]}</div>
        <span>по ней фракция расходится сильнее всего</span></div>
     </div><div>
      <p class="lead">Сто с лишним мандатов — не один человек. Депутаты стоят левее и правее вашей линии,
        и когда линия уезжает, оставленное крыло начинает роптать.</p>
      <div class="res" style="margin-bottom:0"><span>Партийная касса</span><b>${Math.round(S.funds)} млн</b>
        <span>Средняя дисциплина</span><b>${Math.round(S.deputies.filter(d=>d.party===PL)
          .reduce((s,d)=>s+d.loyal,0)/Math.max(1,seatsOf(PL)))}</b>
        <span>Мест в Сенате</span><b>${senSeatsOf(PL)}</b>
        <span>Глав краёв</span><b>${REGIONS.filter(r=>govOf(r.id).party===PL).length}</b></div>
     </div></div>${embRow}`})
  +`<div class="cols c11"><div>`
  +panel({title:'Крылья',flush:true,
    body:`<table class="tight"><thead><tr><th>Крыло</th><th class="n">Депутатов</th>
      <th class="n">Настроение</th><th></th></tr></thead><tbody>
      ${wingRow('left',w.left)}${wingRow('core',w.core)}${wingRow('right',w.right)}</tbody>
      <caption>Крыло определяется по оси спора: кто стоит от вас дальше чем на полделения, тот в крыле.
        Настроение — среднее личное отношение к вам.</caption></table>`})
  +`</div><div>`
  +panel({title:'Линия партии',meta:chief()?'сдвиг стоит веса и злит тех, кто голосовал за прежний курс':'линию меняет лидер — '+p.leader,
    body:axr+'<p class="hint">Двигая линию, вы успокаиваете одно крыло и раздражаете другое. '+
      'На выборах избиратель смотрит на итоговую позицию, а не на путь к ней.</p>'})
  +`</div></div>`;
}

/* ─── Соседи ─────────────────────────────────────────────────────
   Четыре государства по периметру. Их отношение держит внешний спрос
   и греет те края, с которыми они граничат. */
function tabWorld(){
  const rows=NEIGHBOURS.map(x=>{const st=nbOf(x.id);
    return `<tr><td><b>${x.name}</b><div class="sub2">${x.note}</div></td>
      <td class="n ${st.rel<38?'bad':st.rel>=54?'good':''}">${Math.round(st.rel)}</td>
      <td class="hide-s dim">${nbWord(st.rel)}</td>
      <td class="n">${[st.treaty?'<span class="tag g">договор</span>':'',st.trade?'<span class="tag b">торговля</span>':'',
        sancOn(x.id)?'<span class="tag r">их санкции</span>':'',ourSanc(x.id)?'<span class="tag y">наши санкции</span>':'',
        crisisWith(x.id)?'<span class="tag r">граница</span>':''].filter(Boolean).join(' ')||'<span class="dim">нет</span>'}</td>
      <td class="n ${x.border.some(r=>nbPressure(r)>0.4)?'bad':''}">${
        r1(x.border.reduce((a,r)=>a+nbPressure(r),0))}</td>
      <td class="r"><button class="btn sm" onclick="askNeighbour('${x.id}')" ${S.ap?'':'disabled'}>Открыть</button></td></tr>`;}).join('');
  const hot=REGIONS.filter(r=>nbPressure(r.id)>0.3)
    .sort((a,b)=>nbPressure(b.id)-nbPressure(a.id));

  return panel({cls:'lead-p',title:'Внешние дела',meta:'торговля и граница',body:
    `<div class="cols c12"><div>
      <div class="stat ${nbTrade()<-6?'alert':''}"><i>торговый баланс отношений</i>
        <div class="v">${sign(Math.round(nbTrade()))}</div>
        <span>внешний спрос идёт за ним</span></div>
     </div><div>
      <p class="lead">Внешний спрос и цены на сырьё больше не случайность: их держат отношения с четырьмя
        государствами по периметру. Договор надо ратифицировать в Сенате, а вражда греет приграничные края.</p>
      <div class="res" style="margin-bottom:0"><span>Внешний спрос</span><b>${Math.round(S.world.demand)}</b>
        <span>Цены на сырьё</span><b>${Math.round(S.world.res)}</b>
        <span>Договоров</span><b>${NEIGHBOURS.filter(x=>nbOf(x.id).treaty).length} из ${NEIGHBOURS.length}</b>
        <span>Торговых соглашений</span><b>${NEIGHBOURS.filter(x=>nbOf(x.id).trade).length}</b>
        <span>Вклад во внешний спрос</span><b class="${fpDemand()<0?'bad':fpDemand()>0?'good':''}">${sign(fpDemand())}</b>
        <span>Ваш внешний курс</span><b>${sign(r1(me().st.world))}</b></div>
     </div></div>`})
  +panel({title:'Государства',flush:true,
    body:`<div class="scrollx"><table><thead><tr><th>Сосед</th><th class="n">Отношения</th>
      <th class="hide-s">Тон</th><th class="n">Связи</th><th class="n">Давление</th><th></th></tr></thead>
      <tbody>${rows}</tbody>
      <caption>Давление — сколько напряжённости сосед добавляет своим приграничным краям за квартал.
        Оно растёт, когда отношения падают ниже 38.</caption></table></div>`})
  +(S.bcrisis?panel({cls:'warn',title:S.bcrisis.stage===2?'Кризис на границе':'Пограничный инцидент',meta:NB_(S.bcrisis.nb).name,
    body:`<p class="lead">У ${R(S.bcrisis.rid).cap}: ${S.bcrisis.stage===2?'стороны стянули силы':'задержаны пограничники'}. Осталось ${quarters(S.bcrisis.left)}, если ничего не делать.</p>`,
    foot:fpCan()?`<button class="btn pri" onclick="askCrisis()">Решать</button><span class="hint">дипломатия, сила, посредник или уступка</span>`:''}):'')
  +(hot.length?panel({cls:'warn',title:'Граница',meta:'края под внешним давлением',flush:true,
    body:`<table class="tight"><tbody>${hot.map(r=>
      `<tr><td><b>${r.name}</b><div class="sub2">${r.cap}</div></td>
        <td class="n">${Math.round(S.unrest[r.id])}</td>
        <td class="n bad">+${r1(nbPressure(r.id))}</td>
        <td class="r"><button class="btn sm" onclick="openRegion('${r.id}')">Карточка</button></td></tr>`).join('')}
      </tbody></table>`})
    :panel({title:'Граница',body:'<div class="empty">Ни один сосед не давит на приграничные края.</div>'}));
}

/* ─── 8 · Регионы ────────────────────────────────────────────── */
const MAPMODE=[['sup','Поддержка'],['unrest','Напряжённость'],['govs','Главы'],['seats','Мандаты'],['dev','Развитие'],['sep','Сепаратизм']];
const RAMP_SUP=['#7B2018','#B4744A','#C9B98F','#6E8F5E','#2C6547'];
const RAMP_UNR=['#E7E0CE','#D9C08A','#C08A3E','#A85A2A','#7B2018'];
function regionFill(r){
  if(S.mapMode==='unrest'){ const v=S.unrest[r.id];
    return RAMP_UNR[v<12?0:v<24?1:v<38?2:v<55?3:4]; }
  if(S.mapMode==='dev')return ['#4A3B26','#6B5533','#9A7211','#C2A24A'][clamp(r.dev,0,3)];
  if(S.mapMode==='sep'){ const v=regSep(r.id); return regSov(r.id)?RAMP_UNR[4]:RAMP_UNR[v<10?0:v<25?1:v<45?2:v<65?3:4]; }
  if(S.mapMode==='govs'){ const g=govOf(r.id); return g?P(g.party).color:'#3A4553'; }
  if(S.mapMode==='seats'){
    let best=null,bv=-1;
    S.parties.forEach(p=>{ const n=S.deputies.filter(d=>d.region===r.id&&d.party===p.id).length;
      if(n>bv){bv=n;best=p;} });
    return best?best.color:'#3A4553';
  }
  const v=shown(regApproval(r.id),r.id);
  return RAMP_SUP[v<38?0:v<46?1:v<52?2:v<60?3:4];
}
function mapSVG(){
  const paths=REGIONS.map(r=>{const g=GEO[r.id];
    return `<path class="rgn ${S.sel===r.id?'sel':''}" d="${g.d}" fill="${regionFill(r)}" data-r="${r.id}"><title>${r.name}</title></path>`;}).join('');
  const labels=REGIONS.map(r=>{const g=GEO[r.id];
    return `<text class="caplbl" x="${g.c[0]}" y="${g.c[1]+40}" text-anchor="middle">${r.cap}</text>`;}).join('');
  return `<div class="mapbox"><svg class="mapsvg" viewBox="0 0 920 ${MAP_H}">${paths}${labels}</svg></div>`;
}
function mapLegend(){
  if(S.mapMode==='seats')return S.parties.map(p=>`<span class="chip">${emblem(p,15)}${p.short}</span>`).join('');
  if(S.mapMode==='govs')return S.parties.map(p=>{
    const n=REGIONS.filter(r=>{const g=govOf(r.id);return g&&g.party===p.id;}).length;
    return `<span class="chip">${emblem(p,15)}${p.short} — ${n}</span>`;}).join('')+
    `<span class="chip dim">${govElected()?'глав выбирают края':'глав назначает кабинет'}</span>`;
  if(S.mapMode==='unrest')return ['спокойно','ропот','тревожно','митинги','на грани'].map((t,i)=>
    `<span class="chip"><s style="background:${RAMP_UNR[i]}"></s>${t}</span>`).join('');
  if(S.mapMode==='sep')return ['нет','разговоры','движение','сильное','на грани или суверенитет'].map((t,i)=>
    `<span class="chip"><s style="background:${RAMP_UNR[i]}"></s>${t}</span>`).join('');
  if(S.mapMode==='dev')return ['слабое','среднее','высокое'].map((t,i)=>
    `<span class="chip"><s style="background:${['#4A3B26','#6B5533','#9A7211'][i]}"></s>${t}</span>`).join('');
  return ['ниже 38%','38—46%','около половины','52—60%','выше 60%'].map((t,i)=>
    `<span class="chip"><s style="background:${RAMP_SUP[i]}"></s>${t}</span>`).join('');
}
function tabCountry(){
  if(!S.mapMode)S.mapMode='sup';
  const sel=S.sel?R(S.sel):null;
  const rows=REGIONS.slice().sort((a,b)=>S.unrest[b.id]-S.unrest[a.id]).map(r=>{
    const sup=shown(regApproval(r.id),r.id);
    const dom=S.parties.map(p=>({p,n:S.deputies.filter(d=>d.region===r.id&&d.party===p.id).length}))
      .sort((a,b)=>b.n-a.n)[0];
    const g=govOf(r.id);
    return `<tr class="${S.sel===r.id?'sel':''}"><td><b>${r.name}</b>${regSov(r.id)?' <span class="tag r">суверенитет</span>':regAuto(r.id)?' <span class="tag b">автономия</span>':''}<div class="sub2">${r.cap} · ${r.pop} млн · ${mandates(S.regSeats[r.id])}</div></td>
      <td class="n ${sup<46?'bad':'good'}">${est(Math.round(sup)+'%',polled())}</td>
      <td class="n">${Math.round(S.unrest[r.id])} <span class="dim">${unrestWord(S.unrest[r.id])}</span></td>
      <td>${g?chip(P(g.party))+' <span class="dim">'+govLoyal(g)+'</span>':''}</td>
      <td class="n hide-s ${govEffect(r.id)<0?'bad':'good'}">${sign(govEffect(r.id))}</td>
      <td class="r"><button class="btn sm" onclick="openRegion('${r.id}')">Карточка</button></td></tr>`;}).join('');

  const card=sel?panel({cls:'lead-p',title:sel.name,meta:sel.cap+(sel.capital?' · столица':''),body:
    `<div class="res" style="margin-top:0">
      <span>Поддержка правительства</span><b class="${regApproval(sel.id)<46?'bad':'good'}">${est(Math.round(shown(regApproval(sel.id),sel.id))+'%',polled())}</b>
      <span>Напряжённость</span><b class="${S.unrest[sel.id]>34?'bad':''}">${Math.round(S.unrest[sel.id])} · ${unrestWord(S.unrest[sel.id])}</b>
      <span>Население</span><b>${sel.pop} млн</b>
      <span>Мандатов от субъекта</span><b>${S.regSeats[sel.id]}</b></div>
     ${(()=>{const g=govOf(sel.id); if(!g)return '';
       return `<h3 class="sub">Глава края</h3>
        <div class="dep"><div class="who"><b>${g.name}</b><span>${P(g.party).name} · ${govLoyal(g)}</span></div>
          <b class="num-s ${g.rel<36?'bad':g.rel>=52?'good':''}">${Math.round(g.rel)}</b></div>
        <div class="res" style="margin:6px 0 0"><span>Компетентность</span><b>${g.comp}</b>
          <span>Вклад в поддержку</span><b class="${govEffect(sel.id)<0?'bad':'good'}">${sign(govEffect(sel.id))}</b>
          <span>Как получил край</span><b class="w">${g.appointed?'назначен центром':'выбран краем'}</b>
          <span>Срок до</span><b>${dateLabel(g.till)}</b></div>`;})()}
     ${regCardExtra(sel.id)}
     <h3 class="sub">Соседи</h3>
     <div class="legend">${NB(sel.id).map(n=>`<span class="chip"><s style="background:${
       S.unrest[n]>38?'var(--bad)':'var(--good)'}"></s>${R(n).name.replace(/ (регион|область|край)$/,'')} ${Math.round(S.unrest[n])}</span>`).join('')}</div>
     <p class="hint" style="margin-top:6px">Напряжённость перетекает через границу: горящий сосед раскачивает и этот край.</p>
     <h3 class="sub">Состав избирателей</h3>
     <table class="tight"><tbody>${GROUPS.slice().sort((a,b)=>sel.share[b.id]-sel.share[a.id]).slice(0,5).map(g=>
       `<tr><td>${g.name}</td><td class="n">${Math.round(sel.share[g.id]*100)}%</td>
        <td class="n ${approvalIn(g.id,sel.id)<46?'bad':'good'}">${Math.round(shown(approvalIn(g.id,sel.id),sel.id+g.id))}</td></tr>`).join('')}
     </tbody></table>`,
    foot:`<button class="btn sm pri" data-act="visit" data-arg="${sel.id}" ${S.ap&&S.treasury>=6?'':'disabled'}>Поехать туда<span class="cost">6 млрд</span></button>
          <button class="btn sm" onclick="askGov('${sel.id}')" ${S.ap?'':'disabled'}>Глава края</button>
          <button class="btn sm ghost" onclick="S.sel=null;render()">Снять выделение</button>`})
    :panel({title:'Субъект не выбран',body:'<div class="empty">Нажмите на карту или на строку в списке, чтобы открыть карточку.</div>'});

  return `<div class="cols c21">
    ${panel({title:'Карта Республики',meta:polled()?'данные свежего опроса':'оценка без опроса, ±3 пункта',body:
      `<div class="row" style="margin-bottom:var(--x4)"><div class="seg">${MAPMODE.map(m=>
        `<button class="${S.mapMode===m[0]?'on':''}" onclick="S.mapMode='${m[0]}';render()">${m[1]}</button>`).join('')}</div>
        <button class="btn sm ghost" data-act="poll" style="margin-left:auto" ${S.ap&&S.funds>=9&&!polled()?'':'disabled'}>Заказать опрос<span class="cost">9 млн</span></button></div>
       ${mapSVG()}<div class="legend">${mapLegend()}</div>`})}
    ${card}
  </div>
  ${regCenterPanel()}
  ${panel({title:'Субъекты',meta:'по напряжённости',flush:true,body:
    `<div class="scrollx"><table><thead><tr><th>Субъект</th><th class="n">Поддержка</th><th class="n">Напряжённость</th>
      <th>Глава края</th><th class="n hide-s">Вклад</th><th></th></tr></thead><tbody>${rows}</tbody></table>
      <caption>Вклад — сколько глава прибавляет или отнимает к поддержке в своём крае.
        Кто его ставит, решает закон о местном самоуправлении: сейчас ${govElected()?'выбирают сами субъекты':'назначает кабинет'}.</caption></div>`})}`;
}
function openRegion(id){ S.sel=id; S.tab='country'; render(); window.scrollTo(0,0); }

/* ─── 7 · Общество ───────────────────────────────────────────── */
function tabSociety(){
  const rows=GROUPS.map(g=>{
    const w=REGIONS.reduce((a,r)=>a+r.pop*r.share[g.id],0)/REGIONS.reduce((a,r)=>a+r.pop,0)*100;
    const m=shown(S.mood[g.id],g.id), f=fitOf(g,me().st), pf=perfOf(g);
    return `<tr><td><b>${g.name}</b><div class="sub2">хочет: ${AXES.filter(a=>g.w[a.id]>=0.7).map(a=>
        a.name.toLowerCase()+' '+(g.pref[a.id]>0.4?a.r:g.pref[a.id]<-0.4?a.l:'посередине')).join(', ')}</div></td>
      <td class="n">${r1(w)}%</td>
      <td class="n ${m<46?'bad':'good'}">${est(Math.round(m),polled())}</td>
      <td>${mini(m,g.color)} <span class="dim">${moodWord(S.mood[g.id])}</span></td>
      <td class="n ${f<50?'bad':'good'}">${Math.round(f)}</td>
      <td class="n ${pf<0?'bad':'good'}">${sign(Math.round(pf))}</td></tr>`;}).join('');
  const cross=`<div class="scrollx"><table class="tight"><thead><tr><th>Субъект</th>
    ${GROUPS.map(g=>`<th class="n">${g.short}</th>`).join('')}<th class="n">Итог</th></tr></thead><tbody>
    ${REGIONS.map(r=>`<tr><td>${r.name}</td>${GROUPS.map(g=>{
      const v=shown(approvalIn(g.id,r.id),r.id+g.id);
      return `<td class="n" style="color:${v<42?'var(--bad)':v>58?'var(--good)':'inherit'}">${Math.round(v)}</td>`;}).join('')}
      <td class="n"><b>${Math.round(shown(regApproval(r.id),r.id))}</b></td></tr>`).join('')}
    </tbody></table></div>`;
  return panel({cls:'info',title:'Электоральные группы',meta:polled()?'свежая социология':'оценка штаба, ±3',flush:true,
      body:`<div class="scrollx"><table><thead><tr><th>Группа</th><th class="n">Доля страны</th><th class="n">Настроение</th>
        <th>Оценка</th><th class="n">Курс</th><th class="n">Дела</th></tr></thead><tbody>${rows}</tbody>
        <caption>«Курс» — насколько группе нравится программа, «дела» — как на неё влияют экономика и бюджет. Настроение медленно ползёт к сумме этих двух.</caption></table></div>`})
    +panel({title:'Настроение по субъектам',meta:'группы по столбцам',flush:true,body:cross})
    +panel({title:'Курс партии',meta:'менять позиции можно, но избиратель помнит',body:
      AXES.map(a=>`<div class="ax"><div class="axh"><span>${a.l}</span><span>${a.name}</span><span>${a.r}</span></div>
        <div class="axr">${[-2,-1,0,1,2].map(v=>
          `<button class="${Math.round(me().st[a.id])===v?'on':''}" onclick="moveAxis('${a.id}',${v})">${STEP[v+2]}</button>`).join('')}</div></div>`).join('')+
        '<p class="hint">Сдвиг позиции стоит 6 политического веса и злит тех, кто голосовал за прежний курс.</p>'});
}
function moveAxis(ax,v){
  if(Math.round(me().st[ax])===v)return;
  if(!chief()){ toast('Линию партии меняет лидер — '+me().leader+'. Или съезд.'); return; }
  if(!payCap(6))return;
  const old=me().st[ax];
  me().st[ax]=v;
  GROUPS.forEach(g=>{
    const before=Math.abs(g.pref[ax]-old), after=Math.abs(g.pref[ax]-v);
    shiftMood(g.id,(before-after)*g.w[ax]*2.2);
  });
  S.deputies.filter(d=>d.party===PL).forEach(d=>{ d.rel=clamp(d.rel-Math.abs(d.st[ax]-v)*3,0,100); });
  logMsg('Партия сместила позицию по теме «'+AXNAME[ax]+'» на '+STEP[v+2]+'.',1);
  render();
}

/* ─── 8 · Кампания ───────────────────────────────────────────── */
function forecast(){
  let total=0;
  REGIONS.forEach(r=>{
    const sc={};S.parties.forEach(p=>sc[p.id]=partyScore(p,r));
    total+=dhondt(shareFrom(sc),S.regSeats[r.id])[PL]||0;
  });
  return total;
}
/* ─── опросы гонки ────────────────────────────────────────────────
   Линия на партию, квартал на шаг. Подпись у конца линии: кто где
   стоит сейчас. Пока опрос один — точки вместо линий. */
function pollChart(polls,parts){
  if(!polls||!polls.length)return '<div class="empty">Первый опрос появится в начале кампании.</div>';
  const W=560,H=190,L=34,R=86,T=10,B=22;
  const ids=parts||S.parties.map(p=>p.id);
  const all=[]; polls.forEach(x=>ids.forEach(id=>all.push(x.sh[id]||0)));
  const mx=Math.ceil(Math.max(10,...all)/5)*5, n=polls.length;
  const X=i=>L+(n<2?(W-L-R)/2:i/(n-1)*(W-L-R)), Y=v=>T+(1-v/mx)*(H-T-B);
  let g='';
  for(let v=0;v<=mx;v+=mx>30?10:5)g+=`<line x1="${L}" x2="${W-R}" y1="${r1(Y(v))}" y2="${r1(Y(v))}" class="pg"/><text x="${L-6}" y="${r1(Y(v)+3)}" class="pl" text-anchor="end">${v}</text>`;
  polls.forEach((x,i)=>g+=`<text x="${r1(X(i))}" y="${H-6}" class="pl" text-anchor="middle">${shortDate(x.q)}</text>`);
  const lab=[];
  ids.forEach(id=>{ const p=P(id); if(!p)return;
    const pts=polls.map((x,i)=>[X(i),Y(x.sh[id]||0)]);
    g+=`<path d="${pts.map((q,i)=>(i?'L':'M')+r1(q[0])+' '+r1(q[1])).join(' ')}" fill="none" stroke="${p.color}" stroke-width="${id===PL?2.6:1.6}"/>`;
    pts.forEach(q=>g+=`<circle cx="${r1(q[0])}" cy="${r1(q[1])}" r="${id===PL?3:2.2}" fill="${p.color}"/>`);
    lab.push({y:pts[pts.length-1][1],t:p.short+' '+polls[n-1].sh[id]+'%',c:p.color,me:id===PL}); });
  lab.sort((a,b)=>a.y-b.y); for(let i=1;i<lab.length;i++)if(lab[i].y-lab[i-1].y<12)lab[i].y=lab[i-1].y+12;
  lab.forEach(l=>g+=`<text x="${W-R+8}" y="${r1(l.y+3)}" class="pl ${l.me?'me':''}" fill="${l.c}">${l.t}</text>`);
  return `<svg class="poll" viewBox="0 0 ${W} ${H}">${g}</svg>`;
}
/* мандаты по опросу — тем же Д'Ондтом по краям */
function forecastAll(){
  const out={}; S.parties.forEach(p=>out[p.id]=0);
  REGIONS.forEach(r=>{ const sc={}; S.parties.forEach(p=>sc[p.id]=partyScore(p,r));
    const st=dhondt(shareFrom(sc),S.regSeats[r.id]); Object.entries(st).forEach(([k,v])=>out[k]+=v); });
  return out;
}
function racePanel(){
  const polls=S.camp&&S.camp.polls||[], last=polls[polls.length-1], fc=forecastAll();
  const th=(S.camp&&S.camp.themes)||{};
  const rows=S.parties.slice().sort((a,b)=>(last?last.sh[b.id]-last.sh[a.id]:0)).map(p=>{ const t=campTrend(p.id);
    return `<tr class="${p.id===PL?'mine':''}"><td>${chip(p)} ${p.name}</td><td class="n">${last?last.sh[p.id]+'%':'—'}</td>
      <td class="n ${t>0?'good':t<0?'bad':'dim'}">${t?(t>0?'▲ ':'▼ ')+Math.abs(t):'—'}</td><td class="n">${fc[p.id]}</td>
      <td class="n hide-s">${p.id===PL?sign(r1(S.camp.swing||0)):sign(r1(p.mom||0))}</td>
      <td class="hide-s dim">${th[p.id]?AXNAME[th[p.id].ax].toLowerCase()+' · '+Math.round(th[p.id].spent)+' млн':p.id===PL?'ваш штаб':'—'}</td></tr>`; }).join('');
  return panel({cls:'lead-p',title:'Гонка',meta:polls.length?'опрос '+shortDate(last.q)+' · ±2 пункта':'опросов ещё нет',
    body:pollChart(polls)+`<table class="tight" style="margin-top:8px"><thead><tr><th>Партия</th><th class="n">Опрос</th><th class="n">За квартал</th>
      <th class="n">Мандатов</th><th class="n hide-s">Импульс</th><th class="hide-s">Тема и траты</th></tr></thead><tbody>${rows}</tbody>
      <caption>Импульс — то, что кампания добавила сверх курса и дел: скандалы, дебаты, события. Мандаты — по опросу, методом Д'Ондта по краям.</caption></table>`});
}
function presRacePanel(){
  const P0=S.presPolls||[]; if(!P0.length)return '';
  const last=P0[P0.length-1], ids=S.parties.map(p=>p.id).sort((a,b)=>last.sh[b]-last.sh[a]).slice(0,4);
  return panel({title:'Президентская гонка',meta:'до выборов '+quarters(presLeft())+' · первый тур',
    body:pollChart(P0,ids)+`<p class="hint">Кандидаты: ${ids.map(id=>(id===PL?plCandName():P(id).leader)+' («'+P(id).short+'»)').join(', ')}.
      Больше половины — победа в первом туре, иначе второй тур двух первых.</p>`});
}

function tabCamp(){
  if(!S.camp)return panel({title:'Штаб',body:'<div class="empty">Штаб развернётся за четыре квартала до выборов.</div>'});
  const left=aTerm()-(S.q-S.termStart), fc=forecast();
  const ads=GROUPS.map(g=>`<tr><td>${g.name}</td><td class="n">${S.camp.ads[g.id]||0}</td>
    <td class="n ${S.mood[g.id]<46?'bad':''}">${Math.round(S.mood[g.id])}</td>
    <td class="r"><button class="btn sm" onclick="CAMPACT.ads('${g.id}')" ${S.funds>=16?'':'disabled'}>Ролики<span class="cost">16 млн</span></button></td></tr>`).join('');
  const ral=REGIONS.map(r=>`<tr><td>${r.name}</td><td class="n">${S.camp.rally[r.id]||0}</td>
    <td class="n">${est(Math.round(shown(regApproval(r.id),r.id))+'%',polled())}</td>
    <td class="r"><button class="btn sm" onclick="CAMPACT.rally('${r.id}')" ${S.ap&&S.funds>=11?'':'disabled'}>Митинг<span class="cost">11 млн</span></button></td></tr>`).join('');
  return panel({cls:'lead-p',title:'Предвыборный штаб',meta:'до выборов '+quarters(left),
      body:`<div class="grid g4">
        ${stat('Касса',Math.round(S.funds)+'<u>млн</u>','потрачено '+S.camp.spent)}
        ${stat('Прогноз',fc,'из '+SEATS+' мандатов',fc<MAJ?'':'')}
        ${stat('Ролики',Object.values(S.camp.ads).reduce((a,b)=>a+b,0),'по группам')}
        ${stat('Дебаты',S.camp.debate===null?'—':S.camp.debate>0?'выиграны':'проиграны',
          S.camp.debate===null?'впереди':'эфир прошёл')}</div>
      ${S.camp.debate===null&&left<=2?`<h3 class="sub">Теледебаты</h3>
        <p class="hint" style="margin-bottom:6px">Эфир с лидером крупнейшей фракции. Тон выбираете вы:</p>
        <div class="row"><button class="btn" onclick="CAMPACT.debate('hard')">Идти в атаку</button>
        <button class="btn" onclick="CAMPACT.debate('calm')">Держаться спокойно</button>
        <button class="btn" onclick="CAMPACT.debate('numbers')">Говорить цифрами</button></div>`:''}`})
    +racePanel()
    +`<div class="cols c11">
      ${panel({title:'Реклама по группам',meta:'деньги без действия',flush:true,
        body:`<table class="tight"><thead><tr><th>Группа</th><th class="n">Роликов</th><th class="n">Настроение</th><th></th></tr></thead><tbody>${ads}</tbody></table>`})}
      ${panel({title:'Митинги по субъектам',meta:'1 действие и 11 млн',flush:true,
        body:`<table class="tight"><thead><tr><th>Субъект</th><th class="n">Митингов</th><th class="n">Поддержка</th><th></th></tr></thead><tbody>${ral}</tbody></table>`})}
    </div>`;
}

/* ─── 9 · Летопись ───────────────────────────────────────────── */
function spark(key,color,title,fmt){
  const d=S.hist.map(h=>h[key]).filter(v=>v!==undefined);
  if(d.length<2)return '';
  const W=320,H=46,mn=Math.min(...d),mx=Math.max(...d),rg=(mx-mn)||1;
  const pts=d.map((v,i)=>[6+i/(d.length-1)*(W-12),H-8-((v-mn)/rg)*(H-18)]);
  const path=pts.map((p,i)=>(i?'L':'M')+r1(p[0])+' '+r1(p[1])).join(' ');
  return `<div style="padding:7px 0;border-bottom:var(--hair-2)">
    <div style="display:flex;justify-content:space-between;align-items:baseline">
      <span class="t-micro">${title}</span><b class="num">${fmt?fmt(d[d.length-1]):d[d.length-1]}</b></div>
    <svg class="spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
      <path d="${path}" fill="none" stroke="${color}" stroke-width="1.6"/>
      <circle cx="${r1(pts[pts.length-1][0])}" cy="${r1(pts[pts.length-1][1])}" r="2.6" fill="${color}"/></svg>
    <div style="display:flex;justify-content:space-between" class="t-micro">
      <span>${shortDate(S.hist[0].q)}</span><span>мин ${r1(mn)} · макс ${r1(mx)}</span></div></div>`;
}
function tabArch(){
  const ch=S.chron.slice().reverse().map(c=>
    `<div class="chron ${c.kind}"><span class="y">${c.y}</span><span>${c.t}</span></div>`).join('')
    ||'<div class="empty">История ещё не написана.</div>';
  return `<div class="cols c11">
    ${panel({title:'Показатели правления',meta:quarters(S.hist.length),body:
      spark('ap','var(--bad)','Одобрение, %',v=>Math.round(v)+'%')+
      spark('seats','var(--info)','Мандаты фракции')+
      spark('gdp','var(--good)','ВВП, индекс')+
      spark('gr','var(--p4)','Рост ВВП, %',v=>sign(v)+'%')})}
    ${panel({title:'Хроника',meta:S.chron.length+' записей',body:ch})}
  </div>
  ${panel({title:'Полный журнал',body:'<div class="log">'+
    S.log.slice(0,60).map(l=>`<div class="${l.key?'key':''}"><s>${l.d}</s>${l.t}</div>`).join('')+'</div>'})}
  ${panel({title:'Личное решение',body:
    `<div class="row"><button class="btn danger" onclick="resign()">Подать в отставку и подвести итог</button>
      <span class="hint">Созыв ${S.term} из 3. Дальше конституция не пускает.</span></div>`})}`;
}

/* ─── 10 · Справка ───────────────────────────────────────────── */
function helpBody(){
  return `<h3 class="sub">Время и три действия</h3>
    <p>Ход — квартал. В квартале <b>три действия</b>: любая кнопка, которая тратит ход, — закон, поездка, речь,
      депутат, переговоры, вотум, импичмент. Действия не копятся и сгорают при закрытии квартала; вес, казна
      и партийная касса — отдельные счета, они копятся. В шапке ходы нарисованы квадратами, щелчок по ним
      показывает, на что ушли ходы и что сделать дальше. Если закрыть квартал с оставшимися ходами, игра
      спросит. Созыв длится ${aTerm()} кварталов, затем всеобщие выборы. Больше трёх созывов подряд не бывает.</p>
    <h3 class="sub">Процедуры палаты</h3>
    <p><b>Вотум недоверия</b>: ${MOT_SIG} подписей, потом ${MAJ} голосов «за»; голосование — в конце квартала или сразу.
      Между ступенями обе стороны работают с фракциями, а премьер может поставить вопрос о доверии.
      <b>Кабинет пал</b> — президент даёт поручение; у формирующего квартал, утверждение — простым большинством
      присутствующих; ${FORM_ROUNDS} провала подряд — обязательный роспуск. <b>Роспуск</b> — у ${dissHolderWord()==='никто'?'никого':dissHolderWord()==='президент'?'президента':'премьера'},
      с шестью запретами и прогнозом новых выборов. <b>Импичмент</b>: ${IMP_SIG} подписей, спецкомиссия, для президента —
      Конституционный суд, ${impH()} в Собрании, ${impS()} в Сенате. <b>Регламент</b> Собрания меняется простым
      большинством одной палаты. Всё это собрано на пульте в разделе «Собрание».</p>
    <h3 class="sub">Кто вы такой</h3>
    <p>У политика есть происхождение, две черты характера и молва по четырём шкалам — честность,
      твёрдость, компетентность, близость к народу. Черта не пишет текст, а меняет число: удешевляет
      работу с залом, усиливает речь, замедляет износ, снимает погрешность с цифр. Молва двигается
      от ваших решений, а не от рейтинга, и работает на выборах, в коалиции и в разговоре с президентом.</p>
    <p>Политик стареет по четверти года за квартал. После шестидесяти четырёх возраст начинает
      отнимать часть кредита доверия — это видно в личном деле.</p>
    <h3 class="sub">Края и их главы</h3>
    <p>У каждого из одиннадцати субъектов свой глава со своей партией, компетентностью и отношением
      к вам. Толковый и лояльный гасит напряжённость и приводит округ на выборах; враждебный делает
      обратное. Кто его ставит, решает закон о местном самоуправлении: при вертикали назначает кабинет,
      при автономии выбирает сам край. Назначенца можно снять, выборного — только переубедить.</p>
    <p>Субъекты граничат друг с другом по-настоящему: напряжённость перетекает через границу,
      и запущенный край раскачивает соседей. Список соседей виден в карточке субъекта.</p>
    <h3 class="sub">Обещания</h3>
    <p>В начале каждого созыва партия называет два обещания — по безработице, инфляции, долгу, росту,
      напряжённости или числу проведённых законов. Их проверяют один раз, на выборах: выполненное
      прибавляет поддержки и политического веса, проваленное отнимает вдвое больше. Ход обещаний
      виден на первом экране весь созыв, так что провал можно заметить заранее.</p>
    <h3 class="sub">Откуда берётся рейтинг</h3>
    <p>Одобрения как отдельной цифры не существует: есть восемь групп избирателей со своими взглядами и заботами.
      Каждая смотрит на две вещи — насколько ваш курс совпадает с её взглядами («курс») и что происходит
      с ценами, работой и её статьёй бюджета («дела»). Настроение группы медленно ползёт к сумме этих двух,
      а рейтинг страны — средневзвешенное по регионам, где эти группы живут.</p>
    <p class="hint">Чем дольше вы у власти, тем ниже потолок: избиратель устаёт от любого правительства.
      Число под пунктиром — оценка без свежего опроса.</p>
    <h3 class="sub">Три власти</h3>
    <p>Новария — полупрезидентская республика, и власть здесь намеренно не сходится в одних руках.
      <b>Народное собрание</b> — ${SEATS} депутатов, избирается целиком раз в ${quarters(aTerm())} по субъектам.
      <b>Сенат</b> — ${SEN_SEATS} мест, тоже по субъектам, но обновляется третями раз в ${quarters(senCyc())}:
      он никогда не меняется весь сразу. <b>Президент</b> избирается всей страной на ${quarters(pTerm())} —
      по своим часам, не совпадающим с созывом.</p>
    <p>Закон идёт по трём ступеням: ${MAJ} голосов в Собрании, ${SEN_MAJ} в Сенате, подпись президента.
      Достаточно провалиться на одной, чтобы всё остановилось. Вето снимается двумя третями Собрания —
      ${superN()} голосами. Бюджет — исключение: он проходит только через Собрание.</p>
    <h3 class="sub">Собрание</h3>
    <p>У каждого депутата своя позиция по шести осям, дисциплина фракции и личное отношение к вам.
      Голосуя, депутат складывает близость закона к своим взглядам, указание фракции, помноженное на дисциплину,
      личное отношение и поправки, которые бьют по его округу. Колеблющихся решает зал — их и стоит уговаривать,
      поодиночке или всех разом.</p>
    <p>Комитет по теме проекта прибавляет голоса фракции своего председателя. Каждая тема живёт в одной редакции:
      новый закон отменяет прежний. Правительство меньшинства работает, пока оппозиция не соберёт вотум недоверия.</p>
    <h3 class="sub">Сенат</h3>
    <p>Палата субъектов. Сенатор вдвое меньше слушает фракцию и вдвое больше — свой край и вас лично,
      поэтому расклад здесь никогда не повторяет расклад Собрания. Всё, что задевает регионы, тут встречают жёстче.
      Обновление третями означает, что выигранные вами выборы в Собрание меняют Сенат лишь на треть — и не сразу.</p>
    <h3 class="sub">Премьер-министр и кабинет</h3>
    <p>Портфель отдан фракции — это политика; кто именно сидит в кресле — это работа ведомства.
      У премьера есть имя и срок, у каждого из шести министров — фамилия, партия и компетентность.
      Сильный министр вытягивает свою статью, слабый тянет вниз даже при верной программе; министр
      финансов прямо меняет сборы. После ${quarters(MIN_TERM)} в должности человек выдыхается, и ведомство
      теряет часть отдачи. Перестановка стоит ${PM_COST} веса, меняет лицо, но не трогает коалицию —
      фракция сохраняет портфель и только замечает потерю своего человека.</p>
    <h3 class="sub">Президент и вице-президент</h3>
    <p>Подписывает или заворачивает законы, после выборов решает, кому поручить кабинет, может распустить
      Собрание и править указами. Указ обходит обе палаты, но действует ${Math.round(DECREE_POWER*100)}% силы
      закона и всего ${quarters(DECREE_LEN)}, а его легко перебить обычным законом. Два срока подряд — предел
      для человека: партия остаётся, лицо меняется.</p>
    <p>Если президентом становитесь вы, эти полномочия ваши — даже когда кабинет не ваш.
      Оппозиция с президентским креслом ничем не хуже правительства без него.</p>
    <p>Вице-президент идёт на выборы тем же списком и потому всегда из партии президента. Своих
      полномочий у него два. Он председательствует в Сенате и разбивает равенство: в палате из ста мест
      пятьдесят на пятьдесят — не редкость, и тогда решает он, а не сенаторы. И он наследует кресло,
      если президент оставляет его досрочно: новых выборов не назначают, вице доводит срок до конца.
      Выигрывая президентские выборы, вы получаете оба кресла разом; проигрывая — отдаёте оба.</p>
    <h3 class="sub">Деньги</h3>
    <p>Казна — государственная, партийная касса — ваша. Из казны платят за поездки, транши регионам и стройки
      в округах; из кассы — за социологию и кампанию. Смешивать нельзя: заметят.</p>
    <p>Дефицит уходит в долг и разгоняет инфляцию. Хозяйственный цикл идёт сам, внешний спрос и цены на сырьё
      тянут экономику и бюджет независимо от ваших решений.</p>
    <p>Ставки и статьи меняются когда угодно, но раз в год — в четвёртом квартале — правительство защищает
      их в Собрании. Депутат смотрит на бюджет как на закон сразу по двум осям: сколько берут и сколько тратят.
      Отклонённый бюджет год живёт по прошлым ставкам, а кабинет теряет вес и одобрение; второй провал подряд
      валит правительство.</p>
    <h3 class="sub">Печать</h3>
    <p>Пять изданий со своим читателем и своим уклоном. Они не выносят решений, но решают, как страна
      узнает о ваших: тон печати умножает любой сдвиг настроения — доброжелательная удваивает хорошую
      новость и глушит плохую, враждебная делает наоборот. Каждое издание двигает своих читателей,
      а не страну целиком. Закон о печати работает в обе стороны: под надзором редакции сговорчивее,
      но им меньше верят, и множитель слабеет.</p>
    <p>Интервью поднимает одно издание и его группу, утечка бьёт по сопернику ценой вашей честности,
      отлучение доступно только при надзоре и настораживает остальные редакции.</p>
    <h3 class="sub">Конституционный суд</h3>
    <p>${courtN()} судей на ${quarters(judgeLife())} — дольше, чем правит любой президент, поэтому состав суда
      это наследство, а не текущая политика. Кресло освобождается редко: назначает президент, утверждает
      Сенат. Запрос в суд оспаривает действующий закон; отменяют ${courtMaj()} голосов из ${courtN()}.
      Суд смотрит не на пользу закона, а на то, как далеко он зашёл: крайние редакции и особенно указы
      отменяют охотнее. Судебная реформа решает, насколько суд смел. Тот же суд надзирает за самой
      конституцией: поправку, принятую палатами в свою пользу, он вправе отменить в первые
      ${quarters(CN_REVIEW)} после принятия — но не трогает ни то, что утвердила страна на референдуме,
      ни редакцию Конституционного собрания.</p>
    <h3 class="sub">Конституция и её ядро</h3>
    <p>Основной закон разбит на девять глав. Шесть обычных переписывают палаты: ${CN().needH||290} голосов
      в Собрании, ${CN().needS||67} в Сенате, для части поправок — всенародное голосование, и никакого вето.
      Три главы — ядро: основы строя, права и свободы и сам порядок пересмотра. Их палаты не открывают
      никаким большинством. Ядро меняет только Конституционное собрание: созыв тремя пятыми обеих палат
      (${CONV_CALL_H} и ${CONV_CALL_S}), выборы ${CONV_SEATS} делегатов по стране, пакет до ${CONV_PKG}
      пунктов и простое большинство делегатов по каждому. Собрание вправе дописать к пакету свой пункт,
      и снять его нельзя; редакцию с ядром утверждает страна одним вопросом.</p>
    <h3 class="sub">Надзор</h3>
    <p>След от сделок копится сам: стройка в округе, нажим на депутата, утечка, отставка главы края,
      отлучение издания. Честный собеседник стоит дороже — он скорее заговорит, и здесь наконец
      работает неподкупность депутата. Прокуратура заводит дело тем охотнее, чем она независимее,
      а её независимость задаёт антикоррупционный закон. Дело можно свернуть, если надзор зависим,
      но это добавит к следу вдвое больше, чем снимет.</p>
    <h3 class="sub">Партия изнутри</h3>
    <p>Своя фракция не монолит. По оси, где депутаты расходятся сильнее всего, у партии есть левое
      крыло, ядро и правое. Когда линия уезжает от крыла, а дела идут плохо, находится тот, кто
      предложит себя вместо вас: через два квартала фракция голосует. Проигрыш не снимает вас с поста,
      но часть крыла уйдёт с мандатами. До голосования можно уступить крылу по спорной оси.</p>
    <h3 class="sub">Избирательный закон</h3>
    <p>Он меняет не настроение групп, а способ, которым голоса превращаются в мандаты: метод делителей
      и заградительный барьер. При цензе и фильтрах барьер 8% и Д’Ондт — мелкие фракции отсекаются,
      крупные забирают их места. При равном доступе барьера нет и работает Сент-Лагю — мандаты ближе
      к голосам. Правило действует и на Собрание, и на Сенат, и на выборы глав краёв.</p>
    <h3 class="sub">Соседи</h3>
    <p>Четыре государства по периметру. Внешний спрос идёт за отношениями с ними, а вражда греет
      те края, с которыми сосед граничит, — карта здесь работает по-настоящему. Визит стоит денег
      и улучшает отношения, договор стоит веса и требует ратификации Сенатом: внешняя политика
      упирается во внутреннюю.</p>
    <h3 class="sub">Референдум</h3>
    <p>Прямой вопрос стране мимо обеих палат и мимо подписи. Считают не фракции, а восемь групп:
      смотрите, чего хочет страна, а не Собрание. Победа даёт закон полной силы, который нельзя
      переписать ${quarters(REF_LOCK)}, и большой прирост веса. Поражение стоит дороже парламентского:
      страна сказала нет вам лично. Назначить может президент или две трети Собрания.</p>
    <h3 class="sub">Досрочные выборы</h3>
    <p>С пятого квартала кабинета президент может распустить Собрание и назначить выборы раньше срока,
      заплатив политическим весом. Это способ поймать удачный момент — но избиратель не любит, когда его гонят
      к урнам, и каждый следующий роспуск обходится дороже.</p>
    <h3 class="sub">Выборы</h3>
    <p>В каждом субъекте свои мандаты, распределение — по методу Д'Ондта. За партию голосуют группы, которым она
      ближе: у соперников это идеология, у вас — курс вместе с тем, как люди оценивают вашу работу.
      За четыре квартала до выборов открывается штаб: ролики бьют по группам, митинги — по субъектам,
      дебаты решают настроение страны разом.</p>
    <h3 class="sub">Чем всё кончается</h3>
    <p>Долг выше 430 млрд — дефолт. Одобрение ниже 19% — отставка. Средняя напряжённость выше 72 — страна выходит
      из-под контроля. В остальном итог считают по мандатам, законам, экономике и годам у власти.</p>
    <h3 class="sub">Клавиши</h3>
    <p>Разделы переключаются цифрами <b>1</b>—<b>9</b> в том порядке, в каком они стоят в меню, соседний раздел —
      стрелками <b>←</b> и <b>→</b>, конец квартала — <b>Q</b>. Пока открыто окно с решением, клавиши молчат.</p>
    <h3 class="sub">Стартовое кресло и стол</h3>
    <p>Шестой шаг создания партии — кресло: премьер, президент, вице-президент, министр, губернатор, мэр, сенатор,
      рядовой депутат или без должности. У каждого кресла в «Кабинете» свой стол: цифры, рычаги на ход, оценка работы
      и дорога дальше. Министра судят по цифре ведомства (ниже 25 два квартала — отставка), губернатора — по краю
      и отношениям с центром, мэра — по доверию горожан и городскому хозяйству.</p>
    <h3 class="sub">Влияние и съезд</h3>
    <p>Если партию ведёте не вы, линию, коалицию и программу решает её лидер. Ваше влияние (шапка, «Партия») решает
      номер в списке на выборах, пойдёт ли своя фракция за вашим законом и выиграете ли вы съезд. Съезд можно созвать
      с влиянием от ${CONGRESS_INF}; проигрыш стоит влияния и четырёх кварталов ожидания.</p>
    <h3 class="sub">Лидеры фракций и сделки</h3>
    <p>У каждой фракции два лидера — в Собрании и в Сенате — с характером: прагматик, идейный, хозяйственник,
      карьерист, лис, служака. Сделка — поддержка одного предмета (закона, поправки, бюджета, вотума) за плату:
      портфель, комитет, деньги краю, ответный закон, уступку по курсу, конверт или честное слово. Раунд переговоров —
      один ход на квартал, предложение — ${DEAL_CAP} веса. Лис держит слово не всегда. Невозвращённый долг
      запоминают все лидеры, и каждая следующая сделка дорожает. Дальше двух делений от своей линии фракцию не уведёт никто.</p>
    <h3 class="sub">Комитеты</h3>
    <p>Шесть комитетов по осям, по ${COMM_SIZE} членов; кресла делятся по фракциям в начале созыва. Комитет голосует
      первым: «за» — рекомендация и лишние голоса, «против» — минус, а чужой председатель может положить проект
      под сукно. Чужие комитеты вызывают ваших министров на слушания; вызвать можно и самому.</p>
    <h3 class="sub">Обструкция и клотур</h3>
    <p>В Сенате меньшинство может тянуть прения, пока за их прекращение — клотур — нет ${cloture()} голосов.
      Голосов на сам закон может хватать, но до голосования по существу дело не дойдёт. Сломать обструкцию можно
      сделкой с лидерами сенаторов, выкупом недостающих голосов, смягчением текста или «ядерным вариантом» —
      опустить порог клотура до простого большинства навсегда и для всех. Сенатор-игрок может тянуть прения сам.</p>
    <h3 class="sub">Кампания и ночь выборов</h3>
    <p>Штаб публикует опрос каждый квартал: график гонки, сдвиг, прогноз мандатов, импульс кампании. События штаба —
      компромат, скандал у соперника, деньги корпорации, оговорка, колеблющийся край. В ночь выборов края
      открываются с востока на запад после экзит-полла.</p>
    <h3 class="sub">Выборный календарь</h3>
    <p>Выдвинуться можно в Сенат от своего края, в главы края, в мэры, в президенты через праймериз.
      Выдвижение — ход, 6 веса и 15 млн. Партия и президент предлагают и сами: выдвижение за счёт партии,
      место вице-президента, край. Бывший президент может занять пожизненное место в Сенате.</p>
    <h3 class="sub">Скандалы и утечки</h3>
    <p>Скандал горит кварталами: враждебная печать разогревает, извинение, сданный помощник, смена повестки
      или удачный суд остужают, отрицание при больших документах возвращается новой волной. Утечки растут из следа
      сделок, конвертов и корпоративных денег. Компромат на соперника может привести обратно к вам.</p>
    <h3 class="sub">Дело: проверка, обыски, обвинение, суд</h3>
    <p>След от сделок или горящий скандал с документами доводят до прокуратуры. Дело идёт ступенями по кварталу:
      проверка, обыски, обвинение, суд — и на каждой может закрыться, если улик мало. Развилки: свернуть дело (пока идёт проверка
      или обыски и прокуратура не независима), давить на следствие, нанять адвокатов, сдать фигуранта, открыть архивы,
      заявить о преследовании, сменить генпрокурора (президент), давить на суд. Давление снижает улики, но стоит легитимности,
      а при независимой прокуратуре или суде может обернуться новым скандалом. Если дело против вас, а в регламенте есть
      неприкосновенность, палата сначала решает, снимать ли её. Приговор вам — потеря кресла и мандата и запрет выдвигаться
      на восемь кварталов; апелляция — один раз. Громкие скандалы соперников тоже доходят до суда, и власть может их подтолкнуть.</p>
    <h3 class="sub">Внешняя политика: торговля, санкции, граница, визиты</h3>
    <p>Торговое соглашение открывает рынок соседа: внешний спрос и инвестиции растут, но одна группа проигрывает
      от конкуренции — и Сенат ратифицирует его голосами краёв, где эта группа сильна. Холодный сосед вводит санкции
      (внешний спрос и инвестиции падают): можно ответить зеркально, уступить или искать обход. Наши санкции радуют патриотов,
      бьют по бизнесу и ускоряют уступку в пограничном кризисе. Инцидент на границе греет приграничный край и сепаратистов:
      дипломатия, демонстрация силы (зависит от расходов на оборону, при неудаче — эскалация), посредник или уступка.
      Визит — это повестка: торговля с контрактом краю, граница и соотечественники или энергетика. У соседей меняется
      власть, а с ней и курс. Договоры, соглашения и санкции — дело кабинета, президента или министра иностранных дел.</p>
    <h3 class="sub">Края: мэры, просьбы, референдумы, сепаратизм</h3>
    <p>В столице каждого края свой мэр, и он не всегда из партии губернатора. Вражда растёт от разницы курсов и горячего края;
      в открытой войне центр может помирить их или встать на чью-то сторону, а губернатор или мэр — договориться,
      отстранить соперника или вынести войну на публику. Главы краёв шлют в центр просьбы: деньги на стройку, полномочия,
      исключение из закона, помощь против мэра — отказ обижает, уступка стоит казне или легитимности. Сепаратизм тянется
      к своему уровню: своя история края, напряжённость, низкая поддержка, обида на центр. Сильное движение назначает
      референдум — сначала о полномочиях, потом о суверенитете. Центр может разрешить, оспорить в суде, договориться
      заранее или ввести прямое управление. Автономный край оставляет часть налогов себе и его главу не снять из центра;
      суверенный не платит налоги вовсе, пока не подписан договор. Губернатор может сам назначить референдум о полномочиях.</p>
    <h3 class="sub">Бюджет как торг</h3>
    <p>У каждой фракции своя строка: статья, которую ждут её избиратели, или налог, который они ненавидят.
      Премьер вписывает строки на вкладке «Бюджет»: фракция голосует за бюджет охотнее, а сделка с её лидером дешевле —
      но каждая строка стоит казне денег. Коалиция без своей строки злится. Урезать обещанное до конца года — обман.
      Кто не правит, раз в бюджетный год может потребовать строку у чужого кабинета: чем нужнее ваши голоса, тем выше шанс.</p>
    <h3 class="sub">Соперники: блок, расколы, кампании</h3>
    <p>Против слабого кабинета оппозиция собирается в блок на восемь кварталов: его фракции голосуют против
      ваших законов и бюджета. Сделка с членом блока может его расколоть. Крупная партия в провале, в скандале
      или после поражения на выборах раскалывается — рождается новая фракция со своим лидером. Лидер в горящем
      скандале может уйти. В кампании соперники выбирают тему и тратят кассу — это видно в таблице гонки.</p>
    <h3 class="sub">Деловой климат</h3>
    <p>Отношение восьми групп капитала к власти двигает инвестиции. Группы отвечают на законы по своей теме,
      открывают заводы, сокращают людей и выводят капитал. Деловой совет поднимает климат, просьба о проекте
      приводит завод в ваш край. У изданий есть владельцы — газеты тянутся за отношением хозяев к вам.</p>
    <h3 class="sub">Жёсткая страна</h3>
    <p>Выбирается в настройках перед новой игрой: власти доверяют меньше, края горячее, потрясения чаще.</p>`;
}
/* справка с поиском: разделы по заголовкам, фильтр по любому слову */
let HELPQ='';
function tabHelp(){
  const parts=helpBody().split('<h3 class="sub">').filter(x=>x.trim());
  const q=HELPQ.trim().toLowerCase();
  const secs=parts.map(x=>{ const plain=x.replace(/<[^>]+>/g,' ').toLowerCase();
    const hit=!q||q.split(/\s+/).every(w=>plain.indexOf(w)>=0);
    return `<section class="help-s"${hit?'':' hidden'}><h3 class="sub">${x}</section>`; });
  const n=secs.filter(x=>x.indexOf(' hidden>')<0).length;
  return panel({cls:'info',title:'Как это работает',meta:q?'найдено разделов: '+n:parts.length+' разделов',
    body:`<div class="field help-q"><input type="search" id="helpq" placeholder="Поиск: сделка, клотур, съезд, скандал…" value="${HELPQ.replace(/"/g,'&quot;')}"></div>
      ${n?'':'<div class="empty">Ничего не нашлось. Попробуйте одно слово: «вето», «комитет», «влияние».</div>'}${secs.join('')}`});
}

/* ─── Конституция ────────────────────────────────────────────────
   Действующая редакция и то, чем за неё заплачено. Обычный закон
   говорит, что делать; конституционный — кто решает и как долго. */
function tabConst(){
  const c=CN(), l=legit(), log=(c.log||[]).slice().reverse(), cv=conv();
  /* ── действующая редакция по главам ── */
  const art=(n,name,val,note,warn)=>`<tr><td><b>${name}</b><div class="sub2">${note}</div></td>
    <td class="dim hide-s">${n}</td><td class="n ${warn?'warn':''}">${val}</td></tr>`;
  const CHTXT={
    1:[art('ст. 10','Форма правления',
        cnForm()==='parl'?'парламентская':cnForm()==='pres'?'президентская':'смешанная',
        cnForm()==='parl'?'глава государства представительствует, правит кабинет'
        :cnForm()==='pres'?'кабинет отвечает только перед президентом'
        :'власть поделена между президентом и палатами',cnForm()!=='semi'),
      art('ст. 105','Вес второй палаты',senBinding()?'вето окончательное':'вето отлагательное',
        senBinding()?'закон без согласия Сената не проходит':'Собрание преодолевает '+MAJ+' голосами',!senBinding()),
      art('ст. 95 ч. 3','Как избирают Сенат',senDirect()?'прямым голосованием':'заксобраниями краёв',
        senDirect()?'сенатор слушает список, а не край':'сенатор отвечает перед своим краем',senDirect())],
    2:[art('ст. 29 и 31','Свобода слова и собраний',rightsLock()?'под охраной суда':'по закону',
        rightsLock()?'ограничивающий закон отменяется судом':'объём прав задаётся обычным законом',rightsLock()),
      art('ст. 39 ч. 2','Социальный минимум',socFloor()?'уровень '+socFloor():'нет',
        socFloor()?'соцвыплаты и медицину ниже не опустить':'бюджетные статьи ничем не связаны',socFloor())],
    4:[art('ст. 81','Срок президента','раз в '+quarters(pTerm()),
        'избирается всей страной, отдельно от палат',pTerm()>PTERM),
      art('ст. 81 ч. 3','Ограничение сроков',termLimit()?termLimit()+' подряд':'нет',
        'предел для человека, не для партии',termLimit()===0),
      art('ст. 93','Отрешение',impH()+' и '+impS(),'Собрание обвиняет, Сенат судит',impS()<67),
      art('ст. 88','Чрезвычайные полномочия',emergOn()?'до '+dateLabel(c.emerg):'нет',
        'указ в полную силу закона',emergOn())],
    5:[art('ст. 96','Созыв Собрания',quarters(aTerm()),'избирается целиком по субъектам',aTerm()>TERM),
      art('ст. 95','Обновление Сената',c.senall?'целиком с Собранием':'треть раз в '+quarters(senCyc()),
        c.senall?'палата следует за большинством':'палата никогда не меняется вся сразу',c.senall||senCyc()>SEN_CYCLE),
      art('ст. 100','Порог клотура',cloture()+' из '+SEN_SEATS+(c.entrench?' · закреплён':''),
        c.entrench?'изменить можно только поправкой':'задан регламентом палаты',cloture()<CLOTURE),
      art('ст. 107','Преодоление вето',superN()+' из '+SEATS,
        superN()<=MAJ?'простое большинство':'две трети Собрания',superN()<=MAJ),
      art('ст. 109','Роспуск Собрания',c.dissolve==='none'?'запрещён':c.dissolve==='pm'?'у премьера':'у президента',
        'досрочные выборы без предвыборного штаба',c.dissolve!=='pres'),
      art('ст. 97','Отзыв депутата',c.recall?'разрешён':'нет','избиратели края против своего депутата',c.recall),
      art('ст. 104 ч. 2','Народная инициатива',c.initiative?'есть':'нет',
        c.initiative?'референдум вдвое дешевле':'вопрос выносит только власть',c.initiative)],
    6:[art('ст. 117','Вотум недоверия',
        noconfKind()==='none'?'упразднён':noconfKind()==='constructive'?'конструктивный':'обычный',
        noconfKind()==='none'?'кабинет держится президентом'
        :noconfKind()==='constructive'?'валят, только назвав преемника':'валят простым большинством',
        noconfKind()!=='plain'),
      art('ст. 114 ч. 4','Предел долга',debtCap()?debtCap()+' млрд':'нет',
        debtCap()?(debtOver()?'превышен на '+Math.round(debtOver())+' млрд':'соблюдается'):'долг ничем не связан',
        !!debtOver())],
    7:[art('ст. 125','Состав суда',courtN()+' судей','по статье '+courtTarget()+' · для отмены нужно '+courtMaj(),
        courtTarget()!==COURT_SIZE),
      art('ст. 128 ч. 3','Срок судьи',judgeLife()>=JUDGE_LIFE?'пожизненно':quarters(judgeLife()),
        'кресло, которое нельзя отобрать голосованием',judgeLife()<JUDGE_LIFE)],
    9:[art('ст. 135','Порог поправки',(c.needH||290)+' и '+(c.needS||67),
        (c.needH||290)<=261?'три пятых палат':'две трети обеих палат',(c.needH||290)<=261),
      art('ст. 135 ч. 2','Всенародное голосование',c.allref?'для каждой поправки':'для части поправок',
        c.allref?'палаты одни конституцию не меняют':'референдум требует не всякая статья',c.allref),
      art('ст. 135 ч. 3','Ядро конституции','главы 1, 2 и 9',
        'меняются только Конституционным собранием',false)],
  };
  const chBlocks=CN_CH.filter(x=>CHTXT[x.n]).map(x=>
    `<tr class="hd"><td colspan="3"><b>Глава ${x.n}. ${x.name}</b>${
      x.core?' <span class="tag">ядро</span>':''}<div class="sub2">${x.txt}</div></td></tr>`
    +CHTXT[x.n].join('')).join('');
  const table=`<table class="tight"><tbody>${chBlocks}</tbody></table>`;

  /* ── журнал ── */
  const hist=log.length?log.map(x=>
    `<tr><td><b>${x.name}</b><div class="sub2">${x.art} · гл. ${x.ch||5} · ${x.eff}${
      x.ref?' · референдум '+x.ref+'%':''}${x.conv?' · собрание':''}${x.own?' · от собрания':''}</div></td>
      <td class="n">${shortDate(x.q)}</td>
      <td class="n ${x.cost<0?'bad':'good'}">${sign(x.cost)}</td></tr>`).join('')
    :'<tr><td colspan="3" class="dim">Конституция в первоначальной редакции. Пока.</td></tr>';

  /* ── что можно внести палатами ── */
  const avail=cnList().slice(0,7).map(x=>{ const f=cnForecast(x), co=cnCost(x);
    return `<tr><td><b>${x.name}</b><div class="sub2">гл. ${x.ch||5} · ${x.eff}</div></td>
      <td class="n ${f.h>=f.needH?'good':'bad'} hide-s">${f.h}/${f.needH}</td>
      <td class="n ${f.s>=f.needS?'good':'bad'}">${f.s}/${f.needS}</td>
      <td class="n ${co<0?'bad':'good'}">${sign(co)}</td>
      <td class="r"><button class="btn sm" onclick="askAmendOne('${x.id}')"
        ${S.ap&&S.cap>=CN_CAP&&!convSitting()?'':'disabled'}>Вносить</button></td></tr>`;}).join('')
    ||'<tr><td colspan="5" class="dim">В обычных главах менять нечего: всё, что можно было, изменено.</td></tr>';

  /* ── ядро и собрание ── */
  const core=cnCoreList();
  const coreRows=core.slice(0,8).map(x=>{ const co=cnCost(x);
    const t=cv&&cv.stage==='sit'?convTally(x,0):null;
    return `<tr><td><b>${x.name}</b><div class="sub2">${x.art} · гл. ${x.ch} · ${x.eff}</div></td>
      <td class="n dim hide-s">${CH(x.ch).name}</td>
      <td class="n ${co<0?'bad':'good'}">${sign(co)}</td>
      ${t?`<td class="n ${t.pass?'good':'bad'}">${t.yes}/${CONV_MAJ}</td>`:'<td class="n dim">—</td>'}</tr>`;}).join('')
    ||'<tr><td colspan="4" class="dim">Ядро изменено настолько, насколько это вообще возможно.</td></tr>';

  const f=convCallForecast();
  const convPanel=cv&&cv.stage==='sit'
    ? panel({cls:'warn',title:'Конституционное собрание заседает',
        meta:CONV_SEATS+' делегатов · до '+dateLabel(cv.until),
        body:`<p class="lead">Пока собрание работает, палаты конституцию не трогают. Решение принимается
            ${CONV_MAJ} голосами из ${CONV_SEATS}, и снять пункт, внесённый самими делегатами, нельзя.</p>
          <div class="bar" style="height:14px;margin:8px 0 10px">${S.parties.slice()
            .sort((a,b)=>(cv.seats[b.id]||0)-(cv.seats[a.id]||0))
            .map(p=>`<i style="width:${(cv.seats[p.id]||0)/CONV_SEATS*100}%;background:${p.color}" title="${p.name}: ${cv.seats[p.id]||0}"></i>`).join('')}<span class="mid"></span></div>
          <div class="res"><span>У вас и союзников</span><b class="${convCoalSeats()>=CONV_MAJ?'good':'bad'}">${convCoalSeats()} из ${CONV_SEATS}</b>
            <span>В пакете</span><b>${cv.pkg.length} из ${CONV_PKG}</b>
            <span>Осталось заседать</span><b>${quarters(convLeft())}</b></div>`,
        foot:`<button class="btn pri" onclick="askConvPackage()">${cv.pkg.length?'Править пакет':'Внести пакет'}</button>
          <span class="hint">Не внесёте до срока — собрание разойдётся, и это ${CONV_FAIL} легитимности.</span>`})
    : panel({title:'Ядро конституции',meta:'главы 1, 2 и 9 · палатам не подведомственны',
        body:`<p class="lead">Основы строя, права человека и сам порядок пересмотра защищены от
            большинства: сколько бы голосов ни было у власти, эти главы она не откроет. Открывает их
            Конституционное собрание — ${CONV_SEATS} делегатов, избранных страной на один вопрос.</p>
          <div class="res"><span>Созыв: Собрание</span><b class="${f.h>=f.needH?'good':'bad'}">${f.h} из ${f.needH}</b>
            <span>Созыв: Сенат</span><b class="${f.s>=f.needS?'good':'bad'}">${f.s} из ${f.needS}</b>
            <span>Цена созыва</span><b>вес ${CONV_CAP} и ${CONV_GOLD} млрд</b>
            <span>Пунктов в пакете</span><b>до ${CONV_PKG}</b></div>
          <p class="hint">${cv&&cv.stage==='done'
            ? (cv.failed?'Прошлое собрание разошлось ни с чем. Палаты дадут три пятых не скоро.'
                        :'Прошлое собрание приняло новую редакцию '+shortDate(cv.until)+'.')
            : 'Собрание опасно тем, что оно не ваше: делегаты вправе приписать к пакету собственный пункт, и снять его вы не сможете.'}</p>`,
        foot:`<button class="btn pri" onclick="askConvene()" ${S.ap&&S.cap>=CONV_CAP&&S.treasury>=CONV_GOLD?'':'disabled'}>Созвать собрание<span class="cost">${CONV_CAP}</span></button>
          <span class="hint">Три пятых обеих палат.</span>`});

  /* ── надзор суда ── */
  const rev=(c.log||[]).filter(cnReviewable);
  const revPanel=panel({title:'Надзор суда',meta:'первые '+quarters(CN_REVIEW)+' после принятия',
    body:`<p class="hint" style="margin-top:0">Конституционный суд вправе отменить поправку, принятую
        палатами в свою пользу: ${courtMaj()} голосов из ${courtN()}. Он не трогает то, что утвердила
        страна на референдуме, и не трогает редакцию Конституционного собрания.</p>
      ${rev.length?'<div class="res">'+rev.map(e=>
        `<span>${e.name}</span><b class="${cnStrikeVotes(e)>=courtMaj()?'bad':'good'}">${cnStrikeVotes(e)} из ${courtN()} за отмену</b>`).join('')+'</div>'
       :'<p class="hint">Под надзором сейчас ничего: свежих поправок, принятых в свою пользу, нет.</p>'}`});

  return panel({cls:l<LEGIT_LOW?'warn':'info',title:'Конституция Новарии',
    meta:(c.log||[]).length?'редакция с '+plural((c.log||[]).length,'поправкой','поправками','поправками'):'первоначальная редакция',
    body:`<div class="cols c12"><div>
      <div class="stat ${l<LEGIT_LOW?'bad':''}"><i>легитимность строя</i><div class="v">${l}</div>
        <span>${legitWord(l)}</span></div>
      ${bar([[l,l<LEGIT_CR?'var(--bad)':l<LEGIT_LOW?'var(--mark)':'var(--ink-2)']],12)}
     </div><div>
      <p class="lead">Обычный закон говорит, что делать. Конституционный — кто решает и как долго.
        Девять глав, и три из них — ядро: основы строя, права человека и сам порядок пересмотра.
        Шесть обычных глав переписывают палаты, ядро — только собрание, избранное страной.</p>
      <div class="res"><span>Поправок принято</span><b>${(c.log||[]).length}</b>
        <span>Порог поправки</span><b>${(c.needH||290)} и ${(c.needS||67)}${c.allref?' · всегда референдум':''}</b>
        <span>Черта доверия</span><b class="${l<LEGIT_LOW?'bad':''}">${LEGIT_LOW}</b>
        <span>Черта кризиса</span><b class="${l<LEGIT_CR?'bad':''}">${LEGIT_CR}</b></div>
      <p class="hint">${l<LEGIT_CR
        ? 'Ниже этой черты края перестают исполнять решения центра: начинается конституционный кризис.'
        : l<LEGIT_LOW
        ? 'Вера в правила ушла ниже черты: напряжённость растёт сама, интеллигенция и город отворачиваются, соседи холодеют.'
        : 'Цена поправки — не вес, а вера в правила. Её труднее вернуть, чем рейтинг.'}</p>
     </div></div>`,
    foot:`<button class="btn pri" onclick="askAmend()" ${S.ap&&S.cap>=CN_CAP&&!convSitting()?'':'disabled'}>Внести поправку<span class="cost">${CN_CAP}</span></button>
      <button class="btn" onclick="askConvene()" ${S.ap&&S.cap>=CONV_CAP?'':'disabled'}>Конституционное собрание<span class="cost">${CONV_CAP}</span></button>
      <span class="hint">Президент поправку не подписывает и не отклоняет.</span>`})
  +`<div class="cols c21"><div>`
  +panel({title:'Действующая редакция',meta:'девять глав · что и где записано',flush:true,body:table})
  +panel({title:'Что можно внести палатами',meta:'обычные главы · прогноз голосов и цена легитимности',flush:true,
    body:`<div class="scrollx"><table class="tight"><thead><tr><th>Поправка</th>
      <th class="n hide-s">Собрание</th><th class="n">Сенат</th><th class="n">Лег.</th><th></th></tr></thead>
      <tbody>${avail}</tbody></table></div>`})
  +panel({title:'Ядро: что открыто для собрания',meta:plural(core.length,'статья','статьи','статей')+' в главах 1, 2 и 9',flush:true,
    body:`<div class="scrollx"><table class="tight"><thead><tr><th>Поправка</th>
      <th class="n hide-s">Глава</th><th class="n">Лег.</th><th class="n">Собрание</th></tr></thead>
      <tbody>${coreRows}</tbody></table></div>`})
  +`</div><div>`
  +convPanel
  +panel({title:'Принятые поправки',meta:plural((c.log||[]).length,'поправка','поправки','поправок')+' в силе',flush:true,
    body:`<table class="tight"><tbody>${hist}</tbody></table>`})
  +revPanel
  +panel({title:'Как проходит поправка',
    body:`<div class="path">
        <div class="stg ok"><i>Собрание</i><b>${(c.needH||290)<=261?'три пятых':'две трети'}</b><u>${c.needH||290} из ${SEATS}</u><span class="stamp y">1</span></div>
        <div class="stg ok"><i>Сенат</i><b>${(c.needS||67)<=60?'три пятых':'две трети'}</b><u>${c.needS||67} из ${SEN_SEATS}</u><span class="stamp y">2</span></div>
        <div class="stg ok"><i>Страна</i><b>${c.allref?'для каждой':'для части поправок'}</b><u>&gt; 50%</u><span class="stamp y">3</span></div>
      </div>
      <div class="path" style="margin-top:8px">
        <div class="stg"><i>Ядро · гл. 1, 2, 9</i><b>созыв собрания</b><u>${CONV_CALL_H} и ${CONV_CALL_S}</u><span class="stamp">1</span></div>
        <div class="stg"><i>Делегаты</i><b>выборы по стране</b><u>${CONV_SEATS} мандатов</u><span class="stamp">2</span></div>
        <div class="stg"><i>Пакет</i><b>простое большинство</b><u>${CONV_MAJ} из ${CONV_SEATS}</u><span class="stamp">3</span></div>
      </div>
      <p class="hint" style="margin-top:8px">Депутат голосует здесь не о пользе, а о власти: фракция весит
        больше всего остального, а старейшины Сената конституцию трогать не любят вовсе. Делегат собрания —
        наоборот: он избран на один вопрос и смотрит на страну, а не на фракцию.</p>`})
  +`</div></div>`;
}

/* ─── Правители ──────────────────────────────────────────────────
   Кто сидел в кресле, в какие годы и что после себя оставил.
   Достижение не выдумано: оно посчитано по тому, что за срок
   изменилось в стране. */
function tabHist(){
  const R0=rulers();
  const row=r=>`<tr class="${r.you?'mine':''}">
    <td><b>${r.name}</b>${r.you?' <span class="tag y">вы</span>':''}
      <div class="sub2">${P(r.party)?P(r.party).name:'—'}${r.how?' · '+r.how:''}</div></td>
    <td class="n">${reignYears(r)}</td>
    <td class="n hide-s">${r.to?quarters(r.to-r.from):'идёт'}</td>
    <td>${r.note||'<span class="dim">срок не окончен</span>'}</td></tr>`;
  const pres=R0.pres.slice().reverse().map(row).join('')
    ||'<tr><td colspan="4" class="dim">Ещё никто не успел уйти.</td></tr>';
  const pm=R0.pm.slice().reverse().slice(0,14).map(row).join('')
    ||'<tr><td colspan="4" class="dim">Кабинетов ещё не было.</td></tr>';
  const cur=R0.pres.find(x=>!x.to);
  const yours=R0.pres.filter(x=>x.you).length;
  const amend=(CN().log||[]).slice().reverse().map(x=>
    `<div class="crow"><s>${shortDate(x.q)}</s><span><b>${x.name}</b>
      <b class="num-s ${x.cost<0?'bad':'good'}">${sign(x.cost)}</b>
      <div class="sub2">${x.art} · ${x.eff}</div></span></div>`).join('')
    ||'<div class="dim">Конституция не менялась.</div>';

  return panel({cls:'lead-p',title:'Правители Новарии',
    meta:'с '+2029+' года · '+plural(R0.pres.length,'президент','президента','президентов'),
    body:`<div class="cols c12"><div>
      <div class="stat"><i>${cur?(P(cur.party)?P(cur.party).name:'') :'кресло пусто'}</i>
        <div class="v" style="font-family:var(--f-display);font-size:26px;letter-spacing:0">${cur?cur.name:'—'}</div>
        <span>${cur?'в кресле с '+shortDate(cur.from)+' · '+quarters(S.q-cur.from):''}</span></div>
     </div><div>
      <p class="lead">Кресло переживает того, кто в нём сидит. Здесь записано, кто им владел,
        в какие годы и что оставил после себя, — достижение не выдумано, оно посчитано по тому,
        что за срок изменилось в стране.</p>
      <div class="res"><span>Президентов всего</span><b>${R0.pres.length}</b>
        <span>Из них ваших</span><b class="${yours?'good':''}">${yours}</b>
        <span>Кабинетов сменилось</span><b>${R0.pm.length}</b>
        <span>Поправок к конституции</span><b class="${(CN().log||[]).length?'warn':''}">${(CN().log||[]).length}</b>
        <span>Отрешений</span><b class="${R0.pres.filter(x=>x.how==='импичмент').length?'bad':''}">${
          R0.pres.filter(x=>x.how==='импичмент').length}</b>
        <span>Досрочных передач</span><b>${R0.pres.filter(x=>x.how==='наследование').length}</b></div>
     </div></div>`})
  +`<div class="cols c21"><div>`
  +panel({title:'Президенты',meta:'кто, когда и чем запомнился',flush:true,
    body:`<div class="scrollx"><table><thead><tr><th>Президент</th><th class="n">Годы</th>
      <th class="n hide-s">Срок</th><th>Достижение</th></tr></thead><tbody>${pres}</tbody>
      <caption>Достижение выбирается из того, что за срок сдвинулось сильнее всего: хозяйство,
        напряжённость, законы, указы, вето, поправки к конституции.</caption></table></div>`})
  +panel({title:'Главы правительства',meta:'последние четырнадцать',flush:true,
    body:`<div class="scrollx"><table class="tight"><tbody>${pm}</tbody></table></div>`})
  +`</div><div>`
  +panel({title:'Изменения конституции',meta:plural((CN().log||[]).length,'поправка','поправки','поправок'),flush:true,
    body:`<div class="career" style="max-height:420px">${amend}</div>`,
    foot:`<button class="btn sm" data-go="const">К конституции</button>`})
  +panel({title:'Летопись',meta:'важнейшее',flush:true,
    body:`<div class="career" style="max-height:300px">${S.chron.slice(0,18).map(c=>
      `<div class="crow"><s>${shortDate(c.q)}</s><span class="${c.k==='g'?'good':c.k==='b'?'bad':''}">${c.t}</span></div>`).join('')
      ||'<div class="dim">Пока ничего.</div>'}</div>`,
    foot:`<button class="btn sm" data-go="arch">Вся летопись</button>`})
  +`</div></div>`;
}

/* ════════════════════════════════════════════════════════════════
   ТИТУЛЬНЫЙ ЭКРАН
   Не обложка, а первая полоса. Меню — указатель номера, передовица
   набрана серифом, страна показана гравюрой карты, а четыре нижние
   колонки объясняют, о чём игра. Та же бумага и те же линейки, что
   внутри: разворот меняется, издание остаётся тем же.
   ════════════════════════════════════════════════════════════════ */

/* иконки указателя — та же обводка 1.7, что у разделов игры */
const MICON={
  play:'<path d="M7.5 4.6 19 12 7.5 19.4z"/>',
  load:'<path d="M3 6.4A1.4 1.4 0 0 1 4.4 5h4.9l1.9 2.2h8.4A1.4 1.4 0 0 1 21 8.6V18a1.4 1.4 0 0 1-1.4 1.4H4.4A1.4 1.4 0 0 1 3 18z"/>',
  book:'<path d="M3 4.6h7.1c1 0 1.9.8 1.9 1.9V20c0-.9-.8-1.6-1.9-1.6H3zM21 4.6h-7.1c-1 0-1.9.8-1.9 1.9V20c0-.9.8-1.6 1.9-1.6H21z"/><path d="M12 6.5V20"/>',
  stat:'<path d="M3 20.4h18"/><path d="M5.6 20.4v-7.2M10.4 20.4V7.6M15.2 20.4v-5.4M20 20.4V9.8"/>',
  gear:'<circle cx="12" cy="12" r="3.1"/><path d="m12 2.6 1.7.8.8 1.8 2 .3 1 1.7-.9 1.8.9 1.8-1 1.7-2 .3-.8 1.8-1.7.8-1.7-.8-.8-1.8-2-.3-1-1.7.9-1.8-.9-1.8 1-1.7 2-.3.8-1.8z"/>',
  exit:'<path d="M12.6 3.6H4v16.8h8.6"/><path d="M15.4 8.2 19.6 12l-4.2 3.8M9.4 12h10"/>',
  grid:'<path d="M3.6 3.6h7.2v7.2H3.6zM13.2 3.6h7.2v7.2h-7.2zM3.6 13.2h7.2v7.2H3.6zM13.2 13.2h7.2v7.2h-7.2z"/>',
  info:'<circle cx="12" cy="12" r="8.6"/><path d="M12 11v6"/><circle cx="12" cy="7.6" r=".95" fill="currentColor" stroke="none"/>',
};
const mi=k=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">${MICON[k]||''}</svg>`;

/* ─── карта страны гравюрой ───────────────────────────────────────
   Та же геометрия, что в разделе регионов, но без игровых цветов:
   на титуле страна ещё никем не управляется, и красить её нечем.
   Тон задаёт только освоенность края. */
function menuMap(){
  const paths=REGIONS.map(r=>{const g=GEO[r.id];
    return `<path class="rg d${r.dev}" d="${g.d}"><title>${r.name} · ${r.cap} · ${r.pop} млн</title></path>`;}).join('');
  const marks=REGIONS.map(r=>{const g=GEO[r.id];
    return `<circle class="dot" cx="${g.c[0]}" cy="${g.c[1]}" r="${r.capital?6:3.6}"/>`+
      (r.capital?`<circle class="dot" cx="${g.c[0]}" cy="${g.c[1]}" r="11" fill="none" stroke="var(--ink)" stroke-width="1.1"/>`:'');}).join('');
  const labels=REGIONS.map(r=>{const g=GEO[r.id];
    return `<text class="cap" x="${g.c[0]}" y="${g.c[1]+30}" text-anchor="middle">${r.cap}</text>`;}).join('');
  return `<div class="mn-map"><svg viewBox="0 0 920 ${MAP_H}" preserveAspectRatio="xMidYMid meet"
    aria-label="Карта Новарии">
    ${paths}${marks}${labels}</svg></div>`;
}
/* ─── виньетки нижних колонок ─────────────────────────────────────
   Штриховые, без заливок: газета печатает гравюру, а не фотографию. */
function cardArt(kind){
  const st='fill="none" stroke="var(--ink)" stroke-width="1.3" stroke-linejoin="round"';
  const art={
    gov:`<g ${st}><path d="M100 14 56 36h88z"/><path d="M60 36v44M76 36v44M92 36v44M108 36v44M124 36v44M140 36v44"/>
      <path d="M50 80h100M46 86h108"/><path d="M100 14v-6"/><circle cx="100" cy="5" r="3"/>
      <path d="M20 86h160"/></g>
      <g stroke="var(--ink-3)" stroke-width=".7"><path d="M64 44v28M80 44v28M96 44v28M112 44v28M128 44v28"/></g>`,
    rise:`<g ${st}><path d="M18 84h164"/><path d="M26 72l30-26 22 18 30-38 26 30 34-34"/>
      <circle cx="26" cy="72" r="3"/><circle cx="56" cy="46" r="3"/><circle cx="78" cy="64" r="3"/>
      <circle cx="108" cy="26" r="3"/><circle cx="134" cy="56" r="3"/><circle cx="168" cy="22" r="3"/>
      <path d="M150 22h18v18"/></g>
      <g stroke="var(--ink-3)" stroke-width=".7"><path d="M18 62h164M18 42h164"/></g>`,
    people:`<g ${st}>${Array.from({length:7},(_,i)=>{
        const x=24+i*25, h=30+((i*9)%18);
        return `<circle cx="${x}" cy="${76-h-9}" r="7"/><path d="M${x-9} 76v-${h}a9 9 0 0 1 18 0v${h}z"/>`;
      }).join('')}<path d="M10 86h180"/></g>`,
    star:`<g ${st}><path d="M100 10 112 44l36 .5-28.5 21.5 10.5 34L100 79l-30 21 10.5-34L52 44.5l36-.5z"/>
      <path d="M18 86h164"/><path d="M34 86V64M50 86V52M66 86V70M134 86V58M150 86V72M166 86V62"/></g>
      <g stroke="var(--ink-3)" stroke-width=".7"><path d="M26 78h148"/></g>`,
  }[kind]||'';
  return `<svg class="art" viewBox="0 0 200 92" preserveAspectRatio="xMidYMid meet" aria-hidden="true">${art}</svg>`;
}

/* ─── сборка полосы ──────────────────────────────────────────── */
const MN_CARDS=[
  {k:'gov',   t:'Управляй',  p:'Развивай регионы, принимай решения, меняй страну.'},
  {k:'rise',  t:'Развивай',  p:'Экономика, инфраструктура, образование, технологии.'},
  {k:'people',t:'Объединяй', p:REGIONS.length+' регионов — одна сильная Новария.'},
  {k:'star',  t:'Создавай будущее', p:'Твои решения формируют историю.'},
];
function menuItem(n,ic,title,sub,fn,on,off){
  return `<button class="mn-btn ${on?'on':''} ${off?'off':''}" ${off?'disabled':''} onclick="${fn}">
    <em>${n}</em><span><b>${title}</b><s>${sub}</s></span>${mi(ic)}</button>`;
}
/* Виньетка карты обрезается по фактическим границам страны: исходный
   бокс рассчитан на разворот с легендой, и на полосе от него остаётся
   пустое поле вокруг. Меряем после вставки — своей же геометрией. */
function fitMenuMap(){
  const svg=document.querySelector('.mn-map svg'); if(!svg)return;
  try{
    const b=svg.getBBox(); if(!b.width||!b.height)return;
    const m=10;
    svg.setAttribute('viewBox',
      (b.x-m).toFixed(1)+' '+(b.y-m).toFixed(1)+' '+(b.width+m*2).toFixed(1)+' '+(b.height+m*2).toFixed(1));
  }catch(e){}
}
function showMenu(){
  const el=document.getElementById('menu'); if(!el)return;
  const has=hasSave();
  el.hidden=false; el.classList.remove('gone');
  el.innerHTML=`<div class="mn-sheet">
    <div class="mn-top">
      <span>Выпуск первый · зима 2029 · цена — ваш голос</span>
      <div class="mn-tools"><span class="mn-ver">v ${GAME_VER}</span>
        <button title="Разделы игры" onclick="menuAbout()">${mi('grid')}</button>
        <button title="Показатели" onclick="menuStats()">${mi('stat')}</button>
        <button title="Об игре" onclick="menuCredits()">${mi('info')}</button>
        <button title="Настройки" onclick="menuSettings()">${mi('gear')}</button></div>
    </div>

    <div class="mn-head">
      <img class="mn-flag" src="${FLAG}" alt="Флаг Республики Новария">
      <div class="mn-name"><i>Республика</i><h1>НОВАРИЯ</h1>
        <u>Единая страна. Сильные регионы.</u></div>
      <div class="mn-est">Политический симулятор<br>полупрезидентской<br>республики</div>
    </div>

    <div class="mn-body">
      <div class="mn-col">
        <div class="mn-cap">С чего начать</div>
        ${menuItem('01','play','Новая игра','Начните путь к развитию страны','menuNew()',true)}
        ${menuItem('02','load','Продолжить',has?'Загрузить последнее сохранение':'Сохранения пока нет','menuContinue()',false,!has)}
        ${menuItem('03','book','О стране','История, регионы, экономика','menuAbout()')}
        ${menuItem('04','stat','Статистика','Показатели и достижения','menuStats()')}
        ${menuItem('05','gear','Настройки','Интерфейс и сохранение','menuSettings()')}
        ${menuItem('06','exit','Выход','До новых встреч','menuExit()')}
        <div class="mn-keys"><i>Управление</i>
          <div><span>Разделы</span><b>1—9</b></div>
          <div><span>Листать разделы</span><b>← →</b></div>
          <div><span>Завершить квартал</span><b>Q</b></div>
          <div><span>Действий в квартале</span><b>3</b></div></div>
      </div>

      <div class="mn-col">
        <div class="mn-cap">Передовица</div>
        <p class="mn-lead">Большие возможности начинаются здесь.</p>
        <p class="mn-dek">Одиннадцать субъектов от Балтики до Тихоокеанска, две палаты, президент
          со своим сроком и правительство, отвечающее перед нижней палатой. Власть здесь намеренно
          не сходится в одних руках: большинство в одной палате почти никогда не означает
          большинства в другой.</p>
        <div class="mn-quote">«Сильная страна — это не территория, а люди, которые в неё верят»
          <b>надпись на гранитной плите у Собрания</b></div>
        ${menuMap()}
      </div>

      <div class="mn-col">
        <div class="mn-cap">В номере</div>
        <div class="mn-facts">
          <div><span>Субъектов</span><b>${REGIONS.length}</b></div>
          <div><span>Народное собрание</span><b>${SEATS}</b></div>
          <div><span>Сенат</span><b>${SEN_SEATS}</b></div>
          <div><span>Созыв</span><b>${TERM} кв.</b></div>
          <div><span>Президентский срок</span><b>${PTERM} кв.</b></div>
          <div><span>Групп избирателей</span><b>${GROUPS.length}</b></div>
          <div><span>Тем законов</span><b>${TOPICS.length}</b></div>
          <div><span>Поправок к конституции</span><b>${CONSTS.length}</b></div>
          <div><span>Групп капитала</span><b>${FIRMS.length}</b></div>
          <div><span>Разделов</span><b>${TABS.length}</b></div>
        </div>
        ${has?`<div class="mn-save"><i>В памяти</i><b>${savedName()}</b>
          <s>Продолжить можно вторым пунктом указателя.</s></div>`
        :`<div class="mn-save"><i>В памяти</i><b>Пусто</b>
          <s>Сохранение появится после первого квартала.</s></div>`}
      </div>
    </div>

    <div class="mn-cards">${MN_CARDS.map(c=>`<div class="mn-card">${cardArt(c.k)}
      <b>${c.t}</b><p>${c.p}</p></div>`).join('')}</div>

    <div class="mn-foot"><span>Республика Новария · стратегия развития</span>
      <span>Сегодня — решения. Завтра — сильная Новария.</span></div>
  </div>`;
  fitMenuMap();
}
function hideMenu(){
  const el=document.getElementById('menu'); if(!el)return;
  el.classList.add('gone');
  setTimeout(()=>{ el.hidden=true; el.innerHTML=''; },340);
}
