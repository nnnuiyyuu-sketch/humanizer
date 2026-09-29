/* ════════════════════════════════════════════════════════════════
   Ход игры: действия, события, коалиция, выборы.
   ════════════════════════════════════════════════════════════════ */

/* ─── три действия ─────────────────────────────────────────────────
   Действие — это ход, а не ресурс: их три на квартал, они не копятся
   и сгорают при закрытии квартала. Вес, казна и касса — отдельные
   счета, которые тратятся вместе с действием. Каждое потраченное
   действие записывается с подписью: игрок видит, на что ушёл ход. */
const AP_MAX=3;
function useAP(n,label){ if(S.ap<n){toast('Не осталось действий на квартал');return false;}
  S.ap-=n; for(let i=0;i<n;i++)apNote(label); return true; }
function apNote(label){
  S.apLog=(S.apLog||[]).filter(x=>x.q===S.q);
  S.apLog.push({q:S.q,t:label||SHEET_T||'Действие'});
}
/* возврат хода, если дальше не хватило веса или денег */
function apBack(){ S.ap=Math.min(AP_MAX,S.ap+1); if(S.apLog&&S.apLog.length)S.apLog.pop(); }
function apSpent(){ return (S.apLog||[]).filter(x=>x.q===S.q); }
/* цена целиком: ход, вес, казна, касса. Если чего-то нет — не списывается ничего */
function pay(c,label){
  if((c.ap||0)>S.ap){ toast('Не осталось действий на квартал'); return false; }
  if(c.cap&&S.cap<c.cap){ toast('Не хватает политического веса: нужно '+Math.round(c.cap)); return false; }
  if(c.gold&&S.treasury<c.gold){ toast('В казне нет '+Math.round(c.gold)+' млрд'); return false; }
  if(c.funds&&S.funds<c.funds){ toast('В партийной кассе нет '+Math.round(c.funds)+' млн'); return false; }
  if(c.ap)useAP(c.ap,label);
  if(c.cap)S.cap-=c.cap;
  if(c.gold)S.treasury=r1(S.treasury-c.gold);
  if(c.funds)S.funds=r1(S.funds-c.funds);
  return true;
}
function payCap(n){ if(S.cap<n){toast('Не хватает политического веса');return false;} S.cap-=n; return true; }
function payGold(n){ if(S.treasury<n){toast('В казне нет таких денег');return false;} S.treasury=r1(S.treasury-n); return true; }
function payFunds(n){ if(S.funds<n){toast('Партийная касса пуста');return false;} S.funds=r1(S.funds-n); return true; }
function addCap(n){ S.cap=clamp(S.cap+n,0,100); }

function capIncome(){
  let v=2.6+(approval()-46)*0.09+(seatsOf(PL)/SEATS)*7;
  if(!isPM())v=1.8+(approval()-42)*0.07+(seatsOf(PL)/SEATS)*5;
  v-=avgUnrest()*0.03;
  if(S.role==='junior')v+=1;
  return r1(clamp(v,-2,11));
}
function fundIncome(){
  let v=6+seatsOf(PL)*0.14+S.mood.biz*0.05;
  if(isPM())v+=3;
  return r1(v);
}

/* ─── действия кабинета ──────────────────────────────────────── */
const ACT = {
  visit(rid){
    const c=visitCost();
    if(!pay({ap:1,gold:c.gold||0,funds:c.funds||0},'Поездка: '+R(rid).name))return;
    const r=R(rid), g=govOf(rid);
    const warm=hasTrait('zemsky')?2:0;
    S.rmod[rid]=clamp(S.rmod[rid]+ri(3,6)+warm,-22,22);
    S.unrest[rid]=clamp(S.unrest[rid]-ri(4,9)-warm,0,100);
    if(g)g.rel=clamp(g.rel+ri(2,5),0,100);
    bumpRep('folk',0.9);
    let also='';
    if(hasTrait('zemsky')){                       // свой в регионах цепляет и соседей
      NB(rid).forEach(n=>{ S.rmod[n]=clamp(S.rmod[n]+1.5,-22,22);
        S.unrest[n]=clamp(S.unrest[n]-2,0,100); });
      also=' Соседние субъекты тоже заметили приезд.';
    }
    logMsg('Поездка в '+r.cap+': поддержка в регионе выросла.'+also);
    toast('Регион принял визит');
  },
  address(gid){
    if(!pay({ap:1,cap:6},'Обращение: '+G(gid).name.toLowerCase()))return;
    const g=G(gid), k=hasTrait('orator')?1.6:1;
    shiftMood(gid,ri(3,6)*k);
    GROUPS.forEach(x=>{ if(x.id!==gid&&axDist(x.pref,g.pref)>2.2)shiftMood(x.id,-1.2); });
    bumpRep('folk',0.6);
    logMsg('Обращение к нации: ставка на группу «'+g.name.toLowerCase()+'».');
    toast('Речь произнесена');
  },
  poll(){
    if(!pay({ap:1,funds:9},'Заказана социология'))return;
    S.poll=S.q; logMsg('Заказана социология: цифры по стране уточнены.'); toast('Опрос готов');
  },
  fundraise(){
    if(!pay({ap:1},'Сбор средств'))return;
    let v=ri(14,26)+Math.round(S.mood.biz*0.16);
    if(hasTrait('media'))v=Math.round(v*1.35);
    if(S.you.origin==='business')v=Math.round(v*1.25);
    S.funds=r1(S.funds+v); shiftMood('intel',-1.4); shiftMood('work',-0.8);
    bumpRep('honest',-0.5);
    logMsg('Сбор средств: касса пополнена на '+v+' млн.');
    toast('+'+v+' млн в кассу');
  },
  noconf(){ askMotion(); },
  question(){ askQuestion(); },
  whip(){
    if(!S.bill){toast('На столе нет проекта');return;}
    if(!pay({ap:1,cap:capCost(11,'lobby')},'Работа с колеблющимися'))return;
    const t=tally(S.bill);let n=0;
    t.list.forEach(x=>{ if(x.st!=='und')return;
      const g=inCoal(x.d.party)?ri(7,13):ri(2,7);
      x.d.pledge=(x.d.pledge||0)+g; x.d.pledgeNo=S.bill.id; n++; });
    logMsg('Работа с колеблющимися: обработано '+n+' депутатов.');
    toast(n?'Обработано: '+n:'Колеблющихся нет');
  },
  talk(pid){
    if(!pay({ap:1,cap:capCost(5,'talk')},'Переговоры с фракцией «'+P(pid).name+'»'))return;
    const p=P(pid), n=S.deputies.filter(d=>d.party===pid);
    const g=ri(4,9);
    n.forEach(d=>d.rel=clamp(d.rel+g+ri(-2,2),0,100));
    if(S.partners[pid])S.partners[pid].anger=Math.max(0,S.partners[pid].anger-1);
    bumpRep('folk',0.3);
    logMsg('Переговоры с фракцией «'+p.name+'»: отношения +'+g+'.');
    toast('Фракция выслушала вас');
  },
};

/* ─── работа с депутатом ─────────────────────────────────────── */
const LOBBY = [
  {id:'talk', name:'Личная беседа', cap:3, gold:0, txt:'Полчаса в кабинете и обещание помнить услугу.'},
  {id:'comm', name:'Место в комитете', cap:8, gold:0, txt:'Пост в профильном комитете. Однопартийцы заметят.'},
  {id:'cash', name:'Деньги округу', cap:0, gold:9, txt:'Стройка в его округе за счёт казны.'},
  {id:'dirt', name:'Разговор по-плохому', cap:6, gold:0, txt:'Намёк на папку. Сработает не со всяким.'},
  {id:'join', name:'Позвать во фракцию', cap:16, gold:10, need:d=>d.party!==PL&&d.rel>=64,
   txt:'Мандат переходит к вам. Его партия этого не забудет.'},
];
function lobby(depId,kind){
  const d=S.deputies.find(x=>x.id===depId), l=LOBBY.find(x=>x.id===kind);
  if(!d||!l)return;
  if(kind==='dirt'&&hasTrait('clean')){
    toast('Незапятнанный такими вещами не занимается'); return;
  }
  if(kind==='join'&&regOn('imperative')){ toast('Императивный мандат: перешедший из фракции теряет место'); return; }
  if(!pay({ap:1},'Депутат '+d.name+': '+l.name.toLowerCase()))return;
  if(l.cap&&!payCap(capCost(l.cap,'lobby'))){apBack();return;}
  if(l.gold&&!payGold(l.gold)){apBack();return;}
  d.deals++;
  if(kind==='talk'){ d.rel=clamp(d.rel+ri(6,12),0,100); d.note='беседовал с вами'; }
  if(kind==='comm'){ d.rel=clamp(d.rel+ri(14,22),0,100); d.note='получил комитет';
    const mate=S.deputies.filter(x=>x.party===d.party&&x.id!==d.id);
    if(mate.length){const m=pick(mate);m.rel=clamp(m.rel-ri(4,9),0,100);m.note='обойдён при дележе';} }
  if(kind==='cash'){ d.rel=clamp(d.rel+ri(10,18),0,100); d.note='получил стройку в округ';
    S.rmod[d.region]=clamp(S.rmod[d.region]+1.5,-22,22);
    addTrail(d.integ*0.085,'стройка в округе '+d.name); }  // честный проговорится скорее
  if(kind==='dirt'){
    if(Math.random()<clamp(d.integ/125,0.12,0.72)){
      d.rel=clamp(d.rel-ri(16,28),0,100); d.note='обиделся на нажим';
      shiftAll(-1.4); addCap(-6);
      bumpRep('honest',-9); bumpRep('firm',2);
      career('Скандал: разговор с депутатом '+d.name+' попал в печать.');
      logMsg('Депутат '+d.name+' вынес разговор на публику. Скандал.',1);
      chron('Скандал вокруг давления на депутата '+d.name+'.','b');
      sheetOpen({eye:'Утечка',title:'Разговор попал в газеты',
        body:'<p>'+d.name+' пересказал журналистам содержание беседы. Пресса пишет о шантаже в стенах Собрания.</p>',
        acts:[{label:'Принять к сведению'}]});
      render();return;
    }
    d.rel=clamp(d.rel+ri(18,30),0,100); d.note='стал сговорчивее';
    bumpRep('honest',-2.5); bumpRep('firm',1.2);
    addTrail(d.integ*0.14,'нажим на '+d.name);
  }
  if(kind==='join'){
    const from=d.party;
    const ch=clamp((d.rel-55)/58+(70-d.loyal)/150,0.08,0.82);
    if(Math.random()<ch){
      d.party=PL; d.rel=clamp(d.rel+6,0,100); d.loyal=ri(55,80); d.note='перешёл к вам';
      S.seats[from]--; S.seats[PL]=(S.seats[PL]||0)+1;
      S.deputies.filter(x=>x.party===from).forEach(x=>x.rel=clamp(x.rel-6,0,100));
      if(S.partners[from])S.partners[from].anger=clamp(S.partners[from].anger+1.5,0,6);
      bumpRep('firm',1.5);
      addTrail(ri(4,9),'переход '+d.name);
      logMsg('Депутат '+d.name+' перешёл из «'+P(from).name+'» в вашу фракцию.',1);
      chron('Депутат '+d.name+' сменил фракцию на вашу.','g');
    } else {
      d.rel=clamp(d.rel-15,0,100); d.note='отказал вам';
      S.deputies.filter(x=>x.party===from).forEach(x=>x.rel=clamp(x.rel-4,0,100));
      logMsg('Депутат '+d.name+' отказался переходить и рассказал об этом своим.',1);
    }
    render();return;
  }
  logMsg('Работа с депутатом: '+d.name+' ('+P(d.party).short+'), отношение '+Math.round(d.rel)+'.');
  toast('Отношение: '+Math.round(d.rel));
  render();
}

/* ─── законопроект ───────────────────────────────────────────── */
function newBill(topic){
  S.bill={topic,stance:1,riders:[],regTarget:REGIONS[0].id,by:PL,id:S.billNo+1};
}
/* ─── комитеты ───────────────────────────────────────────────── */
function setChair(ax,depId){
  if(!pay({ap:1,cap:6},'Председатель комитета'))return;
  const old=S.comm[ax]?S.deputies.find(d=>d.id===S.comm[ax]):null;
  if(old){ old.rel=clamp(old.rel-9,0,100); old.note='потерял комитет'; }
  const d=S.deputies.find(x=>x.id===depId);
  if(!confirmSenate('chair',d,d.party)){
    if(old)S.comm[ax]=old.id;
    logMsg('Сенат не утвердил '+d.name+' председателем комитета «'+AXNAME[ax]+'».',1);
    toast('Сенат отклонил кандидатуру'); render(); return;
  }
  S.comm[ax]=depId; d.rel=clamp(d.rel+11,0,100); d.note='возглавил комитет';
  logMsg('Комитет по теме «'+AXNAME[ax]+'» возглавил '+d.name+' ('+P(d.party).short+').');
  toast('Комитет закреплён');
  render();
}
/* ─── путь закона ─────────────────────────────────────────────────
   Собрание → Сенат → подпись президента. Останавливается на первой
   же ступени, где не хватило голосов; вето снимается двумя третями
   Собрания — Сенат своё слово уже сказал. */
function pathRow(name,who,res,verdict,ok){
  return `<div class="stg ${ok?'ok':'no'}"><i>${name}</i><b>${who}</b>
    ${res?`<u>${res.yes} : ${res.no}</u>`:'<u></u>'}
    <span class="stamp ${ok?'y':'n'}">${verdict}</span></div>`;
}
function billPath(b,low,up,pres,ok,cl){
  const rows=[pathRow('Народное собрание','нужно '+MAJ+' из '+SEATS,low,low.pass?'принят':'отклонён',low.pass)];
  // ступень прений видна отдельно: закон теряют здесь чаще, чем на голосовании
  if(cl)rows.push(pathRow('Прения в Сенате','клотур: нужно '+cl.need+' из '+SEN_SEATS,
    {yes:cl.got,no:SEN_SEATS-cl.got},cl.ok?'прения закрыты':'обструкция',cl.ok));
  if(up)rows.push(pathRow('Сенат','нужно '+SEN_MAJ+' из '+SEN_SEATS,up,up.pass?'принят':'отклонён',up.pass));
  if(pres)rows.push(pathRow('Президент',S.pres.name+' · '+P(S.pres.party).short,null,pres.veto?'вето':'подписан',!pres.veto));
  return `<p class="lead">${stanceLine(b)}</p><div class="path">${rows.join('')}</div>`;
}
function refLocked(topic){
  const l=lawOn(topic);
  return !!(l&&l.ref&&l.until>S.q);
}
function submitBill(){
  const b=S.bill; if(!b)return;
  if(refLocked(b.topic)){
    toast('Решение референдума нельзя переписать до '+dateLabel(lawOn(b.topic).until)); return; }
  if(!canBill()){ toast('Ни мандата, ни поста: внести проект некому'); return; }
  if(regOn('fast')&&isPM()&&!b.fastAsked){
    b.fastAsked=true;
    sheetOpen({eye:'Регламент · ускоренное рассмотрение',title:'Каким порядком вносить',
      body:`<p class="lead">Проект правительства может идти в зал, минуя комитет и поправки. Оппозиция это запомнит.</p>`,
      opts:[{label:'Обычный порядок',hint:'комитет, поправки, голосование',fn(){ b.fast=false; submitBill(); }},
        {label:'Ускоренно',hint:'сразу на голосование · ещё 4 веса · оппозиция злее',fn(){
          if(S.cap<12){ toast('Не хватает веса: нужно 12'); b.fastAsked=false; return; }
          b.fast=true; submitBill(); }}]});
    return;
  }
  if(!pay({ap:1,cap:b.fast?12:8},'Внесён законопроект «'+T(S.bill.topic).name+'»'+(b.fast?' (ускоренно)':'')))return;
  S.billNo++;
  S.bill=null;                       // дальше проект живёт своим ходом, а не на столе
  if(b.fast){
    S.deputies.filter(d=>!inCoal(d.party)).forEach(d=>d.rel=clamp(d.rel-2,0,100));
    logMsg('«'+T(b.topic).name+'» внесён в ускоренном порядке: без комитета и поправок.',1);
    voteStage(b,{verdict:'forced'},null);
    render(); return;
  }
  commStage(b);
  render();
}

/* ═══ СОБРАНИЕ: КОМИТЕТ, ПОПРАВКИ, ГОЛОСОВАНИЕ ════════════════════
   Нижняя палата была одной ступенью. Ступеней теперь три, и первая
   самая тихая: до зала проект доходит не всегда, а до голосования
   доходит уже не тем текстом, каким его вносили. */

/* ─── комитетская стадия ──────────────────────────────────────────
   Профильный комитет читает проект первым. Свой председатель ведёт
   его в зал с рекомендацией, чужой может продержать под сукном
   до трёх кварталов — и это дороже прямого отказа. */
function commChair(ax){
  const id=S.comm&&S.comm[ax]; if(!id)return null;
  return S.deputies.find(d=>d.id===id)||null;
}
function commStage(b){
  const t=T(b.topic), ch=commChair(t.ax);
  if(!ch){ floorStage(b,{verdict:'none'}); return; }
  const friendly=ch.party===PL||inCoal(ch.party);
  const cv=commVote(b);                                              // члены комитета голосуют первыми
  const dealt=!!dealBillLine(ch.party,'h',b);
  const like=(0.95-Math.abs(ch.st[t.ax]-b.stance))*24+(ch.rel-50)*0.4+(friendly?18:-6)+(dealt?30:0);
  if(like>14||cv.yes>=cv.no*1.6){ floorStage(b,{verdict:'back',ch,cv}); return; }        // рекомендует
  // Держать проект председатель может, но не обязан: у комитета есть
  // и своя работа, и своя репутация, которую портит откровенный саботаж.
  // Свой председатель не хоронит вообще — он просто не рекомендует;
  // чужой хоронит смелее, если его поддержало большинство комитета.
  const hold=friendly?0:clamp((-like-8)/54,0,0.62)*(cv.no>cv.yes?1:0.35);
  if(like>-8||Math.random()>=hold){ floorStage(b,{verdict:cv.no>cv.yes?'against':'flat',ch,cv}); return; }
  // председатель кладёт проект под сукно
  S.commHold={bill:{...b,riders:[...(b.riders||[])]}, ax:t.ax, ch:ch.id, left:ri(2,COMM_HOLD), q:S.q, cv};
  addCap(-2);
  logMsg('Комитет по теме «'+AXNAME[t.ax]+'» не выпустил «'+t.name+'» в зал.',1);
  chron('Комитет задержал «'+t.name.toLowerCase()+'».','b');
  sheetOpen({eye:'Комитет · '+dateLabel(),title:'Проект застрял в комитете',
    body:`<p class="lead">«${t.name}» ушёл в профильный комитет и оттуда не вышел.
        Председатель ${ch.name} («${P(ch.party).short}») не назначил слушаний — в зал проект не попадёт,
        пока комитет не отдаст его сам.</p>
      <div class="res"><span>Председатель</span><b class="w">${ch.name}</b>
        <span>Фракция</span><b class="w">${P(ch.party).name}</b>
        <span>Отношение к вам</span><b class="${ch.rel<40?'bad':''}">${Math.round(ch.rel)}</b>
        <span>Голосование комитета</span><b class="bad">${cv.yes} за · ${cv.no} против</b>
        <span>Пролежит</span><b>${quarters(S.commHold.left)}</b></div>
      <p class="hint">Вытащить проект можно голосами зала: это стоит ${COMM_CAP} веса и требует
        поддержки большинства — комитет не любит, когда через него переступают.</p>`,
    opts:[
      {label:'Вытащить проект в зал',hint:'вес '+COMM_CAP+' · нужно большинство подписей',fn:()=>discharge()},
      {label:'Договориться с лидером фракции «'+P(ch.party).short+'»',hint:'сделка — и председатель отдаст проект',
       fn(){ askDeals({k:'b',topic:b.topic,stance:b.stance,bill:S.commHold.bill}); }},
      {label:'Договориться с председателем',hint:'работа с депутатом',fn(){ openDep(ch.id); }},
      {label:'Ждать',hint:'выйдет сам через '+quarters(S.commHold.left),fn(){}}]});
}
/* проект, пролежавший срок, выходит в зал сам */
function commHoldTick(){
  const h=S.commHold; if(!h)return;
  const ch=S.deputies.find(d=>d.id===h.ch);
  if(ch&&dealBillLine(ch.party,'h',h.bill))h.left=0;             // о проекте договорились с его фракцией
  h.left--;
  if(h.left>0)return;
  S.commHold=null;
  logMsg('Комитет наконец отдал «'+T(h.bill.topic).name+'» в зал.',1);
  floorStage(h.bill,{verdict:'flat',ch:S.deputies.find(d=>d.id===h.ch)});
}
/* принудительное изъятие: подписи большинства против воли комитета */
function discharge(){
  const h=S.commHold; if(!h){toast('В комитетах ничего не залежалось');return;}
  if(!pay({ap:1,cap:COMM_CAP},'Проект вытащен из комитета'))return;
  const b=h.bill, t=T(b.topic);
  // подписи собирают те, кто и так за проект: считаем по обычной поддержке
  const sign=S.deputies.filter(d=>support(d,b)>0).length;
  const ch=S.deputies.find(d=>d.id===h.ch);
  if(sign<MAJ){
    addCap(-3);
    logMsg('Подписей за изъятие «'+t.name+'» из комитета собрано '+sign+' при нужных '+MAJ+'.',1);
    sheetOpen({eye:'Изъятие из комитета',title:'Подписей не хватило',
      body:voteBar(sign,SEATS-sign,MAJ)+
        `<p>Зал не захотел переступать через комитет: ${sign} подписей при нужных ${MAJ}.
          Проект остаётся у председателя ещё ${quarters(h.left)}.</p>`,
      acts:[{label:'Закрыть'}]});
    render(); return;
  }
  S.commHold=null;
  if(ch){ ch.rel=clamp(ch.rel-14,0,100); ch.note='обойдён через зал'; }
  bumpRep('firm',3);
  logMsg('«'+t.name+'» изъят из комитета подписями '+sign+' депутатов.',1);
  chron('Зал забрал «'+t.name.toLowerCase()+'» у комитета.','');
  floorStage(b,{verdict:'forced',ch});
}

/* ─── поправки с зала ─────────────────────────────────────────────
   Между комитетом и голосованием текст живёт своей жизнью. Поправку
   вносит тот, кому проект нужен другим, — и отбиться от неё стоит
   голосов, которых потом может не хватить на сам закон. */
function pickAmend(b,rep0){
  const t=T(b.topic);
  const pool=AMENDS.filter(a=>{
    if(a.id==='harden'&&Math.abs(b.stance)>=2)return false;
    if(a.id==='pork'&&(b.riders||[]).indexOf('money')>=0)return false;
    return true;
  });
  if(!pool.length)return null;
  // кто вносит: председатель комитета, если он против, иначе крупнейшая чужая фракция
  const opp=S.parties.filter(p=>p.id!==PL&&!inCoal(p.id)).sort((x,y)=>seatsOf(y.id)-seatsOf(x.id))[0];
  const by=(rep0&&rep0.ch&&rep0.verdict!=='back')?rep0.ch.party:(opp?opp.id:PL);
  const a=pick(pool);
  const reg=pick(REGIONS);
  return {a, by, reg:reg.id,
    soft:a.id==='water'?0.6:1,
    stance:a.id==='harden'?clamp(b.stance+Math.sign(b.stance||1),-2,2):b.stance};
}
function amendStage(b,rep0){
  // поправку вносят не всегда: спокойный проект проходит как есть
  const heat=Math.abs(b.stance)*0.14+(S.deputies.filter(d=>support(d,b)<-10).length/SEATS)*0.8;
  if(Math.random()>clamp(heat,0.1,0.62)){ voteStage(b,rep0,null); return; }
  const am=pickAmend(b,rep0);
  if(!am){ voteStage(b,rep0,null); return; }
  const t=T(b.topic), A=am.a, byP=P(am.by);
  const cost=capCost(AMEND_CAP,'lobby');
  // сколько голосов поправка приносит и сколько отнимает
  const gain=amendGain(b,am);
  sheetOpen({eye:'Второе чтение · '+dateLabel(),title:'Поправка с зала',
    body:`<p class="lead">К «${t.name}» внесена поправка: <b>${A.name.toLowerCase()}</b>.
        Вносит ${byP?byP.name:'зал'}. ${A.txt}</p>
      <div class="res"><span>Что меняет</span><b class="w">${A.eff}</b>
        ${A.id==='pork'?`<span>Куда идут деньги</span><b class="w">${R(am.reg).name}</b>`:''}
        <span>Голосов, если принять</span><b class="${gain>0?'good':'bad'}">${sign(gain)}</b>
        <span>Отбиться стоит</span><b>вес ${cost}</b></div>
      <p class="hint">Принять поправку — значит получить голоса ценой текста. Отбиться — сохранить
        текст ценой голосов и веса. Третьего в регламенте нет.</p>`,
    opts:[
      {label:'Принять поправку',hint:'текст меняется, голоса приходят',
       fn(){ applyAmend(b,am); voteStage(b,rep0,am); }},
      {label:'Отбиваться',hint:'вес '+cost+' · поправка может пройти и без вас',
       fn(){ if(!payCap(cost)){ applyAmend(b,am); voteStage(b,rep0,am); return; }
         const forA=S.deputies.filter(d=>amendVote(d,b,am)).length;
         if(forA>=MAJ){
           logMsg('Поправку «'+A.name.toLowerCase()+'» приняли против вашей воли ('+forA+' голосов).',1);
           applyAmend(b,am); voteStage(b,rep0,am);
         } else {
           bumpRep('firm',2);
           logMsg('Поправка «'+A.name.toLowerCase()+'» отклонена: за неё '+forA+' при нужных '+MAJ+'.');
           voteStage(b,rep0,null);
         } }}]});
}
function amendVote(d,b,am){
  const A=am.a, t=T(b.topic);
  let v=support(d,b)*-0.35;                       // кто против закона, тот за поправку
  if(A.pull.opp&&!inCoal(d.party)&&d.party!==PL)v+=A.pull.opp;
  if(A.pull.coal&&inCoal(d.party))v+=A.pull.coal;
  if(A.id==='pork')v+= d.region===am.reg?A.pull.reg:A.pull.rest;
  if(A.id==='harden')v+= Math.abs(d.st[t.ax]-am.stance)<0.7?A.pull.wing:A.pull.centre;
  if(A.id==='rider')v+= d.party===am.by?A.pull.author:A.pull.opp;
  v+=noise(d.id+'am'+A.id+S.billNo,10);
  return v>0;
}
function amendGain(b,am){
  const was=S.deputies.filter(d=>support(d,b)>0).length;
  const copy={...b, stance:am.stance, riders:[...(b.riders||[])]};
  if(am.a.id==='pork'){ copy.riders=copy.riders.concat(['money']); copy.regTarget=am.reg; }
  const now=S.deputies.filter(d=>support(d,copy)>0).length;
  return now-was;
}
function applyAmend(b,am){
  const A=am.a;
  b.amend=A.id;
  if(A.id==='water')b.weak=0.6;
  if(A.id==='sunset')b.sunset=16;
  if(A.id==='harden')b.stance=am.stance;
  if(A.id==='pork'){ b.riders=(b.riders||[]).concat(['money']); b.regTarget=am.reg;
    payGold(12); S.rmod[am.reg]=clamp(S.rmod[am.reg]+2,-22,22); }
  if(A.id==='rider'){ b.rider2=true; addTrail(4,'посторонний пункт в законе'); }
  logMsg('В «'+T(b.topic).name+'» внесена поправка: '+A.name.toLowerCase()+'.');
}

/* ─── экран голосования ───────────────────────────────────────────
   Табло и полукруг живут в разделе интерфейса (voteBoard, archSvg):
   здесь только ступени, которые их показывают. */
/* доска перед голосованием: прогноз, работа с залом, кнопка «ставить» */
function voteStage(b,rep0,am){
  const t=T(b.topic);
  const draw=()=>{
    const tl=tally(b);
    const cvs=rep0&&rep0.cv?' '+rep0.cv.yes+':'+rep0.cv.no:'';
    const rec=rep0&&rep0.verdict==='back'?'<span class="tag g">комитет рекомендует'+cvs+'</span>':
              rep0&&rep0.verdict==='against'?'<span class="tag r">комитет против'+cvs+'</span>':
              rep0&&rep0.verdict==='forced'?'<span class="tag r">в обход комитета</span>':
              rep0&&rep0.cv?'<span class="tag">комитет'+cvs+'</span>':'';
    sheetOpen({eye:'Голосование в Собрании · '+dateLabel(),title:t.name,
      body:`<p class="lead">${stanceLine(b)} ${rec}</p>
        ${houseBoard(tl.list,tl.yes,tl.no,MAJ,{final:false,what:'прогноз перед подачей голосов'})}
        <p class="hint">Прогноз, а не итог: колеблющиеся падают в свою сторону в момент подачи голосов.
          Кворум — ${QUORUM} мандатов, при явке ниже голосование переносят.</p>`,
      opts:[
        {label:'Ставить на голосование',hint:'прогноз '+tl.yes+' при нужных '+MAJ,
         fn(){ callVote(b,rep0,am); }},
        {label:'Договориться с лидерами фракций',hint:'сделка: фракция голосует за вас · '+(dealRoundPaid(subjKey({k:'b',topic:b.topic,stance:b.stance}))?'раунд оплачен':'ход на квартал'),
         fn(){ S.pendVote={b,rep0,am}; askDeals({k:'b',topic:b.topic,stance:b.stance,bill:b,back:1}); }},
        ...(tl.und?[{label:'Работать с колеблющимися',hint:'вес '+capCost(11,'lobby')+' · '+tl.und+' человек',
         fn(){ if(!payCap(capCost(11,'lobby'))){draw();return;}
           let k=0; tally(b).list.forEach(x=>{ if(x.st!=='und')return;
             x.d.pledge=(x.d.pledge||0)+(inCoal(x.d.party)?ri(7,13):ri(2,7)); x.d.pledgeNo=b.id; k++; });
           logMsg('Работа с колеблющимися перед голосованием: '+k+' депутатов.');
           draw(); }}]:[]),
        ...(rep0&&rep0.ch&&rep0.ch.party!==PL?[{label:'Просить слова у председателя комитета',
         hint:'вес 5 · его фракция услышит',
         fn(){ if(!payCap(5)){draw();return;}
           const ch=rep0.ch; ch.rel=clamp(ch.rel+ri(4,9),0,100);
           S.deputies.filter(d=>d.party===ch.party).forEach(d=>{
             if(Math.random()<0.4){d.pledge=(d.pledge||0)+ri(3,8);d.pledgeNo=b.id;} });
           logMsg('Председатель комитета выступил по «'+t.name+'»: фракция прислушалась.');
           draw(); }}]:[]),
        {label:'Снять с рассмотрения',hint:'вес 3 · вернуться к нему позже нельзя',
         fn(){ addCap(-3); logMsg('«'+t.name+'» снят с рассмотрения перед голосованием.',1); render(); }}]});
  };
  draw();
}
/* сама подача голосов: кворум, счёт, доска с итогом */
function callVote(b,rep0,am){
  const t=T(b.topic);
  // явка: своих в зале держит дисциплина, чужих — интерес к теме
  const present=Math.round(SEATS*clamp(0.82+Math.abs(b.stance)*0.05+(coalSeats()/SEATS-0.5)*0.1,0.7,1));
  if(present<QUORUM){
    addCap(-2);
    logMsg('Кворума нет: в зале '+present+' при нужных '+QUORUM+'. Голосование перенесено.',1);
    sheetOpen({eye:'Кворум',title:'Зал не собрался',
      body:`<p>В зале ${present} депутатов при нужных ${QUORUM}. Председатель перенёс голосование
        на следующий квартал — за это время расклад успеет измениться.</p>`,
      acts:[{label:'Принять к сведению'}]});
    S.commHold={bill:b, ax:t.ax, ch:null, left:1, q:S.q};
    render(); return;
  }
  const low=resolveVote(b);
  if(rep0&&rep0.verdict==='back')low.yes=Math.min(SEATS,low.yes+ri(3,9));
  if(rep0&&rep0.verdict==='against')low.yes=Math.max(0,low.yes-ri(2,6));
  S.pendVote=null;
  low.no=SEATS-low.yes; low.pass=low.yes>=MAJ;
  S.votes.unshift({no:S.billNo,q:S.q,name:t.name,stance:b.stance,yes:low.yes,no:low.no,pass:low.pass,house:'соб'});
  sheetOpen({eye:'Поимённое голосование · '+dateLabel(),title:t.name,
    body:`<p class="lead">${stanceLine(b)}</p>
      ${houseBoard(tally(b).list,low.yes,low.no,MAJ,{what:'поимённое голосование',
        verdict:low.pass?'принят в Собрании':'отклонён Собранием'})}
      <div class="res"><span>Явка</span><b>${present} из ${SEATS}</b>
        ${am?`<span>Текст с поправкой</span><b class="w">${am.a.name.toLowerCase()}</b>`:''}</div>`,
    acts:[{label:low.pass?'В Сенат':'Закрыть',fn(){
      if(low.pass){ senateStage(b,low); }
      else {
        addCap(-4); shiftAll(-0.7);
        cover({ax:t.ax,stance:b.stance,
          good:'Собрание остановило спорный проект',
          bad:'Провал в Собрании: «'+t.name.toLowerCase()+'» не прошёл',
          flat:'Собрание отклонило «'+t.name.toLowerCase()+'»'});
        logMsg('Собрание отклонило «'+t.name+'» ('+low.yes+' против '+low.no+').',1);
        chron('Собрание отклонило «'+t.name.toLowerCase()+'».','b');
      }
    }}]});
  render();
}
/* переход от комитета к залу: сначала поправки, потом доска */
function floorStage(b,rep0){ amendStage(b,rep0); }

/* ═══ СЕНАТ: КАЛЕНДАРЬ, ПРЕНИЯ, ГОЛОСОВАНИЕ ═══════════════════════
   Три ступени вместо одной. Сначала лидер большинства решает, когда
   поставить проект в повестку. Потом меньшинство решает, давать ли
   вообще голосовать. И только третьей идёт сама подача голосов. */

/* ─── повестка ───────────────────────────────────────────────── */
function senCalendar(b,low){
  if(senFriendlyLead()||!S.senLead)return true;
  const risk=SEN_HOLD*(1-leadFavour()/100);
  if(Math.random()>=risk)return true;
  S.senHold={bill:{...b,riders:[...(b.riders||[])]}, low, left:ri(1,2), q:S.q};
  const t=T(b.topic);
  logMsg('Лидер большинства '+S.senLead.name+' не поставил «'+t.name+'» в повестку Сената.',1);
  chron('Сенат отложил «'+t.name.toLowerCase()+'».','b');
  sheetOpen({eye:'Повестка Сената · '+dateLabel(),title:'Проект положен под сукно',
    body:`<p class="lead">${t.name} прошёл Собрание, но до голосования в Сенате не дошёл.
        Календарь палаты ведёт лидер большинства, и он не назвал дату.</p>
      <div class="res"><span>Лидер</span><b class="w">${S.senLead.name}</b>
        <span>Фракция</span><b class="w">${P(S.senLead.party).name}</b>
        <span>Расположение к вам</span><b class="${leadFavour()<40?'bad':leadFavour()>=70?'good':'warn'}">${leadFavour()}</b>
        <span>Ожидание</span><b>${quarters(S.senHold.left)}</b></div>
      <p class="hint">Отклонения не было: проект жив и всплывёт сам. Ускорить его можно только
        одним способом — договориться с тем, кто ведёт календарь.</p>`,
    acts:[{label:'Ждать'},{label:'К Сенату',fn(){S.tab='senate';}}]});
  return false;
}
/* проект, пролежавший срок, выходит на голосование сам */
function senHoldTick(){
  const h=S.senHold; if(!h)return;
  h.left--;
  if(h.left>0)return;
  S.senHold=null;
  logMsg('«'+T(h.bill.topic).name+'» наконец поставлен на голосование в Сенате.',1);
  senateDebate(h.bill,h.low,true);
}
/* выкуп повестки: лидер ставит проект сразу, но услуга не бесплатна */
function pushCalendar(){
  const h=S.senHold; if(!h){toast('В повестке ничего не залежалось');return;}
  if(!pay({ap:1,cap:capCost(LEAD_DEAL,'lobby')},'Сделка с лидером Сената'))return;
  S.senLead.deals=(S.senLead.deals||0)+1;
  S.senLead.favour=clamp((S.senLead.favour||0)+ri(6,12),-40,40);
  addTrail(ri(3,7),'сделка с лидером Сената');
  S.senHold=null;
  logMsg('Лидер большинства поставил «'+T(h.bill.topic).name+'» в повестку вне очереди.');
  senateDebate(h.bill,h.low,true);
  render();
}

