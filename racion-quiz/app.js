'use strict';

const CONFIG = {
  storageKey: 'racion-quiz-v1',
  // Необязательная кнопка в конце результата, например запись на консультацию.
  // null — кнопка скрыта. Пример: { text: 'Записаться на консультацию', url: 'https://example.com' }
  cta: null,
};

const ACTIVITY = { sedentary: 1.2, light: 1.375, moderate: 1.55, high: 1.725 };
const DIET_RANK = { vegan: 0, vegetarian: 1, pescatarian: 2, omnivore: 3 };
const SLOT_NAMES = { breakfast: 'Завтрак', lunch: 'Обед', dinner: 'Ужин', snack: 'Перекус' };
const SLOTS = {
  2: [['lunch', 0.5], ['dinner', 0.5]],
  3: [['breakfast', 0.3], ['lunch', 0.4], ['dinner', 0.3]],
  4: [['breakfast', 0.25], ['lunch', 0.35], ['snack', 0.1], ['dinner', 0.3]],
  5: [['breakfast', 0.25], ['snack', 0.1], ['lunch', 0.3], ['snack', 0.1], ['dinner', 0.25]],
};

// ---------- утилиты ----------

const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n, d = 0) => n.toLocaleString('ru-RU', { minimumFractionDigits: d, maximumFractionDigits: d });
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const plural = (n, one, few, many) => {
  const m10 = n % 10; const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  return m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20) ? few : many;
};
const bmiOf = (w, h) => w / ((h / 100) ** 2);
const weightAtBmi = (bmi, h) => bmi * (h / 100) ** 2;

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function bmiCategory(bmi) {
  if (bmi < 18.5) return 'недостаточная масса тела';
  if (bmi < 25) return 'норма';
  if (bmi < 30) return 'избыточная масса тела';
  return 'ожирение';
}

// ---------- шаги теста ----------

