/* ════════════════════════════════════════════════════════════════
   Ядро: состояние, экономика, настроения, парламент.
   ════════════════════════════════════════════════════════════════ */

let S = null;
const rnd  = (a,b)=>a+Math.random()*(b-a);
const ri   = (a,b)=>Math.round(rnd(a,b));
const pick = a=>a[Math.floor(Math.random()*a.length)];
const clamp= (v,a,b)=>v<a?a:v>b?b:v;
const r1   = v=>Math.round(v*10)/10;
const r2   = v=>Math.round(v*100)/100;
const sign = v=>(v>0?'+':'')+v;

/* устойчивый шум: один и тот же депутат по одному и тому же вопросу
   думает одинаково, пока не изменились обстоятельства */
function hash(str){ let h=2166136261;
  for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619);}
  return ((h>>>0)%10000)/10000; }
const noise = (str,amp)=>(hash(str)-0.5)*2*amp;

/* ─── партии ─────────────────────────────────────────────────── */
const PL = 'you';
function parties(){ return S.parties; }
function P(id){ return S.parties.find(p=>p.id===id); }
function me(){ return P(PL); }
/* кабинет ваш, только если партия его ведёт и партию ведёте вы:
   при чужом лидере правительство вашей партии — не ваше */
function isPM(){ return S.gov.lead===PL && chief(); }
function chief(){ return !S.you || S.you.chief!==false; }
/* жёсткая страна: выбирается перед игрой в настройках и живёт в сохранении */
function hard(){ return !!(S&&S.diff==='hard'); }
function coalition(){ return S.gov.coal; }
function inCoal(id){ return S.gov.coal.indexOf(id)>=0; }

/* ─── президент ──────────────────────────────────────────────────
   Избирается всей страной и на свой срок, поэтому редко совпадает
   с большинством Собрания. Игрок может занять это кресло — тогда
   у него две головы власти сразу. */
function pres(){ return S.pres; }
function isPres(){ return !!S.pres && S.pres.party===PL && (!S.you || S.you.seat==='pres'); }
/* президент из вашей партии, но не вы: подпишет своё, указов за вас не издаст */
function presOurs(){ return !!S.pres && S.pres.party===PL; }
function presParty(){ return S.pres?P(S.pres.party):null; }
function presLeft(){ return Math.max(0,S.pres.until-S.q); }
/* насколько президенту чужд курс правительства */
function presGap(){
  const p=presParty(); if(!p)return 0;
  return axDist(p.st, isPM()?me().st:P(S.gov.lead).st);
}

/* ─── вице-президент ─────────────────────────────────────────────
   Кресло без ведомства: вице ничего не решает ровно до того дня,
   когда решает всё. Полномочий у него три — председательствовать
   в Сенате и разбивать равенство, вести порученное дело и
   наследовать кресло, если президент его освобождает.
   Человека описывают три числа: палата (умение работать с
   сенаторами), имя (известность в стране) и честолюбие. Первые
   два работают на вас, третье — против, если его не занять. */
function vp(){ return S.vp; }
function isVP(){ return S.vp && S.vp.party===PL; }
function vpParty(){ return S.vp?P(S.vp.party):null; }
function vpKind(){ return S.vp?VP_KIND.find(k=>k.id===S.vp.kind)||VP_KIND[4]:null; }
function vpJob(){ return S.vp?VP_JOBS.find(j=>j.id===(S.vp.job||'none'))||VP_JOBS[4]:null; }
/* умение вести палату: от него зависит и убеждение при почти-равенстве,
   и то, насколько поручение «работа с Сенатом» вообще что-то даёт */
function vpSkill(){ return S.vp?clamp(S.vp.sen||40,0,100):0; }
/* насколько близкий к равенству счёт председатель ещё может развернуть:
   сильный вице уговаривает двоих, слабый не спасает и равенства */
function vpMargin(){
  if(!S.vp)return 0;
  const b=S.vp.job==='senate'?1:0;
  return vpSkill()>=80?2+b:vpSkill()>=58?1+b:0;
}
/* как вице-президент проголосует при равенстве: за своих, против чужих */
function vpBreak(bill){
  if(!S.vp)return 0;
  const p=vpParty(), d=Math.abs((p.st[T(bill.topic).ax]||0)-bill.stance);
  return d<1.6?1:-1;
}
/* честолюбие растёт, пока вице нечем занять, и падает от настоящего дела */
function vpRestless(){
  if(!S.vp)return false;
  return (S.vp.amb||0)>=VP_AMB && (S.vp.job||'none')==='none';
}

/* ─── премьер и кабинет ──────────────────────────────────────────
   Премьер — человек, а не партия: у него имя, срок и своя молва.
   Министры тоже люди: компетентность министра усиливает или гасит
   эффект его ведомства. */
function pm(){ return S.pm; }
function isPMperson(){ return S.pm && S.pm.party===PL; }
function minOf(post){ return S.ministers?S.ministers[post]:null; }
/* насколько ведомство работает лучше или хуже обычного */
function minPower(post){
  const m=minOf(post); if(!m)return 0;
  // доля, а не разы: даже блестящий министр правит ведомство на десятую часть
  let v=(m.comp-50)*0.0035;
  if(m.party===PL)v+=0.025; else if(inCoal(m.party))v+=0.012;
  if(S.q-m.since>MIN_TERM)v-=0.03;          // засидевшийся министр выдыхается
  return r2(clamp(v,-0.13,0.15));
}
function cabinetPower(){
  return r2(POSTS.reduce((a,p)=>a+minPower(p.id),0)/POSTS.length);
}
function minWord(m){ return m.comp>=72?'сильный':m.comp>=56?'крепкий':m.comp>=40?'средний':'слабый'; }

/* ─── личность политика ──────────────────────────────────────────
   Черта характера не пишет текст, а меняет число в уже работающем
   механизме: цену действия, скорость износа, силу голоса. */
function you(){ return S.you; }
function hasTrait(id){ return !!(S.you&&S.you.traits&&S.you.traits.indexOf(id)>=0); }
function origin(){ return S.you?OR(S.you.origin):null; }
function rep(k){ return S.you&&S.you.rep?S.you.rep[k]||50:50; }
function bumpRep(k,v){
  if(!S.you||!S.you.rep)return;
  if(k==='honest'&&v>0&&hasTrait('clean'))v*=2;
  S.you.rep[k]=clamp(r1(S.you.rep[k]+v),0,100);
}
/* скидка на политический вес: аппаратчик работает с залом дешевле */
function capCost(base,kind){
  let v=base;
  if(kind==='lobby'&&hasTrait('apparat'))v-=3;
  if(kind==='talk'&&hasTrait('dealer'))v-=2;
  if(kind==='visit'&&hasTrait('zemsky'))v-=2;
  if(kind==='veto'&&hasTrait('jurist'))v-=4;
  return Math.max(1,Math.round(v));
}
/* возраст: политик стареет, и после определённой черты это видно */
function ageOf(){ return S.you?S.you.age:50; }
function agePenalty(){ return Math.max(0,(ageOf()-64)*0.55); }

/* ─── губернаторы ────────────────────────────────────────────────
   Закон о местном самоуправлении решает, кто ставит глав субъектов:
   при автономии их выбирает регион, при вертикали назначает кабинет. */
function govElected(){ const l=lawOn('local'); return !!(l&&l.stance>0); }
function govOf(rid){ return S.govs?S.govs[rid]:null; }
/* насколько глава помогает или мешает вам в своём субъекте */
function govEffect(rid){
  const g=govOf(rid); if(!g)return 0;
  let v=(g.comp-50)*0.032+(g.rel-50)*0.026;
  if(g.party===PL)v+=1.4; else if(inCoal(g.party))v+=0.8;
  return r1(clamp(v,-5,5));
}
function govLoyal(g){ return g.rel>=66?'опора':g.rel>=52?'работает':g.rel>=36?'сам по себе':g.rel>=20?'фрондирует':'враждебен'; }

/* ─── пресса ─────────────────────────────────────────────────────
   Издание не выносит решений, но решает, как страна узнает о ваших.
   Тон прессы умножает любой сдвиг настроения: при дружелюбной печати
   успех слышен вдвое, при враждебной — тонет. */
function pressOf(id){ return S.press?S.press.o[id]:null; }
/* доверие к печати зависит от закона о ней: под надзором пишут что велено,
   но им перестают верить, и множитель слабеет в обе стороны */
function pressFree(){ const l=lawOn('press'); return l?l.stance:0; }
function pressTrust(){ return clamp(0.62+pressFree()*0.13,0.3,0.95); }
function pressTone(){
  if(!S.press)return 0;
  let s=0,w=0;
  PRESS.forEach(o=>{ const st=pressOf(o.id); if(!st)return;
    s+=(st.rel-50)*o.reach; w+=o.reach; });
  return r1(clamp(s/(w||1)*pressTrust(),-40,40));
}
/* во сколько раз печать усиливает сдвиг настроения */
function pressMul(v){
  const t=pressTone()/100;
  return v>0 ? 1+t*0.9 : 1-t*0.9;
}
function pressWord(v){ return v>=18?'на вашей стороне':v>=6?'скорее доброжелательна':v>-6?'нейтральна':v>-18?'придирается':'травит'; }
/* один шаг сразу по всем изданиям: так отзывается то, что нельзя
   объяснить одной редакции отдельно — вроде поправки к регламенту */
function pressAll(v){
  if(!S.press)return;
  PRESS.forEach(o=>{ const st=pressOf(o.id); if(st)st.rel=clamp(st.rel+v,0,100); });
}
/* как издание относится к конкретному решению */
function pressView(o,ax,stance){
  const d=Math.abs((o.st[ax]||0)-stance);
  return d<1?1:d<2?0:-1;
}

/* ─── конституционный суд ────────────────────────────────────────
   Девять судей, назначенных разными президентами в разные годы.
   Суд смотрит не на политику, а на то, как далеко зашёл закон. */
function courtMedian(ax){
  const v=S.court.map(j=>j.st[ax]||0).sort((a,b)=>a-b);
  return v[Math.floor(v.length/2)]||0;
}
/* независимость суда: закон о судебной реформе решает, слушают ли там власть */
function courtFree(){ const l=lawOn('court'); return l?l.stance:0; }
function courtSeats(pid){ return S.court.filter(j=>j.by===pid).length; }
/* сколько судей сочтут закон выходящим за рамки */
function courtStrike(law){
  const t=T(law.topic); if(!t)return 0;
  let n=0;
  S.court.forEach(j=>{
    let v=Math.abs((j.st[t.ax]||0)-law.stance)*7;      // чем дальше от судьи, тем хуже
    v+=Math.abs(law.stance)*4;                          // крайние редакции сами по себе подозрительны
    if(law.decree)v+=16;                                // указ обходит палаты — это отдельная претензия
    if(rightsLock()&&t.ax==='free'&&law.stance<0)v+=10; // глава 2: ограничивать права больше нельзя
    v+=courtFree()*5;                                   // независимый суд смелее
    if(j.by===S.gov.lead)v-=9;                          // назначенный этой властью снисходительнее
    if(j.by===(S.pres?S.pres.party:null))v-=6;
    v+=noise(j.id+'|'+law.topic+law.stance+law.q,7);
    if(v>18)n++;
  });
  return n;
}

/* ─── надзор ─────────────────────────────────────────────────────
   След копится от каждой сделки. Прокуратура его когда-нибудь
   заметит — тем скорее, чем она независимее. */
