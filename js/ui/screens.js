// App shell (top bar + tab bar + animated pages) and the five main pages.
import { h, icon, fmtTime, toast } from './dom.js';
import { btn, segmented, chips, toggle, bar, pip, rankBadge, sheet, wallet } from './kit.js';
import { coinFly, celebrate } from './rewards.js';
import { store, LEVELS, ownedKey, COSMETIC_COST, tierForRuns, TIERS, METAL_STYLE } from '../store.js';
import { playSound, wantAmbient, haptic, synth } from '../audio.js';
import { music } from '../music.js';
import { rankFor, totalXp, drillLadder, medalCount, nextGoal, lastPlayed, DRILL_IDS, DRILL_NAMES, nice, medalFor, starsFor, STAR_MEDAL, starTotal } from '../progress.js';
import { RULES } from '../rules.js';
import { scout, openRuleBook, factCard } from './buddy.js';
import { mapPage, albumPage, dailyCard, trackCard, openBase } from './album.js';
import { currentNode, VARIANTS } from '../campaign.js';

/** Rule school: a guided Beginner lesson that teaches the drill's rules by doing them. */
export function school(drillId) {
  const bo = document.querySelector('.blackout'); bo?.classList.add('on'); playSound('startDrill'); haptic([10, 30, 20]);
  setTimeout(() => { location.hash = `#/game/${drillId}?level=BEGINNER&mode=SCHOOL&hand=${store.profile.hand || 'RIGHT'}`; setTimeout(() => bo?.classList.remove('on'), 80); }, 550);
}
import { DRILLS, drillById, modifiersFor } from '../game/drills/index.js';
import { ENV_THEMES, INSTRUMENT_THEMES } from '../game/themes.js';

const TABS = [
  { id: 'home', label: 'Home', icon: 'home' },
  { id: 'map', label: 'Map', icon: 'map' },
  { id: 'drills', label: 'Drills', icon: 'play' },
  { id: 'album', label: 'Album', icon: 'album' },
  { id: 'ranks', label: 'Ranks', icon: 'trophy' },
  { id: 'profile', label: 'Profile', icon: 'user' },
];
const PAGES = { home: homePage, map: (el, ctx) => mapPage(el, { ...ctx, fly, school }), drills: drillsPage, album: albumPage, ranks: ranksPage, hangar: hangarPage, profile: profilePage };

/** Start a sortie: fade to black, then the game route. */
export function fly(drillId, level, mode = 'PRACTICE', hand = store.profile.hand || 'RIGHT', variant = null) {
  playSound('startDrill'); haptic([10, 30, 20]);
  try { sessionStorage.setItem('lastDrillId', drillId); } catch { /* ignore */ }
  const bo = document.querySelector('.blackout'); bo?.classList.add('on');
  setTimeout(() => { location.hash = `#/game/${drillId}?level=${level}&mode=${mode}&hand=${hand}${variant ? `&v=${variant}` : ''}`; setTimeout(() => bo?.classList.remove('on'), 80); }, 550);
}

