// Adaptador de audio ↔ juego. NO edita menu-manager.js, scene-manager.js, match.js ni fighter.js: envuelve instancias
// (igual que stage-hook.js y meta-panels.js). Si F3 cambia el combate, solo deja de sonar lo que ya no exista; no se rompe nada.
import { AudioManager } from '../systems/audio-manager.js';
import { t } from '../systems/localization.js';
import { MovementSounds } from './movement-sounds.js';

/** Elemento de cada guerrero (define el timbre de sus golpes y su música). Un guerrero nuevo sin entrada suena «neutral». */
export const ELEMENT_OF = { ignis: 'fire', aqua: 'water', terra: 'earth', zephyr: 'wind' };

const h = (tag, props = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k === 'class') e.className = v;
    else if (v === true) e.setAttribute(k, '');
    else if (v !== false && v != null) e.setAttribute(k, v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(c));
  return e;
};
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function installAudio({ menu, scene, meta = null, stages = null, roster = menu.roster, audio = new AudioManager() }) {
  if (scene.__audio) return scene.__audio;
  scene.__audio = audio;
  const css = h('link', { rel: 'stylesheet', href: 'css/audio.css' }); document.head.append(css);
  const elementOf = i => ELEMENT_OF[roster[i]?.id];
  const inMenu = () => menu.enabled && !scene.match;
  const menuMusic = () => audio.music(elementOf(menu.idx), 'menu');

  // 1) El navegador solo permite sonido tras un gesto del usuario: el primero lo desbloquea y arranca la música del menú.
  const first = () => { removeEventListener('pointerdown', first, true); removeEventListener('keydown', first, true); menuMusic(); audio.unlock(); };
  addEventListener('pointerdown', first, true); addEventListener('keydown', first, true);

  // 2) Sonidos de interfaz por delegación de eventos (sirven también para pantallas nuevas).
  let lastPointer = -1e9, lastClick = -1e9;
  document.addEventListener('pointerdown', () => { lastPointer = performance.now(); }, true);
  document.addEventListener('click', e => {
    const b = e.target.closest?.('button, a[href], input[type=checkbox]'); if (!b || b.closest('#touch')) return;
    lastClick = performance.now();
    const name = b.getAttribute('aria-disabled') === 'true' ? 'ui_error'
      : b.id === 'start' || b.classList.contains('cta') ? 'ui_confirm'
      : b.classList.contains('back') || b.id === 'p-menu' ? 'ui_back' : 'ui_click';
    audio.sfx(name);
  }, true);
  document.addEventListener('mouseover', e => {
    const b = e.target.closest?.('button, a[href]'); if (!b || b.contains(e.relatedTarget) || b.closest('#touch, #hud')) return;
    audio.sfx('ui_hover');
  });
  document.addEventListener('focusin', e => { // navegación con teclado (no repite el tic del ratón ni del clic)
    const now = performance.now(); if (now - lastPointer < 300 || now - lastClick < 300) return;
    const b = e.target.closest?.('button, a[href]'); if (b && !b.closest('#touch')) audio.sfx('ui_hover');
  });

  // 3) Cambiar de guerrero: sonido con el timbre de su elemento y la música cambia (con un pequeño retardo anti-ráfaga).
  let mt = 0;
  const select = menu.select.bind(menu);
  menu.select = i => {
    const before = menu.idx; select(i);
    if (menu.idx === before) return;
    audio.sfx('ui_switch', { element: elementOf(menu.idx) });
    clearTimeout(mt); mt = setTimeout(() => { if (inMenu()) menuMusic(); }, 350);
  };

  // 4) Combate: música del escenario, y pasos/salto/aterrizaje a partir del estado real de los luchadores.
  const stageElement = () => {
    const e = stages?.byId?.get(stages.currentId)?.element;
    return e === 'all' ? 'neutral' : e && e !== 'neutral' ? e : null;
  };
  let raf = 0, prev = 0; const moves = new MovementSounds(audio);
  const track = now => { raf = requestAnimationFrame(track); moves.update(scene.match, (now - prev) / 1000); prev = now; };
  const start = scene.startMatch.bind(scene), end = scene.endMatch.bind(scene);
  scene.startMatch = (...args) => {
    start(...args); // si el combate no arranca, la excepción sale tal cual (main.js ya la muestra) y no tocamos el audio
    try {
      clearTimeout(mt); audio.music(stageElement() ?? elementOf(menu.idx), 'battle'); audio.sfx('round_start');
      moves.reset(); prev = performance.now(); cancelAnimationFrame(raf); raf = requestAnimationFrame(track);
    } catch (err) { console.warn('[audio] enganche de combate:', err); }
  };
  scene.endMatch = (...args) => {
    cancelAnimationFrame(raf); raf = 0; audio.duck(false);
    const r = end(...args); try { menuMusic(); } catch (err) { console.warn('[audio]', err); } return r;
  };

  // 5) Pausa: la música se atenúa y pierde agudos; al ocultar la pestaña el audio se detiene.
  const pz = document.getElementById('pause');
  if (pz) new MutationObserver(() => audio.duck(!pz.hidden)).observe(pz, { attributes: true, attributeFilter: ['hidden'] });
  document.addEventListener('visibilitychange', () => audio.setHidden(document.hidden));

  // 6) Tienda y logros.
  if (meta) {
    const buy = meta.shop.buy.bind(meta.shop);
    meta.shop.buy = id => { const r = buy(id); audio.sfx(r?.ok ? 'ui_buy' : 'ui_error'); return r; };
    const prevUnlock = meta.progression.onUnlock;
    meta.progression.onUnlock = list => { prevUnlock?.(list); audio.sfx('ui_unlock'); };
  }

  // 7) Para el combate (F3): eventos desacoplados. dispatchEvent(new CustomEvent('ew:sfx', { detail: { name, element, x } }))
  addEventListener('ew:sfx', e => { if (e.detail?.name) audio.sfx(e.detail.name, e.detail); });
  addEventListener('ew:music', e => { if (e.detail) audio.music(e.detail.element, e.detail.mode); });

  // 8) Ajustes: bloque «Sonido» dentro de la pantalla existente (sin tocar menu-manager.js).
  const pageSettings = menu.page_settings.bind(menu);
  menu.page_settings = () => {
    pageSettings();
    const panel = menu.el.view.querySelector('.panel'); if (!panel) return;
    const block = h('fieldset', { class: 'audio' }, h('legend', {}, t('set.audio')));
    if (!audio.available) block.append(h('p', { class: 'note' }, t('set.audio.none')));
    else {
      const s = audio.settings;
      const nav = e => { // Izq/Der cambian el valor; Arriba/Abajo pasan al control anterior/siguiente
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.stopPropagation(); return; }
        if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
        const els = [...panel.querySelectorAll('button, input')], i = els.indexOf(e.target);
        els[(i + (e.key === 'ArrowDown' ? 1 : -1) + els.length) % els.length]?.focus(); e.preventDefault(); e.stopPropagation();
      };
      const slider = (kind, label) => {
        const out = h('output', {}, `${Math.round(s[kind] * 100)}%`);
        const input = h('input', { type: 'range', min: 0, max: 100, step: 5, value: Math.round(s[kind] * 100), 'aria-label': label,
          oninput: e => { audio.setVolume(kind, e.target.value / 100); out.textContent = `${e.target.value}%`; },
          onchange: () => { if (kind === 'sfx') { audio.last.clear(); audio.sfx('hit_medium', { element: elementOf(menu.idx) }); } },
          onkeydown: nav });
        return h('label', { class: 'vol' }, h('span', {}, label), input, out);
      };
      block.append(slider('music', t('set.music')), slider('sfx', t('set.sfx')),
        h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: s.muted, onchange: e => audio.setMuted(e.target.checked), onkeydown: nav }), t('set.mute')));
    }
    const note = panel.querySelector('.note'); note ? panel.insertBefore(block, note) : panel.append(block);
  };
  const reset = menu.settings.reset.bind(menu.settings);
  menu.settings.reset = () => { reset(); audio.reset(); };

  return audio;
}