function trail(){ return S.trail||0; }
function addTrail(v,who){
  S.trail=clamp((S.trail||0)+v,0,TRAIL_MAX);
  if(who)S.trailLog.unshift({q:S.q,t:who,v:r1(v)});
  if(S.trailLog.length>40)S.trailLog.pop();
}
/* независимость прокуратуры: антикоррупционный закон плюс суд */
function prosFree(){
  const l=lawOn('graft');
  return clamp(0.5+(l?l.stance:0)*0.18+courtFree()*0.08-(S.prosHit>S.q?0.3:0),0.1,1.1);   // новый генпрокурор послушнее
}
function probeRisk(){
  // неприкосновенность депутата: дело возбуждается только с согласия палаты
  const imm=regOn('immunity')&&hasMandate()?0.5:1;
  return clamp(trail()/100*prosFree()*0.42*imm,0,0.5);
}
function trailWord(){ const v=trail();
  return v<15?'чисто':v<35?'есть о чём спросить':v<58?'папка растёт':v<80?'дело на выходе':'вопрос времени'; }

/* ─── партия изнутри ─────────────────────────────────────────────
   Своя фракция не монолит: депутаты стоят левее и правее лидера,
   и когда линия уезжает, крыло начинает роптать. */
function mainAxis(){
  // ось, по которой фракция расходится сильнее всего
  let best=AX[0],bv=-1;
  AX.forEach(a=>{
    const mine=S.deputies.filter(d=>d.party===PL);
    if(!mine.length)return;
    const m=mine.reduce((s,d)=>s+d.st[a],0)/mine.length;
    const v=mine.reduce((s,d)=>s+Math.abs(d.st[a]-m),0)/mine.length;
    if(v>bv){bv=v;best=a;}
  });
  return best;
}
/* Порог крыла считается от фактического разброса фракции, а не задан
   числом: за созывы позиции разъезжаются, и жёсткая граница то съедала
   бы крылья целиком, то записывала в них половину зала. */
function wingGap(ax){
  const mine=S.deputies.filter(d=>d.party===PL);
  if(!mine.length)return 0.42;
  const base=me().st[ax]||0;
  const m=mine.reduce((s,d)=>s+Math.abs(d.st[ax]-base),0)/mine.length;
  return clamp(m*1.15,0.25,1.2);
}
function wingOf(d,ax,gap){
  const g=gap===undefined?wingGap(ax):gap;
  const v=d.st[ax]-(me().st[ax]||0);
  return v<-g?'left':v>g?'right':'core';
}
function wings(){
  const ax=mainAxis(), gap=wingGap(ax), out={left:[],core:[],right:[]};
  S.deputies.filter(d=>d.party===PL).forEach(d=>out[wingOf(d,ax,gap)].push(d));
  return {ax,gap:r2(gap),...out};
}
function wingMood(list){
  if(!list.length)return 50;
  return Math.round(list.reduce((s,d)=>s+d.rel,0)/list.length);
}
const WINGNAME={left:'левое крыло',core:'ядро',right:'правое крыло'};

/* ─── распределение мандатов по действующему закону ──────────────
   Метод и барьер задаёт избирательный закон, а не константа. */
function allocate(shares,n){
  const sys=voteSys(), keys=Object.keys(shares);
  const tot=keys.reduce((a,k)=>a+shares[k],0)||1;
  const ok=keys.filter(k=>shares[k]/tot*100>=sys.thr);
  const use=ok.length?ok:keys;                       // барьер не должен обнулить палату
  const out={}; keys.forEach(k=>out[k]=0);
  for(let i=0;i<n;i++){
    let best=null,bv=-1;
    use.forEach(k=>{
      const div=sys.method==='sainte'?(2*out[k]+1):(out[k]+1);
      const v=shares[k]/div;
      if(v>bv){bv=v;best=k;}
    });
    out[best]++;
  }
  return out;
}

/* ─── соседи ─────────────────────────────────────────────────────
   Внешний спрос и цены на сырьё больше не случайны: их держат
   отношения с четырьмя государствами по периметру. */
function nbOf(id){ return S.nb?S.nb[id]:null; }
function nbWord(v){ return v>=70?'союз':v>=54?'добрососедство':v>=38?'сдержанно':v>=22?'холодно':'вражда'; }
function nbTrade(){
  let s=0,w=0;
  NEIGHBOURS.forEach(x=>{ const st=nbOf(x.id); if(!st)return;
    s+=(st.rel-50)*x.trade; w+=x.trade; });
  return r1(s/(w||1));
}
/* враждебный сосед греет приграничные края */
function nbPressure(rid){
  let v=0;
  NEIGHBOURS.forEach(x=>{ const st=nbOf(x.id); if(!st)return;
    if(x.border.indexOf(rid)<0)return;
    if(st.rel<38)v+=(38-st.rel)*0.05*x.power;
  });
  return r1(v);
}

/* ─── расстояние по осям ─────────────────────────────────────── */
function axDist(a,b,w){
  let s=0,tw=0;
  AX.forEach(k=>{ const ww=w?w[k]:1; s+=Math.abs((a[k]||0)-(b[k]||0))*ww; tw+=ww; });
  return s/tw;                               // 0…4
}
/* насколько группе нравится набор позиций: 100 — идеально */
function fitOf(g,st){ return clamp(100-axDist(g.pref,st,g.w)*34,2,100); }

/* ─── стартовое состояние ────────────────────────────────────── */
function initState(pl){
  REGIONS.forEach(r=>{ const s=Object.values(r.mix).reduce((a,b)=>a+b,0);
    r.share={}; GROUPS.forEach(g=>r.share[g.id]=(r.mix[g.id]||0)/s); });

  const player={id:PL,name:pl.name,short:pl.short,color:pl.color,st:{...pl.st},leader:pl.leader,
                emb:pl.emb?{...pl.emb}:null,
                base:[],funds:pl.funds!==undefined?pl.funds:60,mom:0};
  S={
    q:1, term:1, termStart:1, over:false, ended:null,
    parties:[player,...AIPARTIES.map(p=>({...p,st:{...p.st},funds:ri(40,90),mom:0}))],
    ap:3, cap:52, funds:60,
    treasury:45, debt:130,
    tax:{inc:2,corp:2,vat:2},
    spend:{def:2,pol:2,med:2,edu:2,soc:2,inf:2},
    econ:{gdp:100,gdp0:100,growth:1.2,inf:4.2,unemp:8.1,invest:100},
    cyc:{ph:Math.random(),len:ri(13,19)},      // фаза хозяйственного цикла
    world:{demand:100,res:100},                // внешний спрос и цены на сырьё
    comm:{}, rec:0,                            // комитеты и длина спада
    stab:58,
    mood:{}, rmod:{}, unrest:{},
    deputies:[], seats:{}, regSeats:{},
    senate:[], senSeats:{}, senCls:0,        // вторая палата и номер переизбираемого класса
    senRules:null, senLead:null, senHold:null, mate:null,   // регламент, лидер, повестка, напарник
    commHold:null, amend:null, inq:null, imp:null,          // комитет, поправки, комиссия, импичмент
    firms:null, capture:8, gifts:[],                        // корпорации, захват и память о деньгах
    cn:null, rulers:null, legitLow:false,                   // конституция и архив правителей
    offers:[], evNo:0,                                      // предложения карьеры и счётчик событий
    pres:null, vp:null, presRel:58, vetoed:null, decrees:[], presRace:null,
    pm:null, ministers:{},                   // премьер и министры — люди, а не партии
    you:{name:pl.leader, age:pl.age||48, origin:pl.origin||'province', traits:pl.traits||[],
         rep:{honest:50,firm:50,comp:50,folk:50}, career:[], seat:'dep', seatQ:1, primaries:0,
         chief:true, inf:70, lrel:60, home:null},
    desk:null,                               // стол кресла: край, город, ведомство
    govs:{}, govLog:[],                      // главы субъектов и их смена
    press:null, court:[], nb:{},             // печать, суд, соседи
    trail:0, trailLog:[], probe:null,        // след от сделок и текущее дело
    challenge:null, ref:null,                // вызов лидерству и референдум
    gov:{lead:PL,coal:[PL],posts:{}},
    partners:{},                       // терпение союзников
    pacts:{}, reg:{}, motion:null, crisis:null, split:{}, apLog:[],   // процедуры палаты
    bill:null, billNo:0, laws:[], votes:[],
    pending:[], log:[], chron:[], hist:[],
    poll:0, camp:null, tab:'brief', sel:null, filter:'all',
    ev:{seen:[],cool:0}, shockCool:0, role:'pm', noConfCool:0, moodShock:{}, fatigue:0, govAge:0,
    promises:[], termGdp:100, termLaws:0, snaps:0,          // обещания и досрочные выборы
    budget:{submitted:false,fails:0}, lastBudget:null,      // годовой бюджет
  };
  GROUPS.forEach(g=>S.mood[g.id]=clamp(fitOf(g,player.st)*0.5+20+rnd(-4,4),20,70));
  REGIONS.forEach(r=>{ S.rmod[r.id]=r1((r.dev-2)*1.5+rnd(-3,3)); S.unrest[r.id]=ri(6,18); });
  // происхождение уже разошлось по стране до вашего первого решения
  const or0=OR(S.you.origin);
  if(or0){
    Object.entries(or0.mood||{}).forEach(([g,v])=>S.mood[g]=clamp(S.mood[g]+v,2,98));
    Object.entries(or0.rep||{}).forEach(([k,v])=>S.you.rep[k]=clamp(50+v,0,100));
  }
  career('Партия «'+player.name+'» создана. Начало политического пути.');
  const role=SR((pl.start&&pl.start.role)||'pm')||START_ROLES[0];

  apportion();
  seedParliament(role.gov==='lead'?1.10:1.02);    // премия действующей власти — тому, кто власть
  seedSenate();
  seedPresident();
  seedGovernors();
  seedPress();
  seedCourt();
  seedNeighbours();
  seedFirms();
  S.cn=cnDefault(); if(!S.rulers)S.rulers={pres:[],pm:[]};
  formCoalition(true);
  startRole(role,pl.start||{});
  seatCommittees(); flSync(); S.deals=[]; S.scandals=[]; S.bizLog=[];
  seedCabinet();
  startDesk(role,pl.start||{});
  snapshot();
  logMsg('Правительство сформировано. Собрание созвано на '+dateLabel()+'.',1);
  chron(role.gov==='lead'?'«'+player.name+'» формирует правительство.'
    :'«'+player.name+'» '+(role.gov==='junior'?'входит в правительство младшим партнёром.':'начинает созыв в оппозиции.'),'g');
}

/* места по субъектам — метод наибольших остатков */
function apportion(){
  const tot=REGIONS.reduce((a,r)=>a+r.pop,0), q={}, rem=[];
  let used=0;
  REGIONS.forEach(r=>{ const ex=r.pop/tot*SEATS, n=Math.max(2,Math.floor(ex)); q[r.id]=n; used+=n;
    rem.push([r.id,ex-Math.floor(ex)]); });
  rem.sort((a,b)=>b[1]-a[1]);
  for(let i=0;used<SEATS;i++,used++) q[rem[i%rem.length][0]]++;
  S.regSeats=q;
}

/* доли голосов из «привлекательности»: мягкий степенной перевод,
   иначе мелкие фракции вымирают за один цикл */
function shareFrom(score){
  const out={},k=Object.keys(score);let sum=0;
  k.forEach(x=>{ out[x]=Math.pow(Math.max(score[x]-24,0.6),1.35); sum+=out[x]; });
  k.forEach(x=>out[x]=out[x]/sum*100);
  return out;
}

