// Poses base: reposo, caminar, correr, agacharse/aterrizar, salto, retroceso rápido, tumbado y levantarse.
// Funciones puras sobre Float32Array (sin Three.js).
import { IDX, makePose, smooth, clamp01 } from './pose.js';
const TAU = Math.PI * 2;
const frac = x => x - Math.floor(x);
const mixv = (a, b, w) => a + (b - a) * w;

// Reposo del brazo (A-pose del modelo) en coordenadas «hombro-relativas».
export const neutral = rest => makePose({ hnFx: rest.x, hnFy: rest.y, hnFz: rest.z, hnBx: rest.x, hnBy: rest.y, hnBz: rest.z });

export function idlePose(out, t, S, reduce) {
  const { stance: st, guard: g, breath: br, bounce: bo, sway: sw } = S, k = reduce ? .25 : 1;
  const b = Math.sin(t * br.rate * Math.PI) * k;                              // respiración
  const bn = bo.freq ? Math.abs(Math.sin(t * bo.freq * Math.PI)) : 0;         // rebote sobre las puntas
  const fl = S.floatiness * k, s1 = Math.sin(t * 1.1) * fl, s2 = Math.sin(t * .8 + 1) * fl;
  const wa = sw.amp * k, w1 = Math.sin(t * sw.rate * TAU) * wa, w2 = Math.cos(t * sw.rate * TAU) * wa; // ocho de la mano libre (agua)
  out.set(makePose({
    comY: -st.knee + bn * bo.amp * k + s1 * .02 + b * .006, comZ: .02 + s2 * .03, comX: w1 * .02,
    pelYaw: st.hipYaw + w1 * .05, pelRoll: st.roll + s1 * .04 + w2 * .03,
    spYaw: st.spYaw - w1 * .04, spPitch: st.lean + b * .025 * br.amp, spRoll: s1 * .03 - w2 * .02,
    hdPitch: st.head - b * .015, hdYaw: -st.spYaw * .6 + s2 * .05, hdRoll: -st.roll * 1.5,
    ftFz: st.z, ftBz: -st.z, ftFx: st.x, ftBx: st.x, ftFyaw: .12, ftByaw: .3,
    ftFy: bn * bo.amp * 1.6 * k, ftBy: bn * bo.amp * 1.0 * k,
    hnFx: g.F.x + s1 * .03, hnFy: g.F.y + b * .014 * br.amp + s2 * .03 + bn * bo.amp * .8 * k, hnFz: g.F.z + s1 * .03,
    hnBx: g.B.x - s1 * .02 + w1 * .1, hnBy: g.B.y + b * .014 * br.amp - s2 * .03 + bn * bo.amp * .5 * k + w2 * .07, hnBz: g.B.z + s2 * .03 + w2 * .05,
    hnFflare: g.flareF, hnBflare: g.flareB, hnFfist: g.fist, hnBfist: g.fistB ?? g.fist, hnFroll: g.rollF, hnBroll: g.rollB + w1 * .25,
    hnFpitch: g.pitchF + b * .03, hnBpitch: g.pitchB + w2 * .2,
    shFup: g.shF + b * .02 * br.amp, shBup: g.shB + b * .02 * br.amp, shFfwd: .08, shBfwd: .12,
  }));
  return out;
}

