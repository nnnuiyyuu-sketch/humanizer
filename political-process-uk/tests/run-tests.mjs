/*
 * Тесты модели. Запуск: node tests/run-tests.mjs
 * Игровые файлы — обычные скрипты с общим объектом PP, поэтому они грузятся
 * в отдельный контекст vm: тот же порядок, что и в index.html.
 */
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const FILES = [
  'src/core/rng.js', 'src/data/issues.js', 'src/data/parties.js', 'src/data/regions.js',
  'src/data/places.js', 'src/core/seats.js', 'src/core/polling.js', 'src/core/state.js',
  'src/core/actions.js', 'src/core/events.js', 'src/core/ai.js', 'src/core/turn.js',
  'src/core/election.js', 'src/core/coalition.js'
];

function loadPP() {
  const ctx = vm.createContext({ Math, console, JSON, Date, isNaN, parseFloat, parseInt });
  for (const f of FILES) {
    vm.runInContext(fs.readFileSync(path.join(rootDir, f), 'utf8'), ctx, { filename: f });
  }
  return ctx.PP;
}

const PP = loadPP();
let passed = 0;
const failures = [];

function test(name, fn) {
  try { fn(); passed++; }
  catch (e) { failures.push(name + ' — ' + e.message); }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'условие не выполнено'); }
function near(a, b, eps, msg) { assert(Math.abs(a - b) <= eps, (msg || '') + ' (' + a + ' vs ' + b + ')'); }

/* ---------- данные ---------- */

test('в стране ровно 650 округов', () => {
  assert(PP.TOTAL_SEATS === 650, 'мест: ' + PP.TOTAL_SEATS);
});

test('стартовые доли в каждом регионе дают 100%', () => {
  PP.CAMPAIGN_REGIONS.forEach(r => {
    const sum = Object.values(r.base).reduce((a, b) => a + b, 0);
    near(sum, 100, 0.001, r.id);
  });
});

test('у каждой партии есть позиция по каждой теме', () => {
  PP.PARTIES.forEach(p => {
    PP.ISSUE_IDS.forEach(id => {
      assert(typeof p.positions[id] === 'number', p.id + ' без позиции по ' + id);
      assert(typeof p.competence[id] === 'number', p.id + ' без компетентности по ' + id);
    });
  });
});

/* ---------- генератор ---------- */

test('один и тот же seed даёт одинаковые округа', () => {
  const a = PP.generateSeats('x1'), b = PP.generateSeats('x1'), c = PP.generateSeats('x2');
  /* Генератор нарезает только Великобританию: 18 округов Северной Ирландии
     моделируются отдельным блоком. */
  const gb = 650 - PP.REGION_BY_ID.n_ireland.seats;
  assert(a.length === gb && b.length === gb, 'округов: ' + a.length);
  assert(a[17].name === b[17].name, 'имена разошлись при одинаковом seed');
  assert(JSON.stringify(a[17].demo) === JSON.stringify(b[17].demo));
  assert(a[17].name !== c[17].name || a[300].name !== c[300].name, 'разные seed дали одинаковую нарезку');
});

/* ---------- модель поддержки ---------- */

test('доли партий в регионе нормированы', () => {
  const s = PP.newGame({ seed: 'poll', playerId: 'lab' });
  PP.CAMPAIGN_REGIONS.forEach(r => {
    const sh = PP.regionShares(s, r);
    const sum = Object.values(sh).reduce((a, b) => a + b, 0);
    near(sum, 100, 0.01, r.id);
    Object.values(sh).forEach(v => assert(v >= 0, 'отрицательная доля в ' + r.id));
  });
});

test('результат округа нормирован и определяет победителя', () => {
  const s = PP.newGame({ seed: 'seat', playerId: 'con' });
  const shares = PP.allRegionShares(s);
  const seat = s.seats[42];
  const res = PP.seatResult(seat, shares[seat.region], { noise: 0 });
  near(Object.values(res.shares).reduce((a, b) => a + b, 0), 100, 0.01);
  assert(res.shares[res.winner] >= res.shares[res.runnerUp], 'победитель не первый');
});

