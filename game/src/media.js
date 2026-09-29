/* ════════════════════════════════════════════════════════════════
   ПЕЧАТЬ, СКАНДАЛЫ, КАПИТАЛ
   Скандал — не заголовок на один день, а процесс с температурой:
   его разогревают враждебные издания и новые документы, остужают
   извинения, отставки и смена повестки. Капитал — не касса для
   конвертов, а климат, от которого зависят инвестиции, заводы в
   краях и то, что утром напишут принадлежащие ему газеты.
   ════════════════════════════════════════════════════════════════ */

/* кому принадлежат издания: владелец тянет редакцию за собой */
const PRESS_OWNER={vestnik:'bank',trud:null,znamya:'neft',delo:'bank',volna:'set'};
/* название группы в кавычках — один раз, даже если кавычки уже в имени */
function fname(d){ return /^«/.test(d.name)?d.name:'«'+d.name+'»'; }
function pressOwner(id){ const f=PRESS_OWNER[id]; return f?FM(f):null; }

/* ─── скандалы ──────────────────────────────────────────────────── */
function scandals(){ return S.scandals||(S.scandals=[]); }
function scLive(){ return scandals().filter(x=>x.heat>5); }
function scMine(){ return scLive().filter(x=>x.who==='you'); }
function scWord(h){ return h>=75?'пожар':h>=50?'разгорается':h>=25?'тлеет':'затухает'; }
/* заголовок в самом враждебном к герою издании */
function scHead(sc){
  if(!S.press)return;
  const o=PRESS.slice().sort((a,b)=>pressOf(a.id).rel-pressOf(b.id).rel)[sc.who==='you'?0:PRESS.length-1];
  head(o,sc.title,sc.who==='you'?'hb':'hg');
}
const SC_KINDS={
  deals:{title:()=>'Конверты для лидеров фракций: переписка в редакции',txt:'Кто-то из тех, кому вы платили мимо кассы, заговорил.'},
  firm: {title:()=>{ const f=FIRMS.filter(d=>(firmOf(d.id)||{}).given>0)[0]||FIRMS[0]; return 'Чьи деньги в кассе партии: следы '+fname(f); },
         txt:'Корпоративные деньги в кассе партии перестали быть тайной.'},
  trail:{title:()=>'Сделки в коридорах Собрания: кто и что получил',txt:'Депутаты, с которыми вы договаривались, рассказали больше, чем стоило.'},
  life: {title:()=>pick(['Дача, которой нет в декларации','Родственник на госзаказе','Перелёт за казённый счёт']),
         txt:'Личная история, к политике отношения почти не имеющая, — поэтому её читают все.'},
};
function scOpenYou(kind,heat,evid){
  const k=SC_KINDS[kind]||SC_KINDS.life;
  const sc={id:(S.scNo=(S.scNo||0)+1),who:'you',kind,title:k.title(),txt:k.txt,heat:heat||45,evid:evid||ri(35,85),q:S.q,resp:null};
  scandals().unshift(sc); if(scandals().length>30)scandals().pop();
  scHead(sc); shiftAll(-1.2); bumpRep('honest',-2);
  logMsg('Скандал: '+sc.title+'.',1); chron('Скандал: '+sc.title.toLowerCase()+'.','b');
  askScandal(sc.id);
  return sc;
}
function scOpenParty(pid,title,heat){
  const sc={id:(S.scNo=(S.scNo||0)+1),who:pid,kind:'party',title,heat:heat||45,evid:60,q:S.q,resp:'none'};
  scandals().unshift(sc); if(scandals().length>30)scandals().pop();
  scHead(sc); const p=P(pid); p.mom=clamp((p.mom||0)-3,-14,14);
  const L=S.fl&&S.fl[pid]&&S.fl[pid].h; if(L)L.hit=(L.hit||0)+1;
  logMsg('Скандал у «'+p.short+'»: '+title+'.');
  if(typeof rcaseFromScandal==='function')rcaseFromScandal(sc);
  return sc;
}
/* реакция: у каждой своя цена и свой риск */
function askScandal(id){
  const sc=scandals().find(x=>x.id===id); if(!sc||sc.who!=='you')return;
  const hostile=PRESS.filter(o=>pressOf(o.id).rel<40).length;
  sheetOpen({eye:'Скандал · '+dateLabel(),title:sc.title,
    body:`<p class="lead">${sc.txt} Враждебных изданий: ${hostile} из ${PRESS.length}.</p>
      <div class="res"><span>Температура</span><b class="${sc.heat>=50?'bad':''}">${Math.round(sc.heat)} · ${scWord(sc.heat)}</b>
        <span>Сколько правды в документах</span><b>${sc.evid>=65?'много':sc.evid>=40?'хватает':'мало'}</b>
        <span>Каждый квартал отнимает</span><b class="bad">одобрение и честность</b></div>
      <p class="hint">Отрицать дёшево, пока документов мало. Если их много — они всплывут снова, и тогда будет хуже.</p>`,
    opts:[
      {label:'Отрицать',hint:'температура −12 сейчас · риск, если правды много',fn(){ sc.resp='deny'; sc.heat=Math.max(0,sc.heat-12);
        logMsg('Вы отрицаете всё: «'+sc.title+'».'); render(); }},
      {label:'Признать и извиниться',hint:'температура −30 · одобрение −1 · честность +3',fn(){ sc.resp='sorry'; sc.heat=Math.max(0,sc.heat-30);
        shiftAll(-1); bumpRep('honest',3); logMsg('Вы публично извинились.',1); render(); }},
      {label:'Сдать помощника',hint:'6 веса · температура −40 · твёрдость и компетентность страдают',fn(){ if(!payCap(6))return;
        sc.resp='scape'; sc.heat=Math.max(0,sc.heat-40); bumpRep('firm',-2); bumpRep('comp',-2);
        logMsg('Помощник, «принимавший решения сам», уволен.',1); render(); }},
      {label:'Сменить повестку',hint:'20 млн из кассы · температура −20',fn(){ if(!payFunds(20))return;
        sc.resp='agenda'; sc.heat=Math.max(0,sc.heat-20); pressAll(1); logMsg('Штаб сменил повестку: страна обсуждает другое.'); render(); }},
      {label:'Подать в суд на издание',hint:'при зависимом суде помогает, при независимом — вредит',fn(){ sc.resp='sue';
        const win=Math.random()<clamp(0.55-courtFree()*0.2-pressFree()*0.1,0.1,0.85);
        const o=PRESS.slice().sort((a,b)=>pressOf(a.id).rel-pressOf(b.id).rel)[0]; pressOf(o.id).rel=clamp(pressOf(o.id).rel-12,0,100);
        if(win){ sc.heat=Math.max(0,sc.heat-25); logMsg('Суд обязал «'+o.name+'» опубликовать опровержение.',1); }
        else { sc.heat=clamp(sc.heat+12,0,100); bumpRep('honest',-2); logMsg('Суд встал на сторону «'+o.name+'»: скандал только разгорелся.',1); }
        render(); }},
      {label:'Молчать',hint:'пусть остынет само',fn(){ sc.resp=sc.resp||'none'; }}]});
}
/* квартал скандалов: температура, последствия, новые утечки */
function scandalTick(){
  const tone=pressTone();
  scLive().forEach(sc=>{
    if(sc.who==='you'){
      let d=-9-tone/6;
      if(sc.resp==='deny'&&sc.evid>=60&&!sc.back&&Math.random()<0.5){ sc.back=true; d+=28; bumpRep('honest',-4);
        logMsg('Новые документы по делу «'+sc.title+'»: отрицание обернулось против вас.',1); scHead(sc); }
      sc.heat=clamp(sc.heat+d,0,100);
      shiftAll(-sc.heat*0.018); bumpRep('honest',-sc.heat*0.012);
      if(sc.heat>=75){ addTrail(3,'скандал: '+sc.title.toLowerCase());
        if(isPM())REGIONS.forEach(r=>S.rmod[r.id]=clamp(S.rmod[r.id]-0.2,-22,22)); }
      if(sc.heat<=5)logMsg('Скандал «'+sc.title+'» утих.');
    } else {
      sc.heat=clamp(sc.heat-11,0,100);
      const p=P(sc.who); if(p)p.mom=clamp((p.mom||0)-sc.heat*0.03,-14,14);
    }
  });
  // утечки против вас: след, конверты, чужие деньги, враждебная печать
  const given=S.firms?Object.values(S.firms).reduce((a,f)=>a+(f.given||0),0):0;
  const risk=0.015+trail()/520+(S.leakPool||0)*0.05+given/1600+(tone<-10?0.03:0)-(rep('honest')-50)*0.0006;
  if(!scMine().length&&Math.random()<clamp(risk,0,0.3)){
    const kind=(S.leakPool||0)>0?'deals':given>20?'firm':trail()>40?'trail':'life';
    if(kind==='deals')S.leakPool=Math.max(0,S.leakPool-1);
    scOpenYou(kind,ri(35,60));
  }
  // у соперников тоже бывают плохие недели
  if(Math.random()<0.14){
    const p=pick(S.parties.filter(x=>x.id!==PL));
    scOpenParty(p.id,pick(['Лидер «'+p.short+'» и подряд для родственника','Касса «'+p.short+'»: откуда деньги',
      'Депутат «'+p.short+'» задержан с поличным','Переписка штаба «'+p.short+'» в открытом доступе']),ri(30,55));
  }
}
/* компромат на соперника: цель, издание, риск, что след приведёт к вам */
function askDirt(){
  const opts=S.parties.filter(p=>p.id!==PL).map(p=>({label:'«'+p.name+'» · '+(S.fl&&S.fl[p.id]?S.fl[p.id].h.name:p.leader),
    hint:'ход и '+PRESS_LEAK+' веса · их импульс падает · след растёт',fn:()=>dirtOn(p.id)}));
  opts.push({label:'Отказаться',hint:'',fn(){}});
  sheetOpen({eye:'Компромат · '+dateLabel(),title:'На кого сливать',
    body:`<p class="lead">Документы уходят в самое дружелюбное к вам издание. Если редакция к вам холодна,
        она может рассказать, откуда пришла папка.</p>`,opts});
}
function dirtOn(pid){
  if(!pay({ap:1,cap:PRESS_LEAK},'Компромат на «'+P(pid).short+'»'))return;
  const p=P(pid); addTrail(ri(5,10),'компромат на «'+p.name+'»'); bumpRep('honest',-2);
  scOpenParty(pid,'Что скрывает «'+p.name+'»: документы в редакции',ri(45,70));
  S.deputies.filter(d=>d.party===pid).forEach(d=>d.rel=clamp(d.rel-2,0,100));
  const L=flLeader(pid,'h'); if(L)L.rel=clamp(L.rel-8,0,100);
  const best=PRESS.slice().sort((a,b)=>pressOf(b.id).rel-pressOf(a.id).rel)[0];
  if(pressOf(best.id).rel<45&&Math.random()<0.35){
    logMsg('Редакция «'+best.name+'» рассказала, кто принёс папку.',1);
    scOpenYou('trail',ri(30,50),70);
  }
  render();
}