/* Мандаты распределяются по действующему избирательному закону,
   а не по вшитой формуле: имя оставлено прежним, чтобы все места
   подсчёта — Собрание, Сенат, губернаторы — сменили правило разом. */
function dhondt(shares,n){ return allocate(shares,n); }

/* В двух палатах 535 человек: имена держим в наборе, иначе поиск
   двойника по списку становится дороже самой генерации созыва. */
let nameBook=null;
function nameReset(){
  nameBook=new Set();
  (S.deputies||[]).forEach(d=>nameBook.add(d.name));
  (S.senate||[]).forEach(d=>nameBook.add(d.name));
}
function depName(){
  if(!nameBook)nameReset();
  for(let i=0;i<60;i++){
    const f=Math.random()<0.34;
    const n=f?pick(NAME_F)+' '+pick(SURN_F):pick(NAME_M)+' '+pick(SURN_M);
    if(!nameBook.has(n)){ nameBook.add(n); return n; }
  }
  const n=pick(NAME_M)+' '+pick(SURN_M)+'-'+pick(SURN_M);   // на самый крайний случай
  nameBook.add(n); return n;
}
function makeDep(party,region,i){
  const p=P(party), st={};
  AX.forEach(k=>st[k]=clamp(r1((p.st[k]||0)+rnd(-0.7,0.7)),-2,2));
  return {id:party+'-'+region+'-'+i, name:depName(), party, region, st,
    loyal:ri(46,93), integ:ri(18,92), rel:clamp(Math.round(60-axDist(st,me().st)*11+rnd(-8,8)),8,92),
    deals:0, note:''};
}

/* идеологическая привлекательность партии в субъекте — общая основа
   и для первого созыва, и для довыборов в Сенат */
function seedShare(r,bonus){
  const sh={};
  S.parties.forEach(p=>{
    let v=0; GROUPS.forEach(g=>v+=r.share[g.id]*fitOf(g,p.st));
    if(p.id===PL)v*=(bonus||1);
    sh[p.id]=v;
  });
  return shareFrom(sh);
}
/* первый созыв: голоса считаются по чистой идеологии */
function seedParliament(bonus){
  S.deputies=[]; nameReset();
  const tot={}; S.parties.forEach(p=>tot[p.id]=0);
  REGIONS.forEach(r=>{
    const seats=dhondt(seedShare(r,bonus||1.10),S.regSeats[r.id]);   // премия действующей власти
    Object.entries(seats).forEach(([pid,n])=>{
      tot[pid]+=n;
      for(let i=0;i<n;i++)S.deputies.push(makeDep(pid,r.id,i));
    });
  });
  S.seats=tot;
}
function seatsOf(id){ return S.seats[id]||0; }
function coalSeats(){ return coalition().reduce((a,id)=>a+seatsOf(id),0); }

/* ─── Сенат ──────────────────────────────────────────────────────
   Сто мест по населению субъектов. Сенатор сидит дольше депутата,
   меньше слушает фракцию и больше — свой субъект: переизбирают его
   не вместе со всеми, а своим классом раз в два года. */
function makeSen(party,region,cls,i){
  const p=P(party), st={};
  AX.forEach(k=>st[k]=clamp(r1((p.st[k]||0)+rnd(-0.95,0.95)),-2,2));
  return {id:'s-'+party+'-'+region+'-'+i+'-'+cls, name:depName(), party, region, cls, st,
    loyal:ri(34,80), integ:ri(24,95), rel:clamp(Math.round(60-axDist(st,me().st)*10+rnd(-9,9)),8,92),
    since:S.q, terms:1, deals:0, note:''};
}
function seedSenate(){
  S.senate=[];
  const tot={}; S.parties.forEach(p=>tot[p.id]=0);
  REGIONS.forEach(r=>{
    const seats=dhondt(seedShare(r,1.04),r.sen);
    let k=0;
    Object.entries(seats).forEach(([pid,n])=>{
      tot[pid]+=n;
      for(let i=0;i<n;i++,k++){
        const s=makeSen(pid,r.id,k%3,i);
        s.terms=ri(1,4);                       // палата не начинается с чистого листа
        s.since=S.q-(s.terms-1)*senCyc();
        S.senate.push(s);
      }
    });
  });
  S.senSeats=tot; S.senCls=0;
  S.senRules={cloture:CLOTURE, nuked:false, nukedBy:null, nukedQ:0};
  seatSenLeader(true);
}
function senSeatsOf(id){ return S.senSeats[id]||0; }
function senCoalSeats(){ return coalition().reduce((a,id)=>a+senSeatsOf(id),0); }
function senDue(){ return S.q>1 && (S.q-1)%senCyc()===0; }

/* ─── регламент палаты ───────────────────────────────────────────
   Порог клотура — не константа, а состояние: его можно опустить,
   но опущенный он остаётся опущенным и для тех, кто придёт после. */
function cloture(){ return (S.senRules&&S.senRules.cloture)||CLOTURE; }
function nuked(){ return !!(S.senRules&&S.senRules.nuked); }
/* регламент меняют простым большинством — но для этого нужны и палата,
   и председатель: без своего вице поправку к регламенту не поставят */
function canNuke(){ return senCoalSeats()>=NUKE_MIN && isVP() && !nuked() && !CN().entrench; }

/* ─── старшинство ────────────────────────────────────────────────
   В палате, где треть меняется раз в два года, стаж — валюта.
   Старейшина тянет за собой земляков и первым получает комитет. */
function senRank(s){ return s.terms||1; }
function senElder(s){ return senRank(s)>=4; }
/* земляки прислушиваются к старейшине своей делегации */
function senDean(region){
  const here=S.senate.filter(s=>s.region===region);
  if(!here.length)return null;
  return here.slice().sort((a,b)=>senRank(b)-senRank(a)||a.id.localeCompare(b.id))[0];
}

/* ─── лидер сенатского большинства ───────────────────────────────
   Председательствует вице-президент, но повестку ведёт лидер
   крупнейшей фракции. Чужой лидер не отклоняет закон — он просто
   не ставит его в календарь, и это дороже отклонения. */
function senLeadParty(){
  let best=null,bv=-1;
  S.parties.forEach(p=>{ const n=senSeatsOf(p.id); if(n>bv){bv=n;best=p.id;} });
  return best;
}
function senLead(){ return S.senLead; }
function senLeadPerson(){
  if(!S.senLead)return null;
  return S.senate.find(s=>s.id===S.senLead.id)||null;
}
function isSenLead(){ return !!(S.senLead&&S.senLead.party===PL); }
function senFriendlyLead(){ return !!(S.senLead&&(S.senLead.party===PL||inCoal(S.senLead.party))); }
/* лидером становится самый заслуженный сенатор крупнейшей фракции */
function seatSenLeader(quiet){
  const pid=senLeadParty();
  const pool=S.senate.filter(s=>s.party===pid&&!s.you);    // вас лидером большинства жребий не назначает
  if(!pool.length){ S.senLead=null; return; }
  const who=pool.slice().sort((a,b)=>
    (senRank(b)*10+b.loyal*0.2)-(senRank(a)*10+a.loyal*0.2)||a.id.localeCompare(b.id))[0];
  const was=S.senLead;
  if(was&&was.id===who.id&&was.party===pid)return;
  S.senLead={id:who.id, name:who.name, party:pid, since:S.q, deals:0, favour:0};
  if(!quiet){
    logMsg('Лидером сенатского большинства стал '+who.name+' («'+P(pid).name+'»).',1);
    chron('Сенат возглавил '+who.name+'.',pid===PL?'g':'');
  }
}
/* насколько лидер расположен вести ваш проект: фракция плюс личные услуги */
function leadFavour(){
  if(!S.senLead)return 60;
  const base=S.senLead.party===PL?92:inCoal(S.senLead.party)?74:26;
  return clamp(Math.round(base+(S.senLead.favour||0)),0,100);
}

/* Сенатор голосует иначе, чем депутат: фракция весит вдвое меньше,
   зато интерес субъекта и личное отношение — вдвое больше. */
function senSupport(sen,bill){
  const t=T(bill.topic), ax=t.ax;
  if(sen.you)return (bill.by||PL)===PL?60:(1.1-Math.abs((me().st[ax]||0)-bill.stance))*30;   // ваш голос
  let v=(0.95-Math.abs(sen.st[ax]-bill.stance))*24;
  // фракция весит меньше, чем в Собрании, но не настолько, чтобы палата
  // стала непроходимой: разницу добирают коалиционная дисциплина и округ
  v+=leaderLine(sen.party,bill,'s')*sen.loyal*0.27;
  const sd=dealBillLine(sen.party,'s',bill); if(sd)v+=10*dealGrip(sd);        // лидер сенаторов держит своих
  if(S.senBoost>=S.q&&(bill.by||PL)===PL)v+=3;                               // лидер большинства поставил проект первым
  v+=(sen.rel-50)*0.34;
  // избранный прямым голосованием сенатор слушает список, а не заксобрание края:
  // фракция прибавляет в весе, интерес субъекта — теряет
  const rk=senDirect()?0.35:1;
  if(senDirect())v+=leaderLine(sen.party,bill,'s')*sen.loyal*0.3;
  if(bill.riders&&bill.riders.indexOf('money')>=0) v+=(sen.region===bill.regTarget?22:-3.5)*rk;
  if(inCoal(sen.party))v+=11;
  // палата субъектов: всё, что бьёт по регионам, здесь встречают жёстче
  if(t.ax==='reg') v+=bill.stance*(R(sen.region).dev<3?5:-3)*rk;
  if(senDirect())v+=(sen.rel-50)*-0.12;      // личные связи с краем слабеют
  if(t.local&&bill.stance>0&&R(sen.region).capital)v-=7*rk;
  const mine=(bill.by||PL)===PL;
  if(mine&&!inCoal(sen.party))v-=7;
  if(!mine&&sen.party===PL)v-=7;
  if(mine&&hasTrait('jurist'))v+=4;
  // старейшина делегации задаёт тон землякам: в палате субъектов
  // возражение человека, сидящего здесь двадцать лет, весит отдельно
  const dean=senDean(sen.region);
  if(dean&&dean.id!==sen.id){
    const dv=(0.95-Math.abs(dean.st[ax]-bill.stance))*24+(dean.rel-50)*0.3;
    v+=clamp(dv,-24,24)*0.14*Math.min(senRank(dean),5)/5;
  }
  // председатель, занятый палатой, подтягивает своих
  if(S.vp&&S.vp.job==='senate'&&(sen.party===S.vp.party||inCoal(sen.party)))
    v+=vpSkill()*0.06;
  v+=noise(sen.id+'|'+bill.topic+bill.stance+(bill.riders||[]).join('')+S.billNo,9);
  return v;
}
function senTally(bill){
  const t={yes:0,no:0,und:0,list:[]};
  S.senate.forEach(d=>{ const v=senSupport(d,bill), st=v>10?'yes':v<-10?'no':'und';
    t[st]++; t.list.push({d,v,st}); });
  return t;
}
/* Сколько голосов реально ляжет за проект: колеблющиеся падают
   в ту сторону, куда их клонит, а обещанное на прениях учитывается. */
