import * as THREE from 'three';
import { t, getLang } from '../systems/localization.js';
import { mirrorName } from '../systems/mirror-spec.js';
import { typed } from '../systems/a11y.js';

// CINEMÁTICA PREVIA AL COMBATE (estilo Mortal Kombat / Guilty Gear): franjas de cine, cartel «A VS B»,
// planos de cámara sobre quien habla con subtítulos que se escriben solos, gesto de presentación de cada
// guerrero y plano general antes de «Ronda 1 · ¡Pelea!». Cualquier tecla, clic o toque la salta.
// Los diálogos están en data/intros.json (por pareja, espejo y genéricos para guerreros nuevos).
const fill = (s, v) => String(s).replace(/\{(\w+)\}/g, (_, k) => v[k] ?? '');
const pick = (L, o) => o?.[L] ?? o?.es ?? o?.en ?? '';

// Guion: [{who:0|1, text}] para A (izquierda) contra B (derecha).
export function pickLines(data, a, b, L = 'es', names = {}) {
  if (!data) return [];
  const v = { name: names.a || a, foe: names.b || b };
  const seq = a === b ? data.mirror?.[a] : data.pairs?.[`${a}>${b}`];
  if (seq?.length) return seq.map(l => ({ who: l.who === 'b' ? 1 : 0, text: fill(pick(L, l), l.who === 'b' ? { name: v.foe, foe: v.name } : v) }));
  const g = id => data.generic?.[id] || data.generic?.['*'];
  const o = g(a)?.open?.[0], r = g(b)?.reply?.[0];
  return [o && { who: 0, text: fill(pick(L, o), v) }, r && { who: 1, text: fill(pick(L, r), { name: v.foe, foe: v.name }) }].filter(Boolean);
}
// Duración de cada plano: lo que se tarda en leer (con mínimo y máximo).
export const shotLen = text => Math.max(2.3, Math.min(4.6, 1.1 + String(text).length * .045));

const ease = x => x < 0 ? 0 : x > 1 ? 1 : x * x * (3 - 2 * x);
const _p = new THREE.Vector3(), _l = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3();

