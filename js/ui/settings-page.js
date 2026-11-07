// AJUSTES COMPLETOS (F9): Gráficos · Sonido · Controles · Táctil · Accesibilidad · Idioma, en pestañas.
// Cada opción cambia algo real (scene.apply, a11y.js, input.setBindings, audio-hook) y se guarda validada (settings-manager).
import { t } from '../systems/localization.js';
import { ACTIONS, KEY_SCHEMES, RESERVED } from '../systems/settings-manager.js';
import { SCHEMES, KEYMAP, buildSchemes, keyName } from '../game/input.js';

const h = (tag, props = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') e.className = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k === 'checked' || k === 'value') e[k] = v; else if (v != null && v !== false) e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(c));
  return e;
};
export const SECTIONS = ['graphics', 'sound', 'controls', 'touch', 'access', 'lang'];
const GROUPS = { graphics: ['quality', 'res', 'shadows', 'particles', 'post', 'outlines', 'camFx', 'reduceMotion'], controls: ['keys'], touch: ['tSize', 'tOpacity', 'tLayout'],
  access: ['uiScale', 'contrast', 'subtitles', 'textSpeed', 'altCues', 'reduceFlash', 'calmCam', 'autoPause'], lang: ['lang'] };
// Teclas por defecto de cada esquema (para mostrarlas y detectar conflictos)
const baseMap = sc => sc === 'solo' ? KEYMAP : SCHEMES.versus[sc === 'vs1' ? 0 : 1];

