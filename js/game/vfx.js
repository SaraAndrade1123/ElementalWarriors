import * as THREE from 'three';
import { registerTables, TH } from './chroma-vfx.js';
import { A11Y } from '../systems/a11y.js';

// Efectos de combate (sólo presentación; nunca tocan la simulación):
//   · Trails: estelas de arma/puño/pie durante la ventana que marca cada clip.
//   · Particles: chispas, llamas, gotas, rocas, polvo y viento (un único Points con shader propio, sin crear objetos por fotograma).
//   · Shapes: anillos de onda, medias lunas de viento, destellos y pinchos de roca (piscina de mallas reutilizables).
//   · Projectiles: apariencia de la Hidrolanza, la Marea Abisal y la Falla.
// La calidad gráfica (q.particles) y «reducir movimiento» limitan la cantidad.
const ELEM = {
  ignis: { a: new THREE.Color(0xffd27a), b: new THREE.Color(0xff4a12), c: new THREE.Color(0xff7a2a) },
  aqua: { a: new THREE.Color(0xe0fbff), b: new THREE.Color(0x2f8cff), c: new THREE.Color(0x7fe4ff) },
  terra: { a: new THREE.Color(0xd8ff9c), b: new THREE.Color(0x6e6656), c: new THREE.Color(0x9cff5a) },
  zephyr: { a: new THREE.Color(0xffffff), b: new THREE.Color(0x9cc8ff), c: new THREE.Color(0xd6ecff) },
};
export const elemOf = id => ELEM[id] || ELEM.zephyr;
registerTables({ elem: ELEM }); // los chromas cambian estos colores mientras se dibuja lo de su luchador (chroma-vfx.js)

