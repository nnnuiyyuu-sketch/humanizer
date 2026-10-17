
/* ════════════════════════════════════════════════════════════════
   ДИПЛОМАТИЯ · инициатива соседей, саммиты, ИИ
   Каждый квартал сосед составляет план на следующий: предложить
   договор, выдвинуть ультиматум, устроить провокацию, попросить
   помощи, позвать на саммит — или промолчать. План исполняется
   через квартал; посол видит его заранее, и его можно упредить.
   Если у власти не вы, решает чужой кабинет по курсу своей партии.
   ════════════════════════════════════════════════════════════════ */
function offerName(k,vid){
  if(k==='friend')return 'договор о дружбе';
  if(k==='trade')return 'соглашение о свободной торговле';
  const t=TRT(k); if(!t)return k;
  const v=vid&&t.variants?t.variants.find(z=>z.id===vid):null;
  return t.name.toLowerCase()+(v?' — '+v.name.toLowerCase():'');
}
/* что сосед мог бы предложить сейчас */
function treatyOffers(id){
  const st=nbOf(id), out=[];
  if(!st.treaty&&st.rel>=48)out.push({k:'friend'});
  if(!st.trade&&st.rel>=45&&!sancOn(id)&&!ourSanc(id))out.push({k:'trade'});
  TREATIES.forEach(t=>{
    if(t.variants){ const v=t.variants.slice().reverse().find(z=>trWhy(id,t.id,z)===true); if(v)out.push({k:t.id,v:v.id}); }
    else if(trWhy(id,t.id)===true)out.push({k:t.id});
  });
  return out;
}

/* ─── план соседа на квартал ──────────────────────────────────────── */
function nbPlanNew(id){
  const st=nbOf(id), x=NB_(id), t=NT(st.ld.trait), rel=st.rel, w=[{act:'quiet',v:1.6}];
  if(S.bcrisis&&S.bcrisis.nb===id)return {act:'quiet',q:S.q};
  const offers=treatyOffers(id);
  if(rel>=48&&st.trust>=35&&offers.length)w.push({act:'propose',v:0.9*t.trade*(1+(rel-50)/60)*(ambOf(id)&&ambOf(id).trait==='prof'?1.3:1),k:pick(offers)});
  if(!sancOn(id)&&(rel<48||st.ld.trait==='hawk')&&st.owe<=0){
    const amb=ambOf(id), soft=amb&&amb.trait==='hard'?0.7:1;
    w.push({act:'demand',v:0.7*t.demand*(1+st.pushy*0.2)*(1+(50-rel)/60)*soft});
  }
  if(rel<40)w.push({act:'provoke',v:0.8*t.prov*(1+(40-rel)/40)});
  if(st.trouble)w.push({act:'trouble',v:1.6});
  if(rel>=52&&S.q-(st.sumQ===undefined?-9:st.sumQ)>=8)w.push({act:'summit',v:0.6*(t.id==='peace'?1.6:t.id==='hawk'?0.4:1)});
  const sum=w.reduce((a,z)=>a+z.v,0); let r=Math.random()*sum, pk=w[0];
  for(const z of w){ r-=z.v; if(r<=0){ pk=z; break; } }
  return {act:pk.act,k:pk.k,q:S.q};
}

function nbActTick(){
  NEIGHBOURS.slice().sort(()=>Math.random()-0.5).forEach(x=>{
    const st=nbOf(x.id);
    if(!st.trouble&&Math.random()<0.025)st.trouble={kind:(x.border.length&&Math.random()<0.5)?'refugees':'aid',until:S.q+4};
    if(st.plan&&st.plan.q<S.q){
      if(st.plan.act!=='quiet'){
        if(fpCan()&&S.dipEvQ===S.q&&!st.plan.late){ st.plan.late=1; return; }   // на сегодня достаточно одного лист
        nbDo(x.id,st.plan);
      }
      st.plan=null;
    }
    if(!st.plan)st.plan=nbPlanNew(x.id);
  });
}
function nbDo(id,plan){
  const st=nbOf(id); if(!st)return;
  if(plan.act==='propose'&&plan.k){ if(fpCan())offerShow(id,plan.k); else aiOffer(id,plan.k); }
  if(plan.act==='demand'){ const k=demandPick(id); if(fpCan())demandShow(id,k); else demandApply(id,k,aiStance(id)==='firm'?'refuse':'yield'); }
  if(plan.act==='provoke'){ const k=provokePick(id); if(fpCan())provokeShow(id,k); else provokeApply(id,k,aiStance(id)==='firm'?'expel':'note'); }
  if(plan.act==='trouble'&&st.trouble){ if(fpCan())troubleShow(id); else troubleApply(id,aiStance(id)==='firm'?'refuse':'aid'); }
  if(plan.act==='summit'){ if(fpCan())nbSummitShow(id); else nbSummitApply(id,'talk'); }
}
/* жёсткий или мягкий курс у чужого кабинета */
function aiStance(id){
  const lead=P(S.gov.lead); if(!lead)return 'soft';
  const st=nbOf(id), hawk=(lead.st.order||0)>0.4||(lead.st.world||0)<-0.6;
  return hawk||st.ld.trait==='hawk'&&(lead.st.order||0)>0?'firm':'soft';
}

