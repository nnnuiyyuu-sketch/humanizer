/*
 * Своя партия. Игрок задаёт название, цвет, базовую коалицию избирателей,
 * позиции по темам и лидера; отсюда собирается полноценное описание партии
 * и её стартовые доли отбираются у идеологически близких соперников.
 */
(function (root) {
  'use strict';

  var PP = root.PP;
  var clamp = PP.clamp;

  /* Базовая коалиция избирателей: кто за вас голосует и насколько плотно. */
  var ARCHETYPES = [
    {
      id: 'populist', name: 'Народный фронт', icon: '📣',
      desc: 'Малые города, промышленные окраины, недоверие к Лондону. Голоса размазаны по стране — мажоритарная система таких не любит.',
      family: 'right', concentration: 0.13, share: 7,
      affinity: { urban: -0.30, degree: -0.75, age: 0.35, leave: 0.85, prosperity: -0.35 },
      funds: 3.0, activists: 26, unity: 58
    },
    {
      id: 'liberal', name: 'Городские либералы', icon: '🎓',
      desc: 'Университетские города, зажиточные пригороды, проевропейский избиратель. Голоса собраны плотно — округа берутся точечно.',
      family: 'centre', concentration: 0.62, share: 5,
      affinity: { urban: 0.25, degree: 0.80, age: -0.15, leave: -0.70, prosperity: 0.30 },
      funds: 4.0, activists: 34, unity: 76
    },
    {
      id: 'labourist', name: 'Рабочее движение', icon: '⚒️',
      desc: 'Профсоюзы, большие города, север Англии и Уэльс. Много волонтёров, мало денег.',
      family: 'left', concentration: 0.34, share: 6,
      affinity: { urban: 0.55, degree: -0.05, age: -0.20, leave: 0.10, prosperity: -0.60 },
      funds: 2.2, activists: 52, unity: 66
    },
    {
      id: 'shire', name: 'Консервативная провинция', icon: '🌾',
      desc: 'Графства, деревни, пожилой и зажиточный избиратель. Хорошие деньги и плотная география.',
      family: 'right', concentration: 0.40, share: 6,
      affinity: { urban: -0.65, degree: -0.05, age: 0.65, leave: 0.30, prosperity: 0.45 },
      funds: 5.5, activists: 24, unity: 70
    },
    {
      id: 'green', name: 'Экологическое движение', icon: '🌱',
      desc: 'Молодые, образованные, городские районы и университетские кварталы. Мало кассы, много энтузиазма.',
      family: 'left', concentration: 0.72, share: 4,
      affinity: { urban: 0.35, degree: 0.80, age: -0.55, leave: -0.65, prosperity: -0.05 },
      funds: 1.4, activists: 46, unity: 78
    },
    {
      id: 'national', name: 'Национальное движение', icon: '🏴',
      desc: 'Партия одной нации Союза: выдвигается только в Шотландии или Уэльсе, зато сразу за треть тамошних голосов.',
      family: 'left', concentration: 0.28, share: 22, regional: true,
      affinity: { urban: 0.15, degree: 0.10, age: -0.05, leave: -0.40, prosperity: -0.25 },
      funds: 2.0, activists: 42, unity: 68
    }
  ];

  var ARCH_BY_ID = {};
  ARCHETYPES.forEach(function (a) { ARCH_BY_ID[a.id] = a; });

  var RESOURCES = [
    { id: 'grassroots', name: 'Низовая сеть', icon: '🚪', desc: 'Отделения по всей стране, тысячи волонтёров, пустая касса.', funds: 0.45, activists: 1.6, unity: 1.05 },
    { id: 'balanced', name: 'Обычная партия', icon: '⚖️', desc: 'Ни бедные, ни богатые: всего поровну.', funds: 1.0, activists: 1.0, unity: 1.0 },
    { id: 'donors', name: 'Крупные доноры', icon: '💷', desc: 'Несколько щедрых спонсоров, слабая сетка на местах и вопросы от прессы.', funds: 2.2, activists: 0.55, unity: 0.95 }
  ];

  var RES_BY_ID = {};
  RESOURCES.forEach(function (r) { RES_BY_ID[r.id] = r; });

  var DEFAULT_POSITIONS = { cost: 0, nhs: -20, immig: 0, tax: 0, housing: -10, crime: 10, climate: -10, europe: 0, union: 40 };

  function defaultConfig() {
    return {
      id: 'own',
      name: 'New Britain Party',
      ru: 'Новая партия',
      abbr: 'NEW',
      color: '#a35cff',
      archetype: 'populist',
      resources: 'balanced',
      scope: 'gb',
      positions: JSON.parse(JSON.stringify(DEFAULT_POSITIONS)),
      leader: { name: 'Дж. Уиллоуби', charisma: 60, competence: 60, integrity: 60 }
    };
  }

  var LEADER_POOL = 180;
  var LEADER_MIN = 25;
  var LEADER_MAX = 85;

  function leaderSpent(cfg) {
    return cfg.leader.charisma + cfg.leader.competence + cfg.leader.integrity;
  }

  /* Полное описание партии из конфигурации конструктора. */
  function buildDef(cfg) {
    var arch = ARCH_BY_ID[cfg.archetype] || ARCHETYPES[0];
    var res = RES_BY_ID[cfg.resources] || RESOURCES[1];
    var scope = arch.regional ? (cfg.scope === 'wales' ? 'wales' : 'scotland') : 'gb';
    var competence = {};
    PP.ISSUE_IDS.forEach(function (id) {
      /* Новая партия по умолчанию считается менее компетентной, но там, где
         у неё внятная позиция, избиратель ей чуть больше верит. */
      competence[id] = clamp(34 + Math.abs(cfg.positions[id]) / 12 + (cfg.leader.competence - 50) / 5, 20, 70);
    });
    var goals = arch.regional
      ? [{ seats: 2, label: 'Первые депутаты' }, { seats: 8, label: 'Голос нации в Вестминстере' }, { seats: 18, label: 'Хозяева своей нации' }, { seats: 30, label: 'Мандат на референдум' }]
      : [{ seats: 3, label: 'Первые депутаты' }, { seats: 15, label: 'Полноценная фракция' }, { seats: 45, label: 'Третья сила Палаты' }, { seats: 100, label: 'Слом двухпартийной системы' }];

    return {
      id: 'own',
      custom: true,
      name: cfg.name || 'New Party',
      ru: cfg.ru || cfg.name || 'Своя партия',
      abbr: (cfg.abbr || 'NEW').toUpperCase().slice(0, 4),
      color: cfg.color || '#a35cff',
      playable: true,
      scope: scope,
      family: arch.family,
      archetype: arch.id,
      leader: {
        name: cfg.leader.name || 'Лидер',
        charisma: cfg.leader.charisma,
        competence: cfg.leader.competence,
        integrity: cfg.leader.integrity,
        approval: Math.round((cfg.leader.charisma + cfg.leader.integrity) / 2 - 52)
      },
      funds: Math.round(arch.funds * res.funds * 10) / 10,
      activists: Math.round(clamp(arch.activists * res.activists, 5, 95)),
      unity: Math.round(clamp(arch.unity * res.unity, 20, 95)),
      target: goals[1].seats,
      goals: goals,
      positions: JSON.parse(JSON.stringify(cfg.positions)),
      competence: competence,
      affinity: arch.affinity,
      concentration: arch.concentration,
      baseShare: arch.share,
      blurb: arch.desc
    };
  }

  /* Регистрация в общих справочниках: без этого партию не увидят остальные модули. */
  function register(def) {
    if (!def) return;
    PP.PARTY_BY_ID[def.id] = def;
    var i = PP.PARTIES.map(function (p) { return p.id; }).indexOf(def.id);
    if (i >= 0) PP.PARTIES[i] = def; else PP.PARTIES.push(def);
    if (PP.GB_PARTY_IDS.indexOf(def.id) < 0) PP.GB_PARTY_IDS.push(def.id);
  }

  function unregister(id) {
    delete PP.PARTY_BY_ID[id];
    PP.PARTIES = PP.PARTIES.filter(function (p) { return p.id !== id; });
    PP.GB_PARTY_IDS = PP.GB_PARTY_IDS.filter(function (p) { return p !== id; });
  }

  /*
   * Стартовые доли по регионам с учётом новой партии: её голоса отбираются
   * у идеологически близких соперников, а не берутся из воздуха.
   */
  function buildBases(def) {
    var bases = {};
    PP.CAMPAIGN_REGIONS.forEach(function (region) {
      var base = {};
      Object.keys(region.base).forEach(function (pid) { base[pid] = region.base[pid]; });
      if (def) {
        var inScope = def.scope === 'gb'
          || (def.scope === 'scotland' && region.id === 'scotland')
          || (def.scope === 'wales' && region.id === 'wales');
        if (inScope) {
          /* Насколько регион вообще подходит партии: демография против её ядра. */
          var fit = 1;
          var aff = def.affinity;
          ['age', 'degree', 'leave', 'urban', 'prosperity'].forEach(function (a) {
            fit += (aff[a] || 0) * ((region.demo[a] - 50) / 100);
          });
          var want = clamp(def.baseShare * clamp(fit, 0.35, 1.9), 0.8, 40);
          var weights = {}, wsum = 0;
          Object.keys(base).forEach(function (pid) {
            var dist = PP.ideologyDistance(def.id, pid);
            var w = base[pid] * Math.exp(-dist / 38);
            weights[pid] = w;
            wsum += w;
          });
          if (wsum > 0) {
            Object.keys(base).forEach(function (pid) {
              base[pid] = Math.max(base[pid] - want * (weights[pid] / wsum), 0.4);
            });
          }
          base[def.id] = want;
        }
      }
      var total = 0;
      Object.keys(base).forEach(function (pid) { total += base[pid]; });
      Object.keys(base).forEach(function (pid) { base[pid] = base[pid] / total * 100; });
      bases[region.id] = base;
    });
    return bases;
  }

  PP.ARCHETYPES = ARCHETYPES;
  PP.ARCHETYPE_BY_ID = ARCH_BY_ID;
  PP.CUSTOM_RESOURCES = RESOURCES;
  PP.defaultCustomConfig = defaultConfig;
  PP.buildCustomParty = buildDef;
  PP.registerCustomParty = register;
  PP.unregisterCustomParty = unregister;
  PP.buildBases = buildBases;
  PP.LEADER_POOL = LEADER_POOL;
  PP.LEADER_MIN = LEADER_MIN;
  PP.LEADER_MAX = LEADER_MAX;
  PP.leaderPointsSpent = leaderSpent;
})(typeof globalThis !== 'undefined' ? globalThis : this);
