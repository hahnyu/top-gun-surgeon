// Cobra Rope: run the rope hand-over-hand, grasping only the red regions in order, with two graspers.
import { THREE, Tool } from '../engine.js';
import { buildGrasper } from '../instruments.js';
import { ringDisk, buildBoat } from '../themes.js';
import { BaseDrill, V } from './base.js';
import { playSound, synth } from '../../audio.js';

const SEG = 0.1, ROPE_R = 0.055, BLUE = 0.204, RED = 0.408, WHITE = 1.632, NRED = 11;
const PLANE_Z = 1.7, GUIDE_Y = 0.3, COLUMN = 8;
const COLORS = { blue: 0x2E5090, red: 0xC72C41, white: 0xFADADD };

export class CobraDrill extends BaseDrill {
  constructor(ctx) {
    super(ctx);
    this.target = NRED; this.strikes = 0;
    this.coilC = V(2.0 * this.m, 0, PLANE_Z); // mirrored for left-handed players
    this.G = V(this.coilC.x, GUIDE_Y, PLANE_Z);
    // regions along the rope
    const total = BLUE * 2 + RED * NRED + WHITE * (NRED - 1);
    this.N = Math.round(total / SEG) + 1;
    this.region = new Int8Array(this.N); // -1 blue, 0 white, k red k
    for (let i = 0; i < this.N; i++) {
      const s = i * SEG + SEG * 0.5; let r;
      if (s < BLUE || s > total - BLUE) r = -1;
      else { const u = s - BLUE, period = RED + WHITE, k = Math.floor(u / period), off = u - k * period; r = off < RED && k < NRED ? k + 1 : 0; }
      this.region[i] = r;
    }
    // Top Gun rules: the first grasp is with the non-dominant hand, then the hands take turns
    const nd = this.m > 0 ? 'L' : 'R', dom = this.m > 0 ? 'R' : 'L';
    this.steps = [[nd, 1]];
    for (let r = 2; r <= NRED; r++) this.steps.push([dom, r], [nd, r]);
    this.colors = { ...COLORS, ...(this.env.ropeColors || {}) };
    this.build();
  }
  build() {
    const r = this.root, env = this.env;
    this.plate({ size: 7.2, z: 0.8 });
    if (env.boat) { const b1 = buildBoat(1.1); b1.position.copy(this.coilC); r.add(b1); const b2 = buildBoat(0.8); b2.position.set(-2.5, 0, PLANE_Z); b2.rotation.y = Math.PI; r.add(b2); }
    else { const d = ringDisk(1.25, env.circle, env.id === 'default' ? 0xd8d8d8 : env.circle); d.position.copy(this.coilC); r.add(d); }
    const arrow = arrowMesh(env.id === 'jungle' ? 0xcfe8b0 : 0xffffff); arrow.scale.x = this.m; r.add(arrow);
    // rope buffers + meshes
    this.P = Array.from({ length: this.N }, () => V()); this.Pp = Array.from({ length: this.N }, () => V());
    this.coilPos = Array.from({ length: this.N }, () => V());
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.72, metalness: 0, envMapIntensity: 0.5, normalMap: braidTex(), normalScale: new THREE.Vector2(0.9, 0.9) });
    this.nodes = new THREE.InstancedMesh(new THREE.SphereGeometry(ROPE_R, 12, 8), mat, this.N);
    this.segs = new THREE.InstancedMesh(new THREE.CylinderGeometry(ROPE_R, ROPE_R, 1, 12, 1, true), mat, this.N - 1);
    for (const m of [this.nodes, this.segs]) { m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; r.add(m); }
    if (env.head) { this.head = env.head(); r.add(this.head); }
    this.resetRope();
    if (this.preview) { this.syncRope(); return; }
    const mk = (side, s) => {
      const inst = buildGrasper({}, { jawLength: 0.48, model: 'maryland' });
      // right grasper starts beyond the coil so the left can take R1 without crossing
      const t = new Tool(r, inst, { port: V(5.2 * s, 2.9, 3.1), start: V(this.m > 0 ? (s > 0 ? 2.75 : -0.5) : (s > 0 ? 0.5 : -2.75), 1.0, PLANE_Z), mode: 'plane', plane: { z: PLANE_Z }, roll: 0, jaw: 0.75, maxJaw: 0.5, bounds: { minX: -3.4, maxX: 3.4, minY: 0.15, maxY: 3.1, minZ: PLANE_Z, maxZ: PLANE_Z }, label: side });
      t.side = side; t.node = -1; t.last = 0;
      t.floor = () => 0.12;
      return t;
    };
    this.L = mk('L', -1); this.R = mk('R', 1);
    this.tools = [this.L, this.R];
    this.k = 0; this.grasped = 0; this.crossLatch = false; this.nicks = new Set(); this.tautT = 0;
    this.syncRope();
  }
  resetRope() {
    this.f = COLUMN; this.free = false;
    // vertical column above the guide for the first nodes (blue end + R1 stand up)
    for (let i = 0; i < COLUMN; i++) { const y = GUIDE_Y + (COLUMN - 1 - i) * SEG; this.P[i].set(this.G.x - 0.02 * i, y, PLANE_Z); this.Pp[i].copy(this.P[i]); }
    // spiral coil for the rest
    let th = 0;
    for (let i = COLUMN; i < this.N; i++) {
      const rad = 0.22 + 0.13 * th / (Math.PI * 2);
      this.coilPos[i].set(this.coilC.x + Math.cos(th) * rad, ROPE_R + 0.015, this.coilC.z + Math.sin(th) * rad);
      this.P[i].copy(this.coilPos[i]); this.Pp[i].copy(this.P[i]);
      th += SEG / rad;
    }
  }
  reset() {
    this.errors = 0; this.strikes = 0; this.success = 0; this.complete = false; this.started = false; this.failed = false; this.t = 0;
    this.k = 0; this.grasped = 0; this.crossLatch = false; this._errCool = 0; this.nicks = new Set(); this.tautT = 0;
    this.resetRope();
    for (const t of this.tools) { t.reset(); t.node = -1; t.last = 0; }
  }
  /** The pointer drives the hand the rules say is next (Tab / right-click swaps). */
  get soft() { return this.level !== 'EXPERT'; } // only Top Gun level strikes crossing; below it the hands meet a soft wall
  autoIndex() { return this.complete ? 0 : this.expected[0] === 'L' ? 0 : 1; }
  get expected() { return this.steps[Math.min(this.k, this.steps.length - 1)]; }
  get frontier() { return this.expected[1]; }
  hud() { return { errors: this.strikes, reps: this.success, target: NRED, strikes: this.strikes }; }
  final() { return { errors: this.strikes, misses: 0, success: this.success, target: NRED, finesse: this.nicks.size, finesseMax: NRED - 1 }; }
  status() {
    if (this.complete) return 'Rope run complete';
    const [h, r] = this.expected;
    if (!this.started) return `Grab R1 with the ${this.steps[0][0] === 'L' ? 'left' : 'right'} grasper to start`;
    return `Next: ${h === 'L' ? 'Left' : 'Right'} grasper → R${r}`;
  }
  regionsHeld() { return { L: this.L.node >= 0 ? this.region[this.L.node] : null, R: this.R.node >= 0 ? this.region[this.R.node] : null }; }
  strike(reason, tool = null) {
    if (this._errCool > 0 || this.failed) return;
    this._errCool = 1; this.strikes++; this.errors = this.strikes;
    const at = (tool || this.L).tip.clone();
    synth('strike'); this.emit('error', { reason, strike: this.strikes, pos: at, surf: 0, noMark: true });
    if (this.strikes >= 3) { this.failed = true; this.emit('fail', { reason: '3 Strikes!' }); }
  }
  tryGrab(tool) {
    if (tool.node >= 0) { tool.node = -1; tool.jawT = 0.75; playSound('jawOpen', { volume: 0.6 }); return; }
    if (tool.jawT < 0.3) { tool.jawT = 0.75; playSound('jawOpen', { volume: 0.6 }); return; }
    tool.jawT = 0.05; playSound('jawClose', { volume: 0.8 });
    const best = this.pick(tool);
    if (best < 0) return;
    const reg = this.region[best];
    if (reg < 0) return; // blue ends: nothing to grip
    if (reg === 0) { tool.jawT = 0.75; this.emit('tip', { text: 'Grab the red bands' }); return; } // not an official error
    const [eh, er] = this.expected;
    if (!this.soft && ((tool.side === 'L' && this.R.node >= 0 && this.P[best].x > this.R.tip.x + 0.05) || (tool.side === 'R' && this.L.node >= 0 && this.P[best].x < this.L.tip.x - 0.05))) { this.strike('Crossing over — keep your hands on their own side', tool); return; }
    if (tool.side === eh && reg === er) {
      this.grip(tool, best, reg);
      this.k++;
      if (!this.started) { this.started = true; this.free = true; this.emit('start'); }
      if (tool.side === 'L') { this.success = reg; this.emit('success', { count: reg, pos: tool.tip.clone() }); }
      if (this.k >= this.steps.length) { this.complete = true; this.emit('complete'); }
      return;
    }
    if (reg === tool.last) { this.grip(tool, best, reg); return; } // re-grip after a slip
    if (reg > er) this.strike('Skipping reds — every red band must be touched', tool);
    else this.strike(tool.side !== eh ? 'Fireman\'s pole — take turns with both hands' : 'Wrong red band', tool);
  }
  hints() {
    if (!this.tools.length || this.complete || this.failed) return [null, null];
    const [eh, er] = this.expected;
    return this.tools.map((t) => {
      if (t.node >= 0 || t.jawT < 0.3) return null;
      const best = this.pick(t);
      if (best < 0) return null;
      const reg = this.region[best]; if (reg < 0) return null;
      const visibleRed = this.colorFor(best) === this.colors.red;
      // don't reveal hidden regions: only judge what the player can see
      const ok = reg > 0 && t.side === eh && reg === er;
      if (!ok && reg > 0 && !visibleRed) return null;
      return { pos: this.P[best], ok: ok || (reg > 0 && reg === t.last), size: 0.9 };
    });
  }
  /** Rope node under the jaws. Height counts half (the rope lies on the table, below the tip's
   *  plane); the band you're meant to grab wins over a nearer white bit if it's within reach. */
  pick(tool) {
    const R = this.level === 'BEGINNER' ? 0.42 : this.level === 'INTERMEDIATE' ? 0.36 : 0.3;
    const er = this.expected[1], tp = tool.tip;
    let best = -1, bd = R, good = -1, gd = R;
    for (let i = 0; i < this.f; i++) {
      const q = this.P[i];
      if (this.soft && ((tool.side === 'L' && this.R.node >= 0 && q.x > this.R.tip.x) || (tool.side === 'R' && this.L.node >= 0 && q.x < this.L.tip.x))) continue;
      const d = Math.hypot(q.x - tp.x, (q.y - tp.y) * 0.5, q.z - tp.z);
      if (d < bd) { bd = d; best = i; }
      if (this.region[i] === er && d < gd) { gd = d; good = i; }
    }
    return good >= 0 ? good : best;
  }
  grip(tool, i, reg) { this.free = true; tool.node = i; tool.last = reg; tool.jawT = 0.12; this.grasped = Math.max(this.grasped, reg); synth('grab'); this.emit('grab', { pos: tool.tip.clone() }); }
  update(dt, inputs, sens) {
    this.tick(dt);
    const li = inputs[0] || {}, ri = inputs[1] || {};
    if (this.failed) { li.mx = li.my = ri.mx = ri.my = 0; li.orbit = ri.orbit = null; li.grab = ri.grab = false; }
    this.L.input(li, dt, sens); this.R.input(ri, dt, sens);
    // single-pointer play steers one hand at a time: an empty, untouched hand steps aside
    // instead of becoming a trap the active hand crosses
    if (this.started && !this.complete) {
      const a = this.tools[this.autoIndex()];
      [[this.L, li, -1], [this.R, ri, 1]].forEach(([t, inp, sgn]) => {
        if (t === a || t.node >= 0 || inp.abs || inp.delta || inp.mx || inp.my || inp.orbit) return;
        const gap = (t.target.x - a.tip.x) * sgn; // how far it sits on its own side of the active hand
        if (gap < 0.45) t.target.x = Math.max(-3.3, Math.min(3.3, t.target.x + sgn * Math.min(0.45 - gap, 3 * dt)));
      });
    }
    if (li.grab) this.tryGrab(this.L);
    if (ri.grab) this.tryGrab(this.R);
    this.L.step(dt); this.R.step(dt);
    // rope can't stretch between the two hands
    if (this.L.node >= 0 && this.R.node >= 0) {
      const maxD = Math.abs(this.R.node - this.L.node) * SEG * 1.02 + 0.02;
      const d = this.L.tip.distanceTo(this.R.tip);
      if (d > maxD) {
        const mid = this.L.tip.clone().add(this.R.tip).multiplyScalar(0.5);
        for (const t of [this.L, this.R]) { const v = t.tip.clone().sub(mid).setLength(maxD / 2); t.tip.copy(mid).add(v); t.target.lerp(t.tip, 0.5); t.vel.multiplyScalar(0.5); t.sync(); }
      }
    }
    // crossing: on the learning levels the hands can't pass each other (a soft wall + a tip);
    // on Advanced/Expert crossing is a strike, as in the real drill
    if (this.soft && this.started && !this.complete) {
      let hit = false;
      if (this.L.target.x > this.R.tip.x - 0.08) { this.L.target.x = this.R.tip.x - 0.08; hit = true; }
      if (this.R.target.x < this.L.tip.x + 0.08) { this.R.target.x = this.L.tip.x + 0.08; hit = true; }
      if (hit) this.emit('tip', { text: 'Keep your hands on their own side' });
    }
    if (!this.soft && this.started && !this.complete) {
      // a real cross: the tips swap sides at about the same height and stay that way (a quick pass
      // over/under the other instrument isn't one)
      const crossed = this.L.tip.x > this.R.tip.x + 0.05 && Math.abs(this.L.tip.y - this.R.tip.y) < 0.35;
      this.crossT = crossed ? (this.crossT || 0) + dt : 0;
      if (crossed && !this.crossWarned) { this.crossWarned = true; this.emit('tip', { text: 'Hands are crossing — uncross them!' }); }
      if (this.crossT > 0.35 && !this.crossLatch) { this.crossLatch = true; this.strike('Instruments crossed'); }
      if (!crossed) this.crossLatch = false;
    }
    this.simulate(dt);
    this.lineOfNick(dt);
    this.syncRope();
  }
  /** "Line of Nick": with one hand on each of two neighbouring red bands, pull the rope between them
   *  straight and tight (how a surgeon measures a length of bowel). Counts once per pair of bands. */
  lineOfNick(dt) {
    const a = this.L.node, b = this.R.node;
    if (!this.started || this.complete || this.failed || a < 0 || b < 0 || a === b) { this.tautT = 0; return; }
    const ra = this.region[a], rb = this.region[b];
    if (ra <= 0 || rb <= 0 || Math.abs(ra - rb) !== 1) { this.tautT = 0; return; }
    const key = Math.min(ra, rb);
    const L = Math.abs(b - a) * SEG, D = this.P[a].distanceTo(this.P[b]);
    this.tautT = D / L > 0.95 ? this.tautT + dt : 0;
    if (this.tautT > 0.12 && !this.nicks.has(key)) {
      this.nicks.add(key);
      const mid = this.P[a].clone().add(this.P[b]).multiplyScalar(0.5);
      this.emit('nick', { pos: mid, count: this.nicks.size, max: NRED - 1, a: this.P[a].clone(), b: this.P[b].clone() });
    }
  }
  simulate(dt) {
    const P = this.P, Pp = this.Pp, n = this.f;
    if (!this.free) return;
    // feed rope through the guide when pulled
    // keep the next red band presented just above the coil (the "wrapper" sets up the rope so it is reachable)
    if (this.started && !this.failed && this.f < this.N) {
      const er = this.expected[1]; let have = false;
      for (let i = 0; i < this.f - 6; i++) if (this.region[i] === er) { have = true; break; }
      if (!have) { const i = this.f; P[i].copy(this.G); Pp[i].copy(this.G); this.f++; }
    }
    // nothing red left in the coil (last rep): let the blue tail come out so it isn't held down at the guide
    if (this.started && this.f < this.N) {
      let red = false; for (let i = this.f; i < this.N; i++) if (this.region[i] > 0) { red = true; break; }
      if (!red) { const i = this.f; P[i].copy(this.G); Pp[i].copy(this.G); this.f++; }
    }
    // a held node pulled further from the guide than the rope between them allows → pay out rope
    const held = [this.L.node, this.R.node].filter((i) => i >= 0);
    let guard = 0;
    while (this.f < this.N && guard++ < 4 && held.some((i) => P[i].distanceTo(this.G) > (this.f - 1 - i) * SEG * 0.96)) {
      const i = this.f; P[i].copy(this.G); Pp[i].copy(this.G); this.f++;
    }
    const f = this.f, tail = f < this.N; // all rope out: the far (blue) end hangs free
    const g = -9.8 * dt * dt, damp = 0.985;
    for (let i = 0; i < (tail ? f - 1 : f); i++) {
      const p = P[i], q = Pp[i];
      const vx = (p.x - q.x) * damp, vy = (p.y - q.y) * damp, vz = (p.z - q.z) * damp;
      q.copy(p); p.x += vx; p.y += vy + g; p.z += vz;
      p.z += (PLANE_Z - p.z) * 0.02; // drift back toward the working plane
    }
    const pinL = this.L.node, pinR = this.R.node;
    for (let it = 0; it < 18; it++) {
      for (let i = 0; i < f - 1; i++) {
        const a = P[i], b = P[i + 1];
        const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z; const d = Math.hypot(dx, dy, dz) || 1e-6;
        const diff = (d - SEG) / d;
        const wa = (i === pinL || i === pinR) ? 0 : 1, wb = (i + 1 === pinL || i + 1 === pinR || (tail && i + 1 === f - 1)) ? 0 : 1;
        const s = wa + wb; if (!s) continue;
        a.x += dx * diff * wa / s; a.y += dy * diff * wa / s; a.z += dz * diff * wa / s;
        b.x -= dx * diff * wb / s; b.y -= dy * diff * wb / s; b.z -= dz * diff * wb / s;
      }
      // light bending stiffness
      for (let i = 0; i < f - 2; i += 2) {
        const a = P[i], c = P[i + 2]; const dx = c.x - a.x, dy = c.y - a.y, dz = c.z - a.z; const d = Math.hypot(dx, dy, dz) || 1e-6;
        if (d < SEG * 1.6) { const diff = (d - SEG * 1.6) / d * 0.08; a.x += dx * diff; a.y += dy * diff; a.z += dz * diff; c.x -= dx * diff; c.y -= dy * diff; c.z -= dz * diff; }
      }
      if (pinL >= 0) P[pinL].copy(this.L.tip);
      if (pinR >= 0) P[pinR].copy(this.R.tip);
      if (tail) P[f - 1].copy(this.G);
      // instruments are solid: push rope out of each shaft (from the jaws back toward the port)
      if (it % 3 === 2) for (const t of this.tools) {
        const ax = t.tip, dir = t.dir, rr = 0.065 + ROPE_R;
        for (let i = 0; i < f - 1; i++) {
          if (i === pinL || i === pinR) continue;
          const p = P[i]; const dx = p.x - ax.x, dy = p.y - ax.y, dz = p.z - ax.z;
          let s2 = -(dx * dir.x + dy * dir.y + dz * dir.z); if (s2 < -0.3 || s2 > 3) continue; s2 = Math.max(0, s2);
          const cx = ax.x - dir.x * s2, cy = ax.y - dir.y * s2, cz = ax.z - dir.z * s2;
          const ox = p.x - cx, oy = p.y - cy, oz = p.z - cz, d = Math.hypot(ox, oy, oz);
          if (d < rr && d > 1e-5) { const k = (rr - d) / d; p.x += ox * k; p.y += oy * k; p.z += oz * k; }
        }
      }
      for (let i = 0; i < (tail ? f - 1 : f); i++) {
        const p = P[i];
        if (p.y < ROPE_R) { p.y = ROPE_R; const q = Pp[i]; q.x += (p.x - q.x) * 0.4; q.z += (p.z - q.z) * 0.4; }
      }
    }
    // pulled tight: when the two hands are (nearly) a rope-length apart, the rope between them
    // straightens into a taut line instead of sagging (a chain solver alone stays a little stretchy)
    if (pinL >= 0 && pinR >= 0 && pinL !== pinR) {
      const a = Math.min(pinL, pinR), b = Math.max(pinL, pinR), L = (b - a) * SEG, D = P[a].distanceTo(P[b]);
      const k = Math.max(0, Math.min(1, (D / L - 0.85) / 0.13));
      if (k > 0) for (let i = a + 1; i < b; i++) {
        const u = (i - a) / (b - a), sx = P[a].x + (P[b].x - P[a].x) * u, sy = P[a].y + (P[b].y - P[a].y) * u, sz = P[a].z + (P[b].z - P[a].z) * u;
        // keep a little natural sag that disappears as it gets tight
        const sag = (1 - k) * 0.25 * L * Math.sin(Math.PI * u);
        const tx = sx, ty = Math.max(ROPE_R, sy - sag), tz = sz;
        P[i].x += (tx - P[i].x) * k; P[i].y += (ty - P[i].y) * k; P[i].z += (tz - P[i].z) * k;
        Pp[i].x += (P[i].x - Pp[i].x) * k; Pp[i].y += (P[i].y - Pp[i].y) * k; Pp[i].z += (P[i].z - Pp[i].z) * k; // calm it down
      }
    }
    // the guide funnel: rope near it sits above the coil
    if (tail) for (let i = Math.max(0, f - 4); i < f - 1; i++) if (P[i].y < GUIDE_Y) P[i].y = GUIDE_Y;
  }
  colorFor(i) {
    const r = this.region[i], c = this.colors;
    if (r < 0) return c.blue; if (r === 0) return c.white;
    const lv = this.level;
    if (lv === 'BEGINNER') return c.red;
    if (lv === 'INTERMEDIATE') return r <= this.frontier ? c.red : c.white;
    if (r <= this.grasped) return c.red;
    if (r === this.frontier) return (this.t % 4) < 1 ? c.red : c.white;
    return c.white;
  }
  syncRope() {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), up = V(0, 1, 0), d = V(), mid = V(), col = new THREE.Color();
    const P = this.P, N = this.N;
    for (let i = 0; i < N; i++) {
      m.makeTranslation(P[i].x, P[i].y, P[i].z); this.nodes.setMatrixAt(i, m);
      this.nodes.setColorAt(i, col.setHex(this.colorFor(i)));
      if (i < N - 1) {
        d.copy(P[i + 1]).sub(P[i]); const len = d.length();
        mid.copy(P[i]).add(P[i + 1]).multiplyScalar(0.5);
        q.setFromUnitVectors(up, len > 1e-6 ? d.divideScalar(len) : up);
        s.set(1, len, 1); m.compose(mid, q, s); this.segs.setMatrixAt(i, m);
        this.segs.setColorAt(i, col.setHex(this.colorFor(i + (this.region[i] !== this.region[i + 1] && this.region[i + 1] > 0 ? 1 : 0))));
      }
    }
    // the coil segment joining the guide to the first coil node
    for (const im of [this.nodes, this.segs]) { im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; }
    if (this.head) { this.head.position.copy(P[0]); const dir = P[0].clone().sub(P[1]).normalize(); this.head.quaternion.setFromUnitVectors(V(0, 0, 1), dir); }
  }
}

