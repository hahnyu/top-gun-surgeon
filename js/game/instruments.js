// Instrument meshes. Local frame: origin at the grip point between the jaws, +Z distal (toward the
// tip), shaft runs back along -Z, jaws open in the Y-Z plane (hinge axis X).
import { THREE, stripeTex, woodTex } from './engine.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const std = (color, metal, rough, extra = {}) => new THREE.MeshStandardMaterial({ color, metalness: metal, roughness: rough, ...extra });
const phys = (color, extra = {}) => new THREE.MeshPhysicalMaterial({ color, ...extra });

function zCyl(r0, r1, len, seg = 28, open = false) {
  const g = new THREE.CylinderGeometry(r1, r0, len, seg, 1, open);
  g.rotateX(Math.PI / 2); // along +Z, centred
  return g;
}
const shadow = (m) => { m.castShadow = true; m.receiveShadow = true; return m; };

/** Fenestrated jaw outline (top view) extruded to thickness, with serrated inner face. */
function jawGeometry(len, w, th, fenestrated = true) {
  const s = new THREE.Shape();
  const hw = w / 2, tip = w * 0.28;
  s.moveTo(-hw, 0);
  s.lineTo(-hw * 0.95, len * 0.55);
  s.quadraticCurveTo(-hw * 0.7, len * 0.92, -tip, len * 0.985);
  s.quadraticCurveTo(0, len * 1.02, tip, len * 0.985);
  s.quadraticCurveTo(hw * 0.7, len * 0.92, hw * 0.95, len * 0.55);
  s.lineTo(hw, 0);
  s.lineTo(-hw, 0);
  if (fenestrated) {
    const hole = new THREE.Path();
    const fw = w * 0.2, f0 = len * 0.24, f1 = len * 0.72;
    hole.moveTo(-fw, f0); hole.lineTo(-fw * 0.8, f1); hole.quadraticCurveTo(0, f1 + fw * 1.4, fw * 0.8, f1); hole.lineTo(fw, f0); hole.quadraticCurveTo(0, f0 - fw * 1.2, -fw, f0);
    s.holes.push(hole);
  }
  const g = new THREE.ExtrudeGeometry(s, { depth: th, bevelEnabled: true, bevelThickness: th * 0.18, bevelSize: th * 0.18, bevelSegments: 2, curveSegments: 10 });
  g.rotateX(Math.PI / 2); // shape y -> +Z, extrusion -> -Y
  g.translate(0, th / 2, 0);
  return g;
}

export const GRASPER_DEFAULT = { shaft: 0x15161a, jaw: 0xc4c4cc, hinge: 0x808088, serr: 0xa0a0a8, style: 'standard' };

/**
 * Laparoscopic grasper. jawLength is the length of each jaw; the grip point sits ~55% along it.
 * Returns {group, setJaw(angle), setShaft(len), jawTipsLocal, lowOffset}.
 */
// ------------------------------------------------------------------ CAD instruments (veridien models)
// GLBs in frame S: origin at the hinge pin, +Z to the tip, hinge axis +X, jaws open in Y-Z, metres.
const CAD = {};
let cadLoading = null;
export function loadInstrumentModels() {
  if (cadLoading) return cadLoading;
  cadLoading = import('three/addons/loaders/GLTFLoader.js').then(({ GLTFLoader }) => {
    const loader = new GLTFLoader();
    const one = (name, jawLen) => new Promise((res) => loader.load(`assets/models/${name}.glb`, (g) => { CAD[name] = { scene: g.scene, jawLen, shaftR: 0.0025 }; res(); }, undefined, () => res()));
    return Promise.all([one('fenestrated', 0.01982), one('maryland', 0.0195)]);
  }).catch(() => {});
  return cadLoading;
}

function addExtras(group, t, hingeZ, shaftR) {
  if (t.style === 'fishing') {
    const reel = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.08, 24), std(0x9a9aa4, 1, 0.3)));
    reel.rotation.z = Math.PI / 2; reel.position.set(0, -0.12, hingeZ - 1.6);
    const knob = shadow(new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 10), std(0x6b3e1e, 0, 0.6))); knob.position.set(0.05, -0.18, hingeZ - 1.6);
    const ring1 = shadow(new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.008, 8, 20), std(0xd4d4d4, 1, 0.2))); ring1.position.set(0, -0.08, hingeZ - 0.7);
    group.add(reel, knob, ring1);
  } else if (t.style === 'branch') {
    for (let i = 0; i < 3; i++) {
      const b = shadow(new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), std(0x4a2e14, 0, 0.95))); b.scale.set(1, 1, 1.6);
      b.position.set((i % 2 ? 1 : -1) * 0.03, 0.02, hingeZ - 0.6 - i * 0.55); group.add(b);
      const leaf = shadow(new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 6), std(0x4e7a33, 0, 0.7))); leaf.scale.set(0.4, 0.08, 1.4);
      leaf.position.set((i % 2 ? 1 : -1) * 0.1, 0.06, hingeZ - 0.62 - i * 0.55); leaf.rotation.y = (i % 2 ? 1 : -1) * 0.6; group.add(leaf);
    }
  } else if (t.style === 'desert') {
    const bandD = shadow(new THREE.Mesh(zCyl(shaftR * 1.12, shaftR * 1.12, 0.12, 24), std(0x5a3d1f, 0, 0.8))); bandD.position.z = hingeZ - 0.55; group.add(bandD);
    const bandE = bandD.clone(); bandE.position.z = hingeZ - 1.2; group.add(bandE);
  }
}