/* ─── предложение договора ─────────────────────────────────────────── */
function offerShow(id,o){
  const x=NB_(id), st=nbOf(id), L=st.ld, nm=offerName(o.k,o.v);
  S.dipEvQ=S.q; dipLog(id,L.name+' предлагает: '+nm+'.');
  sheetOpen({eye:'Дипломатия · '+x.name,title:L.name+' предлагает договор',
    body:`<p class="lead">${L.name} (${NT(L.trait).name.toLowerCase()}) сам пришёл с предложением: ${nm}.
        ${o.k==='border'&&o.v==='cede'?'Но разграничение — с уступками: спорный участок перейдёт к соседу.':''}</p>
      <div class="res"><span>Отношения</span><b>${Math.round(st.rel)} · ${nbWord(st.rel)}</b><span>Доверие</span><b>${Math.round(st.trust)} · ${trustWord(st.trust)}</b></div>`,
    opts:[{label:'Принять предложение',hint:'без хода и веса · дальше — Сенат',fn:()=>offerAccept(id,o)},
      {label:'Поторговаться',hint:'3 веса · 55%: условия лучше (+доверие); иначе сосед отзывает предложение',fn(){
        if(!payCap(3))return;
        if(Math.random()<0.55+(ambOf(id)?0.1:0)){ trustShift(id,4); nbShift(id,3); offerAccept(id,o,true); }
        else { nbShift(id,-3); dipLog(id,'Сосед отозвал предложение после торга.','b'); render(); } }},
      {label:'Вежливо отказать',hint:'отношения −2',fn(){ nbShift(id,-2); render(); }}]});
}
function offerAccept(id,o,better){
  const x=NB_(id);
  if(o.k==='friend'){ nbTreaty(id,true); return; }
  if(o.k==='trade'){ tradeSign(id,true); return; }
  const v=better&&o.k==='border'?'fair':o.v;
  if(!trSign(id,o.k,v,true))dipLog(id,'Предложение «'+x.name+'» не удалось принять.','b');
}
function aiOffer(id,o){
  const lead=P(S.gov.lead), x=NB_(id);
  if(!lead||(lead.st.world||0)<-0.4||(o.k==='defense'&&(lead.st.order||0)<-0.4)){ nbShift(id,-2); dipLog(id,'Кабинет '+lead.leader+' отклонил предложение «'+x.name+'».'); return; }
  if(o.k==='friend'){ const st=nbOf(id); st.treaty=true; nbShift(id,10); trustShift(id,5); logMsg('Кабинет '+lead.leader+' заключил договор о дружбе с «'+x.name+'».',1); dipLog(id,'Кабинет подписал договор о дружбе.','g'); return; }
  if(o.k==='trade'){ const f=tradeVotes(id); if(f.yes>=f.need){ nbOf(id).trade=true; nbShift(id,8); shiftMood(TRADE_HURT[id],-3); shiftMood('biz',2); logMsg('Кабинет '+lead.leader+' подписал торговое соглашение с «'+x.name+'».',1); dipLog(id,'Кабинет подписал торговое соглашение.','g'); } return; }
  if(trWhy(id,o.k,o.v&&TRT(o.k).variants?TRT(o.k).variants.find(z=>z.id===o.v):null)===true){ ratQueue(id,o.k,o.v,S.gov.lead); }
}

