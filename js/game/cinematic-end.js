import * as THREE from 'three';
import { t, getLang } from '../systems/localization.js';
import { mirrorName } from '../systems/mirror-spec.js';
import { typed } from '../systems/a11y.js';

// CINEMÁTICA FINAL (estilo Mortal Kombat / Guilty Gear): al decidirse el combate, antes del panel de resultados.
//  1 · «Golpe de victoria»: grúa que gira alrededor del ganador mientras repite su gesto, destello de su elemento,
//      franjas diagonales con su color y el cartel «NOMBRE · VICTORIA» (o «VICTORIA PERFECTA» si no le tocaron).
//  2 · Frase del ganador en contrapicado y, si la hay, respuesta del vencido en picado (más oscuro).
//  3 · Plano final congelado al estilo manga (retrato del ganador) y fundido al panel.
// Personalizada por pareja (data/outros.json → pairs['ganador>perdedor'], mirror[id], generic). Cualquier tecla/toque la salta.
const fill = (s, v) => String(s).replace(/\{(\w+)\}/g, (_, k) => v[k] ?? '');
const pick = (L, o) => o?.[L] ?? o?.es ?? o?.en ?? '';
const ease = x => x < 0 ? 0 : x > 1 ? 1 : x * x * (3 - 2 * x);
const _p = new THREE.Vector3(), _l = new THREE.Vector3();

// Guion: [{who: 'w'|'l', text}] para ganador → perdedor.
export function pickOutro(data, w, l, L = 'es', names = {}) {
  if (!data) return [];
  const v = { w: names.w || w, l: names.l || l };
  const seq = w === l ? data.mirror?.[w] : data.pairs?.[`${w}>${l}`];
  const say = (who, o) => ({ who, text: fill(pick(L, o), who === 'w' ? { name: v.w, foe: v.l } : { name: v.l, foe: v.w }) });
  if (seq?.length) return seq.map(o => say(o.who === 'l' ? 'l' : 'w', o));
  const g = id => data.generic?.[id] || data.generic?.['*'];
  const a = g(w)?.win?.[0], b = g(l)?.lose?.[0];
  return [a && say('w', a), b && say('l', b)].filter(Boolean);
}
export const lineLen = text => Math.max(2.2, Math.min(4.4, 1 + String(text).length * .042));
// ¿Victoria perfecta? (el ganador no perdió vida en la última ronda ni ninguna ronda)
export const isPerfect = r => r.winner >= 0 && (r.hp?.[r.winner] ?? 0) >= .999 && (r.wins?.[1 - r.winner] ?? 1) === 0;

