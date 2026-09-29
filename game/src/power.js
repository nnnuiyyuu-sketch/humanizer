/* ════════════════════════════════════════════════════════════════
   ВЛАСТЬ И ВЫБОРЫ
   Кампания с опросами и событиями, ночь подсчёта по краям,
   выборный календарь и выдвижение, предложения постов, смена
   вице-президента, заседание правительства.
   ════════════════════════════════════════════════════════════════ */

/* ─── гонка ─────────────────────────────────────────────────────────
   Доли по стране — тем же счётом, каким считают выборы, плюс шум
   опроса. Опрос врёт в пределах пары пунктов, и это видно. */
function raceShares(noiseAmp){
  const votes={}; S.parties.forEach(p=>votes[p.id]=0);
  const tot=REGIONS.reduce((a,r)=>a+r.pop,0);
  REGIONS.forEach(r=>{ const sc={}; S.parties.forEach(p=>sc[p.id]=partyScore(p,r));
    const sh=shareFrom(sc); S.parties.forEach(p=>votes[p.id]+=sh[p.id]*r.pop); });
  const out={}; let sum=0;
  S.parties.forEach(p=>{ out[p.id]=Math.max(0.5,votes[p.id]/tot+(noiseAmp?rnd(-noiseAmp,noiseAmp):0)); sum+=out[p.id]; });
  S.parties.forEach(p=>out[p.id]=r1(out[p.id]/sum*100));
  return out;
}
function campPoll(){
  if(!S.camp)return;
  S.camp.polls=S.camp.polls||[];
  if(S.camp.polls.length&&S.camp.polls[S.camp.polls.length-1].q===S.q)return;
  S.camp.polls.push({q:S.q, sh:raceShares(1.6)});
}
function campTrend(pid){
  const p=(S.camp&&S.camp.polls)||[]; if(p.length<2)return 0;
  return r1(p[p.length-1].sh[pid]-p[p.length-2].sh[pid]);
}
/* события кампании: у каждой стороны свои удачи и провалы */
const CAMP_EV=[
  {id:'dirt', w:3, make(){
    const riv=campRival();
    return {eye:'Кампания · компромат',title:'Против вас вбросили папку',
      lead:'Штаб '+riv.leader+' («'+riv.short+'») раздаёт журналистам документы о ваших сделках. Правда там перемешана с вымыслом.',
      opts:[{l:'Опровергнуть',h:'6 веса · сработает, если печать не против вас',fn(){ if(!payCap(6))return;
          if(Math.random()<0.45+pressTone()/100){ campSwing(0.6); return 'Опровержение сработало: папку назвали фальшивкой.'; }
          campSwing(-1.6); return 'Опровержению не поверили.'; }},
        {l:'Признать и извиниться',h:'честность растёт, рейтинг проседает',fn(){ bumpRep('honest',3); campSwing(-0.9); return 'Вы признали ошибки публично.'; }},
        {l:'Ответная папка',h:'15 млн · след · соперник тоже проседает',fn(){ if(!payFunds(15))return; addTrail(5,'ответный компромат');
          riv.mom=r1((riv.mom||0)-3); campSwing(-0.4); return 'Обмен папками: досталось обоим.'; }}]};
  }},
  {id:'rivalfall', w:3, make(){
    const riv=campRival();
    return {eye:'Кампания · скандал',title:'Скандал в штабе '+riv.leader,
      lead:'Всплыла история о деньгах в штабе «'+riv.name+'». Её можно раздуть — или сделать вид, что вы выше этого.',
      opts:[{l:'Раздуть',h:'5 веса · соперник теряет, но печать запомнит',fn(){ if(!payCap(5))return; riv.mom=r1((riv.mom||0)-3.5); pressAll(-1);
          return 'Скандал в штабе «'+riv.short+'» не сходит с первых полос.'; }},
        {l:'Промолчать',h:'честность +1',fn(){ riv.mom=r1((riv.mom||0)-1.2); bumpRep('honest',1); return 'Вы не стали комментировать чужой скандал.'; }}]};
  }},
  {id:'money', w:2, cond:()=>!!S.firms, make(){
    const f=pick(FIRMS);
    return {eye:'Кампания · деньги',title:'«'+f.name+'» предлагает оплатить ролики',
      lead:'Группа готова закрыть счёт за рекламу. Взамен — понимание по её теме после выборов.',
      opts:[{l:'Взять',h:'касса +24 млн · захват растёт · рабочие ворчат',fn(){ S.funds=r1(S.funds+24); bumpCapture(3); shiftMood('work',-1);
          S.camp.ads[pick(GROUPS).id]=(S.camp.ads[pick(GROUPS).id]||0)+1; return 'Ролики оплатила «'+f.name+'».'; }},
        {l:'Отказаться',h:'честность +2',fn(){ bumpRep('honest',2); return 'Вы отказались от денег «'+f.name+'».'; }}]};
  }},
  {id:'gaffe', w:2, make(){
    return {eye:'Кампания · эфир',title:'Оговорка в прямом эфире',
      lead:'Фраза, вырванная из контекста, уже гуляет по сети. Утром её обсуждает вся страна.',
      opts:[{l:'Извиниться сразу',h:'потеря небольшая',fn(){ campSwing(-0.5); return 'Вы извинились за оговорку.'; }},
        {l:'Стоять на своём',h:'твёрдость +3 · риск',fn(){ bumpRep('firm',3); campSwing(Math.random()<0.4?0.6:-1.4); return 'Вы не стали извиняться.'; }}]};
  }},
  {id:'swing', w:3, make(){
    const r=REGIONS.slice().sort((a,b)=>Math.abs(regApproval(a.id)-48)-Math.abs(regApproval(b.id)-48))[0];
    return {eye:'Кампания · край',title:r.name+' качается',
      lead:'Опросы в крае показывают равенство. Кто туда приедет в последние недели, тот и заберёт мандаты.',
      opts:[{l:'Ехать с митингом',h:'ход и 11 млн · край ваш вероятнее',fn(){ if(!pay({ap:1,funds:11},'Митинг: '+r.name))return;
          S.camp.rally[r.id]=(S.camp.rally[r.id]||0)+2; return 'Большой митинг в '+r.cap+'.'; }},
        {l:'Не распыляться',h:'соперник поедет сам',fn(){ const riv=campRival(); riv.mom=r1((riv.mom||0)+1); return 'Край достался соперникам без борьбы.'; }}]};
  }},
];
function campRival(){ return S.parties.filter(p=>p.id!==PL).sort((a,b)=>seatsOf(b.id)-seatsOf(a.id))[0]; }
function campSwing(v){ if(S.camp)S.camp.swing=r1((S.camp.swing||0)+v); }
function campEventTick(){
  if(!S.camp||Math.random()>0.6)return;
  if(S.q-S.termStart+1>=aTerm())return;          // в квартал голосования штабу не до событий
  const pool=CAMP_EV.filter(e=>!e.cond||e.cond());
  let t=pool.reduce((a,e)=>a+e.w,0)*Math.random(), ev=pool[0];
  for(const e of pool){ t-=e.w; if(t<=0){ ev=e; break; } }
  const x=ev.make();
  sheetOpen({eye:x.eye+' · '+dateLabel(),title:x.title,body:`<p class="lead">${x.lead}</p>`,
    opts:x.opts.map(o=>({label:o.l,hint:o.h,fn(){
      if(!S.camp){ toast('Кампания уже закончилась'); return; }       // голосование прошло раньше, чем вы ответили
      const t=o.fn(); if(t){ logMsg(t,1); } render(); }}))});
}

