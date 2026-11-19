// The rules of the Top Gun drills, as kids learn them: one picture + one sentence per rule,
// the official penalty from the Top Gun course, the in-game mistakes that break it, a guided
// lesson that teaches each rule by doing it, a quiz, and "Real surgeon" fact cards.

// ---------------------------------------------------------------- rule-card pictures (96×64)
// Same two-tone sticker language as the icon set: fo = fill + ink outline, f2 = second fill,
// f3 = solid ink, o = ink line, w = heavy line, plus named colour fills.
const grasper = (x, y, a = -35, open = 10) => `<g transform="translate(${x} ${y}) rotate(${a})"><rect class="fo steel" x="0" y="-3" width="46" height="6" rx="2"/><path class="fo steel" d="M0-2-14-${2 + open * 0.4}-13-${open * 0.15}z"/><path class="fo steel" d="M0 2-14 ${2 + open * 0.4}-13 ${open * 0.15}z"/><rect class="fo blk" x="12" y="-3.4" width="34" height="6.8" rx="2"/></g>`;
const hook = (x, y, a = -40) => `<g transform="translate(${x} ${y}) rotate(${a})"><rect class="fo blk" x="0" y="-3" width="44" height="6" rx="2"/><path class="o w" d="M0 0h-9a6 6 0 0 0 0 12h3"/></g>`;
const pea = (x, y, r = 5) => `<circle class="fo pea" cx="${x}" cy="${y}" r="${r}"/><circle class="hl" cx="${x - r * 0.35}" cy="${y - r * 0.35}" r="${r * 0.28}"/>`;
const cup = (x, y) => `<path class="fo dome" d="M${x - 20} ${y}c0-14 9-22 20-22s20 8 20 22z"/><ellipse class="fo f3" cx="${x}" cy="${y - 20}" rx="6" ry="2.4"/><path class="o" d="M${x - 24} ${y}h48"/>`;
const ok = (x, y) => `<g transform="translate(${x} ${y})"><circle class="fo mint" r="8"/><path class="o w" d="M-3.6 0l2.6 2.8 4.8-5.4"/></g>`;
const no = (x, y) => `<g transform="translate(${x} ${y})"><circle class="fo tom" r="8"/><path class="o w" d="M-3.2-3.2l6.4 6.4M3.2-3.2l-6.4 6.4"/></g>`;
const arrow = (d) => `<path class="o dash" d="${d}"/>`;
const tri = (x, y, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})"><path class="fo sun" d="M-14 8 0-14 14 8z"/><circle class="fo f2" cx="0" cy="-18" r="5"/><circle class="fo paper" cx="0" cy="-18" r="2.2"/></g>`;
const ring = (x, y, rx, cls = 'tgt') => `<ellipse class="fo ${cls}" cx="${x}" cy="${y}" rx="${rx}" ry="${rx * 0.34}"/>`;
const rope = (x0, y, n = 5, w = 12) => Array.from({ length: n }, (_, i) => `<rect class="fo ${i % 2 ? 'paper' : 'tom'}" x="${x0 + i * w}" y="${y - 4}" width="${w}" height="8" rx="${i === 0 || i === n - 1 ? 3 : 0}"/>`).join('');
const cyl = (x, y, cls = 'sky') => `<g transform="translate(${x} ${y})"><rect class="fo ${cls}" x="-6" y="-16" width="12" height="16" rx="2"/><path class="fo f3" d="M-10-12h4v4h-4zM6-12h4v4H6z"/></g>`;
const peg = (x, y) => `<rect class="fo steel" x="${x - 2}" y="${y - 14}" width="4" height="14"/><ellipse class="fo f3" cx="${x}" cy="${y}" rx="8" ry="2.6"/>`;
const line = (x) => `<path class="o dash" d="M${x} 6v54"/>`;
const shake = (x, y) => `<path class="o" d="M${x - 6} ${y - 6}l-4 3 4 3M${x + 6} ${y - 6}l4 3-4 3"/>`;
const num = (x, y, t) => `<text class="num" x="${x}" y="${y}">${t}</text>`;

