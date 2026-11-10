import * as THREE from 'three';
import { makeClip } from './pose.js';
import { handFrame, mount } from './weapons.js';
import { addOutlines } from '../render/outline.js';

// ARMAS DE LA TIENDA: modelos procedurales (originales), dónde se llevan guardadas y la animación de su técnica.
// El guerrero pelea sin arma; el arma equipada se ve envainada (cadera o espalda). Al pulsar el botón de arma:
//   sacar (la mano va a la funda y el arma aparece en ella) → usarla → guardarla / lanzarla / recogerla / desvanecerla.
// Todo depende del esqueleto Bip001 y de los ejes del personaje, no del guerrero: sirve para diseños nuevos.
const grad = (() => { const t = new THREE.DataTexture(new Uint8Array([90, 170, 255]), 3, 1, THREE.RedFormat); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t; })();
const toon = (color, o = {}) => new THREE.MeshToonMaterial({ color, gradientMap: grad, ...o });
const glow = color => new THREE.MeshBasicMaterial({ color, toneMapped: false });
function extrude(points, depth, bevel = .006) {
  const sh = new THREE.Shape(); points.forEach(([x, y], i) => i ? sh.lineTo(x, y) : sh.moveTo(x, y)); sh.closePath();
  const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1, curveSegments: 8 });
  g.translate(0, 0, -depth / 2); return g;
}
const anchor = (g, y, name) => { const o = new THREE.Object3D(); o.name = name; o.position.set(0, y, 0); g.add(o); return o; };
const STEEL = 0xd6dde6, DARK = 0x2b2a30, WOOD = 0x6b4426, LEATHER = 0x4a2a1a, BRASS = 0xc9a44c;

