/* ════════════════════════════════════════════════════════════════
   ФРАКЦИИ, СДЕЛКИ, КОМИТЕТЫ, ПОВЕСТКА СЕНАТА
   Палата голосует не партиями, а людьми, но людей ведут лидеры.
   Здесь у каждой фракции два лица — в Собрании и в Сенате, — и с
   каждым можно договориться: о законе, о поправке, о бюджете, о
   вотуме. Цена зависит от характера, расстояния по курсу и того,
   держали ли вы слово раньше.
   ════════════════════════════════════════════════════════════════ */

/* ─── лидеры ────────────────────────────────────────────────────── */
function flBase(pid){
  const p=P(pid);
  return clamp(62-axDist(p.st,me().st)*12+(inCoal(pid)&&inCoal(PL)?10:0),8,92);
}
function flNew(name,pid,extra){
  return {name, trait:pick(FL_TRAITS).id, rel:Math.round(flBase(pid)+rnd(-8,8)), trust:60, since:S.q, owe:0, ...(extra||{})};
}
/* лидер сенаторов — живой сенатор фракции, старший по стажу */
function flSenPick(pid){
  return S.senate.filter(s=>s.party===pid&&!s.you)
    .sort((a,b)=>senRank(b)-senRank(a)||b.loyal-a.loyal||a.id.localeCompare(b.id))[0]||null;
}
function flSync(){
  if(!S.fl)S.fl={};
  S.parties.forEach(p=>{
    const f=S.fl[p.id]||(S.fl[p.id]={h:null,s:null});
    const hn=p.id===PL?(chief()?S.you.name:me().leader):p.leader;
    if(!f.h||f.h.name!==hn)f.h=flNew(hn,p.id);
    const rec=f.s&&S.senate.find(x=>x.id===f.s.id);
    if(!rec||rec.party!==p.id){
      const sp=flSenPick(p.id);
      f.s=sp?flNew(sp.name,p.id,{id:sp.id}):null;
    } else f.s.name=rec.name;
  });
}
function flLeader(pid,house){ flSync(); const f=S.fl[pid]; return f?(house==='s'?f.s:f.h):null; }
function flSeats(pid,house){ return house==='s'?senSeatsOf(pid):seatsOf(pid); }
function flWord(v){ return v>=66?'союзник':v>=52?'открыт':v>=38?'холоден':v>=24?'враждебен':'не разговаривает'; }

/* ─── сделки ────────────────────────────────────────────────────────
   Предмет сделки — ключ: закон по теме и направлению, поправка,
   бюджет или вотум. Пока сделка жива, линия фракции по этому
   предмету — ваша, и лидер держит своих с силой своего характера. */
