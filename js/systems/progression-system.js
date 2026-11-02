// Estadísticas, recompensas y logros. F3 debe llamar recordMatch() UNA vez por combate terminado (ver docs/INTEGRACION-F3.md).
const MODES = ['arcade', 'story', 'survival', 'versus_ai', 'versus_local', 'training'];
const OUTCOMES = ['win', 'loss', 'draw'];
const clamp = (v, max) => (Number.isFinite(v) ? Math.min(max, Math.max(0, Math.floor(v))) : 0);

export class Progression {
  constructor(save, { economy, achievements }) {
    this.save = save; this.eco = economy; this.achs = achievements; this.onUnlock = null;
  }
  derive(d) {
    return { ...d.stats, charsWon: Object.values(d.stats.winsBy).filter(v => v > 0).length, palettesOwned: d.owned.filter(id => !id.startsWith('wp_')).length };
  }
  progressOf(a, d = this.save.data) { return { value: this.derive(d)[a.stat] ?? 0, target: a.gte }; }
  _unlock(d) { // marca y paga cada logro UNA sola vez, dentro de la misma operación atómica
    const out = [], v = this.derive(d);
    for (const a of this.achs) {
      if (d.done.includes(a.id) || (v[a.stat] ?? 0) < a.gte) continue;
      d.done.push(a.id); d.gold.balance += a.reward; d.gold.earned += a.reward; out.push(a);
    }
    return out;
  }
  rewardFor(r) {
    const e = this.eco, base = e.completion + (r.outcome === 'win' ? e.win : 0) + r.roundsWon * e.roundWon;
    return Math.floor(base * (e.mode[r.mode] ?? 1) * (e.difficulty[r.difficulty] ?? 1));
  }
  recordMatch(raw) {
    if (!raw || typeof raw.matchId !== 'string' || !raw.matchId || raw.matchId.length > 64 || !MODES.includes(raw.mode) ||
        !OUTCOMES.includes(raw.outcome) || !/^[\w-]{1,40}$/.test(raw.characterId ?? '')) return { ok: false, error: 'invalid' };
    if (raw.mode === 'training') return { ok: true, ignored: true, gold: 0, unlocked: [] }; // el entrenamiento no cuenta
    const r = { ...raw, roundsWon: clamp(raw.roundsWon, 9) }, gold = this.rewardFor(r);
    let unlocked = [];
    const res = this.save.commit(d => {
      if (d.rewards.includes(r.matchId)) return { ok: false, error: 'duplicate' }; // un evento de fin = una sola recompensa
      d.rewards.push(r.matchId);
      const s = d.stats; s.matches++; s.roundsWon += r.roundsWon;
      if (r.outcome === 'win') { s.wins++; s.winsBy[r.characterId] = (s.winsBy[r.characterId] || 0) + 1; }
      else if (r.outcome === 'loss') s.losses++; else s.draws++;
      s.maxCombo = Math.max(s.maxCombo, clamp(raw.maxCombo, 999)); s.maxDamage = Math.max(s.maxDamage, clamp(raw.maxDamage, 99999));
      s.playSec += clamp(raw.durationSec, 3600); s.transformations += clamp(raw.transformations, 20);
      d.gold.balance += gold; d.gold.earned += gold;
      unlocked = this._unlock(d);
      return { ok: true };
    });
    if (!res.ok) return res;
    if (unlocked.length) this.onUnlock?.(unlocked);
    return { ok: true, gold, unlocked: unlocked.map(a => a.id), bonus: unlocked.reduce((n, a) => n + a.reward, 0) };
  }
  recordEvent(name) { // eventos sueltos (p. ej. 'arcade_clear' cuando exista F7)
    const key = { arcade_clear: 'arcadeClears', story_clear: 'storyClears' }[name]; if (!key) return { ok: false, error: 'invalid' };
    let unlocked = []; this.save.commit(d => { d.stats[key]++; unlocked = this._unlock(d); return { ok: true }; });
    if (unlocked.length) this.onUnlock?.(unlocked); return { ok: true, unlocked: unlocked.map(a => a.id) };
  }
  // Prueba de combate superada: paga Rose Gold UNA sola vez por prueba (operación atómica).
  recordChallenge(id) {
    if (typeof id !== 'string' || !/^[\w-]{1,40}$/.test(id)) return { ok: false, error: 'invalid' };
    const gold = Math.max(0, Math.floor(this.eco.challenge ?? 0));
    const res = this.save.commit(d => { if (d.challenges.includes(id)) return { ok: false, error: 'duplicate' }; d.challenges.push(id); d.gold.balance += gold; d.gold.earned += gold; return { ok: true }; });
    return res.ok ? { ok: true, gold } : res;
  }
  // Capítulos de historia superados por guerrero (solo sube).
  setStory(hero, chapters) {
    if (typeof hero !== 'string' || !/^[\w-]{1,40}$/.test(hero)) return { ok: false, error: 'invalid' };
    return this.save.commit(d => { d.story[hero] = Math.max(d.story[hero] || 0, Math.min(99, Math.max(0, Math.floor(chapters) || 0))); return { ok: true }; });
  }
  // Récord de una partida completa de arcade o supervivencia. Devuelve { ok, record } (record = superó el anterior).
  recordRun(s) {
    if (!s || !['arcade', 'survival'].includes(s.kind) || !/^[\w-]{1,40}$/.test(s.hero ?? '')) return { ok: false, error: 'invalid' };
    let record = false;
    const res = this.save.commit(d => {
      const R = d.records[s.kind], score = Math.max(0, Math.floor(s.score) || 0);
      if (s.kind === 'arcade') { if (!s.cleared || score <= R.score) return { ok: false, error: 'norecord' }; R.score = score; R.char = s.hero; }
      else { const wins = Math.max(0, Math.floor(s.wins) || 0); if (wins < R.wins || (wins === R.wins && score <= R.score)) return { ok: false, error: 'norecord' }; Object.assign(R, { wins, score, sec: Math.floor(s.time) || 0, char: s.hero }); }
      record = true; return { ok: true };
    });
    return { ok: res.ok || res.error === 'norecord', record };
  }
  evaluate() {
    let unlocked = []; this.save.commit(d => { unlocked = this._unlock(d); return { ok: true }; });
    if (unlocked.length) this.onUnlock?.(unlocked); return unlocked;
  }
}
