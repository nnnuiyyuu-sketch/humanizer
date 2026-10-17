
/* ════════════════════════════════════════════════════════════════
   ДИПЛОМАТИЯ · основа
   Сосед — не цифра, а государство с лидером, характером, памятью и
   врагами. Отношения (rel) — это настроение, доверие (trust) — вера
   вашему слову: она растёт от исполненных договоров и падает, когда
   вы их рвёте. Соседи соперничают между собой, поэтому дружба с
   одним охлаждает его врага. Посол — глаза в чужой столице: видит
   планы заранее. Договоры (союз, граница, энергетика, безвиз)
   ратифицирует Сенат не сразу, а через квартал, и за это время
   на него можно давить — вам, оппозиции и сенаторам.
   ════════════════════════════════════════════════════════════════ */
const NB_TRAITS=[
  {id:'hawk',  name:'Ястреб',     demand:1.6, prov:1.5, trade:0.7, txt:'Уважает силу. Требует, давит и отступает только перед сильным.'},
  {id:'merch', name:'Торговец',   demand:0.7, prov:0.4, trade:1.5, txt:'Любит выгодные сделки и ненавидит санкции.'},
  {id:'ideo',  name:'Идеолог',    demand:1.0, prov:0.9, trade:0.9, txt:'Смотрит на ваш курс: близким прощает всё, далёким — ничего.'},
  {id:'schem', name:'Интриган',   demand:1.0, prov:1.4, trade:1.0, txt:'Играет вами против соседей, шпионит и не всегда держит слово.'},
  {id:'prag',  name:'Прагматик',  demand:0.8, prov:0.6, trade:1.1, txt:'Ровный партнёр: взаимность за взаимность.'},
  {id:'peace', name:'Миротворец', demand:0.4, prov:0.3, trade:1.1, txt:'Любит саммиты и посредничество, конфликтов не ищет.'},
];
const NT=id=>NB_TRAITS.find(t=>t.id===id)||NB_TRAITS[4];
const NB_LEAD={ostmark:'ideo',zarech:'hawk',gorye:'schem',meridia:'merch'};
const NB_NAMES={
  ostmark:{f:['Эрик','Йохан','Ларс','Ингрид','Хельга','Мартин','Густав','Астрид'],l:['Бергман','Лундквист','Фальк','Хольм','Рандель','Эриксен','Нордин','Вальдер']},
  zarech: {f:['Борис','Игнат','Мирон','Алла','Зоя','Тимур','Святослав','Раиса'],l:['Вельский','Громов','Стрельников','Каменев','Ордынцев','Ярославцев','Дорохов','Нечаев']},
  gorye:  {f:['Давид','Заур','Нино','Тамаз','Хасан','Лейла','Гурам','Мариам'],l:['Гаспарян','Мамедов','Чхеидзе','Баграт','Какабадзе','Ашуров','Джанелидзе','Алиев']},
  meridia:{f:['Алессандро','Лючия','Марко','Паола','Диего','Рафаэль','Серена','Лоренцо'],l:['Монтини','Ферраро','Саласар','Бьянки','Ломбарди','Кастельяно','Росси','Вителли']},
};
/* соперничество: плюс — враги, минус — покровитель и подопечный */
const NB_RIV={'ostmark|zarech':0.8,'ostmark|meridia':0.3,'zarech|gorye':-0.5,'meridia|gorye':0.3,'zarech|meridia':0.2,'ostmark|gorye':0.2};
function nbRiv(a,b){ const v=NB_RIV[a+'|'+b]; return v!==undefined?v:(NB_RIV[b+'|'+a]||0); }