/* ─── ультиматум ──────────────────────────────────────────────────── */
function demandPick(id){
  const st=nbOf(id), x=NB_(id), t=NT(st.ld.trait), ks=['tariff'];
  if(ourSanc(id))ks.push('sanc','sanc');
  if(x.border.length&&(t.id==='hawk'||t.id==='schem'))ks.push('border');
  if(st.rel<35||S.bcrisis)ks.push('pay');
  return pick(ks);
}
const DEMANDS={
  tariff:{name:'Снизить пошлины на их товары',lead:'Сосед требует льготных пошлин для своих товаров. Иначе — «ответные меры».',
    yield:'отношения +8 · бизнес вам благодарен · ',cost:'рабочие/село −2'},
  sanc:{name:'Снять наши санкции',lead:'Сосед требует снять санкции против него. Иначе обещает ответить.',yield:'санкции сняты · отношения +10',cost:'патриоты −1'},
  border:{name:'Пересмотреть границу',lead:'Сосед требует «уточнить» линию границы в его пользу. За словами — войска у рубежа.',yield:'отношения +12',cost:'патриоты −6, твёрдость −3'},
  pay:{name:'Выплатить компенсацию 8 млрд',lead:'Сосед требует компенсацию за «ущерб» после инцидента. Сумма названа.',yield:'отношения +6',cost:'казна −8 млрд'},
};
function demandShow(id,k){
  const x=NB_(id), st=nbOf(id), L=st.ld, d=DEMANDS[k], t=NT(L.trait);
  S.dipEvQ=S.q; dipLog(id,L.name+' выдвинул ультиматум: '+d.name.toLowerCase()+'.','b');
  const force=S.spend.def>=3;
  sheetOpen({eye:'Дипломатия · '+x.name,title:'Ультиматум: '+d.name.toLowerCase(),
    body:`<p class="lead">${L.name} (${t.name.toLowerCase()}): ${d.lead}</p>
      <div class="res"><span>Отношения</span><b class="${st.rel<38?'bad':''}">${Math.round(st.rel)} · ${nbWord(st.rel)}</b><span>Вес соседа</span><b>${x.power}</b>
        <span>Оборона</span><b>${['нет','урезано','норма','щедро','максимум'][S.spend.def]}</b>
        ${st.pushy?`<span>Вы уступали ему</span><b class="bad">${st.pushy} раз(а)</b>`:''}</div>
      <p class="hint">Ястреб уважает силу и растёт на уступках: каждая новая уступка делает следующий ультиматум вероятнее.</p>`,
    opts:[{label:'Уступить',hint:d.yield+d.cost,fn(){ demandApply(id,k,'yield'); render(); }},
      {label:'Поторговаться',hint:'4 веса · 55%: половина цены и отношения +4',fn(){ if(!payCap(4))return; demandApply(id,k,'bargain'); render(); }},
      {label:'Отказать',hint:'отношения −7 · '+(t.id==='hawk'?'он может ответить на границе':'сосед обидится'),fn(){ demandApply(id,k,'refuse'); render(); }},
      {label:'Ответить силой',hint:force?'3 веса · патриоты +3 · отношения −12, но ястреб отступит':'нужна оборона не ниже «щедро»',fn(){
        if(!force){ toast('Нужна оборона не ниже «щедро»'); return; } if(!payCap(3))return; demandApply(id,k,'force'); render(); }}]});
}
function demandApply(id,k,how){
  const st=nbOf(id), x=NB_(id), t=NT(st.ld.trait), hawk=t.id==='hawk';
  const yieldIt=half=>{
    const m=half?0.5:1;
    if(k==='tariff'){ nbShift(id,8*m,null); shiftMood(TRADE_HURT[id],-2*m); shiftMood('biz',1); S.econ.invest=r1(S.econ.invest-1*m); }
    if(k==='sanc'){ st.our=0; nbShift(id,10*m); shiftMood('patr',-1); }
    if(k==='border'){ shiftMood('patr',-6*m); bumpRep('firm',-3*m); nbShift(id,12*m); }
    if(k==='pay'){ S.treasury=r1(S.treasury-8*m); nbShift(id,6*m); }
  };
  if(how==='yield'){ yieldIt(false); if(hawk||t.id==='schem')st.pushy=Math.min(6,st.pushy+1); trustShift(id,2); logMsg('Новария уступила требованию «'+x.name+'»: '+DEMANDS[k].name.toLowerCase()+'.',1); dipLog(id,'Уступили: '+DEMANDS[k].name.toLowerCase()+'.',''); }
  if(how==='bargain'){
    if(Math.random()<0.55+(ambOf(id)?0.1:0)){ yieldIt(true); nbShift(id,4); trustShift(id,3); logMsg('Торг по требованию «'+x.name+'»: цена вполовину.'); dipLog(id,'Торг удался: цена вполовину.','g'); }
    else { nbShift(id,-9); logMsg('Торг сорвался: «'+x.name+'» обижена.',1); dipLog(id,'Торг сорвался.','b'); }
  }
  if(how==='refuse'){
    nbShift(id,t.id==='prag'||t.id==='peace'?-4:-7); st.pushy=Math.max(0,st.pushy-1);
    logMsg('Новария отказала «'+x.name+'»: '+DEMANDS[k].name.toLowerCase()+'.',1); dipLog(id,'Отказали: '+DEMANDS[k].name.toLowerCase()+'.','b');
    if((hawk||t.id==='schem')&&!S.bcrisis&&Math.random()<(k==='border'?0.45:0.3)*(S.spend.def>=3?0.4:1))bcrisisStart(id);
  }
  if(how==='force'){
    shiftMood('patr',3); S.stab=clamp(S.stab+2,0,100); nbShift(id,-12);
    if(hawk&&Math.random()<0.6){ st.pushy=0; trustShift(id,4); logMsg('«'+x.name+'» отступила перед силой: ультиматум снят.',1); dipLog(id,'Отступил перед силой.','g'); }
    else if(!S.bcrisis){ bcrisisStart(id); dipLog(id,'Ответ силой обернулся кризисом.','b'); }
  }
  void t;
}

