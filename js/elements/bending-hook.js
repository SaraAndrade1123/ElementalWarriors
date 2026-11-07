// Adaptador del CONTROL ELEMENTAL ↔ juego (mismo patrón que element-hook.js, stage-hook.js y audio-hook.js).
// NO edita fighter.js, match.js, ai.js, scene-manager.js ni menu-manager.js. Necesita lo que existe desde F3/F4:
//   · scene.startMatch(id1, id2, input, opts) con opts.moves, y scene.match con f[], v[].c.anim, vfx, step(), proj[]
//   · Fighter.prototype.update/_choose/_can y CpuBrain.prototype.think (si faltan, avisa y solo se pierde esa parte)
// Instalar (main.js, después de installElements):  installBending({ menu, scene, roster });
import { Fighter, RULES, movesFor } from '../game/fighter.js';
import * as AI from '../game/ai.js';
import { mergeBending, patchFighter, patchCpu, stepBending, BEND_IDS } from '../game/bending.js';
import { buildBending } from '../game/animation/bending-clips.js';
import { BendingVfx, BEND_KINDS } from '../game/bending-vfx.js';
import { t, getLang } from '../systems/localization.js';

const FALLBACK = {
  es: {
    'mv.puno_fuego': 'Puño de Fuego', 'mv.arco_llamas': 'Arco Llameante', 'mv.patada_cometa': 'Patada Cometa',
    'mv.latigo_agua': 'Látigo de Agua', 'mv.geiser': 'Géiser', 'mv.agujas_hielo': 'Agujas de Hielo',
    'mv.roca_proyectil': 'Roca Proyectil', 'mv.muro_piedra': 'Muro de Piedra', 'mv.lluvia_rocas': 'Lluvia de Rocas',
    'mv.rafaga': 'Ráfaga', 'mv.torbellino': 'Torbellino', 'mv.bala_aire': 'Bala de Aire',
    'mvt.bend': 'control elemental', 'mvt.wall': 'muro (frena proyectiles)', 'mvt.overhead': 'alto (bloquear de pie)',
    'guide.bend': 'Control elemental', 'guide.bendtip': '→+U proyección · ↓+U ascendente · U en el aire · también ↓↙← / →↓↘ + golpe',
    'bend.title': 'Control elemental',
  },
  en: {
    'mv.puno_fuego': 'Fire Fist', 'mv.arco_llamas': 'Flame Arc', 'mv.patada_cometa': 'Comet Kick',
    'mv.latigo_agua': 'Water Whip', 'mv.geiser': 'Geyser', 'mv.agujas_hielo': 'Ice Needles',
    'mv.roca_proyectil': 'Boulder Strike', 'mv.muro_piedra': 'Stone Wall', 'mv.lluvia_rocas': 'Rock Rain',
    'mv.rafaga': 'Gust', 'mv.torbellino': 'Whirlwind', 'mv.bala_aire': 'Air Bullet',
    'mvt.bend': 'elemental bending', 'mvt.wall': 'wall (stops projectiles)', 'mvt.overhead': 'overhead (block standing)',
    'guide.bend': 'Elemental bending', 'guide.bendtip': '→+U blast · ↓+U rising · U in the air · also ↓↙← / →↓↘ + attack',
    'bend.title': 'Elemental bending',
  },
};
export const BENDING_TEXTS = FALLBACK;
const tx = (k, v) => { const s = t(k, v); if (s !== k) return s; let L = 'es'; try { L = getLang(); } catch { /* */ } return (FALLBACK[L]?.[k] ?? FALLBACK.es[k] ?? k).replace(/\{(\w+)\}/g, (_, n) => v?.[n] ?? ''); };
const INPUT = { eb: '→+U · ↓↙←+J', eu: '↓+U · →↓↘+J', ej: '↑ U' };

