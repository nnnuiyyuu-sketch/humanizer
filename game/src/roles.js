/* ════════════════════════════════════════════════════════════════
   КРЕСЛА: СТАРТ, СТОЛ, ДОРОГА
   Роль партии и кресло человека — разные вещи. Здесь то, что делает
   каждое кресло играбельным: расклад власти на старте, свой стол
   с рычагами и своей цифрой, по которой вас судят, и дорога дальше.
   ════════════════════════════════════════════════════════════════ */

/* ─── расклад на старте ─────────────────────────────────────────── */
/* откуда вы родом, если край не выбран: по происхождению */
function homeOf(){
  const o=S.you&&S.you.origin;
  const by={factory:'povolzh',academy:'balt',business:'centr',army:'kavkaz',province:'volga'};
  return by[o]||pick(REGIONS).id;
}
/* лидер партии, если это не вы: основатель, которого съезд выбрал раньше вас */
function partyElder(){ return (Math.random()<0.35?pick(NAME_F)+' '+pick(SURN_F):pick(NAME_M)+' '+pick(SURN_M)); }

function startRole(role,st){
  const y=S.you;
  y.chief=!!role.chief;
  y.home=st.rid||homeOf();
  y.inf=role.chief?70:({vp:40,gov:36,mayor:26,sen:30,dep:24,none:16}[role.id]||20);
  y.lrel=role.chief?60:ri(52,64);
  if(!role.chief){
    me().leader=partyElder();
    career('Партию «'+me().name+'» ведёт '+me().leader+'. Ваше место в ней вы выбрали сами.');
  }
  if(role.gov!=='lead')handGov(role.gov==='junior',st.post);
  if(role.id==='pres')seatYouPres();
  if(role.id==='vp')seatYouVP();
}
/* правительство на старте, если его ведёте не вы */
function handGov(withPL,post){
  const others=S.parties.filter(p=>p.id!==PL);
  const lead=withPL
    ? others.slice().sort((a,b)=>axDist(a.st,me().st)-axDist(b.st,me().st))[0]
    : others.slice().sort(bySeats)[0];
  S.gov={lead:lead.id,coal:[lead.id],posts:{}};
  POSTS.forEach(p=>S.gov.posts[p.id]=lead.id);
  if(withPL){
    S.gov.coal.push(PL);
    const n=Math.max(2,partyPrice(PL));
    const keys=(post?[post]:[]).concat(POSTS.map(p=>p.id).filter(k=>k!==post).reverse());
    keys.slice(0,n).forEach(k=>S.gov.posts[k]=PL);
  }
  others.filter(p=>p.id!==lead.id).sort((a,b)=>axDist(a.st,lead.st)-axDist(b.st,lead.st)).forEach(p=>{
    if(coalSeats()>=MAJ||axDist(p.st,lead.st)>=1.95)return;
    S.gov.coal.push(p.id); givePosts(p.id,partyPrice(p.id));
  });
  S.role=withPL?'junior':'opp'; S.partners={}; S.pacts={};
}
/* посев уже открыл президентство другому — переписываем начало архива */
function reignReset(kind){ const R0=rulers()[kind]; if(R0.length&&!R0[R0.length-1].to)R0.pop(); }
function seatYouPres(){
  reignReset('pres');
  S.pres={party:PL, name:S.you.name, since:S.q, until:S.q+pTerm(), term:1, vetoes:0, decrees:0};
  S.presRel=100;
  seatVP(PL);
  openReign('pres',S.pres.name,PL);
}
function seatYouVP(){
  reignReset('pres');
  S.pres={party:PL, name:me().leader, since:S.q-11, until:S.q+12, term:1, vetoes:0, decrees:0};
  S.presRel=86;
  S.vp=youVP(PL);
  openReign('pres',S.pres.name,PL);
}
/* вы в роли вице: те же три числа, что у любого вице, только ваши */
function youVP(party){
  const v=makeVP(party,'wing',S.you.home);
  v.name=S.you.name; v.you=true; v.amb=60; v.jobQ=S.q-VP_TERM;   // первое поручение можно взять сразу
  v.sen=Math.round(clamp(40+rep('comp')*0.3,20,92)); v.pop=Math.round(rep('folk'));
  return v;
}
/* стол кресла — после того, как кабинет рассажен */
function startDesk(role,st){
  const y=S.you;
  y.seat='dep'; y.seatQ=S.q;
  if(role.id==='min')takeMin(st.post||'soc',true);
  else if(role.id==='gov')takeGov(y.home,true);
  else if(role.id==='mayor')takeMayor(y.home,true);
  else if(role.id==='sen')takeSen(y.home,true);
  else { y.seat=role.seat; S.desk=newDesk(role.seat); }
  y.mand=['dep','pm','min'].indexOf(role.seat)>=0;      // министр-лидер шёл первым номером списка
  career('Первое кресло: '+seatTitle().toLowerCase()+'.');
}

/* ─── стол кресла ───────────────────────────────────────────────── */
function newDesk(seat,o){
  o=o||{};
  const d={kind:seat, score:50, hist:[], rid:o.rid||(S.you&&S.you.home)||homeOf(), q:S.q};
  if(seat==='gov'){ d.purse=10; d.dev=0; d.center=55; d.law=null; }
  if(seat==='mayor'){ d.purse=6; d.road=ri(40,55); d.util=ri(38,52); d.yard=ri(36,50); d.trust=54; d.till=S.q+MAYOR_TERM; }
  if(seat==='sen'||seat==='dep'||seat==='none')d.home=Math.round(clamp(regApproval(d.rid),30,70));
  if(seat==='vp')d.trust=62;
  if(seat==='pres'){ d.cab=58; d.msg=null; }
  if(seat==='min'){ d.post=o.post||S.you.post; d.low=0; }
  return d;
}
function desk(){
  const s=mySeat();
  if(!S.desk||S.desk.kind!==s)S.desk=newDesk(s);
  return S.desk;
}
/* где заканчивается кресло: мандат остаётся только у тех, кто его имел */
function fallbackSeat(){
  if(S.you&&S.you.mand)return chief()&&!inCoal(PL)?'lead':'dep';
  return 'none';
}
function seatTitle(){
  const s=mySeat(), d=S.desk||{};
  if(s==='min'&&S.you.post)return 'Министр · '+POSTS.find(p=>p.id===S.you.post).name.toLowerCase();
  if(s==='gov'&&d.rid)return 'Губернатор · '+R(d.rid).name;
  if(s==='mayor'&&d.rid)return 'Мэр · '+R(d.rid).cap;
  if(s==='sen'&&d.rid)return 'Сенатор · '+R(d.rid).name;
  if((s==='dep'||s==='none')&&!chief())return (s==='dep'?'Депутат':'Член партии')+' · '+R(d.rid||S.you.home||'centr').name;
  return seatName();
}

/* занять кресло: каждое оставляет след в своей подсистеме */
function takeMin(post,quiet){
  S.gov.posts[post]=PL;
  S.ministers[post]={post,party:PL,name:S.you.name,comp:ri(50,70),since:S.q,you:true};
  S.you.post=post;
  S.desk=newDesk('min',{post});
  if(quiet)S.you.seat='min'; else setSeat('min','Принят портфель: '+POSTS.find(p=>p.id===post).name.toLowerCase()+'.');
}
function takeGov(rid,quiet){
  const old=govOf(rid);
  const g={region:rid, party:PL, name:S.you.name, comp:Math.round(clamp(40+rep('comp')*0.4,30,85)), rel:95,
    since:S.q, till:S.q+GOV_TERM, deals:0, appointed:!govElected(), you:true};
  S.govs[rid]=g;
  S.govLog.unshift({q:S.q,region:rid,name:g.name,party:PL,how:govElected()?'elect':'appoint',was:old?old.party:null});
  S.you.home=rid;
  S.desk=newDesk('gov',{rid});
  if(quiet)S.you.seat='gov'; else setSeat('gov','Край: '+R(rid).name+'.');
}
function takeMayor(rid,quiet){
  S.you.home=rid;
  S.desk=newDesk('mayor',{rid});
  if(quiet)S.you.seat='mayor'; else setSeat('mayor','Город: '+R(rid).cap+'.');
}
function takeSen(rid,quiet){
  let rec=S.senate.find(s=>s.region===rid&&s.party===PL&&!s.you);
  if(!rec){                                   // своего места в крае нет: уступает сильнейшая делегация
    const here=S.senate.filter(s=>s.region===rid), by={};
    here.forEach(s=>by[s.party]=(by[s.party]||0)+1);
    const top=Object.keys(by).sort((a,b)=>by[b]-by[a])[0];
    rec=here.find(s=>s.party===top);
    S.senSeats[rec.party]--; S.senSeats[PL]=(S.senSeats[PL]||0)+1;
    rec.party=PL; rec.st={...me().st};
  }
  rec.you=true; rec.name=S.you.name; rec.loyal=100; rec.rel=100; rec.terms=1; rec.since=S.q;
  if(S.senLead&&S.senLead.id===rec.id){ S.senLead=null; seatSenLeader(true); }
  S.you.home=rid;
  S.desk=newDesk('sen',{rid}); S.desk.sid=rec.id;
  if(quiet)S.you.seat='sen'; else setSeat('sen','Место в Сенате от края '+R(rid).name+'.');
}
/* уйти с кресла: край, место в палате и портфель достаются преемнику */
function leaveDesk(was,to){
  const d=S.desk;
  if(was==='gov'&&d&&d.rid){ const g=govOf(d.rid);
    if(g&&g.you){ const n=makeGov(d.rid,PL); n.till=g.till; n.appointed=g.appointed; S.govs[d.rid]=n;
      logMsg('Край '+R(d.rid).name+' принял ваш заместитель '+n.name+'.'); } }
  if(was==='sen'){ const rec=S.senate.find(s=>s.you);
    if(rec){ rec.you=false; rec.name=depName(); rec.loyal=ri(50,80); rec.rel=ri(60,80); } }
  if(was==='min'&&to!=='min'){ const post=S.you.post, m=post&&S.ministers[post];
    if(m&&m.name===S.you.name)S.ministers[post]=makeMinister(post,S.gov.posts[post]||S.gov.lead);
    S.you.post=null; }
  if(was==='vp'&&S.vp&&S.vp.you&&to!=='vp'){ S.vp.you=false; if(S.vp.name===S.you.name)S.vp.name=depName(); }
  if(['dep','pm','vice','lead'].indexOf(to)>=0)S.you.mand=true;
  else if(to!=='min')S.you.mand=false;
}
/* кресло ушло не по вашей воле */
function lostSeat(why){
  const was=mySeat();
  setSeat(fallbackSeat(),why[0].toUpperCase()+why.slice(1)+'.');
  addCap(-8); bumpRep('comp',-2);
  logMsg('Кресло потеряно: '+why+'.',1);
  chron('Вы потеряли кресло: '+why+'.','b');
  sheetOpen({eye:'Кресло · '+dateLabel(),title:'Вы больше не '+(SEATS_YOU[was]||{name:'—'}).name.toLowerCase(),
    body:`<p class="lead">${why[0].toUpperCase()+why.slice(1)}. Политик без кресла — всё ещё политик:
        партия, имя и связи остаются при вас.</p>
      <div class="res"><span>Было</span><b class="w">${(SEATS_YOU[was]||{}).name}</b>
        <span>Стало</span><b class="w">${seatName()}</b>
        ${chief()?'':`<span>Влияние в партии</span><b>${Math.round(S.you.inf)}</b>`}</div>
      <p class="hint">Дальше — выборы, предложения и съезд. Смотрите «Ваше кресло» в «Кабинете».</p>`,
    acts:[{label:'Дальше'}]});
}

