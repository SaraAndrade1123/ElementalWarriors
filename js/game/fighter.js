// Lógica pura de combate (sin Three.js): se prueba con Node (npm test). Los golpes viven en data/moves.json.
// F4: ligero/medio/pesado de pie, agachado y en el aire · lanzamientos con escape · búfer de entradas determinista ·
// cancelaciones (cadenas, especial, salto) · carrera y retroceso rápido · derribo y levantarse · combos aéreos con límite ·
// proyectiles · técnica especial · Resonancia Elemental (técnica reforzada, cancelación resonante y repulsión).
export const WORLD = { half: 8.2, gravity: 42, minGap: 1.0 };
export const RULES = {
  buffer: .1,          // una pulsación se recuerda 100 ms (6 fotogramas)
  motion: .45,         // ventana para ↓ ↘ → (técnica por secuencia)
  dashTap: .22,        // doble toque para correr / retroceso rápido
  chainMax: 5,         // máximo de golpes encadenados por cancelación
  juggleMax: 6,        // golpes aéreos sobre un rival lanzado antes de que deje de ser vulnerable
  comboScale: .9, minScale: .3,
  meterMax: 100, exCost: 25, rcCost: 50, repelCost: 50,
  tech: .25,           // ventana para escapar de un lanzamiento
  throwLock: .42,      // duración del agarre antes de lanzar
  throwImm: .35,       // protección tras escapar / levantarse
  downT: .5, getupT: .35, guardMax: 100,
  backdash: { t: .3, v: 8, inv: .13 },
};
export const COMBO_SCALE = RULES.comboScale;
export const BTN = ['l', 'm', 'h', 's', 'r'];
export const NONE = Object.freeze({ x: 0, down: false, guard: false, jump: false, l: false, m: false, h: false, s: false, r: false });
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const LIGHT = new Set(['l', 'cl', 'jl']);

// Mezcla common + el guerrero (cada golpe hereda los campos comunes y sobrescribe los suyos).
export function movesFor(all, id) {
  if (!all?.common) return all; // formato ya resuelto
  const over = all[id] || {}, out = {};
  for (const k in all.common) out[k] = { ...all.common[k], ...(over[k] || {}), id: k };
  for (const k in over) if (k !== 'traits' && !out[k]) out[k] = { ...over[k], id: k };
  for (const k in out) out[k].proj &&= { ...out[k].proj };
  out.traits = { airJumps: 0, ...(over.traits || {}) };
  return out;
}

export class Fighter {
  constructor(def, x, facing, moves) {
    const s = def.stats; this.def = def; this.moves = movesFor(moves, def.id);
    this.walk = 2.6 + s.velocidad * .38; this.jumpV = 12.5 + s.velocidad * .3;
    this.maxHp = 80 + s.vida * 8; this.atk = .75 + s.fuerza * .05; this.dmul = 1.3 - s.defensa * .05;
    this.reset(x, facing);
  }
  reset(x, facing, keepMeter = false) {
    Object.assign(this, { x, y: 0, vx: 0, vy: 0, kv: 0, facing, air: false, crouching: false, crouch: 0, guarding: false, act: null, chain: 0, used: [],
      stun: 0, stunType: null, ko: false, combo: 0, juggle: 0, launched: false, down: 0, getup: 0, inv: 0, tinv: 0, airRec: false, landRec: 0,
      run: false, bdash: 0, jumps: 0, meter: keepMeter ? this.meter ?? 0 : 0, guard: 0, took: null, flash: 0, hp: this.maxHp, clock: 0, buf: [], hist: [], tap: null,
      thrower: null, techReq: false, backThrow: false, ev: [], rcT: 0,
      hitN: 0, bkN: 0, stunMax: 0, hitKb: 0 }); // contadores de impacto/bloqueo: el animador los usa para disparar la reacción
  }
  revive() { Object.assign(this, { ko: false, hp: this.maxHp, stun: 0, stunType: null, act: null, combo: 0, juggle: 0, kv: 0, vy: 0, y: 0, air: false, launched: false, down: 0, getup: 0, thrower: null, guard: 0 }); }
  get state() {
    if (this.ko) return 'ko'; if (this.stunType === 'thrown') return 'thrown';
    if (this.down > 0) return 'down'; if (this.getup > 0) return 'getup';
    if (this.stun > 0) return this.stunType; if (this.act) return this.act.name; if (this.bdash > 0) return 'backdash';
    if (this.air) return this.airRec ? 'airrec' : 'jump';
    return this.guarding ? (this.crouching ? 'guard-c' : 'guard') : this.crouching ? 'crouch' : this.run ? 'run' : Math.abs(this.vx) > .1 ? 'walk' : 'idle';
  }
  hurt() {
    const H = this.def.height || 3.3, top = this.down > 0 || this.ko ? .25 : this.crouching ? .6 : .92;
    return { x0: this.x - .45, x1: this.x + .45, y0: this.y, y1: this.y + top * H };
  }
  hitbox() {
    const a = this.act; if (!a) return null; const d = a.def;
    if (!d.range || d.throw || a.t < d.startup || a.t >= d.startup + d.active) return null;
    const e = this.x + this.facing * d.range, s = this.x + this.facing * (d.x0 ?? .2);
    return { x0: Math.min(s, e), x1: Math.max(s, e), y0: this.y + d.y0, y1: this.y + d.y1 };
  }
  // Guardia: de pie frena golpes medios y altos; agachado, medios y bajos. En el aire no se bloquea.
  canBlock(level) {
    return this.guarding && !this.air && (level === 'mid' || (level === 'low' && this.crouching) || (level === 'high' && !this.crouching));
  }
  gain(v) { this.meter = clamp(this.meter + v, 0, RULES.meterMax); }

