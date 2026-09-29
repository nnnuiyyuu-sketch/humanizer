/* Системы по очереди: сделки, комитеты, поправка через сделки, Сенат,
   кампания и ночь выборов, выдвижение, смена вице, скандалы, капитал. */
import {open,boot,say,done,settle} from './lib.mjs';
const {browser,page,errors}=await open();
const fails=[];
const check=(name,ok,v)=>{ say(name,v); if(!ok)fails.push(name+': '+v); };
const ev=f=>page.evaluate(f);
await boot(page);

let r=await ev(()=>{ S.tab='brief'; render(); const c=document.querySelector('#view .course');
  const n0=courseList().filter(x=>x.done()).length; goTab('fac'); goTab('press'); goTab('senate'); goTab('brief');
  return {has:!!c, n0, n1:courseList().filter(x=>x.done()).length, all:courseList().length}; });
check('курс молодого политика', r.has&&r.n1>r.n0, r.n0+' → '+r.n1+' из '+r.all);
await page.evaluate(()=>goTab('help'));
await page.fill('#helpq','клотур');
r=await ev(()=>({shown:document.querySelectorAll('#view section.help-s:not([hidden])').length,all:document.querySelectorAll('#view section.help-s').length,
  focus:document.activeElement&&document.activeElement.id}));
check('поиск в справке', r.shown>0&&r.shown<r.all&&r.focus==='helpq', r.shown+' из '+r.all+' · фокус '+r.focus);
await ev(()=>{ HELPQ=''; goTab('brief'); });

r=await ev(()=>{ let best=null; TOPICS.filter(z=>!z.special).forEach(t=>[-2,-1,1,2].forEach(st=>{ newBill(t.id); S.bill.stance=st;
    const y=tally(S.bill).yes; if(y>=165&&y<MAJ&&(!best||Math.abs(y-195)<Math.abs(best.y-195)))best={t:t.id,st,y}; }));
  newBill(best.t); S.bill.stance=best.st; const sb={k:'b',topic:S.bill.topic,stance:S.bill.stance,bill:S.bill};
  const x=S.parties.filter(z=>z.id!==PL&&dealDemand(z.id,'h',sb)!==null).sort(bySeats)[0];
  S.deals.push({id:1,pid:x.id,house:'h',key:subjKey(sb),due:S.q+3,trait:'drill',renege:false,q:S.q});
  return {y0:best.y,y1:tally(S.bill).yes}; });
check('сделка по закону', r.y1>r.y0, r.y0+' → '+r.y1+' из 218');

r=await ev(()=>{ const c=cnList()[0], f0=cnForecast(c);
  S.parties.filter(x=>x.id!==PL).sort(bySeats).forEach((x,i)=>['h','s'].forEach(h=>S.deals.push({id:10+i,pid:x.id,house:h,key:'c:'+c.id,due:S.q+3,trait:'drill',renege:false,q:S.q})));
  const f1=cnForecast(c); return {a:f0.h+'/'+f0.s, b:f1.h+'/'+f1.s, ok:f1.ok}; });
check('поправка через сделки', r.ok, r.a+' → '+r.b);

r=await ev(()=>({n:AX.filter(a=>commChair(a)).length, m:commMembers('econ').length, uniq:new Set(AX.map(a=>S.comm[a])).size}));
check('комитеты', r.n===6&&r.m===13&&r.uniq===6, r.n+' председателей · '+r.m+' членов · разных '+r.uniq);

r=await ev(()=>{ for(let i=0;i<40;i++){ commTick(); senAgendaTick(); } return {h:(S.hearLog||[]).length,s:(S.senLog||[]).length}; });
check('слушания и повестка Сената', r.s>0, 'слушаний '+r.h+' · записей Сената '+r.s);

r=await ev(()=>{ campaignStart(); const m=document.getElementById('modal');m.classList.remove('show');mopen=false;mq.length=0;
  for(let i=0;i<3;i++){ S.q++; campPoll(); } S.q=S.termStart+aTerm()+1; election();
  return {polls:S.camp?S.camp.polls.length:-1,title:document.querySelector('#msheet h2').textContent}; });
check('ночь выборов', r.title==='Подсчёт голосов', r.title);
await settle(page);

await boot(page,{role:'none',pick:2});
r=await ev(()=>{ S.ap=3;S.cap=60;S.funds=60; registerCand('sen',S.you.home,nextSenQ());
  const rr=Math.random; S.senCls=S.senate.find(s=>s.region===S.you.home).cls; Math.random=()=>0.01; senateElection(); Math.random=rr;
  return mySeat(); });
check('выдвижение в Сенат', r==='sen', r);
await settle(page);

await boot(page,{role:'pres'});
r=await ev(()=>{ S.ap=3;S.cap=60; const old=S.vp.name; askReplaceVP(); const rr=Math.random; Math.random=()=>0.01;
  document.querySelector('#msheet .opt').click(); Math.random=rr; return {old,now:S.vp.name,ex:!!S.exVP}; });
