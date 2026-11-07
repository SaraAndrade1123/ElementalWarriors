import { LEVEL_IDS } from '../game/difficulty-config.js';
import { t } from '../systems/localization.js';
import { movesFor } from '../game/fighter.js';

import { heroCard, rivalPicker, RAND, resolveRival } from './track-ui.js';
export { heroCard };
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
    this.el.view.replaceChildren(this.profile?.() || '', h('ul', { class: 'nav', role: 'list' }, ...this.menu.map(m => {
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
    const me = this.roster[this.idx]; if (this.rival !== RAND && !this.roster[this.rival]) this.rival = (this.idx + 1) % this.roster.length;
    const relOf = r => this.scene?.__elements?.matchup?.(me.id, r.id)?.[0]?.rel; // incluye al mismo guerrero: duelo espejo con su chroma especial
    this.panel(t('play.title'),
      heroCard(me, t('play.with')),
      h('p', { class: 'note' }, t('play.mode')),
      h('div', { class: 'tabs', role: 'group' }, ...[['cpu', 'play.cpu'], ['training', 'play.train']].map(([m, k]) => h('button', { 'aria-pressed': String(this.mode === m), onclick: () => { this.mode = m; this.page_play(); } }, t(k)))),
      ...(this.mode === 'training' ? [] : [h('p', { class: 'note' }, t('play.level')),
        h('div', { class: 'tabs', role: 'group', 'data-role': 'level' }, ...LEVEL_IDS.map(l => h('button', { id: 'lvl-' + l, 'aria-pressed': String((this.level || 'normal') === l), onclick: () => { this.level = l; this.onLevel?.(l); this.keep = 'lvl-' + l; this.page_play(); } }, t('level.' + l)))),
        h('p', { class: 'note lvl-desc' }, t('level.desc.' + (this.level || 'normal')))]),
      h('p', { class: 'note' }, t('play.rival')),
      rivalPicker({ roster: this.roster, me, cur: this.rival, pick: i => { this.rival = i; this.keep = null; this.page_play(); }, label: t('play.rival'), relOf }),
      this.rival === RAND ? h('p', { class: 'note' }, t('rival.random.desc')) : i18nMirror(this.roster[this.rival], me),
      h('button', { class: 'cta', onclick: () => this.onPlay?.(me.id, this.roster[resolveRival(this.rival, this.roster)].id, this.mode) }, t('play.go')),
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
      h('details', { class: 'moves lore' }, h('summary', {}, t('field.story')), h('p', { class: 'note story-txt' }, t(`char.${d.id}.story`))), // (v1.9) historia del guerrero
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
          return h('tr', {}, h('td', { class: 'mvn' }, name(id, m)), h('td', { class: 'mvi' }, h('kbd', {}, IN[id])), h('td', { class: 'mvs', 'data-l': t('mvh.startup') }, String(Math.round(m.startup * 60)) + 'f'), h('td', { class: 'mvd', 'data-l': t('mvh.dmg') }, String(Math.round(dmg))), h('td', { class: 'mvp' }, [tags(m), m.meter ? t('mvt.cost', { n: m.meter }) : ''].filter(Boolean).join(' · '))); })));
  }

  page_settings() {
    const s = this.settings.get();
    this.panel(t('menu.settings'),
      h('fieldset', {}, h('legend', {}, t('set.lang')), h('div', { class: 'tabs' }, ...[['es', 'Español'], ['en', 'English']].map(([c, n]) =>
        h('button', { id: 'lang-' + c, lang: c, 'aria-pressed': String(s.lang === c), onclick: () => { this.keep = 'lang-' + c; this.settings.set({ lang: c }); } }, n)))),
      h('fieldset', {}, h('legend', {}, t('set.quality')), h('div', { class: 'tabs' }, ...['low', 'medium', 'high'].map(q =>
        h('button', { 'aria-pressed': String(s.quality === q), onclick: () => { this.settings.set({ quality: q }); this.page_settings(); } }, t('set.q.' + q))))),
      h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: s.reduceMotion, onchange: e => this.settings.set({ reduceMotion: e.target.checked }) }), t('set.reduce')),
      h('button', { class: 'ghost', onclick: () => { this.settings.reset(); this.page_settings(); this.toast(t('set.reset')); } }, t('set.resetbtn')));
  }

  page_credits() {
    // (v1.9) créditos completos: proyecto, equipo, cifras reales, tecnologías, audio y gráficos originales, modelos y licencias
    const sec = (k, ...kids) => h('section', { class: 'cr-sec' }, h('h3', { class: 'cr-h' }, t('cr.' + k)), ...kids);
    const li = (...a) => h('li', {}, ...a), ul = (...a) => h('ul', { class: 'credits' }, ...a);
    const n = this.counts?.() || {};
    const facts = [['roster', this.roster.length], ['stages', n.stages], ['moves', n.moves], ['challenges', n.challenges], ['achievements', n.achievements], ['items', n.items], ['songs', n.songs], ['chromas', n.chromas]].filter(([, v]) => v);
    this.panel(t('menu.credits'),
      h('div', { class: 'cr-hero' }, h('b', {}, 'Elemental Warriors'), h('span', {}, t('cr.tagline')), h('small', {}, t('cr.project') + ' · ' + (document.querySelector('.ver')?.textContent || ''))),
      sec('team', h('ul', { class: 'credits team' },
        h('li', {}, h('strong', { class: 'cr-name' }, 'Sara Andrade Rodriguez'), h('span', { class: 'cr-role' }, t('cr.dev')), h('span', { class: 'cr-desc' }, t('cr.dev.desc'))),
        h('li', {}, h('strong', { class: 'cr-name' }, 'Claude'), h('span', { class: 'cr-role' }, t('cr.ai')), h('span', { class: 'cr-desc' }, t('cr.ai.desc'))))),
      sec('facts', h('div', { class: 'stiles' }, ...facts.map(([k, v]) => h('div', { class: 'stile' }, h('b', {}, String(v)), h('span', {}, t('cr.f.' + k)))))),
      sec('tools', ul(li(h('b', {}, 'Three.js r170'), ' — WebGL · MIT · threejs.org'), li(h('b', {}, 'Web Audio API'), ' — ' + t('cr.t.audio')), li(h('b', {}, 'HTML5 · CSS3 · JavaScript (ES2020)'), ' — ' + t('cr.t.web')),
        li(h('b', {}, 'Node.js · esbuild'), ' — ' + t('cr.t.build')), li(h('b', {}, 'Playwright · Chromium'), ' — ' + t('cr.t.qa')), li(h('b', {}, 'Python · Pillow'), ' — ' + t('cr.t.py')))),
      sec('original', ul(li(t('cr.o.anim')), li(t('cr.o.music')), li(t('cr.o.sfx')), li(t('cr.o.vfx')), li(t('cr.o.stages')), li(t('cr.o.ui')))),
      sec('fonts', ul(li(h('b', {}, 'Cinzel'), ' — Natanael Gama · SIL Open Font License 1.1'), li(h('b', {}, 'Rajdhani'), ' — Indian Type Foundry · SIL Open Font License 1.1'))),
      sec('models', ul(...this.roster.map(r => li(h('b', {}, r.name + ': '), h('a', { href: r.provisional.url, target: '_blank', rel: 'noopener' }, r.provisional.title), ` · ${r.provisional.author} · ${r.provisional.license || 'CC BY 4.0'}`))),
        h('p', { class: 'note' }, t('cr.note'))),
      sec('inspiration', h('p', { class: 'note' }, t('cr.insp'))),
      sec('thanks', h('p', { class: 'note' }, t('cr.thanks.p'))),
      h('p', { class: 'note cr-legal' }, t('cr.legal')));
  }

}
