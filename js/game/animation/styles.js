// Personalidad de movimiento de cada guerrero. Todo son números: afinar aquí cambia cómo se siente cada uno.
// Distancias en «largos de pierna / brazo», ángulos en radianes, tiempos en segundos.
// guard.* = posición de reposo de las manos (sin arma desde v0.9); shield.* = guardia defensiva al bloquear.
const base = {
  atkSpeed: 1,
  stance: { z: .2, x: .06, knee: .1, hipYaw: .3, spYaw: .45, lean: .08, roll: 0, head: -.08 },
  guard: { F: { x: -.25, y: .14, z: .52 }, B: { x: -.34, y: .08, z: .34 }, flareF: .1, flareB: .15, fist: 1, fistB: 1, shF: .1, shB: .05, rollF: .5, rollB: .4, pitchF: 0, pitchB: 0 },
  shield: { F: { x: -.3, y: .36, z: .42 }, B: { x: -.34, y: .32, z: .34 }, flareF: .25, flareB: .3, fist: 1, rollF: .3, rollB: .3, pitchF: 0, pitchB: 0 },
  breath: { rate: 1.7, amp: 1 },
  bounce: { freq: 0, amp: 0 },
  sway: { amp: 0, rate: .8 },                    // ondulación de manos/caderas (Aqua)
  floatiness: 0,
  walk: { stepZ: .42, lift: .17, bob: .05, swing: .08, lean: .1, hip: .16, sp: .22, arms: 'guard', stride: 1.1 },
  run: { lean: .38, stride: 1.9, lift: .3, bob: .08, arms: 'pump', head: .1 },
  crouch: { drop: .62, fwd: -.06, pitch: .32, wide: .1, guardY: -.12 },
  air: { tuckF: .4, tuckB: .45, arms: 'fists', spin: 0 },
  land: { depth: .5, time: .22 },
  pre: { depth: .3, time: .07 },
  react: 1,                                      // cuánto le sacuden los golpes (peso)
};
const mix = (a, b) => { const o = Array.isArray(a) ? [...a] : { ...a }; for (const k in b) o[k] = b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) ? mix(a[k] || {}, b[k]) : b[k]; return o; };