export function installOutro({ scene, roster = [], data = null, doc = globalThis.document, enabled = () => true } = {}) {
  if (!scene || scene.__outro) return scene?.__outro;
  const api = { data, playing: false, skip: () => cur?.finish() }; scene.__outro = api;
  const hasDom = !!doc?.createElement && typeof doc.getElementById === 'function';
  const def = id => roster.find(r => r.id === id);
  const col = id => scene.__elements?.rules?.elements?.[scene.__elements?.elementOf?.(id)]?.color || def(id)?.fx?.light || '#f1dc9a';
  let cur = null;
  const start = scene.startMatch.bind(scene);
  scene.startMatch = function (a, b, input, opts = {}) {
    const r = start(a, b, input, opts), m = this.match, mode = opts.mode || 'cpu';
    try {
      if (m && mode !== 'training' && opts.outro !== false && m.o) {
        const done = m.o.onResult;
        m.o.onResult = res => { if (res.winner < 0 || !enabled() || !done) return done?.(res); play(m, a, b, res, () => done(res)); };
      }
    } catch (e) { console.warn('[cinemática final] desactivada', e); }
    return r;
  };

  function play(m, a, b, res, done) {
    const w = res.winner, l = 1 - w, ids = [a, b], L = getLang?.() || 'es';
    const names = [def(a)?.name || a, a === b ? mirrorName(def(b), t) : def(b)?.name || b];
    const cols = [col(a), a === b ? (scene.mirrors?.get(b)?.fx?.color || col(b)) : col(b)];
    const lines = pickOutro(api.data, ids[w], ids[l], L, { w: names[w], l: names[l] });
    const perfect = isPerfect(res);
    const shots = [{ kind: 'slam', dur: 1.7 }, ...lines.map(x => ({ kind: 'line', who: x.who === 'w' ? w : l, lose: x.who === 'l', text: x.text, dur: lineLen(x.text) })), { kind: 'pose', dur: 1.3 }];
    m.phase = 'outro'; m.pt = 0; m.cb = null; api.playing = true;
    if (m.v[w]) m.v[w].cel = { name: 'win', t: 0 };
    let el = null, ban = null, sub = null, whoEl = null, txt = null;
    if (hasDom) {
      doc.body.classList.add('cine', 'outro');
      el = doc.createElement('div'); el.id = 'outro'; el.style.setProperty('--c', cols[w]);
      el.innerHTML = `<div class="cbar top"></div><div class="cbar bot"></div><div class="oslash"><i></i><i></i><i></i></div><div class="olines"></div>
        <div class="oban"><span class="oko">${res.why === 'time' ? t('ann.time') : 'K.O.'}</span><b></b><em></em></div>
        <div class="csub"><div class="cwho"><b></b></div><p></p></div><div class="oframe"><b></b><em></em></div><div class="oflash"></div><span class="cskip"></span>`;
      doc.body.append(el);
      ban = el.querySelector('.oban'); sub = el.querySelector('.csub'); whoEl = sub.querySelector('b'); txt = sub.querySelector('p');
      ban.querySelector('b').textContent = names[w]; ban.querySelector('em').textContent = t(perfect ? 'outro.perfect' : 'outro.wins');
      if (names[w].length > 9) ban.querySelector('b').style.fontSize = `clamp(2rem, ${Math.max(4, 80 / names[w].length).toFixed(1)}vw, 6rem)`;
      el.querySelector('.oframe b').textContent = names[w]; el.querySelector('.oframe em').textContent = t(perfect ? 'outro.perfect' : 'outro.wins');
      const sk = t('cine.skip'); el.querySelector('.cskip').textContent = sk === 'cine.skip' ? '' : sk;
    }
    let k = 0, st = 0, burst = 0;
    const finish = () => {
      if (!cur) return; cur = null; api.playing = false;
      removeEventListener('keydown', onKey, true); removeEventListener('pointerdown', onKey, true);
      el?.classList.add('out'); setTimeout(() => el?.remove(), 420); doc?.body?.classList.remove('cine', 'outro');
      m.render = render; if (m.phase === 'outro') m.phase = 'result';
      try { done(); } catch (e) { console.error('[cinemática final]', e); }
    };
    const onKey = e => { if (e.code === 'Escape' || e.code === 'KeyP' || e.repeat) return; if (cur && st + shots.slice(0, k).reduce((s, x) => s + x.dur, 0) > .5) { e.preventDefault?.(); e.stopPropagation?.(); finish(); } };
    addEventListener('keydown', onKey, true); addEventListener('pointerdown', onKey, true);
    cur = { finish };
    const render = m.render, dispose = m.dispose;
    m.dispose = function () { if (cur) { cur = null; api.playing = false; el?.remove(); doc?.body?.classList.remove('cine', 'outro'); } return dispose.call(this); };
    m.render = function (rdt, cam) {
      const out = render.call(this, rdt, cam);
      if (!cur || this.paused) return out;
      st += rdt; let cut = false;
      while (k < shots.length && st > shots[k].dur) { st -= shots[k].dur; k++; cut = true;
        if (k > 0) this.noSlow = true; // tras el primer plano, la animación ya va a velocidad normal
        if (shots[k]?.lose) { // el vencido SIGUE EN EL SUELO: se apoya, mira al ganador y responde con su gesto (propio de cada uno)
          const L = this.f[l], Wf = this.f[w], v = this.v[l]; L.ko = true; L.down = 0; L.getup = 0; L.air = false; L.launched = false; L.y = 0; L.vx = L.vy = L.kv = 0; L.act = null; L.stun = 0;
          if (!cur.faced) { L.facing = Math.sign(Wf.x - L.x) || L.facing; cur.faced = true; }
          if (v && v.cel?.name !== 'lose') v.cel = v.c.anim?.dir?.clips?.lose?.ground ? { name: 'lose', t: 0 } : null; } }
      if (k >= shots.length) { finish(); return out; }
      const s = shots[k], u = st / s.dur, F = this.f[w], H = i => this.f[i].def.height || 3.3, dir = F.facing || 1;
      if (s.kind === 'slam') { // giro de grúa alrededor del ganador, de abajo a la altura del pecho
        const e = ease(u), ang = (-.95 + 1.3 * e) * dir, r = 10.5 - 2.6 * e;
        _p.set(F.x + Math.sin(ang) * r, 1.1 + 1.1 * e, Math.cos(ang) * r); _l.set(F.x, H(w) * (.6 + .04 * e), 0);
        if ((burst -= rdt) <= 0 && this.vfx) { burst = .12; this.vfx.aura?.({ x: F.x }, F.def.id); }
        if (st < rdt * 1.5) { this.vfx?.flash?.({ x: F.x, y: 1.6 }, new THREE.Color(cols[w]).getHex(), 4); this.shake = Math.max(this.shake || 0, .25); }
      } else if (s.kind === 'line') {
        const f = this.f[s.who], fd = f.facing || 1, h = H(s.who), e = ease(u);
        if (!s.lose) { _p.set(f.x + fd * (3.1 - .4 * e), h * .3, 5.6 - .7 * e); _l.set(f.x + fd * .1, h * .64, 0); } // contrapicado heroico
        else { const Wf = this.f[w], d = Math.sign(Wf.x - f.x) || 1; _p.set(f.x + d * (2.9 - .3 * e), h * .34, 6.1 - .45 * e); _l.set(f.x - d * .05, h * .25, 0); } /* (v1.12) más abierto: se ve el cuerpo entero en el suelo */ // a ras de suelo, desde el lado del ganador: el vencido le mira desde el suelo
      } else { const e = ease(u); _p.set(F.x + dir * (2.6 - .3 * e), H(w) * .58, 5.4 - .8 * e); _l.set(F.x - dir * .55, H(w) * .6, 0); } // retrato (el nombre queda a un lado)
      cam.position.copy(_p); cam.lookAt(_l);
      if (el) {
        el.dataset.shot = s.kind; if (cut) { el.classList.remove('cut'); void el.offsetWidth; el.classList.add('cut'); }
        el.classList.toggle('lose', !!s.lose);
        ban.classList.toggle('on', s.kind === 'slam');
        el.querySelector('.oframe').classList.toggle('on', s.kind === 'pose');
        if (s.kind === 'line') {
          const n = typed(st), i = s.who;
          sub.classList.add('on'); sub.classList.toggle('r', i === 1); sub.style.setProperty('--c', cols[i]);
          if (whoEl.textContent !== names[i]) whoEl.textContent = names[i];
          txt.textContent = s.text.slice(0, n); txt.classList.toggle('done', n >= s.text.length);
        } else sub.classList.remove('on');
      }
      return out;
    };
  }
  return api;
}