/* ─── показатели кресла ─────────────────────────────────────────── */
function minKpi(post){
  if(post==='fin'){ const b=balance(); return {v:sign(r1(b))+' млрд', ok:b>=0}; }
  if(post==='mvd'){ const u=avgUnrest(); return {v:String(Math.round(u)), ok:u<22}; }
  if(post==='def'){ const v=(S.stab+S.mood.patr)/2; return {v:String(Math.round(v)), ok:v>=55}; }
  if(post==='eco'){ return {v:sign(S.econ.growth)+'%', ok:S.econ.growth>=2}; }
  if(post==='soc'){ const v=(S.mood.pens+S.mood.work)/2; return {v:String(Math.round(v)), ok:v>=50}; }
  const v=nbTrade(); return {v:sign(r1(v)), ok:v>=0};
}
/* городское хозяйство одной цифрой */
function cityIdx(d){ return Math.round((d.road+d.util+d.yard)/3); }
/* что думает о вас центр, если вы глава края */
function centerWant(){
  let v=50-axDist(P(S.gov.lead).st,me().st)*8;
  if(S.gov.lead===PL)v+=24; else if(inCoal(PL))v+=12;
  return clamp(v,8,92);
}
/* доверие кабинета к президенту: близость курсов и то, чьё это правительство */
function cabWant(){
  if(S.gov.lead===PL)return 84;
  return clamp(62-axDist(P(S.gov.lead).st,me().st)*10+(inCoal(PL)?8:0),10,90);
}
/* место в партийном списке: чем выше влияние и теплее лидер, тем ближе к началу */
function listRank(){
  if(chief())return 1;
  return Math.round(clamp(4+(100-S.you.inf)*1.35-(S.you.lrel-50)*0.5,1,220));
}
function distChance(){
  const d=desk(), rid=(S.you.run&&S.you.run.rid)||d.rid;
  return clamp(0.25+(regApproval(rid)-45)*0.02+((d.home||50)-50)*0.012+(rep('folk')-50)*0.006,0.08,0.9);
}

/* ─── квартал за столом ─────────────────────────────────────────── */
function roleTick(){
  if(!S.you||S.over)return;
  const s=mySeat(), d=desk();
  if(!chief()){
    const drift={vp:1,gov:1.1,mayor:0.7,sen:0.8,dep:0.6,min:1,vice:1,none:0.2}[s]||0.3;
    S.you.inf=clamp(r1(S.you.inf+drift-0.35+(d.score-50)*0.02),0,100);
    S.you.lrel=clamp(r1(S.you.lrel+(55-S.you.lrel)*0.06+rnd(-1.5,1.5)),0,100);
  }
  if(s==='min')deskMin(d);
  else if(s==='gov')deskGov(d);
  else if(s==='mayor')deskMayor(d);
  else if(s==='sen')deskSen(d);
  else if(s==='pres')deskPres(d);
  else if(s==='vp')deskVP(d);
  else if(s==='dep'||s==='none'){
    d.home=clamp(r1(d.home+(regApproval(d.rid)*0.7+14-d.home)*0.12),0,100);
    d.score=clamp(r1(chief()?approval():(S.you.inf+d.home)/2),0,100);
  }
  if(S.desk&&S.desk===d){ d.hist.push(Math.round(d.score)); if(d.hist.length>8)d.hist.shift(); }
}
function deskMin(d){
  const post=S.you.post||d.post, m=S.ministers[post];
  if(!post||!m||m.name!==S.you.name||S.gov.posts[post]!==PL){ S.you.post=null; lostSeat('портфель ушёл другому'); return; }
  const k=minKpi(post);
  d.score=clamp(r1(d.score+(k.ok?4:-4)+(rep('comp')-50)*0.03),0,100);
  m.comp=Math.round(clamp(38+d.score*0.45+(rep('comp')-50)*0.2,20,92));
  if(d.score<DESK_LOW){
    d.low=(d.low||0)+1;
    if(d.low>=2&&Math.random()<0.45){
      const pm0=S.pm?S.pm.name:P(S.gov.lead).leader;
      S.ministers[post]=makeMinister(post,PL); S.you.post=null;
      lostSeat('премьер '+pm0+' отправил вас в отставку: цифры ведомства не выросли');
      return;
    }
  } else d.low=0;
  if(d.score>=78&&S.q-(S.you.seatQ||1)>=4&&!isPM()&&inCoal(PL)&&Math.random()<0.12)offerVicePM();
}
function deskGov(d){
  const rid=d.rid, g=govOf(rid);
  if(!g||!g.you){ lostSeat('край '+R(rid).name+' ушёл другому'); return; }
  d.center=clamp(r1(d.center+(centerWant()-d.center)*0.12),0,100);
  let inc=2.2+R(rid).pop*0.08+(d.center-50)*0.05+(inCoal(PL)?1.2:0);
  if(d.law&&d.law.id==='tax')inc-=1.2;
  if(d.law&&d.law.id==='pens')inc-=1.5;
  d.purse=r1(clamp(d.purse+inc,0,90));
  S.rmod[rid]=clamp(S.rmod[rid]+d.dev*0.08,-22,22);
  S.unrest[rid]=clamp(S.unrest[rid]-d.dev*0.25,0,100);
  if(d.law){
    if(d.law.id==='tax'){ S.econ.invest=r1(S.econ.invest+0.4); shiftMood('biz',0.2,true); }
    if(d.law.id==='pens')shiftMood('pens',0.25,true);
    if(d.law.id==='order'){ S.unrest[rid]=clamp(S.unrest[rid]-1.5,0,100); shiftMood('intel',-0.15,true); }
  }
  d.score=clamp(r1(d.score+(S.unrest[rid]<25?3:-3)+(regApproval(rid)>=50?2:-2)),0,100);
  g.comp=Math.round(clamp(40+d.score*0.4,25,90)); g.rel=95;
  // при вертикали чужой центр снимает того, с кем не может работать
  if(!govElected()&&S.gov.lead!==PL&&d.center<18&&Math.random()<0.3){
    seatGov(rid,S.gov.lead,'appoint');
    lostSeat('кабинет '+P(S.gov.lead).leader+' снял вас с края');
  }
}
function deskMayor(d){
  const rid=d.rid;
  d.road=clamp(d.road-ri(2,4),0,100); d.util=clamp(d.util-ri(2,3),0,100); d.yard=clamp(d.yard-ri(1,3),0,100);
  d.purse=r1(clamp(d.purse+2+(R(rid).capital?2.5:0)+R(rid).pop*0.05,0,60));
  const idx=cityIdx(d);
  d.trust=clamp(r1(d.trust+((idx*0.6+S.mood.urban*0.4)-d.trust)*0.25),0,100);
  S.rmod[rid]=clamp(S.rmod[rid]+(d.trust-50)*0.012,-22,22);
  S.unrest[rid]=clamp(S.unrest[rid]-(d.trust-50)*0.03,0,100);
  d.score=clamp(r1(d.trust*0.6+idx*0.4),0,100);
  if(S.q>=d.till){
    const ch=clamp(0.2+(d.trust-45)*0.025,0.08,0.93), win=Math.random()<ch;
    if(win){ d.till=S.q+MAYOR_TERM; addCap(6); bumpRep('folk',2);
      career('Переизбраны мэром '+R(rid).cap+'.'); chron('Мэр '+R(rid).cap+' переизбран.','g');
      logMsg('Выборы мэра '+R(rid).cap+': вы переизбраны.',1); }
    else lostSeat('город '+R(rid).cap+' выбрал другого мэра');
  }
}
function deskSen(d){
  const rec=S.senate.find(s=>s.you);
  if(!rec){ lostSeat('место в Сенате потеряно'); return; }
  rec.rel=100; rec.loyal=100; rec.name=S.you.name;
  d.home=clamp(r1(d.home+(regApproval(d.rid)*0.7+14-d.home)*0.15),0,100);
  if(d.fili&&d.fili<S.q)d.fili=null;
  d.score=clamp(r1(d.home*0.6+senRank(rec)*6+(d.hear||0)*2+10),0,100);
}
function deskPres(d){
  d.cab=clamp(r1(d.cab+(cabWant()-d.cab)*0.1),0,100);
  if(d.msg&&S.q>d.msg.until)d.msg=null;
  d.score=clamp(r1(approval()*0.6+d.cab*0.4),0,100);
}
function deskVP(d){
  if(!(S.vp&&S.vp.you)){ lostSeat('кресло вице-президента занял другой'); return; }
  S.vp.pop=Math.round(rep('folk'));
  const want=55+((S.vp.job||'none')!=='none'?8:-4)+(presOurs()?0:-20);
  d.trust=clamp(r1(d.trust+(want-d.trust)*0.1),0,100);
  d.score=clamp(r1((d.trust+rep('folk'))/2),0,100);
}

