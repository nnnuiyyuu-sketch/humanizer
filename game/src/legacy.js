
/* ════════════════════════════════════════════════════════════════
   НАСЛЕДИЕ
   Карьера заканчивается газетой: последняя полоса с биографией,
   цифрами эпохи и тем, что о вас писали. Достижения собираются
   по креслам — у премьера свои, у губернатора свои. Зал славы
   помнит все прожитые партии на этом устройстве.
   ════════════════════════════════════════════════════════════════ */
const REC_KEY='nov.records', ACHV_KEY='nov.achv';
const SEAT_RANK=['none','mayor','dep','lead','sen','gov','min','vice','vp','pm','pres'];

/* счётчики событий для достижений */
function cnt(k,n){ S.cnt=S.cnt||{}; S.cnt[k]=(S.cnt[k]||0)+(n==null?1:n); return S.cnt[k]; }
function cntOf(k){ return (S.cnt&&S.cnt[k])||0; }
function held(seat){ return !!(S.held&&S.held[seat]!=null); }
function topSeat(){
  const h=Object.keys(S.held||{}); if(!h.length)return mySeat();
  return h.sort((a,b)=>SEAT_RANK.indexOf(b)-SEAT_RANK.indexOf(a))[0];
}

const ACHV=[
  {id:'budget3', grp:'Кабинет', name:'Три бюджета подряд', txt:'Собрание трижды подряд утвердило ваш бюджет.', ok:()=>cntOf('budgetRun')>=3},
  {id:'motion',  grp:'Кабинет', name:'Вотум отбит', txt:'Оппозиция внесла вотум против вашего кабинета — и проиграла.', ok:()=>cntOf('motionWon')>=1},
  {id:'coal16',  grp:'Кабинет', name:'Долгая коалиция', txt:'Кабинет продержался четыре года.', ok:()=>isPM()&&(S.govAge||0)>=16},
  {id:'proj2',   grp:'Кабинет', name:'Строитель', txt:'Два национальных проекта сданы при вашем кабинете.', ok:()=>cntOf('proj')>=2},
  {id:'laws10',  grp:'Кабинет', name:'Законодатель', txt:'Десять законов вашей партии.', ok:()=>S.laws.filter(l=>l.by===PL).length>=10},
  {id:'pres',    grp:'Президентство', name:'Президент', txt:'Вы заняли президентское кресло.', ok:()=>held('pres')},
  {id:'pres2',   grp:'Президентство', name:'Второй срок', txt:'Страна переизбрала вас президентом.', ok:()=>isPres()&&S.pres.term>=2},
  {id:'court',   grp:'Президентство', name:'Свой суд', txt:'Большинство Конституционного суда назначено вашей партией.', ok:()=>courtSeats(PL)>=courtMaj()},
  {id:'gov',     grp:'Край и город', name:'Губернатор', txt:'Вы возглавили край.', ok:()=>held('gov')},
  {id:'mayorgov',grp:'Край и город', name:'Из мэров в губернаторы', txt:'Поднялись от мэра столицы края до главы края.', ok:()=>held('mayor')&&held('gov')&&S.held.mayor<S.held.gov},
  {id:'calm',    grp:'Край и город', name:'Тихий край', txt:'Восемь кварталов подряд ваш край спокоен.', ok:()=>cntOf('calmRun')>=8},
  {id:'sen',     grp:'Палаты', name:'Сенатор', txt:'Вы получили место в Сенате.', ok:()=>held('sen')},
  {id:'dealer',  grp:'Палаты', name:'Мастер сделок', txt:'Десять сделок с лидерами фракций.', ok:()=>cntOf('deals')>=10},
  {id:'trade',   grp:'Палаты', name:'Открытые рынки', txt:'Сенат ратифицировал два торговых соглашения.', ok:()=>cntOf('trade')>=2},
  {id:'climb',   grp:'Путь', name:'С нуля', txt:'Начали без кресла и дошли до премьера или президента.', ok:()=>S.startSeat==='none'&&(held('pm')||held('pres'))},
  {id:'clean',   grp:'Путь', name:'Чистые руки', txt:'Десять лет в политике, а след от сделок почти не виден.', ok:()=>S.q>=40&&trail()<10},
  {id:'fire',    grp:'Путь', name:'Пожар потушен', txt:'Скандал горел пожаром, а одобрение вернулось к половине.', ok:()=>cntOf('fire')>=1&&!scMine().some(x=>x.heat>=50)&&approval()>=50},
  {id:'acquit',  grp:'Путь', name:'Оправдательный приговор', txt:'Дело против вас дошло до суда — и развалилось.', ok:()=>cntOf('acquit')>=1},
  {id:'peace',   grp:'Путь', name:'Миротворец', txt:'Кризис на границе закончился переговорами.', ok:()=>cntOf('peace')>=1},
  {id:'union',   grp:'Путь', name:'Страна едина', txt:'Десять лет — и ни один край не стоит на грани.', ok:()=>S.q>=40&&REGIONS.every(r=>regSep(r.id)<25&&!regSov(r.id))},
  {id:'three',   grp:'Путь', name:'Три созыва', txt:'Вы дошли до конституционного предела.', ok:()=>S.term>=3},
];
function achvGlobal(){ try{ return JSON.parse(localStorage.getItem(ACHV_KEY))||{}; }catch(e){ return {}; } }
function achvTick(){
  if(!S.you)return;
  S.held=S.held||{}; S.achv=S.achv||{};
  if(S.startSeat==null)S.startSeat=mySeat();
  if(S.held[mySeat()]==null)S.held[mySeat()]=S.q;
  // серии и вспышки
  if(scMine().some(x=>x.heat>=75)){ cnt('fire',0); S.cnt.fire=1; }
  const d=S.desk; if(mySeat()==='gov'&&d&&d.rid&&S.unrest[d.rid]<12)cnt('calmRun'); else if(S.cnt)S.cnt.calmRun=0;
  const fresh=ACHV.filter(a=>S.achv[a.id]==null&&(()=>{ try{ return a.ok(); }catch(e){ return false; } })());
  if(!fresh.length)return;
  const g=achvGlobal();
  fresh.forEach(a=>{ S.achv[a.id]=S.q; g[a.id]=(g[a.id]||0)+1;
    logMsg('Достижение: «'+a.name+'». '+a.txt,1); career('Достижение: «'+a.name+'».'); });
  try{ localStorage.setItem(ACHV_KEY,JSON.stringify(g)); }catch(e){}
  toast('Достижение: '+fresh.map(a=>a.name).join(', '));
}
function achvPanel(){
  const got=S.achv||{}, g=achvGlobal();
  const grps=[...new Set(ACHV.map(a=>a.grp))];
  return panel({title:'Достижения',meta:Object.keys(got).length+' из '+ACHV.length,body:
    grps.map(gr=>`<h3 class="sub">${gr}</h3><div class="achv">${ACHV.filter(a=>a.grp===gr).map(a=>
      `<div class="${got[a.id]!=null?'on':''}"><b>${a.name}</b><span>${got[a.id]!=null?shortDate(got[a.id]):a.txt}${
        g[a.id]&&got[a.id]==null?' · было в прошлых партиях':''}</span></div>`).join('')}</div>`).join('')});
}

