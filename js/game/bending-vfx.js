import * as THREE from 'three';
import { warpTime } from './animation/attacks.js';

// Efectos del CONTROL ELEMENTAL (sólo presentación: nunca tocan la simulación). Se monta encima del Vfx del combate
// (reutiliza sus partículas, formas y destellos) y añade:
//   · Proyectiles con sombreadores propios: bola de fuego, cometa, géiser, agujas de hielo, roca, muro, ráfaga, tornado, bala de aire, metralla de roca.
//   · Cintas (ribbons) de fuego y agua que siguen el pie o la mano (arco de llamas, corriente de agua) y el látigo de agua procedural.
//   · Efectos sostenidos mientras dura la carga de la técnica (meta.sfx de bending-clips.js) y efectos puntuales (meta.fx, «b_*»).
// Todo se limita con la calidad gráfica (vfx.n) y «reducir movimiento».
const C = {
  fire: [new THREE.Color(0xfff3c0), new THREE.Color(0xffa23a), new THREE.Color(0xd8320c)],
  water: [new THREE.Color(0xf0fdff), new THREE.Color(0x6fd6ff), new THREE.Color(0x1c64d0)],
  ice: [new THREE.Color(0xffffff), new THREE.Color(0xbdf2ff), new THREE.Color(0x5fb8ff)],
  air: [new THREE.Color(0xffffff), new THREE.Color(0xdcecff), new THREE.Color(0x9cc8ff)],
  earth: [new THREE.Color(0xc8b48a), new THREE.Color(0x8a7c62), new THREE.Color(0x4a4236)],
  rune: new THREE.Color(0x9cff5a),
};
const E3 = k => ({ a: C[k][0], b: C[k][2], c: C[k][1] });
const rnd = (a, b) => a + Math.random() * (b - a);
const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _u = new THREE.Vector3();
const _q = new THREE.Quaternion();

// ───────── sombreador común (fuego / agua / aire) con ruido animado ─────────
const NOISE = `
float h1(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f); return mix(mix(h1(i), h1(i+vec2(1,0)), f.x), mix(h1(i+vec2(0,1)), h1(i+vec2(1,1)), f.x), f.y); }
float fbm(vec2 p){ float s = 0., a = .5; for (int i = 0; i < 4; i++){ s += a * vn(p); p = p * 2.03 + 7.1; a *= .5; } return s; }`;
const VERT = `varying vec2 vUv; varying float vA; varying vec3 vN; varying vec3 vV; attribute float alpha;
void main(){ vUv = uv; vA = alpha; vec4 mv = modelViewMatrix * vec4(position, 1.); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`;
const FRAG = `uniform float uT; uniform float uA; uniform int uMode; uniform int uShell; uniform vec3 c1; uniform vec3 c2; uniform vec3 c3; uniform vec2 uScale; uniform vec2 uFlow; uniform float uSeed;
varying vec2 vUv; varying float vA; varying vec3 vN; varying vec3 vV; ${NOISE}
void main(){
  vec2 p = vUv * uScale + uFlow * uT + uSeed;
  float n = fbm(p), n2 = fbm(p * 1.9 - uFlow * uT * .7 + 3.3);
  float edge = uShell == 1 ? pow(1. - abs(dot(vN, vV)), 1.6) : 1. - abs(vUv.y - .5) * 2.;   // borde de esfera / centro de cinta
  float a; vec3 col;
  if (uMode == 0) {        // fuego: núcleo blanco-amarillo, lenguas naranjas que se deshacen en rojo
    float heat = clamp((uShell == 1 ? 1. - edge * 1.05 : edge) * (.35 + n * 1.1) - n2 * .35, 0., 1.);
    col = mix(c3, mix(c2, c1, smoothstep(.62, .98, heat)), smoothstep(.1, .55, heat)) * (.65 + heat * .75);
    a = smoothstep(.06, .5, heat) * (uShell == 1 ? .85 : 1.);
  } else if (uMode == 1) { // agua: cuerpo azul, brillos blancos que corren, borde más claro
    float spec = smoothstep(.62, .8, n) * .9 + smoothstep(.7, .95, n2) * .6;
    float body = uShell == 1 ? .35 + edge * .65 : smoothstep(0., .5, edge);
    col = mix(c3, c2, body) + c1 * spec;
    a = clamp(body * .8 + spec * .5, 0., 1.) * smoothstep(.0, .2, edge + .05);
  } else {                 // aire: casi transparente, vetas blancas que giran
    float streak = smoothstep(.55, .85, vn(vec2(p.x * 1.0, p.y * 6.)) * .6 + n * .5);
    float rim = uShell == 1 ? edge : smoothstep(0., .6, edge);
    col = mix(c3, c1, streak);
    a = clamp(rim * .45 + streak * .55, 0., 1.) * (uShell == 1 ? .9 : smoothstep(0., .3, edge));
  }
  gl_FragColor = vec4(col, a * uA * vA);
}`;
const MODE = { fire: 0, water: 1, ice: 1, air: 2 };
function elemMat(kind, { shell = false, scale = [3, 1.5], flow = [-2.5, 0], alpha = 1 } = {}) {
  const c = C[kind];
  return new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 }, uA: { value: alpha }, uMode: { value: MODE[kind] }, uShell: { value: shell ? 1 : 0 }, c1: { value: c[0] }, c2: { value: c[1] }, c3: { value: c[2] },
      uScale: { value: new THREE.Vector2(...scale) }, uFlow: { value: new THREE.Vector2(...flow) }, uSeed: { value: Math.random() * 50 } },
    vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    blending: kind === 'fire' || kind === 'air' ? THREE.AdditiveBlending : THREE.NormalBlending, fog: false,
  });
}
// geometrías con atributo alpha = 1 (el sombreador lo usa en las cintas)
const withAlpha = g => { g.setAttribute('alpha', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count).fill(1), 1)); return g; };

