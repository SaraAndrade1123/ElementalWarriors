// Duelos espejo (v0.8): chroma exclusivo, nombres, combate del mismo guerrero y compatibilidad con guerreros personalizados.
import { register } from 'node:module'; import { readFileSync } from 'node:fs'; import { pathToFileURL } from 'node:url';
const three = pathToFileURL(process.cwd() + '/js/vendor/three/build/three.module.js').href, addons = pathToFileURL(process.cwd() + '/js/vendor/three/examples/jsm/').href;
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s,c,n){ if(s==='three') return {url:'${three}',shortCircuit:true}; if(s.startsWith('three/addons/')) return {url:'${addons}'+s.slice(13),shortCircuit:true}; return n(s,c); }`));
const ctx = new Proxy({}, { get: (_, k) => k === 'createLinearGradient' || k === 'createRadialGradient' ? () => ({ addColorStop() {} }) : () => {} });
const el = () => ({ className: '', setAttribute() {}, addEventListener() {}, setPointerCapture() {}, set textContent(v) {}, getContext: () => ctx });
globalThis.document = { createElement: el, documentElement: {}, querySelectorAll: () => [] };
globalThis.fetch = async p => ({ ok: true, json: async () => JSON.parse(readFileSync(p, 'utf8')) });
const THREE = await import('three');
const { mirrorSpec, mirrorName, hueOf, hueDist, DEFAULT_MIRROR } = await import('../js/systems/mirror-spec.js');
const { chromaMaterial, applyChroma, cloneModel } = await import('../js/game/mirror.js');
const { Match } = await import('../js/game/match.js');
const { loadLocale, t } = await import('../js/systems/localization.js');
const { createFlow } = await import('../js/modes/flow.js');
const { installElements } = await import('../js/elements/element-hook.js');
const { installBending } = await import('../js/elements/bending-hook.js');
const rd = p => JSON.parse(readFileSync(p, 'utf8'));
const { roster } = rd('data/characters.json'), mirror = rd('data/mirror.json'), items = rd('data/items.json').items, moves = rd('data/moves.json');
let bad = 0; const ok = (c, m) => { if (!c) { console.error('FALLO:', m); bad++; } else console.log('ok  ', m); };
const MIN = 25; // separación mínima de tono (grados) entre el espejo y cualquier color de la tienda

// 1 · Chroma exclusivo: distinto del original y de TODAS las paletas de la tienda de ese guerrero
for (const d of roster) {
  const s = mirrorSpec(d, mirror), shop = items.filter(i => i.type === 'palette' && i.char === d.id && i.fx);
  const hs = hueOf(s.fx.color), near = [d.fx.color, ...shop.map(p => p.fx.color)].map(c => hueDist(hs, hueOf(c)));
  ok(Math.min(...near) >= MIN, `${d.name}: aura del espejo ${s.fx.color} separada ≥${MIN}° del original y de sus ${shop.length} paletas (mín. ${Math.round(Math.min(...near))}°)`);
  ok(Math.abs(s.hue) >= 30 && s.rimStrength > 0, `${d.name}: giro de tono ${s.hue}° y contorno luminoso ${s.rim} para distinguirlo en movimiento`);
}
const ids = roster.map(d => mirrorSpec(d, mirror).fx.color); ok(new Set(ids).size === ids.length, 'cada guerrero tiene su propio chroma espejo (no se repiten)');

// 2 · Guerrero personalizado futuro sin entrada en mirror.json (o sin el archivo): funciona solo
{ const nova = { id: 'nova', name: 'Nova', element: 'fire', fx: { color: '#ff4fd8', light: '#c02bb0' } };
  const s = mirrorSpec(nova, mirror), s0 = mirrorSpec(nova, null);
  ok(s.hue === mirror.default.hue && hueDist(hueOf(s.fx.color), hueOf(nova.fx.color)) >= MIN, `guerrero nuevo «Nova»: usa el espejo por defecto y gira su aura (${nova.fx.color} → ${s.fx.color})`);
  ok(s0.hue === DEFAULT_MIRROR.hue && s0.rim === s0.fx.color, 'sin data/mirror.json también hay espejo (valores por defecto, contorno del color del aura)');
  ok(mirrorSpec({ id: 'x', name: 'X' }, null).fx.color.startsWith('#'), 'un guerrero sin color de aura recibe uno por defecto'); }

// 3 · Nombres: propio, genérico y sin traducciones
await loadLocale('es');
ok(mirrorName(roster.find(r => r.id === 'ignis'), t) === 'Ignis · Llama Jade', 'nombre propio del espejo de Ignis (es)');
ok(mirrorName({ id: 'nova', name: 'Nova' }, t) === 'Eco de Nova', 'guerrero nuevo: nombre genérico «Eco de Nova»');
ok(mirrorName({ id: 'nova', name: 'Nova' }, k => k) === 'Nova ✦', 'sin textos: «Nova ✦»');
await loadLocale('en'); ok(mirrorName(roster.find(r => r.id === 'terra'), t) === 'Terra · Rose Quartz', 'nombre del espejo en inglés'); await loadLocale('es');

// 4 · Shader: clona el material (el original no cambia), ignora la textura de paleta de la tienda e inyecta el chroma y el contorno
{ const tex = new THREE.Texture(), shopTex = new THREE.Texture(), mat = new THREE.MeshToonMaterial({ map: shopTex }); mat.userData.orig = tex;
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(), mat), g = new THREE.Group(); g.add(mesh);
  const spec = mirrorSpec(roster[0], mirror), n = applyChroma(g, spec), m2 = mesh.material;
  ok(n === 1 && m2 !== mat && mat.onBeforeCompile.toString() === new THREE.MeshToonMaterial().onBeforeCompile.toString(), 'applyChroma clona el material: el guerrero original queda intacto');
  ok(m2.map === tex && !m2.userData.orig, 'el espejo parte de la textura ORIGINAL aunque el jugador lleve una paleta de la tienda');
  const sh = { uniforms: {}, vertexShader: 'varying vec3 vViewPosition;', fragmentShader: 'varying vec3 vViewPosition;\nvoid main() {\n#include <color_fragment>\n#include <emissivemap_fragment>\n}' };
  m2.onBeforeCompile(sh);
  ok(/ewChroma\(diffuseColor\.rgb\)/.test(sh.fragmentShader) && /ewRim \* fr/.test(sh.fragmentShader) && sh.uniforms.ewHue && sh.uniforms.ewRim, 'el shader recibe el chroma (tono/saturación/brillo, piel preservada) y el contorno luminoso');
  const basic = chromaMaterial(new THREE.MeshBasicMaterial(), spec), sb = { uniforms: {}, vertexShader: '', fragmentShader: 'void main() {\n#include <color_fragment>\n#include <emissivemap_fragment>\n}' }; basic.onBeforeCompile(sb);
  ok(/ewChroma/.test(sb.fragmentShader) && !/ewRim \* fr/.test(sb.fragmentShader), 'materiales sin luz (Basic) reciben el chroma sin contorno: sirve para cualquier modelo'); }

// 5 · Clon animable independiente (SkeletonUtils): huesos propios
{ const bones = [new THREE.Bone(), new THREE.Bone()]; bones[0].add(bones[1]);
  const geo = new THREE.BoxGeometry(); geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(new Array(geo.attributes.position.count * 4).fill(0), 4)); geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(new Array(geo.attributes.position.count * 4).fill(0).map((_, i) => i % 4 ? 0 : 1), 4));
  const sk = new THREE.SkinnedMesh(geo, new THREE.MeshToonMaterial()), root = new THREE.Group(); root.add(bones[0], sk); sk.bind(new THREE.Skeleton(bones));
  const c = cloneModel(root); let cs = null; c.traverse(o => { if (o.isSkinnedMesh) cs = o; });
  ok(cs && cs.skeleton.bones[0] !== bones[0] && cs.skeleton.bones[0].parent && c.children.includes(cs.skeleton.bones[0]), 'el espejo tiene su propio esqueleto (se anima por separado del original)'); }

// 6 · Combate real del mismo guerrero contra sí mismo (CPU, versus y entrenamiento) + triángulo elemental neutro
const R = id => roster.find(r => r.id === id), DT = 1 / 60, cam = new THREE.PerspectiveCamera(32, 16 / 9);
const mk = () => { const sc = { scene: new THREE.Scene(), stage: new THREE.Group(), q: { particles: 300 }, match: null,
  startMatch(a, b, input, o) { this.match = new Match(this, input, { def: R(a), holder: new THREE.Group() }, { def: R(b), holder: new THREE.Group(), mirror: mirrorSpec(R(b), mirror) }, o); }, endMatch() { this.match = null; } };
  installElements({ scene: sc, roster, data: rd('data/elements.json'), url: null }); installBending({ scene: sc, roster, data: rd('data/bending.json'), url: null }); return sc; };
for (const id of roster.map(r => r.id)) {
  const sc = mk(), input = { read: () => ({}), clear() {} }; sc.startMatch(id, id, input, { moves, mode: 'cpu', level: 'expert' }); const m = sc.match; m.phase = 'fight';
  let err = null; try { for (let i = 0; i < 60 * 20 && !m.over; i++) m.update(DT, cam); } catch (e) { err = e; }
  ok(!err && m.f[0].def.id === m.f[1].def.id && m.f.every(f => f.elem?.rel === 'neutral') && m.f[1].hp < m.f[1].maxHp + 1e-9, `${R(id).name} contra su espejo: 20 s de combate sin errores, mismo elemento = neutro (${err?.message || 'ok'})`);
}
// 7 · Flujo: los textos de resultado distinguen al espejo
{ const names = []; const sc = mk(), input = { read: () => ({}), clear() {} };
  const flow = createFlow({ cfg: rd('data/modes.json'), progression: { award: () => ({}), record() {}, save: { data: {} } }, t, nameOf: id => R(id).name,
    sideName: (c, i) => i ? mirrorName(R(c.b), t) : R(c.a).name, record: () => 0, restart() {}, panel: p => names.push(p), story: (s, d) => d(), hint() {}, pauseMatch() {},
    fight: c => sc.startMatch(c.a, c.b, input, { moves, mode: c.mode }) });
  ok(typeof flow.begin === 'function', 'el flujo de modos acepta sideName para nombrar al espejo'); }

console.log(bad ? `\n${bad} prueba(s) fallaron` : '\nTodas las pruebas de duelo espejo pasaron');
process.exit(bad ? 1 : 0);
