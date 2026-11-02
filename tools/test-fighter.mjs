// Pruebas de la lógica de combate F2–F4 (npm test). No necesitan navegador.
import { readFileSync } from 'node:fs';
import { Fighter, separate, resolve, resolveBoth, resolveThrows, stepProjectiles, makeProjectile, movesFor, WORLD, RULES, COMBO_SCALE } from '../js/game/fighter.js';
import { CpuBrain } from '../js/game/ai.js';
const MOVES = JSON.parse(readFileSync('data/moves.json', 'utf8')), { roster } = JSON.parse(readFileSync('data/characters.json', 'utf8'));
let bad = 0; const ok = (c, m) => { if (!c) { console.error('FALLO:', m); bad++; } else console.log('ok  ', m); };
const R = id => roster.find(r => r.id === id);
const def = (v = 6, id = 'ignis') => ({ ...R(id), height: 3.3, stats: { velocidad: v, vida: 6, fuerza: 6, defensa: 5 } });
const mk = (x, f, v, id) => new Fighter(def(v, id), x, f, MOVES), DT = 1 / 60;
const I = o => ({ x: 0, jump: false, down: false, guard: false, l: false, m: false, h: false, s: false, r: false, ...o });
const evs = [], proj = [];
const step = (a, b, ia, ib) => {
  a.update(DT, ia, b); b.update(DT, ib, a); separate(a, b);
  evs.push(...resolveThrows(a, b).filter(e => e.type !== 'grab'));
  for (const e of resolveBoth(a, b)) evs.push(e);
  for (const f of [a, b]) for (const e of f.ev) if (e.t === 'proj') proj.push(makeProjectile(f, e));
  for (const e of stepProjectiles(proj, [a, b], DT)) if (e.type === 'hit') evs.push(e);
};
const sim = (a, b, ia, ib, sec) => { for (let i = 0; i < Math.round(sec * 60); i++) step(a, b, typeof ia === 'function' ? ia(i) : ia, typeof ib === 'function' ? ib(i) : ib); };
const HELD = ['x', 'down', 'guard'];
const once = (k, extra = {}) => i => I({ ...Object.fromEntries(Object.entries(extra).map(([n, v]) => [n, HELD.includes(n) ? v : v && i === 0])), [k]: i === 0 }); // botones: sólo el primer fotograma
const clr = () => { evs.length = 0; proj.length = 0; };
const pair = (gap = 1.8, ida = 'ignis', idb = 'ignis') => [mk(0, 1, 6, ida), mk(gap, -1, 6, idb)];
let a, b;

// --- datos
{ const M = movesFor(MOVES, 'terra'); ok(M.h.armor && M.l.cancel.includes('m') && M.s.proj && M.ex.meter === 25 && M.traits.airJumps === 0, 'movesFor mezcla los golpes comunes con los de cada guerrero');
  const all = roster.map(r => movesFor(MOVES, r.id)), need = ['l', 'm', 'h', 'cl', 'cm', 'ch', 'jl', 'jm', 'jh', 'throw', 's', 'ex'];
  ok(all.every(M => need.every(k => M[k] && M[k].startup > 0 && M[k].recovery >= 0)), '4 guerreros × 12 golpes (L/M/H de pie, agachado y aéreo, lanzamiento, especial y técnica reforzada)'); }

