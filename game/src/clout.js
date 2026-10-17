
/* ════════════════════════════════════════════════════════════════
   ВЛИЯНИЕ
   Личный капитал связей: кто вам должен, кто вас слушает, чьи звонки
   принимают. Он копится от работы, но чем он выше, тем труднее
   прибавить — и тем дороже содержание: уровень кресла тянет его к
   себе, а на вершине начинают завидовать. Влияние можно потратить:
   «кулуарные ходы» меняют цену сделок, гасят скандал, закрепляют
   фракцию. Оно нужно всем креслам, а не только тем, кто рвётся к
   лидерству: от него зависят сделки, ратификация, верность министров
   и безопасность самого лидера партии.
   ════════════════════════════════════════════════════════════════ */
const INF_TIERS=[
  {at:0,  name:'Никто',               perk:'вас не знают за пределами своей фракции'},
  {at:20, name:'Свой в узком кругу',  perk:'открыты ходы «Должники», «Прикрыть своего», «Канал в печати»'},
  {at:40, name:'Заметная фигура',     perk:'лидеры фракций сбавляют цену сделок; открыты «Дело по звонку» и «Делегаты»'},
  {at:60, name:'Влиятельный',         perk:'+1 вес каждый квартал; сенаторы охотнее ратифицируют; открыт «Свой человек в кабинет»'},
  {at:80, name:'Кулуарный лидер',     perk:'+2 веса в квартал, но завистники плетут заговоры, а содержание связей дорого'},
];
const INF_ENVY=80;
const INF_BASE={pres:72,pm:64,vp:56,vice:56,lead:50,gov:50,min:46,sen:46,dep:36,mayor:34,none:22};
function infTier(v){ let t=INF_TIERS[0]; INF_TIERS.forEach((x,i)=>{ if(v>=x.at)t={...x,id:i}; }); if(t.id===undefined)t={...INF_TIERS[0],id:0}; return t; }
function infNow(){ return S.you?S.you.inf:0; }
/* какой уровень влияния даёт само кресло: от него влияние тянется вниз и вверх */
function infBase(){
  const b=(INF_BASE[mySeat()]||30)+(approval()-50)*0.2+(rep('folk')-50)*0.1+(chief()?6:0);
  return clamp(b,10,88);
}
/* чем выше влияние, тем труднее прибавить: на 70 — треть, на 90 — седьмая часть */
function infMul(){ return clamp(1.15-infNow()/90,0.15,1.1); }
function infLedger(){ const y=S.you; if(!y.infL||y.infL.q!==S.q)y.infL={q:S.q,plus:0,minus:0,src:{}}; return y.infL; }
/* прибавить или отнять влияние; raw — без убывающей отдачи (потери и содержание) */
function infAdd(v,why,raw){
  const y=S.you; if(!y||!v)return 0;
  if(y.inf==null)y.inf=30;
  const d=r1(v>0&&!raw?v*infMul():v), old=y.inf;
  y.inf=clamp(r1(old+d),0,100);
  const real=r1(y.inf-old), l=infLedger();
  if(real>0)l.plus=r1(l.plus+real); else l.minus=r1(l.minus-real);
  if(why)l.src[why]=r1((l.src[why]||0)+real);
  return real;
}
/* ─── квартал влияния ───────────────────────────────────────────── */
function infTick(){
  const y=S.you; if(!y)return;
  if(y.inf==null)y.inf=30;
  infLedger();
  const base=infBase(), d=desk();
  // выше уровня кресла связи дороги в содержании, ниже — обрастают сами
  infAdd((base-y.inf)*(y.inf>base?0.14:0.07),y.inf>base?'содержание связей':'связи обрастают',true);
  infAdd((d.score-50)*0.02,'работа кресла');
  const t=infTier(y.inf);
  if(t.id>=3)addCap(t.id-2);
  if(y.infT!==undefined&&t.id!==y.infT){ logMsg('Влияние: теперь вы — «'+t.name.toLowerCase()+'».',1); if(t.id>y.infT)chron('Рост влияния: '+t.name.toLowerCase()+'.',''); }
  y.infT=t.id;
  if(y.congBoost&&!(S.q%8))y.congBoost=Math.max(0,y.congBoost-0.05);
  infEnvyTick();
}
/* на вершине завидуют: лидер партии или фракция решает, что вы слишком выросли */
function infEnvyTick(){
  const y=S.you;
  if(y.inf<INF_ENVY||S.q-(y.envyQ===undefined?-9:y.envyQ)<6||Math.random()>0.14)return;
  y.envyQ=S.q;
  const who=chief()?'фракция':'лидер партии '+me().leader;
  sheetOpen({eye:'Партия · '+dateLabel(),title:'Завистники',
    body:`<p class="lead">Влияние ${Math.round(y.inf)}: вас слишком хорошо слышно. ${chief()?'Во фракции шепчутся, что пора делить власть.':
        me().leader+' всё чаще называет вас «амбициозным».'}</p>
      <div class="res"><span>Влияние</span><b>${Math.round(y.inf)} · ${infTier(y.inf).name.toLowerCase()}</b>
        <span>Недовольны</span><b class="w">${who}</b></div>`,
    opts:[{label:'Показать силу',hint:'ход · влияние −8 · твёрдость +2 · завистники притихнут',fn(){ if(!pay({ap:1},'Показать силу'))return;
        infAdd(-8,'зависть',true); bumpRep('firm',2); S.deputies.filter(d=>d.party===PL).forEach(d=>d.loyal=clamp(d.loyal+1,0,100)); render(); }},
      {label:'Поделиться местами',hint:'влияние −14 · '+(chief()?'фракция довольна':'лидер доволен'),fn(){
        infAdd(-14,'зависть',true); if(chief())S.deputies.filter(d=>d.party===PL).forEach(d=>d.rel=clamp(d.rel+2,0,100)); else y.lrel=clamp(y.lrel+8,0,100); render(); }},
      {label:'Не замечать',hint:'50%: заговор — влияние −14, вес −8',fn(){
        if(Math.random()<0.5){ infAdd(-14,'заговор',true); addCap(-8); if(!chief())y.lrel=clamp(y.lrel-10,0,100); logMsg('Завистники ударили: влияние и вес потеряны.',1); } }}]});
}

