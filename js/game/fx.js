// Game-feel effects: particles, surface rings and scuffs, floating labels, camera shake, grab reticles, squash.
import { THREE } from './engine.js';

const MAX = 600;
let dotTex = null;
function dot() {
  if (dotTex) return dotTex;
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,.85)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  dotTex = new THREE.CanvasTexture(c); return dotTex;
}
const ease = (k) => 1 - (1 - k) ** 3;

export class FX {
  constructor(vp, overlay) {
    this.vp = vp; this.overlay = overlay; this.scene = vp.scene;
    // particle pool
    const geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(MAX * 3); this.col = new Float32Array(MAX * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    this.pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.07, map: dot(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    this.pts.frustumCulled = false; this.scene.add(this.pts);
    this.p = Array.from({ length: MAX }, () => ({ life: 0, max: 1, v: new THREE.Vector3(), g: -9, drag: 0.98, c: new THREE.Color() }));
    this.next = 0;
    this.rings = []; this.marks = []; this.floats = []; this.squashes = [];
    this.shakeAmt = 0; this.camBase = vp.camera.position.clone(); this.push = 0; this.pushT = 0;
    this.reticles = [this.makeReticle(), this.makeReticle()];
  }
  setCameraBase() { this.camBase.copy(this.vp.camera.position); }

  // ---------------------------------------------------------------- particles
  emit(at, n, { speed = 2, spread = 1, up = 1.5, life = 0.6, colors = [0xffffff], gravity = -9, drag = 0.97 } = {}) {
    for (let i = 0; i < n; i++) {
      const k = this.next; this.next = (this.next + 1) % MAX;
      const p = this.p[k];
      p.life = p.max = life * (0.6 + Math.random() * 0.8);
      const a = Math.random() * Math.PI * 2, r = Math.random() * spread;
      p.v.set(Math.cos(a) * r, up * (0.4 + Math.random() * 0.8), Math.sin(a) * r).normalize().multiplyScalar(speed * (0.4 + Math.random() * 0.8));
      p.g = gravity; p.drag = drag;
      p.c.setHex(colors[(Math.random() * colors.length) | 0]);
      this.pos[k * 3] = at.x; this.pos[k * 3 + 1] = at.y; this.pos[k * 3 + 2] = at.z;
    }
  }
  sparks(at) { this.emit(at, 26, { speed: 3.2, spread: 1, up: 1.2, life: 0.35, colors: [0xffd39a, 0xff8a3c, 0xffffff], gravity: -14 }); }
  confetti(at) {
    this.emit(at, 70, { speed: 2.6, spread: 1, up: 2.4, life: 0.9, colors: [0xff7f27, 0xffd257, 0xffffff, 0x9dffb9], gravity: -6, drag: 0.96 });
    this.ring(at, 0x9dffb9, { r0: 0.15, r1: 1.0, life: 0.6 });
  }
  dust(at) { this.emit(at, 10, { speed: 0.6, spread: 1, up: 0.3, life: 0.5, colors: [0x8a8a8a, 0x6a6a6a], gravity: -1 }); }

  // ---------------------------------------------------------------- surface rings and scuffs
  ring(at, color, { r0 = 0.1, r1 = 0.6, life = 0.5, y = null } = {}) {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 48), new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false, toneMapped: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
    m.rotation.x = -Math.PI / 2; m.position.set(at.x, (y ?? at.y) + 0.01, at.z); m.renderOrder = 2;
    this.scene.add(m); this.rings.push({ m, t: 0, life, r0, r1 });
  }
  mark(at, surfaceY) {
    const m = new THREE.Mesh(new THREE.CircleGeometry(0.09, 20), new THREE.MeshBasicMaterial({ color: 0xff3b3b, transparent: true, opacity: 0.85, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -3 }));
    m.rotation.x = -Math.PI / 2; m.position.set(at.x, surfaceY + 0.006, at.z); m.renderOrder = 2;
    this.scene.add(m); this.marks.push({ m, t: 0 });
    this.ring({ x: at.x, y: surfaceY, z: at.z }, 0xff4646, { r0: 0.05, r1: 0.45, life: 0.45 });
    if (this.marks.length > 12) { const o = this.marks.shift(); this.scene.remove(o.m); o.m.geometry.dispose(); }
  }

  // ---------------------------------------------------------------- floating labels (DOM, projected)
  float(at, text, cls = 'good') {
    const el = document.createElement('div'); el.className = 'fx-float ' + cls; el.textContent = text;
    this.overlay.append(el); this.floats.push({ el, at: at.clone(), t: 0 });
  }

  // ---------------------------------------------------------------- camera
  shake(a = 0.08) { this.shakeAmt = Math.min(0.25, this.shakeAmt + a); }
  pushIn(amount = 0.12, dur = 1.4) { this.push = amount; this.pushT = dur; this.pushDur = dur; }

  // ---------------------------------------------------------------- squash and stretch
  squash(obj, k = 0.22) { if (!obj) return; const base = obj.userData.baseScale || (obj.userData.baseScale = obj.scale.clone()); this.squashes.push({ obj, base, t: 0, k }); }

  // ---------------------------------------------------------------- grab reticles
  makeReticle() {
    const g = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: 0x5dff9a, transparent: true, opacity: 0.9, depthTest: false, toneMapped: false });
    for (let i = 0; i < 4; i++) {
      const arc = new THREE.Mesh(new THREE.RingGeometry(0.15, 0.18, 16, 1, i * Math.PI / 2 + 0.25, Math.PI / 2 - 0.5), mat);
      g.add(arc);
    }
    // shape cue as well as colour: ✓ for a valid grab, ✕ for a wrong one
    const bar = (w, x, y, rot) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, 0.022), mat); m.position.set(x, y, 0); m.rotation.z = rot; return m; };
    const ok = new THREE.Group(); ok.add(bar(0.05, -0.022, -0.008, -Math.PI / 4), bar(0.09, 0.018, 0.008, Math.PI / 3.2));
    const bad = new THREE.Group(); bad.add(bar(0.1, 0, 0, Math.PI / 4), bar(0.1, 0, 0, -Math.PI / 4));
    g.add(ok, bad);
    g.renderOrder = 10; g.visible = false; this.scene.add(g);
    return { g, mat, s: 0, ok, bad };
  }
  /** hints: [{pos, ok, size}|null] per tool */
  setHints(hints, t) {
    this.reticles.forEach((r, i) => {
      const h = hints?.[i];
      r.s += ((h ? 1 : 0) - r.s) * 0.25;
      r.g.visible = r.s > 0.02;
      if (!h) { r.g.scale.setScalar(Math.max(0.001, r.s)); return; }
      r.g.position.copy(h.pos);
      r.g.quaternion.copy(this.vp.camera.quaternion);
      r.g.children.slice(0, 4).forEach((c) => { c.rotation.z = t * 2.2; });
      const pulse = 1 + Math.sin(t * 9) * 0.06;
      r.g.scale.setScalar((h.size || 1) * r.s * pulse);
      r.mat.color.setHex(h.ok ? 0x5dff9a : 0xff5050);
      r.ok.visible = !!h.ok; r.bad.visible = !h.ok;
    });
  }

  update(dt) {
    // particles
    let alive = 0;
    for (let k = 0; k < MAX; k++) {
      const p = this.p[k];
      if (p.life <= 0) { this.col[k * 3] = this.col[k * 3 + 1] = this.col[k * 3 + 2] = 0; continue; }
      alive++;
      p.life -= dt; p.v.y += p.g * dt; p.v.multiplyScalar(p.drag);
      this.pos[k * 3] += p.v.x * dt; this.pos[k * 3 + 1] += p.v.y * dt; this.pos[k * 3 + 2] += p.v.z * dt;
      if (this.pos[k * 3 + 1] < 0.01) { this.pos[k * 3 + 1] = 0.01; p.v.y *= -0.3; p.v.x *= 0.6; p.v.z *= 0.6; }
      const f = Math.max(0, p.life / p.max);
      this.col[k * 3] = p.c.r * f; this.col[k * 3 + 1] = p.c.g * f; this.col[k * 3 + 2] = p.c.b * f;
    }
    if (alive || this._wasAlive) { this.pts.geometry.attributes.position.needsUpdate = true; this.pts.geometry.attributes.color.needsUpdate = true; }
    this._wasAlive = alive > 0;
    // rings
    this.rings = this.rings.filter((r) => {
      r.t += dt; const k = Math.min(1, r.t / r.life);
      const s = r.r0 + (r.r1 - r.r0) * ease(k); r.m.scale.set(s, s, 1); r.m.material.opacity = 1 - k;
      if (k >= 1) { this.scene.remove(r.m); r.m.geometry.dispose(); r.m.material.dispose(); return false; }
      return true;
    });
    // scuff marks fade after a while
    for (const m of this.marks) { m.t += dt; m.m.material.opacity = 0.85 * Math.max(0, 1 - Math.max(0, m.t - 2.5) / 3); }
    // floats
    const cam = this.vp.camera, W = this.overlay.clientWidth, H = this.overlay.clientHeight, v = new THREE.Vector3();
    this.floats = this.floats.filter((f) => {
      f.t += dt; const k = f.t / 1.1;
      v.copy(f.at); v.y += 0.25 + ease(Math.min(1, k)) * 0.5; v.project(cam);
      f.el.style.transform = `translate(${(v.x * 0.5 + 0.5) * W}px, ${(-v.y * 0.5 + 0.5) * H}px) translate(-50%, -50%) scale(${k < 0.15 ? 0.6 + k * 2.6 : 1})`;
      f.el.style.opacity = String(k < 0.7 ? 1 : Math.max(0, 1 - (k - 0.7) / 0.3));
      if (k >= 1) { f.el.remove(); return false; }
      return true;
    });
    // squash
    this.squashes = this.squashes.filter((s) => {
      s.t += dt; const k = Math.min(1, s.t / 0.28);
      const w = Math.sin(k * Math.PI) * s.k * (1 - k * 0.5);
      s.obj.scale.set(s.base.x * (1 + w), s.base.y * (1 - w), s.base.z * (1 + w));
      if (k >= 1) { s.obj.scale.copy(s.base); return false; }
      return true;
    });
    // camera shake + push-in
    this.shakeAmt *= Math.pow(0.0015, dt);
    const sh = this.shakeAmt;
    cam.position.copy(this.camBase);
    if (this.pushT > 0) { this.pushT -= dt; const k = 1 - Math.max(0, this.pushT) / this.pushDur; const amt = this.push * Math.sin(Math.min(1, k * 1.4) * Math.PI / 2); cam.position.lerp(this._look || new THREE.Vector3(0, 0, 1), amt); }
    if (sh > 0.001) { cam.position.x += (Math.random() - 0.5) * sh; cam.position.y += (Math.random() - 0.5) * sh * 0.6; }
  }
  setLook(v) { this._look = new THREE.Vector3(...v); }
  dispose() {
    for (const f of this.floats) f.el.remove();
  }
}