/* ─── капитал ───────────────────────────────────────────────────────
   Деловой климат — взвешенное отношение восьми групп к власти.
   Он тянет инвестиции, решает, где откроют завод и где закроют. */
function bizClimate(){
  if(!S.firms)return 50;
  let s=0,w=0; FIRMS.forEach(d=>{ const f=firmOf(d.id); if(!f)return; s+=f.rel*d.power; w+=d.power; });
  return Math.round(s/(w||1));
}
function bizWord(v){ return v>=64?'доверие':v>=52?'ровно':v>=40?'настороженность':v>=28?'недоверие':'бегство'; }
/* корпорация отвечает на каждый закон по своей оси */
function firmLawReact(law){
  if(!S.firms||!law||law.decree===undefined&&!law.topic)return;
  const t=T(law.topic); if(!t)return;
  const react=[];
  FIRMS.forEach(d=>{ const w=d.want[t.ax]; if(!w)return; const f=firmOf(d.id); if(!f)return;
    const v=Math.sign(w)*Math.sign(law.stance)*Math.min(Math.abs(law.stance),2)*Math.min(Math.abs(w),1.5)*3;
    if(!v)return;
    f.rel=clamp(f.rel+v,0,100); react.push({d,v}); });
  if(!react.length)return;
  const top=react.sort((a,b)=>Math.abs(b.v)-Math.abs(a.v))[0];
  const o=PRESS.find(x=>PRESS_OWNER[x.id]===top.d.id)||PRESS.find(x=>x.id==='delo');
  head(o,fname(top.d)+' '+(top.v>0?'приветствует':'осуждает')+' закон «'+t.name.toLowerCase()+'»',top.v>0?'hg':'hb');
}
function bizLog(t,kind){ S.bizLog=S.bizLog||[]; S.bizLog.unshift({q:S.q,t,k:kind||''}); if(S.bizLog.length>24)S.bizLog.pop(); logMsg(t,kind==='b'?1:0); }
/* проекты и сокращения: капитал голосует заводами */
function bizTick(){
  if(!S.firms||Math.random()>0.4)return;
  // каждый квартал одна из групп принимает решение — по своему настроению
  const d=pick(FIRMS), f=firmOf(d.id); if(!f)return;
  const rid=Math.random()<0.6?d.reg:pick(REGIONS).id;
  if(f.rel>=55&&f.cash>30){
    f.cash=r1(f.cash-15); S.unrest[rid]=clamp(S.unrest[rid]-3,0,100); S.rmod[rid]=clamp(S.rmod[rid]+2,-22,22);
    S.econ.invest=r1(S.econ.invest+1.5); shiftMood('work',0.6,true);
    bizLog(fname(d)+' открывает производство в крае '+R(rid).name+': новые рабочие места.','g');
  } else if(f.rel<=24){
    S.econ.invest=r1(S.econ.invest-3.5); shiftMood('biz',-1,true);
    bizLog(fname(d)+' выводит капитал за рубеж: «климат не тот».','b');
  } else if(f.rel<=42){
    S.unrest[rid]=clamp(S.unrest[rid]+4,0,100); S.rmod[rid]=clamp(S.rmod[rid]-2,-22,22);
    S.econ.unemp=r1(clamp(S.econ.unemp+0.15,2.5,26)); shiftMood('work',-0.8,true);
    bizLog(fname(d)+' сокращает людей в крае '+R(rid).name+' и винит правительство.','b');
  } else {
    bizLog(fname(d)+' замораживает планы в крае '+R(rid).name+': ждёт, куда повернёт власть.','');
  }
}
/* деловой совет и просьба о проекте — рычаги игрока */
function bizCouncil(){
  if(!pay({ap:1,cap:6},'Деловой совет'))return;
  FIRMS.forEach(d=>{ const f=firmOf(d.id); if(f)f.rel=clamp(f.rel+ri(3,6),0,100); });
  shiftMood('biz',2); shiftMood('work',-0.8);
  logMsg('Деловой совет: капитал выслушали, климат потеплел.',1); render();
}
function askProject(){
  const pool=FIRMS.filter(d=>firmOf(d.id)&&firmOf(d.id).rel>=45);
  if(!pool.length){ toast('Никто из капитала сейчас не готов вкладываться'); return; }
  const rid=(S.desk&&S.desk.rid)||S.you.home||'centr';
  sheetOpen({eye:'Капитал · 1 действие и 8 веса',title:'Попросить проект в край '+R(rid).name,
    body:`<p class="lead">Группа, к которой вы придёте, решит по своему отношению к вам и по деньгам в кармане.</p>`,
    opts:pool.map(d=>{ const f=firmOf(d.id), ch=clamp(0.2+(f.rel-45)*0.018+f.cash/600,0.1,0.9);
      return {label:d.name+' · '+d.sec.toLowerCase(),hint:'отношение '+Math.round(f.rel)+' · шанс '+Math.round(ch*100)+'%',fn(){
        if(!pay({ap:1,cap:8},'Проект в край'))return;
        if(Math.random()<ch){ f.cash=r1(f.cash-15); S.unrest[rid]=clamp(S.unrest[rid]-5,0,100); S.rmod[rid]=clamp(S.rmod[rid]+3,-22,22);
          S.econ.invest=r1(S.econ.invest+1.5); f.rel=clamp(f.rel-2,0,100); bumpRep('comp',1.5);
          if(S.desk&&S.desk.home!==undefined)S.desk.home=clamp(S.desk.home+5,0,100);
          bizLog(fname(d)+' по вашей просьбе строит в крае '+R(rid).name+'.','g'); }
        else { f.rel=clamp(f.rel-3,0,100); logMsg(fname(d)+' вежливо отказала.'); }
        render(); }}; }).concat([{label:'Не просить',hint:'',fn(){}}])});
}

