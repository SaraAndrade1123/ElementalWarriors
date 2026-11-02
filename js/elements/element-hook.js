// Adaptador del TRIÁNGULO ELEMENTAL ↔ juego (mismo patrón que stage-hook.js y audio-hook.js).
// NO edita fighter.js, match.js, scene-manager.js ni menu-manager.js: envuelve instancias. Solo necesita que existan:
//   · scene.startMatch(...) y scene.match.f = [Fighter, Fighter]   (cada Fighter con def, atk, moves y gain())
//   · opcional: match.step / onHit / note / newRound / o.onHud      (si faltan, solo se pierde el aviso correspondiente)
//   · opcional: menu.el.view, menu.page, menu.roster, menu.idx, menu.rival   (decoración de menús)
// Por eso sigue funcionando con versiones del juego que cambien los modos (F7): cualquier combate que se cree con
// scene.startMatch recibe las ventajas, y si un modo cambia de rival dentro del mismo Match se recalcula solo.
// Instalar (main.js, después de crear menu y scene):  installElements({ menu, scene, roster });
import { t, getLang } from '../systems/localization.js';
import { mirrorName } from '../systems/mirror-spec.js';
import { normalizeElements, matchup, applyMatchup, elementOf, cycleOf, beatsOf, pct } from '../game/elements.js';

// Textos de respaldo: si data/localization aún no tiene las claves (p. ej. en otra versión), se usan estos.
const FALLBACK = {
  es: {
    'elem.fire': 'Fuego', 'elem.water': 'Agua', 'elem.wind': 'Aire', 'elem.earth': 'Tierra',
    'elem.rel.advantage': 'Ventaja', 'elem.rel.neutral': 'Neutro', 'elem.rel.disadvantage': 'Desventaja',
    'elem.title': 'Triángulo elemental', 'elem.field': 'Elemento', 'elem.matchup': 'Enfrentamiento elemental',
    'elem.beats': '{a} le gana a {b}', 'elem.neutralRule': '{a} es neutro: no tiene ventajas ni desventajas e inflige y recibe siempre daño estándar (100 %).',
    'elem.strong': 'Fuerte contra', 'elem.weak': 'Débil contra', 'elem.none': 'Nadie (neutro)',
    'elem.stat.dealt': 'Daño que inflige', 'elem.stat.taken': 'Daño que recibe', 'elem.stat.guard': 'Desgaste de guardia', 'elem.stat.resonance': 'Ganancia de Resonancia',
    'elem.sum.advantage': '{name} tiene ventaja elemental', 'elem.sum.disadvantage': '{name} tiene desventaja elemental', 'elem.sum.neutral': 'Sin ventaja elemental: daño estándar (100 %)',
    'elem.note': 'Solo cambian el daño, la guardia y la Resonancia: los tiempos, el alcance y los combos son los mismos.',
    'hud.elem.adv': '¡VENTAJA ELEMENTAL!', 'hud.elem.effective': '¡EFICAZ!', 'hud.elem.resisted': 'RESISTIDO',
  },
  en: {
    'elem.fire': 'Fire', 'elem.water': 'Water', 'elem.wind': 'Air', 'elem.earth': 'Earth',
    'elem.rel.advantage': 'Advantage', 'elem.rel.neutral': 'Neutral', 'elem.rel.disadvantage': 'Disadvantage',
    'elem.title': 'Elemental triangle', 'elem.field': 'Element', 'elem.matchup': 'Elemental matchup',
    'elem.beats': '{a} beats {b}', 'elem.neutralRule': '{a} is neutral: no advantages or disadvantages, always dealing and taking standard damage (100%).',
    'elem.strong': 'Strong against', 'elem.weak': 'Weak against', 'elem.none': 'Nobody (neutral)',
    'elem.stat.dealt': 'Damage dealt', 'elem.stat.taken': 'Damage taken', 'elem.stat.guard': 'Guard wear', 'elem.stat.resonance': 'Resonance gain',
    'elem.sum.advantage': '{name} has the elemental advantage', 'elem.sum.disadvantage': '{name} has the elemental disadvantage', 'elem.sum.neutral': 'No elemental advantage: standard damage (100%)',
    'elem.note': 'Only damage, guard and Resonance change: timings, reach and combos stay the same.',
    'hud.elem.adv': 'ELEMENTAL ADVANTAGE!', 'hud.elem.effective': 'EFFECTIVE!', 'hud.elem.resisted': 'RESISTED',
  },
};
export const ELEMENT_TEXTS = FALLBACK;
const fill = (s, v = {}) => s.replace(/\{(\w+)\}/g, (_, n) => v[n] ?? '');
export const tx = (k, v) => { const s = t(k, v); if (s !== k) return s; let L = 'es'; try { L = getLang(); } catch { /* */ } return fill(FALLBACK[L]?.[k] ?? FALLBACK.es[k] ?? k, v); };

