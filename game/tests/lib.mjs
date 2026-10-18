/* Общая обвязка тестов: браузер, создание партии, закрытие листов.
   Playwright берётся из проекта, а если его там нет — из PLAYWRIGHT_PATH
   или из глобальной установки. Шрифты с Google отключаются: тесты
   не зависят от сети. */
import {fileURLToPath, pathToFileURL} from 'node:url';
import {dirname, join} from 'node:path';

async function loadPlaywright(){
  const tries=['playwright', process.env.PLAYWRIGHT_PATH, '/opt/node22/lib/node_modules/playwright/index.mjs'].filter(Boolean);
  for(const t of tries){ try{ return await import(t.startsWith('/')?pathToFileURL(t).href:t); }catch(e){} }
  throw new Error('Не найден playwright: npm i -D playwright или PLAYWRIGHT_PATH=/путь/к/playwright/index.mjs');
}
export const GAME=join(dirname(fileURLToPath(import.meta.url)),'..','index.html');

export async function open({width=1440,height=1100}={}){
  const {chromium}=await loadPlaywright();
  const browser=await chromium.launch();
  const page=await browser.newPage({viewport:{width,height}});
  const errors=[];
  page.on('console',m=>{ if(m.type()==='error'&&!/ERR_(CONNECTION|NAME|FAILED|BLOCKED)/.test(m.text()))errors.push(m.text()); });
  page.on('pageerror',e=>errors.push('PAGEERROR '+e.message.split('\n')[0]));
  await page.route('**fonts.googleapis.com**',r=>r.abort());
  await page.route('**fonts.gstatic.com**',r=>r.abort());
  await page.goto(pathToFileURL(GAME).href,{waitUntil:'domcontentloaded'});
  await page.waitForTimeout(350);
  return {browser,page,errors};
}
/* создание партии: первый вариант везде, на шаге кресла — нужная роль */
export async function boot(page,{role='pm',pick=0}={}){
  await page.evaluate(()=>{ try{localStorage.clear()}catch(e){} });
  await page.reload({waitUntil:'domcontentloaded'}); await page.waitForTimeout(300);
  await page.evaluate(()=>{ if(typeof startFresh==='function')startFresh(); });
  await page.waitForTimeout(200);
  for(let i=0;i<20;i++){
    const st=await page.evaluate(()=>({open:document.getElementById('modal').classList.contains('show'),
      eye:(document.querySelector('#msheet .mh i')||{}).textContent||''}));
    if(!st.open)break;
    if(st.eye==='Присяга принята'){ await page.evaluate(()=>document.querySelector('#msheet .mf button').click()); break; }
    await page.evaluate(({role,pick})=>{
      const r=document.querySelector('#msheet [data-role="'+role+'"]'); if(r){ r.click(); return; }
      const os=document.querySelectorAll('#msheet .opt');
      const eye=(document.querySelector('#msheet .mh i')||{}).textContent||'';
      const o=/^Кресло ·/.test(eye)?os[pick]:os[0];
      (o||document.querySelector('#msheet .mf button')).click(); },{role,pick});
    await page.waitForTimeout(120);
  }
  await settle(page);
}
/* дожать очередь листов первым вариантом и закрыть окно */
export async function settle(page,n=10){
  await page.evaluate(n=>{
    for(let i=0;i<n;i++){
      const m=document.getElementById('modal'); if(!m.classList.contains('show'))break;
      const o=document.querySelector('#msheet .opt'); (o||document.querySelector('#msheet .mf button')).click();
    }
    const m=document.getElementById('modal'); m.classList.remove('show'); mopen=false; mq.length=0;
    if(typeof nightTimer!=='undefined')clearInterval(nightTimer);
  },n);
}
/* квартал автопилота в браузере: рычаги кресла, иногда закон, листы — первым вариантом */
export const AUTOPILOT=`(function(n,opt){
  opt=opt||{}; const out={seats:[],err:null};
  const closeAll=()=>{ for(let k=0;k<12;k++){ const m=document.getElementById('modal'); if(!m.classList.contains('show'))break;
      const os=[...document.querySelectorAll('#msheet .opt')];
      const o=opt.random&&os.length?os[Math.floor(Math.random()*os.length)]:os[0];
      (o||document.querySelector('#msheet .mf button')).click(); }
    const m=document.getElementById('modal'); m.classList.remove('show'); mopen=false; mq.length=0; clearInterval(nightTimer); };
  for(let i=0;i<n&&!S.over;i++){
    try{
      const acts=deskActs().filter(a=>a.ap!==0&&(!a.ok||a.ok()===true));
      for(let k=0;k<2&&acts.length&&S.ap;k++){ const a=acts[Math.floor(Math.random()*acts.length)];
        deskAct(a.id); const o=document.querySelector('#msheet .opt'); if(o&&a.pick)o.click(); closeAll(); }
      if(opt.bills&&S.ap&&canBill()&&Math.random()<0.5){
        let best=null; TOPICS.filter(t=>!t.special).forEach(t=>[-1,1].forEach(st=>{ newBill(t.id); S.bill.stance=st;
          const y=tally(S.bill).yes; if(y>=MAJ&&(!best||y<best.y))best={t:t.id,st,y}; }));
        if(best){ newBill(best.t); S.bill.stance=best.st; submitBill(); closeAll(); } else S.bill=null;
      }
      endQuarter(); closeAll();
    }catch(e){ out.err=e.message+' @ '+(e.stack||'').split('\\n')[1]; break; }
    out.seats.push(S.over?'конец':mySeat());
  }
  return out; })`;
export function say(k,v){ console.log(String(k).padEnd(34)+' '+v); }
export async function done(browser,errors,extra){
  const all=errors.concat(extra||[]);
  console.log('\nerrors:', all.length?all.slice(0,8).join('\n'):'none');
  await browser.close();
  process.exitCode=all.length?1:0;
}
