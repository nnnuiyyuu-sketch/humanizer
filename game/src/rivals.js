
/* ════════════════════════════════════════════════════════════════
   СОПЕРНИКИ
   Партии ИИ не только реагируют — они договариваются между собой,
   собираются в блок против вашего кабинета, раскалываются, меняют
   лидеров после скандалов и ведут свои кампании с темой и деньгами.
   ════════════════════════════════════════════════════════════════ */

const SPLIT_NAMES=['Новая левая','Обновление','Честный выбор','Правое дело','Гражданская платформа','Народный фронт',
  'Партия регионов','Новое поколение','Справедливость','Союз центра','Движение «Вперёд»','Наш дом'];
const SPLIT_COLORS=['#8A4B2A','#3F5F7A','#6B4A1E','#556B2F','#7A3B5E','#2F6B5A','#8C6A1A'];
const PARTY_MAX=8;

/* ─── блок против кабинета ──────────────────────────────────────────
   Когда кабинет слабеет, близкие по курсу оппозиционные фракции
   договариваются голосовать вместе: против ваших законов, бюджета
   и за вотум. Сделка с одним из них может расколоть блок. */
function blocOn(){ return !!(S.bloc&&S.bloc.members&&S.bloc.members.length>=2&&isPM()); }
function inBloc(pid){ return blocOn()&&S.bloc.members.indexOf(pid)>=0; }
function blocSeats(){ return blocOn()?S.bloc.members.reduce((a,id)=>a+seatsOf(id),0):0; }
function blocTick(){
  if(!isPM()){ S.bloc=null; return; }
  if(S.bloc){
    S.bloc.members=S.bloc.members.filter(id=>P(id)&&!inCoal(id));
    if(S.bloc.members.length<2||S.q>=S.bloc.until){ logMsg('Оппозиционный блок распался.',1); S.bloc=null; }
    return;
  }
  const weak=approval()<50||coalSeats()<MAJ+8;
  if(!weak||Math.random()>0.16)return;
  const opp=S.parties.filter(p=>p.id!==PL&&!inCoal(p.id)&&seatsOf(p.id)>0).sort(bySeats);
  if(opp.length<2)return;
  const core=opp[0];
  const members=opp.filter(p=>p.id===core.id||axDist(p.st,core.st)<1.7).map(p=>p.id);
  if(members.length<2)return;
  S.bloc={members,since:S.q,until:S.q+8,lead:core.id};
  logMsg('Оппозиция собралась в блок против кабинета: '+members.map(id=>P(id).short).join(', ')+' — '+blocSeats()+' мандатов.',1);
  chron('Оппозиционный блок: '+members.map(id=>P(id).short).join(', ')+'.','b');
  sheetOpen({eye:'Собрание · '+dateLabel(),title:'Против вас — блок',
    body:`<p class="lead">${core.leader} («${core.name}») договорился с соседями по оппозиции: на ${quarters(8)} они
        голосуют вместе — против ваших законов и бюджета, за вотум недоверия.</p>
      <div class="res"><span>В блоке</span><b class="w">${members.map(id=>P(id).name).join(', ')}</b>
        <span>Мандатов</span><b class="bad">${blocSeats()} из ${SEATS}</b>
        <span>У коалиции</span><b>${coalSeats()}</b></div>
      <p class="hint">Блок держится на общей выгоде. Сделка с одной из его фракций может его расколоть.</p>`,
    acts:[{label:'К фракциям',fn:()=>goTab('fac')},{label:'Понятно'}]});
}
/* сделка с членом блока — шанс его расколоть */
function blocDealBreak(pid){
  if(!inBloc(pid)||Math.random()>=0.45)return;
  S.bloc.members=S.bloc.members.filter(id=>id!==pid);
  logMsg('«'+P(pid).name+'» вышла из оппозиционного блока после сделки с вами.',1);
  chron('Раскол оппозиционного блока: «'+P(pid).short+'» ушла.','g');
  if(S.bloc.members.length<2){ S.bloc=null; logMsg('Блок распался.',1); }
}

/* ─── сделки соперников между собой ────────────────────────────────
   Чужой кабинет тоже покупает голоса: зовёт соседей за портфели. */