  // ── búfer ──
  _has(b) { return this.buf.some(e => e.b === b); }
  _take(b) { const i = this.buf.findIndex(e => e.b === b); if (i < 0) return false; this.buf.splice(i, 1); return true; }
  _motion() { // ↓ ↘ → (2-3-6) dentro de la ventana; ↘ es opcional (entrada tolerante)
    const h = this.hist; let st = 0;
    for (const e of h) { if (st === 0 && (e.n === 2 || e.n === 1)) st = 1; else if (st >= 1 && (e.n === 3)) st = 2; else if (st >= 1 && e.n === 6) return true; }
    return false;
  }
  _choose() {
    if (!this.air && this._has('l') && this._has('m') && this.buf.find(e => e.b === 'l').age < .06 && this.buf.find(e => e.b === 'm').age < .06) return { id: 'throw', use: ['l', 'm'] };
    if (this._has('s')) return { id: 's', use: ['s'] };
    const atk = this.buf.find(e => e.b === 'l' || e.b === 'm' || e.b === 'h'); if (!atk) return null;
    if (!this.air && this._motion() && this.moves.s) return { id: 's', use: [atk.b], motion: true };
    const b = atk.b; return { id: this.air ? 'j' + b : this.crouching || this._down ? 'c' + b : b, use: [b] };
  }
  _can(id) {
    const d = this.moves[id]; if (!d) return false;
    if (!!d.air !== this.air) return false;
    if (this.landRec > 0 || this.bdash > 0) return false;
    const cur = this.act; if (!cur) return true;
    if (!cur.hits || cur.grab) return false;
    const special = id === 's' || id === 'ex';
    if (!(cur.def.cancel || []).includes(special ? 's' : id)) return false;
    if (this.chain >= RULES.chainMax - 1) return false;
    return this.used.filter(u => u === id).length < (LIGHT.has(id) ? 2 : 1);
  }
  _start(id, extra = {}) {
    const d = this.moves[id];
    if (this.act) { this.chain++; } else { this.chain = 0; this.used = []; }
    this.used.push(id);
    this.act = { name: id, def: d, t: 0, hits: 0, armed: true, lastHit: -9, spawned: false, armor: d.armor ? 1 : 0, ...extra };
    this.took = id; this.run = false; this.guarding = false;
    if (!this.air) this.vx = 0;
    if (id === 'throw') this.backThrow = this._back;
    this.ev.push({ t: 'start', id });
  }
  _resonance() {
    const a = this.act;
    // 1) técnica reforzada como cancelación de un golpe que conectó (lo más barato y natural en un combo)
    if (a && !this.air && this.meter >= RULES.exCost && this.moves.ex && this._can('ex')) { this.meter -= RULES.exCost; this._start('ex'); this.ev.push({ t: 'ex' }); return; }
    // 2) cancelación resonante: corta la recuperación de cualquier golpe ya lanzado
    if (a && a.name !== 'ex' && !a.grab && a.t >= a.def.startup && this.meter >= RULES.rcCost) {
      this.meter -= RULES.rcCost; this.act = null; this.chain = 0; this.used = []; this.rcT = .35; this.ev.push({ t: 'rc' }); return;
    }
    // 3) en neutro: técnica reforzada
    if (!a && !this.air && this.meter >= RULES.exCost && this.moves.ex && this.landRec <= 0) { this.meter -= RULES.exCost; this._start('ex'); this.ev.push({ t: 'ex' }); }
  }
  _land() { // aterriza
    this.y = 0; this.vy = 0; this.air = false; this.airRec = false;
    if (this.act?.def.air) { this.act = null; this.landRec = .05; }
    if (this.launched && !this.ko) { this.launched = false; this.down = RULES.downT; this.stun = 0; this.stunType = null; this.act = null; this.ev.push({ t: 'knockdown' }); }
    if (!this.ko) this.vx = 0;
    this.ev.push({ t: 'land' });
  }
  _fall(dt) { this.vy -= WORLD.gravity * dt; this.y += this.vy * dt; if (this.y <= 0) this._land(); }
  _move(dt) { this.x = clamp(this.x + (this.vx + this.kv) * dt, -WORLD.half, WORLD.half); this.kv *= Math.exp(-dt * 5); }