/* ─── рычаги кресла ─────────────────────────────────────────────────
   Каждый рычаг — одно действие квартала. Цена целиком: ход, вес,
   казна страны, касса партии или казна края/города. */
function deskActs(){
  const s=mySeat(), d=desk(), out=[];
  const A=(o)=>out.push(o);
  if(s==='min'){
    const post=S.you.post||d.post, md=MIN_DESK[post];
    if(md)md.acts.forEach(a=>A({...a, run:(x)=>minRun(a.id,x)}));
    A({id:'report',name:'Доклад в Собрании',cap:4,txt:'цифра в порядке — оценка растёт; нет — падает',
      run(){ const k=minKpi(post); d.score=clamp(d.score+(k.ok?7:-5),0,100); bumpRep('comp',k.ok?2:-1);
        return 'Доклад министра в Собрании: '+(k.ok?'палата довольна':'палата недовольна цифрами')+'.'; }});
  }
  if(s==='pres'){
    A({id:'msg',name:'Послание Собранию',cap:10,txt:'стабильность и доверие; кабинет охотнее исполняет поручения',
      ok:()=>d.msg?'Послание уже прозвучало в этом году':true,
      run(){ d.msg={until:S.q+3}; S.stab=clamp(S.stab+3,0,100); shiftAll(0.8); pressAll(2); d.cab=clamp(d.cab+6,0,100);
        return 'Президент выступил с посланием Собранию.'; }});
    A({id:'order',name:'Поручение правительству',cap:8,pick:'order',txt:'статья бюджета или ставка — если кабинет послушает',
      run:(x)=>presOrder(x)});
    A({id:'meet',name:'Встреча с премьером',cap:4,txt:'отношения с кабинетом +8…14',
      run(){ const v=ri(8,14); d.cab=clamp(d.cab+v,0,100); if(S.partners[S.gov.lead])S.partners[S.gov.lead].anger=Math.max(0,S.partners[S.gov.lead].anger-1);
        return 'Встреча с премьером: отношения с кабинетом +'+v+'.'; }});
    A({id:'replacevp',name:'Сменить вице-президента',ap:0,txt:'три кандидатуры, утверждает Сенат · ход и 10 веса',
      ok:()=>S.vp?true:'Кресло вице пусто',run(){ askReplaceVP(); return ''; }});
    A({id:'amnesty',name:'Помилование',cap:6,txt:'напряжённость −3, интеллигенция +2, патриоты −1,5',
      run(){ REGIONS.forEach(r=>S.unrest[r.id]=clamp(S.unrest[r.id]-3,0,100)); shiftMood('intel',2); shiftMood('patr',-1.5);
        return 'Президентское помилование к празднику.'; }});
    A({id:'abroad',name:'Государственный визит',cap:6,pick:'nb',txt:'отношения с соседом +8…13',
      run(x){ const n=nbOf(x); if(n)n.rel=clamp(n.rel+ri(8,13),0,100); bumpRep('folk',1);
        return 'Государственный визит: '+NB_(x).name+'.'; }});
  }
  if(s==='vp'){
    A({id:'chair',name:'Вести заседание Сената',cap:4,txt:'отношение 6–10 сенаторов к вам растёт',
      run(){ const pool=S.senate.filter(x=>!x.you).sort((a,b)=>Math.abs(a.rel-50)-Math.abs(b.rel-50)).slice(0,ri(6,10));
        pool.forEach(x=>x.rel=clamp(x.rel+ri(5,10),0,100)); if(S.vp)S.vp.sen=clamp((S.vp.sen||40)+1,0,100);
        return 'Вы провели заседание Сената: '+pool.length+' сенаторов стали ближе.'; }});
    A({id:'tour',name:'Поездка от имени президента',cap:3,pick:'region',txt:'поддержка и спокойствие в крае без казённых денег',
      run(x){ S.rmod[x]=clamp(S.rmod[x]+ri(2,4),-22,22); S.unrest[x]=clamp(S.unrest[x]-ri(3,6),0,100); bumpRep('folk',0.8);
        return 'Поездка вице-президента: '+R(x).name+'.'; }});
    A({id:'loyal',name:'Совещание у президента',cap:3,txt:'доверие президента +6…10',
      run(){ const v=ri(6,10); d.trust=clamp(d.trust+v,0,100); return 'Совещание у президента: доверие +'+v+'.'; }});
    A({id:'job',name:'Взять поручение',txt:'Сенат, края, соседи или партия — с согласия президента',ap:0,
      run(){ askVPJob(); return ''; }});
    A({id:'resign',name:'Подать в отставку',ap:0,txt:'уйти с поста вице и остаться в политике',run(){ askResign(); return ''; }});
    A({id:'own',name:'Своя повестка',cap:5,txt:'известность +3, доверие президента −6',
      run(){ bumpRep('folk',3); d.trust=clamp(d.trust-6,0,100); if(!chief())S.you.inf=clamp(S.you.inf+2,0,100);
        return 'Вице-президент выступил со своей повесткой.'; }});
  }
  if(s==='gov'){
    const rid=d.rid;
    A({id:'build',name:'Стройка',purse:6,txt:'развитие края +1: поддержка и спокойствие надолго',
      ok:()=>d.dev>=6?'Край застроен: больше строек не потянет':true,
      run(){ d.dev++; S.rmod[rid]=clamp(S.rmod[rid]+2,-22,22); S.unrest[rid]=clamp(S.unrest[rid]-3,0,100);
        shiftMood('work',0.5); d.score=clamp(d.score+3,0,100); return 'Край начал стройку: развитие '+d.dev+'.'; }});
    A({id:'site',name:'Выезд на место',cap:2,txt:'напряжённость в крае −6…10',
      run(){ const v=ri(6,10); S.unrest[rid]=clamp(S.unrest[rid]-v,0,100); S.rmod[rid]=clamp(S.rmod[rid]+1,-22,22);
        bumpRep('folk',0.6); return 'Губернатор выехал на место: напряжённость −'+v+'.'; }});
    A({id:'transfer',name:'Трансферт из центра',cap:6,txt:'казна края +6…12, если центр не против',
      run(){ const ok=Math.random()<clamp(0.3+(d.center-40)*0.012,0.1,0.92);
        if(!ok){ d.center=clamp(d.center-3,0,100); return 'Центр отказал краю в трансферте.'; }
        const v=ri(6,12); d.purse=r1(d.purse+v); d.center=clamp(d.center-2,0,100);
        return 'Центр выделил краю '+v+' млрд.'; }});
    A({id:'law',name:'Закон края',cap:8,pick:'glaw',txt:'каникулы бизнесу, надбавка пенсионерам или порядок на улицах',
      run:(x)=>{ d.law={id:x,q:S.q}; const L=GOV_LAWS.find(l=>l.id===x);
        return 'Заксобрание края приняло: '+L.name.toLowerCase()+'.'; }});
    A({id:'report',name:'Доклад в правительстве',cap:4,txt:'отношения с центром +8…12',
      run(){ const v=ri(8,12); d.center=clamp(d.center+v,0,100); if(!inCoal(PL))bumpRep('firm',-0.5);
        return 'Губернатор доложил в правительстве: отношения с центром +'+v+'.'; }});
    A({id:'fight',name:'Спор с центром',cap:3,txt:'край и страна вас заметят; центр — тоже',
      run(){ S.rmod[rid]=clamp(S.rmod[rid]+4,-22,22); bumpRep('folk',2); bumpRep('firm',2); d.center=clamp(d.center-15,0,100);
        if(!chief())S.you.inf=clamp(S.you.inf+3,0,100); return 'Губернатор публично поспорил с центром.'; }});
    A({id:'deleg',name:'Делегация края',cap:5,txt:'сенаторы и депутаты от края теплеют к вам',
      run(){ let n=0; S.senate.concat(S.deputies).forEach(x=>{ if(x.region===rid&&!x.you){ x.rel=clamp(x.rel+ri(5,9),0,100); n++; } });
        return 'Встреча с делегацией края: '+n+' человек.'; }});
  }
  if(s==='mayor'){
    const rid=d.rid;
    const fix=(k,g,w)=>()=>{ const v=ri(12,18); d[k]=clamp(d[k]+v,0,100); shiftMood(g,w); d.trust=clamp(d.trust+2,0,100);
      return R(rid).cap+': '+{road:'дороги',util:'трубы',yard:'дворы'}[k]+' +'+v+'.'; };
    A({id:'road',name:'Дороги и транспорт',purse:4,txt:'дороги +12…18, горожане довольны',run:fix('road','urban',0.8)});
    A({id:'util',name:'Трубы и ЖКХ',purse:4,txt:'хозяйство +12…18, пенсионеры довольны',run:fix('util','pens',0.8)});
    A({id:'yard',name:'Дворы и парки',purse:3,txt:'дворы +12…18, молодёжь довольна',run:fix('yard','youth',0.8)});
    A({id:'recv',name:'Приём граждан',cap:2,txt:'доверие горожан +4…7',
      run(){ const v=ri(4,7); d.trust=clamp(d.trust+v,0,100); bumpRep('folk',0.8); S.unrest[rid]=clamp(S.unrest[rid]-2,0,100);
        return 'Приём граждан в мэрии: доверие +'+v+'.'; }});
    A({id:'levy',name:'Городской сбор',cap:3,txt:'казна города +5…8, доверие −4',
      run(){ const v=ri(5,8); d.purse=r1(d.purse+v); d.trust=clamp(d.trust-4,0,100); shiftMood('biz',-0.6);
        return 'Город ввёл сбор: +'+v+' млрд.'; }});
    A({id:'ask',name:'Деньги у губернатора',cap:4,txt:'казна города +4…9, если губернатор расположен',
      run(){ const g=govOf(rid), rel=g?(g.party===PL?80:g.rel):40;
        if(Math.random()>clamp(0.2+rel*0.008,0.15,0.9))return 'Губернатор отказал городу.';
        const v=ri(4,9); d.purse=r1(d.purse+v); return 'Губернатор выделил городу '+v+' млрд.'; }});
  }
  if(s==='sen'){
    A({id:'fili',name:'Затянуть прения',cap:8,txt:'закон кабинета в этом квартале застрянет без '+cloture()+' голосов',
      ok:()=>d.fili?'Прения уже затянуты':(isPM()?'Кабинет ваш: тянуть прения против себя незачем':true),
      run(){ d.fili=S.q; return 'Вы взяли слово в Сенате и не отдаёте его.'; }});
    A({id:'hear',name:'Слушания в комитете',cap:6,pick:'minister',txt:'министра под лупу: его цифры, ваше имя в газетах',
      run(x){ return hearing(x); }});
    A({id:'peers',name:'Работа с коллегами',cap:5,pick:'party',txt:'сенаторы одной фракции теплеют к вам',
      run(x){ let n=0; S.senate.forEach(z=>{ if(z.party===x&&!z.you){ z.rel=clamp(z.rel+ri(4,9),0,100); n++; } });
        return 'Разговор с сенаторами «'+P(x).name+'»: '+n+' человек.'; }});
    A({id:'home',name:'Интересы края',cap:4,txt:'поддержка в крае +3, напряжённость −3',
      run(){ S.rmod[d.rid]=clamp(S.rmod[d.rid]+3,-22,22); S.unrest[d.rid]=clamp(S.unrest[d.rid]-3,0,100); d.home=clamp(d.home+4,0,100);
        return 'Сенатор отстоял интересы края '+R(d.rid).name+'.'; }});
  }
  if(s==='dep'||s==='none'){
    if(s==='none')A({id:'partywork',name:'Партийная работа',txt:chief()?'касса +6, вес +4':'влияние +5…8, лидер доволен',
      run(){ if(chief()){ S.funds=r1(S.funds+6); addCap(4); return 'Партийная работа: касса и вес.'; }
        const v=ri(5,8); S.you.inf=clamp(S.you.inf+v,0,100); S.you.lrel=clamp(S.you.lrel+2,0,100);
        return 'Партийная работа: влияние +'+v+'.'; }});
    A({id:'office',name:s==='dep'?'Приём в округе':'Работа в округе',funds:s==='dep'?3:4,txt:'поддержка в округе, известность +1',
      run(){ d.home=clamp(d.home+6,0,100); S.rmod[d.rid]=clamp(S.rmod[d.rid]+1.5,-22,22); bumpRep('folk',1.2);
        return 'Работа в округе: '+R(d.rid).name+'.'; }});
    if(s==='dep'){
      if(!chief())A({id:'faction',name:'Работа во фракции',cap:3,txt:'влияние +4…7, лидер доволен',
        run(){ const v=ri(4,7); S.you.inf=clamp(S.you.inf+v,0,100); S.you.lrel=clamp(S.you.lrel+3,0,100);
          S.deputies.filter(x=>x.party===PL).slice(0,12).forEach(x=>x.rel=clamp(x.rel+1,0,100));
          return 'Работа во фракции: влияние +'+v+'.'; }});
      A({id:'inquiry',name:'Депутатский запрос',cap:4,pick:'minister',txt:'неудобный вопрос министру, компетентность +2',
        run(x){ return hearing(x,true); }});
      A({id:'speech',name:'Выступление с трибуны',cap:2,txt:'известность +2, влияние +2, лидер морщится',
        run(){ bumpRep('folk',2); if(!chief()){ S.you.inf=clamp(S.you.inf+2,0,100); S.you.lrel=clamp(S.you.lrel-2,0,100); }
          return 'Выступление с трибуны Собрания.'; }});
    } else {
      A({id:'column',name:'Колонка в газете',pick:'press',txt:'издание теплеет, известность +1',
        run(x){ const o=pressOf(x); if(o)o.rel=clamp(o.rel+ri(4,8),0,100); bumpRep('folk',1);
          if(!chief())S.you.inf=clamp(S.you.inf+1,0,100);
          return 'Ваша колонка в «'+PRESS.find(p=>p.id===x).name+'».'; }});
      A({id:'donors',name:'Собрать деньги партии',txt:'касса +10…18'+(chief()?'':', влияние +3'),
        run(){ const v=ri(10,18); S.funds=r1(S.funds+v); if(!chief())S.you.inf=clamp(S.you.inf+3,0,100);
          return 'Вы собрали партии '+v+' млн.'; }});
    }
    if(!chief())A({id:'district',name:'Выдвинуться по округу',funds:DIST_FUNDS,
      txt:'на выборах — мандат по округу, а не по месту в списке',
      ok:()=>S.you.run?'Вы уже выдвинуты':(!S.camp?'Выдвигаются во время кампании':true),
      run(){ S.you.run={rid:d.rid}; return 'Вы выдвинулись по округу '+R(d.rid).name+'.'; }});
  }
  if(!chief())A({id:'congress',name:'Созвать съезд',cap:CONGRESS_CAP,funds:CONGRESS_FUNDS,
    txt:'бросить вызов лидеру: '+me().leader,ap:0,
    ok:()=>congressWhy(),
    run(){ askCongress(); return ''; }});
  return out;
}
/* закон края — три на выбор */
const GOV_LAWS=[
  {id:'tax',  name:'Налоговые каникулы', hint:'инвестиции и бизнес · казна края беднеет'},
  {id:'pens', name:'Надбавка пенсионерам', hint:'пенсионеры довольны · казна края беднеет'},
  {id:'order',name:'Порядок на улицах', hint:'напряжённость гаснет · интеллигенция ворчит'},
];
/* поручение президента кабинету */
const PRES_ORDERS=[
  {id:'pol', name:'Больше денег на порядок', run:()=>S.spend.pol<4&&!!(S.spend.pol++,1)},
  {id:'soc', name:'Больше денег на соцвыплаты', run:()=>S.spend.soc<4&&!!(S.spend.soc++,1)},
  {id:'inf', name:'Больше денег на стройки', run:()=>S.spend.inf<4&&!!(S.spend.inf++,1)},
  {id:'edu', name:'Больше денег на образование', run:()=>S.spend.edu<4&&!!(S.spend.edu++,1)},
  {id:'cut', name:'Сократить расходы', run:()=>{ const x=SPEND.slice().sort((a,b)=>S.spend[b.id]-S.spend[a.id])[0];
    return S.spend[x.id]>0&&!!(S.spend[x.id]--,1); }},
  {id:'corp',name:'Снизить налог на прибыль', run:()=>S.tax.corp>0&&!!(S.tax.corp--,1)},
];
function presOrder(id){
  const d=desk(), o=PRES_ORDERS.find(x=>x.id===id);
  const ch=clamp(0.3+(d.cab-50)*0.012+(d.msg?0.12:0)+(S.gov.lead===PL?0.4:0),0.1,0.95);
  if(Math.random()>ch){ d.cab=clamp(d.cab-5,0,100); return 'Кабинет '+P(S.gov.lead).leader+' не стал исполнять поручение: «'+o.name.toLowerCase()+'».'; }
  if(!o.run())return 'Поручение исполнено формально: статья уже на пределе.';
  d.cab=clamp(d.cab-2,0,100);
  return 'Кабинет исполнил поручение президента: '+o.name.toLowerCase()+'.';
}
/* министра — на слушания: его цифры под лупой, ваше имя в газетах */
function hearing(post,dep){
  const m=minOf(post), d=desk();
  if(!m)return '';
  const mine=m.party===PL||inCoal(m.party);
  m.comp=clamp(m.comp-(mine?1:ri(2,5)),10,95);
  bumpRep('comp',dep?2:1.5); bumpRep('folk',1);
  if(!mine)pressAll(1);
  if(!dep)d.hear=(d.hear||0)+1;
  if(!chief())S.you.inf=clamp(S.you.inf+(mine?-1:2),0,100);
  return (dep?'Запрос министру ':'Слушания: ')+m.name+' ('+POSTS.find(p=>p.id===post).name.toLowerCase()+').';
}
/* рычаги министра */
function minRun(id,x){
  switch(id){
    case 'audit':{ const v=ri(6,11); S.treasury=r1(S.treasury+v); shiftMood('biz',-2.5); bumpCapture(-3); bumpRep('firm',1);
      return 'Проверка крупных плательщиков: в казну '+v+' млрд.'; }
    case 'bonds':{ S.treasury=r1(S.treasury+20); S.debt=r1(S.debt+21); if(S.debt>200)bumpRep('comp',-0.5);
      return 'Облигационный заём: +20 млрд в казну.'; }
    case 'thrift':{ const v=ri(4,7); S.treasury=r1(S.treasury+v); shiftMood('intel',-1.2); shiftMood('pens',-1);
      return 'Экономия ведомств: '+v+' млрд.'; }
    case 'police':{ const v=ri(8,13); S.unrest[x]=clamp(S.unrest[x]-v,0,100); shiftMood('intel',-1); shiftMood('youth',-1);
      return 'Полиция усилена: '+R(x).name+', напряжённость −'+v+'.'; }
    case 'prev':{ REGIONS.forEach(r=>S.unrest[r.id]=clamp(S.unrest[r.id]-ri(2,4),0,100)); shiftMood('patr',1);
      return 'Профилактика по стране.'; }
    case 'purge':{ bumpRep('honest',3); bumpCapture(-2); pressAll(2); return 'Чистка в ведомстве.'; }
    case 'drill':{ shiftMood('patr',3); S.stab=clamp(S.stab+2,0,100);
      if(S.nb)Object.values(S.nb).forEach(n=>n.rel=clamp(n.rel-2,0,100)); return 'Учения: армия показала себя.'; }
    case 'order':{ S.unrest[x]=clamp(S.unrest[x]-5,0,100); S.rmod[x]=clamp(S.rmod[x]+3,-22,22); shiftMood('work',1.5);
      S.econ.invest=r1(S.econ.invest+2); return 'Оборонзаказ: '+R(x).name+'.'; }
    case 'draft':{ shiftMood('youth',4); shiftMood('pens',1); shiftMood('patr',-2); return 'Реформа призыва.'; }
    case 'forum':{ const v=ri(5,9); S.econ.invest=r1(S.econ.invest+v); shiftMood('biz',2); return 'Инвестиционный форум: +'+v+'.'; }
    case 'jobs':{ S.econ.unemp=r1(clamp(S.econ.unemp-0.3,2.5,26)); S.rmod[x]=clamp(S.rmod[x]+2,-22,22); shiftMood('work',1.5);
      return 'Программа занятости: '+R(x).name+'.'; }
    case 'dereg':{ S.econ.growth=r2(S.econ.growth+0.25); S.econ.invest=r1(S.econ.invest+3); shiftMood('work',-1.5); shiftMood('intel',1);
      return 'Сняты барьеры для бизнеса.'; }
    case 'index':{ shiftMood('pens',4); shiftMood('work',1.5); S.econ.inf=r1(S.econ.inf+0.1); return 'Выплаты проиндексированы.'; }
    case 'aid':{ S.unrest[x]=clamp(S.unrest[x]-6,0,100); S.rmod[x]=clamp(S.rmod[x]+3,-22,22); return 'Адресная помощь: '+R(x).name+'.'; }
    case 'funds':{ const v=ri(3,6); S.treasury=r1(S.treasury+v); bumpRep('honest',2); shiftMood('pens',-1);
      return 'Проверка фондов: '+v+' млрд вернулись в казну.'; }
    case 'trip':{ const n=nbOf(x), v=ri(6,11); if(n)n.rel=clamp(n.rel+v,0,100); return 'Визит: '+NB_(x).name+', +'+v+'.'; }
    case 'trade':{ S.world.demand=clamp(S.world.demand+4,55,142); shiftMood('biz',1.5); return 'Торговая миссия.'; }
    case 'loan':{ S.treasury=r1(S.treasury+16); S.debt=r1(S.debt+17); return 'Внешний кредит: +16 млрд.'; }
  }
  return '';
}
/* нажать рычаг: сначала выбор, потом цена, потом эффект */
function deskAct(id,arg){
  const a=deskActs().find(x=>x.id===id); if(!a)return;
  const why=a.ok?a.ok():true;
  if(why!==true){ toast(why||'Сейчас нельзя'); return; }
  if(a.pick&&arg===undefined){ deskPick(a); return; }
  const d=desk();
  if(a.purse&&(d.purse||0)<a.purse){ toast('В казне '+(mySeat()==='mayor'?'города':'края')+' нет '+a.purse+' млрд'); return; }
  if(a.ap!==0&&!pay({ap:1,cap:a.cap?capCost(a.cap):0,gold:a.gold||0,funds:a.funds||0},a.name))return;
  if(a.purse)d.purse=r1(d.purse-a.purse);
  S.deskUsed=true;
  if(a.ap!==0&&d.kind!=='min'&&d.kind!=='pres')d.score=clamp(d.score+1,0,100);
  const msg=a.run(arg);
  if(msg){ logMsg(msg); toast(msg.length>60?'Сделано':msg); }
  render();
}
function deskPick(a){
  let opts=[];
  const go=v=>()=>deskAct(a.id,v);
  if(a.pick==='region')opts=REGIONS.map(r=>({label:r.name,hint:'напряжённость '+Math.round(S.unrest[r.id])+' · поддержка '+Math.round(regApproval(r.id))+'%',fn:go(r.id)}));
  if(a.pick==='nb')opts=NEIGHBOURS.map(x=>({label:x.name,hint:'отношения '+Math.round(nbOf(x.id).rel)+' · '+nbWord(nbOf(x.id).rel),fn:go(x.id)}));
  if(a.pick==='minister')opts=POSTS.filter(p=>minOf(p.id)&&minOf(p.id).name!==S.you.name).map(p=>{ const m=minOf(p.id);
    return {label:p.name+' · '+m.name,hint:P(m.party).short+' · '+minWord(m),fn:go(p.id)}; });
  if(a.pick==='party')opts=S.parties.filter(p=>senSeatsOf(p.id)>0).map(p=>({label:p.name,hint:senSeatsOf(p.id)+' в Сенате',fn:go(p.id)}));
  if(a.pick==='press')opts=PRESS.map(o=>({label:o.name,hint:'отношение '+Math.round(pressOf(o.id).rel),fn:go(o.id)}));
  if(a.pick==='glaw')opts=GOV_LAWS.map(l=>({label:l.name+(desk().law&&desk().law.id===l.id?' · действует':''),hint:l.hint,fn:go(l.id)}));
  if(a.pick==='order')opts=PRES_ORDERS.map(o=>({label:o.name,hint:'шанс '+Math.round(clamp(0.3+(desk().cab-50)*0.012+(desk().msg?0.12:0)+(S.gov.lead===PL?0.4:0),0.1,0.95)*100)+'%',fn:go(o.id)}));
  opts.push({label:'Отмена',hint:'ход не тратится',fn(){}});
  sheetOpen({eye:seatTitle()+' · 1 действие',title:a.name,body:`<p class="lead">${a.txt[0].toUpperCase()+a.txt.slice(1)}.</p>`,opts});
}