/* ─── провокация ───────────────────────────────────────────────────── */
function provokePick(id){
  const st=nbOf(id), t=NT(st.ld.trait), ks=['spy','press'];
  if(t.id==='hawk'||t.id==='schem')ks.push('border');
  if(trHas(id,'visa'))ks.push('spy');
  return pick(ks);
}
const PROVOKES={
  spy:{name:'Шпионское дело',lead:'Дипломата соседа задержали с закрытыми документами — или он утверждает, что задержали зря. Газеты требуют ответа.'},
  press:{name:'Враждебная кампания',lead:'Государственные издания соседа обвиняют Новарию во всех грехах, а его дипломаты подпевают.'},
  border:{name:'Пограничный инцидент',lead:'У границы задержаны пограничники. Сосед обвиняет вас, вы — его.'},
};
function provokeShow(id,k){
  const x=NB_(id), L=nbOf(id).ld;
  S.dipEvQ=S.q; dipLog(id,PROVOKES[k].name+'.','b');
  if(k==='border'){ if(!S.bcrisis)bcrisisStart(id); return; }
  sheetOpen({eye:'Дипломатия · '+x.name,title:PROVOKES[k].name,
    body:`<p class="lead">${L.name}: ${PROVOKES[k].lead}</p>`,
    opts:k==='spy'
      ?[{label:'Выслать дипломата',hint:'патриоты +2 · отношения −8 · 50%: вышлют и нашего посла',fn(){ provokeApply(id,k,'expel'); render(); }},
        {label:'Нота протеста',hint:'отношения −3 · без последствий',fn(){ provokeApply(id,k,'note'); render(); }},
        {label:'Замять',hint:'отношения −1 · 30%: газеты узнают и разнесут',fn(){ provokeApply(id,k,'hush'); render(); }}]
      :[{label:'Ответить в эфире',hint:'3 веса · патриоты +2 · отношения −3',fn(){ if(!payCap(3))return; provokeApply(id,k,'reply'); render(); }},
        {label:'Не замечать',hint:'печать −1,5',fn(){ provokeApply(id,k,'ignore'); render(); }}]});
}
function provokeApply(id,k,how){
  const x=NB_(id), st=nbOf(id);
  if(k==='border'){ if(!S.bcrisis)bcrisisStart(id); return; }
  if(how==='expel'){ nbShift(id,-8); shiftMood('patr',2); logMsg('Новария выслала дипломата «'+x.name+'».',1); dipLog(id,'Выслали их дипломата.','b');
    if(Math.random()<0.5&&ambOf(id)){ const a=ambOf(id); delete S.amb[id]; logMsg('В ответ выслан наш посол '+a.name+'.',1); dipLog(id,'Выслан наш посол.','b'); } }
  if(how==='note'){ nbShift(id,-3); dipLog(id,'Нота протеста.',''); }
  if(how==='hush'){ nbShift(id,-1); if(Math.random()<0.3){ pressAll(-1.2); head(pick(PRESS),'Шпионское дело замяли: что скрывает кабинет','hb'); } }
  if(how==='reply'){ shiftMood('patr',2); nbShift(id,-3); }
  if(how==='ignore'){ pressAll(-1.5); }
  void st;
}

