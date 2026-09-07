/*
 * Пресса. Каждую неделю газеты дают свои заголовки — они ничего не решают,
 * но по ним видно, как выглядит кампания со стороны.
 * Издания вымышленные.
 */
(function (root) {
  'use strict';

  var PP = root.PP;

  var PAPERS = [
    { id: 'herald', name: 'The Westminster Herald', lean: 'centre', style: 'broadsheet' },
    { id: 'blaze', name: 'The Daily Blaze', lean: 'right', style: 'tabloid' },
    { id: 'clarion', name: 'The Morning Clarion', lean: 'left', style: 'broadsheet' },
    { id: 'chronicle', name: 'The Evening Chronicle', lean: 'centre', style: 'tabloid' },
    { id: 'ledger', name: 'The City Ledger', lean: 'right', style: 'broadsheet' }
  ];

  function pick(rng, arr) { return arr[Math.floor(rng.next() * arr.length)]; }

  function headlines(state, rng) {
    var out = [];
    var me = state.parties[state.playerId];
    var def = PP.PARTY_BY_ID[state.playerId];
    var hist = state.pollHistory;
    var last = hist[hist.length - 1], prev = hist.length > 1 ? hist[hist.length - 2] : null;
    var move = prev ? (last.shares[state.playerId] || 0) - (prev.shares[state.playerId] || 0) : 0;
    var leader = me.leader.name;

    if (move > 1.2) {
      out.push({ tone: 'good', text: pick(rng, [
        def.ru + ' идут вверх: плюс ' + move.toFixed(1) + ' пункта за неделю',
        'Штабы соперников пересчитывают округа: ' + def.ru.toLowerCase() + ' прибавляют',
        leader + ': «Мы только разогреваемся»'
      ]) });
    } else if (move < -1.2) {
      out.push({ tone: 'bad', text: pick(rng, [
        'Тревога в штабе: ' + def.ru.toLowerCase() + ' теряют ' + Math.abs(move).toFixed(1) + ' пункта',
        'Кто виноват в провальной неделе ' + leader + '?',
        'Источники в партии: «Так дальше нельзя»'
      ]) });
    }

    if ((me.scandal || 0) > 18) {
      out.push({ tone: 'bad', text: pick(rng, [
        leader + ': вопросы, на которые нет ответов',
        'Что ещё мы не знаем о партийной кассе?',
        'Пресс-служба ушла в глухую оборону'
      ]) });
    }
    if (me.unity < 52) {
      out.push({ tone: 'bad', text: pick(rng, [
        'Заднескамеечники точат ножи',
        'Фракция ' + def.ru.toLowerCase() + ' на грани открытого бунта',
        'Аноним из партии: «Мы это ещё обсудим после выборов»'
      ]) });
    }
    if (me.leader.approval > 12) {
      out.push({ tone: 'good', text: pick(rng, [
        leader + ' — самый популярный политик недели',
        'Залы полны: турне ' + leader + ' собирает очереди',
        'Даже оппоненты признают: у ' + leader + ' хорошая неделя'
      ]) });
    }

    var topIssue = PP.ISSUE_IDS.slice().sort(function (a, b) { return state.salience[b] - state.salience[a]; })[0];
    out.push({ tone: 'neutral', text: pick(rng, [
      'Главная тема кампании — ' + PP.ISSUE_BY_ID[topIssue].name.toLowerCase(),
      'Опрос: избирателей больше всего волнует ' + PP.ISSUE_BY_ID[topIssue].name.toLowerCase(),
      'Студии спорят до полуночи: ' + PP.ISSUE_BY_ID[topIssue].name.toLowerCase() + ' и ничего больше'
    ]) });

    out.push({ tone: 'neutral', text: pick(rng, [
      'Дождь над Манчестером, но зал всё равно полон',
      'Автобус кампании застрял на M6 — виноваты дорожные работы',
      'В пабах спорят о выборах и о судействе в субботнем матче',
      'Букмекеры принимают ставки на подвешенный парламент',
      'В Вестминстере считают дни до роспуска предвыборных штабов',
      'Королевский протокол: Дворец сохраняет нейтралитет',
      'Чай остыл: пресс-конференцию перенесли в третий раз'
    ]) });

    return rng.shuffle(out).slice(0, 3).map(function (h) {
      return { paper: pick(rng, PAPERS).name, text: h.text, tone: h.tone };
    });
  }

  PP.PAPERS = PAPERS;
  PP.generatePress = headlines;
})(typeof globalThis !== 'undefined' ? globalThis : this);
