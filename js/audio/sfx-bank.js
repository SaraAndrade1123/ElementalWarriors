// Banco de efectos de sonido. Cada efecto es DATOS (capas de síntesis), no código: para cambiar cómo suena algo,
// edita los números. Los efectos con variante por elemento suman capas extra según el elemento (fuego, agua, tierra, viento).
// `trim` iguala el volumen de todos los efectos (medido en audio-lab.html); `cd` es el tiempo mínimo entre repeticiones (ms).

export const ELEMENTS = ['fire', 'water', 'earth', 'wind'];

const osc = (f0, f1, dur, gain, o = {}) => ({ type: 'osc', f0, f1, dur, gain, ...o });
const noise = (ft, f0, f1, dur, gain, o = {}) => ({ type: 'noise', filter: { type: ft, f0, f1, q: o.q ?? 1 }, dur, gain, ...o });
const crackle = (count, span, f0, f1, gain, o = {}) => ({ type: 'crackle', count, span, f0, f1, gain, ...o });
const bubbles = (count, span, f0, f1, gain, o = {}) => ({ type: 'bubbles', count, span, f0, f1, gain, ...o });
const note = (f, delay, dur, gain, wave = 'triangle') => osc(f, 0, dur, gain, { delay, wave, curve: 'exp', attack: 0.005 });

