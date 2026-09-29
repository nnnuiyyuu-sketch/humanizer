/* ════════════════════════════════════════════════════════════════
   Запуск: создание партии, загрузка сохранения.
   ════════════════════════════════════════════════════════════════ */

function newParty(){
  sheetOpen({eye:'Республика Новария · 2029 год',title:'Ваша партия идёт во власть',
    body:`<img src="${FLAG}" alt="Флаг Республики Новария" style="width:140px;display:block;margin:0 0 12px;filter:drop-shadow(0 2px 3px rgba(20,19,15,.22))">
      <p>Одиннадцать субъектов от Балтики до Тихоокеанска, Народное собрание на ${SEATS} мандатов
        и пять фракций, каждая со своим избирателем. Созыв длится ${aTerm()} кварталов, потом выборы.</p>
      <p>Вы основали партию и решаете, где в ней стоите сами: во главе кабинета, в президентском кресле,
        в министерстве, в крае, в городе, в Сенате, в задних рядах фракции — или вовсе без должности.</p>
      <p class="hint">Программа — шесть позиций от −2 до +2. Избиратель и депутат смотрят на них по-своему:
        одному важна экономика, другому порядок. Совпал — поддержал.</p>`,
    acts:[{label:'Выбрать курс',fn:choosePreset}]});
}
function choosePreset(){
  sheetOpen({eye:'Шаг 1 из 6',title:'Курс партии',
    body:'<p class="lead">Готовая программа или своя настройка. Позиции можно менять и потом, но за это придётся платить.</p>',
    opts:[...PRESETS.map((p,i)=>({label:p.name,hint:p.desc,
      fn:()=>askOrigin({...PRESETS[i],st:{...PRESETS[i].st},emb:{...PRESETS[i].emb},traits:[]})})),
      {label:'Собрать программу самому',hint:'шесть шкал, полный контроль',fn:()=>customParty()}]});
}
/* ─── кто вы такой ───────────────────────────────────────────────
   Происхождение раздаёт стартовые симпатии и молву, две черты
   характера — постоянные поправки к уже работающим механизмам. */
