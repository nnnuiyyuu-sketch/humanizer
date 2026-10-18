
/* ════════════════════════════════════════════════════════════════
   ДИПЛОМАТИЯ · вкладка, досье соседа, круг отношений
   ════════════════════════════════════════════════════════════════ */
const DIP_POS={ostmark:[78,76],zarech:[342,70],gorye:[104,228],meridia:[336,226]};

/* круг отношений: Новария в центре, соседи по углам, соперничество между ними */
function dipCircle(){
  const cx=210,cy=150;
  const rels=[];
  NEIGHBOURS.forEach((a,i)=>NEIGHBOURS.slice(i+1).forEach(b=>{ const rv=nbRiv(a.id,b.id); if(!rv)return;
    const [x1,y1]=DIP_POS[a.id],[x2,y2]=DIP_POS[b.id];
    rels.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${rv>0?'var(--bad)':'var(--good)'}" stroke-width="${1+Math.abs(rv)*3}"
      stroke-dasharray="${rv>0?'5 4':'1 4'}" opacity="${0.25+Math.abs(rv)*0.4}"><title>${a.short} — ${b.short}: ${rv>0?'соперники':'покровитель и подопечный'}</title></line>`); }));
  const edges=NEIGHBOURS.map(x=>{ const st=nbOf(x.id), [px,py]=DIP_POS[x.id];
    const col=st.rel<38?'var(--bad)':st.rel>=54?'var(--good)':'var(--ink-3)';
    const w=2+x.trade*2+(st.trade?2:0)+Object.keys(st.tr).length;
    return `<line x1="${cx}" y1="${cy}" x2="${px}" y2="${py}" stroke="${col}" stroke-width="${w}" opacity=".75" stroke-linecap="round"
      ${sancOn(x.id)||ourSanc(x.id)?'stroke-dasharray="3 5"':''}/>`; }).join('');
  const nodes=NEIGHBOURS.map(x=>{ const st=nbOf(x.id), [px,py]=DIP_POS[x.id], bad=st.rel<38, c=crisisWith(x.id);
    const marks=[st.treaty?'Д':'',st.trade?'Т':'',...Object.keys(st.tr).map(k=>({defense:'С',border:'Г',energy:'Э',visa:'В'})[k])].filter(Boolean).join('');
    return `<g class="dipn" onclick="askNeighbour('${x.id}')" tabindex="0" role="button" aria-label="${x.name}">
      <circle cx="${px}" cy="${py}" r="30" fill="var(--surface)" stroke="${bad?'var(--bad)':'var(--ink)'}" stroke-width="${c?4:1.6}"/>
      <text x="${px}" y="${py-2}" text-anchor="middle" class="dipn-s">${x.short}</text>
      <text x="${px}" y="${py+14}" text-anchor="middle" class="dipn-v ${bad?'bad':st.rel>=54?'good':''}">${Math.round(st.rel)}</text>
      <text x="${px}" y="${py+46}" text-anchor="middle" class="dipn-m">${marks||'—'}${ambOf(x.id)?' ·П':''}</text></g>`; }).join('');
  return `<svg class="dipc" viewBox="0 0 420 300" role="img" aria-label="Отношения Новарии с соседями">
    ${rels.join('')}${edges}
    <circle cx="${cx}" cy="${cy}" r="34" fill="var(--band)" stroke="var(--gold)" stroke-width="2.5"/>
    <text x="${cx}" y="${cy+5}" text-anchor="middle" class="dipn-c">НОВ</text>${nodes}</svg>`;
}

/* повестка: что требует решения или стоит внимания */
function dipAgenda(){
  const rows=[];
  (S.rat||[]).forEach((it,i)=>{ const f=ratVotes(it);
    rows.push({k:'Сенат',t:'«'+trName(it.k,it.v)+'» с «'+NB_(it.id).short+'» ждёт ратификации до '+shortDate(it.due)+': прогноз '+f.yes+' из '+f.need,b:`<button class="btn sm" onclick="askRat(${i})" ${S.ap?'':'disabled'}>Давить</button>`,c:f.yes>=f.need?'good':'bad'}); });
  if(summitDue())rows.push({k:'Саммит',t:'Региональный саммит: соседи ждут вашей позиции',b:fpCan()?'<button class="btn sm pri" onclick="askRSummit()">Ехать</button>':'',c:''});
  else if(S.sumDue!=null)rows.push({k:'Саммит',t:'Следующий региональный саммит — '+dateLabel(S.sumDue),b:'',c:''});
  NEIGHBOURS.forEach(x=>{ const st=nbOf(x.id);
    if(intelOf(x.id)&&st.plan&&st.plan.act!=='quiet')rows.push({k:x.short,t:'«'+x.name+'» '+planWord(st.plan).toLowerCase(),b:fpCan()&&st.plan.act!=='propose'&&st.plan.act!=='summit'?`<button class="btn sm" onclick="askForestall('${x.id}')">Упредить</button>`:'',c:st.plan.act==='demand'||st.plan.act==='provoke'?'bad':''});
    Object.keys(st.tr).forEach(k=>{ const r=st.tr[k]; if(r.until&&r.until-S.q<=2)rows.push({k:x.short,t:TRT(k).name+' истекает '+shortDate(r.until),b:fpCan()?`<button class="btn sm" onclick="askRenew('${x.id}','${k}')">Продлить</button>`:'',c:''}); });
    if(st.loan>0)rows.push({k:x.short,t:'Кредит соседу: ещё '+Math.round(st.loan)+' млрд',b:'',c:''});
  });
  if(S.decl&&S.decl.until>S.q)rows.push({k:'Декларация',t:'«'+({trade:'Свободная торговля',safe:'Безопасность границ',bloc:'Партнёрство'})[S.decl.id]+'» действует до '+shortDate(S.decl.until),b:'',c:'good'});
  return panel({cls:rows.some(r=>r.c==='bad')?'warn':'',title:'Повестка',meta:rows.length?rows.length+' пунктов':'тихо',body:rows.length
    ?rows.map(r=>`<div class="crow"><s>${r.k}</s><span class="${r.c}">${r.t}</span>${r.b}</div>`).join('')
    :'<div class="empty">Срочного нет. Планы соседей видны только через посла — назначьте его, и повестка оживёт.</div>'});
}

function nbCard(x){
  const st=nbOf(x.id), L=st.ld, t=NT(L.trait), a=ambOf(x.id), c=crisisWith(x.id);
  const chips=[st.treaty?'<span class="tag g">дружба</span>':'',st.trade?'<span class="tag b">торговля</span>':'',
    ...Object.keys(st.tr).map(k=>`<span class="tag ${k==='defense'?'y':'b'}">${TRT(k).name.split(' ')[0].toLowerCase()}</span>`),
    sancOn(x.id)?'<span class="tag r">их санкции</span>':'',ourSanc(x.id)?'<span class="tag y">наши санкции</span>':'',c?'<span class="tag r">граница</span>':'',
    st.owe>0?'<span class="tag g">должен вам</span>':''].filter(Boolean).join(' ');
  return `<div class="nbc ${st.rel<38?'bad':st.rel>=54?'good':''}">
    <header><b>${x.name}</b><span>${nbWord(st.rel)}</span></header>
    <p class="nbc-l">${L.name} · <i>${t.name.toLowerCase()}</i></p>
    <div class="nbc-m"><span>отношения</span><div class="meter"><i style="width:${st.rel}%;background:${st.rel<38?'var(--bad)':st.rel>=54?'var(--good)':'var(--ink-3)'}"></i></div><b class="num-s">${Math.round(st.rel)}</b></div>
    <div class="nbc-m"><span>доверие</span><div class="meter"><i style="width:${st.trust}%;background:var(--gold)"></i></div><b class="num-s">${Math.round(st.trust)}</b></div>
    <div class="nbc-c">${chips||'<span class="dim">связей нет</span>'}</div>
    <p class="hint nbc-a">${a?'Посол: '+a.name+' · '+AT(a.trait).name.toLowerCase()+(st.plan&&st.plan.act!=='quiet'?'. Планы: '+planWord(st.plan).toLowerCase():''):'Посла нет — планы закрыты'}</p>
    <footer><button class="btn sm pri" onclick="askNeighbour('${x.id}')">Досье</button>
      <button class="btn sm" onclick="nbVisit('${x.id}')" ${S.ap&&fpCan()?'':'disabled'}>Визит<span class="cost">${VISIT_COST}</span></button></footer></div>`;
}

function tabWorld(){
  nbFillAll();
  const hot=REGIONS.filter(r=>nbPressure(r.id)>0.3).sort((a,b)=>nbPressure(b.id)-nbPressure(a.id));
  const nTreat=NEIGHBOURS.reduce((a,x)=>a+(nbOf(x.id).treaty?1:0)+(nbOf(x.id).trade?1:0)+Object.keys(nbOf(x.id).tr).length,0);
  const nAmb=Object.keys(S.amb||{}).length, avgTrust=Math.round(NEIGHBOURS.reduce((a,x)=>a+nbOf(x.id).trust,0)/NEIGHBOURS.length);
  const cut=NEIGHBOURS.filter(x=>trHas(x.id,'energy')&&nbOf(x.id).cut&&nbOf(x.id).cut.until>S.q);
  const crisis=S.bcrisis?panel({cls:'warn',title:S.bcrisis.stage===2?'Кризис на границе':'Пограничный инцидент',meta:NB_(S.bcrisis.nb).name,
    body:`<p class="lead">У ${R(S.bcrisis.rid).cap}: ${S.bcrisis.stage===2?'стороны стянули силы':'задержаны пограничники'}. Осталось ${quarters(S.bcrisis.left)}, если ничего не делать.</p>`,
    foot:fpCan()?`<button class="btn pri" onclick="askCrisis()">Решать</button><span class="hint">дипломатия, сила, посредник или уступка</span>`:''}):'';
  return panel({cls:'lead-p',title:'Внешняя политика',meta:'четыре государства по периметру',body:
    `<div class="cols c21"><div>${dipCircle()}
        <div class="legend"><span class="chip">линия к соседу — отношения: <b class="good">тёплые</b> · серые · <b class="bad">холодные</b></span>
          <span class="chip">штрих между соседями — вражда, точки — союз</span><span class="chip">Д дружба · Т торговля · С союз · Г граница · Э энергия · В безвиз · П посол</span></div></div>
      <div>
        <div class="stat ${nbTrade()<-6?'alert':''}"><i>торговый баланс отношений</i><div class="v">${sign(Math.round(nbTrade()))}</div><span>внешний спрос идёт за ним</span></div>
        <div class="res" style="margin-bottom:0"><span>Внешний спрос</span><b>${Math.round(S.world.demand)}</b>
          <span>Вклад дипломатии</span><b class="${fpDemand()<0?'bad':fpDemand()>0?'good':''}">${sign(fpDemand())}</b>
          <span>Договоров и соглашений</span><b>${nTreat}</b><span>Послов</span><b>${nAmb} из ${NEIGHBOURS.length}</b>
          <span>Доверие к вам в среднем</span><b class="${avgTrust<40?'bad':''}">${avgTrust}</b>
          <span>На ратификации</span><b>${(S.rat||[]).length}</b>
          <span>Ваш внешний курс</span><b>${sign(r1(me().st.world))}</b></div>
      </div></div>`,
    foot:`<button class="btn" onclick="askEmbassies()" ${fpCan()?'':'disabled'}>Посольства</button>
      ${summitDue()&&fpCan()?'<button class="btn pri" onclick="askRSummit()">Региональный саммит</button>':''}
      <span class="hint">${fpCan()?'Договоры подписывает кабинет или президент.':'Вы вне власти: давите на ратификацию, ездите в составе парламентских делегаций, критикуйте.'}</span>`})
  +(cut.length?panel({cls:'warn',title:'Поставки урезаны',body:`<p class="lead">«${cut.map(x=>x.name).join('», «')}» режет поставки по энергетическому контракту.</p>`,
      foot:fpCan()?`<button class="btn" onclick="askCut('${cut[0].id}')">Решать</button>`:''}):'')
  +crisis+dipAgenda()
  +`<div class="nbgrid">${NEIGHBOURS.map(nbCard).join('')}</div>`
  +(hot.length?panel({cls:'warn',title:'Граница',meta:'края под внешним давлением',flush:true,
    body:`<table class="tight"><tbody>${hot.map(r=>
      `<tr><td><b>${r.name}</b><div class="sub2">${r.cap}</div></td>
        <td class="n">${Math.round(S.unrest[r.id])}</td><td class="n bad">+${r1(nbPressure(r.id))}</td>
        <td class="r"><button class="btn sm" onclick="openRegion('${r.id}')">Карточка</button></td></tr>`).join('')}</tbody></table>`}):'')
  +panel({title:'Дипломатическая хроника',meta:(S.dipLog||[]).length+' записей',body:(S.dipLog||[]).slice(0,10).map(l=>{
      const x=l.id?NB_(l.id):null;
      return `<div class="crow"><s>${shortDate(l.q)}</s><span class="${l.k==='b'?'bad':l.k==='g'?'good':''}">${x?'<b>'+x.short+'</b> ':''}${l.t}</span></div>`; }).join('')
    ||'<div class="empty">Дипломатия только начинается.</div>'});
}

/* досье соседа */
function askNeighbour(id){
  const x=NB_(id), st=nbFill(id), L=st.ld, t=NT(L.trait), a=ambOf(id), can=fpCan(), c=crisisWith(id);
  const opts=[{label:'Визит с повесткой',hint:VISIT_COST+' млрд · выбрать повестку',fn:()=>nbVisit(id)},
    {label:'Договоры и соглашения',hint:'дружба, торговля, союз, граница, энергия, безвиз'+(S.rat.some(r=>r.id===id)?' · один в Сенате':''),fn:()=>askTreaties(id)},
    {label:a?'Сменить посла':'Назначить посла',hint:a?a.name+' · '+AT(a.trait).name.toLowerCase():'видит планы соседа заранее',fn:()=>askAmbassador(id)}];
  if(c&&can)opts.push({label:'Кризис на границе',hint:'решить',fn:()=>askCrisis()});
  if(a&&st.plan&&st.plan.act!=='quiet'&&can)opts.push({label:'Упредить план',hint:planWord(st.plan),fn:()=>askForestall(id)});
  opts.push({label:ourSanc(id)?'Снять наши санкции':'Ввести санкции',hint:can?'':'только кабинет или президент',fn:()=>askSanction(id)});
  opts.push({label:'Закрыть',hint:'',fn(){}});
  sheetOpen({eye:'Дипломатия · '+x.name,title:L.name,
    body:`<p class="lead">${x.note} ${t.name}: ${t.txt}</p>
      <div class="res"><span>Отношения</span><b class="${st.rel<38?'bad':st.rel>=54?'good':''}">${Math.round(st.rel)} · ${nbWord(st.rel)}</b>
        <span>Доверие к вам</span><b class="${st.trust<38?'bad':''}">${Math.round(st.trust)} · ${trustWord(st.trust)}</b>
        <span>Вес · торговля</span><b>${x.power} · ${x.trade}${st.trade?' · соглашение':''}</b>
        <span>Договоры</span><b class="w">${[st.treaty?'дружба':'',...Object.keys(st.tr).map(k=>TRT(k).name.toLowerCase())].filter(Boolean).join(', ')||'нет'}</b>
        ${st.owe>0?`<span>Должен вам</span><b class="good">${st.owe}× — ультиматумов не будет, договоры дешевле</b>`:''}
        ${st.loan>0?`<span>Кредит</span><b>${Math.round(st.loan)} млрд</b>`:''}
        ${st.pushy?`<span>Вы уступали ему</span><b class="bad">${st.pushy}</b>`:''}
        ${sancOn(id)?`<span>Их санкции</span><b class="bad">до ${dateLabel(st.sanc.until)}</b>`:''}${ourSanc(id)?`<span>Наши санкции</span><b class="warn">до ${dateLabel(st.our)}</b>`:''}
        <span>Посол</span><b class="w">${a?a.name+' · '+AT(a.trait).name.toLowerCase():'нет'}</b>
        <span>Планы</span><b class="w">${intelOf(id)?planWord(st.plan):'закрыты — нет посла'}</b>
        <span>Граничит с</span><b class="w">${x.border.map(r=>R(r).cap).join(', ')}</b></div>
      <p class="hint">Вражда греет приграничные края: сейчас они получают ${x.border.map(r=>'+'+r1(nbPressure(r))).join(', ')} к напряжённости.
        ${NEIGHBOURS.filter(z=>z.id!==id&&nbRiv(id,z.id)).map(z=>z.short+(nbRiv(id,z.id)>0?' — враг':' — друг')).join(', ')?'Враги и друзья: '+NEIGHBOURS.filter(z=>z.id!==id&&nbRiv(id,z.id)).map(z=>'«'+z.short+'» '+(nbRiv(id,z.id)>0?'(враг)':'(друг)')).join(', ')+'.':''}</p>`,
    opts});
}
function askTreaties(id){
  const x=NB_(id), st=nbOf(id), can=fpCan();
  const rows=[];
  rows.push({label:'Договор о дружбе'+(st.treaty?' · действует':''),hint:st.treaty?'отношения тянутся выше':TREATY_COST+' веса · от отношений 48',fn:()=>nbTreaty(id)});
  rows.push({label:'Торговое соглашение'+(st.trade?' · действует':''),hint:st.trade?'можно выйти':'Сенат голосует краями',fn:()=>askTrade(id)});
  TREATIES.forEach(t=>{
    if(trHas(id,t.id)){ rows.push({label:t.name+' · действует'+(st.tr[t.id].until?' до '+shortDate(st.tr[t.id].until):''),hint:'расторгнуть: доверие −12',fn:()=>askDenounce(id,t.id)}); return; }
    if(t.variants){ t.variants.forEach(v=>{ const w=trWhy(id,t.id,v);
      rows.push({label:t.name+' — '+v.name.toLowerCase(),hint:w===true?t.cost+' веса · '+v.txt:w,fn(){ if(w!==true){ toast(w); return askTreaties(id); } trSign(id,t.id,v.id); }}); }); return; }
    const w=trWhy(id,t.id);
    rows.push({label:t.name,hint:w===true?t.cost+' веса · '+t.gain:w,fn(){ if(w!==true){ toast(w); return askTreaties(id); } trSign(id,t.id); }});
  });
  sheetOpen({eye:'Дипломатия · '+x.name,title:'Договоры и соглашения',
    body:`<p class="lead">Новые договоры идут в Сенат и возвращаются через квартал: за это время на сенаторов можно давить. ${can?'':'Подписывает кабинет — вы можете только давить на ратификацию.'}</p>`,
    opts:rows.concat((S.rat||[]).map((it,i)=>it.id===id?{label:'В Сенате: '+trName(it.k,it.v),hint:'лоббировать, слушания или выступить против',fn:()=>askRat(i)}:null).filter(Boolean))
      .concat([{label:'Назад к досье',hint:'',fn:()=>askNeighbour(id)}])});
}
function askEmbassies(){
  sheetOpen({eye:'Дипломатия',title:'Посольства',
    body:`<p class="lead">Посол видит планы соседа за квартал вперёд, греет отношения и гасит ультиматумы. Каждый стоит полмиллиарда в квартал.</p>`,
    opts:NEIGHBOURS.map(x=>{ const a=ambOf(x.id); return {label:x.name+' · '+(a?a.name+' ('+AT(a.trait).name.toLowerCase()+')':'посла нет'),
      hint:a?'планы: '+planWord(nbOf(x.id).plan).toLowerCase():'назначить',fn:()=>askAmbassador(x.id)}; }).concat([{label:'Закрыть',hint:''}])});
}
