// Música generativa: una pieza por elemento, compuesta con datos (acordes + patrones) y sintetizada en tiempo real.
// «menu» = calmado (sin percusión); «battle» = más rítmico. Cada pieza tiene su carácter:
//  fuego: frigio, tenso, percusión seca · agua: campanas y bajo suave · tierra: tambores graves y bordón · viento: flauta y arpegios aéreos.
import { midiToHz, mulberry32, envelope, noiseBuffer, MIN_GAIN } from './synth.js';

const D = '.'; // silencio en los patrones de percusión
// Patrones de 16 pasos (semicorcheas). Arpegio: índice de la nota del acorde (0..), 4+ = octava superior; -1 = silencio.
export const TRACKS = {
  fire: {
    trim: 1.39, bpm: 100, root: 38, padWave: 'sawtooth', padCut: 900, padGain: 0.03, inst: 'pluck', instWave: 'sawtooth', instCut: 2600,
    chords: [[0, 3, 7], [1, 5, 8], [-2, 2, 5], [0, 3, 7]],
    arp: { menu: [0, -1, -1, -1, 2, -1, -1, -1, 1, -1, -1, -1, 2, -1, -1, -1], battle: [0, -1, 1, -1, 2, -1, 1, -1, 0, -1, 2, -1, 3, -1, 2, -1] },
    drums: { menu: '................', battle: 'k...s.k.k.k.s...' }, texture: 'embers'
  },
  water: {
    trim: 0.86, bpm: 78, root: 33, padWave: 'triangle', padCut: 1600, padGain: 0.05, inst: 'bell',
    chords: [[0, 3, 7, 14], [-4, 0, 3, 7], [3, 7, 10, 14], [-2, 2, 5, 9]],
    arp: { menu: [0, -1, -1, 2, -1, -1, 1, -1, -1, 3, -1, -1, 2, -1, -1, -1], battle: [0, -1, 2, -1, 1, -1, 3, -1, 2, -1, 1, -1, 4, -1, 3, -1] },
    drums: { menu: '................', battle: 'k.......k.......' }, texture: 'drops'
  },
  earth: {
    trim: 0.8, bpm: 72, root: 36, padWave: 'sawtooth', padCut: 480, padGain: 0.035, inst: 'wood',
    chords: [[0, 7, 12], [-2, 5, 10], [-4, 3, 8], [-2, 5, 10]],
    arp: { menu: [0, -1, -1, -1, -1, -1, 1, -1, -1, -1, -1, -1, 2, -1, -1, -1], battle: [0, -1, -1, 1, -1, -1, 2, -1, 0, -1, -1, 1, -1, -1, 2, -1] },
    drums: { menu: 't.......t.......', battle: 't.....t.T.t.....' }, texture: 'rumble'
  },
  wind: {
    trim: 0.96, bpm: 112, root: 40, padWave: 'triangle', padCut: 2400, padGain: 0.045, inst: 'flute',
    chords: [[0, 4, 7, 11], [2, 6, 9, 12], [-3, 0, 4, 7], [0, 4, 7, 11]],
    arp: { menu: [0, -1, 1, -1, 2, -1, 3, -1, 2, -1, 1, -1, 0, -1, -1, -1], battle: [0, 1, 2, 3, 2, 1, 0, 1, 2, 3, 4, 3, 2, 1, 2, 3] },
    drums: { menu: '................', battle: 'k...h...k.h.h...' }, texture: 'air'
  },
  neutral: {
    trim: 1.07, bpm: 88, root: 43, padWave: 'triangle', padCut: 1500, padGain: 0.045, inst: 'pluck', instWave: 'triangle', instCut: 3200,
    chords: [[0, 4, 7], [-3, 0, 4], [-7, -3, 0], [-5, -1, 2]],
    arp: { menu: [0, -1, -1, 1, -1, -1, 2, -1, -1, 1, -1, -1, 0, -1, -1, -1], battle: [0, -1, 1, -1, 2, -1, 1, -1, 0, -1, 1, -1, 2, -1, 3, -1] },
    drums: { menu: '................', battle: 'k...h...k...h...' }, texture: 'none'
  }
};
export const TRACK_IDS = Object.keys(TRACKS);
export const MODES = ['menu', 'battle'];
export const trackFor = element => (TRACKS[element] ? element : 'neutral');

