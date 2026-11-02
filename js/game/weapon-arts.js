// ARMAS DE LA TIENDA y ROMPEGUARDIA (lógica pura, sin Three.js ni DOM: se prueba con Node).
// Mismo patrón que bending.js: no edita fighter.js; parchea Fighter/CpuBrain una sola vez y añade reglas tras cada paso.
//   · weaponMove(w, element, rules) → la técnica del arma adaptada al elemento de quien la usa.
//   · patchFighter(Fighter)          → botón de arma ('w') y rompeguardia (M+H a la vez); enfriamiento del arma.
//   · stepWeapons(match)             → contraataque (daga), reflejo (abanico), bumerán que vuelve, mejoras pasivas.
//   · patchCpu(CpuBrain)             → la IA usa su arma y el rompeguardia (y se defiende del rompeguardia del jugador).
export const WP = 'wp', GB = 'gb';
const SPECIAL = new Set(['s', 'ex', 'eb', 'eu', 'ej', WP, GB]);
const CHAIN_MAX = 5;
const num = (v, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);

// ── datos ──
export const ELEMENT_ALIAS = { air: 'wind', viento: 'wind', aire: 'wind', agua: 'water', fuego: 'fire', tierra: 'earth' };
export const elementKey = el => ELEMENT_ALIAS[el] || el || 'earth';
// Copia del golpe del arma con las reglas de su elemento (fuego: más daño · agua: más aturdimiento · viento: más alcance,
// velocidad y empuje · tierra: más desgaste de guardia y armadura durante el arranque). Nunca modifica `w`.
export function weaponMove(w, element, rules = {}) {
  if (!w?.move) return null;
  const el = elementKey(element), R = rules[el] || {}, m = { ...w.move, btn: 'w', name: w.id, weapon: w.id, kind: w.kind, cd: num(w.cd, 6), el };
  if (m.proj) m.proj = { ...m.proj };
  const tgt = [m, m.proj].filter(Boolean);
  for (const d of tgt) {
    if (R.dmg && d.dmg) d.dmg = +(d.dmg * R.dmg).toFixed(2);
    if (R.hitstun && d.hitstun) d.hitstun = +(d.hitstun * R.hitstun).toFixed(3);
    if (R.blockstun && d.blockstun) d.blockstun = +(d.blockstun * R.blockstun).toFixed(3);
    if (R.kb && d.kb) d.kb = +(d.kb * R.kb).toFixed(2);
    if (R.guardDmg && d.dmg) d.guardDmg = +((d.guardDmg ?? d.dmg * 1.4) * R.guardDmg).toFixed(1);
  }
  if (R.range && m.range) m.range = +(m.range * R.range).toFixed(2);
  if (R.range && m.reach) m.reach = +(m.reach * R.range).toFixed(2);
  if (R.speed && m.proj) m.proj.speed = +(m.proj.speed * R.speed).toFixed(2);
  if (R.armor) m.armor = [0, m.startup];
  if (m.parry) m.inv = [...m.parry]; // durante la guardia de la daga no recibe golpes (el contraataque se decide tras cada paso)
  if (m.riposte && R.dmg) m.riposte = { ...m.riposte, dmg: m.riposte.dmg * R.dmg };
  return m;
}
// Comprueba el catálogo (npm test). Devuelve la lista de problemas.
export function validateWeapons(data, items = []) {
  const out = [], W = data?.weapons || {}, AFTER = ['stow', 'throw', 'return', 'vanish'];
  for (const [id, w] of Object.entries(W)) {
    const m = w.move; if (!m) { out.push(`${id}: sin técnica`); continue; }
    for (const f of ['startup', 'active', 'recovery', 'hit']) if (m[f] == null) out.push(`${id}: falta move.${f}`);
    if (!(w.cd > 0)) out.push(`${id}: enfriamiento (cd) inválido`);
    if (!AFTER.includes(w.after)) out.push(`${id}: after debe ser ${AFTER.join('/')}`);
    if (!m.proj && !(m.range > 0) && !m.parry) out.push(`${id}: no tiene proyectil ni caja de golpe`);
    if (m.proj) for (const f of ['speed', 'life', 'w', 'h', 'y', 'dmg', 'kind']) if (m.proj[f] == null) out.push(`${id}.proj: falta ${f}`);
    const it = items.find(i => i.id === id); if (!it) out.push(`${id}: no está en data/items.json`); else if (!(it.price > 0)) out.push(`${id}: sin precio`);
  }
  for (const it of items) if (it.type === 'weapon' && !W[it.id]) out.push(`${it.id}: objeto de tienda sin datos en data/weapons.json`);
  return out;
}

