// Director de animación (puro, sin Three.js → se prueba con Node). Traduce el estado de un Fighter
// (golpe, aturdimiento, guardia, aire, derribo, agarre, KO…) en una pose de canales, con mezclas suaves entre estados.
// También informa qué estelas deben dibujarse (this.trails) y qué efectos pide el clip en este fotograma (this.cues).
import { N, IDX, lerpInto, smooth, clamp01, evalClip } from './pose.js';
import { idlePose, walkPose, runPose, squatPose, airPose, backdashPose, lyingPose, neutral } from './locomotion.js';
import { guardOverlay, hitOverlay, blockOverlay, thrownOverlay } from './reactions.js';
import { buildAttacks, warpTime } from './attacks.js';

const arr = () => new Float32Array(N);
const rate = (dt, k) => 1 - Math.exp(-dt * k);
// Seguidor críticamente amortiguado (segundo orden): arranca y frena con suavidad, sin el escalón del primer fotograma
// que deja una aproximación exponencial. o[k] = valor, o[k + 'v'] = su velocidad. w ≈ rapidez (1/s).
const follow = (o, k, target, w, dt) => {
  const v = o[k + 'v'] || 0, x = o[k] - target, e = Math.exp(-w * dt), j = (v + w * x) * dt;
  o[k] = target + (x + j) * e; o[k + 'v'] = (v - w * j) * e;
  return o[k];
};
const GETUP = .35, DOWN = .5;
// Canales que son ángulos que pueden dar vueltas completas: al fundir se toma el camino corto.
const WRAP = new Set(['comPitch', 'comYaw', 'comRoll', 'wpSpin'].map(k => IDX[k]));
const wrapPi = a => a - Math.round(a / (2 * Math.PI)) * 2 * Math.PI;
// Duración de la inercialización según el estado al que se entra (s).
const XF = { ko: .16, down: .12, getup: .12, thrown: .1, hit: .1, blk: .09, clip: .1, fromClip: .14, other: .16 };
const EXAG = ['comZ', 'comY', 'spYaw', 'spPitch', 'pelYaw', 'hdPitch', 'shFfwd', 'shBfwd', 'ftFz', 'ftBz'].map(k => IDX[k]); // nunca comPitch: las volteretas (2π) se deformarían

export class Director {
  constructor(S, { legLen = 1.6, rest = { x: .42, y: -.86, z: .19 } } = {}) {
    this.S = S; this.legLen = legLen; this.rest = rest; this.clips = buildAttacks(S); this.neutral = neutral(rest); this.reduce = false; this.exag = 1;
    this.b = { idle: arr(), walk: arr(), run: arr(), ground: arr(), sq: arr(), air: arr(), base: arr(), tmp: arr(), out: arr(), last: arr(), prev: arr(), from: arr() };
    this.trails = []; this.cues = [];
    this.reset();
  }
  reset() {
    Object.assign(this, { t: 0, u: 0, ru: 0, ww: 0, rw: 0, airW: 0, gw: 0, wwv: 0, rwv: 0, airWv: 0, gwv: 0, lieW: 0, landT: 9, landK: 0, takeT: 9, wasAir: false, lastVy: 0, flipT: 9, jumpN: 0,
      hitN: 0, bkN: 0, hitT: 9, bkT: 9, koT: 0, downT: 0, key: 'free', xf: null, lastCT: -1, lastClip: null, side: 1 });
    this.b.last.set(this.neutral); this.b.prev.set(this.neutral); this.inert = null; this.trails = []; this.cues = [];
  }

