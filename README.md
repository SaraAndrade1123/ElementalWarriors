# Elemental Warriors (v1.4.0 · resumen con rango, un solo archivo y escenarios vivos)

## Cómo abrirlo
- **Jugar**: abre `index.html` con doble clic (o desde el celular). Es el juego completo en un solo archivo: no necesita servidor, Live Server ni internet.
- **Desarrollar**: `npm start` y abre http://localhost:5173/index-dev.html (usa los módulos de `js/`). Tras cambiar código, datos o estilos, `npm run build` vuelve a generar `index.html` (y `dist/elemental-warriors-online.html`, la versión que se publica en línea).

Comprobar datos: `npm run check`.
Si un guerrero mira hacia atrás, cambia su `yaw` en `data/characters.json` (por ejemplo, suma 3.14).

Pruebas: `npm test` (física) y `npm run check` (datos).
Controles: A/D mover (doble toque: correr/retroceder) · W saltar · S agacharse · J/K/L ligero/medio/pesado · U especial · I Resonancia · J+K lanzamiento · ← o Shift guardia · Esc/P pausa · F1 depuración. En móvil: cruceta y 6 botones. Guía completa en docs/COMBAT-SYSTEM.md.

## Versión integrada (v0.4.0): combate F3 + animaciones + escenarios + economía + audio
Esta versión parte de la **5** (que ya traía escenarios F6, Rose Gold/tienda/paletas F8 y audio) y le añade el combate de F3 y el sistema de animación esquelética, fusionados a tres bandas contra el F2 original.
- **Combate → resto del juego** (`js/main.js` + callbacks de `Match`): golpes, silbidos, bloqueo, KO, fin de ronda, victoria/derrota y cuenta atrás suenan con el timbre del elemento del atacante; el escenario reacciona a los impactos; al terminar el combate se llama a `progression.recordMatch` (Rose Gold, estadísticas, logros) y el resultado muestra el oro ganado. El entrenamiento no paga.
- **Animaciones**: ver `js/game/animation/` (rig con IK, director de estados, clips re-temporizados con `data/moves.json`). Las paletas de la tienda se aplican sobre los mismos modelos animados.
- Cómo abrirlo: con cualquier servidor estático (`npm start`, o «Live Server» de VS Code → `http://127.0.0.1:5500/index.html`). Con `?dev=1` hay ganchos de consola: `ew`, `ewAudio`, `ewStages`, `ewScene`.
- Laboratorio de animación: `/tools/anim-lab.html`. Pruebas: `npm test` (6 suites) y `npm run check`.

## F3 completa (v0.5.0)
F1 durante el combate activa la depuración (cajas de daño/golpe/colisión y datos de fotogramas). La simulación va a paso fijo de 60 Hz: el daño no depende de los FPS. `npm test` ejecuta 7 suites (incluye `tools/test-f3.mjs`).

## v0.6.0 — Animaciones rehechas + F4
- **Animaciones**: 15 clips nuevos por guerrero (12 golpes, presentación, victoria, levantarse), armas propias (espada, lanza, guanteletes, hojas gemelas), estelas y efectos elementales, derribo/levantarse con el esqueleto, carrera, retroceso, doble salto con voltereta. Cada uno se mueve según su personalidad (docs/ANIMACION.md).
- **F4**: golpes L/M/H de pie, agachado y aéreos, lanzamientos con escape, búfer de entradas, cadenas y cancelaciones, combos aéreos con límite, contraataques, guardia rota, proyectiles, técnica especial y reforzada, Resonancia Elemental, 4 dificultades de CPU y maniquí configurable (docs/COMBAT-SYSTEM.md).
- `npm test` ejecuta 8 suites. Laboratorio de animación: `tools/anim-lab.html`.

## Modos de juego (v0.6.0, F7)
Menú principal → Historia · Arcade (y Supervivencia) · Versus (CPU o 2 jugadores) · Entrenamiento · Desafíos. Dificultad de la CPU: Principiante, Normal, Difícil y Experto (misma reglas que el jugador, solo cambia su reacción y decisiones).
- 2 jugadores en un teclado (botones de F4): J1 A D W S + F G H (ligero/medio/pesado) + R especial + T Resonancia · J2 flechas + 1 2 3 + 4 especial + 5 Resonancia del teclado numérico (o , . - L Ñ).
- Entrenamiento: en Pausa se cambia el maniquí y la vida infinita; R reinicia posiciones; F1 muestra cajas de golpe/daño.
- Datos de modos: `data/modes.json` (orden de rivales, escenarios, puntuación, continuaciones). Textos de la historia: `story.*` en `data/localization/*.json`.

