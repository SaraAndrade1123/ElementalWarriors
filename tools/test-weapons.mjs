// Armas de la tienda + rompeguardia + ataques sin arma (v0.9), en partidas reales (Match + ganchos, sin DOM).
import { register } from 'node:module'; import { readFileSync } from 'node:fs'; import { pathToFileURL } from 'node:url';
const three = pathToFileURL(process.cwd() + '/js/vendor/three/build/three.module.js').href, addons = pathToFileURL(process.cwd() + '/js/vendor/three/examples/jsm/').href;
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s,c,n){ if(s==='three') return {url:'${three}',shortCircuit:true}; if(s.startsWith('three/addons/')) return {url:'${addons}'+s.slice(13),shortCircuit:true}; return n(s,c); }`));
const ctx = new Proxy({}, { get: (_, k) => k === 'createLinearGradient' || k === 'createRadialGradient' ? () => ({ addColorStop() {} }) : () => {} });
const el = () => ({ className: '', setAttribute() {}, addEventListener() {}, setPointerCapture() {}, set textContent(v) {}, getContext: () => ctx });
globalThis.document = { createElement: el, documentElement: {}, querySelectorAll: () => [] };
globalThis.fetch = async p => ({ ok: true, json: async () => JSON.parse(readFileSync(p, 'utf8')) });
const THREE = await import('three');
const { Match } = await import('../js/game/match.js');
const { Fighter } = await import('../js/game/fighter.js');
const { loadLocale } = await import('../js/systems/localization.js');
const { SaveSystem, MemoryStorage } = await import('../js/systems/save-system.js');
const { installElements } = await import('../js/elements/element-hook.js');
const { installBending } = await import('../js/elements/bending-hook.js');
const { installWeapons, equipKey } = await import('../js/elements/weapon-hook.js');
const { validateWeapons, weaponMove, cpuWeapon, WP, GB } = await import('../js/game/weapon-arts.js');
const { buildArt, WEAPON_KINDS } = await import('../js/game/animation/weapon-art.js');
const { buildAttacks } = await import('../js/game/animation/attacks.js');
const { styleFor } = await import('../js/game/animation/styles.js');
await loadLocale('es');
const rd = p => JSON.parse(readFileSync(p, 'utf8'));
const moves = rd('data/moves.json'), { roster } = rd('data/characters.json'), WD = rd('data/weapons.json'), items = rd('data/items.json').items, es = rd('data/localization/es.json');
let bad = 0; const ok = (c, m) => { if (!c) { console.error('FALLO:', m); bad++; } else console.log('ok  ', m); };
const R = id => roster.find(r => r.id === id), DT = 1 / 60, cam = new THREE.PerspectiveCamera(32, 16 / 9);
const BL = { x: 0, down: false, guard: false, jump: false, l: false, m: false, h: false, s: false, r: false, w: false };

// 1 · datos
ok(validateWeapons(WD, items).length === 0, `catálogo de armas válido (${Object.keys(WD.weapons).length} armas): ${validateWeapons(WD, items).join('; ') || 'sin problemas'}`);
ok(items.filter(i => i.type === 'weapon').every(i => i.char === '*' && i.price >= 300), 'ninguna arma es de un guerrero concreto y todas cuestan Rose Gold (≥ 300)');
ok(Object.keys(WD.weapons).every(id => es['item.' + id] && es[`wpn.${id}.power`] && es[`wpn.${id}.passive`]), 'cada arma tiene nombre, técnica y mejora explicadas');
ok(Object.values(WD.weapons).filter(w => w.passive?.ward > 0).length >= 3 && Object.values(WD.weapons).filter(w => w.ai === 'counter').length >= 2, 'hay armas de contraataque y armas que reducen la desventaja elemental');
ok(!rd('data/menu.json').items.some(i => i.id === 'training'), 'el menú principal ya no repite «Entrenamiento» (está dentro de Jugar)');

// 2 · adaptación al elemento
{ const w = WD.weapons.wp_maza, f = weaponMove({ id: 'wp_maza', ...w }, 'fire', WD.element), e = weaponMove({ id: 'wp_maza', ...w }, 'earth', WD.element), a = weaponMove({ id: 'wp_maza', ...w }, 'wind', WD.element), q = weaponMove({ id: 'wp_maza', ...w }, 'water', WD.element);
  ok(f.dmg > w.move.dmg && e.armor && e.guardDmg > w.move.guardDmg && a.range > w.move.range && q.hitstun > w.move.hitstun && !w.move.armor, 'la maza se adapta: fuego más daño · tierra armadura y más rotura de guardia · viento más alcance · agua más aturdimiento');
  ok(weaponMove({ id: 'k', ...WD.weapons.wp_arco }, 'air', WD.element).proj.speed > WD.weapons.wp_arco.move.proj.speed, 'el elemento «air» de un guerrero personalizado se trata como viento'); }

// 3 · combate real con los ganchos instalados
const mkScene = save => { const sc = { scene: new THREE.Scene(), stage: new THREE.Group(), q: { particles: 300 }, match: null,
  startMatch(a, b, input, o) { this.match = new Match(this, input, { def: R(a), holder: new THREE.Group() }, { def: R(b), holder: new THREE.Group() }, o); }, endMatch() { this.match = null; } };
  installElements({ scene: sc, roster, data: rd('data/elements.json'), url: null }); installBending({ scene: sc, roster, data: rd('data/bending.json'), url: null });
  installWeapons({ scene: sc, roster, save, data: WD, url: null }); return sc; };
const own = (save, char, id) => save.commit(d => { d.owned.push(id); d.equipped[equipKey(char)] = id; return { ok: true }; });
const pad = () => ({ cur: {}, read() { const c = this.cur; this.cur = {}; return { ...BL, ...c }; }, clear() {} });
const run = (m, n, each) => { for (let i = 0; i < n; i++) { each?.(i); m.update(DT, cam); } };

{ const save = new SaveSystem(new MemoryStorage()), sc = mkScene(save), inp = pad();
  sc.startMatch('ignis', 'aqua', inp, { moves, mode: 'training', dummy: 'still', infinite: true }); let m = sc.match;
  ok(!m.f[0].moves[WP], 'sin arma equipada no hay técnica de arma');
  own(save, 'ignis', 'wp_cuchillos'); sc.startMatch('ignis', 'aqua', inp, { moves, mode: 'training', dummy: 'still', infinite: true }); m = sc.match; m.f[1].x = m.f[0].x + 5;
  inp.cur = { w: true }; let n = 0, got = null; run(m, 30, () => { got ||= m.f[0].act?.name; n = Math.max(n, m.proj.length); });
  ok(got === WP && n === 3, `cuchillos: el botón de arma saca la técnica (${got}) y lanza 3 cuchillos en abanico (${n})`);
  ok(m.f[0].wcd > 0 && m.f[0].wcd <= WD.weapons.wp_cuchillos.cd, `después queda en recarga (${m.f[0].wcd.toFixed(2)} s)`);
  inp.cur = { w: true }; got = null; run(m, 12, () => { if (m.f[0].act?.name === WP && m.f[0].act.t < .02) got = 'otra'; }); ok(!got, 'en recarga el botón no hace nada');
  run(m, 60 * 5); inp.cur = { w: true }; got = null; run(m, 6, () => { got ||= m.f[0].act?.name; }); ok(got === WP, 'cuando termina la recarga se puede volver a usar');
  ok(m.f[0].moves.l && !m.f[0].moves.l.weapon, 'los golpes normales siguen siendo sin arma'); }

// 4 · rompeguardia: M+H a la vez (o con 1 fotograma de diferencia) rompe la guardia de quien se protege
{ const save = new SaveSystem(new MemoryStorage()), sc = mkScene(save), inp = pad();
  sc.startMatch('terra', 'zephyr', inp, { moves, mode: 'training', dummy: 'guard', infinite: true }); const m = sc.match; m.f[1].x = m.f[0].x + 1.7;
  run(m, 5); inp.cur = { m: true, h: true }; let got = null, crush = false; run(m, 60, () => { got ||= m.f[0].act?.name; crush ||= m.f[1].stunType === 'crush'; });
  ok(got === GB && crush, `M+H = rompeguardia (${got}) y la guardia del maniquí se rompe`);
  run(m, 60); m.resetPositions(); m.f[1].x = m.f[0].x + 1.7; run(m, 3); inp.cur = { m: true }; run(m, 1); inp.cur = { h: true }; got = null; run(m, 30, () => { got ||= m.f[0].act?.name === GB ? GB : null; });
  ok(got === GB, 'M y luego H en el fotograma siguiente también sale (el medio recién empezado se convierte)');
  const f = new Fighter(R('ignis'), 0, 1, moves); ok(f.moves.gb && f.moves.gb.startup >= .25, 'todos los guerreros lo tienen y es lento (se puede interrumpir)'); }

// 5 · daga: contraataque al ser atacado durante la guardia
{ const save = new SaveSystem(new MemoryStorage()), sc = mkScene(save), inp = pad(); own(save, 'aqua', 'wp_daga');
  sc.startMatch('aqua', 'ignis', inp, { moves, mode: 'training', dummy: 'still', infinite: true }); const m = sc.match; m.f[1].x = m.f[0].x + 1.6;
  const hp0 = m.f[0].hp; inp.cur = { w: true }; let parried = false, rip = 0; const i2 = { read: () => BL }; m.brain = { think: (dt, me) => (m.f[0].act?.t > .14 && !me.act ? { ...BL, m: true } : BL), reset() {} };
  run(m, 70, () => { parried ||= !!m.f[0].act?.parried; if (m.f[1].stunType === 'hit') rip++; });
  ok(parried && m.f[0].hp >= hp0 && rip > 0, `daga: el golpe rival se bloquea solo (vida intacta) y el contraataque conecta`); }

// 6 · abanico: devuelve un proyectil · bumerán: vuelve a la mano
{ const save = new SaveSystem(new MemoryStorage()), sc = mkScene(save), inp = pad(); own(save, 'zephyr', 'wp_abanico');
  sc.startMatch('zephyr', 'terra', inp, { moves, mode: 'training', dummy: 'still', infinite: true }); const m = sc.match; m.f[1].x = m.f[0].x + 6;
  m.brain = { think: (dt, me) => (!me.act && !m.proj.length ? { ...BL, x: -1, s: true } : BL), reset() {} };
  let refl = false; run(m, 90, i => { const p = m.proj.find(q => q.owner === m.f[1]); if (p && Math.abs(p.x - m.f[0].x) < 3.5 && !m.f[0].act) inp.cur = { w: true }; refl ||= m.proj.some(q => q.reflected && q.owner === m.f[0]); });
  ok(refl, 'abanico: el proyectil del rival cambia de dueño y vuelve hacia él');
  own(save, 'ignis', 'wp_bumeran'); sc.startMatch('ignis', 'aqua', inp, { moves, mode: 'training', dummy: 'still', infinite: true }); const n = sc.match; n.f[1].x = n.f[0].x + 7;
  inp.cur = { w: true }; let back = false, caught = false; n.onWeaponEv = (o => e => { if (e.t === 'catch') caught = true; o?.(e); })(n.onWeaponEv);
  run(n, 140, () => { back ||= n.proj.some(p => p.back); });
  ok(back && caught && n.proj.length === 0, 'bumerán: llega lejos, vuelve y el guerrero lo recoge'); }

// 7 · mejora pasiva: el abanico reduce la desventaja elemental (Fuego contra Agua)
{ const save = new SaveSystem(new MemoryStorage()), sc = mkScene(save), inp = pad();
  sc.startMatch('ignis', 'aqua', inp, { moves, mode: 'training', dummy: 'still' }); run(sc.match, 2); const a0 = sc.match.f[0].atk, d0 = sc.match.f[0].dmul;
  own(save, 'ignis', 'wp_abanico'); sc.startMatch('ignis', 'aqua', inp, { moves, mode: 'training', dummy: 'still' }); run(sc.match, 2); const f = sc.match.f[0];
  ok(f.elem.rel === 'disadvantage' && f.atk > a0 && f.dmul < d0, `abanico: con desventaja elemental pega más (${(f.atk / a0 * 100 - 100).toFixed(0)} %) y recibe menos (${(100 - f.dmul / d0 * 100).toFixed(0)} %)`);
  const b = sc.match.f[1]; ok(b.atk === new Fighter(R('aqua'), 0, 1, moves).atk * b.elem.mods.damage, 'el rival sin arma no cambia'); }

// (aleatoriedad con semilla: el resultado es siempre el mismo)
{ let x = 12345; Math.random = () => { x |= 0; x = x + 0x6D2B79F5 | 0; let t = Math.imul(x ^ x >>> 15, 1 | x); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
// 8 · la CPU difícil lleva arma, la usa y rompe la guardia de un jugador que solo se protege
{ const save = new SaveSystem(new MemoryStorage()), sc = mkScene(save), inp = { read: () => ({ ...BL, guard: true }), clear() {} };
  const ids = Object.keys(WD.weapons); ok(cpuWeapon(ids, 'terra', 'normal') === null && cpuWeapon(ids, 'terra', 'expert') === cpuWeapon(ids, 'terra', 'expert'), 'la CPU solo lleva arma en Difícil/Experto (siempre la misma por rival)');
  sc.startMatch('ignis', 'terra', inp, { moves, mode: 'cpu', level: 'expert', roundTime: Infinity, infinite: true }); const m = sc.match; m.phase = 'fight';
  let w = 0, gb = 0; run(m, 60 * 45, () => { const a = m.f[1].act; if (a?.t === 0 || (a && a.t < DT * 1.01)) { if (a.name === WP) w++; if (a.name === GB) gb++; } });
  ok(m.f[1].weaponId && w > 0, `CPU experta con ${m.f[1].weaponId}: usa su técnica (${w} veces en 45 s)`);
  // sin arma (para que no se quede lanzando desde lejos), contra un jugador que solo se protege
  sc.startMatch('ignis', 'terra', inp, { moves, mode: 'cpu', level: 'expert', roundTime: Infinity, infinite: true, weapon2: null }); const n = sc.match; n.phase = 'fight'; gb = 0;
  run(n, 60 * 45, () => { const a = n.f[1].act; if (a?.name === GB && a.t < DT * 1.01) gb++; });
  ok(gb > 0, `y usa el rompeguardia contra quien solo se protege (${gb} veces)`); }

// 9 · animaciones: técnica de cada arma + rompeguardia
{ const S = styleFor('ignis'); let fin = true;
  for (const k of WEAPON_KINDS) { const c = buildArt(k, S); fin &&= c.dur > 0 && c.hit[0] < c.hit[1] && c.hit[1] <= c.dur && c.show[0] < c.hit[0] && c.show[1] <= c.dur && (!c.release || (c.release >= c.hit[0] - .01 && c.release <= c.hit[1] + .01)); }
  ok(fin, `${WEAPON_KINDS.length} animaciones de arma: sacar → usar (impacto dentro) → guardar/lanzar`);
  ok(roster.every(r => buildAttacks(styleFor(r.id)).gb?.hit), 'cada guerrero tiene la animación del rompeguardia'); }

console.log(bad ? `\n${bad} prueba(s) fallaron` : '\nTodas las pruebas de armas pasaron');
process.exit(bad ? 1 : 0);
