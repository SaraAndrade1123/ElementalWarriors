import { LEVEL_IDS } from '../game/difficulty-config.js';
import { t } from '../systems/localization.js';
import { movesFor } from '../game/fighter.js';

const h = (tag, props = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (v === true) e.setAttribute(k, '');
    else if (v !== false && v != null) e.setAttribute(k, v);
  }
  for (const c of kids.flat()) e.append(c?.nodeType ? c : document.createTextNode(c ?? ''));
  return e;
};

// Aviso de duelo espejo bajo la lista de rivales (solo si el rival elegido es el mismo guerrero).
const i18nMirror = (r, me) => r && me && r.id === me.id ? h('p', { class: 'note mirror-note' }, t('play.mirror', { name: me.name })) : null;

export class MenuManager {
  constructor({ el, menu, roster, scene, settings, onPlay, moves }) {
    Object.assign(this, { el, menu, roster, scene, settings, onPlay, moves }); this.enabled = true; this.rival = 1; this.mode = 'cpu'; this.idx = 0; this.page = 'home'; this.timer = 0; this.keep = null;
  }

  c(d, k) { return t(`char.${d.id}.${k}`); }

  refresh() { this.select(this.idx); if (this.page !== 'roster') this.go(this.page); }

  init() {
    const { prev, next, dots } = this.el;
    prev.onclick = () => this.select(this.idx - 1); next.onclick = () => this.select(this.idx + 1);
    dots.replaceChildren(...this.roster.map((d, i) => h('button', { class: 'dot', 'aria-label': d.name, onclick: () => this.select(i) })));
    addEventListener('keydown', e => this.key(e));
    this.select(0); this.go('home');
  }

  key(e) {
    if (!this.enabled) return;
    const k = e.key;
    if (k === 'ArrowLeft') this.select(this.idx - 1);
    else if (k === 'ArrowRight') this.select(this.idx + 1);
    else if (k === 'Escape' && this.page !== 'home') this.go('home');
    else if (k === 'ArrowDown' || k === 'ArrowUp') {
      const b = [...this.el.view.querySelectorAll('button')], i = b.indexOf(document.activeElement);
      b[(i + (k === 'ArrowDown' ? 1 : -1) + b.length) % b.length]?.focus();
    } else return;
    e.preventDefault();
  }

  select(i) {
    const n = this.roster.length; this.idx = (i + n) % n; const d = this.roster[this.idx];
    this.scene.show(d.id);
    document.documentElement.style.setProperty('--accent', d.fx.light);
    const { name, alias, dots, elem } = this.el;
    name.textContent = d.name; alias.textContent = this.c(d, 'alias');
    elem.replaceChildren(h('span', { class: `pip ${d.shape}` }), this.c(d, 'element'));
    [...dots.children].forEach((b, j) => b.setAttribute('aria-current', String(j === this.idx)));
    if (this.page === 'roster') this.page_roster(); else if (this.page === 'play' || this.page === 'training') this.page_play();
  }

  go(page) { this.page = page; this['page_' + page](); }

  toast(msg) {
    const e = this.el.toast; e.textContent = msg; e.classList.add('on');
    clearTimeout(this.timer); this.timer = setTimeout(() => e.classList.remove('on'), 2800);
  }

  panel(title, ...kids) {
    this.el.view.replaceChildren(h('section', { class: 'panel' },
      h('button', { class: 'back', onclick: () => this.go('home') }, '‹ ' + t('ui.back')), h('h2', {}, title), ...kids));
    const v = this.el.view, k = this.keep; this.keep = null;
    ((k && v.querySelector('#' + k)) || v.querySelector('[aria-pressed="true"]') || v.querySelector('button'))?.focus();
  }