  update(dt, inp, foe) {
    inp = inp || NONE; this.took = null; this.ev = []; this.clock += dt;
    this.flash = Math.max(0, this.flash - dt * 9); this.inv = Math.max(0, this.inv - dt); this.tinv = Math.max(0, this.tinv - dt);
    this.landRec = Math.max(0, this.landRec - dt); this.rcT = Math.max(0, this.rcT - dt);
    if (!(this.stun > 0 && this.stunType === 'block')) this.guard = Math.max(0, this.guard - dt * 14);
    // búfer y dirección (relativa al rival: 6 = adelante, 4 = atrás, 2 = abajo…)
    for (const e of this.buf) e.age += dt; this.buf = this.buf.filter(e => e.age <= RULES.buffer);
    for (const b of BTN) if (inp[b]) this.buf.push({ b, age: 0 });
    if (inp.jump) this.buf.push({ b: 'jump', age: 0 });
    const rx = inp.x * this.facing, n = inp.down ? (rx > 0 ? 3 : rx < 0 ? 1 : 2) : (rx > 0 ? 6 : rx < 0 ? 4 : 5);
    for (const e of this.hist) e.age += dt; this.hist = this.hist.filter(e => e.age <= RULES.motion);
    const prevN = this.hist.length ? this.hist[this.hist.length - 1].n : 5;
    if (prevN !== n) {
      this.hist.push({ n, age: 0 });
      if ((n === 6 || n === 4) && !this.air) { // doble toque
        if (this.tap && this.tap.n === n && this.clock - this.tap.t < RULES.dashTap) { this.dashReq = n; this.tap = null; } else this.tap = { n, t: this.clock };
      }
    }
    this._back = rx < 0; this._down = !!inp.down;

    if (this.ko) { if (this.air) this._fall(dt); this.vx = 0; return this._move(dt); }
    if (this.stunType === 'thrown') { if (this._has('l') && this._has('m')) this.techReq = true; this.vx = 0; return; }
    if (this.down > 0) { this.down -= dt; this.vx = 0; this._move(dt); if (this.down <= 0) { this.down = 0; this.getup = RULES.getupT; this.ev.push({ t: 'getup' }); } return; }
    if (this.getup > 0) { this.getup -= dt; if (this.getup <= 0) { this.getup = 0; this.combo = 0; this.juggle = 0; this.tinv = RULES.throwImm; } return this._move(dt); }

    if (this.stun > 0) { // aturdido: sin control (salvo la repulsión resonante en guardia)
      this.stun -= dt;
      if (this.stunType === 'block') {
        this.crouching = !!inp.down; this.guarding = true;
        if (this._take('r') && this.meter >= RULES.repelCost) { this.meter -= RULES.repelCost; this.stun = 0; this.stunType = null; this.inv = .12; this.ev.push({ t: 'repel' }); return this._move(dt); }
      } else { this.crouching = false; this.guarding = false; }
      if (this.air) this._fall(dt);
      this.vx = 0; this._move(dt);
      if (this.stun <= 0 && this.down <= 0) {
        if (this.air) { if (this.launched) this.stun = .02; else { this.stun = 0; this.stunType = null; this.airRec = true; this.inv = Math.max(this.inv, .3); this.combo = 0; this.juggle = 0; this.ev.push({ t: 'airrec' }); } }
        else if (this.stunType) { this.stun = 0; this.stunType = null; this.combo = 0; this.juggle = 0; }
      }
      return;
    }

    const g = !this.air;
    if (this._take('r')) this._resonance();
    // salto cancelable (p. ej. tras el lanzador agachado)
    if (this.act && g && this.act.def.jc && this.act.hits && this._has('jump')) { this.act = null; this.chain = 0; }
    const want = this._choose();
    if (want && this._can(want.id)) { for (const b of want.use) this._take(b); this._start(want.id); }

    if (this.act) { // avance del golpe en curso
      const a = this.act, d = a.def; a.t += dt;
      if (d.multi && !a.armed && a.hits > 0 && a.hits < d.multi && a.t - a.lastHit >= d.gap) a.armed = true;
      if (d.proj && !a.spawned && a.t >= d.startup) { a.spawned = true; this.ev.push({ t: 'proj', def: d.proj, move: a.name, x: this.x + this.facing * (d.proj.x0 || 1), y: this.y + d.proj.y, dir: this.facing }); }
      if (d.throw && !a.grab && !a.missed && a.t >= d.startup + d.active) a.missed = true;
      const total = a.grab ? a.g0 + RULES.throwLock + .5 : a.end ?? d.startup + d.active + d.recovery;
      if (a.t >= total && !(d.air && this.air)) this.act = null;
    }
    if (this.act) {
      const a = this.act, d = a.def; this.guarding = false; this.run = false;
      const inWin = a.t >= d.startup && a.t < d.startup + d.active;
      if (a.grab) this.vx = 0;
      else if (d.vx) this.vx = inWin ? this.facing * d.vx : a.t < d.startup ? 0 : this.vx * .82;
      else if (g) this.vx = a.t < d.startup + d.active ? this.facing * (d.lunge || 0) : 0;
      if (g) this.crouching = !!d.crouch;
    } else if (this.bdash > 0) {
      this.bdash -= dt; this.vx = -this.facing * RULES.backdash.v * (this.bdash / RULES.backdash.t) * 1.4;
      if (this.bdash <= 0) { this.bdash = 0; this.vx = 0; this.landRec = .08; }
    } else if (g) {
      this.crouching = !!inp.down; this.guarding = !this.run && (!!inp.guard || rx < 0);
      if (this.dashReq && !this.crouching) {
        if (this.dashReq === 6) { this.run = true; this.ev.push({ t: 'dash' }); }
        else { this.bdash = RULES.backdash.t; this.inv = RULES.backdash.inv; this.guarding = false; this.ev.push({ t: 'backdash' }); }
      }
      if (this.run && (rx <= 0 || this.crouching)) this.run = false;
      if (this.bdash <= 0) this.vx = this.crouching ? 0 : this.run ? this.facing * this.walk * 2.3 : inp.x * this.walk * (rx < 0 ? .8 : 1);
      if (this._has('jump') && !this.crouching && this.landRec <= 0 && this.bdash <= 0) {
        this._take('jump'); this.air = true; this.vy = this.jumpV; this.jumps = this.moves.traits?.airJumps || 0;
        this.vx = inp.x * this.walk * (this.run ? 1.7 : 1.05); this.run = false; this.took = 'jump'; this.ev.push({ t: 'jump' });
      }
      const dx = foe.x - this.x; if (dx !== 0 && this.bdash <= 0) this.facing = Math.sign(dx); // en tierra mira al rival
    } else {
      this.guarding = false;
      if (this.jumps > 0 && !this.airRec && this._has('jump') && this.vy < this.jumpV * .6) { // doble salto (Zephyr)
        this._take('jump'); this.jumps--; this.vy = this.jumpV * .82; this.vx = inp.x * this.walk * 1.1; this.took = 'jump2'; this.ev.push({ t: 'jump2' });
      }
    }
    this.dashReq = 0;
    if (this.air) this._fall(dt);
    this._move(dt);
  }
}

