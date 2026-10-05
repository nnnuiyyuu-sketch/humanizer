
/* ════════════════════════════════════════════════════════════════
   ПРАВИТЕЛЬСТВО
   Кабинет — не таблица портфелей, а шесть людей со своим характером,
   амбициями и верностью премьеру. Они спорят на заседании, тянут
   национальные проекты, срываются в интервью и метят в его кресло.
   Премьер каждый квартал решает, чью сторону взять, раз в год
   отчитывается перед Собранием, а при чужом президенте получает
   его поручения. Министр и вице-премьер видят ту же кухню изнутри.
   ════════════════════════════════════════════════════════════════ */

/* ─── характер министра ─────────────────────────────────────────── */
const MIN_TRAITS=[
  {id:'tech',  name:'Технократ',        comp:8,  loyal:0,   amb:-15, integ:10, txt:'знает ведомство и не играет в политику'},
  {id:'appar', name:'Аппаратчик',       comp:-4, loyal:18,  amb:-10, integ:0,  txt:'верен тому, кто назначил; без огня, но и без сюрпризов'},
  {id:'pop',   name:'Популист',         comp:-2, loyal:-6,  amb:10,  integ:0,  txt:'любит камеры и раздачу; может сорваться с линии кабинета'},
  {id:'hawk',  name:'Ястреб',           comp:2,  loyal:0,   amb:5,   integ:5,  txt:'за порядок и силу; спорит с мягкими'},
  {id:'reform',name:'Реформатор',       comp:4,  loyal:-4,  amb:5,   integ:12, txt:'тянет проекты и не терпит отката назад'},
  {id:'climb', name:'Карьерист',        comp:3,  loyal:-10, amb:30,  integ:-8, txt:'силён, пока ему с вами по пути; метит выше'},
  {id:'clan',  name:'Человек капитала', comp:2,  loyal:-2,  amb:0,   integ:-25,txt:'приводит инвесторов — и следы чужих денег'},
];
function MT(id){ return MIN_TRAITS.find(t=>t.id===id)||MIN_TRAITS[0]; }
/* характер выдаётся при назначении; старым министрам — при загрузке */
function minFill(m){
  if(!m||m.you||m.trait)return m;
  const t=pick(MIN_TRAITS); m.trait=t.id;
  const p=P(m.party), lead=S.gov&&P(S.gov.lead);
  m.loyal=Math.round(clamp((S.gov&&m.party===S.gov.lead?64:50)-(p&&lead?axDist(p.st,lead.st)*8:0)+t.loyal+rnd(-8,8),10,95));
  m.amb=Math.round(clamp(40+t.amb+rnd(-15,15),5,95));
  m.integ=Math.round(clamp(60+t.integ+rnd(-15,15),5,95));
  return m;
}
function minComp(m){ return m?clamp(m.comp+(m.you?0:MT(m.trait).comp),10,99):50; }
function loyalWord(v){ return v>=75?'предан':v>=58?'надёжен':v>=40?'сам по себе':v>=25?'ропщет':'на выход'; }
function npcMins(){ return POSTS.map(p=>minOf(p.id)).filter(m=>m&&!m.you); }

/* сплочённость: насколько кабинет говорит одним голосом */
function cohesion(){
  const ms=npcMins(); if(!ms.length)return 60;
  let v=ms.reduce((a,m)=>a+(m.loyal==null?55:m.loyal),0)/ms.length;
  if(S.cabIssue&&S.cabIssue.left)v-=4;
  if(S.fvp&&minOf(S.fvp))v+=4;
  return Math.round(clamp(v,0,100));
}
function cohWord(v){ return v>=70?'единая команда':v>=55?'работает':v>=40?'трения':v>=25?'раскол':'каждый за себя'; }
function loyalShift(post,v){ const m=minOf(post); if(m&&!m.you)m.loyal=clamp(Math.round((m.loyal||50)+v),0,100); }

/* ─── отдача ведомств: компетентный министр двигает свою статью ─── */
function ministriesTick(){
  const mp=k=>minPower(k);
  REGIONS.forEach(r=>S.unrest[r.id]=clamp(S.unrest[r.id]-mp('mvd')*9,0,100));
  S.stab=clamp(S.stab+mp('def')*6,0,100); shiftMood('patr',mp('def')*3,true);
  S.econ.invest=r1(S.econ.invest+mp('eco')*9);
  shiftMood('pens',mp('soc')*4,true); shiftMood('work',mp('soc')*3,true);
  if(S.nb)Object.values(S.nb).forEach(n=>n.rel=clamp(n.rel+mp('mid')*5,0,100));
  // плоды завершённых проектов
  if(projDone('roads'))S.econ.invest=r1(S.econ.invest+0.4);
  if(projDone('health'))shiftMood('pens',0.25,true);
  if(projDone('safe'))REGIONS.forEach(r=>S.unrest[r.id]=clamp(S.unrest[r.id]-0.3,0,100));
  // сплочённость сама по себе
  const c=cohesion();
  if(isPM()){ if(c>=70)addCap(1); if(c<35)pressAll(-0.5); }
}

