// Campaign map, the sticker album (stickers, patches, Real surgeon cards) and the Home widgets
// for the daily flight plan and the reward track.
import { h, icon, fmtTime } from './dom.js';
import { btn, sheet, bar, segmented } from './kit.js';
import { store } from '../store.js';
import { playSound, haptic } from '../audio.js';
import { DRILL_NAMES, nice, BUMPS_OK, STAR_SCORE } from '../progress.js';
import { RULES, FACTS, rulePic } from '../rules.js';
import { NODES, ISLANDS, mapState, currentNode, VARIANTS, PAR, STICKERS, hasSticker, syncStickers, patchFor, trackState, trackReward, TRACK_EVERY, dailyState, ghostFor } from '../campaign.js';
import { scout } from './buddy.js';
import { mapArt } from './mapart.js';

// ---------------------------------------------------------------- base emblems (40×40, sticker style)
const EMB = {
  'pea-drop': '<path class="fo dome" d="M6 32c0-12 6-19 14-19s14 7 14 19z"/><ellipse class="fo f3" cx="20" cy="14" rx="5" ry="2"/><circle class="fo pea" cx="20" cy="6" r="4.5"/><circle class="hl" cx="18.6" cy="4.6" r="1.3"/>',
  'triangle-transfer': '<path class="fo sun" d="M5 34 20 12 35 34z"/><circle class="fo sky" cx="20" cy="9" r="5.5"/><circle class="fo paper" cx="20" cy="9" r="2.4"/>',
  'cylinder-transfer': '<rect class="fo steel" x="18" y="22" width="4" height="13"/><rect class="fo sky" x="13" y="8" width="14" height="18" rx="2"/><path class="fo f3" d="M8 12h5v5H8zM27 12h5v5h-5z"/>',
  'cobra-rope': '<path class="fo tom" d="M4 16h8v8H4z"/><path class="fo paper" d="M12 16h8v8h-8z"/><path class="fo tom" d="M20 16h8v8h-8z"/><path class="fo paper" d="M28 16h8v8h-8z"/>',
  night: '<path class="fo sun" d="M26 6a14 14 0 1 0 8 22A12 12 0 0 1 26 6z"/><circle class="f3" cx="10" cy="9" r="1.5"/><circle class="f3" cx="34" cy="6" r="1.2"/>',
  speed: '<circle class="fo paper" cx="20" cy="22" r="13"/><rect class="fo tom" x="17" y="3" width="6" height="5" rx="1"/><path class="o w" d="M20 22l6-6"/><path class="o" d="M20 12v2M30 22h-2M20 32v-2M10 22h2"/>',
};
const emblem = (k) => h('span', { class: 'emb', html: `<svg viewBox="0 0 40 40" aria-hidden="true">${EMB[k] || ''}</svg>` });
const starPips = (n) => h('span', { class: 'stars3' }, [0, 1, 2].map((i) => h('i', { class: i < n ? 'on' : '' }, icon('star'))));
const DCOL = { 'pea-drop': 'orange', 'triangle-transfer': 'sun', 'cylinder-transfer': 'sky', 'cobra-rope': 'tom' };

/** Open the base sheet: what it is, its stars, the ghost to beat, and Fly. */
export function openBase(node, { fly, school }) {
  const v = node.variant ? VARIANTS[node.variant] : null;
  const g = ghostFor(node.drill, node.level, node.variant);
  const sh = sheet(`Base ${node.n} · ${DRILL_NAMES[node.drill]}`, { cls: 'base-sheet' });
  const needSchool = RULES[node.drill] && !store.schoolFor(node.drill);
  const third = node.variant === 'speed' ? `Beat par ${fmtTime(PAR[node.drill])}` : `${STAR_SCORE}+ points`;
  sh.body.append(
    h('div', { class: 'bs-top' }, h('div', { class: 'base big c-' + (v ? 'navy' : DCOL[node.drill]) }, emblem(node.variant || node.drill)),
      h('div', {}, h('div', { class: 't-over' }, `${ISLANDS[node.island].name} · ${nice(node.level)}`),
        h('div', { class: 'si-t' }, v ? `${v.name}: ${DRILL_NAMES[node.drill]}` : DRILL_NAMES[node.drill]),
        v ? h('p', { class: 't-dim', style: { margin: '4px 0 0' } }, v.text) : null)),
    h('div', { class: 'bs-stars' }, [['Finish it', 1], [`${BUMPS_OK[node.drill]} bump${BUMPS_OK[node.drill] === 1 ? '' : 's'} or less`, 2], [third, 3]].map(([t, k]) =>
      h('div', { class: 'bs-star' + (node.stars >= k ? ' on' : '') }, icon('star'), h('span', {}, t)))),
    g ? h('div', { class: 'bs-ghost' }, icon('user'), `Your ghost: ${fmtTime(g.time)} — race it!`) : null,
    h('div', { style: { display: 'flex', gap: '10px', marginTop: '14px' } },
      needSchool && node.level === 'BEGINNER' ? btn('Rule school', { kind: 'glass', size: 'lg', iconName: 'flag', onClick: () => { sh.close(true); school(node.drill); } }) : null,
      h('div', { style: { flex: 1 } }, btn(node.stars ? 'Fly again' : 'Fly', { kind: 'primary', size: 'lg', block: true, iconName: 'plane', sound: null, onClick: () => { sh.close(true); fly(node.drill, node.level, 'PRACTICE', store.profile.hand || 'RIGHT', node.variant || null); } }))));
}

