// Overlays: leaderboard, mastery, cosmetics shop, profile, settings, coming soon, drill setup.
import { h, icon, modal, fmtTime, toast, coinBadge } from './dom.js';
import { store, LEVELS, TIERS, METAL_STYLE, tierForRuns, rivalsFor, ownedKey, COSMETIC_COST, UNLOCK_THRESHOLD, LEVEL_WEIGHTS } from '../store.js';
import { playSound, synth } from '../audio.js';
import { DRILLS } from '../game/drills/index.js';
import { ENV_THEMES, INSTRUMENT_THEMES } from '../game/themes.js';

const nice = (l) => l.charAt(0) + l.slice(1).toLowerCase();
function tabs(items, cur, onPick, cls = '') {
  const el = h('div', { class: 'tabs ' + cls });
  const draw = (c) => { el.innerHTML = ''; items.forEach(([id, label]) => el.append(h('button', { class: 'tab' + (id === c ? ' on' : ''), onclick: () => { playSound('swipe', { volume: 0.5 }); draw(id); onPick(id); } }, label))); };
  draw(cur); return el;
}
function tierBadge(t, sm = false) {
  const s = METAL_STYLE[t.metal];
  return h('div', { class: 'tier-badge' + (sm ? ' sm' : ''), style: { background: `linear-gradient(160deg, ${s.a}, ${s.b} 55%, ${s.c})`, boxShadow: `0 0 18px ${s.b}` } }, t.roman);
}

// ---------------------------------------------------------------- leaderboard
export function leaderboardPanel(initialDrill = 'pea-drop') {
  let scope = 'global', drill = DRILLS.some((d) => d.id === initialDrill && d.id !== 'suturing') ? initialDrill : 'pea-drop', level = 'BEGINNER';
  const m = modal({ title: 'Leaderboard', iconName: 'trophy', cls: 'lb' });
  const table = h('div');
  const draw = () => {
    const mine = store.data.runs.filter((r) => r.drill_id === drill && r.level === level && r.mode !== 'PRACTICE').map((r) => ({ ...r, me: true }));
    let rows = scope === 'global' ? [...rivalsFor(drill, level), ...mine] : mine;
    rows = rows.sort((a, b) => b.overall_score - a.overall_score).slice(0, 20);
    table.innerHTML = '';
    if (!rows.length) { table.append(h('div', { class: 'empty' }, scope === 'local' ? 'No competition runs yet — be the first!' : 'No scores yet — be the first!')); return; }
    table.append(h('table', {},
      h('thead', {}, h('tr', {}, h('th', {}, '#'), h('th', {}, 'PLAYER'), h('th', {}, 'SCORE'), h('th', {}, 'TIME'))),
      h('tbody', {}, rows.map((r, i) => h('tr', { class: r.me ? 'me' : '' },
        h('td', { class: 'rank' }, i < 3 ? h('span', { class: `medal g${i + 1}` }, i + 1) : i + 1),
        h('td', {}, r.player_name || store.displayName(), r.sim ? h('span', { class: 'sim' }, 'SIM') : null, r.me ? h('span', { class: 'chip', style: { marginLeft: '8px' } }, 'YOU') : null),
        h('td', { class: 'num' }, r.overall_score), h('td', { class: 'num' }, fmtTime(r.time_seconds)))))));
  };
  m.body.append(
    h('div', { class: 'lb-filters' },
      tabs([['global', 'Global'], ['local', 'Local']], scope, (v) => { scope = v; draw(); }),
      tabs(DRILLS.filter((d) => d.id !== 'suturing').map((d) => [d.id, d.name]), drill, (v) => { drill = v; draw(); }),
      tabs(LEVELS.map((l) => [l, nice(l)]), level, (v) => { level = v; draw(); })),
    table,
    h('div', { style: { fontSize: '11px', color: 'var(--ink-faint)', marginTop: '10px' } }, 'Competition runs only. SIM rows are simulated rivals; Local shows your own runs on this device.'));
  draw();
  return m;
}