const STEPS = [
  {
    id: 'goal', type: 'single',
    title: 'Какая у вас главная цель?',
    hint: 'От цели зависят калорийность и баланс белков, жиров и углеводов.',
    options: [
      { value: 'lose', icon: '📉', label: 'Снизить вес', note: 'Умеренный дефицит калорий, без голодовок' },
      { value: 'gain', icon: '💪', label: 'Набрать мышечную массу', note: 'Небольшой профицит и больше белка' },
      { value: 'maintain', icon: '⚖️', label: 'Удерживать вес', note: 'Есть ровно столько, сколько нужно организму' },
      { value: 'eat_better', icon: '🥗', label: 'Питаться полезнее', note: 'Баланс и разнообразие без подсчёта каждой калории' },
    ],
  },
  {
    id: 'sex', type: 'single',
    title: 'Ваш пол',
    hint: 'Нужен только для формулы расчёта обмена веществ.',
    options: [
      { value: 'female', icon: '👩', label: 'Женский' },
      { value: 'male', icon: '👨', label: 'Мужской' },
    ],
  },
  { id: 'age', type: 'number', title: 'Сколько вам лет?', unit: 'лет', min: 14, max: 80, decimals: 0, placeholder: '30' },
  { id: 'height', type: 'number', title: 'Ваш рост', unit: 'см', min: 130, max: 220, decimals: 0, placeholder: '170' },
  {
    id: 'weight', type: 'number', title: 'Ваш вес сейчас', unit: 'кг', min: 35, max: 250, decimals: 1, placeholder: '70',
    live: (v, a) => {
      const b = bmiOf(v, a.height);
      return `Индекс массы тела: ${fmt(b, 1)} — ${bmiCategory(b)}`;
    },
  },
  {
    id: 'target', type: 'number', title: 'Какой вес хотите получить?', unit: 'кг', min: 35, max: 250, decimals: 1, placeholder: '65',
    // Для недостаточной массы тела снижать вес не предлагаем — шаг пропускается.
    showIf: (a) => a.goal === 'gain' || (a.goal === 'lose' && bmiOf(a.weight, a.height) >= 18.5),
    check: (v, a) => {
      if (a.goal === 'lose') {
        if (v >= a.weight) return 'Цель должна быть меньше текущего веса.';
        const minW = Math.ceil(weightAtBmi(18.5, a.height) * 10) / 10;
        if (v < minW) return `При вашем росте вес ниже ${fmt(minW, 1)} кг — это недостаточная масса тела. Выберите цель повыше.`;
      } else if (v <= a.weight) {
        return 'Цель должна быть больше текущего веса.';
      }
      return '';
    },
    live: (v, a) => {
      const d = v - a.weight;
      return `${d < 0 ? '−' : '+'}${fmt(Math.abs(d), 1)} кг · индекс массы тела при цели ${fmt(bmiOf(v, a.height), 1)}`;
    },
  },
  {
    id: 'activity', type: 'single',
    title: 'Насколько вы активны?',
    hint: 'Выберите то, что ближе к обычной неделе.',
    options: [
      { value: 'sedentary', icon: '🪑', label: 'Сидячий образ жизни', note: 'Офис, мало ходьбы, тренировок нет' },
      { value: 'light', icon: '🚶', label: 'Лёгкая активность', note: '1–2 тренировки в неделю или регулярные прогулки' },
      { value: 'moderate', icon: '🏃', label: 'Умеренная активность', note: '3–4 тренировки в неделю' },
      { value: 'high', icon: '🏋️', label: 'Высокая активность', note: '5+ тренировок или физическая работа' },
    ],
  },
  {
    id: 'health', type: 'multi', exclusive: 'none',
    title: 'Есть ли что-то из этого?',
    hint: 'В этих случаях мы не предлагаем дефицит калорий и советуем сначала обсудить питание с врачом.',
    options: [
      { value: 'pregnant', label: 'Беременность или кормление грудью' },
      { value: 'diabetes', label: 'Диабет или другие нарушения обмена веществ' },
      { value: 'gi', label: 'Заболевания желудочно-кишечного тракта' },
      { value: 'ed', label: 'Расстройство пищевого поведения в прошлом или сейчас' },
      { value: 'none', label: 'Ничего из перечисленного' },
    ],
  },
  {
    id: 'diet', type: 'single',
    title: 'Как вы питаетесь?',
    options: [
      { value: 'omnivore', icon: '🍗', label: 'Ем всё' },
      { value: 'pescatarian', icon: '🐟', label: 'Без мяса, но с рыбой' },
      { value: 'vegetarian', icon: '🥚', label: 'Вегетарианство', note: 'Молочные продукты и яйца — да' },
      { value: 'vegan', icon: '🌱', label: 'Веганство' },
    ],
  },
  {
    id: 'exclude', type: 'multi', exclusive: 'none',
    title: 'Что нужно исключить?',
    hint: 'Убираем такие блюда из меню.',
    options: [
      { value: 'dairy', label: 'Молочные продукты' },
      { value: 'gluten', label: 'Глютен (пшеница, рожь, овёс)' },
      { value: 'eggs', label: 'Яйца' },
      { value: 'nuts', label: 'Орехи и арахис' },
      { value: 'fish', label: 'Рыба и морепродукты' },
      { value: 'none', label: 'Ничего не исключаю' },
    ],
  },
  {
    id: 'meals', type: 'single',
    title: 'Сколько раз в день вам удобно есть?',
    options: [
      { value: '2', label: '2 раза', note: 'Обед и ужин' },
      { value: '3', label: '3 раза', note: 'Завтрак, обед и ужин' },
      { value: '4', label: '4 раза', note: 'Три приёма пищи и перекус' },
      { value: '5', label: '5 раз', note: 'Три приёма пищи и два перекуса' },
    ],
  },
  {
    id: 'cook', type: 'single',
    title: 'Сколько времени готовы тратить на готовку?',
    hint: 'Это время на одно блюдо.',
    options: [
      { value: '15', icon: '⚡', label: 'До 15 минут' },
      { value: '30', icon: '⏱️', label: 'До 30 минут' },
      { value: '90', icon: '🍲', label: 'Могу готовить дольше' },
    ],
  },
  {
    id: 'challenges', type: 'multi', exclusive: 'none',
    title: 'Что мешает питаться так, как хочется?',
    hint: 'Выберите всё, что подходит — подберём советы.',
    options: [
      { value: 'sweets', label: 'Тяга к сладкому' },
      { value: 'evening', label: 'Переедаю вечером' },
      { value: 'time', label: 'Нет времени готовить' },
      { value: 'skip', label: 'Пропускаю приёмы пищи' },
      { value: 'out', label: 'Часто ем вне дома' },
      { value: 'water', label: 'Забываю пить воду' },
      { value: 'none', label: 'Ничего не мешает' },
    ],
  },
];

// ---------- состояние и хранилище ----------

const state = { answers: {}, seed: Math.floor(Math.random() * 2 ** 31), menu: null, plan: null };

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(CONFIG.storageKey));
    if (saved && typeof saved.answers === 'object' && saved.answers) {
      state.answers = saved.answers;
      if (Number.isInteger(saved.seed)) state.seed = saved.seed;
    }
  } catch (e) { /* хранилище недоступно — работаем без него */ }
}

