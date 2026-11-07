// Paletas alternativas. Solo cosmético.
//  - Paletas nuevas (con "slots"): recolorean colores concretos de la textura; piel, cabello y contornos no cambian.
//  - Paletas antiguas (solo "hue"/"sat"): rotación de matiz de toda la textura.
import { PALETTE_MODELS } from './palette-models.js';

const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const lum = (r, g, b) => (.299 * r + .587 * g + .114 * b) / 255;
const HEAD_ONLY = ['band', 'bandGold', 'pom']; // ranuras que solo existen en la textura de la cabeza (corona de Terra)
const NEAR = 40, FAR = 80; // distancia (RGB) hasta la que un pixel se considera de esa ranura, y a partir de la cual no se toca

export function hueShift(px, hue, sat = 1) { // px: Uint8ClampedArray RGBA, se modifica en sitio
  const a = hue * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
  const m = [.213 + c * .787 - s * .213, .715 - c * .715 - s * .715, .072 - c * .072 + s * .928,
    .213 - c * .213 + s * .143, .715 + c * .285 + s * .140, .072 - c * .072 - s * .283,
    .213 - c * .213 - s * .787, .715 - c * .715 + s * .715, .072 + c * .928 + s * .072];
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] === 0) continue;
    const r = px[i], g = px[i + 1], b = px[i + 2];
    let R = m[0] * r + m[1] * g + m[2] * b, G = m[3] * r + m[4] * g + m[5] * b, B = m[6] * r + m[7] * g + m[8] * b;
    if (sat !== 1) { const l = .299 * R + .587 * G + .114 * B; R = l + (R - l) * sat; G = l + (G - l) * sat; B = l + (B - l) * sat; }
    px[i] = R; px[i + 1] = G; px[i + 2] = B;
  }
}

// Recolorea por ranuras: cada pixel se asigna a su color de referencia más cercano; si esa ranura tiene color nuevo,
// se aplica conservando el sombreado (más oscuro/claro que el principal => más oscuro/claro el nuevo).
// opts.only: lista de ranuras que sí se aplican (el resto queda intacto). opts.flat: ranuras sin sombreado (brillo uniforme).
export function applyPalette(px, model, slots, opts = {}) {
  const refs = [];
  for (const [name, list] of Object.entries(model.slots)) {
    if (opts.only ? !opts.only.includes(name) : HEAD_ONLY.includes(name)) continue; // solo compiten las ranuras pedidas (y los colores fijos)
    const t = slots[name] ? hex(slots[name]) : null, mainL = Math.max(.04, lum(...hex(list[0])));
    for (const s of list) refs.push({ c: hex(s), t: t && (!opts.only || opts.only.includes(name)) ? t : null, mainL, flat: !!opts.flat?.includes(name) });
  }
  for (const s of model.keep) refs.push({ c: hex(s), t: null, mainL: 1 });
  const memo = new Map(); // las texturas son de colores planos: pocos colores distintos => muy rápido
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] === 0) continue;
    const r = px[i], g = px[i + 1], b = px[i + 2], key = (r << 16) | (g << 8) | b;
    let o = memo.get(key);
    if (o === undefined) {
      let best = null, bd = Infinity;
      for (const f of refs) { const d = (f.c[0] - r) ** 2 + (f.c[1] - g) ** 2 + (f.c[2] - b) ** 2; if (d < bd) { bd = d; best = f; } }
      o = null;
      if (best && best.t) {
        const d = Math.sqrt(bd), w = d <= NEAR ? 1 : d >= FAR ? 0 : (FAR - d) / (FAR - NEAR);
        if (w > 0) { const k = best.flat ? 1 : Math.min(1.8, Math.max(.25, lum(r, g, b) / best.mainL)); o = [0, 1, 2].map(j => [r, g, b][j] + (best.t[j] * k - [r, g, b][j]) * w); }
      }
      memo.set(key, o);
    }
    if (o) { px[i] = o[0]; px[i + 1] = o[1]; px[i + 2] = o[2]; }
  }
}

export function recolorPixels(px, pal, charId, only = null) {
  const model = PALETTE_MODELS[charId];
  if (pal.slots && model) applyPalette(px, model, pal.slots, { only, flat: pal.flat });
  else if (pal.hue) hueShift(px, pal.hue, pal.sat ?? 1);
}

export function recolorImage(img, pal, charId, only = null, maxSize = 1024) { // devuelve un canvas o null si no se pudo
  try {
    const w0 = img.width, h0 = img.height; if (!w0 || !h0) return null;
    const k = Math.min(1, maxSize / Math.max(w0, h0)), cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.round(w0 * k)); cv.height = Math.max(1, Math.round(h0 * k));
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, cv.width, cv.height);
    const id = ctx.getImageData(0, 0, cv.width, cv.height); recolorPixels(id.data, pal, charId, only); ctx.putImageData(id, 0, 0);
    return cv;
  } catch (e) { console.warn('[palette] no se pudo recolorear la textura', e); return null; }
}