const canvasTex = (s, draw) => { const c = document.createElement('canvas'); c.width = c.height = s; draw(c.getContext('2d'), s); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
const TEX = {};
function tex(name) {
  if (TEX[name]) return TEX[name];
  if (name === 'ring') TEX.ring = canvasTex(128, (x, s) => { const g = x.createRadialGradient(s / 2, s / 2, s * .3, s / 2, s / 2, s / 2); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(.7, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, s, s); });
  if (name === 'crescent') TEX.crescent = canvasTex(128, (x, s) => { x.translate(s / 2, s / 2); const g = x.createLinearGradient(-s / 2, 0, s / 2, 0); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(.5, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.beginPath(); x.arc(0, 8, s * .42, Math.PI * 1.08, Math.PI * 1.92); x.arc(0, 26, s * .36, Math.PI * 1.9, Math.PI * 1.1, true); x.fill(); });
  if (name === 'flash') TEX.flash = canvasTex(128, (x, s) => { x.translate(s / 2, s / 2); for (let i = 0; i < 8; i++) { x.rotate(Math.PI / 4); const g = x.createLinearGradient(0, 0, s / 2, 0); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.beginPath(); x.moveTo(0, -3 - (i % 2) * 2); x.lineTo(s / 2 * (i % 2 ? .6 : 1), 0); x.lineTo(0, 3 + (i % 2) * 2); x.fill(); } const r = x.createRadialGradient(0, 0, 0, 0, 0, s * .22); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = r; x.fillRect(-s / 2, -s / 2, s, s); });
  if (name === 'soft') TEX.soft = canvasTex(64, (x, s) => { const g = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.35, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, s, s); });
  return TEX[name];
}

// ───────── Estela: cinta entre dos anclas (base y punta) que se desvanece con la edad ─────────
const TRAIL_N = 40; // (v1.8) más puntos: la estela se interpola entre fotogramas
class Trail {
  constructor(scene, { life = .13, boost = 1 } = {}) {
    this.life = life; this.boost = boost;
    const g = new THREE.BufferGeometry(); this.pos = new Float32Array(TRAIL_N * 2 * 3); this.al = new Float32Array(TRAIL_N * 2);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); g.setAttribute('alpha', new THREE.BufferAttribute(this.al, 1));
    const idx = []; for (let i = 0; i < TRAIL_N - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } g.setIndex(idx);
    this.mat = new THREE.ShaderMaterial({
      uniforms: { c1: { value: new THREE.Color() }, c2: { value: new THREE.Color() } }, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
      vertexShader: 'attribute float alpha; varying float vA; varying float vS; void main(){ vA = alpha; vS = float(gl_VertexID % 2); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
      fragmentShader: 'uniform vec3 c1; uniform vec3 c2; varying float vA; varying float vS; void main(){ float e = smoothstep(0.,1.,vS); float edge = pow(e, 3.); gl_FragColor = vec4(mix(c2,c1,edge) * (0.5 + 1.2*edge), vA * (0.08 + 0.72*e*e)); }',
    });
    this.mesh = new THREE.Mesh(g, this.mat); this.mesh.frustumCulled = false; this.mesh.renderOrder = 8; scene.add(this.mesh);
    this.pts = []; this.on = false; this.k = 1;
  }
  push(base, tip, live, k) {
    if (live) {
      // (v1.8) curva entre muestras (Catmull-Rom): en golpes rápidos el barrido es una media luna, no un polígono quebrado
      const a = this.pts[0], z = this.pts[1];
      if (a && z && a.t.distanceTo(tip) > .12) for (const u of [.33, .67]) {
        const cr = (p0, p1, p2, p3) => { const u2 = u * u, u3 = u2 * u; return new THREE.Vector3().addScaledVector(p0, -.5 * u3 + u2 - .5 * u).addScaledVector(p1, 1.5 * u3 - 2.5 * u2 + 1).addScaledVector(p2, -1.5 * u3 + 2 * u2 + .5 * u).addScaledVector(p3, .5 * u3 - .5 * u2); };
        const tb = tip.clone().multiplyScalar(2).sub(a.t), bb = base.clone().multiplyScalar(2).sub(a.b);
        this.pts.unshift({ b: cr(z.b, a.b, base, bb), t: cr(z.t, a.t, tip, tb), age: 0 });
      }
      this.pts.unshift({ b: base.clone(), t: tip.clone(), age: 0 });
    }
    this.k = k;
    if (this.pts.length > TRAIL_N) this.pts.length = TRAIL_N;
  }
  update(dt) {
    for (const p of this.pts) p.age += dt; this.pts = this.pts.filter(p => p.age < this.life);
    const n = this.pts.length; this.mesh.visible = n >= 2;
    for (let i = 0; i < TRAIL_N; i++) {
      const p = this.pts[Math.min(i, n - 1)]; if (!p) break;
      this.pos.set([p.b.x, p.b.y, p.b.z], i * 6); this.pos.set([p.t.x, p.t.y, p.t.z], i * 6 + 3);
      const a = i < n ? Math.min(1, Math.pow(Math.max(0, 1 - p.age / this.life), 1.5) * (1 - i / TRAIL_N) * this.k * this.boost) : 0; this.al[i * 2] = a; this.al[i * 2 + 1] = a;
    }
    this.mesh.geometry.attributes.position.needsUpdate = true; this.mesh.geometry.attributes.alpha.needsUpdate = true;
  }
  dispose() { this.mesh.geometry.dispose(); this.mat.dispose(); this.mesh.removeFromParent(); }
}

