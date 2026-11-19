// Unified input: drag-to-move (mouse / touch trackpad), hold-to-grip, height, gamepad, keyboard.
// Produces one input object per instrument each frame:
//   { abs?: Vector3, delta?: Vector3, mx, my, height, heightAbs, rot, grip: bool }
// Grip is a per-instrument state written only on press/release events, so an instrument that stops
// being "active" keeps whatever it is holding (two-instrument hand-offs with one pointer just work).
import { THREE } from './engine.js';
import { h, icon } from '../ui/dom.js';
import { haptic } from '../audio.js';

export class InputSystem {
  constructor({ host, layer, vp, drill, def, settings, isLeft }) {
    Object.assign(this, { host, layer, vp, drill, def, settings });
    this.n = drill.tools.length;
    this.split = def.layout === 'dual-plane' || def.layout === 'dual-sphere'; // both hands free: split-screen touch
    this.grip = new Array(this.n).fill(false);
    this.keys = new Set(); this.edges = new Set();
    this.slots = Array.from({ length: this.n }, () => ({ abs: null, delta: new THREE.Vector3(), height: 0, heightAbs: null, rot: 0 }));
    this.ksm = Array.from({ length: 3 }, () => ({ mx: 0, my: 0, h: 0, r: 0 }));
    this.fine = false; this.isLeft = isLeft; this.lastDevice = matchMedia('(pointer: coarse)').matches ? 'touch' : 'keys';
    this.ray = new THREE.Raycaster(); this.touches = new Map(); this.manual = null;
    this.bind();
    this.buildTouchUI();
  }
  // ---------------------------------------------------------------- which instrument the pointer drives
  activeIndex() {
    if (this.drill.activeIndex) return this.drill.activeIndex();
    if (this.drill.autoIndex) {
      const a = this.drill.autoIndex();
      if (a !== this._auto) { this._auto = a; this.manual = null; } // rules moved on: follow them again
      return this.manual ?? a;
    }
    return this.manual ?? 0;
  }
  swap() { if (this.n < 2) return; this.manual = (this.activeIndex() + 1) % this.n; haptic(8); }
  /** Tap to grip (click once to close, again to open) vs hold to grip. Settings → Grip. */
  tap() { return (this.settings.gripMode || 'tap') === 'tap'; }
  setGrip(i, v) { if (i < 0 || i >= this.n) return; this.grip[i] = v; }

