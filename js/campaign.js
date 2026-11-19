// Phase 6, "the hook": campaign map, rule-keeping variants, stickers and patches, reward track,
// daily flight plan with a gentle streak, ghost runs and personal-best splits.
// Healthy-engagement rules: nothing is for sale, no loot boxes, a missed day never punishes
// (free freeze days), and the game suggests breaks.
import { store, LEVELS } from './store.js';
import { starsFor, DRILL_NAMES, nice, BUMPS_OK, PAR } from './progress.js';
export { PAR };
import { FACTS } from './rules.js';

const D = ['pea-drop', 'triangle-transfer', 'cylinder-transfer', 'cobra-rope'];

// ---------------------------------------------------------------- variants (same rules, new twist)
export const VARIANTS = {
  night: { name: 'Night flight', short: 'Night', text: 'Lights out! Only your scope light shines. Same rules.' },
  speed: { name: 'Speed run', short: 'Speed', text: 'Beat the par time for the third star. Same rules.' },
};

// ---------------------------------------------------------------- campaign map
// Four islands (one per level). Each island: the four drills, then a variant base.
export const ISLANDS = [
  { level: 'BEGINNER', name: 'Beginner Bay', variant: ['pea-drop', 'night'] },
  { level: 'INTERMEDIATE', name: 'Intermediate Isle', variant: ['triangle-transfer', 'speed'] },
  { level: 'ADVANCED', name: 'Advanced Atoll', variant: ['cobra-rope', 'night'] },
  { level: 'EXPERT', name: 'Top Gun Peak', variant: ['cylinder-transfer', 'speed'] },
];
export const NODES = ISLANDS.flatMap((isl, k) => [
  ...D.map((drill) => ({ id: `${drill}:${isl.level}`, drill, level: isl.level, island: k })),
  { id: `${isl.variant[0]}:${isl.level}:${isl.variant[1]}`, drill: isl.variant[0], level: isl.level, variant: isl.variant[1], island: k },
]).map((n, i) => ({ ...n, n: i + 1 }));

export function nodeStars(node) {
  let b = 0;
  for (const r of store.data.runs) if (r.drill_id === node.drill && r.level === node.level && (node.variant ? r.variant === node.variant : true)) b = Math.max(b, starsFor(r));
  return b;
}
/** Map state: each node's stars and whether it's open (the one before it has a star). */
export function mapState() {
  let open = true;
  return NODES.map((n) => { const s = nodeStars(n); const st = { ...n, stars: s, open }; open = open && s >= 1; return st; });
}
export function currentNode() { const m = mapState(); return m.find((n) => n.open && n.stars === 0) || m.filter((n) => n.open).find((n) => n.stars < 3) || m[m.length - 1]; }

// ---------------------------------------------------------------- stickers
// art: icon name; c: sticker colour; shape: circle | star | shield | wing
export const STICKERS = [
  { id: 'first-flight', name: 'First flight', how: 'Finish your first mission', art: 'plane', c: 'sky', shape: 'circle' },
  { id: 'clean-hands', name: 'Clean hands', how: 'Finish a mission with zero bumps', art: 'check', c: 'mint', shape: 'circle' },
  { id: 'triple', name: 'Triple star', how: 'Get 3 stars on any mission', art: 'star', c: 'sun', shape: 'star' },
  { id: 'scholar', name: 'Rule scholar', how: 'Pass Rule school for all four drills', art: 'flag', c: 'paper', shape: 'shield' },
  { id: 'quiz-whiz', name: 'Quiz whiz', how: 'Get 3 of 3 on a rule quiz', art: 'flag', c: 'sun', shape: 'circle' },
  { id: 'night-owl', name: 'Night owl', how: 'Finish a Night flight', art: 'target', c: 'navy', shape: 'circle' },
  { id: 'speedster', name: 'Speedster', how: 'Beat par on a Speed run', art: 'rotR', c: 'tom', shape: 'wing' },
  { id: 'ghostbuster', name: 'Ghost buster', how: 'Beat your own ghost', art: 'user', c: 'paper', shape: 'circle' },
  { id: 'plan-done', name: 'Flight planner', how: 'Finish a daily flight plan', art: 'check', c: 'sky', shape: 'shield' },
  { id: 'streak-3', name: '3-day trail', how: 'Fly your plan 3 days in a row', art: 'plane', c: 'orange', shape: 'wing' },
  { id: 'streak-7', name: '7-day trail', how: 'Fly your plan 7 days in a row', art: 'plane', c: 'tom', shape: 'wing' },
  { id: 'island-hop', name: 'Island hopper', how: 'Reach Intermediate Isle on the map', art: 'home', c: 'mint', shape: 'circle' },
  { id: 'expert', name: 'Top Gun Peak', how: 'Finish any Expert mission', art: 'crown', c: 'sun', shape: 'star' },
  { id: 'full-map', name: 'Map complete', how: 'Get a star on every base', art: 'trophy', c: 'sun', shape: 'shield' },
  { id: 'marathon', name: 'Frequent flyer', how: 'Fly 25 missions', art: 'medal', c: 'sky', shape: 'star' },
  { id: 'fact-fan', name: 'Fact fan', how: 'Collect 6 Real surgeon cards', art: 'user', c: 'sky', shape: 'shield' },
  // reward-track wings
  { id: 'wings-1', name: 'Bronze wings', how: 'Reward track', art: 'plane', c: 'bronze', shape: 'wing', track: true },
  { id: 'wings-2', name: 'Silver wings', how: 'Reward track', art: 'plane', c: 'silver', shape: 'wing', track: true },
  { id: 'wings-3', name: 'Gold wings', how: 'Reward track', art: 'plane', c: 'sun', shape: 'wing', track: true },
  { id: 'wings-4', name: 'Sky wings', how: 'Reward track', art: 'plane', c: 'sky', shape: 'wing', track: true },
  // little surprises after a great run (free, never bought)
  { id: 'bonus-pea', name: 'Happy pea', how: 'Surprise after a 3-star run', art: 'target', c: 'mint', shape: 'circle', bonus: true },
  { id: 'bonus-comet', name: 'Comet', how: 'Surprise after a 3-star run', art: 'star', c: 'orange', shape: 'star', bonus: true },
  { id: 'bonus-hook', name: 'Lucky hook', how: 'Surprise after a 3-star run', art: 'rotL', c: 'sun', shape: 'circle', bonus: true },
  { id: 'bonus-tower', name: 'Control tower', how: 'Surprise after a 3-star run', art: 'home', c: 'sky', shape: 'shield', bonus: true },
];
export const hasSticker = (id) => !!store.data.stickers?.[id];