function askOrigin(base){
  sheetOpen({eye:'Шаг 2 из 6 · личность',title:'Откуда вы пришли',
    body:'<p class="lead">До партии была жизнь. Она уже сложила о вас мнение: одни группы видят своего, другие чужого.</p>',
    opts:ORIGINS.map(o=>({label:o.name,
      hint:o.desc+' · '+o.note,
      fn(){ base.origin=o.id; askTraits(base); }}))});
}
function askTraits(base){
  base.traits=base.traits||[];
  const pickTrait=()=>{
    const left=2-base.traits.length;
    const avail=TRAITS.filter(t=>base.traits.indexOf(t.id)<0);
    sheetOpen({eye:'Шаг 3 из 6 · характер · осталось выбрать '+left,
      title:base.traits.length?'Вторая черта':'Чем вы отличаетесь',
      body:'<p class="lead">Две черты на всю карьеру. Каждая меняет не описание, а конкретное число: цену действия, силу голоса, скорость износа.</p>'+
        (base.traits.length?'<p class="hint">Уже выбрано: '+base.traits.map(id=>TR(id).name).join(', ')+'.</p>':''),
      opts:avail.map(t=>({label:t.name,hint:t.desc,fn(){
        base.traits.push(t.id);
        if(base.traits.length<2)pickTrait(); else askName(base);
      }}))});
  };
  pickTrait();
}
function customParty(){
  const draft={name:'Новая партия',short:'НП',color:'#9A7211',st:{econ:0,tax:0,order:0,free:0,reg:0,world:0}};
  const draw=()=>{
    sheetOpen({eye:'Шаг 1 из 6',title:'Своя программа',
      body:AXES.map(a=>`<div class="ax"><div class="axh"><span>${a.l}</span><span>${a.name}</span><span>${a.r}</span></div>
        <div class="axr">${[-2,-1,0,1,2].map(v=>
          `<button class="${draft.st[a.id]===v?'on':''}" data-ax="${a.id}" data-v="${v}">${STEP[v+2]}</button>`).join('')}</div></div>`).join('')+
        '<p class="hint">Крайние позиции дают горячую поддержку своих и стойкую вражду остальных.</p>',
      acts:[{label:'Дальше',fn:()=>askOrigin(draft)}],
      after(){ document.querySelectorAll('[data-ax]').forEach(b=>b.onclick=()=>{
        draft.st[b.dataset.ax]=+b.dataset.v; mopen=false; mq.length=0; draw(); }); }});
  };
  draw();
}
function askName(base){
  const or0=OR(base.origin);
  base.age=base.age||ri(41,57);
  sheetOpen({eye:'Шаг 4 из 6',title:'Название и лидер',
    body:`<div class="field"><label>Название партии</label>
        <input type="text" id="pn" value="${base.name}" maxlength="28"></div>
      <div class="field"><label>Ваше имя</label>
        <input type="text" id="ln" value="${base.leader&&base.leader!=='Вы'?base.leader:pick(NAME_M)+' '+pick(SURN_M)}" maxlength="28"></div>
      <div class="field"><label>Возраст</label>
        <input type="number" id="ag" value="${base.age}" min="30" max="72"></div>
      <div class="res" style="margin-top:11px">
        <span>Происхождение</span><b class="w">${or0?or0.name:'—'}</b>
        <span>Черты</span><b class="w">${(base.traits||[]).map(id=>TR(id).name).join(', ')||'нет'}</b></div>
      <p class="hint" style="margin-top:9px">Курс: ${AXES.map(a=>a.name.toLowerCase()+' '+STEP[base.st[a.id]+2]).join(', ')}.
        После шестидесяти четырёх возраст начнёт отнимать часть доверия.</p>`,
    acts:[{label:'Дальше — эмблема',fn(){
      const n=document.getElementById('pn'), l=document.getElementById('ln'), a=document.getElementById('ag');
      base.name=(n&&n.value.trim())||base.name;
      base.leader=(l&&l.value.trim())||'Вы';
      base.age=clamp(a?+a.value||base.age:base.age,30,72);
      base.short=base.name.split(/\s+/).map(w=>w[0]).join('').toUpperCase().slice(0,3)||'НП';
      askPartyEmblem(base);
    }}]});
}
/* ─── шаг 5: эмблема ──────────────────────────────────────────────
   Живой образец, ряды решений и соперники, которых надо не повторить.
   Цвет поля — это и цвет фракции в зале. */
function askPartyEmblem(base){
  base.emb=base.emb?{...base.emb}:embFor(base);
  const rivals=AIPARTIES.map(p=>({...p}));
  sheetOpen({eye:'Шаг 5 из 6 · эмблема',title:'Под каким знаком',
    body:`<p class="lead">Эмблему видят раньше программы: на бюллетене, над трибуной, на полукруге зала.
        Форма поля, знак, цвет знака и кайма — остальное скажет цвет фракции.</p>
      <div id="ek"></div>`,
    acts:[{label:'Дальше — кресло',fn:()=>askStartRole(base)},{label:'Назад к имени',fn:()=>askName(base)}],
    after(){ embBind(base,rivals); }});
}
/* ─── шаг 6: кресло ───────────────────────────────────────────────
   Девять карточек: символ, имя кресла, чем оно живёт и сколько власти
   даёт на старте. Кресло решает расклад: кто правит и кто ведёт партию. */
