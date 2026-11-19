// Local persistence: profile, runs, coins, cosmetics, settings. Everything lives in localStorage
// so the game is fully playable (and progress is kept) without any backend or sign-in.

export const LEVELS = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT'];
export const COIN_MULTIPLIERS = { BEGINNER: 0.1, INTERMEDIATE: 0.5, ADVANCED: 1.0, EXPERT: 2.0 };
export const LEVEL_WEIGHTS = { BEGINNER: 1, INTERMEDIATE: 2, ADVANCED: 3, EXPERT: 5 };
export const COSMETIC_COST = 2000;
export const UNLOCK_THRESHOLD = 40;

export const TIERS = [
  ['Bronze', 'I', 0], ['Bronze', 'II', 10], ['Bronze', 'III', 25],
  ['Silver', 'I', 100], ['Silver', 'II', 200], ['Silver', 'III', 300],
  ['Gold', 'I', 500], ['Gold', 'II', 1000], ['Gold', 'III', 1500],
  ['Platinum', 'I', 2000], ['Platinum', 'II', 3000], ['Platinum', 'III', 5000],
].map(([metal, roman, runs], i) => ({ metal, roman, runs, index: i, name: `${metal} ${roman}` }));
export const METAL_STYLE = {
  Bronze: { a: '#f3c08f', b: '#b46a2c', c: '#5d3210' },
  Silver: { a: '#ffffff', b: '#bfc6d0', c: '#5d6570' },
  Gold: { a: '#fff4b5', b: '#f2be2e', c: '#7e5a00' },
  Platinum: { a: '#e9fbff', b: '#8fd8e8', c: '#2d6a7a' },
};
export function tierForRuns(runs) {
  let t = TIERS[0];
  for (const x of TIERS) if (runs >= x.runs) t = x;
  const next = TIERS[t.index + 1] || null;
  const pct = next ? (runs - t.runs) / (next.runs - t.runs) : 1;
  return { tier: t, next, pct: Math.max(0, Math.min(1, pct)) };
}
export const coinsForRun = (score, level) => Math.max(0, Math.round(score * (COIN_MULTIPLIERS[level] ?? 0.1)));
export const ownedKey = (drillId, kind, id) => `${drillId}:${kind}:${id}`;

const KEY = 'tgs:v1';
const fresh = () => ({
  profile: { callsign: '', hand: 'RIGHT', coins: 0, owned: [], totalTime: 0, totalRuns: 0, best: {}, created: Date.now() },
  runs: [],
  settings: { reduceMotion: typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches, textScale: 1, autoQuality: true, sfx: true, music: true, voice: true, sens: { move: 1, depth: 1, jaw: 1, rot: 1 }, mouse: false, leftHand: false, quality: 'high' },
  cosmetics: {},
  school: {},   // drillId -> { done, quiz }
  rules: {},    // rule id -> learned timestamp
  facts: [],    // real-surgeon fact ids seen
});

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fresh();
    const d = JSON.parse(raw); const f = fresh();
    return { ...f, ...d, profile: { ...f.profile, ...d.profile }, settings: { ...f.settings, ...d.settings, sens: { ...f.settings.sens, ...(d.settings?.sens || {}) } } };
  } catch { return fresh(); }
}

const data = load();
const devUnlock = /[?&]unlock=1/.test(location.search) || /unlock=1/.test(location.hash);

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* storage full or blocked */ }
  window.dispatchEvent(new CustomEvent('store-change'));
}

