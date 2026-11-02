# Armas de la tienda, rompeguardia y combate sin arma (v0.9.0)

## Idea
- Los golpes normales (ligero, medio, pesado, agachado, aéreo, especial, Resonancia y control elemental) se hacen **sin arma**:
  puños, palmas y patadas con el elemento de cada guerrero.
- Las **armas** se compran en la Tienda (pestaña *Armas*) con **Rose Gold**. No son de ningún guerrero: se compran una vez
  y cualquiera puede equipar una. Cada arma da **una técnica concreta** en su propio botón y **una mejora pasiva**.
- La técnica tiene animación completa: **sacar** el arma (la mano va a la funda de la cintura o de la espalda),
  **usarla** como se usa esa arma, y **guardarla, lanzarla, recogerla o desvanecerla** según el arma.
- El arma equipada se ve envainada durante el combate; si se lanza (cuchillos, boleadoras) o se desvanece (arco),
  vuelve a aparecer cuando termina su recarga; el bumerán reaparece cuando vuelve a la mano.

## Botones
| | Solo | Versus J1 | Versus J2 | Táctil |
|---|---|---|---|---|
| Arma | **O** (o N) | **E** | **6** del teclado numérico o **K** | ✠ |
| Rompeguardia | **K + L** a la vez | **G + H** | **2 + 3** (o . + -) | M+H |

## Catálogo
| Arma | Precio | Técnica | Después | Mejora |
|---|---|---|---|---|
| Cuchillos arrojadizos | 300 | 3 cuchillos en abanico (alto, medio y bajo) | se lanzan | +10 % Resonancia, +4 % velocidad |
| Boleadoras | 350 | las voltea y las lanza en arco: enredan (aturdimiento largo) y derriban a quien salta | se lanzan | +5 % velocidad |
| Bumerán de guerra | 450 | golpea a la ida y a la vuelta mientras sigues atacando | vuelve a la mano | +15 % Resonancia |
| Daga de contraataque | 500 | **contraataque**: guardia invulnerable; si el rival ataca o dispara, lo desarma y responde con un corte reforzado | se guarda | −30 % desventaja elemental, +5 % defensa |
| Maza de piedra | 550 | golpe alto desde arriba: hay que bloquearlo de pie, destroza la guardia y derriba | se guarda | +8 % daño, −4 % velocidad |
| Abanico de guerra | 600 | **contraataque**: devuelve los proyectiles del rival y lo empuja lejos | se guarda | −50 % desventaja elemental |
| Espadas de garfio | 650 | engancha a media distancia y atrae al rival (castiga a quien pelea de lejos) | se guardan | −25 % desventaja elemental, +5 % daño |
| Arco recurvo | 700 | flecha muy rápida y potente | se desvanece | +5 % daño |

«Desventaja elemental» = el triángulo (Agua > Fuego > Aire > Agua): con −50 %, un guerrero en desventaja recupera la mitad
del daño que pierde y recibe la mitad del daño extra del rival. Tierra sigue siendo neutra (100 %).

## Se adapta al elemento de quien la usa
| Elemento | Efecto en la técnica del arma |
|---|---|
| Fuego | +15 % de daño |
| Agua | +25 % de aturdimiento al golpear (+15 % al bloquear) |
| Viento | +15 % de alcance, +20 % de velocidad del proyectil, +30 % de empuje |
| Tierra | +50 % de desgaste de guardia y aguanta un golpe durante el arranque |

Los efectos visuales (estela, chispas al sacar, liberación, ráfaga del abanico, golpe de la maza) usan el color y los
efectos del elemento de quien la lleva. Un guerrero personalizado con `"element": "air"` se trata como viento.

## Rompeguardia (todos los guerreros)
Doble empuje de palmas con todo el peso. Es **lento** (18 fotogramas de arranque, se ve venir): si el rival se protege,
le rompe la guardia (queda aturdido y abierto a un combo). Se gana con un golpe rápido o esquivándolo (retroceso, salto).
La CPU lo usa contra quien se protege demasiado y, a la vez, intenta interrumpir el tuyo.

## CPU
En Difícil y Experto la CPU lleva un arma (siempre la misma para cada rival) y la usa según su función:
de lejos (cuchillos, bumerán, arco), contra saltos (boleadoras), para contraatacar (daga, abanico), para atraer
(garfios) o contra la guardia (maza). El maniquí de entrenamiento no lleva arma.

## Archivos
- `data/weapons.json` — catálogo (técnica con el formato de moves.json, recarga, mejoras, reglas por elemento).
- `data/items.json` — precio en la tienda (`"type": "weapon"`, `"char": "*"`).
- `js/game/weapon-arts.js` — lógica pura: botón, recarga, contraataque, reflejo, bumerán, mejoras, IA.
- `js/game/animation/weapon-art.js` — modelos procedurales, fundas y animaciones (sacar → usar → guardar).
- `js/game/weapon-vfx.js` — proyectiles con forma de arma y efectos por elemento.
- `js/elements/weapon-hook.js` — conexión con el combate, el animador y el HUD (medallón con la recarga).
- `js/ui/weapons-ui.js` — Tienda › Armas y Colección.
- Pruebas: `tools/test-weapons.mjs`.

## Añadir un arma
1. Entrada en `data/weapons.json` (`kind` = uno de los modelos: knives, bola, boomerang, dagger, fan, hooks, mace, bow).
2. Objeto en `data/items.json` con su precio y `"char": "*"`.
3. Textos `item.<id>`, `wpn.<id>.power`, `wpn.<id>.passive` en es/en.
Para un modelo nuevo: añadir su constructor en `MODELS` y su animación en `buildArt` (weapon-art.js).
