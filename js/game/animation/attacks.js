// Golpes y gestos de cada guerrero: claves de pose (ver pose.js). Los tiempos están en segundos de DISEÑO;
// en combate cada clip se re-temporiza para que su impacto (meta.hit) caiga en la ventana activa real (data/moves.json).
// meta.trails: [ancla, t0, t1] estelas del arma (wF/wB), manos (hF/hB) o pies (fF/fB).
// meta.fx: [{t, kind, at}] efectos elementales sincronizados con la animación.
import { makeClip } from './pose.js';
export const ATTACKS = ['l', 'm', 'h', 'cl', 'cm', 'ch', 'jl', 'jm', 'jh', 'throw', 's', 'ex', 'gb', 'intro', 'win', 'getup'];

// Levantarse (común): de tumbado boca arriba → sentado apoyando manos → rodilla → de pie.
const getup = () => makeClip('getup', 1, [
  { t: 0, comPitch: -1.5, comY: -.83, comZ: -.45, ftFree: 1, ftFy: .32, ftBy: .05, ftFz: .05, ftBz: -.05, spPitch: .05, hdPitch: -.2, hnFx: .75, hnFy: .2, hnFz: -.15, hnBx: .82, hnBy: .35, hnBz: -.1, hnFflare: .7, hnBflare: .7 },
  { t: .35, e: 'out2', comPitch: -.55, comY: -.75, comZ: -.35, ftFree: .6, ftFy: .4, ftFz: .25, ftBy: .3, ftBz: .05, spPitch: .5, hdPitch: .1, hnFx: .55, hnFy: -.85, hnFz: -.25, hnBx: .6, hnBy: -.85, hnBz: -.35, hnFflare: .3, hnBflare: .3 },
  { t: .7, e: 'io', comPitch: .1, comY: -.45, comZ: 0, ftFree: 0, ftFy: 0, ftFz: .3, ftBy: 0, ftBz: -.25, ftBpitch: -.4, spPitch: .4, hdPitch: -.1, hnFx: .2, hnFy: -.4, hnFz: .4, hnBx: .3, hnBy: -.3, hnBz: .2 },
], {});

// Rompeguardia (común a todos, sin arma): gira el tronco cargando las dos palmas en la cadera, paso largo y doble empuje
// de palmas con todo el peso detrás. Es lento a propósito (se lee y se puede interrumpir con un golpe rápido o esquivar).
function guardBreak(S) {
  const sy = S.stance.spYaw, hy = S.stance.hipYaw;
  return makeClip('gb', .95, [
    { t: .12, e: 'out2', comY: -.18, comZ: -.16, spYaw: sy + .55, pelYaw: hy + .25, spPitch: -.05, hdPitch: -.1,
      hnFx: .25, hnFy: -.42, hnFz: -.05, hnFfist: 0, hnFflare: .5, hnFpitch: .9, hnBx: .3, hnBy: -.45, hnBz: -.2, hnBfist: 0, hnBflare: .5, hnBpitch: .9, ftBz: -.4, shFfwd: -.3, shBfwd: -.3 },
    { t: .26, e: 'io', comY: -.26, comZ: -.2, spYaw: sy + .7, pelYaw: hy + .32, hnFy: -.48, hnBy: -.5, hdPitch: -.14, ftBz: -.46 },
    { t: .34, e: 'in3', comY: -.3, comZ: .5, spYaw: sy - .2, pelYaw: hy - .2, spPitch: .3, hdPitch: .02,
      hnFx: -.02, hnFy: .12, hnFz: 1.08, hnFpitch: -1.1, hnFflare: .1, hnBx: .02, hnBy: -.02, hnBz: 1.0, hnBpitch: -1.1, hnBflare: .1, shFfwd: .55, shBfwd: .55,
      ftFz: .78, ftBz: -.6, ftBpitch: -.7 },
    { t: .48, e: 'lin', comZ: .52, hnFz: 1.06, hnBz: .98 },
    { t: .7, e: 'io', comY: -.14, comZ: .25, spYaw: sy, hnFz: .5, hnBz: .45, shFfwd: .1, shBfwd: .1, ftFz: .45, ftBz: -.35 },
  ], { hit: [.33, .38], trails: [['hF', .26, .42], ['hB', .26, .42]], fx: [{ t: .1, kind: 'gb_charge', at: 'hF' }, { t: .34, kind: 'gb_burst', at: 'hF' }] });
}