// ───────── cinta: tira de puntos en el plano de combate con anchura perpendicular a la trayectoria ─────────
const RN = 40;
class Ribbon {
  constructor(scene, mat, { width = .3, n = RN, z = .45 } = {}) {
    this.n = n; this.width = width; this.z = z; this.mat = mat;
    const g = new THREE.BufferGeometry(); this.pos = new Float32Array(n * 2 * 3); this.al = new Float32Array(n * 2); const uv = new Float32Array(n * 2 * 2), nor = new Float32Array(n * 2 * 3);
    for (let i = 0; i < n; i++) { uv.set([i / (n - 1), 0, i / (n - 1), 1], i * 4); nor.set([0, 0, 1, 0, 0, 1], i * 6); }
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); g.setAttribute('alpha', new THREE.BufferAttribute(this.al, 1));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    const idx = []; for (let i = 0; i < n - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } g.setIndex(idx);
    this.mesh = new THREE.Mesh(g, mat); this.mesh.frustumCulled = false; this.mesh.renderOrder = 9; scene.add(this.mesh);
  }
  // pts: [{x, y, w (0..1 anchura relativa), a (alfa)}]  (se remuestrea a n puntos)
  set(pts) {
    const n = this.n, m = pts.length; this.mesh.visible = m >= 2; if (m < 2) return;
    for (let i = 0; i < n; i++) {
      const f = i / (n - 1) * (m - 1), k = Math.min(m - 2, Math.floor(f)), t = f - k, A = pts[k], B = pts[k + 1];
      const x = A.x + (B.x - A.x) * t, y = A.y + (B.y - A.y) * t, w = ((A.w ?? 1) + ((B.w ?? 1) - (A.w ?? 1)) * t) * this.width, a = (A.a ?? 1) + ((B.a ?? 1) - (A.a ?? 1)) * t;
      let dx = B.x - A.x, dy = B.y - A.y; const L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L;
      this.pos.set([x - dy * w, y + dx * w, this.z, x + dy * w, y - dx * w, this.z], i * 6); this.al[i * 2] = this.al[i * 2 + 1] = a;
    }
    const g = this.mesh.geometry.attributes; g.position.needsUpdate = g.alpha.needsUpdate = true;
  }
  dispose() { this.mesh.geometry.dispose(); this.mat.dispose(); this.mesh.removeFromParent(); }
}