  page_home() {
    this.el.view.replaceChildren(h('ul', { class: 'nav', role: 'list' }, ...this.menu.map(m => {
      const dev = m.status !== 'ready', name = t('menu.' + m.id);
      return h('li', {}, h('button', {
        class: 'nav-item' + (dev ? ' is-dev' : ''), 'aria-disabled': dev ? 'true' : null,
        onclick: () => dev ? this.toast(t('ui.dev', { name, phase: m.phase })) : this.go(m.id)
      }, h('span', { class: 'lbl' }, name), dev ? h('span', { class: 'tag' }, m.phase) : null));
    })));
    this.el.view.querySelector('.nav-item')?.focus({ preventScroll: true });
  }

  page_training() { this.mode = 'training'; this.page_play(); }

  page_play() {
    const me = this.roster[this.idx]; if (!this.roster[this.rival]) this.rival = (this.idx + 1) % this.roster.length;
    const rivals = this.roster.map((r, i) => [r, i]); // incluye al mismo guerrero: duelo espejo con su chroma especial
    this.panel(t('play.title'),
      h('p', { class: 'lead' }, me.name),
      h('p', { class: 'note' }, t('play.mode')),
      h('div', { class: 'tabs', role: 'group' }, ...[['cpu', 'play.cpu'], ['training', 'play.train']].map(([m, k]) => h('button', { 'aria-pressed': String(this.mode === m), onclick: () => { this.mode = m; this.page_play(); } }, t(k)))),
      ...(this.mode === 'training' ? [] : [h('p', { class: 'note' }, t('play.level')),
        h('div', { class: 'tabs', role: 'group', 'data-role': 'level' }, ...LEVEL_IDS.map(l => h('button', { id: 'lvl-' + l, 'aria-pressed': String((this.level || 'normal') === l), onclick: () => { this.level = l; this.onLevel?.(l); this.keep = 'lvl-' + l; this.page_play(); } }, t('level.' + l)))),
        h('p', { class: 'note lvl-desc' }, t('level.desc.' + (this.level || 'normal')))]),
      h('p', { class: 'note' }, t('play.rival')),
      h('div', { class: 'tabs', role: 'group', 'data-role': 'rival' }, ...rivals.map(([r, i]) => h('button', { 'aria-pressed': String(i === this.rival), onclick: () => { this.rival = i; this.page_play(); } }, r.name))),
      i18nMirror(this.roster[this.rival], me),
      h('button', { class: 'cta', onclick: () => this.onPlay?.(me.id, this.roster[this.rival].id, this.mode) }, t('play.go')),
      h('p', { class: 'note' }, t('play.controls')));
  }

  page_roster() {
    const d = this.roster[this.idx];
    this.panel(t('menu.roster'),
      h('div', { class: 'tabs', role: 'group' }, ...this.roster.map((r, i) => h('button', { 'aria-pressed': String(i === this.idx), onclick: () => this.select(i) }, r.name))),
      h('p', { class: 'lead' }, this.c(d, 'desc')),
      h('div', { class: 'stats' }, ...Object.entries(d.stats).map(([k, v]) => h('div', { class: 'stat' },
        h('span', {}, t('stat.' + k)), h('span', { class: 'bar' }, h('i', { style: `width:${v * 10}%` })), h('b', {}, `${v}/10`)))),
      h('dl', {}, ...['weapon', 'style', 'special', 'transformation'].flatMap(k => [h('dt', {}, t('field.' + k)), h('dd', {}, this.c(d, k))])),
      this.moveList(d),
      h('p', { class: 'note' }, t('ui.provisional', { title: d.provisional.title, author: d.provisional.author })));
  }

