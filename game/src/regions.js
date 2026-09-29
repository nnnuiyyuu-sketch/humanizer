
/* ════════════════════════════════════════════════════════════════
   КРАЯ ГЛУБЖЕ
   У края есть не только глава, но и мэр столицы края — и они не
   всегда из одной партии. Главы шлют в центр просьбы: деньги,
   полномочия, исключения, помощь против мэра. Где обида копится,
   растёт сепаратизм: сначала референдум о полномочиях, потом —
   о суверенитете. Центр может договориться, оспорить в суде или
   ввести прямое управление — за счёт легитимности.
   ════════════════════════════════════════════════════════════════ */
const SEP_BASE={kavkaz:1.3,dv:0.7,arctic:0.6,balt:0.5,south:0.4};   // где своя история и своя обида
const NPC_MAYOR_TERM=16;
const AUTO_NAME=['нет','расширенная','договорная'];

function regInit(){
  if(!S.mayors){ S.mayors={}; REGIONS.forEach(r=>S.mayors[r.id]=makeMayorNpc(r.id)); }
  S.auto=S.auto||{}; S.sep=S.sep||{}; S.sov=S.sov||{}; S.direct=S.direct||{};
  S.regLog=S.regLog||[]; S.greqCool=S.greqCool||{};
}
function makeMayorNpc(rid,party){
  return {region:rid,party:party||drawByShare(seedShare(R(rid),1.0)),name:depName(),comp:ri(30,85),
    feud:ri(0,20),since:S.q,till:S.q+ri(4,NPC_MAYOR_TERM)};
}
function mayorOf(rid){ regInit(); return S.mayors[rid]||null; }
function regAuto(rid){ return (S.auto&&S.auto[rid])||0; }
function regSep(rid){ return (S.sep&&S.sep[rid])||0; }
function regSov(rid){ return !!(S.sov&&S.sov[rid]); }
function sepWord(v){ return v<10?'нет':v<25?'разговоры':v<45?'движение':v<65?'сильное':'на грани'; }
function feudWord(v){ return v<20?'ладят':v<40?'трения':v<60?'конфликт':'война'; }
function regLog(rid,t,k){ regInit(); S.regLog.unshift({q:S.q,rid,t,k:k||''}); if(S.regLog.length>40)S.regLog.pop(); }
function centralPower(){ return isPM()||isPres(); }
/* какую долю налогов край оставляет себе */
function regRevenueCut(){
  const tot=REGIONS.reduce((a,r)=>a+r.pop,0);
  return REGIONS.reduce((a,r)=>a+(regAuto(r.id)*0.1+(regSov(r.id)?0.6:0))*r.pop/tot,0);
}

