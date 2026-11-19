// Reward moments: coins flying to the wallet and full-screen celebrations (unlocks, promotions, tier-ups).
import { h } from './dom.js';
import { btn } from './kit.js';
import { sfx, synth, haptic } from '../audio.js';
import { store } from '../store.js';

const reduce = () => store.settings.reduceMotion || matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Fly up to 12 coins from `fromEl` to `toEl`, ticking the wallet up as they land. */
export function coinFly(fromEl, toEl, amount, onTick) {
  return new Promise((res) => {
    if (!amount || !fromEl || !toEl) { res(); return; }
    const a = fromEl.getBoundingClientRect(), b = toEl.getBoundingClientRect();
    const n = Math.min(12, Math.max(3, Math.round(amount / 10)));
    if (reduce()) { onTick?.(1); res(); return; }
    let landed = 0;
    for (let i = 0; i < n; i++) {
      const c = h('div', { class: 'coin-fly' }, h('span', { class: 'coin', style: { width: '26px', height: '26px' } }, 'S'));
      document.body.append(c);
      const sx = a.left + a.width / 2 + (Math.random() - 0.5) * 60, sy = a.top + a.height / 2 + (Math.random() - 0.5) * 30;
      const ex = b.left + 14, ey = b.top + b.height / 2 - 13;
      const mx = (sx + ex) / 2 + (Math.random() - 0.5) * 200, my = Math.min(sy, ey) - 80 - Math.random() * 80;
      const anim = c.animate([
        { transform: `translate(${sx}px, ${sy}px) scale(.4)`, opacity: 0 },
        { transform: `translate(${sx}px, ${sy - 20}px) scale(1.1)`, opacity: 1, offset: 0.15 },
        { transform: `translate(${mx}px, ${my}px) scale(1)`, offset: 0.55 },
        { transform: `translate(${ex}px, ${ey}px) scale(.7)`, opacity: 1 },
      ], { duration: 800 + i * 55, easing: 'cubic-bezier(.5,0,.3,1)', delay: i * 45, fill: 'both' });
      anim.onfinish = () => {
        c.remove(); landed++; synth('coin'); haptic(4); onTick?.(landed / n);
        if (landed === n) res();
      };
    }
  });
}

/** Full-screen celebration; resolves when dismissed. */
export function celebrate({ over, title, sub, emblem, cta = 'Continue' }) {
  return new Promise((res) => {
    const close = () => { root.style.transition = 'opacity .2s'; root.style.opacity = '0'; setTimeout(() => { root.remove(); res(); }, 200); };
    const root = h('div', { class: 'celebrate' }, h('div', { class: 'rays' }),
      h('div', { class: 'box' },
        emblem ? h('div', { class: 'emblem' }, emblem) : null,
        h('div', { class: 't-over kick' }, over),
        h('div', { class: 't-display big' }, title),
        sub ? h('div', { class: 'sub' }, sub) : null,
        btn(cta, { kind: 'primary', size: 'lg', onClick: close })));
    document.body.append(root);
    sfx('medal'); haptic([20, 40, 60]);
  });
}