// ---------------------------------------------------------------- mastery
export function masteryBody(drillId) {
  const runs = store.weightedRuns(drillId);
  const { tier, next, pct } = tierForRuns(runs);
  const s = METAL_STYLE[tier.metal];
  const raw = store.runsFor(drillId).length;
  return h('div', {},
    h('div', { class: 'ms-hero' }, tierBadge(tier),
      h('div', { class: 'info' },
        h('div', { class: 'tname', style: { color: s.a, textShadow: `0 0 18px ${s.b}` } }, tier.name),
        h('div', { style: { color: 'var(--ink-dim)', fontSize: '14px' } }, `${runs} weighted reps · ${raw} runs completed`),
        h('div', { class: 'ms-prog' }, h('div', { style: { width: pct * 100 + '%', background: `linear-gradient(90deg, ${s.c}, ${s.b}, ${s.a})` } })),
        h('div', { style: { color: 'var(--ink-faint)', fontSize: '12px' } }, next ? `${next.runs - runs} more to ${next.name}` : 'Maximum tier reached'))),
    h('div', { class: 'ms-grid' }, TIERS.map((t) => h('div', { class: 'ms-cell' + (runs >= t.runs ? '' : ' locked') + (t === tier ? ' cur' : '') }, tierBadge(t, true), h('div', { class: 'n' }, t.name), h('div', { class: 'r' }, `${t.runs} reps`)))),
    h('div', { style: { fontSize: '12px', color: 'var(--ink-faint)', marginTop: '12px' } }, `Reps are weighted by level: ${LEVELS.map((l) => `${nice(l)} ×${LEVEL_WEIGHTS[l]}`).join(' · ')}`));
}
export function masteryPanel(drillId, withTabs = false) {
  const m = modal({ title: 'Mastery', iconName: 'medal', cls: 'ms' });
  const host = h('div');
  const show = (id) => { host.innerHTML = ''; host.append(masteryBody(id)); };
  if (withTabs) m.body.append(h('div', { style: { marginBottom: '14px' } }, tabs(DRILLS.map((d) => [d.id, d.name]), drillId, show)));
  m.body.append(host); show(drillId);
  return m;
}