  // f: Fighter (o estado sintético del menú). extra.action: gesto sin golpe {name, t} (presentación, victoria…);
  // extra.preview: {name, t} evalúa un clip en un tiempo de diseño concreto (laboratorio).
  compose(dt, f, extra = {}) {
    const { S, b } = this, vRel = (f.vx || 0) * (f.facing || 1), stun = f.stun || 0, ko = !!f.ko;
    const st = f.stunType, hit = stun > 0 && (st === 'hit' || st === 'crush'), blk = stun > 0 && st === 'block', thrown = st === 'thrown';
    const down = (f.down || 0) > 0, getup = (f.getup || 0) > 0;
    let act = f.act || (extra.action && extra.action.t >= 0 ? extra.action : null);
    if (extra.preview) act = { name: extra.preview.name, t: extra.preview.t };
    this.t += dt; this.hitT += dt; this.bkT += dt; this.trails = []; this.cues = [];
    if ((f.hitN || 0) !== this.hitN) { this.hitN = f.hitN || 0; this.hitT = 0; this.side = -this.side; }
    if ((f.bkN || 0) !== this.bkN) { this.bkN = f.bkN || 0; this.bkT = 0; }
    this.koT = ko ? this.koT + dt : 0;

    // 1 · locomoción
    const free = !act && !ko && stun <= 0 && !down && !getup && !f.bdash;
    const moving = Math.abs(vRel) > .1 && !f.air && free, running = moving && !!f.run;
    follow(this, 'ww', moving && !running ? 1 : 0, 16, dt);
    follow(this, 'rw', running ? 1 : 0, 14, dt);
    if (moving && !running) this.u += vRel * dt / (4 * S.walk.stepZ * this.legLen * (S.walk.stride || 1));
    if (running) this.ru += Math.abs(vRel) * dt / (1.2 * S.run.stride * this.legLen);
    if (this.wasAir && !f.air) { this.landT = 0; this.landK = clamp01(Math.abs(this.lastVy) / (f.jumpV || 14)); this.cues.push({ kind: 'land', k: this.landK }); }
    if (!this.wasAir && f.air) this.takeT = 0;
    if (f.took === 'jump2') this.flipT = 0;
    if (f.airRec && !this.wasRec) this.recT = 0; this.wasRec = !!f.airRec; this.recT = (this.recT ?? 9) + dt;
    this.wasAir = !!f.air; this.lastVy = f.vy || 0; this.landT += dt; this.takeT += dt; this.flipT += dt;
    follow(this, 'airW', f.air && !f.launched && !ko ? 1 : 0, 26, dt); this.airW = clamp01(this.airW);

    idlePose(b.idle, this.t, S, this.reduce);
    walkPose(b.walk, this.u, vRel >= 0 ? 1 : -1, b.idle, S, this.rest);
    lerpInto(b.ground, b.idle, b.walk, smooth(this.ww));
    if (this.rw > .01) { runPose(b.run, this.ru, b.idle, S, this.rest); lerpInto(b.tmp, b.ground, b.run, smooth(this.rw)); b.ground.set(b.tmp); }
    squatPose(b.sq, b.idle, S.crouch.drop, S.crouch.pitch, S, S.crouch.wide);
    lerpInto(b.base, b.ground, b.sq, smooth(f.crouch ?? (f.crouching ? 1 : 0)));
    if (f.bdash > 0) { backdashPose(b.tmp, 1 - f.bdash / .3, b.base); b.base.set(b.tmp); }
    if (this.airW > .01) {
      const flip = f.airRec ? clamp01(this.recT / .45) : this.flipT < .42 ? clamp01(this.flipT / .42) : 0;
      airPose(b.air, clamp01((f.vy || 0) / (f.jumpV || 14) * .5 + .5) * 2 - 1, this.t, b.idle, S, this.rest, smooth(this.takeT / .16), flip);
      lerpInto(b.tmp, b.base, b.air, smooth(this.airW)); b.base.set(b.tmp);
    }
    let sq = 0;
    const lt = clamp01(1 - this.landT / S.land.time); if (lt > 0 && !act) sq = Math.max(sq, lt * lt * S.land.depth * (.35 + .65 * this.landK));
    if (sq > 0) { squatPose(b.sq, b.idle, sq, sq * .5, S, sq * .1); lerpInto(b.tmp, b.base, b.sq, .85 * (1 - this.airW)); b.base.set(b.tmp); }

    // 2 · defensa y reacciones (sobre la base)
    follow(this, 'gw', (f.guarding && !ko && !hit && !act && !thrown) ? 1 : 0, 24, dt); this.gw = clamp01(this.gw);
    if (this.gw > .01) guardOverlay(b.base, this.gw, f.crouch ?? (f.crouching ? 1 : 0), S);
    if (hit && !ko && !f.launched) hitOverlay(b.base, this.hitT / (f.stunMax || .3), clamp01((f.hitKb || 5) / 8) * .6 + .4, !!f.air, S, this.side, st);
    if (blk) blockOverlay(b.base, this.bkT / (f.stunMax || .2), clamp01((f.hitKb || 3) / 4) * .6 + .4, this.t);
    if (thrown) thrownOverlay(b.base, this.t);
    // derribo: lanzado (en el aire) → tumbado → levantarse
    const lying = ko || down || (f.launched && f.air) || getup;
    if (getup) { const c = this.clips.getup, p = 1 - f.getup / GETUP; evalClip(c, p * c.dur, b.base, b.tmp); b.base.set(b.tmp); this.lieW = 0; }
    else { this.lieW += ((lying ? 1 : 0) - this.lieW) * rate(dt, ko || down ? 16 : 9); }
    if (down) this.downT += dt; else this.downT = 0;
    if (this.lieW > .005) {
      const air = f.air ? clamp01(.4 + (f.vy || 0) / 10) : 0; lyingPose(b.base, b.base, smooth(this.lieW), air, this.koT || this.t, S.id);
      if (down && this.downT < .2) b.base[IDX.comY] += Math.sin(this.downT / .2 * Math.PI) * .08; // rebote al caer
    }

    // 3 · golpe / gesto: el clip se re-temporiza sobre la ventana real del golpe
    let clip = null, ct = 0;
    // los clips «de suelo» (derrota) se reproducen sobre la pose tumbada: el guerrero no se levanta
    const ground = act && this.clips[act.name]?.ground && (ko || down);
    if (act && ((!ko && !lying) || ground)) {
      clip = this.clips[act.name];
      if (clip) {
        ct = extra.preview ? act.t : act.def ? warpTime(clip, act) : act.t / (S.atkSpeed || 1);
        evalClip(clip, Math.min(ct, clip.hold ? clip.lastT : clip.dur - 1e-4), b.base, b.out);
        // exageración de anime: el tronco, la zancada y la inclinación se alejan más de la guardia (poses más claras y potentes)
        if (this.exag > 1 && !extra.preview && act.def) for (const i of EXAG) b.out[i] = b.base[i] + (b.out[i] - b.base[i]) * this.exag;
        // estelas y efectos que pide el clip
        for (const tr of clip.trails || []) if (ct >= tr[1] && ct <= tr[2]) this.trails.push({ at: tr[0], k: clamp01(Math.min(ct - tr[1], tr[2] - ct) / .04) });
        const prev = this.lastClip === act ? this.lastCT : -1;
        for (const c of clip.fx || []) if (c.t > prev && c.t <= ct) this.cues.push(c);
        this.lastClip = act; this.lastCT = ct;
      }
    }
    if (!clip) { b.out.set(b.base); this.lastClip = null; }

    // 4 · transición por INERCIALIZACIÓN: al cambiar de estado (nuevo golpe, impacto, K.O.…) la animación nueva empieza
    // ya, y la diferencia con la pose anterior se disuelve con una curva quíntica que respeta la velocidad que traía el
    // cuerpo (sin congelar la pose de partida ni saltos de un fotograma). Antes era un fundido de 35 ms: se notaba el tirón.
    const key = ground && clip ? act : ko ? 'ko' : down ? 'down' : getup ? 'getup' : thrown ? 'thrown' : hit ? 'hit' + this.hitN : blk ? 'blk' + this.bkN : clip ? act : f.air ? 'air' : 'free';
    if (key !== this.key) {
      const was = this.key, loco = k => k === 'free' || k === 'air';
      if (!(loco(key) && loco(was)) && !extra.preview && dt > 0) {
        const d = typeof key === 'object' ? XF.clip : /^hit/.test(key) ? XF.hit : /^blk/.test(key) ? XF.blk : XF[key] ?? (typeof was === 'object' ? XF.fromClip : XF.other);
        this.startInert(b.out, d, dt);
      }
      this.key = key;
    }
    if (this.inert) this.applyInert(b.out, dt);
    b.prev.set(b.last); b.last.set(b.out);
    const o = b.last.slice(), L = this.legLen; o[IDX.comX] *= L; o[IDX.comY] *= L; o[IDX.comZ] *= L; // de «largos de pierna» a unidades del modelo
    return o;
  }
  // Inercialización (Bollo, GDC 2016): por canal, x0 = pose anterior − pose nueva y v0 = su velocidad; x(t) quíntica
  // que llega a 0 en T con velocidad y aceleración 0. Si ya hay una en curso, se suma (se parte de la pose que se veía).
  startInert(target, T, dt) {
    const { last, prev } = this.b, n = target.length;
    const X = new Float64Array(n), V = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      let x = last[i] - target[i], v = (last[i] - prev[i]) / dt;
      if (WRAP.has(i)) { x = wrapPi(x); v = wrapPi(last[i] - prev[i]) / dt; }
      X[i] = x; V[i] = v;
    }
    const P = new Float64Array(n * 6); // por canal: A B C a0/2 v0 x0 y su T propio
    const Tc = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      let x0 = X[i], v0 = V[i]; const sg = x0 < 0 ? -1 : 1; x0 *= sg; v0 *= sg;
      if (x0 < 1e-5) { Tc[i] = 0; continue; }
      if (v0 > 0) v0 = 0; // si ya se alejaba del destino, no lo empuja más allá
      let t = T; if (v0 < 0) t = Math.min(t, -5 * x0 / v0);
      if (t < 3 * dt) { t = Math.min(T, 3 * dt); v0 = Math.max(v0, -x0 / t); } // nunca una mezcla de menos de 3 fotogramas
      v0 = Math.max(v0, -4 * x0 / t); // tope a la velocidad heredada (sin latigazos)
      const a0 = Math.max(0, (-8 * v0 * t - 20 * x0) / (t * t)), t2 = t * t, t3 = t2 * t, t4 = t3 * t, t5 = t4 * t;
      const o = i * 6;
      P[o] = sg * -(a0 * t2 + 6 * v0 * t + 12 * x0) / (2 * t5); P[o + 1] = sg * (3 * a0 * t2 + 16 * v0 * t + 30 * x0) / (2 * t4);
      P[o + 2] = sg * -(3 * a0 * t2 + 12 * v0 * t + 20 * x0) / (2 * t3); P[o + 3] = sg * a0 / 2; P[o + 4] = sg * v0; P[o + 5] = sg * x0; Tc[i] = t;
    }
    this.inert = { t: 0, P, Tc, T };
  }
  applyInert(out, dt) {
    const I = this.inert; I.t += dt; const { P, Tc } = I; let live = false;
    for (let i = 0; i < out.length; i++) {
      const T = Tc[i]; if (!(T > 0)) continue; const t = Math.min(I.t, T); if (I.t < T) live = true;
      const o = i * 6; out[i] += ((((P[o] * t + P[o + 1]) * t + P[o + 2]) * t + P[o + 3]) * t + P[o + 4]) * t + P[o + 5];
    }
    if (!live) this.inert = null;
  }
}
