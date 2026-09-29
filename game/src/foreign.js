
/* ════════════════════════════════════════════════════════════════
   ВНЕШНЯЯ ПОЛИТИКА
   Четыре соседа — это не только цифра отношений. Торговое соглашение
   открывает рынок, но бьёт по тем, кому придётся конкурировать, и
   его ратифицирует Сенат, где сидят их края. Холодный сосед вводит
   санкции и устраивает инциденты на границе; горячая граница греет
   приграничные края и сепаратистов. Визит — это повестка: торговля,
   граница или энергетика, и у каждой свой край-получатель.
   ════════════════════════════════════════════════════════════════ */
const TRADE_HURT={ostmark:'work',zarech:'agro',gorye:'agro',meridia:'work'};   // кто проигрывает от открытого рынка
const TRADE_COST=10, SANC_COST=8, CRISIS_LEN=3;

function fpCan(){ return isPM()||isPres()||(mySeat()==='min'&&S.you.post==='mid'); }
function sancOn(id){ const st=nbOf(id); return !!(st&&st.sanc&&st.sanc.until>S.q); }
function ourSanc(id){ const st=nbOf(id); return !!(st&&st.our>S.q); }
function crisisWith(id){ return S.bcrisis&&S.bcrisis.nb===id?S.bcrisis:null; }
/* сколько внешняя политика добавляет к внешнему спросу */
function fpDemand(){
  let v=0;
  NEIGHBOURS.forEach(x=>{ const st=nbOf(x.id); if(!st)return;
    if(st.trade)v+=x.trade*6;
    if(sancOn(x.id))v-=x.power*7*(st.sanc.soft?0.5:1);
    if(ourSanc(x.id))v-=x.trade*4;
    const c=crisisWith(x.id); if(c)v-=x.power*3*c.stage; });
  return r1(v);
}
/* горячая граница: к давлению отношений прибавляется кризис */
function fpBorder(rid){
  const c=S.bcrisis; if(!c)return 0;
  const x=NB_(c.nb); return x&&x.border.indexOf(rid)>=0?1.5*c.stage:0;
}

