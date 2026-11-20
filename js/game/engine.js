// Shared 3D core: renderer/scene setup, the box-trainer environment, procedural textures,
// the laparoscopic tool rig (fulcrum about a port, spring-damper tip) and motion metrics.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export { THREE };
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;

// ---------------------------------------------------------------- procedural textures
const texCache = new Map();
function canvasTex(key, w, hgt, draw, { repeat = [1, 1], srgb = true } = {}) {
  const k = key + repeat.join('x');
  if (texCache.has(k)) return texCache.get(k);
  const c = document.createElement('canvas'); c.width = w; c.height = hgt;
  draw(c.getContext('2d'), w, hgt);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat);
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  texCache.set(k, t);
  return t;
}
function rnd(seed) { let s = seed; return () => ((s = (s * 16807) % 2147483647) / 2147483647); }

/** Brushed-metal roughness map (grey streaks) used on plates and pegboards. */
export function brushedRough(repeat = [1, 1]) {
  return canvasTex('brushed', 512, 512, (g, w, h) => {
    const r = rnd(7);
    g.fillStyle = '#808080'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) {
      const y = r() * h; const l = 40 + r() * 260; const x = r() * w;
      const v = 100 + r() * 70 | 0; g.strokeStyle = `rgba(${v},${v},${v},${0.25 + r() * 0.35})`;
      g.lineWidth = 0.6 + r() * 1.2; g.beginPath(); g.moveTo(x, y); g.lineTo(x + l, y + (r() - 0.5) * 2); g.stroke();
    }
    // scuffs
    for (let i = 0; i < 40; i++) { g.strokeStyle = `rgba(40,40,40,${r() * 0.25})`; g.lineWidth = 0.5; g.beginPath(); const x = r() * w, y = r() * h; g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 60, y + (r() - 0.5) * 60); g.stroke(); }
  }, { repeat, srgb: false });
}
/** Subtle colour variation map for metal (multiplied with the base colour). */
export function metalAlbedo(repeat = [1, 1]) {
  return canvasTex('metalAlb', 512, 512, (g, w, h) => {
    const r = rnd(11);
    g.fillStyle = '#f0f0f0'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 1800; i++) { const v = 215 + r() * 40 | 0; g.fillStyle = `rgba(${v},${v},${v},0.35)`; g.fillRect(r() * w, r() * h, 30 + r() * 200, 1); }
    const gr = g.createRadialGradient(w * .5, h * .5, 10, w * .5, h * .5, w * .7); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(160,160,160,0.25)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  }, { repeat });
}
/** Dark neoprene / foam for the trainer box interior. */
export function foamTex(repeat = [4, 4]) {
  return canvasTex('foam', 256, 256, (g, w, h) => {
    const r = rnd(3);
    g.fillStyle = '#1b1b1f'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 6000; i++) { const v = 18 + r() * 26 | 0; g.fillStyle = `rgb(${v},${v},${v + 3})`; g.fillRect(r() * w, r() * h, 1.5, 1.5); }
  }, { repeat });
}
/** Generic bump/noise normal-ish map for soft tissue and plastics. */
export function noiseTex(key = 'noise', repeat = [2, 2], scale = 1) {
  return canvasTex(key, 256, 256, (g, w, h) => {
    const r = rnd(key.length * 31 + 5);
    g.fillStyle = '#8080ff'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 4000 * scale; i++) {
      const x = r() * w, y = r() * h, rad = 1 + r() * 4;
      const gr = g.createRadialGradient(x, y, 0, x, y, rad);
      const dx = (r() - 0.5) * 60 | 0, dy = (r() - 0.5) * 60 | 0;
      gr.addColorStop(0, `rgba(${128 + dx},${128 + dy},255,0.5)`); gr.addColorStop(1, 'rgba(128,128,255,0)');
      g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
  }, { repeat, srgb: false });
}
/** Orange chevrons for the transfer path cue. */
export function chevronTex() {
  return canvasTex('chev', 256, 64, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = '#ff8a1f'; g.strokeStyle = '#0b1430'; g.lineWidth = 4; g.lineJoin = 'round';
    for (let x = -32; x < w; x += 48) { g.beginPath(); g.moveTo(x, 6); g.lineTo(x + 22, 6); g.lineTo(x + 44, h / 2); g.lineTo(x + 22, h - 6); g.lineTo(x, h - 6); g.lineTo(x + 22, h / 2); g.closePath(); g.fill(); g.stroke(); }
  }, { repeat: [3, 1] });
}
export function stripeTex(key, a, b, n = 8) {
  return canvasTex('stripe' + key, 64, 256, (g, w, h) => {
    g.fillStyle = a; g.fillRect(0, 0, w, h); g.fillStyle = b;
    for (let i = 0; i < n; i++) { g.save(); g.translate(0, (i / n) * h); g.transform(1, 0.6, 0, 1, 0, 0); g.fillRect(0, -h / n * 0.3, w, h / n * 0.45); g.restore(); }
  }, { repeat: [1, 6] });
}
export function woodTex() {
  return canvasTex('wood', 128, 512, (g, w, h) => {
    const r = rnd(19);
    g.fillStyle = '#6b4423'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 70; i++) { g.strokeStyle = `rgba(${40 + r() * 40 | 0},${22 + r() * 20 | 0},8,${0.3 + r() * 0.4})`; g.lineWidth = 1 + r() * 3; g.beginPath(); const x = r() * w; g.moveTo(x, 0); g.bezierCurveTo(x + (r() - .5) * 20, h * .3, x + (r() - .5) * 20, h * .7, x + (r() - .5) * 10, h); g.stroke(); }
  }, { repeat: [1, 4] });
}
export function sandTex() {
  return canvasTex('sand', 256, 256, (g, w, h) => {
    const r = rnd(23);
    g.fillStyle = '#e2b873'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 9000; i++) { const v = r(); g.fillStyle = v > .5 ? `rgba(255,236,190,${r() * .5})` : `rgba(150,105,50,${r() * .4})`; g.fillRect(r() * w, r() * h, 1.4, 1.4); }
    for (let y = 0; y < h; y += 18) { g.strokeStyle = 'rgba(170,120,60,.18)'; g.lineWidth = 3; g.beginPath(); for (let x = 0; x <= w; x += 8) g.lineTo(x, y + Math.sin(x * 0.05 + y) * 4); g.stroke(); }
  }, { repeat: [3, 3] });
}
export function waterTex() {
  return canvasTex('water', 256, 256, (g, w, h) => {
    const r = rnd(29);
    const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#1a6f9a'); gr.addColorStop(1, '#0f4f75');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 220; i++) { g.strokeStyle = `rgba(190,235,255,${0.08 + r() * 0.18})`; g.lineWidth = 1 + r() * 2; g.beginPath(); const x = r() * w, y = r() * h; g.arc(x, y, 6 + r() * 26, r() * 6, r() * 6 + 1.2); g.stroke(); }
  }, { repeat: [2, 2] });
}
export function grassTex() {
  return canvasTex('grass', 256, 256, (g, w, h) => {
    const r = rnd(31);
    g.fillStyle = '#3a5a28'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 7000; i++) { g.fillStyle = `rgba(${40 + r() * 60 | 0},${80 + r() * 70 | 0},${20 + r() * 30 | 0},${0.4 + r() * 0.5})`; const x = r() * w, y = r() * h; g.fillRect(x, y, 1.2, 3 + r() * 5); }
  }, { repeat: [3, 3] });
}