/* ─── беда у соседа: помощь или беженцы ──────────────────────────── */
function troubleShow(id){
  const x=NB_(id), st=nbOf(id), tr=st.trouble, L=st.ld, ref=tr.kind==='refugees';
  S.dipEvQ=S.q; dipLog(id,ref?'У соседа беспорядки, к границе идут беженцы.':'Сосед просит помощи.');
  sheetOpen({eye:'Дипломатия · '+x.name,title:ref?'Беженцы у границы':'Сосед просит помощи',
    body:`<p class="lead">${ref?'В «'+x.name+'» беспорядки: тысячи людей идут к вашей границе.'
        :L.name+' просит помощи: в стране засуха и пустая казна.'}</p>
      <p class="hint">Кто помог в беде — тот получает должника: его ультиматумов меньше, договоры дешевле.</p>`,
    opts:ref?[{label:'Принять беженцев',hint:'приграничный край +4 напряжённость, патриоты −3, интеллигенция +2 · отношения +10, доверие +6',fn(){ troubleApply(id,'accept'); render(); }},
        {label:'Помочь деньгами на месте',hint:'8 млрд · отношения +8 · доверие +5 · сосед должен',fn(){ troubleApply(id,'aid'); render(); }},
        {label:'Закрыть границу',hint:'отношения −8 · порядок +',fn(){ troubleApply(id,'refuse'); render(); }}]
      :[{label:'Дать помощь',hint:'10 млрд · отношения +12 · доверие +8 · сосед должен',fn(){ troubleApply(id,'aid'); render(); }},
        {label:'Кредит под условия',hint:'15 млрд в долг соседу: должник, но риск невозврата · отношения +6',fn(){ troubleApply(id,'loan'); render(); }},
        {label:'Гуманитарный груз',hint:'3 млрд · отношения +5',fn(){ troubleApply(id,'small'); render(); }},
        {label:'Отказать',hint:'отношения −6 · ястреб и интриган запомнят',fn(){ troubleApply(id,'refuse'); render(); }}]});
}
function troubleApply(id,how){
  const x=NB_(id), st=nbOf(id), tr=st.trouble; if(!tr)return;
  const pay0=n=>{ if(S.treasury<n){ toast('В казне нет '+n+' млрд'); return false; } S.treasury=r1(S.treasury-n); return true; };
  if(how==='accept'){ nbShift(id,10); trustShift(id,6); shiftMood('patr',-3); shiftMood('intel',2); x.border.forEach(r=>S.unrest[r]=clamp(S.unrest[r]+4,0,100)); st.owe++; dipLog(id,'Приняли беженцев.','g'); }
  if(how==='aid'){ const n=tr.kind==='refugees'?8:10; if(!pay0(n))return; nbShift(id,tr.kind==='refugees'?8:12); trustShift(id,tr.kind==='refugees'?5:8); st.owe++; shiftMood('intel',1); dipLog(id,'Дали помощь '+n+' млрд.','g'); }
  if(how==='loan'){ if(!pay0(15))return; nbShift(id,6); st.owe++; st.loan=(st.loan||0)+15; S.debt=r1(S.debt+0); dipLog(id,'Кредит соседу — 15 млрд.',''); }
  if(how==='small'){ if(!pay0(3))return; nbShift(id,5); dipLog(id,'Гуманитарный груз.','g'); }
  if(how==='refuse'){ nbShift(id,tr.kind==='refugees'?-8:-6); if(tr.kind==='refugees')REGIONS.forEach(r=>{ if(x.border.indexOf(r.id)>=0)S.unrest[r.id]=clamp(S.unrest[r.id]-1,0,100); }); dipLog(id,'Отказали в помощи.','b'); }
  st.trouble=null;
  logMsg('«'+x.name+'»: '+{accept:'приняты беженцы',aid:'отправлена помощь',loan:'выдан кредит',small:'отправлен гуманитарный груз',refuse:'в помощи отказано'}[how]+'.',1);
}
/* кредит возвращается — или нет */
function loanTick(){
  NEIGHBOURS.forEach(x=>{ const st=nbOf(x.id); if(!(st.loan>0))return;
    const back=Math.min(st.loan,3.5);
    if(Math.random()<0.78-(NT(st.ld.trait).id==='schem'?0.25:0)){ st.loan=r1(st.loan-back); S.treasury=r1(S.treasury+back*1.04); if(st.loan<=0){ st.loan=0; dipLog(x.id,'Кредит возвращён.','g'); } }
    else if(Math.random()<0.25){ logMsg('«'+x.name+'» объявила дефолт по кредиту: '+Math.round(st.loan)+' млрд не вернутся.',1); dipLog(x.id,'Дефолт по кредиту.','b'); st.loan=0; trustShift(x.id,-2); }
  });
}

