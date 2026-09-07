/*
 * Меню запуска: заставка, выбор роли, выбор партии, конструктор своей
 * партии и настройки кампании.
 */
(function (root) {
  'use strict';

  var PP = root.PP;
  var clamp = PP.clamp;

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c];
    });
  }
  function money(v) { return '£' + v.toFixed(2) + ' млн'; }

  function rosette(color, size) {
    return '<span class="rosette" style="--c:' + color + ';--s:' + (size || 30) + 'px"></span>';
  }

  /* Силуэт Вестминстера — чистый SVG, без внешних файлов. */
  var SKYLINE =
    '<svg class="skyline" viewBox="0 0 1200 300" preserveAspectRatio="xMidYMax meet" aria-hidden="true">' +
    '<defs>' +
    '<radialGradient id="towerGlow" cx="50%" cy="50%" r="50%">' +
    '<stop offset="0%" stop-color="rgba(246,230,180,.34)"/><stop offset="100%" stop-color="rgba(246,230,180,0)"/>' +
    '</radialGradient>' +
    '</defs>' +
    /* звёзды */
    '<g fill="#dfe8f5" opacity=".55">' +
    '<circle cx="120" cy="46" r="1.6"/><circle cx="300" cy="28" r="1.2"/><circle cx="455" cy="62" r="1.5"/>' +
    '<circle cx="640" cy="34" r="1.1"/><circle cx="735" cy="70" r="1.4"/><circle cx="1105" cy="52" r="1.3"/>' +
    '<circle cx="1010" cy="120" r="1.1"/><circle cx="205" cy="96" r="1.2"/>' +
    '</g>' +
    '<circle cx="1010" cy="66" r="30" fill="#f2e7c9" opacity=".9"/>' +
    '<circle cx="998" cy="58" r="26" fill="#101a2a" opacity=".55"/>' +
    '<ellipse cx="840" cy="110" rx="170" ry="130" fill="url(#towerGlow)"/>' +
    /* здание парламента */
    '<g fill="#080d14">' +
    '<rect x="180" y="206" width="620" height="94"/>' +
    '<rect x="200" y="186" width="24" height="26"/><rect x="260" y="180" width="20" height="32"/>' +
    '<rect x="330" y="192" width="18" height="20"/><rect x="420" y="186" width="22" height="26"/>' +
    '<rect x="520" y="178" width="20" height="34"/><rect x="620" y="190" width="18" height="22"/>' +
    '<rect x="700" y="182" width="22" height="30"/><rect x="760" y="194" width="18" height="18"/>' +
    /* башня Виктории */
    '<rect x="150" y="130" width="70" height="170"/><polygon points="150,130 185,92 220,130"/>' +
    /* часовая башня */
    '<rect x="812" y="76" width="56" height="224"/><polygon points="812,76 840,30 868,76"/>' +
    '<rect x="806" y="130" width="68" height="10"/>' +
    /* городская застройка по краям */
    '<rect x="40" y="238" width="96" height="62"/><rect x="900" y="224" width="118" height="76"/>' +
    '<rect x="1030" y="248" width="150" height="52"/>' +
    '</g>' +
    /* окна */
    '<g fill="rgba(246,230,180,.55)">' +
    '<rect x="215" y="228" width="7" height="12"/><rect x="245" y="228" width="7" height="12"/>' +
    '<rect x="470" y="228" width="7" height="12"/><rect x="500" y="228" width="7" height="12"/>' +
    '<rect x="690" y="228" width="7" height="12"/><rect x="930" y="248" width="8" height="12"/>' +
    '<rect x="965" y="248" width="8" height="12"/><rect x="1070" y="266" width="8" height="12"/>' +
    '</g>' +
    /* циферблат */
    '<circle cx="840" cy="106" r="17" fill="#f6e6b4"/>' +
    '<circle cx="840" cy="106" r="17" fill="none" stroke="#080d14" stroke-width="3"/>' +
    '<line x1="840" y1="106" x2="840" y2="96" stroke="#080d14" stroke-width="2.5"/>' +
    '<line x1="840" y1="106" x2="847" y2="110" stroke="#080d14" stroke-width="2.5"/>' +
    /* Темза */
    '<rect y="286" width="1200" height="14" fill="#08131c"/>' +
    '<g stroke="rgba(246,230,180,.30)" stroke-width="2">' +
    '<line x1="822" y1="292" x2="862" y2="292"/><line x1="176" y1="296" x2="236" y2="296"/>' +
    '<line x1="520" y1="290" x2="580" y2="290"/></g>' +
    '</svg>';

  var QUOTES = [
    '«Неделя — большой срок в политике.» — расхожая присказка Вестминстера',
    'Пятница, 7:40 утра. Пресса уже стоит под дверью штаба.',
    'Ящики для голосования опечатаны. Осталось убедить страну.',
    'На Даунинг-стрит переносят мебель — на всякий случай.',
    'Автобус кампании заправлен. Маршрут — вся страна.'
  ];

  function crumbs(menu) {
    var steps = [
      { id: 'role', label: 'Роль' },
      { id: 'party', label: 'Партия' },
      { id: 'setup', label: 'Кампания' }
    ];
    var order = ['role', 'party', 'custom', 'setup'];
    var current = order.indexOf(menu.step);
    return '<div class="crumbs">' + steps.map(function (s, i) {
      var stepIndex = order.indexOf(s.id === 'party' ? 'party' : s.id);
      var cls = (menu.step === s.id || (s.id === 'party' && menu.step === 'custom')) ? 'now'
        : (current > stepIndex ? 'done' : '');
      return '<span class="crumb ' + cls + '">' + (i + 1) + '. ' + s.label + '</span>';
    }).join('<span class="crumb-sep">›</span>') + '</div>';
  }

  /* ---------- заставка ---------- */

  function renderHome(menu) {
    return '<div class="hero">' + SKYLINE + '<div class="hero-scrim"></div>' +
      '<div class="hero-inner">' +
      '<div class="flag"><span></span><span></span><span></span></div>' +
      '<div class="hero-emblem">' + PP.Chamber.portcullis(58, '#d4af37') + '</div>' +
      '<h1 class="game-title">The Political Process</h1>' +
      '<div class="game-sub">BRITAIN · всеобщие выборы · 650 округов · бета 1.0</div>' +
      '<div class="quote">' + esc(menu.quote || QUOTES[0]) + '</div>' +
      '<div class="hero-actions">' +
      '<button class="primary big" data-m="new">Новая кампания</button>' +
      (PP.hasSave() ? '<button class="big" data-m="continue">Продолжить</button>' : '') +
      '<button class="big" data-m="quick">Быстрый старт</button>' +
      '<button class="ghost big" data-m="rules">Правила</button>' +
      '</div>' +
      '</div></div>' +
      '<div class="home-cards">' +
      homeCard('🗳️', 'Мажоритарная система', 'В каждом из 650 округов побеждает первый. Ровный результат по стране почти не даёт мандатов — важна концентрация.') +
      homeCard('🎭', 'Пять ролей', 'Лидер, руководитель кампании, казначей, парламентский организатор, пресс-секретарь. У каждого свои рычаги.') +
      homeCard('🏴', 'Своя партия', 'Название, цвет, коалиция избирателей, программа по девяти темам и лидер под ваш стиль игры.') +
      '</div>' +
      '<div class="footer-note">Сценарий вымышленный: партии, регионы и система выборов узнаваемы, но лидеры, округа, газеты и стартовые цифры придуманы для игры.</div>';
  }

  function homeCard(icon, title, text) {
    return '<div class="home-card"><div class="hc-icon">' + icon + '</div><h3>' + esc(title) + '</h3><p>' + esc(text) + '</p></div>';
  }

  /* ---------- роль ---------- */

  function renderRole(menu) {
    var cards = PP.ROLES.map(function (r) {
      return '<div class="pick-card' + (menu.role === r.id ? ' selected' : '') + '" data-m="role" data-id="' + r.id + '">' +
        '<div class="pick-head"><span class="pick-icon">' + r.icon + '</span>' +
        '<div><div class="pick-name">' + esc(r.name) + '</div><div class="pick-en">' + esc(r.en) + '</div></div></div>' +
        '<p class="pick-desc">' + esc(r.desc) + '</p>' +
        '<ul class="perks">' + r.perks.map(function (p) { return '<li>' + esc(p) + '</li>'; }).join('') + '</ul>' +
        (r.flavour ? '<div class="pick-quote">' + esc(r.flavour) + '</div>' : '') +
        '</div>';
    }).join('');
    return section('Кто вы в партии?', 'Роль меняет не партию, а то, чем вы можете на неё влиять.', menu,
      '<div class="pick-grid">' + cards + '</div>',
      [{ m: 'home', label: '← Назад', cls: 'ghost' }, { m: 'to-party', label: 'Дальше: партия →', cls: 'primary' }]);
  }

  /* ---------- партия ---------- */

  function renderParty(menu) {
    var cards = PP.PARTIES.filter(function (p) { return p.playable && p.id !== 'own'; }).map(function (p) {
      var goals = p.goals || [];
      return '<div class="pick-card party' + (menu.party === p.id ? ' selected' : '') + '" style="--pc:' + p.color + '" data-m="party" data-id="' + p.id + '">' +
        '<div class="pick-head">' + rosette(p.color, 34) +
        '<div><div class="pick-name" style="color:' + p.color + '">' + esc(p.name) + '</div>' +
        '<div class="pick-en">' + esc(p.ru) + (p.scope !== 'gb' ? ' · только ' + (p.scope === 'scotland' ? 'Шотландия' : 'Уэльс') : '') + '</div></div></div>' +
        '<p class="pick-desc">' + esc(p.blurb) + '</p>' +
        '<div class="stat-line">' +
        '<span>Касса<b>' + money(p.funds) + '</b></span>' +
        '<span>Актив<b>' + p.activists + '</b></span>' +
        '<span>Единство<b>' + p.unity + '</b></span>' +
        '</div>' +
        '<div class="leader-line">' + esc(p.leader.name) + ' · харизма ' + p.leader.charisma +
        ' · компетентность ' + p.leader.competence + ' · порядочность ' + p.leader.integrity + '</div>' +
        (goals.length ? '<div class="goal-line">Ступени: ' + goals.map(function (g) { return g.seats; }).join(' → ') + ' мандатов</div>' : '') +
        '</div>';
    }).join('');

    var own = menu.customDef;
    var ownCard = '<div class="pick-card party own' + (menu.party === 'own' ? ' selected' : '') + '" style="--pc:' + (own ? own.color : '#a35cff') + '" data-m="custom-open">' +
      '<div class="pick-head">' + rosette(own ? own.color : '#a35cff', 34) +
      '<div><div class="pick-name">' + (own ? esc(own.name) : 'Создать свою партию') + '</div>' +
      '<div class="pick-en">' + (own ? esc(own.ru) + ' · ' + own.abbr : 'название, цвет, программа, лидер') + '</div></div></div>' +
      '<p class="pick-desc">' + (own ? esc(own.blurb) : 'Соберите партию с нуля: коалиция избирателей, девять тем программы, ресурсы и лидер под ваш стиль игры.') + '</p>' +
      '<div class="goal-line">' + (own ? 'Открыть конструктор ещё раз' : 'Открыть конструктор') + '</div></div>';

    return section('За кого играем?', 'Стартовые цифры — вымышленный сценарий кануна выборов.', menu,
      '<div class="pick-grid">' + cards + ownCard + '</div>',
      [{ m: 'to-role', label: '← Роль', cls: 'ghost' }, { m: 'to-setup', label: 'Дальше: кампания →', cls: 'primary' }]);
  }

  /* ---------- конструктор партии ---------- */

  function renderCustom(menu) {
    var cfg = menu.custom;
    var def = PP.buildCustomParty(cfg);
    var arch = PP.ARCHETYPE_BY_ID[cfg.archetype];
    var spent = PP.leaderPointsSpent(cfg);
    var left = PP.LEADER_POOL - spent;

    var archCards = PP.ARCHETYPES.map(function (a) {
      return '<div class="mini-card' + (cfg.archetype === a.id ? ' selected' : '') + '" data-m="arch" data-id="' + a.id + '">' +
        '<div class="mini-head">' + a.icon + ' ' + esc(a.name) + '</div>' +
        '<p>' + esc(a.desc) + '</p>' +
        '<div class="mini-stat">старт ≈ ' + a.share + '% · концентрация голосов ' +
        (a.concentration > 0.5 ? 'высокая' : a.concentration > 0.3 ? 'средняя' : 'низкая') + '</div></div>';
    }).join('');

    var resCards = PP.CUSTOM_RESOURCES.map(function (r) {
      return '<div class="mini-card' + (cfg.resources === r.id ? ' selected' : '') + '" data-m="res" data-id="' + r.id + '">' +
        '<div class="mini-head">' + r.icon + ' ' + esc(r.name) + '</div><p>' + esc(r.desc) + '</p></div>';
    }).join('');

    var sliders = PP.ISSUES.map(function (i) {
      return '<div class="slider-row">' +
        '<div class="slider-head"><b>' + esc(i.name) + '</b><span id="pv-' + i.id + '" class="slider-val">' + cfg.positions[i.id] + '</span></div>' +
        '<input type="range" min="-100" max="100" step="5" value="' + cfg.positions[i.id] + '" data-pos="' + i.id + '">' +
        '<div class="scale-labels"><span>' + esc(i.leftLabel) + '</span><span>' + esc(i.rightLabel) + '</span></div>' +
        '</div>';
    }).join('');

    var stats = [
      { id: 'charisma', label: 'Харизма', hint: 'митинги, интервью, дебаты' },
      { id: 'competence', label: 'Компетентность', hint: 'ролики, детали программы' },
      { id: 'integrity', label: 'Порядочность', hint: 'скандалы и доверие' }
    ].map(function (st) {
      var v = cfg.leader[st.id];
      return '<div class="stat-alloc"><div><b>' + st.label + '</b><span class="hint"> — ' + st.hint + '</span></div>' +
        '<div class="alloc-controls"><button data-m="stat" data-id="' + st.id + '" data-d="-5">−</button>' +
        '<span class="alloc-val" id="lv-' + st.id + '">' + v + '</span>' +
        '<button data-m="stat" data-id="' + st.id + '" data-d="5">+</button></div></div>';
    }).join('');

    var preview = '<div class="preview-card" style="--pc:' + def.color + '">' +
      '<div class="pick-head">' + rosette(def.color, 40) +
      '<div><div class="pick-name" style="color:' + def.color + '">' + esc(def.name) + '</div>' +
      '<div class="pick-en">' + esc(def.ru) + ' · ' + esc(def.abbr) + ' · ' +
      (def.scope === 'gb' ? 'вся Великобритания' : def.scope === 'scotland' ? 'только Шотландия' : 'только Уэльс') + '</div></div></div>' +
      '<div class="stat-line"><span>Касса<b>' + money(def.funds) + '</b></span>' +
      '<span>Актив<b>' + def.activists + '</b></span><span>Единство<b>' + def.unity + '</b></span></div>' +
      '<div class="leader-line">' + esc(def.leader.name) + ' · рейтинг ' + (def.leader.approval > 0 ? '+' : '') + def.leader.approval + '</div>' +
      '<div class="goal-line">Ступени целей: ' + def.goals.map(function (g) { return g.seats; }).join(' → ') + ' мандатов</div>' +
      '<div class="goal-line">Ядро избирателя: ' + esc(arch.name) + '</div>' +
      '</div>';

    var body =
      '<div class="builder">' +
      '<div class="builder-col">' +
      '<div class="panel"><h3>Название и цвет</h3>' +
      '<div class="field-row"><label>Английское название<input type="text" data-cf="name" value="' + esc(cfg.name) + '" maxlength="40"></label>' +
      '<label>Как её зовут по-русски<input type="text" data-cf="ru" value="' + esc(cfg.ru) + '" maxlength="40"></label></div>' +
      '<div class="field-row"><label>Аббревиатура<input type="text" data-cf="abbr" value="' + esc(cfg.abbr) + '" maxlength="4" size="6"></label>' +
      '<label>Цвет розетки<input type="color" data-cf="color" value="' + esc(cfg.color) + '"></label>' +
      (arch.regional ? '<label>Нация<select data-cf="scope">' +
        '<option value="scotland"' + (cfg.scope === 'scotland' ? ' selected' : '') + '>Шотландия</option>' +
        '<option value="wales"' + (cfg.scope === 'wales' ? ' selected' : '') + '>Уэльс</option></select></label>' : '') +
      '</div></div>' +
      '<div class="panel"><h3>Коалиция избирателей <span class="hint">кто за вас голосует</span></h3><div class="mini-grid">' + archCards + '</div></div>' +
      '<div class="panel"><h3>Ресурсы партии</h3><div class="mini-grid">' + resCards + '</div></div>' +
      '<div class="panel"><h3>Лидер <span class="hint">осталось очков: <b id="pool-left">' + left + '</b> из ' + PP.LEADER_POOL + '</span></h3>' +
      '<label class="wide">Имя лидера<input type="text" data-cf="leaderName" value="' + esc(cfg.leader.name) + '" maxlength="40"></label>' +
      stats + '</div>' +
      '</div>' +
      '<div class="builder-col">' +
      '<div class="panel"><h3>Как это выглядит</h3>' + preview + '</div>' +
      '<div class="panel"><h3>Программа <span class="hint">девять тем, шкала от левого полюса к правому</span></h3>' + sliders + '</div>' +
      '</div></div>';

    return section('Своя партия', 'Партия появится в бюллетене по всей стране и отберёт голоса у идеологически близких соперников.', menu, body,
      [{ m: 'to-party', label: '← К списку партий', cls: 'ghost' },
       { m: 'custom-random', label: '🎲 Случайная партия', cls: '' },
       { m: 'custom-done', label: 'Взять эту партию →', cls: 'primary' }]);
  }

  /* ---------- настройки ---------- */

  function renderSetup(menu) {
    var role = PP.ROLE_BY_ID[menu.role];
    var party = menu.party === 'own' ? menu.customDef : PP.PARTY_BY_ID[menu.party];
    var diffCards = Object.keys(PP.DIFFICULTY).map(function (k) {
      var d = PP.DIFFICULTY[k];
      var hint = k === 'easy' ? 'Соперники осторожны, касса больше, +1 очко расписания.'
        : k === 'normal' ? 'Честная гонка без поблажек.'
        : 'Соперники играют жёстко, денег меньше.';
      return '<div class="mini-card' + (menu.difficulty === k ? ' selected' : '') + '" data-m="diff" data-id="' + k + '">' +
        '<div class="mini-head">' + esc(d.label) + '</div><p>' + hint + '</p></div>';
    }).join('');

    var weekChips = [6, 9, 12, 16].map(function (w) {
      return '<button class="chip' + (menu.weeks === w ? ' active' : '') + '" data-m="weeks" data-id="' + w + '">' + w + ' недель</button>';
    }).join('');

    var summary = '<div class="summary">' +
      '<div class="sum-item"><span class="k">Роль</span><span class="v">' + role.icon + ' ' + esc(role.name) + '</span></div>' +
      '<div class="sum-item"><span class="k">Партия</span><span class="v">' + rosette(party.color, 22) + ' ' + esc(party.ru) + '</span></div>' +
      '<div class="sum-item"><span class="k">Лидер</span><span class="v">' + esc(party.leader.name) + '</span></div>' +
      '<div class="sum-item"><span class="k">Первая цель</span><span class="v">' +
      ((party.goals && party.goals[0]) ? party.goals[0].seats + ' мандатов — «' + esc(party.goals[0].label) + '»' : party.target + '+ мандатов') + '</span></div>' +
      '</div>';

    var body = '<div class="panel"><h3>Сложность</h3><div class="mini-grid">' + diffCards + '</div></div>' +
      '<div class="panel"><h3>Длина кампании</h3><div class="chips">' + weekChips + '</div>' +
      '<p class="hint">Короткая кампания — меньше ходов и меньше времени вытащить отставание.</p></div>' +
      '<div class="panel"><h3>Зерно генерации <span class="hint">одинаковое зерно даёт одинаковую нарезку округов</span></h3>' +
      '<input type="text" id="inp-seed" value="' + esc(menu.seed || '') + '" placeholder="оставьте пустым для случайного"></div>' +
      '<div class="panel"><h3>Ваш выбор</h3>' + summary + '</div>';

    return section('Кампания', 'Последний шаг перед роспуском парламента.', menu, body,
      [{ m: 'to-party', label: '← Партия', cls: 'ghost' }, { m: 'start', label: 'Начать кампанию', cls: 'primary' }]);
  }

  function section(title, sub, menu, body, buttons) {
    return '<div class="menu-screen">' +
      '<div class="menu-head">' + crumbs(menu) +
      '<h1>' + esc(title) + '</h1><div class="game-sub">' + esc(sub) + '</div></div>' +
      body +
      '<div class="menu-actions">' + buttons.map(function (b) {
        return '<button class="' + (b.cls || '') + '" data-m="' + b.m + '">' + esc(b.label) + '</button>';
      }).join('') + '</div></div>';
  }

  function render(menu) {
    if (menu.step === 'role') return renderRole(menu);
    if (menu.step === 'party') return renderParty(menu);
    if (menu.step === 'custom') return renderCustom(menu);
    if (menu.step === 'setup') return renderSetup(menu);
    return renderHome(menu);
  }

  /* ---------- изменения конфигурации ---------- */

  function randomCustom(menu, rng) {
    var arch = rng.pick(PP.ARCHETYPES);
    var res = rng.pick(PP.CUSTOM_RESOURCES);
    var names = [['New Britain Party', 'Новая Британия', 'NBP'], ['The Peoples Alliance', 'Народный альянс', 'TPA'],
      ['Common Sense Party', 'Партия здравого смысла', 'CSP'], ['Britain Forward', 'Британия вперёд', 'BFW'],
      ['The Reform League', 'Лига реформ', 'TRL'], ['Union & Country', 'Союз и страна', 'UNC'],
      ['Workers Voice', 'Голос труда', 'WKV'], ['The Green Commons', 'Зелёная община', 'GRC']];
    var leaders = ['Маргарет Эйнсли', 'Дункан Фэрбёрн', 'Приа Наир', 'Оуэн Бересфорд', 'Кларисса Дав',
      'Тарик Мансур', 'Ирис Голдинг', 'Хэмиш Крейг'];
    var colors = ['#a35cff', '#ff7a45', '#2ec4b6', '#e94f8a', '#7ac74f', '#f2c14e', '#4d7cff'];
    var n = rng.pick(names);
    var cfg = PP.defaultCustomConfig();
    cfg.name = n[0]; cfg.ru = n[1]; cfg.abbr = n[2];
    cfg.color = rng.pick(colors);
    cfg.archetype = arch.id;
    cfg.resources = res.id;
    cfg.scope = rng.chance(0.5) ? 'scotland' : 'wales';
    cfg.leader.name = rng.pick(leaders);
    var pool = PP.LEADER_POOL;
    var a = rng.int(30, 80), b = rng.int(30, Math.min(80, pool - a - 25));
    cfg.leader.charisma = a;
    cfg.leader.competence = b;
    cfg.leader.integrity = clamp(pool - a - b, PP.LEADER_MIN, PP.LEADER_MAX);
    PP.ISSUE_IDS.forEach(function (id) {
      cfg.positions[id] = Math.round(rng.range(-90, 90) / 5) * 5;
    });
    if (arch.family === 'left') { cfg.positions.nhs = -Math.abs(cfg.positions.nhs); cfg.positions.tax = -Math.abs(cfg.positions.tax); }
    if (arch.family === 'right') { cfg.positions.tax = Math.abs(cfg.positions.tax); }
    if (arch.regional) cfg.positions.union = -100;
    menu.custom = cfg;
    menu.customDef = PP.buildCustomParty(cfg);
  }

  function setStat(menu, id, delta) {
    var cfg = menu.custom;
    var next = clamp(cfg.leader[id] + delta, PP.LEADER_MIN, PP.LEADER_MAX);
    var spentOthers = PP.leaderPointsSpent(cfg) - cfg.leader[id];
    if (spentOthers + next > PP.LEADER_POOL) next = PP.LEADER_POOL - spentOthers;
    cfg.leader[id] = clamp(next, PP.LEADER_MIN, PP.LEADER_MAX);
    menu.customDef = PP.buildCustomParty(cfg);
  }

  /*
   * Обработка клика в меню. Возвращает 'render', 'start', 'continue',
   * 'rules' или null — решение принимает ui.js.
   */
  function handleClick(menu, target) {
    var node = target.closest ? target.closest('[data-m]') : null;
    if (!node) return null;
    var m = node.dataset.m, id = node.dataset.id;
    switch (m) {
      case 'new': menu.step = 'role'; return 'render';
      case 'quick': return 'quick';
      case 'continue': return 'continue';
      case 'rules': return 'rules';
      case 'home': menu.step = 'home'; return 'render';
      case 'role': menu.role = id; return 'render';
      case 'to-role': menu.step = 'role'; return 'render';
      case 'to-party': menu.step = 'party'; return 'render';
      case 'to-setup': menu.step = 'setup'; return 'render';
      case 'party': menu.party = id; return 'render';
      case 'custom-open':
        menu.custom = menu.custom || PP.defaultCustomConfig();
        menu.customDef = PP.buildCustomParty(menu.custom);
        menu.step = 'custom';
        return 'render';
      case 'custom-random':
        randomCustom(menu, new PP.Rng('rnd:' + Math.random()));
        return 'render';
      case 'custom-done':
        menu.customDef = PP.buildCustomParty(menu.custom);
        menu.party = 'own';
        menu.step = 'setup';
        return 'render';
      case 'arch':
        menu.custom.archetype = id;
        menu.customDef = PP.buildCustomParty(menu.custom);
        return 'render';
      case 'res':
        menu.custom.resources = id;
        menu.customDef = PP.buildCustomParty(menu.custom);
        return 'render';
      case 'stat': setStat(menu, id, parseInt(node.dataset.d, 10)); return 'render';
      case 'diff': menu.difficulty = id; return 'render';
      case 'weeks': menu.weeks = parseInt(id, 10); return 'render';
      case 'start': return 'start';
      default: return null;
    }
  }

  /* Ввод текста и ползунков: без перерисовки, чтобы не терять фокус. */
  function handleInput(menu, target, doc) {
    if (target.dataset && target.dataset.pos) {
      var v = parseInt(target.value, 10);
      menu.custom.positions[target.dataset.pos] = v;
      var label = doc.getElementById('pv-' + target.dataset.pos);
      if (label) label.textContent = v;
      menu.customDef = PP.buildCustomParty(menu.custom);
      return true;
    }
    var f = target.dataset && target.dataset.cf;
    if (!f) return false;
    if (f === 'leaderName') menu.custom.leader.name = target.value;
    else if (f === 'scope') menu.custom.scope = target.value;
    else if (f === 'abbr') menu.custom.abbr = target.value.toUpperCase();
    else menu.custom[f] = target.value;
    menu.customDef = PP.buildCustomParty(menu.custom);
    return true;
  }

  function newMenu() {
    return {
      step: 'home',
      role: 'leader',
      party: 'lab',
      custom: null,
      customDef: null,
      difficulty: 'normal',
      weeks: 12,
      seed: '',
      quote: QUOTES[Math.floor(Math.random() * QUOTES.length)]
    };
  }

  PP.Menu = {
    render: render,
    handleClick: handleClick,
    handleInput: handleInput,
    newMenu: newMenu,
    randomCustom: randomCustom,
    rosette: rosette,
    QUOTES: QUOTES
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
