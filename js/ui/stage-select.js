// Selector de escenario dentro de «Jugar». Envuelve menu.page_play sin editar menu-manager.js.
import { t } from '../systems/localization.js';
import { RANDOM } from '../stages/stage-manager.js';

const h = (tag, props = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') e.className = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k === 'style') e.style.cssText = v; else if (v === true) e.setAttribute(k, ''); else if (v !== false && v != null) e.setAttribute(k, v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(c));
  return e;
};

export function installStageSelect(menu, { stages }) {
  const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = 'css/stages.css'; document.head.append(css);
  const play = menu.page_play.bind(menu);

  const info = s => {
    const rnd = s === RANDOM;
    return h('div', { class: 'stage-info', 'aria-live': 'polite' },
      h('b', {}, t(rnd ? 'stage.random' : `stage.${s.id}.name`)),
      h('span', {}, t(rnd ? 'stage.random.desc' : `stage.${s.id}.desc`)),
      rnd ? null : h('span', { class: 'tag' }, t('stage.el.' + s.element)));
  };

  menu.page_play = function () {
    play(); // la pantalla de combate original (sin tocar)
    const panel = this.el.view.querySelector('.panel'), cta = panel?.querySelector('.cta'); if (!panel || !cta) return;
    const sel = stages.selected, cur = sel === RANDOM ? RANDOM : stages.byId.get(sel);
    const tile = o => {
      const rnd = o === RANDOM, id = rnd ? RANDOM : o.id, locked = !rnd && !stages.isUnlocked(o);
      const bg = rnd ? 'linear-gradient(90deg,#2a2352,#a8566a,#1f4f7a,#4a6a2a)' : `linear-gradient(180deg,${o.sky.join(',')})`;
      return h('button', { id: 'st-' + id, class: 'stage-tile' + (rnd ? ' rnd' : ''), 'aria-pressed': String(id === sel), 'aria-disabled': locked ? 'true' : null,
        style: `--sg:${bg};--sa:${rnd ? '#f1dc9a' : o.accent}`,
        onclick: () => { if (locked) return this.toast(t('stage.locked')); stages.select(id); this.keep = 'st-' + id; this.page_play(); } },
        h('i', { class: 'stage-thumb', 'aria-hidden': 'true' }), h('span', {}, t(rnd ? 'stage.random' : `stage.${id}.name`)));
    };
    cta.before(h('p', { class: 'note' }, t('stage.title')),
      h('div', { class: 'stage-grid', role: 'group', 'aria-label': t('stage.title') }, ...stages.list.map(tile), tile(RANDOM)),
      info(cur ?? RANDOM));
    const keep = this.keep; this.keep = null; if (keep) panel.querySelector('#' + keep)?.focus({ preventScroll: true });
  };
  // El botón «Combatir» ya llama onPlay(a, b); el escenario viaja por stages.selected (lo lee stage-hook).
}