// ---------------------------------------------------------------- cosmetics
export function cosmeticsPanel(drillId, withTabs = false) {
  const cb = coinBadge(); cb.set(store.coins);
  const m = modal({ title: 'Cosmetics', iconName: 'shirt', cls: 'cs', headExtra: cb.el });
  const host = h('div');
  let cur = drillId;
  const show = (id) => {
    cur = id; host.innerHTML = '';
    const envs = ENV_THEMES[id], insts = INSTRUMENT_THEMES[id];
    const name = DRILLS.find((d) => d.id === id).name;
    if (!envs && !insts) { host.append(comingSoonBody(name)); return; }
    let kind = 'env';
    const grid = h('div', { class: 'cs-grid' }); const msg = h('div', { class: 'cs-msg' });
    const draw = async () => {
      grid.innerHTML = '';
      const { envSnapshot, instSnapshot } = await import('../game/preview.js');
      const list = kind === 'env' ? envs || [] : insts || [];
      if (!list.length) { grid.append(h('div', { style: { gridColumn: '1/-1' } }, comingSoonBody(name, true))); return; }
      const sel = store.getSelection(id);
      for (const t of list) {
        const key = ownedKey(id, kind, t.id), owned = store.isOwned(key), eq = (kind === 'env' ? sel.env : sel.instrument) === t.id;
        const img = h('div', { class: 'img' }, h('div', { class: 'spin' }));
        const card = h('button', { class: 'cs-card' + (eq ? ' eq' : '') }, img,
          !owned ? h('div', { class: 'lock' }, icon('lock'), h('span', { class: 'coin', style: { width: '16px', height: '16px', fontSize: '9px' } }, 'S'), COSMETIC_COST.toLocaleString()) : null,
          h('div', { class: 'meta' }, h('span', { class: 'dot', style: { background: t.accent } }), h('span', { class: 'nm' }, t.name), h('span', { class: 'state' }, eq ? 'Equipped' : owned ? 'Owned' : 'Locked')));
        const lockSvg = card.querySelector('.lock svg'); if (lockSvg) lockSvg.style.cssText = 'width:13px;height:13px';
        card.onclick = () => {
          if (owned) { store.setSelection(id, kind === 'env' ? { env: t.id } : { instrument: t.id }); playSound('swipe'); msg.textContent = ''; draw(); return; }
          const r = store.purchase(key, COSMETIC_COST);
          if (r.ok) { store.setSelection(id, kind === 'env' ? { env: t.id } : { instrument: t.id }); playSound('startDrill'); synth('coin'); msg.style.color = 'var(--green)'; msg.textContent = `Unlocked ${t.name}!`; cb.set(store.coins); draw(); }
          else { playSound('error'); msg.style.color = 'var(--red)'; msg.textContent = r.reason === 'insufficient' ? `Not enough coins — you need ${(COSMETIC_COST - store.coins).toLocaleString()} more` : 'Purchase failed'; }
        };
        grid.append(card);
        (kind === 'env' ? envSnapshot(id, t.id) : instSnapshot(id, t.id)).then((url) => { img.innerHTML = ''; if (url) img.append(h('img', { src: url, alt: t.name })); });
      }
    };
    host.append(
      h('div', { style: { display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '12px' } }, tabs([['env', 'Environment'], ['inst', 'Instruments']], 'env', (v) => { kind = v === 'env' ? 'env' : 'instrument'; msg.textContent = ''; draw(); })),
      grid, msg, h('div', { class: 'cs-foot' }, `Selections apply automatically when you play ${name}. Earn coins by finishing runs — higher levels pay more.`));
    draw();
  };
  if (withTabs) m.body.append(h('div', { style: { marginBottom: '14px' } }, tabs(DRILLS.map((d) => [d.id, d.name]), drillId, show)));
  m.body.append(host); show(drillId);
  return m;
}
function comingSoonBody(name, inline = false) {
  return h('div', { style: { textAlign: 'center', padding: inline ? '20px 0' : '30px 0' } },
    h('div', { style: { width: '64px', height: '64px', borderRadius: '50%', margin: '0 auto 12px', display: 'grid', placeItems: 'center', background: 'rgba(255,127,39,.15)', border: '1px solid var(--or)', color: 'var(--or)' } }, icon('shirt')),
    h('div', { style: { fontFamily: 'var(--f-disp)', fontWeight: 800, letterSpacing: '.24em', color: 'var(--or)', fontSize: '18px' } }, 'COMING SOON'),
    h('div', { style: { color: 'var(--ink-dim)', marginTop: '6px' } }, `Skins for ${name} are in the hangar. Check back after the next update.`));
}

