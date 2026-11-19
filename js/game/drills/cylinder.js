// Cylinder Transfer: lift each winged cylinder off its peg, hand it across the midline to the other
// grasper and drop it over the matching peg. Six forward, then six back.
import { THREE, Tool, brushedRough, roundedBox, Blob } from '../engine.js';
import { physicsReady, PhysWorld, SolidInstrument, G, groups } from '../physics.js';
import { buildGrasper } from '../instruments.js';
import { BaseDrill, V } from './base.js';
import { playSound, synth } from '../../audio.js';

const BLOCK = { w: 6.75, h: 0.225, d: 3.75, z: 0.8 };
const PEG_H = 0.6, PEG_R = 0.033, CYL_H = 0.42, CYL_R = 0.1125;
const TOP = BLOCK.h, PEG_TOP = TOP + PEG_H, REST_Y = TOP + CYL_H / 2;
const GRAB_RANGE = 0.28, PLACE_RANGE = 0.3;
const std = (c, m, r, e = {}) => new THREE.MeshStandardMaterial({ color: c, metalness: m, roughness: r, ...e });
const sh = (o) => { o.castShadow = true; o.receiveShadow = true; return o; };

export class CylinderDrill extends BaseDrill {
  constructor(ctx) {
    super(ctx);
    this.target = 12;
    const z = BLOCK.z;
    this.pegsL = [[-1.05, z - 1.05], [-2.25, z - 1.05], [-1.05, z], [-2.25, z], [-1.05, z + 1.05], [-2.25, z + 1.05]].map(([x, zz]) => V(x, 0, zz));
    // hexagon around (1.8, z), radius 1.05
    this.pegsR = [[0.891, z - 0.525], [1.8, z - 1.05], [0.891, z + 0.525], [2.709, z - 0.525], [1.8, z + 1.05], [2.709, z + 0.525]].map(([x, zz]) => V(x, 0, zz));
    this.seq = [];
    for (let i = 0; i < 6; i++) this.seq.push({ cyl: i, from: this.pegsL[i], to: this.pegsR[i], toName: `R${i + 1}`, pick: 'L' });
    for (let i = 5; i >= 0; i--) this.seq.push({ cyl: i, from: this.pegsR[i], to: this.pegsL[i], toName: `L${i + 1}`, pick: 'R' });
    this.build();
  }
  build() {
    const r = this.root;
    this.plate({ size: 9.6, depth: 7.4, z: 0.8 });
    const block = sh(new THREE.Mesh(roundedBox(BLOCK.w, BLOCK.h, BLOCK.d, 0.12), std(0x232428, 0.2, 0.62, { roughnessMap: brushedRough([2, 1]) })));
    block.position.set(0, BLOCK.h / 2, BLOCK.z); r.add(block);
    const screwM = std(0x9aa0a8, 1, 0.3);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const sc = sh(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.016, 20), screwM)); sc.position.set(sx * (BLOCK.w / 2 - 0.2), TOP + 0.006, BLOCK.z + sz * (BLOCK.d / 2 - 0.2)); r.add(sc); }
    // engraved side labels
    const lab = (txt, x) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.22), new THREE.MeshBasicMaterial({ map: labelTex(txt), transparent: true, opacity: 0.5, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.position.set(x, TOP + 0.003, BLOCK.z + BLOCK.d / 2 - 0.22); r.add(m); };
    lab('LEFT', -1.65); lab('RIGHT', 1.8);
    const pegMat = std(0xb7bcc4, 1, 0.22, { roughnessMap: brushedRough([1, 4]) }), washer = std(0xd8d8de, 0.6, 0.35);
    for (const p of [...this.pegsL, ...this.pegsR]) {
      const peg = sh(new THREE.Mesh(new THREE.CylinderGeometry(PEG_R, PEG_R, PEG_H, 14), pegMat)); peg.position.set(p.x, TOP + PEG_H / 2, p.z); r.add(peg);
      const cap = sh(new THREE.Mesh(new THREE.SphereGeometry(PEG_R, 12, 8), pegMat)); cap.position.set(p.x, PEG_TOP, p.z); r.add(cap);
      const w = sh(new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.02, 24), washer)); w.position.set(p.x, TOP + 0.01, p.z); r.add(w);
    }
    // highlight rings + midline
    const ring = (c) => { const m = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.025, 10, 40), new THREE.MeshBasicMaterial({ color: c, toneMapped: false, transparent: true, opacity: 0.9 })); m.rotation.x = Math.PI / 2; r.add(m); return m; };
    this.srcRing = ring(0x3dff7a); this.dstRing = ring(0x38d6f5);
    this.mid = new THREE.Mesh(new THREE.PlaneGeometry(0.06, BLOCK.d), new THREE.MeshBasicMaterial({ color: 0xff7f27, transparent: true, toneMapped: false }));
    this.mid.rotation.x = -Math.PI / 2; this.mid.position.set(0, TOP + 0.004, BLOCK.z); r.add(this.mid);
    // cylinders
    const gold = new THREE.MeshPhysicalMaterial({ color: 0xc8941a, metalness: 0.85, roughness: 0.36, clearcoat: 0.6, clearcoatRoughness: 0.25, roughnessMap: brushedRough([1, 2]) });
    const inner = std(0x111111, 0.2, 0.8);
    this.cyls = [];
    for (let i = 0; i < 6; i++) {
      const g = new THREE.Group();
      const body = sh(new THREE.Mesh(new THREE.CylinderGeometry(CYL_R, CYL_R, CYL_H, 28, 1, true), gold)); g.add(body);
      const top = sh(new THREE.Mesh(new THREE.RingGeometry(0.045, CYL_R, 28), gold)); top.rotation.x = -Math.PI / 2; top.position.y = CYL_H / 2; g.add(top);
      const hole = new THREE.Mesh(new THREE.CircleGeometry(0.045, 16), inner); hole.rotation.x = -Math.PI / 2; hole.position.y = CYL_H / 2 - 0.002; g.add(hole);
      const wings = [];
      for (const s of [-1, 1]) {
        // V-wings flare out toward each grasper (±X), 45° up
        const w = sh(new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.016, 0.12), gold));
        w.position.set(s * (CYL_R + 0.045), CYL_H / 2 + 0.05, 0); w.rotation.z = s * Math.PI / 4;
        g.add(w); wings.push(V(s * (CYL_R + 0.08), CYL_H / 2 + 0.085, 0));
      }
      const bevel = sh(new THREE.Mesh(new THREE.TorusGeometry(CYL_R - 0.004, 0.008, 8, 32), gold)); bevel.rotation.x = Math.PI / 2; bevel.position.y = CYL_H / 2; g.add(bevel);
      const bot = sh(new THREE.Mesh(new THREE.TorusGeometry(CYL_R - 0.004, 0.008, 8, 32), gold)); bot.rotation.x = Math.PI / 2; bot.position.y = -CYL_H / 2; g.add(bot);
      const label = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.08), new THREE.MeshBasicMaterial({ map: numberTex(i + 1), transparent: true }));
      label.position.set(0, 0, CYL_R + 0.002); g.add(label);
      r.add(g);
      this.cyls.push({ g, pos: V(), wings, peg: null, holder: null, offset: V(), anim: null, idx: i, blob: new Blob(r, 0.42, 0.6) });
    }
    this.resetCyls(true);
    if (this.preview || !physicsReady()) return;
    this.buildPhysics();
    const mk = (side) => {
      const s = side === 'L' ? -1 : 1;
      const inst = buildGrasper(this.instTheme?.theme || {}, { jawLength: 0.42, model: 'maryland' });
      const t = new Tool(r, inst, {
        port: V(4.7 * s, 1.7, 2.6), start: V(1.5 * s, 1.15, 1.7), minLen: 0.8, maxLen: 7, maxCone: 1.25, roll: 0, jaw: 0.85, maxJaw: 0.55,
        bounds: { minX: -3.6, maxX: 3.6, minY: 0, maxY: 2.6, minZ: -1.4, maxZ: 3.4 }, label: side,
      });
      t.floor = (x, z) => (Math.abs(x) < BLOCK.w / 2 && Math.abs(z - BLOCK.z) < BLOCK.d / 2 ? TOP : 0);
      t.side = side; t.holding = null;
      new SolidInstrument(this.pw, t, { assist: this.level === 'BEGINNER' ? 0.12 : 0.25 });
      return t;
    };
    this.L = mk('L'); this.R = mk('R');
    this.tools = [this.L, this.R];
    this.physicsGrip = true;
    this.i = 0; this.phase = 'pickup'; this.active = 'L';
  }
  buildPhysics() {
    const pw = this.pw = new PhysWorld({ gravity: -12 }); const R = pw.R;
    const env = pw.fixed();
    pw.collider(R.ColliderDesc.cuboid(4.8, 0.15, 3.7).setTranslation(0, -0.15, 0.8), env, { friction: 0.8 });
    pw.collider(R.ColliderDesc.cuboid(BLOCK.w / 2, BLOCK.h / 2, BLOCK.d / 2).setTranslation(0, BLOCK.h / 2, BLOCK.z), env, { friction: 0.7 });
    for (const p of [...this.pegsL, ...this.pegsR]) pw.collider(R.ColliderDesc.cylinder(PEG_H / 2 + 0.02, PEG_R).setTranslation(p.x, TOP + PEG_H / 2, p.z), env, { friction: 0.15 });
    const OBJ = groups(G.OBJ, G.ENV | G.OBJ | G.JAW | G.HELD);
    for (const c of this.cyls) {
      c.body = pw.dynamic(c.pos, { linDamp: 0.3, angDamp: 1.5 });
      c.colliders = [];
      // hollow tube: 10 staves around a hole wider than the peg
      const rIn = 0.052, rOut = CYL_R, rMid = (rIn + rOut) / 2, n = 10;
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2, q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -a);
        c.colliders.push(pw.collider(R.ColliderDesc.cuboid((rOut - rIn) / 2, CYL_H / 2, rMid * Math.sin(Math.PI / n) * 1.08).setTranslation(Math.cos(a) * rMid, 0, Math.sin(a) * rMid).setRotation(q), c.body, { friction: 0.6, density: 1.4, groups: OBJ }));
      }
      for (const s of [-1, 1]) {
        const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), s * Math.PI / 4);
        c.colliders.push(pw.collider(R.ColliderDesc.cuboid(0.085, 0.012, 0.06).setTranslation(s * (CYL_R + 0.045), CYL_H / 2 + 0.05, 0).setRotation(q), c.body, { friction: 1.0, density: 0.6, groups: OBJ }));
      }
      c.groups = OBJ; c.mesh = c.g;
      // grab helper measures to the wings (what you actually pinch), forgiving on Beginner
      c.nearDist = (tip) => Math.min(...this.wingWorld(c).map((w) => w.distanceTo(tip)));
      c.nearR = this.level === 'BEGINNER' ? 0.2 : this.level === 'INTERMEDIATE' ? 0.16 : 0.12;
      c.grabbable = (tool) => this.canGrab(tool, c);
      c.constrain = (pos, quat) => {
        if (!c.peg) return;
        if (pos.y - CYL_H / 2 < PEG_TOP - 0.01) { pos.x = c.peg.x; pos.z = c.peg.z; pos.y = Math.max(pos.y, REST_Y); quat.identity(); }
        else c.peg = null; // lifted clear of the peg
        if (c.peg && c.holder && Math.hypot(c.holder.target.x - c.peg.x, c.holder.target.z - c.peg.z) > 0.3) this.emit('tip', { text: 'Lift it straight up off the peg first' });
      };
    }
  }
  resetCyls(initial = false) {
    this.cyls.forEach((c, i) => {
      c.peg = this.pegsL[i]; c.pos.set(c.peg.x, REST_Y, c.peg.z); c.holder = null; c.anim = null; c.placing = 0;
      c.g.position.copy(c.pos); c.g.quaternion.identity(); c.blob.set(c.pos.x, c.pos.z, TOP, 0);
      if (!initial && c.body) this.putOnPeg(c, c.peg, REST_Y);
    });
  }
  putOnPeg(c, peg, y) {
    if (c.body.bodyType() !== this.pw.R.RigidBodyType.Dynamic) c.body.setBodyType(this.pw.R.RigidBodyType.Dynamic, true);
    for (const k of c.colliders) k.setCollisionGroups(c.groups);
    c.body.setTranslation({ x: peg.x, y, z: peg.z }, true); c.body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
    c.body.setLinvel({ x: 0, y: 0, z: 0 }, true); c.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    c.peg = peg;
  }
  reset() {
    this.errors = 0; this.success = 0; this.complete = false; this.started = false; this.t = 0;
    for (const t of this.tools) { t.solid.release(); t.reset(); t.holding = null; }
    this.resetCyls(); this.i = 0; this.phase = 'pickup'; this.active = 'L';
  }
  get step() { return this.seq[Math.min(this.i, this.seq.length - 1)]; }
  activeIndex() { return this.active === 'R' ? 1 : 0; }
  get dir() { return this.i < 6 ? 'Forward' : 'Reverse'; }
  other(side) { return side === 'L' ? 'R' : 'L'; }
  tool(side) { return side === 'L' ? this.L : this.R; }
  status() {
    if (this.complete) return 'All transfers complete';
    const st = this.step, n = st.cyl + 1, picker = st.pick === 'L' ? 'left' : 'right', recv = st.pick === 'L' ? 'right' : 'left';
    if (this.phase === 'pickup') return `Pick up Cylinder ${n} with the ${picker} grasper`;
    if (this.phase === 'carry') return 'Carry it across the center line';
    if (this.phase === 'transfer') return `Grab the cylinder with the ${recv} grasper`;
    return `Place on Peg ${st.toName}`;
  }
  hud() { return { errors: this.errors, reps: this.success, target: 12, extra: this.dir }; }
  wingWorld(c) { return c.wings.map((w) => w.clone().applyQuaternion(c.g.quaternion).add(c.pos)); }
  /** The rules, as a grab permission: right cylinder, right grasper, right moment. */
  canGrab(tool, c) {
    if (c.anim || c.placing) return false;
    const st = this.step;
    if (c.idx !== st.cyl) return false;
    if (this.phase === 'pickup') return tool.side === st.pick && !c.holder;
    if (this.phase === 'transfer') return tool.side !== st.pick && !!c.holder && c.holder !== tool;
    return false;
  }
  onGrab(tool) {
    const c = tool.solid.held; c.holder = tool; tool.holding = c;
    synth('grab'); playSound('jawClose', { volume: 0.8 }); this.emit('grab', { obj: c.g, pos: c.pos.clone() });
    if (this.phase === 'pickup') { this.phase = 'carry'; if (!this.started) this.emit('start'); }
    else if (this.phase === 'transfer') {
      const giver = this.tool(this.step.pick); giver.solid.held = null; giver.holding = null; giver.jawT = 0.85; giver._blockedOnce = true; // hand-off: giver lets go
      c.body.setBodyType(this.pw.R.RigidBodyType.KinematicPositionBased, true);
      this.phase = 'place'; this.emit('handoff');
    }
  }
  onRelease(tool, c) {
    tool.holding = null; playSound('jawOpen', { volume: 0.6 });
    if (!c) return;
    c.holder = null;
    const st = this.step;
    const dTo = Math.hypot(c.pos.x - st.to.x, c.pos.z - st.to.z);
    if (this.phase === 'place' && dTo < PLACE_RANGE && c.pos.y - CYL_H / 2 > PEG_TOP - 0.25) {
      // line it up over the peg and let gravity slide it down
      c.body.setTranslation({ x: st.to.x, y: Math.max(c.pos.y, PEG_TOP + CYL_H / 2 + 0.02), z: st.to.z }, true);
      c.body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true); c.body.setLinvel({ x: 0, y: -0.5, z: 0 }, true); c.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
      c.placing = 1; c.peg = st.to;
      return;
    }
    this.error(this.phase === 'place' ? 'Missed the peg' : 'Dropped the cylinder', { pos: c.pos.clone(), tool });
    c.anim = { kind: 'drop', t: 0 };
  }
  update(dt, inputs, sens) {
    this.tick(dt);
    const act = this.tool(this.active === 'L' ? 'L' : 'R');
    act.input(inputs[act.side === 'L' ? 0 : 1] || {}, dt, sens);
    this.pw.step(dt, (h) => {
      for (const t of this.tools) {
        const grip = !!(inputs[t.side === 'L' ? 0 : 1] || {}).grip;
        t.step(h); t.solid.sync();
        const before = t.solid.held;
        const ev = t.solid.update(h, grip, this.cyls);
        if (ev === 'grab') this.onGrab(t);
        if (ev === 'release') this.onRelease(t, before);
        // grabbing something the rules don't allow is a mistake (once per squeeze)
        if (grip && t.solid.blocked && !t._blockedOnce && !t.solid.held) { t._blockedOnce = true; const b = t.solid.blocked; this.error(b.idx !== this.step.cyl ? `Wrong cylinder — Cylinder ${this.step.cyl + 1} is next` : 'Wrong grasper for this step', { tool: t }); }
        if (!grip) t._blockedOnce = false;
      }
    });
    for (const t of this.tools) this.touchError(t, t.contact && t === act, 'Touched the board');
    // sync visuals + placement / drop rules
    for (const c of this.cyls) {
      if (c.anim?.kind === 'return') {
        c.anim.t += dt / 0.6; const k = Math.min(1, c.anim.t), e = k * k * (3 - 2 * k);
        c.pos.lerpVectors(c.anim.from, c.anim.to, e); c.pos.y += Math.sin(Math.PI * k) * 0.8;
        c.body.setNextKinematicTranslation({ x: c.pos.x, y: c.pos.y, z: c.pos.z });
        if (k >= 1) { c.anim = null; this.putOnPeg(c, this.step.from, REST_Y + 0.02); this.phase = 'pickup'; this.active = this.step.pick; }
      } else {
        const p = c.body.translation(), q = c.body.rotation();
        c.pos.set(p.x, p.y, p.z); c.g.quaternion.set(q.x, q.y, q.z, q.w);
      }
      c.g.position.copy(c.pos);
      const fl = Math.abs(c.pos.x) < BLOCK.w / 2 && Math.abs(c.pos.z - BLOCK.z) < BLOCK.d / 2 ? TOP : 0;
      c.blob.set(c.pos.x, c.pos.z, fl, c.pos.y - CYL_H / 2 - fl);
      if (c.placing) {
        c.placing += dt;
        if (c.pos.y < REST_Y + 0.03 || c.placing > 2.5) { c.placing = 0; this.putOnPeg(c, this.step.to, REST_Y); this.placed(); }
      }
      if (c.anim?.kind === 'drop') {
        c.anim.t += dt;
        if (c.anim.t > 1.0) {
          c.body.setBodyType(this.pw.R.RigidBodyType.KinematicPositionBased, true);
          c.anim = { kind: 'return', from: c.pos.clone(), to: V(this.step.from.x, REST_Y + 0.02, this.step.from.z), t: 0 };
        }
      }
    }
    // phase transitions
    const st = this.step;
    if (this.phase === 'carry') {
      const c = this.cyls[st.cyl], sgn = st.pick === 'L' ? 1 : -1;
      if (c.holder && c.pos.x * sgn > 0.05) { this.phase = 'transfer'; this.active = this.other(st.pick); synth('coin'); this.emit('midline'); }
    }
    if (this.phase === 'pickup') this.active = st.pick;
    const blink = 0.5 + 0.5 * Math.sin(this.t * 8);
    this.mid.visible = this.phase === 'carry' && !this.complete;
    this.mid.material.opacity = 0.35 + blink * 0.6;
    this.srcRing.visible = this.phase === 'pickup' && !this.complete; this.srcRing.position.set(st.from.x, TOP + 0.02, st.from.z);
    this.dstRing.visible = !this.complete; this.dstRing.position.set(st.to.x, TOP + 0.02, st.to.z);
    this.dstRing.material.opacity = this.phase === 'place' ? 0.5 + blink * 0.5 : 0.45;
    this.srcRing.material.opacity = 0.55 + blink * 0.45;
  }
  /** For the control assists (the active grasper): wings to grab, the pass zone, the peg to land on. */
  assistInfo(i) {
    const t = this.tools[i], st = this.step, c = this.cyls[st.cyl], holding = !!t.solid.held;
    const info = { cruise: 1.6, holding, moveOver: `Move over Cylinder ${st.cyl + 1}'s wing first`, targets: [], drops: [] };
    if (!holding && (this.phase === 'pickup' || this.phase === 'transfer')) info.targets = this.wingWorld(c).map((w) => ({ pos: w, y: w.y }));
    if (holding && this.phase === 'carry') info.drops = [{ x: st.pick === 'L' ? 0.4 : -0.4, z: 0.8, y: 1.6, r: 1.1 }];
    if (holding && this.phase === 'place') { const off = c.pos.clone().sub(t.tip); info.drops = [{ x: st.to.x - off.x, z: st.to.z - off.z, y: 1.25, r: 0.9 }]; }
    return info;
  }
  hints() {
    if (!this.tools.length || this.complete) return [null, null];
    const st = this.step;
    return this.tools.map((t) => {
      const active = t === this.tool(this.active);
      if (t.solid.held) {
        if (this.phase !== 'place' || !active) return null;
        const c = t.solid.held, d = Math.hypot(c.pos.x - st.to.x, c.pos.z - st.to.z);
        return d < PLACE_RANGE * 1.6 ? { pos: V(st.to.x, PEG_TOP + 0.05, st.to.z), ok: d < PLACE_RANGE, size: 1.2 } : null;
      }
      if (!active) return null;
      let best = null, bd = GRAB_RANGE, wp = null;
      for (const c of this.cyls) { if (c.anim) continue; for (const w of this.wingWorld(c)) { const d = w.distanceTo(t.tip); if (d < bd) { bd = d; best = c; wp = w; } } }
      if (!best) return null;
      return { pos: wp, ok: this.canGrab(t, best), size: 0.8 };
    });
  }
  placed() {
    this.success++;
    this.emit('success', { count: this.success, pos: V(this.step.to.x, PEG_TOP, this.step.to.z) });
    if (this.success >= 12) { this.complete = true; this.emit('complete'); return; }
    this.i++; this.phase = 'pickup'; this.active = this.step.pick;
    if (this.i === 6) this.emit('reverse');
  }
  dispose() { this.pw?.dispose(); }
}

const numCache = {};
function numberTex(n) {
  if (numCache[n]) return numCache[n];
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  g.fillStyle = 'rgba(0,0,0,0.75)'; g.beginPath(); g.arc(32, 32, 28, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#fff'; g.font = '38px Bungee, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(n), 32, 34);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; numCache[n] = t; return t;
}

function labelTex(txt) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64; const g = c.getContext('2d');
  g.fillStyle = '#c8ccd2'; g.font = '34px Bungee, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.letterSpacing = '8px'; g.fillText(txt, 128, 34);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