/* ─── съезд ─────────────────────────────────────────────────────────
   Лидера меняют делегаты, а не избиратели. Они смотрят на влияние,
   на имя в стране и на то, чего партия добилась при нынешнем лидере. */
function congressWhy(){
  if(chief())return 'Партию ведёте вы';
  if(S.you.inf<CONGRESS_INF)return 'Нужно влияние '+CONGRESS_INF+', у вас '+Math.round(S.you.inf);
  if(S.you.congQ&&S.q-S.you.congQ<CONGRESS_COOL)return 'После проигранного съезда нужно выждать';
  return true;
}
function congressOdds(){
  const you=S.you.inf+(rep('folk')-50)*0.3+(approval()-45)*0.2;
  let him=50+(S.gov.lead===PL?8:0)+(presOurs()&&S.pres.name===me().leader?8:0);
  if(S.you.lrel>65)him-=5;
  if(seatsOf(PL)<SEATS*0.15)him-=6;
  return clamp(0.5+(you-him)*0.03,0.05,0.95);
}
function askCongress(){
  const why=congressWhy(); if(why!==true){ toast(why); return; }
  const ch=congressOdds();
  sheetOpen({eye:'Партия · '+dateLabel(),title:'Съезд «'+me().name+'»',
    body:`<p class="lead">Делегаты выбирают между ${me().leader} и вами. Проигравший остаётся в партии, но
        не на прежнем месте: съезды не прощают ни вызова, ни трусости.</p>
      <div class="res"><span>Ваше влияние</span><b>${Math.round(S.you.inf)}</b>
        <span>Отношение лидера</span><b>${Math.round(S.you.lrel)}</b>
        <span>Известность</span><b>${Math.round(rep('folk'))}</b>
        <span>Шанс</span><b class="${ch>=0.5?'good':'bad'}">${Math.round(ch*100)}%</b>
        <span>Цена</span><b>1 действие · ${CONGRESS_CAP} веса · ${CONGRESS_FUNDS} млн</b></div>`,
    opts:[{label:'Созвать съезд',hint:'ход, вес и касса тратятся сразу',fn:()=>runCongress()},
      {label:'Не сейчас',hint:'набрать ещё влияния',fn(){}}]});
}
function runCongress(){
  if(!pay({ap:1,cap:CONGRESS_CAP,funds:CONGRESS_FUNDS},'Съезд партии'))return;
  const ch=congressOdds(), win=Math.random()<ch, old=me().leader;
  S.you.congQ=S.q;
  if(win){ becomeChief('съезд');
    sheetOpen({eye:'Итог съезда',title:'Партия — ваша',
      body:`<p class="lead">Делегаты выбрали вас. ${old} поздравил первым — так принято, и так легче готовить реванш.</p>
        <div class="res"><span>Лидер партии</span><b class="w">${S.you.name}</b>
          <span>Ваше кресло</span><b class="w">${seatTitle()}</b></div>
        <p class="hint">Теперь линия партии, коалиция и список — ваши решения.${isPM()?' Кабинет партии переходит к вам.':''}</p>`,
      acts:[{label:'Принять партию'}]});
  } else {
    S.you.inf=clamp(S.you.inf-18,0,100); S.you.lrel=clamp(S.you.lrel-20,0,100); addCap(-8);
    logMsg('Съезд оставил лидером '+old+'. Ваше влияние упало.',1);
    chron('Съезд «'+me().name+'» не поддержал вызов лидеру.','b');
    sheetOpen({eye:'Итог съезда',title:'Лидером остался '+old,
      body:`<p class="lead">Делегаты не рискнули. ${old} улыбается на трибуне и не смотрит в вашу сторону.</p>
        <div class="res"><span>Влияние</span><b class="bad">${Math.round(S.you.inf)}</b>
          <span>Отношение лидера</span><b class="bad">${Math.round(S.you.lrel)}</b>
          <span>Новый съезд</span><b>не раньше чем через ${quarters(CONGRESS_COOL)}</b></div>`,
      acts:[{label:'Дальше'}]});
  }
  render();
}
/* стать лидером партии: кабинет партии, если он есть, переходит к вам */
function becomeChief(how){
  const old=me().leader;
  S.you.chief=true; me().leader=S.you.name; S.you.inf=Math.max(S.you.inf,70); S.challenge=null;
  career('Избраны лидером партии ('+how+'). Прежний лидер — '+old+'.');
  chron(S.you.name+' возглавил «'+me().name+'».','g');
  logMsg('Вы возглавили партию «'+me().name+'».',1);
  if(S.gov.lead===PL&&mySeat()!=='pres'){
    S.role='pm'; S.partners={};
    coalition().filter(id=>id!==PL).forEach(id=>S.partners[id]={patience:3,anger:1});
    setSeat('pm','Кабинет партии перешёл к вам.');
    syncCabinet();
  } else if(mySeat()==='dep'&&!inCoal(PL))setSeat('lead','Фракция в оппозиции — ваша.');
  addCap(10);
}
/* лидер без вас: сам решает, кто получит программу */
function autoPromises(){
  const pool=PROMISES.slice().sort(()=>Math.random()-0.5).slice(0,2);
  S.promises=pool.map(p=>({id:p.id,given:S.q}));
  logMsg('Программу созыва огласил '+me().leader+': '+pool.map(p=>p.name.toLowerCase()).join('; ')+'.',1);
}
/* правительство вашей партии без вас: кабинет собирает её лидер */
function npcGov(){
  S.gov={lead:PL,coal:[PL],posts:{}}; POSTS.forEach(p=>S.gov.posts[p.id]=PL);
  S.parties.filter(p=>p.id!==PL).sort((a,b)=>axDist(a.st,me().st)-axDist(b.st,me().st)).forEach(p=>{
    if(coalSeats()>=MAJ||axDist(p.st,me().st)>=1.95)return;
    S.gov.coal.push(p.id); givePosts(p.id,partyPrice(p.id)); });
  S.role='pm'; S.partners={}; S.pacts={}; S.crisis=null;
  syncCabinet();
  startTerm();
  logMsg('Кабинет партии собрал '+me().leader+': '+coalition().map(id=>P(id).short).join(', ')+'.',1);
  sheetOpen({eye:'Правительство сформировано',title:'Кабинет ведёт '+me().leader,
    body:`<p class="lead">Партия выиграла, но кабинет собирает её лидер. У коалиции ${coalSeats()} мандатов из ${MAJ} нужных.</p>
      <div class="res"><span>Премьер</span><b class="w">${me().leader}</b>
        <span>Ваше кресло</span><b class="w">${seatTitle()}</b>
        <span>Ваше влияние</span><b>${Math.round(S.you.inf)}</b></div>
      <p class="hint">Премьер может позвать вас в кабинет. Съезд может сделать премьером вас.</p>`,
    acts:[{label:'Принять'}]});
}