// u = distancia recorrida / zancada (con signo: u decrece al retroceder). El pie de apoyo se mueve exactamente
// a la velocidad del suelo, así no patina.
export function walkPose(out, u, dir, idle, S, rest) {
  const W = S.walk, g = k => idle[IDX[k]], s = (k, v) => { out[IDX[k]] = v; };
  const foot = f => {
    const x = frac(u + f);
    if (x < .5) return { z: W.stepZ * (1 - x * 4), y: 0 };
    const w = (x - .5) * 2; return { z: W.stepZ * (-1 + 2 * smooth(w)), y: W.lift * Math.sin(Math.PI * w) };
  };
  const F = foot(0), B = foot(.5), c = Math.cos(u * TAU), c2 = Math.cos(u * TAU * 2), sn = Math.sin(u * TAU);
  out.set(idle);
  s('ftFz', F.z); s('ftFy', F.y); s('ftBz', B.z); s('ftBy', B.y);
  const toe = (f, z) => Math.min(1, f.y / W.lift) * (-.4 + .7 * smooth((z / W.stepZ + 1) / 2));
  s('ftFpitch', toe(F, F.z)); s('ftBpitch', toe(B, B.z));
  s('comY', g('comY') - W.bob * (.5 + .5 * c2) + W.bob * .5);
  s('pelYaw', g('pelYaw') * .3 + W.hip * c); s('spYaw', g('spYaw') * .4 - W.sp * c); s('hdYaw', -out[IDX.spYaw] * .6);
  s('pelRoll', g('pelRoll') + .04 * sn); s('spRoll', -.035 * sn);
  s('spPitch', g('spPitch') + W.lean * (dir > 0 ? 1 : -.35));
  if (W.arms === 'guard') {
    s('hnFy', g('hnFy') + .04 * c2); s('hnBy', g('hnBy') - .04 * c2);
    s('hnFz', g('hnFz') + W.swing * c * .6); s('hnBz', g('hnBz') - W.swing * c * .6);
  } else { // brazos sueltos que contra-balancean las piernas (con el arma todavía en la mano)
    const a = W.swing * 2.4, fn = F.z / W.stepZ, bn = B.z / W.stepZ;
    s('hnFx', mixv(g('hnFx'), rest.x * .75, .5)); s('hnBx', rest.x * .75);
    s('hnFz', mixv(g('hnFz'), rest.z - a * fn, .6)); s('hnBz', rest.z - a * bn);
    s('hnFy', mixv(g('hnFy'), rest.y + .2, .5)); s('hnBy', rest.y + .18 + .06 * Math.abs(bn));
  }
  return out;
}

// Carrera: tronco muy inclinado, zancadas largas con fase de vuelo; cada guerrero mueve los brazos a su manera.
export function runPose(out, u, idle, S, rest) {
  const R = S.run, g = k => idle[IDX[k]], s = (k, v) => { out[IDX[k]] = v; };
  const x = u => frac(u), leg = ph => { const p = x(u + ph); // 0-.42 apoyo, resto vuelo
    if (p < .42) return { z: R.stride * .3 * (1 - p / .42 * 2), y: 0, p: 0 };
    const w = (p - .42) / .58; return { z: R.stride * .3 * (-1 + 2 * smooth(w)), y: R.lift * Math.sin(Math.PI * w) * (1 + .4 * (1 - w)), p: w }; };
  const F = leg(0), B = leg(.5), c = Math.cos(u * TAU), c2 = Math.cos(u * TAU * 2);
  out.set(idle);
  s('ftFz', F.z); s('ftFy', F.y); s('ftBz', B.z); s('ftBy', B.y); s('ftFx', .05); s('ftBx', .05);
  s('ftFpitch', F.y > 0 ? -.5 + F.p * .9 : 0); s('ftBpitch', B.y > 0 ? -.5 + B.p * .9 : 0);
  s('comY', -.1 - R.bob * (.5 + .5 * c2)); s('comZ', .12);
  s('spPitch', R.lean); s('hdPitch', -R.lean * .7 + (R.head || 0)); s('pelYaw', .12 * c); s('spYaw', -.22 * c); s('hdYaw', .1 * c); s('pelPitch', R.lean * .25);
  const ar = R.arms;
  if (ar === 'ninja') { // brazos atrás, hojas al viento
    s('hnFx', .2); s('hnFy', .15); s('hnFz', -.75); s('hnBx', .2); s('hnBy', .12); s('hnBz', -.8); s('hnFpitch', .6); s('hnBpitch', .6); s('hnFflare', .4); s('hnBflare', .4);
  } else if (ar === 'glide') { // lanza baja hacia delante, mano libre atrás
    s('hnFx', -.05); s('hnFy', -.35); s('hnFz', .55 + .05 * c); s('hnFpitch', -.15); s('hnBx', .3); s('hnBy', -.05); s('hnBz', -.45 - .1 * c); s('hnBflare', .5);
  } else if (ar === 'blade') { // espada atrás arrastrando, puño bombeando
    s('hnFx', .15); s('hnFy', -.45); s('hnFz', -.35); s('hnFpitch', -2.7); s('hnFroll', 0);
    s('hnBx', -.1); s('hnBy', .1 + .12 * c); s('hnBz', .3 - .45 * c); s('hnBfist', 1);
  } else { // bombeo de puños
    s('hnFx', -.05); s('hnFy', .02 - .12 * c); s('hnFz', .25 + .45 * c); s('hnBx', -.05); s('hnBy', .02 + .12 * c); s('hnBz', .25 - .45 * c); s('hnFfist', 1); s('hnBfist', 1);
  }
  return out;
}

