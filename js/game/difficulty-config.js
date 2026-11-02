// Niveles de dificultad de la CPU (datos de equilibrio, separados del código de decisión).
// La CPU juega con las MISMAS reglas y entradas que el jugador: solo ve el estado público del rival (golpe en curso, posición, aire)
// y nunca reacciona antes de su retraso de reacción; no lee los botones pulsados, no recibe daño extra ni vida extra.
//   reaction   segundos mínimos que tarda en reaccionar a un golpe que ve empezar
//   block      probabilidad de ponerse en guardia ante un golpe visto a tiempo
//   readLow    acierto al elegir guardia baja / alta
//   chain      probabilidad de continuar un combo (cadenas y cancelaciones de data/moves.json)
//   antiair    probabilidad de usar un antiaéreo contra un rival que salta cerca
//   punish     probabilidad de castigar la recuperación del rival
//   meter      uso de la Resonancia Elemental (técnica reforzada, repulsión)
//   throwTech  probabilidad de escapar de un lanzamiento
//   aggression probabilidad de atacar cuando está a distancia de golpe
//   guardIdle  probabilidad de protegerse por anticipación a distancia de golpe (un golpe ligero o medio sale antes que cualquier reacción humana)
//   noGuard    (maniquí) nunca se protege
export const LEVELS = {
  beginner: { reaction: .42, block: .25, readLow: .2,  chain: .15, antiair: .1, punish: .1,  meter: 0,  throwTech: .05, aggression: .5, guardIdle: 0 },
  normal:   { reaction: .26, block: .55, readLow: .5,  chain: .55, antiair: .35, punish: .35, meter: .3, throwTech: .25, aggression: .7, guardIdle: .12 },
  hard:     { reaction: .18, block: .72, readLow: .7,  chain: .8,  antiair: .6, punish: .65, meter: .6, throwTech: .45, aggression: .8, guardIdle: .2 },
  expert:   { reaction: .12, block: .85, readLow: .85, chain: .95, antiair: .8, punish: .85, meter: .9, throwTech: .65, aggression: .85, guardIdle: .4 },
  // Maniquí de entrenamiento que solo ataca (no bloquea ni castiga): sirve para practicar la defensa.
  dummy:    { reaction: 9,   block: 0,   readLow: 0,   chain: .2,  antiair: 0,  punish: 0,   meter: 0,  throwTech: 0,   aggression: .95, guardIdle: 0, noGuard: true },
};
export const LEVEL_IDS = ['beginner', 'normal', 'hard', 'expert']; // los que elige el jugador
export const DEFAULT_LEVEL = 'normal';
