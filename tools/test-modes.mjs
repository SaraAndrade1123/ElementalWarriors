// Pruebas de F7: IA por dificultad, entrada de 2 jugadores, Arcade, Historia, Supervivencia, Desafíos y guardado de modos (npm test).
import { readFileSync } from 'node:fs';
import { Fighter, separate, resolveBoth, resolveThrows } from '../js/game/fighter.js';
import { CpuBrain, makeBrain, DUMMIES } from '../js/game/ai.js';
import { LEVELS, LEVEL_IDS } from '../js/game/difficulty-config.js';
import { Ladder } from '../js/modes/ladder.js';
import { Survival } from '../js/modes/survival.js';
import { CHALLENGES, ChallengeTracker, byId } from '../js/modes/challenges.js';
import { scoreFight } from '../js/modes/score.js';
import { SaveSystem, MemoryStorage, sanitize, defaults } from '../js/systems/save-system.js';
import { Progression } from '../js/systems/progression-system.js';
const rd = p => JSON.parse(readFileSync(p, 'utf8'));
const MOVES = rd('data/moves.json'), { roster } = rd('data/characters.json'), cfg = rd('data/modes.json'), eco = rd('data/economy.json'), achs = rd('data/achievements.json').achievements, stages = rd('data/stages.json').stages;
let bad = 0; const ok = (c, m) => { if (!c) { console.error('FALLO:', m); bad++; } else console.log('ok  ', m); };
const DT = 1 / 60, I = o => ({ x: 0, jump: false, down: false, guard: false, l: false, m: false, h: false, s: false, r: false, ...o });
const mk = (id, x, f) => new Fighter({ ...roster.find(r => r.id === id), height: 3.3 }, x, f, MOVES);
const seeded = s => () => (s = (s * 16807) % 2147483647) / 2147483647;

// ---------- datos
{ const ids = roster.map(r => r.id);
  ok(ids.every(h => cfg.order[h]?.length === 3 && !cfg.order[h].includes(h) && cfg.order[h].every(r => ids.includes(r)) && new Set(cfg.order[h]).size === 3), 'cada guerrero tiene 3 rivales distintos, sin duelo espejo');
  const sid = new Set(stages.map(s => s.id)); ok([...Object.values(cfg.stageByElement), cfg.finalStage].every(s => sid.has(s)), 'los escenarios de arcade/historia existen en data/stages.json');
  ok(ids.every(i => cfg.elementOf[i]) && LEVEL_IDS.every(l => LEVELS[l]) && cfg.levels.join() === LEVEL_IDS.join(), 'elementos y 4 niveles de dificultad definidos'); }

