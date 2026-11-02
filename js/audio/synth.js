// Síntesis procedural con Web Audio. Todo el sonido del juego se genera por código: no hay archivos de audio
// externos ni licencias que revisar. Las funciones aceptan un AudioContext o un OfflineAudioContext, así el
// laboratorio (audio-lab.html) puede renderizar y medir cada sonido sin reproducirlo.

export const MIN_GAIN = 0.0001;
export const midiToHz = m => 440 * 2 ** ((m - 69) / 12);

/** Generador pseudoaleatorio con semilla: mismo seed = mismo sonido (útil para pruebas y para variar golpes). */
export function mulberry32(seed) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const noiseCache = new WeakMap();
/** Ruido de 2 s (blanco, rosa o marrón), generado una vez por contexto y reutilizado. */
export function noiseBuffer(ctx, color = 'white') {
  let cache = noiseCache.get(ctx);
  if (!cache) { cache = {}; noiseCache.set(ctx, cache); }
  if (cache[color]) return cache[color];
  const len = Math.floor(ctx.sampleRate * 2), buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0), r = mulberry32(0x9e3779b9);
  if (color === 'pink') {
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < len; i++) {
      const w = r() * 2 - 1;
      b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
      d[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362; b6 = w * 0.115926;
    }
  } else if (color === 'brown') {
    let last = 0;
    for (let i = 0; i < len; i++) { last = (last + 0.02 * (r() * 2 - 1)) / 1.02; d[i] = last * 3.5; }
  } else for (let i = 0; i < len; i++) d[i] = r() * 2 - 1;
  let peak = 0; for (let i = 0; i < len; i++) peak = Math.max(peak, Math.abs(d[i]));
  for (let i = 0; i < len; i++) d[i] = (d[i] / (peak || 1)) * 0.9;
  return (cache[color] = buf);
}

/** Envolvente de ganancia. exp: ataque rápido y caída; swell: sube hasta `peak` (fracción de dur) y cae; hold: sostiene y cae al final. */
export function envelope(param, t, { attack = 0.003, dur, gain, curve = 'exp', peak = 0.4, release = 0.08 }) {
  const g = Math.max(gain, MIN_GAIN);
  param.setValueAtTime(MIN_GAIN, t);
  if (curve === 'swell') {
    param.exponentialRampToValueAtTime(g, t + Math.max(attack, dur * peak));
    param.exponentialRampToValueAtTime(MIN_GAIN, t + dur);
  } else if (curve === 'hold') {
    param.linearRampToValueAtTime(g, t + attack);
    param.setValueAtTime(g, t + Math.max(attack, dur - release));
    param.exponentialRampToValueAtTime(MIN_GAIN, t + dur);
  } else {
    param.linearRampToValueAtTime(g, t + attack);
    param.exponentialRampToValueAtTime(MIN_GAIN, t + dur);
  }
}

function biquad(ctx, f, t, dur, rate) {
  const node = ctx.createBiquadFilter(); node.type = f.type; node.Q.value = f.q ?? 1;
  node.frequency.setValueAtTime(Math.max(20, f.f0 * rate), t);
  if (f.f1) node.frequency.exponentialRampToValueAtTime(Math.max(20, f.f1 * rate), t + dur);
  return node;
}

function noiseSource(ctx, color, t, dur, rng) {
  const src = ctx.createBufferSource(); src.buffer = noiseBuffer(ctx, color); src.loop = true;
  src.start(t, rng() * 1.2); src.stop(t + dur + 0.05);
  return src;
}

/**
 * Reproduce una capa de sonido. Tipos:
 *  osc      oscilador con barrido de frecuencia f0→f1, filtro y vibrato opcionales
 *  noise    ruido filtrado (filter: {type, f0, f1, q}) con envolvente
 *  crackle  ráfaga de chasquidos cortos (fuego, roca que se parte)
 *  bubbles  burbujas: chirridos senoidales ascendentes (agua)
 * Devuelve el instante (en segundos desde t0) en que termina la capa.
 */
export function playLayer(ctx, out, L, t0, rng, rate = 1) {
  const t = t0 + (L.delay || 0), gain = L.gain ?? 0.3;
  if (L.type === 'osc') {
    const dur = L.dur, o = ctx.createOscillator(); o.type = L.wave || 'sine';
    o.frequency.setValueAtTime(L.f0 * rate, t);
    if (L.f1) o.frequency.exponentialRampToValueAtTime(L.f1 * rate, t + dur * (L.sweep ?? 1));
    if (L.vib) {
      const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = L.vib.hz; lg.gain.value = L.vib.cents;
      lfo.connect(lg); lg.connect(o.detune); lfo.start(t); lfo.stop(t + dur + 0.05);
    }
    let node = o;
    if (L.filter) { const f = ctx.createBiquadFilter(); f.type = L.filter.type; f.frequency.value = L.filter.f; f.Q.value = L.filter.q ?? 0.7; node.connect(f); node = f; }
    const g = ctx.createGain(); envelope(g.gain, t, { ...L, dur, gain }); node.connect(g); g.connect(out);
    o.start(t); o.stop(t + dur + 0.05);
    return (L.delay || 0) + dur;
  }
  if (L.type === 'noise') {
    const dur = L.dur; let node = noiseSource(ctx, L.color, t, dur, rng);
    if (L.filter) { const f = biquad(ctx, L.filter, t, dur, rate); node.connect(f); node = f; }
    const g = ctx.createGain(); envelope(g.gain, t, { ...L, dur, gain }); node.connect(g); g.connect(out);
    return (L.delay || 0) + dur;
  }
  if (L.type === 'crackle') {
    for (let i = 0; i < L.count; i++) {
      const ti = t + rng() * L.span, d = 0.004 + rng() * 0.02, f = L.f0 + rng() * (L.f1 - L.f0);
      const src = noiseSource(ctx, 'white', ti, d, rng), bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f * rate; bp.Q.value = 1.5;
      const g = ctx.createGain(); envelope(g.gain, ti, { attack: 0.0008, dur: d, gain: gain * (0.35 + 0.65 * rng()) });
      src.connect(bp); bp.connect(g); g.connect(out);
    }
    return (L.delay || 0) + L.span + 0.03;
  }
  if (L.type === 'bubbles') {
    for (let i = 0; i < L.count; i++) {
      const ti = t + rng() * L.span, f = (L.f0 + rng() * (L.f1 - L.f0)) * rate, d = 0.05 + rng() * 0.07;
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(f, ti); o.frequency.exponentialRampToValueAtTime(f * 1.6, ti + d);
      const g = ctx.createGain(); envelope(g.gain, ti, { attack: 0.004, dur: d, gain: gain * (0.4 + 0.6 * rng()) });
      o.connect(g); g.connect(out); o.start(ti); o.stop(ti + d + 0.02);
    }
    return (L.delay || 0) + L.span + 0.13;
  }
  throw new Error(`Tipo de capa desconocido: ${L.type}`);
}

/** Reproduce un conjunto de capas y devuelve su duración total en segundos. */
export function renderLayers(ctx, out, layers, t0, { seed = 1, rate = 1 } = {}) {
  const rng = mulberry32(seed); let end = 0;
  for (const L of layers) end = Math.max(end, playLayer(ctx, out, L, t0, rng, rate));
  return end;
}
