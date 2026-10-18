/* ════════════════════════════════════════════════════════════════
   ГРАВЮРЫ И ПОРТРЕТЫ
   Четвёртая редакция держится на «фотографиях из архива»: дворец, город,
   толпа, завод, порт. Файлов нет — всё рисуется здесь же, из seed:
   тот же ключ даёт ту же карточку, чужой ключ — другую. Сепия,
   полутоновая сетка, зерно и виньетка делают из векторных силуэтов
   старый снимок. Портреты строятся из имени так же: один человек —
   одно лицо в любой вкладке. */
let ART_N=0;
function artRand(seed){
  let h=2166136261; String(seed).split('').forEach(c=>{ h^=c.charCodeAt(0); h=Math.imul(h,16777619); });
  return ()=>{ h+=0x6D2B79F5; let t=h; t=Math.imul(t^t>>>15,t|1); t^=t+Math.imul(t^t>>>7,t|61); return((t^t>>>14)>>>0)/4294967296; };
}
const SEP={d0:'#1d140a',d1:'#352513',d2:'#56421f',d3:'#7d6840',d4:'#a99468',d5:'#cdbb91',d6:'#e6d8b3',d7:'#f3eacf'};

/* рамка снимка: небо, зерно, виньетка, полутоновые сетки для теней */
function engSvg(n,body,o){
  o=o||{};
  const sky=o.sky||['#7d6a47','#bda982','#e8dab5'];
  return `<svg class="eng" viewBox="0 0 400 260" preserveAspectRatio="xMidYMid slice" role="img" aria-hidden="true">
  <defs>
    <linearGradient id="sk${n}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${sky[0]}"/><stop offset=".55" stop-color="${sky[1]}"/><stop offset="1" stop-color="${sky[2]}"/></linearGradient>
    <radialGradient id="vg${n}" cx=".5" cy=".5" r=".78"><stop offset=".5" stop-color="#241a0c" stop-opacity="0"/><stop offset="1" stop-color="#241a0c" stop-opacity=".7"/></radialGradient>
    <linearGradient id="gd${n}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c3b088"/><stop offset="1" stop-color="#6e5a38"/></linearGradient>
    <pattern id="ht${n}" width="3" height="3" patternUnits="userSpaceOnUse" patternTransform="rotate(32)"><circle cx="1.5" cy="1.5" r=".85" fill="#22180b" opacity=".6"/></pattern>
    <pattern id="hc${n}" width="3.4" height="3.4" patternUnits="userSpaceOnUse" patternTransform="rotate(-38)"><path d="M0 1.7H3.4" stroke="#2a1d0e" stroke-width=".7" opacity=".5"/></pattern>
    <filter id="gr${n}" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="${n%90}"/><feColorMatrix values="0 0 0 0 .13 0 0 0 0 .09 0 0 0 0 .04 0 0 0 .7 -.2"/></filter>
    <filter id="bl${n}" x="-30%" y="-60%" width="160%" height="220%"><feGaussianBlur stdDeviation="3.2"/></filter>
    <filter id="bs${n}"><feGaussianBlur stdDeviation=".45"/></filter>
  </defs>
  <rect width="400" height="260" fill="url(#sk${n})"/>
  <g filter="url(#bs${n})">${body}</g>
  <rect width="400" height="260" filter="url(#gr${n})"/>
  <rect width="400" height="260" fill="url(#vg${n})"/>
</svg>`;
}
const eRect=(x,y,w,h,f,x2)=>`<rect x="${(+x).toFixed(1)}" y="${(+y).toFixed(1)}" width="${(+w).toFixed(1)}" height="${(+h).toFixed(1)}" fill="${f}"${x2||''}/>`;
/* облака: размытые светлые пятна */
function engClouds(r,n,k,y0,y1,op){
  let s=''; for(let i=0;i<k;i++)s+=`<ellipse cx="${(r()*420-10).toFixed(0)}" cy="${(y0+r()*(y1-y0)).toFixed(0)}" rx="${(36+r()*70).toFixed(0)}" ry="${(7+r()*13).toFixed(0)}" fill="#f6eed3" opacity="${op||.4}" filter="url(#bl${n})"/>`;
  return s;
}
/* окна: сетка прямоугольников или арок */
function engWins(x,y,cols,rows,gx,gy,w,h,fill,arch){
  let s='';
  for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){
    const px=x+i*gx, py=y+j*gy;
    s+=arch?`<path d="M${px} ${py+h}V${py+w/2}a${w/2} ${w/2} 0 0 1 ${w} 0V${py+h}z" fill="${fill}"/>`:eRect(px,py,w,h,fill);
  }
  return s;
}
/* силуэты людей: голова и плечи, с разбросом роста */
function engFolk(r,x0,x1,y,k,fill,sc){
  let s=''; for(let i=0;i<k;i++){ const x=x0+r()*(x1-x0), z=(sc||1)*(.8+r()*.5);
    s+=`<g fill="${fill}" transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${z.toFixed(2)})"><circle cy="-9" r="2.4"/><path d="M-3.4 0V-5a3.4 3.4 0 0 1 6.8 0V0z"/></g>`; }
  return s;
}

