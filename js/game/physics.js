// Rigid-body physics (Rapier, WASM) at a fixed 120 Hz step, plus solid instruments and contact grasping.
import { THREE } from './engine.js';

const RAPIER_URL = 'https://cdn.jsdelivr.net/npm/@dimforge/rapier3d-compat@0.14.0/rapier.es.js';
let RAPIER = null, loading = null;
export function loadPhysics() {
  if (loading) return loading;
  loading = import(RAPIER_URL).then(async (m) => { await m.default.init(); RAPIER = m.default; return RAPIER; }).catch((e) => { console.warn('physics unavailable', e); return null; });
  return loading;
}
export const physicsReady = () => !!RAPIER;

const _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _m = new THREE.Matrix4();
const vec = (v) => ({ x: v.x, y: v.y, z: v.z });
const quat = (q) => ({ x: q.x, y: q.y, z: q.z, w: q.w });

export class PhysWorld {
  constructor({ gravity = -12 } = {}) {
    this.R = RAPIER;
    this.w = new RAPIER.World({ x: 0, y: gravity, z: 0 });
    this.h = 1 / 120; this.w.timestep = this.h; this.acc = 0;
    this.events = new RAPIER.EventQueue(true);
    this.onSensor = null;
  }
  /** Advance in fixed steps; `each(h)` runs before every step (move kinematic bodies there). */
  step(dt, each) {
    this.acc = Math.min(this.acc + dt, 0.1);
    while (this.acc >= this.h) {
      each?.(this.h);
      this.w.step(this.events);
      this.events.drainCollisionEvents((a, b, started) => this.onSensor?.(a, b, started));
      this.acc -= this.h;
    }
  }
  fixed(pos = { x: 0, y: 0, z: 0 }, rot = null) { const d = this.R.RigidBodyDesc.fixed().setTranslation(pos.x, pos.y, pos.z); if (rot) d.setRotation(quat(rot)); return this.w.createRigidBody(d); }
  kinematic(pos = { x: 0, y: 0, z: 0 }) { return this.w.createRigidBody(this.R.RigidBodyDesc.kinematicPositionBased().setTranslation(pos.x, pos.y, pos.z)); }
  dynamic(pos, { linDamp = 0.15, angDamp = 0.6, ccd = true, canSleep = true } = {}) {
    return this.w.createRigidBody(this.R.RigidBodyDesc.dynamic().setTranslation(pos.x, pos.y, pos.z).setLinearDamping(linDamp).setAngularDamping(angDamp).setCcdEnabled(ccd).setCanSleep(canSleep));
  }
  collider(desc, body, { friction = 0.7, restitution = 0.05, density = 1, sensor = false, groups = null, events = false } = {}) {
    desc.setFriction(friction).setRestitution(restitution).setDensity(density);
    if (sensor) desc.setSensor(true);
    if (groups !== null) desc.setCollisionGroups(groups);
    if (events) desc.setActiveEvents(this.R.ActiveEvents.COLLISION_EVENTS);
    return this.w.createCollider(desc, body);
  }
  /** Static triangle mesh from a three.js geometry (already in world/local space of `body`). */
  trimesh(geo, body, opts) {
    const g = geo.index ? geo : geo.clone(); if (!g.index) { g.setIndex([...Array(g.attributes.position.count).keys()]); }
    const v = new Float32Array(g.attributes.position.array); const i = new Uint32Array(g.index.array);
    return this.collider(this.R.ColliderDesc.trimesh(v, i), body, opts);
  }
  hull(points, body, opts) { return this.collider(this.R.ColliderDesc.convexHull(new Float32Array(points)), body, opts); }
  touching(c1, c2) {
    let hit = false;
    this.w.contactPair(c1, c2, (m) => { for (let k = 0; k < m.numContacts(); k++) if (m.contactDist(k) < 0.012) { hit = true; break; } });
    return hit;
  }
  remove(body) { this.w.removeRigidBody(body); }
  dispose() { this.w.free(); this.events.free(); }
}

// collision groups: membership << 16 | filter
export const G = { ENV: 0x0001, OBJ: 0x0002, JAW: 0x0004, HELD: 0x0008 };
export const groups = (member, filter) => (member << 16) | filter;

/**
 * Solid instrument: kinematic jaw boxes (and a shaft capsule near the tip) that follow a Tool.
 * Grasping: hold grip → jaws close until both touch the same object → the object is held exactly where
 * it was caught (becomes kinematic, rides with the jaws). Release → it falls with the jaws' velocity.
 */