// ───────── Partículas (pool fijo) ─────────
const PMAX = 900;
class Particles {
  constructor(scene) {
    const g = new THREE.BufferGeometry();
    this.p = new Float32Array(PMAX * 3); this.c = new Float32Array(PMAX * 3); this.s = new Float32Array(PMAX); this.a = new Float32Array(PMAX);
    g.setAttribute('position', new THREE.BufferAttribute(this.p, 3)); g.setAttribute('color', new THREE.BufferAttribute(this.c, 3));
    g.setAttribute('size', new THREE.BufferAttribute(this.s, 1)); g.setAttribute('alpha', new THREE.BufferAttribute(this.a, 1));
    this.mat = new THREE.ShaderMaterial({ uniforms: { map: { value: tex('soft') }, scale: { value: 400 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: 'attribute float size; attribute float alpha; attribute vec3 color; varying vec3 vC; varying float vA; uniform float scale; void main(){ vC = color; vA = alpha; vec4 mv = modelViewMatrix * vec4(position,1.); gl_PointSize = size * scale / -mv.z; gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'uniform sampler2D map; varying vec3 vC; varying float vA; void main(){ vec4 t = texture2D(map, gl_PointCoord); gl_FragColor = vec4(vC * t.rgb, t.a * vA); }' });
    this.pts = new THREE.Points(g, this.mat); this.pts.frustumCulled = false; this.pts.renderOrder = 9; scene.add(this.pts);
    this.list = Array.from({ length: PMAX }, () => ({ live: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, g: 0, drag: 0, life: 1, t: 0, s0: .1, s1: 0, c0: new THREE.Color(), c1: new THREE.Color() }));
    this.cap = PMAX; this.next = 0;
  }
  emit(o) {
    for (let k = 0; k < this.cap; k++) {
      const i = (this.next + k) % this.cap, q = this.list[i]; if (q.live) continue;
      this.next = (i + 1) % this.cap; Object.assign(q, { live: 1, t: 0, g: 0, drag: 1.5, ...o }); q.c0.copy(o.c0); q.c1.copy(o.c1 || o.c0); return q;
    }
    return null;
  }
  update(dt) {
    const { p, c, s, a } = this;
    for (let i = 0; i < PMAX; i++) {
      const q = this.list[i];
      if (!q.live) { a[i] = 0; s[i] = 0; continue; }
      q.t += dt; if (q.t >= q.life) { q.live = 0; a[i] = 0; continue; }
      const k = q.t / q.life, d = Math.exp(-q.drag * dt);
      q.vy -= q.g * dt; q.vx *= d; q.vy *= d; q.vz *= d; q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt;
      if (q.floor && q.y < .03) { q.y = .03; q.vy *= -.3; q.vx *= .6; }
      p[i * 3] = q.x; p[i * 3 + 1] = q.y; p[i * 3 + 2] = q.z;
      c[i * 3] = q.c0.r + (q.c1.r - q.c0.r) * k; c[i * 3 + 1] = q.c0.g + (q.c1.g - q.c0.g) * k; c[i * 3 + 2] = q.c0.b + (q.c1.b - q.c0.b) * k;
      s[i] = q.s0 + (q.s1 - q.s0) * k; a[i] = (k < .1 ? k / .1 : 1 - (k - .1) / .9) * (q.a0 ?? 1);
    }
    const g = this.pts.geometry.attributes; g.position.needsUpdate = g.color.needsUpdate = g.size.needsUpdate = g.alpha.needsUpdate = true;
  }
  dispose() { this.pts.geometry.dispose(); this.mat.dispose(); this.pts.removeFromParent(); }
}

// ───────── Formas (anillos, medias lunas, destellos, pinchos de roca) ─────────
class Shapes {
  constructor(scene) {
    this.scene = scene; this.items = [];
    this.rockGeo = new THREE.ConeGeometry(.28, 1, 5); this.rockGeo.translate(0, .5, 0);
    this.rockMat0 = new THREE.MeshToonMaterial({ color: 0x9a8e74, emissive: 0x1c2410 }); this.rockMats = new Map();
  }
  get rockMat() { // con chroma: la roca toma su color (y brilla un poco en su tono)
    const th = TH.cur; if (!th) return this.rockMat0; let m = this.rockMats.get(th.id);
    if (!m) { m = this.rockMat0.clone(); m.color.copy(th.c).lerp(new THREE.Color(0x9a8e74), .45); m.emissive.copy(th.b).multiplyScalar(.35); this.rockMats.set(th.id, m); }
    return m;
  }
  sprite(map, pos, { color, size = 1, grow = 2, life = .3, rot = 0, spin = 0, opacity = 1, flat = false, stretch = 1 }) {
    let m;
    if (flat) { m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: tex(map), color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false })); m.rotation.x = -Math.PI / 2; }
    else { m = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex(map), color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, rotation: rot, fog: false })); }
    m.position.copy(pos); m.renderOrder = 10; this.scene.add(m);
    this.items.push({ m, t: 0, life, size, grow, spin, opacity, flat, stretch }); return m;
  }
  rock(x, z, h, life = .7) {
    const m = new THREE.Mesh(this.rockGeo, this.rockMat); m.position.set(x, -.05, z); m.rotation.set((Math.random() - .5) * .5, Math.random() * 6, (Math.random() - .5) * .5); m.castShadow = true; this.scene.add(m);
    this.items.push({ m, t: 0, life, rock: h }); return m;
  }
  update(dt) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i]; it.t += dt; const k = it.t / it.life;
      if (k >= 1) { it.m.removeFromParent(); if (!it.rock) { it.m.material.dispose(); it.m.geometry?.dispose?.(); } this.items.splice(i, 1); continue; }
      if (it.rock) { const up = k < .15 ? k / .15 : k > .7 ? 1 - (k - .7) / .3 : 1; it.m.scale.set(.8 + up * .4, Math.max(.01, up * it.rock), .8 + up * .4); continue; }
      const s = it.size * (1 + (it.grow - 1) * (1 - Math.pow(1 - k, 2)));
      if (it.flat) it.m.scale.set(s, s, 1); else it.m.scale.set(s * it.stretch, s, 1);
      it.m.material.opacity = it.opacity * (1 - k * k); if (it.spin && it.m.material.rotation !== undefined) it.m.material.rotation += it.spin * dt;
    }
  }
  dispose() { for (const it of this.items) { it.m.removeFromParent(); if (!it.rock) it.m.material.dispose(); } this.items = []; this.rockGeo.dispose(); this.rockMat0.dispose(); for (const m of this.rockMats.values()) m.dispose(); this.rockMats.clear(); }
}

