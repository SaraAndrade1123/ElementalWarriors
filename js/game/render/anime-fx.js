import * as THREE from 'three';

// EFECTOS «DIBUJADOS A MANO» por sombreador (estilo anime de los juegos de lucha), sin texturas:
//   · AnimeCore: aura de cada proyectil elemental (fuego con lenguas de llama, agua en espiral, viento en cortes,
//     tierra en polvo dorado), con bandas de color duras (cel) y cola en la dirección contraria al avance.
//   · Spark: chispa de impacto en estrella con núcleo blanco, picos afilados del color del elemento y onda.
// Solo presentación: se dibujan donde están los proyectiles / golpes; nunca tocan la simulación.
const NOISE = `
float hh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float nz(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(hh(i), hh(i + vec2(1, 0)), f.x), mix(hh(i + vec2(0, 1)), hh(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p){ float s = 0., a = .5; for (int i = 0; i < 4; i++) { s += a * nz(p); p = p * 2.03 + 1.7; a *= .5; } return s; }`;
const VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }';

const CORE_FS = `uniform float uT, uKind, uA; uniform vec3 uC1, uC2, uC3; varying vec2 vUv; ${NOISE}
void main(){
  vec2 p = vUv * 2. - 1.;            // x: hacia delante (+) / cola (−) · y: vertical
  float tail = smoothstep(1., -1., p.x);
  vec2 q = vec2(p.x * (1. - .55 * tail), p.y / (1. - .62 * tail * tail));
  float d = length(q);
  float n;
  if (uKind < .5) n = fbm(vec2(p.x * 3. + uT * 7., p.y * 3. - uT * 2.));                                   // fuego
  else if (uKind < 1.5) { float a = atan(p.y, p.x); n = .5 + .5 * sin(a * 3. - uT * 12. + d * 8.) * .6 + fbm(p * 3. + uT) * .4; } // agua
  else if (uKind < 2.5) n = .45 + .55 * step(.55, fract(p.y * 4. + p.x * 1.5 - uT * 6.)) * fbm(vec2(p.x * 8. + uT * 12., p.y)); // viento
  else n = fbm(p * 4. + uT * 1.5);                                                                          // tierra
  float v = (1. - d) + (n - .5) * (.75 + tail * .5);
  if (v < .05) discard;
  vec3 c = v > .78 ? uC1 : v > .4 ? uC2 : uC3;               // bandas duras (cel)
  float a = v > .4 ? 1. : smoothstep(.05, .4, v) * .9;
  gl_FragColor = vec4(c * (v > .78 ? 1.5 : v > .4 ? 1.1 : .9), a * uA);
}`;
const SPARK_FS = `uniform float uK, uR, uN; uniform vec3 uC; varying vec2 vUv;
void main(){
  vec2 p = vUv * 2. - 1.; float r = length(p), a = atan(p.y, p.x) + uR;
  float spikes = pow(abs(cos(a * uN * .5)), 18.) * (1. - uK * .35);
  float star = smoothstep(.0, .06, (.25 + .95 * spikes) * (1. - uK * .5) - r);
  float core = smoothstep(.34 * (1. - uK), .0, r);
  float ring = smoothstep(.06, .0, abs(r - (.35 + uK * .6))) * (1. - uK);
  float al = max(max(star, core), ring) * (1. - uK * uK);
  if (al < .02) discard;
  vec3 c = mix(uC * 1.8, vec3(2.4), max(core, star * .35));
  gl_FragColor = vec4(c, al);
}`;
const SKIP = new Set(['wall', 'rock', 'geyser', 'tornado']);
// Estallido elemental al golpear (dibujo cel con 3 bandas): fuego = lenguas de llama hacia fuera y arriba,
// agua = corona de salpicaduras con picos, viento = cortes en media luna, tierra = esquirlas y polvo.
const BURST_FS = `uniform float uK, uKind, uSeed; uniform vec3 uC1, uC2, uC3; varying vec2 vUv; ${NOISE}
void main(){
  vec2 p = vUv * 2. - 1.; float r = length(p), a = atan(p.y, p.x), k = uK, v;
  if (uKind < .5) {          // fuego
    vec2 q = vec2(p.x, p.y - k * .35); float rr = length(q), aa = atan(q.y, q.x);
    float tongues = fbm(vec2(aa * 2.6 + uSeed, rr * 3. - k * 6.)) ;
    float up = .55 + .45 * max(0., sin(aa));
    v = (.55 + .65 * k) * up * (.65 + tongues * .7) - rr; v -= k * k * .55;
  } else if (uKind < 1.5) {  // agua
    float spikes = pow(abs(sin(a * 7. + uSeed)), 6.) * .55 + fbm(vec2(a * 4. + uSeed, 1.)) * .25;
    float up = smoothstep(-.6, .5, p.y + .2);
    float ring = (.3 + .6 * k) + spikes * up * (1. - k * .4);
    v = ring - r; if (r < (.18 + .55 * k) * .7) v = min(v, r - (.18 + .55 * k) * .55); v -= k * k * .4;
  } else if (uKind < 2.5) {  // viento
    float arc = abs(r - (.35 + .5 * k)) ; float sweep = smoothstep(-1., 1., sin(a * 2. + uSeed + k * 4.));
    v = (.12 - arc) * 4. * sweep - k * k * .5;
  } else {                   // tierra
    float shards = step(.62, fbm(vec2(a * 5. + uSeed, r * 2.))) * (1. - smoothstep(.2 + .7 * k, .3 + .75 * k, r));
    v = shards * (.5 - k * .5) + (.25 + .4 * k - r) * .6 - k * k * .4;
  }
  if (v < .02) discard;
  vec3 c = v > .32 ? uC1 : v > .14 ? uC2 : uC3;
  gl_FragColor = vec4(c * (v > .32 ? 1.5 : 1.1), smoothstep(.02, .08, v));
}`;
const ELEM = { fire: 0, water: 1, wind: 2, earth: 3 };
const PAL = {
  fire: [0xffe35a, 0xff7a12, 0xa8160a], water: [0xeaffff, 0x4fc8ff, 0x1e4fd0], wind: [0xffffff, 0xcfe8ff, 0x7aa8e0], earth: [0xfff1b0, 0xc9b26a, 0x6b5a38],
};