/* ─── министры живут своей жизнью ───────────────────────────────── */
function minLifeTick(){
  const lead=S.gov.lead;
  npcMins().forEach(m=>{
    minFill(m);
    // верность тянется к своему уровню: своя партия, дальний партнёр, обиды партии
    const p=P(m.party), base=(m.party===lead?64:52)-(p?axDist(p.st,P(lead).st)*7:0)+MT(m.trait).loyal
      -((S.partners[m.party]||{}).anger||0)*4+(S.fvp===m.post?12:0)+(approval()-50)*0.25;
    m.loyal=Math.round(clamp(m.loyal+(base-m.loyal)*0.15+rnd(-2,2),0,100));
    if(S.fvp===m.post)m.amb=clamp(m.amb+1,0,100);
  });
  if(!isPM())return aiCabTick();
  if(S.minEvQ===S.q)return;
  const ms=npcMins();
  // интервью против линии
  const loud=ms.filter(m=>(m.trait==='pop'||m.loyal<35)&&Math.random()<0.07)[0];
  if(loud){ S.minEvQ=S.q; return minOffLine(loud); }
  // отставка в знак протеста
  const quit=ms.filter(m=>m.loyal<20&&m.party!==PL&&Math.random()<0.3)[0];
  if(quit){ S.minEvQ=S.q; return minQuits(quit,'в знак несогласия с курсом кабинета'); }
  // человек капитала приводит инвестора
  const clan=ms.filter(m=>m.trait==='clan'&&Math.random()<0.06)[0];
  if(clan){ S.minEvQ=S.q; return minInvestor(clan); }
  // карьерист метит в премьеры
  const climb=ms.filter(m=>m.amb>=72&&approval()<46&&Math.random()<0.12)[0];
  if(climb){ S.minEvQ=S.q; return minPlot(climb); }
}
function minQuits(m,why){
  const pn=POSTS.find(x=>x.id===m.post).name;
  S.ministers[m.post]=makeMinister(m.post,m.party);
  if(S.fvp===m.post)S.fvp=null;
  if(S.partners[m.party])S.partners[m.party].anger=clamp(S.partners[m.party].anger+1.5,0,6);
  npcMins().forEach(x=>x.loyal=clamp(x.loyal-3,0,100));
  pressAll(-1); shiftAll(-0.6);
  logMsg('Министр '+m.name+' ('+pn.toLowerCase()+') ушёл в отставку '+why+'.',1);
  chron('Отставка министра '+m.name+' '+why+'.','b');
  cover({good:'Кабинет очистился: министр '+m.name+' ушёл',bad:'Кабинет трещит: министр '+m.name+' хлопнул дверью',flat:'Министр '+m.name+' подал в отставку'});
  if(isPM())sheetOpen({eye:'Правительство · '+dateLabel(),title:'Министр хлопнул дверью',
    body:`<p class="lead">${m.name} (${pn.toLowerCase()}, «${P(m.party).short}») ушёл ${why}. Кресло занял ${minOf(m.post).name}.</p>
      <p class="hint">${m.party!==PL?'Партнёр по коалиции воспринял это как сигнал: его терпение убавилось.':'Своя фракция смотрит, кто следующий.'}</p>`,
    acts:[{label:'Понятно'}]});
}
function minOffLine(m){
  const pn=POSTS.find(x=>x.id===m.post).name;
  logMsg('Министр '+m.name+' в интервью разошёлся с линией кабинета.',1);
  head(pick(PRESS),'Министр '+m.name+': «Кабинет ошибается»','hb');
  sheetOpen({eye:'Правительство · '+dateLabel(),title:'Министр против линии',
    body:`<p class="lead">${m.name} (${pn.toLowerCase()}, ${MT(m.trait).name.toLowerCase()}) в эфире сказал то, чего кабинет не решал.
        Журналисты ждут, ответит ли премьер.</p>
      <div class="res"><span>Верность вам</span><b class="${m.loyal<35?'bad':''}">${m.loyal} · ${loyalWord(m.loyal)}</b>
        <span>Партия</span><b class="w">${P(m.party).name}</b><span>Сплочённость кабинета</span><b>${cohesion()} · ${cohWord(cohesion())}</b></div>`,
    opts:[{label:'Выговор',hint:'твёрдость +1 · верность министра −6 · остальные подтягиваются',fn(){
        bumpRep('firm',1); loyalShift(m.post,-6); npcMins().forEach(x=>{ if(x!==m)x.loyal=clamp(x.loyal+2,0,100); });
        logMsg('Премьер объявил министру '+m.name+' выговор.'); render(); }},
      {label:'Отправить в отставку',hint:'твёрдость +3 · '+(m.party!==PL?'партнёр обидится':'фракция насторожится'),fn(){
        bumpRep('firm',3); minQuits(m,'по решению премьера'); render(); }},
      {label:'Обсудить с глазу на глаз',hint:'4 веса · верность +10',fn(){ if(!payCap(4))return; loyalShift(m.post,10); render(); }},
      {label:'Промолчать',hint:'твёрдость −2 · сплочённость падает',fn(){ bumpRep('firm',-2); npcMins().forEach(x=>x.loyal=clamp(x.loyal-2,0,100)); }}]});
}
function minInvestor(m){
  const pn=POSTS.find(x=>x.id===m.post).name;
  sheetOpen({eye:'Правительство · '+dateLabel(),title:'Инвестор от министра',
    body:`<p class="lead">${m.name} (${pn.toLowerCase()}) привёл крупного инвестора: завод, рабочие места, хорошие заголовки.
        Откуда у министра такие знакомства — лучше не спрашивать.</p>
      <div class="res"><span>Честность министра</span><b class="${m.integ<35?'bad':''}">${m.integ<35?'сомнительная':m.integ<60?'обычная':'высокая'}</b></div>`,
    opts:[{label:'Принять',hint:'инвестиции +6 · бизнес +2 · след +3',fn(){
        S.econ.invest=r1(S.econ.invest+6); shiftMood('biz',2); addTrail(3,'инвестор министра '+m.name); loyalShift(m.post,6);
        logMsg('Кабинет принял инвестора, которого привёл министр '+m.name+'.'); render(); }},
      {label:'Проверить сделку',hint:'честность +2 · министр обижен · инвестор может уйти',fn(){
        bumpRep('honest',2); loyalShift(m.post,-10);
        if(Math.random()<0.5){ S.econ.invest=r1(S.econ.invest+3); logMsg('Проверка прошла чисто: инвестор остался.'); }
        else logMsg('Инвестор ушёл, не дожидаясь проверки.'); render(); }},
      {label:'Отказаться',hint:'без следа и без завода',fn(){ loyalShift(m.post,-4); }}]});
}
function minPlot(m){
  const pn=POSTS.find(x=>x.id===m.post).name;
  sheetOpen({eye:'Правительство · '+dateLabel(),title:'Министр метит выше',
    body:`<p class="lead">${m.name} (${pn.toLowerCase()}, «${P(m.party).short}») собирает сторонников в кабинете и во фракции.
        При одобрении ${Math.round(approval())}% разговоры о «свежем лице» звучат всё громче.</p>
      <div class="res"><span>Амбиции</span><b class="bad">${m.amb}</b><span>Верность вам</span><b>${m.loyal} · ${loyalWord(m.loyal)}</b></div>`,
    opts:[{label:'Уволить',hint:'угроза снята · сплочённость −, '+(m.party!==PL?'партнёр обижен':'фракция ропщет'),fn(){
        if(m.party===PL)S.deputies.filter(d=>d.party===PL).forEach(d=>d.loyal=clamp(d.loyal-2,0,100));
        minQuits(m,'по решению премьера'); bumpRep('firm',2); render(); }},
      {label:'Сделать первым вице-премьером',hint:'верность +20 · амбиции утолены на время',fn(){
        S.fvp=m.post; m.loyal=clamp(m.loyal+20,0,100); m.amb=clamp(m.amb-20,0,100);
        logMsg(m.name+' назначен первым вице-премьером.',1); render(); }},
      {label:'Не замечать',hint:'если одобрение упадёт ниже 40 — он ударит',fn(){ m.plot=S.q; }}]});
}
/* затаившийся карьерист бьёт, когда кабинет слаб */
function plotTick(){
  if(!isPM())return;
  npcMins().filter(m=>m.plot&&approval()<40&&Math.random()<0.4).slice(0,1).forEach(m=>{
    m.plot=0; shiftAll(-1.5); pressAll(-2);
    if(m.party===PL)S.deputies.filter(d=>d.party===PL).forEach(d=>d.loyal=clamp(d.loyal-5,0,100));
    else if(S.partners[m.party])S.partners[m.party].anger=clamp(S.partners[m.party].anger+2,0,6);
    logMsg('Министр '+m.name+' публично потребовал смены премьера.',1);
    chron('Министр '+m.name+' выступил против премьера.','b');
    minQuits(m,'и перешёл в открытую оппозицию премьеру');
  });
}