function nbLeaderNew(id,trait){ const n=NB_NAMES[id]; return {name:pick(n.f)+' '+pick(n.l),trait:trait||pick(NB_TRAITS).id,since:S.q}; }
/* досье заводится у каждого соседа; старым сохранениям — при загрузке */
function nbFill(id){
  const st=nbOf(id); if(!st)return null;
  if(!st.ld)st.ld=nbLeaderNew(id,NB_LEAD[id]);
  if(st.trust==null)st.trust=55;
  if(!st.tr)st.tr={};
  if(st.owe==null)st.owe=0;
  if(st.pushy==null)st.pushy=0;
  if(st.plan===undefined)st.plan=null;
  return st;
}
function nbFillAll(){ NEIGHBOURS.forEach(x=>nbFill(x.id)); S.amb=S.amb||{}; S.rat=S.rat||[]; S.dipLog=S.dipLog||[]; }
function dipLog(id,t,k){ S.dipLog=S.dipLog||[]; S.dipLog.unshift({q:S.q,id,t,k:k||''}); if(S.dipLog.length>40)S.dipLog.pop(); }
/* отношение с одним меняется — его враги и друзья отзываются */
function nbShift(id,d,why,o){
  const st=nbOf(id); if(!st)return;
  st.rel=clamp(st.rel+d,0,100);
  if(!(o&&o.noRipple)){
    NEIGHBOURS.forEach(x=>{ if(x.id===id)return; const s2=nbOf(x.id), rv=nbRiv(id,x.id); if(!s2||!rv)return;
      s2.rel=clamp(s2.rel+clamp(-d*rv*0.3,-4,4),0,100); });
  }
  if(why)dipLog(id,why,d>=0?'g':'b');
}
function trustShift(id,d){ const st=nbOf(id); if(st)st.trust=clamp(st.trust+d,0,100); }
function trustWord(v){ return v>=75?'верит':v>=55?'доверяет':v>=38?'присматривается':v>=22?'не верит':'ни слова'; }

/* ─── договоры ─────────────────────────────────────────────────────
   Дружба и торговля живут в старых полях (treaty, trade); четыре новых
   лежат в st.tr и имеют срок, цену и порог ратификации. */
const TREATIES=[
  {id:'defense',name:'Оборонный союз',cost:8,len:12,rel:62,trust:55,
   txt:'Взаимные гарантии. Сосед защитит на границе, а его соперники похолодеют; союзник может позвать на помощь.',
   gain:'патриоты +4, стабильность +3, кризисы на границе реже',
   lean(s,p){ return (p.st.order||0)*5+(s.st.order||0)*3; }},
  {id:'border',name:'Договор о границе',cost:6,len:0,rel:55,trust:50,
   txt:'Спор о рубеже закрыт навсегда: приграничные края спокойнее, сепаратисты слабее.',
   gain:'давление на границе втрое слабее, напряжённость −3 в краях',
   variants:[{id:'fair',name:'Честное разграничение',rel:58,txt:'каждый остаётся при своём; требует доверия'},
             {id:'cede',name:'Разграничение с уступками',rel:40,txt:'вы отдаёте спорный участок: сосед теплеет, патриоты в ярости'}],
   lean(s,p,x,v){ return v&&v.id==='cede'?(p.st.reg||0)*5-8:(p.st.reg||0)*2+(x.border.indexOf(s.region)>=0?4:0); }},
  {id:'energy',name:'Энергетический контракт',cost:6,len:8,rel:50,trust:45,
   txt:'Сосед качает и перепродаёт: казна получает каждый квартал, но зависит от его настроения.',
   gain:'доход в казну каждый квартал; при отношениях ниже 30 сосед режет поставки',
   lean(s,p,x){ return (p.st.econ||0)*3+(x.border.indexOf(s.region)>=0?4:0); }},
  {id:'visa',name:'Безвизовый режим',cost:5,len:0,rel:55,trust:50,
   txt:'Граждане ездят свободно: молодёжь и интеллигенция довольны, силовики нервничают.',
   gain:'молодёжь +3, интеллигенция +2, инвестиции +1,5; патриоты −2, больше шпионских дел',
   lean(s,p){ return (p.st.free||0)*5+(p.st.world||0)*3-(p.st.order||0)*3; }},
];
const TRT=id=>TREATIES.find(t=>t.id===id);
function trHas(id,k){ const st=nbOf(id); return !!(st&&st.tr&&st.tr[k]); }
function trCount(){ return NEIGHBOURS.reduce((a,x)=>a+Object.keys((nbOf(x.id)||{tr:{}}).tr||{}).length,0); }
function trWhy(id,k,vr){
  const st=nbOf(id), t=TRT(k); if(!st||!t)return 'нет такого договора';
  if(trHas(id,k))return 'уже действует';
  if((S.rat||[]).some(r=>r.id===id&&r.k===k))return 'уже в Сенате';
  if(sancOn(id)||ourSanc(id))return 'пока действуют санкции';
  const need=(vr?vr.rel:t.rel)-(st.owe>0?6:0);
  if(st.rel<need)return 'отношения ниже '+need;
  if(st.trust<t.trust)return 'вам мало верят: доверие ниже '+t.trust;
  if(k==='defense'&&crisisWith(id))return 'на границе кризис';
  if(k==='defense'&&NEIGHBOURS.some(z=>z.id!==id&&nbRiv(id,z.id)>0.5&&trHas(z.id,'defense')))return 'союз с его заклятым соперником';
  return true;
}
function trName(k,vid){ const t=TRT(k); if(!t)return k; const v=vid&&t.variants?t.variants.find(z=>z.id===vid):null; return t.name+(v?' · '+v.name.toLowerCase():''); }

