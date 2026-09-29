/* ════════════════════════════════════════════════════════════════
   ПАРЛАМЕНТ: коалиция, кризис правительства, вотум недоверия,
   роспуск, регламент Собрания и импичмент по ступеням.
   Всё это — не кнопки с мгновенным исходом, а процедуры: у каждой
   ступени свой счёт голосов, своя цена и свой срок, и между
   ступенями у игрока есть ходы.
   ════════════════════════════════════════════════════════════════ */
function avgRel(pid){ const l=S.deputies.filter(d=>d.party===pid);
  return l.length?l.reduce((a,d)=>a+d.rel,0)/l.length:50; }
function closeSheet(){ const m=document.getElementById('modal'); if(m)m.classList.remove('show'); mopen=false; mq.length=0; }
const bySeats=(a,b)=>seatsOf(b.id)-seatsOf(a.id);

/* ═══ КОАЛИЦИЯ ════════════════════════════════════════════════════
   Партнёр входит в кабинет не за портфели одни: он приносит в договор
   одно требование — закон по оси, где он дальше всего от премьера.
   Исполненный договор держит коалицию, нарушенный её рвёт. */
function pactFor(pid,leadId){
  const p=P(pid), l=P(leadId||S.gov.lead);
  let ax=AX[0], bd=-1;
  AX.forEach(a=>{ const d=Math.abs((p.st[a]||0)-(l.st[a]||0)); if(d>bd){bd=d;ax=a;} });
  const sign=Math.sign((p.st[ax]||0)-(l.st[ax]||0))||1;
  // тема — та, где действующий закон дальше всего от желания партнёра
  const pool=TOPICS.filter(t=>t.ax===ax&&!t.special);
  pool.sort((a,b)=>{ const la=lawOn(a.id), lb=lawOn(b.id);
    return (la?la.stance*sign:0)-(lb?lb.stance*sign:0); });
  return {ax, sign, topic:(pool[0]||TOPICS[0]).id, due:S.q+PACT_LEN, done:false, broken:0};
}
function pactText(pc){ const t=T(pc.topic); return '«'+t.name+'» в сторону «'+(pc.sign>0?t.r:t.l)+'»'; }
/* закон игрока по оси договора: исполняет его или нарушает */
function pactCheck(law){
  if(!S.pacts||law.by!==PL||law.decree)return;
  const t=T(law.topic); if(!t||!law.stance)return;
  Object.entries(S.pacts).forEach(([pid,pc])=>{
    if(!inCoal(pid)||pc.ax!==t.ax)return;
    const st=S.partners[pid]||(S.partners[pid]={patience:3,anger:0});
    if(Math.sign(law.stance)===pc.sign){
      if(!pc.done){ pc.done=true; st.anger=Math.max(0,st.anger-2.5); addCap(3);
        logMsg('Коалиционный договор с «'+P(pid).name+'» исполнен: принят «'+t.name+'».',1); }
    } else { pc.broken++; st.anger=clamp(st.anger+2.5,0,6);
      logMsg('«'+P(pid).name+'»: закон «'+t.name+'» нарушает коалиционный договор.',1);
      chron('Нарушен коалиционный договор с «'+P(pid).name+'».','b'); }
  });
}
function pactTick(){
  if(!S.pacts)return;
  Object.entries(S.pacts).forEach(([pid,pc])=>{
    if(!inCoal(pid)||S.gov.lead!==PL){ delete S.pacts[pid]; return; }
    if(!pc.done&&S.q>=pc.due){
      const st=S.partners[pid]; if(st)st.anger=clamp(st.anger+2,0,6);
      pc.due=S.q+4; pc.broken++;
      logMsg('Срок коалиционного договора с «'+P(pid).name+'» истёк: '+pactText(pc)+' так и не принят.',1);
    }
  });
}
/* прочность партнёра: 100 — держится, 0 — уходит */
function partnerLoyal(pid){
  if(isPM()){ const st=S.partners[pid]||{anger:0}; return Math.round(clamp(100-st.anger/6*100,0,100)); }
  const lead=P(S.gov.lead), p=P(pid);
  // чужой кабинет изнашивается: после полутора лет каждый квартал — ещё немного усталости,
  // а скандал у партии премьера партнёры помнят лучше избирателей
  const heat=(typeof scLive==='function'?scLive():[]).filter(x=>x.who===S.gov.lead).reduce((a,x)=>a+x.heat,0);
  const strain=(axDist(p.st,lead.st)-0.9)*26+(48-stateOfThings())*0.8+((S.split||{})[pid]||0)
    +Math.max(0,(S.govAge||0)-6)*1.3+heat*0.25;
  return Math.round(clamp(100-strain,5,100));
}
function coalStrength(){
  const ps=coalition().filter(x=>x!==S.gov.lead);
  return ps.length?Math.min(...ps.map(partnerLoyal)):100;
}
/* сколько портфелей просит партия: по доле мест, а не по порогу из прошлой палаты */
function partyPrice(id){
  return Math.max(1,Math.min(3,Math.round(seatsOf(id)/SEATS*POSTS.length*1.6)));
}
function givePosts(pid,n){
  const mine=POSTS.map(p=>p.id).filter(k=>S.gov.posts[k]===S.gov.lead).reverse();
  mine.slice(0,n).forEach(k=>S.gov.posts[k]=pid);
}
/* шанс, что фракция сядет за стол */
function joinChance(pid,leadId){
  const lead=P(leadId||PL), p=P(pid), d=axDist(p.st,lead.st);
  if(d>=2.2)return 0;
  let c=0.95-d*0.33+(avgRel(pid)-50)*0.006+(rep('honest')-50)*0.004;
  if(leadId===PL||!leadId)c+=(approval()-46)*0.004;
  if(S.crisis&&S.crisis.refused&&S.crisis.refused.indexOf(pid)>=0)return 0;
  return clamp(c,0.05,0.95);
}
/* лист коалиции: у премьера — партнёры и уступки, у оппозиции — чужой кабинет и его трещины */
function askCoalition(){
  const lead=P(S.gov.lead), mine=isPM(), ours=S.gov.lead===PL;
  const rows=coalition().map(id=>{ const p=P(id), isLead=id===S.gov.lead;
    const pc=mine&&S.pacts?S.pacts[id]:null, loy=isLead?100:partnerLoyal(id);
    return `<tr><td>${emblem(p,20)}</td><td><b>${p.name}</b>${isLead?' <span class="tag">премьер</span>':''}
        <div class="sub2">${mandates(seatsOf(id))} · ${posts(Object.values(S.gov.posts).filter(x=>x===id).length)}${
          pc?' · договор: '+pactText(pc)+(pc.done?' — исполнен':' — до '+shortDate(pc.due)):''}</div></td>
      <td class="n ${loy<40?'bad':loy<65?'warn':'good'}">${isLead?'—':loy+'%'}</td></tr>`; }).join('');
  const body=`<p class="lead">${mine
      ?'Коалиция держится на двух вещах: портфелях и договоре. Обиженный партнёр уходит, и тогда правительство остаётся меньшинством.'
      :'Кабинет '+lead.leader+' держится на '+coalSeats()+' голосах из '+MAJ+'. Чем дальше партнёр от премьера по курсу и чем хуже дела в стране, тем легче его увести.'}</p>
    <table class="tight"><thead><tr><th></th><th>Фракция</th><th class="n">Прочность</th></tr></thead><tbody>${rows}</tbody></table>
    <div class="res"><span>У коалиции</span><b class="${coalSeats()>=MAJ?'good':'bad'}">${coalSeats()} из ${MAJ}</b>
      <span>Самый слабый партнёр</span><b>${coalStrength()}%</b></div>`;
  const opts=[];
  if(mine){
    coalition().filter(id=>id!==PL).forEach(id=>{ const p=P(id), pc=S.pacts&&S.pacts[id];
      opts.push({label:'Встреча с лидером «'+p.short+'»',hint:'1 действие и '+MEET_CAP+' веса · прочность +25',
        fn(){ if(!pay({ap:1,cap:MEET_CAP},'Встреча с лидером «'+p.name+'»'))return;
          const st=S.partners[id]||(S.partners[id]={patience:3,anger:0}); st.anger=Math.max(0,st.anger-1.5);
          S.deputies.filter(d=>d.party===id).forEach(d=>d.rel=clamp(d.rel+3,0,100));
          logMsg('Встреча с лидером «'+p.name+'»: напряжение в коалиции снято.'); askCoalition(); }});
      if(pc&&!pc.done)opts.push({label:'Уступка «'+p.short+'» по курсу: '+AXNAME[pc.ax].toLowerCase(),
        hint:'1 действие и '+CONC_CAP+' веса · программа сдвинется на полшага · прочность +50',
        fn(){ if(!pay({ap:1,cap:CONC_CAP},'Уступка «'+p.name+'» по курсу'))return;
          const st=S.partners[id]||(S.partners[id]={patience:3,anger:0}); st.anger=Math.max(0,st.anger-3);
          me().st[pc.ax]=clamp(r1(me().st[pc.ax]+0.5*pc.sign),-2,2);
          coreGroups(me().st).forEach(g=>shiftMood(g,-0.8));
          logMsg('Уступка партнёру: курс по оси «'+AXNAME[pc.ax]+'» сдвинут к «'+p.name+'».',1);
          askCoalition(); }});
    });
    if(!S.crisis)opts.push({label:'Позвать фракцию в коалицию',hint:'1 действие · переговоры с шансом и договором',fn:()=>askInvite(false)});
    opts.push({label:'Отдать портфель',hint:'раздел «Правительство»',fn(){ S.tab='gov'; render(); }});
  } else if(!ours){
    coalition().filter(id=>id!==S.gov.lead&&id!==PL).forEach(id=>{ const p=P(id);
      opts.push({label:'Расколоть: увести «'+p.short+'» из кабинета',hint:'1 действие и '+SPLIT_CAP+' веса · шанс '+Math.round(splitChance(id)*100)+'%',
        fn:()=>splitCoalition(id)}); });
    if(inCoal(PL)&&chief())opts.push({label:'Выйти из коалиции',hint:'портфели сдаются, у кабинета станет '+(coalSeats()-seatsOf(PL))+' из '+MAJ,
      fn:leaveAsJunior});
    if(inCoal(PL)&&!chief())opts.push({label:'Выйти из коалиции',hint:'решает лидер партии — '+me().leader,fn(){ toast('Из коалиции партию выводит лидер'); }});
  }
  opts.push({label:'Закрыть',hint:'',fn(){}});
  sheetOpen({eye:'Коалиция · '+dateLabel(),title:mine?'Ваша коалиция':'Коалиция '+lead.leader,body,opts});
}
/* позвать фракцию: по ходу созыва это действие, при формировании — часть переговоров */
function askInvite(forming){
  const lead=PL, cur=forming&&S.crisis?S.crisis.coal:coalition();
  const cands=S.parties.filter(p=>p.id!==PL&&cur.indexOf(p.id)<0).sort((a,b)=>axDist(a.st,me().st)-axDist(b.st,me().st));
  sheetOpen({eye:forming?'Формирование правительства':'Коалиция · 1 действие',title:'Кого позвать',
    body:`<p class="lead">Каждая фракция просит портфели по своему весу и одно требование в договор —
        закон по оси, где она дальше всего от вас. Расхождение больше 2,2 — за стол не сядет.</p>`,
    opts:cands.map(p=>{ const ch=joinChance(p.id,lead), pc=pactFor(p.id,lead);
      return {label:p.name+' · '+mandates(seatsOf(p.id))+(ch?' · шанс '+Math.round(ch*100)+'%':' · не сядет'),
        hint:ch?'просит '+posts(partyPrice(p.id))+' и '+pactText(pc):'расхождение '+axDist(p.st,me().st).toFixed(1),
        fn(){ if(!ch){ toast('«'+p.name+'» не сядет за стол'); forming?askFormation():askInvite(false); return; }
          if(!forming&&!pay({ap:1},'Переговоры с «'+p.name+'»'))return;
          inviteRoll(p.id,forming); }};
    }).concat([{label:'Назад',hint:'',fn:()=>forming?askFormation():askCoalition()}])});
}
function inviteRoll(pid,forming){
  const p=P(pid), ok=Math.random()<joinChance(pid,PL);
  if(!ok){
    S.deputies.filter(d=>d.party===pid).forEach(d=>d.rel=clamp(d.rel-4,0,100));
    if(S.crisis){ S.crisis.refused=S.crisis.refused||[]; S.crisis.refused.push(pid); }
    logMsg('«'+p.name+'» отказалась входить в коалицию.',1);
    sheetOpen({eye:'Переговоры',title:'«'+p.name+'» отказала',
      body:`<p>Фракция выслушала условия и отказалась. ${forming?'В этом раунде к ней возвращаться бессмысленно.':'Отношения с её депутатами просели.'}</p>`,
      acts:[{label:forming?'К переговорам':'Закрыть',fn(){ if(forming)askFormation(); }}]});
    return;
  }
  const pc=pactFor(pid,PL);
  if(forming){ S.crisis.coal.push(pid); S.crisis.pacts=S.crisis.pacts||{}; S.crisis.pacts[pid]=pc; }
  else { S.gov.coal.push(pid); givePosts(pid,partyPrice(pid));
    S.partners[pid]={patience:3,anger:1}; S.pacts=S.pacts||{}; S.pacts[pid]=pc; syncCabinet();
    chron('«'+p.name+'» вошла в правительство.','g'); }
  logMsg('«'+p.name+'» согласилась войти в коалицию: '+posts(partyPrice(pid))+' и договор — '+pactText(pc)+'.',1);
  sheetOpen({eye:'Переговоры',title:'«'+p.name+'» с вами',
    body:`<p class="lead">Фракция входит в коалицию. Её условия:</p>
      <div class="res"><span>Портфели</span><b>${partyPrice(pid)}</b>
        <span>Коалиционный договор</span><b class="w">${pactText(pc)}</b>
        <span>Срок</span><b>${quarters(PACT_LEN)}</b>
        <span>У коалиции теперь</span><b class="${(forming?formSeats():coalSeats())>=MAJ?'good':'warn'}">${forming?formSeats():coalSeats()} из ${MAJ}</b></div>
      <p class="hint">Закон по этой оси в обратную сторону — нарушение договора. Не принять нужный закон в срок — тоже.</p>`,
    acts:[{label:forming?'К переговорам':'Хорошо',fn(){ if(forming)askFormation(); else render(); }}]});
}
/* оппозиция уводит партнёра из чужого кабинета */
function splitChance(pid){
  const lead=P(S.gov.lead), p=P(pid);
  // каждая неудачная попытка оставляет зерно: следующая заметно легче
  return clamp(0.22+(axDist(p.st,lead.st)-1)*0.24+(avgRel(pid)-50)*0.008+(stateOfThings()<48?0.1:0)
    +((S.split||{})[pid]||0)*0.006+(rep('comp')-50)*0.003,0.06,0.75);
}
function splitCoalition(pid){
  const p=P(pid), ch=splitChance(pid);
  if(!pay({ap:1,cap:SPLIT_CAP},'Раскол коалиции: «'+p.name+'»'))return;
  S.split=S.split||{};
  if(Math.random()<ch){
    S.gov.coal=S.gov.coal.filter(x=>x!==pid);
    Object.keys(S.gov.posts).forEach(k=>{ if(S.gov.posts[k]===pid)S.gov.posts[k]=S.gov.lead; });
    syncCabinet(); delete S.split[pid];
    addCap(6); bumpRep('comp',3);
    logMsg('«'+p.name+'» вышла из правительства '+P(S.gov.lead).leader+'. У кабинета '+coalSeats()+' из '+MAJ+'.',1);
    chron('Раскол: «'+p.name+'» покинула правительство.','g');
    sheetOpen({eye:'Раскол коалиции',title:'«'+p.name+'» ушла из кабинета',
      body:`<p class="lead">Уговоры сработали: фракция сдала портфели и перешла в оппозицию.</p>
        <div class="res"><span>У кабинета осталось</span><b class="${coalSeats()>=MAJ?'':'good'}">${coalSeats()} из ${MAJ}</b></div>
        <p class="hint">${coalSeats()<MAJ?'Правительство стало меньшинством. Теперь вотум недоверия может его уронить — внесите его, пока кабинет не нашёл замену.':'Большинство у кабинета ещё есть, но запас стал тоньше.'}</p>`,
      acts:[{label:coalSeats()<MAJ?'К вотуму':'Дальше',fn(){ if(coalSeats()<MAJ)askMotion(); }}]});
  } else {
    S.split[pid]=(S.split[pid]||0)+8;          // зерно брошено: следующая попытка легче
    S.deputies.filter(d=>d.party===pid).forEach(d=>d.rel=clamp(d.rel-5,0,100));
    addTrail(3,'уговоры «'+p.name+'»');
    logMsg('«'+p.name+'» осталась в правительстве, но разговор запомнила.',1);
    sheetOpen({eye:'Раскол коалиции',title:'Не вышло',
      body:`<p>«${p.name}» выслушала и осталась в кабинете. Сомнение посеяно: следующая попытка будет легче.</p>`,
      acts:[{label:'Закрыть'}]});
  }
  render();
}
/* младший партнёр уходит сам */
function leaveAsJunior(){
  S.gov.coal=S.gov.coal.filter(x=>x!==PL);
  Object.keys(S.gov.posts).forEach(k=>{ if(S.gov.posts[k]===PL)S.gov.posts[k]=S.gov.lead; });
  S.role='opp'; syncCabinet(); bumpRep('firm',3); bumpRep('honest',-1);
  if(mySeat()==='min'||mySeat()==='vice')setSeat(S.you.mand?'lead':'none','Вышли из коалиции.');
  logMsg('«'+me().name+'» вышла из правительства '+P(S.gov.lead).leader+'.',1);
  chron('Ваша партия вышла из правительства.','');
  sheetOpen({eye:'Коалиция',title:'Вы в оппозиции',
    body:`<p>Портфели сданы. У кабинета ${coalSeats()} из ${MAJ}.</p>
      <p class="hint">${coalSeats()<MAJ?'Правительство стало меньшинством — самое время для вотума недоверия.':'Большинство у кабинета осталось.'}</p>`,
    acts:[{label:'Дальше'}]});
  render();
}
/* ИИ-коалиция трещит сама: расхождение, плохие дела и ваши уговоры */
function aiCoalTick(){
  if(isPM()||S.crisis)return;                      // кабинет вашей партии при чужом лидере тоже живёт по этим правилам
  coalition().filter(id=>id!==S.gov.lead&&id!==PL).forEach(id=>{
    const loy=partnerLoyal(id);
    if(loy<45&&Math.random()<(45-loy)/120){
      const p=P(id);
      S.gov.coal=S.gov.coal.filter(x=>x!==id);
      Object.keys(S.gov.posts).forEach(k=>{ if(S.gov.posts[k]===id)S.gov.posts[k]=S.gov.lead; });
      syncCabinet();
      logMsg('«'+p.name+'» вышла из правительства '+P(S.gov.lead).leader+'. У кабинета '+coalSeats()+' из '+MAJ+'.',1);
      chron('Коалиция '+P(S.gov.lead).leader+' лишилась «'+p.name+'».','');
    }
  });
}

