
/* ════════════════════════════════════════════════════════════════
   ДЕЛО
   Скандал или след от сделок доходит до прокуратуры, и дальше это
   уже не заголовок, а процесс: проверка, обыски, обвинение, суд.
   На каждой ступени есть развилка — давить на следствие, нанять
   адвокатов, сдать фигуранта, кричать о преследовании. Давление
   помогает, но платится легитимностью: правила одни для всех,
   пока власть не решит иначе.
   ════════════════════════════════════════════════════════════════ */
const CASE_ST=[
  {id:'check', name:'Проверка', txt:'доследственная проверка: запросы, объяснения, выемка бумаг'},
  {id:'search',name:'Обыски',   txt:'дело возбуждено: обыски в кабинетах и штабе, допросы'},
  {id:'charge',name:'Обвинение',txt:'следствие собирает обвинительное заключение'},
  {id:'court', name:'Суд',      txt:'дело в суде: прения, свидетели, приговор'},
];
const CASE_PASS={check:28,search:42};           // сколько улик нужно, чтобы дело пошло дальше
const CONVICT_LEN=8;                            // кварталов запрета на должности после приговора
function convicted(){ return !!(S.you&&S.you.convicted!=null&&S.q<S.you.convicted+CONVICT_LEN); }
function caseSt(pr){ return CASE_ST.find(x=>x.id===pr.stage)||CASE_ST[0]; }
function caseIdx(pr){ return Math.max(0,CASE_ST.indexOf(caseSt(pr))); }
function caseWord(ev){ return ev>=70?'железные':ev>=50?'весомые':ev>=30?'спорные':'слабые'; }
function caseWho(pr){ return pr.you?'вы лично':pr.k+' '+pr.name; }
const CASE_ACC={'министр':'министра','глава края':'главу края','помощник':'помощника','политик':'политика'};
function caseWhom(pr){ return pr.you?'вас лично':(CASE_ACC[pr.k]||pr.k)+' — '+pr.name; }

/* ─── открыть дело ──────────────────────────────────────────────── */
function caseOpen(t,src,ev0){
  S.probe={...t,q:S.q,stage:'check',left:1,ev:Math.round(clamp(ev0,5,95)),src,used:{},rally:false,buried:false};
  const pr=S.probe;
  logMsg('Прокуратура начала проверку: '+caseWho(pr)+'.',1);
  cover({good:'Проверка в окружении власти: следствию не мешают',
    bad:'Прокуратура пришла к своим: '+(pr.you?'проверяют '+S.you.name:pr.k+' под проверкой'),
    flat:'Начата проверка: '+(pr.you?S.you.name:pr.k+' '+pr.name)});
  caseSheet('Начата проверка',`Прокуратура взялась за ${caseWhom(pr)}${
    src==='scandal'?': поводом стал скандал в печати':''}. Дело идёт ступенями — на каждой можно
    повлиять, и у каждого влияния своя цена.`);
}
function probeTick(){
  if(S.probe){ caseStep(); return; }
  const hot=scMine().filter(x=>x.heat>=50&&x.evid>=55)[0];
  const fromSc=hot&&Math.random()<0.3*prosFree();
  if(!fromSc&&Math.random()>probeRisk())return;
  const targets=[];
  if(isPM())POSTS.forEach(x=>targets.push({k:'министр',name:minOf(x.id).name,post:x.id}));
  REGIONS.forEach(r=>{const g=govOf(r.id); if(g&&(g.party===PL||inCoal(g.party)))
    targets.push({k:'глава края',name:g.name,region:r.id});});
  targets.push({k:'помощник',name:depName(),aide:true});
  let t=pick(targets);
  // личная история или большой след — идут к вам самим (не к президенту: его защищает импичмент)
  const personal=fromSc?(hot.kind==='life'||hot.kind==='firm'):trail()>70&&Math.random()<0.3;
  if(personal&&!isPres())t={k:'политик',name:S.you.name,you:true};
  const ev0=fromSc?hot.evid*0.6+ri(6,14):trail()*0.5+ri(10,24);
  caseOpen(t,fromSc?'scandal':'trail',ev0);
}