export function rulePic(id) {
  const P = PICS[id] || '';
  return `<svg class="rc-pic" viewBox="0 0 96 64" aria-hidden="true">${P}</svg>`;
}
const PICS = {
  'pea-grab': `${pea(26, 46)}${pea(40, 50)}${pea(54, 47)}${grasper(30, 34, -32, 8)}${ok(80, 14)}`,
  'pea-drop': `${cup(48, 58)}${pea(48, 20)}${grasper(55, 10, -28, 14)}${arrow('M48 27v6')}${ok(84, 14)}`,
  'pea-touch': `${cup(44, 58)}${grasper(56, 34, -30, 4)}<path class="o w spark" d="M36 34l-4-4M34 40h-6M38 28l-1-6"/>${no(84, 14)}`,
  'pea-ten': `${cup(30, 58)}${pea(62, 50)}${pea(74, 50)}${pea(86, 50)}${pea(68, 40)}${pea(80, 40)}${num(70, 24, '×10')}`,
  'tri-hook': `${tri(36, 48)}${hook(48, 26, -30)}${ok(82, 14)}`,
  'tri-lift': `${tri(40, 36)}${hook(52, 14, -30)}${arrow('M40 60V46')}${ok(82, 50)}<path class="o" d="M10 60h76"/>`,
  'tri-drag': `${tri(54, 50)}${hook(66, 28, -30)}<path class="o dash" d="M14 58h26"/><path class="o" d="M6 60h84"/>${no(84, 14)}`,
  'tri-quake': `${tri(46, 44)}${hook(58, 22, -30)}${shake(46, 44)}${no(84, 14)}`,
  'tri-land': `${ring(26, 54, 16, 'sky')}${ring(72, 54, 16, 'tgt')}${tri(72, 46, 0.8)}${arrow('M30 40q20-26 38 0')}`,
  'tri-touch': `<path class="fo paper2" d="M6 50h84v10H6z"/>${hook(40, 40, -20)}<path class="o w spark" d="M30 48l-3-6M36 48l2-6"/>${no(84, 14)}`,
  'cobra-red': `${rope(8, 40, 7)}${grasper(26, 30, -40, 6)}${ok(84, 14)}`,
  'cobra-order': `${rope(8, 44, 7)}${num(14, 30, '1')}${num(38, 30, '2')}${num(62, 30, '3')}${ok(86, 14)}`,
  'cobra-turns': `${rope(8, 46, 7)}${grasper(20, 30, -50, 6)}<g transform="translate(96 0) scale(-1 1)">${grasper(36, 30, -50, 6)}</g>${arrow('M30 18q18-12 34 0')}`,
  'cobra-cross': `${grasper(30, 24, -150, 6)}<g transform="translate(96 0) scale(-1 1)">${grasper(30, 24, -150, 6)}</g>${no(48, 50)}`,
  'cobra-strikes': `${no(24, 32)}${no(48, 32)}${no(72, 32)}<text class="num sm" x="48" y="58">REDO</text>`,
  'cyl-pick': `${peg(26, 56)}${cyl(26, 40)}${grasper(36, 28, -40, 8)}${ok(82, 14)}`,
  'cyl-pass': `${line(48)}${cyl(48, 40)}${grasper(30, 34, -10, 6)}<g transform="translate(96 0) scale(-1 1)">${grasper(30, 34, -10, 6)}</g>`,
  'cyl-place': `${peg(70, 58)}${cyl(70, 34)}${arrow('M70 18v6')}${ok(84, 14)}${line(48)}`,
  'cyl-order': `${cyl(22, 50, 'sun')}${cyl(48, 50, 'sky')}${cyl(74, 50, 'mint')}${num(22, 22, '1')}${num(48, 22, '2')}${num(74, 22, '3')}`,
  'cyl-drop': `${line(48)}${cyl(40, 56, 'sky')}<path class="o w spark" d="M30 50l-4-3M50 50l4-3"/>${no(84, 14)}`,
};

