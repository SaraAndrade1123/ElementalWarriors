import * as THREE from 'three';
import { IDX } from './pose.js';

// Esqueleto «Bip001» compartido por los 4 guerreros. Las poses se resuelven en el ESPACIO DEL PERSONAJE
// (X izquierda, Y arriba, Z delante), así los ejes locales de cada hueso no importan:
//   · cada hueso recibe una rotación «delta» en ejes del personaje, acumulada sobre la de su padre;
//   · piernas y brazos se resuelven con IK de dos huesos (pies plantados, manos que alcanzan);
//   · pelo, telas y falda los mueve el sistema de muelles (springs.js).
const canon = n => n.replace(/_\d+$/, '');
const NAME = {
  com: 'Bip001', pel: 'Bip001_Pelvis', sp0: 'Bip001_Spine', sp1: 'Bip001_Spine1', sp2: 'Bip001_Spine2', neck: 'Bip001_Neck', head: 'Bip001_Head',
  thL: 'Bip001_L_Thigh', caL: 'Bip001_L_Calf', foL: 'Bip001_L_Foot', thR: 'Bip001_R_Thigh', caR: 'Bip001_R_Calf', foR: 'Bip001_R_Foot',
  clL: 'Bip001_L_Clavicle', uaL: 'Bip001_L_UpperArm', faL: 'Bip001_L_Forearm', haL: 'Bip001_L_Hand',
  clR: 'Bip001_R_Clavicle', uaR: 'Bip001_R_UpperArm', faR: 'Bip001_R_Forearm', haR: 'Bip001_R_Hand'
};
const K = { NONE: 0, COM: 1, PEL: 2, SP0: 3, SP1: 4, SP2: 5, NECK: 6, HEAD: 7, CL: 8, THIGH: 9, UARM: 10, FINGER: 11, SEC: 12 };
const SEC_RE = /^(hair|cloth|skirt|acchair|mangto|Dummy)/i;

const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1);
const qI = new THREE.Quaternion(), _d = new THREE.Quaternion();
const _a = new THREE.Quaternion(), _b = new THREE.Quaternion(), _c = new THREE.Quaternion();
const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _dir = new THREE.Vector3(), _perp = new THREE.Vector3(), _K = new THREE.Vector3(), _E = new THREE.Vector3(), _u1 = new THREE.Vector3(), _u2 = new THREE.Vector3(), _T = new THREE.Vector3(), _pole = new THREE.Vector3();
const rot = (axis, ang, out) => out.setFromAxisAngle(axis, ang);
// rotación compuesta yaw(Y) · pitch(X) · roll(Z) en ejes del personaje
const ypr = (yaw, pitch, roll, out) => { rot(Y, yaw, _a); rot(X, pitch, _b); rot(Z, roll, _c); return out.copy(_a).multiply(_b).multiply(_c); };