// ---------------------------------------------------------------- campaign map page
const W = 400, STEP = 112, ISL_GAP = 150;
function layout() {
  // bottom-to-top: Beginner Bay at the bottom, Top Gun Peak at the top (you fly upward)
  const pts = NODES.map((n, i) => ({ x: 200 + Math.sin(i * 1.15 + 0.4) * 112, y: i * STEP + n.island * ISL_GAP }));
  const H = pts[pts.length - 1].y + 260;
  pts.forEach((p) => (p.y = H - 130 - p.y));
  return { pts, H };
}
export function mapPage(el, { fly, school }) {
  const st = mapState(), cur = currentNode(), { pts, H } = layout();
  const islands = ISLANDS.map((isl, k) => {
    const ys = pts.filter((_, i) => NODES[i].island === k).map((p) => p.y);
    return { cy: (Math.min(...ys) + Math.max(...ys)) / 2, ry: (Math.max(...ys) - Math.min(...ys)) / 2 + 84, rx: 178, open: st.find((n) => n.island === k)?.open };
  });
  let path = `M${pts[0].x} ${pts[0].y}`; const samples = [], segs = [];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], c1 = [a.x, a.y - STEP * 0.45], c2 = [b.x, b.y + STEP * 0.45];
    path += ` C${c1[0]} ${c1[1]} ${c2[0]} ${c2[1]} ${b.x} ${b.y}`; segs.push(` C${c1[0]} ${c1[1]} ${c2[0]} ${c2[1]} ${b.x} ${b.y}`);
    for (let t = 0; t <= 1; t += 0.08) { const u = 1 - t; samples.push({ x: u * u * u * a.x + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * b.x, y: u * u * u * a.y + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * b.y }); }
  }
  const svg = `<svg class="map-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" aria-hidden="true">${mapArt({ pts, nodes: NODES, islands, W, H, routeD: path, routeSamples: samples })}</svg>`;
  const map = h('div', { class: 'map', style: { aspectRatio: `${W} / ${H}` }, html: svg });
  ISLANDS.forEach((isl, k) => {
    const i0 = NODES.findIndex((n) => n.island === k), p = pts[i0 + 4] || pts[i0];
    map.append(h('div', { class: 'isl-sign' + (islands[k].open ? '' : ' locked'), style: { left: '50%', top: `${((islands[k].cy - islands[k].ry + 4) / H) * 100}%` } }, islands[k].open ? null : icon('lock'), isl.name));
  });
  st.forEach((n, i) => {
    const p = pts[i], isCur = n.id === cur.id;
    const b = h('button', { class: 'base-node' + (n.open ? '' : ' locked') + (isCur ? ' cur' : ''), style: { left: `${(p.x / W) * 100}%`, top: `${(p.y / H) * 100}%` }, 'aria-label': `Base ${n.n}: ${DRILL_NAMES[n.drill]} ${nice(n.level)}${n.variant ? ' ' + VARIANTS[n.variant].name : ''}`,
      onclick: () => { if (!n.open) { playSound('error', { volume: 0.3 }); haptic(20); return; } haptic(8); playSound('swipe', { volume: 0.4 }); openBase(n, { fly, school }); } },
    h('span', { class: 'base c-' + (n.variant ? 'navy' : DCOL[n.drill]) }, n.open ? emblem(n.variant || n.drill) : icon('lock'), h('b', { class: 'bn' }, n.n)),
    n.open ? starPips(n.stars) : null,
    h('span', { class: 'bl' }, n.variant ? VARIANTS[n.variant].short : DRILL_NAMES[n.drill].split(' ')[0]));
    if (isCur) b.append(h('span', { class: 'map-scout' }, scout('happy', { size: 60 })));
    map.append(b);
  });
  const total = st.reduce((a, n) => a + n.stars, 0);
  el.append(h('div', { class: 'map-page' },
    h('div', { class: 'map-head card glass card-pad' }, h('div', {}, h('div', { class: 't-over' }, 'Campaign'), h('div', { class: 'si-t' }, `${total} / ${NODES.length * 3} stars`)),
      btn(`Fly base ${cur.n}`, { kind: 'primary', iconName: 'plane', sound: null, onClick: () => openBase(cur, { fly, school }) })),
    h('div', { class: 'map-scroll' }, map)));
  // a new base since your last visit? fly the jet there along the route
  let last = 0; try { last = +localStorage.getItem('tgs:mapLast') || 0; } catch {}
  try { localStorage.setItem('tgs:mapLast', String(cur.n)); } catch {}
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches || store.settings.reduceMotion;
  if (last > 0 && cur.n > last && !calm) requestAnimationFrame(() => flyTo(el, map, pts, segs, last - 1, cur.n - 1, H));
  else requestAnimationFrame(() => el.querySelector('.base-node.cur')?.scrollIntoView({ block: 'center' }));
}

