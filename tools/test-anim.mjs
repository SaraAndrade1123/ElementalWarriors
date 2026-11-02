// Pruebas del sistema de animación (npm test). Sin navegador ni Three.js.
import { readFileSync } from 'node:fs';
import { Fighter, separate, resolveBoth, resolveThrows, stepProjectiles, makeProjectile, movesFor } from '../js/game/fighter.js';
import { CpuBrain } from '../js/game/ai.js';
import { STYLES } from '../js/game/animation/styles.js';
import { buildAttacks, ATTACKS, warpTime } from '../js/game/animation/attacks.js';
import { Director } from '../js/game/animation/director.js';
import { evalClip, N, IDX, CH } from '../js/game/animation/pose.js';
const MOVES = JSON.parse(readFileSync('data/moves.json', 'utf8')), { roster } = JSON.parse(readFileSync('data/characters.json', 'utf8'));
let bad = 0; const ok = (c, m) => { if (!c) { console.error('FALLO:', m); bad++; } else console.log('ok  ', m); };
const DT = 1 / 60, COMBAT = ['l', 'm', 'h', 'cl', 'cm', 'ch', 'jl', 'jm', 'jh', 'throw', 's', 'ex'];
const I = o => ({ x: 0, jump: false, down: false, guard: false, l: false, m: false, h: false, s: false, r: false, ...o });

// 1 · biblioteca completa por guerrero
{ let fin = true, win = true, own = true; const base = new Float32Array(N), out = new Float32Array(N), sigs = {};
  for (const id of Object.keys(STYLES)) { const cl = buildAttacks(STYLES[id]);
    for (const n of ATTACKS) { const c = cl[n]; if (!c) { fin = false; console.error('falta', id, n); continue; }
      if (COMBAT.includes(n) && !(c.hit && c.hit[0] > 0 && c.hit[1] > c.hit[0] && c.hit[1] < c.dur)) { win = false; console.error('ventana', id, n); }
      for (let k = 0; k <= 80; k++) { evalClip(c, c.dur * k / 80 * .999, base, out); if (out.some(v => !isFinite(v))) fin = false; } }
    sigs[id] = COMBAT.map(n => { evalClip(cl[n], cl[n].hit[0], base, out); return Array.from(out).map(v => v.toFixed(2)).join(); }).join('|'); }
  ok(fin, `4 guerreros × ${ATTACKS.length} clips (12 de combate + presentación, victoria y levantarse) completos y finitos`); ok(win, 'cada clip de combate declara su ventana de impacto');
  ok(new Set(Object.values(sigs)).size === 4, 'cada guerrero tiene animaciones propias (no son copias con otro material)'); }

// 2 · re-temporización: el impacto del clip coincide con la ventana activa de moves.json (todos los guerreros y golpes)
{ let good = true, mono = true;
  for (const id of Object.keys(STYLES)) { const cl = buildAttacks(STYLES[id]), M = movesFor(MOVES, id);
    for (const mv of COMBAT.filter(n => n !== 'throw')) { const d = M[mv], c = cl[mv], w = t => warpTime(c, { t, def: d });
      if (Math.abs(w(d.startup) - c.hit[0]) > 1e-6 || Math.abs(w(d.startup + d.active) - c.hit[1]) > 1e-6) { good = false; console.error(id, mv); }
      let prev = -1; for (let t = 0; t < d.startup + d.active + d.recovery + .3; t += .005) { const v = w(t); if (v < prev - 1e-9 || v > c.dur) mono = false; prev = v; } } }
  ok(good, 'en los 4 guerreros el golpe del clip cae en la ventana activa real'); ok(mono, 'el tiempo re-temporizado avanza siempre y no se sale del clip');
  const c = buildAttacks(STYLES.ignis).throw, d = movesFor(MOVES, 'ignis').throw, a = { t: 0, def: d };
  const seq = []; for (const [t, ex] of [[.05, {}], [.2, { grab: true, g0: .09 }], [.6, { grab: true, g0: .09 }], [.7, { done: true, g0: .09 }]]) seq.push(warpTime(c, { ...a, t, ...ex }));
  ok(seq.every((v, i) => i === 0 || v >= seq[i - 1]) && seq[3] > c.hit[1], 'el lanzamiento recorre alcance → sujeción → lanzamiento'); }

