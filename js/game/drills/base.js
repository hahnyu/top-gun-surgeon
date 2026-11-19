import { THREE, makePlate } from '../engine.js';
import { plateMap } from '../themes.js';

export const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const rand = (a, b) => a + Math.random() * (b - a);

/**
 * Shared drill plumbing. ctx: {root, level, hand, mode, env, inst, preview, emit}
 * Subclasses build their scene in build(); tools are created only when not in preview.
 */
export class BaseDrill {
  constructor(ctx) {
    this.ctx = ctx;
    this.root = ctx.root;
    this.level = ctx.level || 'BEGINNER';
    this.hand = ctx.hand || 'RIGHT';
    this.m = this.hand === 'LEFT' ? -1 : 1;
    this.env = ctx.env; this.instTheme = ctx.inst;
    this.preview = !!ctx.preview;
    this.tools = [];
    this.errors = 0; this.misses = 0; this.success = 0; this.target = 1;
    this._errCool = 0; this.complete = false; this.started = false;
    this.t = 0;
  }
  emit(type, data) { this.ctx.emit?.(type, data); }
  plate(opts = {}) {
    const p = this.env?.plate || {};
    const map = p.map ? plateMap(p.map) : null;
    return makePlate(this.root, { color: map ? 0xffffff : p.color, metal: p.metal, rough: p.rough, transparent: p.transparent, opacity: p.opacity, map, ...opts });
  }
  error(reason, { cooldown = 1, force = false, pos = null, tool = null } = {}) {
    if (this.complete) return false;
    if (!force && this._errCool > 0) return false;
    this._errCool = cooldown;
    this.errors++;
    const t = tool || this.tools.find((x) => x.contact) || this.tools[0];
    const at = (pos || t?.tip)?.clone?.() || null;
    this.emit('error', { reason, pos: at, surf: at && t ? t.floor(at.x, at.z) : 0 });
    return true;
  }
  /** One error per touch (like the Top Gun electronic proctor's buzzer), not one per second of contact. */
  touchError(tool, touching, reason) {
    if (touching && !tool._touching && this.started && !this.complete) this.error(reason, { force: true, tool });
    tool._touching = touching;
  }
  tick(dt) { this._errCool = Math.max(0, this._errCool - dt); this.t += dt; }
  get tips() { return this.tools.map((t) => t.tip); }
  hud() { return { errors: this.errors, reps: this.success, target: this.target }; }
  final() { return { errors: this.errors, misses: this.misses, success: this.success, target: this.target }; }
  /** Optional: status text for the bottom bar. */
  status() { return null; }
  /** Per tool: {pos, ok, size} for the grab reticle, or null. */
  hints() { return []; }
  /** Per tool: clearance of the jaw tips above the surface (for the altimeter). */
  clearances() { return this.tools.map((t) => { const low = t.inst.lowOffset ? t.inst.lowOffset(t) : 0; return Math.max(0, t.tip.y + low - t.floor(t.tip.x, t.tip.z)); }); }
}