const JET_SVG = '<svg viewBox="-24 -20 48 40" aria-hidden="true"><path d="M22 0 10-3.4H1L-7-17h-5l3 13.6H-17l-4-5.6h-4l2 9 -2 9h4l4-5.6h8.1L-12 17h5l8-13.6h9z" fill="#fffdf6" stroke="#0b1430" stroke-width="2.4" stroke-linejoin="round"/><path d="M15-2 20 0 15 2z" fill="#4cc9ff" stroke="#0b1430" stroke-width="1.4"/><path d="M-6-9.5-4-3.4M-6 9.5-4 3.4" stroke="#ff8a1f" stroke-width="2.4" stroke-linecap="round"/></svg>';
/** The jet takes off from base `from`, follows the dotted route and lands on base `to`. */
function flyTo(el, map, pts, segs, from, to, H) {
  const W = 400, scroller = el.querySelector('.map-scroll'), curNode = el.querySelector('.base-node.cur');
  const pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  pathEl.setAttribute('d', `M${pts[from].x} ${pts[from].y}` + segs.slice(from, to).join(''));
  const len = pathEl.getTotalLength();
  const jet = h('div', { class: 'map-jet', html: JET_SVG }); map.append(jet);
  curNode?.classList.add('arriving');
  const trail = [];
  const dur = Math.min(3600, 1300 + len * 4), t0 = performance.now();
  playSound('swipe', { volume: 0.5 }); haptic(10);
  const place = (p, ang, lift) => { jet.style.left = `${(p.x / W) * 100}%`; jet.style.top = `${(p.y / H) * 100}%`; jet.style.transform = `translate(-50%, -50%) rotate(${ang}rad) scale(${1 + lift * 0.45})`; jet.style.setProperty('--lift', lift); };
  const step = (now) => {
    if (!el.isConnected) return;
    const k = Math.min(1, (now - t0) / dur), e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
    const L = e * len, p = pathEl.getPointAtLength(L), q = pathEl.getPointAtLength(Math.min(len, L + 2)), pb = pathEl.getPointAtLength(Math.max(0, L - 2));
    const ang = Math.atan2(q.y - pb.y, q.x - pb.x), lift = Math.sin(Math.PI * k); // climbs, cruises, comes down
    place(p, ang, lift);
    // keep it in view
    const y = (p.y / H) * map.clientHeight; scroller.scrollTop += (y - scroller.clientHeight / 2 - scroller.scrollTop) * 0.12;
    // contrail puffs
    if (trail.length === 0 || now - trail.at(-1).t > 60) { const d = h('i', { class: 'map-trail', style: { left: `${(p.x / W) * 100}%`, top: `${(p.y / H) * 100}%` } }); map.insertBefore(d, jet); trail.push({ d, t: now }); setTimeout(() => d.remove(), 900); }
    if (k < 1) requestAnimationFrame(step);
    else {
      jet.classList.add('landed'); setTimeout(() => jet.remove(), 500);
      curNode?.classList.remove('arriving'); curNode?.classList.add('landed');
      playSound('success', { volume: 0.4 }); haptic([15, 30, 15]);
    }
  };
  requestAnimationFrame(step);
}

// ---------------------------------------------------------------- stickers
export function stickerEl(s, { big = false, locked = false } = {}) {
  return h('span', { class: `sticker sh-${s.shape} c-${s.c}` + (big ? ' big' : '') + (locked ? ' locked' : ''), title: s.name }, h('span', { class: 'st-in' }, locked ? icon('lock') : icon(s.art)));
}