const _h1 = new THREE.Vector3(), _n1 = new THREE.Vector3(), _pT = new THREE.Vector3(), _t3 = new THREE.Vector3(), _np = new THREE.Vector3(), _hD = new THREE.Vector3(), _nD = new THREE.Vector3(), _b1 = new THREE.Vector3(), _b2 = new THREE.Vector3();
const _m1 = new THREE.Matrix4(), _m2 = new THREE.Matrix4(), _q1 = new THREE.Quaternion();
export class Rig {
  constructor(root, holder, { onlyLegacy = false } = {}) {
    holder.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(holder.matrixWorld).invert();
    this.bones = []; this.parent = []; this.idx = {}; const map = new Map();
    root.traverse(o => {
      if (!o.isBone) return;
      const i = this.bones.length; this.bones.push(o); map.set(o, i);
      let p = o.parent; while (p && !p.isBone) p = p.parent;
      this.parent.push(p ? map.get(p) : -1);
      this.idx[canon(o.name)] ??= i;
    });
    const n = this.n = this.bones.length;
    this.P0 = []; this.Wr = []; this.localQ0 = []; this.localP0 = []; this.kind = new Uint8Array(n); this.side = new Int8Array(n);
    const m = new THREE.Matrix4(), s = new THREE.Vector3();
    this.bones.forEach(b => {
      m.multiplyMatrices(inv, b.matrixWorld); const p = new THREE.Vector3(), q = new THREE.Quaternion(); m.decompose(p, q, s);
      this.P0.push(p); this.Wr.push(q); this.localQ0.push(b.quaternion.clone()); this.localP0.push(b.position.clone());
    });
    const I = k => this.idx[NAME[k]];
    for (const k of Object.keys(NAME)) if (I(k) === undefined) throw new Error('Falta el hueso ' + NAME[k]);
    const kd = { com: K.COM, pel: K.PEL, sp0: K.SP0, sp1: K.SP1, sp2: K.SP2, neck: K.NECK, head: K.HEAD, clL: K.CL, clR: K.CL, thL: K.THIGH, thR: K.THIGH, uaL: K.UARM, uaR: K.UARM };
    for (const k in kd) { this.kind[I(k)] = kd[k]; }
    this.side[I('clL')] = this.side[I('thL')] = this.side[I('uaL')] = 1;
    this.side[I('clR')] = this.side[I('thR')] = this.side[I('uaR')] = -1;
    this.I = Object.fromEntries(Object.keys(NAME).map(k => [k, I(k)]));
    // hijos (para direcciones de reposo)
    const kids = Array.from({ length: n }, () => []); this.parent.forEach((p, i) => p >= 0 && kids[p].push(i));
    this.kids = kids;
    // extremidades: longitudes y direcciones de reposo en espacio del modelo
    this.limb = {};
    for (const [key, a, b, c] of [['legL', 'thL', 'caL', 'foL'], ['legR', 'thR', 'caR', 'foR'], ['armL', 'uaL', 'faL', 'haL'], ['armR', 'uaR', 'faR', 'haR']]) {
      const A = I(a), B = I(b), C = I(c);
      const L1 = this.P0[A].distanceTo(this.P0[B]), L2 = this.P0[B].distanceTo(this.P0[C]);
      this.limb[key] = { A, B, C, L1, L2, len: L1 + L2, u1: this.P0[B].clone().sub(this.P0[A]).normalize(), u2: this.P0[C].clone().sub(this.P0[B]).normalize() };
    }
    this.legLen = this.limb.legL.len; this.armLen = this.limb.armL.len;
    this.restHand = { L: this.P0[I('haL')].clone().sub(this.P0[I('uaL')]).divideScalar(this.armLen), R: this.P0[I('haR')].clone().sub(this.P0[I('uaR')]).divideScalar(this.armLen) };
    // dedos y huesos secundarios
    this.fingers = []; this.sec = [];
    const underHand = (i, hi) => { for (let p = this.parent[i]; p >= 0; p = this.parent[p]) if (p === hi) return true; return false; };
    this.bones.forEach((b, i) => {
      const nm = canon(b.name);
      if (/^finger_/i.test(nm)) {
        const hs = underHand(i, I('haL')) ? 1 : underHand(i, I('haR')) ? -1 : 0;
        if (hs) { this.kind[i] = K.FINGER; this.side[i] = hs; this.fingers.push(i); }
      } else if (this.kind[i] === K.NONE && SEC_RE.test(nm)) { this.kind[i] = K.SEC; this.sec.push(i); }
    });
    // Eje de curvatura de cada dedo calculado con la geometría de la mano en reposo (sirve para cualquier modelo):
    // la palma es el plano entre la muñeca y las bases de los dedos; su normal apunta hacia donde se cierra el puño
    // (el pulgar queda ligeramente hacia ese lado). Cada falange gira alrededor de (dirección del dedo × normal de la palma).
    this.curl = new Map(); this.handFrame = {};
    for (const hs of [1, -1]) {
      const hi = I(hs > 0 ? 'haL' : 'haR'), H = this.P0[hi];
      const roots = this.fingers.filter(i => this.side[i] === hs && this.kind[this.parent[i]] !== K.FINGER);
      if (!roots.length) continue;
      const chainDir = i => { const ch = kids[i].find(j => this.kind[j] === K.FINGER); return (ch !== undefined ? this.P0[ch].clone().sub(this.P0[i]) : this.P0[i].clone().sub(H)).normalize(); };
      const out = roots.map(i => ({ i, base: this.P0[i].clone().sub(H) }));
      const mean = out.reduce((v, o) => v.add(o.base.clone().normalize()), new THREE.Vector3()).normalize();
      let th = out[0]; for (const o of out) if (o.base.clone().normalize().dot(mean) < th.base.clone().normalize().dot(mean)) th = o; // el pulgar es el que más se separa
      const rest = out.filter(o => o !== th), along = rest.reduce((v, o) => v.add(o.base), new THREE.Vector3()).normalize();
      const dTh = o => o.base.distanceTo(th.base); rest.sort((x, y) => dTh(x) - dTh(y));
      const across = rest.length > 1 ? rest[0].base.clone().sub(rest[rest.length - 1].base).normalize() : new THREE.Vector3(0, 0, 1);
      const n = new THREE.Vector3().crossVectors(along, across).normalize();
      const thOff = th.base.clone().addScaledVector(along, -th.base.dot(along)); if (thOff.dot(n) < 0) n.negate();
      // marco de la mano en reposo (dirección de los dedos y normal de la palma, ortonormales) para orientar la muñeca sin torcerla
      const a0 = along.clone(), n0 = n.clone().addScaledVector(a0, -n.dot(a0)).normalize(); this.handFrame[hs] = { a0, n0 };
      const walk = (i, depth, thumb) => {
        const dir = chainDir(i), axis = new THREE.Vector3().crossVectors(dir, n); if (axis.lengthSq() < 1e-6) axis.crossVectors(dir, across);
        this.curl.set(i, { axis: axis.normalize(), depth, thumb });
        for (const j of kids[i]) if (this.kind[j] === K.FINGER) walk(j, depth + 1, thumb);
      };
      for (const o of out) walk(o.i, 0, o === th);
      // PULGAR en el puño: en una mano real no queda levantado, se cruza por DELANTE de los dedos índice y medio,
      // apoyado sobre sus falanges medias. Se guarda la rotación (en reposo) que lleva la base del pulgar hacia ese punto.
      if (rest.length >= 2) {
        const child = i => kids[i].find(j => this.kind[j] === K.FINGER), seg = i => { const c = child(i); return c !== undefined ? this.P0[c].distanceTo(this.P0[i]) : .03; };
        const q = rest[0].base.clone().add(rest[1].base).multiplyScalar(.5).addScaledVector(n, seg(rest[0].i) * 1.25).addScaledVector(along, -seg(rest[0].i) * .15);
        const aim = q.sub(th.base).normalize(), d0 = chainDir(th.i);
        this.curl.get(th.i).tq = new THREE.Quaternion().setFromUnitVectors(d0, aim);
      }
    }
    for (const i of this.fingers) if (!this.curl.has(i)) this.curl.set(i, { axis: new THREE.Vector3(1, 0, 0), depth: 0, thumb: false });
    // buffers de trabajo
    this.D = Array.from({ length: n }, () => new THREE.Quaternion()); this.Pn = Array.from({ length: n }, () => new THREE.Vector3());
    this.dq = Array.from({ length: n }, () => new THREE.Quaternion()); this.has = new Uint8Array(n);
    this.comParent3 = new THREE.Matrix3().setFromMatrix4(new THREE.Matrix4().multiplyMatrices(inv, this.bones[I('com')].parent.matrixWorld).invert());
    this.springs = null; this.springsOn = true;
  }

