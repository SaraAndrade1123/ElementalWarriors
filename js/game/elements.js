// Triángulo elemental (lógica pura, sin Three.js ni DOM: se prueba con Node).
//   💧 Agua le gana a 🔥 Fuego · 🔥 Fuego le gana a 🌪️ Aire · 🌪️ Aire le gana a 💧 Agua · 🪨 Tierra es NEUTRO (siempre 100 %).
// Las reglas viven en data/elements.json; aquí solo hay valores de respaldo idénticos por si ese archivo falta.
//
// Cómo afecta al combate: al empezar un combate, applyMatchup(f1, f2) ajusta las estadísticas DERIVADAS de cada luchador
// según su relación con ESE rival (fighter.atk, el daño al bloquear y el desgaste de guardia de sus golpes y la Resonancia
// que gana). No edita fighter.js: trabaja sobre la instancia y sobre una copia propia de sus golpes, y se puede deshacer
// (clearElement) o volver a aplicar contra otro rival sin acumular nada.

export const DEFAULT_ELEMENTS = Object.freeze({
  version: 1,
  neutral: 'earth',
  elements: {
    water: { icon: '💧', color: '#5fd0ff', beats: 'fire' },
    fire: { icon: '🔥', color: '#ff7a35', beats: 'wind' },
    wind: { icon: '🌪️', color: '#cfe6ff', beats: 'water' },
    earth: { icon: '🪨', color: '#b5b9c2', neutral: true },
  },
  modifiers: {
    advantage: { damage: 1.2, chip: 1.2, guard: 1.2, resonance: 1.1 },
    neutral: { damage: 1, chip: 1, guard: 1, resonance: 1 },
    disadvantage: { damage: .8, chip: .8, guard: .8, resonance: .9 },
  },
  // Respaldo para guerreros sin campo "element" en data/characters.json.
  assign: { ignis: 'fire', aqua: 'water', terra: 'earth', zephyr: 'wind' },
});

export const RELATIONS = ['advantage', 'neutral', 'disadvantage'];
const STATS = ['damage', 'chip', 'guard', 'resonance'];
const GUARD_FROM_DMG = 1.4; // igual que fighter.js: sin guardDmg, un golpe bloqueado desgasta dmg × 1,4

// Revisa unas reglas (las de data/elements.json). Devuelve la lista de problemas (vacía = válidas).
export function validateElements(R) {
  const out = [], E = R?.elements;
  if (!E || typeof E !== 'object' || !Object.keys(E).length) return ['falta "elements"'];
  for (const [id, e] of Object.entries(E)) {
    if (e.neutral && e.beats) out.push(`${id}: un elemento neutro no puede ganarle a otro`);
    if (!e.neutral && !e.beats) out.push(`${id}: no es neutro y no le gana a nadie`);
    if (e.beats && !E[e.beats]) out.push(`${id}: le gana a "${e.beats}", que no existe`);
    if (e.beats === id) out.push(`${id}: no puede ganarse a sí mismo`);
    if (e.beats && E[e.beats]?.beats === id) out.push(`${id} y ${e.beats} se ganan mutuamente`);
    if (e.beats && E[e.beats]?.neutral) out.push(`${id}: le gana a "${e.beats}", que es neutro`);
  }
  if (R.neutral && !E[R.neutral]?.neutral) out.push(`"neutral" (${R.neutral}) debe ser un elemento marcado como neutral`);
  for (const rel of RELATIONS) for (const k of STATS) {
    const v = R.modifiers?.[rel]?.[k];
    if (v !== undefined && !(typeof v === 'number' && v > 0 && v < 5)) out.push(`modifiers.${rel}.${k} debe ser un número entre 0 y 5`);
  }
  return out;
}

// Combina unas reglas con los valores de respaldo. Si son inválidas, se usan las de respaldo (nunca se rompe el combate).
export function normalizeElements(data) {
  const D = DEFAULT_ELEMENTS;
  if (!data) return { rules: D, problems: [] };
  const R = {
    version: data.version ?? D.version,
    neutral: data.neutral ?? D.neutral,
    elements: data.elements ?? D.elements,
    modifiers: Object.fromEntries(RELATIONS.map(r => [r, { ...D.modifiers[r], ...(data.modifiers?.[r] || {}) }])),
    assign: { ...D.assign, ...(data.assign || {}) },
  };
  const problems = validateElements(R);
  return problems.length ? { rules: D, problems } : { rules: R, problems };
}

// Elemento de un guerrero: su campo "element" (data/characters.json) → respaldo por id → neutro.
export function elementOf(def, R = DEFAULT_ELEMENTS) {
  const el = def?.element ?? R.assign?.[def?.id];
  return el && R.elements[el] ? el : R.neutral;
}

