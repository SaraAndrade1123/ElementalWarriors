// Pruebas de integración de F4 en una partida real (Match): HUD de Resonancia y guardia, proyectiles, avisos, maniquí y rondas.
import { register } from 'node:module'; import { readFileSync } from 'node:fs'; import { pathToFileURL } from 'node:url';
const three = pathToFileURL(process.cwd() + '/js/vendor/three/build/three.module.js').href;
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s,c,n){ if(s==='three') return {url:'${three}',shortCircuit:true}; return n(s,c); }`));
const ctx = new Proxy({}, { get: (_, k) => k === 'createLinearGradient' || k === 'createRadialGradient' ? () => ({ addColorStop() {} }) : () => {} });
globalThis.document = { createElement: () => ({ getContext: () => ctx }), documentElement: {}, querySelectorAll: () => [] };
globalThis.fetch = async p => ({ ok: true, json: async () => JSON.parse(readFileSync(p, 'utf8')) });
const THREE = await import('three'); const { Match } = await import('../js/game/match.js'); const { loadLocale } = await import('../js/systems/localization.js'); const { RULES } = await import('../js/game/fighter.js');
await loadLocale('es');
const moves = JSON.parse(readFileSync('data/moves.json', 'utf8')), { roster } = JSON.parse(readFileSync('data/characters.json', 'utf8'));
let bad = 0; const ok = (c, m) => { if (!c) { console.error('FALLO:', m); bad++; } else console.log('ok  ', m); };
const R = id => roster.find(r => r.id === id), mkChar = r => ({ def: r, holder: new THREE.Group() });
const I = o => ({ x: 0, jump: false, down: false, guard: false, l: false, m: false, h: false, s: false, r: false, ...o });
const cam = new THREE.PerspectiveCamera(32, 16 / 9), DT = 1 / 60;
const mk = (a, b, mode, bot, extra = {}) => { const log = { hud: null, fx: [] }, input = { cur: I(), read() { const c = this.cur; this.cur = I({ x: c.x, down: c.down, guard: c.guard }); return c; }, clear() {}, consume() {} };
  const m = new Match({ scene: new THREE.Scene(), stage: new THREE.Group(), q: { particles: 300 } }, input, mkChar(R(a)), mkChar(R(b)), { moves, mode, onHud: s => { log.hud = s; }, onFx: n => log.fx.push(n), ...extra });
  const run = (sec, until) => { for (let i = 0; i < sec * 60; i++) { input.cur = bot(m, i); m.update(DT, cam); if (until?.(m)) return true; } return false; };
  return { m, log, run }; };

// 1 · HUD: Resonancia y guardia salen del estado real
{ const { m, log, run } = mk('ignis', 'terra', 'cpu', () => I()); run(.1);
  ok(Array.isArray(log.hud.meter) && log.hud.meter.length === 2 && log.hud.meter.every(v => v === 0), 'el HUD recibe la barra de Resonancia de ambos (empieza vacía)');
  ok(Array.isArray(log.hud.guard) && log.hud.guard.length === 2, 'y la barra de guardia'); m.f[0].meter = 60; run(.05); ok(Math.abs(log.hud.meter[0] - .6) < 1e-9, 'refleja los cambios de la barra'); }
// 2 · Proyectil de Aqua en una partida: se crea, viaja, golpea y desaparece; suena al lanzarse
{ const { m, log, run } = mk('aqua', 'terra', 'training', (mm, i) => I({ s: i === 2 })); m.f[1].x = 4;
  run(.5); ok(m.proj.length === 1 && m.proj[0].x > m.f[0].x + 1, 'la Hidrolanza aparece y avanza');
  run(1.5, mm => mm.f[1].hp < mm.f[1].maxHp); ok(m.f[1].hp < m.f[1].maxHp, 'golpea al rival');
  run(.5); ok(m.proj.length === 0, 'y desaparece tras el impacto'); ok(log.fx.some(n => n.startsWith('hit_')), 'con sonido de impacto'); }
// 3 · Técnica reforzada: aviso en pantalla, coste único y estadística
{ const { m, log, run } = mk('ignis', 'aqua', 'training', (mm, i) => I({ r: i === 3 })); m.f[1].x = m.f[0].x + 2; run(.02); const m0 = m.f[0].meter;
  run(.12); ok(m.f[0].act?.name === 'ex' && Math.abs(m.f[0].meter - (m0 - RULES.exCost)) < 1, 'R en neutro gasta 25 y ejecuta la Ruptura Carmesí'); ok(log.hud.notes.some(n => n.kind === 'ex'), 'aparece el aviso «TÉCNICA REFORZADA»'); ok(m.stats.ex[0] === 1, 'se cuenta en las estadísticas'); }
// 4 · Entrenamiento: el maniquí puede defenderse y la barra se recarga
{ const { m, run } = mk('zephyr', 'ignis', 'training', (mm, i) => I({ m: i % 40 === 0 }), { dummy: 'guard' }); m.f[1].x = m.f[0].x + 1.8;
  let blocked = 0; const bk0 = m.f[1].bkN; run(3); blocked = m.f[1].bkN - bk0; ok(blocked > 0 && m.f[1].hp >= m.f[1].maxHp - 1, `el maniquí «se defiende» bloquea (${blocked} bloqueos)`);
  m.f[0].meter = 0; run(4); ok(m.f[0].meter > 90, 'en entrenamiento la Resonancia se recarga sola'); }
{ const { m, run } = mk('zephyr', 'ignis', 'training', () => I(), { dummy: 'cpu' }); let acts = 0; for (let i = 0; i < 600; i++) { run(DT); if (m.f[1].act) acts++; } ok(acts > 0, `el maniquí «ataca» usa la IA (${acts} fotogramas atacando)`); }
// 5 · Rondas: la Resonancia se conserva entre rondas y la revancha la vacía
{ const { m, run } = mk('ignis', 'terra', 'cpu', () => I()); m.brain = { think: () => I() }; run(2.6); m.f[0].meter = 70; m.f[1].hp = 0; m.f[1].ko = true; run(6, mm => mm.round === 2);
  ok(m.round === 2 && m.f[0].meter === 70, 'la Resonancia se conserva de una ronda a la siguiente'); m.restart(); ok(m.f[0].meter === 0 && m.f[1].meter === 0, 'la revancha la reinicia'); }
// 6 · Lanzamiento en partida: aviso y estadística
{ const { m, log, run } = mk('terra', 'zephyr', 'training', (mm, i) => I({ l: i === 2, m: i === 2 })); m.f[1].x = m.f[0].x + 1.1; run(1.4);
  ok(m.stats.throws[0] === 1 && log.hud.notes.length >= 0 && m.f[1].hp < m.f[1].maxHp, 'el lanzamiento quita vida y se cuenta'); }
// 7 · Presentación y victoria: gestos de cada guerrero
{ const { m, run } = mk('aqua', 'zephyr', 'cpu', () => I()); ok(m.v[0].cel?.name === 'intro' && m.v[1].cel?.name === 'intro', 'la ronda 1 empieza con la presentación de cada guerrero');
  m.brain = { think: () => I() }; run(3, mm => mm.phase === 'fight'); ok(m.phase === 'fight' && !m.v[0].cel, 'al empezar el combate termina la presentación');
  m.f[1].hp = 0; m.f[1].ko = true; run(1); ok(m.v[0].cel?.name === 'win', 'el ganador de la ronda celebra con su animación de victoria'); }

console.log(bad ? `${bad} fallo(s)` : 'Todas las pruebas de F4 pasaron'); process.exit(bad ? 1 : 0);