function senCount(bill,tl){
  const t=tl||senTally(bill); let yes=0,no=0;
  t.list.forEach(x=>{
    const pl=(x.d.spledge&&x.d.spledgeNo===bill.id)?x.d.spledge:0;
    const v=x.v+pl;
    if(v>10)yes++; else if(v<-10)no++;
    else (Math.random()<0.5+v/30?yes++:no++);
  });
  return {yes,no};
}
/* Обструкция: считается не большинство, а те, кто готов её прекратить.
   Меньшинство, у которого больше сорока твёрдых «против», держит
   трибуну до тех пор, пока за клотур не наберётся шестьдесят. */
function clotureCount(bill,tl){ return clotureList(bill,tl).filter(x=>x.v>0).length; }
/* оценка каждого сенатора на процедуре: нужна и счёту, и табло */
function clotureList(bill,tl){
  const t=tl||senTally(bill), out=[];
  const by=bill.by||PL;
  t.list.forEach(x=>{
    const pl=(x.d.spledge&&x.d.spledgeNo===bill.id)?x.d.spledge:0;
    // На процедуре фракция весит вдвое больше, чем на существе: вопрос
    // «дать ли им победу» проще вопроса «хорош ли закон», и партийная
    // линия держится здесь крепче всего.
    const own=x.d.party===by||inCoal(x.d.party)||(typeof dealBillLine==='function'&&!!dealBillLine(x.d.party,'s',bill));
    let v=x.v*0.65+pl+(own?24:-18)+(x.d.rel-50)*0.2;
    if(senRank(x.d)>=4)v+=6;                       // старейшины берегут обычаи палаты
    if(S.vp&&S.vp.job==='senate'&&own)v+=vpSkill()*0.05;
    out.push({d:x.d,v});
  });
  return out;
}
function willFilibuster(bill,tl){
  if(cloture()<=SEN_MAJ)return false;              // регламент уже опущен
  const n=clotureCount(bill,tl);
  return n<cloture();
}
/* Медиана палаты по оси проекта — то, на чём согласительная комиссия
   сойдётся, если её созвать. */
function senMedian(ax){
  if(!S.senate.length)return 0;
  const v=S.senate.map(s=>s.st[ax]||0).sort((a,b)=>a-b);
  const m=v.length%2?v[(v.length-1)/2]:(v[v.length/2-1]+v[v.length/2])/2;
  return r1(m);
}
function resolveSenVote(bill){
  const t=senTally(bill);
  let {yes,no}=senCount(bill,t);
  // сто мест — значит равенство возможно, и его разбивает председатель палаты
  let tie=0, talked=0;
  if(VP_TIE&&S.vp){
    const m=vpMargin(), gap=no-yes;
    // председатель с именем в палате разворачивает не только равенство,
    // но и счёт, проигранный на голос-другой, — уговором в кулуарах
    if(gap>0&&gap<=m&&vpBreak(bill)>0){ talked=gap; yes+=gap; no-=gap; }
    if(yes===no){ tie=vpBreak(bill); if(tie>0)yes++; else no++; S.vp.ties=(S.vp.ties||0)+1; }
  }
  return {yes,no,pass:yes>=SEN_MAJ,tie,talked,cl:clotureCount(bill,t),need:cloture()};
}

/* ─── главы субъектов ────────────────────────────────────────────
   Одиннадцать своих правителей со своими сроками. Компетентный и
   лояльный гасит напряжённость и тянет за собой округ на выборах;
   враждебный делает ровно обратное, и снять его можно не всегда. */
function makeGov(rid,party){
  const p=P(party);
  const or0=origin();
  let rel=Math.round(58-axDist(p.st,me().st)*11+rnd(-9,9));
  if(or0&&or0.id==='province')rel+=6;
  if(hasTrait('zemsky'))rel+=7;
  return {region:rid, party, name:depName(), comp:ri(28,88),
    rel:clamp(rel,6,94), since:S.q, till:S.q+ri(3,GOV_TERM), deals:0,
    appointed:!govElected()};        // как край достался: назначением или выбором
}
/* жребий по долям: сильная партия чаще берёт край, но не всегда —
   иначе все одиннадцать глав оказались бы вашими с первого квартала */
function drawByShare(sh){
  const k=Object.keys(sh);
  let sum=k.reduce((a,x)=>a+Math.max(0,sh[x]),0), t=Math.random()*sum;
  for(const x of k){ t-=Math.max(0,sh[x]); if(t<=0)return x; }
  return k[0];
}
function seedGovernors(){
  S.govs={};
  REGIONS.forEach(r=>{ S.govs[r.id]=makeGov(r.id,drawByShare(seedShare(r,1.0))); });
}
function govCoalCount(){ return REGIONS.filter(r=>{const g=govOf(r.id); return g&&(g.party===PL||inCoal(g.party));}).length; }

/* ─── посев печати, суда и соседей ───────────────────────────── */
function seedPress(){
  S.press={o:{},heads:[]};
  PRESS.forEach(o=>{
    S.press.o[o.id]={id:o.id, rel:clamp(Math.round(56-axDist(o.st,me().st)*12+rnd(-8,8)),8,92),
      hits:0, banned:false};
  });
}
function makeJudge(by,q){
  const p=P(by)||me(), st={};
  AX.forEach(k=>st[k]=clamp(r1((p.st[k]||0)*0.7+rnd(-0.7,0.7)),-2,2));
  return {id:'j'+q+'-'+by+'-'+Math.round(Math.random()*1e6).toString(36),
    name:depName(), by, st, since:q, until:q+judgeLife()};
}
function seedCourt(){
  S.court=[];
  // суд собирался десятилетиями: судьи разных лет и разных назначателей
  const pool=S.parties.map(p=>p.id);
  for(let i=0;i<COURT_SIZE;i++){
    const by=pick(pool), age=ri(2,judgeLife()-6);
    const j=makeJudge(by,S.q-age); j.until=S.q-age+judgeLife();
    S.court.push(j);
  }
}
function seedNeighbours(){
  S.nb={};
  NEIGHBOURS.forEach(x=>{
    S.nb[x.id]={id:x.id, rel:clamp(Math.round(54-axDist(x.st,me().st)*11+rnd(-7,7)),10,90),
      treaty:false, since:S.q};
  });
}

/* ─── карьера ────────────────────────────────────────────────────
   Летопись пишет историю страны, карьера — историю человека. */
function career(t){
  if(!S.you)return;
  S.you.career.push({q:S.q, y:2029+Math.floor((S.q-1)/4), t});
  if(S.you.career.length>140)S.you.career.shift();
}

/* ─── президент ──────────────────────────────────────────────────
   На старте кресло занимает лидер ближайшей к вам партии: это он
   поручил вам собрать правительство. Его срок истекает раньше, чем
   ваш созыв, — первые президентские выборы придутся на середину. */
function seedPresident(){
  const near=S.parties.filter(p=>p.id!==PL).sort((a,b)=>axDist(a.st,me().st)-axDist(b.st,me().st))[0];
  S.pres={party:near.id, name:near.leader, since:S.q-11, until:S.q+12, term:1, vetoes:0, decrees:0};
  S.presRel=clamp(Math.round(72-axDist(near.st,me().st)*11),25,88);
  seatVP(near.id);
  if(!S.rulers)S.rulers={pres:[],pm:[]};
  openReign('pres',S.pres.name,S.pres.party);
}
/* вице-президент всегда из партии президента: они шли одним списком.
   Кем именно он окажется — решает жребий, если список не ваш; ваш
   список вы составляете сами, и тогда сюда приходит готовый напарник. */
function makeVP(party,kind,region){
  const k=VP_KIND.find(x=>x.id===kind)||pick(VP_KIND);
  const r=region||pick(REGIONS).id;
  return {party, name:depName(), kind:k.id, region:r,
    sen:ri(k.sen[0],k.sen[1]), pop:ri(k.pop[0],k.pop[1]), amb:ri(k.amb[0],k.amb[1]),
    job:'none', since:S.q, ties:0, jobQ:S.q, dropped:0, restless:0};
}
function seatVP(party,name,who){
  if(who){ S.vp={...who, party, since:S.q, ties:0, jobQ:S.q}; return; }
  const v=makeVP(party);
  if(name)v.name=name;
  S.vp=v;
}

/* ─── кабинет ────────────────────────────────────────────────────
   Премьер и министры заводятся людьми: у портфеля есть не только
   партия, но и фамилия, компетентность и срок в должности. */
function makeMinister(post,party){
  return {post, party, name:depName(), comp:ri(30,86), since:S.q};
}
function seedCabinet(){
  S.pm={party:S.gov.lead, name:pmName(S.gov.lead), since:S.q, reshuffles:0};
  if(!S.rulers)S.rulers={pres:[],pm:[]};
  openReign('pm',S.pm.name,S.pm.party);
  S.ministers={};
  POSTS.forEach(p=>{ S.ministers[p.id]=makeMinister(p.id,S.gov.posts[p.id]||S.gov.lead); });
}
/* кто сядет в кресло премьера: вы — если партия ваша и вы не президент;
   иначе лидер партии, а при президенте-лидере — его человек */
function pmName(lead){
  if(lead!==PL)return P(lead).leader;
  if(chief()&&mySeat()!=='pres')return S.you.name;
  if(!chief())return me().leader;
  if(!S.pmMate)S.pmMate=depName();
  return S.pmMate;
}
/* портфель сменил партию — значит сменился и человек */
function syncCabinet(){
  if(!S.ministers)S.ministers={};
  POSTS.forEach(p=>{
    const want=S.gov.posts[p.id]||S.gov.lead, cur=S.ministers[p.id];
    if(!cur||cur.party!==want)S.ministers[p.id]=makeMinister(p.id,want);
  });
  if(S.pm&&S.gov.lead===PL&&S.pm.party===PL&&S.pm.name!==pmName(PL)){   // съезд сменил лидера
    closeReign('pm','смена лидера');
    S.pm={party:PL, name:pmName(PL), since:S.q, reshuffles:0};
    openReign('pm',S.pm.name,PL);
  }
  if(!S.pm||S.pm.party!==S.gov.lead){
    closeReign('pm','смена кабинета');
    S.pm={party:S.gov.lead, name:pmName(S.gov.lead), since:S.q, reshuffles:0};
    openReign('pm',S.pm.name,S.pm.party);
  }
}
/* вероятность вето: расхождение по теме плюс испорченные отношения */
function vetoChance(bill){
  if(!presVeto())return 0;                                // в парламентской республике подписи не спрашивают
  if(isPres())return 0;                                   // свой президент подписывает не глядя
  const p=presParty(); if(!p)return 0;
  const d=Math.abs((p.st[T(bill.topic).ax]||0)-bill.stance);
  let c=(d-1.3)*0.30+(58-S.presRel)*0.006;
  if(hasTrait('diplo'))c-=0.10;                    // с ним просто договариваются
  if(inCoal(p.id))c-=0.12;                                // президент в коалиции воюет реже, но не никогда
  if((bill.by||PL)!==PL&&!inCoal(bill.by||PL))c+=0.06;    // чужой закон завернуть проще
  return clamp(c,0,0.85);
}
function vetoWord(c){ return c<0.12?'подпишет':c<0.35?'скорее подпишет':c<0.6?'может завернуть':'почти наверняка вето'; }

/* ─── указы ──────────────────────────────────────────────────────
   Указ живёт вполсилы и всего несколько кварталов, зато не спрашивает
   ни Собрания, ни Сената. Цена — недовольство тех, кто следит за
   процедурой. */