  reset() { this.bones.forEach((b, i) => { b.quaternion.copy(this.localQ0[i]); b.position.copy(this.localP0[i]); }); }

  // ctx: { lead: +1 si el lado adelantado es el IZQUIERDO, −1 si es el derecho; vel: velocidad del cuerpo (espacio modelo); dt, t }
  apply(P, ctx) {
    const { D, Pn, dq, has, P0, Wr, parent, kind, side, I } = this, n = this.n, lead = ctx.lead;
    const c = k => P[IDX[k]];
    const fr = s => (s === lead ? 'F' : 'B');
    has.fill(0);
    for (let i = 0; i < n; i++) {
      const p = parent[i], Dp = p >= 0 ? D[p] : qI;
      if (p >= 0) Pn[i].copy(P0[i]).sub(P0[p]).applyQuaternion(Dp).add(Pn[p]); else Pn[i].copy(P0[i]);
      let d = null;
      switch (kind[i]) {
        case K.COM: { // desplazamiento del centro de masa (todo el cuerpo)
          d = ypr(c('comYaw'), c('comPitch'), -lead * c('comRoll'), dq[i]); this.comI = i;
          _T.set(c('comX'), c('comY'), c('comZ'));
          const seat = Math.max(0, Math.min(1, c('seat')));
          if (seat > 0) { // (v1.10) cadera APOYADA en el suelo: las articulaciones de la cadera quedan a seatH × pierna del suelo (sin flotar)
            const tl = this.I.thL, tr = this.I.thR;
            const oy = tl != null && tr != null ? (_v.copy(P0[tl]).sub(P0[i]).applyQuaternion(_c.copy(d).multiply(Dp)).y + _w.copy(P0[tr]).sub(P0[i]).applyQuaternion(_c).y) / 2 : 0;
            const want = c('seatH') * this.legLen - oy - P0[i].y; _T.y += (want - _T.y) * seat;
          }
          Pn[i].add(_T); this.bones[i].position.copy(this.localP0[i]).add(_v.copy(_T).applyMatrix3(this.comParent3));
          break; }
        case K.PEL: d = ypr(-lead * c('pelYaw'), c('pelPitch'), -lead * c('pelRoll'), dq[i]); break;
        case K.SP0: case K.SP1: case K.SP2: {
          const w = kind[i] === K.SP0 ? .3 : kind[i] === K.SP1 ? .35 : .35;
          d = ypr(-lead * c('spYaw') * w, c('spPitch') * w, -lead * c('spRoll') * w, dq[i]); break; }
        case K.NECK: case K.HEAD: {
          const w = kind[i] === K.NECK ? .4 : .6;
          d = ypr(-lead * c('hdYaw') * w, c('hdPitch') * w, -lead * c('hdRoll') * w, dq[i]); break; }
        case K.CL: {
          const s = side[i], f = fr(s), up = c('sh' + f + 'up'), fw = c('sh' + f + 'fwd');
          rot(Z, s * up, _a); rot(Y, -s * fw, _b); d = dq[i].copy(_a).multiply(_b); break; }
        case K.THIGH: this._leg(i, side[i], fr(side[i]), P, Dp); d = dq[i]; break;
        case K.UARM: this._arm(i, side[i], fr(side[i]), P, Dp); d = dq[i]; break;
        case K.FINGER: {
          const s = side[i], f = fr(s), fist = Math.max(0, Math.min(1, c('hn' + f + 'fist'))), cv = this.curl.get(i);
          const base = cv.thumb ? [0, .35, .45] : [1.4, 1.55, 1.15], ang = base[Math.min(cv.depth, 2)] * fist;
          if (cv.tq) { _a.copy(qI).slerp(cv.tq, fist); _b.copy(Dp); d = dq[i].copy(_b).multiply(_a).multiply(_b.invert()); } // base del pulgar: cruza por delante
          else { _w.copy(cv.axis).applyQuaternion(Dp); d = dq[i].setFromAxisAngle(_w, ang); }
          break; }
        case K.SEC: if (this.springs && this.springsOn) d = this.springs.solve(i, Pn[i], Dp, ctx, dq[i]); break;
      }
      if (has[i] && kind[i] !== K.THIGH && kind[i] !== K.UARM) d = dq[i]; // delta preparado por el IK (calf/foot/forearm/hand)
      if (d) {
        D[i].copy(d).multiply(Dp);
        if (p >= 0) { _a.copy(Dp).multiply(Wr[p]).invert(); this.bones[i].quaternion.copy(_a.multiply(D[i]).multiply(Wr[i])); }
      } else D[i].copy(Dp);
    }
  }