function saveState() {
  try {
    localStorage.setItem(CONFIG.storageKey, JSON.stringify({ answers: state.answers, seed: state.seed }));
  } catch (e) { /* ignore */ }
}

function resetState() {
  state.answers = {};
  state.menu = null;
  state.plan = null;
  state.seed = Math.floor(Math.random() * 2 ** 31);
  try { localStorage.removeItem(CONFIG.storageKey); } catch (e) { /* ignore */ }
}

const visibleSteps = () => STEPS.filter((s) => !s.showIf || s.showIf(state.answers));

function isAnswered(step) {
  const v = state.answers[step.id];
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'number') return Number.isFinite(v);
  return typeof v === 'string' && v !== '';
}

const firstMissing = () => visibleSteps().find((s) => !isAnswered(s));

// Если цель сменилась, ответы на скрытые шаги больше не нужны.
function pruneAnswers() {
  const keep = new Set(visibleSteps().map((s) => s.id));
  Object.keys(state.answers).forEach((k) => { if (!keep.has(k)) delete state.answers[k]; });
}

// ---------- расчёты ----------

function computePlan(a) {
  const male = a.sex === 'male';
  const bmi = bmiOf(a.weight, a.height);
  const bmr = 10 * a.weight + 6.25 * a.height - 5 * a.age + (male ? 5 : -161); // Миффлин — Сан-Жеор
  const tdee = bmr * ACTIVITY[a.activity];

  let goal = a.goal === 'eat_better' ? 'maintain' : a.goal;
  const notices = [];
  const medical = a.health.filter((x) => x !== 'none');

  if (a.age < 18 && goal !== 'maintain') {
    goal = 'maintain';
    notices.push(['Вам меньше 18 лет', 'Подростку нельзя садиться на дефицит калорий без врача, поэтому мы посчитали рацион для поддержания веса. Цель по весу лучше обсудить с педиатром.']);
  }
  if (medical.length && goal !== 'maintain') {
    goal = 'maintain';
    notices.push(['Лучше сначала к врачу', 'Из-за отмеченных особенностей здоровья мы не закладываем дефицит или профицит калорий. Ниже — расчёт для поддержания веса, а менять рацион стоит вместе с врачом или диетологом.']);
  } else if (medical.length) {
    notices.push(['Согласуйте рацион с врачом', 'Вы отметили особенности здоровья. Этот план — общий ориентир, он не заменяет рекомендации специалиста.']);
  }
  if (bmi < 18.5 && a.goal === 'lose') {
    goal = 'maintain';
    notices.push(['Снижать вес не нужно', `Ваш индекс массы тела ${fmt(bmi, 1)} ниже нормы. Мы посчитали рацион для поддержания веса. Если вес снижается без причины, обратитесь к врачу.`]);
  }

  let kcal = tdee;
  if (goal === 'lose') {
    const floor = male ? 1500 : 1200;
    kcal = Math.min(tdee, Math.max(tdee - Math.min(tdee * 0.2, 750), floor));
  } else if (goal === 'gain') {
    kcal = tdee * 1.1;
  }
  kcal = Math.round(kcal / 10) * 10;

  // Белок считаем от «разумного» веса: для избыточной массы тела берём вес при ИМТ 25.
  const refW = Math.min(a.weight, weightAtBmi(25, a.height));
  const protFactor = goal === 'lose' ? 2.0 : goal === 'gain' ? 1.8 : 1.4;
  const protein = clamp(refW * protFactor, (kcal * 0.15) / 4, (kcal * 0.35) / 4);
  const fat = (kcal * 0.27) / 9;
  const carbs = Math.max(0, (kcal - protein * 4 - fat * 9) / 4);

  const weekly = ((kcal - tdee) * 7) / 7700; // кг в неделю, − это снижение
  let weeks = null;
  if ((goal === 'lose' || goal === 'gain') && a.target && Math.abs(weekly) >= 0.05) {
    weeks = Math.abs(a.target - a.weight) / Math.abs(weekly);
  }

  return {
    goal, notices, bmi, bmr, tdee, kcal,
    protein, fat, carbs,
    water: clamp(Math.round(a.weight * 0.03 * 10) / 10, 1.5, 3.5),
    weekly, weeks,
    meals: Number(a.meals),
  };
}

// ---------- меню ----------

function candidates(type, a) {
  const maxTime = Number(a.cook);
  const exclude = a.exclude.filter((x) => x !== 'none');
  const fits = (d) => d.type === type
    && DIET_RANK[d.diet] <= DIET_RANK[a.diet]
    && !d.has.some((x) => exclude.includes(x));
  const all = window.DISHES.filter(fits);
  const quick = all.filter((d) => d.time <= maxTime);
  return quick.length >= 2 ? quick : all;
}

