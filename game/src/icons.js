};
/* ─── иконки разделов ────────────────────────────────────────────
   Сетка 24×24, обводка 1.7 без скруглений — та же геометрия, что
   у рамок и линеек интерфейса. Заливкой закрашена только точка «?». */
const ICON={
  brief:'<path d="M5 3h14v18H5z"/><path d="M8.5 8h7M8.5 12h7M8.5 16h4"/>',
  parl:'<path d="M3 19a9 9 0 0 1 18 0"/><path d="M3 19h18"/>'+
       '<circle cx="7.2" cy="16.2" r="1.25"/><circle cx="12" cy="13.4" r="1.25"/>'+
       '<circle cx="16.8" cy="16.2" r="1.25"/>',
  bill:'<path d="M6 3h9l3 3v15H6z"/><path d="M15 3v3h3"/><circle cx="12" cy="14.5" r="3"/>',
  self:'<circle cx="12" cy="8" r="3.4"/>'+
       '<path d="M4.6 20.4c0-4.1 3.3-6.6 7.4-6.6s7.4 2.5 7.4 6.6"/>'+
       '<path d="M3 3h3M3 3v3M21 3h-3M21 3v3"/>',
  pm:'<path d="M4 20.5h16"/><path d="M6 20.5V9.5h12v11"/>'+
     '<path d="M3.2 9.5 12 3.5l8.8 6"/><path d="M10 20.5v-5.5h4v5.5"/>',
  press:'<path d="M3 5h13v15H5.5A2.5 2.5 0 0 1 3 17.5z"/>'+
        '<path d="M16 9h5v8.5a2.5 2.5 0 0 1-2.5 2.5H16z"/>'+
        '<path d="M6 8.5h7M6 12h7M6 15.5h4"/>',
  court:'<path d="M12 3v18"/><path d="M6 21h12"/><path d="M4 8h16"/>'+
        '<path d="M4 8 1.8 14h4.4zM20 8l-2.2 6h4.4"/>',
  party:'<circle cx="7" cy="7.5" r="2.4"/><circle cx="17" cy="7.5" r="2.4"/>'+
        '<circle cx="12" cy="16" r="2.6"/>'+
        '<path d="M8.9 9.2 10.8 14M15.1 9.2 13.2 14M9.4 7.5h5.2"/>',
  world:'<circle cx="12" cy="12" r="8.6"/><path d="M3.4 12h17.2"/>'+
        '<path d="M12 3.4c2.6 2.6 2.6 14.6 0 17.2-2.6-2.6-2.6-14.6 0-17.2z"/>',
  senate:'<circle cx="12" cy="12" r="8.6"/><circle cx="12" cy="12" r="2.7"/>'+
         '<path d="M12 3.4v2.4M12 18.2v2.4M3.4 12h2.4M18.2 12h2.4"/>',
  pres:'<path d="M12 2.6 4 5.6v6c0 4.9 3.3 8.4 8 9.8 4.7-1.4 8-5 8-9.8v-6z"/>'+
       '<path d="M12 8.2v5.2M9.6 10.8h4.8"/>',
  budget:'<path d="M3 20h18"/><path d="M6.5 20v-7M11 20V6.5M15.5 20v-5M20 20V9.5"/>',
  gov:'<path d="M2.5 10 12 4l9.5 6"/><path d="M3 20h18"/><path d="M6 20v-9M10 20v-9M14 20v-9M18 20v-9"/>',
  country:'<path d="M4 6.5 9.5 4l5 2.5L20 4v13.5L14.5 20l-5-2.5L4 20z"/><path d="M9.5 4v13.5M14.5 6.5V20"/>',
  society:'<circle cx="8.5" cy="8.5" r="2.6"/><path d="M3 20c0-3.2 2.4-5.2 5.5-5.2s5.5 2 5.5 5.2"/>'+
          '<circle cx="17" cy="9.5" r="2"/><path d="M15.4 15.2c2.9-.5 5.6 1.2 5.6 4.8"/>',
  camp:'<path d="M4 9.5v5l10 4.5V5z"/><path d="M14.5 8.5a4 4 0 0 1 0 7"/><path d="M6.5 15.2V19h3"/>',
  arch:'<path d="M5 3v18"/><circle cx="5" cy="7" r="1.5"/><circle cx="5" cy="12.5" r="1.5"/>'+
       '<circle cx="5" cy="18" r="1.5"/><path d="M9.5 7H20M9.5 12.5h7.5M9.5 18H20"/>',
  help:'<path d="M4 4h16v16H4z"/><path d="M9.8 9.6a2.4 2.4 0 1 1 2.9 2.6v1.5"/>'+
       '<circle cx="12.7" cy="16.8" r=".95" fill="currentColor" stroke="none"/>',
  more:'<circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none"/>'+
       '<circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/>'+
       '<circle cx="19" cy="12" r="1.4" fill="currentColor" stroke="none"/>',
  clock:'<circle cx="12" cy="12" r="8.5"/><path d="M12 6.5V12l3.6 2.6"/>',
  const:'<path d="M6 3h9l3 3v15H6z"/><path d="M15 3v3h3"/>'+
        '<path d="M9 10.5h6M9 14h6M9 17.5h3.5"/><path d="M4 3v18"/>',
  hist:'<path d="M4 21V9l8-5.5L20 9v12"/><path d="M4 21h16"/>'+
       '<path d="M9 21v-6h6v6"/><path d="M8 12h8"/>',
  firms:'<path d="M3 21h18"/><path d="M4.5 21V7l7-3.5V21"/><path d="M11.5 10.5H20V21"/>'+
        '<path d="M7 10h1.5M7 13.5h1.5M7 17h1.5M14.5 14h1.5M14.5 17.5h1.5"/>',
  city:'<path d="M3 21h18"/><path d="M5 21V11h4.5v10"/><path d="M9.5 21V4.5h6V21"/><path d="M15.5 21v-8H19v8"/>'+
       '<path d="M12 8h1.5M12 11.5h1.5M12 15h1.5M6.8 14.5h1"/>',
  vp:'<path d="M12.2 4.2l7.6 7.6-3 3-7.6-7.6z"/><path d="M13 11l-7.5 7.5"/><path d="M3.5 21h9"/>',
  fac:'<path d="M3 19a9 9 0 0 1 18 0z"/><path d="M12 10v9M6.6 12.4 12 19M17.4 12.4 12 19"/>',
};
function icon(id,size){
  return `<svg class="ic" viewBox="0 0 24 24" width="${size||19}" height="${size||19}" fill="none"
    stroke="currentColor" stroke-width="1.7">${ICON[id]||''}</svg>`;
}
