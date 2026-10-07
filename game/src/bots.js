
/* ════════════════════════════════════════════════════════════════
   ШТАБЫ СОПЕРНИКОВ
   Партии ИИ не ждут, пока к ним придут. У каждой есть штаб и
   несколько ходов в квартал: компромат, поездки, кампания в печати,
   сделка, которую лидер предлагает вам сам, просьба голосов за свой
   закон, агитация в краях, работа с вашим партнёром. Чужой кабинет
   ведёт внешнюю политику, вписывает строки партнёров, строит,
   оспаривает референдумы и натравливает прокуратуру. Всё, что
   сделали штабы, видно в ленте «Ход соперников».
   ════════════════════════════════════════════════════════════════ */
function botLog(pid,t,k){ S.botLog=S.botLog||[]; S.botLog.unshift({q:S.q,pid,t,k:k||''}); if(S.botLog.length>50)S.botLog.pop(); }
function botAP(p){ return (seatsOf(p.id)>=70||Math.random()<0.5?1:0)+(hard()&&Math.random()<0.5?1:0); }   // в среднем ход-полтора в квартал
/* против кого играет штаб: против правящей партии, а правящая — против самой крупной оппозиции */
function botFoe(p){
  if(p.id!==S.gov.lead&&!inCoal(p.id))return S.gov.lead;
  const opp=S.parties.filter(x=>x.id!==p.id&&!inCoal(x.id)).sort(bySeats)[0];
  return opp?opp.id:null;
}
function botWeights(p){
  const L=flLeader(p.id,'h'), tr=L?L.trait:'prag', foe=botFoe(p), w=[];
  const add=(id,v,extra)=>{ if(v>0)w.push({id,v,...(extra||{})}); };
  add('dirt',(p.funds||0)>=15&&foe&&S.q-(p.dirtQ||-9)>=4?0.6+(foe===PL&&trail()>30?1.4:0)+((p.mom||0)<-3?0.8:0)+(tr==='fox'?1:0)-(tr==='ideo'?0.6:0):0,{foe});
  add('tour',S.q-(p.tourQ||-9)>=3?1:0);
  add('media',(p.funds||0)>=10&&S.q-(p.mediaQ||-9)>=3?0.5+((p.mom||0)<-3?1:0):0);
  if(foe===PL&&isPM()){
    const shaky=coalition().filter(id=>id!==PL&&id!==p.id&&(S.partners[id]||{anger:0}).anger>=1);
    add('court',shaky.length?1.6:0,{to:shaky[0]});
  }
  if(S.sep&&REGIONS.some(r=>(S.sep[r.id]||0)>=25)&&(p.st.reg||0)>=0.8&&S.q-(p.stokeQ||-9)>=4)add('stoke',0.7);
  const canAsk=hasVote()&&seatsOf(PL)>0&&(p.askedQ==null||S.q-p.askedQ>=4)&&(S.botAskQ==null||S.botAskQ<S.q-1);
  add('ask',canAsk?1.3:0);
  return w;
}
function hasVote(){ return S.you&&['dep','lead','pm','vice','min'].indexOf(mySeat())>=0; }
function botPick(w){ const sum=w.reduce((a,x)=>a+x.v,0); let t=Math.random()*sum; for(const x of w){ t-=x.v; if(t<=0)return x; } return w[0]; }

