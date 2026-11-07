import * as THREE from 'three';

// TÉCNICAS CON CHROMA (v1.7): cada chroma (tienda o espejo) cambia también las técnicas de su guerrero —golpes, estelas,
// proyectiles, cintas de fuego/agua, rocas, auras— con sus colores y con una FIRMA propia:
//   embers chispas que suben · smoke humo de color · helix dos hilos de luz en espiral · bolt rayos en zigzag
//   shards esquirlas de cristal · stars destellos que titilan · bubbles burbujas · snow copos · ink gotas de tinta
//   sand arena que se arrastra · petals pétalos · runes anillos de runas
// Funciona por «tema activo»: mientras se dibuja lo de un luchador, las tablas de color de los efectos (ELEM de vfx.js y
// C de bending-vfx.js) toman los colores de su chroma y se restauran al acabar. Así no hay que tocar cada efecto, y en
// un duelo espejo cada uno conserva los suyos. Solo presentación.
export const TH = { cur: null, depth: 0, tables: [] };
const KINDS_OF = { ignis: ['fire'], aqua: ['water', 'ice'], terra: ['earth', 'rune'], zephyr: ['air'] };
export const STYLES = ['embers', 'smoke', 'helix', 'bolt', 'shards', 'stars', 'bubbles', 'snow', 'ink', 'sand', 'petals', 'runes'];

// Tablas que el tema sustituye: elem = { id: {a,b,c} }, bend = { kind: [claro, medio, oscuro] | Color }.
export function registerTables(t) { if (!TH.tables.includes(t)) TH.tables.push(t); }

const col = h => new THREE.Color(h);
// Tema a partir de una paleta (items.json) o de la especificación del espejo (mirror.json → pal).
export function themeOf(pal, id) {
  if (!pal) return null;
  const v = pal.vfx || {}, ch = pal.chroma || {}, fx = pal.fx || {};
  const c = col(v.c || ch.glow || fx.color || '#ffffff'), a = col(v.a || '#ffffff').lerp(c, v.a ? 0 : .35), b = col(v.b || ch.glow2 || fx.light || '#888888');
  return { id: pal.id || id, char: id, a, b, c, style: STYLES.includes(v.style) ? v.style : null, kinds: KINDS_OF[id] || [] };
}

function swapIn(th) {
  const saved = [];
  for (const t of TH.tables) {
    const e = t.elem?.[th.char]; if (e) { saved.push([e.a, e.a.clone()], [e.b, e.b.clone()], [e.c, e.c.clone()]); e.a.copy(th.a); e.b.copy(th.b); e.c.copy(th.c); }
    if (t.bend) for (const k of th.kinds) {
      const arr = t.bend[k]; if (!arr) continue;
      if (Array.isArray(arr)) { saved.push(...arr.map(x => [x, x.clone()])); arr[0].copy(th.a); arr[1].copy(th.c); arr[2].copy(th.b); }
      else { saved.push([arr, arr.clone()]); arr.copy(th.c); }
    }
  }
  return saved;
}
// Ejecuta fn con los colores (y la firma) del chroma del luchador f. Anidable y a prueba de errores.
export function themed(f, fn) {
  const th = f?.vtheme;
  if (!th || TH.cur === th) return fn();
  const prev = TH.cur, prevSaved = TH.saved;
  if (prev) restore(prevSaved);
  const saved = swapIn(th); TH.cur = th; TH.saved = saved;
  try { return fn(); }
  finally { restore(saved); TH.cur = prev; TH.saved = prevSaved; if (prev) TH.saved = swapIn(prev); }
}
function restore(saved) { if (saved) for (const [c, v] of saved) c.copy(v); }

// Color de un sprite (anillos, destellos): con tema, los de color vivo pasan al del chroma; el blanco se queda.
const _h = { h: 0, s: 0, l: 0 }, _c = new THREE.Color();
export function tintHex(hex) {
  const th = TH.cur; if (!th || hex == null) return hex;
  _c.set(hex); _c.getHSL(_h);
  if (th.char === 'zephyr' && _h.l > .75 && _h.l < .99) return th.a.clone().lerp(th.c, .35).getHex(); // el aire es «blanco»: con chroma toma su color
  if (_h.s < .3 || _h.l > .92) return hex;
  return (_h.l > .7 ? th.a : th.c).getHex();
}