const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _b = new THREE.Vector3(), _t = new THREE.Vector3();
const rnd = (a, b) => a + Math.random() * (b - a);

export class Vfx {
  constructor(scene, q = { particles: 300 }, reduce = false) {
    this.scene = scene; this.parts = new Particles(scene); this.shapes = new Shapes(scene); this.trails = new Map(); this.proj = new Map();
    this.setQuality(q, reduce);
  }
  setQuality(q, reduce) { this.mult = Math.max(.25, Math.min(1.5, (q?.particles ?? 300) / 300)) * (reduce ? .5 : 1); this.reduce = reduce; }
  n(k) { return Math.max(1, Math.round(k * this.mult)); }

  // ── estelas: anchors = { wF:{base,tip}, ... } del luchador; active = lista {at, k} del director ──
  trail(owner, anchors, active, colors) {
    for (const key of ['wF', 'wB', 'hF', 'hB', 'fF', 'fB']) {
      const id = owner + key, on = active.find(a => a.at === key), A = anchors[key];
      let tr = this.trails.get(id);
      if (!on && !tr) continue;
      if (!tr) { tr = new Trail(this.scene, key[0] === 'w' ? { life: .22, boost: 1.35 } : {}); this.trails.set(id, tr); } // armas: estela más larga y luminosa
      tr.mat.uniforms.c1.value.copy(colors.a); tr.mat.uniforms.c2.value.copy(colors.b);
      if (on && A) { A.base.getWorldPosition(_b); A.tip.getWorldPosition(_t); if (key[0] !== 'w') _t.addScaledVector(_w.copy(_t).sub(_b).normalize(), .25); tr.push(_b, _t, true, on.k); }
    }
  }

