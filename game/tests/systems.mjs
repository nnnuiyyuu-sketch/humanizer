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
await done(browser,errors,fails);
