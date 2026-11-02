// Pruebas del flujo de modos (qué ocurre al acabar cada combate) con una interfaz simulada. npm test
import { readFileSync } from 'node:fs';
import { createFlow } from '../js/modes/flow.js';
import { Ladder } from '../js/modes/ladder.js';
import { Survival } from '../js/modes/survival.js';
import { CHALLENGES, byId } from '../js/modes/challenges.js';
import { SaveSystem, MemoryStorage } from '../js/systems/save-system.js';
import { Progression } from '../js/systems/progression-system.js';
const rd = p => JSON.parse(readFileSync(p, 'utf8')), cfg = rd('data/modes.json'), eco = rd('data/economy.json'), achs = rd('data/achievements.json').achievements;
let bad = 0; const ok = (c, m) => { if (!c) { console.error('FALLO:', m); bad++; } else console.log('ok  ', m); };
const res = (winner, o = {}) => ({ winner, wins: winner === 0 ? [2, 0] : [0, 2], stats: { dmg: [200, o.taken ?? 40], combo: [o.combo ?? 3, 1], best: [50, 10] }, time: o.time ?? 40, hp: [o.hp ?? .6, 0], rounds: 2 });
const setup = () => {
  const save = new SaveSystem(new MemoryStorage()), progression = new Progression(save, { economy: eco, achievements: achs });
  const log = { fights: [], panels: [], stories: [], hints: [], paused: [], restarts: 0, recs: [] };
  const env = { cfg, progression, t: (k, p) => k + (p ? JSON.stringify(p) : ''), nameOf: id => id, fight: c => log.fights.push(c), panel: p => log.panels.push(p), story: (s, d) => { log.stories.push(s); d(); },
    hint: h => log.hints.push(h), pauseMatch: on => log.paused.push(on), restart: () => log.restarts++,
    record: (r, c) => { const id = 'm' + log.recs.length + Math.random(); log.recs.push(c.rec); const x = progression.recordMatch({ matchId: id, mode: c.rec, outcome: r.winner < 0 ? 'draw' : r.winner === 0 ? 'win' : 'loss', characterId: c.a, roundsWon: r.wins[0], difficulty: c.level || 'normal', maxCombo: r.stats.combo[0], maxDamage: 50, durationSec: r.time, transformations: 0 }); return x.ok && !x.ignored ? x.gold + x.bonus : 0; } };
  return { save, progression, log, flow: createFlow(env) };
};
const last = a => a[a.length - 1];

// Combate suelto / versus
{ const { flow, log } = setup(); flow.begin({ kind: 'plain', cfg: { a: 'ignis', b: 'aqua', mode: 'cpu', rec: 'versus_ai' } });
  ok(log.fights.length === 1 && log.fights[0].b === 'aqua' && flow.kind === 'plain', 'un combate suelto se inicia con su configuración');
  flow.onResult(res(0)); const p = last(log.panels); ok(/result.win/.test(p.title) && p.again && !p.next && p.rows.some(r => r[0] === 'result.gold'), 'victoria suelta: Revancha y Rose Gold');
  p.again.run(); ok(log.restarts === 1, 'Revancha reinicia el combate'); flow.onResult(res(1)); ok(/result.lose/.test(last(log.panels).title), 'derrota: panel de derrota'); flow.onResult(res(-1)); ok(/result.draw/.test(last(log.panels).title), 'empate: panel de empate'); }
{ const { flow, log, save } = setup(); flow.begin({ kind: 'plain', cfg: { a: 'ignis', b: 'aqua', mode: 'training', rec: 'training' } }); const g = save.data.gold.balance; flow.onResult(res(0)); ok(save.data.gold.balance === g && log.recs[0] === 'training', 'el entrenamiento no paga'); }
{ const bal = rec => { const { flow, save } = setup(); flow.begin({ kind: 'plain', cfg: { a: 'ignis', b: 'aqua', mode: rec === 'versus_local' ? 'versus' : 'cpu', rec } }); flow.onResult(res(0)); return save.data.gold.earned; };
  const local = bal('versus_local'), ai = bal('versus_ai'); ok(local > 0 && local < ai, `versus local paga menos que contra la CPU (${local} < ${ai} con el logro de primera victoria incluido)`); }