// --- movimiento (F2)
a = mk(-3, 1); b = mk(3, -1); sim(a, b, I({ x: 1 }), I(), 1); ok(a.x > -1.5, `camina a la derecha (x=${a.x.toFixed(2)})`);
a = mk(-3, 1); b = mk(3, -1); sim(a, b, I({ x: -1 }), I(), 20); ok(a.x === -WORLD.half, 'se detiene en el límite');
a = mk(-3, 1); b = mk(3, -1); let apex = 0; for (let i = 0; i < 90; i++) { a.update(DT, I({ jump: i === 0 }), b); apex = Math.max(apex, a.y); }
ok(apex > 1.8 && apex < 2.8 && !a.air, `salto razonable (${apex.toFixed(2)} m) y aterriza`);
a = mk(-3, 1); b = mk(3, -1); sim(a, b, I({ x: 1, jump: true, down: true }), I(), .5); ok(a.crouching && a.x === -3 && !a.air, 'agachado no camina ni salta');
a = mk(0, 1); b = mk(.2, -1); separate(a, b); ok(Math.abs(b.x - a.x) >= WORLD.minGap - 1e-9, 'no se superponen');
// carrera y retroceso rápido (doble toque)
{ a = mk(-6, 1); b = mk(6, -1); const tap = i => I({ x: i < 3 || (i >= 6) ? 1 : 0 }); sim(a, b, tap, I(), .2); ok(a.run, 'doble toque adelante → corre');
  const x0 = a.x; sim(a, b, I({ x: 1 }), I(), .3); ok(a.x - x0 > a.walk * .3 * 1.8, `correr es más rápido que caminar (${(a.x - x0).toFixed(2)})`);
  a = mk(0, 1); b = mk(4, -1); sim(a, b, i => I({ x: i < 3 || i >= 6 ? -1 : 0 }), I(), .12); ok(a.bdash > 0 && a.inv > 0, 'doble toque atrás → retroceso rápido con invulnerabilidad breve');
  sim(a, b, I(), I(), .5); ok(a.bdash === 0 && a.x < -1, `el retroceso termina y se aleja (x=${a.x.toFixed(2)})`); }
// doble salto: sólo Zephyr
{ const z = mk(0, 1, 6, 'zephyr'), ig = mk(0, 1, 6, 'ignis'), f = mk(5, -1); let az = 0, ai = 0;
  for (let i = 0; i < 120; i++) { const inp = I({ jump: i === 0 || i === 22 }); z.update(DT, inp, f); ig.update(DT, inp, f); az = Math.max(az, z.y); ai = Math.max(ai, ig.y); }
  ok(az > ai + .5, `Zephyr tiene doble salto (${az.toFixed(2)} m frente a ${ai.toFixed(2)} m)`); }

// --- golpes y daño (F3)
[a, b] = pair(); clr(); sim(a, b, once('l'), I(), 1);
const expect = movesFor(MOVES, 'ignis').l.dmg * a.atk * b.dmul;
ok(evs.length === 1 && !evs[0].blocked && Math.abs(b.maxHp - b.hp - expect) < 1e-6, `el ligero quita ${expect.toFixed(2)} de vida (${(b.maxHp - b.hp).toFixed(2)})`);
[a, b] = pair(4); clr(); sim(a, b, once('l'), I(), 1); ok(!evs.length && b.hp === b.maxHp, 'fuera de alcance no golpea');
[a, b] = pair(); clr(); sim(a, b, once('l'), I({ guard: true }), 1); ok(evs[0]?.blocked && b.hp === b.maxHp, 'la guardia de pie bloquea');
[a, b] = pair(); clr(); sim(a, b, once('l'), I({ x: 1 }), 1); ok(evs[0]?.blocked, 'retroceder también bloquea');
[a, b] = pair(); clr(); sim(a, b, once('l', { down: true }), I({ guard: true }), .5); ok(evs[0] && !evs[0].blocked && evs[0].move === 'cl', 'ligero agachado (bajo) atraviesa la guardia de pie');
[a, b] = pair(); clr(); sim(a, b, once('l', { down: true }), I({ guard: true, down: true }), .5); ok(evs[0]?.blocked, 'guardia agachada bloquea el golpe bajo');
[a, b] = pair(); b.x = 1.2; a.y = 1.5; a.air = true; a.vy = 0; clr(); sim(a, b, once('m'), I({ guard: true, down: true }), .4); ok(evs[0] && !evs[0].blocked && evs[0].move === 'jm', 'ataque aéreo (alto) atraviesa la guardia agachada');
[a, b] = pair(); b.x = 1.2; a.y = 1.5; a.air = true; a.vy = 0; clr(); sim(a, b, once('m'), I({ guard: true }), .4); ok(evs[0]?.blocked, 'guardia de pie bloquea el ataque aéreo');
[a, b] = pair(); b.y = 1.2; b.air = true; b.vy = 8; clr(); sim(a, b, once('l', { down: true }), I(), .3); ok(!evs.length, 'saltar esquiva el golpe bajo');
[a, b] = pair(); clr(); sim(a, b, once('l'), I(), .12); sim(a, b, I(), I({ x: 1, jump: true, l: true }), .1); ok(b.stun > 0 && !b.act && !b.air, 'en aturdimiento no se puede actuar');
// fuerza: medio y pesado
{ const M = movesFor(MOVES, 'ignis'); ok(M.l.startup < M.m.startup && M.m.startup < M.h.startup && M.l.dmg < M.m.dmg && M.m.dmg < M.h.dmg, 'ligero < medio < pesado en velocidad de salida y daño');
  [a, b] = pair(2.2); clr(); sim(a, b, once('h'), I(), 1); ok(evs[0] && evs[0].move === 'h' && evs[0].dmg > expect * 2, `el pesado conecta y pega fuerte (${evs[0]?.dmg.toFixed(1)})`); }