function arrowMesh(color) {
  const s = new THREE.Shape();
  const x0 = 0.9, x1 = -1.6, x2 = -2.6, w = 0.18, hw = 0.5;
  s.moveTo(x0, -w); s.lineTo(x1, -w); s.lineTo(x1, -hw); s.lineTo(x2, 0); s.lineTo(x1, hw); s.lineTo(x1, w); s.lineTo(x0, w); s.closePath();
  const inner = new THREE.Path(); const iw = w - 0.05, ihw = hw - 0.12;
  inner.moveTo(x0 - 0.05, -iw); inner.lineTo(x1 + 0.05, -iw); inner.lineTo(x1 + 0.05, -ihw); inner.lineTo(x2 + 0.16, 0); inner.lineTo(x1 + 0.05, ihw); inner.lineTo(x1 + 0.05, iw); inner.lineTo(x0 - 0.05, iw); inner.closePath();
  s.holes.push(inner);
  const m = new THREE.Mesh(new THREE.ShapeGeometry(s), new THREE.MeshStandardMaterial({ color, roughness: 0.5, emissive: color, emissiveIntensity: 0.12, side: THREE.DoubleSide }));
  m.rotation.x = -Math.PI / 2; m.position.set(0, 0.004, PLANE_Z); m.receiveShadow = true;
  return m;
}

/** Diagonal braid normal map for the rope. */
function braidTex() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 64; const g = c.getContext('2d');
  g.fillStyle = 'rgb(128,128,255)'; g.fillRect(0, 0, 64, 64);
  for (let i = -64; i < 128; i += 16) {
    const gr = g.createLinearGradient(i, 0, i + 16, 0); gr.addColorStop(0, 'rgb(70,128,255)'); gr.addColorStop(0.5, 'rgb(128,128,255)'); gr.addColorStop(1, 'rgb(190,128,255)');
    g.save(); g.transform(1, 0, 0.7, 1, 0, 0); g.fillStyle = gr; g.fillRect(i, 0, 16, 64); g.restore();
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 3); return t;
}
