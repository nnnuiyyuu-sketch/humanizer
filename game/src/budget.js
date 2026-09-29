
/* ════════════════════════════════════════════════════════════════
   БЮДЖЕТ КАК ТОРГ
   У каждой фракции есть своя строка: статья, которую ждут её
   избиратели, или налог, который они ненавидят. Вписанная строка
   приносит голоса фракции и удешевляет сделку с её лидером;
   урезанная после обещания — обиду. Кто не правит, может сам
   потребовать строку у чужого кабинета.
   ════════════════════════════════════════════════════════════════ */
const BASK_LVL={spend:3,tax:1};     // «щедро» для статьи, «низкий» для налога

/* строка фракции: считается раз в бюджетный год, чтобы не прыгала */
function bAskCalc(p){
  const base=p.base||[], has=g=>base.indexOf(g)>=0;
  const c=[];
  SPEND.forEach(s=>{
    let sc=s.likes.filter(has).length*2-s.hates.filter(has).length-(p.st.econ||0)*0.6;
    if(s.id==='def'||s.id==='pol')sc+=(p.st.order||0)*0.8-(p.st.free||0)*0.3;
    if(s.id==='def')sc-=(p.st.world||0)*0.4;
    if(s.id==='edu')sc+=(p.st.free||0)*0.4;
    if(s.id==='inf')sc+=(p.st.reg||0)*0.5;
    c.push({kind:'spend',id:s.id,lvl:BASK_LVL.spend,sc});
  });
  TAXES.forEach(t=>{
    const sc=t.hates.filter(has).length*1.6+(p.st.tax||0)*0.9+(t.id==='corp'?(p.st.econ||0)*0.5:0);
    c.push({kind:'tax',id:t.id,lvl:BASK_LVL.tax,sc});
  });
  c.sort((a,b)=>b.sc-a.sc||a.id.localeCompare(b.id));
  const {kind,id,lvl}=c[0]; return {kind,id,lvl};
}
function bAsk(pid){
  if(pid===PL)return null;
  const y=budgetYear();
  if(!S.bAsk||S.bAsk.year!==y)S.bAsk={year:y,by:{}};
  if(!S.bAsk.by[pid]){ const p=P(pid); if(!p)return null; S.bAsk.by[pid]=bAskCalc(p); }
  return S.bAsk.by[pid];
}
function bAskMet(a){ return a.kind==='spend'?S.spend[a.id]>=a.lvl:S.tax[a.id]<=a.lvl; }
function bAskItem(a){ return a.kind==='spend'?SPEND.find(s=>s.id===a.id):TAXES.find(t=>t.id===a.id); }
function bAskName(a){
  const it=bAskItem(a);
  return a.kind==='spend'?it.name+' — не ниже '+a.lvl+' («'+['нет','урезано','норма','щедро','максимум'][a.lvl]+'»)'
    :it.name+' — не выше '+a.lvl+' («'+RATE_NAME[a.lvl]+'»)';
}
/* во что строка обойдётся казне за квартал, млрд */
function bAskCost(a){
  const g=S.econ.gdp/100;
  if(a.kind==='spend'){ const s=bAskItem(a), d=Math.max(0,a.lvl-S.spend[a.id]); return r1(s.base*(d/2)*(0.55+g*0.45)); }
  const t=bAskItem(a), d=Math.max(0,S.tax[a.id]-a.lvl); return r1(t.yield*(d/2)*g);
}
/* группы, которые заметят строку */
function bAskGroups(a){ const it=bAskItem(a); return a.kind==='spend'?it.likes:it.hates; }
/* поправка к голосу депутата за бюджет */
function bAskPull(d){
  const a=bAsk(d.party); if(!a)return 0;
  if(bAskMet(a))return 9;
  return inCoal(d.party)?-5:-2;
}

