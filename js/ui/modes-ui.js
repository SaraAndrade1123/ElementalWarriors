// Pantallas de los modos: Arcade/Supervivencia, Versus, Desafíos e Historia. Se "instalan" sobre el MenuManager sin modificar su archivo.
import { t } from '../systems/localization.js';
import { Ladder } from '../modes/ladder.js';
import { Survival } from '../modes/survival.js';
import { CHALLENGES, kindOf, rivalFor } from '../modes/challenges.js';
import { LEVEL_IDS } from '../game/difficulty-config.js';
import { RANDOM } from '../stages/stage-manager.js';
import { hasKeyboard, onKeyboard } from '../systems/keyboard-detect.js';
import { heroCard, section, totalBar, catTabs, trackItem, list as trackList, note as trackNote, rivalPicker, RAND, resolveRival } from './track-ui.js';

const h = (tag, props = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') e.className = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (v === true) e.setAttribute(k, ''); else if (v !== false && v != null) e.setAttribute(k, v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(c));
  return e;
};
const ROUNDS = [1, 3, 5], TIMES = [30, 60, 99, Infinity];

export function installModes(menu, { cfg, roster, stages, meta, flow }) {
  const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = 'css/modes.css'; document.head.append(css);
  const S = { tab: 'arcade', level: 'normal', vs: 'cpu', rival: 1, wins: 3, time: 60 }, MY = ['arcade', 'versus', 'challenges', 'story'];
  const data = () => meta.save.data, name = id => roster.find(r => r.id === id)?.name ?? id, me = () => roster[menu.idx];
  // 2 jugadores en el mismo dispositivo necesitan un teclado físico: se habilita en cuanto se detecta uno (aunque sea un celular con teclado Bluetooth).
  const noKeys = () => !hasKeyboard();
  onKeyboard(() => { if (menu.page === 'versus' && S.vs === 'local') { rerender(); menu.toast?.(t('versus.kbd.ok')); } });
  const rerender = () => menu['page_' + menu.page]();
  const sel = menu.select.bind(menu); menu.select = i => { sel(i); if (MY.includes(menu.page)) rerender(); }; // cambiar de guerrero actualiza la pantalla

  const tabs = (items, cur, pick, label, role = null) => h('div', { class: 'tabs', role: 'group', 'aria-label': label, 'data-role': role }, ...items.map(([v, text]) => h('button', { 'aria-pressed': String(v === cur), onclick: () => pick(v) }, text)));
  const note = k => h('p', { class: 'note' }, t(k));
  const heroTabs = () => tabs(roster.map((r, i) => [i, r.name]), menu.idx, i => menu.select(i), t('modes.hero'));
  const levelTabs = () => [tabs(LEVEL_IDS.map(l => [l, t('level.' + l)]), S.level, l => { S.level = l; rerender(); }, t('modes.level')), h('p', { class: 'note' }, t('level.desc.' + S.level))];

  // ---------- Arcade y Supervivencia
  menu.page_arcade = function () {
    const m = me(), arcade = S.tab === 'arcade', R = data().records, rec = arcade ? R.arcade : R.survival;
    const best = arcade ? (rec.score ? t('arcade.best', { n: rec.score.toLocaleString(), name: name(rec.char) }) : t('arcade.nobest'))
      : (rec.wins ? t('survival.best', { n: rec.wins, score: rec.score.toLocaleString(), name: name(rec.char) }) : t('survival.nobest'));
    this.panel(t('menu.arcade'),
      tabs([['arcade', t('arcade.tab.arcade')], ['survival', t('arcade.tab.survival')]], S.tab, v => { S.tab = v; rerender(); }),
      note('modes.hero'), heroTabs(), note('modes.level'), ...levelTabs(),
      h('p', { class: 'lead' }, arcade ? t('arcade.desc', { n: cfg.arcade.continues }) : t('survival.desc', { n: cfg.survival.escalateEvery })),
      arcade ? h('div', {}, note('arcade.ladder'), h('ol', { class: 'ladder' }, ...cfg.order[m.id].map((id, i, a) => h('li', {}, name(id), i === a.length - 1 ? h('span', { class: 'tag' }, t('arcade.final')) : null)))) : null,
      h('p', { class: 'note rec' }, best),
      h('button', { class: 'cta', onclick: () => flow.begin(arcade ? { kind: 'arcade', obj: new Ladder(cfg, { hero: m.id, level: S.level }) } : { kind: 'survival', obj: new Survival(cfg, { hero: m.id, level: S.level }) }) }, t(arcade ? 'arcade.start' : 'survival.start')));
  };

  // ---------- Versus (contra la CPU o 2 jugadores en el mismo teclado)
  menu.page_versus = function () {
    const m = me(); if (S.rival !== RAND && !roster[S.rival]) S.rival = (menu.idx + 1) % roster.length;
    menu.rival = S.rival; // la tabla de enfrentamiento elemental (y otras ayudas) leen el rival elegido aquí
    const local = S.vs === 'local', watch = S.vs === 'watch', blocked = local && noKeys(), cur = stages.selected;
    const st = [...stages.list.filter(s => stages.isUnlocked(s)).map(s => [s.id, t(`stage.${s.id}.name`)]), [RANDOM, t('stage.random')]];
    const relOf = r => menu.scene?.__elements?.matchup?.(m.id, r.id)?.[0]?.rel;
    const go = () => flow.begin({ kind: 'plain', cfg: { a: m.id, b: roster[resolveRival(S.rival, roster)].id, mode: local ? 'versus' : 'cpu', rec: local ? 'versus_local' : watch ? 'training' : 'versus_ai', watch, level: S.level, wins: (S.wins + 1) / 2, maxRounds: S.wins + 2, roundTime: S.time } });
    this.panel(t('menu.versus'),
      tabs([['cpu', t('versus.tab.cpu')], ['local', t('versus.tab.local')], ['watch', t('versus.tab.watch')]], S.vs, v => { S.vs = v; rerender(); }),
      watch ? note('versus.watch.desc') : null,
      note(watch ? 'versus.watch.a' : 'versus.p1'), heroTabs(),
      note(local ? 'versus.p2' : watch ? 'versus.watch.b' : 'versus.rival'), // el mismo guerrero = duelo espejo · «Aleatorio» se decide al empezar
      rivalPicker({ roster, me: m, cur: S.rival, pick: i => { S.rival = i; rerender(); }, label: t('versus.rival'), relOf: local ? null : relOf, who: local ? t('rival.random.p2') : null }),
      h('p', { class: 'note' + (S.rival === menu.idx ? ' mirror-note' : '') }, S.rival === RAND ? t('rival.random.desc') : S.rival === menu.idx ? t('play.mirror', { name: m.name }) : t('versus.same')),
      ...(local ? [] : [note('modes.level'), ...levelTabs()]),
      note('versus.rounds'), tabs(ROUNDS.map(n => [n, String(n)]), S.wins, n => { S.wins = n; rerender(); }, t('versus.rounds')),
      note('versus.time'), tabs(TIMES.map(n => [n, Number.isFinite(n) ? `${n} s` : t('versus.time.inf')]), S.time, n => { S.time = n; rerender(); }, t('versus.time')),
      note('versus.stage'), tabs(st, cur, id => { stages.select(id); rerender(); }, t('versus.stage')),
      local ? h('div', { class: 'ctl' }, h('p', { class: 'note' }, t('versus.controls')), h('p', { class: 'note' }, t('versus.ghost'))) : null,
      blocked ? h('p', { class: 'note warn kbd' }, h('b', {}, t('versus.kbd.title')), h('span', {}, t('versus.touch'))) : local ? h('p', { class: 'note ok kbd' }, t('versus.kbd.found')) : null,
      h('button', { class: 'cta', 'aria-disabled': blocked ? 'true' : null, onclick: () => (blocked ? this.toast(t('versus.touch')) : go()) }, t('versus.start')));
  };

  // ---------- Desafíos: por categorías (técnica, combate contra la CPU, modos y 2 jugadores) con su recompensa
  let chTab = 'train';
  menu.page_challenges = function () {
    // (v1.9) misma lógica e interfaz que los Logros: sección, barra total, pestañas con cuenta, fichas con medalla y recompensa
    const m = me(), done = data().challenges, eco = meta.progression.eco.challenge ?? 0;
    const cats = ['train', 'fight', 'mode', 'pvp'].map(k => { const all = CHALLENGES.filter(c => kindOf(c) === k); return { id: k, label: t('challenges.cat.' + k), done: all.filter(c => done.includes(c.id)).length, total: all.length }; });
    const total = CHALLENGES.filter(c => done.includes(c.id)), gold = total.reduce((n, c) => n + (c.gold ?? eco), 0);
    const tierOf = c => { const g = c.gold ?? eco; return g >= 220 ? 'platinum' : g >= 120 ? 'gold' : g >= 60 ? 'silver' : 'bronze'; };
    const start = c => kindOf(c) === 'train' || kindOf(c) === 'fight' ? flow.begin({ kind: 'challenge', def: c, hero: m.id, rival: kindOf(c) === 'fight' ? rivalFor(c, m.id, roster) : roster[(menu.idx + 1) % roster.length].id }) : this.go(c.go);
    const items = CHALLENGES.filter(c => kindOf(c) === chTab).map(c => {
      const ok = done.includes(c.id), kind = kindOf(c), lvl = kind === 'fight' && c.level !== 'normal' ? t('level.' + c.level) : null, play = kind === 'train' || kind === 'fight';
      return trackItem({ tier: tierOf(c), done: ok, kind, name: t(`ch.${c.id}.name`), desc: t(`ch.${c.id}.goal`), reward: c.gold ?? eco,
        tags: [lvl ? { cls: 'lvl', text: lvl } : null, { cls: 'kind', text: t('challenges.cat.' + kind) }].filter(Boolean),
        action: { label: ok && play ? t('challenges.again') : play ? t('challenges.start') : t('challenges.go'), fn: () => start(c) } });
    });
    this.panel(t('menu.challenges'),
      heroCard(m, t('challenges.with')), heroTabs(),
      section(t('challenges.title'), t('challenges.sub', { a: total.length, b: CHALLENGES.length, g: gold.toLocaleString() })), totalBar(total.length, CHALLENGES.length),
      catTabs(cats, chTab, k => { chTab = k; rerender(); }, t('menu.challenges')),
      trackNote(t('challenges.desc.' + chTab)), trackList(items));
  };

  // ---------- Historia
  menu.page_story = function () {
    const m = me(), order = cfg.order[m.id], got = Math.min(order.length, data().story[m.id] || 0), L = i => new Ladder(cfg, { kind: 'story', hero: m.id, level: S.level, from: i });
    const play = i => flow.begin({ kind: 'story', obj: L(i), from: i });
    this.panel(t('menu.story'), heroCard(m, t('story.with')), heroTabs(), h('p', { class: 'note' }, t('story.intro', { name: m.name })), note('modes.level'), ...levelTabs(),
      h('p', { class: 'note' }, t('story.progress', { a: got, b: order.length })),
      h('ol', { class: 'ladder chapters' }, ...order.map((id, i) => {
        const open = i <= got, done = i < got;
        return h('li', { class: done ? 'done' : open ? '' : 'lock' }, h('span', {}, t(i === order.length - 1 ? 'story.chapter.final' : 'story.chapter', { n: i + 1, name: name(id) })),
          h('span', { class: 'acts' }, done ? h('span', { class: 'tag ok' }, t('story.done')) : null, open ? h('button', { class: 'mini', onclick: () => play(i) }, t('story.play')) : h('span', { class: 'tag' }, t('story.locked'))));
      })),
      got > 0 && got < order.length
        ? h('div', { class: 'row story-acts' }, h('button', { class: 'cta', onclick: () => play(got) }, t('story.continue', { n: got + 1 })), h('button', { class: 'ghost restart', onclick: () => play(0) }, t('story.restart')))
        : h('button', { class: 'cta', onclick: () => play(0) }, t('story.start')));
  };
}