function askStartRole(base){
  const dots=n=>'●'.repeat(n)+'○'.repeat(3-n);
  sheetOpen({eye:'Шаг 6 из 6 · кресло',title:'Где вы начинаете',
    body:`<p class="lead">Партия основана. Осталось решить, где в ней вы. Кресло задаёт расклад: кто ведёт кабинет,
        кто ведёт партию и чем вы распоряжаетесь сами. Играбельно каждое — у каждого свой стол и своя дорога.</p>
      <div class="roles">${START_ROLES.map(r=>`<button class="role" data-role="${r.id}">${icon(r.icon,26)}
        <b>${r.name}</b><span>${r.hint}</span><i>власть <u>${dots(r.lvl)}</u> · ${r.chief?'партию ведёте вы':'партию ведёт другой'}</i></button>`).join('')}</div>`,
    acts:[{label:'Классический старт — премьер',fn:()=>askStartPick(base,SR('pm'))},{label:'Назад к эмблеме',fn:()=>askPartyEmblem(base)}],
    after(){ document.querySelectorAll('[data-role]').forEach(b=>b.onclick=()=>{
      mopen=false; mq.length=0; askStartPick(base,SR(b.dataset.role)); }); }});
}
/* кресло и, если нужно, ведомство, край или город */
function askStartPick(base,role){
  base.start={role:role.id};
  const go=()=>askStartConfirm(base,role);
  if(role.pick==='post'){
    sheetOpen({eye:'Кресло · министр',title:'Какое ведомство',
      body:`<p class="lead">${role.txt}</p>`,
      opts:POSTS.map(p=>({label:p.name,hint:p.eff+' · вас судят по цифре: '+MIN_DESK[p.id].kpi.toLowerCase(),
        fn(){ base.start.post=p.id; go(); }})).concat([{label:'Назад',hint:'к выбору кресла',fn:()=>askStartRole(base)}])});
    return;
  }
  if(role.pick){
    const city=role.pick==='city', word={gov:'Какой край',sen:'От какого края',dep:'Где ваш округ',none:'Где вы живёте',mayor:'Какой город'}[role.id];
    sheetOpen({eye:'Кресло · '+role.name.toLowerCase(),title:word,
      body:`<p class="lead">${role.txt}</p>`,
      opts:REGIONS.map(r=>({label:city?r.cap+(r.capital?' — столица':''):r.name,
        hint:city?r.name+' · '+r.pop+' млн жителей':'столица '+r.cap+' · '+r.pop+' млн · мест в Сенате '+r.sen+' · развитие '+'●'.repeat(r.dev),
        fn(){ base.start.rid=r.id; go(); }})).concat([{label:'Назад',hint:'к выбору кресла',fn:()=>askStartRole(base)}])});
    return;
  }
  go();
}
function askStartConfirm(base,role){
  const st=base.start, where=st.post?POSTS.find(p=>p.id===st.post).name:st.rid?(role.pick==='city'?R(st.rid).cap:R(st.rid).name):'';
  sheetOpen({eye:'Шаг 6 из 6 · кресло',title:role.name+(where?' · '+where:''),
    body:`<div class="desk-h">${icon(role.icon,30)}<p class="lead">${role.txt}</p></div>
      <div class="res"><span>Кабинет</span><b class="w">${role.gov==='lead'?'ведёт ваша партия':role.gov==='junior'?'ваша партия — младший партнёр':'ваша партия в оппозиции'}</b>
        <span>Партию ведёте</span><b class="w">${role.chief?'вы':'другой человек, лидера меняет съезд'}</b>
        <span>Мандат в Собрании</span><b class="w">${['pm','dep'].indexOf(role.seat)>=0?'есть':role.seat==='min'?'есть, пока вы министр — не заседаете':'нет'}</b>
        <span>Судят по</span><b class="w">${role.goal}</b>
        <span>Дорога дальше</span><b class="w">${role.path}</b></div>`,
    acts:[{label:'Принять присягу',fn:()=>swear(base)},{label:'Другое кресло',fn:()=>askStartRole(base)}]});
}
function swear(base){
  initState(base); S.tab='brief';
  try{ if(localStorage.getItem('nov.hard')==='1')S.diff='hard'; }catch(e){}
  save(); render();
  const s=mySeat(), T0={pm:'Кабинет ваш',pres:'Президент — вы',vp:'Второе кресло',min:'Портфель ваш',gov:'Край ваш',
    mayor:'Город ваш',sen:'Место в Сенате',dep:'Мандат ваш',none:'Партийный билет'}[s]||'Присяга принята';
  const line=s==='pm'?'«'+base.name+'» формирует правительство. В коалиции '+coalSeats()+' мандатов из '+SEATS+', для большинства нужно '+MAJ+'.'
    :seatTitle()+'. '+(chief()?'Партию ведёте вы. ':'Партию ведёт '+me().leader+'. ')+
     'Кабинет '+P(S.gov.lead).leader+' ('+coalition().map(id=>P(id).short).join(', ')+'), '+coalSeats()+' из '+MAJ+'; ваша партия — '+
     (isPM()?'во главе':inCoal(PL)?'младший партнёр':'в оппозиции')+'.';
  sheetOpen({eye:'Присяга принята',title:T0,
    body:`<div style="display:flex;gap:14px;align-items:center;margin-bottom:10px">${emblem(me(),64)}
        <p style="margin:0">${line}</p></div>
      <div class="res"><span>Квартал</span><b class="w">${dateLabel()}</b>
        <span>До выборов</span><b>${aTerm()} кварталов</b>
        <span>Действий в квартал</span><b>3</b>
        <span>Сенат</span><b>${senSeatsOf(PL)} из ${SEN_SEATS}</b>
        <span>Президент</span><b class="w">${S.pres.name}</b>
        <span>Свои главы краёв</span><b>${govCoalCount()} из ${REGIONS.length}</b></div>
      <p class="hint">${s==='pm'?'Начните с «Кабинета»: помощник подскажет, где сейчас тонко.'
        :'В «Кабинете» — панель «Ваше кресло»: рычаги, цифра, по которой вас судят, и дорога дальше.'} Ваше личное дело — во вкладке «Мой политик».</p>`,
    acts:[{label:'К работе',fn:startTerm}]});
}