function cadGrasper(cad, t, { group, jl, gripAt, hingeZ, shaftMat, custom, shaftR }) {
  const s = jl / cad.jawLen;
  const root = new THREE.Group(); root.scale.setScalar(s); root.position.z = hingeZ; group.add(root);
  const src = {}; cad.scene.traverse((o) => { if (o.isMesh) src[o.name] = o; });
  const tune = (m) => { m = m.clone(); if (m.metalness > 0.5) m.envMapIntensity = 1.8; return m; };
  const mk = (name, mat, parent = root) => { const m = shadow(new THREE.Mesh(src[name].geometry, mat || tune(src[name].material))); parent.add(m); return m; };
  // Shaft parts: proximal vertices are pulled back each frame so the shaft always reaches the port.
  const stretchy = (name, mat, fixedZ = null) => {
    const m = mk(name, mat); m.geometry = m.geometry.clone(); m.frustumCulled = false;
    if (fixedZ !== null) { const ps = m.geometry.attributes.position; for (let i = 0; i < ps.count; i++) if (ps.getZ(i) < -0.03) ps.setZ(i, fixedZ); return { m, pos: ps, idx: [] }; }
    const pos = m.geometry.attributes.position; const idx = [];
    for (let i = 0; i < pos.count; i++) if (pos.getZ(i) < -0.03) idx.push(i);
    return { m, pos, idx };
  };
  const insul = stretchy('insulation', custom ? shaftMat : phys(0x0b0b0d, { roughness: 0.48, clearcoat: 0.35, clearcoatRoughness: 0.45 }));
  const tube = stretchy('tube', null, -0.03); // steel collar only; the long run would z-fight the insulation
  mk('pin');
  const jA = new THREE.Group(), jB = new THREE.Group(); root.add(jA, jB);
  const jawMat = custom ? std(t.jaw, t.style === 'desert' || t.style === 'branch' ? 0.2 : 1, t.style === 'branch' ? 0.75 : 0.32) : null;
  mk('jaw_A', jawMat, jA); mk('jaw_B', jawMat, jB);
  addExtras(group, t, hingeZ, shaftR);
  const jt = 0.0045 * s;
  const tipA = V(), tipB = V();
  const inst = {
    group, jawLength: jl, gripAt, hingeZ, kind: 'grasper', cad: true,
    setJaw(a) { jA.rotation.x = -a; jB.rotation.x = a; this._a = a; },
    setShaft(len) {
      const z = -(len + gripAt) / s;
      for (const p of [insul, tube]) { for (const i of p.idx) p.pos.setZ(i, z); p.pos.needsUpdate = true; }
    },
    jawTips() {
      const a = this._a || 0;
      tipA.set(0, Math.sin(a) * jl + jt * 0.5, hingeZ + Math.cos(a) * jl);
      tipB.set(0, -Math.sin(a) * jl - jt * 0.5, hingeZ + Math.cos(a) * jl);
      return [tipA, tipB];
    },
    lowOffset() {
      let low = 0;
      for (const p of this.jawTips()) { const w = p.clone().applyQuaternion(group.quaternion); low = Math.min(low, w.y); }
      return low;
    },
  };
  inst.setJaw(0.3);
  return inst;
}