// ---------- IA (cerebro de F4 con la interfaz de F7: niveles, maniquíes, reacción mínima)
{ const lv = LEVEL_IDS.map(l => LEVELS[l]);
  ok(lv.every((x, i) => !i || (x.reaction < lv[i - 1].reaction && x.block > lv[i - 1].block && x.punish >= lv[i - 1].punish && x.aggression > lv[i - 1].aggression && x.chain > lv[i - 1].chain)), 'cada nivel reacciona más rápido, bloquea, castiga, ataca y encadena más que el anterior');
  // sin trampas: antes de que pase su retraso de reacción la CPU no puede reaccionar a un golpe
  for (const l of ['normal', 'expert']) { const brain = new CpuBrain(() => 0, l), me = mk('aqua', 2, -1), foe = mk('ignis', .5, 1); let t = 0, first = null;
    for (let i = 0; i < 90; i++) { const inp = brain.think(DT, me, foe); t += DT; if (i === 10) foe.update(DT, I({ h: true }), me); else if (i > 10) foe.update(DT, I(), me); if (inp.guard && first === null && i >= 10) first = t - 11 * DT; }
    ok(first !== null && first >= LEVELS[l].reaction - 2 * DT, `${l}: la guardia llega tras su retraso de reacción (${first?.toFixed(2)} s ≥ ${LEVELS[l].reaction} s)`); }
  // tasa de bloqueo ante el mismo atacante, por nivel (semillas fijas): golpe medio (salida 0,12 s) y pesado (0,2 s)
  const duel = (level, seed, btn) => { const rng = seeded(seed), a = mk('ignis', -1, 1), b = mk('aqua', 1.1, -1), brain = new CpuBrain(rng, level); let blocked = 0, hits = 0;
    for (let i = 0; i < 60 * 40; i++) { const atk = i % 70 === 0 && !a.act; a.update(DT, I({ [btn]: atk, x: b.x - a.x > 1.6 ? 1 : 0 }), b); b.update(DT, brain.think(DT, b, a), a); separate(a, b);
      for (const e of resolveBoth(a, b)) if (e.b === b) { e.blocked ? blocked++ : hits++; } if (b.ko) b.revive(); if (a.ko) a.revive(); b.x = Math.max(b.x, a.x + .9); }
    return { blocked, hits }; };
  const rate = (l, btn) => { let bl = 0, ht = 0; for (let s = 1; s <= 12; s++) { const r = duel(l, s * 977, btn); bl += r.blocked; ht += r.hits; } return bl / Math.max(1, bl + ht); };
  const R = LEVEL_IDS.map(l => rate(l, 'm')), K = LEVEL_IDS.map(l => rate(l, 'h')); const up = a => a.every((x, i) => !i || x >= a[i - 1] - .04) && a[3] > a[0] + .15; const pc = a => a.map(x => (x * 100).toFixed(0) + '%').join(' → ');
  ok(up(R), `contra golpes medios la tasa de bloqueo sube con la dificultad (${pc(R)})`); ok(up(K), `contra golpes pesados también (${pc(K)})`);
  // duelos IA vs IA: un nivel más alto gana más a menudo con las mismas reglas (sin ventajas de vida/daño)
  const fight = (la, lb, seed) => { const ra = seeded(seed), rb = seeded(seed + 7), a = mk('ignis', -2.2, 1), b = mk('aqua', 2.2, -1), ba = new CpuBrain(ra, la), bb = new CpuBrain(rb, lb);
    for (let i = 0; i < 60 * 45 && !a.ko && !b.ko; i++) { a.update(DT, ba.think(DT, a, b), b); b.update(DT, bb.think(DT, b, a), a); separate(a, b); resolveBoth(a, b); resolveThrows(a, b); }
    return a.hp / a.maxHp - b.hp / b.maxHp; };
  const wr = (hi, lo) => { let w = 0; const N = 16; for (let s = 1; s <= N; s++) { const x = s % 2 ? fight(hi, lo, s * 31) : -fight(lo, hi, s * 31); if (x > 0) w++; } return w / N; };
  const w1 = wr('expert', 'beginner'), w2 = wr('hard', 'normal'); ok(w1 >= .75, `experto vence a principiante (${(w1 * 100).toFixed(0)} % de 16 duelos, alternando lados)`); ok(w2 >= .5, `difícil no pierde frente a normal (${(w2 * 100).toFixed(0)} %)`);
  ok(DUMMIES.every(k => k === 'still' ? makeBrain(k) === null : typeof makeBrain(k).think === 'function'), `todos los maniquíes de entrenamiento están definidos (${DUMMIES.join(', ')})`);
  const g = makeBrain('guard').think(DT, mk('ignis', 0, 1), mk('aqua', 2, -1)), c = makeBrain('crouch').think(DT, mk('ignis', 0, 1), mk('aqua', 2, -1)); ok(g.guard && !g.down && c.guard && c.down, 'maniquí en guardia: de pie y agachado');
  { const low = mk('aqua', 1, -1); low.update(DT, I({ down: true, l: true }), mk('ignis', 0, 1)); ok(makeBrain('guard').think(DT, mk('ignis', 0, 1), low).down, 'el maniquí «se defiende» se agacha ante un golpe bajo'); }
  // el maniquí «ataca» nunca bloquea ni castiga
  const dm = makeBrain('attack', seeded(3)), me = mk('aqua', 2, -1), foe = mk('ignis', 1, 1); let gd = 0, at = 0; for (let i = 0; i < 600; i++) { if (i % 90 === 5) foe.update(DT, I({ l: true }), me); else foe.update(DT, I(), me); const o = dm.think(DT, me, foe); me.update(DT, o, foe); if (o.guard) gd++; if (o.l || o.m || o.h || o.s) at++; if (me.act) me.act = null; } ok(gd === 0 && at > 0, `el maniquí que ataca no se protege (${gd}) y ataca (${at} veces)`);
  const cb = new CpuBrain(seeded(5), 'hard'); cb.setLevel('nope'); ok(cb.level === 'normal' && cb.cfg === LEVELS.normal, 'un nivel desconocido usa «normal»'); }