// Arcade completo
{ const { flow, log, save } = setup(); const L = new Ladder(cfg, { hero: 'ignis', level: 'normal' }); flow.begin({ kind: 'arcade', obj: L });
  ok(log.fights.length === 1 && log.fights[0].rec === 'arcade' && log.stories.length === 0, 'arcade: empieza el primer combate sin diálogos');
  flow.onResult(res(0)); let p = last(log.panels); ok(p.next && !p.again && /result.next.rival/.test(p.sub), 'victoria: panel con «Continuar»'); p.next.run(); ok(log.fights.length === 2 && log.fights[1].b === L.rivals[1] && log.fights[1].index === 1, 'continuar inicia el siguiente rival');
  flow.onResult(res(1)); p = last(log.panels); ok(p.again && /3/.test(p.again.label) && p.onMenu, 'derrota: reintentar (con continuaciones restantes)'); p.again.run(); ok(log.fights.length === 3 && log.fights[2].b === L.rivals[1] && L.continues === 1, 'reintentar repite el mismo rival');
  flow.onResult(res(-1)); p = last(log.panels); ok(p.again && /replay/.test(p.again.label), 'empate: repetir combate'); p.again.run();
  flow.onResult(res(0)); last(log.panels).next.run(); ok(L.isFinal && log.fights.at(-1).final, 'el último combate es el rival final');
  const a0 = save.data.stats.arcadeClears; flow.onResult(res(0, { hp: .9, taken: 0, time: 15 })); p = last(log.panels); ok(/arcade.clear/.test(p.title) && !p.next && !p.again, 'al ganar el último se completa el arcade');
  ok(save.data.stats.arcadeClears === a0 + 1 && save.data.done.includes('arcade_clear') && save.data.records.arcade.score === L.score && p.rows.some(r => r[0] === 'result.record'), 'se registra la partida: logro de arcade y nuevo récord');
  ok(log.recs.every(r => r === 'arcade') && save.data.stats.matches === 5, 'cada combate se registra una sola vez como «arcade» (5 combates)'); }
// Arcade: perder sin continuaciones
{ const { flow, log, save } = setup(); const L = new Ladder(cfg, { hero: 'aqua', level: 'hard' }); flow.begin({ kind: 'arcade', obj: L });
  for (let i = 0; i < 3; i++) { flow.onResult(res(1)); last(log.panels).again.run(); } flow.onResult(res(1)); const p = last(log.panels);
  ok(/arcade.over/.test(p.title) && !p.again && save.data.stats.arcadeClears === 0 && save.data.records.arcade.score === 0, 'sin continuaciones: fin de la partida, sin logro ni récord');
  const q = setup(); const M = new Ladder(cfg, { hero: 'aqua' }); q.flow.begin({ kind: 'arcade', obj: M }); q.flow.onResult(res(1)); last(q.log.panels).onMenu(); ok(M.done && !M.cleared, 'abandonar tras perder cierra la escalera'); }

// Historia
{ const { flow, log, save } = setup(); const L = new Ladder(cfg, { kind: 'story', hero: 'terra' }); flow.begin({ kind: 'story', obj: L });
  ok(log.stories.length === 1 && log.stories[0].length === 4 && log.fights.length === 1 && log.fights[0].rec === 'story', 'historia: prólogo y diálogo antes del primer combate');
  flow.onResult(res(1)); ok(/result.retry/.test(last(log.panels).again.label) && !/\d/.test(last(log.panels).again.label.replace(/result\.retry/, '')), 'perder en la historia: reintentar sin límite');
  last(log.panels).again.run(); flow.onResult(res(0)); ok(save.data.story.terra === 1, 'tras el primer capítulo queda guardado el progreso (1/3)');
  last(log.panels).next.run(); ok(log.stories.length === 2 && log.stories[1].length === 2 && last(log.fights).b === L.rivals[1], 'continuar: diálogo de cierre + diálogo previo y siguiente combate');
  flow.onResult(res(0)); last(log.panels).next.run(); flow.onResult(res(0)); const p = last(log.panels);
  ok(log.stories.length === 4 && log.stories.at(-1).some(s => s.key === 'story.terra.ending') && /story.clear/.test(p.title), 'al terminar: epílogo del personaje y pantalla de historia completada');
  ok(save.data.story.terra === 3 && save.data.stats.storyClears === 1, 'queda guardado: 3 capítulos y 1 historia completada'); }