/* ─── кандидат партии в президенты ─────────────────────────────────
   Лидер идёт сам, если не проиграл праймериз; не лидер — только
   выиграв их. Иначе на бюллетене чужое лицо вашей партии. */
function plCandYou(){ return S.primWin===false?false:(chief()||S.primWin===true); }
function plCandName(){ return plCandYou()?S.you.name:(S.primWin===false&&S.primLost?S.primLost:me().leader); }

/* ─── личный итог всеобщих выборов ──────────────────────────────── */
function selfElection(seats){
  const s=mySeat(), n=seats[PL]||0;
  if(['dep','lead','pm','vice','none'].indexOf(s)<0){ S.you.run=null; return ''; }
  let got=false, how='';
  if(chief()){ got=n>0; how='первым номером списка'; }
  else {
    const rank=listRank();
    if(S.you.run){ got=Math.random()<distChance(); if(got)how='по округу '+R(S.you.run.rid).name; }
    if(!got&&rank<=n){ got=true; how=rank+'-м номером списка'; }
    if(!got)how='номер '+rank+' при '+mandates(n)+(S.you.run?', округ проигран':'');
  }
  S.you.run=null;
  if(got){ if(s==='none')setSeat('dep','Избраны в Собрание '+how+'.'); addCap(4);
    if(!chief())S.you.inf=clamp(S.you.inf+5,0,100); }
  else if(s!=='none')setSeat('none','Не прошли в Собрание.');
  return `<div class="res" style="margin-top:8px"><span>Вы лично</span><b class="w ${got?'good':'bad'}">${got?'мандат · '+how:'без мандата · '+how}</b></div>`;
}

