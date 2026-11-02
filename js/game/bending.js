// CONTROL ELEMENTAL (lógica pura, sin Three.js ni DOM: se prueba con Node).
// Añade a cada guerrero 3 técnicas sin arma (data/bending.json) y las conecta con el combate SIN editar fighter.js:
//   · mergeBending(moves, data)  → copia de data/moves.json con las técnicas añadidas a cada guerrero.
//   · patchFighter(Fighter)       → nuevas entradas (→+U, ↓+U, U en el aire, ↓↙←+golpe, →↓↘+golpe); se cancelan como la especial.
//   · stepBending(match)          → reglas extra de los proyectiles: trayectoria diagonal (vy), ventana de golpe, muros y
//                                   desaparición al tocar el suelo. Se llama después de cada paso fijo de la simulación.
//   · patchCpu(CpuBrain)          → la IA usa las técnicas según la distancia y la dificultad (mismas entradas que un jugador).
export const BEND_IDS = ['eb', 'eu', 'ej'];
const SPECIAL = new Set(['s', 'ex', ...BEND_IDS]);
const LIGHT = new Set(['l', 'cl', 'jl']);
const CHAIN_MAX = 5; // igual que RULES.chainMax de fighter.js (se lee de RULES si está disponible)

// ── datos ──
export function mergeBending(moves, data) {
  if (!moves || !data) return moves;
  const out = { ...moves };
  for (const [id, set] of Object.entries(data)) {
    if (id.startsWith('_') || id === 'version' || id === 'inputs' || !set || typeof set !== 'object') continue;
    const cur = out[id] || {}, add = {};
    for (const k of BEND_IDS) if (set[k] && !cur[k]) add[k] = { ...set[k], ...(set[k].proj ? { proj: { ...set[k].proj } } : {}) };
    out[id] = { ...cur, ...add };
  }
  return out;
}
// Comprueba los datos (npm test). Devuelve la lista de problemas.
export function validateBending(data, roster = []) {
  const out = [], need = ['startup', 'active', 'recovery', 'hit'];
  for (const r of roster) {
    const set = data?.[r.id]; if (!set) { out.push(`${r.id}: sin técnicas de control elemental`); continue; }
    for (const k of BEND_IDS) {
      const m = set[k]; if (!m) { out.push(`${r.id}.${k}: falta`); continue; }
      for (const f of need) if (m[f] == null) out.push(`${r.id}.${k}: falta ${f}`);
      if (k === 'ej' && !m.air) out.push(`${r.id}.ej debe ser aérea ("air": true)`);
      if (k !== 'ej' && m.air) out.push(`${r.id}.${k} no puede ser aérea`);
      if (!m.proj && !(m.range > 0 && m.dmg > 0)) out.push(`${r.id}.${k}: no tiene proyectil ni caja de golpe`);
      if (m.proj) for (const f of ['speed', 'life', 'w', 'h', 'y', 'dmg', 'kind']) if (m.proj[f] == null) out.push(`${r.id}.${k}.proj: falta ${f}`);
    }
  }
  return out;
}

// ── entradas ──
// Dirección numérica relativa al rival (6 adelante, 4 atrás, 2 abajo…), como fighter.js.
const dirN = (inp, facing) => { const rx = (inp?.x || 0) * facing; return inp?.down ? (rx > 0 ? 3 : rx < 0 ? 1 : 2) : (rx > 0 ? 6 : rx < 0 ? 4 : 5); };
// ↓↙← (2-1-4): la diagonal es opcional; tiene que terminar en atrás.
export function motionQCB(hist) {
  if (!hist?.length || hist[hist.length - 1].n !== 4) return false;
  let st = 0; for (const e of hist) { if (e.n === 2 || e.n === 1) st = 1; else if (st && e.n === 4) return true; }
  return false;
}
// →↓↘ (6-2-3): termina en abajo-adelante (o abajo); si después vuelve a adelante es un ↓↘→ (especial normal).
export function motionDP(hist) {
  if (!hist?.length) return false; const last = hist[hist.length - 1].n; if (last !== 3 && last !== 2) return false;
  let st = 0; for (const e of hist) { if (e.n === 6) st = 1; else if (st >= 1 && (e.n === 2 || e.n === 1)) st = 2; else if (st === 2 && e.n === 3) return true; }
  return false;
}
// Qué técnica de control elemental pide la entrada actual (o null si ninguna).
export function chooseBending(f) {
  const M = f.moves || {}, inp = f.__inp || {}, n = dirN(inp, f.facing || 1), buf = f.buf || [], has = b => buf.some(e => e.b === b);
  if (has('s')) {
    if (f.air) return M.ej ? { id: 'ej', use: ['s'] } : null;
    if ((n === 1 || n === 2 || n === 3) && M.eu) return { id: 'eu', use: ['s'] };
    if (n === 6 && M.eb) return { id: 'eb', use: ['s'] };
    return null;
  }
  if (f.air) return null;
  const atk = buf.find(e => e.b === 'l' || e.b === 'm' || e.b === 'h'); if (!atk) return null;
  if (M.eu && motionDP(f.hist)) return { id: 'eu', use: [atk.b], motion: true };
  if (M.eb && motionQCB(f.hist)) return { id: 'eb', use: [atk.b], motion: true };
  return null;
}
// Mismas reglas de cancelación que fighter.js `_can`, tratando las técnicas elementales como especiales.
export function canBending(f, id, chainMax = CHAIN_MAX) {
  const d = f.moves?.[id]; if (!d) return false;
  if (!!d.air !== !!f.air) return false;
  if (f.landRec > 0 || f.bdash > 0) return false;
  const cur = f.act; if (!cur) return true;
  if (!cur.hits || cur.grab) return false;
  if (SPECIAL.has(cur.name) && cur.name !== 's') return false; // una técnica no se cancela en otra (salvo la especial normal si lo permite su lista)
  if (!(cur.def.cancel || []).includes('s') && !(cur.def.cancel || []).includes(id)) return false;
  if (f.chain >= chainMax - 1) return false;
  return (f.used || []).filter(u => u === id).length < (LIGHT.has(id) ? 2 : 1);
}