// Supervivencia
{ const { flow, log, save } = setup(); const S = new Survival(cfg, { hero: 'zephyr', level: 'normal' }); flow.begin({ kind: 'survival', obj: S });
  ok(log.fights[0].rec === 'survival' && log.fights[0].startHp === 1, 'supervivencia: empieza con la vida completa');
  flow.onResult(res(0, { hp: .4 })); let p = last(log.panels); ok(p.next && /result.surv.next/.test(p.sub) && /65/.test(p.sub), 'tras ganar: la vida se recupera a 65 %'); p.next.run(); ok(Math.abs(last(log.fights).startHp - .65) < 1e-9, 'el siguiente combate empieza con la vida arrastrada');
  flow.onResult(res(0, { hp: .8 })); last(log.panels).next.run(); flow.onResult(res(1)); p = last(log.panels);
  ok(/surv.over/.test(p.title) && S.done && save.data.records.survival.wins === 2 && p.rows.some(r => r[0] === 'result.record'), 'al perder: fin de la serie con 2 victorias y récord'); }

// Desafíos
{ const { flow, log, save } = setup(); const def = byId('punch3'); flow.begin({ kind: 'challenge', def, hero: 'ignis', rival: 'aqua' });
  const f = log.fights[0]; ok(f.mode === 'training' && f.dummy === 'still' && f.infinite === true && f.rec === 'training' && /punch3/.test(last(log.hints)), 'desafío: entrenamiento con maniquí y objetivo en el HUD');
  const hit = { type: 'hit', by: 0, move: 'l', combo: 1, dmg: 6, ko: false };
  flow.onEvent(hit); flow.onEvent({ ...hit, move: 'h' }); ok(/1\/3/.test(last(log.hints)), 'el progreso se actualiza (1/3)'); flow.onEvent(hit); flow.onEvent(hit);
  const p = last(log.panels); ok(/ch.done/.test(p.title) && log.paused.at(-1) === true && save.data.challenges.includes('punch3') && save.data.gold.balance === eco.challenge, `completar paga ${eco.challenge} Rose Gold y pausa el combate`);
  flow.onEvent(hit); ok(log.panels.length === 1, 'tras completarla no vuelve a dispararse'); p.again.run(); ok(log.paused.at(-1) === false, '«Seguir practicando» reanuda'); p.next.run(); ok(last(log.fights).dummy === 'still' && /kick2/.test(last(log.hints)), '«Siguiente prueba» inicia la siguiente prueba jugable');
  flow.onEvent({ type: 'hit', by: 0, move: 'h' }); flow.onEvent({ type: 'hit', by: 0, move: 'h' }); flow.begin({ kind: 'challenge', def: byId('kick2'), hero: 'ignis', rival: 'aqua' }); flow.onEvent({ type: 'hit', by: 0, move: 'h' }); flow.onEvent({ type: 'hit', by: 0, move: 'h' });
  ok(save.data.gold.balance === eco.challenge * 2, 'cada prueba paga una vez'); flow.begin({ kind: 'challenge', def: byId('kick2'), hero: 'ignis', rival: 'aqua' }); flow.onEvent({ type: 'hit', by: 0, move: 'h' }); flow.onEvent({ type: 'hit', by: 0, move: 'h' });
  ok(save.data.gold.balance === eco.challenge * 2 && /ch.again|result.ch.again/.test(JSON.stringify(last(log.panels).rows)), 'repetir una prueba ya superada no paga de nuevo'); }
{ const { flow, log } = setup(); flow.onEvent({ type: 'hit', by: 0, move: 'l' }); flow.onResult; ok(log.panels.length === 0, 'sin partida activa los eventos se ignoran'); }

console.log(bad ? `${bad} fallo(s)` : 'Todas las pruebas del flujo de modos pasaron'); process.exit(bad ? 1 : 0);