/* ─── премьер вписывает строку ────────────────────────────────── */
function bAskAccept(pid){
  if(!isPM())return;
  const a=bAsk(pid), p=P(pid); if(!a||bAskMet(a))return;
  if(a.kind==='spend')S.spend[a.id]=Math.max(S.spend[a.id],a.lvl); else S.tax[a.id]=Math.min(S.tax[a.id],a.lvl);
  S.bProm=(S.bProm||[]).filter(x=>x.pid!==pid);
  S.bProm.push({pid,kind:a.kind,id:a.id,lvl:a.lvl,q:S.q,until:S.q+4});
  flSync(); const L=S.fl[pid]&&S.fl[pid].h; if(L)L.rel=clamp(L.rel+4,0,100);
  logMsg('В проект бюджета вписана строка «'+p.short+'»: '+bAskName(a)+'.',1);
  render();
}
/* обещанная строка урезана — фракция считает это обманом */
function bPromTick(){
  if(!S.bProm||!S.bProm.length)return;
  S.bProm=S.bProm.filter(x=>{
    const p=P(x.pid); if(!p)return false;
    const L=S.fl&&S.fl[x.pid]&&S.fl[x.pid].h;
    if(!bAskMet(x)){
      if(isPM()){
        if(L){ L.rel=clamp(L.rel-12,0,100); L.trust=clamp(L.trust-15,0,100); }
        S.bSnub=(S.bSnub||0)+1;
        logMsg('«'+p.name+'» обвиняет кабинет в обмане: обещанная строка «'+bAskItem(x).name+'» урезана.',1);
        chron('Кабинет урезал строку, обещанную «'+p.short+'».','b');
      }
      return false;
    }
    if(S.q>=x.until){ if(L)L.trust=clamp(L.trust+5,0,100); return false; }   // слово сдержано
    return true;
  });
}

/* ─── оппозиция или младший партнёр требует строку ──────────────
   Раз в бюджетный год: чем нужнее ваши голоса чужому кабинету,
   тем охотнее он уступает. */
function bReqChance(a){
  const lead=P(S.gov.lead); if(!lead)return 0;
  const need=coalSeats()<MAJ, pivot=inCoal(PL)&&coalSeats()-seatsOf(PL)<MAJ;
  let c=0.18+(inCoal(PL)?0.2:0)+(pivot?0.3:0)+(need&&!inCoal(PL)?0.18:0)+(chief()?0.08:0);
  c+=seatsOf(PL)/SEATS*0.6;
  // кабинет неохотно идёт против своей линии
  if(a.kind==='spend')c-=Math.max(0,(lead.st.econ||0))*0.08; else c-=Math.max(0,-(lead.st.tax||0))*0.08;
  if(balance()<-6)c-=0.12;
  return clamp(c,0.04,0.92);
}
function bReqOpen(){ return !isPM()&&seatsOf(PL)>0&&S.bReq!==budgetYear(); }
function askBudgetLine(){
  if(isPM()){ goTab('budget'); return; }
  if(!bReqOpen()){ toast(seatsOf(PL)?'Строку в этом бюджетном году уже требовали':'Без мандатов кабинет вас не услышит'); return; }
  const lead=P(S.gov.lead);
  const lines=SPEND.filter(s=>S.spend[s.id]<BASK_LVL.spend).map(s=>({kind:'spend',id:s.id,lvl:BASK_LVL.spend}))
    .concat(TAXES.filter(t=>S.tax[t.id]>BASK_LVL.tax).map(t=>({kind:'tax',id:t.id,lvl:BASK_LVL.tax})));
  if(!lines.length){ toast('Все статьи и так щедрые, а налоги низкие'); return; }
  sheetOpen({eye:'Бюджет '+budgetYear()+' · торг',title:'Строка «'+me().short+'»',
    body:`<p class="lead">Правительство ${lead.leader} готовит бюджет. Можно потребовать строку в обмен на голоса «${me().name}»:
        ${inCoal(PL)?'вы в коалиции — без вас у кабинета '+(coalSeats()-seatsOf(PL))+' из '+MAJ+'.':'у кабинета '+coalSeats()+' из '+MAJ+'.'}</p>
      <p class="hint">Одно требование в бюджетный год · действие и 4 веса. Уступка поднимет настроение тех, кто ждёт строку.</p>`,
    opts:lines.map(a=>({label:bAskName(a)+' · шанс '+Math.round(bReqChance(a)*100)+'%',
      hint:'заметят: '+bAskGroups(a).map(g=>G(g).name.toLowerCase()).join(', ')+' · казне '+bAskCost(a)+' млрд в квартал',
      fn:()=>bReqSend(a)})).concat([{label:'Не сейчас',hint:''}])});
}
function bReqSend(a){
  if(!pay({ap:1,cap:4},'Требование строки бюджета'))return;
  S.bReq=budgetYear();
  const lead=P(S.gov.lead), ok=Math.random()<bReqChance(a);
  if(ok){
    if(a.kind==='spend')S.spend[a.id]=Math.max(S.spend[a.id],a.lvl); else S.tax[a.id]=Math.min(S.tax[a.id],a.lvl);
    bAskGroups(a).forEach(g=>shiftMood(g,2));
    addCap(3);
    logMsg('Кабинет '+lead.leader+' вписал в бюджет строку «'+me().short+'»: '+bAskName(a)+'.',1);
    chron('Выбили у кабинета строку бюджета: '+bAskItem(a).name.toLowerCase()+'.','g');
  } else {
    addCap(-2);
    logMsg('Кабинет '+lead.leader+' отказал «'+me().short+'» в строке бюджета.',1);
  }
  sheetOpen({eye:'Бюджет '+budgetYear()+' · торг',title:ok?'Строка вписана':'Кабинет отказал',
    body:ok?`<p class="lead">${bAskName(a)}. ${bAskGroups(a).map(g=>G(g).name).join(', ')} запомнят, кто её выбил.</p>`
      :`<p class="lead">${lead.leader} считает, что обойдётся без ваших голосов. ${inCoal(PL)?'В коалиции это запомнят с обеих сторон.':'Попробуйте в следующем году — или наберите мандатов.'}</p>`,
    acts:[{label:'Дальше'}]});
  render();
}