/* ─── торговое соглашение: Сенат голосует краями ────────────────── */
function tradeVotes(id){
  const x=NB_(id), hurt=TRADE_HURT[id];
  let yes=0;
  S.senate.forEach(s=>{
    const p=P(s.party); if(!p)return;
    let v=(s.party===S.gov.lead?16:inCoal(s.party)?8:-10)+(p.st.world||0)*8+(s.st.world||0)*4+6;
    v-=(R(s.region).mix[hurt]||0)*0.6;                         // сенатор помнит, кто в его крае проиграет
    if(x.border.indexOf(s.region)>=0)v+=4;                    // приграничным краям торговля выгодна
    v+=(s.rel-50)*0.15+noise(s.id+'trade'+id+S.q,9);
    if(v>0)yes++;
  });
  return {yes,need:SEN_MAJ};
}
function askTrade(id){
  const x=NB_(id), st=nbOf(id), hurt=TRADE_HURT[id], f=tradeVotes(id);
  if(!fpCan()){ toast('Соглашения подписывает кабинет или президент'); return; }
  if(st.trade){
    sheetOpen({eye:'Торговля · '+x.name,title:'Выйти из соглашения?',
      body:`<p class="lead">Рынок с «${x.name}» открыт. Выход вернёт ${G(hurt).name.toLowerCase()} защиту, а соседа — обидит.</p>`,
      opts:[{label:'Выйти',hint:'отношения −12 · '+G(hurt).name.toLowerCase()+' +3 · бизнес −3',fn(){
          st.trade=false; st.rel=clamp(st.rel-12,0,100); shiftMood(hurt,3); shiftMood('biz',-3);
          logMsg('Новария вышла из торгового соглашения с «'+x.name+'».',1); chron('Выход из торгового соглашения с «'+x.name+'».','b'); render(); }},
        {label:'Остаться',hint:''}]});
    return;
  }
  if(st.rel<45||sancOn(id)){ toast(sancOn(id)?'Под санкциями о торговле не говорят':'С таким отношением соглашение не подпишут'); return; }
  sheetOpen({eye:'Торговля · '+x.name,title:'Соглашение о свободной торговле',
    body:`<p class="lead">Пошлины обнуляются: заводы получают рынок, покупатели — дешёвые товары,
        а ${G(hurt).name.toLowerCase()} — конкурентов. Ратифицирует Сенат, и сенаторы голосуют за свои края.</p>
      <div class="res"><span>Прогноз Сената</span><b class="${f.yes>=f.need?'good':'bad'}">${f.yes} из ${f.need}</b>
        <span>Выигрывают</span><b class="good">предприниматели, приграничные края</b>
        <span>Проигрывают</span><b class="bad">${G(hurt).name.toLowerCase()}</b>
        <span>Внешний спрос</span><b class="good">+${r1(x.trade*6)}</b></div>
      <p class="hint">Провал ратификации стоит веса. Поработайте с Сенатом заранее — лидеры сенаторских фракций договариваются.</p>`,
    opts:[{label:'Подписать и внести в Сенат',hint:'ход и '+TRADE_COST+' веса',fn:()=>tradeSign(id)},{label:'Не сейчас',hint:''}]});
}
function tradeSign(id){
  if(!pay({ap:1,cap:TRADE_COST},'Торговое соглашение'))return;
  const x=NB_(id), st=nbOf(id), hurt=TRADE_HURT[id], f=tradeVotes(id), ok=f.yes>=f.need;
  if(!ok){
    addCap(-4);
    logMsg('Сенат не ратифицировал торговое соглашение с «'+x.name+'» ('+f.yes+' из '+f.need+').',1);
    sheetOpen({eye:'Сенат',title:'Соглашение не ратифицировано',
      body:`<p class="lead">${f.yes} голосов из ${f.need}. Сенаторы краёв, где ${G(hurt).name.toLowerCase()} боятся конкуренции, сказали нет.</p>`,
      acts:[{label:'Закрыть'}]});
    render(); return;
  }
  st.trade=true; st.tradeQ=S.q; st.rel=clamp(st.rel+8,0,100); cnt('trade');
  shiftMood(hurt,-4); shiftMood('biz',3); S.econ.invest=r1(S.econ.invest+3); bumpRep('comp',2);
  x.border.forEach(r=>S.rmod[r]=clamp(S.rmod[r]+1,-22,22));
  career('Торговое соглашение с «'+x.name+'».'); chron('Ратифицировано торговое соглашение с «'+x.name+'».','g');
  cover({ax:'world',stance:1,good:'Рынок «'+x.name+'» открыт: заводы получат заказы',bad:'Свободная торговля с «'+x.name+'»: '+G(hurt).name.toLowerCase()+' под ударом',
    flat:'Сенат ратифицировал соглашение с «'+x.name+'»'});
  logMsg('Торговое соглашение с «'+x.name+'» ратифицировано ('+f.yes+' из '+f.need+').',1);
  render();
}

