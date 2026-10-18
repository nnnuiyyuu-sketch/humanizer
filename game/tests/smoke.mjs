/* Все девять стартовых кресел: стол, рычаги по разу, 24 квартала автопилота. */
import {open,boot,say,done,AUTOPILOT} from './lib.mjs';
const {browser,page,errors}=await open();
const ROLES=[['pm',0],['pres',0],['vp',0],['min',1],['gov',3],['mayor',0],['sen',5],['dep',2],['none',4]];
const fails=[];
for(const [role,pick] of ROLES){
  await boot(page,{role,pick});
  const r=await page.evaluate(`(()=>{ S.tab='brief'; render();
    const d=document.querySelector('#view .panel.desk');
    const acts=deskActs().map(a=>a.id);
    const res=${AUTOPILOT}(24,{bills:true});
    return {seat:S.you.seat, desk:d?d.querySelectorAll('tbody tr').length:0, acts:acts.length, res, q:S.q}; })()`);
  if(r.res.err)fails.push(role+': '+r.res.err);
  const path=r.res.seats.filter((x,i,a)=>i===0||x!==a[i-1]).join(' → ');
  say(role, 'рычагов '+r.acts+' · 24 квартала: '+path+' · q='+r.q);
}
await done(browser,errors,fails);