/* ─── заседание правительства: спор двух ведомств ────────────────── */
const CAB_ISSUES=[
  {id:'cuts', a:'fin', b:'soc', cond:()=>balance()<-3, title:'Резать или занимать',
   lead:'Минфин требует урезать расходы: дефицит уходит в долг. Соцзащита против: под нож пойдут выплаты.',
   A:{label:'Урезать расходы',hint:'крупнейшая статья −1 · пенсионеры и рабочие недовольны',run(){
     const sp=SPEND.filter(x=>S.spend[x.id]>Math.max(1,(x.id==='soc'||x.id==='med')?socFloor():0)).sort((x,y)=>S.spend[y.id]*y.base-S.spend[x.id]*x.base)[0];
     if(sp){ S.spend[sp.id]--; logMsg('Кабинет урезал статью «'+sp.name+'».'); } shiftMood('pens',-2); shiftMood('work',-1); }},
   B:{label:'Занять и не трогать выплаты',hint:'казна +12 · долг +13',run(){ S.treasury=r1(S.treasury+12); S.debt=r1(S.debt+13); shiftMood('pens',1); }}},
  {id:'police', a:'mvd', b:'eco', cond:()=>avgUnrest()>20, title:'Усиленный режим',
   lead:'МВД просит усиленный режим в горячих краях. Минэкономики боится, что инвесторы увидят на улицах технику.',
   A:{label:'Ввести усиленный режим',hint:'три горячих края −6 · интеллигенция −2 · инвестиции −2',run(){
     REGIONS.slice().sort((x,y)=>S.unrest[y.id]-S.unrest[x.id]).slice(0,3).forEach(r=>S.unrest[r.id]=clamp(S.unrest[r.id]-6,0,100));
     shiftMood('intel',-2); S.econ.invest=r1(S.econ.invest-2); }},
   B:{label:'Работать мягко',hint:'инвестиции +3 · напряжённость сама не уйдёт',run(){ S.econ.invest=r1(S.econ.invest+3); shiftMood('biz',1); }}},
  {id:'army', a:'def', b:'fin', cond:()=>!!S.bcrisis||NEIGHBOURS.some(x=>nbOf(x.id)&&nbOf(x.id).rel<38), title:'Оборонзаказ',
   lead:'Минобороны требует денег: у границы неспокойно. Минфин отвечает, что армия не спасёт бюджет.',
   A:{label:'Дать оборонзаказ',hint:'казна −10 · патриоты +3 · стабильность +2',run(){ S.treasury=r1(S.treasury-10); shiftMood('patr',3); S.stab=clamp(S.stab+2,0,100); }},
   B:{label:'Отказать армии',hint:'патриоты −2 · казна цела',run(){ shiftMood('patr',-2); }}},
  {id:'trade', a:'mid', b:'soc', cond:()=>NEIGHBOURS.some(x=>nbOf(x.id)&&!nbOf(x.id).trade&&nbOf(x.id).rel>=40), title:'Открывать ли рынок',
   lead:'МИД готов начать переговоры о торговле с соседом. Соцзащита напоминает: заводы не выдержат конкуренции.',
   A:{label:'Начать переговоры',hint:'отношения с соседом +6 · бизнес +2 · рабочие −1',run(){
     const x=NEIGHBOURS.filter(z=>nbOf(z.id)&&!nbOf(z.id).trade).sort((p,q)=>nbOf(q.id).rel-nbOf(p.id).rel)[0];
     if(x)nbOf(x.id).rel=clamp(nbOf(x.id).rel+6,0,100); shiftMood('biz',2); shiftMood('work',-1); }},
   B:{label:'Защитить заводы',hint:'рабочие +2 · бизнес −1',run(){ shiftMood('work',2); shiftMood('biz',-1); }}},
  {id:'invest', a:'eco', b:'fin', cond:()=>S.econ.growth<1.5, title:'Каникулы для инвестора',
   lead:'Минэкономики просит налоговые каникулы крупному инвестору. Минфин: каждый рубль нужен казне.',
   A:{label:'Дать каникулы',hint:'инвестиции +5 · казна −5',run(){ S.econ.invest=r1(S.econ.invest+5); S.treasury=r1(S.treasury-5); shiftMood('biz',1); }},
   B:{label:'Деньги в казну',hint:'казна +4 · бизнес −1',run(){ S.treasury=r1(S.treasury+4); shiftMood('biz',-1); }}},
  {id:'index', a:'soc', b:'fin', cond:()=>S.mood.pens<46||S.econ.inf>6, title:'Индексация',
   lead:'Соцзащита требует внеплановой индексации пенсий: цены съели прибавку. Минфин считает, что инфляция только разгонится.',
   A:{label:'Проиндексировать',hint:'пенсионеры +4 · казна −7 · инфляция +0,2',run(){ shiftMood('pens',4); S.treasury=r1(S.treasury-7); S.econ.inf=r1(S.econ.inf+0.2); }},
   B:{label:'Держать бюджет',hint:'пенсионеры −2',run(){ shiftMood('pens',-2); }}},
  {id:'reform', a:'eco', b:'mvd', cond:()=>npcMins().some(m=>m.trait==='reform'), title:'Реформа ведомств',
   lead:'Реформатор в кабинете предлагает сократить надзор и проверки. Силовой блок говорит, что без проверок развалится порядок.',
   A:{label:'Резать проверки',hint:'рост +0,2 · бизнес +2 · напряжённость +2',run(){ S.econ.growth=r1(S.econ.growth+0.2); shiftMood('biz',2); REGIONS.forEach(r=>S.unrest[r.id]=clamp(S.unrest[r.id]+2,0,100)); }},
   B:{label:'Оставить надзор',hint:'стабильность +2 · бизнес −1',run(){ S.stab=clamp(S.stab+2,0,100); shiftMood('biz',-1); }}},
];
const CI=id=>CAB_ISSUES.find(x=>x.id===id);
function cabIssueTick(){
  if(S.cabIssue){                            // неразрешённый спор к концу квартала — обе стороны в обиде
    const x=CI(S.cabIssue.id);
    if(x&&S.cabIssue.q<S.q){ loyalShift(x.a,-4); loyalShift(x.b,-4); logMsg('Кабинет так и не решил спор «'+x.title.toLowerCase()+'».'); S.cabIssue=null; }
  }
  if(S.cabIssue)return;
  const pool=CAB_ISSUES.filter(x=>x.cond()&&minOf(x.a)&&minOf(x.b)&&S.cabIssueLast!==x.id);
  if(!pool.length||Math.random()>0.75)return;
  const x=pick(pool);
  S.cabIssue={id:x.id,q:S.q,left:1}; S.cabIssueLast=x.id;
  const mine=mySeat()==='min'&&(S.you.post===x.a||S.you.post===x.b);
  if(!isPM()&&!mine){ aiCabDecide(x); return; }
  if(mine&&!isPM())askIssueMinister();
}
function issueSide(x,side){ return side==='A'?{pro:x.a,con:x.b,o:x.A}:{pro:x.b,con:x.a,o:x.B}; }
function cabDecide(side){
  const c=S.cabIssue; if(!c)return; const x=CI(c.id); S.cabIssue=null;
  if(side==='C'){                            // компромисс: половина решений и половина обид
    if(!payCap(3)){ S.cabIssue=c; return; }
    loyalShift(x.a,-2); loyalShift(x.b,-2); bumpRep('comp',1);
    logMsg('Заседание правительства: компромисс по вопросу «'+x.title.toLowerCase()+'».',1); render(); return;
  }
  const s=issueSide(x,side); s.o.run();
  loyalShift(s.pro,9); loyalShift(s.con,-11);
  const cm=minOf(s.con);
  logMsg('Заседание правительства: «'+s.o.label.toLowerCase()+'». '+(cm&&!cm.you?cm.name+' недоволен.':''),1);
  if(cm&&!cm.you&&cm.loyal<18&&cm.party!==PL&&Math.random()<0.4)minQuits(cm,'после поражения на заседании правительства');
  render();
}
function askIssue(){
  const c=S.cabIssue; if(!c){ toast('Спорных вопросов нет'); return; }
  const x=CI(c.id), ma=minOf(x.a), mb=minOf(x.b), pa=POSTS.find(p=>p.id===x.a), pb=POSTS.find(p=>p.id===x.b);
  const who=(m,p)=>`<span>${p.name}</span><b class="w">${m.you?'вы':m.name} · ${m.you?'':MT(m.trait).name.toLowerCase()+' · '}верность ${m.you?'—':m.loyal}</b>`;
  sheetOpen({eye:'Заседание правительства · '+dateLabel(),title:x.title,
    body:`<p class="lead">${x.lead}</p><div class="res">${who(ma,pa)}${who(mb,pb)}</div>
      <p class="hint">Победившая сторона станет вернее, проигравшая — обидится. Неразрешённый к концу квартала спор обижает обоих.</p>`,
    opts:[{label:x.A.label+' — за '+pa.name.toLowerCase(),hint:x.A.hint,fn:()=>cabDecide('A')},
      {label:x.B.label+' — за '+pb.name.toLowerCase(),hint:x.B.hint,fn:()=>cabDecide('B')},
      {label:'Компромисс',hint:'3 веса · ни то ни другое, обе стороны слегка недовольны',fn:()=>cabDecide('C')},
      {label:'Отложить',hint:'до конца квартала',fn(){}}]});
}
/* чужой премьер решает сам: по курсу своей партии */
function aiCabDecide(x){
  const lead=P(S.gov.lead), left=(lead.st.econ||0)<0;
  const side=['cuts','invest'].indexOf(x.id)>=0?(left?'B':'A'):x.id==='police'||x.id==='army'?((lead.st.order||0)>0?'A':'B'):x.id==='index'?(left?'A':'B'):Math.random()<0.5?'A':'B';
  S.cabIssue=null; const s=issueSide(x,side); s.o.run(); loyalShift(s.pro,8); loyalShift(s.con,-9);
  logMsg('Кабинет '+lead.leader+': «'+s.o.label.toLowerCase()+'».');
}
/* министр-игрок в споре чужого кабинета */
function askIssueMinister(){
  const c=S.cabIssue; if(!c)return; const x=CI(c.id), d=desk();
  const my=S.you.post===x.a?'A':'B', s=issueSide(x,my), other=minOf(s.con);
  const ch=clamp(0.35+(d.score-50)*0.012+(rep('comp')-50)*0.006,0.1,0.85);
  sheetOpen({eye:'Заседание правительства · '+dateLabel(),title:x.title,
    body:`<p class="lead">${x.lead}</p>
      <div class="res"><span>Ваша позиция</span><b class="w">${s.o.label}</b>
        <span>Против вас</span><b class="w">${other?other.name:'—'}</b>
        <span>Премьер о вас</span><b>${Math.round(d.score)} из 100</b></div>`,
    opts:[{label:'Отстоять позицию',hint:'4 веса · шанс '+Math.round(ch*100)+'%',fn(){ if(!payCap(4))return;
        S.cabIssue=null;
        if(Math.random()<ch){ s.o.run(); loyalShift(s.con,-8); d.score=clamp(d.score+5,0,100); bumpRep('firm',2);
          logMsg('Заседание правительства: ваша позиция взяла верх — «'+s.o.label.toLowerCase()+'».',1); }
        else { const o=issueSide(x,my==='A'?'B':'A'); o.o.run(); d.score=clamp(d.score-4,0,100);
          logMsg('Заседание правительства: премьер встал на сторону '+(other?other.name:'оппонента')+'.',1); }
        render(); }},
      {label:'Уступить',hint:'премьер ценит лояльность · оценка +3',fn(){ S.cabIssue=null; const o=issueSide(x,my==='A'?'B':'A'); o.o.run();
        d.score=clamp(d.score+3,0,100); bumpRep('firm',-1); render(); }},
      {label:'Пригрозить отставкой',hint:'почти наверняка выиграете — но премьер запомнит',fn(){ S.cabIssue=null;
        if(Math.random()<0.8){ s.o.run(); d.score=clamp(d.score-8,0,100); bumpRep('firm',3); logMsg('Под угрозой вашей отставки премьер уступил.',1); }
        else { logMsg('Премьер принял вашу отставку.',1); stepDown('Отставка после спора в кабинете.'); }
        render(); }}]});
}

