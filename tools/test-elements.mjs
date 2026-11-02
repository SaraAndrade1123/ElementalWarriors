// Pruebas del TRIÁNGULO ELEMENTAL (npm test). Reglas puras, efecto real sobre el daño/guardia/Resonancia del combate
// (usando fighter.js tal cual), y la integración en una partida (Match) a través de installElements.
import { register } from 'node:module'; import { readFileSync } from 'node:fs'; import { pathToFileURL } from 'node:url';
const three = pathToFileURL(process.cwd() + '/js/vendor/three/build/three.module.js').href;
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s,c,n){ if(s==='three') return {url:'${three}',shortCircuit:true}; return n(s,c); }`));
const ctx = new Proxy({}, { get: (_, k) => k === 'createLinearGradient' || k === 'createRadialGradient' ? () => ({ addColorStop() {} }) : () => {} });
globalThis.document = { createElement: () => ({ getContext: () => ctx }), documentElement: {}, querySelectorAll: () => [] };
globalThis.fetch = async p => ({ ok: true, json: async () => JSON.parse(readFileSync(p, 'utf8')) });
const THREE = await import('three');
const { Fighter, resolveBoth, resolveThrows, separate, NONE, movesFor } = await import('../js/game/fighter.js');
const { Match } = await import('../js/game/match.js');
const { loadLocale } = await import('../js/systems/localization.js');
const E = await import('../js/game/elements.js');
const { installElements } = await import('../js/elements/element-hook.js');
await loadLocale('es'); // (document falso sin getElementById: el gancho funciona sin interfaz)

const rd = p => JSON.parse(readFileSync(p, 'utf8'));
const data = rd('data/elements.json'), moves = rd('data/moves.json'), { roster } = rd('data/characters.json');
const { rules: RULES, problems } = E.normalizeElements(data);
let bad = 0; const ok = (c, m) => { if (!c) { console.error('FALLO:', m); bad++; } else console.log('ok  ', m); };
const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;
const R = id => roster.find(r => r.id === id), DT = 1 / 60;
const EL = { ignis: 'fire', aqua: 'water', terra: 'earth', zephyr: 'wind' };

// ── 1 · Reglas (las de las imágenes) ──
ok(problems.length === 0, 'data/elements.json es válido' + (problems.length ? ': ' + problems.join('; ') : ''));
ok(RULES.elements.water.beats === 'fire' && RULES.elements.fire.beats === 'wind' && RULES.elements.wind.beats === 'water', 'Agua > Fuego, Fuego > Aire, Aire > Agua');
ok(RULES.elements.earth.neutral && !RULES.elements.earth.beats && RULES.neutral === 'earth', 'Tierra es el elemento neutro');
ok(E.cycleOf(RULES).join('>') === 'water>fire>wind', 'el ciclo del triángulo se deduce de los datos');
for (const c of roster) ok(c.element === EL[c.id] && E.elementOf(c, RULES) === EL[c.id], `${c.name} es de ${c.element} (data/characters.json)`);
const T = { water: { fire: 'advantage', wind: 'disadvantage', earth: 'neutral', water: 'neutral' }, fire: { wind: 'advantage', water: 'disadvantage', earth: 'neutral', fire: 'neutral' },
  wind: { water: 'advantage', fire: 'disadvantage', earth: 'neutral', wind: 'neutral' }, earth: { fire: 'neutral', water: 'neutral', wind: 'neutral', earth: 'neutral' } };
let tbl = true; for (const a in T) for (const b in T[a]) if (E.relation(a, b, RULES) !== T[a][b]) { tbl = false; console.error('  ', a, b, E.relation(a, b, RULES)); }
ok(tbl, 'tabla completa de relaciones (16 combinaciones) correcta');
for (const a of roster) for (const b of roster) if (a !== b) { const [x, y] = E.matchup(a, b, RULES); if (!near(x.dealt, y.taken) || !near(x.taken, y.dealt)) ok(false, `simetría ${a.id}-${b.id}`); }
ok(true, 'el daño que uno inflige es exactamente el que el otro recibe');
{ const [t, z] = E.matchup(R('terra'), R('zephyr'), RULES); ok(t.dealt === 1 && t.taken === 1 && z.dealt === 1 && z.taken === 1, 'Tierra inflige y recibe 100 % contra cualquiera'); }
ok(E.validateElements({ elements: { a: { beats: 'b' }, b: { beats: 'a' } } }).length > 0, 'detecta reglas inválidas (dos elementos que se ganan mutuamente)');
ok(E.normalizeElements({ elements: { x: { beats: 'nada' } } }).rules === E.DEFAULT_ELEMENTS, 'con reglas inválidas usa las de respaldo en vez de romper el combate');
ok(E.elementOf({ id: 'nuevo' }, RULES) === 'earth', 'un guerrero nuevo sin elemento es neutro');

// ── 2 · Efecto real en el combate (fighter.js sin modificar) ──
const pair = (att, def, apply, gap = 1.2) => { const a = new Fighter(R(att), 0, 1, moves), b = new Fighter(R(def), gap, -1, moves); if (apply) E.applyMatchup(a, b, RULES); return [a, b]; };
function strike(att, def, apply, { btn = 'l', block = false, gap } = {}) {
  const [a, b] = pair(att, def, apply, gap);
  for (let i = 0; i < 90; i++) {
    a.update(DT, i === 0 ? { ...NONE, [btn]: true } : NONE, b); b.update(DT, block ? { ...NONE, guard: true } : NONE, a); separate(a, b);
    const ev = resolveBoth(a, b).find(e => e.a === a); if (ev) return { ev, loss: b.maxHp - b.hp, meter: a.meter, guard: b.guard, a, b };
  }
  return null;
}
const ratio = (att, def, o) => { const x = strike(att, def, true, o), y = strike(att, def, false, o); return x && y ? { hp: x.loss / y.loss, meter: x.meter / y.meter, guard: y.guard ? x.guard / y.guard : 1, x, y } : null; };
{ const r = ratio('aqua', 'ignis'); ok(r && near(r.hp, 1.2), `Aqua (agua) golpea a Ignis (fuego): ${(r?.hp * 100).toFixed(1)} % del daño normal`); ok(r && near(r.meter, 1.1), `y gana un ${(r?.meter * 100).toFixed(0)} % de Resonancia`); }
{ const r = ratio('ignis', 'aqua'); ok(r && near(r.hp, .8), `Ignis golpea a Aqua: ${(r?.hp * 100).toFixed(1)} % (desventaja)`); ok(r && near(r.meter, .9), 'y gana un 90 % de Resonancia'); }
{ const r = ratio('ignis', 'zephyr'); ok(r && near(r.hp, 1.2), 'Fuego > Aire: Ignis hace 120 % a Zephyr'); }
{ const r = ratio('zephyr', 'aqua'); ok(r && near(r.hp, 1.2), 'Aire > Agua: Zephyr hace 120 % a Aqua'); }
{ const r = ratio('zephyr', 'ignis'); ok(r && near(r.hp, .8), 'Zephyr hace 80 % a Ignis'); }
for (const o of ['ignis', 'aqua', 'zephyr']) { const r1 = ratio('terra', o), r2 = ratio(o, 'terra'); ok(r1 && r2 && near(r1.hp, 1) && near(r2.hp, 1) && near(r1.meter, 1), `Terra ↔ ${o}: 100 % en ambos sentidos`); }
{ const r = ratio('ignis', 'zephyr', { btn: 'h', block: true }); ok(r && r.x.ev.blocked && near(r.guard, 1.2), `al bloquear, la guardia se desgasta un ${(r?.guard * 100).toFixed(0)} % (ventaja)`); }
{ const r = ratio('ignis', 'zephyr', { btn: 's', block: true, gap: 2 }); ok(r && r.x.ev.blocked && near(r.hp, 1.2), `daño al bloquear (chip) de la Embestida: ${(r?.hp * 100).toFixed(0)} %`); }
{ const r = ratio('zephyr', 'ignis', { btn: 's', block: true, gap: 1.5 }); ok(r && r.x.ev.blocked && near(r.hp, .8), `chip en desventaja: ${(r?.hp * 100).toFixed(0)} %`); }
{ // lanzamiento
  const thr = apply => { const [a, b] = pair('aqua', 'ignis', apply); for (let i = 0; i < 120; i++) { a.update(DT, i === 0 ? { ...NONE, l: true, m: true } : NONE, b); b.update(DT, NONE, a); const ev = resolveThrows(a, b).find(e => e.type === 'throw'); if (ev) return ev.dmg; } return 0; };
  const x = thr(true), y = thr(false); ok(x > 0 && near(x / y, 1.2), `los lanzamientos también: ${(x / y * 100).toFixed(0)} %`); }
{ // armadura de Terra (absorbe la mitad, pero con el multiplicador del atacante, que contra Tierra es 100 %)
  const [a, b] = pair('zephyr', 'terra', true); ok(near(a.atk, a.elem.baseAtk) && near(b.atk, b.elem.baseAtk), 'contra Tierra nadie cambia su fuerza'); }
{ // idempotencia, restauración y cambio de rival
  const [a, b] = pair('aqua', 'ignis', false), atk0 = a.atk, chip0 = a.moves.s.proj.chip;
  E.applyMatchup(a, b, RULES); E.applyMatchup(a, b, RULES); ok(near(a.atk, atk0 * 1.2), 'aplicar dos veces no acumula la ventaja');
  ok(near(a.moves.s.proj.chip, chip0 * 1.2) && movesFor(moves, 'aqua').s.proj.chip === chip0 && b.moves !== a.moves, 'los golpes se modifican en una copia propia (data/moves.json intacto)');
  E.clearElement(a); ok(a.atk === atk0 && a.moves.s.proj.chip === chip0 && !Object.prototype.hasOwnProperty.call(a, 'gain') && a.elem === null, 'clearElement lo deja todo como estaba');
  const t = new Fighter(R('terra'), 2, -1, moves); E.applyElement(a, b, RULES); E.applyElement(a, t, RULES); ok(near(a.atk, atk0) && a.elem.rel === 'neutral', 'al cambiar de rival se recalcula desde cero (Agua contra Tierra = 100 %)'); }
{ // el escalado de combos, contraataques y aturdimiento no cambian
  const x = strike('aqua', 'ignis', true), y = strike('aqua', 'ignis', false); ok(x.b.stunMax === y.b.stunMax && x.b.kv === y.b.kv, 'el aturdimiento y el empuje son idénticos (los combos no cambian)'); }

// ── 3 · Integración en una partida (Match + installElements, sin DOM) ──
const I = o => ({ ...NONE, ...o });
const mkChar = r => ({ def: r, holder: new THREE.Group() });
const fakeScene = () => ({ scene: new THREE.Scene(), stage: new THREE.Group(), q: { particles: 300 }, match: null,
  startMatch(a, b, input, o) { this.match = new Match(this, input, mkChar(R(a)), mkChar(R(b)), o); }, endMatch() { this.match?.dispose(); this.match = null; } });
const cam = new THREE.PerspectiveCamera(32, 16 / 9);
const play = (a, b, mode, bot) => {
  const sc = fakeScene(), api = installElements({ scene: sc, roster, data, url: null }), log = { hud: null, notes: [] };
  const input = { cur: I(), read() { const c = this.cur; this.cur = I({ x: c.x, down: c.down, guard: c.guard }); return c; }, clear() {} };
  sc.startMatch(a, b, input, { moves, mode, onHud: s => { log.hud = s; } }); const m = sc.match;
  const run = (sec, until) => { for (let i = 0; i < sec * 60; i++) { input.cur = bot(m, i); m.update(DT, cam); for (const n of m.notes) if (!log.notes.includes(n)) log.notes.push(n); if (until?.(m)) return true; } return false; };
  return { sc, api, m, log, run };
};
{ const { m, api, log, run, sc } = play('aqua', 'ignis', 'training', (mm, i) => I({ l: i === 20 })); m.f[1].x = m.f[0].x + 1.3;
  ok(m.f[0].elem?.rel === 'advantage' && m.f[1].elem?.rel === 'disadvantage', 'al empezar el combate (scene.startMatch) se aplica la relación Agua > Fuego');
  ok(near(m.f[0].atk, m.f[0].elem.baseAtk * 1.2) && near(m.f[1].atk, m.f[1].elem.baseAtk * .8), 'y cambia las estadísticas de ambos (fuerza efectiva 120 % / 80 %)');
  run(.05); ok(log.notes.some(n => n.kind === 'elem-advantage' && n.side === 0), 'aviso «¡VENTAJA ELEMENTAL!» en el lado de Aqua al empezar');
  run(1, mm => mm.f[1].hp < mm.f[1].maxHp); ok(log.notes.some(n => n.kind === 'elem-advantage' && /EFICAZ/.test(n.text)), 'aviso «¡EFICAZ!» al conectar el primer golpe');
  ok(log.hud?.elem?.[0]?.el === 'water' && log.hud.elem[1].rel === 'disadvantage', 'el HUD recibe el estado elemental de ambos');
  m.setDebug(true); run(.05); ok(log.hud.dbg?.some(l => /Agua.*Ventaja.*120%/.test(l)), 'F1 (depuración) muestra elemento, relación y multiplicadores'); m.setDebug(false);
  ok(api.matchup('zephyr', 'aqua')[0].rel === 'advantage' && sc.__elements === api, 'API pública: elements.matchup(a, b)');
  // F7: un modo que cambia de rival dentro del mismo Match (p. ej. supervivencia) → se recalcula solo
  const atk0 = m.f[0].elem.baseAtk; m.f[1] = new Fighter(R('terra'), 2, -1, moves); run(DT * 2);
  ok(m.f[1].elem?.el === 'earth' && m.f[0].elem.rel === 'neutral' && near(m.f[0].atk, atk0), 'si cambia el rival a mitad de partida, se recalcula (Agua vs Tierra = 100 %)');
  sc.startMatch('ignis', 'zephyr', m.input, { moves, mode: 'cpu' }); ok(sc.match.f[0].elem.rel === 'advantage', 'cada combate nuevo vuelve a aplicarse (Ignis > Zephyr)'); }
{ const { m, run } = play('terra', 'ignis', 'cpu', () => I()); m.brain = { think: () => I() };
  ok(m.f.every(f => f.elem.rel === 'neutral' && near(f.atk, f.elem.baseAtk)), 'Terra contra Ignis: los dos al 100 %');
  run(3); m.f[0].hp = 0; m.f[0].ko = true; run(6, mm => mm.round === 2); ok(m.round === 2 && m.f.every(f => near(f.atk, f.elem.baseAtk)), 'las rondas siguientes conservan los valores correctos'); }
{ const { m, run } = play('zephyr', 'aqua', 'cpu', () => I()); m.brain = { think: () => I() }; run(2.5);
  const r1 = m.f[0].atk; m.restart(); run(.1); ok(m.f[0].atk === r1 && m.f[0].elem.rel === 'advantage', 'la revancha mantiene la ventaja sin acumularla'); }
{ // daño real en partida: un proyectil de Aqua sobre Ignis hace 120 % del de Aqua sobre Terra (misma defensa ajustada)
  const shot = (foe) => { const { m, run } = play('aqua', foe, 'training', (mm, i) => I({ s: i === 2 })); m.f[1].x = 4; run(2, mm => mm.f[1].hp < mm.f[1].maxHp); return (m.f[1].maxHp - m.f[1].hp) / m.f[1].dmul; };
  const vsFire = shot('ignis'), vsEarth = shot('terra'); ok(near(vsFire / vsEarth, 1.2, 1e-6), `la Hidrolanza hace ${(vsFire / vsEarth * 100).toFixed(0)} % a Ignis frente a Terra (neutro)`); }

console.log(bad ? `\n${bad} prueba(s) fallaron` : '\nTodas las pruebas del triángulo elemental pasaron');
process.exit(bad ? 1 : 0);
