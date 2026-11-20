// Control assists — training wheels that make the *mechanics* easier and leave every rule decision
// to the player. They come off as the levels go up:
//   Beginner / Rule school: AUTOPILOT HEIGHT — the tip cruises at a safe height; press grab over an
//     object and it dives, grabs and climbs back; drop targets (pegs) gently pull you in line;
//     steady hands (a speed cap); Triangle: press grab near the loop to thread the hook, press again
//     to set it down.
//   Intermediate: HEIGHT MAGNET — near an object the tip eases to grabbing height. Miss hints.
//   Advanced: miss hints only.   Expert: nothing.
// Rules still apply in full: bumping the cup, dropping off the peg, dragging, shaking, wrong order…
import * as THREE from 'three';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const hd = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

export function assistLevel(level, mode) {
  if (mode === 'SCHOOL' || level === 'BEGINNER') return 'autopilot';
  if (level === 'INTERMEDIATE') return 'magnet';
  if (level === 'ADVANCED') return 'hints';
  return 'off';
}
export const ASSIST_LABEL = { autopilot: 'Autopilot height', magnet: 'Height magnet', hints: 'Miss hints', off: null };

export class Assist {
  /** say(text): show a short tip; device(): 'mouse' | 'touch' | 'keys' */
  constructor(drill, level, mode, { say, device, activeIndex, tap = () => false, clearGrip = () => {} }) {
    this.tap = tap; this.clearGrip = clearGrip; this.drill = drill; this.kind = assistLevel(level, mode); this.say = say; this.device = device; this.activeIndex = activeIndex;
    this.s = drill.tools.map(() => ({ mode: 'idle', was: false, t: 0, manual: 0, tgt: null, path: null }));
    this.on = this.kind !== 'off' && typeof drill.assistInfo === 'function';
  }
  reset() { this.s.forEach((s) => Object.assign(s, { mode: 'idle', was: false, t: 0, manual: 0, tgt: null, path: null })); }
  downWord() { const d = this.device(); return d === 'touch' ? 'slide DOWN' : 'push in with W'; }

  /** Edit this frame's inputs (and the active tool's target) before the drill runs. */
  apply(inputs, dt) {
    if (!this.on) return;
    const i = this.activeIndex(), t = this.drill.tools[i], inp = inputs[i];
    if (!t || !inp || t.frozen) return;
    const info = this.drill.assistInfo(i); if (!info) return;
    const s = this.s[i], g = !!inp.grip, press = g && !s.was, changed = g !== s.was; s.was = g;
    s.t += dt;
    if (inp.abs) s.lastAbs = inp.abs.clone();
    // after an automatic move the pointer is somewhere else: blend back to it instead of snapping
    if (s.off && inp.abs) { inp.abs = inp.abs.clone().add(s.off); s.off.multiplyScalar(1 - Math.min(1, dt * 0.9)); if (s.off.lengthSq() < 1e-4) s.off = null; }
    // keyboard / gamepad players steer depth themselves (sphere + in/out), so autopilot leaves height alone
    const keys = this.device() === 'keys' || this.device() === 'gamepad';
    if (keys || inp.insert || inp.height || inp.heightStep || inp.heightAbs != null) s.manual = 1.5; else s.manual = Math.max(0, s.manual - dt);
    if (info.kind === 'hook') return this.hook(t, inp, info, s, this.tap() ? changed : press, dt); // tap mode: every click is an action
    const near = (pos, r = 0.6) => { let best = null, bd = r; for (const o of info.targets) { const d = hd(o.pos, pos); if (d < bd) { bd = d; best = o; } } return best; };

    if (this.kind === 'autopilot') {
      this.steady(t, inp, dt, info);
      if (!info.holding) {
        if (press) {
          const o = near(t.tip);
          if (o) { s.mode = 'dive'; s.tgt = o; s.t = 0; } else { s.mode = 'plain'; this.say(info.moveOver || 'Move over it first, then grab'); }
        }
        if (s.mode === 'dive') {
          // the jaws close the instant you press grab (the grip passes straight through); if the tip
          // isn't down at the object yet, it dives there fast and the jaws catch it on arrival
          if (!g) { s.mode = 'rise'; return this.cruise(t, info, dt, s); }
          const o = s.tgt, p = o.pos;
          const close = Math.abs(t.tip.y - o.y) < 0.12 && hd(t.tip, p) < 0.2;
          if (!close) {
            this.freeze(inp);
            t.target.x += (p.x - t.target.x) * Math.min(1, dt * 14); t.target.z += (p.z - t.target.z) * Math.min(1, dt * 14);
            t.target.y += Math.sign(o.y - t.target.y) * Math.min(Math.abs(o.y - t.target.y), dt * 9);
          }
          if (s.t > 1.0) { s.mode = 'rise'; this.clearGrip(i); this.say('Missed — try again right over it'); }
          return;
        }
        if (s.mode === 'plain' && !g) s.mode = 'idle';
        if (s.mode !== 'plain') this.cruise(t, info, dt, s);
      } else {
        if (s.mode !== 'carry') this.anchor(t, s);
        s.mode = 'carry';
        // drop targets pull you into line and hold you at a safe height above them
        let dropY = null;
        for (const d of info.drops || []) {
          const dist = hd(t.target, d);
          if (dist < d.r) {
            if (d.pull !== false) {
              const k = Math.min(1, dt * 3.2) * (1 - dist / d.r);
              t.target.x += (d.x - t.target.x) * k; t.target.z += (d.z - t.target.z) * k;
            }
            if (d.y != null) dropY = d.y;
          }
        }
        if (s.manual <= 0) { const y = dropY ?? info.cruise; t.target.y += (y - t.target.y) * Math.min(1, dt * 3); }
      }
      return;
    }
    // magnet + hints: manual height, with help near objects and a coach for missed grabs
    if (!info.holding) {
      const o = near(t.tip, 0.32);
      if (this.kind === 'magnet' && o && t.target.y < o.y + 0.4 && s.manual <= 0.2) t.target.y += (o.y - t.target.y) * Math.min(1, dt * 3);
      if (press) { s.mode = 'try'; s.t = 0; }
      if (s.mode === 'try' && s.t > 0.45) {
        s.mode = 'idle';
        if (!this.drill.assistInfo(i)?.holding) {
          const o2 = near(t.tip, 1.2);
          if (!o2) this.say(info.moveOver || 'Move over it first');
          else if (hd(o2.pos, t.tip) > 0.22) this.say('Line up right over it — watch the shadow');
          else if (t.tip.y - o2.y > 0.09) this.say(`Too high — ${this.downWord()} a little`);
          else if (t.tip.y - o2.y < -0.07) this.say('Too low — come up a little');
          else this.say('Close the jaws around it — hold grab');
        }
      }
    } else s.mode = 'idle';
  }
  /** Beginner: a speed cap so the instrument moves steadily (fewer bumps and earthquakes). */
  steady(t, inp, dt, info) {
    if (!inp.abs) return;
    const max = (info.hooked ? 1.3 : info.holding ? 3.2 : 4.5) * dt, dx = inp.abs.x - t.target.x, dz = inp.abs.z - t.target.z, d = Math.hypot(dx, dz);
    if (d > max) { inp.abs = inp.abs.clone(); inp.abs.x = t.target.x + (dx / d) * max; inp.abs.z = t.target.z + (dz / d) * max; }
  }
  freeze(inp) { delete inp.abs; delete inp.delta; inp.mx = 0; inp.my = 0; inp.orbit = null; inp.insert = 0; }
  /** remember how far the tool now is from the pointer, to glide back smoothly */
  anchor(t, s) { if (s.lastAbs) { s.off = t.target.clone().sub(s.lastAbs); s.off.y = 0; } }
  cruise(t, info, dt, s) {
    if (s.manual > 0) return;
    t.target.y += (info.cruise - t.target.y) * Math.min(1, dt * 2.6);
    if (s.mode === 'rise' && Math.abs(t.target.y - info.cruise) < 0.05) s.mode = 'idle';
  }