/* ─── санкции ───────────────────────────────────────────────────── */
function askSanction(id){
  const x=NB_(id), st=nbOf(id);
  if(!fpCan()){ toast('Санкции вводит кабинет или президент'); return; }
  if(ourSanc(id)){
    sheetOpen({eye:'Санкции · '+x.name,title:'Снять санкции?',body:`<p class="lead">Наши санкции против «${x.name}» действуют до ${dateLabel(st.our)}.</p>`,
      opts:[{label:'Снять',hint:'отношения +8 · бизнес +2',fn(){ st.our=0; st.rel=clamp(st.rel+8,0,100); shiftMood('biz',2);
          logMsg('Санкции против «'+x.name+'» сняты.',1); render(); }},{label:'Оставить',hint:''}]});
    return;
  }
  sheetOpen({eye:'Санкции · '+x.name,title:'Ввести санкции',
    body:`<p class="lead">Пошлины, запрет на поставки, заморозка счетов. Патриоты одобрят, бизнес посчитает убытки,
        а «${x.name}» ответит.</p>
      <div class="res"><span>Отношения</span><b>${Math.round(st.rel)} → ${Math.round(Math.max(0,st.rel-20))}</b>
        <span>Внешний спрос</span><b class="bad">−${r1(x.trade*4)}</b>
        <span>Если идёт кризис на границе</span><b class="w">сосед уступит быстрее</b></div>`,
    opts:[{label:'Ввести на два года',hint:'ход и '+SANC_COST+' веса · патриоты +3 · бизнес −3',fn(){
        if(!pay({ap:1,cap:SANC_COST},'Санкции'))return;
        st.our=S.q+8; st.rel=clamp(st.rel-20,0,100); shiftMood('patr',3); shiftMood('biz',-3); bumpRep('firm',2);
        const c=crisisWith(id); if(c)c.left=Math.max(1,c.left-1);
        chron('Санкции против «'+x.name+'».','b'); logMsg('Новария ввела санкции против «'+x.name+'».',1); render(); }},
      {label:'Не сейчас',hint:''}]});
}
function sancImpose(id,why){
  const x=NB_(id), st=nbOf(id);
  st.sanc={q:S.q,until:S.q+8,why,soft:false};
  logMsg('«'+x.name+'» ввела санкции против Новарии: '+why+'.',1);
  chron('Санкции «'+x.name+'» против Новарии.','b');
  cover({ax:'world',stance:-1,good:'Санкции «'+x.name+'»: выстоим и станем сильнее',bad:'Санкции «'+x.name+'»: заказы уходят, цены растут',
    flat:'«'+x.name+'» ввела санкции'});
  shiftMood('biz',-3);
  if(!fpCan())return;
  sheetOpen({eye:'Внешняя политика · '+dateLabel(),title:'Санкции против нас',
    body:`<p class="lead">«${x.name}» ввела санкции: ${why}. Внешний спрос проседает, инвесторы ждут.</p>
      <div class="res"><span>Отношения</span><b class="bad">${Math.round(st.rel)} · ${nbWord(st.rel)}</b>
        <span>Внешний спрос</span><b class="bad">−${r1(x.power*7)}</b>
        <span>Срок</span><b>до ${dateLabel(st.sanc.until)} или пока отношения не выше 45</b></div>`,
    opts:[{label:'Ответить зеркально',hint:'наши санкции · патриоты +3 · бизнес −2',fn(){
        st.our=S.q+8; st.rel=clamp(st.rel-10,0,100); shiftMood('patr',3); shiftMood('biz',-2); bumpRep('firm',2); render(); }},
      {label:'Уступить',hint:'8 веса · санкции сняты · отношения +15 · патриоты −2',fn(){
        if(!payCap(8))return; st.sanc=null; st.rel=clamp(st.rel+15,0,100); shiftMood('patr',-2); bumpRep('firm',-3);
        logMsg('Новария пошла на уступки: «'+x.name+'» сняла санкции.',1); render(); }},
      {label:'Искать обход через третьих',hint:'10 млрд · удар вдвое слабее · след +3',fn(){
        if(S.treasury<10){ toast('В казне нет 10 млрд'); return; }
        S.treasury=r1(S.treasury-10); st.sanc.soft=true; addTrail(3,'обход санкций'); render(); }},
      {label:'Терпеть',hint:''}]});
}

