const KEY = 'ew.settings.v1';
const DEFAULTS = {
  quality: matchMedia('(pointer:coarse)').matches ? 'low' : 'medium',
  reduceMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
  lang: 'es'
};
const VALID = { quality: v => ['low', 'medium', 'high'].includes(v), reduceMotion: v => typeof v === 'boolean', lang: v => ['es', 'en'].includes(v) };

export class Settings {
  constructor() { this.s = { ...DEFAULTS }; this.subs = new Set(); this.load(); }
  load() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) || '{}');
      for (const k in DEFAULTS) if (VALID[k](raw[k])) this.s[k] = raw[k];
    } catch (e) { console.warn('[settings] valores inválidos, se usan los predeterminados', e); }
  }
  save() { try { localStorage.setItem(KEY, JSON.stringify(this.s)); } catch (e) { console.warn('[settings] no se pudo guardar', e); } }
  get() { return { ...this.s }; }
  set(p) { for (const k in p) if (k in DEFAULTS && VALID[k](p[k])) this.s[k] = p[k]; this.save(); this.emit(); }
  reset() { this.s = { ...DEFAULTS }; this.save(); this.emit(); }
  subscribe(fn) { this.subs.add(fn); fn(this.get()); return () => this.subs.delete(fn); }
  emit() { const v = this.get(); this.subs.forEach(f => f(v)); }
}