/* ─── ступень за ступенью ──────────────────────────────────────── */
function caseStep(){
  const pr=S.probe; if(!pr)return;
  pr.left--; if(pr.left>0)return;
  if(pr.stage==='check'){
    if(pr.ev<CASE_PASS.check)return caseClose('Проверка окончена: нарушений не нашли.',true);
    pr.stage='search'; pr.left=1; pr.ev=Math.round(clamp(pr.ev+ri(6,20)*prosFree(),0,100));
    shiftAll(pr.you?-2:-1); addTrail(2,'обыски');
    logMsg('Возбуждено дело, прошли обыски: '+caseWho(pr)+'.',1);
    chron('Обыски по делу: '+caseWho(pr)+'.','b');
    cover({good:'Обыски у своих: власть не прикрывает никого',bad:'Обыски в окружении '+S.you.name+': что нашли следователи',
      flat:'Следователи провели обыски по делу '+(pr.you?S.you.name:pr.name)});
    return caseSheet('Обыски',`Дело возбуждено. Следователи вынесли коробки бумаг${pr.you?' из вашего кабинета':''}.
      Улики теперь ${caseWord(pr.ev)}.`);
  }
  if(pr.stage==='search'){
    if(pr.ev<CASE_PASS.search)return caseClose('Дело прекращено за недостатком улик.',true);
    pr.stage='charge'; pr.left=1;
    logMsg('Следствие готовит обвинение: '+caseWho(pr)+'.',1);
    return caseSheet('Обвинение',`Следствие собрало достаточно, чтобы предъявить обвинение. Осталось заключение — и суд.`);
  }
  if(pr.stage==='charge'){
    if(pr.you&&regOn('immunity')&&(hasMandate()||inSenate())&&!pr.lifted)return caseImmunity();
    pr.stage='court'; pr.left=1;
    logMsg('Дело передано в суд: '+caseWho(pr)+'.',1);
    chron('Дело в суде: '+caseWho(pr)+'.','b');
    return caseSheet('Суд',`Обвинительное заключение в суде. ${courtFree()>0?'Суд независим — решат улики.':
      courtFree()<0?'Суд зависим — решит, чьи судьи.':'Суд смотрит на улики, но слышит и власть.'}`);
  }
  if(pr.stage==='court')return caseVerdict();
}
/* вероятность обвинительного приговора */
function caseGuilty(pr){
  let g=(pr.ev-30)/60;
  if(courtFree()<=0)g-=courtSeats(PL)/courtN()*0.3*(courtFree()<0?1.4:1);   // свои судьи в зависимом суде
  if(pr.courtPush)g+=pr.courtPush;
  return clamp(g,0.05,0.92);
}
function caseVerdict(){
  const pr=S.probe; if(!pr)return;
  if(Math.random()>=caseGuilty(pr)){
    S.probe=null; addTrail(-10); bumpRep('honest',4); shiftAll(1); if(pr.you)cnt('acquit');
    logMsg('Суд оправдал: '+caseWho(pr)+'.',1); chron('Оправдательный приговор: '+caseWho(pr)+'.','g');
    cover({good:'Суд оправдал: обвинение развалилось',bad:'Оправдание, которое никого не убедило',flat:'Суд вынес оправдательный приговор'});
    sheetOpen({eye:'Суд · '+dateLabel(),title:'Оправдан',
      body:`<p class="lead">${pr.you?'Вас оправдали.':pr.k[0].toUpperCase()+pr.k.slice(1)+' '+pr.name+' оправдан.'} Следствие не убедило суд.</p>
        <span class="stamp y">оправдан</span>`,acts:[{label:'Дальше'}]});
    render(); return;
  }
  const soft=pr.rally?0.5:1;
  addTrail(-16);
  if(pr.you){
    bumpRep('honest',-18); addCap(-18); shiftAll(-5*soft);
    career('Осуждены по делу о '+(pr.src==='scandal'?'скандале':'коррупции')+'.');
    chron('Суд признал '+S.you.name+' виновным.','b');
    cover({good:'Приговор политику: закон один для всех',bad:'Осуждён: '+S.you.name,flat:'Суд вынес обвинительный приговор '+S.you.name});
    const opts=[];
    if(!pr.appeal)opts.push({label:'Подать апелляцию',hint:'20 млн · квартал · решит вышестоящий суд',fn:()=>caseAppeal()});
    opts.push({label:'Принять приговор',hint:'кресло и мандат теряются, партия остаётся',fn:()=>caseConvictYou()});
    sheetOpen({eye:'Суд · '+dateLabel(),title:'Виновен',
      body:`<p class="lead">Суд признал вас виновным${pr.rally?'. Ваши сторонники считают это расправой — рейтинг просел меньше':''}.
        Условный срок и запрет занимать должности, пока приговор в силе.</p><span class="stamp n">виновен</span>`,opts});
    return;
  }
  S.probe=null;
  bumpRep('honest',-9*soft); bumpRep('comp',-3); shiftAll(-3*soft); addCap(-8);
  if(pr.post&&isPM()){ S.ministers[pr.post]=makeMinister(pr.post,minOf(pr.post).party); logMsg('Министр отправлен в отставку по приговору.',1); }
  if(pr.region){ const g=govOf(pr.region); if(g)g.rel=clamp(g.rel-22,0,100); }
  career('Скандал: '+pr.k+' '+pr.name+' осуждён.');
  chron('Приговор: '+pr.k+' '+pr.name+'.','b');
  cover({good:'Власть сама вычистила своих: виновный осуждён',bad:'Осуждён '+pr.k+' '+pr.name+': кто следующий',
    flat:'Суд вынес приговор: '+pr.k+' '+pr.name});
  const opts=[{label:'Принять',hint:''}];
  if(isPres())opts.unshift({label:'Помиловать',hint:'8 веса · легитимность −4 · честность −4',fn(){
    if(!payCap(8))return; bumpLegit(-4); bumpRep('honest',-4); addTrail(4,'помилование');
    logMsg('Вы помиловали осуждённого: '+pr.name+'.',1); chron('Президент помиловал '+pr.name+'.','b');
    cover({good:'Милосердие президента',bad:'Помиловал своего: '+pr.name+' на свободе',flat:'Президент подписал помилование'}); render(); }});
  sheetOpen({eye:'Суд · '+dateLabel(),title:'Виновен',
    body:`<p class="lead">${pr.k[0].toUpperCase()+pr.k.slice(1)} ${pr.name} осуждён. Приговор бьёт по вам: это ваши люди.</p>
      <span class="stamp n">виновен</span>`,opts});
  render();
}
function caseAppeal(){
  const pr=S.probe; if(!pr)return;
  if(!payFunds(20)){ caseConvictYou(); return; }
  pr.appeal=true; pr.stage='court'; pr.left=1; pr.ev=Math.round(pr.ev*0.85);
  logMsg('Апелляция подана: приговор не вступил в силу.',1);
  render();
}
function caseConvictYou(){
  S.probe=null;
  const was=mySeat();
  if(was!=='dep'&&was!=='none'&&was!=='lead')stepDown('Приговор суда.');
  if(mySeat()!=='none')setSeat('none','Мандат прекращён приговором.');
  S.you.convicted=S.q;
  logMsg('Приговор вступил в силу: вы остаётесь в партии, но без кресла.',1);
  render();
}
function caseClose(msg,clean){
  const pr=S.probe; S.probe=null;
  if(clean){ addTrail(-8); bumpRep('honest',3); }
  logMsg(msg+(pr?' ('+caseWho(pr)+')':''),1);
  cover({good:'Проверка ничего не нашла: обвинения не подтвердились',bad:'Дело закрыто без выводов — вопросы остались',flat:'Дело прекращено'});
  render();
}