/* ═══ ПРАВИТЕЛЬСТВЕННЫЙ КРИЗИС И ФОРМИРОВАНИЕ ═══════════════════════
   Кабинет пал — страна не остаётся без правительства: прежний состав
   исполняет обязанности, а президент даёт поручение. У формирующего
   квартал; не собрал — поручение уходит следующему. Два провала подряд —
   и президент обязан распустить Собрание. */
function govFall(why){
  const prev=S.gov.lead, wasMine=prev===PL;
  S.crisis={round:1,form:null,tried:[prev],why,since:S.q,prev,coal:[],refused:[],pacts:{}};
  S.motion=null;
  if(wasMine){ career('Кабинет пал: '+why+'.'); bumpRep('comp',-4);
    if(mySeat()==='pm')setSeat(hasMandate()?'lead':'dep','Кабинет пал.'); }
  logMsg('Правительственный кризис: '+why+'. Кабинет '+P(prev).leader+' исполняет обязанности до утверждения нового.',1);
  chron('Правительство пало: '+why+'.',wasMine?'b':'');
  crisisRound();
}
function formPool(){
  const c=S.crisis;
  return S.parties.filter(p=>c.tried.indexOf(p.id)<0).sort(bySeats);
}
/* президент даёт поручение: своей партии, если она не мелочь, иначе крупнейшей */
function formPick(){
  const pool=formPool(); if(!pool.length)return null;
  const pp=S.pres&&S.pres.party;
  if(pp&&pool.some(p=>p.id===pp)&&seatsOf(pp)>=SEATS*0.14)return pp;
  return pool[0].id;
}
function crisisRound(){
  const c=S.crisis; if(!c)return;
  if(c.round>FORM_ROUNDS){ forcedDissolution(); return; }
  const pool=formPool();
  if(!pool.length){ forcedDissolution(); return; }
  if(isPres()){
    sheetOpen({eye:'Правительственный кризис · раунд '+c.round+' из '+FORM_ROUNDS,title:'Кому поручить правительство',
      body:`<p class="lead">${c.why[0].toUpperCase()+c.why.slice(1)}. Поручение даёте вы. У формирующего квартал;
          не соберёт — поручение уйдёт следующему, а после ${FORM_ROUNDS} провалов вы обязаны распустить Собрание.</p>`,
      opts:pool.map(p=>({label:p.name+(p.id===PL?' (ваша партия)':''),
        hint:mandates(seatsOf(p.id))+(p.id===PL?'':' · расхождение с вами '+axDist(p.st,me().st).toFixed(1)),
        fn:()=>formStart(p.id)}))});
    return;
  }
  formStart(formPick());
}
function formStart(pid){
  const c=S.crisis; if(!c||!pid){ forcedDissolution(); return; }
  c.form=pid; c.tried.push(pid); c.coal=[pid]; c.refused=[]; c.pacts={}; c.due=S.q;
  if(pid===PL&&!chief()){ logMsg('Поручение получил лидер вашей партии '+me().leader+'.',1); aiFormation(PL); return; }
  if(pid===PL){
    logMsg('Президент поручил вам сформировать правительство (раунд '+c.round+' из '+FORM_ROUNDS+').',1);
    sheetOpen({eye:'Поручение · раунд '+c.round+' из '+FORM_ROUNDS,title:'Сформировать правительство поручено вам',
      body:`<p class="lead">У «${me().name}» ${mandates(seatsOf(PL))}. Для большинства нужно ${MAJ}.
          Поручение действует до конца квартала: соберите коалицию и проведите кабинет через утверждение в Собрании.</p>
        <p class="hint">Переговоры при формировании не тратят действий. Утверждение — простое большинство
          присутствующих: правительство меньшинства тоже возможно, если противников меньше, чем сторонников.</p>`,
      acts:[{label:'К переговорам',fn:askFormation},{label:'Вернуть поручение',fn:()=>formFail('вы вернули поручение')}]});
    return;
  }
  aiFormation(pid);
}
function formSeats(){ return S.crisis?S.crisis.coal.reduce((a,id)=>a+seatsOf(id),0):0; }
/* переговоры игрока-форматора */
function askFormation(){
  const c=S.crisis; if(!c||c.form!==PL){ toast('Поручения у вас нет'); return; }
  const cands=S.parties.filter(p=>p.id!==PL).sort((a,b)=>axDist(a.st,me().st)-axDist(b.st,me().st));
  const rows=cands.map(p=>{ const inC=c.coal.indexOf(p.id)>=0, ref=c.refused.indexOf(p.id)>=0, ch=joinChance(p.id,PL);
    return `<tr class="${inC?'mine':''}"><td>${emblem(p,18)}</td><td><b>${p.name}</b>
        <div class="sub2">${inC?'в коалиции · договор: '+pactText(c.pacts[p.id]):ref?'отказала в этом раунде':ch?'просит '+posts(partyPrice(p.id))+' и '+pactText(pactFor(p.id,PL)):'не сядет за стол'}</div></td>
      <td class="n">${seatsOf(p.id)}</td><td class="n">${axDist(p.st,me().st).toFixed(1)}</td>
      <td class="n ${inC?'good':ch>0.5?'good':ch>0.2?'warn':'bad'}">${inC?'✓':ch?Math.round(ch*100)+'%':'—'}</td></tr>`; }).join('');
  const seats=formSeats();
  sheetOpen({eye:'Формирование · раунд '+c.round+' из '+FORM_ROUNDS+' · до конца квартала',title:'Переговоры о коалиции',
    body:`<div class="res"><span>У вашей коалиции</span><b class="${seats>=MAJ?'good':'bad'}">${seats} из ${MAJ}</b>
        <span>Не хватает</span><b>${Math.max(0,MAJ-seats)}</b></div>
      <table class="tight"><thead><tr><th></th><th>Фракция</th><th class="n">Места</th><th class="n">Расх.</th><th class="n">Шанс</th></tr></thead>
        <tbody>${rows}</tbody></table>`,
    opts:[
      {label:'Позвать фракцию',hint:'условия, шанс, договор',fn:()=>askInvite(true)},
      {label:seats>=MAJ?'Идти на утверждение':'Идти на утверждение меньшинством',
       hint:seats>=MAJ?'большинство собрано':'нужно, чтобы «за» было больше, чем «против»',fn:()=>investiture(PL,c.coal.slice())},
      {label:'Вернуть поручение',hint:'раунд провален',fn:()=>formFail('вы вернули поручение')},
      {label:'Отложить',hint:'поручение действует до конца квартала',fn(){}}]});
}
/* ИИ-форматор: зовёт ближайших, а без вас не выходит — зовёт и вас */
function aiFormation(pid){
  const lead=P(pid), coal=[pid];
  let seats=seatsOf(pid), needMe=false;
  S.parties.filter(p=>p.id!==pid).sort((a,b)=>axDist(a.st,lead.st)-axDist(b.st,lead.st)).forEach(p=>{
    if(seats>=MAJ||axDist(p.st,lead.st)>=1.95)return;
    if(p.id===PL){ needMe=true; return; }
    coal.push(p.id); seats+=seatsOf(p.id);
  });
  logMsg('Поручение сформировать правительство получил '+lead.leader+' («'+lead.name+'»).',1);
  if(seats<MAJ&&needMe&&seats+seatsOf(PL)>=MAJ){
    const pc=pactFor(PL,pid);
    sheetOpen({eye:'Формирование · раунд '+S.crisis.round+' из '+FORM_ROUNDS,title:lead.leader+' зовёт вас в правительство',
      body:`<p class="lead">«${lead.name}» собрала ${seats} мандатов и без вас большинства не набирает.
          ${lead.leader} предлагает ${posts(partyPrice(PL))} и коалиционный договор в вашу пользу:
          ${pactText(pc)}.</p>
        <p class="hint">Отказ — и кабинету придётся идти на утверждение меньшинством. Провалится —
          поручение уйдёт дальше, и досрочные выборы станут ближе.</p>`,
      opts:[{label:'Войти в правительство',hint:'младший партнёр, '+posts(partyPrice(PL)),
          fn(){ coal.push(PL); investiture(pid,coal); }},
        {label:'Отказать',hint:'пусть идут меньшинством',fn:()=>investiture(pid,coal)}]});
    return;
  }
  investiture(pid,coal);
}
/* утверждение кабинета: коалиция «за», соседи по курсу терпят, дальние против */
function invLean(d,lead,coal){
  if(coal.indexOf(d.party)>=0)return 30+noise(d.id+'inv'+S.q,6);
  let v=(1.7-axDist(P(d.party).st,P(lead).st))*14-8+(d.party===PL?0:noise(d.id+'inv'+S.q,10));
  if(d.party===PL&&S.crisis&&S.crisis.plVote)v=S.crisis.plVote==='yes'?30:S.crisis.plVote==='no'?-30:0;
  return v;
}
function investiture(lead,coal){
  const c=S.crisis;
  // ваша фракция вне кабинета решает сама, как голосовать
  if(lead!==PL&&coal.indexOf(PL)<0&&c&&!c.plVote){
    const lp=P(lead);
    sheetOpen({eye:'Утверждение кабинета',title:'Как голосует ваша фракция',
      body:`<p class="lead">Собрание утверждает кабинет ${lp.leader} («${lp.name}»): ${coal.map(id=>P(id).short).join(', ')},
          ${coal.reduce((a,id)=>a+seatsOf(id),0)} мандатов. Ваши ${seatsOf(PL)} голосов могут его провести — или сорвать раунд.</p>`,
      opts:[{label:'За',hint:'кабинет пройдёт вероятнее, вы — в стороне от ответственности',fn(){ c.plVote='yes'; investiture(lead,coal); }},
        {label:'Воздержаться',hint:'пусть решают другие',fn(){ c.plVote='abs'; investiture(lead,coal); }},
        {label:'Против',hint:'сорвать раунд и приблизить досрочные выборы',fn(){ c.plVote='no'; investiture(lead,coal); }}]});
    return;
  }
  const list=S.deputies.map(d=>({d,v:invLean(d,lead,coal)}));
  let yes=0,no=0; list.forEach(x=>{ if(x.v>6)yes++; else if(x.v<-6)no++; });
  const pass=yes>no&&yes>=SEATS*0.3;
  const lp=P(lead);
  S.votes.unshift({no:++S.billNo,q:S.q,name:'Утверждение кабинета '+lp.leader,stance:0,yes,no,pass,house:'соб'});
  sheetOpen({eye:'Утверждение кабинета · Собрание',title:'Кабинет '+lp.leader,
    body:`<p class="lead">Коалиция: ${coal.map(id=>P(id).name).join(', ')}.</p>
      ${houseBoard(list,yes,no,no+1,{showUnd:true,undWord:'воздержались',what:'утверждение правительства',
        verdict:pass?'кабинет утверждён':'кабинет не утверждён'})}`,
    acts:[{label:'Дальше',fn(){ if(pass)formGov(lead,coal); else formFail('Собрание не утвердило кабинет '+lp.leader); }}]});
}
function formFail(why){
  const c=S.crisis; if(!c)return;
  c.round++; c.plVote=null;
  logMsg('Раунд формирования провален: '+why+'.',1);
  if(c.round>FORM_ROUNDS){ forcedDissolution(); return; }
  crisisRound();
}
function formGov(lead,coal,how){
  const c=S.crisis;
  S.gov={lead,coal:coal.slice(),posts:{}};
  POSTS.forEach(p=>S.gov.posts[p.id]=lead);
  coal.filter(id=>id!==lead).forEach(id=>givePosts(id,partyPrice(id)));
  S.govAge=0; S.motion=null; S.noConfCool=0; S.crisis=null;
  if(lead===PL){
    S.role='pm'; S.partners={}; S.pacts={};
    if(chief())coal.filter(id=>id!==PL).forEach(id=>{ S.partners[id]={patience:3,anger:1};
      S.pacts[id]=(c&&c.pacts&&c.pacts[id])||pactFor(id,PL); });
    S.budget={submitted:false,fails:0}; S.lastBudget=snapshotBudget();
    if(S.you&&chief()&&mySeat()!=='pres')setSeat('pm','Сформирован кабинет.');
    career('Сформировано правительство: '+coal.map(id=>P(id).short).join(', ')+'.');
    bumpRep('firm',3);
  } else {
    S.role=coal.indexOf(PL)>=0?'junior':'opp';
    S.pm=null; S.partners={}; S.pacts={};
    if(mySeat()==='pm')setSeat(hasMandate()?'lead':'dep','Кабинет сменился.');
  }
  syncCabinet();
  const lp=P(lead), seats=coalSeats();
  logMsg('Утверждено правительство '+lp.leader+': '+coal.map(id=>P(id).short).join(', ')+', '+seats+' мандатов.',1);
  chron('Новое правительство: '+lp.leader+(how?' ('+how+')':'')+'.',lead===PL?'g':'');
  render();
}
/* два провала подряд — роспуск обязателен */
function forcedDissolution(){
  S.crisis=null;
  if(CN().dissolve==='none'){
    const big=S.parties.slice().sort(bySeats)[0].id;
    logMsg('Роспуск запрещён конституцией: правительство меньшинства формирует крупнейшая фракция.',1);
    sheetOpen({eye:'Правительственный кризис',title:'Кабинет назначен по закону',
      body:`<p>Собрание дважды не смогло утвердить правительство, а распускать его конституция запрещает.
        Кабинет меньшинства формирует крупнейшая фракция — «${P(big).name}».</p>`,
      acts:[{label:'Дальше',fn(){ formGov(big,[big],'по закону'); }}]});
    return;
  }
  logMsg('Собрание дважды не утвердило правительство. Президент обязан распустить палату.',1);
  chron('Собрание распущено: правительство так и не сформировано.','b');
  sheetOpen({eye:'Обязательный роспуск · ст. 111',title:'Собрание распущено',
    body:`<p class="lead">Два раунда поручения — и ни одного утверждённого кабинета. Конституция не оставляет выбора:
        президент распускает Собрание, выборы — в этом же квартале, без предвыборного штаба.</p>`,
    acts:[{label:'К выборам',fn(){ election(); }}]});
}