// Relación del atacante con el defensor: 'advantage' | 'disadvantage' | 'neutral'.
export function relation(atkEl, defEl, R = DEFAULT_ELEMENTS) {
  const A = R.elements[atkEl], B = R.elements[defEl];
  if (!A || !B || A.neutral || B.neutral || atkEl === defEl) return 'neutral';
  if (A.beats === defEl) return 'advantage';
  if (B.beats === atkEl) return 'disadvantage';
  return 'neutral';
}

export const modsFor = (rel, R = DEFAULT_ELEMENTS) => ({ ...DEFAULT_ELEMENTS.modifiers.neutral, ...(R.modifiers?.[rel] || {}) });

// Descripción completa de un enfrentamiento (para combate, interfaz y pruebas). `dealt`/`taken` son multiplicadores de daño.
export function matchup(defA, defB, R = DEFAULT_ELEMENTS) {
  const ea = elementOf(defA, R), eb = elementOf(defB, R);
  const side = (me, foe) => {
    const rel = relation(me, foe, R), mods = modsFor(rel, R), foeMods = modsFor(relation(foe, me, R), R);
    return { el: me, foe, rel, mods, dealt: mods.damage, taken: foeMods.damage };
  };
  return [side(ea, eb), side(eb, ea)];
}

// Copia los golpes del luchador para poder modificarlos sin tocar los de nadie más (ni data/moves.json).
function cloneMoves(M) {
  const out = {};
  for (const [k, v] of Object.entries(M || {})) out[k] = v && typeof v === 'object' ? { ...v, ...(v.proj ? { proj: { ...v.proj } } : {}) } : v;
  return out;
}
function scaleHit(d, m) { // d = definición de golpe o de proyectil
  if (!d) return;
  if (d.chip) d.chip *= m.chip;
  if (d.guardDmg != null) d.guardDmg *= m.guard;
  else if (d.dmg > 0 && !d.throw) d.guardDmg = d.dmg * GUARD_FROM_DMG * m.guard;
}

// Deshace lo que hizo applyElement (estadísticas, golpes y Resonancia vuelven a su valor original).
export function clearElement(f) {
  const b = f?.__elem; if (!b) return;
  f.atk = b.atk; f.moves = b.moves;
  if (b.ownGain) f.gain = b.ownGain; else delete f.gain;
  f.__elem = null; f.elem = null;
}

// Aplica a un luchador la relación con su rival `foe` (también sirve para Fighters de otras versiones del juego:
// solo necesita def, atk, moves y gain()). Idempotente: aplicarlo dos veces no duplica la ventaja.
export function applyElement(f, foe, R = DEFAULT_ELEMENTS) {
  if (!f || !foe) return null;
  clearElement(f);
  const [info] = matchup(f.def, foe.def, R), m = info.mods;
  const base = { atk: f.atk, moves: f.moves, ownGain: Object.prototype.hasOwnProperty.call(f, 'gain') ? f.gain : null };
  f.__elem = base;
  if (typeof f.atk === 'number') f.atk = base.atk * m.damage;
  if (f.moves && (m.chip !== 1 || m.guard !== 1)) {
    f.moves = cloneMoves(base.moves);
    for (const [k, d] of Object.entries(f.moves)) if (k !== 'traits' && d && typeof d === 'object') { scaleHit(d, m); scaleHit(d.proj, m); }
  }
  const g = base.ownGain || f.gain;
  if (typeof g === 'function' && m.resonance !== 1) f.gain = function (v) { return g.call(this, v * m.resonance); };
  f.elem = { ...info, foeId: foe.def?.id, baseAtk: base.atk };
  return f.elem;
}

// Los dos lados de un combate de una vez. Devuelve [infoA, infoB].
export function applyMatchup(a, b, R = DEFAULT_ELEMENTS) { return [applyElement(a, b, R), applyElement(b, a, R)]; }

// Orden del ciclo para dibujar el triángulo: water → fire → wind → water (empieza por el primer elemento no neutro).
export function cycleOf(R = DEFAULT_ELEMENTS) {
  const start = Object.keys(R.elements).find(id => !R.elements[id].neutral); if (!start) return [];
  const out = [start]; let cur = R.elements[start].beats;
  while (cur && cur !== start && !out.includes(cur) && out.length < 12) { out.push(cur); cur = R.elements[cur]?.beats; }
  return out;
}
// ¿A quién le gana / contra quién pierde un elemento?
export const beatsOf = (el, R = DEFAULT_ELEMENTS) => R.elements[el]?.beats || null;
export const weakTo = (el, R = DEFAULT_ELEMENTS) => Object.keys(R.elements).find(k => R.elements[k].beats === el) || null;
export const pct = v => Math.round(v * 100) + '%';