// ---------------------------------------------------------------- rules
// match: substrings of the in-game mistake text that break this rule (lower case)
export const RULES = {
  'pea-drop': [
    { id: 'pea-grab', title: 'One grasper, one pea', text: 'Use your strong hand to pick up one pea at a time from the ring.', penalty: null, match: [] },
    { id: 'pea-drop', title: 'Drop it, don’t stuff it', text: 'Let go above the cup so the pea falls in. Pushing it in is called "putting".', penalty: 'Putting or stuffing the pea = 1 error (+5 s)', match: ['putting'] },
    { id: 'pea-touch', title: 'Don’t touch the cup', text: 'The cup is like a body part you must not bump. Every touch buzzes!', penalty: 'Each touch = 1 error (+5 s)', match: ['touched the cup'] },
    { id: 'pea-ten', title: 'Ten in the cup', text: 'Drop 10 peas in. A pea that rolls away is a miss — grab another.', penalty: 'Time stops on the 10th pea', match: ['miss'] },
  ],
  'triangle-transfer': [
    { id: 'tri-hook', title: 'Hook the loop', text: 'Slide the hook through the loop on top of the triangle.', penalty: null, match: [] },
    { id: 'tri-lift', title: 'Lift, then fly', text: 'Lift the triangle straight up before you move it across.', penalty: null, match: [] },
    { id: 'tri-drag', title: 'No dragging', text: 'Never slide the triangle along the board. Lift it!', penalty: 'Dragging = 1 error (+5 s)', match: ['dragging'] },
    { id: 'tri-quake', title: 'No earthquakes', text: 'Move smoothly. Shaking it off the hook is an "earthquake".', penalty: 'Earthquake = 1 error (+5 s)', match: ['earthquake'] },
    { id: 'tri-land', title: 'Launch circle to landing circle', text: 'It starts in the launch circle and must land inside the landing circle.', penalty: 'Landing outside or knocking it out = 1 error', match: ['launch circle', 'outside the target', 'fell off'] },
    { id: 'tri-touch', title: 'Hands off the board', text: 'Don’t bump the board with the hook.', penalty: 'Each touch = 1 error (+5 s)', match: ['touched the template'] },
  ],
  'cobra-rope': [
    { id: 'cobra-red', title: 'Grab the red bands', text: 'Only grab the rope on the red bands — they are the safe places to hold.', penalty: null, match: [] },
    { id: 'cobra-order', title: 'Every red, in order', text: 'Touch red 1, then 2, then 3… Skipping one is not allowed.', penalty: 'Skipping reds = 1 strike', match: ['skipping', 'wrong red'] },
    { id: 'cobra-turns', title: 'Take turns', text: 'Left, right, left, right — both hands do the work, like walking along the bowel.', penalty: 'Fireman’s pole (one hand only) = 1 strike', match: ['fireman'] },
    { id: 'cobra-cross', title: 'Don’t cross over', text: 'Keep each hand on its own side. Crossing the instruments isn’t allowed.', penalty: 'Crossing over = 1 strike', match: ['cross'] },
    { id: 'cobra-strikes', title: 'Three strikes, start again', text: 'Three wrong moves and the run starts over — just like the real course.', penalty: '3 strikes = redo', match: [] },
  ],
  'cylinder-transfer': [
    { id: 'cyl-pick', title: 'Lift it off the peg', text: 'Grab a wing and lift the cylinder straight up off its peg.', penalty: null, match: [] },
    { id: 'cyl-pass', title: 'Pass it in the air', text: 'Carry it over the centre line and pass it to your other hand — in mid-air.', penalty: 'Wrong hand = 1 error', match: ['wrong grasper'] },
    { id: 'cyl-place', title: 'Land it on the peg', text: 'Lower it onto the next peg on the other side.', penalty: 'Missing the peg = 1 error', match: ['missed the peg'] },
    { id: 'cyl-order', title: 'Follow the numbers', text: 'Move cylinder 1, then 2, then 3, there and back again.', penalty: 'Wrong cylinder = 1 error', match: ['wrong cylinder'] },
    { id: 'cyl-drop', title: 'Don’t drop it, don’t bump', text: 'Hold on until it’s on the peg, and keep the grasper off the board.', penalty: 'Dropping or touching = 1 error', match: ['dropped the cylinder', 'touched the board'] },
  ],
};
export const ALL_RULES = Object.entries(RULES).flatMap(([drill, rs]) => rs.map((r, i) => ({ ...r, drill, n: i + 1 })));
export function ruleFor(drillId, reason) {
  const t = String(reason || '').toLowerCase();
  return (RULES[drillId] || []).map((r, i) => ({ ...r, n: i + 1 })).find((r) => r.match.some((m) => t.includes(m))) || null;
}