/* ─── дворец: колоннады, купол, флаг ───────────────────────────── */
function engPalace(r,n){
  const C=SEP; let s=engClouds(r,n,5,14,78,.42);
  // дальний план: низкие кварталы и шпили
  for(let x=-4;x<404;){ const w=12+r()*20, h=18+r()*34; s+=eRect(x,162-h,w,h,C.d4,' opacity=".7"'); if(r()<.25)s+=`<path d="M${x+w/2-1.2} ${162-h}V${150-h-r()*14}l1.2-6 1.2 6V${162-h}z" fill="${C.d3}" opacity=".8"/>`; x+=w+r()*3; }
  // крылья
  s+=eRect(26,142,126,54,C.d4)+eRect(248,142,126,54,C.d4)+eRect(22,137,134,6,C.d3)+eRect(244,137,134,6,C.d3);
  s+=engWins(36,150,7,2,15.6,22,7,13,C.d1,true)+engWins(258,150,7,2,15.6,22,7,13,C.d1,true);
  s+=eRect(248,142,126,54,`url(#ht${n})`,' opacity=".55"');
  // портик
  s+=eRect(148,126,104,70,C.d5)+eRect(142,118,116,9,C.d3)+eRect(146,127,108,3,C.d2);
  s+=`<path d="M138 118 200 90l62 28z" fill="${C.d4}" stroke="${C.d2}" stroke-width="1.2"/><path d="M200 94 253 118H147z" fill="url(#hc${n})" opacity=".7"/>`;
  for(let i=0;i<6;i++){ const x=154+i*17.2; s+=eRect(x,130,7.2,60,C.d6)+eRect(x+4.6,130,2.6,60,C.d3,' opacity=".75"')+eRect(x-1.4,128,10,3,C.d3)+eRect(x-1.4,188,10,3,C.d3); }
  s+=eRect(188,152,24,38,C.d1)+`<path d="M188 152a12 12 0 0 1 24 0z" fill="${C.d1}"/>`;
  // барабан и купол
  s+=eRect(172,72,56,22,C.d5)+eRect(168,92,64,4,C.d3);
  for(let i=0;i<7;i++)s+=eRect(175+i*8,74,3,18,C.d3,' opacity=".8"');
  s+=`<path d="M168 72Q200 6 232 72z" fill="${C.d3}"/>`;
  for(let k=-3;k<=3;k++)s+=`<path d="M200 22Q${200+k*9} 44 ${200+k*10.4} 72" stroke="${C.d1}" stroke-width=".9" fill="none" opacity=".8"/>`;
  s+=`<path d="M200 72Q222 40 232 72z" fill="url(#ht${n})" opacity=".55"/>`+eRect(195.5,18,9,9,C.d4)+`<path d="M200 18V2" stroke="${C.d1}" stroke-width="1.4"/>`+
     `<path d="M200 2q11-4 21 1v9q-10-5-21-1z" fill="${C.d1}"/>`;
  // ступени и площадь
  for(let i=0;i<5;i++)s+=eRect(136-i*4,190+i*5,128+i*8,5,i%2?C.d4:C.d5);
  s+=`<rect y="214" width="400" height="46" fill="url(#gd${n})"/>`;
  for(let i=0;i<3;i++){ const x=40+i*160+r()*20; s+=eRect(x,196,1.6,26,C.d1)+`<circle cx="${(x+.8).toFixed(1)}" cy="195" r="3.4" fill="${C.d6}" stroke="${C.d1}" stroke-width=".8"/>`; }
  s+=engFolk(r,30,370,236,26,C.d0,1.5);
  // деревья по краям
  for(const x of [10,392])for(let i=0;i<5;i++)s+=`<circle cx="${(x+(r()-.5)*26).toFixed(0)}" cy="${(170+r()*40).toFixed(0)}" r="${(10+r()*10).toFixed(0)}" fill="${C.d1}" opacity=".85"/>`;
  return engSvg(n,s);
}