export function buildAttacks(S) {
  const st = S.stance, sy = st.spYaw, hy = st.hipYaw, g = S.guard;
  const mk = (name, dur, keys, meta = {}) => makeClip(name, dur, keys, meta);
  // Ángulo de hoja (hnFpitch con espada/lanza): 0 = hacia delante, 1.57 = arriba, -1.57 = abajo, ±3.14 = hacia atrás.
  // spYaw: + adelanta el hombro del lado del arma (F); − adelanta el otro (B).
  const LIB = {
    // ══════════ IGNIS · fuego, impulsivo: espada en la mano adelantada; cortes en arco que acaban en llamas ══════════
    ignis: () => ({
      // ligero: tajo corto en diagonal, del hombro hacia delante
      l: mk('l', .36, [
        { t: .06, e: 'out2', hnFx: -.05, hnFy: .52, hnFz: .4, hnFpitch: 2.0, hnFroll: 0, spYaw: sy - .12, spPitch: .02, hdPitch: -.14 },
        { t: .12, e: 'in2', hnFx: -.1, hnFy: -.02, hnFz: .96, hnFpitch: -.4, spYaw: sy + .2, spPitch: .26, comZ: .14, ftFz: .36, hdPitch: .02 },
        { t: .2, e: 'out2', hnFy: -.1, hnFz: .9, hnFpitch: -.6, spPitch: .28 },
      ], { hit: [.1, .15], trails: [['wF', .06, .2]] }),
      // medio: estocada a fondo con paso largo
      m: mk('m', .5, [
        { t: .12, e: 'out2', hnFx: .15, hnFy: .06, hnFz: -.15, hnFpitch: .05, hnFroll: 0, hnBx: -.25, hnBy: .25, hnBz: .55, spYaw: sy - .3, pelYaw: hy - .1, comZ: -.12, comY: -.08 },
        { t: .21, e: 'in3', hnFx: -.06, hnFy: .14, hnFz: 1.06, hnFpitch: 0, hnBx: .25, hnBy: .05, hnBz: -.35, spYaw: sy + .35, pelYaw: hy + .15, comZ: .36, comY: -.2, spPitch: .34, ftFz: .66, ftBz: -.4, ftBpitch: -.6, shFfwd: .4 },
        { t: .3, e: 'lin', hnFz: 1.05, comZ: .38 },
      ], { hit: [.18, .26], trails: [['wF', .14, .28]] }),
      // pesado: tajo descendente ardiente con todo el cuerpo (de detrás de la cabeza al suelo)
      h: mk('h', .8, [
        { t: .22, e: 'out2', hnFx: .02, hnFy: .98, hnFz: -.1, hnFpitch: 2.7, hnFroll: 0, hnBx: -.12, hnBy: .55, hnBz: .45, spPitch: -.32, spYaw: sy - .2, comY: .02, comZ: -.12, hdPitch: -.3, shFup: .55, ftBz: -.4 },
        { t: .32, e: 'in3', hnFx: -.08, hnFy: -.28, hnFz: .96, hnFpitch: -.5, hnBx: -.1, hnBy: -.15, hnBz: .5, spPitch: .62, spYaw: sy + .15, comY: -.42, comZ: .42, ftFz: .7, ftBz: -.45, ftBpitch: -.7, hdPitch: .25, shFup: 0 },
        { t: .44, e: 'out2', hnFy: -.45, hnFz: .84, hnFpitch: -.85, spPitch: .65, comY: -.45 },
        { t: .62, e: 'io', hnFy: -.3, hnFz: .7, hnFpitch: -.6, spPitch: .45, comY: -.3, comZ: .3 },
      ], { hit: [.3, .38], trails: [['wF', .2, .42]], fx: [{ t: .2, kind: 'ignite', at: 'wF' }, { t: .33, kind: 'flame_arc', at: 'wF' }, { t: .34, kind: 'embers_floor', at: 'wF' }] }),
      // agachado ligero: patada baja y rápida al tobillo
      cl: mk('cl', .34, [
        { t: .06, e: 'out2', ftFy: .12, ftFz: .35, ftFpitch: -.3, spPitch: -.05 },
        { t: .11, e: 'in2', ftFy: .06, ftFz: .95, ftFpitch: .1, ftFx: .02, comZ: -.1, spPitch: -.14, hnBx: -.1, hnBy: -.05, hnBz: .3 },
        { t: .2, e: 'out2', ftFz: .85 },
      ], { hit: [.1, .15], trails: [['fF', .06, .17]] }),
      // agachado medio: barrido de espada a ras de suelo (de atrás hacia delante)
      cm: mk('cm', .48, [
        { t: .1, e: 'out2', hnFx: .2, hnFy: -.45, hnFz: -.2, hnFpitch: -2.5, hnFroll: 0, spYaw: sy - .3, spPitch: .45 },
        { t: .2, e: 'in2', hnFx: -.1, hnFy: -.72, hnFz: .9, hnFpitch: -.3, spYaw: sy + .2, spPitch: .62, comZ: .22, ftFz: .6, hdPitch: .1 },
        { t: .3, e: 'out2', hnFy: -.68, hnFz: .84, hnFpitch: -.2 },
      ], { hit: [.17, .25], trails: [['wF', .1, .28]], fx: [{ t: .2, kind: 'embers_floor', at: 'wF' }] }),
      // agachado pesado: tajo ascendente (antiaéreo que lanza)
      ch: mk('ch', .7, [
        { t: .14, e: 'out2', hnFx: .3, hnFy: -.75, hnFz: -.1, hnFpitch: -2.2, spYaw: sy - .3, spPitch: .45, comY: -.1, hdPitch: .05 },
        { t: .26, e: 'in3', hnFx: -.05, hnFy: 1.0, hnFz: .42, hnFpitch: 1.55, spYaw: sy + .1, spPitch: -.28, comY: .3, comZ: .1, ftFy: .12, ftBy: .3, ftBpitch: -.8, ftFpitch: -.5, hdPitch: -.35, shFup: .4, hnBx: .3, hnBy: -.3, hnBz: -.2 },
        { t: .38, e: 'out2', hnFy: 1.02, hnFz: .2, hnFpitch: 1.8, comY: .26, spPitch: -.32 },
      ], { hit: [.22, .32], trails: [['wF', .14, .38]], fx: [{ t: .23, kind: 'flame_pillar', at: 'wF' }] }),
      // aéreo ligero: tajo corto hacia abajo
      jl: mk('jl', .34, [
        { t: .05, e: 'out2', hnFy: .45, hnFz: .45, hnFpitch: 1.6, hnFx: .05 },
        { t: .11, e: 'in2', hnFy: -.15, hnFz: .9, hnFpitch: -.6, hnFx: -.15, spPitch: .25 },
        { t: .26, e: 'lin', hnFy: -.12, hnFz: .86, hnFpitch: -.6 },
      ], { hit: [.08, .26], trails: [['wF', .05, .2]] }),
      // aéreo medio: patada frontal en el aire
      jm: mk('jm', .38, [
        { t: .07, e: 'out2', ftFy: .5, ftFz: .2, ftFpitch: -.4, spPitch: -.1 },
        { t: .12, e: 'in2', ftFy: .3, ftFz: 1.0, ftFpitch: .4, spPitch: -.3, comZ: -.1, hnFy: .25, hnFz: .2, hnFx: .3, hnFpitch: -1.2, hnBy: .35 },
        { t: .28, e: 'lin', ftFz: .95 },
      ], { hit: [.1, .26], trails: [['fF', .07, .2]] }),
      // aéreo pesado: tajo descendente con las dos manos (golpe alto que derriba)
      jh: mk('jh', .5, [
        { t: .12, e: 'out2', hnFx: -.1, hnFy: 1.0, hnFz: -.05, hnFpitch: 2.6, hnBx: -.15, hnBy: .95, hnBz: -.05, spPitch: -.4, hdPitch: -.3, ftFy: .35, ftBy: .45, shFup: .5, shBup: .5 },
        { t: .21, e: 'in3', hnFx: -.15, hnFy: -.45, hnFz: .8, hnFpitch: -1.0, hnBx: -.2, hnBy: -.4, hnBz: .72, spPitch: .55, hdPitch: .15, ftFy: .45, ftBy: .3, ftFz: .3 },
        { t: .38, e: 'lin', hnFy: -.5, spPitch: .55, hnFpitch: -1.0 },
      ], { hit: [.18, .32], trails: [['wF', .12, .3]], fx: [{ t: .2, kind: 'flame_arc', at: 'wF' }] }),
      // lanzamiento: agarra del cuello, rodillazo y explosión de palma
      throw: mk('throw', .9, [
        { t: .1, e: 'out2', hnBx: -.15, hnBy: .32, hnBz: 1.0, hnBfist: .2, hnBflare: .1, hnFpitch: -1.3, hnFy: -.3, hnFz: .3, comZ: .15, spYaw: sy - .3, spPitch: .15 },
        { t: .3, e: 'in2', hnBz: .62, hnBy: .28, ftFy: .5, ftFz: .45, ftFpitch: -.3, comZ: .05, spPitch: .3, hdPitch: .05, hnFpitch: -1.3 },
        { t: .42, e: 'out2', hnBz: .66, ftFy: 0, ftFz: .25 },
        { t: .55, e: 'out2', hnBx: -.2, hnBy: .3, hnBz: .35, hnBfist: 0, hnBflare: .3, hnBpitch: -.8, spYaw: sy - .4, comZ: -.08 },
        { t: .64, e: 'in3', hnBx: -.15, hnBy: .25, hnBz: 1.05, hnBfist: 0, hnBpitch: -1, spYaw: sy + .3, comZ: .3, spPitch: .25, ftFz: .55, hnFpitch: -1.3 },
      ], { hit: [.1, .55], fx: [{ t: .3, kind: 'impact', at: 'fF' }, { t: .64, kind: 'fire_burst', at: 'hB' }] }),
      // técnica especial: Embestida Ígnea (estocada en carrera envuelta en llamas)
      s: mk('s', .8, [
        { t: .2, e: 'out2', hnFx: .3, hnFy: -.2, hnFz: -.35, hnFpitch: 3.0, hnFroll: 0, hnBx: -.25, hnBy: .2, hnBz: .55, comY: -.32, comZ: -.15, spPitch: .3, spYaw: sy - .4, ftFz: .4, ftBz: -.42, ftBpitch: -.5, hdPitch: .15 },
        { t: .28, e: 'in3', hnFx: -.05, hnFy: .12, hnFz: 1.05, hnFpitch: .02, hnBx: .35, hnBy: .1, hnBz: -.4, comY: -.26, comZ: .48, spPitch: .45, spYaw: sy + .3, ftFz: .8, ftBz: -.55, ftBpitch: -.8, hdPitch: .2 },
        { t: .48, e: 'lin', hnFz: 1.05, comZ: .5, ftFz: .82 },
        { t: .62, e: 'io', hnFz: .8, comZ: .3, comY: -.2 },
      ], { hit: [.26, .48], trails: [['wF', .22, .5]], fx: [{ t: .18, kind: 'ignite', at: 'wF' }, { t: .26, kind: 'fire_dash', at: 'body' }] }),
      // técnica reforzada: Ruptura Carmesí — tres cortes y explosión final
      ex: mk('ex', 1.2, [
        { t: .12, e: 'out2', hnFx: .3, hnFy: -.4, hnFz: .15, hnFpitch: -1.8, comY: -.2, spYaw: sy - .3, spPitch: .3 },
        { t: .22, e: 'in3', hnFx: -.2, hnFy: .85, hnFz: .55, hnFpitch: 1.5, comY: .05, spYaw: sy + .25, spPitch: -.1, comZ: .2, ftFz: .45 },
        { t: .33, e: 'out2', hnFx: -.1, hnFy: .9, hnFz: .1, hnFpitch: 2.4, spYaw: sy - .2, comZ: .15 },
        { t: .43, e: 'in3', hnFx: -.15, hnFy: .0, hnFz: .98, hnFpitch: -.3, spYaw: sy + .3, comZ: .3, ftFz: .55, spPitch: .3 },
        { t: .58, e: 'out2', hnFx: -.05, hnFy: 1.05, hnFz: .1, hnFpitch: 2.8, hnBx: -.1, hnBy: 1.0, hnBz: .05, spPitch: -.35, comY: .1, shFup: .5, shBup: .5, spYaw: sy },
        { t: .72, e: 'in3', hnFx: -.1, hnFy: -.6, hnFz: .85, hnFpitch: -1.0, hnBx: -.15, hnBy: -.55, hnBz: .78, spPitch: .62, comY: -.36, comZ: .35, ftFz: .6, ftBz: -.4, hdPitch: .2, shFup: 0, shBup: 0 },
        { t: .92, e: 'lin', hnFy: -.62, comY: -.38, hnFpitch: -1.0 },
      ], { hit: [.18, .76], trails: [['wF', .12, .78]], fx: [{ t: .1, kind: 'ignite', at: 'wF' }, { t: .22, kind: 'flame_arc', at: 'wF' }, { t: .43, kind: 'flame_arc', at: 'wF' }, { t: .72, kind: 'explosion', at: 'wF' }] }),
      // presentación: voltea la espada, la enciende y apunta al rival
      intro: mk('intro', 1.6, [
        { t: .25, e: 'io', hnFx: .45, hnFy: -.55, hnFz: .05, hnFpitch: -1.5, hnBx: -.1, hnBy: .25, hnBz: .45, hnBfist: 1, spYaw: sy - .1, hdPitch: .1, comY: -.05 },
        { t: .55, e: 'io', hnFx: .1, hnFy: .95, hnFz: .2, hnFpitch: 1.5, wpSpin: 3.14, spPitch: -.15, hdPitch: -.3, shFup: .4 },
        { t: .75, e: 'io', hnFy: 1.0, hnFpitch: 1.6, wpSpin: 6.28, hdPitch: -.35 },
        { t: 1.05, e: 'in3', hnFx: -.05, hnFy: .05, hnFz: .9, hnFpitch: .25, wpSpin: 6.28, spPitch: .2, comZ: .1, hdPitch: -.1 },
        { t: 1.6, e: 'io', wpSpin: 6.28 },
      ], { trails: [['wF', .3, 1.1]], fx: [{ t: .75, kind: 'ignite', at: 'wF' }, { t: 1.05, kind: 'fire_burst', at: 'wF' }] }),
      // victoria: espada en alto, puño cerrado, llamas
      win: mk('win', 1.4, [
        { t: .3, e: 'out2', hnFx: .3, hnFy: -.4, hnFz: .3, hnFpitch: -1.0, comY: -.2, spPitch: .3 },
        { t: .7, e: 'back', hnFx: .05, hnFy: 1.1, hnFz: .15, hnFpitch: 1.6, hnBx: -.3, hnBy: .25, hnBz: .3, hnBfist: 1, spPitch: -.25, hdPitch: -.35, comY: .02, shFup: .5, spYaw: sy * .5 },
        { t: 1.4, e: 'io', hnFy: 1.12, hnFpitch: 1.6, spPitch: -.27, hdPitch: -.38 },
      ], { hold: true, fx: [{ t: .7, kind: 'fire_burst', at: 'wF' }] }),
    }),

    // ══════════ AQUA · agua, serena: lanza larga; movimientos circulares y continuos, la mano libre guía el agua ══════════
    aqua: () => ({
      // ligero: punzada rápida con la lanza, sin mover el cuerpo
      l: mk('l', .38, [
        { t: .06, e: 'out2', hnFz: .3, hnFy: -.1, hnFpitch: .15, hnBx: .1, hnBy: .1, hnBz: .2, spYaw: sy - .1 },
        { t: .12, e: 'in2', hnFx: -.05, hnFy: .02, hnFz: 1.02, hnFpitch: .02, spYaw: sy + .25, comZ: .08, spPitch: .1, hnBx: .3, hnBy: .0, hnBz: -.3 },
        { t: .22, e: 'out2', hnFz: .95 },
      ], { hit: [.1, .16], trails: [['wF', .06, .2]] }),
      // medio: molinete por encima de la cabeza que cae en arco
      m: mk('m', .55, [
        { t: .1, e: 'io', hnFx: .05, hnFy: .65, hnFz: .35, hnFpitch: 2.2, hnBx: .2, hnBy: .5, hnBz: .4, hnBflare: .6, spYaw: sy - .2, spPitch: -.12, comY: .02 },
        { t: .2, e: 'in2', hnFx: -.05, hnFy: .1, hnFz: .98, hnFpitch: -.25, hnBx: .45, hnBy: .15, hnBz: -.25, spYaw: sy + .25, spPitch: .22, comZ: .18, ftFz: .45, pelRoll: .1 },
        { t: .32, e: 'out2', hnFy: 0, hnFz: .9, hnFpitch: -.4 },
      ], { hit: [.18, .26], trails: [['wF', .08, .3]], fx: [{ t: .2, kind: 'splash_arc', at: 'wF' }] }),
      // pesado: estocada de agua — zancada muy larga con la lanza a fondo y la mano libre atrás
      h: mk('h', .82, [
        { t: .24, e: 'out2', hnFx: .1, hnFy: .05, hnFz: -.25, hnFpitch: .1, hnBx: -.1, hnBy: .3, hnBz: .6, hnBflare: .5, spYaw: sy - .45, pelYaw: hy - .2, comY: -.15, comZ: -.2, spPitch: -.05, ftBz: -.35, hdPitch: .05 },
        { t: .33, e: 'in3', hnFx: -.05, hnFy: .1, hnFz: 1.08, hnFpitch: 0, hnBx: .45, hnBy: .2, hnBz: -.6, hnBflare: .8, spYaw: sy + .45, pelYaw: hy + .25, comY: -.38, comZ: .55, spPitch: .3, ftFz: .85, ftBz: -.6, ftBpitch: -.8, hdPitch: .1, shFfwd: .5 },
        { t: .48, e: 'lin', hnFz: 1.08, comZ: .56 },
        { t: .66, e: 'io', hnFz: .8, comZ: .3, comY: -.2 },
      ], { hit: [.3, .42], trails: [['wF', .24, .45]], fx: [{ t: .33, kind: 'water_spear', at: 'wF' }] }),
      // agachado ligero: pinchazo a los tobillos
      cl: mk('cl', .34, [
        { t: .06, e: 'out2', hnFy: -.35, hnFz: .4, hnFpitch: -.3 },
        { t: .11, e: 'in2', hnFx: -.05, hnFy: -.55, hnFz: .95, hnFpitch: -.35, spPitch: .4, comZ: .08 },
        { t: .2, e: 'out2', hnFz: .9 },
      ], { hit: [.1, .15], trails: [['wF', .06, .17]] }),
      // agachado medio: barrido largo de lanza a ras de suelo
      cm: mk('cm', .52, [
        { t: .12, e: 'out2', hnFx: .3, hnFy: -.4, hnFz: -.1, hnFpitch: -2.7, hnBx: .3, hnBy: -.2, hnBz: .5, spYaw: sy - .4, spPitch: .45 },
        { t: .22, e: 'in2', hnFx: -.05, hnFy: -.62, hnFz: .95, hnFpitch: -.2, hnBx: .5, hnBy: -.1, hnBz: -.3, spYaw: sy + .3, spPitch: .55, comZ: .25, ftFz: .65 },
        { t: .34, e: 'out2', hnFz: .9, hnFpitch: -.15 },
      ], { hit: [.19, .28], trails: [['wF', .1, .3]], fx: [{ t: .22, kind: 'splash_floor', at: 'wF' }] }),
      // agachado pesado: molinete ascendente que levanta una columna de agua (lanza al rival)
      ch: mk('ch', .72, [
        { t: .14, e: 'out2', hnFx: .1, hnFy: -.6, hnFz: .35, hnFpitch: -1.2, hnBx: .2, hnBy: -.5, hnBz: .45, hnBflare: .5, spPitch: .45, comY: -.1 },
        { t: .27, e: 'in2', hnFx: -.05, hnFy: .95, hnFz: .5, hnFpitch: 1.5, wpSpin: 0, hnBx: .3, hnBy: .9, hnBz: .3, spPitch: -.25, comY: .45, ftBy: .2, ftBpitch: -.6, hdPitch: -.3, shFup: .4, shBup: .4 },
        { t: .4, e: 'out2', hnFy: 1.0, hnFz: .35, hnFpitch: 1.6, wpSpin: 3.14, comY: .35 },
        { t: .55, e: 'io', wpSpin: 6.28 },
        { t: .72, e: 'lin', wpSpin: 6.28 },
      ], { hit: [.23, .34], trails: [['wF', .14, .5]], fx: [{ t: .24, kind: 'water_pillar', at: 'wF' }] }),
      // aéreo ligero: punzada hacia abajo
      jl: mk('jl', .34, [
        { t: .05, e: 'out2', hnFz: .4, hnFy: .1, hnFpitch: .1 },
        { t: .11, e: 'in2', hnFz: .95, hnFy: -.2, hnFpitch: -.5, spPitch: .2 },
        { t: .26, e: 'lin', hnFz: .92, hnFpitch: -.5 },
      ], { hit: [.08, .26], trails: [['wF', .05, .2]] }),
      // aéreo medio: barrido horizontal en el aire con giro de cadera
      jm: mk('jm', .4, [
        { t: .08, e: 'out2', hnFx: .2, hnFy: .4, hnFz: .2, hnFpitch: 2.0, spYaw: sy - .3, hnBx: .5, hnBy: .3 },
        { t: .14, e: 'in2', hnFx: -.05, hnFy: -.05, hnFz: 1.0, hnFpitch: -.15, spYaw: sy + .35, spPitch: .1, hnBx: .6, hnBy: .1, hnBz: -.3 },
        { t: .3, e: 'lin', hnFz: .96 },
      ], { hit: [.12, .28], trails: [['wF', .06, .24]], fx: [{ t: .14, kind: 'splash_arc', at: 'wF' }] }),
      // aéreo pesado: lanza clavada hacia abajo
      jh: mk('jh', .5, [
        { t: .12, e: 'out2', hnFy: .7, hnFz: .2, hnFpitch: 1.0, spPitch: -.3, ftFy: .4, ftBy: .5 },
        { t: .21, e: 'in3', hnFx: -.05, hnFy: -.7, hnFz: .55, hnFpitch: -1.25, spPitch: .5, hdPitch: .2, hnBx: .5, hnBy: .4, ftFy: .5, ftBy: .3 },
        { t: .38, e: 'lin', hnFy: -.72, hnFpitch: -1.25 },
      ], { hit: [.18, .32], trails: [['wF', .12, .3]], fx: [{ t: .21, kind: 'splash_arc', at: 'wF' }] }),
      // lanzamiento: atrapa con la mano libre, gira la lanza alrededor del cuello y lo despide con un chorro
      throw: mk('throw', .9, [
        { t: .1, e: 'out2', hnBx: -.1, hnBy: .3, hnBz: 1.0, hnBfist: .3, hnBflare: .1, comZ: .12, spYaw: sy + .2, spPitch: .1, hnFz: .3, hnFpitch: 1.4 },
        { t: .3, e: 'io', hnBz: .7, comYaw: -.6, spYaw: sy + .5, hnFx: .1, hnFy: .5, hnFz: .6, hnFpitch: 2.2 },
        { t: .5, e: 'io', comYaw: -.2, hnBz: .8, hnFy: .3, hnFz: .9, hnFpitch: .2 },
        { t: .62, e: 'in3', comYaw: .35, hnBx: -.05, hnBy: .2, hnBz: 1.05, hnBfist: 0, hnBflare: .5, hnBpitch: -1, hnFz: .5, hnFpitch: 1.2, spYaw: sy - .3, comZ: .25, ftFz: .5 },
      ], { hit: [.1, .55], fx: [{ t: .62, kind: 'water_burst', at: 'hB' }] }),
      // técnica especial: Hidrolanza (la mano libre empuja el agua concentrada mientras la lanza apunta)
      s: mk('s', .75, [
        { t: .22, e: 'io', hnBx: .1, hnBy: .15, hnBz: .15, hnBfist: 0, hnBflare: .6, hnBpitch: .4, hnFy: .1, hnFz: .5, hnFpitch: .3, spYaw: sy - .35, comY: -.15, comZ: -.1, ftBz: -.32 },
        { t: .3, e: 'in3', hnBx: -.05, hnBy: .18, hnBz: 1.0, hnBpitch: -1.1, hnBflare: .2, hnFy: -.1, hnFz: .55, hnFpitch: -.4, spYaw: sy - .7, comZ: .2, comY: -.18, spPitch: .2, ftFz: .45 },
        { t: .5, e: 'lin', hnBz: 1.0 },
      ], { hit: [.28, .34], fx: [{ t: .08, kind: 'water_charge', at: 'hB' }, { t: .3, kind: 'water_burst', at: 'hB' }] }),
      // técnica reforzada: Marea Abisal (gran círculo con los dos brazos y empuje de la marea)
      ex: mk('ex', .9, [
        { t: .15, e: 'io', hnBx: .55, hnBy: -.4, hnBz: .1, hnBfist: 0, hnBflare: .6, hnFy: -.3, hnFz: .3, hnFpitch: -.8, comY: -.25, spPitch: .3, spYaw: sy - .2 },
        { t: .32, e: 'io', hnBx: .2, hnBy: .95, hnBz: .2, hnFy: .6, hnFz: .4, hnFpitch: 1.8, comY: .0, spPitch: -.2, hdPitch: -.25, shBup: .4 },
        { t: .44, e: 'in3', hnBx: -.05, hnBy: .2, hnBz: 1.02, hnBpitch: -1.2, hnFy: .05, hnFz: 1.0, hnFpitch: 0, comY: -.25, comZ: .35, spPitch: .35, spYaw: sy - .4, ftFz: .6, ftBz: -.45 },
        { t: .66, e: 'lin', hnBz: 1.0, hnFz: 1.0 },
      ], { hit: [.42, .48], trails: [['hB', .1, .45], ['wF', .2, .46]], fx: [{ t: .1, kind: 'water_charge', at: 'hB' }, { t: .44, kind: 'tide_burst', at: 'hB' }] }),
      // presentación: hace girar la lanza, la clava en el suelo e inclina la cabeza
      intro: mk('intro', 1.6, [
        { t: .2, e: 'io', hnFx: .1, hnFy: .1, hnFz: .55, hnFpitch: 0, wpSpin: 0, hnBx: .4, hnBy: .2, hnBz: .3, hnBflare: .6 },
        { t: .6, e: 'lin', wpSpin: 6.28 * 1.5, hnFy: .2, hnFz: .5, hnBx: .5, hnBy: .4, hnBz: .1 },
        { t: .9, e: 'out2', hnFx: .25, hnFy: -.25, hnFz: .25, hnFpitch: 1.57, wpSpin: 6.28 * 1.5, hnBx: -.3, hnBy: .25, hnBz: .3, hnBfist: 0, hdPitch: .35, spPitch: .15, comY: -.06 },
        { t: 1.3, e: 'io', hnFpitch: 1.57, wpSpin: 6.28 * 1.5, hdPitch: .3 },
        { t: 1.6, e: 'io', wpSpin: 6.28 * 2 },
      ], { trails: [['wF', .2, .7]], fx: [{ t: .9, kind: 'splash_floor', at: 'wF' }] }),
      // victoria: la lanza clavada a su lado, mano libre sobre el pecho, serena
      win: mk('win', 1.4, [
        { t: .5, e: 'io', hnFx: .35, hnFy: -.3, hnFz: .15, hnFpitch: 1.57, hnBx: -.45, hnBy: .05, hnBz: .3, hnBfist: 0, hnBflare: .1, hdPitch: .1, hdRoll: .12, spPitch: -.05, spYaw: sy * .3, pelYaw: hy * .3, comY: .02, ftFz: .12, ftBz: -.12 },
        { t: 1.4, e: 'io', hnFpitch: 1.57, hnBy: .08, hdRoll: .15, hdPitch: .05 },
      ], { hold: true, fx: [{ t: .5, kind: 'water_swirl', at: 'body' }] }),
    }),

    // ══════════ TERRA · tierra, firme: guanteletes de piedra; golpes cortos y pesados, todo el peso en cada impacto ══════════
    terra: () => ({
      // ligero: directo corto con el puño adelantado
      l: mk('l', .38, [
        { t: .07, e: 'out2', hnFz: .4, hnFy: .14, spYaw: sy - .1 },
        { t: .13, e: 'in2', hnFx: -.04, hnFy: .14, hnFz: 1.06, hnFflare: .05, spYaw: sy + .25, comZ: .16, spPitch: .22, shFfwd: .5, ftFz: .32 },
        { t: .22, e: 'out2', hnFz: .9 },
      ], { hit: [.11, .17], trails: [['wF', .07, .19]] }),
      // medio: cruzado de derecha con giro de cadera y paso
      m: mk('m', .55, [
        { t: .14, e: 'out2', hnBx: -.3, hnBy: .1, hnBz: .0, spYaw: sy + .3, pelYaw: hy + .2, comY: -.2, spPitch: .15, ftFx: .24, ftBx: .26 },
        { t: .24, e: 'in3', hnBx: -.15, hnBy: .16, hnBz: 1.02, hnBflare: 0, hnFx: -.35, hnFy: .12, hnFz: .35, spYaw: -.3, pelYaw: -.12, comZ: .32, comY: -.22, spPitch: .38, ftFz: .52, ftBz: -.3, shBfwd: .6, shBup: .15 },
        { t: .34, e: 'lin', hnBz: 1.0 },
      ], { hit: [.22, .3], trails: [['wB', .14, .32]], fx: [{ t: .24, kind: 'rock_impact', at: 'wB' }] }),
      // pesado: martillo con los dos puños desde arriba, pisotón (armadura durante la carga)
      h: mk('h', .9, [
        { t: .28, e: 'io', hnFx: -.15, hnFy: 1.0, hnFz: .12, hnBx: -.18, hnBy: 1.0, hnBz: .05, spPitch: -.3, comY: .04, ftFy: .4, ftFz: .4, hdPitch: -.25, shFup: .55, shBup: .55 },
        { t: .38, e: 'in3', hnFx: -.15, hnFy: -.5, hnFz: .72, hnBx: -.18, hnBy: -.52, hnBz: .66, spPitch: .7, comY: -.55, comZ: .25, ftFy: 0, ftFz: .55, ftBz: -.35, hdPitch: .2, shFup: 0, shBup: 0 },
        { t: .52, e: 'out2', comY: -.58, spPitch: .72 },
        { t: .72, e: 'io', comY: -.35, spPitch: .45 },
      ], { hit: [.36, .46], trails: [['wF', .28, .42], ['wB', .28, .42]], fx: [{ t: .1, kind: 'stone_glow', at: 'body' }, { t: .38, kind: 'quake', at: 'wF' }] }),
      // agachado ligero: puño bajo a las rodillas
      cl: mk('cl', .36, [
        { t: .07, e: 'out2', hnFz: .4, hnFy: -.3 },
        { t: .12, e: 'in2', hnFx: -.12, hnFy: -.55, hnFz: .9, spPitch: .45, comZ: .08 },
        { t: .22, e: 'out2', hnFz: .85 },
      ], { hit: [.1, .16], trails: [['wF', .07, .18]] }),
      // agachado medio: patada baja de pisotón
      cm: mk('cm', .5, [
        { t: .12, e: 'out2', ftFy: .3, ftFz: .3, ftFpitch: .3, spPitch: .2 },
        { t: .21, e: 'in3', ftFy: .04, ftFz: .92, ftFpitch: -.1, comZ: -.05, spPitch: .1, hnFy: -.1, hnBy: -.05 },
        { t: .32, e: 'out2', ftFz: .85 },
      ], { hit: [.19, .27], trails: [['fF', .12, .28]], fx: [{ t: .21, kind: 'dust', at: 'fF' }] }),
      // agachado pesado: gancho ascendente de piedra (lanza al rival)
      ch: mk('ch', .78, [
        { t: .18, e: 'out2', hnBx: -.15, hnBy: -.7, hnBz: .15, spPitch: .55, comY: -.15, spYaw: sy + .2 },
        { t: .3, e: 'in3', hnBx: -.25, hnBy: 1.0, hnBz: .5, hnBflare: 0, spPitch: -.32, spYaw: -.3, comY: .5, comZ: .12, ftBy: .15, ftBpitch: -.7, hdPitch: -.35, shBup: .5 },
        { t: .44, e: 'out2', hnBy: 1.02, comY: .45 },
      ], { hit: [.27, .38], trails: [['wB', .16, .42]], fx: [{ t: .27, kind: 'rock_spikes', at: 'wB' }] }),
      // aéreo ligero: puño hacia abajo
      jl: mk('jl', .34, [
        { t: .05, e: 'out2', hnFz: .35, hnFy: .25 },
        { t: .11, e: 'in2', hnFx: -.12, hnFy: -.25, hnFz: .85, spPitch: .3 },
        { t: .26, e: 'lin', hnFz: .82 },
      ], { hit: [.08, .26], trails: [['wF', .05, .2]] }),
      // aéreo medio: rodillazo
      jm: mk('jm', .38, [
        { t: .07, e: 'out2', ftFy: .4, ftFz: .1 },
        { t: .13, e: 'in2', ftFy: .7, ftFz: .6, ftFpitch: -.6, spPitch: .1, hnFy: .3, hnBy: .25 },
        { t: .28, e: 'lin', ftFy: .7 },
      ], { hit: [.11, .26], trails: [['fF', .06, .2]] }),
      // aéreo pesado: doble martillo en caída
      jh: mk('jh', .52, [
        { t: .14, e: 'out2', hnFx: -.15, hnFy: 1.0, hnFz: .1, hnBx: -.18, hnBy: 1.0, hnBz: .05, spPitch: -.35, ftFy: .4, ftBy: .5, shFup: .5, shBup: .5 },
        { t: .23, e: 'in3', hnFx: -.15, hnFy: -.6, hnFz: .6, hnBx: -.18, hnBy: -.6, hnBz: .55, spPitch: .62, ftFy: .5, ftBy: .35, shFup: 0, shBup: 0 },
        { t: .4, e: 'lin', hnFy: -.6 },
      ], { hit: [.2, .34], trails: [['wF', .14, .3], ['wB', .14, .3]], fx: [{ t: .23, kind: 'rock_impact', at: 'wF' }] }),
      // lanzamiento: agarra con las dos manos, cabezazo y empujón con pisotón
      throw: mk('throw', .95, [
        { t: .1, e: 'out2', hnFx: -.05, hnFy: .3, hnFz: .95, hnBx: -.1, hnBy: .25, hnBz: .9, hnFfist: .4, hnBfist: .4, comZ: .12, spPitch: .15 },
        { t: .3, e: 'out2', hnFz: .7, hnBz: .68, spPitch: -.25, hdPitch: -.3, comZ: -.05 },
        { t: .4, e: 'in3', spPitch: .45, hdPitch: .55, comZ: .22 },
        { t: .55, e: 'io', hnFz: .45, hnBz: .45, spPitch: .1, hdPitch: 0, comZ: 0, ftFy: .4, ftFz: .35 },
        { t: .66, e: 'in3', hnFx: -.1, hnFy: .2, hnFz: 1.05, hnBx: -.15, hnBy: .15, hnBz: 1.02, hnFfist: 0, hnBfist: 0, hnFflare: .1, hnBflare: .1, comZ: .32, ftFy: 0, ftFz: .55, spPitch: .3 },
      ], { hit: [.1, .55], fx: [{ t: .4, kind: 'impact', at: 'head' }, { t: .66, kind: 'quake', at: 'fF' }] }),
      // técnica especial: Fisura de Colmillos — se hunde girando la cadera, arrastra la mano adelantada por el suelo
      // en un barrido bajo y la clava hacia delante: una hilera de colmillos de piedra corre hacia el rival
      s: mk('s', .95, [
        { t: .14, e: 'out2', comY: -.42, comZ: -.08, spYaw: sy + .75, pelYaw: hy + .3, spPitch: .35, spRoll: -.1, hdPitch: .05, hdYaw: -.2,
          hnFx: .32, hnFy: -.55, hnFz: -.18, hnFfist: .2, hnFflare: .6, hnBx: -.1, hnBy: .02, hnBz: .38, ftFz: .3, ftBz: -.42, ftBx: .1 },
        { t: .26, e: 'in2', comY: -.6, spYaw: sy + .2, hnFx: .15, hnFy: -.92, hnFz: .35, spPitch: .62 },
        { t: .34, e: 'in3', comY: -.66, comZ: .3, spYaw: sy - .4, pelYaw: hy - .2, spPitch: .78, spRoll: .05, hdPitch: .1, hdYaw: 0,
          hnFx: -.02, hnFy: -.98, hnFz: 1.02, hnFfist: .55, hnFflare: .2, hnFpitch: -.4, hnBx: .25, hnBy: -.1, hnBz: -.1, shFfwd: .55, ftFz: .78, ftFpitch: -.1, ftBz: -.62, ftBpitch: -.7 },
        { t: .5, e: 'lin', comY: -.66, comZ: .32, hnFz: 1.0 },
        { t: .78, e: 'io', comY: -.28, comZ: .1, spYaw: sy, spPitch: .3, hnFy: -.2, hnFz: .55, shFfwd: .1, ftFz: .45, ftBz: -.35 },
      ], { hit: [.32, .38], trails: [['wF', .18, .4]], fx: [{ t: .12, kind: 'stone_glow', at: 'body' }, { t: .26, kind: 'dust', at: 'wF' }, { t: .34, kind: 'b_ground_rip', at: 'wF' }] }),
      // técnica reforzada: Ola Tectónica — se agacha y agarra el suelo con las dos manos, lo arranca de un tirón
      // arqueando la espalda y lo empuja con las palmas: una ola de losas de piedra rueda hacia el rival y lo lanza
      ex: mk('ex', 1.05, [
        { t: .12, e: 'out2', comY: -.72, comZ: -.05, spPitch: .82, hdPitch: .35, spYaw: sy * .4, pelYaw: hy * .4,
          hnFx: .32, hnFy: -.98, hnFz: .42, hnFfist: 1, hnFflare: .5, hnBx: .36, hnBy: -.98, hnBz: .32, hnBfist: 1, hnBflare: .5, ftFx: .18, ftBx: .18, ftFz: .32, ftBz: -.3 },
        { t: .2, e: 'in2', comY: -.78, hnFy: -1.0, hnBy: -1.0, spPitch: .86 },
        { t: .32, e: 'io', comY: .06, comZ: -.12, spPitch: -.32, hdPitch: -.34, spYaw: 0, pelYaw: 0,
          hnFx: .12, hnFy: 1.02, hnFz: .28, hnBx: .14, hnBy: 1.0, hnBz: .22, shFup: .6, shBup: .6, ftFz: .25, ftBz: -.25 },
        { t: .42, e: 'out2', comY: -.42, comZ: .38, spPitch: .5, hdPitch: .1, spYaw: sy * .3,
          hnFx: -.04, hnFy: -.25, hnFz: 1.08, hnFfist: 0, hnFpitch: -.9, hnFflare: .15, hnBx: .02, hnBy: -.3, hnBz: 1.02, hnBfist: 0, hnBpitch: -.9, hnBflare: .15,
          shFup: 0, shBup: 0, shFfwd: .55, shBfwd: .55, ftFz: .7, ftBz: -.55, ftBpitch: -.6 },
        { t: .62, e: 'lin', comY: -.44, comZ: .4 },
        { t: .87, e: 'io', comY: -.2, comZ: .12, spPitch: .25, hnFy: .0, hnFz: .55, hnBy: -.05, hnBz: .45, shFfwd: .1, shBfwd: .1, hnFfist: 1, hnBfist: 1, hnFpitch: 0, hnBpitch: 0 },
      ], { hit: [.4, .46], trails: [['wF', .3, .46], ['wB', .3, .46]], fx: [{ t: .05, kind: 'stone_glow', at: 'body' }, { t: .28, kind: 'b_heave', at: 'body' }, { t: .42, kind: 'quake_big', at: 'wF' }] }),
      // presentación: choca los guanteletes y planta los pies
      intro: mk('intro', 1.6, [
        { t: .3, e: 'io', hnFx: .3, hnFy: .3, hnFz: .45, hnBx: .3, hnBy: .3, hnBz: .45, comY: .02, spPitch: -.1 },
        { t: .45, e: 'in3', hnFx: -.42, hnFy: .25, hnFz: .55, hnBx: -.42, hnBy: .25, hnBz: .55, spPitch: .1 },
        { t: .8, e: 'io', hnFx: -.42, hnFy: .26, hnFz: .55, hnBx: -.42, hnBy: .26, hnBz: .55, ftFy: .45, ftFz: .4, comY: .02 },
        { t: .95, e: 'in3', ftFy: 0, ftFz: .3, comY: -.32, spPitch: .25, hnFx: -.2, hnFy: .1, hnFz: .55, hnBx: -.28, hnBy: .05, hnBz: .45 },
        { t: 1.6, e: 'io', comY: -.25 },
      ], { fx: [{ t: .45, kind: 'rock_impact', at: 'wF' }, { t: .95, kind: 'quake', at: 'fF' }] }),
      // victoria: brazos cruzados, barbilla alta (estoica)
      win: mk('win', 1.4, [
        { t: .55, e: 'io', hnFx: -.55, hnFy: -.05, hnFz: .32, hnBx: -.58, hnBy: -.02, hnBz: .28, hnFflare: .1, hnBflare: .1, spPitch: -.12, hdPitch: -.18, comY: .04, spYaw: sy * .3, pelYaw: hy * .3, ftFx: .2, ftBx: .2, ftFz: .1, ftBz: -.1 },
        { t: .9, e: 'io', hdPitch: .1 },
        { t: 1.4, e: 'io', hnFx: -.55, hnBx: -.58, hdPitch: -.15 },
      ], { hold: true, fx: [{ t: .55, kind: 'stone_glow', at: 'body' }] }),
    }),

    // ══════════ ZEPHYR · viento, provocador: hojas gemelas en agarre invertido; giros, volteretas y cortes cruzados ══════════
    zephyr: () => ({
      // ligero: revés rápido con la hoja adelantada
      l: mk('l', .3, [
        { t: .05, e: 'out2', hnFx: .2, hnFy: .25, hnFz: .35, hnFroll: .8, spYaw: sy - .15 },
        { t: .1, e: 'in2', hnFx: -.25, hnFy: .1, hnFz: .98, hnFroll: -.4, spYaw: sy + .3, comZ: .1, spPitch: .15 },
        { t: .18, e: 'out2', hnFz: .85 },
      ], { hit: [.08, .13], trails: [['wF', .05, .16]] }),
      // medio: corte cruzado con las dos hojas (de arriba-fuera hacia abajo-dentro)
      m: mk('m', .45, [
        { t: .1, e: 'out2', hnFx: .45, hnFy: .65, hnFz: .35, hnBx: .45, hnBy: .6, hnBz: .3, spPitch: -.15, comY: .03, hdPitch: -.2, shFup: .3, shBup: .3 },
        { t: .19, e: 'in2', hnFx: -.45, hnFy: -.25, hnFz: .9, hnBx: -.4, hnBy: -.2, hnBz: .85, spPitch: .35, comZ: .2, comY: -.12, ftFz: .5, hdPitch: .1, shFup: 0, shBup: 0 },
        { t: .28, e: 'out2', hnFz: .8, hnBz: .75 },
      ], { hit: [.16, .23], trails: [['wF', .09, .25], ['wB', .09, .25]], fx: [{ t: .18, kind: 'wind_x', at: 'body' }] }),
      // pesado: patada giratoria alta (una vuelta completa: conecta al volver a mirar al rival)
      h: mk('h', .72, [
        { t: .1, e: 'out2', comYaw: -.5, spRoll: -.1, hnFx: .55, hnFy: .1, hnBx: .55, hnBy: .15, comY: -.1 },
        { t: .21, e: 'in2', comYaw: 3.3, ftBy: .5, ftBz: .1, ftBx: .15, ftFree: .2, spRoll: -.25, hnFx: .75, hnFy: .3, hnBx: .75, hnBy: .1, comY: .02 },
        { t: .29, e: 'out2', comYaw: 6.0, ftBy: 1.02, ftBz: .55, ftBx: .1, ftBpitch: .2, spRoll: -.45, spPitch: -.12 },
        { t: .37, e: 'lin', comYaw: 6.35, ftBy: 1.04, ftBz: .58 },
        { t: .54, e: 'out2', comYaw: 6.283, ftBy: .15, ftBz: -.1, spRoll: 0, ftFree: 0 },
      ], { hit: [.28, .37], trails: [['fB', .19, .4], ['wF', .2, .42]], fx: [{ t: .29, kind: 'wind_ring', at: 'fB' }] }),
      // agachado ligero: tajo bajo con la hoja trasera
      cl: mk('cl', .3, [
        { t: .05, e: 'out2', hnBx: .3, hnBy: -.4, hnBz: .1, spYaw: sy + .2 },
        { t: .1, e: 'in2', hnBx: -.2, hnBy: -.6, hnBz: .85, spYaw: sy - .3, spPitch: .4, comZ: .08 },
        { t: .18, e: 'out2', hnBz: .75 },
      ], { hit: [.08, .13], trails: [['wB', .05, .16]] }),
      // agachado medio: barrida deslizante (patada a ras de suelo, cuerpo echado atrás)
      cm: mk('cm', .48, [
        { t: .1, e: 'out2', comY: -.1, spPitch: -.1, ftFz: .4 },
        { t: .19, e: 'in2', ftFy: .04, ftFz: 1.05, ftFpitch: .3, comY: -.25, comZ: .15, spPitch: -.3, hnFx: .4, hnFy: -.6, hnFz: -.2, hnBx: .45, hnBy: -.65, hnBz: -.35, hdPitch: .2 },
        { t: .32, e: 'lin', ftFz: 1.05 },
      ], { hit: [.17, .3], trails: [['fF', .1, .3]], fx: [{ t: .19, kind: 'dust', at: 'fF' }] }),
      // agachado pesado: voltereta hacia atrás con patada ascendente (lanza al rival)
      ch: mk('ch', .72, [
        { t: .1, e: 'out2', comY: -.2, spPitch: .3, hnFx: .4, hnBx: .4, hnFy: -.3, hnBy: -.3 },
        { t: .22, e: 'out2', comPitch: -1.6, comY: .7, ftFree: 1, ftFy: .7, ftFz: .6, ftBy: .3, ftBz: .1, hnFx: .7, hnFy: .1, hnBx: .7, hnBy: .1, spPitch: -.2 },
        { t: .32, e: 'lin', comPitch: -3.3, comY: 1.05, ftFree: 1, ftFy: .55, ftBy: .5 },
        { t: .46, e: 'out2', comPitch: -6.283, comY: .3, ftFree: 1, ftFy: .5, ftBy: .5, ftFz: .25 },
        { t: .58, e: 'io', comPitch: -6.283, comY: -.05, ftFree: 0 },
        { t: .72, e: 'lin', comPitch: -6.283 },
      ], { hit: [.2, .34], trails: [['fF', .12, .4]], fx: [{ t: .22, kind: 'wind_ring', at: 'fF' }] }),
      // aéreo ligero: tajo corto
      jl: mk('jl', .3, [
        { t: .05, e: 'out2', hnFx: .2, hnFy: .3, hnFz: .4, hnFroll: .8 },
        { t: .1, e: 'in2', hnFx: -.2, hnFy: -.05, hnFz: .95, hnFroll: -.4, spPitch: .15 },
        { t: .24, e: 'lin', hnFz: .9 },
      ], { hit: [.08, .24], trails: [['wF', .05, .18]] }),
      // aéreo medio: giro en el aire con las hojas abiertas
      jm: mk('jm', .42, [
        { t: .06, e: 'out2', comYaw: -.4, hnFx: .9, hnFy: .1, hnFz: .3, hnBx: .9, hnBy: .1, hnBz: .1 },
        { t: .3, e: 'lin', comYaw: 6.283, hnFx: .95, hnBx: .95 },
        { t: .38, e: 'out2', comYaw: 6.283 },
      ], { hit: [.08, .3], trails: [['wF', .06, .32], ['wB', .06, .32]], fx: [{ t: .08, kind: 'wind_ring', at: 'body' }] }),
      // aéreo pesado: caída en picado cruzando las hojas
      jh: mk('jh', .5, [
        { t: .12, e: 'out2', hnFx: .4, hnFy: .9, hnFz: .1, hnBx: .4, hnBy: .85, hnBz: .05, spPitch: -.3, ftFy: .45, ftBy: .5, shFup: .4, shBup: .4 },
        { t: .21, e: 'in3', hnFx: -.35, hnFy: -.6, hnFz: .6, hnBx: -.3, hnBy: -.55, hnBz: .55, spPitch: .55, ftFy: .4, ftBy: .3, shFup: 0, shBup: 0 },
        { t: .38, e: 'lin', hnFy: -.62 },
      ], { hit: [.18, .32], trails: [['wF', .12, .3], ['wB', .12, .3]], fx: [{ t: .21, kind: 'wind_x', at: 'body' }] }),
      // lanzamiento: lo agarra, salta sobre él y lo despide con una patada doble
      throw: mk('throw', .9, [
        { t: .1, e: 'out2', hnBx: -.1, hnBy: .32, hnBz: 1.0, hnBfist: .4, comZ: .12, spPitch: .1 },
        { t: .32, e: 'out2', comY: .5, ftFree: .8, ftFy: .5, ftBy: .55, ftFz: .3, hnBz: .75, hnBy: .1, spPitch: .3, comPitch: .3 },
        { t: .5, e: 'io', comY: .55, comPitch: -.4, ftFy: .65, ftFz: .85, ftBy: .6, ftBz: .75, ftFpitch: .3, ftBpitch: .3, hnBz: .3, hnFx: .6, hnBx: .6 },
        { t: .62, e: 'out2', comY: .1, comPitch: 0, ftFree: 0, ftFy: 0, ftBy: 0, ftFz: .2, ftBz: -.2 },
      ], { hit: [.1, .5], trails: [['fF', .42, .58], ['fB', .42, .58]], fx: [{ t: .5, kind: 'wind_burst', at: 'fF' }] }),
      // técnica especial: Tempestad Errante (se agacha, desaparece en ráfaga, cruza y corta)
      s: mk('s', .78, [
        { t: .15, e: 'out2', comY: -.35, comZ: -.1, spPitch: .45, hnFx: .2, hnFy: .2, hnFz: .3, hnBx: .3, hnBy: .1, hnBz: .1, ftFz: .35, ftBz: -.45, ftBpitch: -.6, hdPitch: -.1 },
        { t: .2, e: 'in2', comY: -.3, comZ: .4, spPitch: .6, hnFx: .45, hnFy: .1, hnFz: -.7, hnBx: .45, hnBy: .05, hnBz: -.75, hnFpitch: .5, hnBpitch: .5, ftFz: .6, ftBz: -.6, ftBy: .2, hdPitch: -.3 },
        { t: .37, e: 'lin', comZ: .45, comY: -.28 },
        { t: .46, e: 'out2', hnFx: -.4, hnFy: .1, hnFz: .9, hnBx: -.35, hnBy: .0, hnBz: .85, hnFpitch: 0, hnBpitch: 0, spPitch: .3, comZ: .2, comY: -.18 },
      ], { hit: [.15, .37], trails: [['wF', .15, .48], ['wB', .15, .48]], fx: [{ t: .14, kind: 'wind_vanish', at: 'body' }, { t: .37, kind: 'wind_x', at: 'body' }] }),
      // técnica reforzada: torbellino de cortes (varias vueltas con las hojas abiertas)
      ex: mk('ex', 1.0, [
        { t: .1, e: 'out2', comY: -.25, spPitch: .3, hnFx: .2, hnBx: .2, hnFy: .1, hnBy: .1, comYaw: -.4 },
        { t: .2, e: 'in2', comY: .2, comYaw: 1.6, hnFx: .95, hnFy: .15, hnFz: .3, hnBx: .95, hnBy: .05, hnBz: .1, spPitch: 0 },
        { t: .62, e: 'lin', comYaw: 6.283 * 2, comY: .25 },
        { t: .78, e: 'out2', comYaw: 6.283 * 2 + .2, comY: -.1, hnFx: -.4, hnFy: -.1, hnFz: .9, hnBx: -.35, hnBy: -.15, hnBz: .85, spPitch: .35 },
        { t: 1.0, e: 'io', comYaw: 6.283 * 2 },
      ], { hit: [.12, .7], trails: [['wF', .12, .8], ['wB', .12, .8]], fx: [{ t: .1, kind: 'wind_vanish', at: 'body' }, { t: .2, kind: 'tornado', at: 'body' }, { t: .78, kind: 'wind_x', at: 'body' }] }),
      // presentación: voltereta en el sitio, gira las hojas y hace un gesto de «ven»
      intro: mk('intro', 1.6, [
        { t: .12, e: 'out2', comY: -.2, spPitch: .3 },
        { t: .3, e: 'out2', comPitch: -2.2, comY: .9, ftFree: 1, ftFy: .55, ftBy: .55 },
        { t: .4, e: 'lin', comPitch: -4.2, comY: 1.0, ftFree: 1 },
        { t: .52, e: 'in2', comPitch: -6.283, comY: .2, ftFree: 1, ftFy: .3, ftBy: .3 },
        { t: .66, e: 'out2', comPitch: -6.283, comY: -.15, ftFree: 0, ftFy: 0, ftBy: 0 },
        { t: .9, e: 'io', comPitch: -6.283, comY: -.05, hnBx: -.05, hnBy: .3, hnBz: .8, hnBpitch: .9, hnBfist: .2, hdRoll: .25, spPitch: -.05 },
        { t: 1.05, e: 'io', comPitch: -6.283, hnBpitch: -.2 }, { t: 1.2, e: 'io', comPitch: -6.283, hnBpitch: .9 },
        { t: 1.6, e: 'io', comPitch: -6.283 },
      ], { fx: [{ t: .15, kind: 'wind_burst', at: 'fF' }, { t: .66, kind: 'dust', at: 'fF' }] }),
      // victoria: voltereta y pose despreocupada (hoja al hombro, cabeza ladeada)
      win: mk('win', 1.4, [
        { t: .1, e: 'out2', comY: -.2 },
        { t: .25, e: 'out2', comPitch: -2.2, comY: .9, ftFree: 1, ftFy: .55, ftBy: .55 },
        { t: .35, e: 'lin', comPitch: -4.2, comY: 1.0, ftFree: 1 },
        { t: .47, e: 'in2', comPitch: -6.283, comY: .2, ftFree: 1, ftFy: .3, ftBy: .3 },
        { t: .6, e: 'out2', comPitch: -6.283, comY: 0, ftFree: 0, ftFy: 0, ftBy: 0 },
        { t: .9, e: 'io', comPitch: -6.283, hnFx: .12, hnFy: .62, hnFz: -.22, hnFroll: .3, hnFfist: 0, hnFflare: .5, hnBx: .14, hnBy: .58, hnBz: -.24, hnBfist: 0, hnBflare: .5, shFup: .25, shBup: .25, hdRoll: .22, hdPitch: -.08, spPitch: -.06, pelRoll: .1, comX: .03, ftFz: .22, ftBz: -.05, ftFx: .02 }, // manos tras la nuca, despreocupado
        { t: 1.4, e: 'io', comPitch: -6.283, hdRoll: .32 },
      ], { hold: true, fx: [{ t: .1, kind: 'wind_burst', at: 'fF' }] }),
    }),
  };
  const id = LIB[S.id] ? S.id : 'ignis', set = LIB[id]();
  set.getup = getup();
  set.gb = guardBreak(S);
  return set;
}