/* ─── национальные проекты ──────────────────────────────────────── */
const NPROJ=[
  {id:'roads',   name:'Дороги и мосты',          post:'eco', cost:6, done:'инвестиции +8 сразу и +0,4 каждый квартал; край открытия теплеет',
   fin(){ S.econ.invest=r1(S.econ.invest+8); }},
  {id:'health',  name:'Больница рядом',          post:'soc', cost:7, done:'пенсионеры +5, горожане +3; пенсионеры теплеют и дальше',
   fin(){ shiftMood('pens',5); shiftMood('urban',3); }},
  {id:'digital', name:'Цифровое государство',    post:'fin', cost:5, done:'сборы +3% навсегда, след −10, молодёжь +2',
   fin(){ addTrail(-10); shiftMood('youth',2); }},
  {id:'industry',name:'Новая промышленность',    post:'eco', cost:8, done:'рабочие +5, инвестиции +6, безработица −0,8',
   fin(){ shiftMood('work',5); S.econ.invest=r1(S.econ.invest+6); S.econ.unemp=r1(Math.max(2,S.econ.unemp-0.8)); }},
  {id:'safe',    name:'Безопасный край',         post:'mvd', cost:5, done:'напряжённость −8 везде и дальше гаснет быстрее; интеллигенция −2',
   fin(){ REGIONS.forEach(r=>S.unrest[r.id]=clamp(S.unrest[r.id]-8,0,100)); shiftMood('intel',-2); }},
  {id:'export',  name:'Экспортный коридор',      post:'mid', cost:6, done:'внешний спрос +8 и +3 навсегда, бизнес +2',
   fin(){ S.world.demand=clamp(S.world.demand+8,55,142); shiftMood('biz',2); }},
  {id:'army',    name:'Армия нового образца',    post:'def', cost:7, done:'патриоты +5, стабильность +4, сила на границе весомее',
   fin(){ shiftMood('patr',5); S.stab=clamp(S.stab+4,0,100); }},
];
const NP=id=>NPROJ.find(x=>x.id===id);
const PROJ_MAX=2, PROJ_LAUNCH=8;
function projs(){ return S.proj||(S.proj=[]); }
function projDone(id){ return !!(S.projDone&&S.projDone.some(x=>x.id===id)); }
function projLive(id){ return projs().find(x=>x.id===id)||null; }
function projRate(x){
  const m=minOf(x.post);
  let v=13+(minComp(m)-50)*0.22+(cohesion()-50)*0.08;
  if(S.cabPrio&&S.cabPrio.until>=S.q){ const pr=CAB_PRIO.find(z=>z.id===S.cabPrio.id); if(pr&&pr.posts.indexOf(x.post)>=0)v+=4; }
  if(S.fvp&&minOf(S.fvp))v+=3;
  if(m&&!m.you&&m.trait==='reform')v+=3;
  if(x.cur)v+=x.cur;
  return Math.round(clamp(v,3,30));
}
function projEta(x){ return Math.ceil((100-x.prog)/Math.max(1,projRate(x))); }
function askProjects(){
  if(!isPM()){ toast('Национальные проекты запускает премьер'); return; }
  const live=projs().length;
  sheetOpen({eye:'Правительство · национальные проекты',title:'Запустить проект',
    body:`<p class="lead">Проект ведёт профильный министр: его компетентность, сплочённость кабинета и приоритет заседания
        решают, как быстро он пойдёт. Каждый квартал проект берёт деньги из казны; без денег стройка ползёт вдвое медленнее.</p>
      <div class="res"><span>Идёт проектов</span><b>${live} из ${PROJ_MAX}</b><span>Казна</span><b>${Math.round(S.treasury)} млрд</b></div>`,
    opts:NPROJ.filter(x=>!projLive(x.id)&&!projDone(x.id)).map(x=>{ const m=minOf(x.post);
      return {label:x.name+' · '+POSTS.find(p=>p.id===x.post).name.toLowerCase(),
        hint:x.cost+' млрд в квартал · ведёт '+(m?(m.you?'вы':m.name+' ('+minWord({comp:minComp(m)})+')'):'—')+' · итог: '+x.done,
        fn:()=>projStart(x.id)}; }).concat([{label:'Не сейчас',hint:''}])});
}
function projStart(id,by){
  const x=NP(id); if(!x||projLive(id)||projDone(id))return false;
  if(!by){
    if(projs().length>=PROJ_MAX){ toast('Одновременно — не больше '+PROJ_MAX+' проектов'); return false; }
    if(!pay({ap:1,cap:PROJ_LAUNCH},'Национальный проект'))return false;
  }
  projs().push({id,post:x.post,prog:0,q:S.q,by:by||S.gov.lead,cur:0,paid:0});
  logMsg('Запущен национальный проект «'+x.name+'».',1);
  chron('Национальный проект «'+x.name+'».','');
  cover({good:'«'+x.name+'»: правительство берётся за большое дело',bad:'«'+x.name+'»: ещё одна стройка за наш счёт',flat:'Запущен проект «'+x.name+'»'});
  render(); return true;
}
function projTick(){
  S.proj=projs().filter(p=>{
    const x=NP(p.id), m=minOf(p.post);
    const paid=S.treasury>=x.cost; if(paid)S.treasury=r1(S.treasury-x.cost);
    let step=projRate(p)*(paid?1:0.5);
    p.cur=0;
    // откат: нечестный министр уводит часть сметы
    if(m&&!m.you&&Math.random()<(100-(m.integ||60))*0.0012){ step-=6; p.leak=(p.leak||0)+1;
      if(isPM()){ addTrail(2,'откаты на проекте «'+x.name+'»');
        if(p.leak>=2&&!S.probe&&Math.random()<0.35)caseOpen({k:'министр',name:m.name,post:p.post},'scandal',45+p.leak*8); } }
    p.prog=Math.round(clamp(p.prog+step,0,100));
    if(!paid&&isPM())logMsg('Проект «'+x.name+'» без денег: подрядчики работают вполсилы.');
    if(p.prog>=100){ projFinish(p); return false; }
    if(isPM()&&p.prog>15&&!p.hitch&&Math.random()<0.15){ p.hitch=true; projHitch(p); }
    return true;
  });
  // чужой кабинет тоже строит
  if(!isPM()&&projs().length<1&&Math.random()<0.15){
    const free=NPROJ.filter(x=>!projDone(x.id)&&!projLive(x.id));
    if(free.length)projStart(pick(free).id,S.gov.lead);
  }
}
function projHitch(p){
  const x=NP(p.id);
  sheetOpen({eye:'Национальный проект · '+dateLabel(),title:'Подрядчик сорвал сроки',
    body:`<p class="lead">На проекте «${x.name}» подрядчик не уложился в график. Готовность ${p.prog}%.</p>`,
    opts:[{label:'Добавить денег',hint:'10 млрд · готовность +10',fn(){ if(S.treasury<10){ toast('В казне нет 10 млрд'); return; }
        S.treasury=r1(S.treasury-10); p.prog=Math.min(99,p.prog+10); render(); }},
      {label:'Сменить подрядчика',hint:'5 веса · готовность −5, зато следующий быстрее',fn(){ if(!payCap(5))return; p.prog=Math.max(0,p.prog-5); p.cur=6; render(); }},
      {label:'Замять',hint:'готовность −8 · печать может узнать',fn(){ p.prog=Math.max(0,p.prog-8);
        if(Math.random()<0.3){ pressAll(-1); head(pick(PRESS),'«'+x.name+'»: стройка стоит, кабинет молчит','hb'); } render(); }}]});
}
function projFinish(p){
  const x=NP(p.id), m=minOf(p.post);
  x.fin();
  (S.projDone=S.projDone||[]).push({id:p.id,q:S.q,by:S.gov.lead,pm:S.pm?S.pm.name:''});
  const rid=REGIONS.slice().sort((a,b)=>regApproval(a.id)-regApproval(b.id))[0].id;
  S.rmod[rid]=clamp(S.rmod[rid]+3,-22,22);
  chron('Завершён национальный проект «'+x.name+'».','g');
  if(isPM()){ shiftAll(1.5); addCap(6); bumpRep('comp',3); career('Завершён национальный проект «'+x.name+'».');
    if(m&&!m.you)m.loyal=clamp(m.loyal+8,0,100); cnt('proj');
    sheetOpen({eye:'Национальный проект',title:'«'+x.name+'» открыт',
      body:`<p class="lead">Ленточку разрезали в ${R(rid).cap}. ${x.done[0].toUpperCase()+x.done.slice(1)}.</p>
        <p class="hint">Министр ${m?(m.you?'— вы':m.name):''} получил свою долю славы.</p>`,acts:[{label:'Отлично'}]});
  } else {
    const lp=P(S.gov.lead); if(lp)lp.mom=clamp((lp.mom||0)+2,-14,14);
    logMsg('Кабинет '+(lp?lp.leader:'')+' открыл проект «'+x.name+'».',1);
  }
  if(p.vice&&mySeat()==='vice'){ const d=desk(); d.score=clamp(d.score+10,0,100); bumpRep('comp',3); addCap(5);
    career('Под вашим контролем сдан проект «'+x.name+'».'); }
  if(m&&m.you&&mySeat()==='min'){ const d=desk(); d.score=clamp(d.score+12,0,100); bumpRep('comp',4); addCap(6);
    career('Ваше ведомство завершило проект «'+x.name+'».'); }
}
function projCancel(id){
  const p=projLive(id); if(!p)return; const x=NP(id), m=minOf(p.post);
  S.proj=projs().filter(z=>z!==p); shiftAll(-1); bumpRep('firm',-1);
  if(m&&!m.you){ m.loyal=clamp(m.loyal-(m.trait==='reform'?25:12),0,100);
    if(m.trait==='reform'&&m.party!==PL)minQuits(m,'после закрытия своего проекта'); }
  logMsg('Проект «'+x.name+'» закрыт на '+p.prog+'%.',1); chron('Закрыт проект «'+x.name+'».','b'); render();
}

