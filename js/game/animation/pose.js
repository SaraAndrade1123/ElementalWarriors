// Poses por canales (sin Three.js: se puede probar con Node).
// Todos los valores son DESVIACIONES expresadas en el espacio del personaje:
//   X = su izquierda, Y = arriba, Z = delante. Distancias en alturas de pierna/brazo, ángulos en radianes.
// «F» = lado adelantado (lead), «B» = lado atrasado. El Animator los traduce a izquierda/derecha.
export const CH = [
  'comX', 'comY', 'comZ', 'comYaw',                        // cadera completa (desplazamiento, en unidades del modelo)
  'pelYaw', 'pelRoll', 'pelPitch',                 // pelvis  (yaw/roll: + = hacia el lado lead)
  'spPitch', 'spYaw', 'spRoll',                    // columna (pitch: + = inclina hacia delante)
  'hdPitch', 'hdYaw', 'hdRoll',                    // cabeza  (pitch: + = mira abajo)
  'ftFx', 'ftFy', 'ftFz', 'ftFpitch', 'ftFyaw',    // pie delantero: x afuera+, y arriba+, z delante+ (× largo de pierna); pitch + = punta arriba
  'ftBx', 'ftBy', 'ftBz', 'ftBpitch', 'ftByaw',
  'hnFx', 'hnFy', 'hnFz', 'hnFroll', 'hnFfist', 'hnFflare', // mano delantera RELATIVA AL HOMBRO (× largo de brazo)
  'hnBx', 'hnBy', 'hnBz', 'hnBroll', 'hnBfist', 'hnBflare',
  'shFup', 'shFfwd', 'shBup', 'shBfwd',            // hombros: elevar / adelantar
  'comPitch', 'comRoll',                           // inclinación del cuerpo entero (volteretas, caídas); + pitch = hacia delante
  'ftFree',                                        // 0 = pies plantados en el suelo, 1 = los pies siguen al cuerpo (en el aire)
  'hnFpitch', 'hnBpitch',                          // flexión de muñeca (+ = dorso hacia arriba / arma hacia arriba)
  'wpSpin'                                         // giro extra del arma alrededor del puño (molinetes)
];
export const N = CH.length;
export const IDX = Object.fromEntries(CH.map((n, i) => [n, i]));

export const makePose = (o, base) => { const p = base ? Float32Array.from(base) : new Float32Array(N); if (o) for (const k in o) { if (!(k in IDX)) throw new Error('Canal desconocido: ' + k); p[IDX[k]] = o[k]; } return p; };
export const lerpInto = (out, a, b, w) => { for (let i = 0; i < N; i++) out[i] = a[i] + (b[i] - a[i]) * w; return out; };
export const addInto = (out, a, w = 1) => { for (let i = 0; i < N; i++) out[i] += a[i] * w; return out; };

export const clamp01 = x => x < 0 ? 0 : x > 1 ? 1 : x;
export const smooth = x => { x = clamp01(x); return x * x * (3 - 2 * x); };
export const EASE = {
  lin: x => x,
  io: smooth,
  in2: x => x * x,
  in3: x => x * x * x,
  out2: x => 1 - (1 - x) * (1 - x),
  out3: x => 1 - Math.pow(1 - x, 3),
  back: x => { const c = 1.9; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); }, // sobrepasa y asienta
};

// Clip = lista de claves {t, e, ...canales}. Cada canal se interpola sólo entre las claves que lo nombran;
// antes de la primera y después de la última vuelve al valor BASE vivo (idle, aire, agachado…), así que
// los clips se mezclan solos con lo que el cuerpo esté haciendo.
export function makeClip(name, dur, keys, meta = {}) {
  const track = {};
  for (const k of keys) for (const c in k) {
    if (c === 't' || c === 'e') continue;
    if (!(c in IDX)) throw new Error(`Clip ${name}: canal desconocido ${c}`);
    (track[IDX[c]] ||= []).push({ t: k.t, v: k[c], e: k.e || 'io' });
  }
  for (const c in track) track[c].sort((a, b) => a.t - b.t);
  // Sin «rebotes» de un fotograma: si un canal llega rápido a un extremo (in2/in3/lin) y sale rápido en sentido contrario
  // (out2/out3/lin/back), el brazo daba media vuelta a toda velocidad. Ahora la salida arranca desde quieto (io): el golpe
  // sigue llegando seco, pero se ve el instante del impacto antes de recoger.
  const FAST_IN = { in2: 1, in3: 1, lin: 1 }, FAST_OUT = { out2: 1, out3: 1, lin: 1, back: 1 };
  for (const c in track) {
    const ks = track[c];
    for (let i = 1; i < ks.length - 1; i++) {
      const a = ks[i - 1].v, b = ks[i].v, n = ks[i + 1].v;
      const nx = ks[i + 1].e, burst = nx === 'out2' || nx === 'out3' || nx === 'back';
      if ((b - a) * (n - b) < 0 && ((FAST_IN[ks[i].e] && FAST_OUT[nx]) || (burst && Math.abs(n - b) > .05))) ks[i + 1] = { ...ks[i + 1], e: 'io' }; // (v1.8) en todo cambio de sentido, la salida arranca desde quieto (sacar el arma de la funda, preparar el golpe…)
    }
  }
  return { name, dur, track, chs: Object.keys(track).map(Number), lastT: Math.max(0, ...keys.map(k => k.t)), ...meta };
}
// canales de giro completo (volteretas, molinetes): 2π equivale a 0
const TURN = new Set(['comPitch', 'comYaw', 'comRoll', 'wpSpin'].map(k => IDX[k]));
export function evalClip(clip, t, base, out) {
  out.set(base);
  for (const c of clip.chs) {
    const ks = clip.track[c]; let t0 = 0, v0 = base[c];
    for (let i = 0; i <= ks.length; i++) {
      let k = i < ks.length ? ks[i] : { t: clip.dur, v: clip.hold ? v0 : base[c], e: 'io' }; // un clip que se mantiene (victoria, derrota) no vuelve a la base canal a canal
      if (i === ks.length && TURN.has(+c)) { const d = v0 - base[c], w = d - Math.round(d / (2 * Math.PI)) * 2 * Math.PI; v0 = base[c] + w; } // al volver a la base, un giro completo no se deshace hacia atrás
      if (t <= k.t) { out[c] = k.t - t0 < 1e-6 ? k.v : v0 + (k.v - v0) * EASE[k.e]((t - t0) / (k.t - t0)); break; } // clave en t = 0: vale desde el primer instante
      t0 = k.t; v0 = k.v;
    }
  }
  return out;
}