test('мажоритарная система усиливает лидера', () => {
  const s = PP.newGame({ seed: 'fptp', playerId: 'lab' });
  const nat = PP.nationalShares(s);
  const proj = PP.projectSeats(s, null, { incumbency: 0 });
  const leader = Object.keys(nat).sort((a, b) => nat[b] - nat[a])[0];
  const seatShare = (proj[leader] || 0) / PP.TOTAL_SEATS * 100;
  assert(seatShare > nat[leader], 'лидер получил мест меньше, чем голосов: ' + seatShare + ' vs ' + nat[leader]);
});

test('партия с ровным по стране результатом получает мало мест', () => {
  const s = PP.newGame({ seed: 'even', playerId: 'lab' });
  const nat = PP.nationalShares(s);
  const proj = PP.projectSeats(s, null, { incumbency: 0 });
  const refSeatShare = (proj.ref || 0) / PP.TOTAL_SEATS * 100;
  assert(refSeatShare < nat.ref, 'Reform не наказан за размазанность: ' + refSeatShare + ' vs ' + nat.ref);
});

/* ---------- действия и ход ---------- */

test('тур по региону поднимает поддержку именно в этом регионе', () => {
  const s = PP.newGame({ seed: 'act', playerId: 'con' });
  const before = PP.regionShares(s, PP.REGION_BY_ID.south_east).con;
  const otherBefore = PP.regionShares(s, PP.REGION_BY_ID.london).con;
  PP.performAction(s, 'con', 'rally', { regionId: 'south_east' }, new PP.Rng('a'));
  const after = PP.regionShares(s, PP.REGION_BY_ID.south_east).con;
  const otherAfter = PP.regionShares(s, PP.REGION_BY_ID.london).con;
  assert(after > before + 0.5, 'рост в целевом регионе: ' + before + ' → ' + after);
  near(otherAfter, otherBefore, 0.35, 'изменился чужой регион');
});

test('действие тратит очки расписания и деньги', () => {
  const s = PP.newGame({ seed: 'ap', playerId: 'lab' });
  const funds = s.parties.lab.funds;
  PP.performAction(s, 'lab', 'rally', { regionId: 'london' }, new PP.Rng('b'));
  assert(s.ap === s.apMax - 1, 'AP не списаны');
  assert(s.parties.lab.funds < funds, 'деньги не списаны');
});

test('нельзя действовать без денег', () => {
  const s = PP.newGame({ seed: 'broke', playerId: 'grn' });
  s.parties.grn.funds = 0;
  assert(PP.canRunAction(s, 'grn', 'broadcast').ok === false);
  assert(PP.canRunAction(s, 'grn', 'media').ok === true, 'бесплатное действие тоже заблокировано');
});

test('эффект кампании затухает между неделями', () => {
  const s = PP.newGame({ seed: 'decay', playerId: 'lab' });
  PP.performAction(s, 'lab', 'rally', { regionId: 'wales' }, new PP.Rng('c'));
  const boost = s.effort.wales.lab;
  PP.endWeek(s);
  assert(s.effort.wales.lab < boost, 'эффект не затух');
  assert(s.effort.wales.lab > 0, 'эффект исчез мгновенно');
});

test('кампания заканчивается днём голосования', () => {
  const s = PP.newGame({ seed: 'weeks', playerId: 'lab', weeks: 6 });
  for (let i = 0; i < 6; i++) {
    PP.endWeek(s);
    if (s.pendingEvent) PP.resolveEventChoice(s, 0);
    if (s.pendingDebate) PP.resolveDebateChoice(s, 'detail');
  }
  assert(s.phase === 'election', 'фаза: ' + s.phase);
  assert(s.pollHistory.length >= 6, 'опросы не публиковались');
});

/* ---------- выборы ---------- */