  // Lista de movimientos con entrada, salida (fotogramas), daño, propiedades y coste — sale de data/moves.json.
  moveList(d) {
    if (!this.moves) return null;
    const M = movesFor(this.moves, d.id), IN = { l: 'J', m: 'K', h: 'L', cl: '↓+J', cm: '↓+K', ch: '↓+L', jl: '↑ J', jm: '↑ K', jh: '↑ L', throw: 'J+K', gb: 'K+L', s: 'U · ↓↘→+J', ex: 'I' };
    const tags = m => [m.hit === 'low' || m.proj?.hit === 'low' ? t('mvt.low') : m.hit === 'high' ? t('mvt.high') : null, m.launch || m.proj?.launch ? t('mvt.launch') : null, m.kd || m.kdLast || m.proj?.kd ? t('mvt.kd') : null,
      m.proj ? t('mvt.proj') : null, m.armor ? t('mvt.armor') : null, m.inv ? t('mvt.inv') : null, m.pass ? t('mvt.pass') : null, m.pull || m.proj?.pull ? t('mvt.pull') : null, m.jc ? t('mvt.jc') : null, m.guardDmg >= 100 ? t('mvt.gb') : null].filter(Boolean).join(' · ');
    const name = (id, m) => m.name ? t('mv.' + m.name) : t('mv.' + id);
    return h('details', { class: 'moves' }, h('summary', {}, t('field.moves')),
      h('table', {}, h('tr', {}, ...['mvh.name', 'mvh.input', 'mvh.startup', 'mvh.dmg', 'mvh.notes'].map(k => h('th', {}, t(k)))),
        ...Object.keys(IN).filter(id => M[id]).map(id => { const m = M[id], dmg = m.proj ? m.proj.dmg * (m.proj.multi || 1) : m.dmg * (m.multi || 1);
          return h('tr', {}, h('td', {}, name(id, m)), h('td', {}, h('kbd', {}, IN[id])), h('td', {}, String(Math.round(m.startup * 60)) + 'f'), h('td', {}, String(Math.round(dmg))), h('td', {}, [tags(m), m.meter ? t('mvt.cost', { n: m.meter }) : ''].filter(Boolean).join(' · '))); })));
  }

  page_settings() {
    const s = this.settings.get();
    this.panel(t('menu.settings'),
      h('fieldset', {}, h('legend', {}, t('set.lang')), h('div', { class: 'tabs' }, ...[['es', 'Español'], ['en', 'English']].map(([c, n]) =>
        h('button', { id: 'lang-' + c, lang: c, 'aria-pressed': String(s.lang === c), onclick: () => { this.keep = 'lang-' + c; this.settings.set({ lang: c }); } }, n)))),
      h('fieldset', {}, h('legend', {}, t('set.quality')), h('div', { class: 'tabs' }, ...['low', 'medium', 'high'].map(q =>
        h('button', { 'aria-pressed': String(s.quality === q), onclick: () => { this.settings.set({ quality: q }); this.page_settings(); } }, t('set.q.' + q))))),
      h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: s.reduceMotion, onchange: e => this.settings.set({ reduceMotion: e.target.checked }) }), t('set.reduce')),
      h('p', { class: 'note' }, t('set.later')),
      h('button', { class: 'ghost', onclick: () => { this.settings.reset(); this.page_settings(); this.toast(t('set.reset')); } }, t('set.resetbtn')));
  }

  page_credits() {
    this.panel(t('menu.credits'),
      h('p', { class: 'lead' }, t('cr.project')),
      h('div', { class: 'cr-team' }, h('p', { class: 'lead' }, t('cr.team')), h('ul', { class: 'credits team' },
        h('li', {}, h('strong', { class: 'cr-name' }, 'Sara Andrade Rodriguez'), h('span', { class: 'cr-role' }, t('cr.dev'))),
        h('li', {}, h('strong', { class: 'cr-name' }, 'Claude'), h('span', { class: 'cr-role' }, t('cr.ai'))))),
      h('div', {}, h('p', { class: 'lead' }, t('cr.tools')), h('ul', { class: 'credits' }, h('li', {}, 'Three.js r170 (MIT) · threejs.org'), h('li', {}, 'Cinzel · Rajdhani (SIL Open Font License 1.1)'))),
      h('div', {}, h('p', { class: 'lead' }, t('cr.models')), h('ul', { class: 'credits' }, ...this.roster.map(r =>
        h('li', {}, h('a', { href: r.provisional.url, target: '_blank', rel: 'noopener' }, r.provisional.title), ` · ${r.provisional.author}`)))),
      h('p', { class: 'note' }, t('cr.note')));
  }
}