function activeDecrees(){ return S.laws.filter(l=>l.decree); }
function decreeTick(){
  const gone=S.laws.filter(l=>(l.decree||l.sunset)&&l.until&&l.until<=S.q);
  if(gone.length){
    S.laws=S.laws.filter(l=>gone.indexOf(l)<0);
    gone.forEach(l=>logMsg('Срок '+(l.decree?'указа':'закона')+' «'+l.name+'» истёк: он больше не действует.',
      l.decree?0:1));
  }
  const n=activeDecrees().length;
  if(n){ shiftMood('intel',-0.55*n); shiftMood('urban',-0.32*n); shiftMood('patr',0.2*n); }
}

/* ─── формирование правительства ─────────────────────────────── */
/* сколько портфелей просит партия — см. раздел парламента: по доле мест */
function formCoalition(initial){
  if(initial){
    // старт: игрок — первая партия, берёт в союзники ближайшую подходящую
    const order=S.parties.filter(p=>p.id!==PL).sort((a,b)=>axDist(a.st,me().st)-axDist(b.st,me().st));
    S.gov={lead:PL,coal:[PL],posts:{}};
    POSTS.forEach(p=>S.gov.posts[p.id]=PL);
    let tail=POSTS.length-1;                 // портфели союзникам раздаются с конца списка
    for(const p of order){
      if(coalSeats()>=MAJ)break;
      if(axDist(p.st,me().st)<1.9){
        S.gov.coal.push(p.id);
        for(let i=0;i<partyPrice(p.id)&&tail>0;i++,tail--)S.gov.posts[POSTS[tail].id]=p.id;
        S.partners[p.id]={patience:3,anger:0};
        S.pacts=S.pacts||{}; S.pacts[p.id]=pactFor(p.id,PL);   // союзник входит с требованием
      }
    }
  }
}

/* ─── экономика ──────────────────────────────────────────────── */
function taxLoad(){ return (S.tax.inc+S.tax.corp+S.tax.vat)/3; }
function resIncome(){ return r1(((S.world?S.world.res:100)-100)*0.11*S.econ.gdp/100); }
function revenue(){
  const g=S.econ.gdp/100;
  let v=TAXES.reduce((a,t)=>a+t.yield*(S.tax[t.id]/2),0)*g+resIncome();
  if(S.gov.posts.fin===PL||inCoal(S.gov.posts.fin))v*=1.06;
  v*=1+minPower('fin');                       // министр финансов, а не только его фракция
  v*=clamp(1-avgUnrest()*0.004,0.7,1);
  return r1(v);
}
function outlay(){
  const g=0.55+S.econ.gdp/100*0.45;
  return r1(SPEND.reduce((a,s)=>a+s.base*(S.spend[s.id]/2),0)*g);
}
function interest(){ return r1(S.debt*0.016); }
function balance(){ return r1(revenue()-outlay()-interest()+lawSum('money')); }
function avgUnrest(){ let s=0,t=0; REGIONS.forEach(r=>{s+=S.unrest[r.id]*r.pop;t+=r.pop;}); return s/t; }
function lawSum(key){ return S.laws.reduce((a,l)=>a+(l.sum[key]||0),0); }

function cycleImpulse(){ return Math.sin((S.cyc?S.cyc.ph:0)*Math.PI*2)*2.0; }
function cyclePhase(){
  const v=cycleImpulse();
  return v>0.7?'подъём':v>0.2?'оживление':v>-0.2?'ровно':v>-0.7?'охлаждение':'спад';
}
function econTick(){
  const e=S.econ, W=S.world;
  // хозяйственный цикл идёт сам по себе, что бы вы ни делали
  S.cyc.ph+=1/S.cyc.len; if(S.cyc.ph>1){S.cyc.ph-=1;S.cyc.len=ri(13,19);}
  const tgt=100+nbTrade()*0.55;                 // отношения с соседями — это торговля
  W.demand=clamp(W.demand+(tgt-W.demand)*0.07+rnd(-5.5,5.5),55,142);
  W.res=clamp(W.res+(100-W.res)*0.05+rnd(-9,9),45,168);
  const cyc=cycleImpulse();
  const invT = 100 + (W.demand-100)*0.16 + cyc*7 + (2-S.tax.corp)*9 + (2-S.tax.inc)*3 + (S.stab-55)*0.45
             + lawSum('invest') + S.spend.inf*3 - e.inf*1.6 - avgUnrest()*0.35
             + (typeof bizClimate==='function'?(bizClimate()-50)*0.22:0);   // деловой климат
  e.invest = clamp(e.invest+(invT-e.invest)*(hasTrait('econom')?0.38:0.3)+rnd(-2,2),25,190);
  const gT = 0.5 + cyc + (W.demand-100)*0.014 + (e.invest-100)*0.016 - (S.tax.corp-2)*0.16 + S.spend.inf*0.14 + S.spend.edu*0.05
           + lawSum('growth') - Math.max(0,e.inf-6)*0.12 - avgUnrest()*0.018
           - (e.gdp/100-1)*0.55;               // догоняющий рост выдыхается
  e.growth = r2(clamp(e.growth+(gT-e.growth)*0.4+rnd(-0.2,0.2),-6,7));
  e.gdp = r1(Math.max(45,e.gdp*(1+e.growth/100)));
  const uT = 8.4 - e.growth*1.05 - S.spend.inf*0.35 - S.spend.edu*0.1 + (S.tax.inc-2)*0.22 + lawSum('unemp')*4
           + (S.rec>1?1.4:0);                  // затяжной спад ломает рынок труда
  e.unemp = r1(clamp(e.unemp+(uT-e.unemp)*0.3+rnd(-0.2,0.2),2.5,26));
  const bal=balance(), defc=Math.max(0,-bal);
  const iT = 2.6 + Math.max(0,cyc)*0.55 + defc*0.10 + (S.tax.vat-2)*0.45 + (W.res-100)*0.022 + Math.max(0,(e.invest-130))*0.025
           + Math.max(0,e.growth-2)*0.55 + lawSum('inf') - (S.tax.corp-2)*0.05;
  e.inf = r1(clamp(e.inf+(iT-e.inf)*0.34+rnd(-0.25,0.25),0,32));
  S.treasury = r1(S.treasury+bal);
  if(S.treasury<0){ S.debt=r1(S.debt-S.treasury); S.treasury=0; }
  else if(S.treasury>90&&S.debt>0){ const pay=Math.min(S.debt,(S.treasury-90)*0.5);
    S.debt=r1(S.debt-pay); S.treasury=r1(S.treasury-pay); }
  S.rec = e.growth<0 ? (S.rec||0)+1 : 0;
  if(S.rec===2){ logMsg('Второй квартал падения подряд: в стране рецессия.',1);
    chron('Началась рецессия.','b'); shiftAll(-2.2); }
  S.stab = clamp(S.stab+(52-S.stab)*0.07-avgUnrest()*0.05+lawSum('stab')*0.6+rnd(-1.2,1.2),0,100);
}

/* ─── годовой бюджет ─────────────────────────────────────────────
   Ставки и статьи живут до конца года, но раз в четыре квартала
   правительство защищает их в Собрании. */
function avgSpend(){ return SPEND.reduce((a,s)=>a+S.spend[s.id],0)/SPEND.length; }
function budgetDue(){ return (S.q-S.termStart)%4===3; }
function budgetYear(){ return 2029+Math.floor((S.q)/4)+1; }
function budgetStance(){
  return {tax:clamp((2-taxLoad())*1.4,-2,2), econ:clamp((2-avgSpend())*1.2,-2,2)};
}
function budgetSupport(d){
  const b=budgetStance();
  let v=(0.95-Math.abs(d.st.tax-b.tax))*13+(0.95-Math.abs(d.st.econ-b.econ))*10;
  v+=inCoal(d.party)?10:-8;
  v+=(d.rel-50)*0.30;
  ['tax','econ'].forEach(ax=>{ const id=S.comm&&S.comm[ax];
    const ch=id?S.deputies.find(x=>x.id===id):null;
    if(ch&&ch.party===d.party)v+=5; });
  if(S.unrest[d.region]>30&&S.spend.soc>=3)v+=4;      // округ на взводе ценит соцстатью
  if(typeof inBloc==='function'&&inBloc(d.party))v-=6;   // блок против бюджета кабинета
  if(typeof bAskPull==='function'&&d.party!==PL)v+=bAskPull(d);   // своя строка вписана или нет
  const dd=typeof dealFor==='function'?dealFor(d.party,'h','budget'):null;
  if(dd)v+=26*d.loyal/100*dealGrip(dd);                // лидер фракции обещал бюджет
  v+=noise(d.id+'budget'+S.q+taxLoad()+avgSpend(),7);
  return v;
}
function budgetTally(){
  const t={yes:0,no:0,und:0,list:[]};
  S.deputies.forEach(d=>{ const v=budgetSupport(d), st=v>10?'yes':v<-10?'no':'und';
    t[st]++; t.list.push({d,v,st}); });
  return t;
}
function snapshotBudget(){ return {tax:{...S.tax},spend:{...S.spend}}; }

/* ─── настроения ─────────────────────────────────────────────── */
function perfOf(g){
  const e=S.econ,c=g.care;let v=0;
  if(c.unemp) v+=c.unemp*(e.unemp-8)*2.1;
  if(c.inf)   v+=c.inf*(e.inf-4)*1.7;
  if(c.growth)v+=c.growth*(e.growth-1)*3.4;
  if(c.taxload)v+=c.taxload*(taxLoad()-2)*5.5;
  if(c.unrest)v+=c.unrest*(avgUnrest()-14)*0.55;
  ['def','pol','med','edu','soc'].forEach(k=>{ if(c[k])v+=c[k]*(S.spend[k]-2)*4.2; });
  if(c.infr)  v+=c.infr*(S.spend.inf-2)*4.2;
  return clamp(v,-30,30);
}
function moodTarget(g){
  // курс, дела и усталость от власти: чем дольше правите, тем меньше кредита
  const wear=(S.fatigue||0)*(hasTrait('media')?0.7:1)+agePenalty();
  let base=0.55*fitOf(g,me().st)+0.45*(52+perfOf(g))-wear;
  base+=(rep('folk')-50)*0.06;                      // народного прощают охотнее
  if(hasTrait('iron')&&g.id==='intel')base-=4;      // твёрдую руку интеллигенция не любит
  if(hard())base-=(isPM()||isPres())?7:3;           // жёсткая страна: власти верят меньше, всем — чуть меньше
  return clamp(base+(S.moodShock&&S.moodShock[g.id]||0),3,97);
}
function moodTick(){
  GROUPS.forEach(g=>{ const t=moodTarget(g);
    S.mood[g.id]=clamp(S.mood[g.id]+(t-S.mood[g.id])*0.28+rnd(-1.1,1.1),2,98); });
  REGIONS.forEach(r=>{
    const t=(r.dev-2)*1.6-S.unrest[r.id]*0.16+(S.spend.inf-2)*0.8;
    S.rmod[r.id]=r1(clamp(S.rmod[r.id]+(t-S.rmod[r.id])*0.16,-22,22));
  });
}
function shiftMood(gid,v,raw){
  // печать стоит между решением и тем, что о нём подумают
  const k=(raw||!S.press)?1:pressMul(v);
  S.mood[gid]=clamp(S.mood[gid]+v*k,2,98);
}
function shiftAll(v){ GROUPS.forEach(g=>shiftMood(g.id,v)); }
function approvalIn(gid,rid){ return clamp(S.mood[gid]+S.rmod[rid]+govEffect(rid),0,100); }
function approval(){
  let s=0,t=0;
  REGIONS.forEach(r=>GROUPS.forEach(g=>{
    const w=r.pop*r.share[g.id]; s+=w*approvalIn(g.id,r.id); t+=w; }));
  return s/t;
}
function regApproval(rid){
  const r=R(rid);let s=0;
  GROUPS.forEach(g=>s+=r.share[g.id]*approvalIn(g.id,rid));
  return s;
}
/* без свежего опроса цифры показываются с погрешностью */
function polled(){ return S.poll===S.q; }
function shown(v,key){ return (polled()||hasTrait('econom'))?v:v+noise(key+S.q,3.2); }

