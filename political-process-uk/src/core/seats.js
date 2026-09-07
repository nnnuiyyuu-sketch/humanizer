/*
 * Процедурная генерация 650 округов и расчёт результата в отдельном округе.
 * Профиль округа — отклонение от средней демографии региона, поэтому в сумме
 * округа воспроизводят региональные доли, а разброс даёт эффект мажоритарной
 * системы: партия с ровным по стране результатом мест почти не получает.
 */
(function (root) {
  'use strict';

  var PP = root.PP;
  var clamp = PP.clamp;
  var AXES = ['age', 'degree', 'leave', 'urban', 'prosperity'];

  function makeName(rng, region, used) {
    var pool = PP.PLACES[region.id] || ['Округ'];
    for (var attempt = 0; attempt < 40; attempt++) {
      var town = rng.pick(pool);
      var name = town;
      if (used[name] || rng.chance(0.55)) {
        name = town + ' — ' + rng.pick(PP.PLACE_SUFFIXES);
      }
      if (!used[name]) { used[name] = true; return name; }
    }
    var n = town + ' #' + rng.int(2, 99);
    used[n] = true;
    return n;
  }

  function generateSeats(seed) {
    var rng = new PP.Rng('seats:' + seed);
    var seats = [];
    PP.CAMPAIGN_REGIONS.forEach(function (region) {
      var used = {};
      for (var i = 0; i < region.seats; i++) {
        var demo = {};
        /* Урбанизация задаёт округ, остальные оси частично следуют за ней. */
        var urbanDev = rng.normal(0, 24);
        demo.urban = clamp(region.demo.urban + urbanDev, 1, 99);
        demo.degree = clamp(region.demo.degree + 0.35 * urbanDev + rng.normal(0, 13), 1, 99);
        demo.age = clamp(region.demo.age - 0.30 * urbanDev + rng.normal(0, 11), 1, 99);
        demo.leave = clamp(region.demo.leave - 0.55 * (demo.degree - region.demo.degree) + rng.normal(0, 10), 1, 99);
        demo.prosperity = clamp(region.demo.prosperity + 0.20 * (demo.degree - region.demo.degree) + rng.normal(0, 15), 1, 99);

        /* Концентрация: у либдемов и зелёных голоса собраны в отдельных
           округах, у Reform размазаны ровным слоем. Вычитаем sd^2/2, чтобы
           разброс не завышал средний результат партии. */
        var local = {};
        PP.GB_PARTY_IDS.forEach(function (pid) {
          var sd = PP.PARTY_BY_ID[pid].concentration || 0.15;
          local[pid] = rng.normal(-sd * sd / 2, sd);
        });

        seats.push({
          id: region.id + '-' + i,
          name: makeName(rng, region, used),
          region: region.id,
          demo: demo,
          local: local,
          holder: null,
          holderMargin: 0,
          electorate: Math.round(rng.range(62000, 79000))
        });
      }
    });
    return seats;
  }

  /* Множитель партии в округе относительно её же региональной доли. */
  function seatFactor(seat, region, party) {
    var aff = party.affinity, s = 0;
    for (var i = 0; i < AXES.length; i++) {
      var a = AXES[i];
      s += (aff[a] || 0) * ((seat.demo[a] - region.demo[a]) / 50);
    }
    return Math.exp(0.95 * s + (seat.local[party.id] || 0));
  }

  /*
   * Тактическое голосование: часть сторонников безнадёжных здесь партий
   * переходит к тому из двух лидеров, кто им идеологически ближе.
   */
  function applyTactical(shares, intensity) {
    var ids = Object.keys(shares);
    var sorted = ids.slice().sort(function (a, b) { return shares[b] - shares[a]; });
    var first = sorted[0], second = sorted[1];
    if (!second) return shares;
    for (var i = 2; i < sorted.length; i++) {
      var pid = sorted[i];
      if (shares[pid] < 1) continue;
      var dFirst = PP.ideologyDistance(pid, first);
      var dSecond = PP.ideologyDistance(pid, second);
      var pull = (dFirst - dSecond) / 60; /* > 0 — ближе второй */
      var frac = clamp(Math.abs(pull) * intensity, 0, 0.32);
      var moved = shares[pid] * frac;
      shares[pid] -= moved;
      if (pull > 0) shares[second] += moved; else shares[first] += moved;
    }
    return shares;
  }

  /*
   * Итог в округе. regionShares — доли партий в регионе (в процентах).
   * noise = 0 даёт «нотационный» результат без случайности.
   */
  function seatResult(seat, regionShares, opts) {
    opts = opts || {};
    var rng = opts.rng;
    var region = PP.REGION_BY_ID[seat.region];
    var raw = {}, total = 0;
    Object.keys(regionShares).forEach(function (pid) {
      var party = PP.PARTY_BY_ID[pid];
      if (!party || !party.affinity) return;
      var v = regionShares[pid] * seatFactor(seat, region, party);
      if (rng) v *= Math.exp(rng.normal(0, opts.noise === undefined ? 0.10 : opts.noise));
      if (seat.holder === pid) v *= 1 + (opts.incumbency === undefined ? 0.05 : opts.incumbency);
      raw[pid] = Math.max(v, 0.05);
      total += raw[pid];
    });
    Object.keys(raw).forEach(function (pid) { raw[pid] = (raw[pid] / total) * 100; });
    applyTactical(raw, opts.tactical === undefined ? 0.55 : opts.tactical);

    var order = Object.keys(raw).sort(function (a, b) { return raw[b] - raw[a]; });
    return {
      shares: raw,
      winner: order[0],
      runnerUp: order[1],
      margin: raw[order[0]] - raw[order[1]],
      order: order
    };
  }

  /* Назначает «действующих депутатов» по нотационному результату. */
  function assignHolders(seats, regionSharesByRegion) {
    seats.forEach(function (seat) {
      var res = seatResult(seat, regionSharesByRegion[seat.region], { noise: 0, incumbency: 0 });
      seat.holder = res.winner;
      seat.holderMargin = res.margin;
      seat.notional = res.shares;
    });
    return seats;
  }

  PP.generateSeats = generateSeats;
  PP.seatResult = seatResult;
  PP.assignHolders = assignHolders;
  PP.seatFactor = seatFactor;
})(typeof globalThis !== 'undefined' ? globalThis : this);
