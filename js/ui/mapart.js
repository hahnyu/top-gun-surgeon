// Campaign map scenery: islands with beaches, runways, hangars, towers, trees, boats and clouds.
// Everything is placed with a seeded random so the map looks the same every visit, and nothing is
// allowed to sit on a base (stop) or on the flight route between them.

const INK = '#0b1430';
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const f = (n) => n.toFixed(1);

export function blob(cx, cy, rx, ry, seed, wob = 1) {
  const n = 18, pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2, w = 1 + wob * (0.07 * Math.sin(i * 2.3 + seed) + 0.05 * Math.cos(i * 3.7 + seed * 2) + 0.03 * Math.sin(i * 5.1 + seed * 3));
    pts.push([cx + Math.cos(a) * rx * w, cy + Math.sin(a) * ry * w]);
  }
  let d = `M${f((pts[0][0] + pts[1][0]) / 2)} ${f((pts[0][1] + pts[1][1]) / 2)}`;
  for (let i = 1; i <= n; i++) { const p = pts[i % n], q = pts[(i + 1) % n]; d += ` Q${f(p[0])} ${f(p[1])} ${f((p[0] + q[0]) / 2)} ${f((p[1] + q[1]) / 2)}`; }
  return d + 'Z';
}

// ---------------------------------------------------------------- props (origin = where it touches the ground)
const shadow = (w, dy = 0) => `<ellipse cx="0" cy="${dy}" rx="${w}" ry="${(w * 0.32).toFixed(1)}" class="sh"/>`;
const PROPS = {
  pine: (s) => `${shadow(10 * s)}<g transform="scale(${s})"><rect x="-2" y="-6" width="4" height="7" class="trunk"/><path d="M0 -30 9 -17H4l8 11H-12l8-11h-5z" class="pine"/><path d="M0 -30 4 -24" class="hl"/></g>`,
  tree: (s) => `${shadow(10 * s)}<g transform="scale(${s})"><rect x="-2" y="-8" width="4" height="9" class="trunk"/><circle cx="0" cy="-16" r="10" class="leaf"/><circle cx="-3" cy="-19" r="3.4" class="leaf-hl"/></g>`,
  palm: (s) => `${shadow(9 * s)}<g transform="scale(${s})"><path d="M0 0c-1-8 1-17 5-24" class="palm-trunk"/><path d="M5 -24c-6-5-13-4-16 1 5-2 10-2 16-1zM5 -24c6-6 13-5 16 0-5-2-10-2-16 0zM5 -24c-3 5-8 8-12 8 3-4 7-7 12-8zM5 -24c4 4 7 9 7 13-4-3-6-8-7-13z" class="palm"/><circle cx="4" cy="-22" r="1.8" class="coco"/></g>`,
  bush: (s) => `${shadow(7 * s, 1)}<g transform="scale(${s})"><path d="M-8 1c-3-6 2-10 6-8 1-5 9-5 10 0 5-1 7 5 2 8z" class="leaf"/></g>`,
  rock: (s) => `${shadow(9 * s, 1)}<g transform="scale(${s})"><path d="M-9 1-6-7 0-10 7-6 9 1z" class="rock"/><path d="M-6-7 0-10 1-3z" class="rock-hl"/></g>`,
  hangar: (s, n = 1) => `${shadow(26 * s, 1)}<g transform="scale(${s})"><path d="M-24 0V-13C-24-28 24-28 24-13V0z" class="hangar"/><path d="M-12-22.5V0M0-25V0M12-22.5V0" class="rib"/><path d="M-12 0V-12h24V0z" class="door"/><path d="M-12-8h24M-12-4h24" class="door-l"/><text x="0" y="-15" class="decal">${n}</text></g>`,
  tower: (s) => `${shadow(10 * s, 1)}<g transform="scale(${s})"><path d="M-5 0-3-26h6L5 0z" class="tower"/><path d="M-10-26h20l-3-9H-7z" class="glass"/><path d="M-8-35h16v-3H-8z" class="tower-cap"/><path d="M0-38v-8" class="ant"/><circle cx="0" cy="-47" r="1.8" class="beacon"/><path d="M-3-12h6M-3-18h6" class="rib"/></g>`,
  windsock: (s) => `<g transform="scale(${s})"><path d="M0 0v-22" class="ant"/><path d="M0-22 14-19v4L0-15z" class="sock"/><path d="M5-21v6M10-20v4" class="sock-l"/></g>`,
  tanks: (s) => `${shadow(16 * s, 1)}<g transform="scale(${s})"><path d="M-15 0v-11a6 3 0 0 1 12 0V0a6 3 0 0 1-12 0z" class="tank"/><ellipse cx="-9" cy="-11" rx="6" ry="3" class="tank-top"/><path d="M3 0v-14a6 3 0 0 1 12 0V0a6 3 0 0 1-12 0z" class="tank"/><ellipse cx="9" cy="-14" rx="6" ry="3" class="tank-top"/></g>`,
  lighthouse: (s) => `${shadow(10 * s, 1)}<g transform="scale(${s})"><path d="M-7 0-5-30h10L7 0z" class="lh"/><path d="M-6.3-10h12.6l-.5-7H-5.8zM-5.3-24h10.6l-.4-5H-4.9z" class="lh-band"/><path d="M-6-30h12v-7H-6z" class="glass"/><path d="M-7-37h14l-7-6z" class="lh-band"/><path d="M6-34 26-40v12z" class="beam"/></g>`,
  radar: (s) => `${shadow(14 * s, 1)}<g transform="scale(${s})"><path d="M-12 0v-6h24V0z" class="tower"/><path d="M-12-6a12 12 0 0 1 24 0z" class="dome"/><path d="M-6-12a8 6 0 0 1 12 0" class="rib"/></g>`,
  flag: (s) => `<g transform="scale(${s})"><path d="M0 0v-26" class="ant"/><path d="M0-26h13l-3 4 3 4H0z" class="flagc"/></g>`,
  tent: (s) => `${shadow(10 * s, 1)}<g transform="scale(${s})"><path d="M-11 0 0-14 11 0z" class="tent"/><path d="M0-14 0 0" class="rib"/></g>`,
  jet: (s) => `<g transform="scale(${s})"><path d="M14 0 6-2.6-1-2.6-6-12h-4l2 9.4H-12l-3-4h-3l1.5 6.6L-18 6.6h3l3-4h3.1L-11 12h4l5-9.4H6z" class="jet"/><path d="M9-1.4 12 0 9 1.4z" class="glass"/></g>`,
  umbrella: (s) => `<g transform="scale(${s})"><path d="M0 0v-12" class="ant"/><path d="M-9-11a9 5 0 0 1 18 0z" class="umb"/><path d="M-3-14.5-4-11M3-14.5 4-11" class="umb-l"/></g>`,
};