// ======================================================================= shell
export function mountShell(el, tab, params) {
  wantAmbient(true); music.start('menu');
  const main = h('main', { class: 'shell-main' });
  const w = wallet();
  const chipName = h('div', { class: 'nm' }), chipSub = h('div', { class: 'sub' });
  const badgeHost = h('span');
  const player = h('button', { class: 'player-chip', onclick: () => go('profile') }, badgeHost, h('div', {}, chipName, chipSub));
  const tabs = TABS.map((t) => h('button', { class: 'tab2', 'data-tab': t.id, onclick: () => { if (cur !== t.id) { haptic(6); playSound('swipe', { volume: 0.4 }); go(t.id); } } }, icon(t.icon), t.label));
  const shell = h('div', { class: 'shell' },
    h('div', { class: 'shell-bg' }, h('video', { class: 'bg-video', src: 'assets/clouds.mp4', autoplay: true, muted: true, loop: true, playsinline: true })),
    h('header', { class: 'topbar' }, player, h('span', { class: 'sp' }), w.el),
    main,
    h('nav', { class: 'tabbar' }, tabs));
  el.append(shell);
  shell.querySelector('video').muted = true;
  const refreshTop = () => {
    const r = rankFor(totalXp());
    chipName.textContent = store.displayName(); chipSub.textContent = `Rank ${r.level} · ${r.title}`;
    badgeHost.innerHTML = ''; badgeHost.append(rankBadge());
    w.set(store.coins);
  };
  refreshTop();
  const onStore = () => refreshTop();
  window.addEventListener('store-change', onStore);

  let cur = null, curDispose = null, curPage = null;
  function show(id, p = {}) {
    const ti = (x) => TABS.findIndex((t) => t.id === (x === 'hangar' ? 'album' : x));
    const order = ti(id) - ti(cur);
    tabs.forEach((b) => b.classList.toggle('on', b.dataset.tab === (id === 'hangar' ? 'album' : id)));
    if (curPage) { const old = curPage; old.classList.add('leave'); setTimeout(() => old.remove(), 220); try { curDispose?.(); } catch (e) { console.error(e); } }
    const page = h('section', { class: 'page ' + (cur === null ? 'enter-r' : order >= 0 ? 'enter-r' : 'enter-l') });
    main.append(page);
    cur = id; curPage = page;
    curDispose = PAGES[id](page, { go, wallet: w, params: p }) || null;
  }
  function go(id, p) { const qs = p ? '?' + new URLSearchParams(p) : ''; if (location.hash !== `#/${id}${qs}`) location.hash = `#/${id}${qs}`; else show(id, p); }
  show(tab, params);
  if (!store.profile.callsign) setTimeout(() => firstRun(refreshTop), 700);
  return {
    shell, show,
    is: (t) => !!PAGES[t],
    dispose() { window.removeEventListener('store-change', onStore); try { curDispose?.(); } catch { /* ignore */ } },
  };
}

function firstRun(done) {
  let hand = 'RIGHT';
  const s = sheet('Welcome, cadet', { dismissable: false });
  const input = h('input', { class: 'name-in', maxlength: 16, placeholder: 'YOUR CALLSIGN', 'aria-label': 'Callsign' });
  const hands = segmented([{ value: 'RIGHT', label: 'Right-handed' }, { value: 'LEFT', label: 'Left-handed' }], hand, (v) => (hand = v), { block: true });
  const go = () => { store.setProfile({ callsign: (input.value.trim() || 'ROOKIE').toUpperCase().slice(0, 16), hand }); s.close(); done?.(); };
  input.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') go(); });
  s.body.append(
    h('p', { class: 't-dim', style: { margin: '0 0 14px', fontSize: '16px' } }, 'Flight school for surgeons. Pick a callsign — it goes on your rank badge and the boards.'),
    h('div', { class: 'field', style: { marginBottom: '14px' } }, input),
    h('div', { class: 't-over', style: { marginBottom: '8px' } }, 'Dominant hand'), hands.el,
    h('div', { style: { marginTop: '18px' } }, btn('Enlist', { kind: 'primary', size: 'lg', block: true, onClick: go })));
  setTimeout(() => input.focus(), 350);
}