// ---------------------------------------------------------------- patches (one per drill)
export function patchFor(drill) {
  const st = LEVELS.map((l) => { let b = 0; for (const r of store.data.runs) if (r.drill_id === drill && r.level === l) b = Math.max(b, starsFor(r)); return b; });
  return { drill, name: DRILL_NAMES[drill], tier: st.every((s) => s >= 3) ? 'gold' : st.every((s) => s >= 1) ? 'bronze' : null, stars: st.reduce((a, b) => a + b, 0) };
}

// ---------------------------------------------------------------- reward track
export const TRACK_EVERY = 3; // a reward every 3 missions
const TRACK = [{ coins: 150 }, { sticker: 'wings-1' }, { coins: 200 }, { coins: 250 }, { sticker: 'wings-2' }, { coins: 300 }, { coins: 350 }, { sticker: 'wings-3' }, { coins: 400 }, { coins: 450 }, { sticker: 'wings-4' }, { coins: 500 }];
export const trackReward = (k) => TRACK[k] || { coins: 500 };
export function trackState() {
  const missions = store.data.runs.length, step = Math.floor(missions / TRACK_EVERY);
  return { step, into: missions % TRACK_EVERY, claimed: store.data.track?.claimed || 0, given: store.data.track?.given || 0, next: trackReward(store.data.track?.given || 0) };
}

// ---------------------------------------------------------------- daily flight plan + gentle streak
export const today = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const dayNum = (s) => Math.round(new Date(s + 'T12:00:00').getTime() / 864e5);
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
/** Three short missions for today, picked from levels the player has open. */
export function dailyPlan() {
  const day = today(), r = rng(dayNum(day) * 7919);
  const open = D.flatMap((d) => LEVELS.filter((l) => store.unlockedLevels(d)[l]).map((l) => ({ d, l })));
  const pick = () => open[Math.floor(r() * open.length)] || { d: 'pea-drop', l: 'BEGINNER' };
  const a = pick(); let b = pick(); for (let i = 0; i < 6 && b.d === a.d; i++) b = pick();
  const c = pick();
  return [
    { id: 'fly', text: `Fly ${DRILL_NAMES[a.d]} · ${nice(a.l)}`, drill: a.d, level: a.l, test: (x) => x.drill_id === a.d && x.level === a.l },
    { id: 'clean', text: `${DRILL_NAMES[b.d]} with ${BUMPS_OK[b.d]} bump${BUMPS_OK[b.d] === 1 ? '' : 's'} or less`, drill: b.d, level: b.l, test: (x) => x.drill_id === b.d && (x.errors || 0) <= BUMPS_OK[b.d] },
    { id: 'stars', text: 'Earn 2 stars on any mission', drill: c.d, level: c.l, test: (x) => starsFor(x) >= 2 },
  ];
}
export function dailyState() {
  const day = today(), plan = dailyPlan();
  const runs = store.data.runs.filter((x) => today(new Date(x.created)) === day);
  const done = plan.map((m) => runs.some(m.test));
  return { day, plan, done, complete: done.every(Boolean), claimed: store.data.daily?.claimed === day, streak: streakState() };
}
export function streakState() {
  const s = store.data.streak || {};
  let count = s.count || 0;
  // a gap is covered by free freeze days; never shame a missed day, just start a new trail
  if (s.last) { const gap = dayNum(today()) - dayNum(s.last) - 1; if (gap > (s.freezes ?? 2)) count = 0; }
  return { count, best: s.best || 0, freezes: s.freezes ?? 2, last: s.last || null };
}

