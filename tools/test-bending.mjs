// Pruebas del CONTROL ELEMENTAL (npm test): datos, entradas, cancelaciones, proyectiles especiales, interacción con el
// triángulo elemental, IA, animaciones (12 clips) y la integración en partidas reales (Match + ganchos, sin DOM).
import { register } from 'node:module'; import { readFileSync } from 'node:fs'; import { pathToFileURL } from 'node:url';
const three = pathToFileURL(process.cwd() + '/js/vendor/three/build/three.module.js').href;
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s,c,n){ if(s==='three') return {url:'${three}',shortCircuit:true}; return n(s,c); }`));
const ctx = new Proxy({}, { get: (_, k) => k === 'createLinearGradient' || k === 'createRadialGradient' ? () => ({ addColorStop() {} }) : () => {} });
globalThis.document = { createElement: () => ({ getContext: () => ctx }), documentElement: {}, querySelectorAll: () => [] };
globalThis.fetch = async p => ({ ok: true, json: async () => JSON.parse(readFileSync(p, 'utf8')) });
const THREE = await import('three');
const { Fighter, NONE, RULES } = await import('../js/game/fighter.js');
const { Match } = await import('../js/game/match.js');
const { CpuBrain } = await import('../js/game/ai.js');
const { loadLocale } = await import('../js/systems/localization.js');
const B = await import('../js/game/bending.js');
const { buildBending, BENDING_CLIPS } = await import('../js/game/animation/bending-clips.js');
const { styleFor } = await import('../js/game/animation/styles.js');
const { evalClip, N, CH } = await import('../js/game/animation/pose.js');
const { warpTime } = await import('../js/game/animation/attacks.js');
const { installElements } = await import('../js/elements/element-hook.js');
const { installBending } = await import('../js/elements/bending-hook.js');
await loadLocale('es');

const rd = p => JSON.parse(readFileSync(p, 'utf8'));
const data = rd('data/bending.json'), edata = rd('data/elements.json'), raw = readFileSync('data/moves.json', 'utf8'), moves0 = JSON.parse(raw), { roster } = rd('data/characters.json');
const moves = B.mergeBending(moves0, data), IDS = roster.map(r => r.id);
let bad = 0; const ok = (c, m) => { if (!c) { console.error('FALLO:', m); bad++; } else console.log('ok  ', m); };
const near = (a, b, e = 1e-6) => Math.abs(a - b) <= e;
const R = id => roster.find(r => r.id === id), DT = 1 / 60, I = o => ({ ...NONE, ...o });
B.patchFighter(Fighter, RULES);

// ── 1 · datos ──
const probs = B.validateBending(data, roster); ok(!probs.length, 'data/bending.json válido: 3 técnicas por guerrero' + (probs.length ? ' → ' + probs.join('; ') : ''));
ok(JSON.stringify(B.mergeBending(moves0, data).ignis.eb) === JSON.stringify(data.ignis.eb) && raw === readFileSync('data/moves.json', 'utf8') && !moves0.ignis.eb, 'se añaden sobre una copia (data/moves.json intacto)');
ok(IDS.every(id => new Set(B.BEND_IDS.map(k => data[id][k].proj?.kind || 'melee')).size === 3), 'las tres técnicas de cada guerrero son distintas entre sí');

// ── 2 · entradas ──
const SEQ = { '→+U': [{ x: 1, s: true }], '↓+U': [{ down: true, s: true }], 'U': [{ s: true }], '←+U': [{ x: -1, s: true }],
  '↓↙←+J': [{ down: true }, { down: true, x: -1 }, { x: -1 }, { x: -1, l: true }], '→↓↘+J': [{ x: 1 }, {}, { down: true }, { down: true, x: 1, l: true }], '↓↘→+J': [{ down: true }, { down: true, x: 1 }, { x: 1, l: true }] };
const WANT = { '→+U': 'eb', '↓+U': 'eu', 'U': 's', '←+U': 's', '↓↙←+J': 'eb', '→↓↘+J': 'eu', '↓↘→+J': 's' };
for (const id of IDS) {
  const got = {};
  for (const [k, seq] of Object.entries(SEQ)) { const a = new Fighter(R(id), 0, 1, moves), b = new Fighter(R('terra'), 4, -1, moves); let g = null; for (let i = 0; i < 20 && !g; i++) { a.update(DT, I(seq[i] || {}), b); if (a.act) g = a.act.name; } got[k] = g; }
  ok(Object.entries(WANT).every(([k, v]) => got[k] === v), `${id}: →+U, ↓+U, ↓↙←, →↓↘ dan control elemental; U, ←+U y ↓↘→ siguen siendo la especial (${JSON.stringify(got)})`);
  const a = new Fighter(R(id), 0, 1, moves), b = new Fighter(R('terra'), 4, -1, moves); a.update(DT, I({ jump: true }), b); for (let i = 0; i < 8; i++) a.update(DT, NONE, b); a.update(DT, I({ s: true }), b);
  ok(a.act?.name === 'ej' && a.air, `${id}: U en el aire = técnica aérea`);
}
{ // mirando a la izquierda las direcciones se invierten
  const a = new Fighter(R('ignis'), 2, -1, moves), b = new Fighter(R('aqua'), -2, 1, moves); a.update(DT, I({ x: -1, s: true }), b); ok(a.act?.name === 'eb', 'mirando a la izquierda, ←+U es «adelante» (proyección)'); }
{ // cancelaciones
  const a = new Fighter(R('ignis'), 0, 1, moves), b = new Fighter(R('terra'), 1.3, -1, moves); a.update(DT, I({ l: true }), b); a.update(DT, NONE, b);
  a.update(DT, I({ x: 1, s: true }), b); ok(a.act?.name === 'l', 'un golpe que falla NO se cancela en control elemental');
  a.act.hits = 1; a.update(DT, I({ x: 1, s: true }), b); ok(a.act?.name === 'eb', 'un golpe que conecta se cancela en control elemental (como la especial)');
  a.act.hits = 1; a.update(DT, I({ down: true, s: true }), b); ok(a.act?.name === 'eb', 'una técnica no se cancela en otra'); }

// ── 3 · partidas reales con los ganchos ──
const mkChar = r => ({ def: r, holder: new THREE.Group() }), cam = new THREE.PerspectiveCamera(32, 16 / 9);
const fakeScene = () => ({ scene: new THREE.Scene(), stage: new THREE.Group(), q: { particles: 300 }, match: null,
  startMatch(a, b, input, o) { this.match = new Match(this, input, mkChar(R(a)), mkChar(R(b)), o); }, endMatch() { this.match?.dispose(); this.match = null; } });
function play(a, b, { mode = 'training', bot = () => I(), p2 = null, el = true } = {}) {
  const sc = fakeScene(); if (el) installElements({ scene: sc, roster, data: edata, url: null }); installBending({ scene: sc, roster, data, url: null });
  const input = { cur: I(), read() { const c = this.cur; this.cur = I({ x: c.x, down: c.down, guard: c.guard }); return c; }, clear() {} };
  sc.startMatch(a, b, input, { moves: moves0, mode, onHud() {}, onFx() {} }); const m = sc.match; m.phase = 'fight';
  if (p2) m.brain = { think: (dt, me, foe) => p2(m, me, foe) }; else if (mode === 'training') m.dummy = 'stand';
  let i = 0; const run = (sec, until) => { for (let k = 0; k < sec * 60; k++, i++) { input.cur = bot(m, i); m.update(DT, cam); if (until?.(m)) return true; } return false; };
  return { m, run, sc };
}
{ const { m } = play('ignis', 'aqua'); ok(B.BEND_IDS.every(k => m.f[0].moves[k] && m.f[1].moves[k]), 'scene.startMatch añade las técnicas a los dos luchadores'); }
// proyectiles: cada técnica crea el suyo y golpea
for (const [id, k, kind, setup] of [['ignis', 'eb', 'fireball', { x: 1 }], ['zephyr', 'eb', 'gust', { x: 1 }], ['terra', 'eb', 'boulder', { x: 1 }], ['zephyr', 'eu', 'tornado', { down: true }]]) {
  const { m, run } = play(id, 'terra', { bot: (mm, i) => i === 2 ? I({ ...setup, s: true }) : I() }); m.f[1].x = m.f[0].x + 4;
  const seen = run(1.2, mm => mm.proj.some(p => p.kind === kind)); const hit = run(2.5, mm => mm.f[1].hp < mm.f[1].maxHp);
  ok(seen && hit, `${id} ${k}: aparece «${kind}» y golpea al rival a distancia`);
}
{ // diagonal: la técnica aérea baja y estalla al tocar el suelo
  const { m, run } = play('ignis', 'terra', { bot: (mm, i) => I({ jump: i === 1, s: i === 22 }) }); m.f[1].x = 7.5; let y0 = null, y1 = null, landed = false;
  for (let k = 0; k < 120; k++) { run(DT); const p = m.proj.find(q => q.kind === 'comet'); if (p) { y0 ??= p.y; y1 = p.y; if (p.landed) landed = true; } }
  ok(y0 != null && y1 < y0 - .5, `el cometa de fuego baja en diagonal (${y0?.toFixed(2)} → ${y1?.toFixed(2)})`); ok(landed && !m.proj.some(p => p.kind === 'comet'), 'y se deshace al tocar el suelo'); }
{ // golpe alto: hay que bloquear de pie
  const ab = crouch => { const { m, run } = play('zephyr', 'ignis', { bot: (mm, i) => I({ jump: i === 1, s: i === 20 }), p2: () => I({ guard: true, down: crouch }) }); m.f[1].x = m.f[0].x + 2.4; let blk = false; run(1.5, mm => { blk ||= mm.f[1].bkN > 0; return mm.f[1].hp < mm.f[1].maxHp; }); return { blk, hp: m.f[1].hp < m.f[1].maxHp }; };
  const st = ab(false), cr = ab(true); ok(st.blk && cr.hp, 'la bala de aire es un golpe alto: se bloquea de pie, no agachado'); }
{ // géiser: lanza a un rival que salta encima
  const { m, run } = play('aqua', 'zephyr', { bot: (mm, i) => i === 2 ? I({ down: true, s: true }) : I() }); m.f[1].x = m.f[0].x + 3;
  ok(run(1.2, mm => mm.f[1].launched), 'el Géiser brota a distancia y lanza al rival'); }
{ // látigo de agua: 2 impactos y atrae
  const { m, run } = play('aqua', 'terra', { bot: (mm, i) => i === 2 ? I({ x: 1, s: true }) : I() }); m.f[1].x = m.f[0].x + 3.3; const x0 = m.f[1].x; let hits = 0, hn = m.f[1].hitN;
  run(.8, mm => { if (mm.f[1].hitN !== hn) { hits++; hn = mm.f[1].hitN; } return false; }); ok(hits === 2 && m.f[1].x < x0, `el Látigo de Agua alcanza a ${x0 - m.f[0].x > 3 ? 'más de 3 unidades' : '?'}, golpea 2 veces y atrae (${hits} impactos)`); }
{ // arco llameante: invulnerable al inicio y lanza
  const { m, run } = play('ignis', 'terra', { bot: (mm, i) => i === 2 ? I({ down: true, s: true }) : I() }); m.f[1].x = m.f[0].x + 1.4; run(3 * DT);
  const d = m.f[0].act?.def; ok(m.f[0].act?.name === 'eu' && d.inv && d.launch, 'el Arco Llameante tiene invulnerabilidad al inicio y lanza'); ok(run(.6, mm => mm.f[1].launched), 'y lanza al rival que está cerca'); }
{ // muro: frena un proyectil enemigo y no deja pasar al rival
  const { m, run } = play('terra', 'aqua', { bot: (mm, i) => i === 2 ? I({ down: true, s: true }) : I(), p2: (mm) => mm.__t === 25 ? I({ s: true }) : I({ x: -1 }) });
  m.f[1].x = m.f[0].x + 4.5; let wall = null, i = 0; const orig = m.step.bind(m); m.step = dt => { m.__t = i++; return orig(dt); };
  run(.5, mm => (wall = mm.proj.find(p => p.kind === 'wall')) && mm.proj.some(p => p.kind === 'water'));
  const hp = m.f[0].hp; run(1.2); ok(wall && m.f[0].hp === hp, 'el Muro de Piedra detiene la Hidrolanza de Aqua (Terra no recibe daño)');
  const { m: m2, run: r2 } = play('terra', 'aqua', { bot: (mm, i) => i === 2 ? I({ down: true, s: true }) : I(), p2: () => I({ x: -1 }) }); m2.f[1].x = m2.f[0].x + 5.5;
  let minGap = 9, w2 = null; r2(1.3, mm => { w2 ||= mm.proj.find(p => p.kind === 'wall'); if (w2 && !w2.dead && mm.proj.includes(w2)) minGap = Math.min(minGap, mm.f[1].x - w2.x); return false; });
  ok(w2 && minGap >= w2.w / 2 + .44, `y el rival que camina hacia Terra no lo atraviesa (distancia mínima ${minGap.toFixed(2)})`); }
{ // tornado: varios impactos
  const { m, run } = play('zephyr', 'ignis', { bot: (mm, i) => i === 2 ? I({ down: true, s: true }) : I() }); m.f[1].x = m.f[0].x + 2.2; let hits = 0, hn = m.f[1].hitN;
  run(2, mm => { if (mm.f[1].hitN !== hn) { hits++; hn = mm.f[1].hitN; } return false; }); ok(hits >= 2, `el Torbellino golpea varias veces (${hits})`); }

// ── 4 · triángulo elemental sobre el control elemental ──
{ const dmg = (a, b) => { const { m, run } = play(a, b, { bot: (mm, i) => i === 2 ? I({ x: 1, s: true }) : I() }); m.f[1].x = m.f[0].x + 4; run(2, mm => mm.f[1].hp < mm.f[1].maxHp); return (m.f[1].maxHp - m.f[1].hp) / m.f[1].dmul; };
  const vsAir = dmg('ignis', 'zephyr'), vsEarth = dmg('ignis', 'terra'), vsWater = dmg('ignis', 'aqua');
  ok(near(vsAir / vsEarth, 1.2, 1e-6) && near(vsWater / vsEarth, .8, 1e-6), `Puño de Fuego: 120 % contra Aire, 100 % contra Tierra, 80 % contra Agua (${(vsAir / vsEarth * 100).toFixed(0)} / 100 / ${(vsWater / vsEarth * 100).toFixed(0)})`);
  const { m } = play('aqua', 'ignis'); ok(near(m.f[0].moves.eb.chip, data.aqua.eb.chip * 1.2) && near(m.f[0].moves.eu.proj.chip, data.aqua.eu.proj.chip * 1.2), 'el daño al bloquear de las técnicas también recibe la ventaja elemental'); }
{ // sin el triángulo instalado también funciona
  const { m, run } = play('ignis', 'terra', { el: false, bot: (mm, i) => i === 2 ? I({ x: 1, s: true }) : I() }); m.f[1].x = m.f[0].x + 4; ok(run(2, mm => mm.f[1].hp < mm.f[1].maxHp), 'el control elemental funciona aunque el triángulo no esté instalado'); }

// ── 5 · IA ──
{ B.patchCpu(CpuBrain); const used = {}, lv = ['normal', 'hard', 'expert'];
  for (const [a, b] of [['ignis', 'aqua'], ['terra', 'zephyr'], ['aqua', 'terra'], ['zephyr', 'ignis']]) {
    let seed = 7; const rng = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const { m, run } = play(a, b, { mode: 'cpu' }); m.brain = new CpuBrain(rng, lv[seed % 3]); const p1 = new CpuBrain(rng, 'hard'); m.phase = 'fight';
    for (let k = 0; k < 60 * 20; k++) { m.input.cur = p1.think(DT, m.f[0], m.f[1]); m.update(DT, cam); for (const f of m.f) if (f.act && B.BEND_IDS.includes(f.act.name) && f.act.t <= DT + 1e-9) used[f.def.id + '.' + f.act.name] = (used[f.def.id + '.' + f.act.name] || 0) + 1; if (m.phase !== 'fight') { m.newRound(); m.phase = 'fight'; } }
  }
  const kinds = Object.keys(used); ok(kinds.length >= 8 && IDS.every(id => kinds.some(k => k.startsWith(id))), `la IA usa el control elemental de los cuatro (${kinds.length} técnicas distintas en 80 s: ${kinds.join(', ')})`); }

// ── 6 · animaciones ──
const out = new Float32Array(N), base = new Float32Array(N), TURNS = new Set(['comYaw', 'comPitch', 'comRoll', 'wpSpin'].map(k => CH.indexOf(k)));
for (const id of IDS) {
  const S = styleFor(id), C = buildBending(S); ok(BENDING_CLIPS.every(k => C[k]), `${id}: existen los 3 clips (${BENDING_CLIPS.join(', ')})`);
  let finite = true, warpOk = true;
  for (const k of BENDING_CLIPS) { const c = C[k], d = data[id][k];
    for (let t = 0; t <= c.dur; t += 1 / 120) { evalClip(c, t, base, out); if (!out.every(Number.isFinite)) finite = false; }
    const at = warpTime(c, { def: d, t: d.startup + 1e-4 }); if (!(at >= c.hit[0] - 1e-3 && at <= c.hit[1] + 1e-3)) warpOk = false;
    let jump = 0, prev = null; for (let t = 0; t <= c.dur; t += 1 / 60) { evalClip(c, t, base, out); if (prev) for (let j = 0; j < N; j++) { let dd = out[j] - prev[j]; if (TURNS.has(j)) dd -= Math.round(dd / (2 * Math.PI)) * 2 * Math.PI; jump = Math.max(jump, Math.abs(dd) / (j === 3 ? 8 : 1)); } /* una vuelta completa (2π) es la misma pose */ prev = Float32Array.from(out); }
    if (jump > .75) { finite = false; console.error('  salto brusco', id, k, jump.toFixed(2)); } }
  ok(finite, `${id}: poses finitas y sin saltos bruscos (60 FPS)`); ok(warpOk, `${id}: el instante de liberación cae en la ventana activa real`);
}
{ const sig = id => JSON.stringify(Object.values(buildBending(styleFor(id))).map(c => c.track)); ok(new Set(IDS.map(sig)).size === 4, 'las animaciones son distintas para cada guerrero'); }
{ const { m } = play('aqua', 'terra'); ok(m.v.every(v => !v.c.anim || v.c.anim.dir.clips.eb), 'los clips se añaden a los animadores del combate'); }

console.log(bad ? `\n${bad} prueba(s) fallaron` : '\nTodas las pruebas del control elemental pasaron');
process.exit(bad ? 1 : 0);
