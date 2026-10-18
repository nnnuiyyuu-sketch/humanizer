/* ════════════════════════════════════════════════════════════════
   ПОЛНОМОЧИЯ КРЕСЛА
   Рычаг открыт тому, у кого есть право, а не тому, кто сидел в кресле
   раньше. Проигравший выборы теряет мандат, портфель или край, а с ними
   всё, что к ним прилагалось. Таблица одна: кнопки на вкладках гасятся
   по ней, а сами действия перепроверяют её на входе — так закрытое
   нельзя открыть ни клавишей, ни старым листом, ни чужим разделом.
   ════════════════════════════════════════════════════════════════ */
const EXEC_SEATS=['pm','vice','pres','vp','min','gov','mayor'];
/* власть исполнительная: кабинет, президент, министр, край или город */
function inExec(){ return isPM()||isPres()||EXEC_SEATS.indexOf(mySeat())>=0; }
/* законодательная: мандат, место в Сенате или кресло, с которого вносят проекты */
function inLegis(){ return hasMandate()||inSenate()||isPres()||mySeat()==='vp'; }

const POWERS={
  motion:    {name:'вотум недоверия',            short:'нет мандата',
    ok:()=>hasMandate(),
    why:'Вотум недоверия вносят депутаты Собрания, а мандата у вас нет.'},
  question:  {name:'правительственный час',      short:'нет мандата',
    ok:()=>hasMandate(),
    why:'Вопросы кабинету задают депутаты, а мандата у вас нет.'},
  impeach:   {name:'импичмент',                  short:'нет мандата',
    ok:()=>hasMandate(),
    why:'Обвинение выдвигают депутаты Собрания, а мандата у вас нет.'},
  reg:       {name:'регламент Собрания',         short:'нет мандата',
    ok:()=>hasMandate(),
    why:'Регламент правит Собрание, а в нём вы не заседаете.'},
  hearing:   {name:'слушания в комитетах',       short:'нет мандата',
    ok:()=>hasMandate(),
    why:'Слушания назначает комитет Собрания, а вы в нём не заседаете.'},
  inquiry:   {name:'расследовательская комиссия', short:'нет мандата',
    ok:()=>hasMandate()||isPres()||mySeat()==='vp',
    why:'Комиссию созывает палата, а вы в ней не заседаете.'},
  budgetLine:{name:'строка в бюджете',           short:'нет мандата',
    ok:()=>hasMandate()||chief(),
    why:'За строку бюджета торгуется депутат или лидер партии. Вы ни то, ни другое.'},
  talk:      {name:'переговоры с фракциями',     short:'нет мандата',
    ok:()=>hasMandate()||chief(),
    why:'С фракциями договариваются депутаты и лидеры партий. Вы ни то, ни другое.'},
  coalition: {name:'раскол и выход из коалиции', short:'решает лидер',
    ok:()=>chief(),
    why:'Кабинет раскалывает и коалицию покидает лидер партии, а лидер — не вы.'},
  amend:     {name:'поправки к конституции',     short:'нет права',
    ok:()=>hasMandate()||inSenate()||isPres(),
    why:'Поправку вносят президент, депутат или сенатор.'},
  petition:  {name:'запрос в суд',                short:'нет права',
    ok:()=>inLegis()||isPM()||mySeat()==='gov',
    why:'В суд на закон обращаются депутаты, сенаторы, кабинет, президент или край.'},
  whip:      {name:'работа с колеблющимися',     short:'нет проекта',
    ok:()=>canBill(),
    why:'Проекта на столе нет, а вносить его вам нечем: ни мандата, ни поста.'},
  senLead:   {name:'сделки с лидером Сената',    short:'нет проектов',
    ok:()=>canBill(),
    why:'Календарь Сената нужен тому, кто вносит проекты. Ни мандата, ни поста у вас нет.'},
  dropVP:    {name:'смена вице-президента',      short:'нет поста', rare:1,
    ok:()=>isPres(),
    why:'Вице-президента меняет президент.'},
  nuke:      {name:'правка регламента Сената',   short:'нет места', rare:1,
    ok:()=>inSenate()||mySeat()==='vp',
    why:'Порог клотура пересматривает Сенат: место сенатора или кресло председателя.'},
  bizCouncil:{name:'деловой совет',              short:'нет поста',
    ok:()=>inExec(),
    why:'Деловой совет собирает власть: кабинет, президент, министр, край или город.'},
  project:   {name:'проекты в край',             short:'нет поста',
    ok:()=>mySeat()!=='none',
    why:'Просить проект в край может тот, у кого есть кресло. Частное лицо — не может.'},
  firmShake: {name:'нажим на капитал',           short:'нет поста',
    ok:()=>inExec(),
    why:'Просить инвестиции в обмен на спокойствие может только власть.'},
  firmDeal:  {name:'обещания закона капиталу',   short:'нет проектов',
    ok:()=>canBill(),
    why:'Обещать закон может тот, кто вносит проекты. У вас ни мандата, ни поста.'},
  byElection:{name:'довыборы',                   short:'есть кресло', rare:1,
    ok:()=>mySeat()==='none',
    why:'Довыборы нужны тому, у кого кресла нет.'},
};
/* причина отказа, пустая строка — право есть */
function powerWhy(k){ const p=POWERS[k]; return !p||p.ok()?'':p.why; }
function can(k){ return !powerWhy(k); }
/* на входе в действие: нет права — отказ тостом */
function need(k){ const w=powerWhy(k); if(w)toast(w); return !w; }
/* вариант для листа: пункт гаснет и объясняет почему */
function offOpt(k,o){ const w=powerWhy(k); return w?{...o,off:w,fn(){ toast(w); }}:o; }

