// Triangle Transfer: thread the hook through the loop, lift, carry and set the object in the target.
// Real physics: the hook is a solid curved wire, the triangle a solid body with a real ring on top.
// Catching, swinging and slipping off all come from contact, not scripted states.
import { THREE, Tool, chevronTex } from '../engine.js';
import { buildHook } from '../instruments.js';
import { TRI, ringDisk } from '../themes.js';
import { BaseDrill, V, rand } from './base.js';
import { physicsReady, PhysWorld, G, groups } from '../physics.js';
import { playSound, synth } from '../../audio.js';

const SRC_R = 0.95, TGT_R = 1.0;
const LOOP_C = new THREE.Vector3(0, TRI.H + 0.12 + TRI.LOOP_R * 0.25, 0);
const UPV = new THREE.Vector3(0, 1, 0);
const REST_TOP = TRI.H + 0.12 + TRI.LOOP_R * 0.25 + TRI.LOOP_R - TRI.LOOP_TUBE; // loop's inner top when the triangle stands on the plate
const _q2 = new THREE.Quaternion(), _n = new THREE.Vector3(), _w = new THREE.Vector3(), _a = new THREE.Vector3();
const _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _m = new THREE.Matrix4();
const qY = (dir) => new THREE.Quaternion().setFromUnitVectors(UPV, dir.clone().normalize());
const plain = (q) => ({ x: q.x, y: q.y, z: q.z, w: q.w });

