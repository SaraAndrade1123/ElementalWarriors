// v1.4: resumen del combate con bonificaciones y rango, oro de los dos jugadores a la misma cuenta, juego en un solo archivo.
import { register } from 'node:module'; import { readFileSync, existsSync } from 'node:fs'; import { pathToFileURL } from 'node:url';
const three = pathToFileURL(process.cwd() + '/js/vendor/three/build/three.module.js').href, addons = pathToFileURL(process.cwd() + '/js/vendor/three/examples/jsm/').href;
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s,c,n){ if(s==='three') return {url:'${three}',shortCircuit:true}; if(s.startsWith('three/addons/')) return {url:'${addons}'+s.slice(13),shortCircuit:true}; return n(s,c); }`));
const ctx = new Proxy({}, { get: (_, k) => k === 'createLinearGradient' || k === 'createRadialGradient' ? () => ({ addColorStop() {} }) : () => {} });
globalThis.document = { createElement: () => ({ className: '', setAttribute() {}, addEventListener() {}, getContext: () => ctx }), documentElement: {}, querySelectorAll: () => [] };
globalThis.addEventListener ??= () => {}; globalThis.removeEventListener ??= () => {};
const THREE = await import('three');
const { Match } = await import('../js/game/match.js');
const { createTracker, summarize, installFightReport, RANKS } = await import('../js/game/fight-report.js');
const { Progression } = await import('../js/systems/progression-system.js');
const rd = p => JSON.parse(readFileSync(p, 'utf8'));
const moves = rd('data/moves.json'), { roster } = rd('data/characters.json'), es = rd('data/localization/es.json'), en = rd('data/localization/en.json');
let bad = 0; const ok = (c, m) => { if (!c) { console.error('FALLO:', m); bad++; } else console.log('ok  ', m); };
const R = id => roster.find(r => r.id === id), DT = 1 / 60, cam = new THREE.PerspectiveCamera(32, 16 / 9);
const I = o => ({ x: 0, down: false, guard: false, jump: false, l: false, m: false, h: false, s: false, r: false, ...o });

// 1 · bonificaciones y rango
{ const T = createTracker();
  T.feed({ type: 'hit', by: 0, move: 'l', combo: 1, dmg: 6 }); T.feed({ type: 'hit', by: 1, move: 'l', combo: 1, dmg: 6 });
  for (let i = 2; i <= 7; i++) T.feed({ type: 'hit', by: 0, move: 'm', combo: i, dmg: 8, counter: i === 3 });
  T.feed({ type: 'ex', by: 0 }); T.feed({ type: 'hit', by: 0, move: 'ex', combo: 8, dmg: 20, ko: true }); T.feed({ type: 'crush', by: 0 }); T.feed({ type: 'block', by: 0 }); // el J1 golpea y el J2 bloquea
  T.round(0, 'ko', [1, 0], 41); T.round(0, 'ko', [.8, 0], 30);
  const a = summarize(T, 0, { winner: 0, hp: [.8, 0], wins: [2, 0] }), b = summarize(T, 1, { winner: 0, hp: [.8, 0], wins: [2, 0] });
  const ids = a.bonuses.map(x => x.id);
  ok(['win', 'first', 'combo', 'exHit', 'exKO', 'perfect', 'counter', 'crush', 'dmg', 'hp', 'time'].every(k => ids.includes(k)), `el ganador recibe sus bonificaciones (${ids.join(', ')})`);
  ok(a.bonuses.find(x => x.id === 'combo').n === 8 && a.bonuses.find(x => x.id === 'time').n === 71, 'combo máximo y tiempo restante se cuentan bien');
  ok(a.rank === 'S' && a.score > b.score && a.gold > b.gold && b.gold >= 0, `rango S para una victoria dominante (${a.perf}) y menos para el vencido (${b.rank}, ${b.perf})`);
  ok(!b.bonuses.some(x => x.id === 'first') && b.bonuses.some(x => x.id === 'blocks'), 'el primer golpe es de quien lo dio; los bloqueos cuentan para quien bloquea');
  const T2 = createTracker(); T2.feed({ type: 'hit', by: 1, combo: 1, dmg: 40 }); T2.round(1, 'ko', [0, .3], 2); T2.round(0, 'time', [.2, .1], 0); T2.round(0, 'ko', [.1, 0], 3);
  const c = summarize(T2, 0, { winner: 0, hp: [.1, 0], wins: [2, 1] }); ok(c.bonuses.some(x => x.id === 'comeback') && ['B', 'C', 'D'].includes(c.rank), `remontada ajustada: bonificación de remontada y rango ${c.rank}`);
  ok(RANKS.map(r => r[0]).join('') === 'SABCD', 'rangos S, A, B, C y D');
  const keys = ['rep.rank', 'rep.score', ...['win', 'first', 'combo', 'exHit', 'exKO', 'perfect', 'comeback', 'counter', 'crush', 'throws', 'bend', 'weapon', 'parry', 'blocks', 'dmg', 'hp', 'time'].map(k => 'rep.' + k)];
  ok(keys.every(k => es[k] && en[k]), 'todas las bonificaciones están traducidas'); }

// 2 · integración con el combate real
{ const sc = { scene: new THREE.Scene(), stage: new THREE.Group(), match: null, startMatch(a, b, input, o) { this.match = new Match(this, input, { def: R(a), holder: new THREE.Group() }, { def: R(b), holder: new THREE.Group() }, o); }, endMatch() {} };
  const api = installFightReport({ scene: sc }); let res = null;
  const input = { cur: I(), read() { return this.cur; }, consume() {}, clear() {} };
  sc.startMatch('ignis', 'terra', input, { moves, mode: 'cpu', level: 'beginner', wins: 1, roundTime: 20, onResult: r => { res = r; } }); const m = sc.match;
  for (let i = 0; i < 60 * 40 && !res; i++) { const [a, b] = m.f; input.cur = Math.abs(b.x - a.x) > 2 ? I({ x: 1 }) : I({ l: i % 18 === 0, m: i % 18 === 9 }); m.update(DT, cam); }
  ok(!!res, 'el combate termina'); const rep = api.build(res);
  ok(rep && rep.sides.length === 2 && rep.sides.every(s => s.score >= 0 && 'SABCD'.includes(s.rank)), `cada lado tiene puntuación y rango (J1 ${rep?.sides[0].rank} ${rep?.sides[0].score} · CPU ${rep?.sides[1].rank})`);
  ok(rep.sides[0].stats.hits > 0 && (rep.sides[0].stats.first || rep.sides[1].stats.first), 'se registran los golpes y el primer golpe');
  m.restart(); ok(m.__rep.s[0].hits === 0, 'la revancha empieza con el contador a cero'); }

// 3 · Rose Gold: bonificaciones y los dos jugadores a la misma cuenta
{ const data = { gold: { balance: 0, earned: 0 }, rewards: [], stats: { matches: 0, roundsWon: 0, wins: 0, losses: 0, draws: 0, winsBy: {}, maxCombo: 0, maxDamage: 0, playSec: 0, transformations: 0 }, done: [], owned: [], challenges: [] };
  const save = { data, commit(fn) { return fn(this.data); } }, eco = rd('data/economy.json');
  const P = new Progression(save, { economy: eco, achievements: [] });
  const base = { mode: 'versus_ai', outcome: 'win', characterId: 'ignis', roundsWon: 2, difficulty: 'normal', maxCombo: 5, maxDamage: 40, durationSec: 60 };
  const a = P.recordMatch({ ...base, matchId: 'a' }), b = P.recordMatch({ ...base, matchId: 'b', bonusGold: 37 });
  ok(b.gold === a.gold + 37 && b.extra === 37, 'las bonificaciones suben el Rose Gold ganado');
  const c = P.recordMatch({ ...base, matchId: 'c', mode: 'versus_local', bonusGold: 10, p2: { outcome: 'loss', roundsWon: 1, bonusGold: 6 } });
  ok(c.p2 > 0 && c.gold === c.base + 10 + c.p2, `2 jugadores: lo del J2 (+${c.p2}) se suma a la misma cuenta`);
  ok(P.recordMatch({ ...base, matchId: 'd', bonusGold: 1e9 }).extra === 500, 'la bonificación tiene un tope (no se puede inflar)'); }

// 4 · juego en un solo archivo
{ const ok2 = existsSync('index.html'), s = ok2 ? readFileSync('index.html', 'utf8') : '';
  ok(ok2 && s.includes('__EW_STANDALONE') && !/<script type="module"/.test(s) && !/<link rel="stylesheet" href=/.test(s), 'index.html es autónomo (sin módulos ni hojas externas): se abre con doble clic');
  ok(['data/characters.json', 'data/localization/es.json', 'assets/characters/ignis.glb'].every(k => s.includes(`"${k}"`)) && s.includes('data:font/woff2;base64'), 'lleva dentro datos, idiomas, modelos y tipografías');
  ok(existsSync('index-dev.html') && readFileSync('index-dev.html', 'utf8').includes('js/main.js'), 'la versión para desarrollar (index-dev.html) sigue usando los módulos'); }

// 5 · escenarios con fondo
{ const st = rd('data/stages.json').stages; ok(st.every(s => (s.extras || []).length >= 4), 'cada escenario tiene al menos 4 capas/adornos de fondo nuevos'); }

console.log(bad ? `\n${bad} prueba(s) fallaron` : '\nTodas las pruebas v1.4 pasaron');
process.exit(bad ? 1 : 0);
