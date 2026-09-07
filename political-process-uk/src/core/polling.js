/*
 * Модель поддержки. Для каждого региона считается «истинная» доля партии,
 * из неё уже собираются публичные опросы (с шумом социологии) и итог выборов.
 */
(function (root) {
  'use strict';

  var PP = root.PP;
  var clamp = PP.clamp;

  var FIT_WEIGHT = 0.55;      /* вклад совпадения позиций с настроением региона */
  var LEADER_WEIGHT = 0.30;   /* вклад рейтинга лидера */
  var UNITY_WEIGHT = 0.12;    /* вклад единства партии */

  function normalisedSalience(salience) {
    var total = 0, out = {};
    PP.ISSUE_IDS.forEach(function (id) { total += Math.max(salience[id] || 0, 0); });
    if (total <= 0) total = 1;
    PP.ISSUE_IDS.forEach(function (id) { out[id] = Math.max(salience[id] || 0, 0) / total; });
    return out;
  }

  /* Насколько партия «попадает» в настроение региона: примерно -1..+1. */
  function issueFit(partyState, prefs, salNorm) {
    var total = 0;
    PP.ISSUE_IDS.forEach(function (id) {
      var pos = partyState.positions[id];
      var align = 1 - Math.abs(pos - prefs[id]) / 200;   /* 0.5..1 */
      var centred = (align - 0.80) * 4;                  /* примерно -1..+0.8 */
      var comp = ((partyState.competence[id] || 40) - 45) / 45;
      total += salNorm[id] * (0.72 * centred + 0.40 * comp);
    });
    return clamp(total, -1.2, 1.2);
  }

  function leaderTerm(partyState) {
    var l = partyState.leader;
    return clamp(l.approval / 100, -0.6, 0.6) * LEADER_WEIGHT
      + ((l.charisma - 50) / 50) * 0.05
      - clamp(partyState.scandal || 0, 0, 60) / 100 * 0.55;
  }

  /* Истинные доли партий в регионе, в процентах, сумма = 100. */
  function regionShares(state, region) {
    var prefs = PP.regionPreferences(region);
    var salNorm = normalisedSalience(state.salience);
    var raw = {}, total = 0;

    Object.keys(region.base).forEach(function (pid) {
      var ps = state.parties[pid];
      if (!ps) return;
      var base = region.base[pid];
      var mult = 1;
      if (pid !== 'oth') {
        mult += FIT_WEIGHT * issueFit(ps, prefs, salNorm);
        mult += leaderTerm(ps);
        mult += UNITY_WEIGHT * ((ps.unity - 65) / 100);
        mult += clamp(ps.momentum || 0, -12, 12) / 100;
      }
      var push = (state.effort[region.id] && state.effort[region.id][pid]) || 0;
      var value = Math.max(base * Math.max(mult, 0.15) + push, 0.4);
      raw[pid] = value;
      total += value;
    });

    Object.keys(raw).forEach(function (pid) { raw[pid] = (raw[pid] / total) * 100; });
    return raw;
  }

  function allRegionShares(state) {
    var out = {};
    PP.CAMPAIGN_REGIONS.forEach(function (r) { out[r.id] = regionShares(state, r); });
    return out;
  }

  /* Национальная доля (Великобритания без Северной Ирландии), взвешенная по избирателям. */
  function nationalShares(state, byRegion) {
    byRegion = byRegion || allRegionShares(state);
    var totals = {}, weightSum = 0;
    PP.CAMPAIGN_REGIONS.forEach(function (r) {
      var w = r.seats;
      weightSum += w;
      var sh = byRegion[r.id];
      Object.keys(sh).forEach(function (pid) {
        totals[pid] = (totals[pid] || 0) + sh[pid] * w;
      });
    });
    Object.keys(totals).forEach(function (pid) { totals[pid] = totals[pid] / weightSum; });
    return totals;
  }

  /* Публикуемый опрос: истина плюс шум социологической службы. */
  function publishedPoll(state, rng, house) {
    var nat = nationalShares(state);
    var out = {};
    var sum = 0;
    Object.keys(nat).forEach(function (pid) {
      /* Погрешность растёт вместе с размером партии: у мелких она не может
         быть больше их самих. */
      var sd = clamp(0.35 + nat[pid] * 0.045, 0.3, 1.6);
      var v = nat[pid] + rng.normal(0, sd) + (house && house[pid] ? house[pid] : 0);
      out[pid] = Math.max(v, 0.3);
      sum += out[pid];
    });
    Object.keys(out).forEach(function (pid) { out[pid] = Math.round((out[pid] / sum) * 1000) / 10; });
    return out;
  }

  /* Быстрая проекция мест по текущим долям (используется на дашборде). */
  function projectSeats(state, byRegion, opts) {
    opts = opts || {};
    byRegion = byRegion || allRegionShares(state);
    var counts = {};
    state.seats.forEach(function (seat) {
      var res = PP.seatResult(seat, byRegion[seat.region], {
        noise: 0,
        rng: opts.rng,
        incumbency: opts.incumbency
      });
      counts[res.winner] = (counts[res.winner] || 0) + 1;
    });
    /* Северная Ирландия — отдельный блок, места фиксированы до дня выборов. */
    (state.niSeats || []).forEach(function (s) {
      counts[s.party] = (counts[s.party] || 0) + 1;
    });
    return counts;
  }

  PP.regionShares = regionShares;
  PP.allRegionShares = allRegionShares;
  PP.nationalShares = nationalShares;
  PP.publishedPoll = publishedPoll;
  PP.projectSeats = projectSeats;
  PP.normalisedSalience = normalisedSalience;
  PP.issueFit = issueFit;
})(typeof globalThis !== 'undefined' ? globalThis : this);