export function installBending({ menu = null, scene, roster = menu?.roster || [], data = null, url = 'data/bending.json', doc = globalThis.document } = {}) {
  if (!scene) throw new Error('installBending: falta scene');
  if (scene.__bending) return scene.__bending;
  let D = data;
  const hasDom = !!doc?.createElement && typeof doc.getElementById === 'function';
  const okF = patchFighter(Fighter, RULES), okA = patchCpu(AI.CpuBrain);
  const api = { get data() { return D; }, setData(d) { D = d; decorate(); }, apply: m => hookMatch(m), patched: { fighter: okF, cpu: okA } };
  scene.__bending = api;
  if (!D && url && typeof fetch === 'function') fetch(url).then(r => r.ok ? r.json() : null).then(d => { if (d) api.setData(d); }).catch(e => console.warn('[control elemental] no se pudo leer', url, e));

  // ───────── 1) combate ─────────
  const start = scene.startMatch.bind(scene);
  scene.startMatch = function (a, b, input, opts = {}) {
    const o = D && opts.moves ? { ...opts, moves: mergeBending(opts.moves, D) } : opts;
    const r = start(a, b, input, o);
    try { hookMatch(this.match); } catch (e) { console.warn('[control elemental] no se pudo enganchar el combate', e); }
    return r;
  };
  function ensureMoves(m) { // respaldo: si los datos llegaron tarde o un modo creó Fighters nuevos
    let changed = false;
    for (const f of m.f || []) {
      if (!D || !f?.moves || BEND_IDS.every(k => f.moves[k]) || !D[f.def?.id]) continue;
      const add = movesFor(mergeBending({ common: {}, [f.def.id]: {} }, D), f.def.id);
      for (const k of BEND_IDS) if (add[k] && !f.moves[k]) { f.moves = { ...f.moves, [k]: add[k] }; changed = true; }
      if (f.__elem) f.__elem.moves = { ...f.__elem.moves, ...Object.fromEntries(BEND_IDS.filter(k => add[k]).map(k => [k, add[k]])) };
    }
    if (changed && m.__elem) m.__elem.fa = null; // el triángulo elemental vuelve a aplicarse sobre los golpes nuevos
  }
  function addClips(m) {
    for (const v of m.v || []) { const an = v.c?.anim; if (an?.dir?.clips && !an.dir.clips.eb) Object.assign(an.dir.clips, buildBending(an.S)); }
  }
  function hookMatch(m) {
    if (!m?.f) return null;
    ensureMoves(m); addClips(m);
    if (m.__bend) return m.__bend;
    const st = m.__bend = { bv: null };
    if (m.vfx && m.sm?.scene) {
      try {
        const bv = st.bv = new BendingVfx(m.vfx, m.sm.scene, m), V = m.vfx, own = p => BEND_KINDS.includes(p?.kind);
        const cue = V.cue.bind(V), pr = V.projectile.bind(V), pe = V.projectileEnd.bind(V), up = V.update.bind(V), dis = V.dispose.bind(V);
        V.cue = (c, who, at, facing, root) => { if (!(String(c.kind).startsWith('b_') && bv.cue(c, who, at, facing, root))) cue(c, who, at, facing, root); };
        V.projectile = p => own(p) ? bv.projectile(p) : pr(p);
        V.projectileEnd = (p, how) => own(p) ? bv.projectileEnd(p, how) : pe(p, how);
        V.update = dt => { up(dt); bv.update(dt); };
        V.dispose = () => { bv.dispose(); dis(); };
      } catch (e) { console.warn('[control elemental] efectos desactivados', e); st.bv = null; }
    }
    if (typeof m.step === 'function') {
      const step = m.step;
      m.step = function (dt) { ensureMoves(this); const r = step.call(this, dt); try { stepBending(this); } catch (e) { console.warn('[control elemental]', e); } return r; };
    }
    if (typeof m.onFighterEv === 'function') {
      const ev = m.onFighterEv;
      m.onFighterEv = function (e, f, i) { const r = ev.call(this, e, f, i); if (e.t === 'start' && BEND_IDS.includes(e.id)) { this.fx?.('special', f); if (e.id === 'eu' && f.def.id === 'terra') this.shake = Math.max(this.shake || 0, .1); } return r; };
    }
    return st;
  }

  // ───────── 2) interfaz: lista de movimientos y guía de controles ─────────
  const h = (tag, props = {}, ...kids) => { const e = doc.createElement(tag); for (const [k, v] of Object.entries(props)) { if (k === 'class') e.className = v; else if (v != null) e.setAttribute(k, v); } for (const c of kids.flat()) if (c != null) e.append(c.nodeType ? c : doc.createTextNode(String(c))); return e; };
  const tags = m => { const p = m.proj || {}; return [tx('mvt.bend'), p.hit === 'high' || m.hit === 'high' ? tx('mvt.overhead') : p.hit === 'low' ? t('mvt.low') : null, m.launch || p.launch ? t('mvt.launch') : null, m.kd || p.kd ? t('mvt.kd') : null,
    m.proj ? t('mvt.proj') : null, p.wall ? tx('mvt.wall') : null, m.armor ? t('mvt.armor') : null, m.inv ? t('mvt.inv') : null, m.pull || p.pull ? t('mvt.pull') : null].filter(Boolean).join(' · '); };
  function decorate() {
    if (!hasDom || !menu?.el?.view || !D) return;
    const tb = menu.el.view.querySelector('details.moves table'), d = roster[menu.idx];
    if (!tb || tb.dataset.bend || !d || !D[d.id]) return;
    tb.dataset.bend = '1';
    for (const k of BEND_IDS) {
      const m = D[d.id][k]; if (!m) continue; const dmg = m.proj ? m.proj.dmg * (m.proj.multi || 1) : m.dmg * (m.multi || 1);
      tb.append(h('tr', { class: 'bend' }, h('td', { class: 'mvn' }, tx('mv.' + m.name)), h('td', { class: 'mvi' }, h('kbd', {}, INPUT[k])), h('td', { class: 'mvs', 'data-l': t('mvh.startup') }, Math.round(m.startup * 60) + 'f'), h('td', { class: 'mvd', 'data-l': t('mvh.dmg') }, String(Math.round(dmg))), h('td', { class: 'mvp' }, tags(m))));
    }
  }
  function guide() {
    if (!hasDom || doc.querySelector('[data-bend-guide]')) return;
    const sp = doc.querySelector('[data-i18n="guide.special"]')?.closest('.gr'); if (!sp) return;
    const lbl = h('span', {}, tx('guide.bend')), tip = h('i', {}, tx('guide.bendtip'));
    if (t('guide.bend') !== 'guide.bend') lbl.dataset.i18n = 'guide.bend'; if (t('guide.bendtip') !== 'guide.bendtip') tip.dataset.i18n = 'guide.bendtip';
    sp.after(h('div', { class: 'gr', 'data-bend-guide': '1' }, lbl, h('span', {}, h('kbd', { class: 'kc' }, '→'), '+', h('kbd', { class: 'kc' }, 'U'), ' ', h('kbd', { class: 'kc' }, '↓'), '+', h('kbd', { class: 'kc' }, 'U'), tip)));
  }
  if (hasDom) {
    guide();
    if (typeof MutationObserver === 'function' && menu?.el?.view) new MutationObserver(decorate).observe(menu.el.view, { childList: true, subtree: true });
  }
  if (!okF) console.warn('[control elemental] las entradas nuevas no se activaron (Fighter cambió). Ver docs/CONTROL-ELEMENTAL.md');
  return api;
}
