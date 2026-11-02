// Integración F7 (modos) + F4 (combate) + triángulo elemental + control elemental, en partidas reales (Match + ganchos, sin DOM).
import { register } from 'node:module'; import { readFileSync } from 'node:fs'; import { pathToFileURL } from 'node:url';
const three = pathToFileURL(process.cwd() + '/js/vendor/three/build/three.module.js').href;
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s,c,n){ if(s==='three') return {url:'${three}',shortCircuit:true}; return n(s,c); }`));
const ctx = new Proxy({}, { get: (_, k) => k === 'createLinearGradient' || k === 'createRadialGradient' ? () => ({ addColorStop() {} }) : () => {} });
const el = () => ({ className: '', setAttribute() {}, addEventListener() {}, setPointerCapture() {}, set textContent(v) {}, getContext: () => ctx });
globalThis.document = { createElement: el, documentElement: {}, querySelectorAll: () => [] };
globalThis.fetch = async p => ({ ok: true, json: async () => JSON.parse(readFileSync(p, 'utf8')) });
const THREE = await import('three');
const { Match } = await import('../js/game/match.js');
const { Input } = await import('../js/game/input.js');
const { loadLocale, t } = await import('../js/systems/localization.js');
const { createFlow } = await import('../js/modes/flow.js');
const { Ladder } = await import('../js/modes/ladder.js');
const { Survival } = await import('../js/modes/survival.js');
const { byId } = await import('../js/modes/challenges.js');
const { SaveSystem, MemoryStorage } = await import('../js/systems/save-system.js');
const { Progression } = await import('../js/systems/progression-system.js');
const { installElements } = await import('../js/elements/element-hook.js');
const { installBending } = await import('../js/elements/bending-hook.js');
await loadLocale('es');
const rd = p => JSON.parse(readFileSync(p, 'utf8'));
const moves = rd('data/moves.json'), { roster } = rd('data/characters.json'), cfg = rd('data/modes.json'), eco = rd('data/economy.json'), achs = rd('data/achievements.json').achievements;
let bad = 0; const ok = (c, m) => { if (!c) { console.error('FALLO:', m); bad++; } else console.log('ok  ', m); };
const R = id => roster.find(r => r.id === id), DT = 1 / 60, cam = new THREE.PerspectiveCamera(32, 16 / 9);
const scene = () => { const sc = { scene: new THREE.Scene(), stage: new THREE.Group(), q: { particles: 300 }, match: null, last: null,
  startMatch(a, b, input, o) { this.last = o; this.match = new Match(this, input, { def: R(a), holder: new THREE.Group() }, { def: R(b), holder: new THREE.Group() }, o); }, endMatch() { this.match = null; } };
  installElements({ scene: sc, roster, data: rd('data/elements.json'), url: null }); installBending({ scene: sc, roster, data: rd('data/bending.json'), url: null }); return sc; };

// 1 · Versus local: el J2 hace control elemental con SU teclado (→ + 4 del teclado numérico)
{ const sc = scene(), inp = new Input(null, () => {}); inp.setScheme('versus');
  sc.startMatch('ignis', 'aqua', inp, { moves, mode: 'versus' }); const m = sc.match; m.phase = 'fight';
  const key = (code, down = true) => (down ? inp.kd : inp.ku)({ code, repeat: false, preventDefault() {} });
  key('ArrowLeft'); for (let i = 0; i < 3; i++) m.update(DT, cam); key('Numpad4'); let got = null; for (let i = 0; i < 6 && !got; i++) { m.update(DT, cam); got = m.f[1].act?.name; }
  ok(got === 'eb', `versus: el J2 (mirando a la izquierda) hace la proyección elemental con ← + 4 (${got})`); key('ArrowLeft', false);
  key('KeyD'); for (let i = 0; i < 2; i++) m.update(DT, cam); key('KeyR'); got = null; for (let i = 0; i < 6 && !got; i++) { m.update(DT, cam); got = m.f[0].act?.name; } key('KeyD', false);
  ok(got === 'eb', `versus: el J1 hace la suya con D + R (${got})`);
  ok(m.f[1].elem?.rel === 'advantage' && m.f[0].elem?.rel === 'disadvantage', 'versus: el triángulo elemental se aplica a los dos jugadores (Agua > Fuego)'); }

// 2 · Desafío «Maestro del elemento» completado en un combate real (eventos del Match → flujo → Rose Gold)
{ const save = new SaveSystem(new MemoryStorage()), progression = new Progression(save, { economy: eco, achievements: achs }), sc = scene(); let panel = null, n = 0;
  const input = { cur: {}, read() { const c = this.cur; this.cur = {}; return { x: 0, down: false, guard: false, jump: false, l: false, m: false, h: false, s: false, r: false, ...c }; }, clear() {} };
  const flow = createFlow({ cfg, progression, t, nameOf: id => id, record: () => 0, restart() {}, panel: p => { panel = p; }, story: (s, d) => d(), hint() {}, pauseMatch() {},
    fight: c => sc.startMatch(c.a, c.b, input, { moves, mode: c.mode, dummy: c.dummy, infinite: c.infinite, onEvent: e => flow.onEvent(e) }) });
  flow.begin({ kind: 'challenge', def: byId('bend3'), hero: 'zephyr', rival: 'terra' }); const m = sc.match; m.f[1].x = m.f[0].x + 3;
  for (let i = 0; i < 60 * 8 && !panel; i++) { if (i % 70 === 5) input.cur = { x: 1, s: true }; m.update(DT, cam); n++; }
  ok(panel && save.data.challenges.includes('bend3') && save.data.gold.balance === eco.challenge, `desafío «Maestro del elemento» superado en un combate real con 3 Ráfagas (+${eco.challenge} Rose Gold, ${(n / 60).toFixed(1)} s)`); }

// 3 · Arcade, Historia y Supervivencia crean combates con dificultad, escenario y triángulo elemental
{ const sc = scene(), input = { read: () => ({}), clear() {} };
  const L = new Ladder(cfg, { hero: 'ignis', level: 'hard' }), f = L.fight(); sc.startMatch(f.a, f.b, input, { moves, mode: f.mode, level: f.level, stage: f.stage, wins: f.wins, maxRounds: f.maxRounds });
  ok(sc.match.brain.level === 'hard' && sc.last.stage === cfg.stageByElement[cfg.elementOf[f.b]] && sc.match.f[0].elem.rel === 'advantage', `arcade: Ignis contra ${f.b} en ${sc.last.stage}, CPU difícil y ventaja elemental (Fuego > Aire)`);
  ok(sc.match.f[0].moves.eb && sc.match.f[1].moves.ej, 'arcade: los dos tienen sus técnicas de control elemental');
  const S = new Survival(cfg, { hero: 'aqua' }); S.report({ winner: 0, wins: [1, 0], stats: { dmg: [1, 0], combo: [1, 0] }, time: 10, hp: [.4, 0] }); const g = S.fight();
  sc.startMatch(g.a, g.b, input, { moves, mode: g.mode, level: g.level, startHp: g.startHp, wins: g.wins });
  ok(Math.abs(sc.match.f[0].hp / sc.match.f[0].maxHp - g.startHp) < 1e-9 && sc.match.f[0].elem && sc.match.winsNeeded === 1, `supervivencia: vida arrastrada (${Math.round(g.startHp * 100)} %) y elementos aplicados en el siguiente combate`);
  const H = new Ladder(cfg, { kind: 'story', hero: 'terra' }), hf = H.fight(); sc.startMatch(hf.a, hf.b, input, { moves, mode: hf.mode, level: hf.level });
  ok(sc.match.f.every(x => x.elem.rel === 'neutral'), 'historia de Terra: Tierra es neutra contra todos (100 %)'); }

// 4 · Entrenamiento de F7 (maniquí, vida infinita, recolocar) con las técnicas nuevas
{ const sc = scene(), input = { cur: {}, read() { const c = this.cur; this.cur = {}; return { x: 0, down: false, guard: false, jump: false, l: false, m: false, h: false, s: false, r: false, ...c }; }, clear() {} };
  sc.startMatch('terra', 'aqua', input, { moves, mode: 'training', dummy: 'guard', infinite: true }); const m = sc.match; m.f[1].x = m.f[0].x + 4;
  input.cur = { down: true, s: true }; for (let i = 0; i < 40; i++) m.update(DT, cam); ok(m.proj.some(p => p.kind === 'wall'), 'entrenamiento: el Muro de Piedra sale con ↓ + U');
  m.resetPositions(); ok(m.proj.length === 0 && m.f[0].x === -2.2, 'recolocar también retira los proyectiles en pantalla');
  m.setDummy('attack'); let gd = 0; for (let i = 0; i < 300; i++) { m.update(DT, cam); if (m.f[1].guarding) gd++; } ok(gd === 0, 'el maniquí «solo ataca» no se protege aunque tenga técnicas elementales'); }

console.log(bad ? `\n${bad} prueba(s) fallaron` : '\nTodas las pruebas de integración (F7 + elementos) pasaron');
process.exit(bad ? 1 : 0);