test('на выборах распределяются все 650 мандатов', () => {
  const s = PP.newGame({ seed: 'elect', playerId: 'lab', weeks: 6 });
  while (s.phase === 'campaign') {
    PP.endWeek(s);
    if (s.pendingEvent) PP.resolveEventChoice(s, 0);
    if (s.pendingDebate) PP.resolveDebateChoice(s, 'attack');
  }
  const r = PP.runElection(s);
  const total = Object.values(r.seats).reduce((a, b) => a + b, 0);
  assert(total === 650, 'мандатов: ' + total);
  near(Object.values(r.votes).reduce((a, b) => a + b, 0), 100, 0.5, 'сумма голосов');
});

test('выборы воспроизводимы при одинаковом состоянии', () => {
  const s = PP.newGame({ seed: 'repeat', playerId: 'lab', weeks: 6 });
  const a = PP.runElection(s);
  const b = PP.runElection(s);
  assert(JSON.stringify(a.seats) === JSON.stringify(b.seats), 'результат нестабилен');
});

test('порог большинства учитывает неголосующих депутатов', () => {
  const m = PP.majorityThreshold({ sf: 7, lab: 300 });
  assert(m.formal === 326);
  assert(m.effective === 322, 'порог: ' + m.effective);
});

/* ---------- правительство ---------- */

test('абсолютное большинство даёт однопартийное правительство', () => {
  const s = PP.newGame({ seed: 'gov', playerId: 'lab' });
  const result = { seats: { lab: 340, con: 200, ld: 50, sf: 7 }, majority: PP.majorityThreshold({ lab: 340, sf: 7 }) };
  const gov = PP.formGovernment(s, result, 'lab', [], {});
  assert(gov.kind === 'majority', gov.kind);
});

test('близкий партнёр соглашается, далёкий отказывает', () => {
  const s = PP.newGame({ seed: 'coal', playerId: 'lab' });
  const seats = { lab: 280, con: 220, ld: 50, ref: 40, grn: 8, snp: 30, sf: 7 };
  const result = { seats, majority: PP.majorityThreshold(seats) };
  const near_ = PP.coalitionWillingness(s, result, 'lab', 'ld', { cabinet: true });
  const far = PP.coalitionWillingness(s, result, 'lab', 'ref', { cabinet: true });
  assert(near_ > far, 'либдемы должны быть сговорчивее Reform: ' + near_ + ' vs ' + far);
});

test('коалиция набирает большинство и меняет тип правительства', () => {
  const s = PP.newGame({ seed: 'coal2', playerId: 'lab' });
  const seats = { lab: 300, con: 230, ld: 55, grn: 10, snp: 30, sf: 7 };
  const result = { seats, majority: PP.majorityThreshold(seats) };
  const gov = PP.formGovernment(s, result, 'lab', ['ld', 'grn'], { cabinet: true });
  assert(gov.kind === 'coalition' || gov.kind === 'majority', gov.kind);
  assert(gov.seats >= gov.threshold, 'мандатов не хватило: ' + gov.seats);
});

/* ---------- сохранение ---------- */

test('состояние переживает сериализацию в JSON', () => {
  const s = PP.newGame({ seed: 'save', playerId: 'ld', weeks: 6 });
  PP.performAction(s, 'ld', 'ground', { regionId: 'south_west' }, new PP.Rng('d'));
  const copy = JSON.parse(JSON.stringify(s));
  copy._cacheRegionShares = null;
  const a = PP.nationalShares(s), b = PP.nationalShares(copy);
  PP.ISSUE_IDS.length;
  Object.keys(a).forEach(pid => near(a[pid], b[pid], 0.0001, pid));
  PP.endWeek(copy);
  assert(copy.week === 2, 'после загрузки ход не идёт');
});

/* ---------- итог ---------- */

console.log('Тестов пройдено: ' + passed + ' из ' + (passed + failures.length));
if (failures.length) {
  failures.forEach(f => console.error('  ✗ ' + f));
  process.exit(1);
}
console.log('Все тесты прошли.');