// Todas las piezas: empuñadura en el origen, hoja hacia +Y, cara plana mirando a ±Z (el plano X-Y es el de la pantalla).
const MODELS = {
  knives(c) { // tres cuchillos en abanico entre los dedos
    const g = new THREE.Group();
    for (const a of [-.32, 0, .32]) {
      const k = new THREE.Group(), b = new THREE.Mesh(extrude([[-.03, .06], [.035, .06], [.03, .3], [0, .38], [-.025, .3]], .012), toon(STEEL)); k.add(b);
      const e = new THREE.Mesh(extrude([[.022, .08], [.036, .08], [.031, .3], [.004, .37]], .016, 0), glow(c)); k.add(e);
      const h = new THREE.Mesh(new THREE.BoxGeometry(.035, .1, .02), toon(LEATHER)); h.position.y = 0; k.add(h);
      const r = new THREE.Mesh(new THREE.TorusGeometry(.025, .007, 4, 10), toon(BRASS)); r.position.y = -.07; k.add(r);
      k.rotation.z = a; g.add(k);
    }
    return { g, base: anchor(g, .05, 'base'), tip: anchor(g, .38, 'tip') };
  },
  bola(c) { // dos pesos de piedra unidos por una cuerda; se voltea por encima de la cabeza
    const g = new THREE.Group(), rope = toon(0x9c8a64);
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, .14, 6), toon(LEATHER)); g.add(grip);
    for (const [x, y] of [[.09, .55], [-.1, .5]]) {
      const len = Math.hypot(x, y - .05), r = new THREE.Mesh(new THREE.CylinderGeometry(.008, .008, len, 4), rope);
      r.position.set(x / 2, (y + .05) / 2, 0); r.rotation.z = -Math.atan2(x, y - .05); g.add(r);
      const w = new THREE.Mesh(new THREE.IcosahedronGeometry(.085, 0), toon(0x5d5a52)); w.position.set(x, y, 0); g.add(w);
      const band = new THREE.Mesh(new THREE.TorusGeometry(.07, .012, 4, 10), glow(c)); band.position.set(x, y, 0); g.add(band);
    }
    return { g, base: anchor(g, .1, 'base'), tip: anchor(g, .55, 'tip') };
  },
  boomerang(c) { // V de madera con filo metálico; se sujeta por un brazo
    const g = new THREE.Group(), p = [[-.05, -.04], [.05, -.04], [.08, .32], [.42, .5], [.4, .58], [.02, .44], [-.06, .4]];
    g.add(new THREE.Mesh(extrude(p, .035), toon(0x8a5a32)));
    g.add(new THREE.Mesh(extrude([[.4, .5], [.44, .53], [.41, .6], [.36, .56]], .045, 0), glow(c)));
    g.add(new THREE.Mesh(extrude([[-.06, .38], [.02, .43], [-.02, .47], [-.09, .42]], .045, 0), glow(c)));
    const wrap = new THREE.Mesh(new THREE.CylinderGeometry(.045, .045, .14, 6), toon(LEATHER)); wrap.position.y = .04; g.add(wrap);
    return { g, base: anchor(g, .05, 'base'), tip: anchor(g, .55, 'tip') };
  },
  dagger(c) { // daga de hoja curva con guarda en media luna
    const g = new THREE.Group(), L = .5;
    g.add(new THREE.Mesh(extrude([[-.04, .08], [.045, .08], [.06, .26], [.03, .42], [-.005, L], [-.02, .36], [-.04, .2]], .02), toon(STEEL)));
    g.add(new THREE.Mesh(extrude([[.035, .1], [.06, .1], [.07, .27], [.035, .43], [.0, .49], [.02, .4], [.045, .26]], .026, 0), glow(c)));
    g.add(new THREE.Mesh(extrude([[-.1, .03], [-.05, .08], [.05, .08], [.1, .03], [.08, .09], [0, .11], [-.08, .09]], .05, .006), toon(BRASS)));
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(.026, .03, .17, 8), toon(LEATHER)); grip.position.y = -.04; g.add(grip);
    const pom = new THREE.Mesh(new THREE.OctahedronGeometry(.035, 0), toon(BRASS)); pom.position.y = -.14; g.add(pom);
    return { g, base: anchor(g, .1, 'base'), tip: anchor(g, L, 'tip') };
  },
  fan(c) { // abanico de guerra de láminas de metal (abierto, en el plano de la pantalla)
    const g = new THREE.Group(), n = 9, R = .62, steel = toon(0xb9a36a), leaf = toon(0xe9d9a6, { side: THREE.DoubleSide });
    const sh = new THREE.Shape(); sh.moveTo(0, 0); for (let i = 0; i <= 24; i++) { const a = -.95 + 1.9 * i / 24; sh.lineTo(Math.sin(a) * R, Math.cos(a) * R); } sh.closePath();
    const disc = new THREE.Mesh(new THREE.ShapeGeometry(sh), leaf); disc.position.z = -.005; g.add(disc);
    for (let i = 0; i < n; i++) { const a = -.95 + 1.9 * i / (n - 1), r = new THREE.Mesh(new THREE.BoxGeometry(.025, R, .02), steel); r.position.set(Math.sin(a) * R / 2, Math.cos(a) * R / 2, 0); r.rotation.z = -a; g.add(r); }
    const rim = new THREE.Mesh(new THREE.TorusGeometry(R, .014, 4, 30, 1.9), glow(c)); rim.rotation.z = Math.PI / 2 - .95; g.add(rim);
    const pivot = new THREE.Mesh(new THREE.CylinderGeometry(.04, .04, .06, 10), toon(BRASS)); pivot.rotation.x = Math.PI / 2; g.add(pivot);
    return { g, base: anchor(g, .1, 'base'), tip: anchor(g, R, 'tip') };
  },
  hooks(c) { // espada de garfio: hoja recta con gancho en la punta y guarda en media luna
    const g = new THREE.Group(), L = 1.15;
    g.add(new THREE.Mesh(extrude([[-.035, .14], [.035, .14], [.03, L - .12], [-.01, L - .05], [-.03, L - .12]], .02), toon(STEEL)));
    const hook = new THREE.Mesh(new THREE.TorusGeometry(.12, .025, 6, 14, Math.PI * 1.1), toon(STEEL)); hook.position.set(-.12, L - .12, 0); hook.rotation.z = -.2; g.add(hook);
    g.add(new THREE.Mesh(extrude([[.02, .2], [.04, .2], [.034, L - .14], [.014, L - .14]], .026, 0), glow(c)));
    const moon = new THREE.Mesh(new THREE.TorusGeometry(.17, .022, 5, 14, Math.PI), toon(STEEL)); moon.position.y = .06; moon.rotation.z = Math.PI; g.add(moon);
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(.028, .028, .26, 8), toon(LEATHER)); grip.position.y = -.08; g.add(grip);
    const spike = new THREE.Mesh(new THREE.ConeGeometry(.03, .16, 6), toon(STEEL)); spike.position.y = -.28; spike.rotation.x = Math.PI; g.add(spike);
    return { g, base: anchor(g, .2, 'base'), tip: anchor(g, L, 'tip') };
  },
  mace(c) { // maza de piedra con mango de madera y runas del elemento
    const g = new THREE.Group(), L = 1.0;
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(.032, .038, L, 8), toon(WOOD)); shaft.position.y = L / 2 - .15; g.add(shaft);
    const head = new THREE.Mesh(new THREE.DodecahedronGeometry(.2, 0), toon(0x6c6a66)); head.position.y = L - .05; head.scale.set(1, 1.15, 1); g.add(head);
    for (const a of [0, 2.1, 4.2]) { const s = new THREE.Mesh(new THREE.ConeGeometry(.05, .14, 5), toon(DARK)); s.position.set(Math.cos(a) * .19, L - .05, Math.sin(a) * .19); s.rotation.z = -Math.cos(a) * 1.4; s.rotation.x = Math.sin(a) * 1.4; g.add(s); }
    const rune = new THREE.Mesh(new THREE.TorusGeometry(.21, .016, 4, 16), glow(c)); rune.position.y = L - .05; rune.rotation.x = Math.PI / 2; g.add(rune);
    const wrap = new THREE.Mesh(new THREE.CylinderGeometry(.042, .042, .22, 8), toon(LEATHER)); g.add(wrap);
    return { g, base: anchor(g, .3, 'base'), tip: anchor(g, L + .1, 'tip') };
  },
  bow(c) { // arco recurvo: las palas en el plano de la pantalla, la cuerda por detrás
    const g = new THREE.Group(), L = .78, pts = [];
    for (let i = 0; i <= 16; i++) { const u = i / 16 * 2 - 1; pts.push(new THREE.Vector3(.16 * (1 - u * u) - .02 * u * u * u * u, u * L, 0)); }
    const limb = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, .026, 6), toon(WOOD)); g.add(limb);
    const str = new THREE.Mesh(new THREE.CylinderGeometry(.005, .005, L * 2 - .02, 4), glow(c)); str.position.x = -.02; g.add(str);
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(.035, .035, .16, 8), toon(LEATHER)); grip.position.x = .16; g.add(grip);
    for (const s of [-1, 1]) { const tip = new THREE.Mesh(new THREE.OctahedronGeometry(.035, 0), glow(c)); tip.position.set(-.02, s * L, 0); g.add(tip); }
    g.position.x = -.16; const wrapG = new THREE.Group(); wrapG.add(g); // la empuñadura en el puño
    return { g: wrapG, base: anchor(wrapG, -.3, 'base'), tip: anchor(wrapG, .3, 'tip') };
  },
};
export const WEAPON_KINDS = Object.keys(MODELS);
// (v1.8) AURA ELEMENTAL del arma en la mano: lenguas de energía que envuelven el filo (dos planos cruzados con un
// sombreador de llama animado, aditivo) del color del elemento / chroma de quien la empuña. Zona que cubre en cada arma:
const AURA = { dagger: [.26, .06, .56], hooks: [.32, .12, 1.22], knives: [.42, .02, .44], mace: [.62, .62, 1.3], boomerang: [.56, -.02, .64, .2],
  fan: [1.15, .08, .76], bola: [.5, .3, .66], bow: [.3, -.8, .8, -.16] };