  // ── ráfaga de partículas genérica ──
  burst(pos, E, { n = 12, speed = 4, up = 0, g = 0, life = .45, size = .25, size1 = 0, spread = 1, drag = 2, floor = false, dir = null, cA = E.a, cB = E.b, z = .3 }) {
    for (let i = 0; i < this.n(n); i++) {
      _v.set(rnd(-1, 1), rnd(-1, 1) * spread, rnd(-1, 1) * .4).normalize().multiplyScalar(speed * rnd(.4, 1));
      if (dir) _v.add(_w.copy(dir).multiplyScalar(speed * rnd(.3, 1)));
      this.parts.emit({ x: pos.x + rnd(-.1, .1), y: pos.y + rnd(-.1, .1), z: pos.z + rnd(-z, z) * .3, vx: _v.x, vy: _v.y + up, vz: _v.z, g, life: life * rnd(.6, 1.2), s0: size * rnd(.7, 1.3), s1: size1, drag, floor, c0: cA, c1: cB });
    }
  }

  // ── impacto de un golpe ──
  hit(pos, who, { blocked = false, power = 1, counter = false, armored = false } = {}) {
    const E = elemOf(who), P = _v.set(pos.x, pos.y, .6);
    if (blocked) {
      this.shapes.sprite('ring', P, { color: 0x9cc8ff, size: .5, grow: 3, life: .2, opacity: .9 });
      this.burst(P, ELEM.zephyr, { n: 8, speed: 5, life: .2, size: .12, cA: new THREE.Color(0xbfe0ff), cB: new THREE.Color(0x4a7cff) });
      return;
    }
    this.shapes.sprite('flash', P, { color: counter ? 0xfff2a0 : 0xffffff, size: .9 + power * .9, grow: 1.8, life: .16, rot: Math.random() * 6 });
    this.shapes.sprite('ring', P, { color: E.c, size: .4, grow: 4 + power * 2, life: .28, opacity: .85 });
    if (armored) this.shapes.sprite('ring', P, { color: 0x9cff5a, size: 1, grow: 2.5, life: .3 });
    this.element(P, who, power);
  }
  element(P, who, power = 1) {
    const E = elemOf(who), k = .6 + power * .7;
    if (who === 'ignis') this.burst(P, E, { n: 14 * k, speed: 5, up: 2.5, g: -3, life: .45, size: .32, size1: .05, drag: 3 });
    else if (who === 'aqua') this.burst(P, E, { n: 16 * k, speed: 5.5, up: 3, g: 14, life: .55, size: .18, size1: .1, drag: .8 });
    else if (who === 'terra') { this.burst(P, E, { n: 12 * k, speed: 5, up: 4, g: 22, life: .7, size: .2, size1: .16, drag: .5, floor: true, cA: new THREE.Color(0xa09070), cB: new THREE.Color(0x5a5040) }); this.burst(P, E, { n: 5 * k, speed: 2, life: .35, size: .35, cA: E.c, cB: E.b }); }
    else { this.burst(P, E, { n: 12 * k, speed: 7, life: .3, size: .14, size1: 0, spread: .4, drag: 4 }); this.shapes.sprite('crescent', _w.copy(P), { color: 0xd6ecff, size: 1.2, grow: 1.8, life: .25, rot: Math.random() * 6 }); }
  }

