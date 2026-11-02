// Animaciones de CONTROL ELEMENTAL (sin arma): 3 por guerrero, hechas desde cero con claves de pose (ver pose.js).
// Igual que attacks.js: tiempos de DISEÑO; meta.hit = instante que cae en la ventana activa real (data/bending.json).
// Principios: anticipación clara (se lee qué viene), liberación en 2-3 fotogramas con todo el cuerpo detrás,
// seguimiento con peso y vuelta suave a la guardia. El arma se queda en su mano: la técnica sale de la otra mano,
// de las dos o de los pies, como en las artes marciales de control de los elementos.
//   eb · proyección elemental      eu · técnica ascendente / de zona      ej · técnica aérea
// meta.sfx: efectos sostenidos que dibuja bending-vfx.js mientras dura el clip ({kind, t0, t1, at}).
import { makeClip } from './pose.js';
export const BENDING_CLIPS = ['eb', 'eu', 'ej'];

export function buildBending(S) {
  const sy = S.stance.spYaw, hy = S.stance.hipYaw, mk = makeClip;
  const LIB = {
    // ══════════ IGNIS · fuego: respiración de fuego, golpes explosivos desde la cadera; la espada queda en guardia baja ══════════
    ignis: () => ({
      // Puño de Fuego: inspira y carga el puño libre en la cadera (la llama prende), paso largo y directo que dispara la bola de fuego
      eb: mk('eb', .78, [
        { t: .07, e: 'out2', comY: -.1, comZ: -.08, spYaw: sy + .28, pelYaw: hy + .12, spPitch: .06, hdPitch: -.12,
          hnBx: .2, hnBy: -.36, hnBz: -.12, hnBfist: 1, hnBroll: .4, hnFx: .05, hnFy: -.25, hnFz: .38, hnFpitch: -.5, ftBz: -.36, shBfwd: -.25 },
        { t: .19, e: 'io', comY: -.17, comZ: -.12, spYaw: sy + .36, pelYaw: hy + .16, hnBx: .22, hnBy: -.4, hnBz: -.2, shBfwd: -.35, hdPitch: -.16, ftBz: -.42 },
        { t: .245, e: 'in3', comY: -.22, comZ: .3, spYaw: sy - .82, pelYaw: hy - .42, spPitch: .24, hdPitch: -.02,
          hnBx: -.1, hnBy: .2, hnBz: 1.08, hnBfist: 1, hnBroll: 0, hnBpitch: 0, shBfwd: .5, hnFx: .32, hnFy: -.42, hnFz: -.12, hnFpitch: -2.5,
          ftFz: .64, ftBz: -.52, ftBpitch: -.65 },
        { t: .36, e: 'lin', comZ: .32, hnBz: 1.06, spYaw: sy - .8 },
        { t: .54, e: 'io', comY: -.12, comZ: .16, spYaw: sy - .3, hnBx: -.15, hnBy: .12, hnBz: .55, shBfwd: .1, hnFx: .15, hnFy: -.3, hnFz: .2, hnFpitch: -1.2 },
      ], { hit: [.24, .28], trails: [['hB', .22, .36]], fx: [{ t: .06, kind: 'b_fist_ignite', at: 'hB' }, { t: .245, kind: 'b_fire_muzzle', at: 'hB' }],
        sfx: [{ kind: 'fire_hand', t0: .06, t1: .25, at: 'hB' }] }),

      // Arco Llameante: se agacha, salta girando la cadera y traza con la pierna adelantada una media luna de fuego hacia arriba
      eu: mk('eu', .92, [
        { t: .06, e: 'out2', comY: -.3, comZ: -.05, spPitch: .34, hdPitch: -.25, hnBx: .3, hnBy: -.5, hnBz: .1, hnBfist: 1, hnFx: .2, hnFy: -.45, hnFz: .2, hnFpitch: -1.2, ftBz: -.32, ftFz: .3 },
        { t: .13, e: 'in2', comY: -.05, comZ: .05, spPitch: .05, ftFree: .4, ftFy: .35, ftFz: .35, ftFpitch: -.4, hnBx: .35, hnBy: .1, hnBz: -.25, hnFy: .2, hnFz: .4, hnFpitch: .6 },
        { t: .22, e: 'out3', comY: .38, comZ: .12, comPitch: -.28, spPitch: -.32, hdPitch: -.35, ftFree: .85, ftFy: 1.32, ftFz: .52, ftFpitch: .45, ftBy: .12, ftBz: -.2, ftBpitch: -.6,
          hnBx: .5, hnBy: .55, hnBz: -.45, hnBfist: 0, hnBflare: .6, hnFx: .1, hnFy: .95, hnFz: .25, hnFpitch: 1.7, shFup: .3 },
        { t: .33, e: 'out2', comY: .34, comPitch: -.4, spPitch: -.38, ftFy: 1.12, ftFz: -.08, ftFpitch: .7, hnFy: 1.0, hnFz: -.05, hnFpitch: 2.2, hnBy: .35, hnBz: -.55 },
        { t: .5, e: 'in2', comY: -.24, comZ: .02, comPitch: 0, spPitch: .28, ftFree: 0, ftFy: 0, ftFz: .28, ftFpitch: 0, ftBy: 0, hnFy: -.1, hnFz: .45, hnFpitch: .2, hnBx: .25, hnBy: -.2, hnBz: .2, hdPitch: .05, shFup: 0 },
        { t: .7, e: 'io', comY: -.08, spPitch: .1 },
      ], { hit: [.18, .34], trails: [['fF', .13, .4]], fx: [{ t: .06, kind: 'b_ground_flare', at: 'fF' }, { t: .2, kind: 'b_fire_whoosh', at: 'fF' }],
        sfx: [{ kind: 'fire_arc', t0: .14, t1: .44, at: 'fF' }] }),

      // Patada Cometa: en el aire recoge las piernas y lanza una patada de empeine hacia abajo; de la punta sale un cometa de fuego
      ej: mk('ej', .56, [
        { t: .06, e: 'out2', comPitch: -.2, spPitch: -.15, ftFy: .62, ftFz: .12, ftBy: .5, ftBz: -.1, hnBx: .3, hnBy: .35, hnBz: .2, hnBfist: 1, hnFx: .25, hnFy: .1, hnFz: .1, hnFpitch: 1.2 },
        { t: .16, e: 'in3', comPitch: .32, spPitch: .3, hdPitch: .2, ftFy: .12, ftFz: 1.0, ftFpitch: -.5, ftBy: .55, ftBz: -.35, hnBx: .45, hnBy: .2, hnBz: -.45, hnFx: .35, hnFy: .3, hnFz: -.3, hnFpitch: 2.4 },
        { t: .3, e: 'lin', comPitch: .34, ftFz: .96, ftFy: .14 },
        { t: .48, e: 'io', comPitch: .1, ftFy: .4, ftFz: .3, spPitch: .1 },
      ], { hit: [.15, .19], trails: [['fF', .1, .3]], fx: [{ t: .155, kind: 'b_fire_muzzle', at: 'fF' }], sfx: [{ kind: 'fire_foot', t0: .03, t1: .16, at: 'fF' }] }),
    }),

    // ══════════ AQUA · agua: la mano libre dibuja el agua en círculos continuos; la lanza acompaña, nunca corta el flujo ══════════
    aqua: () => ({
      // Látigo de Agua: recoge el agua en un círculo bajo-alto con la mano libre y la descarga en un latigazo largo (2 impactos)
      eb: mk('eb', .9, [
        { t: .1, e: 'io', comY: -.16, comZ: -.06, spYaw: sy + .22, pelYaw: hy + .1, pelRoll: .1, spPitch: .12,
          hnBx: .45, hnBy: -.55, hnBz: -.2, hnBfist: 0, hnBflare: .75, hnBpitch: .6, hnFx: .25, hnFy: .25, hnFz: .05, hnFpitch: 2.3 },
        { t: .21, e: 'io', comY: -.06, comZ: -.08, spYaw: sy + .15, pelRoll: -.06, spPitch: -.14, hdPitch: -.12,
          hnBx: .32, hnBy: .78, hnBz: .05, hnBpitch: .5, hnBflare: .6, hnFy: .35, hnFpitch: 2.4, shBup: .35 },
        { t: .3, e: 'in3', comY: -.2, comZ: .3, spYaw: sy - .72, pelYaw: hy - .32, pelRoll: .05, spPitch: .26, hdPitch: .02,
          hnBx: -.06, hnBy: .18, hnBz: 1.06, hnBpitch: -.55, hnBflare: .3, shBup: 0, shBfwd: .45, hnFx: .3, hnFy: .1, hnFz: -.2, hnFpitch: 2.6, ftFz: .6, ftBz: -.46, ftBpitch: -.6 },
        { t: .38, e: 'out2', hnBy: -.02, hnBz: .95, hnBpitch: -1.05, spPitch: .3 },
        { t: .44, e: 'in2', hnBy: .1, hnBz: 1.02, hnBpitch: -.4 },
        { t: .66, e: 'io', comY: -.1, comZ: .14, spYaw: sy - .2, hnBx: .1, hnBy: .1, hnBz: .55, hnBpitch: 0, hnBflare: .55, shBfwd: .1, hnFpitch: 1.2 },
      ], { hit: [.3, .44], trails: [['hB', .08, .46]], fx: [{ t: .08, kind: 'b_water_draw', at: 'hB' }],
        sfx: [{ kind: 'water_ribbon', t0: .06, t1: .31, at: 'hB' }, { kind: 'water_whip', t0: .29, t1: .5, at: 'hB' }] }),

      // Géiser: baja las dos manos al suelo con las palmas abajo, «levanta» el agua con esfuerzo y la suelta en una columna lejana
      eu: mk('eu', 1.0, [
        { t: .1, e: 'io', comY: -.36, comZ: -.02, spPitch: .38, hdPitch: .1, pelRoll: .05, ftBz: -.3, ftFz: .32,
          hnBx: .22, hnBy: -.72, hnBz: .55, hnBfist: 0, hnBflare: .7, hnBpitch: .9, hnFx: .1, hnFy: -.55, hnFz: .45, hnFpitch: -.3 },
        { t: .3, e: 'in2', comY: -.3, spPitch: .3, hnBy: -.5, hnBz: .62, hnBpitch: 1.1, hnBflare: .9, hnFy: -.4, hdPitch: -.05 },
        { t: .4, e: 'out3', comY: .03, comZ: .05, spPitch: -.26, hdPitch: -.32, pelRoll: -.04,
          hnBx: .28, hnBy: .98, hnBz: .45, hnBpitch: .2, hnBflare: .5, hnFx: .15, hnFy: .7, hnFz: .35, hnFpitch: 1.6, shBup: .45, shFup: .3, ftFy: .0 },
        { t: .62, e: 'lin', hnBy: 1.0, comY: .05, spPitch: -.27 },
        { t: .84, e: 'io', comY: -.08, spPitch: .06, hnBy: .25, hnBz: .45, hnBpitch: .2, shBup: 0, shFup: 0, hnFy: .1, hnFpitch: .6 },
      ], { hit: [.38, .42], fx: [{ t: .1, kind: 'b_water_sink', at: 'hB' }, { t: .4, kind: 'b_water_lift', at: 'hB' }],
        sfx: [{ kind: 'water_hands', t0: .1, t1: .4, at: 'hB' }, { kind: 'geyser_mark', t0: .1, t1: .42, at: 'body' }] }),

      // Agujas de Hielo: en el aire junta las manos al hombro, congela el agua y la abanica hacia abajo en tres agujas
      ej: mk('ej', .6, [
        { t: .07, e: 'out2', comPitch: -.15, spPitch: -.12, spYaw: sy + .2, hnBx: .3, hnBy: .5, hnBz: -.15, hnBfist: 0, hnBflare: .5, hnFx: .2, hnFy: .4, hnFz: .05, hnFpitch: 1.2, ftFy: .45, ftBy: .5 },
        { t: .17, e: 'in3', comPitch: .36, spPitch: .38, spYaw: sy - .55, hdPitch: .22, hnBx: -.08, hnBy: -.25, hnBz: 1.0, hnBpitch: -.9, hnBflare: 1, shBfwd: .4, hnFx: .3, hnFy: .1, hnFz: -.3, hnFpitch: 1.9, ftFy: .3, ftFz: .2, ftBy: .6, ftBz: -.3 },
        { t: .32, e: 'lin', comPitch: .38, hnBz: .98 },
        { t: .52, e: 'io', comPitch: .1, spPitch: .1, hnBz: .45, hnBy: .1, shBfwd: 0 },
      ], { hit: [.16, .2], trails: [['hB', .1, .3]], fx: [{ t: .07, kind: 'b_ice_form', at: 'hB' }], sfx: [{ kind: 'ice_hand', t0: .04, t1: .17, at: 'hB' }] }),
    }),

    // ══════════ TERRA · tierra: raíz en el suelo; cada técnica nace de un pisotón y se empuja con todo el peso ══════════
    terra: () => ({
      // Meteorito: se hunde con las palmas hacia arriba y «levanta» una roca del suelo con las dos manos, la sube por
      // encima de la cabeza y la lanza con un empuje a dos manos dando un paso largo (nada de pisotones: es la técnica que levita)
      eb: mk('eb', 1.12, [
        { t: .12, e: 'out2', comY: -.5, comZ: -.04, spPitch: .45, hdPitch: .2, ftFz: .34, ftBz: -.34, ftFx: .12, ftBx: .12,
          hnFx: .12, hnFy: -.78, hnFz: .55, hnFfist: 0, hnFflare: .45, hnFpitch: .9, hnBx: .08, hnBy: -.8, hnBz: .45, hnBfist: 0, hnBflare: .45, hnBpitch: .9 },
        { t: .3, e: 'io', comY: -.1, spPitch: -.08, hdPitch: -.25, hnFx: .05, hnFy: .35, hnFz: .55, hnBx: .02, hnBy: .3, hnBz: .5, shFup: .2, shBup: .2 },
        { t: .42, e: 'out2', comY: .02, comZ: -.12, spPitch: -.3, hdPitch: -.42, hnFx: .04, hnFy: 1.0, hnFz: .3, hnBx: .02, hnBy: .98, hnBz: .25, shFup: .55, shBup: .55, ftBz: -.45 },
        { t: .52, e: 'in3', comY: -.32, comZ: .36, spPitch: .42, hdPitch: .05, spYaw: sy * .4,
          hnFx: -.02, hnFy: .25, hnFz: 1.08, hnFpitch: .9, hnBx: .02, hnBy: .2, hnBz: 1.02, hnBpitch: .9, shFup: 0, shBup: 0, shFfwd: .5, shBfwd: .5, ftFz: .66, ftBz: -.5, ftBpitch: -.6 },
        { t: .66, e: 'lin', comZ: .38, hnFz: 1.06 },
        { t: .9, e: 'io', comY: -.14, comZ: .14, spYaw: sy, spPitch: .1, hnFz: .6, hnFy: .1, hnBz: .45, hnBy: .05, shFfwd: .1, shBfwd: .1, hnFfist: 1, hnBfist: 1, hnFpitch: 0, hnBpitch: 0 },
      ], { hit: [.5, .55], trails: [['hF', .46, .62], ['hB', .46, .62]], fx: [{ t: .1, kind: 'b_stone_wake', at: 'body' }, { t: .12, kind: 'b_stomp', at: 'fF' }, { t: .52, kind: 'b_rock_punch', at: 'hF' }],
        sfx: [{ kind: 'boulder_rise', t0: .12, t1: .5, at: 'body' }] }),

      // Muro de Piedra: se hunde con las palmas hacia arriba y levanta de golpe una pared de roca delante de él
      eu: mk('eu', .92, [
        { t: .1, e: 'out2', comY: -.42, comZ: -.04, spPitch: .46, hdPitch: .15, ftFz: .38, ftBz: -.36,
          hnFx: .1, hnFy: -.72, hnFz: .6, hnFfist: 0, hnFflare: .4, hnFpitch: 1.1, hnBx: .05, hnBy: -.75, hnBz: .52, hnBfist: 0, hnBflare: .4, hnBpitch: 1.1 },
        { t: .22, e: 'in2', comY: -.5, spPitch: .54, hnFy: -.8, hnBy: -.82 },
        { t: .32, e: 'out3', comY: -.08, comZ: .08, spPitch: -.12, hdPitch: -.1, ftFz: .45,
          hnFx: -.05, hnFy: .72, hnFz: .74, hnFpitch: -1.2, hnFflare: .7, hnBx: -.1, hnBy: .68, hnBz: .66, hnBpitch: -1.2, hnBflare: .7, shFup: .3, shBup: .3 },
        { t: .56, e: 'lin', comY: -.1, hnFy: .7, hnBy: .66 },
        { t: .78, e: 'io', comY: -.12, spPitch: .1, hnFy: .1, hnFz: .5, hnBy: .05, hnBz: .45, hnFpitch: 0, hnBpitch: 0, shFup: 0, shBup: 0, hnFfist: 1, hnBfist: 1 },
      ], { hit: [.3, .34], fx: [{ t: .1, kind: 'b_stone_wake', at: 'body' }, { t: .3, kind: 'b_stomp', at: 'fF' }], sfx: [] }),

      // Lluvia de Rocas: en el aire arranca un trozo del guantelete y lo martillea hacia abajo con los dos puños
      ej: mk('ej', .64, [
        { t: .08, e: 'out2', comPitch: -.22, spPitch: -.36, hdPitch: -.2, hnFx: -.12, hnFy: .98, hnFz: .12, hnBx: -.16, hnBy: .95, hnBz: .08, shFup: .5, shBup: .5, ftFy: .5, ftBy: .5 },
        { t: .21, e: 'in3', comPitch: .34, spPitch: .58, hdPitch: .2, hnFx: -.1, hnFy: -.32, hnFz: .86, hnBx: -.14, hnBy: -.3, hnBz: .74, shFup: 0, shBup: 0, ftFy: .35, ftFz: .1, ftBy: .55, ftBz: -.25 },
        { t: .38, e: 'lin', comPitch: .36, hnFy: -.36 },
        { t: .58, e: 'io', comPitch: .1, spPitch: .1, hnFy: .1, hnFz: .5, hnBy: .05, hnBz: .45 },
      ], { hit: [.2, .24], trails: [['wF', .12, .3], ['wB', .12, .3]], fx: [{ t: .08, kind: 'b_stone_wake', at: 'wF' }, { t: .21, kind: 'b_rock_punch', at: 'wF' }], sfx: [{ kind: 'rock_hands', t0: .05, t1: .21, at: 'wF' }] }),
    }),

    // ══════════ ZEPHYR · aire: movimientos circulares, todo gira; empuja el aire con las palmas abiertas (las hojas van en la mano) ══════════
    zephyr: () => ({
      // Ráfaga: recoge el aire en un círculo hacia el pecho y lo empuja con las dos palmas en un paso largo
      eb: mk('eb', .7, [
        { t: .07, e: 'io', comY: -.12, comZ: -.12, spYaw: sy - .05, pelYaw: hy, spPitch: -.06, hdPitch: -.05,
          hnFx: .45, hnFy: .35, hnFz: .25, hnFfist: 0, hnFflare: .7, hnBx: .5, hnBy: .3, hnBz: .15, hnBfist: 0, hnBflare: .7 },
        { t: .15, e: 'in2', comY: -.16, comZ: -.16, hnFx: .12, hnFy: -.05, hnFz: .12, hnFpitch: -.3, hnBx: .15, hnBy: -.08, hnBz: .05, hnBpitch: -.3, ftBz: -.38 },
        { t: .205, e: 'in3', comY: -.14, comZ: .3, spPitch: .2, spYaw: sy - .2, pelYaw: hy - .1, hdPitch: .02,
          hnFx: -.18, hnFy: .14, hnFz: 1.04, hnFpitch: -1.25, hnFflare: .9, hnBx: -.28, hnBy: .06, hnBz: .95, hnBpitch: -1.25, hnBflare: .9, shFfwd: .35, shBfwd: .35,
          ftFz: .62, ftBz: -.5, ftBpitch: -.65 },
        { t: .32, e: 'lin', comZ: .32, hnFz: 1.02 },
        { t: .52, e: 'io', comY: -.06, comZ: .1, hnFx: .05, hnFz: .5, hnBz: .4, hnFpitch: 0, hnBpitch: 0, shFfwd: 0, shBfwd: 0 },
      ], { hit: [.2, .24], trails: [['hF', .14, .3], ['hB', .14, .3]], fx: [{ t: .205, kind: 'b_air_push', at: 'hF' }], sfx: [{ kind: 'air_gather', t0: .02, t1: .2, at: 'hF' }] }),

      // Torbellino: gira sobre sí mismo con los brazos abiertos (el viento le sigue) y suelta el tornado con las dos palmas
      eu: mk('eu', .95, [
        { t: .08, e: 'out2', comY: -.12, comYaw: -.4, spRoll: -.1, hnFx: .62, hnFy: .12, hnFz: .1, hnFfist: 0, hnFflare: .6, hnBx: .62, hnBy: .18, hnBz: .05, hnBfist: 0, hnBflare: .6 },
        { t: .22, e: 'lin', comY: -.02, comYaw: 2.6, ftFree: .15, spRoll: -.18, hnFx: .78, hnFy: .3, hnBx: .78, hnBy: .25, ftFy: .1 },
        { t: .31, e: 'out2', comY: -.06, comYaw: 6.283, ftFree: 0, spRoll: 0, ftFy: 0, hnFx: .4, hnFy: .4, hnFz: .2, hnBx: .4, hnBy: .35 },
        { t: .36, e: 'in3', comY: -.24, comZ: .22, comYaw: 6.283, spPitch: .3, hdPitch: .1, hnFx: -.15, hnFy: -.18, hnFz: .95, hnFpitch: -1.1, hnBx: -.25, hnBy: -.22, hnBz: .88, hnBpitch: -1.1, ftFz: .55, ftBz: -.42 },
        { t: .58, e: 'lin', comYaw: 6.283, comY: -.24, hnFz: .93 },
        { t: .8, e: 'io', comYaw: 6.283, comY: -.06, comZ: .06, spPitch: .06, hnFx: .05, hnFz: .5, hnBz: .4, hnFpitch: 0, hnBpitch: 0 },
      ], { hit: [.34, .38], trails: [['hF', .08, .36], ['hB', .08, .36]], fx: [{ t: .36, kind: 'b_air_push', at: 'hF' }], sfx: [{ kind: 'air_spin', t0: .06, t1: .36, at: 'body' }] }),

      // Bala de Aire: media voltereta hacia delante en el aire y patada de hacha que dispara una bola de aire en picado
      ej: mk('ej', .54, [
        { t: .05, e: 'out2', comPitch: -.35, ftFy: .6, ftFz: .2, ftBy: .6, ftBz: 0, hnFx: .4, hnFy: .4, hnBx: .4, hnBy: .45, spPitch: -.2 },
        { t: .14, e: 'in3', comPitch: .55, spPitch: .25, hdPitch: .15, ftFy: .05, ftFz: .98, ftFpitch: -.3, ftBy: .6, ftBz: -.3, hnFx: .55, hnFy: .1, hnFz: -.35, hnBx: .55, hnBy: .15, hnBz: -.4 },
        { t: .28, e: 'lin', comPitch: .6, ftFz: .95 },
        { t: .46, e: 'io', comPitch: .15, ftFy: .4, ftFz: .3, spPitch: .05 },
      ], { hit: [.13, .17], trails: [['fF', .07, .28]], fx: [{ t: .14, kind: 'b_air_push', at: 'fF' }], sfx: [] }),
    }),
  };
  const id = LIB[S.id] ? S.id : null; if (!id) return {};
  const set = LIB[id]();
  for (const c of Object.values(set)) c.sfx ||= [];
  return set;
}