// 3 · combates IA vs IA con todo el kit: poses finitas, sin saltos bruscos y todos los estados visitados
{ let nan = false, worst = 0, states = new Set(), trails = 0, cues = 0;
  const SKIP = new Set(['comYaw', 'comPitch', 'comRoll', 'wpSpin', 'hnFpitch', 'hnBpitch']); // giros completos y ángulo de hoja: pueden dar vueltas
  const ANG = CH.map((c, i) => !SKIP.has(c) && /^(sp|pel|hd)/.test(c) ? i : -1).filter(i => i >= 0);
  for (let seed = 1; seed <= 4; seed++) {
    let s = seed * 7919; const rng = () => (s = (s * 16807) % 2147483647) / 2147483647;
    const A = roster[seed - 1], B = roster[seed % 4], a = new Fighter(A, -2.2, 1, MOVES), b = new Fighter(B, 2.2, -1, MOVES);
    const ba = new CpuBrain(rng, 'hard'), bb = new CpuBrain(rng, 'expert'), da = new Director(STYLES[A.id], { legLen: 1.6 }), db = new Director(STYLES[B.id], { legLen: 1.6 });
    const prev = new Map(), proj = [];
    for (let i = 0; i < 60 * 40; i++) {
      a.update(DT, ba.think(DT, a, b), b); b.update(DT, bb.think(DT, b, a), a); separate(a, b); resolveThrows(a, b); resolveBoth(a, b);
      for (const f of [a, b]) for (const e of f.ev) if (e.t === 'proj') proj.push(makeProjectile(f, e)); stepProjectiles(proj, [a, b], DT);
      if (a.ko || b.ko) { a.revive(); b.revive(); }
      for (const [f, d] of [[a, da], [b, db]]) {
        f.crouch = (f.crouch || 0) + ((f.crouching ? 1 : 0) - (f.crouch || 0)) * (1 - Math.exp(-DT * 22)); const P = d.compose(DT, f); // igual que match.render if (P.some(v => !isFinite(v))) nan = true;
        states.add(f.state.replace(/^(guard-c|guard)$/, 'guard')); trails += d.trails.length; cues += d.cues.length;
        const q = prev.get(d); if (q && !(f.stun > 0 && d.hitT < DT * 1.5)) for (const k of ANG) worst = Math.max(worst, Math.abs(P[k] - q[k]));
        prev.set(d, P);
      } } }
  ok(!nan, 'ninguna pose tiene valores inválidos en 4 combates de 40 s con el kit completo');
  const need = ['idle', 'walk', 'jump', 'hit', 'block', 'down', 'getup', 'l', 'm', 'h', 's'];
  ok(need.every(s => states.has(s)), `estados recorridos: ${[...states].sort().join(' ')}`);
  ok(worst < .5, `sin saltos bruscos en torso/cabeza entre fotogramas (máx ${worst.toFixed(2)} rad en 1/60 s)`);
  ok(trails > 50 && cues > 5, `los golpes generan estelas (${trails} fotogramas) y efectos sincronizados (${cues})`); }

// 4 · reacciones
{ const mk = (x, f) => new Fighter(roster[0], x, f, MOVES), a = mk(0, 1), b = mk(1.5, -1), d = new Director(STYLES.ignis, { legLen: 1.6 });
  for (let i = 0; i < 30; i++) d.compose(DT, b); const idle = d.compose(DT, b);
  a.update(DT, I({ m: true }), b); let e = null;
  for (let i = 0; i < 40 && !e; i++) { a.update(DT, I(), b); b.update(DT, I(), a); e = resolveBoth(a, b)[0]; }
  ok(e && !e.blocked && b.hitN === 1, 'el impacto registra hitN'); let P; for (let i = 0; i < 6; i++) P = d.compose(DT, b);
  ok(P[IDX.hdPitch] < idle[IDX.hdPitch] - .15 && P[IDX.spPitch] < idle[IDX.spPitch] - .12, 'al recibir el golpe la cabeza y el torso se arquean hacia atrás');
  const g = mk(1.5, -1); const dg = new Director(STYLES.terra, { legLen: 1.6 }); let Q; for (let i = 0; i < 20; i++) Q = dg.compose(DT, { ...g, guarding: true });
  const di = new Director(STYLES.terra, { legLen: 1.6 }); let Z; for (let i = 0; i < 20; i++) Z = di.compose(DT, g);
  ok(Q[IDX.hnFy] > Z[IDX.hnFy] + .1, 'en guardia las manos suben a proteger la cara');
  const dk = new Director(STYLES.aqua, { legLen: 1.6 }); let K; for (let i = 0; i < 30; i++) K = dk.compose(DT, { ...g, down: .3 });
  ok(K[IDX.comPitch] < -1.2 && K[IDX.comY] < -.5 * 1.6, 'derribado: el cuerpo queda tumbado boca arriba');
  let G; for (let i = 0; i < 8; i++) G = dk.compose(DT, { ...g, down: 0, getup: .35 - i * DT }); ok(G[IDX.comPitch] < -.5 && G[IDX.comPitch] > K[IDX.comPitch], 'al levantarse se incorpora poco a poco'); }

// 5 · estelas y efectos: sólo durante el golpe, y cada efecto se emite una vez
{ const d = new Director(STYLES.ignis, { legLen: 1.6 }), f = new Fighter(roster[0], 0, 1, MOVES), foe = new Fighter(roster[1], 5, -1, MOVES); let tr = 0, cu = [];
  f.update(DT, I({ h: true }), foe); for (let i = 0; i < 60; i++) { f.update(DT, I(), foe); d.compose(DT, f); tr += d.trails.length ? 1 : 0; cu.push(...d.cues.map(c => c.kind)); }
  ok(tr > 3 && tr < 40, `el pesado de Ignis dibuja estela durante el corte (${tr} fotogramas)`); ok(cu.filter(k => k === 'flame_arc').length === 1, 'el efecto de llamas se dispara una sola vez');
  for (let i = 0; i < 30; i++) d.compose(DT, f); ok(d.trails.length === 0, 'en reposo no hay estelas'); }

console.log(bad ? `${bad} fallo(s)` : 'Todas las pruebas de animación pasaron'); process.exit(bad ? 1 : 0);
