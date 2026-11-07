import { getLang } from '../systems/localization.js';

// (v1.11) cifras cortas para la ficha del jugador: 999 · 1,2k · 12k · 1,2M (el separador decimal sigue al idioma)
export const shortNum = n => { n = Math.max(0, Math.floor(+n || 0)); const f = (v, u) => (v < 10 ? (Math.floor(v * 10) / 10).toLocaleString(getLang?.() || 'es', { maximumFractionDigits: 1 }) : Math.floor(v).toString()) + u;
  return n < 1000 ? String(n) : n < 1e6 ? f(n / 1e3, 'k') : n < 1e9 ? f(n / 1e6, 'M') : f(n / 1e9, 'B'); };
