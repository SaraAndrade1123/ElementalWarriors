// Pantallas Tienda, Colección y Progreso. Se "instalan" sobre el MenuManager sin modificar su archivo.
import { t } from '../systems/localization.js';

const h = (tag, props = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (v === true) e.setAttribute(k, '');
    else if (v !== false && v != null) e.setAttribute(k, v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(c));
  return e;
};
const fmtTime = s => { const m = Math.floor(s / 60); return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : m ? `${m} min` : `${s % 60} s`; };

export function installMetaPanels(menu, { meta, scene, roster, dev = false }) {
  const { shop, wallet, progression, save } = meta;
  const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = 'css/meta.css'; document.head.append(css);
  let preview = null, confirming = null, resetAsk = false;

  // El color de acento de la interfaz sigue a la paleta equipada (o a la que estás viendo en vista previa)
  const accent = override => { const d = roster[menu.idx]; document.documentElement.style.setProperty('--accent', override ?? shop.fxOf(d.id)?.light ?? d.fx.light); };
  const apply = id => { scene.setPalette(id, shop.paletteOf(id)); if (roster[menu.idx].id === id) accent(); };
  const clearPreview = () => { if (preview) { const id = preview; preview = null; apply(id); } };
  const rerender = () => menu['page_' + menu.page]();
  const swatch = (d, it) => h('span', { class: 'swatch', 'aria-hidden': 'true',
    style: it?.swatch ? `background:linear-gradient(135deg,${it.swatch.join(',')})` : `background:${d.fx.color};${it ? `filter:hue-rotate(${it.hue || 0}deg) saturate(${it.sat ?? 1})` : ''}` });
  const chip = () => h('p', { class: 'gold' }, h('span', { class: 'gem', 'aria-hidden': 'true' }), h('b', {}, wallet.balance.toLocaleString()), ' Rose Gold');
  const tabs = () => h('div', { class: 'tabs', role: 'group' }, ...roster.map((r, i) => h('button', { 'aria-pressed': String(i === menu.idx), onclick: () => menu.select(i) }, r.name)));
  const warn = () => (save.persistent ? null : h('p', { class: 'note warn' }, t('prog.nosave')));

  // Al cambiar de guerrero o de pantalla se revierte cualquier vista previa
  const sel = menu.select.bind(menu), go = menu.go.bind(menu);
  menu.select = i => { clearPreview(); confirming = null; sel(i); accent(); if (menu.page === 'shop' || menu.page === 'collection') rerender(); };
  menu.go = p => { if (p !== 'shop' && p !== 'collection') clearPreview(); confirming = null; resetAsk = false; go(p); };
  progression.onUnlock = list => menu.toast(t('ach.unlocked', { name: t(`ach.${list[0].id}.name`) }) + (list.length > 1 ? ` (+${list.length - 1})` : ''));

  const act = (it, a, label, fn, cls = 'mini') => h('button', { id: `a-${it.id}-${a}`, class: cls, onclick: fn }, label);
  const doBuy = it => {
    const r = shop.buy(it.id); confirming = null; clearPreview();
    menu.toast(r.ok ? t('shop.bought', { name: t('item.' + it.id) }) : t('shop.err.' + r.error, { n: r.missing }));
    rerender();
  };
  const doEquip = it => { shop.equip(it.id); preview = null; apply(it.char); menu.keep = `a-${it.id}-eq`; rerender(); };
  const doPreview = it => { clearPreview(); preview = it.char; scene.setPalette(it.char, it); accent(it.fx?.light); menu.toast(t('shop.previewing', { name: t('item.' + it.id) })); };

  const row = it => {
    const d = roster.find(r => r.id === it.char), owned = shop.owns(it.id), eq = shop.equippedId(it.char) === it.id, name = t('item.' + it.id);
    const acts = [];
    if (!owned) {
      acts.push(act(it, 'pv', t('shop.preview'), () => doPreview(it)));
      if (confirming !== it.id) {
        const short = it.price - wallet.balance;
        acts.push(h('button', { id: `a-${it.id}-buy`, class: 'mini buy', 'aria-disabled': short > 0 ? 'true' : null,
          onclick: () => { if (short > 0) return menu.toast(t('shop.missing', { n: short })); confirming = it.id; menu.keep = `a-${it.id}-yes`; rerender(); } }, t('shop.buy')));
      }
    } else if (eq) acts.push(h('span', { class: 'tag' }, '✔ ' + t('shop.equipped')), act(it, 'un', t('shop.unequip'), () => { shop.unequip(it.char); apply(it.char); rerender(); }));
    else acts.push(h('span', { class: 'tag' }, t('shop.owned')), act(it, 'eq', t('shop.equip'), () => doEquip(it)));
    return h('li', { class: 'item' },
      swatch(d, it), h('div', { class: 'meta' }, h('b', {}, name), owned ? null : h('span', { class: 'price' }, h('span', { class: 'gem', 'aria-hidden': 'true' }), t('shop.price', { n: it.price })),
        it.chroma ? h('span', { class: 'cfx', style: `--g:${it.chroma.glow};--g2:${it.chroma.glow2}` }, h('i', {}, t('chroma.badge')), t('chroma.k.' + it.chroma.kind)) : null,
        it.chroma ? h('span', { class: 'cfx2' }, [it.vfx?.style ? t('chroma.s.' + it.vfx.style) : null, t('chroma.a.' + it.chroma.aura), t('chroma.outline')].filter(Boolean).join(' · ')) : null),
      h('div', { class: 'acts' }, ...acts),
      confirming === it.id ? h('p', { class: 'confirm' }, t('shop.confirmq', { name, n: it.price }),
        act(it, 'yes', t('shop.confirm'), () => doBuy(it), 'mini buy'), act(it, 'no', t('shop.cancel'), () => { confirming = null; rerender(); })) : null);
  };

  menu.page_shop = () => {
    const d = roster[menu.idx];
    menu.panel(t('menu.shop'), chip(), tabs(), h('p', { class: 'note' }, t('shop.note')),
      h('ul', { class: 'items' }, ...shop.list(d.id).map(row)),
      dev ? h('button', { class: 'ghost', onclick: () => { wallet.add(500); rerender(); } }, t('dev.gold')) : null, warn());
  };

  menu.page_collection = () => {
    const d = roster[menu.idx], mine = shop.ownedOf(d.id), sale = [...shop.items.values()].filter(i => !i.hidden);
    const orig = h('li', { class: 'item' }, swatch(d, null), h('div', { class: 'meta' }, h('b', {}, t('col.original'))),
      h('div', { class: 'acts' }, shop.equippedId(d.id) ? h('button', { id: 'a-orig-eq', class: 'mini', onclick: () => { shop.unequip(d.id); apply(d.id); menu.keep = 'a-orig-eq'; rerender(); } }, t('shop.equip')) : h('span', { class: 'tag' }, '✔ ' + t('shop.equipped'))));
    menu.panel(t('menu.collection'), tabs(), h('p', { class: 'lead' }, t('col.count', { a: sale.filter(i => shop.owns(i.id)).length, b: sale.length })),
      h('ul', { class: 'items' }, orig, ...mine.map(row)), mine.length ? null : h('p', { class: 'note' }, t('col.none')), warn());
  };

  menu.page_progress = () => {
    const d = save.data, s = d.stats, g = d.gold, wr = s.matches ? Math.round(100 * s.wins / s.matches) : 0;
    const sect = (title, sub) => h('div', { class: 'sect' }, h('h3', {}, title), sub ? h('span', { class: 'sect-sub' }, sub) : null);
    // estadísticas en fichas
    const tiles = [['prog.matches', s.matches], ['prog.wins', s.wins], ['prog.winrate', wr + '%'], ['prog.rounds', s.roundsWon], ['prog.combo', s.maxCombo], ['prog.damage', s.maxDamage],
      ['prog.rankS', s.rankS || 0], ['prog.perfects', s.perfects || 0], ['prog.losses', s.losses], ['prog.draws', s.draws], ['prog.time', fmtTime(s.playSec)], ['prog.best', d.records.survival.wins],
      ['prog.earned', g.earned.toLocaleString()], ['prog.spent', g.spent.toLocaleString()]];
    const stats = h('div', { class: 'stiles' }, ...tiles.map(([k, v]) => h('div', { class: 'stile' }, h('b', {}, String(v)), h('span', {}, t(k)))));
    // victorias por guerrero: tarjeta con el color de su elemento y barra relativa
    const top = Math.max(1, ...roster.map(r => s.winsBy[r.id] || 0));
    const warriors = h('div', { class: 'wcards' }, ...roster.map(r => {
      const n = s.winsBy[r.id] || 0, x = (s.extremeBy || {})[r.id] || 0, alias = t(`char.${r.id}.alias`);
      return h('div', { class: 'wcard', style: `--c:${r.fx?.color || '#c9a44c'};--w:${Math.round(100 * n / top)}%` },
        h('span', { class: 'wc-el' }, t(`elem.${r.element}`)), h('b', { class: 'wc-name' }, r.name), alias !== `char.${r.id}.alias` ? h('span', { class: 'wc-alias' }, alias) : null,
        h('span', { class: 'wc-n' }, String(n), h('small', {}, ' ' + t('prog.wins').toLowerCase())), h('i', { class: 'wc-bar' }),
        x ? h('span', { class: 'wc-x', title: t('prog.extremeBadge') }, '✦ ' + t('prog.extremeBadge')) : null);
    }));
    // logros por categoría, con medalla del nivel y barra de avance
    const doneN = progression.achs.filter(a => d.done.includes(a.id)).length, won = progression.achs.filter(a => d.done.includes(a.id)).reduce((n, a) => n + a.reward, 0);
    const cats = [...new Set(progression.achs.map(a => a.cat || 'fight'))];
    const groups = cats.map(cat => {
      const list = progression.achs.filter(a => (a.cat || 'fight') === cat), got = list.filter(a => d.done.includes(a.id)).length;
      return h('div', { class: 'ach-group' }, h('h4', { class: 'ach-cat' }, t('ach.cat.' + cat), h('span', {}, `${got}/${list.length}`)),
        h('ul', { class: 'items achs' }, ...list.map(a => {
          const done = d.done.includes(a.id), p = progression.progressOf(a, d), pct = Math.min(100, Math.round(100 * Math.min(p.value, p.target) / p.target)), tier = a.tier || 'bronze';
          return h('li', { class: `ach t-${tier}` + (done ? ' done' : ''), style: `--p:${pct}%` },
            h('span', { class: 'medal ' + tier, role: 'img', 'aria-label': t('ach.tier.' + tier) + ' · ' + t(done ? 'prog.done' : 'prog.pending') }, done ? '✔' : ''),
            h('div', { class: 'meta' }, h('b', {}, t(`ach.${a.id}.name`)), h('span', {}, t(`ach.${a.id}.desc`)), done ? null : h('i', { class: 'ach-bar' })),
            h('span', { class: 'tag' }, done ? t('prog.done') : `${Math.min(p.value, p.target).toLocaleString()}/${p.target.toLocaleString()}`), h('span', { class: 'price' }, t('prog.reward', { n: a.reward })));
        })));
    });
    const achHead = h('div', { class: 'ach-head', style: `--p:${Math.round(100 * doneN / progression.achs.length)}%` }, h('i', { class: 'ach-total' }));
    const reset = resetAsk
      ? h('p', { class: 'confirm' }, t('prog.reset.confirm'), h('button', { id: 'a-reset-yes', class: 'mini buy', onclick: () => { save.reset(); roster.forEach(r => apply(r.id)); resetAsk = false; menu.toast(t('prog.reset.done')); rerender(); } }, t('prog.reset.yes')),
        h('button', { class: 'mini', onclick: () => { resetAsk = false; rerender(); } }, t('shop.cancel')))
      : h('button', { class: 'ghost', onclick: () => { resetAsk = true; menu.keep = 'a-reset-yes'; rerender(); } }, t('prog.reset'));
    const sim = () => { // solo con ?dev=1: simula el fin de un combate para probar recompensas
      const r = progression.recordMatch({ matchId: 'dev-' + Date.now() + Math.random().toString(36).slice(2, 6), mode: 'arcade', outcome: 'win', characterId: roster[menu.idx].id, roundsWon: 2, maxCombo: 3 + Math.floor(Math.random() * 9), maxDamage: 300, durationSec: 90, difficulty: 'normal', transformations: 1 });
      menu.toast(r.ok ? t('match.reward', { gold: r.gold }) : String(r.error)); rerender();
    };
    menu.panel(t('menu.progress'), chip(),
      sect(t('prog.statsTitle')), stats,
      sect(t('prog.byWarrior')), warriors,
      sect(t('prog.ach'), t('prog.achSub', { a: doneN, b: progression.achs.length, g: won.toLocaleString() })), achHead, ...groups,
      dev ? h('button', { class: 'ghost', onclick: sim }, t('dev.win')) : null, reset, warn());
  };
}