/* ─── прения и обструкция ────────────────────────────────────── */
function senateStage(b,low){
  if(!senCalendar(b,low))return;
  senateDebate(b,low);
}
function senateDebate(b,low,skipCal){
  const t=T(b.topic), tl=senTally(b);
  if(!willFilibuster(b,tl)){ senateFloor(b,low,{got:clotureCount(b,tl),need:cloture(),ok:true}); return; }
  const got=clotureCount(b,tl), need=cloture(), lack=need-got;
  const med=senMedian(t.ax), soft=Math.round(clamp((b.stance+med)/2,-2,2))||(b.stance>0?1:-1);
  const opts=[];
  opts.push({label:'Ставить на клотур как есть',hint:'сейчас за прекращение прений '+got+' из '+need,
    fn(){ filiVote(b,low); }});
  // выкуп закрывает последние несколько голосов, а не разрыв в сорок:
  // предлагать его при большом отрыве — обманывать самих себя
  if(lack<=10)opts.push({label:'Выкупить недостающие голоса',
    hint:'вес '+capCost(FILI_CAP,'lobby')+' и '+Math.max(6,lack*2)+' млрд · берут не все',
    fn(){ filiBuy(b,low,lack); }});
  if(soft!==b.stance)opts.push({label:'Смягчить текст до «'+STEP[soft+2]+'»',hint:'вес '+CONF_CAP+' · палата стоит на '+med.toFixed(1),
    fn(){ filiSoften(b,low,soft); }});
  if(canNuke())opts.push({label:'Ядерный вариант: клотур в '+SEN_MAJ,hint:'вес '+NUKE_COST+' · навсегда и для всех',
    fn(){ askNuke(b,low); }});
  opts.push({label:'Договориться с лидерами сенаторов',hint:'сделка: сенаторы фракции голосуют и за клотур',
    fn(){ S.pendVote={sen:true,b,low}; askDeals({k:'b',topic:b.topic,stance:b.stance,bill:b,back:1}); }});
  opts.push({label:'Отозвать проект',hint:'потерять вес '+3+', но не позориться голосованием',
    fn(){ addCap(-3); logMsg('«'+t.name+'» отозван из Сената: обструкцию сломать было нечем.',1); render(); }});

  sheetOpen({eye:'Прения в Сенате · '+dateLabel(),title:'Обструкция',
    body:`<p class="lead">${t.name} — ${stanceLine(b).split('—')[1]||''}. Собрание проект принял.
        В Сенате меньшинство отказалось прекращать прения: пока за клотур нет ${need} голосов,
        до голосования по существу дело не дойдёт.</p>
      ${senBoard(clotureList(b,tl),got,SEN_SEATS-got,need,{final:false,house:'Сенат · клотур',
        what:'за прекращение прений'})}
      <div class="res"><span>За прекращение прений</span><b class="${got>=need?'good':'bad'}">${got}</b>
        <span>Нужно</span><b>${need}</b>
        <span>Не хватает</span><b class="bad">${lack}</b>
        <span>Простое большинство</span><b>${senCount(b,tl).yes} из ${SEN_MAJ}</b></div>
      <p class="hint">Голосов на сам закон может хватать — обструкция бьёт не по большинству,
        а по праву его показать. ${nuked()?'Регламент уже опущен раньше.':'Порог клотура — '+need+'.'}</p>`,
    opts});
}
/* голосование по клотуру: прошло — идём к существу, нет — проект мёртв */
function filiVote(b,low,note){
  const tl=senTally(b), got=clotureCount(b,tl), need=cloture();
  const cl={got,need,ok:got>=need};
  if(cl.ok){ senateFloor(b,low,cl,note); return; }
  const t=T(b.topic);
  addCap(-4); shiftAll(-0.5);
  S.votes.unshift({no:S.billNo,q:S.q,name:t.name+' · клотур',stance:b.stance,
    yes:got,no:SEN_SEATS-got,pass:false,house:'сен'});
  cover({ax:t.ax,stance:b.stance,
    good:'Сенат не дал продавить спорный закон',
    bad:'Обструкция в Сенате похоронила «'+t.name.toLowerCase()+'»',
    flat:'Прения в Сенате так и не были закрыты'});
  logMsg('Обструкция устояла: за клотур '+got+' при нужных '+need+'. «'+t.name+'» снят.',1);
  chron('Обструкция в Сенате остановила «'+t.name.toLowerCase()+'».','b');
  sheetOpen({eye:'Прохождение закона · '+dateLabel(),title:t.name,
    body:senBoard(clotureList(b,tl),got,SEN_SEATS-got,need,{house:'Сенат · клотур',
        what:'голосование о прекращении прений',verdict:'прения не закрыты'})+
      billPath(b,low,null,null,false,cl)+
      `<p class="hint">Меньшинству не нужно большинство — достаточно ${SEN_SEATS-need+1} голосов,
        чтобы говорить бесконечно. Это и есть главная арифметика палаты.</p>`,
    acts:[{label:'Закрыть'}]});
  render();
}
/* выкуп: обещания колеблющимся, деньги субъектам, надзору — след */
function filiBuy(b,low,lack){
  const price=Math.max(6,lack*2);
  if(!payCap(capCost(FILI_CAP,'lobby'))){render();return;}
  if(!payGold(price)){addCap(capCost(FILI_CAP,'lobby'));render();return;}
  // деньги идут не всем подряд, а тем, кому до «да» остаётся один шаг:
  // считаем счёт по клотуру и работаем с ближайшими к нулю снизу
  const tl=senTally(b);
  const score=x=>{ const own=x.d.party===(b.by||PL)||inCoal(x.d.party);
    return x.v*0.65+(own?24:-18)+(x.d.rel-50)*0.2+(senRank(x.d)>=4?6:0); };
  // берут не всех, а столько, на сколько хватает рук: приём закрывает
  // последние несколько голосов, а не разрыв в тридцать
  const near=tl.list.filter(x=>{const v=score(x); return v<=0&&v>-15;})
    .sort((a,c)=>score(c)-score(a)).slice(0,Math.min(lack+2,10));
  let n=0;
  near.forEach(x=>{
    if(Math.random()<x.d.integ/145)return;          // неподкупный не берёт
    const g=inCoal(x.d.party)?ri(8,18):ri(4,14);
    x.d.spledge=(x.d.spledge||0)+g; x.d.spledgeNo=b.id; x.d.deals++; n++;
  });
  addTrail(ri(5,11),'выкуп голосов в Сенате');
  bumpRep('honest',-2);
  logMsg('Работа с сенаторами перед клотуром: обработано '+n+', казна минус '+price+' млрд.');
  filiVote(b,low);
}
/* тот же выкуп без оплаты — служит замеру силы приёма */
function filiBuyProbe(b,lack){
  const tl=senTally(b);
  const score=x=>{ const own=x.d.party===(b.by||PL)||inCoal(x.d.party);
    return x.v*0.65+(own?24:-18)+(x.d.rel-50)*0.2+(senRank(x.d)>=4?6:0); };
  tl.list.filter(x=>{const v=score(x); return v<=0&&v>-15;})
    .sort((a,c)=>score(c)-score(a)).slice(0,Math.min(lack+2,10))
    .forEach(x=>{ if(Math.random()<x.d.integ/145)return;
      x.d.spledge=inCoal(x.d.party)?ri(8,18):ri(4,14); x.d.spledgeNo=b.id; });
}
/* уступка: текст сдвигается к медиане палаты — закон слабее, но живой */
function filiSoften(b,low,soft){
  if(!payCap(CONF_CAP)){render();return;}
  const t=T(b.topic), was=b.stance;
  b.stance=soft;
  shiftAll(-0.3); bumpRep('firm',-2); bumpRep('comp',1);
  logMsg('«'+t.name+'» смягчён с «'+STEP[was+2]+'» до «'+STEP[soft+2]+'» ради клотура.',1);
  chron('Проект по «'+t.name.toLowerCase()+'» смягчили ради Сената.','');
  filiVote(b,low,'текст смягчён до «'+STEP[soft+2]+'»');
}
/* ядерный вариант: регламент меняют простым большинством — один раз
   и навсегда, потому что следующий состав палаты им же и воспользуется */
function askNuke(b,low){
  sheetOpen({eye:'Регламент Сената',title:'Опустить порог клотура?',
    body:`<p class="lead">Председатель ставит вопрос о толковании регламента, и палата решает его
        простым большинством. С этого дня прения прекращаются ${SEN_MAJ} голосами, а не ${cloture()}.</p>
      <div class="res"><span>У коалиции в Сенате</span><b class="good">${senCoalSeats()}</b>
        <span>Нужно</span><b>${NUKE_MIN}</b>
        <span>Председатель</span><b class="w">${S.vp?S.vp.name:'—'}</b>
        <span>Цена</span><b>вес ${NUKE_COST}</b></div>
      <p class="hint">Обратного хода нет. Правило останется и тогда, когда большинство будет чужим —
        и тогда уже вам нечем будет тянуть прения.</p>`,
    opts:[
      {label:'Опустить порог',hint:'вес '+NUKE_COST+' · навсегда',fn(){ doNuke(); filiVote(b,low,'регламент изменён'); }},
      {label:'Не трогать регламент',hint:'вернуться к прениям',fn(){ senateDebate(b,low); }}]});
}
function doNuke(){
  if(!payCap(NUKE_COST))return false;
  S.senRules={cloture:SEN_MAJ, nuked:true, nukedBy:PL, nukedQ:S.q};
  shiftAll(-1.8); shiftMood('intel',-6); shiftMood('urban',-3);
  bumpRep('firm',6); bumpRep('honest',-5);
  S.presRel=clamp(S.presRel+3,0,100);
  pressAll(-9);
  career('Порог клотура в Сенате опущен до простого большинства.');
  logMsg('Регламент Сената изменён: прения теперь закрываются '+SEN_MAJ+' голосами.',1);
  chron('Порог клотура в Сенате опущен.','b');
  cover({ax:'order',stance:2,
    good:'Палату наконец заставили работать',
    bad:'Регламент Сената сломан ради одного закона',
    flat:'Сенат опустил порог прекращения прений'});
  return true;
}

/* ─── голосование по существу и согласительная комиссия ──────── */
function senateFloor(b,low,cl,note){
  const t=T(b.topic);
  const up=resolveSenVote(b);
  S.votes.unshift({no:S.billNo,q:S.q,name:t.name,stance:b.stance,yes:up.yes,no:up.no,pass:up.pass,house:'сен'});
  if(!up.pass){
    const lack=SEN_MAJ-up.yes;
    const med=senMedian(t.ax);
    const soft=Math.round(clamp((b.stance+med*2)/3,-2,2));
    // отлагательное вето: Сенат отклонил, но последнее слово за Собранием
    if(!senBinding()&&!b.reover){ senOverride(b,low,up,cl,note); return; }
    // проигранный на несколько голосов проект не хоронят, а переписывают
    if(lack<=CONF_GAP&&soft!==b.stance&&!b.conf){
      askConference(b,low,up,cl,soft,lack);
      return;
    }
    addCap(-3); shiftAll(-0.4);
    logMsg('Сенат отклонил «'+t.name+'» ('+up.yes+' против '+up.no+'), хотя Собрание его приняло.',1);
    chron('Сенат остановил «'+t.name.toLowerCase()+'».','b');
    sheetOpen({eye:'Прохождение закона · '+dateLabel(),title:t.name,
      body:senBoard(senTally(b).list,up.yes,up.no,SEN_MAJ,{what:'голосование по существу',
          verdict:'отклонён Сенатом'})+billPath(b,low,up,null,false,cl)+
        '<p class="hint">Палата субъектов не пропустила проект. Сенату важнее регионы, чем фракции: смотрите, кого задевает текст.</p>',
      acts:[{label:'Закрыть'}]});
    render(); return;
  }
  presStage(b,low,up,cl,note);
}
/* ─── отлагательное вето Сената ──────────────────────────────────
   После поправки главы 1 вторая палата уже не останавливает закон
   окончательно: она возвращает его, и Собрание решает заново простым
   большинством. Настоять стоит дешевле, чем созывать комиссию, но
   каждое такое преодоление палата запоминает. */
function senOverride(b,low,up,cl,note){
  const t=T(b.topic);
  sheetOpen({eye:'Отлагательное вето Сената',title:'Сенат вернул закон',
    body:`<p class="lead">«${t.name}» не прошёл палату субъектов: ${up.yes} против ${up.no}.
        По действующей редакции ст. 105 это не конец — Собрание вправе подтвердить свой текст
        простым большинством, и закон вступит в силу без согласия Сената.</p>
      ${voteBar(up.yes,up.no,SEN_MAJ)}
      <div class="res"><span>Было в Собрании</span><b>${low.yes} : ${low.no}</b>
        <span>Нужно подтвердить</span><b class="w">${MAJ} из ${SEATS}</b>
        <span>Прогноз сейчас</span><b class="${tally(b).yes>=MAJ?'good':'bad'}">${tally(b).yes}</b>
        <span>Цена</span><b>вес 6</b></div>
      <p class="hint">Палата субъектов помнит, что её обошли: следующие проекты она встретит холоднее.</p>`,
    opts:[
      {label:'Подтвердить в Собрании',hint:'вес 6 · простое большинство',
       fn(){ if(!payCap(6)){render();return;}
         b.reover=true;
         const re=resolveVote(b);
         S.votes.unshift({no:S.billNo,q:S.q,name:t.name+' · преодоление',stance:b.stance,
           yes:re.yes,no:re.no,pass:re.pass,house:'соб'});
         // обойдённая палата злее к автору
         S.senate.forEach(x=>{ if(x.party!==PL&&!inCoal(x.party))x.rel=clamp(x.rel-3,0,100); });
         if(!re.pass){
           addCap(-4); shiftAll(-0.5);
           logMsg('Собрание не подтвердило «'+t.name+'» после возврата из Сената ('+re.yes+':'+re.no+').',1);
           sheetOpen({eye:'Преодоление не удалось',title:t.name,
             body:voteBar(re.yes,re.no,MAJ)+'<p>Возвращённый закон не собрал даже простого большинства: палата второй раз голосует иначе, чем первый.</p>',
             acts:[{label:'Закрыть'}]});
           render(); return;
         }
         bumpRep('firm',3);
         logMsg('Собрание преодолело отлагательное вето Сената по «'+t.name+'» ('+re.yes+':'+re.no+').',1);
         chron('Собрание настояло на своём против Сената.','');
         presStage(b,re,up,cl,'через отлагательное вето Сената'); }},
      {label:'Согласиться с Сенатом',hint:'проект остаётся в палате',
       fn(){ addCap(-2); bumpRep('comp',2);
         logMsg('Сенат вернул «'+t.name+'», Собрание настаивать не стало.',1);
         render(); }}]});
  render();
}

/* согласительная комиссия: палаты сходятся на среднем тексте, и
   Собрание должно принять его заново — уже без права поправок */
function askConference(b,low,up,cl,soft,lack){
  const t=T(b.topic);
  sheetOpen({eye:'Согласительная комиссия',title:'Сенат готов сойтись на среднем',
    body:`<p class="lead">«${t.name}» не хватило ${lack} голосов. Сенаторы предлагают комиссию:
        текст сдвинется с «${STEP[b.stance+2]}» на «${STEP[soft+2]}», и палата его пропустит.
        Собранию придётся принять согласованный текст целиком, без поправок.</p>
      ${voteBar(up.yes,up.no)}
      <div class="res"><span>Медиана Сената по оси</span><b>${senMedian(t.ax).toFixed(1)}</b>
        <span>Ваш текст</span><b>${STEP[b.stance+2]}</b>
        <span>Согласованный</span><b class="w">${STEP[soft+2]}</b>
        <span>Цена комиссии</span><b>вес ${CONF_CAP}</b></div>`,
    opts:[
      {label:'Созвать комиссию',hint:'закон слабее, но он будет',
       fn(){ if(!payCap(CONF_CAP)){render();return;} runConference(b,low,cl,soft); }},
      {label:'Настоять на своём тексте',hint:'проект умирает здесь',
       fn(){ addCap(-3); shiftAll(-0.4); bumpRep('firm',3);
         logMsg('Комиссия отклонена: «'+t.name+'» снят с рассмотрения.',1);
         chron('Сенат остановил «'+t.name.toLowerCase()+'».','b'); render(); }}]});
}
function runConference(b,low,cl,soft){
  const t=T(b.topic), was=b.stance;
  b.stance=soft; b.conf=true;
  // Собрание голосует по согласованному тексту заново
  const re=resolveVote(b);
  S.votes.unshift({no:S.billNo,q:S.q,name:t.name+' · согласовано',stance:soft,
    yes:re.yes,no:re.no,pass:re.pass,house:'соб'});
  if(!re.pass){
    addCap(-5); shiftAll(-0.8);
    logMsg('Собрание не приняло согласованный текст «'+t.name+'» ('+re.yes+':'+re.no+').',1);
    sheetOpen({eye:'Согласительная комиссия',title:'Собрание не приняло компромисс',
      body:voteBar(re.yes,re.no)+
        `<p>Текст, устроивший Сенат, оказался слишком мягок для Собрания: за него ${re.yes} при нужных ${MAJ}.
          Проект похоронен между палатами — самая обидная из смертей закона.</p>`,
      acts:[{label:'Закрыть'}]});
    render(); return;
  }
  const up=resolveSenVote(b);
  S.votes.unshift({no:S.billNo,q:S.q,name:t.name+' · согласовано',stance:soft,
    yes:up.yes,no:up.no,pass:up.pass,house:'сен'});
  bumpRep('comp',2); bumpRep('firm',-2);
  logMsg('Согласительная комиссия свела «'+t.name+'» с «'+STEP[was+2]+'» на «'+STEP[soft+2]+'».',1);
  chron('Палаты сошлись на компромиссе по «'+t.name.toLowerCase()+'».','');
  if(!up.pass){
    addCap(-4);
    sheetOpen({eye:'Согласительная комиссия',title:'Сенат отступил от своего же текста',
      body:billPath(b,re,up,null,false,cl)+'<p class="hint">Так бывает: комиссия договаривается, а палата — нет.</p>',
      acts:[{label:'Закрыть'}]});
    render(); return;
  }
  presStage(b,re,up,cl,'через согласительную комиссию');
}

/* ─── подпись президента ─────────────────────────────────────── */
function presStage(b,low,up,cl,note){
  const t=T(b.topic);
  const veto=Math.random()<vetoChance(b);
  if(veto){
    S.pres.vetoes++;
    S.vetoed={bill:{...b,riders:[...(b.riders||[])]}, q:S.q, low, up, tries:0};
    S.presRel=clamp(S.presRel-4,0,100);
    addCap(-2);
    cover({ax:t.ax,stance:b.stance,
      good:'Президент остановил спорный закон',
      bad:'Вето: президент против того, что приняли обе палаты',
      flat:'Президент наложил вето на «'+t.name.toLowerCase()+'»'});
    logMsg('Президент наложил вето на «'+t.name+'», принятый обеими палатами.',1);
    chron('Президент отклонил «'+t.name.toLowerCase()+'».','b');
    sheetOpen({eye:'Прохождение закона · '+dateLabel(),title:t.name,
      body:senBoard(senTally(b).list,up.yes,up.no,SEN_MAJ,{what:'голосование по существу',
          verdict:up.pass?'одобрен Сенатом':'Сенат против'})+billPath(b,low,up,{veto:true},false,cl)+
        `<p>Закон вернулся в Собрание. Преодолеть вето можно двумя третями — это ${superN()} голосов из ${SEATS}, на сорок больше обычного большинства.</p>`,
      acts:[{label:'Оставить в Собрании'}]});
    render(); return;
  }

  enact(b);
  S.termLaws=(S.termLaws||0)+1;
  addCap(6);
  bumpRep('comp',1.2);
  cover({ax:t.ax,stance:b.stance,
    good:'Принят закон «'+t.name.toLowerCase()+'»: власть добилась своего',
    bad:'«'+t.name+'» продавлен через палаты',
    flat:'Собрание и Сенат приняли «'+t.name.toLowerCase()+'»'});
  career('Проведён закон «'+t.name.toLowerCase()+'» ('+STEP[b.stance+2]+').');
  logMsg('Принят закон «'+t.name+'»: Собрание '+low.yes+':'+low.no+', Сенат '+up.yes+':'+up.no+'.',1);
  chron('Принят закон «'+t.name.toLowerCase()+'».','g');
  sheetOpen({eye:'Прохождение закона · '+dateLabel(),title:t.name,
    body:senBoard(senTally(b).list,up.yes,up.no,SEN_MAJ,{what:'голосование по существу',
        verdict:up.pass?'одобрен Сенатом':'Сенат против'})+billPath(b,low,up,{veto:false},true,cl)+
      (note?'<p class="hint">'+note[0].toUpperCase()+note.slice(1)+'.</p>':'')+
      '<p class="hint">Закон вступает в силу с начала следующего квартала.</p>',
    acts:[{label:'Закрыть'}]});
  render();
}

/* преодоление вето: две трети Собрания, одно действие и 14 веса */
function overrideVeto(){
  const v=S.vetoed; if(!v){toast('Отклонённых законов нет');return;}
  if(!pay({ap:1,cap:capCost(14,'veto')},'Преодоление вето'))return;
  const b=v.bill, t=T(b.topic);
  const res=resolveVote(b,superN());
  v.tries++;
  S.votes.unshift({no:S.billNo,q:S.q,name:t.name+' · вето',stance:b.stance,yes:res.yes,no:res.no,pass:res.pass,house:'соб'});
  if(res.pass){
    enact(b); S.termLaws=(S.termLaws||0)+1;
    addCap(12); shiftAll(0.9);
    S.presRel=clamp(S.presRel-8,0,100);
    S.vetoed=null;
    logMsg('Вето преодолено: «'+t.name+'» стал законом ('+res.yes+' из '+SEATS+').',1);
    chron('Собрание преодолело вето по «'+t.name.toLowerCase()+'».','g');
    sheetOpen({eye:'Преодоление вето · '+dateLabel(),title:'Вето преодолено',
      body:voteBar(res.yes,res.no)+
        `<p>Нужно было ${superN()}, собрано ${res.yes}. Закон вступает в силу через голову президента — такое не забывают.</p>`,
      acts:[{label:'Закрыть'}]});
  } else {
    addCap(-6); shiftAll(-1);
    logMsg('Вето устояло: за преодоление '+res.yes+' при нужных '+superN()+'.',1);
    if(v.tries>=2){ S.vetoed=null; chron('Закон окончательно похоронен вето.','b'); }
    sheetOpen({eye:'Преодоление вето · '+dateLabel(),title:'Вето устояло',
      body:voteBar(res.yes,res.no)+
        `<p>Нужно было ${superN()}, собрано ${res.yes}.</p>`+
        (v.tries>=2?'<p class="hint">Две неудачные попытки подряд — проект снят с рассмотрения окончательно.</p>'
                   :'<p class="hint">Остаётся одна попытка. Между ними имеет смысл поработать с колеблющимися.</p>'),
      acts:[{label:'Закрыть'}]});
  }
  render();
}

/* ─── указ президента ────────────────────────────────────────── */
function issueDecree(topic,stance){
  if(!isPres()){toast('Указы подписывает президент');return;}
  if(!pay({ap:1,cap:DECREE_COST},'Указ «'+T(topic).name+'»'))return;
  const b={topic,stance,riders:[],by:PL,decree:true};
  enact(b,true);
  S.pres.decrees++;
  shiftAll(-0.5);
  const t=T(topic);
  logMsg('Подписан указ «'+t.name+'»: он действует '+quarters(DECREE_LEN)+' и вполсилы.',1);
  chron('Президент правит указом по теме «'+t.name.toLowerCase()+'».','');
  sheetOpen({eye:'Указ президента · '+dateLabel(),title:t.name,
    body:`<p class="lead">${stanceLine(b)}</p>
      <div class="res"><span>Сила</span><b>${Math.round(DECREE_POWER*100)}% от закона</b>
        <span>Действует до</span><b>${dateLabel(S.q+DECREE_LEN)}</b>
        <span>Указов подписано</span><b>${S.pres.decrees}</b></div>
      <p class="hint">Указ отменяется сам собой, а до того его может перебить закон Собрания по этой же теме.
        Интеллигенция и горожане считают такое правление обходом процедуры.</p>`,
    acts:[{label:'Закрыть'}]});
  render();
}
function askDecree(){
  if(!presDecree()){toast('В парламентской республике глава государства указов не издаёт');return;}
  // тем в своде сорок семь: сначала направление, потом тема
  sheetOpen({eye:'Указ · '+DECREE_COST+' веса',title:'По какому направлению',
    body:'<p class="lead">Указ обходит обе палаты, но живёт вполсилы и всего '+quarters(DECREE_LEN)+'.</p>',
    opts:AXES.map(a=>{ const n=TOPICS.filter(t=>t.ax===a.id&&!t.special&&!t.rate).length;
      return {label:a.name,hint:a.l+' ↔ '+a.r+' · '+plural(n,'тема','темы','тем'),
        fn:()=>askDecreeTopic(a.id)}; })});
}
function askDecreeTopic(ax){
  const list=TOPICS.filter(t=>t.ax===ax&&!t.special&&!t.rate);
  sheetOpen({eye:'Указ · '+AXNAME[ax],title:'По какой теме',
    opts:list.map(t=>{ const l=lawOn(t.id);
      return {label:t.name, hint:t.l+' ↔ '+t.r+(l?' · сейчас '+STEP[l.stance+2]:' · закона нет'),
        fn:()=>askDecreeStance(t.id)}; })
      .concat([{label:'Назад к направлениям',hint:'',fn:askDecree}])});
}
function askDecreeStance(topic){
  const t=T(topic);
  sheetOpen({eye:'Указ · '+t.name,title:'Какая редакция',
    body:`<p class="lead">${t.l} ↔ ${t.r}</p>`,
    opts:[-2,-1,1,2].map(v=>({label:STEP[v+2]+' · '+(v<0?t.l:t.r),
      hint:Math.abs(v)===2?'решительно':'умеренно', fn:()=>issueDecree(topic,v)}))});
}

/* ─── годовой бюджет ─────────────────────────────────────────── */
function submitBudget(){
  if(!isPM()){toast('Бюджет вносит правительство');return;}
  if(!budgetDue()){toast('Бюджет вносят в последнем квартале года');return;}
  if(S.budget.submitted){toast('Бюджет на этот год уже рассматривали');return;}
  if(!pay({ap:1,cap:6},'Бюджет внесён в Собрание'))return;
  S.budget.submitted=true;
  const t=budgetTally();
  let yes=0,no=0;
  t.list.forEach(x=>{ if(x.st==='yes')yes++; else if(x.st==='no')no++;
    else { (Math.random()<0.5+x.v/30?yes++:no++); } });
  const pass=yes>no;
  if(pass){
    S.lastBudget=snapshotBudget(); S.budget.fails=0;
    addCap(8); shiftAll(0.8);
    coalition().filter(x=>x!==PL).forEach(id=>{ if(!S.partners[id])return; const a=bAsk(id);
      S.partners[id].anger=a&&!bAskMet(a)?clamp(S.partners[id].anger+1,0,6):Math.max(0,S.partners[id].anger-1); });
    S.parties.filter(p=>p.id!==PL&&seatsOf(p.id)>0).forEach(p=>{ const a=bAsk(p.id); if(a&&bAskMet(a))bAskGroups(a).forEach(g=>shiftMood(g,0.6)); });
    logMsg('Бюджет на '+budgetYear()+' год принят ('+yes+' против '+no+').',1);
    chron('Собрание утвердило бюджет на '+budgetYear()+' год.','g');
  } else {
    S.budget.fails++;
    if(S.lastBudget){ S.tax={...S.lastBudget.tax}; S.spend={...S.lastBudget.spend}; }
    addCap(-10); shiftAll(-2); S.noConfCool=0;
    coalition().filter(x=>x!==PL).forEach(id=>{ if(S.partners[id])S.partners[id].anger=clamp(S.partners[id].anger+1,0,6); });
    logMsg('Бюджет на '+budgetYear()+' год провален ('+no+' против '+yes+'). Страна живёт по прошлогодним цифрам.',1);
    chron('Собрание отклонило бюджет на '+budgetYear()+' год.','b');
  }
  sheetOpen({eye:'Народное собрание · бюджет '+budgetYear(),title:pass?'Бюджет принят':'Бюджет провален',
    body:voteBar(yes,no)+`<div style="text-align:center;margin:14px 0 4px">
      <span class="stamp ${pass?'y':'n'}">${pass?'утверждён':'отклонён'}</span></div>`+bAskSummary()+
      (pass?'<p class="hint">Ставки и статьи закреплены на год. Менять их до следующего бюджета можно, но защищать придётся снова.</p>'
           :'<p>Ставки и статьи откатились к прошлогодним. Оппозиция получила повод для вотума недоверия'+
            (S.budget.fails>=2?', а второй провал подряд означает отставку кабинета.':'.')+'</p>'),
    acts:[{label:'Дальше'}]});
  if(!pass&&S.budget.fails>=2){
    logMsg('Второй провал бюджета подряд: правительство отправлено в отставку.',1);
    chron('Кабинет пал из-за бюджета.','b');
    fallGovernment('бюджет провален дважды');
  }
  render();
}
function budgetTick(){
  if(!isPM()){ S.budget.submitted=false; return; }
  if(budgetDue()&&!S.budget.submitted){
    S.budget.fails++;
    if(S.lastBudget){ S.tax={...S.lastBudget.tax}; S.spend={...S.lastBudget.spend}; }
    addCap(-8); shiftAll(-1.6); S.noConfCool=0;
    logMsg('Правительство не внесло бюджет на '+budgetYear()+' год: страна живёт по прошлогодним цифрам.',1);
    sheetOpen({eye:'Бюджетный кризис',title:'Бюджет не внесён',
      body:'<p>Год закончился, а проект бюджета так и не дошёл до Собрания. Ставки и статьи откатились к прошлогодним, оппозиция получила повод для вотума.</p>',
      acts:[{label:'Принять к сведению'}]});
  }
  if(budgetDue())S.budget.submitted=false;      // следующий год — новый проект
}

/* ─── досрочные выборы ───────────────────────────────────────── */

/* ═══ ПЕЧАТЬ ══════════════════════════════════════════════════════
   Издания пишут о том, что произошло на самом деле: заголовок
   собирается из события, а тон — из того, как издание к нему
   относится и как относится к вам. */
function head(o,text,kind){
  if(typeof o==='string'){ kind=text; text=o;                    // без издания: пишет самое дружелюбное
    o=PRESS.slice().sort((a,b)=>pressOf(b.id).rel-pressOf(a.id).rel)[0]; }
  S.press.heads.unshift({q:S.q,o:o.id,t:text,k:kind||''});
  if(S.press.heads.length>40)S.press.heads.pop();
}
/* одно событие — пять разных заголовков */
function cover(ev){
  if(!S.press)return;
  PRESS.forEach(o=>{
    const st=pressOf(o.id); if(!st||st.banned)return;
    const view=ev.ax?pressView(o,ev.ax,ev.stance||0):0;
    const warm=(st.rel-50)/50;
    const good=view+warm>0.35, bad=view+warm<-0.35;
    const t=good?ev.good:bad?ev.bad:ev.flat;
    head(o,t,good?'hg':bad?'hb':'');
    // издание сдвигает своих читателей — тем сильнее, чем ему верят
    const k=(good?1:bad?-1:0)*pressTrust()*o.reach*2.2;
    if(k)o.base.forEach(g=>shiftMood(g,k,true));
    st.rel=clamp(st.rel+(good?0.8:bad?-0.8:0),0,100);
  });
}
function pressTick(){
  if(!S.press)return;
  const free=pressFree();
  PRESS.forEach(o=>{
    const st=pressOf(o.id); if(!st)return;
    if(st.banned){ st.rel=clamp(st.rel-1.5,0,100); return; }
    // отношение тянется к близости курса, а под надзором — к власти
    let want=clamp(56-axDist(o.st,me().st)*12,8,92);
    if(free<0)want=want*(1+free*-0.18)+(isPM()?12:-4)*(-free)*0.5;
    st.rel=clamp(st.rel+(want-st.rel)*0.12+rnd(-2,2),0,100);
  });
}
function pressTalk(id){
  const o=PRS(id), st=pressOf(id);
  if(st.banned){toast('Это издание с вами не разговаривает');return;}
  if(!pay({ap:1,cap:PRESS_TALK},'Интервью изданию'))return;
  const k=hasTrait('orator')?1.5:1;
  st.rel=clamp(st.rel+ri(8,15)*k,0,100);
  o.base.forEach(g=>shiftMood(g,ri(1,3)*k,true));
  bumpRep('folk',0.6);
  head(o,'Интервью: «'+me().name+'» отвечает на вопросы','');
  logMsg('Интервью «'+o.name+'»: отношение издания выросло.');
  toast('Интервью вышло');
  render();
}
function pressLeak(pid){
  const p=P(pid);
  if(!pay({ap:1,cap:PRESS_LEAK},'Утечка против соперника'))return;
  const bite=ri(3,7);
  p.mom=clamp(p.mom-bite,-14,14);
  S.deputies.filter(d=>d.party===pid).forEach(d=>d.rel=clamp(d.rel-2,0,100));
  addTrail(ri(6,12),'утечка против «'+p.name+'»');
  bumpRep('honest',-3);
  const o=PRESS.slice().sort((a,b)=>pressOf(b.id).rel-pressOf(a.id).rel)[0];
  head(o,'Что скрывает «'+p.name+'»: документы в редакции','b');
  logMsg('Утечка против «'+p.name+'»: их разбор в печати.',1);
  toast('Материал вышел');
  render();
}
function pressBan(id){
  const o=PRS(id), st=pressOf(id);
  if(pressFree()>0){toast('При свободной печати издание не закрыть');return;}
  if(!pay({ap:1,cap:PRESS_BAN},'Отлучение издания'))return;
  st.banned=true; st.rel=clamp(st.rel-30,0,100);
  PRESS.forEach(x=>{ if(x.id!==id)pressOf(x.id).rel=clamp(pressOf(x.id).rel-6,0,100); });
  shiftMood('intel',-5,true); shiftMood('urban',-3,true); shiftMood('youth',-3,true);
  bumpRep('honest',-8); bumpRep('firm',5);
  addTrail(ri(8,14),'отлучение «'+o.name+'»');
  career('Издание «'+o.name+'» лишено доступа.');
  logMsg('«'+o.name+'» лишено доступа к правительству. Остальные редакции насторожились.',1);
  chron('Власть закрыла доступ изданию «'+o.name+'».','b');
  render();
}
function askPress(){
  sheetOpen({eye:'Работа с печатью',title:'Что сделать',
    body:`<p class="lead">Тон печати сейчас ${pressTone()>0?'+':''}${pressTone()} — ${pressWord(pressTone())}.
      Он умножает всё, что страна о вас узнаёт.</p>`,
    opts:[
      {label:'Дать интервью',hint:PRESS_TALK+' веса · поднять одно издание и его читателей',
       fn(){ sheetOpen({eye:'Интервью',title:'Кому',
         opts:PRESS.filter(o=>!pressOf(o.id).banned).map(o=>({label:o.name,
           hint:o.kind+' · охват '+Math.round(o.reach*100)+'% · отношение '+Math.round(pressOf(o.id).rel),
           fn:()=>pressTalk(o.id)}))}); }},
      {label:'Слить материал на соперника',hint:PRESS_LEAK+' веса · бьёт по их ходу, пачкает вас',
       fn(){ sheetOpen({eye:'Утечка',title:'Против кого',
         opts:S.parties.filter(p=>p.id!==PL).map(p=>({label:p.name,
           hint:mandates(seatsOf(p.id))+' · ход '+r1(p.mom),fn:()=>pressLeak(p.id)}))}); }},
      {label:'Лишить издание доступа',hint:PRESS_BAN+' веса · только при надзоре за печатью',
       fn(){ sheetOpen({eye:'Отлучение',title:'Какое издание',
         opts:PRESS.filter(o=>!pressOf(o.id).banned).map(o=>({label:o.name,
           hint:'охват '+Math.round(o.reach*100)+'% · отношение '+Math.round(pressOf(o.id).rel),
           fn:()=>pressBan(o.id)}))}); }},
      {label:'Ничего',hint:'сохранить квартал',fn(){}}]});
}

/* ═══ КОНСТИТУЦИОННЫЙ СУД ═════════════════════════════════════════
   Судьи сидят дольше, чем правит любой президент, поэтому состав —
   это наследство. Суд отменяет то, что зашло дальше устройства. */
function judgeTick(){
  if(!S.court)return;
  // расширение суда поправкой: недостающие кресла занимает действующая власть
  while(S.court.length<courtTarget())S.court.push(makeJudge(S.pres?S.pres.party:S.gov.lead,S.q));
  const gone=S.court.filter(j=>S.q>=j.until);
  if(!gone.length)return;
  const j=gone[0];
  S.court=S.court.filter(x=>x!==j);
  const by=S.pres?S.pres.party:S.gov.lead;
  const cand=makeJudge(by,S.q);
  // Сенат утверждает: кресло пожизненное, и палата это знает
  const ok=confirmSenate('judge',cand,by);
  if(ok){
    S.court.push(cand);
    logMsg('В суд назначен '+cand.name+' ('+P(by).short+'), Сенат утвердил.',by===PL?0:1);
  } else {
    const alt=makeJudge(S.gov.lead===by?bigOpp().id:S.gov.lead,S.q);
    S.court.push(alt);
    logMsg('Сенат отклонил кандидатуру в суд. Кресло занял компромиссный судья '+alt.name+'.',1);
  }
  chron('Смена в Конституционном суде.','');
}
/* запрос в суд: оспорить действующий закон или указ */
function petition(topic){
  const law=lawOn(topic); if(!law){toast('По этой теме ничего не действует');return;}
  if(!pay({ap:1,cap:PETITION},'Запрос в Конституционный суд'))return;
  const n=courtStrike(law), t=T(topic);
  S.court.forEach(j=>{});
  if(n>=courtMaj()){
    S.laws=S.laws.filter(l=>l!==law);
    addCap(law.by===PL?-6:10);
    if(law.by!==PL)bumpRep('comp',2);
    logMsg('Конституционный суд отменил «'+t.name+'»: '+n+' голосов из '+courtN()+'.',1);
    chron('Суд отменил закон «'+t.name.toLowerCase()+'».',law.by===PL?'b':'g');
    cover({ax:t.ax,stance:law.stance,
      good:'Суд остановил «'+t.name.toLowerCase()+'»: закон отменён',
      bad:'Суд отменил «'+t.name.toLowerCase()+'» — власть теряет опору',
      flat:'Конституционный суд отменил «'+t.name.toLowerCase()+'»'});
  } else {
    addCap(-4);
    logMsg('Суд не нашёл нарушения в «'+t.name+'»: за отмену '+n+' из '+courtN()+'.');
  }
  sheetOpen({eye:'Конституционный суд · '+dateLabel(),title:n>=courtMaj()?'Закон отменён':'Закон устоял',
    body:voteBar(n,COURT_SIZE-n)+
      `<p>За отмену ${n} судей из ${courtN()}, нужно ${courtMaj()}.</p>
       <div class="res"><span>Оспаривался</span><b class="w">${t.name}</b>
         <span>Автор</span><b class="w">${P(law.by).name}</b>
         <span>Вид</span><b class="w">${law.decree?'указ':'закон'}</b>
         <span>Независимость суда</span><b class="w">${courtFree()>0?'высокая':courtFree()<0?'низкая':'обычная'}</b></div>`,
    acts:[{label:'Закрыть'}]});
  render();
}
function askPetition(){
  const list=S.laws.filter(l=>T(l.topic));
  if(!list.length){toast('Оспаривать нечего');return;}
  sheetOpen({eye:'Запрос в суд · '+PETITION+' веса',title:'Что оспорить',
    body:'<p class="lead">Суд смотрит не на пользу закона, а на то, как далеко он зашёл. Указы отменяют охотнее законов.</p>',
    opts:list.map(l=>{const n=courtStrike(l);
      return {label:l.name+(l.decree?' (указ)':''),
        hint:'автор '+P(l.by).short+' · '+STEP[l.stance+2]+' · прогноз отмены '+n+' из '+courtN(),
        fn:()=>petition(l.topic)};})});
}