/* ─── отчёт правительства ───────────────────────────────────────── */
function repDue(){ return isPM()&&S.repDue!=null&&S.q>=S.repDue; }
function repScore(){
  const kpis=POSTS.filter(p=>minKpi(p.id).ok).length;
  const done=(S.projDone||[]).filter(x=>x.q>(S.repLast||0)).length;
  return {kpis,done,s:kpis+done*1.5+(approval()-50)/10};
}
function askReport(){
  if(!repDue()){ toast('Отчёт ещё не время'); return; }
  const r=repScore(), fresh=S.pm&&S.q-S.pm.since<8;
  const rows=POSTS.map(p=>{ const k=minKpi(p.id), md=MIN_DESK[p.id];
    return `<span>${p.name} · ${md.kpi.toLowerCase()}</span><b class="${k.ok?'good':'bad'}">${k.v} ${k.ok?'✓':'✗'}</b>`; }).join('');
  sheetOpen({eye:'Народное собрание · '+dateLabel(),title:'Отчёт правительства',
    body:`<p class="lead">Раз в год премьер отчитывается перед Собранием. Палата смотрит на цифры ведомств и на сданные проекты;
        страна — на то, как вы о них скажете.</p>
      <div class="res">${rows}<span>Проектов сдано за год</span><b>${r.done}</b><span>Оценка</span><b class="${r.s>=4?'good':r.s<2.5?'bad':''}">${r1(r.s)} из 6+</b></div>`,
    opts:[{label:'Честный отчёт',hint:'честность +3 · одобрение по цифрам · вес +4',fn(){ repDone('honest',r); }},
      {label:'Победная реляция',hint:r.s>=4?'цифры позволяют: одобрение +2, вес +8':'цифры слабые: печать разнесёт',fn(){ repDone('boast',r); }},
      {label:'Виноваты предшественники',hint:fresh?'кабинет молод — сработает':'вы правите давно — над этим посмеются',fn(){ repDone('blame',r,fresh); }},
      {label:'Назвать виновного министра',hint:'худший министр уходит · твёрдость +2 · кабинет напрягся',fn(){ repDone('scape',r); }}]});
}
function repDone(tone,r,fresh){
  S.repLast=S.q; S.repDue=S.q+4;
  if(tone==='honest'){ bumpRep('honest',3); shiftAll((r.s-3)*0.5); addCap(4); }
  if(tone==='boast'){ if(r.s>=4){ shiftAll(2); addCap(8); } else { pressAll(-2); bumpRep('honest',-3); shiftAll(-1); } }
  if(tone==='blame'){ if(fresh){ shiftAll(1); bumpRep('firm',-1); } else { shiftAll(-1); pressAll(-1); } }
  if(tone==='scape'){ const w=POSTS.filter(p=>minOf(p.id)&&!minOf(p.id).you&&!minKpi(p.id).ok).sort((a,b)=>minComp(minOf(a.id))-minComp(minOf(b.id)))[0]
      ||POSTS.filter(p=>minOf(p.id)&&!minOf(p.id).you).sort((a,b)=>minComp(minOf(a.id))-minComp(minOf(b.id)))[0];
    if(w)minQuits(minOf(w.id),'после отчёта правительства'); shiftAll(1.5); bumpRep('firm',2); npcMins().forEach(m=>m.loyal=clamp(m.loyal-4,0,100)); }
  if(r.s<2)S.noConfCool=0;                    // слабый отчёт — повод для вотума
  cnt('report');
  logMsg('Отчёт правительства в Собрании: оценка '+r1(r.s)+'.',1);
  chron('Отчёт правительства в Собрании.',r.s>=4?'g':r.s<2.5?'b':'');
  render();
}
function repTick(){
  if(!isPM()){ S.repDue=null; return; }
  if(S.repDue==null){ S.repDue=S.q+4; return; }
  if(S.q>S.repDue){                            // квартал отчёта прошёл без отчёта
    S.repDue=S.q+3; addCap(-8); shiftAll(-1); S.noConfCool=0; pressAll(-1);
    logMsg('Правительство не отчиталось перед Собранием: оппозиция говорит о неуважении к палате.',1);
  }
}