/* ─── мэр столицы края ──────────────────────────────────────────── */
function mayorSync(){
  const d=S.desk, mine=mySeat()==='mayor'&&d?d.rid:null;
  REGIONS.forEach(r=>{
    const m=S.mayors[r.id];
    if(r.id===mine){ if(!m||!m.you)S.mayors[r.id]={region:r.id,party:PL,name:S.you.name,comp:60,feud:m?m.feud:10,since:S.q,till:d.till,you:true}; }
    else if(m&&m.you)S.mayors[r.id]=makeMayorNpc(r.id,govWinner(r.id));
    else if(m&&S.q>=m.till){
      const w=govWinner(r.id); S.mayors[r.id]=makeMayorNpc(r.id,w); S.mayors[r.id].till=S.q+NPC_MAYOR_TERM;
      regLog(r.id,'Новый мэр '+r.cap+' — '+S.mayors[r.id].name+' («'+P(w).short+'»).');
    }
  });
}
function feudTick(){
  REGIONS.forEach(r=>{
    const g=govOf(r.id), m=S.mayors[r.id]; if(!g||!m)return;
    const gp=P(g.party), mp=P(m.party); if(!gp||!mp)return;
    // вражда тянется к своему уровню: разные партии, далёкие курсы, горячий край, вы против оппозиции
    const gap=g.party===m.party?0:axDist(gp.st,mp.st);
    const mineVsOpp=(g.party===PL)!==(m.party===PL)&&!(inCoal(g.party)&&inCoal(m.party));
    const target=(g.party===m.party?4:12+gap*18)+Math.max(0,S.unrest[r.id]-15)*0.6+(mineVsOpp?10:0);
    m.feud=clamp(r1(m.feud+(target-m.feud)*0.2+rnd(-5,7)),0,100);
    if(m.feud>=40)S.unrest[r.id]=clamp(S.unrest[r.id]+m.feud*0.012,0,100);
    if(m.feud>=52&&!(m.flare>S.q-8)&&Math.random()<0.5){ m.flare=S.q; feudFlare(r.id); }
  });
}
function feudFlare(rid){
  const r=R(rid), g=govOf(rid), m=S.mayors[rid];
  S.unrest[rid]=clamp(S.unrest[rid]+4,0,100);
  regLog(rid,'Мэр '+r.cap+' и глава края в открытой войне.','b');
  logMsg(r.name+': мэр '+r.cap+' '+(m.you?'(вы)':m.name)+' и глава края '+(g.you?'(вы)':g.name)+' воюют открыто.',1);
  const res=`<div class="res"><span>Глава края</span><b class="w">${g.you?'вы':g.name} · ${P(g.party).short}</b>
      <span>Мэр ${r.cap}</span><b class="w">${m.you?'вы':m.name} · ${P(m.party).short}</b>
      <span>Вражда</span><b class="bad">${Math.round(m.feud)} · ${feudWord(m.feud)}</b>
      <span>Напряжённость в крае</span><b>${Math.round(S.unrest[rid])}</b></div>`;
  if(g.you||m.you){
    const other=g.you?'мэр '+r.cap+' '+m.name:'глава края '+g.name;
    sheetOpen({eye:r.name+' · '+dateLabel(),title:g.you?'Мэр против вас':'Губернатор против вас',
      body:`<p class="lead">${other[0].toUpperCase()+other.slice(1)} срывает ваши решения и жалуется в газеты.</p>${res}`,
      opts:[{label:'Договориться',hint:'5 веса · вражда −35',fn(){ if(!payCap(5))return; m.feud=clamp(m.feud-35,0,100);
          logMsg('Вы договорились: '+other+' сбавил тон.'); render(); }},
        g.you?{label:'Отстранить мэра через заксобрание',hint:'8 веса · легитимность −2 · шанс '+Math.round(feudOustChance(rid)*100)+'%',fn(){
          if(!payCap(8))return; bumpLegit(-2);
          if(Math.random()<feudOustChance(rid)){ S.mayors[rid]=makeMayorNpc(rid,PL); S.mayors[rid].feud=5;
            regLog(rid,'Заксобрание отстранило мэра '+r.cap+'.','b'); logMsg('Мэр '+r.cap+' отстранён.',1); bumpRep('firm',2); shiftMood('urban',-1); }
          else { m.feud=clamp(m.feud+15,0,100); bumpRep('folk',-2); logMsg('Заксобрание не отстранило мэра: вы проиграли раунд.',1); }
          render(); }}
        :{label:'Пожаловаться в центр',hint:'шанс '+Math.round(feudCenterChance()*100)+'% · губернатора одёрнут',fn(){
          if(Math.random()<feudCenterChance()){ m.feud=clamp(m.feud-30,0,100); g.rel=clamp(g.rel-10,0,100);
            logMsg('Центр одёрнул губернатора: вражда стихла.',1); }
          else { m.feud=clamp(m.feud+8,0,100); logMsg('Центр промолчал. Губернатор только осмелел.',1); }
          render(); }},
        {label:'Публичная война',hint:'край и страна вас заметят · напряжённость растёт',fn(){
          m.feud=clamp(m.feud+10,0,100); S.unrest[rid]=clamp(S.unrest[rid]+3,0,100); bumpRep('folk',2); bumpRep('firm',2);
          S.rmod[rid]=clamp(S.rmod[rid]+1.5,-22,22); logMsg('Вы вынесли войну с '+other+' на публику.'); render(); }}]});
    return;
  }
  if(!centralPower())return;
  sheetOpen({eye:r.name+' · '+dateLabel(),title:'Мэр против губернатора',
    body:`<p class="lead">В ${r.cap} мэр и глава края перестали разговаривать: стройки стоят, а газеты считают, кто кого.</p>${res}
      <p class="hint">Центр может помирить, встать на чью-то сторону или смотреть со стороны.</p>`,
    opts:[{label:'Помирить',hint:'ход и 6 веса · вражда −40',fn(){ if(!pay({ap:1,cap:6},'Примирение в '+r.cap))return;
        m.feud=clamp(m.feud-40,0,100); g.rel=clamp(g.rel+3,0,100); S.unrest[rid]=clamp(S.unrest[rid]-3,0,100);
        regLog(rid,'Центр помирил мэра и главу края.','g'); render(); }},
      {label:'Поддержать губернатора',hint:'глава края ваш должник · горожане недовольны',fn(){
        g.rel=clamp(g.rel+10,0,100); m.feud=clamp(m.feud-20,0,100); shiftMood('urban',-1);
        if(!govElected()&&Math.random()<0.5){ S.mayors[rid]=makeMayorNpc(rid,g.party); regLog(rid,'Мэр '+r.cap+' ушёл после вмешательства центра.','b'); }
        render(); }},
      {label:'Поддержать мэра',hint:'глава края обидится · город благодарен',fn(){
        g.rel=clamp(g.rel-12,0,100); m.feud=clamp(m.feud-20,0,100); shiftMood('urban',1); render(); }},
      {label:'Не вмешиваться',hint:'напряжённость +3',fn(){ S.unrest[rid]=clamp(S.unrest[rid]+3,0,100); }}]});
}
function feudOustChance(rid){
  const here=S.deputies.filter(d=>d.region===rid), mine=here.filter(d=>d.party===PL||inCoal(d.party)&&inCoal(PL)).length;
  return clamp(0.25+mine/Math.max(1,here.length)*0.5,0.15,0.8);
}
function feudCenterChance(){ return clamp(S.gov.lead===PL?0.75:inCoal(PL)?0.55:0.25,0.1,0.9); }