let nightTimer=null;
/* ─── ночь выборов ──────────────────────────────────────────────────
   Сначала экзит-полл, потом края один за другим — с востока, где
   участки закрываются раньше. Итог известен, когда он известен. */
function electionNight(nat,seats,regRes,prom,self){
  const order=REGIONS.slice().reverse();               // Тихоокеанск закрывается первым
  const exit={}; S.parties.forEach(p=>exit[p.id]=r1(clamp(nat[p.id]+rnd(-2.2,2.2),0.5,90)));
  const parties=S.parties.slice().sort((a,b)=>nat[b.id]-nat[a.id]);
  const cells=order.map(r=>{ const st=regRes[r.id].st, top=Object.keys(st).sort((a,b)=>st[b]-st[a])[0];
    return [chip(P(top)), String(st[PL]||0)]; });
  const rows=order.map((r,i)=>`<tr class="nr" data-i="${i}" style="opacity:.35"><td><b>${r.name}</b><div class="sub2">${r.cap} · мандатов ${S.regSeats[r.id]}</div></td>
      <td class="nt-top"><span class="dim">идёт подсчёт</span></td><td class="n nt-me">…</td></tr>`).join('');
  sheetOpen({eye:'Ночь выборов · '+dateLabel(),title:'Подсчёт голосов',
    body:`<div class="res" style="margin-top:0"><span>Экзит-полл</span><b class="w">${parties.slice(0,4).map(p=>p.short+' '+exit[p.id]+'%').join(' · ')}</b>
        <span>Обработано</span><b id="nt-pct">0%</b>
        <span>У вашей партии</span><b id="nt-me">0</b></div>
      <div class="bar" id="nt-bar" style="height:14px;margin:8px 0 10px"></div>
      <table class="tight"><thead><tr><th>Край</th><th>Первое место</th><th class="n">Ваших</th></tr></thead><tbody>${rows}</tbody></table>
      <p class="hint">Края закрываются с востока на запад. Экзит-полл ошибается на пару пунктов — иногда в решающую сторону.</p>`,
    acts:[{label:'К итогам',fn:()=>{ clearInterval(nightTimer); showResults(nat,seats,regRes,prom,self); }}],
    after(){
      let i=0; const acc={}; S.parties.forEach(p=>acc[p.id]=0);
      const step=()=>{
        if(i>=order.length){ clearInterval(nightTimer); return; }
        const r=order[i], row=document.querySelector('#msheet tr.nr[data-i="'+i+'"]'); if(!row){ clearInterval(nightTimer); return; }
        row.style.opacity=1;
        row.querySelector('.nt-top').innerHTML=cells[i][0]; row.querySelector('.nt-me').textContent=cells[i][1];
        Object.entries(regRes[r.id].st).forEach(([k,v])=>acc[k]+=v);
        i++;
        const done=Math.round(order.slice(0,i).reduce((a,x)=>a+x.pop,0)/order.reduce((a,x)=>a+x.pop,0)*100);
        const pc=document.getElementById('nt-pct'), me_=document.getElementById('nt-me'), bar=document.getElementById('nt-bar');
        if(pc)pc.textContent=done+'%'; if(me_)me_.textContent=acc[PL]+(acc[PL]>=MAJ?' · большинство':'');
        if(bar)bar.innerHTML=parties.map(p=>`<i style="width:${acc[p.id]/SEATS*100}%;background:${p.color}"></i>`).join('')+'<span class="mid"></span>';
      };
      clearInterval(nightTimer);
      if(!prefOn('motion')){ for(let k=0;k<order.length;k++)step(); }
      else nightTimer=setInterval(step,420);
    }});
}