const portionFor = (plan, slotShare, dish) => clamp((plan.kcal * slotShare) / dish.kcal, 0.6, 1.8);

function buildMenu(plan, a, seed) {
  const rnd = mulberry32(seed);
  const slots = SLOTS[plan.meals];
  let best = null;
  for (let attempt = 0; attempt < 60; attempt++) {
    const used = new Set();
    const picks = [];
    for (const [type, share] of slots) {
      const all = candidates(type, a);
      if (!all.length) continue;
      const fresh = all.filter((d) => !used.has(d.id));
      const pool = fresh.length ? fresh : all;
      const dish = pool[Math.floor(rnd() * pool.length)];
      used.add(dish.id);
      picks.push({ type, share, dish, mult: portionFor(plan, share, dish) });
    }
    const total = picks.reduce((s, p) => s + p.dish.kcal * p.mult, 0);
    const err = Math.abs(total - plan.kcal);
    if (!best || err < best.err) best = { picks, err };
  }
  return best ? best.picks : [];
}

function swapDish(index) {
  const pick = state.menu[index];
  const pool = candidates(pick.type, state.answers);
  if (pool.length < 2) return;
  const others = new Set(state.menu.filter((_, i) => i !== index).map((p) => p.dish.id));
  let i = pool.findIndex((d) => d.id === pick.dish.id);
  for (let step = 0; step < pool.length; step++) {
    i = (i + 1) % pool.length;
    if (!others.has(pool[i].id) || step === pool.length - 1) break;
  }
  pick.dish = pool[i];
  pick.mult = portionFor(state.plan, pick.share, pick.dish);
}

const menuTotals = (menu) => menu.reduce((t, p) => ({
  kcal: t.kcal + p.dish.kcal * p.mult,
  p: t.p + p.dish.p * p.mult,
  f: t.f + p.dish.f * p.mult,
  c: t.c + p.dish.c * p.mult,
}), { kcal: 0, p: 0, f: 0, c: 0 });

// ---------- советы ----------

function buildTips(plan, a) {
  const tips = [];
  const c = a.challenges;
  if (c.includes('sweets')) tips.push('Тяга к сладкому: заранее оставьте 100–150 ккал в день на любимый десерт. Запрет обычно приводит к срывам, а небольшая запланированная порция — нет.');
  if (c.includes('evening')) tips.push('Вечернее переедание чаще всего следствие недоедания днём. Добавьте белок в обед и держите на ужин сытное блюдо с овощами и белком.');
  if (c.includes('time')) tips.push('Мало времени: раз в неделю готовьте две базы — крупу и белок — и собирайте блюда из них за 10 минут. В меню мы уже показываем время приготовления.');
  if (c.includes('skip')) tips.push('Пропущенные приёмы пищи — частая причина вечернего голода. Поставьте напоминание и держите под рукой перекус: йогурт, фрукт или хлебцы.');
  if (c.includes('out')) tips.push('Едите вне дома: берите блюдо с белком и гарниром из овощей, соусы просите отдельно, а порцию рассчитывайте на 70–80% от привычной.');
  if (c.includes('water') || !c.length) tips.push(`Вода: ориентир ${fmt(plan.water, 1)} л в день. Поставьте стакан на рабочий стол и пейте до того, как захочется.`);

  if (plan.goal === 'lose') tips.push('Взвешивайтесь в одно и то же время и смотрите на среднее за неделю, а не на каждый день: вес колеблется из-за воды.');
  if (plan.goal === 'gain') tips.push('Для набора мышц важнее регулярные силовые тренировки, чем лишние калории: без нагрузки профицит превращается в жир.');
  if (plan.goal === 'maintain') tips.push('Раз в две недели сверяйте вес с цифрой на старте. Если он уходит больше чем на 1–1,5 кг, чуть поправьте калорийность на 100–150 ккал.');
  tips.push('Эти цифры — стартовая точка. Через 2–3 недели сравните прогноз с реальностью и скорректируйте рацион.');
  return tips.slice(0, 5);
}

// ---------- отрисовка ----------

const app = $('#app');
const shell = $('#shell');
const topbar = $('#topbar');

function setChrome({ bar, wide = false }) {
  topbar.hidden = !bar;
  shell.classList.toggle('wide', wide);
  if (bar) {
    const pct = Math.round((bar.i / bar.n) * 100);
    $('#bar').style.width = `${pct}%`;
    $('#progress').setAttribute('aria-valuenow', String(pct));
    $('#count').textContent = `${bar.i + 1} из ${bar.n}`;
  }
}

