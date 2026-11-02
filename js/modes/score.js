// Puntuación de un combate ganado (pura). Solo cuenta si gana el jugador 1; todo sale del resultado real del combate.
export function scoreFight(result, level, cfg) {
  if (!result || result.winner !== 0) return 0;
  const s = cfg.score, flawless = (result.stats?.dmg?.[1] ?? 1) === 0, combo = Math.min(99, result.stats?.combo?.[0] ?? 0);
  const timeBonus = Math.max(0, s.time - Math.round(result.time || 0) * s.timeStep);
  const raw = s.win + Math.round((result.hp?.[0] ?? 0) * s.hp) + timeBonus + (flawless ? s.flawless : 0) + combo * s.combo;
  return Math.round(raw * (s.mult[level] ?? 1));
}