// ---------------------------------------------------------------- lessons (rule school)
// Each step: what the buddy says, the rule it teaches, and when it's done (checked every frame).
// c = counters from drill events { grab, success, error }.
export const LESSONS = {
  'pea-drop': [
    { say: 'Hi, I’m Scout! This grasper is a real surgery tool. Move with the arrow keys (or drag a finger) — it follows you!', done: (d) => d.tools.some((t) => t.tip.distanceTo(t.start) > 1.2) },
    { say: 'Now stop over a pea and press GRAB. Autopilot dives down and grabs it for you.', rule: 'pea-grab', done: (d, c) => c.grab >= 1 },
    { say: 'Got it! Fly it over the cup — the cup pulls you into line.', done: (d) => !!d.held && Math.hypot(d.tool.tip.x - d.cupC.x, d.tool.tip.z - d.cupC.z) < 0.5 },
    { say: 'Press GRAB again to let go — drop it, don’t push it in!', rule: 'pea-drop', done: (d, c) => c.success >= 1 },
    { say: 'Nice! One more rule: never touch the cup. Drop two more without a bump!', rule: 'pea-touch', done: (d, c) => c.success >= 3 },
    { say: 'The real drill is 10 peas. A pea that rolls away is a miss.', rule: 'pea-ten', wait: 3.5 },
  ],
  'triangle-transfer': [
    { say: 'Hi, I’m Scout! This is a hook. Move with the arrow keys (or drag a finger) — it follows you!', done: (d) => d.tools.some((t) => t.tip.distanceTo(t.start) > 1.2) },
    { say: 'Fly next to the loop on top of the triangle and press GRAB — autopilot threads the hook through.', rule: 'tri-hook', done: (d) => !!d.joint },
    { say: 'Hooked! It lifts straight up — never drag it on the board.', rule: 'tri-lift', done: (d) => !!d.lifted },
    { say: 'Fly it smoothly over the landing circle and press GRAB to set it down. No shaking!', rule: 'tri-land', done: (d, c) => c.success >= 1 },
    { say: 'Super! Do one more — lift first, no dragging.', rule: 'tri-drag', done: (d, c) => c.success >= 2 },
    { say: 'Remember: shaking it off is an “earthquake”, and bumping the board counts too.', rule: 'tri-quake', wait: 3.5 },
  ],
  'cobra-rope': [
    { say: 'Hi, I’m Scout! The rope is like the bowel. Grab the first red band with your LEFT grasper.', rule: 'cobra-red', done: (d) => d.started },
    { say: 'Now the other hand grabs the next red band. Take turns!', rule: 'cobra-turns', done: (d) => d.k >= 2 },
    { say: 'Keep going: every red, in order. Don’t skip one!', rule: 'cobra-order', done: (d) => d.k >= 4 },
    { say: 'Keep each hand on its own side — no crossing over.', rule: 'cobra-cross', done: (d) => d.k >= 6 },
    { say: 'Three wrong moves and you start again. That’s the real rule!', rule: 'cobra-strikes', wait: 3.5 },
  ],
  'cylinder-transfer': [
    { say: 'Hi, I’m Scout! Move with the arrow keys (or drag a finger) — the glowing grasper follows you.', done: (d) => d.tools.some((t) => t.tip.distanceTo(t.start) > 1.2) },
    { say: 'Stop over a wing of cylinder 1 and press GRAB — autopilot picks it up off the peg.', rule: 'cyl-pick', done: (d) => d.phase !== 'pickup' },
    { say: 'Carry it over the dotted centre line.', done: (d) => d.phase === 'transfer' || d.phase === 'place' },
    { say: 'Now your other hand: move over the free wing and press GRAB — a mid-air pass!', rule: 'cyl-pass', done: (d) => d.phase === 'place' },
    { say: 'Fly to the glowing peg — it pulls you in — and press GRAB to let go.', rule: 'cyl-place', done: (d, c) => c.success >= 1 },
    { say: 'Follow the numbers: 1, 2, 3 — and don’t drop it or bump the board.', rule: 'cyl-order', wait: 2 },
    { say: 'Last rule: hold on until it’s on the peg.', rule: 'cyl-drop', wait: 3 },
  ],
};

