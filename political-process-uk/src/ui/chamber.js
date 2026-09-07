/*
 * Диаграмма Палаты общин: 650 мандатов точками, правительственные скамьи
 * напротив оппозиционных, спикер и неголосующие депутаты отдельно.
 * Плюс собственная эмблема игры в духе решётки Вестминстера.
 */
(function (root) {
  'use strict';

  var PP = root.PP;

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c];
    });
  }
  function color(pid) { var p = PP.PARTY_BY_ID[pid]; return p ? p.color : '#8d8d8d'; }
  function pname(pid) { var p = PP.PARTY_BY_ID[pid]; return p ? p.ru : pid; }
  function abbr(pid) { var p = PP.PARTY_BY_ID[pid]; return p ? p.abbr : pid; }

  /* Раскладка блока скамей: точки строками, слева направо, снизу вверх. */
  function bench(order, counts, opts) {
    var total = 0;
    order.forEach(function (pid) { total += counts[pid] || 0; });
    if (!total) return { dots: [], width: 0, height: 0 };
    var rows = opts.rows || 8;
    var step = opts.step || 15;
    var perRow = Math.ceil(total / rows);
    var maxPerRow = Math.floor((opts.maxWidth || 900) / step);
    if (perRow > maxPerRow) { perRow = maxPerRow; rows = Math.ceil(total / perRow); }

    var dots = [];
    var i = 0;
    order.forEach(function (pid) {
      var n = counts[pid] || 0;
      for (var k = 0; k < n; k++, i++) {
        var col = Math.floor(i / rows);
        var row = i % rows;
        dots.push({
          x: opts.x + col * step,
          y: opts.up ? (opts.y - row * step) : (opts.y + row * step),
          party: pid
        });
      }
    });
    return { dots: dots, width: Math.ceil(total / rows) * step, height: rows * step, rows: rows };
  }

  /*
   * seats — {pid: количество}. opts.government — какие партии сидят на
   * правительственных скамьях; opts.playerId подсвечивается ободком.
   */
  function chamberSVG(seats, opts) {
    opts = opts || {};
    var gov = opts.government || [];
    var abstain = {};
    PP.NI_PARTIES.forEach(function (p) { if (p.abstains) abstain[p.id] = seats[p.id] || 0; });

    var govCounts = {}, oppCounts = {};
    Object.keys(seats).forEach(function (pid) {
      if (abstain[pid]) return;
      if (gov.indexOf(pid) >= 0) govCounts[pid] = seats[pid];
      else oppCounts[pid] = seats[pid];
    });
    var govOrder = Object.keys(govCounts).sort(function (a, b) { return govCounts[b] - govCounts[a]; });
    var oppOrder = Object.keys(oppCounts).sort(function (a, b) { return oppCounts[b] - oppCounts[a]; });

    var step = 15, r = 5.6;
    var topBlock = bench(oppOrder, oppCounts, { x: 46, y: 26, rows: 8, step: step, maxWidth: 860, up: false });
    var botBlock = bench(govOrder, govCounts, { x: 46, y: 202, rows: 8, step: step, maxWidth: 860, up: false });

    function dotsToSvg(block) {
      return block.dots.map(function (d) {
        var stroke = (opts.playerId && d.party === opts.playerId)
          ? ' stroke="#f5e6b8" stroke-width="1.4"' : '';
        return '<circle cx="' + d.x.toFixed(1) + '" cy="' + d.y.toFixed(1) + '" r="' + r + '" fill="' +
          color(d.party) + '"' + stroke + '><title>' + esc(pname(d.party)) + '</title></circle>';
      }).join('');
    }

    /* Спикер и неголосующие. */
    var extras = '<circle cx="24" cy="166" r="' + r + '" fill="#20262e" stroke="#6d7c8e" stroke-width="1.4"><title>Спикер — голосует только при равенстве</title></circle>' +
      '<text x="24" y="150" class="ch-note" text-anchor="middle">спикер</text>';
    var abstainTotal = 0;
    Object.keys(abstain).forEach(function (pid) { abstainTotal += abstain[pid]; });
    if (abstainTotal) {
      var ax = 944, ay = 212;
      var i = 0;
      Object.keys(abstain).forEach(function (pid) {
        for (var k = 0; k < abstain[pid]; k++, i++) {
          extras += '<circle cx="' + (ax + (i % 2) * 15) + '" cy="' + (ay + Math.floor(i / 2) * 15) + '" r="' + r +
            '" fill="' + color(pid) + '" opacity=".75"><title>' + esc(pname(pid)) + ' — не занимают мест</title></circle>';
        }
      });
      extras += '<text x="' + (ax + 8) + '" y="' + (ay - 14) + '" class="ch-note" text-anchor="middle">не заседают</text>';
    }

    var maj = opts.majority;
    var majLine = '';
    if (maj) {
      majLine = '<line x1="44" y1="166" x2="900" y2="166" stroke="rgba(212,175,55,.5)" stroke-dasharray="6 6"/>' +
        '<text x="900" y="160" class="ch-note" text-anchor="end">порог большинства — ' + maj + '</text>';
    }

    return '<svg class="chamber" viewBox="0 0 1000 330" preserveAspectRatio="xMidYMid meet">' +
      '<text x="46" y="16" class="ch-label">Оппозиционные скамьи</text>' +
      dotsToSvg(topBlock) + majLine +
      '<text x="46" y="192" class="ch-label">Правительственные скамьи</text>' +
      dotsToSvg(botBlock) + extras +
      '</svg>';
  }

  /* Легенда под диаграммой. */
  function chamberLegend(seats, opts) {
    opts = opts || {};
    var order = Object.keys(seats).sort(function (a, b) { return seats[b] - seats[a]; });
    return '<div class="ch-legend">' + order.map(function (pid) {
      var delta = opts.baseline ? seats[pid] - (opts.baseline[pid] || 0) : null;
      return '<span class="ch-leg' + (pid === opts.playerId ? ' mine' : '') + '">' +
        '<i style="background:' + color(pid) + '"></i>' + esc(abbr(pid)) + ' ' + seats[pid] +
        (delta !== null ? '<b class="' + (delta >= 0 ? 'up' : 'down') + '">' + (delta >= 0 ? '+' : '') + delta + '</b>' : '') +
        '</span>';
    }).join('') + '</div>';
  }

  /* Собственная эмблема игры: решётка в духе вестминстерской, без короны. */
  function portcullis(size, tone) {
    var c = tone || 'currentColor';
    var bars = '';
    for (var i = 0; i < 5; i++) bars += '<rect x="' + (14 + i * 14) + '" y="26" width="6" height="52" fill="' + c + '"/>';
    for (var j = 0; j < 4; j++) bars += '<rect x="10" y="' + (30 + j * 14) + '" width="80" height="5" fill="' + c + '"/>';
    var spikes = '';
    for (var k = 0; k < 5; k++) spikes += '<polygon points="' + (14 + k * 14) + ',78 ' + (20 + k * 14) + ',78 ' + (17 + k * 14) + ',90" fill="' + c + '"/>';
    return '<svg class="emblem" width="' + size + '" height="' + size + '" viewBox="0 0 100 100" aria-hidden="true">' +
      '<rect x="8" y="18" width="84" height="8" rx="2" fill="' + c + '"/>' +
      '<circle cx="14" cy="16" r="5" fill="none" stroke="' + c + '" stroke-width="3"/>' +
      '<circle cx="86" cy="16" r="5" fill="none" stroke="' + c + '" stroke-width="3"/>' +
      '<path d="M14 11 q0 -9 12 -9" fill="none" stroke="' + c + '" stroke-width="3"/>' +
      '<path d="M86 11 q0 -9 -12 -9" fill="none" stroke="' + c + '" stroke-width="3"/>' +
      bars + spikes + '</svg>';
  }

  PP.Chamber = {
    svg: chamberSVG,
    legend: chamberLegend,
    portcullis: portcullis
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