// ---------------------------------------------------------------- profile
export function profilePanel() {
  const m = modal({ title: 'Profile', iconName: 'user', cls: 'pf' });
  const draw = () => {
    m.body.innerHTML = '';
    const p = store.profile;
    const nameIn = h('input', { value: p.callsign, maxlength: 16, placeholder: 'CALLSIGN', 'aria-label': 'Callsign' });
    nameIn.addEventListener('change', () => { store.setProfile({ callsign: nameIn.value.trim().toUpperCase().slice(0, 16) }); draw(); });
    const handBtns = h('div', { class: 'dm-row' }, ['RIGHT', 'LEFT'].map((hd) => h('button', { class: 'opt' + (p.hand === hd ? ' on' : ''), onclick: () => { store.setProfile({ hand: hd }); playSound('swipe', { volume: 0.5 }); draw(); } }, hd)));
    let drill = 'pea-drop';
    const drillHost = h('div');
    const showDrill = (id) => {
      drill = id; drillHost.innerHTML = '';
      const runs = store.runsFor(id); const w = store.weightedRuns(id); const { tier } = tierForRuns(w);
      const best = Math.max(store.bestFor(id) ?? 0, p.best[id] ?? 0);
      const byLevel = Object.fromEntries(LEVELS.map((l) => [l, runs.filter((r) => r.level === l).length]));
      // rank: best competition score vs. global board for that level
      let rank = null;
      for (const l of LEVELS) {
        const b = store.bestFor(id, { level: l, mode: 'COMPETITION' }); if (b === null) continue;
        const better = rivalsFor(id, l).filter((r) => r.overall_score > b).length + 1;
        if (!rank || better < rank.n) rank = { n: better, l };
      }
      drillHost.append(
        h('div', { style: { display: 'flex', gap: '14px', alignItems: 'center', margin: '12px 0' } }, tierBadge(tier, true), h('div', {}, h('div', { style: { fontFamily: 'var(--f-disp)', fontWeight: 800, fontSize: '18px' } }, tier.name), h('div', { class: 'pf-sub' }, `${runs.length} runs · ${w} weighted`))),
        h('div', { class: 'stat-grid' },
          h('div', { class: 'stat' }, h('div', { class: 'k' }, 'Best score'), h('div', { class: 'v' }, String(best), h('small', {}, '/100'))),
          h('div', { class: 'stat' }, h('div', { class: 'k' }, 'Leaderboard'), h('div', { class: 'v', style: { fontSize: rank ? '22px' : '13px' } }, rank ? `#${rank.n}` : 'No competition scores'), rank ? h('div', { class: 'pf-sub' }, nice(rank.l)) : null),
          ...LEVELS.slice(0, 2).map((l) => h('div', { class: 'stat' }, h('div', { class: 'k' }, nice(l)), h('div', { class: 'v' }, byLevel[l])))),
        h('div', { class: 'stat-grid', style: { marginTop: '8px' } }, ...LEVELS.slice(2).map((l) => h('div', { class: 'stat' }, h('div', { class: 'k' }, nice(l)), h('div', { class: 'v' }, byLevel[l])))));
    };
    m.body.append(
      h('div', { class: 'pf-head' }, h('div', { class: 'avatar' }, (p.callsign || 'S')[0]),
        h('div', { style: { flex: 1 } }, h('div', { class: 'pf-name' }, store.displayName()), h('div', { class: 'pf-sub' }, `Joined ${new Date(p.created).toLocaleDateString()} · progress saved on this device`))),
      h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' } },
        h('label', { class: 'field' }, h('span', { class: 'dm-sec' }, h('div', { class: 'lbl' }, 'CALLSIGN')), nameIn),
        h('div', { class: 'field' }, h('div', { class: 'dm-sec' }, h('div', { class: 'lbl' }, 'DOMINANT HAND')), handBtns)),
      h('div', { class: 'stat-grid' },
        h('div', { class: 'stat' }, h('div', { class: 'k' }, 'Total runs'), h('div', { class: 'v' }, p.totalRuns)),
        h('div', { class: 'stat' }, h('div', { class: 'k' }, 'Time played'), h('div', { class: 'v' }, fmtTime(p.totalTime))),
        h('div', { class: 'stat' }, h('div', { class: 'k' }, 'Coins'), h('div', { class: 'v', style: { color: 'var(--gold)' } }, store.coins.toLocaleString())),
        h('div', { class: 'stat' }, h('div', { class: 'k' }, 'Cosmetics'), h('div', { class: 'v' }, p.owned.length))),
      h('div', { style: { marginTop: '16px' } }, tabs(DRILLS.map((d) => [d.id, d.name]), drill, showDrill)),
      drillHost,
      h('div', { style: { display: 'flex', justifyContent: 'space-between', marginTop: '16px', gap: '10px' } },
        h('button', { class: 'btn', style: { fontSize: '11px', padding: '10px 14px', opacity: 0.7 }, onclick: () => { if (confirm('Erase all progress, coins and cosmetics on this device?')) store.resetAll(); } }, 'Reset progress'),
        h('button', { class: 'btn primary', onclick: () => m.close() }, 'Done')));
    showDrill(drill);
  };
  draw();
  return m;
}

