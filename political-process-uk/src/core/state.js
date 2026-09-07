/* Создание, сохранение и загрузка состояния игры. */
(function (root) {
  'use strict';

  var PP = root.PP;
  var SAVE_KEY = 'pp-uk-save-v1';
  var VERSION = '1.0.0-beta';

  var DIFFICULTY = {
    easy: { label: 'Заднескамеечник', aiSkill: 0.6, fundsMult: 1.35, apBonus: 1 },
    normal: { label: 'Министр теневого кабинета', aiSkill: 1.0, fundsMult: 1.0, apBonus: 0 },
    hard: { label: 'Кандидат в премьеры', aiSkill: 1.35, fundsMult: 0.8, apBonus: 0 }
  };

  function deepCopy(o) { return JSON.parse(JSON.stringify(o)); }

  function makePartyState(def, diff, isPlayer) {
    return {
      id: def.id,
      positions: deepCopy(def.positions),
      corePositions: deepCopy(def.positions),
      competence: deepCopy(def.competence),
      leader: deepCopy(def.leader),
      funds: def.funds * (isPlayer ? diff.fundsMult : 1),
      activists: def.activists,
      unity: def.unity,
      momentum: 0,
      scandal: 0,
      spent: 0,
      broadcastsLeft: 5,
      history: []
    };
  }

  function makeNiSeats(rng) {
    var seats = [];
    var names = ['Белфаст-Север', 'Белфаст-Юг', 'Белфаст-Восток', 'Белфаст-Запад', 'Северный Даун',
      'Южный Даун', 'Ньюри и Арма', 'Фермана и Южный Тирон', 'Средний Ольстер', 'Восточный Лондондерри',
      'Фойл', 'Западный Тирон', 'Ларн и Антрим', 'Северный Антрим', 'Южный Антрим', 'Восточный Антрим',
      'Стрэнгфорд', 'Аппер-Банн'];
    var pool = [];
    PP.NI_PARTIES.forEach(function (p) {
      for (var i = 0; i < p.base; i++) pool.push(p.id);
    });
    while (pool.length < 18) pool.push('apni');
    pool = rng.shuffle(pool).slice(0, 18);
    for (var i = 0; i < 18; i++) {
      seats.push({ id: 'ni-' + i, name: names[i], region: 'n_ireland', party: pool[i] });
    }
    return seats;
  }

  function newGame(opts) {
    opts = opts || {};
    var seed = opts.seed || String(Date.now());
    var diff = DIFFICULTY[opts.difficulty || 'normal'];
    var rng = new PP.Rng('init:' + seed);

    /* Своя партия регистрируется до всего остального: её должны видеть
       генератор округов, модель поддержки и соперники. */
    PP.unregisterCustomParty('own');
    var customDef = null;
    if (opts.custom) {
      customDef = PP.buildCustomParty(opts.custom);
      PP.registerCustomParty(customDef);
    }
    var role = PP.ROLE_BY_ID[opts.role || 'leader'] || PP.ROLE_BY_ID.leader;

    var state = {
      version: VERSION,
      seed: seed,
      difficulty: opts.difficulty || 'normal',
      difficultyLabel: diff.label,
      aiSkill: diff.aiSkill,
      playerId: opts.playerId || 'lab',
      roleId: role.id,
      roleName: role.name,
      customConfig: opts.custom ? JSON.parse(JSON.stringify(opts.custom)) : null,
      week: 1,
      totalWeeks: opts.weeks || 12,
      phase: 'campaign',
      ap: 0,
      apMax: 4 + diff.apBonus + (role.mods.ap || 0),
      stamina: 100,
      parties: {},
      salience: {},
      effort: {},
      news: [],
      pollHistory: [],
      debatesDone: [],
      pendingEvent: null,
      groundGame: {},
      targeted: {},
      turnLog: [],
      result: null,
      government: null,
      achievements: []
    };

    state.bases = PP.buildBases(customDef);

    PP.PARTIES.forEach(function (def) {
      state.parties[def.id] = makePartyState(def, diff, def.id === state.playerId);
    });
    PP.ISSUES.forEach(function (i) { state.salience[i.id] = i.baseSalience; });
    PP.CAMPAIGN_REGIONS.forEach(function (r) {
      state.effort[r.id] = {};
      Object.keys(state.bases[r.id]).forEach(function (pid) { state.effort[r.id][pid] = 0; });
    });

    /* Бонусы роли получает только партия игрока. */
    var me = state.parties[state.playerId];
    if (me && role.start) {
      if (role.start.funds) me.funds *= role.start.funds;
      if (role.start.unity) me.unity = PP.clamp(me.unity + role.start.unity, 5, 100);
      if (role.start.approval) me.leader.approval = PP.clamp(me.leader.approval + role.start.approval, -80, 80);
    }

    state.seats = PP.generateSeats(seed);
    state.niSeats = makeNiSeats(rng);
    state.ap = state.apMax;

    /* Нотационный расклад «прошлых выборов» — от него считаются приросты. */
    var byRegion = PP.allRegionShares(state);
    PP.assignHolders(state.seats, byRegion);
    state.startingSeats = PP.projectSeats(state, byRegion, { incumbency: 0 });
    state.startingNational = PP.nationalShares(state, byRegion);

    var poll = PP.publishedPoll(state, new PP.Rng('poll:' + seed + ':0'));
    state.pollHistory.push({ week: 0, shares: poll });

    addNews(state, 'Парламент распущен. До дня голосования — ' + state.totalWeeks + ' недель.', 'system');
    addNews(state, 'Вы — ' + role.name.toLowerCase() + ' партии ' + PP.PARTY_BY_ID[state.playerId].ru + '.', 'system');
    return state;
  }

  function addNews(state, text, kind, partyId) {
    state.news.unshift({ week: state.week, text: text, kind: kind || 'news', party: partyId || null });
    if (state.news.length > 120) state.news.pop();
  }

  function save(state) {
    try {
      root.localStorage.setItem(SAVE_KEY, JSON.stringify(state));
      return true;
    } catch (e) {
      return false;
    }
  }

  function load() {
    try {
      var raw = root.localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      var s = JSON.parse(raw);
      if (!s || s.version !== VERSION) return null;
      /* Своя партия живёт в сохранении конфигурацией — пересобираем её. */
      PP.unregisterCustomParty('own');
      if (s.customConfig) PP.registerCustomParty(PP.buildCustomParty(s.customConfig));
      return s;
    } catch (e) {
      return null;
    }
  }

  function clearSave() {
    try { root.localStorage.removeItem(SAVE_KEY); } catch (e) { /* нет хранилища — не беда */ }
  }

  function hasSave() {
    try { return !!root.localStorage.getItem(SAVE_KEY); } catch (e) { return false; }
  }

  PP.VERSION = VERSION;
  PP.DIFFICULTY = DIFFICULTY;
  PP.newGame = newGame;
  PP.addNews = addNews;
  PP.saveGame = save;
  PP.loadGame = load;
  PP.clearSave = clearSave;
  PP.hasSave = hasSave;
})(typeof globalThis !== 'undefined' ? globalThis : this);