/* ─── неприкосновенность: палата решает, отдать ли вас суду ──────── */
function caseImmunityVotes(){
  const sen=inSenate();
  const list=sen?S.senate.filter(s=>!s.you):S.deputies;
  let yes=0;
  list.forEach(d=>{ const ally=d.party===PL||(inCoal(d.party)&&inCoal(PL));
    const v=(ally?-18:12)+(50-(d.rel||50))*0.5+(S.probe.ev-50)*0.35+noise(d.id+'imm'+S.q,10);
    if(v>0)yes++; });
  return {yes,need:sen?SEN_MAJ:MAJ,sen};
}
function caseImmunity(){
  const pr=S.probe, v=caseImmunityVotes();
  const lift=v.yes>=v.need;
  if(lift){
    pr.lifted=true; pr.stage='court'; pr.left=1;
    logMsg((v.sen?'Сенат':'Собрание')+' сняло с вас неприкосновенность: '+v.yes+' голосов. Дело уходит в суд.',1);
    chron('С '+S.you.name+' снята неприкосновенность.','b');
    return caseSheet('Неприкосновенность снята',`${v.sen?'Сенат':'Собрание'} отдало вас суду: ${v.yes} голосов при ${v.need} нужных.`);
  }
  S.probe=null; bumpRep('honest',-6); bumpLegit(-2); addTrail(6,'неприкосновенность');
  logMsg((v.sen?'Сенат':'Собрание')+' не сняло с вас неприкосновенность ('+v.yes+' из '+v.need+'). Дело заморожено.',1);
  chron('Палата защитила '+S.you.name+' неприкосновенностью.','');
  cover({good:'Палата не дала расправиться с политиком',bad:'Спрятался за мандатом: дело заморожено',flat:'Неприкосновенность сохранена'});
  sheetOpen({eye:'Палата · '+dateLabel(),title:'Неприкосновенность сохранена',
    body:`<p class="lead">Голосов за снятие ${v.yes} из ${v.need}. Дело заморожено, пока у вас мандат — но печать запомнит,
      за чем вы спрятались.</p>`,acts:[{label:'Дальше'}]});
  render();
}