/* ─── двусторонний саммит ───────────────────────────────────────── */
function nbSummitShow(id){
  const x=NB_(id), L=nbOf(id).ld;
  S.dipEvQ=S.q; nbOf(id).sumQ=S.q;
  sheetOpen({eye:'Дипломатия · '+x.name,title:L.name+' зовёт на встречу',
    body:`<p class="lead">${L.name} (${NT(L.trait).name.toLowerCase()}) приглашает вас на двустороннюю встречу в верхах. Повестку выбираете вы.</p>`,
    opts:[{label:'Торговля и контракты',hint:'ход и 6 веса · отношения +8, инвестиции',fn(){ if(!pay({ap:1,cap:6},'Саммит'))return; nbSummitApply(id,'trade'); render(); }},
      {label:'Безопасность границы',hint:'ход и 6 веса · граница спокойнее, доверие +8',fn(){ if(!pay({ap:1,cap:6},'Саммит'))return; nbSummitApply(id,'safe'); render(); }},
      {label:'Личная встреча',hint:'ход и 4 веса · отношения +9, доверие +6',fn(){ if(!pay({ap:1,cap:4},'Саммит'))return; nbSummitApply(id,'talk'); render(); }},
      {label:'Отказаться',hint:'отношения −3',fn(){ nbShift(id,-3); render(); }}]});
}
function nbSummitApply(id,how){
  const x=NB_(id), st=nbOf(id); st.sumQ=S.q;
  if(how==='trade'){ nbShift(id,8); trustShift(id,4); S.econ.invest=r1(S.econ.invest+2); shiftMood('biz',1.5); }
  if(how==='safe'){ nbShift(id,5); trustShift(id,8); x.border.forEach(r=>S.unrest[r]=clamp(S.unrest[r]-3,0,100)); }
  if(how==='talk'){ nbShift(id,9); trustShift(id,6); }
  bumpRep('comp',1);
  logMsg('Встреча в верхах с «'+x.name+'» ('+{trade:'торговля',safe:'безопасность',talk:'личная встреча'}[how]+'): отношения теплеют.',1);
  dipLog(id,'Встреча в верхах: '+{trade:'торговля',safe:'безопасность',talk:'личная встреча'}[how]+'.','g');
  // на встрече можно договориться сразу: лучший доступный договор уходит в Сенат
  const o=treatyOffers(id).filter(z=>z.k!=='friend'&&z.k!=='trade')[0];
  if(o&&Math.random()<0.4&&!S.rat.some(r=>r.id===id)){ ratQueue(id,o.k,o.v,S.gov.lead); dipLog(id,'На встрече согласован «'+trName(o.k,o.v).toLowerCase()+'».','g'); }
}

/* ─── региональный саммит ───────────────────────────────────────────
   Раз в 6–8 кварталов все четыре соседа в одном зале. Вы выбираете
   позицию и подарок; итог — декларация, которая действует два года,
   или раскол, после которого соседи расходятся недовольными. */