/* ═══ ВОТУМ НЕДОВЕРИЯ ══════════════════════════════════════════════
   Две ступени. Сначала подписи — пятая часть Собрания. Потом голосование:
   в конце квартала или сразу, если инициатор уверен. Между ними обе
   стороны работают с фракциями. Для отставки нужно абсолютное
   большинство — 218, воздержавшиеся считаются против. */
function motionSupport(d){
  const m=S.motion, lead=S.gov.lead, going=stateOfThings();
  let v=(inCoal(d.party)?-24:16)-(going-50)*0.42+noise(d.id+'mot'+(m?m.q:S.q),11);
  if(d.party===lead)v-=34;
  if(!inCoal(d.party))v-=(2.0-axDist(P(d.party).st,P(lead).st))*6;       // близкие по курсу не свалят
  if(inCoal(d.party)&&d.party!==lead)v+=(100-partnerLoyal(d.party))*0.34;  // обиженный партнёр
  if(m&&m.succ){ v+=(1.4-axDist(P(d.party).st,P(m.succ).st))*10; if(d.party===m.succ)v+=30; }
  else if(noconfKind()==='constructive')v-=10;
  const side=lead===PL?-1:(m&&m.by===PL?1:0);                              // личные связи тянут к вам
  v+=(d.rel-50)*0.42*side;
  if(lead===PL){ if(hasTrait('iron'))v-=5; v-=(rep('firm')-50)*0.1; }
  if(m&&m.lob&&m.lob[d.party])v+=m.lob[d.party];
  const dm=dealFor(d.party,'h','m');
  if(dm&&m)v+=(m.against===PL?-1:1)*34*d.loyal/100*dealGrip(dm);   // лидер обещал голоса по вотуму
  if(d.party===PL){ const st=(m&&m.pl)||(lead===PL?'no':inCoal(PL)?'no':'yes');
    v=st==='yes'?40:st==='no'?-40:0; }
  return v;
}
function motionForecast(){
  let yes=0,no=0; S.deputies.forEach(d=>{ const v=motionSupport(d); if(v>4)yes++; else if(v<-4)no++; });
  return {yes,no,abs:SEATS-yes-no};
}
function motionSigs(){
  return S.deputies.filter(d=>!inCoal(d.party)&&(d.party===PL||motionSupport(d)>-6)).length;
}
function motionBlock(){
  if(noconfKind()==='none')return 'Кабинет отвечает только перед президентом: вотума недоверия нет.';
  if(S.crisis)return 'Идёт формирование правительства: валить некого.';
  if(S.noConfCool>0)return 'После провала вотума Собрание не примет новый ещё '+quarters(S.noConfCool)+'.';
  return '';
}
/* центральный лист вотума: подача, работа с фракциями, голосование, ответ премьера */
function askMotion(){
  const m=S.motion, lead=P(S.gov.lead);
  if(!m){
    if(S.gov.lead===PL){ toast('Вотум вносит оппозиция, а не вы'); return; }
    const bl=motionBlock(); if(bl){ toast(bl); return; }
    const sig=motionSigs(), constr=noconfKind()==='constructive';
    const succ=S.parties.filter(p=>!inCoal(p.id)).sort(bySeats);
    const f0=(()=>{ S.motion={by:PL,against:S.gov.lead,q:S.q,due:S.q,lob:{},succ:constr?PL:null};
      const f=motionForecast(); S.motion=null; return f; })();
    sheetOpen({eye:'Вотум недоверия · ступень 1 из 2',title:'Внести вотум кабинету '+lead.leader,
      body:`<p class="lead">Нужна пятая часть Собрания — ${MOT_SIG} подписей. Потом голосование: в конце квартала
          или сразу. Для отставки — ${MAJ} голосов «за»; воздержавшиеся работают на кабинет.</p>
        ${constr?'<p class="hint">Вотум конструктивный (ст. 117): в том же голосовании Собрание избирает преемника. Назовите его.</p>':''}
        <div class="res"><span>Подписи</span><b class="${sig>=MOT_SIG?'good':'bad'}">${sig} из ${MOT_SIG}</b>
          <span>Прогноз «за отставку»</span><b class="${f0.yes>=MAJ?'good':'bad'}">${f0.yes} из ${MAJ}</b>
          <span>У кабинета</span><b>${coalSeats()} мандатов</b>
          <span>Цена</span><b>1 действие и ${MOT_CAP} веса</b></div>`,
      opts:(constr?succ.map(p=>({label:'Внести, преемник — '+p.leader+' («'+p.short+'»)',
          hint:mandates(seatsOf(p.id)),fn:()=>fileMotion(p.id)})):
          [{label:'Внести вотум',hint:sig>=MOT_SIG?'подписей хватает':'подписей не хватает',fn:()=>fileMotion(null)}])
        .concat([{label:'Не вносить',hint:'',fn(){}}])});
    return;
  }
  const f=motionForecast(), mine=m.by===PL, against=m.against===PL;
  const list=S.deputies.map(d=>({d,v:motionSupport(d)}));
  const opts=[];
  if(mine||against){
    opts.push({label:mine?'Работать с фракцией: за отставку':'Работать с фракцией: удержать кабинет',
      hint:'1 действие и '+MOT_LOBBY+' веса',fn:()=>askMotionLobby(mine?1:-1)});
  }
  if(mine||against)opts.push({label:'Договориться с лидерами фракций',hint:mine?'сделка: фракция голосует за отставку':'сделка: фракция не голосует за отставку',
    fn:()=>askDeals({k:'m'})});
  if(mine){
    opts.push({label:'Ставить на голосование сейчас',hint:'прогноз '+f.yes+' из '+MAJ,fn:()=>motionVote()});
    opts.push({label:'Отозвать вотум',hint:'вес −4',fn(){ S.motion=null; addCap(-4);
      logMsg('Вотум недоверия отозван инициатором.',1); render(); }});
  }
  if(against){
    opts.push({label:'Поставить вопрос о доверии',hint:'1 действие и '+CONF_Q+' веса · выиграете — вотум снят, проиграете — отставка',
      fn:askConfidence});
    opts.push({label:'Уступки партнёрам',hint:'встреча, курс, портфель',fn:askCoalition});
    opts.push({label:'Подать в отставку',hint:'кабинет уходит, начинается формирование',fn(){
      logMsg('Премьер подал в отставку, не дожидаясь вотума.',1); govFall('отставка премьера'); }});
  }
  if(!mine&&!against){
    const st=m.pl||'yes';
    ['yes','abs','no'].forEach(k=>opts.push({label:(k===st?'● ':'')+'Ваша фракция: '+(k==='yes'?'за отставку':k==='no'?'против':'воздержаться'),
      hint:k==='yes'?'кабинет падает вероятнее':k==='no'?'удержать кабинет':'остаться в стороне',
      fn(){ m.pl=k; askMotion(); }}));
  }
  opts.push({label:'Закрыть',hint:m.due>S.q?'голосование позже':'голосование — в конце квартала',fn(){}});
  sheetOpen({eye:'Вотум недоверия · ступень 2 из 2 · '+(m.due>S.q?'голосование в следующем квартале':'голосование в конце квартала'),
    title:'Вотум кабинету '+lead.leader,
    body:`<p class="lead">Внесла «${P(m.by).name}»${m.succ?', преемник — '+P(m.succ).leader:''}.
        ${against?'Кабинет ваш: у вас квартал, чтобы удержать зал.':mine?'Подписи собраны, теперь — голоса.':''}</p>
      ${houseBoard(list,f.yes,f.no,MAJ,{final:false,undWord:'воздержатся',what:'прогноз «за отставку»'})}
      ${against?'<p class="hint">Пока вотум внесён, распускать Собрание нельзя (ст. 109 ч. 3).</p>':''}`,
    opts});
}
function fileMotion(succ){
  const sig=motionSigs();
  if(!pay({ap:1,cap:MOT_CAP},'Внесён вотум недоверия'))return;
  if(sig<MOT_SIG){
    addCap(-3);
    logMsg('Вотум недоверия не внесён: собрано '+sig+' подписей из '+MOT_SIG+'.',1);
    sheetOpen({eye:'Вотум недоверия',title:'Подписей не хватило',
      body:`<p>Под вотумом ${sig} подписей при нужных ${MOT_SIG}. Оппозиция не поддержала инициативу —
        сначала придётся сблизиться с другими фракциями или ослабить кабинет.</p>`,acts:[{label:'Закрыть'}]});
    render(); return;
  }
  S.motion={by:PL,against:S.gov.lead,q:S.q,due:S.q,lob:{},succ:succ||null,sig};
  logMsg('Внесён вотум недоверия кабинету '+P(S.gov.lead).leader+': '+sig+' подписей. Голосование — в конце квартала.',1);
  chron('Оппозиция внесла вотум недоверия.','');
  askMotion();
}
function askMotionLobby(dir){
  const m=S.motion; if(!m)return;
  const pool=S.parties.filter(p=>p.id!==PL&&(dir>0?p.id!==S.gov.lead:true));
  sheetOpen({eye:'Вотум · работа с фракцией',title:dir>0?'Кого убеждать голосовать за отставку':'Кого удерживать',
    opts:pool.map(p=>{ const n=S.deputies.filter(d=>d.party===p.id), y=n.filter(d=>motionSupport(d)>4).length;
      return {label:p.name+' · за отставку '+y+' из '+n.length,hint:'1 действие и '+MOT_LOBBY+' веса',
        fn(){ if(!pay({ap:1,cap:MOT_LOBBY},'Вотум: работа с «'+p.name+'»'))return;
          const g=ri(8,15)*dir; m.lob[p.id]=(m.lob[p.id]||0)+g;
          S.deputies.filter(d=>d.party===p.id).forEach(d=>d.rel=clamp(d.rel+2,0,100));
          logMsg('Вотум: работа с фракцией «'+p.name+'».'); askMotion(); }}; })
      .concat([{label:'Назад',hint:'',fn:askMotion}])});
}
/* голосование по вотуму */
function motionVote(){
  const m=S.motion; if(!m)return;
  const list=S.deputies.map(d=>({d,v:motionSupport(d)}));
  let yes=0,no=0; list.forEach(x=>{ if(x.v>4)yes++; else if(x.v<-4)no++; });
  const pass=yes>=MAJ, lead=P(m.against);
  S.votes.unshift({no:++S.billNo,q:S.q,name:'Вотум недоверия кабинету '+lead.leader,stance:0,yes,no,pass,house:'соб'});
  S.motion=null;
  // конструктивный: коалиция преемника — фракции, где большинство проголосовало «за»
  const coal=[];
  if(pass&&m.succ){
    S.parties.forEach(p=>{ if(p.id===m.against)return;
      const n=list.filter(x=>x.d.party===p.id), y=n.filter(x=>x.v>4).length;
      if(p.id===m.succ||(n.length&&y/n.length>0.5))coal.push(p.id); });
    if(coal.indexOf(m.succ)<0)coal.unshift(m.succ);
  }
  sheetOpen({eye:'Вотум недоверия · '+dateLabel(),title:pass?'Кабинет '+lead.leader+' отправлен в отставку':'Кабинет '+lead.leader+' устоял',
    body:`${houseBoard(list,yes,no,MAJ,{showUnd:true,undWord:'воздержались',what:'вотум недоверия',
        verdict:pass?'вотум принят':'вотум провален'})}
      <p class="hint">${pass
        ?(m.succ?'Вотум конструктивный: тем же голосованием избран преемник — '+P(m.succ).leader+'.'
                :'Кабинет исполняет обязанности, президент даёт поручение сформировать новый.')
        :'Новый вотум Собрание примет не раньше чем через '+quarters(MOT_COOL)+'.'}</p>`,
    acts:[{label:'Дальше',fn(){
      if(pass){
        if(m.against===PL){ bumpRep('firm',-4); }
        if(m.by===PL){ addCap(10); bumpRep('firm',4); }
        cover({ax:'order',stance:1,good:'Собрание отправило кабинет в отставку',bad:'Страна снова без правительства',
          flat:'Вотум недоверия кабинету '+lead.leader+' принят'});
        if(m.succ){ S.crisis={round:1,form:m.succ,tried:[m.against],why:'конструктивный вотум',since:S.q,prev:m.against,coal:[],refused:[],pacts:{}};
          if(m.against===PL&&mySeat()==='pm')setSeat(hasMandate()?'lead':'dep','Кабинет пал.');
          formGov(m.succ,coal,'конструктивный вотум'); }
        else govFall('вотум недоверия');
      } else {
        S.noConfCool=MOT_COOL;
        if(m.by===PL){ addCap(-6); bumpRep('comp',-2); }
        if(m.against===PL){ addCap(8); bumpRep('firm',3); cnt('motionWon'); }
        logMsg('Вотум недоверия провален: '+yes+' «за» при нужных '+MAJ+'.',1);
      }
      render(); }}]});
  render();
}
/* премьер сам ставит вопрос о доверии: ва-банк */
function askConfidence(){
  if(!pay({ap:1,cap:CONF_Q},'Вопрос о доверии'))return;
  const list=S.deputies.map(d=>({d,v:-motionSupport(d)+6}));
  let yes=0,no=0; list.forEach(x=>{ if(x.v>4)yes++; else if(x.v<-4)no++; });
  const pass=yes>no;
  S.votes.unshift({no:++S.billNo,q:S.q,name:'Вопрос о доверии кабинету',stance:0,yes,no,pass,house:'соб'});
  sheetOpen({eye:'Вопрос о доверии',title:pass?'Собрание выразило доверие':'Собрание отказало в доверии',
    body:`${houseBoard(list,yes,no,no+1,{showUnd:true,undWord:'воздержались',what:'доверие кабинету',
        verdict:pass?'доверие выражено':'в доверии отказано'})}
      <p class="hint">${pass?'Вотум оппозиции снят, новый — не раньше чем через четыре квартала.':'Кабинет уходит в отставку.'}</p>`,
    acts:[{label:'Дальше',fn(){
      if(pass){ S.motion=null; S.noConfCool=4; addCap(8); bumpRep('firm',5);
        logMsg('Собрание выразило доверие кабинету: '+yes+' против '+no+'. Вотум оппозиции снят.',1);
        chron('Кабинет выиграл вопрос о доверии.','g'); }
      else govFall('Собрание отказало в доверии');
      render(); }}]});
}
/* ИИ-оппозиция вносит вотум: против вас — с кварталом на ответ, против чужого кабинета — спрашивает вашу фракцию */
function aiMotionTick(){
  if(S.motion||S.crisis||noconfKind()==='none'||S.noConfCool>0)return;
  const opp=S.parties.filter(p=>!inCoal(p.id)&&p.id!==PL).sort(bySeats)[0];
  if(!opp)return;
  if(S.gov.lead===PL){
    const weak=coalSeats()<MAJ, low=approval()<38, bloc=typeof blocOn==='function'&&blocOn()&&approval()<47;
    if(!(weak||low||bloc))return;
    if(Math.random()>=(weak?0.5:bloc?0.22:0.15))return;
    S.motion={by:opp.id,against:PL,q:S.q,due:S.q,lob:{},succ:noconfKind()==='constructive'?opp.id:null,sig:MOT_SIG+ri(5,60)};
    logMsg('«'+opp.name+'» внесла вотум недоверия вашему кабинету. Голосование — в конце квартала.',1);
    chron('Оппозиция внесла вотум недоверия.','b');
    sheetOpen({eye:'Вотум недоверия',title:'Оппозиция внесла вотум',
      body:`<p class="lead">«${opp.name}» собрала подписи. Голосование — в конце этого квартала: у вас три хода,
          чтобы удержать зал.</p>
        <div class="res"><span>Прогноз «за отставку»</span><b class="${motionForecast().yes>=MAJ?'bad':'good'}">${motionForecast().yes} из ${MAJ}</b>
          <span>У коалиции</span><b>${coalSeats()}</b></div>
        <p class="hint">Работа с фракциями, уступки партнёрам или вопрос о доверии — ва-банк. Распустить Собрание, пока вотум внесён, нельзя.</p>`,
      acts:[{label:'К вотуму',fn:askMotion},{label:'Позже'}]});
    return;
  }
  if(coalSeats()<MAJ&&Math.random()<0.25){
    S.motion={by:opp.id,against:S.gov.lead,q:S.q,due:S.q,lob:{},succ:noconfKind()==='constructive'?opp.id:null,
      sig:MOT_SIG+ri(5,60),pl:inCoal(PL)?'no':'yes'};
    logMsg('«'+opp.name+'» внесла вотум недоверия кабинету '+P(S.gov.lead).leader+'.',1);
    sheetOpen({eye:'Вотум недоверия',title:'«'+opp.name+'» внесла вотум',
      body:`<p class="lead">Кабинет ${P(S.gov.lead).leader} — меньшинство, ${coalSeats()} из ${MAJ}. Голосование в конце квартала,
          и ваши ${seatsOf(PL)} голосов могут решить дело.</p>`,
      acts:[{label:'Решить, как голосуем',fn:askMotion},{label:'Позже'}]});
  }
}
/* голосование наступает само, когда срок вышел */
function motionTick(){ if(S.motion&&S.q>=S.motion.due)motionVote(); }

