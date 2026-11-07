import * as THREE from 'three';
import { applyChromaFx } from './chroma-fx.js';

// TRANSFORMACIÓN DEFINITIVA (F5): con la Resonancia al 100 % y libre de acciones, pulsa Transformación
// (J1: Y o I+O a la vez · 2 jugadores: J1 Q, J2 7 del teclado numérico o ' · táctil: botón ✹).
// Gasta toda la Resonancia y durante 12 s: +25 % de daño, −20 % de daño recibido, +12 % de velocidad,
// recupera vida poco a poco y su técnica de Resonancia cuesta la mitad. Al activarla: congelado de cámara,
// cartel con el nombre de la forma, onda de choque y el cuerpo brilla con el color de su elemento hasta que se acaba.
// Lógica pura en Fighter (se prueba en Node) + presentación en el combate. Sirve para cualquier guerrero (los nuevos
// usan el nombre genérico y el color de su elemento).
export const TF = { dur: 12, cost: 100, atk: 1.25, def: .8, walk: 1.12, regen: 1.5, exDiscount: .5, inv: .9 };

export function canTransform(f) { return f.meter >= TF.cost && !(f.tf > 0) && !f.act && !(f.stun > 0) && !f.ko && !f.down && !f.getup && !f.air && !f.thrower; }

export function patchFighter(Fighter, RULES) {
  const P = Fighter.prototype; if (P.__tf) return true;
  const up = P.update, reset = P.reset, revive = P.revive;
  // mantiene los multiplicadores aunque otro sistema (triángulo elemental, armas) recalcule atk / dmul / walk
  const keep = f => {
    for (const [k, mul] of [['atk', TF.atk], ['dmul', TF.def], ['walk', TF.walk]]) {
      const tag = '__tf_' + k; if (f.tf > 0) { if (f[tag] !== f[k]) { f[k] *= mul; f[tag] = f[k]; } }
      else if (f[tag] != null) { if (f[tag] === f[k]) f[k] /= mul; f[tag] = null; }
    }
  };
  P.transform = function () {
    if (!canTransform(this)) return false;
    this.meter = 0; this.tf = TF.dur; this.tfMax = TF.dur; this.inv = Math.max(this.inv || 0, TF.inv); this.tfCount = (this.tfCount || 0) + 1;
    keep(this); this.__tfEv = 'transform'; return true; // el evento se publica tras el paso (Fighter vacía ev al empezar)
  };
  P.update = function (dt, inp, foe) {
    if (inp && (inp.t || (inp.r && inp.w)) && this.meter >= TF.cost && !(this.tf > 0)) {
      if (this.transform()) inp = { ...inp, t: false, r: false, w: false };
    }
    if (this.tf > 0) {
      this.tf = Math.max(0, this.tf - dt);
      if (!this.ko && this.hp > 0) this.hp = Math.min(this.maxHp, this.hp + TF.regen * dt);
      if (this.tf === 0) this.__tfEv = 'transform_end';
    }
    keep(this);
    // técnica de Resonancia a mitad de precio: se adelanta la mitad de su coste justo antes de que el luchador decida
    const cheap = this.tf > 0 && inp?.r && this.meter >= RULES.exCost * TF.exDiscount && this.meter < RULES.exCost;
    if (cheap) { this.__tfLoan = RULES.exCost - this.meter; this.meter = RULES.exCost; }
    const r = up.call(this, dt, inp, foe);
    if (this.__tfLoan) { if (this.act?.name !== 'ex') this.meter = Math.max(0, this.meter - this.__tfLoan); this.__tfLoan = 0; }
    else if (this.tf > 0 && this.act?.name === 'ex' && this.act.t <= dt * 1.5 && !this.__tfRefund) { this.meter = Math.min(RULES.meterMax, this.meter + RULES.exCost * (1 - TF.exDiscount)); this.__tfRefund = true; }
    if (this.act?.name !== 'ex') this.__tfRefund = false;
    if (this.__tfEv) { this.ev.push({ t: this.__tfEv }); this.__tfEv = null; }
    return r;
  };
  if (reset) P.reset = function (...a) { this.tf = 0; keep(this); return reset.apply(this, a); };
  if (revive) P.revive = function (...a) { const r = revive.apply(this, a); if (this.tf > 0) { this.tf = 0; keep(this); } return r; };
  P.__tf = true; return true;
}

