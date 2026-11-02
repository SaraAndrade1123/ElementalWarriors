// Arcade e Historia: una escalera de rivales (los otros tres guerreros, sin duelos espejo) con dificultad creciente.
// Lógica pura: no toca el DOM ni Three.js. La interfaz pide `fight()` y devuelve el resultado con `report()`.
import { scoreFight } from './score.js';

const idx = (cfg, level) => Math.max(0, cfg.levels.indexOf(level));
export class Ladder {
  // kind: 'arcade' | 'story'
  constructor(cfg, { kind = 'arcade', hero, level = 'normal', from = 0 }) {
    this.cfg = cfg; this.kind = kind; this.hero = hero; this.base = cfg.levels.includes(level) ? level : 'normal'; this.opts = cfg[kind];
    this.rivals = cfg.order[hero]; if (!this.rivals?.length || this.rivals.includes(hero)) throw new Error(`Orden de rivales inválido para ${hero}`);
    this.i = Math.max(0, Math.min(from, this.rivals.length - 1)); this.score = 0; this.wins = 0; this.continues = 0; this.time = 0; this.maxCombo = 0; this.done = false; this.cleared = false; this.lost = false;
  }
  get total() { return this.rivals.length; }
  get isFinal() { return this.i === this.total - 1; }
  // Dificultad: la base en los primeros combates y un nivel más en el último (tope: experto).
  levelAt(i) { return this.cfg.levels[Math.min(this.cfg.levels.length - 1, idx(this.cfg, this.base) + (i === this.total - 1 && this.total > 1 ? 1 : 0))]; }
  stageAt(i) { return i === this.total - 1 ? this.cfg.finalStage : this.cfg.stageByElement[this.cfg.elementOf[this.rivals[i]]]; }
  fight() {
    const i = this.i; return { a: this.hero, b: this.rivals[i], mode: 'cpu', rec: this.kind, level: this.levelAt(i), stage: this.stageAt(i), wins: this.opts.wins, maxRounds: this.opts.maxRounds, final: i === this.total - 1, index: i, total: this.total };
  }
  // Resultado de un combate → estado: 'next' (siguiente rival), 'clear' (escalera completada), 'lost' (puede continuar), 'over' (sin continuaciones), 'draw' (se repite).
  report(r) {
    if (this.done) return { status: this.cleared ? 'clear' : 'over' };
    this.time += r.time || 0; this.maxCombo = Math.max(this.maxCombo, r.stats?.combo?.[0] ?? 0);
    if (r.winner === 0) {
      this.score += scoreFight(r, this.levelAt(this.i), this.cfg); this.wins++;
      if (this.isFinal) { this.done = this.cleared = true; return { status: 'clear' }; }
      this.i++; return { status: 'next' };
    }
    if (r.winner < 0) return { status: 'draw' };
    this.lost = true; if (this.continuesLeft > 0) return { status: 'lost', left: this.continuesLeft };
    this.done = true; return { status: 'over' };
  }
  get continuesLeft() { return this.kind === 'story' ? Infinity : Math.max(0, this.cfg.arcade.continues - this.continues); }
  // El jugador elige seguir tras perder: repite el mismo combate (arcade: gasta una continuación y resta puntos).
  useContinue() {
    if (this.kind !== 'story') { if (this.continuesLeft <= 0) return null; this.continues++; this.score = Math.max(0, this.score - this.cfg.arcade.continuePenalty); }
    this.lost = false; return this.fight();
  }
  // Cuando se abandona tras perder en arcade, la escalera termina.
  giveUp() { this.done = true; }
  summary() { return { kind: this.kind, hero: this.hero, level: this.base, score: this.score, wins: this.wins, total: this.total, cleared: this.cleared, time: Math.round(this.time), continues: this.continues, maxCombo: this.maxCombo }; }

  // --- Historia: escenas de diálogo (claves de texto; la interfaz las traduce) ---
  scenesBefore() {
    const r = this.rivals[this.i], out = [];
    if (this.i === 0) out.push({ who: 'narrator', key: 'story.prologue.1' }, { who: 'narrator', key: 'story.prologue.2' }, { who: this.hero, key: `story.${this.hero}.intro` });
    out.push({ who: 'narrator', key: `story.arrive.${this.stageAt(this.i)}` }, { who: r, key: `story.rival.${r}.pre` }, { who: this.hero, key: `story.${this.hero}.vs.${r}` }); return out; // llegada al mundo del rival y diálogo por pareja // el héroe responde (diálogo por pareja)
  }
  scenesAfter(i = this.i - 1) { const r = this.rivals[i], out = [{ who: r, key: `story.rival.${r}.post` }]; if (i === this.total - 1) out.push({ who: 'narrator', key: `story.${this.hero}.ending` }, { who: 'narrator', key: 'story.fin' }); return out; }
}