/* ═══ РОСПУСК СОБРАНИЯ ════════════════════════════════════════════
   Право у одного — у президента или премьера. Запретов шесть, и все
   видны заранее. Перед решением — прогноз: кто сколько получит, если
   выборы сегодня. Президент-соперник тоже умеет считать. */
function dissHolderWord(){ const d=CN().dissolve; return d==='pres'?'президент':d==='pm'?'премьер-министр':'никто'; }
function dissRules(){
  const left=aTerm()-(S.q-S.termStart);
  const age=S.govAge||0;
  return [
    {t:'Конституция допускает роспуск',ok:CN().dissolve!=='none',art:'ст. 109',fail:'конституция запрещает роспуск'},
    {t:'Кабинет работает больше года',ok:age>=4,art:'ст. 109 ч. 2',
     note:age<4?'ещё '+quarters(4-age):'',fail:'кабинету нет года, ждать ещё '+quarters(Math.max(0,4-age))},
    {t:'Не идёт предвыборная кампания',ok:!S.camp,art:'ст. 109 ч. 2',fail:'идёт предвыборная кампания'},
    {t:'Не внесён вотум недоверия',ok:!S.motion,art:'ст. 109 ч. 3',fail:'внесён вотум недоверия'},
    {t:'Против президента не ведётся импичмент',ok:!(S.imp&&S.imp.stage&&(S.imp.kind==='pres'||S.imp.kind==='you')),art:'ст. 93 ч. 4',
     fail:'идёт импичмент президента'},
    {t:'До очередных выборов больше двух кварталов',ok:left>2,art:'ст. 96',note:left<=2?'выборы и так через '+quarters(Math.max(0,left)):'',
     fail:'выборы и так через '+quarters(Math.max(0,left))},
  ];
}
function dissAllowed(){ return dissRules().every(x=>x.ok); }
/* прогноз досрочных выборов: как проголосовала бы страна сегодня */
function snapSeats(){
  const tot={}; S.parties.forEach(p=>tot[p.id]=0);
  REGIONS.forEach(r=>{ const sc={}; S.parties.forEach(p=>sc[p.id]=partyScore(p,r));
    Object.entries(dhondt(shareFrom(sc),S.regSeats[r.id])).forEach(([k,v])=>tot[k]+=v); });
  return tot;
}
function askDissolve(){
  const rules=dissRules(), ok=rules.every(x=>x.ok), mine=canDissolve(), snap=snapSeats();
  const rows=seatOrder().map(p=>{ const now=seatsOf(p.id), then=snap[p.id]||0, d=then-now;
    return `<tr><td>${emblem(p,18)}</td><td><b>${p.name}</b>${inCoal(p.id)?' <span class="tag y">коал.</span>':''}</td>
      <td class="n">${now}</td><td class="n"><b>${then}</b></td><td class="n ${d>0?'good':d<0?'bad':'dim'}">${d>0?'+':''}${d}</td></tr>`; }).join('');
  const coalThen=coalition().reduce((a,id)=>a+(snap[id]||0),0);
  const opts=[];
  if(mine&&ok)opts.push({label:'Распустить Собрание',hint:'1 действие и '+DISS_CAP+' веса · выборы в этом квартале',fn:()=>doDissolve(PL)});
  if(!mine&&S.gov.lead===PL&&CN().dissolve==='pres'&&!isPres()&&ok)
    opts.push({label:'Просить президента о роспуске',hint:'1 действие · '+S.pres.name+' решает сам',fn:askPresDissolve});
  opts.push({label:'Закрыть',hint:'',fn(){}});
  sheetOpen({eye:'Роспуск Собрания · право: '+dissHolderWord(),title:'Досрочные выборы',
    body:`<p class="lead">${mine?'Право роспуска — у вас.':'Право роспуска — у '+(CN().dissolve==='pres'?'президента ('+S.pres.name+')':CN().dissolve==='pm'?'премьер-министра':'никого')+'.'}
        Выборы проходят в том же квартале, без предвыборного штаба: считается то, что страна думает сегодня.</p>
      <div class="rules">${rules.map(x=>`<div class="${x.ok?'ok':'no'}"><s></s><b>${x.t}</b><i>${x.art}${x.note?' · '+x.note:''}</i></div>`).join('')}</div>
      <h3 class="sub">Если выборы сегодня</h3>
      ${archParty(id=>snap[id]||0,{R:200,big:SEATS,sub:'прогноз мест'})}
      <table class="tight"><thead><tr><th></th><th>Фракция</th><th class="n">Сейчас</th><th class="n">Прогноз</th><th class="n">±</th></tr></thead>
        <tbody>${rows}</tbody></table>
      <div class="res"><span>Нынешняя коалиция после выборов</span><b class="${coalThen>=MAJ?'good':'bad'}">${coalThen} из ${MAJ}</b>
        <span>Роспусков за игру</span><b>${S.snaps||0}</b></div>
      <p class="hint">Прогноз — оценка штаба без кампании. Каждый следующий роспуск избиратель принимает хуже предыдущего.</p>`,
    opts});
}
/* прежнее имя оставлено: к нему обращаются старые кнопки */
function callSnapElection(){ askDissolve(); }
function doDissolve(by){
  if(by===PL){ if(!pay({ap:1,cap:DISS_CAP},'Роспуск Собрания'))return;
    S.snaps=(S.snaps||0)+1; shiftAll(-2-S.snaps*1.5); bumpRep('firm',5); bumpRep('honest',-3);
    career('Собрание распущено досрочно.'); }
  S.motion=null; S.crisis=null;
  const who=by===PL?'Вы распустили':(CN().dissolve==='pres'?'Президент '+S.pres.name+' распустил':'Премьер распустил');
  logMsg(who+' Собрание. Досрочные выборы — в этом квартале.',1);
  chron(who+' Собрание досрочно.','');
  election();
}
function askPresDissolve(){
  if(!pay({ap:1},'Просьба о роспуске'))return;
  const snap=snapSeats(), pp=S.pres.party, gain=(snap[pp]||0)-seatsOf(pp);
  const agree=inCoal(pp)||S.presRel>62||gain>=0;
  if(agree){ logMsg('Президент согласился распустить Собрание по просьбе премьера.',1); doDissolve('pres'); return; }
  S.presRel=clamp(S.presRel-4,0,100);
  logMsg('Президент отказал в роспуске: его партия от выборов не выиграет.',1);
  sheetOpen({eye:'Роспуск',title:'Президент отказал',
    body:`<p>${S.pres.name} считает сам: «${P(pp).name}» потеряла бы ${-gain} мест. Отношения с президентом просели.</p>`,
    acts:[{label:'Закрыть'}]});
  render();
}
/* ИИ с правом роспуска распускает, когда выгодно его партии */
function dissThreat(){
  const d=CN().dissolve; let holder=null;
  if(d==='pres'&&!isPres()&&S.pres)holder=S.pres.party;
  if(d==='pm'&&S.gov.lead!==PL)holder=S.gov.lead;
  if(!holder)return null;
  const snap=snapSeats();
  return {holder,gain:(snap[holder]||0)-seatsOf(holder)};
}
function aiDissolveTick(){
  if(!dissAllowed())return;
  const t=dissThreat(); if(!t||t.gain<16)return;
  const hostile=t.holder!==S.gov.lead&&!inCoal(t.holder);
  if(Math.random()>=(hostile?0.2:0.08))return;
  sheetOpen({eye:'Роспуск Собрания',title:(CN().dissolve==='pres'?'Президент':'Премьер')+' распускает Собрание',
    body:`<p class="lead">По прогнозу «${P(t.holder).name}» прибавила бы ${t.gain} мест — и ${CN().dissolve==='pres'?'президент':'премьер'}
        решил не ждать. Выборы — в этом квартале, без кампании.</p>`,
    acts:[{label:'К выборам',fn:()=>doDissolve(t.holder)}]});
}

