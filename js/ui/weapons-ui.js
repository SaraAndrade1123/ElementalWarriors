// Tienda y Colección: sección ARMAS. Se instala sobre las pantallas de meta-panels.js sin modificarlas.
// Las armas no son de ningún guerrero: se compran una vez con Rose Gold y cada guerrero equipa la suya (una).
import { t } from '../systems/localization.js';
import { weaponIcon } from './weapon-icons.js';
import { equipKey } from '../elements/weapon-hook.js';

const h = (tag, props = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') e.className = v; else if (k === 'html') e.innerHTML = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (v === true) e.setAttribute(k, ''); else if (v !== false && v != null) e.setAttribute(k, v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(c));
  return e;
};

export function installWeaponShop(menu, { meta, roster, data }) {
  const { shop, wallet, save } = meta, W = () => data?.weapons || {};
  let view = 'skins', confirming = null;
  const rerender = () => menu['page_' + menu.page]();
  const items = () => [...shop.items.values()].filter(i => i.type === 'weapon' && !i.hidden && W()[i.id]).sort((a, b) => a.price - b.price);
  const eqOf = cid => save.data.equipped[equipKey(cid)] || null;
  const equip = (cid, id) => save.commit(d => { if (id) { if (!d.owned.includes(id)) return { ok: false }; d.equipped[equipKey(cid)] = id; } else delete d.equipped[equipKey(cid)]; return { ok: true }; });
  const chip = () => h('p', { class: 'gold' }, h('span', { class: 'gem', 'aria-hidden': 'true' }), h('b', {}, wallet.balance.toLocaleString()), ' Rose Gold');
  const charTabs = () => h('div', { class: 'tabs', role: 'group', 'aria-label': t('wpn.equipfor') }, ...roster.map((r, i) => h('button', { 'aria-pressed': String(i === menu.idx), onclick: () => menu.select(i) }, r.name)));
  const viewTabs = () => h('div', { class: 'tabs shopview', role: 'group', 'aria-label': t('menu.shop') },
    ...[['skins', 'wpn.view.skins'], ['weapons', 'wpn.view.weapons']].map(([v, k]) => h('button', { 'aria-pressed': String(view === v), onclick: () => { view = v; confirming = null; rerender(); } }, t(k))));
  const act = (id, a, label, fn, cls = 'mini') => h('button', { id: `w-${id}-${a}`, class: cls, onclick: fn }, label);

  const row = it => {
    const d = roster[menu.idx], w = W()[it.id], owned = shop.owns(it.id), on = eqOf(d.id) === it.id, name = t('item.' + it.id), acts = [];
    if (!owned) {
      const short = it.price - wallet.balance;
      acts.push(h('button', { id: `w-${it.id}-buy`, class: 'mini buy' + (short > 0 ? ' locked' : ''), 'aria-disabled': short > 0 ? 'true' : null,
        onclick: () => { if (short > 0) return menu.toast(t('shop.missing', { n: short })); confirming = it.id; menu.keep = `w-${it.id}-yes`; rerender(); } }, t('shop.buy')));
    } else if (on) acts.push(h('span', { class: 'tag' }, t('shop.equipped')), act(it.id, 'un', t('shop.unequip'), () => { equip(d.id, null); menu.keep = `w-${it.id}-eq`; rerender(); }));
    else acts.push(h('span', { class: 'tag' }, t('shop.owned')), act(it.id, 'eq', t('wpn.equip', { name: d.name }), () => { equip(d.id, it.id); menu.toast(t('wpn.equipped', { name, who: d.name })); menu.keep = `w-${it.id}-un`; rerender(); }));
    return h('li', { class: 'item weapon' + (on ? ' on' : '') },
      h('span', { class: 'wico', html: weaponIcon(w.kind) }),
      h('div', { class: 'meta' }, h('b', {}, name), owned ? null : h('span', { class: 'price' }, h('span', { class: 'gem', 'aria-hidden': 'true' }), t('shop.price', { n: it.price })),
        h('span', { class: 'wpow' }, t(`wpn.${it.id}.power`)), h('span', { class: 'wpas' }, t(`wpn.${it.id}.passive`)), h('span', { class: 'wcd' }, t('wpn.cd', { n: w.cd }))),
      h('div', { class: 'acts' }, ...acts),
      confirming === it.id ? h('p', { class: 'confirm' }, t('shop.confirmq', { name, n: it.price }),
        act(it.id, 'yes', t('shop.confirm'), () => { const r = shop.buy(it.id); confirming = null; menu.toast(r.ok ? t('wpn.bought', { name }) : t('shop.err.' + r.error, { n: r.missing })); if (r.ok && !eqOf(d.id)) equip(d.id, it.id); menu.keep = `w-${it.id}-un`; rerender(); }, 'mini buy'),
        act(it.id, 'no', t('shop.cancel'), () => { confirming = null; rerender(); })) : null);
  };

  const page_shop = menu.page_shop.bind(menu);
  menu.page_shop = () => {
    if (view !== 'weapons') { page_shop(); const p = menu.el.view.querySelector('.panel'), h2 = p?.querySelector('h2'); if (h2) h2.after(viewTabs()); return; }
    menu.panel(t('menu.shop'), viewTabs(), chip(), h('p', { class: 'note' }, t('wpn.equipfor')), charTabs(),
      h('p', { class: 'note' }, t('wpn.note')), h('p', { class: 'note welem' }, t('wpn.element')),
      h('ul', { class: 'items' }, ...items().map(row)));
  };
  const page_collection = menu.page_collection.bind(menu);
  menu.page_collection = () => {
    page_collection();
    const p = menu.el.view.querySelector('.panel'), mine = items().filter(i => shop.owns(i.id));
    p?.append(h('p', { class: 'lead' }, t('wpn.collection')), mine.length ? h('ul', { class: 'items' }, ...mine.map(row)) : h('p', { class: 'note' }, t('wpn.none')));
  };
  const go = menu.go.bind(menu); menu.go = p => { if (p !== 'shop') { view = 'skins'; } confirming = null; go(p); };
  return { equip, equipped: eqOf };
}
