// On-screen touch controls. Each writes into a shared `slot` object the session reads every frame.
import { h, icon } from './dom.js';

function track(el, onMove, onEnd) {
  let id = null;
  el.addEventListener('pointerdown', (e) => { id = e.pointerId; el.setPointerCapture(id); onMove(e, true); e.preventDefault(); });
  el.addEventListener('pointermove', (e) => { if (e.pointerId === id) onMove(e, false); });
  const end = (e) => { if (e.pointerId === id) { id = null; onEnd?.(e); } };
  el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
}

export function joystick(slot, { label = 'MOVE', tone = '' } = {}) {
  const knob = h('div', { class: 'knob' }, label);
  const el = h('div', { class: 'joy ' + tone }, knob);
  let touching = false;
  const set = (x, y) => { knob.style.transform = `translate(${x * 34}%, ${-y * 34}%)`; };
  track(el, (e) => {
    touching = true;
    const r = el.getBoundingClientRect(); const cx = r.left + r.width / 2, cy = r.top + r.height / 2, rad = r.width / 2;
    let x = (e.clientX - cx) / rad, y = -(e.clientY - cy) / rad; const m = Math.hypot(x, y); if (m > 1) { x /= m; y /= m; }
    const dz = 0.12, mm = Math.hypot(x, y); const k = mm < dz ? 0 : (mm - dz) / (1 - dz) / (mm || 1);
    slot.tmx = x * k; slot.tmy = y * k; set(x * 1.5, y * 1.5);
  }, () => { touching = false; slot.tmx = 0; slot.tmy = 0; set(0, 0); });
  return { el, sync(mx, my) { if (!touching) set((mx || 0) * 1.2, (my || 0) * 1.2); } };
}

export function depthSlider(slot) {
  const th = h('div', { class: 'th' }), fill = h('div', { class: 'fill' });
  const el = h('div', { class: 'vslider' }, h('div', { class: 'lab t' }, 'OUT'), fill, th, h('div', { class: 'lab b' }, 'IN'));
  let dragging = false;
  const show = (v) => { const r = el.clientHeight - 44; th.style.bottom = `${3 + v * r}px`; fill.style.height = `${Math.max(0, v * r)}px`; };
  track(el, (e) => {
    dragging = true;
    const r = el.getBoundingClientRect(); const v = 1 - Math.max(0, Math.min(1, (e.clientY - r.top - 22) / (r.height - 44)));
    slot.tdepth = 1 - v; show(v);
  }, () => { dragging = false; slot.tdepth = null; });
  // slider top = OUT (shallow), bottom = IN (deep)
  return { el, sync(depth01) { if (!dragging) show(1 - depth01); } };
}

export function rotButtons(slot) {
  const mk = (dir, name) => {
    const b = h('button', { class: 'rbtn', 'aria-label': dir > 0 ? 'Rotate clockwise' : 'Rotate counter-clockwise' }, icon(name));
    track(b, () => { slot.trot = dir; b.classList.add('on'); }, () => { slot.trot = 0; b.classList.remove('on'); });
    return b;
  };
  const el = h('div', {}, h('div', { class: 'rbtns' }, mk(1, 'rotR'), mk(-1, 'rotL')), h('div', { class: 'ctl-lab' }, 'ROTATE'));
  return { el };
}

export function rotSlider(slot, tone = '') {
  const th = h('div', { class: 'th' });
  const el = h('div', { class: 'hslider ' + tone }, h('div', { class: 'lab' }, 'ROTATE'), th);
  th.style.left = '50%';
  track(el, (e) => {
    const r = el.getBoundingClientRect(); const v = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width) * 2 - 1));
    slot.trot = Math.abs(v) < 0.12 ? 0 : v; th.style.left = `${(v + 1) * 50}%`;
  }, () => { slot.trot = 0; th.style.left = '50%'; });
  return { el };
}

export function actionButton(slot, { label = 'GRAB', tone = '', dot = false } = {}) {
  const lab = h('span', {}, label);
  const d = h('span', { class: 'dot', style: { display: dot ? '' : 'none' } });
  const el = h('button', { class: 'abtn ' + tone }, h('div', { style: { display: 'grid', justifyItems: 'center', gap: '2px' } }, icon('hand'), lab, d));
  el.querySelector('svg').style.cssText = 'width:20px;height:20px';
  track(el, () => { slot.tgrab = true; }, () => {});
  return { el, set(on, text) { el.classList.toggle('on', !!on); if (text) lab.textContent = text; }, active(a) { el.disabled = !a; d.style.display = a ? '' : 'none'; } };
}
