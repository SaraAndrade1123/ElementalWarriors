import * as THREE from 'three';
import { Rig } from './rig.js';
import { Springs } from './springs.js';
import { styleFor } from './styles.js';
import { Director } from './director.js';
import { WeaponSet } from './weapons.js';
import { IDX } from './pose.js';

const _vel = new THREE.Vector3(), AY = new THREE.Vector3(0, 1, 0);

// Anima a un guerrero: el Director decide la pose, el Rig la aplica al esqueleto y Springs mueve pelo/telas.
export class Animator {
  // armed: true = el arma clásica del guerrero en la mano (hasta v0.8). Desde v0.9 los golpes normales son sin arma;
  // las armas se compran en la tienda y salen solo en su técnica (ver js/game/animation/weapon-art.js).
  constructor(root, holder, id, { facing = 1, armed = false } = {}) {
    this.rig = new Rig(root, holder); this.rig.springs = new Springs(this.rig);
    this.S = styleFor(id); this.id = id; this.lead = facing === 1 ? -1 : 1; // el lado que mira a la cámara lidera
    const rh = this.rig.restHand.L;
    this.dir = new Director(this.S, { legLen: this.rig.legLen, rest: { x: Math.abs(rh.x), y: rh.y, z: rh.z } });
    try { this.weapons = new WeaponSet(this.rig, holder, id, { ghost: !armed }); this.weapons.setLead(this.lead); } catch (e) { console.warn('[anim] arma', id, e); this.weapons = null; }
  }
  // Anclas para las estelas: arma (wF/wB), manos (hF/hB) y pies (fF/fB) según el lado adelantado actual.
  anchors() {
    const R = this.rig, B = i => R.bones[R.I[i]], F = this.lead > 0 ? 'L' : 'R', K = F === 'L' ? 'R' : 'L', w = this.weapons;
    return {
      wF: w?.F ? w.F : { base: B('fa' + F), tip: B('ha' + F) }, wB: w?.B && w.hands.includes('B') ? w.B : { base: B('fa' + K), tip: B('ha' + K) },
      hF: { base: B('fa' + F), tip: B('ha' + F) }, hB: { base: B('fa' + K), tip: B('ha' + K) },
      fF: { base: B('ca' + F), tip: B('fo' + F) }, fB: { base: B('ca' + K), tip: B('fo' + K) }, head: { base: B('neck'), tip: B('head') },
    };
  }
  reset() { this.rig.reset(); this.rig.springs.reset(); this.dir.reset(); }
  setReduce(on) { this.dir.reduce = !!on; this.rig.springs.gain = on ? .35 : 1; this.rig.springs.sway = on ? .3 : 1; }
  // dt = 0 (hit-stop) congela la pose; en cámara lenta del KO llega dt reducido y todo va a cámara lenta.
  update(dt, f, env = {}) {
    if (dt <= 0) return;
    // Animación «por pasos» (anime 3D de los juegos de lucha): golpes, gestos y reacciones se muestran a stepFps
    // poses por segundo; caminar y el reposo siguen fluidos. El movimiento por la pantalla nunca se escalona.
    if (this.stepFps > 0 && !this.dir.reduce && (f.act || env.action || (f.stun > 0 && f.stunType !== 'block'))) {
      this.acc = (this.acc || 0) + dt; if (this.acc < 1 / this.stepFps && this.pose) return; dt = this.acc; this.acc = 0;
    } else this.acc = 0;
    dt = Math.min(dt, 1 / 10); // aunque el equipo vaya lento, la animación va a tiempo real (los muelles se subdividen solos)
    const P = this.dir.compose(dt, f, env);
    _vel.set(f.vx || 0, f.vy || 0, 0).applyAxisAngle(AY, -(env.yaw || 0));
    this.rig.apply(P, { lead: this.lead, vel: _vel, dt, t: this.dir.t });
    if (this.weapons) { this.weapons.setLead(this.lead); this.weapons.spin(P[IDX.wpSpin], P[IDX.wpSpin]); }
    this.pose = P;
  }
}