function bindMap(){
  document.querySelectorAll('[data-r]').forEach(p=>p.onclick=()=>openRegion(p.dataset.r));
}
const _render=render;
render=function(){ _render(); bindMap(); };

/* ─── действия титульного экрана ─────────────────────────────── */
const GAME_VER='1.0.0';
function hasSave(){ try{ return !!localStorage.getItem(SAVE); }catch(e){ return false; } }
function menuNew(){
  if(hasSave()){
    sheetOpen({eye:'Новая игра',title:'Сохранение будет стёрто',
      body:`<p class="lead">В памяти лежит партия «${savedName()}». Новая игра начнётся с чистого листа,
          и вернуться к прежней уже не выйдет.</p>`,
      opts:[{label:'Начать заново',hint:'прежняя партия будет стёрта',fn(){ startFresh(); }},
            {label:'Продолжить прежнюю',hint:'вернуться к сохранению',fn(){ menuContinue(); }},
            {label:'Отмена',hint:'остаться в меню',fn(){}}]});
    return;
  }
  startFresh();
}
function startFresh(){
  try{ localStorage.removeItem(SAVE); }catch(e){}
  S=null; hideMenu(); newParty();
}
function savedName(){
  try{ const d=JSON.parse(localStorage.getItem(SAVE)); const p=d&&d.parties&&d.parties.find(x=>x.id===PL);
    return p?p.name:'без названия'; }catch(e){ return 'без названия'; }
}
function menuContinue(){
  if(!hasSave()){ toast('Сохранения нет'); return; }
  if(!load()){ toast('Сохранение повреждено'); return; }
  hideMenu(); render();
  logMsg('Правление продолжено.',0);
}
function menuAbout(){
  sheetOpen({eye:'Республика Новария',title:'О стране',
    body:`<img src="${FLAG}" alt="Флаг Республики Новария" style="width:156px;display:block;margin:0 0 12px;filter:drop-shadow(0 2px 3px rgba(20,19,15,.22))">
      <p class="lead">Полупрезидентская республика: ${REGIONS.length} субъектов от Балтики до Тихоокеанска,
        две палаты, президент со своим сроком и правительство, отвечающее перед нижней палатой.</p>
      <div class="res"><span>Народное собрание</span><b>${SEATS} мандатов</b>
        <span>Сенат</span><b>${SEN_SEATS} мест по субъектам</b>
        <span>Созыв</span><b>${quarters(TERM)}</b>
        <span>Президентский срок</span><b>${quarters(PTERM)}</b>
        <span>Субъектов</span><b>${REGIONS.length}</b>
        <span>Групп избирателей</span><b>${GROUPS.length}</b></div>
      <p>Хозяйство держится на добыче и переработке, налоги собирают три сбора, бюджет расходится по
        шести статьям. Власть в стране намеренно не сходится в одних руках: палаты живут по разным
        часам, и большинство в одной почти никогда не означает большинства в другой.</p>
      <p class="hint">Партии: ${[...PRESETS.map(x=>x.name).slice(0,1),...AIPARTIES.map(x=>x.name)].join(', ')}.</p>`,
    acts:[{label:'Закрыть'}]});
}
function menuStats(){
  const has=hasSave();
  let d=null; try{ d=JSON.parse(localStorage.getItem(SAVE)); }catch(e){}
  sheetOpen({eye:'Новария · показатели',title:'Статистика',
    body:has&&d?`<p class="lead">Последняя партия — «${savedName()}», ${d.q} квартал истории.</p>
        <div class="res"><span>Законов принято</span><b>${(d.laws||[]).length}</b>
          <span>Голосований</span><b>${(d.votes||[]).length}</b>
          <span>Записей в летописи</span><b>${(d.chron||[]).length}</b>
          <span>Поправок к конституции</span><b>${((d.cn||{}).log||[]).length}</b>
          <span>Президентов сменилось</span><b>${((d.rulers||{}).pres||[]).length}</b>
          <span>Кабинетов</span><b>${((d.rulers||{}).pm||[]).length}</b></div>
        <p class="hint">Подробные показатели — в разделах «Летопись» и «Правители» внутри игры.</p>
        <h3 class="sub">Зал славы</h3>${recTable(10)}
        <p class="hint">Достижений открыто за все партии: ${Object.keys(achvGlobal()).length} из ${ACHV.length}.</p>`
      :records().length?`<h3 class="sub" style="margin-top:0">Зал славы</h3>${recTable(10)}`
      :`<p class="lead">Показатели появятся после первой партии.</p>
        <p class="hint">Игра ведёт летопись решений, список правителей с их достижениями и историю
          изменений основного закона. Всё это открывается изнутри.</p>`,
    acts:[{label:'Закрыть'}]});
}
function menuSettings(){
  const on=k=>{ try{ return localStorage.getItem('nov.'+k)!=='0'; }catch(e){ return true; } };
  const set=(k,v)=>{ try{ localStorage.setItem('nov.'+k,v?'1':'0'); }catch(e){} };
  sheetOpen({eye:'Новария · интерфейс',title:'Настройки',
    body:`<p class="lead">Настройки касаются подачи, а не расчётов: сохранение и ход игры они не меняют.</p>
      <div class="res"><span>Движение на титульном экране</span><b>${on('motion')?'включено':'выключено'}</b>
        <span>Подсказки в карточках</span><b>${on('tips')?'включены':'выключены'}</b>
        <span>Вопрос перед закрытием квартала</span><b>${on('askend')?'задаётся':'не задаётся'}</b>
        <span>Страна для новой игры</span><b>${on('hard')&&localStorage.getItem('nov.hard')==='1'?'жёсткая':'обычная'}</b>
        <span>Сохранение</span><b>${hasSave()?'есть':'нет'}</b></div>`,
    opts:[
      {label:on('motion')?'Выключить движение':'Включить движение',hint:'плавные переходы интерфейса',
       fn(){ set('motion',!on('motion')); applyPrefs(); menuSettings(); }},
      {label:on('tips')?'Скрыть подсказки':'Показывать подсказки',hint:'пояснения под таблицами',
       fn(){ set('tips',!on('tips')); applyPrefs(); menuSettings(); }},
      {label:localStorage.getItem('nov.hard')==='1'?'Новая игра — обычная страна':'Новая игра — жёсткая страна',
       hint:'жёсткая: власть изнашивается быстрее, края горячее, потрясения чаще',
       fn(){ try{ localStorage.setItem('nov.hard',localStorage.getItem('nov.hard')==='1'?'0':'1'); }catch(e){} menuSettings(); }},
      {label:on('askend')?'Не спрашивать о несгоревших ходах':'Спрашивать о несгоревших ходах',
       hint:'вопрос, если квартал закрывают с оставшимися действиями',
       fn(){ set('askend',!on('askend')); menuSettings(); }},
      ...(hasSave()?[{label:'Стереть сохранение',hint:'партия будет потеряна безвозвратно',
       fn(){ try{localStorage.removeItem(SAVE);}catch(e){} toast('Сохранение стёрто'); showMenu(); }}]:[]),
      {label:'Закрыть',hint:'вернуться в меню',fn(){}}]});
}
function menuCredits(){
  sheetOpen({eye:'Об игре',title:'НОВАРИЯ',
    body:`<p class="lead">Политический симулятор вымышленной республики. Один файл, никаких внешних
        картинок: карта, флаг, зал Сената и этот пейзаж нарисованы разметкой.</p>
      <div class="res"><span>Версия</span><b>${GAME_VER}</b>
        <span>Разделов</span><b>${TABS.length}</b>
        <span>Тем законов</span><b>${TOPICS.length}</b>
        <span>Поправок к конституции</span><b>${CONSTS.length}</b>
        <span>Групп капитала</span><b>${FIRMS.length}</b></div>
      <p class="hint">Внутри игры типографика другая — газетная полоса. Этот экран единственный,
        где страна показана, а не расчерчена.</p>`,
    acts:[{label:'Закрыть'}]});
}
function menuExit(){
  sheetOpen({eye:'Выход',title:'До новых встреч',
    body:`<p class="lead">Закрыть игру можно просто закрыв вкладку — сохранение останется на месте.</p>
      <p class="hint">Если хотите начать с чистого листа, сотрите сохранение в настройках.</p>`,
    opts:[{label:'Свернуть титульный экран',hint:'остаться на странице',
       fn(){ const el=document.getElementById('menu');
         if(el)el.innerHTML='<div class="mn-wrap" style="place-content:center;text-align:center">'+
           '<div class="mn-name" style="grid-column:1/-1"><h1>НОВАРИЯ</h1>'+
           '<u>Сегодня — решения. Завтра — сильная Новария.</u>'+
           '<p style="margin-top:22px"><button class="mn-btn on" style="display:inline-flex" '+
           'onclick="showMenu()"><b>Вернуться в меню</b></button></p></div></div>'; }},
      {label:'Остаться',hint:'вернуться в меню',fn(){}}]});
}
function applyPrefs(){
  const on=k=>{ try{ return localStorage.getItem('nov.'+k)!=='0'; }catch(e){ return true; } };
  document.body.classList.toggle('ui-motion-off',!on('motion'));
  document.body.classList.toggle('ui-no-tips',!on('tips'));
}

function hideSplash(){
  const s=document.getElementById('splash');
  if(s){ s.classList.add('hide'); setTimeout(()=>s.remove(),400); }
}
function start(){
  document.getElementById('emb').src=EMBLEM;
  document.getElementById('splash-em').src=EMBLEM;
  const fav=document.createElement('link');fav.rel='icon';fav.href=EMBLEM;document.head.appendChild(fav);
  applyPrefs();
  const ready=()=>setTimeout(hideSplash,320);
  if(document.fonts&&document.fonts.ready)document.fonts.ready.then(ready); else ready();
  setTimeout(hideSplash,2600);
  // сначала обложка, и только из неё — внутрь страны
  showMenu();
}
document.addEventListener('DOMContentLoaded',start);