// ---------- entrada de 2 jugadores (botones de F4: ligero, medio, pesado, especial, Resonancia)
{ const el = () => ({ className: '', setAttribute() {}, addEventListener() {}, setPointerCapture() {}, set textContent(v) {} });
  globalThis.document = { createElement: el }; const { Input, SCHEMES } = await import('../js/game/input.js'); const inp = new Input({ replaceChildren() {}, hidden: true }, () => {});
  const key = (code, down = true) => (down ? inp.kd : inp.ku)({ code, repeat: false, preventDefault() {} });
  ok(inp.players === 1 && inp.read(1).x === 0, 'esquema «solo»: un jugador'); key('ArrowRight'); ok(inp.read(0).x === 1, 'solo: las flechas mueven al J1'); key('ArrowRight', false);
  key('KeyJ'); key('KeyU'); const s0 = inp.read(0); ok(s0.l && s0.s && !inp.read(0).l, 'solo: J = ligero, U = especial; cada pulsación se lee una sola vez');
  inp.setScheme('versus'); ok(inp.players === 2, 'esquema «versus»: dos jugadores');
  key('KeyD'); key('ArrowLeft'); ok(inp.read(0).x === 1 && inp.read(1).x === -1, 'J1 con WASD y J2 con flechas se mueven a la vez, sin mezclarse'); key('KeyD', false); key('ArrowLeft', false);
  key('KeyF'); key('KeyG'); key('KeyH'); key('KeyR'); key('KeyT'); const p1 = inp.read(0), p2 = inp.read(1); ok(p1.l && p1.m && p1.h && p1.s && p1.r && !p2.l && !p2.s, 'J1: F G H ligero/medio/pesado, R especial, T Resonancia (no afectan al J2)');
  key('Numpad1'); key('Numpad4'); key('Numpad5'); const q = inp.read(1); ok(q.l && q.s && q.r && !inp.read(0).l, 'J2: teclado numérico 1 ligero, 4 especial, 5 Resonancia');
  key('Comma'); key('Period'); key('Slash'); const q2 = inp.read(1); ok(q2.l && q2.m && q2.h, 'J2: , . - (o /) como alternativa al teclado numérico');
  key('KeyF'); inp.read(1); ok(inp.read(0).l, 'leer las pulsaciones del J2 no borra las del J1');
  key('ShiftLeft'); key('Numpad0'); ok(inp.read(0).guard && inp.read(1).guard, 'guardia de ambos jugadores a la vez'); inp.clear();
  const all = SCHEMES.versus.flatMap(m => Object.values(m).flat()); ok(new Set(all).size === all.length, 'ninguna tecla se repite entre los dos jugadores');
  key('KeyJ'); ok(!inp.read(0).l, 'en versus J ya no es ligero (solo se usan las teclas del esquema)'); inp.setScheme('solo'); key('KeyJ'); ok(inp.read(0).l, 'al volver a «solo», J vuelve a ser ligero'); }

