# Checklist de progreso — Elemental Warriors

| Fase | Estado | Funcionalidad | Archivos | Prueba realizada | Siguiente paso |
|---|---|---|---|---|---|
| F0 | COMPLETADA | Inspección: 4 GLB con esqueleto Biped (123–168 huesos), **sin animaciones**, licencia CC-BY 4.0 | assets/characters/*.glb | Lectura del JSON de cada GLB | — |
| F1 | COMPLETADA | Base visual: escena 3D, menú, selector de guerrero, ajustes (calidad, movimiento, **idioma ES/EN**), créditos | index.html, css/main.css, js/**, data/** | `node --check` de los módulos y `npm run check` (datos y rutas). Prueba visual en Chromium headless: carga sin errores, menú y selector funcionan | — |
| F2 | COMPLETADA (pendiente tu prueba en dispositivo real) | Arena original «Ruinas del Equilibrio», combate lateral de prueba contra maniquí: caminar, saltar (con buffer), agacharse, giro al rival, límites, empuje entre luchadores, cámara 2.5D con zoom y seguimiento vertical, HUD, controles de teclado y táctiles, Pausa (Esc, P o botón) con guía de controles, Continuar, Reiniciar, Calidad gráfica y Volver al menú; se pausa sola al cambiar de pestaña | js/game/{fighter,input,arena,match}.js, index.html (#pause), scene-manager.js, menu-manager.js, main.js, css/main.css | `npm test` (9 pruebas de física OK), `npm run check` OK, Chromium headless: Jugar → Combatir → mover/saltar/agacharse → Esc abre la pausa (escena congelada, teclas ignoradas), Continuar, Reiniciar, cambio de calidad y Volver al menú funcionan en escritorio y en móvil horizontal, sin errores propios (solo falla Google Fonts sin internet) | F3: ataques, golpes, vida real, bloqueo (Pilar 1) |
| F3 | COMPLETADA (v0.5.0) | Combate básico: vida real, ataques normales (puño, patada, golpe bajo, aéreo), hitboxes/hurtboxes, guardia (alto/medio/bajo), aturdimiento, reacciones, rondas, fin por KO/tiempo, resultados, **simulación a paso fijo 60 Hz**, **intercambio de golpes simultáneos**, **empuje en pared**, **depuración F1** | js/game/{fighter,match,debug,ai,input}.js, data/moves.json, index.html (#dbg), css/main.css, js/main.js, tools/test-f3.mjs | `npm test` (7 suites, incluye tools/test-f3.mjs) + Chromium headless (render por software, ~3 fps): Jugar → combate → F1 muestra cajas y panel con datos reales, bloqueo registrado, 2.º F1 lo apaga, sin errores propios en consola | F4: ataques medio/pesado, lanzamientos, búfer, cancelaciones, Resonancia |
| F7 | COMPLETADA sobre el combate de F3 (v0.6.0; limitaciones abajo) | Modos: Arcade, Supervivencia, Historia (3 capítulos por guerrero con diálogos ES/EN), Versus contra la CPU y de 2 jugadores en el mismo teclado, Desafíos (7 jugables + 5 bloqueados «F4»), Entrenamiento con maniquí configurable, 4 dificultades de CPU, pantallas de resultados por modo, récords y progreso guardados | js/game/{ai,difficulty-config,input,match}.js, js/modes/{ladder,survival,challenges,score,flow}.js, js/ui/modes-ui.js, data/{modes,menu}.json, data/localization/*.json, css/modes.css, index.html, js/main.js, tools/test-{modes,flow,f3}.mjs | `npm test` (9 suites; F7 añade unas 150 comprobaciones (347 en total): IA por nivel, entrada de 2 jugadores, escaleras, supervivencia, desafíos, flujo de resultados, guardado y opciones del combate) + Chromium headless (render por software): Arcade (2 combates seguidos con «Continuar»), Versus 2P (J1 con WASD y J2 con flechas a la vez), Historia (diálogo→combate), Desafío (3/3 puños, +20 Rose Gold), Entrenamiento (maniquí, vida infinita, R), Supervivencia (vida arrastrada, récord), Versus CPU experto/1 ronda/sin tiempo; sin errores propios en consola | F4: ataques medio/pesado, lanzamientos, búfer, cancelaciones, Resonancia (desbloquea 5 desafíos y que la CPU use técnicas) |
| F4–F10 | PENDIENTE (F6, F8 y audio parciales arriba) | Ver docs del prompt maestro | — | — | — |

## Bitácora técnica
- Three.js r170 incluido en js/vendor (sin npm para jugar); solo hace falta un servidor estático.
- Modelos de Aang/Katara/Toph/Zuko como marcadores provisionales de Zephyr/Aqua/Terra/Ignis (ver ASSET-LICENSES.md).
- Material toon de 3 bandas; el contorno (outline) queda para F6.
- Animaciones: los modelos no traen clips; el idle actual es procedural sobre huesos. Las animaciones reales se crean en F2/F5 con un Animation Manager.
- Idiomas: todos los textos viven en data/localization/{es,en}.json (incluidos los de cada personaje); `npm run check` verifica que ambos tengan las mismas claves. Para añadir un idioma: copiar es.json, traducirlo y sumarlo a VALID en settings-manager.js y al selector de Ajustes.
- Opciones del menú sin implementar aparecen deshabilitadas con su fase.
- F2: los modelos no tienen animaciones; caminar/saltar/agacharse usan inclinación, rebote y escala del cuerpo. Las poses reales llegan con el Animation Manager (F3/F5).
- F2: un mismo guerrero no puede enfrentarse a sí mismo (cada modelo se carga una vez); los espejos requieren clonar con SkeletonUtils (pendiente).
- Las ilustraciones de «Guilty Gear Landboards» NO se usan como escenarios: son arte de Arc System Works y el documento pide arenas originales. Sirven solo como referencia de composición.
- F2.1: Esc/P ya no sale al menú, abre la pausa. Al reanudar o reiniciar se limpian las teclas pulsadas para evitar movimientos fantasma. La guía de la pausa se actualizará con los ataques en F3.
# Checklist de progreso — Elemental Warriors

| Fase | Estado | Funcionalidad | Archivos | Prueba realizada | Siguiente paso |
|---|---|---|---|---|---|
| F0 | COMPLETADA | Inspección: 4 GLB con esqueleto Biped (123–168 huesos), **sin animaciones**, licencia CC-BY 4.0 | assets/characters/*.glb | Lectura del JSON de cada GLB | — |
| F1 | COMPLETADA | Base visual: escena 3D, menú, selector de guerrero, ajustes (calidad, movimiento, **idioma ES/EN**), créditos | index.html, css/main.css, js/**, data/** | `node --check` de los módulos y `npm run check` (datos y rutas). Prueba visual en Chromium headless: carga sin errores, menú y selector funcionan | — |
| F2 | COMPLETADA (pendiente tu prueba en dispositivo real) | Arena original «Ruinas del Equilibrio», combate lateral de prueba contra maniquí: caminar, saltar (con buffer), agacharse, giro al rival, límites, empuje entre luchadores, cámara 2.5D con zoom y seguimiento vertical, HUD, controles de teclado y táctiles, Pausa (Esc, P o botón) con guía de controles, Continuar, Reiniciar, Calidad gráfica y Volver al menú; se pausa sola al cambiar de pestaña | js/game/{fighter,input,arena,match}.js, index.html (#pause), scene-manager.js, menu-manager.js, main.js, css/main.css | `npm test` (9 pruebas de física OK), `npm run check` OK, Chromium headless: Jugar → Combatir → mover/saltar/agacharse → Esc abre la pausa (escena congelada, teclas ignoradas), Continuar, Reiniciar, cambio de calidad y Volver al menú funcionan en escritorio y en móvil horizontal, sin errores propios (solo falla Google Fonts sin internet) | F3: ataques, golpes, vida real, bloqueo (Pilar 1) |
| F8 (núcleo) | EN PROGRESO | Rose Gold, tienda de paletas, colección, progreso, logros y guardado validado (sin depender de F3) | js/systems/{save,currency,shop,progression}-system.js, palette.js, meta.js, js/ui/meta-panels.js, data/{items,achievements,economy}.json | `npm test` (pruebas de economía, guardado y logros). Pantallas: pendiente de tu prueba en navegador | Conectar F3: llamar a `progression.recordMatch()` al terminar un combate (docs/INTEGRACION-F3.md) |
| F3–F10 | PENDIENTE | Ver docs del prompt maestro | — | — | — |

## Bitácora técnica
- Three.js r170 incluido en js/vendor (sin npm para jugar); solo hace falta un servidor estático.
- Modelos de Aang/Katara/Toph/Zuko como marcadores provisionales de Zephyr/Aqua/Terra/Ignis (ver ASSET-LICENSES.md).
- Material toon de 3 bandas; el contorno (outline) queda para F6.
- Animaciones: los modelos no traen clips; el idle actual es procedural sobre huesos. Las animaciones reales se crean en F2/F5 con un Animation Manager.
- Idiomas: todos los textos viven en data/localization/{es,en}.json (incluidos los de cada personaje); `npm run check` verifica que ambos tengan las mismas claves. Para añadir un idioma: copiar es.json, traducirlo y sumarlo a VALID en settings-manager.js y al selector de Ajustes.
- Opciones del menú sin implementar aparecen deshabilitadas con su fase.
- F2: los modelos no tienen animaciones; caminar/saltar/agacharse usan inclinación, rebote y escala del cuerpo. Las poses reales llegan con el Animation Manager (F3/F5).
- F2: un mismo guerrero no puede enfrentarse a sí mismo (cada modelo se carga una vez); los espejos requieren clonar con SkeletonUtils (pendiente).
- Las ilustraciones de «Guilty Gear Landboards» NO se usan como escenarios: son arte de Arc System Works y el documento pide arenas originales. Sirven solo como referencia de composición.
- F2.1: Esc/P ya no sale al menú, abre la pausa. Al reanudar o reiniciar se limpian las teclas pulsadas para evitar movimientos fantasma. La guía de la pausa se actualizará con los ataques en F3.

- F8: el guardado es local (localStorage) y NO es seguro para economía competitiva en línea. Las compras son solo cosméticas. Paletas = rotación de matiz de la textura del cuerpo/ropa (la cabeza no cambia); ajusta `hue`/`sat` en data/items.json.
- F8: mientras F3 no esté integrada, `?dev=1` en la URL muestra botones de prueba (+500 Rose Gold, simular victoria).

| F6 (parcial) | EN PROGRESO | 6 escenarios por datos + selector en «Jugar» (ver docs/INTEGRACION-F6.md) | js/stages/*, js/ui/stage-select.js, data/stages.json | npm test (F6) y navegador headless | Contornos, transiciones y reacciones reales (con F3) |

- F8.1: paletas por color concreto (js/systems/palette-models.js mide las texturas de cada modelo; si cambias un modelo, vuelve a medir sus colores). 3 paletas por guerrero; las 8 antiguas siguen disponibles solo si ya las habías comprado. Cada paleta también cambia el color del aura y las partículas.

| F9 (audio) | EN PROGRESO | Sonido 100 % sintetizado por código: 30 efectos con variantes por elemento, 5 piezas musicales (menú/combate), volúmenes de música y efectos, silencio, pausa con atenuación, sonidos de interfaz, tienda y logros | js/audio/*, js/systems/audio-manager.js, css/audio.css, audio-lab.html, tools/test-audio.mjs | `npm test` (audio) y medición en audio-lab.html (0 saturaciones, 0 silencios). **Pendiente tu escucha** | Conectar F3: `ew:sfx` o `audio.sfx(...)` (docs/INTEGRACION-AUDIO.md) |

## F3 — Combate real (v0.3.0)
- Golpes (data/moves.json): puño, patada, golpe bajo (↓+puño) y ataque aéreo; niveles alto/medio/bajo; cajas de golpe y de daño; aturdimiento, bloqueo (L / Shift / retroceder), retroceso, hit-stop, chispas y sacudida de cámara.
- Combos: cancelaciones puño→puño→patada (máx. 3 ataques), el daño baja un 10 % por golpe dentro del combo; contador de golpes.
- Vida real por personaje (según vida/fuerza/defensa de characters.json); el bloqueo nunca mata.
- Partida: al mejor de 3 rondas, 60 s por ronda, K.O. en cámara lenta, fin por tiempo, empate sin punto, pantalla de resultados (rondas, daño, combo máx., tiempo), Revancha / Volver al menú.
- Rival CPU (js/game/ai.js) y modo Entrenamiento (maniquí que revive).
- Pruebas: `npm test` = 24 de lógica de combate + 14 de partida completa (rondas, KO, tiempo, resultados) a 60 pasos/s en Node. En Chromium sin GPU (3 fps) se comprobó el flujo visual: golpes quitan vida, combo, HUD y resultados.
- Pendiente (F4): técnica especial y transformaciones (criterio 11 de la primera versión jugable), 2 jugadores local, más rivales con IA propia, ajuste de dificultad de la CPU, animaciones reales.

## F3.1 — Fusión F3 + animaciones (v0.3.1)
- Base: F3 (combate, HUD, rondas, IA, resultados, tests). Se incorpora el sistema de animación esquelética de F2-animaciones sin tocar la lógica de combate: `fighter.js` sólo gana contadores (`hitN`, `bkN`, `stunMax`, `hitKb`) para sincronizar reacciones.
- Quitado de `match.js` (chocaba con el esqueleto): inclinación, balanceo, rebote y escala procedural; `breathe()` del menú. Se conservan hit-stop, KO en cámara lenta, destello de impacto, chispas, cámara y el derribo (giro del cuerpo entero).
- Controles: los de F3 (J puño · K patada · L/Shift guardia · ↓+J golpe bajo). La «L = especial» de la versión de animaciones se retira porque F3 usa L para la guardia; la técnica especial jugable queda para F4 y su animación ya existe (`special`).
- Animaciones nuevas para estados de F3: guardia (de pie/agachada, propia de cada guerrero), golpe recibido (en tierra y en el aire), bloqueo con retroceso, golpe bajo, ataque aéreo, 2.º puñetazo del combo y K.O.; el ganador celebra al final de la ronda.
- Pruebas: 25 de combate + 11 de animación (clips, re-temporización, simulación IA vs IA de 4×40 s sin valores inválidos ni saltos bruscos) + 17 de partida (incluye que no quede animación procedural pisando al esqueleto). Chromium headless: menú → combate CPU → golpes, guardia, salto, golpe bajo sin errores de consola.
- Pendiente (F4): técnica especial y transformaciones; modelos finales; probar rendimiento en móvil real.

## v0.4.0 — Integración final (F3 + animaciones + F6 + F8 + audio)
- Causa del error «Cannot read properties of null (reading 'addEventListener')» en la versión 6: se habían copiado encima de la 5 los archivos de F3/animaciones (`main.js`, `match.js`, `scene-manager.js`, `menu-manager.js`…) pero **no** el `index.html` con el HUD de F3 (`#result`, `#hp1`, `#timer`…), y además se perdían las conexiones de escenarios, tienda y audio. Aquí se fusionó a tres bandas (base F2) y se conservaron ambas.
- Nuevo: `Match` avisa con `onFx(nombre, {who, x})` y `onReact({power, color})`; `main.js` los conecta con `audio.sfx` y `stages.react`. `stats.best` = mayor daño en un solo combo (para logros).
- Pruebas: 6 suites (combate, animación, partida con avisos de sonido/escenario, F8, F6, audio) + `check` OK. Chromium headless: arranque → tienda (vista previa de paleta) → escenario Mareas → combate con sonidos → victoria 2-0 → +100 Rose Gold y logro, sin errores de consola.
- Pendiente: escucharlo con altavoces reales; probar en móvil real; F4 (especiales/transformaciones) y F7 (modos Historia/Arcade).


## F3 final (v0.5.0) — cierre de la fase
Qué faltaba tras v0.4.0 y qué se hizo (todo con prueba):
- **Herramientas de depuración (criterio F3)**: F1 en combate activa/desactiva cajas de daño (verde), golpe activo (rojo), alcance del golpe en curso (amarillo), colisión corporal (azul) y un panel con estado, vida, posición, fase del golpe en fotogramas (inicio+activo+recuperación), aturdimiento, combo, cadena y último contacto. `js/game/debug.js` (lógica pura + overlay Three.js). Se conserva entre combates de la misma sesión.
- **Paso fijo (regla 13 y §28)**: `Match.update` acumula tiempo y ejecuta pasos de 1/60 s (máx. 6 por fotograma; si el equipo no llega se descarta el atraso, sin «espiral de la muerte»). La presentación (animación, cámara, posiciones) se interpola entre pasos. Prueba: el mismo combate a 30/60/144/240 FPS termina con vida, combo y posiciones idénticos.
- **Intercambio de golpes**: antes `resolve(a,b)` se evaluaba primero y anulaba el golpe del rival (el J1 ganaba siempre los empates). Ahora `resolveBoth` evalúa ambos con el estado previo; los dos reciben daño.
- **Empuje en pared**: si el rival está contra el muro, el atacante retrocede (sin presión infinita en la esquina).
- Menú: «Versus» indicaba F3; es F7 (versus local). Guía de pausa: añadida la fila de depuración.
- Error encontrado: el empate de golpes (arriba). Ninguno más en las 6 suites previas.
- Limitaciones: sin prueba en GPU ni móvil reales (Chromium de la prueba usa render por software); un guerrero no puede enfrentarse a sí mismo (pendiente: clonar con SkeletonUtils); la CPU tiene una sola dificultad (F7).

## v0.6.0 — Animaciones rehechas, F4 completa y verificación de todas las fases

| Fase | Estado | Verificación realizada |
|---|---|---|
| F0 | COMPLETADA | Proyecto inspeccionado de nuevo: 4 GLB sin clips; dependencias = Three.js r170 incluido |
| F1 | COMPLETADA | Chromium: arranque «Todo listo», las 12 entradas del menú; las 6 listas abren su pantalla real (Luchadores, Colección, Tienda, Progreso, Ajustes, Créditos) y las 5 de F7 avisan «llega en la fase F7». Idioma ES↔EN cambia menú, HUD y pausa |
| F2 | COMPLETADA | `npm test` (movimiento, salto, límites, separación, carrera, retroceso, doble salto) + combate en navegador escritorio y móvil horizontal 844×390 con táctil (multitoque, sin desplazamiento de página) |
| F3 | COMPLETADA | `npm test` (paso fijo 30/60/144/240 FPS idéntico, intercambio, pared, ventana activa, depuración F1) + navegador: golpes, F1, pausa, KO, 2-0, resultados con Rose Gold, revancha, volver al menú |
| **F4** | **COMPLETADA (v0.6.0)** | Ver abajo |
| F6 (parcial) | EN PROGRESO | Los 6 escenarios cargados en navegador con los 4 guerreros rotando, sin errores |
| F8 (núcleo) | EN PROGRESO | La victoria paga Rose Gold y desbloquea el logro «Primera victoria» (visto en navegador); `npm test` F8 |
| F9 (audio) | EN PROGRESO | `npm test` audio; F4 usa ahora los sonidos dedicados de lanzamiento, guardia rota, esquiva, proyectil y técnica |

### F4 — qué incluye
- Ataques ligero/medio/pesado de pie, agachado y aéreo; lanzamientos con escape, lanzamiento hacia atrás y protección; búfer de 6 fotogramas determinista; secuencia ↓↘→ tolerante; cadenas, cancelación en especial y en salto; combos aéreos con límite; escalado de daño y de aturdimiento; contraataques; derribo e invulnerabilidad al levantarse; recuperación aérea; guardia rota; carrera y retroceso rápido; proyectiles que chocan entre sí; armadura (Terra); paso a través del rival (Zephyr); doble salto (Zephyr).
- **Resonancia Elemental** propia: técnica reforzada (25), cancelación resonante (50), repulsión en guardia (50); se descuenta una sola vez; HUD con marcas de coste y número; se conserva entre rondas.
- Técnica especial de cada guerrero (U) y su versión reforzada (I). Equilibrio inicial por datos en `data/moves.json` (Terra lento y fuerte, Zephyr rápido y frágil, Aqua de alcance, Ignis directo).
- IA con 4 dificultades por calidad de decisión; maniquí de entrenamiento configurable (5 comportamientos).
- Lista de movimientos en «Luchadores» generada desde los datos.
- Detalle en `docs/COMBAT-SYSTEM.md`.

### Animaciones (prioridad de esta versión)
- 60 clips nuevos (15 por guerrero) hechos desde cero + locomoción, reacciones, derribo y levantarse; armas procedurales para los cuatro; estelas y efectos elementales sincronizados. Detalle en `docs/ANIMACION.md`.
- Revisadas fotograma a fotograma con `tools/capturar-poses.cjs` (tiras de cada golpe de los cuatro guerreros y secuencias de combate reales).

### Pruebas
`npm test` = 8 suites y 278 comprobaciones (lógica F2–F4: 76 · animación: 18 · partida: 24 · cierre F3: 27 · integración F4: 19 · F8: 46 · F6: 22 · audio: 46), todas OK. `npm run check` OK.

### Errores encontrados y corregidos en esta revisión
- El botón táctil ◀ heredaba el estilo del panel `.left` del menú (quedaba estirado y descolocado).
- Cambiar la dificultad desde la pausa podía recrear mal la IA; además, una excepción en un fotograma detenía el bucle de render para siempre (ahora se informa una vez y el juego sigue).
- La caída por K.O. giraba el cuerpo entero como una tabla; ahora el esqueleto se tumba y se levanta con su propia animación.
- El lado adelantado no se actualizaba tras cruzarse; ahora cambia al girarse (y el arma pasa a la otra mano).
- El destello de impacto blanqueaba al rival demasiado tiempo.

### Limitaciones
- Pruebas visuales en Chromium con render por software (1–5 FPS); falta probar en GPU y móvil reales y medir FPS.
- Los modelos siguen siendo provisionales (ver ASSET-LICENSES.md). Las armas y animaciones son originales y no dependen de ellos (cualquier modelo con esqueleto Biped las recibe).
- La transformación (barra a 100) es de F5. Versus local de 2 jugadores, historia, arcade y desafíos son de F7.

## F7 (v0.6.0) — modos de juego e IA
Decisiones:
- **Capas**: `Match` sigue siendo un solo combate; encima, `js/modes/flow.js` decide qué viene después (siguiente rival, reintento, diálogo, récord). Es lógica pura y se prueba con una interfaz simulada (`tools/test-flow.mjs`); `js/ui/modes-ui.js` solo dibuja las pantallas.
- **IA justa**: `js/game/ai.js` + `difficulty-config.js`. Solo ve el estado público del rival (golpe en curso, posición, aire) con un retraso de reacción (0,55 / 0,30 / 0,18 / 0,11 s); no lee botones, no tiene vida ni daño extra. Un puño tarda 0,08 s, menos que cualquier reacción, así que los niveles altos se protegen también por anticipación (`guardIdle`). Prueba: la tasa de bloqueo sube con el nivel (35→49→68→73 % contra puños) y el experto vence al principiante en 16 de 16 duelos con las mismas reglas.
- **Arcade**: los otros 3 guerreros (orden por personaje en `data/modes.json`), escenario por elemento del rival y Arena del Equilibrio en el último; dificultad base y +1 en el rival final; 3 continuaciones (−300 puntos cada una); puntuación por vida, rapidez, combos y no recibir daño, × dificultad.
- **Supervivencia**: una ronda por combate, la vida se recupera solo un 25 % entre combates, sube la dificultad cada 2 victorias, termina en la primera derrota; récord por victorias y puntos.
- **Historia**: 3 capítulos por guerrero (prólogo, intro del héroe, diálogo previo/posterior de cada rival y epílogo); perder permite reintentar sin límite; el progreso por capítulo se guarda y desbloquea capítulos.
- **Versus 2 jugadores**: J1 = A D W S + F G H; J2 = flechas + teclado numérico 1 2 3 (o , . /). Las teclas no se solapan (comprobado). Aviso de ghosting en pantalla. No disponible en pantallas táctiles.
- **Desafíos**: cada prueba mira los eventos reales del combate (`onEvent`); pagan Rose Gold una sola vez (atómico). Las de especiales, cancelaciones avanzadas, Resonancia, transformación y lanzamientos aparecen bloqueadas con «F4».
- **Entrenamiento**: maniquí quieto / guardia de pie / guardia agachada / solo ataca / CPU, vida infinita y reiniciar posiciones (R) desde Pausa; contador de combo con daño; F1 muestra datos de fotogramas.
- Guardado: `challenges`, `story` y `records` en el guardado local (con saneado y migración de guardados antiguos).
Errores encontrados y corregidos durante F7: un valor por defecto de «al mejor de» daba 1,5 rondas; el menú anunciaba Versus como «F3».
Limitaciones (pendientes):
- Sin jefes con fases ni antagonista jugable: el «rival final» es el tercer guerrero a mayor dificultad.
- Los duelos espejo (mismo guerrero en ambos lados) siguen sin poder hacerse (cada modelo se carga una vez; hace falta clonar con SkeletonUtils). Por eso Versus no deja elegir el mismo guerrero.
- La CPU no usa técnicas especiales ni Resonancia (no existen hasta F4). El entrenamiento aún no tiene registro de entradas, ventaja en fotogramas ni reproducción de situaciones.
- Versus no tiene selector de colores propio (las paletas equipadas se ven en el combate).
- Sin prueba en GPU ni móvil reales; el equilibrio de la IA se midió con simulaciones, no con jugadores humanos. Historia corta y con un solo final.


## v0.7.0 — Integración F7 + v0.6.0 + elementos
La F7 recibida partía de la F3 (sin F4 ni las animaciones de v0.6.0). Se hizo una fusión a tres bandas (base F3 · v0.6.0 · F7):
- Sin conflicto: modos (`js/modes/*`, `js/ui/modes-ui.js`, `data/modes.json`, `css/modes.css`), guardado y progreso de F7; combate, animación, armas, efectos y menú de v0.6.0.
- Fusionados a mano: `input.js` (2 jugadores con los 5 botones de F4), `ai.js` + `difficulty-config.js` (cerebro de F4 con la interfaz de F7: niveles, maniquíes, `makeBrain`, `reset`, reacción mínima garantizada y guardia por anticipación según el nivel), `match.js` (opciones de F7: rondas, tiempo, versus, vida arrastrada, maniquí, vida infinita, recolocar, eventos para desafíos; ahora también emite lanzamientos), `main.js` (flujo de F7 + HUD de F4), `index.html`, textos ES/EN.
- Errores de F7 corregidos al integrar: F1 (depuración) había dejado de funcionar; los combates de Arcade/Historia/Supervivencia no recibían su escenario (ahora sí: escenario por elemento del rival y Arena del Equilibrio en el final).
- Desafíos y pruebas de F7 adaptados a los golpes de F4 (los ids se conservan: el progreso guardado sigue valiendo). 4 desafíos que esperaban a F4 ya se pueden jugar y hay 2 nuevos de control elemental.
- Entrenamiento: el maniquí se regenera entre combos (v0.6.0) salvo en el desafío «Punto final»; «vida infinita» (F7) evita el K.O.
- [x] `npm test` = 13 suites, todas OK; `npm run check` OK. Recorrido en Chromium (render por software): menú, Arcade con paso al siguiente rival, Versus de 2 jugadores con teclado real (los dos hacen control elemental), Historia con diálogo, Supervivencia con vida arrastrada, Desafíos, Entrenamiento con opciones de pausa; sin errores propios en consola.
- Pendiente: probar en GPU y móvil reales; la transformación es de F5. (Los duelos espejo llegaron en v0.8.0.)
## v0.8.0 — Interfaz pulida + duelos espejo
- [x] Tema visual común (`css/theme.css`) sobre `css/main.css`: paneles con marco doble y filigrana, botones biselados con gema, pestañas, CTA, toasts, HUD (medallón del tiempo), resultados y créditos.
- [x] Fuentes locales (`css/fonts.css`, `assets/fonts/`, licencia OFL): ya no dependen de Google Fonts.
- [x] Pausa: cartel de duelo (placas con color de cada luchador, quién lo controla, elemento, marca «Espejo»), ronda · regla · escenario, opciones «etiqueta + valor» en una línea, guía con desplazamiento; también en pantallas bajas (≤480 px de alto) y estrechas.
- [x] Duelo espejo en Jugar y Versus (CPU / 2 jugadores) y en cualquier modo que pida el mismo guerrero: clon con esqueleto propio + chroma por shader + contorno; nombre propio en HUD, pausa y resultado; la tabla elemental del menú lo muestra como neutro.
- [x] Chroma espejo separado ≥25° de tono del original y de todas las paletas de la tienda (comprobado por prueba).
- [x] Guerreros futuros: espejo por defecto sin configurar nada; datos opcionales en `data/mirror.json`; guía en docs/PERSONAJES-PERSONALIZADOS.md.
- [x] Créditos: Sara Andrade Rodriguez (equipo) y las fuentes.
- [x] `npm test` = 14 suites OK; `npm run check` OK; recorrido en Chromium: menú, Jugar espejo, Versus espejo, pausa (1280×720 y 740×360), resultado, créditos; sin errores en consola.

## v0.8.1 — Ajustes de interfaz
- [x] Sin emojis junto a los nombres de los guerreros (botones de selección, escaleras de Arcade/Historia, cabecera del guerrero): una gema del color de su elemento. Las insignias de elemento (HUD, pausa, tabla de enfrentamiento, ficha) también usan la gema.
- [x] Ficha de Luchadores: se quitaron «Fuerte contra» y «Débil contra» (el triángulo elemental sigue mostrando las relaciones).
- [x] Pausa: cambiar la calidad gráfica (Baja/Media/Alta, también en inglés) ya no ensancha ni desborda el panel de opciones; la placa del valor tiene ancho fijo y la etiqueta nunca empuja el botón fuera del marco.
- [x] `npm test` (14 suites) y `npm run check` OK; capturas en 1280×720, 1024×600 y 740×360 sin desbordes ni errores de consola.

## v0.9.0 — Armas de la tienda + rompeguardia + combate sin arma
- [x] Golpes normales sin arma (las armas clásicas ya no se dibujan; las manos siguen la trayectoria de los golpes con un giro natural de muñeca).
- [x] 8 armas compradas con Rose Gold (no son de ningún guerrero), una equipada por guerrero; técnica en su botón + mejora pasiva; recarga visible en el HUD.
- [x] Animación de cada técnica: sacar de la funda (cintura o espalda) → usar → guardar / lanzar / recoger / desvanecer; arma envainada visible en combate.
- [x] Contraataque (daga), reflejo de proyectiles (abanico), atraer (garfios), enredar y derribar en el aire (boleadoras), bumerán que vuelve, golpe alto rompeguardia (maza), flecha (arco), abanico de cuchillos.
- [x] Adaptación al elemento (daño / aturdimiento / alcance y velocidad / guardia y armadura) y efectos del color de su elemento.
- [x] Mejoras que reducen la desventaja del triángulo elemental (abanico 50 %, daga 30 %, garfios 25 %).
- [x] Rompeguardia común (M+H): rompe la guardia; la CPU lo usa y lo interrumpe.
- [x] Menú principal sin «Entrenamiento» duplicado.
- [x] `npm test` = 15 suites OK; recorrido en Chromium de las 8 técnicas, Tienda › Armas, HUD y pausa.

## v1.0.0 — Presentación
- [x] Cinemática previa con diálogo (todas las parejas + espejos, ES/EN, saltable; no en entrenamiento/desafíos).
- [x] Contorno de tinta, postproceso (resplandor, gradación por escenario, viñeta, aberración, destellos, congelado de técnica), calidad baja sin postproceso.
- [x] Animación por pasos (18 poses/s) en golpes y reacciones, exageración de pose, latigazo en reacciones.
- [x] Chispas de impacto y auras de proyectil por sombreador; franja de técnica reforzada; carteles de contraataque / guardia rota; K.O. con cámara inclinada.
- [x] `npm test` = 16 suites OK; recorrido en Chromium (cinemática, técnicas, K.O., menús) sin errores en consola.

## v1.1.0 — Fluidez, poses, título y Versus
- [x] Animación continua y a tiempo real (dt hasta 0,1 s; los muelles se subdividen); resolución dinámica 0,6×–máx; resplandor a 1/4 y 1/16; sin postproceso en equipos lentos salvo en momentos clave.
- [x] Registro de modelos a prueba de fallos (modo seguro sin contorno; el aviso muestra el motivo).
- [x] Sombreado 2 tonos, luces ajustadas, contorno 1,45 px del color de la textura y sin contorno en mallas transparentes.
- [x] Muñecas sin «apuntar hoja» cuando no hay arma (límite 0,5 rad), giro de antebrazo limitado, pulgar recogido; guardias nuevas por guerrero.
- [x] Estallidos elementales por sombreador al golpear.
- [x] Pantalla de título con emblema, nebulosas y chispas; Versus con los dos guerreros frente a frente.
- [x] `npm test` = 16 suites OK.

## v1.2.0
- [x] Ejes de curvatura de los dedos desde la geometría de la palma (puño cerrado correcto).
- [x] Exageración solo en golpes y sin comPitch (volteretas intactas); victoria de Zephyr sin «hoja al hombro»; ganador separado del caído.
- [x] 12 chromas premium (8 efectos animados, aura de partículas en combate, contorno de color); se quitan al desequipar.
- [x] HUD con barras arcade; créditos con Claude.
- [x] `npm test` = 16 suites OK.

## v1.3.0
- [x] Celular en horizontal: menú en dos columnas, resultados en dos columnas (sin cortes), avisos arriba, «¡Combatir!» fijo abajo (`css/mobile.css`, carga la última).
- [x] 2 jugadores solo con teclado físico detectado (pulsación real con código físico, o puntero fino); se activa sin recargar.
- [x] Cinemática final por pareja ganador/perdedor (16 + genéricas para guerreros nuevos), victoria perfecta, saltable; no en entrenamiento ni vista previa.
- [x] Intro: paneles diagonales, líneas de velocidad, cortes con destello, plano sobre el hombro y choque final con auras.
- [x] Historia en 3D: tarjeta de capítulo, narrador, primeros planos, respuestas del héroe (12), epílogo; fallback al diálogo clásico con «reducir movimiento».
- [x] Vista previa de armas en vivo en la tienda (demo real con maniquí; se cierra al salir).
- [x] Muñeca natural sin arma (marco de la palma desde la geometría del modelo); guardias con antebrazo vertical; pulgar cerrado.
- [x] Vida infinita: con ella nadie cae y se regenera tras cada combo; sin ella hay K.O. real.
- [x] Terra: Fisura de Colmillos (`fangs`), Ola Tectónica (`slabwave`), Meteorito con levitación y lanzamiento a dos manos.
- [x] `npm test` = 17 suites OK (nueva `tools/test-v13.mjs`).

## v1.4.0
- [x] `index.html` de un solo archivo (sin servidor; datos, modelos y tipografías dentro); `index-dev.html` para desarrollar; `npm run build`.
- [x] Resumen por jugador con bonificaciones, puntuación, rango S–D y Rose Gold extra (tope 500); 2 jugadores con dos tarjetas y oro a la misma cuenta.
- [x] Resultados: veredicto en una línea, botones en fila dentro del panel, compacto en celular, logros sin tapar botones.
- [x] Pie fijo para el botón principal de los paneles del menú (no tapa pestañas).
- [x] Vista previa de armas sin cartel y a distancia de impacto.
- [x] Fuego con lenguas de llama, humo y estallido; escenarios con capas de fondo y vida ambiental.
- [x] `npm test` = 18 suites OK (nueva `tools/test-v14.mjs`).

## v1.5.0
- [x] Transformación definitiva funcional (Y / I+O / Q / 7; táctil ✹), mejoras que no se pierden con el triángulo elemental, CPU, HUD, bonificación, desafío y estadística `transformations`.
- [x] 58 desafíos (técnica, combate, modos, 2 jugadores) con recompensa propia (tope 400) y rival automático (ventaja elemental / espejo).
- [x] 4 canciones nuevas + aleatoria, elegibles en Ajustes.
- [x] Escenarios con cordillera, clima y símbolos; cascada en el bosque.
- [x] Historia con planos de mundo (recorrido del prólogo, llegadas narradas).
- [x] Daga en la vista previa: maniquí guiado para mostrar el contraataque.
- [x] `npm test` = 19 suites OK (nueva `tools/test-v15.mjs`).

## v1.6.0
- [x] Un solo index.html (desarrollo en tools/dev/index.html) y favicon temático.
- [x] Vigilante de carga (__EW_BOOT, Reintentar, Modo ligero, WebGL) y pantalla completa en táctil.
- [x] Pulgar del puño cerrado por delante de los dedos.
- [x] Dificultad Fácil/Medio/Difícil/Extremo en Combate de prueba; la CPU se transforma.
- [x] Poses K.O. distintas por guerrero y gesto de derrota mirando al ganador.
- [x] Botones de historia, versus 2J, panel móvil, selector de canción con flechas, hover táctil, sin «Neutro».
- [x] `npm test` = 20 suites (tools/test-v16.mjs).

## v1.7.0
- [x] Inercialización en el director de animación; clave en t = 0 sin salto; reacciones y guardia sin escalones; extremos sin rebote (`tools/anim-audit.mjs`).
- [x] Derrota en el suelo con gesto distinto por guerrero mirando al ganador.
- [x] Chromas: uniformes por material (cada uno su efecto), 19 efectos, sin teñir pelo/piel, corona de Terra, paletas antiguas por zonas.
- [x] Técnicas con los colores y la firma del chroma; espejos con material y técnicas propias.
- [x] Logo nuevo.
- [x] `npm test` = 21 suites (tools/test-v17.mjs).

## v1.8.0 — F9 COMPLETADA
| Funcionalidad | Archivos | Prueba | Resultado |
|---|---|---|---|
| Ajustes de gráficos, controles, táctil, accesibilidad, sonido e idioma | js/ui/settings-page.js, js/systems/a11y.js, js/systems/settings-manager.js, css/settings.css | test-v18 §1 + captura de las 6 pestañas + reasignación real de tecla en el navegador | OK |
| 109 logros con hazañas registradas | data/achievements.json, js/systems/progression-system.js, js/main.js | test-v18 §2, test-progression | OK |
| Derrota sentada distinta por guerrero | js/game/animation/attacks.js, pose.js, cinematic-end.js | test-v18 §3 + capturas de la escena final de los 4 | OK |
| Giro de Zephyr sin vuelta extra | js/game/animation/pose.js | test-v18 §3 + secuencia de fotogramas del menú | OK |
| Armas: aura, estelas, impactos, vista previa | weapon-art.js, weapon-vfx.js, vfx.js, weapon-preview.js | test-v18 §4 + capturas de 4 armas | OK |
| `npm test` = 22 suites | tools/test-v18.mjs | npm test | OK |

Limitaciones: no probado en dispositivos reales (solo emulación de Android y escritorio con Chromium); las voces no existen todavía (no hay control de volumen de voces).

## v1.9.0 — Estado de las fases (revisión completa de las indicaciones)
| Fase | Estado | Notas |
|---|---|---|
| F0 Inspección | COMPLETADA | |
| F1 Base visual y menú | COMPLETADA | menú con santuario animado por guerrero, frases, título con emblema, perfil y aviso de guardado (v1.9) |
| F2 Arena y movimiento | COMPLETADA | |
| F3 Combate básico | COMPLETADA | |
| F4 Combos y Resonancia | COMPLETADA | |
| F5 Identidad de los 4 elementos | COMPLETADA | transformaciones (v1.5) |
| F6 Escenarios y presentación | COMPLETADA | 6 escenarios + aleatorio, cinemáticas |
| F7 Modos e IA | COMPLETADA | + Espectador (v1.9), registro de entradas y ventaja en Entrenamiento (v1.9) |
| F8 Progresión | COMPLETADA | 109 logros, colección con música y archivos (v1.9) |
| F9 Móvil, accesibilidad y sonido | COMPLETADA | ajustes en 6 pestañas (v1.8) |
| F10 Validación y entrega | EN PROGRESO | 23 suites automáticas + capturas en escritorio y celular emulado; falta probar en dispositivos reales |

Limitaciones registradas: no hay voces (por eso no hay volumen de voces); multijugador en línea no implementado (fase avanzada, no se simula); modelos provisionales de terceros (CC BY 4.0) a sustituir por definitivos; no probado en celulares ni GPU reales.

## v1.10.0 — Verificación
| Cambio | Archivos | Prueba | Estado |
|---|---|---|---|
| Rival con fichas + Aleatorio (Jugar y Versus) | js/ui/track-ui.js, menu-manager.js, modes-ui.js, versus-preview.js | test-v110 §1 + capturas escritorio y celular | OK |
| Fondos del menú pulidos (4) | js/game/menu-backdrop.js | test-v110 §2 (≤ 0,035 por fotograma) + capturas | OK |
| Bastión calmado · Santuario del Viento nuevo | js/stages/stage-builder.js, stage-extras.js, data/stages.json | test-v110 §3 + capturas en combate | OK |
| Botones grandes solo en PC | css/settings.css | test-v110 §4 + capturas 1920×1080 y 1366×768 | OK |
| Derrotas y K.O. con contacto real con el suelo | pose.js, rig.js, attacks.js, locomotion.js | test-v110 §5 + medición de la altura de la cadera en el laboratorio + capturas | OK |
| `npm test` = 24 suites | tools/test-v110.mjs | npm test | OK |

## v1.11.0 — Verificación
| Cambio | Prueba | Estado |
|---|---|---|
| Ficha del jugador (emblema, k/M, sin clic) | test-v111 §1 + captura | OK |
| Derrotas Aqua (seiza) y Zephyr (mano) | test-v111 §2 + laboratorio | OK |
| Fuego por shader, entradas/salidas, luna, chroma en todo | test-v111 §3 + capturas con 3 chromas | OK |
| Una barra por fuera + ▲ | test-v111 §4 + capturas escritorio y celular | OK |
| Guardado cifrado/firmado, sin consola, CSP | test-v111 §5 + prueba de la versión web (sin globales con ?dev, sin bloqueos de CSP) | OK |
| Versión web con actualización automática | prueba real: se publica una versión nueva → aviso → «Actualizar» → versión nueva y caché nueva | OK |
| `npm test` = 25 suites | npm test | OK |

## v1.12.0 — Verificación
| Cambio | Prueba | Estado |
|---|---|---|
| Progreso/Créditos sin descuadre | test-v112 §1 + capturas | OK |
| Sin temblor de cámara | test-v112 §2 | OK |
| Victorias y derrota de Aqua | test-v112 §3 + laboratorio y cinemática real | OK |
| Paisajes del menú y luna con fase real | test-v112 §4 + capturas de los 4 | OK |
| Historia de 11 capítulos con retos | test-v112 §5 (retos, reflejo, final y textos es/en) + captura | OK |
| Medallas, bocadillo, símbolos, arma en la espalda, vista previa | test-v112 §6 + capturas | OK |
| `npm test` = 26 suites | npm test | OK |
