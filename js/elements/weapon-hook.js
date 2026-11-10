// Adaptador de las ARMAS DE LA TIENDA y del ROMPEGUARDIA ↔ juego (mismo patrón que element-hook.js y bending-hook.js).
// No edita fighter.js, match.js, ai.js ni scene-manager.js. Instalar en main.js después de installBending:
//   installWeapons({ scene, roster, save, data })
// · Cada lado lleva el arma que su guerrero tiene equipada (save.data.equipped['<id>-w'], si está comprada);
//   la CPU de dificultad alta lleva una elegida por el rival. El maniquí de entrenamiento no lleva arma.
// · El arma da su técnica en el botón de arma (O · J1 E · J2 6/K) y su mejora pasiva.
import { Fighter, RULES } from '../game/fighter.js';
import * as AI from '../game/ai.js';
import { Animator } from '../game/animation/animator.js';
import { IDX } from '../game/animation/pose.js';
import { ArtSet, buildArt } from '../game/animation/weapon-art.js';
import { WeaponVfx, W_KINDS } from '../game/weapon-vfx.js';
import { themeOf } from '../game/chroma-vfx.js';
import { elemOf } from '../game/vfx.js';
import { WP, patchFighter, patchCpu, weaponMove, stepWeapons, fanCopies, cpuWeapon, elementKey } from '../game/weapon-arts.js';
import { weaponIcon } from '../ui/weapon-icons.js';
import { t } from '../systems/localization.js';

export const equipKey = id => `${id}-w`;
export function equippedWeapon(save, data, charId) {
  const id = save?.data?.equipped?.[equipKey(charId)];
  return id && data?.weapons?.[id] && save.data.owned?.includes(id) ? id : null;
}
const tx = (k, fb, v) => { const s = t(k, v); return s === k ? fb : s; };

function patchAnimator() {
  const P = Animator.prototype; if (P.__weapons) return;
  const up = P.update, anc = P.anchors;
  P.update = function (dt, f, env) {
    const art = this.art, R = this.rig, using = art && f?.act?.name === WP;
    if (art) { // durante la técnica, la muñeca apunta el arma (canal pitch = ángulo absoluto, como con espada)…
      if (using && !this.__bl) this.__bl = { blade: R.blade, clamp: R.bladeClamp };
      if (using) { const aim = art.inHand; R.blade = aim ? art.aim : null; R.bladeClamp = aim ? .9 : this.__bl.clamp; } // muñeca con arma: como mucho ~50° (una muñeca de verdad no se dobla más) // (v1.12.1) …SOLO mientras el arma está en la mano: antes de sacarla y después de lanzarla la mano se mueve libre (antes se doblaba más de 90° apuntando un arma invisible)
      else if (this.__bl) { R.blade = this.__bl.blade; R.bladeClamp = this.__bl.clamp; this.__bl = null; }
    }
    const r = up.call(this, dt, f, env);
    if (art && dt > 0) {
      const live = using && this.dir.lastClip === f.act, ct = live ? this.dir.lastCT : -1;
      art.sync(ct, this.dir.clips.wp, this.lead, this.artReady ? this.artReady(f) : true, live ? this.pose?.[IDX.wpSpin] || 0 : 0);
    }
    return r;
  };
  P.anchors = function () { const A = anc.call(this); if (this.art?.inHand) { A.wF = this.art.F; if (this.art.B) A.wB = this.art.B; } return A; };
  P.__weapons = true;
}

