// Suturing sandbox: a deformable silicone pad with an incision, a curved needle and a suture.
import { THREE, Tool, noiseTex } from '../engine.js';
import { buildGrasper } from '../instruments.js';
import { BaseDrill, V } from './base.js';
import { playSound, synth } from '../../audio.js';

const PAD = { top: 0.32, depth: 4, halfW: 1.98, gap: 0.04, z: 0.8 };
const NX = 20, NZ = 30;
const NEEDLE_R = 0.22, SUT_N = 44, SUT_SEG = 0.055;

/** Pad colour with printed guide dots near the slit edge (innerRight: the slit is at u = 1). */
const _guides = {};
function guideTex(innerRight) {
  const k = innerRight ? 'r' : 'l'; if (_guides[k]) return _guides[k];
  const c = document.createElement('canvas'); c.width = 256; c.height = 512;
  const g = c.getContext('2d'); g.fillStyle = '#86dcc8'; g.fillRect(0, 0, 256, 512);
  g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 2;
  for (let y = 16; y < 512; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(256, y); g.stroke(); }
  g.fillStyle = '#ffffff'; g.strokeStyle = '#2b6e62'; g.lineWidth = 3;
  const x = innerRight ? 256 - 46 : 46;
  for (let y = 64; y < 512 - 40; y += 64) { g.beginPath(); g.arc(x, y, 11, 0, Math.PI * 2); g.fill(); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return (_guides[k] = t);
}

export class SuturingDrill extends BaseDrill {
  constructor(ctx) {
    super(ctx);
    this.target = 0;
    this.build();
  }
  build() {
    const r = this.root;
    this.plate({ size: 8, z: 0.8 });
    // pad base (static body)
    // a mint silicone practice pad (like the ones surgeons train on), not a wound
    const skin = new THREE.MeshPhysicalMaterial({ color: 0x86dcc8, roughness: 0.5, sheen: 0.3, sheenColor: new THREE.Color(0xd8fff4), sheenRoughness: 0.5, clearcoat: 0.3, clearcoatRoughness: 0.4, normalMap: noiseTex('skin', [3, 6], 1.2), normalScale: new THREE.Vector2(0.2, 0.2) });
    this.skin = skin;
    const cut = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.25 });
    const tray = new THREE.Mesh(new THREE.BoxGeometry(PAD.halfW * 2 + 0.4, 0.06, PAD.depth + 0.4), new THREE.MeshStandardMaterial({ color: 0x2c2c32, metalness: 0.4, roughness: 0.5 }));
    tray.position.set(0, 0.03, PAD.z); tray.receiveShadow = true; r.add(tray);
    this.halves = [-1, 1].map((s) => this.makeHalf(s, skin, cut));
    // needle
    const steel = new THREE.MeshStandardMaterial({ color: 0xd9dde3, metalness: 1, roughness: 0.18 });
    this.needle = new THREE.Group();
    const arc = new THREE.Mesh(new THREE.TorusGeometry(NEEDLE_R, 0.012, 10, 40, Math.PI), steel); arc.castShadow = true;
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.05, 10), steel); tip.position.set(NEEDLE_R, -0.02, 0); tip.rotation.z = Math.PI; tip.castShadow = true;
    const swage = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.05, 10), steel); swage.position.set(-NEEDLE_R, -0.02, 0);
    this.needle.add(arc, tip, swage); r.add(this.needle);
    this.needleTipL = V(NEEDLE_R, -0.045, 0); this.needleEndL = V(-NEEDLE_R, -0.045, 0);
    this.needleSamplesL = []; for (let i = 0; i <= 12; i++) { const a = (i / 12) * Math.PI; this.needleSamplesL.push(V(Math.cos(a) * NEEDLE_R, Math.sin(a) * NEEDLE_R, 0)); }
    // suture
    this.S = Array.from({ length: SUT_N }, () => V()); this.Sp = Array.from({ length: SUT_N }, () => V());
    const sm = new THREE.MeshPhysicalMaterial({ color: 0x5b3fb0, roughness: 0.4, sheen: 0.5, sheenColor: new THREE.Color(0xb9a6ff) });
    this.sutMesh = new THREE.Mesh(new THREE.BufferGeometry(), sm); this.sutMesh.castShadow = true; this.sutMesh.frustumCulled = false; r.add(this.sutMesh);
    this.holes = []; this.holeMeshes = new THREE.Group(); r.add(this.holeMeshes);
    this.resetNeedle();
    if (this.preview) { this.syncSuture(); return; }
    const mk = (side, s) => {
      const inst = buildGrasper({}, { jawLength: 0.26, shaftR: 0.04, thin: true, fenestrated: false, model: 'maryland' });
      const t = new Tool(r, inst, { port: V(2.5 * s, 2.5, 4.5), start: V(0.9 * s, 0.95, PAD.z + 0.6), minLen: 1.0, maxLen: 6.5, maxCone: 1.2, roll: Math.PI / 2, jaw: 0.7, maxJaw: 0.32,
        bounds: { minX: -2.6, maxX: 2.6, minY: 0, maxY: 2.6, minZ: -1.4, maxZ: 3.2 }, label: side });
      t.floor = (x, z) => this.surfaceAt(x, z) - 0.03;
      t.side = side; t.hold = null;
      return t;
    };
    this.L = mk('L', -1); this.R = mk('R', 1);
    this.tools = [this.L, this.R];
    this.bites = 0; this.inside = null;
  }
  makeHalf(s, skin, cut) {
    const w = PAD.halfW, x0 = s * PAD.gap / 2, x1 = s * (PAD.gap / 2 + w);
    const geo = new THREE.PlaneGeometry(w, PAD.depth, NX - 1, NZ - 1); geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const rest = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) + (x0 + x1) / 2, z = pos.getZ(i) + PAD.z;
      pos.setXYZ(i, x, PAD.top, z); rest[i * 3] = x; rest[i * 3 + 1] = PAD.top; rest[i * 3 + 2] = z;
    }
    geo.computeVertexNormals();
    // printed stitch guides: a row of dots along the slit on each side
    const guide = skin.clone(); guide.map = guideTex(s < 0); guide.color.set(0xffffff);
    const top = new THREE.Mesh(geo, guide); top.receiveShadow = true; top.castShadow = true; this.root.add(top);
    // static body under the top
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, PAD.top - 0.02, PAD.depth), skin);
    body.position.set((x0 + x1) / 2 + s * 0.012, (PAD.top - 0.02) / 2 + 0.005, PAD.z); body.receiveShadow = true; this.root.add(body);
    // inner (incision) wall follows the top edge
    const wallGeo = new THREE.BufferGeometry(); const wp = new Float32Array(NZ * 2 * 3); wallGeo.setAttribute('position', new THREE.BufferAttribute(wp, 3));
    // cut face: the pad's mint skin layer over a white foam core
    const wc = new Float32Array(NZ * 2 * 3); for (let j = 0; j < NZ; j++) { wc.set([0.4, 0.74, 0.66], j * 6); wc.set([0.96, 0.95, 0.9], j * 6 + 3); }
    wallGeo.setAttribute('color', new THREE.BufferAttribute(wc, 3));
    const idx = []; for (let j = 0; j < NZ - 1; j++) { const a = j * 2, b = a + 1, c = a + 2, d = a + 3; if (s > 0) idx.push(a, c, b, b, c, d); else idx.push(a, b, c, b, d, c); }
    wallGeo.setIndex(idx);
    const wall = new THREE.Mesh(wallGeo, cut); this.root.add(wall);
    const n = pos.count;
    const half = { s, geo, pos, rest, u: new Float32Array(n * 3), v: new Float32Array(n * 3), pinned: new Uint8Array(n), edge: [], wallGeo, grabbed: -1 };
    for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
      const k = j * NX + i;
      const innerCol = s > 0 ? 0 : NX - 1, outerCol = s > 0 ? NX - 1 : 0;
      if (i === outerCol || j === 0 || j === NZ - 1) half.pinned[k] = 1;
      if (i === innerCol) half.edge.push(k);
    }
    return half;
  }
  resetNeedle() {
    this.needle.position.set(0, 0.55, PAD.z); this.needle.rotation.set(0, Math.PI / 6, 0);
    this.needleState = 'frozen'; this.needleVel = V();
    this.needle.updateMatrixWorld(true);
    const end = this.needleEndL.clone().applyMatrix4(this.needle.matrixWorld);
    const dir = V(-0.92, 0, 0.38).normalize();
    for (let i = 0; i < SUT_N; i++) { this.S[i].set(end.x + dir.x * i * SUT_SEG, Math.max(PAD.top + 0.014, end.y - i * 0.06), end.z + dir.z * i * SUT_SEG); this.Sp[i].copy(this.S[i]); }
    this.sutureFree = false;
    this.holes.length = 0; this.holeMeshes.clear();
  }
  reset() {
    this.errors = 0; this.success = 0; this.bites = 0; this.complete = false; this.started = false; this.t = 0; this.inside = null; this.drive = null;
    for (const h of this.halves) { h.u.fill(0); h.v.fill(0); h.grabbed = -1; }
    this.resetNeedle();
    for (const t of this.tools) { t.reset(); t.hold = null; }
  }
  hud() { return { errors: 0, reps: this.bites, target: 0 }; }
  final() { return { errors: 0, misses: 0, success: this.bites, target: 0 }; }
  status() {
    if (this.drive) return this.pushing ? "Don't push — roll your wrist! (Q / E, or drag sideways)" : 'Roll your wrist to drive the needle across (Q / E, or drag sideways)';
    if (this.inside) return 'Needle parked in the tissue — grab it to keep driving';
    return `Bites across the incision: ${this.bites}`;
  }
  surfaceAt(x, z) {
    if (Math.abs(x) > PAD.gap / 2 + PAD.halfW || Math.abs(z - PAD.z) > PAD.depth / 2) return 0.03;
    const h = this.halves[x < 0 ? 0 : 1];
    const fx = (x - h.rest[0]) / (h.rest[(NX - 1) * 3] - h.rest[0]); const fz = (z - (PAD.z - PAD.depth / 2)) / PAD.depth;
    const i = Math.max(0, Math.min(NX - 1, Math.round(fx * (NX - 1)))), j = Math.max(0, Math.min(NZ - 1, Math.round(fz * (NZ - 1))));
    const k = j * NX + i;
    return PAD.top + h.u[k * 3 + 1];
  }
  toggleGrasp(tool) {
    if (tool.hold) {
      const h = tool.hold; tool.hold = null; tool.jawT = 0.7; playSound('jawOpen', { volume: 0.6 });
      if (h.kind === 'needle') { this.needleState = this.tipInside() ? 'frozen' : 'free'; this.drive = null; }
      if (h.kind === 'tissue') h.half.grabbed = -1;
      return;
    }
    tool.jawT = 0.05; playSound('jawClose', { volume: 0.8 });
    // needle?
    this.needle.updateMatrixWorld(true);
    let nd = 1e9;
    for (const p of this.needleSamplesL) nd = Math.min(nd, p.clone().applyMatrix4(this.needle.matrixWorld).distanceTo(tool.tip));
    if (nd < 0.13) {
      const other = tool === this.L ? this.R : this.L; if (other.hold?.kind === 'needle') { other.hold = null; other.jawT = 0.7; }
      const inv = tool.inst.group.matrixWorld.clone().invert();
      tool.hold = { kind: 'needle', local: inv.multiply(this.needle.matrixWorld.clone()) };
      this.needleState = 'held'; synth('grab'); this.started = true; this.emit('start'); this.emit('grab', { obj: null, pos: tool.tip.clone() }); return;
    }
    // suture?
    let si = -1, sd = 0.1;
    for (let i = 2; i < SUT_N; i++) { const d = this.S[i].distanceTo(tool.tip); if (d < sd) { sd = d; si = i; } }
    if (si >= 0) { tool.hold = { kind: 'suture', i: si }; this.sutureFree = true; synth('grab'); return; }
    // tissue (incision edge)
    for (const h of this.halves) {
      let best = -1, bd = 0.18;
      for (const k of h.edge) { const p = V(h.rest[k * 3] + h.u[k * 3], h.rest[k * 3 + 1] + h.u[k * 3 + 1], h.rest[k * 3 + 2] + h.u[k * 3 + 2]); const d = p.distanceTo(tool.tip); if (d < bd) { bd = d; best = k; } }
      if (best >= 0) { tool.hold = { kind: 'tissue', half: h, k: best }; h.grabbed = best; synth('grab'); return; }
    }
  }
  hints() {
    if (!this.tools.length) return [null, null];
    this.needle.updateMatrixWorld(true);
    return this.tools.map((t) => {
      if (t.hold) return null;
      let nd = 1e9, np = null;
      for (const p of this.needleSamplesL) { const w = p.clone().applyMatrix4(this.needle.matrixWorld); const d = w.distanceTo(t.tip); if (d < nd) { nd = d; np = w; } }
      if (nd < 0.13) return { pos: np, ok: true, size: 0.6 };
      for (let i = 2; i < this.S.length; i++) if (this.S[i].distanceTo(t.tip) < 0.1) return { pos: this.S[i], ok: true, size: 0.45 };
      return null;
    });
  }
  tipWorld() { return this.needleTipL.clone().applyMatrix4(this.needle.matrixWorld); }
  tipInside() { const p = this.tipWorld(); return Math.abs(p.x) > PAD.gap / 2 && Math.abs(p.x) < PAD.halfW && Math.abs(p.z - PAD.z) < PAD.depth / 2 - 0.05 && p.y < this.surfaceAt(p.x, p.z) - 0.005 && p.y > 0.04; }
  update(dt, inputs, sens) {
    this.tick(dt);
    const li = inputs[0] || {}, ri = inputs[1] || {};
    // needle in tissue: the holding hand can't push it sideways — rolling the wrist drives it along its curve
    this.driveRate = 0; this.pushing = false;
    for (const [t, inp] of [[this.L, li], [this.R, ri]]) {
      if (this.drive && t === this.drive.tool) {
        let dx = 0;
        if (inp.abs) { if (t._absX !== undefined) dx = (inp.abs.x - t._absX) * 22; t._absX = inp.abs.x; }
        this.driveRate = (inp.rot || 0) + (inp.mx || 0) + (inp.orbit?.x || 0) + (inp.delta ? inp.delta.x * 22 : 0) + dx;
        this.pushing = Math.abs(inp.my || 0) + Math.abs(inp.orbit?.y || 0) + Math.abs(inp.insert || 0) + Math.abs(inp.height || 0) + (inp.delta ? Math.abs(inp.delta.z) * 20 : 0) > 0.3;
      } else { t._absX = undefined; t.input(inp, dt, sens); }
    }
    if (li.grab) this.toggleGrasp(this.L);
    if (ri.grab) this.toggleGrasp(this.R);
    this.L.step(dt); this.R.step(dt);
    this.updateNeedle(dt);
    this.updatePad(dt);
    this.updateSuture(dt);
  }
  updateNeedle(dt) {
    const holder = this.L.hold?.kind === 'needle' ? this.L : this.R.hold?.kind === 'needle' ? this.R : null;
    if (holder && this.drive && this.drive.tool === holder) {
      // rotate the needle about its own arc centre; the instrument follows the needle
      const d = this.drive;
      d.theta -= this.driveRate * dt * 1.4;
      d.theta = Math.max(-Math.PI * 1.05, Math.min(0.6, d.theta));
      const rot = new THREE.Quaternion().setFromAxisAngle(d.axis, d.theta);
      this.needle.position.copy(d.pos).sub(d.C).applyQuaternion(rot).add(d.C);
      this.needle.quaternion.copy(rot).multiply(d.quat);
      this.needle.updateMatrixWorld(true);
      const tm = this.needle.matrixWorld.clone().multiply(holder.hold.local.clone().invert());
      const p = new THREE.Vector3().setFromMatrixPosition(tm);
      holder.tip.copy(p); holder.target.copy(p); holder.vel.set(0, 0, 0);
      holder.rollT = holder.roll = d.roll0 - d.theta; holder.sync();
      if (!this.tipInside() && !(Math.abs(this.tipWorld().x) <= PAD.gap / 2 + 0.03 && this.tipWorld().y < PAD.top)) this.endDrive(holder);
    } else if (holder) {
      const m = holder.inst.group.matrixWorld.clone().multiply(holder.hold.local);
      m.decompose(this.needle.position, this.needle.quaternion, this.needle.scale);
      this.needle.updateMatrixWorld(true);
      if (this.tipInside()) this.startDrive(holder);
    } else if (this.needleState === 'free') {
      this.needleVel.y -= 9.8 * dt;
      this.needle.position.addScaledVector(this.needleVel, dt);
      this.needle.updateMatrixWorld(true);
      let low = 1e9, lp = null;
      for (const p of this.needleSamplesL) { const w = p.clone().applyMatrix4(this.needle.matrixWorld); const gap = w.y - (this.surfaceAt(w.x, w.z) + 0.012); if (gap < low) { low = gap; lp = w; } }
      if (low < 0) { this.needle.position.y -= low; this.needleVel.set(0, 0, 0); this.needleState = 'rest'; }
    }
    this.needle.updateMatrixWorld(true);
    // bites: entering on one side and exiting on the other
    const inside = this.tipInside();
    const tip = this.tipWorld();
    if (inside && !this.inside) { this.inside = { side: Math.sign(tip.x) }; this.addHole(tip); }
    else if (!inside && this.inside && Math.abs(tip.x) <= PAD.gap / 2 + 0.03 && tip.y < PAD.top) { /* crossing the incision gap under the surface */ }
    else if (!inside && this.inside) {
      if (tip.y >= this.surfaceAt(tip.x, tip.z) - 0.01 && Math.abs(tip.x) > PAD.gap / 2) {
        if (Math.sign(tip.x) !== this.inside.side) { this.bites++; this.success = this.bites; this.emit('success', { count: this.bites, pos: tip.clone() }); }
        this.addHole(tip);
      }
      this.inside = null;
    }
  }
  startDrive(tool) {
    this.needle.updateMatrixWorld(true);
    // needle-loading helper: line the needle up so its curve heads across the incision (a curved needle
    // always travels toward its own centre). Keeps the tip where it entered.
    const tip = this.tipWorld(), toward = tip.x < 0 ? 1 : -1;
    const X = new THREE.Vector3(-toward, 0, 0), Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3().crossVectors(X, Y);
    const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, Y, Z));
    this.needle.quaternion.copy(q);
    this.needle.position.copy(tip).sub(this.needleTipL.clone().applyQuaternion(q));
    this.needle.updateMatrixWorld(true);
    this.emit('loaded');
    this.drive = {
      tool, theta: 0, roll0: tool.roll,
      C: new THREE.Vector3().setFromMatrixPosition(this.needle.matrixWorld),
      axis: new THREE.Vector3(0, 0, 1).applyQuaternion(this.needle.quaternion).normalize(),
      pos: this.needle.position.clone(), quat: this.needle.quaternion.clone(),
    };
    this.emit('drive');
  }
  endDrive(tool) {
    this.drive = null;
    tool.inst.group.updateMatrixWorld(true);
    tool.hold.local = tool.inst.group.matrixWorld.clone().invert().multiply(this.needle.matrixWorld.clone());
  }
  addHole(p) {
    if (this.holes.some((h) => h.distanceTo(p) < 0.06)) return;
    const h = V(p.x, this.surfaceAt(p.x, p.z) + 0.003, p.z); this.holes.push(h);
    const m = new THREE.Mesh(new THREE.CircleGeometry(0.018, 12), new THREE.MeshBasicMaterial({ color: 0x1d4f47 })); m.rotation.x = -Math.PI / 2; m.position.copy(h); this.holeMeshes.add(m);
  }
  updatePad(dt) {
    const pushers = [];
    for (const t of this.tools) { pushers.push(t.tip.clone()); for (const q of t.inst.jawTips()) pushers.push(t.world(q)); }
    const K = 70, C = 700, damp = 0.86, h = Math.min(dt, 1 / 50);
    for (const half of this.halves) {
      const { u, v, rest, pinned } = half;
      for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
        const k = j * NX + i; if (pinned[k]) continue;
        const kl = i > 0 ? k - 1 : k, kr = i < NX - 1 ? k + 1 : k, kd = j > 0 ? k - NX : k, ku = j < NZ - 1 ? k + NX : k;
        for (let c = 0; c < 3; c++) {
          const a = k * 3 + c;
          const avg = (u[kl * 3 + c] + u[kr * 3 + c] + u[kd * 3 + c] + u[ku * 3 + c]) / 4;
          v[a] = (v[a] + (-K * u[a] + C * (avg - u[a])) * h) * damp;
        }
      }
      for (let a = 0; a < u.length; a++) u[a] += v[a] * h;
      // tools press the surface
      for (const p of pushers) {
        const px = p.x, pz = p.z;
        for (let k = 0; k < u.length / 3; k++) {
          if (pinned[k]) continue;
          const dx = rest[k * 3] - px, dz = rest[k * 3 + 2] - pz; const d2 = dx * dx + dz * dz; if (d2 > 0.09) continue;
          const fall = 1 - Math.sqrt(d2) / 0.3;
          const surf = rest[k * 3 + 1] + u[k * 3 + 1];
          const want = p.y - 0.01;
          if (want < surf) { const ny = Math.max(-0.18, (want - rest[k * 3 + 1]) * fall); if (ny < u[k * 3 + 1]) { u[k * 3 + 1] = ny; v[k * 3 + 1] = 0; } }
        }
      }
      // grabbed edge vertex follows the grasper
      if (half.grabbed >= 0) {
        const t = this.L.hold?.half === half ? this.L : this.R;
        const k = half.grabbed; const d = V(t.tip.x - rest[k * 3], t.tip.y - rest[k * 3 + 1], t.tip.z - rest[k * 3 + 2]);
        if (d.length() > 0.7) { d.setLength(0.7); }
        u[k * 3] = d.x; u[k * 3 + 1] = d.y; u[k * 3 + 2] = d.z; v[k * 3] = v[k * 3 + 1] = v[k * 3 + 2] = 0;
        if (t.tip.distanceTo(V(rest[k * 3], rest[k * 3 + 1], rest[k * 3 + 2])) > 0.95) { t.hold = null; half.grabbed = -1; t.jawT = 0.7; playSound('jawOpen', { volume: 0.5 }); }
      }
      // write geometry
      const pos = half.pos;
      for (let k = 0; k < pos.count; k++) pos.setXYZ(k, rest[k * 3] + u[k * 3], rest[k * 3 + 1] + u[k * 3 + 1], rest[k * 3 + 2] + u[k * 3 + 2]);
      pos.needsUpdate = true; half.geo.computeVertexNormals();
      const wp = half.wallGeo.attributes.position;
      half.edge.forEach((k, j) => {
        const x = rest[k * 3] + u[k * 3], y = rest[k * 3 + 1] + u[k * 3 + 1], z = rest[k * 3 + 2] + u[k * 3 + 2];
        wp.setXYZ(j * 2, x, y, z); wp.setXYZ(j * 2 + 1, rest[k * 3] + u[k * 3] * 0.3, 0.03, z);
      });
      wp.needsUpdate = true; half.wallGeo.computeVertexNormals(); half.wallGeo.computeBoundingSphere();
    }
  }
  updateSuture(dt) {
    const S = this.S, Sp = this.Sp;
    const end = this.needleEndL.clone().applyMatrix4(this.needle.matrixWorld);
    const g = -9.8 * dt * dt;
    const pin = (this.L.hold?.kind === 'suture' ? [[this.L.hold.i, this.L.tip]] : []).concat(this.R.hold?.kind === 'suture' ? [[this.R.hold.i, this.R.tip]] : []);
    const moving = this.needleState !== 'frozen' || this.sutureFree || pin.length;
    if (moving) {
      for (let i = 1; i < SUT_N; i++) { const p = S[i], q = Sp[i]; const vx = (p.x - q.x) * 0.98, vy = (p.y - q.y) * 0.98, vz = (p.z - q.z) * 0.98; q.copy(p); p.x += vx; p.y += vy + g; p.z += vz; }
    }
    for (let it = 0; it < 14; it++) {
      S[0].copy(end);
      for (let i = 0; i < SUT_N - 1; i++) {
        const a = S[i], b = S[i + 1]; const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z; const d = Math.hypot(dx, dy, dz) || 1e-6;
        const diff = (d - SUT_SEG) / d; const wa = i === 0 ? 0 : 0.5, wb = i === 0 ? 1 : 0.5;
        a.x += dx * diff * wa; a.y += dy * diff * wa; a.z += dz * diff * wa; b.x -= dx * diff * wb; b.y -= dy * diff * wb; b.z -= dz * diff * wb;
      }
      for (let i = 1; i < SUT_N - 2; i++) { // light bending stiffness keeps the thread from kinking
        const a = S[i], c = S[i + 2]; const dx = c.x - a.x, dy = c.y - a.y, dz = c.z - a.z; const d = Math.hypot(dx, dy, dz) || 1e-6;
        const rest = SUT_SEG * 1.9; if (d < rest) { const k = (d - rest) / d * 0.12; a.x += dx * k; a.y += dy * k; a.z += dz * k; c.x -= dx * k; c.y -= dy * k; c.z -= dz * k; }
      }
      for (const [i, p] of pin) S[i].copy(p);
      for (let i = 1; i < SUT_N; i++) {
        const p = S[i];
        const nearHole = this.holes.some((h) => (h.x - p.x) ** 2 + (h.z - p.z) ** 2 < 0.012);
        const floor = nearHole ? 0.03 : this.surfaceAt(p.x, p.z) + 0.012;
        if (p.y < floor) { p.y = floor; const q = Sp[i]; q.x += (p.x - q.x) * 0.3; q.z += (p.z - q.z) * 0.3; }
      }
    }
    this.syncSuture();
  }
  syncSuture() {
    const curve = new THREE.CatmullRomCurve3(this.S.map((p) => p.clone()));
    const g = new THREE.TubeGeometry(curve, SUT_N * 3, 0.011, 7, false);
    this.sutMesh.geometry.dispose(); this.sutMesh.geometry = g;
  }
}
