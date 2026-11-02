import * as THREE from 'three';

// Física secundaria: pelo, telas, falda y capa. Cada hueso es un muelle amortiguado que sigue la
// inercia del punto donde nace (cuerpo + movimiento de la extremidad) y se curva en sentido contrario.
const TYPES = [
  [/^hair/i,    { k: 46, c: 5.5, g: .055, sway: .05, max: .9 }],
  [/^acchair/i, { k: 30, c: 3.6, g: .075, sway: .09, max: 1.1 }],
  [/^skirt/i,   { k: 36, c: 5.2, g: .05,  sway: .03, max: .8 }],
  [/^cloth/i,   { k: 30, c: 4.2, g: .07,  sway: .06, max: 1 }],
  [/^mangto/i,  { k: 16, c: 2.8, g: .11,  sway: .1,  max: 1.3 }],
  [/^Dummy/i,   { k: 30, c: 4.2, g: .07,  sway: .05, max: 1 }],
];
const _r = new THREE.Vector3(), _t = new THREE.Vector3(), _n = new THREE.Vector3();

export class Springs {
  constructor(rig) {
    this.rig = rig; this.items = new Map(); this.gain = 1; this.sway = 1;
    const canon = n => n.replace(/_\d+$/, '');
    const dirs = new Map();
    for (const i of rig.sec) {
      const kid = rig.kids[i].find(j => rig.kind[j] !== 0 && rig.sec.includes(j)) ?? rig.kids[i][0];
      if (kid !== undefined) dirs.set(i, rig.P0[kid].clone().sub(rig.P0[i]).normalize());
    }
    for (const i of rig.sec) { // los huesos punta heredan la dirección de su padre
      let r = dirs.get(i), p = rig.parent[i];
      while (!r && p >= 0) { r = dirs.get(p); p = rig.parent[p]; }
      const nm = canon(rig.bones[i].name), cfg = (TYPES.find(([re]) => re.test(nm)) || TYPES[3])[1];
      const depth = (() => { let d = 0; for (let q = rig.parent[i]; q >= 0 && rig.sec.includes(q); q = rig.parent[q]) d++; return d; })();
      this.items.set(i, { r: (r || new THREE.Vector3(0, -1, 0)).clone(), s: new THREE.Vector3(), v: new THREE.Vector3(), prev: null, cfg, ph: Math.random() * 6.28, depth });
    }
  }
  reset() { for (const it of this.items.values()) { it.s.set(0, 0, 0); it.v.set(0, 0, 0); it.prev = null; } }

  // ctx.vel: velocidad del cuerpo en el espacio del modelo; ctx.dt; ctx.t
  solve(i, Pn, Dp, ctx, out) {
    const it = this.items.get(i), { cfg } = it, dt = Math.min(ctx.dt || 1 / 60, 1 / 30);
    if (!it.prev) it.prev = Pn.clone();
    _t.copy(Pn).sub(it.prev).divideScalar(dt).add(ctx.vel); it.prev.copy(Pn);
    if (_t.lengthSq() > 400) _t.setLength(20);
    // objetivo: opuesto al movimiento + oleaje suave; las puntas se retrasan más
    const g = cfg.g * this.gain * (1 + it.depth * .35);
    _t.multiplyScalar(-g);
    const sw = cfg.sway * this.sway * (1 + it.depth * .4), t = ctx.t;
    _t.x += Math.sin(t * 1.7 + it.ph) * sw * .5; _t.z += Math.cos(t * 1.3 + it.ph * 1.7) * sw;
    const steps = Math.ceil(dt / (1 / 120)), h = dt / steps;
    for (let k = 0; k < steps; k++) {
      it.v.addScaledVector(_n.copy(it.s).sub(_t), -cfg.k * h).addScaledVector(it.v, -cfg.c * h);
      it.s.addScaledVector(it.v, h);
    }
    if (it.s.length() > cfg.max) it.s.setLength(cfg.max);
    _r.copy(it.r).applyQuaternion(Dp);
    _n.copy(_r).add(it.s).normalize();
    return out.setFromUnitVectors(_r, _n);
  }
}