/* строки фракций в панели бюджета */
function bAskPanel(){
  if(!isPM())return bReqPanel();
  const rows=S.parties.filter(p=>p.id!==PL&&seatsOf(p.id)>0).sort(bySeats).map(p=>{
    const a=bAsk(p.id), ok=bAskMet(a), prom=(S.bProm||[]).some(x=>x.pid===p.id);
    return `<tr><td>${emblem(p,18)}</td>
      <td><b>${p.short}</b>${inCoal(p.id)?' <span class="tag">коалиция</span>':''}<div class="sub2">${bAskName(a)}</div></td>
      <td class="n">${seatsOf(p.id)}</td>
      <td class="r">${ok?`<span class="good">${prom?'обещано':'есть'}</span>`
        :`<button class="btn sm" onclick="bAskAccept('${p.id}')">Вписать<span class="cost">−${bAskCost(a)}</span></button>`}</td></tr>`;
  }).join('');
  const met=S.parties.filter(p=>p.id!==PL&&seatsOf(p.id)>0&&bAskMet(bAsk(p.id))).length;
  return panel({title:'Чего ждут фракции',meta:'вписано '+met+' из '+S.parties.filter(p=>p.id!==PL&&seatsOf(p.id)>0).length,flush:true,
    body:`<table class="bask"><thead><tr><th></th><th>Фракция и строка</th><th class="n">Мест</th><th class="r">Проект</th></tr></thead><tbody>${rows}</tbody></table>
      <p class="hint" style="padding:8px 14px 12px">Вписанная строка — голоса фракции за бюджет и дешевле сделка с её лидером.
        Коалиция ждёт своего строже. Урезать обещанное до конца года — обман: лидер запомнит.</p>`});
}
function bReqPanel(){
  if(!seatsOf(PL))return '';
  const open=bReqOpen();
  return panel({cls:'info',title:'Строка «'+me().short+'»',meta:open?'можно потребовать':'в этом году уже требовали',
    body:`<p class="hint">Бюджет пишет чужой кабинет, но голоса ему нужны. Раз в бюджетный год можно потребовать строку:
      поднять статью, которую ждут ваши избиратели, или снизить ненавистный налог.</p>`,
    foot:`<button class="btn" onclick="askBudgetLine()" ${open&&S.ap&&S.cap>=4?'':'disabled'}>Потребовать строку<span class="cost">4 веса</span></button>
      <span class="hint">1 действие</span>`});
}
/* строки фракций в итогах голосования */
function bAskSummary(){
  const ps=S.parties.filter(p=>p.id!==PL&&seatsOf(p.id)>0);
  const met=ps.filter(p=>bAskMet(bAsk(p.id)));
  if(!ps.length)return '';
  return `<div class="res"><span>Строки фракций</span><b>${met.length} из ${ps.length}</b>
    ${met.length?`<span>Вписаны</span><b class="w">${met.map(p=>p.short).join(', ')}</b>`:''}
    ${ps.filter(p=>inCoal(p.id)&&!bAskMet(bAsk(p.id))).map(p=>`<span>Обижен</span><b class="bad">${p.short} — строка не вписана</b>`).join('')}</div>`;
}
