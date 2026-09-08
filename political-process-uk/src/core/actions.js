/*
 * Действия кампании. Каждое действие тратит очко расписания (AP), иногда
 * деньги и силы лидера, и меняет состояние. Эффекты в регионах копятся в
 * state.effort и еженедельно затухают — кампанию нужно поддерживать.
 */
(function (root) {
  'use strict';

  var PP = root.PP;
  var clamp = PP.clamp;

  /* Множитель роли игрока: соперникам роли не достаются. */
  function mod(state, params, key) {
    if (!params || params.partyId !== state.playerId) return 1;
    return PP.roleMod(state, key);
  }

  function addEffort(state, regionId, partyId, value) {
    var r = state.effort[regionId];
    if (!r) return;
    r[partyId] = clamp((r[partyId] || 0) + value, -14, 22);
  }

  function baseOf(state, region) {
    return (state.bases && state.bases[region.id]) || region.base;
  }

  function nationalEffort(state, partyId, value) {
    PP.CAMPAIGN_REGIONS.forEach(function (r) {
      if (baseOf(state, r)[partyId] === undefined) return;
      addEffort(state, r.id, partyId, value);
    });
  }

  function partyScope(partyId) {
    return PP.PARTY_BY_ID[partyId].scope;
  }

  /* Регионы, где партия вообще выдвигается: у своей партии список берётся
     из стартовых долей текущей игры. */
  function regionsFor(state, partyId) {
    var scope = partyScope(partyId);
    return PP.CAMPAIGN_REGIONS.filter(function (r) {
      if (scope === 'scotland') return r.id === 'scotland';
      if (scope === 'wales') return r.id === 'wales';
      return baseOf(state, r)[partyId] !== undefined;
    });
  }

  /* Насколько эффективен лидер прямо сейчас: харизма, силы, скандалы. */
  function leaderForm(ps, stamina) {
    var l = ps.leader;
    return clamp(0.6 + (l.charisma - 50) / 120 + (stamina - 60) / 260 - (ps.scandal || 0) / 160, 0.25, 1.6);
  }

  function marginalSeats(state, regionId, partyId, count) {
    var byRegion = state._cacheRegionShares || PP.allRegionShares(state);
    var shares = byRegion[regionId];
    var scored = state.seats.filter(function (s) { return s.region === regionId; }).map(function (seat) {
      var res = PP.seatResult(seat, shares, { noise: 0 });
      var mine = res.shares[partyId] || 0;
      var best = res.shares[res.winner];
      return { seat: seat, gap: res.winner === partyId ? -(best - res.shares[res.runnerUp]) : (best - mine) };
    });
    scored.sort(function (a, b) { return Math.abs(a.gap) - Math.abs(b.gap); });
    return scored.slice(0, count).map(function (x) { return x.seat; });
  }

  var ACTIONS = [
    {
      id: 'rally',
      name: 'Тур по региону',
      icon: '🎤',
      desc: 'Лидер объезжает регион: митинги, заводы, местная пресса. Сильный, но короткий эффект.',
      ap: 1, cost: 0.12, stamina: 14, needs: 'region',
      run: function (state, p, rng) {
        var ps = state.parties[p.partyId];
        var form = leaderForm(ps, state.stamina);
        var gain = 2.1 * form * rng.range(0.8, 1.2) * mod(state, p, 'rally');
        addEffort(state, p.regionId, p.partyId, gain);
        ps.momentum = clamp(ps.momentum + 0.6 * form, -14, 14);
        return {
          text: 'Митинги в регионе «' + PP.REGION_BY_ID[p.regionId].name + '»: +' + gain.toFixed(1) + ' п.п. в местных опросах.',
          delta: gain
        };
      }
    },
    {
      id: 'ground',
      name: 'Работа на земле',
      icon: '🚪',
      desc: 'Обход квартир, листовки, база сторонников. Эффект скромнее, но держится дольше.',
      ap: 1, cost: 0.05, stamina: 3, needs: 'region',
      run: function (state, p, rng) {
        var ps = state.parties[p.partyId];
        var gain = (0.7 + ps.activists / 45) * rng.range(0.85, 1.15) * mod(state, p, 'ground');
        addEffort(state, p.regionId, p.partyId, gain);
        state.groundGame[p.regionId] = state.groundGame[p.regionId] || {};
        state.groundGame[p.regionId][p.partyId] = (state.groundGame[p.regionId][p.partyId] || 0) + 1;
        return {
          text: 'Активисты обошли округа региона «' + PP.REGION_BY_ID[p.regionId].name + '»: +' + gain.toFixed(1) + ' п.п. и лучше явка сторонников.',
          delta: gain
        };
      }
    },
    {
      id: 'target',
      name: 'Кампания в качающихся округах',
      icon: '🎯',
      desc: 'Все силы — в шесть самых близких округов региона. Голоса не растут по региону, но конвертируются в мандаты.',
      ap: 1, cost: 0.10, stamina: 6, needs: 'region',
      run: function (state, p, rng) {
        var seats = marginalSeats(state, p.regionId, p.partyId, 6);
        var bonus = 0.055 * rng.range(0.8, 1.25) * (1 + state.parties[p.partyId].activists / 200) * mod(state, p, 'target');
        seats.forEach(function (s) {
          s.local[p.partyId] = (s.local[p.partyId] || 0) + bonus;
          state.targeted[s.id] = (state.targeted[s.id] || 0) + 1;
        });
        return {
          text: 'Целевая кампания в округах: ' + seats.map(function (s) { return s.name; }).join(', ') + '.',
          delta: 0
        };
      }
    },
    {
      id: 'broadcast',
      name: 'Партийный ролик',
      icon: '📺',
      desc: 'Общенациональный эфир и реклама в сети. Дорого, зато бьёт по всей стране.',
      ap: 1, cost: 0.35, stamina: 2, needs: 'none',
      available: function (state, partyId) { return state.parties[partyId].broadcastsLeft > 0; },
      unavailableText: 'Эфирное время на эту кампанию исчерпано.',
      run: function (state, p, rng) {
        var ps = state.parties[p.partyId];
        ps.broadcastsLeft--;
        var quality = rng.range(0.7, 1.3) * (0.75 + ps.leader.competence / 200);
        var gain = 0.85 * quality * mod(state, p, 'broadcast');
        nationalEffort(state, p.partyId, gain);
        ps.momentum = clamp(ps.momentum + 1.1 * quality, -14, 14);
        return { text: 'Ролик вышел в эфир: +' + gain.toFixed(1) + ' п.п. по всей стране.', delta: gain };
      }
    },
    {
      id: 'media',
      name: 'Большое интервью',
      icon: '🎙️',
      desc: 'Час в прямом эфире. Может поднять рейтинг лидера, а может стоить кампании недели.',
      ap: 1, cost: 0, stamina: 10, needs: 'none',
      run: function (state, p, rng) {
        var ps = state.parties[p.partyId];
        var roll = (rng.normal((ps.leader.charisma + ps.leader.competence) / 2 - 48, 16) + (state.stamina - 60) / 8) * mod(state, p, 'media');
        if (roll > 22) {
          ps.leader.approval = clamp(ps.leader.approval + 5, -80, 80);
          ps.momentum = clamp(ps.momentum + 2.0, -14, 14);
          return { text: 'Интервью разошлось на цитаты. Рейтинг лидера +5.', delta: 5, tone: 'good' };
        }
        if (roll < -18) {
          ps.leader.approval = clamp(ps.leader.approval - 6, -80, 80);
          ps.momentum = clamp(ps.momentum - 2.2, -14, 14);
          return { text: 'Лидер запутался в цифрах в прямом эфире. Рейтинг -6.', delta: -6, tone: 'bad' };
        }
        ps.leader.approval = clamp(ps.leader.approval + 1, -80, 80);
        return { text: 'Ровное интервью без происшествий. Рейтинг +1.', delta: 1, tone: 'neutral' };
      }
    },
    {
      id: 'fundraise',
      name: 'Ужин с донорами',
      icon: '💷',
      desc: 'Деньги на кампанию. Пресса такие вечера не любит.',
      ap: 1, cost: 0, stamina: 6, needs: 'none',
      run: function (state, p, rng) {
        var ps = state.parties[p.partyId];
        var def = PP.PARTY_BY_ID[p.partyId];
        var appeal = (def.family === 'right' ? 1.25 : def.family === 'centre' ? 1.0 : 0.9);
        var raised = rng.range(0.45, 1.15) * appeal * (0.8 + ps.leader.approval / 200 + ps.unity / 200) * mod(state, p, 'fundraise');
        ps.funds += raised;
        var res = { text: 'Собрано £' + raised.toFixed(2) + ' млн.', delta: raised };
        if (rng.chance(0.14 + (60 - ps.leader.integrity) / 260)) {
          ps.scandal = clamp((ps.scandal || 0) + 12, 0, 100);
          res.text += ' Но журналисты уже спрашивают, кто именно платил за вечер.';
          res.tone = 'bad';
        }
        return res;
      }
    },
    {
      id: 'policy',
      name: 'Заявление о политике',
      icon: '📜',
      desc: 'Сдвинуть позицию партии по теме и поднять её значимость в повестке.',
      ap: 1, cost: 0.03, stamina: 5, needs: 'policy',
      run: function (state, p, rng) {
        var ps = state.parties[p.partyId];
        var issue = PP.ISSUE_BY_ID[p.issueId];
        var dir = p.direction > 0 ? 1 : -1;
        var before = ps.positions[p.issueId];
        ps.positions[p.issueId] = clamp(before + dir * 9, -100, 100);
        state.salience[p.issueId] = clamp(state.salience[p.issueId] + 3.5, 1, 45);
        ps.competence[p.issueId] = clamp(ps.competence[p.issueId] + 2, 0, 95);
        var drift = Math.abs(ps.positions[p.issueId] - ps.corePositions[p.issueId]);
        var unityHit = (drift > 25 ? (drift - 25) / 14 : 0) * mod(state, p, 'policyUnity');
        ps.unity = clamp(ps.unity - unityHit, 5, 100);
        var res = {
          text: 'Новая линия по теме «' + issue.name + '»: ' +
            (dir > 0 ? issue.rightLabel : issue.leftLabel) + '.',
          delta: 0
        };
        if (unityHit > 1.5) {
          res.text += ' Заднескамеечники недовольны: единство партии -' + unityHit.toFixed(0) + '.';
          res.tone = 'bad';
        }
        return res;
      }
    },
    {
      id: 'attack',
      name: 'Негативная кампания',
      icon: '🗡️',
      desc: 'Ударить по конкретному сопернику в конкретном регионе. Иногда прилетает в ответ.',
      ap: 1, cost: 0.15, stamina: 5, needs: 'attack',
      run: function (state, p, rng) {
        var ps = state.parties[p.partyId];
        var target = state.parties[p.targetId];
        var backfire = rng.chance(0.24 - (ps.leader.charisma - 50) / 400);
        if (backfire) {
          addEffort(state, p.regionId, p.partyId, -1.0);
          ps.leader.approval = clamp(ps.leader.approval - 4, -80, 80);
          return {
            text: 'Атака на ' + PP.PARTY_BY_ID[p.targetId].ru + ' выглядела мелочно. Отдача по своим: -1.0 п.п.',
            delta: -1, tone: 'bad'
          };
        }
        var hit = 1.5 * rng.range(0.8, 1.25) * mod(state, p, 'attack');
        addEffort(state, p.regionId, p.targetId, -hit);
        target.leader.approval = clamp(target.leader.approval - 2, -80, 80);
        return {
          text: PP.PARTY_BY_ID[p.targetId].ru + ' теряет ' + hit.toFixed(1) + ' п.п. в регионе «' +
            PP.REGION_BY_ID[p.regionId].name + '».',
          delta: hit, tone: 'good'
        };
      }
    },
    {
      id: 'organise',
      name: 'Набор активистов',
      icon: '🧑‍🤝‍🧑',
      desc: 'Вложиться в сеть отделений. Окупается ближе к дню голосования.',
      ap: 1, cost: 0.08, stamina: 2, needs: 'none',
      run: function (state, p, rng) {
        var ps = state.parties[p.partyId];
        var gain = rng.range(4, 9) * (0.7 + ps.unity / 140) * mod(state, p, 'organise');
        ps.activists = clamp(ps.activists + gain, 0, 100);
        return { text: 'В отделения пришли новые волонтёры: +' + gain.toFixed(0) + ' к сети активистов.', delta: gain };
      }
    },
    {
      id: 'unify',
      name: 'Собрание фракции',
      icon: '🤝',
      desc: 'Успокоить заднескамеечников и погасить утечки в прессу.',
      ap: 1, cost: 0.02, stamina: 6, needs: 'none',
      run: function (state, p, rng) {
        var ps = state.parties[p.partyId];
        var gain = rng.range(5, 11) * mod(state, p, 'unify');
        ps.unity = clamp(ps.unity + gain, 5, 100);
        ps.scandal = clamp((ps.scandal || 0) - 6, 0, 100);
        return { text: 'Фракция притихла: единство +' + gain.toFixed(0) + '.', delta: gain };
      }
    }
  ];

  var BY_ID = {};
  ACTIONS.forEach(function (a) { BY_ID[a.id] = a; });

  function canRun(state, partyId, actionId) {
    var a = BY_ID[actionId];
    var ps = state.parties[partyId];
    if (!a) return { ok: false, why: 'Неизвестное действие.' };
    if (state.phase !== 'campaign') return { ok: false, why: 'Кампания окончена.' };
    if (state.ap < a.ap) return { ok: false, why: 'Не осталось очков расписания на эту неделю.' };
    if (ps.funds < a.cost) return { ok: false, why: 'Не хватает денег: нужно £' + a.cost.toFixed(2) + ' млн.' };
    if (a.available && !a.available(state, partyId)) return { ok: false, why: a.unavailableText || 'Недоступно.' };
    return { ok: true };
  }

  /* Выполнить действие игрока или ИИ. params: {partyId, regionId, issueId, ...} */
  function perform(state, partyId, actionId, params, rng) {
    var a = BY_ID[actionId];
    var ps = state.parties[partyId];
    var p = params || {};
    p.partyId = partyId;
    ps.funds -= a.cost;
    ps.spent += a.cost;
    if (partyId === state.playerId) {
      state.ap -= a.ap;
      state.stamina = clamp(state.stamina - a.stamina * PP.roleMod(state, 'stamina'), 0, 100);
    }
    state._cacheRegionShares = null;
    var out = a.run(state, p, rng);
    out.action = a;
    if (partyId === state.playerId) {
      PP.addNews(state, a.name + ': ' + out.text, out.tone || 'action', partyId);
    }
    return out;
  }

  PP.ACTIONS = ACTIONS;
  PP.ACTION_BY_ID = BY_ID;
  PP.canRunAction = canRun;
  PP.performAction = perform;
  PP.regionsForParty = regionsFor;
  PP.regionBase = baseOf;
  PP.addEffort = addEffort;
  PP.marginalSeats = marginalSeats;
  PP.leaderForm = leaderForm;
})(typeof globalThis !== 'undefined' ? globalThis : this);
