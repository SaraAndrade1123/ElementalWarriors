// Rival CPU (puro, sin Three.js): usa exactamente las mismas entradas que un jugador (nada de daño extra ni lectura de botones).
// La dificultad (js/game/difficulty-config.js) cambia la CALIDAD de las decisiones: tiempo de reacción, acierto al bloquear
// alto/bajo, combos, antiaéreos, castigos, lanzamientos y uso de la Resonancia. Nunca reacciona antes de su retraso.
import { LEVELS, DEFAULT_LEVEL } from './difficulty-config.js';
export { LEVELS, LEVEL_IDS, DEFAULT_LEVEL } from './difficulty-config.js';
export const DIFFICULTY = LEVELS; // nombre de v0.6 (compatibilidad)
const BLANK = () => ({ x: 0, jump: false, down: false, guard: false, l: false, m: false, h: false, s: false, r: false });

export class CpuBrain {
  constructor(rng = Math.random, level = DEFAULT_LEVEL) { this.rng = rng; this.setLevel(level); this.reset(); }
  setLevel(level) { this.level = LEVELS[level] ? level : DEFAULT_LEVEL; this.cfg = this.P = LEVELS[this.level]; }
  reset() { this.plan = { type: 'approach', left: .4 }; this.cool = 0; this.seen = null; this.queue = []; this.wait = 0; this.react = 0; this.pending = null; this.bendCool = .6; }
  think(dt, me, foe) {
    const inp = BLANK(), r = this.rng, P = this.cfg, d = Math.abs(foe.x - me.x), dir = Math.sign(foe.x - me.x) || 1;
    this.plan.left -= dt; this.cool -= dt; this.react -= dt;
    if (me.ko) return inp;
    if (me.stunType === 'thrown') { if (r() < P.throwTech * dt * 12) { inp.l = inp.m = true; } return inp; }
    // bloqueo en guardia y repulsión
    if (me.stunType === 'block') { inp.guard = !P.noGuard; inp.down = this.plan.low; if (me.meter >= 50 && r() < P.meter * .02 && foe.act) inp.r = true; return inp; }
    if (me.stun > 0) return inp;
    // combo en curso: continúa la secuencia elegida cuando el golpe anterior conectó
    if (this.queue.length && me.act) {
      if (me.act.hits && this.wait <= 0) { const b = this.queue.shift(); Object.assign(inp, b); this.wait = .05; }
      this.wait -= dt; return inp;
    }
    if (!me.act) this.queue = [];
    // amenaza: el rival empieza un golpe → reaccionar (nunca antes de su retraso de reacción, y con fallos)
    const fa = foe.act, threat = fa && !fa.def.throw && fa.t < fa.def.startup + fa.def.active && d < (fa.def.range || 3) + 1.4;
    if (threat && fa !== this.seen) {
      this.seen = fa; this.react = P.reaction * (1 + r() * .5);
      this.pending = !P.noGuard && r() < P.block ? { type: 'guard', left: .45, low: fa.def.hit === 'low' ? r() < P.readLow + .2 : r() > .5 + P.readLow * .5 && fa.def.hit !== 'high' } : null;
    } else if (!fa) this.seen = null;
    if (this.pending && this.react <= 0 && !me.act) { this.plan = this.pending; this.pending = null; }
    // antiaéreo
    if (foe.air && !foe.launched && foe.vy < 2 && d < 2.6 && !me.act && !me.air && this.cool <= 0 && r() < P.antiair * .25) { inp.down = true; inp.h = true; this.cool = .5; this.queue = r() < P.chain ? [{ jump: true, x: dir }, { l: true }, { m: true }, { h: true }] : []; return inp; }
    // castigo: el rival está en recuperación cerca
    if (fa && fa.t > fa.def.startup + fa.def.active && d < 2.6 && !me.act && this.cool <= 0 && r() < P.punish * .2) return this.combo(inp, me, d);
    if (this.plan.left <= 0) this.choose(me, foe, d);
    const T = this.plan;
    switch (T.type) {
      case 'approach': inp.x = dir; break;
      case 'dash': inp.x = (T.left * 60 | 0) % 6 < 2 || (T.left * 60 | 0) % 6 > 3 ? dir : 0; break;
      case 'jump': inp.x = dir; inp.jump = !me.air; if (me.air && d < 2.2 && me.vy < 2) inp[r() < .5 ? 'm' : 'h'] = true; break;
      case 'retreat': inp.x = -dir; break;
      case 'guard': inp.guard = !P.noGuard; inp.down = !!T.low; break;
      case 'zone': if (this.cool <= 0) { inp.s = true; this.cool = .9; } else inp.guard = !P.noGuard; break;
      case 'throw': inp.x = dir; if (d < 1.4 && this.cool <= 0) { inp.l = inp.m = true; this.cool = .6; } break;
      case 'poke': if (this.cool <= 0 && d < 2.9) { const lo = r() < .4; inp.down = lo; inp.m = true; this.cool = .4 + r() * .3; } else inp.x = dir; break;
      case 'attack': if (this.cool <= 0 && d < 2.4) return this.combo(inp, me, d); inp.x = dir; break;
      case 'meter': if (me.meter >= 25) { inp.r = true; this.plan.left = 0; } break;
    }
    // el maniquí que nunca se protege: si aún mira hacia el otro lado (acaba de cruzar), moverse «hacia atrás» contaría como guardia
    if (P.noGuard && inp.x && Math.sign(inp.x) !== (me.facing || 1)) inp.x = 0;
    return inp;
  }
  combo(inp, me, d) {
    const r = this.rng, P = this.cfg, lo = r() < .35;
    this.cool = .35 + r() * .35;
    if (r() < P.chain) { // cadena completa con final de especial (o reforzado si hay barra)
      const end = me.meter >= 25 && r() < P.meter ? { r: true } : { s: true };
      this.queue = lo ? [{ down: true, m: true }, { down: true, h: true }, end] : [{ m: true }, { h: true }, end];
      Object.assign(inp, { l: true, down: lo });
    } else Object.assign(inp, r() < .5 ? { l: true } : { m: true, down: lo });
    return inp;
  }
  choose(me, foe, d) {
    const r = this.rng, p = r(), P = this.cfg, id = me.def.id, guard = P.noGuard ? 'approach' : 'guard';
    if (me.meter >= 25 && r() < P.meter * .15 && d < 3) { this.plan = { type: 'meter', left: .2 }; return; }
    if (d > 4.5) {
      if ((id === 'aqua' || id === 'terra') && p < .45) this.plan = { type: 'zone', left: .9 };
      else if (p < .25) this.plan = { type: 'dash', left: .5 };
      else if (p < .35) this.plan = { type: 'jump', left: .6 };
      else this.plan = { type: 'approach', left: .3 + r() * .4 };
    } else if (d > 2.4) {
      this.plan = p < .45 * P.aggression ? { type: 'poke', left: .5 } : p < .6 ? { type: 'approach', left: .3 } : p < .7 ? { type: 'jump', left: .6 } : p < .8 ? { type: guard, left: .4, low: r() < .5 } : { type: P.noGuard ? 'approach' : 'retreat', left: .3 }; // el maniquí que ataca nunca retrocede (retroceder = guardia)
    } else if (!P.noGuard && r() < (P.guardIdle || 0)) {
      this.plan = { type: 'guard', left: .3 + r() * .3, low: r() < P.readLow * .6 }; // se protege por anticipación (los niveles altos leen mejor alto/bajo)
    } else {
      this.plan = p < .5 * P.aggression ? { type: 'attack', left: .5 } : p < .62 ? { type: 'throw', left: .4 } : p < .78 ? { type: guard, left: .4, low: r() < .5 } : p < .9 ? { type: 'poke', left: .4 } : { type: P.noGuard ? 'attack' : 'retreat', left: .35 };
    }
  }
}

// Maniquí de entrenamiento: 'still' (quieto), 'guard' (guardia de pie), 'crouch' (guardia agachada), 'jump' (salta),
// 'attack' (solo ataca, para practicar la defensa) y 'cpu' (CPU del nivel elegido).
export const DUMMIES = ['still', 'guard', 'crouch', 'jump', 'attack', 'cpu'];
export function makeBrain(kind, rng = Math.random, level = DEFAULT_LEVEL) {
  switch (kind) {
    case 'guard': return { think: (dt, me, foe) => ({ ...BLANK(), guard: true, down: !!(foe?.act && (foe.act.def.hit === 'low' || foe.act.def.proj?.hit === 'low')) }), reset() {} }; // se protege y lee los golpes bajos
    case 'crouch': return { think: () => ({ ...BLANK(), guard: true, down: true }), reset() {} };
    case 'jump': return { think: (dt, me) => ({ ...BLANK(), jump: !me?.air }), reset() {} };
    case 'attack': return new CpuBrain(rng, 'dummy');
    case 'cpu': return new CpuBrain(rng, level);
    default: return null; // 'still'
  }
}
