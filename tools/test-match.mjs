// Prueba de integración: una partida completa (rondas, KO, tiempo, resultados) sin navegador, a 60 pasos/s.
import { register } from 'node:module'; import { readFileSync } from 'node:fs'; import { pathToFileURL } from 'node:url';
const three = pathToFileURL(process.cwd() + '/js/vendor/three/build/three.module.js').href;
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s,c,n){ if(s==='three') return {url:'${three}',shortCircuit:true}; return n(s,c); }`));
const ctx = new Proxy({}, { get: (_, k) => k === 'createLinearGradient' || k === 'createRadialGradient' ? () => ({ addColorStop() {} }) : () => {} });
globalThis.document = { createElement: () => ({ getContext: () => ctx }), documentElement: {}, querySelectorAll: () => [] };
globalThis.fetch = async p => ({ ok: true, json: async () => JSON.parse(readFileSync(p, 'utf8')) });
const THREE = await import('three'); const { Match } = await import('../js/game/match.js'); const { loadLocale } = await import('../js/systems/localization.js');
await loadLocale('es');
const moves = JSON.parse(readFileSync('data/moves.json', 'utf8')), { roster } = JSON.parse(readFileSync('data/characters.json', 'utf8'));
let bad = 0; const ok = (c, m) => { if (!c) { console.error('FALLO:', m); bad++; } else console.log('ok  ', m); };
const mkChar = r => ({ def: r, holder: new THREE.Group(), bones: {} });
const sm = () => ({ scene: new THREE.Scene(), stage: new THREE.Group(), breathe() {} });
const I = o => ({ x: 0, jump: false, down: false, l: false, m: false, h: false, s: false, r: false, guard: false, ...o });
const cam = new THREE.PerspectiveCamera(32, 16 / 9); const DT = 1 / 60;
const mkMatch = (mode, bot, extra = {}) => {
  const log = { hud: null, result: null, ann: new Set() }, input = { cur: I(), read() { return this.cur; }, consume() {}, clear() {} };
  const m = new Match(sm(), input, mkChar(roster[0]), mkChar(roster[1]), { moves, mode, onHud: s => { log.hud = s; if (s.text) log.ann.add(s.text); }, onResult: r => { log.result = r; }, ...extra });
  const run = (sec, until) => { for (let i = 0; i < sec * 60; i++) { input.cur = bot(m, i); m.update(DT, cam); if (until?.()) return true; } return false; };
  return { m, log, run, input };
};
// Jugador automático: se acerca y encadena golpes.
const brawler = (m, i) => { const [a, b] = m.f, d = b.x - a.x; return d > 2.1 ? I({ x: 1 }) : I({ l: i % 20 === 0, m: i % 20 === 10 }); };

// 1. Entrenamiento: la vida baja de verdad, hay KO y el maniquí revive; sin rondas ni cronómetro
{ const { m, log, run } = mkMatch('training', brawler);
  ok(m.phase === 'fight', 'el entrenamiento empieza directamente en combate');
  run(8, () => m.f[1].hp < m.f[1].maxHp); ok(m.f[1].hp < m.f[1].maxHp, `la vida del rival baja (${m.f[1].hp.toFixed(1)}/${m.f[1].maxHp})`);
  ok(run(40, () => m.f[1].ko), 'el rival cae K.O.'); ok(log.hud.text === 'K.O.', 'el aviso K.O. aparece en el HUD'); const t0 = m.timer;
  ok(run(5, () => !m.f[1].ko && m.f[1].hp === m.f[1].maxHp), 'el maniquí revive con vida completa'); ok(m.timer === t0, 'sin cronómetro en entrenamiento'); }

// 1b. Sin choque de animaciones: la partida ya no deforma el cuerpo (escala/inclinación procedural de F3);
//     sólo el derribo (KO) gira el cuerpo entero y se recupera al revivir.
{ const { m, run } = mkMatch('training', brawler); run(2);
  const flat = v => v.rig.scale.x === 1 && v.rig.scale.y === 1 && v.rig.scale.z === 1 && v.rig.rotation.z === 0;
  ok(flat(m.v[0]) && flat(m.v[1]), 'en pie, el cuerpo no se escala ni se inclina por código (lo mueve el esqueleto)');
  run(40, () => m.f[1].ko); run(1.2); ok(m.f[1].ko && flat(m.v[1]), 'al caer K.O. el cuerpo no se gira por código: lo tumba el esqueleto (pose «tumbado»)');
  run(6, () => !m.f[1].ko); run(2); ok(!m.f[1].ko && flat(m.v[1]), 'al revivir se levanta'); }

// 1c. Avisos hacia el resto del juego (audio y escenario): golpes, silbidos, bloqueo, KO, rondas y resultado
{ const rnd = Math.random; let sd = 12345; Math.random = () => (sd = (sd * 16807) % 2147483647) / 2147483647; // IA con semilla: prueba reproducible
  const fx = [], re = []; const { m, log, run } = mkMatch('cpu', brawler, { onFx: (n, d) => fx.push([n, d]), onReact: e => re.push(e) });
  run(400, () => log.result); Math.random = rnd; const names = new Set(fx.map(x => x[0]));
  ok(['whiff_light', 'whiff_heavy', 'ko', 'round_end'].every(n => names.has(n)) && (names.has('victory') || names.has('defeat')) && [...names].some(n => n.startsWith('hit_')), `suenan silbidos, golpes, KO, fin de ronda y victoria/derrota (${[...names].join(', ')})`);
  ok(fx.every(([, d]) => d.who === undefined || typeof d.who === 'string') && fx.filter(x => x[0].startsWith('hit_')).every(([, d]) => typeof d.x === 'number'), 'los golpes llevan atacante y posición (para panear y dar timbre por elemento)');
  ok(re.length > 0 && re.every(e => e.power > 0 && e.power <= 1), 'el escenario reacciona a los golpes con potencia 0–1');
  ok(log.result && log.result.stats.best[0] > 0 && log.result.stats.best[0] >= log.result.stats.dmg[0] * 0 && log.result.stats.best[0] <= log.result.stats.dmg[0], 'el resultado trae el mayor daño de un combo (para logros)');
  ok(fx.filter(x => x[0] === 'round_start').length >= 1, 'cada ronda posterior a la 1.ª anuncia su inicio'); }
{ const att = new Set();
  const { run: r2, m: m2 } = mkMatch('training', (mm, i) => i % 40 === 0 ? I({ l: true }) : I({}), { onFx: n => att.add(n) }); m2.f[1].x = m2.f[0].x + 1.4; r2(4);
  ok(att.has('hit_light') || att.has('hit_medium'), 'un puñetazo cercano suena como golpe'); }

// 2. Contra CPU: intro, rondas, victoria al mejor de 3 y pantalla de resultados
{ const { m, log, run } = mkMatch('cpu', brawler);
  ok(m.phase === 'intro', 'empieza con introducción de ronda');
  run(3); ok(log.ann.has('RONDA 1') && log.ann.has('¡PELEA!'), `anuncios: ${[...log.ann].join(' · ')}`);
  const done = run(60 * 15, () => log.result); ok(done, 'la partida termina con resultado');
  const r = log.result; ok(r && (r.wins[0] >= 2 || r.wins[1] >= 2 || m.round >= 5), `resultado: rondas ${r?.wins.join('-')}, ganador ${r?.winner}`);
  ok(r.stats.dmg[0] > 0 && r.time > 5 && r.stats.combo[0] >= 1, `estadísticas: daño ${r.stats.dmg.map(Math.round)}, combo máx ${r.stats.combo}, ${r.time.toFixed(0)} s`);
  ok([...log.ann].some(a => a.startsWith('¡') && a.endsWith('GANA!')) || r.winner < 0, 'se anuncia al ganador');
  m.restart(); ok(m.phase === 'intro' && m.wins.join() === '0,0' && m.f[0].hp === m.f[0].maxHp, 'Revancha reinicia marcador y vida'); }

// 3. Fin por tiempo: gana quien tenga más vida; empate si es igual
{ const { m, run } = mkMatch('cpu', () => I()); run(2); m.f[1].hp -= 20; m.timer = .05; run(1, () => m.phase === 'end');
  ok(m.phase === 'end' && m.winner === 0 && m.why === 'time' && m.wins[0] === 1, 'al acabar el tiempo gana quien tiene más vida');
  const r2 = mkMatch('cpu', () => I()); r2.run(2); r2.m.timer = .05; r2.run(1, () => r2.m.phase === 'end'); ok(r2.m.winner === -1 && r2.m.wins.join() === '0,0', 'tiempo con vidas iguales: empate sin puntos'); }

console.log(bad ? `${bad} fallo(s)` : 'Todas las pruebas de partida pasaron'); process.exit(bad ? 1 : 0);
