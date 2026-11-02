# Triángulo elemental y elemento neutro

## Reglas
| Atacante | contra 💧 Agua | contra 🔥 Fuego | contra 🌪️ Aire | contra 🪨 Tierra |
|---|---|---|---|---|
| 💧 **Agua** (Aqua) | 100 % | **120 %** ▲ | 80 % ▼ | 100 % |
| 🔥 **Fuego** (Ignis) | 80 % ▼ | 100 % | **120 %** ▲ | 100 % |
| 🌪️ **Aire** (Zephyr) | **120 %** ▲ | 80 % ▼ | 100 % | 100 % |
| 🪨 **Tierra** (Terra) | 100 % | 100 % | 100 % | 100 % |

- 💧 Agua le gana a 🔥 Fuego · 🔥 Fuego le gana a 🌪️ Aire · 🌪️ Aire le gana a 💧 Agua.
- 🪨 **Tierra es el elemento neutro**: no tiene ventajas ni desventajas contra ningún tipo e inflige y recibe siempre daño estándar (100 %).
- Quien tiene **ventaja** inflige 120 % y recibe 80 % (porque su rival, en desventaja, inflige 80 %).

## Qué estadísticas cambia (según el rival de ESE combate)
| Estadística | Ventaja | Neutro | Desventaja | Dónde actúa |
|---|---|---|---|---|
| Daño que inflige | 120 % | 100 % | 80 % | golpes, técnicas, reforzadas, proyectiles, lanzamientos y golpes absorbidos por armadura (`fighter.atk`) |
| Daño al bloquear (chip) | 120 % | 100 % | 80 % | campo `chip` de cada golpe y proyectil |
| Desgaste de guardia | 120 % | 100 % | 80 % | barra de guardia del rival al bloquear (`guardDmg`) |
| Ganancia de Resonancia | 110 % | 100 % | 90 % | toda la Resonancia que gana (`gain()`) |

**No cambian** los tiempos (salida, ventana activa, recuperación), el alcance, el aturdimiento ni el empuje: los combos y las cancelaciones funcionan igual en todos los enfrentamientos. Las estadísticas base del roster (vida, velocidad, fuerza, defensa, alcance) tampoco cambian: los multiplicadores se aplican encima, al empezar cada combate.

Todos los números están en `data/elements.json` (`modifiers`). Para cambiar el equilibrio no hace falta tocar código. Un guerrero nuevo usa el campo `"element"` de `data/characters.json`; si no lo tiene, es neutro.

## Dónde se ve
- **Luchadores**: triángulo con el elemento del guerrero resaltado, a quién le gana y contra quién pierde (Tierra: «Nadie (neutro)»).
- **Jugar / Entrenamiento**: cada rival muestra ▲ (ventaja), ▼ (desventaja) o = (neutro), y una tabla «Enfrentamiento elemental» con los porcentajes de los dos.
- **Combate**: insignia de elemento y relación junto a cada nombre; aviso «¡VENTAJA ELEMENTAL!» al empezar cada ronda; «¡EFICAZ!» / «RESISTIDO» al abrir un combo (como mucho cada 3 s por lado).
- **F1 (depuración)**: elemento, relación, multiplicadores y `atk` efectivo de cada luchador.
- Con `?dev=1`, en la consola: `ewElements.matchup('ignis', 'aqua')`.

## Archivos
| Archivo | Qué es |
|---|---|
| `data/elements.json` | reglas (quién gana a quién, neutro, multiplicadores) |
| `js/game/elements.js` | lógica pura (sin Three.js ni DOM): relación, aplicar/deshacer sobre un `Fighter`, validación |
| `js/elements/element-hook.js` | gancho: aplica al combate, avisos, HUD, menús y depuración |
| `css/elements.css` | estilos de insignias, tabla y triángulo |
| `patch/locales-elements/` | textos es/en (el gancho también trae textos de respaldo) |
| `tools/apply-elements.mjs` | instalador idempotente (triángulo + control elemental) |
| `tools/test-elements.mjs` | 47 comprobaciones (incluidas en `npm test`) |

No se modificó `fighter.js`, `match.js`, `scene-manager.js`, `menu-manager.js` ni `ai.js`.

---

## Conectarlo con la versión F7 (o cualquier otra)
El sistema está hecho para no depender de cómo F7 haya cambiado los modos:
- Se engancha a `scene.startMatch(...)`: **todo combate que se cree por ahí** (arcade, versus local, contra IA, supervivencia, historia, entrenamiento) recibe las ventajas.
- Cada paso de simulación comprueba si los luchadores de `match.f` cambiaron; si un modo cambia de rival dentro del mismo combate (p. ej. supervivencia), **se recalcula solo** y nunca se acumula.
- Lo único que necesita de `Fighter` es `def`, `atk`, `moves` y `gain()`, que existen desde F3.

### Paso a paso
1. Copia dentro de la carpeta del proyecto F7 (combinando carpetas) el contenido del paquete `elemental-warriors-elementos-F7.zip` (triángulo elemental + control elemental).
2. En la carpeta del proyecto: `node tools/apply-elements.mjs`
   - Añade `"element"` a cada guerrero en `data/characters.json`.
   - Añade los textos que falten en `data/localization/es.json` y `en.json`, y renombra el elemento de Zephyr a «Aire».
   - Añade a `js/main.js` dos `import` y las llamadas `installElements({ menu, scene, roster })` e `installBending({ menu, scene, roster })` justo después de `installAudio(...)`.
   - Actualiza la ayuda del HUD (si no la cambiaste) y añade las dos pruebas a `npm test`.
   - Si ya habías instalado el triángulo elemental, solo añade lo que falta.
3. Comprueba: `npm run check` y `npm test` (debe terminar en «Todas las pruebas del control elemental pasaron»).

### Si el instalador avisa que no encontró dónde instalar
Añade a mano en `js/main.js`:
```js
import { installElements } from './elements/element-hook.js';
import { installBending } from './elements/bending-hook.js';
// ...dentro de boot(), después de crear `menu` y `scene`:
const elements = installElements({ menu, scene, roster });
const bending = installBending({ menu, scene, roster });
```
Si en F7 la variable del roster tiene otro nombre, pásala con ese nombre (`roster: miLista`).

### Pantallas nuevas de F7
Los botones del menú cuyo texto es el nombre de un guerrero reciben su icono automáticamente, y en las páginas `play`, `training`, `versus`, `arcade`, `survival` o `cpu` también la marca ▲ / ▼ / = y la tabla de enfrentamiento (si hay un botón `.cta`). Si una pantalla de F7 elige a los luchadores de otra forma, usa la API:
```js
const el = scene.__elements;                 // o el valor que devuelve installElements
el.pair = () => [roster[a], roster[b]];      // cómo saber qué dos guerreros están elegidos
contenedor.append(el.panel('ignis', 'aqua'));// tabla de enfrentamiento
boton.append(el.badge('terra'));             // insignia de elemento
el.matchup('zephyr', 'aqua');                // datos: [{ el, rel, dealt, taken, mods }, {...}]
el.apply(scene.match);                       // forzar (si un modo crea un Match sin scene.startMatch)
```
Si F7 crea el `Match` sin pasar por `scene.startMatch`, basta con llamar a `el.apply(match)` una vez después de crearlo.
