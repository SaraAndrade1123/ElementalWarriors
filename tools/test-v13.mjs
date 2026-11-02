// v1.3: teclado físico para 2 jugadores, vida infinita real, cinemática final, historia en 3D, vista previa de armas y nuevas técnicas de Terra.
import { register } from 'node:module'; import { readFileSync } from 'node:fs'; import { pathToFileURL } from 'node:url';
const three = pathToFileURL(process.cwd() + '/js/vendor/three/build/three.module.js').href, addons = pathToFileURL(process.cwd() + '/js/vendor/three/examples/jsm/').href;
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s,c,n){ if(s==='three') return {url:'${three}',shortCircuit:true}; if(s.startsWith('three/addons/')) return {url:'${addons}'+s.slice(13),shortCircuit:true}; return n(s,c); }`));
const ctx = new Proxy({}, { get: (_, k) => k === 'createLinearGradient' || k === 'createRadialGradient' ? () => ({ addColorStop() {} }) : () => {} });
const el = () => ({ className: '', setAttribute() {}, addEventListener() {}, setPointerCapture() {}, set textContent(v) {}, getContext: () => ctx });
globalThis.document = { createElement: el, documentElement: {}, querySelectorAll: () => [] };
const L = []; globalThis.addEventListener = (t, f) => L.push([t, f]); globalThis.removeEventListener = () => {};
globalThis.fetch = async p => ({ ok: true, json: async () => JSON.parse(readFileSync(p, 'utf8')) });
const THREE = await import('three');
const { Match } = await import('../js/game/match.js');
const { loadLocale } = await import('../js/systems/localization.js');
const KB = await import('../js/systems/keyboard-detect.js');
const { pickOutro, isPerfect, lineLen, installOutro } = await import('../js/game/cinematic-end.js');
const { planStory, readTime } = await import('../js/game/story-cine.js');
const { previewInput } = await import('../js/ui/weapon-preview.js');
const { BEND_KINDS } = await import('../js/game/bending-vfx.js');
const { Ladder } = await import('../js/modes/ladder.js');
await loadLocale('es');
const rd = p => JSON.parse(readFileSync(p, 'utf8'));
const moves = rd('data/moves.json'), { roster } = rd('data/characters.json'), O = rd('data/outros.json'), modes = rd('data/modes.json');
const es = rd('data/localization/es.json'), en = rd('data/localization/en.json');
let bad = 0; const ok = (c, m) => { if (!c) { console.error('FALLO:', m); bad++; } else console.log('ok  ', m); };
const R = id => roster.find(r => r.id === id), ids = roster.map(r => r.id), DT = 1 / 60, cam = new THREE.PerspectiveCamera(32, 16 / 9);
const I = o => ({ x: 0, down: false, guard: false, jump: false, l: false, m: false, h: false, s: false, r: false, ...o });

// 1 · teclado físico
{ KB._resetKeyboard();
  const mm = q => ({ matches: q.includes('coarse') }); // celular: puntero grueso
  ok(!KB.finePointer(mm), 'un celular (puntero grueso) no se da por hecho que tenga teclado');
  ok(!KB.noteKey({ code: '', key: 'Unidentified', keyCode: 229 }) && !KB.noteKey({ code: 'KeyA', key: 'a', keyCode: 229 }), 'las teclas del teclado en pantalla (229 / Unidentified) no cuentan');
  let told = 0; KB.onKeyboard(() => told++);
  ok(KB.noteKey({ code: 'KeyD', key: 'd', keyCode: 68 }) && KB.hasKeyboard() && told === 1, 'una pulsación física (USB / Bluetooth) activa el modo de 2 jugadores al instante');
  ok(!KB.noteKey({ code: 'KeyA', key: 'a', keyCode: 65 }) && told === 1, 'el aviso llega una sola vez');
  ok(KB.finePointer(q => ({ matches: q.includes('fine') })), 'un equipo con ratón se considera con teclado'); }

// 2 · vida infinita: activada nadie cae y se recupera; desactivada hay K.O. de verdad
{ const sm = () => ({ scene: new THREE.Scene(), stage: new THREE.Group() });
  const input = { cur: I(), read() { return this.cur; }, consume() {}, clear() {} };
  const run = (m, sec, bot) => { for (let i = 0; i < sec * 60; i++) { input.cur = bot(m, i); m.update(DT, cam); } };
  const brawl = (m, i) => { const [a, b] = m.f; return Math.abs(b.x - a.x) > 2 ? I({ x: 1 }) : I({ l: i % 20 === 0, m: i % 20 === 10, h: i % 60 === 30 }); };
  const on = new Match(sm(), input, { def: R('ignis'), holder: new THREE.Group() }, { def: R('terra'), holder: new THREE.Group() }, { moves, mode: 'training', infinite: true });
  let minOn = 1; for (let s = 0; s < 40; s++) { run(on, 1, brawl); minOn = Math.min(minOn, on.f[1].hp / on.f[1].maxHp); if (on.f[1].ko) break; }
  ok(!on.f[1].ko && on.f[1].hp >= 1, 'con vida infinita el rival nunca cae K.O.');
  on.f[1].hp = on.f[1].maxHp * .5; run(on, 2, () => I()); ok(on.f[1].hp === on.f[1].maxHp, 'con vida infinita la vida se recupera al terminar el combo');
  const off = new Match(sm(), input, { def: R('ignis'), holder: new THREE.Group() }, { def: R('terra'), holder: new THREE.Group() }, { moves, mode: 'training' });
  ok(off.infinite === false, 'en entrenamiento empieza desactivada (como indica la pausa)');
  off.f[1].hp = off.f[1].maxHp * .5; run(off, 2, () => I()); ok(off.f[1].hp === off.f[1].maxHp * .5, 'sin vida infinita el daño se queda (no se regenera)');
  let ko = false; for (let s = 0; s < 60 && !ko; s++) { run(off, 1, brawl); ko = off.f[1].ko; } ok(ko, 'sin vida infinita hay K.O. de verdad');
  run(off, 3, () => I()); ok(!off.f[1].ko && off.f[1].hp === off.f[1].maxHp, 'tras el K.O. los dos vuelven con la vida llena');
  off.infinite = true; ok(off.regen && off.f.every(f => f.immortal), 'activarla desde la pausa cambia el comportamiento al momento');
  off.infinite = false; ok(!off.regen && off.f.every(f => !f.immortal), 'y desactivarla también'); }

// 3 · cinemática final personalizada
{ let all = true, langs = true, quotes = new Set();
  for (const w of ids) for (const l of ids) { const a = pickOutro(O, w, l, 'es', { w: R(w).name, l: R(l).name }), b = pickOutro(O, w, l, 'en', { w: R(w).name, l: R(l).name });
    all &&= a.length >= 1 && a[0].who === 'w' && a.every(x => x.text.length > 8); langs &&= b.length === a.length && b[0].text !== a[0].text; quotes.add(a[0].text); }
  ok(all, `las ${ids.length * ids.length} combinaciones ganador/perdedor (con espejo) tienen frase de victoria`);
  ok(langs && quotes.size === ids.length * ids.length, 'todas distintas y en español e inglés');
  const g = pickOutro(O, 'nova', 'aqua', 'es', { w: 'Nova', l: 'Aqua' }); ok(g.length === 2 && /Aqua/.test(g[0].text), 'un guerrero nuevo usa frases genéricas con el nombre del rival');
  ok(isPerfect({ winner: 0, hp: [1, 0], wins: [2, 0] }) && !isPerfect({ winner: 0, hp: [.7, 0], wins: [2, 0] }) && !isPerfect({ winner: 1, hp: [0, 1], wins: [1, 2] }), 'detecta la victoria perfecta');
  ok(lineLen('hola') >= 2.2 && lineLen('x'.repeat(500)) <= 4.4, 'cada plano dura lo que se tarda en leer');
  // integración: el panel de resultados llega DESPUÉS de la cinemática (y saltarla también lo muestra)
  const sc = { scene: new THREE.Scene(), stage: new THREE.Group(), match: null, camera: cam, startMatch(a, b, input, o) { this.match = new Match(this, input, { def: R(a), holder: new THREE.Group() }, { def: R(b), holder: new THREE.Group() }, o); }, endMatch() { this.match = null; } };
  const api = installOutro({ scene: sc, roster, data: O, doc: null });
  let got = null; sc.startMatch('ignis', 'aqua', { read: () => I(), clear() {} }, { moves, mode: 'cpu', wins: 1, onResult: r => { got = r; } });
  const m = sc.match; m.phase = 'fight'; m.f[1].hp = 0; m.f[1].ko = true;
  let n = 0; while (!api.playing && n++ < 60 * 10) m.update(DT, cam);
  ok(api.playing && got === null && m.phase === 'outro', 'al decidirse el combate empieza la cinemática final (el panel espera)');
  n = 0; while (api.playing && n++ < 60 * 20) m.update(DT, cam);
  ok(!api.playing && got?.winner === 0 && m.phase === 'result', `al terminar (${(n / 60).toFixed(1)} s) aparece el panel con el resultado`);
  got = null; m.restart(); m.phase = 'fight'; m.f[1].hp = 0; m.f[1].ko = true; n = 0; while (!api.playing && n++ < 600) m.update(DT, cam);
  for (let i = 0; i < 40; i++) m.update(DT, cam); api.skip(); ok(got?.winner === 0, 'saltarla muestra el panel al momento (también en la revancha)');
  let got2 = null; sc.startMatch('ignis', 'aqua', { read: () => I(), clear() {} }, { moves, mode: 'training', onResult: r => { got2 = r; } }); ok(!api.playing, 'en entrenamiento no hay cinemática final'); }

// 4 · historia en 3D
{ const Lh = new Ladder(modes, { kind: 'story', hero: 'ignis', level: 'normal' }), sc = Lh.scenesBefore();
  const p = planStory(sc, { hero: 'ignis', rival: Lh.rivals[0], chapter: 0, total: 3 });
  ok(p[0].kind === 'card' && p[0].rival === Lh.rivals[0], 'cada capítulo empieza con su tarjeta («Capítulo 1 · Ignis contra …»)');
  ok(p.filter(s => s.kind === 'world').length === 3 && p.some(s => s.kind === 'line' && s.who === Lh.rivals[0] && s.side === 1) && p.some(s => s.kind === 'line' && s.who === 'ignis' && s.side === 0), 'narrador en plano general y cada guerrero en su lado');
  ok(p.filter(s => s.ots).length === 1, 'si un guerrero vuelve a hablar, plano por encima del hombro');
  const endP = planStory(Lh.scenesAfter(2), { hero: 'ignis', rival: Lh.rivals[2], chapter: 2, total: 3 }); ok(endP.some(s => s.kind === 'ending'), 'el desenlace tiene su plano final (contraluz y gesto de victoria)');
  let keys = true; for (const h of ids) for (const r of ids) if (h !== r) keys &&= !!es[`story.${h}.vs.${r}`] && !!en[`story.${h}.vs.${r}`];
  ok(keys && ids.every(r => es[`story.place.${r}`] && en[`story.place.${r}`]), 'cada héroe responde a cada rival (12 diálogos nuevos) y cada rival tiene su lugar');
  ok(readTime('a') >= 2.6 && readTime('x'.repeat(400)) <= 6.5, 'el avance automático deja tiempo para leer'); }

// 5 · vista previa de armas: la demo usa el arma cuando está lista y se recoloca entre usos
{ const m = { t: 0, f: [{ x: -1.7, facing: 1, act: null, stun: 0, air: false, wcd: 0 }, { x: 1.7 }] }, inp = previewInput(() => m);
  let uses = 0; for (let i = 0; i < 60 * 6; i++) { m.t += DT; const r = inp.read(0); if (r.w) { uses++; m.f[0].wcd = 4; } if (m.f[0].wcd > 0) m.f[0].wcd = Math.max(0, m.f[0].wcd - DT); }
  ok(uses >= 3, `en 6 s la demo usa el arma ${uses} veces (sin esperar el enfriamiento completo)`);
  m.f[0].x = -4; m.f[0].wcd = 0; ok(inp.read(0).x === 1, 'si el maniquí queda lejos, se acerca'); ok(inp.read(1).w === false, 'el maniquí no hace nada'); }

// 6 · Terra: técnicas distintas (no todas levantan la misma roca)
{ const t = moves.terra; const kinds = [t.s.proj.kind, t.ex.proj.kind];
  ok(kinds[0] === 'fangs' && kinds[1] === 'slabwave' && kinds.every(k => BEND_KINDS.includes(k)), 'especial = Fisura de Colmillos, reforzada = Ola Tectónica (efectos propios)');
  const { buildAttacks } = await import('../js/game/animation/attacks.js'); const { STYLES } = await import('../js/game/animation/styles.js');
  const c = buildAttacks(STYLES.terra), fx = n => c[n].fx.map(x => x.kind).join();
  ok(new Set([fx('h'), fx('s'), fx('ex')]).size === 3 && /b_ground_rip/.test(fx('s')) && /b_heave/.test(fx('ex')), 'golpe fuerte, especial y reforzada tienen animación y efectos diferentes');
  ok(es['mv.fisura_colmillos'] && en['mv.ola_tectonica'], 'los nombres nuevos están traducidos'); }

console.log(bad ? `\n${bad} prueba(s) fallaron` : '\nTodas las pruebas v1.3 pasaron');
process.exit(bad ? 1 : 0);
