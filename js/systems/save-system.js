// Guardado local validado. NO es seguro para economía competitiva en línea (ver prompt maestro §21/§30).
// (v1.11) PROTECCIÓN CONTRA TRAMPAS SENCILLAS: el guardado se escribe cifrado (no es JSON legible) y FIRMADO; si alguien lo
// edita a mano la firma no cuadra y se usa la última copia buena (o se empieza de cero). Además se comprueban reglas de la
// economía (no se puede tener más Rose Gold del que se ha ganado). Un juego que vive solo en el navegador nunca es imposible de
// trucar para alguien con conocimientos; esto evita los trucos fáciles. Para compras con dinero real o rankings en línea hará
// falta validar en un servidor.
const KEY = 'ew.save.v1', BAK = 'ew.save.bak', VERSION = 1, CAP = 9999999;
const SALT = ['ew', 'R0se', 'G0ld', '·', 'v1', '§', 'elem'].join('~');
// cyrb53: huella de 53 bits rápida (no es criptografía fuerte; basta para detectar ediciones manuales)
const hash = (str, seed = 7) => { let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) { const ch = str.charCodeAt(i); h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677); }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909); h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36); };
const b64 = { enc: s => (typeof btoa === 'function' ? btoa(s) : Buffer.from(s, 'binary').toString('base64')), dec: s => (typeof atob === 'function' ? atob(s) : Buffer.from(s, 'base64').toString('binary')) };
const xor = (s, k = SALT) => { let o = ''; for (let i = 0; i < s.length; i++) o += String.fromCharCode(s.charCodeAt(i) ^ k.charCodeAt(i % k.length)); return o; };
export function seal(data) { const body = JSON.stringify(data), u = unescape(encodeURIComponent(body)); return 'EW2.' + hash(SALT + body) + '.' + b64.enc(xor(u)); }
// devuelve { data, state: 'ok' | 'legacy' | 'tampered' | 'bad' }
export function unseal(txt) {
  if (typeof txt !== 'string' || !txt) return { data: null, state: 'bad' };
  if (txt.startsWith('{')) { try { return { data: JSON.parse(txt), state: 'legacy' }; } catch { return { data: null, state: 'bad' }; } } // guardados anteriores a v1.11
  const m = /^EW2\.([0-9a-z]+)\.(.+)$/.exec(txt); if (!m) return { data: null, state: 'bad' };
  try { const body = decodeURIComponent(escape(xor(b64.dec(m[2])))); if (hash(SALT + body) !== m[1]) return { data: null, state: 'tampered' }; return { data: JSON.parse(body), state: 'ok' }; }
  catch { return { data: null, state: 'bad' }; }
}
const int = (v, max = CAP) => (Number.isFinite(v) ? Math.min(max, Math.max(0, Math.floor(v))) : 0);
const ID = /^[\w-]{1,40}$/;
const strs = (a, n) => (Array.isArray(a) ? [...new Set(a.filter(x => typeof x === 'string' && x.length > 0 && x.length <= 64))].slice(-n) : []);
const counts = o => { const r = {}; if (o && typeof o === 'object') for (const [k, v] of Object.entries(o).slice(0, 64)) if (ID.test(k)) r[k] = int(v, 1e6); return r; };

export const defaults = () => ({
  v: VERSION, gold: { balance: 0, earned: 0, spent: 0 }, rewards: [], owned: [], equipped: {}, done: [],
  challenges: [], story: {}, records: { arcade: { score: 0, char: '' }, survival: { wins: 0, score: 0, sec: 0, char: '' } },
  stats: { matches: 0, wins: 0, losses: 0, draws: 0, roundsWon: 0, maxCombo: 0, maxDamage: 0, playSec: 0, transformations: 0, purchases: 0, arcadeClears: 0, storyClears: 0,
    // (v1.8) hazañas para los logros
    rankS: 0, perfects: 0, flawless: 0, exKOs: 0, counters: 0, throws: 0, parries: 0, comebacks: 0, fastWins: 0, mirrorWins: 0, extremeWins: 0, localMatches: 0, dmgTotal: 0,
    winsBy: {}, extremeBy: {} }
});

export function sanitize(raw) {
  const d = defaults(); if (!raw || typeof raw !== 'object') return d;
  const g = raw.gold || {}; d.gold = { balance: int(g.balance), earned: int(g.earned), spent: int(g.spent) };
  // reglas de la economía: lo gastado no supera lo ganado y el saldo nunca es mayor que lo ganado menos lo gastado
  if (!Number.isFinite(g.earned)) d.gold.earned = Math.min(CAP, d.gold.balance + d.gold.spent); // guardados muy antiguos sin «ganado»
  d.gold.spent = Math.min(d.gold.spent, d.gold.earned); d.gold.balance = Math.min(d.gold.balance, d.gold.earned - d.gold.spent);
  d.rewards = strs(raw.rewards, 200); d.owned = strs(raw.owned, 500); d.done = strs(raw.done, 200);
  if (raw.equipped && typeof raw.equipped === 'object') for (const [k, v] of Object.entries(raw.equipped).slice(0, 64)) if (ID.test(k) && typeof v === 'string' && v.length <= 64) d.equipped[k] = v;
  d.challenges = strs(raw.challenges, 100).filter(x => ID.test(x)); d.story = counts(raw.story); for (const k of Object.keys(d.story)) d.story[k] = Math.min(d.story[k], 99);
  const rc = raw.records || {}, ra = rc.arcade || {}, rs = rc.survival || {}, ch = v => (typeof v === 'string' && ID.test(v) ? v : '');
  d.records = { arcade: { score: int(ra.score), char: ch(ra.char) }, survival: { wins: int(rs.wins, 9999), score: int(rs.score), sec: int(rs.sec, 1e9), char: ch(rs.char) } };
  const s = raw.stats || {};
  const MAPS = ['winsBy', 'extremeBy'];
  for (const k of Object.keys(d.stats)) if (!MAPS.includes(k)) d.stats[k] = int(s[k], k === 'playSec' || k === 'dmgTotal' ? 1e9 : 1e6);
  for (const k of MAPS) d.stats[k] = counts(s[k]);
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
      let txt = this.storage.getItem(KEY); if (!txt) return defaults();
      let { data: raw, state } = unseal(txt);
      if (state === 'legacy' && unseal(this.storage.getItem(BAK)).state === 'ok') state = 'tampered'; // ya hubo guardado firmado: un JSON a mano no vale
      if (state === 'tampered' || state === 'bad') { // editado a mano o dañado: se recupera la última copia buena
        const bak = unseal(this.storage.getItem(BAK)); this.tampered = state === 'tampered';
        console.warn(state === 'tampered' ? '[save] el guardado fue modificado fuera del juego: se recupera la última copia válida' : '[save] guardado dañado: se recupera la copia');
        raw = bak.state === 'ok' ? bak.data : null; if (!raw) return defaults();
      }
      if (raw?.v > VERSION) { this.readOnly = true; console.warn('[save] guardado de una versión más nueva: se ignora y no se sobrescribe'); return defaults(); }
      return sanitize(raw);
    } catch (e) { console.warn('[save] datos ilegibles, se usan valores iniciales', e); return defaults(); }
  }
  _write() {
    if (this.readOnly) return false;
    try { const t = seal(this.data); this.storage.setItem(KEY, t); try { this.storage.setItem(BAK, t); } catch { /* sin espacio para la copia */ } this.persistent = true; return true; }
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