/* ═══ РЕГЛАМЕНТ СОБРАНИЯ ═══════════════════════════════════════════
   Палата сама пишет свои правила, и пишет простым большинством —
   без Сената и без подписи президента. Поэтому регламент правят
   чаще конституции, а спорят о нём не меньше. */
function regOn(id){ return !!(S.reg&&S.reg[id]); }
function regSupport(d,r,adopt){
  const big=seatsOf(d.party)>=70;
  let v=(big?r.big:r.small)+(d.loyal<55?r.loyal:0)+(inCoal(d.party)?r.gov:-r.gov)+noise(d.id+'reg'+r.id+S.q,12);
  if(!adopt)v=-v;
  if(d.party===PL)v=40;
  return v;
}
function regForecast(id,adopt){ const r=REGS.find(x=>x.id===id);
  return S.deputies.filter(d=>regSupport(d,r,adopt)>0).length; }
function askReg(){
  sheetOpen({eye:'Регламент Собрания · простое большинство',title:'Правила палаты',
    body:`<p class="lead">Регламент принимает одно Собрание, ${MAJ} голосов — без Сената и без подписи президента.
        Своя фракция голосует за ваше предложение, остальные — по своему интересу.</p>
      <table class="tight"><tbody>${REGS.map(r=>{ const on=regOn(r.id), f=regForecast(r.id,!on);
        return `<tr><td><b>${r.name}</b> ${on?'<span class="tag g">действует</span>':''}
          <div class="sub2">${r.art} · ${r.eff}</div></td>
          <td class="n ${f>=MAJ?'good':'bad'}">${f}/${MAJ}</td></tr>`; }).join('')}</tbody></table>`,
    opts:REGS.map(r=>{ const on=regOn(r.id);
      return {label:(on?'Отменить: ':'Ввести: ')+r.name,hint:'1 действие и '+REG_CAP+' веса · прогноз '+regForecast(r.id,!on)+' из '+MAJ,
        fn:()=>regVote(r.id)}; }).concat([{label:'Закрыть',hint:'',fn(){}}])});
}
function regVote(id){
  const r=REGS.find(x=>x.id===id), adopt=!regOn(id);
  if(!pay({ap:1,cap:REG_CAP},(adopt?'Регламент: ':'Отмена: ')+r.name))return;
  const list=S.deputies.map(d=>({d,v:regSupport(d,r,adopt)}));
  const yes=list.filter(x=>x.v>0).length, pass=yes>=MAJ;
  S.votes.unshift({no:++S.billNo,q:S.q,name:(adopt?'Регламент: ':'Отмена: ')+r.name,stance:0,yes,no:SEATS-yes,pass,house:'соб'});
  if(pass){
    S.reg=S.reg||{}; S.reg[id]=adopt;
    if(id==='whip')S.deputies.forEach(d=>d.loyal=clamp(d.loyal+(adopt?12:-12),10,99));
    if(id==='immunity'&&adopt){ bumpRep('honest',-4); shiftMood('intel',-2); shiftMood('urban',-1.5); pressAll(-2); }
    logMsg((adopt?'Введено':'Отменено')+' правило регламента: '+r.name.toLowerCase()+'.',1);
    chron('Регламент Собрания: '+(adopt?'введено':'отменено')+' «'+r.name.toLowerCase()+'».','');
  } else { addCap(-3); logMsg('Собрание не приняло правку регламента: '+r.name.toLowerCase()+'.',1); }
  sheetOpen({eye:'Регламент · '+dateLabel(),title:r.name,
    body:`<p class="lead">${r.on}</p>
      ${houseBoard(list,yes,SEATS-yes,MAJ,{what:adopt?'ввести правило':'отменить правило',
        verdict:pass?(adopt?'правило введено':'правило отменено'):'правка отклонена'})}`,
    acts:[{label:'Закрыть'}]});
  render();
}
/* правительственный час: для кабинета — отчёт, для оппозиции — действие */
function qtimeTick(){
  if(!regOn('qtime')||S.gov.lead!==PL)return;
  const going=stateOfThings();
  shiftAll(clamp((going-50)*0.04,-0.8,0.6));
}
function askQuestion(){
  if(!regOn('qtime')){ toast('Правительственного часа в регламенте нет'); return; }
  if(S.gov.lead===PL){ toast('Вопросы задаёт оппозиция'); return; }
  if(!pay({ap:1,cap:4},'Запрос правительству'))return;
  const lead=P(S.gov.lead), going=stateOfThings();
  lead.mom=clamp(lead.mom-(going<50?2.2:1),-14,14);
  me().mom=clamp((me().mom||0)+1.2,-14,14);
  bumpRep('folk',1); if(going<48)shiftAll(0.3);
  logMsg('Правительственный час: вы задали кабинету '+lead.leader+' неудобный вопрос.',1);
  toast('Вопрос прозвучал с трибуны');
  render();
}