export const store = {
  data,
  save,
  get profile() { return data.profile; },
  get settings() { return data.settings; },
  setSetting(k, v) { data.settings[k] = v; save(); },
  setSens(k, v) { data.settings.sens[k] = v; save(); },
  setProfile(patch) { Object.assign(data.profile, patch); save(); },
  displayName() { return data.profile.callsign || 'Surgeon'; },

  // ---- currency
  get coins() { return Math.round(data.profile.coins); },
  addCoins(n) { data.profile.coins = Math.max(0, Math.round(data.profile.coins + n)); save(); },
  isOwned(key) { return devUnlock || key.endsWith(':default') || data.profile.owned.includes(key); },
  purchase(key, cost = COSMETIC_COST) {
    if (this.isOwned(key)) return { ok: true };
    if (data.profile.coins < cost) return { ok: false, reason: 'insufficient' };
    data.profile.coins -= cost; data.profile.owned.push(key); save();
    return { ok: true };
  },

  // ---- cosmetics selection
  getSelection(drillId) { return { env: 'default', instrument: 'default', ...(data.cosmetics[drillId] || {}) }; },
  setSelection(drillId, patch) { data.cosmetics[drillId] = { ...this.getSelection(drillId), ...patch }; save(); },

  // ---- runs
  runsFor(drillId) { return data.runs.filter((r) => r.drill_id === drillId); },
  bestFor(drillId, { level, mode } = {}) {
    let b = null;
    for (const r of data.runs) {
      if (r.drill_id !== drillId) continue;
      if (level && r.level !== level) continue;
      if (mode && r.mode !== mode) continue;
      if (b === null || r.overall_score > b) b = r.overall_score;
    }
    return b;
  },
  unlockedLevels(drillId) {
    const u = { BEGINNER: true, INTERMEDIATE: false, ADVANCED: false, EXPERT: false };
    if (devUnlock) { LEVELS.forEach((l) => (u[l] = true)); return u; }
    for (let i = 1; i < LEVELS.length; i++) {
      // one star (finishing the level) opens the next one
      u[LEVELS[i]] = u[LEVELS[i - 1]] && data.runs.some((r) => r.drill_id === drillId && r.level === LEVELS[i - 1]);
    }
    return u;
  },
  weightedRuns(drillId) {
    return this.runsFor(drillId).reduce((s, r) => s + (LEVEL_WEIGHTS[r.level] || 1), 0);
  },
  /** Saves a finished run and returns what the score card needs to show. */
  recordRun(run) {
    const prevBest = this.bestFor(run.drill_id, { level: run.level, mode: run.mode });
    const rec = { ...run, id: Math.random().toString(36).slice(2), created: Date.now(), player_name: this.displayName() };
    data.runs.push(rec);
    if (data.runs.length > 3000) data.runs.splice(0, data.runs.length - 3000);
    const p = data.profile;
    p.totalRuns += 1;
    p.totalTime += run.time_seconds || 0;
    p.best[run.drill_id] = Math.max(p.best[run.drill_id] || 0, run.overall_score);
    const earned = coinsForRun(run.overall_score, run.level);
    p.coins = Math.round(p.coins + earned);
    save();
    return { prevBest, isNewBest: prevBest === null || run.overall_score > prevBest, best: Math.max(prevBest ?? 0, run.overall_score), earned };
  },
  // ---- rule school
  learnRule(id) { if (!data.rules[id]) { data.rules[id] = Date.now(); save(); return true; } return false; },
  knowsRule(id) { return !!data.rules[id]; },
  schoolFor(drillId) { return data.school[drillId] || null; },
  finishSchool(drillId, quiz) { const p = data.school[drillId]; data.school[drillId] = { done: true, quiz: Math.max(quiz, p?.quiz || 0) }; save(); },
  seeFact(id) { if (!data.facts.includes(id)) { data.facts.push(id); save(); } },
  resetAll() { localStorage.removeItem(KEY); location.reload(); },
};

// ---- Simulated rivals so the global board is never empty. Clearly labelled as SIM in the UI.
const RIVALS = ['SCALPEL', 'TROCAR', 'KESTREL', 'HALYARD', 'NIGHTJAR', 'OSPREY', 'TALON', 'LANCET', 'HEMOSTAT', 'SPARROW', 'ZENITH', 'CAUTERY', 'RAPTOR', 'BOLT', 'VECTOR', 'MERIDIAN'];
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
function hash(str) { let h = 2166136261; for (const c of str) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }
export function rivalsFor(drillId, level) {
  const r = rng(hash(drillId + level));
  const base = { BEGINNER: 52, INTERMEDIATE: 56, ADVANCED: 60, EXPERT: 64 }[level];
  const out = [];
  for (let i = 0; i < 12; i++) {
    const name = RIVALS[Math.floor(r() * RIVALS.length)] + '-' + (10 + Math.floor(r() * 89));
    const score = Math.round(Math.min(97, base + (r() - 0.25) * 36));
    out.push({ player_name: name, overall_score: score, time_seconds: 40 + r() * 140, sim: true, mode: 'COMPETITION', level, drill_id: drillId });
  }
  return out;
}