// ---------- Instrumentos ----------
function tone(ctx, out, { t, f, dur, type = 'triangle', gain = 0.1, attack = 0.005, curve = 'exp', cut = 0, vib = null }) {
  const o = ctx.createOscillator(); o.type = type; o.frequency.value = f;
  if (vib) { const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = vib.hz; lg.gain.value = vib.cents; l.connect(lg); lg.connect(o.detune); l.start(t); l.stop(t + dur + 0.1); }
  let node = o;
  if (cut) { const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = cut; node.connect(lp); node = lp; }
  const g = ctx.createGain(); envelope(g.gain, t, { attack, dur, gain, curve, release: 0.3 }); node.connect(g); g.connect(out);
  o.start(t); o.stop(t + dur + 0.1);
}
function hit(ctx, out, { t, color = 'white', ft = 'highpass', f = 5000, q = 1, dur = 0.05, gain = 0.1, rng }) {
  const s = ctx.createBufferSource(); s.buffer = noiseBuffer(ctx, color); s.loop = true; s.start(t, rng() * 1.2); s.stop(t + dur + 0.05);
  const fl = ctx.createBiquadFilter(); fl.type = ft; fl.frequency.value = f; fl.Q.value = q;
  const g = ctx.createGain(); envelope(g.gain, t, { attack: 0.001, dur, gain }); s.connect(fl); fl.connect(g); g.connect(out);
}
function pad(ctx, out, t, dur, freqs, tr) {
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = tr.padCut; lp.Q.value = 0.5;
  const g = ctx.createGain(), a = Math.min(0.7, dur * 0.3), g0 = tr.padGain;
  g.gain.setValueAtTime(MIN_GAIN, t); g.gain.linearRampToValueAtTime(g0, t + a); g.gain.setValueAtTime(g0, t + dur - 0.2); g.gain.exponentialRampToValueAtTime(MIN_GAIN, t + dur + 0.5);
  for (const f of freqs) for (const det of [-7, 7]) { const o = ctx.createOscillator(); o.type = tr.padWave; o.frequency.value = f; o.detune.value = det; o.connect(lp); o.start(t); o.stop(t + dur + 0.6); }
  lp.connect(g); g.connect(out);
}
function kick(ctx, out, t, gain = 0.4) {
  const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
  const g = ctx.createGain(); envelope(g.gain, t, { attack: 0.002, dur: 0.22, gain }); o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.25);
}
function taiko(ctx, out, t, big, rng) {
  const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(big ? 95 : 130, t); o.frequency.exponentialRampToValueAtTime(big ? 42 : 60, t + 0.3);
  const g = ctx.createGain(); envelope(g.gain, t, { attack: 0.002, dur: big ? 0.6 : 0.4, gain: big ? 0.6 : 0.4 }); o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.7);
  hit(ctx, out, { t, color: 'brown', ft: 'lowpass', f: 500, dur: 0.12, gain: big ? 0.35 : 0.2, rng });
}

function instrument(ctx, out, tr, t, f, len, rng, mode) {
  const vol = mode === 'battle' ? 1 : 0.8;
  if (tr.inst === 'bell') {
    tone(ctx, out, { t, f, dur: 1.6, type: 'sine', gain: 0.09 * vol }); tone(ctx, out, { t, f: f * 2.01, dur: 1.0, type: 'sine', gain: 0.035 * vol }); tone(ctx, out, { t, f: f * 3.5, dur: 0.5, type: 'sine', gain: 0.015 * vol });
  } else if (tr.inst === 'wood') {
    tone(ctx, out, { t, f, dur: 0.35, type: 'triangle', gain: 0.16 * vol, cut: 1800 }); hit(ctx, out, { t, ft: 'bandpass', f: 1800, q: 4, dur: 0.03, gain: 0.05, rng });
  } else if (tr.inst === 'flute') {
    tone(ctx, out, { t, f, dur: len * 1.6, type: 'sine', gain: 0.1 * vol, attack: 0.04, curve: 'swell', peak: 0.3, vib: { hz: 5.5, cents: 12 } });
    hit(ctx, out, { t, ft: 'bandpass', f: f * 2, q: 2, dur: len * 1.2, gain: 0.012, rng });
  } else tone(ctx, out, { t, f, dur: 0.4, type: tr.instWave || 'triangle', gain: 0.12 * vol, cut: tr.instCut || 3000 });
}

/**
 * Programa un paso (semicorchea) de una pieza. Es una función pura de (pieza, modo, paso, instante): la usa el
 * reproductor en vivo (paso a paso) y el laboratorio (para renderizar compases enteros sin conexión).
 */
