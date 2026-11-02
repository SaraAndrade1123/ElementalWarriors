// Pruebas de combate: cada una observa los eventos reales del combate (golpes, bloqueos y lanzamientos) y se completa al llegar a su objetivo.
// Los ids de F7 se conservan (el progreso guardado sigue valiendo); sus objetivos usan ya los golpes de F4.
// Las pruebas de técnicas que aún no existen (transformación) aparecen BLOQUEADAS con su fase.
const LIGHT = new Set(['l', 'cl', 'jl']), HEAVY = new Set(['h', 'ch', 'jh']), LOW = new Set(['cl', 'cm']), AIR = new Set(['jl', 'jm', 'jh', 'ej']);
const TECH = new Set(['s', 'ex', 'eb', 'eu', 'ej']), BEND = new Set(['eb', 'eu', 'ej']);
const hit = (test, by = 0) => e => e.type === 'hit' && e.by === by && test(e.move, e);
export const CHALLENGES = [
  { id: 'punch3', goal: 3, dummy: 'still', infinite: true, test: hit(m => LIGHT.has(m)) },
  { id: 'kick2', goal: 2, dummy: 'still', infinite: true, test: hit(m => HEAVY.has(m)) },
  { id: 'low2', goal: 2, dummy: 'still', infinite: true, test: hit(m => LOW.has(m)) },
  { id: 'air1', goal: 1, dummy: 'still', infinite: true, test: hit(m => AIR.has(m)) },
  { id: 'block3', goal: 3, dummy: 'attack', infinite: true, test: e => e.type === 'block' && e.by === 1 },
  { id: 'combo3', goal: 1, dummy: 'still', infinite: true, test: e => e.type === 'hit' && e.by === 0 && e.combo >= 3 },
  { id: 'ko', goal: 1, dummy: 'still', infinite: false, test: e => e.type === 'hit' && e.by === 0 && e.ko },
  { id: 'special', goal: 1, dummy: 'still', infinite: true, test: hit(m => m === 's') },
  { id: 'cancel', goal: 1, dummy: 'still', infinite: true, test: hit((m, e) => TECH.has(m) && e.combo >= 2) },
  { id: 'resonance', goal: 1, dummy: 'still', infinite: true, test: hit(m => m === 'ex') },
  { id: 'throw', goal: 1, dummy: 'still', infinite: true, test: e => e.type === 'throw' && e.by === 0 },
  { id: 'bend3', goal: 3, dummy: 'still', infinite: true, test: hit(m => BEND.has(m)) },
  { id: 'bendair', goal: 1, dummy: 'still', infinite: true, test: hit(m => m === 'ej') },
  { id: 'transform', locked: 'F5' },
];
export const byId = id => CHALLENGES.find(c => c.id === id);

export class ChallengeTracker {
  constructor(def) { if (!def || def.locked) throw new Error('Prueba no disponible'); this.def = def; this.count = 0; this.done = false; }
  // Devuelve true solo en el evento que completa la prueba (una vez).
  feed(e) {
    if (this.done || !this.def.test(e)) return false;
    this.count = Math.min(this.def.goal, this.count + 1);
    if (this.count >= this.def.goal) { this.done = true; return true; }
    return false;
  }
}