check('смена вице', r.old!==r.now&&r.ex, r.old+' → '+r.now);
await settle(page);

r=await ev(()=>{ const sc=scOpenYou('firm',55,80); document.querySelector('#msheet .opt').click();
  const h0=sc.heat; const rr=Math.random; Math.random=()=>0.1; scandalTick(); Math.random=rr; return {h0,h1:Math.round(sc.heat),back:!!sc.back}; });
check('скандал: отрицание при документах', r.back, r.h0+' → '+r.h1);
await settle(page);

r=await ev(()=>{ const f=firmOf('neft'), r0=f.rel; enact({topic:'corp',stance:-2,riders:[],by:PL}); return {r0,r1:f.rel}; });
check('капитал отвечает на закон', r.r1<r.r0, Math.round(r.r0)+' → '+Math.round(r.r1));

r=await ev(()=>{ S.tab='fac'; render(); return document.querySelectorAll('#view .fac-ax').length; });
check('вкладка «Фракции»', r>=30, 'осей '+r);

await boot(page,{role:'pm'});
r=await ev(()=>{ const big=S.parties.filter(p=>p.id!==PL).sort(bySeats)[0], n0=S.parties.length;
  const np=splitParty(big.id); if(!np)return {ok:false};
  const hs=S.parties.reduce((a,p)=>a+seatsOf(p.id),0), ss=S.parties.reduce((a,p)=>a+senSeatsOf(p.id),0);
  const dOk=S.parties.every(p=>S.deputies.filter(d=>d.party===p.id).length===seatsOf(p.id));
  const sOk=S.parties.every(p=>S.senate.filter(x=>x.party===p.id).length===senSeatsOf(p.id));
  return {ok:S.parties.length===n0+1&&hs===SEATS&&dOk&&sOk&&!!flLeader(np.id,'h'), v:big.short+' → '+np.name+' · '+seatsOf(np.id)+' деп. · '+hs+'/'+ss}; });
check('раскол партии', r.ok, r.v);
r=await ev(()=>{ const opp=S.parties.filter(p=>p.id!==PL&&!inCoal(p.id)).sort(bySeats).slice(0,2).map(p=>p.id);
  S.bloc={members:opp.slice(),since:S.q,until:S.q+8,lead:opp[0]};
  newBill(TOPICS.find(t=>!t.special).id); const line=leaderLine(opp[0],S.bill);
  const rr=Math.random; Math.random=()=>0.1; blocDealBreak(opp[1]); Math.random=rr;
  return {line,after:S.bloc?S.bloc.members.length:0}; });
check('оппозиционный блок', r.line===-1&&r.after<2, 'линия '+r.line+' · после сделки в блоке '+r.after);
r=await ev(()=>{ S.bill=null; campaignStart(); const m=document.getElementById('modal');m.classList.remove('show');mopen=false;mq.length=0;
  rivalCampTick(); const t=S.camp.themes||{}; return {n:Object.keys(t).length, all:S.parties.length-1}; });
check('кампании соперников', r.n===r.all, 'тем '+r.n+' из '+r.all);
await settle(page);

r=await ev(()=>{ const p=S.parties.filter(x=>x.id!==PL&&!bAskMet(bAsk(x.id))).sort(bySeats)[0]; if(!p)return {ok:false};
  const a=bAsk(p.id), y0=budgetTally().yes, d0=dealDemand(p.id,'h',{k:'budget'}); bAskAccept(p.id);
  const y1=budgetTally().yes, d1=dealDemand(p.id,'h',{k:'budget'});
  const L=S.fl[p.id].h, tr0=L.trust; if(a.kind==='spend')S.spend[a.id]=1; else S.tax[a.id]=4; bPromTick();
  return {ok:y1>y0&&d1<d0&&L.trust<tr0, v:y0+' → '+y1+' за · цена '+d0+' → '+d1+' · доверие '+tr0+' → '+L.trust}; });
check('бюджет: строка фракции', r.ok, r.v);
await boot(page,{role:'dep',pick:2});
r=await ev(()=>{ S.ap=3; S.cap=60; askBudgetLine(); const o=document.querySelector('#msheet .opt'); const rr=Math.random; Math.random=()=>0.01;
  o.click(); Math.random=rr; const t=document.querySelector('#msheet h2').textContent; return {t,again:bReqOpen()}; });
check('бюджет: требование строки у кабинета', r.t==='Строка вписана'&&!r.again, r.t);
await settle(page);