// Sentadilla (agacharse, aterrizaje y previa al salto). k = profundidad en largos de pierna.
export function squatPose(out, idle, k, pitch, S, wide = 0) {
  const C = S.crouch, g = n => idle[IDX[n]], s = (n, v) => { out[IDX[n]] = v; };
  out.set(idle);
  s('comY', g('comY') - k); s('comZ', g('comZ') + C.fwd * k / .6);
  s('spPitch', g('spPitch') + pitch); s('hdPitch', g('hdPitch') - pitch * .85);
  s('ftFx', g('ftFx') + wide); s('ftBx', g('ftBx') + wide); s('ftFz', g('ftFz') * .6 + .06); s('ftBz', g('ftBz') * .6 - .04);
  s('ftFy', 0); s('ftBy', 0); s('ftBpitch', -.2 * k / .6);
  const r = k / .6;
  s('hnFy', g('hnFy') + C.guardY * r); s('hnBy', g('hnBy') + C.guardY * r); s('hnFz', g('hnFz') * .9); s('hnBz', g('hnBz') * .9);
  s('shFup', g('shFup') + .08 * r); s('shBup', g('shBup') + .08 * r);
  return out;
}

// Salto: phase = vy / vy_inicial en [-1, 1] (subida → caída). flip ∈ [0,1]: voltereta del doble salto (Zephyr).
export function airPose(out, phase, t, idle, S, rest, tuckK = 1, flip = 0) {
  const A = S.air, g = n => idle[IDX[n]], s = (n, v) => { out[IDX[n]] = v; };
  const up = smooth((phase + .55) / 1.55), dn = 1 - up;
  const fl = A.spin ? Math.sin(t * 7) * .06 : Math.sin(t * 4) * .02;
  out.set(idle);
  s('comY', mixv(-.04, -.12, dn)); s('comZ', 0); s('ftFree', .35);
  s('ftFy', mixv(A.tuckF * .9 * tuckK, .14, dn)); s('ftBy', mixv(A.tuckB * .9 * tuckK, .06, dn));
  s('ftFz', mixv(.26, .12, dn)); s('ftBz', mixv(-.12, -.1, dn)); s('ftFx', .06); s('ftBx', .1);
  s('ftFpitch', mixv(-.35, .1, dn)); s('ftBpitch', mixv(-.5, 0, dn));
  s('spPitch', mixv(.18, .02, dn)); s('spYaw', g('spYaw') * .5); s('pelYaw', g('pelYaw') * .5);
  s('hdPitch', mixv(-.12, -.04, dn)); s('hdYaw', 0);
  if (A.spin) { // brazos abiertos, ligeros
    s('hnFx', mixv(.55, .75, dn) + fl); s('hnFy', mixv(.15, -.1, dn) + fl); s('hnFz', mixv(.15, .1, dn)); s('hnFflare', .4);
    s('hnBx', mixv(.55, .75, dn) - fl); s('hnBy', mixv(.12, -.1, dn) - fl); s('hnBz', mixv(.0, -.05, dn)); s('hnBflare', .4);
  } else {
    s('hnFx', mixv(g('hnFx'), .3, dn * .6)); s('hnFy', mixv(g('hnFy') + .15, -.02, dn)); s('hnFz', mixv(g('hnFz'), .3, dn)); s('hnFflare', .3);
    s('hnBx', mixv(-.25, .42, dn)); s('hnBy', mixv(.3, .02, dn)); s('hnBz', mixv(.4, .05, dn)); s('hnBflare', .3);
  }
  s('shFup', mixv(.15, 0, dn)); s('shBup', mixv(.15, 0, dn));
  if (flip > 0) { // voltereta: el cuerpo gira entero, piernas recogidas
    const w = Math.sin(Math.PI * clamp01(flip)); s('comPitch', TAU * smooth(flip)); s('ftFree', 1);
    s('ftFy', .55 * w + out[IDX.ftFy] * (1 - w)); s('ftBy', .55 * w + out[IDX.ftBy] * (1 - w)); s('ftFz', .3 * w); s('ftBz', .2 * w);
    s('hnFy', -.1 * w + out[IDX.hnFy] * (1 - w)); s('hnFz', .5 * w + out[IDX.hnFz] * (1 - w)); s('hnBz', .45 * w + out[IDX.hnBz] * (1 - w));
  }
  return out;
}