/* ═══ ИМПИЧМЕНТ ПО СТУПЕНЯМ ═══════════════════════════════════════
   Подписи трети Собрания → специальная комиссия на квартал →
   для президента заключение Конституционного суда → обвинение
   в Собрании → суд Сената. На каждой ступени дело может
   остановиться, а обвиняемый — уйти сам. */
function impStages(i){
  const st=['sign','comm'];
  if(i.kind==='pres'||i.kind==='you')st.push('court');
  st.push('house','senate');
  return st;
}
const IMP_STAGE_NAME={sign:'Подписи',comm:'Спецкомиссия',court:'Конституционный суд',house:'Собрание',senate:'Суд Сената'};
const IMP_STAGE_SHORT={sign:'Подписи',comm:'Комиссия',court:'Суд',house:'Собрание',senate:'Сенат'};
function impStageWord(i){
  if(!i||!i.stage)return '';
  if(i.stage==='comm')return 'Спецкомиссия работает до конца '+(i.due>S.q?'следующего квартала':'квартала')+', сила дела '+Math.round(i.case)+' из 100';
  return 'Ступень: '+IMP_STAGE_NAME[i.stage].toLowerCase();
}
function impCase0(kind,who){
  let c=18;
  if(S.impReady)c+=30;
  if(kind==='pres')c+=(58-S.presRel)*0.35;
  if(kind==='min'){ const m=minOf(who.id); if(m)c+=(50-m.comp)*0.3; }
  if(kind==='judge'){ const j=S.court.find(x=>x.id===who.id); if(j)c+=axDist(j.st,me().st)*6; }
  if(kind==='you')c=15+trail()*0.6;
  c+=pressTone()*(kind==='you'?-0.3:0.4);
  return clamp(Math.round(c),0,100);
}
function impLean(d,house){
  const i=S.imp, you=i.kind==='you';
  let v;
  if(!you){ v=(d.party===PL?26:inCoal(d.party)?10:-28)+(d.rel-50)*0.3;
    if(i.who.party===d.party)v-=40; if(inCoal(i.who.party)&&d.party!==PL)v-=8; }
  else v=(d.party===PL?-40:inCoal(d.party)?-16:22)+(50-d.rel)*0.28;
  if(house==='sen'&&senRank(d)>=4)v-=6;                         // старейшина не любит отрешать
  v+=impBonus()*(house==='sen'?0.42:0.38);
  if(i.lob&&i.lob[d.party])v+=i.lob[d.party];
  v+=noise(d.id+'imp'+i.kind+(i.q||0)+house,house==='sen'?16:17);
  return v;
}
function impSigs(kind,who){
  const save=S.imp; S.imp={kind,who,q:S.q,case:impCase0(kind,who),lob:{}};
  const n=S.deputies.filter(d=>impLean(d,'low')>-12).length; S.imp=save; return n;
}
function impPath(i){
  const st=impStages(i), cur=st.indexOf(i.stage);
  return `<div class="ipath">${st.map((k,n)=>`<div class="${n<cur?'ok':n===cur?'on':''}" title="${IMP_STAGE_NAME[k]}"><u>${n+1}</u><b>${IMP_STAGE_SHORT[k]}</b></div>`).join('')}</div>`;
}
/* выбор цели и подписи */
function askImpeach(kind){
  if(S.imp&&S.imp.stage){ askImpeachStage(); return; }
  if(S.imp){ toast('Одно обвинение за раз'); return; }
  if(!kind){
    const opts=IMP_WHO.filter(w=>{
      if(w.id==='pres')return !!S.pres&&!isPres();
      if(w.id==='vp')return !!S.vp;
      if(w.id==='judge')return S.court&&S.court.length;
      if(w.id==='min')return true;
      return false;
    }).map(w=>({label:w.name,hint:w.txt,fn:()=>askImpeach(w.id)}));
    opts.push({label:'Не вносить',hint:'закрыть',fn(){}});
    sheetOpen({eye:'Импичмент',title:'Кого отрешать',
      body:`<p class="lead">Пять ступеней: подписи трети Собрания (${IMP_SIG}), специальная комиссия на квартал,
          для президента — заключение Конституционного суда, обвинение в Собрании (${impH()} из ${SEATS})
          и суд Сената (${impS()} из ${SEN_SEATS}). Проваленный импичмент укрепляет того, против кого он был.</p>
        <p class="hint">Сила дела решает всё: материалы следственной комиссии, отношения с обвиняемым, тон печати.
          В комиссии дело можно усилить — сбором доказательств и открытыми слушаниями.</p>`,
      opts});
    return;
  }
  let who=null;
  if(kind==='pres')who={name:S.pres.name,party:S.pres.party};
  if(kind==='vp')who={name:S.vp.name,party:S.vp.party};
  if(kind==='judge'){ const j=S.court.slice().sort((a,b)=>axDist(b.st,me().st)-axDist(a.st,me().st))[0];
    who={name:j.name,party:j.by,id:j.id}; }
  if(kind==='min'){ const p=pick(POSTS), m=minOf(p.id); if(!m){toast('Кабинет пуст');return;}
    who={name:m.name,party:m.party,id:p.id}; }
  if(!who){toast('Некого отрешать');return;}
  const sig=impSigs(kind,who), c0=impCase0(kind,who);
  sheetOpen({eye:'Импичмент · ступень 1 · подписи',title:'Обвинение: '+who.name,
    body:`${impPath({kind,stage:'sign'})}
      <div class="res"><span>Подписи</span><b class="${sig>=IMP_SIG?'good':'bad'}">${sig} из ${IMP_SIG}</b>
        <span>Сила дела на старте</span><b>${c0} из 100</b>
        <span>Материалы комиссии</span><b class="w">${S.impReady?'на руках':'нет'}</b>
        <span>Цена</span><b>1 действие и ${IMP_CAP} веса</b></div>
      <p class="hint">${sig>=IMP_SIG?'Подписей хватит: обвинение уйдёт в специальную комиссию на квартал.':'Подписей не хватит — внесение провалится сразу и ударит по весу.'}</p>`,
    opts:[{label:'Вносить обвинение',hint:sig>=IMP_SIG?'в комиссию':'подписей мало',fn:()=>impFile(kind,who,sig,c0)},
      {label:'Не вносить',hint:'',fn(){}}]});
}
function impFile(kind,who,sig,c0){
  if(!pay({ap:1,cap:IMP_CAP},'Импичмент: '+who.name))return;
  if(sig<IMP_SIG){ addCap(-4); logMsg('Обвинение против '+who.name+' не внесено: '+sig+' подписей из '+IMP_SIG+'.',1);
    sheetOpen({eye:'Импичмент',title:'Подписей не хватило',body:`<p>${sig} из ${IMP_SIG}. Треть Собрания за обвинение не подписалась.</p>`,
      acts:[{label:'Закрыть'}]}); render(); return; }
  // комиссия работает остаток этого квартала и весь следующий
  S.imp={kind,who,q:S.q,by:PL,ready:!!S.impReady,stage:'comm',case:c0,due:S.q+IMP_LEN,sig,lob:{}};
  S.impReady=false;
  logMsg('Внесено обвинение против '+who.name+': '+sig+' подписей. Работает специальная комиссия.',1);
  chron('Внесён импичмент: '+who.name+'.','');
  askImpeachStage();
}
/* лист идущего импичмента */
function askImpeachStage(){
  const i=S.imp; if(!i||!i.stage){ askImpeach(); return; }
  const you=i.kind==='you', opts=[];
  if(i.stage==='comm'&&!you){
    opts.push({label:'Собирать доказательства',hint:'1 действие и '+IMP_EVID+' веса · дело +9…17, след +2',fn(){
      if(!pay({ap:1,cap:IMP_EVID},'Импичмент: доказательства'))return;
      i.case=clamp(i.case+ri(9,17),0,100); addTrail(2,'сбор материалов на '+i.who.name);
      logMsg('Комиссия получила новые материалы по делу '+i.who.name+'.'); askImpeachStage(); }});
    opts.push({label:'Открытые слушания',hint:'1 действие · дело растёт сильнее, если печать на вашей стороне',fn(){
      if(!pay({ap:1},'Импичмент: открытые слушания'))return;
      const g=pressTone()>0?ri(7,13):ri(2,7); i.case=clamp(i.case+g,0,100); pressAll(pressTone()>0?1:-1);
      logMsg('Открытые слушания по делу '+i.who.name+': дело +'+g+'.'); askImpeachStage(); }});
    opts.push({label:'Отозвать обвинение',hint:'вес −6',fn(){ S.imp=null; addCap(-6);
      logMsg('Обвинение против '+i.who.name+' отозвано.',1); render(); }});
  }
  if(i.stage==='comm'&&you){
    opts.push({label:'Защищаться в комиссии',hint:'1 действие и 5 веса · дело −8…15',fn(){
      if(!pay({ap:1,cap:5},'Защита в комиссии'))return;
      i.case=clamp(i.case-ri(8,15),0,100); logMsg('Вы дали показания комиссии: дело ослабло.'); askImpeachStage(); }});
    opts.push({label:'Сделка с фракцией',hint:'1 действие и 10 веса · её депутаты не проголосуют за отрешение',fn(){
      sheetOpen({eye:'Импичмент · защита',title:'С кем договариваться',
        opts:S.parties.filter(p=>p.id!==PL&&p.id!==i.by).map(p=>({label:p.name,hint:mandates(seatsOf(p.id)),fn(){
          if(!pay({ap:1,cap:10},'Сделка с «'+p.name+'» против импичмента'))return;
          i.lob[p.id]=(i.lob[p.id]||0)-22; addTrail(4,'сделка с «'+p.name+'»');
          logMsg('«'+p.name+'» пообещала не голосовать за ваше отрешение.',1); askImpeachStage(); }}))}); }});
    opts.push({label:'Уйти в отставку',hint:'президентство сдаётся вице-президенту, дело закрыто',fn:impResignYou});
  }
  opts.push({label:'Закрыть',hint:'',fn(){}});
  sheetOpen({eye:'Импичмент · '+IMP_STAGE_NAME[i.stage].toLowerCase(),title:(you?'Обвинение против вас':'Обвинение: '+i.who.name),
    body:`${impPath(i)}
      <div class="res"><span>Сила дела</span><b class="${i.case>=55?(you?'bad':'good'):i.case<35?(you?'good':'bad'):'warn'}">${Math.round(i.case)} из 100</b>
        <span>Выводы комиссии</span><b>${i.due>S.q?'в конце следующего квартала':'в конце квартала'}</b>
        <span>Инициатор</span><b class="w">${P(i.by).name}</b></div>
      ${bar([[i.case,i.case>=55?(you?'var(--bad)':'var(--good)'):i.case<35?(you?'var(--good)':'var(--ink-3)'):'var(--ink-2)']],10)}
      <p class="hint">Выше 55 — комиссия находит признаки, и палаты голосуют охотнее. Ниже 35 — «оснований нет»,
        и обвинение почти наверняка провалится.</p>`,
    opts});
}
/* конец квартала: выводы комиссии и дальше по ступеням */
function impTick(){
  const i=S.imp; if(!i||i.stage!=='comm'||S.q<=i.due)return;
  const c=Math.round(i.case), word=c>=55?'признаки подтверждены':c>=35?'выводы спорные':'оснований не найдено';
  const you=i.kind==='you';
  logMsg('Специальная комиссия по делу '+i.who.name+': '+word+' ('+c+' из 100).',1);
  if(you){
    if(c<35){ S.imp=null; addCap(8); bumpRep('firm',4);
      sheetOpen({eye:'Импичмент',title:'Комиссия не нашла оснований',
        body:'<p>Сила дела '+c+' из 100. Оппозиция отозвала обвинение: вы вышли из этого сильнее.</p>',acts:[{label:'Выдохнуть'}]});
      return; }
    sheetOpen({eye:'Импичмент · выводы комиссии',title:'Комиссия: '+word,
      body:`${impPath(i)}<p class="lead">Сила дела ${c} из 100. Обвинение идёт дальше — в Конституционный суд.</p>`,
      acts:[{label:'Дальше',fn:impNext},{label:'Уйти в отставку до суда',fn:impResignYou}]});
    return;
  }
  sheetOpen({eye:'Импичмент · выводы комиссии',title:'Комиссия: '+word,
    body:`${impPath(i)}<p class="lead">Сила дела ${c} из 100.</p>
      <p class="hint">${c>=55?'С такими выводами палаты голосуют охотнее.':c>=35?'Выводы спорные: обвинение может пройти, а может укрепить обвиняемого.':'Без оснований обвинение почти наверняка провалится. Отозвать его сейчас дешевле.'}</p>`,
    opts:[{label:'Выносить дальше',hint:i.kind==='pres'?'в Конституционный суд':'на голосование Собрания',fn:impNext},
      {label:'Отозвать обвинение',hint:'вес −6',fn(){ S.imp=null; addCap(-6); logMsg('Обвинение отозвано после выводов комиссии.',1); render(); }}]});
}
function impNext(){
  const i=S.imp; if(!i)return;
  const st=impStages(i), n=st.indexOf(i.stage);
  i.stage=st[n+1];
  if(i.stage==='court')impCourt();
  else if(i.stage==='house')impeachHouse();
  else if(i.stage==='senate')impeachSenate();
}
/* заключение суда: соблюдён ли порядок и есть ли признаки */
function impCourt(){
  const i=S.imp; let n=0; const votes=[];
  S.court.forEach(j=>{ let v=(i.case-45)*0.6+courtFree()*4+noise(j.id+'impc'+i.q,10);
    if(j.by===i.who.party)v-=12;
    if(i.kind==='you'&&j.by===PL)v-=10;
    votes.push(v>0); if(v>0)n++; });
  const pass=n>=courtMaj();
  sheetOpen({eye:'Импичмент · Конституционный суд',title:pass?'Суд: признаки есть':'Суд: оснований нет',
    body:`${impPath(i)}
      <div class="court">${votes.map(v=>`<s class="${v?'y':'n'}"></s>`).join('')}</div>
      <div class="res"><span>За наличие признаков</span><b class="${pass?'good':'bad'}">${n} из ${courtN()}</b>
        <span>Нужно</span><b>${courtMaj()}</b></div>
      <p class="hint">Суд не решает, виновен ли ${i.kind==='you'?'президент':i.who.name}: он решает, можно ли его судить.</p>`,
    acts:[{label:pass?'В Собрание':'Дальше',fn(){ if(pass)impNext(); else i.kind==='you'?impYouSaved():impFail(false); }}]});
  render();
}
function impeachHouse(){
  const i=S.imp, k=IMP_WHO.find(w=>w.id===i.kind)||{name:'Президент',txt:''};
  if(!i.stage)i.stage='house';
  const list=S.deputies.map(d=>({d,v:impLean(d,'low')}));
  const yes=list.filter(x=>x.v>0).length, pass=yes>=impH();
  S.votes.unshift({no:++S.billNo,q:S.q,name:'Импичмент: '+i.who.name,stance:0,yes,no:SEATS-yes,pass,house:'соб'});
  const you=i.kind==='you';
  sheetOpen({eye:'Импичмент · обвинение в Собрании',title:(you?'Обвинение против вас':'Импичмент: '+i.who.name),
    body:`${impPath(i)}<p class="lead">${you?'Собрание голосует не о законе — о вас.':k.name+'. '+k.txt}</p>
      ${houseBoard(list,yes,SEATS-yes,impH(),{what:'об обвинении',verdict:pass?'обвинение выдвинуто':'обвинение отклонено'})}
      <div class="res"><span>Сила дела</span><b>${Math.round(i.case===undefined?(i.ready?60:30):i.case)} из 100</b>
        <span>Тон печати</span><b>${pressWord(pressTone())}</b></div>`,
    acts:you?[{label:pass?'В Сенат':'Выдохнуть',fn(){ pass?impNext():impYouSaved(); }},
              ...(pass?[{label:'Уйти в отставку до суда',fn:impResignYou}]:[])]
      :[{label:pass?'В Сенат, на суд':'Закрыть',fn(){
        if(!pass){ impFail(false); return; }
        // обвиняемый может не дожидаться суда
        if((i.case>=70||yes>=impH()+45)&&Math.random()<0.45){ impResignAI(); return; }
        if(i.stage==='house')i.stage='senate';
        impeachSenate(); }}]});
  render();
}
function impeachSenate(){
  const i=S.imp; i.stage='senate';
  const judged=S.senate.map(s=>({d:s,v:impLean(s,'sen')}));
  const yes=judged.filter(x=>x.v>0).length, pass=yes>=impS();
  S.votes.unshift({no:++S.billNo,q:S.q,name:'Отрешение: '+i.who.name,stance:0,yes,no:SEN_SEATS-yes,pass,house:'сен'});
  const you=i.kind==='you';
  sheetOpen({eye:'Импичмент · суд Сената',title:(you?'Суд над вами':'Отрешение: '+i.who.name),
    body:`${impPath(i)}<p class="lead">Сенат заседает как суд. Председательствует старейшина палаты —
        и голосуют не за политику, а за то, оставлять ли человека в кресле.</p>
      ${senBoard(judged,yes,SEN_SEATS-yes,impS(),{house:'Сенат · суд',what:'об отрешении',
        verdict:pass?'отрешён от должности':'оправдан'})}`,
    acts:[{label:'Дальше',fn(){ if(you){ pass?impYouOut():impYouSaved(); } else pass?impDone():impFail(true); }}]});
  render();
}
function impResignAI(){
  const i=S.imp;
  logMsg(i.who.name+' подал в отставку, не дожидаясь суда Сената.',1);
  sheetOpen({eye:'Импичмент',title:i.who.name+' уходит сам',
    body:`<p class="lead">Обвинение выдвинуто подавляющим большинством, и ${i.who.name} решил не ждать суда Сената:
        отставка вместо отрешения.</p>`,
    acts:[{label:'Дальше',fn(){ impDone(true); }}]});
}
function impYouSaved(){ S.imp=null; addCap(12); bumpRep('firm',8); shiftAll(2);
  logMsg('Импичмент против вас провалился.',1); chron('Импичмент против вас провалился.','g'); render(); }
