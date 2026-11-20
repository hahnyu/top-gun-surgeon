// The in-drill screen: 3D stage, input (keyboard / touch / mouse), HUD, countdown, results.
import { THREE, Viewport, buildTrainerBox, Metrics, Tool } from './engine.js';
import { drillById, KEY_LABEL } from './drills/index.js';
import { envTheme, instTheme } from './themes.js';
import { store } from '../store.js';
import { playSound, synth, sfx, motionHum, stopHum, haptic } from '../audio.js';
import { FX } from './fx.js';
import { h, icon, fmtTime, modal } from '../ui/dom.js';
import { InputSystem } from './input.js';
import { showScoreCard } from '../ui/scorecard.js';
import { settingsPanel } from '../ui/panels.js';
import { sheet, btn } from '../ui/kit.js';
import { modifiersFor } from './drills/index.js';
import { nice } from '../progress.js';
import { LESSONS, RULES, ruleFor } from '../rules.js';
import { VARIANTS, PAR, ghostFor, addPlayTime } from '../campaign.js';
import { music } from '../music.js';
import { Assist } from './assist.js';
import { buddyDock, ruleFlash, runQuiz, ruleCard, scout, speak } from '../ui/buddy.js';

export function mountGame(container, { drillId, level, hand, mode, variant: vParam = null }, nav) {
  const def = drillById(drillId);
  const sel = store.getSelection(drillId);
  const env = envTheme(drillId, sel.env) || envTheme('pea-drop', 'default');
  const inst = instTheme(drillId, sel.instrument) || instTheme('pea-drop', 'default');
  const flips = (drillId === 'pea-drop' || drillId === 'triangle-transfer') && level !== 'BEGINNER';
  const effHand = flips ? (hand === 'LEFT' ? 'RIGHT' : 'LEFT') : hand;
  const single = def.layout.startsWith('single');
  const school = mode === 'SCHOOL' && !!LESSONS[drillId];
  const variant = !school && VARIANTS[vParam] ? vParam : null;
  const ghost = school || store.settings.ghost === false ? null : ghostFor(drillId, level, variant);
  // training wheels: depth and grab helpers come off as the levels go up
  const aids = { side: level === 'BEGINNER', reticle: level === 'BEGINNER' || level === 'INTERMEDIATE' };
  document.body.classList.add('in-drill');

  // ---------------------------------------------------------------- DOM
  const canvasHost = h('div', { class: 'game-canvas' });
  const flash = h('div', { class: 'flash' });
  const hb = (cls, k) => { const v = h('div', { class: 'v' }, '00'); const el = h('div', { class: 'hud-box ' + cls }, h('div', { class: 'k' }, k), v); return { el, v }; };
  const boxName = h('div', { class: 'hud-name' }, h('div', { class: 'n' }, def.name), h('div', { class: 'sub' }, school ? 'RULE SCHOOL' : variant ? `${VARIANTS[variant].name.toUpperCase()} · ${level}` : def.usesHand ? `${level} · ${effHand} · ${mode}` : `${level} · ${mode}`));
  const boxErr = hb('', def.strikes ? 'Strikes' : 'Bumps');
  const boxTime = hb('time', variant === 'speed' ? `Par ${fmtTime(PAR[drillId])}` : ghost ? `Best ${fmtTime(ghost.time)}` : 'Time');
  const boxReps = hb('', def.sandbox ? 'Bites' : 'Reps');
  const hud = h('div', { class: 'hud' }, h('div', { class: 'hud-bar' }, boxName, h('i', { class: 'sep' }), boxErr.el, boxTime.el, boxReps.el));
  const exitBtn = h('button', { class: 'pause-btn', 'aria-label': 'Pause', title: 'Pause (Esc)', onclick: () => openPause() }, icon('pause'));
  const setBtn = h('span');
  const finishBtn = def.sandbox ? h('button', { class: 'pill', onclick: () => finishSandbox() }, icon('check'), 'FINISH') : null;
  const strikesEl = def.strikes ? h('div', { class: 'strikes' }, h('i'), h('i'), h('i')) : null;
  const statusCard = h('div', { class: 'status-card', style: { display: 'none' } }, h('div', { class: 't' }, 'STATUS'), h('div', { class: 'b' }));
  const leftCol = h('div', { class: 'hud-left' }, exitBtn, strikesEl ? h('div', { class: 'status-card' }, h('div', { class: 't' }, 'STRIKES'), strikesEl) : null);
  const rightCol = h('div', { class: 'hud-side' }, setBtn, null, finishBtn, statusCard);
  const hint = h('div', { class: 'hint', style: { display: 'none' } }, 'Move to start');
  const stepMsg = h('div', { class: 'step-msg', style: { display: 'none' } });
  const ctlLayer = h('div', { class: 'ctl-layer' });
  const fxLayer = h('div', { class: 'fx-layer' });
  const comboEl = h('div', { class: 'combo' });
  // altimeter: jaw-tip clearance above the surface, one bar per instrument
  const altBars = Array.from({ length: def.layout.startsWith('dual') && def.layout !== 'dual-active' ? 2 : 1 }, (_, i) => {
    const fill = h('div', { class: 'fill' }), val = h('div', { class: 'val' }, '0');
    return { el: h('div', { class: 'alt-bar ' + (i ? 'am' : def.layout.startsWith('dual') ? 'cy' : '') }, h('div', { class: 'tr' }, fill), val), fill, val };
  });
  const altEl = h('div', { class: 'alt', style: { display: 'none' } }, h('div', { class: 'lab' }, 'ALT'), h('div', { class: 'bars' }, altBars.map((b) => b.el)), h('div', { class: 'unit' }, 'mm'));
  let fineOn = false;
  const fineBtn = h('button', { class: 'fine-btn touch-only', onclick: () => { fineOn = !fineOn; input.fine = fineOn; fineBtn.classList.toggle('on', fineOn); haptic(8); } }, 'FINE');
  const root = h('div', { class: 'screen game' }, canvasHost, flash, fxLayer, hud, leftCol, rightCol, altEl, comboEl, hint, stepMsg, ctlLayer);
  rightCol.insertBefore(fineBtn, setBtn.nextSibling);
  const dock = school ? buddyDock() : null;
  if (dock) { root.append(dock.el); root.classList.add('school'); }
  container.append(root);

  // ---------------------------------------------------------------- 3D
  const vp = new Viewport(canvasHost, { bg: env.bg ?? 0x0d0d18, post: store.settings.quality !== 'low' });
  const autoQ = store.settings.autoQuality !== false;
  if (autoQ && store.settings.qStep) vp.applyQuality(store.settings.qStep); // quality learned on earlier runs
  const saveQuality = () => { if (autoQ && (vp.wantStep || 0) > (store.settings.qStep || 0)) store.setSetting('qStep', vp.wantStep); };
  vp.camera.position.set(...def.camera.pos); vp.camera.lookAt(...def.camera.look);
  // auto-framing: fit the drill's working area between the HUD and the thumbs on any screen shape
  const frameBox = new THREE.Box3(new THREE.Vector3(...def.frame.min), new THREE.Vector3(...def.frame.max));
  const frameCenter = frameBox.getCenter(new THREE.Vector3());
  const camDir = new THREE.Vector3(...def.camera.pos).sub(new THREE.Vector3(...def.camera.look)).normalize();
  function fitCamera() {
    const cam = vp.camera; cam.clearViewOffset(); cam.updateProjectionMatrix();
    const touch = !document.body.classList.contains('no-touch');
    const yTop = 0.74, yBot = touch ? -0.86 : -0.92, xLim = 0.95;
    const corners = []; for (const x of [frameBox.min.x, frameBox.max.x]) for (const y of [frameBox.min.y, frameBox.max.y]) for (const z of [frameBox.min.z, frameBox.max.z]) corners.push(new THREE.Vector3(x, y, z));
    let lo = 2, hi = 40;
    for (let k = 0; k < 28; k++) {
      const d = (lo + hi) / 2;
      cam.position.copy(frameCenter).addScaledVector(camDir, d); cam.lookAt(frameCenter); cam.updateMatrixWorld();
      // shift the image down a touch so the board sits under the HUD bar
      const fits = corners.every((c) => { const p = c.clone().project(cam); return Math.abs(p.x) <= xLim && p.y <= yTop - (yTop + yBot) * 0 && p.y >= yBot && p.y <= yTop; });
      if (fits) hi = d; else lo = d;
    }
    cam.position.copy(frameCenter).addScaledVector(camDir, hi); cam.lookAt(frameCenter); cam.updateMatrixWorld();
    // centre the fitted box vertically inside the safe band
    let minY = 1, maxY = -1; for (const c of corners) { const p = c.clone().project(cam); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); }
    const w = canvasHost.clientWidth, hh = canvasHost.clientHeight, shift = ((maxY + minY) / 2 - (yTop + yBot) / 2) * hh / 2;
    cam.setViewOffset(w, hh, 0, shift, w, hh); cam.updateProjectionMatrix();
    fx?.setCameraBase(); fx?.setLook([frameCenter.x, frameCenter.y, frameCenter.z]);
    Tool.view.right.setFromMatrixColumn(cam.matrixWorld, 0).normalize(); Tool.view.up.setFromMatrixColumn(cam.matrixWorld, 1).normalize();
  }
  let fx = null;
  const ro = new ResizeObserver(() => fitCamera()); ro.observe(canvasHost);
  buildTrainerBox(vp.scene, { bg: env.bg });
  const listeners = {};
  const drill = new def.cls({ root: vp.root, level, hand: effHand, mode, env, inst, emit: (t, d) => listeners[t]?.(d) });
  const metrics = new Metrics();
  // Night flight: room lights off, only a narrow scope light that follows your instrument
  if (variant === 'night') {
    vp.keyLight.intensity *= 0.05; vp.renderer.toneMappingExposure *= 0.8;
    vp.scene.traverse((o) => { if (o.isHemisphereLight) o.intensity = 0.03; else if (o.isDirectionalLight) o.intensity = 0.04; });
    if (vp.scene.environment) vp.scene.environmentIntensity = 0.08;
    Object.assign(vp.scopeLight, { intensity: 70, angle: 0.16, penumbra: 0.7 });
  }
  // ghost: your best run, replayed as see-through markers you race against
  const GHOST_DT = 0.2, rec = [];
  const ghostMarks = ghost ? drill.tools.map(() => {
    const g = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: 0x9fe3ff, transparent: true, opacity: 0.6, depthWrite: false });
    g.add(new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 12), mat));
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.018, 6, 32), mat); ring.rotation.x = Math.PI / 2; g.add(ring);
    g.visible = false; vp.scene.add(g); return g;
  }) : [];
  function ghostTick() {
    if (phase === 'running') {
      while (rec.length * GHOST_DT <= metrics.time) rec.push(drill.tips.flatMap((t) => [+t.x.toFixed(2), +t.y.toFixed(2), +t.z.toFixed(2)]));
    }
    if (!ghost) return;
    const k = metrics.time / (ghost.dt || GHOST_DT), i = Math.floor(k), f = k - i;
    const a = ghost.path[i], b = ghost.path[i + 1] || a;
    ghostMarks.forEach((g, n) => {
      g.visible = phase === 'running' && !!a && a.length > n * 3;
      if (g.visible) g.position.set(a[n * 3] + (b[n * 3] - a[n * 3]) * f, a[n * 3 + 1] + (b[n * 3 + 1] - a[n * 3 + 1]) * f, a[n * 3 + 2] + (b[n * 3 + 2] - a[n * 3 + 2]) * f);
    });
  }
  fx = new FX(vp, fxLayer); fitCamera();
  // side-view window (Beginner depth aid): an orthographic camera beside the active instrument
  const insetOn = false; // side-view window removed (play-testing): depth comes from the shadow and the height gauge
  const insetCam = new THREE.OrthographicCamera(-1.15, 1.15, 0.65, -0.65, 0.1, 30);
  const insetEl = insetOn ? h('div', { class: 'inset' }, h('div', { class: 'lab' }, 'SIDE VIEW')) : null;
  if (insetEl) root.append(insetEl);
  function renderInset() {
    if (!insetOn || !drill.tools.length) return;
    const t = drill.tools[input.activeIndex()] || drill.tools[0];
    const r = vp.renderer, W = canvasHost.clientWidth, H = canvasHost.clientHeight;
    const w = Math.round(Math.min(260, W * 0.24)), hgt = Math.round(w * 0.565), x = 14, y = 64;
    insetEl.style.cssText = `left:${x}px;top:${y}px;width:${w}px;height:${hgt}px`;
    const fl = t.floor(t.tip.x, t.tip.z);
    insetCam.position.set(t.tip.x + 6, fl + 0.45, t.tip.z); insetCam.lookAt(t.tip.x, fl + 0.45, t.tip.z);
    r.setScissorTest(true); r.setScissor(x, H - y - hgt, w, hgt); r.setViewport(x, H - y - hgt, w, hgt);
    r.render(vp.scene, insetCam);
    r.setScissorTest(false); r.setViewport(0, 0, W, H);
  }
  let timeScale = 1, combo = 0, errSinceRep = 0; const reps = [];

  // ---------------------------------------------------------------- input (drag-to-move, hold-to-grip)
  const bindings = () => def.keys(store.settings.leftHand);
  const input = new InputSystem({ host: canvasHost, layer: ctlLayer, vp, drill, def, settings: store.settings });
  // coaching hints for missed grabs (never moves the tool) — off at Expert
  const assist = new Assist(drill, level, mode, {
    say: (text) => listeners.tip?.({ text }), device: () => input.lastDevice, activeIndex: () => input.activeIndex(),
  });
  const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
  document.body.classList.toggle('no-touch', !isTouch);
  const onEsc = (e) => { if (e.code === 'Escape' && phase !== 'intro' && !document.querySelector('.sheet-wrap, .overlay')) openPause(); };
  window.addEventListener('keydown', onEsc);
  const holding = (t) => !!(t.holding || (t.node !== undefined && t.node >= 0) || t.hold || t.solid?.held);
  const prevGrip = [];
  /** Older (non-physics) drills use grab toggles: turn grip press/release into those. */
  function adaptGrip(inputs) {
    if (drill.solid || drill.physicsGrip) return;
    drill.tools.forEach((t, i) => {
      const g = !!inputs[i]?.grip, was = !!prevGrip[i];
      if (inputs[i]) inputs[i].grab = false;
      if (g && !was) { if (!holding(t)) inputs[i].grab = true; }
      else if (!g && was) { if (holding(t)) inputs[i].grab = true; else t.jawT = t.jaw0 ?? 0.6; }
      prevGrip[i] = g;
    });
  }
  const syncDrops = () => drill.tools.forEach((t, i) => { if (input.grip[i] && !holding(t) && t._wasHolding) { input.clearGrip(i); prevGrip[i] = false; } t._wasHolding = holding(t); });

  // ---------------------------------------------------------------- game flow
  let phase = 'intro'; let paused = false; let raf = 0; let last = performance.now(); let disposed = false;
  let errFlashT = 0, repFlashT = 0;
  const startMode = drillId === 'cobra-rope' || drillId === 'cylinder-transfer' ? 'event' : def.sandbox ? 'go' : 'move';

  const cnt = { grab: 0, success: 0, error: 0 };
  listeners.error = (d) => {
    if (phase !== 'running') return;
    cnt.error++;
    // mistakes teach: name the rule that was broken, with its card; slow down for a beat on the learning levels
    const rule = ruleFor(drillId, d?.reason);
    if (rule) {
      store.learnRule(rule.id); ruleFlash(root, rule, d?.reason || '');
      if (school || level === 'BEGINNER') { timeScale = 0.3; setTimeout(() => { if (phase === 'running') timeScale = 1; }, 700); }
      if (school) speak(`Oops! Rule ${rule.n}: ${rule.title}`);
    }
    playSound('error', { volume: 0.55 }); sfx('scrape');
    flash.classList.remove('good'); flash.classList.add('on'); setTimeout(() => flash.classList.remove('on'), 120);
    boxErr.el.classList.add('bad'); errFlashT = 0.8;
    if (!rule) callout(d?.reason || 'Error', 'bad');
    if (d?.pos) { fx.sparks(d.pos); if (!d.noMark) fx.mark(d.pos, d.surf ?? 0); fx.float(d.pos, d.strike ? `STRIKE ${d.strike}` : '−ERROR', 'bad'); }
    if (!store.settings.reduceMotion) fx.shake(0.09); haptic([40, 30, 40]);
    errSinceRep++; if (combo >= 2) comboBreak(); combo = 0;
    music.duck(); music.intensity(1);
  };
  listeners.success = (d) => {
    playSound('success', { volume: 0.5 });
    boxReps.el.classList.add('good'); repFlashT = 0.7;
    flash.classList.add('good', 'on'); setTimeout(() => flash.classList.remove('on'), 90);
    if (phase !== 'running') return;
    cnt.success++;
    reps.push({ t: metrics.time, errors: errSinceRep });
    const split = ghost?.reps?.[reps.length - 1];
    if (split != null) { const dd = metrics.time - split; setTimeout(() => callout(`${dd < 0 ? '−' : '+'}${Math.abs(dd).toFixed(1)} s vs your best`, dd < 0 ? 'good' : 'tip'), 650); }
    combo = errSinceRep === 0 ? combo + 1 : 1; errSinceRep = 0;
    music.intensity(combo >= 4 ? 3 : combo >= 2 ? 2 : 1); // the music builds with a clean streak
    if (d?.pos) { fx.confetti(d.pos); fx.float(d.pos, '+1', 'good'); }
    sfx('chime', combo); haptic([15, 40, 25]);
    if (combo >= 2) showCombo(combo);
  };
  listeners.grab = (d) => { cnt.grab++; haptic(12); if (d?.obj) fx.squash(d.obj); if (d?.pos) fx.dust(d.pos); };
  listeners.enter = () => sfx('rattle');
  listeners.tip = (d) => { if (phase === 'running' && !(tipCool > performance.now())) { tipCool = performance.now() + 1500; callout(d?.text || '', 'tip'); } };
  let tipCool = 0;
  listeners.handoff = () => { sfx('tick2'); haptic(10); };
  // Cobra: "Line of Nick" — the rope pulled tight between two reds. An anime-style impact frame:
  // a split-second freeze, an inverted ink flash with speed lines, and the call-out on the rope.
  listeners.nick = (d) => {
    if (phase !== 'running' && !school) return;
    const calm = !!store.settings.reduceMotion;
    const rect = canvasHost.getBoundingClientRect(), p = d.pos.clone().project(vp.camera);
    const x = Math.max(90, Math.min(rect.width - 90, (p.x + 1) / 2 * rect.width)), y = Math.max(70, Math.min(rect.height - 40, (1 - p.y) / 2 * rect.height - 34));
    const el = h('div', { class: 'impact' + (calm ? ' calm' : '') },
      calm ? null : h('div', { class: 'im-ink' }), calm ? null : h('div', { class: 'im-lines' }),
      h('div', { class: 'im-text' }, h('b', {}, 'LINE OF NICK!'), h('small', {}, `${d.count} / ${d.max}`)));
    el.style.setProperty('--x', x + 'px'); el.style.setProperty('--y', y + 'px');
    root.append(el); setTimeout(() => el.remove(), 1300);
    if (!calm) {
      canvasHost.classList.add('impact-frame'); setTimeout(() => canvasHost.classList.remove('impact-frame'), 110);
      const ts = timeScale; timeScale = 0; setTimeout(() => { if (timeScale === 0) timeScale = ts || 1; }, 140); // hit-stop
      fx.shake(0.14);
    }
    sfx('whoosh'); setTimeout(() => sfx('chime', 6), 120); haptic([60, 20, 30]);
    if (d.a && d.b) { fx.sparks(d.a); fx.sparks(d.b); }
  };
  listeners.miss = (d) => { if (phase === 'running') { synth('drop'); callout('Miss — rolled off', 'bad'); if (d?.pos) fx.float(d.pos, 'MISS', 'bad'); haptic(30); combo = 0; } };
  listeners.slip = () => { if (phase === 'running') callout('Slipped off!', 'bad'); };
  listeners.start = () => { if (phase === 'armed') begin(); };
  listeners.reverse = () => callout('Reverse!', 'good');
  // finishing always ends the run — even if the start signal was missed (it never leaves you without an ending)
  listeners.complete = () => { if (phase === 'armed') begin(); if (phase === 'running') { if (school) endLesson(); else finish(); } };
  listeners.fail = () => {
    phase = 'failed';
    const ov = h('div', { class: 'complete' }, h('div', {}, h('div', { class: 't fail' }, '3 STRIKES!'), h('div', { class: 's' }, 'RESTARTING…')));
    root.append(ov); playSound('error');
    setTimeout(() => { ov.remove(); if (!disposed) restart(true); }, 2000);
  };

  function showCombo(n) {
    comboEl.innerHTML = ''; comboEl.className = 'combo';
    comboEl.append(h('div', { class: 'c-k' }, 'CLEAN'), h('div', { class: 'c-v' }, '×' + n));
    void comboEl.offsetWidth; comboEl.classList.add('show', n >= 5 ? 'hot' : 'warm');
  }
  function comboBreak() { comboEl.classList.remove('show'); }
  function callout(text, kind) {
    const c = h('div', { class: 'callout ' + kind, role: 'status', 'aria-live': 'polite' }, text); root.append(c); setTimeout(() => c.remove(), 1200);
  }

  // short, kid-sized briefings: one goal, one "don't", the controls
  function showIntro() {
    phase = 'intro';
    if (school) return showSchoolIntro();
    const b = bindings(), dev = input.lastDevice;
    const keys = (codes) => (codes || []).filter(Boolean).slice(0, 4).map((c) => h('kbd', {}, KEY_LABEL(c)));
    const ctl = (label, ...k) => h('div', { class: 'bc-ctl' }, h('span', { class: 'bc-k' }, ...k), h('span', {}, label));
    let controls;
    if (dev === 'touch') controls = [ctl('Move', h('kbd', {}, 'Drag')), ctl('Grab / let go', h('kbd', {}, 'GRAB'))];
    else if (b.length > 1) controls = b.map((k, i) => ctl(`${i ? 'Right' : 'Left'} hand`, ...keys([k.up?.[0], k.left?.[0], k.down?.[0], k.right?.[0]]), ' ', ...keys(k.grab?.slice(0, 1))));
    else {
      const k = b[0];
      controls = [ctl('Move', ...keys([k.up?.[0], k.left?.[0], k.down?.[0], k.right?.[0]])), ctl('In / out', ...keys([k.in?.[0], k.out?.[0]])),
        drillId === 'triangle-transfer' ? ctl('Turn hook', ...keys([k.ccw?.[0], k.cw?.[0]])) : null, ctl(drillId === 'triangle-transfer' ? 'Hook / set down' : 'Grab / let go', ...keys(k.grab?.slice(0, 1))),
      ].filter(Boolean);
    }
    const tags = [
      variant ? h('span', { class: 'bc-tag dark' }, VARIANTS[variant].name + (variant === 'speed' ? ` · par ${fmtTime(PAR[drillId])}` : '')) : null,
      ghost ? h('span', { class: 'bc-tag ghost' }, `Race your ghost · ${fmtTime(ghost.time)}`) : null,
    ].filter(Boolean);
    const sh = sheet(`${def.name} · ${nice(level)}`, { dismissable: false, cls: 'brief brief-simple' });
    sh.body.append(
      tags.length ? h('div', { class: 'bc-tags' }, tags) : null,
      h('div', { class: 'bc-controls' }, controls),
      h('div', { style: { display: 'flex', gap: '10px' } },
        btn('Back', { kind: 'glass', size: 'lg', onClick: () => { sh.close(true); exit(); } }),
        h('div', { style: { flex: 1 } }, btn('Fly', { kind: 'primary', size: 'lg', block: true, iconName: 'plane', sound: null, onClick: () => { sh.close(true); startCountdown(); } }))));
  }

  // ---------------------------------------------------------------- rule school
  const lesson = school ? LESSONS[drillId] : null;
  let si = -1, stepT = 0;
  function showSchoolIntro() {
    const rules = RULES[drillId];
    const sh = sheet(`Rule school · ${def.name}`, { dismissable: false, cls: 'brief school-intro' });
    sh.body.append(
      h('div', { class: 'si-hero' }, scout('cheer', { size: 110 }), h('div', {},
        h('div', { class: 'si-t' }, `Learn the ${rules.length} rules of ${def.name}`),
        h('p', { class: 't-dim' }, 'Scout will show you each rule — you learn it by doing it. No score, no rush.'))),
      h('div', { class: 'si-cards' }, rules.map((r, i) => ruleCard(r, { n: i + 1, small: true, locked: !store.knowsRule(r.id) }))),
      h('div', { style: { display: 'flex', gap: '10px' } },
        btn('Back', { kind: 'glass', size: 'lg', onClick: () => { sh.close(true); exit(); } }),
        h('div', { style: { flex: 1 } }, btn('Let’s go', { kind: 'primary', size: 'lg', block: true, iconName: 'plane', sound: null, onClick: () => { sh.close(true); startCountdown(); } }))));
  }
  function lessonTick(dt) {
    if (!lesson || !(phase === 'armed' || phase === 'running')) return;
    if (si < 0) enterStep(0);
    const st = lesson[si]; if (!st) return;
    stepT += dt;
    const done = st.wait ? stepT >= st.wait : stepT > 0.6 && st.done(drill, cnt);
    if (done) {
      if (si + 1 >= lesson.length) return endLesson();
      sfx('chime', si + 2); haptic([10, 30, 10]);
      enterStep(si + 1);
    }
  }
  function enterStep(i) {
    si = i; stepT = 0;
    const st = lesson[i];
    const rule = st.rule ? RULES[drillId].findIndex((r) => r.id === st.rule) : -1;
    let card = null;
    if (rule >= 0) {
      const fresh = store.learnRule(st.rule);
      card = h('div', { class: 'bd-card' }, fresh ? h('span', { class: 'bd-new' }, 'New rule card!') : null, ruleCard(RULES[drillId][rule], { n: rule + 1, small: true }));
    }
    dock.say(st.say, i === 0 ? 'happy' : 'cheer', { card });
  }
  async function endLesson() {
    if (phase === 'done') return;
    phase = 'done'; drill.started = false;
    RULES[drillId].forEach((r) => store.learnRule(r.id));
    dock.say('You did it! Now a quick quiz.', 'cheer');
    const ov = h('div', { class: 'complete' }, h('div', {}, h('div', { class: 't' }, 'RULE SCHOOL', h('br'), 'COMPLETE')));
    root.append(ov); playSound('success'); sfx('whoosh');
    await new Promise((r) => setTimeout(r, 1600));
    ov.remove(); if (disposed) return;
    const right = await runQuiz(drillId);
    store.finishSchool(drillId, right);
    if (disposed) return;
    const sh = sheet('Ready to fly?', { onClose: () => exit(true), cls: 'brief' });
    sh.body.append(h('div', { class: 'si-hero' }, scout('cheer', { size: 96 }), h('div', {},
      h('div', { class: 'si-t' }, 'You know the rules!'),
      h('p', { class: 't-dim' }, `Your rule cards are in the Rule book. Now fly the real ${def.name} — finish it to earn your first star.`))),
      h('div', { style: { display: 'flex', gap: '10px' } },
        btn('Drills', { kind: 'glass', size: 'lg', iconName: 'grid', onClick: () => sh.close() }),
        h('div', { style: { flex: 1 } }, btn('Fly it for real', { kind: 'primary', size: 'lg', block: true, iconName: 'plane', onClick: () => { sh.close(true); nav(`#/game/${drillId}?level=BEGINNER&mode=PRACTICE&hand=${hand}`); } }))));
  }

  function startCountdown() {
    phase = 'countdown'; music.start('drill'); music.intensity(0);
    const host = h('div', { class: 'countdown' }); root.append(host);
    playSound('beginDrill', { volume: 0.8 });
    const seq = ['3', '2', '1', 'GO'];
    seq.forEach((s, i) => setTimeout(() => {
      if (disposed) return;
      host.innerHTML = ''; host.append(h('div', { class: 'n' + (s === 'GO' ? ' go' : '') }, s));
      synth(s === 'GO' ? 'go' : 'tick');
      if (s === 'GO') setTimeout(() => { host.remove(); arm(); }, 650);
    }, i * 800));
  }
  function arm() {
    phase = 'armed';
    if (startMode === 'go') { begin(); return; }
    hint.style.display = '';
    hint.textContent = startMode === 'move' ? 'Move to start' : (drill.status?.() || 'Grab to start');
  }
  function begin() {
    phase = 'running'; drill.started = true; hint.style.display = 'none'; metrics.reset();
  }
  function finish() {
    phase = 'done'; music.intensity(3);
    // slow-motion beat on the final rep, camera pushes in
    if (!store.settings.reduceMotion) { timeScale = 0.3; fx.pushIn(0.14, 1.6); } sfx('whoosh'); haptic([20, 60, 40]);
    setTimeout(() => { timeScale = 1; }, 1500);
    setTimeout(() => finishOverlay(), 1250);
  }
  function finishOverlay() {
    if (disposed) return;
    playSound('success');
    const ov = h('div', { class: 'complete' }, h('div', {}, h('div', { class: 't' }, 'DRILL', h('br'), 'COMPLETE'), h('div', { class: 's' }, fmtTime(metrics.time))));
    root.append(ov);
    let final;
    try {
      const fm = drill.final();
      final = metrics.final({ ...fm, drillId, drillName: def.name, level, hand: effHand, mode, variant, reps: reps.slice(), ghostRec: { time: metrics.time, reps: reps.map((r) => +r.t.toFixed(2)), path: rec.slice(), dt: GHOST_DT } });
      addPlayTime(metrics.time);
    } catch (e) { console.error('run summary failed', e); final = { time: metrics.time, errors: drill.errors || 0 }; }
    setTimeout(() => {
      ov.remove(); if (disposed) return;
      try { showScoreCard(final, { onRetry: () => restart(true), onDrills: () => exit(true), onHome: () => nav('#/home') }); }
      catch (e) {
        // never leave the player without an ending: a plain results card
        console.error('score card failed', e);
        const m = modal({ title: 'Drill complete', iconName: 'check', cls: 'sc', onClose: () => exit(true) });
        m.body.append(
          h('div', { class: 'grade' }, 'TIME ' + fmtTime(final.time)), h('div', { class: 't-dim' }, `${final.errors} ${drillId === 'cobra-rope' ? 'strike' : 'bump'}${final.errors === 1 ? '' : 's'}`),
          h('div', { class: 'acts' }, h('button', { class: 'btn', onclick: () => { m.root.remove(); restart(true); } }, icon('retry'), 'Retry'), h('button', { class: 'btn primary', onclick: () => m.close() }, icon('grid'), 'Drills')));
      }
    }, 1700);
  }
  function finishSandbox() {
    if (phase !== 'running') return;
    phase = 'done';
    const m = modal({ title: 'Session Summary', iconName: 'check', cls: 'sc', onClose: () => exit(true) });
    m.body.append(
      h('div', { class: 'score' }, String(drill.bites || 0), h('small', {}, ' bites')),
      h('div', { class: 'grade' }, 'TIME ' + fmtTime(metrics.time)),
      h('div', { class: 'acts' }, h('button', { class: 'btn', onclick: () => { m.root.remove(); restart(true); } }, icon('retry'), 'Retry'), h('button', { class: 'btn primary', onclick: () => m.close() }, icon('grid'), 'Drills')),
    );
  }
  function restart(withCountdown) {
    saveQuality();
    document.querySelectorAll('.overlay').forEach((o) => o.remove());
    document.querySelectorAll('.sheet-wrap').forEach((o) => o.remove());
    drill.reset(); metrics.reset(); rec.length = 0; assist.reset(); combo = 0; Object.keys(cnt).forEach((k) => (cnt[k] = 0)); if (school) si = -1; errSinceRep = 0; timeScale = 1; reps.length = 0; comboBreak();
    if (withCountdown) startCountdown(); else arm();
  }
  function openPause() {
    if (paused || !['running', 'armed', 'countdown'].includes(phase)) return;
    paused = true; motionHum(0); haptic(10); music.stop(0.3);
    const sh = sheet('Paused', { onClose: () => { paused = false; last = performance.now(); music.start('drill'); } });
    sh.body.append(h('div', { class: 'pause-menu' },
      btn('Resume', { kind: 'primary', size: 'lg', block: true, iconName: 'play', onClick: () => sh.close() }),
      btn('Restart', { kind: '', size: 'lg', block: true, iconName: 'retry', onClick: () => { sh.close(true); paused = false; restart(true); } }),
      btn('Settings', { kind: 'glass', size: 'lg', block: true, iconName: 'sliders', onClick: () => { sh.close(true); openSettings(true); } }),
      btn('Quit to drills', { kind: 'ghost', size: 'lg', block: true, iconName: 'exit', onClick: () => { sh.close(true); exit(); } })));
  }
  const onVis = () => { if (document.hidden) openPause(); };
  document.addEventListener('visibilitychange', onVis);
  function openSettings(fromPause = false) {
    if (paused && !fromPause) return;
    paused = true;
    settingsPanel({ single, lockHand: mode === 'COMPETITION', onChange: (k) => { if (k === 'leftHand') input.buildTouchUI(); }, onClose: () => { paused = false; last = performance.now(); } });
  }
  function exit(silent) {
    if (!silent) playSound('back');
    nav('#/drills');
  }

  // ---------------------------------------------------------------- loop
  const zero = { mx: 0, my: 0, depth: 0, depthAbs: null, rot: 0, grab: false };
  function frame(now) {
    if (disposed) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = Math.max(last, now);
    if (paused) { vp.adaptive = false; vp.render(dt); return; }
    let inputs = input.read(dt, bindings());
    adaptGrip(inputs);
    const canMove = phase === 'armed' || phase === 'running';
    if (!canMove) inputs = inputs.map(() => ({ ...zero }));
    else assist.apply(inputs, dt);
    if (phase === 'armed' && startMode === 'event' && drill.started) begin(); // the drill started itself (first grab)
    if (phase === 'armed' && startMode === 'move' && inputs.some((i) => Math.abs(i.mx || 0) + Math.abs(i.my || 0) + Math.abs(i.insert || 0) + (i.orbit ? Math.abs(i.orbit.x) + Math.abs(i.orbit.y) : 0) > 0.05 || i.abs || i.delta || i.grip || i.heightAbs != null)) begin();
    drill.update(dt * timeScale, inputs, store.settings.sens);
    if (phase === 'running') metrics.update(dt, drill.tips);
    lessonTick(dt); ghostTick();
    if (variant === 'night' && drill.tools.length) { const t = drill.tools[input.activeIndex()] || drill.tools[0]; vp.scopeLight.target.position.lerp(t.tip, 0.2); }
    // feel: reticles, effects, instrument hum, altimeter
    fx.setHints(canMove && aids.reticle ? drill.hints() : [], drill.t);
    fx.update(dt * (timeScale < 1 ? 0.5 : 1));
    motionHum(canMove ? drill.tools.reduce((a, t) => a + (t.frozen ? 0 : t.speed()), 0) : 0);
    const cl = drill.clearances();
    const cls = def.layout === 'dual-active' ? [cl[drill.active === 'R' ? 1 : 0]] : cl;
    altBars.forEach((b, i) => { const c = cls[i] ?? 0; const mm = Math.round(c * 25); b.fill.style.height = Math.min(100, (c / 1.6) * 100) + '%'; b.val.textContent = mm > 99 ? '99+' : String(mm); b.el.classList.toggle('low', c < 0.06); });
    syncDrops(); input.syncTouchUI();
    // HUD
    const hd = drill.hud();
    boxErr.v.textContent = String(hd.errors).padStart(2, '0');
    boxTime.v.textContent = fmtTime(phase === 'running' || phase === 'done' ? metrics.time : 0);
    boxReps.v.textContent = hd.target ? `${String(hd.reps).padStart(2, '0')}/${hd.target}` : String(hd.reps).padStart(2, '0');
    if (strikesEl) [...strikesEl.children].forEach((c, i) => c.classList.toggle('on', i < (hd.strikes || 0)));
    errFlashT -= dt; repFlashT -= dt;
    if (errFlashT <= 0) boxErr.el.classList.remove('bad');
    if (repFlashT <= 0) boxReps.el.classList.remove('good');
    const st = drill.status?.();
    if (st && !school && (phase === 'running' || phase === 'armed')) {
      stepMsg.style.display = ''; stepMsg.textContent = st;
      if (phase === 'armed' && startMode === 'event') hint.textContent = st;
    } else stepMsg.style.display = 'none';
    if (hd.extra || drillId === 'cobra-rope') {
      statusCard.style.display = '';
      const b = statusCard.querySelector('.b');
      if (drillId === 'cobra-rope') { const r = drill.regionsHeld(); b.innerHTML = ''; b.append(h('div', { class: 'region-ind' }, h('span', { class: 'cy' }, 'L: ' + (r.L ? 'R' + r.L : '—')), h('span', { class: 'am' }, 'R: ' + (r.R ? 'R' + r.R : '—')))); statusCard.querySelector('.t').textContent = 'HOLDING'; }
      else { b.textContent = hd.extra; b.className = 'b ' + (hd.extra === 'Forward' ? 'cy' : 'am'); statusCard.querySelector('.t').textContent = 'DIRECTION'; }
    }
    vp.adaptive = autoQ && phase === 'running'; // only judge speed while actually flying
    vp.render(dt); renderInset();
  }
  raf = requestAnimationFrame(frame);
  showIntro();
  window.__tg = { drill, metrics, vp, input, assist, get phase() { return phase; }, begin, finish, lessonTick, get lessonStep() { return si; }, frame: (t) => { cancelAnimationFrame(raf); frame(t); } };

  return function dispose() {
    saveQuality(); disposed = true; cancelAnimationFrame(raf); ro.disconnect(); stopHum(); fx.dispose(); document.removeEventListener('visibilitychange', onVis);
    document.querySelectorAll('.sheet-wrap').forEach((o) => o.remove());
    input.dispose(); window.removeEventListener('keydown', onEsc); drill.dispose?.();
    document.querySelectorAll('.overlay').forEach((o) => o.remove());
    document.body.classList.remove('in-drill');
    vp.dispose(); root.remove();
  };
}