// ======================================================================= Home
function homePage(el, { go }) {
  const node = currentNode();
  const g = { drillId: node.drill, level: node.level, variant: node.variant };
  const def = drillById(g.drillId);
  const r = rankFor(totalXp());
  const ladder = drillLadder(g.drillId).find((x) => x.level === g.level);
  const runs = store.data.runs.length;
  const stars = starTotal();
  const needSchool = RULES[g.drillId] && !store.schoolFor(g.drillId);
  const art = h('div', { class: 'art', style: { backgroundImage: `url(${def.thumb})` } });
  liveArt(g.drillId, art);
  const hero = h('div', { class: 'card hero' },
    art,
    h('img', { class: 'logo-hero', src: 'assets/img/logo.png', alt: 'Top Gun Surgeon' }),
    h('div', { class: 't-over', style: { color: 'var(--brand-hi)' } }, runs ? `Next base · ${node.n} of 20` : 'First flight'),
    h('div', { class: 't-display name' }, g.variant ? `${VARIANTS[g.variant].short}: ${def.name}` : def.name),
    h('div', { class: 'meta' }, h('span', { class: 'chip' }, nice(g.level)), pip(STAR_MEDAL[node.stars]), h('span', {}, modifiersFor(g.drillId, g.level).join(' · '))),
    h('div', { style: { display: 'flex', gap: '10px', flexWrap: 'wrap' } },
      needSchool ? btn('Rule school', { kind: 'primary', size: 'xl', iconName: 'flag', sound: null, onClick: () => school(g.drillId) }) : btn('Fly', { kind: 'primary', size: 'xl', iconName: 'plane', sound: null, onClick: () => openBase(node, { fly, school }) }),
      needSchool ? btn('Skip to drill', { kind: 'glass', size: 'lg', onClick: () => fly(g.drillId, g.level) }) : btn('Map', { kind: 'glass', size: 'lg', iconName: 'map', onClick: () => go('map') })),
    needSchool ? h('div', { class: 'hero-buddy' }, scout('happy', { size: 58 }), h('span', {}, `Learn the rules of ${def.name} with me first!`)) : null);
  const side = h('div', { class: 'side' },
    h('div', { class: 'card glass card-pad pcard press', onclick: () => go('profile') }, rankBadge({ lg: true }),
      h('div', { class: 'grow' }, h('div', { class: 't-over' }, `Rank ${r.level} · ${r.title}`), h('div', { class: 'nm' }, store.displayName()),
        h('div', { style: { marginTop: '8px' } }, bar(r.pct)), h('div', { class: 't-faint t-num', style: { fontSize: '12px', marginTop: '4px' } }, `${r.into} / ${r.need} XP to rank ${r.level + 1}`))),
    dailyCard({ fly }),
    trackCard(),
    h('div', { class: 'quick' },
      h('div', { class: 'q' }, h('div', { class: 't-over' }, 'Sorties'), h('div', { class: 'v' }, runs)),
      h('div', { class: 'q' }, h('div', { class: 't-over' }, 'Stars'), h('div', { class: 'v' }, `${stars}/48`)),
      h('div', { class: 'q' }, h('div', { class: 't-over' }, 'Flight time'), h('div', { class: 'v' }, fmtTime(store.profile.totalTime)))),
    h('button', { class: 'card glass card-pad rb-open press', onclick: () => openRuleBook(g.drillId, { onSchool: school }) }, h('span', { class: 'rb-ic' }, icon('flag')),
      h('div', { class: 'grow' }, h('div', { class: 't-over' }, 'Rule book'), h('div', { class: 't-dim' }, `${Object.keys(store.data.rules || {}).length} of ${Object.values(RULES).flat().length} rule cards collected`)), icon('right')),
    factCard());
  el.append(h('div', { class: 'home' }, hero, side));
}