/* ─── кризис на границе ─────────────────────────────────────────── */
function bcrisisStart(id){
  const x=NB_(id), rid=pick(x.border);
  S.bcrisis={nb:id,rid,stage:1,q:S.q,left:CRISIS_LEN};
  S.unrest[rid]=clamp(S.unrest[rid]+6,0,100);
  logMsg('Инцидент на границе с «'+x.name+'» у '+R(rid).cap+'.',1);
  chron('Пограничный инцидент с «'+x.name+'».','b');
  cover({ax:'world',stance:-1,good:'Граница у '+R(rid).cap+': мы не отступим',bad:'Инцидент у '+R(rid).cap+': кто довёл до этого',
    flat:'Инцидент на границе с «'+x.name+'»'});
  if(fpCan())askCrisis();
}
function mediator(id){ return NEIGHBOURS.filter(y=>y.id!==id&&nbOf(y.id)&&nbOf(y.id).rel>=55).sort((a,b)=>nbOf(b.id).rel-nbOf(a.id).rel)[0]||null; }
function askCrisis(){
  const c=S.bcrisis; if(!c)return;
  const x=NB_(c.nb), st=nbOf(c.nb), med=mediator(c.nb);
  const dip=clamp(0.55+(st.treaty?0.15:0)+(hasTrait('diplo')?0.12:0)+(st.rel-25)*0.006,0.2,0.9);
  const force=clamp(0.25+S.spend.def*0.12-(x.power-1)*0.15,0.1,0.85);
  const opts=[{label:'Дипломатия',hint:'ход и 6 веса · шанс '+Math.round(dip*100)+'%',fn(){
      if(!pay({ap:1,cap:6},'Переговоры о границе'))return;
      if(Math.random()<dip){ cnt('peace'); return bcrisisEnd('Переговоры сняли напряжение на границе.',5); }
      logMsg('Переговоры с «'+x.name+'» ничего не дали.',1); render(); }},
    {label:'Показать силу',hint:'ход и 4 веса · шанс '+Math.round(force*100)+'% · иначе эскалация',fn(){
      if(!pay({ap:1,cap:4},'Демонстрация силы'))return;
      shiftMood('patr',2); shiftMood('intel',-1);
      if(Math.random()<force){ bumpRep('firm',3); return bcrisisEnd('«'+x.name+'» отвела войска от границы.',-6); }
      c.stage=2; c.left=CRISIS_LEN; S.unrest[c.rid]=clamp(S.unrest[c.rid]+8,0,100); st.rel=clamp(st.rel-6,0,100);
      if(x.power>=0.9&&!sancOn(x.id)&&Math.random()<0.4)sancImpose(x.id,'за эскалацию на границе');
      logMsg('Эскалация на границе с «'+x.name+'»: стороны стягивают силы.',1); chron('Кризис на границе с «'+x.name+'» обострился.','b');
      render(); }}];
  if(med)opts.push({label:'Посредничество «'+med.name+'»',hint:'5 веса · шанс 75% · посредник теплеет',fn(){
    if(!payCap(5))return; nbOf(med.id).rel=clamp(nbOf(med.id).rel+4,0,100);
    if(Math.random()<0.75){ cnt('peace'); return bcrisisEnd('При посредничестве «'+med.name+'» стороны договорились.',3); }
    logMsg('Посредничество «'+med.name+'» не помогло.',1); render(); }});
  opts.push({label:'Уступить',hint:'8 веса · кризис снят · легитимность −2 · патриоты −4',fn(){
    if(!payCap(8))return; bumpLegit(-2); shiftMood('patr',-4); bumpRep('firm',-3); bcrisisEnd('Новария уступила в споре о границе.',8); }});
  opts.push({label:'Промолчать',hint:'кризис идёт своим ходом',fn(){ bumpRep('firm',-1); }});
  sheetOpen({eye:'Граница · '+x.name,title:c.stage===2?'Кризис на границе':'Пограничный инцидент',
    body:`<p class="lead">${c.stage===2?'Стороны стянули силы к границе у '+R(c.rid).cap+'. Любая ошибка станет войной.'
        :'У '+R(c.rid).cap+' задержаны пограничники, стороны обвиняют друг друга.'}</p>
      <div class="res"><span>Сосед</span><b class="w">${x.name} · вес ${x.power}</b>
        <span>Отношения</span><b class="bad">${Math.round(st.rel)} · ${nbWord(st.rel)}</b>
        <span>Край</span><b>${R(c.rid).name} · напряжённость ${Math.round(S.unrest[c.rid])}</b>
        <span>Оборона</span><b>${['нет','урезано','норма','щедро','максимум'][S.spend.def]}</b>
        <span>Внешний спрос</span><b class="bad">−${r1(x.power*3*c.stage)}</b></div>`,opts});
}
function bcrisisEnd(msg,rel){
  const c=S.bcrisis; if(!c)return;
  const st=nbOf(c.nb); if(st)st.rel=clamp(st.rel+(rel||0),0,100);
  S.bcrisis=null; S.bcrisisCool=S.q+4;
  logMsg(msg,1); chron(msg,'');
  render();
}
function bcrisisTick(){
  const c=S.bcrisis;
  if(c){
    c.left--;
    if(c.stage===2)S.unrest[c.rid]=clamp(S.unrest[c.rid]+2,0,100);
    if(c.left<=0){
      if(!fpCan()&&Math.random()<0.5)return bcrisisEnd('Кабинет '+P(S.gov.lead).leader+' договорился с «'+NB_(c.nb).name+'» о границе.',4);
      return bcrisisEnd(c.stage===2?'Перемирие на границе с «'+NB_(c.nb).name+'»: войска отведены, осадок остался.':'Инцидент на границе с «'+NB_(c.nb).name+'» исчерпан.',c.stage===2?-4:2);
    }
    if(fpCan()&&c.stage===2&&c.left===CRISIS_LEN-1)askCrisis();
    return;
  }
  if(S.bcrisisCool>S.q)return;
  // граница горит у холодных соседей, но и у тёплых бывает инцидент
  NEIGHBOURS.filter(x=>nbOf(x.id)&&x.power>=0.6).forEach(x=>{ if(S.bcrisis)return; const rel=nbOf(x.id).rel;
    if(Math.random()<(rel<40?0.03+(40-rel)*0.006:0.004*x.power))bcrisisStart(x.id); });
}