/* ─── депутаты и голосование ─────────────────────────────────── */
function bigOpp(){
  // оппозиции может не быть вовсе, если в кабинете все: тогда крупнейшая чужая фракция
  return S.parties.filter(p=>p.id!==PL&&!inCoal(p.id)).sort((a,b)=>seatsOf(b.id)-seatsOf(a.id))[0]
    ||S.parties.filter(p=>p.id!==PL).sort((a,b)=>seatsOf(b.id)-seatsOf(a.id))[0];
}
function leaderLine(pid,bill,house){
  const dl=typeof dealBillLine==='function'?dealBillLine(pid,house||'h',bill):null;
  if(dl&&!dl.renege)return 1;                     // о законе договорились с лидером
  if(typeof inBloc==='function'&&inBloc(pid)&&(bill.by||PL)===PL)return -1;   // блок голосует против вас
  const p=P(pid), d=Math.abs((p.st[T(bill.topic).ax]||0)-bill.stance);
  if(pid===PL) return d>2.3?-1:1;
  let line = d<1.15?1:d>2.25?-1:0;
  if(inCoal(pid)&&line<1) line++;
  // оппозиционные фракции, стоящие рядом, держатся вместе против правительства
  if(!inCoal(pid)&&(bill.by||PL)===PL){
    const lead=bigOpp();
    if(lead&&lead.id!==pid&&axDist(lead.st,p.st)<1.3){
      const ld=Math.abs((lead.st[T(bill.topic).ax]||0)-bill.stance);
      if(ld>2.25)line=Math.min(line,0)-1;
    }
  }
  return clamp(line,-1,1);
}
function riderPull(dep,bill){
  let v=0;
  (bill.riders||[]).forEach(rd=>{
    if(rd==='money') v+= dep.region===bill.regTarget?16:-1.5;
    if(rd==='biz')   v+= (dep.st.econ+dep.st.tax)*3.2;
    if(rd==='work')  v+= -(dep.st.econ+dep.st.tax)*3.2;
    if(rd==='soft')  v+= 5-Math.abs(dep.st[T(bill.topic).ax]-bill.stance)*1.6;
  });
  return v;
}
function support(dep,bill){
  const ax=T(bill.topic).ax;
  let v=(0.95-Math.abs(dep.st[ax]-bill.stance))*22;
  v+=leaderLine(dep.party,bill,'h')*dep.loyal*0.32;
  const hd=dealBillLine(dep.party,'h',bill); if(hd)v+=10*dealGrip(hd);        // лидер фракции держит своих
  v+=(dep.rel-50)*0.30;
  v+=riderPull(dep,bill);
  if(inCoal(dep.party))v+=5;
  // профильный комитет: его председатель ведёт за собой однопартийцев
  const ch=S.comm&&S.comm[ax]?S.deputies.find(d=>d.id===S.comm[ax]):null;
  if(ch){ if(ch.id===dep.id)v+=7;
    if(ch.party===dep.party)v+=leaderLine(ch.party,bill)>=0?7:-3; }
  // чужой проект — повод его завалить, кто бы его ни вносил
  const mine=(bill.by||PL)===PL;
  if(mine&&!inCoal(dep.party))v-=9;
  if(!mine&&dep.party===PL)v-=9;
  if(!mine&&inCoal(dep.party)&&dep.party!==PL)v-=4;
  if(dep.pledge&&bill.id&&dep.pledgeNo===bill.id)v+=dep.pledge;
  v+=firmPull(dep,bill);                          // за чей счёт живёт округ
  v+=amendPull(dep,bill);                         // поправка вносится ради голосов
  if(mine&&hasTrait('jurist'))v+=4;               // текст написан так, что не придерёшься
  // партию ведёт другой: своя фракция идёт за вашим законом по вашему влиянию и слову лидера
  if(mine&&dep.party===PL&&!chief())v+=(S.you.inf-45)*0.25+(S.you.lrel-50)*0.12;
  if(mine)v+=(rep('comp')-50)*0.05;
  v+=noise(dep.id+'|'+bill.topic+bill.stance+(bill.riders||[]).join('')+S.billNo,7);
  if(T(bill.topic).local&&bill.stance>0&&R(dep.region).capital)v-=6;
  return v;
}
/* Поправка не меняет сути закона, но меняет расклад: смягчающая
   оговорка мирит противников, посторонний пункт покупает автора,
   ужесточение зовёт крыло и гонит середину. */
function amendPull(dep,bill){
  if(!bill.amend)return 0;
  const A=AMENDS.find(a=>a.id===bill.amend); if(!A)return 0;
  const t=T(bill.topic); if(!t)return 0;
  const own=dep.party===(bill.by||PL)||inCoal(dep.party);
  let v=0;
  if(A.id==='water'||A.id==='sunset')v+= own?A.pull.coal:A.pull.opp;
  if(A.id==='pork')v+= dep.region===bill.regTarget?A.pull.reg:A.pull.rest;
  if(A.id==='harden')v+= Math.abs(dep.st[t.ax]-bill.stance)<0.8?A.pull.wing:A.pull.centre;
  if(A.id==='rider')v+= dep.party===(bill.by||PL)?A.pull.author:A.pull.opp;
  return v;
}
function tally(bill){
  const t={yes:0,no:0,und:0,list:[]};
  S.deputies.forEach(d=>{
    const v=support(d,bill), st=v>10?'yes':v<-10?'no':'und';
    t[st]++; t.list.push({d,v,st});
  });
  return t;
}
function resolveVote(bill,need){
  const t=tally(bill);let yes=0,no=0;
  t.list.forEach(x=>{
    if(x.st==='yes')yes++; else if(x.st==='no')no++;
    else { const p=0.5+x.v/30; (Math.random()<p?yes++:no++); }
  });
  return {yes,no,pass:yes>=(need||MAJ)};
}

/* ─── эффект принятого закона ────────────────────────────────── */
function billSum(bill){
  const rd0=bill.riders||[];
  const t=T(bill.topic), k=bill.stance*(rd0.indexOf('soft')>=0?0.66:1), sum={};
  Object.entries(t.eff||{}).forEach(([key,v])=>sum[key]=r2(v*k));
  sum.gr={};
  Object.entries(t.gr||{}).forEach(([g,v])=>sum.gr[g]=r2(v*k));
  rd0.forEach(rd=>{
    if(rd==='biz'){ sum.gr.biz=(sum.gr.biz||0)+1.6; sum.gr.work=(sum.gr.work||0)-1; sum.once=(sum.once||0)-6; }
    if(rd==='work'){ sum.gr.work=(sum.gr.work||0)+1.6; sum.gr.biz=(sum.gr.biz||0)-1.2; sum.once=(sum.once||0)-7; }
    if(rd==='money'){ sum.once=(sum.once||0)-9; }
  });
  return sum;
}
function enact(bill,decree){
  const sum=billSum(bill), t=T(bill.topic);
  // указ работает вполсилы; смягчающая оговорка делает с законом то же самое
  const k0=(decree?decreePower():1)*(bill.weak||1);
  if(k0!==1){
    ['money','growth','inf','unemp','invest','unrest','stab','once'].forEach(k=>{
      if(sum[k])sum[k]=r2(sum[k]*k0); });
    Object.keys(sum.gr).forEach(g=>sum.gr[g]=r2(sum.gr[g]*k0));
  }
  // по каждой теме действует только последняя редакция — закон отменяет и указ
  const prev=S.laws.findIndex(l=>l.topic===bill.topic);
  if(prev>=0)S.laws.splice(prev,1);
  S.laws.push({no:++S.billNo, topic:bill.topic, stance:bill.stance, riders:[...(bill.riders||[])],
    q:S.q, sum, name:t.name, by:bill.by||PL, amend:bill.amend||null, weak:bill.weak||0,
    decree:!!decree, until:decree?S.q+decreeLen():(bill.sunset?S.q+bill.sunset:0),
    sunset:!decree&&!!bill.sunset});
  if(sum.once)S.treasury=r1(S.treasury+sum.once);
  if(!decree)pactCheck(S.laws[S.laws.length-1]);          // закон против договора рвёт коалицию
  if(typeof firmLawReact==='function')firmLawReact(S.laws[S.laws.length-1]);   // капитал отвечает на закон
  // указом ставку не трогаем: он истечёт, а изменённый налог остался бы навсегда
  if(t.rate&&!decree&&Math.abs(bill.stance)>0)
    S.tax[t.rate]=clamp(S.tax[t.rate]-Math.round(bill.stance/1.4),0,4);
  Object.entries(sum.gr||{}).forEach(([g,v])=>shiftMood(g,v*1.5));
  if(sum.unrest)REGIONS.forEach(r=>S.unrest[r.id]=clamp(S.unrest[r.id]+sum.unrest*2,0,100));
  if(bill.regTarget){ S.rmod[bill.regTarget]=clamp(S.rmod[bill.regTarget]+3,-22,22);
    S.unrest[bill.regTarget]=clamp(S.unrest[bill.regTarget]-5,0,100); }
  // партия, чью позицию закон отражает, чувствует себя победителем
  S.parties.forEach(p=>{ if(p.id!==PL&&Math.abs(p.st[t.ax]-bill.stance)<0.9)p.mom=clamp(p.mom+1.5,-12,12); });
}

function lawOn(topic){ return S.laws.find(l=>l.topic===topic); }
/* постоянные эффекты законов пересчитываются каждый квартал через lawSum */

/* ─── журнал и летопись ──────────────────────────────────────── */
/* Кварталы бывают и отрицательными: судья или президент могли сесть
   в кресло до начала игры. Остаток по модулю приводим к неотрицательному,
   иначе индекс сезона уходит за границу массива. */
const qmod = q => ((q-1)%4+4)%4;
function dateLabel(q){ q=q===undefined?S.q:q; return SEASONS[qmod(q)]+' '+(2029+Math.floor((q-1)/4)); }
function shortDate(q){ q=q===undefined?S.q:q; return (2029+Math.floor((q-1)/4))+'/'+QUARTERS[qmod(q)]; }
function logMsg(t,key){ S.log.unshift({d:shortDate(),t,key:!!key}); if(S.log.length>240)S.log.pop(); }
function chron(t,kind){ S.chron.push({y:2029+Math.floor((S.q-1)/4),t,kind:kind||''}); }
function snapshot(){
  S.hist.push({q:S.q,ap:r1(approval()),gdp:r1(S.econ.gdp),gr:S.econ.growth,tr:Math.round(S.treasury),
    un:S.econ.unemp,inf:S.econ.inf,seats:seatsOf(PL),debt:Math.round(S.debt)});
  if(S.hist.length>90)S.hist.shift();
}
function toast(t){
  const b=document.getElementById('toasts');if(!b)return;
  const e=document.createElement('div');e.className='toast';e.textContent=t;b.appendChild(e);
  setTimeout(()=>e.remove(),2750);
}

