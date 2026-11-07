import * as THREE from 'three';
import { themed, signature } from './chroma-vfx.js';
import { t } from '../systems/localization.js';
import { AnimeFx } from './render/anime-fx.js';
import { A11Y } from '../systems/a11y.js';

// PRODUCCIÓN DEL COMBATE (estilo Guilty Gear / Mortal Kombat), solo presentación — nunca cambia la simulación:
//   · impactos: destello, aberración cromática y «fotograma de impacto» invertido en los golpes fuertes, contraataques y K.O.
//   · congelado de técnica: al lanzar la técnica reforzada (Resonancia) el fondo se oscurece, salen líneas de
//     velocidad hacia quien la lanza y cruza la pantalla una franja con su nombre y el de la técnica.
//   · carteles grandes inclinados: CONTRAATAQUE, GUARDIA ROTA, REFLEJADO… y el K.O. con cámara inclinada.
//   · gradación de color por escenario (cálida en fuego, fría en agua…).
//   · animación «por pasos» en golpes y reacciones (como el anime 3D de los juegos de lucha); el movimiento sigue fluido.
const GRADE = {
  fire: { sat: 1.18, con: 1.1, tint: [1.06, .97, .9], bloom: 1 }, water: { sat: 1.12, con: 1.06, tint: [.94, 1, 1.07], bloom: .9 },
  wind: { sat: 1.08, con: 1.05, tint: [1, 1.02, 1.05], bloom: .7 }, earth: { sat: 1.1, con: 1.08, tint: [1.05, 1, .93], bloom: .8 },
  neutral: { sat: 1.14, con: 1.07, tint: [1.01, 1, .98], bloom: .7 },
};
const _v = new THREE.Vector3();