/* ─── просьбы глав краёв к центру ──────────────────────────────── */
const GREQ_WHAT=['больницу','дороги','котельные','школы','мост','водопровод'];
function greqTick(){
  if(!centralPower()||Math.random()>0.3)return;
  const pool=REGIONS.filter(r=>{ const g=govOf(r.id); return g&&!g.you&&!regSov(r.id)&&!(S.greqCool[r.id]>S.q); });
  if(!pool.length)return;
  const r=pick(pool), g=govOf(r.id), m=S.mayors[r.id], gp=P(g.party);
  const kinds=['money','money'];
  if(regAuto(r.id)<2&&(regSep(r.id)>=20||(gp.st.reg||0)>=0.8))kinds.push('powers','powers');
  if(m&&!m.you&&m.feud>=45&&m.party!==g.party)kinds.push('mayor');
  const law=S.laws.filter(l=>T(l.topic)&&!T(l.topic).special).slice(-6);
  if(law.length)kinds.push('exempt');
  S.greqCool[r.id]=S.q+4;
  greqAsk(r.id,pick(kinds),law.length?pick(law):null);
}
function greqAsk(rid,kind,law){
  const r=R(rid), g=govOf(rid), m=S.mayors[rid];
  const others=d=>REGIONS.forEach(x=>{ const o=govOf(x.id); if(o&&x.id!==rid&&!o.you)o.rel=clamp(o.rel+d,0,100); });
  const head=`<div class="res"><span>Глава края</span><b class="w">${g.name} · ${P(g.party).short}</b>
      <span>Отношение к вам</span><b class="${g.rel<36?'bad':g.rel>=52?'good':''}">${Math.round(g.rel)} · ${govLoyal(g)}</b>
      <span>Напряжённость</span><b>${Math.round(S.unrest[rid])} · ${unrestWord(S.unrest[rid])}</b>
      <span>Сепаратизм</span><b class="${regSep(rid)>=45?'bad':''}">${Math.round(regSep(rid))} · ${sepWord(regSep(rid))}</b></div>`;
  const refuse=(d,t)=>({label:'Отказать',hint:'отношение '+d+(t?' · '+t:''),fn(){ g.rel=clamp(g.rel+d,0,100);
      if(kind==='powers')S.sep[rid]=clamp(regSep(rid)+6,0,100);
      if(kind==='money'&&!(g.party===PL||inCoal(g.party)))S.unrest[rid]=clamp(S.unrest[rid]+2,0,100);
      regLog(rid,'Центр отказал главе края.','b'); render(); }});
  let title,lead,opts;
  if(kind==='money'){
    const what=pick(GREQ_WHAT), amt=ri(6,14);
    title='Трансферт на '+what; lead=`${g.name} просит ${amt} млрд на ${what} в ${r.cap}. Без денег край будет винить центр.`;
    opts=[{label:'Дать '+amt+' млрд',hint:'отношение +8 · напряжённость −5',fn(){
        if(S.treasury<amt){ toast('В казне нет '+amt+' млрд'); return; }
        S.treasury=r1(S.treasury-amt); g.rel=clamp(g.rel+8,0,100); S.unrest[rid]=clamp(S.unrest[rid]-5,0,100);
        S.rmod[rid]=clamp(S.rmod[rid]+1.2,-22,22); S.sep[rid]=clamp(regSep(rid)-3,0,100);
        regLog(rid,'Центр дал '+amt+' млрд на '+what+'.','g'); logMsg('Трансферт краю '+r.name+': '+amt+' млрд на '+what+'.'); render(); }},
      {label:'Дать половину',hint:Math.round(amt/2)+' млрд · отношение +2',fn(){ const h=Math.round(amt/2);
        if(S.treasury<h){ toast('В казне нет '+h+' млрд'); return; }
        S.treasury=r1(S.treasury-h); g.rel=clamp(g.rel+2,0,100); S.unrest[rid]=clamp(S.unrest[rid]-2,0,100); render(); }},
      refuse(-8)];
  }
  if(kind==='powers'){
    title='Больше полномочий краю'; lead=`${g.name} просит передать краю часть полномочий центра: налоги, земля, свои законы. Край останется спокойнее — и богаче за счёт казны.`;
    opts=[{label:'Уступить',hint:'автономия +1 · сепаратизм −12 · край оставит себе часть налогов · другие главы ревнуют',fn(){
        S.auto[rid]=Math.min(2,regAuto(rid)+1); S.sep[rid]=clamp(regSep(rid)-12,0,100); S.unrest[rid]=clamp(S.unrest[rid]-5,0,100);
        g.rel=clamp(g.rel+12,0,100); others(-2); bumpLegit(-1);
        regLog(rid,'Край получил автономию: '+AUTO_NAME[regAuto(rid)]+'.','g'); chron(r.name+' получил расширенные полномочия.','');
        render(); }},
      refuse(-10,'сепаратизм +6')];
  }
  if(kind==='mayor'){
    title='Помочь убрать мэра '+r.cap; lead=`${g.name} воюет с мэром ${r.cap} ${m.name} («${P(m.party).short}») и просит центр вмешаться.`;
    opts=[{label:'Поддержать губернатора',hint:'мэр уйдёт · легитимность −1 · горожане недовольны',fn(){
        S.mayors[rid]=makeMayorNpc(rid,g.party); S.mayors[rid].feud=5; g.rel=clamp(g.rel+10,0,100);
        bumpLegit(-1); shiftMood('urban',-1); regLog(rid,'Мэр '+r.cap+' ушёл с подачи центра.','b'); render(); }},
      refuse(-6)];
  }
  if(kind==='exempt'){
    title='Исключение из закона'; lead=`${g.name} просит, чтобы закон «${law.name}» не действовал в крае ${r.name}: «у нас своя специфика».`;
    opts=[{label:'Дать исключение',hint:'отношение +10 · легитимность −2 · другие главы ревнуют',fn(){
        g.rel=clamp(g.rel+10,0,100); bumpLegit(-2); others(-3); S.unrest[rid]=clamp(S.unrest[rid]-3,0,100);
        regLog(rid,'Край выпросил исключение из закона «'+law.name+'».','b'); render(); }},
      refuse(-6)];
  }
  sheetOpen({eye:'Край '+r.name+' · просьба в центр',title,body:`<p class="lead">${lead}</p>${head}`,opts});
}

