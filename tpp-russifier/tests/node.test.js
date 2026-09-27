// Режим NW.js: русификатор работает через Node (fs, http), как в настоящей игре.
// DOM — jsdom, объект nw подменён: { require, __dirname, App.dataPath }.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { JSDOM } = require('jsdom');
const mock = require('./mock-translate-server');
const { makeGameDir, TEST_DICT, check, summary, waitFor } = require('./common');

const CORE = fs.readFileSync(path.join(__dirname, '..', 'russifier', 'russifier.js'), 'utf8');

// Как в игре: сначала русификатор, потом скрипт игры.
function launch(gameDir, dataDir) {
  let html = fs.readFileSync(path.join(gameDir, 'index.html'), 'utf8')
    .replace(/<!--tpp-russifier-->.*?<!--\/tpp-russifier-->/, '');
  const gameScript = /<script>([\s\S]*?)<\/script>/.exec(html)[1];
  html = html.replace(/<script>[\s\S]*?<\/script>/, '');
  const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'file:///' + gameDir.replace(/\\/g, '/') + '/index.html' });
  const w = dom.window;
  const nativeData = Object.getOwnPropertyDescriptor(w.CharacterData.prototype, 'data').get;
  // То, что видит игрок: текст узлов в обход перехвата.
  w.shown = el => { let t = ''; const it = w.document.createTreeWalker(el, 4); for (let n = it.nextNode(); n; n = it.nextNode()) t += nativeData.call(n); return t; };
  w.HTMLCanvasElement.prototype.getContext = () => ({ fillText() {}, measureText() { return { width: 0 }; } }); // в jsdom нет canvas
  w.nw = { require: require, __dirname: gameDir, App: { dataPath: dataDir } };
  w.eval(CORE);
  w.eval(gameScript);
  return w;
}

(async () => {
  const mt = await mock.start();
  const game = makeGameDir({ endpoint: mt.endpoint, requestDelayMs: 10, backoffErrorMs: 100, backoffBlockedMs: 100, collectMissing: true }, TEST_DICT);
  const data = fs.mkdtempSync(path.join(os.tmpdir(), 'tpp-ru-data-'));
  const cacheFile = path.join(game, 'russifier', 'cache.json');
  let w;
  try {
    console.log('Запуск 1: словарь с диска и перевод через Node http');
    w = launch(game, data);
    const $ = s => w.document.querySelector(s);
    const raw = el => w.shown(el);
    const st = w.__TPP_RU__.stats();
    check('режим nwjs, папка найдена через nw.__dirname', st.mode === 'nwjs' && st.base === path.join(game, 'russifier'), st);
    check('словарь загружен с диска', st.dictionary > 400, st.dictionary);
    await new Promise(r => setTimeout(r, 0));
    check('кнопка New Game → Новая игра', raw($('#newGameBtn')) === 'Новая игра');
    check('textContent для игры — оригинал', $('#newGameBtn').textContent === 'New Game');
    w.startGame();
    await new Promise(r => setTimeout(r, 0));
    check('онлайн-перевод пришёл через Node http', await waitFor(() => raw($('#hdr')) === 'ПЕРЕВОД:Character Creation'), raw($('#hdr')));
    check('шаблон с плюралом', raw($('#votes')) === 'У вас 1 голос');
    await waitFor(() => w.__TPP_RU__.stats().queue === 0);
    w.__TPP_RU__.save();
    check('cache.json записан в папку russifier', fs.existsSync(cacheFile));
    const cache = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
    check('в кэше есть онлайн-перевод', cache['Character Creation'] === 'ПЕРЕВОД:Character Creation', Object.keys(cache));
    check('в кэше исправленная строка', cache['Your approval rating has increased.'] === 'Ваш рейтинг поддержки вырос.');
    const miss = JSON.parse(fs.readFileSync(path.join(game, 'russifier', 'missing.json'), 'utf8'));
    check('missing.json собирает непереведённые строки', 'Character Creation' in miss && !('New Game' in miss), Object.keys(miss).slice(0, 5));
    w.close();

    console.log('\nЗапуск 2: всё из кэша, без сети');
    const before = mt.state.requests;
    w = launch(game, data);
    w.startGame();
    await new Promise(r => setTimeout(r, 0));
    const $2 = s => w.document.querySelector(s);
    const raw2 = el => w.shown(el);
    check('заголовок переведён сразу из cache.json', raw2($2('#hdr')) === 'ПЕРЕВОД:Character Creation', raw2($2('#hdr')));
    await new Promise(r => setTimeout(r, 300));
    check('ни одного запроса в сеть', mt.state.requests === before, mt.state.requests - before);
    w.close();

    console.log('\nПапка игры без права записи');
    fs.rmSync(cacheFile);
    fs.mkdirSync(cacheFile); // запись в cache.json невозможна
    w = launch(game, data);
    w.document.body.insertAdjacentHTML('beforeend', '<p id="ro">Readonly folder test string</p>');
    await waitFor(() => w.__TPP_RU__.stats().queue === 0 && w.__TPP_RU__.stats().translated > 0);
    w.__TPP_RU__.save();
    const alt = path.join(data, 'tpp-russifier-cache.json');
    check('кэш ушёл в профиль игры (nw.App.dataPath)', fs.existsSync(alt) && /Readonly folder test string/.test(fs.readFileSync(alt, 'utf8')));
    w.close();
    fs.rmdirSync(cacheFile);

    console.log('\nПовреждённый cache.json');
    fs.writeFileSync(cacheFile, '{ "broken": ');
    w = launch(game, data);
    await new Promise(r => setTimeout(r, 0));
    check('игра работает, словарь применяется', w.document.querySelector('#newGameBtn').textContent === 'New Game' &&
      w.shown(w.document.querySelector('#newGameBtn')) === 'Новая игра');
    check('битый файл отложен в cache.json.broken', fs.existsSync(cacheFile + '.broken') && !fs.existsSync(cacheFile));
    check('кэш из профиля подхвачен', w.__TPP_RU__.stats().cache > 0);
    w.close();

    console.log('\nНет интернета');
    const off = makeGameDir({ endpoint: 'http://127.0.0.1:9/translate_a/single?q={q}', backoffErrorMs: 100 }, TEST_DICT);
    w = launch(off, fs.mkdtempSync(path.join(os.tmpdir(), 'tpp-ru-data-')));
    w.startGame();
    await waitFor(() => w.__TPP_RU__.stats().lastError, 3000);
    const s3 = w.__TPP_RU__.stats();
    check('ошибка сети не ломает игру, строки ждут в очереди', /нет связи/.test(s3.lastError) && s3.queue > 0, s3);
    check('словарные строки при этом переведены', w.document.querySelector('#week').textContent === 'Week 1' &&
      w.shown(w.document.querySelector('#week')) === 'Неделя 1');
    w.close();
    fs.rmSync(off, { recursive: true, force: true });
  } catch (e) {
    check('тест завершился без исключений', false, String(e && e.stack || e));
  } finally {
    await mt.close();
    fs.rmSync(game, { recursive: true, force: true });
    fs.rmSync(data, { recursive: true, force: true });
  }
  process.exit(summary('node') ? 1 : 0);
})();