// ---------------------------------------------------------------- settings
function switchEl(on, onToggle, disabled = false) {
  const s = h('button', { class: 'switch' + (on ? ' on' : ''), role: 'switch', 'aria-checked': String(on), disabled });
  s.onclick = () => { const v = !s.classList.contains('on'); s.classList.toggle('on', v); s.setAttribute('aria-checked', String(v)); onToggle(v); };
  return s;
}
function audioRows() {
  return [
    h('div', { class: 'row' }, h('div', { class: 'lbl' }, 'Sound effects'), switchEl(store.settings.sfx, (v) => store.setSetting('sfx', v))),
    h('div', { class: 'row' }, h('div', { class: 'lbl' }, 'Tap to grip', h('small', {}, 'Touch GRAB: tap once to grab, again to let go')), switchEl((store.settings.gripMode || 'tap') === 'tap', (v) => store.setSetting('gripMode', v ? 'tap' : 'hold'))),
    h('div', { class: 'row' }, h('div', { class: 'lbl' }, 'Scout reads aloud'), switchEl(!!store.settings.voice, (v) => store.setSetting('voice', v))),
    h('div', { class: 'row' }, h('div', { class: 'lbl' }, 'Music & ambience'), switchEl(store.settings.music, (v) => store.setSetting('music', v))),
  ];
}
export function audioPanel() {
  const m = modal({ title: 'Audio', iconName: 'vol', cls: 'set' });
  m.body.append(...audioRows());
  return m;
}
export function settingsPanel({ single = true, lockHand = false, onChange, onClose } = {}) {
  const m = modal({ title: 'Settings', iconName: 'sliders', cls: 'set', onClose });
  const slider = (key, label) => {
    const val = h('span', { class: 'rng-val' }, store.settings.sens[key].toFixed(1) + '×');
    const r = h('input', { type: 'range', class: 'rng', min: 0.3, max: 2.5, step: 0.1, value: store.settings.sens[key] });
    r.oninput = () => { store.setSens(key, +r.value); val.textContent = (+r.value).toFixed(1) + '×'; };
    return h('div', { class: 'row' }, h('div', { class: 'lbl' }, label), r, val);
  };
  m.body.append(
    h('div', { class: 'dm-sec' }, h('div', { class: 'lbl' }, 'SENSITIVITY')),
    slider('move', 'Movement'), slider('depth', 'Depth'), slider('rot', 'Rotation'), slider('jaw', 'Jaw'),
    h('div', { class: 'dm-sec', style: { marginTop: '14px' } }, h('div', { class: 'lbl' }, 'CONTROLS')),
    h('div', { class: 'row' }, h('div', { class: 'lbl' }, 'Left-hand layout', h('small', {}, lockHand ? 'Locked in competition' : 'Swaps key sets and mirrors touch controls')), switchEl(store.settings.leftHand, (v) => { store.setSetting('leftHand', v); onChange?.('leftHand'); }, lockHand)),
    h('div', { class: 'row' }, h('div', { class: 'lbl' }, 'Scope lens effects', h('small', {}, 'Glow, lens distortion, grain. Turn off on slower phones — applies to the next drill')), switchEl(store.settings.quality !== 'low', (v) => store.setSetting('quality', v ? 'high' : 'low'))),
    h('div', { class: 'dm-sec', style: { marginTop: '14px' } }, h('div', { class: 'lbl' }, 'AUDIO')),
    ...audioRows(),
    h('div', { style: { display: 'flex', justifyContent: 'flex-end', marginTop: '14px' } }, h('button', { class: 'btn primary', onclick: () => m.close() }, 'Resume')));
  return m;
}