  // ── efectos pedidos por los clips (cues) ──
  cue(c, who, at, facing, root) {
    const E = elemOf(who), P = _v.copy(at); P.z = Math.max(P.z, .3);
    switch (c.kind) {
      case 'ignite': this.burst(P, E, { n: 14, speed: 1.5, up: 2, g: -2, life: .5, size: .3, size1: .02 }); break;
      case 'flame_arc': case 'fire_burst': this.burst(P, E, { n: 22, speed: 5, up: 1.5, g: -3, life: .45, size: .4, size1: .05, drag: 3 }); this.shapes.sprite('flash', P, { color: E.c, size: 1, grow: 2, life: .2 }); break;
      case 'embers_floor': this.burst(_w.set(P.x, .1, P.z), E, { n: 16, speed: 3, up: 2, g: -1, life: .6, size: .25, spread: .3 }); break;
      case 'flame_pillar': for (let i = 0; i < 4; i++) this.burst(_w.set(P.x, .3 + i * .7, P.z), E, { n: 8, speed: 1.5, up: 4, g: -3, life: .45, size: .45, size1: .05 }); break;
      case 'fire_dash': this.burst(_w.set(root.x, 1.5, .4), E, { n: 26, speed: 3, dir: _t.set(-facing * 6, 1, 0), life: .5, size: .45, size1: .05 }); break;
      case 'explosion': this.shapes.sprite('flash', P, { color: 0xffe0a0, size: 2.4, grow: 2.2, life: .3 }); this.shapes.sprite('ring', _w.set(P.x, .08, P.z), { color: E.c, size: 1, grow: 6, life: .4, flat: true }); this.burst(P, E, { n: 40, speed: 8, up: 3, g: -2, life: .6, size: .5, size1: .05, drag: 2.5 }); break;
      case 'impact': this.shapes.sprite('flash', P, { color: 0xffffff, size: .8, grow: 1.6, life: .14 }); break;
      case 'splash_arc': case 'water_spear': this.burst(P, E, { n: 18, speed: 4, up: 2, g: 12, life: .55, size: .16, size1: .08, drag: .8, dir: _t.set(facing * 4, 0, 0) }); break;
      case 'splash_floor': this.burst(_w.set(P.x, .1, P.z), E, { n: 18, speed: 3, up: 4, g: 14, life: .6, size: .16, spread: .3, floor: true }); this.shapes.sprite('ring', _w.set(P.x, .06, P.z), { color: E.c, size: .5, grow: 4, life: .4, flat: true }); break;
      case 'water_pillar': for (let i = 0; i < 5; i++) this.burst(_w.set(P.x, .2 + i * .6, P.z), E, { n: 8, speed: 1.5, up: 5, g: 9, life: .55, size: .22, size1: .1 }); break;
      case 'water_charge': for (let i = 0; i < this.n(14); i++) { const a = Math.random() * 6.28, r = rnd(.8, 1.3); this.parts.emit({ x: P.x + Math.cos(a) * r, y: P.y + Math.sin(a) * r, z: P.z, vx: -Math.cos(a) * r * 3.5, vy: -Math.sin(a) * r * 3.5, vz: 0, life: .28, s0: .18, s1: .3, drag: 0, c0: E.a, c1: E.b }); } break;
      case 'water_burst': case 'tide_burst': this.shapes.sprite('ring', P, { color: E.c, size: .6, grow: 4, life: .3 }); this.burst(P, E, { n: c.kind === 'tide_burst' ? 34 : 18, speed: 6, dir: _t.set(facing * 5, 0, 0), g: 8, life: .5, size: .2, size1: .1 }); break;
      case 'water_swirl': for (let i = 0; i < this.n(24); i++) { const a = i / 24 * 6.28; this.parts.emit({ x: root.x + Math.cos(a) * .9, y: .2 + i * .1, z: Math.sin(a) * .9 + .2, vx: -Math.sin(a) * 2, vy: 1.5, vz: Math.cos(a) * 2, life: 1, s0: .2, s1: .05, drag: .5, c0: E.a, c1: E.b }); } break;
      case 'rock_impact': this.burst(P, E, { n: 14, speed: 4, up: 3, g: 20, life: .6, size: .18, size1: .14, floor: true, cA: new THREE.Color(0xa09070), cB: new THREE.Color(0x5a5040) }); break;
      case 'rock_spikes': for (let i = 0; i < 3; i++) this.shapes.rock(root.x + facing * (.7 + i * .45), rnd(-.3, .2), .8 + i * .3, .6); break;
      case 'stone_glow': this.burst(_w.set(root.x, 1.5, .3), E, { n: 18, speed: 2.5, life: .5, size: .3, cA: E.c, cB: E.b }); break;
      case 'dust': this.burst(_w.set(P.x, .1, P.z), E, { n: 10, speed: 2, up: 1, g: 1, life: .5, size: .4, size1: .7, spread: .3, cA: new THREE.Color(0x6a6458), cB: new THREE.Color(0x2a2620), z: 1 }); break;
      case 'quake': case 'quake_big': {
        const big = c.kind === 'quake_big', x0 = P.x;
        this.shapes.sprite('ring', _w.set(x0, .06, 0), { color: E.c, size: 1, grow: big ? 9 : 6, life: .45, flat: true });
        for (let i = 0; i < (big ? 6 : 4); i++) this.shapes.rock(x0 + rnd(-1.2, 1.2), rnd(-.6, .4), rnd(.4, big ? 1.2 : .8), .55);
        this.burst(_w.set(x0, .1, 0), E, { n: big ? 30 : 18, speed: 5, up: 4, g: 22, life: .7, size: .2, size1: .15, floor: true, spread: .4, cA: new THREE.Color(0xa09070), cB: new THREE.Color(0x5a5040) });
        this.dust(x0, big ? 1.6 : 1); break; }
      case 'wind_x': case 'wind_ring': case 'wind_burst': case 'wind_vanish': {
        const W = elemOf('zephyr');
        if (c.kind === 'wind_x') { this.shapes.sprite('crescent', _w.copy(P).setX(P.x + facing * .8), { color: 0xd6ecff, size: 1.6, grow: 1.6, life: .28, rot: .8 }); this.shapes.sprite('crescent', _w.copy(P).setX(P.x + facing * .8), { color: 0xd6ecff, size: 1.6, grow: 1.6, life: .28, rot: -.8 + Math.PI }); }
        else if (c.kind === 'wind_ring') this.shapes.sprite('ring', P, { color: 0xe3f0ff, size: .8, grow: 3.5, life: .3, stretch: 1.6 });
        else if (c.kind === 'wind_vanish') { this.shapes.sprite('ring', _w.set(root.x, 1.6, .4), { color: 0xe3f0ff, size: 1.4, grow: 2.5, life: .3 }); this.burst(_w.set(root.x, 1.5, .4), W, { n: 24, speed: 6, life: .35, size: .2, spread: 1 }); }
        else this.burst(_w.set(P.x, .2, P.z), W, { n: 16, speed: 5, life: .35, size: .18, spread: .3 });
        break; }
      case 'tornado': for (let i = 0; i < this.n(40); i++) { const a = i * .6, y = i * .07; this.parts.emit({ x: root.x + Math.cos(a) * (.6 + y * .2), y: .1 + y, z: Math.sin(a) * .6 + .2, vx: -Math.sin(a) * 4, vy: 2, vz: Math.cos(a) * 4, life: .6, s0: .2, s1: .05, drag: 1, c0: elemOf('zephyr').a, c1: elemOf('zephyr').b }); } break;
      case 'land': if ((c.k || 0) > .4) this.dust(root.x, c.k * .7); break;
    }
  }
  dust(x, k = 1) { this.burst(_w.set(x, .1, .2), ELEM.terra, { n: 10 * k, speed: 2.5, up: .8, g: 1, life: .55, size: .45, size1: .8, spread: .25, z: 1, cA: new THREE.Color(0x4a4a58), cB: new THREE.Color(0x18181e) }); }
  flash(pos, color, size = 2.5) { if (A11Y.reduceFlash) size *= .5; // (F9) reducir destellos
    this.shapes.sprite('flash', _v.set(pos.x, pos.y, .7), { color, size, grow: 1.6, life: .22 }); this.shapes.sprite('ring', _v, { color, size: 1, grow: 4, life: .35 }); }
  aura(root, who) { const E = elemOf(who); this.burst(_w.set(root.x + rnd(-.3, .3), rnd(.3, 2.8), .3), E, { n: 2, speed: .6, up: 1.8, g: -1, life: .5, size: .22, size1: 0, drag: 1 }); }