  /** Triangle: press grab near the loop → thread the hook through and lift; press again → set it down. */
  hook(t, inp, info, s, press, dt) {
    const run = (pts, speed) => { s.path = pts; s.speed = speed; };
    if (this.kind !== 'autopilot') return;
    this.steady(t, inp, dt, { holding: info.joint, hooked: info.joint });
    if (press && !s.path) {
      if (!info.joint) {
        const { c, n } = info.loop, off = info.off;
        if (hd(t.tip, c) > 1.1) { this.say('Fly over to the triangle first'); }
        else {
          const nn = n.clone().setY(0).normalize(); if (nn.dot(t.tip.clone().sub(c).setY(0)) < 0) nn.negate();
          const a = c.clone().addScaledVector(nn, 0.45).add(V(0, 0.05, 0)).sub(off), b = c.clone().addScaledVector(nn, -0.07).sub(off);
          run([a, b, b.clone().add(V(0, 0.45, 0))], 1.5); s.mode = 'thread';
        }
      } else { // set down where you are (outside the circle still counts as a mistake)
        // lower until it rests, slide the hook back out of the loop, then climb
        const p = t.target.clone(), { c, n } = info.loop; const nn = n.clone().setY(0).normalize(); if (nn.dot(t.tip.clone().sub(c).setY(0)) < 0) nn.negate();
        const low = p.clone().setY(info.rest - 0.12), out = low.clone().addScaledVector(nn, 0.5);
        run([p.clone().setY(info.rest), low, out, out.clone().setY(info.cruise)], 0.9); s.mode = 'setdown';
      }
    }
    if (s.path) {
      this.freeze(inp);
      const w = s.path[0], d = w.clone().sub(t.target), L = d.length(), step = s.speed * dt;
      if (L <= step) { t.target.copy(w); s.path.shift(); } else t.target.addScaledVector(d, step / L);
      if (s.mode === 'thread' && info.joint && s.path.length <= 1) { s.path = [t.target.clone().setY(info.cruise)]; s.mode = 'lift'; }
      if (!s.path.length) { s.path = null; this.anchor(t, s); if (s.mode === 'thread' && !info.joint) this.say('Not hooked — line the hook up with the hole and press grab again'); s.mode = 'idle'; }
      return;
    }
    if (info.joint) { // carrying: hold a safe height, pull into the landing circle
      const d = info.drops[0], dist = hd(t.target, d);
      if (dist < d.r) { const k = Math.min(1, dt * 2.5) * (1 - dist / d.r); t.target.x += (d.x - t.target.x) * k; t.target.z += (d.z - t.target.z) * k; }
      if (s.manual <= 0) t.target.y += (info.cruise - t.target.y) * Math.min(1, dt * 2);
    } else if (s.manual <= 0) t.target.y += (info.cruise - 0.35 - t.target.y) * Math.min(1, dt * 2);
  }
}