export function buildGrasper(theme = {}, { jawLength = 0.48, shaftR = 0.0525, fenestrated = true, thin = false, model = 'fenestrated' } = {}) {
  const t = { ...GRASPER_DEFAULT, ...theme };
  const group = new THREE.Group();
  const gripAt = jawLength * 0.5;
  const hingeZ = -gripAt;
  const jl = jawLength, jw = thin ? 0.05 : 0.082, jt = thin ? 0.024 : 0.034;

  const shaftMat = t.style === 'fishing' ? phys(t.shaft, { roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.1, metalness: 0.1 })
    : t.style === 'branch' ? std(0xffffff, 0, 0.9, { map: woodTex() })
    : t.style === 'desert' ? std(t.shaft, 0.1, 0.8)
    : phys(t.shaft, { roughness: 0.35, clearcoat: 0.7, clearcoatRoughness: 0.25, metalness: 0 });
  const steel = std(t.hinge, 1, 0.28);
  const jawMat = std(t.jaw, t.style === 'desert' || t.style === 'branch' ? 0.2 : 1, t.style === 'branch' ? 0.75 : 0.3);
  const serrMat = std(t.serr ?? t.jaw, 1, 0.45);

  const cad = CAD[model];
  if (cad) return cadGrasper(cad, t, { group, jl, gripAt, hingeZ, shaftMat, custom: t.style !== 'standard', shaftR: cad.shaftR * (jl / cad.jawLen) });

  // Shaft: unit-length cylinder scaled along Z in setShaft
  const shaft = shadow(new THREE.Mesh(zCyl(shaftR, shaftR, 1, 32), shaftMat));
  const shaftPivot = new THREE.Group(); shaftPivot.add(shaft); shaft.position.z = -0.5;
  shaftPivot.position.z = hingeZ - 0.16;
  group.add(shaftPivot);
  // Steel collar + clevis housing
  const collar = shadow(new THREE.Mesh(zCyl(shaftR * 1.02, shaftR * 1.02, 0.07, 32), steel)); collar.position.z = hingeZ - 0.12;
  const clevis = shadow(new THREE.Mesh(zCyl(shaftR * 1.0, shaftR * 0.78, 0.11, 32), std(0xc8ccd2, 1, 0.22))); clevis.position.z = hingeZ - 0.045;
  const pin = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, shaftR * 1.9, 16), std(0x9aa0a8, 1, 0.3))); pin.rotation.z = Math.PI / 2; pin.position.z = hingeZ;
  group.add(collar, clevis, pin);
  // a ring of insulation highlight
  const band = shadow(new THREE.Mesh(zCyl(shaftR * 1.04, shaftR * 1.04, 0.025, 32), std(0x2a2a2e, 0.2, 0.5))); band.position.z = hingeZ - 0.2; group.add(band);

  // Jaws on pivots
  const jaws = [];
  for (const sgn of [1, -1]) {
    const pivot = new THREE.Group(); pivot.position.z = hingeZ;
    const jaw = shadow(new THREE.Mesh(jawGeometry(jl, jw, jt, fenestrated), jawMat));
    jaw.position.y = sgn * (jt * 0.5 + 0.004);
    if (sgn < 0) jaw.scale.y = -1;
    pivot.add(jaw);
    // serration teeth on inner face
    const teeth = new THREE.Group();
    for (let i = 0; i < 7; i++) {
      const tz = jl * (0.15 + i * 0.11);
      const tooth = new THREE.Mesh(new THREE.BoxGeometry(jw * (0.8 - i * 0.05), 0.008, 0.016), serrMat);
      tooth.position.set(0, sgn * 0.002, tz);
      teeth.add(tooth);
    }
    pivot.add(teeth);
    group.add(pivot);
    jaws.push({ pivot, sgn });
  }

  addExtras(group, t, hingeZ, shaftR);

  const tipA = V(0, 0, 0), tipB = V(0, 0, 0);
  const inst = {
    group, jawLength: jl, gripAt, hingeZ, kind: 'grasper',
    setJaw(a) { jaws[0].pivot.rotation.x = -a; jaws[1].pivot.rotation.x = a; this._a = a; },
    setShaft(len) { shaftPivot.scale.z = len; },
    /** jaw tip points in local space for the current opening */
    jawTips() {
      const a = this._a || 0; const L = jl - 0;
      tipA.set(0, Math.sin(a) * L + jt * 0.5, hingeZ + Math.cos(a) * L);
      tipB.set(0, -Math.sin(a) * L - jt * 0.5, hingeZ + Math.cos(a) * L);
      return [tipA, tipB];
    },
    /** how far below the grip point the lowest jaw tip hangs (negative = below) */
    lowOffset(tool) {
      const tips = this.jawTips(); let low = 0;
      for (const p of tips) { const w = p.clone().applyQuaternion(group.quaternion); low = Math.min(low, w.y); }
      return low;
    },
  };
  inst.setJaw(0.3);
  return inst;
}

// ------------------------------------------------------------------ hook
export const HOOK_DEFAULT = { shaft: 0x4a4a52, hook: 0xdcdce4, style: 'standard' };