/** A runway with its markings, centred at (x, y), turned by a degrees. */
function runway(x, y, len, a, num) {
  const hl = len / 2;
  let marks = '';
  for (let u = -hl + 22; u < hl - 22; u += 14) marks += `<path d="M${f(u)} 0h7" class="rw-c"/>`;
  for (const s of [-1, 1]) for (let k = -2; k <= 2; k++) marks += `<path d="M${f(s * (hl - 6))} ${k * 3.2}h${-s * 6}" class="rw-t"/>`;
  return `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(a)})"><rect x="${f(-hl - 4)}" y="-13" width="${f(len + 8)}" height="26" rx="4" class="apron"/><rect x="${f(-hl)}" y="-9" width="${f(len)}" height="18" rx="2" class="rw"/>${marks}<text x="${f(-hl + 15)}" y="3" class="rw-n" transform="rotate(90 ${f(-hl + 15)} 0)">${num}</text></g>`;
}

const THEMES = [
  { trees: ['palm', 'palm', 'tree', 'bush', 'umbrella'], extra: ['lighthouse', 'tent', 'flag'], hangars: 1, grass: 'g0', tuft: '#5cc283' },
  { trees: ['pine', 'pine', 'tree', 'tree', 'bush'], extra: ['tanks', 'flag'], hangars: 2, grass: 'g1', tuft: '#4fb38d' },
  { trees: ['palm', 'tree', 'rock', 'bush', 'rock'], extra: ['radar', 'tanks', 'pond'], hangars: 2, grass: 'g2', tuft: '#8fb85a' },
  { trees: ['pine', 'pine', 'rock', 'pine', 'bush'], extra: ['mountain', 'radar', 'flag', 'tanks'], hangars: 3, grass: 'g3', tuft: '#b3a98f' },
];

