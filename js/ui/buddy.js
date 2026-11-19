// Scout, the flight-school buddy: a folded paper plane in pilot goggles and a scrub cap. Teaches
// the rules (lessons, rule cards, mistakes, quiz) and shares "Real surgeon" facts.
import { h, icon } from './dom.js';
import { sheet, btn } from './kit.js';
import { store } from '../store.js';
import { sfx, haptic, playSound } from '../audio.js';
import { RULES, QUIZ, rulePic, nextFact } from '../rules.js';
import { DRILL_NAMES } from '../progress.js';

const FACE = {
  happy: '<path class="o w" d="M53 60q7 6 14 0"/>',
  cheer: '<path class="fo tom" d="M52 58q8 11 16 0z"/>',
  oops: '<ellipse class="fo f3" cx="60" cy="61" rx="3.4" ry="4.2"/><path class="o" d="M45 37l7 2M68 33l6-3"/>',
  think: '<path class="o w" d="M54 61h11"/><path class="o" d="M67 33l7-1"/>',
};
/** Scout as an inline SVG. mood: happy | cheer | oops | think */
export function scout(mood = 'happy', { size = 72 } = {}) {
  const el = h('span', { class: 'scout', style: { width: size + 'px', height: size * 0.84 + 'px' } });
  el.innerHTML = `<svg viewBox="0 0 120 100" aria-hidden="true">
    <path class="fo paper2" d="M54 72 112 20 64 92z"/>
    <path class="fo f3" d="M54 72 64 92 60 72z"/>
    <path class="fo paper" d="M6 58 112 20 54 72z"/>
    <path class="o" d="M54 72 112 20"/>
    <path class="fo mint" d="M30 40c4-14 26-20 38-12l-6 7c-8-4-22-2-28 9z"/>
    <path class="o" d="M38 33c6-5 16-7 24-4"/>
    <path class="o w" d="M36 46 82 30"/>
    <circle class="fo sky" cx="50" cy="45" r="8.5"/><circle class="fo sky" cx="70" cy="38" r="8.5"/>
    <circle class="f3 eye" cx="51.5" cy="45.5" r="3"/><circle class="f3 eye" cx="71.5" cy="38.5" r="3"/>
    <circle class="hl" cx="48" cy="42" r="1.8"/><circle class="hl" cx="68" cy="35" r="1.8"/>
    ${FACE[mood] || FACE.happy}
    <path class="o trail" d="M2 70h14M6 78h10"/>
  </svg>`;
  return el;
}

// ---------------------------------------------------------------- voice (optional, Settings)
let voice = null;
export function speak(text) {
  if (!store.settings.voice || !('speechSynthesis' in window)) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/[“”"]/g, ''));
    voice = voice || speechSynthesis.getVoices().find((v) => /en[-_](US|GB)/i.test(v.lang) && /female|samantha|karen|serena|google us/i.test(v.name)) || null;
    if (voice) u.voice = voice;
    u.rate = 1.04; u.pitch = 1.15; speechSynthesis.speak(u);
  } catch { /* no voice available */ }
}

/** In-drill buddy dock: Scout + a speech bubble. */
export function buddyDock() {
  const face = h('span', { class: 'bd-face' }, scout('happy', { size: 64 }));
  const text = h('div', { class: 'bd-text' });
  const extra = h('div', { class: 'bd-extra' });
  const el = h('div', { class: 'buddy-dock', role: 'status', 'aria-live': 'polite' }, face, h('div', { class: 'bd-bubble' }, text, extra));
  let last = '';
  return {
    el,
    say(t, mood = 'happy', { card = null, voice: v = true } = {}) {
      if (t === last && !card) return;
      last = t; face.innerHTML = ''; face.append(scout(mood, { size: 64 }));
      text.textContent = t; extra.innerHTML = '';
      if (card) extra.append(card);
      el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
      if (v) speak(t);
    },
    hide() { el.style.display = 'none'; },
  };
}

/** A rule card (picture + one sentence). opts: { small, locked, penalty } */
export function ruleCard(rule, { small = false, locked = false, penalty = true, n } = {}) {
  const el = h('div', { class: 'rule-card' + (small ? ' sm' : '') + (locked ? ' locked' : '') });
  el.innerHTML = locked ? `<svg class="rc-pic" viewBox="0 0 96 64"><text class="num q" x="48" y="44">?</text></svg>` : rulePic(rule.id);
  el.append(h('div', { class: 'rc-body' },
    h('div', { class: 'rc-n' }, `Rule ${n ?? rule.n ?? ''}`),
    h('div', { class: 'rc-t' }, locked ? 'Not learned yet' : rule.title),
    small ? null : h('div', { class: 'rc-x' }, locked ? 'Learn it in Rule school.' : rule.text),
    !small && !locked && penalty && rule.penalty ? h('div', { class: 'rc-p' }, icon('flag'), rule.penalty) : null));
  return el;
}

