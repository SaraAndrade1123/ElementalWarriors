// Pruebas de combate: cada una observa los eventos reales del combate (golpes, bloqueos y lanzamientos) y se completa al llegar a su objetivo.
// Los ids de F7 se conservan (el progreso guardado sigue valiendo); sus objetivos usan ya los golpes de F4.
const LIGHT = new Set(['l', 'cl', 'jl']), HEAVY = new Set(['h', 'ch', 'jh']), LOW = new Set(['cl', 'cm']), AIR = new Set(['jl', 'jm', 'jh', 'ej']);
const TECH = new Set(['s', 'ex', 'eb', 'eu', 'ej']), BEND = new Set(['eb', 'eu', 'ej']);
const hit = (test, by = 0) => e => e.type === 'hit' && e.by === by && test(e.move, e);
// kind: 'train' (entrenamiento contra el maniquí, eventos en vivo) · 'fight' (combate contra la CPU con una condición al final)
//       'mode' (se cumple jugando Arcade / Supervivencia / Historia) · 'pvp' (duelos de 2 jugadores). gold = recompensa propia.
const won = c => c.res.winner === 0;
const W = (o) => ({ kind: 'fight', mode: 'cpu', level: 'normal', wins: 2, ...o });
export const CHALLENGES = [
  // ── Técnica (entrenamiento)
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
  { id: 'transform', goal: 1, dummy: 'still', infinite: true, gold: 40, test: e => e.type === 'transform' && e.by === 0 },
  { id: 'combo5', goal: 1, dummy: 'still', infinite: true, gold: 30, test: e => e.type === 'hit' && e.by === 0 && e.combo >= 5 },
  { id: 'combo8', goal: 1, dummy: 'still', infinite: true, gold: 70, test: e => e.type === 'hit' && e.by === 0 && e.combo >= 8 },
  { id: 'juggle3', goal: 3, dummy: 'still', infinite: true, gold: 40, test: e => e.type === 'hit' && e.by === 0 && e.air },
  { id: 'counter3', goal: 3, dummy: 'attack', infinite: true, gold: 40, test: e => e.type === 'hit' && e.by === 0 && e.counter },
  { id: 'gb2', goal: 2, dummy: 'guard', infinite: true, gold: 40, test: e => (e.type === 'crush' || e.type === 'guardbreak') && e.by === 0 },
  { id: 'proj3', goal: 3, dummy: 'still', infinite: true, gold: 30, test: e => e.type === 'hit' && e.by === 0 && e.proj },
  { id: 'bendall', goal: 3, dummy: 'still', infinite: true, gold: 50, key: e => e.move, test: hit(m => BEND.has(m)) },
  { id: 'resko', goal: 1, dummy: 'still', infinite: false, gold: 50, test: e => e.type === 'hit' && e.by === 0 && e.ko && e.move === 'ex' },
  { id: 'tfko', goal: 1, dummy: 'still', infinite: false, gold: 60, test: e => e.type === 'hit' && e.by === 0 && e.ko && e.tf },
  { id: 'block8', goal: 8, dummy: 'attack', infinite: true, gold: 40, test: e => e.type === 'block' && e.by === 1 },
  // ── Combate contra la CPU
  W({ id: 'f_normal', gold: 30, check: won }),
  W({ id: 'f_hard', level: 'hard', gold: 60, check: won }),
  W({ id: 'f_expert', level: 'expert', gold: 120, check: won }),
  W({ id: 'f_flawless', wins: 1, gold: 120, check: c => won(c) && c.s.stats.taken === 0 }),
  W({ id: 'f_flawless_hard', wins: 1, level: 'hard', gold: 220, check: c => won(c) && c.s.stats.taken === 0 }),
  W({ id: 'f_fast', wins: 1, gold: 60, check: c => won(c) && c.res.time < 25 }),
  W({ id: 'f_combo10', gold: 90, check: c => c.s.stats.maxCombo >= 10 }),
  W({ id: 'f_exko', gold: 60, check: c => won(c) && c.s.stats.exKO }),
  W({ id: 'f_tfwin', gold: 70, check: c => won(c) && c.s.stats.tf > 0 }),
  W({ id: 'f_rankS', level: 'hard', gold: 160, check: c => won(c) && c.s.rank === 'S' }),
  W({ id: 'f_disadv', rival: 'counter', gold: 80, check: won }),
  W({ id: 'f_purist', gold: 90, check: c => won(c) && c.s.stats.bend === 0 && c.s.stats.exUse === 0 && c.s.stats.weapon === 0 }),
  W({ id: 'f_comeback', gold: 70, check: c => won(c) && c.s.bonuses.some(b => b.id === 'comeback') }),
  W({ id: 'f_lowhp', gold: 70, check: c => won(c) && (c.res.hp?.[0] ?? 1) < .2 }),
  W({ id: 'f_counter5', gold: 70, check: c => c.s.stats.counter >= 5 }),
  W({ id: 'f_guard3', gold: 70, check: c => c.s.stats.crush >= 3 }),
  W({ id: 'f_mirror', rival: 'self', level: 'hard', gold: 70, check: won }),
  W({ id: 'f_throws3', gold: 50, check: c => won(c) && c.s.stats.throws >= 3 }),
  // ── Modos (se cumplen jugando)
  { id: 'm_arcade', kind: 'mode', go: 'arcade', gold: 80, on: 'arcade', check: e => e.cleared },
  { id: 'm_arcade_hard', kind: 'mode', go: 'arcade', gold: 150, on: 'arcade', check: e => e.cleared && ['hard', 'expert'].includes(e.level) },
  { id: 'm_arcade_nocont', kind: 'mode', go: 'arcade', gold: 150, on: 'arcade', check: e => e.cleared && !e.continues },
  { id: 'm_score', kind: 'mode', go: 'arcade', gold: 100, on: 'arcade', check: e => e.score >= 10000 },
  { id: 'm_surv3', kind: 'mode', go: 'arcade', gold: 60, on: 'survival', check: e => e.wins >= 3 },
  { id: 'm_surv6', kind: 'mode', go: 'arcade', gold: 120, on: 'survival', check: e => e.wins >= 6 },
  { id: 'm_surv10', kind: 'mode', go: 'arcade', gold: 250, on: 'survival', check: e => e.wins >= 10 },
  { id: 'm_story', kind: 'mode', go: 'story', gold: 80, on: 'story', check: () => true },
  { id: 'm_story_all', kind: 'mode', go: 'story', gold: 300, on: 'story', check: e => e.all },
  // ── 2 jugadores
  { id: 'p_play', kind: 'pvp', go: 'versus', gold: 40, on: 'pvp', check: e => e.res.winner >= 0 },
  { id: 'p_s', kind: 'pvp', go: 'versus', gold: 100, on: 'pvp', check: e => e.rep.sides.some(s => s.rank === 'S') },
  { id: 'p_mirror', kind: 'pvp', go: 'versus', gold: 50, on: 'pvp', check: e => e.cfg.a === e.cfg.b && e.res.winner >= 0 },
  { id: 'p_close', kind: 'pvp', go: 'versus', gold: 60, on: 'pvp', check: e => e.res.winner >= 0 && Math.min(...e.res.wins) > 0 && Math.min(...e.res.wins) === Math.max(...e.res.wins) - 1 },
  { id: 'p_tf', kind: 'pvp', go: 'versus', gold: 80, on: 'pvp', check: e => e.rep.sides.every(s => s.stats.tf > 0) },
  { id: 'p_flawless', kind: 'pvp', go: 'versus', gold: 150, on: 'pvp', check: e => e.res.winner >= 0 && e.rep.sides[e.res.winner].stats.taken === 0 },
  { id: 'p_5', kind: 'pvp', go: 'versus', gold: 100, on: 'pvp', check: e => (e.count || 0) >= 5 },
];
export const kindOf = c => c.kind || 'train';
// Rival de un desafío de combate: 'counter' = el que tiene ventaja elemental sobre el héroe; 'self' = espejo; si no, el siguiente.
const BEATS = { fire: 'water', wind: 'fire', water: 'wind' };
export function rivalFor(def, hero, roster) {
  const me = roster.find(r => r.id === hero), next = roster[(roster.indexOf(me) + 1) % roster.length];
  if (def.rival === 'self') return hero;
  if (def.rival === 'counter') { const el = BEATS[me?.element]; return roster.find(r => r.element === el && r.id !== hero)?.id || next.id; }
  return next.id;
}
export const byId = id => CHALLENGES.find(c => c.id === id);

export class ChallengeTracker {
  constructor(def) { if (!def || def.locked || !def.test) throw new Error('Prueba no disponible'); this.def = def; this.count = 0; this.done = false; this.seen = new Set(); }
  // Devuelve true solo en el evento que completa la prueba (una vez). Con def.key cuenta valores DISTINTOS (p. ej. tres técnicas diferentes).
  feed(e) {
    if (this.done || !this.def.test(e)) return false;
    if (this.def.key) { const k = this.def.key(e); if (this.seen.has(k)) return false; this.seen.add(k); }
    this.count = Math.min(this.def.goal, this.count + 1);
    if (this.count >= this.def.goal) { this.done = true; return true; }
    return false;
  }
}