// --- búfer de entradas
{ [a, b] = pair(5); clr(); sim(a, b, once('l'), I(), .1); ok(a.act?.name === 'l', 'golpe en curso (fallado: sin cancelación posible)');
  const t = a.act.def.startup + a.act.def.active + a.act.def.recovery - a.act.t; sim(a, b, I(), I(), t - 5 * DT);
  sim(a, b, once('m'), I(), 3 * DT); ok(!a.act || a.act.name === 'l', 'pulsar M unos fotogramas antes del final…');
  sim(a, b, I(), I(), 6 * DT); ok(evs.some(e => e.move === 'm') || a.act?.name === 'm' || a.used.includes('m'), '…lo ejecuta en cuanto termina el anterior (búfer de 6 fotogramas)');
  [a, b] = pair(); a.update(DT, I({ l: true }), b); for (let i = 0; i < 30; i++) a.update(DT, I(), b); ok(!a.act, 'una pulsación antigua (fuera de la ventana) se descarta'); }
// secuencia ↓ ↘ → + golpe = técnica especial (entrada alternativa a U)
{ [a, b] = pair(5); const seq = [I({ down: true }), I({ down: true, x: 1 }), I({ x: 1, l: true })]; for (const s of seq) a.update(DT, s, b);
  ok(a.act?.name === 's', '↓ ↘ → + ligero ejecuta la técnica especial');
  [a, b] = pair(5); for (const s of [I({ down: true }), I({ x: 1, m: true })]) a.update(DT, s, b); ok(a.act?.name === 's', 'la secuencia es tolerante (↓ → sin la diagonal también vale)');
  [a, b] = pair(5); a.update(DT, I({ s: true }), b); ok(a.act?.name === 's', 'U ejecuta la técnica especial directamente'); }