export function installSettingsPage(menu, { settings, onBindings } = {}) {
  let tab = 'graphics', scheme = 'solo', listening = null;
  const S = () => settings.get();
  const set = (p, rerender = true) => { settings.set(p); if (rerender) render(); };
  const choice = (key, opts, label = v => t(`set.${key}.${v}`)) => h('div', { class: 'tabs', role: 'group' }, ...opts.map(v =>
    h('button', { type: 'button', 'aria-pressed': String(S()[key] === v), onclick: () => set({ [key]: v }) }, label(v))));
  const row = (label, ctl, tip) => h('div', { class: 'srow' }, h('div', { class: 'slab' }, h('b', {}, label), tip ? h('span', {}, tip) : null), ctl);
  const tog = (key, label, tip) => h('label', { class: 'stog' }, h('input', { type: 'checkbox', checked: !!S()[key], onchange: e => set({ [key]: e.target.checked }, false) }),
    h('i', { 'aria-hidden': 'true' }), h('span', { class: 'slab' }, h('b', {}, label), tip ? h('span', {}, tip) : null));
  const range = (key, min, max, step, fmt) => {
    const v = S()[key], out = h('output', {}, fmt(v));
    return h('label', { class: 'vol' }, h('input', { type: 'range', min, max, step, value: v, oninput: e => { out.textContent = fmt(+e.target.value); set({ [key]: +e.target.value }, false); } }), out);
  };
  const pct = v => Math.round(v * 100) + '%';

  function sec_graphics() {
    const fs = document.fullscreenEnabled || document.webkitFullscreenEnabled;
    return [
      row(t('set.quality'), choice('quality', ['low', 'medium', 'high'], v => t('set.q.' + v)), t('set.quality.tip')),
      row(t('set.res'), choice('res', [50, 70, 85, 100], v => v + '%'), t('set.res.tip')),
      row(t('set.shadows'), choice('shadows', ['auto', 'on', 'off'], v => t('set.opt.' + v))),
      row(t('set.particles'), choice('particles', ['auto', 'low', 'medium', 'high'], v => v === 'auto' ? t('set.opt.auto') : t('set.q.' + v))),
      row(t('set.post'), choice('post', ['auto', 'on', 'off'], v => t('set.opt.' + v)), t('set.post.tip')),
      tog('outlines', t('set.outlines'), t('set.outlines.tip')), tog('camFx', t('set.camFx'), t('set.camFx.tip')), tog('reduceMotion', t('set.reduce'), t('set.reduce.tip')),
      fs ? h('button', { type: 'button', class: 'ghost', onclick: () => { const d = document; (d.fullscreenElement ? d.exitFullscreen?.() : d.documentElement.requestFullscreen?.())?.catch?.(() => {}); } }, t('ui.fullscreen')) : null,
    ];
  }
  function sec_controls() {
    const keys = S().keys || {}, maps = buildSchemes(keys), map = scheme === 'solo' ? maps.solo[0] : maps.versus[scheme === 'vs1' ? 0 : 1];
    const others = KEY_SCHEMES.filter(s => s !== scheme).flatMap(s => { const m = s === 'solo' ? maps.solo[0] : maps.versus[s === 'vs1' ? 0 : 1]; return s === 'solo' || scheme === 'solo' ? [] : Object.values(m).flat(); });
    const rows = ACTIONS.filter(a => baseMap(scheme)[a]).map(a => {
      const code = map[a]?.[0], busy = listening === a, clash = code && others.includes(code);
      return h('div', { class: 'krow' + (busy ? ' busy' : '') + (clash ? ' clash' : '') }, h('span', { class: 'kact' }, t('set.act.' + a)),
        h('button', { type: 'button', class: 'kbtn', 'aria-label': t('set.act.' + a) + ': ' + keyName(code), onclick: () => { listening = busy ? null : a; render(); } },
          busy ? t('set.keys.press') : h('span', { class: 'kc' }, keyName(code))),
        (map[a] || []).slice(1, 2).map(c => h('span', { class: 'kalt', title: t('set.keys.alt') }, keyName(c))));
    });
    return [
      h('div', { class: 'tabs', role: 'group' }, ...KEY_SCHEMES.map(sc => h('button', { type: 'button', 'aria-pressed': String(scheme === sc), onclick: () => { scheme = sc; listening = null; render(); } }, t('set.keys.' + sc)))),
      h('p', { class: 'note' }, t('set.keys.tip')), h('div', { class: 'keys' }, ...rows),
      h('div', { class: 'row' }, h('button', { type: 'button', class: 'ghost', onclick: () => { const k = { ...(S().keys || {}) }; delete k[scheme]; listening = null; set({ keys: k }); menu.toast(t('set.keys.resetdone')); } }, t('set.keys.reset'))),
    ];
  }
  function sec_touch() {
    return [
      row(t('set.tSize'), range('tSize', .7, 1.5, .05, pct)), row(t('set.tOpacity'), range('tOpacity', .3, 1, .05, pct)),
      row(t('set.tLayout'), choice('tLayout', ['right', 'left'], v => t('set.tLayout.' + v)), t('set.tLayout.tip')),
      h('div', { class: 'tprev', 'aria-hidden': 'true' }, ...['◀', '▶', 'L', 'M', 'H', '✦'].map((g, i) => h('i', { class: i < 2 ? 'mv' : 'ac' }, g))),
    ];
  }
  function sec_access() {
    return [
      row(t('set.uiScale'), choice('uiScale', [.9, 1, 1.15, 1.3], v => Math.round(v * 100) + '%')),
      row(t('set.textSpeed'), choice('textSpeed', ['slow', 'normal', 'fast', 'instant'])),
      tog('subtitles', t('set.subtitles'), t('set.subtitles.tip')), tog('contrast', t('set.contrast'), t('set.contrast.tip')),
      tog('altCues', t('set.altCues'), t('set.altCues.tip')), tog('reduceFlash', t('set.reduceFlash'), t('set.reduceFlash.tip')),
      tog('calmCam', t('set.calmCam'), t('set.calmCam.tip')), tog('autoPause', t('set.autoPause'), t('set.autoPause.tip')),
    ];
  }
  function sec_lang() {
    return [h('div', { class: 'tabs' }, ...[['es', 'Español'], ['en', 'English']].map(([c, n]) =>
      h('button', { type: 'button', id: 'lang-' + c, lang: c, 'aria-pressed': String(S().lang === c), onclick: () => { menu.keep = 'lang-' + c; settings.set({ lang: c }); } }, n)))];
  }
  function render() {
    const body = { graphics: sec_graphics, controls: sec_controls, touch: sec_touch, access: sec_access, lang: sec_lang, sound: () => [] }[tab]();
    menu.panel(t('menu.settings'),
      h('div', { class: 'tabs set-tabs', role: 'tablist' }, ...SECTIONS.map(k => h('button', { type: 'button', role: 'tab', 'aria-selected': String(tab === k), 'aria-pressed': String(tab === k),
        onclick: () => { tab = k; listening = null; render(); } }, t('set.sec.' + k)))),
      h('section', { class: 'set-sec', 'data-sec': tab }, ...body),
      h('button', { type: 'button', class: 'ghost set-reset', onclick: () => { settings.reset(GROUPS[tab] || null); if (tab === 'sound') menu.audioReset?.(); render(); menu.toast(t('set.reset')); } }, t('set.resetsec')));
    menu.afterSettings?.(tab);
  }
  // captura de tecla para reasignar (antes que el menú: no navega mientras se escucha)
  addEventListener('keydown', e => {
    if (!listening || menu.page !== 'settings') return;
    e.preventDefault(); e.stopImmediatePropagation();
    if (e.code === 'Escape') { listening = null; return render(); }
    if (RESERVED.includes(e.code)) { menu.toast(t('set.keys.reserved', { k: keyName(e.code) })); return; }
    const k = JSON.parse(JSON.stringify(S().keys || {})); (k[scheme] ??= {})[listening] = e.code;
    // si esa tecla ya era de otra acción del mismo esquema, se le quita (buildSchemes) y se avisa
    const prev = Object.entries(buildSchemes(S().keys || {})[scheme === 'solo' ? 'solo' : 'versus'][scheme === 'vs2' ? 1 : 0]).find(([a, c]) => a !== listening && c[0] === e.code);
    if (prev) { delete k[scheme][prev[0]]; menu.toast(t('set.keys.moved', { k: keyName(e.code), a: t('set.act.' + prev[0]) })); }
    listening = null; set({ keys: k }); onBindings?.(S().keys);
  }, true);
  menu.page_settings = () => { render(); };
  menu.settingsTab = () => tab;
  return { render, get tab() { return tab; } };
}