/* ─── президентская гонка ───────────────────────────────────────── */
function presPollTick(){
  if(!S.pres||presLeft()>4||presLeft()<1)return;
  S.presPolls=S.presPolls||[];
  if(S.presPolls.length&&S.presPolls[S.presPolls.length-1].q===S.q)return;
  const sc=presScores(), out={};
  S.parties.forEach(p=>out[p.id]=r1(clamp(sc[p.id]+rnd(-1.8,1.8),0.3,90)));
  S.presPolls.push({q:S.q,sh:out});
  if(S.presPolls.length>8)S.presPolls.shift();
}

/* ─── выборный календарь ────────────────────────────────────────────
   Куда можно выдвинуться самому: Сенат от своего края, глава края,
   мэр областного центра, президент. Выдвижение — ход, вес и касса;
   дальше всё решит голосование в свой срок. */
const CAND_COST={ap:1,cap:6,funds:15};
function nextSenQ(){ const c=senCyc(); let q=S.q+1; while((q-1)%c!==0)q++; return q; }
function nextMayorQ(rid){
  if(mySeat()==='mayor'&&S.desk&&S.desk.rid===rid)return S.desk.till;
  let q=S.q+1; while((q-1)%MAYOR_TERM!==8)q++; return q;
}
function raceList(){
  const home=S.you.home||homeOf(), out=[], s=mySeat(), c=S.you.cands||{};
  if(s!=='sen')out.push({k:'sen',rid:home,q:nextSenQ(),name:'Сенат от края '+R(home).name,
    reg:!!c.sen, why:s==='pres'||s==='vp'?'кресло не совместимо':''});
  const g=govOf(home);
  if(s!=='gov'&&g)out.push({k:'gov',rid:home,q:g.till,name:(govElected()?'Выборы главы края ':'Назначение главы края ')+R(home).name,
    reg:!!c.gov, why:''});
  if(s!=='mayor')out.push({k:'mayor',rid:home,q:nextMayorQ(home),name:'Мэр '+R(home).cap,reg:!!c.mayor,why:''});
  if(S.pres&&!isPres())out.push({k:'pres',q:S.pres.until,name:'Президент республики',reg:S.primWin===true,
    why:presLeft()>6?'выдвижение открывается за полтора года':S.prim?'праймериз идут':''});
  out.push({k:'house',q:S.termStart+aTerm(),name:'Всеобщие выборы в Собрание',reg:chief()||!!S.you.run,
    why:chief()?'идёте первым номером':S.camp?'':'выдвижение по округу — во время кампании'});
  return out.sort((a,b)=>a.q-b.q);
}
function askRaces(){
  const L=raceList(); S.tutSaw=S.tutSaw||{}; S.tutSaw.races=true;
  sheetOpen({eye:'Выборный календарь · '+dateLabel(),title:'Куда выдвинуться',
    body:`<p class="lead">Выборы идут по своим часам: Сенат третями, главы краёв и мэры по своим срокам, президент раз в шесть лет.
        Выдвижение — ${CAND_COST.ap} ход, ${CAND_COST.cap} веса и ${CAND_COST.funds} млн; выиграете — кресло ваше, прежнее перейдёт преемнику.</p>
      <table class="tight"><tbody>${L.map(x=>`<tr><td><b>${x.name}</b><div class="sub2">${x.why||(x.reg?'вы выдвинуты':'можно выдвинуться')}</div></td>
        <td class="n">${shortDate(x.q)}</td></tr>`).join('')}</tbody></table>`,
    opts:L.filter(x=>!x.reg&&!x.why&&x.k!=='house').map(x=>({label:'Выдвинуться: '+x.name,hint:'голосование '+shortDate(x.q)+' · шанс сейчас '+Math.round(candChance(x.k,x.rid)*100)+'%',
      fn:()=>x.k==='pres'?askPrimary():registerCand(x.k,x.rid,x.q)}))
      .concat(!chief()&&S.camp&&!S.you.run?[{label:'Выдвинуться по округу в Собрание',hint:DIST_FUNDS+' млн · ход',fn:()=>deskAct('district')}]:[])
      .concat([{label:'Закрыть',hint:'',fn(){}}])});
}
function registerCand(k,rid,q,free){
  if(!free&&!pay(CAND_COST,'Выдвижение: '+k))return;
  S.you.cands=S.you.cands||{}; S.you.cands[k]={rid,q,since:S.q};
  logMsg('Вы выдвинулись: '+({sen:'в Сенат от края ',gov:'в главы края ',mayor:'в мэры '}[k])+(k==='mayor'?R(rid).cap:R(rid).name)+'. Голосование — '+shortDate(q)+'.',1);
  career('Выдвижение: '+({sen:'Сенат',gov:'глава края',mayor:'мэр'}[k])+', '+R(rid).name+'.');
  render();
}
/* шанс кандидата: доля партии в крае, известность, честность, работа в округе */
function candChance(k,rid){
  if(k==='pres'){ const sc=presScores(); return clamp(sc[PL]/50,0.03,0.9); }
  if(!rid)return 0;
  const sc={}; S.parties.forEach(p=>sc[p.id]=partyScore(p,R(rid)));
  const sh=shareFrom(sc)[PL]/100;
  let v=0.1+sh*1.25+(rep('folk')-50)*0.006+(rep('honest')-50)*0.003+((S.desk&&S.desk.home||50)-50)*0.004;
  if(k==='sen')v+=0.08;                          // мест в крае несколько: достаточно быть в числе первых
  if(k==='gov'&&!govElected())v=(S.gov.lead===PL||inCoal(PL))?0.55+(rep('comp')-50)*0.006:0.1;
  if(k==='mayor')v+=((S.mood.urban||50)-50)*0.004;
  return clamp(v,0.04,0.92);
}
/* итог выдвижения в Сенат — внутри выборов класса */
function senCandResolve(){
  const c=S.you.cands&&S.you.cands.sen; if(!c)return;
  S.you.cands.sen=null;
  const win=Math.random()<candChance('sen',c.rid);
  if(!win){ addCap(-4); logMsg('Выборы в Сенат: край '+R(c.rid).name+' вас не выбрал.',1); career('Проиграны выборы в Сенат.'); return; }
  // место берётся у свежеизбранного своего — или у слабейшего чужого
  const here=S.senate.filter(s=>s.region===c.rid&&s.since===S.q&&!s.you);
  let rec=here.find(s=>s.party===PL)||here.sort((a,b)=>a.rel-b.rel)[0]||S.senate.find(s=>s.region===c.rid&&!s.you);
  if(!rec)return;
  if(rec.party!==PL){ S.senSeats[rec.party]--; S.senSeats[PL]=(S.senSeats[PL]||0)+1; rec.party=PL; rec.st={...me().st}; }
  rec.you=true; rec.name=S.you.name; rec.loyal=100; rec.rel=100; rec.terms=1; rec.since=S.q;
  S.desk=newDesk('sen',{rid:c.rid}); S.desk.sid=rec.id; S.you.home=c.rid;
  setSeat('sen','Избраны в Сенат от края '+R(c.rid).name+'.');
  addCap(8); chron(S.you.name+' избран в Сенат.','g');
  logMsg('Вы избраны в Сенат от края '+R(c.rid).name+'.',1);
}
/* итог выдвижения в главы края — вместо обычной смены */
function govCandResolve(rid){
  const c=S.you.cands&&S.you.cands.gov; if(!c||c.rid!==rid)return false;
  S.you.cands.gov=null;
  const ch=candChance('gov',rid), win=Math.random()<ch;
  if(win){ takeGov(rid); addCap(10); bumpRep('folk',3); chron(S.you.name+' стал главой края '+R(rid).name+'.','g');
    logMsg('Вы стали губернатором: '+R(rid).name+' ('+Math.round(ch*100)+'% шанса).',1); return true; }
  addCap(-4); logMsg('Губернаторская кампания в крае '+R(rid).name+' проиграна.',1); career('Проиграны выборы главы края.');
  return false;
}
/* мэрские выборы: по расписанию, если вы выдвинулись */
function mayorCandTick(){
  const c=S.you.cands&&S.you.cands.mayor; if(!c||S.q<c.q)return;
  S.you.cands.mayor=null;
  const ch=candChance('mayor',c.rid);
  if(Math.random()<ch){ takeMayor(c.rid); addCap(6); chron(S.you.name+' избран мэром '+R(c.rid).cap+'.','g');
    logMsg('Вы избраны мэром '+R(c.rid).cap+'.',1); }
  else { addCap(-3); logMsg('Выборы мэра '+R(c.rid).cap+' проиграны.',1); career('Проиграны выборы мэра.'); }
}