// --- cancelaciones y combos
{ [a, b] = pair(1.6); clr(); const seq = ['l', 'm', 'h', 's']; let k = 0;
  sim(a, b, () => { const nx = seq[k]; if (nx && (k === 0 || (a.act && a.act.hits && a.act.name === seq[k - 1]))) { k++; return I({ [nx]: true }); } return I(); }, I(), 2);
  ok(evs.length >= 4 && b.combo >= 4 || evs.filter(e => !e.blocked).length >= 4, `cadena L→M→H→especial conecta ${evs.length} golpes (combo ${Math.max(...evs.map(e => e.combo))})`);
  const hs = evs.filter(e => !e.blocked); ok(hs.length >= 2 && hs[1].dmg < movesFor(MOVES, 'ignis').m.dmg * a.atk * b.dmul, 'el daño escala hacia abajo dentro del combo');
  [a, b] = pair(1.6); clr(); sim(a, b, () => I({ h: true }), I(), .2); ok(!a.used.includes('l') && a.chain === 0, 'no se cancela de pesado a ligero (reglas por golpe)');
  [a, b] = pair(1.6); clr(); let mc = 0; sim(a, b, i => { mc = Math.max(mc, a.chain); return I({ l: i % 3 === 0 }); }, I({ guard: true }), 2);
  ok(mc <= 1 && evs.length >= 2, `ligero→ligero tiene tope de repeticiones (cadena máx ${mc})`);
  [a, b] = pair(1.6); clr(); sim(a, b, once('m'), I(), .5); ok(!evs.length || a.used.length === 1, 'sin contacto, un golpe no se cancela');
}
// lanzador agachado → salto cancelable → combo aéreo; límite de golpes en el aire
{ [a, b] = pair(1.5); clr(); let k = 0;
  sim(a, b, i => { if (k === 0) { k = 1; return I({ h: true, down: true }); } if (k === 1 && a.act?.hits) { k = 2; return I({ jump: true, x: 1 }); } if (k >= 2 && a.air && i % 9 === 0) return I({ l: k++ % 3 === 0, m: k % 3 === 1, h: k % 3 === 2 }); return I(); }, I(), 2);
  ok(evs[0]?.move === 'ch' && evs[0].launch, 'el pesado agachado lanza al rival por los aires');
  ok(evs.some(e => /^j/.test(e.move) && !e.blocked), `se continúa en el aire tras cancelar con salto (${evs.map(e => e.move).join(' ')})`);
  ok(b.down > 0 || b.getup > 0 || !b.air, 'el lanzado cae derribado y se levanta');
  const v = mk(0, 1); v.air = true; v.launched = true; v.juggle = RULES.juggleMax; const at = mk(-1, 1); at.air = true; at.y = .5; v.y = .5; at.act = { name: 'jl', def: movesFor(MOVES, 'ignis').jl, t: .08, hits: 0, armed: true }; ok(!resolve(at, v), `tras ${RULES.juggleMax} golpes aéreos el rival ya no es vulnerable (sin combos infinitos)`); }
// derribo: invulnerable al levantarse
{ [a, b] = pair(1.6); b.launched = true; b.air = true; b.y = .1; b.vy = -1; sim(a, b, I(), I(), .1); ok(b.down > 0, 'al aterrizar lanzado queda derribado');
  a.act = { name: 'l', def: movesFor(MOVES, 'ignis').l, t: .07, hits: 0, armed: true }; a.x = b.x - 1.4; ok(!resolve(a, b), 'derribado no recibe golpes'); sim(a, b, I(), I(), RULES.downT + .05); ok(b.getup > 0, 'luego se levanta (también invulnerable)'); sim(a, b, I(), I(), RULES.getupT + .05); ok(!b.down && !b.getup && b.state !== 'down', 'y vuelve a estar en pie'); }

// --- lanzamientos
{ [a, b] = pair(1.2); clr(); sim(a, b, once('l', { m: true }), I(), 1.2); const t = evs.find(e => e.type === 'throw');
  ok(t && t.dmg > 10 && b.hp < b.maxHp, `L+M cerca agarra y lanza (${t?.dmg.toFixed(1)} de daño)`);
  ok(b.down > 0 || b.getup > 0 || b.launched || b.air, 'el lanzado cae derribado');
  [a, b] = pair(1.2); clr(); sim(a, b, once('l', { m: true }), i => I({ l: i === 10, m: i === 10 }), 1); ok(evs.some(e => e.type === 'tech') && b.hp === b.maxHp, 'pulsar L+M a tiempo escapa del agarre');
  [a, b] = pair(1.2); clr(); sim(a, b, once('l', { m: true }), I({ guard: true }), 1); ok(evs.some(e => e.type === 'throw'), 'el lanzamiento atraviesa la guardia');
  [a, b] = pair(3); clr(); sim(a, b, once('l', { m: true }), I(), .2); ok(a.act?.name === 'throw' && a.act.missed, 'fallar el agarre deja una recuperación castigable');
  [a, b] = pair(1.2); b.stun = .3; b.stunType = 'hit'; clr(); sim(a, b, once('l', { m: true }), I(), .15); ok(!evs.some(e => e.type === 'throw') && !a.act?.grab, 'no se puede agarrar a un rival aturdido (protección)');
  [a, b] = pair(1.2); const x0 = a.x; clr(); sim(a, b, once('l', { m: true, x: -1 }), I(), 1.2); ok(evs.some(e => e.type === 'throw' && e.back) && b.x < x0, 'con ← el lanzamiento es hacia atrás (cambia de lado)'); }