function mount(html, focusSel = 'h1') {
  app.innerHTML = html;
  window.scrollTo(0, 0);
  const el = $(focusSel, app);
  if (el) { el.setAttribute('tabindex', '-1'); el.focus({ preventScroll: true }); }
}

function showIntro() {
  setChrome({ bar: null });
  const resumable = Object.keys(state.answers).length > 0;
  mount(`
    <section class="step intro">
      <div class="stack tight">
        <span class="eyebrow">Бесплатный тест · около 2 минут</span>
        <h1>Подберём рацион под вашу цель</h1>
        <p class="hint">Ответьте на несколько вопросов и получите расчёт калорий и БЖУ, прогноз по весу и меню на день, где любое блюдо можно заменить.</p>
      </div>
      <ul class="checks">
        <li>Без регистрации, почты и телефона</li>
        <li>Ответы остаются в вашем браузере и никуда не отправляются</li>
        <li>Расчёт по формуле Миффлина — Сан-Жеора</li>
        <li>Учитываем диету, непереносимость и время на готовку</li>
      </ul>
      <div class="actions">
        <button class="btn" id="start" type="button">${resumable ? 'Продолжить' : 'Начать'}</button>
        ${resumable ? '<button class="btn ghost" id="restart" type="button">Начать заново</button>' : ''}
      </div>
      <p class="small">Тест не заменяет консультацию врача или диетолога.</p>
    </section>`);
  $('#start').addEventListener('click', () => {
    const next = firstMissing();
    go(next ? `#/q/${next.id}` : '#/result');
  });
  const restart = $('#restart');
  if (restart) restart.addEventListener('click', () => { resetState(); showIntro(); });
}

function optionsBody(step, current) {
  const multi = step.type === 'multi';
  const selected = new Set(Array.isArray(current) ? current : current ? [current] : []);
  const items = step.options.map((o) => `
    <label class="opt${multi ? ' multi' : ''}">
      <input type="${multi ? 'checkbox' : 'radio'}" name="a" value="${esc(o.value)}"${selected.has(o.value) ? ' checked' : ''}>
      <span class="opt-body">
        ${o.icon ? `<span class="opt-ico" aria-hidden="true">${o.icon}</span>` : ''}
        <span class="opt-text"><b>${esc(o.label)}</b>${o.note ? `<small>${esc(o.note)}</small>` : ''}</span>
        <span class="opt-mark" aria-hidden="true"></span>
      </span>
    </label>`).join('');
  return `<fieldset class="options"><legend class="sr-only">${esc(step.title)}</legend>${items}</fieldset>`;
}

function numberBody(step, current) {
  const val = typeof current === 'number' ? String(current).replace('.', ',') : '';
  return `
    <div class="field" id="field">
      <label class="sr-only" for="num">${esc(step.title)}</label>
      <input id="num" type="text" inputmode="${step.decimals ? 'decimal' : 'numeric'}" autocomplete="off"
             placeholder="${esc(step.placeholder || '')}" maxlength="6" value="${esc(val)}" aria-describedby="msg">
      <span class="unit">${esc(step.unit)}</span>
    </div>
    <p class="msg" id="msg" role="status"></p>`;
}

function parseNumber(raw, step) {
  const s = raw.trim().replace(',', '.');
  const pattern = step.decimals ? /^\d+(\.\d+)?$/ : /^\d+$/;
  if (!pattern.test(s)) return { error: 'Введите число.' };
  const value = Number(s);
  if (value < step.min || value > step.max) return { error: `Введите значение от ${step.min} до ${step.max}.` };
  const rounded = step.decimals ? Math.round(value * 10) / 10 : value;
  const extra = step.check ? step.check(rounded, state.answers) : '';
  return extra ? { error: extra } : { value: rounded };
}