  // IK de dos huesos con vector polo; escribe los deltas de los 3 huesos en dq/has
  _limbIK(L, Dp, target, pole, dqA, dqB) {
    const H = this.Pn[L.A], L1 = L.L1, L2 = L.L2;
    _v.copy(target).sub(H); let dist = _v.length();
    const max = (L1 + L2) * .9995, min = Math.abs(L1 - L2) + 1e-3; dist = Math.min(max, Math.max(min, dist));
    _dir.copy(_v).normalize(); if (!isFinite(_dir.x) || _v.lengthSq() < 1e-10) _dir.copy(L.u1);
    const a = (L1 * L1 - L2 * L2 + dist * dist) / (2 * dist), h = Math.sqrt(Math.max(L1 * L1 - a * a, 0));
    _perp.copy(pole).addScaledVector(_dir, -pole.dot(_dir)); if (_perp.lengthSq() < 1e-8) _perp.set(0, 0, 1).addScaledVector(_dir, -_dir.z); _perp.normalize();
    _K.copy(H).addScaledVector(_dir, a).addScaledVector(_perp, h); _E.copy(H).addScaledVector(_dir, dist);
    _u1.copy(_K).sub(H).normalize(); _u2.copy(_E).sub(_K).normalize();
    _w.copy(L.u1).applyQuaternion(Dp); dqA.setFromUnitVectors(_w, _u1);
    _a.copy(dqA).multiply(Dp);                                  // Δ acumulado tras el hueso superior
    _w.copy(L.u2).applyQuaternion(_a); dqB.setFromUnitVectors(_w, _u2);
    return _b.copy(dqB).multiply(_a);                           // Δ acumulado tras el inferior (en _b, ¡temporal!)
  }