// La CPU (no los maniquís) se transforma cuando puede, antes en dificultades altas.
export function patchCpu(Brain) {
  const P = Brain?.prototype; if (!P || P.__tf) return false;
  const think = P.think;
  P.think = function (dt, me, foe) {
    const r = think.call(this, dt, me, foe);
    if (me?.tfAI && me.meter >= TF.cost && !(me.tf > 0)) {
      const rate = { beginner: .15, normal: .5, hard: 1.2, expert: 3 }[this.level] ?? .5;
      if (!this.tfWant && Math.random() < rate * dt) this.tfWant = true; // decide transformarse…
      if (this.tfWant) { if (canTransform(me)) { this.tfWant = false; return { ...r, t: true, r: false, w: false }; } return { ...r, l: false, m: false, h: false, s: false, r: false, w: false, t: false }; } // …y espera un momento libre
    } else this.tfWant = false;
    return r;
  };
  P.__tf = true; return true;
}

const FORM = { ignis: 'Llama Soberana', aqua: 'Marea Eterna', terra: 'Coloso de Jade', zephyr: 'Ojo del Huracán' };
const FORM_EN = { ignis: 'Sovereign Flame', aqua: 'Eternal Tide', terra: 'Jade Colossus', zephyr: 'Eye of the Storm' };
export const formName = (id, t) => { const k = `tf.form.${id}`, s = t?.(k); return s && s !== k ? s : (FORM[id] || t?.('tf.form.generic') || 'Forma Definitiva'); };

