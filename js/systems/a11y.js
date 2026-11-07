// ACCESIBILIDAD Y PRESENTACIÓN (F9): estado compartido que leen los sistemas de presentación (cámara, destellos,
// cinemáticas) y clases/variables del documento para la interfaz. Nunca cambia las reglas del combate.
//   camK     multiplica el temblor, el acercamiento y la inclinación de la cámara (0 = efectos de cámara apagados)
//   flashK   multiplica los destellos de pantalla; reduceFlash además quita el fotograma invertido de los impactos
//   textMul  velocidad del texto de los diálogos (lento 0,6 · normal 1 · rápido 1,8 · instantáneo)
//   subtitles, altCues: ver applyA11y
export const A11Y = { camK: 1, flashK: 1, reduceFlash: false, textMul: 1, subtitles: true, altCues: false, outlines: true };
const SPEED = { slow: .6, normal: 1, fast: 1.8, instant: 999 };

export function applyA11y(s, doc = globalThis.document) {
  A11Y.camK = !s.camFx ? 0 : s.calmCam ? .3 : 1;
  A11Y.reduceFlash = !!s.reduceFlash; A11Y.flashK = s.reduceFlash ? .25 : 1;
  A11Y.textMul = SPEED[s.textSpeed] ?? 1; A11Y.subtitles = s.subtitles !== false; A11Y.altCues = !!s.altCues; A11Y.outlines = s.outlines !== false;
  if (!doc?.documentElement) return A11Y;
  const root = doc.documentElement, body = doc.body;
  root.style.fontSize = s.uiScale && s.uiScale !== 1 ? `${Math.round(16 * s.uiScale * 10) / 10}px` : '';
  root.style.setProperty('--tsz', String(s.tSize ?? 1)); root.style.setProperty('--top', String(s.tOpacity ?? 1));
  if (body) {
    body.classList.toggle('hc', !!s.contrast);          // alto contraste
    body.classList.toggle('altcues', !!s.altCues);      // indicadores con forma y texto, no solo color
    body.classList.toggle('nosubs', s.subtitles === false);
    body.classList.toggle('touch-swap', s.tLayout === 'left');
    body.classList.toggle('noflash', !!s.reduceFlash);
  }
  return A11Y;
}
// Cuántos caracteres del diálogo se ven tras «sec» segundos a «cps» caracteres por segundo.
export const typed = (sec, cps = 46) => Math.floor(sec * cps * A11Y.textMul);