export function scheduleStep(ctx, out, track, mode, step, t, rng) {
  const tr = TRACKS[track], s16 = 60 / tr.bpm / 4, bar = Math.floor(step / 16), k = step % 16, chord = tr.chords[bar % tr.chords.length];
  if (k === 0) {
    pad(ctx, out, t, 16 * s16, chord.map(c => midiToHz(tr.root + 24 + c)), tr);
    tone(ctx, out, { t, f: midiToHz(tr.root + chord[0]), dur: 8 * s16, type: 'sine', gain: 0.2, attack: 0.02 });
    if (mode === 'battle') tone(ctx, out, { t: t + 8 * s16, f: midiToHz(tr.root + chord[0]), dur: 6 * s16, type: 'sine', gain: 0.16, attack: 0.02 });
    if (tr.texture === 'drops' && mode === 'menu') for (let i = 0; i < 2; i++) tone(ctx, out, { t: t + rng() * 14 * s16, f: midiToHz(tr.root + 48 + chord[Math.floor(rng() * chord.length)]), dur: 0.5, type: 'sine', gain: 0.03 });
    if (tr.texture === 'air') hit(ctx, out, { t, color: 'pink', ft: 'bandpass', f: 2400, q: 0.6, dur: 16 * s16, gain: 0.02, rng });
    if (tr.texture === 'rumble') tone(ctx, out, { t, f: midiToHz(tr.root - 12 + chord[0]), dur: 16 * s16, type: 'sine', gain: 0.1, attack: 0.5, curve: 'hold' });
  }
  if (tr.texture === 'embers' && k % 4 === 2 && rng() < (mode === 'battle' ? 0.5 : 0.3)) hit(ctx, out, { t, ft: 'bandpass', f: 3000 + rng() * 4000, q: 1.5, dur: 0.012, gain: 0.04, rng });
  const a = tr.arp[mode][k];
  if (a >= 0) { const tones = chord.length; const semis = chord[a % tones] + 12 * Math.floor(a / tones); instrument(ctx, out, tr, t, midiToHz(tr.root + 36 + semis), s16 * 2, rng, mode); }
  const d = tr.drums[mode][k];
  if (d === 'k') kick(ctx, out, t, tr.texture === 'embers' ? 0.38 : 0.3);
  else if (d === 's') hit(ctx, out, { t, ft: 'bandpass', f: 1800, q: 0.8, dur: 0.12, gain: 0.12, rng });
  else if (d === 'h') hit(ctx, out, { t, ft: 'highpass', f: 7000, dur: 0.04, gain: 0.05, rng });
  else if (d === 't') taiko(ctx, out, t, false, rng);
  else if (d === 'T') taiko(ctx, out, t, true, rng);
  if (mode === 'battle' && tr.texture === 'embers' && k % 2 === 0 && d === D) hit(ctx, out, { t, ft: 'highpass', f: 8000, dur: 0.03, gain: 0.03, rng });
}

/** Renderiza `bars` compases (para el laboratorio y las pruebas). Devuelve la duración en segundos. */
export function renderTrack(ctx, out, track, mode, bars, t0 = 0, seed = 7) {
  const tr = TRACKS[track], s16 = 60 / tr.bpm / 4, rng = mulberry32(seed);
  for (let s = 0; s < bars * 16; s++) scheduleStep(ctx, out, track, mode, s, t0 + s * s16, rng);
  return bars * 16 * s16;
}

/** Reproductor en vivo con «lookahead»: programa las notas unos 0,3 s por delante del reloj de audio. */
export class MusicPlayer {
  constructor(ctx, bus) { this.ctx = ctx; this.bus = bus; this.cur = null; this.old = []; this.timer = 0; }
  get playing() { return this.cur ? { track: this.cur.track, mode: this.cur.mode } : null; }

  play(track, mode = 'menu') {
    track = trackFor(track); if (!MODES.includes(mode)) mode = 'menu';
    if (this.cur && this.cur.track === track) { this.cur.mode = mode; return; } // mismo tema: solo cambia el modo (en el próximo compás)
    const { ctx } = this, now = ctx.currentTime, g = ctx.createGain();
    g.gain.setValueAtTime(MIN_GAIN, now); g.gain.exponentialRampToValueAtTime(TRACKS[track].trim ?? 1, now + 1.2); g.connect(this.bus);
    if (this.cur) this.#fadeOut(this.cur, 1.2);
    this.cur = { track, mode, gain: g, step: 0, next: now + 0.08, rng: mulberry32((Math.random() * 1e9) | 0) };
    if (!this.timer) this.timer = setInterval(() => this.#tick(), 40);
  }

  stop(fade = 0.8) { if (this.cur) { this.#fadeOut(this.cur, fade); this.cur = null; } }

  #fadeOut(tr, sec) {
    const { ctx } = this, now = ctx.currentTime; tr.gain.gain.cancelScheduledValues(now); tr.gain.gain.setValueAtTime(Math.max(tr.gain.gain.value, MIN_GAIN), now);
    tr.gain.gain.exponentialRampToValueAtTime(MIN_GAIN, now + sec); tr.dead = now + sec + 1; this.old.push(tr);
  }

  #tick() {
    const { ctx } = this, now = ctx.currentTime;
    this.old = this.old.filter(o => { if (now > o.dead) { try { o.gain.disconnect(); } catch { /* ya desconectado */ } return false; } return true; });
    const c = this.cur;
    if (c) {
      const s16 = 60 / TRACKS[c.track].bpm / 4;
      if (c.next < now) c.next = now + 0.05; // el contexto estuvo suspendido: no recuperar el tiempo perdido
      while (c.next < now + 0.3) { scheduleStep(ctx, c.gain, c.track, c.mode, c.step, c.next, c.rng); c.step++; c.next += s16; }
    } else if (!this.old.length) { clearInterval(this.timer); this.timer = 0; }
  }

  dispose() { this.stop(0.05); clearInterval(this.timer); this.timer = 0; }
}