export const SFX = {
  // ---- Interfaz ----
  ui_hover:   { cd: 45, trim: 1.62, layers: [osc(1800, 2200, 0.045, 0.14, { attack: 0.003 })] },
  ui_click:   { cd: 30, trim: 1.331, layers: [osc(520, 780, 0.09, 0.28, { wave: 'triangle' }), noise('bandpass', 3000, 3000, 0.03, 0.1, { q: 2 })] },
  ui_confirm: { cd: 60, trim: 1.148, layers: [note(523, 0, 0.16, 0.28), note(784, 0.07, 0.24, 0.28), osc(1568, 0, 0.3, 0.1, { delay: 0.07 })] },
  ui_back:    { cd: 60, trim: 1.316, layers: [osc(660, 400, 0.12, 0.28, { wave: 'triangle' })] },
  ui_error:   { cd: 120, trim: 1.557, layers: [osc(160, 0, 0.12, 0.2, { wave: 'square', filter: { type: 'lowpass', f: 900 } }), osc(130, 0, 0.16, 0.2, { wave: 'square', delay: 0.1, filter: { type: 'lowpass', f: 900 } })] },
  ui_buy:     { cd: 100, trim: 1.43, layers: [note(1319, 0, 0.14, 0.26), note(1760, 0.08, 0.4, 0.26), noise('highpass', 6000, 6000, 0.3, 0.06, { delay: 0.08 })] },
  ui_unlock:  { cd: 200, trim: 1.347, layers: [note(523, 0, 0.25, 0.22), note(659, 0.09, 0.25, 0.22), note(784, 0.18, 0.25, 0.22), note(1047, 0.27, 0.6, 0.26), noise('highpass', 7000, 7000, 0.5, 0.05, { delay: 0.27 })] },
  ui_switch:  { cd: 80, trim: 0.877, layers: [noise('bandpass', 600, 2400, 0.22, 0.3, { curve: 'swell', q: 1.2 }), osc(300, 600, 0.2, 0.14)] },

  // ---- Movimiento ----
  step:       { cd: 90, trim: 1.49, layers: [noise('lowpass', 900, 900, 0.07, 0.2, { q: 0.7 }), osc(90, 60, 0.06, 0.22)] },
  jump:       { cd: 80, trim: 2.973, layers: [noise('bandpass', 400, 1400, 0.18, 0.2, { curve: 'swell' }), osc(220, 440, 0.14, 0.12)] },
  land:       { cd: 80, trim: 1.351, layers: [osc(110, 45, 0.16, 0.5), noise('lowpass', 600, 600, 0.1, 0.3)] },
  dodge:      { cd: 80, trim: 3.083, layers: [noise('bandpass', 1200, 3500, 0.16, 0.26, { curve: 'swell', peak: 0.3 })] },

  // ---- Combate ----
  whiff_light: { cd: 40, trim: 3.068, layers: [noise('bandpass', 900, 2600, 0.14, 0.34, { curve: 'swell', peak: 0.4, q: 1.2 })] },
  whiff_heavy: { cd: 60, trim: 4.498, layers: [noise('bandpass', 300, 1800, 0.28, 0.42, { curve: 'swell', peak: 0.45 }), osc(120, 60, 0.25, 0.1, { wave: 'sawtooth', filter: { type: 'lowpass', f: 500 } })] },
  hit_light:  { cd: 30, trim: 0.632, layers: [noise('bandpass', 1800, 1800, 0.07, 0.55, { q: 0.8 }), osc(220, 90, 0.09, 0.5)] },
  hit_medium: { cd: 30, trim: 0.929, layers: [noise('bandpass', 1100, 1100, 0.11, 0.6), osc(160, 60, 0.15, 0.65), noise('lowpass', 500, 500, 0.14, 0.35)] },
  hit_heavy:  { cd: 40, trim: 0.631, layers: [osc(90, 32, 0.35, 0.85), noise('lowpass', 1400, 220, 0.3, 0.65), noise('bandpass', 2200, 2200, 0.08, 0.4), osc(70, 30, 0.25, 0.18, { wave: 'sawtooth', filter: { type: 'lowpass', f: 300 } })] },
  block:      { cd: 30, trim: 1.017, layers: [osc(1250, 0, 0.12, 0.3), osc(1870, 0, 0.1, 0.18), noise('bandpass', 4000, 4000, 0.05, 0.3, { q: 3 }), osc(140, 80, 0.1, 0.35)] },
  guard_break: { cd: 100, trim: 1.038, layers: [noise('highpass', 3000, 3000, 0.25, 0.4, { curve: 'swell', peak: 0.1 }), osc(80, 30, 0.3, 0.7), crackle(8, 0.2, 2500, 8000, 0.3)] },
  throw:      { cd: 100, trim: 1.172, layers: [noise('bandpass', 500, 1500, 0.22, 0.3, { curve: 'swell' }), osc(100, 40, 0.25, 0.7, { delay: 0.22 })] },
  projectile: { cd: 80, trim: 0.921, layers: [osc(180, 120, 0.3, 0.1, { wave: 'sawtooth', filter: { type: 'lowpass', f: 800 } }), noise('bandpass', 500, 1200, 0.3, 0.2, { curve: 'swell' })] },
  explosion:  { cd: 100, trim: 0.77, layers: [osc(70, 25, 0.8, 0.95), noise('lowpass', 2400, 120, 0.8, 0.75), noise('bandpass', 800, 300, 0.5, 0.3, { curve: 'swell', peak: 0.1 })] },
  special:    { cd: 200, trim: 0.934, layers: [osc(220, 880, 0.5, 0.12, { wave: 'sawtooth', filter: { type: 'lowpass', f: 2000 }, curve: 'swell', peak: 0.8 }), noise('bandpass', 500, 3000, 0.5, 0.25, { curve: 'swell', peak: 0.8 })] },
  transform:  { cd: 500, trim: 0.897, layers: [osc(110, 440, 1.25, 0.14, { wave: 'sawtooth', filter: { type: 'lowpass', f: 1800 }, curve: 'swell', peak: 0.95 }), noise('bandpass', 300, 4000, 1.3, 0.35, { curve: 'swell', peak: 0.9 }), osc(70, 30, 0.7, 0.85, { delay: 1.25 }), osc(880, 1760, 0.6, 0.12, { wave: 'triangle', delay: 1.25 }), noise('lowpass', 1500, 200, 0.6, 0.5, { delay: 1.25 })] },
  ko:         { cd: 500, trim: 0.928, layers: [osc(90, 32, 0.35, 0.8), noise('lowpass', 1400, 220, 0.3, 0.6), osc(440, 55, 1.1, 0.2, { wave: 'sawtooth', filter: { type: 'lowpass', f: 1200 } }), noise('lowpass', 800, 150, 1.2, 0.3, { curve: 'swell', peak: 0.2 })] },

  // ---- Ronda ----
  countdown_tick: { cd: 100, trim: 1.346, layers: [osc(880, 0, 0.12, 0.3)] },
  round_start: { cd: 500, trim: 1.179, layers: [osc(196, 0, 1.6, 0.3), osc(541, 0, 1.2, 0.14), osc(1058, 0, 0.8, 0.08), noise('lowpass', 1200, 1200, 0.12, 0.3)] },
  round_end:  { cd: 500, trim: 1.096, layers: [osc(147, 0, 1.3, 0.3), osc(405, 0, 0.9, 0.14), osc(794, 0, 0.6, 0.08), noise('lowpass', 900, 900, 0.1, 0.3)] },
  victory:    { cd: 800, trim: 1.39, layers: [note(262, 0, 0.5, 0.24), note(330, 0.14, 0.5, 0.24), note(392, 0.28, 0.5, 0.24), note(523, 0.42, 0.55, 0.24), note(659, 0.56, 0.6, 0.24), note(784, 0.7, 1.1, 0.28), osc(392, 0, 1.8, 0.07, { delay: 0.7, curve: 'exp' })] },
  defeat:     { cd: 800, trim: 1.801, layers: [osc(220, 0, 0.55, 0.22, { wave: 'sawtooth', filter: { type: 'lowpass', f: 900 } }), osc(175, 0, 0.55, 0.22, { wave: 'sawtooth', delay: 0.4, filter: { type: 'lowpass', f: 800 } }), osc(147, 0, 1.2, 0.25, { wave: 'sawtooth', delay: 0.8, filter: { type: 'lowpass', f: 700 } })] }
};