// --- especiales y proyectiles
{ [a, b] = pair(5, 'aqua', 'ignis'); clr(); sim(a, b, once('s'), I(), 1.5); ok(evs.some(e => e.proj && !e.blocked), 'Aqua: la Hidrolanza viaja y golpea a distancia');
  [a, b] = pair(5, 'aqua', 'ignis'); clr(); sim(a, b, once('s'), I({ guard: true }), 1.5); ok(evs[0]?.blocked && b.hp < b.maxHp && b.hp > b.maxHp - 3, 'un especial bloqueado hace un poco de daño (chip)');
  [a, b] = pair(5, 'terra', 'ignis'); clr(); sim(a, b, once('s'), I(), 1.5); ok(evs.some(e => e.proj && e.launch), 'Terra: la Falla avanza por el suelo y derriba');
  [a, b] = pair(5, 'terra', 'ignis'); clr(); sim(a, b, once('s'), i => I({ jump: i === 24 }), 1.5); ok(!evs.length, 'saltar evita la Falla (sólo golpea en el suelo)');
  [a, b] = pair(5, 'aqua', 'aqua'); clr(); sim(a, b, once('s'), once('s'), 1.5); ok(!evs.length && proj.every(p => p.dead), 'dos técnicas a distancia que chocan se anulan');
  [a, b] = pair(1.6, 'zephyr', 'ignis'); clr(); const side0 = Math.sign(b.x - a.x); sim(a, b, once('s'), I(), .9); ok(evs.some(e => e.move === 's') && Math.sign(b.x - a.x) !== side0, 'Zephyr: la Tempestad atraviesa al rival y cambia de lado');
  [a, b] = pair(3, 'ignis', 'ignis'); clr(); sim(a, b, once('s'), I(), 1); ok(evs[0]?.move === 's' && evs[0].launch, 'Ignis: la Embestida recorre distancia y derriba'); }

