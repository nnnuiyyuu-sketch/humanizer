/* Карта регионов: заливка по текущему раскладу, клик — детали региона. */
(function (root) {
  'use strict';

  var PP = root.PP;
  var clamp = PP.clamp;

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c];
    });
  }
  function color(pid) { var p = PP.PARTY_BY_ID[pid]; return p ? p.color : '#8d8d8d'; }
  function abbr(pid) { var p = PP.PARTY_BY_ID[pid]; return p ? p.abbr : pid; }
  function pname(pid) { var p = PP.PARTY_BY_ID[pid]; return p ? p.ru : pid; }

  var MODES = [
    { id: 'leader', label: 'Кто ведёт' },
    { id: 'mine', label: 'Ваша доля' },
    { id: 'swing', label: 'Изменение к старту' }
  ];

  function hexToRgb(hex) {
    var h = hex.replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  function mix(hex, t) {
    var c = hexToRgb(hex);
    var bg = [22, 30, 42];
    return 'rgb(' + c.map(function (v, i) { return Math.round(bg[i] + (v - bg[i]) * t); }).join(',') + ')';
  }

  /* Цвет и подпись региона в выбранном режиме. */
  function regionPaint(state, region, shares, mode) {
    var sh = shares[region.id];
    if (!sh) return { fill: '#2a3646', text: '', title: 'Северная Ирландия: отдельная партийная система' };
    var order = Object.keys(sh).sort(function (a, b) { return sh[b] - sh[a]; });
    var lead = order[0], second = order[1];
    if (mode === 'mine') {
      var mine = sh[state.playerId];
      if (mine === undefined) return { fill: '#2a3646', text: '—', title: region.name + ': вы здесь не выдвигаетесь' };
      return {
        fill: mix(color(state.playerId), clamp(mine / 45, 0.12, 1)),
        text: mine.toFixed(0) + '%',
        title: region.name + ': ваша доля ' + mine.toFixed(1) + '%'
      };
    }
    if (mode === 'swing') {
      var base = (state.bases && state.bases[region.id]) || region.base;
      var mineNow = sh[state.playerId], mineWas = base[state.playerId];
      if (mineNow === undefined) return { fill: '#2a3646', text: '—', title: region.name };
      var d = mineNow - mineWas;
      return {
        fill: mix(d >= 0 ? '#3fb950' : '#f85149', clamp(Math.abs(d) / 8, 0.12, 1)),
        text: (d >= 0 ? '+' : '') + d.toFixed(1),
        title: region.name + ': ' + (d >= 0 ? '+' : '') + d.toFixed(1) + ' п.п. к старту'
      };
    }
    return {
      fill: mix(color(lead), clamp(0.35 + (sh[lead] - sh[second]) / 30, 0.35, 1)),
      text: abbr(lead),
      title: region.name + ': ' + pname(lead) + ' ' + sh[lead].toFixed(1) + '% (отрыв ' + (sh[lead] - sh[second]).toFixed(1) + ')'
    };
  }

  function render(state, shares, opts) {
    opts = opts || {};
    var mode = opts.mode || 'leader';
    var selected = opts.selected;

    var shapes = Object.keys(PP.MAP_SHAPES).map(function (rid) {
      var region = PP.REGION_BY_ID[rid];
      var shape = PP.MAP_SHAPES[rid];
      var paint = regionPaint(state, region, shares, mode);
      var cls = 'map-region' + (selected === rid ? ' selected' : '') + (region.ni ? ' inactive' : '');
      return '<g class="' + cls + '" data-region="' + rid + '">' +
        '<polygon points="' + shape.points + '" fill="' + paint.fill + '">' +
        '<title>' + esc(paint.title) + ' · ' + region.seats + ' мест</title></polygon>' +
        '<text class="map-label" x="' + shape.label[0] + '" y="' + shape.label[1] + '">' + esc(paint.text) + '</text>' +
        '<text class="map-seats" x="' + shape.label[0] + '" y="' + (shape.label[1] + 12) + '">' + region.seats + '</text>' +
        '</g>';
    }).join('');

    var islands = PP.MAP_ISLANDS.map(function (i) {
      return '<circle cx="' + i.cx + '" cy="' + i.cy + '" r="' + i.r + '" fill="#33415a"/>';
    }).join('');

    var modes = MODES.map(function (m) {
      return '<button class="chip' + (mode === m.id ? ' active' : '') + '" data-mapmode="' + m.id + '">' + m.label + '</button>';
    }).join('');

    var legend = '';
    if (mode === 'leader') {
      var nat = PP.nationalShares(state, shares);
      legend = Object.keys(nat).filter(function (p) { return nat[p] >= 2; })
        .sort(function (a, b) { return nat[b] - nat[a]; })
        .map(function (pid) {
          return '<span class="ch-leg"><i style="background:' + color(pid) + '"></i>' + abbr(pid) + '</span>';
        }).join('');
    } else if (mode === 'swing') {
      legend = '<span class="ch-leg"><i style="background:#3fb950"></i>рост</span>' +
        '<span class="ch-leg"><i style="background:#f85149"></i>падение</span>';
    } else {
      legend = '<span class="ch-leg"><i style="background:' + color(state.playerId) + '"></i>чем ярче, тем выше ваша доля</span>';
    }

    var rows = PP.CAMPAIGN_REGIONS.map(function (r) {
      var sh = shares[r.id];
      var order = Object.keys(sh).sort(function (a, b) { return sh[b] - sh[a]; });
      var mine = sh[state.playerId];
      return '<tr class="map-row' + (selected === r.id ? ' mine-row' : '') + '" data-region="' + r.id + '">' +
        '<td>' + esc(r.name) + '</td>' +
        '<td><span class="pill" style="background:' + color(order[0]) + '">' + abbr(order[0]) + '</span></td>' +
        '<td class="num">' + (mine === undefined ? '—' : mine.toFixed(1)) + '</td>' +
        '<td class="num">' + r.seats + '</td></tr>';
    }).join('');
    var ni = PP.REGION_BY_ID.n_ireland;

    return '<div class="map-layout">' +
      '<div class="map-wrap">' +
      '<div class="chips map-modes">' + modes + '</div>' +
      '<svg class="uk-map" viewBox="0 0 440 500" preserveAspectRatio="xMidYMid meet">' +
      '<rect class="map-sea" x="0" y="0" width="440" height="500" rx="10"/>' +
      '<polygon class="map-outside" points="' + PP.MAP_IRELAND + '"><title>Ирландия — за пределами выборов</title></polygon>' +
      islands + shapes +
      '<line x1="340" y1="366" x2="386" y2="348" class="map-leader-line"/>' +
      '<text class="map-callout" x="390" y="346">Лондон · ' + PP.REGION_BY_ID.london.seats + '</text>' +
      '<line x1="78" y1="180" x2="66" y2="150" class="map-leader-line"/>' +
      '<text class="map-callout" x="66" y="144" text-anchor="middle">Сев. Ирландия · ' + ni.seats + '</text>' +
      '</svg>' +
      '<div class="ch-legend">' + legend + '</div>' +
      '</div>' +
      '<div class="map-side"><table class="map-table"><thead><tr>' +
      '<th>Регион</th><th>Ведёт</th><th class="num">Вы</th><th class="num">Мест</th>' +
      '</tr></thead><tbody>' + rows + '</tbody></table></div>' +
      '</div>';
  }

  PP.Map = { render: render, MODES: MODES };
})(typeof globalThis !== 'undefined' ? globalThis : this);