const AURA_VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }';
const AURA_FS = `uniform float uT; uniform vec3 uC; uniform float uA; uniform float uSeed; varying vec2 vUv;
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
float fb(vec2 p){ float s = 0., a = .5; for (int i = 0; i < 4; i++) { s += a * n2(p); p = p * 2.03 + 5.1; a *= .5; } return s; }
void main(){
  vec2 p = vec2(vUv.x * 3.2 + uSeed, vUv.y * 2.4 - uT * 2.6);
  float n = fb(p), core = 1. - abs(vUv.x - .5) * 2.;
  float body = smoothstep(0., .14, vUv.y) * (1. - smoothstep(.82, 1., vUv.y));
  float f = core * 1.25 + (n - .5) * 1.35 - (1. - body) * .9;
  float fl = smoothstep(.28, .82, f);
  float hot = smoothstep(.7, 1.05, f);
  vec3 col = mix(uC * .62, mix(uC * 1.15, vec3(1.), .6), hot); // borde saturado y oscuro, núcleo casi blanco
  gl_FragColor = vec4(col, fl * uA * (.78 + .22 * hot));
}`;
function addAura(m, kind, color) {
  const a = AURA[kind]; if (!a) return;
  const [w, y0, y1, x = 0] = a, H = y1 - y0, U = { uT: { value: 0 }, uC: { value: new THREE.Color(color) }, uA: { value: 1 }, uSeed: { value: Math.random() * 20 } };
  const mat = new THREE.ShaderMaterial({ uniforms: U, vertexShader: AURA_VS, fragmentShader: AURA_FS, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.NormalBlending, fog: false, toneMapped: false }); // mezcla normal: se ve también sobre fondos claros
  const geo = new THREE.PlaneGeometry(w * 1.3, H * 1.2);
  for (const ry of [0, Math.PI / 2]) {
    const q = new THREE.Mesh(geo, mat); q.position.set(x, (y0 + y1) / 2 + H * .05, 0); q.rotation.y = ry; q.renderOrder = 10; q.userData.noOutline = true; q.frustumCulled = false;
    q.onBeforeRender = () => { U.uT.value = performance.now() / 1000; }; m.g.add(q);
  }
  m.aura = { mat, U };
}
export const makeWeaponModel = (kind, color = 0xffffff, { aura = false, auraColor = null } = {}) => { const m = (MODELS[kind] || MODELS.dagger)(color); if (aura) addAura(m, kind, auraColor ?? color); try { addOutlines(m.g); } catch { /* sin contorno */ } return m; };
export const auraKinds = () => Object.keys(AURA);
// Cómo se agarra cada una
const GRIP = { knives: { along: .6 }, bola: { along: .5 }, boomerang: { along: .5 }, dagger: { along: .55 }, fan: { along: .5 }, hooks: { along: .55 }, mace: { along: .55 }, bow: { along: .5 } };

