# Sistema de combate (F4 · v0.6.0)

Todo el combate es lógica pura en `js/game/fighter.js` (se prueba con Node) y los datos viven en `data/moves.json`.
La simulación va a paso fijo de 60 Hz (`match.js`): el daño y las ventanas no dependen de los FPS.

## Controles (teclado / táctil)
| Acción | Teclado | Táctil |
|---|---|---|
| Mover / saltar / agacharse | A D · W · S (o flechas) | cruceta izquierda |
| Correr / retroceso rápido | doble toque → / ← | doble toque ▶ / ◀ |
| Ligero · Medio · Pesado | J · K · L | L · M · H |
| Agachado / aéreo | mantener ↓ / en el aire + J K L | igual |
| Técnica especial | U, o ↓ ↘ → + J/K/L (tolerante: ↓ → también vale) | ✦ |
| Resonancia | I | ◈ |
| Lanzamiento | J + K de cerca (← al iniciar = lanzar hacia atrás) | L+M |
| Escapar de un lanzamiento | J + K durante 0,25 s tras ser agarrado | L+M |
| Guardia | mantener ← (o Shift); ↓ + ← protege abajo | 🛡 |

## Reglas
- **Golpes**: 12 por guerrero (L/M/H de pie, agachado y aéreo, lanzamiento, especial y técnica reforzada). Cada uno define salida, ventana activa, recuperación, daño, nivel (alto/medio/bajo), aturdimiento, empuje y cancelaciones.
- **Niveles**: los golpes bajos atraviesan la guardia de pie; los aéreos (altos) la agachada; en el aire no se bloquea.
- **Búfer**: cada pulsación se recuerda 6 fotogramas (determinista, vive en `Fighter`), así un golpe pulsado un poco antes sale en cuanto se puede.
- **Cancelaciones** (sólo si el golpe conectó, aunque sea bloqueado): L→L/M/H, M→H, cualquiera →especial según su lista `cancel`; máximo 5 golpes encadenados; un mismo golpe ligero 2 veces, el resto 1. El lanzador agachado (↓+L) se cancela en salto para seguir en el aire.
- **Escalado**: cada golpe del combo hace un 10 % menos (mínimo 30 %); a partir del 4.º golpe el aturdimiento se acorta. Tras 6 golpes aéreos sobre un rival lanzado, deja de ser vulnerable (sin combos infinitos).
- **Contraataque**: golpear a un rival mientras prepara su golpe = +10 % daño y +25 % aturdimiento (aviso «¡CONTRAATAQUE!»).
- **Derribo**: los lanzadores, pesados aéreos sobre un rival en el aire, lanzamientos y algunas técnicas derriban. Tumbado 0,5 s y levantándose 0,35 s es invulnerable; al levantarse tiene 0,35 s de protección contra agarres.
- **Recuperación aérea**: si te golpean en el aire sin lanzarte, al acabar el aturdimiento das una voltereta invulnerable hasta tocar suelo.
- **Lanzamientos**: alcance 1,55; no agarran a quien está en el aire, aturdido, derribado o levantándose; fallar deja 0,4 s de recuperación castigable; agarre simultáneo = escape automático.
- **Guardia rota**: bloquear llena una barra de presión (línea fina bajo la vida); al llenarse el defensor queda tambaleándose 0,7 s. Se vacía sola al dejar de bloquear.
- **Retroceso rápido**: 0,13 s invulnerable a golpes (no a agarres) y 0,08 s de recuperación al final.

## Resonancia Elemental (barra 0–100, se conserva entre rondas)
Se llena al golpear (más), al bloquear y al recibir (menos), al escapar de un agarre y al lanzar. Caminar o esperar no la llena.
| Uso (tecla I) | Cuándo | Coste |
|---|---|---|
| Técnica reforzada | en neutro, o cancelando un golpe que conectó | 25 |
| Cancelación resonante | durante cualquier golpe ya lanzado (aunque falle) | 50 |
| Repulsión | mientras bloqueas: aparta al rival y corta su presión | 50 |
La energía se descuenta una única vez en el paso en que se activa; sin barra suficiente no ocurre nada. La transformación (100) llega en F5.

## Identidad de cada guerrero
| | Ignis (fuego) | Aqua (agua) | Terra (tierra) | Zephyr (viento) |
|---|---|---|---|---|
| Arma | espada | lanza | guanteletes | hojas gemelas |
| Ritmo | presión directa, pesado con gran avance | alcance largo, golpes algo más lentos | lento, mucho daño, pesado con armadura | el más rápido, poco daño, doble salto |
| Especial (U) | Embestida Ígnea: estocada en carrera que derriba | Hidrolanza: proyectil de agua | Falla Primordial: onda por el suelo (saltable) que derriba | Tempestad Errante: cruza al rival y cambia de lado |
| Reforzada (I) | Ruptura Carmesí: 3 cortes + explosión, invulnerable al inicio | Marea Abisal: corriente lenta de 2 golpes que atrae al rival | Falla reforzada: con armadura, lanza al rival | Tempestad reforzada: torbellino de 4 golpes, invulnerable al inicio |

## Dificultad de la CPU (en Arcade, Historia, Supervivencia y Versus; en un combate suelto también en Pausa → «Dificultad CPU»)
Principiante, normal, difícil y experto cambian la calidad de las decisiones (reacción, acierto al bloquear alto/bajo, combos, antiaéreos, castigos, uso de la Resonancia y escape de agarres). Nunca hay daño extra ni lectura de botones.

## Entrenamiento
Resonancia que se recarga, el maniquí recupera la vida entre combos, daño de cada combo en pantalla y, en Pausa, «Maniquí» (quieto, se defiende, guardia agachada, salta, solo ataca o CPU), «Vida infinita» y «Reiniciar posiciones» (también con R). F1 muestra cajas de golpe/daño, proyectiles, fotogramas, Resonancia, guardia y el búfer.
