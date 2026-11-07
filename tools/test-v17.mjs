// v1.7: animaciones fluidas (inercialización medida), derrota en el suelo, chromas distintos (material + técnicas), corona de Terra, logo.
import { register } from 'node:module'; import { readFileSync } from 'node:fs'; import { pathToFileURL } from 'node:url';
const three = pathToFileURL(process.cwd() + '/js/vendor/three/build/three.module.js').href, addons = pathToFileURL(process.cwd() + '/js/vendor/three/examples/jsm/').href;
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s,c,n){ if(s==='three') return {url:'${three}',shortCircuit:true}; if(s.startsWith('three/addons/')) return {url:'${addons}'+s.slice(13),shortCircuit:true}; return n(s,c); }`));
const rd = p => readFileSync(p, 'utf8'), js = p => JSON.parse(rd(p));
let bad = 0; const ok = (c, m) => { if (!c) { console.error('FALLO:', m); bad++; } else console.log('ok  ', m); };
const THREE = await import('three');

// 1 · fluidez: combates IA contra IA de todas las parejas, sin saltos ni rebotes de un fotograma
{ const { audit } = await import('./anim-audit.mjs');
  const { total, stats } = audit({ secs: 8, seeds: 1 });
  const rate = total.pops / total.frames * 1000; ok(rate < 60, `tirones por cada 1000 fotogramas: ${rate.toFixed(1)} (antes de la v1.7 eran ~890)`);
  const getup = Object.values(stats).reduce((s, c) => s + (c.getup?.n || 0) + (c['down→getup']?.n || 0), 0); ok(getup < 20, `levantarse sin saltos (${getup})`); }
{ const { makeClip, evalClip, N, IDX } = await import('../js/game/animation/pose.js');
  const c = makeClip('x', 1, [{ t: 0, comY: -.8 }, { t: .5, comY: 0 }]), o = new Float32Array(N);
  evalClip(c, 0, new Float32Array(N), o); ok(Math.abs(o[IDX.comY] + .8) < 1e-6, 'una clave en t = 0 vale desde el primer fotograma (antes daba un salto)'); }
{ const { Director } = await import('../js/game/animation/director.js'); const { STYLES } = await import('../js/game/animation/styles.js');
  const { IDX } = await import('../js/game/animation/pose.js');
  const d = new Director(STYLES.ignis, { legLen: 1.6 }), f = { facing: 1 }; for (let i = 0; i < 30; i++) d.compose(1 / 60, f);
  const a = d.compose(1 / 60, { ...f, stun: .3, stunMax: .3, stunType: 'hit', hitN: 1, hitKb: 6 }), b = d.compose(1 / 60, { ...f, stun: .28, stunMax: .3, stunType: 'hit', hitN: 1, hitKb: 6 });
  ok(Math.abs(b[IDX.hnFz] - a[IDX.hnFz]) < .08, 'al recibir un golpe las manos no saltan de un fotograma a otro');
  ok(typeof d.startInert === 'function' && !/this\.xf\.t/.test(rd('js/game/animation/director.js')), 'transiciones por inercialización (sin el fundido congelado de 35 ms)'); }

// 2 · derrota en el suelo
{ const { buildAttacks } = await import('../js/game/animation/attacks.js'); const { STYLES } = await import('../js/game/animation/styles.js');
  const L = ['ignis', 'aqua', 'terra', 'zephyr'].map(id => buildAttacks(STYLES[id]).lose);
  ok(L.every(c => c?.ground && c.hold), 'los 4 tienen un gesto de derrota EN EL SUELO');
  const sig = L.map(c => JSON.stringify(c.track)); ok(new Set(sig).size === 4, 'y los 4 son distintos');
  const cine = rd('js/game/cinematic-end.js'); ok(/L\.ko = true/.test(cine) && !/L\.ko = false/.test(cine), 'el vencido no se levanta ni sale del plano'); }

// 3 · chromas: cada uno su efecto, sin teñir piel/pelo, uniformes propios por material
{ const items = js('data/items.json').items.filter(i => i.type === 'palette');
  ok(items.length === 20 && items.every(i => i.chroma && i.slots && i.vfx && !i.hue), 'las 20 paletas tienen recoloreado por zonas, efecto de material y estilo de técnicas');
  const by = {}; for (const i of items) (by[i.char] ??= []).push(i);
  ok(Object.values(by).every(l => new Set(l.map(i => i.chroma.kind)).size === l.length && new Set(l.map(i => i.vfx.style)).size === l.length), 'dentro de cada guerrero, ningún chroma repite efecto ni estilo de técnicas');
  ok(items.filter(i => i.chroma.kind === 'lava').length === 1, 'el efecto de lava solo lo tiene «Lava»');
  const { CHROMA_KINDS, applyChromaFx } = await import('../js/game/chroma-fx.js');
  ok(Object.keys(CHROMA_KINDS).length >= 19 && items.every(i => CHROMA_KINDS[i.chroma.kind]), `19 efectos de material distintos (${Object.keys(CHROMA_KINDS).join(', ')})`);
  const mat = new THREE.MeshToonMaterial(); mat.userData.charMat = true; mat.name = 'body'; const mesh = new THREE.Mesh(new THREE.BoxGeometry(), mat), g = new THREE.Group(); g.add(mesh);
  applyChromaFx(g, items[0]); const U = mat.userData.ewU, k0 = U.ecKind.value; applyChromaFx(g, items.find(i => i.chroma.kind !== items[0].chroma.kind));
  ok(mat.userData.ewU === U && U.ecKind.value !== k0, 'al cambiar de chroma se actualizan SUS uniformes (antes se quedaba el efecto del primero)');
  const hm = new THREE.MeshToonMaterial(); hm.userData.charMat = true; hm.name = '5_head_1'; g.add(new THREE.Mesh(new THREE.BoxGeometry(), hm)); applyChromaFx(g, items[0]);
  ok(hm.userData.ewU.ecHead.value === 1 && mat.userData.ewU.ecHead.value === 0, 'la cabeza (pelo y cara) no recibe el patrón, solo el contorno');
  const m = js('data/mirror.json'); ok(['ignis', 'aqua', 'terra', 'zephyr'].every(id => m.chars[id].chroma?.kind && m.chars[id].vfx?.style), 'los 4 espejos tienen efecto y técnicas propias');
  const mods = rd('js/systems/palette-models.js'); ok(/band:/.test(mods) && /bandGold:/.test(mods) && /pom:/.test(mods) && /'band', 'bandGold', 'pom'/.test(rd('js/game/scene-manager.js')), 'la corona del pelo de Terra (banda, franja y pompones) cambia con cada chroma');
  ok(items.filter(i => i.char === 'terra').every(i => i.slots.band && i.slots.pom), 'cada chroma de Terra define su corona');
  const { applyPalette } = await import('../js/systems/palette.js'); const { PALETTE_MODELS } = await import('../js/systems/palette-models.js');
  const px = new Uint8ClampedArray([0x48, 0x6d, 0x3c, 255]); applyPalette(px, PALETTE_MODELS.terra, { main: '#ff0000', band: '#0000ff' }, {});
  const hx = new Uint8ClampedArray([0x48, 0x6d, 0x3c, 255]); applyPalette(hx, PALETTE_MODELS.terra, { main: '#ff0000', band: '#0000ff' }, { only: ['band'] });
  ok(px[0] > 200 && hx[2] > 200, 'el verde del cuerpo usa «main» y el de la cabeza usa «band»'); }
{ const { themeOf, themed, TH, registerTables, signature, STYLES } = await import('../js/game/chroma-vfx.js');
  const tbl = { elem: { ignis: { a: new THREE.Color(1, 1, 1), b: new THREE.Color(1, 0, 0), c: new THREE.Color(1, .5, 0) } }, bend: { fire: [new THREE.Color(1, 1, 1), new THREE.Color(1, .5, 0), new THREE.Color(1, 0, 0)] } };
  const before = tbl.elem.ignis.c.getHexString(); registerTables(tbl); const pal = js('data/items.json').items.find(i => i.id === 'pal_ignis_azure'), f = { vtheme: themeOf(pal, 'ignis') };
  let inside = null; themed(f, () => { inside = tbl.elem.ignis.c.getHexString() + '/' + tbl.bend.fire[1].getHexString(); });
  ok(inside === new THREE.Color(pal.vfx.c).getHexString() + '/' + new THREE.Color(pal.vfx.c).getHexString() && tbl.elem.ignis.c.getHexString() === before && !TH.cur, 'las técnicas usan los colores del chroma mientras se dibujan y se restauran después');
  ok(STYLES.length >= 12 && /signature\(/.test(rd('js/game/match.js')) && /themed\(p\.owner/.test(rd('js/game/match.js')), '12 firmas de técnicas (humo, espiral, rayos, esquirlas…) también en los proyectiles');
  let n = 0; themed(f, () => signature({ parts: { emit: () => n++ }, n: k => k }, { x: 0, y: 1, z: 0 }, 4)); ok(n > 0, 'la firma emite su decoración'); }

// 4 · logo
{ const dev = rd('tools/dev/index.html'); const icon = dev.match(/rel="icon"[^>]*href="([^"]+)"/)?.[1] || '';
  ok(/linearGradient/.test(icon) && (icon.match(/<path/g) || []).length >= 4 && !/M32 32 27\.5 21/.test(icon), 'logo nuevo: cuatro llamas elementales en molinete (no rombos)'); }
ok(js('package.json').version === '1.7.0' && /v1\.7\.0/.test(js('data/localization/es.json')['ui.version']), 'versión 1.7.0');

console.log(bad ? `\n${bad} FALLO(S)` : '\nv1.7: todo correcto'); process.exit(bad ? 1 : 0);