function subjKey(sb){
  if(sb.k==='b')return 'b:'+sb.topic+':'+Math.sign(sb.stance||1);
  if(sb.k==='c')return 'c:'+sb.id;
  return sb.k;
}
function subjName(sb){
  if(sb.k==='b')return '«'+T(sb.topic).name+'» — '+(sb.stance<0?T(sb.topic).l:T(sb.topic).r);
  if(sb.k==='c')return 'поправка «'+cnAny(sb.id).name+'»';
  if(sb.k==='budget')return 'бюджет на '+budgetYear()+' год';
  if(sb.k==='m')return S.motion&&S.motion.against===PL?'вотум против вашего кабинета':'вотум недоверия кабинету';
  return 'предмет';
}
function dealsLive(){ return (S.deals||[]).filter(d=>!d.gone&&S.q<=d.due); }
function dealFor(pid,house,key){ return dealsLive().find(d=>d.pid===pid&&d.house===house&&d.key===key)||null; }
/* насколько сделка держит фракцию: слово лидера и его хватка */
function dealGrip(d){ const t=FT(d.trait); return (d.renege?0.3:1)*t.whip; }
/* линия фракции по закону, если о нём договорились */
function dealBillLine(pid,house,bill){
  const d=dealFor(pid,house,'b:'+bill.topic+':'+Math.sign(bill.stance||1));
  return d&&(bill.by||PL)===PL?d:null;
}
/* что просит лидер за поддержку: null — не пойдёт ни за что */
function dealDemand(pid,house,sb){
  const L=flLeader(pid,house); if(!L)return null;
  const t=FT(L.trait), p=P(pid);
  let base=12, far=0;
  if(sb.k==='b'){ const tp=T(sb.topic); far=Math.abs((p.st[tp.ax]||0)-sb.stance); base=11+far*9*t.ideo;
    // дальше двух делений депутат не пойдёт и за лидером: сделка ничего бы не дала
    if(far>1.8&&t.id==='ideo')return null; if(far>2.2)return null; }
  if(sb.k==='c'){ const c=cnAny(sb.id); base=17+Math.max(0,-cnCost(c))*0.9-(c.self>0?7:0); if(t.id==='ideo')base+=6; }
  if(sb.k==='budget'){ const bs=budgetStance(); far=(Math.abs(p.st.tax-bs.tax)+Math.abs(p.st.econ-bs.econ))/2;
    base=12+far*8*t.ideo;
    const a=bAsk(pid); if(a)base+=bAskMet(a)?-8:6; }            // строка фракции в проекте
  if(sb.k==='m'){ base=S.motion&&S.motion.against===PL?16+(inCoal(pid)?-6:axDist(p.st,me().st)*6):14; }
  base*=t.price;
  base*=0.7+flSeats(pid,house)/(house==='s'?SEN_SEATS:SEATS)*2.2;      // крупная фракция стоит дороже
  if(house==='s')base*=0.75;
  base+=inCoal(pid)&&inCoal(PL)?-5:4;
  base-=(L.rel-50)*0.25+(L.trust-50)*0.15;
  if(L.owe)base-=10;                                                      // за ними должок
  // вице, занятый Сенатом, договаривается с сенаторами сам
  if(house==='s'&&S.vp&&(S.vp.party===PL||inCoal(S.vp.party)&&inCoal(PL))&&S.vp.job==='senate')base-=vpSkill()*0.1;
  return Math.max(3,Math.round(base));
}
/* чем игрок может заплатить сейчас: не всякая плата доступна всякому креслу */
function dealPays(pid,house){
  const L=flLeader(pid,house), t=FT(L.trait), out=[];
  DEAL_PAY.forEach(x=>{
    let ok=true, why='';
    if(x.id==='post'&&!isPM()){ ok=false; why='портфели раздаёт премьер'; }
    if(x.id==='post'&&isPM()&&!POSTS.some(p=>S.gov.posts[p.id]===PL)){ ok=false; why='своих портфелей не осталось'; }
    if(x.id==='chair'&&!isPM()&&!(inCoal(PL)&&chief())){ ok=false; why='комитеты делит большинство'; }
    if(x.id==='money'&&!(isPM()||isPres())){ ok=false; why='казной распоряжается кабинет'; }
    if(x.id==='money'&&S.treasury<x.gold){ ok=false; why='в казне нет '+x.gold+' млрд'; }
    if(x.id==='course'&&!chief()){ ok=false; why='курс меняет лидер партии'; }
    if(x.id==='cash'&&S.funds<x.funds){ ok=false; why='в кассе нет '+x.funds+' млн'; }
    if(x.id==='cash'&&hasTrait('clean')){ ok=false; why='незапятнанный конвертов не носит'; }
    let v=x.v;
    if(t.likes===x.id)v=Math.round(v*1.4);
    if(x.id==='favor')v=Math.round(Math.max(0,(L.rel-42)*0.8+(L.trust-50)*0.3));
    if(x.id==='cash'&&t.id==='ideo')v=Math.round(v*0.4);
    out.push({...x,v,ok,why});
  });
  return out;
}
function dealChance(dem,v){ return dem===null?0:clamp(0.5+(v-dem)*0.035,0.03,0.95); }
/* переговорный раунд по предмету: ход один раз в квартал, дальше — вес */
function dealRoundPaid(key){ return S.dealRound&&S.dealRound[key]===S.q; }
function askDeals(sb){
  flSync();
  const key=subjKey(sb), fc=subjForecast(sb);
  const rows=[];
  S.parties.filter(p=>p.id!==PL).forEach(p=>['h','s'].forEach(h=>{
    const L=flLeader(p.id,h); if(!L||!flSeats(p.id,h))return;
    const d=dealFor(p.id,h,key), dem=dealDemand(p.id,h,sb);
    rows.push({p,h,L,d,dem});
  }));
  const tr=rows.map(r=>`<tr class="${r.d?'mine':''}"><td>${emblem(r.p,18)}</td>
      <td><b>${r.L.name}</b><div class="sub2">${r.h==='s'?'сенаторы':'Собрание'} «${r.p.short}» · ${FT(r.L.trait).name.toLowerCase()} · ${flWord(r.L.rel)}</div></td>
      <td class="n">${flSeats(r.p.id,r.h)}</td>
      <td class="n ${r.d?'good':r.dem===null?'bad':''}">${r.d?'✓':r.dem===null?'нет':r.dem}</td></tr>`).join('');
  const paid=dealRoundPaid(key);
  sheetOpen({eye:'Переговоры · '+dateLabel(),title:subjName(sb),
    body:`<div class="res" style="margin-top:0">${fc}</div>
      <table class="tight"><thead><tr><th></th><th>Лидер</th><th class="n">Голосов</th><th class="n">Цена</th></tr></thead><tbody>${tr}</tbody></table>
      <p class="hint">Цена — во что лидер оценивает поддержку: плата должна её перекрыть. Договорившись, лидер ведёт
        фракцию за вами ${quarters(DEAL_LEN)}. Раунд переговоров — ${paid?'уже оплачен в этом квартале':'одно действие на весь квартал'},
        каждое предложение — ${DEAL_CAP} веса.</p>`,
    opts:rows.filter(r=>!r.d&&r.dem!==null).slice(0,10).map(r=>({label:r.L.name+' · '+(r.h==='s'?'сенаторы':'Собрание')+' «'+r.p.short+'»',
      hint:'просит '+r.dem+' · любит: '+DEAL_PAY.find(x=>x.id===FT(r.L.trait).likes).name.toLowerCase()+' · голосов '+flSeats(r.p.id,r.h),
      fn:()=>askDealWith(r.p.id,r.h,sb)})).concat([dealBackOpt(sb)])});
}
function subjForecast(sb){
  if(sb.k==='b'&&sb.bill){ const t=tally(sb.bill), s=senTally(sb.bill);
    return `<span>Собрание</span><b class="${t.yes>=MAJ?'good':'bad'}">${t.yes} из ${MAJ}</b>
      <span>Сенат</span><b class="${s.yes>=SEN_MAJ?'good':'bad'}">${s.yes} из ${SEN_MAJ} · клотур ${clotureCount(sb.bill,s)} из ${cloture()}</b>`; }
  if(sb.k==='c'){ const f=cnForecast(cnAny(sb.id));
    return `<span>Собрание</span><b class="${f.h>=f.needH?'good':'bad'}">${f.h} из ${f.needH}</b>
      <span>Сенат</span><b class="${f.s>=f.needS?'good':'bad'}">${f.s} из ${f.needS}</b>`; }
  if(sb.k==='budget'){ const t=budgetTally(); return `<span>Собрание</span><b class="${t.yes>=MAJ?'good':'bad'}">${t.yes} из ${MAJ}</b>`; }
  if(sb.k==='m'&&S.motion){ const f=motionForecast(); return `<span>За отставку</span><b>${f.yes} из ${MAJ}</b>`; }
  return '';
}
function askDealWith(pid,house,sb){
  const L=flLeader(pid,house), t=FT(L.trait), dem=dealDemand(pid,house,sb), p=P(pid);
  const pays=dealPays(pid,house);
  sheetOpen({eye:(house==='s'?'Сенаторы':'Фракция')+' «'+p.name+'»',title:L.name,
    body:`<p class="lead">${t.name}. ${t.txt}</p>
      <div class="res"><span>Предмет</span><b class="w">${subjName(sb)}</b>
        <span>Отношение к вам</span><b>${Math.round(L.rel)} · ${flWord(L.rel)}</b>
        <span>Верит вашему слову</span><b class="${L.trust<40?'bad':''}">${Math.round(L.trust)}</b>
        <span>Цена поддержки</span><b>${dem}</b>
        ${L.owe?'<span>За ними</span><b class="good">должок — дешевле на 10</b>':''}</div>`,
    opts:pays.map(x=>({label:x.name+(x.ok?' · шанс '+Math.round(dealChance(dem,x.v)*100)+'%':''),
      hint:x.ok?x.txt+' · ценность '+x.v:x.why,
      fn(){ if(!x.ok){ toast(x.why); askDealWith(pid,house,sb); return; } offerDeal(pid,house,sb,x); }}))
      .concat([{label:'Назад к переговорам',hint:'',fn:()=>askDeals(sb)}])});
}
function offerDeal(pid,house,sb,x){
  const key=subjKey(sb);
  if(!dealRoundPaid(key)){
    if(!pay({ap:1,cap:DEAL_CAP},'Переговоры: '+subjName(sb)))return;
    S.dealRound=S.dealRound||{}; S.dealRound[key]=S.q;
  } else if(!pay({cap:DEAL_CAP},'Переговоры'))return;
  const L=flLeader(pid,house), dem=dealDemand(pid,house,sb), ch=dealChance(dem,x.v), p=P(pid);
  if(Math.random()>=ch){
    L.rel=clamp(L.rel-3,0,100);
    logMsg(L.name+' («'+p.short+'») отказался: '+x.name.toLowerCase()+' за '+subjName(sb)+' — мало.',0);
    sheetOpen({eye:'Переговоры',title:L.name+' отказал',
      body:`<p class="lead">«${x.name}» — этого мало за ${subjName(sb)}. Можно предложить другое: раунд уже оплачен.</p>`,
      opts:[{label:'Предложить другое',hint:'',fn:()=>askDealWith(pid,house,sb)},{label:'К переговорам',hint:'',fn:()=>askDeals(sb)}]});
    render(); return;
  }
  if(!dealPayNow(pid,house,x)){ askDealWith(pid,house,sb); return; }
  const t=FT(L.trait);
  const d={id:(S.dealNo=(S.dealNo||0)+1), pid, house, key, label:subjName(sb), pay:x.id, trait:L.trait, leader:L.name,
    q:S.q, due:S.q+DEAL_LEN, renege:Math.random()>t.keep, told:false};
  if(x.id==='bill'){ const pc=pactFor(pid,PL); d.iou={ax:pc.ax,sign:pc.sign,topic:pc.topic,due:S.q+IOU_LEN,done:false}; }
  S.deals=(S.deals||[]).filter(z=>!(z.pid===pid&&z.house===house&&z.key===key)).concat([d]); cnt('deals');
  if(S.deals.length>60)S.deals=S.deals.slice(-60);
  L.owe=0; L.rel=clamp(L.rel+(x.id==='favor'?-12:4),0,100);
  if(!chief())S.you.inf=clamp(S.you.inf+2,0,100);          // кто договаривается за партию, того в партии слушают
  if(typeof blocDealBreak==='function')blocDealBreak(pid);
  logMsg('Сделка: '+L.name+' («'+p.short+'», '+(house==='s'?'Сенат':'Собрание')+') поддержит '+subjName(sb)+' — '+x.name.toLowerCase()+'.',1);
  sheetOpen({eye:'Переговоры',title:'По рукам',
    body:`<p class="lead">${L.name} поведёт ${house==='s'?'сенаторов':'фракцию'} «${p.name}» за вами: ${subjName(sb)}.</p>
      <div class="res"><span>Плата</span><b class="w">${x.name}</b>
        <span>Действует</span><b>до ${shortDate(d.due)}</b>
        ${d.iou?`<span>Вы должны</span><b class="w">${pactText(d.iou)} до ${shortDate(d.iou.due)}</b>`:''}</div>
      <p class="hint">Держит ли он слово — выяснится на голосовании.</p>`,
    opts:[{label:'Дальше переговоры',hint:'',fn:()=>askDeals(sb)},dealBackOpt(sb)]});
  render();
}
/* закончить переговоры: если они шли посреди голосования — вернуться к нему */
function dealBackOpt(sb){
  if(sb.back&&S.pendVote)return {label:'Вернуться к голосованию',hint:'с новым раскладом',fn(){
    const pv=S.pendVote; S.pendVote=null;
    if(pv.sen)senateDebate(pv.b,pv.low,true); else voteStage(pv.b,pv.rep0,pv.am); }};
  if(sb.k==='c')return {label:'Вернуться к поправке',hint:'',fn:()=>askAmendOne(sb.id)};
  return {label:'Закрыть переговоры',hint:'',fn(){}};
}
/* плата уходит сразу — кроме ответного закона, который вы ещё должны */
function dealPayNow(pid,house,x){
  const p=P(pid);
  if(x.id==='post'){
    const k=POSTS.map(z=>z.id).filter(z=>S.gov.posts[z]===PL).reverse()[0]; if(!k)return false;
    S.gov.posts[k]=pid;
    if(!inCoal(pid)){ S.gov.coal.push(pid); S.partners[pid]={patience:3,anger:0};
      logMsg('Фракция «'+p.name+'» вошла в коалицию.',1); chron('«'+p.name+'» вошла в правительство.','g'); }
    syncCabinet();
  }
  if(x.id==='chair'){
    const ax=AX.slice().sort((a,b)=>Math.abs(p.st[b]-me().st[b])-Math.abs(p.st[a]-me().st[a]))[0];
    const d=S.deputies.filter(z=>z.party===pid).sort((a,b)=>b.loyal-a.loyal)[0];
    if(!d)return false;
    S.comm[ax]=d.id; d.note='получил комитет по сделке'; commMembersFix(ax);
    logMsg('Комитет по теме «'+AXNAME[ax]+'» возглавил '+d.name+' («'+p.short+'»).');
  }
  if(x.id==='money'){
    if(!payGold(x.gold))return false;
    const rid=REGIONS.slice().sort((a,b)=>S.deputies.filter(d=>d.party===pid&&d.region===b.id).length-
      S.deputies.filter(d=>d.party===pid&&d.region===a.id).length)[0].id;
    S.rmod[rid]=clamp(S.rmod[rid]+2,-22,22); S.unrest[rid]=clamp(S.unrest[rid]-3,0,100);
    S.deputies.filter(d=>d.party===pid&&d.region===rid).forEach(d=>d.rel=clamp(d.rel+6,0,100));
  }
  if(x.id==='course'){ const pc=pactFor(pid,PL); me().st[pc.ax]=clamp(r1(me().st[pc.ax]+0.5*pc.sign),-2,2);
    coreGroups(me().st).forEach(g=>shiftMood(g,-0.7)); }
  if(x.id==='cash'){ if(!payFunds(x.funds))return false; addTrail(10,'конверт лидеру фракции «'+p.short+'»');
    bumpRep('honest',-2); S.leakPool=(S.leakPool||0)+1; }
  return true;
}
/* квартал сделок: долги, нарушенное слово, предложения лидеров */
function dealTick(){
  flSync();
  (S.fl&&Object.keys(S.fl)||[]).forEach(pid=>['h','s'].forEach(h=>{ const L=S.fl[pid][h]; if(!L||pid===PL)return;
    L.rel=clamp(r1(L.rel+(flBase(pid)-L.rel)*0.06),0,100); L.trust=clamp(r1(L.trust+(60-L.trust)*0.03),0,100); }));
  (S.deals||[]).forEach(d=>{
    const L=flLeader(d.pid,d.house);
    // долг по ответному закону
    if(d.iou&&!d.iou.done&&!d.iou.broken){
      const law=S.laws.find(l=>l.by===PL&&l.q>=d.q&&T(l.topic).ax===d.iou.ax&&Math.sign(l.stance)===d.iou.sign);
      if(law){ d.iou.done=true; if(L){ L.trust=clamp(L.trust+10,0,100); L.rel=clamp(L.rel+6,0,100); }
        logMsg('Долг перед «'+P(d.pid).short+'» закрыт: принят «'+law.name+'».',1); }
      else if(S.q>d.iou.due){ d.iou.broken=true;
        if(L){ L.trust=clamp(L.trust-25,0,100); L.rel=clamp(L.rel-18,0,100); }
        Object.values(S.fl).forEach(f=>['h','s'].forEach(k=>{ if(f[k])f[k].trust=clamp(f[k].trust-5,0,100); }));
        bumpRep('honest',-3);
        logMsg('Вы не вернули долг «'+P(d.pid).name+'»: '+pactText(d.iou)+' так и не принят. Лидеры фракций это запомнили.',1);
        chron('Нарушено слово, данное «'+P(d.pid).name+'».','b'); }
    }
    // слово лидера проверяется, когда срок сделки вышел
    if(!d.told&&S.q>d.due){ d.told=true; d.gone=true;
      if(d.renege&&L){ L.owe=1; logMsg(d.leader+' («'+P(d.pid).short+'») получил своё, но фракция голосовала вразнобой. За ними должок.',1); } }
  });
  // лидеры приходят сами — когда у вас есть что им продать
  if(Math.random()<0.22)dealApproach();
}
function dealApproach(){
  let sb=null;
  if(isPM()&&budgetDue()&&!S.budget.submitted)sb={k:'budget'};
  else if(S.motion&&S.motion.against===PL)sb={k:'m'};
  else if(S.bill)sb={k:'b',topic:S.bill.topic,stance:S.bill.stance,bill:S.bill};
  if(!sb)return;
  const key=subjKey(sb);
  const cand=S.parties.filter(p=>p.id!==PL&&!dealFor(p.id,'h',key)&&flLeader(p.id,'h')&&flLeader(p.id,'h').rel>=44)
    .map(p=>({p,dem:dealDemand(p.id,'h',sb)})).filter(x=>x.dem!==null).sort((a,b)=>a.dem-b.dem)[0];
  if(!cand)return;
  const L=flLeader(cand.p.id,'h'), t=FT(L.trait), want=DEAL_PAY.find(x=>x.id===t.likes);
  const x=dealPays(cand.p.id,'h').find(z=>z.id===t.likes&&z.ok)||dealPays(cand.p.id,'h').find(z=>z.ok&&z.id!=='favor');
  if(!x)return;
  sheetOpen({eye:'Лидер фракции просит встречи · '+dateLabel(),title:L.name+' предлагает сделку',
    body:`<p class="lead">«${cand.p.name}» (${mandates(seatsOf(cand.p.id))}) готова поддержать ${subjName(sb)}.
        ${L.name} — ${t.name.toLowerCase()} — хочет взамен: ${x.name.toLowerCase()}.</p>
      <div class="res">${subjForecast(sb)}<span>Отношение</span><b>${Math.round(L.rel)}</b></div>`,
    opts:[{label:'Согласиться',hint:x.txt+' · без хода',fn(){
        if(!dealPayNow(cand.p.id,'h',x)){ toast('Заплатить нечем'); return; }
        S.deals=(S.deals||[]).concat([{id:(S.dealNo=(S.dealNo||0)+1),pid:cand.p.id,house:'h',key,label:subjName(sb),pay:x.id,
          trait:L.trait,leader:L.name,q:S.q,due:S.q+DEAL_LEN,renege:Math.random()>t.keep,told:false,
          iou:x.id==='bill'?(()=>{const pc=pactFor(cand.p.id,PL);return {ax:pc.ax,sign:pc.sign,topic:pc.topic,due:S.q+IOU_LEN,done:false};})():null}]);
        L.rel=clamp(L.rel+5,0,100); if(typeof blocDealBreak==='function')blocDealBreak(cand.p.id);
        logMsg('Сделка по предложению '+L.name+': «'+cand.p.short+'» поддержит '+subjName(sb)+'.',1); render(); }},
      {label:'Отказать',hint:'отношение немного упадёт',fn(){ L.rel=clamp(L.rel-3,0,100); }}]});
}

