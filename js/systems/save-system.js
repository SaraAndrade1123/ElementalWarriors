// Guardado local validado. NO es seguro para economía competitiva en línea (ver prompt maestro §21/§30).
const KEY = 'ew.save.v1', VERSION = 1, CAP = 9999999;
const int = (v, max = CAP) => (Number.isFinite(v) ? Math.min(max, Math.max(0, Math.floor(v))) : 0);
const ID = /^[\w-]{1,40}$/;
const strs = (a, n) => (Array.isArray(a) ? [...new Set(a.filter(x => typeof x === 'string' && x.length > 0 && x.length <= 64))].slice(-n) : []);
const counts = o => { const r = {}; if (o && typeof o === 'object') for (const [k, v] of Object.entries(o).slice(0, 64)) if (ID.test(k)) r[k] = int(v, 1e6); return r; };

export const defaults = () => ({
  v: VERSION, gold: { balance: 0, earned: 0, spent: 0 }, rewards: [], owned: [], equipped: {}, done: [],
  challenges: [], story: {}, records: { arcade: { score: 0, char: '' }, survival: { wins: 0, score: 0, sec: 0, char: '' } },
  stats: { matches: 0, wins: 0, losses: 0, draws: 0, roundsWon: 0, maxCombo: 0, maxDamage: 0, playSec: 0, transformations: 0, purchases: 0, arcadeClears: 0, storyClears: 0, winsBy: {} }
});

export function sanitize(raw) {
  const d = defaults(); if (!raw || typeof raw !== 'object') return d;
  const g = raw.gold || {}; d.gold = { balance: int(g.balance), earned: int(g.earned), spent: int(g.spent) };
  d.rewards = strs(raw.rewards, 200); d.owned = strs(raw.owned, 500); d.done = strs(raw.done, 200);
  if (raw.equipped && typeof raw.equipped === 'object') for (const [k, v] of Object.entries(raw.equipped).slice(0, 64)) if (ID.test(k) && typeof v === 'string' && v.length <= 64) d.equipped[k] = v;
  d.challenges = strs(raw.challenges, 100).filter(x => ID.test(x)); d.story = counts(raw.story); for (const k of Object.keys(d.story)) d.story[k] = Math.min(d.story[k], 99);
  const rc = raw.records || {}, ra = rc.arcade || {}, rs = rc.survival || {}, ch = v => (typeof v === 'string' && ID.test(v) ? v : '');
  d.records = { arcade: { score: int(ra.score), char: ch(ra.char) }, survival: { wins: int(rs.wins, 9999), score: int(rs.score), sec: int(rs.sec, 1e9), char: ch(rs.char) } };
  const s = raw.stats || {};
  for (const k of Object.keys(d.stats)) if (k !== 'winsBy') d.stats[k] = int(s[k], k === 'playSec' ? 1e9 : 1e6);
  d.stats.winsBy = counts(s.winsBy);
  return d;
}

export class MemoryStorage { // para pruebas o si el navegador bloquea localStorage
  constructor() { this.m = new Map(); }
  getItem(k) { return this.m.has(k) ? this.m.get(k) : null; }
  setItem(k, v) { this.m.set(k, String(v)); }
  removeItem(k) { this.m.delete(k); }
}

export class SaveSystem {
  constructor(storage) {
    try { this.storage = storage ?? globalThis.localStorage ?? new MemoryStorage(); } catch { this.storage = new MemoryStorage(); }
    this.persistent = true; this.readOnly = false; this.subs = new Set(); this.data = this._load();
  }
  _load() {
    try {
      const txt = this.storage.getItem(KEY); if (!txt) return defaults();
      const raw = JSON.parse(txt);
      if (raw?.v > VERSION) { this.readOnly = true; console.warn('[save] guardado de una versión más nueva: se ignora y no se sobrescribe'); return defaults(); }
      return sanitize(raw);
    } catch (e) { console.warn('[save] datos ilegibles, se usan valores iniciales', e); return defaults(); }
  }
  _write() {
    if (this.readOnly) return false;
    try { this.storage.setItem(KEY, JSON.stringify(this.data)); this.persistent = true; return true; }
    catch (e) { this.persistent = false; console.warn('[save] no se pudo guardar', e); return false; }
  }
  // Operación atómica: fn recibe una copia; si devuelve {ok:false} no se guarda nada.
  commit(fn) {
    const draft = structuredClone(this.data), res = fn(draft);
    if (res && res.ok === false) return res;
    this.data = sanitize(draft); this._write(); this.subs.forEach(f => f(this.data)); return res ?? { ok: true };
  }
  reset() { this.data = defaults(); this._write(); this.subs.forEach(f => f(this.data)); }
  subscribe(fn) { this.subs.add(fn); return () => this.subs.delete(fn); }
}
