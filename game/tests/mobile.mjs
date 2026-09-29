/* Телефон: 360 px, пять кресел, каждый раздел и главные листы. Страница не должна
   прокручиваться вбок; внутри .scrollx и лент .seg прокрутка разрешена. */
import {open,boot,say,done} from './lib.mjs';
const {browser,page,errors}=await open({width:360,height:780});
const fails=[];
const scan=()=>page.evaluate(()=>{
  const vw=document.documentElement.clientWidth;
  const bad=[...document.querySelectorAll('#view *, #msheet *')].filter(e=>{ const b=e.getBoundingClientRect();
    return b.width&&!e.closest('.scrollx,.seg')&&b.right>vw+1; });
  const leaves=bad.filter(e=>![...e.children].some(c=>bad.includes(c)));
  return {wide:document.documentElement.scrollWidth>vw, bad:leaves.slice(0,2).map(e=>e.tagName.toLowerCase()+
    '.'+[...e.classList].join('.')+' «'+(e.textContent||'').trim().slice(0,24)+'»')};
});
const closeSheet=()=>page.evaluate(()=>{ const m=document.getElementById('modal'); m.classList.remove('show'); mopen=false; mq.length=0; });
const SHEETS={pm:["askDeals({k:'budget'})","bcrisisStart('gorye')","askTrade('meridia')","askNeighbour('zarech')",
    "caseOpen({k:'министр',name:'Проверка',post:'fin'},'trail',60)"],
  gov:['askDesk()','askRaces()'], mayor:['askDesk()'], dep:['askBudgetLine()','askRaces()'], pres:['askDesk()']};
for(const [role,pick] of [['pm',0],['gov',3],['mayor',0],['dep',2],['pres',0]]){
  await boot(page,{role,pick});
  const tabs=await page.evaluate(()=>navItems().map(t=>t.id));
  let n=0;
  for(const t of tabs){
    await page.evaluate(t=>{ S.tab=t; render(); },t);
    const r=await scan(); n++;
    if(r.wide||r.bad.length)fails.push(role+'/'+t+': '+r.bad.join(', '));
  }
  for(const js of SHEETS[role]){
    await page.evaluate(js=>(0,eval)(js),js); await page.waitForTimeout(200);
    const r=await scan(); n++;
    if(r.wide||r.bad.length)fails.push(role+'/лист '+js+': '+r.bad.join(', '));
    await closeSheet();
  }
  say(role,'проверено экранов: '+n);
}
await page.evaluate(()=>{ finish(true,'Проверка полосы.'); });
await closeSheet();
await page.evaluate(()=>{ S.tab='final'; render(); });
const r=await scan(); if(r.wide||r.bad.length)fails.push('последняя полоса: '+r.bad.join(', '));
say('последняя полоса', r.wide||r.bad.length?'выпирает':'в ширину экрана');
await done(browser,errors,fails);