// ── animaciones de la técnica (tiempos de DISEÑO; meta.hit cae en la ventana activa real) ──
//   meta.show = [t0, t1] el arma está en la mano · meta.release = instante en que sale lanzada (throw/return)
//   meta.fx: w_draw (aparece en la mano), w_release (sale del arma el poder del elemento), w_stow / w_vanish
const HIP = { hnFx: .3, hnFy: -.68, hnFz: -.08, hnFpitch: -1.57, hnFfist: .8, spYaw: 0 };
const BACK = { hnFx: -.05, hnFy: .88, hnFz: -.38, hnFpitch: 2.6, hnFfist: .8, shFup: .4, hdPitch: -.05 };
export function buildArt(kind, S) {
  const sy = S.stance.spYaw, hy = S.stance.hipYaw, mk = makeClip;
  const hip = (t, o = {}) => ({ t, e: 'io', ...HIP, spYaw: sy + .25, ...o }), back = (t, o = {}) => ({ t, e: 'io', ...BACK, spYaw: sy + .15, ...o });
  const C = {
    knives: () => mk('wp', .7, [
      hip(.1), { t: .2, e: 'out2', hnFx: -.25, hnFy: .3, hnFz: .05, hnFpitch: 2.6, hnFfist: .6, spYaw: sy + .5, pelYaw: hy + .2, comZ: -.1, ftBz: -.42, hdPitch: -.08 },
      { t: .26, e: 'in3', hnFx: .05, hnFy: .22, hnFz: 1.02, hnFpitch: .05, hnFfist: .1, hnFflare: .6, spYaw: sy - .55, pelYaw: hy - .25, comZ: .26, spPitch: .2, ftFz: .55, ftBz: -.45 },
      { t: .4, e: 'out2', hnFy: -.02, hnFz: .86, hnFpitch: 0, hnFfist: .35, spYaw: sy - .45 }, { t: .58, e: 'io', comZ: .1 }, // (v1.12.1) tras soltar: mano relajada, muñeca recta
    ], { hit: [.255, .28], show: [.11, .255], release: .255, trails: [['hF', .2, .32]], fx: [{ t: .11, kind: 'w_draw', at: 'wF' }, { t: .26, kind: 'w_release', at: 'hF' }] }),
    bola: () => mk('wp', .85, [
      hip(.1), { t: .22, e: 'out2', hnFx: .05, hnFy: 1.02, hnFz: .1, hnFpitch: 1.57, hnFfist: .8, wpSpin: 0, shFup: .55, hdPitch: -.22, spPitch: -.12, spYaw: sy },
      { t: .34, e: 'lin', wpSpin: 6.28, hnFx: .1, hnFy: 1.0, hnFz: -.05 }, { t: .45, e: 'lin', wpSpin: 12.56, hnFx: 0, hnFy: 1.0, hnFz: .12 },
      { t: .5, e: 'in3', hnFx: .0, hnFy: .55, hnFz: .98, hnFpitch: .6, hnFfist: .1, hnFflare: .5, wpSpin: 15.7, spYaw: sy - .5, comZ: .22, spPitch: .18, ftFz: .52, ftBz: -.42, shFup: .1 },
      { t: .64, e: 'out2', hnFy: .3, hnFz: .82, hnFpitch: 0, hnFfist: .35, spYaw: sy - .4 }, { t: .78, e: 'io', comZ: .05 },
    ], { hit: [.49, .52], show: [.11, .49], release: .49, trails: [['wF', .22, .5]], fx: [{ t: .11, kind: 'w_draw', at: 'wF' }, { t: .5, kind: 'w_release', at: 'hF' }] }),
    boomerang: () => mk('wp', .8, [
      back(.12), { t: .22, e: 'out2', hnFx: .22, hnFy: .4, hnFz: -.32, hnFpitch: 3.0, hnFfist: .8, spYaw: sy + .55, pelYaw: hy + .25, comZ: -.12, ftBz: -.42, shFup: .1 },
      { t: .3, e: 'in3', hnFx: .0, hnFy: .2, hnFz: 1.04, hnFpitch: 0, hnFfist: .1, hnFflare: .5, wpSpin: 2.5, spYaw: sy - .6, pelYaw: hy - .3, comZ: .3, ftFz: .58, ftBz: -.48, spPitch: .16 },
      { t: .45, e: 'out2', hnFy: 0, hnFz: .82, hnFpitch: 0, hnFfist: .3, spYaw: sy - .45 },
      { t: .66, e: 'io', hnFx: .1, hnFy: .3, hnFz: .55, hnFflare: .6, hnFfist: 0, hnFpitch: .5, comZ: .05 }, // mano abierta, palma al frente: esperará la vuelta
    ], { hit: [.295, .32], show: [.13, .3], release: .3, trails: [['wF', .22, .3]], fx: [{ t: .13, kind: 'w_draw', at: 'wF' }, { t: .3, kind: 'w_release', at: 'hF' }] }),
    dagger: () => mk('wp', .95, [
      hip(.1), { t: .2, e: 'out2', hnFx: .05, hnFy: .38, hnFz: .55, hnFpitch: 1.2, hnFfist: .9, hnBx: .15, hnBy: .12, hnBz: .38, hnBflare: .45, comY: -.14, spYaw: sy + .1, hdPitch: -.06 },
      { t: .45, e: 'io', hnFy: .4, hnFz: .5, hnFpitch: 1.25, comY: -.16, spYaw: sy + .15 }, // guardia: espera el ataque
      { t: .5, e: 'in3', hnFx: -.1, hnFy: .04, hnFz: 1.04, hnFpitch: -.5, spYaw: sy + .45, pelYaw: hy + .2, comZ: .36, comY: -.22, ftFz: .62, ftBz: -.45, spPitch: .25 },
      { t: .58, e: 'out2', hnFy: -.16, hnFz: .9, hnFpitch: -.95 },
      hip(.78, { comZ: .05 }),
    ], { hit: [.5, .55], show: [.1, .79], trails: [['wF', .45, .6]], fx: [{ t: .1, kind: 'w_draw', at: 'wF' }, { t: .5, kind: 'w_release', at: 'wF' }, { t: .79, kind: 'w_stow', at: 'hF' }] }),
    fan: () => mk('wp', .82, [
      hip(.1), { t: .2, e: 'out2', hnFx: .2, hnFy: .48, hnFz: -.25, hnFpitch: 2.6, hnFfist: .8, spYaw: sy + .55, pelYaw: hy + .2, comZ: -.12, ftBz: -.4, shFup: .2 },
      { t: .3, e: 'in3', hnFx: -.05, hnFy: .22, hnFz: 1.0, hnFpitch: .05, spYaw: sy - .55, pelYaw: hy - .25, comZ: .24, spPitch: .14, ftFz: .5, ftBz: -.42, shFup: 0 },
      { t: .46, e: 'out2', hnFy: -.25, hnFz: .86, hnFpitch: -.8, spYaw: sy - .4 },
      hip(.64, { comZ: .04 }),
    ], { hit: [.26, .46], show: [.1, .65], trails: [['wF', .2, .48]], fx: [{ t: .1, kind: 'w_draw', at: 'wF' }, { t: .3, kind: 'w_gust', at: 'wF' }, { t: .65, kind: 'w_stow', at: 'hF' }] }),
    hooks: () => mk('wp', .95, [
      back(.12, { hnBx: -.05, hnBy: .88, hnBz: -.42, hnBpitch: 2.6, hnBfist: .8, shBup: .4 }),
      { t: .24, e: 'in3', hnFx: 0, hnFy: .52, hnFz: 1.06, hnFpitch: .65, hnBx: .05, hnBy: .32, hnBz: .96, hnBpitch: .45, comZ: .32, ftFz: .58, ftBz: -.45, spPitch: .2, shFup: 0, shBup: 0, spYaw: sy - .1 },
      { t: .34, e: 'out2', hnFx: .1, hnFy: .06, hnFz: .28, hnFpitch: -.35, hnBx: .15, hnBy: -.05, hnBz: .12, hnBpitch: -.5, comZ: -.18, spPitch: -.1, ftBz: -.48, spYaw: sy + .2 },
      { t: .55, e: 'io', hnFy: .35, hnFz: .55, hnFpitch: 1.0, hnBy: .25, hnBz: .45, hnBpitch: .9, comZ: 0 },
      back(.8, { hnBx: -.05, hnBy: .88, hnBz: -.42, hnBpitch: 2.6, hnBfist: .8, shBup: .4 }),
    ], { hit: [.24, .34], show: [.13, .81], trails: [['wF', .14, .36], ['wB', .14, .36]], fx: [{ t: .13, kind: 'w_draw', at: 'wF' }, { t: .26, kind: 'w_release', at: 'wF' }, { t: .81, kind: 'w_stow', at: 'hF' }] }),
    mace: () => mk('wp', 1.0, [
      back(.12), { t: .3, e: 'out2', hnFx: 0, hnFy: 1.0, hnFz: -.15, hnFpitch: 2.8, hnBx: -.05, hnBy: .95, hnBz: -.1, hnBfist: .8, spPitch: -.32, comY: .02, shFup: .55, shBup: .5, hdPitch: -.25, ftBz: -.4 },
      { t: .4, e: 'in3', hnFx: -.05, hnFy: -.36, hnFz: .96, hnFpitch: -.9, hnBx: -.08, hnBy: -.3, hnBz: .88, spPitch: .66, comY: -.46, comZ: .46, ftFz: .72, ftBz: -.48, ftBpitch: -.7, hdPitch: .22, shFup: 0, shBup: 0 },
      { t: .56, e: 'out2', hnFy: -.42, hnFz: .86, spPitch: .64, comY: -.44 },
      { t: .76, e: 'io', hnFx: .05, hnFy: .62, hnFz: -.05, hnFpitch: 2.4, hnBx: .2, hnBy: -.2, hnBz: .3, spPitch: 0, comY: -.05, comZ: .05 }, // al hombro
      back(.92),
    ], { hit: [.38, .42], show: [.13, .93], trails: [['wF', .3, .44]], fx: [{ t: .13, kind: 'w_draw', at: 'wF' }, { t: .41, kind: 'w_smash', at: 'wF' }, { t: .93, kind: 'w_stow', at: 'hF' }] }),
    bow: () => mk('wp', .85, [
      back(.12), { t: .25, e: 'out2', hnFx: -.02, hnFy: .26, hnFz: 1.0, hnFpitch: 1.57, hnFfist: .8, hnBx: .0, hnBy: .26, hnBz: .9, hnBfist: .6, spYaw: sy - .7, pelYaw: hy - .3, ftFz: .4, ftBz: -.35, shFup: 0 },
      { t: .42, e: 'io', hnBx: .05, hnBy: .3, hnBz: .02, hnBfist: .7, shBfwd: -.3, hdPitch: -.06, spYaw: sy - .75 },
      { t: .45, e: 'in3', hnBz: -.14, hnBy: .36, hnBfist: 0, hnBflare: .7, comZ: -.06 },
      { t: .6, e: 'io', hnFz: .9, hnFy: .2, spYaw: sy - .55 }, { t: .78, e: 'io', comZ: 0 },
    ], { hit: [.44, .47], show: [.13, .62], trails: [['hB', .42, .5]], fx: [{ t: .13, kind: 'w_draw', at: 'wF' }, { t: .45, kind: 'w_release', at: 'wF' }, { t: .62, kind: 'w_vanish', at: 'wF' }] }),
  };
  return (C[kind] || C.dagger)();
}

