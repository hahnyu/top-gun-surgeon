// Player progression derived from saved runs: XP / rank level, medals per drill level, next goal.
import { store, LEVELS, LEVEL_WEIGHTS, tierForRuns } from './store.js';

export const DRILL_IDS = ['pea-drop', 'triangle-transfer', 'cobra-rope', 'cylinder-transfer', 'suturing'];
export const DRILL_NAMES = { 'pea-drop': 'Pea Drop', 'triangle-transfer': 'Triangle Transfer', 'cobra-rope': 'Cobra Rope', 'cylinder-transfer': 'Cylinder Transfer', suturing: 'Suturing' };
export const RANK_TITLES = ['Cadet', 'Trainee', 'Intern', 'Resident', 'Wingman', 'Flight Surgeon', 'Ace', 'Squadron Lead', 'Chief', 'Top Gun'];

export const xpForRun = (r) => Math.round((r.overall_score || 0) * (LEVEL_WEIGHTS[r.level] || 1) * (r.mode === 'COMPETITION' ? 1.25 : 1));
const xpToNext = (lvl) => 120 + 80 * (lvl - 1);

export function totalXp() { return store.data.runs.reduce((s, r) => s + xpForRun(r), 0); }
export function rankFor(xp) {
  let lvl = 1, rest = xp;
  while (rest >= xpToNext(lvl)) { rest -= xpToNext(lvl); lvl++; }
  const need = xpToNext(lvl);
  return { level: lvl, into: rest, need, pct: rest / need, title: RANK_TITLES[Math.min(RANK_TITLES.length - 1, Math.floor((lvl - 1) / 3))] };
}
export const medalFor = (s) => (s === null || s === undefined ? null : s >= 90 ? 'gold' : s >= 75 ? 'silver' : s >= 60 ? 'bronze' : null);

// ---- Three stars per mission: ★ finish it · ★★ with few bumps · ★★★ few bumps and a 75+ score
export const BUMPS_OK = { 'pea-drop': 2, 'triangle-transfer': 1, 'cobra-rope': 1, 'cylinder-transfer': 2 };
export const STAR_SCORE = 75;
/** Par times (s) for Speed runs: a quick, clean kid run. */
export const PAR = { 'pea-drop': 110, 'triangle-transfer': 80, 'cylinder-transfer': 190, 'cobra-rope': 150 };
export function starsFor(r) {
  if (!r) return 0;
  if (r.stars !== undefined) return r.stars;
  const id = r.drill_id ?? r.drillId, few = (r.errors || 0) <= (BUMPS_OK[id] ?? 2);
  if (!few) return 1;
  // Speed run: the third star is beating par instead of the score
  if (r.variant === 'speed') return (r.time_seconds ?? r.time ?? 1e9) <= (PAR[id] ?? 0) ? 3 : 2;
  return (r.overall_score ?? r.overall ?? 0) >= STAR_SCORE ? 3 : 2;
}
export const STAR_MEDAL = [null, 'bronze', 'silver', 'gold'];
export function bestStars(drillId, level) {
  let b = 0; for (const r of store.data.runs) if (r.drill_id === drillId && r.level === level) b = Math.max(b, starsFor(r));
  return b;
}
export function starTotal() { return DRILL_IDS.filter((d) => d !== 'suturing').reduce((s, d) => s + LEVELS.reduce((a, l) => a + bestStars(d, l), 0), 0); }

/** Per drill: levels with best score, medal and lock state. */
export function drillLadder(id) {
  const unl = store.unlockedLevels(id);
  return LEVELS.map((l, i) => {
    const best = store.bestFor(id, { level: l }), stars = bestStars(id, l);
    return { level: l, best, stars, medal: STAR_MEDAL[stars], unlocked: unl[l], requirement: i ? `Finish ${LEVELS[i - 1].toLowerCase()} (1 star) to unlock` : null };
  });
}
export function medalCount(id) { return drillLadder(id).filter((r) => r.medal).length; }

/** Snapshot of everything a run can change, for before/after reward moments. */
export function snapshot() {
  const xp = totalXp();
  return {
    xp, rank: rankFor(xp).level, coins: store.coins,
    unlocked: Object.fromEntries(DRILL_IDS.map((id) => [id, { ...store.unlockedLevels(id) }])),
    tiers: Object.fromEntries(DRILL_IDS.map((id) => [id, tierForRuns(store.weightedRuns(id)).tier.index])),
  };
}

export function lastPlayed() {
  const r = store.data.runs.at(-1);
  if (r) return { drillId: r.drill_id, level: r.level, mode: r.mode };
  let id = null; try { id = sessionStorage.getItem('lastDrillId'); } catch { /* ignore */ }
  return { drillId: id || 'pea-drop', level: 'BEGINNER', mode: 'PRACTICE' };
}

/** The single most useful thing to do next. */
export function nextGoal() {
  const order = [lastPlayed().drillId, ...DRILL_IDS.filter((d) => d !== lastPlayed().drillId && d !== 'suturing')];
  for (const id of order) {
    if (id === 'suturing') continue;
    const ladder = drillLadder(id);
    const locked = ladder.findIndex((r) => !r.unlocked);
    if (locked > 0) {
      const prev = ladder[locked - 1];
      return { drillId: id, level: prev.level, title: `Unlock ${nice(ladder[locked].level)}`, text: `Finish ${DRILL_NAMES[id]} · ${nice(prev.level)} once (1 star) to open it`, progress: 0 };
    }
  }
  for (const id of order) {
    if (id === 'suturing') continue;
    const r = drillLadder(id).find((x) => x.stars < 3);
    if (r) return { drillId: id, level: r.level, title: r.stars === 2 ? 'Go for 3 stars' : 'Earn another star', text: `${DRILL_NAMES[id]} · ${nice(r.level)} — ${r.stars === 2 ? `few bumps and ${STAR_SCORE}+ points` : `finish with ${BUMPS_OK[id]} bump${BUMPS_OK[id] === 1 ? '' : 's'} or fewer`}`, progress: r.stars / 3 };
  }
  return { drillId: 'pea-drop', level: 'EXPERT', title: 'Hold the line', text: 'Every star collected. Defend your leaderboard spots.', progress: 1 };
}
export const nice = (l) => l.charAt(0) + l.slice(1).toLowerCase();