// ======================================================================= Drills
function drillsPage(el, { go, params }) {
  let idx = Math.max(0, DRILLS.findIndex((d) => d.id === (params?.drill || lastPlayed().drillId)));
  let level = null, mode = 'PRACTICE', hand = store.profile.hand || 'RIGHT', turntable = null, disposed = false;
  const canvasHost = h('div', { class: 'ds-canvas' });
  const nameEl = h('div', { class: 't-display name' }), descEl = h('div', { class: 'desc' });
  const setup = h('div', { class: 'card setup' });
  const cards = h('div', { class: 'dcards' });
  const stage = h('div', { class: 'stage' }, h('div', { class: 'ds-grid' }), canvasHost, h('div', { class: 'st-title' }, h('div', { class: 't-over' }, 'Drill'), nameEl, descEl),
    h('div', { class: 'nav l' }, btn('', { kind: 'glass', iconName: 'left', title: 'Previous drill', onClick: () => pick(idx - 1) })),
    h('div', { class: 'nav r' }, btn('', { kind: 'glass', iconName: 'right', title: 'Next drill', onClick: () => pick(idx + 1) })));
  el.style.overflow = 'hidden';
  el.append(h('div', { class: 'drills' }, stage, setup, cards));
  let sx = null;
  canvasHost.addEventListener('pointerdown', (e) => { sx = e.clientX; });
  canvasHost.addEventListener('pointerup', (e) => { if (sx !== null && Math.abs(e.clientX - sx) > 50) pick(idx + (e.clientX < sx ? 1 : -1)); sx = null; });

  function pick(i) { idx = (i + DRILLS.length) % DRILLS.length; level = null; draw(); }
  function draw() {
    const d = DRILLS[idx];
    nameEl.textContent = d.name; descEl.textContent = d.desc;
    turntable?.show(d.id);
    const ladder = drillLadder(d.id);
    if (!level || !ladder.find((x) => x.level === level)?.unlocked) level = [...ladder].reverse().find((x) => x.unlocked)?.level || 'BEGINNER';
    if (d.sandbox) level = 'BEGINNER';
    setup.innerHTML = '';
    const ladderEl = h('div', { class: 'ladder' }, ladder.map((r) => h('button', { class: 'lrow' + (r.level === level ? ' on' : ''), disabled: !r.unlocked || (d.sandbox && r.level !== 'BEGINNER'), onclick: () => { haptic(6); playSound('swipe', { volume: 0.4 }); level = r.level; draw(); } },
      pip(r.medal, { locked: !r.unlocked }),
      h('div', {}, h('div', { class: 'lv' }, nice(r.level)), h('div', { class: 'req' }, r.unlocked ? modifiersFor(d.id, r.level).join(' · ') : r.requirement)),
      h('span', { class: 'best' }, r.best !== null ? r.best : '—'))));
    const sc = RULES[d.id] ? store.schoolFor(d.id) : null;
    const schoolEl = RULES[d.id] ? (sc?.done
      ? null
      : h('div', { class: 'school-banner' }, scout('happy', { size: 50 }), h('div', { class: 'grow' }, h('b', {}, 'New here?'), h('span', {}, ` Learn the ${RULES[d.id].length} rules with Scout.`)),
        btn('Rule school', { kind: 'primary', size: 'sm', iconName: 'flag', onClick: () => school(d.id) }))) : null;
    const modeSeg = segmented([{ value: 'PRACTICE', label: 'Practice' }, { value: 'COMPETITION', label: 'Compete' }], mode, (v) => { mode = v; if (v === 'COMPETITION') hand = store.profile.hand; draw(); }, { block: true });
    const handSeg = d.usesHand ? segmented([{ value: 'RIGHT', label: 'Right' }, { value: 'LEFT', label: 'Left' }].map((o) => ({ ...o, disabled: mode === 'COMPETITION' && o.value !== store.profile.hand })), hand, (v) => (hand = v), { block: true }) : null;
    const pair = (label, el) => h('div', { style: { flex: 1, minWidth: 0 } }, h('div', { class: 't-over', style: { marginBottom: '6px' } }, label), el);
    setup.append(...[
      schoolEl,
      h('div', { class: 't-over' }, d.sandbox ? 'Sandbox' : 'Level'), d.sandbox ? h('div', { class: 't-dim' }, 'Free practice — no score, no clock pressure.') : ladderEl,
      d.sandbox ? null : h('div', { class: 'opt-row' }, pair('Mode', modeSeg.el), handSeg ? pair('Hand', handSeg.el) : null),
      mode === 'COMPETITION' && !d.sandbox ? h('div', { class: 't-faint', style: { fontSize: '12px' } }, 'Competition goes on the leaderboard and uses your dominant hand.') : null,
      h('div', { class: 'fly-dock' },
        btn('Fly', { kind: 'primary', size: 'xl', block: true, iconName: 'plane', sound: null, onClick: () => fly(d.id, level, d.sandbox ? 'PRACTICE' : mode, hand) }),
        d.sandbox ? null : h('div', { class: 'links' }, btn('Rules', { kind: 'ghost', size: 'sm', iconName: 'flag', onClick: () => openRuleBook(d.id, { onSchool: school }) }), btn('Board', { kind: 'ghost', size: 'sm', iconName: 'trophy', onClick: () => go('ranks', { drill: d.id }) }), btn('Mastery', { kind: 'ghost', size: 'sm', iconName: 'medal', onClick: () => go('ranks', { drill: d.id, view: 'mastery' }) }), btn('Skins', { kind: 'ghost', size: 'sm', iconName: 'shirt', onClick: () => go('hangar', { drill: d.id }) }))),
    ].filter(Boolean));
    cards.innerHTML = '';
    DRILLS.forEach((x, i) => {
      const lad = drillLadder(x.id);
      cards.append(h('button', { class: 'dcard' + (i === idx ? ' on' : ''), onclick: () => { haptic(6); playSound('swipe', { volume: 0.4 }); pick(i); } },
        liveArt(x.id, h('div', { class: 'im', style: { backgroundImage: `url(${x.thumb})` } })),
        h('div', { class: 'ft' }, h('span', { class: 'n' }, x.name), ...(x.sandbox ? [] : lad.map((r) => pip(r.medal, { locked: !r.unlocked }))))));
    });
    cards.children[idx]?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  }
  const onKey = (e) => { if (document.querySelector('.sheet-wrap, .overlay')) return; if (e.key === 'ArrowLeft') pick(idx - 1); else if (e.key === 'ArrowRight') pick(idx + 1); else if (e.key === 'Enter') setup.querySelector('.b.primary')?.click(); };
  window.addEventListener('keydown', onKey);
  draw();
  import('../game/preview.js').then((pm) => { if (disposed) return; turntable = new pm.Turntable(canvasHost); turntable.show(DRILLS[idx].id); });
  return () => { disposed = true; window.removeEventListener('keydown', onKey); turntable?.dispose(); };
}