/* ─── город: башни и шпили над набережной ──────────────────────── */
function engCity(r,n){
  const C=SEP; let s=engClouds(r,n,6,10,90,.38);
  for(let x=-6;x<406;){ const w=14+r()*24, h=30+r()*50; s+=eRect(x,168-h,w,h,C.d4,' opacity=".6"')+engWins(x+3,168-h+6,Math.floor(w/6),Math.floor(h/10),6,9,2.6,4,C.d3); x+=w+r()*2; }
  // высотная башня уступами
  const tx=130+r()*140; let y=170, w=44;
  for(let t=0;t<5;t++){ const h=30+t*3; s+=eRect(tx-w/2,y-h,w,h,t%2?C.d3:C.d2)+engWins(tx-w/2+4,y-h+5,Math.floor((w-6)/8),Math.floor((h-8)/9),8,9,3,5,C.d6); s+=eRect(tx-w/2-2,y-h-2,w+4,3,C.d1); y-=h; w-=7; }
  s+=eRect(tx-3,y-26,6,26,C.d2)+`<path d="M${tx-3} ${y-26}L${tx} ${y-58} ${tx+3} ${y-26}z" fill="${C.d1}"/><path d="M${tx} ${y-58}V${y-72}" stroke="${C.d1}" stroke-width="1.2"/>`+
     `<path d="M${tx} ${y-72} ${tx+2} ${y-67} ${tx+7} ${y-67} ${tx+3} ${y-64} ${tx+5} ${y-59} ${tx} ${y-62} ${tx-5} ${y-59} ${tx-3} ${y-64} ${tx-7} ${y-67} ${tx-2} ${y-67}z" fill="${C.d0}" transform="translate(0 6)"/>`;
  // башня с часами
  const cx=tx+(r()<.5?-1:1)*(90+r()*30);
  s+=eRect(cx-12,86,24,84,C.d2)+eRect(cx-14,82,28,6,C.d1)+`<circle cx="${cx.toFixed(1)}" cy="100" r="7" fill="${C.d6}" stroke="${C.d0}" stroke-width="1.2"/><path d="M${cx} 100V95M${cx} 100h3" stroke="${C.d0}" stroke-width="1"/>`+
     `<path d="M${cx-14} 82 ${cx} 46 ${cx+14} 82z" fill="${C.d1}"/><path d="M${cx} 46V30" stroke="${C.d1}" stroke-width="1.2"/>`;
  s+=eRect(tx-w/2-30,128,100,42,`url(#ht${n})`,' opacity=".35"');
  // набережная и вода
  s+=eRect(0,170,400,12,C.d2)+eRect(0,182,400,78,C.d4)+`<rect y="182" width="400" height="78" fill="url(#hc${n})" opacity=".55"/>`;
  for(let i=0;i<22;i++)s+=`<path d="M${(r()*390).toFixed(0)} ${(188+r()*66).toFixed(0)}h${(10+r()*22).toFixed(0)}" stroke="${C.d6}" stroke-width=".9" opacity=".6"/>`;
  // мост
  s+=`<path d="M0 200Q100 176 200 200T400 200V206Q300 186 200 206T0 206z" fill="${C.d1}" opacity=".85"/>`;
  s+=engFolk(r,20,380,176,12,C.d0,1.1);
  return engSvg(n,s);
}

/* ─── толпа: флаги, транспарант, лица ──────────────────────────── */
function engCrowd(r,n,o){
  const C=SEP; o=o||{}; let s=engClouds(r,n,4,10,50,.3);
  // фасад позади
  s+=eRect(0,60,400,110,C.d4,' opacity=".75"')+engWins(8,70,24,5,16.5,19,7,12,C.d2);
  s+=eRect(0,60,400,110,`url(#hc${n})`,' opacity=".45"');
  // флаги на древках
  for(let i=0;i<7;i++){ const x=20+i*56+r()*20, h=40+r()*40; s+=eRect(x,110-h,1.6,h+40,C.d1)+
    `<path d="M${x+1.6} ${110-h}q16-7 30 0v20q-14-7-30 0z" fill="${i%2?C.d1:C.d2}"/><path d="M${x+1.6} ${120-h}q15-6 30 0" stroke="${C.d6}" stroke-width="1.8" fill="none" opacity=".7"/>`; }
  // транспарант
  const t=o.text||'НОВАРИЯ — СТРАНА ВОЗМОЖНОСТЕЙ';
  s+=`<g transform="rotate(-2.2 200 128)">${eRect(70,112,260,34,C.d7)}${eRect(70,112,260,3,C.d2)}${eRect(70,143,260,3,C.d2)}
    <text x="200" y="134.5" text-anchor="middle" textLength="${Math.min(236,t.length*8.4)}" lengthAdjust="spacingAndGlyphs" font-family="PT Sans Narrow,Arial Narrow,sans-serif" font-weight="700" font-size="15" fill="${C.d0}">${t}</text>
    ${eRect(98,146,1.6,26,C.d1)}${eRect(300,146,1.6,26,C.d1)}</g>`;
  // ряды толпы: лица светлее, одежда темнее; ближние ряды крупнее и темнее
  const rows=[[170,2.1,'#6f5b39',C.d4,48],[186,2.9,'#4a3820',C.d4,40],[206,4,'#2c1f10',C.d3,32],[232,5.6,'#170f06',C.d3,24]];
  rows.forEach(([y,sc,f,face,k])=>{ for(let i=0;i<k;i++){ const x=-6+i*(412/k)+r()*8, z=sc*(.85+r()*.35);
    s+=`<g transform="translate(${x.toFixed(1)} ${(y+r()*5).toFixed(1)}) scale(${z.toFixed(2)})"><path d="M-5.4 16V1a5.4 5.4 0 0 1 10.8 0V16z" fill="${f}"/><ellipse cy="-8.6" rx="3" ry="3.5" fill="${face}"/><path d="M-3.2 -9.6a3.2 3.2 0 0 1 6.4 0c-1.6-1.4-4.8-1.4-6.4 0z" fill="${r()<.5?C.d0:C.d2}"/>${r()<.12?`<path d="M3 -1l7-12" stroke="${f}" stroke-width="1.5"/><path d="M10 -13l8 -2v6z" fill="${f}"/>`:''}</g>`; } });
  return engSvg(n,s,{sky:['#8a7650','#c4b087','#e6d7b1']});
}

