# Cómo conectar F3 con Rose Gold, estadísticas y logros

Cuando tu combate termine, llama **una sola vez por combate** a `progression.recordMatch(...)`.
En el juego, `meta` se crea en `main.js`; pásalo (o solo `meta.progression`) al módulo que cierra el combate.

```js
const res = meta.progression.recordMatch({
  matchId: crypto.randomUUID(),   // OBLIGATORIO y único por combate: evita pagar dos veces si llega el evento repetido
  mode: 'arcade',                 // arcade | story | survival | versus_ai | versus_local | training
  outcome: 'win',                 // 'win' | 'loss' | 'draw' desde el punto de vista del JUGADOR 1
  characterId: 'ignis',           // guerrero del jugador 1
  roundsWon: 2,                   // rondas ganadas por el jugador 1
  difficulty: 'normal',           // beginner | normal | hard | expert (IA); ignorado en versus_local
  maxCombo: 7,                    // mejor combo del combate (golpes)
  maxDamage: 340,                 // mayor daño de un combo
  durationSec: 95,
  transformations: 1              // transformaciones activadas
});
// res = { ok, gold, unlocked: ['first_win', ...], bonus }  | { ok:false, error:'duplicate'|'invalid' }
if (res.ok && !res.ignored) toast(t('match.reward', { gold: res.gold + res.bonus }));
```

## Reglas ya resueltas por el sistema
- **`training` no cuenta** ni paga (devuelve `ignored: true`).
- Un mismo `matchId` **nunca paga dos veces** (`error: 'duplicate'`).
- Los logros se pagan **una sola vez** y dentro de la misma operación atómica que guarda el combate.
- Los números se limitan (combo ≤ 999, daño ≤ 99 999, duración ≤ 1 h) para evitar datos corruptos.
- Los logros se muestran solos en un aviso (`progression.onUnlock`) cuando se instalan los paneles.

## Otros puntos de enganche
- Modo Arcade completado (F7): `meta.progression.recordEvent('arcade_clear')`.
- Rose Gold fuera de combates (misiones futuras): `meta.wallet.add(n)` (solo enteros > 0).

## Paletas y animaciones
Las paletas se aplican con `scene.setPalette(idPersonaje, meta.shop.paletteOf(idPersonaje))`.
Funciona sobre los materiales con textura (`material.map`) cuyo nombre **no** contiene `head`, `face` o `eye`.
Si tu sistema de animaciones clona los modelos o los vuelve a cargar, llama a `setPalette` después de crearlos.