/* ─── президентская подпись ─────────────────────────────────────────
   Если президент — вы, закон кабинета не вступает в силу без вас. */
function askSign(bill,res,up){
  const t=T(bill.topic), p=P(bill.by), d=desk();
  const gap=Math.abs((me().st[t.ax]||0)-bill.stance);
  const over=res.yes>=superN();
  const cost=capCost(6,'veto');
  const win=GROUPS.filter(g=>(t.gr[g.id]||0)*bill.stance>1).map(g=>g.name.toLowerCase());
  const lose=GROUPS.filter(g=>(t.gr[g.id]||0)*bill.stance<-1).map(g=>g.name.toLowerCase());
  sheetOpen({eye:'На подпись президенту · '+dateLabel(),title:t.name,
    body:`<p class="lead">«${p.name}» провела закон через обе палаты: ${stanceLine(bill).toLowerCase()}.
        Без вашей подписи он не вступит в силу.</p>
      <div class="res"><span>Собрание · Сенат</span><b>${res.yes}:${res.no} · ${up.yes}:${up.no}</b>
        <span>Расхождение с вашим курсом</span><b class="${gap>=1.5?'bad':'good'}">${gap.toFixed(1)}</b>
        <span>Выиграют</span><b class="w">${win.join(', ')||'никто заметно'}</b>
        <span>Проиграют</span><b class="w">${lose.join(', ')||'никто заметно'}</b>
        <span>Преодолеть вето</span><b class="${over?'bad':'good'}">${over?'голосов хватит':'не хватит'}: ${res.yes} из ${superN()}</b>
        <span>Отношения с кабинетом</span><b>${Math.round(d.cab||50)}</b></div>`,
    opts:[
      {label:'Подписать',hint:'закон вступает в силу · кабинет доволен',fn(){
        enact(bill); if(d.cab!==undefined)d.cab=clamp(d.cab+3,0,100);
        logMsg('Вы подписали закон кабинета «'+t.name+'».',1); render(); }},
      {label:'Вето',hint:(over?'Собрание может преодолеть':'закон не вступит в силу')+' · '+cost+' веса',fn(){
        if(S.cap<cost){ toast('Не хватает веса: закон подписан'); enact(bill); render(); return; }
        S.cap-=cost; S.pres.vetoes++;
        if(d.cab!==undefined)d.cab=clamp(d.cab-8,0,100);
        if(over&&Math.random()<0.7){ enact(bill); addCap(-4);
          logMsg('Собрание преодолело ваше вето: «'+t.name+'» вступил в силу.',1);
          chron('Вето президента преодолено: «'+t.name.toLowerCase()+'».','b');
        } else { bumpRep('firm',2);
          logMsg('Ваше вето остановило закон «'+t.name+'».',1);
          chron('Президент наложил вето на «'+t.name.toLowerCase()+'».',''); }
        render(); }}]});
}