/* ─── сепаратизм ────────────────────────────────────────────────── */
function sepTick(){
  REGIONS.forEach(r=>{
    // сепаратизм тянется к своему уровню: своя история, напряжённость, низкая поддержка, обида на центр
    const b=SEP_BASE[r.id]||0, g=govOf(r.id), k=0.5+b;
    let target=b*22+Math.max(0,S.unrest[r.id]-15)*0.8*k+Math.max(0,50-regApproval(r.id))*0.6*k
      +regAuto(r.id)*4*b+(g&&!g.you&&g.rel<30?6:0)+(regSov(r.id)?20:0)-(S.direct[r.id]>S.q?15:0)
      +nbPressure(r.id)*5;                                   // враждебный сосед подкармливает сепаратистов
    S.sep[r.id]=clamp(r1(regSep(r.id)+(target-regSep(r.id))*0.12+rnd(-2,2.5)),0,100);
  });
}

/* ─── региональный референдум ──────────────────────────────────── */
const RREF_NAME={auto:'о полномочиях края',sov:'о суверенитете'};
function rrefTick(){
  if(S.rref){ if(S.q>=S.rref.due)rrefResolve(); return; }
  if(S.rrefCool>S.q)return;
  const top=REGIONS.filter(x=>!regSov(x.id)).sort((a,b)=>regSep(b.id)-regSep(a.id))[0];
  if(!top)return; const s=regSep(top.id);
  if(s<35||Math.random()>0.2+(s-35)*0.01)return;
  rrefStart(top.id,s>=62&&regAuto(top.id)>=1||regAuto(top.id)>=2?'sov':'auto','край');
}
function rrefStart(rid,kind,by){
  S.rref={rid,kind,q:S.q,due:S.q+1,by};
  const r=R(rid);
  regLog(rid,'Назначен референдум '+RREF_NAME[kind]+'.','b');
  logMsg(r.name+' назначил референдум '+RREF_NAME[kind]+'. Голосование — в конце следующего квартала.',1);
  chron(r.name+': референдум '+RREF_NAME[kind]+'.','b');
  cover({ax:'reg',stance:1,good:r.name+' спросит жителей сам',bad:r.name+': референдум '+RREF_NAME[kind]+' раскалывает страну',
    flat:'В крае '+r.name+' назначен референдум'});
  if(centralPower()&&by!=='you')askRref();
}
function rrefYes(){
  const x=S.rref; if(!x)return 0;
  return clamp(0.3+regSep(x.rid)/150+(S.unrest[x.rid]-20)/250+(x.kind==='auto'?0.1:-0.05)+(x.deal?-0.15:0),0.08,0.92);
}
function rrefCourtChance(){
  const x=S.rref; return clamp(0.3+courtSeats(PL)/courtN()*0.4+(x&&x.kind==='sov'?0.25:0),0.1,0.9);
}
function askRref(){
  const x=S.rref; if(!x)return;
  const r=R(x.rid), sov=x.kind==='sov';
  const opts=[{label:'Разрешить',hint:'пусть край решит сам',fn(){ render(); }}];
  if(!x.court)opts.push({label:'Оспорить в Конституционном суде',hint:'ход и 8 веса · шанс '+Math.round(rrefCourtChance()*100)+'% · отмена поднимет сепаратизм',fn(){
    if(!pay({ap:1,cap:8},'Иск против референдума'))return; x.court=true;
    if(Math.random()<rrefCourtChance()){ S.rref=null; S.rrefCool=S.q+4; S.sep[x.rid]=clamp(regSep(x.rid)+8,0,100); bumpLegit(1);
      regLog(x.rid,'Суд отменил референдум.','b'); logMsg('Конституционный суд отменил референдум в крае '+r.name+'.',1); }
    else logMsg('Суд не нашёл оснований отменить референдум в крае '+r.name+'.',1);
    render(); }});
  opts.push(sov?{label:'Договор о разграничении полномочий',hint:'15 млрд · автономия договорная · сепаратизм −25 · легитимность −2',fn(){
      if(S.treasury<15){ toast('В казне нет 15 млрд'); return; }
      S.treasury=r1(S.treasury-15); S.auto[x.rid]=2; S.sep[x.rid]=clamp(regSep(x.rid)-25,0,100); bumpLegit(-2);
      S.rref=null; S.rrefCool=S.q+6; regLog(x.rid,'Подписан договор о разграничении полномочий.','g');
      chron('Договор с краем '+r.name+': референдум отменён.','g'); render(); }}
    :{label:'Договориться заранее',hint:'8 млрд · автономия +1 · референдум снимут',fn(){
      if(S.treasury<8){ toast('В казне нет 8 млрд'); return; }
      S.treasury=r1(S.treasury-8); S.auto[x.rid]=Math.min(2,regAuto(x.rid)+1); S.sep[x.rid]=clamp(regSep(x.rid)-12,0,100);
      S.rref=null; S.rrefCool=S.q+4; regLog(x.rid,'Центр уступил полномочия до референдума.','g'); render(); }});
  if(sov)opts.push({label:'Прямое управление',hint:'ход и 12 веса · легитимность −8 · сепаратизм −20 сейчас, обида надолго',fn(){ rrefDirect(x.rid); }});
  sheetOpen({eye:'Край '+r.name+' · референдум',title:'Референдум '+RREF_NAME[x.kind],
    body:`<p class="lead">${sov?'Край хочет решить, остаётся ли он под властью центра. Даже проигранный референдум — трещина.'
        :'Край хочет больше прав: свои налоги, свои законы, свой бюджет.'}</p>
      <div class="res"><span>Сепаратизм</span><b class="bad">${Math.round(regSep(x.rid))} · ${sepWord(regSep(x.rid))}</b>
        <span>Прогноз «за»</span><b class="${rrefYes()>0.5?'bad':''}">${Math.round(rrefYes()*100)}%</b>
        <span>Автономия сейчас</span><b>${AUTO_NAME[regAuto(x.rid)]}</b>
        <span>Голосование</span><b>${dateLabel(x.due)}</b></div>`,opts});
}
function rrefDirect(rid){
  if(!pay({ap:1,cap:12},'Прямое управление'))return;
  const r=R(rid);
  bumpLegit(-8); S.unrest[rid]=clamp(S.unrest[rid]-12,0,100); S.sep[rid]=clamp(regSep(rid)-20,0,100);
  S.direct[rid]=S.q+8; S.sov[rid]=false; if(S.rref&&S.rref.rid===rid){ S.rref=null; S.rrefCool=S.q+6; }
  shiftMood('intel',-3); shiftMood('youth',-2); shiftMood('patr',2); bumpRep('firm',4); bumpRep('honest',-2);
  REGIONS.forEach(x=>{ if(x.id!==rid&&SEP_BASE[x.id])S.sep[x.id]=clamp(regSep(x.id)+5,0,100); });
  NEIGHBOURS.forEach(x=>{ const st=nbOf(x.id); if(!st)return;            // за рубежом прямое управление тоже заметят
    if(x.id==='ostmark')st.rel=clamp(st.rel-8,0,100); if(x.border.indexOf(rid)>=0)st.rel=clamp(st.rel-6,0,100); });
  regLog(rid,'Введено прямое управление из центра.','b'); chron('Прямое управление в крае '+r.name+'.','b');
  cover({ax:'reg',stance:-2,good:'Центр восстановил порядок в крае '+r.name,bad:'Прямое управление: край '+r.name+' лишён самоуправления',
    flat:'В крае '+r.name+' введено прямое управление'});
  render();
}
function rrefResolve(){
  const x=S.rref, yes=clamp(rrefYes()+rnd(-0.08,0.08),0.05,0.95), pass=yes>0.5;   // прогноз считается, пока референдум жив
  S.rref=null; S.rrefCool=S.q+4;
  const r=R(x.rid);
  const pct=Math.round(yes*100);
  if(x.kind==='auto'){
    if(pass){ S.auto[x.rid]=Math.min(2,regAuto(x.rid)+1); S.sep[x.rid]=clamp(regSep(x.rid)-10,0,100); S.unrest[x.rid]=clamp(S.unrest[x.rid]-6,0,100); }
    else S.sep[x.rid]=clamp(regSep(x.rid)-6,0,100);
    regLog(x.rid,'Референдум о полномочиях: '+pct+'% «за» — '+(pass?'принят':'провален')+'.',pass?'':'g');
    logMsg(r.name+': референдум о полномочиях '+(pass?'принят':'провален')+' ('+pct+'% «за»).',1);
    if(x.by==='you'&&pass){ addCap(8); bumpRep('folk',3); }
    return;
  }
  if(!pass){
    S.sep[x.rid]=clamp(regSep(x.rid)-15,0,100);
    regLog(x.rid,'Референдум о суверенитете провален: '+pct+'% «за».','g');
    logMsg(r.name+': суверенитет не поддержан ('+pct+'% «за»).',1); chron(r.name+' остался: суверенитет не набрал большинства.','g');
    return;
  }
  S.sov[x.rid]=true; shiftMood('patr',-3); REGIONS.forEach(z=>S.unrest[z.id]=clamp(S.unrest[z.id]+2,0,100));
  regLog(x.rid,'Край объявил суверенитет: '+pct+'% «за».','b');
  logMsg(r.name+' объявил суверенитет ('+pct+'% «за»). Налоги края в центр больше не идут.',1);
  chron(r.name+' объявил суверенитет.','b');
  cover({good:r.name+' объявил суверенитет: время договариваться',bad:'Суверенитет '+r.name+': страна трещит',flat:r.name+' объявил суверенитет'});
  if(centralPower())askSov(x.rid);
}
/* край, объявивший суверенитет: налоги не идут, легитимность тает */
function askSov(rid){
  if(!regSov(rid))return;
  const r=R(rid);
  sheetOpen({eye:'Край '+r.name+' · суверенитет',title:'Край объявил суверенитет',
    body:`<p class="lead">Налоги края остаются в крае, законы центра там исполняют выборочно. Каждый квартал без решения
        стоит легитимности и денег.</p>
      <div class="res"><span>Сепаратизм</span><b class="bad">${Math.round(regSep(rid))}</b>
        <span>Потеря доходов казны</span><b class="bad">≈${Math.round(regRevenueCut()*100)}%</b></div>`,
    opts:[{label:'Договор о разграничении полномочий',hint:'15 млрд · автономия договорная · суверенитет снимается · легитимность −2',fn(){
        if(S.treasury<15){ toast('В казне нет 15 млрд'); return; }
        S.treasury=r1(S.treasury-15); S.sov[rid]=false; S.auto[rid]=2; S.sep[rid]=clamp(regSep(rid)-25,0,100); bumpLegit(-2);
        regLog(rid,'Договор с центром: суверенитет снят.','g'); chron('Договор с краем '+r.name+': суверенитет снят.','g'); render(); }},
      {label:'Прямое управление',hint:'ход и 12 веса · легитимность −8 · соседи с обидой насторожатся',fn(){ rrefDirect(rid); }},
      {label:'Не признавать и ждать',hint:'легитимность и доходы тают каждый квартал',fn(){ render(); }}]});
}

