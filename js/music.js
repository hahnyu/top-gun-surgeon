// Adaptive music, synthesized live with Web Audio (no downloads). A bright, easy-going loop
// (I–V–vi–IV) whose layers build as a run goes well: pad → + bass → + arpeggio → + drums.
// Menus get a calm version. Respects the Music setting and pauses when the tab is hidden.
import { store } from './store.js';

const BPM = 100, SPB = 60 / BPM, STEP = SPB / 2;   // eighth-note grid
// F major: F  C  Dm  Bb   (MIDI)
const CHORDS = [[53, 57, 60], [48, 52, 55], [50, 53, 57], [46, 50, 53]];
const ARP = [0, 1, 2, 1, 0, 2, 1, 2];
const LEAD = [[72, 0], [-1, 1], [69, 2], [-1, 3], [72, 4], [74, 5], [72, 6], [-1, 7]]; // a tiny hook, every other bar
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);

let c = null, master = null, filt = null, timer = 0, next = 0, step = 0, mode = null, level = 0, shown = 0, noiseBuf = null;

function ctx() {
  if (c) return c;
  try { c = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; }
  filt = c.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = 9000;
  master = c.createGain(); master.gain.value = 0;
  filt.connect(master).connect(c.destination);
  const b = (noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate)).getChannelData(0); for (let i = 0; i < b.length; i++) b[i] = Math.random() * 2 - 1;
  return c;
}
function voice(t, f, dur, vol, type = 'triangle', attack = 0.01, cutoff = 0) {
  const o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.value = f;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + attack); g.gain.setTargetAtTime(0, t + dur * 0.6, dur * 0.25);
  let out = o.connect(g);
  if (cutoff) { const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = cutoff; out = out.connect(lp); }
  out.connect(filt); o.start(t); o.stop(t + dur + 0.4);
}
function hit(t, dur, vol, freq, type = 'highpass') {
  const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(); s.buffer = noiseBuf; f.type = type; f.frequency.value = freq;
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(filt); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
}
function kick(t) { const o = c.createOscillator(), g = c.createGain(); o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.14); g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22); o.connect(g).connect(filt); o.start(t); o.stop(t + 0.25); }

function schedule(t, s) {
  const bar = Math.floor(s / 8) % 4, e = s % 8, ch = CHORDS[bar], L = shown;
  const calm = mode === 'menu';
  if (e === 0) ch.forEach((m) => voice(t, hz(m + 12), STEP * 8, calm ? 0.035 : 0.045, 'sine', 0.35));          // pad
  if (L >= 1 && (e === 0 || e === 4 || e === 7)) voice(t, hz(ch[0] - 12), STEP * (e === 7 ? 1 : 3), 0.16, 'triangle', 0.01, 900); // bass
  if ((calm || L >= 2) && (calm ? e % 2 === 0 : true)) voice(t, hz(ch[ARP[e]] + 24), STEP * 0.9, calm ? 0.02 : 0.03, 'square', 0.005, 2600); // arpeggio
  if (L >= 3) {                                                                                                 // drums + hook
    if (e === 0 || e === 4) kick(t);
    if (e === 2 || e === 6) hit(t, 0.12, 0.12, 1800, 'bandpass');
    hit(t, 0.04, 0.05, 7000);
    if (bar % 2 === 1) { const n = LEAD.find((x) => x[1] === e); if (n && n[0] > 0) voice(t, hz(n[0]), STEP * 1.4, 0.05, 'triangle', 0.01, 4000); }
  } else if (L >= 1 && e % 2 === 1) hit(t, 0.03, 0.025, 8000);                                                 // soft hat
}
function tick() {
  if (!c) return;
  while (next < c.currentTime + 0.12) {
    if (step % 8 === 0) shown = level; // layer changes land on the bar line
    schedule(next, step); next += STEP; step++;
  }
}
function fade(to, s = 0.8) { if (!master) return; const t = c.currentTime; master.gain.cancelScheduledValues(t); master.gain.setValueAtTime(master.gain.value, t); master.gain.linearRampToValueAtTime(to, t + s); }
const wanted = () => !!store.settings.music && !document.hidden;

export const music = {
  /** mode: 'menu' (calm) | 'drill' (adaptive). */
  start(m) {
    if (!ctx()) return;
    if (m === 'drill' && mode !== 'drill') level = 0;
    mode = m;
    if (!wanted()) { this.stop(0.2); return; }
    if (c.state === 'suspended') c.resume().catch(() => {});
    if (!timer) { next = c.currentTime + 0.08; step = 0; timer = setInterval(tick, 30); }
    fade(m === 'menu' ? 0.5 : 0.65, 1.2);
  },
  stop(s = 0.8) {
    if (!c) return; fade(0, s);
    const t = timer; setTimeout(() => { if (timer === t && master.gain.value < 0.01) { clearInterval(timer); timer = 0; } }, s * 1000 + 100);
  },
  /** 0 = pad, 1 = + bass, 2 = + arpeggio, 3 = + drums and hook. Applied on the next bar. */
  intensity(n) { level = Math.max(0, Math.min(3, n)); },
  /** a quick muffle after a bump */
  duck() { if (!filt) return; const t = c.currentTime; filt.frequency.cancelScheduledValues(t); filt.frequency.setValueAtTime(700, t); filt.frequency.exponentialRampToValueAtTime(9000, t + 1.2); },
  get mode() { return mode; },
};
document.addEventListener('visibilitychange', () => { if (!mode) return; if (document.hidden) music.stop(0.3); else music.start(mode === 'drill' ? 'drill' : mode); });
window.addEventListener('store-change', () => { if (!mode) return; if (!store.settings.music) music.stop(0.3); else if (!timer || master?.gain.value < 0.01) music.start(mode); });
window.addEventListener('pointerdown', () => { if (mode && wanted() && c && c.state === 'suspended') c.resume().catch(() => {}); }, { passive: true });
