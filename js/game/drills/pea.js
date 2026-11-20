// Pea Drop: pick peas from the ring and drop each one through the hole on top of the dome.
// Real rigid-body physics: peas are solid, the jaws are solid, the dome is a hollow shell with a throat.
import { THREE, Tool, Blob } from '../engine.js';
import { buildGrasper } from '../instruments.js';
import { domeHeight, ringDisk } from '../themes.js';
import { BaseDrill, V, rand } from './base.js';
import { physicsReady, PhysWorld, SolidInstrument, syncMesh, G, groups } from '../physics.js';
import { playSound, synth } from '../../audio.js';

const PEA_N = 10, RING_R = 1.1, HOLE_R = 0.28, OUTER_R = 0.85, CUP_H = 0.7, HALF = 0.0975, DISK_TOP = 0.024;
const OBJ_GROUPS = groups(G.OBJ, G.ENV | G.OBJ | G.JAW | G.HELD);

/** Low-poly bean hull points matching the visual bean shape. */
function beanHull(scale = 1) {
  const g = new THREE.SphereGeometry(0.13, 10, 7); const p = g.attributes.position; const pts = [];
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i) * 0.8, y = p.getY(i) * 0.68, z = p.getZ(i) * 1.22; const t = z / 0.16;
    x += 0.055 * t * t - 0.02; if (x < 0) x *= 1 - 0.18 * Math.max(0, 1 - t * t);
    pts.push(x * scale, y * scale, z * scale);
  }
  return pts;
}