/* подписать: договор уходит в Сенат и вернётся через квартал */
function trSign(id,k,vid,free){
  if(!fpCan()){ toast('Договоры подписывает кабинет или президент'); return false; }
  const t=TRT(k), vr=vid&&t.variants?t.variants.find(v=>v.id===vid):null, why=trWhy(id,k,vr);
  if(why!==true){ toast(why); return false; }
  if(!free&&!pay({ap:1,cap:t.cost},t.name))return false;
  ratQueue(id,k,vid,S.gov.lead);
  const x=NB_(id), it=S.rat[S.rat.length-1], f=ratVotes(it);
  sheetOpen({eye:'Дипломатия · '+x.name,title:'Договор внесён в Сенат',
    body:`<p class="lead">${trName(k,vid)} с «${x.name}» подписан и отправлен на ратификацию. Сенат решит в конце квартала.</p>
      <div class="res"><span>Прогноз</span><b class="${f.yes>=f.need?'good':'bad'}">${f.yes} из ${f.need}</b>
        <span>Что даст</span><b class="w">${t.gain}</b></div>
      <p class="hint">За квартал можно давить на сенаторов: лоббирование поднимает голоса, слушания — тоже; оппозиция и сенаторы могут тянуть в обратную сторону.</p>`,
    acts:[{label:'К ратификации',fn:()=>askRat(S.rat.length-1)},{label:'Понятно'}]});
  render(); return true;
}
function ratQueue(id,k,vid,by){
  S.rat=S.rat||[]; S.rat.push({id,k,v:vid||null,q:S.q,due:S.q+1,hear:0,by:by||S.gov.lead,lob:0,opp:0});
  dipLog(id,'Договор «'+trName(k,vid).toLowerCase()+'» внесён в Сенат.');
}
function ratVotes(it){
  const x=NB_(it.id), t=TRT(it.k), vr=it.v&&t.variants?t.variants.find(z=>z.id===it.v):null; let yes=0;
  S.senate.forEach(s=>{ const p=P(s.party); if(!p)return;
    let v=(s.party===it.by?14:inCoal(s.party)&&inCoal(it.by)?7:-9);
    v+=t.lean(s,p,x,vr)+(s.rel-50)*0.1+noise(s.id+'rat'+it.k+it.id+it.q,9);
    if(v>0)yes++; });
  yes=clamp(yes+(it.hear||0)+(it.lob||0)-(it.opp||0),0,SEN_SEATS);
  return {yes,need:SEN_MAJ};
}
function ratTick(){
  S.rat=(S.rat||[]).filter(it=>{ if(S.q<it.due)return true; ratResolve(it); return false; });
}
function ratResolve(it){
  const x=NB_(it.id), st=nbOf(it.id), f=ratVotes(it), ok=f.yes>=f.need;
  if(ok){ trApply(it.id,it.k,it.v,it.by); return; }
  trustShift(it.id,-3); if(it.by===S.gov.lead&&isPM())addCap(-4);
  logMsg('Сенат не ратифицировал «'+trName(it.k,it.v).toLowerCase()+'» с «'+x.name+'» ('+f.yes+' из '+f.need+').',1);
  dipLog(it.id,'Сенат отклонил «'+trName(it.k,it.v).toLowerCase()+'» ('+f.yes+' из '+f.need+').','b');
  chron('Сенат отклонил договор с «'+x.name+'».','b');
  if(fpCan())sheetOpen({eye:'Сенат · '+dateLabel(),title:'Договор не ратифицирован',
    body:`<p class="lead">«${trName(it.k,it.v)}» с «${x.name}»: ${f.yes} голосов из ${f.need}. Сосед обижен тем, что подписанное не стало законом.</p>`,acts:[{label:'Закрыть'}]});
  void st;
}
function trApply(id,k,vid,by){
  const st=nbOf(id), x=NB_(id), t=TRT(k);
  st.tr[k]={q:S.q,until:t.len?S.q+t.len:0,v:vid||null,by:by||S.gov.lead};
  if(k==='defense'){ nbShift(id,10); shiftMood('patr',4); S.stab=clamp(S.stab+3,0,100);
    NEIGHBOURS.forEach(z=>{ if(z.id!==id&&nbRiv(id,z.id)>0)nbShift(z.id,-6,null,{noRipple:true}); }); }
  if(k==='border'){ nbShift(id,vid==='cede'?14:9);
    if(vid==='cede'){ shiftMood('patr',-5); bumpRep('firm',-3); } else bumpRep('comp',3);
    x.border.forEach(r=>{ S.unrest[r]=clamp(S.unrest[r]-3,0,100); if(S.sep)S.sep[r]=clamp((S.sep[r]||0)-3,0,100); });
    if(crisisWith(id))bcrisisEnd('Договор о границе закрыл спор с «'+x.name+'».',6); }
  if(k==='energy'){ nbShift(id,6); S.treasury=r1(S.treasury+4); shiftMood('biz',1); }
  if(k==='visa'){ nbShift(id,7); shiftMood('youth',3); shiftMood('intel',2); shiftMood('patr',-2); S.econ.invest=r1(S.econ.invest+1.5); }
  trustShift(id,6); cnt('pact');
  logMsg('Договор «'+trName(k,vid).toLowerCase()+'» с «'+x.name+'» ратифицирован Сенатом.',1);
  dipLog(id,'Ратифицирован «'+trName(k,vid).toLowerCase()+'».','g');
  chron('Ратифицирован договор «'+trName(k,vid).toLowerCase()+'» с «'+x.name+'».','g');
  career('Договор «'+trName(k,vid).toLowerCase()+'» с «'+x.name+'».');
  cover({ax:'world',stance:1,good:'«'+t.name+'» с «'+x.name+'»: страна выигрывает',bad:'«'+t.name+'» с «'+x.name+'»: чем заплатим?',flat:'Сенат ратифицировал договор с «'+x.name+'»'});
  if(fpCan()&&by===S.gov.lead)toast('Ратифицирован: '+t.name);
}
function trLapse(id,k,why){
  const st=nbOf(id), x=NB_(id); if(!st||!st.tr[k])return;
  delete st.tr[k];
  if(why==='denounce'){ nbShift(id,k==='visa'?-8:-14); trustShift(id,-12);
    if(k==='defense'){ shiftMood('patr',-3); S.stab=clamp(S.stab-2,0,100); } if(k==='visa'){ shiftMood('youth',-3); shiftMood('patr',1); }
    logMsg('Новария расторгла «'+TRT(k).name.toLowerCase()+'» с «'+x.name+'».',1); dipLog(id,'Новария расторгла «'+TRT(k).name.toLowerCase()+'».','b');
    chron('Расторгнут договор с «'+x.name+'».','b'); }
  else { logMsg('Договор «'+TRT(k).name.toLowerCase()+'» с «'+x.name+'» истёк.',1); dipLog(id,'Истёк «'+TRT(k).name.toLowerCase()+'».',''); }
}
/* срок, доход и нарушения */
function trTick(){
  NEIGHBOURS.forEach(x=>{ const st=nbOf(x.id);
    Object.keys(st.tr).forEach(k=>{ const rec=st.tr[k];
      if(rec.until&&rec.until<=S.q){ if(fpCan()&&!rec.warned){ rec.until=S.q+1; rec.warned=1; askRenew(x.id,k); } else trLapse(x.id,k); return; }
      if(k==='defense')S.stab=clamp(S.stab+0.3,0,100);
      if(k==='visa'){ S.econ.invest=r1(S.econ.invest+0.2); shiftMood('youth',0.1,true); }
      if(k==='energy'){
        if(st.cut&&st.cut.until>S.q){ S.treasury=r1(S.treasury-x.trade*2); S.econ.inf=r1(S.econ.inf+0.15); }
        else { S.treasury=r1(S.treasury+x.trade*2.6);
          if(st.rel<30&&Math.random()<0.3){ st.cut={until:S.q+2}; logMsg('«'+x.name+'» урезала поставки по энергетическому контракту.',1); dipLog(x.id,'Сосед урезал поставки.','b'); if(fpCan())askCut(x.id); } }
      }
    });
  });
}
function askRenew(id,k){
  const x=NB_(id), t=TRT(k);
  sheetOpen({eye:'Дипломатия · '+x.name,title:t.name+': срок истекает',
    body:`<p class="lead">Договор действует ещё квартал. Продлить без нового похода в Сенат — или дать ему истечь.</p>`,
    opts:[{label:'Продлить на '+quarters(t.len),hint:Math.round(t.cost/2)+' веса · доверие +3',fn(){ if(!payCap(Math.round(t.cost/2)))return;
        nbOf(id).tr[k].until=S.q+t.len; delete nbOf(id).tr[k].warned; trustShift(id,3); dipLog(id,'Продлён «'+t.name.toLowerCase()+'».','g'); render(); }},
      {label:'Пусть истечёт',hint:'отношения −3',fn(){ nbShift(id,-3); trLapse(id,k); render(); }}]});
}
function askCut(id){
  const x=NB_(id);
  sheetOpen({eye:'Энергетика · '+x.name,title:'Сосед режет поставки',
    body:`<p class="lead">«${x.name}» сократила поставки по контракту: отношения ниже 30. На два квартала казна теряет доход, а цены растут.</p>`,
    opts:[{label:'Договориться',hint:'4 веса · поставки вернутся, отношения +6',fn(){ if(!payCap(4))return; nbOf(id).cut=null; nbShift(id,6); render(); }},
      {label:'Искать замену',hint:'8 млрд · удар слабее',fn(){ if(S.treasury<8){ toast('В казне нет 8 млрд'); return; } S.treasury=r1(S.treasury-8); nbOf(id).cut=null; S.econ.inf=r1(S.econ.inf+0.1); render(); }},
      {label:'Терпеть',hint:''}]});
}
function askDenounce(id,k){
  const x=NB_(id), t=TRT(k);
  sheetOpen({eye:'Дипломатия · '+x.name,title:'Расторгнуть «'+t.name.toLowerCase()+'»?',
    body:`<p class="lead">Расторжение ударит по доверию: «${x.name}» запомнит, что подписанное можно порвать.</p>`,
    opts:[{label:'Расторгнуть',hint:'3 веса · отношения −'+(k==='visa'?8:14)+' · доверие −12',fn(){ if(!payCap(3))return; trLapse(id,k,'denounce'); render(); }},{label:'Оставить',hint:''}]});
}