function showStep(step) {
  const vis = visibleSteps();
  setChrome({ bar: { i: vis.indexOf(step), n: vis.length } });
  const current = state.answers[step.id];
  const body = step.type === 'number' ? numberBody(step, current) : optionsBody(step, current);
  mount(`
    <section class="step">
      <div class="stack tight">
        <h1>${esc(step.title)}</h1>
        ${step.hint ? `<p class="hint">${esc(step.hint)}</p>` : ''}
      </div>
      <form id="form" novalidate>
        <div class="stack">
          ${body}
          <div class="actions"><button class="btn" id="next" type="submit" disabled>Далее</button></div>
        </div>
      </form>
    </section>`);

  const form = $('#form');
  const next = $('#next');
  let advancing = false;

  if (step.type === 'number') {
    const input = $('#num');
    const msg = $('#msg');
    const field = $('#field');
    // Кнопка остаётся активной: у заблокированной кнопки браузер не отправляет форму по Enter,
    // и человек не увидел бы, что именно не так с введённым числом.
    next.disabled = false;
    const refresh = (showError) => {
      const r = parseNumber(input.value, step);
      field.classList.toggle('invalid', !!(showError && r.error && input.value));
      msg.className = 'msg' + (showError && r.error && input.value ? ' error' : '');
      msg.textContent = r.error
        ? (showError && input.value ? r.error : '')
        : (step.live ? step.live(r.value, state.answers) : '');
      return r;
    };
    input.addEventListener('input', () => refresh(false));
    input.addEventListener('blur', () => refresh(true));
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const r = refresh(true);
      if (r.error) { input.focus(); return; }
      commit(step, r.value);
    });
    refresh(false);
    input.focus({ preventScroll: true });
    return;
  }

  const inputs = [...form.querySelectorAll('input[name="a"]')];
  const read = () => inputs.filter((i) => i.checked).map((i) => i.value);
  next.disabled = read().length === 0;

  inputs.forEach((input) => {
    input.addEventListener('change', () => {
      if (step.type === 'multi' && input.checked) {
        inputs.forEach((o) => {
          if (o === input) return;
          const isExclusive = o.value === step.exclusive;
          if (input.value === step.exclusive || isExclusive) o.checked = false;
        });
      }
      next.disabled = read().length === 0;
    });
  });

  // Одиночный выбор уходит дальше сам, но только по клику мышью или пальцем:
  // стрелки на клавиатуре меняют выбор и не должны перебрасывать на следующий шаг.
  if (step.type === 'single') {
    form.querySelectorAll('.opt').forEach((label) => {
      label.addEventListener('click', (e) => {
        if (e.detail === 0 || advancing) return;
        advancing = true;
        setTimeout(() => {
          const [value] = read();
          if (value !== undefined) commit(step, value);
          else advancing = false;
        }, 180);
      });
    });
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const values = read();
    if (!values.length) return;
    commit(step, step.type === 'multi' ? values : values[0]);
  });
}

function commit(step, value) {
  state.answers[step.id] = value;
  pruneAnswers();
  saveState();
  const vis = visibleSteps();
  const idx = vis.findIndex((s) => s.id === step.id);
  go(idx + 1 < vis.length ? `#/q/${vis[idx + 1].id}` : '#/result');
}

