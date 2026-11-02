// Presentación v1.0: cinemática con diálogo, producción del combate (carteles, congelado, chispas), animación por pasos.
import { register } from 'node:module'; import { readFileSync } from 'node:fs'; import { pathToFileURL } from 'node:url';
const three = pathToFileURL(process.cwd() + '/js/vendor/three/build/three.module.js').href, addons = pathToFileURL(process.cwd() + '/js/vendor/three/examples/jsm/').href;
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s,c,n){ if(s==='three') return {url:'${three}',shortCircuit:true}; if(s.startsWith('three/addons/')) return {url:'${addons}'+s.slice(13),shortCircuit:true}; return n(s,c); }`));
const ctx = new Proxy({}, { get: (_, k) => k === 'createLinearGradient' || k === 'createRadialGradient' ? () => ({ addColorStop() {} }) : () => {} });
const el = () => ({ className: '', setAttribute() {}, addEventListener() {}, setPointerCapture() {}, set textContent(v) {}, getContext: () => ctx });
globalThis.document = { createElement: el, documentElement: {}, querySelectorAll: () => [] };
globalThis.addEventListener ??= () => {}; globalThis.removeEventListener ??= () => {};
globalThis.fetch = async p => ({ ok: true, json: async () => JSON.parse(readFileSync(p, 'utf8')) });
const THREE = await import('three');
const { Match } = await import('../js/game/match.js');
const { loadLocale } = await import('../js/systems/localization.js');
const { pickLines, shotLen, installCinematic } = await import('../js/game/cinematic.js');
const { installFightFx } = await import('../js/game/fight-fx.js');
const { Director } = await import('../js/game/animation/director.js');
const { styleFor } = await import('../js/game/animation/styles.js');
await loadLocale('es');
const rd = p => JSON.parse(readFileSync(p, 'utf8'));
const moves = rd('data/moves.json'), { roster } = rd('data/characters.json'), D = rd('data/intros.json');
let bad = 0; const ok = (c, m) => { if (!c) { console.error('FALLO:', m); bad++; } else console.log('ok  ', m); };
const R = id => roster.find(r => r.id === id), ids = roster.map(r => r.id), DT = 1 / 60, cam = new THREE.PerspectiveCamera(32, 16 / 9);

// 1 · diálogos
{ let all = true, two = true, langs = true;
  for (const a of ids) for (const b of ids) {
    const es = pickLines(D, a, b, 'es', { a: R(a).name, b: R(b).name }), en = pickLines(D, a, b, 'en', { a: R(a).name, b: R(b).name });
    all &&= es.length >= 2 && es.every(l => l.text.length > 5); two &&= es.some(l => l.who === 0) && es.some(l => l.who === 1); langs &&= en.length === es.length && en[0].text !== es[0].text;
  }
  ok(all && two, `las ${ids.length * ids.length} combinaciones (incluido el espejo) tienen diálogo propio y hablan los dos`);
  ok(langs, 'cada diálogo está en español y en inglés');
  const g = pickLines(D, 'nova', 'aqua', 'es', { a: 'Nova', b: 'Aqua' }), h = pickLines(D, 'nova', 'kai', 'es', { a: 'Nova', b: 'Kai' });
  ok(g.length === 2 && h.length === 2 && /Kai/.test(h[0].text), 'un guerrero nuevo usa líneas genéricas con el nombre del rival');
  ok(shotLen('hola') >= 2.3 && shotLen('x'.repeat(400)) <= 4.6, 'cada plano dura lo que se tarda en leer (2,3 – 4,6 s)'); }

// 2 · la cinemática pausa el combate y al terminar (o saltarla) llega «Ronda 1»
const mkScene = () => { const sc = { scene: new THREE.Scene(), stage: new THREE.Group(), q: { particles: 300 }, match: null, camera: cam,
  startMatch(a, b, input, o) { this.match = new Match(this, input, { def: R(a), holder: new THREE.Group() }, { def: R(b), holder: new THREE.Group() }, o); }, endMatch() { this.match = null; } };
  installFightFx({ scene: sc, roster }); installCinematic({ scene: sc, roster, data: D }); return sc; };
const input = { read: () => ({}), clear() {} };
{ const sc = mkScene(); sc.startMatch('ignis', 'terra', input, { moves, mode: 'cpu' }); const m = sc.match;
  ok(m.phase === 'cine', 'en un combate normal empieza la cinemática');
  const hp = m.f.map(f => f.hp), x = m.f.map(f => f.x); let t = 0; while (m.phase === 'cine' && t < 30) { m.update(DT, cam); t += DT; }
  ok(m.phase === 'intro' && t > 4 && t < 20, `dura ${t.toFixed(1)} s y después llega «Ronda 1 · ¡Pelea!»`);
  ok(m.f.every((f, i) => f.hp === hp[i] && Math.abs(f.x - x[i]) < .01) && m.timer === m.roundTime, 'durante la cinemática nadie se mueve, no hay daño y el tiempo no corre');
  sc.startMatch('aqua', 'zephyr', input, { moves, mode: 'cpu' }); sc.__cine.skip(); ok(sc.match.phase === 'intro', 'se puede saltar');
  sc.startMatch('aqua', 'zephyr', input, { moves, mode: 'training' }); ok(sc.match.phase === 'fight', 'el entrenamiento no tiene cinemática');
  sc.startMatch('aqua', 'zephyr', input, { moves, mode: 'cpu', cinematic: false }); ok(sc.match.phase === 'intro', 'un modo puede desactivarla (cinematic: false)'); }

// 3 · producción del combate: carteles, congelado y chispas sin romper la simulación
{ const sc = mkScene(); sc.startMatch('ignis', 'aqua', input, { moves, mode: 'training', dummy: 'still', infinite: true }); const m = sc.match;
  const pad = { cur: {}, read() { const c = this.cur; this.cur = {}; return { x: 0, down: false, guard: false, jump: false, l: false, m: false, h: false, s: false, r: false, ...c }; }, clear() {} }; m.input = pad;
  m.f[1].x = m.f[0].x + 1.8; m.f[0].meter = 100; let err = null, hits = 0;
  try { for (let i = 0; i < 240; i++) { if (i === 5) pad.cur = { r: true }; if (i === 120) pad.cur = { h: true }; m.update(DT, cam); } } catch (e) { err = e; }
  hits = m.stats.dmg[0];
  ok(!err && hits > 0 && m.__ffx, `técnica reforzada y golpes con efectos de producción, sin errores (${err?.message || 'daño ' + hits.toFixed(0)})`);
  ok(m.v.every(v => !v.c.anim || !v.c.anim.stepFps), 'la animación es continua (fluidez ante todo; la animación por pasos queda desactivada)'); }

// 4 · el director sigue dando poses válidas aunque se le llame a saltos (animación por pasos)
{ const d = new Director(styleFor('ignis')), f = { act: { name: 'h', t: 0, def: moves.common.h }, facing: 1 }; let fin = true;
  for (let i = 0; i < 20; i++) { f.act.t += 1 / 18; const P = d.compose(1 / 18, f); fin &&= P.every(Number.isFinite); }
  ok(fin, 'poses finitas con pasos de 1/18 s'); }

// 5 · chromas premium de la tienda
{ const { applyChromaFx, CHROMA_KINDS } = await import('../js/game/chroma-fx.js');
  const pals = rd('data/items.json').items.filter(i => i.type === 'palette' && !i.hidden);
  ok(pals.every(p => p.chroma && CHROMA_KINDS[p.chroma.kind] && p.chroma.glow && p.chroma.aura), `los ${pals.length} chromas de la tienda traen efecto animado, aura y contorno propios`);
  const g = new THREE.Group(), mat = new THREE.MeshToonMaterial(); mat.userData.charMat = true; g.add(new THREE.Mesh(new THREE.BoxGeometry(), mat));
  const on = applyChromaFx(g, pals[0]), sh = { uniforms: {}, vertexShader: '#include <project_vertex>', fragmentShader: '#include <emissivemap_fragment>' }; mat.onBeforeCompile(sh);
  const off = applyChromaFx(g, null);
  ok(on && /ewChroma|ewAdd/.test(sh.fragmentShader) && sh.uniforms.ewKind && !off && !mat.userData.ewChroma, 'el efecto se inyecta en el material del guerrero y se quita al desequipar'); }

// 6 · créditos
ok(readFileSync('js/ui/menu-manager.js', 'utf8').includes("'Claude'") && readFileSync('js/ui/menu-manager.js', 'utf8').includes('Sara Andrade Rodriguez'), 'los créditos incluyen a Sara Andrade Rodriguez y a Claude');

console.log(bad ? `\n${bad} prueba(s) fallaron` : '\nTodas las pruebas de presentación pasaron');
process.exit(bad ? 1 : 0);