/* ─── комитеты ──────────────────────────────────────────────────────
   Шесть профильных комитетов. В начале созыва председатели и места
   делятся между фракциями пропорционально, по методу Д'Ондта: у
   большинства больше, но и у оппозиции есть свои кресла — и свои
   слушания против вашего кабинета. */
function seatCommittees(){
  S.comm={}; S.commM={};
  const pool=S.parties.filter(p=>seatsOf(p.id)>0);
  const quot=[]; pool.forEach(p=>{ for(let i=1;i<=6;i++)quot.push({pid:p.id,v:seatsOf(p.id)/i}); });
  quot.sort((a,b)=>b.v-a.v);
  const chairs=quot.slice(0,AX.length).map(x=>x.pid);
  const free=AX.slice();
  // сначала выбирает крупнейшая: ось, где она дальше всего от центра
  chairs.forEach(pid=>{
    const p=P(pid);
    free.sort((a,b)=>Math.abs(p.st[b]||0)-Math.abs(p.st[a]||0));
    const ax=free.shift();
    const taken=Object.values(S.comm);
    const d=S.deputies.filter(z=>z.party===pid&&taken.indexOf(z.id)<0).sort((a,b)=>(b.loyal+senRankLike(b))-(a.loyal+senRankLike(a)))[0];
    if(d){ S.comm[ax]=d.id; d.note='председатель комитета'; }
  });
  AX.forEach(ax=>commMembersFix(ax));
}
function senRankLike(d){ return (d.deals||0)*2+(d.integ||50)*0.1; }
/* состав комитета: места по фракциям пропорционально, председатель — внутри */
function commMembersFix(ax){
  S.commM=S.commM||{};
  const seatsBy=dhondt(Object.fromEntries(S.parties.map(p=>[p.id,seatsOf(p.id)])),COMM_SIZE);
  const ch=commChair(ax), out=ch?[ch.id]:[];
  Object.entries(seatsBy).forEach(([pid,n])=>{
    const pool=S.deputies.filter(d=>d.party===pid&&out.indexOf(d.id)<0)
      .sort((a,b)=>Math.abs(b.st[ax]-P(pid).st[ax])-Math.abs(a.st[ax]-P(pid).st[ax]));  // в комитет идут самые идейные по теме
    let need=n-(ch&&ch.party===pid?1:0);
    pool.slice(0,Math.max(0,need)).forEach(d=>out.push(d.id));
  });
  S.commM[ax]=out.slice(0,COMM_SIZE);
}
function commMembers(ax){
  if(!S.commM||!S.commM[ax])commMembersFix(ax);
  const ids=S.commM[ax], list=ids.map(id=>S.deputies.find(d=>d.id===id)).filter(Boolean);
  if(list.length<COMM_SIZE-2){ commMembersFix(ax); return S.commM[ax].map(id=>S.deputies.find(d=>d.id===id)).filter(Boolean); }
  return list;
}
/* комитет голосует: рекомендация прибавляет залу голоса или отнимает */
function commVote(b){
  const ax=T(b.topic).ax, m=commMembers(ax);
  let yes=0,no=0; m.forEach(d=>{ const v=support(d,b); if(v>0)yes++; else no++; });
  return {yes,no,n:m.length};
}
function commWord(ax){ const ch=commChair(ax); if(!ch)return 'вакансия';
  return inCoal(ch.party)&&inCoal(PL)||ch.party===PL?'свой':'чужой'; }