/* ─── предложения ───────────────────────────────────────────────────
   Должность предлагают, когда вы нужны: президент — место вице,
   кабинет — край, партия — выдвижение от своего имени. */
function offerTick2(){
  if(S.over||S.camp&&Math.random()<0.5)return;
  const s=mySeat(), home=S.you.home||homeOf(), c=S.you.cands||{};
  const pool=[];
  // место вице предлагают раз за срок президента и тому, кто хорошо работает
  if(S.pres&&!isPres()&&S.vp&&!S.vp.you&&(presOurs()||inCoal(S.pres.party)&&inCoal(PL))&&S.vpOffered!==S.pres.since&&
     ['dep','none','sen','gov','min','mayor','lead'].indexOf(s)>=0&&rep('folk')>=58&&(S.desk?S.desk.score:50)>=60&&presLeft()>3)pool.push('vp');
  const g=govOf(home);
  if(g&&!g.you&&g.till-S.q<=2&&g.till>S.q&&!c.gov&&s!=='gov'&&['none','dep','mayor','sen'].indexOf(s)>=0)pool.push('gov');
  const nq=nextSenQ();
  if(nq-S.q<=2&&!c.sen&&['none','dep','mayor'].indexOf(s)>=0)pool.push('sen');
  if(!pool.length||Math.random()>0.14)return;
  const k=pick(pool);
  if(k==='vp')offerVPPost();
  if(k==='gov')offerGovNom(home);
  if(k==='sen')offerSenNom(home,nq);
}
function offerVPPost(){
  const party=S.pres.party, old=S.vp;
  S.vpOffered=S.pres.since;
  sheetOpen({eye:'Предложение · '+dateLabel(),title:'Президент зовёт вас в вице-президенты',
    body:`<p class="lead">${S.pres.name} недоволен своим вторым номером и предлагает кресло вам. ${old.name} уйдёт,
        вас утвердит Сенат — если захочет.</p>
      <div class="res"><span>Прежний вице</span><b class="w">${old.name}</b>
        <span>До президентских выборов</span><b>${quarters(presLeft())}</b>
        <span>Ваше кресло сейчас</span><b class="w">${seatTitle()}</b></div>
      <p class="hint">Вице ведёт Сенат, берёт поручения и наследует кресло президента. Прежнее кресло перейдёт преемнику.</p>`,
    opts:[{label:'Согласиться',hint:'нужно утверждение Сената',fn(){
        const cand=youVP(party);
        if(!confirmSenate('vp',cand,party)){ logMsg('Сенат не утвердил вас вице-президентом.',1); render(); return; }
        S.vp=cand; setSeat('vp','Назначение вице-президентом.'); S.desk=newDesk('vp');
        addCap(10); chron(S.you.name+' — вице-президент.','g'); logMsg('Вы стали вице-президентом.',1); render(); }},
      {label:'Отказаться',hint:'свой путь',fn(){ bumpRep('firm',2); }}]});
}
function offerGovNom(rid){
  const el=govElected();
  sheetOpen({eye:'Предложение · '+dateLabel(),title:el?'Партия выдвигает вас в главы края':'Кабинет готов назначить вас в край',
    body:`<p class="lead">${el?'У главы края '+R(rid).name+' кончается срок. Партия предлагает выдвинуть вас — кампанию оплатит она.'
        :'Главу края '+R(rid).name+' назначает кабинет, и там вспомнили о вас.'}</p>
      <div class="res"><span>Шанс</span><b>${Math.round(candChance('gov',rid)*100)}%</b><span>Голосование</span><b>${shortDate(govOf(rid).till)}</b></div>`,
    opts:[{label:'Согласиться',hint:'выдвижение без затрат',fn(){ registerCand('gov',rid,govOf(rid).till,true); }},
      {label:'Отказаться',hint:'',fn(){}}]});
}
function offerSenNom(rid,q){
  sheetOpen({eye:'Предложение · '+dateLabel(),title:'Партия выдвигает вас в Сенат',
    body:`<p class="lead">В крае ${R(rid).name} переизбирается класс сенаторов. Партия ставит вас в список — место в верхней палате на шесть лет.</p>
      <div class="res"><span>Шанс</span><b>${Math.round(candChance('sen',rid)*100)}%</b><span>Голосование</span><b>${shortDate(q)}</b></div>`,
    opts:[{label:'Согласиться',hint:'выдвижение без затрат',fn(){ registerCand('sen',rid,q,true); }},
      {label:'Отказаться',hint:'',fn(){}}]});
}