/* ═══ УТВЕРЖДЕНИЕ СЕНАТОМ ═════════════════════════════════════════
   Палата подтверждает кадры. Голосование идёт молча и попадает
   в журнал; лист открывается только если Сенат отказал. */
function confirmSenate(kind,who,byParty){
  if(!S.senate||!S.senate.length)return true;
  const c=CONFIRM[kind]||{name:'назначение',cost:3};
  let yes=0,no=0;
  S.senate.forEach(s=>{
    let v=(s.party===byParty?24:inCoal(s.party)?10:-14);
    v+=(s.rel-50)*0.22;
    if(who&&who.st)v+=(1.4-axDist(who.st,P(s.party).st))*10;
    // старейшина взвешивает кадровый вопрос строже: он этих людей переживёт
    if(senRank(s)>=4)v+=(s.party===byParty?4:-5);
    v+=noise(s.id+'conf'+kind+S.q,12);
    (v>0?yes++:no++);
  });
  // лидер большинства ведёт и кадровые голосования
  if(S.senLead){ const f=(leadFavour()-50)/50; const n=Math.round(f*4);
    if(S.senLead.party===byParty||inCoal(S.senLead.party)){ yes+=Math.max(0,n); no-=Math.max(0,n); }
    else { yes+=Math.min(0,n); no-=Math.min(0,n); } }
  yes=clamp(yes,0,SEN_SEATS); no=SEN_SEATS-yes;
  // председатель уговаривает так же, как и по законам
  const m=vpMargin(), gap=no-yes;
  if(S.vp&&gap>0&&gap<=m&&(S.vp.party===byParty||inCoal(S.vp.party))){ yes+=gap; no-=gap; }
  if(yes===no&&S.vp){ (S.vp.party===byParty?yes++:no++); S.vp.ties=(S.vp.ties||0)+1; }
  const ok=yes>=SEN_MAJ;
  logMsg('Сенат '+(ok?'утвердил':'отклонил')+' '+c.name+(who&&who.name?' — '+who.name:'')+
    ' ('+yes+':'+no+').',ok?0:1);
  if(!ok)addCap(-c.cost);
  return ok;
}

/* ═══ РАБОТА С ПАЛАТОЙ ════════════════════════════════════════════
   Сенаторов вдвое меньше депутатов, и каждый весит вчетверо: сотня
   человек решает судьбу всего, что прошло Собрание. Поэтому здесь
   работают не с фракциями, а с людьми и с их субъектами. */
function senLobby(senId,kind){
  const s=S.senate.find(x=>x.id===senId), l=SENLOB.find(x=>x.id===kind);
  if(!s||!l)return;
  if(!pay({ap:1},'Сенатор '+s.name))return;
  if(l.cap&&!payCap(capCost(l.cap,'lobby'))){apBack();return;}
  if(l.gold&&!payGold(l.gold)){apBack();return;}
  s.deals++;
  if(kind==='talk'){
    // старейшину уговаривать труднее: он пересидел четверых на вашем месте
    const g=senElder(s)?ri(4,9):ri(7,14);
    s.rel=clamp(s.rel+g,0,100); s.note='беседовал с вами';
    if(S.vp&&S.vp.job==='senate')s.rel=clamp(s.rel+Math.round(vpSkill()*0.05),0,100);
  }
  if(kind==='proj'){
    s.rel=clamp(s.rel+ri(13,22),0,100); s.note='получил стройку в субъект';
    S.rmod[s.region]=clamp(S.rmod[s.region]+2.4,-22,22);
    S.unrest[s.region]=clamp(S.unrest[s.region]-ri(2,5),0,100);
    // земляки по делегации замечают, кому досталось
    S.senate.filter(x=>x.region===s.region&&x.id!==s.id).forEach(x=>x.rel=clamp(x.rel+3,0,100));
    addTrail(s.integ*0.1,'стройка в субъекте '+s.name);
  }
  if(kind==='comm'){
    s.rel=clamp(s.rel+ri(16,26),0,100); s.note='возглавил комитет палаты';
    const mate=S.senate.filter(x=>x.party===s.party&&x.id!==s.id&&senRank(x)>=senRank(s));
    if(mate.length){ const m=pick(mate); m.rel=clamp(m.rel-ri(6,12),0,100); m.note='обойдён по старшинству'; }
    addTrail(3,'комитет для '+s.name);
  }
  if(kind==='join'){
    const from=s.party;
    const ch=clamp((s.rel-60)/56+(70-s.loyal)/160-senRank(s)*0.04,0.06,0.72);
    if(Math.random()<ch){
      s.party=PL; s.rel=clamp(s.rel+5,0,100); s.loyal=ri(52,78); s.note='перешёл к вам';
      S.senSeats[from]--; S.senSeats[PL]=(S.senSeats[PL]||0)+1;
      S.senate.filter(x=>x.party===from).forEach(x=>x.rel=clamp(x.rel-5,0,100));
      if(S.partners[from])S.partners[from].anger=clamp(S.partners[from].anger+1.5,0,6);
      addTrail(ri(5,10),'переход сенатора '+s.name);
      seatSenLeader();
      logMsg('Сенатор '+s.name+' перешёл из «'+P(from).name+'» в вашу фракцию.',1);
      chron('Сенатор '+s.name+' сменил фракцию на вашу.','g');
    } else {
      s.rel=clamp(s.rel-14,0,100); s.note='отказал вам';
      logMsg('Сенатор '+s.name+' отказался переходить.',1);
    }
    render(); return;
  }
  logMsg('Работа с сенатором: '+s.name+' ('+P(s.party).short+'), отношение '+Math.round(s.rel)+'.');
  toast('Отношение: '+Math.round(s.rel));
  render();
}
function askSen(senId){
  const s=S.senate.find(x=>x.id===senId); if(!s)return;
  const dean=senDean(s.region);
  sheetOpen({eye:R(s.region).name+' · класс '+QUARTERS[s.cls],title:s.name,
    body:`<div class="res" style="margin-top:0"><span>Фракция</span><b class="w">${P(s.party).name}</b>
        <span>Отношение к вам</span><b class="${s.rel<34?'bad':s.rel>=62?'good':'warn'}">${Math.round(s.rel)}</b>
        <span>Дисциплина</span><b>${s.loyal}</b>
        <span>Неподкупность</span><b>${s.integ}</b>
        <span>Сроков в палате</span><b>${senRank(s)}${senElder(s)?' · старейшина':''}</b>
        <span>Старший в делегации</span><b class="w">${dean?dean.name:'—'}</b></div>
      ${s.note?'<p class="hint">Последнее: '+s.note+'.</p>':''}`,
    opts:SENLOB.filter(l=>!l.need||l.need(s)).map(l=>({
      label:l.name,
      hint:(l.cap?'вес '+capCost(l.cap,'lobby'):'')+(l.cap&&l.gold?' · ':'')+(l.gold?l.gold+' млрд':'')+' · '+l.txt,
      fn:()=>senLobby(senId,l.id)})).concat([{label:'Ничего',hint:'закрыть',fn(){}}])});
}
/* сделка с лидером большинства: календарь, повестка, тон палаты */
function askLead(){
  const l=S.senLead; if(!l){toast('Палата пока без лидера');return;}
  const who=senLeadPerson();
  sheetOpen({eye:'Лидер сенатского большинства',title:l.name,
    body:`<div class="res" style="margin-top:0"><span>Фракция</span><b class="w">${P(l.party).name}</b>
        <span>В кресле с</span><b>${shortDate(l.since)}</b>
        <span>Сроков в палате</span><b>${who?senRank(who):'—'}</b>
        <span>Расположение к вам</span><b class="${leadFavour()<40?'bad':leadFavour()>=70?'good':'warn'}">${leadFavour()}</b>
        <span>Сделок с вами</span><b>${l.deals||0}</b></div>
      <p class="hint">Лидер не голосует за вас и не против: он решает, когда ваш проект окажется
        в календаре палаты и окажется ли вообще. Кресло достаётся самому заслуженному сенатору
        крупнейшей фракции — сместить его можно, только сместив саму фракцию.</p>`,
    opts:[
      {label:'Договориться о повестке',hint:'вес '+capCost(LEAD_DEAL,'lobby')+' · расположение и след',
       fn(){ if(!pay({ap:1},'Сделка с лидером большинства'))return; if(!payCap(capCost(LEAD_DEAL,'lobby'))){apBack();return;}
         l.deals=(l.deals||0)+1;
         l.favour=clamp((l.favour||0)+ri(7,14),-40,40);
         if(who)who.rel=clamp(who.rel+ri(5,10),0,100);
         addTrail(ri(3,6),'сделка с лидером Сената');
         logMsg('Договорённость с лидером Сената: расположение '+leadFavour()+'.');
         toast('Расположение: '+leadFavour()); render(); }},
      ...(S.senHold?[{label:'Вытащить проект из-под сукна',hint:'вес '+capCost(LEAD_DEAL,'lobby')+' · «'+T(S.senHold.bill.topic).name+'»',
        fn:()=>pushCalendar()}]:[]),
      {label:'Ничего',hint:'закрыть',fn(){}}]});
}

/* ═══ ВИЦЕ-ПРЕЗИДЕНТ ══════════════════════════════════════════════
   Второе кресло страны и первое по бесполезности — ровно до того
   дня, когда оно становится первым во всём. Между этими днями вице
   ведёт порученное дело или тихо копит обиду. */

/* поручение работает каждый квартал и тем сильнее, чем он способнее */
function vpTick(){
  const v=S.vp; if(!v)return;
  const k=vpSkill()/100, own=v.party===PL||inCoal(v.party);
  if(v.job==='senate'&&own){
    const pool=S.senate.filter(s=>s.party===v.party||inCoal(s.party)||s.rel>44);
    pool.forEach(s=>{ if(Math.random()<0.3)s.rel=clamp(s.rel+1+k*2,0,100); });
    if(S.senLead&&(S.senLead.party===v.party||inCoal(S.senLead.party)))
      S.senLead.favour=clamp((S.senLead.favour||0)+0.8,-40,40);
  }
  if(v.job==='region'&&own){
    const worst=REGIONS.slice().sort((a,b)=>(S.unrest[b.id]||0)-(S.unrest[a.id]||0)).slice(0,2);
    worst.forEach(r=>S.unrest[r.id]=clamp(S.unrest[r.id]-(1.2+k*2.2),0,100));
    if(v.region)S.rmod[v.region]=clamp(S.rmod[v.region]+0.4,-22,22);
  }
  if(v.job==='world'&&own&&S.nb){
    Object.values(S.nb).forEach(n=>{ n.rel=clamp(n.rel+0.5+k*1.1,0,100); });
  }
  if(v.job==='party'&&own){
    S.deputies.filter(d=>d.party===PL).forEach(d=>{ if(Math.random()<0.22)d.rel=clamp(d.rel+1,0,100); });
    S.funds=r1(S.funds+1.5+(v.pop||40)*0.05);
  }
  // известный вице подтягивает и вас, если он ваш
  if(own&&v.pop>=60&&Math.random()<0.2)shiftAll(0.25);
  // честолюбие: без дела оно растёт, с делом — гаснет; ваше собственное — ваше дело
  if(v.you)return;
  v.amb=clamp((v.amb||40)+((v.job||'none')==='none'?0.9:-0.45),0,100);
  if(vpRestless()){ v.restless=(v.restless||0)+1; if(v.restless>=4&&Math.random()<0.3)vpRevolt(); }
  else v.restless=0;
}
/* вице, которому нечего делать, начинает делать себе имя */
function vpRevolt(){
  const v=S.vp; v.restless=0;
  const own=v.party===PL;
  v.amb=clamp(v.amb+4,0,100);
  if(own){
    shiftAll(-0.8); S.deputies.filter(d=>d.party===PL).forEach(d=>{ if(Math.random()<0.3)d.rel=clamp(d.rel-3,0,100); });
    bumpRep('firm',-3);
    logMsg('Вице-президент '+v.name+' выступил со своей программой, не согласовав её с вами.',1);
    chron('Вице-президент повёл свою игру.','b');
    sheetOpen({eye:'Второе кресло',title:'Вице-президент заговорил сам',
      body:`<p class="lead">${v.name} дал большое интервью и изложил взгляды, которые расходятся с вашими
          в мелочах и совпадают в главном — ровно так, как говорят те, кто готовится наследовать.</p>
        <div class="res"><span>Честолюбие</span><b class="bad">${Math.round(v.amb)}</b>
          <span>Известность</span><b>${Math.round(v.pop)}</b>
          <span>Поручение</span><b class="w">${vpJob().name}</b></div>
        <p class="hint">Занятому вице некогда собирать сторонников. Свободному — некуда девать время.</p>`,
      opts:[
        {label:'Дать ему дело',hint:'выбрать поручение',fn:()=>askVPJob(true)},
        {label:'Оставить как есть',hint:'пусть говорит',fn(){}}]});
  } else {
    S.presRel=clamp(S.presRel+ri(2,6),0,100);
    logMsg('Вице-президент '+v.name+' публично разошёлся с президентом.',1);
    chron('Раскол в паре президент — вице.','');
  }
}
function askVPJob(quiet){
  const v=S.vp; if(!v){toast('Кресло вице-президента пусто');return;}
  if(v.party!==PL&&!inCoal(v.party)){toast('Поручения вице даёт его президент, не вы');return;}
  if(!quiet&&S.q-(v.jobQ||0)<VP_TERM){toast('Поручение меняют не чаще раза в год');return;}
  sheetOpen({eye:'Поручение вице-президенту',title:v.name,
    body:`<div class="res" style="margin-top:0"><span>Тип</span><b class="w">${vpKind().name}</b>
        <span>Палата</span><b>${v.sen}</b><span>Известность</span><b>${v.pop}</b>
        <span>Честолюбие</span><b class="${v.amb>=VP_AMB?'bad':''}">${Math.round(v.amb)}</b></div>
      <p class="hint">Одно дело за раз. Способность к палате решает, много ли даст работа с Сенатом;
        известность — много ли даст всё остальное.</p>`,
    opts:VP_JOBS.map(j=>({label:j.name+(v.job===j.id?' · сейчас':''),hint:j.eff,
      fn(){ v.job=j.id; v.jobQ=S.q;
        logMsg('Вице-президенту поручено: '+j.name.toLowerCase()+'.');
        toast(j.name); render(); }}))});
}
/* снять напарника со списка: дорого, обидно и не всегда помогает */
function dropVP(){
  const v=S.vp; if(!v){toast('Кресло и так пусто');return;}
  if(v.party!==PL){toast('Это не ваш вице-президент');return;}
  if(!pay({ap:1,cap:VP_DROP},'Смена вице-президента'))return;
  const old=v.name;
  const fresh=makeVP(PL);
  if(!confirmSenate('vp',fresh,PL)){
    logMsg('Сенат не утвердил нового вице-президента. '+old+' остаётся в кресле.',1);
    v.amb=clamp(v.amb+10,0,100);
    toast('Сенат отклонил замену'); render(); return;
  }
  fresh.dropped=(v.dropped||0)+1;
  S.vp=fresh;
  shiftAll(-0.6); bumpRep('firm',3); bumpRep('honest',-2);
  logMsg('Вице-президент сменён: вместо '+old+' — '+fresh.name+'.',1);
  chron('Смена вице-президента.','');
  render();
}
/* кресло вице пустеет отдельно от президентского */
function vpVacancy(){
  const v=S.vp; if(!v||v.you)return;
  if(S.q-(v.since||0)<6)return;
  const risk=0.008+(v.amb>=VP_AMB?0.008:0);
  if(Math.random()>=risk)return;
  const old=v.name, party=v.party;
  const cand=makeVP(party);
  const ok=confirmSenate('vp',cand,party);
  S.vp=ok?cand:null;
  logMsg('Вице-президент '+old+' оставил пост. '+(ok?'Палата утвердила '+cand.name+'.':'Кресло осталось пустым.'),1);
  chron('Смена вице-президента.','');
  sheetOpen({eye:'Второе кресло',title:'Вице-президент ушёл',
    body:`<p class="lead">${old} прекратил полномочия. Президент вносит новую кандидатуру, и утверждает её Сенат —
        та самая палата, которой вице потом будет председательствовать.</p>
      ${ok?`<div class="res"><span>Новый вице</span><b class="w">${cand.name}</b>
          <span>Тип</span><b class="w">${(VP_KIND.find(k=>k.id===cand.kind)||{}).name}</b>
          <span>Палата</span><b>${cand.sen}</b><span>Честолюбие</span><b>${cand.amb}</b></div>`
        :`<p class="hint">Сенат кандидатуру отклонил. Пока кресло пусто, равенство в палате
            никто не разбивает — а равенство в палате из ста мест случается чаще, чем кажется.</p>`}`,
    acts:[{label:'Принять к сведению'}]});
}
/* напарник по списку: выбор перед выборами, если идёте вы */
function askRunningMate(then){
  const pool=[];
  const kinds=VP_KIND.slice().sort(()=>Math.random()-0.5).slice(0,3);
  kinds.forEach(k=>{
    const c=makeVP(PL,k.id);
    // человек крыла приходит из своего края, глава субъекта — из своего
    pool.push(c);
  });
  sheetOpen({eye:'Список · '+dateLabel(),title:'Кого брать вторым номером',
    body:`<p class="lead">Голосуют за пару, а не за человека. Напарник добирает голоса там, где вас
        знают хуже: свой край, своё крыло, свой возраст. Он же садится председателем Сената —
        и то, что он умеет там, важнее того, что он даёт на выборах.</p>
      <p class="hint">Палата — умение вести Сенат. Имя — известность в стране. Честолюбие — то,
        чем он станет для вас, когда работа надоест.</p>`,
    opts:pool.map(c=>{
      const k=VP_KIND.find(x=>x.id===c.kind);
      return {label:c.name+' · '+k.name,
        hint:'палата '+c.sen+' · имя '+c.pop+' · честолюбие '+c.amb+' · '+R(c.region).name+'. '+k.txt,
        fn(){ S.mate=c; toast('Напарник: '+c.name); if(then)then(); }};
    })});
}
/* прибавка списку от напарника: свой край и своё имя */
function mateBonus(pid){
  if(pid!==PL||!S.mate)return 0;
  return r2(0.4+(S.mate.pop-40)*0.02);
}

/* ═══ НАДЗОР ══════════════════════════════════════════════════════
   След копится сам, дело заводят не сразу и не всегда. */
/* проверка, обыски, обвинение и суд — в cases.js */

/* ═══ ПАРТИЯ ИЗНУТРИ ══════════════════════════════════════════════
   Крыло ропщет, когда линия уезжает от него. Если ропот копится
   и дела идут плохо, находится тот, кто предложит себя вместо вас. */
function challengeTick(){
  if(!chief()){ S.challenge=null; return; }       // вызов бросают лидеру, а лидер — не вы
  if(S.challenge){ S.challenge.left--; if(S.challenge.left<=0)resolveChallenge(); return; }
  const w=wings(), weak=[w.left,w.right].filter(x=>x.length>=8&&wingMood(x)<38);
  if(!weak.length)return;
  const bad=approval()<44||rep('comp')<38||(S.you&&rep('honest')<32);
  if(!bad||Math.random()>0.16)return;
  const list=weak[0];
  const man=list.slice().sort((a,b)=>b.loyal-a.loyal)[0];
  S.challenge={id:man.id,name:man.name,wing:wingOf(man,w.ax),ax:w.ax,left:2};
  logMsg('Внутри фракции поднят вопрос о лидерстве: '+man.name+' готов сменить вас.',1);
  cover({good:'Во фракции спорят о курсе — власть не боится дискуссии',
    bad:'Раскол во фракции: '+man.name+' идёт против лидера',
    flat:'Во фракции обсуждают смену лидера'});
  sheetOpen({eye:'Партия · '+dateLabel(),title:'Вызов лидерству',
    body:`<p class="lead">${man.name} собрал подписи ${WINGNAME[S.challenge.wing]}. Через два квартала фракция проголосует.</p>
      <div class="res"><span>Ось спора</span><b class="w">${AXNAME[w.ax]}</b>
        <span>Настроение крыла</span><b class="bad">${wingMood(list)}</b>
        <span>Ваше одобрение</span><b class="${approval()<44?'bad':''}">${Math.round(approval())}%</b></div>
      <p class="hint">До голосования можно уступить крылу по спорной оси или переубедить его депутатов
        поимённо. Проигрыш не снимает вас с поста, но фракция уйдёт за победителем.</p>`,
    acts:[{label:'Принять вызов'}]});
}
function resolveChallenge(){
  const c=S.challenge; if(!c)return;
  const mine=S.deputies.filter(d=>d.party===PL);
  let me_=0,him=0;
  mine.forEach(d=>{
    let v=(d.rel-50)*0.7+(rep('firm')-50)*0.2+(approval()-46)*0.5;
    v-=Math.abs(d.st[c.ax]-(me().st[c.ax]||0))*9;
    v+=noise(d.id+'chal'+c.id,14);
    (v>0?me_++:him++);
  });
  S.challenge=null;
  if(me_>=him){
    addCap(10); bumpRep('firm',6);
    mine.forEach(d=>d.rel=clamp(d.rel+3,0,100));
    logMsg('Вызов отбит: '+me_+' против '+him+'. Фракция осталась за вами.',1);
    career('Отбит вызов лидерству во фракции.');
    sheetOpen({eye:'Партия',title:'Вызов отбит',body:voteBar(me_,him)+
      '<p>Фракция подтвердила ваше лидерство. Несогласные притихли, но не исчезли.</p>',
      acts:[{label:'Дальше'}]});
  } else {
    // фракция раскалывается: часть крыла уходит
    const gone=S.deputies.filter(d=>d.party===PL&&wingOf(d,c.ax)===c.wing).slice(0,Math.max(4,Math.round(mine.length*0.18)));
    const to=S.parties.filter(p=>p.id!==PL)
      .sort((a,b)=>axDist(a.st,me().st)-axDist(b.st,me().st))[0];
    gone.forEach(d=>{ d.party=to.id; S.seats[PL]--; S.seats[to.id]=(S.seats[to.id]||0)+1; });
    addCap(-14); bumpRep('firm',-8); shiftAll(-2);
    logMsg('Вызов проигран: '+him+' против '+me_+'. '+gone.length+' депутатов ушли за '+c.name+'.',1);
    career('Проигран вызов лидерству: фракция потеряла '+mandates(gone.length)+'.');
    chron('Раскол во фракции: ушли '+gone.length+' депутатов.','b');
    sheetOpen({eye:'Партия',title:'Фракция раскололась',body:voteBar(me_,him)+
      `<p>${c.name} собрал больше голосов. ${mandates(gone.length)} перешли к «${to.name}».
        Вы остались лидером того, что осталось.</p>`,
      acts:[{label:'Принять'}]});
  }
  render();
}
/* уступить крылу: сдвинуть линию партии и снять напряжение */
function yieldWing(){
  const c=S.challenge; if(!c)return;
  if(!pay({ap:1,cap:8},'Уступка крылу партии'))return;
  const dir=c.wing==='left'?-0.5:0.5;
  me().st[c.ax]=clamp(r1((me().st[c.ax]||0)+dir),-2,2);
  S.deputies.filter(d=>d.party===PL&&wingOf(d,c.ax)===c.wing)
    .forEach(d=>d.rel=clamp(d.rel+ri(8,16),0,100));
  bumpRep('firm',-4);
  logMsg('Линия партии сдвинута к '+WINGNAME[c.wing]+' по оси «'+AXNAME[c.ax]+'».',1);
  toast('Крыло успокоилось');
  render();
}

/* ═══ СОСЕДИ ══════════════════════════════════════════════════════ */
function nbTick(){
  if(!S.nb)return;
  NEIGHBOURS.forEach(x=>{
    const st=nbOf(x.id); if(!st)return;
    let want=clamp(60-axDist(st.st||x.st,me().st)*10,10,90);   // курс соседа может смениться вместе с его властью
    if(st.treaty)want+=12;
    if(hasTrait('diplo'))want+=6;
    st.rel=clamp(st.rel+(want-st.rel)*0.09+rnd(-2.5,2.5),0,100);
  });
}
function nbTreaty(id){
  const x=NB_(id), st=nbOf(id);
  if(!fpCan()){toast('Договоры подписывает кабинет или президент');return;}
  if(st.treaty){toast('Договор уже есть');return;}
  if(st.rel<48){toast('С таким отношением договор не подпишут');return;}
  if(!pay({ap:1,cap:TREATY_COST},'Договор с соседями'))return;
  // международный договор ратифицирует Сенат
  const ok=confirmSenate('treaty',{name:'с «'+x.name+'»',st:x.st},S.gov.lead);
  if(!ok){
    addCap(-4);
    sheetOpen({eye:'Сенат',title:'Договор не ратифицирован',
      body:`<p class="lead">Палата субъектов отказалась ратифицировать договор с «${x.name}».</p>
        <p class="hint">Договор подписывает правительство, но силу ему даёт Сенат. Пока там нет ваших
          пятидесяти одного — внешняя политика упирается во внутреннюю.</p>`,
      acts:[{label:'Закрыть'}]});
    render(); return;
  }
  st.treaty=true; st.rel=clamp(st.rel+14,0,100);
  bumpRep('comp',4);
  career('Заключён договор с «'+x.name+'».');
  chron('Подписан договор с «'+x.name+'».','g');
  cover({ax:'world',stance:1,
    good:'Договор с «'+x.name+'»: рынки открываются',
    bad:'Уступки «'+x.name+'»: чем заплатим?',
    flat:'Подписан договор с «'+x.name+'»'});
  logMsg('Договор с «'+x.name+'» ратифицирован Сенатом.',1);
  render();
}
/* визит с повесткой, лист соседа, торговля, санкции и граница — в foreign.js */

/* ═══ РЕФЕРЕНДУМ ══════════════════════════════════════════════════
   Вопрос стране мимо палат и мимо подписи. Считается по настроению
   групп на этой оси, а не по фракциям. */
function refSupport(topic,stance){
  const t=T(topic), pop=popularStance();
  let s=0,w=0;
  GROUPS.forEach(g=>{
    const want=g.pref[t.ax]||0;
    const fit=clamp(60-Math.abs(want-stance)*17,5,95);
    const ww=g.w[t.ax]*(0.5+S.mood[g.id]/100);
    s+=fit*ww; w+=ww;
  });
  let v=s/(w||1);
  v+=(approval()-50)*0.22;                    // популярную власть слушают охотнее
  v+=pressTone()*0.18;
  v+=(rep('honest')-50)*0.08;
  return clamp(r1(v),2,98);
}
function callReferendum(topic,stance){
  if(!isPres()&&!(isPM()&&seatsOf(PL)>=superN())){
    toast('Референдум назначает президент или две трети Собрания');return; }
  if(S.ref){toast('Один референдум за раз');return;}
  if(!pay({ap:1,cap:refCost(),gold:refGold()},'Референдум'))return;
  const t=T(topic), sup=refSupport(topic,stance);
  const yes=Math.random()*100<sup;
  const bill={topic,stance,riders:[],by:PL};
  if(yes){
    enact(bill);
    const l=lawOn(topic); if(l){ l.ref=true; l.until=S.q+REF_LOCK; }
    S.ref={topic,stance,q:S.q,until:S.q+REF_LOCK,yes:true};
    addCap(18); shiftAll(3); bumpRep('folk',8); bumpRep('firm',4);
    career('Выигран референдум: '+t.name.toLowerCase()+'.');
    chron('Референдум: страна поддержала «'+t.name.toLowerCase()+'».','g');
  } else {
    addCap(-20); shiftAll(-4); bumpRep('folk',-6); bumpRep('comp',-5);
    S.ref=null;
    career('Проигран референдум: '+t.name.toLowerCase()+'.');
    chron('Референдум провален.','b');
  }
  cover({ax:t.ax,stance,
    good:yes?'Страна сказала да: «'+t.name.toLowerCase()+'» принято прямым голосованием'
            :'Власть услышала отказ и приняла его',
    bad:yes?'Референдум продавлен: вопрос поставили так, как было нужно'
           :'Провал на референдуме: страна отвергла предложение власти',
    flat:'Референдум: '+(yes?'да':'нет')+' по вопросу «'+t.name.toLowerCase()+'»'});
  sheetOpen({eye:'Референдум · '+dateLabel(),title:yes?'Страна сказала да':'Страна сказала нет',
    body:voteBar(Math.round(sup),100-Math.round(sup))+
      `<p class="lead">${t.name} — ${stanceLine(bill)}</p>
       <div class="res"><span>За</span><b class="${yes?'good':'bad'}">${Math.round(sup)}%</b>
         <span>Итог</span><b class="w">${yes?'принято':'отклонено'}</b>
         ${yes?`<span>Нельзя переписать до</span><b>${dateLabel(S.q+REF_LOCK)}</b>`:''}</div>
       <p class="hint">${yes
         ? 'Решение принято прямым голосованием: ни палаты, ни президент не отменят его до срока.'
         : 'Прямое поражение стоит дороже парламентского: страна сказала нет вам лично.'}</p>`,
    acts:[{label:'Принять'}]});
  render();
}
function askReferendum(){
  sheetOpen({eye:'Референдум · '+refCost()+' веса и '+refGold()+' млрд',title:'По какому направлению',
    body:`<p class="lead">Прямой вопрос стране мимо обеих палат и мимо подписи. Считают не фракции,
      а восемь групп: смотрите, чего хочет страна, а не Собрание.</p>`
      +(CN().initiative?'<p class="hint">Ст. 104 ч. 2: вопрос выносится подписями избирателей, и это вдвое дешевле.</p>':''),
    opts:AXES.map(a=>{ const n=TOPICS.filter(t=>t.ax===a.id&&!t.special).length;
      return {label:a.name,hint:a.l+' ↔ '+a.r+' · '+plural(n,'тема','темы','тем'),
        fn:()=>askRefTopic(a.id)}; })});
}
function askRefTopic(ax){
  const list=TOPICS.filter(t=>t.ax===ax&&!t.special);
  sheetOpen({eye:'Референдум · '+AXNAME[ax],title:'Какой вопрос вынести',
    opts:list.map(t=>({label:t.name,
      hint:'за +2: '+refSupport(t.id,2)+'% · за −2: '+refSupport(t.id,-2)+'%',
      fn(){ sheetOpen({eye:'Референдум · '+t.name,title:'Какая редакция',
        opts:[-2,-1,1,2].map(v=>({label:STEP[v+2]+' · '+(v<0?t.l:t.r),
          hint:'поддержка '+refSupport(t.id,v)+'%',fn:()=>callReferendum(t.id,v)}))}); }}))
      .concat([{label:'Назад к направлениям',hint:'',fn:askReferendum}])});
}

/* ═══ КАБИНЕТ ═════════════════════════════════════════════════════
   Портфель отдан партии — это политика; кто именно сидит в кресле —
   это работа ведомства. Перестановка меняет человека, не меняя
   коалиционного расклада, и потому стоит веса, а не портфеля. */
function reshuffle(post){
  if(!isPM()){toast('Кабинет собирает глава правительства');return;}
  const m=minOf(post); if(!m)return;
  if(!pay({ap:1,cap:PM_COST},'Перестановка в кабинете'))return;
  const was=m.comp;
  // новый человек той же партии: обычно сильнее прежнего, но не всегда
  const fresh=makeMinister(post,m.party);
  fresh.comp=clamp(ri(38,92)+(rep('comp')-50)*0.2,20,95);
  if(!confirmSenate('post',fresh,m.party)){
    addCap(-2);
    sheetOpen({eye:'Сенат',title:'Кандидатура отклонена',
      body:`<p class="lead">Палата не утвердила ${fresh.name} на пост «${POSTS.find(x=>x.id===post).name}».</p>
        <p class="hint">Кресло осталось за прежним министром. Пока в Сенате нет ваших ${SEN_MAJ},
          кадровые решения кабинета проходят не всегда.</p>`,
      acts:[{label:'Закрыть'}]});
    render(); return;
  }
  S.ministers[post]=fresh;
  S.pm.reshuffles=(S.pm.reshuffles||0)+1;
  if(m.party!==PL)S.deputies.filter(d=>d.party===m.party).forEach(d=>d.rel=clamp(d.rel-3,0,100));
  bumpRep('firm',1.5);
  const pn=POSTS.find(x=>x.id===post).name;
  logMsg('Перестановка: '+pn+' принял '+fresh.name+' ('+minWord(fresh)+', было '+was+').',1);
  career('Перестановка в кабинете: '+pn.toLowerCase()+'.');
  toast(fresh.comp>was?'Министр сильнее прежнего':'Министр слабее прежнего');
  render();
}
function askMinister(post){
  const m=minOf(post), pn=POSTS.find(x=>x.id===post);
  sheetOpen({eye:'Министерство · '+pn.name,title:m.name,
    body:`<div class="res"><span>Ведомство даёт</span><b class="w">${pn.eff}</b>
        <span>Партия</span><b class="w">${P(m.party).name}</b>
        <span>Компетентность</span><b class="${m.comp<40?'bad':m.comp>=72?'good':''}">${m.comp} · ${minWord(m)}</b>
        <span>В должности</span><b>${quarters(S.q-m.since)}</b>
        <span>Вклад ведомства</span><b class="${minPower(post)<0?'bad':'good'}">${sign(Math.round(minPower(post)*100))}%</b></div>
      <p class="hint">${S.q-m.since>MIN_TERM
        ? 'Министр засиделся: после двух лет в кресле ведомство работает хуже, чем могло бы.'
        : 'Компетентность министра усиливает или гасит эффект ведомства. Партия портфеля при этом не меняется.'}</p>`,
    opts:[
      {label:'Заменить министра',hint:PM_COST+' веса · та же партия, другой человек',fn:()=>reshuffle(post)},
      {label:'Передать портфель другой фракции',hint:'политическое решение, меняет коалицию',fn:()=>askPost(post)},
      {label:'Оставить',hint:'не тратить квартал',fn(){}}]});
}

/* ═══ ГЛАВЫ СУБЪЕКТОВ ═════════════════════════════════════════════
   Кто ставит губернатора, решает закон о местном самоуправлении:
   при вертикали его назначает кабинет, при автономии выбирает край.
   Отсюда и вся игра вокруг этой оси — она наконец что-то значит. */

/* партия, которую субъект выберет сам */
function govWinner(rid){
  const r=R(rid), sc={};
  S.parties.forEach(p=>sc[p.id]=partyScore(p,r));
  const sh=shareFrom(sc);
  // губернаторские выборы — не пропорциональные: сильнейший берёт край,
  // но узкий отрыв решает явка, поэтому у второго остаётся шанс
  const ord=Object.entries(sh).sort((a,b)=>b[1]-a[1]);
  const gap=(ord[0][1]-ord[1][1])/Math.max(1,ord[0][1]);
  return (gap<0.14&&Math.random()<0.38)?ord[1][0]:ord[0][0];
}
function seatGov(rid,party,how){
  const old=govOf(rid);
  const g=makeGov(rid,party);
  if(how==='appoint'){ g.rel=clamp(g.rel+14,0,100); g.appointed=true; }
  g.till=S.q+GOV_TERM;
  S.govs[rid]=g;
  S.govLog.unshift({q:S.q,region:rid,name:g.name,party,how,was:old?old.party:null});
  if(S.govLog.length>60)S.govLog.pop();
  return g;
}
/* смена глав по истечении срока — по одному субъекту за раз, чтобы
   каждая была событием, а не строчкой в общем списке */
function governorTick(){
  REGIONS.forEach(r=>{
    const g=govOf(r.id); if(!g||g.you)return;
    // отношение дрейфует к тому, насколько вы близки его партии
    const want=clamp(62-axDist(P(g.party).st,me().st)*12+(inCoal(g.party)?10:0),8,94);
    g.rel=clamp(g.rel+(want-g.rel)*0.10+rnd(-1.6,1.6),0,100);
    if(S.unrest[r.id]>42)g.rel=clamp(g.rel-0.8,0,100);      // в горящем крае злятся на центр
  });
  const due=REGIONS.filter(r=>{const g=govOf(r.id);return g&&S.q>=g.till;});
  if(!due.length)return;
  const r=due[0];
  if(govOf(r.id).you){ youGovDue(r.id); return; }
  if(S.you.cands&&S.you.cands.gov&&S.you.cands.gov.rid===r.id){ if(govCandResolve(r.id))return; }
  else
  if(mySeat()==='mayor'&&S.desk&&S.desk.rid===r.id&&!S.over){ mayorRace(r.id); return; }
  const elected=govElected();
  const winner=elected?govWinner(r.id):(isPM()?PL:S.gov.lead);
  const was=govOf(r.id);
  const g=seatGov(r.id,winner,elected?'elect':'appoint');
  const mine=winner===PL||inCoal(winner);
  logMsg((elected?'Выборы главы: ':'Назначен глава: ')+R(r.id).name+' — '+g.name+' ('+P(winner).short+').',mine?0:1);
  if(!elected&&!isPM()&&S.gov.lead!==PL)
    logMsg('Главу назначал не ваш кабинет: край достался «'+P(winner).name+'».');
  chron((elected?'Край выбрал главу: ':'Центр назначил главу: ')+R(r.id).name+' — '+P(winner).short+'.',mine?'g':'');
  if(elected&&!mine)shiftMood('agro',-0.6);
}

