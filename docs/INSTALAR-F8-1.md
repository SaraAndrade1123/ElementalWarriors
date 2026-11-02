# Actualización F8.1 — Paletas llamativas (3 por guerrero)

Cambia las paletas de **girar el matiz** a **recolorear colores concretos** de la textura (la ropa, los adornos y los ojos). La piel, el cabello y los contornos no se tocan. Cada paleta además cambia el color del aura, las partículas y los acentos de la interfaz.

| Guerrero | Paletas (precio en Rose Gold) |
|---|---|
| Ignis | **Fuego Azul** (como el de Azula, 300) · Fénix Dorado (200) · Llama Violeta (400) |
| Aqua | **Sangre Carmesí** (300) · Abismo Neón (400) · Marea Esmeralda (200) |
| Terra | **Lava** (rojo magma y naranja fundido, 300) · Cristal de Zafiro (200) · Obsidiana (400) |
| Zephyr | **Estado Avatar** (ojos y flecha blancos brillantes, 300) · Tormenta Violeta (200) · Brisa Dorada (400) |

## Paso a paso
1. **Descomprime** `elemental-warriors-f8-1-patch.zip`.
2. **Copia sus carpetas dentro de tu proyecto** (donde está `index.html`), combinando carpetas.
   - **Se reemplazan 5 archivos** del paquete anterior (F8): `js/systems/palette.js`, `js/systems/shop-system.js`, `js/ui/meta-panels.js`, `data/items.json`, `tools/test-progression.mjs`. Si los editaste a mano, guarda antes una copia.
   - **Se añaden:** `js/systems/palette-models.js`, `tools/apply-f8-1.mjs`, `patch/locales-f8-1/`, `docs/`.
   - No se toca nada de tu combate ni de tus animaciones.
3. En una terminal, **en la carpeta del proyecto**, ejecuta:
   ```
   node tools/apply-f8-1.mjs
   ```
   Hace solo esto (se puede repetir sin duplicar nada):
   - `data/localization/es.json` y `en.json`: añade 12 nombres de paletas.
   - `js/game/scene-manager.js`: reemplaza el método `setPalette` por el nuevo, añade `_tintFx` (cambia el color del aura/partículas) y hace que el combate use los colores de la paleta equipada.
   - `docs/CHECKLIST.md`: añade una nota.
4. Comprueba: `npm run check` (debe decir **OK**) y `npm test` (debe terminar en **«Todas las pruebas de F8 pasaron»**).
5. Prueba: `npm start` y abre **http://localhost:5173/?dev=1**.
   - **Tienda** → «+500 Rose Gold (solo desarrollo)» → «Vista previa» en cada paleta (no gasta nada) → «Comprar» → «Equipar».
   - Cambia de guerrero con ← → y revisa las 12.
   - Si ya habías comprado paletas antiguas, siguen en **Colección** (ya no se venden).

## Si el script avisa «no encontré…» (tu scene-manager.js cambió)
Hazlo a mano en `js/game/scene-manager.js`:
- Reemplaza todo el método `setPalette` (desde el comentario `// Paleta alternativa…` hasta antes de `show(id) {`) por el bloque `NEW_METHOD` que está dentro de `tools/apply-f8-1.mjs` (cópialo tal cual, sin las comillas invertidas externas).
- En `show(id)`, reemplaza las dos líneas que empiezan en `this.fx = c.def.fx;` y `this.tint.light.set(...)...` por: `this._tintFx(c);`
- En `startMatch`, cambia `a.def.fx.color` por `(a.fx ?? a.def.fx).color` y `a.def.fx.light` por `(a.fx ?? a.def.fx).light`.

## Ajustar colores sin tocar código
Todo está en `data/items.json`:
- `slots`: color nuevo de cada parte (`coat`, `cloth`, `trim`, `eyes` en Ignis; `main`, `shade`, `light`, `white`, `eyes` en Aqua; `main`, `shade`, `dark`, `cream`, `creamShade`, `eyes` en Terra; `main`, `red`, `brown`, `trim`, `arrow`, `eyes` en Zephyr). El sombreado original se conserva automáticamente.
- `flat: ["eyes"]`: hace que esa parte tenga brillo uniforme (así brillan los ojos del Estado Avatar).
- `fx`: color de aura y partículas. `swatch`: los 3 colores del rombo en la tienda. `price`: el precio.

## Importante
- Los colores se eligieron midiendo las texturas reales de tus 4 modelos y revisando el resultado sobre ellas (`docs/paletas-vista-previa.png`). **No pude ver los modelos en 3D**: si una parte queda rara en el juego, dime cuál y ajusto el color.
- Si cambias o actualizas un modelo, vuelve a medir sus colores en `js/systems/palette-models.js`.
- Son solo cosméticas: no cambian estadísticas.