export class SolidInstrument {
  constructor(pw, tool, { assist = 0.15 } = {}) {
    this.pw = pw; this.tool = tool; this.assist = assist;
    const inst = tool.inst, R = pw.R;
    const jl = inst.jawLength, jw = 0.075, jt = 0.034;
    const jawGroups = groups(G.JAW, G.OBJ | G.HELD);
    this.jaws = [1, -1].map((sgn) => {
      const b = pw.kinematic();
      // jaws also report contacts with other moved-by-code bodies (an object held by the other grasper)
      const c = pw.collider(R.ColliderDesc.cuboid(jw / 2, jt / 2, jl / 2).setTranslation(0, sgn * jt / 2, jl / 2).setActiveCollisionTypes(R.ActiveCollisionTypes.DEFAULT | R.ActiveCollisionTypes.KINEMATIC_KINEMATIC), b, { friction: 1.2, groups: jawGroups });
      return { b, c, sgn };
    });
    this.shaft = pw.kinematic();
    pw.collider(R.ColliderDesc.capsule(1.2, 0.055).setRotation(quat(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2))).setTranslation(0, 0, inst.hingeZ - 1.35), this.shaft, { groups: jawGroups });
    this.held = null; this.gripping = false; this.oneJawT = 0;
    tool.solid = this;
    this.prevPos = new THREE.Vector3();
  }
  /** Pose the kinematic colliders from the tool's current transform. */
  sync() {
    const g = this.tool.inst.group; g.updateMatrixWorld(true);
    const a = this.tool.jaw * this.tool.maxJaw, hz = this.tool.inst.hingeZ;
    for (const j of this.jaws) {
      // jaw pivot: rotate about local X at the hinge
      _m.copy(g.matrixWorld).multiply(new THREE.Matrix4().makeTranslation(0, 0, hz)).multiply(new THREE.Matrix4().makeRotationX(-j.sgn * a));
      _m.decompose(_v, _q, new THREE.Vector3());
      j.b.setNextKinematicTranslation(vec(_v)); j.b.setNextKinematicRotation(quat(_q));
    }
    g.matrixWorld.decompose(_v, _q, new THREE.Vector3());
    this.shaft.setNextKinematicTranslation(vec(_v)); this.shaft.setNextKinematicRotation(quat(_q));
  }
  /**
   * Per fixed step. objects: [{body, collider, mesh, grabbable}]; returns 'grab' | 'release' | null.
   */
  update(h, grip, objects) {
    const t = this.tool;
    let ev = null;
    if (grip && !this.held) {
      t.jawT = Math.max(0, t.jawT - h * 4.5);
      // both jaws on the same object → grab; one jaw for a moment near the grip point → assist grab
      this.blocked = null;
      for (const o of objects) {
        const a = this.touchingObj(0, o), b = this.touchingObj(1, o);
        if (!o.grabbable?.(this.tool)) { if (a || b) this.blocked = o; continue; } // touching something you may not grab (rules)
        const near = (o.nearDist ? o.nearDist(t.tip) : _v.copy(o.body.translation()).distanceTo(t.tip)) < (o.nearR ?? 0.22);
        if ((a && b) || ((a || b) && near && (this.oneJawT += h) > this.assist) || (near && t.jaw < 0.12 && this.assist > 0)) { this.grab(o); ev = 'grab'; break; }
      }
      if (!this.held && !objects.some((o) => o.grabbable?.(this.tool) && (this.touchingObj(0, o) || this.touchingObj(1, o)))) this.oneJawT = 0;
    } else if (!grip) {
      if (this.held) { this.release(); ev = 'release'; }
      t.jawT = Math.min(t.jaw0 ?? 0.5, t.jawT + h * 5);
      this.oneJawT = 0;
    }
    if (this.held) this.carry(h);
    return ev;
  }
  touchingObj(j, o) { const cs = o.colliders || [o.collider]; return cs.some((c) => this.pw.touching(this.jaws[j].c, c)); }
  grab(o) {
    const g = this.tool.inst.group; g.updateMatrixWorld(true);
    const inv = g.matrixWorld.clone().invert();
    const p = o.body.translation(), r = o.body.rotation();
    const world = new THREE.Matrix4().compose(new THREE.Vector3(p.x, p.y, p.z), new THREE.Quaternion(r.x, r.y, r.z, r.w), new THREE.Vector3(1, 1, 1));
    o.local = inv.multiply(world); // pose relative to the instrument, kept while held
    o.body.setBodyType(this.pw.R.RigidBodyType.KinematicPositionBased, true);
    for (const c of o.colliders || [o.collider]) { c.setCollisionGroups(groups(G.HELD, G.OBJ | G.JAW)); c.setActiveCollisionTypes(this.pw.R.ActiveCollisionTypes.DEFAULT | this.pw.R.ActiveCollisionTypes.KINEMATIC_KINEMATIC); }
    this.held = o; this.tool.jawT = this.tool.jaw; // jaws stop where they met the object
    this.prevPos.set(p.x, p.y, p.z);
    o.onGrab?.();
  }
  carry(h) {
    const o = this.held, g = this.tool.inst.group; g.updateMatrixWorld(true);
    const m = g.matrixWorld.clone().multiply(o.local); m.decompose(_v, _q, new THREE.Vector3());
    o.constrain?.(_v, _q); // e.g. a cylinder can't leave its peg sideways until it is lifted clear
    this.vel = (this.vel || new THREE.Vector3()).copy(_v).sub(this.prevPos).divideScalar(h);
    this.prevPos.copy(_v);
    o.body.setNextKinematicTranslation(vec(_v)); o.body.setNextKinematicRotation(quat(_q));
  }
  release() {
    const o = this.held; if (!o) return; this.held = null;
    o.body.setBodyType(this.pw.R.RigidBodyType.Dynamic, true);
    for (const c of o.colliders || [o.collider]) c.setCollisionGroups(o.groups ?? groups(G.OBJ, G.ENV | G.OBJ | G.JAW | G.HELD));
    const v = (this.vel || new THREE.Vector3()).clampLength(0, 3);
    o.body.setLinvel(vec(v.multiplyScalar(0.8)), true);
    o.onRelease?.();
  }
}

/** Copy a body's pose onto a mesh. */
export function syncMesh(body, mesh) {
  const p = body.translation(), r = body.rotation();
  mesh.position.set(p.x, p.y, p.z); mesh.quaternion.set(r.x, r.y, r.z, r.w);
}