/* договориться с главой субъекта: вес и деньги в обмен на лояльность */
function dealGov(rid){
  const g=govOf(rid); if(!g)return;
  if(!pay({ap:1,cap:GOV_DEAL},'Сделка с главой края'))return;
  const add=ri(9,18)+(hasTrait('zemsky')?5:0);
  g.rel=clamp(g.rel+add,0,100); g.deals++;
  S.unrest[rid]=clamp(S.unrest[rid]-ri(1,4),0,100);
  bumpRep('folk',0.5);
  logMsg('Договорённость с главой '+R(rid).name+': отношение +'+add+'.');
  toast('Глава пошёл навстречу');
  render();
}
/* снять назначенца — только при вертикали и только главе кабинета */
function fireGov(rid){
  const g=govOf(rid); if(!g)return;
  if(govElected()){toast('Выборного главу центр не снимает');return;}
  if(regAuto(rid)>=1){toast('У края автономия: главу из центра не снять');return;}
  if(!isPM()){toast('Назначения делает глава кабинета');return;}
  if(g.party===PL){toast('Это и так ваш человек');return;}
  if(!pay({ap:1,cap:GOV_FIRE},'Отставка главы края'))return;
  const was=P(g.party);
  const ng=seatGov(rid,PL,'appoint');
  S.unrest[rid]=clamp(S.unrest[rid]+ri(3,9),0,100);
  shiftMood('intel',-1); shiftMood('agro',-0.8);
  bumpRep('firm',3); bumpRep('honest',-1.5);
  addTrail(ri(5,10),'отставка главы '+R(rid).name);
  cover({ax:'reg',stance:-2,
    good:'Центр навёл порядок в крае',
    bad:'Произвол: глава '+R(rid).name+' смещён без объяснений',
    flat:'В крае '+R(rid).name+' сменился глава'});
  career('Смещён глава '+R(rid).name+'.');
  logMsg('Глава '+R(rid).name+' отправлен в отставку, край возглавил '+ng.name+'.',1);
  chron('Отставка главы '+R(rid).name+'.','');
  sheetOpen({eye:'Кадровое решение · '+R(rid).name,title:'Глава заменён',
    body:`<p class="lead">${was.name} потеряла край. Новый глава — ${ng.name}, человек вашей партии.</p>
      <p>Вертикаль работает, но край это запомнил: напряжённость подскочила, интеллигенция и село
        считают такие отставки произволом.</p>`,
    acts:[{label:'Закрыть'}]});
  render();
}
function askGov(rid){
  const g=govOf(rid); if(!g)return;
  const r=R(rid), elected=govElected();
  const opts=[{label:'Договориться',hint:GOV_DEAL+' веса · отношение вверх, напряжённость вниз',fn:()=>dealGov(rid)}];
  if(!elected&&isPM()&&g.party!==PL&&!regAuto(rid))
    opts.push({label:'Отправить в отставку',hint:GOV_FIRE+' веса · край возглавит ваш человек',fn:()=>fireGov(rid)});
  opts.push({label:'Оставить как есть',hint:'не тратить квартал',fn(){}});
  sheetOpen({eye:'Глава субъекта · '+r.name,title:g.name,
    body:`<div class="res"><span>Партия</span><b class="w">${P(g.party).name}</b>
        <span>Отношение к вам</span><b class="${g.rel<36?'bad':g.rel>=52?'good':'warn'}">${Math.round(g.rel)} · ${govLoyal(g)}</b>
        <span>Компетентность</span><b>${g.comp}</b>
        <span>Вклад в край</span><b class="${govEffect(rid)<0?'bad':'good'}">${sign(govEffect(rid))}</b>
        <span>Срок истекает</span><b>${dateLabel(g.till)}</b>
        <span>Как получил край</span><b class="w">${g.appointed?'назначен центром':'выбран краем'}</b></div>
      <p class="hint">${elected
        ? 'Сейчас глав выбирают сами субъекты: снять его центр не может, остаётся договариваться.'
        : 'Сейчас глав назначает кабинет: неугодного можно сменить, но край воспримет это как произвол.'}</p>`,
    opts});
}

/* ─── переизбрание трети Сената ───────────────────────────────────
   Раз в два года на выборы идёт один класс. Собрание к этому дню
   может быть каким угодно — Сенат меняется своим ходом. */
function senateElection(){
  const cls=S.senCls, was={...S.senSeats};
  const kept=S.senate.filter(s=>s.cls!==cls||s.life), fresh=[];
  let retired=0, kept_in=0;
  REGIONS.forEach(r=>{
    const old=S.senate.filter(s=>s.cls===cls&&s.region===r.id&&!s.life);   // пожизненный сенатор не переизбирается
    if(!old.length)return;
    // старик уходит сам: после четвёртого срока каждый второй не выдвигается
    const runs=old.filter(s=>{ const go=!s.you&&senRank(s)>=4&&Math.random()<0.42;
      if(go)retired++; return !go; });
    const sc={}; S.parties.forEach(p=>sc[p.id]=partyScore(p,r));
    // ваше имя в крае добавляет списку партии: сенатор идёт сам
    if(runs.some(s=>s.you)&&S.desk)sc[PL]*=1+clamp(((S.desk.home||50)-50)*0.006,-0.15,0.2);
    const won=dhondt(shareFrom(sc),old.length);
    Object.entries(won).forEach(([pid,k])=>{
      const inc=runs.filter(s=>s.party===pid).sort((a,b)=>(b.you?1:0)-(a.you?1:0));
      for(let i=0;i<k;i++){
        if(inc[i]){ const s=inc[i];
          s.rel=clamp(s.rel*0.9+8,0,100); s.deals=0; s.note=''; s.since=S.q;
          s.terms=senRank(s)+1; s.spledge=0; kept_in++; fresh.push(s); }
        else fresh.push(makeSen(pid,r.id,cls,'n'+i+S.q));
      }
    });
  });
  S.senate=kept.concat(fresh);
  const tot={}; S.parties.forEach(p=>tot[p.id]=0);
  S.senate.forEach(s=>tot[s.party]++);
  S.senSeats=tot;
  senCandResolve();                              // вы выдвигались — узнаёте первым
  S.senCls=(cls+1)%3;
  seatSenLeader();
  if(inSenate()&&!S.senate.some(s=>s.you))lostSeat('край '+R(S.desk.rid).name+' не переизбрал вас в Сенат');
  const elders=S.senate.filter(senElder).length;

  const rows=S.parties.slice().sort((a,b)=>senSeatsOf(b.id)-senSeatsOf(a.id)).map(p=>{
    const d=senSeatsOf(p.id)-(was[p.id]||0);
    return `<tr><td>${chip(p)} ${p.name}${p.id===PL?' <span class="tag y">вы</span>':''}</td>
      <td class="n">${senSeatsOf(p.id)}</td>
      <td class="n ${d>0?'good':d<0?'bad':'dim'}">${d?sign(d):'—'}</td></tr>`;}).join('');
  logMsg('Переизбрана треть Сената: у вас '+senSeatsOf(PL)+' из '+SEN_SEATS+'.',1);
  chron('Обновилась треть Сената.','');
  sheetOpen({eye:'Выборы в Сенат · '+dateLabel(),title:'Обновилась треть палаты',
    body:`<p class="lead">Треть сенаторов переизбиралась в своих субъектах. Остальные две трети остались на местах — Сенат никогда не меняется весь сразу.</p>
      <table class="tight"><thead><tr><th>Партия</th><th class="r">Мест</th><th class="r">Сдвиг</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="res"><span>Переизбраны</span><b>${kept_in}</b>
        <span>Ушли по стажу</span><b>${retired}</b>
        <span>Старейшин в палате</span><b>${elders}</b>
        <span>Лидер большинства</span><b class="w">${S.senLead?S.senLead.name:'—'}</b></div>
      <p class="hint" style="margin-top:8px">Для большинства в Сенате нужно ${SEN_MAJ}, чтобы закрыть прения — ${cloture()}.
        У коалиции ${senCoalSeats()}.</p>`,
    acts:[{label:'Принять к сведению'}]});
}

/* ─── президентские выборы ────────────────────────────────────────
   Всенародные, в два тура. Идут отдельно от Собрания, поэтому
   президент и большинство почти никогда не совпадают. */
function presScores(){
  const votes={}; S.parties.forEach(p=>votes[p.id]=0);
  const popTot=REGIONS.reduce((a,r)=>a+r.pop,0);
  REGIONS.forEach(r=>{
    const sc={}; S.parties.forEach(p=>sc[p.id]=partyScore(p,r));
    // напарник по списку добирает голоса в своём краю и по стране своим именем
    if(S.mate){ sc[PL]*=(1+mateBonus(PL)*0.03+(S.mate.region===r.id?0.16:0)); }
    // проигранные праймериз: партия идёт с чужим и менее известным лицом
    if(S.primWin===false)sc[PL]*=0.88; else if(S.primWin===true)sc[PL]*=1.06;
    const sh=shareFrom(sc);
    S.parties.forEach(p=>votes[p.id]+=sh[p.id]*r.pop);
  });
  const out={}; S.parties.forEach(p=>out[p.id]=r1(votes[p.id]/popTot));
  return out;
}
/* второй тур: избиратели выбывших расходятся по близости, часть не приходит */
function runoffSplit(a,b,first,endorse){
  let va=first[a.id], vb=first[b.id];
  S.parties.forEach(p=>{
    if(p.id===a.id||p.id===b.id)return;
    const da=axDist(p.st,a.st)+0.01, db=axDist(p.st,b.st)+0.01;
    let toA=db/(da+db);
    if(endorse&&p.id===PL)toA=endorse===a.id?clamp(toA+0.28,0,1):clamp(toA-0.28,0,1);
    const come=first[p.id]*0.86;                 // часть избирателей просто не идёт
    va+=come*toA; vb+=come*(1-toA);
  });
  const t=va+vb||1;
  return {a:r1(va/t*100), b:r1(vb/t*100)};
}
function installPres(pid,share){
  const p=P(pid), was=S.pres?S.pres.party:null;
  closeReign('pres','выборы');
  const same=was===pid, limited=same&&termLimit()>0&&(S.pres.term||1)>=termLimit();
  // два срока подряд — предел для человека, не для партии: та выставляет новое лицо
  const youRun=pid===PL&&plCandYou()&&!limited;
  const name=limited?depName():(pid===PL?plCandName():p.leader);
  const wasPres=mySeat()==='pres', wasVP=mySeat()==='vp'&&S.vp&&S.vp.you;
  S.pres={party:pid, name, since:S.q, until:S.q+pTerm(),
          term:limited?1:(same?(S.pres.term||1)+1:1), vetoes:0, decrees:0};
  // вице шёл тем же списком: если список составляли вы, это ваш напарник
  if(pid===PL&&S.mate&&youRun)seatVP(pid,null,S.mate);
  else if(S.mateOffer===pid){
    // вы шли вторым номером в чужом списке — и список выиграл
    const you=makeVP(pid); you.name=S.you.name; you.kind='wing'; you.you=true;
    you.sen=Math.round(clamp(40+rep('comp')*0.3,20,92)); you.pop=Math.round(rep('folk')); you.amb=70;
    seatVP(pid,null,you);
    setSeat('vp','Избран вице-президентом в списке «'+P(pid).short+'».');
    addCap(14); shiftAll(1);
  }
  // своя партия выиграла с чужим первым номером: вы остаётесь вторым
  else if(pid===PL&&wasVP&&!youRun)seatVP(pid,null,{...S.vp});
  else seatVP(pid);
  S.mate=null; S.mateOffer=null; S.primWin=null; S.primLost=null;
  if(youRun)setSeat('pres','Избрание президентом.');
  else if(wasPres){ setSeat(fallbackSeat(),'Президентский срок окончен.'); offerLifeSenate(); }
  if(mySeat()==='vp'&&!(S.vp&&S.vp.you))setSeat(fallbackSeat(),'Срок вице-президента окончен.');
  S.presRel=pid===PL?(youRun?100:86):clamp(Math.round(70-axDist(p.st,me().st)*12),20,85);
  if(youRun){ addCap(22); shiftAll(1.6); bumpRep('comp',5); bumpRep('folk',4);
    career('Избрание президентом республики — '+share+'% голосов.'); }
  else if(wasPres)career('Проиграно президентское кресло: победа '+p.short+'.');
  openReign('pres',S.pres.name,S.pres.party);
  logMsg('Президентом избран'+(youRun?'ы вы: ':pid===PL?' кандидат вашей партии ':' ')+S.pres.name+' ('+p.short+') — '+share+'%.',1);
  chron('Президент — '+S.pres.name+' («'+p.name+'»).',pid===PL?'g':'');
}
function presRow(p,v,mark){
  return `<tr><td>${chip(p)} ${p.id===PL?plCandName():p.leader}<div class="sub2">${p.name}${mark?' · '+mark:''}</div></td>
    <td class="n">${v}%</td><td style="width:110px">${bar([[v,p.color]],8)}</td></tr>`;
}
function presElection(){
  // список составляется до подсчёта: напарник влияет на результат
  if(!S.mate&&seatsOf(PL)>0&&plCandYou()){ askRunningMate(()=>presElectionRun()); return; }
  presElectionRun();
}
function presElectionRun(){
  const first=presScores();
  // отсидевший два срока не идёт третий: партия выставляет менее известного
  if(termLimit()>0&&(S.pres.term||1)>=termLimit()){ const id=S.pres.party; first[id]=r1(first[id]*0.82); }
  const order=S.parties.slice().sort((a,b)=>first[b.id]-first[a.id]);
  const rows=order.map(p=>presRow(p,first[p.id],p.id===PL?'ваша партия':'')).join('');
  const top=order[0], second=order[1];
  const outright=first[top.id]>50;

  const head=`<p class="lead">Президента выбирает вся страна и на шесть лет. Собрание к этому дню не переизбирается: две власти живут по разным часам.</p>
    <table class="tight"><thead><tr><th>Кандидат</th><th class="r">Голоса</th><th></th></tr></thead><tbody>${rows}</tbody></table>`;

  if(outright){
    const who=top.id===PL?plCandName():top.leader;
    sheetOpen({eye:'Президентские выборы · '+dateLabel(),title:'Победа в первом туре',
      body:head+`<p class="hint" style="margin-top:8px">${who} взял больше половины голосов: второй тур не нужен.</p>`,
      acts:[{label:'Дальше',fn:()=>installPres(top.id,first[top.id])}]});
    return;
  }
  const finish=(endorse)=>{
    const sp=runoffSplit(top,second,first,endorse);
    const winner=sp.a>=sp.b?top:second, wv=sp.a>=sp.b?sp.a:sp.b;
    sheetOpen({eye:'Второй тур · '+dateLabel(),title:'Итог второго тура',
      body:`<table class="tight"><tbody>${presRow(top,sp.a,'')}${presRow(second,sp.b,'')}</tbody></table>
        <div style="text-align:center;margin:14px 0 4px"><span class="stamp ${winner.id===PL?'y':'n'}">${
          winner.id===PL?(plCandYou()?'вы победили':'победил '+plCandName()):'президент — '+(winner.leader||'')}</span></div>`,
      acts:[{label:'Принять результат',fn:()=>installPres(winner.id,wv)}]});
  };
  if(top.id===PL||second.id===PL){
    sheetOpen({eye:'Президентские выборы · '+dateLabel(),title:'Вы во втором туре',
      body:head+`<p class="hint" style="margin-top:8px">Никто не взял половину. Во второй тур выходят двое, голоса выбывших разойдутся по близости взглядов.</p>`,
      acts:[{label:'Ко второму туру',fn:()=>finish(null)}]});
  } else {
    sheetOpen({eye:'Президентские выборы · '+dateLabel(),title:'Вы выбыли. Кого поддержать?',
      body:head+`<p class="hint" style="margin-top:8px">Ваши избиратели пойдут за вами не полностью, но поддержка победителя запоминается: с ним будет легче договариваться.</p>`,
      opts:[
        {label:'Поддержать '+(top.leader||''),hint:P(top.id).name+' · '+first[top.id]+'%',fn:()=>finish(top.id)},
        {label:'Поддержать '+(second.leader||''),hint:P(second.id).name+' · '+first[second.id]+'%',fn:()=>finish(second.id)},
        {label:'Никого не поддерживать',hint:'сохранить руки развязанными',fn:()=>finish(null)}]});
  }
}
function presTick(){
  if(S.q>=S.pres.until)presElection();
}
/* Президент может освободить кресло досрочно: возраст, здоровье,
   скандал. Тогда его доводит вице — и срок не обнуляется. */
function presVacancy(){
  if(isPres())return;                          // ваш срок жребием не обрывается
  if(S.q<S.pres.since+4||presLeft()<3)return;
  const risk=0.012+(S.presRel<26?0.012:0)+(avgUnrest()>46?0.01:0);
  if(Math.random()>risk)return;
  const old=S.pres.name, vpn=S.vp?S.vp.name:depName(), party=S.pres.party;
  const was=S.vp?{...S.vp}:null, heir=!!(S.vp&&S.vp.you);
  closeReign('pres','наследование');
  S.pres={party, name:vpn, since:S.q, until:S.pres.until, term:S.pres.term,
          vetoes:S.pres.vetoes, decrees:S.pres.decrees, succeeded:true};
  openReign('pres',S.pres.name,S.pres.party);
  // кресло вице освободилось вместе с президентским: новую пару утверждает Сенат
  const cand=makeVP(party);
  const okVP=confirmSenate('vp',cand,party);
  S.vp=okVP?cand:null;
  if(heir){ setSeat('pres','Кресло президента перешло к вам как к вице-президенту.'); S.presRel=100; }
  logMsg('Президент '+old+' оставил пост. Полномочия принял вице-президент '+vpn+'.',1);
  chron('Президент '+old+' ушёл, кресло занял вице-президент.','');
  sheetOpen({eye:'Досрочная передача власти',title:'Президент оставил пост',
    body:`<p class="lead">${old} прекратил полномочия до истечения срока. Конституция не назначает
        новых выборов: кресло переходит к вице-президенту, и он доводит срок до конца.</p>
      <div class="res"><span>Новый президент</span><b class="w">${vpn}</b>
        <span>Партия</span><b class="w">${P(party).name}</b>
        <span>Осталось от срока</span><b>${quarters(presLeft())}</b>
        <span>Это вы</span><b class="w">${heir?'да':'нет'}</b></div>
      <p class="hint">${okVP
        ? 'Новый вице-президент — '+cand.name+' — утверждён Сенатом и с этого дня председательствует в палате.'
        : 'Сенат новую кандидатуру отклонил: кресло вице пустует, и равенство в палате разбивать некому.'}
        ${was&&was.job&&was.job!=='none'?'Поручение прежнего вице («'+(VP_JOBS.find(j=>j.id===was.job)||{}).name.toLowerCase()+'») отменено.':''}</p>`,
    acts:[{label:'Принять к сведению'}]});
}
/* президент подбирает главу кабинета: вес фракции и близость к себе */
function nominatePM(){
  if(seatsOf(PL)>=MAJ)return PL;
  // счёт ведётся в мандатах: пройти мимо крупнейшей фракции президент может,
  // только если отрыв невелик — иначе Собрание такой кабинет не утвердит
  const pp=presParty();
  let best=null,bv=-1e9;
  S.parties.forEach(p=>{
    let v=seatsOf(p.id)-axDist(p.st,pp.st)*14;
    if(p.id===pp.id)v+=22;
    if(p.id===PL)v+=(S.presRel-50)*0.6;
    if(v>bv){bv=v;best=p.id;}
  });
  return best;
}

/* ─── обещания на созыв ──────────────────────────────────────── */
function choosePromises(){
  const chosen=[];
  const ask=()=>{
    const avail=PROMISES.filter(p=>chosen.indexOf(p.id)<0);
    sheetOpen({eye:'Начало созыва · обещание '+(chosen.length+1)+' из 2',title:'Что вы обещаете стране',
      body:'<p class="lead">Выполненное обещание на выборах прибавляет поддержки и веса, проваленное отнимает вдвое больше. Выберите два.</p>',
      opts:avail.map(p=>({label:p.name,hint:'сейчас: '+p.val()+' · нужно '+p.goal,fn(){
        chosen.push(p.id);
        S.promises=chosen.map(id=>({id,given:S.q}));
        if(chosen.length<2)ask();
        else { logMsg('Программа созыва оглашена: '+chosen.map(id=>PR(id).name.toLowerCase()).join('; ')+'.',1);
          chron('Партия дала два обещания на созыв.',''); }
      }}))});
  };
  ask();
}
function checkPromises(){
  if(!S.promises||!S.promises.length)return '';
  let out='';
  S.promises.forEach(pp=>{
    const pr=PR(pp.id); if(!pr)return;
    const ok=pr.ok();
    if(ok){ shiftAll(4); addCap(12); bumpRep('honest',7); bumpRep('comp',4); }
    else  { shiftAll(-6); addCap(-8); bumpRep('honest',-9); bumpRep('comp',-5); }
    career('Обещание «'+pr.name.toLowerCase()+'»: '+(ok?'выполнено':'провалено')+'.');
    logMsg('Обещание «'+pr.name+'»: '+(ok?'выполнено':'провалено')+'.',1);
    chron('Обещание «'+pr.name.toLowerCase()+'»: '+(ok?'выполнено':'провалено')+'.',ok?'g':'b');
    out+=`<span>${pr.name}</span><b class="w ${ok?'good':'bad'}">${ok?'выполнено':'провалено'} · ${pr.val()}</b>`;
  });
  return '<div class="res">'+out+'</div>';
}
function startTerm(){
  career('Созыв '+S.term+': сформировано правительство, '+mandates(seatsOf(PL))+' у фракции.');
  S.termGdp=S.econ.gdp; S.termLaws=0; S.promises=[];
  S.budget={submitted:false,fails:0}; S.lastBudget=snapshotBudget();
  if(chief())choosePromises(); else autoPromises();
}

/* ─── коалиция и вотум ───────────────────────────────────────── */
function partnersTick(){
  if(!isPM())return;
  coalition().filter(id=>id!==PL).forEach(id=>{
    const p=P(id), st=S.partners[id]||(S.partners[id]={patience:3,anger:0});
    const posts=Object.values(S.gov.posts).filter(x=>x===id).length;
    const d=axDist(p.st,me().st);
    let strain=(d-1.5)*1.1+(partyPrice(id)-posts)*0.85;
    if(approval()<38)strain+=0.6; else if(approval()>56)strain-=0.5;
    if(hasTrait('dealer'))strain-=0.45;                  // с ним договариваются дольше
    strain-=(rep('honest')-50)*0.008;                    // слову честного верят
    st.anger=clamp(st.anger+strain,0,6);
    if(st.anger>=4&&Math.random()<0.45){
      leaveCoalition(id,'Фракция «'+p.name+'» вышла из коалиции: разошлись по курсу.');
    }
  });
}
function leaveCoalition(id,why){
  S.gov.coal=S.gov.coal.filter(x=>x!==id);
  Object.keys(S.gov.posts).forEach(k=>{ if(S.gov.posts[k]===id)S.gov.posts[k]=PL; });
  delete S.partners[id];
  logMsg(why,1); chron(why,'b'); addCap(-6);
  if(S.pacts)delete S.pacts[id];
  const minority=coalSeats()<MAJ;
  sheetOpen({eye:'Правительственный кризис',title:'Коалиция распалась',
    body:'<p class="lead">'+why+'</p><div class="res"><span>У коалиции осталось</span><b class="'+(minority?'bad':'')+'">'+coalSeats()+' из '+MAJ+'</b></div>'+
      (minority?'<p class="hint">Правительство меньшинства держится, пока оппозиция не соберёт вотум. Можно искать нового партнёра, уйти в отставку — или, если право у вас, распустить Собрание.</p>':''),
    opts:minority?[
      {label:'Править меньшинством',hint:'вотум оппозиции станет вероятнее',fn(){}},
      {label:'Искать нового партнёра',hint:'1 действие · переговоры с шансом и договором',fn:()=>askInvite(false)},
      {label:'Подать в отставку',hint:'кабинет уходит, начинается формирование',fn(){ govFall('распад коалиции'); }},
      ...(canDissolve()?[{label:'Досрочные выборы',hint:'правила и прогноз',fn:askDissolve}]:[])]
     :[{label:'Работать дальше',hint:'',fn(){}}]});
}
function offerPost(pid,post){
  if(!pay({ap:1},'Портфель партнёру'))return;
  S.gov.posts[post]=pid;
  if(pid!==PL&&!inCoal(pid)){ S.gov.coal.push(pid); S.partners[pid]={patience:3,anger:1};
    logMsg('Фракция «'+P(pid).name+'» вошла в коалицию.',1);
    chron('«'+P(pid).name+'» вошла в правительство.','g'); }
  if(pid!==PL&&S.partners[pid])S.partners[pid].anger=Math.max(0,S.partners[pid].anger-2);
  S.deputies.filter(d=>d.party===pid).forEach(d=>d.rel=clamp(d.rel+6,0,100));
  syncCabinet();
  toast('Портфель передан');
  render();
}
/* «да» — доверие действующему кабинету, кем бы он ни был */
function stateOfThings(){
  return 50+(S.econ.growth-1)*4-(S.econ.inf-4)*1.6-(S.econ.unemp-8)*1.5-(avgUnrest()-14)*0.4;
}
/* кабинет пал: дальше — кризис и поручение президента (см. раздел парламента) */
function fallGovernment(why){ govFall(why||'кабинет пал'); }
function takePower(){
  S.govAge=0;
  career('Возглавили правительство после вотума недоверия.');
  bumpRep('firm',4);
  S.budget={submitted:false,fails:0}; S.lastBudget=snapshotBudget();
  S.gov={lead:PL,coal:[PL],posts:{}};
  POSTS.forEach(p=>S.gov.posts[p.id]=PL);
  S.partners={}; S.role='pm'; syncCabinet();
  if(S.you)setSeat('pm','Сформирован кабинет.');
}

/* ─── правительство ИИ, когда игрок в оппозиции ──────────────── */
function aiBudget(){
  const lead=P(S.gov.lead), bal=balance();
  if(bal<-6){                                  // дыру закрывают по-своему
    if(lead.st.tax<0){ const t=pick(TAXES.filter(x=>S.tax[x.id]<4)); if(t)S.tax[t.id]++; }
    else { const sp=pick(SPEND.filter(x=>S.spend[x.id]>Math.max(0,(x.id==='soc'||x.id==='med')?socFloor():0)));
      if(sp)S.spend[sp.id]--; }
  } else if(bal>4&&S.treasury>120){
    if(lead.st.tax>0){ const t=pick(TAXES.filter(x=>S.tax[x.id]>0)); if(t)S.tax[t.id]--; }
    else { const sp=pick(SPEND.filter(x=>S.spend[x.id]<4)); if(sp)S.spend[sp.id]++; }
  }
  if(S.treasury>200){                          // излишек не лежит мёртвым грузом
    S.treasury=r1(S.treasury-45); S.econ.invest+=5;
    const r=pick(REGIONS); S.rmod[r.id]=clamp(S.rmod[r.id]+2,-22,22);
    logMsg('Правительство пустило накопленный профицит на стройки в регионе '+R(r.id).name+'.');
  }
}

function govBill(){
  const lead=P(S.gov.lead);
  const t=pick(TOPICS.filter(x=>!x.special));
  const stance=clamp(Math.round(lead.st[t.ax]),-2,2);
  const bill={topic:t.id,stance,riders:[],by:lead.id};
  const res=resolveVote(bill);
  if(!res.pass){ logMsg('Правительственный проект «'+t.name+'» не прошёл Собрание ('+res.yes+':'+res.no+').'); return; }
  // сенатор, взявший слово, держит трибуну, пока не наберётся клотур
  if(mySeat()==='sen'&&S.desk&&S.desk.fili===S.q&&clotureCount(bill)<cloture()){
    S.desk.fili=null; S.desk.score=clamp(S.desk.score+5,0,100); bumpRep('firm',2);
    if(!chief())S.you.inf=clamp(S.you.inf+3,0,100);
    logMsg('Ваши прения остановили правительственный проект «'+t.name+'»: за клотур '+clotureCount(bill)+' из '+cloture()+'.',1);
    chron('Сенатор '+S.you.name+' сорвал проект «'+t.name.toLowerCase()+'».','g');
    return;
  }
  const up=resolveSenVote(bill);
  if(!up.pass){ logMsg('Сенат остановил правительственный проект «'+t.name+'» ('+up.yes+':'+up.no+').'); return; }
  if(isPres()){ askSign(bill,res,up); return; }
  if(Math.random()<vetoChance(bill)){
    S.pres.vetoes++;
    logMsg('Президент отклонил правительственный проект «'+t.name+'».',1); return;
  }
  enact(bill);
  logMsg('Правительство провело закон «'+t.name+'»: Собрание '+res.yes+':'+res.no+', Сенат '+up.yes+':'+up.no+'.',1);
}

/* ─── партии живут своей жизнью ──────────────────────────────── */
function popularStance(){
  const pop={};
  AX.forEach(a=>{ let s=0,w=0;
    GROUPS.forEach(g=>{ const ww=g.w[a]*(0.4+S.mood[g.id]/100); s+=g.pref[a]*ww; w+=ww; });
    pop[a]=s/w; });
  return pop;
}
function partiesTick(){
  const pop=popularStance();
  S.parties.forEach(p=>{
    if(p.id===PL)return;
    const base=(AIPARTIES.find(x=>x.id===p.id)||{st:p.st0||p.st});   // новая партия держится своей учредительной линии
    AX.forEach(a=>{                                  // партия чует, куда идёт страна
      const v=p.st[a]+(pop[a]-p.st[a])*0.035;
      p.st[a]=r2(clamp(clamp(v,base.st[a]-0.8,base.st[a]+0.8),-2,2));
    });
    p.bad=p.mom<-6?(p.bad||0)+1:0;                   // затяжной провал стоит лидеру кресла
    if(p.bad>=3){
      p.leader=(Math.random()<0.4?pick(NAME_F)+' '+pick(SURN_F):pick(NAME_M)+' '+pick(SURN_M));
      p.bad=0; p.mom=r1(p.mom+4);
      logMsg('Во фракции «'+p.name+'» сменился лидер: теперь это '+p.leader+'.');
      chron('«'+p.name+'» сменила лидера.','');
    }
  });
}
function defections(){
  if(regOn('imperative'))return;                 // императивный мандат: уйти можно только с мандатом партии
  S.deputies.slice().forEach(d=>{
    if(d.party===PL&&d.rel<28&&Math.random()<0.07){
      const to=S.parties.filter(x=>x.id!==PL).sort((a,b)=>axDist(a.st,d.st)-axDist(b.st,d.st))[0];
      d.party=to.id; S.seats[PL]--; S.seats[to.id]=(S.seats[to.id]||0)+1; d.note='ушёл из вашей фракции';
      logMsg('Депутат '+d.name+' вышел из фракции и перешёл к «'+to.name+'».',1);
      chron('Депутат '+d.name+' покинул вашу фракцию.','b');
    }
  });
}

/* ─── внешние потрясения ─────────────────────────────────────── */
const SHOCKS=[
  {id:'resdown', w:3, cond:()=>S.world.res>85, make(){ S.world.res=clamp(S.world.res-ri(22,34),45,168);
    return {eye:'Мировые рынки',title:'Обвал цен на сырьё',
      body:'<p>Экспортная выручка падает: цены на наше сырьё рухнули до '+Math.round(S.world.res)+' пунктов. Бюджет недосчитается доходов уже в этом квартале.</p>',
      opts:[{l:'Урезать расходы',h:'быстро и непопулярно',fn(){const sp=SPEND.filter(x=>S.spend[x.id]>Math.max(0,(x.id==='soc'||x.id==='med')?socFloor():0))
          .sort((a,b)=>S.mood[b.likes[0]||'work']-S.mood[a.likes[0]||'work'])[0];
          if(sp){S.spend[sp.id]--;logMsg('Статья «'+sp.name+'» урезана из-за падения цен.');}}},
        {l:'Занять на рынке',h:'долг вырастет',fn(){S.debt=r1(S.debt+40);S.treasury=r1(S.treasury+40);}},
        {l:'Ничего не менять',h:'дыра сама себя не закроет',fn(){shiftMood('biz',-3);}}]};}},
  {id:'resup', w:2, cond:()=>S.world.res<118, make(){ S.world.res=clamp(S.world.res+ri(20,32),45,168);
    return {eye:'Мировые рынки',title:'Сырьевой бум',
      body:'<p>Цены на наш экспорт взлетели до '+Math.round(S.world.res)+' пунктов. В казну пошли незапланированные деньги.</p>',
      opts:[{l:'Отложить в казну',h:'подушка на чёрный день',fn(){S.treasury=r1(S.treasury+25);}},
        {l:'Поднять соцвыплаты',h:'люди заметят сразу',fn(){S.spend.soc=clamp(S.spend.soc+1,0,4);shiftMood('work',4);shiftMood('pens',4);}},
        {l:'Погасить долг',h:'скучно и правильно',fn(){S.debt=r1(Math.max(0,S.debt-35));shiftMood('biz',3);}}]};}},
  {id:'slump', w:3, cond:()=>S.world.demand>80, make(){ S.world.demand=clamp(S.world.demand-ri(16,26),55,142);
    return {eye:'Внешний спрос',title:'Кризис у торговых партнёров',
      body:'<p>Соседи вошли в спад, заказы на наши товары сокращаются. Внешний спрос упал до '+Math.round(S.world.demand)+' пунктов.</p>',
      opts:[{l:'Поддержать заводы · 18 млрд',h:'рабочие места дороже дефицита',fn(){payGold(18);shiftMood('work',4);S.econ.invest+=6;}},
        {l:'Открыть новые рынки',h:'даст эффект не сразу',fn(){later(3,'newMarkets',{});shiftMood('biz',2);}},
        {l:'Переждать',h:'бесплатно',fn(){S.econ.unemp=r1(S.econ.unemp+0.6);shiftMood('work',-3);}}]};}},
  {id:'boom', w:2, cond:()=>S.world.demand<120, make(){ S.world.demand=clamp(S.world.demand+ri(14,24),55,142);
    return {eye:'Внешний спрос',title:'Заказы из-за рубежа',
      body:'<p>Партнёры наращивают закупки: внешний спрос вырос до '+Math.round(S.world.demand)+' пунктов. Заводы просят разрешить сверхурочные.</p>',
      opts:[{l:'Разрешить',h:'рост сейчас, усталость потом',fn(){S.econ.growth=r2(S.econ.growth+0.5);shiftMood('biz',3);shiftMood('work',-2);}},
        {l:'Держать нормы',h:'профсоюзы оценят',fn(){shiftMood('work',4);shiftMood('biz',-2);}}]};}},
];
function worldShock(){
  if(S.shockCool>0){S.shockCool--;return;}
  if(Math.random()>(hard()?0.26:0.16))return;
  const pool=SHOCKS.filter(x=>x.cond());
  if(!pool.length)return;
  const bag=[];pool.forEach(e=>{for(let i=0;i<e.w;i++)bag.push(e);});
  const m=pick(bag).make();
  S.shockCool=hasTrait('diplo')?4:3;
  if(hasTrait('diplo')){                                 // дипломат готовит страну заранее
    S.world.demand=clamp(S.world.demand+4,55,142);
    S.world.res=clamp(S.world.res+4,45,168);
  }
  logMsg(m.title+'.',1);
  sheetOpen({eye:m.eye,title:m.title,body:m.body,
    opts:m.opts.map(o=>({label:o.l,hint:o.h,fn:()=>{o.fn();render();}}))});
}