// ── entradas ──
const age = (f, b) => f.buf?.find(e => e.b === b)?.age ?? 9;
export function chooseExtra(f) {
  const has = b => (f.buf || []).some(e => e.b === b), M = f.moves || {};
  if (has('w') && M[WP] && !f.air) return { id: WP, use: ['w'] };
  if (!f.air && M[GB]) {
    if (has('m') && has('h') && age(f, 'm') < .07 && age(f, 'h') < .07) return { id: GB, use: ['m', 'h'] };
    const a = f.act; // M y H con un fotograma de diferencia: el normal que acaba de empezar se convierte en rompeguardia
    if (a && !a.hits && a.t < .07 && ((a.name === 'm' && has('h')) || (a.name === 'h' && has('m')))) return { id: GB, use: [a.name === 'm' ? 'h' : 'm'], swap: true };
  }
  return null;
}
export function canExtra(f, want, chainMax = CHAIN_MAX) {
  const id = want.id, d = f.moves?.[id]; if (!d || f.air) return false;
  if (f.landRec > 0 || f.bdash > 0) return false;
  if (id === WP && (f.wcd || 0) > 0) return false;
  const cur = f.act; if (!cur || want.swap) return true;
  if (!cur.hits || cur.grab || SPECIAL.has(cur.name)) return false;
  if (!(cur.def.cancel || []).includes('s')) return false; // se encadena donde se encadena una técnica especial
  return f.chain < chainMax - 1;
}
export function patchFighter(Fighter, RULES) {
  const P = Fighter?.prototype; if (!P || P.__weapons) return !!P?.__weapons;
  if (typeof P.update !== 'function' || typeof P._choose !== 'function' || typeof P._can !== 'function' || typeof P._start !== 'function') { console.warn('[armas] Fighter cambió: el botón de arma no se activa'); return false; }
  const update = P.update, choose = P._choose, can = P._can, start = P._start, reset = P.reset, chainMax = RULES?.chainMax ?? CHAIN_MAX;
  P.update = function (dt, inp, foe) {
    if (this.wcd > 0) this.wcd = Math.max(0, this.wcd - dt);
    if (inp?.w) (this.buf ||= []).push({ b: 'w', age: 0 });
    return update.call(this, dt, inp, foe);
  };
  P._choose = function () { const x = chooseExtra(this); if (x && canExtra(this, x, chainMax)) { this.__want = x; return x; } this.__want = null; return choose.call(this); };
  P._can = function (id) { return id === WP || id === GB ? !!this.__want && this.__want.id === id && canExtra(this, this.__want, chainMax) : can.call(this, id); };
  P._start = function (id, extra) {
    if (this.__want?.swap && id === GB) { this.act = null; } // M→H: el normal recién empezado se sustituye
    const r = start.call(this, id, extra);
    if (id === WP) { this.wcd = this.moves[WP].cd; this.wcdMax = this.wcd; this.ev.push({ t: 'weapon', id: this.moves[WP].weapon }); }
    if (id === GB) this.ev.push({ t: 'guardbreak' });
    this.__want = null; return r;
  };
  if (typeof reset === 'function') P.reset = function (...a) { const r = reset.apply(this, a); this.wcd = 0; return r; };
  P.__weapons = true;
  return true;
}