  // ── proyectiles: crea / actualiza / quita su apariencia ──
  projectile(p) {
    let v = this.proj.get(p);
    const E = elemOf(p.owner.def.id);
    if (!v) {
      const g = new THREE.Group(); g.renderOrder = 9;
      if (p.kind === 'rock') { v = { g, kind: 'rock', next: 0 }; }
      else {
        const big = p.kind === 'tide', core = new THREE.Mesh(new THREE.SphereGeometry(big ? .55 : .38, 16, 12), new THREE.MeshBasicMaterial({ color: E.c, transparent: true, opacity: .55, blending: THREE.AdditiveBlending, depthWrite: false }));
        core.scale.set(1.5, 1, 1); g.add(core);
        const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex('soft'), color: E.b, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); glow.scale.setScalar(big ? 2.8 : 1.8); g.add(glow);
        const ring = new THREE.Mesh(new THREE.TorusGeometry(big ? .7 : .45, .05, 6, 24), new THREE.MeshBasicMaterial({ color: E.a, transparent: true, opacity: .7, blending: THREE.AdditiveBlending, depthWrite: false })); ring.rotation.y = Math.PI / 2; g.add(ring);
        v = { g, core, ring, kind: p.kind };
      }
      this.scene.add(g); this.proj.set(p, v);
    }
    v.g.position.set(p.x, p.y, 0);
    if (v.kind === 'rock') { // la falla: pinchos que brotan a su paso
      if (p.t >= v.next) { v.next = p.t + (this.reduce ? .1 : .055); this.shapes.rock(p.x + rnd(-.15, .15), rnd(-.25, .25), rnd(.5, .9) * (p.def.launch ? 1.5 : 1), .42); this.burst(_w.set(p.x, .1, .2), E, { n: 3, speed: 2, up: 2, g: 18, life: .45, size: .16, size1: .12, floor: true, cA: new THREE.Color(0xa09070), cB: new THREE.Color(0x5a5040) }); }
    } else {
      const s = 1 + Math.sin(p.t * 30) * .08; v.core.scale.set(1.5 * s, s, s); v.ring.rotation.x += .3; v.ring.scale.setScalar(1 + (p.t * 3 % 1) * .4);
      if (Math.random() < .8) this.parts.emit({ x: p.x - p.dir * .3, y: p.y + rnd(-.2, .2), z: rnd(-.1, .2), vx: -p.dir * 2, vy: rnd(-1, 1), vz: 0, g: 6, life: .4, s0: .16, s1: .05, drag: 1, c0: E.a, c1: E.b });
    }
  }
  projectileEnd(p, how) {
    const v = this.proj.get(p); if (!v) return; this.proj.delete(p);
    v.g.removeFromParent(); v.g.traverse(o => { if (o.isMesh || o.isSprite) { o.geometry?.dispose?.(); o.material.dispose(); } });
    if (how && v.kind !== 'rock') this.burst(_w.set(p.x, p.y, .3), elemOf(p.owner.def.id), { n: 16, speed: 4, g: 10, life: .45, size: .2, size1: .08 });
  }

  update(dt) { this.parts.update(dt); this.shapes.update(dt); for (const t of this.trails.values()) t.update(dt); }
  dispose() { this.parts.dispose(); this.shapes.dispose(); for (const t of this.trails.values()) t.dispose(); this.trails.clear(); for (const p of [...this.proj.keys()]) this.projectileEnd(p); }
}
