# Audio — cómo conectarlo con F3 (combate) y las animaciones

Todo el sonido se **sintetiza por código** (Web Audio): no hay archivos de audio, así que no hay licencias que revisar.
El paquete **solo añade archivos nuevos** y no edita `fighter.js`, `match.js`, `input.js`, `arena.js` ni `scene-manager.js`.

## Qué ya suena sin que hagas nada
Sonidos de interfaz (tic, clic, confirmar, volver, error), cambio de guerrero con el timbre de su elemento, música del menú
que sigue al guerrero elegido, música de combate según el escenario, pasos/salto/aterrizaje del combate actual (leyendo
`scene.match.f[i].air / vy / x / walk / state`), atenuación al pausar, compra en la tienda y logros desbloqueados.

## Lo que F3 debe llamar (una línea por evento)
Sin importar nada, con un evento (funciona aunque el audio no esté instalado):
```js
dispatchEvent(new CustomEvent('ew:sfx', { detail: { name: 'hit_heavy', element: 'fire', x: foe.x } }));
```
o, si prefieres, con el objeto: `audio.sfx('hit_heavy', { element: 'fire', x: foe.x })` (en `main.js` es `installAudio(...)`; con `?dev=1` está en `window.ewAudio`).

| Evento del combate | Efecto | Notas |
|---|---|---|
| Ataque que no conecta | `whiff_light`, `whiff_heavy` | al empezar los fotogramas activos |
| Golpe conectado | `hit_light`, `hit_medium`, `hit_heavy` | pasa `element` del **atacante**: añade crepitar / burbujas / roca / viento |
| Golpe bloqueado | `block` · ruptura de guardia: `guard_break` | |
| Agarre / esquiva | `throw` · `dodge` | |
| Proyectil lanzado | `projectile` (+`element`) · al explotar: `explosion` | |
| Técnica especial / transformación | `special` · `transform` (+`element`) | `transform` dura ~1,7 s: el golpe final cae en 1,25 s |
| Fin de ronda | `ko` · `round_end` · `victory` / `defeat` | `round_start` ya suena al empezar el combate |
| Cuenta atrás | `countdown_tick` | |

`x` es la posición lógica (−8,2…8,2): panea el sonido a izquierda/derecha. `vol` (0–1) y `rate` (tono) son opcionales.
Un mismo efecto no se repite antes de su `cd` (ms) y hay un máximo de 24 voces: los golpes pesados siempre pasan.

Música: `ew:music` → `{ element: 'fire'|'water'|'earth'|'wind'|…, mode: 'menu'|'battle' }`. Un elemento desconocido usa la pieza neutra.
Mapa guerrero→elemento: `ELEMENT_OF` en `js/audio/audio-hook.js` (añade ahí a los guerreros nuevos).

## Cambiar cómo suena
Abre **`audio-lab.html`** con el servidor local: botones para escuchar cada efecto (con selector de elemento) y cada pieza,
y «Medir todo», que renderiza sin conexión y muestra pico, RMS, duración y brillo (✓ si no satura ni está en silencio).
- Efectos: `js/audio/sfx-bank.js` (capas de datos: `osc`, `noise`, `crackle`, `bubbles`). `trim` iguala el volumen entre efectos.
- Música: `js/audio/music.js` (`TRACKS`: tempo, acordes, patrones de arpegio y de percusión).
Después de tocar números, pulsa «Medir todo» y ajusta `trim` si algún sonido satura (pico > 0,98).

## Volúmenes
Música y Efectos con control propio y «Silenciar todo» (Ajustes → Sonido; se guarda en `localStorage`, clave `ew.audio.v1`).
El bus de **voces** existe (`audio.voiceBus`) pero aún no tiene sonidos ni control en pantalla: se añade cuando haya voces.

## Edición manual de main.js (si `apply-audio.mjs` avisa)
Debajo de `import { installMetaPanels } from './ui/meta-panels.js';`:
```js
import { installAudio } from './audio/audio-hook.js';
```
Justo después de `installStages(scene, stages); installStageSelect(menu, { stages });`:
```js
const audio = installAudio({ menu, scene, meta, stages });
if (dev) window.ewAudio = audio;
```
Debe ir **después** de `installMetaPanels` e `installStages`, porque envuelve `menu.select`, `scene.startMatch/endMatch` y `meta.shop.buy`.

## Qué NO está verificado
Se midió nivel, silencio, saturación y brillo de los 30 efectos y las 10 versiones de música, y se probó el flujo completo en
Chromium sin GPU (≈4 FPS). **No se ha escuchado con altavoces**: si algo suena feo o desparejo, es cuestión de números en
`sfx-bank.js` / `music.js`. Safari/iOS no se ha probado (el audio arranca con el primer toque, como exige el sistema).
