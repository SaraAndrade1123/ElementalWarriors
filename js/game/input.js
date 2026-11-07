import { hasKeyboard } from '../systems/keyboard-detect.js';
// Teclado + botones táctiles → estado de entrada por jugador y por paso de simulación:
//   { x, down, guard } se leen mantenidos; { jump, l, m, h, s, r } son PULSACIONES (se guardan hasta que la simulación las lee).
// El búfer de tolerancia (6 fotogramas) vive en Fighter, así es determinista e independiente de los FPS.
// Esquemas: 'solo' (1 jugador) y 'versus' (2 jugadores en el mismo teclado: J1 a la izquierda, J2 a la derecha + teclado numérico).
export const KEYMAP = {
  left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'], jump: ['KeyW', 'ArrowUp', 'Space'], down: ['KeyS', 'ArrowDown'],
  l: ['KeyJ', 'KeyZ'], m: ['KeyK', 'KeyX'], h: ['KeyL', 'KeyC'], s: ['KeyU', 'KeyV'], r: ['KeyI', 'KeyB'], w: ['KeyO', 'KeyN'], t: ['KeyY', 'KeyM'], guard: ['ShiftLeft', 'ShiftRight'],
};
export const SCHEMES = {
  solo: [KEYMAP],
  versus: [
    { left: ['KeyA'], right: ['KeyD'], jump: ['KeyW'], down: ['KeyS'], l: ['KeyF'], m: ['KeyG'], h: ['KeyH'], s: ['KeyR'], r: ['KeyT'], w: ['KeyE'], t: ['KeyQ'], guard: ['ShiftLeft'] },
    { left: ['ArrowLeft'], right: ['ArrowRight'], jump: ['ArrowUp'], down: ['ArrowDown'], l: ['Numpad1', 'Comma'], m: ['Numpad2', 'Period'], h: ['Numpad3', 'Slash'],
      s: ['Numpad4', 'KeyL'], r: ['Numpad5', 'Semicolon'], w: ['Numpad6', 'KeyK'], t: ['Numpad7', 'Quote'], guard: ['Numpad0', 'ShiftRight'] },
  ],
};
// (F9) Teclas configurables: keys = { solo: { acción: código }, vs1: {…}, vs2: {…} } (solo lo que el jugador cambió). La tecla
// elegida pasa a ser la principal de esa acción y se quita de las demás del mismo esquema (sin conflictos).
export function buildSchemes(keys = {}) {
  const apply = (base, over) => {
    const m = Object.fromEntries(Object.entries(base).map(([a, c]) => [a, [...c]]));
    for (const [a, code] of Object.entries(over || {})) { if (!m[a]) continue; for (const k in m) m[k] = m[k].filter(c => c !== code); m[a] = [code, ...m[a]]; }
    return m;
  };
  return { solo: [apply(KEYMAP, keys.solo)], versus: [apply(SCHEMES.versus[0], keys.vs1), apply(SCHEMES.versus[1], keys.vs2)] };
}
// Nombre legible de una tecla (para la guía y los ajustes).
export function keyName(code) {
  if (!code) return '—';
  const M = { ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓', Space: 'Espacio', ShiftLeft: 'Mayús izq.', ShiftRight: 'Mayús der.', ControlLeft: 'Ctrl izq.', ControlRight: 'Ctrl der.',
    AltLeft: 'Alt', AltRight: 'Alt Gr', Comma: ',', Period: '.', Slash: '-', Semicolon: 'Ñ', Quote: "'", Backquote: 'º', Minus: "'", Equal: '¡', BracketLeft: '`', BracketRight: '+', Backslash: 'Ç', IntlBackslash: '<', Backspace: '⌫' };
  if (M[code]) return M[code];
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit\d$/.test(code)) return code.slice(5);
  if (/^Numpad/.test(code)) return 'Num ' + code.slice(6).replace('Add', '+').replace('Subtract', '-').replace('Multiply', '*').replace('Divide', '/').replace('Decimal', '.').replace('Enter', '↵');
  return code;
}
const EDGE = ['jump', 'l', 'm', 'h', 's', 'r', 'w', 't'];
const PAD = [['left', '◀'], ['right', '▶'], ['down', '▼'], ['jump', '▲'], ['l', 'L'], ['m', 'M'], ['h', 'H'], ['s', '✦'], ['r', '◈'], ['guard', '🛡'], ['lm', 'L+M'], ['mh', 'M+H'], ['w', '✠'], ['t', '✹']];
const EMPTY = Object.freeze({ x: 0, down: false, guard: false, jump: false, l: false, m: false, h: false, s: false, r: false, w: false, t: false });