/* ─── первый вице-премьер ───────────────────────────────────────── */
function askFvp(){
  if(!isPM()){ toast('Первого вице-премьера назначает премьер'); return; }
  sheetOpen({eye:'Правительство · кадры',title:'Первый вице-премьер',
    body:`<p class="lead">Второй человек в кабинете координирует ведомства: проекты идут быстрее, кабинет сплочённее.
        Но вице-премьер с амбициями — готовый преемник, и не только в ваших глазах.</p>
      <div class="res"><span>Сейчас</span><b class="w">${S.fvp&&minOf(S.fvp)?minOf(S.fvp).name:'не назначен'}</b></div>`,
    opts:npcMins().map(m=>({label:m.name+' · '+POSTS.find(p=>p.id===m.post).name.toLowerCase(),
      hint:'«'+P(m.party).short+'» · '+MT(m.trait).name.toLowerCase()+' · верность '+m.loyal+' · амбиции '+m.amb,
      fn(){ if(!payCap(4))return; S.fvp=m.post; m.loyal=clamp(m.loyal+15,0,100); m.amb=clamp(m.amb+8,0,100);
        if(S.partners[m.party])S.partners[m.party].anger=Math.max(0,S.partners[m.party].anger-1);
        logMsg(m.name+' — первый вице-премьер.',1); render(); }}))
      .concat(S.fvp?[{label:'Снять с поста',hint:'верность −15',fn(){ loyalShift(S.fvp,-15); S.fvp=null; render(); }}]:[])
      .concat([{label:'Отмена',hint:''}])});
}
function fvpTick(){
  if(!S.fvp)return; const m=minOf(S.fvp);
  if(!m||m.you||!isPM()){ if(!isPM())S.fvp=null; return; }
  if(m.amb>=78&&approval()<44&&Math.random()<0.2&&S.fvpWarn!==S.q){ S.fvpWarn=S.q;
    sheetOpen({eye:'Правительство · '+dateLabel(),title:'Преемник наготове',
      body:`<p class="lead">Первый вице-премьер ${m.name} всё чаще говорит от имени кабинета. Фракции прикидывают, не сменить ли премьера без выборов.</p>`,
      opts:[{label:'Снять его',hint:'угроза снята · сплочённость −',fn(){ minQuits(m,'после снятия с поста первого вице-премьера'); render(); }},
        {label:'Поделиться полномочиями',hint:'6 веса · амбиции −20',fn(){ if(!payCap(6))return; m.amb=clamp(m.amb-20,0,100); render(); }},
        {label:'Не замечать',hint:'партнёры и фракция сочтут вас слабым',fn(){ if(S.partners[m.party])S.partners[m.party].anger=clamp(S.partners[m.party].anger+1,0,6);
          S.deputies.filter(d=>d.party===PL).forEach(d=>d.loyal=clamp(d.loyal-2,0,100)); }}]});
  }
}