// roca facetada (misma geometría para la que emerge del suelo y para el proyectil → la transición es invisible)
function rockGeo(r, detail = 1, seed = 1) {
  const g = new THREE.DodecahedronGeometry(r, detail), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { _v.fromBufferAttribute(p, i); const k = 1 + .22 * Math.sin(_v.x * 9.1 * seed + _v.y * 5.3) * Math.cos(_v.z * 7.7 + seed); _v.multiplyScalar(k); p.setXYZ(i, _v.x, _v.y * .9, _v.z); }
  return rockColors(g.index ? g.toNonIndexed() : g);
}
// color por vértice: vetas, manchas de musgo y caras más oscuras abajo (la roca se lee aunque la luz sea plana)
function rockColors(g, strata = 0) {
  const p = g.attributes.position, col = new Float32Array(p.count * 3), base = new THREE.Color(0x8d7d60), dark = new THREE.Color(0x4f4434), moss = new THREE.Color(0x6f8a3a), c = new THREE.Color();
  for (let i = 0; i < p.count; i += 3) { // por cara (geometría no indexada → facetas planas)
    _v.fromBufferAttribute(p, i); const n = Math.sin(_v.x * 13.1 + _v.y * 7.7) * .5 + Math.sin(_v.z * 11.3 - _v.y * 5.1) * .5;
    c.copy(base).lerp(dark, .25 + n * .25 + (strata ? (Math.sin(_v.y * strata) > .6 ? .3 : 0) : 0) + Math.max(0, -_v.y) * .15);
    if (n > .62 && _v.y > 0) c.lerp(moss, .45);
    for (let k = 0; k < 3; k++) col.set([c.r, c.g, c.b], (i + k) * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.computeVertexNormals(); return g;
}
const GRAD = (() => { const t = new THREE.DataTexture(new Uint8Array([70, 150, 230]), 3, 1, THREE.RedFormat); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t; })();

export const BEND_KINDS = ['fireball', 'comet', 'geyser', 'ice', 'boulder', 'wall', 'gust', 'tornado', 'airball', 'rockshot', 'fangs', 'slabwave'];
// colmillo de piedra (base en y = 0, punta afilada e irregular) y losa tectónica (bloque partido con estratos)
function spikeGeo() {
  const g = new THREE.ConeGeometry(.26, 1, 6, 4), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { _v.fromBufferAttribute(p, i); const k = 1 + .28 * Math.sin(_v.y * 11 + _v.x * 17) * Math.cos(_v.z * 13); p.setXYZ(i, _v.x * k, _v.y + .5, _v.z * k * .8); }
  return rockColors(g.index ? g.toNonIndexed() : g, 9);
}
function slabGeo() {
  const g = new THREE.BoxGeometry(.5, 2, 1.5, 2, 6, 3), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { _v.fromBufferAttribute(p, i); const j = Math.sin(_v.y * 5.1 + _v.z * 4) * .06 + Math.cos(_v.z * 9 + _v.y * 2.3) * .05;
    p.setXYZ(i, _v.x * (1 + j * 2), _v.y + 1 + (_v.y > .9 ? Math.sin(_v.z * 7 + 1) * .22 : 0), _v.z * (1 + j)); }
  return rockColors(g.index ? g.toNonIndexed() : g, 7.5);
}

export class BendingVfx {
  constructor(vfx, scene, match) {
    this.v = vfx; this.scene = scene; this.m = match; this.t = 0; this.proj = new Map(); this.live = new Map(); this.dying = [];
    this.rock = { geo: rockGeo(.55, 1, 1.3), geoS: rockGeo(.36, 0, 2.1), wall: this.#wallGeo(), mat: new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: .95, metalness: 0, emissive: 0x0c0d08 }) };
    this.iceGeo = new THREE.ConeGeometry(.09, .62, 5); this.iceGeo.rotateZ(-Math.PI / 2);
    this.spikeGeo = spikeGeo(); this.slabGeo = slabGeo(); this.stones = []; // colmillos y losas sueltas que brotan, aguantan y se hunden
    this.crackMat = new THREE.MeshBasicMaterial({ color: 0xc8f06a, transparent: true, opacity: .9, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    this.crackGeo = new THREE.PlaneGeometry(1, .16); this.crackGeo.rotateX(-Math.PI / 2);
    this.iceMat = new THREE.MeshToonMaterial({ color: 0xcff6ff, gradientMap: GRAD, emissive: 0x2a6a9a, transparent: true, opacity: .92 });
  }
  #wallGeo() { // losa de roca irregular, con la base en y = 0
    const g = new THREE.BoxGeometry(.85, 2.9, 1.3, 3, 8, 3), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { _v.fromBufferAttribute(p, i); const j = Math.sin(_v.y * 4.1 + _v.z * 3) * .07 + Math.cos(_v.x * 9 + _v.y * 2.3) * .05; p.setXYZ(i, _v.x * (1 + j), _v.y + 1.45 + (_v.y > 1.3 ? Math.sin(_v.z * 6 + _v.x * 8) * .18 : 0), _v.z * (1 + j)); }
    return rockColors(g.index ? g.toNonIndexed() : g, 6.5);
  }
  emitFire(x, y, k = 1, dir = 0, z = .45) {
    const c = C.fire; for (let i = 0; i < this.v.n(3 * k); i++)
      this.v.parts.emit({ x: x + rnd(-.08, .08), y: y + rnd(-.08, .08), z: z + rnd(-.05, .05), vx: -dir * rnd(1, 3) + rnd(-.6, .6), vy: rnd(.8, 2.6), vz: rnd(-.3, .3), g: -2.5, drag: 2.5, life: rnd(.22, .42), s0: rnd(.22, .36) * k, s1: .02, c0: i % 3 ? c[1] : c[0], c1: c[2] });
  }
  emitDrops(x, y, k = 1, vx = 0, vy = 2, z = .45) {
    const c = C.water; for (let i = 0; i < this.v.n(3 * k); i++)
      this.v.parts.emit({ x: x + rnd(-.1, .1), y: y + rnd(-.1, .1), z: z + rnd(-.08, .08), vx: vx + rnd(-1.4, 1.4), vy: vy + rnd(-1, 1.5), vz: rnd(-.4, .4), g: 13, drag: .6, life: rnd(.3, .55), s0: rnd(.08, .16), s1: .05, c0: c[0], c1: c[1], floor: true });
  }
  emitWind(x, y, k = 1, vx = 0, z = .45) {
    const c = C.air; for (let i = 0; i < this.v.n(2 * k); i++)
      this.v.parts.emit({ x: x + rnd(-.2, .2), y: y + rnd(-.25, .25), z: z + rnd(-.1, .1), vx: vx + rnd(-1, 1), vy: rnd(-.6, .6), vz: 0, drag: 3, life: rnd(.2, .35), s0: rnd(.12, .22), s1: 0, c0: c[0], c1: c[2], a0: .7 });
  }
  emitDust(x, y, k = 1, z = .3) {
    for (let i = 0; i < this.v.n(3 * k); i++) this.v.parts.emit({ x: x + rnd(-.3, .3), y: y + rnd(0, .2), z: z + rnd(-.3, .3), vx: rnd(-1.5, 1.5), vy: rnd(.3, 1.4), vz: rnd(-.5, .5), g: 1, drag: 2, life: rnd(.4, .7), s0: rnd(.3, .5), s1: rnd(.6, .9), c0: C.earth[1], c1: C.earth[2], a0: .55 });
  }
  pebbles(x, y, k = 1, vx = 0, z = .35) {
    for (let i = 0; i < this.v.n(3 * k); i++) this.v.parts.emit({ x: x + rnd(-.25, .25), y: y + rnd(-.1, .2), z: z + rnd(-.2, .2), vx: vx + rnd(-2.5, 2.5), vy: rnd(1.5, 5), vz: rnd(-.6, .6), g: 22, drag: .4, life: rnd(.5, .8), s0: rnd(.1, .2), s1: .12, c0: C.earth[0], c1: C.earth[2], floor: true });
  }
  ring(x, y, color, size = .6, grow = 4, life = .3, flat = false, stretch = 1) { this.v.shapes.sprite('ring', _w.set(x, y, .55), { color, size, grow, life, flat, stretch, opacity: .85 }); }

  // piedra que brota del suelo: crece con un rebote, aguanta y se hunde (colmillo o losa)
  stone(x, z, h, { geo = this.spikeGeo, w = 1, tilt = 0, yaw = rnd(0, 6.28), life = .7, delay = 0 } = {}) {
    if (this.stones.length > 90) return null;
    const m = new THREE.Mesh(geo, this.rock.mat); m.castShadow = true; m.position.set(x, -.05, z); m.rotation.set(0, yaw, tilt); m.scale.set(w, .01, w); m.visible = delay <= 0; this.scene.add(m);
    const o = { m, t: -delay, life, h, w }; this.stones.push(o); return o;
  }
  crack(x0, x1, life = .7) { // grieta brillante en el suelo entre dos puntos
    const m = new THREE.Mesh(this.crackGeo, this.crackMat.clone()), len = Math.abs(x1 - x0) + .1; m.position.set((x0 + x1) / 2, .03, rnd(-.12, .12)); m.scale.set(len, 1, rnd(.6, 1.3)); m.rotation.y = rnd(-.12, .12); this.scene.add(m);
    this.dying.push({ t: 0, life, crack: m });
  }
  #stones(dt) {
    for (let i = this.stones.length - 1; i >= 0; i--) {
      const o = this.stones[i]; o.t += dt; if (o.t < 0) continue; o.m.visible = true; const k = o.t / o.life;
      if (k >= 1) { o.m.removeFromParent(); this.stones.splice(i, 1); continue; }
      const a = Math.min(1, k / .14), up = k < .14 ? 1 + 2.7 * Math.pow(a - 1, 3) + 1.7 * Math.pow(a - 1, 2) : 1; // sale con rebote
      const sink = k > .72 ? (k - .72) / .28 : 0;
      o.m.scale.set(o.w * (1 + sink * .2), Math.max(.01, o.h * up * (1 - sink * .35)), o.w * (1 + sink * .2)); o.m.position.y = -.05 - sink * o.h * .9;
    }
  }

  // ── efectos puntuales que piden los clips ──
  cue(c, who, at, facing, root) {
    const x = at.x, y = at.y, d = facing;
    switch (c.kind) {
      case 'b_fist_ignite': this.v.burst(_w.set(x, y, .5), E3('fire'), { n: 12, speed: 1.6, up: 2, g: -2.5, life: .35, size: .26, size1: .02 }); this.v.shapes.sprite('flash', _w.set(x, y, .55), { color: 0xffb060, size: .5, grow: 1.6, life: .14 }); break;
      case 'b_fire_muzzle':
        this.v.shapes.sprite('flash', _w.set(x + d * .25, y, .6), { color: 0xfff0b0, size: 1.1, grow: 1.7, life: .14 });
        this.v.shapes.sprite('crescent', _w.set(x + d * .35, y, .58), { color: 0xff9a3a, size: 1.2, grow: 1.6, life: .2, rot: d > 0 ? -Math.PI / 2 : Math.PI / 2, stretch: .7 });
        this.v.burst(_w.set(x, y, .5), E3('fire'), { n: 26, speed: 6, dir: _u.set(d * 5, .4, 0), g: -2, life: .32, size: .34, size1: .03, drag: 4, spread: .35 }); break;
      case 'b_ground_flare': this.ring(x, .06, 0xff8a2a, .5, 5, .35, true); this.v.burst(_w.set(x, .15, .3), E3('fire'), { n: 14, speed: 3, up: 2, g: -2, life: .4, size: .28, spread: .2 }); break;
      case 'b_fire_whoosh': this.v.burst(_w.set(x, y, .5), E3('fire'), { n: 18, speed: 4, up: 3, g: -3, life: .4, size: .34, size1: .03, drag: 3 }); break;
      case 'b_water_draw': for (let i = 0; i < this.v.n(16); i++) { const a = rnd(0, 6.28), r = rnd(.9, 1.5); this.v.parts.emit({ x: x + Math.cos(a) * r, y: Math.max(.1, y - .3 + Math.sin(a) * r * .6), z: .5, vx: -Math.cos(a) * r * 3.2, vy: -Math.sin(a) * r * 2, vz: 0, life: .3, s0: .14, s1: .2, drag: 0, c0: C.water[0], c1: C.water[1] }); } break;
      case 'b_water_sink': this.ring(root.x + d * 3, .05, 0x6fd6ff, .4, 5, .5, true); this.ring(root.x + d * .7, .05, 0x6fd6ff, .3, 4, .4, true); break;
      case 'b_water_lift': this.emitDrops(x, y, 3, 0, 3); this.v.shapes.sprite('flash', _w.set(x, y, .55), { color: 0xbff0ff, size: .7, grow: 1.6, life: .16 }); break;
      case 'b_ice_form': this.v.burst(_w.set(x, y, .55), E3('ice'), { n: 14, speed: 1.2, life: .4, size: .16, size1: .02, drag: 1 }); this.v.shapes.sprite('flash', _w.set(x, y, .6), { color: 0xe8fbff, size: .6, grow: 1.4, life: .2 }); break;
      case 'b_stone_wake': this.v.burst(_w.set(root.x, 1.4, .4), { a: C.rune, b: new THREE.Color(0x2f6a1a), c: C.rune }, { n: 12, speed: 1.6, up: 1, life: .45, size: .22, size1: 0 }); break;
      case 'b_stomp': {
        const sx = x; this.ring(sx, .05, 0xb9d86a, .8, 6, .4, true); this.v.dust(sx, 1.2); this.pebbles(sx, .1, 3);
        if (!this.v.reduce) this.m.shake = Math.max(this.m.shake || 0, .14);
        for (let i = 0; i < 3; i++) this.v.shapes.rock(sx + d * (.4 + i * .35) + rnd(-.1, .1), rnd(-.4, .2), rnd(.25, .5), .45); break; }
      case 'b_ground_rip': { // Terra rasga el suelo con la mano: grieta y astillas hacia delante
        this.crack(x, x + d * 1.4, .6); this.pebbles(x + d * .4, .15, 2, d * 2); this.emitDust(x + d * .3, 0, 1.5);
        for (let i = 0; i < 3; i++) this.stone(x + d * (.35 + i * .3), rnd(-.3, .2), .35 + i * .18, { tilt: -d * .5, life: .45, delay: i * .03 });
        if (!this.v.reduce) this.m.shake = Math.max(this.m.shake || 0, .08); break; }
      case 'b_heave': { // arranca el suelo: anillo de losas que se levantan a su alrededor
        this.ring(root.x, .05, 0xb9d86a, 1, 7, .5, true); this.v.dust(root.x, 1.5); this.pebbles(root.x, .2, 4);
        for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; this.stone(root.x + Math.cos(a) * 1.1, Math.sin(a) * .7, rnd(.5, .9), { geo: this.slabGeo, w: .45, tilt: -Math.cos(a) * .5, yaw: a, life: .6, delay: i * .02 }); }
        if (!this.v.reduce) this.m.shake = Math.max(this.m.shake || 0, .2); break; }
      case 'b_rock_punch': this.v.shapes.sprite('flash', _w.set(x + d * .2, y, .6), { color: 0xffffff, size: .8, grow: 1.6, life: .12 }); this.emitDust(x + d * .3, y - .3, 2); this.pebbles(x + d * .3, y, 1.5, d * 3); break;
      case 'b_air_push':
        this.ring(x + d * .4, y, 0xeaf4ff, .5, 4, .26, false, .45); this.ring(x + d * .9, y, 0xeaf4ff, .4, 3.2, .3, false, .4);
        for (let i = 0; i < this.v.n(14); i++) this.v.parts.emit({ x: x + d * .2, y: y + rnd(-.4, .4), z: .5 + rnd(-.1, .1), vx: d * rnd(7, 13), vy: rnd(-1, 1), vz: 0, drag: 5, life: rnd(.18, .3), s0: .16, s1: 0, c0: C.air[0], c1: C.air[2], a0: .8 }); break;
      default: return false;
    }
    return true;
  }

  // ── efectos sostenidos (cada fotograma de pantalla mientras el clip está en su tramo) ──
  sustained(dt) {
    const m = this.m; if (!m?.v || dt <= 0) return;
    m.v.forEach((v, i) => {
      const f = m.f[i], anim = v.c.anim, a = f.act, clip = a && anim?.dir?.clips?.[a.name], key = 'f' + i;
      const st = this.live.get(key) || {}; this.live.set(key, st);
      const on = new Set();
      if (clip?.sfx?.length && !f.ko && !(f.stun > 0)) {
        const ct = warpTime(clip, a), A = anim.anchors(), rx = v.rig.position.x;
        for (const s of clip.sfx) {
          if (ct < s.t0 || ct > s.t1 + (s.kind === 'water_whip' ? 0 : 0)) continue;
          on.add(s.kind); const k = (ct - s.t0) / Math.max(1e-3, s.t1 - s.t0), an = A[s.at];
          const P = an ? an.tip.getWorldPosition(_v) : _v.set(rx, 1.5, 0);
          this.#sfx(s.kind, st, { f, P, k, ct, dt, rx, A, clip, a });
        }
      }
      for (const kind of Object.keys(st)) if (!on.has(kind) && st[kind]) this.#end(kind, st, f);
    });
  }
  #sfx(kind, st, { f, P, k, dt, rx }) {
    const d = f.facing;
    switch (kind) {
      case 'fire_hand': case 'fire_foot': this.emitFire(P.x, P.y, .6 + k * .7, 0); if (Math.random() < .3) this.v.parts.emit({ x: P.x, y: P.y, z: .5, vx: rnd(-1, 1), vy: rnd(1, 3), vz: 0, g: -1, drag: 1, life: .6, s0: .05, s1: .02, c0: C.fire[0], c1: C.fire[1] }); st[kind] = 1; break;
      case 'fire_arc': case 'water_ribbon': { // cinta que guarda el recorrido del pie / la mano
        const fire = kind === 'fire_arc';
        if (!st[kind]) st[kind] = { rb: new Ribbon(this.scene, elemMat(fire ? 'fire' : 'water', { scale: fire ? [4, 1.2] : [5, 1], flow: fire ? [-3, .6] : [-4, 0] }), { width: fire ? .62 : .14 }), pts: [] };
        const o = st[kind]; o.pts.push({ x: P.x, y: P.y, age: 0 });
        for (const p of o.pts) p.age += dt; o.pts = o.pts.filter(p => p.age < (fire ? .38 : .22));
        o.rb.set(o.pts.map((p, j) => { const u = j / Math.max(1, o.pts.length - 1); return { x: p.x, y: p.y, w: fire ? Math.sin(Math.PI * Math.min(1, u * 1.1)) * (1 - p.age / .38) + .08 : .35 + u * .65, a: fire ? 1 : .4 + u * .6 }; }));
        o.rb.mat.uniforms.uT.value = this.t;
        if (fire) this.emitFire(P.x, P.y, 1.1, 0); else if (Math.random() < .5) this.emitDrops(P.x, P.y, .5, 0, 1);
        break; }
      case 'water_whip': { // látigo: sale de la mano, se estira hasta el alcance con una onda que viaja y se recoge
        if (!st[kind]) st[kind] = { rb: new Ribbon(this.scene, elemMat('water', { scale: [10, 1], flow: [-6, 0] }), { width: .16, n: 48 }) };
        const o = st[kind], R = (f.act?.def?.range || 3.6) - .2, ext = k < .35 ? 1 - Math.pow(1 - k / .35, 3) : k < .7 ? 1 : 1 - (k - .7) / .3 * .85;
        const ex = rx + d * R * ext, ey = 1.55 + Math.sin(k * 9) * .08, pts = [];
        for (let j = 0; j <= 24; j++) {
          const u = j / 24, wave = Math.sin(u * 9 - k * 26) * .22 * u * (1 - u) * 4 * (1 - ext * .55), sag = -Math.sin(u * Math.PI) * .25 * (1 - ext);
          pts.push({ x: P.x + (ex - P.x) * u, y: P.y + (ey - P.y) * u + wave + sag, w: (1 - u * .55) * (u < .06 ? u / .06 : 1), a: 1 });
        }
        o.rb.set(pts); o.rb.mat.uniforms.uT.value = this.t;
        if (ext > .9 && Math.random() < .8) this.emitDrops(ex, ey, 1.2, d * 2, 1.5);
        o.tip = { x: ex, y: ey }; break; }
      case 'water_hands': this.emitDrops(P.x, P.y - .1, .5, 0, -.5); if (Math.random() < .25) this.ring(P.x, .05, 0x6fd6ff, .25, 3, .4, true); st[kind] = 1; break;
      case 'geyser_mark': { const gx = rx + d * 3; if (Math.random() < .55) this.emitDrops(gx + rnd(-.35, .35), .05, .5, 0, 2.5 + k * 3); if (Math.random() < .18) this.ring(gx, .05, 0x8fe0ff, .3, 4, .45, true); st[kind] = 1; break; }
      case 'ice_hand': this.v.parts.emit({ x: P.x + rnd(-.15, .15), y: P.y + rnd(-.15, .15), z: .55, vx: rnd(-.5, .5), vy: rnd(-.3, .5), vz: 0, drag: 2, life: .35, s0: .14, s1: .02, c0: C.ice[0], c1: C.ice[2] }); st[kind] = 1; break;
      case 'rock_hands': if (Math.random() < .5) this.pebbles(P.x, P.y, .3, 0); st[kind] = 1; break;
      case 'air_gather': for (let j = 0; j < this.v.n(2); j++) { const a = rnd(0, 6.28), r = rnd(.6, 1.1); this.v.parts.emit({ x: P.x + Math.cos(a) * r, y: P.y + Math.sin(a) * r, z: .5, vx: -Math.cos(a) * r * 5, vy: -Math.sin(a) * r * 5, vz: 0, drag: 0, life: .18, s0: .1, s1: .2, c0: C.air[0], c1: C.air[2], a0: .7 }); } st[kind] = 1; break;
      case 'air_spin': { const a = this.t * 14 + Math.random(); for (let j = 0; j < this.v.n(2); j++) { const y = rnd(.2, 2.6), r = .7 + y * .12; this.v.parts.emit({ x: rx + Math.cos(a + j * 3.1) * r, y, z: .3 + Math.sin(a + j * 3.1) * r * .6, vx: -Math.sin(a + j * 3.1) * 5, vy: 1.2, vz: Math.cos(a + j * 3.1) * 3, drag: 1.5, life: .32, s0: .14, s1: .02, c0: C.air[0], c1: C.air[2], a0: .8 }); } if (Math.random() < .1) this.v.dust(rx, .4); st[kind] = 1; break; }
      case 'boulder_rise': { // la roca emerge del suelo delante de Terra y sube hasta la altura del puño
        if (!st[kind]) { const mesh = new THREE.Mesh(this.rock.geo, this.rock.mat); mesh.castShadow = true; this.scene.add(mesh); st[kind] = { mesh, x: rx + d * 1.25 }; this.v.dust(rx + d * 1.25, 1.2); this.pebbles(rx + d * 1.25, .1, 2); }
        const o = st[kind], e = 1 - Math.pow(1 - Math.min(1, k * 1.25), 3);
        o.mesh.position.set(o.x + Math.sin(this.t * 60) * .02 * (1 - e), -.55 + e * 2.0, 0); o.mesh.rotation.set(k * 1.2, k * .8 * d, k * .5);
        if (Math.random() < .35) this.pebbles(o.x, o.mesh.position.y - .4, .3, 0); if (k < .4 && Math.random() < .3) this.emitDust(o.x, 0, .6);
        o.last = { x: o.x, y: o.mesh.position.y }; break; }
    }
  }
  #end(kind, st, f) {
    const o = st[kind]; st[kind] = null; if (!o || o === 1) return;
    if (o.rb) { const rb = o.rb; this.dying.push({ t: 0, life: .14, rb }); return; }
    if (kind === 'boulder_rise') { // si el proyectil ya salió, la roca «se convierte» en él; si interrumpieron a Terra, cae y se rompe
      const fired = [...this.proj.keys()].some(p => p.kind === 'boulder' && p.owner === f && p.t < .1);
      if (fired) { o.mesh.removeFromParent(); return; }
      this.dying.push({ t: 0, life: .35, mesh: o.mesh, vy: 0, crumble: true });
    }
  }

  // ── proyectiles ──
  projectile(p) {
    let o = this.proj.get(p); const d = p.dir;
    if (!o) { o = this.#makeProj(p); this.proj.set(p, o); }
    o.t = p.t; const g = o.g; g.position.set(p.x, p.y, 0);
    for (const m of o.mats) m.uniforms.uT.value = this.t;
    switch (p.kind) {
      case 'fireball': case 'comet': {
        const s = 1 + Math.sin(p.t * 40) * .06, ang = Math.atan2(p.def.vy || 0, p.vx); g.rotation.z = ang;
        o.shell.scale.set(1.7 * s, s, s); o.core.scale.setScalar(s * .9);
        this.emitFire(p.x - Math.cos(ang) * .3, p.y - Math.sin(ang) * .3, p.kind === 'comet' ? 1 : 1.4, d);
        o.trail.push({ x: p.x, y: p.y }); if (o.trail.length > 14) o.trail.shift(); // estela de llamas (cola del cometa)
        o.tail.set(o.trail.map((q, j) => ({ x: q.x, y: q.y, w: Math.pow(j / (o.trail.length - 1 || 1), .7), a: j / (o.trail.length - 1 || 1) })));
        o.tail.mat.uniforms.uT.value = this.t;
        if (Math.random() < .5) this.v.parts.emit({ x: p.x, y: p.y, z: .4, vx: -Math.cos(ang) * 2 + rnd(-1, 1), vy: -Math.sin(ang) * 2 + rnd(0, 2), vz: 0, g: 4, drag: 1, life: .5, s0: .06, s1: .03, c0: C.fire[0], c1: C.fire[1] });
        break; }
      case 'geyser': {
        const up = Math.min(1, p.t / .1), fall = p.t > p.life - .15 ? (p.life - p.t) / .15 : 1, h = up * Math.max(.05, fall);
        o.col.scale.set(1 + Math.sin(p.t * 30) * .04, h, 1 + Math.cos(p.t * 27) * .04); o.col.position.y = -p.y; o.cap.position.y = -p.y + 3.8 * h;
        o.cap.scale.setScalar(.6 + up * .6);
        this.emitDrops(p.x + rnd(-.3, .3), 3.8 * h, 1.5, rnd(-2, 2), rnd(2, 5)); if (Math.random() < .5) this.emitDrops(p.x, .1, 1, rnd(-3, 3), 2);
        if (p.t < .05) { this.ring(p.x, .05, 0x8fe0ff, .6, 5, .45, true); this.v.shapes.sprite('flash', _w.set(p.x, .4, .5), { color: 0xcff4ff, size: 1.3, grow: 1.6, life: .2 }); }
        break; }
      case 'ice': {
        const ang = Math.atan2(p.def.vy || 0, p.vx); g.rotation.z = ang;
        o.shards.forEach((s, j) => { s.visible = j >= (p.hits || 0); s.position.x = Math.sin(p.t * 20 + j) * .02 - j * .22; });
        if (Math.random() < .7) this.v.parts.emit({ x: p.x - Math.cos(ang) * .4, y: p.y - Math.sin(ang) * .4, z: .45, vx: rnd(-.4, .4), vy: rnd(-.2, .3), vz: 0, drag: 2, life: .35, s0: .2, s1: .05, c0: C.ice[1], c1: C.ice[2], a0: .6 });
        break; }
      case 'boulder': case 'rockshot': {
        const sp = p.kind === 'boulder' ? 9 : 14; o.rock.rotation.z -= d * sp * .016; o.rock.rotation.x += .05;
        if (p.kind === 'rockshot') g.rotation.z = Math.atan2(p.def.vy || 0, p.vx);
        else { if (Math.random() < .6) this.emitDust(p.x - d * .5, p.y - .3, .35, .2); if (Math.random() < .3) this.pebbles(p.x - d * .3, p.y, .3, -d * 1.5); } // estela de polvo y esquirlas
        if (Math.random() < .5) this.emitDust(p.x - d * .5, p.y - .2, .4); if (Math.random() < .3) this.pebbles(p.x, p.y, .2, -d);
        break; }
      case 'fangs': { // Fisura de Colmillos: hileras de colmillos que brotan inclinados hacia el rival
        if (p.t >= (o.next ?? 0)) {
          o.next = p.t + (this.v.reduce ? .09 : .05); const n = (o.n = (o.n ?? 0) + 1);
          for (let j = 0; j < 2; j++) this.stone(p.x + rnd(-.12, .12), j ? rnd(.05, .35) : rnd(-.4, -.05), rnd(.75, 1.15) * (1 + Math.min(n, 12) * .025), { tilt: -d * rnd(.18, .42), life: .62 });
          if (o.lx !== undefined) this.crack(o.lx, p.x, .55); o.lx = p.x;
          this.pebbles(p.x, .2, .6, d * 1.5); if (n % 2) this.emitDust(p.x, 0, .7);
        }
        break; }
      case 'slabwave': { // Ola Tectónica: losas que ruedan como una ola de piedra
        o.slabs.forEach((sl, j) => { const ph = p.t * 15 - j * 1.25, h = sl.userData.h * (.78 + .22 * Math.sin(ph)) * Math.min(1, p.t / .08);
          sl.scale.set(1, Math.max(.01, h / 2), 1); sl.rotation.z = -d * (.42 + .16 * Math.sin(ph + .6)); sl.position.y = -p.y - .1; });
        if (p.t >= (o.next ?? 0)) { o.next = p.t + (this.v.reduce ? .12 : .07);
          this.stone(p.x - d * 1.7, rnd(-.35, .35), rnd(.5, .85), { geo: this.slabGeo, w: .7, tilt: -d * rnd(.6, 1.1), life: .5 });
          this.crack(p.x - d * 2, p.x, .8); this.pebbles(p.x + d * .3, 1, 1.4, d * 3); }
        this.emitDust(p.x - d * .4, 0, 1); if (!this.v.reduce) this.m.shake = Math.max(this.m.shake || 0, .07);
        break; }
      case 'wall': {
        const up = Math.min(1, p.t / .14);
        o.slab.position.y = -p.y - 2.9 * (1 - (1 - Math.pow(1 - up, 3))) + (up < 1 ? Math.sin(p.t * 90) * .03 : 0);
        if (up < 1) { if (Math.random() < .9) this.pebbles(p.x, .1, .8); if (Math.random() < .6) this.emitDust(p.x, 0, .8); }
        if (!o.risen && up >= 1) { o.risen = true; this.v.dust(p.x, 1.4); this.ring(p.x, .05, 0xb9d86a, .7, 5, .4, true); for (let j = 0; j < 4; j++) this.v.shapes.rock(p.x + rnd(-.7, .7), rnd(-.5, .4), rnd(.2, .45), .5); }
        break; }
      case 'gust': case 'airball': {
        const s = 1 + Math.sin(p.t * 25) * .08; o.ball.scale.set(1.25 * s, s, s); o.ball.rotation.x += .4;
        if (p.kind === 'airball') g.rotation.z = Math.atan2(p.def.vy || 0, p.vx);
        if ((o.nr = (o.nr ?? 0) - .016) <= 0) { o.nr = .1; this.v.shapes.sprite('ring', _w.set(p.x - d * .2, p.y, .55), { color: 0xeaf4ff, size: p.kind === 'gust' ? .9 : .6, grow: 1.8, life: .2, stretch: .5, opacity: .45 }); }
        this.emitWind(p.x - d * .4, p.y, 1.2, -d * 3);
        break; }
      case 'tornado': {
        o.funnel.rotation.y += .35; o.inner.rotation.y -= .5; const w = Math.min(1, p.t / .15) * (p.t > p.life - .2 ? (p.life - p.t) / .2 : 1);
        o.funnel.scale.set(w, Math.max(.05, w), w); o.inner.scale.set(w * .8, Math.max(.05, w), w * .8);
        if (Math.random() < .6) this.v.dust(p.x, .5); const a = this.t * 12;
        for (let j = 0; j < this.v.n(2); j++) { const y = rnd(0, 3), r = .3 + y * .22; this.v.parts.emit({ x: p.x + Math.cos(a + j * 3) * r, y: y, z: Math.sin(a + j * 3) * r * .5 + .2, vx: -Math.sin(a + j * 3) * 6, vy: 2.5, vz: Math.cos(a + j * 3) * 3, drag: 2, life: .35, s0: .12, s1: .02, c0: j ? C.air[0] : new THREE.Color(0x9aa08a), c1: C.air[2], a0: .8 }); }
        break; }
    }
  }
  #makeProj(p) {
    const g = new THREE.Group(), o = { g, mats: [] }; g.renderOrder = 9;
    const add = (mesh, mat) => { if (mat?.uniforms) o.mats.push(mat); g.add(mesh); return mesh; };
    switch (p.kind) {
      case 'fireball': case 'comet': {
        const r = p.kind === 'comet' ? .34 : .46, sm = elemMat('fire', { shell: true, scale: [4.5, 3], flow: [-6, .8] });
        o.shell = add(new THREE.Mesh(withAlpha(new THREE.SphereGeometry(r, 20, 14)), sm), sm);
        o.core = add(new THREE.Mesh(new THREE.SphereGeometry(r * .36, 14, 10), new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: .75, blending: THREE.AdditiveBlending, depthWrite: false })));
        const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.#soft(), color: 0xff5a14, transparent: true, opacity: .45, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); glow.scale.setScalar(r * 4.2); g.add(glow);
        o.tail = new Ribbon(this.scene, elemMat('fire', { scale: [3, 1.4], flow: [-5, 0] }), { width: r * 1.05, n: 24, z: .02 }); o.trail = [];
        break; }
      case 'geyser': {
        const cm = elemMat('water', { shell: true, scale: [4, 2], flow: [0, -3.5] }); const cg = withAlpha(new THREE.CylinderGeometry(.42, .62, 3.8, 20, 8, true)); cg.translate(0, 1.9, 0);
        o.col = add(new THREE.Mesh(cg, cm), cm);
        const capm = elemMat('water', { shell: true, scale: [3, 3], flow: [0, -2] }); o.cap = add(new THREE.Mesh(withAlpha(new THREE.SphereGeometry(.65, 16, 10)), capm), capm);
        break; }
      case 'ice': o.shards = [0, 1, 2].map(j => { const s = new THREE.Mesh(this.iceGeo, this.iceMat); s.position.set(-j * .22, (j - 1) * .2, (j - 1) * .1); g.add(s); return s; }); break;
      case 'boulder': o.rock = new THREE.Mesh(this.rock.geo, this.rock.mat); o.rock.castShadow = true; g.add(o.rock); break;
      case 'rockshot': o.rock = new THREE.Mesh(this.rock.geoS, this.rock.mat); o.rock.castShadow = true; g.add(o.rock); break;
      case 'fangs': this.v.dust(p.x, .8); break;
      case 'slabwave': {
        o.slabs = [0, 1, 2, 3].map(j => { const sl = new THREE.Mesh(this.slabGeo, this.rock.mat); sl.castShadow = true; sl.position.set(-p.dir * j * .55, -p.y, (j % 2 ? .25 : -.2)); sl.userData.h = [2.4, 2, 1.55, 1.1][j]; sl.rotation.y = rnd(-.2, .2); g.add(sl); return sl; });
        this.ring(p.x, .05, 0xb9d86a, 1.2, 6, .5, true); this.v.dust(p.x, 1.6); break; }
      case 'wall': o.slab = new THREE.Mesh(this.rock.wall, this.rock.mat); o.slab.castShadow = o.slab.receiveShadow = true; o.slab.position.y = -p.y - 2.9; g.add(o.slab); break;
      case 'gust': case 'airball': {
        const am = elemMat('air', { shell: true, scale: [6, 2], flow: [-5, 1] }); o.ball = add(new THREE.Mesh(withAlpha(new THREE.SphereGeometry(p.kind === 'gust' ? .62 : .42, 20, 14)), am), am);
        break; }
      case 'tornado': {
        const fm = elemMat('air', { shell: true, scale: [5, 3], flow: [-6, -2] }), fg = withAlpha(new THREE.CylinderGeometry(.95, .22, 3.3, 24, 10, true)); fg.translate(0, 1.65, 0);
        o.funnel = add(new THREE.Mesh(fg, fm), fm); o.funnel.position.y = -p.y;
        const im = elemMat('air', { shell: true, scale: [7, 2], flow: [-8, -3], alpha: .7 }), ig = withAlpha(new THREE.CylinderGeometry(.6, .12, 3.1, 20, 8, true)); ig.translate(0, 1.55, 0);
        o.inner = add(new THREE.Mesh(ig, im), im); o.inner.position.y = -p.y;
        break; }
    }
    this.scene.add(g); return o;
  }
  #soft() { if (this._soft) return this._soft; const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.4, 'rgba(255,255,255,.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64); this._soft = new THREE.CanvasTexture(c); return this._soft; }
  projectileEnd(p, how) {
    const o = this.proj.get(p); if (!o) return; this.proj.delete(p);
    const x = p.x, y = p.y, d = p.dir;
    if (p.kind === 'wall') { this.dying.push({ t: 0, life: .45, g: o.g, mats: o.mats, sink: true }); this.v.dust(x, 1.2); this.pebbles(x, 1.5, 3); return; }
    if (p.kind === 'slabwave') for (const sl of o.slabs) { sl.getWorldPosition(_v); sl.getWorldQuaternion(_q); sl.removeFromParent(); sl.position.copy(_v); sl.quaternion.copy(_q); this.scene.add(sl); this.dying.push({ t: 0, life: .55, mesh: sl, vy: 0, crumble: true }); }
    if (p.kind === 'geyser') { this.dying.push({ t: 0, life: .2, g: o.g, mats: o.mats, sink: true }); for (let j = 0; j < 4; j++) this.emitDrops(x, 1 + j * .7, 1.5, rnd(-2, 2), 1); return; }
    this.#disposeGroup(o.g, o.mats); if (o.tail) this.dying.push({ t: 0, life: .12, rb: o.tail });
    if (!how) return;
    const low = p.landed ? .15 : y;
    switch (p.kind) {
      case 'fireball': case 'comet':
        this.v.shapes.sprite('flash', _w.set(x, low, .6), { color: 0xffd080, size: 1.4, grow: 1.8, life: .2 }); this.ring(x, low, 0xff8a2a, .6, 4, .3);
        this.v.burst(_w.set(x, low, .5), E3('fire'), { n: 26, speed: 5, up: 2, g: -3, life: .45, size: .38, size1: .03, drag: 3 });
        if (p.landed) { this.ring(x, .05, 0xff7a2a, .5, 5, .4, true); this.v.burst(_w.set(x, .1, .3), E3('fire'), { n: 14, speed: 3, up: 3, g: -2, life: .6, size: .3, spread: .25 }); }
        break;
      case 'ice': this.v.burst(_w.set(x, low, .5), E3('ice'), { n: 22, speed: 5, up: 2, g: 14, life: .45, size: .14, size1: .05, floor: true }); this.v.shapes.sprite('flash', _w.set(x, low, .6), { color: 0xe8fbff, size: .9, grow: 1.6, life: .14 }); break;
      case 'boulder': case 'rockshot': {
        const big = p.kind === 'boulder'; this.v.shapes.sprite('flash', _w.set(x, low, .6), { color: 0xfff4dc, size: big ? 1.3 : .9, grow: 1.6, life: .14 });
        this.pebbles(x, low, big ? 5 : 3, d * 1.5); this.emitDust(x, Math.max(0, low - .4), big ? 3 : 2); this.v.dust(x, big ? 1.1 : .7);
        if (p.landed) for (let j = 0; j < 3; j++) this.v.shapes.rock(x + rnd(-.5, .5), rnd(-.3, .3), rnd(.3, .6), .5);
        break; }
      case 'fangs': this.pebbles(x, .3, 3, d * 2); this.emitDust(x, 0, 2); this.v.shapes.sprite('flash', _w.set(x, .8, .6), { color: 0xf2ffd0, size: 1, grow: 1.6, life: .14 });
        for (let j = 0; j < 3; j++) this.stone(x + d * j * .25, rnd(-.3, .3), 1.3 + j * .25, { tilt: -d * .3, life: .55, delay: j * .03 }); break;
      case 'slabwave':
        this.ring(x, .05, 0xb9d86a, 1.3, 7, .5, true); this.v.dust(x, 1.8); this.pebbles(x, 1.2, 6, d * 2); this.emitDust(x, 0, 3);
        this.v.shapes.sprite('flash', _w.set(x, 1.2, .6), { color: 0xf2ffd0, size: 1.6, grow: 1.8, life: .16 }); break;
      case 'gust': case 'airball': case 'tornado': this.ring(x, low, 0xeaf4ff, .6, 4, .3, false, .7); this.v.burst(_w.set(x, low, .5), E3('air'), { n: 18, speed: 6, life: .3, size: .16, drag: 4 }); if (p.landed) this.v.dust(x, 1); break;
    }
  }
  #disposeGroup(g, mats = []) {
    g.removeFromParent(); const shared = new Set([this.rock.geo, this.rock.geoS, this.rock.wall, this.rock.mat, this.iceGeo, this.iceMat, this.slabGeo, this.spikeGeo]);
    g.traverse(o => { if (o.isMesh || o.isSprite) { if (!shared.has(o.geometry)) o.geometry?.dispose?.(); if (!shared.has(o.material)) o.material.dispose(); } });
  }
  hasProjectile(p) { return this.proj.has(p); }

  update(dt) {
    this.t += dt; this.sustained(dt); this.#stones(dt);
    for (let i = this.dying.length - 1; i >= 0; i--) {
      const z = this.dying[i]; z.t += dt; const k = z.t / z.life;
      if (z.rb) { z.rb.mesh.material.uniforms.uA.value = Math.max(0, 1 - k); z.rb.mat.uniforms.uT.value = this.t; }
      if (z.mesh && z.crumble) { z.vy -= 20 * dt; z.mesh.position.y = Math.max(-.6, z.mesh.position.y + z.vy * dt); z.mesh.scale.setScalar(Math.max(.01, 1 - k)); if (Math.random() < .5) this.pebbles(z.mesh.position.x, Math.max(.1, z.mesh.position.y), .4); }
      if (z.g && z.sink) { z.g.position.y -= dt * 7; for (const m of z.mats || []) m.uniforms.uA.value = Math.max(0, 1 - k); }
      if (z.crack) z.crack.material.opacity = .9 * Math.max(0, 1 - k) * (k < .1 ? k / .1 : 1);
      if (k >= 1) { if (z.crack) { z.crack.removeFromParent(); z.crack.material.dispose(); } if (z.rb) z.rb.dispose(); if (z.mesh) z.mesh.removeFromParent(); if (z.g) this.#disposeGroup(z.g, z.mats); this.dying.splice(i, 1); }
    }
  }
  dispose() {
    for (const p of [...this.proj.keys()]) { const o = this.proj.get(p); this.#disposeGroup(o.g, o.mats); o.tail?.dispose(); } this.proj.clear();
    for (const st of this.live.values()) for (const k of Object.keys(st)) { const o = st[k]; if (o?.rb) o.rb.dispose(); if (o?.mesh) o.mesh.removeFromParent(); }
    for (const o of this.stones) o.m.removeFromParent(); this.stones = []; this.spikeGeo.dispose(); this.slabGeo.dispose(); this.crackGeo.dispose(); this.crackMat.dispose();
    this.live.clear(); for (const z of this.dying) { if (z.crack) { z.crack.removeFromParent(); z.crack.material.dispose(); } if (z.rb) z.rb.dispose(); if (z.mesh) z.mesh.removeFromParent(); if (z.g) this.#disposeGroup(z.g, z.mats); } this.dying = [];
    this.rock.geo.dispose(); this.rock.geoS.dispose(); this.rock.wall.dispose(); this.rock.mat.dispose(); this.iceGeo.dispose(); this.iceMat.dispose(); this._soft?.dispose();
  }
}
