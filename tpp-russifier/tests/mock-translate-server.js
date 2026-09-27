// Фейковый онлайн-переводчик в формате translate.googleapis.com/translate_a/single (client=gtx).
'use strict';
const http = require('http');

const KNOWN = {
  'Your approval rating has increased.': 'Ваш рейтинг одобрения вырос.',
  'Senator Smith proposed a new bill.': 'Сенатор Смит предложил новый законопроект.',
  'The House of Representatives passed the budget.': 'Дом представителей принял бюджет.'
};

function translateLine(line) {
  if (KNOWN[line]) return KNOWN[line];
  if (/BREAK/.test(line)) return 'ПЕРЕВОД:' + line.replace(/\{\d+\}/g, '');
  return 'ПЕРЕВОД:' + line;
}

function start(opts) {
  opts = opts || {};
  const state = { requests: 0, items: 0, failNext: 0, failStatus: 429, log: [] };
  const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    if (u.pathname !== '/translate_a/single') { res.writeHead(404); return res.end(); }
    state.requests++;
    if (state.failNext > 0) {
      state.failNext--;
      res.writeHead(state.failStatus, { 'Content-Type': 'text/html', 'Access-Control-Allow-Origin': '*' });
      return res.end('<html>Sorry...</html>');
    }
    const q = u.searchParams.get('q') || '';
    const lines = q.split('\n');
    state.items += lines.length;
    state.log.push(lines);
    const segs = [];
    lines.forEach((line, i) => {
      const nl = i < lines.length - 1 ? '\n' : '';
      const tr = translateLine(line);
      // как у Google: длинные строки режутся на несколько сегментов
      const cut = tr.length > 24 ? tr.indexOf(' ', 12) : -1;
      if (cut > 0) {
        segs.push([tr.slice(0, cut + 1), line, null, null, 3]);
        segs.push([tr.slice(cut + 1) + nl, line + nl, null, null, 3]);
      } else segs.push([tr + nl, line + nl, null, null, 3]);
    });
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify([segs, null, 'en', null, null, null, 1, [], [['en'], null, [1], ['en']]]));
  });
  return new Promise(resolve => server.listen(opts.port || 0, '127.0.0.1', () => {
    const port = server.address().port;
    resolve({
      state,
      endpoint: 'http://127.0.0.1:' + port + '/translate_a/single?client=gtx&dt=t&sl={sl}&tl={tl}&q={q}',
      close: () => new Promise(r => server.close(r))
    });
  }));
}

module.exports = { start };
