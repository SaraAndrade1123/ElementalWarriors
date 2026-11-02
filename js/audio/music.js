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
// ── Canciones extra (v1.5): se eligen en Ajustes › Sonido › Canción. Llevan melodía (lead, 1 compás = 16 pasos; número =
//    semitonos sobre la tónica + leadOct, −1 = silencio) y, algunas, línea de bajo (bass: semitonos sobre la fundamental del acorde).
const _ = -1;
export const SONGS = {
  epic: { // «Himno de los Cuatro Elementos»: re menor heroico, cuerdas, metales y taikos
    trim: 1.05, bpm: 92, root: 38, padWave: 'sawtooth', padCut: 1300, padGain: 0.035, inst: 'brass', leadInst: 'brass', leadOct: 24,
    chords: [[0, 3, 7], [-4, 0, 3], [3, 7, 10], [-2, 2, 5], [0, 3, 7], [-4, 0, 3], [-7, -3, 0], [-5, -1, 2]],
    arp: { menu: [0, -1, -1, -1, -1, -1, 1, -1, -1, -1, -1, -1, 2, -1, -1, -1], battle: [0, -1, 1, -1, 2, -1, 1, -1, 0, -1, 1, -1, 2, -1, 4, -1] },
    drums: { menu: 't...............', battle: 'T...t.t.T...t.tt' },
    lead: [[12, _, _, _, 10, _, 12, _, 15, _, _, _, 14, _, 12, _], [10, _, _, _, 8, _, 7, _, 5, _, _, _, 7, _, _, _], [12, _, _, _, 15, _, 17, _, 19, _, _, _, 17, _, 15, _], [14, _, _, _, 12, _, 10, _, 12, _, _, _, _, _, _, _],
      [19, _, _, _, 17, _, 15, _, 17, _, _, _, 15, _, 14, _], [12, _, _, _, 10, _, 12, _, 15, _, _, _, 12, _, _, _], [8, _, _, _, 7, _, 5, _, 7, _, _, _, 10, _, 12, _], [14, _, _, _, _, _, 12, _, 11, _, _, _, _, _, _, _]],
    texture: 'none' },
  synth: { // «Neón Elemental»: synthwave en la menor, bajo en corcheas y caja con eco
    trim: 0.95, bpm: 118, root: 33, padWave: 'sawtooth', padCut: 1800, padGain: 0.03, inst: 'pluck', instWave: 'sawtooth', instCut: 2400, leadInst: 'square', leadOct: 36,
    chords: [[0, 3, 7], [-4, 0, 3], [3, 7, 10], [-2, 2, 5]],
    arp: { menu: [0, -1, 1, -1, 2, -1, 4, -1, 2, -1, 1, -1, 0, -1, 1, -1], battle: [0, 1, 2, 4, 2, 1, 0, 1, 2, 4, 5, 4, 2, 1, 2, 4] },
    drums: { menu: 'k.......k.......', battle: 'k.h.s.h.k.hks.hh' },
    bass: [0, _, 0, _, 0, _, 12, _, 0, _, 0, _, 12, _, 0, _],
    lead: [[12, _, 15, _, 19, _, _, 17, _, 15, _, 12, _, _, _, _], [8, _, 12, _, 15, _, _, 12, _, _, 10, _, 8, _, _, _], [15, _, 19, _, 22, _, _, 19, _, 17, _, 15, _, _, _, _], [14, _, _, _, 12, _, 10, _, 14, _, _, _, 12, _, _, _]],
    texture: 'none' },
  lofi: { // «Brisa del Templo»: lo-fi relajado en fa, piano eléctrico, acordes con séptima y crujido de vinilo
    trim: 1.1, bpm: 76, root: 41, padWave: 'triangle', padCut: 1100, padGain: 0.04, inst: 'epiano', leadInst: 'epiano', leadOct: 24,
    chords: [[0, 4, 7, 11], [-3, 0, 4, 7], [2, 5, 9, 12], [-5, -1, 2, 5]],
    arp: { menu: [0, -1, -1, 2, -1, -1, 1, -1, 3, -1, -1, -1, 2, -1, -1, -1], battle: [0, -1, 2, -1, 1, -1, 3, -1, 2, -1, 1, -1, 4, -1, 3, -1] },
    drums: { menu: 'k.......s..k....', battle: 'k..h.sh.kk.h.sh.' },
    bass: [0, _, _, _, _, _, 7, _, 0, _, _, _, 12, _, _, _],
    lead: [[16, _, _, 14, _, 12, _, _, _, _, _, _, _, _, _, _], [_, _, 12, _, 14, _, 16, _, _, 19, _, _, _, _, _, _], [21, _, _, 19, _, _, 16, _, 14, _, _, _, _, _, _, _], [_, _, _, _, 12, _, 11, _, 12, _, _, _, _, _, _, _]],
    texture: 'vinyl' },
  drums: { // «Tambores del Volcán»: percusión de guerra, bordón grave y gritos de metal
    trim: 1, bpm: 104, root: 36, padWave: 'sawtooth', padCut: 700, padGain: 0.03, inst: 'wood', leadInst: 'brass', leadOct: 24,
    chords: [[0, 7, 12], [1, 8, 13], [0, 7, 12], [-2, 5, 10]],
    arp: { menu: [0, -1, -1, 0, -1, -1, 1, -1, 0, -1, -1, 0, -1, -1, 2, -1], battle: [0, -1, 0, 1, -1, 0, 2, -1, 0, -1, 0, 1, -1, 2, 1, -1] },
    drums: { menu: 'T.....t.T.......', battle: 'T.t.tTt.T.tt.Tt.' },
    lead: [[12, _, _, _, _, _, 13, _, 12, _, _, _, _, _, _, _], [_, _, _, _, _, _, _, _, 15, _, 13, _, 12, _, _, _], [12, _, _, _, _, _, 13, _, 15, _, _, _, 17, _, _, _], [15, _, 13, _, 12, _, _, _, 10, _, _, _, _, _, _, _]],
    texture: 'rumble' },
};
Object.assign(TRACKS, SONGS);
export const ELEMENT_TRACKS = ['fire', 'water', 'earth', 'wind', 'neutral'];
export const SONG_IDS = Object.keys(SONGS);
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
  } else if (tr.inst === 'brass' || tr.inst === 'epiano') voice(ctx, out, tr.inst, t, f, len, vol * .85, rng);
  else tone(ctx, out, { t, f, dur: 0.4, type: tr.instWave || 'triangle', gain: 0.12 * vol, cut: tr.instCut || 3000 });
}
// voces de melodía: metales (dos sierras filtradas con ataque lento), onda cuadrada (synthwave) y piano eléctrico (campana suave)
function voice(ctx, out, kind, t, f, len, vol, rng) {
  if (kind === 'brass') { for (const d of [-6, 6]) tone(ctx, out, { t, f: f * Math.pow(2, d / 1200), dur: len * 2.2, type: 'sawtooth', gain: 0.045 * vol, attack: 0.05, cut: 1500, vib: { hz: 5, cents: 8 } }); }
  else if (kind === 'square') { tone(ctx, out, { t, f, dur: len * 2, type: 'square', gain: 0.04 * vol, attack: 0.01, cut: 2600, vib: { hz: 6, cents: 10 } }); tone(ctx, out, { t: t + len * 1.5, f, dur: len * 1.5, type: 'square', gain: 0.015 * vol, cut: 1800 }); }
  else { tone(ctx, out, { t, f, dur: 1.1, type: 'sine', gain: 0.09 * vol }); tone(ctx, out, { t, f: f * 2, dur: 0.35, type: 'sine', gain: 0.03 * vol }); tone(ctx, out, { t, f: f * 4.02, dur: 0.12, type: 'sine', gain: 0.012 * vol }); }
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
  if (tr.lead && (mode === 'battle' || bar % 8 >= 4)) { const n = tr.lead[bar % tr.lead.length][k]; if (n >= 0) voice(ctx, out, tr.leadInst || 'brass', t, midiToHz(tr.root + (tr.leadOct ?? 24) + n), s16 * 2, mode === 'battle' ? 1 : .7, rng); } // en el menú la melodía entra cada pocos compases
  if (tr.bass && mode === 'battle') { const b = tr.bass[k]; if (b >= 0) tone(ctx, out, { t, f: midiToHz(tr.root + 12 + chord[0] + b), dur: s16 * 1.8, type: 'sawtooth', gain: 0.07, cut: 520 }); }
  if (tr.texture === 'vinyl' && rng() < .25) hit(ctx, out, { t: t + rng() * s16, ft: 'highpass', f: 3000, dur: 0.006, gain: 0.025, rng });
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
