// ¿Hay un teclado físico? Ningún navegador lo dice directamente, así que se deduce:
//  · un equipo cuyo puntero principal es fino (ratón / trackpad) casi siempre tiene teclado → sí;
//  · en táctiles (celular, tableta) se confirma en cuanto llega una pulsación de tecla REAL: los teclados en pantalla
//    envían key «Unidentified» / keyCode 229 / code vacío, un teclado Bluetooth o USB envía códigos físicos (KeyA, ArrowUp…).
//  · si el teclado se desconecta (navigator.keyboard no avisa), basta recargar: la detección vuelve a empezar.
// onKeyboard(fn) avisa la primera vez que se detecta uno (la pantalla de Versus se habilita sola sin recargar).
const PHYS = /^(Key[A-Z]|Digit\d|Arrow(Up|Down|Left|Right)|Space|Enter|Escape|Tab|Shift(Left|Right)|Control(Left|Right)|Numpad\d)$/;
let seen = false; const subs = new Set();

export const isPhysicalKey = e => !!e && !e.isComposing && e.keyCode !== 229 && e.key !== 'Unidentified' && PHYS.test(e.code || '');

export function finePointer(mm = globalThis.matchMedia) {
  try { return !!mm && mm('(pointer: fine)').matches && !mm('(pointer: coarse)').matches; } catch { return false; }
}

// Verdadero si hay (o probablemente hay) un teclado físico conectado.
export const hasKeyboard = () => seen || finePointer();

export function noteKey(e) {
  if (seen || !isPhysicalKey(e)) return false;
  seen = true; for (const fn of subs) { try { fn(); } catch (err) { console.warn('[teclado]', err); } } return true;
}
export const onKeyboard = fn => { subs.add(fn); return () => subs.delete(fn); };
export const _resetKeyboard = () => { seen = false; subs.clear(); }; // pruebas

if (typeof addEventListener === 'function') addEventListener('keydown', noteKey, { capture: true, passive: true });