## v0.7.0 — Integración: F7 (modos) + v0.6.0 (F4 y animaciones) + elementos
La F7 se había construido sobre la F3; esta versión la fusiona con la v0.6.0 para no perder nada:
- **De F7**: Historia, Arcade, Supervivencia, Versus (CPU y 2 jugadores), Desafíos, Entrenamiento con maniquí y vida infinita, resultados por modo, récords y guardado.
- **De v0.6.0**: todo el combate F4 (L/M/H, lanzamientos, cancelaciones, Resonancia, proyectiles, guardia rota), las animaciones rehechas, armas, efectos y la IA que usa técnicas.
- **Elementos**: triángulo elemental (docs/ELEMENTOS.md) y 12 técnicas de control elemental (docs/CONTROL-ELEMENTAL.md) en todos los modos, también para el J2 en Versus.
- Desafíos actualizados a F4 (13 jugables: los 7 de F7, especial, cancelación, Resonancia, lanzamiento y 2 de control elemental; la transformación espera a F5).
- `npm test` ejecuta 13 suites (incluye `tools/test-integracion.mjs`). Detalle en docs/CHECKLIST.md → «v0.7.0».

## v0.8.0 — Interfaz pulida + duelos espejo
- **Interfaz**: estética de laca azul noche y filigrana dorada en todos los paneles (marcos dobles, esquinas ornamentales, botones biselados con gema, placas de valor). Tipografías Cinzel (títulos) y Rajdhani (texto) incluidas en `assets/fonts/` (funcionan sin internet).
- **Pausa rediseñada**: cartel de duelo con las dos placas enfrentadas (quién controla cada lado, nombre grande en Cinzel, elemento) y emblema VS; ronda, regla y escenario debajo; opciones con su valor en una placa; guía de controles con desplazamiento propio.
- **Duelos espejo**: ya se puede elegir al mismo guerrero en Jugar y en Versus (CPU o 2 jugadores). El segundo luchador es un clon animado con un chroma exclusivo por guerrero, distinto de las paletas de la tienda: Ignis · Llama Jade, Aqua · Marea Ámbar, Terra · Cuarzo Rosa, Zephyr · Vendaval Carmesí.
- **Preparado para diseños propios**: el chroma espejo funciona con cualquier modelo y guerrero nuevo (docs/PERSONAJES-PERSONALIZADOS.md). La transformación llega en F5.
- **Créditos**: equipo — Sara Andrade Rodriguez.
- `npm test` ejecuta 14 suites (nueva: `tools/test-mirror.mjs`).

## v0.9.0 — Armas de la tienda, rompeguardia y combate sin arma
- Los golpes de todos los guerreros son **sin arma** (puños, palmas y patadas de su elemento).
- **8 armas en la Tienda** (pestaña *Armas*), de 300 a 700 Rose Gold, para cualquier guerrero. Cada una da una técnica en su propio botón (O · J1 E · J2 6/K) con animación de sacar → usar → guardar/lanzar/recoger/desvanecer, y una mejora pasiva. Algunas están pensadas para **contraatacar** (daga, abanico) y para **reducir la desventaja del triángulo elemental** (abanico, daga, garfios). La técnica se adapta al elemento de quien la usa. Ver docs/ARMAS.md.
- **Rompeguardia** para todos (K+L · J1 G+H · J2 2+3): lento, rompe la guardia de quien se protege. La CPU también lo usa y sabe interrumpirlo.
- La CPU en Difícil/Experto lleva arma. El menú principal ya no repite «Entrenamiento» (está en Jugar).
- `npm test` ejecuta 15 suites (nueva: `tools/test-weapons.mjs`).

## v1.0.0 — Presentación estilo Guilty Gear / Mortal Kombat
- Cinemática con diálogo antes de cada combate (16 diálogos propios, ES/EN, se puede saltar).
- Contorno de tinta, resplandor, gradación por escenario, viñeta, aberración y destellos de impacto; congelado de técnica con franja de nombre.
- Animación por pasos estilo anime, poses más exageradas, reacciones con latigazo, chispas de impacto en estrella y auras de proyectil dibujadas por sombreador.
- Detalle en docs/PRESENTACION.md. `npm test` ejecuta 16 suites.

## v1.1.0 — Fluidez, poses y pantalla de título
- **Fluidez ante todo**: animación continua (sin «por pasos»), las animaciones van a tiempo real aunque el equipo vaya lento, **resolución dinámica** (baja la resolución interna si no llega a ~50 fps y, si hace falta, el resplandor) y resplandor más barato.
- **Personajes**: sombreado de dos tonos más limpio, luces sin quemar la piel, contorno más fino del color de la textura (sin bordes negros en el pelo).
- **Manos y poses**: sin arma, las muñecas ya no se doblan como si apuntaran una hoja (la «mano rota»); pulgar recogido; guardias de artes marciales nuevas para los cuatro (puños de fuego, palmas de agua, puños de tierra, manos ligeras de viento).
- **Golpes**: estallido del elemento de quien golpea (llamas, corona de agua, cortes de viento, esquirlas de tierra) y chispa más contenida.
- **Pantalla de título** nueva: emblema de los cuatro elementos girando, nebulosas de color y chispas.
- **Versus**: los dos elegidos aparecen frente a frente con sus placas (J1 / CPU o J2) y el emblema VS; el espejo con su chroma.