// Firma del chroma: decoración extra que acompaña a cada ráfaga, a la estela de los proyectiles y al aura.
const R = Math.random, rr = (a, b) => a + R() * (b - a);
export function signature(vfx, P, n = 4, mode = 'burst', dir = 0) {
  const th = TH.cur; if (!th?.style || !vfx?.parts) return;
  const k = Math.max(1, Math.round(vfx.n ? vfx.n(n) : n)), A = th.a, Cc = th.c, B = th.b, e = o => vfx.parts.emit(o);
  switch (th.style) {
    case 'embers': for (let i = 0; i < k; i++) e({ x: P.x + rr(-.2, .2), y: P.y + rr(-.2, .2), z: P.z + rr(-.1, .1), vx: rr(-1, 1) - dir, vy: rr(2, 4.5), vz: 0, g: -1.5, drag: 1.5, life: rr(.4, .8), s0: rr(.06, .12), s1: 0, c0: A, c1: Cc }); break;
    case 'smoke': for (let i = 0; i < Math.ceil(k / 2); i++) e({ x: P.x + rr(-.2, .2), y: P.y + rr(-.1, .2), z: P.z - .1, vx: rr(-.5, .5) - dir * .6, vy: rr(.4, 1.2), vz: 0, drag: 1.2, life: rr(.7, 1.1), s0: rr(.35, .5), s1: rr(.9, 1.3), c0: Cc, c1: B, a0: .32 }); break;
    case 'helix': { const t = performance.now() / 1000; for (let s = -1; s <= 1; s += 2) e({ x: P.x, y: P.y + Math.sin(t * 22 + (P.x * 4)) * .32 * s, z: P.z + Math.cos(t * 22 + P.x * 4) * .2 * s, vx: -dir * .5, vy: 0, vz: 0, drag: 3, life: .45, s0: .13, s1: .02, c0: s > 0 ? A : Cc, c1: B }); break; }
    case 'bolt': { const segs = 6, len = rr(.6, 1.1), ang = rr(0, 6.28); let x = P.x, y = P.y; for (let i = 0; i < segs; i++) { x += Math.cos(ang) * len / segs + rr(-.12, .12); y += Math.sin(ang) * len / segs + rr(-.12, .12); e({ x, y, z: P.z + .05, vx: 0, vy: 0, vz: 0, drag: 0, life: rr(.08, .16), s0: .16, s1: .1, c0: A, c1: Cc }); } break; }
    case 'shards': for (let i = 0; i < k; i++) e({ x: P.x, y: P.y, z: P.z, vx: rr(-5, 5), vy: rr(-2, 5), vz: rr(-1, 1), g: 9, drag: 1, life: rr(.25, .45), s0: rr(.18, .3), s1: 0, c0: A, c1: Cc }); vfx.shapes?.sprite?.('flash', new THREE.Vector3(P.x, P.y, P.z + .1), { color: A.getHex(), size: .35, grow: 1.3, life: .12, rot: rr(0, 6) }); break;
    case 'stars': for (let i = 0; i < Math.ceil(k / 2); i++) vfx.shapes?.sprite?.('flash', new THREE.Vector3(P.x + rr(-.6, .6), P.y + rr(-.5, .6), P.z + .2), { color: (R() < .5 ? A : Cc).getHex(), size: rr(.18, .34), grow: 1.4, life: rr(.18, .35), rot: rr(0, 6) }); break;
    case 'bubbles': for (let i = 0; i < k; i++) e({ x: P.x + rr(-.3, .3), y: P.y + rr(-.2, .2), z: P.z + rr(-.1, .1), vx: rr(-.6, .6) - dir * .5, vy: rr(.8, 1.8), vz: 0, g: -.6, drag: 1.5, life: rr(.6, 1), s0: rr(.06, .1), s1: rr(.14, .22), c0: A, c1: Cc, a0: .8 }); break;
    case 'snow': for (let i = 0; i < k; i++) e({ x: P.x + rr(-.5, .5), y: P.y + rr(0, .5), z: P.z + rr(-.2, .2), vx: rr(-.4, .4) - dir * .4, vy: rr(-.2, .4), vz: 0, g: 1.2, drag: 2, life: rr(.8, 1.3), s0: rr(.06, .11), s1: .03, c0: A, c1: Cc }); break;
    case 'ink': for (let i = 0; i < k; i++) e({ x: P.x + rr(-.15, .15), y: P.y + rr(-.1, .1), z: P.z, vx: rr(-2, 2) - dir, vy: rr(0, 2.5), vz: 0, g: 9, drag: .8, life: rr(.4, .7), s0: rr(.14, .24), s1: .04, c0: Cc, c1: B, floor: true }); break;
    case 'sand': for (let i = 0; i < k * 2; i++) e({ x: P.x + rr(-.3, .3), y: P.y + rr(-.3, .3), z: P.z + rr(-.2, .2), vx: rr(1.5, 3.5) * (dir || (R() < .5 ? -1 : 1)) * -1, vy: rr(-.3, .6), vz: 0, g: .8, drag: 1.2, life: rr(.5, .9), s0: rr(.04, .07), s1: .02, c0: A, c1: Cc }); break;
    case 'petals': for (let i = 0; i < Math.ceil(k * .7); i++) e({ x: P.x + rr(-.3, .3), y: P.y + rr(-.2, .3), z: P.z + rr(-.2, .2), vx: rr(-1.2, 1.2) - dir * .6, vy: rr(.2, 1.2), vz: rr(-.3, .3), g: .9, drag: 1.4, life: rr(.9, 1.4), s0: rr(.12, .18), s1: .08, c0: A, c1: Cc }); break;
    case 'runes': if (mode !== 'trail' || R() < .25) vfx.shapes?.sprite?.('ring', new THREE.Vector3(P.x + rr(-.3, .3), P.y + rr(-.3, .3), P.z + .1), { color: Cc.getHex(), size: rr(.15, .3), grow: 2.2, life: .4, opacity: .9 }); break;
  }
}