/* ─── визит: повестка и край-получатель ─────────────────────────── */
function nbVisit(id){
  const x=NB_(id), st=nbOf(id);
  const agendas=[{label:'Торговля и контракты',hint:VISIT_COST+' млрд · отношения +6…10 · инвестиции · контракт краю',fn(){ visitGo(id,'trade'); }},
    {label:'Граница и соотечественники',hint:VISIT_COST+' млрд · приграничные края спокойнее · патриоты +1',fn(){ visitGo(id,'border'); }}];
  if(id==='zarech'||id==='meridia')agendas.push({label:'Энергетика и транзит',hint:VISIT_COST+' млрд · контракт в казну · интеллигенция ворчит',fn(){ visitGo(id,'energy'); }});
  agendas.push({label:'Отменить поездку',hint:''});
  sheetOpen({eye:'Визит · '+x.name,title:'С чем едем',
    body:`<p class="lead">Визит — это повестка. От неё зависит, какой край получит выгоду и кто дома будет недоволен.</p>
      <div class="res"><span>Отношения</span><b>${Math.round(st.rel)} · ${nbWord(st.rel)}</b>
        <span>Граничит с</span><b class="w">${x.border.map(r=>R(r).cap).join(', ')}</b>
        ${st.rel<30?'<span>Риск</span><b class="bad">протесты могут сорвать визит</b>':''}</div>`,
    opts:agendas});
}
function visitGo(id,agenda){
  const x=NB_(id), st=nbOf(id), dip=hasTrait('diplo')?5:0;
  if(!pay({ap:1,gold:VISIT_COST},'Визит к соседям'))return;
  if(st.rel<30&&Math.random()<0.4){
    st.rel=clamp(st.rel-3,0,100); bumpRep('firm',-1);
    logMsg('Визит в «'+x.name+'» сорван протестами у посольства.',1); head(pick(PRESS),'Визит в «'+x.name+'» сорван','hb');
    render(); return;
  }
  const rid=pick(x.border);
  let txt='';
  if(agenda==='trade'){ st.rel=clamp(st.rel+ri(6,10)+dip,0,100); S.econ.invest=r1(S.econ.invest+2); shiftMood('biz',2);
    S.rmod[rid]=clamp(S.rmod[rid]+2,-22,22); txt='Подписаны контракты для края '+R(rid).name+'.'; }
  if(agenda==='border'){ st.rel=clamp(st.rel+ri(4,8)+dip,0,100); shiftMood('patr',1);
    x.border.forEach(r=>{ S.unrest[r]=clamp(S.unrest[r]-ri(3,6),0,100); S.rmod[r]=clamp(S.rmod[r]+1.5,-22,22); });
    if(typeof S.sep==='object')x.border.forEach(r=>S.sep[r]=clamp((S.sep[r]||0)-3,0,100));
    txt='Приграничные края спокойнее: '+x.border.map(r=>R(r).cap).join(', ')+'.'; }
  if(agenda==='energy'){ st.rel=clamp(st.rel+ri(5,8)+dip,0,100); const v=ri(6,11); S.treasury=r1(S.treasury+v); shiftMood('intel',-1);
    txt='Энергетический контракт: '+v+' млрд в казну.'; }
  bumpRep('comp',0.8);
  head(pick(PRESS),'Переговоры с «'+x.name+'»: '+txt.toLowerCase(),'');
  logMsg('Визит в «'+x.name+'»: '+txt);
  toast('Визит состоялся');
  render();
}