/* слушания: министр под лупой. Оппозиционный комитет делает это сам */
function hearingRun(ax,byYou){
  const post=COMM_MIN[ax], m=minOf(post); if(!m)return '';
  const ch=commChair(ax), hostile=!(m.party===PL||inCoal(m.party));
  const hit=byYou?ri(3,6):ri(1,3);
  m.comp=clamp(m.comp-hit,10,95);
  const mine=m.party===PL||(inCoal(m.party)&&inCoal(PL));
  if(mine){ shiftAll(-0.4); pressAll(-1); } else if(byYou){ bumpRep('comp',1.5); pressAll(1); }
  S.hearLog=(S.hearLog||[]); S.hearLog.unshift({q:S.q,ax,post,name:m.name,ch:ch?ch.name:'—',by:ch?ch.party:null,you:!!byYou});
  if(S.hearLog.length>20)S.hearLog.pop();
  return 'Слушания в комитете «'+AXNAME[ax]+'»: министр '+m.name+' ('+POSTS.find(p=>p.id===post).name.toLowerCase()+') под огнём, компетентность −'+hit+'.';
}
function askHearing(ax){
  const ch=commChair(ax), m=minOf(COMM_MIN[ax]);
  if(!m){ toast('У комитета нет министра'); return; }
  const ours=ch&&(ch.party===PL||inCoal(ch.party)&&inCoal(PL));
  const cap=ours?4:9;
  sheetOpen({eye:'Комитет «'+AXNAME[ax]+'» · 1 действие',title:'Слушания: '+m.name,
    body:`<p class="lead">${ours?'Председатель ваш — слушания назначат по первой просьбе.':'Председатель чужой: слушания придётся выбивать через членов комитета.'}
        Министр ${m.name} («${P(m.party).short}», ${minWord(m)}) будет отвечать под камеры.</p>
      <div class="res"><span>Цена</span><b>ход · ${cap} веса</b>
        <span>Министр</span><b class="w">${m.party===PL||inCoal(m.party)?'свой — ударит и по вам':'чужой — очки вам'}</b></div>`,
    opts:[{label:'Назначить слушания',hint:'компетентность министра падает, печать пишет',fn(){
        if(!pay({ap:1,cap},'Слушания в комитете'))return;
        const t=hearingRun(ax,true); logMsg(t,1); toast('Слушания проведены'); render(); }},
      {label:'Не сейчас',hint:'',fn(){}}]});
}
/* квартал комитетов: чужие председатели вызывают ваших министров */
function commTick(){
  if(!S.comm)return;
  AX.forEach(ax=>{
    const ch=commChair(ax); if(!ch)return;
    const m=minOf(COMM_MIN[ax]); if(!m)return;
    const hostile=!inCoal(ch.party)&&inCoal(m.party);
    if(hostile&&Math.random()<0.1){
      const t=hearingRun(ax,false);
      logMsg(t+' Председатель — '+ch.name+' («'+P(ch.party).short+'»).',isPM()?1:0);
    }
  });
}