// ======================================================================= Ranks
function ranksPage(el, { params }) {
  let view = params?.view || 'board', drill = params?.drill && params.drill !== 'suturing' ? params.drill : 'pea-drop', level = 'BEGINNER';
  const body = h('div');
  const head = h('div', { class: 'pg-head' }, h('h1', { class: 't-display' }, 'Ranks'), segmented([{ value: 'board', label: 'Leaderboard' }, { value: 'mastery', label: 'Mastery' }], view, (v) => { view = v; draw(); }).el);
  el.append(h('div', { style: { maxWidth: '1100px', margin: '0 auto' } }, head, body));
  function draw() {
    body.innerHTML = '';
    const drillChips = chips(DRILL_IDS.filter((d) => view === 'mastery' || d !== 'suturing').map((d) => ({ value: d, label: DRILL_NAMES[d] })), drill, (v) => { drill = v; draw(); });
    body.append(drillChips.el, h('div', { style: { height: '10px' } }));
    if (view === 'mastery') { body.append(masteryCard(drill)); return; }
    body.append(segmented(LEVELS.map((l) => ({ value: l, label: nice(l) })), level, (v) => { level = v; draw(); }).el, h('div', { style: { height: '12px' } }));
    const runs = store.data.runs.filter((r) => r.drill_id === drill && r.level === level && r.mode === 'COMPETITION').sort((a, b) => b.overall_score - a.overall_score);
    const list = h('div', { class: 'lb-list' });
    if (!runs.length) {
      list.append(h('div', { class: 'card card-pad', style: { textAlign: 'center', padding: '34px 16px' } },
        h('div', { class: 't-title', style: { fontSize: '18px' } }, 'No competition sorties yet'),
        h('div', { class: 't-dim', style: { margin: '6px 0 16px' } }, `Fly ${DRILL_NAMES[drill]} · ${nice(level)} in Competition mode to post a time.`),
        btn('Fly competition', { kind: 'primary', iconName: 'plane', sound: null, onClick: () => fly(drill, level, 'COMPETITION') })));
    } else {
      runs.slice(0, 20).forEach((r, i) => list.append(h('div', { class: 'rowc' + (i === 0 ? ' me' : '') },
        h('span', { class: 'rk' }, i < 3 ? h('span', { class: `medal g${i + 1}` }, i + 1) : i + 1),
        h('div', { class: 'grow' }, h('div', { class: 'who' }, store.displayName()), h('div', { class: 't-faint', style: { fontSize: '12px' } }, new Date(r.created).toLocaleDateString())),
        pip(STAR_MEDAL[starsFor(r)]), h('span', { class: 'sc' }, r.overall_score), h('span', { class: 't-num t-dim', style: { width: '52px', textAlign: 'right' } }, fmtTime(r.time_seconds)))));
    }
    body.append(list, h('div', { class: 't-faint', style: { fontSize: '12px', marginTop: '12px' } }, 'Your best competition runs on this device. Global boards and squadrons arrive with online play.'));
  }
  draw();
}
function masteryCard(drillId) {
  const runs = store.weightedRuns(drillId); const { tier, next, pct } = tierForRuns(runs); const s = METAL_STYLE[tier.metal];
  const badge = (t, sm) => h('div', { class: 'tier-badge' + (sm ? ' sm' : ''), style: { background: `linear-gradient(160deg, ${METAL_STYLE[t.metal].a}, ${METAL_STYLE[t.metal].b} 55%, ${METAL_STYLE[t.metal].c})` } }, t.roman);
  return h('div', { class: 'card card-pad' },
    h('div', { class: 'ms-hero' }, badge(tier),
      h('div', { class: 'info' }, h('div', { class: 't-display', style: { fontSize: '28px', color: s.a } }, tier.name), h('div', { class: 't-dim' }, `${runs} weighted reps`),
        h('div', { style: { margin: '8px 0 4px' } }, bar(pct, 'gold')), h('div', { class: 't-faint', style: { fontSize: '12px' } }, next ? `${next.runs - runs} more to ${next.name}` : 'Maximum tier'))),
    h('div', { class: 'ms-grid' }, TIERS.map((t) => h('div', { class: 'ms-cell' + (runs >= t.runs ? '' : ' locked') + (t === tier ? ' cur' : '') }, badge(t, true), h('div', { class: 'n' }, t.name), h('div', { class: 'r' }, `${t.runs}`)))));
}

