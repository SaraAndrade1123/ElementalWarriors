import * as THREE from 'three';
import { makeWeaponModel } from './animation/weapon-art.js';

// Efectos de las ARMAS (solo presentación): proyectiles con forma de arma (cuchillo, boleadoras, bumerán, flecha) que giran y
// dejan una estela del elemento de quien los lanzó, y las señales de los clips (sacar, liberar, ráfaga, golpe, guardar, rompeguardia).
// Se engancha a la instancia de Vfx del combate igual que bending-vfx.js (no modifica vfx.js).
export const W_KINDS = ['w_knife', 'w_bola', 'w_boomerang', 'w_arrow'];
const BY_EL = { // señal del clip → efecto existente en vfx.js según el elemento
  w_release: { fire: 'fire_burst', water: 'water_burst', wind: 'wind_burst', earth: 'rock_impact' },
  w_gust: { fire: 'flame_arc', water: 'splash_arc', wind: 'wind_x', earth: 'dust' },
  w_smash: { fire: 'explosion', water: 'water_pillar', wind: 'wind_ring', earth: 'quake' },
  gb_charge: { fire: 'ignite', water: 'water_charge', wind: 'wind_x', earth: 'stone_glow' },
  gb_burst: { fire: 'fire_burst', water: 'water_burst', wind: 'wind_burst', earth: 'rock_impact' },
};
const rnd = (a, b) => a + Math.random() * (b - a);
let SOFT = null; // halo redondo (sin textura un sprite se ve como un cuadrado)
const soft = () => { if (SOFT) return SOFT; const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.4, 'rgba(255,255,255,.45)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); SOFT = new THREE.CanvasTexture(c); return SOFT; };

export class WeaponVfx {
  // V: Vfx del combate · elOf(id) → 'fire' | 'water' | 'wind' | 'earth' · colorOf(id) → color del elemento (hex)
  constructor(V, scene, elOf, colorOf) { this.V = V; this.scene = scene; this.elOf = elOf; this.colorOf = colorOf; this.proj = new Map(); }
  cue(c, who, at, facing, root) {
    const V = this.V, el = this.elOf(who), map = BY_EL[c.kind];
    if (map) { V.cue({ ...c, kind: map[el] || map.earth }, who, at, facing, root); if (c.kind === 'gb_burst' || c.kind === 'w_smash') V.flash?.({ x: at.x, y: at.y }, this.colorOf(who), 2.4); return true; }
    const E = { a: new THREE.Color(0xffffff), b: new THREE.Color(this.colorOf(who)) };
    switch (c.kind) {
      case 'w_draw': V.burst(at, E, { n: 10, speed: 1.6, up: .6, g: 0, life: .3, size: .18, size1: 0, spread: .6, cA: E.a, cB: E.b }); V.shapes?.sprite('flash', at, { color: E.b, size: .5, grow: 1.6, life: .14 }); return true;
      case 'w_stow': V.burst(at, E, { n: 6, speed: 1, up: .4, life: .25, size: .14, size1: 0, cA: E.a, cB: E.b }); return true;
      case 'w_vanish': V.burst(at, E, { n: 22, speed: 2.2, up: 1.2, g: -1, life: .55, size: .22, size1: 0, spread: 1, cA: E.a, cB: E.b }); return true;
    }
    return false;
  }
  projectile(p) {
    let v = this.proj.get(p);
    if (!v) {
      const col = this.colorOf(p.owner.def.id), g = new THREE.Group(); g.renderOrder = 9;
      let m;
      if (p.kind === 'w_knife') m = makeWeaponModel('dagger', col, { aura: true });
      else if (p.kind === 'w_bola') m = makeWeaponModel('bola', col, { aura: true });
      else if (p.kind === 'w_boomerang') m = makeWeaponModel('boomerang', col, { aura: true });
      else { // flecha
        const a = new THREE.Group(), shaft = new THREE.Mesh(new THREE.CylinderGeometry(.016, .016, .95, 6), new THREE.MeshToonMaterial({ color: 0x8a6a42 })); shaft.position.y = .1; a.add(shaft);
        const head = new THREE.Mesh(new THREE.ConeGeometry(.05, .16, 6), new THREE.MeshBasicMaterial({ color: col, toneMapped: false })); head.position.y = .64; a.add(head);
        for (const s of [-1, 1]) { const f = new THREE.Mesh(new THREE.PlaneGeometry(.08, .16), new THREE.MeshBasicMaterial({ color: 0xf2e9d8, side: THREE.DoubleSide })); f.position.set(s * .04, -.3, 0); f.rotation.z = s * .3; a.add(f); }
        m = { g: a };
      }
      m.g.traverse(o => { if (o.isMesh) o.frustumCulled = false; });
      const inner = new THREE.Group(); inner.add(m.g);
      if (p.kind === 'w_knife') m.g.scale.setScalar(1.1); if (p.kind === 'w_bola') m.g.position.y = -.3; if (p.kind === 'w_boomerang') m.g.position.set(-.2, -.25, 0);
      g.add(inner); this.scene.add(g);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: soft(), color: col, transparent: true, opacity: .55, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); glow.scale.setScalar(.7); g.add(glow);
      v = { g, inner, col: new THREE.Color(col), spin: 0 }; this.proj.set(p, v);
    }
    v.g.position.set(p.x, p.y, 0);
    const dir = Math.sign(p.vx) || p.dir || 1;
    if (p.kind === 'w_knife' || p.kind === 'w_arrow') { const vy = p.def.vy || 0; v.inner.rotation.set(0, 0, -Math.PI / 2 * dir + Math.atan2(vy, Math.abs(p.vx)) * dir); }
    else { v.spin += (p.kind === 'w_bola' ? 18 : 22) * (1 / 60); v.inner.rotation.set(0, 0, -v.spin * dir); }
    if (Math.random() < .7) this.V.parts?.emit({ x: p.x - dir * .25, y: p.y + rnd(-.1, .1), z: rnd(-.1, .15), vx: -dir * 1.5, vy: rnd(-.5, .5), vz: 0, g: 0, life: .3, s0: .14, s1: 0, drag: 2, c0: new THREE.Color(0xffffff), c1: v.col });
  }
  projectileEnd(p, how) {
    const v = this.proj.get(p); if (!v) return; this.proj.delete(p);
    v.g.removeFromParent(); v.g.traverse(o => { if (o.isMesh || o.isSprite) { if (o.isMesh) o.geometry?.dispose?.(); o.material.dispose(); } });
    if (how) this.V.burst(new THREE.Vector3(p.x, p.y, .3), { a: new THREE.Color(0xffffff), b: v.col }, { n: p.caught ? 8 : 14, speed: 3, g: 6, life: .35, size: .16, size1: .04, cA: new THREE.Color(0xffffff), cB: v.col });
  }
  // (v1.8) impacto propio de cada tipo de arma: filo → tajo en cruz · contundente → onda de choque · punta → estocada
  impact(pos, kind, who, dir = 1, power = 1) {
    const V = this.V, col = new THREE.Color(this.colorOf(who)), P = new THREE.Vector3(pos.x, pos.y, .65), W = new THREE.Color(0xffffff);
    const blunt = kind === 'mace' || kind === 'bola', pierce = kind === 'bow' || kind === 'knives';
    if (blunt) {
      V.shapes?.sprite('ring', P, { color: col.getHex(), size: .6, grow: 5 + power * 2, life: .32, opacity: .95 });
      V.shapes?.sprite('ring', new THREE.Vector3(pos.x, .06, .3), { color: col.getHex(), size: .8, grow: 6, life: .45, flat: true });
      V.burst(P, { a: W, b: col }, { n: 18, speed: 6, up: 3, g: 14, life: .5, size: .2, size1: .06, cA: W, cB: col });
    } else if (pierce) {
      for (let i = 0; i < 10; i++) V.parts?.emit({ x: P.x - dir * .2, y: P.y + rnd(-.06, .06), z: P.z, vx: dir * rnd(9, 15), vy: rnd(-.6, .6), vz: 0, drag: 6, life: rnd(.14, .24), s0: .16, s1: 0, c0: W, c1: col });
      V.shapes?.sprite('ring', P, { color: col.getHex(), size: .35, grow: 3, life: .2, stretch: 1.8 });
    } else {
      for (const r of [.75, -.75]) V.shapes?.sprite('crescent', P.clone(), { color: r > 0 ? W.getHex() : col.getHex(), size: 1.3 + power * .4, grow: 1.5, life: .24, rot: r + (dir < 0 ? Math.PI : 0) });
      V.burst(P, { a: W, b: col }, { n: 12, speed: 6, dir: new THREE.Vector3(dir * 3, .6, 0), life: .3, size: .16, size1: 0, drag: 4, cA: W, cB: col });
    }
    V.shapes?.sprite('flash', P, { color: 0xffffff, size: .7 + power * .5, grow: 1.6, life: .12 });
  }
  update() {}
  dispose() { for (const p of [...this.proj.keys()]) this.projectileEnd(p); }
}