/* ─── смена вице-президента ─────────────────────────────────────── */
function askReplaceVP(){
  if(!isPres()||!S.vp){ toast('Вице меняет президент'); return; }
  const kinds=VP_KIND.slice().sort(()=>Math.random()-0.5).slice(0,3);
  const cands=kinds.map(k=>makeVP(PL,k.id));
  sheetOpen({eye:'Президент · 1 действие и 10 веса',title:'Сменить вице-президента',
    body:`<p class="lead">${S.vp.name} уходит, новую кандидатуру утверждает Сенат. Отставленный вице не прощает —
        с честолюбием ${Math.round(S.vp.amb||40)} он может пойти против вас на праймериз.</p>`,
    opts:cands.map(c=>({label:c.name+' · '+(VP_KIND.find(k=>k.id===c.kind)||{}).name,
      hint:'палата '+c.sen+' · известность '+c.pop+' · честолюбие '+c.amb,
      fn(){ if(!pay({ap:1,cap:10},'Смена вице-президента'))return;
        if(!confirmSenate('vp',c,PL)){ logMsg('Сенат не утвердил '+c.name+'. Прежний вице остаётся.',1); render(); return; }
        const old=S.vp; S.exVP={name:old.name,amb:old.amb||50,q:S.q};
        S.vp={...c, since:S.q, jobQ:S.q-VP_TERM};
        logMsg('Новый вице-президент — '+c.name+'. '+old.name+' отправлен в отставку.',1);
        chron('Смена вице-президента: '+c.name+'.',''); render(); }}))
      .concat([{label:'Оставить как есть',hint:'',fn(){}}])});
}