/* ─── события ────────────────────────────────────────────────── */
const EVENTS=[
  {id:'strike', w:3, cond:()=>S.mood.work<46||S.econ.unemp>10, make(){
    const r=pick(REGIONS.filter(x=>x.share.work>0.2));
    return {eye:'Забастовка · '+r.cap, title:'Заводы встали',
      body:'<p>Профсоюзы вывели людей на '+r.cap+'. Требуют индексации и гарантий занятости.</p>',
      opts:[
        {l:'Пойти на уступки · 12 млрд',h:'Рабочие успокоятся, бизнес поморщится',fn(){
          payGold(12);shiftMood('work',6);shiftMood('biz',-3);S.unrest[r.id]=clamp(S.unrest[r.id]-12,0,100);}},
        {l:'Разогнать · 6 веса',h:'Порядок ценой доверия',fn(){
          payCap(6);S.unrest[r.id]=clamp(S.unrest[r.id]-6,0,100);shiftMood('work',-6);shiftMood('intel',-4);
          shiftMood('patr',3);S.stab=clamp(S.stab+2,0,100);}},
        {l:'Ждать',h:'Может рассосётся, а может нет',fn(){
          S.unrest[r.id]=clamp(S.unrest[r.id]+10,0,100);shiftMood('work',-2);
          later(2,'strikeAfter',{r:r.id});}}]};}},

  {id:'price', w:3, cond:()=>S.econ.inf>6, make:()=>({eye:'Цены', title:'Инфляция разогналась',
    body:'<p>Цены на базовые товары выросли за квартал сильнее, чем за весь прошлый год. Пенсионеры и село в ярости.</p>',
    opts:[
      {l:'Заморозить цены',h:'Сейчас поможет, потом ударит',fn(){
        S.econ.inf=r1(S.econ.inf-2.2);shiftMood('pens',5);shiftMood('urban',3);shiftMood('biz',-5);
        later(3,'freezeAfter',{});}},
      {l:'Поднять соцвыплаты на ступень',h:'Дороже, но честнее',fn(){
        S.spend.soc=clamp(S.spend.soc+1,0,4);shiftMood('pens',4);shiftMood('work',3);}},
      {l:'Объяснить, что это временно',h:'Бесплатно и неубедительно',fn(){
        shiftAll(-1.6);addCap(-2);}}]})},

  {id:'graft', w:2, cond:()=>true, make(){
    const d=pick(S.deputies.filter(x=>x.party===PL||inCoal(x.party)))||pick(S.deputies);
    return {eye:'Следствие', title:'Дело о взятке',
      body:'<p>Следователи вышли на депутата '+d.name+' ('+P(d.party).short+'). Пресса ждёт вашей реакции.</p>',
      opts:[
        {l:'Сдать следствию',h:'Чисто, но фракция запомнит',fn(){
          S.deputies=S.deputies.filter(x=>x.id!==d.id);S.seats[d.party]--;
          shiftMood('intel',4);shiftMood('urban',3);
          S.deputies.filter(x=>x.party===d.party).forEach(x=>x.rel=clamp(x.rel-7,0,100));}},
        {l:'Прикрыть · 8 веса',h:'Свои поймут, газеты нет',fn(){
          payCap(8);S.deputies.filter(x=>x.party===d.party).forEach(x=>x.rel=clamp(x.rel+7,0,100));
          later(3,'graftLeak',{name:d.name});}},
        {l:'Не вмешиваться',h:'Пусть решает суд',fn(){shiftAll(-1);d.rel=clamp(d.rel-10,0,100);}}]};}},

  {id:'border', w:2, cond:()=>true, make:()=>({eye:'Граница', title:'Инцидент на восточной границе',
    body:'<p>Соседи задержали наши суда. Патриоты требуют ответа, торговцы — тишины.</p>',
    opts:[
      {l:'Жёсткий ответ',h:'Патриоты ликуют, рынки нет',fn(){
        shiftMood('patr',6);shiftMood('biz',-4);shiftMood('intel',-2);S.econ.invest-=8;S.stab=clamp(S.stab+1,0,100);}},
      {l:'Переговоры',h:'Тихо и невыразительно',fn(){shiftMood('patr',-4);shiftMood('biz',3);shiftMood('intel',3);}},
      {l:'Замять · 10 млрд',h:'Никто не узнает. Наверное',fn(){
        payGold(10);later(3,'borderLeak',{});}}]})},

  {id:'harvest', w:2, cond:()=>true, make:()=>({eye:'Урожай', title:'Засуха на юге',
    body:'<p>Южные хозяйства потеряли треть урожая. Село ждёт помощи, город — цен.</p>',
    opts:[
      {l:'Закупки и дотации · 14 млрд',h:'Село вас запомнит',fn(){
        payGold(14);shiftMood('agro',7);S.econ.inf=r1(S.econ.inf+0.4);}},
      {l:'Открыть импорт',h:'Цены удержим, село обидим',fn(){
        shiftMood('agro',-6);shiftMood('urban',3);shiftMood('pens',2);S.econ.inf=r1(S.econ.inf-0.8);}},
      {l:'Ничего',h:'Рынок разберётся',fn(){shiftMood('agro',-8);S.econ.inf=r1(S.econ.inf+1.1);}}]})},

  {id:'youth', w:2, cond:()=>S.mood.youth<48, make:()=>({eye:'Улица', title:'Молодёжь вышла на площадь',
    body:'<p>Студенты собрались в центре столицы. Формально — против цен, по сути — против вас.</p>',
    opts:[
      {l:'Выйти к ним',h:'Рискованно и по-человечески',fn(){
        if(Math.random()<clamp(S.mood.youth/70,0.2,0.85)){shiftMood('youth',8);shiftMood('intel',4);addCap(4);}
        else{shiftMood('youth',-4);addCap(-4);}}},
      {l:'Полиция и оцепление',h:'Площадь очистят к утру',fn(){
        shiftMood('youth',-7);shiftMood('intel',-5);shiftMood('patr',4);shiftMood('pens',2);
        REGIONS.forEach(r=>S.unrest[r.id]=clamp(S.unrest[r.id]+3,0,100));}},
      {l:'Обещать реформу образования',h:'Слова стоят дёшево',fn(){
        shiftMood('youth',4);later(4,'promiseEdu',{});}}]})},

  {id:'bank', w:2, cond:()=>S.econ.invest<85||S.debt>260, make:()=>({eye:'Финансы', title:'Банк просит поддержки',
    body:'<p>Второй по величине банк страны на грани. Его падение утянет платежи по всей республике.</p>',
    opts:[
      {l:'Спасти · 25 млрд',h:'Дорого, зато без паники',fn(){
        payGold(25);shiftMood('biz',5);shiftMood('work',-3);shiftMood('intel',-3);S.stab=clamp(S.stab+3,0,100);}},
      {l:'Дать упасть',h:'Справедливо и больно',fn(){
        S.econ.invest-=14;S.econ.growth=r2(S.econ.growth-0.5);shiftMood('biz',-8);shiftMood('work',3);
        S.stab=clamp(S.stab-5,0,100);}}]})},

  {id:'defect', w:2, cond:()=>S.deputies.some(d=>d.party===PL&&d.rel<32), make(){
    const d=pick(S.deputies.filter(x=>x.party===PL&&x.rel<32));
    return {eye:'Фракция', title:'Депутат собрался уходить',
      body:'<p>'+d.name+' даёт понять, что готов перейти к другим. За ним могут потянуться ещё двое.</p>',
      opts:[
        {l:'Уговорить · 10 веса',h:'Останется, но припомнит',fn(){payCap(10);d.rel=clamp(d.rel+22,0,100);}},
        {l:'Дать уйти',h:'Минус мандат, зато без торга',fn(){
          const to=pick(S.parties.filter(p=>p.id!==PL));
          d.party=to.id;S.seats[PL]--;S.seats[to.id]=(S.seats[to.id]||0)+1;
          logMsg('Депутат '+d.name+' перешёл в «'+to.name+'».');}}]};}},

  {id:'court', w:2, cond:()=>S.laws.some(l=>Math.abs(l.stance)>1), make(){
    const l=pick(S.laws.filter(x=>Math.abs(x.stance)>1));
    return {eye:'Конституционный суд', title:'Иск против закона «'+l.name+'»',
      body:'<p>Группа депутатов оспорила закон в суде: слишком резкая редакция, говорят они. Суд запросил позицию правительства.</p>',
      opts:[
        {l:'Отстаивать закон · 9 веса',h:'если проиграете, отменят целиком',fn(){
          if(!payCap(9))return;
          if(Math.random()<0.62){ addCap(6); shiftMood('patr',2);
            logMsg('Суд оставил закон «'+l.name+'» в силе.',1); }
          else { S.laws=S.laws.filter(x=>x.no!==l.no); shiftAll(-2.5);
            logMsg('Суд отменил закон «'+l.name+'».',1); chron('Суд отменил закон «'+l.name.toLowerCase()+'».','b'); }}},
        {l:'Смягчить самим',h:'сила закона падает вдвое',fn(){
          Object.keys(l.sum).forEach(k=>{ if(typeof l.sum[k]==='number')l.sum[k]=r2(l.sum[k]/2); });
          Object.keys(l.sum.gr||{}).forEach(k=>l.sum.gr[k]=r2(l.sum.gr[k]/2));
          l.stance=l.stance>0?1:-1; shiftMood('intel',2);
          logMsg('Закон «'+l.name+'» переписан в мягкой редакции.');}},
        {l:'Не вмешиваться',h:'пусть решают судьи',fn(){
          if(Math.random()<0.5){ S.laws=S.laws.filter(x=>x.no!==l.no); shiftAll(-1.5);
            logMsg('Суд отменил закон «'+l.name+'» без сопротивления правительства.',1); }
          else logMsg('Суд не нашёл нарушений в законе «'+l.name+'».');}}]};}},

  {id:'chair', w:2, cond:()=>Object.keys(S.comm||{}).length>0, make(){
    const ax=pick(Object.keys(S.comm));
    const d=S.deputies.find(x=>x.id===S.comm[ax]);
    if(!d)return {eye:'Комитеты',title:'Место председателя свободно',
      body:'<p>Профильный комитет остался без руководителя.</p>',opts:[{l:'Принять к сведению',h:'',fn(){}}]};
    return {eye:'Комитет по теме «'+AXNAME[ax]+'»', title:'Председатель торгуется',
      body:'<p>'+d.name+' ('+P(d.party).short+') намекает, что комитет работает тяжело, а благодарности не видно.</p>',
      opts:[
        {l:'Дать денег округу · 8 млрд',h:'дёшево и надёжно',fn(){ if(!payGold(8))return;
          d.rel=clamp(d.rel+14,0,100); S.rmod[d.region]=clamp(S.rmod[d.region]+1.5,-22,22);}},
        {l:'Пообещать на будущее',h:'бесплатно, но помнить будет',fn(){ later(4,'promiseChair',{id:d.id,name:d.name});}},
        {l:'Снять с комитета',h:'обидится он и его фракция',fn(){ delete S.comm[ax];
          d.rel=clamp(d.rel-18,0,100);
          S.deputies.filter(x=>x.party===d.party).forEach(x=>x.rel=clamp(x.rel-3,0,100));}}]};}},

  {id:'region', w:3, cond:()=>REGIONS.some(r=>S.unrest[r.id]>36), make(){
    const r=pick(REGIONS.filter(x=>S.unrest[x.id]>36));
    return {eye:'Регион · '+r.cap, title:'Субъект выходит из берегов',
      body:'<p>В '+r.cap+' напряжённость дошла до '+Math.round(S.unrest[r.id])+'. Местные требуют денег и внимания, часть депутатов от региона поддерживает их публично.</p>',
      opts:[
        {l:'Экстренный транш · 16 млрд',h:'сбивает волну, но не причину',fn(){ if(!payGold(16))return;
          S.unrest[r.id]=clamp(S.unrest[r.id]-18,0,100); S.rmod[r.id]=clamp(S.rmod[r.id]+3,-22,22);
          later(3,'moneyGone',{r:r.id});}},
        {l:'Отправить полицию',h:'порядок ценой доверия',fn(){
          S.unrest[r.id]=clamp(S.unrest[r.id]-11,0,100); S.rmod[r.id]=clamp(S.rmod[r.id]-4,-22,22);
          shiftMood('patr',3); shiftMood('intel',-4); shiftMood('youth',-3);}},
        {l:'Пообещать автономию',h:'центру это не понравится',fn(){
          S.unrest[r.id]=clamp(S.unrest[r.id]-14,0,100);
          S.deputies.filter(d=>d.region===r.id).forEach(d=>d.rel=clamp(d.rel+9,0,100));
          shiftMood('patr',-5); later(4,'autonomy',{r:r.id});}}]};}},

  {id:'leak', w:2, cond:()=>S.deputies.some(d=>d.deals>1), make(){
    const d=pick(S.deputies.filter(x=>x.deals>1));
    return {eye:'Пресса', title:'Газеты пишут о торговле голосами',
      body:'<p>Журналисты сопоставили ваши встречи с депутатом '+d.name+' и его голосования. Вывод очевиден любому читателю.</p>',
      opts:[
        {l:'Всё отрицать',h:'сработает, если поверят',fn(){
          if(Math.random()<0.5){shiftAll(-1);} else {shiftAll(-3.5);addCap(-6);
            chron('Скандал вокруг торговли голосами.','b');}}},
        {l:'Признать и объяснить',h:'честно и невыгодно',fn(){shiftAll(-2);shiftMood('intel',3);addCap(-2);}},
        {l:'Свалить на депутата',h:'он этого не простит',fn(){shiftAll(-1);d.rel=clamp(d.rel-30,0,100);
          S.deputies.filter(x=>x.party===d.party).forEach(x=>x.rel=clamp(x.rel-5,0,100));}}]};}},

  {id:'union', w:2, cond:()=>S.mood.work<44&&S.econ.unemp>8, make:()=>({eye:'Профсоюзы',title:'Требование всеобщей стачки',
    body:'<p>Федерация профсоюзов грозит остановить транспорт и заводы по всей стране, если не будет индексации.</p>',
    opts:[
      {l:'Сесть за стол',h:'уступки в обмен на тишину',fn(){ S.spend.soc=clamp(S.spend.soc+1,0,4);
        shiftMood('work',7); shiftMood('biz',-4); }},
      {l:'Объявить стачку незаконной',h:'жёстко и рискованно',fn(){
        shiftMood('work',-8); shiftMood('patr',3); shiftMood('intel',-4);
        REGIONS.forEach(r=>S.unrest[r.id]=clamp(S.unrest[r.id]+7,0,100)); later(2,'strikeAfter',{r:pick(REGIONS).id});}},
      {l:'Тянуть время',h:'ничего не решает',fn(){ shiftMood('work',-3); later(2,'unionBack',{});}}]})},

  {id:'gift', w:2, cond:()=>S.mood.biz>52, make:()=>({eye:'Партийная касса',title:'Крупное пожертвование',
    body:'<p>Промышленная группа предлагает 45 млн в кассу партии. Без условий, разумеется, — просто симпатия к вашему курсу.</p>',
    opts:[
      {l:'Взять',h:'деньги нужны, вопросы потом',fn(){ S.funds=r1(S.funds+45); later(4,'giftLeak',{}); }},
      {l:'Взять и объявить публично',h:'меньше денег, чище руки',fn(){ S.funds=r1(S.funds+45);
        shiftMood('intel',2); shiftMood('work',-2); }},
      {l:'Отказаться',h:'дорого стоит',fn(){ shiftMood('intel',4); shiftMood('biz',-4); addCap(3); }}]})},

  {id:'poll', w:1, cond:()=>true, make:()=>({eye:'Социология',title:'Утечка чужого опроса',
    body:'<p>В прессу попал опрос, заказанный не вами. Цифры расходятся с тем, что докладывает ваш штаб.</p>',
    opts:[
      {l:'Заказать свой немедленно',h:'9 млн из кассы',fn(){ if(payFunds(9))S.poll=S.q; }},
      {l:'Игнорировать',h:'',fn(){ shiftAll(-0.8); }}]})},
];
function fireEvent(){
  if(S.ev.cool>0){S.ev.cool--;return;}
  // Написанные сюжеты кончаются, собранные — нет. Чем дольше идёт игра,
  // тем чаще событие берут с доски, а не из готового списка.
  const genShare=clamp(0.35+(S.q/220),0.35,0.75);
  let m=null;
  if(Math.random()<genShare)m=genEvent();
  if(!m){
    const pool=EVENTS.filter(e=>e.cond());
    if(!pool.length){ m=genEvent(); if(!m)return; }
    else { const bag=[];pool.forEach(e=>{for(let i=0;i<e.w;i++)bag.push(e);});
      m=pick(bag).make(); }
  }
  S.ev.cool=1;
  sheetOpen({eye:m.eye,title:m.title,body:m.body,
    opts:m.opts.map(o=>({label:o.l,hint:o.h,fn:()=>{o.fn();render();}}))});
}
function later(n,key,data){ S.pending.push({at:S.q+n,key,data}); }
const AFTER={
  gaveIn(d){ shiftAll(-1.4); addCap(-4); bumpRep('firm',-3);
    return d.who+' рассказал, как легко с вами договориться. Теперь просят все.'; },
  ignored(d){
    if(d.hook==='trail'){ addTrail(9,'замолчанное дело'); return 'Дело '+d.who+' не замяли — оно просто разрослось.'; }
    if(d.hook==='capture'){ bumpCapture(6); return 'Пока вы молчали, разговоры о купленной власти стали общим местом.'; }
    shiftAll(-1.2);
    return 'История с '+d.who+' закончилась сама и не в вашу пользу.'; },
  recall(){ loseMandate('по выводам следственной комиссии'); return null; },
  newMarkets(){ S.world.demand=clamp(S.world.demand+14,55,142); shiftMood('biz',3);
    return 'Новые рынки сбыта открылись: внешний спрос отчасти восстановлен.'; },
  promiseChair(d){ const x=S.deputies.find(y=>y.id===d.id);
    if(x){ x.rel=clamp(x.rel-16,0,100); x.note='не дождался обещанного'; }
    return 'Председатель комитета '+d.name+' так и не дождался обещанного.'; },
  moneyGone(d){ if(Math.random()<0.45){ S.unrest[d.r]=clamp(S.unrest[d.r]+12,0,100); shiftAll(-1.5);
      return 'Транш региону '+R(d.r).name+' разошёлся неизвестно куда.'; }
    S.rmod[d.r]=clamp(S.rmod[d.r]+2,-22,22);
    return 'Деньги, отправленные в '+R(d.r).name+', дошли до строек.'; },
  autonomy(d){ S.deputies.filter(x=>x.region===d.r).forEach(x=>x.rel=clamp(x.rel-12,0,100));
    shiftMood('patr',-2);
    return 'Обещанной автономии регион '+R(d.r).name+' не увидел.'; },
  unionBack(){ shiftMood('work',-5); REGIONS.forEach(r=>S.unrest[r.id]=clamp(S.unrest[r.id]+5,0,100));
    return 'Профсоюзы вернулись к требованиям, теперь жёстче.'; },
  giftLeak(){ if(Math.random()<0.55){ shiftAll(-3); addCap(-7);
      return 'Пресса раскопала происхождение пожертвования в кассу партии.'; }
    return ''; },
  probe(d){ if(Math.random()<0.5){ shiftMood('intel',4); shiftMood('urban',3); addCap(5);
      return 'Комиссия по делу «'+d.t+'» довела расследование до конца.'; }
    shiftAll(-2); return 'Комиссия по делу «'+d.t+'» тихо самораспустилась.'; },
  strikeAfter(d){ S.unrest[d.r]=clamp(S.unrest[d.r]+14,0,100); shiftMood('work',-4);
    return 'Забастовка в '+R(d.r).cap+' переросла в затяжной конфликт.'; },
  freezeAfter(){ S.econ.inf=r1(S.econ.inf+3.2); shiftMood('biz',-3); shiftMood('urban',-3);
    return 'Заморозка цен кончилась дефицитом и скачком инфляции.'; },
  graftLeak(d){ shiftAll(-2.4); addCap(-8);
    return 'Всплыло, что дело депутата '+d.name+' закрыли по звонку.'; },
  borderLeak(){ shiftMood('patr',-6); shiftMood('intel',-3);
    return 'Газеты раскопали замятый пограничный инцидент.'; },
  promiseEdu(){ if(S.spend.edu>=3){shiftMood('youth',5);return 'Обещание по школам выполнено: молодёжь заметила.';}
    shiftMood('youth',-7); return 'Обещанной реформы образования не случилось.'; },
};
function pendingTick(){
  const due=S.pending.filter(p=>p.at<=S.q);
  S.pending=S.pending.filter(p=>p.at>S.q);
  due.forEach(p=>{ const f=AFTER[p.key]; if(!f)return;
    const txt=f(p.data||{}); if(txt)logMsg(txt,1); });
}

/* ─── конец квартала ─────────────────────────────────────────── */
function endQuarter(){
  if(S.over)return;
  const bal=balance();
  econTick();
  // напряжённость: своя динамика, работа главы края и то, что тлеет у соседей
  const spill={};
  REGIONS.forEach(r=>{
    const hot=NB(r.id).reduce((a,n)=>a+Math.max(0,S.unrest[n]-38),0)/Math.max(1,NB(r.id).length);
    spill[r.id]=hot*0.09;
  });
  REGIONS.forEach(r=>{
    let du=(17-S.unrest[r.id])*0.2                     // всегда есть о чём ворчать
          +(S.econ.unemp-8)*0.5+(S.econ.inf-4)*0.38-(S.spend.pol-2)*1.3-(regApproval(r.id)-50)*0.09
          -(S.spend.soc-2)*0.6+(r.dev<2?1.2:0)+rnd(-2,2);
    if(S.gov.posts.mvd===PL)du-=0.6;
    const g=govOf(r.id);
    if(g)du-=((g.comp-50)*0.03+(g.rel-50)*0.012);      // толковый глава гасит своё
    if(hasTrait('iron'))du-=0.8;
    if(S.you&&S.you.origin==='army')du-=0.5;
    du+=spill[r.id];                                    // пожар перекидывается через границу
    du+=nbPressure(r.id);                               // и просачивается из-за рубежа
    S.unrest[r.id]=clamp(S.unrest[r.id]+du,0,100);
  });
  S.fatigue=clamp((S.fatigue||0)+(isPM()?0.32:-0.5),0,10);   // усталость избирателя от вашей власти
  if(hard()){                                                // жёсткая страна: власть изнашивается быстрее, край горячее
    REGIONS.forEach(r=>S.unrest[r.id]=clamp(S.unrest[r.id]+0.9,0,100));
  }
  S.govAge=(S.govAge||0)+1;                                  // возраст действующего кабинета
  if(S.you){                                                 // политик стареет вместе со страной
    S.you.age=r1(S.you.age+0.25);
    // молва подтягивается к делам: компетентность к экономике, твёрдость к порядку
    const doing=stateOfThings();
    bumpRep('comp',clamp((doing-50)*0.02,-0.5,0.5));
    bumpRep('firm',clamp((26-avgUnrest())*0.012,-0.4,0.4));
  }
  moodTick();
  S.cap=clamp(S.cap+capIncome(),0,100);
  S.funds=r1(S.funds+fundIncome());
  const going=stateOfThings();
  S.parties.forEach(p=>{ if(p.id===PL)return;
    // когда в стране плохо, оппозиция набирает вес просто потому, что она не власть
    const opp=!inCoal(p.id);
    p.mom=r1(clamp(p.mom*0.84+(opp?(48-going)*0.10:(going-48)*0.05),-14,14)); });
  partnersTick();
  pactTick();
  aiCoalTick();
  qtimeTick();
  motionTick();
  partiesTick();
  defections();
  pendingTick();
  if(!isPM()){govBill();aiBudget();}
  else if(Math.random()<0.35)oppositionBill();
  budgetTick(); bPromTick();
  decreeTick();
  governorTick();
  presVacancy();
  vpVacancy();
  vpTick();
  senHoldTick();
  commHoldTick();
  inqTick();
  impAgainstYou();
  firmTick();
  constTick();
  recallTick();
  roleTick();
  dealTick();
  commTick();
  senAgendaTick();
  powerTick();
  campEventTick();
  mediaTick();
  rivalsTick(); regionsTick();
  offerTick();
  pressTick();
  judgeTick();
  probeTick(); rcaseTick();
  challengeTick();
  nbTick(); fpTick();
  if(S.ref&&S.q>=S.ref.until)S.ref=null;
  worldShock();
  fireEvent();

  logMsg('Квартал закрыт. Бюджет '+sign(bal)+' млрд, в казне '+Math.round(S.treasury)+' млрд.');
  S.q++; S.ap=3; S.sel=null;
  snapshot();
  if(senDue())senateElection();
  presTick();
  if(S.vetoed&&S.q-S.vetoed.q>4)S.vetoed=null;    // вернувшийся закон нельзя мариновать вечно

  // палата: вотум оппозиции, поручение, которое не успели исполнить, роспуск по расчёту
  if(S.noConfCool>0)S.noConfCool--;
  if(S.crisis&&S.crisis.form===PL&&S.q>S.crisis.due)formFail('поручение истекло: коалиция не собрана');
  else aiMotionTick();
  impTick();
  if(!S.crisis&&!S.motion)aiDissolveTick();

  checkEnd();
  const t=S.q-S.termStart+1;
  if(t===aTerm()-CAMP+1&&!S.camp)campaignStart();
  if(t>aTerm())election();
  save();
  render();
}
function oppositionBill(){
  const opp=S.parties.filter(p=>p.id!==PL&&!inCoal(p.id)).sort((a,b)=>seatsOf(b.id)-seatsOf(a.id))[0];
  if(!opp)return;
  const t=pick(TOPICS.filter(x=>!x.special));
  const bill={topic:t.id,stance:clamp(Math.round(opp.st[t.ax]),-2,2),riders:[],by:opp.id};
  const res=resolveVote(bill);
  if(!res.pass)return;
  // обструкция работает в обе стороны: ваше меньшинство тоже умеет тянуть прения
  if(willFilibuster(bill)){
    logMsg('Обструкция в Сенате остановила проект оппозиции «'+t.name+'»: за клотур '+
      clotureCount(bill)+' при нужных '+cloture()+'.');
    return;
  }
  const up=resolveSenVote(bill);
  if(!up.pass){ logMsg('Сенат остановил проект оппозиции «'+t.name+'» ('+up.yes+':'+up.no+').'); return; }
  if(isPres()){ askSign(bill,res,up); return; }
  if(Math.random()<vetoChance(bill)){
    S.pres.vetoes++;
    logMsg('Президент отклонил проект оппозиции «'+t.name+'».'); return;
  }
  enact(bill); addCap(-5);
  logMsg('Оппозиция провела свой закон «'+t.name+'» через голову правительства ('+res.yes+':'+res.no+').',1);
  chron('Оппозиция провела «'+t.name.toLowerCase()+'».','b');
}
function checkEnd(){
  if(S.over)return;
  if(S.debt>430){ finish(false,'Долг перевалил за 430 млрд, кредиторы закрыли рынки. Объявлен дефолт.'); return; }
  const ap=approval();
  if(ap<19){ finish(false,'Одобрение упало до '+Math.round(ap)+'%. Улица и Собрание вынудили вас уйти.'); return; }
  if(avgUnrest()>72){ finish(false,'Страна в волнениях: средняя напряжённость превысила критическую черту.'); return; }
}

/* ─── кампания ───────────────────────────────────────────────── */
function campaignStart(){
  S.camp={ads:{},rally:{},debate:null,spent:0,polls:[],swing:0};
  campPoll();
  sheetOpen({eye:'Кампания открыта',title:'До выборов четыре квартала',
    body:'<p>Штаб развёрнут. В разделе «Кампания» можно закупать рекламу под конкретную группу избирателей, ездить с митингами по субъектам и готовиться к дебатам.</p>'+
      '<p class="hint">Всё это тратит партийную кассу, а не казну. Казённые деньги на кампанию тратить нельзя — заметят.</p>',
    acts:[{label:'В штаб',fn:()=>{S.tab='camp';}}]});
}
function campBoost(gid,rid){
  if(!S.camp)return 0;
  return (S.camp.ads[gid]||0)*1.05 + (S.camp.rally[rid]||0)*1.5 + (S.camp.debate||0) + (S.camp.swing||0);
}
const CAMPACT={
  ads(gid){ if(!payFunds(16))return; S.camp.ads[gid]=(S.camp.ads[gid]||0)+1; S.camp.spent+=16;
    toast('Ролики пошли в эфир'); render(); },
  rally(rid){ if(!pay({ap:1,funds:11},'Кампания'))return; S.camp.rally[rid]=(S.camp.rally[rid]||0)+1;
    S.rmod[rid]=clamp(S.rmod[rid]+2,-22,22); toast('Митинг собран'); render(); },
  debate(tone){
    if(S.camp.debate!==null){toast('Дебаты уже прошли');return;}
    const rivals=S.parties.filter(p=>p.id!==PL).sort((a,b)=>seatsOf(b.id)-seatsOf(a.id));
    const riv=rivals[0];
    let ch=0.5+(approval()-48)*0.012;
    if(tone==='hard')ch+=0.06-axDist(riv.st,me().st)*0.02;
    if(tone==='calm')ch+=0.03;
    if(tone==='numbers')ch+=(S.econ.growth-1)*0.06-(S.econ.inf-4)*0.03;
    const win=Math.random()<clamp(ch,0.15,0.85);
    S.camp.debate=win?2.6:-1.6;
    if(win){shiftAll(2);addCap(6);}else{shiftAll(-1.6);}
    sheetOpen({eye:'Теледебаты',title:win?'Вы выиграли эфир':'Эфир достался сопернику',
      body:'<p>Против вас — '+riv.leader+' («'+riv.name+'»). '+
        (win?'После эфира ваши цифры подросли по всей стране.':'Соперник выглядел убедительнее, и это заметили.')+'</p>',
      acts:[{label:'Дальше'}]});
    render();
  },
};

/* ─── выборы ─────────────────────────────────────────────────── */
/* власть изнашивается: чем дольше кабинет у руля, тем охотнее голосуют против */
function incumbencySwing(pid){
  const age=S.govAge||0;
  return inCoal(pid)? -Math.min(9,age*0.28) : Math.min(6,age*0.18);
}
/* ядро партии — две группы, которым её курс ближе всего */
function coreGroups(st){
  return GROUPS.slice().sort((a,b)=>fitOf(b,st)-fitOf(a,st)).slice(0,2).map(g=>g.id);
}
function partyScore(p,r){
  let v=0;
  const mine=p.id===PL?coreGroups(me().st):null;
  GROUPS.forEach(g=>{
    let a;
    // у вас идеология работает вместе с делами: провал в глазах группы стоит мандатов
    if(p.id===PL) a=fitOf(G(g.id),me().st)*0.55+30+(approvalIn(g.id,r.id)-50)*1.15+campBoost(g.id,r.id)
                      +(isPM()?(stateOfThings()-48)*0.22:incumbencySwing(PL))+(mine.indexOf(g.id)>=0?7:0)
                      +(rep('honest')-50)*0.07+(rep('comp')-50)*0.06+(rep('folk')-50)*0.05
                      -agePenalty()*0.8;
    else{
      a=fitOf(G(g.id),p.st)*0.92+p.mom*1.2+incumbencySwing(p.id);
      if(inCoal(p.id))a+=(stateOfThings()-48)*0.14;
      const gv=govOf(r.id);
      if(gv&&gv.party===p.id)a+=3.5+(gv.comp-50)*0.05;   // свой глава приводит округ
      if(p.base&&p.base.indexOf(g.id)>=0)a+=7;
    }
    v+=r.share[g.id]*a;
  });
  return v;
}
function election(){
  const promVerdict=checkPromises();          // спрос за обещания до подсчёта голосов
  const votes={},seatsNew={};
  S.parties.forEach(p=>{votes[p.id]=0;seatsNew[p.id]=0;});
  const regRes={};
  REGIONS.forEach(r=>{
    const sc={},tot=[];
    S.parties.forEach(p=>{ sc[p.id]=partyScore(p,r); });
    const share=shareFrom(sc);
    S.parties.forEach(p=>votes[p.id]+=share[p.id]*r.pop);
    const st=dhondt(share,S.regSeats[r.id]);
    Object.entries(st).forEach(([k,v])=>seatsNew[k]+=v);
    regRes[r.id]={share,st};
  });
  const popTot=REGIONS.reduce((a,r)=>a+r.pop,0);
  const nat={};S.parties.forEach(p=>nat[p.id]=r1(votes[p.id]/popTot));

  // новый созыв: депутаты переизбираются, часть кресел меняет хозяев
  const old=S.deputies;
  S.deputies=[];
  REGIONS.forEach(r=>{
    Object.entries(regRes[r.id].st).forEach(([pid,n])=>{
      const inc=old.filter(d=>d.party===pid&&d.region===r.id);
      for(let i=0;i<n;i++){
        if(inc[i]){ const d=inc[i]; d.rel=clamp(d.rel*0.9+8,0,100); d.deals=0; d.note=''; S.deputies.push(d); }
        else S.deputies.push(makeDep(pid,r.id,'n'+i+S.q));
      }
    });
  });
  S.seats=seatsNew;
  seatCommittees();                              // новый созыв делит комитеты заново
  S.camp=null; S.term++; S.termStart=S.q; S.govAge=0;
  S.parties.forEach(p=>p.mom=0);

  if(S.term>3){ showResults(nat,seatsNew,regRes);
    finish(seatsNew[PL]>=seatsOf(PL),'Три созыва подряд — предел, отпущенный конституцией Новарии. Вы передаёте дела преемнику.');
    return; }
  const mine=seatsNew[PL], win=mine>=MAJ;
  logMsg('Выборы: «'+me().name+'» — '+nat[PL]+'% и '+mine+' мандатов.',1);
  chron('Выборы: «'+me().name+'» получила '+mine+' мандатов.',mine>=MAJ?'g':'');
  const self=selfElection(seatsNew);
  electionNight(nat,seatsNew,regRes,promVerdict,self);
}
function showResults(nat,seats,regRes,prom,self){
  const order=S.parties.slice().sort((a,b)=>seats[b.id]-seats[a.id]);
  const rows=order.map(p=>`<tr><td><span class="chip">${emblem(p,18)}${p.name}${p.id===PL?' <span class="tag y">вы</span>':''}</span></td>
    <td class="num">${nat[p.id]}%</td><td class="num">${seats[p.id]}</td></tr>`).join('');
  const bar=`<div class="bar" style="height:16px;margin:6px 0 10px">${order.map(p=>
    `<i style="width:${seats[p.id]/SEATS*100}%;background:${p.color}"></i>`).join('')}<span class="mid"></span></div>`;
  const mine=seats[PL];
  sheetOpen({eye:'Всеобщие выборы · '+dateLabel(),title:'Итоги голосования',
    body:bar+'<table class="tight"><thead><tr><th>Партия</th><th class="r">Голоса</th><th class="r">Мандаты</th></tr></thead><tbody>'+rows+'</tbody></table>'+
      (prom?'<h3 class="sub">Спрос за обещания</h3>'+prom:'')+
      (self||'')+`<p class="hint" style="margin-top:9px">Для большинства нужно ${MAJ} мандатов. У вашей партии ${mine}.</p>`,
    acts:[{label:'К формированию правительства',fn:()=>openFormation(seats)}]});
}

/* ─── формирование правительства после выборов ───────────────── */
/* После выборов кабинет собирает не победитель, а тот, кому поручит
   президент. Если президент — вы, поручение даёте вы сами. */
function openFormation(seats){
  if(isPres()&&seatsOf(PL)<MAJ){
    const order=S.parties.slice().sort((a,b)=>seatsOf(b.id)-seatsOf(a.id));
    sheetOpen({eye:'Право президента',title:'Кому поручить правительство',
      body:`<p class="lead">Собрание избрано, большинства нет ни у кого. Поручение даёт президент —
          то есть вы. Своей партии, если готовы отвечать за кабинет; чужой, если выгоднее смотреть со стороны.</p>`,
      opts:order.map(p=>({label:p.name+(p.id===PL?' (ваша партия)':''),
        hint:mandates(seatsOf(p.id))+(p.id===PL?'':' · расхождение '+axDist(p.st,me().st).toFixed(1)),
        fn:()=>seatFormation(p.id)}))});
    return;
  }
  seatFormation(seatsOf(PL)>=MAJ?PL:nominatePM());
}
function seatFormation(leadId){
  const order=S.parties.slice().sort((a,b)=>seatsOf(b.id)-seatsOf(a.id));
  if(leadId===PL&&!chief()){ npcGov(); return; }
  if(leadId===PL){
    S.gov={lead:PL,coal:[PL],posts:{}};POSTS.forEach(p=>S.gov.posts[p.id]=PL);
    S.partners={};S.role='pm';
    if(mySeat()!=='pres')setSeat('pm','Сформирован кабинет.');
    syncCabinet();
    startTerm();
    if(seatsOf(PL)>=MAJ){
      sheetOpen({eye:'Мандат на правление',title:'У вас абсолютное большинство',
        body:'<p>'+seatsOf(PL)+' мандатов из '+SEATS+'. Правительство формируется без союзников: все портфели ваши, ни один партнёр не диктует условий.</p>',
        acts:[{label:'Приступить'}]});
    } else openCoalitionTalks();
  } else {
    const lead=P(leadId);
    if(mySeat()==='pm')setSeat(chief()&&S.you.mand?'lead':fallbackSeat(),'Кабинет сменился.');
    // назначенец президента строит коалицию и может позвать игрока
    S.gov={lead:lead.id,coal:[lead.id],posts:{}};
    S.pm=null;                                   // премьером станет он, а не вы
    POSTS.forEach(p=>S.gov.posts[p.id]=lead.id);
    const others=S.parties.filter(p=>p.id!==lead.id).sort((a,b)=>axDist(a.st,lead.st)-axDist(b.st,lead.st));
    let invite=null;
    others.forEach(p=>{
      if(coalSeats()>=MAJ)return;
      if(axDist(p.st,lead.st)<1.95){
        if(p.id===PL){invite=lead;}
        else{S.gov.coal.push(p.id);
          POSTS.slice(0,partyPrice(p.id)).forEach((x,i)=>S.gov.posts[POSTS[POSTS.length-1-i].id]=p.id);}
      }
    });
    if(invite&&coalSeats()+seatsOf(PL)>=MAJ&&!chief()){
      S.gov.coal.push(PL);S.gov.posts.soc=PL;S.gov.posts.mid=PL;S.role='junior';
      logMsg(me().leader+' повёл «'+me().name+'» в правительство '+lead.leader+' младшим партнёром.',1);
    } else if(invite&&coalSeats()+seatsOf(PL)>=MAJ){
      sheetOpen({eye:'Предложение',title:'Вас зовут в правительство',
        body:'<p>«'+lead.name+'» набрала '+seatsOf(lead.id)+' мандатов и не дотягивает до большинства. '+
          lead.leader+' предлагает вам два портфеля и место младшего партнёра.</p>'+
          '<p class="hint">В коалиции у вас будет вес и деньги, но курс задаёт не ваша партия. Отказ — чистая оппозиция.</p>',
        opts:[
          {label:'Войти в коалицию',hint:'Два портфеля, влияние без первого кресла',fn(){
            S.gov.coal.push(PL);S.gov.posts.soc=PL;S.gov.posts.mid=PL;S.role='junior';syncCabinet();
            if(mySeat()==='lead')setSeat('dep','Партия вошла в кабинет.');
            S.promises=[];S.termGdp=S.econ.gdp;S.termLaws=0;
            logMsg('«'+me().name+'» вошла в правительство '+lead.leader+' младшим партнёром.',1);
            chron('Ваша партия — младший партнёр в правительстве.','');render();}},
          {label:'Уйти в оппозицию',hint:'Свобода рук и четыре года критики',fn(){
            S.role='opp';logMsg('Вы отказались от портфелей и возглавили оппозицию.',1);render();}}]});
    } else {
      S.role='opp'; S.promises=[]; S.termGdp=S.econ.gdp; S.termLaws=0;
      if(chief()&&S.you.mand&&mySeat()==='dep')setSeat('lead','Фракция ушла в оппозицию.');
      sheetOpen({eye:'Правительство сформировано',title:'Вы в оппозиции',
        body:'<p>'+(isPres()?'Вы поручили кабинет ':'Президент поручил кабинет ')+lead.leader+' («'+lead.name+'»). Ваша фракция — '+
          mandates(seatsOf(PL))+' — уходит в оппозицию.</p>'+
          '<p class="hint">Оппозиция вносит законы, требует вотума недоверия и готовится к следующим выборам. Бюджет теперь не ваш.'+
          (isPres()?' Президентское кресло при этом остаётся вашим: вето и указы никуда не делись.':'')+'</p>',
        acts:[{label:'Принять'}]});
    }
    syncCabinet();
  }
}

/* после выборов без большинства: поручение у вас, раунд первый */
function openCoalitionTalks(){
  S.crisis={round:1,form:null,tried:[],why:'итоги выборов',since:S.q,prev:null,coal:[],refused:[],pacts:{}};
  formStart(PL);
}

