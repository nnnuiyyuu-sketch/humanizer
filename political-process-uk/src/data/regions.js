/*
 * Регионы Великобритании: число мест в Палате общин (по границам 2024 года,
 * всего 650), стартовые доли партий (вымышленный сценарий) и демография.
 * Демография — индексы 0..100 относительно среднего по стране (50).
 *   age        — доля пожилых избирателей
 *   degree     — доля с высшим образованием
 *   leave      — евроскептицизм и «антиистеблишментность»
 *   urban      — урбанизация
 *   prosperity — благосостояние
 */
(function (root) {
  'use strict';

  var REGIONS = [
    {
      id: 'north_east', name: 'Северо-Восток', seats: 27, nation: 'england',
      demo: { age: 58, degree: 40, leave: 66, urban: 58, prosperity: 34 },
      flavour: 'Верфи, шахтёрские посёлки и футбол. Голосуют по привычке — пока привычку кто-нибудь не сломает.',
      base: { lab: 34, con: 21, ld: 8, ref: 24, grn: 8, oth: 5 }
    },
    {
      id: 'north_west', name: 'Северо-Запад', seats: 73, nation: 'england',
      demo: { age: 50, degree: 47, leave: 58, urban: 70, prosperity: 43 },
      flavour: 'Манчестер и Ливерпуль против ланкаширских городков: два разных избирателя в одном регионе.',
      base: { lab: 36, con: 23, ld: 9, ref: 20, grn: 7, oth: 5 }
    },
    {
      id: 'yorkshire', name: 'Йоркшир и Хамбер', seats: 54, nation: 'england',
      demo: { age: 52, degree: 44, leave: 63, urban: 60, prosperity: 41 },
      flavour: 'Йоркшир любит, когда с ним говорят прямо, и не прощает, когда его считают решённым делом.',
      base: { lab: 32, con: 25, ld: 9, ref: 23, grn: 7, oth: 4 }
    },
    {
      id: 'east_midlands', name: 'Ист-Мидлендс', seats: 47, nation: 'england',
      demo: { age: 55, degree: 43, leave: 68, urban: 48, prosperity: 46 },
      flavour: 'Логистические склады вдоль M1 и старые шахтёрские городки. Здесь выигрывают выборы.',
      base: { lab: 28, con: 30, ld: 8, ref: 24, grn: 6, oth: 4 }
    },
    {
      id: 'west_midlands', name: 'Уэст-Мидлендс', seats: 57, nation: 'england',
      demo: { age: 52, degree: 44, leave: 67, urban: 65, prosperity: 44 },
      flavour: 'Бирмингем и Чёрная страна: заводы, мечети, пабы и самые качающиеся округа Англии.',
      base: { lab: 30, con: 29, ld: 8, ref: 23, grn: 6, oth: 4 }
    },
    {
      id: 'east', name: 'Восточная Англия', seats: 61, nation: 'england',
      demo: { age: 58, degree: 50, leave: 62, urban: 45, prosperity: 58 },
      flavour: 'Фермы, порты и новые пригороды. Тихий регион, который умеет удивлять в ночь подсчёта.',
      base: { lab: 25, con: 34, ld: 11, ref: 20, grn: 6, oth: 4 }
    },
    {
      id: 'london', name: 'Лондон', seats: 75, nation: 'england',
      demo: { age: 34, degree: 74, leave: 30, urban: 98, prosperity: 60 },
      flavour: 'Молодой, образованный, дорогой и упрямо не похожий на остальную страну.',
      base: { lab: 40, con: 26, ld: 13, ref: 10, grn: 9, oth: 2 }
    },
    {
      id: 'south_east', name: 'Юго-Восток', seats: 91, nation: 'england',
      demo: { age: 56, degree: 58, leave: 50, urban: 52, prosperity: 68 },
      flavour: 'Пояс достатка вокруг столицы: сады, пригородные поезда и очень много округов.',
      base: { lab: 23, con: 36, ld: 16, ref: 17, grn: 6, oth: 2 }
    },
    {
      id: 'south_west', name: 'Юго-Запад', seats: 58, nation: 'england',
      demo: { age: 64, degree: 52, leave: 55, urban: 38, prosperity: 50 },
      flavour: 'Курорты, деревни и университетский Бристоль. Классическая земля либдемов.',
      base: { lab: 21, con: 33, ld: 20, ref: 18, grn: 7, oth: 1 }
    },
    {
      id: 'wales', name: 'Уэльс', seats: 32, nation: 'wales',
      demo: { age: 58, degree: 43, leave: 60, urban: 48, prosperity: 36 },
      flavour: 'Долины, побережье и вопрос о языке. Лейбористская крепость с трещинами.',
      base: { lab: 32, con: 22, ld: 6, ref: 18, grn: 5, pc: 15, oth: 2 }
    },
    {
      id: 'scotland', name: 'Шотландия', seats: 57, nation: 'scotland',
      demo: { age: 52, degree: 55, leave: 38, urban: 62, prosperity: 45 },
      flavour: 'Четыре партии на пятьдесят семь округов и вечный вопрос о независимости.',
      base: { lab: 26, con: 16, ld: 10, ref: 10, grn: 4, snp: 33, oth: 1 }
    },
    {
      id: 'n_ireland', name: 'Северная Ирландия', seats: 18, nation: 'n_ireland',
      demo: { age: 50, degree: 46, leave: 44, urban: 55, prosperity: 40 },
      flavour: 'Отдельная партийная система: игрок здесь не выдвигается, но мандаты считаются.',
      base: {}, ni: true
    }
  ];

  var BY_ID = {};
  REGIONS.forEach(function (r) { BY_ID[r.id] = r; });

  var CAMPAIGN_REGIONS = REGIONS.filter(function (r) { return !r.ni; });

  var TOTAL_SEATS = REGIONS.reduce(function (s, r) { return s + r.seats; }, 0);

  /*
   * Предпочтения избирателей региона по каждой теме выводятся из демографии,
   * чтобы данные не расходились сами с собой.
   */
  function regionPreferences(region) {
    var d = region.demo;
    var age = d.age - 50, deg = d.degree - 50, leave = d.leave - 50;
    var urb = d.urban - 50, pro = d.prosperity - 50;
    var clamp = root.PP.clamp;
    return {
      cost: clamp(-8 + 0.55 * pro + 0.25 * age - 0.20 * urb, -100, 100),
      nhs: clamp(-30 + 0.35 * pro - 0.25 * age, -100, 100),
      immig: clamp(10 + 1.05 * leave - 0.65 * deg + 0.30 * age - 0.20 * urb, -100, 100),
      tax: clamp(-2 + 0.75 * pro + 0.35 * age - 0.25 * urb, -100, 100),
      housing: clamp(-6 + 0.55 * age - 0.45 * urb + 0.30 * pro, -100, 100),
      crime: clamp(24 + 0.55 * age + 0.45 * leave - 0.50 * deg, -100, 100),
      climate: clamp(-6 + 0.80 * leave - 0.70 * deg + 0.35 * age, -100, 100),
      europe: clamp(1.35 * leave - 0.35 * deg, -100, 100),
      union: region.nation === 'scotland' ? -10 : (region.nation === 'wales' ? 18 : 55)
    };
  }

  root.PP = root.PP || {};
  root.PP.REGIONS = REGIONS;
  root.PP.REGION_BY_ID = BY_ID;
  root.PP.CAMPAIGN_REGIONS = CAMPAIGN_REGIONS;
  root.PP.TOTAL_SEATS = TOTAL_SEATS;
  root.PP.regionPreferences = regionPreferences;
})(typeof globalThis !== 'undefined' ? globalThis : this);
