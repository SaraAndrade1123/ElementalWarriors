# Presentación v1.0 (estilo Guilty Gear / Mortal Kombat)

Todo es **presentación**: no cambia la simulación del combate (las 16 suites de pruebas lo comprueban).

## Aspecto gráfico
- **Contorno de tinta** en personajes y armas (`js/game/render/outline.js`): casco invertido con grosor fijo en píxeles, también en el clon espejo.
- **Postproceso propio** (`js/game/render/post.js`, sin librerías): escena HDR → resplandor en 2 niveles → gradación (saturación, contraste, tinte por escenario), viñeta, aberración cromática en impactos, fotograma de impacto invertido, destello, **congelado de técnica** (oscurece el fondo y dibuja líneas de velocidad hacia quien la lanza). Calidad baja = sin postproceso; media = resplandor; alta = resplandor + mayor resolución.
- **Gradación por escenario**: cálida en fuego, fría en agua, clara en viento, terrosa en tierra.

## Animación
- **Por pasos (anime 3D)**: golpes, gestos y reacciones se muestran a 18 poses/s; el desplazamiento por la pantalla sigue fluido (`Animator.stepFps`).
- **Exageración de pose** ×1,22 en golpes (tronco, zancada, inclinación) para poses más claras y potentes (`Director.exag`).
- **Reacciones** con latigazo: el cuerpo rebota al recibir el golpe, más en los golpes fuertes.

## Efectos de combate (`js/game/fight-fx.js`, `js/game/render/anime-fx.js`)
- **Chispas de impacto** en estrella con núcleo blanco y picos del color del elemento (hexagonales azules al bloquear).
- **Aura dibujada por sombreador** en cada proyectil elemental: fuego con lenguas de llama, agua en espiral, viento en cortes, tierra en polvo dorado; bandas de color duras (cel) y cola.
- **Técnica reforzada**: congelado + franja diagonal con el nombre del guerrero y de la técnica.
- **Carteles** grandes inclinados: CONTRAATAQUE, GUARDIA ROTA, ¡Contraataque! (daga)…
- **K.O.**: fotograma invertido, destello y cámara inclinada; «RONDA · ¡PELEA! · K.O.» con impacto.

## Cinemática previa al combate (`js/game/cinematic.js`, `data/intros.json`)
- Franjas de cine, cartel **A VS B** con el escenario, planos de cámara 3/4 sobre quien habla (con su gesto de presentación), subtítulos que se escriben solos con placa de nombre del color de su elemento, plano general y después «Ronda 1 · ¡Pelea!».
- 16 diálogos propios (todas las parejas y los 4 espejos) en español e inglés; un guerrero nuevo usa líneas genéricas con el nombre del rival.
- Cualquier tecla, clic o toque la salta. No aparece en Entrenamiento ni en Desafíos; un modo puede desactivarla con `cinematic: false`.
- Para añadir diálogos: `pairs["a>b"] = [{ "who": "a", "es": "…", "en": "…" }, …]`.

## v1.3 — Cinemáticas completas
- **Final de combate** (`js/game/cinematic-end.js`): se engancha a `opts.onResult` del combate; el panel de resultados espera a que termine (o a que se salte). Planos: giro de grúa sobre el ganador (`slam`), frase del ganador en contrapicado y del vencido en picado (`line`), retrato final (`pose`). Diálogos en `data/outros.json` (`pairs['ganador>perdedor']`, `mirror`, `generic`). Opciones: `outro: false` en `startMatch` la desactiva; no se reproduce en entrenamiento.
- **Intro**: paneles diagonales con el color de cada guerrero, líneas de velocidad, destello en cada corte, plano por encima del hombro (2.ª frase del mismo guerrero) y «choque» final con las auras.
- **Historia** (`js/game/story-cine.js`): `createStoryCine({ scene, roster }).play(scenes, done, { hero, rival, chapter, total })`. Rueda las escenas en la escena del menú (`scene.showPair` + `scene.cineCam`). Planos: tarjeta de capítulo (con `story.place.<rival>`), narrador, primeros planos y epílogo. Con «reducir movimiento» se usa el diálogo clásico.
- Guerreros personalizados: sin diálogos propios usan los genéricos; los planos se calculan con la altura (`def.height`) y la posición real de cada uno.