/* ─── новые события ─────────────────────────────────────────────── */
EVENTS.push(
  {id:'strike', w:3, cond:()=>!!S.firms&&S.mood.work<50, make(){
    const d=pick(FIRMS.filter(x=>x.groups.indexOf('work')>=0)), f=firmOf(d.id), rid=d.reg;
    return {eye:d.sec+' · '+R(rid).name, title:'Забастовка на '+fname(d),
      body:'<p>Цеха в '+R(rid).cap+' встали: зарплаты не индексировали два года. Профсоюз ждёт, чью сторону займёт власть.</p>',
      opts:[
        {l:'Посредничать · 6 веса',h:'обе стороны уступят понемногу',fn(){ if(!payCap(6))return; S.unrest[rid]=clamp(S.unrest[rid]-5,0,100);
          shiftMood('work',2); f.rel=clamp(f.rel-3,0,100); logMsg('Забастовка на '+fname(d)+' закончилась компромиссом.',1); }},
        {l:'Встать на сторону рабочих',h:'рабочие +, капитал злится',fn(){ shiftMood('work',4); shiftMood('biz',-2); f.rel=clamp(f.rel-10,0,100);
          S.unrest[rid]=clamp(S.unrest[rid]-3,0,100); logMsg('Власть поддержала бастующих на '+fname(d)+'.',1); }},
        {l:'Прислать полицию',h:'цеха заработают, осадок останется',fn(){ shiftMood('work',-4); shiftMood('intel',-2); f.rel=clamp(f.rel+5,0,100);
          S.unrest[rid]=clamp(S.unrest[rid]+4,0,100); logMsg('Забастовку на '+fname(d)+' разогнали.',1); }}]};}},
  {id:'mine', w:2, cond:()=>!!S.firms, make(){
    const d=FM('ruda'), f=firmOf('ruda'), rid=d.reg;
    return {eye:'Катастрофа · '+R(rid).name, title:'Обрушение на руднике',
      body:'<p>В шахте «Рудогорска» под землёй остались люди. Компания говорит о природе, профсоюз — о сэкономленной крепи.</p>',
      opts:[
        {l:'Лететь на место',h:'ход и 6 млрд на помощь · страна видит',fn(){ if(!pay({ap:1,gold:6},'Катастрофа на руднике'))return;
          S.unrest[rid]=clamp(S.unrest[rid]-6,0,100); bumpRep('folk',3); shiftAll(0.8); logMsg('Вы на месте обрушения.',1); }},
        {l:'Спросить с компании',h:'рабочие и интеллигенция за, капитал против',fn(){ f.rel=clamp(f.rel-14,0,100); shiftMood('work',3); shiftMood('intel',1.5);
          bumpCapture(-3); logMsg('«Рудогорск» оштрафован за нарушения на шахте.',1); }},
        {l:'Выразить соболезнования',h:'дёшево и холодно',fn(){ S.unrest[rid]=clamp(S.unrest[rid]+5,0,100); shiftMood('work',-2); }}]};}},
  {id:'flood', w:2, cond:()=>true, make(){
    const r=pick(REGIONS), g=govOf(r.id);
    return {eye:'Стихия · '+r.name, title:'Паводок в крае '+r.name,
      body:'<p>Вода поднялась за ночь: подтоплены посёлки, '+(g?'глава края '+g.name+' ('+P(g.party).short+') просит помощи центра':'край просит помощи центра')+'.</p>',
      opts:[
        {l:'Деньги краю · 10 млрд',h:'край и его глава запомнят',fn(){ if(!payGold(10))return; S.unrest[r.id]=clamp(S.unrest[r.id]-8,0,100);
          S.rmod[r.id]=clamp(S.rmod[r.id]+3,-22,22); if(g)g.rel=clamp(g.rel+8,0,100); logMsg('Край '+r.name+' получил помощь на паводок.',1); }},
        {l:'Армия и МЧС',h:'патриоты +, быстро, но не всем',fn(){ S.unrest[r.id]=clamp(S.unrest[r.id]-4,0,100); shiftMood('patr',1.5); }},
        {l:'Пусть справляется сам',h:'глава края обидится',fn(){ S.unrest[r.id]=clamp(S.unrest[r.id]+7,0,100); if(g)g.rel=clamp(g.rel-12,0,100);
          S.rmod[r.id]=clamp(S.rmod[r.id]-3,-22,22); }}]};}},
  {id:'students', w:2, cond:()=>S.mood.youth<48, make(){
    const r=REGIONS.find(x=>x.capital)||REGIONS[0];
    return {eye:'Улица · '+r.cap, title:'Студенты вышли на площадь',
      body:'<p>Поводом стал закон, причиной — всё сразу. Площадь перед Собранием заполнена, в сети трансляция.</p>',
      opts:[
        {l:'Выйти к ним',h:'рискованно · оратор справится',fn(){ const ok=Math.random()<(hasTrait('orator')?0.75:0.45);
          if(ok){ shiftMood('youth',5); bumpRep('folk',3); logMsg('Вы вышли к студентам — и вас выслушали.',1); }
          else { shiftMood('youth',-2); bumpRep('firm',-2); logMsg('Выход к студентам закончился свистом.',1); } }},
        {l:'Пригласить делегацию',h:'молодёжь +2, без риска',fn(){ shiftMood('youth',2); shiftMood('intel',1); }},
        {l:'Разогнать',h:'порядок сегодня, счёт завтра',fn(){ shiftMood('youth',-6); shiftMood('intel',-3); shiftMood('patr',2);
          S.unrest[r.id]=clamp(S.unrest[r.id]+5,0,100); if(Math.random()<0.4)scOpenYou('life',40,50); }}]};}},
  {id:'turncoat', w:2, cond:()=>S.senate.some(s=>s.party!==PL&&!inCoal(s.party)&&s.rel>=66&&!s.you), make(){
    const s=pick(S.senate.filter(x=>x.party!==PL&&!inCoal(x.party)&&x.rel>=66&&!x.you));
    return {eye:'Сенат · '+R(s.region).name, title:'Сенатор готов перейти к вам',
      body:'<p>'+s.name+' («'+P(s.party).short+'») устал от своей фракции и намекает, что место в вашей нашлось бы. Его бывшая фракция этого не простит.</p>',
      opts:[
        {l:'Принять · 12 веса',h:'место в Сенате ваше · лидер его фракции обидится',fn(){ if(!payCap(12))return;
          const from=s.party; S.senSeats[from]--; S.senSeats[PL]=(S.senSeats[PL]||0)+1; s.party=PL; s.note='перешёл к вам';
          const L=flLeader(from,'s'); if(L)L.rel=clamp(L.rel-15,0,100); logMsg('Сенатор '+s.name+' перешёл в вашу фракцию.',1); flSync(); }},
        {l:'Отказать вежливо',h:'он запомнит и поможет по-другому',fn(){ s.rel=clamp(s.rel+4,0,100); }}]};}},
  {id:'letters', w:2, cond:()=>!!S.fl, make(){
    const p=pick(S.parties.filter(x=>x.id!==PL)), L=flLeader(p.id,'h');
    return {eye:'Печать · утечка', title:'Переписка '+L.name+' попала к вам',
      body:'<p>Кто-то из аппарата «'+p.short+'» принёс распечатки: лидер фракции обсуждает с корпорацией голосования. Использовать можно по-разному.</p>',
      opts:[
        {l:'Отдать в печать',h:'скандал у «'+p.short+'» · след',fn(){ addTrail(4,'переписка '+L.name); scOpenParty(p.id,'Переписка '+L.name+' с корпорацией',60); L.rel=clamp(L.rel-15,0,100); }},
        {l:'Показать ему самому',h:'он станет сговорчивее — пока боится',fn(){ L.owe=1; L.rel=clamp(L.rel-5,0,100); bumpRep('honest',-1);
          logMsg(L.name+' понял намёк: следующая сделка с ним обойдётся дешевле.'); }},
        {l:'Сжечь',h:'честность +3',fn(){ bumpRep('honest',3); }}]};}}
);

/* ─── квартал печати и капитала ─────────────────────────────────── */
function mediaTick(){
  // владелец тянет редакцию: газета банка не станет травить друга банка
  if(S.press)PRESS.forEach(o=>{ const d=pressOwner(o.id); const st=pressOf(o.id); if(!d||!st||st.banned)return;
    const f=firmOf(d.id); if(f)st.rel=clamp(st.rel+(f.rel-50)*0.03,0,100); });
  scandalTick(); bizTick();
}

/* утечка из раздела печати теперь заводит настоящий скандал у соперника */
pressLeak=function(pid){ dirtOn(pid); };