/* ─── завод: трубы, дым, пилообразные крыши ────────────────────── */
function engFactory(r,n){
  const C=SEP; let s=engClouds(r,n,3,8,40,.3);
  for(let i=0;i<5;i++){ const x=20+r()*360; s+=`<ellipse cx="${x.toFixed(0)}" cy="${(30+r()*30).toFixed(0)}" rx="${(30+r()*40).toFixed(0)}" ry="${(14+r()*16).toFixed(0)}" fill="${C.d2}" opacity="${(.28+r()*.2).toFixed(2)}" filter="url(#bl${n})"/>`; }
  for(let x=0;x<400;){ const w=24+r()*30, h=22+r()*30; s+=eRect(x,160-h,w,h,C.d4,' opacity=".6"'); x+=w+r()*3; }
  // трубы
  const chim=[70,150,252,330].map(x=>x+r()*20);
  chim.forEach((x,i)=>{ const h=100+r()*50; s+=`<path d="M${x-7} 172 ${x-4.5} ${172-h} ${x+4.5} ${172-h} ${x+7} 172z" fill="${C.d1}"/>`+eRect(x-5,172-h+10,10,3,C.d5)+eRect(x-5.6,172-h+26,11.2,3,C.d5)+eRect(x-4.8,172-h-3,9.6,4,C.d0);
    s+=`<ellipse cx="${(x+8).toFixed(0)}" cy="${(172-h-14).toFixed(0)}" rx="14" ry="9" fill="${C.d1}" opacity=".6" filter="url(#bl${n})"/><ellipse cx="${(x+24).toFixed(0)}" cy="${(172-h-30).toFixed(0)}" rx="22" ry="12" fill="${C.d1}" opacity=".4" filter="url(#bl${n})"/>`; });
  // цеха с пилообразной кровлей
  for(let k=0;k<3;k++){ const x=10+k*130, w=120; s+=eRect(x,150,w,38,C.d3)+engWins(x+6,158,9,1,12.4,10,7,16,C.d6);
    for(let j=0;j<6;j++)s+=`<path d="M${x+j*20} 150l0-14 20 14z" fill="${C.d2}"/>`; s+=eRect(x,150,w,38,`url(#ht${n})`,' opacity=".3"'); }
  // кран и ж/д
  s+=`<path d="M300 188V110h46l-6 9M300 118h50" stroke="${C.d0}" stroke-width="2.6" fill="none"/><path d="M346 119V150" stroke="${C.d0}"/>${eRect(341,150,10,7,C.d0)}`;
  s+=`<rect y="188" width="400" height="72" fill="url(#gd${n})"/>`;
  for(let i=0;i<2;i++){ const y=206+i*18; s+=`<path d="M0 ${y}H400" stroke="${C.d1}" stroke-width="2.2"/>`; for(let x=(i?6:0);x<400;x+=14)s+=eRect(x,y-3,5,8,C.d1,' opacity=".6"'); }
  s+=engFolk(r,20,380,228,8,C.d0,1.3);
  return engSvg(n,s,{sky:['#7a6b52','#b7a681','#dccdA8']});
}

/* ─── поле и элеватор ──────────────────────────────────────────── */
function engField(r,n){
  const C=SEP; let s=engClouds(r,n,7,8,80,.5);
  s+=`<path d="M0 150Q80 128 170 146T400 138V260H0z" fill="${C.d4}"/><path d="M0 170Q100 150 220 168T400 160V260H0z" fill="${C.d3}"/>`;
  // силосы
  const sx=230+r()*60;
  for(let i=0;i<4;i++){ const x=sx+i*17; s+=eRect(x,118-i%2*6,14,52,C.d5)+`<path d="M${x} ${118-i%2*6}a7 5 0 0 1 14 0z" fill="${C.d3}"/>`+eRect(x+8,118-i%2*6,6,52,`url(#ht${n})`,' opacity=".5"'); }
  s+=eRect(sx-6,128,84,6,C.d2)+eRect(sx-4,134,2,36,C.d2)+eRect(sx+76,134,2,36,C.d2);
  // опоры ЛЭП
  for(let i=0;i<4;i++){ const x=30+i*70, y=150+i*2; s+=`<path d="M${x} ${y}l8-46 8 46M${x+3} ${y-22}h10M${x-4} ${y-44}h24" stroke="${C.d0}" stroke-width="1.4" fill="none"/>`; }
  s+=`<path d="M26 106Q64 114 102 108T170 110T240 112" stroke="${C.d0}" stroke-width=".6" fill="none" opacity=".8"/>`;
  // борозды в перспективе
  for(let i=-16;i<=16;i++)s+=`<path d="M${200+i*6} 178L${200+i*34} 260" stroke="${C.d1}" stroke-width="1.3" opacity=".55"/>`;
  for(let i=0;i<4;i++)s+=`<path d="M0 ${186+i*18}Q200 ${178+i*14} 400 ${186+i*18}" stroke="${C.d6}" stroke-width=".9" opacity=".35" fill="none"/>`;
  // трактор
  const tx=50+r()*60; s+=eRect(tx,206,26,11,C.d0)+eRect(tx+6,198,12,9,C.d1)+`<circle cx="${tx+5}" cy="220" r="8" fill="${C.d0}"/><circle cx="${tx+23}" cy="222" r="5" fill="${C.d0}"/>`;
  return engSvg(n,s,{sky:['#8b7a58','#c8b88e','#ebdfbd']});
}

