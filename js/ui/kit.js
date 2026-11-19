// Component kit for the cockpit design system. Every interactive piece gives haptic + sound feedback.
import { h, icon } from './dom.js';
import { playSound, haptic } from '../audio.js';
import { rankFor, totalXp } from '../progress.js';
import { store } from '../store.js';

const tap = (fn, { sound = 'click', vib = 6 } = {}) => (e) => { haptic(vib); if (sound) playSound(sound, { volume: 0.45 }); fn?.(e); };

/** Pressable button. kind: primary | glass | ghost | danger | '' ; size: sm | lg | xl */
export function btn(label, { kind = '', size = '', iconName = null, onClick, block = false, sound = 'click', disabled = false, title } = {}) {
  const b = h('button', { class: ['b', kind, size, block ? 'block' : '', !label ? 'icon' : ''].filter(Boolean).join(' '), disabled, title, 'aria-label': title || undefined, onclick: tap(onClick, { sound }) },
    kind === 'primary' ? h('span', { class: 'shine' }) : null, iconName ? icon(iconName) : null, label || null);
  return b;
}

/** Segmented control. options: [{value,label,disabled,iconName}] */
export function segmented(options, value, onChange, { block = false } = {}) {
  const el = h('div', { class: 'seg' + (block ? ' block' : ''), role: 'radiogroup' });
  const draw = (v) => {
    el.innerHTML = '';
    for (const o of options) {
      el.append(h('button', { class: o.value === v ? 'on' : '', role: 'radio', 'aria-checked': String(o.value === v), disabled: o.disabled, onclick: tap(() => { draw(o.value); onChange(o.value); }, { sound: 'swipe' }) }, o.iconName ? icon(o.iconName) : null, o.label));
    }
  };
  draw(value);
  return { el, set: draw };
}

export function chips(options, value, onChange) {
  const el = h('div', { class: 'chips' });
  const draw = (v) => { el.innerHTML = ''; for (const o of options) el.append(h('button', { class: 'chip2' + (o.value === v ? ' on' : ''), onclick: tap(() => { draw(o.value); onChange(o.value); }, { sound: 'swipe' }) }, o.label)); };
  draw(value); return { el, set: draw };
}

export function toggle(on, onChange, disabled = false) {
  const s = h('button', { class: 'switch' + (on ? ' on' : ''), role: 'switch', 'aria-checked': String(on), disabled });
  s.onclick = tap(() => { const v = !s.classList.contains('on'); s.classList.toggle('on', v); s.setAttribute('aria-checked', String(v)); onChange(v); }, { sound: 'click' });
  return s;
}

export function bar(pct, cls = '') { return h('div', { class: 'bar2 ' + cls }, h('i', { style: { width: Math.round(Math.max(0, Math.min(1, pct)) * 100) + '%' } })); }

export function pip(medal, { locked = false } = {}) {
  if (locked) return h('span', { class: 'pip lock' }, icon('lock'));
  // stars: bronze / silver / gold = 1 / 2 / 3 stars
  const n = { bronze: 1, silver: 2, gold: 3 }[medal] || 0;
  return h('span', { class: 'stars3', title: `${n} of 3 stars` }, [0, 1, 2].map((i) => h('i', { class: i < n ? 'on' : '' }, icon('star'))));
}

export function rankBadge({ lg = false } = {}) {
  const r = rankFor(totalXp());
  const el = h('div', { class: 'rank-badge' + (lg ? ' lg' : ''), style: { '--p': Math.round(r.pct * 100) }, title: `Rank ${r.level} · ${r.title}` }, h('span', {}, r.level));
  el.style.setProperty('--p', Math.round(r.pct * 100));
  return el;
}

/** Bottom sheet (centred dialog on large screens). Returns {body, close}. */
export function sheet(title, { onClose, dismissable = true, cls = '' } = {}) {
  const body = h('div', { class: 'sh-body' });
  let closed = false;
  const closeBtn = dismissable ? h('button', { class: 'b glass sm icon', 'aria-label': 'Close', onclick: () => close() }, icon('close')) : null;
  const sh = h('div', { class: 'sheet ' + cls, role: 'dialog', 'aria-modal': 'true' }, h('div', { class: 'grab' }), h('div', { class: 'sh-head' }, h('h3', {}, title), closeBtn), body);
  const wrap = h('div', { class: 'sheet-wrap overlay-like' }, sh);
  if (dismissable) wrap.addEventListener('pointerdown', (e) => { if (e.target === wrap) close(); });
  const onKey = (e) => { if (e.key === 'Escape' && dismissable) { e.stopPropagation(); close(); } };
  window.addEventListener('keydown', onKey, true);
  document.body.append(wrap);
  requestAnimationFrame(() => requestAnimationFrame(() => wrap.classList.add('open')));
  // swipe down to dismiss
  let y0 = null;
  sh.querySelector('.grab').addEventListener('pointerdown', (e) => { y0 = e.clientY; });
  window.addEventListener('pointerup', (e) => { if (y0 !== null && e.clientY - y0 > 60 && dismissable) close(); y0 = null; });
  const rawAppend = body.append.bind(body);
  body.append = (...k) => rawAppend(...k.flat(Infinity).filter((x) => x !== null && x !== undefined && x !== false));
  function close(silent = false) {
    if (closed) return; closed = true;
    window.removeEventListener('keydown', onKey, true);
    wrap.classList.remove('open');
    setTimeout(() => wrap.remove(), 300);
    if (!silent) onClose?.();
  }
  return { body, close, el: sh };
}

/** Coin + count, used in the top bar and debrief. */
export function wallet() {
  const v = h('span', {}, store.coins.toLocaleString());
  const el = h('div', { class: 'wallet', title: 'Coins' }, h('span', { class: 'coin' }, 'S'), v);
  return { el, set(n) { v.textContent = Number(n).toLocaleString(); }, bump() { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); } };
}