/* чужой кабинет тоже решает: договор или прямое управление — по своему курсу */
function aiSovDecide(rid){
  const lead=P(S.gov.lead), r=R(rid); if(!lead)return;
  S.sov[rid]=false;
  if((lead.st.reg||0)>=0||Math.random()<0.5){
    S.auto[rid]=2; S.sep[rid]=clamp(regSep(rid)-25,0,100); bumpLegit(-2);
    regLog(rid,'Кабинет '+lead.leader+' подписал договор: суверенитет снят.','g'); chron('Договор центра с краем '+r.name+'.','g');
    logMsg('Кабинет '+lead.leader+' подписал договор с краем '+r.name+': суверенитет снят, автономия договорная.',1);
  } else {
    S.direct[rid]=S.q+8; S.sep[rid]=clamp(regSep(rid)-20,0,100); S.unrest[rid]=clamp(S.unrest[rid]-8,0,100); bumpLegit(-8);
    shiftMood('intel',-2); shiftMood('patr',1.5);
    regLog(rid,'Кабинет '+lead.leader+' ввёл прямое управление.','b'); chron('Прямое управление в крае '+r.name+'.','b');
    logMsg('Кабинет '+lead.leader+' ввёл в крае '+r.name+' прямое управление.',1);
  }
}

/* ─── губернатор-игрок: референдум о полномочиях ───────────────── */
function govRefAct(rid){
  if(S.rref){ return 'Референдум уже идёт в крае '+R(S.rref.rid).name+'.'; }
  if(regAuto(rid)>=2)return 'У края и так договорная автономия.';
  rrefStart(rid,'auto','you'); const d=desk(); d.center=clamp(d.center-12,0,100);
  return 'Вы назначили референдум о полномочиях края. Центр недоволен.';
}

