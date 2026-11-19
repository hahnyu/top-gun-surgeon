// Play-testing bot: plays a drill through the same pointer-style input a mouse uses, with human
// imperfections (limited hand speed, wobble, misjudged depth, retries). Used to measure difficulty.
// Load in the browser console on a drill page: await import('/tools/kidbot.js').then(m => m.play(skill))
const rnd = (s) => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return s * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };

export async function play({ skill = 'kid', maxTime = 300 } = {}) {
  const g = window.__tg, d = g.drill;
  const S = skill === 'kid' ? { speed: 1.6, wobble: 0.025, depthErr: 0.07, aimErr: 0.06, pause: 0.45 } : { speed: 2.4, wobble: 0.012, depthErr: 0.03, aimErr: 0.03, pause: 0.25 };
  const V3 = d.tools[0].tip.constructor;
  let T = 0; const dt = 1 / 60; const grips = d.tools.map(() => false);
  const prev = d.tools.map(() => false);
  const holding = (t) => !!(t.holding || (t.node !== undefined && t.node >= 0) || t.hold || t.solid?.held);
  const legacy = !(d.solid || d.physicsGrip);
  const step = () => {
    const inputs = d.tools.map((t, i) => {
      const inp = { grip: grips[i] };
      if (legacy) { // same press/release → grab translation the session does for older drills
        if (grips[i] && !prev[i] && !holding(t)) inp.grab = true;
        else if (!grips[i] && prev[i]) { if (holding(t)) inp.grab = true; else t.jawT = t.jaw0 ?? 0.6; }
        prev[i] = grips[i];
      }
      return inp;
    });
    d.update(dt, inputs, {}); T += dt;
    d.tools.forEach((t, i) => { if (grips[i] && !holding(t) && t._botHeld) grips[i] = false; t._botHeld = holding(t); });
  };
  const wait = (s) => { for (let i = 0; i < s / dt; i++) step(); };
  // move the instrument's target like a hand on a mouse/finger: capped speed, wobble, ease-out
  const moveTo = (t, goal, extraSlow = 1) => {
    const g2 = goal.clone();
    let best = Infinity, stall = 0;
    for (let i = 0; i < 600; i++) {
      const d2 = g2.clone().sub(t.target); const dist = d2.length();
      if (dist < 0.01) break;
      if (dist < best - 0.005) { best = dist; stall = 0; } else if (++stall > 30) break; // blocked: a person stops pushing
      const v = Math.min(S.speed / extraSlow, dist * 6) * dt;
      t.target.add(d2.setLength(Math.min(v, dist)));
      t.target.x += rnd(S.wobble) * dt * 10; t.target.z += rnd(S.wobble) * dt * 10;
      step();
    }
    wait(S.pause);
  };
  const res = { drill: d.constructor.name, level: d.level, attempts: 0, fails: 0, reasons: {} };
  const oe = d.ctx.emit; d.ctx.emit = (ty, x) => { if (ty === 'grab') (res.grabT = res.grabT || []).push(+T.toFixed(1)); if (ty === 'error') { res.reasons[x?.reason] = (res.reasons[x?.reason] || 0) + 1; (res.errT = res.errT || []).push(`${T.toFixed(1)} ${x?.reason} reps=${d.success}`); } oe?.(ty, x); };
  d.started = true;
  try {
    if (d.constructor.name === 'PeaDrill') {
      const t = d.tools[0];
      while (!d.complete && T < maxTime) {
        const p = d.peas.find((q) => q.state === 'ring'); if (!p) { wait(0.5); continue; }
        let held = false;
        for (let a = 0; a < 4 && !held; a++) {
          res.attempts++;
          const pp = p.mesh.position.clone();
          moveTo(t, pp.clone().setY(0.5).add(new V3(rnd(S.aimErr), 0, rnd(S.aimErr))));
          moveTo(t, new V3(pp.x + rnd(S.aimErr), Math.max(0.03, pp.y + rnd(S.depthErr)), pp.z + rnd(S.aimErr)), 2);
          grips[0] = true; wait(0.5); held = !!d.held;
          if (!held) { grips[0] = false; wait(0.2); res.fails++; moveTo(t, t.target.clone().setY(0.5)); }
        }
        if (!held) continue;
        moveTo(t, t.target.clone().setY(1.1));
        const c = d.cupC.clone();
        moveTo(t, new V3(c.x + rnd(S.aimErr), 1.1, c.z + rnd(S.aimErr)));
        if (d.slide) { // moving cup: follow it with reaction lag while lowering, drop when lined up
          const lag = 0.35 / S.speed, yGoal = 0.7 + 0.16 + rnd(S.depthErr);
          for (let k = 0; k < 600; k++) {
            const ax = d.cupC.x + rnd(S.aimErr) * 0.3;
            t.target.x += Math.max(-S.speed * dt, Math.min(S.speed * dt, (ax - t.target.x))) * (1 - lag);
            t.target.y = Math.max(yGoal, t.target.y - 0.5 * dt * S.speed);
            step();
            if (t.target.y <= yGoal + 0.001 && Math.abs(t.tip.x - d.cupC.x) < 0.12) break;
          }
        } else moveTo(t, new V3(t.target.x, 0.7 + 0.16 + rnd(S.depthErr), t.target.z), 2);
        grips[0] = false; wait(1.0);
      }
    } else if (d.constructor.name === 'TriangleDrill') {
      const t = d.tools[0];
      while (!d.complete && T < maxTime) {
        wait(0.6);
        const off = t.world(t.inst.catchLocal).clone().sub(t.tip);
        let ok = false;
        for (let a = 0; a < 4 && !ok; a++) {
          res.attempts++;
          const { c, n } = d.loopWorld(); const nn = n.clone().setY(0).normalize();
          if (nn.dot(t.tip.clone().sub(c).setY(0)) < 0) nn.negate(); // come from the tool's side of the hole
          moveTo(t, c.clone().addScaledVector(nn, 0.5).add(new V3(rnd(S.aimErr), 0.05, rnd(S.aimErr))).sub(off));
          moveTo(t, c.clone().addScaledVector(nn, -0.06).add(new V3(rnd(S.aimErr), rnd(S.depthErr), rnd(S.aimErr))).sub(off), 2);
          moveTo(t, t.target.clone().add(new V3(0, 0.35, 0)), 2);
          ok = !!d.joint; if (!ok) { res.fails++; moveTo(t, t.target.clone().add(new V3(0, 0.3, 0)).addScaledVector(d.loopWorld().n.clone().setY(0).normalize(), 0)); moveTo(t, d.loopWorld().c.clone().add(new V3(0, 0.6, 0.6))); }
        }
        if (!ok) continue;
        moveTo(t, t.target.clone().setY(1.3), 1.5);
        moveTo(t, d.tgt.clone().setY(1.3).add(new V3(rnd(S.aimErr * 2), 0, 0.25 + rnd(S.aimErr * 2))), 1.6);
        wait(0.8);
        moveTo(t, t.target.clone().setY(0.5), 2); wait(0.4);
        moveTo(t, t.target.clone().add(new V3(0, 0, 0.4)), 2); moveTo(t, t.target.clone().setY(1.2)); wait(0.8);
      }
    } else if (d.constructor.name === 'CylinderDrill') {
      while (!d.complete && T < maxTime) {
        const st = d.step, c = d.cyls[st.cyl], pi = st.pick === 'L' ? 0 : 1, pk = d.tools[pi], rv = d.tools[1 - pi];
        const grab = (t, i, wing) => {
          for (let a = 0; a < 4; a++) {
            res.attempts++;
            const w = d.wingWorld(c)[wing];
            moveTo(t, w.clone().setY(w.y + 0.4).add(new V3(rnd(S.aimErr), 0, rnd(S.aimErr))));
            moveTo(t, w.clone().add(new V3(rnd(S.aimErr), rnd(S.depthErr), rnd(S.aimErr))), 2);
            grips[i] = true; wait(0.5); if (t.solid.held === c) return true;
            grips[i] = false; res.fails++; wait(0.2);
          }
          return false;
        };
        if (d.phase === 'pickup') { if (!grab(pk, pi, pi === 0 ? 0 : 1)) continue; }
        moveTo(pk, pk.target.clone().setY(1.6)); moveTo(pk, new V3(pi === 0 ? 0.4 : -0.4, 1.6, 0.8));
        if (d.phase !== 'transfer') continue;
        if (!grab(rv, 1 - pi, pi === 0 ? 1 : 0)) continue;
        moveTo(pk, pk.target.clone().add(new V3(pi === 0 ? -0.8 : 0.8, 0.2, 0)));
        const off = c.pos.clone().sub(rv.tip);
        moveTo(rv, st.to.clone().setY(1.25).sub(new V3(off.x, 0, off.z)).add(new V3(rnd(S.aimErr), 0, rnd(S.aimErr))), 1.5);
        grips[1 - pi] = false; wait(1.5); moveTo(rv, rv.target.clone().setY(1.3));
      }
    } else if (d.constructor.name === 'CobraDrill') {
      // a mouse player: controls only the hand the game makes active
      while (!d.complete && !d.failed && T < maxTime) {
        const i = d.autoIndex(); const t = d.tools[i]; const [eh, er] = d.expected;
        const nodes = []; for (let k = 0; k < d.f - 1; k++) if (d.region[k] === er) nodes.push(k);
        res.attempts++;
        if (!nodes.length) { wait(0.5); let k2 = 0; for (let k = 0; k < d.f - 1; k++) if (d.region[k] === er) k2++; if (!k2) { res.waits = (res.waits || 0) + 1; if (res.waits > 10) { res.stuck = `R${er} not reachable`; break; } continue; } else continue; }
        if (t.node >= 0) { grips[i] = false; wait(0.3); }
        const o = d.tools[1 - i], mine = nodes.filter((k) => (i === 0 ? d.P[k].x < o.tip.x - 0.15 : d.P[k].x > o.tip.x + 0.15));
        const pool = mine.length ? mine : nodes; const n = pool[Math.floor(pool.length / 2)];
        moveTo(t, d.P[n].clone().add(new V3(rnd(S.aimErr), rnd(S.depthErr), 0)));
        grips[i] = true; wait(0.4);
        if (!(t.node >= 0)) { grips[i] = false; res.fails++; }
        // pull the rope out with this hand toward the arrow
        if (t.node >= 0 && i === 0) moveTo(t, new V3(-2.4, 1.8, 1.7));
      }
    }
  } catch (e) { res.error = e.message; }
  Object.assign(res, { done: !!d.complete, time: +T.toFixed(1), reps: d.success, target: d.target, errors: d.errors, misses: d.misses, failed: !!d.failed });
  return res;
}

