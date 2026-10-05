#!/usr/bin/env node
/* Сборка «Новарии»: модули из src/ склеиваются в один index.html.
   Игроку по-прежнему нужен один файл; править удобнее по частям.

     node game/build.mjs          собрать и проверить
     node game/build.mjs --check  только проверить, что index.html собран из src/

   Проверки: синтаксис скрипта (node --check), совпадение токенов
   :root, объекта ICON, блока стилей кресла/фракций и парадной
   редакции с ui.html. */
import {readFileSync, writeFileSync, mkdtempSync, rmSync} from 'node:fs';
import {join, dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
/* порядок важен: данные раньше ядра, ядро раньше хода, интерфейс в конце */
export const PARTS = ['head.html','assets.js','icons.js','data.js','core.js','turn.js','parl.js',
  'roles.js','factions.js','power.js','media.js','rivals.js','budget.js','cases.js','regions.js','foreign.js','legacy.js','cabinet.js','ui.js','boot.js'];
const TAIL = '</script>\n</body>\n</html>\n';

export function assemble(){
  return PARTS.map(p=>readFileSync(join(here,'src',p),'utf8')).join('')+TAIL;
}
function script(html){
  const a=html.indexOf('<script>\n'), b=html.lastIndexOf('</script>');
  return html.slice(a+9,b);
}
function block(text,start,end){
  const a=text.indexOf(start); if(a<0)return null;
  const b=text.indexOf(end,a); if(b<0)return null;
  return text.slice(a,b+end.length);
}
function checkSyntax(html){
  const dir=mkdtempSync(join(tmpdir(),'novaria-'));
  const f=join(dir,'game.js');
  writeFileSync(f,script(html));
  try{ execFileSync(process.execPath,['--check',f],{stdio:'pipe'}); }
  catch(e){ throw new Error('синтаксис: '+String(e.stderr||e.message).split('\n').slice(0,6).join('\n')); }
  finally{ rmSync(dir,{recursive:true,force:true}); }
}
/* система — источник правды: эти куски в игре и в ui.html должны совпадать до байта */
function checkParity(html){
  const ui=readFileSync(join(here,'ui.html'),'utf8');
  const pairs=[
    ['токены :root', '\n:root{', '\n}\n'],
    ['объект ICON', 'const ICON={', '\n};'],
    ['блок кресла и фракций', '/* ── кресло: выбор на старте и стол в «Кабинете»', '@media (max-width:520px){ .roles{grid-template-columns:1fr} }'],
    ['парадная редакция', '/* ══ третья редакция: парадный госстиль', '/* ══ конец парадной редакции ══ */'],
  ];
  const bad=[];
  pairs.forEach(([name,s,e])=>{ const g=block(html,s,e), u=block(ui,s,e);
    if(!g||!u||g!==u)bad.push(name); });
  return bad;
}

const onlyCheck=process.argv.includes('--check');
const html=assemble();
if(onlyCheck){
  const cur=readFileSync(join(here,'index.html'),'utf8');
  if(cur!==html){ console.error('index.html не совпадает со сборкой из src/: запустите node game/build.mjs'); process.exit(1); }
} else writeFileSync(join(here,'index.html'),html);
checkSyntax(html);
const bad=checkParity(html);
if(bad.length){ console.error('расходится с ui.html: '+bad.join(', ')); process.exit(1); }
console.log((onlyCheck?'проверено':'собрано')+': index.html, '+html.split('\n').length+' строк, синтаксис и ui.html в порядке');