// Parchea Fighter.prototype (una sola vez). Si una versión futura cambia esos métodos, avisa y no rompe nada.
export function patchFighter(Fighter, RULES) {
  const P = Fighter?.prototype; if (!P || P.__bending) return !!P?.__bending;
  if (typeof P.update !== 'function' || typeof P._choose !== 'function' || typeof P._can !== 'function') { console.warn('[control elemental] Fighter no tiene update/_choose/_can: las entradas nuevas no se activan'); return false; }
  const update = P.update, choose = P._choose, can = P._can, chainMax = RULES?.chainMax ?? CHAIN_MAX;
  P.update = function (dt, inp, foe) { this.__inp = inp; return update.call(this, dt, inp, foe); };
  P._choose = function () { return chooseBending(this) || choose.call(this); };
  P._can = function (id) { return BEND_IDS.includes(id) ? canBending(this, id, chainMax) : can.call(this, id); };
  P.__bending = true;
  return true;
}

// ── reglas extra de proyectiles (se llama tras cada paso de la simulación) ──
export function stepBending(m, half = 8.2) {
  for (const p of m.proj || []) {
    const d = p.def; if (!d) continue;
    if (d.vy) { p.y0 ??= p.y; p.y = p.y0 + d.vy * p.t; }
    if (d.groundBurst && !p.dead && p.y - (p.h || 0) / 2 <= 0.05) { p.dead = true; p.landed = true; }
    if (d.hitWindow != null && p.t > d.hitWindow) p.armed = false;
    if (d.wall && !p.dead) for (const f of m.f || []) { // muro: el rival no lo atraviesa por el suelo
      if (f === p.owner || f.air && f.y > (p.y + p.h / 2) - .3) continue;
      const reach = p.w / 2 + .45, dx = f.x - p.x;
      if (Math.abs(dx) < reach) { const s = Math.sign(f.x - p.owner.x) || p.dir; f.x = Math.max(-half, Math.min(half, p.x + s * reach)); if (Math.sign(f.vx || 0) === -s) f.vx = 0; if (Math.sign(f.kv || 0) === -s) f.kv = 0; }
    }
  }
}

// ── IA: usa las técnicas con las mismas entradas que un jugador ──
export function bendingInput(brain, me, foe, dt) {
  const r = brain.rng || Math.random, P = brain.P || {}, M = me.moves || {}, d = Math.abs(foe.x - me.x), dir = Math.sign(foe.x - me.x) || 1, skill = (P.punish ?? .35) + (P.meter ?? .3) * .5;
  brain.bendCool = (brain.bendCool ?? .6) - dt;
  if (brain.bendCool > 0 || me.act || me.stun > 0 || me.ko || me.down > 0 || me.getup > 0 || me.stunType) return null;
  const go = (o, cool) => { brain.bendCool = cool * (1.4 - Math.min(1, skill) * .6); return { x: 0, jump: false, down: false, guard: false, l: false, m: false, h: false, s: false, r: false, ...o }; };
  if (me.air) return M.ej && foe.y < me.y - .8 && d > 1 && d < 5 && r() < .9 * dt * 12 * skill ? go({ s: true }, .8) : null;
  if (M.eu && foe.air && !foe.launched && d < 3.2 && foe.vy < 4 && r() < dt * 14 * (P.antiAir ?? .35)) return go({ down: true, s: true }, .7);
  const zone = me.def.id === 'aqua' || me.def.id === 'zephyr' ? 1.3 : 1;
  if (M.eb && d > 3.2 && r() < dt * 1.6 * zone * (.4 + skill)) return go({ x: dir, s: true }, 1.1);
  if (M.eu && !foe.air && d > 2.4 && d < 3.6 && (me.def.id === 'aqua' || me.def.id === 'zephyr') && r() < dt * .9 * (.4 + skill)) return go({ down: true, s: true }, 1.2);
  if (M.eu && me.def.id === 'terra' && foe.act?.def?.proj && d > 2.5 && r() < dt * 8 * skill) return go({ down: true, s: true }, 1.2); // muro contra proyectiles
  return null;
}
export function patchCpu(CpuBrain) {
  const P = CpuBrain?.prototype; if (!P || P.__bending) return !!P?.__bending;
  if (typeof P.think !== 'function') return false;
  const think = P.think;
  P.think = function (dt, me, foe) {
    const inp = think.call(this, dt, me, foe);
    try {
      if (!inp || !(inp.l || inp.m || inp.h || inp.s || inp.r || inp.jump)) { const b = bendingInput(this, me, foe, dt); if (b) return b; }
      // remate de combo: a veces termina la cadena con control elemental en lugar de la especial con arma
      else if (inp.s && !me.air && me.act?.hits && me.moves?.eb && (this.rng || Math.random)() < .45) return { ...inp, x: Math.sign(foe.x - me.x) || 1, down: false };
    } catch (e) { console.warn('[control elemental] IA', e); }
    return inp;
  };
  P.__bending = true;
  return true;
}