/* ─── финал ──────────────────────────────────────────────────── */
function score(){
  const ap=approval();
  let s=Math.round(ap*3+seatsOf(PL)*2.2+S.laws.filter(l=>l.by===PL).length*7
    +(S.econ.gdp-100)*2.4-S.debt*0.12-avgUnrest()*1.6+(S.term-1)*40);
  const t=s>620?'Основатель республики':s>470?'Сильный премьер':s>340?'Крепкий хозяйственник':
          s>210?'Проходная фигура':s>90?'Слабое правление':'Провал';
  return {s,t};
}
function finish(won,why){
  S.over=true;S.ended=why;
  const {s,t}=score();
  chron(why,won?'g':'b');
  sheetOpen({eye:'Итог правления',title:won?'Срок отработан':'Конец карьеры',
    body:`<p>${why}</p>
      <div class="res"><span>Кварталов у власти</span><b>${S.q-1}</b>
        <span>Законов проведено</span><b>${S.laws.filter(l=>l.by===PL).length}</b>
        <span>Мандатов в Собрании</span><b>${seatsOf(PL)}</b>
        <span>Одобрение на финише</span><b>${Math.round(approval())}%</b>
        <span>ВВП, индекс</span><b>${r1(S.econ.gdp)}</b>
        <span>Долг</span><b>${Math.round(S.debt)} млрд</b></div>
      <div style="text-align:center;margin:12px 0 4px"><span class="stamp ${won?'y':'n'}">${s} очков</span></div>
      <p style="text-align:center;font:700 17px 'PT Serif',serif;margin:8px 0 0">«${t}»</p>`,
    acts:[{label:'Посмотреть летопись',fn:()=>{S.tab='arch';}},
          {label:'Начать заново',fn:()=>{try{localStorage.removeItem(SAVE);}catch(e){}location.reload();}}]});
}

function resign(){
  sheetOpen({eye:'Отставка',title:'Уйти самому?',
    body:'<p class="lead">Отставка по собственной воле закрывает счёт правления. Итог посчитают по тому, что вы оставили после себя, а не по тому, чем всё кончилось бы.</p>',
    opts:[{label:'Подать в отставку',hint:'подвести итог сейчас',fn:()=>finish(approval()>50,
        'Вы ушли сами при одобрении '+Math.round(approval())+'% и '+seatsOf(PL)+' мандатах у фракции.')},
      {label:'Остаться',hint:'работать дальше',fn:()=>{}}]});
}

/* ─── конституционная реформа ─────────────────────────────────────
   Сохранение из однопалатной Новарии со 120 креслами. Экономика,
   настроения, законы и летопись остаются; палаты пересобираются по
   сегодняшнему раскладу, как после референдума о новой конституции. */
function reseatChamber(n,mk,old){
  const tot={},out=[]; S.parties.forEach(p=>tot[p.id]=0);
  REGIONS.forEach(r=>{
    const sc={}; S.parties.forEach(p=>sc[p.id]=partyScore(p,r));
    const won=dhondt(shareFrom(sc),n(r));
    let k=0;
    Object.entries(won).forEach(([pid,c])=>{
      tot[pid]+=c;
      const inc=(old||[]).filter(d=>d.party===pid&&d.region===r.id);
      for(let i=0;i<c;i++,k++)out.push(inc[i]||mk(pid,r.id,k,i));
    });
  });
  return {tot,out};
}
function reformConstitution(){
  apportion();
  const low=reseatChamber(r=>S.regSeats[r.id],(pid,rid,k,i)=>makeDep(pid,rid,'r'+i+S.q),S.deputies);
  S.deputies=low.out; S.seats=low.tot;
  nameReset();
  const up=reseatChamber(r=>r.sen,(pid,rid,k,i)=>makeSen(pid,rid,k%3,i),null);
  S.senate=up.out; S.senSeats=up.tot; S.senCls=0;
  if(!S.pres)seedPresident();
  S.comm={}; S.commM={};           // прежние председатели сидели в прежнем созыве
  logMsg('Конституционная реформа: в Собрании '+SEATS+' мест, учреждён Сенат, введено президентство.',1);
  chron('Новария перешла к двухпалатному парламенту.','');
}

/* ─── сохранение ─────────────────────────────────────────────── */
const SAVE='novaria.save.v1';
/* Версия формата сохранения. Всё, что в load() идёт без номера, —
   наследство до версий: проверки «если поля нет». Новое изменение
   формата — новая запись в MIGRATIONS со следующим номером; load()
   прогоняет записи новее сохранения по порядку и ставит текущую. */
const SAVE_VER=4;
const MIGRATIONS=[
  {v:2, why:'списки сделок, скандалов и дел капитала', run(){
    S.deals=S.deals||[]; S.scandals=S.scandals||[]; S.bizLog=S.bizLog||[]; S.senLog=S.senLog||[]; }},
  {v:3, why:'дело идёт ступенями: проверка, обыски, обвинение, суд', run(){
    if(S.probe&&!S.probe.stage)S.probe={...S.probe,stage:'check',left:1,ev:Math.round(clamp(trail()*0.5+18,5,95)),src:'trail',used:{}};
    S.rcases=S.rcases||[]; }},
  {v:4, why:'мэры, автономия, сепаратизм и суверенитет краёв', run(){ regInit(); }},
];
function save(){ try{ S.ver=SAVE_VER; localStorage.setItem(SAVE,JSON.stringify(S)); }catch(e){} }
function migrate(){
  const from=S.ver||1;
  MIGRATIONS.filter(m=>m.v>from).sort((a,b)=>a.v-b.v).forEach(m=>m.run());
  S.ver=SAVE_VER;
}
function load(){
  try{ const raw=localStorage.getItem(SAVE); if(!raw)return false;
    const d=JSON.parse(raw); if(!d||!d.parties)return false;
    S=d;
    // сохранение из более ранней версии: дополняем недостающие поля
    S.world=S.world||{demand:100,res:100};
    S.cyc=S.cyc||{ph:Math.random(),len:ri(13,19)};
    S.comm=S.comm||{}; S.rec=S.rec||0; S.fatigue=S.fatigue||0;
    S.govAge=S.govAge||0; S.shockCool=S.shockCool||0; S.role=S.role||(S.gov.lead===PL?'pm':'opp');
    S.presRel=S.presRel===undefined?58:S.presRel;
    S.vetoed=S.vetoed||null; S.senCls=S.senCls||0;
    if(!TABS.some(t=>t.id===S.tab))S.tab='brief';
    REGIONS.forEach(r=>{ const s=Object.values(r.mix).reduce((a,b)=>a+b,0);
      r.share={};GROUPS.forEach(g=>r.share[g.id]=(r.mix[g.id]||0)/s); });
    nameReset();
    // сохранение до реформы: одна палата, 120 кресел, никакого президента
    if(!S.senate||!S.senate.length||!S.pres||(S.deputies||[]).length!==SEATS)reformConstitution();
    // сохранение до того, как у политика появилась биография
    if(!S.you){
      S.you={name:me().leader, age:48, origin:'province', traits:[],
             rep:{honest:50,firm:50,comp:50,folk:50}, career:[]};
      career('Биография начата задним числом: до этого история страны писалась без вас.');
    }
    S.you.rep=S.you.rep||{honest:50,firm:50,comp:50,folk:50};
    S.you.career=S.you.career||[]; S.you.traits=S.you.traits||[];
    if(!S.govs||!Object.keys(S.govs).length){ seedGovernors(); S.govLog=S.govLog||[];
      logMsg('Введена должность главы субъекта: одиннадцать краёв получили своих правителей.',1); }
    S.govLog=S.govLog||[];
    // сохранение до того, как исполнительная власть стала людьми
    if(!S.vp){ seatVP(S.pres.party);
      logMsg('Учреждена должность вице-президента: он председательствует в Сенате.',1); }
    if(!S.pm||!S.ministers||!Object.keys(S.ministers).length){ seedCabinet();
      logMsg('Кабинет получил поимённый состав: у каждого портфеля теперь есть министр.',1); }
    syncCabinet();
    // сохранение до печати, суда, надзора и соседей
    if(!S.press){ seedPress(); logMsg('В стране появились газеты: пять изданий следят за властью.',1); }
    if(!S.court||!S.court.length){ seedCourt();
      logMsg('Учреждён Конституционный суд: девять судей на пожизненный срок.',1); }
    if(!S.nb||!Object.keys(S.nb).length){ seedNeighbours();
      logMsg('Установлены отношения с четырьмя соседними государствами.',1); }
    S.trail=S.trail||0; S.trailLog=S.trailLog||[];
    S.probe=S.probe||null; S.challenge=S.challenge||null; S.ref=S.ref||null;
    // сохранение до реформы Сената: регламент, стаж, лидер большинства
    if(!S.senRules){
      S.senRules={cloture:CLOTURE, nuked:false, nukedBy:null, nukedQ:0};
      logMsg('Принят регламент Сената: прения закрываются '+CLOTURE+' голосами, а не простым большинством.',1);
    }
    if(S.senate&&S.senate.length){
      let noRank=false;
      S.senate.forEach(x=>{ if(!x.terms){ noRank=true;
        x.terms=Math.max(1,1+Math.floor(Math.max(0,S.q-(x.since||1))/senCyc())); } });
      if(noRank)logMsg('Палата пересчитала стаж: у сенаторов появилось старшинство.',1);
    }
    if(!S.senLead&&S.senate&&S.senate.length){ seatSenLeader(true);
      logMsg('Сенат избрал лидера большинства: повестку палаты ведёт '+
        (S.senLead?S.senLead.name:'—')+'.',1); }
    S.senHold=S.senHold||null; S.mate=S.mate||null;
    // сохранение до реформы нижней палаты, бизнеса и личной карьеры
    S.commHold=S.commHold||null; S.inq=S.inq||null; S.imp=S.imp||null;
    S.offers=S.offers||[]; S.evNo=S.evNo||0; S.prim=S.prim||null;
    if(!S.firms||!Object.keys(S.firms).length){ seedFirms();
      logMsg('В стране объявились восемь групп капитала: у денег появилось имя.',1); }
    if(S.capture===undefined)S.capture=8;
    // сохранение до конституции и архива правителей
    if(!S.cn){ S.cn=cnDefault();
      logMsg('Принята конституция Новарии: сроки, пороги и полномочия сведены в один текст.',1); }
    ['pterm','term','sencyc','limit','super','impH','impS','judge','noconf','dissolve','legit']
      .forEach(k=>{ if(S.cn[k]===undefined)S.cn[k]=cnDefault()[k]; });
    S.cn.log=S.cn.log||[];
    // сохранение до глав, ядра и Конституционного собрания
    if(S.cn.form===undefined){
      const d=cnDefault();
      ['form','senVeto','sendirect','rights','socmin','needH','needS','allref',
       'initiative','debtcap','courtN'].forEach(k=>S.cn[k]=d[k]);
      S.cn.log.forEach(x=>{ const c=cnAny(x.id); x.ch=x.ch||(c?c.ch:5); x.shield=x.shield||!!x.ref; });
      logMsg('Конституция разбита на девять глав. Главы 1, 2 и 9 объявлены ядром: '+
        'палаты их не открывают — только Конституционное собрание.',1);
    }
    S.conv=S.conv||null;
    if(!S.rulers){ S.rulers={pres:[],pm:[]};
      if(S.pres)openReign('pres',S.pres.name,S.pres.party);
      if(S.pm)openReign('pm',S.pm.name,S.pm.party);
      logMsg('Заведён архив правителей: кто сидел в кресле и что после себя оставил.',1); }
    if(S.you&&!S.you.seat){
      S.you.seat=S.gov.lead===PL?'pm':(S.role==='junior'?'dep':'lead');
      S.you.seatQ=S.q; S.you.primaries=0;
      logMsg('У политика появилось собственное кресло, отдельное от роли партии: '+seatName()+'.',1);
    }
    // сохранение до процедур палаты: регламент, договоры, вотум и кризис по ступеням
    if(S.reg===undefined){
      S.reg={}; S.split={}; S.apLog=[]; S.motion=null; S.crisis=null; S.pacts={};
      if(S.gov.lead===PL)coalition().filter(id=>id!==PL).forEach(id=>S.pacts[id]=pactFor(id,PL));
      if(S.imp&&!S.imp.stage)S.imp=null;             // обвинение старого образца не переживает загрузку
      logMsg('Палата получила регламент и процедуры: вотум и импичмент идут ступенями, у коалиции есть договоры.',1);
    }
    S.apLog=S.apLog||[]; S.split=S.split||{}; S.pacts=S.pacts||{};
    // сохранение до эмблем: соперники получают свои, игроку подбирается по имени
    if(S.parties.some(p=>!p.emb)){
      S.parties.forEach(p=>{ if(!p.emb)p.emb={...embFor(p)}; });
      logMsg('У партий появились эмблемы. Свою можно сменить в разделе «Партия».',1);
    }
    // сохранение до того, как вице-президент стал человеком со свойствами
    if(S.vp&&S.vp.sen===undefined){
      const k=pick(VP_KIND);
      S.vp.kind=k.id; S.vp.region=pick(REGIONS).id;
      S.vp.sen=ri(k.sen[0],k.sen[1]); S.vp.pop=ri(k.pop[0],k.pop[1]); S.vp.amb=ri(k.amb[0],k.amb[1]);
      S.vp.job='none'; S.vp.jobQ=S.q; S.vp.dropped=0; S.vp.restless=0;
      logMsg('У вице-президента появились свои свойства: умение вести палату, имя и честолюбие.',1);
    }
    // сохранение до лидеров фракций: у фракций появляются лица, у комитетов — состав
    if(!S.fl){
      if(!S.comm||!Object.keys(S.comm).length||!S.commM)seatCommittees();
      flSync(); S.deals=S.deals||[];
      logMsg('У фракций появились лидеры в обеих палатах: с ними можно договариваться. Комитеты получили состав.',1);
    }
    // сохранение до стартовых кресел: партию ведёте вы, стол заводится по креслу
    if(S.you&&S.you.chief===undefined){
      S.you.chief=true; S.you.inf=70; S.you.lrel=60; S.you.home=S.you.home||homeOf();
      S.you.mand=['dep','pm','vice','lead','min'].indexOf(S.you.seat)>=0;
      if(S.pres&&S.pres.party===PL&&S.pres.name===S.you.name&&S.you.seat!=='pres')S.you.seat='pres';
      if(S.vp&&S.vp.party===PL&&S.vp.name===S.you.name)S.vp.you=true;
      if(S.you.seat==='min'&&S.you.post&&S.ministers[S.you.post])S.ministers[S.you.post].you=true;
      S.desk=null;
      logMsg('У кресла появился свой стол: рычаги, цифра, по которой судят, и дорога дальше.',1);
    }
    migrate();
    return true;
  }catch(e){ console.warn('Сохранение не загрузилось:',e); return false; }
}

/* ═══ ПАРЛАМЕНТСКОЕ РАССЛЕДОВАНИЕ ═════════════════════════════════
   Комиссия не судит и не сажает. Она собирает то, что потом читают
   вслух, — и от этого уходят в отставку чаще, чем от приговоров. */
function askInquiry(){
  if(S.inq){ toast('Комиссия уже работает: '+inqTarget()); return; }
  if(!hasMandate()&&mySeat()!=='pres'&&mySeat()!=='vp'){ toast('Комиссию созывает палата, а вы в ней не заседаете'); return; }
  const opts=[];
  POSTS.forEach(p=>{ const m=minOf(p.id); if(!m)return;
    opts.push({label:'Министр: '+m.name,hint:p.name+' · '+P(m.party).short+' · компетентность '+m.comp,
      fn:()=>openInquiry('min',p.id)}); });
  const worst=REGIONS.slice().sort((a,b)=>(govOf(b.id)?govOf(b.id).rel:50)-(govOf(a.id)?govOf(a.id).rel:50))[0];
  if(worst&&govOf(worst.id))opts.push({label:'Глава края: '+govOf(worst.id).name,
    hint:R(worst.id).name+' · отношение '+Math.round(govOf(worst.id).rel),fn:()=>openInquiry('gov',worst.id)});
  if(S.pres&&!isPres())opts.push({label:'Президент: '+S.pres.name,
    hint:'указов '+S.pres.decrees+' · готовит почву для импичмента',fn:()=>openInquiry('pres',null)});
  const rich=FIRMS.slice().sort((a,b)=>(firmOf(b.id).given||0)-(firmOf(a.id).given||0))[0];
  opts.push({label:'Корпорация: '+rich.name,hint:rich.sec+' · дано вам '+Math.round(firmOf(rich.id).given)+' млн',
    fn:()=>openInquiry('firm',rich.id)});
  // конституционную поправку разбирают не по существу, а по тому, как её проводили
  (CN().log||[]).slice().reverse().slice(0,3).forEach(a=>{
    opts.push({label:'Поправка: '+a.name,
      hint:a.art+' · принята '+shortDate(a.q)+(a.ref?' · с референдумом':'')+
        ' · легитимность '+sign(a.cost),
      fn:()=>openInquiry('amend',a.id)});
  });
  opts.push({label:'Не созывать',hint:'закрыть',fn(){}});
  sheetOpen({eye:'Следственная комиссия',title:'Кого расследовать',
    body:`<p class="lead">Комиссия работает ${quarters(INQ_LEN)} и всё это время собирает улики.
        Итог зачитывают с трибуны: отставка, передача в суд, повод для импичмента, отмена поправки —
        или пшик, который дорого обходится тому, кто комиссию созвал.</p>
      <p class="hint">Созыв стоит ${INQ_CAP} веса и одного действия. Одна комиссия за раз.</p>`,
    opts});
}
function openInquiry(kind,who){
  if(!pay({ap:1,cap:INQ_CAP},'Следственная комиссия'))return;
  S.inq={kind,who,by:PL,q:S.q,left:INQ_LEN,ev:ri(4,14),leaks:0};
  const name=inqTarget();
  bumpRep('firm',2);
  logMsg('Созвана следственная комиссия: '+name+'.',1);
  chron('Собрание созвало комиссию по делу «'+name+'».','');
  cover({ax:'order',stance:1,
    good:'Палата берётся за то, о чём все молчали',
    bad:'Комиссия созвана: расправа под видом расследования',
    flat:'Собрание созвало следственную комиссию'});
  render();
}
/* комиссию созывают и против вас — этого не выбирают */
function inqAgainstYou(){
  if(S.inq)return;
  const opp=S.parties.filter(p=>p.id!==PL&&!inCoal(p.id)).sort((a,b)=>seatsOf(b.id)-seatsOf(a.id))[0];
  if(!opp||seatsOf(opp.id)<60)return;
  const risk=0.012+(S.trail||0)*0.0016+(captureLevel()>CAP_HIGH?0.012:0)+(approval()<40?0.01:0);
  if(Math.random()>=risk)return;
  // если вы недавно правили конституцию, разбирать будут именно это
  const mine=(CN().log||[]).filter(x=>x.cost<0&&S.q-x.q<=12);
  if(mine.length&&Math.random()<0.5){
    const a=mine[mine.length-1];
    S.inq={kind:'amend',who:a.id,by:opp.id,q:S.q,left:INQ_LEN,ev:ri(12,28),leaks:0};
    logMsg('Оппозиция созвала комиссию по поправке «'+a.name.toLowerCase()+'».',1);
    chron('Комиссия разбирает вашу поправку к конституции.','b');
    sheetOpen({eye:'Следственная комиссия',title:'Разбирают вашу поправку',
      body:`<p class="lead">«${P(opp.id).name}» добилась комиссии по порядку принятия поправки
          «${a.name.toLowerCase()}». Разбирать будут не статью, а то, как за неё голосовали.</p>
        <div class="res"><span>Поправка</span><b class="w">${a.name}</b>
          <span>Принята</span><b>${shortDate(a.q)}${a.ref?' · с референдумом':''}</b>
          <span>След тогда</span><b class="${(a.bought||0)>40?'bad':''}">${a.bought||0}</b>
          <span>Работа комиссии</span><b>${quarters(INQ_LEN)}</b></div>
        <p class="hint">Полный состав даёт палате право отменить поправку как принятую с нарушением порядка.
          Всенародное голосование такую комиссию сильно осложняет.</p>`,
      acts:[{label:'Принять к сведению'}]});
    render(); return;
  }
  S.inq={kind:'you',who:null,by:opp.id,q:S.q,left:INQ_LEN,ev:ri(10,26),leaks:0};
  logMsg('Оппозиция созвала комиссию по вашим делам.',1);
  chron('Против вас созвана следственная комиссия.','b');
  sheetOpen({eye:'Следственная комиссия',title:'Комиссия по вашим делам',
    body:`<p class="lead">«${P(opp.id).name}» собрала подписи и добилась комиссии.
        Разбирать будут сделки, подряды и то, откуда в кассе деньги.</p>
      <div class="res"><span>Кто ведёт</span><b class="w">${P(opp.id).name}</b>
        <span>След за вами</span><b class="${(S.trail||0)>50?'bad':''}">${Math.round(S.trail||0)}</b>
        <span>Захват власти бизнесом</span><b class="${captureLevel()>CAP_HIGH?'bad':''}">${captureLevel()}</b>
        <span>Работа комиссии</span><b>${quarters(INQ_LEN)}</b></div>
      <p class="hint">Помешать напрямую нельзя. Можно чистить хвосты, пока она копает.</p>`,
    acts:[{label:'Принять к сведению'}]});
}
function inqTick(){
  inqAgainstYou();
  const i=S.inq; if(!i)return;
  i.ev=clamp(i.ev+inqDig(i),0,100);
  i.left--;
  // громкие утечки по ходу работы
  if(Math.random()<0.3&&i.ev>40){ i.leaks++;
    const who=inqTarget();
    if(i.kind==='you'){ shiftAll(-1.2); addCap(-3); }
    else if(i.kind==='pres')S.presRel=clamp(S.presRel-4,0,100);
    head('Из комиссии утекло: '+who.toLowerCase()+' под вопросом','b');
    logMsg('Утечка из комиссии: улик набрано на «'+inqWord(i.ev)+'».');
  }
  if(i.left<=0)inqVerdict();
}
function inqVerdict(){
  const i=S.inq; S.inq=null;
  const name=inqTarget.call(null)||'—';
  const who=(()=>{ const t={kind:i.kind,who:i.who}; const save=S.inq; S.inq=i; const n=inqTarget(); S.inq=save; return n; })();
  const strong=i.ev>=62, some=i.ev>=34;
  let body='', acts=[{label:'Принять к сведению'}];
  if(i.kind==='you'){
    if(strong){
      addCap(-16); shiftAll(-4); bumpRep('honest',-10);
      addTrail(12,'выводы комиссии');
      body=`<p class="lead">Комиссия закончила и не пожалела красок. Читают с трибуны, печать перепечатывает.</p>`;
      chron('Комиссия обвинила вас публично.','b');
      // сильные выводы открывают дорогу отзыву мандата
      if(hasMandate()&&Math.random()<0.45)later(1,'recall',{});
    } else if(some){ addCap(-6); shiftAll(-1.4); bumpRep('honest',-3);
      body=`<p class="lead">Выводы обтекаемые: «отдельные нарушения», «требует внимания». Хуже, чем ничего, лучше, чем состав.</p>`;
    } else { addCap(8); shiftAll(2); bumpRep('honest',5); bumpRep('firm',3);
      body=`<p class="lead">Комиссия не нашла ничего. Это тоже приговор — тем, кто её созывал.</p>`;
      chron('Комиссия против вас закончилась ничем.','g');
      if(i.by&&P(i.by))P(i.by).mom=clamp(P(i.by).mom-3,-12,12);
    }
  } else if(i.kind==='min'){
    const m=minOf(i.who);
    if(strong&&m){ body=`<p class="lead">Комиссия предъявила министру подряды и переписку. Кабинету придётся отвечать.</p>`;
      acts=[{label:'Отправить в отставку',fn(){ reshuffleForce(i.who,'по выводам комиссии'); }},
            {label:'Защищать',fn(){ addCap(-10); shiftAll(-2.5); bumpRep('honest',-5);
              logMsg('Вы отстояли министра вопреки выводам комиссии.',1); }}];
      addCap(4); bumpRep('firm',2);
    } else if(some){ if(m)m.comp=clamp(m.comp-ri(5,12),10,95);
      body=`<p class="lead">Нашли беспорядок, но не воровство. Ведомство переживёт, репутация ведомства нет.</p>`;
    } else { addCap(-6); bumpRep('comp',-3);
      body=`<p class="lead">Ничего не нашли. Комиссия обошлась дороже, чем всё, что она искала.</p>`; }
  } else if(i.kind==='gov'){
    const g=govOf(i.who);
    if(strong&&g){ body=`<p class="lead">Край жил по своим правилам, и комиссия это доказала.</p>`;
      acts=[{label:'Снять главу края',fn(){ fireGovForce(i.who,'по выводам комиссии'); }},
            {label:'Оставить',fn(){ if(g)g.rel=clamp(g.rel+12,0,100); addCap(-4); }}];
    } else { if(g)g.rel=clamp(g.rel-(some?6:-8),0,100);
      body=`<p class="lead">${some?'Нашли мелочи, которые есть везде.':'Комиссия уехала ни с чем, а край запомнил.'}</p>`; }
  } else if(i.kind==='pres'){
    if(strong){ S.presRel=clamp(S.presRel-14,0,100);
      body=`<p class="lead">Комиссия собрала достаточно, чтобы говорить об импичменте вслух.</p>`;
      acts=[{label:'Вносить обвинение',fn(){ askImpeach('pres'); }},
            {label:'Держать материалы при себе',fn(){ addCap(6); S.impReady=true;
              logMsg('Материалы комиссии по президенту оставлены в резерве.'); }}];
    } else { S.presRel=clamp(S.presRel-(some?4:-6),0,100); addCap(some?0:-8);
      body=`<p class="lead">${some?'Отдельные вопросы остались без ответа, и только.':'Против президента не нашлось ничего: удар пришёлся по вам.'}</p>`; }
  } else if(i.kind==='amend'){
    const a=(CN().log||[]).find(x=>x.id===i.who);
    if(!a){ body='<p class="lead">Поправки, о которой шла речь, в основном законе уже нет.</p>'; }
    else if(strong){
      body=`<p class="lead">Комиссия разбирала не статью, а то, как её проводили. Нашлось достаточно:
        сделки в те кварталы, спешка, подписи, собранные не там, где положено. Поправку можно отменить
        как принятую с нарушением порядка.</p>`;
      acts=[{label:'Отменить поправку',fn(){
          if(revokeAmend(a,'по выводам комиссии')){ shiftAll(2.4); bumpRep('honest',7); addCap(6);
            cover({ax:'order',stance:-1,
              good:'Основной закон вернули в прежний вид',
              bad:'Поправку отменили не по праву, а по силе',
              flat:'Отменена поправка «'+a.name.toLowerCase()+'»'}); } }},
        {label:'Оставить как есть',fn(){ bumpLegit(-6); addCap(-4);
          logMsg('Выводы комиссии по поправке «'+a.name.toLowerCase()+'» положены под сукно.',1); }}];
    } else if(some){ bumpLegit(-3);
      body=`<p class="lead">Нашли спешку и неаккуратность, но не подлог. Поправка остаётся, вопросы — тоже.</p>`;
    } else { addCap(-6); bumpLegit(2);
      body=`<p class="lead">Порядок принятия оказался чист. Тем, кто затевал разбор, придётся объясняться.</p>`; }
  } else if(i.kind==='firm'){
    const f=firmOf(i.who), d=FM(i.who);
    if(strong){ f.rel=clamp(f.rel-24,0,100); f.angry=(f.angry||0)+2; bumpCapture(-9);
      shiftMood('work',3); shiftMood('intel',4); shiftMood('biz',-6);
      body=`<p class="lead">Схема вскрыта: подряды, посредники, знакомые фамилии. ${d.name} будет мстить.</p>`;
      acts=[{label:'Передать в суд',fn(){ payGold(-18); bumpRep('honest',6); shiftAll(2);
              logMsg('Дело «'+d.name+'» передано в суд, штраф 18 млрд в казну.',1); }},
            {label:'Договориться тихо',fn(){ S.funds=r1(S.funds+30); bumpCapture(7);
              addTrail(14,'сделка с «'+d.name+'»'); bumpRep('honest',-8);
              logMsg('С «'+d.name+'» договорились без огласки: касса +30 млн.',1); }}];
    } else { f.rel=clamp(f.rel+(some?-6:10),0,100); if(!some)bumpCapture(3);
      body=`<p class="lead">${some?'Нашли неаккуратность, не преступление.':'Корпорация вышла чистой и это запомнила — в свою пользу.'}</p>`; }
  }
  logMsg('Комиссия закончила работу: '+who+' — '+inqWord(i.ev)+'.',1);
  sheetOpen({eye:'Выводы комиссии · '+dateLabel(),title:who,
    body:body+`<div class="res"><span>Улик собрано</span><b class="${strong?'bad':''}">${Math.round(i.ev)} · ${inqWord(i.ev)}</b>
        <span>Работала</span><b>${quarters(INQ_LEN)}</b>
        <span>Утечек по ходу</span><b>${i.leaks}</b>
        <span>Созывал</span><b class="w">${P(i.by)?P(i.by).name:'—'}</b></div>`,
    acts});
}
/* отставка министра и снятие главы по выводам комиссии */
function reshuffleForce(post,why){
  const m=minOf(post); if(!m)return;
  S.ministers[post]=makeMinister(post,S.gov.posts[post]||S.gov.lead);
  if(S.partners[m.party])S.partners[m.party].anger=clamp(S.partners[m.party].anger+1.5,0,6);
  bumpRep('firm',4); bumpRep('honest',3); addCap(3);
  logMsg('Министр '+m.name+' отправлен в отставку '+why+'.',1);
  chron('Отставка министра '+m.name+'.','');
}
function fireGovForce(rid,why){
  const g=govOf(rid); if(!g)return;
  seatGov(rid,S.gov.lead,'снят '+why);
  S.unrest[rid]=clamp(S.unrest[rid]+8,0,100);
  bumpRep('firm',3);
  logMsg('Глава '+R(rid).name+' снят '+why+'.',1);
}

/* ═══ ИМПИЧМЕНТ ═══════════════════════════════════════════════════
   Обвинение выдвигает нижняя палата простым большинством, судит
   верхняя двумя третями. Между этими двумя числами и лежит вся
   разница между скандалом и отрешением. */
function impBonus(){
  let v=0;
  // сила дела из спецкомиссии; старые дела без неё — по материалам следствия
  if(S.imp&&S.imp.case!==undefined)v+=(S.imp.case-45)*0.6;
  else if(S.imp&&S.imp.ready)v+=28;
  v+=clamp((rep('honest')-50)*0.3,-12,12);
  if(pressTone()>10)v+=10; else if(pressTone()<-10)v-=10;
  return Math.round(v);
}
function impDone(resigned){
  const i=S.imp; S.imp=null;
  addCap(14); bumpRep('firm',7); shiftAll(1.5);
  if(i.kind==='pres'){
    const vpn=S.vp?S.vp.name:depName(), party=S.pres.party;
    logMsg('Президент '+S.pres.name+' отрешён от должности. Полномочия принял '+vpn+'.',1);
    chron('Президент отрешён от должности.','b');
    closeReign('pres',resigned?'отставка':'импичмент');
    S.pres={party,name:vpn,since:S.q,until:S.pres.until,term:S.pres.term,
            vetoes:0,decrees:S.pres.decrees,succeeded:true};
    openReign('pres',S.pres.name,S.pres.party);
    const cand=makeVP(party); S.vp=confirmSenate('vp',cand,party)?cand:null;
    S.presRel=clamp(S.presRel-10,0,100);
  }
  if(i.kind==='vp'){ const party=S.vp.party; const cand=makeVP(party);
    logMsg('Вице-президент '+i.who.name+' отрешён.',1);
    S.vp=confirmSenate('vp',cand,party)?cand:null; }
  if(i.kind==='judge'){ S.court=S.court.filter(j=>j.id!==i.who.id);
    const by=S.pres?S.pres.party:S.gov.lead, cand=makeJudge(by,S.q);
    if(confirmSenate('judge',cand,by))S.court.push(cand);
    logMsg('Судья '+i.who.name+' лишён мантии.',1); }
  if(i.kind==='min'){ reshuffleForce(i.who.id,'по импичменту'); }
  career('Проведён импичмент: '+i.who.name+'.');
  cover({ax:'order',stance:1,
    good:'Отрешение состоялось: власть подотчётна палате',
    bad:'Расправа в палатах: кресло отобрали голосованием',
    flat:i.who.name+' отрешён от должности'});
  render();
}
function impFail(inSenate){
  const i=S.imp; S.imp=null;
  addCap(inSenate?-14:-8); shiftAll(inSenate?-2.5:-1.4); bumpRep('comp',-3);
  if(i.kind==='pres')S.presRel=clamp(S.presRel-12,0,100);
  logMsg('Импичмент против '+i.who.name+' провалился. Он вышел из этого сильнее.',1);
  chron('Импичмент провалился.','b');
  cover({ax:'order',stance:-1,
    good:'Палата не дала свести счёты голосованием',
    bad:'Импичмент провалился: обвинение оказалось пустым',
    flat:'Импичмент против '+i.who.name+' не прошёл'});
  render();
}
/* импичмент против игрока-президента: этого не выбирают */

/* ═══ БИЗНЕС ══════════════════════════════════════════════════════
   Корпорация приходит не с угрозой, а с предложением. Отказать
   можно всегда — просто каждый отказ стоит ровно столько, сколько
   стоило бы согласие, только платите вы. */