function summitDue(){ return S.sumDue!=null&&S.q>=S.sumDue&&S.q<S.sumDue+3; }
function summitTick(){
  if(S.sumDue==null){ S.sumDue=S.q+6; return; }
  if(S.decl&&S.decl.until<=S.q)S.decl=null;
  if(S.decl&&S.decl.id==='bloc'){ const p=S.decl.partner; if(p&&nbOf(p)){ nbShift(p,0.5,null,{noRipple:true}); NEIGHBOURS.forEach(z=>{ if(nbRiv(p,z.id)>0.5)nbShift(z.id,-0.5,null,{noRipple:true}); }); } }
  if(S.q<S.sumDue)return;
  if(fpCan()){ if(S.q===S.sumDue)askRSummit(); else if(S.q>=S.sumDue+3){ S.sumDue=S.q+6; NEIGHBOURS.forEach(x=>nbShift(x.id,-1,null,{noRipple:true})); logMsg('Региональный саммит прошёл без вас: соседи отметили ваше отсутствие.',1); } }
  else { rSummitApply(aiSummitPos(),'none'); S.sumDue=S.q+7; }
}
function aiSummitPos(){
  const lead=P(S.gov.lead); if(!lead)return 'quiet';
  return (lead.st.world||0)>0.5?'trade':(lead.st.order||0)>0.5?'safe':'quiet';
}
const RS_POS=[
  {id:'trade',name:'Торговый пакет',txt:'безбарьерный рынок: торговцы и прагматики за, ястребы равнодушны'},
  {id:'safe', name:'Безопасность границ',txt:'совместное патрулирование и договорённость о кризисах: ястребы и миротворцы за'},
  {id:'quiet',name:'Только протокол',txt:'без обязательств: никого не обидите и никого не вдохновите'},
];
function rsScore(pos,gift){
  const out={};
  NEIGHBOURS.forEach(x=>{ const st=nbOf(x.id), t=NT(st.ld.trait);
    let v=(st.rel-45)*0.5+(st.trust-50)*0.2;
    if(pos==='trade')v+=t.trade*8-6;
    if(pos==='safe')v+=({hawk:8,schem:2,ideo:3,prag:3,merch:0,peace:7})[t.id];
    if(pos==='quiet')v+=2;
    if(pos.indexOf('side:')===0){ const s=pos.slice(5), rv=nbRiv(s,x.id);
      v+=x.id===s?18:rv>0?-rv*14:rv<0?-rv*6:-2; }
    if(gift==='credit')v+=7; if(gift==='visa')v+=4;
    if(S.summitPrep&&S.summitPrep>=S.q-3)v+=5;
    if(ambOf(x.id))v+=2;
    out[x.id]=v; });
  return out;
}
function askRSummit(){
  const pos=RS_POS.concat(NEIGHBOURS.filter(x=>nbOf(x.id).rel>=45).map(x=>({id:'side:'+x.id,name:'Ставка на «'+x.short+'»',
    txt:'партнёр получит больше всех, его соперники обидятся, союзники довольны'})));
  S.dipEvQ=S.q;
  sheetOpen({eye:'Региональный саммит · '+dateLabel(),title:'Все четыре соседа в одном зале',
    body:`<p class="lead">Раз в несколько лет соседи собираются вместе. Вы выбираете позицию, а потом — подарок за столом. Если довольны трое, подпишут декларацию на два года; если нет — разъедутся недовольными.</p>
      <div class="res">${NEIGHBOURS.map(x=>`<span>${x.short} · ${nbOf(x.id).ld.name}</span><b class="w">${NT(nbOf(x.id).ld.trait).name} · отношения ${Math.round(nbOf(x.id).rel)}</b>`).join('')}</div>`,
    opts:pos.map(p=>({label:p.name,hint:p.txt,fn:()=>askRGift(p.id)})).concat([{label:'Не ехать',hint:'отношения −1 со всеми',fn(){ NEIGHBOURS.forEach(x=>nbShift(x.id,-1,null,{noRipple:true})); S.sumDue=S.q+6; }}])});
}
function askRGift(pos){
  const sc=rsScore(pos,'none'), n=Object.values(sc).filter(v=>v>=8).length;
  sheetOpen({eye:'Региональный саммит',title:'Подарок за столом',
    body:`<p class="lead">Позиция выбрана. Остался жест: подарок решает, чья чаша перевесит.</p>
      <div class="res"><span>Довольны сейчас</span><b class="${n>=3?'good':n<=1?'bad':''}">${n} из ${NEIGHBOURS.length}</b></div>`,
    opts:[{label:'Кредит всем нуждающимся',hint:'ход, 6 веса и 8 млрд · довольных больше',fn(){ if(S.treasury<8){ toast('В казне нет 8 млрд'); return; }
        if(!pay({ap:1,cap:6},'Саммит'))return; S.treasury=r1(S.treasury-8); rSummitApply(pos,'credit'); render(); }},
      {label:'Односторонний безвиз для их граждан',hint:'ход и 6 веса · довольных больше, патриоты −1',fn(){ if(!pay({ap:1,cap:6},'Саммит'))return; shiftMood('patr',-1); rSummitApply(pos,'visa'); render(); }},
      {label:'Без подарка',hint:'ход и 6 веса',fn(){ if(!pay({ap:1,cap:6},'Саммит'))return; rSummitApply(pos,'none'); render(); }}]});
}
function rSummitApply(pos,gift){
  const sc=rsScore(pos,gift), good=NEIGHBOURS.filter(x=>sc[x.id]>=8).length;
  NEIGHBOURS.forEach(x=>{ nbShift(x.id,clamp(sc[x.id]*0.35,-8,8),null,{noRipple:true}); trustShift(x.id,sc[x.id]>=8?3:-2); nbOf(x.id).sumQ=S.q; });
  S.sumDue=S.q+(S.q<12?7:6); S.summitPrep=0;
  const kind=good>=3?'decl':good===2?'part':'rift';
  if(kind==='decl'){
    const id=pos==='trade'?'trade':pos==='safe'?'safe':pos.indexOf('side:')===0?'bloc':null;
    if(id){ S.decl={id,until:S.q+8,partner:pos.indexOf('side:')===0?pos.slice(5):null}; cnt('decl'); }
    logMsg('Региональный саммит: подписана декларация'+(id?' — «'+({trade:'свободная торговля',safe:'безопасность границ',bloc:'партнёрство'})[id]+'»':'')+'.',1);
    chron('Региональный саммит завершился декларацией.','g'); bumpRep('comp',3); addCap(6);
    dipLog(null,'Саммит: декларация, довольны '+good+' из 4.','g');
  } else if(kind==='part'){ logMsg('Региональный саммит: итоги скромные, довольны двое.',1); dipLog(null,'Саммит: итоги скромные.',''); }
  else { logMsg('Региональный саммит закончился расколом: довольны не больше одного.',1); chron('Региональный саммит закончился ничем.','b'); bumpRep('firm',-1); dipLog(null,'Саммит: раскол.','b'); }
  if(fpCan())toast(kind==='decl'?'Саммит: декларация':kind==='part'?'Саммит: скромные итоги':'Саммит: раскол');
}

