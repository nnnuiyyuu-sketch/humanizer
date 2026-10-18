/* Быстрые тесты подряд. Баланс — отдельно: node game/tests/balance.mjs */
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';
const here=dirname(fileURLToPath(import.meta.url));
const list=process.argv.slice(2).length?process.argv.slice(2):['smoke','systems','migrate','mobile'];
let bad=0;
for(const t of list){
  process.stdout.write('── '+t+'\n');
  try{ execFileSync(process.execPath,[join(here,t+'.mjs')],{stdio:'inherit'}); }
  catch(e){ bad++; }
}
console.log(bad?'\nупало: '+bad:'\nвсе тесты прошли');
process.exitCode=bad?1:0;