/* ─── квартал краёв ─────────────────────────────────────────────── */
function regionsTick(){
  regInit(); mayorSync(); feudTick(); sepTick(); rrefTick(); greqTick();
  REGIONS.forEach(r=>{ if(regSov(r.id)){ bumpLegit(-0.6); S.rmod[r.id]=clamp(S.rmod[r.id]-0.5,-22,22);
    if(centralPower()&&(S.q-(S.sovAsk||0))>=4){ S.sovAsk=S.q; askSov(r.id); }
    else if(!centralPower()&&Math.random()<0.35)aiSovDecide(r.id); } });
}

/* ─── в интерфейсе: карточка края и панель «Края и центр» ────────── */
function regCardExtra(rid){
  const r=R(rid), m=mayorOf(rid), g=govOf(rid), log=S.regLog.filter(x=>x.rid===rid).slice(0,3);
  return `<h3 class="sub">Мэр ${r.cap}</h3>
    ${m?`<div class="dep"><div class="who"><b>${m.you?'Вы':m.name}</b><span>${P(m.party)?P(m.party).name:''} · с губернатором: ${feudWord(m.feud)}</span></div>
      <b class="num-s ${m.feud>=60?'bad':m.feud<20?'good':''}">${Math.round(m.feud)}</b></div>`:''}
    <div class="res" style="margin:6px 0 0"><span>Автономия</span><b class="w">${AUTO_NAME[regAuto(rid)]}</b>
      <span>Сепаратизм</span><b class="${regSep(rid)>=45?'bad':''}">${Math.round(regSep(rid))} · ${sepWord(regSep(rid))}</b>
      ${regSov(rid)?'<span>Статус</span><b class="bad">объявлен суверенитет</b>':''}
      ${S.direct[rid]>S.q?'<span>Прямое управление</span><b class="bad">до '+dateLabel(S.direct[rid])+'</b>':''}</div>
    ${log.length?log.map(x=>`<div class="crow"><s>${shortDate(x.q)}</s><span class="${x.k==='b'?'bad':x.k==='g'?'good':''}">${x.t}</span></div>`).join(''):''}`;
}
function regCenterPanel(){
  regInit();
  const items=[];
  if(S.rref){ const r=R(S.rref.rid);
    items.push(`<div class="crow"><s>${dateLabel(S.rref.due)}</s><span><b>${r.name}</b>: референдум ${RREF_NAME[S.rref.kind]} · прогноз «за» ${Math.round(rrefYes()*100)}%
      ${centralPower()?`<button class="btn sm" onclick="askRref()">Решить</button>`:''}</span></div>`); }
  REGIONS.filter(r=>regSov(r.id)).forEach(r=>items.push(`<div class="crow"><s>кризис</s><span><b>${r.name}</b> объявил суверенитет и не платит налоги в центр
      ${centralPower()?`<button class="btn sm" onclick="askSov('${r.id}')">Решить</button>`:''}</span></div>`));
  REGIONS.filter(r=>{ const m=S.mayors[r.id]; return m&&m.feud>=40; }).forEach(r=>{ const m=S.mayors[r.id];
    items.push(`<div class="crow"><s>мэр</s><span><b>${r.cap}</b>: мэр ${m.you?'(вы)':m.name} против главы края — ${feudWord(m.feud)}, ${Math.round(m.feud)}</span></div>`); });
  REGIONS.filter(r=>regSep(r.id)>=25&&!regSov(r.id)).sort((a,b)=>regSep(b.id)-regSep(a.id)).forEach(r=>
    items.push(`<div class="crow"><s>край</s><span><b>${r.name}</b>: сепаратизм ${Math.round(regSep(r.id))} — ${sepWord(regSep(r.id))}</span></div>`));
  const auto=REGIONS.filter(r=>regAuto(r.id)).map(r=>r.name.replace(/ (регион|область|край)$/,'')+' — '+AUTO_NAME[regAuto(r.id)]);
  return panel({cls:items.length?'warn':'',title:'Края и центр',meta:items.length?items.length+' на контроле':'спокойно',
    body:(items.length?items.join(''):'<div class="empty">Референдумов нет, мэры с губернаторами ладят, сепаратизм — разговоры.</div>')+
      `<p class="hint" style="margin-top:8px">${auto.length?'Автономия: '+auto.join(', ')+'. Автономные края оставляют часть налогов себе, их глав не снять из центра. ':''}
      Сепаратизм растёт от напряжённости, низкой поддержки и обиды на центр; сильнее всего там, где своя история.</p>`});
}