/* ─── кулуарные ходы: влияние тратится ─────────────────────────── */
const CLOUT_MOVES=[
  {id:'debtors', name:'Должники', cost:10, tier:1, txt:'два десятка депутатов и сенаторов теплеют к вам (+4): голоса станут дешевле'},
  {id:'cover',   name:'Прикрыть своего', cost:12, tier:1, txt:'остудить ваш скандал, придержать следствие или стереть часть следа'},
  {id:'press',   name:'Канал в печати', cost:10, tier:1, txt:'дружеское издание пишет за вас; одно враждебное теплеет'},
  {id:'call',    name:'Дело по звонку', cost:14, tier:2, txt:'следующий раунд переговоров с фракцией — без хода и без веса'},
  {id:'guard',   name:null, cost:18, tier:2, txt:null},
  {id:'own',     name:'Свой человек в кабинет', cost:16, tier:3, txt:'слабый министр заменён сильным и преданным — без веса и Сената', only:()=>isPM()},
];
function cloutMoveInfo(m){
  if(m.id==='guard')return chief()?{name:'Закрепить фракцию',txt:'снять вызов лидерству и на год закрыть путь новым'}:{name:'Собрать делегатов',txt:'на ближайшем съезде шансы +15%'};
  return {name:m.name,txt:m.txt};
}
function askClout(){
  const y=S.you, t=infTier(y.inf);
  const opts=CLOUT_MOVES.filter(m=>!m.only||m.only()).map(m=>{ const i=cloutMoveInfo(m), lock=t.id<m.tier?'нужен уровень «'+INF_TIERS[m.tier].name.toLowerCase()+'»':y.inf<m.cost?'не хватает влияния':null;
    return {label:i.name+' · '+m.cost,hint:lock||i.txt,fn(){ cloutDo(m.id); }}; });
  opts.push({label:'Закрыть',hint:'',fn(){}});
  sheetOpen({eye:'Кулуарные ходы · 1 действие',title:'Потратить влияние',
    body:`<p class="lead">Влияние — не только счёт, но и ресурс: звонок, услуга, напоминание о долге. Каждый ход стоит действия и части влияния.</p>
      <div class="res"><span>Влияние</span><b>${Math.round(y.inf)} · ${t.name.toLowerCase()}</b><span>Услуга за звонок</span><b>${y.favor&&y.favor.deal&&y.favor.until>=S.q?'ждёт':'нет'}</b></div>`,opts});
}
function cloutDo(id){
  const m=CLOUT_MOVES.find(z=>z.id===id), y=S.you, t=infTier(y.inf);
  if(t.id<m.tier){ toast('Нужен уровень «'+INF_TIERS[m.tier].name.toLowerCase()+'»'); return; }
  if(y.inf<m.cost){ toast('Не хватает влияния: нужно '+m.cost); return; }
  if(!pay({ap:1},cloutMoveInfo(m).name))return;
  infAdd(-m.cost,'ход влияния: '+cloutMoveInfo(m).name.toLowerCase(),true);
  let msg='';
  if(id==='debtors'){ let n=0; S.deputies.concat(S.senate).filter(x=>!x.you).sort(()=>Math.random()-0.5).slice(0,22).forEach(x=>{ x.rel=clamp(x.rel+4,0,100); n++; }); msg='Должники: '+n+' человек вспомнили, что вам обязаны.'; }
  if(id==='cover'){
    const sc=scMine().sort((a,b)=>b.heat-a.heat)[0];
    if(sc){ sc.heat=Math.max(0,sc.heat-25); msg='Скандал «'+sc.title+'» приглушён: температура −25.'; }
    else if(S.probe){ S.probe.ev=Math.max(0,S.probe.ev-18); msg='Следствие придержано: улики −18.'; }
    else { addTrail(-6,'прикрыли'); msg='Часть следа от сделок стёрта.'; }
  }
  if(id==='press'){ pressAll(1.5); const o=PRESS.slice().sort((a,b)=>pressOf(a.id).rel-pressOf(b.id).rel)[0]; pressOf(o.id).rel=clamp(pressOf(o.id).rel+8,0,100); msg='Канал в печати: «'+o.name+'» подобрела.'; }
  if(id==='call'){ y.favor={deal:1,until:S.q+2}; msg='Звонок сделан: ближайшие переговоры с фракцией — бесплатно.'; }
  if(id==='guard'){
    if(chief()){ S.challenge=null; y.guard=S.q+4; msg='Фракция закреплена: вызова не будет ближайший год.'; }
    else { y.congBoost=0.15; msg='Делегаты съезда обработаны: шансы +15%.'; } }
  if(id==='own'){
    const post=POSTS.map(p=>p.id).filter(k=>minOf(k)&&!minOf(k).you).sort((a,b)=>minComp(minOf(a))-minComp(minOf(b)))[0];
    if(post){ const old=minOf(post), m2=makeMinister(post,old.party); m2.comp=clamp(ri(68,90),20,95); m2.loyal=clamp(ri(72,92),0,100);
      S.ministers[post]=m2; if(S.fvp===post)S.fvp=null; S.pm.reshuffles=(S.pm.reshuffles||0)+1;
      if(old.party!==PL&&S.partners[old.party])S.partners[old.party].anger=clamp(S.partners[old.party].anger+0.8,0,6);
      msg='Свой человек в кабинете: '+POSTS.find(p=>p.id===post).name.toLowerCase()+' — '+m2.name+'.'; } }
  logMsg(msg,1); toast(msg.length>60?'Ход влияния сделан':msg); render();
}
/* пользуются услугой на переговорах */
function cloutFavor(){
  const f=S.you&&S.you.favor; if(!f||!f.deal||f.until<S.q)return false;
  f.deal=0; return true;
}
/* влияние ощущают другие системы */
function cloutDealDisc(){ return Math.max(0,(infNow()-35))*0.05; }
function cloutRatLean(){ return (infNow()-50)*0.03; }
function cloutMinLoyal(){ return (infNow()-50)*0.06; }