/* ─── путь дальше ───────────────────────────────────────────────── */
function deskPath(){
  const s=mySeat(), d=desk(), out=[], add=(ok,t,i)=>out.push({ok,t,i});
  const toVote=aTerm()-(S.q-S.termStart);
  if(!chief()){
    add(S.you.inf>=CONGRESS_INF,'Съезд: влияние от '+CONGRESS_INF+' — можно бросить вызов лидеру',Math.round(S.you.inf)+' из '+CONGRESS_INF);
  }
  if(s==='dep'||s==='none'){
    if(!chief()){ const r=listRank(), n=seatsOf(PL);
      add(r<=n,'Место в списке проходное, если номер не выше числа мандатов','№'+r+' · '+mandates(n)); }
    add(!!S.you.run||null,'Мандат по округу: выдвижение во время кампании',S.you.run?'выдвинуты':S.camp?'можно сейчас':'через '+quarters(Math.max(0,toVote-CAMP+1)));
    add(null,'Всеобщие выборы',toVote>0?'через '+quarters(toVote):'в этом квартале');
    if(inCoal(PL))add(null,'Партия в кабинете: могут позвать министром','по оценке работы');
  }
  if(s==='min'){ const k=minKpi(S.you.post);
    add(k.ok,'Цифра ведомства: '+MIN_DESK[S.you.post].kpi.toLowerCase()+' — '+MIN_DESK[S.you.post].goal,k.v);
    add(d.score>=DESK_LOW,'Оценка выше '+DESK_LOW+' — иначе премьер отправит в отставку',Math.round(d.score));
    add(d.score>=78,'Оценка от 78 — зовут вице-премьером',Math.round(d.score)); }
  if(s==='gov'){
    add(S.unrest[d.rid]<25,'Напряжённость в крае ниже 25',String(Math.round(S.unrest[d.rid])));
    add(regApproval(d.rid)>=50,'Поддержка в крае от 50% — переизбрание вероятно',Math.round(regApproval(d.rid))+'%');
    const need=(S.gov.lead===PL||inCoal(PL))?30:55;
    add(govElected()?null:d.center>=need,govElected()?'Главу края выбирают сами жители'
      :'Вертикаль: в конце срока кабинет продлит полномочия, если отношения от '+need,Math.round(d.center)+' из '+need);
    add(null,'Срок в крае','до '+shortDate(govOf(d.rid)?govOf(d.rid).till:S.q)); }
  if(s==='mayor'){
    add(d.trust>=55,'Доверие горожан от 55 — переизбрание вероятно',String(Math.round(d.trust)));
    add(cityIdx(d)>=55,'Городское хозяйство от 55',String(cityIdx(d)));
    const g=govOf(d.rid);
    add(null,'Выборы главы края — шанс стать губернатором',g?'в '+shortDate(g.till):'—');
    add(null,'Срок мэра','до '+shortDate(d.till)); }
  if(s==='sen'){ const rec=S.senate.find(x=>x.you);
    add(d.home>=50,'Поддержка в крае от 50 — место удержите',String(Math.round(d.home)));
    add(null,rec&&rec.life?'Место пожизненное, выборы класса вас не касаются':'Выборы вашего класса',rec&&rec.life?'ст. 96':rec?'класс '+(rec.cls+1)+' · каждые '+quarters(senCyc()):'—');
    add(null,'Второй номер в президентском списке','могут позвать'); }
  if(s==='pres'){
    add(d.cab>=45,'Отношения с кабинетом от 45 — поручения исполняют',String(Math.round(d.cab)));
    add(approval()>=45,'Одобрение от 45% — переизбрание вероятно',Math.round(approval())+'%');
    add(null,'Президентские выборы','через '+quarters(presLeft())); }
  if(s==='vp'){
    add(d.trust>=50,'Доверие президента от 50',String(Math.round(d.trust)));
    add(null,'Если кресло президента освободится — оно ваше','наследование');
    add(null,'Президентские выборы',presLeft()?'через '+quarters(presLeft()):'в этом квартале'); }
  return out;
}
function deskKpis(){
  const s=mySeat(), d=desk(), k=[], add=(i,v,sp,cls)=>k.push({i,v,sp,cls});
  if(!chief())add('Влияние в партии',Math.round(S.you.inf),'съезд с '+CONGRESS_INF,S.you.inf>=CONGRESS_INF?'on':'');
  if(s==='min'){ const x=minKpi(S.you.post);
    add(MIN_DESK[S.you.post].kpi,x.v,'цель: '+MIN_DESK[S.you.post].goal,x.ok?'on':'warn');
    add('Оценка премьера',Math.round(d.score),d.score<DESK_LOW?'на грани отставки':'из 100',d.score<DESK_LOW?'bad':'');
    add('Ведомство',sign(Math.round(minPower(S.you.post)*100))+'%','к силе портфеля'); }
  if(s==='gov'){ add('Казна края',Math.round(d.purse)+' млрд','доход '+sign(r1(2.2+R(d.rid).pop*0.08+(d.center-50)*0.05))+' в квартал');
    add('Напряжённость',Math.round(S.unrest[d.rid]),unrestWord(S.unrest[d.rid]),S.unrest[d.rid]>=25?'warn':'on');
    add('Поддержка',Math.round(regApproval(d.rid))+'%','стройки: '+d.dev,regApproval(d.rid)>=50?'on':'');
    add('Центр',Math.round(d.center),d.law?'закон: '+GOV_LAWS.find(l=>l.id===d.law.id).name.toLowerCase():'закона края нет',d.center<25?'bad':''); }
  if(s==='mayor'){ add('Казна города',Math.round(d.purse)+' млрд',R(d.rid).cap);
    add('Доверие горожан',Math.round(d.trust),'срок до '+shortDate(d.till),d.trust>=55?'on':'warn');
    add('Дороги · трубы · дворы',Math.round(d.road)+' · '+Math.round(d.util)+' · '+Math.round(d.yard),'ветшают каждый квартал');
    add('Хозяйство',cityIdx(d),'среднее по городу',cityIdx(d)>=55?'on':''); }
  if(s==='sen'){ const rec=S.senate.find(x=>x.you);
    add('Поддержка в крае',Math.round(d.home),R(d.rid).name,d.home>=50?'on':'');
    add('Стаж',rec?plural(senRank(rec),'срок','срока','сроков'):'—','старшинство в палате');
    add('Слушания',d.hear||0,'министров вызвано');
    add('Прения',d.fili?'затянуты':'нет',d.fili?'кабинет ждёт':'в запасе',d.fili?'on':''); }
  if(s==='pres'){ add('Кабинет',Math.round(d.cab),P(S.gov.lead).leader,d.cab>=45?'on':'warn');
    add('Одобрение',Math.round(approval())+'%','в стране');
    add('Вето',S.pres.vetoes||0,'за срок');
    add('До выборов',presLeft(),'кварталов'); }
  if(s==='vp'){ add('Доверие президента',Math.round(d.trust),S.pres?S.pres.name:'—',d.trust>=50?'on':'warn');
    add('Палата',S.vp?S.vp.sen:0,'умение вести Сенат');
    add('Поручение',S.vp&&S.vp.job&&S.vp.job!=='none'?(VP_JOBS.find(j=>j.id===S.vp.job)||{}).name:'нет','от президента'); }
  if(s==='dep'||s==='none'){ add('Округ',Math.round(d.home),R(d.rid).name,d.home>=50?'on':'');
    if(!chief()){ const r=listRank(); add('Место в списке','№'+r,'у фракции '+mandates(seatsOf(PL)),r<=seatsOf(PL)?'on':'warn'); }
    add('Известность',Math.round(rep('folk')),'в стране'); }
  return k;
}
/* что сказать в «Что сделать сейчас» */
function deskAdvice(){
  const s=mySeat(); if(['pm','vice','lead'].indexOf(s)>=0)return null;
  const d=desk();
  if(!chief()&&congressWhy()===true&&congressOdds()>=0.5)
    return ['Созовите съезд','Влияние '+Math.round(S.you.inf)+', шанс '+Math.round(congressOdds()*100)+'%. Лидером партии можете стать вы.','Съезд','askCongress()'];
  if(s==='min'){ const k=minKpi(S.you.post);
    if(!k.ok)return ['Поднимите цифру ведомства',MIN_DESK[S.you.post].kpi+': '+k.v+', цель — '+MIN_DESK[S.you.post].goal+'. По ней премьер судит министра.','Рычаги','askDesk()']; }
  if(s==='gov'&&S.unrest[d.rid]>=25)return ['Край неспокоен','Напряжённость '+Math.round(S.unrest[d.rid])+'. Выезд на место сбивает её сразу, стройка — надолго.','Выезд',"deskAct('site')"];
  if(s==='gov'&&!govElected()&&S.gov.lead!==PL&&d.center<(inCoal(PL)?35:60))
    return ['Наладьте отношения с центром','Главу края назначает кабинет: в конце срока он продлит вас, если отношения от '+(inCoal(PL)?30:55)+'. Сейчас '+Math.round(d.center)+'.','Доклад',"deskAct('report')"];
  if(s==='gov'&&d.purse>=6)return ['Запустите стройку','В казне края '+Math.round(d.purse)+' млрд. Стройка поднимает край надолго.','Стройка',"deskAct('build')"];
  if(s==='mayor'){ const low=['road','util','yard'].sort((a,b)=>d[a]-d[b])[0];
    if(d[low]<50)return ['Город ветшает',{road:'Дороги',util:'Трубы',yard:'Дворы'}[low]+': '+Math.round(d[low])+'. Горожане судят по ним.','Чинить',"deskAct('"+low+"')"]; }
  if(s==='sen'&&!d.fili&&!isPM())return ['Держите кабинет в тонусе','Затянутые прения останавливают закон правительства в Сенате.','Прения',"deskAct('fili')"];
  if(s==='pres'&&d.cab<45)return ['Наладьте отношения с кабинетом','Кабинет '+P(S.gov.lead).leader+' слушает вас на '+Math.round(d.cab)+'. Без этого поручения не исполняют.','Встреча',"deskAct('meet')"];
  if(s==='vp'&&d.trust<50)return ['Верните доверие президента','Доверие '+Math.round(d.trust)+'. Вице без доверия — первый кандидат на замену в списке.','Совещание',"deskAct('loyal')"];
  if((s==='none'||s==='dep')&&!chief()&&S.camp&&!S.you.run)
    return ['Выдвиньтесь по округу','Номер в списке — №'+listRank()+'. Округ даёт второй шанс на мандат.','Выдвинуться',"deskAct('district')"];
  if(s==='none'&&!chief())return ['Наберите влияние','Влияние '+Math.round(S.you.inf)+' из '+CONGRESS_INF+' для съезда. От него же зависит номер в списке.','Партработа',"deskAct('partywork')"];
  if(s==='dep'&&!chief())return ['Поработайте во фракции','Влияние '+Math.round(S.you.inf)+'. Номер в списке сейчас '+listRank()+'.','Фракция',"deskAct('faction')"];
  return null;
}