// ---------------------------------------------------------------- quiz
export const QUIZ = {
  'pea-drop': [
    { q: 'How do you get the pea into the cup?', a: ['Push it in hard', 'Let go above the cup', 'Throw it'], c: 1, why: 'Drop it from above. Pushing it in is "putting".' },
    { q: 'What happens if you touch the cup?', a: ['It’s a bump (an error)', 'Nothing', 'You win a pea'], c: 0, why: 'Every touch is a bump — that’s +5 seconds in the real course.' },
    { q: 'How many peas go in the cup?', a: ['3', '10', '100'], c: 1, why: 'Ten peas, and time stops on the tenth.' },
  ],
  'triangle-transfer': [
    { q: 'How do you pick up the triangle?', a: ['Push it along', 'Hook the loop and lift', 'Grab a corner'], c: 1, why: 'Hook the loop, then lift straight up.' },
    { q: 'What is “dragging”?', a: ['Sliding it on the board', 'Lifting it high', 'Turning the hook'], c: 0, why: 'Sliding it along the board is dragging — always lift.' },
    { q: 'Where must the triangle land?', a: ['Anywhere', 'Back where it started', 'In the landing circle'], c: 2, why: 'From the launch circle to the landing circle.' },
  ],
  'cobra-rope': [
    { q: 'Where can you grab the rope?', a: ['Anywhere', 'Only the red bands', 'Only the white bits'], c: 1, why: 'Red bands only — they’re the safe places to hold.' },
    { q: 'What is the “fireman’s pole”?', a: ['Using only one hand', 'Going too fast', 'Grabbing white'], c: 0, why: 'Both hands must take turns — one hand only is the fireman’s pole.' },
    { q: 'How many strikes before you start over?', a: ['1', '3', '10'], c: 1, why: 'Three strikes and the run starts again.' },
  ],
  'cylinder-transfer': [
    { q: 'Where do you pass the cylinder to your other hand?', a: ['On the board', 'In mid-air', 'On the peg'], c: 1, why: 'The hand-off happens in mid-air, over the centre line.' },
    { q: 'What order do the cylinders go in?', a: ['Any order', 'Biggest first', '1, 2, 3'], c: 2, why: 'Follow the numbers: 1, then 2, then 3.' },
    { q: 'What if it misses the peg?', a: ['It’s a bump (an error)', 'Bonus points', 'Nothing'], c: 0, why: 'Missing the peg is a bump — line it up first.' },
  ],
};

// ---------------------------------------------------------------- "Real surgeon" facts
export const FACTS = [
  { id: 'keyhole', title: 'Keyhole surgery', text: 'Laparoscopic surgery happens through a few tiny cuts — some smaller than your fingernail — instead of one big opening.' },
  { id: 'camera', title: 'Eyes on the screen', text: 'Surgeons don’t look at their hands. A thin camera goes inside, and they operate by watching a TV screen — just like you!' },
  { id: 'gas', title: 'Making room', text: 'Before keyhole surgery, the belly is gently filled with gas like a balloon so there’s room to see and work.' },
  { id: 'fulcrum', title: 'The see-saw effect', text: 'Instruments pivot where they enter the body, so moving your hand left moves the tip right. Practice makes it feel normal.' },
  { id: 'depth', title: 'Seeing in 3D on a flat screen', text: 'The screen is flat, so surgeons judge depth from shadows and size. That’s why the shadow under your tip matters.' },
  { id: 'gamers', title: 'Gamers make good surgeons', text: 'Dr. James “Butch” Rosser, who created Top Gun, found that surgeons who played video games were faster and made fewer mistakes in these drills.' },
  { id: 'name', title: 'Why “Top Gun”?', text: 'The course is named after the Navy’s fighter-pilot school. Pilots and surgeons both train skills by practising drills over and over.' },
  { id: 'knots', title: 'Knots inside the body', text: 'Surgeons can tie knots inside a patient using two long instruments — that’s what the suturing drill trains.' },
  { id: 'recovery', title: 'Home sooner', text: 'Tiny cuts mean less pain and smaller scars, so patients often go home the same day or the next.' },
  { id: 'robots', title: 'Surgical robots', text: 'Some surgeons use robots with tiny wrists. The surgeon still controls every move — robots don’t operate on their own.' },
  { id: 'gallbladder', title: 'A common keyhole operation', text: 'Taking out a gallbladder is one of the most common keyhole operations in the world.' },
  { id: 'practice', title: 'Practice on a box first', text: 'Before operating on people, surgeons practise drills like these in a training box — exactly what you’re doing now.' },
];
export function nextFact(seen = []) { return FACTS.find((f) => !seen.includes(f.id)) || FACTS[Math.floor(Math.random() * FACTS.length)]; }
