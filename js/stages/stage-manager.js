// Registro y selección de escenarios. Sin Three.js: se puede probar con Node (npm test).
const KEY = 'ew.stage.v1';
const HEX = /^#[0-9a-f]{6}$/i;
const FX = ['leaves', 'ash', 'bubbles', 'dust', 'streaks', 'motes'];
export const RANDOM = 'random';

// Devuelve la lista de problemas de una configuración (vacía = válida)
export function validateStage(s) {
  const e = [], bad = m => e.push(`${s?.id ?? '?'}: ${m}`);
  if (!s || typeof s.id !== 'string' || !/^[a-z0-9_]+$/.test(s.id)) return [`id inválido (${s?.id})`];
  if (!Array.isArray(s.sky) || s.sky.length < 2 || !s.sky.every(c => HEX.test(c))) bad('sky necesita ≥2 colores #rrggbb');
  for (const k of ['ground', 'slab', 'accent', 'rim', 'key']) if (!HEX.test(s[k])) bad(`${k} no es #rrggbb`);
  if (!s.fog || !HEX.test(s.fog.color) || !(s.fog.density > 0 && s.fog.density < .1)) bad('fog inválida');
  if (!(s.keyI > 0 && s.keyI <= 5)) bad('keyI fuera de rango');
  if (!Array.isArray(s.props)) bad('props debe ser una lista');
  if (!s.fx || !FX.includes(s.fx.kind) || !(s.fx.count >= 0 && s.fx.count <= 600) || !HEX.test(s.fx.color)) bad('fx inválido');
  return e;
}

export class StageManager {
  constructor(stages, { storage = globalThis.localStorage, build = null, isUnlocked = () => true } = {}) {
    this.list = []; this.byId = new Map(); this.problems = [];
    for (const s of stages) { // un escenario mal definido se omite, no rompe el juego
      const p = validateStage(s);
      if (p.length || this.byId.has(s.id)) { this.problems.push(...(p.length ? p : [`${s.id}: id repetido`])); continue; }
      this.list.push(s); this.byId.set(s.id, s);
    }
    Object.assign(this, { storage, build, isUnlocked }); this.current = null; this.selected = this.list[0]?.id ?? null; this._load();
  }
  _load() {
    try { const v = JSON.parse(this.storage?.getItem(KEY) ?? 'null'); if (v === RANDOM || this.byId.has(v)) this.selected = v; } catch { /* guardado dañado: se ignora */ }
  }
  select(id) {
    if (id !== RANDOM && !this.byId.has(id)) return false;
    if (id !== RANDOM && !this.isUnlocked(this.byId.get(id))) return false;
    this.selected = id; try { this.storage?.setItem(KEY, JSON.stringify(id)); } catch { /* sin almacenamiento */ } return true;
  }
  available() { return this.list.filter(s => this.isUnlocked(s)); }
  // Resuelve la selección (incluido «aleatorio») a un escenario concreto
  resolve(id = this.selected, rnd = Math.random) {
    const pool = this.available(); if (!pool.length) return null;
    if (id === RANDOM) return pool[Math.floor(rnd() * pool.length)];
    const s = this.byId.get(id); return s && this.isUnlocked(s) ? s : pool[0];
  }
  // Construye el escenario y lo deja como «actual» (para stage.react desde el combate)
  create(id, opts) {
    const cfg = this.resolve(id); if (!cfg || !this.build) return null;
    this.current = this.build(cfg, opts); this.currentId = cfg.id; return this.current;
  }
  react(ev) { this.current?.react?.(ev); }
}