function firmTick(){
  if(!S.firms)seedFirms();
  FIRMS.forEach(d=>{
    const f=firmOf(d.id);
    // капитал растёт с хозяйством и тает от вражды
    f.cash=r1(clamp(f.cash+(S.econ.growth-1)*2.2*d.power-(f.angry>0?3:0)+rnd(-2,3),10,400));
    // отношение подтягивается к тому, насколько курс страны им подходит
    const target=clamp(62-firmGap(f)*10,6,94);
    f.rel=r1(f.rel+(target-f.rel)*0.11);
    if(f.angry>0&&Math.random()<0.3)f.angry--;
    // данные деньги забываются, обещания — нет
    if(f.given>0)f.given=r1(Math.max(0,f.given-f.given*0.12));
    const owed=firmOwed(f);
    if(owed&&!owed.done&&owed.left<=0){ firmBetrayed(d.id); }
    if(owed&&owed.done){ f.rel=clamp(f.rel+10,0,100); f.owed=null;
      logMsg('«'+d.name+'» получила обещанное и это запомнила.'); }
  });
  // захват сам по себе не растёт, но и не падает быстро
  S.capture=clamp(r1((S.capture||0)-0.4),0,100);
  const cap=captureLevel();
  if(cap>CAP_HIGH){
    shiftMood('work',-(cap-CAP_HIGH)*0.055); shiftMood('intel',-(cap-CAP_HIGH)*0.07);
    shiftMood('biz',(cap-CAP_HIGH)*0.045);
    if(Math.random()<0.25)addTrail((cap-CAP_HIGH)*0.12,'разговоры о захвате власти');
  }
  // корпорации сами приходят с предложением
  if(!S.ev.cool&&Math.random()<0.24)firmApproach();
}
function firmBetrayed(id){
  const f=firmOf(id), d=FM(id);
  f.owed=null; f.angry=(f.angry||0)+3; f.rel=clamp(f.rel-26,0,100);
  // деньги уходят к сопернику, ближайшему по интересам
  const rival=S.parties.filter(p=>p.id!==PL).sort((a,b)=>axDist(a.st,d.want)-axDist(b.st,d.want))[0];
  if(rival){ rival.funds=r1((rival.funds||0)+ri(20,45)); rival.mom=clamp(rival.mom+2.5,-12,12); }
  shiftMood(d.groups[0],-2.5);
  logMsg('«'+d.name+'» не дождалась обещанного закона и ушла к «'+(rival?rival.short:'соперникам')+'».',1);
  chron('«'+d.name+'» разорвала отношения с вами.','b');
}
/* предложение от корпорации: с этого начинается всякий захват */
function firmApproach(){
  const pool=FIRMS.filter(d=>{ const f=firmOf(d.id); return f&&f.rel>28&&!f.owed; });
  if(!pool.length)return;
  const d=pick(pool), f=firmOf(d.id);
  const ax=pick(Object.keys(d.want).filter(k=>Math.abs(d.want[k])>0.5));
  const topics=TOPICS.filter(t=>t.ax===ax&&!t.special);
  if(!topics.length)return;
  const t=pick(topics), want=clamp(Math.round(d.want[ax]),-2,2)||1;
  const money=Math.round(clamp(f.cash*0.28,12,70));
  S.ev.cool=1;
  sheetOpen({eye:d.sec+' · '+dateLabel(),title:d.name+' просит о встрече',
    body:`<p class="lead">${d.txt} Представитель приехал не с пустыми руками: «${t.name}» в редакции
        «${STEP[want+2]}» — и в партийной кассе становится на ${money} млн больше.</p>
      <div class="res"><span>Отношение к вам</span><b class="${f.rel<40?'bad':f.rel>=62?'good':''}">${Math.round(f.rel)}</b>
        <span>Капитал</span><b>${Math.round(f.cash)} млн</b>
        <span>Вес в хозяйстве</span><b>${firmWeight(f)}</b>
        <span>Захват власти</span><b class="${captureLevel()>CAP_HIGH?'bad':''}">${captureLevel()} · ${captureWord(captureLevel())}</b></div>
      <p class="hint">Обещание придётся исполнить за ${quarters(CAP_GIFT)}. Не исполните — деньги уйдут
        к сопернику, а корпорация станет врагом.</p>`,
    opts:[
      {label:'Взять деньги и обещать закон',hint:'+'+money+' млн · обещание на '+quarters(CAP_GIFT),
       fn(){ S.funds=r1(S.funds+money); f.given=r1((f.given||0)+money); f.gifts++;
         f.owed={topic:t.id,stance:want}; f.owedQ=S.q; f.deals++;
         f.cash=r1(f.cash-money); bumpCapture(money*0.14); addTrail(money*0.1,'деньги «'+d.name+'»');
         bumpRep('honest',-2);
         logMsg('«'+d.name+'» дала '+money+' млн под обещание по «'+t.name+'».',1); render(); }},
      {label:'Взять деньги, ничего не обещая',hint:'+'+Math.round(money*0.4)+' млн · они поймут',
       fn(){ const m=Math.round(money*0.4); S.funds=r1(S.funds+m); f.given=r1((f.given||0)+m); f.gifts++;
         f.cash=r1(f.cash-m); f.rel=clamp(f.rel-6,0,100); bumpCapture(m*0.08);
         addTrail(m*0.06,'деньги «'+d.name+'»');
         logMsg('Взяли у «'+d.name+'» '+m+' млн без обязательств.'); render(); }},
      {label:'Отказать',hint:'вес '+FIRM_BUY+' · улица оценит',
       fn(){ if(!payCap(FIRM_BUY)){render();return;}
         f.rel=clamp(f.rel-14,0,100); f.angry=(f.angry||0)+1; bumpCapture(-5);
         bumpRep('honest',6); shiftMood('work',2); shiftMood('intel',3); shiftMood('biz',-3);
         head('Власть отказала «'+d.name+'» и не взяла денег','g');
         logMsg('Вы публично отказали «'+d.name+'».',1); render(); }},
      {label:'Выслушать и не решать',hint:'ничего не меняется',fn(){}}]});
}
/* работа с корпорацией по вашей воле */
function firmAct(id,kind){
  const d=FM(id), f=firmOf(id);
  if(!d||!f)return;
  const a=FIRM_ACT.find(x=>x.id===kind); if(!a)return;
  if(!pay({ap:1},'Разговор с капиталом'))return;
  if(a.cap&&!payCap(capCost(a.cap,'talk'))){apBack();return;}
  if(kind==='meet'){ f.rel=clamp(f.rel+ri(5,11),0,100);
    logMsg('Встреча с «'+d.name+'»: отношение '+Math.round(f.rel)+'.'); }
  if(kind==='gift'){
    const m=Math.round(clamp(f.cash*0.2*(f.rel/60),4,55));
    if(f.rel<34){ toast('«'+d.name+'» не даст вам ни рубля'); apBack(); return; }
    S.funds=r1(S.funds+m); f.given=r1((f.given||0)+m); f.cash=r1(f.cash-m); f.gifts++;
    bumpCapture(m*0.12); addTrail(m*0.09,'пожертвование «'+d.name+'»'); bumpRep('honest',-1.5);
    logMsg('«'+d.name+'» пожертвовала '+m+' млн в партийную кассу.');
    toast('+'+m+' млн в кассу');
  }
  if(kind==='deal'){
    const ax=Object.keys(d.want).sort((a2,b2)=>Math.abs(d.want[b2])-Math.abs(d.want[a2]))[0];
    const t=pick(TOPICS.filter(x=>x.ax===ax&&!x.special));
    if(!t){toast('Нечего им обещать');apBack();return;}
    const want=clamp(Math.round(d.want[ax]),-2,2)||1;
    const m=Math.round(clamp(f.cash*0.34,15,80));
    f.owed={topic:t.id,stance:want}; f.owedQ=S.q; f.deals++;
    S.funds=r1(S.funds+m); f.given=r1((f.given||0)+m); f.cash=r1(f.cash-m);
    f.rel=clamp(f.rel+12,0,100); bumpCapture(m*0.16); addTrail(m*0.12,'сделка с «'+d.name+'»');
    logMsg('Сделка с «'+d.name+'»: '+m+' млн под «'+t.name+'» ('+STEP[want+2]+').',1);
  }
  if(kind==='shake'){
    if(f.rel<40){ toast('«'+d.name+'» не в том настроении'); apBack(); return; }
    const inv=Math.round(clamp(f.cash*0.3,10,60));
    f.cash=r1(f.cash-inv); f.rel=clamp(f.rel-8,0,100);
    S.econ.invest=r1(S.econ.invest+inv*0.25);
    S.unrest[d.reg]=clamp(S.unrest[d.reg]-ri(4,9),0,100);
    S.rmod[d.reg]=clamp(S.rmod[d.reg]+2,-22,22);
    shiftMood('work',1.5);
    logMsg('«'+d.name+'» вложила '+inv+' млн в '+R(d.reg).name+'.',1);
  }
  if(kind==='break'){
    f.rel=clamp(f.rel-22,0,100); f.angry=(f.angry||0)+2; bumpCapture(-8);
    bumpRep('honest',7); bumpRep('firm',3);
    shiftMood('work',3); shiftMood('intel',4); shiftMood('biz',-5);
    const rival=S.parties.filter(p=>p.id!==PL).sort((a,b)=>axDist(a.st,d.want)-axDist(b.st,d.want))[0];
    if(rival)rival.funds=r1((rival.funds||0)+ri(15,35));
    head('Разрыв с «'+d.name+'»: власть отказалась от денег','g');
    logMsg('Вы порвали с «'+d.name+'» публично.',1);
    chron('Разрыв с «'+d.name+'».','');
  }
  render();
}
function askFirm(id){
  const d=FM(id), f=firmOf(id);
  if(!d||!f)return;
  const owed=firmOwed(f);
  sheetOpen({eye:d.sec,title:d.name,
    body:`<p class="lead">${d.txt}</p>
      <div class="res" style="margin-top:0"><span>Отношение к вам</span><b class="${f.rel<40?'bad':f.rel>=62?'good':''}">${Math.round(f.rel)}</b>
        <span>Капитал</span><b>${Math.round(f.cash)} млн</b>
        <span>Дано вам</span><b>${Math.round(f.given)} млн · ${f.gifts} раз</b>
        <span>Вес в хозяйстве</span><b>${firmWeight(f)}</b>
        <span>Главный край</span><b class="w">${R(d.reg).name}</b>
        <span>Опирается на</span><b class="w">${d.groups.map(g=>G(g).name.toLowerCase()).join(', ')}</b>
        ${owed?`<span>Обещано</span><b class="${owed.done?'good':'warn'}">${owed.t.name}${owed.done?' · исполнено':' · осталось '+quarters(owed.left)}</b>`:''}
        ${f.angry?`<span>Настроение</span><b class="bad">злится</b>`:''}</div>
      <p class="hint">Чего хочет: ${Object.entries(d.want).filter(([,v])=>Math.abs(v)>0.5)
        .map(([k,v])=>AXNAME[k].toLowerCase()+' '+(v>0?AXES.find(a=>a.id===k).r:AXES.find(a=>a.id===k).l)).join(', ')}.</p>`,
    opts:FIRM_ACT.map(a=>({label:a.name,hint:(a.cap?'вес '+capCost(a.cap,'talk')+' · ':'')+a.txt,
      fn:()=>firmAct(id,a.id)})).concat([{label:'Ничего',hint:'закрыть',fn(){}}])});
}
/* национализация: дорого, необратимо и меняет разговор со всеми */
function nationalise(id){
  const d=FM(id), f=firmOf(id);
  if(f.nat){toast('Уже в казне');return;}
  if(!pay({ap:1,cap:NAT_CAP},'Национализация'))return;
  f.nat=true; f.rel=0; f.angry=5;
  S.treasury=r1(S.treasury+f.cash*0.5);
  S.econ.invest=r1(S.econ.invest-14);
  FIRMS.forEach(x=>{ const g=firmOf(x.id); if(g&&x.id!==id)g.rel=clamp(g.rel-16,0,100); });
  shiftMood('work',6); shiftMood('biz',-14); shiftMood('intel',-2);
  bumpCapture(-14); bumpRep('firm',8);
  logMsg('«'+d.name+'» национализирована. В казну '+Math.round(f.cash*0.5)+' млрд.',1);
  chron('Национализация «'+d.name+'».','');
  cover({ax:'econ',stance:-2,
    good:'Отрасль вернулась стране',
    bad:'Отъём собственности: инвесторы бегут',
    flat:'«'+d.name+'» перешла в казну'});
  render();
}

/* ═══ КАРЬЕРА ИГРОКА ══════════════════════════════════════════════
   Партия и человек — разные вещи. Партия может выиграть, пока вы
   теряете кресло, и наоборот. Игра идёт, пока жив политик. */

/* ─── отзыв мандата ───────────────────────────────────────────────
   Мандат отбирают трижды: за след, по суду и решением фракции. */
function recallRisk(){
  if(!hasMandate())return 0;
  let v=CN().recall?0.012:0;
  if((S.trail||0)>RECALL*100)v+=((S.trail-RECALL*100)/100)*0.09;
  if(S.probe&&S.probe.left<=1)v+=0.03;
  if(captureLevel()>CAP_HIGH+15)v+=0.012;
  if(rep('honest')<26)v+=0.015;
  return clamp(v*(CN().recall?2:1),0,0.2);
}
function recallTick(){
  if(Math.random()>=recallRisk())return;
  loseMandate('по представлению надзора');
}
function loseMandate(why){
  if(!hasMandate())return;
  const was=mySeat();
  // премьер без мандата — не премьер; министром остаться можно
  const to=(was==='pm'||was==='lead')?'none':'none';
  setSeat(to,'Мандат отобран.');
  S.seats[PL]=Math.max(0,(S.seats[PL]||1)-1);
  const gone=S.deputies.filter(d=>d.party===PL)[0];
  if(gone)S.deputies=S.deputies.filter(d=>d!==gone);
  if(was==='pm'){ S.gov.lead=bigOpp().id; S.role='opp'; syncCabinet(); }
  addCap(-18); shiftAll(-3); bumpRep('honest',-6);
  logMsg('Вы лишились мандата '+why+'.',1);
  chron('Вы лишились депутатского мандата.','b');
  sheetOpen({eye:'Мандат',title:'Вы больше не депутат',
    body:`<p class="lead">Мандат отобран ${why}. Ни зала, ни трибуны, ни права вносить законы своей рукой.
        Партия осталась вашей — на бумаге и пока что.</p>
      <div class="res"><span>Было кресло</span><b class="w">${(SEATS_YOU[was]||{}).name}</b>
        <span>Стало</span><b class="w">${SEATS_YOU.none.name}</b>
        <span>След за вами</span><b class="bad">${Math.round(S.trail||0)}</b>
        <span>Мандатов у фракции</span><b>${seatsOf(PL)}</b></div>
      <p class="hint">Вернуться можно: довыборами, следующим созывом, чужим приглашением в кабинет.
        Партией вы руководите по-прежнему, но всё придётся делать чужими руками.</p>`,
    acts:[{label:'Дальше'}]});
  render();
}
/* довыборы: вернуть себе мандат деньгами и весом */
function byElection(){
  if(hasMandate()){toast('Мандат у вас есть');return;}
  if(!pay({ap:1,cap:12,funds:30},'Довыборы'))return;
  const ch=clamp(0.3+approval()/220+(rep('folk')-50)/260,0.12,0.86);
  if(Math.random()<ch){
    setSeat('dep','Довыборы выиграны.');
    S.seats[PL]=(S.seats[PL]||0)+1;
    S.deputies.push(makeDep(PL,pick(REGIONS).id,'by'+S.q));
    addCap(10); bumpRep('folk',4);
    logMsg('Довыборы выиграны: вы снова депутат.',1);
    chron('Вы вернулись в Собрание через довыборы.','g');
  } else {
    addCap(-6); bumpRep('folk',-3);
    logMsg('Довыборы проиграны. Мандата по-прежнему нет.',1);
  }
  render();
}

/* ─── предложения кресел ──────────────────────────────────────────
   Кресло предлагают, когда вы нужны, а не когда вам нужно. */
function offerTick(){
  if(S.camp||S.over)return;
  if(Math.random()>0.16)return;
  const seat=mySeat();
  const pool=[];
  const sc=S.desk?S.desk.score:50;
  // министром зовут, когда партия в коалиции, а вы не в кабинете
  if(inCoal(PL)&&!isPM()&&['dep','lead','none','gov','mayor','sen'].indexOf(seat)>=0&&(chief()||sc>=55||S.you.inf>=40))pool.push('min');
  // вице-премьером — когда фракция крупная и союзники устали
  if(inCoal(PL)&&!isPM()&&seat==='dep'&&seatsOf(PL)>=70&&chief())pool.push('vice');
  // вторым номером зовёт чужой президентский список
  if(S.pres&&!isPres()&&!presOurs()&&presLeft()<=6&&presLeft()>1&&['vp','pres'].indexOf(seat)<0&&
     S.mateAsked!==S.pres.until&&rep('folk')>=50)pool.push('vp');       // вторым номером зовут раз за цикл
  // премьером — когда кабинет валится, а вы крупнейшая фракция
  if(!isPM()&&chief()&&seat!=='pres'&&seatsOf(PL)>=seatsOf(bigOpp().id)&&S.presRel>52&&approval()>46)pool.push('pm');
  if(!pool.length)return;
  const k=pick(pool);
  if(k==='min')offerMinistry();
  if(k==='vice')offerVicePM();
  if(k==='vp')offerRunningMate();
  if(k==='pm')offerPremier();
}
function offerMinistry(){
  const p=pick(POSTS), m=minOf(p.id);
  const by=P(S.gov.lead);
  sheetOpen({eye:'Предложение · '+dateLabel(),title:'Вас зовут в кабинет',
    body:`<p class="lead">${by.leader} предлагает вам ${p.name.toLowerCase()}. Портфель настоящий,
        ведомство со своими цифрами — и своя доля ответственности за то, что делает не ваш кабинет.</p>
      <div class="res"><span>Портфель</span><b class="w">${p.name}</b>
        <span>Что даёт</span><b class="w">${p.eff}</b>
        <span>Нынешний министр</span><b class="w">${m?m.name:'вакансия'}</b>
        <span>Ваше кресло сейчас</span><b class="w">${seatName()}</b></div>
      <p class="hint">Министр отвечает за своё ведомство перед палатой и первым попадает
        под следственную комиссию. Зато его цифры — его заслуга.</p>`,
    opts:[
      {label:'Принять портфель',hint:'кресло министра · ведомство ваше',
       fn(){ if(!inCoal(PL)){S.gov.coal.push(PL);S.role='junior';}
         takeMin(p.id); addCap(8); bumpRep('comp',3);
         logMsg('Вы приняли портфель: '+p.name+'.',1);
         chron('Вы вошли в кабинет министром.','g'); render(); }},
      {label:'Отказаться',hint:'руки развязаны, кресла нет',
       fn(){ addCap(-2); bumpRep('firm',3);
         logMsg('Вы отказались от портфеля '+p.name.toLowerCase()+'.'); render(); }}]});
}
function offerVicePM(){
  sheetOpen({eye:'Предложение · '+dateLabel(),title:'Второе кресло в кабинете',
    body:`<p class="lead">Вам предлагают вице-премьерство: доля власти в кабинете, который ведёт не вы.
        Ни одного ведомства целиком, зато право говорить от имени правительства.</p>
      <div class="res"><span>Кабинет ведёт</span><b class="w">${P(S.gov.lead).leader}</b>
        <span>Мандатов у вас</span><b>${seatsOf(PL)}</b>
        <span>Ваше кресло сейчас</span><b class="w">${seatName()}</b></div>`,
    opts:[
      {label:'Принять',hint:'вес растёт, свобода уходит',
       fn(){ setSeat('vice','Принято вице-премьерство.'); addCap(12); bumpRep('comp',2);
         if(!inCoal(PL)){S.gov.coal.push(PL);S.role='junior';}
         logMsg('Вы стали вице-премьером.',1); render(); }},
      {label:'Отказаться',hint:'вес 0, зато свобода',fn(){ bumpRep('firm',2); }}]});
}
function offerRunningMate(){
  const p=presParty();
  S.mateAsked=S.pres.until;
  sheetOpen({eye:'Список · '+dateLabel(),title:'Вас зовут вторым номером',
    body:`<p class="lead">«${p.name}» предлагает вам идти вторым номером на президентских выборах.
        Кресло вице-президента: председательство в Сенате, наследование при вакансии — и полная
        зависимость от того, кто первый.</p>
      <div class="res"><span>Первый номер</span><b class="w">${p.leader}</b>
        <span>До выборов</span><b>${quarters(presLeft())}</b>
        <span>Разница курсов</span><b>${axDist(p.st,me().st).toFixed(1)}</b>
        <span>Ваше кресло сейчас</span><b class="w">${seatName()}</b></div>
      <p class="hint">Согласие не гарантирует победы: выигрывает список, а не человек.</p>`,
    opts:[
      {label:'Согласиться идти вторым',hint:'если список выиграет — вы вице-президент',
       fn(){ S.mateOffer=p.id; addCap(4);
         logMsg('Вы согласились идти вторым номером у «'+p.name+'».',1);
         chron('Вы вошли в чужой президентский список.',''); render(); }},
      {label:'Отказаться',hint:'своя дорога',fn(){ bumpRep('firm',3); }}]});
}
function offerPremier(){
  sheetOpen({eye:'Предложение · '+dateLabel(),title:'Президент зовёт формировать кабинет',
    body:`<p class="lead">${S.pres.name} предлагает вам собрать правительство. Собранию придётся его утвердить,
        и утвердит оно не всякое.</p>
      <div class="res"><span>Мандатов у фракции</span><b>${seatsOf(PL)}</b>
        <span>Нужно большинство</span><b>${MAJ}</b>
        <span>Отношения с президентом</span><b>${Math.round(S.presRel)}</b></div>`,
    opts:[
      {label:'Принять поручение',hint:'кабинет ваш, ответственность тоже',
       fn(){ takePower(); setSeat('pm','Сформирован кабинет.'); render(); }},
      {label:'Отказаться',hint:'пусть отвечают другие',fn(){ bumpRep('firm',2); addCap(-3); }}]});
}

/* ─── праймериз и вызов лидеру ────────────────────────────────────
   Партия выдвигает одного, а желающих двое. */
function askPrimary(){
  if(S.prim){toast('Праймериз уже идут');return;}
  if(!pay({ap:1,cap:PRIM_CAP},'Праймериз'))return;
  const wg=wings();
  const rivalWing=wingMood(wg.left)<wingMood(wg.right)?'left':'right';
  const rivalPool=wg[rivalWing].length?wg[rivalWing]:wg.core;
  const rival=rivalPool.length?pick(rivalPool):null;
  let r={name:rival?rival.name:depName(), wing:rivalWing,
    str:Math.round(clamp(48+(50-wingMood(rivalPool))*0.4+rnd(-8,8),15,85))};
  // отставленный вице помнит обиду и идёт против вас сам
  if(S.exVP&&S.exVP.amb>=55&&S.q-S.exVP.q<16)r={name:S.exVP.name,wing:rivalWing,str:Math.round(clamp(r.str+10,15,90)),exvp:true};
  // не лидер спорит за выдвижение с самим лидером
  if(!chief())r={name:me().leader,wing:'core',str:Math.round(clamp(52+(S.you.lrel<40?6:0)-(S.you.inf-50)*0.3,20,85)),leader:true};
  S.prim={rival:r, q:S.q};
  S.you.primaries=(S.you.primaries||0)+1;
  sheetOpen({eye:'Праймериз · '+dateLabel(),title:'Выдвижение кандидата от партии',
    body:`<p class="lead">Кандидата в президенты партия выдвигает голосованием актива.
        ${r.leader?'Против вас — сам лидер партии '+r.name+': выдвижение он считает своим.':
          r.exvp?'Против вас пошёл '+r.name+' — вице-президент, которого вы отправили в отставку.':
          'Против вас пошёл '+r.name+' — '+WINGNAME[r.wing]+'.'}</p>
      <div class="res"><span>Соперник</span><b class="w">${r.name}</b>
        <span>Его крыло</span><b class="w">${WINGNAME[r.wing]}</b>
        <span>Его сила</span><b class="${r.str>55?'bad':''}">${r.str}</b>
        <span>Ваша известность</span><b>${Math.round(rep('folk'))}</b>
        <span>Одобрение в стране</span><b>${Math.round(approval())}%</b></div>
      <p class="hint">Кампанию внутри партии ведут не деньгами, а обещаниями крылу.</p>`,
    opts:[
      {label:'Идти напрямую',hint:'ставка на имя и дела',fn:()=>runPrimary('plain')},
      {label:'Уступить крылу по курсу',hint:'сдвиг позиции · голоса актива',fn:()=>runPrimary('shift')},
      {label:'Купить актив',hint:'40 млн из кассы · заметят',fn:()=>runPrimary('buy')},
      {label:'Снять кандидатуру',hint:'вернуть вес, потерять лицо',
       fn(){ S.prim=null; addCap(PRIM_CAP-4); bumpRep('firm',-5);
         logMsg('Вы сняли свою кандидатуру с праймериз.',1); render(); }}]});
}
function runPrimary(how){
  const r=S.prim.rival;
  let mine=Math.round(40+(rep('folk')-50)*0.5+(approval()-46)*0.6+seatsOf(PL)*0.06);
  if(how==='shift'){
    const ax=mainAxis(), dir=r.wing==='left'?-1:1;
    me().st[ax]=clamp(r1(me().st[ax]+dir*0.5),-2,2);
    mine+=16; bumpRep('firm',-4);
    logMsg('Ради праймериз курс партии сдвинут по оси «'+AXNAME[ax]+'».');
  }
  if(how==='buy'){
    if(!payFunds(40)){render();return;}
    mine+=20; addTrail(10,'покупка актива на праймериз'); bumpRep('honest',-6);
  }
  if(hasTrait('orator'))mine+=8;
  mine+=ri(-10,10);
  const win=mine>=r.str;
  S.prim=null;
  if(win){
    S.primWin=true; addCap(10); bumpRep('firm',5);
    logMsg('Праймериз выиграны: кандидат от партии — вы ('+mine+' против '+r.str+').',1);
    chron('Вы выиграли партийные праймериз.','g');
  } else {
    S.primWin=false; S.primLost=r.name;
    addCap(-12); bumpRep('firm',-6); shiftAll(-1.5);
    logMsg('Праймериз проиграны: партию на выборах представит '+r.name+'.',1);
    chron('Праймериз проиграны '+r.name+'.','b');
  }
  sheetOpen({eye:'Итог праймериз',title:win?'Кандидат — вы':'Кандидат — не вы',
    body:voteBar(mine,r.str,Math.round((mine+r.str)/2))+
      `<p>${win?'Актив выбрал вас. На президентские выборы партия идёт с вашим именем.'
        :'Актив выбрал '+r.name+'. Партия ваша, но лицо кампании — чужое, и это надолго.'}</p>`,
    acts:[{label:'Дальше'}]});
  render();
}

/* ─── отставка с продолжением игры ────────────────────────────────
   Уйти с поста и остаться в политике — не то же самое, что уйти
   из политики. Второе закрывает счёт, первое только меняет кресло. */
function askResign(){
  const seat=mySeat();
  const opts=[];
  if(seat!=='dep'&&seat!=='none')opts.push({label:'Уйти с поста, остаться в политике',
    hint:'кресло: '+(SEATS_YOU[fallbackSeat()]||{}).name.toLowerCase()+' · игра продолжается',
    fn:()=>stepDown()});
  opts.push({label:'Уйти из политики совсем',hint:'подвести итог сейчас',
    fn:()=>finish(approval()>50,'Вы ушли сами при одобрении '+Math.round(approval())+'% и '+seatsOf(PL)+' мандатах у фракции.')});
  opts.push({label:'Остаться',hint:'работать дальше',fn(){}});
  sheetOpen({eye:'Отставка',title:'Уйти самому?',
    body:`<p class="lead">Отставка с поста и уход из политики — разные вещи. Первое освобождает руки:
        вы теряете кабинет, но сохраняете партию, фракцию и право вернуться. Второе закрывает счёт.</p>
      <div class="res"><span>Кресло сейчас</span><b class="w">${seatName()}</b>
        <span>В нём с</span><b>${shortDate(S.you.seatQ||1)}</b>
        <span>Одобрение</span><b>${Math.round(approval())}%</b>
        <span>Мандатов у фракции</span><b>${seatsOf(PL)}</b></div>`,
    opts});
}
function stepDown(forced){
  const was=mySeat();
  if(was==='pm'){
    S.gov.lead=bigOpp().id; S.gov.coal=[S.gov.lead]; S.gov.posts={};
    S.role='opp'; S.partners={}; syncCabinet(); S.govAge=0;
    setSeat(hasMandate()?'lead':'dep','Кабинет оставлен добровольно.');
  } else if(was==='min'){
    const post=S.you.post;
    if(post){ S.gov.posts[post]=S.gov.lead; S.ministers[post]=makeMinister(post,S.gov.lead); }
    S.you.post=null;
    setSeat(fallbackSeat(),'Портфель сдан.');
  } else if(was==='vice'){ setSeat(fallbackSeat(),'Вице-премьерство сдано.'); }
  else if(was==='vp'){ const party=S.vp?S.vp.party:PL;
    const cand=makeVP(party); S.vp=confirmSenate('vp',cand,party)?cand:null;
    setSeat(fallbackSeat(),'Вице-президентство сдано.'); }
  else if(was==='pres'){
    const vpn=S.vp?S.vp.name:depName();
    closeReign('pres','отставка');
    S.pres={party:S.pres.party,name:vpn,since:S.q,until:S.pres.until,term:S.pres.term,
            vetoes:0,decrees:0,succeeded:true};
    openReign('pres',S.pres.name,S.pres.party);
    setSeat(fallbackSeat(),'Президентство сложено досрочно.');
  }
  else if(was==='gov')setSeat(fallbackSeat(),'Край сдан заместителю.');
  else if(was==='mayor')setSeat(fallbackSeat(),'Город сдан заместителю.');
  else if(was==='sen')setSeat(fallbackSeat(),'Место в Сенате сдано.');
  if(forced){ logMsg('Вы оставили кресло: '+(SEATS_YOU[was]||{}).name.toLowerCase()+'. '+forced,1); render(); return; }
  addCap(-8); bumpRep('firm',-3); bumpRep('honest',4); shiftAll(-1);
  logMsg('Вы оставили кресло: '+(SEATS_YOU[was]||{}).name.toLowerCase()+'.',1);
  chron('Вы ушли с поста добровольно.','');
  sheetOpen({eye:'Отставка',title:'Кресло оставлено',
    body:`<p class="lead">Вы ушли сами. Это редко прощают и никогда не забывают — но и не считают
        поражением так, как считают отставку по чужой воле.</p>
      <div class="res"><span>Было</span><b class="w">${(SEATS_YOU[was]||{}).name}</b>
        <span>Стало</span><b class="w">${seatName()}</b>
        <span>Партия</span><b class="w">${me().name} · ${mandates(seatsOf(PL))}</b></div>
      <p class="hint">Партия и фракция остались вашими. Игра продолжается.</p>`,
    acts:[{label:'Дальше'}]});
  render();
}

/* ═══ ГЕНЕРАТОР СОБЫТИЙ ═══════════════════════════════════════════
   Готовых сюжетов конечное число, и к третьему созыву они кончаются.
   Здесь событие собирается на месте: берётся живой человек с доски,
   подходящий повод и ставка, которая что-то значит именно сейчас.
   Поэтому одно и то же событие никогда не повторяется дважды —
   меняются фамилии, края и цифры. */

/* кого можно вывести на сцену */
function evActors(){
  const a=[];
  S.deputies.filter(d=>d.deals>0||d.rel<32||d.rel>76).slice(0,40).forEach(d=>
    a.push({k:'dep',id:d.id,name:d.name,party:d.party,reg:d.region,
      why:d.deals>1?'слишком часто с вами встречался':d.rel<32?'вас не выносит':'ваш человек'}));
  (S.senate||[]).filter(s=>senElder(s)||s.deals>0).slice(0,20).forEach(s=>
    a.push({k:'sen',id:s.id,name:s.name,party:s.party,reg:s.region,
      why:senElder(s)?'сидит четвёртый срок':'брал у вас'}));
  POSTS.forEach(p=>{ const m=minOf(p.id); if(m)a.push({k:'min',id:p.id,name:m.name,party:m.party,
    why:m.comp<42?'не тянет ведомство':'ведёт '+p.name.toLowerCase()}); });
  REGIONS.forEach(r=>{ const g=govOf(r.id); if(g)a.push({k:'gov',id:r.id,name:g.name,party:g.party,reg:r.id,
    why:g.rel<34?'фрондирует':'держит край'}); });
  FIRMS.forEach(d=>{ const f=firmOf(d.id); if(f&&!f.nat)a.push({k:'firm',id:d.id,name:d.name,party:null,reg:d.reg,
    why:f.given>10?'дала вам денег':f.angry?'на вас злится':'ищет подходы'}); });
  if(S.vp)a.push({k:'vp',id:null,name:S.vp.name,party:S.vp.party,why:'второй номер'});
  if(S.senLead)a.push({k:'lead',id:null,name:S.senLead.name,party:S.senLead.party,why:'ведёт повестку Сената'});
  return a;
}
/* повод берётся из того, что сейчас плохо или слишком хорошо */
function evHooks(){
  const h=[];
  const hot=REGIONS.filter(r=>S.unrest[r.id]>32).sort((a,b)=>S.unrest[b.id]-S.unrest[a.id])[0];
  if(hot)h.push({id:'unrest',w:3,reg:hot.id,txt:'напряжённость в '+R(hot.id).cap});
  if(S.econ.inf>6)h.push({id:'inf',w:3,txt:'цены'});
  if(S.econ.unemp>10)h.push({id:'unemp',w:3,txt:'безработица'});
  if(S.debt>240)h.push({id:'debt',w:2,txt:'долг'});
  if((S.trail||0)>35)h.push({id:'trail',w:3,txt:'ваши сделки'});
  if(captureLevel()>CAP_HIGH)h.push({id:'capture',w:3,txt:'деньги в политике'});
  if(pressTone()<-12)h.push({id:'press',w:2,txt:'тон газет'});
  if(activeDecrees().length)h.push({id:'decree',w:2,txt:'правление указами'});
  const worst=GROUPS.slice().sort((a,b)=>S.mood[a.id]-S.mood[b.id])[0];
  h.push({id:'mood',w:3,grp:worst.id,txt:G(worst.id).name.toLowerCase()});
  if(S.econ.growth>2.4)h.push({id:'boom',w:2,txt:'рост'});
  if(avgUnrest()<14)h.push({id:'calm',w:1,txt:'затишье'});
  h.push({id:'plain',w:2,txt:'обычные дела'});
  return h;
}
/* ставка: что можно потребовать, предложить или отнять */
function evStake(hook,actor){
  const gold=ri(8,26), cap=ri(4,12);
  const pool=[
    {id:'money', txt:'деньги', gold},
    {id:'law',   txt:'закон'},
    {id:'post',  txt:'место'},
    {id:'quiet', txt:'молчание', cap},
    {id:'blame', txt:'виноватый'},
  ];
  if(actor.k==='firm')return pick([pool[0],pool[1],pool[3]]);
  if(actor.k==='min'||actor.k==='gov')return pick([pool[0],pool[2],pool[4]]);
  if(hook.id==='trail'||hook.id==='capture')return pick([pool[3],pool[4]]);
  return pick(pool);
}
/* сборка текста и последствий */
function genEvent(){
  const actors=evActors(); if(!actors.length)return null;
  const hooks=evHooks();
  const bag=[]; hooks.forEach(h=>{for(let i=0;i<h.w;i++)bag.push(h);});
  const hook=pick(bag), actor=pick(actors), stake=evStake(hook,actor);
  const kbag=[]; EV_KIND.forEach(k=>{for(let i=0;i<k.w;i++)kbag.push(k);});
  let kind=pick(kbag);
  if((hook.id==='trail'||hook.id==='capture')&&Math.random()<0.6)kind=EV_KIND[0];
  if(hook.id==='boom'||hook.id==='calm')kind=EV_KIND[3];
  const who=actor.name+(actor.party?' («'+P(actor.party).short+'»)':'');
  const reg=actor.reg?R(actor.reg):(hook.reg?R(hook.reg):pick(REGIONS));
  S.evNo=(S.evNo||0)+1;

  const T1={
    scandal:{eye:'Скандал · '+dateLabel(),
      title:({dep:'Депутат под ударом',sen:'Сенатор под ударом',min:'Министр под ударом',
              gov:'Край под ударом',firm:'Корпорация под ударом',vp:'Второе кресло под ударом',
              lead:'Лидер палаты под ударом'})[actor.k]||'Скандал',
      body:'<p>О '+who+' пишут второй день подряд. Повод — '+hook.txt+
           ', подробности такие, что опровергать их нечем: '+actor.why+'.</p>'},
    demand:{eye:'Требование · '+reg.cap,
      title:'От вас чего-то хотят',
      body:'<p>'+who+' передал через своих, что дальше так продолжаться не может. Речь про '+hook.txt+
           ', и разговор пойдёт не о принципах, а о цене.</p>'},
    crisis:{eye:'Происшествие · '+reg.cap,
      title:'Срочно на стол',
      body:'<p>В '+reg.cap+' случилось то, о чём предупреждали. К вечеру это будет во всех газетах, '+
           'а '+who+' уже даёт объяснения — свои.</p>'},
    chance:{eye:'Возможность · '+dateLabel(),
      title:'Открылось окно',
      body:'<p>'+who+' предлагает то, чего в другой квартал не предложил бы. Причина простая: '+
           hook.txt+', и сейчас это выгодно обоим.</p>'},
    rumor:{eye:'Слух',
      title:'Говорят по кабинетам',
      body:'<p>По коридорам ходит, что '+who+' готовит нечто. Проверить нельзя, не заметить нельзя: '+
           actor.why+'.</p>'},
  }[kind.id];

  const opts=[];
  // ── жёстко: власть решает силой
  opts.push({l:'Ответить жёстко', h:'вес '+(4+Math.round(Math.abs(hook.w||2)))+' · порядок ценой доверия',
    fn(){
      payCap(4+(hook.w||2));
      if(actor.k==='dep'){ const d=S.deputies.find(x=>x.id===actor.id); if(d){d.rel=clamp(d.rel-18,0,100);d.note='получил по рукам';} }
      if(actor.k==='sen'){ const x=S.senate.find(y=>y.id===actor.id); if(x){x.rel=clamp(x.rel-16,0,100);} }
      if(actor.k==='min')reshuffleForce(actor.id,'после скандала');
      if(actor.k==='gov'){ const g=govOf(actor.id); if(g)g.rel=clamp(g.rel-20,0,100); S.unrest[actor.id]=clamp(S.unrest[actor.id]+6,0,100); }
      if(actor.k==='firm'){ const f=firmOf(actor.id); f.rel=clamp(f.rel-18,0,100); f.angry=(f.angry||0)+2; bumpCapture(-6); }
      shiftMood('patr',2.5); shiftMood('intel',-3); shiftMood('urban',-1.5);
      bumpRep('firm',4); bumpRep('honest',1); S.stab=clamp(S.stab+2,0,100);
    }});
  // ── деньгами: всё решается платежом
  if(stake.gold)opts.push({l:'Заплатить · '+stake.gold+' млрд', h:'быстро, тихо и дорого',
    fn(){ if(!payGold(stake.gold))return;
      if(actor.k==='dep'){ const d=S.deputies.find(x=>x.id===actor.id); if(d){d.rel=clamp(d.rel+16,0,100);d.deals++;} }
      if(actor.k==='gov'){ const g=govOf(actor.id); if(g)g.rel=clamp(g.rel+14,0,100); }
      if(reg)S.unrest[reg.id]=clamp(S.unrest[reg.id]-8,0,100);
      addTrail(stake.gold*0.4,'выплата по делу '+actor.name);
      shiftMood(hook.grp||'work',2);
    }});
  // ── уступить: дёшево сейчас, дорого потом
  opts.push({l:'Уступить', h:'сейчас дёшево, потом припомнят',
    fn(){
      if(actor.k==='firm'){ const f=firmOf(actor.id); f.rel=clamp(f.rel+16,0,100); bumpCapture(6);
        S.funds=r1(S.funds+ri(10,26)); }
      if(actor.k==='min'){ const m=minOf(actor.id); if(m)m.comp=clamp(m.comp+ri(3,8),10,95); }
      if(actor.k==='dep'){ const d=S.deputies.find(x=>x.id===actor.id); if(d)d.rel=clamp(d.rel+14,0,100); }
      if(actor.k==='sen'){ const x=S.senate.find(y=>y.id===actor.id); if(x)x.rel=clamp(x.rel+14,0,100); }
      if(actor.k==='lead'&&S.senLead)S.senLead.favour=clamp((S.senLead.favour||0)+10,-40,40);
      if(actor.k==='vp'&&S.vp)S.vp.amb=clamp(S.vp.amb-8,0,100);
      bumpRep('firm',-3); addCap(-2);
      later(ri(3,5),'gaveIn',{who:actor.name});
    }});
  // ── вынести на публику: игра в открытую
  opts.push({l:'Вынести на публику', h:'печать решит за вас',
    fn(){
      const tone=pressTone();
      const good=tone>0?Math.random()<0.66:Math.random()<0.34;
      if(good){ shiftAll(2.2); bumpRep('honest',5); addCap(4);
        head('Власть вынесла спор на свет и выиграла его','g'); }
      else { shiftAll(-2.4); addCap(-5); bumpRep('comp',-3);
        head('Скандал разросся: власть сама вынесла сор из избы','b'); }
      if(actor.k==='firm'){ const f=firmOf(actor.id); f.angry=(f.angry||0)+2; bumpCapture(-4); }
    }});
  // ── ничего не делать: у бездействия тоже есть цена
  opts.push({l:'Не вмешиваться', h:'посмотреть, чем кончится',
    fn(){
      if(hook.reg)S.unrest[hook.reg]=clamp(S.unrest[hook.reg]+7,0,100);
      shiftAll(-0.9);
      later(ri(2,4),'ignored',{who:actor.name,hook:hook.id});
    }});

  return {eye:T1.eye, title:T1.title,
    body:T1.body+`<div class="res"><span>Кто</span><b class="w">${actor.name}</b>
      ${actor.party?`<span>Фракция</span><b class="w">${P(actor.party).name}</b>`:''}
      <span>Повод</span><b class="w">${hook.txt}</b>
      ${reg?`<span>Где</span><b class="w">${reg.name}</b>`:''}
      <span>Чего добиваются</span><b class="w">${stake.txt}</b></div>`,
    opts};
}

/* ═══ КОНСТИТУЦИОННАЯ ПОПРАВКА ════════════════════════════════════
   Проходит не как закон: две трети в обеих палатах, иногда всенародное
   голосование, и никакого вето — здесь палаты выше президента.
   Депутат голосует не о пользе, а о власти, поэтому фракция весит тут
   больше всего остального. */