/* ─── ходы штаба ─────────────────────────────────────────────────── */
function botDirt(p,foe){
  p.funds=r1((p.funds||0)-15); p.dirtQ=S.q;
  if(Math.random()<0.15){ scOpenParty(p.id,'Заказ компромата раскрыт: штаб «'+p.short+'» платил журналистам',38);
    botLog(p.id,'попался на заказе компромата','b'); return; }
  if(foe===PL){
    if(scMine().length||Math.random()>0.3+trail()/220){ pressAll(-0.6); botLog(p.id,'вбросил в печать слухи о вас','b'); return; }
    scOpenYou(trail()>40?'trail':'life',ri(30,48));
    botLog(p.id,'слил на вас компромат','b'); return;
  }
  const t=P(foe); if(!t)return;
  scOpenParty(foe,pick(['Что скрывает штаб «'+t.short+'»','Деньги «'+t.short+'»: документы в редакции','Лидер «'+t.short+'» и госзаказ']),ri(32,52));
  botLog(p.id,'слил компромат на «'+t.short+'»');
}
function botTour(p){
  p.mom=clamp(r1((p.mom||0)+1.2),-14,14); p.tourQ=S.q;
  // едут туда, где их доля велика, а власть слаба, — с долей случая
  const strong=REGIONS.map(r=>({r,v:S.deputies.filter(d=>d.region===r.id&&d.party===p.id).length/Math.max(1,S.regSeats[r.id])*100+(50-regApproval(r.id))*0.5+rnd(0,25)}))
    .sort((a,b)=>b.v-a.v)[0].r;
  if(S.gov.lead===PL&&!inCoal(p.id))S.rmod[strong.id]=clamp(S.rmod[strong.id]-1.2,-22,22);
  botLog(p.id,'объехал '+strong.name.replace(/ (регион|область|край)$/,'')+(S.gov.lead===PL&&!inCoal(p.id)?' и настроил край против кабинета':''));
}
function botMedia(p){
  p.funds=r1((p.funds||0)-10); p.mom=clamp(r1((p.mom||0)+1),-14,14); p.mediaQ=S.q;
  if(botFoe(p)===PL)pressAll(-0.4);
  botLog(p.id,'провёл кампанию в печати'+(botFoe(p)===PL?' против вас':''));
}
function botCourt(p,to){
  const t=P(to); if(!t||!S.partners[to])return;
  S.partners[to].anger=clamp(S.partners[to].anger+0.8,0,6);
  botLog(p.id,'обхаживает вашего партнёра «'+t.short+'»','b');
}
function botStoke(p){
  const r=REGIONS.filter(x=>(S.sep[x.id]||0)>=25&&!regSov(x.id)).sort((a,b)=>S.sep[b.id]-S.sep[a.id])[0]; if(!r)return;
  S.sep[r.id]=clamp(S.sep[r.id]+5,0,100); p.stokeQ=S.q;
  botLog(p.id,'агитирует за права края '+r.name.replace(/ (регион|область|край)$/,''),'b');
}
/* лидер сам просит голоса ваших за свой закон — и запоминает ответ */
function botAsk(p){
  const ax=AX.slice().sort((a,b)=>Math.abs(p.st[b]||0)-Math.abs(p.st[a]||0))[0];
  const t=TOPICS.filter(x=>!x.special&&x.ax===ax&&!lawOn(x.id))[0]||TOPICS.filter(x=>!x.special&&x.ax===ax)[0]; if(!t)return;
  const stance=clamp(Math.round(p.st[ax]||1)||1,-2,2), bill={topic:t.id,stance,riders:[],by:p.id};
  const tl=tally(bill), others=tl.list.filter(x=>x.d.party!==PL&&x.st==='yes').length, mine=seatsOf(PL);
  if(others>=MAJ||others+mine<MAJ)return;            // ваши голоса ничего не решают — просить незачем
  p.askedQ=S.q; S.botAskQ=S.q;
  const L=flLeader(p.id,'h'), far=Math.abs((me().st[ax]||0)-stance);
  botLog(p.id,'просит ваших голосов за «'+t.name+'»');
  sheetOpen({eye:'Фракция «'+p.name+'» · '+dateLabel(),title:'Просьба о голосах',
    body:`<p class="lead">${L?L.name:p.leader} просит фракцию «${me().short}» поддержать закон «${t.name}» — ${stance<0?t.l:t.r}.
        Без ваших ${mandates(mine)} у них ${others} из ${MAJ}; с вами — хватает.</p>
      <div class="res"><span>Расхождение с вашим курсом</span><b class="${far>1.5?'bad':''}">${r1(far)}${far>1.5?' · фракция будет роптать':''}</b>
        <span>Отношение лидера</span><b>${L?Math.round(L.rel):'—'}</b></div>
      <p class="hint">Поддержка — должок: следующая сделка с ними дешевле на 10, лидер теплеет. Отказ он запомнит.</p>`,
    opts:[{label:'Поддержать',hint:'закон идёт в Сенат · лидер должен вам',fn(){
        if(L){ L.owe=1; L.rel=clamp(L.rel+8,0,100); }
        if(far>1.5)S.deputies.filter(d=>d.party===PL).forEach(d=>d.loyal=clamp(d.loyal-3,0,100));
        const up=resolveSenVote(bill);
        if(up.pass&&!(Math.random()<vetoChance(bill))){ enact(bill); logMsg('С вашими голосами принят закон «'+t.name+'», внесённый «'+p.short+'».',1); botLog(p.id,'провёл «'+t.name+'» с вашими голосами','g'); }
        else logMsg('Закон «'+t.name+'» прошёл Собрание с вашими голосами, но застрял дальше.',1);
        render(); }},
      {label:'Отказать',hint:'лидер обидится',fn(){ if(L)L.rel=clamp(L.rel-6,0,100); botLog(p.id,'получил от вас отказ','b'); }}]});
}
/* лидер сам приходит с предложением сделки, когда вам не хватает голосов */
function botOffer(){
  if(S.botOfferQ===S.q||!hasVote())return;
  let sb=null, need=0;
  if(S.bill&&canBill()){ const y=tally(S.bill).yes; if(y<MAJ&&y>=MAJ-45){ sb={k:'b',topic:S.bill.topic,stance:S.bill.stance,bill:S.bill}; need=MAJ-y; } }
  if(!sb&&isPM()&&budgetDue()&&!S.budget.submitted){ const y=budgetTally().yes; if(y<MAJ){ sb={k:'budget'}; need=MAJ-y; } }
  if(!sb&&S.motion&&S.motion.against===PL){ sb={k:'m'}; need=1; }
  if(!sb)return;
  const key=subjKey(sb);
  const c=S.parties.filter(p=>p.id!==PL&&!dealFor(p.id,'h',key)&&seatsOf(p.id)>=Math.min(need,30)&&dealDemand(p.id,'h',sb)!==null)
    .sort((a,b)=>dealDemand(a.id,'h',sb)-dealDemand(b.id,'h',sb))[0];
  if(!c||Math.random()>0.6)return;
  S.botOfferQ=S.q; S.dealDisc={pid:c.id,q:S.q};
  const L=flLeader(c.id,'h');
  botLog(c.id,'сам предложил вам сделку: '+subjName(sb));
  sheetOpen({eye:'Фракция «'+c.name+'» · предложение',title:L.name+' предлагает сделку',
    body:`<p class="lead">${L.name} («${c.short}», ${FT(L.trait).name.toLowerCase()}) сам пришёл с предложением: ${mandates(seatsOf(c.id))} за вами —
        ${subjName(sb)}. Пока он сам предлагает, цена ниже на 6.</p>
      <div class="res"><span>Просит</span><b>${dealDemand(c.id,'h',sb)}</b><span>Любит</span><b class="w">${DEAL_PAY.find(x=>x.id===FT(L.trait).likes).name.toLowerCase()}</b></div>`,
    opts:[{label:'Обсудить условия',hint:'к торгу: что предложить',fn:()=>askDealWith(c.id,'h',sb)},
      {label:'Не сейчас',hint:'',fn(){ L.rel=clamp(L.rel-2,0,100); }}]});
}