  _leg(i, s, f, P, Dp) {
    const L = this.limb[s > 0 ? 'legL' : 'legR'], c = k => P[IDX[k]], { dq, has } = this;
    const ox = c('ft' + f + 'x'), oy = c('ft' + f + 'y'), oz = c('ft' + f + 'z'), free = Math.max(0, Math.min(1, c('ftFree')));
    _T.copy(this.P0[L.C]).add(_v.set(s * ox, oy, oz).multiplyScalar(this.legLen));
    if (free > 0) { // en el aire los pies acompañan al cuerpo (volteretas, giros)
      const ci = this.I.com, Dc = this.D[ci];
      _w.copy(_T).sub(this.P0[ci]).applyQuaternion(Dc).add(this.Pn[ci]); _T.lerp(_w, free);
    }
    // tumbado o sentado en el suelo (cadera inclinada hacia atrás): la rodilla dobla hacia ARRIBA, no hacia el suelo
    const cp = c('comPitch'), lie = free < 1 ? Math.max(0, Math.min(1, (-Math.atan2(Math.sin(cp), Math.cos(cp)) - .3) / .7)) : 0;
    const up = Math.max(lie, Math.max(0, Math.min(1, c('seat'))) * .9 * Math.max(0, Math.min(1, (.42 - c('seatH')) / .14, (oz + .05) / .2))), kn = c('kn' + f + 'x'); // sentado: rodillas arriba; kn: hacia fuera/dentro
    _pole.set(s * (.22 + kn * 1.6), up * 1.3 - Math.abs(kn) * .5, 1 - up * .75).normalize(); if (free > 0) _pole.applyQuaternion(_c.copy(qI).slerp(this.D[this.I.com], free));
    const D2 = _d.copy(this._limbIK(L, Dp, _T, _pole, dq[L.A], dq[L.B])); has[L.B] = 1;
    // pie: orientación objetivo = reposo (plano) · yaw · pitch; compensa el Δ acumulado de la pierna
    rot(Y, s * c('ft' + f + 'yaw'), _a); rot(X, -c('ft' + f + 'pitch'), _c); _a.multiply(_c);
    rot(Y, c('comYaw'), _b); _b.slerp(this.D[this.I.com], free); _a.premultiply(_b);
    dq[L.C].copy(_a).multiply(D2.invert()); has[L.C] = 1;
  }

  // Muñeca natural (sin arma en la mano): la mano sigue la línea del antebrazo y solo gira sobre él para que la palma mire
  // a donde tiene sentido. Puño: palma hacia dentro (guardia) que rota a palma abajo al extender el brazo (directo); muñeca recta.
  // Mano abierta: con pitch > 0 la palma mira al frente (empujes de control elemental) y la muñeca se extiende lo justo.
  // El canal roll añade un giro limitado sobre el antebrazo. Todo es relativo al pecho, así acompaña los giros del torso.
  _wristNatural(L, s, f, c, chest, D2, HF, out) {
    const fist = Math.max(0, Math.min(1, c('hn' + f + 'fist'))), pitch = c('hn' + f + 'pitch'), roll = Math.max(-.6, Math.min(.6, c('hn' + f + 'roll')));
    const h1 = _h1.copy(HF.a0).applyQuaternion(D2), n1 = _n1.copy(HF.n0).applyQuaternion(D2); // marco actual si la muñeca no hiciera nada
    const ext = Math.max(0, Math.min(1, (_T.distanceTo(this.Pn[L.A]) / this.armLen - .55) / .4)); // 0 = brazo recogido · 1 = estirado
    const open = Math.max(0, Math.min(1, (Math.abs(pitch) - .15) / .8)) * (1 - fist), up = pitch >= 0 ? -.3 : .3; // pitch > 0 = dedos arriba · < 0 = dedos abajo
    // palma objetivo en el espacio del pecho: hacia dentro y algo abajo · abajo al estirar el puño · al frente con la mano abierta empujando
    _pT.set(-s * (1 - ext * .75), -.35 - ext * .8, .1).normalize().lerp(_t3.set(-s * .15, up, 1).normalize(), open).normalize().applyQuaternion(chest);
    if (this._gnd > 0) _pT.lerp(_t3.set(0, -1, 0), this._gnd).normalize(); // apoyada en el suelo: palma hacia abajo
    // tramo de palma perpendicular a los dedos rectos → giro sobre el antebrazo; lo que sobra → extensión de muñeca (limitada)
    let np = _np.copy(_pT).addScaledVector(h1, -_pT.dot(h1)); if (np.lengthSq() < 1e-6) np.copy(n1); np.normalize();
    _q1.setFromAxisAngle(h1, roll * s); np.applyQuaternion(_q1);
    const lim = .12 + (1 - fist) * 1.05, beta = Math.max(-lim * .5, Math.min(lim, Math.asin(Math.max(-1, Math.min(1, _pT.dot(h1))))));
    const hD = _hD.copy(h1).multiplyScalar(Math.cos(beta)).addScaledVector(np, -Math.sin(beta)), nD = _nD.copy(np).multiplyScalar(Math.cos(beta)).addScaledVector(h1, Math.sin(beta));
    // rotación que lleva el marco (h1, n1) al deseado (hD, nD)
    _m1.makeBasis(h1, n1, _b1.crossVectors(h1, n1)); _m2.makeBasis(hD, nD, _b2.crossVectors(hD, nD));
    _m2.multiply(_m1.transpose()); out.setFromRotationMatrix(_m2);
  }