export const STYLES = {
  // IGNIS · fuego, impulsivo y competitivo: espada adelantada apuntando al rival, rebota sobre las puntas, torso echado hacia delante
  ignis: mix(base, {
    atkSpeed: .92,
    stance: { z: .26, x: .07, knee: .16, hipYaw: .42, spYaw: .6, lean: .16, head: -.14 },
    guard: { F: { x: -.06, y: -.04, z: .62 }, B: { x: -.12, y: -.12, z: .44 }, flareF: .18, flareB: .2, rollF: .25, rollB: .35, pitchF: 0, pitchB: 0, fist: 1, fistB: 1 }, // sin arma: puños de boxeador de fuego (adelantado a la altura del pecho, el otro protege la barbilla)
    shield: { F: { x: -.28, y: .22, z: .5 }, B: { x: -.36, y: .3, z: .3 }, rollF: 0, pitchF: 1.45, flareF: .4 },
    bounce: { freq: 2.7, amp: .035 },
    breath: { rate: 2.4, amp: 1.2 },
    walk: { stepZ: .4, lift: .15, bob: .055, swing: .07, lean: .16, hip: .18, sp: .24, stride: 1.05 },
    run: { lean: .45, stride: 2, arms: 'blade' },
    air: { tuckF: .5, tuckB: .55 },
    react: 1,
  }),
  // AQUA · agua, serena y estratégica: lanza larga en guardia media, mano libre abierta que fluye, peso atrás, caderas ondulantes
  aqua: mix(base, {
    atkSpeed: 1.04,
    stance: { z: .22, x: .09, knee: .1, hipYaw: .22, spYaw: .36, lean: -.02, roll: .06, head: .02 },
    guard: { F: { x: .04, y: -.12, z: .58 }, B: { x: .08, y: -.24, z: .44 }, flareF: .45, flareB: .55, fist: .2, fistB: .1, shF: .0, shB: .05, rollF: .5, pitchF: 0, rollB: .8, pitchB: 0 }, // palmas abiertas que guían el agua
    shield: { F: { x: -.3, y: .25, z: .45 }, B: { x: -.1, y: .36, z: .52 }, flareF: .5, flareB: .6, fist: 1, rollF: 0, pitchF: 1.5 },
    sway: { amp: 1, rate: .75 },
    floatiness: .7,
    breath: { rate: 1.2, amp: 1.1 },
    walk: { stepZ: .46, lift: .17, bob: .03, swing: .1, lean: .04, hip: .26, sp: .28, arms: 'guard', stride: 1.15 },
    run: { lean: .3, stride: 1.8, arms: 'glide' },
    air: { tuckF: .3, tuckB: .55 },
    react: 1.05,
  }),
  // TERRA · tierra, firme y paciente: postura ancha y baja, guanteletes al frente, respiración honda, pasos pesados
  terra: mix(base, {
    atkSpeed: 1.25,
    stance: { z: .2, x: .2, knee: .26, hipYaw: .18, spYaw: .28, lean: .14, head: -.18 },
    guard: { F: { x: -.1, y: -.1, z: .58 }, B: { x: -.16, y: -.2, z: .44 }, flareF: .35, flareB: .4, shF: .22, shB: .2, rollF: .5, rollB: .5, fist: 1, fistB: 1 }, // puños firmes, postura baja
    breath: { rate: 1.05, amp: 1.7 },
    shield: { F: { x: -.48, y: .3, z: .44 }, B: { x: -.5, y: .22, z: .38 }, flareF: .1, flareB: .12, fist: 1 },
    walk: { stepZ: .34, lift: .14, bob: .09, swing: .04, lean: .1, hip: .1, sp: .12, stride: 1.0 },
    run: { lean: .3, stride: 1.5, lift: .22, bob: .14, arms: 'pump' },
    crouch: { drop: .72, pitch: .24, wide: .22 },
    air: { tuckF: .22, tuckB: .22 },
    land: { depth: .85, time: .34 },
    pre: { depth: .4, time: .09 },
    react: .7,
  }),
  // ZEPHYR · viento, libre y provocador: de puntillas, hojas invertidas sueltas, cabeza ladeada, flota en el aire
  zephyr: mix(base, {
    atkSpeed: .82,
    stance: { z: .22, x: .05, knee: .1, hipYaw: .3, spYaw: .42, lean: .1, roll: -.05, head: .06 },
    guard: { F: { x: .02, y: -.16, z: .56 }, B: { x: .04, y: -.3, z: .38 }, flareF: .45, flareB: .5, fist: .35, fistB: .3, rollF: .4, rollB: .2, pitchF: 0 }, // manos ligeras, la adelantada abierta
    bounce: { freq: 1.8, amp: .045 },
    shield: { F: { x: -.24, y: .34, z: .5 }, B: { x: -.3, y: .28, z: .46 }, flareF: .6, flareB: .65, fist: 1, rollF: 1.2, rollB: 1.2 },
    floatiness: .5,
    breath: { rate: 2.0, amp: .9 },
    walk: { stepZ: .48, lift: .24, bob: .06, swing: .15, lean: .16, hip: .22, sp: .22, arms: 'flow', stride: 1.2 },
    run: { lean: .6, stride: 2.2, lift: .34, arms: 'ninja', head: .2 },
    air: { tuckF: .35, tuckB: .3, spin: 1 },
    land: { depth: .32, time: .16 },
    pre: { depth: .22, time: .06 },
    react: 1.3,
  }),
};
for (const k in STYLES) STYLES[k].id = k;
export const styleFor = id => STYLES[id] || { ...base, id };