/* ─── порт: краны, суда, маяк ──────────────────────────────────── */
function engPort(r,n){
  const C=SEP; let s=engClouds(r,n,5,10,70,.4);
  s+=`<rect y="150" width="400" height="110" fill="${C.d3}"/>`;
  for(let i=0;i<46;i++)s+=`<path d="M${(r()*380).toFixed(0)} ${(154+r()*100).toFixed(0)}h${(14+r()*40).toFixed(0)}" stroke="${C.d6}" stroke-width="1" opacity="${(.2+r()*.4).toFixed(2)}"/>`;
  // дальний берег и маяк
  s+=`<path d="M0 150Q60 138 140 148T260 146 400 150z" fill="${C.d4}"/>`+`<path d="M360 148l5-48h8l5 48z" fill="${C.d6}" stroke="${C.d2}"/>`+eRect(363,86,12,14,C.d1)+`<path d="M361 86h16l-8-9z" fill="${C.d0}"/>`;
  // портальные краны
  for(let i=0;i<3;i++){ const x=30+i*86+r()*14;
    s+=`<path d="M${x} 190V120h54M${x+4} 120V190M${x+46} 120V190M${x-6} 120l10-12h48l8 12" stroke="${C.d0}" stroke-width="2.2" fill="none"/><path d="M${x+40} 120V164" stroke="${C.d0}" stroke-width="1"/>${eRect(x+34,164,12,9,C.d1)}`; }
  // судно
  const bx=90+r()*140;
  s+=`<path d="M${bx} 178h150l-14 22H${bx+14}z" fill="${C.d0}"/>`+eRect(bx+90,150,36,28,C.d5)+eRect(bx+96,138,14,12,C.d6)+eRect(bx+108,128,8,22,C.d1)+
     engWins(bx+94,156,5,1,7,8,4,7,C.d1)+`<path d="M${bx+20} 178V150M${bx+50} 178V146" stroke="${C.d1}" stroke-width="1.6"/>`;
  for(let i=0;i<9;i++)s+=eRect(bx+22+i*9,166,7,12,[C.d2,C.d3,C.d1][Math.floor(r()*3)]);
  // причал
  s+=eRect(0,196,400,64,`url(#gd${n})`)+eRect(0,194,400,4,C.d1);
  for(let x=4;x<400;x+=22)s+=eRect(x,198,3,14,C.d1,' opacity=".6"');
  s+=engFolk(r,20,380,226,10,C.d0,1.4);
  return engSvg(n,s,{sky:['#7f6f4f','#bfae86','#e4d6b0']});
}

/* ─── зал заседаний: ряды, трибуна, люстра ─────────────────────── */
function engChamber(r,n){
  const C=SEP; let s='';
  s+=eRect(0,0,400,260,C.d2)+`<rect x="0" y="0" width="400" height="260" fill="url(#hc${n})" opacity=".4"/>`;
  // арки окон
  for(let i=0;i<5;i++){ const x=30+i*76; s+=`<path d="M${x} 118V54a22 22 0 0 1 44 0V118z" fill="${C.d6}"/><path d="M${x+22} 32V118M${x} 76H${x+44}" stroke="${C.d3}" stroke-width="1.4"/><path d="M${x} 118V54a22 22 0 0 1 44 0V118z" fill="url(#ht${n})" opacity=".3"/>`; }
  s+=eRect(0,114,400,8,C.d1);
  // колоны
  for(let i=0;i<6;i++){ const x=8+i*76; s+=eRect(x,40,9,78,C.d4)+eRect(x+5,40,4,78,C.d2,' opacity=".7"'); }
  // люстра
  s+=`<path d="M200 0V26" stroke="${C.d0}"/><path d="M168 38Q200 22 232 38L224 48H176z" fill="${C.d6}" stroke="${C.d1}"/>`;
  for(let i=0;i<9;i++)s+=`<circle cx="${(172+i*7).toFixed(0)}" cy="52" r="2.2" fill="${C.d7}"/>`;
  // трибуна и президиум
  s+=eRect(160,122,80,20,C.d1)+eRect(150,118,100,6,C.d3)+eRect(188,100,24,22,C.d0)+`<circle cx="200" cy="94" r="5.4" fill="${C.d0}"/>`;
  // ряды: дуги из голов
  for(let row=0;row<8;row++){ const y=150+row*13, k=22+row*3, sc=.9+row*.2;
    s+=eRect(0,y+4,400,5,row%2?C.d1:C.d0,' opacity=".85"');
    for(let i=0;i<k;i++){ const x=(i+.5)*(400/k)+(r()-.5)*5; s+=`<g fill="${row%2?C.d1:C.d0}" transform="translate(${x.toFixed(1)} ${y+4}) scale(${sc.toFixed(2)})"><circle cy="-8" r="2.6"/><path d="M-4 1V-4a4 4 0 0 1 8 0V1z"/></g>`; } }
  return engSvg(n,s,{sky:['#4c3b22','#6f5a38','#8e7a52']});
}