export class AnimeFx {
  constructor(scene) {
    this.scene = scene; this.cores = new Map(); this.sparks = []; this.t = 0;
    this.geo = new THREE.PlaneGeometry(1, 1);
  }
  _coreMat(el) {
    const P = PAL[el] || PAL.earth;
    return new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: CORE_FS, transparent: true, depthWrite: false, blending: THREE.NormalBlending, toneMapped: false,
      uniforms: { uT: { value: 0 }, uKind: { value: ELEM[el] ?? 3 }, uA: { value: 1 }, uC1: { value: new THREE.Color(P[0]) }, uC2: { value: new THREE.Color(P[1]) }, uC3: { value: new THREE.Color(P[2]) } } });
  }
  // proj: lista de proyectiles del combate · elOf(id) → elemento del dueño
  sync(proj, elOf, dt) {
    this.t += dt; const seen = new Set();
    for (const p of proj) {
      if (p.dead || /^w_/.test(p.kind || '') || SKIP.has(p.kind) || p.def?.wall) continue; // armas, muros y columnas tienen su propio dibujo
      seen.add(p); let c = this.cores.get(p);
      if (!c) { const el = elOf(p.owner?.def?.id); const m = new THREE.Mesh(this.geo, this._coreMat(el)); m.renderOrder = 8; m.frustumCulled = false; this.scene.add(m); c = { m, el, born: this.t }; this.cores.set(p, c); }
      const dir = Math.sign(p.vx || p.dir || 1), w = Math.max(.9, (p.w || .8) * 2.1), h = Math.max(.7, (p.h || .8) * 1.5), grow = Math.min(1, (this.t - c.born) / .08);
      c.m.position.set(p.x - dir * w * .18, p.y, .15); c.m.scale.set(w * grow * dir, h * grow, 1);
      c.m.material.uniforms.uT.value = this.t + c.born * 3;
    }
    for (const [p, c] of this.cores) if (!seen.has(p)) { c.m.removeFromParent(); c.m.material.dispose(); this.cores.delete(p); }
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i]; s.k += dt / s.life;
      if (s.k >= 1) { s.m.removeFromParent(); s.m.material.dispose(); this.sparks.splice(i, 1); continue; }
      s.m.material.uniforms.uK.value = s.k; s.m.scale.setScalar(s.size * (s.burst ? .7 + s.k * .5 : 1 + s.k * .6));
    }
  }
  // chispa de impacto (pos en el mundo; power ≈ 0.3 bloqueo … 1.5 golpe muy fuerte)
  spark(pos, color, power = 1, blocked = false) {
    const m = new THREE.Mesh(this.geo, new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: SPARK_FS, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, toneMapped: false,
      uniforms: { uK: { value: 0 }, uR: { value: Math.random() * 6.28 }, uN: { value: blocked ? 6 : power > 1 ? 8 : 5 + Math.floor(Math.random() * 3) }, uC: { value: new THREE.Color(blocked ? 0x8fd0ff : color) } } }));
    m.position.set(pos.x, pos.y, .8); m.renderOrder = 11; m.frustumCulled = false; this.scene.add(m);
    this.sparks.push({ m, k: 0, life: blocked ? .14 : .2 + power * .06, size: (blocked ? .8 : .7 + power * .55) });
  }
  // estallido del elemento de quien golpea (power ≈ 0.4 … 1.6)
  burst(pos, el, power = 1, dir = 1) {
    const P = PAL[el] || PAL.earth;
    const m = new THREE.Mesh(this.geo, new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: BURST_FS, transparent: true, depthWrite: false, depthTest: false, toneMapped: false,
      uniforms: { uK: { value: 0 }, uKind: { value: ELEM[el] ?? 3 }, uSeed: { value: Math.random() * 20 }, uC1: { value: new THREE.Color(P[0]) }, uC2: { value: new THREE.Color(P[1]) }, uC3: { value: new THREE.Color(P[2]) } } }));
    m.position.set(pos.x + dir * .15, pos.y, .7); m.renderOrder = 10; m.frustumCulled = false; this.scene.add(m);
    this.sparks.push({ m, k: 0, life: .26 + power * .08, size: 1.4 + power * 1.3, burst: true });
  }
  dispose() { for (const c of this.cores.values()) { c.m.removeFromParent(); c.m.material.dispose(); } this.cores.clear(); for (const s of this.sparks) { s.m.removeFromParent(); s.m.material.dispose(); } this.sparks = []; this.geo.dispose(); }
}