/* ─── зал славы: все прожитые партии на этом устройстве ─────────── */
function records(){ try{ return JSON.parse(localStorage.getItem(REC_KEY))||[]; }catch(e){ return []; } }
function recSave(won){
  if(S.recSaved)return; S.recSaved=true;
  const {s,t}=score(), p=me();
  const rec={party:p.name,short:p.short,color:p.color,leader:S.you?S.you.name:p.leader,score:s,title:t,q:S.q,
    top:(SEATS_YOU[topSeat()]||{name:topSeat()}).name,laws:S.laws.filter(l=>l.by===PL).length,
    maxSeats:Math.max(seatsOf(PL),...(S.hist||[]).map(h=>h.seats||0)),won:!!won,hard:S.diff==='hard',
    achv:Object.keys(S.achv||{}).length,year:2029+Math.floor((S.q-1)/4),at:Date.now()};
  const all=records().concat([rec]).sort((a,b)=>b.score-a.score).slice(0,30);
  try{ localStorage.setItem(REC_KEY,JSON.stringify(all)); }catch(e){}
  S.recAt=rec.at;
}
function recTable(n,mine,compact){
  const all=records().slice(0,n||10);
  if(!all.length)return '<div class="empty">Зал славы пуст: он заполнится, когда закончится первая карьера.</div>';
  if(compact)return `<table class="tight"><tbody>${all.map((r,i)=>`<tr class="${mine&&r.at===mine?'mine':''}"><td class="n">${i+1}</td>
      <td><b style="border-left:4px solid ${r.color};padding-left:6px">${r.short}</b> <span class="sub2">${r.leader}</span></td>
      <td class="n">${r.score}</td><td class="n">${r.year}</td></tr>`).join('')}</tbody></table>`;
  return `<div class="scrollx"><table class="tight"><thead><tr><th>#</th><th>Партия и лидер</th><th class="n">Очки</th>
    <th class="hide-s">Высшее кресло</th><th class="n hide-s">Законов</th><th class="n">До</th></tr></thead><tbody>${all.map((r,i)=>
    `<tr class="${mine&&r.at===mine?'mine':''}"><td class="n">${i+1}</td>
      <td><b style="border-left:4px solid ${r.color};padding-left:6px">${r.party}</b><div class="sub2">${r.leader} · «${r.title}»${r.hard?' · жёсткая страна':''}</div></td>
      <td class="n">${r.score}</td><td class="hide-s">${r.top}</td><td class="n hide-s">${r.laws}</td><td class="n">${r.year}</td></tr>`).join('')}
    </tbody></table></div>`;
}