/* ─── заседание правительства ───────────────────────────────────────
   Премьер задаёт кабинету приоритет на полгода: министры профильных
   ведомств работают лучше, страна чувствует направление. */
const CAB_PRIO=[
  {id:'econ', name:'Рост и инвестиции', posts:['eco','fin'], txt:'инвестиции растут каждый квартал'},
  {id:'soc',  name:'Социальная политика', posts:['soc'], txt:'пенсионеры и рабочие теплеют'},
  {id:'order',name:'Порядок в регионах', posts:['mvd','def'], txt:'напряжённость гаснет по всей стране'},
  {id:'world',name:'Внешние связи', posts:['mid'], txt:'соседи теплеют, спрос растёт'},
];
function askCabinet(){
  if(!isPM()){ toast('Заседание ведёт премьер'); return; }
  const cur=S.cabPrio&&S.cabPrio.until>=S.q?CAB_PRIO.find(x=>x.id===S.cabPrio.id):null;
  sheetOpen({eye:'Заседание правительства · 1 действие и 5 веса',title:'Приоритет кабинета',
    body:`<p class="lead">Два квартала министры работают на одну цель. ${cur?'Сейчас: «'+cur.name.toLowerCase()+'» до '+shortDate(S.cabPrio.until)+'.':''}</p>`,
    opts:CAB_PRIO.map(x=>({label:x.name,hint:x.txt+' · министры '+x.posts.map(p=>POSTS.find(z=>z.id===p).name.toLowerCase()).join(', ')+' сильнее',
      fn(){ if(!pay({ap:1,cap:5},'Заседание правительства'))return;
        S.cabPrio={id:x.id,until:S.q+2};
        x.posts.forEach(p=>{ const m=minOf(p); if(m)m.comp=clamp(m.comp+3,10,95); });
        logMsg('Заседание правительства: приоритет — '+x.name.toLowerCase()+'.',1); render(); }}))
      .concat([{label:'Не собирать',hint:'',fn(){}}])});
}
function cabTick(){
  const c=S.cabPrio; if(!c||c.until<S.q||!isPM())return;
  if(c.id==='econ')S.econ.invest=r1(S.econ.invest+1.4);
  if(c.id==='soc'){ shiftMood('pens',0.6,true); shiftMood('work',0.5,true); }
  if(c.id==='order')REGIONS.forEach(r=>S.unrest[r.id]=clamp(S.unrest[r.id]-1,0,100));
  if(c.id==='world'&&S.nb){ Object.values(S.nb).forEach(n=>n.rel=clamp(n.rel+0.8,0,100)); S.world.demand=clamp(S.world.demand+0.8,55,142); }
}

/* ─── квартал власти ────────────────────────────────────────────── */
function powerTick(){
  campPoll(); presPollTick(); cabTick(); mayorCandTick(); offerTick2();
  // президент меняет вице, которому не доверяет
  if(mySeat()==='vp'&&S.desk&&S.desk.trust<22&&!isPres()&&Math.random()<0.25&&S.pres){
    const party=S.pres.party, cand=makeVP(party);
    S.vp=confirmSenate('vp',cand,party)?cand:null;
    lostSeat('президент '+S.pres.name+' заменил вас другим вице-президентом');
  }
}

