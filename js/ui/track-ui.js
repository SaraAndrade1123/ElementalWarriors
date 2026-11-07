// SEGUIMIENTO COMÚN (v1.9) para Logros y Desafíos: comparten la misma lógica y la misma interfaz.
//   sección con título y resumen · barra de avance total · pestañas por categoría con su cuenta · descripción
//   de la categoría · fichas con medalla del nivel, nombre, objetivo, barra de avance, recompensa y acción.
import { t } from '../systems/localization.js';
const h = (tag, props = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') e.className = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (v === true) e.setAttribute(k, ''); else if (v !== false && v != null) e.setAttribute(k, v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(c));
  return e;
};
export const TIERS = ['bronze', 'silver', 'gold', 'platinum', 'mythic'];

// Tarjeta de guerrero con un rótulo («Practicas con», «Tu historia con»…): gema del elemento, nombre y apodo.
export function heroCard(me, kicker = null) {
  const alias = t(`char.${me.id}.alias`), col = me.fx?.color || '#c9a44c';
  return h('div', { class: 'hero-card', style: `--c:${col}` }, h('span', { class: 'hc-gem', 'aria-hidden': 'true' }),
    h('div', { class: 'hc-txt' }, h('span', { class: 'hc-el' }, kicker ? `${kicker} · ${t('elem.' + me.element)}` : t('elem.' + me.element)), h('b', { class: 'hc-name' }, me.name),
      alias && alias !== `char.${me.id}.alias` ? h('span', { class: 'hc-alias' }, alias) : null));
}
// Título de sección (mismo estilo que «Estadísticas» en Progreso) y resumen con barra total.
export const section = (title, sub = null) => h('div', { class: 'sect' }, h('h3', {}, title), sub ? h('span', { class: 'sect-sub' }, sub) : null);
export const totalBar = (done, total) => h('div', { class: 'ach-head', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': total, 'aria-valuenow': done, style: `--p:${total ? Math.round(100 * done / total) : 0}%` }, h('i', { class: 'ach-total' }));
// Pestañas por categoría con «hechos/total»
export function catTabs(cats, cur, pick, label) {
  return h('div', { class: 'tabs trk-tabs', role: 'group', 'aria-label': label }, ...cats.map(c => h('button', { type: 'button', 'aria-pressed': String(c.id === cur), onclick: () => pick(c.id) },
    h('span', {}, c.label), h('small', { class: c.done === c.total ? 'full' : '' }, `${c.done}/${c.total}`))));
}
// Ficha: { tier, done, name, desc, value, target, reward, tags[], action: { label, fn } }
export function trackItem(o) {
  const pct = o.target ? Math.min(100, Math.round(100 * Math.min(o.value ?? 0, o.target) / o.target)) : (o.done ? 100 : 0), tier = o.tier || 'bronze';
  return h('li', { class: `ach t-${tier}` + (o.done ? ' done' : '') + (o.kind ? ' k-' + o.kind : ''), style: `--p:${pct}%` },
    h('span', { class: 'medal ' + tier, role: 'img', 'aria-label': t('ach.tier.' + tier) + ' · ' + t(o.done ? 'prog.done' : 'prog.pending') }, o.done ? '✔' : ''),
    h('div', { class: 'meta' }, h('b', {}, o.name), h('span', {}, o.desc),
      o.tags?.length ? h('span', { class: 'ch-tags' }, ...o.tags.map(x => h('i', { class: 'tag ' + (x.cls || '') }, x.text))) : null,
      !o.done && o.target ? h('i', { class: 'ach-bar' }) : null),
    h('span', { class: 'tag' + (o.done ? ' ok' : '') }, o.done ? t('prog.done') : o.target ? `${Math.min(o.value ?? 0, o.target).toLocaleString()}/${o.target.toLocaleString()}` : t('prog.pending')),
    h('span', { class: 'price' }, t('prog.reward', { n: o.reward })),
    o.action ? h('button', { type: 'button', class: 'mini trk-go', onclick: o.action.fn }, o.action.label) : null);
}
export const list = items => h('ul', { class: 'items achs' }, ...items);
export const note = text => h('p', { class: 'note trk-note' }, text);

// (v1.10) SELECTOR DE RIVAL contra la CPU (Jugar y Versus): una ficha por guerrero (gema y color de su elemento, relación
// elemental respecto al tuyo, «Espejo» si es el mismo) y una ficha «Aleatorio» que se resuelve al empezar el combate.
export const RAND = 'rand';
export const resolveRival = (cur, roster, rnd = Math.random) => cur === RAND ? Math.floor(rnd() * roster.length) % roster.length : cur;
export function rivalPicker({ roster, me, cur, pick, label, relOf = null, who = null }) {
  const card = (v, cls, col, gem, name, sub, extra = null) => h('button', { type: 'button', class: 'rvc ' + cls, style: `--c:${col}`, 'aria-pressed': String(v === cur), onclick: () => pick(v) },
    h('span', { class: 'rv-gem', 'aria-hidden': 'true' }, gem ? h('i', {}, gem) : null), h('span', { class: 'rv-txt' }, h('b', {}, name), h('small', {}, sub), extra));
  return h('div', { class: 'rvpick', role: 'group', 'aria-label': label },
    ...roster.map((r, i) => {
      const mirror = me && r.id === me.id, rel = !mirror && relOf ? relOf(r) : null;
      return card(i, mirror ? 'rv-mirror' : '', r.fx?.color || '#c9a44c', '', r.name, t('elem.' + r.element),
        mirror ? h('i', { class: 'rv-tag' }, t('rival.mirror')) : rel ? h('i', { class: 'rv-tag rel-' + rel }, { advantage: '▲ ', disadvantage: '▼ ', neutral: '= ' }[rel] + t('elem.rel.' + rel)) : null);
    }),
    card(RAND, 'rv-rand', '#e9d7a0', '?', t('rival.random'), who || t('rival.random.sub')));
}
