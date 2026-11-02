// Gestor de audio: buses de volumen, persistencia validada, desbloqueo por gesto del usuario y API pública.
//   audio.sfx('hit_heavy', { element: 'fire', x: 3.2 })   → efecto (x = posición en el plano de combate, panea el sonido)
//   audio.music('water', 'battle')                         → música por elemento/modo (cambia con fundido)
// Si WebAudio no existe o falla, todo queda en silencio SIN lanzar errores (el juego sigue funcionando).
import { layersFor, durationOf, SFX } from '../audio/sfx-bank.js';
import { renderLayers } from '../audio/synth.js';
import { MusicPlayer } from '../audio/music.js';

const KEY = 'ew.audio.v1';
const DEFAULTS = { music: 0.5, sfx: 0.8, voice: 0.8, muted: false };
const clamp01 = v => Math.min(1, Math.max(0, v));
/** Curva perceptual: el control del jugador (0..1) se convierte en ganancia cuadrática. */
export const volToGain = v => clamp01(v) ** 2;
export const MAX_VOICES = 24;
const MUSIC_MAX = 0.6; // la música nunca tapa a los efectos

function sanitize(raw) {
  const s = { ...DEFAULTS };
  if (raw && typeof raw === 'object') {
    for (const k of ['music', 'sfx', 'voice']) if (typeof raw[k] === 'number' && Number.isFinite(raw[k])) s[k] = clamp01(raw[k]);
    if (typeof raw.muted === 'boolean') s.muted = raw.muted;
  }
  return s;
}

export class AudioManager {
  constructor({ storage = globalThis.localStorage, AudioCtor = globalThis.AudioContext || globalThis.webkitAudioContext } = {}) {
    this.storage = storage; this.AudioCtor = AudioCtor; this.ctx = null; this.ready = false; this.failed = false;
    this.subs = new Set(); this.active = 0; this.last = new Map(); this.player = null; this.hidden = false; this.ducked = false; this.pending = null;
    try { this.s = sanitize(JSON.parse(this.storage?.getItem(KEY) ?? 'null')); } catch { this.s = { ...DEFAULTS }; }
  }

  get available() { return !!this.AudioCtor && !this.failed; }
  get settings() { return { ...this.s }; }

  /** Debe llamarse desde un gesto del usuario (clic/tecla): los navegadores no dejan sonar antes. */
  async unlock() {
    if (!this.available) return false;
    try {
      if (!this.ctx) this.#build();
      if (this.ctx.state === 'suspended' && !this.hidden) await this.ctx.resume();
      if (!this.ready) { this.ready = true; if (this.pending) { const p = this.pending; this.pending = null; this.music(p.element, p.mode); } }
      return true;
    } catch (err) { console.warn('[audio] No se pudo iniciar el audio; el juego continúa en silencio.', err); this.failed = true; this.ready = false; return false; }
  }