/* ─── панель «Влияние» ─────────────────────────────────────────── */
function infPanel(){
  const y=S.you, t=infTier(y.inf), L=infLedger(), next=INF_TIERS[t.id+1], base=Math.round(infBase());
  const src=Object.entries(L.src).filter(e=>Math.abs(e[1])>=0.1).sort((a,b)=>Math.abs(b[1])-Math.abs(a[1])).slice(0,4);
  const ticks=INF_TIERS.slice(1).map(x=>`<u style="left:${x.at}%"><i>${x.at}</i></u>`).join('');
  return panel({cls:y.inf>=INF_ENVY?'warn':'',title:'Влияние',meta:t.name,body:
    `<div class="cols c12"><div>
       <div class="stat"><i>индекс влияния</i><div class="v">${Math.round(y.inf)}<u>из 100</u></div><span>${next?'до «'+next.name.toLowerCase()+'» — '+(next.at-Math.round(y.inf)):'выше некуда — теперь удержать'}</span></div>
     </div><div>
       <div class="infbar"><b style="width:${y.inf}%"></b><s style="left:${base}%" title="уровень кресла"></s>${ticks}</div>
       <div class="res" style="margin-top:14px"><span>Уровень кресла</span><b>${base}</b>
         <span>За квартал</span><b class="${L.plus-L.minus>=0?'good':'bad'}">${sign(r1(L.plus-L.minus))}</b>
         ${src.map(e=>`<span>${e[0]}</span><b class="${e[1]<0?'bad':'good'}">${sign(e[1])}</b>`).join('')}</div>
     </div></div>
     ${spark('clout','var(--gold)','Влияние по кварталам',v=>Math.round(v))}
     <h3 class="sub">Что даёт влияние</h3>
     ${INF_TIERS.slice(1).map((x,i)=>`<div class="dep"><div class="who"><b>${x.name} · ${x.at}</b><span>${x.perk}</span></div>
        <span class="tag ${y.inf>=x.at?'g':''}">${y.inf>=x.at?'есть':'впереди'}</span></div>`).join('')}
     <p class="hint" style="margin-top:8px">Чем выше влияние, тем труднее его прибавить и тем дороже содержание связей; кресло тянет его к своему уровню.
       На вершине завидуют. Влияние нужно всем: от него зависят цена сделок, ратификация, верность министров и безопасность лидера партии.</p>`,
    foot:`<button class="btn pri" onclick="askClout()" ${S.ap?'':'disabled'}>Кулуарные ходы<span class="cost">ход</span></button>
      <span class="hint">Ходы тратят влияние: должники, прикрытие, звонок, делегаты.</span>`});
}