// ---------------------------------------------------------------- viewport (renderer + scene + lights)
let sharedEnv = null;
function envFor(renderer) {
  if (sharedEnv && sharedEnv.renderer === renderer) return sharedEnv.tex;
  const pm = new THREE.PMREMGenerator(renderer);
  const tex = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  pm.dispose();
  sharedEnv = { renderer, tex };
  return tex;
}

const lowEnd = () => (matchMedia('(pointer: coarse)').matches && Math.min(screen.width, screen.height) < 500) || (navigator.deviceMemory && navigator.deviceMemory <= 4) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);

export class Viewport {
  /**
   * post: render through the scope-lens chain (bloom, barrel distortion, chromatic fringe, round mask, grain).
   * Lighting model: one strong overhead key light carries crisp shadows (the depth cue), a softer
   * scope light rides with the camera for the bright centre, and the room environment stays low so
   * shadows aren't washed out.
   */
  constructor(container, { alpha = false, bg = 0x0d0d18, fog = true, shadows = true, fov = 48, exposure = 1.0, post = false, preserve = false } = {}) {
    this.container = container;
    const r = this.renderer = new THREE.WebGLRenderer({ antialias: !post, alpha, powerPreference: 'high-performance', preserveDrawingBuffer: preserve });
    this.maxDpr = lowEnd() ? 1.5 : 2;
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.maxDpr));
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = exposure;
    r.shadowMap.enabled = shadows; r.shadowMap.type = THREE.PCFSoftShadowMap;
    if (alpha) r.setClearColor(0x000000, 0);
    container.append(r.domElement);
    const s = this.scene = new THREE.Scene();
    if (!alpha) s.background = new THREE.Color(bg);
    if (fog && !alpha) s.fog = new THREE.Fog(bg, 14, 30);
    s.environment = envFor(r);
    s.environmentIntensity = 0.22;
    this.camera = new THREE.PerspectiveCamera(fov, 1, 0.05, 120);
    this.camera.position.set(0, 5.8, 5.8); this.camera.lookAt(0, 0, 1.5);
    this.addLights();
    this.root = new THREE.Group(); s.add(this.root);
    this.post = post ? new ScopePost(r, s, this.camera) : null;
    this._ro = new ResizeObserver(() => this.resize()); this._ro.observe(container);
    this.resize();
  }
  addLights() {
    const s = this.scene;
    s.add(new THREE.HemisphereLight(0xe8eeff, 0x15110d, 0.32));
    // Overhead key: crisp shadows, offset left/back so shadows fall toward the viewer and are visible.
    const key = this.keyLight = new THREE.SpotLight(0xfff8f0, 46, 0, 0.78, 0.5, 1.25);
    key.position.set(-4.6, 7.2, -2.2); key.target.position.set(0.3, 0, 1.4);
    key.castShadow = true; key.shadow.mapSize.set(lowEnd() ? 1024 : 2048, lowEnd() ? 1024 : 2048);
    key.shadow.bias = -0.00025; key.shadow.normalBias = 0.012; key.shadow.radius = 2.2;
    key.shadow.camera.near = 3; key.shadow.camera.far = 22;
    s.add(key, key.target);
    // Scope light: coaxial-ish with the camera, no shadows — the hot centre and dark periphery.
    const scope = this.scopeLight = new THREE.SpotLight(0xfff1e0, 18, 0, 0.6, 0.95, 1.6);
    scope.position.set(0.2, 6.2, 6.8); scope.target.position.set(0, 0, 1.2);
    s.add(scope, scope.target);
    const rim = new THREE.DirectionalLight(0xb8c8ff, 0.45); rim.position.set(2, 5, -8); s.add(rim);
  }
  resize() {
    const w = this.container.clientWidth || 1, h = this.container.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    const base = this.baseFov || this.camera.fov;
    this.baseFov = base;
    this.camera.fov = w / h < 1.45 ? base * (1.45 / (w / h)) ** 0.55 : base;
    this.camera.updateProjectionMatrix();
    this.post?.setSize(w, h, this.renderer.getPixelRatio());
  }
  render(dt = 0.016) { if (this.adaptive) this.govern(dt); if (this.post && !this.postOff) this.post.render(dt); else this.renderer.render(this.scene, this.camera); }
  /** Adaptive quality for school tablets: if frames stay slow (< ~45 fps) for a few seconds, note that one
   *  notch less would help (smaller shadows, then no lens effects, then lower resolution, then no shadows).
   *  Nothing changes mid-run (that looked like a random zoom / lighting change); the session saves the
   *  wish and the next drill starts at that quality. */
  govern(dt) {
    if (dt <= 0 || dt > 0.1 || document.hidden) return; // hidden or throttled frames say nothing about speed
    this._ft = this._ft === undefined ? dt : this._ft * 0.95 + dt * 0.05;
    this._slow = this._ft > 0.022 ? (this._slow || 0) + dt : 0;
    this._cool = Math.max(0, (this._cool || 0) - dt);
    if (this._slow < 2.5 || this._cool > 0) return;
    this._slow = 0; this._cool = 3; this.wantStep = Math.min(4, (this.qStep || 0) + 1); // at most one notch per run
  }
  /** Apply a quality notch at start-up (0 = full). */
  applyQuality(step) {
    while ((this.qStep || 0) < Math.min(4, step)) this.stepDown();
  }
  stepDown() {
    this.qStep = (this.qStep || 0) + 1;
    const r = this.renderer, key = this.keyLight;
    if (this.qStep === 1) { key.shadow.mapSize.set(1024, 1024); key.shadow.map?.dispose(); key.shadow.map = null; }
    else if (this.qStep === 2 && this.post) this.postOff = true;
    else if (this.qStep <= 3) { this.maxDpr = 1; r.setPixelRatio(1); this.resize(); }
    else if (this.qStep === 4) { r.shadowMap.enabled = false; this.scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; }); }
    this.onQuality?.(this.qStep);
  }
  dispose() {
    this._ro.disconnect();
    this.scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
    });
    this.post?.dispose();
    if (sharedEnv?.renderer === this.renderer) { sharedEnv.tex.dispose(); sharedEnv = null; }
    this.renderer.dispose();
    this.renderer.forceContextLoss?.();
    this.renderer.domElement.remove();
  }
}