/* кнопки на вкладках: что гасится и по какому праву */
const POWER_BTN=[
  [/^askMotion\(/,'motion'], [/^askQuestion\(/,'question'], [/^askImpeach\(/,'impeach'],
  [/^askReg\(/,'reg'], [/^askHearing\(/,'hearing'], [/^askInquiry\(/,'inquiry'],
  [/^askBudgetLine\(/,'budgetLine'], [/^askAmend(One)?\(|^askConvene\(/,'amend'],
  [/^askLead\(/,'senLead'], [/^askPetition\(/,'petition'], [/^dropVP\(/,'dropVP'], [/^askNukeSolo\(/,'nuke'],
  [/^bizCouncil\(/,'bizCouncil'], [/^askProject\(/,'project'], [/^byElection\(/,'byElection'],
];
const POWER_ACT={noconf:'motion', question:'question', talk:'talk', whip:'whip'};
function powerKey(b){
  const oc=b.getAttribute('onclick')||'';
  for(const [re,k] of POWER_BTN)if(re.test(oc))return k;
  return POWER_ACT[b.dataset.act]||null;
}
/* после каждой перерисовки: замок на всё, на что права нет */
function lockPass(){
  document.querySelectorAll('#view button').forEach(b=>{
    if(b.disabled)return;
    const k=powerKey(b), why=k&&powerWhy(k); if(!why)return;
    b.disabled=true; b.title=why; b.classList.add('lock');
    const c=b.querySelector('.cost');
    if(c)c.textContent=POWERS[k].short;
    else b.insertAdjacentHTML('beforeend','<span class="cost">'+POWERS[k].short+'</span>');
  });
}

/* что открыто, а что закрыто в этом кресле — для листа потери и досье */
function powerState(){ const o={}; Object.keys(POWERS).forEach(k=>o[k]=POWERS[k].ok()); return o; }
function powerDiff(a,b){
  const shut=[], open=[];
  Object.keys(POWERS).forEach(k=>{ if(a[k]&&!b[k])shut.push(POWERS[k].name); if(!a[k]&&b[k])open.push(POWERS[k].name); });
  return {shut,open};
}
/* строки для листа потери: что закрылось и что открылось */
function shiftRows(){
  const d=S.you&&S.you.shift; if(!d||!(d.shut.length||d.open.length))return '';
  return `<div class="res">${d.shut.length?`<span>Закрыто</span><b class="bad w">${d.shut.join(', ')}</b>`:''}${
    d.open.length?`<span>Открыто</span><b class="good w">${d.open.join(', ')}</b>`:''}</div>`;
}
/* одной строкой в досье: чего нет у этого кресла */
function powerNote(){
  if(['none','lead','dep'].indexOf(mySeat())<0)return '';
  const all=Object.keys(POWERS).filter(k=>!POWERS[k].rare&&!POWERS[k].ok()).map(k=>POWERS[k].name);
  if(!all.length)return '';
  const shut=all.length>9?all.slice(0,8).concat('и ещё '+(all.length-8)):all;
  return `<p class="hint nopow"><b>Вне ваших полномочий:</b> ${shut.join(', ')}.
    ${hasMandate()?'':'Мандат возвращают довыборы или следующий созыв. '}Кнопки на вкладках погашены и подписаны.</p>`;
}
