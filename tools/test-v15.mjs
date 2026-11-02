// v1.5: transformación definitiva, desafíos de combate, canciones, escenarios con clima.
import { register } from 'node:module'; import { readFileSync } from 'node:fs'; import { pathToFileURL } from 'node:url';
const three = pathToFileURL(process.cwd() + '/js/vendor/three/build/three.module.js').href, addons = pathToFileURL(process.cwd() + '/js/vendor/three/examples/jsm/').href;
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s,c,n){ if(s==='three') return {url:'${three}',shortCircuit:true}; if(s.startsWith('three/addons/')) return {url:'${addons}'+s.slice(13),shortCircuit:true}; return n(s,c); }`));
const ctx = new Proxy({}, { get: (_, k) => k === 'createLinearGradient' || k === 'createRadialGradient' ? () => ({ addColorStop() {} }) : () => {} });
globalThis.document = { createElement: () => ({ className: '', setAttribute() {}, addEventListener() {}, getContext: () => ctx }), documentElement: {}, querySelectorAll: () => [] };
globalThis.addEventListener ??= () => {}; globalThis.removeEventListener ??= () => {};
const THREE = await import('three');
const { Fighter, RULES } = await import('../js/game/fighter.js');
const { CpuBrain } = await import('../js/game/ai.js');
const TFm = await import('../js/game/transform.js');
const { Match } = await import('../js/game/match.js');
const { installFightReport } = await import('../js/game/fight-report.js');
const { CHALLENGES, rivalFor, byId } = await import('../js/modes/challenges.js');
const rd = p => JSON.parse(readFileSync(p, 'utf8'));
const moves = rd('data/moves.json'), { roster } = rd('data/characters.json'), es = rd('data/localization/es.json'), en = rd('data/localization/en.json');
let bad = 0; const ok = (c, m) => { if (!c) { console.error('FALLO:', m); bad++; } else console.log('ok  ', m); };
const R = id => roster.find(r => r.id === id), DT = 1 / 60, cam = new THREE.PerspectiveCamera(32, 16 / 9);
const I = o => ({ x: 0, down: false, guard: false, jump: false, l: false, m: false, h: false, s: false, r: false, w: false, t: false, ...o });
TFm.patchFighter(Fighter, RULES); TFm.patchCpu(CpuBrain);

// 1 · transformación
{ const a = new Fighter(R('ignis'), -2, 1, moves), b = new Fighter(R('aqua'), 2, -1, moves);
  const atk0 = a.atk, dm0 = a.dmul, w0 = a.walk;
  a.update(DT, I({ t: true }), b); ok(!(a.tf > 0), 'sin la Resonancia llena no se puede transformar');
  a.meter = RULES.meterMax; a.update(DT, I({ t: true }), b);
  ok(a.tf > 11.9 && a.meter === 0 && a.ev.some(e => e.t === 'transform'), 'con la Resonancia al 100 % se transforma y la gasta entera');
  ok(Math.abs(a.atk / atk0 - TFm.TF.atk) < 1e-9 && Math.abs(a.dmul / dm0 - TFm.TF.def) < 1e-9 && Math.abs(a.walk / w0 - TFm.TF.walk) < 1e-9, '+25 % daño, −20 % daño recibido, +12 % velocidad');
  a.atk = atk0 * 1.5; a.update(DT, I(), b); ok(Math.abs(a.atk - atk0 * 1.5 * TFm.TF.atk) < 1e-9, 'si el triángulo elemental recalcula el ataque, la mejora se vuelve a aplicar (no se pierde)');
  a.atk = atk0 * TFm.TF.atk; a.__tf_atk = a.atk;
  a.hp = 50; for (let i = 0; i < 60; i++) a.update(DT, I(), b); ok(a.hp > 50, 'recupera vida poco a poco mientras dura');
  let n = 0; while (a.tf > 0 && n++ < 60 * 20) a.update(DT, I(), b);
  ok(a.tf === 0 && Math.abs(a.atk - atk0) < 1e-9 && Math.abs(a.dmul - dm0) < 1e-9 && Math.abs(a.walk - w0) < 1e-9, `a los ${(n / 60).toFixed(1)} s termina y todo vuelve a la normalidad`);
  const c = new Fighter(R('terra'), 0, 1, moves); c.meter = 100; c.update(DT, I({ r: true, w: true }), b); ok(c.tf > 0 && c.act?.name !== 'ex', 'Resonancia + Arma a la vez también transforma (y no lanza la técnica)');
  c.meter = RULES.exCost * .5; c.update(DT, I({ r: true }), b); ok(c.act?.name === 'ex' && c.meter < 1, 'transformado, la técnica de Resonancia cuesta la mitad');
  const d = new Fighter(R('zephyr'), 0, 1, moves); d.meter = 100; d.air = true; d.update(DT, I({ t: true }), b); ok(!(d.tf > 0), 'no se transforma en el aire ni a mitad de un golpe'); }

// 2 · combate: la CPU se transforma, el resumen lo cuenta, y en entrenamiento el maniquí no
{ const sc = { scene: new THREE.Scene(), stage: new THREE.Group(), match: null, startMatch(a, b, input, o) { this.match = new Match(this, input, { def: R(a), holder: new THREE.Group() }, { def: R(b), holder: new THREE.Group() }, o); }, endMatch() {} };
  TFm.installTransform({ scene: sc, doc: null }); const rep = installFightReport({ scene: sc });
  sc.startMatch('ignis', 'aqua', { read: () => I(), clear() {} }, { moves, mode: 'cpu', level: 'expert', roundTime: Infinity }); const m = sc.match; m.phase = 'fight';
  m.f[1].meter = 100; let n = 0; while (!(m.f[1].tf > 0) && n++ < 60 * 10) m.update(DT, cam);
  ok(m.f[1].tf > 0, `la CPU en Experto se transforma al tener la Resonancia llena (${(n / 60).toFixed(1)} s)`);
  ok(m.__rep.s[1].tf === 1, 'el resumen registra la transformación (bonificación)');
  sc.startMatch('ignis', 'aqua', { read: () => I(), clear() {} }, { moves, mode: 'training', dummy: 'cpu' }); const t = sc.match; t.f[1].meter = 100; for (let i = 0; i < 60 * 5; i++) t.update(DT, cam);
  ok(!(t.f[1].tf > 0), 'el maniquí de entrenamiento no se transforma'); }

// 3 · desafíos
{ const ids = CHALLENGES.map(c => c.id);
  ok(ids.every(id => es[`ch.${id}.name`] && en[`ch.${id}.goal`]), `los ${ids.length} desafíos tienen nombre y objetivo en español e inglés`);
  ok(rivalFor(byId('f_disadv'), 'ignis', roster) === 'aqua' && rivalFor(byId('f_disadv'), 'aqua', roster) === 'zephyr' && rivalFor(byId('f_mirror'), 'terra', roster) === 'terra', 'el rival del desafío se elige solo (ventaja elemental / espejo)');
  const s = { stats: { taken: 0, maxCombo: 4, exKO: false, tf: 1, bend: 0, exUse: 0, weapon: 0, counter: 0, crush: 0, throws: 0 }, rank: 'S', bonuses: [] };
  const c = { res: { winner: 0, time: 20, hp: [1, 0], wins: [1, 0] }, s };
  ok(byId('f_flawless').check(c) && byId('f_fast').check(c) && byId('f_tfwin').check(c) && byId('f_purist').check(c) && !byId('f_combo10').check(c), 'las condiciones de combate se evalúan con el resumen');
  ok(byId('m_arcade_nocont').check({ cleared: true, continues: 0 }) && !byId('m_arcade_hard').check({ cleared: true, level: 'normal' }) && byId('m_surv6').check({ wins: 6 }), 'los desafíos de modos se cumplen con el resultado de Arcade / Supervivencia');
  ok(byId('p_tf').check({ rep: { sides: [{ stats: { tf: 1 } }, { stats: { tf: 2 } }] } }) && byId('p_close').check({ res: { winner: 1, wins: [1, 2] } }), 'los desafíos de 2 jugadores también'); }

// 4 · historia: los mundos
{ const { planStory, TOUR } = await import('../js/game/story-cine.js'); const { Ladder } = await import('../js/modes/ladder.js'); const cfg = rd('data/modes.json');
  const L = new Ladder(cfg, { kind: 'story', hero: 'ignis', level: 'normal' }), sc = L.scenesBefore();
  const p = planStory(sc, { hero: 'ignis', rival: L.rivals[0], world: L.stageAt(0), home: 'cenizas', final: cfg.finalStage, total: 3 });
  ok(p.find(s => s.key === 'story.prologue.1').world === 'equilibrio' && p.find(s => s.key === 'story.prologue.2').tour.join() === TOUR.join(), 'el prólogo muestra el Sello y recorre los cuatro mundos');
  ok(p.find(s => s.key === 'story.ignis.intro').world === 'cenizas' && p.find(s => s.key.startsWith('story.arrive.')).world === L.stageAt(0) && p.find(s => s.kind === 'line' && s.side === 1).world === L.stageAt(0), 'el héroe habla en su mundo y el capítulo ocurre en el del rival');
  ok(['cenizas', 'mareas', 'bastion', 'viento', 'equilibrio'].every(w => es['story.arrive.' + w] && en['story.arrive.' + w]), 'cada mundo tiene su llegada narrada');
  const st = rd('data/stages.json').stages; ok(st.every(s => s.extras.includes('peaks') || s.id === 'mareas') && st.every(s => s.weather) && st.find(s => s.id === 'bosque').extras.includes('cascade'), 'todos los escenarios tienen cordillera, clima propio y el bosque su cascada'); }

console.log(bad ? `\n${bad} prueba(s) fallaron` : '\nTodas las pruebas v1.5 pasaron');
process.exit(bad ? 1 : 0);
