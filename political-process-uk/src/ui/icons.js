/*
 * Набор иконок: один стиль, одна толщина линии, никакой зависимости от
 * того, как эмодзи выглядят в конкретной системе.
 */
(function (root) {
  'use strict';

  var P = {
    chart: '<path d="M3 20h18M6 20v-7M11 20V6M16 20v-9M21 20v-4"/>',
    target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.6"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
    map: '<path d="M9 4 3 6.5v13L9 17l6 3 6-2.5v-13L15 7 9 4Z"/><path d="M9 4v13M15 7v13"/>',
    chamber: '<path d="M3 20h18M4 20V10M9 20V10M15 20V10M20 20V10M2.5 10h19L12 4 2.5 10Z"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
    scroll: '<path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4M9 12h7M9 16h7M9 8h3"/>',
    hat: '<path d="M8 12V4h8v8"/><path d="M3.5 12.5h17c.6 0 1 .5 1 1.2v1.6c0 .7-.4 1.2-1 1.2h-17c-.6 0-1-.5-1-1.2v-1.6c0-.7.4-1.2 1-1.2Z"/>',
    news: '<path d="M3 5h14v14a2 2 0 0 0 2 2H5a2 2 0 0 1-2-2z"/><path d="M17 9h4v10a2 2 0 0 1-2 2"/><path d="M6 8h8M6 12h8M6 16h5"/>',
    save: '<path d="M4 4h12l4 4v12H4z"/><path d="M8 4v6h8V5.5M8 20v-6h8v6"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.2a2.6 2.6 0 1 1 3.4 2.5c-.7.3-1 .9-1 1.6v.4"/><path d="M12 17.4h.01"/>',
    arrow: '<path d="M4 12h15M13 6l6 6-6 6"/>',
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3M9 21h6"/>',
    door: '<path d="M6 3h9v18H6z"/><path d="M4 21h16M12.5 12h.01"/>',
    tv: '<rect x="3" y="8" width="18" height="12" rx="2"/><path d="M8 4l4 4 4-4"/>',
    broadcast: '<circle cx="12" cy="12" r="2.5"/><path d="M7.5 7.5a6.4 6.4 0 0 0 0 9M16.5 7.5a6.4 6.4 0 0 1 0 9M4.5 4.5a10.6 10.6 0 0 0 0 15M19.5 4.5a10.6 10.6 0 0 1 0 15"/>',
    pound: '<circle cx="12" cy="12" r="9"/><path d="M14.6 8.2a2.9 2.9 0 0 0-5 2v6.2M8.4 12.6h4.2M8.4 16.4h6.6"/>',
    sword: '<path d="M14.5 3.5 20 3l-.5 5.5-8 8"/><path d="m6 14 4 4M4.5 16.5 7.5 19.5M3 21l3-1.5"/>',
    users: '<circle cx="9" cy="8" r="3.2"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0"/><circle cx="17" cy="9" r="2.4"/><path d="M14.6 15.2A4.6 4.6 0 0 1 21 19"/>',
    handshake: '<path d="m3 12 3.5-3.5 4 1.5 3-1.5L21 12"/><path d="m7 13.5 3 3 2-1.5 2.5 2 2-1.5"/><path d="M3 12v3l3 3M21 12v3l-3 3"/>',
    megaphone: '<path d="M4 10v4l11 5V5L4 10Z"/><path d="M15 8.5a3.5 3.5 0 0 1 0 7M6.5 15v4h3"/>',
    cap: '<path d="M12 4 2 9l10 5 10-5-10-5Z"/><path d="M6 11.5V17c0 1.7 2.7 3 6 3s6-1.3 6-3v-5.5"/>',
    hammer: '<path d="M13.5 3.5 20 10l-2.5 2.5L11 6z"/><path d="M11.5 8.5 4 16v4h4l7.5-7.5"/>',
    wheat: '<path d="M12 21V9"/><path d="M12 9c0-2 1.5-3.5 3.5-4 0 2-1.5 3.5-3.5 4Zm0 0c0-2-1.5-3.5-3.5-4 0 2 1.5 3.5 3.5 4Z"/><path d="M12 14c0-2 1.5-3.5 3.5-4 0 2-1.5 3.5-3.5 4Zm0 0c0-2-1.5-3.5-3.5-4 0 2 1.5 3.5 3.5 4Z"/>',
    leaf: '<path d="M20 4c0 9-5.5 13-11 13a5 5 0 0 1-5-5C4 7.5 11 4 20 4Z"/><path d="M4 20c3-6 7-9 12-11"/>',
    flag: '<path d="M6 21V4"/><path d="M6 5h11l-2 3.5L17 12H6"/>',
    scales: '<path d="M12 4v16M7 20h10M5 8h14M5 8 2.5 14h5L5 8Zm14 0-2.5 6h5L19 8Z"/>',
    clipboard: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V2.8h6V4"/><path d="M8.5 10h7M8.5 14h7M8.5 18h4"/>',
    briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5h6v2M3 12h18"/>',
    link: '<path d="M10 13.5a4 4 0 0 0 5.6 0l2.6-2.6a4 4 0 1 0-5.6-5.6L11.4 6.4"/><path d="M14 10.5a4 4 0 0 0-5.6 0l-2.6 2.6a4 4 0 1 0 5.6 5.6l1.2-1.1"/>',
    moon: '<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.2 5.2l1.6 1.6M17.2 17.2l1.6 1.6M18.8 5.2l-1.6 1.6M6.8 17.2l-1.6 1.6"/>',
    check: '<path d="m4.5 12.5 5 5 10-11"/>',
    close: '<path d="m5.5 5.5 13 13M18.5 5.5l-13 13"/>',
    vote: '<path d="M4 13.5 12 17l8-3.5"/><path d="M4 13.5V19l8 3 8-3v-5.5"/><path d="M8 10V4h8v6"/><path d="M10 7h4"/>',
    masks: '<path d="M4 5h7v6a3.5 3.5 0 0 1-7 0z"/><path d="M13 8h7v6a3.5 3.5 0 0 1-7 0z"/><path d="M6 8h.01M9 8h.01M15 11h.01M18 11h.01"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5.2l3.2 2"/>',
    fire: '<path d="M12 3c3.5 3.5 6 6.2 6 9.6A6 6 0 0 1 6 12.6C6 9.2 8.5 6.5 12 3Z"/><path d="M12 20a2.6 2.6 0 0 1-2.6-2.6c0-1.5 1.1-2.4 2.6-4 1.5 1.6 2.6 2.5 2.6 4A2.6 2.6 0 0 1 12 20Z"/>'
  };

  function get(name, size) {
    var body = P[name] || P.help;
    var s = size || 18;
    return '<svg class="icon" width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" ' +
      'stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      body + '</svg>';
  }

  /* ---- Цветовые утилиты, зависящие от темы ---- */

  function currentTheme() {
    var d = root.document;
    return (d && d.documentElement.getAttribute('data-theme')) === 'light' ? 'light' : 'dark';
  }

  function toRgb(hex) {
    var h = String(hex).replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }

  function luminance(hex) {
    var c = toRgb(hex);
    return (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255;
  }

  /* Цвет партии как цвет текста: на светлой теме бледные цвета темнеют. */
  function ink(hex) {
    if (currentTheme() !== 'light') return hex;
    var l = luminance(hex);
    if (l < 0.55) return hex;
    var k = l > 0.75 ? 0.55 : 0.38;
    var c = toRgb(hex).map(function (v) { return Math.round(v * (1 - k)); });
    return 'rgb(' + c.join(',') + ')';
  }

  /* Фон, к которому подмешиваются заливки карты. */
  function surfaceRgb() {
    return currentTheme() === 'light' ? [233, 227, 212] : [22, 30, 42];
  }

  root.PP = root.PP || {};
  root.PP.Theme = { current: currentTheme, ink: ink, luminance: luminance, surfaceRgb: surfaceRgb, toRgb: toRgb };
  root.PP.Icons = {
    get: get,
    ACTION: {
      rally: 'mic', ground: 'door', target: 'target', broadcast: 'tv', media: 'broadcast',
      fundraise: 'pound', policy: 'scroll', attack: 'sword', organise: 'users', unify: 'handshake'
    },
    ROLE: { leader: 'hat', chief: 'clipboard', treasurer: 'briefcase', whip: 'link', spin: 'news' },
    ARCHETYPE: { populist: 'megaphone', liberal: 'cap', labourist: 'hammer', shire: 'wheat', green: 'leaf', national: 'flag' },
    RESOURCE: { grassroots: 'door', balanced: 'scales', donors: 'pound' }
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