// ── el arma equipada: modelo en la mano (los dos lados, porque el lado adelantado cambia al girarse) y envainado ──
export class ArtSet {
  constructor(rig, holder, w, color, auraColor = null) {
    this.w = w; this.kind = w.kind; this.after = w.after || 'stow'; this.hands = w.hands || 'F'; this.items = { L: null, R: null, BL: null, BR: null }; this.aim = {};
    holder.updateMatrixWorld(true);
    const spec = { grip: GRIP[this.kind] || { along: .55 } };
    for (const side of ['L', 'R']) {
      const fr = handFrame(rig, side, spec); this.aim[side] = fr.Yw.clone();
      const m = makeWeaponModel(this.kind, color, { aura: true, auraColor }); mount(rig, holder, fr.hi, m.g, fr.M); m.g.visible = false; this.items[side] = m; // en la mano: con aura
    }
    // envainada: cadera izquierda o espalda (en diagonal), según el arma
    const I = rig.I, P = rig.P0, Hh = Math.max(1, (P[I.head]?.y ?? 3) - Math.min(P[I.foL]?.y ?? 0, P[I.foR]?.y ?? 0));
    this.sheath = [];
    const put = (boneName, pos, Y, Z) => { const Yn = Y.normalize(), Zn = Z.normalize(), X = new THREE.Vector3().crossVectors(Yn, Zn).normalize(), Zf = new THREE.Vector3().crossVectors(X, Yn); const M = new THREE.Matrix4().makeBasis(X, Yn, Zf).setPosition(pos); const m = makeWeaponModel(this.kind, color); mount(rig, holder, I[boneName], m.g, M); this.sheath.push(m); };
    if ((w.sheath || 'hip') === 'back') {
      const c = P[I.sp2].clone().add(new THREE.Vector3(0, -.02 * Hh, -.075 * Hh));
      if (this.hands.includes('B')) { put('sp2', c.clone().add(new THREE.Vector3(.03 * Hh, 0, 0)), new THREE.Vector3(.55, 1, 0), new THREE.Vector3(0, 0, 1)); put('sp2', c.clone().add(new THREE.Vector3(-.03 * Hh, 0, 0)), new THREE.Vector3(-.55, 1, 0), new THREE.Vector3(0, 0, 1)); }
      else put('sp2', c, new THREE.Vector3(.6, 1, 0), new THREE.Vector3(0, 0, 1));
    } else {
      // a la espalda de la cintura, inclinada hacia abajo y atrás: se ve de perfil mire hacia donde mire
      put('pel', P[I.pel].clone().add(new THREE.Vector3(0, .01 * Hh, -.075 * Hh)), new THREE.Vector3(0, -.55, -1), new THREE.Vector3(1, 0, 0));
    }
    for (const s of this.sheath) s.g.scale.multiplyScalar(this.kind === 'fan' || this.kind === 'bow' ? .7 : .9);
    this.shown = null; this.k = 0; this.lastCT = -1;
  }
  // ct: tiempo del clip de la técnica (o -1 si no se está usando). ready: el arma está disponible (no lanzada / recargando).
  sync(ct, clip, lead, ready, spin = 0) {
    const F = lead > 0 ? 'L' : 'R', B = F === 'L' ? 'R' : 'L', S = clip?.show;
    const inHand = ct >= 0 && S && ct >= S[0] && ct < S[1];
    let k = 1; if (inHand) { const a = (ct - S[0]) / .05, b = (S[1] - ct) / .07; k = Math.min(1, a, this.after === 'vanish' ? b : 1); }
    for (const side of ['L', 'R']) {
      const it = this.items[side], on = inHand && (side === F || (side === B && this.hands.includes('B')));
      it.g.visible = on;
      if (on) { const s = it.g.userData.restS; it.g.scale.copy(s).multiplyScalar(Math.max(.05, k)); it.g.quaternion.copy(it.g.userData.restQ); if (spin) it.g.rotateX(spin); }
    }
    const sheathOn = !inHand && ready && !(ct >= 0 && S && ct >= S[1] && (this.after === 'throw' || this.after === 'vanish' || this.after === 'return'));
    for (const s of this.sheath) s.g.visible = sheathOn;
    this.inHand = inHand; this.F = this.items[F]; this.B = this.hands.includes('B') ? this.items[B] : null;
    return inHand;
  }
  dispose() { for (const m of [...Object.values(this.items), ...this.sheath]) { if (!m) continue; m.g.removeFromParent(); m.g.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } }); } }
}