// Capas extra por elemento. Se suman a las capas base del efecto.
const hitLayers = (n) => ({
  fire: [crackle(3 + n * 3, 0.1 + n * 0.1, 2500, 7000, 0.28), ...(n > 1 ? [noise('highpass', 3000, 3000, 0.2, 0.15)] : [])],
  water: [bubbles(2 + n * 2, 0.12 + n * 0.08, 600, 1800, 0.22), noise('bandpass', 1500, 1500, 0.15, 0.18, { q: 0.5 })],
  earth: [osc(55, 35, 0.2 + n * 0.1, 0.45), crackle(2 + n * 2, 0.15, 300, 1200, 0.38)],
  wind: [noise('bandpass', 3000, 6000, 0.22, 0.24, { curve: 'swell' }), osc(2200, 3200, 0.1, 0.07)]
});

export const ELEMENT_LAYERS = {
  hit_light: hitLayers(1), hit_medium: hitLayers(2), hit_heavy: hitLayers(3),
  ui_switch: {
    fire: [crackle(5, 0.2, 2500, 7000, 0.25)],
    water: [bubbles(4, 0.2, 700, 1800, 0.22)],
    earth: [osc(70, 50, 0.15, 0.35)],
    wind: [noise('bandpass', 2000, 5000, 0.22, 0.18, { curve: 'swell' })]
  },
  projectile: {
    fire: [noise('lowpass', 600, 1500, 0.4, 0.35, { curve: 'swell' }), crackle(8, 0.35, 2000, 6000, 0.25)],
    water: [bubbles(7, 0.35, 500, 1600, 0.25), noise('bandpass', 400, 1000, 0.35, 0.22, { curve: 'swell' })],
    earth: [osc(60, 40, 0.35, 0.5), crackle(6, 0.3, 250, 900, 0.4)],
    wind: [osc(1400, 2200, 0.35, 0.09, { vib: { hz: 6, cents: 40 }, curve: 'swell' }), noise('bandpass', 2000, 5000, 0.35, 0.25, { curve: 'swell' })]
  },
  special: {
    fire: [noise('lowpass', 400, 1800, 0.6, 0.4, { curve: 'swell', peak: 0.7 }), crackle(14, 0.6, 2000, 7000, 0.3)],
    water: [bubbles(10, 0.7, 500, 1700, 0.26), noise('bandpass', 400, 1200, 0.6, 0.35, { curve: 'swell', peak: 0.7 })],
    earth: [osc(50, 30, 0.7, 0.65), crackle(10, 0.6, 250, 1000, 0.42)],
    wind: [noise('bandpass', 1500, 5000, 0.6, 0.38, { curve: 'swell', peak: 0.8 }), osc(1400, 2200, 0.6, 0.09, { vib: { hz: 6, cents: 50 }, curve: 'swell' })]
  },
  transform: {
    fire: [noise('lowpass', 300, 2200, 1.3, 0.35, { curve: 'swell', peak: 0.9 }), crackle(22, 1.4, 2000, 7000, 0.3)],
    water: [bubbles(18, 1.3, 500, 1800, 0.26), noise('bandpass', 300, 1400, 1.3, 0.3, { curve: 'swell', peak: 0.9 })],
    earth: [osc(45, 28, 1.3, 0.6, { curve: 'swell', peak: 0.9 }), crackle(16, 1.3, 250, 1000, 0.42)],
    wind: [noise('bandpass', 1000, 6000, 1.3, 0.4, { curve: 'swell', peak: 0.9 }), osc(900, 2400, 1.3, 0.1, { vib: { hz: 6, cents: 60 }, curve: 'swell', peak: 0.9 })]
  }
};

/** Capas de un efecto (base + extra del elemento). Devuelve null si el efecto no existe. */
export function layersFor(name, element) {
  const s = SFX[name]; if (!s) return null;
  return [...s.layers, ...(ELEMENT_LAYERS[name]?.[element] ?? [])];
}

/** Duración aproximada (s) de un conjunto de capas. */
export function durationOf(layers) {
  return Math.max(...layers.map(l => (l.delay || 0) + (l.type === 'crackle' ? l.span + 0.03 : l.type === 'bubbles' ? l.span + 0.13 : l.dur)));
}

// Efectos que el combate (F3) necesita. tools/test-audio.mjs falla si falta alguno.
export const REQUIRED_SFX = ['ui_click', 'ui_confirm', 'ui_back', 'ui_error', 'step', 'jump', 'land', 'whiff_light', 'whiff_heavy', 'hit_light', 'hit_medium', 'hit_heavy', 'block', 'guard_break', 'throw', 'dodge', 'projectile', 'explosion', 'special', 'transform', 'ko', 'round_start', 'round_end', 'victory', 'defeat'];
