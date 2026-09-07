/*
 * Соперники. Каждую неделю партия под управлением компьютера тратит свои
 * очки расписания: чинит финансы, защищает сильные регионы, бьёт по лидеру
 * гонки и осторожно двигает позиции к настроению избирателя.
 */
(function (root) {
  'use strict';

  var PP = root.PP;
  var clamp = PP.clamp;

  function partyStrengthByRegion(state, partyId) {
    var byRegion = PP.allRegionShares(state);
    var list = [];
    PP.regionsForParty(state, partyId).forEach(function (r) {
      var sh = byRegion[r.id];
      var mine = sh[partyId] || 0;
      var best = 0, bestId = null;
      Object.keys(sh).forEach(function (pid) {
        if (pid !== partyId && sh[pid] > best) { best = sh[pid]; bestId = pid; }
      });
      list.push({ region: r, mine: mine, gap: mine - best, rival: bestId, seats: r.seats });
    });
    return list;
  }

  /* Регионы, где партия близка к победе: там кампания даёт больше всего мандатов. */
  function priorityRegions(state, partyId) {
    return partyStrengthByRegion(state, partyId)
      .map(function (x) {
        x.value = x.seats * Math.exp(-Math.pow(x.gap / 9, 2)) * (0.5 + x.mine / 40);
        return x;
      })
      .sort(function (a, b) { return b.value - a.value; });
  }

  function driftPositions(state, partyId, rng, skill) {
    var ps = state.parties[partyId];
    var def = PP.PARTY_BY_ID[partyId];
    /* Ориентир — настроение регионов, где партия борется за места. */
    var prio = priorityRegions(state, partyId).slice(0, 4);
    if (!prio.length) return;
    var target = {};
    PP.ISSUE_IDS.forEach(function (id) { target[id] = 0; });
    prio.forEach(function (x) {
      var prefs = PP.regionPreferences(x.region);
      PP.ISSUE_IDS.forEach(function (id) { target[id] += prefs[id] / prio.length; });
    });
    /* Двигаться можно недалеко от идентичности партии — иначе бунт фракции. */
    PP.ISSUE_IDS.forEach(function (id) {
      var want = target[id];
      var core = ps.corePositions[id];
      var maxDrift = 22 + skill * 8;
      var step = clamp((want - ps.positions[id]) * 0.10 * skill, -4, 4);
      var next = clamp(ps.positions[id] + step, core - maxDrift, core + maxDrift);
      if (Math.abs(next - ps.positions[id]) > 0.1 && rng.chance(0.5)) {
        ps.positions[id] = clamp(next, -100, 100);
        ps.unity = clamp(ps.unity - Math.abs(next - core) / 220, 5, 100);
      }
    });
    if (def.id === 'ref') ps.unity = clamp(ps.unity - 0.3, 5, 100);
  }

  function chooseAction(state, partyId, rng, skill) {
    var ps = state.parties[partyId];
    var prio = priorityRegions(state, partyId);
    var top = prio[0];
    var options = [];

    if (ps.funds < 1.2) options.push({ id: 'fundraise', w: 9 });
    else options.push({ id: 'fundraise', w: 2 });

    if (top) {
      options.push({ id: 'rally', w: ps.funds > 0.4 ? 6 * skill : 0, params: { regionId: top.region.id } });
      options.push({ id: 'ground', w: 5, params: { regionId: top.region.id } });
      options.push({ id: 'target', w: 4.5 * skill, params: { regionId: top.region.id } });
      if (top.rival && ps.funds > 1.0) {
        options.push({ id: 'attack', w: 3.2 * skill, params: { regionId: top.region.id, targetId: top.rival } });
      }
    }
    if (ps.broadcastsLeft > 0 && ps.funds > 2.2) options.push({ id: 'broadcast', w: 4.5 * skill });
    if (ps.activists < 55) options.push({ id: 'organise', w: 3 });
    if (ps.unity < 60) options.push({ id: 'unify', w: 5 });
    if (ps.scandal > 20) options.push({ id: 'unify', w: 3 });
    options.push({ id: 'media', w: 2.5 + (ps.leader.charisma - 50) / 12 });

    options = options.filter(function (o) {
      return o.w > 0 && PP.canRunAction(state, partyId, o.id).ok;
    });
    if (!options.length) return null;
    var total = options.reduce(function (s, o) { return s + o.w; }, 0);
    var r = rng.next() * total;
    for (var i = 0; i < options.length; i++) {
      r -= options[i].w;
      if (r <= 0) return options[i];
    }
    return options[options.length - 1];
  }

  function runWeek(state, rng) {
    var skill = state.aiSkill || 1;
    PP.PARTIES.forEach(function (def) {
      if (def.id === state.playerId || def.id === 'oth') return;
      var ps = state.parties[def.id];
      var ap = def.id === 'pc' ? 2 : 4;
      driftPositions(state, def.id, rng, skill);
      for (var i = 0; i < ap; i++) {
        var choice = chooseAction(state, def.id, rng, skill);
        if (!choice) break;
        PP.performAction(state, def.id, choice.id, choice.params || {}, rng);
      }
      /* Мелкая жизнь партии между решениями. */
      ps.leader.approval = clamp(ps.leader.approval + rng.normal(0, 1.6), -80, 80);
    });
  }

  PP.aiRunWeek = runWeek;
  PP.aiPriorityRegions = priorityRegions;
})(typeof globalThis !== 'undefined' ? globalThis : this);
