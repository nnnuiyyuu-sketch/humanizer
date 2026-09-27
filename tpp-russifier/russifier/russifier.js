/*!
 * TPP-RU — русификатор The Political Process (NW.js).
 *
 * Переводит игру прямо во время работы: следит за окном игры и заменяет
 * английский текст русским. Источники перевода, по приоритету:
 *   1) russifier/ru.json    — ручной словарь (его можно и нужно править);
 *   2) russifier/cache.json — сохранённый машинный перевод;
 *   3) онлайн-переводчик   — для строк, которых ещё нет нигде. Результат
 *      сразу пишется в cache.json, повторно сеть для этой строки не нужна.
 *
 * Игровая логика по-прежнему видит английский текст: textContent,
 * innerText, innerHTML, value и getAttribute возвращают оригинал, поэтому
 * скрипты игры, которые сравнивают надписи, продолжают работать.
 *
 * Код намеренно написан на ES2019 (без ?. и ??): старые сборки игры
 * работают на NW.js 0.41 / Chromium 78.
 */
(function () {
  'use strict';

  var W = window, DOC = document;
  if (W.__TPP_RU__) return;

  var VERSION = '1.0.0';
  var HAS = Object.prototype.hasOwnProperty;
  var on = false;

  // ------------------------------------------------------------------
  // Node.js внутри NW.js
  // ------------------------------------------------------------------

  var nodeRequire = null;
  try { if (typeof nw !== 'undefined' && nw && typeof nw.require === 'function') nodeRequire = nw.require; } catch (e) { /* не NW.js */ }
  if (!nodeRequire) { try { if (typeof require === 'function') nodeRequire = require; } catch (e) { /* обычный браузер */ } }

  function req(name) {
    if (!nodeRequire) return null;
    try { return nodeRequire(name); } catch (e) { return null; }
  }

  var fs = req('fs'), pathm = req('path'), proc = req('process');

  var SCRIPT_URL = (DOC.currentScript && DOC.currentScript.src) || '';
  var URL_BASE = SCRIPT_URL ? SCRIPT_URL.replace(/[^\/]*([?#].*)?$/, '') : 'russifier/';

  function fileUrlToPath(u) {
    var p = decodeURIComponent(u.replace(/^file:\/\//i, '').replace(/[?#].*$/, ''));
    if (/^\/[A-Za-z]:/.test(p)) p = p.slice(1);
    return p;
  }

  // Папка russifier на диске (null — работаем без Node, через XHR).
  function findBase() {
    if (!fs || !pathm) return null;
    var dirs = [];
    if (typeof W.__TPP_RU_BASE__ === 'string') dirs.push(W.__TPP_RU_BASE__);
    try { if (/^file:/i.test(SCRIPT_URL)) dirs.push(pathm.dirname(fileUrlToPath(SCRIPT_URL))); } catch (e) { /* ignore */ }
    try { if (nw.__dirname) dirs.push(pathm.join(nw.__dirname, 'russifier')); } catch (e) { /* ignore */ }
    try { dirs.push(pathm.join(proc.cwd(), 'russifier')); } catch (e) { /* ignore */ }
    try { dirs.push(pathm.join(pathm.dirname(proc.execPath), 'russifier')); } catch (e) { /* ignore */ }
    for (var i = 0; i < dirs.length; i++) {
      try { if (fs.existsSync(pathm.join(dirs[i], 'settings.json'))) return dirs[i]; } catch (e) { /* ignore */ }
    }
    return null;
  }

  var BASE = findBase();

  function dataDir() {
    try { return nw.App.dataPath || null; } catch (e) { return null; }
  }

  // ------------------------------------------------------------------
  // Файлы
  // ------------------------------------------------------------------

  function readText(name) {
    if (BASE) {
      try { return fs.readFileSync(pathm.join(BASE, name), 'utf8'); } catch (e) { return null; }
    }
    try {
      var x = new XMLHttpRequest();
      x.open('GET', URL_BASE + name, false);
      x.send(null);
      if ((x.status === 200 || x.status === 0) && x.responseText) return x.responseText;
    } catch (e) { /* файла нет */ }
    return null;
  }

  function parseJson(text) {
    return JSON.parse(String(text).replace(/^﻿/, ''));
  }

  function readJson(name, fallback) {
    var t = readText(name);
    if (t === null) return fallback;
    try { return parseJson(t); } catch (e) {
      problem('Ошибка в файле ' + name + ': ' + e.message);
      return fallback;
    }
  }

  function writeFileSafe(file, text) {
    fs.writeFileSync(file + '.tmp', text, 'utf8');
    fs.renameSync(file + '.tmp', file);
  }

  function serialize(map) {
    var keys = Array.from(map.keys()).sort(), lines = [];
    for (var i = 0; i < keys.length; i++) lines.push('  ' + JSON.stringify(keys[i]) + ': ' + JSON.stringify(map.get(keys[i])));
    return '{\n' + lines.join(',\n') + '\n}\n';
  }

  function mergeInto(map, obj) {
    if (!obj || typeof obj !== 'object') return;
    for (var k in obj) if (HAS.call(obj, k) && typeof obj[k] === 'string') map.set(k, obj[k]);
  }

  // ------------------------------------------------------------------
  // Настройки, словарь, исправления, кэш
  // ------------------------------------------------------------------

  var DEFAULTS = {
    enabled: true,
    machineTranslation: true,
    sourceLang: 'en',
    targetLang: 'ru',
    endpoint: 'https://translate.googleapis.com/translate_a/single?client=gtx&ie=UTF-8&oe=UTF-8&dt=t&sl={sl}&tl={tl}&q={q}',
    requestDelayMs: 400,
    maxBatchChars: 1500,
    maxBatchItems: 25,
    backoffBlockedMs: 60000,
    backoffErrorMs: 10000,
    gameSeesOriginal: true,
    translateCanvas: true,
    translateDialogs: true,
    showStatus: true,
    hotkeyToggle: 'F9',
    hotkeyStatus: 'F10',
    excludeSelectors: [],
    fontFamily: '',
    extraCss: '',
    collectMissing: false
  };

  var CACHE_FILE = 'cache.json', MISSING_FILE = 'missing.json';
  var DATA_CACHE_FILE = 'tpp-russifier-cache.json', LS_KEY = 'tppRussifierCache';

  var settings = {}, dict = new Map(), dictLower = new Map(), cache = new Map(), missing = new Map();
  var fixes = [], excludeSel = '';

  function loadConfig() {
    var s = readJson('settings.json', {}), k;
    if (!s || typeof s !== 'object') s = {};
    settings = {};
    for (k in DEFAULTS) settings[k] = HAS.call(s, k) ? s[k] : DEFAULTS[k];

    dict = new Map();
    dictLower = new Map();
    var d = readJson('ru.json', {});
    for (k in d) {
      if (!HAS.call(d, k) || typeof d[k] !== 'string' || !d[k] || k.charAt(0) === '_') continue;
      var nk = norm(k);
      dict.set(nk, d[k]);
      dictLower.set(nk.toLowerCase(), d[k]);
    }

    fixes = [];
    var f = readJson('fixes.json', []);
    if (Array.isArray(f)) {
      f.forEach(function (x) {
        if (!x || typeof x.from !== 'string') return;
        try {
          fixes.push({ re: new RegExp(x.from, typeof x.flags === 'string' ? x.flags : 'g'), to: x.to == null ? '' : String(x.to) });
        } catch (e) { problem('fixes.json: ' + e.message); }
      });
    }

    var sels = ['#tppRuStatus', '[translate="no"]', '.notranslate'];
    if (Array.isArray(settings.excludeSelectors)) sels = sels.concat(settings.excludeSelectors);
    excludeSel = sels.filter(validSelector).join(',');
    applyCss();
  }

  function validSelector(s) {
    if (typeof s !== 'string' || !s) return false;
    try { DOC.createDocumentFragment().querySelector(s); return true; } catch (e) {
      problem('Неверный селектор в excludeSelectors: ' + s);
      return false;
    }
  }

  function loadCache() {
    cache = new Map();
    try { mergeInto(cache, parseJson(W.localStorage.getItem(LS_KEY) || '{}')); } catch (e) { /* пусто */ }
    var dd = dataDir();
    if (fs && dd) {
      try { mergeInto(cache, parseJson(fs.readFileSync(pathm.join(dd, DATA_CACHE_FILE), 'utf8'))); } catch (e) { /* пусто */ }
    }
    var t = readText(CACHE_FILE);
    if (t !== null) {
      try { mergeInto(cache, parseJson(t)); } catch (e) {
        problem('cache.json повреждён, сохранён как cache.json.broken');
        if (BASE) { try { fs.renameSync(pathm.join(BASE, CACHE_FILE), pathm.join(BASE, CACHE_FILE + '.broken')); } catch (e2) { /* ignore */ } }
      }
    }
    missing = new Map();
    if (settings.collectMissing) mergeInto(missing, readJson(MISSING_FILE, {}));
  }

  var baseWritable = true, dirtyCache = false, dirtyMissing = false, saveTimer = 0;

  function markDirty() {
    if (!saveTimer) saveTimer = setTimeout(saveAll, 3000);
  }

  function saveAll() {
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = 0; }
    if (dirtyCache) { dirtyCache = false; saveCache(); }
    if (dirtyMissing && fs && BASE) {
      dirtyMissing = false;
      try { writeFileSafe(pathm.join(BASE, MISSING_FILE), serialize(missing)); } catch (e) { /* ignore */ }
    }
  }

  function saveCache() {
    var text = serialize(cache);
    if (fs) {
      if (BASE && baseWritable) {
        try { writeFileSafe(pathm.join(BASE, CACHE_FILE), text); return; } catch (e) {
          baseWritable = false;
          problem('Нет доступа на запись в папку игры — кэш перевода сохраняется в профиль игры');
        }
      }
      var dd = dataDir();
      if (dd) { try { writeFileSafe(pathm.join(dd, DATA_CACHE_FILE), text); return; } catch (e) { /* ignore */ } }
    }
    try { W.localStorage.setItem(LS_KEY, text); } catch (e) { /* ignore */ }
  }

  var styleEl = null;
  function applyCss() {
    var css = '';
    if (settings.fontFamily) css += 'body, body * { font-family: ' + settings.fontFamily + ' !important; }\n';
    if (settings.extraCss) css += String(settings.extraCss);
    if (!css) { if (styleEl && styleEl.parentNode) styleEl.parentNode.removeChild(styleEl); return; }
    if (!styleEl) { styleEl = DOC.createElement('style'); styleEl.id = 'tppRuStyle'; }
    styleEl.textContent = css;
    if (!styleEl.parentNode) (DOC.head || DOC.documentElement).appendChild(styleEl);
  }

  // ------------------------------------------------------------------
  // Работа со строками
  // ------------------------------------------------------------------

  var RE_CYR = /[Ѐ-ӿ]/, RE_LAT = /[A-Za-z]/, RE_LAT2 = /[A-Za-z]{2}/;
  var RE_NUM = /\$?\d+(?:[.,]\d+)*(?:st|nd|rd|th)?%?/g;

  function norm(s) { return String(s).replace(/\s+/g, ' ').trim(); }

  function isWs(c) { return c === 32 || c === 9 || c === 10 || c === 13 || c === 12 || c === 160; }

  // [ведущие пробелы, суть, хвостовые пробелы]
  function split3(s) {
    var a = 0, b = s.length;
    while (a < b && isWs(s.charCodeAt(a))) a++;
    while (b > a && isWs(s.charCodeAt(b - 1))) b--;
    return [s.slice(0, a), s.slice(a, b), s.slice(b)];
  }

  function isAllCaps(s) { return /[A-Z]{2}/.test(s) && s === s.toUpperCase(); }

  // "Week 12 of 52" -> { t: "Week {0} of {1}", args: ["12", "52"] }
  function templatize(s) {
    var args = [];
    var t = s.replace(RE_NUM, function (m) { args.push(m); return '{' + (args.length - 1) + '}'; });
    return { t: t, args: args };
  }

  function numValue(raw) {
    var v = parseFloat(String(raw).replace(/st|nd|rd|th|[$,%]/g, ''));
    return isNaN(v) ? 0 : v;
  }

  // Русские формы множественного числа: [1 голос, 2 голоса, 5 голосов].
  function plural(n, forms) {
    n = Math.abs(n);
    if (n % 1 !== 0) return forms[1];
    var m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return forms[0];
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return forms[1];
    return forms[2];
  }

  // {0} — число как есть (12th -> 12-й), {0|голос|голоса|голосов} — форма слова.
  function fill(tpl, args) {
    return tpl.replace(/\{(\d+)(?:\|([^{}|]*)\|([^{}|]*)\|([^{}]*))?\}/g, function (m, i, a, b, c) {
      var raw = args[+i];
      if (raw === undefined) return m;
      if (a !== undefined) return plural(numValue(raw), [a, b, c]);
      var ord = /^(.*\d)(?:st|nd|rd|th)$/.exec(raw);
      return ord ? ord[1] + '-й' : raw;
    });
  }

  // Синхронный поиск перевода: словарь -> кэш -> шаблон с числами -> без учёта регистра.
  function lookup(core) {
    var k = norm(core);
    if (!k) return null;
    var v = dict.get(k);
    if (v !== undefined) return v;
    v = cache.get(k);
    if (v !== undefined) return v;
    var tp = RE_NUM.test(k) ? templatize(k) : null;
    RE_NUM.lastIndex = 0;
    if (tp && tp.args.length) {
      v = dict.get(tp.t);
      if (v === undefined) v = cache.get(tp.t);
      if (v !== undefined) return fill(v, tp.args);
    }
    var caps = isAllCaps(k);
    v = dictLower.get(k.toLowerCase());
    if (v === undefined && tp && tp.args.length) {
      v = dictLower.get(tp.t.toLowerCase());
      if (v !== undefined) v = fill(v, tp.args);
    }
    if (v !== undefined) return caps ? v.toUpperCase() : v;
    return null;
  }

  // Стоит ли отправлять строку в онлайн-переводчик.
  function worthMT(k) {
    if (k.length < 2 || k.length > 4500) return false;
    if (!RE_LAT2.test(k) || RE_CYR.test(k)) return false;
    if (/^[A-Z]{1,3}$/.test(k)) return false;
    if (/^(https?:\/\/|www\.)\S+$/i.test(k)) return false;
    if (/^[\w\-.\/\\]+\.(js|json|css|html?|png|jpe?g|gif|svg|bin|txt|mp3|ogg|wav)$/i.test(k)) return false;
    if (/^[a-z]+[A-Z][A-Za-z0-9]*$/.test(k) || /^[A-Za-z0-9]+_[A-Za-z0-9_]+$/.test(k)) return false;
    return true;
  }

  var badTpl = new Set();

  // Ключ для переводчика: по возможности шаблон, чтобы "Week 1".."Week 52" стоили один запрос.
  function mtKey(k) {
    var tp = templatize(k);
    if (tp.args.length && tp.args.length <= 6 && !badTpl.has(tp.t) && RE_LAT2.test(tp.t)) return tp.t;
    return k;
  }

  function noteMissing(k) {
    if (!settings.collectMissing || missing.has(k) || dict.has(k)) return;
    missing.set(k, '');
    dirtyMissing = true;
    markDirty();
  }

  // Строка не найдена: запоминаем, кому она нужна, и ставим в очередь переводчика.
  function request(core, target) {
    var k = norm(core);
    if (!RE_LAT2.test(k) || RE_CYR.test(k)) return;
    noteMissing(k);
    if (!settings.machineTranslation || !worthMT(k)) return;
    enqueue(mtKey(k), target);
  }

  function translateString(s, noQueue) {
    if (!on || typeof s !== 'string' || !RE_LAT.test(s)) return s;
    var p = split3(s);
    if (!p[1]) return s;
    var tr = lookup(p[1]);
    if (tr === null) { if (!noQueue) request(p[1], null); return s; }
    return p[0] + tr + p[2];
  }

  function postProcess(src, out) {
    out = String(out).replace(/\{\s*(\d+)\s*\}/g, '{$1}').trim();
    for (var i = 0; i < fixes.length; i++) { fixes[i].re.lastIndex = 0; out = out.replace(fixes[i].re, fixes[i].to); }
    if (!out) return out;
    var s0 = src.charAt(0), o0 = out.charAt(0);
    if (isAllCaps(src)) out = out.toUpperCase();
    else if (s0 !== s0.toUpperCase() && o0 !== o0.toLowerCase()) out = o0.toLowerCase() + out.slice(1);
    else if (s0 !== s0.toLowerCase() && o0 !== o0.toUpperCase()) out = o0.toUpperCase() + out.slice(1);
    if (!/[.!?…]$/.test(src) && /[^.]\.$/.test(out)) out = out.slice(0, -1);
    if (/:$/.test(src) && !/:$/.test(out)) out += ':';
    return out;
  }

  function placeholdersOk(key, out) {
    var want = key.match(/\{\d+\}/g) || [], have = out.match(/\{\d+\}/g) || [];
    if (want.length !== have.length) return false;
    want.sort(); have.sort();
    for (var i = 0; i < want.length; i++) if (want[i] !== have[i]) return false;
    return true;
  }

  // ------------------------------------------------------------------
  // Онлайн-переводчик: очередь, пакеты, паузы при ограничениях
  // ------------------------------------------------------------------

  var queue = [], queued = new Set(), waiting = new Map(), solo = new Set();
  var busy = false, pumpTimer = 0, pauseUntil = 0, failStreak = 0, lastError = '';
  var stats = { requests: 0, translated: 0 };

  function enqueue(key, target) {
    if (target) {
      var list = waiting.get(key);
      if (!list) { list = []; waiting.set(key, list); }
      if (list.length < 500) list.push(target);
    }
    if (queued.has(key)) return;
    queued.add(key);
    queue.push(key);
    schedulePump(0);
  }

  function schedulePump(delay) {
    if (pumpTimer) return;
    pumpTimer = setTimeout(pump, Math.max(delay || 0, pauseUntil - Date.now(), 0));
    showStatus();
  }

  function takeBatch() {
    var first = queue.shift(), batch = [first];
    if (first.indexOf('\n') >= 0 || solo.has(first)) return batch;
    var chars = first.length, rest = [];
    for (var i = 0; i < queue.length; i++) {
      var k = queue[i];
      if (batch.length < settings.maxBatchItems && k.indexOf('\n') < 0 && !solo.has(k) && chars + k.length + 1 <= settings.maxBatchChars) {
        batch.push(k);
        chars += k.length + 1;
      } else rest.push(k);
    }
    queue = rest;
    return batch;
  }

  function drop(key) {
    queued.delete(key);
    waiting.delete(key);
  }

  function pump() {
    pumpTimer = 0;
    if (busy || !queue.length || !settings.machineTranslation) { showStatus(); return; }
    if (Date.now() < pauseUntil) { schedulePump(0); return; }
    var batch = takeBatch();
    busy = true;
    showStatus();
    translateBatch(batch, function (err, out) {
      busy = false;
      if (err) {
        var st = err.status || 0;
        if (err.split || (st >= 400 && st < 500 && st !== 429 && st !== 403)) {
          if (batch.length > 1) {
            batch.forEach(function (k) { solo.add(k); });
            queue = batch.concat(queue);
          } else drop(batch[0]);
          schedulePump(settings.requestDelayMs);
          return;
        }
        queue = batch.concat(queue);
        failStreak++;
        var blocked = err.parse || st === 429 || st === 403 || st >= 300 && st < 400 || st === 503;
        var base = blocked ? settings.backoffBlockedMs : settings.backoffErrorMs;
        pauseUntil = Date.now() + Math.min(base * Math.pow(2, failStreak - 1), 600000);
        lastError = (blocked ? 'переводчик временно ограничил запросы' : 'нет связи с переводчиком') + ' (' + (st || err.message || 'ошибка') + ')';
        try { console.warn('[Русификатор] ' + lastError); } catch (e) { /* ignore */ }
        schedulePump(0);
        return;
      }
      failStreak = 0;
      lastError = '';
      for (var i = 0; i < batch.length; i++) accept(batch[i], out[i]);
      schedulePump(settings.requestDelayMs);
    });
  }

  function accept(key, raw) {
    queued.delete(key);
    var tr = postProcess(key, raw == null ? '' : raw);
    var targets = waiting.get(key) || [];
    waiting.delete(key);
    if (/\{\d+\}/.test(key) && !placeholdersOk(key, tr)) {
      badTpl.add(key); // переводчик испортил {0} — дальше переводим строки целиком
    } else {
      cache.set(key, tr || key);
      dirtyCache = true;
      markDirty();
      stats.translated++;
    }
    for (var i = 0; i < targets.length; i++) retarget(targets[i]);
  }

  function retarget(t) {
    if (t.a) processAttr(t.n, t.a);
    else processText(t.n);
  }

  function translateBatch(keys, cb) {
    var text = keys.join('\n');
    var url = String(settings.endpoint)
      .replace('{sl}', encodeURIComponent(settings.sourceLang))
      .replace('{tl}', encodeURIComponent(settings.targetLang))
      .replace('{q}', encodeURIComponent(text));
    stats.requests++;
    httpGet(url, function (err, body) {
      if (err) return cb(err);
      var out;
      try { out = parseGoogle(body); } catch (e) { return cb({ parse: true, message: 'ответ не распознан' }); }
      if (keys.length === 1) return cb(null, [out]);
      var lines = out.split('\n');
      if (lines.length !== keys.length) return cb({ split: true });
      cb(null, lines);
    });
  }

  function parseGoogle(body) {
    var j = JSON.parse(body);
    if (!Array.isArray(j) || !Array.isArray(j[0])) throw new Error('format');
    var out = '';
    for (var i = 0; i < j[0].length; i++) {
      var seg = j[0][i];
      if (seg && typeof seg[0] === 'string') out += seg[0];
    }
    return out;
  }

  var UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

  function httpGet(url, cb) {
    var done = false;
    function fin(err, body) { if (!done) { done = true; cb(err, body); } }
    var mod = req(/^https:/i.test(url) ? 'https' : 'http');
    if (mod) {
      try {
        var r = mod.get(url, { headers: { 'User-Agent': UA, 'Accept': '*/*' } }, function (res) {
          var body = '';
          res.setEncoding('utf8');
          res.on('data', function (c) { body += c; });
          res.on('end', function () {
            if (res.statusCode !== 200) fin({ status: res.statusCode });
            else fin(null, body);
          });
          res.on('error', function (e) { fin({ status: 0, message: e.message }); });
        });
        r.on('error', function (e) { fin({ status: 0, message: e.message }); });
        r.setTimeout(20000, function () {
          if (r.destroy) r.destroy(); else r.abort();
          fin({ status: 0, message: 'timeout' });
        });
      } catch (e) { fin({ status: 0, message: e.message }); }
      return;
    }
    if (typeof W.fetch !== 'function') { fin({ status: 0, message: 'no http' }); return; }
    W.fetch(url).then(function (res) {
      return res.text().then(function (t) { if (res.ok) fin(null, t); else fin({ status: res.status }); });
    }).catch(function (e) { fin({ status: 0, message: String(e && e.message || e) }); });
  }

  // ------------------------------------------------------------------
  // DOM: исходные (нативные) свойства
  // ------------------------------------------------------------------

  function findDesc(proto, name) {
    for (var p = proto; p; p = Object.getPrototypeOf(p)) {
      var d = Object.getOwnPropertyDescriptor(p, name);
      if (d) return { d: d, owner: p, name: name };
    }
    return null;
  }

  function proto(ctor) { return ctor ? ctor.prototype : null; }

  var D = {
    data: findDesc(proto(W.CharacterData), 'data'),
    nodeValue: findDesc(proto(W.Node), 'nodeValue'),
    textContent: findDesc(proto(W.Node), 'textContent'),
    innerText: findDesc(proto(W.HTMLElement), 'innerText'),
    innerHTML: findDesc(proto(W.Element), 'innerHTML'),
    outerHTML: findDesc(proto(W.Element), 'outerHTML'),
    value: findDesc(proto(W.HTMLInputElement), 'value'),
    optionText: findDesc(proto(W.HTMLOptionElement), 'text'),
    title: findDesc(proto(W.HTMLElement), 'title'),
    phInput: findDesc(proto(W.HTMLInputElement), 'placeholder'),
    phArea: findDesc(proto(W.HTMLTextAreaElement), 'placeholder'),
    alt: findDesc(proto(W.HTMLImageElement), 'alt')
  };

  var EP = Element.prototype;
  var getAttr = EP.getAttribute, setAttr = EP.setAttribute, hasAttr = EP.hasAttribute;
  var dataGet = D.data.d.get, dataSet = D.data.d.set;
  var textSet = D.textContent.d.set;

  var SHOW_TEXT = 4, SHOW_EL_TEXT = 1 | 4;
  var ATTRS = ['title', 'placeholder', 'alt', 'aria-label', 'value'];
  var SKIP = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, TEXTAREA: 1, TEMPLATE: 1, CODE: 1, script: 1, style: 1 };

  var textRec = new WeakMap(); // Text -> { o: оригинал, t: перевод, oc, tc: без крайних пробелов }
  var attrRec = new WeakMap(); // Element -> { имя: { o, t } }
  var liveCount = 0;

  function walker(root, what) {
    return (root.ownerDocument || root).createTreeWalker(root, what, null, false);
  }

  function isButtonInput(el) {
    return el.tagName === 'INPUT' && /^(button|submit|reset)$/i.test(getAttr.call(el, 'type') || '');
  }

  // Элемент сам по себе запрещён для перевода (без учёта предков).
  function selfExcluded(e) {
    if (SKIP[e.tagName] === 1) return true;
    var ce = getAttr.call(e, 'contenteditable');
    if (ce !== null && ce !== 'false') return true;
    if (!excludeSel || !e.matches) return false;
    try { return e.matches(excludeSel); } catch (x) { return false; }
  }

  function isExcluded(el) {
    for (var e = el; e && e.nodeType === 1; e = e.parentNode) if (selfExcluded(e)) return true;
    return false;
  }

  // ------------------------------------------------------------------
  // DOM: перевод узлов
  // ------------------------------------------------------------------

  // checked = true: вызывающий уже убедился, что предки не исключены.
  function processText(n, checked) {
    if (!on) return;
    var cur = dataGet.call(n), rec = textRec.get(n);
    if (rec) { if (cur === rec.t) return; textRec.delete(n); }
    var p = n.parentNode;
    if (!p || p.nodeType !== 1 || !RE_LAT.test(cur)) return;
    if (checked ? SKIP[p.tagName] === 1 : isExcluded(p)) return;
    var s = split3(cur);
    if (!s[1]) return;
    var tr = lookup(s[1]);
    if (tr === null) { request(s[1], { n: n }); return; }
    var out = s[0] + tr + s[2];
    if (out === cur) return;
    // <option> без value: игра читает select.value, а без атрибута это текст.
    if (p.tagName === 'OPTION' && !hasAttr.call(p, 'value')) setAttr.call(p, 'value', norm(cur));
    textRec.set(n, { o: cur, t: out, oc: s[1], tc: tr });
    liveCount++;
    dataSet.call(n, out);
  }

  function processAttr(el, name, checked) {
    if (!on || el.nodeType !== 1) return;
    if (name === 'type') name = 'value';
    if (ATTRS.indexOf(name) < 0) return;
    if (name === 'value' && !isButtonInput(el)) return;
    var raw = getAttr.call(el, name);
    var recs = attrRec.get(el), r = recs && recs[name];
    if (r) { if (raw === r.t) return; delete recs[name]; }
    if (raw === null || !RE_LAT.test(raw) || (!checked && isExcluded(el))) return;
    var s = split3(raw);
    if (!s[1]) return;
    var tr = lookup(s[1]);
    if (tr === null) { request(s[1], { n: el, a: name }); return; }
    var out = s[0] + tr + s[2];
    if (out === raw) return;
    if (!recs) { recs = {}; attrRec.set(el, recs); }
    recs[name] = { o: raw, t: out };
    liveCount++;
    setAttr.call(el, name, out);
  }

  function processElement(el) {
    if (!el.hasAttributes()) return;
    for (var i = 0; i < ATTRS.length; i++) if (hasAttr.call(el, ATTRS[i])) processAttr(el, ATTRS[i], true);
  }

  // Обход поддерева: исключённые ветки пропускаются целиком, а не проверяются
  // заново для каждой строки.
  function scanTree(root) {
    var n = root.firstChild;
    while (n) {
      var next = null;
      if (n.nodeType === 3) processText(n, true);
      else if (n.nodeType === 1 && !selfExcluded(n)) {
        processElement(n);
        next = n.firstChild;
      }
      if (!next) {
        while (n !== root && !n.nextSibling) n = n.parentNode;
        if (n === root) return;
        next = n.nextSibling;
      }
      n = next;
    }
  }

  function scan(root) {
    if (!on || !root) return;
    var t = root.nodeType;
    if (t === 3) { processText(root); return; }
    if (t !== 1 && t !== 9 && t !== 11) return;
    if (t === 1) {
      if (isExcluded(root)) return;
      processElement(root);
    }
    scanTree(root);
  }

  function onMutations(list) {
    if (!on) return;
    for (var i = 0; i < list.length; i++) {
      var m = list[i];
      if (m.type === 'childList') {
        for (var j = 0; j < m.addedNodes.length; j++) scan(m.addedNodes[j]);
      } else if (m.type === 'characterData') {
        if (m.target.nodeType === 3) processText(m.target);
      } else if (m.type === 'attributes') {
        processAttr(m.target, m.attributeName);
      }
    }
  }

  function restoreAll() {
    var w = walker(DOC, SHOW_EL_TEXT);
    for (var n = w.nextNode(); n; n = w.nextNode()) {
      if (n.nodeType === 3) {
        var r = textRec.get(n);
        if (r) { if (dataGet.call(n) === r.t) dataSet.call(n, r.o); textRec.delete(n); }
      } else {
        var ar = attrRec.get(n);
        if (ar) {
          for (var k in ar) if (getAttr.call(n, k) === ar[k].t) setAttr.call(n, k, ar[k].o);
          attrRec.delete(n);
        }
      }
    }
    liveCount = 0;
  }

  // ------------------------------------------------------------------
  // Игра видит оригинал: перехват чтения текста из DOM
  // ------------------------------------------------------------------

  function origText(n) {
    var raw = dataGet.call(n), r = textRec.get(n);
    return r && raw === r.t ? r.o : raw;
  }

  function hasTranslated(root) {
    if (!liveCount) return false;
    var w = walker(root, SHOW_EL_TEXT), n = root;
    do {
      if (n.nodeType === 3) {
        var r = textRec.get(n);
        if (r && dataGet.call(n) === r.t) return true;
      } else if (n.nodeType === 1) {
        var ar = attrRec.get(n);
        if (ar) for (var k in ar) if (getAttr.call(n, k) === ar[k].t) return true;
      }
      n = w.nextNode();
    } while (n);
    return false;
  }

  function joinOriginals(root) {
    var out = '', w = walker(root, SHOW_TEXT);
    for (var n = w.nextNode(); n; n = w.nextNode()) out += origText(n);
    return out;
  }

  function restoreOne(a, b) {
    if (a.nodeType === 3) {
      var r = textRec.get(a);
      if (r && dataGet.call(a) === r.t) dataSet.call(b, r.o);
    } else if (a.nodeType === 1) {
      var ar = attrRec.get(a);
      if (ar) for (var k in ar) if (getAttr.call(a, k) === ar[k].t) setAttr.call(b, k, ar[k].o);
    }
  }

  // Копия поддерева с оригинальным текстом — для innerHTML/outerHTML.
  function originalClone(el) {
    var c = el.cloneNode(true);
    restoreOne(el, c);
    var ws = walker(el, SHOW_EL_TEXT), wd = walker(c, SHOW_EL_TEXT);
    for (var a = ws.nextNode(), b = wd.nextNode(); a && b; a = ws.nextNode(), b = wd.nextNode()) restoreOne(a, b);
    return c;
  }

  // innerText учитывает вёрстку, поэтому меняем переведённые куски обратно по порядку.
  function unswapInnerText(root, raw) {
    var out = '', pos = 0, w = walker(root, SHOW_TEXT);
    for (var n = w.nextNode(); n; n = w.nextNode()) {
      var r = textRec.get(n);
      if (!r || dataGet.call(n) !== r.t) continue;
      var i = raw.indexOf(r.tc, pos);
      if (i < 0) continue;
      out += raw.slice(pos, i) + r.oc;
      pos = i + r.tc.length;
    }
    return out + raw.slice(pos);
  }

  function attrGetter(name) {
    return function (nat) {
      var raw = nat.call(this), r = attrRec.get(this), a = r && r[name];
      return a && raw === a.t ? a.o : raw;
    };
  }

  function hookGetter(entry, getter) {
    if (!entry || !entry.d.get || !entry.d.configurable) return;
    var nat = entry.d.get;
    Object.defineProperty(entry.owner, entry.name, {
      configurable: true,
      enumerable: entry.d.enumerable,
      get: function () { return getter.call(this, nat); },
      set: entry.d.set
    });
  }

  function installReadHooks() {
    function charData(nat) {
      var raw = nat.call(this);
      if (this.nodeType === 3) { var r = textRec.get(this); if (r && raw === r.t) return r.o; }
      return raw;
    }
    hookGetter(D.data, charData);
    hookGetter(D.nodeValue, charData);
    hookGetter(D.textContent, function (nat) {
      var t = this.nodeType;
      if (t === 3) return charData.call(this, nat);
      if ((t === 1 || t === 11) && hasTranslated(this)) return joinOriginals(this);
      return nat.call(this);
    });
    hookGetter(D.innerText, function (nat) {
      var raw = nat.call(this);
      return hasTranslated(this) ? unswapInnerText(this, raw) : raw;
    });
    hookGetter(D.innerHTML, function (nat) {
      return hasTranslated(this) ? nat.call(originalClone(this)) : nat.call(this);
    });
    hookGetter(D.outerHTML, function (nat) {
      return hasTranslated(this) ? nat.call(originalClone(this)) : nat.call(this);
    });
    hookGetter(D.optionText, function (nat) {
      if (!hasTranslated(this)) return nat.call(this);
      return joinOriginals(this).replace(/[\t\n\f\r ]+/g, ' ').trim();
    });
    hookGetter(D.value, attrGetter('value'));
    hookGetter(D.title, attrGetter('title'));
    hookGetter(D.phInput, attrGetter('placeholder'));
    hookGetter(D.phArea, attrGetter('placeholder'));
    hookGetter(D.alt, attrGetter('alt'));

    EP.getAttribute = function getAttribute(name) {
      var raw = getAttr.call(this, name);
      if (raw !== null) {
        var r = attrRec.get(this), a = r && r[String(name).toLowerCase()];
        if (a && raw === a.t) return a.o;
      }
      return raw;
    };
  }

  // ------------------------------------------------------------------
  // alert/confirm/prompt и текст на canvas (графики)
  // ------------------------------------------------------------------

  function installOutputHooks() {
    ['alert', 'confirm', 'prompt'].forEach(function (name) {
      var orig = W[name];
      if (typeof orig !== 'function') return;
      W[name] = function () {
        var args = Array.prototype.slice.call(arguments);
        if (settings.translateDialogs && typeof args[0] === 'string') args[0] = translateString(args[0]);
        return orig.apply(W, args);
      };
    });

    var C2D = W.CanvasRenderingContext2D && W.CanvasRenderingContext2D.prototype;
    if (!C2D) return;
    ['fillText', 'strokeText', 'measureText'].forEach(function (name) {
      var orig = C2D[name];
      if (typeof orig !== 'function') return;
      C2D[name] = function (text) {
        if (on && settings.translateCanvas && typeof text === 'string' && RE_LAT2.test(text)) {
          var args = Array.prototype.slice.call(arguments);
          args[0] = translateString(text);
          return orig.apply(this, args);
        }
        return orig.apply(this, arguments);
      };
    });
  }

  // ------------------------------------------------------------------
  // Строка состояния и горячие клавиши
  // ------------------------------------------------------------------

  var statusEl = null, statusTimer = 0, flash = '', flashUntil = 0;

  function note(msg, ms) {
    flash = msg;
    flashUntil = Date.now() + (ms || 5000);
    showStatus();
  }

  function problem(msg) {
    try { console.warn('[Русификатор] ' + msg); } catch (e) { /* ignore */ }
    note('Русификатор: ' + msg, 8000);
  }

  function showStatus() {
    if (!DOC.body) return;
    var active = busy || queue.length > 0, now = Date.now(), text = '';
    if (now < flashUntil) text = flash;
    else if (active && settings.showStatus) {
      text = 'Русификатор: перевожу новые строки… в очереди ' + queue.length;
      if (pauseUntil > now) text += ' · пауза ' + Math.ceil((pauseUntil - now) / 1000) + ' с: ' + lastError;
    }
    if (statusTimer) { clearTimeout(statusTimer); statusTimer = 0; }
    if (!text) { if (statusEl) statusEl.style.display = 'none'; return; }
    if (!statusEl) {
      statusEl = DOC.createElement('div');
      statusEl.id = 'tppRuStatus';
      setAttr.call(statusEl, 'translate', 'no');
      statusEl.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:2147483647;max-width:70%;' +
        'padding:4px 10px;border-radius:4px;background:rgba(20,20,20,.85);color:#fff;' +
        'font:12px/1.5 "Segoe UI",Arial,sans-serif;pointer-events:none;white-space:pre-wrap';
    }
    if (!statusEl.parentNode) DOC.body.appendChild(statusEl);
    textSet.call(statusEl, text);
    statusEl.style.display = 'block';
    statusTimer = setTimeout(showStatus, now < flashUntil ? Math.min(flashUntil - now, 1000) + 20 : 1000);
  }

  function statsText() {
    return 'Русификатор ' + VERSION + (on ? ' включён' : ' выключен') +
      '\nсловарь: ' + dict.size + ' · кэш: ' + cache.size + ' · в очереди: ' + queue.length +
      ' · запросов: ' + stats.requests + (lastError ? '\n' + lastError : '') +
      '\n' + settings.hotkeyToggle + ' — вкл/выкл · Shift+' + settings.hotkeyToggle + ' — перечитать словарь';
  }

  function setEnabled(v) {
    v = !!v;
    if (v === on) return;
    if (!v) {
      on = false;
      restoreAll();
      if (mo) mo.takeRecords();
      note('Русификатор выключен (' + settings.hotkeyToggle + ' — включить)', 3000);
    } else {
      on = true;
      scan(DOC);
      note('Русификатор включён', 2000);
    }
  }

  function reload() {
    var was = on;
    on = false;
    restoreAll();
    if (mo) mo.takeRecords();
    loadConfig();
    badTpl.clear();
    on = was;
    scan(DOC);
    note('Русификатор: словарь перечитан (' + dict.size + ' строк)', 3000);
  }

  function onKey(e) {
    var k = e.key;
    if (k === settings.hotkeyToggle) {
      if (e.shiftKey) reload(); else setEnabled(!on);
    } else if (k === settings.hotkeyStatus) {
      note(statsText(), 8000);
    } else return;
    e.preventDefault();
    e.stopPropagation();
  }

  // ------------------------------------------------------------------
  // Запуск
  // ------------------------------------------------------------------

  var mo = null;

  loadConfig();
  loadCache();
  on = settings.enabled !== false;

  if (settings.gameSeesOriginal) installReadHooks();
  installOutputHooks();

  mo = new MutationObserver(onMutations);
  mo.observe(DOC, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ATTRS.concat(['type'])
  });

  scan(DOC);
  if (DOC.readyState === 'loading') {
    DOC.addEventListener('DOMContentLoaded', function () {
      if (!styleEl || !styleEl.parentNode) applyCss();
      scan(DOC);
      showStatus();
    });
  }

  W.addEventListener('keydown', onKey, true);
  W.addEventListener('beforeunload', saveAll);
  W.addEventListener('pagehide', saveAll);

  W.__TPP_RU__ = {
    version: VERSION,
    enable: function () { setEnabled(true); },
    disable: function () { setEnabled(false); },
    toggle: function () { setEnabled(!on); },
    reload: reload,
    save: saveAll,
    translate: function (s) { return translateString(String(s), true); },
    stats: function () {
      return {
        enabled: on, dictionary: dict.size, cache: cache.size, queue: queue.length,
        requests: stats.requests, translated: stats.translated, lastError: lastError,
        base: BASE, mode: fs ? 'nwjs' : 'browser'
      };
    }
  };
})();
