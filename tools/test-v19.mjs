// v1.9: menú temático con frases, título, Logros y Desafíos con la misma interfaz, movimientos sin desbordes, créditos,
// modo espectador, registro de entradas y ventaja de fotogramas, perfil y aviso de guardado, colección con música y archivos.
import { register } from 'node:module'; import { readFileSync } from 'node:fs'; import { pathToFileURL } from 'node:url';
const three = pathToFileURL(process.cwd() + '/js/vendor/three/build/three.module.js').href;
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s,c,n){ if(s==='three') return {url:'${three}',shortCircuit:true}; return n(s,c); }`));
const ctx = new Proxy({}, { get: (_, k) => k === 'createLinearGradient' || k === 'createRadialGradient' ? () => ({ addColorStop() {} }) : () => {} });
globalThis.document = { createElement: () => ({ getContext: () => ctx }), documentElement: {}, querySelectorAll: () => [] };
globalThis.fetch = async p => ({ ok: true, json: async () => JSON.parse(readFileSync(p, 'utf8')) });
const rd = p => readFileSync(p, 'utf8'), js = p => JSON.parse(rd(p));
let bad = 0; const ok = (c, m) => { if (!c) { console.error('FALLO:', m); bad++; } else console.log('ok  ', m); };
const es = js('data/localization/es.json'), en = js('data/localization/en.json'), { roster } = js('data/characters.json');
const THREE = await import('three');

// 1 · menú
{ const { MenuBackdrop } = await import('../js/game/menu-backdrop.js'); const g = new THREE.Group(), bg = new MenuBackdrop(g);
  for (const r of roster) bg.set(r); for (let i = 0; i < 60; i++) bg.update(1 / 30, i / 30);
  ok(bg.themes.size === 4 && g.children.length === 4 + (bg.moon ? 1 : 0), /* (v1.12) + la luna compartida */ 'cada guerrero tiene su santuario animado detrás (4 temas distintos)');
  const cur = bg.themes.get(roster[3].id), old = bg.themes.get(roster[0].id); ok(cur.w > .9 && old.w < .05, 'al cambiar de guerrero un santuario se funde con el otro');
  ok(roster.every(r => [0, 1, 2, 3, 4].every(i => es[`menu.say.${r.id}.${i}`] && en[`menu.say.${r.id}.${i}`])) && new Set(roster.flatMap(r => [0, 1, 2, 3, 4].map(i => es[`menu.say.${r.id}.${i}`]))).size === 20, '5 frases propias por guerrero (20 distintas, es/en)');
  const dev = rd('tools/dev/index.html'); ok(/class="brand"><svg class='bemb'/.test(dev) && /id="say"/.test(dev), 'título con emblema y bocadillo de frases'); }

// 2 · Logros y Desafíos comparten interfaz
{ const tr = rd('js/ui/track-ui.js'), mu = rd('js/ui/modes-ui.js'), mp = rd('js/ui/meta-panels.js');
  ok(['catTabs', 'trackItem', 'totalBar', 'section'].every(f => mu.includes(f) && mp.includes(f)) && /export function heroCard/.test(tr), 'Logros y Desafíos usan las mismas piezas (pestañas con cuenta, barra total, fichas con medalla)');
  ok(/heroCard\(m, t\('challenges.with'\)\)/.test(mu) && es['challenges.with'] && es['challenges.sub'], 'Desafíos: tarjeta «Practicas con» y resumen de superados');
  ok(['fight', 'skill', 'warriors', 'modes', 'collection', 'legend'].every(c => es['ach.catdesc.' + c] && en['ach.catdesc.' + c]), 'Logros: descripción de cada categoría como en Desafíos'); }

// 3 · movimientos, créditos, colección
{ const css = rd('css/settings.css'); ok(/\.moves tr\{display:grid/.test(css) && /overflow-x:hidden/.test(css) && /\.moves td\.mvp/.test(css), 'Movimientos en fichas que no se desbordan');
  const mm = rd('js/ui/menu-manager.js'); ok(['team', 'facts', 'tools', 'original', 'fonts', 'models', 'inspiration', 'thanks'].every(k => mm.includes(`sec('${k}'`) && es['cr.' + k]), 'créditos: equipo, cifras, tecnologías, creado para el juego, tipografías, modelos, inspiración y agradecimientos');
  ok(roster.every(r => es[`char.${r.id}.story`]?.length > 200 && en[`char.${r.id}.story`]?.length > 200) && /field\.story/.test(mm), 'historia de cada guerrero en Luchadores');
  ok(/page_music/.test(rd('js/ui/meta-panels.js')) && /page_lore/.test(rd('js/ui/meta-panels.js')) && es['lore.world'], 'Colección: música y archivos de la historia'); }

// 4 · modo espectador, registro de entradas y ventaja
{ const { Match } = await import('../js/game/match.js'); const { loadLocale } = await import('../js/systems/localization.js'); await loadLocale('es');
  const moves = js('data/moves.json'), mk = r => ({ def: r, holder: new THREE.Group(), bones: {} }), sm = () => ({ scene: new THREE.Scene(), stage: new THREE.Group(), breathe() {} });
  const I = () => ({ x: 0, jump: false, down: false, l: false, m: false, h: false, s: false, r: false, guard: false }), input = { read: I, consume() {}, clear() {} }, cam = new THREE.PerspectiveCamera(32, 16 / 9);
  const w = new Match(sm(), input, mk(roster[0]), mk(roster[1]), { moves, mode: 'cpu', watch: true, level: 'hard', onHud() {}, onResult() {} }); w.phase = 'fight';
  for (let i = 0; i < 60 * 25; i++) w.update(1 / 60, cam);
  ok(w.brain1 && w.f[1].hp < w.f[1].maxHp && w.f[0].hp < w.f[0].maxHp, 'modo espectador: dos CPU se pelean solas (las dos pierden vida)');
  let hud = null; const ti = { cur: I(), read() { return this.cur; }, consume() {}, clear() {} };
  const tm = new Match(sm(), ti, mk(roster[0]), mk(roster[1]), { moves, mode: 'training', dummy: 'guard', onHud: s => { hud = s; }, onResult() {} });
  for (let i = 0; i < 60 * 4; i++) { const d = tm.f[1].x - tm.f[0].x; ti.cur = d > 1.8 ? { ...I(), x: 1 } : { ...I(), l: i % 30 === 0 }; tm.update(1 / 60, cam); }
  ok(hud?.inlog?.length > 0 && hud.inlog.some(x => x.tok.includes('L')) && hud.inlog.some(x => x.tok === '→'), `entrenamiento: registro de entradas (${hud?.inlog?.slice(0, 4).map(x => x.tok + '×' + x.n).join(', ')})`);
  ok(tm.adv && Number.isFinite(tm.adv.n), `ventaja en fotogramas tras golpe o bloqueo (${tm.adv?.n}f${tm.adv?.blocked ? ' en bloqueo' : ''})`);
  ok(/watch: !!c.watch/.test(rd('js/main.js')) && /versus\.tab\.watch/.test(rd('js/ui/modes-ui.js')) && /rec: local \? 'versus_local' : watch \? 'training'/.test(rd('js/ui/modes-ui.js')), 'Versus › Espectador sin recompensas'); }

// 5 · perfil y guardado
{ const m = rd('js/main.js'); ok(/menu\.profile = /.test(m) && /profile\.saved/.test(m) && es['profile.rank.legend'], 'perfil del jugador (rango, Rose Gold, favorito) y aviso de «Progreso guardado»'); }
ok(/^1\.(9|\d\d)\./.test(js('package.json').version), 'versión 1.9 o posterior');
console.log(bad ? `\n${bad} FALLO(S)` : '\nv1.9: todo correcto'); process.exit(bad ? 1 : 0);