/* ─── упредить план соседа ────────────────────────────────────────── */
function askForestall(id){
  const st=nbOf(id), a=ambOf(id);
  if(!a||!st.plan||st.plan.act==='quiet'){ toast('Упреждать нечего'); return; }
  const ch=clamp(0.45+a.skill/250,0.3,0.8);
  sheetOpen({eye:'Дипломатия · '+NB_(id).name,title:'Упредить: '+planWord(st.plan).toLowerCase(),
    body:`<p class="lead">Посол ${a.name} узнал, что «${NB_(id).name}» ${planWord(st.plan).toLowerCase()}. Можно поговорить заранее.</p>`,
    opts:[{label:'Поговорить через посла',hint:'ход и 5 веса · шанс '+Math.round(ch*100)+'%',fn(){
        if(!pay({ap:1,cap:5},'Упреждающий разговор'))return;
        if(Math.random()<ch){ st.plan={act:'quiet',q:S.q}; trustShift(id,3); nbShift(id,2); logMsg('Посол снял напряжение: «'+NB_(id).name+'» отказалась от задуманного.',1); dipLog(id,'Упредили план: сосед передумал.','g'); }
        else { nbShift(id,-1); logMsg('Разговор не помог.'); }
        render(); }},{label:'Не вмешиваться',hint:''}]});
}

/* ─── чужой кабинет и свои действия ИИ ─────────────────────────────── */
function dipAiTick(){
  if(fpCan())return;
  const lead=P(S.gov.lead); if(!lead)return;
  // посол в самую холодную столицу
  const cold=NEIGHBOURS.filter(x=>!ambOf(x.id)).sort((a,b)=>nbOf(a.id).rel-nbOf(b.id).rel)[0];
  if(cold&&Math.random()<0.1){ const c=ambAuto(cold.id); dipLog(cold.id,'Кабинет '+lead.leader+' назначил посла: '+c.name+'.'); }
  // сам предлагает договор
  if(Math.random()<0.1&&!(S.rat||[]).length){
    const world=(lead.st.world||0);
    const cand=NEIGHBOURS.map(x=>({x,o:treatyOffers(x.id).filter(z=>z.k!=='friend'&&z.k!=='trade'&&(z.k!=='defense'||(lead.st.order||0)>0.3))[0]})).filter(z=>z.o&&world>-0.3)[0];
    if(cand){ ratQueue(cand.x.id,cand.o.k,cand.o.v,S.gov.lead); logMsg('Кабинет '+lead.leader+' внёс в Сенат «'+trName(cand.o.k,cand.o.v).toLowerCase()+'» с «'+cand.x.name+'».'); }
  }
}

/* ─── квартал дипломатии ──────────────────────────────────────────── */
function dipTick(){
  if(!S.nb||!S.you)return;
  nbFillAll();
  NEIGHBOURS.forEach(x=>{ const st=nbOf(x.id);
    let tr=st.trust+(55-st.trust)*0.04;
    if(ourSanc(x.id))tr-=1.5; if(sancOn(x.id))tr-=0.5;
    tr+=Object.keys(st.tr).length*0.3;
    st.trust=clamp(tr,0,100);
    st.rel=clamp(st.rel+Object.keys(st.tr).length*0.35+(st.tr.defense?0.4:0),0,100);
    if(st.owe>0&&S.q%6===0)st.owe--;
    if(st.trouble&&st.trouble.until<S.q)st.trouble=null;
    if(st.pushy>0&&S.q%8===0)st.pushy--;
  });
  trTick(); ambTick(); ratTick(); loanTick(); summitTick(); nbActTick(); dipAiTick();
}
