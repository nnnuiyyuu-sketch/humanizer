/* Ход недели: соперники, затухание кампании, деньги, повестка, событие, опрос. */
(function (root) {
  'use strict';

  var PP = root.PP;
  var clamp = PP.clamp;

  var EFFORT_DECAY = 0.72;
  var MOMENTUM_DECAY = 0.65;

  function debateWeeks(state) {
    return [Math.max(2, Math.round(state.totalWeeks * 0.35)), Math.round(state.totalWeeks * 0.75)];
  }

  function weeklyIncome(state, partyId, rng) {
    var def = PP.PARTY_BY_ID[partyId];
    var ps = state.parties[partyId];
    var members = ps.activists / 100;
    var base = (def.family === 'right' ? 0.55 : 0.40) + members * 0.55;
    var mood = 1 + ps.momentum / 30 + ps.leader.approval / 260;
    var income = Math.max(base * mood * rng.range(0.85, 1.15), 0.05);
    if (def.id === 'oth') income = 0.05;
    ps.funds += income;
    return income;
  }

  function endWeek(state) {
    if (state.phase !== 'campaign') return { ended: true };
    var rng = new PP.Rng('week:' + state.seed + ':' + state.week);

    /* 1. Ходы соперников. */
    PP.aiRunWeek(state, rng);

    /* 2. Кампания выдыхается: эффект прошлых поездок затухает. */
    Object.keys(state.effort).forEach(function (rid) {
      var r = state.effort[rid];
      Object.keys(r).forEach(function (pid) {
        var keep = EFFORT_DECAY;
        var ground = (state.groundGame[rid] && state.groundGame[rid][pid]) || 0;
        keep = Math.min(keep + ground * 0.03, 0.90); /* работа на земле держится дольше */
        r[pid] *= keep;
        if (Math.abs(r[pid]) < 0.05) r[pid] = 0;
      });
    });

    /* 3. Деньги, силы, единство, скандалы. */
    Object.keys(state.parties).forEach(function (pid) {
      var ps = state.parties[pid];
      ps.momentum *= MOMENTUM_DECAY;
      var decay = 4 * (pid === state.playerId ? PP.roleMod(state, 'scandalDecay') : 1);
      ps.scandal = Math.max((ps.scandal || 0) - decay, 0);
      ps.unity = clamp(ps.unity + (ps.unity < 70 ? 0.8 : -0.2), 5, 100);
      weeklyIncome(state, pid, rng);
    });
    state.stamina = clamp(state.stamina + 22, 0, 100);

    /* 4. Повестка сползает к «нормальной» — единичный инфоповод не вечен. */
    PP.ISSUES.forEach(function (issue) {
      var cur = state.salience[issue.id];
      state.salience[issue.id] = cur + (issue.baseSalience - cur) * 0.18 + rng.normal(0, 0.5);
      state.salience[issue.id] = clamp(state.salience[issue.id], 1, 45);
    });

    /* 5. Публикуется опрос недели, газеты выходят со своими заголовками. */
    var poll = PP.publishedPoll(state, rng);
    state.pollHistory.push({ week: state.week, shares: poll });
    state.press = PP.generatePress(state, rng);

    state.week++;
    state.ap = state.apMax;
    state._cacheRegionShares = null;

    if (state.week > state.totalWeeks) {
      state.phase = 'election';
      PP.addNews(state, 'Кампания окончена. Избирательные участки открыты.', 'system');
      return { ended: true, poll: poll };
    }

    /* 6. Событие недели или дебаты. */
    var out = { poll: poll, week: state.week };
    if (debateWeeks(state).indexOf(state.week) >= 0 && state.debatesDone.indexOf(state.week) < 0) {
      state.pendingDebate = { week: state.week, rival: PP.topRival(state) };
      out.debate = state.pendingDebate;
    } else if (rng.chance(0.8)) {
      var ev = PP.pickEvent(state, rng);
      if (ev) {
        state.pendingEvent = { id: ev.id, title: ev.title, text: ev.text, options: ev.options.map(function (o, i) { return { i: i, label: o.label }; }) };
        out.event = state.pendingEvent;
      }
    }
    PP.addNews(state, 'Неделя ' + state.week + ' из ' + state.totalWeeks + '. Опрос: ' + topLine(poll) + '.', 'poll');
    return out;
  }

  function topLine(poll) {
    return Object.keys(poll)
      .filter(function (p) { return poll[p] >= 2; })
      .sort(function (a, b) { return poll[b] - poll[a]; })
      .slice(0, 4)
      .map(function (p) { return PP.PARTY_BY_ID[p].abbr + ' ' + poll[p].toFixed(1) + '%'; })
      .join(', ');
  }

  function resolveEvent(state, optionIndex) {
    var pending = state.pendingEvent;
    if (!pending) return null;
    var ev = PP.EVENTS.filter(function (e) { return e.id === pending.id; })[0];
    var rng = new PP.Rng('event:' + state.seed + ':' + state.week + ':' + optionIndex);
    var text = ev.options[optionIndex].run(state, rng);
    state.usedEvents = state.usedEvents || [];
    state.usedEvents.push(ev.id);
    state.pendingEvent = null;
    state._cacheRegionShares = null;
    PP.addNews(state, '📰 ' + ev.title + ' — ' + text, 'event');
    return text;
  }

  function resolveDebate(state, moveId) {
    var rng = new PP.Rng('debate:' + state.seed + ':' + state.week + ':' + moveId);
    var res = PP.resolveDebate(state, moveId, rng);
    state.debatesDone.push(state.week);
    state.pendingDebate = null;
    state._cacheRegionShares = null;
    PP.addNews(state, '📺 Теледебаты: ' + res.text, res.ok ? 'good' : 'bad');
    return res;
  }

  PP.endWeek = endWeek;
  PP.resolveEventChoice = resolveEvent;
  PP.resolveDebateChoice = resolveDebate;
  PP.debateWeeks = debateWeeks;
  PP.pollTopLine = topLine;
})(typeof globalThis !== 'undefined' ? globalThis : this);
