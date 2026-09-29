/* Старые сохранения: без полей кресла, фракций, скандалов и версии. */
import {open,boot,say,done} from './lib.mjs';
const {browser,page,errors}=await open();
await boot(page);
const r=await page.evaluate(()=>{
  ['chief','inf','lrel','mand','home'].forEach(k=>delete S.you[k]);
  ['desk','fl','deals','commM','scandals','bizLog','senLog','ver','cases'].forEach(k=>delete S[k]);
  save(); const ok=load();
  return {ok, chief:S.you.chief, fl:!!S.fl, comm:Object.keys(S.comm).length, ver:S.ver, deals:Array.isArray(S.deals)};
});
say('загрузка старого сохранения', JSON.stringify(r));
const fails=[]; if(!r.ok||r.chief!==true||!r.fl||r.comm!==6||r.ver!==2||!r.deals)fails.push('миграция: '+JSON.stringify(r));
await done(browser,errors,fails);