// Presentación en el combate: cinemática corta al activarla, brillo y aura mientras dura, barra de tiempo en el HUD.
export function installTransform({ scene, t = k => k, doc = globalThis.document, colorOf = null } = {}) {
  if (!scene || scene.__tf) return scene?.__tf;
  const api = { formName: id => formName(id, t) }; scene.__tf = api;
  const hasDom = !!doc?.createElement && typeof doc.querySelector === 'function';
  const start = scene.startMatch.bind(scene);
  scene.startMatch = function (a, b, input, opts = {}) {
    const r = start(a, b, input, opts);
    try { hook(this.match, opts); } catch (e) { console.warn('[transformación] presentación desactivada', e); }
    return r;
  };
  function hook(m, opts) {
    if (!m?.f || m.__tfHook) return; m.__tfHook = true;
    m.f.forEach((f, i) => { f.tfAI = m.mode === 'cpu' && (i === 1 || !!m.brain1); });
    const col = i => new THREE.Color(colorOf?.(m.f[i].def.id) || m.f[i].def.fx?.color || '#ffd257');
    let bars = null;
    if (hasDom && !opts.preview) {
      const hud = doc.querySelector('#hud'); doc.querySelectorAll('#hud .tfbar').forEach(n => n.remove());
      if (hud) bars = [0, 1].map(i => { const d = doc.createElement('div'); d.className = 'tfbar p' + (i + 1); d.innerHTML = '<i></i><b></b><em></em>'; d.style.setProperty('--c', '#' + col(i).getHexString()); hud.append(d); return d; });
    }
    const ev0 = m.event.bind(m); m.event = e => ev0(e && e.by != null && m.f[e.by]?.tf > 0 ? { ...e, tf: true } : e); // los desafíos saben si el golpe fue transformado
    const fev = m.onFighterEv;
    m.onFighterEv = function (e, f, i) {
      const r = fev.call(this, e, f, i);
      try {
        if (e.t === 'transform') {
          const c = col(i), v = this.v[i];
          this.event?.({ type: 'transform', by: i });
          this.stop = Math.max(this.stop, .9); this.zoom = 1; this.shake = Math.max(this.shake, .5);
          this.vfx?.flash({ x: f.x, y: 1.7 }, c.getHex(), 6); this.vfx?.flash({ x: f.x, y: .2 }, 0xffffff, 4);
          for (let k = 0; k < 3; k++) this.vfx?.shapes?.sprite?.('ring', new THREE.Vector3(f.x, .06, .5), { color: c.getHex(), size: .8 + k * .4, grow: 7 + k * 2, life: .5 + k * .15, flat: true });
          this.fx('special', f); this.fx('ko', f); this.react?.(1, '#' + c.getHexString());
          const FX = scene.__fightfx; FX?.freeze?.(.8); FX?.banner?.('super', t('tf.banner'), formName(f.def.id, t), '#' + c.getHexString(), i);
          if (v) { v.tfPal = v.c.pal ?? null; applyChromaFx(v.c.holder, { fx: f.def.fx, chroma: { kind: 'pulse', glow: '#' + c.getHexString(), glow2: '#ffffff', rim: '#' + c.clone().lerp(new THREE.Color(1, 1, 1), .5).getHexString(), outline: '#' + c.clone().multiplyScalar(.6).getHexString(), amount: 1 } }); v.cel = { name: 'intro', t: .35 }; }
        }
        if (e.t === 'transform_end') { const v = this.v[i]; if (v) { applyChromaFx(v.c.holder, v.tfPal || null); v.tfPal = undefined; } this.vfx?.flash({ x: f.x, y: 1.7 }, col(i).getHex(), 2); }
      } catch (err) { /* solo presentación */ }
      return r;
    };
    const render = m.render;
    m.render = function (rdt, cam) {
      const out = render.call(this, rdt, cam);
      this.f.forEach((f, i) => {
        const v = this.v[i], on = f.tf > 0;
        if (!on && v && v.tfPal !== undefined) { applyChromaFx(v.c.holder, v.tfPal || null); v.tfPal = undefined; } // p. ej. al empezar otra ronda
        if (on && v) { // brillo que late y aura densa del elemento
          const c = col(i), k = .35 + .2 * Math.sin(this.t * 9);
          for (const mt of v.mats) mt.emissive?.setRGB(Math.min(1, (mt.emissive.r || 0) + c.r * k), Math.min(1, (mt.emissive.g || 0) + c.g * k), Math.min(1, (mt.emissive.b || 0) + c.b * k));
          v.tfT = (v.tfT || 0) - rdt; if (v.tfT <= 0 && this.vfx && this.stop <= 0) { v.tfT = .05; this.vfx.aura?.({ x: v.rig.position.x }, f.def.id); }
        }
        const bar = bars?.[i]; if (!bar) return;
        const ready = !on && f.meter >= TF.cost && this.phase === 'fight';
        bar.classList.toggle('on', on); bar.classList.toggle('ready', ready);
        if (on) { bar.querySelector('i').style.width = (f.tf / (f.tfMax || TF.dur) * 100).toFixed(1) + '%'; const n = formName(f.def.id, t); if (bar.dataset.n !== n) { bar.dataset.n = n; bar.querySelector('b').textContent = n; } bar.querySelector('em').textContent = Math.ceil(f.tf) + ' s'; }
        else if (ready) { if (bar.dataset.n !== 'ready') { bar.dataset.n = 'ready'; bar.querySelector('b').textContent = t('tf.ready'); bar.querySelector('em').textContent = t(m.mode === 'versus' ? (i ? 'tf.key.p2' : 'tf.key.p1') : 'tf.key'); } }
      });
      return out;
    };
    const dispose = m.dispose;
    m.dispose = function () { bars?.forEach(b => b.remove()); this.v?.forEach(v => { if (v.tfPal !== undefined) { applyChromaFx(v.c.holder, v.tfPal || null); v.tfPal = undefined; } }); return dispose.call(this); };
    const restart = m.restart;
    m.restart = function (...a) { this.v?.forEach(v => { if (v.tfPal !== undefined) { applyChromaFx(v.c.holder, v.tfPal || null); v.tfPal = undefined; } }); return restart.apply(this, a); };
  }
  return api;
}
export const FORM_NAMES = { es: FORM, en: FORM_EN };
