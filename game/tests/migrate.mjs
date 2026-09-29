/* Старые сохранения: без полей кресла, фракций, скандалов и версии. */
import {open,boot,say,done} from './lib.mjs';
const {browser,page,errors}=await open();
await boot(page);
const r=await page.evaluate(()=>{
  // пишем в хранилище в обход save(): она проставила бы текущую версию
  const d=JSON.parse(JSON.stringify(S));
  ['chief','inf','lrel','mand','home'].forEach(k=>delete d.you[k]);
  ['desk','fl','deals','commM','scandals','bizLog','senLog','ver','cases','rcases','bAsk','bProm'].forEach(k=>delete d[k]);
  d.probe={k:'министр',name:'Старое Дело',left:2,buried:false};     // дело в прежнем формате, без ступеней
  localStorage.setItem(SAVE,JSON.stringify(d)); const ok=load();
  return {ok, chief:S.you.chief, fl:!!S.fl, comm:Object.keys(S.comm).length, ver:S.ver, cur:SAVE_VER, deals:Array.isArray(S.deals),
    probe:S.probe&&S.probe.stage, rcases:Array.isArray(S.rcases)};
});
say('загрузка старого сохранения', JSON.stringify(r));
const fails=[]; if(!r.ok||r.chief!==true||!r.fl||r.comm!==6||r.ver!==r.cur||!r.deals||r.probe!=='check'||!r.rcases)fails.push('миграция: '+JSON.stringify(r));
await done(browser,errors,fails);