// Retroceso rápido: salto bajo hacia atrás con el cuerpo echado atrás.
export function backdashPose(out, p, idle) {
  const s = (n, v) => { out[IDX[n]] = v; }, h = Math.sin(Math.PI * clamp01(p)), e = clamp01(p);
  out.set(idle);
  s('comY', -.05 + h * .12); s('comZ', -.1 * h); s('spPitch', -.22 * h + .1 * (1 - h)); s('hdPitch', .12 * h); s('ftFree', .4 * h);
  s('ftFy', .32 * h); s('ftBy', .22 * h); s('ftFz', .22 + .1 * h); s('ftBz', -.32 * h - .12); s('ftFpitch', -.3 * h); s('ftBpitch', -.4 * h);
  s('hnFz', idle[IDX.hnFz] * (1 - .3 * h)); s('hnBx', idle[IDX.hnBx] + .25 * h); s('hnBy', idle[IDX.hnBy] - .2 * h); s('hnBz', idle[IDX.hnBz] - .2 * h);
  return out;
}

// Tumbado boca arriba (derribo / K.O.). k: 0 = de pie … 1 = tumbado; air: 1 mientras va despedido.
export function lyingPose(out, base, k, air, t) {
  if (k <= .001) return out;
  const s = (n, v) => { const i = IDX[n]; out[i] = out[i] + (v - out[i]) * k; }, fl = Math.sin(t * 9) * .1 * air;
  s('comPitch', mixv(-1.5, -.9, air)); s('comY', mixv(-.83, -.25, air)); s('comZ', mixv(-.45, -.1, air)); s('comYaw', 0); s('comRoll', 0); s('ftFree', 1);
  s('pelYaw', 0); s('pelRoll', 0); s('pelPitch', mixv(.1, -.2, air)); s('spPitch', mixv(.05, -.35, air)); s('spYaw', 0); s('spRoll', 0);
  s('hdPitch', mixv(-.2, -.45, air)); s('hdYaw', mixv(.4, 0, air)); s('hdRoll', 0);
  s('ftFx', mixv(.2, .06, air)); s('ftBx', mixv(.26, .1, air)); s('ftFy', mixv(.32, .45, air)); s('ftBy', mixv(.05, .25, air)); s('ftFz', mixv(.05, .2 + fl, air)); s('ftBz', mixv(-.05, -.1, air));
  s('ftFpitch', mixv(.3, -.4, air)); s('ftBpitch', mixv(.5, -.5, air));
  s('hnFx', mixv(.75, .7, air)); s('hnFy', mixv(.2, .35 + fl, air)); s('hnFz', mixv(-.15, -.2, air)); s('hnBx', mixv(.82, .8, air)); s('hnBy', mixv(.35, .25 - fl, air)); s('hnBz', mixv(-.1, -.3, air));
  s('hnFflare', .7); s('hnBflare', .7); s('hnFfist', mixv(.3, .2, air)); s('hnBfist', 0); s('hnFpitch', 0); s('hnBpitch', 0); s('hnFroll', 0); s('hnBroll', 0);
  s('shFup', mixv(.3, .4, air)); s('shBup', mixv(.3, .4, air)); s('shFfwd', 0); s('shBfwd', 0);
  return out;
}