/* ─── биография из карьеры и летописи ────────────────────────────── */
function bioText(){
  const y=S.you; if(!y)return [];
  const or0=origin(), p=me(), car=y.career||[];
  const first=car[0]?car[0].y:2029;
  const tr=(y.traits||[]).map(id=>TR(id)).filter(Boolean).map(t=>t.name.toLowerCase());
  const out=[];
  out.push(`Начало пути — ${first} год: ${y.name}${or0?', '+or0.name.toLowerCase():''}, во главе «${p.name}».`+
    (tr.length?` Современники запомнили: ${tr.join(' и ')}.`:''));
  const seats=car.map(c=>{ const m=/Кресло: ([^.]+)\./.exec(c.t); return m?{y:c.y,s:m[1]}:null; }).filter(Boolean);
  const s0=SEATS_YOU[S.startSeat||'']; if(s0&&(!seats.length||seats[0].s!==s0.name.toLowerCase()))seats.unshift({y:first,s:s0.name.toLowerCase()});
  const path=seats.filter((x,i)=>!i||x.s!==seats[i-1].s).slice(0,8);
  if(path.length)out.push('Путь по креслам: '+path.map(x=>x.y+' — '+x.s).join('; ')+'.');
  const laws=S.laws.filter(l=>l.by===PL);
  const deeds=[];
  if(laws.length)deeds.push(plural(laws.length,'закон','закона','законов')+' партии, среди них '+laws.slice(0,3).map(l=>'«'+l.name+'»').join(', '));
  const trade=NEIGHBOURS.filter(x=>nbOf(x.id)&&nbOf(x.id).trade).map(x=>'«'+x.name+'»');
  if(trade.length)deeds.push('торговые соглашения с '+trade.join(' и '));
  const wins=car.filter(c=>/Переизбраны|стал главой|Выборы|победа/i.test(c.t)).length;
  if(wins)deeds.push('выигранных кампаний: '+wins);
  if(deeds.length)out.push('За это время — '+deeds.join('; ')+'.');
  const bad=S.chron.filter(c=>c.kind==='b').slice(-3);
  const sc=scandals().filter(x=>x.who==='you').length;
  if(bad.length||sc)out.push((sc?'Скандалов вокруг имени — '+sc+'. ':'')+(bad.length?'Тяжёлые страницы: '+bad.map(c=>c.y+' — '+c.t.replace(/\.$/,'').toLowerCase()).join('; ')+'.':''));
  const got=ACHV.filter(a=>S.achv&&S.achv[a.id]!=null);
  if(got.length)out.push('Отметки на полях: '+got.map(a=>'«'+a.name+'»').join(', ')+'.');
  if(S.over&&S.ended)out.push(S.ended);
  return out;
}
function bioPanel(){
  return panel({title:'Биография',meta:'пишется сама',body:bioText().map(t=>`<p>${t}</p>`).join('')||'<div class="empty">Биография начнётся с первого кресла.</div>'});
}