/* ─── лист соседа ───────────────────────────────────────────────── */
function askNeighbour(id){
  const x=NB_(id), st=nbOf(id), can=fpCan(), c=crisisWith(id);
  const opts=[{label:'Визит',hint:VISIT_COST+' млрд · выбрать повестку',fn:()=>nbVisit(id)}];
  if(c&&can)opts.push({label:'Кризис на границе',hint:'решить',fn:()=>askCrisis()});
  opts.push({label:'Договор о дружбе',hint:st.treaty?'уже есть':TREATY_COST+' веса · нужна ратификация Сенатом',fn:()=>nbTreaty(id)});
  opts.push({label:st.trade?'Торговое соглашение: выйти':'Торговое соглашение',hint:can?(st.trade?'рынок открыт':'Сенат голосует краями'):'только кабинет или президент',fn:()=>askTrade(id)});
  opts.push({label:ourSanc(id)?'Снять наши санкции':'Ввести санкции',hint:can?'':'только кабинет или президент',fn:()=>askSanction(id)});
  opts.push({label:'Ничего',hint:'сохранить квартал',fn(){}});
  sheetOpen({eye:'Внешняя политика · '+x.name,title:nbWord(st.rel),
    body:`<p class="lead">${x.note}</p>
      <div class="res"><span>Отношения</span><b class="${st.rel<38?'bad':st.rel>=54?'good':''}">${Math.round(st.rel)} · ${nbWord(st.rel)}</b>
        <span>Вес соседа</span><b>${x.power}</b>
        <span>Торговля</span><b>${x.trade}${st.trade?' · соглашение':''}</b>
        <span>Договор о дружбе</span><b class="w">${st.treaty?'есть':'нет'}</b>
        ${sancOn(id)?`<span>Их санкции</span><b class="bad">до ${dateLabel(st.sanc.until)}${st.sanc.soft?' · обходим':''}</b>`:''}
        ${ourSanc(id)?`<span>Наши санкции</span><b class="warn">до ${dateLabel(st.our)}</b>`:''}
        ${c?`<span>Граница</span><b class="bad">${c.stage===2?'кризис':'инцидент'} у ${R(c.rid).cap}</b>`:''}
        <span>Граничит с</span><b class="w">${x.border.map(r=>R(r).cap).join(', ')}</b></div>
      <p class="hint">Вражда греет приграничные края: сейчас они получают
        ${x.border.map(r=>'+'+r1(nbPressure(r))).join(', ')} к напряжённости.</p>`,
    opts});
}

/* ─── квартал: санкции против нас и кризисы ─────────────────────── */
function fpTick(){
  if(!S.nb)return;
  NEIGHBOURS.forEach(x=>{
    const st=nbOf(x.id); if(!st)return;
    if(st.sanc&&(st.sanc.until<=S.q||st.rel>=45)){ st.sanc=null; logMsg('«'+x.name+'» сняла санкции.',1); }
    if(st.our&&st.our<=S.q)st.our=0;
    if(sancOn(x.id))S.econ.invest=r1(S.econ.invest-0.5*x.power);
    if(st.trade)S.econ.invest=r1(S.econ.invest+0.2*x.trade);
    if(sancOn(x.id))return;
    let ch=st.rel<32?0.05*x.power+(32-st.rel)*0.006:0;
    if(x.id==='ostmark'&&legit()<60)ch+=0.08;                      // западный сосед смотрит на свободы
    if(ourSanc(x.id))ch+=0.15;                                      // ответ на наши санкции
    if(ch>0&&Math.random()<ch)sancImpose(x.id,ourSanc(x.id)?'ответ на наши санкции':x.id==='ostmark'&&legit()<60?'за нарушение правил и свобод':'в ответ на враждебный курс');
  });
  regimeTick();
  bcrisisTick();
}
/* у соседей тоже бывают выборы и перевороты: курс меняется, отношения за ним */
function regimeTick(){
  NEIGHBOURS.forEach(x=>{
    const st=nbOf(x.id); if(!st||Math.random()>0.015)return;
    const o=st.st||x.st, n={...o};
    ['world','free','order'].forEach(a=>n[a]=clamp(r1((o[a]||0)+rnd(-1.1,1.1)),-2,2));
    st.st=n;
    const warmer=axDist(n,me().st)<axDist(o,me().st);
    logMsg('В «'+x.name+'» сменилась власть: новый курс '+(warmer?'ближе к нашему':'дальше от нашего')+'.',1);
    chron('Смена власти в «'+x.name+'».','');
    head(pick(PRESS),'«'+x.name+'»: новая власть — '+(warmer?'шанс на оттепель':'время холодов'),warmer?'hg':'hb');
  });
}