// ---------- Arcade
const res = (winner, o = {}) => ({ winner, wins: winner === 0 ? [2, 0] : [0, 2], stats: { dmg: [200, o.taken ?? 40], combo: [o.combo ?? 3, 1], best: [50, 10] }, time: o.time ?? 40, hp: [o.hp ?? .6, .0], rounds: 2 });
{ const heroes = roster.map(r => r.id);
  for (const h of heroes) { const L = new Ladder(cfg, { hero: h, level: 'normal' }); const seen = []; let st;
    do { const f = L.fight(); seen.push(f); ok(f.a === h && f.b !== h, `${h} nunca se enfrenta a sí mismo (${f.b})`); st = L.report(res(0)).status; } while (st === 'next');
    ok(st === 'clear' && seen.length === 3 && new Set(seen.map(f => f.b)).size === 3 && L.cleared && L.done, `${h}: arcade de 3 combates contra 3 rivales distintos y final`); }
  const L = new Ladder(cfg, { hero: 'ignis', level: 'normal' });
  ok(L.levelAt(0) === 'normal' && L.levelAt(1) === 'normal' && L.levelAt(2) === 'hard' && L.fight().final === false, 'dificultad: base en los primeros y +1 en el rival final');
  ok(new Ladder(cfg, { hero: 'ignis', level: 'expert' }).levelAt(2) === 'expert' && new Ladder(cfg, { hero: 'ignis', level: 'beginner' }).levelAt(2) === 'normal', 'el nivel final tiene tope en experto');
  ok(L.fight().stage === cfg.stageByElement[cfg.elementOf.zephyr] && L.stageAt(2) === cfg.finalStage, 'cada rival cambia el escenario y el último usa la Arena del Equilibrio');
  const s1 = L.report(res(0, { hp: .8, time: 20, taken: 0, combo: 5 })); ok(s1.status === 'next' && L.score > 1500 && L.i === 1, `victoria: pasa al siguiente rival (${L.score} pts)`);
  const p0 = L.score; ok(L.report(res(-1)).status === 'draw' && L.i === 1 && L.score === p0, 'un empate repite el combate sin cambiar la puntuación');
  const lost = L.report(res(1)); ok(lost.status === 'lost' && L.continuesLeft === 3, 'derrota: se puede continuar'); const c1 = L.useContinue(); ok(c1.b === L.rivals[1] && L.continues === 1 && L.score === Math.max(0, p0 - cfg.arcade.continuePenalty), 'continuar repite el mismo combate y resta puntos');
  L.report(res(1)); L.useContinue(); L.report(res(1)); L.useContinue(); const over = L.report(res(1)); ok(over.status === 'over' && L.done && !L.cleared && L.useContinue() === null, 'sin continuaciones la partida termina');
  ok(L.report(res(0)).status === 'over', 'terminada la partida, un resultado tardío no la reabre'); }
{ const hi = scoreFight(res(0, { hp: 1, time: 15, taken: 0, combo: 8 }), 'normal', cfg), lo = scoreFight(res(0, { hp: .1, time: 58, taken: 90, combo: 1 }), 'normal', cfg);
  ok(hi > lo && lo > 0 && scoreFight(res(1), 'normal', cfg) === 0, `la puntuación premia vida, rapidez, combos y no recibir daño (${hi} > ${lo}; derrota 0)`);
  ok(scoreFight(res(0), 'expert', cfg) > scoreFight(res(0), 'normal', cfg) && scoreFight(res(0), 'normal', cfg) > scoreFight(res(0), 'beginner', cfg), 'más dificultad, más puntos'); }

// ---------- Historia
{ const L = new Ladder(cfg, { kind: 'story', hero: 'aqua', level: 'normal' }); const b0 = L.scenesBefore(); ok(b0.length === 5 && b0[0].key === 'story.prologue.1' && b0.at(-2).key === `story.rival.${L.rivals[0]}.pre` && b0.at(-1).key === `story.aqua.vs.${L.rivals[0]}`, 'el primer capítulo abre con el prólogo, la intro de la heroína y el rival');
  ok(L.report(res(1)).status === 'lost' && L.continuesLeft === Infinity && L.useContinue().b === L.rivals[0] && L.continues === 0, 'en la historia perder permite reintentar sin límite ni penalización');
  L.report(res(0)); const a0 = L.scenesAfter(); ok(a0.length === 1 && a0[0].key === `story.rival.${L.rivals[0]}.post` && L.scenesBefore().length === 2, 'tras cada victoria hay un diálogo y el siguiente capítulo solo trae su diálogo previo');
  L.report(res(0)); L.report(res(0)); const end = L.scenesAfter(2); ok(end.at(-1).key === 'story.fin' && end.some(s => s.key === 'story.aqua.ending'), 'el último capítulo cierra con el final de la heroína');
  const from = new Ladder(cfg, { kind: 'story', hero: 'aqua', from: 2 }); ok(from.fight().index === 2 && from.fight().final, 'se puede empezar desde un capítulo desbloqueado'); }

// ---------- Supervivencia
{ const S = new Survival(cfg, { hero: 'terra', level: 'normal' }); const seq = []; let lvls = [];
  for (let i = 0; i < 6; i++) { const f = S.fight(); seq.push(f.b); lvls.push(f.level); ok(f.a === 'terra' && f.b !== 'terra' && f.wins === 1, `combate ${i + 1}: rival ${f.b}, una ronda`); S.report(res(0, { hp: .5 })); }
  ok(seq.slice(0, 3).join() === cfg.order.terra.join() && seq.slice(3).join() === cfg.order.terra.join(), 'los rivales rotan sin repetirse seguidos');
  ok(lvls.join() === 'normal,normal,hard,hard,expert,expert', `la dificultad sube cada ${cfg.survival.escalateEvery} victorias hasta experto (${lvls.join(' ')})`);
  const S2 = new Survival(cfg, { hero: 'terra' }); S2.fight(); S2.report(res(0, { hp: .3 })); ok(Math.abs(S2.fight().startHp - (.3 + cfg.survival.heal)) < 1e-9, 'la vida se recupera solo parcialmente entre combates (0,30 + 0,25)');
  S2.report(res(0, { hp: .9 })); ok(S2.fight().startHp === 1, 'la vida arrastrada nunca pasa de 100 %');
  const s3 = S2.report(res(1)); ok(s3.status === 'over' && S2.done && S2.summary().wins === 2 && S2.summary().score > 0, 'la derrota termina la serie y resume victorias, puntuación y tiempo'); }

