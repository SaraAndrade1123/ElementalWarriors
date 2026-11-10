// HISTORIA (v1.12): 11 capítulos en 4 actos por guerrero, cada uno con su RETO para superarlo (no basta con ganar).
//   Acto I · Despertar      — 1 Primer paso (ganar) · 2 La prueba del maestro (ganar en poco tiempo) · 3 Contra las cuerdas (empiezas herido)
//   Acto II · El viaje      — 4 Cadena de golpes (combo) · 5 Guardia alta (acabar con vida) · 6 Un solo asalto (muerte súbita)
//   Acto III · El reflejo   — 7 El eco (contra ti mismo) · 8 Agarre (derriba con un agarre) · 9 Resonancia (usa tu técnica EX)
//   Acto IV · Los reinos    — 10 Último aliento (empiezas a media vida y la CPU aprieta) · 11 La Sombra del Sello (jefe final, al mejor de 5)
// Cada rival aparece tres veces con diálogos distintos (antes y después). Lógica pura: misma interfaz que Ladder para el flujo.
import { scoreFight } from './score.js';

export const ACTS = [1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4];
// rival: índice en el orden del héroe (0, 1, 2) · 'echo' = su reflejo · 'shadow' = la Sombra del Sello (su reflejo al máximo)
export const CHAPTERS = [
  { rival: 0, stage: 'home', lv: -1, goal: { t: 'win' } },
  { rival: 1, stage: 'home', lv: 0, goal: { t: 'time', s: 80 } },
  { rival: 2, stage: 'rival', lv: 0, startHp: .6, goal: { t: 'win' } },
  { rival: 0, stage: 'rival', lv: 0, goal: { t: 'combo', n: 4 } },
  { rival: 1, stage: 'rival', lv: 0, goal: { t: 'hp', x: .35 } },
  { rival: 2, stage: 'rival', lv: 1, wins: 1, maxRounds: 2, roundTime: 60, goal: { t: 'win' } },
  { rival: 'echo', stage: 'final', lv: 1, goal: { t: 'win' } },
  { rival: 0, stage: 'rival', lv: 1, goal: { t: 'throws', n: 1 } },
  { rival: 1, stage: 'rival', lv: 1, goal: { t: 'ex', n: 1 } },
  { rival: 2, stage: 'rival', lv: 1, startHp: .5, goal: { t: 'win' } },
  { rival: 'shadow', stage: 'final', lv: 2, wins: 3, maxRounds: 7, goal: { t: 'win' } },
];
// ¿se cumplió el reto? r = resultado del combate (winner, time, hp, stats)
export function goalOk(g, r) {
  if (!r || r.winner !== 0) return false;
  switch (g?.t) {
    case 'time': return (r.time ?? Infinity) <= g.s;
    case 'hp': return (r.hp?.[0] ?? 0) >= g.x;
    case 'combo': return (r.stats?.combo?.[0] ?? 0) >= g.n;
    case 'ex': return (r.stats?.ex?.[0] ?? 0) >= g.n;
    case 'throws': return (r.stats?.throws?.[0] ?? 0) >= g.n;
    default: return true;
  }
}
// texto del reto (clave + parámetros) para la interfaz
export const goalText = (g, t) => t('story.goal.' + (g?.t || 'win'), { s: g?.s, x: Math.round((g?.x || 0) * 100), n: g?.n });