const REL_MARK = { advantage: '▲', neutral: '=', disadvantage: '▼' };
const NOTE_COOLDOWN = 3; // segundos entre avisos «¡EFICAZ!» del mismo lado

export function installElements({ menu = null, scene, roster = menu?.roster || [], data = null, url = 'data/elements.json', doc = globalThis.document } = {}) {
  if (!scene) throw new Error('installElements: falta scene');
  if (scene.__elements) return scene.__elements;
  let R = normalizeElements(data).rules;
  const hasDom = !!doc?.createElement && typeof doc.getElementById === 'function';
  const h = (tag, props = {}, ...kids) => {
    const e = doc.createElement(tag);
    for (const [k, v] of Object.entries(props)) { if (k === 'class') e.className = v; else if (k === 'style') e.setAttribute('style', v); else if (v != null && v !== false) e.setAttribute(k, v === true ? '' : v); }
    for (const c of kids.flat()) if (c != null && c !== false) e.append(c.nodeType ? c : doc.createTextNode(String(c)));
    return e;
  };
  const defOf = id => roster.find(r => r.id === id) || (typeof id === 'object' ? id : null);
  const elName = el => tx('elem.' + el), elIcon = el => R.elements[el]?.icon || '◆', elColor = el => R.elements[el]?.color || '#b5b9c2';
  const pair = () => { // pareja seleccionada en el menú (F7 puede sustituir api.pair por la suya)
    const me = roster[menu?.idx], foe = roster[menu?.rival];
    return me && foe ? [me, foe] : null; // el mismo guerrero también vale: duelo espejo
  };

  const api = {
    get rules() { return R; },
    setRules(d) { const n = normalizeElements(d); n.problems.forEach(p => console.warn('[elementos]', p)); R = n.rules; if (scene.match?.__elem) scene.match.__elem.fa = null; refreshMenu(); return n.problems; },
    elementOf: id => elementOf(defOf(id), R),
    matchup: (a, b) => matchup(defOf(a), defOf(b), R),
    apply: m => hookMatch(m),
    pair,
    // Piezas de interfaz reutilizables por otras pantallas (selección de arcade, versus local, supervivencia...)
    badge: (id, rel) => hasDom ? badge(elementOf(defOf(id), R), rel) : null,
    panel: (a, b) => hasDom ? matchPanel(defOf(a), defOf(b)) : null,
    info: id => hasDom ? infoBlock(defOf(id)) : null,
    triangle: hi => hasDom ? triangle(hi) : null,
  };
  scene.__elements = api;
  if (!data && url && typeof fetch === 'function') fetch(url).then(r => r.ok ? r.json() : null).then(d => { if (d) api.setRules(d); }).catch(e => console.warn('[elementos] no se pudo leer', url, e));
  if (hasDom && !doc.querySelector?.('link[data-elements]')) { const l = h('link', { rel: 'stylesheet', href: 'css/elements.css', 'data-elements': '1' }); doc.head?.append(l); }

  // ───────── 1) Combate ─────────
  const start = scene.startMatch.bind(scene);
  scene.startMatch = function (...args) {
    const r = start(...args);
    try { hookMatch(this.match); } catch (e) { console.warn('[elementos] no se pudo aplicar al combate', e); }
    return r;
  };

  function ensure(m) { // aplica (o vuelve a aplicar si cambió algún luchador) la relación elemental
    const st = m.__elem, [a, b] = m.f || [];
    if (!a || !b || (st.fa === a && st.fb === b && st.ra === a.def && st.rb === b.def)) return false;
    applyMatchup(a, b, R); Object.assign(st, { fa: a, fb: b, ra: a.def, rb: b.def, announced: false }); hudBadges(m);
    return true;
  }
  function hookMatch(m) {
    if (!m?.f) return null;
    if (m.__elem) { ensure(m); return m.f.map(f => f.elem); }
    const st = m.__elem = { fa: null, fb: null, announced: false, cool: [-9, -9] };
    ensure(m);
    if (typeof m.step === 'function') {
      const step = m.step;
      m.step = function (dt) {
        ensure(this); const r = step.call(this, dt);
        if (!st.announced && this.phase === 'fight') { st.announced = true; announce(this); }
        return r;
      };
    }
    if (typeof m.newRound === 'function') { const nr = m.newRound; m.newRound = function (...a) { const r = nr.apply(this, a); st.announced = false; return r; }; }
    if (typeof m.onHit === 'function') {
      const oh = m.onHit;
      m.onHit = function (ev, idx) {
        const r = oh.call(this, ev, idx);
        try {
          const info = this.f?.[idx]?.elem;
          if (info && info.rel !== 'neutral' && ev && !ev.blocked && !ev.armored && !ev.crush && ev.dmg > 0 && ev.combo === 0 && (this.t ?? 0) - st.cool[idx] >= NOTE_COOLDOWN) {
            st.cool[idx] = this.t ?? 0;
            this.note?.(tx(info.rel === 'advantage' ? 'hud.elem.effective' : 'hud.elem.resisted'), idx, 'elem-' + info.rel);
          }
        } catch (e) { console.warn('[elementos]', e); }
        return r;
      };
    }
    if (m.o) { // HUD: añade el estado elemental al resumen y líneas a la depuración (F1)
      const onHud = m.o.onHud;
      m.o.onHud = function (s) {
        try {
          s.elem = m.f.map(f => f.elem ? { el: f.elem.el, rel: f.elem.rel, dealt: f.elem.dealt, taken: f.elem.taken } : null);
          if (s.dbg) s.dbg = [...s.dbg, ...m.f.map((f, i) => f.elem ? `P${i + 1} ${elName(f.elem.el)} · ${tx('elem.rel.' + f.elem.rel)} · ${tx('elem.stat.dealt')} ${pct(f.elem.dealt)} · ${tx('elem.stat.taken')} ${pct(f.elem.taken)} · atk ${f.atk.toFixed(3)}` : '')];
        } catch (e) { console.warn('[elementos]', e); }
        return onHud?.call(this, s);
      };
    }
    return m.f.map(f => f.elem);
  }
  function announce(m) {
    const i = m.f.findIndex(f => f.elem?.rel === 'advantage');
    if (i >= 0) m.note?.(`${elIcon(m.f[i].elem.el)} ${tx('hud.elem.adv')}`, i, 'elem-advantage');
  }

  // ───────── 2) Interfaz ─────────
  function badge(el, rel) {
    const b = h('span', { class: 'elbadge' + (rel ? ' rel-' + rel : ''), style: `--elc:${elColor(el)}`, title: elName(el) },
      h('span', { class: 'elgem', 'aria-hidden': 'true' }), h('span', { class: 'elname' }, elName(el)));
    if (rel) b.append(h('span', { class: 'elrel' }, `${REL_MARK[rel]} ${tx('elem.rel.' + rel)}`));
    return b;
  }
  function hudBadges(m) {
    if (!hasDom) return;
    m.f.forEach((f, i) => {
      const n = doc.getElementById('hud-n' + (i + 1)); if (!n || !f.elem) return;
      let line = n.parentElement?.classList.contains('nameline') ? n.parentElement : null;
      if (!line) { line = h('div', { class: 'nameline' }); n.replaceWith(line); line.append(n); }
      line.querySelector('.elbadge')?.remove();
      line.append(badge(f.elem.el, f.elem.rel));
    });
  }
  // Tabla compacta: una fila por estadística y una columna por luchador. ▲ verde = le favorece, ▼ rojo = le perjudica.
  const cell = (v, lowerIsBetter = false) => { const good = lowerIsBetter ? v < 1 - 1e-9 : v > 1 + 1e-9, bad = lowerIsBetter ? v > 1 + 1e-9 : v < 1 - 1e-9;
    return h('b', { class: 'elv' + (good ? ' up' : bad ? ' down' : '') }, (good ? '▲ ' : bad ? '▼ ' : '') + pct(v)); };
  function matchPanel(a, b) {
    if (!a || !b) return null;
    const [ia, ib] = matchup(a, b, R), lead = ia.rel === 'advantage' ? a : ib.rel === 'advantage' ? b : null;
    const mirror = a.id === b.id; // duelo espejo: el segundo es el eco con chroma especial
    const head = (d, i, second) => h('div', { class: 'elhead rel-' + i.rel, title: `${elName(i.el)} · ${tx('elem.rel.' + i.rel)}` }, h('strong', {}, second && mirror ? mirrorName(d, tx) : d.name),
      h('span', { class: 'elbadge rel-' + i.rel, style: `--elc:${elColor(i.el)}` }, h('span', { class: 'elgem', 'aria-hidden': 'true' }), h('span', { class: 'elrel' }, REL_MARK[i.rel] + ' ' + elName(i.el))));
    const rows = [['elem.stat.dealt', i => i.dealt], ['elem.stat.taken', i => i.taken, true], ['elem.stat.guard', i => i.mods.guard], ['elem.stat.resonance', i => i.mods.resonance]];
    return h('div', { class: 'elmatch', 'data-elements': 'match' },
      h('p', { class: 'note' }, tx('elem.matchup')),
      h('p', { class: 'elsum' + (lead ? '' : ' neutral') }, lead ? tx('elem.sum.advantage', { name: lead.name }) : tx('elem.sum.neutral')),
      h('div', { class: 'eltable' }, h('span', {}), head(a, ia), head(b, ib, true),
        ...rows.flatMap(([k, f, low]) => [h('span', { class: 'elk' }, tx(k)), cell(f(ia), low), cell(f(ib), low)])),
      h('p', { class: 'note small' }, tx('elem.note')));
  }
  function infoBlock(d) {
    if (!d) return null;
    const el = elementOf(d, R), E = R.elements[el];
    return h('div', { class: 'elinfo', 'data-elements': 'info' },
      h('p', { class: 'note' }, tx('elem.title')),
      h('div', { class: 'elinfo-grid' },
        triangle(el),
        h('dl', { class: 'elrules' },
          h('dt', {}, tx('elem.field')), h('dd', {}, badge(el)))), // sin «fuerte contra / débil contra»: el triángulo ya lo muestra
      h('p', { class: 'note small' }, E?.neutral ? tx('elem.neutralRule', { a: elName(el) }) : cycleOf(R).map(x => tx('elem.beats', { a: elName(x), b: elName(beatsOf(x, R)) })).join(' · ')));
  }
  function triangle(hi) {
    const NS = 'http://www.w3.org/2000/svg', s = (tag, at = {}, ...kids) => { const e = doc.createElementNS(NS, tag); for (const [k, v] of Object.entries(at)) e.setAttribute(k, v); kids.forEach(k => e.append(k.nodeType ? k : doc.createTextNode(k))); return e; };
    const cyc = cycleOf(R), W = 200, H = 190, cx = 100, cy = 104, rad = 74, P = {};
    cyc.forEach((el, i) => { const a = -Math.PI / 2 + i * 2 * Math.PI / cyc.length; P[el] = [cx + Math.cos(a) * rad, cy + Math.sin(a) * rad]; });
    const svg = s('svg', { class: 'eltri', viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': cyc.map(x => tx('elem.beats', { a: elName(x), b: elName(beatsOf(x, R)) })).join('. ') });
    svg.append(s('defs', {}, s('marker', { id: 'elarrow', viewBox: '0 0 10 10', refX: '8', refY: '5', markerWidth: '7', markerHeight: '7', orient: 'auto-start-reverse' }, s('path', { d: 'M0 0L10 5L0 10z', fill: 'currentColor' }))));
    for (const el of cyc) { // flecha del ganador al perdedor
      const [x0, y0] = P[el], [x1, y1] = P[beatsOf(el, R)], dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy), k = 24 / L;
      svg.append(s('line', { x1: x0 + dx * k, y1: y0 + dy * k, x2: x1 - dx * k, y2: y1 - dy * k, class: 'elarr', 'marker-end': 'url(#elarrow)' }));
    }
    const node = (el, x, y) => s('g', { class: 'elnode' + (el === hi ? ' on' : ''), style: `--elc:${elColor(el)}` },
      s('circle', { cx: x, cy: y, r: 19 }), s('text', { x, y: y + 6, 'text-anchor': 'middle', class: 'elti' }, elIcon(el)),
      s('text', { x, y: y + (y < cy - 10 ? -25 : 33), 'text-anchor': 'middle', class: 'eltn' }, elName(el)));
    for (const el of cyc) svg.append(node(el, ...P[el]));
    for (const [el, E] of Object.entries(R.elements)) if (E.neutral) { svg.append(node(el, cx, cy - 8)); }
    return svg;
  }

  // Decoración automática de los menús (observa el contenido: no depende de los nombres de las páginas).
  //   · todo botón con el nombre de un guerrero recibe una gema del color de su elemento (sin emojis);
  //   · en un grupo de rivales (data-role="rival", o botones de guerreros SIN el guerrero actual) se añade ▲ / ▼ / = respecto al actual;
  //   · en las escaleras de Arcade / Historia (ol.ladder li) cada rival muestra su relación;
  //   · en las pantallas de combate suelto (Jugar, Entrenamiento, Versus) se añade la tabla de enfrentamiento.
  const PLAY = new Set(['play', 'training', 'versus', 'cpu']);
  const relTag = (me, r) => { const rel = matchup(me, r, R)[0].rel; return h('span', { class: 'elrel-mini rel-' + rel, title: tx('elem.rel.' + rel) }, ' ' + REL_MARK[rel]); };
  function decorate() {
    if (!hasDom || !menu?.el?.view) return;
    const v = menu.el.view, names = new Map(roster.map(r => [r.name, r])), me = roster[menu.idx], inPlay = PLAY.has(menu.page);
    for (const b of v.querySelectorAll('button:not([data-el])')) { // sin emojis junto al nombre: solo una gema del color del elemento
      const r = names.get(b.textContent.trim()); if (!r) continue;
      b.dataset.el = elementOf(r, R); b.dataset.name = r.name; b.style.setProperty('--elc', elColor(b.dataset.el)); b.title = elName(b.dataset.el);
      b.prepend(h('span', { class: 'elgem', 'aria-hidden': 'true' }));
    }
    if (me) for (const g of v.querySelectorAll('.tabs:not([data-elrel])')) { // grupo de rivales (marcado con data-role="rival"; si no, el que no incluye al actual)
      const bs = [...g.querySelectorAll('button[data-el]')]; if (bs.length < 2 || bs.length !== g.querySelectorAll('button').length) continue;
      const marked = g.dataset.role === 'rival', rs = bs.map(b => names.get(b.dataset.name)); if (rs.some(r => !r) || (!marked && rs.some(r => r.id === me.id))) continue;
      g.dataset.elrel = '1'; bs.forEach((b, i) => b.append(relTag(me, rs[i])));
    }
    if (me) for (const li of v.querySelectorAll('ol.ladder li:not([data-el])')) {
      const r = roster.find(x => x.id !== me.id && li.textContent.includes(x.name)); if (!r) continue;
      li.dataset.el = elementOf(r, R); const node = [...li.childNodes].find(n => n.textContent.includes(r.name)) || li.firstChild; if (!node) continue;
      li.style.setProperty('--elc', elColor(li.dataset.el)); node.before(h('span', { class: 'elgem', 'aria-hidden': 'true' })); node.after(relTag(me, r));
    }
    const p = pair();
    if (inPlay && p && !v.querySelector('[data-elements="match"]')) { const cta = v.querySelector('.cta'), panel = matchPanel(...p); if (cta) cta.before(panel); else v.querySelector('.panel')?.append(panel); }
    if (menu.page === 'roster' && me && !v.querySelector('[data-elements="info"]')) { const at = v.querySelector('.stats'); const blk = infoBlock(me); if (at) at.after(blk); else v.querySelector('.panel')?.append(blk); }
  }
  function decorateHeader() {
    const e = menu?.el?.elem; if (!hasDom || !e || e.querySelector('.elico')) return;
    const d = roster[menu.idx]; if (!d) return; const el = elementOf(d, R);
    e.prepend(h('span', { class: 'elico', 'aria-hidden': 'true' })); // marcador (sin emoji) para no decorar dos veces
    if (R.elements[el]?.neutral) e.append(h('span', { class: 'elrel-mini rel-neutral' }, ' · ' + tx('elem.rel.neutral')));
  }
  function refreshMenu() { // reglas nuevas: vuelve a pintar la pantalla actual del menú (si ya se está mostrando)
    if (!hasDom || !menu?.el?.view?.children.length || menu.enabled === false) return;
    if (typeof menu.refresh === 'function') menu.refresh(); else { decorate(); decorateHeader(); }
  }
  if (hasDom && typeof MutationObserver === 'function' && menu?.el) {
    if (menu.el.view) new MutationObserver(decorate).observe(menu.el.view, { childList: true });
    if (menu.el.elem) new MutationObserver(decorateHeader).observe(menu.el.elem, { childList: true });
    decorate(); decorateHeader();
  }
  return api;
}