// Re-temporiza un clip de diseño sobre un golpe real: el momento de impacto del clip cae justo en la
// ventana activa del golpe (startup → active → recovery de moves.json). Sin `def` (gestos) va en tiempo lineal.
// Lanzamiento: alcance → sujeción (dura lo que dura el agarre) → lanzamiento; si falla, el brazo vuelve.
export function warpTime(clip, a) {
  const d = a.def; if (!d) return a.t;
  const [h0, h1] = clip.hit || [clip.dur * .35, clip.dur * .6], su = d.startup, ac = d.active, rc = d.recovery, t = a.t, end = clip.dur - 1e-3;
  if (d.throw) {
    if (a.done) return Math.min(end, h1 + (t - a.g0 - .42) / .28 * (clip.dur - h1));
    if (a.grab) return h0 + Math.min(1, (t - a.g0) / .42) * (h1 - h0);
    if (t < su) return t / su * h0;
    if (t < su + ac) return h0;
    return Math.max(0, h0 * (1 - (t - su - ac) / rc));
  }
  if (t < su) return su > 0 ? t / su * h0 : h0;
  if (t < su + ac) return h0 + (t - su) / ac * (h1 - h0);
  if (rc <= .001) return Math.min(end, h1 + (t - su - ac) * .5);
  return Math.min(end, h1 + (t - su - ac) / rc * (clip.dur - h1));
}