// Evita que los luchadores se atraviesen en el suelo; si uno salta alto o usa un paso de viento, puede pasar.
export function separate(a, b) {
  if (Math.max(a.y, b.y) > 1.2) return;
  if ([a, b].some(f => f.act?.def.pass && f.act.t < f.act.def.startup + f.act.def.active) || a.stunType === 'thrown' || b.stunType === 'thrown') return;
  const d = b.x - a.x, o = WORLD.minGap - Math.abs(d); if (o <= 0) return;
  const s = d === 0 ? (a.facing || 1) : Math.sign(d);
  a.x = clamp(a.x - s * o / 2, -WORLD.half, WORLD.half); b.x = clamp(b.x + s * o / 2, -WORLD.half, WORLD.half);
  if (Math.abs(b.x - a.x) < WORLD.minGap) { if (Math.abs(a.x) >= WORLD.half) b.x = a.x + s * WORLD.minGap; else a.x = b.x - s * WORLD.minGap; }
}

// ¿Puede `b` recibir un golpe ahora? (invulnerabilidades, derribo, límite de combo aéreo…)
export function vulnerable(b, d) {
  if (b.ko || b.down > 0 || b.getup > 0 || b.inv > 0 || b.stunType === 'thrown') return false;
  const a = b.act; if (a?.def.inv && a.t >= a.def.inv[0] && a.t < a.def.inv[1]) return false;
  if (b.air && b.launched && b.juggle >= RULES.juggleMax) return false;
  if (d.groundOnly && b.air) return false;
  return true;
}
const overlap = (p, q) => !(p.x1 < q.x0 || p.x0 > q.x1 || p.y1 < q.y0 || p.y0 > q.y1);