const ENG={palace:engPalace,city:engCity,crowd:engCrowd,factory:engFactory,field:engField,port:engPort,chamber:engChamber};
const ENG_KINDS=Object.keys(ENG);
/* снимок по ключу: kind определяет сюжет, seed — вариацию */
function engrave(kind,seed,o){
  const f=ENG[kind]||ENG.palace, n=++ART_N; o=o||{};
  const svg=f(artRand(kind+':'+seed),n,o);
  return o.par?svg.replace('preserveAspectRatio="xMidYMid slice"','preserveAspectRatio="'+o.par+'"'):svg;
}
/* карточка-фото: белая кайма, подпись, лёгкий наклон для коллажа */
function photo(kind,seed,cap,o){
  o=o||{};
  return `<figure class="photo ${o.cls||''}" ${o.tilt?`style="--tilt:${o.tilt}deg"`:''}>${engrave(kind,seed,o)}${cap?`<figcaption>${cap}</figcaption>`:''}</figure>`;
}

/* ─── портрет: голова и плечи из имени ─────────────────────────────
   Лицо собирается из ключа: пол по имени, возраст от o.age, причёска,
   очки, усы и борода — по случайному ряду. Общие градиенты и зерно
   лежат в одном скрытом SVG (artDefs), чтобы список из тридцати лиц
   не тащил тридцать наборов фильтров. */