  #build() {
    const ctx = this.ctx = new this.AudioCtor({ latencyHint: 'interactive' });
    this.master = ctx.createGain();
    this.comp = ctx.createDynamicsCompressor(); // evita saturación cuando suenan muchos efectos a la vez
    Object.assign(this.comp.threshold, { value: -14 }); Object.assign(this.comp.knee, { value: 12 }); Object.assign(this.comp.ratio, { value: 6 });
    Object.assign(this.comp.attack, { value: 0.003 }); Object.assign(this.comp.release, { value: 0.2 });
    this.sfxBus = ctx.createGain(); this.voiceBus = ctx.createGain(); this.musicBus = ctx.createGain();
    this.musicFilter = ctx.createBiquadFilter(); this.musicFilter.type = 'lowpass'; this.musicFilter.frequency.value = 20000;
    this.sfxBus.connect(this.master); this.voiceBus.connect(this.master); this.musicBus.connect(this.musicFilter); this.musicFilter.connect(this.master);
    this.master.connect(this.comp); this.comp.connect(ctx.destination);
    this.player = new MusicPlayer(ctx, this.musicBus);
    this.#applyVolumes(true);
  }

  #applyVolumes(instant = false) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, k = instant ? 0.001 : 0.03, m = this.s.muted ? 0 : 1;
    this.master.gain.setTargetAtTime(m, t, k);
    this.sfxBus.gain.setTargetAtTime(volToGain(this.s.sfx), t, k);
    this.voiceBus.gain.setTargetAtTime(volToGain(this.s.voice), t, k);
    this.musicBus.gain.setTargetAtTime(volToGain(this.s.music) * MUSIC_MAX * (this.ducked ? 0.5 : 1), t, this.ducked ? 0.08 : k);
  }

  #save() { try { this.storage?.setItem(KEY, JSON.stringify(this.s)); } catch { /* sin almacenamiento: no se guarda */ } this.subs.forEach(f => f(this.settings)); }
  setVolume(kind, v) { if (!(kind in DEFAULTS) || kind === 'muted' || !Number.isFinite(v)) return false; this.s[kind] = clamp01(v); this.#applyVolumes(); this.#save(); return true; }
  setMuted(m) { this.s.muted = !!m; this.#applyVolumes(); this.#save(); }
  reset() { this.s = { ...DEFAULTS }; this.#applyVolumes(); this.#save(); }
  subscribe(fn) { this.subs.add(fn); return () => this.subs.delete(fn); }

  /** Pausa/reanuda el motor (p. ej. al ocultar la pestaña). */
  setHidden(h) { this.hidden = h; if (!this.ctx || this.failed) return; (h ? this.ctx.suspend() : this.ctx.resume()).catch(() => {}); }
  /** Atenúa y apaga los agudos de la música (menú de pausa). */
  duck(on) {
    this.ducked = on; if (!this.ctx) return; const t = this.ctx.currentTime;
    this.musicFilter.frequency.setTargetAtTime(on ? 700 : 20000, t, 0.08); this.#applyVolumes();
  }

  /**
   * Reproduce un efecto. opts: { element, x (posición lógica, -8..8), vol (0..1), rate (tono), seed }.
   * Devuelve true si sonó. Ignora llamadas muy seguidas del mismo efecto (cd) y limita las voces simultáneas.
   */
  sfx(name, { element, x = 0, vol = 1, rate = 1, seed } = {}) {
    if (!this.ready || this.failed || this.s.muted || this.hidden) return false;
    const def = SFX[name]; if (!def) { console.warn(`[audio] Efecto desconocido: «${name}»`); return false; }
    const now = performance.now(), last = this.last.get(name) ?? -1e9;
    if (now - last < def.cd) return false;
    if (this.active >= MAX_VOICES && name !== 'hit_heavy' && name !== 'ko') return false;
    this.last.set(name, now);
    try {
      const { ctx } = this, g = ctx.createGain(); g.gain.value = clamp01(vol) * def.trim; let tail = g;
      if (ctx.createStereoPanner && x) { const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, x / 8.2)) * 0.6; g.connect(p); tail = p; }
      tail.connect(this.sfxBus);
      const layers = layersFor(name, element), r = rate * (1 + (Math.random() - 0.5) * 0.06); // ±3 % de tono para que no suene repetido
      const dur = renderLayers(ctx, g, layers, ctx.currentTime + 0.005, { seed: seed ?? ((Math.random() * 1e9) | 0), rate: r }) || durationOf(layers);
      this.active++; setTimeout(() => { this.active--; try { g.disconnect(); } catch { /* ya desconectado */ } }, (dur + 0.2) * 1000);
      return true;
    } catch (err) { console.warn('[audio] Error al reproducir', name, err); return false; }
  }

  music(element, mode = 'menu') {
    if (!this.ready) { this.pending = { element, mode }; return; }
    try { this.player.play(element, mode); } catch (err) { console.warn('[audio] Error de música', err); }
  }
  stopMusic(fade) { this.pending = null; this.player?.stop(fade); }
  get nowPlaying() { return this.player?.playing ?? null; }
}
