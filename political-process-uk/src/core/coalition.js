/*
 * Подвешенный парламент: переговоры о правительстве. Партнёр соглашается,
 * если он идеологически близок, если союз даёт большинство и если ему
 * достаётся достаточно за участие.
 */
(function (root) {
  'use strict';

  var PP = root.PP;
  var clamp = PP.clamp;

  var NEGOTIABLE = ['lab', 'con', 'ld', 'ref', 'grn', 'snp', 'pc', 'dup', 'uup', 'apni', 'sdlp', 'tuv'];

  function seatsOf(result, pid) { return result.seats[pid] || 0; }

  /* Готовность партии войти в правительство лидера: 0..100. */
  function willingness(state, result, leaderId, partnerId, offer) {
    if (partnerId === leaderId) return 100;
    var dist = PP.ideologyDistance(leaderId, partnerId);
    if (!PP.PARTY_BY_ID[partnerId].positions) dist = 55; /* партии Северной Ирландии */
    var score = 100 - dist * 1.35;
    var lead = seatsOf(result, leaderId), mine = seatsOf(result, partnerId);
    if (mine > lead) score -= 40;                       /* младшим партнёром идти не хотят */
    score += clamp((lead - mine) / 12, 0, 12);
    score += (offer && offer.cabinet ? 14 : 0);
    score += (offer && offer.referendum && (partnerId === 'snp' || partnerId === 'pc') ? 25 : 0);
    score += (offer && offer.pr ? (partnerId === 'ld' || partnerId === 'grn' || partnerId === 'ref' ? 18 : 0) : 0);
    score -= (offer && offer.pr ? (partnerId === 'lab' || partnerId === 'con' ? 8 : 0) : 0);
    if (state.parties[partnerId]) score += (state.parties[partnerId].leader.approval) / 12;
    return clamp(score, 0, 100);
  }

  function options(state, result, leaderId, offer) {
    return NEGOTIABLE.filter(function (pid) {
      return pid !== leaderId && seatsOf(result, pid) > 0 && pid !== 'sf';
    }).map(function (pid) {
      return {
        id: pid,
        seats: seatsOf(result, pid),
        willing: willingness(state, result, leaderId, pid, offer),
        distance: PP.ideologyDistance(leaderId, pid)
      };
    }).sort(function (a, b) { return b.willing - a.willing; });
  }

  /* Итог переговоров: кто формирует правительство и какого типа. */
  function formGovernment(state, result, leaderId, partnerIds, offer) {
    var threshold = result.majority.effective;
    var total = seatsOf(result, leaderId);
    var accepted = [], refused = [];
    (partnerIds || []).forEach(function (pid) {
      var w = willingness(state, result, leaderId, pid, offer);
      var need = offer && offer.confidence ? 42 : 55;
      if (w >= need) { accepted.push(pid); total += seatsOf(result, pid); }
      else refused.push({ id: pid, willing: w });
    });
    var kind;
    if (seatsOf(result, leaderId) >= threshold) kind = 'majority';
    else if (total >= threshold) kind = offer && offer.confidence ? 'confidence' : 'coalition';
    else kind = 'minority';
    return {
      leader: leaderId, partners: accepted, refused: refused,
      seats: total, threshold: threshold, kind: kind,
      viable: total >= threshold || kind === 'minority'
    };
  }

  /* Кто вообще может собрать большинство — для оценки положения игрока. */
  function viableCoalitions(state, result) {
    var out = [];
    ['lab', 'con'].concat(NEGOTIABLE).filter(function (v, i, a) { return a.indexOf(v) === i; })
      .forEach(function (leaderId) {
        if (seatsOf(result, leaderId) < 40) return;
        var opts = options(state, result, leaderId, { cabinet: true });
        var total = seatsOf(result, leaderId), partners = [];
        for (var i = 0; i < opts.length && total < result.majority.effective; i++) {
          if (opts[i].willing < 55) continue;
          partners.push(opts[i].id);
          total += opts[i].seats;
        }
        if (total >= result.majority.effective) {
          out.push({ leader: leaderId, partners: partners, seats: total });
        }
      });
    return out;
  }

  PP.coalitionOptions = options;
  PP.formGovernment = formGovernment;
  PP.viableCoalitions = viableCoalitions;
  PP.coalitionWillingness = willingness;
})(typeof globalThis !== 'undefined' ? globalThis : this);