/* ─── последняя полоса ────────────────────────────────────────────── */
function finalHead(){
  const {t}=score(), won=S.ended&&!/отрешили|осуждён|провал|пал|проиг/i.test(S.ended);
  return won?`${S.you.name}: итог эпохи — «${t}»`:`${S.you.name} уходит. Итог — «${t}»`;
}
function tabFinal(){
  if(!S.over)return panel({title:'Последняя полоса',body:'<div class="empty">Газета выйдет, когда закончится карьера.</div>'});
  const {s,t}=score();
  const o=PRESS.slice().sort((a,b)=>pressOf(b.id).rel-pressOf(a.id).rel)[0];
  const heads=(S.press&&S.press.heads||[]);
  const best=heads.filter(h=>h.k==='hg').slice(0,2), worst=heads.filter(h=>h.k==='hb').slice(0,2);
  const quote=h=>{ const src=PRESS.find(x=>x.id===h.o); return `<blockquote><p>${h.t}</p><cite>${src?src.name:''} · ${shortDate(h.q)}</cite></blockquote>`; };
  const bio=bioText();
  return `<article class="paper">
    <header class="paper-mast"><span>${dateLabel()} · специальный выпуск</span><b>${o?o.name:'Вестник Новарии'}</b><span>цена 1 новар</span></header>
    <h1 class="paper-h">${finalHead()}</h1>
    <p class="paper-dek">${S.ended||''}</p>
    <div class="paper-cols">
      <section><h3>Биография</h3>${bio.slice(0,-1).map(x=>`<p>${x}</p>`).join('')}</section>
      <section><h3>Цифры эпохи</h3>
        <div class="res" style="margin-top:0"><span>Очки</span><b>${s}</b>
          <span>Высшее кресло</span><b class="w">${(SEATS_YOU[topSeat()]||{name:topSeat()}).name}</b>
          <span>Кварталов в политике</span><b>${S.q-1}</b>
          <span>Законов партии</span><b>${S.laws.filter(l=>l.by===PL).length}</b>
          <span>Мандатов на финише</span><b>${seatsOf(PL)}</b>
          <span>Одобрение</span><b>${Math.round(approval())}%</b>
          <span>ВВП, индекс</span><b>${r1(S.econ.gdp)}</b>
          <span>Долг</span><b>${Math.round(S.debt)} млрд</b>
          <span>Легитимность</span><b>${legit()}</b></div>
        <h3>Что писали</h3>${best.map(quote).join('')}${worst.map(quote).join('')||(!best.length?'<p class="hint">Печать молчала.</p>':'')}
      </section>
      <section><h3>Достижения</h3>
        <div class="achv">${ACHV.filter(a=>S.achv&&S.achv[a.id]!=null).map(a=>`<div class="on"><b>${a.name}</b><span>${a.txt}</span></div>`).join('')||'<p class="hint">Без отметок.</p>'}</div>
        <h3>Зал славы</h3>${recTable(8,S.recAt,true)}</section>
    </div>
    <footer class="paper-foot"><button class="btn" onclick="goTab('arch')">Летопись</button>
      <button class="btn pri" onclick="try{localStorage.removeItem(SAVE)}catch(e){};location.reload()">Начать заново</button></footer>
  </article>`;
}