function artDefs(){
  return `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
    <radialGradient id="pvg" cx=".5" cy=".45" r=".75"><stop offset=".5" stop-color="#1f150a" stop-opacity="0"/><stop offset="1" stop-color="#1f150a" stop-opacity=".66"/></radialGradient>
    <radialGradient id="pfc" cx=".4" cy=".35" r=".8"><stop offset="0" stop-color="#fff4d6" stop-opacity=".5"/><stop offset=".6" stop-color="#fff4d6" stop-opacity="0"/><stop offset="1" stop-color="#2a1b08" stop-opacity=".38"/></radialGradient>
    <filter id="pgr" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".95" numOctaves="2" seed="5"/><feColorMatrix values="0 0 0 0 .13 0 0 0 0 .09 0 0 0 0 .04 0 0 0 .5 -.14"/></filter>
  </defs></svg>`;
}
function artFem(name){
  const f=String(name||'').split(' ')[0];
  if(typeof NAME_F!=='undefined'&&NAME_F.indexOf(f)>=0)return true;
  if(typeof NAME_M!=='undefined'&&NAME_M.indexOf(f)>=0)return false;
  return /[ая]$/.test(f)&&!/(Никита|Илья|Кузьма|Фома|Лука)$/.test(f);
}
function portrait(name,o){
  o=o||{}; const r=artRand('pt:'+name), fem=o.fem!==undefined?o.fem:artFem(name);
  const age=o.age||(38+Math.floor(r()*30)), old=age>=58, mid=age>=46;
  const skin=['#cdb48a','#c6ab7e','#d4bf98','#bfa476'][Math.floor(r()*4)];
  const skin2=skin.replace(/[0-9a-f]{2}/gi,h=>Math.max(0,parseInt(h,16)-42).toString(16).padStart(2,'0'));
  const hairs=old?['#8f8a7c','#b3ad9d','#6d675a']:mid?['#3b2c18','#5a4528','#7d776a']:['#1d140a','#33240f','#4a3720'];
  const hair=hairs[Math.floor(r()*hairs.length)], bg=['#8a7550','#6e5c3c','#9a8660','#5d4e34'][Math.floor(r()*4)];
  const jacket=['#2a2118','#3b3225','#1f1a14','#4a4136'][Math.floor(r()*4)];
  const rx=17.5+r()*3.5, ry=23+r()*2.5, hy=51;
  let s=`<rect width="100" height="120" fill="${bg}"/><rect width="100" height="120" fill="url(#pvg)" opacity=".55"/>`;
  // волосы за головой (длинные у женщин)
  const style=fem?['bob','bun','long','wave'][Math.floor(r()*4)]:['side','short','bald','crop','curl'][Math.floor(r()*5)];
  if(fem&&(style==='long'||style==='wave'))s+=`<path d="M26 56Q24 22 50 20Q76 22 74 56L78 100H22z" fill="${hair}"/>`;
  // плечи и костюм
  s+=`<path d="M4 120Q6 94 33 87L50 98 67 87Q94 94 96 120z" fill="${jacket}"/>`;
  s+=fem?`<path d="M36 88Q50 108 64 88L58 86Q50 96 42 86z" fill="${['#cfc3a6','#b79d73','#8b3a2f'][Math.floor(r()*3)]}"/>`
        :`<path d="M38 87L50 108 62 87 56 85 50 91 44 85z" fill="#e4d8b8"/><path d="M50 95l-3.4 4.6L50 116l3.4-16.4z" fill="${['#3b1c14','#1d2a3a','#4b3b14'][Math.floor(r()*3)]}"/>`;
  s+=`<path d="M33 87L45 120M67 87L55 120" stroke="#0e0904" stroke-width=".8" opacity=".6"/>`;
  if(fem&&r()<.6)s+=`<circle cx="${r()<.5?38:62}" cy="98" r="2.1" fill="#d8c48a" stroke="#6b5426" stroke-width=".5"/>`;
  // шея и голова
  s+=`<path d="M42 70h16v20Q50 96 42 90z" fill="${skin2}"/>`;
  s+=`<ellipse cx="${50-rx}" cy="${hy+3}" rx="3.4" ry="5" fill="${skin}"/><ellipse cx="${50+rx}" cy="${hy+3}" rx="3.4" ry="5" fill="${skin2}"/>`;
  s+=`<ellipse cx="50" cy="${hy}" rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}" fill="${skin}"/><ellipse cx="50" cy="${hy}" rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}" fill="url(#pfc)"/>`;
  // причёска
  const top=hy-ry;
  if(!fem){
    if(style==='side')s+=`<path d="M${50-rx-1} ${hy-6}Q${50-rx} ${top-2} 50 ${top-3}Q${50+rx} ${top-2} ${50+rx+1} ${hy-6}Q${50+rx-3} ${top+8} 50 ${top+6}Q${50-rx+4} ${top+4} ${50-rx-1} ${hy-6}z" fill="${hair}"/><path d="M${50-rx+3} ${top+8}Q42 ${top+3} 58 ${top+7}" stroke="${skin}" stroke-width=".8" fill="none" opacity=".7"/>`;
    if(style==='short'||style==='crop')s+=`<path d="M${50-rx-1} ${hy-4}Q${50-rx-1} ${top-2} 50 ${top-3}Q${50+rx+1} ${top-2} ${50+rx+1} ${hy-4}Q${50+rx-2} ${top+9} 50 ${top+9}Q${50-rx+2} ${top+9} ${50-rx-1} ${hy-4}z" fill="${hair}"/>`;
    if(style==='curl'){ for(let i=0;i<9;i++){ const a=Math.PI*(1.05+i*.113); s+=`<circle cx="${(50+Math.cos(a)*(rx+1.2)).toFixed(1)}" cy="${(hy-4+Math.sin(a)*(ry+1)).toFixed(1)}" r="4.4" fill="${hair}"/>`; } }
    if(style==='bald')s+=`<path d="M${50-rx-.5} ${hy-2}Q${50-rx-2} ${hy-14} ${50-rx+4} ${hy-18}Q${50-rx+1} ${hy-10} ${50-rx+3} ${hy}z" fill="${hair}"/><path d="M${50+rx+.5} ${hy-2}Q${50+rx+2} ${hy-14} ${50+rx-4} ${hy-18}Q${50+rx-1} ${hy-10} ${50+rx-3} ${hy}z" fill="${hair}"/>`;
  } else {
    if(style==='bob'||style==='long'||style==='wave')s+=`<path d="M${50-rx-3} ${hy+10}Q${50-rx-6} ${top-4} 50 ${top-4}Q${50+rx+6} ${top-4} ${50+rx+3} ${hy+10}Q${50+rx+1} ${top+10} 50 ${top+8}Q${50-rx-1} ${top+10} ${50-rx-3} ${hy+10}z" fill="${hair}"/>`;
    if(style==='bob')s+=`<path d="M${50-rx-3} ${hy+10}Q${50-rx-4} ${hy+22} ${50-rx+2} ${hy+24}L${50-rx+3} ${hy+6}z M${50+rx+3} ${hy+10}Q${50+rx+4} ${hy+22} ${50+rx-2} ${hy+24}L${50+rx-3} ${hy+6}z" fill="${hair}"/>`;
    if(style==='bun')s+=`<path d="M${50-rx-1} ${hy-4}Q${50-rx-1} ${top-2} 50 ${top-3}Q${50+rx+1} ${top-2} ${50+rx+1} ${hy-4}Q${50+rx-2} ${top+9} 50 ${top+8}Q${50-rx+2} ${top+9} ${50-rx-1} ${hy-4}z" fill="${hair}"/><circle cx="50" cy="${top-6}" r="7" fill="${hair}"/>`;
  }
  // лицо: брови, глаза, нос, рот
  const ey=hy-4, ex=7.2+r()*1.2, bw=1+(fem?0:.7);
  s+=`<path d="M${50-ex-5} ${ey-5.4}Q${50-ex} ${ey-7.4} ${50-ex+5} ${ey-5.2}" stroke="${old&&!fem?'#8c8678':hair}" stroke-width="${bw}" fill="none" stroke-linecap="round"/><path d="M${50+ex-5} ${ey-5.2}Q${50+ex} ${ey-7.4} ${50+ex+5} ${ey-5.4}" stroke="${old&&!fem?'#8c8678':hair}" stroke-width="${bw}" fill="none" stroke-linecap="round"/>`;
  [-1,1].forEach(d=>{ const cx=50+d*ex; s+=`<ellipse cx="${cx}" cy="${ey}" rx="3.5" ry="1.9" fill="#f0e6cc"/><circle cx="${cx+d*.3}" cy="${ey}" r="1.5" fill="#1d140a"/><path d="M${cx-3.8} ${ey-.3}Q${cx} ${ey-3} ${cx+3.8} ${ey-.3}" stroke="#2a1d0e" stroke-width=".7" fill="none"/>`; });
  if(old)s+=`<path d="M${50-ex-6} ${ey+3}q2 1.5 4 .6M${50+ex+2} ${ey+3.6}q2 .9 4-.6M${50-9} ${hy-17}h18" stroke="#6b5426" stroke-width=".5" fill="none" opacity=".55"/>`;
  s+=`<path d="M50 ${ey+2}Q47.4 ${ey+10} 46.4 ${ey+11.5}Q50 ${ey+13.6} 53.6 ${ey+11.5}" stroke="#5b4420" stroke-width=".8" fill="none" opacity=".8"/>`;
  const my=hy+13;
  s+=`<path d="M${50-5} ${my}Q50 ${my+(fem?2.4:1.4)} ${50+5} ${my}" stroke="${fem?'#6b2d22':'#3d2415'}" stroke-width="${fem?1.5:1.1}" fill="none" stroke-linecap="round"/>`;
  // усы, борода, очки
  if(!fem&&r()<.34)s+=`<path d="M${50-6.5} ${my-3}Q50 ${my-6} ${50+6.5} ${my-3}Q50 ${my-1.2} ${50-6.5} ${my-3}z" fill="${hair}"/>`;
  if(!fem&&r()<.18)s+=`<path d="M${50-rx+1} ${hy+8}Q${50-rx} ${hy+ry} 50 ${hy+ry+3}Q${50+rx} ${hy+ry} ${50+rx-1} ${hy+8}Q50 ${hy+16} ${50-rx+1} ${hy+8}z" fill="${hair}" opacity=".92"/>`;
  const gl=r();
  if(gl<.38)s+=`<g fill="none" stroke="#1d140a" stroke-width="1"><${gl<.2?'circle':'rect'} ${gl<.2?`cx="${50-ex}" cy="${ey}" r="6.4"`:`x="${50-ex-6.4}" y="${ey-4.6}" width="12.8" height="9.2" rx="2"`}/><${gl<.2?'circle':'rect'} ${gl<.2?`cx="${50+ex}" cy="${ey}" r="6.4"`:`x="${50+ex-6.4}" y="${ey-4.6}" width="12.8" height="9.2" rx="2"`}/><path d="M${50-ex+6.4} ${ey-1}H${50+ex-6.4}M${50-ex-6.4} ${ey-1}L${50-rx-1} ${ey-2}M${50+ex+6.4} ${ey-1}L${50+rx+1} ${ey-2}"/></g><g fill="#f6eed2" opacity=".14"><ellipse cx="${50-ex}" cy="${ey}" rx="5.6" ry="4.2"/><ellipse cx="${50+ex}" cy="${ey}" rx="5.6" ry="4.2"/></g>`;
  // снимок: зерно и виньетка
  s+=`<rect width="100" height="120" filter="url(#pgr)"/><rect width="100" height="120" fill="url(#pvg)"/>`;
  return `<svg class="pt" viewBox="0 0 100 120" preserveAspectRatio="xMidYMid slice" role="img" aria-label="${String(name||'').replace(/"/g,'')}">${s}</svg>`;
}
/* лицо в рамке для списка: s — ширина в пикселях */
function face(name,s,o){
  s=s||36; return `<span class="face" style="width:${s}px;height:${Math.round(s*1.2)}px">${portrait(name,o)}</span>`;
}

/* карточка человека: портрет в рамке, должность, имя, строка под ним, при желании — цитата */
function pcard(name,role,sub,o){
  o=o||{};
  return `<div class="pcard${o.big?' big':''}"><div class="pc-face">${portrait(name,{age:o.age,fem:o.fem})}</div>
    <div class="pc-b"><i>${role}</i><b>${name}</b>${sub?`<span>${sub}</span>`:''}${o.quote?`<q>${o.quote}</q>`:''}</div></div>`;
}
/* общие градиенты и зерно портретов лежат в документе один раз */
if(typeof document!=='undefined'&&!document.getElementById('artdefs')){
  const d=document.createElement('div'); d.id='artdefs'; d.innerHTML=artDefs(); document.body.insertBefore(d,document.body.firstChild);
}