## v1.2.0 — Chromas premium, manos y HUD arcade
- **Manos**: los dedos se cierran en un puño real (el eje de cada falange se calcula con la forma de la palma del modelo, sirve para cualquier personaje).
- **Animaciones**: la exageración de pose ya no deforma volteretas ni gestos (la victoria e intro de Zephyr se veían rotas); victoria de Zephyr nueva; el ganador se aparta del caído; guardias a la altura del pecho.
- **Chromas de la tienda**: cada uno trae un efecto animado propio sobre el modelo (llamas, destello dorado, galaxia, latido Avatar, relámpagos, cristal, lava, neón), contorno de su color y partículas en combate. La tienda lo describe.
- **HUD arcade**: barras de vida doradas con marco, cortes cada 10 %, extremo en bisel, línea del color del elemento y aviso de vida baja.
- **Créditos**: Sara Andrade Rodriguez y Claude.

## v1.3.0 — Cinemáticas, historia en 3D, celular y Terra
- **Celular**: el menú principal pasa a dos columnas en horizontal; el panel de resultados (VICTORIA / DERROTA) se reparte en dos columnas y ya no se corta; avisos arriba; botón «¡Combatir!» siempre visible (`css/mobile.css`).
- **2 jugadores con teclado**: se habilita si el dispositivo tiene teclado físico (USB o Bluetooth), también en celular/tableta: basta pulsar una tecla (`js/systems/keyboard-detect.js`).
- **Cinemática final** en cada combate (`js/game/cinematic-end.js`, `data/outros.json`): giro de cámara sobre el ganador con su elemento, cartel «NOMBRE · VICTORIA / VICTORIA PERFECTA», frase del ganador y respuesta del vencido (16 combinaciones, ES/EN) y plano final de retrato. Se salta con cualquier tecla o toque.
- **Intro mejorada**: paneles diagonales con el color de cada guerrero, líneas de velocidad, cortes con destello, plano por encima del hombro y «choque de miradas» final con las auras.
- **Historia cinematográfica** (`js/game/story-cine.js`): tarjeta de capítulo con el lugar de cada rival, narrador sobre plano general, primeros planos de quien habla con su gesto, 12 respuestas nuevas del héroe a cada rival y epílogo a contraluz. Toque/Enter avanza, «Saltar escena» lo salta.
- **Vista previa de armas** en la tienda («▶ Ver en acción»): el guerrero elegido saca el arma, lanza su técnica contra un maniquí y la guarda, en bucle, con los modelos y efectos reales.
- **Manos naturales**: la muñeca sigue la línea del antebrazo y solo gira para orientar la palma (puño: palma hacia dentro y abajo al estirar; mano abierta: palma al frente al empujar). Guardias con los antebrazos verticales y el pulgar cerrado sobre el puño.
- **Vida infinita** (entrenamiento) arreglada: activada nadie cae y la vida se recupera al acabar cada combo; desactivada el daño se queda y hay K.O. real (luego ambos vuelven con la vida llena).
- **Terra**: técnicas nuevas y distintas — *Fisura de Colmillos* (barrido bajo que hace brotar una hilera de colmillos de piedra) y *Ola Tectónica* (arranca el suelo y empuja una ola de losas que lanza al rival); *Meteorito* ahora levanta la roca con las palmas y la lanza a dos manos.

## v1.4.0 — Resumen del combate, un solo archivo y escenarios vivos
- **Un solo archivo**: `index.html` lleva dentro el código, los datos, las tipografías y los modelos; se abre con doble clic o en el celular sin servidor (`tools/build-standalone.mjs`, `npm run build`). La fuente para desarrollar es `index-dev.html`.
- **Resumen estilo Naruto Storm** (`js/game/fight-report.js`, `js/ui/result-screen.js`): primer golpe, combo máximo, Resonancia acertada, K.O. con Resonancia, rondas perfectas, remontada, contraataques, guardia rota, agarres, técnicas elementales, golpes con arma, bloqueos, daño, vida y tiempo restantes. Cada lado recibe puntuación, **rango S/A/B/C/D** y Rose Gold extra.
- **2 jugadores**: dos resúmenes (J1 y J2) y lo que gana cada uno se suma a la misma cuenta de Rose Gold.
- **Pantallas de resultados** rehechas: veredicto siempre en una línea, botones en fila y siempre dentro del panel, versión compacta para celular; los avisos de logros ya no tapan los botones.
- **Menú**: el botón principal («¡Combatir!», «Comenzar historia»…) queda en un pie fijo y el contenido se desplaza encima sin quedar tapado (`js/ui/panel-dock.js`).
- **Vista previa de armas**: sin el cartel «vista previa en vivo»; cada arma se muestra a la distancia a la que conecta (la daga contraataca a un maniquí que ataca).
- **Fuego de Ignis**: lenguas de fuego con forma de llama, humo, cola que sale despedida de la bola y estallido de llamas al impactar.
- **Escenarios**: capas pintadas con perspectiva (bosques, templos, volcán humeante, castillo, luna y mar, agujas, cañón, arcos, islas flotantes, estrellas y aurora), faroles que se mecen, estandartes, ríos de lava, farolillos que suben, cometas, pájaros y rocas (`js/stages/stage-extras.js`).
