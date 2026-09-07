/*
 * Случайные события недели и телевизионные дебаты. У события есть варианты
 * ответа: выбор игрока меняет рейтинги, деньги, единство и повестку.
 */
(function (root) {
  'use strict';

  var PP = root.PP;
  var clamp = PP.clamp;

  function me(state) { return state.parties[state.playerId]; }
  function bump(state, field, value) {
    var ps = me(state);
    if (field === 'approval') ps.leader.approval = clamp(ps.leader.approval + value, -80, 80);
    else if (field === 'unity') ps.unity = clamp(ps.unity + value, 5, 100);
    else if (field === 'funds') ps.funds = Math.max(ps.funds + value, 0);
    else if (field === 'activists') ps.activists = clamp(ps.activists + value, 0, 100);
    else if (field === 'momentum') ps.momentum = clamp(ps.momentum + value, -14, 14);
    else if (field === 'scandal') ps.scandal = clamp((ps.scandal || 0) + value, 0, 100);
    else if (field === 'stamina') state.stamina = clamp(state.stamina + value, 0, 100);
  }
  function salience(state, issueId, value) {
    state.salience[issueId] = clamp(state.salience[issueId] + value, 1, 45);
  }

  var EVENTS = [
    {
      id: 'inflation',
      title: 'Свежие данные по инфляции',
      text: 'Статистика вышла хуже прогноза: продукты и аренда снова подорожали. Тема цен выходит на первый план.',
      weight: 10,
      options: [
        { label: 'Обвинить правительство и торговые сети', run: function (s) { salience(s, 'cost', 5); bump(s, 'momentum', 1.2); return 'Тема цен гремит всю неделю, вы задаёте повестку.'; } },
        { label: 'Предложить адресную помощь семьям', run: function (s) { salience(s, 'cost', 3); bump(s, 'approval', 3); bump(s, 'funds', -0.15); return 'План помощи встречен тепло, но стоил денег на промо.'; } },
        { label: 'Промолчать: тема не наша', run: function (s) { salience(s, 'cost', 2); bump(s, 'momentum', -0.6); return 'Повестку на неделю забрали конкуренты.'; } }
      ]
    },
    {
      id: 'nhs_winter',
      title: 'Очереди в отделениях скорой помощи',
      text: 'Телевидение показывает каталки в коридорах больницы в Северной Англии. NHS — снова главная тема.',
      weight: 10,
      options: [
        { label: 'Ехать в больницу и говорить с врачами', run: function (s) { salience(s, 'nhs', 5); bump(s, 'approval', 4); bump(s, 'stamina', -8); return 'Кадры с врачами весь вечер в новостях.'; } },
        { label: 'Объявить экстренный план финансирования', run: function (s) { salience(s, 'nhs', 6); me(s).competence.nhs = clamp(me(s).competence.nhs + 4, 0, 95); bump(s, 'unity', -3); return 'Обещание услышали. Казначейские ястребы в партии ворчат.'; } },
        { label: 'Перевести разговор на экономику', run: function (s) { salience(s, 'tax', 3); salience(s, 'nhs', -2); return 'Вы уводите дискуссию к налогам.'; } }
      ]
    },
    {
      id: 'boats',
      title: 'Кризис на побережье Кента',
      text: 'За сутки Ла-Манш пересекли несколько сотен человек. Таблоиды требуют реакции.',
      weight: 9,
      options: [
        { label: 'Жёсткая линия: контроль границ прежде всего', run: function (s) { var ps = me(s); ps.positions.immig = clamp(ps.positions.immig + 8, -100, 100); salience(s, 'immig', 6); bump(s, 'unity', -4); return 'Заголовки ваши, часть партии в ярости.'; } },
        { label: 'Говорить о разгоне очереди на рассмотрение дел', run: function (s) { salience(s, 'immig', 3); me(s).competence.immig = clamp(me(s).competence.immig + 5, 0, 95); return 'Скучный, но компетентный ответ.'; } },
        { label: 'Обвинить оппонентов в разжигании', run: function (s) { salience(s, 'immig', 4); bump(s, 'approval', -2); bump(s, 'unity', 3); return 'Своя аудитория довольна, колеблющиеся — нет.'; } }
      ]
    },
    {
      id: 'donor',
      title: 'Вопрос о пожертвовании',
      text: 'Газета выяснила, что крупный донор партии получал государственные контракты.',
      weight: 8,
      condition: function (s) { return me(s).funds > 2; },
      options: [
        { label: 'Вернуть деньги немедленно', run: function (s) { bump(s, 'funds', -1.2); bump(s, 'scandal', -8); bump(s, 'approval', 2); return 'Дорого, но история умерла за два дня.'; } },
        { label: 'Всё законно, комментариев не будет', run: function (s) { bump(s, 'scandal', 14); return 'История живёт своей жизнью всю неделю.'; } },
        { label: 'Опубликовать все пожертвования разом', run: function (s) { bump(s, 'scandal', 4); bump(s, 'approval', 3); bump(s, 'unity', -3); return 'Прозрачность оценили, пара коллег теперь объясняется сама.'; } }
      ]
    },
    {
      id: 'defection',
      title: 'Депутат готов перейти к вам',
      text: 'Заднескамеечник соперника намекает, что готов сменить партию — если ему обещают безопасный округ.',
      weight: 6,
      options: [
        { label: 'Обещать округ и устроить пресс-конференцию', run: function (s, rng) { bump(s, 'momentum', 2.5); bump(s, 'unity', -7); return 'Красивая картинка перехода. В местном отделении скандал.'; } },
        { label: 'Взять без обещаний', run: function (s, rng) { if (rng.chance(0.5)) { bump(s, 'momentum', 1.2); return 'Он всё равно перешёл.'; } bump(s, 'momentum', -0.5); return 'Передумал и остался — над вами смеются.'; } },
        { label: 'Отказаться', run: function (s) { bump(s, 'unity', 4); return 'Своя фракция оценила верность принципам.'; } }
      ]
    },
    {
      id: 'endorsement',
      title: 'Редакция крупной газеты выбирает сторону',
      text: 'Влиятельное издание намекает, что готово поддержать вас — при определённой правке манифеста.',
      weight: 7,
      options: [
        { label: 'Пойти навстречу по налогам', run: function (s) { var ps = me(s); ps.positions.tax = clamp(ps.positions.tax + 10, -100, 100); bump(s, 'momentum', 2.2); bump(s, 'unity', -5); return 'Передовица за вас, актив недоволен.'; } },
        { label: 'Ничего не менять', run: function (s, rng) { if (rng.chance(0.35)) { bump(s, 'momentum', 1.0); return 'Поддержали и так — «за неимением лучшего».'; } bump(s, 'momentum', -1.0); return 'Газета выбрала соперника.'; } }
      ]
    },
    {
      id: 'gaffe',
      title: 'Кандидат наговорил лишнего',
      text: 'Ваш кандидат в одном из округов оставил в сети такое, что читать неловко.',
      weight: 8,
      options: [
        { label: 'Снять с выборов сегодня же', run: function (s) { bump(s, 'scandal', 3); bump(s, 'unity', -4); return 'Быстро и жёстко — история прожила один день.'; } },
        { label: 'Защищать: слова вырваны из контекста', run: function (s, rng) { if (rng.chance(0.45)) { bump(s, 'scandal', 16); return 'История тянется всю неделю.'; } bump(s, 'unity', 3); return 'Пронесло, фракция оценила защиту своего.'; } }
      ]
    },
    {
      id: 'strike',
      title: 'Забастовка на железной дороге',
      text: 'Профсоюз объявил стачку в разгар кампании. Страна стоит.',
      weight: 7,
      options: [
        { label: 'Встать на сторону бастующих', run: function (s) { var ps = me(s); ps.positions.cost = clamp(ps.positions.cost - 6, -100, 100); bump(s, 'activists', 6); bump(s, 'approval', -2); return 'Профсоюзы шлют волонтёров, средний избиратель хмурится.'; } },
        { label: 'Потребовать вернуться к работе', run: function (s) { bump(s, 'approval', 3); bump(s, 'activists', -5); return 'Уставшие пассажиры вам благодарны.'; } },
        { label: 'Призвать стороны к переговорам', run: function (s) { bump(s, 'approval', 1); me(s).competence.cost = clamp(me(s).competence.cost + 3, 0, 95); return 'Нейтрально и солидно.'; } }
      ]
    },
    {
      id: 'energy',
      title: 'Счета за электричество снова растут',
      text: 'Регулятор поднял потолок цен. Спор о зелёной повестке вспыхнул заново.',
      weight: 7,
      options: [
        { label: 'Ускорить переход на возобновляемую энергию', run: function (s) { var ps = me(s); ps.positions.climate = clamp(ps.positions.climate - 8, -100, 100); salience(s, 'climate', 5); return 'Вы связали счета с зелёной энергетикой.'; } },
        { label: 'Отложить климатические расходы', run: function (s) { var ps = me(s); ps.positions.climate = clamp(ps.positions.climate + 8, -100, 100); salience(s, 'climate', 4); salience(s, 'cost', 2); return 'Вы обещали снять «зелёные» надбавки со счетов.'; } },
        { label: 'Обещать заморозку тарифов', run: function (s) { salience(s, 'cost', 5); bump(s, 'approval', 3); bump(s, 'unity', -2); return 'Популярно. Экономисты спрашивают, кто заплатит.'; } }
      ]
    },
    {
      id: 'poll_shock',
      title: 'Опрос-выброс',
      text: 'Одна социологическая служба выдала цифры, резко отличающиеся от остальных. В студиях паника.',
      weight: 6,
      options: [
        { label: 'Играть ожиданиями: «мы отстаём»', run: function (s) { bump(s, 'activists', 5); bump(s, 'momentum', -0.3); return 'Актив мобилизован страхом поражения.'; } },
        { label: 'Объявить, что победа близка', run: function (s, rng) { if (rng.chance(0.5)) { bump(s, 'momentum', 1.5); return 'Инерция успеха работает на вас.'; } bump(s, 'activists', -4); return 'Сторонники расслабились.'; } }
      ]
    },
    {
      id: 'health',
      title: 'Лидер валится с ног',
      text: 'Врач советует снять два дня из графика.',
      weight: 5,
      condition: function (s) { return s.stamina < 55; },
      options: [
        { label: 'Отменить поездки и отдохнуть', run: function (s) { bump(s, 'stamina', 26); bump(s, 'momentum', -0.8); return 'График расчищен, лидер выспался.'; } },
        { label: 'Ехать дальше', run: function (s, rng) { if (rng.chance(0.4)) { bump(s, 'stamina', -14); bump(s, 'approval', -4); return 'Лидер сорвал голос прямо в эфире.'; } bump(s, 'approval', 2); return 'Выдержал. Пресса пишет о выносливости.'; } }
      ]
    },
    {
      id: 'union_row',
      title: 'Спор о будущем Союза',
      text: 'В Эдинбурге снова говорят о референдуме. Лондонские студии требуют вашего ответа.',
      weight: 5,
      options: [
        { label: 'Категорическое «нет» новому референдуму', run: function (s) { var ps = me(s); ps.positions.union = clamp(ps.positions.union + 10, -100, 100); salience(s, 'union', 4); return 'Юнионисты довольны, Шотландия — нет.'; } },
        { label: 'Референдум — дело шотландцев', run: function (s) { var ps = me(s); ps.positions.union = clamp(ps.positions.union - 10, -100, 100); salience(s, 'union', 4); return 'В Шотландии вас услышали, в Англии запомнили.'; } },
        { label: 'Говорить о деньгах, а не о флагах', run: function (s) { salience(s, 'cost', 3); salience(s, 'union', -1); return 'Тема Союза ушла из эфира.'; } }
      ]
    },
    {
      id: 'crime_wave',
      title: 'Громкое преступление',
      text: 'Нападение в центре большого города открывает все выпуски новостей.',
      weight: 6,
      options: [
        { label: 'Обещать 10 000 новых полицейских', run: function (s) { var ps = me(s); ps.positions.crime = clamp(ps.positions.crime + 7, -100, 100); salience(s, 'crime', 5); return 'Жёсткий ответ занял вечерние эфиры.'; } },
        { label: 'Говорить о причинах и профилактике', run: function (s) { var ps = me(s); ps.positions.crime = clamp(ps.positions.crime - 6, -100, 100); salience(s, 'crime', 3); return 'Вдумчиво, но таблоиды недовольны.'; } }
      ]
    },
    {
      id: 'housing',
      title: 'Протест против застройки',
      text: 'В зажиточном пригороде жители вышли против нового микрорайона.',
      weight: 5,
      options: [
        { label: 'Строить: стране нужно жильё', run: function (s) { var ps = me(s); ps.positions.housing = clamp(ps.positions.housing - 8, -100, 100); salience(s, 'housing', 4); return 'Молодые избиратели заметили.'; } },
        { label: 'Поддержать местных жителей', run: function (s) { var ps = me(s); ps.positions.housing = clamp(ps.positions.housing + 8, -100, 100); salience(s, 'housing', 3); return 'В пригородах вам аплодируют.'; } }
      ]
    }
  ];

  function pickEvent(state, rng) {
    var pool = EVENTS.filter(function (e) {
      if (state.usedEvents && state.usedEvents.indexOf(e.id) >= 0) return false;
      return !e.condition || e.condition(state);
    });
    if (!pool.length) return null;
    var total = pool.reduce(function (s, e) { return s + e.weight; }, 0);
    var r = rng.next() * total;
    for (var i = 0; i < pool.length; i++) {
      r -= pool[i].weight;
      if (r <= 0) return pool[i];
    }
    return pool[pool.length - 1];
  }

  /* ---- Телевизионные дебаты ---- */

  var DEBATE_MOVES = [
    {
      id: 'attack', label: 'Атаковать соперника',
      hint: 'Работает при высокой харизме и слабом рейтинге оппонента.',
      score: function (ps, state, rng) {
        var lead = state.parties[topRival(state)];
        return (ps.leader.charisma - 50) * 0.9 - lead.leader.approval * 0.3 + rng.normal(0, 14);
      },
      effect: function (state, ok) {
        var rival = topRival(state);
        if (ok) { state.parties[rival].leader.approval -= 4; PP.addEffort(state, 'london', rival, -0.4); }
        else { me(state).leader.approval -= 3; }
      }
    },
    {
      id: 'detail', label: 'Уйти в детали программы',
      hint: 'Ставка на компетентность: цифры, сроки, источники финансирования.',
      score: function (ps, state, rng) { return (ps.leader.competence - 50) * 1.1 + rng.normal(0, 12); },
      effect: function (state, ok) {
        var ps = me(state);
        PP.ISSUE_IDS.forEach(function (id) { ps.competence[id] = clamp(ps.competence[id] + (ok ? 2 : 0), 0, 95); });
      }
    },
    {
      id: 'presidential', label: 'Держаться государственно',
      hint: 'Спокойный тон, обращение к камере, никаких склок.',
      score: function (ps, state, rng) { return (ps.leader.integrity - 45) * 0.8 + (ps.leader.approval) * 0.3 + rng.normal(0, 11); },
      effect: function (state, ok) { if (ok) me(state).unity = clamp(me(state).unity + 4, 5, 100); }
    },
    {
      id: 'signature', label: 'Бить в одну тему',
      hint: 'Всё сводить к теме, где партия сильнее всего.',
      score: function (ps, state, rng) {
        var best = 0;
        PP.ISSUE_IDS.forEach(function (id) {
          var w = (state.salience[id] / 20) * (ps.competence[id] - 45);
          if (w > best) best = w;
        });
        return best * 1.3 + rng.normal(0, 13);
      },
      effect: function (state, ok) {
        if (!ok) return;
        var ps = me(state), bestId = PP.ISSUE_IDS[0], best = -99;
        PP.ISSUE_IDS.forEach(function (id) {
          var w = (state.salience[id] / 20) * (ps.competence[id] - 45);
          if (w > best) { best = w; bestId = id; }
        });
        state.salience[bestId] = clamp(state.salience[bestId] + 4, 1, 45);
      }
    }
  ];

  function topRival(state) {
    var nat = PP.nationalShares(state);
    var best = null, bestVal = -1;
    Object.keys(nat).forEach(function (pid) {
      if (pid === state.playerId || pid === 'oth') return;
      if (!PP.PARTY_BY_ID[pid].playable && pid !== 'pc') return;
      if (nat[pid] > bestVal) { bestVal = nat[pid]; best = pid; }
    });
    return best || 'con';
  }

  function resolveDebate(state, moveId, rng) {
    var move = DEBATE_MOVES.filter(function (m) { return m.id === moveId; })[0];
    var ps = me(state);
    var raw = move.score(ps, state, rng) + (state.stamina - 60) / 6;
    var ok = raw > 0;
    var big = Math.abs(raw) > 22;
    move.effect(state, ok);
    var swing = clamp(raw / 12, -3.5, 3.5);
    ps.momentum = clamp(ps.momentum + swing, -14, 14);
    ps.leader.approval = clamp(ps.leader.approval + swing * 1.6, -80, 80);
    state.stamina = clamp(state.stamina - 10, 0, 100);
    var verdict;
    if (big && ok) verdict = 'Разгром: опросы после эфира отдают вечер вам с большим отрывом.';
    else if (ok) verdict = 'Вы выиграли вечер по очкам.';
    else if (big) verdict = 'Провал. Комментаторы называют это худшим выступлением кампании.';
    else verdict = 'Ничья, склоняющаяся не в вашу пользу.';
    return { ok: ok, swing: swing, text: verdict };
  }

  PP.EVENTS = EVENTS;
  PP.pickEvent = pickEvent;
  PP.DEBATE_MOVES = DEBATE_MOVES;
  PP.resolveDebate = resolveDebate;
  PP.topRival = topRival;
})(typeof globalThis !== 'undefined' ? globalThis : this);