// ---------------------------------------------------------------- album page
export function albumPage(el, { go, params }) {
  syncStickers();
  let tab = params?.tab || 'stickers';
  const body = h('div', { class: 'album-body' });
  const seg = segmented([{ value: 'stickers', label: 'Stickers' }, { value: 'patches', label: 'Patches' }, { value: 'facts', label: 'Surgeon cards' }], tab, (v) => { tab = v; draw(); }, { block: true });
  const draw = () => {
    body.innerHTML = '';
    if (tab === 'stickers') {
      const got = STICKERS.filter((s) => hasSticker(s.id)).length;
      body.append(h('div', { class: 'album-note' }, `${got} of ${STICKERS.length} stickers — earned by flying. Nothing here is for sale.`),
        h('div', { class: 'st-grid' }, STICKERS.map((s, i) => {
          const have = hasSticker(s.id);
          return h('div', { class: 'st-cell' + (have ? ' have' : ''), style: { '--r': `${((i * 37) % 11) - 5}deg` } }, stickerEl(s, { locked: !have }), h('b', {}, have ? s.name : '???'), h('small', {}, s.how));
        })));
    } else if (tab === 'patches') {
      body.append(h('div', { class: 'album-note' }, 'Bronze patch: finish all four levels of a drill. Gold patch: 3 stars on all four.'),
        h('div', { class: 'pt-grid' }, Object.keys(RULES).map((d) => {
          const p = patchFor(d);
          return h('div', { class: 'patch' + (p.tier ? ' ' + p.tier : ' none') },
            h('span', { class: 'pt-art', html: rulePic(RULES[d][0].id) }), h('b', {}, p.name), h('small', {}, p.tier ? `${p.tier === 'gold' ? 'Gold' : 'Bronze'} patch · ${p.stars}/12 ★` : `${p.stars}/12 ★ — keep flying`));
        })));
    } else {
      const seen = store.data.facts || [];
      body.append(h('div', { class: 'album-note' }, `${seen.length} of ${FACTS.length} Real surgeon cards — you get one after every mission.`),
        h('div', { class: 'fc-grid' }, FACTS.map((f) => seen.includes(f.id)
          ? h('div', { class: 'fact-card' }, h('div', { class: 'fc-k' }, icon('user'), 'Real surgeon'), h('div', { class: 'fc-t' }, f.title), h('p', {}, f.text))
          : h('div', { class: 'fact-card locked' }, h('div', { class: 'fc-t' }, '?'), h('p', {}, 'Fly a mission to collect this card.')))));
    }
  };
  el.append(h('div', { class: 'album' }, h('div', { class: 'album-top' }, seg.el, btn('Skins', { kind: 'glass', iconName: 'shirt', onClick: () => go('hangar') })), body));
  draw();
}

// ---------------------------------------------------------------- Home widgets
export function dailyCard({ fly }) {
  const ds = dailyState(), s = ds.streak;
  return h('div', { class: 'card glass card-pad daily' },
    h('div', { class: 'dl-head' }, h('div', { class: 't-over' }, 'Daily flight plan'),
      h('span', { class: 'trail', title: `Best ${s.best} days · ${s.freezes} free freeze day${s.freezes === 1 ? '' : 's'}` }, icon('plane'), `${s.count}-day trail`)),
    ds.plan.map((m, i) => h('button', { class: 'dl-row' + (ds.done[i] ? ' done' : ''), onclick: () => !ds.done[i] && fly(m.drill, m.level) },
      h('span', { class: 'dl-box' }, ds.done[i] ? icon('check') : null), h('span', { class: 'grow' }, m.text), ds.done[i] ? null : icon('right'))),
    h('div', { class: 't-faint', style: { fontSize: '12px', marginTop: '6px' } }, ds.claimed ? 'Plan done for today — great flying!' : `All 3: +150 coins. Missed a day? You have ${s.freezes} free freeze day${s.freezes === 1 ? '' : 's'}.`));
}
export function trackCard() {
  const t = trackState(), rw = t.next;
  const s = rw.sticker ? STICKERS.find((x) => x.id === rw.sticker) : null;
  return h('div', { class: 'card glass card-pad track' },
    h('div', { class: 'tk-prize' }, s ? stickerEl(s) : h('span', { class: 'coin' }, 'S')),
    h('div', { class: 'grow' }, h('div', { class: 't-over' }, 'Reward track'), h('div', { class: 'tk-t' }, s ? s.name : `+${rw.coins} coins`),
      h('div', { style: { margin: '6px 0 2px' } }, bar(t.into / TRACK_EVERY)), h('div', { class: 't-faint', style: { fontSize: '12px' } }, `${TRACK_EVERY - t.into} more mission${TRACK_EVERY - t.into === 1 ? '' : 's'}`)));
}