  _arm(i, s, f, P, Dp) {
    const L = this.limb[s > 0 ? 'armL' : 'armR'], c = k => P[IDX[k]], { dq, has, D } = this, chest = D[this.I.sp2];
    _T.set(s * c('hn' + f + 'x'), c('hn' + f + 'y'), c('hn' + f + 'z')).multiplyScalar(this.armLen).applyQuaternion(chest).add(this.Pn[L.A]);
    const gnd = Math.max(0, Math.min(1, c('hn' + f + 'gnd')));
    if (gnd > 0) { const C0 = this.Pn[this.I.com]; // (v1.10) mano apoyada en el suelo: posición respecto al punto del suelo bajo la cadera
      _E.set(C0.x + s * c('hn' + f + 'x') * this.legLen, c('hn' + f + 'y') * this.legLen, C0.z + c('hn' + f + 'z') * this.legLen); _T.lerp(_E, gnd); }
    this._gnd = gnd;
    _pole.set(s * (.35 + c('hn' + f + 'flare')), -1, -.4).applyQuaternion(chest);
    const D2 = this._limbIK(L, Dp, _T, _pole, dq[L.A], dq[L.B]); has[L.B] = 1;
    _w.copy(L.u2).applyQuaternion(D2); // eje del antebrazo
    // muñeca: giro sobre el antebrazo (roll) y luego inclinación sobre el eje lateral del cuerpo.
    // Con arma «apuntable» (espada, lanza) el canal pitch es el ÁNGULO ABSOLUTO de la hoja en el plano de pantalla
    // (0 = hacia delante, +π/2 = arriba, −π/2 = abajo); si no, es una flexión relativa.
    const HF = this.handFrame[s];
    if (HF && !this.blade && !this.legacyWrist) { this._wristNatural(L, s, f, c, chest, D2, HF, dq[L.C]); has[L.C] = 1; return; }
    const rl = this.rollMax && !this.blade ? Math.max(-this.rollMax, Math.min(this.rollMax, c('hn' + f + 'roll'))) : c('hn' + f + 'roll');
    _c.setFromAxisAngle(_w, s * rl); const pitch = c('hn' + f + 'pitch'), bl = this.blade?.[s > 0 ? 'L' : 'R'];
    // sin arma: flexión de muñeca suave y limitada (una mano de verdad no se dobla 90°)
    let ang = this.wristMax && !bl ? -Math.max(-this.wristMax, Math.min(this.wristMax, pitch * (this.wristK ?? 1))) : -pitch;
    if (bl) {
      _E.copy(bl).applyQuaternion(_a.copy(_c).multiply(D2));
      const cur = Math.atan2(_E.y, _E.z); let dlt = pitch - cur; dlt -= Math.round(dlt / (2 * Math.PI)) * 2 * Math.PI;
      const lim = this.bladeClamp ?? 2.1; ang = -Math.max(-lim, Math.min(lim, dlt)); // sin arma en la mano: la muñeca solo «apunta» con un giro natural
    }
    dq[L.C].setFromAxisAngle(X, ang).multiply(_c); has[L.C] = 1;
  }
}