/* ─── повестка Сената ───────────────────────────────────────────────
   Верхняя палата живёт своей жизнью: лидер большинства решает, чем
   она займётся в квартале, — и не всегда это ваши проекты. */
function senAgendaTick(){
  const L=S.senLead; if(!L)return;
  const pid=L.party, friendly=pid===PL||inCoal(pid)&&inCoal(PL)||(isPM()&&inCoal(pid));
  const againstGov=!inCoal(pid);
  const r=Math.random();
  let t='';
  if(againstGov&&r<0.2){
    // резолюция о министре
    const post=pick(POSTS).id, m=minOf(post);
    if(m){ m.comp=clamp(m.comp-3,10,95); if(inCoal(m.party)&&isPM()){ shiftAll(-0.3); }
      t='Сенат по настоянию '+L.name+' принял резолюцию о работе министра '+m.name+' ('+POSTS.find(p=>p.id===post).name.toLowerCase()+').'; }
  } else if(againstGov&&r<0.34){
    // свой проект Сената: идёт в Собрание
    const p=P(pid), tp=pick(TOPICS.filter(x=>!x.special));
    const bill={topic:tp.id,stance:clamp(Math.round(p.st[tp.ax]),-2,2),riders:[],by:pid};
    const up=resolveSenVote(bill);
    if(up.pass){ const low=resolveVote(bill);
      if(low.pass&&Math.random()>=vetoChance(bill)){ enact(bill); t='Сенат провёл свой проект «'+tp.name+'» через обе палаты ('+up.yes+':'+up.no+', '+low.yes+':'+low.no+').'; }
      else t='Проект Сената «'+tp.name+'» не прошёл Собрание'+(low.pass?' — вето':'')+'.';
    }
  } else if(friendly&&r<0.25){
    S.senBoost=S.q+1;
    t='Лидер большинства '+L.name+' поставил ваши проекты в повестку первыми: ближайший пройдёт Сенат легче.';
  } else if(r<0.32){
    const reg=pick(REGIONS);
    S.unrest[reg.id]=clamp(S.unrest[reg.id]-2,0,100);
    t='Сенат провёл выездное заседание в крае '+reg.name+'.';
  }
  if(t){ S.senLog=(S.senLog||[]); S.senLog.unshift({q:S.q,t}); if(S.senLog.length>24)S.senLog.pop(); logMsg(t); }
}

/* встреча без предмета: отношения на будущее */
function flMeet(pid,house){
  if(!pay({ap:1,cap:4},'Встреча с лидером «'+P(pid).short+'»'))return;
  const L=flLeader(pid,house), v=ri(8,14);
  L.rel=clamp(L.rel+v,0,100);
  (house==='s'?S.senate:S.deputies).filter(d=>d.party===pid).forEach(d=>d.rel=clamp(d.rel+2,0,100));
  logMsg('Встреча с '+L.name+' («'+P(pid).short+'», '+(house==='s'?'Сенат':'Собрание')+'): отношение +'+v+'.');
  toast('Отношение +'+v); render();
}

