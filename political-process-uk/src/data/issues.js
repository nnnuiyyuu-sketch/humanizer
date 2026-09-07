/*
 * Темы кампании. Позиция партии и предпочтение избирателя измеряются
 * по одной шкале от -100 до +100.
 *   -100 — «левый / либеральный / проевропейский / зелёный» полюс
 *   +100 — «правый / жёсткий / евроскептический» полюс
 * Исключение — union: -100 это независимость региона, +100 — жёсткий юнионизм.
 */
(function (root) {
  'use strict';

  var ISSUES = [
    {
      id: 'cost', name: 'Стоимость жизни', short: 'Цены',
      baseSalience: 20,
      leftLabel: 'Госрегулирование цен и субсидии',
      rightLabel: 'Свободный рынок и снижение налогов'
    },
    {
      id: 'nhs', name: 'NHS и здравоохранение', short: 'NHS',
      baseSalience: 17,
      leftLabel: 'Больше денег и персонала в NHS',
      rightLabel: 'Реформа, частный сектор, эффективность'
    },
    {
      id: 'immig', name: 'Иммиграция и границы', short: 'Границы',
      baseSalience: 16,
      leftLabel: 'Открытость и приём беженцев',
      rightLabel: 'Жёсткий контроль и депортации'
    },
    {
      id: 'tax', name: 'Налоги и экономика', short: 'Налоги',
      baseSalience: 14,
      leftLabel: 'Высокие налоги на богатых, госинвестиции',
      rightLabel: 'Низкие налоги, сокращение расходов'
    },
    {
      id: 'housing', name: 'Жильё', short: 'Жильё',
      baseSalience: 9,
      leftLabel: 'Массовое строительство и соцжильё',
      rightLabel: 'Права местных сообществ, защита зелёного пояса'
    },
    {
      id: 'crime', name: 'Преступность и порядок', short: 'Порядок',
      baseSalience: 8,
      leftLabel: 'Профилактика и реабилитация',
      rightLabel: 'Больше полиции и сроков'
    },
    {
      id: 'climate', name: 'Климат и энергетика', short: 'Климат',
      baseSalience: 8,
      leftLabel: 'Ускорить путь к нулевым выбросам',
      rightLabel: 'Отложить «зелёные» расходы, свои нефть и газ'
    },
    {
      id: 'europe', name: 'Отношения с ЕС', short: 'ЕС',
      baseSalience: 5,
      leftLabel: 'Сближение вплоть до таможенного союза',
      rightLabel: 'Максимальная дистанция от Брюсселя'
    },
    {
      id: 'union', name: 'Целостность Союза', short: 'Союз',
      baseSalience: 3,
      leftLabel: 'Право на независимость и деволюция',
      rightLabel: 'Единое Соединённое Королевство'
    }
  ];

  var BY_ID = {};
  ISSUES.forEach(function (it) { BY_ID[it.id] = it; });

  root.PP = root.PP || {};
  root.PP.ISSUES = ISSUES;
  root.PP.ISSUE_BY_ID = BY_ID;
  root.PP.ISSUE_IDS = ISSUES.map(function (i) { return i.id; });
})(typeof globalThis !== 'undefined' ? globalThis : this);
