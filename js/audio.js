// Sound effects (Web Audio, low latency) + menu ambience. Respects the SFX / music toggles.
import { store } from './store.js';

const FILES = {
  menuToDrills: 'menuToDrills', back: 'back', swipe: 'swipe', error: 'error', startDrill: 'startDrill',
  beginDrill: 'beginDrill', success: 'success', jawClose: 'click', jawOpen: 'click', click: 'click',
};
let ctx = null;
const buffers = {};
let loading = null;

function ac() {
  if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { ctx = null; } }
  if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

export function preloadSfx(onProgress) {
  if (loading) return loading;
  const c = ac();
  const names = [...new Set(Object.values(FILES))];
  let done = 0;
  loading = Promise.all(names.map(async (n) => {
    try {
      const res = await fetch(`assets/sfx/${n}.mp3`);
      const arr = await res.arrayBuffer();
      if (c) buffers[n] = await c.decodeAudioData(arr);
    } catch { /* missing sound is non-fatal */ }
    done++; onProgress?.(done / names.length);
  }));
  return loading;
}

export function playSound(key, { volume = 1, rate = 1 } = {}) {
  if (!store.settings.sfx) return;
  const c = ac(); if (!c) return;
  const b = buffers[FILES[key] || key];
  if (!b) { if (key === 'tick' || key === 'go') synth(key); return; }
  const src = c.createBufferSource(); src.buffer = b; src.playbackRate.value = rate;
  const g = c.createGain(); g.gain.value = volume;
  src.connect(g).connect(c.destination); src.start();
}

/** Small synthesized cues for things the original sound set lacks (countdown ticks, grabs, strikes). */
export function synth(kind) {
  if (!store.settings.sfx) return;
  const c = ac(); if (!c) return;
  const t = c.currentTime;
  const o = c.createOscillator(); const g = c.createGain();
  o.connect(g).connect(c.destination);
  const env = (a, d, v) => { g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); };
  if (kind === 'tick') { o.type = 'square'; o.frequency.value = 660; env(0.005, 0.16, 0.12); }
  else if (kind === 'go') { o.type = 'sawtooth'; o.frequency.setValueAtTime(520, t); o.frequency.exponentialRampToValueAtTime(1040, t + 0.18); env(0.01, 0.4, 0.14); }
  else if (kind === 'grab') { o.type = 'triangle'; o.frequency.setValueAtTime(420, t); o.frequency.exponentialRampToValueAtTime(760, t + 0.07); env(0.003, 0.1, 0.16); }
  else if (kind === 'drop') { o.type = 'sine'; o.frequency.setValueAtTime(900, t); o.frequency.exponentialRampToValueAtTime(240, t + 0.25); env(0.005, 0.3, 0.2); }
  else if (kind === 'strike') { o.type = 'sawtooth'; o.frequency.setValueAtTime(180, t); o.frequency.linearRampToValueAtTime(90, t + 0.35); env(0.005, 0.45, 0.2); }
  else if (kind === 'coin') { o.type = 'square'; o.frequency.setValueAtTime(988, t); o.frequency.setValueAtTime(1319, t + 0.08); env(0.005, 0.28, 0.08); }
  o.start(t); o.stop(t + 0.7);
}

// ---- Menu ambience (wind) via a looping <audio>, faded in/out
let amb = null; let fadeRaf = 0;
export function setAmbient(on) {
  if (!amb) { amb = new Audio('assets/sfx/wind.mp3'); amb.loop = true; amb.volume = 0; }
  const want = on && store.settings.music;
  cancelAnimationFrame(fadeRaf);
  const target = want ? 0.22 : 0; // a soft airfield breeze under the menu music
  if (want && amb.paused) amb.play().catch(() => {});
  const step = () => {
    const v = amb.volume + (target - amb.volume) * 0.06;
    amb.volume = Math.abs(target - v) < 0.01 ? target : v;
    if (amb.volume !== target) fadeRaf = requestAnimationFrame(step);
    else if (!want) amb.pause();
  };
  step();
}
// Browsers block autoplay until a gesture; retry on first interaction.
let ambWanted = false;
export function wantAmbient(on) { ambWanted = on; setAmbient(on); }
window.addEventListener('pointerdown', () => { ac(); if (ambWanted && amb?.paused) setAmbient(true); }, { passive: true });
window.addEventListener('keydown', () => { ac(); if (ambWanted && amb?.paused) setAmbient(true); });
window.addEventListener('store-change', () => { if (amb) setAmbient(ambWanted); });

