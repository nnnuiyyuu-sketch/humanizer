/* Интерфейс: экраны, вкладки, модальные окна, ночь выборов. */
(function (root) {
  'use strict';

  var PP = root.PP;
  var doc = root.document;
  var app = { screen: 'title', tab: 'actions', region: null, state: null, night: null, setup: { party: 'lab', difficulty: 'normal', weeks: 12 } };

  function $(sel) { return doc.querySelector(sel); }
  function el(id) { return doc.getElementById(id); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }
  function color(pid) { var p = PP.PARTY_BY_ID[pid]; return p ? p.color : '#777'; }
  function pname(pid) { var p = PP.PARTY_BY_ID[pid]; return p ? p.ru : pid; }
  function abbr(pid) { var p = PP.PARTY_BY_ID[pid]; return p ? p.abbr : pid; }
  function money(v) { return '£' + v.toFixed(2) + ' млн'; }
  function pct(v) { return v.toFixed(1) + '%'; }

  function sortedShares(shares, min) {
    return Object.keys(shares)
      .filter(function (p) { return shares[p] >= (min === undefined ? 0.8 : min); })
      .sort(function (a, b) { return shares[b] - shares[a]; });
  }

  /* ================= Титульный экран ================= */

  function renderTitle() {
    var s = app.setup;
    var cards = PP.PARTIES.filter(function (p) { return p.playable; }).map(function (p) {
      return '<div class="party-card' + (s.party === p.id ? ' selected' : '') + '" style="--pc:' + p.color + '" data-party="' + p.id + '">' +
        '<div class="pname" style="color:' + p.color + '">' + esc(p.name) + '</div>' +
        '<div class="pru">' + esc(p.ru) + (p.scope !== 'gb' ? ' · только ' + (p.scope === 'scotland' ? 'Шотландия' : 'Уэльс') : '') + '</div>' +
        '<div class="pblurb">' + esc(p.blurb) + '</div>' +
        '<div class="pstats">Касса ' + money(p.funds) + ' · актив ' + p.activists + ' · единство ' + p.unity +
        '<br>Лидер: ' + esc(p.leader.name) + ' (харизма ' + p.leader.charisma + ', компетентность ' + p.leader.competence + ')' +
        '<br>Цель кампании: ' + p.target + '+ мандатов</div>' +
        '</div>';
    }).join('');

    var diffOpts = Object.keys(PP.DIFFICULTY).map(function (k) {
      return '<option value="' + k + '"' + (s.difficulty === k ? ' selected' : '') + '>' + PP.DIFFICULTY[k].label + '</option>';
    }).join('');

    return '<div class="title-screen">' +
      '<div class="crest">🏛️</div>' +
      '<h1>The Political Process: Britain</h1>' +
      '<div class="sub">Бета 1.0 · всеобщие выборы в Соединённом Королевстве · 650 округов, мажоритарная система</div>' +
      (PP.hasSave() ? '<div class="setup-row"><button class="primary" id="btn-continue">Продолжить сохранённую кампанию</button></div>' : '') +
      '<h2>Выберите партию</h2>' +
      '<div class="party-grid">' + cards + '</div>' +
      '<div class="setup-row">' +
      '<label>Сложность <select id="sel-diff">' + diffOpts + '</select></label>' +
      '<label>Длина кампании <select id="sel-weeks">' +
      [6, 9, 12, 16].map(function (w) { return '<option value="' + w + '"' + (s.weeks === w ? ' selected' : '') + '>' + w + ' недель</option>'; }).join('') +
      '</select></label>' +
      '<label>Зерно генерации <input type="text" id="inp-seed" value="' + esc(s.seed || '') + '" placeholder="случайное" size="12"></label>' +
      '</div>' +
      '<div class="setup-row"><button class="primary" id="btn-start">Начать кампанию</button></div>' +
      '<div class="footer-note">Сценарий вымышленный. Партии, регионы и система выборов узнаваемы, но лидеры, округа и стартовые цифры придуманы для игры.</div>' +
      '</div>';
  }

  /* ================= Кампания ================= */

  function currentShares() {
    var st = app.state;
    if (!st._cacheRegionShares) st._cacheRegionShares = PP.allRegionShares(st);
    return st._cacheRegionShares;
  }

  function renderTopbar() {
    var st = app.state, ps = st.parties[st.playerId];
    var def = PP.PARTY_BY_ID[st.playerId];
    return '<div class="topbar">' +
      '<div class="brand" style="color:' + def.color + '">' + esc(def.name) + '</div>' +
      stat('Неделя', st.week + ' / ' + st.totalWeeks) +
      stat('Расписание', st.ap + ' / ' + st.apMax + ' AP') +
      stat('Касса', money(ps.funds)) +
      stat('Активисты', Math.round(ps.activists)) +
      stat('Единство', Math.round(ps.unity)) +
      stat('Силы лидера', Math.round(st.stamina)) +
      stat('Рейтинг лидера', (ps.leader.approval > 0 ? '+' : '') + ps.leader.approval.toFixed(0)) +
      (ps.scandal > 5 ? stat('Скандал', Math.round(ps.scandal)) : '') +
      '<div class="spacer"></div>' +
      '<button id="btn-help">Правила</button>' +
      '<button id="btn-save">Сохранить</button>' +
      '<button class="primary" id="btn-week">' + (st.week >= st.totalWeeks ? 'День голосования →' : 'Завершить неделю →') + '</button>' +
      '</div>';
  }

  function stat(k, v) { return '<div class="stat"><span class="k">' + k + '</span><span class="v">' + v + '</span></div>'; }

  function renderPollPanel() {
    var st = app.state;
    var hist = st.pollHistory;
    var last = hist[hist.length - 1].shares;
    var prev = hist.length > 1 ? hist[hist.length - 2].shares : null;
    var rows = sortedShares(last, 1).map(function (pid) {
      var d = prev ? last[pid] - prev[pid] : 0;
      return '<div class="poll-row">' +
        '<span class="abbr" style="color:' + color(pid) + '">' + abbr(pid) + '</span>' +
        '<span class="bar"><span style="width:' + Math.min(last[pid] * 2.2, 100) + '%;background:' + color(pid) + '"></span></span>' +
        '<span class="num">' + last[pid].toFixed(1) +
        (prev ? '<br><span class="delta ' + (d >= 0 ? 'up' : 'down') + '">' + (d >= 0 ? '+' : '') + d.toFixed(1) + '</span>' : '') +
        '</span></div>';
    }).join('');
    return '<div class="panel"><h3>Опрос недели <span class="hint">публикуется с погрешностью</span></h3>' + rows + '</div>';
  }

  function renderProjectionPanel() {
    var st = app.state;
    var proj = PP.projectSeats(st, currentShares(), { incumbency: 0.05 });
    var order = Object.keys(proj).sort(function (a, b) { return proj[b] - proj[a]; });
    var bar = order.map(function (pid) {
      return '<span style="width:' + (proj[pid] / PP.TOTAL_SEATS * 100) + '%;background:' + color(pid) + '" title="' + pname(pid) + ': ' + proj[pid] + '"></span>';
    }).join('');
    var mine = proj[st.playerId] || 0;
    var start = st.startingSeats[st.playerId] || 0;
    var rows = order.filter(function (p) { return proj[p] >= 3 || p === st.playerId; }).map(function (pid) {
      var d = (proj[pid] || 0) - (st.startingSeats[pid] || 0);
      return '<div class="poll-row"><span class="abbr" style="color:' + color(pid) + '">' + abbr(pid) + '</span>' +
        '<span class="bar"><span style="width:' + (proj[pid] / 400 * 100) + '%;background:' + color(pid) + '"></span></span>' +
        '<span class="num">' + proj[pid] + '<br><span class="delta ' + (d >= 0 ? 'up' : 'down') + '">' + (d >= 0 ? '+' : '') + d + '</span></span></div>';
    }).join('');
    return '<div class="panel"><h3>Проекция мест <span class="hint">большинство — 326</span></h3>' +
      '<div class="commons">' + bar + '</div>' +
      '<div class="majority-line">Ваши мандаты: <b>' + mine + '</b> (старт ' + start + ', ближайшая цель — ' + nextGoal(st, mine) + ')</div>' +
      rows + '</div>';
  }

  /* Ближайшая невзятая ступень целей кампании. */
  function nextGoal(st, mine) {
    var def = PP.PARTY_BY_ID[st.playerId];
    var goals = def.goals || [{ seats: def.target, label: 'цель кампании' }];
    for (var i = 0; i < goals.length; i++) {
      if (mine < goals[i].seats) return goals[i].seats + ' («' + goals[i].label + '»)';
    }
    return 'все ступени взяты';
  }

  function renderSidebar() {
    return renderPollPanel() + renderProjectionPanel() + renderAgendaPanel();
  }

  function renderAgendaPanel() {
    var st = app.state;
    var ids = PP.ISSUE_IDS.slice().sort(function (a, b) { return st.salience[b] - st.salience[a]; }).slice(0, 5);
    var rows = ids.map(function (id) {
      var issue = PP.ISSUE_BY_ID[id];
      return '<div class="poll-row"><span class="abbr" style="font-size:11px">' + esc(issue.short) + '</span>' +
        '<span class="bar"><span style="width:' + (st.salience[id] / 30 * 100) + '%;background:var(--accent)"></span></span>' +
        '<span class="num">' + st.salience[id].toFixed(0) + '</span></div>';
    }).join('');
    return '<div class="panel"><h3>Повестка недели <span class="hint">что волнует страну</span></h3>' + rows + '</div>';
  }

  var TABS = [
    { id: 'actions', label: 'Кампания' },
    { id: 'regions', label: 'Регионы' },
    { id: 'policy', label: 'Программа' },
    { id: 'seats', label: 'Округа' },
    { id: 'rivals', label: 'Соперники' },
    { id: 'news', label: 'Новости' }
  ];

  function renderTabs() {
    return '<div class="tabs">' + TABS.map(function (t) {
      return '<button data-tab="' + t.id + '" class="' + (app.tab === t.id ? 'active' : '') + '">' + t.label + '</button>';
    }).join('') + '</div>';
  }

  function renderActions() {
    var st = app.state;
    var cards = PP.ACTIONS.map(function (a) {
      var check = PP.canRunAction(st, st.playerId, a.id);
      return '<div class="action-card' + (check.ok ? '' : ' disabled') + '">' +
        '<div class="ahead"><span class="aicon">' + a.icon + '</span>' + esc(a.name) + '</div>' +
        '<div class="adesc">' + esc(a.desc) + '</div>' +
        '<div class="acost">' + a.ap + ' AP · ' + (a.cost ? money(a.cost) : 'бесплатно') + (a.stamina ? ' · силы -' + a.stamina : '') +
        (a.id === 'broadcast' ? ' · осталось эфиров: ' + st.parties[st.playerId].broadcastsLeft : '') + '</div>' +
        '<button data-action="' + a.id + '"' + (check.ok ? '' : ' disabled title="' + esc(check.why) + '"') + '>' +
        (check.ok ? 'Сделать' : esc(check.why)) + '</button></div>';
    }).join('');
    var log = (st.turnLog || []).slice(0, 6).map(function (l) { return '<div class="news-item ' + (l.tone || '') + '">' + esc(l.text) + '</div>'; }).join('');
    return '<div class="panel"><h3>Расписание недели <span class="hint">осталось ' + st.ap + ' из ' + st.apMax + ' AP</span></h3>' +
      '<div class="action-grid">' + cards + '</div></div>' +
      (log ? '<div class="panel"><h3>Что вышло на этой неделе</h3>' + log + '</div>' : '');
  }

  function renderRegions() {
    var st = app.state, shares = currentShares();
    var cards = PP.CAMPAIGN_REGIONS.map(function (r) {
      var sh = shares[r.id];
      var order = sortedShares(sh, 1.5);
      var mine = sh[st.playerId];
      var effort = (st.effort[r.id] && st.effort[r.id][st.playerId]) || 0;
      var bar = order.map(function (pid) { return '<span style="width:' + sh[pid] + '%;background:' + color(pid) + '"></span>'; }).join('');
      return '<div class="region-card" data-region="' + r.id + '">' +
        '<div class="rname">' + esc(r.name) + '<span class="rseats">' + r.seats + ' мест</span></div>' +
        '<div class="mini-bar">' + bar + '</div>' +
        '<div class="rlead">' + order.slice(0, 3).map(function (pid) {
          return '<span style="color:' + color(pid) + '">' + abbr(pid) + ' ' + sh[pid].toFixed(1) + '</span>';
        }).join(' · ') +
        (mine !== undefined ? '<br>вы: ' + mine.toFixed(1) + '% ' + (effort > 0.2 ? '(кампания +' + effort.toFixed(1) + ')' : '') : '<br>здесь вы не выдвигаетесь') +
        '</div></div>';
    }).join('');
    return '<div class="panel"><h3>Регионы <span class="hint">клик — подробности округов</span></h3><div class="region-grid">' + cards + '</div></div>' +
      (app.region ? renderRegionDetail(app.region) : '');
  }

  function renderRegionDetail(rid) {
    var st = app.state, region = PP.REGION_BY_ID[rid], shares = currentShares()[rid];
    var seats = st.seats.filter(function (s) { return s.region === rid; }).map(function (seat) {
      var res = PP.seatResult(seat, shares, { noise: 0, incumbency: 0.05 });
      return { seat: seat, res: res };
    }).sort(function (a, b) { return a.res.margin - b.res.margin; });
    var rows = seats.slice(0, 24).map(function (x) {
      var mine = x.res.shares[st.playerId] || 0;
      return '<tr><td>' + esc(x.seat.name) + '</td>' +
        '<td><span class="pill" style="background:' + color(x.res.winner) + '">' + abbr(x.res.winner) + '</span></td>' +
        '<td class="num">' + x.res.margin.toFixed(1) + '</td>' +
        '<td class="num" style="color:' + color(st.playerId) + '">' + mine.toFixed(1) + '</td>' +
        '<td>' + (st.targeted[x.seat.id] ? '🎯' : '') + (x.seat.holder === st.playerId ? ' 🪑' : '') + '</td></tr>';
    }).join('');
    var d = region.demo;
    return '<div class="panel"><h3>' + esc(region.name) + ' <span class="hint">' + region.seats + ' мест · самые близкие округа</span></h3>' +
      '<p class="hint">Демография: пожилые ' + d.age + ' · высшее образование ' + d.degree + ' · евроскептицизм ' + d.leave + ' · города ' + d.urban + ' · достаток ' + d.prosperity + '</p>' +
      '<table><thead><tr><th>Округ</th><th>Лидирует</th><th class="num">Отрыв</th><th class="num">Вы</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>';
  }

  function renderPolicy() {
    var st = app.state, ps = st.parties[st.playerId];
    var refRegion = PP.CAMPAIGN_REGIONS[0];
    var prio = PP.aiPriorityRegions(st, st.playerId).slice(0, 3);
    var prefs = {};
    PP.ISSUE_IDS.forEach(function (id) { prefs[id] = 0; });
    prio.forEach(function (x) {
      var p = PP.regionPreferences(x.region);
      PP.ISSUE_IDS.forEach(function (id) { prefs[id] += p[id] / prio.length; });
    });
    var items = PP.ISSUES.map(function (issue) {
      var pos = ps.positions[issue.id];
      var core = ps.corePositions[issue.id];
      var want = prefs[issue.id];
      var toPct = function (v) { return (v + 100) / 2; };
      return '<div class="issue">' +
        '<div class="ihead"><b>' + esc(issue.name) + '</b><span class="isal">значимость ' + st.salience[issue.id].toFixed(0) +
        ' · компетентность ' + Math.round(ps.competence[issue.id]) + '</span></div>' +
        '<div class="scale">' +
        '<div class="tick" style="left:' + toPct(core) + '%;background:#5b6b80" title="Историческая позиция партии"></div>' +
        '<div class="tick" style="left:' + toPct(pos) + '%;background:' + color(st.playerId) + ';width:5px" title="Ваша позиция"></div>' +
        '<div class="voter" style="left:' + toPct(want) + '%" title="Настроение ключевых регионов">▼</div>' +
        '</div>' +
        '<div class="scale-labels"><span>' + esc(issue.leftLabel) + '</span><span>' + esc(issue.rightLabel) + '</span></div>' +
        '</div>';
    }).join('');
    return '<div class="panel"><h3>Программа партии <span class="hint">▼ — настроение регионов, где решается ваша судьба</span></h3>' +
      '<p class="hint">Позицию двигает действие «Заявление о политике». Уход далеко от исторической линии партии (серая метка) бьёт по единству фракции.</p>' +
      items + '</div>';
  }

  function renderSeatsTab() {
    var st = app.state, shares = currentShares();
    var rows = st.seats.map(function (seat) {
      var res = PP.seatResult(seat, shares[seat.region], { noise: 0, incumbency: 0.05 });
      var mine = res.shares[st.playerId] || 0;
      return { seat: seat, res: res, gap: res.winner === st.playerId ? -res.margin : (res.shares[res.winner] - mine) };
    }).sort(function (a, b) { return a.gap - b.gap; });
    var held = rows.filter(function (r) { return r.res.winner === st.playerId; }).length;
    var targets = rows.filter(function (r) { return r.gap > 0 && r.gap < 8; }).slice(0, 30);
    var defend = rows.filter(function (r) { return r.gap < 0 && r.gap > -6; }).slice(0, 20);
    function table(list, title) {
      return '<h3>' + title + '</h3><table><thead><tr><th>Округ</th><th>Регион</th><th>Лидирует</th><th class="num">Разрыв</th></tr></thead><tbody>' +
        list.map(function (x) {
          return '<tr><td>' + esc(x.seat.name) + (st.targeted[x.seat.id] ? ' 🎯' : '') + '</td><td>' + esc(PP.REGION_BY_ID[x.seat.region].name) + '</td>' +
            '<td><span class="pill" style="background:' + color(x.res.winner) + '">' + abbr(x.res.winner) + '</span></td>' +
            '<td class="num">' + Math.abs(x.gap).toFixed(1) + '</td></tr>';
        }).join('') + '</tbody></table>';
    }
    return '<div class="panel"><h3>Карта борьбы <span class="hint">по текущим настроениям вы ведёте в ' + held + ' округах</span></h3>' +
      '<div class="list">' + table(defend, 'Под угрозой (ваши, но с малым отрывом)') + table(targets, 'Ближайшие цели') + '</div></div>';
  }

  function renderRivals() {
    var st = app.state, shares = currentShares();
    var nat = PP.nationalShares(st, shares);
    var rows = PP.PARTIES.filter(function (p) { return p.id !== 'oth'; }).map(function (def) {
      var ps = st.parties[def.id];
      return '<tr><td><span class="pill" style="background:' + def.color + '">' + def.abbr + '</span> ' + esc(def.ru) + '</td>' +
        '<td>' + esc(ps.leader.name) + '</td>' +
        '<td class="num">' + (nat[def.id] || 0).toFixed(1) + '</td>' +
        '<td class="num">' + (ps.leader.approval > 0 ? '+' : '') + ps.leader.approval.toFixed(0) + '</td>' +
        '<td class="num">' + money(ps.funds) + '</td>' +
        '<td class="num">' + Math.round(ps.unity) + '</td>' +
        '<td class="num">' + (ps.momentum > 0 ? '+' : '') + ps.momentum.toFixed(1) + '</td></tr>';
    }).join('');
    return '<div class="panel"><h3>Соперники <span class="hint">разведка кампании</span></h3>' +
      '<table><thead><tr><th>Партия</th><th>Лидер</th><th class="num">%</th><th class="num">Рейтинг</th><th class="num">Касса</th><th class="num">Единство</th><th class="num">Инерция</th></tr></thead>' +
      '<tbody>' + rows + '</tbody></table></div>';
  }

  function renderNews() {
    var st = app.state;
    var items = st.news.map(function (n) {
      return '<div class="news-item ' + esc(n.kind) + '"><span class="w">нед. ' + n.week + '</span> ' + esc(n.text) + '</div>';
    }).join('');
    return '<div class="panel"><h3>Хроника кампании</h3><div class="list">' + items + '</div></div>';
  }

  function renderCampaign() {
    var body;
    if (app.tab === 'actions') body = renderActions();
    else if (app.tab === 'regions') body = renderRegions();
    else if (app.tab === 'policy') body = renderPolicy();
    else if (app.tab === 'seats') body = renderSeatsTab();
    else if (app.tab === 'rivals') body = renderRivals();
    else body = renderNews();
    return renderTopbar() +
      '<div class="layout"><div>' + renderSidebar() + '</div>' +
      '<div>' + renderTabs() + body + '</div></div>';
  }

  /* ================= Модальные окна ================= */

  function modal(html) {
    var back = doc.createElement('div');
    back.className = 'modal-back';
    back.innerHTML = '<div class="modal">' + html + '</div>';
    doc.body.appendChild(back);
    return back;
  }

  function closeModals() {
    Array.prototype.forEach.call(doc.querySelectorAll('.modal-back'), function (m) { m.remove(); });
  }

  function pickRegion(title, cb) {
    var st = app.state, shares = currentShares();
    var regions = PP.regionsForParty(st.playerId);
    var html = '<h2>' + esc(title) + '</h2><div class="options">' + regions.map(function (r) {
      var sh = shares[r.id];
      var order = sortedShares(sh, 1.5);
      var mine = sh[st.playerId] || 0;
      return '<button data-pick="' + r.id + '">' + esc(r.name) + ' — ' + r.seats + ' мест' +
        '<span class="opt-hint">вы ' + mine.toFixed(1) + '% · лидирует ' + abbr(order[0]) + ' ' + sh[order[0]].toFixed(1) + '%</span></button>';
    }).join('') + '<button data-pick="cancel" class="ghost">Отмена</button></div>';
    var m = modal(html);
    m.addEventListener('click', function (e) {
      var b = e.target.closest('[data-pick]');
      if (!b) return;
      closeModals();
      if (b.dataset.pick !== 'cancel') cb(b.dataset.pick);
    });
  }

  function pickPolicy(cb) {
    var st = app.state, ps = st.parties[st.playerId];
    var html = '<h2>Заявление о политике</h2><p class="hint">Сдвиг позиции на 9 пунктов и рост значимости темы в повестке.</p><div class="options">' +
      PP.ISSUES.map(function (i) {
        return '<button data-issue="' + i.id + '" data-dir="-1">' + esc(i.name) + ': ' + esc(i.leftLabel) +
          '<span class="opt-hint">сейчас ' + ps.positions[i.id].toFixed(0) + ' · значимость ' + st.salience[i.id].toFixed(0) + '</span></button>' +
          '<button data-issue="' + i.id + '" data-dir="1">' + esc(i.name) + ': ' + esc(i.rightLabel) +
          '<span class="opt-hint">сейчас ' + ps.positions[i.id].toFixed(0) + ' · значимость ' + st.salience[i.id].toFixed(0) + '</span></button>';
      }).join('') + '<button data-issue="cancel" class="ghost">Отмена</button></div>';
    var m = modal(html);
    m.addEventListener('click', function (e) {
      var b = e.target.closest('[data-issue]');
      if (!b) return;
      closeModals();
      if (b.dataset.issue !== 'cancel') cb(b.dataset.issue, parseInt(b.dataset.dir, 10));
    });
  }

  function pickAttack(cb) {
    var st = app.state, shares = currentShares();
    var nat = PP.nationalShares(st, shares);
    var rivals = Object.keys(nat).filter(function (p) { return p !== st.playerId && p !== 'oth' && nat[p] > 2; })
      .sort(function (a, b) { return nat[b] - nat[a]; });
    var html = '<h2>По кому бьём?</h2><div class="options">' + rivals.map(function (pid) {
      return '<button data-target="' + pid + '">' + esc(pname(pid)) + '<span class="opt-hint">' + nat[pid].toFixed(1) + '% по стране</span></button>';
    }).join('') + '<button data-target="cancel" class="ghost">Отмена</button></div>';
    var m = modal(html);
    m.addEventListener('click', function (e) {
      var b = e.target.closest('[data-target]');
      if (!b) return;
      closeModals();
      if (b.dataset.target === 'cancel') return;
      var target = b.dataset.target;
      pickRegion('Где бьём по ' + pname(target) + '?', function (rid) { cb(target, rid); });
    });
  }

  function showEvent() {
    var st = app.state, ev = st.pendingEvent;
    var html = '<h2>' + esc(ev.title) + '</h2><p>' + esc(ev.text) + '</p><div class="options">' +
      ev.options.map(function (o) { return '<button data-opt="' + o.i + '">' + esc(o.label) + '</button>'; }).join('') + '</div>';
    var m = modal(html);
    m.addEventListener('click', function (e) {
      var b = e.target.closest('[data-opt]');
      if (!b) return;
      var text = PP.resolveEventChoice(st, parseInt(b.dataset.opt, 10));
      closeModals();
      modalInfo('Итог', text);
      render();
    });
  }

  function showDebate() {
    var st = app.state, d = st.pendingDebate;
    var html = '<h2>📺 Теледебаты лидеров</h2><p>Главный соперник вечера — ' + esc(pname(d.rival)) +
      '. Как вы проводите этот час?</p><div class="options">' +
      PP.DEBATE_MOVES.map(function (mv) {
        return '<button data-move="' + mv.id + '">' + esc(mv.label) + '<span class="opt-hint">' + esc(mv.hint) + '</span></button>';
      }).join('') + '</div>';
    var m = modal(html);
    m.addEventListener('click', function (e) {
      var b = e.target.closest('[data-move]');
      if (!b) return;
      var res = PP.resolveDebateChoice(st, b.dataset.move);
      closeModals();
      modalInfo('После эфира', res.text);
      render();
    });
  }

  function modalInfo(title, text, onClose) {
    var m = modal('<h2>' + esc(title) + '</h2><p>' + esc(text) + '</p><div class="options"><button class="primary" data-close="1">Дальше</button></div>');
    m.addEventListener('click', function (e) {
      if (e.target.closest('[data-close]')) { closeModals(); if (onClose) onClose(); }
    });
  }

  /* ================= Ночь выборов ================= */

  function startNight() {
    var st = app.state;
    var result = PP.runElection(st);
    app.night = { result: result, index: 0, clock: 0, counts: {}, running: true, timer: null };
    st.result = { seats: result.seats, votes: result.votes };
    app.screen = 'night';
    render();
    tickNight();
  }

  function tickNight() {
    var n = app.night;
    if (!n || !n.running) return;
    var batch = Math.max(1, Math.round(n.result.results.length / 90));
    for (var i = 0; i < batch && n.index < n.result.results.length; i++) {
      countDeclaration(n, n.result.results[n.index++]);
    }
    renderNightBody();
    if (n.index >= n.result.results.length) {
      n.running = false;
      setTimeout(finishNight, 900);
      return;
    }
    n.timer = setTimeout(tickNight, 130);
  }

  function skipNight() {
    var n = app.night;
    if (!n) return;
    if (n.timer) clearTimeout(n.timer);
    while (n.index < n.result.results.length) {
      countDeclaration(n, n.result.results[n.index++]);
    }
    n.running = false;
    renderNightBody();
    finishNight();
  }

  /* Счёт ночи: мандаты и чистое изменение относительно прошлого состава. */
  function countDeclaration(n, r) {
    n.counts[r.winner] = (n.counts[r.winner] || 0) + 1;
    n.net = n.net || {};
    if (r.previous) {
      n.net[r.previous] = (n.net[r.previous] || 0) - 1;
    }
    n.net[r.winner] = (n.net[r.winner] || 0) + 1;
    n.clock = r.time;
  }

  function clockText(t) {
    var hour = (22 + Math.floor(t)) % 24;
    var min = Math.floor((t % 1) * 60);
    return (hour < 10 ? '0' : '') + hour + ':' + (min < 10 ? '0' : '') + min;
  }

  function renderNight() {
    var n = app.night;
    var exit = n.result.exitPoll;
    var order = Object.keys(exit).sort(function (a, b) { return exit[b] - exit[a]; }).slice(0, 6);
    return '<div class="night">' +
      '<div class="panel"><h3>Экзитпол в 22:00 <span class="hint">прогноз, а не результат</span></h3>' +
      order.map(function (pid) {
        return '<div class="poll-row"><span class="abbr" style="color:' + color(pid) + '">' + abbr(pid) + '</span>' +
          '<span class="bar"><span style="width:' + (exit[pid] / 400 * 100) + '%;background:' + color(pid) + '"></span></span>' +
          '<span class="num">' + exit[pid] + '</span></div>';
      }).join('') + '</div>' +
      '<div class="clock" id="night-clock">22:00</div>' +
      '<div id="night-body"></div>' +
      '<div class="setup-row"><button id="btn-skip">Промотать ночь</button></div></div>';
  }

  function renderNightBody() {
    var n = app.night;
    var clock = el('night-clock');
    if (clock) clock.textContent = clockText(n.clock);
    var counted = n.index;
    var order = Object.keys(n.counts).sort(function (a, b) { return n.counts[b] - n.counts[a]; }).slice(0, 7);
    var tickers = order.map(function (pid) {
      var d = (n.net && n.net[pid]) || 0;
      return '<div class="ticker"><div class="tl" style="color:' + color(pid) + '">' + abbr(pid) + '</div>' +
        '<div class="tn">' + n.counts[pid] + '</div>' +
        '<div class="tc ' + (d >= 0 ? 'up' : 'down') + '" style="color:' + (d >= 0 ? 'var(--green)' : 'var(--red)') + '">' + (d >= 0 ? '+' : '') + d + '</div></div>';
    }).join('');
    var feed = n.result.results.slice(Math.max(0, n.index - 14), n.index).reverse().map(function (r) {
      var gain = r.previous && r.previous !== r.winner;
      return '<div class="decl' + (gain ? ' gain' : '') + '">' +
        '<span class="tc">' + clockText(r.time) + '</span>' +
        '<span>' + esc(r.name) + '</span>' +
        '<span><span class="pill" style="background:' + color(r.winner) + '">' + abbr(r.winner) + '</span> ' +
        (gain ? 'перехват у ' + abbr(r.previous) : 'удержание') + '</span>' +
        '<span class="tc">' + (r.shares ? '+' + r.margin.toFixed(1) : '') + '</span></div>';
    }).join('');
    var body = el('night-body');
    if (body) {
      var lead = order[0];
      var toMajority = lead ? Math.max(0, n.result.majority.effective - n.counts[lead]) : 0;
      body.innerHTML = '<div class="tickers">' + tickers + '</div>' +
        '<div class="panel"><h3>Объявлено округов: ' + counted + ' из ' + PP.TOTAL_SEATS +
        (lead ? ' <span class="hint">' + abbr(lead) + ' до большинства: ' + toMajority + '</span>' : '') + '</h3>' +
        '<div class="decl-feed">' + feed + '</div></div>';
    }
  }

  function finishNight() {
    app.screen = 'result';
    render();
  }

  /* ================= Результат и переговоры ================= */

  function renderResult() {
    var st = app.state, res = app.night.result;
    var seats = res.seats;
    var order = Object.keys(seats).sort(function (a, b) { return seats[b] - seats[a]; });
    var mine = seats[st.playerId] || 0;
    var winner = order[0];
    var maj = res.majority;
    var gov = st.government;

    var headline;
    if (seats[winner] >= maj.effective) headline = pname(winner) + ': большинство в Палате общин';
    else headline = 'Подвешенный парламент';

    var bar = order.map(function (pid) {
      return '<span style="width:' + (seats[pid] / PP.TOTAL_SEATS * 100) + '%;background:' + color(pid) + '" title="' + pname(pid) + ' ' + seats[pid] + '"></span>';
    }).join('');

    var table = '<table><thead><tr><th>Партия</th><th class="num">Мест</th><th class="num">Изм.</th><th class="num">Голосов</th></tr></thead><tbody>' +
      order.map(function (pid) {
        var d = seats[pid] - (st.startingSeats[pid] || 0);
        return '<tr><td><span class="pill" style="background:' + color(pid) + '">' + abbr(pid) + '</span> ' + esc(pname(pid)) + '</td>' +
          '<td class="num">' + seats[pid] + '</td>' +
          '<td class="num" style="color:' + (d >= 0 ? 'var(--green)' : 'var(--red)') + '">' + (d >= 0 ? '+' : '') + d + '</td>' +
          '<td class="num">' + (res.votes[pid] ? res.votes[pid].toFixed(1) + '%' : '—') + '</td></tr>';
      }).join('') + '</tbody></table>';

    var verdict = gov ? renderVerdict(gov, mine) : renderNegotiation(res, mine);

    return '<div class="night">' +
      '<div class="result-hero"><div class="big">' + esc(headline) + '</div>' +
      '<p>Ваш результат: <b>' + mine + '</b> мандатов (' + (res.votes[st.playerId] || 0).toFixed(1) + '% голосов). ' +
      'Порог большинства: ' + maj.effective + ' с учётом ' + maj.abstaining + ' неголосующих депутатов.</p>' +
      '<div class="commons">' + bar + '</div></div>' +
      verdict +
      '<div class="panel"><h3>Палата общин</h3>' + table + '</div>' +
      '<div class="setup-row"><button id="btn-restart">Новая кампания</button></div></div>';
  }

  function renderNegotiation(res, mine) {
    var st = app.state;
    var order = Object.keys(res.seats).sort(function (a, b) { return res.seats[b] - res.seats[a]; });
    var largest = order[0];
    var offer = app.offer || { cabinet: true, confidence: false, pr: false, referendum: false };
    if (res.seats[st.playerId] >= res.majority.effective) {
      return '<div class="panel"><h3>Правительство</h3><p>Вы получили абсолютное большинство. Формальности займут день, а дальше — Даунинг-стрит.</p>' +
        '<button class="primary" data-gov="solo">Сформировать правительство</button></div>';
    }
    if (mine < 2) {
      return '<div class="panel"><h3>Итог</h3><p>Мандатов слишком мало для переговоров. Вы наблюдаете за формированием правительства со стороны.</p>' +
        '<button class="primary" data-gov="observe">Смотреть, как это делают другие</button></div>';
    }
    var opts = PP.coalitionOptions(st, res, st.playerId, offer);
    var selected = app.partners || [];
    var total = res.seats[st.playerId] + selected.reduce(function (s, p) { return s + (res.seats[p] || 0); }, 0);
    var rows = opts.map(function (o) {
      var on = selected.indexOf(o.id) >= 0;
      return '<tr><td><label><input type="checkbox" data-partner="' + o.id + '"' + (on ? ' checked' : '') + '> ' +
        '<span class="pill" style="background:' + color(o.id) + '">' + abbr(o.id) + '</span> ' + esc(pname(o.id)) + '</label></td>' +
        '<td class="num">' + o.seats + '</td>' +
        '<td class="num">' + o.distance.toFixed(0) + '</td>' +
        '<td class="num" style="color:' + (o.willing > 55 ? 'var(--green)' : o.willing > 40 ? 'var(--accent)' : 'var(--red)') + '">' + o.willing.toFixed(0) + '</td></tr>';
    }).join('');
    return '<div class="panel"><h3>Переговоры о правительстве <span class="hint">нужно ' + res.majority.effective + ' мандатов</span></h3>' +
      '<p>Крупнейшая партия: ' + esc(pname(largest)) + ' (' + res.seats[largest] + '). У вас с выбранными партнёрами: <b>' + total + '</b>.</p>' +
      '<div class="setup-row" style="justify-content:flex-start">' +
      '<label><input type="checkbox" data-offer="cabinet"' + (offer.cabinet ? ' checked' : '') + '> Места в кабинете</label>' +
      '<label><input type="checkbox" data-offer="pr"' + (offer.pr ? ' checked' : '') + '> Реформа избирательной системы</label>' +
      '<label><input type="checkbox" data-offer="referendum"' + (offer.referendum ? ' checked' : '') + '> Референдум для Шотландии</label>' +
      '<label><input type="checkbox" data-offer="confidence"' + (offer.confidence ? ' checked' : '') + '> Только поддержка без кабинета</label>' +
      '</div>' +
      '<table><thead><tr><th>Партия</th><th class="num">Мест</th><th class="num">Дистанция</th><th class="num">Готовность</th></tr></thead><tbody>' + rows + '</tbody></table>' +
      '<div class="setup-row" style="justify-content:flex-start"><button class="primary" data-gov="try">Предложить союз</button>' +
      '<button data-gov="observe">Уйти в оппозицию</button></div></div>';
  }

  function renderVerdict(gov, mine) {
    var st = app.state;
    var def = PP.PARTY_BY_ID[st.playerId];
    var title, text;
    if (gov.kind === 'majority') {
      title = 'Даунинг-стрит, 10';
      text = 'Вы формируете однопартийное правительство большинства: ' + gov.seats + ' мандатов при пороге ' + gov.threshold + '.';
    } else if (gov.kind === 'coalition') {
      title = 'Коалиционное правительство';
      text = 'Союз с ' + gov.partners.map(pname).join(', ') + ' даёт ' + gov.seats + ' мандатов. Кабинет придётся делить.';
    } else if (gov.kind === 'confidence') {
      title = 'Правительство меньшинства с внешней поддержкой';
      text = gov.partners.map(pname).join(', ') + ' обещали не валить вас на вотумах доверия и бюджете. Каждый закон — отдельные переговоры.';
    } else if (gov.kind === 'opposition') {
      var res = app.night.result;
      var ranked = Object.keys(res.seats).sort(function (a, b) { return res.seats[b] - res.seats[a]; })
        .filter(function (pid) { return pid !== gov.leader; });
      var official = ranked[0] === st.playerId;
      title = official ? 'Официальная оппозиция Его Величества' : 'Оппозиционные скамьи';
      text = 'Правительство формирует ' + pname(gov.leader) + '. У вас ' + mine + ' мандатов' +
        (official ? ' и статус главной оппозиции' : '') + ' — и четыре года на подготовку реванша.';
    } else {
      title = 'Правительство меньшинства';
      text = 'Ни один союз не собрался. Вы пытаетесь править без большинства — до первого серьёзного голосования.';
    }
    var goals = def.goals || [{ seats: def.target, label: 'Цель кампании' }];
    var achieved = null, next = null;
    goals.forEach(function (g) {
      if (mine >= g.seats) achieved = g;
      else if (!next) next = g;
    });
    var verdictLine = achieved
      ? 'Достигнуто: ' + achieved.label + ' (' + achieved.seats + '+ мандатов).'
      : 'Ни одна из целей кампании не взята.';
    if (next) verdictLine += ' До следующей ступени «' + next.label + '» не хватило ' + (next.seats - mine) + '.';
    var ladder = '<table><thead><tr><th>Ступень</th><th class="num">Нужно мест</th><th></th></tr></thead><tbody>' +
      goals.map(function (g) {
        return '<tr><td>' + esc(g.label) + '</td><td class="num">' + g.seats + '</td><td>' +
          (mine >= g.seats ? '<span style="color:var(--green)">✔ взято</span>' : '<span class="hint">—</span>') + '</td></tr>';
      }).join('') + '</tbody></table>';
    var refused = gov.refused && gov.refused.length
      ? '<p class="hint">Отказали: ' + gov.refused.map(function (r) { return pname(r.id) + ' (готовность ' + r.willing.toFixed(0) + ')'; }).join(', ') + '.</p>'
      : '';
    return '<div class="panel"><h3>' + esc(title) + '</h3><p>' + esc(text) + '</p>' + refused +
      '<p><b>' + esc(verdictLine) + '</b></p>' + ladder + '</div>';
  }

  /* ================= Роутинг и события ================= */

  function render() {
    var wrap = el('app');
    if (app.screen === 'title') wrap.innerHTML = renderTitle();
    else if (app.screen === 'campaign') wrap.innerHTML = renderCampaign();
    else if (app.screen === 'night') { wrap.innerHTML = renderNight(); renderNightBody(); }
    else if (app.screen === 'result') wrap.innerHTML = renderResult();
  }

  function runPlayerAction(actionId) {
    var st = app.state;
    var check = PP.canRunAction(st, st.playerId, actionId);
    if (!check.ok) return;
    var rng = new PP.Rng('act:' + st.seed + ':' + st.week + ':' + st.ap + ':' + actionId);
    var a = PP.ACTION_BY_ID[actionId];
    var go = function (params) {
      var out = PP.performAction(st, st.playerId, actionId, params, rng);
      st.turnLog.unshift({ text: a.icon + ' ' + out.text, tone: out.tone });
      st._cacheRegionShares = null;
      render();
    };
    if (a.needs === 'region') pickRegion(a.name + ': выберите регион', function (rid) { go({ regionId: rid }); });
    else if (a.needs === 'policy') pickPolicy(function (issueId, dir) { go({ issueId: issueId, direction: dir }); });
    else if (a.needs === 'attack') pickAttack(function (target, rid) { go({ targetId: target, regionId: rid }); });
    else go({});
  }

  function endWeek() {
    var st = app.state;
    st.turnLog = [];
    var out = PP.endWeek(st);
    PP.saveGame(st);
    if (out.ended) { startNight(); return; }
    render();
    if (st.pendingDebate) showDebate();
    else if (st.pendingEvent) showEvent();
  }

  function startGame() {
    var seedInput = el('inp-seed');
    var seed = seedInput && seedInput.value.trim();
    app.state = PP.newGame({
      playerId: app.setup.party,
      difficulty: app.setup.difficulty,
      weeks: app.setup.weeks,
      seed: seed || String(Math.floor(Math.random() * 1e9))
    });
    app.screen = 'campaign';
    app.tab = 'actions';
    app.region = null;
    PP.saveGame(app.state);
    render();
  }

  function bind() {
    doc.addEventListener('click', function (e) {
      var t = e.target;
      var card = t.closest && t.closest('[data-party]');
      if (card && app.screen === 'title') { app.setup.party = card.dataset.party; render(); return; }
      var tab = t.closest && t.closest('[data-tab]');
      if (tab) { app.tab = tab.dataset.tab; render(); return; }
      var region = t.closest && t.closest('[data-region]');
      if (region && app.screen === 'campaign' && app.tab === 'regions') {
        app.region = app.region === region.dataset.region ? null : region.dataset.region;
        render(); return;
      }
      var act = t.closest && t.closest('[data-action]');
      if (act) { runPlayerAction(act.dataset.action); return; }
      var gov = t.closest && t.closest('[data-gov]');
      if (gov) { handleGovernment(gov.dataset.gov); return; }
      if (t.id === 'btn-start') { startGame(); return; }
      if (t.id === 'btn-continue') {
        var loaded = PP.loadGame();
        if (loaded) { app.state = loaded; app.screen = 'campaign'; render(); resumePending(); }
        return;
      }
      if (t.id === 'btn-week') { endWeek(); return; }
      if (t.id === 'btn-help') { showHelp(); return; }
      if (t.id === 'btn-save') { modalInfo('Сохранение', PP.saveGame(app.state) ? 'Кампания сохранена в этом браузере.' : 'Браузер не разрешил сохранение.'); return; }
      if (t.id === 'btn-skip') { skipNight(); return; }
      if (t.id === 'btn-restart') { PP.clearSave(); app.screen = 'title'; app.state = null; app.night = null; app.offer = null; app.partners = null; render(); return; }
    });

    doc.addEventListener('change', function (e) {
      var t = e.target;
      if (t.id === 'sel-diff') { app.setup.difficulty = t.value; return; }
      if (t.id === 'sel-weeks') { app.setup.weeks = parseInt(t.value, 10); return; }
      if (t.dataset && t.dataset.partner) {
        app.partners = app.partners || [];
        var i = app.partners.indexOf(t.dataset.partner);
        if (t.checked && i < 0) app.partners.push(t.dataset.partner);
        if (!t.checked && i >= 0) app.partners.splice(i, 1);
        render(); return;
      }
      if (t.dataset && t.dataset.offer) {
        app.offer = app.offer || { cabinet: true, confidence: false, pr: false, referendum: false };
        app.offer[t.dataset.offer] = t.checked;
        render(); return;
      }
    });
  }

  function handleGovernment(kind) {
    var st = app.state, res = app.night.result;
    if (kind === 'solo') {
      st.government = PP.formGovernment(st, res, st.playerId, [], {});
    } else if (kind === 'observe') {
      var viable = PP.viableCoalitions(st, res);
      var other = viable.filter(function (v) { return v.leader !== st.playerId; })[0];
      st.government = { kind: 'opposition', leader: other ? other.leader : 'con', partners: other ? other.partners : [], seats: other ? other.seats : 0, threshold: res.majority.effective };
    } else {
      st.government = PP.formGovernment(st, res, st.playerId, app.partners || [], app.offer || { cabinet: true });
      if (st.government.kind === 'minority' && (res.seats[st.playerId] || 0) < (res.seats[Object.keys(res.seats).sort(function (a, b) { return res.seats[b] - res.seats[a]; })[0]] || 0)) {
        st.government.kind = 'opposition';
      }
    }
    PP.saveGame(st);
    render();
  }

  var HELP = [
    'Каждую неделю у вас есть очки расписания (AP). Тратьте их на поездки, рекламу, деньги и программу.',
    'Поддержка считается по регионам. Эффект кампании затухает примерно на четверть в неделю, поэтому регион нужно «дожимать».',
    'Мандаты берутся по округам: побеждает первый, остальные голоса пропадают. Ровный результат по всей стране почти не даёт мест — важна концентрация.',
    'Позиции партии по темам сравниваются с настроением региона и взвешиваются по значимости темы в повестке. Значимость меняется от событий.',
    'Уход далеко от исторической линии партии бьёт по единству фракции, а низкое единство снижает поддержку.',
    'Дебаты проходят дважды за кампанию. Выбор тактики сверяется с харизмой, компетентностью и силами лидера.',
    'Порог большинства — 326 мандатов, но депутаты «Шинн Фейн» не занимают места, поэтому фактическая планка ниже.',
    'Если большинства нет, начинаются переговоры: партнёр соглашается тем охотнее, чем ближе он идеологически и чем больше вы ему предлагаете.'
  ];

  function showHelp() {
    modal('<h2>Как это работает</h2><ul>' + HELP.map(function (h) { return '<li>' + esc(h) + '</li>'; }).join('') +
      '</ul><div class="options"><button class="primary" data-close="1">Понятно</button></div>')
      .addEventListener('click', function (e) { if (e.target.closest('[data-close]')) closeModals(); });
  }

  /* Модальное окно, зависшее с прошлой сессии (например, после загрузки). */
  function resumePending() {
    var st = app.state;
    if (!st) return;
    if (st.pendingDebate) showDebate();
    else if (st.pendingEvent) showEvent();
  }

  function boot() {
    bind();
    render();
  }

  PP.ui = { boot: boot, app: app, render: render };
})(typeof globalThis !== 'undefined' ? globalThis : this);
