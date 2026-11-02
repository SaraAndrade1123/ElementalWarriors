# Control elemental (técnicas sin arma)

Cada guerrero domina su elemento con el cuerpo, como en las artes marciales de control de los elementos: **la técnica sale de la mano libre, de las dos manos o de los pies**, y el arma se queda en su mano. Son 3 técnicas por guerrero (12 en total), además de los golpes con arma, la especial y la reforzada que ya existían.

## Controles
| Técnica | Teclado | Alternativa (movimiento) | Táctil |
|---|---|---|---|
| **Proyección** | → + U | ↓ ↙ ← + J/K/L | ▶ + ✦ |
| **Ascendente / de zona** | ↓ + U | → ↓ ↘ + J/K/L | ▼ + ✦ |
| **Aérea** | U en el aire | — | ✦ en el aire |

U solo (o ← + U) y ↓ ↘ → + golpe siguen siendo la **técnica especial** con arma. Las técnicas elementales se cancelan desde los golpes normales que conectan, igual que la especial (por ejemplo L → M → →+U). Una técnica elemental no se cancela en otra.

## Las 12 técnicas
| | Proyección (→U) | Ascendente (↓U) | Aérea (U en el aire) |
|---|---|---|---|
| 🔥 **Ignis** | **Puño de Fuego** — carga el puño libre en la cadera y dispara una bola de fuego con un paso largo. 12 f, 10 daño | **Arco Llameante** — salta y traza con la pierna una media luna de fuego hacia arriba. Antiaéreo invulnerable al inicio, lanza. 8 f, 12 daño | **Patada Cometa** — patada de empeine hacia abajo que lanza un cometa de fuego en diagonal. Golpe alto. 9 f, 9 daño |
| 💧 **Aqua** | **Látigo de Agua** — recoge el agua en un círculo y la descarga en un latigazo de 3,8 de alcance (2 impactos que atraen). 11 f, 16 daño | **Géiser** — «levanta» el agua del suelo y brota una columna a 3 de distancia que lanza. 18 f, 14 daño | **Agujas de Hielo** — congela el agua y abanica 3 agujas en diagonal. Golpe alto. 10 f, 12 daño |
| 🪨 **Terra** | **Roca Proyectil** — pisotón que arranca una roca del suelo, la sube y la dispara de un directo. Armadura durante la carga, derriba. 24 f, 15 daño | **Muro de Piedra** — levanta una pared de roca delante: lanza a quien esté encima, **detiene proyectiles** y **el rival no puede atravesarla** durante 1,6 s. 14 f, 11 daño | **Lluvia de Rocas** — arranca un trozo del guantelete y lo martillea hacia abajo. Golpe alto. 12 f, 11 daño |
| 🌪️ **Zephyr** | **Ráfaga** — empuja el aire con las dos palmas: poco daño y gran empuje. 9 f, 6 daño | **Torbellino** — gira sobre sí mismo y suelta un tornado lento de 3 impactos que levanta. 13 f, 12 daño | **Bala de Aire** — media voltereta y patada de hacha que dispara una bola de aire en picado. Golpe alto. 7 f, 7 daño |

Todas reciben el **triángulo elemental** (docs/ELEMENTOS.md): por ejemplo, el Puño de Fuego hace 120 % a Zephyr, 100 % a Terra y 80 % a Aqua, y su daño al bloquear y su desgaste de guardia también cambian.

## Animación y efectos
- 12 clips nuevos hechos desde cero (`js/game/animation/bending-clips.js`), cada uno con **anticipación** (se lee qué viene), **liberación** de 2-3 fotogramas con todo el cuerpo detrás y **seguimiento** con peso. Se re-temporizan sobre la ventana real de cada golpe, como el resto de clips.
- Cada guerrero se mueve según su elemento: Ignis respira fuego y golpea desde la cadera; Aqua dibuja círculos continuos con la mano libre; Terra nace de un pisotón y empuja con todo el peso; Zephyr gira y empuja con las palmas.
- Efectos (`js/game/bending-vfx.js`): sombreadores propios de fuego, agua y aire con ruido animado; bola de fuego con estela de llamas; arco de fuego que sigue el pie; corriente de agua que sigue la mano y látigo que se estira y recoge con una onda; géiser con columna, corona y salpicaduras; agujas de hielo; roca que **emerge del suelo y se convierte en el proyectil**; muro que sube con sacudida y se hunde al terminar; esfera de aire, tornado de dos capas y anillos de viento. Durante la carga hay efectos sostenidos (llama en el puño, agua alrededor de las manos, burbujeo en el punto del géiser, aire que converge en las palmas, espiral de viento al girar).
- La cantidad de partículas sigue la calidad gráfica y «reducir movimiento».

## Reglas nuevas de proyectiles (data/bending.json)
| Campo | Qué hace |
|---|---|
| `proj.vy` | velocidad vertical: el proyectil viaja en diagonal |
| `proj.groundBurst` | se deshace al tocar el suelo |
| `proj.hitWindow` | segundos durante los que puede golpear; después solo frena proyectiles |
| `proj.wall` | el rival no puede atravesarlo por el suelo |

Todo se ajusta en `data/bending.json` sin tocar código (tiempos, daño, alcance, velocidad, tipo de efecto).

## La IA
La CPU usa las técnicas con las mismas entradas que un jugador: proyección a distancia, antiaéreo cuando saltas cerca, técnicas aéreas al caer, el muro de Terra contra proyectiles y, a veces, remata sus combos con la proyección en lugar de la especial. Más dificultad = más acierto, nunca daño extra.

## Archivos
| Archivo | Qué es |
|---|---|
| `data/bending.json` | las 12 técnicas (mismo formato que data/moves.json) |
| `js/game/bending.js` | lógica pura: entradas, cancelaciones, reglas de proyectiles, IA |
| `js/game/animation/bending-clips.js` | las 12 animaciones |
| `js/game/bending-vfx.js` | efectos visuales |
| `js/elements/bending-hook.js` | gancho: lo conecta todo sin editar los archivos del combate |
| `tools/test-bending.mjs` | pruebas (incluidas en `npm test`) |
| `tools/bending-lab.html` | laboratorio: botones «Elemental →U / ↓U / aire» con efectos reales |
| `tools/capturar-tecnicas.cjs` | tiras de fotogramas de secuencias reales (requiere Playwright) |

No se modificó `fighter.js`, `match.js`, `ai.js`, `scene-manager.js`, `menu-manager.js` ni `vfx.js`.

## Conectarlo con F7
Igual que el triángulo elemental: copiar el paquete y `node tools/apply-elements.mjs` (instala las dos cosas). Ver docs/ELEMENTOS.md → «Conectarlo con la versión F7».

El gancho se apoya en nombres que existen desde F4 y que F7 no debería haber cambiado: `scene.startMatch(..., opts.moves)`, `Fighter.prototype.update/_choose/_can`, `CpuBrain.prototype.think`, `match.step/proj/vfx/v[].c.anim`. Si alguno no existe, la consola lo avisa con `[control elemental]` y el resto sigue funcionando. Si F7 crea un combate sin `scene.startMatch`, basta con llamar a `scene.__bending.apply(match)` y `scene.__elements.apply(match)` tras crearlo.

Para un guerrero nuevo: añade su bloque en `data/bending.json` y sus 3 clips en `bending-clips.js` (si falta el clip, la técnica funciona igual con la pose base).
