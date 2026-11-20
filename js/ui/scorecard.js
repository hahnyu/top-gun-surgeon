// Debrief: scores the sortie, saves it, then plays the reward moments (coins, XP, unlocks, promotions).
import { h, icon, fmtTime } from './dom.js';
import { sheet, btn, bar, wallet } from './kit.js';
import { coinFly, celebrate } from './rewards.js';
import { store, COIN_MULTIPLIERS, LEVELS, TIERS, METAL_STYLE } from '../store.js';
import { sfx, haptic } from '../audio.js';
import { snapshot, xpForRun, rankFor, nice, DRILL_IDS, DRILL_NAMES, nextGoal, starsFor, BUMPS_OK, STAR_SCORE, bestStars } from '../progress.js';
import { factCard, scout, speak } from './buddy.js';
import { afterRun, ghostFor, saveGhost, breakDue, VARIANTS, PAR, TRACK_EVERY } from '../campaign.js';
import { stickerEl } from './album.js';

const clamp = (v) => Math.max(0, Math.min(100, v));
const DJ_MID = -14;
const BUDGET = {
  'pea-drop': { time: 55, path: 95 },
  'triangle-transfer': { time: 45, path: 55 },
  'cobra-rope': { time: 120, path: 140 },
  'cylinder-transfer': { time: 150, path: 150 },
};
export function computeScore(m) {
  const b = BUDGET[m.drillId] || { time: 30, path: 40 };
  const parts = {
    time: clamp(100 - Math.max(0, m.time - b.time) * (100 / (b.time * 1.6))),
    errors: clamp(100 - m.errors * 10 - (m.misses || 0) * 5),
    smoothness: clamp((m.dimensionlessJerk - DJ_MID + 5) * 10),
    path: clamp(100 - Math.max(0, m.pathLength / b.path - 1) * 90),
    motion: clamp((m.timeInMotion / (m.timeInMotion + m.timeStill + 0.001)) * 100),
    snaps: clamp(100 - m.snapCount * 5),
  };
  let overall = parts.time * 0.2 + parts.errors * 0.2 + parts.smoothness * 0.2 + parts.path * 0.15 + parts.motion * 0.1 + parts.snaps * 0.15;
  const pillars = { speed: parts.time, precision: parts.errors, control: (parts.smoothness + parts.path + parts.motion + parts.snaps) / 4 };
  // Cobra: finesse = how many reps you pulled tight into a "Line of Nick" (worth a fifth of the score)
  if (m.finesseMax) { parts.finesse = clamp((m.finesse || 0) / m.finesseMax * 100); pillars.finesse = parts.finesse; overall = overall * 0.8 + parts.finesse * 0.2; }
  overall = Math.round(overall);
  return { overall, parts, pillars };
}

/** One specific, actionable line from the rep timeline and pillars. */
function coaching(m, pillars, durs) {
  if (m.finesseMax && (m.finesse || 0) < m.finesseMax) return `Line of Nick on ${m.finesse || 0} of ${m.finesseMax} reps. Pull the rope tight between your hands every rep for a better finesse score!`;
  if (durs.length >= 3) {
    const sorted = [...durs].sort((a, b) => a - b), med = sorted[Math.floor(sorted.length / 2)];
    const worst = durs.indexOf(Math.max(...durs));
    if (durs[worst] > med * 1.7 && durs[worst] - med > 3) return `Rep ${worst + 1} took ${durs[worst].toFixed(1)} s — longer than your others. Line up above it first, then go down and grab.`;
  }
  const errRep = (m.reps || []).findIndex((r) => r.errors > 0);
  if (errRep >= 0) return `You bumped on rep ${errRep + 1}. Watch the shadow under the tip — when they meet, you’re touching.`;
  const weakest = Object.entries(pillars).sort((a, b) => a[1] - b[1])[0];
  if (weakest[0] === 'speed' && weakest[1] < 80) return 'No bumps — great! Next time, move a little quicker between grabs.';
  if (weakest[0] === 'control' && weakest[1] < 80) return 'No bumps — great! Try one smooth move instead of lots of little ones.';
  return 'Textbook flying! Try the next level or fly Compete for the board.';
}