/* ─── развилки ───────────────────────────────────────────────────
   Каждое влияние — раз на ступень. */
function caseActs(pr){
  const st=pr.stage, u=k=>pr.used[st+':'+k], out=[];
  const free=prosFree();
  if(st==='check'||st==='search')out.push({id:'bury',label:'Свернуть дело',hint:free>0.8?'независимую прокуратуру не остановить':
      BURY_COST+' веса · след вдвое больше · легитимность −2',ok:free<=0.8&&S.cap>=BURY_COST&&S.ap>0});
  if(st!=='court')out.push({id:'press',label:'Давить на следствие',hint:'ход и 10 веса · улики −18 · легитимность −4'+(free>0.7?' · риск утечки':''),
    ok:!u('press')&&S.ap>0&&S.cap>=10});
  if(st==='charge'||st==='court')out.push({id:'law',label:'Нанять адвокатов',hint:'20 млн · улики −10',ok:!u('law')&&S.funds>=20});
  if(!pr.you&&st!=='court')out.push({id:'drop',label:'Сдать фигуранта',hint:'дело закончится приговором ему · удар вдвое меньше · фракция ропщет',
    ok:S.cap>=4});
  out.push({id:'coop',label:pr.you?'Сотрудничать со следствием':'Открыть архивы следствию',hint:'улики +8 · честность +4 · смягчит приговор',ok:!u('coop')});
  if(!pr.rally)out.push({id:'rally',label:'Заявить о преследовании',hint:'ход и 4 веса · сторонники сплачиваются · легитимность −1',ok:S.ap>0&&S.cap>=4});
  if(isPres()&&st!=='court')out.push({id:'fire',label:'Сменить генпрокурора',hint:'ход и 20 веса · улики −30 · легитимность −8 · скандал',
    ok:!u('fire')&&S.ap>0&&S.cap>=20&&!(S.prosHit>S.q)});
  if(st==='court')out.push({id:'judge',label:'Давить на суд',hint:courtFree()>0?'независимый суд может ответить':'ход и 12 веса · легитимность −5',
    ok:!u('judge')&&S.ap>0&&S.cap>=12});
  return out;
}
function caseDo(id){
  const pr=S.probe; if(!pr)return;
  const a=caseActs(pr).find(x=>x.id===id); if(!a||!a.ok){ toast(a?a.hint:'Сейчас нельзя'); return; }
  const key=pr.stage+':'+id; pr.used[key]=true;
  if(id==='bury'){ buryProbe(); return; }
  if(id==='press'){
    if(!pay({ap:1,cap:10},'Давление на следствие'))return;
    bumpLegit(-4); bumpRep('honest',-3); bumpRep('firm',2);
    if(prosFree()>0.7&&Math.random()<0.5){
      pr.ev=Math.round(clamp(pr.ev+10,0,100));
      logMsg('Звонок следователю стал известен: давление на следствие обернулось против вас.',1);
      scOpenYou('trail',ri(40,58),70);
    } else { pr.ev=Math.round(clamp(pr.ev-18,0,100)); logMsg('Следствие притормозило: улики «потерялись».',1); }
  }
  if(id==='law'){ if(!payFunds(20))return; pr.ev=Math.round(clamp(pr.ev-10,0,100)); logMsg('Адвокаты разбили часть обвинения.',1); }
  if(id==='coop'){ pr.ev=Math.round(clamp(pr.ev+8,0,100)); pr.coop=true; bumpRep('honest',4); pr.rally=false;
    logMsg('Вы открыли архивы следствию.',1); }
  if(id==='rally'){ if(!pay({ap:1,cap:4},'Заявление о преследовании'))return;
    pr.rally=true; bumpLegit(-1); pressAll(-1);
    GROUPS.slice().sort((a,b)=>fitOf(b,me().st)-fitOf(a,me().st)).forEach((g,i)=>shiftMood(g.id,i<3?2.5:-0.8));
    S.deputies.filter(d=>d.party===PL).forEach(d=>d.loyal=clamp(d.loyal+3,0,100));
    logMsg('Вы назвали дело политическим преследованием: сторонники сплотились, остальные насторожились.',1); }
  if(id==='drop'){ if(!payCap(4))return;
    S.probe=null; pr.rally=true;                    // удар вдвое меньше
    bumpRep('honest',2); bumpRep('firm',-2); shiftAll(-1.5); addTrail(-10);
    S.deputies.filter(d=>d.party===PL).forEach(d=>d.loyal=clamp(d.loyal-3,0,100));
    if(pr.post&&isPM())S.ministers[pr.post]=makeMinister(pr.post,minOf(pr.post).party);
    if(pr.region){ const g=govOf(pr.region); if(g)g.rel=clamp(g.rel-30,0,100); }
    logMsg('Вы сдали '+pr.name+': фигурант признал вину, дело закрыто приговором ему.',1);
    chron(pr.k[0].toUpperCase()+pr.k.slice(1)+' '+pr.name+' сдан следствию.','');
    render(); return; }
  if(id==='fire'){ if(!pay({ap:1,cap:20},'Смена генпрокурора'))return;
    S.prosHit=S.q+8; bumpLegit(-8); pr.ev=Math.round(clamp(pr.ev-30,0,100));
    const om=nbOf('ostmark'); if(om)om.rel=clamp(om.rel-5,0,100);
    logMsg('Генпрокурор отправлен в отставку посреди дела.',1); chron('Президент сменил генпрокурора посреди дела.','b');
    scOpenYou('trail',ri(50,65),75); }
  if(id==='judge'){ if(!pay({ap:1,cap:12},'Давление на суд'))return;
    bumpLegit(-5); bumpRep('honest',-3);
    if(courtFree()>0&&Math.random()<0.5){ pr.courtPush=0.15; logMsg('Судья рассказал о давлении: суд ответил жёстче.',1);
      cover({good:'Суд устоял перед давлением',bad:'Давление на суд: звонки судье по делу '+(pr.you?S.you.name:pr.name),flat:'Судья заявил о давлении'}); }
    else { pr.courtPush=-0.25; logMsg('Суд «услышал» пожелания власти.',1); } }
  render();
  if(S.probe)askCase();
}
/* лист дела: ступени, улики, развилки */
function caseSheet(title,lead){
  sheetOpen({eye:'Дело · '+dateLabel(),title,body:caseBody(lead),
    opts:caseActs(S.probe).filter(a=>a.ok).map(a=>({label:a.label,hint:a.hint,fn:()=>caseDo(a.id)}))
      .concat([{label:'Ждать',hint:'пусть идёт своим ходом'}])});
  render();
}
function askCase(){ if(!S.probe){ toast('Дела нет'); return; } caseSheet(caseSt(S.probe).name,caseSt(S.probe).txt+'.'); }
function caseBody(lead){
  const pr=S.probe, i=caseIdx(pr);
  return `<p class="lead">${lead}</p>
    <div class="case-steps">${CASE_ST.map((s,k)=>`<span class="${k<i?'done':k===i?'on':''}">${s.name}</span>`).join('')}</div>
    <div class="res"><span>Фигурант</span><b class="w">${caseWho(pr)}</b>
      <span>Улики</span><b class="${pr.ev>=50?'bad':''}">${pr.ev} · ${caseWord(pr.ev)}</b>
      ${pr.stage==='court'?`<span>Шанс приговора</span><b class="${caseGuilty(pr)>0.5?'bad':''}">${Math.round(caseGuilty(pr)*100)}%</b>`
        :`<span>Дальше пойдёт, если улик</span><b>${pr.stage==='charge'?'в суд — уже':'≥ '+CASE_PASS[pr.stage]}</b>`}
      <span>Независимость прокуратуры</span><b>${r1(prosFree())}</b>
      <span>Легитимность</span><b class="${legit()<LEGIT_LOW?'bad':''}">${legit()}</b></div>`;
}
function buryProbe(){
  if(!S.probe){toast('Дела нет');return;}
  if(prosFree()>0.8){toast('Независимую прокуратуру не остановить');return;}
  if(!pay({ap:1,cap:BURY_COST},'Свернуть дело'))return;
  addTrail(ri(14,22),'свёрнутое дело');
  bumpRep('honest',-6); bumpRep('firm',3); bumpLegit(-2);
  S.probe=null;
  logMsg('Дело свёрнуто. Об этом узнают позже.',1);
  cover({good:'Дело закрыто за отсутствием состава',
    bad:'Дело замяли: следствие остановлено сверху',
    flat:'Проверка прекращена'});
  toast('Дело закрыто');
  render();
}

