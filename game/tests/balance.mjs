/* Баланс: каждое кресло N раз по 48 кварталов автопилота, сводка.
     node game/tests/balance.mjs [прогонов=3] [кварталов=48]
     HARD=1 node game/tests/balance.mjs    то же в жёсткой стране
   Автопилот тратит ходы на рычаги кресла и проводит закон, который
   проходит, а на листах выбирает вариант наугад (FIRST=1 — всегда
   первый). Грубая модель игрока, но одинаковая для всех кресел. */
import {open,boot,AUTOPILOT} from './lib.mjs';
const RUNS=+(process.argv[2]||3), Q=+(process.argv[3]||48);
const ROLES=[['pm',0],['pres',0],['vp',0],['min',1],['gov',3],['mayor',0],['sen',5],['dep',2],['none',4]];
const {browser,page,errors}=await open();
const rows=[];
for(const [role,pick] of ROLES){
  const acc=[];
  for(let r=0;r<RUNS;r++){
    await boot(page,{role,pick});
    if(process.env.HARD)await page.evaluate(()=>{ S.diff='hard'; });
    const x=await page.evaluate(`(()=>{
      const ap=[], seats=new Set(); let falls=0, lead=S.gov.lead;
      const f=${AUTOPILOT};
      for(let i=0;i<${Q}&&!S.over;i++){ const res=f(1,{bills:true,random:${process.env.FIRST?'false':'true'}}); if(res.err)return {err:res.err};
        ap.push(approval()); seats.add(mySeat()); if(S.gov.lead!==lead){ falls++; lead=S.gov.lead; } }
      const sc=score();
      const mins=POSTS.map(p=>minOf(p.id).comp);
      return {score:sc.s, over:S.over, ended:S.ended||'', q:S.q, ap:ap.reduce((a,b)=>a+b,0)/ap.length,
        laws:S.laws.filter(l=>l.by===PL).length, seatsPL:seatsOf(PL), falls, seat:mySeat(), seats:[...seats].join(','),
        chief:chief(), mins:mins.reduce((a,b)=>a+b,0)/mins.length, scandals:(S.scandals||[]).filter(s=>s.who==='you').length,
        deals:(S.deals||[]).length, clim:bizClimate(), unrest:avgUnrest(), debt:S.debt};
    })()`);
    if(x.err){ console.log(role,'ОШИБКА',x.err); continue; }
    acc.push(x);
  }
  const m=k=>acc.length?acc.reduce((a,x)=>a+(+x[k]||0),0)/acc.length:0;
  const early=x=>x.over&&!/Три созыва/.test(x.ended);
  rows.push({role, n:acc.length, score:m('score'), over:acc.filter(early).length, ap:m('ap'), laws:m('laws'),
    seatsPL:m('seatsPL'), falls:m('falls'), mins:m('mins'), sc:m('scandals'), clim:m('clim'), unrest:m('unrest'), debt:m('debt'),
    chief:acc.filter(x=>x.chief).length, end:acc.map(x=>x.seat).join('/'), why:acc.filter(early).map(x=>x.ended.slice(0,40)).join('; ')});
}
const f=(v,d=0)=>v.toFixed(d).padStart(6);
console.log('кресло   прог  очки  рано  одобр законы места смены минист скан  клим  напр  долг  лидер  финал');
rows.forEach(r=>console.log(r.role.padEnd(8)+String(r.n).padStart(5)+f(r.score)+String(r.over).padStart(6)+f(r.ap)+f(r.laws,1)+f(r.seatsPL)+
  f(r.falls,1)+f(r.mins)+f(r.sc,1)+f(r.clim)+f(r.unrest)+f(r.debt)+String(r.chief).padStart(6)+'  '+r.end+(r.why?'  ['+r.why+']':'')));
console.log('\nerrors:', errors.length?errors.slice(0,5).join('\n'):'none');
await browser.close();
