// Coaching hints — never moves the instrument for you. When a grab misses, a short tip says why
// (not lined up, too high, too low). On from Beginner to Advanced (and Rule school); Expert: nothing.
// Rules still apply in full: bumping the cup, dropping off the peg, dragging, shaking, wrong order…

const hd = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

export function assistLevel(level, mode) {
  if (mode === 'SCHOOL' || level !== 'EXPERT') return 'hints';
  return 'off';
}
export const ASSIST_LABEL = { hints: 'Miss hints', off: null };

export class Assist {
  /** say(text): show a short tip; device(): 'touch' | 'keys' | 'gamepad' */
  constructor(drill, level, mode, { say, device, activeIndex }) {
    this.drill = drill; this.kind = assistLevel(level, mode); this.say = say; this.device = device; this.activeIndex = activeIndex;
    this.s = drill.tools.map(() => ({ mode: 'idle', was: false, t: 0 }));
    this.on = this.kind !== 'off' && typeof drill.assistInfo === 'function';
  }
  reset() { this.s.forEach((s) => Object.assign(s, { mode: 'idle', was: false, t: 0 })); }
  downWord() { return this.device() === 'touch' ? 'slide DOWN' : 'push in with W'; }

  /** Watch this frame's grip; it reads inputs but never changes them. */
  apply(inputs, dt) {
    if (!this.on) return;
    const i = this.activeIndex(), t = this.drill.tools[i], inp = inputs[i];
    if (!t || !inp || t.frozen) return;
    const info = this.drill.assistInfo(i); if (!info || info.kind === 'hook') return;
    const s = this.s[i], g = !!inp.grip, press = g && !s.was; s.was = g;
    s.t += dt;
    if (info.holding) { s.mode = 'idle'; return; }
    if (press) { s.mode = 'try'; s.t = 0; }
    if (s.mode !== 'try' || s.t < 0.45) return;
    s.mode = 'idle';
    if (this.drill.assistInfo(i)?.holding) return;
    let o = null, bd = 1.2;
    for (const x of info.targets) { const d = hd(x.pos, t.tip); if (d < bd) { bd = d; o = x; } }
    if (!o) this.say(info.moveOver || 'Move over it first');
    else if (bd > 0.22) this.say('Line up right over it — watch the shadow');
    else if (t.tip.y - o.y > 0.09) this.say(`Too high — ${this.downWord()} a little`);
    else if (t.tip.y - o.y < -0.07) this.say('Too low — come up a little');
    else this.say('Close the jaws around it');
  }
}