/** Mistakes teach: a short card over the scope naming the rule that was broken. */
export function ruleFlash(host, rule, reason) {
  host.querySelectorAll('.rule-flash').forEach((e) => e.remove());
  const el = h('div', { class: 'rule-flash', role: 'alert' }, scout('oops', { size: 54 }),
    h('div', { class: 'rf-in' }, h('div', { class: 'rf-k' }, `Oops! Rule ${rule.n}`), h('div', { class: 'rf-t' }, rule.title), h('div', { class: 'rf-r' }, reason)),
    h('span', { class: 'rf-pic', html: rulePic(rule.id) }));
  host.append(el);
  setTimeout(() => el.classList.add('out'), 2300);
  setTimeout(() => el.remove(), 2700);
}

/** The rule book: every drill's rules, learned ones shown, the rest as "?" cards. */
export function openRuleBook(startDrill = 'pea-drop', { onSchool } = {}) {
  const sh = sheet('Rule book', { cls: 'rulebook' });
  const ids = Object.keys(RULES);
  let cur = ids.includes(startDrill) ? startDrill : ids[0];
  const tabs = h('div', { class: 'rb-tabs' });
  const grid = h('div', { class: 'rb-grid' });
  const foot = h('div', { class: 'rb-foot' });
  const draw = () => {
    tabs.innerHTML = ''; grid.innerHTML = ''; foot.innerHTML = '';
    for (const id of ids) {
      const got = RULES[id].filter((r) => store.knowsRule(r.id)).length;
      tabs.append(h('button', { class: 'rb-tab' + (id === cur ? ' on' : ''), onclick: () => { cur = id; playSound('swipe', { volume: 0.45 }); draw(); } }, DRILL_NAMES[id], h('small', {}, `${got}/${RULES[id].length}`)));
    }
    RULES[cur].forEach((r, i) => grid.append(ruleCard(r, { n: i + 1, locked: !store.knowsRule(r.id) })));
    const sc = store.schoolFor(cur);
    foot.append(h('div', { class: 'rb-note' }, scout(sc?.done ? 'cheer' : 'think', { size: 44 }), h('span', {}, sc?.done ? `Rule school passed with ${sc.quiz}/3 quiz stars.` : 'Play Rule school to learn these rules by doing them.')),
      onSchool ? btn(sc?.done ? 'Replay Rule school' : 'Start Rule school', { kind: 'primary', iconName: 'flag', onClick: () => { sh.close(true); onSchool(cur); } }) : null);
  };
  draw();
  sh.body.append(tabs, grid, foot);
  return sh;
}

/** Three-question quiz after Rule school. Resolves with the number right. */
export function runQuiz(drillId) {
  return new Promise((resolve) => {
    const qs = QUIZ[drillId] || [];
    const sh = sheet('Rule quiz', { dismissable: false, cls: 'quiz' });
    let i = 0, right = 0;
    const stars = h('div', { class: 'qz-stars' }, qs.map(() => h('span', { class: 'qz-star' }, icon('star'))));
    const box = h('div', { class: 'qz-box' });
    sh.body.append(stars, box);
    const show = () => {
      box.innerHTML = '';
      if (i >= qs.length) {
        box.append(h('div', { class: 'qz-end' }, scout(right === qs.length ? 'cheer' : 'happy', { size: 96 }),
          h('div', { class: 'qz-q' }, right === qs.length ? 'Perfect! You know the rules.' : `${right} of ${qs.length} — nice work!`),
          h('p', { class: 't-dim' }, 'You can read every rule again in the Rule book.')),
          btn('Continue', { kind: 'primary', size: 'lg', block: true, iconName: 'check', onClick: () => { sh.close(true); resolve(right); } }));
        speak(right === qs.length ? 'Perfect! You know the rules.' : 'Nice work!');
        return;
      }
      const q = qs[i];
      const opts = h('div', { class: 'qz-opts' });
      const say = h('div', { class: 'qz-say' }, scout('think', { size: 56 }), h('div', { class: 'qz-q' }, q.q));
      q.a.forEach((a, k) => opts.append(h('button', { class: 'qz-opt', onclick: (e) => {
        if (opts.classList.contains('done')) return;
        opts.classList.add('done');
        const good = k === q.c;
        e.currentTarget.classList.add(good ? 'good' : 'bad');
        opts.children[q.c].classList.add('good');
        if (good) { right++; stars.children[i].classList.add('on'); sfx('chime', 2); haptic([15, 30, 15]); } else { sfx('scrape'); haptic(40); }
        say.innerHTML = ''; say.append(scout(good ? 'cheer' : 'oops', { size: 56 }), h('div', { class: 'qz-q' }, (good ? 'Yes! ' : 'Not quite. ') + q.why));
        speak((good ? 'Yes! ' : 'Not quite. ') + q.why);
        setTimeout(() => { i++; show(); }, good ? 1500 : 2600);
      } }, h('b', {}, 'ABC'[k]), a)));
      box.append(say, opts);
      speak(q.q);
    };
    show();
  });
}

/** "Real surgeon" fact card. Marks it seen. */
export function factCard() {
  const f = nextFact(store.data.facts || []);
  store.seeFact(f.id);
  return h('div', { class: 'fact-card' }, h('div', { class: 'fc-k' }, icon('user'), 'Real surgeon'), h('div', { class: 'fc-t' }, f.title), h('p', {}, f.text));
}