/* ─── поручения президента при сожительстве ─────────────────────── */
function cohab(){ return isPM()&&S.pres&&S.pres.party!==PL&&!isPres(); }
function presDirTick(){
  if(!cohab()){ S.presDir=null; return; }
  if(S.presDir){ if(S.presDir.q<S.q){ S.presRel=clamp(S.presRel-6,0,100); logMsg('Поручение президента осталось без ответа.',1); S.presDir=null; } return; }
  if(Math.random()>(inCoal(S.pres.party)?0.1:0.2))return;     // президент-партнёр поручает реже
  const pp=P(S.pres.party); if(!pp)return;
  const kinds=[];
  const want=(pp.st.order||0)>0.5?'def':(pp.st.econ||0)<-0.5?'soc':(pp.st.econ||0)>0.5?'inf':'edu';
  if(S.spend[want]<4)kinds.push({k:'spend',id:want});
  const tx=TAXES.filter(t=>S.tax[t.id]>1&&(pp.st.tax||0)>0.3).sort((a,b)=>S.tax[b.id]-S.tax[a.id])[0];
  if(tx)kinds.push({k:'tax',id:tx.id});
  const far=npcMins().filter(m=>P(m.party)&&axDist(P(m.party).st,pp.st)>1.6).sort((a,b)=>minComp(a)-minComp(b))[0];
  if(far)kinds.push({k:'fire',post:far.post});
  const pj=NPROJ.filter(x=>!projDone(x.id)&&!projLive(x.id)); if(pj.length&&projs().length<PROJ_MAX)kinds.push({k:'proj',id:pick(pj).id});
  if(!kinds.length)return;
  S.presDir={...pick(kinds),q:S.q};
  askPresDir();
}
function presDirText(d){
  if(d.k==='spend')return 'поднять статью «'+SPEND.find(s=>s.id===d.id).name+'» на ступень';
  if(d.k==='tax')return 'снизить «'+TAXES.find(t=>t.id===d.id).name.toLowerCase()+'» на ступень';
  if(d.k==='fire'){ const m=minOf(d.post); return 'отправить в отставку министра '+(m?m.name:'')+' ('+POSTS.find(p=>p.id===d.post).name.toLowerCase()+')'; }
  return 'запустить национальный проект «'+NP(d.id).name+'»';
}
function presDirDo(d){
  if(d.k==='spend')S.spend[d.id]=Math.min(4,S.spend[d.id]+1);
  if(d.k==='tax')S.tax[d.id]=Math.max(0,S.tax[d.id]-1);
  if(d.k==='fire'){ const m=minOf(d.post); if(m&&!m.you)minQuits(m,'по требованию президента'); }
  if(d.k==='proj')projStart(d.id,PL);
}
function askPresDir(){
  const d=S.presDir; if(!d)return;
  sheetOpen({eye:'Президент · поручение',title:'Поручение правительству',
    body:`<p class="lead">Президент ${S.pres.name} («${P(S.pres.party).short}») поручает кабинету ${presDirText(d)}.
        Конституция не обязывает премьера исполнять, но президент подписывает ваши законы.</p>
      <div class="res"><span>Отношения с президентом</span><b class="${S.presRel<40?'bad':''}">${Math.round(S.presRel)}</b></div>`,
    opts:[{label:'Исполнить',hint:'отношения +10',fn(){ presDirDo(d); S.presRel=clamp(S.presRel+10,0,100); S.presDir=null;
        logMsg('Кабинет исполнил поручение президента: '+presDirText(d)+'.',1); render(); }},
      {label:'Торговаться',hint:'4 веса · отношения +3 · исполнение откладывается',fn(){ if(!payCap(4))return; S.presRel=clamp(S.presRel+3,0,100); S.presDir=null; render(); }},
      {label:'Отказать',hint:'отношения −10 · вето станет вероятнее',fn(){ S.presRel=clamp(S.presRel-10,0,100); S.presDir=null;
        if(Math.random()<0.4){ pressAll(-1); head(pick(PRESS),'Президент недоволен правительством','hb'); }
        logMsg('Кабинет отказал президенту.',1); render(); }}]});
}