/* ─── дела соперников ──────────────────────────────────────────────
   Горящий скандал у чужой партии тоже может дойти до суда. Власть
   может подтолкнуть такое дело — ценой легитимности. */
function rcases(){ return S.rcases||(S.rcases=[]); }
function rcaseTick(){
  rcases().forEach(c=>{
    if(c.done)return;
    c.left--; if(c.left>0)return;
    const p=P(c.pid); if(!p){ c.done='gone'; return; }
    if(c.stage<3){
      if(c.stage<2&&c.ev<[CASE_PASS.check,CASE_PASS.search][c.stage]){ c.done='closed'; logMsg('Дело против '+c.name+' («'+p.short+'») прекращено.'); return; }
      c.stage++; c.left=1; if(c.stage===1){ c.ev=Math.round(clamp(c.ev+ri(4,16)*prosFree(),0,100)); p.mom=clamp((p.mom||0)-2,-14,14);
        logMsg('Обыски в штабе «'+p.short+'» по делу '+c.name+'.'); }
      return;
    }
    const g=clamp((c.ev-30)/60+(c.push||0),0.05,0.9);
    if(Math.random()<g){
      c.done='guilty'; p.mom=clamp((p.mom||0)-5,-14,14);
      S.deputies.filter(d=>d.party===c.pid).forEach(d=>d.loyal=clamp(d.loyal-4,0,100));
      logMsg('Суд осудил '+c.name+' («'+p.name+'»).',1); chron('Приговор '+c.name+' («'+p.short+'»).','');
      if(p.leader===c.name){ p.leader=(Math.random()<0.4?pick(NAME_F)+' '+pick(SURN_F):pick(NAME_M)+' '+pick(SURN_M));
        logMsg('«'+p.name+'» сменила осуждённого лидера: теперь это '+p.leader+'.',1); flSync(); }
    } else { c.done='free'; p.mom=clamp((p.mom||0)+2,-14,14); logMsg('Суд оправдал '+c.name+' («'+p.short+'»).'); }
  });
  S.rcases=rcases().filter(c=>!c.done||S.q-c.q<12);
}
/* громкий скандал у соперника может дойти до прокуратуры */
function rcaseFromScandal(sc){
  const p=P(sc.who); if(!p||sc.heat<40||rcaseLive().length>=3||Math.random()>0.45*prosFree())return;
  rcases().push({sc:sc.id,pid:p.id,name:Math.random()<0.5?p.leader:depName(),stage:0,left:1,ev:ri(30,70),q:S.q});
  logMsg('Прокуратура начала проверку по скандалу у «'+p.short+'».');
}
function rcaseLive(){ return rcases().filter(c=>!c.done); }
/* подтолкнуть чужое дело: доступно власти */
function rcasePush(i){
  const c=rcaseLive()[i]; if(!c)return;
  if(!(isPM()||isPres())){ toast('Следствие слушает только власть'); return; }
  if(c.pushed){ toast('Это дело уже подталкивали'); return; }
  if(!pay({ap:1,cap:8},'Дело против '+c.name))return;
  c.pushed=true; c.ev=Math.round(clamp(c.ev+15,0,100)); c.push=0.1; bumpLegit(-3);
  logMsg('Следствие по делу '+c.name+' ускорилось.',1);
  if(Math.random()<0.35){ logMsg('Печать заговорила о политическом заказе.',1); scOpenYou('trail',ri(35,52),60); }
  render();
}
/* дела соперников в «Суде и надзоре» */
function rcasePanel(){
  const live=rcaseLive(); if(!live.length)return '';
  const pow=isPM()||isPres();
  return panel({title:'Дела соперников',meta:live.length+' в работе',flush:true,
    body:`<table><tbody>${live.map((c,i)=>{ const p=P(c.pid);
      return `<tr><td>${p?emblem(p,18):''}</td><td><b>${c.name}</b><div class="sub2">«${p?p.short:'—'}» · ${CASE_ST[c.stage].name.toLowerCase()} · улики ${caseWord(c.ev)}</div></td>
        <td class="r">${pow&&!c.pushed?`<button class="btn sm" onclick="rcasePush(${i})" ${S.ap&&S.cap>=8?'':'disabled'}>Подтолкнуть<span class="cost">8</span></button>`
          :c.pushed?'<span class="tag r">подтолкнуто</span>':''}</td></tr>`; }).join('')}</tbody></table>
      ${pow?'<p class="hint" style="padding:8px 14px 12px">Подтолкнуть чужое дело может власть: улики крепче, приговор вероятнее, легитимность −3 и риск, что печать назовёт это заказом.</p>':''}`});
}