function goBack() {
  const h = location.hash.replace(/^#\/?/, '');
  const vis = visibleSteps();
  const idx = vis.findIndex((s) => `q/${s.id}` === h);
  go(idx > 0 ? `#/q/${vis[idx - 1].id}` : '#/');
}

// ---------- результат ----------

function chartSvg(a, plan) {
  const W = 320; const H = 150; const padL = 14; const padR = 14; const padT = 26; const padB = 34;
  const weeks = Math.min(Math.ceil(plan.weeks), 104);
  const reached = plan.weeks <= 104;
  const endW = reached ? a.target : a.weight + plan.weekly * 104;
  const lo = Math.min(a.weight, endW); const hi = Math.max(a.weight, endW);
  const span = Math.max(hi - lo, 1);
  const x = (t) => padL + ((W - padL - padR) * t) / weeks;
  const y = (v) => padT + ((H - padT - padB) * (hi - v)) / span;
  return `
    <svg class="chart" viewBox="0 0 ${W} ${H}" role="img"
         aria-label="Ориентировочный график: от ${fmt(a.weight, 1)} кг к ${fmt(endW, 1)} кг за ${weeks} нед.">
      <line class="axis" x1="${padL}" y1="${H - padB}" x2="${W - padR}" y2="${H - padB}"/>
      <line class="line" x1="${x(0)}" y1="${y(a.weight)}" x2="${x(weeks)}" y2="${y(endW)}"/>
      <circle class="dot" cx="${x(0)}" cy="${y(a.weight)}" r="5"/>
      <circle class="dot" cx="${x(weeks)}" cy="${y(endW)}" r="5"/>
      <text x="${x(0)}" y="${H - 12}" text-anchor="start"><tspan>сейчас · </tspan><tspan class="em">${fmt(a.weight, 1)} кг</tspan></text>
      <text x="${x(weeks)}" y="${H - 12}" text-anchor="end"><tspan>через ${weeks} нед. · </tspan><tspan class="em">${fmt(endW, 1)} кг</tspan></text>
    </svg>`;
}

function forecastCard(a, plan) {
  if (plan.goal !== 'lose' && plan.goal !== 'gain') return '';
  const pace = `${fmt(Math.abs(plan.weekly), 2)} кг в неделю`;
  if (plan.weeks === null) {
    return `<section class="card"><h2>Прогноз по весу</h2><p>При вашем обмене веществ безопасного запаса калорий почти нет: расчётный темп меньше 0,05 кг в неделю. Добавьте активности вместо дальнейшего урезания рациона.</p></section>`;
  }
  const n = Math.max(1, Math.round(plan.weeks));
  const eta = plan.weeks > 104
    ? 'больше двух лет'
    : `примерно ${n} ${plural(n, 'неделя', 'недели', 'недель')}`;
  return `
    <section class="card">
      <h2>Прогноз по весу</h2>
      <p>Темп около <b>${pace}</b>, до цели ${eta}.</p>
      ${chartSvg(a, plan)}
      <p class="small">Это грубая оценка. Обмен веществ подстраивается, поэтому реальный темп будет меняться. Сверяйтесь с весами раз в 2–3 недели.</p>
    </section>`;
}

function menuHtml() {
  const t = menuTotals(state.menu);
  const target = state.plan.kcal;
  const meals = state.menu.map((p, i) => `
    <div class="meal">
      <span class="slot">${SLOT_NAMES[p.type]}</span>
      <span class="name">${esc(p.dish.name)}</span>
      <span class="meta">порция ×${fmt(p.mult, 1)} · ${fmt(Math.round(p.dish.kcal * p.mult))} ккал · Б ${fmt(Math.round(p.dish.p * p.mult))} · Ж ${fmt(Math.round(p.dish.f * p.mult))} · У ${fmt(Math.round(p.dish.c * p.mult))} · ${p.dish.time} мин</span>
      <button class="btn ghost sm swap" type="button" data-swap="${i}" aria-label="Заменить блюдо: ${esc(p.dish.name)}">Заменить</button>
    </div>`).join('');
  const short = t.kcal < target * 0.92
    ? `<p class="small">Меню даёт около ${fmt(Math.round(t.kcal))} из ${fmt(target)} ккал. Добавьте ещё один приём пищи или увеличьте порции.</p>`
    : '';
  return `
    ${meals}
    <p class="small">Итого: ≈ ${fmt(Math.round(t.kcal))} ккал · Б ${fmt(Math.round(t.p))} г · Ж ${fmt(Math.round(t.f))} г · У ${fmt(Math.round(t.c))} г</p>
    ${short}`;
}

function showResult() {
  setChrome({ bar: null, wide: true });
  const a = state.answers;
  const plan = computePlan(a);
  state.plan = plan;
  state.menu = buildMenu(plan, a, state.seed);

  const goalText = { lose: 'для снижения веса', gain: 'для набора массы', maintain: 'для поддержания веса' }[plan.goal];
  const bmiPos = clamp(((plan.bmi - 15) / (40 - 15)) * 100, 2, 98);
  const macroMax = Math.max(plan.protein * 4, plan.fat * 9, plan.carbs * 4);
  const macroRow = (label, grams, kcalPer, color) => `
    <div class="macro-row">
      <span>${label}</span>
      <span class="track"><span style="width:${Math.round((grams * kcalPer / macroMax) * 100)}%;background:${color}"></span></span>
      <b>${fmt(Math.round(grams))} г</b>
    </div>`;

  mount(`
    <section class="step result">
      <div class="stack tight">
        <span class="eyebrow">Ваш план питания</span>
        <h1>Рацион ${goalText}</h1>
      </div>

      ${plan.notices.map(([title, text]) => `<div class="notice" role="note"><b>${esc(title)}</b><span>${esc(text)}</span></div>`).join('')}

      <div class="hero-card">
        <span class="sub">Калорийность в день</span>
        <span class="big">${fmt(plan.kcal)} ккал</span>
        <span class="sub">Ваш расход ≈ ${fmt(Math.round(plan.tdee / 10) * 10)} ккал, базовый обмен ≈ ${fmt(Math.round(plan.bmr / 10) * 10)} ккал</span>
      </div>

      <div class="grid two">
        <section class="card">
          <h2>Белки, жиры, углеводы</h2>
          <div class="macro">
            ${macroRow('Белки', plan.protein, 4, 'var(--p)')}
            ${macroRow('Жиры', plan.fat, 9, 'var(--f)')}
            ${macroRow('Углеводы', plan.carbs, 4, 'var(--c)')}
          </div>
        </section>
        <section class="card">
          <h2>Индекс массы тела</h2>
          <div class="stat"><span class="v">${fmt(plan.bmi, 1)}</span><span class="l">${esc(bmiCategory(plan.bmi))}</span></div>
          <div class="bmi-scale" aria-hidden="true"><i style="left:${bmiPos}%"></i></div>
          <p class="small">Для спортсменов и людей с большой мышечной массой показатель менее точен.</p>
        </section>
      </div>

      <div class="grid two">
        <section class="card"><div class="stat"><span class="v">${fmt(plan.water, 1)} л</span><span class="l">воды в день</span></div></section>
        <section class="card"><div class="stat"><span class="v">${plan.meals}</span><span class="l">приёма пищи в день</span></div></section>
      </div>

      ${forecastCard(a, plan)}

      <section class="card">
        <div class="menu-head">
          <h2>Пример меню на день</h2>
          <button class="btn ghost sm no-print" type="button" data-action="shuffle">Собрать заново</button>
        </div>
        <div id="menu">${menuHtml()}</div>
      </section>

      <section class="card">
        <h2>Советы под ваши ответы</h2>
        <ul class="tips">${buildTips(plan, a).map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
      </section>

      <div class="row-actions">
        <button class="btn" type="button" data-action="print">Сохранить в PDF / распечатать</button>
        <button class="btn ghost" type="button" data-action="copy">Скопировать план</button>
        ${CONFIG.cta ? `<a class="btn ghost" href="${esc(CONFIG.cta.url)}" rel="noopener">${esc(CONFIG.cta.text)}</a>` : ''}
        <button class="btn ghost" type="button" data-action="restart">Пройти заново</button>
      </div>
      <p class="small" id="status" role="status"></p>

      <p class="small">Расчёт ориентировочный и не является медицинской рекомендацией. Он не подходит при беременности, заболеваниях и расстройствах пищевого поведения без консультации врача. Мы ничего не собираем: ответы хранятся только в вашем браузере.</p>
    </section>`);

  app.onclick = (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    if (btn.dataset.swap !== undefined) {
      swapDish(Number(btn.dataset.swap));
      $('#menu').innerHTML = menuHtml();
      const again = $(`[data-swap="${btn.dataset.swap}"]`);
      if (again) again.focus();
    } else if (btn.dataset.action === 'shuffle') {
      state.seed = (state.seed + 1) >>> 0;
      saveState();
      state.menu = buildMenu(state.plan, state.answers, state.seed);
      $('#menu').innerHTML = menuHtml();
    } else if (btn.dataset.action === 'print') {
      window.print();
    } else if (btn.dataset.action === 'copy') {
      copyPlan();
    } else if (btn.dataset.action === 'restart') {
      resetState();
      go('#/');
    }
  };
}

function planAsText() {
  const a = state.answers; const p = state.plan;
  const lines = [
    'Мой план питания',
    `Калории: ${fmt(p.kcal)} ккал в день`,
    `Белки ${fmt(Math.round(p.protein))} г · Жиры ${fmt(Math.round(p.fat))} г · Углеводы ${fmt(Math.round(p.carbs))} г`,
    `Вода: ${fmt(p.water, 1)} л · Приёмов пищи: ${p.meals}`,
    `ИМТ: ${fmt(p.bmi, 1)} (${bmiCategory(p.bmi)})`,
  ];
  if (p.weeks !== null && a.target) lines.push(`Цель: ${fmt(a.target, 1)} кг, ориентировочно ${fmt(Math.round(p.weeks))} нед.`);
  lines.push('', 'Меню на день:');
  state.menu.forEach((m) => lines.push(`• ${SLOT_NAMES[m.type]}: ${m.dish.name} (${fmt(Math.round(m.dish.kcal * m.mult))} ккал, порция ×${fmt(m.mult, 1)})`));
  return lines.join('\n');
}

async function copyPlan() {
  const status = $('#status');
  try {
    await navigator.clipboard.writeText(planAsText());
    status.textContent = 'План скопирован.';
  } catch (e) {
    status.textContent = 'Не удалось скопировать. Воспользуйтесь кнопкой печати.';
  }
}

// ---------- маршрутизация ----------

function go(hash) {
  if (location.hash === hash) route();
  else location.hash = hash;
}

function route() {
  app.onclick = null;
  const h = location.hash.replace(/^#\/?/, '');
  const missing = firstMissing();

  if (h === 'result') {
    if (missing) return go(`#/q/${missing.id}`);
    return showResult();
  }
  if (h.startsWith('q/')) {
    const vis = visibleSteps();
    const step = vis.find((s) => `q/${s.id}` === h);
    if (!step) return go('#/');
    if (missing && vis.indexOf(step) > vis.indexOf(missing)) return go(`#/q/${missing.id}`);
    return showStep(step);
  }
  return showIntro();
}

$('#back').addEventListener('click', goBack);
window.addEventListener('hashchange', route);
loadState();
route();