/* ─── чужой кабинет действует ───────────────────────────────────── */
function botGovTick(){
  if(isPM())return;
  const lead=P(S.gov.lead); if(!lead)return;
  // внешняя политика
  if(S.nb&&Math.random()<0.25){
    const open=NEIGHBOURS.filter(x=>{ const st=nbOf(x.id); return st&&!st.trade&&!sancOn(x.id)&&st.rel>=48; });
    if((lead.st.world||0)>0.2&&open.length){ const x=pick(open), f=tradeVotes(x.id);
      if(f.yes>=f.need){ nbOf(x.id).trade=true; nbOf(x.id).rel=clamp(nbOf(x.id).rel+8,0,100); shiftMood(TRADE_HURT[x.id],-3); shiftMood('biz',2);
        botLog(lead.id,'подписал торговое соглашение с «'+x.name+'»','g'); chron('Кабинет '+lead.leader+': торговое соглашение с «'+x.name+'».',''); }
      else botLog(lead.id,'не провёл через Сенат соглашение с «'+x.name+'»'); }
    const cold=NEIGHBOURS.filter(x=>{ const st=nbOf(x.id); return st&&st.rel<28&&!ourSanc(x.id); });
    if((lead.st.world||0)<-0.6&&cold.length&&Math.random()<0.4){ const x=pick(cold), st=nbOf(x.id);
      st.our=S.q+8; st.rel=clamp(st.rel-20,0,100); shiftMood('patr',2); shiftMood('biz',-2);
      botLog(lead.id,'ввёл санкции против «'+x.name+'»','b'); chron('Кабинет '+lead.leader+' ввёл санкции против «'+x.name+'».','b'); }
  }
  if(S.bcrisis&&Math.random()<0.35){
    const x=NB_(S.bcrisis.nb), hawk=(lead.st.order||0)>0.5;
    if(hawk&&Math.random()<0.5){ S.bcrisis.stage=2; S.unrest[S.bcrisis.rid]=clamp(S.unrest[S.bcrisis.rid]+6,0,100); botLog(lead.id,'ответил силой на границе с «'+x.name+'»','b'); }
    else if(Math.random()<0.6){ bcrisisEnd('Кабинет '+lead.leader+' урегулировал спор на границе с «'+x.name+'».',4); botLog(lead.id,'урегулировал кризис с «'+x.name+'»','g'); }
  }
  // строки партнёров в бюджете — раз в год
  if(budgetDue()&&S.botBudQ!==budgetYear()&&balance()>2){            // строки партнёров — только из профицита S.botBudQ=budgetYear();
    coalition().filter(id=>id!==lead.id&&id!==PL).forEach(id=>{ const a=bAsk(id); if(!a||bAskMet(a))return;
      if(a.kind==='spend')S.spend[a.id]=Math.max(S.spend[a.id],a.lvl); else S.tax[a.id]=Math.min(S.tax[a.id],a.lvl);
      if(S.partners[id])S.partners[id].anger=Math.max(0,S.partners[id].anger-1);
      botLog(lead.id,'вписал в бюджет строку партнёра «'+P(id).short+'»: '+bAskItem(a).name.toLowerCase()); }); }
  // референдум в крае: суд или договор
  if(S.rref&&!S.rref.court&&!S.rref.by_ai&&Math.random()<0.5){ const x=S.rref, r=R(x.rid); x.by_ai=1;
    if((lead.st.reg||0)<0||x.kind==='sov'){ x.court=true;
      if(Math.random()<0.35+(x.kind==='sov'?0.25:0)+courtSeats(lead.id)/courtN()*0.3){ S.rref=null; S.rrefCool=S.q+4; S.sep[x.rid]=clamp((S.sep[x.rid]||0)+8,0,100);
        botLog(lead.id,'добился в суде отмены референдума в крае '+r.name.replace(/ (регион|область|край)$/,''),'b'); regLog(x.rid,'Суд по иску кабинета отменил референдум.','b'); }
      else botLog(lead.id,'проиграл в суде иск против референдума'); }
    else { S.auto[x.rid]=Math.min(2,regAuto(x.rid)+1); S.sep[x.rid]=clamp((S.sep[x.rid]||0)-12,0,100); S.rref=null; S.rrefCool=S.q+4;
      botLog(lead.id,'договорился с краем '+r.name.replace(/ (регион|область|край)$/,'')+' о полномочиях','g'); regLog(x.rid,'Кабинет уступил полномочия до референдума.','g'); }
  }
  // прокуратура против вас, если вы в оппозиции и след длинный
  if(!inCoal(PL)&&!S.probe&&trail()>35&&Math.random()<0.12+trail()/600){
    const you=trail()>60&&Math.random()<0.4&&!isPres();
    caseOpen(you?{k:'политик',name:S.you.name,you:true}:{k:'помощник',name:depName(),aide:true},'trail',trail()*0.55+ri(6,14));
    botLog(lead.id,'натравил прокуратуру на ваших людей','b');
  }
  // и подталкивает дела против других соперников
  rcaseLive().filter(c=>c.pid!==lead.id&&!inCoal(c.pid)&&!c.pushed&&Math.random()<0.3).slice(0,1).forEach(c=>{
    c.pushed=true; c.ev=Math.round(clamp(c.ev+12,0,100)); c.push=0.08; bumpLegit(-1);
    botLog(lead.id,'подтолкнул дело против '+c.name+' («'+P(c.pid).short+'»)','b'); });
}