// Contacto: ¿el golpe activo de `a` toca la caja de daño de `b`? No modifica nada (así dos golpes simultáneos se evalúan con el estado previo).
function touch(a, b) {
  const act = a.act; if (!act || !act.armed) return null; const box = a.hitbox(); if (!box || !vulnerable(b, act.def)) return null;
  const h = b.hurt(); if (!overlap(box, h)) return null;
  return { src: act, def: act.def, dir: a.facing, pos: { x: (Math.max(box.x0, h.x0) + Math.min(box.x1, h.x1)) / 2, y: (Math.max(box.y0, h.y0) + Math.min(box.y1, h.y1)) / 2 } };
}

// Aplica un contacto (golpe o proyectil): armadura, bloqueo, daño, aturdimiento, lanzamiento, derribo y Resonancia.
function land(a, b, { src, def: m, dir, pos }) {
  const wall = Math.abs(b.x) >= WORLD.half - .05, move = src.name || src.move;
  src.armed = false; src.hits = (src.hits || 0) + 1; src.lastHit = src.t ?? 0;
  const last = !m.multi || src.hits >= m.multi, base = { a, b, move, pos, combo: b.combo, proj: !!src.isProj, hitN: src.hits };
  // armadura (Terra): absorbe un golpe, recibe la mitad del daño y no se interrumpe
  const ba = b.act; if (ba?.armor > 0 && ba.def.armor && ba.t >= ba.def.armor[0] && ba.t < ba.def.armor[1]) {
    ba.armor--; const dmg = m.dmg * a.atk * b.dmul * .5; b.hp = Math.max(1, b.hp - dmg); b.flash = .7; a.gain(dmg * .4);
    return { ...base, armored: true, blocked: false, dmg, ko: false };
  }
  if (b.canBlock(m.hit)) {
    b.stun = b.stunMax = m.blockstun; b.stunType = 'block'; b.kv = dir * m.kbBlock; b.bkN++; b.hitKb = m.kbBlock; a.kv = -dir * m.kbBlock * (wall ? 1.2 : .5);
    b.hp = Math.max(1, b.hp - (m.chip || 0)); // el daño por bloqueo nunca mata
    a.gain(m.dmg * .35); b.gain(2.5);
    b.guard += m.guardDmg ?? m.dmg * 1.4;
    if (b.guard >= RULES.guardMax) { // guardia rota: castiga defenderse sin parar
      b.guard = 0; b.stun = b.stunMax = .7; b.stunType = 'crush'; b.guarding = false; b.hitN++; b.flash = .6;
      return { ...base, blocked: false, crush: true, dmg: 0, ko: false };
    }
    return { ...base, blocked: true, dmg: 0, ko: false };
  }
  const counter = !!(ba && ba.t < ba.def.startup + ba.def.active && !ba.def.throw);
  const scale = Math.max(RULES.minScale, Math.pow(RULES.comboScale, b.combo));
  const dmg = m.dmg * a.atk * b.dmul * scale * (counter ? 1.1 : 1);
  b.hp = Math.max(0, b.hp - dmg); b.combo++; b.act = null; b.chain = 0; b.guarding = false; b.crouching = false; b.flash = 1; b.run = false; b.bdash = 0;
  const decay = b.combo > 3 ? Math.max(.55, 1 - (b.combo - 3) * .07) : 1;
  b.stun = b.stunMax = m.hitstun * (counter ? 1.25 : 1) * decay; b.stunType = 'hit'; b.hitN++; b.hitKb = Math.abs(m.kb || m.pull || 3);
  b.kv = m.pull ? -dir * m.pull : dir * m.kb;
  const kd = m.kd || (m.kdLast && last);
  if (m.launch) { b.air = true; b.vy = m.launch; b.launched = true; b.juggle += 1; }
  else if (kd) { b.air = true; b.vy = Math.max(b.air ? b.vy : 0, 7); b.launched = true; b.kv = dir * Math.max(m.kb, 5); }
  else if (b.air) { b.vy = m.spike ? -5 : Math.max(Math.min(b.vy, 3), 4.5); b.juggle += 1; if (m.spike) b.launched = true; }
  if (wall) a.kv = -dir * Math.abs(m.kb || 3) * .6;
  a.gain(m.dmg * .8 * (counter ? 1.2 : 1)); b.gain(m.dmg * .25);
  const ko = b.hp <= 0; if (ko) { b.ko = true; b.air = true; b.vy = 7; b.kv = dir * 6; b.stun = 0; b.launched = false; }
  return { ...base, blocked: false, dmg, ko, counter, launch: !!(m.launch || kd) };
}