export function installFightFx({ scene, roster = [], doc = globalThis.document, stepFps = 0 } = {}) { // stepFps > 0 = animación por pasos (desactivada: prima la fluidez)
  if (!scene || scene.__fightfx) return scene?.__fightfx;
  const hasDom = !!doc?.createElement && typeof doc.getElementById === 'function';
  const api = { stepFps }; scene.__fightfx = api;
  const P = () => scene.post;
  const colOf = id => { const E = scene.__elements, c = E?.rules?.elements?.[E?.elementOf?.(id)]?.color; return c ? new THREE.Color(c) : new THREE.Color(0xffffff); };
  let layer = null;
  const banner = (cls, text, sub = '', color = '#ffe066', side = null) => {
    if (!hasDom) return;
    if (!layer || !layer.isConnected) { layer = doc.createElement('div'); layer.id = 'fightfx'; doc.body.append(layer); }
    const b = doc.createElement('div'); b.className = 'fbn ' + cls + (side != null ? ' s' + side : ''); b.style.setProperty('--c', color);
    b.innerHTML = `<b></b>${sub ? '<i></i>' : ''}`; b.querySelector('b').textContent = text; if (sub) b.querySelector('i').textContent = sub;
    layer.append(b); setTimeout(() => b.remove(), cls === 'super' ? 1300 : 1100);
  };
  api.banner = (...a) => banner(...a); api.freeze = (d, at) => P()?.superFreeze(d, at);
  const setGrade = el => { const p = P(); if (!p) return; const g = GRADE[el] || GRADE.neutral; p.grade.sat = g.sat; p.grade.con = g.con; p.grade.bloom = g.bloom; p.grade.tint.setRGB(...g.tint); };

  const start = scene.startMatch.bind(scene), end = scene.endMatch.bind(scene);
  scene.startMatch = function (a, b, input, opts = {}) {
    const r = start(a, b, input, opts);
    try { const SM = scene.__stages; setGrade(SM?.resolve?.(SM.currentId)?.element); hook(this.match); } catch (e) { console.warn('[presentación]', e); }
    return r;
  };
  scene.endMatch = function () { setGrade('neutral'); layer?.replaceChildren(); return end(); };

  function hook(m) {
    if (!m || m.__ffx) return; m.__ffx = { tilt: 0, tiltT: 0 };
    const S = m.__ffx, elOf = id => { const e = scene.__elements?.elementOf?.(id) || roster.find(r => r.id === id)?.element; return e === 'air' ? 'wind' : e || 'earth'; };
    try { S.afx = m.sm?.scene ? new AnimeFx(m.sm.scene) : null; } catch (e) { S.afx = null; }
    // animación por pasos (golpes, gestos y reacciones)
    for (const v of m.v) if (v.c.anim) { v.c.anim.stepFps = stepFps; v.c.anim.dir.exag = 1.15; }
    // HUD: color de cada barra según el elemento de su guerrero y aviso de vida baja
    S.hp = hasDom ? [doc.querySelector('#hud .hp.p1'), doc.querySelector('#hud .hp.p2')] : [];
    S.hp.forEach((el, i) => el?.style.setProperty('--hc', '#' + colOf(m.f[i].def.id).getHexString()));
    const oh = m.onHit;
    m.onHit = function (ev, idx) {
      const r = oh.call(this, ev, idx);
      try {
        const p = P(), c = colOf(ev.a?.def?.id);
        if (ev.ko) { p?.invertFrame(1); p?.impact(1, 0xffffff); S.tilt = (idx ? -1 : 1) * .07; S.tiltT = 1.6; }
        else if (ev.crush) { p?.impact(1.2, c.getHex()); p?.invertFrame(.7); banner('crush', t('hud.crush'), '', '#ffb347', idx); S.tilt = (idx ? -1 : 1) * .04; S.tiltT = .5; }
        else if (ev.counter) { p?.invertFrame(.8); p?.impact(.9, c.getHex()); banner('counter', t('hud.counter'), '', '#ff4f5e', idx); S.tilt = (idx ? -1 : 1) * .03; S.tiltT = .35; }
        else if (!ev.blocked && (ev.dmg >= 12 || ev.combo >= 5)) { p && (p.fx.ca = Math.max(p.fx.ca, 1)); S.tilt = (idx ? -1 : 1) * .02; S.tiltT = .25; }
        else if (!ev.blocked) p && (p.fx.ca = Math.max(p.fx.ca, .5));
        else p && (p.fx.ca = Math.max(p.fx.ca, .3));
        if (ev.pos && !ev.armored) S.afx?.spark(ev.pos, c, ev.ko ? 1.6 : ev.crush ? 1.4 : Math.min(1.4, (ev.dmg || 4) / 10), !!ev.blocked);
        if (ev.pos && !ev.blocked && !ev.armored) S.afx?.burst(ev.pos, elOf(ev.a?.def?.id), ev.ko ? 1.6 : Math.min(1.4, (ev.dmg || 4) / 9), Math.sign(ev.b?.x - ev.a?.x) || 1);
      } catch (e) { /* solo presentación */ }
      return r;
    };
    const fev = m.onFighterEv;
    m.onFighterEv = function (e, f, i) {
      const r = fev.call(this, e, f, i);
      try {
        if (e.t === 'ex') { // técnica reforzada: congelado con franja de nombre
          const p = P(), cam = this.sm?.camera; _v.set(f.x, (f.def.height || 3.3) * .6, 0);
          if (cam) { _v.project(cam); p?.superFreeze(.55, new THREE.Vector2(_v.x * .5 + .5, _v.y * .5 + .5)); } else p?.superFreeze(.55);
          this.stop = Math.max(this.stop, .45);
          const mv = f.moves?.ex?.name, mvName = mv ? t('mv.' + mv) : t('hud.ex');
          banner('super', this.f[i] === f ? (this.v[i]?.c?.def?.name || f.def.name) : f.def.name, mvName, '#' + colOf(f.def.id).getHexString(), i);
        }
        if (e.t === 'parry') banner('counter', t('hud.parry'), '', '#9fe8ff', i);
      } catch (err) { /* solo presentación */ }
      return r;
    };
    const disp = m.dispose; m.dispose = function () { S.afx?.dispose(); S.afx = null; return disp.call(this); };
    const ow = m.onWeaponEv; // reflejo / contraataque de armas (si están instaladas)
    if (ow) m.onWeaponEv = e => { ow(e); if (e.t === 'parry' || e.t === 'reflect') { P()?.invertFrame(.6); P()?.impact(.7); } };
    const render = m.render;
    m.render = function (rdt, cam) {
      const out = render.call(this, rdt, cam);
      try { S.afx?.sync(this.proj || [], elOf, this.stop > 0 ? rdt * .15 : rdt); } catch (e) { S.afx = null; }
      // aura del chroma premium equipado: partículas de su color alrededor del cuerpo
      if (this.vfx?.parts && !this.sm?.reduce) this.v.forEach((v, i) => {
        const ch = v.c.pal?.chroma; if (!ch?.aura) return; const f = this.f[i];
        S.au = S.au || [0, 0]; S.au[i] -= rdt; if (S.au[i] > 0) return; S.au[i] = ch.aura === 'bolts' ? .09 : ch.aura === 'smoke' ? .08 : .045;
        const h = (f.def.height || 3.3), c0 = new THREE.Color(ch.glow), c1 = new THREE.Color(ch.glow2), r = Math.random;
        const o = { embers: { vy: 1.6 + r() * 1.2, g: -1, s0: .14, s1: 0, life: .7 }, sparkles: { vy: .3, g: 0, s0: .1, s1: 0, life: .45 }, bubbles: { vy: 1 + r(), g: -.5, s0: .12, s1: .16, life: .8 },
          motes: { vy: .5, g: 0, s0: .11, s1: .02, life: 1 }, bolts: { vy: 0, g: 0, s0: .22, s1: 0, life: .12 },
          smoke: { vy: .7, g: 0, s0: .3, s1: .7, life: 1.1, a0: .3 }, ink: { vy: -.2, g: 3, s0: .14, s1: .04, life: .8 }, petals: { vy: .2, g: .6, s0: .14, s1: .08, life: 1.4, vx: (r() - .5) * 1.2 },
          snow: { vy: -.3, g: .5, s0: .08, s1: .03, life: 1.3 }, sand: { vy: .1, g: .4, s0: .05, s1: .02, life: .9, vx: (r() - .5) * 2.5 } }[ch.aura] || { vy: .8, g: 0, s0: .1, s1: 0, life: .6 };
        this.vfx.parts.emit({ x: f.x + (r() - .5) * .9, y: f.y + r() * h * .9, z: (r() - .5) * .6, vx: (r() - .5) * .4, vz: 0, drag: 1, c0, c1, ...o });
        if (ch.aura === 'bolts' && r() < .3) { const th = f.vtheme; if (th) themed(f, () => signature(this.vfx, { x: f.x + (r() - .5) * .6, y: f.y + r() * h * .8, z: .2 }, 1, 'aura')); }
      });
      S.hp?.forEach((el, i) => el?.classList.toggle('low', this.f[i].hp / this.f[i].maxHp < .3 && !this.f[i].ko));
      // al acabar la ronda el ganador se aparta del caído (que nadie celebre encima del rival)
      if ((this.phase === 'ko' || this.phase === 'end') && this.winner >= 0) {
        const w = this.f[this.winner], l = this.f[1 - this.winner], d = w.x - l.x;
        if (Math.abs(d) < 2.2 && !w.air) w.x = Math.max(-8.2, Math.min(8.2, w.x + (Math.sign(d) || 1) * Math.min(rdt, .05) * 3));
      }
      if (S.tiltT > 0 && !this.sm?.reduce) { S.tiltT -= rdt; const k = Math.max(0, Math.min(1, S.tiltT / .3)); cam.rotateZ(S.tilt * k * A11Y.camK); }
      return out;
    };
  }
  return api;
}