await boot(page,{role:'pm'});
r=await ev(()=>{ S.ap=3; S.cap=90; S.funds=90; const path=[];
  caseOpen({k:'министр',name:minOf('fin').name,post:'fin'},'trail',60); path.push(S.probe.stage);
  const m=document.getElementById('modal');m.classList.remove('show');mopen=false;mq.length=0;
  const rr=Math.random; Math.random=()=>0.5;
  let ev0=-1,ev1=-1,l0=legit();
  for(let i=0;i<3&&S.probe;i++){ caseStep(); m.classList.remove('show');mopen=false;mq.length=0; if(S.probe)path.push(S.probe.stage);
    if(S.probe&&S.probe.stage==='search'){ ev0=S.probe.ev; caseDo('press'); ev1=S.probe.ev; m.classList.remove('show');mopen=false;mq.length=0; } }
  Math.random=rr;
  return {path:path.join('→'),ev0,ev1,l0,l1:legit()}; });
check('дело: ступени и давление', r.path==='check→search→charge→court'&&r.ev1<r.ev0&&r.l1<r.l0, r.path+' · улики '+r.ev0+' → '+r.ev1+' · легитимность '+r.l0+' → '+r.l1);
r=await ev(()=>{ const rr=Math.random; Math.random=()=>0.01; caseVerdict(); Math.random=rr;
  const t=document.querySelector('#msheet h2').textContent; return {t,probe:!!S.probe}; });
check('дело: приговор', r.t==='Виновен'&&!r.probe, r.t);
await settle(page);
r=await ev(()=>{ S.ap=3; S.cap=90; S.funds=90; caseOpen({k:'политик',name:S.you.name,you:true},'scandal',80);
  const m=document.getElementById('modal');m.classList.remove('show');mopen=false;mq.length=0;
  S.probe.stage='court'; S.probe.left=1; const rr=Math.random; Math.random=()=>0.01; caseVerdict(); Math.random=rr;
  document.querySelectorAll('#msheet .opt')[1].click();
  return {seat:mySeat(),conv:convicted(),gov:S.gov.lead===PL}; });
check('дело: приговор вам', r.seat==='none'&&r.conv&&!r.gov, 'кресло '+r.seat+' · запрет '+r.conv);
await settle(page);
r=await ev(()=>{ const p=S.parties.find(x=>x.id!==PL); S.rcases=[{sc:0,pid:p.id,name:p.leader,stage:3,left:1,ev:90,q:S.q}];
  const L0=p.leader, rr=Math.random; Math.random=()=>0.01; rcaseTick(); Math.random=rr; return {L0,L1:p.leader,done:S.rcases[0].done}; });
check('дело соперника', r.done==='guilty'&&r.L0!==r.L1, r.L0+' → '+r.L1);

await boot(page,{role:'pm'});
r=await ev(()=>{ regInit(); S.ap=3; S.cap=60; S.treasury=100; const rid='ural', g=govOf(rid), m=S.mayors[rid];
  m.party=S.parties.find(p=>p.id!==g.party).id; m.feud=70; m.you=false; feudFlare(rid);
  const t=document.querySelector('#msheet h2').textContent; document.querySelector('#msheet .opt').click();
  return {t,f:m.feud}; });
check('края: мэр против губернатора', r.t==='Мэр против губернатора'&&r.f<40, r.t+' · вражда 70 → '+r.f);
await settle(page);
r=await ev(()=>{ const rid='sib', g=govOf(rid); g.you=false; const t0=S.treasury, r0=g.rel; greqAsk(rid,'money');
  document.querySelector('#msheet .opt').click(); return {dt:Math.round(t0-S.treasury), dr:Math.round(g.rel-r0)}; });
check('края: просьба главы', r.dt>0&&r.dr>0, 'казна −'+r.dt+' · отношение +'+r.dr);
await settle(page);
r=await ev(()=>{ const rid='kavkaz'; S.sep[rid]=80; S.auto[rid]=1; S.unrest[rid]=45; const c0=regRevenueCut();
  rrefStart(rid,'sov','край'); const m=document.getElementById('modal'); document.querySelector('#msheet .opt').click();
  m.classList.remove('show');mopen=false;mq.length=0;
  S.q=S.rref.due; const rr=Math.random; Math.random=()=>0.99; rrefResolve(); Math.random=rr;
  const sov=regSov(rid), c1=regRevenueCut();
  const os=[...document.querySelectorAll('#msheet .opt')]; S.treasury=100; os[0].click();
  return {sov,c0:Math.round(c0*100),c1:Math.round(c1*100),after:regSov(rid),auto:regAuto(rid)}; });
check('края: референдум о суверенитете и договор', r.sov&&r.c1>r.c0&&!r.after&&r.auto===2, 'доходы −'+r.c1+'% · после договора автономия '+r.auto);
await settle(page);
await boot(page,{role:'gov',pick:3});
r=await ev(()=>{ S.ap=3; S.cap=60; const a=deskActs().find(x=>x.id==='autoref'); if(!a)return {ok:false};
  deskAct('autoref'); return {ok:!!S.rref&&S.rref.by==='you', rid:S.rref&&S.rref.rid}; });
check('края: губернатор назначает референдум', r.ok, r.rid);
await settle(page);
await done(browser,errors,fails);