// ---------------------------------------------------------------- scope lens post-processing
const ScopeShader = {
  uniforms: { tDiffuse: { value: null }, uAspect: { value: 1.78 }, uTime: { value: 0 }, uK: { value: 0.045 }, uCA: { value: 0.0045 }, uVig: { value: 0.55 }, uGrain: { value: 0.035 }, uRadius: { value: 2 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uAspect, uTime, uK, uCA, uVig, uGrain, uRadius; varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    vec2 toUv(vec2 q){ return vec2(q.x / uAspect, q.y) * 0.5 + 0.5; }
    void main(){
      vec2 p = vUv * 2.0 - 1.0; p.x *= uAspect;
      float r2 = dot(p, p) / (uAspect * uAspect);
      vec2 d = p * (1.0 - uK + uK * r2);
      vec2 dir = normalize(d + 1e-5);
      float ca = uCA * r2;
      vec3 col;
      col.r = texture2D(tDiffuse, toUv(d + dir * ca)).r;
      col.g = texture2D(tDiffuse, toUv(d)).g;
      col.b = texture2D(tDiffuse, toUv(d - dir * ca)).b;
      float rr = length(p) / uRadius;
      float mask = 1.0 - smoothstep(0.9, 1.0, rr);
      float vig = 1.0 - uVig * smoothstep(0.35, 1.0, rr);
      col *= vig * mask;
      col += (hash(vUv * 731.0 + fract(uTime * 7.3)) - 0.5) * uGrain;
      gl_FragColor = vec4(col, 1.0);
    }`,
};

class ScopePost {
  constructor(renderer, scene, camera) {
    this.renderer = renderer; this.t = 0; this.ready = false;
    Promise.all([
      import('three/addons/postprocessing/EffectComposer.js'), import('three/addons/postprocessing/RenderPass.js'),
      import('three/addons/postprocessing/UnrealBloomPass.js'), import('three/addons/postprocessing/ShaderPass.js'),
      import('three/addons/postprocessing/OutputPass.js'),
    ]).then(([{ EffectComposer }, { RenderPass }, { UnrealBloomPass }, { ShaderPass }, { OutputPass }]) => {
      const c = this.composer = new EffectComposer(renderer);
      c.addPass(new RenderPass(scene, camera));
      this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.16, 0.4, 0.97);
      c.addPass(this.bloom);
      c.addPass(new OutputPass());
      this.scope = new ShaderPass(ScopeShader); c.addPass(this.scope);
      this.ready = true;
      if (this._size) this.setSize(...this._size);
    }).catch(() => { this.failed = true; });
    this.scene = scene; this.camera = camera;
  }
  setSize(w, h, dpr) {
    this._size = [w, h, dpr];
    if (!this.ready) return;
    this.composer.setPixelRatio(dpr); this.composer.setSize(w, h);
    const a = w / h; this.scope.uniforms.uAspect.value = a;
    this.scope.uniforms.uRadius.value = Math.sqrt(a * a + 1) * 0.985;
  }
  render(dt) {
    if (!this.ready) { this.renderer.render(this.scene, this.camera); return; }
    this.t += dt; this.scope.uniforms.uTime.value = this.t;
    this.composer.render(dt);
  }
  dispose() { this.composer?.dispose(); }
}

// ---------------------------------------------------------------- contact shadows
let blobTex = null;
function blobTexture() {
  if (blobTex) return blobTex;
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.35, 'rgba(0,0,0,0.7)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  blobTex = new THREE.CanvasTexture(c); return blobTex;
}
/** Soft ambient-occlusion blob on the surface under an object; darker and tighter the closer it is. */
export class Blob {
  constructor(parent, size = 0.3, strength = 0.55) {
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false, opacity: strength, polygonOffset: true, polygonOffsetFactor: -2, toneMapped: false }));
    this.mesh.rotation.x = -Math.PI / 2; this.mesh.renderOrder = 1; this.size = size; this.strength = strength;
    parent.add(this.mesh);
  }
  set(x, z, surface, height, visible = true) {
    const m = this.mesh; m.visible = visible; if (!visible) return;
    const hgt = Math.max(0, height);
    m.position.set(x, surface + 0.004, z);
    const s = this.size * (1 + hgt * 1.2); m.scale.set(s, s, 1);
    m.material.opacity = this.strength * Math.max(0, 1 - hgt * 0.9);
  }
}

/** Trainer-box interior: foam floor, dark neoprene walls, port grommets. */
export function buildTrainerBox(parent, { bg = 0x0d0d18 } = {}) {
  const g = new THREE.Group();
  const foam = new THREE.MeshStandardMaterial({ color: 0x3a3a40, map: foamTex([8, 8]), roughness: 0.97, metalness: 0 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(26, 22), foam);
  floor.rotation.x = -Math.PI / 2; floor.position.set(0, -0.31, 0); floor.receiveShadow = true;
  g.add(floor);
  const wallMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(bg).lerp(new THREE.Color(0x2c2c33), 0.75), map: foamTex([6, 3]), roughness: 1 });
  const back = new THREE.Mesh(new THREE.PlaneGeometry(26, 8), wallMat); back.position.set(0, 3.6, -5.2); back.receiveShadow = true;
  const lw = new THREE.Mesh(new THREE.PlaneGeometry(22, 8), wallMat); lw.rotation.y = Math.PI / 2; lw.position.set(-6.4, 3.6, 2); lw.receiveShadow = true;
  const rw = lw.clone(); rw.rotation.y = -Math.PI / 2; rw.position.x = 6.4;
  // soft corner shading where walls meet the floor
  const sh = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.45, depthWrite: false });
  const strip = (w, x, z, ry) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, 1.6), sh); m.rotation.set(-Math.PI / 2, 0, ry); m.position.set(x, -0.3, z); g.add(m); };
  strip(26, 0, -4.5, 0); strip(22, -5.7, 2, Math.PI / 2); strip(22, 5.7, 2, Math.PI / 2);
  g.add(back, lw, rw);
  parent.add(g);
  return g;
}
function rulerTex() {
  return canvasTex('ruler', 1024, 32, (g, w, h) => {
    g.fillStyle = '#d9d4c7'; g.fillRect(0, 0, w, h); g.fillStyle = '#222';
    for (let i = 0; i <= 100; i++) { const x = (i / 100) * w; g.fillRect(x, 0, 1.5, i % 10 === 0 ? 18 : i % 5 === 0 ? 12 : 7); if (i % 10 === 0 && i < 100) { g.font = '10px monospace'; g.fillText(String(i / 10), x + 3, 28); } }
  });
}

/** The working plate. Satin-finished by default so shadows read clearly. */
export function makePlate(parent, { size = 7.2, depth, z = 0.8, color = 0x9a9da3, metal = 0.35, rough = 0.5, transparent = false, opacity = 1, map = null, thickness = 0.3 } = {}) {
  const d = depth ?? size;
  const isMetal = metal > 0.2;
  const mat = new THREE.MeshStandardMaterial({
    color, metalness: metal, roughness: rough, transparent, opacity,
    map: map || (isMetal ? metalAlbedo([1, 1]) : null),
    roughnessMap: isMetal ? brushedRough([1.5, 1.5]) : null,
  });
  const geo = roundedBox(size, thickness, d, 0.06);
  const plate = new THREE.Mesh(geo, mat);
  plate.position.set(0, -thickness / 2, z); plate.receiveShadow = true; plate.castShadow = true;
  parent.add(plate);
  // corner screws
  const screwMat = new THREE.MeshStandardMaterial({ color: 0x8c9096, metalness: 1, roughness: 0.3 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const sc = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.02, 20), screwMat);
    sc.position.set(sx * (size / 2 - 0.22), 0.005, z + sz * (d / 2 - 0.22)); sc.receiveShadow = true; parent.add(sc);
    const slot = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.012, 0.016), new THREE.MeshStandardMaterial({ color: 0x2a2a2a }));
    slot.position.copy(sc.position); slot.position.y += 0.008; slot.rotation.y = (sx * sz) * 0.7; parent.add(slot);
  }
  return plate;
}
/** Box with rounded vertical edges (extruded rounded rectangle). */
export function roundedBox(w, h, d, r) {
  const s = new THREE.Shape(); const x = -w / 2, z = -d / 2;
  s.moveTo(x + r, z); s.lineTo(x + w - r, z); s.quadraticCurveTo(x + w, z, x + w, z + r); s.lineTo(x + w, z + d - r); s.quadraticCurveTo(x + w, z + d, x + w - r, z + d);
  s.lineTo(x + r, z + d); s.quadraticCurveTo(x, z + d, x, z + d - r); s.lineTo(x, z + r); s.quadraticCurveTo(x, z, x + r, z);
  const g = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: true, bevelThickness: Math.min(0.03, h * 0.15), bevelSize: Math.min(0.03, r * 0.5), bevelSegments: 3, curveSegments: 6 });
  g.rotateX(Math.PI / 2); g.computeBoundingBox();
  g.translate(0, h / 2 - g.boundingBox.max.y, 0); // top face exactly at +h/2 (bevel included)
  // planar UVs from x/z so textures map like a box top
  const pos = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / w + 0.5, pos.getZ(i) / d + 0.5);
  g.computeVertexNormals();
  return g;
}

// ---------------------------------------------------------------- tool rig
const UP = V(0, 1, 0);
const _m = new THREE.Matrix4(); const _q = new THREE.Quaternion(); const _qr = new THREE.Quaternion();
const _x = V(), _y = V(), _z = V(), _t = V(), _o = V(), _r = V(), _f = V();

/**
 * One laparoscopic instrument. The controlled point is the grip point at the jaws; the shaft always
 * passes through the fixed port (fulcrum). Inputs move a target; the real tip follows it with a
 * spring-damper so motion has weight (and measurable jerk/smoothness).
 */
export class Tool {
  /** camera axes (set by the drill screen) so keyboard moves follow the screen */
  static view = { right: new THREE.Vector3(1, 0, 0), up: new THREE.Vector3(0, 0.7, -0.7).normalize() };
  constructor(parent, inst, { port, start, mode = 'sphere', minLen = 1.2, maxLen = 7.6, maxCone = 1.05, bounds = null, roll = 0, jaw = 0.5, plane = null, maxJaw = 0.55, label = '' }) {
    this.inst = inst; this.label = label;
    this.port = port.clone(); this.mode = mode; this.minLen = minLen; this.maxLen = maxLen; this.maxCone = maxCone;
    this.bounds = bounds || { minX: -3.6, maxX: 3.6, minY: 0, maxY: 3.2, minZ: -2.8, maxZ: 4.4 };
    this.plane = plane;
    this.start = start.clone();
    this.baseDir = start.clone().sub(port).normalize();
    this.target = start.clone(); this.tip = start.clone(); this.vel = V(); this.dir = this.baseDir.clone();
    this.roll0 = roll; this.roll = roll; this.rollT = roll;
    this.jaw0 = jaw; this.jaw = jaw; this.jawT = jaw; this.maxJaw = maxJaw;
    this.floor = () => 0; this.floorClear = 0.015;
    this.contact = false; this.frozen = false;
    this.k = 120; this.c = 14;
    parent.add(inst.group);
    this.blob = new Blob(parent, 0.42, 0.6);
    this.sync();
  }
  reset() {
    this.target.copy(this.start); this.tip.copy(this.start); this.vel.set(0, 0, 0);
    this.roll = this.rollT = this.roll0; this.jaw = this.jawT = this.jaw0; this.frozen = false; this.sync();
  }
  get depth01() { return clamp((this.target.distanceTo(this.port) - this.minLen) / (this.maxLen - this.minLen), 0, 1); }

  /**
   * inp: { abs (pointer target), delta (trackpad drag), mx/my (stick/keys rate), height (rate), heightAbs (0..1),
   *        rot (rate), depth/depthAbs (legacy aliases for height) }
   * Movement happens in screen-friendly axes: left/right, forward/back, and straight up/down for height.
   * The shaft always pivots about the port; reach and angle limits come from the port.
   */
  input(inp, dt, sens = {}) {
    if (this.frozen) return;
    const sm = (sens.move ?? 1), sd = (sens.depth ?? 1), sr = (sens.rot ?? 1);
    const T = this.target, plane = this.mode === 'plane';
    if (inp.abs) { if (plane) { T.x = inp.abs.x; T.y = inp.abs.y; } else { T.x = inp.abs.x; T.z = inp.abs.z; } }
    if (inp.delta) { T.x += inp.delta.x; if (plane) T.y += inp.delta.y; else T.z += inp.delta.z; }
    if (inp.mx) T.x += inp.mx * 2.0 * sm * dt;
    if (inp.my) { if (plane) T.y += inp.my * 1.6 * sm * dt; else T.z -= inp.my * 2.0 * sm * dt; }
    if (plane && inp.orbit) { T.x += inp.orbit.x * 2.0 * sm * dt; T.y += inp.orbit.y * 1.6 * sm * dt; }
    if (!plane && (inp.orbit || inp.insert)) {
      // like a real laparoscope: the shaft pivots in the port. Arrows swing the tip over a sphere of
      // constant radius (insertion depth); in/out changes only that radius, along the shaft.
      const rel = _t.copy(T).sub(this.port); let r = rel.length();
      if (inp.orbit) {
        // pure swing on the sphere around the port (radius = how far the grasper is in, never changes):
        // left/right turns the shaft around the vertical axis through the port, up/down tilts the tip
        // up or down. It follows the sphere, not the screen.
        const dir = _o.copy(rel).normalize();
        const side = _r.copy(dir).cross(_f.set(0, 1, 0)); // horizontal swing direction (tip goes "right" of the shaft)
        if (side.lengthSq() < 1e-6) side.set(1, 0, 0); side.normalize();
        const lift = _f.set(0, 1, 0).addScaledVector(dir, -dir.y); // tilt direction (tip goes up)
        if (lift.lengthSq() < 1e-6) lift.copy(side).cross(dir); lift.normalize();
        rel.addScaledVector(side, inp.orbit.x * 2.0 * sm * dt).addScaledVector(lift, inp.orbit.y * 2.0 * sm * dt).setLength(r);
      }
      if (inp.insert) { r = Math.max(this.minLen, Math.min(this.maxLen, r + inp.insert * 1.5 * sd * dt)); rel.setLength(r); }
      T.copy(this.port).add(rel);
    }
    if (!plane) {
      const fl = this.floor(T.x, T.z);
      const hAbs = inp.heightAbs ?? inp.depthAbs ?? null;
      if (hAbs != null) T.y = fl + this.floorClear + hAbs * 2.0;
      else T.y += ((inp.height || 0) - (inp.depth || 0)) * 1.6 * sd * dt;
      if (inp.heightStep) T.y += inp.heightStep;
      // reach (shaft length) and angle limits around the port
      const rel = _t.copy(T).sub(this.port); let len = rel.length();
      const cl = Math.max(this.minLen, Math.min(this.maxLen, len)); if (cl !== len) { rel.setLength(cl); len = cl; }
      const ang = rel.angleTo(this.baseDir);
      if (ang > this.maxCone) { const axis = _x.copy(this.baseDir).cross(rel).normalize(); if (axis.lengthSq() > 0) rel.copy(this.baseDir).applyAxisAngle(axis, this.maxCone).setLength(len); }
      T.copy(this.port).add(rel);
    } else if (this.plane) T.z = this.plane.z;
    const b = this.bounds;
    T.x = clamp(T.x, b.minX, b.maxX); T.y = clamp(T.y, b.minY, b.maxY); T.z = clamp(T.z, b.minZ, b.maxZ);
    const fl = this.floor(T.x, T.z) + this.floorClear;
    if (T.y < fl) T.y = fl;
    if (inp.rot) this.rollT += inp.rot * 2.6 * sr * dt;
    if (inp.jaw) this.jawT = clamp(this.jawT + inp.jaw * 1.8 * (sens.jaw ?? 1) * dt, 0, 1);
  }
  step(dt) {
    // spring-damper with sub-steps for stability
    let rem = dt;
    while (rem > 1e-5) {
      const h = Math.min(rem, 1 / 120); rem -= h;
      const ax = this.k * (this.target.x - this.tip.x) - this.c * this.vel.x;
      const ay = this.k * (this.target.y - this.tip.y) - this.c * this.vel.y;
      const az = this.k * (this.target.z - this.tip.z) - this.c * this.vel.z;
      this.vel.x += ax * h; this.vel.y += ay * h; this.vel.z += az * h;
      this.tip.x += this.vel.x * h; this.tip.y += this.vel.y * h; this.tip.z += this.vel.z * h;
    }
    // floor: the lowest point of the instrument (jaw tips) must stay above the surface
    this.contact = false;
    const low = this.inst.lowOffset ? this.inst.lowOffset(this) : 0;
    const fl = this.floor(this.tip.x, this.tip.z) + 0.004 - low;
    if (this.tip.y < fl) { this.tip.y = fl; if (this.vel.y < 0) this.vel.y = 0; this.contact = true; }
    this.roll += (this.rollT - this.roll) * Math.min(1, dt * 14);
    this.jaw += (this.jawT - this.jaw) * Math.min(1, dt * (this.jawT < this.jaw ? 34 : 16)); // snap shut, open gently
    this.sync();
    const surf = this.floor(this.tip.x, this.tip.z);
    this.blob.set(this.tip.x, this.tip.z, surf, this.tip.y + low - surf);
  }
  sync() {
    this.dir.copy(this.tip).sub(this.port).normalize();
    _z.copy(this.dir);
    _x.copy(UP).cross(_z); if (_x.lengthSq() < 1e-6) _x.set(1, 0, 0); _x.normalize();
    _y.copy(_z).cross(_x).normalize();
    _m.makeBasis(_x, _y, _z);
    _q.setFromRotationMatrix(_m);
    _qr.setFromAxisAngle(V(0, 0, 1), this.roll);
    const g = this.inst.group;
    g.position.copy(this.tip);
    g.quaternion.copy(_q).multiply(_qr);
    // shaft length from grip back to (and past) the port
    this.inst.setShaft?.(this.tip.distanceTo(this.port) + 3.5);
    this.inst.setJaw?.(this.jaw * this.maxJaw);
    g.updateMatrixWorld(true);
  }
  /** World position of a local instrument point (e.g. jaw tips). */
  world(local, out = V()) { return out.copy(local).applyMatrix4(this.inst.group.matrixWorld); }
  speed() { return this.vel.length(); }
}

// ---------------------------------------------------------------- metrics
export class Metrics {
  constructor() { this.reset(); }
  reset() {
    this.time = 0; this.pathLength = 0; this.maxVelocity = 0; this.sumJerkSq = 0; this.snapCount = 0;
    this.timeInMotion = 0; this.timeStill = 0; this._v = 0; this._a = 0; this._snapCool = 0;
    this._prev = null;
  }
  /** tips: array of Vector3 (all instruments). */
  update(dt, tips) {
    if (dt <= 0) return;
    this.time += dt;
    if (!this._prev) { this._prev = tips.map((t) => t.clone()); return; }
    let d = 0;
    tips.forEach((t, i) => { d += t.distanceTo(this._prev[i]); this._prev[i].copy(t); });
    const speed = d / dt;
    this.pathLength += d;
    this.maxVelocity = Math.max(this.maxVelocity, speed);
    const v = lerp(this._v, speed, 0.12);
    const a = lerp(this._a, (v - this._v) / dt, 0.12);
    const jerk = (a - this._a) / dt;
    this._v = v; this._a = a;
    this.sumJerkSq += jerk * jerk * dt;
    this._snapCool -= dt;
    if (Math.abs(jerk) > 8 * 30 && this._snapCool <= 0) { this.snapCount++; this._snapCool = 0.35; }
    if (speed > 0.15) this.timeInMotion += dt; else this.timeStill += dt;
  }
  final(extra = {}) {
    const T = Math.max(this.time, 0.1), L = Math.max(this.pathLength, 0.1);
    const dj = -Math.log(Math.sqrt(0.5 * this.sumJerkSq * T ** 5 / (L * L + 0.001)) + 1e-9);
    return {
      time: this.time, pathLength: this.pathLength, meanVelocity: this.pathLength / T, maxVelocity: this.maxVelocity,
      dimensionlessJerk: dj, timeInMotion: this.timeInMotion, timeStill: this.timeStill, snapCount: this.snapCount, ...extra,
    };
  }
}
