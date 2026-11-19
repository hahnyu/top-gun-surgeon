// App shell: hash router + Loading, Menu and Drill Select screens.
import { h } from './ui/dom.js';
import { store } from './store.js';
import { preloadSfx } from './audio.js';

const app = document.getElementById('app');
let dispose = null;
let booted = false;

function nav(hash) { if (location.hash === hash) route(); else location.hash = hash; }
const blackout = h('div', { class: 'blackout' }); document.body.append(blackout);
function fadeTo(hash, ms = 700) { blackout.classList.add('on'); setTimeout(() => { nav(hash); setTimeout(() => blackout.classList.remove('on'), 60); }, ms); }

let shell = null;
const TAB_IDS = ['home', 'map', 'drills', 'album', 'ranks', 'hangar', 'profile'];
async function route() {
  const [path, qs] = (location.hash.slice(1) || '/').split('?');
  const q = new URLSearchParams(qs || '');
  const params = Object.fromEntries(q.entries());
  document.body.classList.toggle('reduce-motion', !!store.settings.reduceMotion);
  document.documentElement.style.setProperty('--ts', String(store.settings.textScale || 1));
  if (!booted && path !== '/' && path !== '') { booted = true; return mount(loadingScreen, location.hash); }
  booted = true;
  if (path === '/' || path === '') return mount(loadingScreen, '#/home');
  let tab = path.slice(1);
  if (tab === 'menu') tab = 'home';
  if (TAB_IDS.includes(tab)) {
    if (shell && document.body.contains(shell.shell)) { shell.show(tab, params); return; }
    const { mountShell } = await import('./ui/screens.js');
    return mount((el) => { shell = mountShell(el, tab, params); return () => { shell.dispose(); shell = null; }; });
  }
  if (path.startsWith('/game/')) {
    const drillId = path.slice(6);
    const [{ mountGame }, { loadInstrumentModels }, { loadPhysics }] = await Promise.all([import('./game/session.js'), import('./game/instruments.js'), import('./game/physics.js')]);
    await Promise.all([loadInstrumentModels(), loadPhysics()]);
    return mount((el) => mountGame(el, { drillId, level: q.get('level') || 'BEGINNER', hand: q.get('hand') || store.profile.hand, mode: q.get('mode') || 'PRACTICE', variant: q.get('v') || null }, nav));
  }
  mount(notFound);
}
function mount(screen, arg) {
  document.querySelectorAll('.overlay, .sheet-wrap, .celebrate').forEach((o) => o.remove());
  if (dispose) { try { dispose(); } catch (e) { console.error(e); } dispose = null; }
  app.innerHTML = '';
  dispose = screen(app, arg) || null;
}
window.addEventListener('hashchange', route);

// ------------------------------------------------------------------ loading
function loadingScreen(el, next) {
  const fill = h('div', { class: 'ld-fill' }), pct = h('div', { class: 'ld-pct' }, '0%');
  el.append(h('div', { class: 'screen loading' },
    h('video', { class: 'bg-video', src: 'assets/clouds.mp4', autoplay: true, muted: true, loop: true, playsinline: true }),
    h('div', { class: 'bg-shade' }), h('div', { class: 'grain' }),
    h('div', { class: 'ld-box' }, h('img', { src: 'assets/img/logo.png', alt: 'Top Gun Surgeon' }), h('div', { class: 'ld-title' }, 'Preflight checks'), h('div', { class: 'ld-bar' }, fill), pct)));
  el.querySelector('video').muted = true;
  let real = 0, shown = 0, done = false;
  const tasks = [
    preloadSfx((p) => (real = Math.max(real, p * 0.4))),
    import('./game/session.js').then(() => (real = Math.max(real, 0.6))),
    import('./game/instruments.js').then((m) => m.loadInstrumentModels()).then(() => (real = Math.max(real, 0.75))),
    import('./game/physics.js').then((m) => m.loadPhysics()).then(() => (real = Math.max(real, 0.9))),
    document.fonts?.ready,
    new Promise((r) => { const v = el.querySelector('video'); v.addEventListener('canplay', r, { once: true }); setTimeout(r, 2500); }),
  ];
  Promise.all(tasks).then(() => { real = 1; }).catch(() => { real = 1; });
  const iv = setInterval(() => {
    shown = Math.min(real * 100, shown + 2);
    fill.style.width = shown + '%'; pct.textContent = Math.round(shown) + '%';
    if (shown >= 100 && !done) { done = true; clearInterval(iv); setTimeout(() => fadeTo(next || '#/home', 400), 150); }
  }, 30);
  return () => clearInterval(iv);
}

function notFound(el) {
  el.append(h('div', { class: 'screen loading' }, h('div', { class: 'ld-box' }, h('div', { class: 'ld-title' }, 'Off the map'), h('button', { class: 'btn primary', onclick: () => nav('#/home') }, 'Back to base'))));
}

route();

// Installable app: network-first service worker (keeps working offline, never serves stale code online).
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
