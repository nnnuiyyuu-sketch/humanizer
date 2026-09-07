/*
 * Ночь выборов: национальная погрешность, результат в каждом из 650 округов,
 * порядок объявления результатов и итоговая арифметика Палаты общин.
 */
(function (root) {
  'use strict';

  var PP = root.PP;
  var clamp = PP.clamp;

  function niResults(state, rng) {
    return state.niSeats.map(function (s) {
      var party = s.party;
      /* Небольшая вероятность перехода округа между блоками. */
      if (rng.chance(0.10)) {
        var pool = PP.NI_PARTIES.filter(function (p) { return p.id !== party; });
        party = rng.pick(pool).id;
      }
      return {
        seatId: s.id, name: s.name, region: 'n_ireland',
        winner: party, previous: s.party, shares: null, margin: rng.range(2, 20),
        time: rng.range(1.5, 8), ni: true
      };
    });
  }

  /* Время объявления: города считают быстро, сельские округа — до утра. */
  function declarationTime(seat, rng) {
    var urbanFactor = (100 - seat.demo.urban) / 100;
    return clamp(1.0 + urbanFactor * 5.8 + rng.range(0, 2.8), 0.7, 9);
  }

  function runElection(state) {
    var rng = new PP.Rng('election:' + state.seed);
    var byRegion = PP.allRegionShares(state);

    /* Системная ошибка опросов: одинаковая по стране для каждой партии. */
    var nationalError = {};
    PP.GB_PARTY_IDS.forEach(function (pid) { nationalError[pid] = rng.normal(0, 1.5); });

    var adjusted = {};
    PP.CAMPAIGN_REGIONS.forEach(function (r) {
      var sh = byRegion[r.id], out = {}, total = 0;
      Object.keys(sh).forEach(function (pid) {
        var v = sh[pid] * (1 + (nationalError[pid] || 0) / 25) + rng.normal(0, 0.8);
        out[pid] = Math.max(v, 0.3);
        total += out[pid];
      });
      Object.keys(out).forEach(function (pid) { out[pid] = out[pid] / total * 100; });
      adjusted[r.id] = out;
    });

    var results = [], votes = {}, totalVotes = 0;
    state.seats.forEach(function (seat) {
      var ground = (state.groundGame[seat.region] && state.groundGame[seat.region]) || {};
      var res = PP.seatResult(seat, adjusted[seat.region], { rng: rng, noise: 0.085 });
      var turnout = clamp(rng.normal(0.62, 0.05) + (state.targeted[seat.id] ? 0.02 : 0), 0.4, 0.85);
      var cast = Math.round(seat.electorate * turnout);
      Object.keys(res.shares).forEach(function (pid) {
        var v = Math.round(cast * res.shares[pid] / 100);
        votes[pid] = (votes[pid] || 0) + v;
        totalVotes += v;
      });
      results.push({
        seatId: seat.id, name: seat.name, region: seat.region,
        winner: res.winner, runnerUp: res.runnerUp, previous: seat.holder,
        shares: res.shares, margin: res.margin, votes: cast,
        turnout: turnout, time: declarationTime(seat, rng),
        ground: ground
      });
    });

    results = results.concat(niResults(state, rng));
    results.sort(function (a, b) { return a.time - b.time; });

    var seatCounts = {};
    results.forEach(function (r) { seatCounts[r.winner] = (seatCounts[r.winner] || 0) + 1; });

    var voteShares = {};
    Object.keys(votes).forEach(function (pid) { voteShares[pid] = votes[pid] / totalVotes * 100; });

    /* Экзитпол: близко к правде, но с собственной ошибкой. */
    var exitPoll = {};
    Object.keys(seatCounts).forEach(function (pid) {
      exitPoll[pid] = Math.max(0, Math.round(seatCounts[pid] + rng.normal(0, Math.max(1.5, seatCounts[pid] * 0.06))));
    });

    var out = {
      results: results,
      seats: seatCounts,
      votes: voteShares,
      rawVotes: votes,
      totalVotes: totalVotes,
      exitPoll: exitPoll,
      regionShares: adjusted,
      majority: majorityThreshold(seatCounts)
    };
    out.gains = countChanges(results);
    return out;
  }

  function countChanges(results) {
    var gains = {};
    results.forEach(function (r) {
      if (!r.previous || r.previous === r.winner) return;
      gains[r.winner] = gains[r.winner] || { gained: 0, from: {} };
      gains[r.winner].gained++;
      gains[r.winner].from[r.previous] = (gains[r.winner].from[r.previous] || 0) + 1;
      gains[r.previous] = gains[r.previous] || { gained: 0, from: {}, lost: 0 };
      gains[r.previous].lost = (gains[r.previous].lost || 0) + 1;
    });
    return gains;
  }

  /*
   * Порог большинства с поправкой на «Шинн Фейн»: их депутаты не занимают
   * места в Палате общин, поэтому реальная планка ниже 326.
   */
  function majorityThreshold(seatCounts) {
    var abstain = seatCounts.sf || 0;
    var sitting = PP.TOTAL_SEATS - abstain;
    return { formal: 326, effective: Math.floor(sitting / 2) + 1, abstaining: abstain };
  }

  PP.runElection = runElection;
  PP.majorityThreshold = majorityThreshold;
})(typeof globalThis !== 'undefined' ? globalThis : this);
