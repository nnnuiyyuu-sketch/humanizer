'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = path.resolve(__dirname, '..');

// Копия "папки игры": макет + russifier/ + подключение как у install.ps1.
function makeGameDir(settingsOverride, extraDict) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tpp-ru-'));
  fs.copyFileSync(path.join(__dirname, 'fixture-game', 'index.html'), path.join(dir, 'index.html'));
  fs.mkdirSync(path.join(dir, 'russifier'));
  for (const f of ['russifier.js', 'ru.json', 'fixes.json', 'settings.json']) {
    fs.copyFileSync(path.join(ROOT, 'russifier', f), path.join(dir, 'russifier', f));
  }
  const sp = path.join(dir, 'russifier', 'settings.json');
  const s = JSON.parse(fs.readFileSync(sp, 'utf8'));
  Object.assign(s, settingsOverride || {});
  fs.writeFileSync(sp, JSON.stringify(s, null, 2));
  if (extraDict) {
    const dp = path.join(dir, 'russifier', 'ru.json');
    const d = JSON.parse(fs.readFileSync(dp, 'utf8'));
    Object.assign(d, extraDict);
    fs.writeFileSync(dp, JSON.stringify(d, null, 2));
  }
  patchIndex(path.join(dir, 'index.html'));
  return dir;
}

// Та же вставка, что делает install.ps1.
function patchIndex(file) {
  const tag = '<!--tpp-russifier--><script src="russifier/russifier.js"></script><!--/tpp-russifier-->';
  let html = fs.readFileSync(file, 'utf8').replace(/<!--tpp-russifier-->.*?<!--\/tpp-russifier-->\r?\n?/g, '');
  const m = /<head(\s[^>]*)?>/i.exec(html);
  html = html.slice(0, m.index + m[0].length) + '\n' + tag + html.slice(m.index + m[0].length);
  fs.writeFileSync(file, html);
}

const TEST_DICT = {
  'You have {0} votes': 'У вас {0} {0|голос|голоса|голосов}'
};

let failures = 0, passes = 0;
function check(name, cond, detail) {
  if (cond) { passes++; console.log('  ok   ' + name); }
  else { failures++; console.log('  FAIL ' + name + (detail !== undefined ? '  → ' + JSON.stringify(detail) : '')); }
}
function summary(label) {
  console.log(`\n${label}: ${passes} passed, ${failures} failed`);
  return failures;
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function waitFor(fn, ms = 5000, step = 50) {
  const end = Date.now() + ms;
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() > end) return v;
    await sleep(step);
  }
}

module.exports = { makeGameDir, patchIndex, TEST_DICT, check, summary, sleep, waitFor, ROOT };