// ¿El golpe activo de `a` alcanza a `b`? Aplica daño o bloqueo y devuelve el evento (o null).
export function resolve(a, b) { const c = touch(a, b); return c ? land(a, b, c) : null; }

// Resuelve los dos sentidos a la vez: si ambos golpes coinciden en el mismo fotograma hay INTERCAMBIO (los dos reciben daño),
// en lugar de que gane siempre quien se evalúa primero. Devuelve la lista de eventos (0, 1 o 2).
export function resolveBoth(a, b) {
  const ca = touch(a, b), cb = touch(b, a), out = [];
  if (ca) out.push(land(a, b, ca));
  if (cb) out.push(land(b, a, cb));
  return out;
}

// Lanzamientos: agarre a corta distancia, ventana de escape (L+M), protección tras levantarse y lanzamiento hacia atrás (← al iniciar).
function grabbable(a, b, d) {
  return !b.air && !b.ko && b.down <= 0 && b.getup <= 0 && b.tinv <= 0 && !(b.stun > 0) && b.stunType !== 'thrown' && b.bdash <= 0
    && !(b.act?.def.inv && b.act.t < b.act.def.inv[1]) && Math.abs(b.x - a.x) <= d.range;
}
export function resolveThrows(a, b) {
  for (const f of [a, b]) if (f.stunType === 'thrown' && !(f.thrower?.act?.grab)) Object.assign(f, { stun: 0, stunType: null, thrower: null }); // el que agarraba fue interrumpido
  const out = [], ta = a.act?.def.throw && !a.act.grab && !a.act.missed && a.act.t >= a.act.def.startup && grabbable(a, b, a.act.def);
  const tb = b.act?.def.throw && !b.act.grab && !b.act.missed && b.act.t >= b.act.def.startup && grabbable(b, a, b.act.def);
  if (ta && tb) { techBoth(a, b); return [{ type: 'tech', a, b, pos: mid(a, b) }]; } // agarre simultáneo = escape automático
  for (const [x, y, t] of [[a, b, ta], [b, a, tb]]) {
    if (t) { const act = x.act; act.grab = true; act.g0 = act.t; Object.assign(y, { stunType: 'thrown', stun: 9, act: null, thrower: x, techReq: false, crouching: false, guarding: false, run: false, vx: 0 }); y.buf = y.buf.filter(e => e.age < .03); out.push({ type: 'grab', a: x, b: y, pos: mid(x, y) }); }
    const act = x.act; if (!act?.grab || y.thrower !== x) continue;
    const gt = act.t - act.g0; y.x = clamp(x.x + x.facing * .95, -WORLD.half, WORLD.half); y.y = 0;
    if (y.techReq && gt <= RULES.tech) { techBoth(x, y); out.push({ type: 'tech', a: x, b: y, pos: mid(x, y) }); continue; }
    if (gt >= RULES.throwLock) {
      const d = act.def, dmg = d.dmg * x.atk * y.dmul;
      if (x.backThrow) { const nx = clamp(x.x - x.facing * 1.1, -WORLD.half, WORLD.half); y.x = nx; }
      const dir = Math.sign(y.x - x.x) || x.facing;
      Object.assign(y, { stunType: 'hit', stun: .1, stunMax: .4, thrower: null, air: true, vy: 8.5, kv: dir * 5, launched: true, flash: 1 }); y.hitN++; y.hitKb = 6;
      y.hp = Math.max(0, y.hp - dmg); y.combo++; x.gain(10); y.gain(4);
      act.grab = false; act.done = true; act.end = act.t + .28;
      const ko = y.hp <= 0; if (ko) { y.ko = true; y.vy = 7; y.kv = dir * 6; y.stun = 0; y.launched = false; }
      out.push({ type: 'throw', a: x, b: y, dmg, ko, back: x.backThrow, pos: { x: y.x, y: 1.6 } });
    }
  }
  return out;
}
const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: 1.8 });
function techBoth(a, b) {
  for (const [f, o] of [[a, b], [b, a]]) {
    if (f.act?.def.throw) f.act = null;
    if (f.stunType === 'thrown') { f.stun = 0; f.stunType = null; f.thrower = null; }
    f.kv = Math.sign(f.x - o.x || -f.facing) * 6; f.tinv = RULES.throwImm; f.gain(6); f.buf = []; f.techReq = false; f.techN = (f.techN || 0) + 1;
  }
}