  // ---------------------------------------------------------------- pointer → world
  planeHit(clientX, clientY, tool) {
    const r = this.host.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(ndc, this.vp.camera);
    const plane = tool.mode === 'plane' ? new THREE.Plane(new THREE.Vector3(0, 0, 1), -tool.plane.z) : new THREE.Plane(new THREE.Vector3(0, 1, 0), -tool.target.y);
    const hit = new THREE.Vector3();
    return this.ray.ray.intersectPlane(plane, hit) ? hit : null;
  }
  bind() {
    const c = this.host;
    this.on = [];
    const add = (el, ev, fn, opt) => { el.addEventListener(ev, fn, opt); this.on.push([el, ev, fn, opt]); };
    // mouse control is switched off for now: in a drill only keys, touch and gamepad steer the instruments
    add(c, 'pointermove', (e) => { if (e.pointerType !== 'mouse') this.touchMove(e); });
    add(c, 'pointerdown', (e) => { if (e.pointerType !== 'mouse') this.touchDown(e); });
    add(window, 'pointerup', (e) => { if (e.pointerType !== 'mouse') this.touchUp(e); });
    add(window, 'pointercancel', (e) => { if (e.pointerType !== 'mouse') this.touchUp(e); });
    add(c, 'contextmenu', (e) => e.preventDefault());
    // keyboard
    add(window, 'keydown', (e) => {
      if (e.target.closest?.('input')) return;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'AltLeft', 'AltRight', 'Tab'].includes(e.code)) e.preventDefault();
      if (e.code === 'Tab') { this.swap(); return; }
      if (!this.keys.has(e.code)) this.edges.add(e.code);
      this.keys.add(e.code); this.lastDevice = 'keys';
    });
    add(window, 'keyup', (e) => { this.keys.delete(e.code); this.upEdges = this.upEdges || new Set(); this.upEdges.add(e.code); });
    add(window, 'blur', () => this.keys.clear());
  }
  // ---------------------------------------------------------------- touch: trackpad (+ split screen for two hands)
  touchIndex(x) {
    if (!this.split) return this.activeIndex();
    const r = this.host.getBoundingClientRect();
    return x < r.left + r.width / 2 ? 0 : 1;
  }
  touchDown(e) {
    if (e.target !== this.host && !this.host.contains(e.target)) return;
    this.lastDevice = 'touch';
    const i = this.touchIndex(e.clientX), t = this.drill.tools[i]; if (!t) return;
    this.touches.set(e.pointerId, { i, x0: e.clientX, y0: e.clientY, t0: performance.now(), last: this.planeHit(e.clientX, e.clientY, t), lx: e.clientX, ly: e.clientY, moved: 0 });
  }
  touchMove(e) {
    const s = this.touches.get(e.pointerId); if (!s) return;
    const t = this.drill.tools[s.i]; if (!t || t.frozen) return;
    const hit = this.planeHit(e.clientX, e.clientY, t);
    const px = Math.hypot(e.clientX - s.lx, e.clientY - s.ly); s.moved += px; s.lx = e.clientX; s.ly = e.clientY;
    if (hit && s.last) {
      const d = hit.clone().sub(s.last);
      // precision curve: slow drags move less, quick swipes move 1:1
      const gain = Math.min(1, 0.45 + px / 30);
      this.slots[s.i].delta.addScaledVector(d, gain);
    }
    s.last = hit && this.planeHit(e.clientX, e.clientY, t);
  }
  touchUp(e) {
    const s = this.touches.get(e.pointerId); if (!s) return;
    this.touches.delete(e.pointerId);
    // split screen: a quick tap (no drag) toggles that hand's grip
    if (this.split && s.moved < 12 && performance.now() - s.t0 < 300) { this.setGrip(s.i, !this.grip[s.i]); haptic(10); }
  }
  // ---------------------------------------------------------------- on-screen touch controls
  buildTouchUI() {
    const L = this.layer; L.innerHTML = '';
    const lh = this.settings.leftHand;
    const side = (cls, ...els) => { const d = h('div', { class: 'ctl ' + cls }, ...els); L.append(d); return d; };
    const touchOnly = (el) => { el.classList.add('touch-only'); return el; };
    const heightSlider = (getIdx, tone = '') => {
      const th = h('div', { class: 'th' }), fill = h('div', { class: 'fill' });
      const el = h('div', { class: 'vslider ' + tone }, h('div', { class: 'lab t' }, 'UP'), fill, th, h('div', { class: 'lab b' }, 'DOWN'));
      let id = null;
      const set = (e) => { const r = el.getBoundingClientRect(); const v = 1 - Math.max(0, Math.min(1, (e.clientY - r.top - 22) / (r.height - 44))); this.slots[getIdx()].heightAbs = v; };
      el.addEventListener('pointerdown', (e) => { id = e.pointerId; el.setPointerCapture(id); set(e); e.stopPropagation(); });
      el.addEventListener('pointermove', (e) => { if (e.pointerId === id) set(e); });
      el.addEventListener('pointerup', (e) => { if (e.pointerId === id) { id = null; this.slots[getIdx()].heightAbs = null; } });
      return { el, sync: (v) => { if (id !== null) return; const r = el.clientHeight - 44; th.style.bottom = `${3 + v * r}px`; fill.style.height = `${v * r}px`; } };
    };
    const gripPad = (getIdx, tone = '') => {
      const lab = h('span', {}, 'GRIP');
      const el = h('button', { class: 'abtn grip ' + tone }, h('div', { style: { display: 'grid', justifyItems: 'center', gap: '2px' } }, icon('hand'), lab));
      el.querySelector('svg').style.cssText = 'width:24px;height:24px';
      el.addEventListener('pointerdown', (e) => { e.stopPropagation(); el.setPointerCapture(e.pointerId); const i = getIdx(); this.setGrip(i, this.tap() ? !this.grip[i] : true); haptic(10); });
      el.addEventListener('pointerup', () => { if (!this.tap()) this.setGrip(getIdx(), false); });
      el.addEventListener('pointercancel', () => { if (!this.tap()) this.setGrip(getIdx(), false); });
      return { el, set: (on) => { el.classList.toggle('on', on); lab.textContent = on ? 'HOLDING' : 'GRIP'; } };
    };
    const rotBtns = () => {
      const mk = (dir, name) => { const b = h('button', { class: 'rbtn' }, icon(name)); b.addEventListener('pointerdown', (e) => { e.stopPropagation(); b.setPointerCapture(e.pointerId); this.touchRot = dir; }); b.addEventListener('pointerup', () => { this.touchRot = 0; }); return b; };
      return h('div', {}, h('div', { class: 'rbtns' }, mk(1, 'rotR'), mk(-1, 'rotL')), h('div', { class: 'ctl-lab' }, 'TURN HOOK'));
    };
    this.ui = { sliders: [], grips: [] };
    if (this.split) {
      // each half of the screen is one hand: drag to move, tap to grip
      L.append(h('div', { class: 'split-hint touch-only' }, h('span', { class: 'cy' }, 'LEFT HAND · drag to move, tap to grip'), h('span', { class: 'am' }, 'RIGHT HAND · drag to move, tap to grip')));
      if (this.def.layout === 'dual-sphere') {
        const s0 = heightSlider(() => 0, 'cy'), s1 = heightSlider(() => 1, 'am');
        this.ui.sliders = [s0, s1]; side('l', s0.el); side('r', s1.el);
      }
    } else {
      const s = heightSlider(() => this.activeIndex());
      this.ui.sliders = [s];
      const right = this.def.id === 'triangle-transfer' ? rotBtns() : (() => { const g = gripPad(() => this.activeIndex()); this.ui.grips = [g]; return g.el; })();
      if (lh) { touchOnly(side('l', right)); side('r', s.el); } else { side('l', s.el); touchOnly(side('r', right)); }
    }
  }
  syncTouchUI() {
    if (!this.ui) return;
    const tools = this.drill.tools;
    if (this.split) this.ui.sliders.forEach((s, i) => s.sync(clearance01(tools[i])));
    else this.ui.sliders[0]?.sync(clearance01(tools[this.activeIndex()]));
    this.ui.grips.forEach((g) => g.set(this.grip[this.activeIndex()]));
  }

  // ---------------------------------------------------------------- per-frame read
  read(dt, bindings) {
    const out = [];
    const fine = this.fine || this.keys.has('ShiftLeft') && this.def.layout !== 'dual-sphere' ? 0.35 : 1;
    const has = (arr) => ((arr || []).some((c) => this.keys.has(c)) ? 1 : 0);
    const edge = (arr) => (arr || []).some((c) => this.edges.has(c));
    const up = (arr) => (arr || []).some((c) => this.upEdges?.has(c));
    const ramp = (cur, target) => cur + (target - cur) * Math.min(1, dt * (Math.abs(target) > Math.abs(cur) ? 7 : 16));
    const act = this.activeIndex();
    // gamepad
    const gp = [...(navigator.getGamepads?.() || [])].find(Boolean);
    let gpad = null;
    if (gp) {
      const dz = (v) => (Math.abs(v) < 0.15 ? 0 : v);
      gpad = { mx: dz(gp.axes[0]), my: -dz(gp.axes[1]), h: -dz(gp.axes[3] ?? 0), grip: (gp.buttons[7]?.value || 0) > 0.4 || gp.buttons[0]?.pressed, swap: gp.buttons[2]?.pressed, rot: (gp.buttons[5]?.pressed ? 1 : 0) - (gp.buttons[4]?.pressed ? 1 : 0) };
      if (gpad.grip !== this._gpGrip) { this.setGrip(act, gpad.grip); this._gpGrip = gpad.grip; }
      if (gpad.swap && !this._gpSwap) this.swap(); this._gpSwap = gpad.swap;
      if (gpad.mx || gpad.my || gpad.h || gpad.grip) this.lastDevice = 'gamepad';
    }
    for (let i = 0; i < this.n; i++) {
      // keyboard: binding i, or the single binding drives the active instrument
      const k = bindings.length === this.n ? bindings[i] : i === act ? bindings[0] : {};
      const m = this.ksm[i] || (this.ksm[i] = { mx: 0, my: 0, h: 0, r: 0 });
      m.mx = ramp(m.mx, has(k.right) - has(k.left)); m.my = ramp(m.my, has(k.up) - has(k.down));
      // keys: move on a sphere around the entry port; "in" (W / Up) pushes the shaft in, "out" (S / Down) pulls it out
      m.h = ramp(m.h, has(k.in) - has(k.out)); m.r = ramp(m.r, has(k.cw) - has(k.ccw));
      // keyboard grip: always a toggle — press once to close, again to open
      if (k.grab && edge(k.grab)) this.setGrip(i, !this.grip[i]);
      const s = this.slots[i];
      const g = i === act && gpad ? gpad : null;
      const inp = {
        orbit: (m.mx || m.my || g?.mx || g?.my) ? { x: (m.mx + (g?.mx || 0)) * fine, y: (m.my + (g?.my || 0)) * fine } : null,
        insert: (m.h + (g?.h || 0)) * fine,
        heightStep: s.height * fine, heightAbs: s.heightAbs,
        rot: (m.r + (g?.rot || 0) + (i === act ? this.touchRot || 0 : 0)) * fine + s.rot * 6,
        abs: s.abs, delta: s.delta.lengthSq() ? s.delta.clone().multiplyScalar(fine) : null,
        grip: this.grip[i],
      };
      s.abs = null; s.delta.set(0, 0, 0); s.height = 0; s.rot = 0;
      out.push(inp);
    }
    this.edges.clear(); this.upEdges?.clear();
    return out;
  }
  /** The drill dropped something on its own (hand-off, slip): clear that instrument's grip. */
  clearGrip(i) { this.grip[i] = false; }
  dispose() { for (const [el, ev, fn, opt] of this.on) el.removeEventListener(ev, fn, opt); }
}
function clearance01(t) {
  if (!t) return 0;
  const low = t.inst.lowOffset ? t.inst.lowOffset(t) : 0;
  return Math.max(0, Math.min(1, (t.target.y + low - t.floor(t.target.x, t.target.z)) / 2));
}