export function showScoreCard(m, { onRetry, onDrills, onHome }) {
  const { overall, pillars } = computeScore(m);
  const before = snapshot();
  const stars = starsFor({ drill_id: m.drillId, errors: m.errors, overall_score: overall, variant: m.variant, time_seconds: m.time });
  const prevStars = bestStars(m.drillId, m.level);
  // ghost: keep the fastest finished run to race next time
  const oldGhost = ghostFor(m.drillId, m.level, m.variant);
  const beatGhost = !!oldGhost && m.time > 5 && m.time < oldGhost.time;
  if (m.ghostRec && m.time > 5 && m.ghostRec.path.length > 10 && (!oldGhost || beatGhost)) saveGhost(m.drillId, m.level, m.variant, m.ghostRec);
  const res = store.recordRun({ stars, variant: m.variant || undefined,
    drill_id: m.drillId, drill_name: m.drillName, level: m.level, hand: m.hand, mode: m.mode, overall_score: overall,
    time_seconds: +m.time.toFixed(2), errors: m.errors, misses: m.misses || 0, path_length: +m.pathLength.toFixed(2),
    dimensionless_jerk: +m.dimensionlessJerk.toFixed(2), snap_count: m.snapCount, ...(m.finesseMax ? { finesse: m.finesse || 0 } : {}),
  });
  const moments = afterRun(store.data.runs.at(-1), { beatGhost });
  const after = snapshot();
  const xp = xpForRun({ overall_score: overall, level: m.level, mode: m.mode });
  const reps = m.reps || [];
  const durs = reps.map((r, i) => r.t - (i ? reps[i - 1].t : 0));

  // one highlight worth celebrating
  const fastest = durs.length > 1 ? durs.indexOf(Math.min(...durs)) : -1;
  const highlight = beatGhost ? `You beat your ghost by ${(oldGhost.time - m.time).toFixed(1)} s!` : stars > prevStars ? `New star${stars - prevStars > 1 ? 's' : ''} on ${nice(m.level)}!`
    : res.isNewBest ? 'Your best score yet!'
    : m.errors === 0 ? 'Zero bumps — clean hands!'
    : fastest >= 0 ? `Rep ${fastest + 1} was your fastest: ${durs[fastest].toFixed(1)} s`
    : 'Mission complete!';
  const bumpsOk = BUMPS_OK[m.drillId] ?? 2;
  const starRow = h('div', { class: 'star-row' }, [['Finished', true], [`${bumpsOk} bump${bumpsOk === 1 ? '' : 's'} or less`, stars >= 2], [m.variant === 'speed' ? `Under par ${fmtTime(PAR[m.drillId])}` : `${STAR_SCORE}+ points`, stars >= 3]].map(([t, on], i) =>
    h('div', { class: 'sr-star' + (on ? ' on' : ''), style: { '--d': `${0.25 + i * 0.35}s` } }, h('span', { class: 'sr-ic' }, icon('star')), h('small', {}, t))));
  const sh = sheet('Debrief', { onClose: () => onDrills(), cls: 'sc debrief' });
  const w = wallet(); w.set(before.coins);
  sh.el.querySelector('.sh-head').insertBefore(w.el, sh.el.querySelector('.sh-head .b'));
  const scoreEl = h('span', {}, '0');
  const pill = (label, v) => h('div', { class: 'pillar' }, h('div', { class: 'pl-top' }, h('span', { class: 't-over' }, label), h('b', { class: 't-num' }, Math.round(v))), bar(v / 100, v >= 90 ? 'gold' : ''));
  const maxD = Math.max(1, ...durs);
  const timeline = durs.length ? h('div', { class: 'reps' }, durs.map((d, i) => h('div', { class: 'rep' + (reps[i].errors ? ' bad' : ''), title: `Rep ${i + 1}: ${d.toFixed(1)} s${reps[i].errors ? `, ${reps[i].errors} error(s)` : ''}` },
    h('i', { style: { height: Math.max(8, (d / maxD) * 100) + '%' } }), h('span', {}, i + 1)))) : null;
  const coinsRow = h('div', { class: 'dbf-coins' }, h('span', { class: 'coin' }, 'S'), h('b', { class: 't-num' }, `+${res.earned}`), h('span', { class: 't-faint' }, `${overall} × ${COIN_MULTIPLIERS[m.level]}`), h('span', { style: { flex: 1 } }), h('b', { class: 't-num', style: { color: 'var(--brand-hi)' } }, `+${xp} XP`));
  const goal = nextGoal();
  sh.body.append(
    h('div', { class: 'dbf-top' },
      h('div', {},
        h('div', { class: 't-over' }, `${m.drillName} · ${nice(m.level)} · ${m.variant ? VARIANTS[m.variant].name : m.mode.toLowerCase()}`),
        h('div', { class: 'score' }, scoreEl, h('small', {}, '/100')),
        h('div', { class: 't-dim' }, res.isNewBest ? h('span', { class: 'newbest' }, '★ New best') : `Best ${res.best}`, ' · ', fmtTime(m.time), ' · ', `${m.errors} ${m.drillId === 'cobra-rope' ? 'strike' : 'bump'}${m.errors === 1 ? '' : 's'}`))),
    starRow,
    h('div', { class: 'dbf-buddy' }, scout(stars === 3 ? 'cheer' : 'happy', { size: 56 }), h('div', {}, h('b', {}, highlight), h('div', { class: 't-dim' }, coaching(m, pillars, durs)))),
    ['pea-drop', 'triangle-transfer'].includes(m.drillId) ? h('div', { class: 'tg-time' }, h('span', { class: 't-over' }, 'Top Gun corrected time'), h('b', { class: 't-num' }, fmtTime(m.time + 5 * m.errors)), h('span', { class: 't-faint' }, `${fmtTime(m.time)} + 5 s for each bump · lower is better`)) : null,
    h('div', { class: 'pillars' }, pill('Speed', pillars.speed), pill('Accuracy', pillars.precision), pill('Smooth hands', pillars.control), m.finesseMax ? pill(`Finesse · Line of Nick ${m.finesse || 0}/${m.finesseMax}`, pillars.finesse) : null),
    timeline ? h('div', {}, h('div', { class: 't-over', style: { margin: '14px 0 6px' } }, 'Rep timeline'), timeline) : null,
    coinsRow,
    h('details', { class: 'clin' }, h('summary', {}, 'For grown-ups'),
      h('div', { class: 'dl' },
        m.drillId !== 'triangle-transfer' ? [h('span', {}, 'Misses'), h('b', {}, String(m.misses || 0))] : [],
        h('span', {}, 'Path length'), h('b', {}, m.pathLength.toFixed(1)), h('span', {}, 'Mean velocity'), h('b', {}, m.meanVelocity.toFixed(2)),
        h('span', {}, 'Max velocity'), h('b', {}, m.maxVelocity.toFixed(2)), h('span', {}, 'Dimensionless jerk'), h('b', {}, m.dimensionlessJerk.toFixed(2)),
        h('span', {}, 'Time in motion'), h('b', {}, `${Math.round((m.timeInMotion / (m.timeInMotion + m.timeStill + 0.001)) * 100)}%`), h('span', {}, 'Snap count'), h('b', {}, String(m.snapCount)))),
    factCard(),
    h('div', { class: 'dbf-acts' },
      btn('Home', { kind: 'ghost', iconName: 'home', onClick: () => { sh.close(true); onHome?.(); } }),
      btn('Drills', { kind: 'glass', iconName: 'grid', onClick: () => sh.close() }),
      h('div', { style: { flex: 1 } }, btn('Fly again', { kind: 'primary', block: true, size: 'lg', iconName: 'retry', onClick: () => { sh.close(true); onRetry(); } }))));

  // count-up, then coins into the wallet, then any unlock / promotion celebrations in order
  const t0 = performance.now();
  const tick = (now) => { const k = Math.min(1, (now - t0) / 900); scoreEl.textContent = String(Math.round(overall * (1 - (1 - k) ** 3))); if (k < 1) requestAnimationFrame(tick); else afterCount(); };
  requestAnimationFrame(tick);
  async function afterCount() {
    starRow.classList.add('go'); for (let i = 0; i < stars; i++) setTimeout(() => { sfx('chime', 3 + i * 2); haptic(20 + i * 15); }, 250 + i * 350);
    if (stars) setTimeout(() => sfx('medal'), 250 + stars * 350);
    speak(highlight);
    await new Promise((r) => setTimeout(r, 350));
    await coinFly(coinsRow.querySelector('.coin'), w.el, res.earned, (k) => { w.set(Math.round(before.coins + res.earned * k)); w.bump(); });
    w.set(after.coins);
    for (const id of DRILL_IDS) for (const l of LEVELS) if (after.unlocked[id][l] && !before.unlocked[id][l]) {
      await celebrate({ over: 'Level unlocked', title: nice(l), sub: `${DRILL_NAMES[id]} — new modifiers await`, cta: 'Onward' });
    }
    if (after.rank > before.rank) {
      const r = rankFor(after.xp);
      await celebrate({ over: 'Promotion', title: `Rank ${r.level}`, sub: r.title, emblem: h('div', { class: 'rank-badge lg', style: { '--p': 100, margin: '0 auto' } }, h('span', {}, r.level)), cta: 'Salute' });
    }
    for (const x of moments) {
      if (x.kind === 'sticker') await celebrate({ over: x.sticker.bonus ? 'Surprise sticker!' : 'New sticker', title: x.sticker.name, sub: x.sticker.how, emblem: stickerEl(x.sticker, { big: true }), cta: 'Stick it in' });
      else if (x.kind === 'track') await celebrate({ over: 'Reward track', title: `+${x.coins} coins`, sub: `Step ${x.step} — a reward every ${TRACK_EVERY} missions`, emblem: h('span', { class: 'coin big' }, 'S'), cta: 'Collect' });
      else if (x.kind === 'daily') await celebrate({ over: 'Daily flight plan done', title: `${x.streak}-day trail`, sub: x.used ? `+${x.coins} coins · a free freeze day kept your trail going` : `+${x.coins} coins · see you tomorrow, pilot!`, emblem: scout('cheer', { size: 120 }), cta: 'Great' });
    }
    w.set(store.coins);
    for (const id of DRILL_IDS) if (after.tiers[id] > before.tiers[id]) {
      const t = TIERS[after.tiers[id]]; const s = METAL_STYLE[t.metal];
      await celebrate({ over: `${DRILL_NAMES[id]} mastery`, title: t.name, emblem: h('div', { class: 'tier-badge', style: { margin: '0 auto', background: `linear-gradient(160deg, ${s.a}, ${s.b} 55%, ${s.c})` } }, t.roman), cta: 'Continue' });
    }
    // healthy breaks: after ~20 minutes of flying, Scout suggests a stretch
    if (breakDue()) await celebrate({ over: 'Great flying!', title: 'Time for a break?', sub: 'Real surgeons rest their hands and eyes too. Stretch, get some water, and come back later.', emblem: scout('happy', { size: 120 }), cta: 'Okay!' });
  }
  return { goal };
}
