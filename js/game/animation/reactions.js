// Reacciones de combate sobre la pose base: guardia, golpe recibido, bloqueo, guardia rota y agarre. Puras (sin Three.js).
import { IDX, smooth } from './pose.js';
const mixv = (a, b, w) => a + (b - a) * w;
// envolvente de una reacción: ataque rápido, meseta y relajación (p = progreso 0..1 del aturdimiento)
export const env = (p, a = .12) => p <= 0 ? 0 : p < a ? smooth(p / a) : p < .45 ? 1 : p < 1 ? 1 - smooth((p - .45) / .55) : 0;
// envolvente para las manos y los brazos: suben algo más despacio que el tronco (si no, saltan de un fotograma a otro)
const envH = p => env(p, .26);

const to = (o, w) => (k, v) => { const i = IDX[k]; o[i] += (v - o[i]) * w; };   // hacia un valor absoluto
const by = (o, w) => (k, v) => { o[IDX[k]] += v * w; };                         // sumando un desplazamiento

export function guardOverlay(o, w, crouched, S) {
  const g = S.shield, T = to(o, w), A = by(o, w), lo = -.14 * (+crouched || 0); // crouched: 0..1 (suave), no un sí/no
  T('hnFx', g.F.x); T('hnFy', g.F.y + lo); T('hnFz', g.F.z); T('hnBx', g.B.x); T('hnBy', g.B.y + lo); T('hnBz', g.B.z);
  T('hnFflare', g.flareF); T('hnBflare', g.flareB); T('hnFfist', g.fist); T('hnBfist', g.fist); T('hnFroll', g.rollF); T('hnBroll', g.rollB);
  T('hnFpitch', g.pitchF); T('hnBpitch', g.pitchB);
  A('spPitch', .14); A('hdPitch', .14); A('comY', -.06); A('shFup', .3); A('shBup', .3); A('shFfwd', .15); A('shBfwd', .15); A('comZ', -.03);
}

// p = progreso del aturdimiento, k = fuerza, air = en el aire, kind = 'hit' | 'crush', side = alterna izquierda/derecha
export function hitOverlay(o, p, k, air, S, side = 1, kind = 'hit') {
  const e = env(p) * (S.react ?? 1), w = Math.min(1, envH(p) * .95), T = to(o, w), A = by(o, e * k);
  if (kind === 'crush') { // guardia rota: tambaleo largo con los brazos abiertos
    const wob = Math.sin(p * 18) * .12 * env(p);
    A('spPitch', -.25); A('hdPitch', -.3); A('comZ', -.12); A('comY', -.14); A('spRoll', wob); A('hdRoll', -wob * 1.4); A('pelRoll', wob * .4);
    T('hnFx', .65); T('hnFy', .1); T('hnFz', .1); T('hnBx', .7); T('hnBy', .05); T('hnBz', -.1); T('hnFflare', .8); T('hnBflare', .8); T('hnBfist', 0);
    return;
  }
  A('spPitch', -.42); A('hdPitch', -.6); A('comZ', -.18); A('pelPitch', -.14); A('spRoll', .12 * side); A('hdRoll', .16 * side); A('spYaw', -.15 * side); A('hdYaw', .2 * side);
  if (air) { A('ftFy', .32); A('ftBy', .26); A('comY', -.02); A('ftFz', .2); o[IDX.ftFree] = Math.max(o[IDX.ftFree], .6); } else { A('comY', -.1); A('ftBpitch', .3); }
  T('hnFx', .42); T('hnFy', .2); T('hnFz', .02); T('hnBx', .58); T('hnBy', .04); T('hnBz', -.2);
  T('hnFflare', .6); T('hnBflare', .6); T('hnBfist', 0); by(o, e)('shFup', .35); by(o, e)('shBup', .35);
  // latigazo: el cuerpo rebota una vez al soltar el golpe (más vivo en los golpes fuertes)
  const wl = Math.sin(Math.min(1, p) * Math.PI * 3) * .07 * env(p) * k; A('spPitch', wl / Math.max(.2, e * k)); A('hdPitch', wl * 1.5 / Math.max(.2, e * k));
}

export function blockOverlay(o, p, k, t) {
  const e = env(p, .3), A = by(o, e * k), tr = Math.sin(t * 31) * .018 * e; // el temblor del bloqueo, más grave: antes vibraba a 55 Hz
  A('comZ', -.12); A('spPitch', -.08); A('hdPitch', .06); A('comY', -.04); A('ftBz', -.06);
  o[IDX.hnFz] += tr; o[IDX.hnBz] -= tr; o[IDX.hnFy] += tr * .6;
}

// Agarrado: encogido, forcejea con las manos sobre el brazo del rival.
export function thrownOverlay(o, t) {
  const T = to(o, 1), f = Math.sin(t * 24) * .05;
  T('spPitch', .3); T('hdPitch', -.3); T('comY', -.08); T('comZ', .05); T('spYaw', 0); T('pelYaw', 0);
  T('hnFx', -.1); T('hnFy', .35 + f); T('hnFz', .42); T('hnBx', -.15); T('hnBy', .3 - f); T('hnBz', .4); T('hnFfist', .3); T('hnBfist', .3); T('hnFflare', .4); T('hnBflare', .4);
  T('ftFpitch', .2); T('ftBy', .05 + Math.max(0, f));
}