// ---------- Desafíos
{ const kinds = k => CHALLENGES.filter(c => (c.kind || 'train') === k).length; ok(CHALLENGES.length >= 50 && !CHALLENGES.some(c => c.locked) && kinds('train') >= 20 && kinds('fight') >= 15 && kinds('mode') >= 8 && kinds('pvp') >= 6, `${CHALLENGES.length} desafíos (técnica ${kinds('train')}, combate ${kinds('fight')}, modos ${kinds('mode')}, 2 jugadores ${kinds('pvp')}) y la transformación ya es jugable`);
  ok(new Set(CHALLENGES.map(c => c.id)).size === CHALLENGES.length, 'sin ids repetidos');
  let threw = false; try { new ChallengeTracker(byId('f_hard')); } catch { threw = true; } ok(threw && new ChallengeTracker(byId('transform')).feed({ type: 'transform', by: 0 }), 'los desafíos de combate no usan el contador de entrenamiento; la transformación sí se completa');
  const T = new ChallengeTracker(byId('bendall')); ['eb', 'eb', 'eu'].forEach(m => T.feed({ type: 'hit', by: 0, move: m })); ok(T.count === 2 && T.feed({ type: 'hit', by: 0, move: 'ej' }), 'Dominio total cuenta técnicas DISTINTAS');
  const tr = new ChallengeTracker(byId('punch3')), H = (move, o = {}) => ({ type: 'hit', by: 0, move, combo: 1, dmg: 5, ko: false, ...o });
  ok(!tr.feed(H('h')) && !tr.feed({ type: 'hit', by: 1, move: 'l' }) && !tr.feed({ type: 'block', by: 0, move: 'l' }) && tr.count === 0, 'los golpes de otro tipo, del rival o bloqueados no cuentan');
  tr.feed(H('l')); tr.feed(H('cl')); ok(tr.count === 2 && !tr.done, 'cuenta 2/3 (ligero de pie y agachado)'); ok(tr.feed(H('jl')) === true && tr.done, 'se completa al tercero'); ok(tr.feed(H('l')) === false && tr.count === 3, 'una prueba completada no se vuelve a completar');
  const k = new ChallengeTracker(byId('kick2')); k.feed(H('h')); ok(k.feed(H('ch')), '«Golpe pesado»: 2 golpes pesados');
  const lo = new ChallengeTracker(byId('low2')); lo.feed(H('cm')); ok(!lo.feed(H('l')) && lo.feed(H('cl')), '«Bajo la guardia»: solo golpes agachados');
  ok(new ChallengeTracker(byId('air1')).feed(H('jm')) && new ChallengeTracker(byId('air1')).feed(H('ej')), '«Desde el aire»: golpes aéreos y técnica elemental aérea');
  const b = new ChallengeTracker(byId('block3')); [1, 2, 3].forEach(() => b.feed({ type: 'block', by: 1, move: 'm' })); ok(b.done, 'bloquear 3 golpes del rival completa «Defensa»');
  const c = new ChallengeTracker(byId('combo3')); c.feed(H('l', { combo: 1 })); c.feed(H('m', { combo: 2 })); ok(!c.done, 'combo de 2 no basta'); ok(c.feed(H('h', { combo: 3 })), 'combo de 3 golpes completa la prueba');
  ok(new ChallengeTracker(byId('ko')).feed(H('h', { ko: true })) && !new ChallengeTracker(byId('ko')).feed(H('h')), 'el K.O. solo cuenta con el golpe que derrota');
  ok(new ChallengeTracker(byId('special')).feed(H('s')) && !new ChallengeTracker(byId('special')).feed(H('ex')), '«Técnica especial»: la especial (U)');
  ok(!new ChallengeTracker(byId('cancel')).feed(H('s', { combo: 1 })) && new ChallengeTracker(byId('cancel')).feed(H('s', { combo: 3 })) && new ChallengeTracker(byId('cancel')).feed(H('eb', { combo: 2 })), '«Cancelaciones»: una técnica que conecta dentro de un combo');
  ok(new ChallengeTracker(byId('resonance')).feed(H('ex')), '«Resonancia»: la técnica reforzada');
  ok(new ChallengeTracker(byId('throw')).feed({ type: 'throw', by: 0, move: 'throw' }) && !new ChallengeTracker(byId('throw')).feed({ type: 'throw', by: 1, move: 'throw' }), '«Lanzamientos»: solo los del jugador');
  const bd = new ChallengeTracker(byId('bend3')); bd.feed(H('eb')); bd.feed(H('eu')); ok(!bd.feed(H('s')) && bd.feed(H('ej')), '«Maestro del elemento»: 3 técnicas de control elemental'); }