export class TriangleDrill extends BaseDrill {
  constructor(ctx) {
    super(ctx);
    this.target = 5;
    this.build();
  }
  pickLayout() {
    const m = this.m, lv = this.level;
    const inPlate = (p) => Math.abs(p.x) < 2.6 && p.z > -1.9 && p.z < 3.5;
    if (lv === 'BEGINNER' || lv === 'INTERMEDIATE') { this.src = V(1.6 * m, 0, 3.0); this.tgt = V(-2.2 * m, 0, 0.3); return; }
    if (lv === 'ADVANCED') {
      this.tgt = V(0, 0, 0.3);
      for (let k = 0; k < 80; k++) { const a = rand(0, Math.PI * 2), d = rand(2.8, 4.0); const p = V(Math.cos(a) * d, 0, 0.3 + Math.sin(a) * d); if (inPlate(p)) { this.src = p; return; } }
      this.src = V(2.4 * m, 0, 2.6); return;
    }
    for (let k = 0; k < 200; k++) {
      const t = V(rand(-1.8, 1.8), 0, rand(-0.6, 1.2)); const a = rand(0, Math.PI * 2), d = rand(2.8, 3.3);
      const s = V(t.x + Math.cos(a) * d, 0, t.z + Math.sin(a) * d);
      if (inPlate(s) && inPlate(t)) { this.tgt = t; this.src = s; return; }
    }
    this.tgt = V(-1, 0, 0.3); this.src = V(1.8, 0, 2.4);
  }
  build() {
    const env = this.env;
    this.plate({ size: 7.2, z: 0.8 });
    this.pickLayout();
    this.srcMesh = env.id === 'default' ? ringDisk(SRC_R, 0x4cc9ff, 0x0b1430) /* sky-blue launch circle, navy rim */ : ringDisk(SRC_R, env.circle, env.ring);
    this.root.add(this.srcMesh);
    this.tgtMesh = env.end(TGT_R); this.root.add(this.tgtMesh);
    this.obj = env.tri(); this.root.add(this.obj);
    this.obj.position.copy(this.src);
    const tex = chevronTex();
    this.path = new THREE.Group();
    this.pathBar = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.22), new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.9, depthWrite: false, toneMapped: false }));
    this.pathBar.rotation.x = -Math.PI / 2; this.pathBar.position.y = 0.03;
    this.path.add(this.pathBar); this.root.add(this.path);
    this.placeCircles();
    if (this.preview || !physicsReady()) return;
    const m = this.m;
    const inst = buildHook(this.instTheme.theme);
    this.port = V(2.7 * m, 2.6, 4.7);
    this.tool = new Tool(this.root, inst, {
      port: this.port, start: V(this.src.x - 0.3 * m, 1.1, this.src.z + 0.5), minLen: 1.0, maxLen: 8, maxCone: 1.4, roll: 0,
      bounds: { minX: -3.5, maxX: 3.5, minY: 0, maxY: 3, minZ: -2.7, maxZ: 4.3 },
    });
    this.tool.floor = () => 0;
    this.tools = [this.tool];
    this.buildPhysics();
    this.resetObject();
  }
  buildPhysics() {
    const pw = this.pw = new PhysWorld({ gravity: -12 }); const R = pw.R;
    const env = pw.fixed();
    pw.collider(R.ColliderDesc.cuboid(3.6, 1.0, 3.6).setTranslation(0, -1.0, 0.8), env, { friction: 0.9 }); // thick so a pressing hook can't push things through
    // the hook: a chain of capsules along its curve, moved by code each step
    this.hookBody = pw.kinematic();
    const HOOK = groups(G.JAW, G.OBJ);
    const sm = this.tool.inst.samples; this.hookCols = [];
    { const ca = this.tool.inst.catchLocal; let bi = 0, bd = Infinity; sm.forEach((p, i) => { const d = p.distanceTo(ca); if (d < bd) { bd = d; bi = i; } });
      this.wireLocal = sm[Math.min(sm.length - 1, bi + 1)].clone().sub(sm[Math.max(0, bi - 1)]).normalize(); } // wire direction at the bend
    for (let i = 0; i < sm.length - 1; i++) {
      const a = sm[i], b = sm[i + 1], d = b.clone().sub(a), len = d.length(); if (len < 1e-4) continue;
      const mid = a.clone().add(b).multiplyScalar(0.5);
      this.hookCols.push(pw.collider(R.ColliderDesc.capsule(len / 2, 0.026).setTranslation(mid.x, mid.y, mid.z).setRotation(plain(qY(d))), this.hookBody, { friction: 0.5, groups: HOOK }));
    }
    // the triangle: heavy prism body + a ring of capsules for the loop
    const OBJ = groups(G.OBJ, G.ENV | G.OBJ | G.JAW);
    this.body = pw.dynamic(this.src, { linDamp: 0.25, angDamp: 0.9, canSleep: false }); // must follow the moving hook
    const W = TRI.W / 2, D = TRI.D / 2;
    pw.hull([-W, 0, -D, W, 0, -D, 0, TRI.H, -D, -W, 0, D, W, 0, D, 0, TRI.H, D], this.body, { friction: 0.9, density: 9, groups: OBJ }); // heavy steel: settles instead of jiggling
    pw.collider(R.ColliderDesc.cuboid(0.03, 0.09, 0.03).setTranslation(0, TRI.H + 0.04, 0), this.body, { density: 0.5, groups: OBJ });
    this.OBJ = OBJ; this.OBJ_NOHOOK = groups(G.OBJ, G.ENV | G.OBJ);
    this.loopCols = [];
    const n = 14, rr = TRI.LOOP_R;
    for (let k = 0; k < n; k++) {
      const a0 = (k / n) * Math.PI * 2, a1 = ((k + 1) / n) * Math.PI * 2;
      const p0 = new THREE.Vector3(Math.cos(a0) * rr, Math.sin(a0) * rr, 0), p1 = new THREE.Vector3(Math.cos(a1) * rr, Math.sin(a1) * rr, 0);
      const d = p1.clone().sub(p0), mid = p0.clone().add(p1).multiplyScalar(0.5).add(LOOP_C);
      this.loopCols.push(pw.collider(R.ColliderDesc.capsule(d.length() / 2, TRI.LOOP_TUBE + 0.006).setTranslation(mid.x, mid.y, mid.z).setRotation(plain(qY(d))), this.body, { friction: 0.6, density: 0.4, groups: OBJ }));
    }
  }
  placeCircles() {
    this.srcMesh.position.copy(this.src);
    this.tgtMesh.position.copy(this.tgt);
    const d = this.tgt.clone().sub(this.src); d.y = 0;
    this.path.position.copy(this.src);
    this.path.rotation.y = -Math.atan2(d.z, d.x);
    this.pathLen = d.length();
  }
  /** Hook the loop: a real pivot joint from the hook's bend to the inside top of the ring. */
  attach() {
    const R = this.pw.R, a = this.tool.inst.catchLocal, top = LOOP_C.clone().add(V(0, TRI.LOOP_R - TRI.LOOP_TUBE, 0));
    this.joint = this.pw.w.createImpulseJoint(R.JointData.spherical({ x: a.x, y: a.y, z: a.z }, { x: top.x, y: top.y, z: top.z }), this.hookBody, this.body, true);
    for (let i = 0; i < this.body.numColliders(); i++) this.body.collider(i).setCollisionGroups(this.OBJ_NOHOOK); // a kinematic hook shoving the prism would fling it
    this.body.setAngularDamping(4); this.body.setLinearDamping(1.2); // hanging steel swings slowly and settles
    this.body.wakeUp();
    synth('grab'); this.emit('grab', { obj: this.obj, pos: this.loopWorld().c });
    if (!this.started) this.emit('start');
  }
  detach(slip = false) {
    if (!this.joint) return;
    this.pw.w.removeImpulseJoint(this.joint, true); this.joint = null;
    for (let i = 0; i < this.body.numColliders(); i++) this.body.collider(i).setCollisionGroups(this.OBJ);
    this.body.setAngularDamping(0.9); this.body.setLinearDamping(0.25);
    if (slip) { playSound('jawOpen', { volume: 0.5 }); this.emit('slip'); }
  }
  resetObject() {
    this.detach();
    this.lifted = false; this.hookedT = 0; this.settleT = 0; this.respawnT = 0.4; this.dragDist = 0; this.dragFlag = false;
    if (!this.body) { this.obj.position.copy(this.src); this.obj.quaternion.identity(); return; }
    const yaw = this.level === 'ADVANCED' || this.level === 'EXPERT' ? Math.PI / 2 * this.m : 0; // edge-on loop: anticipate the opening
    const q0 = new THREE.Quaternion().setFromAxisAngle(UPV, yaw);
    this.body.setTranslation({ x: this.src.x, y: 0.02, z: this.src.z }, true); this.body.setRotation(plain(q0), true);
    this.body.setLinvel({ x: 0, y: 0, z: 0 }, true); this.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    this.syncObj();
  }
  reset() {
    this.errors = 0; this.misses = 0; this.success = 0; this.complete = false; this.started = false; this.t = 0; this.pending = null;
    this.pickLayout(); this.placeCircles(); this.resetObject();
    this.tool.reset();
  }
  syncObj() {
    const p = this.body.translation(), r = this.body.rotation();
    this.O = V(p.x, p.y, p.z); this.q = new THREE.Quaternion(r.x, r.y, r.z, r.w);
    this.obj.position.copy(this.O); this.obj.quaternion.copy(this.q);
  }
  loopWorld() { return { c: LOOP_C.clone().applyQuaternion(this.q || _q.identity()).add(this.O || this.src), n: V(0, 0, 1).applyQuaternion(this.q || _q.identity()) }; }
  /** While hooked the wire runs through the ring: the loop may swing around the wire and tilt a little,
   *  but it can't turn edge-on to the wire (that would pass the solid ring through the hook). */
  keepThreaded(hookQ, h) {
    const r = this.body.rotation(), q = _q2.set(r.x, r.y, r.z, r.w);
    const n = _n.set(0, 0, 1).applyQuaternion(q), w = _w.copy(this.wireLocal).applyQuaternion(hookQ);
    if (n.dot(w) < 0) w.negate();
    const ang = Math.acos(Math.min(1, n.dot(w))), MAX = 0.5;
    if (ang <= MAX) return;
    const axis = _a.crossVectors(n, w); if (axis.lengthSq() < 1e-8) return; axis.normalize();
    const av = this.body.angvel(), cur = av.x * axis.x + av.y * axis.y + av.z * axis.z;
    const want = Math.min(3, ((ang - MAX) / h) * 0.15); // ease it back, never a kick
    if (cur < want) { const k = want - cur; this.body.setAngvel({ x: av.x + axis.x * k, y: av.y + axis.y * k, z: av.z + axis.z * k }, true); }
  }
  hookTouching() { return this.loopCols.some((c) => this.hookCols.some((k) => this.pw.touching(c, k))); }
  update(dt, inputs, sens) {
    this.tick(dt);
    const tool = this.tool, inp = inputs[0] || {};
    if (this.joint && inp.rot) inp.rot *= 0.4; // turning with the triangle hanging on: slow and steady
    tool.input(inp, dt, sens);
    this.pw.step(dt, (h) => {
      tool.step(h);
      tool.inst.group.updateMatrixWorld(true);
      tool.inst.group.matrixWorld.decompose(_v, _q, new THREE.Vector3());
      this.hookBody.setNextKinematicTranslation({ x: _v.x, y: _v.y, z: _v.z }); this.hookBody.setNextKinematicRotation(plain(_q));
      if (this.joint) this.keepThreaded(_q, h);
    });
    this.syncObj();
    this.touchError(tool, tool.contact, 'Touched the template');
    if (this.respawnT > 0) { this.respawnT -= dt; this.obj.scale.setScalar(Math.max(0.01, 1 - Math.max(0, this.respawnT) / 0.4)); } else this.obj.scale.setScalar(1);
    // catching: the hook's bend inside the ring, rising → pivot joint (physics does the swinging)
    const H = tool.world(tool.inst.catchLocal), { c, n } = this.loopWorld();
    const hookUp = V(0, 1, 0).applyQuaternion(tool.inst.group.quaternion).y;
    if (!this.joint && this.respawnT <= 0 && !this.pending) {
      _v.copy(H).sub(c); const dn = _v.dot(n); const inPlane = _v.clone().addScaledVector(n, -dn).length();
      const tol = { BEGINNER: 0.06, INTERMEDIATE: 0.045, ADVANCED: 0.035, EXPERT: 0.03 }[this.level] ?? 0.04;
      if (Math.abs(dn) < 0.09 + tol && inPlane < TRI.LOOP_R - TRI.LOOP_TUBE + tol && H.y > c.y + 0.03 && tool.vel.y > -0.3 && hookUp > 0.2) this.attach();
    }
    if (this.joint) {
      const up = UPV.clone().applyQuaternion(this.q), swing = up.angleTo(UPV);
      const topY = LOOP_C.clone().add(V(0, TRI.LOOP_R - TRI.LOOP_TUBE, 0)).applyQuaternion(this.q).add(this.O).y;
      if (this.O.y > 0.25) this.lifted = true;
      // "Dragging": captured, but pulled along the template instead of lifted
      if (this.O.y < 0.03) { const v0 = this.body.linvel(); this.dragDist += Math.hypot(v0.x, v0.z) * dt; if (this.dragDist > 0.6 && !this.dragFlag) { this.dragFlag = true; this.error('Dragging — lift it, don\'t drag it', { force: true, pos: this.O.clone() }); } }
      if (tool.speed() > 5 || swing > 1.25) { this.detach(true); if (this.started) this.error('Earthquake — no shaking it off', { force: true, pos: this.O.clone() }); }
      else if (hookUp < -0.3) this.detach(true);                                                   // tipped the hook: it slides off
      else if (this.O.y < 0.05 && H.y < REST_TOP - 0.06) this.detach(false);                      // set down, hook keeps lowering: lets go
    }
    const v = this.body.linvel(), speed = Math.hypot(v.x, v.y, v.z);
    if (!this.complete && !this.lifted && !this.joint && !this.pending && this.respawnT <= 0 && this.started && Math.hypot(this.O.x - this.src.x, this.O.z - this.src.z) > SRC_R + (this.level === 'BEGINNER' ? 0.35 : 0.1)) {
      this.error('Knocked out of the launch circle', { force: true, pos: this.O.clone() });
      this.pending = { t: 0.4, fn: () => this.resetObject() };
    }
    // squeezed into the plate by the hook: pop it back onto the surface
    if (this.O.y < -0.04 && this.joint) this.detach(false);
    if (this.O.y < -0.04 && Math.abs(this.O.x) < 3.5 && this.O.z > -2.7 && this.O.z < 4.3) { const p = this.body.translation(); this.body.setTranslation({ x: p.x, y: 0.02, z: p.z }, true); this.body.setLinvel({ x: 0, y: 0, z: 0 }, true); }
    if (this.O.y < -1) { this.error('Fell off the board', { force: true, pos: this.src.clone() }); this.resetObject(); }
    if (this.pending) { this.pending.t -= dt; if (this.pending.t <= 0) { const f = this.pending.fn; this.pending = null; f(); } }
    else if (this.lifted && !this.joint && this.O.y < 0.08 && speed < 0.12) {
      this.settleT += dt;
      if (this.settleT > 0.25) this.settle();
    } else this.settleT = 0;
    // path cue + target pulse
    const showCue = !this.lifted && !this.joint && !this.complete && this.O.y < 0.1;
    this.path.visible = showCue;
    if (showCue) {
      const k = (this.t % 1.1) / 1.1;
      const len = Math.max(0.01, (this.pathLen - SRC_R - TGT_R) * k);
      this.pathBar.scale.set(len, 1, 1);
      this.pathBar.position.x = SRC_R + len / 2;
      this.pathBar.material.map.repeat.set(len * 1.8, 1);
      this.pathBar.material.opacity = 0.9 * (1 - k * 0.5);
    }
    const pulse = 0.5 + 0.5 * Math.sin(this.t * 5);
    this.tgtMesh.traverse((o) => { if (o.material?.emissive && o.material.emissiveIntensity !== undefined) o.material.emissiveIntensity = this.lifted ? 0.4 + pulse * 1.1 : 0.45; });
  }
  /** Coaching hints skip the hook drill. */
  assistInfo() {
    const t = this.tool; if (!t || this.respawnT > 0) return null;
    return { kind: 'hook' };
  }
  hints() {
    const t = this.tool; if (!t || this.joint || this.lifted || this.respawnT > 0) return [null];
    const { c } = this.loopWorld(); const H = t.world(t.inst.catchLocal);
    return [H.distanceTo(c) < 0.5 ? { pos: c, ok: H.distanceTo(c) < 0.22, size: 1.45 } : null];
  }
  settle() {
    this.settleT = 0;
    const dT = Math.hypot(this.O.x - this.tgt.x, this.O.z - this.tgt.z);
    const dS = Math.hypot(this.O.x - this.src.x, this.O.z - this.src.z);
    synth('drop');
    this.lifted = false;
    if (!this.started) { if (dS > SRC_R) this.resetObject(); return; }
    if (dT < TGT_R) {
      this.success++;
      this.emit('success', { count: this.success, pos: this.O.clone().setY(0.15) });
      if (this.success >= this.target) { this.complete = true; this.emit('complete'); return; }
      this.pending = { t: 0.45, fn: () => { if (this.level === 'ADVANCED' || this.level === 'EXPERT') { this.pickLayout(); this.placeCircles(); } this.resetObject(); } };
    } else if (dS > SRC_R) {
      this.error('Dropped outside the target', { force: true, pos: this.O.clone() });
      this.pending = { t: 0.3, fn: () => this.resetObject() };
    }
  }
  dispose() { this.pw?.dispose(); }
}