/* ─── ратификация: давление на Сенат ──────────────────────────── */
function askRat(i){
  const it=(S.rat||[])[i]; if(!it){ toast('Договора на ратификации нет'); return; }
  const x=NB_(it.id), f=ratVotes(it), mine=it.by===PL||inCoal(it.by)&&inCoal(PL);
  sheetOpen({eye:'Сенат · ратификация',title:trName(it.k,it.v),
    body:`<p class="lead">Договор с «${x.name}» ждёт Сената до ${dateLabel(it.due)}.</p>
      <div class="res"><span>Прогноз «за»</span><b class="${f.yes>=f.need?'good':'bad'}">${f.yes} из ${f.need}</b>
        <span>Внёс</span><b class="w">${P(it.by)?P(it.by).name:'кабинет'}</b>
        <span>Слушания «за»</span><b>${it.hear>0?'+'+it.hear:'нет'}</b><span>Лоббирование</span><b>${it.lob?'+'+it.lob:'нет'}</b>
        <span>Нажим «против»</span><b class="${it.opp?'bad':''}">${it.opp?'−'+it.opp:'нет'}</b></div>`,
    opts:[{label:'Лоббировать ратификацию',hint:'ход и 4 веса · +6 голосов',fn:()=>ratPush(i,'lob')},
      {label:'Слушания за договор',hint:'ход и 5 веса · +8 голосов · чем ближе вы к договору, тем честнее',fn:()=>ratPush(i,'hear')},
      {label:'Выступить против',hint:'ход и 4 веса · −8 голосов'+(mine?' · против своих же':''),fn:()=>ratPush(i,'opp')},
      {label:'Закрыть',hint:''}]});
}
function ratPush(i,how){
  const it=(S.rat||[])[i]; if(!it)return;
  if(it['d'+how]){ toast('Это уже делалось'); return; }
  const cost={lob:4,hear:5,opp:4}[how];
  if(!pay({ap:1,cap:cost},{lob:'Лоббирование договора',hear:'Слушания по договору',opp:'Выступление против договора'}[how]))return;
  it['d'+how]=1;
  if(how==='lob'){ it.lob=(it.lob||0)+6; S.senate.forEach(s=>{ if(Math.random()<0.15)s.rel=clamp(s.rel+3,0,100); }); }
  if(how==='hear'){ it.hear=(it.hear||0)+8; bumpRep('comp',0.5); }
  if(how==='opp'){ it.opp=(it.opp||0)+8; bumpRep('firm',1); if(it.by===PL||inCoal(it.by)&&inCoal(PL))S.deputies.filter(d=>d.party===PL).forEach(d=>d.loyal=clamp(d.loyal-1,0,100)); }
  logMsg({lob:'Вы лоббируете ратификацию',hear:'Слушания по договору',opp:'Вы выступили против договора'}[how]+' «'+trName(it.k,it.v).toLowerCase()+'».');
  render(); askRat(i);
}