export class StoryRun {
  constructor(cfg, { hero, level = 'normal', from = 0 }) {
    this.cfg = cfg; this.kind = 'story'; this.hero = hero; this.base = cfg.levels.includes(level) ? level : 'normal';
    const order = cfg.order[hero]; if (!order?.length || order.includes(hero)) throw new Error(`Orden de rivales inválido para ${hero}`);
    this.order = order; this.chapters = CHAPTERS.map((c, i) => ({ ...c, i, act: ACTS[i], id: typeof c.rival === 'number' ? order[c.rival % order.length] : hero }));
    this.rivals = this.chapters.map(c => c.id);
    this.i = Math.max(0, Math.min(from, this.total - 1)); this.score = 0; this.wins = 0; this.continues = 0; this.time = 0; this.maxCombo = 0; this.done = false; this.cleared = false; this.lost = false;
  }
  get total() { return this.chapters.length; }
  get isFinal() { return this.i === this.total - 1; }
  get chapter() { return this.chapters[this.i]; }
  levelAt(i) { const L = this.cfg.levels, b = Math.max(0, L.indexOf(this.base)); return L[Math.max(0, Math.min(L.length - 1, b + (this.chapters[i].lv || 0)))]; }
  stageAt(i) { const c = this.chapters[i], el = this.cfg.elementOf; return c.stage === 'final' ? this.cfg.finalStage : c.stage === 'home' ? this.cfg.stageByElement[el[this.hero]] : this.cfg.stageByElement[el[c.id]]; }
  // cuántas veces se ha enfrentado ya a este rival antes del capítulo i (para variar los diálogos)
  meetN(i) { const id = this.chapters[i].id; return this.chapters.slice(0, i + 1).filter(c => c.id === id && typeof c.rival === 'number').length; }
  fight() {
    const i = this.i, c = this.chapters[i], o = this.cfg.story || {};
    return { a: this.hero, b: c.id, mode: 'cpu', rec: 'story', level: this.levelAt(i), stage: this.stageAt(i), wins: c.wins ?? o.wins ?? 2, maxRounds: c.maxRounds ?? o.maxRounds ?? 5,
      roundTime: c.roundTime, startHp: c.startHp, final: this.isFinal, index: i, total: this.total, goal: c.goal, chapter: i + 1 };
  }
  // 'next' · 'clear' · 'goal' (ganó pero sin cumplir el reto: se repite) · 'lost' (se puede reintentar) · 'draw'
  report(r) {
    if (this.done) return { status: 'clear' };
    this.time += r.time || 0; this.maxCombo = Math.max(this.maxCombo, r.stats?.combo?.[0] ?? 0);
    if (r.winner < 0) return { status: 'draw' };
    if (r.winner !== 0) { this.lost = true; return { status: 'lost', left: Infinity }; }
    if (!goalOk(this.chapter.goal, r)) { this.lost = true; return { status: 'goal', goal: this.chapter.goal }; }
    this.score += scoreFight(r, this.levelAt(this.i), this.cfg); this.wins++;
    if (this.isFinal) { this.done = this.cleared = true; return { status: 'clear' }; }
    this.i++; return { status: 'next' };
  }
  get continuesLeft() { return Infinity; }
  useContinue() { this.lost = false; return this.fight(); }
  giveUp() { this.done = true; }
  summary() { return { kind: 'story', hero: this.hero, level: this.base, score: this.score, wins: this.wins, total: this.total, cleared: this.cleared, time: Math.round(this.time), continues: this.continues, maxCombo: this.maxCombo }; }

  // --- escenas (claves de texto; la interfaz las traduce) ---
  scenesBefore() {
    const i = this.i, c = this.chapters[i], h = this.hero, out = [];
    if (i === 0) out.push({ who: 'narrator', key: 'story.prologue.1' }, { who: 'narrator', key: 'story.prologue.2' }, { who: h, key: `story.${h}.intro` });
    if (i === 0 || this.chapters[i - 1].act !== c.act) out.push({ who: 'narrator', key: `story.act.${c.act}`, p: { name: h } });
    if (i === 0 || this.stageAt(i - 1) !== this.stageAt(i)) out.push({ who: 'narrator', key: `story.arrive.${this.stageAt(i)}` });
    if (c.rival === 'echo') out.push({ who: 'narrator', key: 'story.echo.arrive', p: { name: h } }, { who: h, key: `story.echo.${h}.pre` });
    else if (c.rival === 'shadow') out.push({ who: 'narrator', key: 'story.shadow.arrive', p: { name: h } }, { who: h, key: 'story.shadow.pre', p: { name: h } });
    else { const n = this.meetN(i); out.push({ who: c.id, key: `story.rival.${c.id}.pre${n > 1 ? n : ''}` }); if (n === 1) out.push({ who: h, key: `story.${h}.vs.${c.id}` }); }
    out.push({ who: 'narrator', key: 'story.goal.say', p: { goal: c.goal } }); // el reto del capítulo, dicho por el narrador
    return out;
  }
  scenesAfter(i = this.i - 1) {
    const c = this.chapters[i], h = this.hero, out = [];
    if (c.rival === 'echo') out.push({ who: h, key: `story.echo.${h}.post` });
    else if (c.rival === 'shadow') out.push({ who: 'narrator', key: 'story.shadow.post', p: { name: h } });
    else { const n = this.meetN(i); out.push({ who: c.id, key: `story.rival.${c.id}.post${n > 1 ? n : ''}` }); }
    if (i === this.total - 1) out.push({ who: 'narrator', key: `story.${h}.ending` }, { who: 'narrator', key: 'story.fin' });
    return out;
  }
}
