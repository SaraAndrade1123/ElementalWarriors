# Personajes personalizados (preparado desde v0.8.0)

Los cuatro modelos actuales (Ignis, Aqua, Terra, Zephyr) son **provisionales**. Todo lo que se añadió en v0.8.0
se hizo para que siga funcionando cuando se sustituyan por diseños propios, o cuando se añadan guerreros nuevos.

## Qué hay que aportar por guerrero

| Archivo | Obligatorio | Qué contiene |
|---|---|---|
| `data/characters.json` → `roster[]` | Sí | `id`, `name`, `element` (`fire` / `water` / `air` / `earth`), `model` (ruta .glb), `height`, `yaw`, `fx` (color del aura), `stats`, `provisional` (créditos del modelo) |
| `assets/characters/<id>.glb` | Sí (si falta se usa una figura de reserva) | Modelo con esqueleto **Bip001** (los nombres de huesos de `js/game/animation/rig.js`). Pelo/telas con prefijo `hair`, `cloth`, `skirt`… se mueven solos con muelles |
| `data/localization/{es,en}.json` | Recomendado | `char.<id>.*` (alias, historia, transformación) |
| `data/bending.json` | Opcional | Técnicas de control elemental propias; si no hay, usa las de su elemento |
| `data/mirror.json` → `chars.<id>` | Opcional | Chroma especial del duelo espejo (ver abajo) |
| `data/items.json` | Opcional | Paletas de la tienda: recolorean colores concretos de **su** textura, así que hay que rehacerlas para cada modelo nuevo |
| `js/game/animation/weapons.js` → `WEAPONS.<id>` | Opcional | Arma procedural; sin entrada el guerrero pelea sin arma |

El triángulo elemental, el control elemental, la IA, los modos de F7 y la interfaz leen el `element` y el `id`:
no hay nombres de los guerreros actuales escritos en esos sistemas.

## Duelo espejo (mismo guerrero contra sí mismo)

Cuando los dos lados eligen al mismo guerrero, el segundo es un **clon animado independiente** (SkeletonUtils)
con un **chroma exclusivo** aplicado por shader (`js/game/mirror.js`). El shader trabaja sobre el color final
del material, no sobre una textura concreta, por eso sirve para cualquier modelo:

- gira el tono, ajusta saturación y brillo; los tonos de piel se conservan (`keepSkin`);
- añade un contorno luminoso (fresnel) del color del aura para distinguirlo en movimiento;
- parte siempre de la textura **original**, aunque el jugador lleve una paleta de la tienda;
- el arma (forma parte del modelo), el cartel de la pausa, el nombre del HUD y la barra de Resonancia del espejo usan su
  propio color; los impactos y las técnicas conservan los efectos de su elemento (es el mismo elemento en los dos lados).

`data/mirror.json`:

```json
{
  "default": { "hue": 165, "sat": 1.1, "val": 0.9, "keepSkin": true, "rimStrength": 0.65, "rimPower": 2.4 },
  "chars": {
    "nuevo": { "hue": 120, "rim": "#7dffcf", "fx": { "color": "#7dffcf", "light": "#2fd8a0" } }
  }
}
```

- Sin entrada propia, el guerrero usa `default` y su color de aura se calcula girando el suyo.
- Sin el archivo, también funciona (valores por defecto en `js/systems/mirror-spec.js`).
- Nombre visible: `mirror.<id>.name` en los textos (p. ej. «Ignis · Llama Jade»); si no existe, «Eco de {name}».
- Regla de diseño: el chroma espejo debe quedar a **25° de tono o más** del original y de todas las paletas de la
  tienda de ese guerrero. `tools/test-mirror.mjs` lo comprueba automáticamente para cada guerrero del roster.

## Transformación (F5)

La transformación llega en F5. El sistema de espejo no depende de la forma: `applyChroma(holder, spec)` se
aplica a cualquier grupo de mallas, así que la forma transformada de un espejo podrá recibir el mismo chroma
llamando a esa función sobre el modelo nuevo. El desafío «Transformación» sigue bloqueado y muestra «F5».
