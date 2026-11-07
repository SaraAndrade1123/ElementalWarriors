// Ajustes del jugador (F9): gráficos, controles, táctil, accesibilidad e idioma. El sonido vive en el gestor de audio.
// Todo se valida al cargar y al cambiar: un valor raro en el guardado vuelve al predeterminado (nunca rompe el juego).
const KEY = 'ew.settings.v1';
const coarse = (() => { try { return matchMedia('(pointer:coarse)').matches; } catch { return false; } })();
const prefersReduce = (() => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } })();
export const ACTIONS = ['left', 'right', 'jump', 'down', 'l', 'm', 'h', 's', 'r', 'w', 't', 'guard'];
export const KEY_SCHEMES = ['solo', 'vs1', 'vs2'];
const DEFAULTS = {
  // gráficos
  quality: coarse ? 'low' : 'medium', res: 100, shadows: 'auto', particles: 'auto', post: 'auto', outlines: true, camFx: true, reduceMotion: prefersReduce,
  // controles (solo las teclas cambiadas: { solo: { l: 'KeyJ' }, vs1: {...}, vs2: {...} })
  keys: {},
  // táctil
  tSize: 1, tOpacity: 1, tLayout: 'right',
  // accesibilidad
  uiScale: 1, contrast: false, subtitles: true, textSpeed: 'normal', altCues: false, reduceFlash: false, calmCam: false, autoPause: true,
  lang: 'es',
};
const CODE = /^[A-Za-z0-9]{2,20}$/; // KeyA, Digit1, Numpad0, ArrowLeft, ShiftLeft…
export const RESERVED = ['Escape', 'KeyP', 'F1', 'Tab', 'Enter', 'MetaLeft', 'MetaRight'];
const validKeys = v => v && typeof v === 'object' && !Array.isArray(v) && Object.entries(v).every(([sc, m]) => KEY_SCHEMES.includes(sc) && m && typeof m === 'object' &&
  Object.entries(m).every(([a, c]) => ACTIONS.includes(a) && typeof c === 'string' && CODE.test(c) && !RESERVED.includes(c)));
const oneOf = (...a) => v => a.includes(v), bool = v => typeof v === 'boolean', num = (lo, hi) => v => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;
const VALID = {
  quality: oneOf('low', 'medium', 'high'), res: oneOf(50, 70, 85, 100), shadows: oneOf('auto', 'on', 'off'), particles: oneOf('auto', 'low', 'medium', 'high'), post: oneOf('auto', 'on', 'off'),
  outlines: bool, camFx: bool, reduceMotion: bool, keys: validKeys, tSize: num(.7, 1.5), tOpacity: num(.3, 1), tLayout: oneOf('right', 'left'),
  uiScale: oneOf(.9, 1, 1.15, 1.3), contrast: bool, subtitles: bool, textSpeed: oneOf('slow', 'normal', 'fast', 'instant'), altCues: bool, reduceFlash: bool, calmCam: bool, autoPause: bool,
  lang: oneOf('es', 'en'),
};
export const SETTINGS_DEFAULTS = DEFAULTS;
const clone = v => JSON.parse(JSON.stringify(v));

export class Settings {
  constructor(storage = null) { this.store = storage; this.s = clone(DEFAULTS); this.subs = new Set(); this.load(); }
  get ls() { try { return this.store ?? globalThis.localStorage; } catch { return null; } }
  load() {
    try {
      const raw = JSON.parse(this.ls?.getItem(KEY) || '{}');
      for (const k in DEFAULTS) if (k in raw && VALID[k](raw[k])) this.s[k] = clone(raw[k]);
    } catch (e) { console.warn('[settings] valores inválidos, se usan los predeterminados', e); }
  }
  save() { try { this.ls?.setItem(KEY, JSON.stringify(this.s)); } catch (e) { console.warn('[settings] no se pudo guardar', e); } }
  get() { return clone(this.s); }
  set(p) { let ok = false; for (const k in p) if (k in DEFAULTS && VALID[k](p[k])) { this.s[k] = clone(p[k]); ok = true; } if (ok) { this.save(); this.emit(); } return ok; }
  reset(group = null) { // group: null = todo, o una lista de claves (p. ej. restablecer solo los controles)
    const keys = group || Object.keys(DEFAULTS); for (const k of keys) if (k in DEFAULTS) this.s[k] = clone(DEFAULTS[k]); this.save(); this.emit();
  }
  subscribe(fn) { this.subs.add(fn); fn(this.get()); return () => this.subs.delete(fn); }
  emit() { const v = this.get(); this.subs.forEach(f => f(v)); }
}
