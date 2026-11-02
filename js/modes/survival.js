// Supervivencia: combates consecutivos de una sola ronda; la vida se recupera solo en parte entre combates y la dificultad sube.
import { scoreFight } from './score.js';

export class Survival {
  constructor(cfg, { hero, level = 'normal' }) {
    this.cfg = cfg; this.o = cfg.survival; this.hero = hero; this.base = cfg.levels.includes(level) ? level : 'normal';
    this.others = cfg.order[hero]; if (!this.others?.length || this.others.includes(hero)) throw new Error(`Rivales inválidos para ${hero}`);
    this.wins = 0; this.score = 0; this.time = 0; this.hp = 1; this.done = false; this.maxCombo = 0;
  }
  get level() { return this.cfg.levels[Math.min(this.cfg.levels.length - 1, this.cfg.levels.indexOf(this.base) + Math.floor(this.wins / this.o.escalateEvery))]; }
  get rival() { return this.others[this.wins % this.others.length]; }
  fight() {
    return { a: this.hero, b: this.rival, mode: 'cpu', rec: 'survival', level: this.level, stage: this.cfg.stageByElement[this.cfg.elementOf[this.rival]], wins: this.o.wins, maxRounds: this.o.maxRounds, startHp: this.hp, index: this.wins };
  }
  report(r) {
    this.time += r.time || 0; this.maxCombo = Math.max(this.maxCombo, r.stats?.combo?.[0] ?? 0);
    if (r.winner === 0) { this.score += scoreFight(r, this.level, this.cfg); this.hp = Math.min(1, (r.hp?.[0] ?? 0) + this.o.heal); this.wins++; return { status: 'next' }; }
    if (r.winner < 0) return { status: 'draw' };
    this.done = true; return { status: 'over' };
  }
  summary() { return { kind: 'survival', hero: this.hero, level: this.base, score: this.score, wins: this.wins, time: Math.round(this.time), maxCombo: this.maxCombo }; }
}