// ---- Phase 2 feedback sounds (synthesized, no extra downloads)
let noiseBuf = null;
function noise(c) {
  if (noiseBuf) return noiseBuf;
  noiseBuf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
  const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return noiseBuf;
}
function tone(c, t, f0, f1, dur, vol, type = 'sine') {
  const o = c.createOscillator(), g = c.createGain(); o.type = type;
  o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur + 0.02);
}
function noiseHit(c, t, dur, vol, freq, q = 1, type = 'bandpass') {
  const s = c.createBufferSource(); s.buffer = noise(c); const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(c.destination); s.start(t, Math.random()); s.stop(t + dur + 0.02);
}
/** kind: scrape | rattle | chime (n = combo step) | whoosh | medal | tick2 */
export function sfx(kind, n = 0) {
  if (!store.settings.sfx) return;
  const c = ac(); if (!c) return; const t = c.currentTime;
  if (kind === 'scrape') { noiseHit(c, t, 0.22, 0.35, 2600, 2.5); tone(c, t, 210, 120, 0.18, 0.12, 'sawtooth'); }
  else if (kind === 'rattle') { for (let i = 0; i < 6; i++) { const tt = t + 0.05 + i * (0.06 + i * 0.015); noiseHit(c, tt, 0.04, 0.25 * (1 - i / 7), 3800 - i * 300, 6); } tone(c, t + 0.45, 180, 90, 0.18, 0.12); }
  else if (kind === 'chime') { const base = 660 * Math.pow(2, Math.min(n, 8) / 12 * 2); tone(c, t, base, base, 0.35, 0.12, 'triangle'); tone(c, t + 0.07, base * 1.5, base * 1.5, 0.4, 0.08, 'sine'); }
  else if (kind === 'whoosh') { const s = c.createBufferSource(); s.buffer = noise(c); const f = c.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.2; f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(2400, t + 0.6); const g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.25, t + 0.3); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9); s.connect(f).connect(g).connect(c.destination); s.start(t); s.stop(t + 1); }
  else if (kind === 'medal') { [523, 659, 784, 1047].forEach((f, i) => tone(c, t + i * 0.09, f, f, 0.5, 0.1, 'triangle')); tone(c, t + 0.36, 1568, 1568, 0.8, 0.06, 'sine'); }
  else if (kind === 'tick2') { tone(c, t, 1400, 1400, 0.03, 0.05, 'square'); }
}

// ---- instrument motion: filtered noise whose level and pitch follow tool speed
let hum = null;
export function motionHum(speed) {
  const c = ctx; if (!c || c.state !== 'running') return;
  if (!hum) {
    const s = c.createBufferSource(); s.buffer = noise(c); s.loop = true;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 3; f.frequency.value = 400;
    const g = c.createGain(); g.gain.value = 0;
    s.connect(f).connect(g).connect(c.destination); s.start();
    hum = { s, f, g };
  }
  const on = store.settings.sfx ? Math.min(1, speed / 3) : 0;
  hum.g.gain.setTargetAtTime(on * 0.05, c.currentTime, 0.06);
  hum.f.frequency.setTargetAtTime(300 + on * 900, c.currentTime, 0.08);
}
export function stopHum() { if (hum) { try { hum.s.stop(); } catch { /* already stopped */ } hum = null; } }

export function haptic(pattern) { try { if (navigator.vibrate) navigator.vibrate(pattern); } catch { /* unsupported */ } }
