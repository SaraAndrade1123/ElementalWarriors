// Chroma ESPEJO (lógica pura, sin Three.js): datos para distinguir al segundo guerrero en un duelo del mismo personaje.
// Funciona con cualquier guerrero: si no tiene entrada en data/mirror.json usa «default» y calcula su color de aura
// girando el suyo. Así un diseño personalizado nuevo tiene espejo sin escribir nada.
export const DEFAULT_MIRROR = Object.freeze({ hue: 165, sat: 1.1, val: .9, keepSkin: true, tint: '#ffffff', tintAmount: .18, rim: '#e8f4ff', rimStrength: .65, rimPower: 2.4 });

const hex2rgb = h => { const n = parseInt(String(h).replace('#', ''), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };
const rgb2hex = ([r, g, b]) => '#' + [r, g, b].map(v => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0')).join('');
export function rgb2hsv([r, g, b]) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; let h = 0;
  if (d) h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [((h * 60) + 360) % 360, mx ? d / mx : 0, mx];
}
export function hsv2rgb([h, s, v]) {
  const c = v * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = v - c, k = Math.floor(((h % 360) + 360) % 360 / 60);
  const [r, g, b] = [[c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x]][k]; return [r + m, g + m, b + m];
}
export const hueOf = hex => rgb2hsv(hex2rgb(hex))[0];
export const hueDist = (a, b) => { const d = Math.abs(a - b) % 360; return Math.min(d, 360 - d); };
export function rotateHex(hex, deg, sat = 1, val = 1) { const [h, s, v] = rgb2hsv(hex2rgb(hex)); return rgb2hex(hsv2rgb([(h + deg + 360) % 360, Math.min(1, s * sat), Math.min(1, v * val)])); }

// Especificación final para un guerrero (def de data/characters.json).
export function mirrorSpec(def, data) {
  const base = { ...DEFAULT_MIRROR, ...(data?.default || {}) }, own = data?.chars?.[def?.id] || {};
  const spec = { ...base, ...own, id: def?.id };
  const fx0 = def?.fx || { color: '#47b3ff', light: '#47b3ff' };
  spec.fx = { ...fx0, ...(own.fx || { color: rotateHex(fx0.color, spec.hue, 1.05), light: rotateHex(fx0.light, spec.hue, 1.05) }) };
  if (!own.rim && !data?.default?.rim) spec.rim = spec.fx.color;
  return spec;
}
// Nombre visible del espejo: texto propio (mirror.<id>.name) o genérico (mirror.generic con {name}).
export function mirrorName(def, t) {
  const k = `mirror.${def?.id}.name`, own = t?.(k); if (own && own !== k) return own;
  const g = t?.('mirror.generic', { name: def?.name }); return g && g !== 'mirror.generic' ? g : `${def?.name} ✦`;
}
