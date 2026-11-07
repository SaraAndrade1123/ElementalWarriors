// Estadísticas, recompensas y logros. F3 debe llamar recordMatch() UNA vez por combate terminado (ver docs/INTEGRACION-F3.md).
const MODES = ['arcade', 'story', 'survival', 'versus_ai', 'versus_local', 'training'];
const OUTCOMES = ['win', 'loss', 'draw'];
const clamp = (v, max) => (Number.isFinite(v) ? Math.min(max, Math.max(0, Math.floor(v))) : 0);

export class Progression {
  constructor(save, { economy, achievements }) {
    this.save = save; this.eco = economy; this.achs = achievements; this.onUnlock = null;
  }
  derive(d) { // a prueba de guardados incompletos o antiguos (cada parte con su valor por defecto)
    const s = d.stats || {}, by = s.winsBy || {}, owned = d.owned || [], rec = d.records || {}, gold = d.gold || {};
    const v = { ...s, charsWon: Object.values(by).filter(n => n > 0).length, palettesOwned: owned.filter(id => id.startsWith('pal_')).length,
      weaponsOwned: owned.filter(id => id.startsWith('wp_')).length, challengesDone: (d.challenges || []).length, storyHeroes: Object.values(d.story || {}).filter(n => n >= 3).length,
      survivalBest: rec.survival?.wins || 0, arcadeScore: rec.arcade?.score || 0, goldEarned: gold.earned || 0, playMin: Math.floor((s.playSec || 0) / 60),
      extremeChars: Object.values(s.extremeBy || {}).filter(n => n > 0).length, achCount: (d.done || []).length };
    for (const [id, n] of Object.entries(by)) v['wins_' + id] = n; // victorias de cada guerrero (logros de maestría)
    return v;
  }
  progressOf(a, d = this.save.data) { return { value: this.derive(d)[a.stat] ?? 0, target: a.gte }; }
  _unlock(d) { // marca y paga cada logro UNA sola vez, dentro de la misma operación atómica
    const out = [];
    for (let pass = 0; pass < 4; pass++) { // un logro puede desbloquear otros (Rose Gold ganado, número de logros…)
      const v = this.derive(d); let any = false;
      for (const a of this.achs) {
        if (d.done.includes(a.id) || (v[a.stat] ?? 0) < a.gte) continue;
        d.done.push(a.id); d.gold.balance += a.reward; d.gold.earned += a.reward; out.push(a); any = true;
      }
      if (!any) break;
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
    const r = { ...raw, roundsWon: clamp(raw.roundsWon, 9) }, base = this.rewardFor(r), extra = clamp(raw.bonusGold, 500);
    // 2 jugadores en el mismo equipo: lo que gana el J2 (base + bonificaciones) va a la misma cuenta
    const p2 = raw.p2 && OUTCOMES.includes(raw.p2.outcome) ? this.rewardFor({ ...r, outcome: raw.p2.outcome, roundsWon: clamp(raw.p2.roundsWon, 9) }) + clamp(raw.p2.bonusGold, 500) : 0;
    const gold = base + extra + p2;
    let unlocked = [];
    const res = this.save.commit(d => {
      if (d.rewards.includes(r.matchId)) return { ok: false, error: 'duplicate' }; // un evento de fin = una sola recompensa
      d.rewards.push(r.matchId);
      const s = d.stats; s.matches++; s.roundsWon += r.roundsWon;
      if (r.outcome === 'win') { s.wins++; s.winsBy[r.characterId] = (s.winsBy[r.characterId] || 0) + 1; }
      else if (r.outcome === 'loss') s.losses++; else s.draws++;
      s.maxCombo = Math.max(s.maxCombo, clamp(raw.maxCombo, 999)); s.maxDamage = Math.max(s.maxDamage, clamp(raw.maxDamage, 99999));
      s.playSec += clamp(raw.durationSec, 3600); s.transformations += clamp(raw.transformations, 20);
      const f = raw.feats && typeof raw.feats === 'object' ? raw.feats : {}, won = r.outcome === 'win', b = x => (x ? 1 : 0); // hazañas (validadas y con tope)
      for (const k of ['rankS', 'perfects', 'flawless', 'exKOs', 'counters', 'throws', 'parries', 'dmgTotal', 'comebacks', 'fastWins', 'mirrorWins', 'localMatches', 'extremeWins']) s[k] = s[k] || 0; s.extremeBy ??= {};
      s.rankS += b(f.rank === 'S'); s.perfects += clamp(f.perfects, 3); s.flawless += b(won && f.flawless); s.exKOs += clamp(f.exKOs, 3);
      s.counters += clamp(f.counters, 50); s.throws += clamp(f.throws, 50); s.parries += clamp(f.parries, 50); s.dmgTotal += clamp(f.dmg, 2000);
      s.comebacks += b(won && f.comeback); s.fastWins += b(won && f.fast); s.mirrorWins += b(won && f.mirror); s.localMatches += b(r.mode === 'versus_local');
      if (won && r.difficulty === 'expert' && r.mode !== 'versus_local') { s.extremeWins++; s.extremeBy[r.characterId] = (s.extremeBy[r.characterId] || 0) + 1; }
      d.gold.balance += gold; d.gold.earned += gold;
      unlocked = this._unlock(d);
      return { ok: true };
    });
    if (!res.ok) return res;
    if (unlocked.length) this.onUnlock?.(unlocked);
    return { ok: true, gold, base, extra, p2, unlocked: unlocked.map(a => a.id), bonus: unlocked.reduce((n, a) => n + a.reward, 0) };
  }
  recordEvent(name) { // eventos sueltos (p. ej. 'arcade_clear' cuando exista F7)
    const key = { arcade_clear: 'arcadeClears', story_clear: 'storyClears' }[name]; if (!key) return { ok: false, error: 'invalid' };
    let unlocked = []; this.save.commit(d => { d.stats[key]++; unlocked = this._unlock(d); return { ok: true }; });
    if (unlocked.length) this.onUnlock?.(unlocked); return { ok: true, unlocked: unlocked.map(a => a.id) };
  }
  // Prueba de combate superada: paga Rose Gold UNA sola vez por prueba (operación atómica).
  recordChallenge(id, reward) {
    if (typeof id !== 'string' || !/^[\w-]{1,40}$/.test(id)) return { ok: false, error: 'invalid' };
    const gold = Math.max(0, Math.min(400, Math.floor(Number.isFinite(reward) ? reward : this.eco.challenge ?? 0))); // cada desafío puede pagar lo suyo (tope 400)
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
