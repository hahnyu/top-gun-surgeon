// 3D previews: a live turntable for the drill-select screen and cached snapshots for shop cards.
import { THREE, Viewport } from './engine.js';
import { drillById } from './drills/index.js';
import { envTheme, instTheme } from './themes.js';
import { instrumentPreview } from './instruments.js';
import { store } from '../store.js';

function buildDrillGroup(drillId, envId) {
  const def = drillById(drillId);
  const sel = store.getSelection(drillId);
  const env = envTheme(drillId, envId ?? sel.env) || envTheme('pea-drop', 'default');
  const inst = instTheme(drillId, sel.instrument);
  const g = new THREE.Group();
  const d = new def.cls({ root: g, level: 'BEGINNER', hand: 'RIGHT', env, inst, preview: true });
  return { group: g, drill: d, env };
}

/** Live rotating preview of a drill's board. */
export class Turntable {
  constructor(container) {
    this.vp = new Viewport(container, { alpha: true, fog: false, fov: 34, exposure: 1.05 });
    this.vp.scopeLight.position.set(3, 9, 7); this.vp.scopeLight.target.position.set(0, 0, 0); this.vp.scopeLight.intensity = 90; this.vp.scopeLight.angle = 0.7;
    this.vp.camera.position.set(0, 7.2, 9.6); this.vp.camera.lookAt(0, -0.3, 0);
    this.spin = new THREE.Group(); this.vp.scene.add(this.spin);
    // soft contact shadow under the board
    const sh = new THREE.Mesh(new THREE.CircleGeometry(5.6, 48), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.45 }));
    sh.rotation.x = -Math.PI / 2; sh.position.y = -0.36; this.vp.scene.add(sh);
    this.angle = 0; this.cur = null; this.scale = 1; this.raf = 0; this.last = performance.now();
    const loop = (now) => { this.raf = requestAnimationFrame(loop); const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now; this.tick(dt); };
    this.raf = requestAnimationFrame(loop);
  }
  show(drillId) {
    if (this.cur) { const old = this.cur; this.cur = null; this.spin.remove(old.group); old.group.traverse((o) => { o.geometry?.dispose(); }); }
    const b = buildDrillGroup(drillId);
    // centre the board on the turntable
    const box = new THREE.Box3().setFromObject(b.group); const c = box.getCenter(new THREE.Vector3());
    b.group.position.set(-c.x, 0, -c.z);
    const size = box.getSize(new THREE.Vector3()); this.targetScale = 5.7 / Math.max(size.x, size.z);
    this.spin.add(b.group); this.cur = b; this.pop = 0;
  }
  tick(dt) {
    this.angle += dt * 0.32; this.spin.rotation.y = this.angle;
    this.pop = Math.min(1, (this.pop ?? 1) + dt * 2.5);
    const e = 1 - (1 - this.pop) ** 3;
    this.spin.scale.setScalar((this.targetScale || 1) * (0.85 + 0.15 * e));
    this.spin.position.y = (1 - e) * -0.4;
    if (this.cur?.drill?.syncRope) this.cur.drill.syncRope();
    this.vp.render();
  }
  dispose() { cancelAnimationFrame(this.raf); this.vp.dispose(); }
}

// ---- snapshots (one hidden renderer shared by every shop card)
let snapVp = null; const snapCache = new Map(); const queue = []; let busy = false;
function snapper() {
  if (snapVp) return snapVp;
  const host = document.createElement('div'); host.style.cssText = 'position:fixed;left:-9999px;top:0;width:480px;height:300px;';
  document.body.append(host);
  snapVp = new Viewport(host, { alpha: true, fog: false, fov: 30, preserve: true });
  snapVp.host = host;
  snapVp.renderer.setPixelRatio(1.5); snapVp.renderer.setSize(480, 300, false); snapVp.camera.aspect = 1.6; snapVp.camera.updateProjectionMatrix();
  snapVp._ro.disconnect();
  return snapVp;
}
export function snapshot(key, build) {
  if (snapCache.has(key)) return Promise.resolve(snapCache.get(key));
  return new Promise((res) => { queue.push({ key, build, res }); pump(); });
}
function pump() {
  if (busy || !queue.length) return; busy = true;
  const { key, build, res } = queue.shift();
  setTimeout(() => {
    // each picture is rendered on its own: if the browser dropped this hidden renderer (it does that
    // when many tabs hold 3D contexts) make a fresh one, so a stale frame is never handed back
    let vp = snapper();
    if (vp.renderer.getContext().isContextLost()) { try { vp.dispose(); vp.host?.remove(); } catch { /* already gone */ } snapVp = null; vp = snapper(); }
    let url = null, group = null;
    try {
      const b = build(); group = b.group; const cam = b.cam;
      vp.scene.add(group);
      vp.camera.position.set(...cam.pos); vp.camera.lookAt(...cam.look);
      vp.scopeLight.position.set(cam.pos[0] + 2, cam.pos[1] + 4, cam.pos[2] + 2); vp.scopeLight.target.position.set(...cam.look);
      vp.renderer.setRenderTarget(null); vp.renderer.clear(true, true, true);
      vp.render();
      if (!vp.renderer.getContext().isContextLost()) url = vp.renderer.domElement.toDataURL('image/png');
    } catch (e) { console.warn('snapshot failed', key, e); }
    if (group) vp.scene.remove(group);
    if (url) snapCache.set(key, url);
    res(url); busy = false; pump();
  }, 16);
}
export function envSnapshot(drillId, envId) {
  return snapshot(`env:${drillId}:${envId}`, () => {
    const { group } = buildDrillGroup(drillId, envId);
    const box = new THREE.Box3().setFromObject(group); const c = box.getCenter(new THREE.Vector3());
    group.position.set(-c.x, 0, -c.z);
    return { group, cam: { pos: [0, 9.8, 10.6], look: [0, -0.4, 0.3] } };
  });
}
export function instSnapshot(drillId, themeId) {
  return snapshot(`inst:${drillId}:${themeId}`, () => {
    const t = instTheme(drillId, themeId);
    const group = instrumentPreview(t.kind, t.theme);
    group.scale.setScalar(1.6);
    return { group, cam: { pos: [0.4, 0.9, 3.2], look: [0.1, -0.25, -0.3] } };
  });
}

/** Wide, low "hero" render of a drill board for cards and the home screen. */
export function heroSnapshot(drillId, envId) {
  return snapshot(`hero:${drillId}:${envId}`, () => {
    const { group } = buildDrillGroup(drillId, envId);
    const box = new THREE.Box3().setFromObject(group); const c = box.getCenter(new THREE.Vector3());
    group.position.set(-c.x, 0, -c.z);
    return { group, cam: { pos: [1.6, 3.6, 6.4], look: [0, -0.1, 0.4] } };
  });
}