export function installCinematic({ scene, roster = [], data = null, doc = globalThis.document, enabled = () => true } = {}) {
  if (!scene || scene.__cine) return scene?.__cine;
  const api = { data, skip: () => cur?.skip() }; scene.__cine = api;
  const hasDom = !!doc?.createElement && typeof doc.getElementById === 'function';
  const def = id => roster.find(r => r.id === id);
  let cur = null;
  const start = scene.startMatch.bind(scene);
  scene.startMatch = function (a, b, input, opts = {}) {
    const r = start(a, b, input, opts);
    try {
      const m = this.match, mode = opts.mode || 'cpu';
      if (m && m.phase === 'intro' && opts.cinematic !== false && mode !== 'training' && enabled()) run(m, a, b);
    } catch (e) { console.warn('[cinemática] desactivada', e); }
    return r;
  };

  function run(m, a, b) {
    const L = getLang?.() || 'es', da = def(a), db = def(b);
    const names = [da?.name || a, a === b ? mirrorName(db, t) : db?.name || b];
    const lines = pickLines(api.data, a, b, L, { a: names[0], b: names[1] });
    const shots = [{ kind: 'title', dur: 2.1 }];
    lines.forEach((l, i) => shots.push({ kind: 'line', who: l.who, text: l.text, dur: shotLen(l.text), first: !lines.slice(0, i).some(x => x.who === l.who) }));
    const said = new Set(); for (const sh of shots) if (sh.kind === 'line') { sh.ots = said.has(sh.who); said.add(sh.who); } // 2.ª frase del mismo: plano por encima del hombro del rival
    shots.push({ kind: 'clash', dur: 1.5 });
    let k = 0, st = 0; const total = shots.reduce((s, x) => s + x.dur, 0);
    m.phase = 'cine'; m.pt = 0; m.v.forEach(v => { v.cel = null; });
    // ─ capa de interfaz ─
    let el = null, sub = null, who = null, alias = null, txt = null, title = null, hint = null;
    if (hasDom) {
      doc.body.classList.add('cine');
      el = doc.createElement('div'); el.id = 'cine'; el.innerHTML = `<div class="cbar top"></div><div class="cbar bot"></div>
        <div class="cslash a"></div><div class="cslash b"></div><div class="cspeed"></div>
        <div class="ctitle"><b class="cn a"></b><span class="cvs">VS</span><b class="cn b"></b><i class="cstage"></i></div>
        <div class="cclash"><i class="a"></i><i class="b"></i><span></span></div><div class="oflash"></div>
        <div class="csub"><div class="cwho"><b></b><i></i></div><p></p></div><span class="cskip"></span>`;
      doc.body.append(el);
      title = el.querySelector('.ctitle'); sub = el.querySelector('.csub'); who = sub.querySelector('b'); alias = sub.querySelector('i'); txt = sub.querySelector('p'); hint = el.querySelector('.cskip');
      const col = id => scene.__elements?.rules?.elements?.[scene.__elements?.elementOf?.(id)]?.color || '#f1dc9a';
      title.querySelector('.cn.a').textContent = names[0]; title.querySelector('.cn.b').textContent = names[1];
      for (const [q, n] of [['.cn.a', names[0]], ['.cn.b', names[1]]]) if (n.length > 9) title.querySelector(q).style.fontSize = `clamp(1.5rem, ${Math.max(2.6, 60 / n.length).toFixed(1)}vw, 3.6rem)`; // nombres largos (espejo) en una línea
      title.querySelector('.cn.a').style.setProperty('--c', col(a)); title.querySelector('.cn.b').style.setProperty('--c', a === b ? (scene.mirrors?.get(b)?.fx?.color || col(b)) : col(b));
      const stName = scene.__stages?.currentId; title.querySelector('.cstage').textContent = stName ? t(`stage.${stName}.name`) : '';
      hint.textContent = t('cine.skip') === 'cine.skip' ? 'Pulsa cualquier tecla para saltar' : t('cine.skip');
      api.cols = [col(a), a === b ? (scene.mirrors?.get(b)?.fx?.color || col(b)) : col(b)];
      el.style.setProperty('--ca', api.cols[0]); el.style.setProperty('--cb', api.cols[1]);
    }
    const ids = [a, b];
    const finish = () => {
      if (!cur) return; cur = null;
      removeEventListener('keydown', onKey, true); removeEventListener('pointerdown', onKey, true);
      el?.classList.add('out'); setTimeout(() => el?.remove(), 450); doc?.body?.classList.remove('cine');
      if (m.phase === 'cine') { m.phase = 'intro'; m.pt = 0; m.v.forEach(v => { v.cel = null; }); }
      if (scene.post) scene.post.grade.vig = null;
    };
    const onKey = e => { if (e.code === 'Escape' || e.code === 'KeyP' || e.repeat) return; if (cur) { e.preventDefault?.(); e.stopPropagation?.(); finish(); } };
    addEventListener('keydown', onKey, true); addEventListener('pointerdown', onKey, true);
    cur = { skip: finish };
    const render = m.render, dispose = m.dispose;
    m.dispose = function () { finish(); return dispose.call(this); };
    m.render = function (rdt, cam) {
      const out = render.call(this, rdt, cam);
      if (this.phase !== 'cine' || !cur) return out;
      if (this.paused) return out;
      st += rdt; let cut = false;
      while (k < shots.length && st > shots[k].dur) { st -= shots[k].dur; k++; cut = true; if (shots[k]?.kind === 'line' && shots[k].first) this.v[shots[k].who].cel = { name: 'intro', t: 0 }; }
      if (k >= shots.length) { finish(); return out; }
      const s = shots[k], u = st / s.dur, [fa, fb] = this.f, H = i => (this.f[i].def.height || 3.3);
      _a.set(fa.x, 0, 0); _b.set(fb.x, 0, 0);
      if (s.kind === 'title') { // grúa que baja desde lo alto mientras aparece el cartel
        const e = ease(u); _p.set(0, 7.5 - 4.2 * e, 19 - 6 * e); _l.set(0, 2.4 - .6 * e, 0);
      } else if (s.kind === 'line') { // plano 3/4 de quien habla, con un leve acercamiento
        const f = this.f[s.who], dir = f.facing, h = H(s.who), e = ease(u);
        if (s.ots) { const o = this.f[1 - s.who]; _p.set(o.x + dir * .7, H(1 - s.who) * .88, 1.7 - .2 * e); _l.set(f.x, h * .74, 0); } // por encima del hombro del que escucha
        else { _p.set(f.x + dir * (2.7 - .3 * e), h * .8, 3.6 - .6 * e); _l.set(f.x + dir * .15, h * .76, 0); } // 3/4: se le ve la cara
      } else { // choque de miradas: cámara baja entre los dos que se abre a plano general; las auras estallan
        const e = ease(u), mx = (fa.x + fb.x) / 2; _p.set(mx, .9 + 1.6 * e, 5 + 8 * e); _l.set(mx, 1.9 - .1 * e, 0);
        if ((api._au = (api._au ?? 0) - rdt) <= 0 && this.vfx) { api._au = .1; for (const f of this.f) this.vfx.aura?.({ x: f.x }, f.def.id); }
        if (cut) { this.shake = Math.max(this.shake || 0, .3); for (const [i, f] of this.f.entries()) this.vfx?.flash?.({ x: f.x, y: 1.7 }, new THREE.Color(api.cols?.[i] || '#ffffff').getHex(), 3); }
      }
      cam.position.copy(_p); cam.lookAt(_l);
      if (el) {
        el.dataset.shot = s.kind; title.classList.toggle('on', s.kind === 'title'); el.classList.toggle('clash', s.kind === 'clash');
        if (cut) { el.classList.remove('cut'); void el.offsetWidth; el.classList.add('cut'); }
        if (s.kind === 'line') {
          const i = s.who, id = ids[i], n = typed(st);
          sub.classList.add('on'); sub.classList.toggle('r', i === 1); sub.style.setProperty('--c', api.cols?.[i] || '#f1dc9a');
          if (who.textContent !== names[i]) { who.textContent = names[i]; alias.textContent = t(`char.${id}.alias`) === `char.${id}.alias` ? '' : t(`char.${id}.alias`); }
          txt.textContent = s.text.slice(0, n); txt.classList.toggle('done', n >= s.text.length);
        } else sub.classList.remove('on');
      }
      return out;
    };
    api.total = total;
  }
  return api;
}