class JHookCurve extends THREE.Curve {
  constructor(stem, r, tipLen) { super(); this.stem = stem; this.r = r; this.tipLen = tipLen; }
  getPoint(t, out = new THREE.Vector3()) {
    const s = this.stem, r = this.r, tl = this.tipLen;
    const arc = Math.PI * r / 2;
    const total = s + arc + tl; let d = t * total;
    if (d <= s) return out.set(0, 0, d - s);
    d -= s;
    if (d <= arc) { const a = d / r; return out.set(0, r - Math.cos(a) * r, Math.sin(a) * r); }
    d -= arc;
    return out.set(0, r + d, r);
  }
}

/**
 * J-hook: a straight stem along the shaft, a 90° bend, then a short tip pointing +Y (local).
 * The grip point (origin) is the inside of the bend — what catches a loop.
 */
export function buildHook(theme = {}) {
  const t = { ...HOOK_DEFAULT, ...theme };
  const group = new THREE.Group();
  const stem = 0.24, r = 0.06, tipLen = 0.1, wire = 0.018;
  const curve = new JHookCurve(stem, r, tipLen);
  const hookMat = t.style === 'candy' ? std(0xffffff, 0.1, 0.35, { map: stripeTex('candy', '#f5f5f5', '#e53935', 10) }) : std(t.hook, 1, 0.22);
  const hook = shadow(new THREE.Mesh(new THREE.TubeGeometry(curve, 48, wire, 12, false), hookMat));
  // tip cap
  const cap = shadow(new THREE.Mesh(new THREE.SphereGeometry(wire, 12, 10), hookMat)); cap.position.set(0, r + tipLen, r);
  // position so the bend's inside sits at origin
  const off = new THREE.Group(); off.position.set(0, 0, -r * 0.6); off.add(hook, cap); group.add(off);

  const shaftMat = t.style === 'candy' ? std(0xffffff, 0, 0.4, { map: stripeTex('candyShaft', '#f5f5f5', '#e53935', 8) })
    : t.style === 'pirate' ? std(0xffffff, 0, 0.85, { map: woodTex() })
    : phys(t.shaft, { roughness: 0.38, clearcoat: 0.5, clearcoatRoughness: 0.3, metalness: 0 });
  const shaft = shadow(new THREE.Mesh(zCyl(0.05, 0.05, 1, 28), shaftMat));
  const sp = new THREE.Group(); sp.add(shaft); shaft.position.z = -0.5; sp.position.z = -stem - r * 0.6; group.add(sp);
  const collar = shadow(new THREE.Mesh(zCyl(0.052, 0.03, 0.08, 24), std(0xb8bcc4, 1, 0.25))); collar.position.z = -stem - r * 0.6 + 0.04; group.add(collar);
  if (t.style === 'pirate') {
    const guard = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.13, 0.05, 32), std(0xc0c0c8, 1, 0.25)));
    guard.rotation.x = Math.PI / 2; guard.position.z = -stem - 0.9; group.add(guard);
    for (let i = 0; i < 3; i++) { const rv = new THREE.Mesh(new THREE.SphereGeometry(0.015, 8, 6), std(0xd9b44a, 1, 0.3)); rv.position.set(Math.cos(i * 2.1) * 0.12, Math.sin(i * 2.1) * 0.12, -stem - 0.87); group.add(rv); }
  }
  if (t.style === 'candy') {
    const bow = shadow(new THREE.Mesh(new THREE.TorusKnotGeometry(0.05, 0.016, 48, 8, 2, 3), std(0x2e7d32, 0, 0.5))); bow.position.z = -stem - 0.7; group.add(bow);
  }

  // Collision samples along the hook (local)
  const samples = [];
  for (let i = 0; i <= 16; i++) { const p = curve.getPoint(i / 16); p.z -= r * 0.6; samples.push(p); }
  const tipLocal = V(0, r + tipLen, r - r * 0.6);
  const catchLocal = V(0, r * 0.35, r * 0.4 - r * 0.6);
  return {
    group, kind: 'hook', samples, tipLocal, catchLocal, wire,
    setShaft(len) { sp.scale.z = len; },
    setJaw() {},
    lowOffset() {
      let low = 0;
      for (const p of samples) { const w = p.clone().applyQuaternion(group.quaternion); low = Math.min(low, w.y); }
      return low;
    },
  };
}

/** Free-floating preview of an instrument (for the cosmetics shop). */
export function instrumentPreview(kind, theme) {
  const inst = kind === 'hook' ? buildHook(theme) : buildGrasper(theme);
  inst.setShaft(1.4);
  inst.setJaw(kind === 'hook' ? 0 : 0.28);
  const g = new THREE.Group();
  inst.group.rotation.set(-0.35, 0.9, 0.15);
  g.add(inst.group);
  return g;
}
