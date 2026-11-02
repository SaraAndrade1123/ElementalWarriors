# Animación (v0.6.0)

Los modelos no traen clips: **todas las animaciones están hechas desde cero** con claves de pose sobre el esqueleto Biped,
resueltas con cinemática inversa (manos, pies) y física secundaria (pelo, telas).

| Archivo | Qué hace |
|---|---|
| `animation/styles.js` | Personalidad de cada guerrero: postura, guardia, respiración, rebote, carrera, peso al recibir golpes |
| `animation/attacks.js` | Los 15 clips de cada guerrero (12 de combate + presentación, victoria, levantarse) |
| `animation/locomotion.js` | Reposo, caminar (sin patinar), correr, agacharse, salto, doble salto con voltereta, retroceso, tumbado |
| `animation/reactions.js` | Guardia, golpe recibido (alterna lado), bloqueo, guardia rota, agarrado |
| `animation/director.js` | Elige y mezcla todo según el estado del luchador; emite estelas y efectos sincronizados |
| `animation/rig.js` | Aplica la pose al esqueleto (IK de piernas y brazos, inclinación de todo el cuerpo, ángulo absoluto de la hoja) |
| `animation/weapons.js` | Armas procedurales ancladas a la mano adelantada (cambian de mano al girarse, como en los juegos 2D) |
| `game/vfx.js` | Estelas, chispas, llamas, agua, rocas, viento y proyectiles |

## Personalidad en movimiento
- **Ignis** (impulsivo): rebota sobre las puntas con la espada apuntando al rival; cortes en arco amplios que terminan en llamas; corre con la espada arrastrando.
- **Aqua** (serena): la mano libre dibuja un ocho continuo; caderas ondulantes; molinetes y estocadas largas; planta la lanza en la victoria.
- **Terra** (firme): postura ancha y baja, respiración honda, pasos pesados, aterriza hundiéndose; golpes cortos con todo el peso; victoria con brazos cruzados. Los golpes le sacuden menos (70 %).
- **Zephyr** (provocador): de puntillas, cabeza ladeada; patada giratoria, volteretas, doble salto con mortal; le sacuden más (130 %); presentación con gesto de «ven».

## Cómo se crea un clip
Cada clave es `{ t, e, canal: valor }` (ver la lista de canales en `pose.js`). Los canales no nombrados vuelven solos a la pose
base viva (reposo, agachado, aire…), así un golpe se mezcla con lo que el cuerpo esté haciendo. `meta.hit` marca el impacto:
en combate el clip se re-temporiza para que ese instante caiga exactamente en la ventana activa de `moves.json`.
- Con espada/lanza, `hnFpitch` es el **ángulo absoluto de la hoja** en el plano de pantalla (0 adelante, 1.57 arriba, -1.57 abajo).
- Los cortes deben trazar arcos en el plano de pantalla (adelante/arriba): la cámara es lateral y los cortes «en profundidad» no se leen.
- `comPitch`/`comYaw` giran el cuerpo entero (volteretas, giros); con `ftFree: 1` los pies acompañan al cuerpo.

## Revisar una animación
- Navegador: `tools/anim-lab.html` (botones para cada golpe, reacción, derribo, lanzamiento, presentación y victoria; cámaras de perfil, frente, tres cuartos).
- Automático: `node tools/capturar-poses.cjs salida.png '{"p1":"terra","rows":[{"clip":"h","times":[.28,.38,.52]}]}'` genera una tira de fotogramas (requiere Playwright).
- `npm test` comprueba que los 60 clips existen, son finitos, son distintos entre guerreros, que el impacto cae en la ventana real y que no hay saltos bruscos de pose en 4 combates IA contra IA.
