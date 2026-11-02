# Instalar F8 (Rose Gold, Tienda, Colección, Progreso, Logros)

Este paquete **solo añade archivos nuevos**. No reemplaza ninguno de los tuyos, así que no pisa tu trabajo de F3 ni de animaciones.

## Paso a paso
1. **Descomprime** `elemental-warriors-f8-patch.zip`. Verás las carpetas `js`, `css`, `data`, `tools`, `patch` y `docs`.
2. **Copia esas carpetas dentro de tu proyecto** (la carpeta `elemental-warriors`, donde está `index.html`). Si el sistema pregunta, elige **combinar carpetas**. Nada se sobrescribe.
3. Abre una terminal **en la carpeta del proyecto** y ejecuta:
   ```
   node tools/apply-f8.mjs
   ```
   Este script hace solo estas ediciones mínimas (y se puede ejecutar varias veces sin duplicar nada):
   | Archivo tuyo | Qué cambia |
   |---|---|
   | `data/localization/es.json` y `en.json` | Añade 72 claves nuevas (no toca las que ya tienes) |
   | `data/menu.json` | Colección, Tienda y Progreso pasan a «disponibles» |
   | `js/main.js` | 3 cambios pequeños: importa los módulos, carga 3 JSON y los conecta al menú |
   | `js/game/scene-manager.js` | 3 cambios: importa `palette.js`, conserva el nombre del material y añade el método `setPalette` |
   | `package.json` | `npm test` ahora también corre las pruebas de F8 |
   | `tools/check.mjs` | También valida objetos y logros |
   | `docs/CHECKLIST.md` | Añade la fila F8 |
4. Comprueba: `npm run check` (debe decir **OK**) y `npm test` (debe terminar con **«Todas las pruebas de F8 pasaron»**).
5. Prueba en el navegador: `npm start` y abre **http://localhost:5173/?dev=1** (el `?dev=1` muestra botones de prueba).
   - **Tienda**: «+500 Rose Gold (solo desarrollo)» → «Vista previa» (el guerrero cambia de color sin gastar) → «Comprar» → «Confirmar compra» → «Equipar».
   - **Colección**: tus compras, con «Original» para volver al color base.
   - **Progreso**: «Simular victoria (solo desarrollo)» suma Rose Gold, estadísticas y logros. «Restablecer progreso» pide confirmación.
   - Cambia de guerrero con ← → dentro de Tienda/Colección y cambia el idioma en Ajustes: todo se redibuja.

## Si el script avisa «no encontré…» (tu archivo ya cambió)
Haz el cambio a mano. Cada bloque va en el punto indicado.

**`js/main.js`**
- Debajo de `import { Input } from './game/input.js';` agrega:
  ```js
  import { createMeta } from './systems/meta.js';
  import { installMetaPanels } from './ui/meta-panels.js';
  ```
- Reemplaza la línea `const [{ roster }, { items }] = await Promise.all([...]);` por:
  ```js
  const [{ roster }, { items }, shopData, achData, economy] = await Promise.all([json('data/characters.json'), json('data/menu.json'), json('data/items.json'), json('data/achievements.json'), json('data/economy.json')]);
  ```
- Justo antes de `let paused = false;` (ya con `menu` creado) agrega:
  ```js
  const dev = new URLSearchParams(location.search).has('dev');
  const meta = createMeta({ items: shopData.items, achievements: achData.achievements, economy });
  roster.forEach(r => scene.setPalette(r.id, meta.shop.paletteOf(r.id)));
  installMetaPanels(menu, { meta, scene, roster, dev });
  if (dev) window.ew = meta;
  ```

**`js/game/scene-manager.js`**
- Debajo del import de `GLTFLoader` agrega: `import { recolorImage } from '../systems/palette.js';`
- En `toToon`, cambia `m.dispose(); return n;` por `n.name = m.name; m.dispose(); return n;`
- Antes del método `show(id) {` pega el método `setPalette` (está completo en `tools/apply-f8.mjs`, dentro del tercer bloque de `patch('js/game/scene-manager.js', …)`).

## Qué NO toca este paquete
`fighter.js`, `match.js`, `input.js`, `arena.js`, el combate (F3) y las animaciones. Tu trabajo en paralelo queda intacto.

## Importante
- Las paletas giran el matiz de la textura del **cuerpo y la ropa**; la cabeza (rostro y cabello) no cambia. Si alguna paleta se ve mal, ajusta `hue` (grados) o `sat` en `data/items.json`; no hace falta tocar código.
- El guardado usa `localStorage`: sirve para tu proyecto, pero **no es seguro** para una economía competitiva en línea.