// ---------------------------------------------------------------- ghosts (best run replay) — own key, not the main save
const GK = 'tgs:ghosts';
const loadG = () => { try { return JSON.parse(localStorage.getItem(GK) || '{}'); } catch { return {}; } };
export function ghostFor(drill, level, variant) { return loadG()[[drill, level, variant || ''].join(':')] || null; }
export function saveGhost(drill, level, variant, g) {
  const all = loadG(); all[[drill, level, variant || ''].join(':')] = g;
  try { localStorage.setItem(GK, JSON.stringify(all)); } catch { /* full: skip */ }
}

/** Achievement stickers that the whole history has earned (so old saves get theirs too). */
function earnedFromHistory() {
  const runs = store.data.runs, out = [];
  if (runs.length) out.push('first-flight');
  if (runs.some((r) => (r.errors || 0) === 0)) out.push('clean-hands');
  if (runs.some((r) => starsFor(r) >= 3)) out.push('triple');
  if (runs.some((r) => r.variant === 'night')) out.push('night-owl');
  if (runs.some((r) => r.variant === 'speed' && starsFor(r) >= 3)) out.push('speedster');
  if (runs.some((r) => r.level === 'EXPERT')) out.push('expert');
  if (runs.length >= 25) out.push('marathon');
  const m = mapState();
  if (m[5]?.open) out.push('island-hop');
  if (m.every((n) => n.stars >= 1)) out.push('full-map');
  if (D.every((x) => store.schoolFor(x)?.done)) out.push('scholar');
  if (D.some((x) => store.schoolFor(x)?.quiz >= 3)) out.push('quiz-whiz');
  if ((store.data.facts || []).length >= 6) out.push('fact-fan');
  return out;
}
/** Quietly add stickers already earned (used when opening the album). */
export function syncStickers() {
  const d = store.data; d.stickers ||= {}; let n = 0;
  for (const id of earnedFromHistory()) if (!d.stickers[id]) { d.stickers[id] = Date.now(); n++; }
  if (n) store.save();
}

// ---------------------------------------------------------------- after every finished mission
/** Updates collections, track, daily plan and streak. Returns the moments to celebrate, in order. */
export function afterRun(run, { beatGhost = false } = {}) {
  const d = store.data; d.stickers ||= {}; d.track ||= { claimed: Math.floor(Math.max(0, d.runs.length - 1) / TRACK_EVERY) }; // old saves start fresh, no flood d.daily ||= {}; d.streak ||= {};
  const out = [];
  const give = (id) => { if (!d.stickers[id]) { d.stickers[id] = Date.now(); out.push({ kind: 'sticker', sticker: STICKERS.find((s) => s.id === id) }); } };
  const stars = starsFor(run);
  for (const id of earnedFromHistory()) give(id);
  if (beatGhost) give('ghostbuster');
  // reward track
  const ts = trackState();
  while (d.track.claimed < ts.step) {
    const rw = trackReward(d.track.given || 0); d.track.claimed++; d.track.given = (d.track.given || 0) + 1; // rewards go in order
    if (rw.coins) { d.profile.coins += rw.coins; out.push({ kind: 'track', coins: rw.coins, step: d.track.given }); }
    if (rw.sticker) give(rw.sticker);
  }
  // daily plan + streak
  const ds = dailyState();
  if (ds.complete && !ds.claimed) {
    d.daily.claimed = ds.day; d.profile.coins += 150;
    const s = d.streak, st = streakState();
    const gap = s.last ? dayNum(ds.day) - dayNum(s.last) - 1 : 0;
    const used = s.last && st.count > 0 ? Math.max(0, gap) : 0;
    s.freezes = Math.max(0, (s.freezes ?? 2) - used);
    s.count = st.count + 1; s.last = ds.day; s.best = Math.max(s.best || 0, s.count);
    if (s.count % 7 === 0) s.freezes = Math.min(3, s.freezes + 1); // a free freeze every week
    give('plan-done'); if (s.count >= 3) give('streak-3'); if (s.count >= 7) give('streak-7');
    out.unshift({ kind: 'daily', coins: 150, streak: s.count, used });
  }
  // a small surprise after a great run (free; never tied to buying anything)
  if (stars >= 3 && Math.random() < 0.25) {
    const left = STICKERS.filter((s) => s.bonus && !d.stickers[s.id]);
    if (left.length) give(left[Math.floor(Math.random() * left.length)].id);
  }
  store.save();
  return out;
}

// ---------------------------------------------------------------- healthy breaks
export function addPlayTime(sec) {
  let t = 0; try { t = +(sessionStorage.getItem('tg-play') || 0) + sec; sessionStorage.setItem('tg-play', String(t)); } catch { /* ignore */ }
  return t;
}
export function breakDue() {
  try { const t = +(sessionStorage.getItem('tg-play') || 0), last = +(sessionStorage.getItem('tg-break') || 0); if (t - last >= 20 * 60) { sessionStorage.setItem('tg-break', String(t)); return true; } } catch { /* ignore */ }
  return false;
}
export const FACT_COUNT = FACTS.length;
