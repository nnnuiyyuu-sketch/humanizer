// Проверка русификатора в настоящем Chromium на макете игры.
'use strict';
const path = require('path');
const fs = require('fs');
const http = require('http');
const { chromium } = require('playwright');
const mock = require('./mock-translate-server');
const { makeGameDir, TEST_DICT, check, summary, waitFor } = require('./common');

function staticServer(dir) {
  const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8' };
  const srv = http.createServer((req, res) => {
    const p = path.join(dir, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!p.startsWith(dir) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': types[path.extname(p)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(p).pipe(res);
  });
  return new Promise(r => srv.listen(0, '127.0.0.1', () => r({ url: 'http://127.0.0.1:' + srv.address().port + '/', close: () => srv.close() })));
}

// Нативные геттеры, снятые до загрузки русификатора: так тест видит то, что на экране.
const INIT = `
  window.__raw = {
    text: Object.getOwnPropertyDescriptor(Node.prototype, 'textContent').get,
    html: Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML').get,
    attr: Element.prototype.getAttribute
  };
  window.shown = function (sel) { var e = document.querySelector(sel); return e ? __raw.text.call(e) : null; };
  window.shownAttr = function (sel, a) { var e = document.querySelector(sel); return e ? __raw.attr.call(e, a) : null; };
  window.__canvas = [];
  var nf = CanvasRenderingContext2D.prototype.fillText;
  CanvasRenderingContext2D.prototype.fillText = function (t) { window.__canvas.push(String(t)); return nf.apply(this, arguments); };
`;

(async () => {
  const mt = await mock.start();
  const dir = makeGameDir({ endpoint: mt.endpoint, requestDelayMs: 20, backoffBlockedMs: 300, backoffErrorMs: 200 }, TEST_DICT);
  const site = await staticServer(dir);
  const browser = await chromium.launch();
  const context = await browser.newContext();
  await context.addInitScript(INIT);
  const page = await context.newPage();
  const errors = [], dialogs = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('dialog', d => { dialogs.push(d.message()); d.accept(); });

  try {
    await page.goto(site.url + 'index.html');
    const ev = (fn, arg) => page.evaluate(fn, arg);

    console.log('Главное меню');
    check('кнопка New Game переведена', await ev(() => shown('#newGameBtn')) === 'Новая игра', await ev(() => shown('#newGameBtn')));
    check('кнопка Load Game переведена', await ev(() => shown('#loadGameBtn')) === 'Загрузить игру');
    check('input-кнопка Settings переведена', await ev(() => shownAttr('#settingsBtn', 'value')) === 'Настройки');
    check('шаблон "Version {0}"', await ev(() => shown('#mainIntroVersionP')) === 'Версия 0.4', await ev(() => shown('#mainIntroVersionP')));
    check('подсказка title переведена онлайн', await waitFor(() => ev(() => shownAttr('#newGameBtn', 'title') === 'ПЕРЕВОД:Start a new game')));
    check('игра видит английский title', await ev(() => document.getElementById('newGameBtn').title) === 'Start a new game');
    check('игра видит английский value', await ev(() => document.getElementById('settingsBtn').value) === 'Settings');

    console.log('\nЛогика игры читает надписи');
    await page.click('#newGameBtn');
    check('обработчик клика получил "New Game"', await ev(() => window.clickedLabel) === 'New Game', await ev(() => window.clickedLabel));
    check('textContent и innerText — оригинал', await ev(() => window.clickedLabelOk) === true);
    check('игра перешла к созданию персонажа', await ev(() => !!document.getElementById('hdr')));

    console.log('\nЭкран создания персонажа');
    check('заголовок переведён онлайн', await waitFor(() => ev(() => shown('#hdr') === 'ПЕРЕВОД:Character Creation')), await ev(() => shown('#hdr')));
    check('label из словаря', await ev(() => shown('label')) === 'Партия');
    check('option переведены', await ev(() => [...document.querySelectorAll('#party option')].map(o => __raw.text.call(o)).join('|')) === 'Демократ|Республиканец|Независимый');
    check('select.value — оригинал', await ev(() => document.getElementById('party').value) === 'Democrat');
    check('option.text — оригинал', await ev(() => document.getElementById('party').options[1].text) === 'Republican');
    await page.selectOption('#party', { index: 1 });
    check('выбор в списке → value "Republican"', await ev(() => document.getElementById('party').value) === 'Republican');
    check('placeholder переведён', await waitFor(() => ev(() => shownAttr('#nameInput', 'placeholder') === 'ПЕРЕВОД:Enter your name')));
    check('игра видит английский placeholder', await ev(() => document.getElementById('nameInput').placeholder) === 'Enter your name');
    check('введённое имя не тронуто', await ev(() => document.getElementById('nameInput').value) === 'John Smith');
    check('textarea не переводится', await ev(() => shown('#notes')) === 'Private notes stay English');
    check('.notranslate не переводится', await ev(() => shown('#nt')) === 'Do not translate me');
    check('Week 1 → Неделя 1', await ev(() => shown('#week')) === 'Неделя 1');
    check('плюрал: 1 голос', await ev(() => shown('#votes')) === 'У вас 1 голос', await ev(() => shown('#votes')));
    check('порядковое: 12th District → 12-й округ', await ev(() => shown('#dist')) === '12-й округ');
    check('input-кнопка End Turn', await ev(() => shownAttr('#endTurn', 'value')) === 'Завершить ход');
    check('fixes.json: «рейтинг поддержки»', await waitFor(() => ev(() => shown('#mixed') === 'Ваш рейтинг поддержки вырос.')), await ev(() => shown('#mixed')));
    check('fixes.json: «Палата представителей»', await waitFor(() => ev(() => shown('#house') === 'Палата представителей приняла бюджет.' || shown('#house'))) === 'Палата представителей приняла бюджет.' || (await ev(() => shown('#house'))).startsWith('Палата представителей'), await ev(() => shown('#house')));
    check('outerHTML для игры — английский', await ev(() => { const h = document.getElementById('hud').outerHTML; return h.includes('Week 1') && h.includes('You have 1 votes') && !/Неделя/.test(h); }));
    check('innerText для игры — английский', await ev(() => document.getElementById('hud').innerText) === 'Week 1 You have 1 votes', await ev(() => document.getElementById('hud').innerText));
    check('на экране (innerHTML напрямую) — русский', await ev(() => __raw.html.call(document.getElementById('hud')).includes('Неделя 1')));

    console.log('\nХоды');
    const t1 = await ev(() => nextTurn());
    check('игра видит "Week 2"', t1.weekText === 'Week 2', t1.weekText);
    check('игра видит value "End Turn"', t1.buttonValue === 'End Turn');
    check('на экране "Неделя 2" (изменение data)', await ev(() => shown('#week')) === 'Неделя 2');
    check('плюрал: 22 голоса', await ev(() => shown('#votes')) === 'У вас 22 голоса', await ev(() => shown('#votes')));
    const t2 = await ev(() => nextTurn());
    check('плюрал: 5 голосов', await ev(() => shown('#votes')) === 'У вас 5 голосов');
    check('innerHTML += видит английский', t2.newsHtml.includes('Senator Smith proposed a new bill.') && !/Сенатор/.test(t2.newsHtml));
    check('новости переведены', await waitFor(() => ev(() => [...document.querySelectorAll('#newsList li')].every(li => /[А-Яа-я]/.test(__raw.text.call(li))))),
      await ev(() => [...document.querySelectorAll('#newsList li')].map(li => __raw.text.call(li))));
    check('новость с числом через шаблон', await ev(() => __raw.text.call(document.querySelectorAll('#newsList li')[3])) === 'ПЕРЕВОД:Governor Jones vetoed bill number 103.',
      await ev(() => __raw.text.call(document.querySelectorAll('#newsList li')[3])));
    check('шаблон с числом стоил один запрос', mt.state.log.flat().filter(l => /^Governor Jones vetoed bill number/.test(l)).length === 1, mt.state.log.flat().filter(l => /Governor/.test(l)));

    console.log('\nГрафики и диалоги');
    check('canvas: Approval Rating → Рейтинг поддержки', await ev(() => __canvas.includes('Рейтинг поддержки')), await ev(() => __canvas));
    check('canvas: 42% без изменений', await ev(() => __canvas.includes('42%')));
    await waitFor(() => ev(() => window.__TPP_RU__.translate('Campaign funds this week') !== 'Campaign funds this week'));
    await ev(() => drawChart());
    check('canvas: онлайн-перевод при следующей отрисовке', await ev(() => __canvas.includes('ПЕРЕВОД:Campaign funds this week')), await ev(() => __canvas.slice(-3)));
    await ev(() => alert('Game saved'));
    check('alert переведён', dialogs[dialogs.length - 1] === 'Игра сохранена', dialogs);

    console.log('\nПакетная отправка, сломанные шаблоны, ограничения переводчика');
    const before = mt.state.requests;
    await ev(() => { const ul = document.getElementById('newsList'); for (let i = 0; i < 30; i++) ul.insertAdjacentHTML('beforeend', '<li>Breaking story number x' + String.fromCharCode(97 + i % 26) + (i >= 26 ? 'z' : '') + ' about the economy</li>'); });
    await waitFor(() => ev(() => __TPP_RU__.stats().queue === 0 && [...document.querySelectorAll('#newsList li')].every(li => /[А-Яа-я]/.test(__raw.text.call(li)))));
    check('30 новых строк → не больше 3 запросов', mt.state.requests - before <= 3, mt.state.requests - before);
    await ev(() => document.getElementById('game').insertAdjacentHTML('beforeend', '<p id="brk">Level 7 BREAK</p>'));
    check('испорченный шаблон → перевод строки целиком', await waitFor(() => ev(() => shown('#brk') === 'ПЕРЕВОД:Level 7 BREAK')), await ev(() => shown('#brk')));
    mt.state.failNext = 2;
    await ev(() => document.getElementById('game').insertAdjacentHTML('beforeend', '<p id="lim">Filibuster continues in the chamber</p>'));
    check('после двух ответов 429 перевод всё равно приходит', await waitFor(() => ev(() => shown('#lim') === 'ПЕРЕВОД:Filibuster continues in the chamber'), 8000), await ev(() => shown('#lim')));

    console.log('\nГорячие клавиши');
    await page.keyboard.press('F9');
    check('F9: интерфейс снова английский', await ev(() => shown('#newGameBtn') === 'New Game' && shown('#week') === 'Week 3' && shownAttr('#endTurn', 'value') === 'End Turn'));
    const reqBefore = mt.state.requests;
    await page.keyboard.press('F9');
    check('F9 ещё раз: снова русский', await waitFor(() => ev(() => shown('#newGameBtn') === 'Новая игра' && shown('#hdr') === 'ПЕРЕВОД:Character Creation')));
    check('повторное включение без запросов в сеть', mt.state.requests === reqBefore);
    const dp = path.join(dir, 'russifier', 'ru.json');
    const d = JSON.parse(fs.readFileSync(dp, 'utf8'));
    d['Character Creation'] = 'Создание персонажа';
    fs.writeFileSync(dp, JSON.stringify(d, null, 2));
    await page.keyboard.press('Shift+F9');
    check('Shift+F9 подхватил правку ru.json', await waitFor(() => ev(() => shown('#hdr') === 'Создание персонажа')), await ev(() => shown('#hdr')));
    await page.keyboard.press('F10');
    check('F10 показывает статистику', /словарь: \d+/.test(await ev(() => shown('#tppRuStatus')) || ''));

    console.log('\nКэш между запусками');
    await ev(() => __TPP_RU__.save());
    await page.reload();
    const reqAfterReload = mt.state.requests;
    await page.click('#newGameBtn');
    await ev(() => nextTurn());
    check('после перезапуска всё переведено сразу', await ev(() => shownAttr('#nameInput', 'placeholder') === 'ПЕРЕВОД:Enter your name' && shown('#mixed') === 'Ваш рейтинг поддержки вырос.'));
    await waitFor(() => ev(() => __TPP_RU__.stats().queue === 0), 2000);
    check('после перезапуска ни одного запроса в сеть', mt.state.requests === reqAfterReload, mt.state.requests - reqAfterReload);

    await page.screenshot({ path: path.join(__dirname, 'screenshot.png') });

    console.log('\nСкорость');
    const ms = await ev(() => {
      const t0 = performance.now();
      const rows = [];
      for (let i = 0; i < 2000; i++) rows.push('<tr><td>Senator</td><td>Republican</td><td>Week ' + i + '</td><td>Approval Rating</td></tr>');
      const tb = document.createElement('table');
      tb.innerHTML = rows.join('');
      document.body.appendChild(tb);
      return new Promise(r => setTimeout(() => r(performance.now() - t0), 0));
    });
    check('таблица 2000×4 переведена быстрее 500 мс (' + Math.round(ms) + ' мс)', ms < 500);
    check('таблица действительно переведена', await ev(() => { const td = document.querySelectorAll('table td'); return __raw.text.call(td[td.length - 2]) === 'Неделя 1999'; }));
    const readMs = await ev(() => { const t = document.querySelector('table'); const t0 = performance.now(); for (let i = 0; i < 20; i++) t.textContent; return performance.now() - t0; });
    check('20 чтений textContent у большой таблицы быстрее 400 мс (' + Math.round(readMs) + ' мс)', readMs < 400);

    check('на странице нет ошибок JavaScript', errors.length === 0, errors);
  } catch (e) {
    check('тест завершился без исключений', false, String(e && e.stack || e));
  } finally {
    await browser.close();
    site.close();
    await mt.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
  process.exit(summary('browser') ? 1 : 0);
})();