// ---------------------------------------------------------------- drill setup
export function drillSetupModal(def, onStart) {
  const unlocked = store.unlockedLevels(def.id);
  const dom = store.profile.hand || 'RIGHT';
  let level = null, mode = null, hand = def.usesHand ? null : dom;
  const m = modal({ title: def.name, iconName: 'play', cls: 'dm' });
  const lvRow = h('div', { class: 'dm-row' }), modeRow = h('div', { class: 'dm-row' }), handRow = h('div', { class: 'dm-row' });
  const start = h('button', { class: 'btn primary', style: { minWidth: '180px' }, onclick: () => { playSound('startDrill'); m.root.remove(); onStart({ level, mode, hand: hand || dom }); } }, icon('play'), 'Start');
  const draw = () => {
    lvRow.innerHTML = ''; modeRow.innerHTML = ''; handRow.innerHTML = '';
    for (const l of LEVELS) {
      const best = store.bestFor(def.id, { level: l });
      lvRow.append(h('button', { class: 'opt' + (level === l ? ' on' : ''), disabled: !unlocked[l], title: best !== null ? `Best ${best}` : '', onclick: () => { level = l; playSound('swipe', { volume: 0.5 }); draw(); } }, !unlocked[l] ? icon('lock') : null, l));
    }
    for (const md of ['PRACTICE', 'COMPETITION']) modeRow.append(h('button', { class: 'opt' + (mode === md ? ' on' : ''), onclick: () => { mode = md; if (md === 'COMPETITION' && def.usesHand) hand = dom; playSound('swipe', { volume: 0.5 }); draw(); } }, md));
    for (const hd of ['RIGHT', 'LEFT']) handRow.append(h('button', { class: 'opt' + (hand === hd ? ' on' : ''), disabled: mode === 'COMPETITION' && hd !== dom, onclick: () => { hand = hd; playSound('swipe', { volume: 0.5 }); draw(); } }, hd));
    start.disabled = !(level && mode && hand);
  };
  m.body.append(
    h('div', { class: 'dm-sec' }, h('div', { class: 'lbl' }, 'LEVEL'), lvRow, h('div', { class: 'dm-hint' }, 'Finish a level (1 star) to unlock the next')),
    h('div', { class: 'dm-sec' }, h('div', { class: 'lbl' }, 'MODE'), modeRow, h('div', { class: 'dm-hint' }, 'Competition runs go on the leaderboard and use your dominant hand.')),
    def.usesHand ? h('div', { class: 'dm-sec' }, h('div', { class: 'lbl' }, 'HAND'), handRow) : null,
    h('div', { class: 'dm-foot' },
      h('button', { class: 'icon-btn', title: 'Leaderboard', onclick: () => leaderboardPanel(def.id) }, icon('trophy')),
      h('button', { class: 'icon-btn', title: 'Close', onclick: () => m.close() }, icon('home')),
      h('button', { class: 'icon-btn', title: 'Audio', onclick: () => audioPanel() }, icon('gear')),
      h('span', { class: 'sp' }), start));
  draw();
  return m;
}

// ---------------------------------------------------------------- first-run callsign
export function callsignPrompt(onDone) {
  const m = modal({ title: 'Welcome, Surgeon', iconName: 'plane', cls: 'dm', onClose: onDone });
  let hand = store.profile.hand || 'RIGHT';
  const input = h('input', { maxlength: 16, placeholder: 'CALLSIGN', 'aria-label': 'Callsign' });
  const hands = h('div', { class: 'dm-row' });
  const drawH = () => { hands.innerHTML = ''; ['RIGHT', 'LEFT'].forEach((hd) => hands.append(h('button', { class: 'opt' + (hand === hd ? ' on' : ''), onclick: () => { hand = hd; drawH(); } }, hd))); };
  drawH();
  const go = () => { store.setProfile({ callsign: (input.value.trim() || 'ROOKIE').toUpperCase().slice(0, 16), hand }); playSound('startDrill'); m.close(); };
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); e.stopPropagation(); });
  m.body.append(
    h('p', { style: { margin: '0 0 6px', color: 'var(--ink-dim)', fontSize: '15px' } }, 'Pick a callsign for the leaderboards. Your progress, coins and cosmetics are saved on this device.'),
    h('label', { class: 'field' }, h('div', { class: 'dm-sec' }, h('div', { class: 'lbl' }, 'CALLSIGN')), input),
    h('div', { class: 'dm-sec' }, h('div', { class: 'lbl' }, 'DOMINANT HAND'), hands),
    h('div', { style: { display: 'flex', justifyContent: 'flex-end' } }, h('button', { class: 'btn primary', onclick: go }, 'Enlist')));
  setTimeout(() => input.focus(), 50);
}