/**
 * Plays like a kid WITH the control assists: only points (the pointer moves at kid speed with wobble)
 * and clicks grab (tap mode). Never touches height — that's autopilot's job on Beginner.
 */
export async function playAssisted({ maxTime = 300 } = {}) {
  const g = window.__tg, d = g.drill, A = g.assist;
  const V3 = d.tools[0].tip.constructor;
  const S = { speed: 1.6, wobble: 0.03, aimErr: 0.06, pause: 0.45 };
  let T = 0; const dt = 1 / 60;
  const grip = d.tools.map(() => false);
  const ptr = d.tools.map((t) => t.target.clone());
  const act = () => (typeof d.activeIndex === 'function' ? d.activeIndex() : 0);
  const res = { drill: d.constructor.name, level: d.level, assisted: A.kind, clicks: 0, reasons: {} };
  const oe = d.ctx.emit; const tips = [];
  d.ctx.emit = (ty, x) => { if (ty === 'error') res.reasons[x?.reason] = (res.reasons[x?.reason] || 0) + 1; if (ty === 'tip') tips.push(x?.text); oe?.(ty, x); };
  const sayOrig = A.say; A.say = (t) => { tips.push(t); };
  const step = () => {
    const a = act();
    const inputs = d.tools.map((t, i) => ({ grip: grip[i], ...(i === a ? { abs: ptr[i].clone() } : {}) }));
    A.apply(inputs, dt); d.update(dt, inputs, {}); T += dt;
  };
  const wait = (s) => { for (let i = 0; i < s / dt; i++) step(); };
  const point = (goal) => { // move the pointer (not the tool) toward a spot on the board
    const i = act(), p = ptr[i], gx = goal.x + (Math.random() - 0.5) * S.aimErr * 2, gz = goal.z + (Math.random() - 0.5) * S.aimErr * 2;
    for (let k = 0; k < 400; k++) {
      const dx = gx - p.x, dz = gz - p.z, dist = Math.hypot(dx, dz); if (dist < 0.02) break;
      const v = Math.min(S.speed, dist * 6) * dt; p.x += (dx / dist) * Math.min(v, dist) + (Math.random() - 0.5) * S.wobble * 0.3; p.z += (dz / dist) * Math.min(v, dist) + (Math.random() - 0.5) * S.wobble * 0.3;
      step();
    }
    wait(S.pause);
  };
  const click = () => { const i = act(); grip[i] = !grip[i]; res.clicks++; step(); };
  d.started = true;
  try {
    if (d.constructor.name === 'PeaDrill') {
      while (!d.complete && T < maxTime) {
        const p = d.peas.find((q) => q.state === 'ring'); if (!p) { wait(0.5); continue; }
        point(p.mesh.position); click(); wait(1.4);
        if (!d.solid.held) { if (grip[0]) click(); continue; }
        point(d.cupC); wait(0.6); click(); wait(1.0);
      }
    } else if (d.constructor.name === 'TriangleDrill') {
      while (!d.complete && T < maxTime) {
        wait(0.6);
        const { c, n } = d.loopWorld(); const nn = n.clone().setY(0).normalize(); if (nn.dot(d.tool.tip.clone().sub(c).setY(0)) < 0) nn.negate();
        point(c.clone().addScaledVector(nn, 0.5)); click(); wait(3.0);
        if (!d.joint) continue;
        point(d.tgt.clone().add(new V3(0, 0, 0.25))); wait(0.8); click(); wait(3.0);
      }
    } else if (d.constructor.name === 'CylinderDrill') {
      while (!d.complete && T < maxTime) {
        const st = d.step, c = d.cyls[st.cyl], i = act(), t = d.tools[i];
        if (d.phase === 'pickup' || d.phase === 'transfer') {
          const ws = d.wingWorld(c); const w = ws.reduce((a, b) => (Math.hypot(b.x - t.tip.x, b.z - t.tip.z) < Math.hypot(a.x - t.tip.x, a.z - t.tip.z) ? b : a));
          if (grip[i]) { grip[i] = false; }
          point(w); click(); wait(1.6);
          if (!t.solid.held) { if (grip[i]) click(); }
        } else if (d.phase === 'carry') { point(new V3(st.pick === 'L' ? 0.5 : -0.5, 0, 0.8)); wait(0.4); }
        else if (d.phase === 'place') { const off = c.pos.clone().sub(t.tip); point(new V3(st.to.x - off.x, 0, st.to.z - off.z)); wait(0.8); click(); wait(1.5); }
        else wait(0.3);
      }
    }
  } catch (e) { res.error = e.message + ' ' + (e.stack || '').split('\n')[1]; }
  A.say = sayOrig;
  Object.assign(res, { done: !!d.complete, time: +T.toFixed(1), reps: d.success, target: d.target ?? (d.peas ? 10 : undefined), errors: d.errors, misses: d.misses, tipsSeen: [...new Set(tips)].slice(0, 6) });
  return res;
}