// ── reglas tras cada paso ──
const live = (f, d, k) => { const a = f.act; return a && a.def === d && d[k] && a.t >= d[k][0] && a.t < d[k][1]; };
function wardMods(f, w) { // mejoras pasivas + reducción de la desventaja elemental
  const p = w?.passive || {}, e = f.elem, k = Math.max(0, Math.min(1, num(p.ward)));
  let atk = 1 + num(p.atk), dmul = 1 - num(p.def);
  if (k > 0 && e?.rel === 'disadvantage') {
    const md = num(e.mods?.damage, 1); if (md > 0 && md < 1) atk *= (1 - (1 - md) * (1 - k)) / md; // recupera parte del daño perdido
    const D = num(f.__foeDamage, 1); if (D > 1) dmul *= (1 + (D - 1) * (1 - k)) / D; // y recibe menos del rival que tiene ventaja
  }
  return { atk, dmul, walk: 1 + num(p.speed), meter: num(p.meter) };
}
export function applyPassive(f, foe, w) {
  const key = f.elem || 'none'; if (f.__wpFor === key && f.__wpW === w) return false;
  if (f.__wpBase) { if (f.atk === f.__wpBase.atkAfter) f.atk = f.atk / f.__wpBase.atkK; f.dmul = f.__wpBase.dmul; f.walk = f.__wpBase.walk; } // deshace lo anterior (si el triángulo no lo hizo ya)
  f.__foeDamage = foe?.elem?.mods?.damage;
  const m = wardMods(f, w); f.__wpBase = { atkK: m.atk, dmul: f.dmul, walk: f.walk, meter: m.meter };
  f.atk *= m.atk; f.dmul *= m.dmul; f.walk *= m.walk; f.__wpBase.atkAfter = f.atk; f.__wpFor = key; f.__wpW = w;
  return true;
}
export function stepWeapons(m, W = {}) {
  const F = m.f || [];
  F.forEach((f, i) => {
    const foe = F[1 - i], w = W[i];
    if (w) applyPassive(f, foe, w);
    // Resonancia extra (pasiva): un porcentaje de lo que se gana
    const mb = f.__wpBase?.meter || 0; if (mb > 0 && f.__lastMeter != null && f.meter > f.__lastMeter && m.mode !== 'training') f.meter = Math.min(100, f.meter + (f.meter - f.__lastMeter) * mb);
    f.__lastMeter = f.meter;
    const a = f.act, d = a?.def; if (!d || a.name !== WP) return;
    // daga: invulnerable durante la guardia; si el rival ataca dentro del alcance → contraataque inmediato y reforzado
    if (d.parry && !a.parried && live(f, d, 'parry')) {
      const fa = foe.act, near = Math.abs(foe.x - f.x) < (fa?.def?.range || 0) + 1.2, hitting = fa && !fa.def.throw && fa.t >= fa.def.startup - .05 && fa.t < fa.def.startup + fa.def.active && near;
      const p = (m.proj || []).find(q => q.owner === foe && !q.dead && Math.abs(q.x - f.x) < 1.4 + q.w / 2 && Math.abs(q.y - 1.6) < 1.6);
      if (hitting || p) {
        a.parried = true; if (p) p.dead = true;
        a.def = { ...d, dmg: d.dmg * (d.riposte?.dmg || 2), hitstun: d.hitstun * (d.riposte?.hitstun || 1.5), parry: null }; a.t = Math.max(a.t, d.startup - .04); a.armed = true;
        if (fa && !p) { foe.act = null; foe.stun = foe.stunMax = .5; foe.stunType = 'hit'; foe.guarding = false; foe.hitN = (foe.hitN || 0) + 1; foe.hitKb = 2; } // desarmado: tambalea (no puede protegerse)
        f.ev.push({ t: 'parry' }); m.onWeaponEv?.({ t: 'parry', f, i });
      }
    }
    // abanico: devuelve los proyectiles del rival que tiene delante
    if (d.reflect && live(f, d, 'reflect')) for (const p of m.proj || []) {
      if (p.dead || p.owner === f) continue; const dx = (p.x - f.x) * f.facing;
      if (dx > -.3 && dx < (d.reach || 3) && Math.abs(p.y - 1.6) < 2) { p.owner = f; p.dir = f.facing; p.vx = Math.abs(p.vx) * f.facing; p.armed = true; p.hits = 0; p.t = Math.min(p.t, p.life * .3); p.reflected = true; m.onWeaponEv?.({ t: 'reflect', f, i, p }); }
    }
  });
  for (const p of m.proj || []) { // bumerán y trayectorias
    const d = p.def; if (!d) continue;
    if (d.vy) { p.y0 ??= p.y; p.y = p.y0 + d.vy * p.t; }
    if (d.boomerang && !p.dead) {
      if (!p.back && p.t >= p.life * .42) { p.back = true; p.vx = -p.vx; p.dir = -p.dir; p.armed = true; }
      if (p.back && Math.abs(p.x - p.owner.x) < .7) { p.dead = true; p.caught = true; m.onWeaponEv?.({ t: 'catch', f: p.owner, p }); }
    }
  }
}
// Proyectiles en abanico (cuchillos): copias del primero con distinta trayectoria vertical
export function fanCopies(e) {
  const d = e.def, n = d.fan | 0; if (n < 2) return [];
  const out = [];
  for (let k = 1; k < n; k++) { const s = (k % 2 ? 1 : -1) * Math.ceil(k / 2) * (d.spread || 2) / Math.max(1, Math.floor(n / 2)); out.push({ ...e, def: { ...d, fan: 0, vy: s } }); }
  return out;
}