/* ─── чужой кабинет: тихая кухня ────────────────────────────────── */
function aiCabTick(){
  // слабого министра чужой премьер со временем меняет
  const weak=npcMins().filter(m=>minComp(m)<38||m.loyal<15)[0];
  if(weak&&Math.random()<0.15){ S.ministers[weak.post]=makeMinister(weak.post,weak.party); logMsg('В кабинете '+P(S.gov.lead).leader+' сменился министр: '+POSTS.find(p=>p.id===weak.post).name.toLowerCase()+'.'); }
}

/* ─── квартал правительства ─────────────────────────────────────── */
function cabinetTick(){
  if(!S.ministers)return;
  npcMins().forEach(minFill);
  ministriesTick(); minLifeTick(); plotTick(); cabIssueTick(); projTick(); repTick(); fvpTick(); presDirTick();
}

/* ─── вице-премьер-игрок ────────────────────────────────────────── */
function viceActs(A,d){
  A({id:'coord',name:'Координационное совещание',cap:4,txt:'министры теснее работают с премьером; сплочённость растёт',
    run(){ npcMins().forEach(m=>m.loyal=clamp(m.loyal+3,0,100)); d.score=clamp(d.score+3,0,100); return 'Вице-премьер провёл координационное совещание.'; }});
  A({id:'curate',name:'Взять проект под контроль',cap:5,pick:'proj',txt:'готовность проекта +8; сдадут — слава и вам',
    ok:()=>projs().length?true:'Национальных проектов сейчас нет',
    run(x){ const p=projLive(x); if(!p)return ''; p.prog=Math.min(99,p.prog+8); p.vice=true; d.score=clamp(d.score+3,0,100);
      return 'Вице-премьер взял под контроль проект «'+NP(x).name+'».'; }});
  A({id:'mediate',name:'Развести спор министров',cap:3,txt:'спор на заседании решается компромиссом, обе стороны спокойны',
    ok:()=>S.cabIssue?true:'Спорных вопросов нет',
    run(){ const x=CI(S.cabIssue.id); S.cabIssue=null; loyalShift(x.a,2); loyalShift(x.b,2); d.score=clamp(d.score+4,0,100); bumpRep('comp',1);
      return 'Вице-премьер развёл спор «'+x.title.toLowerCase()+'».'; }});
  A({id:'stand',name:'Подменить премьера на публике',cap:5,txt:'имя в стране растёт; премьер не всегда этому рад',
    run(){ bumpRep('folk',2); if(!chief())S.you.inf=clamp(S.you.inf+3,0,100); d.score=clamp(d.score-2,0,100);
      return 'Вице-премьер выступил от имени правительства.'; }});
}
function deskVice(d){
  if(!inCoal(PL)){ lostSeat('ваша партия вышла из правительства'); return; }
  d.score=clamp(r1(d.score+(cohesion()-50)*0.04+(projs().some(p=>p.vice)?1:0)),0,100);
}
/* министр-игрок: свой проект и интрига */
function minActsExtra(A,d,post){
  A({id:'myproj',name:'Предложить национальный проект',cap:6,txt:'премьер может поручить проект вашему ведомству',
    ok:()=>projs().length>=PROJ_MAX?'Кабинет уже ведёт '+PROJ_MAX+' проекта':NPROJ.some(x=>x.post===post&&!projDone(x.id)&&!projLive(x.id))?true:'Для вашего ведомства проектов нет',
    run(){ const x=NPROJ.find(z=>z.post===post&&!projDone(z.id)&&!projLive(z.id));
      const ok=isPM()||Math.random()<clamp(0.3+(d.score-50)*0.012+(balance()>0?0.15:-0.1),0.08,0.85);
      if(!ok){ d.score=clamp(d.score-2,0,100); return 'Премьер отложил ваш проект «'+x.name+'».'; }
      projStart(x.id,S.gov.lead); d.score=clamp(d.score+3,0,100); return 'Премьер поручил вашему ведомству проект «'+x.name+'».'; }});
  A({id:'intrigue',name:'Интрига против министра',cap:8,pick:'minister',txt:'попытаться выжить соперника из кабинета',
    run(x){ const m=minOf(x); if(!m||m.you)return '';
      const ch=clamp(0.3+(d.score-50)*0.01-(m.loyal-50)*0.006,0.08,0.75);
      if(Math.random()<ch){ minQuits(m,'после закулисной интриги'); d.score=clamp(d.score+4,0,100); addTrail(2,'интрига в кабинете'); return 'Интрига удалась: '+m.name+' покинул кабинет.'; }
      d.score=clamp(d.score-8,0,100); addTrail(3,'неудачная интрига'); bumpRep('honest',-2); return 'Интрига раскрыта: премьер недоволен вами.'; }});
}
