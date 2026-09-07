/*
 * Партии. Стартовая расстановка — вымышленный сценарий «канун всеобщих
 * выборов», вдохновлённый реальной британской политикой, но не копирующий
 * её цифры. Позиции — шкала -100..+100 (см. issues.js).
 */
(function (root) {
  'use strict';

  var PARTIES = [
    {
      id: 'lab', name: 'Labour', ru: 'Лейбористы', abbr: 'LAB',
      color: '#e4003b', playable: true, scope: 'gb',
      family: 'left',
      leader: { name: 'Хелен Марш', charisma: 52, competence: 66, integrity: 58, approval: 4 },
      funds: 9.5, activists: 62, unity: 74, target: 326,
      goals: [{ seats: 180, label: 'Остаться главной оппозицией' }, { seats: 260, label: 'Крупнейшая партия Палаты' }, { seats: 326, label: 'Правительство большинства' }, { seats: 400, label: 'Разгром соперников' }],
      positions: { cost: -32, nhs: -55, immig: -6, tax: -26, housing: -34, crime: 8, climate: -42, europe: -22, union: 55 },
      competence: { cost: 52, nhs: 68, immig: 40, tax: 50, housing: 52, crime: 48, climate: 55, europe: 50, union: 55 },
      affinity: { urban: 0.55, degree: 0.20, age: -0.45, leave: -0.10, prosperity: -0.40 },
      concentration: 0.16,
      blurb: 'Партия власти в этом сценарии: устала, но организована. Держит «красную стену» и большие города.'
    },
    {
      id: 'con', name: 'Conservative', ru: 'Консерваторы', abbr: 'CON',
      color: '#0087dc', playable: true, scope: 'gb',
      family: 'right',
      leader: { name: 'Эдвард Финчли', charisma: 48, competence: 60, integrity: 47, approval: -12 },
      funds: 13.0, activists: 45, unity: 55, target: 326,
      goals: [{ seats: 150, label: 'Удержать ядро партии' }, { seats: 230, label: 'Реванш начат' }, { seats: 300, label: 'Крупнейшая партия Палаты' }, { seats: 326, label: 'Правительство большинства' }],
      positions: { cost: 28, nhs: 18, immig: 55, tax: 52, housing: 14, crime: 58, climate: 22, europe: 44, union: 70 },
      competence: { cost: 45, nhs: 38, immig: 44, tax: 58, housing: 40, crime: 58, climate: 35, europe: 45, union: 62 },
      affinity: { urban: -0.50, degree: -0.05, age: 0.70, leave: 0.25, prosperity: 0.45 },
      concentration: 0.16,
      blurb: 'Богатая касса и сельский юг. Проблема — Reform откусывает правый фланг, а центр не прощает.'
    },
    {
      id: 'ld', name: 'Liberal Democrats', ru: 'Либдемы', abbr: 'LD',
      color: '#faa61a', playable: true, scope: 'gb',
      family: 'centre',
      leader: { name: 'Роджер Стэнбридж', charisma: 55, competence: 54, integrity: 66, approval: 6 },
      funds: 4.0, activists: 40, unity: 82, target: 75,
      goals: [{ seats: 20, label: 'Сохранить фракцию' }, { seats: 45, label: 'Третья сила Палаты' }, { seats: 75, label: 'Ключ от подвешенного парламента' }, { seats: 110, label: 'Лучший результат за век' }],
      positions: { cost: -14, nhs: -42, immig: -32, tax: -8, housing: -26, crime: -12, climate: -52, europe: -66, union: 25 },
      competence: { cost: 42, nhs: 52, immig: 42, tax: 44, housing: 46, crime: 44, climate: 58, europe: 60, union: 48 },
      affinity: { urban: -0.10, degree: 0.60, age: 0.15, leave: -0.60, prosperity: 0.35 },
      concentration: 0.66,
      blurb: 'Хирургическая партия: национальный процент мал, но там, где она вторая, она берёт округ целиком.'
    },
    {
      id: 'ref', name: 'Reform UK', ru: 'Reform UK', abbr: 'REF',
      color: '#12b6cf', playable: true, scope: 'gb',
      family: 'right',
      leader: { name: 'Дерек Хоулэнд', charisma: 72, competence: 44, integrity: 38, approval: -4 },
      funds: 5.5, activists: 24, unity: 62, target: 60,
      goals: [{ seats: 12, label: 'Плацдарм в Палате' }, { seats: 40, label: 'Прорыв' }, { seats: 80, label: 'Слом двухпартийной системы' }, { seats: 150, label: 'Новая правая партия власти' }],
      positions: { cost: 22, nhs: 6, immig: 92, tax: 66, housing: 28, crime: 82, climate: 74, europe: 88, union: 58 },
      competence: { cost: 38, nhs: 28, immig: 62, tax: 42, housing: 30, crime: 55, climate: 24, europe: 58, union: 45 },
      affinity: { urban: -0.30, degree: -0.75, age: 0.40, leave: 0.90, prosperity: -0.35 },
      concentration: 0.11,
      blurb: 'Голоса размазаны ровным слоем по стране — худший из возможных раскладов при мажоритарной системе.'
    },
    {
      id: 'grn', name: 'Green Party', ru: 'Зелёные', abbr: 'GRN',
      color: '#5cb85c', playable: true, scope: 'gb',
      family: 'left',
      leader: { name: 'Айла Реншоу', charisma: 58, competence: 46, integrity: 74, approval: 8 },
      funds: 1.6, activists: 30, unity: 78, target: 12,
      goals: [{ seats: 3, label: 'Удержать своих' }, { seats: 10, label: 'Полноценная группа' }, { seats: 25, label: 'Зелёная волна' }, { seats: 50, label: 'Партия первого ряда' }],
      positions: { cost: -60, nhs: -70, immig: -58, tax: -62, housing: -30, crime: -38, climate: -95, europe: -58, union: -5 },
      competence: { cost: 34, nhs: 40, immig: 32, tax: 30, housing: 36, crime: 30, climate: 74, europe: 44, union: 38 },
      affinity: { urban: 0.35, degree: 0.80, age: -0.55, leave: -0.70, prosperity: -0.05 },
      concentration: 0.78,
      blurb: 'Университетские города и левый фланг лейбористов. Мало денег, много волонтёров.'
    },
    {
      id: 'snp', name: 'SNP', ru: 'ШНП', abbr: 'SNP',
      color: '#fdf38e', playable: true, scope: 'scotland',
      family: 'left',
      leader: { name: 'Мойра Дункан', charisma: 60, competence: 58, integrity: 55, approval: 2 },
      funds: 2.4, activists: 44, unity: 66, target: 30,
      goals: [{ seats: 12, label: 'Пережить бурю' }, { seats: 28, label: 'Голос Шотландии' }, { seats: 40, label: 'Доминирование в Шотландии' }, { seats: 50, label: 'Мандат на референдум' }],
      positions: { cost: -36, nhs: -52, immig: -38, tax: -30, housing: -28, crime: -8, climate: -56, europe: -68, union: -100 },
      competence: { cost: 44, nhs: 46, immig: 42, tax: 42, housing: 44, crime: 46, climate: 52, europe: 54, union: 70 },
      affinity: { urban: 0.20, degree: 0.10, age: -0.10, leave: -0.45, prosperity: -0.20 },
      concentration: 0.17,
      blurb: 'Играет только в Шотландии: 57 округов, но за них борются сразу четыре партии.'
    },
    {
      id: 'pc', name: 'Plaid Cymru', ru: 'Плайд Камри', abbr: 'PC',
      color: '#008142', playable: false, scope: 'wales',
      family: 'left',
      leader: { name: 'Гвен Ллойд', charisma: 50, competence: 50, integrity: 60, approval: 0 },
      funds: 0.8, activists: 26, unity: 74, target: 6,
      goals: [{ seats: 2, label: 'Сохранить представительство' }, { seats: 5, label: 'Голос Уэльса' }, { seats: 9, label: 'Хозяева Уэльса' }],
      positions: { cost: -40, nhs: -55, immig: -35, tax: -34, housing: -25, crime: -10, climate: -60, europe: -62, union: -85 },
      competence: { cost: 38, nhs: 44, immig: 36, tax: 36, housing: 40, crime: 40, climate: 50, europe: 48, union: 62 },
      affinity: { urban: -0.15, degree: 0.10, age: 0.05, leave: -0.25, prosperity: -0.25 },
      concentration: 0.5,
      blurb: 'Валлийские националисты: сильны на западе и севере Уэльса.'
    },
    {
      id: 'oth', name: 'Independents & others', ru: 'Независимые и прочие', abbr: 'IND',
      color: '#8d8d8d', playable: false, scope: 'gb',
      family: 'centre',
      leader: { name: '—', charisma: 40, competence: 40, integrity: 50, approval: 0 },
      funds: 0.5, activists: 10, unity: 50, target: 3,
      goals: [{ seats: 1, label: 'Независимый депутат' }],
      positions: { cost: -10, nhs: -20, immig: 0, tax: -5, housing: -5, crime: 5, climate: -15, europe: -10, union: 10 },
      competence: { cost: 35, nhs: 35, immig: 35, tax: 35, housing: 35, crime: 35, climate: 35, europe: 35, union: 35 },
      affinity: { urban: 0.25, degree: 0.0, age: -0.05, leave: 0.0, prosperity: -0.30 },
      concentration: 0.85,
      blurb: 'Местные кампании, отколовшиеся депутаты, «спикер» и прочие.'
    }
  ];

  /* Партии Северной Ирландии моделируются отдельным блоком: игрок за них
     не играет, но их места считаются в общем зачёте Палаты общин. */
  var NI_PARTIES = [
    { id: 'dup', name: 'DUP', ru: 'DUP', abbr: 'DUP', color: '#d46a4c', bloc: 'unionist', base: 5 },
    { id: 'sf', name: 'Sinn Fein', ru: 'Шинн Фейн', abbr: 'SF', color: '#326760', bloc: 'nationalist', base: 7, abstains: true },
    { id: 'apni', name: 'Alliance', ru: 'Alliance', abbr: 'APNI', color: '#f6cb2f', bloc: 'other', base: 2 },
    { id: 'sdlp', name: 'SDLP', ru: 'SDLP', abbr: 'SDLP', color: '#2aa82c', bloc: 'nationalist', base: 2 },
    { id: 'uup', name: 'UUP', ru: 'UUP', abbr: 'UUP', color: '#48a5ee', bloc: 'unionist', base: 1 },
    { id: 'tuv', name: 'TUV', ru: 'TUV', abbr: 'TUV', color: '#0c3a6a', bloc: 'unionist', base: 1 }
  ];

  var BY_ID = {};
  PARTIES.concat(NI_PARTIES).forEach(function (p) { BY_ID[p.id] = p; });

  /* Идеологическая дистанция для коалиционных переговоров. */
  function ideologyDistance(a, b) {
    var pa = BY_ID[a], pb = BY_ID[b];
    if (!pa || !pb || !pa.positions || !pb.positions) return 100;
    var ids = root.PP.ISSUE_IDS, sum = 0;
    for (var i = 0; i < ids.length; i++) {
      sum += Math.abs(pa.positions[ids[i]] - pb.positions[ids[i]]);
    }
    return sum / ids.length;
  }

  root.PP = root.PP || {};
  root.PP.PARTIES = PARTIES;
  root.PP.NI_PARTIES = NI_PARTIES;
  root.PP.PARTY_BY_ID = BY_ID;
  root.PP.GB_PARTY_IDS = PARTIES.map(function (p) { return p.id; });
  root.PP.ideologyDistance = ideologyDistance;
})(typeof globalThis !== 'undefined' ? globalThis : this);