// ---------- Guardado de modos
{ const mkP = () => { const save = new SaveSystem(new MemoryStorage()); return { save, p: new Progression(save, { economy: eco, achievements: achs }) }; };
  let { save, p } = mkP(); const r1 = p.recordChallenge('punch3'); ok(r1.ok && r1.gold === eco.challenge && save.data.gold.balance === eco.challenge && save.data.challenges.includes('punch3'), `superar una prueba paga ${eco.challenge} Rose Gold`);
  const r2 = p.recordChallenge('punch3'); ok(!r2.ok && r2.error === 'duplicate' && save.data.gold.balance === eco.challenge, 'la misma prueba no paga dos veces'); ok(p.recordChallenge('../x').error === 'invalid', 'ids inválidos se rechazan');
  p.setStory('ignis', 2); p.setStory('ignis', 1); ok(save.data.story.ignis === 2, 'el progreso de historia solo sube'); p.setStory('ignis', 500); ok(save.data.story.ignis === 99, 'y está acotado');
  ok(p.recordRun({ kind: 'arcade', hero: 'ignis', score: 4000, cleared: true }).record && save.data.records.arcade.score === 4000, 'primer récord de arcade'); ok(!p.recordRun({ kind: 'arcade', hero: 'aqua', score: 3000, cleared: true }).record && save.data.records.arcade.char === 'ignis', 'un resultado peor no lo reemplaza');
  ok(!p.recordRun({ kind: 'arcade', hero: 'aqua', score: 9999, cleared: false }).record, 'un arcade sin completar no cuenta como récord');
  ok(p.recordRun({ kind: 'survival', hero: 'terra', wins: 5, score: 7000, time: 300 }).record && !p.recordRun({ kind: 'survival', hero: 'terra', wins: 4, score: 9000, time: 100 }).record && p.recordRun({ kind: 'survival', hero: 'aqua', wins: 5, score: 8000, time: 200 }).record, 'récord de supervivencia: más victorias y, a igualdad, más puntos');
  ok(p.recordRun({ kind: 'x', hero: 'a' }).ok === false, 'tipos de partida inválidos se rechazan');
  const e = p.recordEvent('arcade_clear'); ok(e.ok && save.data.stats.arcadeClears === 1 && e.unlocked.includes('arcade_clear'), 'completar el arcade desbloquea su logro'); const gold = save.data.gold.balance; p.recordEvent('arcade_clear'); ok(save.data.gold.balance === gold, 'el logro de arcade no se paga dos veces');
  const raw = JSON.parse(JSON.stringify(save.data)); const s2 = sanitize({ ...raw, challenges: ['ok', 5, '../bad'], story: { ignis: 'x', 'bad key!': 3 }, records: { arcade: { score: -5, char: '<b>' }, survival: { wins: 1e12 } } });
  ok(s2.challenges.join() === 'ok' && s2.story.ignis === 0 && !('bad key!' in s2.story) && s2.records.arcade.score === 0 && s2.records.arcade.char === '' && s2.records.survival.wins <= 9999, 'un guardado corrupto se sanea (pruebas, historia y récords)');
  const old = sanitize({ v: 1, gold: { balance: 7 } }); ok(old.challenges.length === 0 && old.records.survival.wins === 0 && old.stats.storyClears === 0 && old.gold.balance === 7, 'un guardado antiguo (sin modos) se migra con valores iniciales'); }

console.log(bad ? `${bad} fallo(s)` : 'Todas las pruebas de F7 (modos e IA) pasaron'); process.exit(bad ? 1 : 0);
