// Cosmetic themes: environments (plate, transferable object, goal) and instrument skins, per drill.
import { THREE, sandTex, waterTex, grassTex, noiseTex } from './engine.js';

const std = (color, metal = 0, rough = 0.6, extra = {}) => new THREE.MeshStandardMaterial({ color, metalness: metal, roughness: rough, ...extra });
const phys = (color, extra = {}) => new THREE.MeshPhysicalMaterial({ color, ...extra });
const sh = (m) => { m.castShadow = true; m.receiveShadow = true; return m; };
const M = (geo, mat) => sh(new THREE.Mesh(geo, mat));

// ============================================================ PEAS (group at origin, ~0.26 long)
// Shared bean geometry: a kidney shape with a little bend.
let beanGeo = null;
function beanGeometry() {
  if (beanGeo) return beanGeo;
  const g = new THREE.SphereGeometry(0.13, 36, 24); const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i) * 0.8, y = p.getY(i) * 0.68, z = p.getZ(i) * 1.22;
    const t = z / 0.16;
    x += 0.055 * (t * t) - 0.02;                    // banana bend
    if (x < 0) x *= 1 - 0.18 * Math.max(0, 1 - t * t); // concave side
    p.setXYZ(i, x, y, z);
  }
  g.computeVertexNormals(); beanGeo = g; return g;
}
let beanTexCache = null;
function beanTex() {
  if (beanTexCache) return beanTexCache;
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  g.fillStyle = '#f2e6cc'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${150 + Math.random() * 60 | 0},${110 + Math.random() * 50 | 0},${60 + Math.random() * 30 | 0},${Math.random() * 0.18})`; const r = 2 + Math.random() * 8; g.beginPath(); g.ellipse(Math.random() * 256, Math.random() * 256, r, r * 0.5, Math.random() * 3, 0, 7); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; beanTexCache = t; return t;
}
export function peaDefault(i = 0) {
  const g = new THREE.Group();
  const tint = new THREE.Color().setHSL(0.09 + ((i * 0.37) % 1) * 0.025, 0.42 + ((i * 0.53) % 1) * 0.12, 0.6 + ((i * 0.71) % 1) * 0.1);
  const body = M(beanGeometry(), phys(tint, { map: beanTex(), roughness: 0.42, clearcoat: 0.65, clearcoatRoughness: 0.3 }));
  g.add(body);
  const hilum = M(new THREE.SphereGeometry(0.03, 12, 8), std(0xf6efe0, 0, 0.5)); hilum.scale.set(0.5, 0.5, 1.3); hilum.position.set(-0.075, 0.0, 0); g.add(hilum);
  const eye = M(new THREE.SphereGeometry(0.011, 8, 6), std(0x2a1c12, 0, 0.4)); eye.position.set(-0.088, 0.0, 0.0); g.add(eye);
  const s = 0.92 + ((i * 0.41) % 1) * 0.16; g.scale.setScalar(s);
  return g;
}
export function peaSeashell() {
  // scallop: ribbed fan
  const g = new THREE.Group();
  const mat = phys(0xF3E7D0, { roughness: 0.42, metalness: 0.05, clearcoat: 0.4, sheen: 0.4, sheenColor: new THREE.Color(0xffd9c0) });
  const ribs = 9;
  for (let i = 0; i < ribs; i++) {
    const a = -0.9 + (i / (ribs - 1)) * 1.8;
    const rib = M(new THREE.CylinderGeometry(0.018, 0.034, 0.24, 10), mat);
    rib.position.set(Math.sin(a) * 0.1, 0.03 + Math.cos(a * 1.2) * 0.02, Math.cos(a) * 0.1 - 0.05);
    rib.rotation.set(Math.PI / 2 - 0.25, 0, -a); g.add(rib);
  }
  const back = M(new THREE.SphereGeometry(0.15, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat); back.scale.set(1, 0.35, 0.9); back.position.z = 0.02; g.add(back);
  const hinge = M(new THREE.BoxGeometry(0.12, 0.04, 0.05), std(0xe0c9a8, 0, 0.5)); hinge.position.set(0, 0.02, -0.13); g.add(hinge);
  g.children.forEach((c) => (c.material = c.material === mat ? mat : c.material));
  return g;
}
export function peaCactusFruit() {
  const g = new THREE.Group();
  const body = M(new THREE.SphereGeometry(0.12, 20, 16), phys(0xC2185B, { roughness: 0.45, clearcoat: 0.3 })); body.scale.set(0.9, 0.8, 1.2); g.add(body);
  for (let i = 0; i < 14; i++) { const d = M(new THREE.SphereGeometry(0.008, 6, 4), std(0xffe082)); const th = Math.random() * Math.PI * 2, ph = Math.random() * Math.PI; d.position.set(Math.sin(ph) * Math.cos(th) * 0.108, Math.cos(ph) * 0.096, Math.sin(ph) * Math.sin(th) * 0.144); g.add(d); }
  for (let i = 0; i < 5; i++) { const l = M(new THREE.ConeGeometry(0.03, 0.08, 6), std(0x43a047, 0, 0.6)); l.position.set(Math.cos(i * 1.26) * 0.03, 0.06, 0.12 + Math.sin(i * 1.26) * 0.03); l.rotation.x = 1.1; l.rotation.z = Math.cos(i * 1.26) * 0.6; g.add(l); }
  return g;
}
export function peaBanana() {
  const g = new THREE.Group();
  const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 0, -0.16), new THREE.Vector3(0.09, 0.03, 0), new THREE.Vector3(0, 0, 0.16));
  const body = M(new THREE.TubeGeometry(curve, 24, 0.055, 10), phys(0xF9D53E, { roughness: 0.5, clearcoat: 0.2 })); g.add(body);
  const tipA = M(new THREE.SphereGeometry(0.03, 8, 6), std(0x4e342e)); tipA.position.set(0, 0, -0.165);
  const tipB = M(new THREE.CylinderGeometry(0.02, 0.025, 0.05, 8), std(0x6d4c41)); tipB.position.set(0, 0, 0.18); tipB.rotation.x = Math.PI / 2;
  g.add(tipA, tipB);
  return g;
}

// ============================================================ CUPS (holeR, outerR, height)
/** Height of the default dome at horizontal distance d. Shared with physics. */
export function domeHeight(d, holeR, outerR, H) {
  if (d <= holeR) return H;
  if (d >= outerR) return 0;
  const t = (d - holeR) / (outerR - holeR);
  return H * (1 - t * t * (0.35 + 0.65 * t));
}
function domeProfile(holeR, outerR, H, wall = 0.06) {
  const pts = [];
  pts.push(new THREE.Vector2(holeR - wall * 0.5, H - 0.2));
  pts.push(new THREE.Vector2(holeR - wall * 0.5, H - 0.01));
  pts.push(new THREE.Vector2(holeR, H + 0.012));
  for (let i = 0; i <= 24; i++) { const d = holeR + (outerR - holeR) * (i / 24); pts.push(new THREE.Vector2(d, domeHeight(d, holeR, outerR, H))); }
  pts.push(new THREE.Vector2(outerR + 0.001, 0));
  return pts;
}
export function cupDefault(holeR, outerR, H) {
  const g = new THREE.Group();
  const shell = M(new THREE.LatheGeometry(domeProfile(holeR, outerR, H), 96), phys(0x8a9199, { roughness: 0.5, clearcoat: 0.35, clearcoatRoughness: 0.4, side: THREE.DoubleSide }));
  g.add(shell);
  // moulded ribs on the slope
  for (const f of [0.35, 0.6, 0.82]) { const d = holeR + (outerR - holeR) * f; const rib = M(new THREE.TorusGeometry(d, 0.009, 8, 96), phys(0x9aa1a9, { roughness: 0.45 })); rib.rotation.x = Math.PI / 2; rib.position.y = domeHeight(d, holeR, outerR, H) + 0.002; g.add(rib); }
  const rim = M(new THREE.TorusGeometry(holeR + 0.008, 0.024, 16, 64), std(0xd2d6dc, 1, 0.22)); rim.rotation.x = Math.PI / 2; rim.position.y = H + 0.012;
  const flange = M(new THREE.RingGeometry(outerR - 0.01, outerR + 0.12, 96), phys(0x6f767e, { roughness: 0.6 })); flange.rotation.x = -Math.PI / 2; flange.position.y = 0.004;
  const throat = M(new THREE.CylinderGeometry(holeR - 0.012, holeR - 0.03, 0.3, 32, 1, true), std(0x15161a, 0, 0.9, { side: THREE.BackSide })); throat.position.y = H - 0.15;
  const well = M(new THREE.CircleGeometry(holeR - 0.03, 32), std(0x050506, 0, 1)); well.rotation.x = -Math.PI / 2; well.position.y = H - 0.3;
  g.add(rim, flange, throat, well);
  return g;
}
export function cupRingBuoy(holeR, outerR, H) {
  const g = new THREE.Group();
  const water = M(new THREE.CircleGeometry(outerR + 0.15, 48), std(0xffffff, 0.1, 0.15, { map: waterTex() })); water.rotation.x = -Math.PI / 2; water.position.y = 0.006; g.add(water);
  const shell = M(new THREE.LatheGeometry(domeProfile(holeR, outerR, H), 48), phys(0x1E90FF, { roughness: 0.1, transmission: 0.5, thickness: 0.3, transparent: true, opacity: 0.55, side: THREE.DoubleSide }));
  g.add(shell);
  const R = holeR + 0.11;
  for (let i = 0; i < 4; i++) {
    const arc = M(new THREE.TorusGeometry(R, 0.085, 16, 24, Math.PI / 2), phys(i % 2 ? 0xffffff : 0xFF6B1A, { roughness: 0.4, clearcoat: 0.6 }));
    arc.rotation.x = Math.PI / 2; arc.rotation.z = (i * Math.PI) / 2; arc.position.y = H + 0.04; g.add(arc);
  }
  const hole = M(new THREE.CircleGeometry(holeR, 32), std(0x0a2a4a, 0, 0.3)); hole.rotation.x = -Math.PI / 2; hole.position.y = H - 0.12; g.add(hole);
  return g;
}
export function cupPyramid(holeR, outerR, H) {
  const g = new THREE.Group();
  const pyr = M(new THREE.CylinderGeometry(holeR * 1.25, outerR * 1.1, H, 4, 1, true), std(0xffffff, 0, 0.95, { map: sandTex(), side: THREE.DoubleSide }));
  pyr.position.y = H / 2; pyr.rotation.y = Math.PI / 4; g.add(pyr);
  for (let i = 1; i < 6; i++) { const step = M(new THREE.CylinderGeometry(holeR * 1.25 + (outerR * 1.1 - holeR * 1.25) * (1 - i / 6) + 0.012, holeR * 1.25 + (outerR * 1.1 - holeR * 1.25) * (1 - i / 6) + 0.012, 0.012, 4, 1, true), std(0xb8925a, 0, 1)); step.position.y = H * (i / 6); step.rotation.y = Math.PI / 4; g.add(step); }
  const top = M(new THREE.RingGeometry(holeR * 0.92, holeR * 1.3, 4), std(0xc9a66a, 0, 0.9)); top.rotation.x = -Math.PI / 2; top.rotation.z = Math.PI / 4; top.position.y = H; g.add(top);
  const dark = M(new THREE.CircleGeometry(holeR * 0.95, 4), std(0x120a04, 0, 1)); dark.rotation.x = -Math.PI / 2; dark.rotation.z = Math.PI / 4; dark.position.y = H - 0.1; g.add(dark);
  return g;
}
export function cupAlligator(holeR, outerR, H) {
  const g = new THREE.Group();
  const green = phys(0x3f6b2a, { roughness: 0.7, clearcoat: 0.2 });
  const belly = M(new THREE.LatheGeometry(domeProfile(holeR, outerR, H), 48), green); g.add(belly);
  const water = M(new THREE.CircleGeometry(holeR, 32), std(0x2c5b1f, 0.1, 0.2)); water.rotation.x = -Math.PI / 2; water.position.y = H - 0.15; g.add(water);
  for (const s of [1, -1]) {
    const jaw = new THREE.Group(); jaw.position.set(0, H, s * holeR * 0.95);
    const bar = M(new THREE.BoxGeometry(holeR * 2.6, 0.07, 0.14), green); bar.position.z = s * 0.05; jaw.add(bar);
    for (let i = 0; i < 6; i++) { const tooth = M(new THREE.ConeGeometry(0.02, 0.06, 5), std(0xfafafa, 0, 0.4)); tooth.position.set(-holeR * 1.1 + i * holeR * 0.44, -0.045, -s * 0.01); tooth.rotation.x = Math.PI; jaw.add(tooth); }
    jaw.rotation.x = s * -0.45; g.add(jaw);
  }
  for (const x of [-1, 1]) { const eye = M(new THREE.SphereGeometry(0.05, 12, 10), std(0xf5e050, 0, 0.3)); eye.position.set(x * 0.12, H + 0.14, -holeR - 0.12); const p = M(new THREE.SphereGeometry(0.022, 8, 6), std(0x111111)); p.position.set(x * 0.12, H + 0.16, -holeR - 0.08); g.add(eye, p); }
  return g;
}

// ============================================================ TRIANGLES (transferable with loop)
export const TRI = { W: 0.66, H: 0.33, D: 0.66, LOOP_R: 0.18, LOOP_TUBE: 0.03 };
function prismGeo(w, h, d) {
  const s = new THREE.Shape(); s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(0, h); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 2 });
  g.translate(0, 0, -d / 2); return g;
}
function loop(mat) {
  const l = M(new THREE.TorusGeometry(TRI.LOOP_R, TRI.LOOP_TUBE, 16, 40), mat); l.position.y = TRI.H + 0.12 + TRI.LOOP_R * 0.25; // loop centre
  const post = M(new THREE.CylinderGeometry(0.03, 0.04, 0.16, 12), mat); post.position.y = TRI.H + 0.02;
  return [l, post];
}
// Each returns a Group with base at y=0 and loop facing +Z (torus axis along Z).
export function triDefault() {
  const g = new THREE.Group();
  // game palette: a coral triangle with a bright mint loop — the thing you aim the hook at
  const body = M(prismGeo(TRI.W, TRI.H, TRI.D), phys(0xff5d6c, { roughness: 0.4, clearcoat: 0.5, clearcoatRoughness: 0.25 })); g.add(body);
  g.add(...loop(std(0x36e29a, 0.2, 0.35, { emissive: 0x36e29a, emissiveIntensity: 0.18 })));
  return g;
}
export function triPyramid() {
  const g = new THREE.Group();
  const body = M(new THREE.ConeGeometry(TRI.W * 0.62, TRI.H * 1.15, 4), std(0xffffff, 0, 0.95, { map: sandTex() })); body.position.y = TRI.H * 0.575; body.rotation.y = Math.PI / 4; g.add(body);
  g.add(...loop(std(0xd4a640, 1, 0.3)));
  return g;
}
export function triAnchor() {
  const g = new THREE.Group();
  const iron = std(0x3d4650, 0.9, 0.45);
  const shank = M(new THREE.CylinderGeometry(0.04, 0.04, TRI.H + 0.1, 12), iron); shank.position.y = (TRI.H + 0.1) / 2; g.add(shank);
  const arms = M(new THREE.TorusGeometry(0.28, 0.035, 10, 24, Math.PI), iron); arms.rotation.z = Math.PI; arms.position.y = 0.3; g.add(arms);
  for (const s of [-1, 1]) { const fl = M(new THREE.ConeGeometry(0.07, 0.14, 4), iron); fl.position.set(s * 0.28, 0.33, 0); g.add(fl); }
  const stock = M(new THREE.BoxGeometry(0.5, 0.05, 0.05), std(0x6b4423, 0, 0.8)); stock.position.y = TRI.H + 0.02; g.add(stock);
  const foot = M(new THREE.BoxGeometry(0.62, 0.04, 0.3), iron); foot.position.y = 0.02; g.add(foot);
  g.add(...loop(iron));
  return g;
}
export function triBonfire() {
  const g = new THREE.Group();
  const wood = std(0x5d3a1a, 0, 0.9);
  for (let i = 0; i < 5; i++) { const log = M(new THREE.CylinderGeometry(0.045, 0.05, 0.62, 10), wood); log.rotation.z = Math.PI / 2; log.rotation.y = (i / 5) * Math.PI; log.position.y = 0.05 + (i % 2) * 0.04; g.add(log); }
  const flame = M(new THREE.ConeGeometry(0.16, TRI.H, 12), std(0xff6d00, 0, 0.5, { emissive: 0xff4500, emissiveIntensity: 1.6 })); flame.position.y = TRI.H / 2 + 0.04; g.add(flame);
  const flame2 = M(new THREE.ConeGeometry(0.09, TRI.H * 0.7, 10), std(0xffd54f, 0, 0.5, { emissive: 0xffc107, emissiveIntensity: 2 })); flame2.position.y = TRI.H * 0.4; g.add(flame2);
  g.add(...loop(std(0x8d8d8d, 1, 0.35)));
  return g;
}

// ============================================================ RINGS / TARGET CIRCLES
export function ringDisk(radius, color, ringColor, { glow = false, y = 0.012 } = {}) {
  const g = new THREE.Group();
  const felt = glow ? std(color, 0.1, 0.4, { emissive: color, emissiveIntensity: 0.35 })
    : new THREE.MeshStandardMaterial({ color, roughness: 0.92, metalness: 0, normalMap: noiseTex('felt', [3, 3], 2), normalScale: new THREE.Vector2(0.6, 0.6) });
  const disk = M(new THREE.CylinderGeometry(radius, radius, 0.024, 72), felt);
  disk.position.y = y; g.add(disk);
  // raised lip (lathe profile)
  const lip = [new THREE.Vector2(radius - 0.005, 0), new THREE.Vector2(radius - 0.01, 0.05), new THREE.Vector2(radius + 0.02, 0.07), new THREE.Vector2(radius + 0.07, 0.05), new THREE.Vector2(radius + 0.08, 0)];
  const ring = M(new THREE.LatheGeometry(lip, 96), std(ringColor, 0.55, 0.35, glow ? { emissive: ringColor, emissiveIntensity: 0.6 } : {}));
  g.add(ring);
  return g;
}
export function endDefault(r) { return ringDisk(r, 0xffb81c, 0x0b1430, { glow: true }); } // sunshine landing circle, navy rim
export function endOasis(r) {
  const g = new THREE.Group();
  const w = M(new THREE.CylinderGeometry(r, r * 1.04, 0.03, 48), std(0xffffff, 0.15, 0.12, { map: waterTex() })); w.position.y = 0.015; g.add(w);
  for (let i = 0; i < 3; i++) {
    const a = i * 2.1 + 0.5; const trunk = M(new THREE.CylinderGeometry(0.03, 0.045, 0.6, 8), std(0x7a5230, 0, 0.9));
    trunk.position.set(Math.cos(a) * (r + 0.12), 0.3, Math.sin(a) * (r + 0.12)); trunk.rotation.z = Math.cos(a) * 0.2; g.add(trunk);
    for (let k = 0; k < 5; k++) { const leaf = M(new THREE.SphereGeometry(0.16, 8, 4), std(0x2e7d32, 0, 0.7)); leaf.scale.set(1, 0.12, 0.35); leaf.position.set(trunk.position.x + Math.cos(k * 1.25) * 0.12, 0.62, trunk.position.z + Math.sin(k * 1.25) * 0.12); leaf.rotation.y = -k * 1.25; g.add(leaf); }
  }
  return g;
}
export function endIsland(r) {
  const g = new THREE.Group();
  const sand = M(new THREE.CylinderGeometry(r * 0.96, r * 1.06, 0.07, 48), std(0xffffff, 0, 0.95, { map: sandTex() })); sand.position.y = 0.035; g.add(sand);
  const ring = M(new THREE.TorusGeometry(r * 1.08, 0.05, 8, 64), std(0xffffff, 0.05, 0.2, { map: waterTex(), transparent: true, opacity: 0.85 })); ring.rotation.x = Math.PI / 2; ring.position.y = 0.02; g.add(ring);
  const palm = M(new THREE.CylinderGeometry(0.025, 0.04, 0.5, 8), std(0x7a5230, 0, 0.9)); palm.position.set(r * 0.7, 0.3, -r * 0.5); palm.rotation.z = -0.25; g.add(palm);
  return g;
}
export function endRocks(r) {
  const g = ringDisk(r, 0x6B8E4E, 0x4E7A33);
  for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2; const rock = M(new THREE.DodecahedronGeometry(0.08 + (i % 3) * 0.02, 0), std(0x7d7d75, 0, 0.9)); rock.position.set(Math.cos(a) * (r + 0.05), 0.06, Math.sin(a) * (r + 0.05)); rock.rotation.set(i, i * 2, 0); g.add(rock); }
  return g;
}

// ============================================================ COBRA extras
export function buildBoat(r) {
  const g = new THREE.Group();
  const hull = M(new THREE.CapsuleGeometry(r * 0.55, r * 0.9, 6, 20), std(0x8d5524, 0, 0.75)); hull.rotation.z = Math.PI / 2; hull.scale.set(0.35, 1, 1); hull.position.y = 0.06; g.add(hull);
  const deck = M(new THREE.BoxGeometry(r * 1.7, 0.04, r * 0.9), std(0xd7b98e, 0, 0.8)); deck.position.y = 0.2; g.add(deck);
  const mast = M(new THREE.CylinderGeometry(0.025, 0.025, 1.0, 8), std(0x5d4037)); mast.position.set(-r * 0.6, 0.7, -r * 0.35); g.add(mast);
  const sail = M(new THREE.PlaneGeometry(0.5, 0.7), std(0xfafafa, 0, 0.8, { side: THREE.DoubleSide })); sail.position.set(-r * 0.6 + 0.26, 0.72, -r * 0.35); g.add(sail);
  const water = M(new THREE.CircleGeometry(r * 1.25, 48), std(0xffffff, 0.15, 0.15, { map: waterTex() })); water.rotation.x = -Math.PI / 2; water.position.y = 0.004; g.add(water);
  return g;
}
export function buildSnakeHead() {
  const g = new THREE.Group();
  const head = M(new THREE.SphereGeometry(0.1, 16, 12), phys(0x2E5A2A, { roughness: 0.5, clearcoat: 0.5 })); head.scale.set(1, 0.7, 1.4); g.add(head);
  for (const s of [-1, 1]) { const e = M(new THREE.SphereGeometry(0.025, 8, 6), std(0xf5e050, 0, 0.3)); e.position.set(s * 0.06, 0.05, 0.06); g.add(e); }
  const tongue = M(new THREE.BoxGeometry(0.012, 0.004, 0.1), std(0xC72C41)); tongue.position.set(0, -0.02, 0.17); g.add(tongue);
  return g;
}

// ============================================================ REGISTRIES
export const ENV_THEMES = {
  'pea-drop': [
    { id: 'default', name: 'Default', accent: '#949494', bg: 0x0d0d18, plate: { color: 0x9a9da3, metal: 0.35, rough: 0.5 }, circle: 0x2c5f5a, ring: 0xb4b8be, pea: peaDefault, cup: cupDefault },
    { id: 'ocean', name: 'Ocean', accent: '#1E90FF', bg: 0x0a1830, plate: { color: 0x15628A, metal: 0.2, rough: 0.25, map: 'water' }, circle: 0xE8D9A8, ring: 0xC9A66A, pea: peaSeashell, cup: cupRingBuoy },
    { id: 'desert', name: 'Desert', accent: '#D9A65A', bg: 0x2a1d10, plate: { color: 0xE2B873, metal: 0.05, rough: 0.95, map: 'sand' }, circle: 0xC9A66A, ring: 0x8B6B3E, pea: peaCactusFruit, cup: cupPyramid },
    { id: 'jungle', name: 'Jungle', accent: '#4E7A33', bg: 0x0d1a0a, plate: { color: 0x3A5A28, metal: 0.05, rough: 0.9, map: 'grass' }, circle: 0x6B8E4E, ring: 0x4E7A33, pea: peaBanana, cup: cupAlligator },
  ],
  'triangle-transfer': [
    { id: 'default', name: 'Default', accent: '#4cc9ff', bg: 0x0d0d18, plate: { color: 0x9a9da3, metal: 0.35, rough: 0.5 }, circle: 0x4cc9ff, ring: 0x0b1430, tri: triDefault, end: endDefault },
    { id: 'desert', name: 'Desert', accent: '#D9A65A', bg: 0x2a1d10, plate: { color: 0xE2B873, metal: 0.05, rough: 0.95, map: 'sand' }, circle: 0xC9A66A, ring: 0x8B6B3E, tri: triPyramid, end: endOasis },
    { id: 'ocean', name: 'Ocean', accent: '#1E90FF', bg: 0x0a1830, plate: { color: 0x15628A, metal: 0.2, rough: 0.25, map: 'water' }, circle: 0xE8D9A8, ring: 0xC9A66A, tri: triAnchor, end: endIsland },
    { id: 'jungle', name: 'Jungle', accent: '#4E7A33', bg: 0x0d1a0a, plate: { color: 0x3A5A28, metal: 0.05, rough: 0.9, map: 'grass' }, circle: 0x6B8E4E, ring: 0x4E7A33, tri: triBonfire, end: endRocks },
  ],
  'cobra-rope': [
    { id: 'default', name: 'Default', accent: '#a8a8a8', bg: 0x0d0d18, plate: { color: 0x9a9da3, metal: 0.35, rough: 0.5 }, circle: 0xFDFDFD },
    { id: 'jungle', name: 'Snake Pit', accent: '#4E7A33', bg: 0x0d1a0a, plate: { color: 0x3A5A28, metal: 0.05, rough: 0.9, map: 'grass' }, circle: 0x6B8E4E, ropeColors: { blue: 0x2E5A2A, red: 0xC72C41, white: 0x6E9A53 }, head: buildSnakeHead },
    { id: 'ocean', name: 'Harbor', accent: '#1E90FF', bg: 0x0a1830, plate: { color: 0x15628A, metal: 0.2, rough: 0.25, map: 'water' }, circle: 0xE8D9A8, boat: true },
  ],
};
export const INSTRUMENT_THEMES = {
  'pea-drop': [
    { id: 'default', name: 'Standard', accent: '#c4c4cc', kind: 'grasper', theme: { shaft: 0x15161a, jaw: 0xc4c4cc, hinge: 0x808088, serr: 0xa0a0a8 } },
    { id: 'fishing-rod', name: 'Fishing Rod', accent: '#2E8B8B', kind: 'grasper', theme: { shaft: 0x0E5A5A, jaw: 0xD4D4D4, hinge: 0x6B3E1E, style: 'fishing' } },
    { id: 'desert', name: 'Desert', accent: '#D9A65A', kind: 'grasper', theme: { shaft: 0xB8853B, jaw: 0x8B5A2B, hinge: 0x5A3D1F, serr: 0x6b4520, style: 'desert' } },
    { id: 'branch', name: 'Jungle Branch', accent: '#4E7A33', kind: 'grasper', theme: { shaft: 0x5C3A1E, jaw: 0x8B6B3E, hinge: 0x3A2410, serr: 0x6b5030, style: 'branch' } },
  ],
  'triangle-transfer': [
    { id: 'default', name: 'Standard', accent: '#dcdce4', kind: 'hook', theme: { shaft: 0x141518, hook: 0xdcdce4 } },
    { id: 'candy-cane', name: 'Candy Cane', accent: '#E53935', kind: 'hook', theme: { shaft: 0xF5F5F5, hook: 0xE53935, style: 'candy' } },
    { id: 'pirate-hook', name: 'Pirate Hook', accent: '#8B6B3E', kind: 'hook', theme: { shaft: 0x8B6B3E, hook: 0xC0C0C8, style: 'pirate' } },
  ],
};
export function envTheme(drillId, id) { const l = ENV_THEMES[drillId]; return l ? (l.find((t) => t.id === id) || l[0]) : null; }
export function instTheme(drillId, id) { const l = INSTRUMENT_THEMES[drillId]; return l ? (l.find((t) => t.id === id) || l[0]) : null; }
export function plateMap(name) { return name === 'sand' ? sandTex() : name === 'water' ? waterTex() : name === 'grass' ? grassTex() : null; }