export class PeaDrill extends BaseDrill {
  constructor(ctx) {
    super(ctx);
    this.target = PEA_N;
    const m = this.m, lv = this.level;
    this.ringC = V(lv === 'EXPERT' ? 0 : -1.8 * m, 0, 3.2);
    this.cupBase = V(2.0 * m, 0, 0.4);
    this.cupC = this.cupBase.clone();
    this.relocate = lv === 'ADVANCED' || lv === 'EXPERT';
    this.slide = lv === 'EXPERT';
    this.build();
  }
  build() {
    const env = this.env;
    this.plate({ size: 7.2, z: 0.8 });
    const ring = ringDisk(RING_R, env.circle, env.ring);
    ring.position.copy(this.ringC); this.root.add(ring);
    this.cup = env.cup(HOLE_R, OUTER_R, CUP_H); this.cup.position.copy(this.cupC); this.root.add(this.cup);
    this.peas = [];
    for (let i = 0; i < PEA_N; i++) {
      const mesh = env.pea(i, PEA_N);
      this.root.add(mesh);
      this.peas.push({ i, mesh, state: 'ring', touched: false, blob: new Blob(this.root, 0.36, 0.7), scale: mesh.scale.x });
    }
    this.layoutPeas(true);
    if (this.preview || !physicsReady()) return;
    this.buildPhysics();
    const m = this.m;
    const inst = buildGrasper(this.instTheme.theme);
    this.port = V(-2.5 * m, 2.5, 4.5);
    this.tool = new Tool(this.root, inst, {
      port: this.port, start: V(this.ringC.x + 0.5 * m, 0.9, this.ringC.z - 0.6), minLen: 1.2, maxLen: 7.6, maxCone: 1.35,
      roll: Math.PI / 2, jaw: 0.55, maxJaw: 0.65, bounds: { minX: -3.5, maxX: 3.5, minY: 0, maxY: 3, minZ: -2.7, maxZ: 4.3 },
    });
    this.tool.floor = (x, z) => this.surface(x, z, true);
    this.tools = [this.tool];
    this.solid = new SolidInstrument(this.pw, this.tool, { assist: this.level === 'BEGINNER' ? 0.12 : 0.25 });
  }
  buildPhysics() {
    const pw = this.pw = new PhysWorld({ gravity: -12 });
    const R = pw.R;
    const env = pw.fixed();
    pw.collider(R.ColliderDesc.cuboid(3.6, 0.15, 3.6).setTranslation(0, -0.15, 0.8), env, { friction: 0.8 });
    pw.collider(R.ColliderDesc.cylinder(DISK_TOP / 2, RING_R + 0.02).setTranslation(this.ringC.x, DISK_TOP / 2, this.ringC.z), env, { friction: 1.0 });
    const lip = new THREE.LatheGeometry([new THREE.Vector2(RING_R - 0.01, 0), new THREE.Vector2(RING_R + 0.02, 0.07), new THREE.Vector2(RING_R + 0.08, 0)], 48);
    lip.translate(this.ringC.x, 0, this.ringC.z); pw.trimesh(lip, env, { friction: 0.8 });
    // dome: hollow shell + throat on one kinematic body (it slides on Expert)
    this.cupBody = pw.kinematic(this.cupC);
    const prof = [new THREE.Vector2(HOLE_R - 0.02, 0.02), new THREE.Vector2(HOLE_R - 0.02, CUP_H), new THREE.Vector2(HOLE_R + 0.01, CUP_H + 0.012)];
    for (let i = 0; i <= 20; i++) { const d = HOLE_R + (OUTER_R - HOLE_R) * (i / 20); prof.push(new THREE.Vector2(d, domeHeight(d, HOLE_R, OUTER_R, CUP_H))); }
    pw.trimesh(new THREE.LatheGeometry(prof, 40), this.cupBody, { friction: 0.25 });
    this.sensor = pw.collider(R.ColliderDesc.cylinder(0.05, HOLE_R - 0.05).setTranslation(0, 0.25, 0), this.cupBody, { sensor: true, events: true });
    pw.onSensor = (a, b, started) => {
      if (!started) return;
      const other = a === this.sensor.handle ? b : b === this.sensor.handle ? a : null; if (other === null) return;
      const p = this.peas.find((q) => q.collider?.handle === other); if (p && p.state !== 'in') this.scored(p);
    };
    for (const p of this.peas) this.makeBody(p);
  }
  makeBody(p) {
    const pw = this.pw;
    p.body = pw.dynamic(p.mesh.position, { linDamp: 0.2, angDamp: 1.2 });
    const q = p.mesh.quaternion; p.body.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }, true);
    p.collider = pw.hull(beanHull(p.scale), p.body, { friction: 0.9, restitution: 0.05, density: 1.2, groups: OBJ_GROUPS, events: true });
    p.groups = OBJ_GROUPS;
    p.grabbable = () => p.state !== 'in';
    p.onGrab = () => { p.state = 'held'; p.touched = true; };
    p.onRelease = () => { p.state = 'loose'; p.releasedAt = this.t; };
  }
  layoutPeas(initial = false) {
    const used = [];
    for (const p of this.peas) {
      p.state = 'ring'; p.touched = false;
      const pos = this.randomRingSpot(used); used.push(pos);
      p.mesh.visible = true; p.mesh.position.copy(pos); p.mesh.rotation.set(0, rand(0, Math.PI * 2), 0);
      p.blob.set(pos.x, pos.z, DISK_TOP, 0);
      if (!initial && p.body) this.placeBody(p, pos);
    }
  }
  placeBody(p, pos) {
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rand(0, Math.PI * 2), 0));
    if (p.body.bodyType() !== this.pw.R.RigidBodyType.Dynamic) p.body.setBodyType(this.pw.R.RigidBodyType.Dynamic, true);
    p.collider.setEnabled(true); p.collider.setCollisionGroups(OBJ_GROUPS);
    p.body.setTranslation({ x: pos.x, y: pos.y + 0.02, z: pos.z }, true); p.body.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }, true);
    p.body.setLinvel({ x: 0, y: 0, z: 0 }, true); p.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    p.mesh.visible = true;
  }
  randomRingSpot(avoid = []) {
    for (let k = 0; k < 80; k++) {
      const a = rand(0, Math.PI * 2), r = Math.sqrt(Math.random()) * (RING_R - 0.24);
      const p = V(this.ringC.x + Math.cos(a) * r, DISK_TOP + HALF, this.ringC.z + Math.sin(a) * r);
      if (avoid.every((q) => q.distanceTo(p) > 0.32)) return p;
    }
    return V(this.ringC.x, DISK_TOP + HALF + 0.2, this.ringC.z);
  }
  /** Height of the world under (x,z) for the instrument tip. */
  surface(x, z, forTool = false) {
    const dr = Math.hypot(x - this.ringC.x, z - this.ringC.z);
    let s = dr < RING_R + 0.03 ? DISK_TOP : 0;
    const dc = Math.hypot(x - this.cupC.x, z - this.cupC.z);
    if (dc < OUTER_R) {
      if (dc > HOLE_R) s = Math.max(s, domeHeight(dc, HOLE_R, OUTER_R, CUP_H));
      else if (forTool) s = Math.max(s, CUP_H - 0.25);
    }
    return s;
  }
  reset() {
    this.errors = 0; this.misses = 0; this.success = 0; this.complete = false; this.started = false; this.t = 0; this.relocT = 0;
    if (this.solid?.held) this.solid.release();
    this.cupC.copy(this.cupBase); this.cup.position.copy(this.cupC); this.cupBody?.setTranslation(this.cupC, true);
    this.layoutPeas();
    this.tool.reset();
  }
  scored(p) {
    // "Putting": pushing a pea into the hole with the grasper instead of dropping it. A pea you just let go
    // of that landed on the rim and got nudged in during your next try is still that same drop, not putting.
    if (this.started && (p.releasedAt === undefined || this.t - p.releasedAt > 6) && p.mesh.position.distanceTo(this.tool.tip) < 0.4) this.error('Putting — drop the pea in, don\'t push it', { force: true, pos: p.mesh.position.clone() });
    p.state = 'in'; p.mesh.visible = false; p.collider.setEnabled(false);
    this.success++;
    this.emit('enter', {});
    this.emit('success', { count: this.success, pos: V(this.cupC.x, CUP_H + 0.05, this.cupC.z) });
    if (this.success >= this.target) { this.complete = true; this.emit('complete'); }
  }
  miss(p) {
    if (this.started) { this.misses++; this.emit('miss', { pos: p.mesh.position.clone() }); }
    p.state = 'ring';
    this.placeBody(p, this.randomRingSpot(this.peas.filter((q) => q !== p && q.state === 'ring').map((q) => q.mesh.position)));
  }
  /** For the control assists: what can be grabbed, where it gets dropped, a safe cruising height. */
  assistInfo() {
    return { holding: !!this.solid.held, moveOver: 'Move over a pea first, then grab',
      targets: this.peas.filter((p) => p.state === 'ring').map((p) => ({ pos: p.mesh.position, y: p.mesh.position.y })) };
  }
  hints() {
    const t = this.tool; if (!t) return [];
    if (this.solid.held) {
      const dc = Math.hypot(t.tip.x - this.cupC.x, t.tip.z - this.cupC.z);
      return [dc < HOLE_R ? { pos: V(this.cupC.x, CUP_H + 0.03, this.cupC.z), ok: true, size: 1.7 } : null];
    }
    let best = null, bd = 0.34;
    for (const p of this.peas) { if (p.state === 'in') continue; const d = p.mesh.position.distanceTo(t.tip); if (d < bd) { bd = d; best = p; } }
    return [best ? { pos: best.mesh.position, ok: true, size: 1.1 } : null];
  }
  update(dt, inputs, sens) {
    this.tick(dt);
    const tool = this.tool, inp = inputs[0] || {};
    tool.input(inp, dt, sens);
    if (this.slide && this.started && !this.complete) this.cupC.x = 1.65 * Math.sin((this.t * Math.PI * 2) / 10);
    this.pw.step(dt, (h) => {
      tool.step(h);
      this.solid.sync();
      const ev = this.solid.update(h, !!inp.grip, this.peas);
      if (ev === 'grab') { synth('grab'); playSound('jawClose', { volume: 0.8, rate: 1.1 }); this.emit('grab', { obj: this.solid.held.mesh, pos: this.solid.held.mesh.position.clone() }); }
      if (ev === 'release') playSound('jawOpen', { volume: 0.7, rate: 0.9 });
      if (this.slide) this.cupBody.setNextKinematicTranslation({ x: this.cupC.x, y: 0, z: this.cupC.z });
    });
    this.cup.position.x = this.cupC.x;
    if (this.relocate && this.started && !this.complete) {
      this.relocT += dt;
      if (this.relocT > 3) {
        this.relocT = 0;
        const others = this.peas.filter((p) => p.state === 'ring').map((p) => p.mesh.position.clone());
        for (const p of this.peas) if (p.state === 'ring' && !p.touched) this.placeBody(p, this.randomRingSpot(others));
      }
    }
    for (const p of this.peas) {
      if (p.state === 'in') { p.blob.set(0, 0, 0, 0, false); continue; }
      syncMesh(p.body, p.mesh);
      const pos = p.mesh.position, sf = this.surface(pos.x, pos.z);
      p.blob.set(pos.x, pos.z, sf, pos.y - HALF - sf);
      if (pos.y < -1) { this.miss(p); continue; }
      if (p.state === 'loose') {
        const v = p.body.linvel();
        const dr = Math.hypot(pos.x - this.ringC.x, pos.z - this.ringC.z), dc = Math.hypot(pos.x - this.cupC.x, pos.z - this.cupC.z);
        if (Math.hypot(v.x, v.y, v.z) < 0.06 && pos.y < 0.3 && dc > OUTER_R) { if (dr < RING_R + 0.05) p.state = 'ring'; else this.miss(p); }
      }
    }
    this.contactErrors();
  }
  contactErrors() {
    // Top Gun rules: the error counter is wired to the bean receptacle and the grasper, so only touching
    // the dome/cup is an error. Touching the plate or the pea tray is fine.
    const tool = this.tool, tip = tool.tip;
    const dc = Math.hypot(tip.x - this.cupC.x, tip.z - this.cupC.z);
    this.touchError(tool, tool.contact && dc < OUTER_R + 0.05 && dc > HOLE_R - 0.02, 'Touched the cup');
  }
  get held() { return this.solid?.held || null; }
  dispose() { this.pw?.dispose(); }
}