// --- Resonancia Elemental
{ [a, b] = pair(1.6); clr(); sim(a, b, once('l'), I(), .5); ok(a.meter > 0 && b.meter > 0 && a.meter > b.meter, `golpear llena más la barra que recibir (${a.meter.toFixed(1)} / ${b.meter.toFixed(1)})`);
  a = mk(-3, 1); b = mk(3, -1); sim(a, b, I({ x: 1 }), I(), 3); ok(a.meter === 0, 'caminar sin combatir no llena la barra');
  // técnica reforzada: cuesta exCost una sola vez
  [a, b] = pair(2, 'ignis', 'aqua'); a.meter = 60; clr(); sim(a, b, once('r'), I(), 1.2); ok(evs.filter(e => e.move === 'ex').length >= 2, `R en neutro: Ruptura Carmesí (varios golpes: ${evs.filter(e => e.move === 'ex').length})`);
  [a, b] = pair(2, 'ignis', 'aqua'); a.meter = 30; let m0 = a.meter; a.update(DT, I({ r: true }), b); const spent = m0 - a.meter; a.update(DT, I({ r: true }), b);
  ok(spent === RULES.exCost && a.act?.name === 'ex' && a.meter === 5, 'la energía se gasta una sola vez y no permite una segunda técnica sin barra');
  [a, b] = pair(2); a.meter = 10; a.update(DT, I({ r: true }), b); ok(!a.act && a.meter === 10, 'sin energía suficiente no ocurre nada');
  // cancelación resonante
  [a, b] = pair(5); a.meter = 60; sim(a, b, once('h'), I(), .3); ok(a.act?.name === 'h' && a.act.t > a.act.def.startup, 'pesado fallado en recuperación…');
  a.update(DT, I({ r: true }), b); ok(!a.act && a.meter === 60 - RULES.rcCost && a.ev.some(e => e.t === 'rc'), '…R lo cancela (cuesta 50) y el guerrero puede actuar');
  // repulsión en guardia
  [a, b] = pair(1.6); b.meter = 55; clr(); sim(a, b, once('h'), I({ guard: true }), .3); ok(b.stunType === 'block', 'en bloqueo…');
  const mb = b.meter; b.update(DT, I({ guard: true, r: true }), a); ok(b.stun === 0 && Math.abs(mb - b.meter - RULES.repelCost) < 1e-9 && b.ev.some(e => e.t === 'repel'), '…R repele la presión (cuesta 50)');
  // EX como cancelación de un golpe que conectó
  [a, b] = pair(1.6); a.meter = 40; clr(); let k = 0; sim(a, b, () => { if (k === 0) { k = 1; return I({ m: true }); } if (k === 1 && a.act?.hits) { k = 2; return I({ r: true }); } return I(); }, I(), 1.2);
  ok(a.used.includes('ex') || evs.some(e => e.move === 'ex'), 'M → R encadena la técnica reforzada en combo'); }

// --- armadura de Terra y guardia rota
{ [a, b] = pair(2.4, 'ignis', 'terra'); clr(); sim(a, b, i => I({ l: i === 6 }), once('h'), 1);
  ok(evs.some(e => e.armored) && evs.some(e => e.a === b && !e.blocked), 'el pesado de Terra aguanta un golpe ligero (armadura) y conecta');
  [a, b] = pair(1.6); clr(); for (let i = 0; i < 20; i++) { sim(a, b, once('h'), I({ guard: true }), .9); a.x = 0; b.x = 1.6; if (evs.some(e => e.crush)) break; }
  ok(evs.some(e => e.crush), 'bloquear sin parar acaba rompiendo la guardia'); }

// --- KO
[a, b] = pair(); b.hp = 1; clr(); sim(a, b, once('m'), I(), 1);
ok(b.ko && b.hp === 0 && evs[0].ko, 'KO cuando la vida llega a 0'); sim(a, b, I(), I({ x: 1, l: true }), 1); ok(b.ko && !b.act, 'un derribado no actúa');
[a, b] = pair(); b.hp = 1; clr(); sim(a, b, once('l'), I({ guard: true }), 1); ok(b.hp >= 1 && !b.ko, 'el bloqueo nunca mata');
b.revive(); ok(!b.ko && b.hp === b.maxHp, 'revive restaura la vida');

// --- CPU
{ let sd = 99; const brain = new CpuBrain(() => (sd = (sd * 16807) % 2147483647) / 2147483647); a = mk(0, 1); b = mk(5, -1); let atk = 0, kinds = new Set();
  for (let i = 0; i < 60 * 20; i++) { const inp = brain.think(DT, b, a); b.update(DT, inp, a); a.update(DT, I(), b); separate(a, b); if (b.took && b.took !== 'jump') { atk++; kinds.add(b.took); } }
  ok(atk > 0 && Math.abs(a.x - b.x) < 3.5, `la CPU se acerca y ataca (${atk} ataques: ${[...kinds].join(' ')})`); ok(kinds.size >= 3, 'la CPU usa golpes variados'); }

console.log(bad ? `${bad} fallo(s)` : 'Todas las pruebas pasaron'); process.exit(bad ? 1 : 0);