/* ─── послы ───────────────────────────────────────────────────────── */
const AMB_TRAITS=[
  {id:'charm',name:'Обаятельный',txt:'отношения с государством растут сами'},
  {id:'hard', name:'Жёсткий',    txt:'ультиматумов меньше, но отношения слегка остывают'},
  {id:'spy',  name:'Разведчик',  txt:'видит планы на два квартала вперёд; рискует шпионским делом'},
  {id:'prof', name:'Профессионал',txt:'доверие к вам растёт, договоры идут легче'},
];
const AT=id=>AMB_TRAITS.find(t=>t.id===id)||AMB_TRAITS[3];
function ambOf(id){ return S.amb&&S.amb[id]||null; }
function ambCands(id){
  const n=NB_NAMES[id];
  return [0,1,2].map(()=>({name:depName(),trait:pick(AMB_TRAITS).id,skill:ri(38,90)})).map(c=>({...c,foreign:!!n}));
}
function ambSet(id,c){
  const old=ambOf(id); S.amb=S.amb||{}; S.amb[id]={name:c.name,trait:c.trait,skill:c.skill,q:S.q};
  logMsg((old?'Новый посол':'Посол')+' в «'+NB_(id).name+'» — '+c.name+' ('+AT(c.trait).name.toLowerCase()+').',1);
  dipLog(id,'Посол — '+c.name+' ('+AT(c.trait).name.toLowerCase()+').','g'); render();
}
function askAmbassador(id){
  if(!fpCan()){ toast('Послов назначает кабинет или президент'); return; }
  const x=NB_(id), cur=ambOf(id), cs=ambCands(id);
  sheetOpen({eye:'Дипломатия · '+x.name,title:cur?'Сменить посла':'Назначить посла',
    body:`<p class="lead">Посол — ваши глаза и руки в столице «${x.name}»: видит планы лидера заранее, греет отношения, гасит ультиматумы.
        ${cur?'Сейчас: '+cur.name+' ('+AT(cur.trait).name.toLowerCase()+'). ':''}Содержание — полмиллиарда в квартал.</p>`,
    opts:cs.map(c=>({label:c.name+' · '+AT(c.trait).name.toLowerCase()+' · класс '+c.skill,hint:AT(c.trait).txt,
        fn(){ if(!pay({ap:1,cap:4},'Назначение посла'))return; ambSet(id,c); }}))
      .concat(cur?[{label:'Отозвать посла',hint:'отношения −2 · экономия',fn(){ delete S.amb[id]; nbShift(id,-2); logMsg('Посол в «'+x.name+'» отозван.'); render(); }}]:[])
      .concat([{label:'Не сейчас',hint:''}])});
}
function ambAuto(id){ const c=ambCands(id).sort((a,b)=>b.skill-a.skill)[0]; ambSet(id,c); return c; }
function ambTick(){
  const n=Object.keys(S.amb||{}).length; if(n&&isPM())S.treasury=r1(S.treasury-0.5*n);
  Object.keys(S.amb||{}).forEach(id=>{ const a=S.amb[id], st=nbOf(id), x=NB_(id), k=a.skill/100;
    if(a.trait==='charm')nbShift(id,0.8+k*0.8,null,{noRipple:true});
    if(a.trait==='hard')nbShift(id,-0.4,null,{noRipple:true});
    if(a.trait==='prof')trustShift(id,0.5+k*0.7);
    if(a.trait==='spy'&&Math.random()<0.06*(NT(st.ld.trait).id==='schem'?1.6:1)){
      nbShift(id,-5); trustShift(id,-6); delete S.amb[id];
      logMsg('Посол '+a.name+' выслан из «'+x.name+'» по обвинению в шпионаже.',1); dipLog(id,'Посол выслан за шпионаж.','b');
      chron('Выслан наш посол в «'+x.name+'».','b'); pressAll(-0.6); return; }
    if(Math.random()<0.05&&fpCan()){ // донесение
      const plan=st.plan&&st.plan.act!=='quiet'?planWord(st.plan):null;
      dipLog(id,'Посол '+a.name+': '+(plan?'в столице говорят — '+plan.toLowerCase():'настроения спокойные')+'.','');
      if(a.trait==='spy'&&Math.random()<0.5){ trustShift(id,-1); S.cap=clamp(S.cap+3,0,100); logMsg('Донесение посла: добыта закрытая записка «'+x.name+'» (вес +3).'); } }
  });
}
/* что видит посол */
function intelOf(id){ const a=ambOf(id); return a?(a.trait==='spy'?2:1):0; }
function planWord(p){
  if(!p)return 'тихо';
  return {quiet:'тихо',propose:'готовит предложение: '+(p.k?offerName(p.k.k,p.k.v):'договор'),demand:'готовит ультиматум',provoke:'ищет повод для провокации',
    trouble:'ждёт помощи: в стране неспокойно',summit:'готовит приглашение на саммит'}[p.act]||'тихо';
}

/* ─── эхо договоров в старых механиках ──────────────────────────── */
function dipBorderMul(id){ return trHas(id,'border')?0.3:1; }
function dipCrisisMul(id){
  let m=1;
  if(trHas(id,'border'))m*=0.2;
  if(NEIGHBOURS.some(z=>z.id!==id&&trHas(z.id,'defense')&&nbRiv(z.id,id)>0))m*=0.6;
  if(S.decl&&S.decl.until>S.q&&S.decl.id==='safe')m*=0.5;
  const a=ambOf(id); if(a&&a.trait==='hard')m*=0.7;
  return m;
}