// Instala los temas en cada combate: calcula el tema de cada luchador (chroma equipado o espejo) y envuelve los efectos.
export function installChromaVfx({ scene } = {}) {
  if (!scene || scene.__cvfx) return scene?.__cvfx; const api = { themeOf }; scene.__cvfx = api;
  const start = scene.startMatch.bind(scene);
  scene.startMatch = function (a, b, input, opts = {}) {
    const r = start(a, b, input, opts);
    try { hook(this.match); } catch (e) { console.warn('[chroma] técnicas sin tema', e); }
    return r;
  };
  function hook(m) {
    if (!m?.f || !m.v || m.__cvfx) return; m.__cvfx = true;
    m.f.forEach((f, i) => { f.vtheme = themeOf(m.v[i]?.c?.pal, f.def.id); });
    const V = m.vfx; if (!V) return;
    // sprites y ráfagas: color del tema + firma
    const sh = V.shapes; if (sh?.sprite && !sh.__cv) { const sp = sh.sprite.bind(sh); sh.sprite = (map, pos, o = {}) => sp(map, pos, o.color != null && TH.cur ? { ...o, color: tintHex(o.color) } : o); sh.__cv = true; }
    const burst = V.burst.bind(V); V.burst = (pos, E, o = {}) => { const r = burst(pos, E, o); if (TH.cur && !V.__sig) { V.__sig = true; try { signature(V, pos, Math.min(8, Math.round((o.n || 8) * .45)), 'burst', 0); } finally { V.__sig = false; } } return r; };
    // golpes, lanzamientos y eventos del luchador → con su tema
    for (const k of ['onHit', 'onThrow']) { const fn = m[k]; if (typeof fn === 'function') m[k] = function (ev, idx) { return themed(ev?.a || this.f[idx], () => fn.call(this, ev, idx)); }; }
    const fev = m.onFighterEv; if (typeof fev === 'function') m.onFighterEv = function (e, f, i) { return themed(f, () => fev.call(this, e, f, i)); };
  }
  return api;
}
