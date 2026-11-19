// Tiny DOM helpers + inline icons (lucide-style strokes).

export function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'html') el.innerHTML = v;
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  for (const c of kids.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

// Hand-drawn two-tone icon set (24×24). Classes: fo = filled shape with ink outline, f2 = secondary fill,
// f3 = solid ink, o = ink line, w = heavy line. Colours come from CSS (--ic-f, --ic-f2, --ic-o).
const TARGET = '<circle class="fo" cx="12" cy="12" r="8.6"/><circle class="fo f2" cx="12" cy="12" r="5.2"/><circle class="fo" cx="12" cy="12" r="1.9"/><path class="o" d="M12 1.4v3M12 19.6v3M1.4 12h3M19.6 12h3"/>';
const ROT = '<path class="o w" d="M19 12a7 7 0 1 1-2.05-4.95"/><path class="fo" d="M19.4 9.2 18.6 3.9 13.9 8.3z"/>';
const P = {
  map: '<path class="fo f2" d="M2.6 6.2 8.4 3.8l7.2 2.4 5.8-2.4v14l-5.8 2.4-7.2-2.4-5.8 2.4z"/><path class="fo" d="M8.4 3.8v14l7.2 2.4v-14z"/><path class="o" d="M4.6 14.2c1.4-1 2.6-.8 3.8-.2M16.6 9.4c1.2-.6 2.4-.4 3 .2"/><circle class="f3" cx="12" cy="10.4" r="1.4"/>',
  album: '<path class="fo f2" d="M3.4 4.2h7.4c.8 0 1.2.4 1.2 1.2v15c0-.8-.4-1.2-1.2-1.2H3.4z"/><path class="fo f2" d="M20.6 4.2h-7.4c-.8 0-1.2.4-1.2 1.2v15c0-.8.4-1.2 1.2-1.2h7.4z"/><circle class="fo" cx="7.2" cy="9.6" r="2.4"/><path class="fo" d="m16.8 7.6 1 2 2.2.3-1.6 1.5.4 2.2-2-1-2 1 .4-2.2-1.6-1.5 2.2-.3z"/><path class="o" d="M5 15.2h4.6M14.4 16.2h4"/>',
  home: '<path class="fo f2" d="M10 9.6h4v10.6h-4z"/><path class="fo" d="M5.3 4.6h13.4l-1.9 5.2H7.2z"/><path class="fo f2" d="M7.7 4.6l1-2.1h6.6l1 2.1z"/><path class="o" d="M9.6 6.3v1.8M12 6.3v1.8M14.4 6.3v1.8M3.8 20.7h16.4"/>',
  play: TARGET, target: TARGET,
  trophy: '<path class="fo f2" d="M2.4 7.6c2.7-.8 4.6-.2 5.8 1.3-2 .2-3.5 1-4.4 2.3-.1-1.5-.6-2.6-1.4-3.6zM21.6 7.6c-2.7-.8-4.6-.2-5.8 1.3 2 .2 3.5 1 4.4 2.3.1-1.5.6-2.6 1.4-3.6z"/><path class="fo" d="M7.4 3.3h9.2v4.4a4.6 4.6 0 0 1-9.2 0z"/><path class="o w" d="M12 12.4v3.4"/><path class="fo f2" d="M8.4 20.7l1-4.7h5.2l1 4.7z"/><path class="o" d="M10.2 5.4h3.6"/>',
  shirt: '<path class="fo" d="M2.8 20.6V12C2.8 7.2 6.9 4 12 4s9.2 3.2 9.2 8v8.6z"/><path class="fo f2" d="M7.4 20.6v-7h9.2v7z"/><path class="o" d="M10.5 13.6v7M13.5 13.6v7M1.4 20.6h21.2M6.8 8.4c1.5-1 3.2-1.5 5.2-1.5s3.7.5 5.2 1.5"/>',
  user: '<path class="fo" d="M4 15.6C4 9 7.6 4.2 12.6 4.2c4.6 0 7.4 3.4 7.4 7.8v6.1H12c-2.6 0-4.4 1-5.4 2.5H4z"/><path class="fo f2" d="M10.4 9.3H20v3.9h-7.7a1.9 1.9 0 0 1-1.9-1.9z"/><path class="o" d="M7.6 6.3C6.4 8.3 5.9 10.7 6.1 13.4"/><circle class="fo f2" cx="8.6" cy="15.6" r="1.4"/>',
  plane: '<path class="fo" d="M12 1.7c.9.8 1.3 2.4 1.3 4.2v4.7l8.2 4.3v2.3l-8.2-2.2v4l2.4 1.7v1.6L12 21.4l-3.7.9v-1.6l2.4-1.7v-4l-8.2 2.2v-2.3l8.2-4.3V5.9c0-1.8.4-3.4 1.3-4.2z"/><path class="fo f2" d="M11.1 5.2h1.8v3.4h-1.8z"/>',
  pause: '<rect class="fo" x="5.4" y="3.8" width="4.6" height="16.4" rx="1.3"/><rect class="fo" x="14" y="3.8" width="4.6" height="16.4" rx="1.3"/>',
  retry: ROT,
  rotR: ROT,
  rotL: '<g transform="matrix(-1 0 0 1 24 0)">' + ROT + '</g>',
  close: '<path class="o w" d="M6 6l12 12M18 6 6 18"/>',
  left: '<path class="o w" d="M15 4.5 7.5 12l7.5 7.5"/>',
  back: '<path class="o w" d="M15 4.5 7.5 12l7.5 7.5"/>',
  right: '<path class="o w" d="M9 4.5l7.5 7.5L9 19.5"/>',
  check: '<path class="o w" d="M4.5 12.6l4.7 4.7L19.6 6.9"/>',
  lock: '<path class="o w" d="M8 11V8.3a4 4 0 0 1 8 0V11"/><rect class="fo" x="4.5" y="10.4" width="15" height="10.8" rx="2.3"/><circle class="f3" cx="12" cy="14.7" r="1.5"/><path class="o w" d="M12 15v2.3"/>',
  star: '<path class="fo" d="M12 2.5l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 16.9l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z"/>',
  medal: '<path class="fo f2" d="M6.6 2.4h4.2l2.2 6.3H8.8zM17.4 2.4h-4.2L11 8.7h4.2z"/><circle class="fo" cx="12" cy="15.2" r="6.1"/><path class="fo f2" d="M12 11.7l1.1 2.3 2.4.3-1.8 1.7.5 2.4-2.2-1.2-2.2 1.2.5-2.4-1.8-1.7 2.4-.3z"/>',
  crown: '<path class="fo" d="M3 7.5l4.5 4 4.5-6.5 4.5 6.5 4.5-4-1.8 11H4.8z"/><path class="o" d="M5 21h14"/>',
  gear: '<path class="fo" d="M12 2.4l1.7 2.3 2.7-.8.5 2.8 2.8.5-.8 2.7 2.3 1.7-2.3 1.7.8 2.7-2.8.5-.5 2.8-2.7-.8L12 21.6l-1.7-2.3-2.7.8-.5-2.8-2.8-.5.8-2.7L2.8 12l2.3-1.7-.8-2.7 2.8-.5.5-2.8 2.7.8z"/><circle class="fo f2" cx="12" cy="12" r="3.3"/>',
  sliders: '<path class="o w" d="M4 6h16M4 12h16M4 18h16"/><circle class="fo" cx="9" cy="6" r="2.5"/><circle class="fo f2" cx="15.5" cy="12" r="2.5"/><circle class="fo" cx="7" cy="18" r="2.5"/>',
  exit: '<path class="fo f2" d="M3.8 3.4h9.4v17.2H3.8z"/><circle class="f3" cx="10.6" cy="12" r="1"/><path class="o w" d="M11.5 12h9.6M17.4 8.3l3.7 3.7-3.7 3.7"/>',
  grid: '<rect class="fo" x="3.2" y="3.2" width="7.6" height="7.6" rx="1.6"/><rect class="fo f2" x="13.2" y="3.2" width="7.6" height="7.6" rx="1.6"/><rect class="fo f2" x="3.2" y="13.2" width="7.6" height="7.6" rx="1.6"/><rect class="fo" x="13.2" y="13.2" width="7.6" height="7.6" rx="1.6"/>',
  hand: '<path class="f3" d="M1.2 17.4l8.6-3.9 1.3 2.8-8.6 3.9z"/><path class="fo" d="M9.2 12.5l8.2-7.2c1.1-.9 3-.3 3 1.3 0 .6-.3 1.1-.8 1.5l-7.7 7.1z"/><path class="fo" d="M11 14.4l8.9 1.7c1.5.3 1.6 2.5.1 2.8l-9.5-1.3z"/><circle class="fo f2" cx="10.9" cy="14.9" r="2.4"/>',
  grip: '<path class="f3" d="M1.2 17.4l8.6-3.9 1.3 2.8-8.6 3.9z"/><path class="fo" d="M9.2 12.5l8.2-7.2c1.1-.9 3-.3 3 1.3 0 .6-.3 1.1-.8 1.5l-7.7 7.1z"/><path class="fo" d="M11 14.4l8.9 1.7c1.5.3 1.6 2.5.1 2.8l-9.5-1.3z"/><circle class="fo f2" cx="10.9" cy="14.9" r="2.4"/>',
  vol: '<path class="fo" d="M3.4 8.9h3.7l5.1-4.1v14.4l-5.1-4.1H3.4z"/><path class="o w" d="M15.4 9a4.2 4.2 0 0 1 0 6M18.4 6.3a8 8 0 0 1 0 11.4"/>',
  flag: '<path class="fo" d="M12 2.8a6.1 6.1 0 0 1 3.7 11c-.8.6-1.1 1.3-1.1 2.3H9.4c0-1-.3-1.7-1.1-2.3A6.1 6.1 0 0 1 12 2.8z"/><path class="fo f2" d="M9.4 16.1h5.2v2.3a1.7 1.7 0 0 1-1.7 1.7h-1.8a1.7 1.7 0 0 1-1.7-1.7z"/><path class="o" d="M10.4 9.4l1.6 1.6 1.6-1.6"/>',
};
export function icon(name, cls = '') {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('aria-hidden', 'true');
  s.setAttribute('class', 'ic' + (cls ? ' ' + cls : ''));
  s.innerHTML = P[name] || '';
  return s;
}

export function toast(msg, { err = false, ms = 1800 } = {}) {
  const t = h('div', { class: 'toast' + (err ? ' err' : '') }, msg);
  document.body.append(t);
  setTimeout(() => { t.style.transition = 'opacity .3s'; t.style.opacity = '0'; setTimeout(() => t.remove(), 320); }, ms);
}

export function fmtTime(s) {
  s = Math.max(0, s || 0);
  const m = Math.floor(s / 60); const r = Math.floor(s % 60);
  return `${m}:${String(r).padStart(2, '0')}`;
}

/** Full-screen modal wrapper. Returns {root, panel, body, close}. */
export function modal({ title, iconName, cls = '', onClose, headExtra = null }) {
  const body = h('div', { class: 'ov-body' });
  const rawAppend = body.append.bind(body);
  body.append = (...kids) => rawAppend(...kids.flat(Infinity).filter((k) => k !== null && k !== undefined && k !== false));
  let closeFn;
  const closeBtn = h('button', { class: 'icon-btn', 'aria-label': 'Close', onclick: () => closeFn() }, icon('close'));
  const panel = h('div', { class: 'panel ' + cls },
    h('div', { class: 'ov-head' }, iconName ? h('span', { style: { color: 'var(--or)', display: 'grid' } }, icon(iconName)) : null, h('h2', {}, title), headExtra, closeBtn),
    body);
  const root = h('div', { class: 'overlay', onpointerdown: (e) => { if (e.target === root) closeFn(); } }, panel);
  const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); closeFn(); } };
  closeFn = () => { window.removeEventListener('keydown', onKey, true); root.remove(); onClose?.(); };
  window.addEventListener('keydown', onKey, true);
  document.body.append(root);
  return { root, panel, body, close: closeFn };
}

export function coinBadge() {
  const v = h('span', {});
  const el = h('span', { class: 'coin-badge', title: 'Coins' }, h('span', { class: 'coin' }, 'S'), v);
  return { el, set(n) { v.textContent = Number(n).toLocaleString(); } };
}