/* ─── квартал штабов ────────────────────────────────────────────── */
function botsTick(){
  if(!S.you||S.over)return;
  S.parties.filter(p=>p.id!==PL&&seatsOf(p.id)>0).forEach(p=>{
    const n=botAP(p); const used={};
    for(let i=0;i<n;i++){
      const w=botWeights(p).filter(x=>!used[x.id]); if(!w.length)break;
      const a=botPick(w); used[a.id]=1;
      if(a.id==='dirt')botDirt(p,a.foe);
      if(a.id==='tour')botTour(p);
      if(a.id==='media')botMedia(p);
      if(a.id==='court')botCourt(p,a.to);
      if(a.id==='stoke')botStoke(p);
      if(a.id==='ask'&&!mopen)botAsk(p);
    }
  });
  botGovTick();
  botOffer();
}

/* ─── лента «Ход соперников» ────────────────────────────────────── */
function botFeed(n){
  const log=(S.botLog||[]).filter(x=>S.q-x.q<=2).slice(0,n||12);
  return panel({title:'Ход соперников',meta:'последние кварталы',body:log.length?log.map(x=>{ const p=P(x.pid);
      return `<div class="crow"><s>${shortDate(x.q)}</s><span>${p?emblem(p,14)+' <b>'+p.short+'</b> ':''}<span class="${x.k==='b'?'bad':x.k==='g'?'good':''}">${x.t}</span></span></div>`; }).join('')
    :'<div class="empty">Штабы затаились: в последние кварталы соперники ничего заметного не сделали.</div>'});
}