export class Input {
  // keymap: mapa propio para un solo jugador (compatibilidad con v0.6); si no, se usan los esquemas.
  constructor(root, onPause, keymap = null) {
    this.root = root; this.onPause = onPause; this.paused = false; this.keys = new Set(); this.pad = {}; this.pr = [{}, {}]; this.log = [];
    this.custom = keymap; this.scheme = 'solo'; this.schemes = buildSchemes();
    this.kd = e => {
      if (e.code === 'Escape' || e.code === 'KeyP') { e.preventDefault(); if (!e.repeat) this.onPause?.(); return; }
      const hit = this.#hits(e.code); if (this.paused || !hit.length) return; e.preventDefault();
      if (!e.repeat) for (const [p, k] of hit) if (EDGE.includes(k)) this.pr[p][k] = true;
      this.keys.add(e.code);
    };
    this.ku = e => this.keys.delete(e.code);
    this.clear = () => { this.keys.clear(); this.pad = {}; this.pr = [{}, {}]; };
    if (!root) return;
    root.replaceChildren(...PAD.map(([k, g]) => {
      const b = document.createElement('button'); b.className = 'pad ' + k; b.textContent = g; b.setAttribute('aria-label', k);
      b.addEventListener('pointerdown', e => { e.preventDefault(); try { b.setPointerCapture(e.pointerId); } catch { /* puntero sintético */ } b.classList?.add('on');
        if (k === 'lm') { this.pr[0].l = this.pr[0].m = true; } else if (k === 'mh') { this.pr[0].m = this.pr[0].h = true; } else { this.pad[k] = 1; if (EDGE.includes(k)) this.pr[0][k] = true; } });
      for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) b.addEventListener(ev, () => { this.pad[k] = 0; b.classList?.remove('on'); });
      b.addEventListener('contextmenu', e => e.preventDefault());
      return b;
    }));
  }
  get maps() { return this.custom && this.scheme === 'solo' ? [this.custom] : this.schemes[this.scheme]; }
  setBindings(keys) { this.schemes = buildSchemes(keys); this.clear(); } // (F9) teclas elegidas por el jugador
  get map() { return this.maps[0]; }
  get players() { return this.maps.length; }
  // Cambia el esquema de teclas (antes de empezar un combate). Limpia lo pulsado.
  setScheme(name) { this.scheme = SCHEMES[name] ? name : 'solo'; this.clear(); }
  #hits(code) { const out = []; this.maps.forEach((m, p) => { for (const [k, codes] of Object.entries(m)) if (codes.includes(code)) out.push([p, k]); }); return out; }
  attach() { addEventListener('keydown', this.kd); addEventListener('keyup', this.ku); addEventListener('blur', this.clear); if (this.root) this.root.hidden = this.scheme !== 'solo' || !matchMedia('(pointer:coarse)').matches || hasKeyboard(); } // con teclado físico no estorban los botones táctiles
  detach() { removeEventListener('keydown', this.kd); removeEventListener('keyup', this.ku); removeEventListener('blur', this.clear); this.clear(); if (this.root) this.root.hidden = true; }
  // Un paso de simulación del jugador p (0 = J1, 1 = J2): devuelve lo mantenido y sus pulsaciones pendientes (y las vacía).
  read(p = 0) {
    const M = this.maps[p]; if (!M) return { ...EMPTY };
    const k = a => (a || []).some(c => this.keys.has(c)), pad = p === 0 ? this.pad : {};
    const x = (k(M.right) || pad.right ? 1 : 0) - (k(M.left) || pad.left ? 1 : 0);
    const o = { x, down: k(M.down) || !!pad.down, guard: k(M.guard) || !!pad.guard };
    for (const e of EDGE) o[e] = !!this.pr[p][e];
    this.pr[p] = {};
    return o;
  }
  consume() {} // compatibilidad (el búfer está en Fighter)
}