// ======================================================================= Hangar
function hangarPage(el, { params, wallet: topWallet }) {
  let drill = params?.drill && (ENV_THEMES[params.drill] || INSTRUMENT_THEMES[params.drill]) ? params.drill : 'pea-drop';
  let kind = 'env';
  const grid = h('div', { class: 'hgrid' });
  const rail = h('div', { class: 'rail' });
  const right = h('div');
  el.append(h('div', { class: 'pg-head', style: { maxWidth: '1200px', margin: '4px auto 12px' } }, h('h1', { class: 't-display' }, 'Hangar')), h('div', { class: 'two-col' }, rail, right));
  function drawRail() {
    rail.innerHTML = '';
    DRILL_IDS.forEach((d) => {
      const count = (ENV_THEMES[d]?.length || 0) + (INSTRUMENT_THEMES[d]?.length || 0);
      rail.append(h('button', { class: drill === d ? 'on' : '', onclick: () => { haptic(6); playSound('swipe', { volume: 0.4 }); drill = d; kind = ENV_THEMES[d] ? 'env' : 'instrument'; drawRail(); draw(); } }, h('span', { class: 'n' }, DRILL_NAMES[d]), h('span', { class: 't-faint t-num' }, count || '—')));
    });
  }
  async function draw() {
    right.innerHTML = '';
    const envs = ENV_THEMES[drill], insts = INSTRUMENT_THEMES[drill];
    if (!envs && !insts) { right.append(h('div', { class: 'card card-pad', style: { textAlign: 'center', padding: '40px 16px' } }, h('div', { class: 't-title', style: { fontSize: '18px' } }, 'Coming soon'), h('div', { class: 't-dim', style: { marginTop: '6px' } }, `Skins for ${DRILL_NAMES[drill]} are on the way.`))); return; }
    const opts = [envs ? { value: 'env', label: 'Environment' } : null, insts ? { value: 'instrument', label: 'Instruments' } : null].filter(Boolean);
    if (!opts.find((o) => o.value === kind)) kind = opts[0].value;
    right.append(segmented(opts, kind, (v) => { kind = v; draw(); }).el, h('div', { style: { height: '12px' } }), grid);
    grid.innerHTML = '';
    const { envSnapshot, instSnapshot } = await import('../game/preview.js');
    const list = kind === 'env' ? envs : insts; const sel = store.getSelection(drill);
    for (const t of list) {
      const key = ownedKey(drill, kind, t.id), owned = store.isOwned(key), eq = (kind === 'env' ? sel.env : sel.instrument) === t.id;
      const im = h('div', { class: 'im' }, h('div', { class: 'spin' }), !owned ? h('div', { class: 'price' }, h('span', { class: 'coin' }, 'S'), COSMETIC_COST.toLocaleString()) : null);
      grid.append(h('button', { class: 'skin' + (eq ? ' eq' : ''), onclick: () => onSkin(t, key, owned) }, im,
        h('div', { class: 'ft' }, h('span', { class: 'dot', style: { width: '10px', height: '10px', borderRadius: '50%', background: t.accent } }), h('span', { class: 'n' }, t.name), eq ? h('span', { class: 'badge-eq' }, 'EQUIPPED') : owned ? h('span', { class: 't-faint', style: { fontSize: '11px', fontWeight: 700, letterSpacing: '.14em' } }, 'OWNED') : icon('lock'))));
      (kind === 'env' ? envSnapshot(drill, t.id) : instSnapshot(drill, t.id)).then((url) => { im.querySelector('.spin')?.remove(); if (url) im.prepend(h('img', { src: url, alt: t.name })); else im.append(h('div', { class: 't-faint', style: { fontSize: '12px' } }, t.name)); });
    }
  }
  function equip(t) { store.setSelection(drill, kind === 'env' ? { env: t.id } : { instrument: t.id }); haptic(8); playSound('swipe'); draw(); }
  function onSkin(t, key, owned) {
    if (owned) { equip(t); return; }
    const s = sheet(t.name);
    const enough = store.coins >= COSMETIC_COST;
    s.body.append(
      h('div', { class: 't-dim', style: { marginBottom: '14px' } }, `${kind === 'env' ? 'Environment' : 'Instrument'} skin for ${DRILL_NAMES[drill]}. Visual only — it never changes difficulty.`),
      h('div', { class: 'rowc' }, h('span', { class: 'grow' }, 'Price'), h('span', { class: 'coin' }, 'S'), h('b', { class: 't-num' }, COSMETIC_COST.toLocaleString())),
      h('div', { class: 'rowc' }, h('span', { class: 'grow' }, 'Your coins'), h('b', { class: 't-num', style: { color: enough ? 'var(--gold)' : 'var(--bad)' } }, store.coins.toLocaleString())),
      h('div', { style: { height: '14px' } }),
      enough ? btn(`Unlock for ${COSMETIC_COST.toLocaleString()}`, { kind: 'primary', size: 'lg', block: true, sound: null, onClick: () => {
        const r = store.purchase(key, COSMETIC_COST);
        if (!r.ok) { toast('Purchase failed', { err: true }); return; }
        s.close(true); topWallet?.bump(); synth('coin');
        celebrate({ over: 'Unlocked', title: t.name, sub: `Equipped for ${DRILL_NAMES[drill]}`, cta: 'Nice' }).then(() => equip(t));
      } }) : h('div', { class: 't-dim', style: { textAlign: 'center' } }, `You need ${(COSMETIC_COST - store.coins).toLocaleString()} more coins. Higher levels pay more per sortie.`));
  }
  drawRail(); draw();
}