function cnSupport(d,c,house){
  const own=d.party===PL, coal=inCoal(d.party);
  let v=own?34:coal?15:-30;
  const dl=dealFor(d.party,house==='sen'?'s':'h','c:'+c.id);
  if(dl)v+=52*Math.max(d.loyal,55)/100*dealGrip(dl);   // лидер фракции обещал голоса
  v+=(d.rel-50)*0.3;
  // поправка, выгодная тому, кто её вносит, встречает больше сопротивления
  v+=cnCost(c)*(own||coal?0.25:0.75);
  // где правила и так гнутся, ломать их проще
  v+=(LEGIT0-legit())*0.16;
  if(c.self>0)v+=14;                              // укрепляющую поправку поддержат многие
  if(house==='sen'&&senRank(d)>=4)v-=8;           // старейшина конституцию трогать не любит
  if(house==='sen')v-=4;                          // верхняя палата консервативнее
  v+=(rep('honest')-50)*0.12;
  v+=noise(d.id+'cn'+c.id+S.q,15);
  return v;
}
function cnForecast(c){
  const h=S.deputies.filter(d=>cnSupport(d,c,'low')>0).length;
  const s=S.senate.filter(d=>cnSupport(d,c,'sen')>0).length;
  const nh=cnNeedH(c), ns=cnNeedS(c);
  return {h,s,needH:nh,needS:ns,ok:h>=nh&&s>=ns};
}
function askAmend(){
  if(convSitting()){ convSheet(); return; }
  const list=cnList(), core=cnCoreList();
  if(!list.length&&!core.length){ toast('Все поправки, какие возможны, уже приняты'); return; }
  sheetOpen({eye:'Конституция · '+dateLabel(),title:'Внести поправку',
    body:`<p class="lead">Конституционная поправка проходит две трети Собрания и две трети Сената.
        Президент её не подписывает и не отклоняет: здесь палаты выше него. Часть поправок требует
        всенародного голосования.</p>
      <div class="res"><span>Легитимность строя</span>
        <b class="${legit()<LEGIT_LOW?'bad':legit()>=70?'good':'warn'}">${legit()} · ${legitWord(legit())}</b>
        <span>Поправок принято</span><b>${(CN().log||[]).length}</b>
        <span>Внесение стоит</span><b>вес ${CN_CAP}</b></div>
      <p class="hint">Цена поправки — не вес, а вера в правила. Каждая, выгодная тому, кто её провёл,
        отнимает у страны часть этой веры, и вернуть её труднее, чем рейтинг.
        Главы 1, 2 и 9 — ядро: палаты их не открывают, туда ходит только Конституционное собрание.</p>`,
    opts:list.slice(0,8).map(c=>{
      const f=cnForecast(c), cost=cnCost(c);
      return {label:c.name,
        hint:'гл. '+(c.ch||5)+' · '+c.eff+' · Собрание '+f.h+'/'+f.needH+', Сенат '+f.s+'/'+f.needS+
          (cnNeedRef(c)?', референдум':'')+' · легитимность '+sign(cost),
        fn:()=>askAmendOne(c.id)};
    }).concat(core.length?[{label:'◆ Ядро конституции — созвать собрание',
        hint:plural(core.length,'статья','статьи','статей')+' в главах 1, 2 и 9 · палатам не подведомственны',
        fn:askConvene}]:[])
      .concat([{label:'Не вносить',hint:'закрыть',fn(){}}])});
}
function askAmendOne(id){
  const c=CONSTS.find(x=>x.id===id); if(!c)return;
  if(cnCore(c)){ askConvene(); return; }           // ядро палатам не подведомственно
  if(convSitting()){ convSheet(); return; }
  const f=cnForecast(c), cost=cnCost(c), ref=cnNeedRef(c);
  const gold=ref?CN_GOLD:0, cap=CN_CAP+(ref?CN_REF:0);
  sheetOpen({eye:c.art+' · глава '+(c.ch||5),title:c.name,
    body:`<p class="lead">«${c.txt}»</p>
      <div class="res"><span>Глава</span><b class="w">${(c.ch||5)} · ${cnCh(c).name}</b>
        <span>Что меняется</span><b class="w">${c.eff}</b>
        <span>Собрание</span><b class="${f.h>=f.needH?'good':'bad'}">${f.h} из ${f.needH}</b>
        <span>Сенат</span><b class="${f.s>=f.needS?'good':'bad'}">${f.s} из ${f.needS}</b>
        ${ref?`<span>Всенародное голосование</span><b class="warn">требуется · ${gold} млрд</b>${
          CN().allref&&!c.need.ref?'<span>Основание</span><b>ст. 135: референдум для каждой поправки</b>':''}`:''}
        <span>Цена</span><b>вес ${cap}</b>
        <span>Легитимность</span><b class="${cost<0?'bad':'good'}">${sign(cost)}</b></div>
      <p class="hint">${cost<0
        ? 'Поправка выгодна тому, кто её вносит, и это видно всем. Страна запомнит.'
        : 'Поправка ограничивает власть, а не расширяет её: такие укрепляют доверие к правилам.'}</p>`,
    opts:[
      {label:'Вносить',hint:'вес '+cap+(gold?' и '+gold+' млрд':''),
       fn(){ if(!pay({ap:1},'Поправка «'+c.name+'»'))return;
         if(!payCap(cap)){apBack();return;}
         if(gold&&!payGold(gold)){apBack();addCap(cap);return;}
         amendHouse(c); }},
      {label:'Договориться с лидерами фракций',hint:'сделки добирают голоса до двух третей · '+(dealRoundPaid('c:'+c.id)?'раунд оплачен':'ход на квартал'),
       fn:()=>askDeals({k:'c',id:c.id})},
      {label:'Передумать',hint:'закрыть',fn(){}}]});
}
function amendHouse(c){
  const yes=S.deputies.filter(d=>cnSupport(d,c,'low')>0).length;
  const need=cnNeedH(c), pass=yes>=need;
  S.votes.unshift({no:++S.billNo,q:S.q,name:'Поправка: '+c.name,stance:0,
    yes,no:SEATS-yes,pass,house:'соб'});
  sheetOpen({eye:'Конституционное большинство · Собрание',title:c.name,
    body:`<p class="lead">${c.art}. ${c.eff}.</p>
      ${houseBoard(S.deputies.map(d=>({d,v:cnSupport(d,c,'low')})),yes,SEATS-yes,need,
        {what:'поправка к конституции · '+(need>MAJ+40?'две трети':'три пятых'),
         verdict:pass?'принята Собранием':'отклонена Собранием'})}
      <div class="res"><span>Легитимность сейчас</span><b>${legit()}</b></div>`,
    acts:[{label:pass?'В Сенат':'Закрыть',fn(){ pass?amendSenate(c):amendFail(c,'Собрание'); }}]});
  render();
}
function amendSenate(c){
  const yes=S.senate.filter(d=>cnSupport(d,c,'sen')>0).length;
  const need=cnNeedS(c), pass=yes>=need;
  S.votes.unshift({no:++S.billNo,q:S.q,name:'Поправка: '+c.name,stance:0,
    yes,no:SEN_SEATS-yes,pass,house:'сен'});
  sheetOpen({eye:'Конституционное большинство · Сенат',title:c.name,
    body:`<p class="lead">Палата субъектов голосует по-своему: поправка меняет и её собственный вес.</p>
      ${senBoard(S.senate.map(d=>({d,v:cnSupport(d,c,'sen')})),yes,SEN_SEATS-yes,need,
        {what:'поправка к конституции',verdict:pass?'одобрена Сенатом':'отклонена Сенатом'})}
      <div class="res"><span>Старейшин в палате</span><b>${S.senate.filter(senElder).length}</b></div>`,
    acts:[{label:pass?(cnNeedRef(c)?'На всенародное голосование':'Дальше'):'Закрыть',
      fn(){ if(!pass){amendFail(c,'Сенат');return;}
        cnNeedRef(c)?amendRef(c):amendPass(c,null); }}]});
  render();
}
function amendRef(c){
  // всенародное голосование по поправке: страна судит не о статье, а о власти
  // страна судит поправку по тому, кто её вносит: своекорыстную проводят
  // только популярностью и дружелюбной печатью, и то не всегда
  let yes=52+(approval()-46)*0.9+(rep('folk')-50)*0.3+cnCost(c)*0.45
    +(legit()-LEGIT0)*0.12+pressTone()*0.4+rnd(-7,7);
  yes=r1(clamp(yes,4,96));
  const pass=yes>50;
  sheetOpen({eye:'Всенародное голосование · '+dateLabel(),title:c.name,
    body:`<p class="lead">Поправку вынесли на всенародное голосование. Страна судит не о статье,
        а о том, кто и зачем её вносит.</p>
      ${voteBar(Math.round(yes),Math.round(100-yes),51)}
      <div class="res"><span>За</span><b class="${pass?'good':'bad'}">${yes}%</b>
        <span>Против</span><b>${r1(100-yes)}%</b>
        <span>Одобрение власти</span><b>${Math.round(approval())}%</b>
        <span>Тон печати</span><b>${pressWord(pressTone())}</b></div>
      <div style="text-align:center;margin:12px 0 2px"><span class="stamp ${pass?'y':'n'}">${
        pass?'страна согласилась':'страна отказала'}</span></div>`,
    acts:[{label:'Дальше',fn(){ pass?amendPass(c,yes):amendFail(c,'страна'); }}]});
  render();
}
function amendPass(c,refShare){
  const before=cnSnap();                    // чтобы поправку можно было отменить точь-в-точь
  const presBefore=S.pres?{term:S.pres.term,until:S.pres.until}:null;
  c.apply();
  const cost=cnCost(c);
  S.cn.log.push({id:c.id,name:c.name,art:c.art,eff:c.eff,ch:c.ch||5,q:S.q,by:PL,ref:refShare||0,cost,
    before,presBefore,bought:Math.round(trail()),shield:!!refShare});
  bumpLegit(cost);
  addCap(cost<0?4:10);
  if(cost<0){ shiftMood('intel',cost*0.24); shiftMood('urban',cost*0.14); shiftMood('youth',cost*0.16);
    shiftMood('patr',-cost*0.1); pressAll(cost*0.35); bumpRep('firm',4); bumpRep('honest',cost*0.16); }
  else { shiftAll(1.4); bumpRep('honest',4); pressAll(3); }
  career('Принята конституционная поправка: '+c.name.toLowerCase()+'.');
  logMsg('Конституция изменена: '+c.name.toLowerCase()+' ('+c.eff+').',1);
  chron('Поправка к конституции: '+c.name.toLowerCase()+'.',cost<0?'b':'g');
  cover({ax:'order',stance:cost<0?2:-1,
    good:cost<0?'Конституцию привели в соответствие с жизнью':'Власть сама себя ограничила',
    bad:cost<0?'Основной закон переписан под тех, кто у власти':'Поправка ослабила государство',
    flat:'Принята поправка к конституции: '+c.name.toLowerCase()});
  sheetOpen({eye:'Новая редакция · '+dateLabel(),title:'Конституция изменена',
    body:`<p class="lead">${c.art}. ${c.txt}</p>
      <div class="res"><span>Что теперь</span><b class="w">${c.eff}</b>
        ${refShare?`<span>На голосовании</span><b>${refShare}% за</b>`:''}
        <span>Легитимность</span><b class="${cost<0?'bad':'good'}">${legit()} · ${legitWord(legit())}</b>
        <span>Поправок всего</span><b>${S.cn.log.length}</b></div>
      <p class="hint">${legit()<LEGIT_LOW
        ? 'Вера в правила упала ниже той черты, за которой их перестают считать общими. Дальше — своя цена у каждого решения.'
        : 'Правила изменены по правилам. Пока это ещё что-то значит.'}</p>`,
    acts:[{label:'Принять к сведению'},{label:'К конституции',fn(){S.tab='const';}}]});
  render();
}
function amendFail(c,where){
  addCap(-6); bumpRep('comp',-2);
  logMsg('Поправка «'+c.name.toLowerCase()+'» отклонена: '+where+'.',1);
  chron('Конституционная поправка провалилась.','');
  sheetOpen({eye:'Поправка отклонена',title:c.name,
    body:`<p>Не хватило конституционного большинства: остановил ${where}. Ту же поправку можно внести
      снова, но зал запоминает, кто её предлагал.</p>`,
    acts:[{label:'Закрыть'}]});
  render();
}

/* отмена поправки: возвращается ровно то, что она меняла */
function revokeAmend(entry,why){
  if(!entry)return false;
  const i=(S.cn.log||[]).indexOf(entry);
  if(i<0)return false;
  if(entry.before)CN_FIELDS.forEach(k=>{ if(entry.before[k]!==undefined)S.cn[k]=entry.before[k]; });
  if(entry.presBefore&&S.pres){ S.pres.term=entry.presBefore.term; S.pres.until=entry.presBefore.until; }
  S.cn.log.splice(i,1);
  bumpLegit(Math.abs(entry.cost)*0.7);
  logMsg('Поправка «'+entry.name.toLowerCase()+'» отменена '+(why||'')+'. Прежняя редакция восстановлена.',1);
  chron('Отменена поправка: '+entry.name.toLowerCase()+'.','g');
  return true;
}


/* ═══ КОНСТИТУЦИОННОЕ СОБРАНИЕ ════════════════════════════════════
   К ядру конституции палаты не допущены. Основы строя, права и сам
   порядок пересмотра меняет только собрание, избранное страной на
   один вопрос. Оно созывается тремя пятыми обеих палат, работает
   ${CONV_LEN} квартала и решает простым большинством своих двухсот
   делегатов. Плата за этот путь не в весе и не в деньгах: собрание
   может приписать к вашему пакету собственный пункт, и снять его
   вы уже не сможете. */
function askConvene(){
  if(convOn()){ convSheet(); return; }
  const f=convCallForecast(), core=cnCoreList();
  sheetOpen({eye:'Конституционное собрание · '+dateLabel(),title:'Созвать собрание?',
    body:`<p class="lead">Главы 1, 2 и 9 — ядро конституции: основы строя, права человека и сам
        порядок пересмотра. Никакое большинство палат их не открывает. Открыть может только
        Конституционное собрание — ${CONV_SEATS} делегатов, избранных страной специально для этого.</p>
      <div class="res"><span>Собрание</span><b class="${f.h>=f.needH?'good':'bad'}">${f.h} из ${f.needH}</b>
        <span>Сенат</span><b class="${f.s>=f.needS?'good':'bad'}">${f.s} из ${f.needS}</b>
        <span>Цена созыва</span><b>вес ${CONV_CAP} и ${CONV_GOLD} млрд</b>
        <span>Работает</span><b>${quarters(CONV_LEN)}</b>
        <span>В ядре открыто</span><b>${plural(core.length,'статья','статьи','статей')}</b></div>
      <p class="hint">Пока собрание заседает, обычные поправки не вносятся: палаты не трогают
        конституцию, пока её переписывает страна. Делегат голосует не за фракцию, а за устройство,
        и своекорыстный пакет здесь встречают злее, чем в Собрании.</p>`,
    opts:[
      {label:'Ставить вопрос о созыве',hint:'вес '+CONV_CAP+' и '+CONV_GOLD+' млрд',
       fn(){ if(!pay({ap:1},'Созыв Конституционного собрания'))return;
         if(!payCap(CONV_CAP)){apBack();return;}
         if(!payGold(CONV_GOLD)){apBack();addCap(CONV_CAP);return;}
         convCallVote(); }},
      {label:'Не созывать',hint:'закрыть',fn(){}}]});
}
function convCallVote(){
  const f=convCallForecast();
  const okH=f.h>=f.needH, okS=f.s>=f.needS, pass=okH&&okS;
  S.votes.unshift({no:++S.billNo,q:S.q,name:'О созыве Конституционного собрания',stance:0,
    yes:f.h,no:SEATS-f.h,pass:okH,house:'соб'});
  sheetOpen({eye:'Три пятых обеих палат',title:'О созыве Конституционного собрания',
    body:`<p class="lead">Вопрос о созыве не поправка: палаты не меняют ни одной статьи, они лишь
        решают, пускать ли к конституции кого-то кроме себя.</p>
      ${houseBoard(S.deputies.map(d=>({d,v:convCallSupport(d,'low')})),f.h,SEATS-f.h,f.needH,
        {what:'о созыве · три пятых',verdict:okH?'Собрание за созыв':'Собрание против созыва'})}
      ${senBoard(S.senate.map(d=>({d,v:convCallSupport(d,'sen')})),f.s,SEN_SEATS-f.s,f.needS,
        {what:'о созыве · три пятых',R:170,verdict:okS?'Сенат за созыв':'Сенат против созыва'})}
      <div class="res"><span>Легитимность</span><b>${legit()} · ${legitWord(legit())}</b>
        <span>Итог</span><b class="w ${pass?'good':'bad'}">${
        pass?'собрание созывается':okH?'Сенат не дал трёх пятых':'Собрание не дало трёх пятых'}</b></div>`,
    acts:[{label:pass?'К выборам делегатов':'Закрыть',
      fn(){ if(pass)convCampaign(); else{
        addCap(-5); bumpRep('comp',-2);
        logMsg('Созыв Конституционного собрания отклонён палатами.',1);
        chron('Палаты отказались созывать Конституционное собрание.','');
        render(); } }}]});
  render();
}
/* кампания среди делегатов: деньги двигают список, но не переписывают страну */
function convCampaign(){
  sheetOpen({eye:'Выборы делегатов · '+CONV_SEATS+' мандатов',title:'Вести кампанию?',
    body:`<p class="lead">Делегатов избирают списком по всей стране, а не по округам. Расклад ближе
        к настроению страны, чем к раскладу палат: то, что прощают вам в Собрании, здесь считают
        отдельно.</p>
      <div class="res"><span>Одобрение власти</span><b>${Math.round(approval())}%</b>
        <span>Тон печати</span><b>${pressWord(pressTone())}</b>
        <span>Кампания стоит</span><b>${CONV_CAMP} млрд</b>
        <span>Большинство собрания</span><b>${CONV_MAJ} из ${CONV_SEATS}</b></div>`,
    opts:[
      {label:'Вести кампанию',hint:CONV_CAMP+' млрд · список сдвинется к вам',
       fn(){ if(!payGold(CONV_CAMP)){convOpen(0);return;} bumpRep('folk',2); convOpen(0.22); }},
      {label:'Положиться на страну',hint:'как есть',fn(){ convOpen(0); }}]});
}
function convOpen(camp){
  const seats=convElect(camp);
  S.conv={stage:'sit', since:S.q, until:S.q+CONV_LEN, seats, camp,
          pkg:[], own:null, res:null, ref:0};
  const order=S.parties.slice().sort((a,b)=>(seats[b.id]||0)-(seats[a.id]||0));
  const rows=order.map(p=>`<tr><td>${chip(p)}${p.id===PL?' <span class="tag y">вы</span>':''}</td>
    <td class="n">${seats[p.id]||0}</td>
    <td style="width:110px">${bar([[(seats[p.id]||0)/CONV_SEATS*100,p.color]],7)}</td></tr>`).join('');
  const mine=convCoalSeats();
  logMsg('Избрано Конституционное собрание: '+CONV_SEATS+' делегатов, у коалиции '+mine+'.',1);
  chron('Созвано Конституционное собрание.',mine>=CONV_MAJ?'g':'b');
  career('Созвано Конституционное собрание.');
  bumpLegit(-3);
  sheetOpen({eye:'Конституционное собрание · '+dateLabel(),title:'Делегаты избраны',
    body:`<table class="tight"><thead><tr><th>Партия</th><th class="r">Делегатов</th><th></th></tr></thead>
        <tbody>${rows}</tbody></table>
      <div class="res"><span>У вас и союзников</span><b class="${mine>=CONV_MAJ?'good':'bad'}">${mine} из ${CONV_SEATS}</b>
        <span>Нужно для пункта</span><b>${CONV_MAJ}</b>
        <span>Собрание работает до</span><b>${dateLabel(S.conv.until)}</b></div>
      <p class="hint">Внесите пакет — до ${CONV_PKG} пунктов, любых, включая ядро. Собрание проголосует
        по каждому отдельно. И учтите: оно вправе приписать к пакету свой пункт, а снять его нельзя.</p>`,
    acts:[{label:'Внести пакет',fn:askConvPackage},{label:'Позже',fn(){S.tab='const';}}]});
  render();
}
/* пакет: до трёх пунктов, любых — ядро и обычные главы вперемешку */
function askConvPackage(){
  const cv=conv();
  if(!cv||cv.stage!=='sit'){ toast('Собрание не заседает'); return; }
  // ядро идёт первым: ради него собрание и созывали, обычные главы — следом
  const list=CONSTS.filter(cnOpen).sort((a,b)=>(cnCore(b)?1:0)-(cnCore(a)?1:0));
  const draw=()=>{
    const chosen=cv.pkg.map(id=>cnAny(id)).filter(Boolean);
    const body=`<p class="lead">Пакет — до ${CONV_PKG} пунктов. Собрание голосует по каждому
        простым большинством: ${CONV_MAJ} из ${CONV_SEATS}. Ядро проходит только здесь.</p>
      ${chosen.length?'<div class="res">'+chosen.map((c,i)=>{
        const t=convTally(c,i);
        return `<span>${i+1}. ${c.name}</span><b class="${t.pass?'good':'bad'}">${t.yes} из ${CONV_MAJ}</b>`;
      }).join('')+'</div>':'<p class="hint">Пока в пакете пусто.</p>'}
      <div class="res"><span>У коалиции делегатов</span><b>${convCoalSeats()} из ${CONV_SEATS}</b>
        <span>Собрание работает до</span><b>${dateLabel(cv.until)}</b></div>`;
    const full=cv.pkg.length>=CONV_PKG;
    const opts=full?[]:list.filter(c=>cv.pkg.indexOf(c.id)<0).slice(0,11).map(c=>{
      const t=convTally(c,cv.pkg.length), co=cnCost(c);
      return {label:(cnCore(c)?'◆ ':'')+c.name,
        hint:'гл. '+(c.ch||5)+' · '+c.eff+' · '+t.yes+' из '+CONV_MAJ+' · легитимность '+sign(co),
        fn(){ cv.pkg.push(c.id); mopen=false; mq.length=0; draw(); }};
    });
    // лист с вариантами не показывает нижних кнопок, поэтому действия стоят в самом списке
    if(cv.pkg.length){
      opts.push({label:'Ставить пакет на голосование',
        hint:plural(cv.pkg.length,'пункт','пункта','пунктов')+' · обратного хода не будет',
        fn:convRun});
      opts.push({label:'Убрать последний пункт',hint:'«'+cnAny(cv.pkg[cv.pkg.length-1]).name+'»',
        fn(){ cv.pkg.pop(); mopen=false; mq.length=0; draw(); }});
    }
    opts.push({label:'Закрыть',hint:'вернуться к пакету позже',fn(){}});
    sheetOpen({eye:'Пакет · '+cv.pkg.length+' из '+CONV_PKG,title:'Что вынести на собрание',
      body,opts});
  };
  draw();
}
/* голосование собрания: сначала своя воля палаты, потом пункт за пунктом */
function convRun(){
  const cv=conv(); if(!cv||!cv.pkg.length)return;
  cv.own=convOwnPick(cv.pkg);
  const items=cv.pkg.slice();
  if(cv.own)items.push(cv.own);
  const res=items.map((id,i)=>{ const c=cnAny(id), t=convTally(c,i);
    return {id,c,yes:t.yes,no:t.no,pass:t.pass,own:id===cv.own}; });
  cv.res=res;
  const anyPass=res.some(x=>x.pass), core=res.some(x=>x.pass&&cnCore(x.c));
  const rows=res.map((x,i)=>`<tr${x.own?' class="mine"':''}>
      <td><b>${x.c.name}</b>${x.own?' <span class="tag">от собрания</span>':''}
        <div class="sub2">гл. ${x.c.ch||5} · ${x.c.eff}</div></td>
      <td class="n ${x.pass?'good':'bad'}">${x.yes}</td>
      <td style="width:100px">${bar([[x.yes/CONV_SEATS*100,x.pass?'var(--good)':'var(--bad)']],7)}</td>
      <td class="n"><span class="stamp ${x.pass?'y':'n'}">${x.pass?'принят':'отклонён'}</span></td></tr>`).join('');
  sheetOpen({eye:'Голосование собрания · '+dateLabel(),title:cv.own?'Собрание дописало пакет':'Собрание проголосовало',
    body:(cv.own?`<p class="lead">Делегаты внесли в пакет пункт, которого там не было: «${cnAny(cv.own).name}».
        Снять его нельзя — собрание принадлежит стране, а не тому, кто его созвал.</p>`
       :`<p class="lead">Собрание проголосовало по пакету, пункт за пунктом. Большинство — ${CONV_MAJ} из ${CONV_SEATS}.</p>`)
      +`<table class="tight"><tbody>${rows}</tbody></table>
      <div class="res"><span>Принято пунктов</span><b>${res.filter(x=>x.pass).length} из ${res.length}</b>
        <span>Из них в ядре</span><b>${res.filter(x=>x.pass&&cnCore(x.c)).length}</b>
        <span>Дальше</span><b class="w">${!anyPass?'роспуск ни с чем':core?'всенародное голосование':'вступает в силу'}</b></div>`,
    acts:[{label:'Дальше',fn(){ !anyPass?convDissolve('ни один пункт не прошёл'):core?convRef():convAdopt(0); }}]});
  render();
}
/* новая редакция ядра утверждается страной одним вопросом */
function convRef(){
  const cv=conv(), passed=cv.res.filter(x=>x.pass);
  const greed=passed.reduce((a,x)=>a+cnCost(x.c),0);
  let yes=53+(approval()-46)*0.8+(rep('folk')-50)*0.34+greed*0.4
    +(legit()-LEGIT0)*0.14+pressTone()*0.45+(cv.camp?4:0)+rnd(-7,7);
  yes=r1(clamp(yes,4,96));
  const pass=yes>50;
  cv.ref=yes;
  sheetOpen({eye:'Всенародное голосование · '+dateLabel(),title:'Новая редакция конституции',
    body:`<p class="lead">Пакет вынесен на страну одним вопросом: либо вся новая редакция, либо ничего.
        Голосуют не по статьям — голосуют по тому, кто их написал.</p>
      ${voteBar(Math.round(yes),Math.round(100-yes),51)}
      <div class="res"><span>За</span><b class="${pass?'good':'bad'}">${yes}%</b>
        <span>Против</span><b>${r1(100-yes)}%</b>
        <span>Пунктов в редакции</span><b>${passed.length}</b>
        <span>Одобрение власти</span><b>${Math.round(approval())}%</b></div>
      <div style="text-align:center;margin:12px 0 2px"><span class="stamp ${pass?'y':'n'}">${
        pass?'страна приняла новую редакцию':'страна отказала'}</span></div>`,
    acts:[{label:'Дальше',fn(){ pass?convAdopt(yes):convDissolve('страна не утвердила редакцию'); }}]});
  render();
}
function convAdopt(refShare){
  const cv=conv(), passed=cv.res.filter(x=>x.pass);
  let total=0;
  passed.forEach(x=>{
    const c=x.c;
    if(!cnOpen(c))return;                       // пункт мог обессмыслиться предыдущим
    const before=cnSnap();
    const presBefore=S.pres?{term:S.pres.term,until:S.pres.until}:null;
    c.apply();
    const cost=cnCost(c); total+=cost;
    S.cn.log.push({id:c.id,name:c.name,art:c.art,eff:c.eff,ch:c.ch||5,q:S.q,by:PL,
      ref:refShare||0,cost,before,presBefore,bought:Math.round(trail()),
      conv:true,own:!!x.own,shield:true});
  });
  bumpLegit(total*0.8+(refShare?6:0));
  addCap(total<0?6:12);
  if(total<0){ shiftMood('intel',total*0.2); shiftMood('urban',total*0.12); pressAll(total*0.3);
    bumpRep('firm',5); }
  else { shiftAll(1.6); bumpRep('honest',5); pressAll(3); }
  const names=passed.map(x=>x.c.name.toLowerCase()).join('; ');
  logMsg('Конституционное собрание приняло новую редакцию: '+names+'.',1);
  chron('Новая редакция конституции: '+plural(passed.length,'пункт','пункта','пунктов')+'.',total<0?'b':'g');
  career('Проведена новая редакция конституции через Конституционное собрание.');
  cover({ax:'order',stance:total<0?2:-1,
    good:total<0?'Страна получила конституцию, соответствующую времени':'Основной закон стал строже к власти',
    bad:total<0?'Конституцию переписали под действующую власть':'Новая редакция ослабила государство',
    flat:'Конституционное собрание приняло новую редакцию основного закона'});
  const rows=passed.map(x=>`<tr><td><b>${x.c.name}</b>${x.own?' <span class="tag">от собрания</span>':''}
      <div class="sub2">${x.c.art} · ${x.c.eff}</div></td>
    <td class="n dim">гл. ${x.c.ch||5}</td></tr>`).join('');
  S.conv={stage:'done',since:cv.since,until:S.q,seats:cv.seats,pkg:cv.pkg,own:cv.own,res:cv.res,ref:refShare||0};
  sheetOpen({eye:'Новая редакция · '+dateLabel(),title:'Конституция переписана',
    body:`<table class="tight"><tbody>${rows}</tbody></table>
      <div class="res">${refShare?`<span>На голосовании</span><b>${refShare}% за</b>`:''}
        <span>Легитимность</span><b class="${total<0?'bad':'good'}">${legit()} · ${legitWord(legit())}</b>
        <span>Поправок всего</span><b>${(CN().log||[]).length}</b></div>
      <p class="hint">${refShare
        ? 'Редакцию утвердила страна: суд её не тронет, и отменить её сможет только новое собрание.'
        : 'Редакция принята собранием и вступила в силу без всенародного голосования. Это запомнят.'}</p>`,
    acts:[{label:'Принять к сведению'},{label:'К конституции',fn(){S.tab='const';}}]});
  render();
}
function convDissolve(why){
  const cv=conv();
  bumpLegit(CONV_FAIL); addCap(-8); bumpRep('comp',-4); shiftAll(-1.2);
  logMsg('Конституционное собрание распущено: '+why+'.',1);
  chron('Конституционное собрание разошлось ни с чем.','b');
  S.conv={stage:'done',since:cv?cv.since:S.q,until:S.q,seats:cv?cv.seats:{},
          pkg:cv?cv.pkg:[],own:cv?cv.own:null,res:cv?cv.res:null,ref:cv?cv.ref:0,failed:true};
  sheetOpen({eye:'Конституционное собрание',title:'Собрание разошлось',
    body:`<p class="lead">${why.charAt(0).toUpperCase()+why.slice(1)}. Делегаты разъехались,
        конституция осталась прежней, а страна запомнила, что её звали переписывать основной закон — и зря.</p>
      <div class="res"><span>Легитимность</span><b class="bad">${legit()} · ${legitWord(legit())}</b>
        <span>Потеряно</span><b class="bad">${CONV_FAIL}</b></div>
      <p class="hint">Созвать новое собрание можно, но палаты дадут три пятых нескоро.</p>`,
    acts:[{label:'Закрыть'}]});
  render();
}
/* собрание заседает: срок идёт сам, пакет можно внести до последнего квартала */
function convTick(){
  const cv=conv(); if(!cv||cv.stage!=='sit')return;
  if(S.q>=cv.until){
    if(cv.pkg.length)convRun(); else convDissolve('пакет так и не был внесён');
  }
}
/* краткая сводка по идущему собранию */
function convSheet(){
  const cv=conv(); if(!cv)return;
  const order=S.parties.slice().sort((a,b)=>(cv.seats[b.id]||0)-(cv.seats[a.id]||0));
  sheetOpen({eye:'Конституционное собрание · заседает',title:'Делегаты на месте',
    body:`<p class="lead">Собрание работает до ${dateLabel(cv.until)}. Пока оно заседает, палаты
        конституцию не трогают.</p>
      <table class="tight"><tbody>${order.map(p=>`<tr><td>${chip(p)}</td>
        <td class="n">${cv.seats[p.id]||0}</td></tr>`).join('')}</tbody></table>
      <div class="res"><span>У коалиции</span><b>${convCoalSeats()} из ${CONV_SEATS}</b>
        <span>В пакете</span><b>${cv.pkg.length} из ${CONV_PKG}</b>
        <span>Осталось</span><b>${quarters(convLeft())}</b></div>`,
    acts:[{label:'Внести пакет',fn:askConvPackage},{label:'Закрыть'}]});
}

/* ─── судебный контроль поправки ─────────────────────────────────
   Суд не трогает то, что утвердила страна, и не трогает редакцию
   собрания. Всё остальное он вправе проверить в первые ${CN_REVIEW}
   кварталов — и отменить, если сочтёт, что поправку писали под себя. */
function cnReviewTick(){
  if(!S.court||!S.court.length)return;
  const pool=(CN().log||[]).filter(cnReviewable);
  if(!pool.length)return;
  const e=pool[pool.length-1];
  if(e.seen)return;
  if(Math.random()>0.16)return;
  e.seen=S.q;
  const n=cnStrikeVotes(e);
  const strike=n>=courtMaj();
  if(strike){
    const was=e.name;
    revokeAmend(e,'решением Конституционного суда');
    bumpLegit(5); bumpRep('honest',3); shiftMood('intel',3);
    chron('Суд отменил поправку к конституции.','g');
    sheetOpen({eye:'Конституционный суд · '+dateLabel(),title:'Поправка отменена судом',
      body:`<p class="lead">Суд признал поправку «${was.toLowerCase()}» принятой в нарушение основ
          конституционного строя: изменить правила в свою пользу нельзя тем же большинством,
          которое от них выигрывает.</p>
        ${voteBar(n,courtN()-n,courtMaj())}
        <div class="res"><span>За отмену</span><b class="bad">${n} из ${courtN()}</b>
          <span>Нужно было</span><b>${courtMaj()}</b>
          <span>Легитимность</span><b class="good">${legit()} · ${legitWord(legit())}</b></div>
        <p class="hint">Прежняя редакция статьи восстановлена дословно. Ту же поправку можно провести
          снова — через всенародное голосование или через Конституционное собрание: их суд не отменяет.</p>`,
      acts:[{label:'Принять к сведению'},{label:'К конституции',fn(){S.tab='const';}}]});
  } else {
    logMsg('Суд рассмотрел поправку «'+e.name.toLowerCase()+'» и нарушения не нашёл: за отмену '+n+' из '+courtN()+'.');
  }
}

/* ─── легитимность и конституционный кризис ──────────────────────
   Легитимность не спасает от поражения на выборах — без неё
   перестают работать сами выборы. */
function constTick(){
  if(!S.cn)S.cn=cnDefault();
  const l=legit();
  S.legitLow=l<LEGIT_LOW;
  // вера в правила восстанавливается сама, но медленно и не до конца
  if(l<70)bumpLegit(0.34); else if(l>92)bumpLegit(-0.1);
  // бюджетное правило: записанный в конституции предел долга и нарушают по-конституционному
  const over=debtOver();
  if(over){ bumpLegit(-clamp(over*0.006,0.15,1.4));
    if(Math.random()<0.1)logMsg('Долг превысил конституционный предел на '+Math.round(over)+' млрд.',1); }
  if(l<LEGIT_LOW){
    const k=(LEGIT_LOW-l)/100;
    REGIONS.forEach(r=>S.unrest[r.id]=clamp(S.unrest[r.id]+k*2.6,0,100));
    shiftMood('intel',-k*4); shiftMood('urban',-k*2.4);
    if(S.nb)Object.values(S.nb).forEach(n=>n.rel=clamp(n.rel-k*1.6,0,100));
  }
  if(emergOn()&&Math.random()<0.3){ bumpLegit(-1.2); shiftMood('intel',-1.4); }
  convTick(); cnReviewTick();
  if(l<LEGIT_CR&&Math.random()<0.16)constCrisis();
}
function constCrisis(){
  const r=REGIONS.slice().sort((a,b)=>S.unrest[b.id]-S.unrest[a.id])[0];
  bumpLegit(-3);
  logMsg('Конституционный кризис: '+R(r.id).name+' отказывается исполнять решения центра.',1);
  chron('Конституционный кризис.','b');
  sheetOpen({eye:'Конституционный кризис',title:'Правила перестали работать',
    body:`<p class="lead">Легитимность строя упала до ${legit()}. ${R(r.id).name} объявил,
        что не будет исполнять решения, принятые «с нарушением духа конституции». За ним смотрят остальные.</p>
      <div class="res"><span>Легитимность</span><b class="bad">${legit()} · ${legitWord(legit())}</b>
        <span>Поправок принято</span><b>${(CN().log||[]).length}</b>
        <span>Напряжённость в крае</span><b class="bad">${Math.round(S.unrest[r.id])}</b>
        <span>Средняя по стране</span><b>${Math.round(avgUnrest())}</b></div>`,
    opts:[
      {label:'Ввести прямое управление',hint:'вес 14 · порядок сейчас, счёт потом',
       fn(){ if(!payCap(14))return;
         S.unrest[r.id]=clamp(S.unrest[r.id]-16,0,100); bumpLegit(-5);
         shiftMood('patr',3); shiftMood('intel',-5); shiftMood('urban',-3);
         const g=govOf(r.id); if(g)g.rel=clamp(g.rel-20,0,100);
         logMsg('В '+R(r.id).name+' введено прямое управление.',1); }},
      {label:'Созвать круглый стол',hint:'22 млрд и уступки · медленно и честно',
       fn(){ if(!payGold(22))return;
         S.unrest[r.id]=clamp(S.unrest[r.id]-10,0,100); bumpLegit(6);
         S.rmod[r.id]=clamp(S.rmod[r.id]+3,-22,22);
         bumpRep('honest',4); shiftMood('intel',3);
         logMsg('Круглый стол с '+R(r.id).name+': кризис приглушён уступками.',1); }},
      {label:'Отменить спорную поправку',hint:'если есть что отменять',
       fn(){ const last=(CN().log||[]).slice().reverse().find(x=>x.cost<0);
         if(!last){ toast('Отменять нечего'); return; }
         revokeAmend(last,'под давлением кризиса');
         shiftAll(2); bumpRep('honest',6); }},
      {label:'Не отступать',hint:'кризис продолжится',
       fn(){ bumpLegit(-4); REGIONS.forEach(x=>S.unrest[x.id]=clamp(S.unrest[x.id]+4,0,100)); }}]});
}

