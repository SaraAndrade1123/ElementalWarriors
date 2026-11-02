# F6 — Escenarios: cómo encaja con F3 y las animaciones

F6 **solo añade archivos nuevos** y no edita `fighter.js`, `match.js`, `input.js`, `arena.js` ni `scene-manager.js`.
Se conecta con un adaptador (`js/stages/stage-hook.js`) que envuelve `scene.startMatch` y `scene.endMatch`.

## Qué necesita de tu código (contrato)
`SceneManager` debe seguir exponiendo: `startMatch(a, b, input)`, `endMatch()`, `arena` (con `dispose()`), `scene`, `key`, `tint`, `q.particles`.
Si F3 cambia la firma de `startMatch`, el adaptador pasa todos los argumentos y un 4.º opcional `opts`.
Elegir escenario por código: `scene.startMatch(a, b, input, { stage: 'mareas' })` (si no se indica, usa el elegido en el menú).

## Cómo reaccionan los escenarios a los golpes (para F3/F4)
Cuando haya un impacto importante, llama una vez:
```js
stages.react({ power: 0.6 });                 // 0..1, destello suave del entorno
stages.react({ power: 1, color: '#ff7a35' });  // opcional: tiñe los símbolos de la Arena del Equilibrio
```
Con «Reducir movimiento» activo, `react` no hace nada (accesibilidad). Prueba en consola con `?dev=1`: `ewStages.react({ power: 1 })`.

## Añadir un escenario nuevo (sin tocar código)
1. Copia un bloque de `data/stages.json` y cambia `id`, colores, `props` y `fx`.
2. Añade `stage.<id>.name`, `stage.<id>.desc` en `data/localization/es.json` y `en.json`.
3. `npm run check` y `npm test` validan datos, textos y colores. Un escenario mal definido se omite con un aviso en consola; no rompe el juego.
Props disponibles: trees, ruins, coins, mountains, sunglow, fortress, torches, cracks, temple, waterfall, pool, pillars, colossus, crystals, bridges, flags, clouds, sigils, ringhalo.
Efectos (`fx.kind`): leaves, ash, bubbles, dust, streaks, motes.

## Desbloqueo
`new StageManager(stages, { isUnlocked: s => ... })`. Hoy todos están libres (modo de pruebas); más adelante puedes conectarlo a la tienda o a logros.

## Si el modelo definitivo o las animaciones cambian el combate
Nada de F6 depende de ellos. El decorado queda detrás del plano de combate (z < −2) y el suelo mide `WORLD.half + 1.6`
(`installStages(scene, stages, { half })` si cambias `WORLD.half`).