/**
 * pts: base positions; nodes: NODES; islands: per island { cy, ry, open }; W, H: viewBox size.
 * routeD: the flight route path data. Returns the full inner SVG markup.
 */
export function mapArt({ pts, nodes, islands, W, H, routeD, routeSamples }) {
  const R = rng(1234);
  const busy = []; // circles nothing may overlap: [x, y, r]
  pts.forEach((p) => busy.push([p.x, p.y + 6, 52]));
  routeSamples.forEach((p) => busy.push([p.x, p.y, 15]));
  const free = (x, y, r) => busy.every(([bx, by, br]) => (x - bx) ** 2 + (y - by) ** 2 > (r + br) ** 2);
  const onIsland = (k, x, y, inset = 34) => { const I = islands[k]; return ((x - W / 2) / (I.rx - inset)) ** 2 + ((y - I.cy) / (I.ry - inset)) ** 2 < 1; };
  const onAnyIsland = (x, y, pad) => islands.some((I) => ((x - W / 2) / (I.rx + pad)) ** 2 + ((y - I.cy) / (I.ry + pad)) ** 2 < 1);

  let defs = `<defs>
    <radialGradient id="sea" cx="50%" cy="50%" r="75%"><stop offset="0" stop-color="#5fd0f5"/><stop offset="1" stop-color="#2f9fd6"/></radialGradient>
    <pattern id="tuftp" width="26" height="22" patternUnits="userSpaceOnUse"><path d="M4 12l2-4 2 4M17 19l2-4 2 4" fill="none" stroke="rgba(11,20,48,.16)" stroke-width="1.4" stroke-linecap="round"/></pattern>
    <pattern id="sandp" width="10" height="10" patternUnits="userSpaceOnUse"><circle cx="2" cy="3" r=".9" fill="rgba(11,20,48,.12)"/><circle cx="7" cy="8" r=".7" fill="rgba(11,20,48,.1)"/></pattern>
  </defs>`;
  let sea = `<rect width="${W}" height="${H}" fill="url(#sea)"/>`;
  // wave marks on open water
  for (let k = 0; k < 90; k++) { const x = R() * W, y = R() * H; if (onAnyIsland(x, y, 26)) continue; sea += `<path class="wave" d="M${f(x)} ${f(y)}q5-4 10 0t10 0"/>`; }

  let land = '', fog = '';
  const items = []; // [y, svg] drawn back to front
  islands.forEach((I, k) => {
    const T = THEMES[k], cx = W / 2, seed = k * 1.7;
    land += `<path class="shallow" d="${blob(cx, I.cy, I.rx + 22, I.ry + 22, seed, 1.1)}"/>`;
    land += `<path class="foam" d="${blob(cx, I.cy, I.rx + 7, I.ry + 7, seed, 1)}"/>`;
    land += `<path class="sand" d="${blob(cx, I.cy, I.rx, I.ry, seed)}"/><path class="sand" fill="url(#sandp)" d="${blob(cx, I.cy, I.rx, I.ry, seed)}" style="stroke:none"/>`;
    const gd = blob(cx, I.cy, I.rx - 20, I.ry - 20, seed + 0.5, 1.2);
    land += `<path class="grass ${T.grass}" d="${gd}"/><path d="${gd}" fill="url(#tuftp)"/>`;
    land += `<path class="grass-in ${T.grass}" d="${blob(cx, I.cy, I.rx - 54, I.ry - 56, seed + 1.3, 1.4)}"/>`;

    // runway: find a clear strip inside the island
    const tryPlace = (fn, n = 260) => { for (let t = 0; t < n; t++) { const r = fn(); if (r) return r; } return null; };
    const rw = tryPlace(() => {
      const len = 120 + R() * 30, a = -25 + R() * 50, x = cx + (R() - 0.5) * (I.rx * 1.2), y = I.cy + (R() - 0.5) * (I.ry * 1.6);
      const ax = Math.cos(a * Math.PI / 180), ay = Math.sin(a * Math.PI / 180);
      for (let u = -len / 2; u <= len / 2; u += 12) { const px = x + ax * u, py = y + ay * u; if (!onIsland(k, px, py, 26) || !free(px, py, 16)) return null; }
      return { x, y, len, a, ax, ay };
    });
    if (rw) {
      items.push([rw.y - 30, runway(rw.x, rw.y, rw.len, rw.a, `${(k + 1) * 9 % 36 || 36}`.padStart(2, '0'))]);
      for (let u = -rw.len / 2; u <= rw.len / 2; u += 10) busy.push([rw.x + rw.ax * u, rw.y + rw.ay * u, 15]);
      { const u = rw.len / 2 - 26; items.push([rw.y + 1, `<g transform="translate(${f(rw.x + rw.ax * u)} ${f(rw.y + rw.ay * u)}) rotate(${f(rw.a + 180)})">${PROPS.jet(1.05)}</g>`]); }
      // hangars + tower line up along one side of the runway
      const nx = -rw.ay, ny = rw.ax;
      for (const side of [1, -1]) {
        let placed = 0; const want = T.hangars;
        for (let j = 0; j < want + 3 && placed < want; j++) {
          const u = (j - (want - 1) / 2) * 56, px = rw.x + rw.ax * u + nx * side * 40, py = rw.y + rw.ay * u + ny * side * 40;
          if (onIsland(k, px, py, 30) && free(px, py, 26)) { items.push([py, `<g transform="translate(${f(px)} ${f(py)})">${PROPS.hangar(0.95, k * 3 + placed + 1)}</g>`]); busy.push([px, py - 8, 28]); placed++; I._hangars = placed; }
        }
        if (placed) {
          const u = rw.len / 2 - 6, px = rw.x + rw.ax * u + nx * side * 34, py = rw.y + rw.ay * u + ny * side * 34;
          if (onIsland(k, px, py, 22) && free(px, py, 12)) { items.push([py, `<g transform="translate(${f(px)} ${f(py)})">${PROPS.tower(0.9)}</g>`]); busy.push([px, py - 10, 14]); I._tower = true; }
          const wx = rw.x - rw.ax * (rw.len / 2 - 8) + nx * side * 22, wy = rw.y - rw.ay * (rw.len / 2 - 8) + ny * side * 22;
          if (onIsland(k, wx, wy, 20) && free(wx, wy, 8)) { items.push([wy, `<g transform="translate(${f(wx)} ${f(wy)})">${PROPS.windsock(0.9)}</g>`]); busy.push([wx, wy, 9]); }
          break;
        }
      }
    }
    // make sure every island has its hangars (an airfield cluster wherever there's room)
    {
      let want = T.hangars - (I._hangars || 0);
      for (let t = 0; t < 400 && want > 0; t++) {
        const x = cx + (R() - 0.5) * I.rx * 1.6, y = I.cy + (R() - 0.5) * I.ry * 1.7;
        if (!onIsland(k, x, y, 34) || !free(x, y - 8, 28)) continue;
        items.push([y, `<g transform="translate(${f(x)} ${f(y)})">${PROPS.hangar(0.95, k * 3 + T.hangars - want + 1)}</g>`]); busy.push([x, y - 8, 28]); want--;
        // a little jet parked on the apron in front
        if (free(x, y + 14, 12) && onIsland(k, x, y + 14, 28)) { items.push([y + 14, `<g transform="translate(${f(x)} ${f(y + 15)}) rotate(90)">${PROPS.jet(0.8)}</g>`]); busy.push([x, y + 14, 12]); }
      }
      for (let t = 0; t < 400 && !I._tower; t++) {
        const x = cx + (R() - 0.5) * I.rx * 1.6, y = I.cy + (R() - 0.5) * I.ry * 1.7;
        if (!onIsland(k, x, y, 30) || !free(x, y - 14, 15)) continue;
        items.push([y, `<g transform="translate(${f(x)} ${f(y)})">${PROPS.tower(0.9)}</g>`]); busy.push([x, y - 14, 15]); I._tower = true;
      }
    }
    // landmark extras
    for (const ex of T.extra) {
      if (ex === 'mountain') {
        const m = tryPlace(() => { const x = cx + (R() - 0.5) * I.rx * 1.1, y = I.cy + (R() - 0.5) * I.ry * 1.4; return onIsland(k, x, y, 60) && free(x, y - 14, 40) ? { x, y } : null; });
        if (m) { items.push([m.y, `<g transform="translate(${f(m.x)} ${f(m.y)})">${shadow(44, 1)}<path d="M-46 0-14-52 0-38 12-62 48 0z" class="mtn"/><path d="M-14-52-4-40-9-34 0-38 4-33 12-62z" class="snow"/><path d="M12-62 20-46 13-44 18-38 8-41z" class="snow"/></g>`]); busy.push([m.x, m.y - 20, 46]); }
        continue;
      }
      if (ex === 'pond') {
        const m = tryPlace(() => { const x = cx + (R() - 0.5) * I.rx * 1.2, y = I.cy + (R() - 0.5) * I.ry * 1.5; return onIsland(k, x, y, 50) && free(x, y, 30) ? { x, y } : null; });
        if (m) { land += `<path class="pond" d="${blob(m.x, m.y, 30, 18, 3.3)}"/><path class="pond-hl" d="M${f(m.x - 14)} ${f(m.y - 4)}q6-4 12 0"/>`; busy.push([m.x, m.y, 30]); }
        continue;
      }
      const coast = ex === 'lighthouse' || ex === 'umbrella';
      const m = tryPlace(() => {
        const x = cx + (R() - 0.5) * I.rx * 1.9, y = I.cy + (R() - 0.5) * I.ry * 1.9;
        return (coast ? onIsland(k, x, y, 8) && !onIsland(k, x, y, 30) : onIsland(k, x, y, 30)) && free(x, y - 8, 18) ? { x, y } : null;
      });
      if (m) { items.push([m.y, `<g transform="translate(${f(m.x)} ${f(m.y)})">${PROPS[ex](0.95)}</g>`]); busy.push([m.x, m.y - 8, 18]); }
    }
    // beach umbrellas on Beginner Bay
    if (k === 0) for (let j = 0; j < 4; j++) {
      const m = tryPlace(() => { const x = cx + (R() - 0.5) * I.rx * 1.95, y = I.cy + (R() - 0.5) * I.ry * 1.95; return onIsland(k, x, y, 4) && !onIsland(k, x, y, 22) && free(x, y, 9) ? { x, y } : null; }, 120);
      if (m) { items.push([m.y, `<g transform="translate(${f(m.x)} ${f(m.y)})">${PROPS.umbrella(0.8)}</g>`]); busy.push([m.x, m.y, 9]); }
    }
    // trees fill the rest, in little groves
    const count = 34;
    for (let j = 0; j < count; j++) {
      const m = tryPlace(() => { const x = cx + (R() - 0.5) * I.rx * 1.9, y = I.cy + (R() - 0.5) * I.ry * 1.9; return onIsland(k, x, y, 30) && free(x, y - 6, 9) ? { x, y } : null; }, 60);
      if (!m) continue;
      const kind = T.trees[Math.floor(R() * T.trees.length)], s = 0.75 + R() * 0.4;
      items.push([m.y, `<g transform="translate(${f(m.x)} ${f(m.y)})">${PROPS[kind](s)}</g>`]); busy.push([m.x, m.y - 6, 9]);
      // a neighbour or two for a grove
      for (let q = 0; q < 2; q++) {
        const x = m.x + (R() - 0.5) * 30, y = m.y + (R() - 0.5) * 22;
        if (onIsland(k, x, y, 30) && free(x, y - 6, 8)) { items.push([y, `<g transform="translate(${f(x)} ${f(y)})">${PROPS[kind](0.7 + R() * 0.35)}</g>`]); busy.push([x, y - 6, 8]); }
      }
    }
    // clouds hide islands you haven't reached yet
    if (!I.open) {
      // one solid, puffy cloud bank in the island's shape (a soft shadow under it, bumps all round)
      let puffs = `<path d="${blob(cx, I.cy + 6, I.rx + 14, I.ry + 14, seed)}" class="fog-sh"/><path d="${blob(cx, I.cy, I.rx + 12, I.ry + 12, seed)}"/>`;
      const per = Math.round((Math.PI * (I.rx + I.ry)) / 26);
      for (let j = 0; j < per; j++) { const a = (j / per) * Math.PI * 2, r = 18 + R() * 12; puffs += `<circle cx="${f(cx + Math.cos(a) * (I.rx + 6))}" cy="${f(I.cy + Math.sin(a) * (I.ry + 6))}" r="${f(r)}"/>`; }
      let tops = '';
      for (let j = 0; j < 7; j++) { const x = cx + (R() - 0.5) * I.rx * 1.2, y = I.cy + (R() - 0.5) * I.ry * 1.3; tops += `<path class="fog-hl" d="M${f(x - 26)} ${f(y)}a14 14 0 0 1 16-12a18 18 0 0 1 30 2"/>`; }
      fog += `<g class="fog">${puffs}</g>${tops}`;
    }
  });

  // boats in the channels and around the edges
  let boats = '';
  for (let j = 0, n = 0; j < 400 && n < 9; j++) {
    const x = 20 + R() * (W - 40), y = 40 + R() * (H - 80);
    if (onAnyIsland(x, y, 40)) continue;
    const s = R() > 0.5 ? 1 : -1;
    boats += `<g class="boat" style="--d:${f(R() * 3)}s" transform="translate(${f(x)} ${f(y)}) scale(${s} 1)"><path d="M-12 8q-4 0 0 0" class="wake"/><path d="M-14 4c4 0 8 0 12 0" class="wake"/><path d="M-9 0h18l-4 6H-5z" class="hull"/><path d="M0 0v-16l9 13z" class="sail"/><path d="M-1 -1v-12l-6 11z" class="sail2"/></g>`;
    n++;
  }
  // drifting clouds over the water
  let clouds = '';
  for (let j = 0; j < 7; j++) {
    const y = 60 + (j / 7) * (H - 120) + R() * 60, x = R() * W, s = 0.7 + R() * 0.6;
    clouds += `<g class="cloud" style="--d:${f(40 + R() * 40)}s;--o:${f(-R() * 60)}s"><g transform="translate(${f(x)} ${f(y)}) scale(${f(s)})"><ellipse cx="4" cy="30" rx="34" ry="8" class="cloud-sh"/><path d="M-30 8a12 12 0 0 1 10-16a16 16 0 0 1 28-6a13 13 0 0 1 22 10a9 9 0 0 1-2 12z" class="cloud-b"/></g></g>`;
  }

  items.sort((a, b) => a[0] - b[0]);
  const route = `<path class="route-bed" d="${routeD}"/><path class="route" d="${routeD}"/>`;
  return defs + sea + boats + land + route + items.map((i) => i[1]).join('') + fog + clouds;
}