/* ─── поездка: казна — у власти, у остальных касса партии ───────── */
function visitCost(){
  const z=hasTrait('zemsky');
  return (isPM()||isPres())?{gold:z?4:6,label:(z?4:6)+' млрд'}:{funds:z?7:10,label:(z?7:10)+' млн'};
}

/* ─── срок губернатора ──────────────────────────────────────────────
   При автономии край выбирает сам — по поддержке и по вашей работе.
   При вертикали продлевает кабинет — если может с вами работать. */
function youGovDue(rid){
  const g=govOf(rid), d=desk();
  if(govElected()){
    const ch=clamp(0.3+(regApproval(rid)-45)*0.02+(d.score-50)*0.008+(rep('folk')-50)*0.005,0.1,0.92);
    if(Math.random()<ch){
      g.till=S.q+GOV_TERM; g.since=S.q; addCap(8); bumpRep('folk',2);
      S.govLog.unshift({q:S.q,region:rid,name:g.name,party:PL,how:'elect',was:PL});
      career('Край '+R(rid).name+' переизбрал вас.');
      chron('Губернатор '+S.you.name+' переизбран.','g');
      logMsg('Выборы главы: '+R(rid).name+' — вы переизбраны.',1);
      return;
    }
    const sc={}; S.parties.filter(p=>p.id!==PL).forEach(p=>sc[p.id]=partyScore(p,R(rid)));
    const w=Object.keys(sc).sort((a,b)=>sc[b]-sc[a])[0];
    seatGov(rid,w,'elect');
    lostSeat('край '+R(rid).name+' выбрал другого главу — от «'+P(w).name+'»');
    return;
  }
  const keep=(S.gov.lead===PL||inCoal(PL))?d.center>=30:d.center>=55;
  if(keep){
    g.till=S.q+GOV_TERM; addCap(5);
    career('Кабинет продлил ваши полномочия в крае '+R(rid).name+'.');
    logMsg('Кабинет продлил ваши полномочия в крае '+R(rid).name+'.',1);
    return;
  }
  seatGov(rid,S.gov.lead,'appoint');
  lostSeat('кабинет '+P(S.gov.lead).leader+' не продлил ваши полномочия в крае');
}
/* мэр областного центра и выборы главы края: шанс подняться ступенью выше */
function mayorRace(rid){
  const elected=govElected(), d=desk();
  const ch=elected
    ? clamp(0.18+(d.trust-45)*0.02+(regApproval(rid)-45)*0.012+(rep('folk')-50)*0.005,0.08,0.85)
    : clamp((S.gov.lead===PL||inCoal(PL)?0.45:0.08)+(d.trust-50)*0.01,0.05,0.8);
  const seatOther=()=>{
    const w=elected?govWinner(rid):(isPM()?PL:S.gov.lead);
    const g=seatGov(rid,w,elected?'elect':'appoint');
    logMsg((elected?'Выборы главы: ':'Назначен глава: ')+R(rid).name+' — '+g.name+' ('+P(w).short+').');
  };
  const run=()=>{
    if(!pay({cap:6},'Губернаторская кампания'))return seatOther();
    if(Math.random()<ch){
      takeGov(rid); addCap(10); bumpRep('folk',3);
      chron('Мэр '+R(rid).cap+' '+S.you.name+' стал главой края.','g');
      logMsg('Вы стали губернатором: '+R(rid).name+'.',1);
    } else {
      addCap(-5); bumpRep('folk',-1);
      logMsg('Губернаторская кампания проиграна: вы остаётесь мэром '+R(rid).cap+'.',1);
      seatOther();
    }
    render();
  };
  sheetOpen({eye:'Край '+R(rid).name+' · '+dateLabel(),title:elected?'Выборы главы края':'Центр подбирает губернатора',
    body:`<p class="lead">${elected?'У главы края кончился срок, и край выбирает нового. Мэр столицы края — очевидный кандидат.'
        :'Главу края назначает кабинет. Мэр областного центра может попроситься — если кабинет готов с ним работать.'}</p>
      <div class="res"><span>Доверие горожан</span><b>${Math.round(d.trust)}</b>
        <span>Поддержка в крае</span><b>${Math.round(regApproval(rid))}%</b>
        <span>Шанс</span><b class="${ch>=0.5?'good':'bad'}">${Math.round(ch*100)}%</b>
        <span>Цена</span><b>6 веса</b></div>
      <p class="hint">Проигрыш оставляет вас мэром. Победа — край ваш, город примет заместитель.</p>`,
    opts:[{label:elected?'Идти на выборы':'Просить назначения',hint:'шанс '+Math.round(ch*100)+'% · 6 веса',fn:run},
      {label:'Остаться мэром',hint:'город важнее',fn(){ seatOther(); render(); }}]});
}

/* рычаги кресла одним листом — из совета помощника и из шапки */
function askDesk(){
  const acts=deskActs();
  sheetOpen({eye:seatTitle()+' · '+dateLabel(),title:'Рычаги кресла',
    body:'<p class="lead">'+deskLead()+'</p>',
    opts:acts.map(a=>({label:a.name,hint:a.txt,fn:()=>deskAct(a.id)})).concat([{label:'Закрыть',hint:'',fn(){}}])});
}


/* ─── после президентства ───────────────────────────────────────────
   Ст. 96: бывший президент может занять место в Сенате пожизненно —
   от своего края, вне классов и выборов. Можно и отказаться. */
function offerLifeSenate(){
  const rid=S.you.home||homeOf();
  sheetOpen({eye:'Статья 96 · '+dateLabel(),title:'Место в Сенате — пожизненно',
    body:`<p class="lead">Срок окончен. Конституция оставляет бывшему президенту кресло в верхней палате —
        от края ${R(rid).name}, без выборов и без срока. Голос, трибуна, слушания — и имя, которое в палате весит больше стажа.</p>`,
    opts:[{label:'Занять место',hint:'кресло сенатора · край '+R(rid).name,fn(){
        takeSen(rid); const rec=S.senate.find(x=>x.you); if(rec){ rec.life=true; rec.terms=5; }
        career('Пожизненный сенатор по статье 96.'); chron(S.you.name+' — пожизненный сенатор.','');
        logMsg('Вы заняли пожизненное место в Сенате от края '+R(rid).name+'.',1); render(); }},
      {label:'Уйти на покой от должностей',hint:'партия, имя и выборы остаются',fn(){ bumpRep('honest',2); }}]});
}