/* ════════════════════════════════════════════════════════════════
   БИЗНЕС
   Корпорация не голосует и не сидит в палате. Она платит тем, кто
   сидит, и помнит, кто как проголосовал. Захват — мера того,
   сколько власти уже куплено, и страна его чувствует раньше, чем
   узнаёт подробности.
   ════════════════════════════════════════════════════════════════ */
const FM = id => FIRMS.find(f=>f.id===id);
function firmOf(id){ return S.firms?S.firms[id]:null; }
function seedFirms(){
  S.firms={};
  FIRMS.forEach(f=>{
    S.firms[f.id]={id:f.id,
      rel:clamp(Math.round(52-axDist(f.want,me().st)*9+rnd(-8,8)),8,92),
      cash:Math.round(60*f.power+rnd(-12,12)),   // капитал, из которого платят
      given:0, gifts:0, owed:null, owedQ:0, deals:0, angry:0};
  });
  S.capture=8;
}
/* как далеко корпорации от вашего курса — от этого их щедрость */
function firmGap(f){ return axDist(FM(f.id).want, me().st); }
/* сколько эта корпорация весит в хозяйстве прямо сейчас */
function firmWeight(f){
  const d=FM(f.id);
  return r2(d.power*(0.7+S.econ.gdp/300)*(f.angry>2?0.85:1));
}
/* захват: сколько денег легло в кассу и сколько обещаний роздано */
function captureLevel(){ return Math.round(clamp(S.capture||0,0,100)); }
function captureWord(v){
  return v<20?'власть себе принадлежит':v<40?'связи есть у всех':v<60?'бизнес в кабинете':
         v<80?'решения покупаются':'страной управляют не в палате';
}
function bumpCapture(v){ S.capture=clamp(r1((S.capture||0)+v),0,100); }
/* корпорация тянет своих депутатов: чем больше дано, тем сильнее тяга */
function firmPull(dep,bill){
  if(!S.firms||!T(bill.topic))return 0;
  const ax=T(bill.topic).ax; let v=0;
  FIRMS.forEach(d=>{
    const f=firmOf(d.id); if(!f||!f.given)return;
    if(d.reg!==dep.region&&d.groups.indexOf(mainGroup(dep.region))<0)return;
    const want=d.want[ax]||0; if(!want)return;
    // деньги не покупают убеждения, они покупают внимание
    v+=Math.sign(want)*Math.min(Math.abs(want),1.4)*Math.min(f.given,40)*0.16*(bill.stance>0?1:-1);
  });
  return clamp(v,-14,14);
}
function mainGroup(rid){
  const r=R(rid); let best='work',bv=-1;
  GROUPS.forEach(g=>{ const s=r.share[g.id]||0; if(s>bv){bv=s;best=g.id;} });
  return best;
}
/* обещанный, но не проведённый закон корпорация помнит */
function firmOwed(f){
  if(!f.owed)return null;
  const t=T(f.owed.topic); if(!t)return null;
  const l=lawOn(f.owed.topic);
  return {t, done:!!(l&&Math.sign(l.stance)===Math.sign(f.owed.stance)&&Math.abs(l.stance)>=Math.abs(f.owed.stance)),
          left:Math.max(0,f.owedQ+CAP_GIFT-S.q)};
}

/* ════════════════════════════════════════════════════════════════
   ЛИЧНОЕ КРЕСЛО ИГРОКА
   Роль партии и должность человека — разные вещи. Партия может быть
   в оппозиции, пока вы министр; вы можете лишиться всего, а партия
   останется. Игра идёт, пока жив политик, а не пока цел пост.
   ════════════════════════════════════════════════════════════════ */
function mySeat(){ return (S.you&&S.you.seat)||'dep'; }
function seatName(){ const s=SEATS_YOU[mySeat()]; return s?s.name:'Депутат'; }
function setSeat(id,why){
  if(!S.you)return;
  const was=S.you.seat;
  if(was!==id&&typeof leaveDesk==='function')leaveDesk(was,id);
  S.you.seat=id;
  if(was!==id){
    career((why?why+' ':'')+'Кресло: '+(SEATS_YOU[id]||{name:id}).name.toLowerCase()+'.');
    S.you.seatQ=S.q;
  }
}
/* есть ли у игрока мандат: без него нельзя вносить законы самому */
function hasMandate(){ return ['dep','pm','vice','lead'].indexOf(mySeat())>=0; }
/* своё место в Сенате — отдельная от мандата вещь */
function inSenate(){ return mySeat()==='sen'; }
/* сколько власти даёт нынешнее кресло — множитель к политическому доходу */
function seatPower(){
  const m={pres:1.5,pm:1.35,vp:1.0,vice:1.05,min:0.95,gov:0.9,sen:0.8,dep:0.75,lead:0.85,mayor:0.7,none:0.4};
  return m[mySeat()]||0.75;
}
/* можно ли вносить законопроекты своей рукой */
/* мэр и частное лицо своих законов не вносят; губернатор — правом субъекта */
function canBill(){ return ['none','mayor'].indexOf(mySeat())<0; }

/* ════════════════════════════════════════════════════════════════
   РАССЛЕДОВАНИЯ И ИМПИЧМЕНТ
   Палата умеет не только принимать законы. Комиссия копает,
   обвинение выдвигают внизу, судят наверху.
   ════════════════════════════════════════════════════════════════ */
function inquiry(){ return S.inq; }
function inqTarget(){
  const i=S.inq; if(!i)return '—';
  if(i.kind==='min'){ const m=minOf(i.who); return m?m.name+' ('+POSTS.find(p=>p.id===i.who).name+')':'министр'; }
  if(i.kind==='gov'){ const g=govOf(i.who); return g?g.name+' ('+R(i.who).name+')':'глава края'; }
  if(i.kind==='pres')return S.pres?S.pres.name:'президент';
  if(i.kind==='firm'){ const f=FM(i.who); return f?f.name:'корпорация'; }
  if(i.kind==='amend'){ const a=(CN().log||[]).find(x=>x.id===i.who); return a?a.name:'поправка'; }
  if(i.kind==='you')return S.you.name;
  return '—';
}
/* сколько улик комиссия наберёт за квартал: состав важнее темы */
function inqDig(i){
  const friendly=i.by===PL||inCoal(i.by);
  let v=ri(8,20);
  if(i.kind==='you')v+= (S.trail||0)*0.25;
  if(i.kind==='min'){ const m=minOf(i.who); if(m)v+=(60-m.comp)*0.16; }
  if(i.kind==='firm'){ const f=firmOf(i.who); if(f)v+=Math.min(f.given,50)*0.3; }
  if(i.kind==='pres')v+=(S.pres&&S.pres.decrees?S.pres.decrees*1.6:0);
  if(i.kind==='amend'){
    // разбирают не статью, а то, как её проводили: своекорыстие текста,
    // след от сделок в те кварталы и тон печати вокруг голосования
    const a=(CN().log||[]).find(x=>x.id===i.who);
    if(a){ v+=Math.abs(Math.min(0,a.cost))*0.55+(a.bought||0)*0.14; if(a.ref)v-=12; }
    v+=(LEGIT0-legit())*0.1;
  }
  if(!friendly&&i.kind!=='you')v-=5;               // против чужой комиссии есть чем помешать
  return Math.round(clamp(v,2,34));
}
function inqWord(v){ return v>=80?'состав налицо':v>=58?'улик много':v>=34?'кое-что есть':v>=14?'пока пусто':'ничего'; }
function impeachment(){ return S.imp; }

/* ════════════════════════════════════════════════════════════════
   КОНСТИТУЦИЯ: действующая редакция
   Все сроки и пороги читаются отсюда, а не из констант. Константа —
   это то, с чего страна начинала; конституция — то, до чего дожила.
   ════════════════════════════════════════════════════════════════ */
function cnDefault(){
  return {pterm:PTERM, term:TERM, sencyc:SEN_CYCLE, limit:2,
    super:SUPER, impH:IMP_HOUSE, impS:IMP_SEN, judge:JUDGE_LIFE,
    noconf:'plain', dissolve:'pres', senall:false, entrench:false,
    recall:false, emerg:0, legit:LEGIT0, log:[],
    // глава 1: форма правления и вес второй палаты
    form:'semi', senVeto:'absolute', sendirect:false,
    // глава 2: то, что не отдаётся большинству
    rights:false, socmin:false,
    // глава 9: как меняется сама конституция
    needH:290, needS:67, allref:false,
    // обычные главы
    initiative:false, debtcap:0, courtN:COURT_SIZE};
}
const CN = ()=>(S&&S.cn)||cnDefault();
function pTerm(){ return CN().pterm; }
function aTerm(){ return CN().term; }
function senCyc(){ return CN().sencyc; }
function superN(){ return CN().super; }
function impH(){ return CN().impH; }
function impS(){ return CN().impS; }
function judgeLife(){ return CN().judge; }
function termLimit(){ return CN().limit; }
function noconfKind(){ return CN().noconf; }
function canDissolve(){
  const d=CN().dissolve;
  return d==='pres'?isPres():d==='pm'?isPM():false;
}
function emergOn(){ return (CN().emerg||0)>S.q; }
/* указ в чрезвычайном положении работает как закон */
function decreePower(){ return emergOn()?1:DECREE_POWER; }
function decreeLen(){ return emergOn()?DECREE_LEN*2:DECREE_LEN; }

/* ─── легитимность ────────────────────────────────────────────────
   Не рейтинг и не одобрение: вера в то, что правила одни для всех.
   Она не спасает от поражения на выборах, но без неё перестают
   работать сами выборы. */
function legit(){ return Math.round(clamp(CN().legit,0,100)); }
function legitWord(v){
  return v>=78?'правила соблюдают':v>=60?'правила ещё уважают':v>=LEGIT_LOW?'правила гнутся':
         v>=LEGIT_CR?'правила пишут под себя':'правил больше нет';
}
function bumpLegit(v){ S.cn.legit=clamp(r1((S.cn.legit||LEGIT0)+v),0,100); }
/* поправка тем дороже, чем очевиднее, кому она выгодна */
function cnCost(c){
  let v=c.self;
  if(v<0){
    // своя же поправка при своём же президенте — вдвое заметнее
    if(isPres()||isPM())v*=1.25;
    if(legit()<LEGIT_LOW)v*=0.7;              // где правил и так нет, ломать дешевле
    if(rep('honest')>66)v*=0.8;
  }
  return r1(v);
}
const CN_FIELDS=['pterm','term','sencyc','limit','super','impH','impS','judge',
  'noconf','dissolve','senall','entrench','recall','emerg',
  'form','senVeto','sendirect','rights','socmin','needH','needS','allref',
  'initiative','debtcap','courtN'];
function cnSnap(){ const o={}; CN_FIELDS.forEach(k=>o[k]=CN()[k]); return o; }
function cnDone(){ return (CN().log||[]).slice(); }

/* ─── главы и ядро ────────────────────────────────────────────────
   Поправка знает, в какой главе она живёт. Три главы — ядро: палаты
   их не открывают вовсе, туда ходит только Конституционное собрание. */