function impYouOut(){
  S.imp=null;
  const vpn=S.vp?S.vp.name:depName();
  closeReign('pres','импичмент');
  S.pres={party:S.pres.party,name:vpn,since:S.q,until:S.pres.until,term:S.pres.term,vetoes:0,decrees:0,succeeded:true};
  openReign('pres',S.pres.name,S.pres.party);
  setSeat(hasMandate()?'dep':'none','Отрешение от должности президента.');
  addCap(-24); shiftAll(-5); bumpRep('honest',-8);
  chron('Вас отрешили от президентства.','b'); render();
}
function impResignYou(){
  S.imp=null;
  const vpn=S.vp?S.vp.name:depName();
  closeReign('pres','отставка');
  S.pres={party:S.pres.party,name:vpn,since:S.q,until:S.pres.until,term:S.pres.term,vetoes:0,decrees:0,succeeded:true};
  openReign('pres',S.pres.name,S.pres.party);
  setSeat(hasMandate()?'dep':'none','Отставка с поста президента под угрозой импичмента.');
  addCap(-10); shiftAll(-2); bumpRep('honest',-3);
  logMsg('Вы подали в отставку с поста президента, не дожидаясь суда.',1);
  chron('Президент ушёл в отставку под угрозой импичмента.','b'); render();
}
/* обвинение против игрока-президента: этого не выбирают, но теперь есть время защищаться */
function impAgainstYou(){
  if(S.imp||!isPres())return;
  const opp=S.parties.filter(p=>p.id!==PL&&!inCoal(p.id)).sort(bySeats)[0];
  if(!opp)return;
  const hostile=SEATS-coalSeats();
  const risk=(hostile>impH()?0.02:0.004)+(S.trail||0)*0.0012+(approval()<36?0.015:0);
  if(Math.random()>=risk)return;
  const who={name:S.you.name,party:PL};
  const sig=impSigs('you',who); if(sig<IMP_SIG)return;
  S.imp={kind:'you',who,q:S.q,by:opp.id,stage:'comm',case:impCase0('you',who),due:S.q+IMP_LEN,sig,lob:{}};
  logMsg('«'+opp.name+'» внесла обвинение против вас: '+sig+' подписей. Работает специальная комиссия.',1);
  chron('Против вас внесён импичмент.','b');
  sheetOpen({eye:'Импичмент',title:'Обвинение против вас',
    body:`${impPath(S.imp)}<p class="lead">«${opp.name}» собрала ${sig} подписей. Специальная комиссия работает
        до конца следующего квартала — это время на защиту.</p>
      <div class="res"><span>Сила дела</span><b class="${S.imp.case>=55?'bad':''}">${S.imp.case} из 100</b>
        <span>След за вами</span><b class="${(S.trail||0)>50?'bad':''}">${Math.round(S.trail||0)}</b></div>`,
    acts:[{label:'К защите',fn:askImpeachStage},{label:'Позже'}]});
}