// Proyectiles (agua, roca): avanzan, chocan entre sí, golpean una o varias veces y desaparecen.
export function makeProjectile(owner, e) {
  const p = e.def;
  return { owner, isProj: true, move: e.move, def: p, x: e.x, y: e.y, vx: e.dir * p.speed, dir: e.dir, w: p.w, h: p.h, life: p.life, t: 0, hits: 0, armed: true, lastHit: -9, dead: false, kind: p.kind };
}
export function stepProjectiles(list, fighters, dt) {
  const out = [];
  for (const p of list) {
    if (p.dead) continue; p.t += dt; p.x += p.vx * dt;
    if (p.def.multi && !p.armed && p.hits < p.def.multi && p.t - p.lastHit >= p.def.gap) p.armed = true;
    if (p.t >= p.life || Math.abs(p.x) > WORLD.half + 2) { p.dead = true; out.push({ type: 'fade', p }); }
  }
  for (const p of list) for (const q of list) { // choque de técnicas de distinto dueño
    if (p === q || p.dead || q.dead || p.owner === q.owner) continue;
    if (Math.abs(p.x - q.x) < (p.w + q.w) / 2 && Math.abs(p.y - q.y) < (p.h + q.h) / 2) { p.dead = q.dead = true; out.push({ type: 'clash', p, q, pos: { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 } }); }
  }
  for (const p of list) {
    if (p.dead || !p.armed) continue;
    const b = fighters.find(f => f !== p.owner); if (!b || !vulnerable(b, p.def)) continue;
    const box = { x0: p.x - p.w / 2, x1: p.x + p.w / 2, y0: p.y - p.h / 2, y1: p.y + p.h / 2 }, h = b.hurt();
    if (!overlap(box, h)) continue;
    const e = land(p.owner, b, { src: p, def: p.def, dir: p.dir, pos: { x: p.x, y: clamp(p.y, h.y0 + .2, h.y1 - .2) } });
    out.push({ type: 'hit', ...e });
    if (p.hits >= (p.def.multi || 1) || e.blocked || e.armored) p.dead = true;
  }
  return out;
}
