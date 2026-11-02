// Pruebas de cierre de F3: paso fijo (daño independiente de los FPS), intercambio de golpes, empuje en pared y depuración (npm test).
import { register } from 'node:module'; import { readFileSync } from 'node:fs'; import { pathToFileURL } from 'node:url';
const three = pathToFileURL(process.cwd() + '/js/vendor/three/build/three.module.js').href;
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s,c,n){ if(s==='three') return {url:'${three}',shortCircuit:true}; return n(s,c); }`));
const ctx = new Proxy({}, { get: (_, k) => k === 'createLinearGradient' || k === 'createRadialGradient' ? () => ({ addColorStop() {} }) : () => {} });
globalThis.document = { createElement: () => ({ getContext: () => ctx }), documentElement: {}, querySelectorAll: () => [] };
globalThis.fetch = async p => ({ ok: true, json: async () => JSON.parse(readFileSync(p, 'utf8')) });
const THREE = await import('three'); const { Match, STEP, MAX_STEPS } = await import('../js/game/match.js'); const { loadLocale } = await import('../js/systems/localization.js');
const { Fighter, resolveBoth, separate, WORLD } = await import('../js/game/fighter.js'); const { boxesOf, infoLines, phaseOf } = await import('../js/game/debug.js');
await loadLocale('es');
const moves = JSON.parse(readFileSync('data/moves.json', 'utf8')), { roster } = JSON.parse(readFileSync('data/characters.json', 'utf8'));
let bad = 0; const ok = (c, m) => { if (!c) { console.error('FALLO:', m); bad++; } else console.log('ok  ', m); };
const I = o => ({ x: 0, jump: false, down: false, l: false, m: false, h: false, s: false, r: false, guard: false, ...o });
const mkChar = r => ({ def: r, holder: new THREE.Group(), bones: {} });
const sm = () => ({ scene: new THREE.Scene(), stage: new THREE.Group() });
const cam = new THREE.PerspectiveCamera(32, 16 / 9), DT = 1 / 60;

// El guion de entradas depende del NÚMERO DE PASOS leídos (no del tiempo de pantalla): así se compara el mismo combate a distintos FPS.
const scripted = () => { const st = { n: 0, read() { const n = ++st.n; return n < 40 ? I({ x: 1 }) : I({ l: n % 24 === 0, m: n % 24 === 12 }); }, consume() {}, clear() {} }; return st; };
const run = (fps, steps) => {
  const inp = scripted(), m = new Match(sm(), inp, mkChar(roster[0]), mkChar(roster[1]), { moves, mode: 'training' });
  const rdt = 1 / fps; let guard = 0; while (inp.n < steps && guard++ < 1e6) m.update(rdt, cam);
  return { hp: m.f[1].hp, hp0: m.f[0].hp, x: [m.f[0].x, m.f[1].x], combo: m.stats.combo[0], dmg: m.stats.dmg[0], clock: m.clock };
};

// 1. Daño independiente de los FPS
{ const r = [30, 60, 144, 240].map(f => run(f, 900));
  ok(r.every(x => x.hp < roster.length * 1e9 && x.dmg > 0), `hay daño real en todas las pruebas (${r.map(x => x.dmg.toFixed(1)).join(' / ')})`);
  ok(r.every(x => Math.abs(x.hp - r[0].hp) < 1e-9 && Math.abs(x.dmg - r[0].dmg) < 1e-9 && x.combo === r[0].combo), `mismo combate a 30, 60, 144 y 240 FPS → misma vida final (${r[0].hp.toFixed(3)}) y combo (${r[0].combo})`);
  ok(r.every(x => Math.abs(x.x[0] - r[0].x[0]) < 1e-9 && Math.abs(x.x[1] - r[0].x[1]) < 1e-9), 'y las mismas posiciones'); }

// 2. El paso fijo no acelera ni se atasca
{ const m = new Match(sm(), scripted(), mkChar(roster[0]), mkChar(roster[1]), { moves, mode: 'training' });
  for (let i = 0; i < 4; i++) m.update(1 / 240, cam); ok(m.lastSteps === 0 || m.f[0].hp > 0, 'a 240 FPS se ejecutan pasos de 1/60 s acumulados'); 
  let steps = 0; const m2 = new Match(sm(), { read: () => (steps++, I()), consume() {}, clear() {} }, mkChar(roster[0]), mkChar(roster[1]), { moves, mode: 'training' });
  for (let i = 0; i < 240; i++) m2.update(1 / 240, cam); ok(steps === 60, `1 s de pantalla a 240 FPS = 60 pasos de simulación (${steps})`);
  steps = 0; m2.update(5, cam); ok(m2.lastSteps === MAX_STEPS && steps === MAX_STEPS, `un fotograma de 5 s ejecuta como máximo ${MAX_STEPS} pasos (no hay «espiral de la muerte»)`);
  steps = 0; m2.update(STEP, cam); ok(steps <= 1, 'tras el atraso se descarta el sobrante y vuelve a ritmo normal'); }

// 3. Intercambio: dos golpes simultáneos se dañan mutuamente (antes ganaba siempre el jugador 1)
{ const d = r => ({ ...r, height: 3.3 }), a = new Fighter(d(roster[0]), 0, 1, moves), b = new Fighter(d(roster[1]), 1.6, -1, moves); let evs = [];
  for (let i = 0; i < 60; i++) { const inp = I({ l: i === 0 }); a.update(DT, inp, b); b.update(DT, inp, a); separate(a, b); evs.push(...resolveBoth(a, b)); }
  ok(evs.length === 2 && !evs[0].blocked && !evs[1].blocked && a.hp < a.maxHp && b.hp < b.maxHp, `golpes simultáneos: los dos reciben daño (${a.hp.toFixed(1)}/${a.maxHp} y ${b.hp.toFixed(1)}/${b.maxHp})`);
  ok(evs[0].a === a && evs[1].a === b, 'el intercambio informa un evento por atacante');
  // un solo golpe sigue funcionando igual
  const c = new Fighter(d(roster[0]), 0, 1, moves), e = new Fighter(d(roster[1]), 1.6, -1, moves); evs = [];
  for (let i = 0; i < 60; i++) { c.update(DT, I({ l: i === 0 }), e); e.update(DT, I(), c); evs.push(...resolveBoth(c, e)); } ok(evs.length === 1 && e.hp < e.maxHp && c.hp === c.maxHp, 'un golpe suelto solo daña al rival'); }

// 4. Pared: si el rival está contra el muro, el atacante recibe retroceso (sin presión infinita en la esquina); en campo abierto no
{ const d = r => ({ ...r, height: 3.3 }), kvAfterHit = bx => { const a = new Fighter(d(roster[0]), bx - 1.4, 1, moves), b = new Fighter(d(roster[1]), bx, -1, moves); let kv = null, bb = b;
    for (let i = 0; i < 40 && kv === null; i++) { a.update(DT, I({ l: i === 0 }), b); b.update(DT, I(), a); separate(a, b); if (resolveBoth(a, b).length) kv = a.kv; } return { kv, a, b: bb }; };
  const wall = kvAfterHit(WORLD.half), open = kvAfterHit(0);
  ok(wall.kv !== null && wall.kv < -.5 && open.kv === 0, `contra la pared el atacante recibe retroceso (kv=${wall.kv?.toFixed(2)}); en campo abierto no (kv=${open.kv})`);
  ok(wall.b.x <= WORLD.half && wall.b.x >= -WORLD.half, 'el rival acorralado no sale del escenario'); }

// 5. Ventana activa: sin daño en preparación ni recuperación
{ const d = r => ({ ...r, height: 3.3 }), a = new Fighter(d(roster[0]), 0, 1, moves), b = new Fighter(d(roster[1]), 6, -1, moves); let seen = new Set();
  for (let i = 0; i < 60; i++) { a.update(DT, I({ l: i === 0 }), b); b.update(DT, I(), a); const ph = phaseOf(a), bx = boxesOf(a); if (ph) seen.add(ph); if (ph !== 'active' && bx.hit) bad++, console.error('FALLO: hitbox fuera de la ventana activa'); if (ph === 'active' && !bx.hit) bad++, console.error('FALLO: sin hitbox en la ventana activa'); if (ph === 'startup' || ph === 'recovery') b.x = a.x + 1.5; if (ph === 'active') b.x = 6; }
  ok(['startup', 'active', 'recovery'].every(p => seen.has(p)) && b.hp === b.maxHp, 'la hitbox solo existe en la ventana activa; en preparación/recuperación el rival no recibe daño'); }

// 6. Fuera de combate no hay daño (intro / fin de ronda)
{ const inp = { read: () => I({ l: true }), consume() {}, clear() {} }, m = new Match(sm(), inp, mkChar(roster[0]), mkChar(roster[1]), { moves, mode: 'cpu' });
  m.f[1].x = m.f[0].x + 1.5; let early = false; for (let i = 0; i < 60; i++) { m.update(DT, cam); if (m.phase === 'intro' && m.f[1].hp < m.f[1].maxHp) early = true; }
  ok(m.phase === 'intro' && !early, 'durante la introducción nadie puede golpear'); }

// 7. Depuración (F1)
{ const m = new Match(sm(), scripted(), mkChar(roster[0]), mkChar(roster[1]), { moves, mode: 'training' }); const sc = m.sm.scene, n0 = sc.children.length;
  const dbgN = () => sc.children.filter(c => c.isGroup && c.children.some(x => x.isLineSegments)).length;
  ok(!m.debug, 'la depuración empieza apagada'); m.setDebug(true); ok(m.debug && dbgN() === 1, 'F1 añade el overlay a la escena');
  m.setDebug(true); ok(dbgN() === 1, 'activarla dos veces no duplica el overlay');
  let hud = null; m.o.onHud = s => { hud = s; }; for (let i = 0; i < 90; i++) m.update(DT, cam);
  const ov = m.dbgOverlay.items[0]; ok(ov.hurt.visible && ov.body.visible, 'se dibujan las cajas de daño y de colisión');
  ok(Array.isArray(hud.dbg) && hud.dbg.length >= 6 && hud.dbg.every(l => typeof l === 'string' && !/NaN|undefined/.test(l)), `el panel trae datos válidos (${hud.dbg.length} líneas)`);
  let sawHit = false; for (let i = 0; i < 400 && !sawHit; i++) { m.update(DT, cam); if (m.dbgOverlay.items.some(it => it.hit.visible)) sawHit = true; } ok(sawHit, 'la caja de golpe (roja) aparece durante la ventana activa de un ataque');
  const pos = ov.hurt.geometry.attributes.position.array; ok(pos.every(Number.isFinite) && pos[0] < pos[3], 'las cajas tienen coordenadas válidas');
  m.setDebug(false); ok(!m.debug && dbgN() === 0, 'apagarla quita el overlay'); hud = null; m.update(DT, cam); ok(hud.dbg === null, 'sin depuración el HUD no recibe datos extra');
  m.setDebug(true); m.dispose(); ok(!m.debug && !sc.children.some(c => c.isGroup && c.children.some(x => x.isLineSegments)), 'dispose limpia el overlay'); }
{ const d = r => ({ ...r, height: 3.3 }), f = new Fighter(d(roster[0]), 0, 1, moves), b = boxesOf(f);
  ok(b.hit === null && b.reach === null && b.hurt.y1 > b.hurt.y0, 'en reposo: solo hay caja de daño'); f.crouching = true; ok(boxesOf(f).hurt.y1 < b.hurt.y1, 'agachado, la caja de daño baja'); 
  ok(infoLines({ f: [f, f], round: 1, phase: 'fight', lastSteps: 1, lastEv: null }).length === 8, 'infoLines funciona sin ningún golpe previo (incluye Resonancia, guardia y búfer)'); }


// 8. F7: opciones del combate (versus, rondas, tiempo, vida arrastrada, maniquí, eventos)
{ const mkM = (mode, o = {}, inp) => new Match(sm(), inp || { read: () => I(), consume() {}, clear() {} }, mkChar(roster[0]), mkChar(roster[1]), { moves, mode, ...o });
  // versus: el jugador 2 lo controla la entrada 1 y no hay CPU
  const reads = [0, 0], cons = [];
  const inp = { read(p = 0) { reads[p]++; return p === 1 ? I({ x: -1 }) : I({}); }, consume(n, p) { cons.push([n, p]); }, clear() {} };
  const m = mkM('versus', {}, inp); ok(m.brain === null && m.phase === 'intro' && m.timed, 'versus: sin CPU, con introducción y cronómetro'); for (let i = 0; i < 200; i++) m.update(DT, cam);
  ok(reads[1] > 0 && m.f[1].x < 2.2 - .5, `versus: el jugador 2 se mueve con su propia entrada (x=${m.f[1].x.toFixed(2)})`);
  const m2 = mkM('versus', {}, { read: p => I(p === 1 ? { l: true } : {}), consume(n, p) { cons.push([n, p]); }, clear() {} }); m2.f[0].x = -.6; m2.f[1].x = .6; cons.length = 0; for (let i = 0; i < 200; i++) m2.update(DT, cam);
  ok(m2.f[0].hp < m2.f[0].maxHp && m2.f[1].hp === m2.f[1].maxHp, 'versus: el golpe del jugador 2 (su propia entrada) daña al jugador 1');
  // rondas para ganar y tiempo
  const w = mkM('cpu', { wins: 1, maxRounds: 3 }); w.phase = 'fight'; w.f[1].hp = 0; w.f[1].ko = true; for (let i = 0; i < 60 * 8; i++) w.update(DT, cam); ok(w.phase === 'result' && w.wins[0] === 1, 'con wins=1 una sola ronda decide el combate');
  const inf = mkM('cpu', { roundTime: Infinity }); inf.phase = 'fight'; for (let i = 0; i < 120; i++) inf.update(DT, cam); ok(inf.timer === Infinity && inf.phase === 'fight', 'roundTime infinito: el cronómetro no avanza');
  const sh = mkM('cpu', { startHp: .4 }); ok(Math.abs(sh.f[0].hp / sh.f[0].maxHp - .4) < 1e-9 && sh.f[1].hp === sh.f[1].maxHp, 'startHp arrastra la vida solo del jugador 1'); sh.round = 2; sh.newRound(); ok(sh.f[0].hp === sh.f[0].maxHp, 'en rondas posteriores la vida vuelve a la completa');
  const lowhp = mkM('cpu', { startHp: 0.0001 }); ok(lowhp.f[0].hp >= 1, 'la vida arrastrada nunca deja al jugador en 0');
  // niveles de CPU
  ok(mkM('cpu', { level: 'expert' }).brain.level === 'expert' && mkM('cpu').brain.level === 'normal' && mkM('cpu', { level: 'nope' }).brain.level === 'normal', 'la dificultad llega a la CPU (y un nivel desconocido usa «normal»)');
  // entrenamiento: maniquí, vida infinita y reposicionar
  const tr = mkM('training', { dummy: 'guard', infinite: true }); ok(tr.dummy === 'guard' && typeof tr.brain.think === 'function' && tr.phase === 'fight' && !tr.timed, 'entrenamiento: maniquí en guardia, sin cronómetro');
  tr.setDummy('still'); ok(tr.brain === null && tr.dummy === 'still', 'se cambia el maniquí en caliente'); tr.f[1].hp = 3; for (let i = 0; i < 5; i++) tr.update(DT, cam); ok(tr.f[1].hp === tr.f[1].maxHp, 'vida infinita: se recupera sola');
  tr.f[0].x = 5; tr.f[1].x = -4; tr.f[1].hp = tr.f[1].maxHp - 7; tr.infinite = false; tr.resetPositions(); ok(tr.f[0].x === -2.2 && tr.f[1].x === 2.2 && tr.f[1].hp === tr.f[1].maxHp - 7 && tr.f[0].facing === 1 && tr.f[1].facing === -1, 'reiniciar posiciones recoloca a los luchadores sin tocar la vida');
  const nm = mkM('cpu'); nm.setDummy('guard'); ok(nm.brain.level === 'normal', 'setDummy solo vale en entrenamiento');
  // eventos para desafíos
  const evs = []; const e = mkM('training', { onEvent: x => evs.push(x) }, { read: () => I({ l: true }), consume() {}, clear() {} }); e.f[1].x = e.f[0].x + 1.5; for (let i = 0; i < 90; i++) e.update(DT, cam);
  ok(evs.length > 0 && evs.every(x => x.type === 'hit' && x.by === 0 && typeof x.move === 'string' && x.combo >= 1), `los golpes emiten eventos con atacante, golpe y combo (${evs.length})`);
  const warn = console.warn; console.warn = () => {}; const bad2 = mkM('training', { onEvent: () => { throw new Error('boom'); } }, { read: () => I({ l: true }), consume() {}, clear() {} }); bad2.f[1].x = bad2.f[0].x + 1.5; let thrown = false; try { for (let i = 0; i < 60; i++) bad2.update(DT, cam); } catch { thrown = true; } console.warn = warn; ok(!thrown && bad2.f[1].hp < bad2.f[1].maxHp, 'un fallo en el receptor de eventos no rompe el combate');
  const r = mkM('cpu', { wins: 1 }); let result = null; r.o.onResult = x => { result = x; }; r.phase = 'fight'; r.f[1].hp = 0; r.f[1].ko = true; for (let i = 0; i < 60 * 8; i++) r.update(DT, cam); ok(result && result.hp.length === 2 && result.hp[0] > 0 && result.hp[1] === 0, 'el resultado trae la vida final de cada luchador'); }

console.log(bad ? `${bad} fallo(s)` : 'Todas las pruebas de cierre de F3 pasaron'); process.exit(bad ? 1 : 0);