function cnCh(c){ return CH(c.ch||5)||CH(5); }
function cnCore(c){ return CN_CORE.indexOf(c.ch||5)>=0; }
function cnOpen(c){ return !c.on()&&(!c.cond||c.cond()); }
/* пороги читаются из редакции: глава 9 умеет менять сама себя */
function cnNeedH(c){ return Math.min(c.need.h, CN().needH||c.need.h); }
function cnNeedS(c){ return Math.min(c.need.s, CN().needS||c.need.s); }
function cnNeedRef(c){ return !!c.need.ref||!!CN().allref; }
/* что вносят палаты и что — только собрание */
function cnList(){ return CONSTS.filter(c=>!cnCore(c)&&cnOpen(c)); }
function cnCoreList(){ return CONSTS.filter(c=>cnCore(c)&&cnOpen(c)); }
function cnAny(id){ return CONSTS.find(c=>c.id===id); }

/* ─── что новые статьи делают на самом деле ──────────────────────
   Каждое поле редакции читается здесь, а не в десяти местах. */
function cnForm(){ return CN().form||'semi'; }
function presVeto(){ return cnForm()!=='parl'; }          // парламентская республика вето не знает
function presDecree(){ return cnForm()!=='parl'; }
function senVeto(){ return CN().senVeto||'absolute'; }    // absolute | suspensive
function senBinding(){ return senVeto()==='absolute'; }
function rightsLock(){ return !!CN().rights; }            // права под охраной суда
function socFloor(){ return CN().socmin?2:0; }            // ниже этого статью не опустить
function refCost(){ return CN().initiative?Math.round(REF_CAP/2):REF_CAP; }
function refGold(){ return CN().initiative?Math.round(REF_GOLD/2):REF_GOLD; }
function debtCap(){ return CN().debtcap||0; }
function debtOver(){ const c=debtCap(); if(!c)return 0; return S.debt>c?r1(S.debt-c):0; }
/* статья задаёт, сколько кресел должно быть; скамья — сколько их занято.
   Отменённая поправка судей не выгоняет, поэтому считают по скамье. */
function courtTarget(){ return CN().courtN||COURT_SIZE; }
function courtN(){ return (S.court&&S.court.length)||courtTarget(); }
function courtMaj(){ return Math.floor(courtN()/2)+1; }
function senDirect(){ return !!CN().sendirect; }

/* ═══ КОНСТИТУЦИОННОЕ СОБРАНИЕ ════════════════════════════════════
   Второй путь к конституции и единственный — к её ядру. Делегат не
   депутат: он избран на один вопрос и не думает о переизбрании,
   поэтому фракция весит здесь меньше, а страна больше. */
function conv(){ return S.conv||null; }
function convOn(){ const c=conv(); return !!c&&c.stage!=='done'; }
function convSitting(){ const c=conv(); return !!c&&c.stage==='sit'; }
function convLeft(){ const c=conv(); return c?Math.max(0,c.until-S.q):0; }
function convSeats(pid){ const c=conv(); return c&&c.seats?(c.seats[pid]||0):0; }
function convCoalSeats(){ const c=conv(); if(!c||!c.seats)return 0;
  return Object.entries(c.seats).reduce((a,[k,v])=>a+((k===PL||inCoal(k))?v:0),0); }
/* выборы делегатов: тот же расклад по краям, но списком и по стране */
function convElect(camp){
  const sc={},votes={};
  S.parties.forEach(p=>votes[p.id]=0);
  REGIONS.forEach(r=>{
    S.parties.forEach(p=>{ sc[p.id]=partyScore(p,r); });
    // делегата выбирают за взгляд на устройство, а не за хозяйство:
    // настроение страны весит вдвое против обычных выборов
    if(camp)sc[PL]*=1+camp;
    const share=shareFrom(sc);
    S.parties.forEach(p=>votes[p.id]+=share[p.id]*r.pop);
  });
  const tot=REGIONS.reduce((a,r)=>a+r.pop,0), share={};
  S.parties.forEach(p=>share[p.id]=votes[p.id]/tot);
  return dhondt(share,CONV_SEATS);
}
/* делегат голосует за пункт пакета */
function convSupport(pid,c,i){
  const own=pid===PL, coal=inCoal(pid);
  let v=own?30:coal?13:-26;
  // собрание избрано страной: своекорыстный пункт здесь дороже, чем в палатах
  v+=cnCost(c)*(own||coal?0.4:1.05);
  if(c.self>0)v+=20;                          // ограничивающую власть поддержат и чужие
  v+=(LEGIT0-legit())*0.1;
  v+=(approval()-46)*0.24;                    // делегат смотрит на страну, а не на фракцию
  v+=(rep('honest')-50)*0.16;
  if(cnCore(c))v-=7;                          // ядро трогать боязно даже здесь
  v+=noise(pid+'cv'+c.id+i,17);
  return v;
}
function convTally(c,i){
  const cv=conv(); if(!cv)return {yes:0,no:CONV_SEATS,pass:false};
  let yes=0;
  Object.entries(cv.seats||{}).forEach(([pid,n])=>{ if(convSupport(pid,c,i)>0)yes+=n; });
  return {yes,no:CONV_SEATS-yes,pass:yes>=CONV_MAJ};
}
/* собственная воля собрания: чем корыстнее пакет, тем вероятнее свой пункт */
function convOwnPick(pkg){
  const greed=pkg.reduce((a,id)=>{ const c=cnAny(id); return a+(c&&c.self<0?-c.self:0); },0);
  const chance=clamp(0.16+greed*0.016-convCoalSeats()/CONV_SEATS*0.2,0.05,0.72);
  if(Math.random()>chance)return null;
  const pool=CONV_OWN.map(o=>({c:cnAny(o.id),w:o.w}))
    .filter(x=>x.c&&cnOpen(x.c)&&pkg.indexOf(x.c.id)<0);
  if(!pool.length)return null;
  let tot=pool.reduce((a,x)=>a+x.w,0), roll=Math.random()*tot;
  for(const x of pool){ roll-=x.w; if(roll<=0)return x.c.id; }
  return pool[0].c.id;
}

/* созыв: три пятых обеих палат. Депутат решает не о статье, а о том,
   пускать ли к конституции кого-то помимо себя. */
function convCallSupport(d,house){
  const own=d.party===PL, coal=inCoal(d.party);
  let v=own?26:coal?11:-24;
  v+=(d.rel-50)*0.28;
  v+=(LEGIT0-legit())*0.22;                   // где правила не держат, собрание зовут охотнее
  v+=(avgUnrest()-14)*0.5;                    // страна на взводе требует нового основного закона
  v+=(rep('folk')-50)*0.14;
  if(house==='sen')v-=7;                      // палата, которую собрание может упразднить
  if(house==='sen'&&senDirect())v+=4;
  if(house==='sen'&&senElder(d))v-=6;
  v+=noise(d.id+'conv'+S.q,16);
  return v;
}
function convCallForecast(){
  return {h:S.deputies.filter(d=>convCallSupport(d,'low')>0).length,
          s:S.senate.filter(d=>convCallSupport(d,'sen')>0).length,
          needH:CONV_CALL_H, needS:CONV_CALL_S};
}

/* ─── судебный контроль поправки ─────────────────────────────────
   Суд не отменяет то, что приняла страна на референдуме, и не трогает
   ядро, принятое собранием. Всё прочее — может, если сочтёт, что
   поправка написана под того, кто её вносил. */
function cnReviewable(e){
  if(!e||e.ref||e.conv||e.shield)return false;
  return S.q-e.q<=CN_REVIEW&&e.cost<0;
}
function cnStrikeVotes(e){
  let n=0;
  S.court.forEach(j=>{
    let v=-e.cost*1.1;                         // чем корыстнее поправка, тем хуже
    v+=courtFree()*6;                          // независимый суд смелее
    v+=(LEGIT0-legit())*0.1;
    if(j.by===S.gov.lead)v-=12;
    if(j.by===(S.pres?S.pres.party:null))v-=8;
    if(rightsLock()&&(e.ch===1||e.ch===2))v+=14;
    v+=noise(j.id+'|cn|'+e.id+e.q,9);
    if(v>20)n++;
  });
  return n;
}


/* ════════════════════════════════════════════════════════════════
   АРХИВ ПРАВИТЕЛЕЙ
   Кто сидел в кресле, в какие годы и что после себя оставил.
   Достижение не выдумывается: оно считается из того, что за срок
   изменилось в стране.
   ════════════════════════════════════════════════════════════════ */
function rulers(){ if(!S.rulers)S.rulers={pres:[],pm:[]}; return S.rulers; }
function openReign(kind,name,party){
  const R0=rulers()[kind];
  const last=R0[R0.length-1];
  if(last&&!last.to&&last.name===name&&last.party===party)return;   // тот же человек
  R0.push({name, party, from:S.q, gdp0:r1(S.econ.gdp), unr0:Math.round(avgUnrest()),
    laws0:S.laws.length, ap0:Math.round(approval()), you:party===PL&&(!S.you||name===S.you.name)});
}
function closeReign(kind,how){
  const R0=rulers()[kind];
  const r=R0[R0.length-1];
  if(!r||r.to)return;
  r.to=S.q; r.how=how||'выборы';
  r.terms=Math.max(1,Math.round((r.to-r.from)/(kind==='pres'?pTerm():aTerm())*10)/10);
  if(kind==='pres'&&S.pres){ r.vetoes=S.pres.vetoes||0; r.decrees=S.pres.decrees||0; }
  r.note=reignNote(kind,r);
}
/* краткое достижение: берётся самое крупное из того, что сдвинулось */
function reignNote(kind,r){
  const dq=Math.max(1,r.to-r.from);
  const gdp=r1(S.econ.gdp-r.gdp0), unr=Math.round(avgUnrest()-r.unr0);
  const laws=S.laws.length-r.laws0, ap=Math.round(approval()-r.ap0);
  const c=[];
  if(r.how==='импичмент')c.push(['Отрешение от должности палатами',100]);
  if(r.how==='отставка')c.push(['Досрочный уход по собственной воле',60]);
  if(r.how==='наследование')c.push(['Полномочия прекращены досрочно',55]);
  if(gdp>=8)c.push(['Хозяйственный подъём: ВВП +'+gdp,Math.abs(gdp)*3]);
  if(gdp<=-8)c.push(['Спад: ВВП '+gdp,Math.abs(gdp)*3]);
  if(unr<=-10)c.push(['Страна успокоилась: напряжённость '+unr,Math.abs(unr)*2.4]);
  if(unr>=12)c.push(['Страна на взводе: напряжённость +'+unr,Math.abs(unr)*2.4]);
  if((r.decrees||0)>=5)c.push(['Правление указами: подписано '+r.decrees,r.decrees*5]);
  if((r.vetoes||0)>=5)c.push(['Вето против палат: '+r.vetoes+' раз',r.vetoes*5]);
  if(ap>=12)c.push(['Одобрение выросло на '+ap+'%',ap*1.8]);
  if(ap<=-14)c.push(['Одобрение упало на '+Math.abs(ap)+'%',Math.abs(ap)*1.8]);
  if(laws>=10)c.push(['Законодательный вал: '+laws+' законов за срок',laws*1.6]);
  const amend=(CN().log||[]).filter(x=>x.q>=r.from&&x.q<=r.to);
  if(amend.length)c.push(['Конституция переписана: '+plural(amend.length,'поправка','поправки','поправок'),
    amend.length*26]);
  if(!c.length)c.push([dq<=6?'Короткое и ничем не запомнившееся пребывание':'Ровное правление без потрясений',1]);
  c.sort((a,b)=>b[1]-a[1]);
  return c[0][0];
}
function reignYears(r){
  const y0=2029+Math.floor((r.from-1)/4);
  const y1=r.to?2029+Math.floor((r.to-1)/4):null;
  return y1?(y0===y1?String(y0):y0+'—'+y1):y0+'—наст.';
}