// ── IA ──
const BLANK = () => ({ x: 0, jump: false, down: false, guard: false, l: false, m: false, h: false, s: false, r: false, w: false });
export function extraInput(brain, me, foe, dt) {
  const r = brain.rng || Math.random, P = brain.P || {}, M = me.moves || {}, d = Math.abs(foe.x - me.x), skill = (P.punish ?? .35) * .6 + (P.block ?? .5) * .4;
  if (P.noGuard || me.ko || me.stun > 0 || me.down > 0 || me.getup > 0 || me.air || me.stunType) return null; // el maniquí no usa extras
  // defensa contra el rompeguardia del rival: es lento, se interrumpe con un golpe rápido o se esquiva
  const fa = foe.act;
  if (fa?.name === GB && fa.t < fa.def.startup - .05 && d < 2.8 && !me.act && !brain.__gbSeen?.has?.(fa)) {
    (brain.__gbSeen ||= new WeakSet()).add(fa);
    if (r() < (P.block ?? .5) * .9) return d < 2 ? { ...BLANK(), l: true } : { ...BLANK(), x: -Math.sign(foe.x - me.x) || -1 };
  }
  // contra quien se cierra en guardia mucho rato, la CPU deja de tantear de lejos y se acerca a presionar
  brain.turtle = foe.guarding && !foe.act ? (brain.turtle || 0) + dt : Math.max(0, (brain.turtle || 0) - dt * 2);
  if (brain.turtle > 1.6 && d > 2.2 && !me.act && !P.noGuard) return { ...BLANK(), x: Math.sign(foe.x - me.x) || 1 };
  brain.xCool = (brain.xCool ?? 1) - dt; if (brain.xCool > 0 || me.act) return null;
  // rompeguardia: contra un rival que se protege mucho
  if (M[GB] && foe.guarding && d < 2.4 && r() < dt * 5 * (.4 + skill)) { brain.xCool = 1.6; return { ...BLANK(), m: true, h: true }; }
  const w = M[WP]; if (!w || (me.wcd || 0) > 0 || P.noGuard) return null;
  const go = () => { brain.xCool = 1.2; return { ...BLANK(), w: true }; };
  switch (w.ai) {
    case 'zone': if (d > 3 && r() < dt * 1.6 * (.5 + skill)) return go(); break;
    case 'antiair': if ((foe.air && d < 6 && foe.y > .8) || (d > 3 && r() < dt * .4)) { if (r() < dt * 6 * (.4 + skill)) return go(); } break;
    case 'counter': if ((fa && !fa.def.throw && fa.t < fa.def.startup && d < (fa.def.range || 2) + 1.4) || (foe.act?.def?.proj && d > 2.5)) { if (r() < (.25 + skill * .5)) return go(); } break;
    case 'pull': if (d > 2.4 && d < 3.3 && r() < dt * 2.5 * (.4 + skill)) return go(); break;
    case 'guard': if (d < 2.4 && (foe.guarding || foe.crouching) && r() < dt * 3 * (.4 + skill)) return go(); break;
  }
  if (r() < dt * .55 * (.5 + skill) && d < (w.proj ? 7 : (w.range || 2) + .4)) return go(); // de vez en cuando, para variar
  return null;
}
export function patchCpu(CpuBrain) {
  const P = CpuBrain?.prototype; if (!P || P.__weapons) return !!P?.__weapons;
  if (typeof P.think !== 'function') return false;
  const think = P.think;
  P.think = function (dt, me, foe) {
    const inp = think.call(this, dt, me, foe);
    try { const x = extraInput(this, me, foe, dt); if (x) return x; } catch (e) { console.warn('[armas] IA', e); }
    return inp;
  };
  P.__weapons = true;
  return true;
}
// Arma de la CPU (dificultad alta): elegida de forma estable según el rival, para que cada combate tenga identidad.
export function cpuWeapon(ids, rivalId, level) {
  if (!ids?.length || !(level === 'hard' || level === 'expert')) return null;
  let h = 0; for (const c of String(rivalId)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return ids[h % ids.length];
}