// ======================================================================= Profile (stats + settings)
function profilePage(el, { go }) {
  const draw = () => {
    el.innerHTML = '';
    const p = store.profile, r = rankFor(totalXp());
    const nameIn = h('input', { class: 'name-in', value: p.callsign, maxlength: 16, 'aria-label': 'Callsign' });
    nameIn.addEventListener('keydown', (e) => e.stopPropagation());
    nameIn.addEventListener('change', () => { store.setProfile({ callsign: nameIn.value.trim().toUpperCase().slice(0, 16) }); toast('Callsign updated'); });
    const set = (label, small, control) => h('div', { class: 'set-row' }, h('div', { class: 'grow' }, h('div', { class: 'lbl' }, label), small ? h('small', {}, small) : null), control);
    el.append(h('div', { style: { maxWidth: '1000px', margin: '0 auto', display: 'grid', gap: '14px' } },
      h('div', { class: 'card card-pad pcard' }, rankBadge({ lg: true }),
        h('div', { class: 'grow' }, h('div', { class: 't-over' }, `Rank ${r.level} · ${r.title}`), h('div', { class: 'nm' }, store.displayName()), h('div', { style: { margin: '8px 0 4px' } }, bar(r.pct)), h('div', { class: 't-faint t-num', style: { fontSize: '12px' } }, `${totalXp().toLocaleString()} XP total`))),
      h('div', { class: 'stat-row' },
        stat('Sorties', p.totalRuns), stat('Flight time', fmtTime(p.totalTime)), stat('Coins', store.coins.toLocaleString()), stat('Skins', p.owned.length)),
      h('div', { class: 'card card-pad' }, h('div', { class: 't-over', style: { marginBottom: '6px' } }, 'Drills'),
        h('table', { class: 'dtable' }, h('tbody', {}, DRILL_IDS.filter((d) => d !== 'suturing').map((d) => h('tr', { style: { cursor: 'pointer' }, onclick: () => go('drills', { drill: d }) },
          h('td', {}, DRILL_NAMES[d]), h('td', {}, h('span', { style: { display: 'inline-flex', gap: '4px' } }, drillLadder(d).map((x) => pip(x.medal, { locked: !x.unlocked })))),
          h('td', { class: 't-num' }, `best ${store.bestFor(d) ?? '—'}`), h('td', { class: 't-num t-dim' }, `${store.runsFor(d).length} runs`)))))),
      h('div', { class: 'card card-pad' }, h('div', { class: 't-over', style: { marginBottom: '4px' } }, 'Pilot'),
        set('Callsign', null, nameIn),
        set('Dominant hand', 'Used for competition sorties', segmented([{ value: 'RIGHT', label: 'Right' }, { value: 'LEFT', label: 'Left' }], p.hand, (v) => store.setProfile({ hand: v })).el)),
      h('div', { class: 'card card-pad' }, h('div', { class: 't-over', style: { marginBottom: '4px' } }, 'Settings'),
        set('Sound effects', null, toggle(store.settings.sfx, (v) => store.setSetting('sfx', v))),
        set('Music & ambience', null, toggle(store.settings.music, (v) => store.setSetting('music', v))),
        set('Scout reads aloud', 'Scout speaks the lessons, quiz and tips', toggle(!!store.settings.voice, (v) => store.setSetting('voice', v))),
        set('Tap to grip', 'Touch GRAB button: tap once to grab, again to let go. Off: hold it (Space always taps)', toggle((store.settings.gripMode || 'tap') === 'tap', (v) => store.setSetting('gripMode', v ? 'tap' : 'hold'))),
        set('Text size', 'Bigger words everywhere', segmented([{ value: 1, label: 'Normal' }, { value: 1.15, label: 'Large' }, { value: 1.3, label: 'Huge' }], store.settings.textScale || 1, (v) => { store.setSetting('textScale', v); applyTextScale(); }).el),
        set('Scope lens effects', 'Glow, distortion, grain. Off for slower phones', toggle(store.settings.quality !== 'low', (v) => store.setSetting('quality', v ? 'high' : 'low'))),
        set('Auto smooth mode', 'Turns effects down by itself if a device runs slowly', toggle(store.settings.autoQuality !== false, (v) => store.setSetting('autoQuality', v))),
        set('Reduce motion', 'Calmer transitions, no camera shake or slow-motion', toggle(!!store.settings.reduceMotion, (v) => { store.setSetting('reduceMotion', v); document.body.classList.toggle('reduce-motion', v); })),
        set('Left-hand key layout', 'WASD moves; arrows for depth and rotation', toggle(store.settings.leftHand, (v) => store.setSetting('leftHand', v))),
        set('Reset progress', 'Erase sorties, coins and skins on this device', btn('Reset', { kind: 'danger', size: 'sm', onClick: () => { const s = sheet('Reset everything?'); s.body.append(h('p', { class: 't-dim' }, 'This permanently erases all sorties, medals, coins and skins on this device. It cannot be undone.'), h('div', { style: { display: 'flex', gap: '10px', marginTop: '12px' } }, btn('Cancel', { kind: 'glass', block: true, onClick: () => s.close() }), btn('Erase', { kind: 'danger', block: true, onClick: () => store.resetAll() }))); } }))),
    ));
  };
  draw();
}
export function applyTextScale() { document.documentElement.style.setProperty('--ts', String(store.settings.textScale || 1)); }
const stat = (k, v) => h('div', { class: 'stat2' }, h('div', { class: 't-over' }, k), h('div', { class: 'v' }, v));

/** Swap a placeholder background for a render of the drill as it looks now (with the equipped skin). */
function liveArt(drillId, el) {
  import('../game/preview.js').then(({ heroSnapshot }) => heroSnapshot(drillId, store.getSelection(drillId).env)).then((url) => { if (url) el.style.backgroundImage = `url(${url})`; }).catch(() => {});
  return el;
}