function aiDealTick(){
  if(isPM()||S.crisis||Math.random()>0.12)return;
  const lead=P(S.gov.lead); if(!lead)return;
  if(coalSeats()>=MAJ+15)return;
  const cand=S.parties.filter(p=>p.id!==PL&&!inCoal(p.id)&&seatsOf(p.id)>0&&axDist(p.st,lead.st)<1.9)
    .sort((a,b)=>axDist(a.st,lead.st)-axDist(b.st,lead.st))[0];
  if(!cand)return;
  S.gov.coal.push(cand.id); givePosts(cand.id,Math.max(1,partyPrice(cand.id)-1)); syncCabinet();
  logMsg('«'+cand.name+'» вошла в правительство '+lead.leader+' за портфель. У кабинета '+coalSeats()+' из '+MAJ+'.',1);
  chron('«'+cand.short+'» усилила кабинет '+lead.leader+'.','');
}

/* ─── раскол ────────────────────────────────────────────────────────
   Крупная партия в затяжном провале или в скандале может выпустить
   фракцию: депутаты с краю её линии уходят и регистрируют новую. */
function splitParty(pid){
  const p=P(pid); if(!p||S.parties.length>=PARTY_MAX)return null;
  const deps=S.deputies.filter(d=>d.party===pid); if(deps.length<30)return null;
  // ось, по которой фракция расходится сильнее всего
  const spread=ax=>{ const m=deps.reduce((a,d)=>a+d.st[ax],0)/deps.length; return deps.reduce((a,d)=>a+Math.abs(d.st[ax]-m),0); };
  const ax=AX.slice().sort((a,b)=>spread(b)-spread(a))[0];
  const left=deps.filter(d=>d.st[ax]<p.st[ax]-0.25), right=deps.filter(d=>d.st[ax]>p.st[ax]+0.25);
  const side=left.length>=right.length?-1:1, pool=(side<0?left:right).sort((a,b)=>a.loyal-b.loyal);
  const n=Math.max(8,Math.min(Math.round(deps.length*0.32),pool.length)); if(pool.length<8)return null;
  const goers=pool.slice(0,n);
  const used=S.parties.map(x=>x.name), name=SPLIT_NAMES.filter(x=>used.indexOf(x)<0);
  if(!name.length)return null;
  const nm=pick(name), id='n'+(S.newNo=(S.newNo||0)+1);
  const colors=SPLIT_COLORS.filter(c=>!S.parties.some(x=>x.color===c));
  const st={...p.st}; st[ax]=clamp(r1(p.st[ax]+side*0.9),-2,2);
  const st0={...st};
  const leader=goers[0].name;
  const words=nm.replace(/[«»"]/g,'').split(/\s+/);
  const np={id,name:nm,short:(words.length>1?words.map(w=>w[0]).join(''):words[0].slice(0,3)).toUpperCase().slice(0,3),
    color:colors[0]||'#6B6B6B',leader,st,st0,base:[],funds:30,mom:3,split:pid,born:S.q};
  np.emb={...embFor(np)};
  S.parties.push(np);
  goers.forEach(d=>{ d.party=id; d.loyal=clamp(d.loyal+15,0,100); d.note='ушёл в «'+nm+'»'; });
  S.seats[pid]-=goers.length; S.seats[id]=goers.length;
  // сенаторы с того же края линии идут следом
  const sens=S.senate.filter(s=>s.party===pid&&!s.you&&(side<0?s.st[ax]<p.st[ax]:s.st[ax]>p.st[ax])).slice(0,Math.round(senSeatsOf(pid)*0.3));
  sens.forEach(s=>{ s.party=id; });
  S.senSeats[pid]-=sens.length; S.senSeats[id]=sens.length;
  if(inCoal(pid)&&S.gov.lead!==pid){ /* новая фракция в кабинет не входит */ }
  AX.forEach(a=>commMembersFix(a));
  flSync();
  p.mom=r1((p.mom||0)-3);
  logMsg('Раскол «'+p.name+'»: '+goers.length+' депутатов и '+sens.length+' сенаторов ушли в новую партию «'+nm+'» ('+leader+').',1);
  chron('Раскол «'+p.short+'»: родилась «'+nm+'».','');
  return np;
}
function splitTick(){
  // новая партия, не прошедшая ни в одну палату, распускается
  S.parties.filter(p=>p.split&&!seatsOf(p.id)&&!senSeatsOf(p.id)&&!inCoal(p.id)&&S.q-p.born>2
      &&!(S.deals||[]).some(d=>d.pid===p.id)&&!S.laws.some(l=>l.by===p.id)).forEach(p=>{
    S.parties.splice(S.parties.indexOf(p),1);
    logMsg('«'+p.name+'» не прошла ни в одну палату и распущена.',1);
  });
  const cool=S.q-(S.lastSplit||-99)<6;
  S.parties.filter(p=>p.id!==PL).forEach(p=>{
    const now=seatsOf(p.id), was=p.seat0==null?now:p.seat0; p.seat0=now;
    if(cool||S.parties.length>=PARTY_MAX||now<50)return;
    const heat=(typeof scLive==='function'?scLive():[]).filter(x=>x.who===p.id).reduce((a,x)=>a+x.heat,0);
    // крупная фракция трещит и без повода; провал, скандал и поражение на выборах ускоряют
    const pressure=(now>=70?0.004:0)+(p.bad||0)*0.05+(heat>=55?0.06:0)+((p.mom||0)<-6?0.03:0)+(was-now>=15?0.2:0);
    if(Math.random()<pressure){
      const np=splitParty(p.id);
      if(np)S.lastSplit=S.q;
      if(np)sheetOpen({eye:'Партии · '+dateLabel(),title:'Раскол «'+p.name+'»',
        body:`<p class="lead">${np.leader} увёл ${mandates(seatsOf(np.id))} из «${p.name}» и зарегистрировал «${np.name}».
            ${inCoal(p.id)?'Кабинет теряет голоса без всякого вотума.':'В зале стало на одну фракцию больше — и на одного лидера для сделок.'}</p>
          <div class="res"><span>Новая фракция</span><b class="w">${np.name} · ${np.short}</b>
            <span>Лидер</span><b class="w">${np.leader}</b>
            <span>Мест</span><b>${seatsOf(np.id)} · ${senSeatsOf(np.id)} в Сенате</b></div>`,
        acts:[{label:'К фракциям',fn:()=>goTab('fac')},{label:'Понятно'}]});
    }
  });
}

/* ─── лидер уходит после скандала ───────────────────────────────── */
function leaderScandalTick(){
  (typeof scLive==='function'?scLive():[]).filter(x=>x.who!=='you'&&x.heat>=55).forEach(x=>{
    const p=P(x.who); if(!p||Math.random()>0.2)return;
    const old=p.leader;
    p.leader=(Math.random()<0.4?pick(NAME_F)+' '+pick(SURN_F):pick(NAME_M)+' '+pick(SURN_M));
    p.mom=r1((p.mom||0)+2); x.heat=Math.max(0,x.heat-25);
    logMsg(old+' ушёл с поста лидера «'+p.name+'» после скандала. Новый лидер — '+p.leader+'.',1);
    chron('«'+p.short+'» сменила лидера после скандала.','');
    flSync();
  });
}

/* ─── кампании соперников ───────────────────────────────────────────
   Каждая партия в кампании выбирает тему — ось, где страна ближе
   всего к ней, — и тратит кассу. Тема и траты видны в гонке. */
function rivalCampTick(){
  S.parties.forEach(p=>{ if(p.id!==PL)p.funds=r1((p.funds||0)+4+seatsOf(p.id)*0.06); });
  if(!S.camp)return;
  S.camp.themes=S.camp.themes||{};
  const pop=popularStance();
  S.parties.filter(p=>p.id!==PL).forEach(p=>{
    const ax=AX.slice().sort((a,b)=>Math.abs(p.st[a]-pop[a])-Math.abs(p.st[b]-pop[b]))[0];
    const spend=Math.min(p.funds||0,ri(10,26));
    p.funds=r1((p.funds||0)-spend);
    p.mom=clamp(r1((p.mom||0)+spend*0.06),-14,14);
    const t=S.camp.themes[p.id]||{ax,spent:0}; t.ax=ax; t.spent=r1(t.spent+spend); S.camp.themes[p.id]=t;
  });
}

function rivalsTick(){ blocTick(); aiDealTick(); splitTick(); leaderScandalTick(); rivalCampTick(); }