export function installWeapons({ scene, roster = [], save = null, data = null, url = 'data/weapons.json', doc = globalThis.document } = {}) {
  if (!scene) throw new Error('installWeapons: falta scene');
  if (scene.__weapons) return scene.__weapons;
  let D = data;
  const okF = patchFighter(Fighter, RULES), okA = patchCpu(AI.CpuBrain); patchAnimator();
  const ids = () => Object.keys(D?.weapons || {});
  const api = { get data() { return D; }, setData(d) { D = d; }, equipped: id => equippedWeapon(save, D, id), patched: { fighter: okF, cpu: okA } };
  scene.__weapons = api;
  if (!D && url && typeof fetch === 'function') fetch(url).then(r => r.ok ? r.json() : null).then(d => { if (d) D = d; }).catch(e => console.warn('[armas] no se pudo leer', url, e));
  const hasDom = !!doc?.createElement && typeof doc.getElementById === 'function';
  const elOf = id => elementKey(scene.__elements?.elementOf?.(id) || roster.find(r => r.id === id)?.element || 'earth');
  const colorOf = id => { const c = scene.__elements?.rules?.elements?.[elOf(id)]?.color; return c ? parseInt(c.slice(1), 16) : 0xf1dc9a; };

  // ───────── combate ─────────
  const start = scene.startMatch.bind(scene);
  scene.startMatch = function (a, b, input, opts = {}) {
    const mode = opts.mode || 'cpu', W = [opts.weapon1 !== undefined ? opts.weapon1 : equippedWeapon(save, D, a), null];
    if (opts.weapon2 !== undefined) W[1] = opts.weapon2;
    else if (mode === 'versus') W[1] = equippedWeapon(save, D, b);
    else if (mode !== 'training') W[1] = cpuWeapon(ids(), b, opts.level);
    const r = start(a, b, input, opts);
    try { hookMatch(this.match, W.map(id => (id && D?.weapons?.[id] ? { id, ...D.weapons[id] } : null))); } catch (e) { console.warn('[armas] no se pudo enganchar el combate', e); }
    return r;
  };

  function hookMatch(m, W) {
    if (!m?.f || m.__wp) return m?.__wp;
    const st = m.__wp = { W, arts: [], chips: [] };
    m.f.forEach((f, i) => {
      const w = W[i]; f.weaponId = w?.id || null; if (!w) return;
      const mv = weaponMove(w, elOf(f.def.id), D.element);
      f.moves = { ...f.moves, [WP]: mv }; if (f.__elem) f.__elem.moves = { ...f.__elem.moves, [WP]: mv };
      const an = m.v?.[i]?.c?.anim;
      if (an?.rig) {
        try {
          an.art?.dispose(); an.dir.clips.wp = buildArt(w.kind, an.S);
          an.art = new ArtSet(an.rig, m.v[i].c.holder, w, colorOf(f.def.id), (themeOf(m.v[i].c.pal, f.def.id)?.c || elemOf(f.def.id).c).getHex()); st.arts.push(an); // aura del filo: color de sus técnicas (o de su chroma). (v1.12) se registra para retirarla al acabar: antes el arma se quedaba en la espalda en el menú
          an.artReady = ff => w.after === 'return' ? !(m.proj || []).some(p => p.owner === ff && p.kind === 'w_boomerang' && !p.dead) : w.after === 'stow' ? true : !(ff.wcd > 0);
        } catch (e) { console.warn('[armas] modelo', w.id, e); }
      }
    });
    if (m.__elem) m.__elem.fa = null; // el triángulo elemental vuelve a aplicarse incluyendo la técnica del arma
    // efectos
    if (m.vfx && m.sm?.scene) {
      try {
        const wv = new WeaponVfx(m.vfx, m.sm.scene, elOf, colorOf), V = m.vfx, own = p => W_KINDS.includes(p?.kind); m.__wv = wv;
        const cue = V.cue.bind(V), pr = V.projectile.bind(V), pe = V.projectileEnd.bind(V), dis = V.dispose.bind(V);
        V.cue = (c, who, at, facing, root) => { if (!(/^(w_|gb_)/.test(c.kind) && wv.cue(c, who, at, facing, root))) cue(c, who, at, facing, root); };
        V.projectile = p => own(p) ? wv.projectile(p) : pr(p);
        V.projectileEnd = (p, how) => own(p) ? wv.projectileEnd(p, how) : pe(p, how);
        V.dispose = () => { wv.dispose(); dis(); };
      } catch (e) { console.warn('[armas] efectos desactivados', e); }
    }
    const step = m.step;
    m.step = function (dt) { const r = step.call(this, dt); try { stepWeapons(this, W); } catch (e) { console.warn('[armas]', e); } return r; };
    const fev = m.onFighterEv;
    m.onFighterEv = function (e, f, i) {
      const r = fev.call(this, e, f, i);
      if (e.t === 'proj' && e.move === WP && e.def?.fan) { const P = this.proj, mk = P[P.length - 1]; for (const c of fanCopies(e)) this.proj.push({ ...mk, def: c.def, y: c.y, x: c.x, t: 0, hits: 0, armed: true, dead: false, y0: undefined }); }
      if (e.t === 'weapon') { this.fx?.('special', f); }
      if (e.t === 'guardbreak') { this.fx?.('whiff_heavy', f); }
      return r;
    };
    m.onWeaponEv = e => {
      const i = e.i ?? m.f.indexOf(e.f), pos = { x: e.f.x + e.f.facing * .8, y: 1.8 };
      if (e.t === 'parry') { m.stop = Math.max(m.stop, .12); m.vfx?.flash(pos, 0xffffff, 3); m.fx('block', e.f); m.note(tx('hud.parry', '¡Contraataque!'), i, 'counter'); m.event({ type: 'parry', by: i }); }
      if (e.t === 'reflect') { m.vfx?.flash({ x: e.p.x, y: e.p.y }, colorOf(e.f.def.id), 2.2); m.fx('block', e.f); m.note(tx('hud.reflect', '¡Reflejado!'), i, 'repel'); }
      if (e.t === 'catch') { m.vfx?.flash({ x: e.f.x, y: 2 }, colorOf(e.f.def.id), 1.2); }
    };
    const oh = m.onHit;
    m.onHit = function (ev, idx) {
      if (ev.move === WP && !ev.blocked && ev.pos && this.__wv) try { const k = ev.a?.moves?.[WP]?.kind; this.__wv.impact(ev.pos, k, ev.a.def.id, Math.sign(ev.b?.x - ev.a?.x) || 1, Math.min(1.4, (ev.dmg || 6) / 8)); } catch { /* solo presentación */ }
      const r = oh.call(this, ev, idx);
      if (ev.move === WP && ev.proj && !ev.blocked && ev.a?.moves?.[WP]?.proj?.snare) this.note(tx('hud.snare', '¡Enredado!'), idx, 'counter');
      if (ev.move === 'gb' && ev.crush) this.event({ type: 'guardbreak', by: idx });
      return r;
    };
    // HUD: icono del arma con su enfriamiento
    if (hasDom) {
      const hud = doc.getElementById('hud');
      W.forEach((w, i) => {
        if (!w || !hud) return;
        const el = doc.createElement('div'); el.className = `wchip p${i + 1}`; el.innerHTML = weaponIcon(w.kind) + `<span class="wkey">${i ? (m.mode === 'versus' ? '6' : '') : (m.mode === 'versus' ? 'E' : 'O')}</span>`;
        el.title = tx('item.' + w.id, w.id); el.style.setProperty('--wc', '#' + colorOf(m.f[i].def.id).toString(16).padStart(6, '0'));
        hud.append(el); st.chips[i] = el;
      });
      const render = m.render;
      m.render = function (rdt, cam) {
        const r = render.call(this, rdt, cam);
        st.chips.forEach((el, i) => { if (!el) return; const f = this.f[i], k = f.wcdMax ? Math.max(0, f.wcd || 0) / f.wcdMax : 0; el.style.setProperty('--cd', k.toFixed(3)); el.classList.toggle('ready', k <= 0); el.classList.toggle('using', f.act?.name === WP); });
        return r;
      };
    }
    const dispose = m.dispose;
    m.dispose = function () { for (const an of st.arts) { an.art?.dispose(); an.art = null; an.artReady = null; if (an.__bl) { an.rig.blade = an.__bl.blade; an.rig.bladeClamp = an.__bl.clamp; an.__bl = null; } delete an.dir.clips.wp; } for (const el of st.chips) el?.remove(); return dispose.call(this); };
    return st;
  }
  if (!okF) console.warn('[armas] el botón de arma no se activó (Fighter cambió). Ver docs/ARMAS.md');
  return api;
}
