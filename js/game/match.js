import * as THREE from 'three';
import { Fighter, separate, resolveBoth, resolveThrows, stepProjectiles, makeProjectile, RULES, NONE } from './fighter.js';
import { makeBrain } from './ai.js';
import { glow } from './arena.js';
import { Vfx, elemOf } from './vfx.js';
import { themed, signature, TH } from './chroma-vfx.js';
import { DebugOverlay, infoLines } from './debug.js';
import { t } from '../systems/localization.js';
import { A11Y } from '../systems/a11y.js';

const IDLE = NONE;
const PI = Math.PI;
// Simulación a paso FIJO (60 Hz), independiente de los FPS: el daño, las ventanas de golpe y los temporizadores avanzan solo en pasos.
export const STEP = 1 / 60, MAX_STEPS = 6;
const DUMMY_ALIAS = { stand: 'still', guardLow: 'crouch' }; // nombres de v0.6
const clamp = THREE.MathUtils.clamp;
const _p = new THREE.Vector3();

// Un combate (por defecto al mejor de 3 rondas, 60 s) o entrenamiento libre: luchadores, rondas, proyectiles, Resonancia, efectos, animación y cámara 2.5D.
// Modos: 'cpu' (jugador 1 vs CPU), 'versus' (dos jugadores) y 'training' (maniquí, sin cronómetro).
// Opciones: wins (rondas para ganar), maxRounds, roundTime (s; Infinity = sin tiempo), level (dificultad CPU), dummy (maniquí), startHp (fracción de vida del J1 al empezar),
// infinite (vida infinita: nunca cae; en entrenamiento el maniquí además se regenera entre combos salvo infinite: false), onEvent (golpes/bloqueos/lanzamientos para desafíos), onFx, onReact, onHud, onResult.
export class Match {
  constructor(sm, input, c1, c2, o = {}) {
    Object.assign(this, { sm, input, o, mode: o.mode || 'cpu', t: 0, acc: 0, lastSteps: 0, lastEv: null, prev: null, dbgOverlay: null, cx: 0, cy: 0, cd: 12, shake: 0, stop: 0, zoom: 0, paused: false, sparks: [], cb: null, glowMap: glow(), proj: [], notes: [] });
    this.f = [new Fighter(c1.def, -2.2, 1, o.moves), new Fighter(c2.def, 2.2, -1, o.moves)];
    this.winsNeeded = o.wins ?? 2; this.maxRounds = o.maxRounds ?? 5; this.roundTime = o.roundTime ?? 60; this.timed = this.mode !== 'training';
    // Vida infinita (entrenamiento / desafíos): nadie cae y la vida se recupera al terminar cada combo; desactivada, el daño se acumula y hay K.O. de verdad.
    this.infinite = !!o.infinite;
    this.dummy = this.mode === 'training' ? DUMMY_ALIAS[o.dummy] || o.dummy || 'still' : null;
    this.brain1 = o.watch && this.mode === 'cpu' ? makeBrain('cpu', Math.random, o.level1 || o.level) : null; // (v1.9) modo espectador: la CPU también lleva al J1
    this.brain = this.mode === 'cpu' ? makeBrain('cpu', Math.random, o.level) : this.mode === 'training' ? makeBrain(this.dummy, Math.random, o.level) : null;
    try { this.vfx = sm.scene ? new Vfx(sm.scene, sm.q, sm.reduce) : null; } catch (e) { console.warn('[vfx]', e); this.vfx = null; }
    this.v = [c1, c2].map((c, i) => {
      const rig = new THREE.Group(); c.holder.position.set(0, 0, 0); c.holder.scale.setScalar(1); c.holder.visible = true;
      rig.add(c.holder); sm.scene.add(rig);
      const mats = []; c.holder.traverse(m => { if (m.isMesh) mats.push(...[].concat(m.material)); });
      c.anim?.reset(); if (c.anim) c.anim.lead = this.f[i].facing === 1 ? -1 : 1; // el lado visible para la cámara lidera
      return { c, rig, mats, turn: this.f[i].facing, cel: null, preview: null, auraT: 0 };
    });
    this.lastTick = -1;
    this.restart();
  }

  get infinite() { return this._inf; }
  set infinite(v) { this._inf = !!v; this.regen = this.mode === 'training' && this._inf; this.koT = 0; for (const f of this.f || []) { f.immortal = this._inf; f.calm = 0; } }

  // Avisos hacia fuera (sonido, escenario…): o.onFx(nombre, {who, x, vol}) y o.onReact({power, color}). Un fallo ahí nunca rompe el combate.
  fx(name, f, extra) { try { this.o.onFx?.(name, { who: f?.def?.id, x: f?.x, ...extra }); } catch (e) { console.warn('[fx]', e); } }
  react(power, color) { try { this.o.onReact?.({ power, color }); } catch (e) { console.warn('[react]', e); } }
  note(text, side, kind = '') { this.notes.push({ text, side, kind, t: 1.1 }); if (this.notes.length > 4) this.notes.shift(); }

  restart() {
    this.wins = [0, 0]; this.round = 1; this.stats = { dmg: [0, 0], combo: [0, 0], best: [0, 0], ex: [0, 0], throws: [0, 0] }; this.comboDmg = [0, 0]; this.clock = 0; this.winner = -1; this.why = 'ko';
    for (const f of this.f) f.meter = 0;
    this.newRound(); this.input.clear();
  }
  newRound() {
    this.f[0].reset(-2.2, 1, true); this.f[1].reset(2.2, -1, true);
    if (this.round === 1 && this.o.startHp > 0) this.f[0].hp = Math.max(1, Math.min(this.f[0].maxHp, this.f[0].maxHp * this.o.startHp)); // vida arrastrada (supervivencia)
    this.brain?.reset?.();
    for (const p of this.proj) this.vfx?.projectileEnd(p); this.proj = [];
    this.prev = this.f.map(f => ({ x: f.x, y: f.y })); this.acc = 0; this.timer = this.roundTime; this.cb = null; this.koT = 0; this.pt = 0; this.cx = 0; this.cy = 0; this.notes = [];
    this.phase = this.timed ? 'intro' : 'fight'; this.lastTick = -1; if (this.round > 1) this.fx('round_start');
    this.v?.forEach((v, i) => { v.turn = this.f[i].facing; v.cel = this.phase === 'intro' && this.round === 1 ? { name: 'intro', t: -.15 } : null; v.c.anim?.reset(); });
    if (this.mode === 'training') for (const f of this.f) f.meter = RULES.meterMax;
  }
  endRound(w, why) {
    this.winner = w; this.why = why; if (w >= 0) { this.wins[w]++; this.v?.[w] && (this.v[w].cel = { name: 'win', t: -.6 }); } // el ganador celebra
    this.phase = why === 'ko' ? 'ko' : 'end'; this.pt = 0; this.fx('round_end');
  }
  afterRound() {
    if (this.wins.some(w => w >= this.winsNeeded) || this.round >= this.maxRounds) {
      this.phase = 'result'; const [x, y] = this.wins;
      const winner = x === y ? -1 : x > y ? 0 : 1; if (winner >= 0) this.fx(winner === 0 ? 'victory' : 'defeat');
      this.o.onResult?.({ winner, wins: [...this.wins], stats: this.stats, time: this.clock, hp: this.f.map(f => f.hp / f.maxHp), rounds: this.round });
    } else { this.round++; this.newRound(); }
  }

  get announce() {
    switch (this.phase) {
      case 'intro': return this.pt < 1.3 ? t('ann.round', { n: this.round }) : t('ann.fight');
      case 'ko': return t('ann.ko');
      case 'end': return this.why === 'time' && this.pt < .9 ? t('ann.time') : this.winner < 0 ? t('ann.draw') : t('ann.win', { name: this.f[this.winner].def.name });
      default: return this.koT > 0 ? t('ann.ko') : '';
    }
  }
  get introLen() { return this.round === 1 ? 2.4 : 1.6; }

  event(e) { try { this.o.onEvent?.(e); } catch (err) { console.warn('[event]', err); } }
  // (v1.9) ENTRENAMIENTO: registro de entradas del J1 (dirección relativa al rival + botones, con los fotogramas que se mantiene)
  logInput(i, f) {
    const L = this.inlog ||= [], fw = (i.x || 0) * (f.facing || 1), d = i.jump ? (fw > 0 ? '↗' : fw < 0 ? '↖' : '↑') : i.down ? (fw > 0 ? '↘' : fw < 0 ? '↙' : '↓') : fw > 0 ? '→' : fw < 0 ? '←' : '';
    const b = [['l', 'L'], ['m', 'M'], ['h', 'H'], ['s', 'U'], ['r', 'R'], ['w', 'E'], ['t', 'T'], ['guard', 'G']].filter(([k]) => i[k]).map(([, g]) => g).join('+');
    const tok = [d, b].filter(Boolean).join(' '), top = L[0];
    if (top && top.tok === tok) { top.n++; return; }
    L.unshift({ tok, n: 1 }); if (L.length > 14) L.length = 14;
  }
  // (v1.9) ventaja en fotogramas tras un golpe o bloqueo: aturdimiento del que recibe − lo que le falta al atacante
  frameAdv(ev) {
    const a = ev.a, b = ev.b, act = a?.act; if (!a || !b || ev.proj) return null;
    const d = act?.def, left = act ? Math.max(0, (act.end ?? d.startup + d.active + d.recovery) - act.t) : 0;
    return Math.round(((b.stun || 0) - left) * 60);
  }
  onHit(ev, idx) {
    if (this.mode === 'training' && idx === 0) { const n = this.frameAdv(ev); if (n != null) this.adv = { n, blocked: !!ev.blocked, t: 2.5 }; }
    this.lastEv = ev; this.event({ type: ev.blocked ? 'block' : ev.armored ? 'armor' : ev.crush ? 'crush' : 'hit', by: idx, move: ev.move, combo: ev.combo + (ev.blocked || ev.armored || ev.crush ? 0 : 1), dmg: ev.dmg, ko: !!ev.ko, air: !!ev.b.air, counter: !!ev.counter, proj: !!ev.proj, chain: ev.a.chain || 0 }); const { a, b, pos } = ev, big = ev.ko || /^(h|ch|jh|s|ex)$/.test(ev.move) || ev.launch;
    if (ev.armored) { this.stop = .07; this.shake = Math.max(this.shake, .12); this.vfx?.hit(pos, a.def.id, { armored: true, power: .6 }); this.fx('block', a, { x: b.x }); this.note(t('hud.armor'), 1 - idx, 'armor'); return; }
    if (ev.crush) { this.stop = .14; this.shake = Math.max(this.shake, .3); this.vfx?.flash(pos, 0xffe066, 3); this.fx('guard_break', a, { x: b.x }); this.note(t('hud.crush'), idx, 'crush'); this.react(.7); return; }
    this.stop = ev.ko ? .22 : ev.blocked ? .045 : .055 + Math.min(ev.dmg, 16) * .005 + (ev.counter ? .04 : 0);
    this.shake = Math.max(this.shake, ev.ko ? .45 : ev.blocked ? .03 : big ? .2 : .09);
    this.vfx?.hit(pos, a.def.id, { blocked: ev.blocked, power: ev.blocked ? .3 : Math.min(1.4, ev.dmg / 10), counter: ev.counter });
    if (!this.vfx) this.spark(pos, ev.blocked ? 0x9cc8ff : a.def.fx.color, ev.blocked ? .8 : big ? 2.4 : 1.6);
    if (ev.blocked) { this.fx('block', a, { x: b.x }); this.react(.18); return; }
    this.fx(big || ev.combo >= 4 ? 'hit_heavy' : ev.move === 'air' || ev.combo >= 2 ? 'hit_medium' : 'hit_light', a, { x: b.x });
    if (ev.ko) this.fx('ko', a, { x: b.x });
    if (ev.counter) this.note(t('hud.counter'), idx, 'counter');
    this.react(ev.ko ? 1 : Math.min(.8, .25 + ev.dmg / 20), '#' + new THREE.Color(a.def.fx.color).getHexString());
    this.stats.dmg[idx] += ev.dmg; this.stats.combo[idx] = Math.max(this.stats.combo[idx], ev.combo);
    this.comboDmg[idx] = ev.combo <= 1 ? ev.dmg : this.comboDmg[idx] + ev.dmg; this.stats.best[idx] = Math.max(this.stats.best[idx], this.comboDmg[idx]);
    if (ev.combo >= 2) this.cb = { n: ev.combo, side: idx, t: 1.3, dmg: this.comboDmg[idx] };
    else if (this.mode === 'training') this.cb = { n: 1, side: idx, t: 1, dmg: ev.dmg };
  }
  onThrow(ev, idx) {
    const { a, b, pos } = ev;
    if (ev.type === 'grab') { this.fx('block', a, { x: b.x }); this.stop = .05; return; }
    if (ev.type === 'tech') { this.event({ type: 'tech', by: 1 - idx, move: 'throw' }); this.vfx?.flash(pos, 0xffffff, 1.8); this.fx('block', a, { x: b.x }); this.stop = .08; this.note(t('hud.tech'), 1 - idx, 'tech'); return; }
    this.lastEv = { ...ev, move: 'throw', blocked: false }; this.event({ type: 'throw', by: idx, move: 'throw', combo: ev.b.combo, dmg: ev.dmg, ko: !!ev.ko, air: false, back: !!ev.back });
    this.stop = ev.ko ? .22 : .1; this.shake = Math.max(this.shake, .25); this.vfx?.hit(pos, a.def.id, { power: 1.3 }); this.vfx?.cue({ kind: 'land', k: 1 }, a.def.id, pos, a.facing, b);
    this.fx('throw', a, { x: b.x }); if (ev.ko) this.fx('ko', a, { x: b.x }); this.react(.7); this.stats.dmg[idx] += ev.dmg; this.stats.throws[idx]++;
    this.note(t('hud.throw'), idx, 'throw');
  }
  spark(p, color, size) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowMap, color, transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    s.position.set(p.x, p.y, 1); s.userData = { life: .28, size }; s.scale.setScalar(size); s.renderOrder = 10; this.sm.scene.add(s); this.sparks.push(s);
  }

  // Depuración (F1): cajas de daño (verde), golpe activo (rojo), alcance del golpe en curso (amarillo), colisión corporal (azul) y panel de datos.
  setDebug(on) {
    on = !!on; if (on === !!this.dbgOverlay) return;
    if (on) this.dbgOverlay = new DebugOverlay(this.sm.scene); else { this.dbgOverlay.dispose(); this.dbgOverlay = null; }
  }
  get debug() { return !!this.dbgOverlay; }

  // Un fotograma de pantalla puede ejecutar 0, 1 o varios pasos de simulación de 1/60 s (nunca más de MAX_STEPS).
  update(dt, cam) {
    dt = Math.min(dt, .1); this.t += dt; this.acc += dt; let n = 0;
    while (this.acc >= STEP - 1e-9 && n < MAX_STEPS) { this.step(STEP); this.acc -= STEP; n++; }
    if (n === MAX_STEPS) this.acc = 0; // equipo demasiado lento: se descarta el atraso en vez de acelerar el combate
    this.lastSteps = n; this.render(dt, cam);
  }

  // Entrenamiento: cambiar el comportamiento del maniquí y recolocar a los luchadores (sin tocar la vida ni la Resonancia).
  setDummy(kind) { if (this.mode !== 'training') return; this.dummy = DUMMY_ALIAS[kind] || kind; this.brain = makeBrain(this.dummy, Math.random, this.o.level); }
  resetPositions() {
    this.f.forEach((f, i) => { const hp = f.hp, ko = f.ko; f.reset(i ? 2.2 : -2.2, i ? -1 : 1, true); f.hp = hp; f.ko = ko; });
    for (const p of this.proj) this.vfx?.projectileEnd(p); this.proj = [];
    this.cb = null; this.stop = 0; this.brain?.reset?.(); this.brain1?.reset?.(); this.prev = this.f.map(f => ({ x: f.x, y: f.y })); this.input.clear?.();
  }

  // Lógica del combate: solo se llama con paso fijo.
  step(sdt) {
    this.prev = this.f.map(f => ({ x: f.x, y: f.y }));
    let dt = sdt; if (this.stop > 0) { this.stop -= dt; dt = 0; } // «hit-stop»: congela un instante al impactar
    const [a, b] = this.f, slow = this.phase === 'ko' ? .35 : 1, gdt = dt * slow, live = this.phase === 'fight';
    if (gdt > 0) {
      const vs = this.mode === 'versus', i1 = live ? (this.brain1 ? (this.input.read(0), this.brain1.think(gdt, a, b)) : this.input.read(0)) : (this.input.read(0), IDLE); // fuera de combate se vacían las pulsaciones
      const i2 = vs ? (live ? this.input.read(1) : (this.input.read(1), IDLE)) : !live ? IDLE : this.brain ? this.brain.think(gdt, b, a) : this.o.input2 ? this.o.input2.read() : IDLE;
      if (this.mode === 'training' && live) this.logInput(i1, a);
      a.update(gdt, i1, b); b.update(gdt, i2, a); separate(a, b);
      if (this.infinite) for (const f of this.f) { if (f.ko) { f.revive(); f.hp = f.maxHp; } else if (f.hp < 1) f.hp = 1; } // vida infinita: nunca llega a 0
      if (live) {
        for (const e of resolveThrows(a, b)) this.onThrow(e, e.a === a ? 0 : 1);
        for (const e of resolveBoth(a, b)) this.onHit(e, e.a === a ? 0 : 1); // golpes simultáneos = intercambio
        for (const [i, f] of this.f.entries()) for (const e of f.ev) this.onFighterEv(e, f, i);
        for (const e of stepProjectiles(this.proj, this.f, gdt)) {
          if (e.type === 'hit') this.onHit(e, e.a === a ? 0 : 1);
          else if (e.type === 'clash') { this.vfx?.flash(e.pos, 0xffffff, 2); this.fx('block', e.p.owner, { x: e.pos.x }); }
        }
        for (const p of this.proj) if (p.dead) themed(p.owner, () => this.vfx?.projectileEnd(p, 'end'));
        this.proj = this.proj.filter(p => !p.dead);
      }
    }
    this.pt += dt;
    switch (this.phase) {
      case 'intro': if (this.pt > this.introLen) { this.phase = 'fight'; this.pt = 0; this.v.forEach(v => { if (v.cel?.name === 'intro') v.cel = null; }); } break;
      case 'fight': {
        this.clock += dt; if (this.timed) this.timer -= gdt;
        for (const f of this.f) { const ac = f.act; if (ac && !ac.snd && ac.t >= ac.def.startup && !ac.def.throw) { ac.snd = true; this.fx(/^(h|ch|jh|s|ex)$/.test(ac.name) ? 'whiff_heavy' : 'whiff_light', f); } }
        if (this.timed) { const n = Math.ceil(this.timer); if (n !== this.lastTick) { this.lastTick = n; if (n > 0 && n <= 5) this.fx('countdown_tick'); } }
        if (this.mode === 'training') {
          // Sin vida infinita: K.O. real (cámara lenta y aviso) y, al poco, los dos vuelven con la vida llena a su sitio.
          if (a.ko || b.ko) { this.koT += dt; if (this.koT > 2.4) { a.revive(); b.revive(); this.koT = 0; this.resetPositions(); } }
          for (const f of this.f) if (f.combo === 0 && !(f.act?.name === 'ex')) f.meter = Math.min(RULES.meterMax, f.meter + dt * 40); // barra recargable en entrenamiento
          // Con vida infinita, cada luchador recupera la vida en cuanto el rival deja de combearle (a los 0,6 s sin recibir golpes).
          if (this.regen) for (const [i, f] of this.f.entries()) { f.calm = f.combo === 0 && f.stun <= 0 && !f.down && !f.getup && !f.ko ? (f.calm || 0) + dt : 0; if (f.calm > .6 || (f.combo === 0 && f.hp < f.maxHp * .15)) f.hp = f.calm > .6 ? Math.min(f.maxHp, f.hp + dt * f.maxHp * 1.6) : f.maxHp; }
        }
        else if (a.ko || b.ko) this.endRound(a.ko && b.ko ? -1 : a.ko ? 1 : 0, 'ko');
        else if (this.timer <= 0) { const ra = a.hp / a.maxHp, rb = b.hp / b.maxHp; this.endRound(Math.abs(ra - rb) < .001 ? -1 : ra > rb ? 0 : 1, 'time'); }
        break;
      }
      case 'ko': if (this.pt > 1.8) { this.phase = 'end'; this.pt = 0; } break;
      case 'end': if (this.pt > 2.6) this.afterRound(); break;
    }
    if (this.cb) { this.cb.t -= sdt; if (this.cb.t <= 0) this.cb = null; }
    for (const n of this.notes) n.t -= sdt; this.notes = this.notes.filter(n => n.t > 0);
  }

  onFighterEv(e, f, i) {
    const o = this.f[1 - i];
    switch (e.t) {
      case 'proj': this.proj.push(makeProjectile(f, e)); this.fx('projectile', f); break;
      case 'ex': this.stats.ex[i]++; this.stop = Math.max(this.stop, .12); this.zoom = .6; this.vfx?.flash({ x: f.x, y: 1.8 }, elemOf(f.def.id).c.getHex(), 3.2); this.fx('special', f); this.note(t('hud.ex'), i, 'ex'); break;
      case 'rc': this.stop = Math.max(this.stop, .08); this.vfx?.flash({ x: f.x, y: 1.6 }, 0xffffff, 2.6); this.fx('dodge', f); this.note(t('hud.rc'), i, 'rc'); break;
      case 'repel': {
        const dir = Math.sign(o.x - f.x) || f.facing; o.act = null; o.kv = dir * 11; o.stun = o.stunMax = .4; o.stunType = 'block'; o.bkN++; o.hitKb = 6;
        this.vfx?.flash({ x: f.x + dir * .6, y: 1.6 }, elemOf(f.def.id).c.getHex(), 3); this.shake = Math.max(this.shake, .2); this.fx('hit_heavy', f); this.note(t('hud.repel'), i, 'repel'); break; }
      case 'knockdown': this.vfx?.dust(f.x, 1.1); this.shake = Math.max(this.shake, .12); this.fx('land', f, { vol: 1 }); break;
      case 'backdash': this.vfx?.dust(f.x, .5); this.fx('dodge', f); break;
      case 'dash': this.vfx?.dust(f.x, .5); break;
      case 'jump2': this.vfx?.cue({ kind: 'wind_burst' }, f.def.id, { x: f.x, y: f.y, z: 0 }, f.facing, f); break;
    }
  }

  // Presentación (cada fotograma de pantalla): posiciones interpoladas entre pasos, animación, efectos, HUD y cámara. No cambia el estado del combate.
  render(rdt, cam) {
    const [a, b] = this.f, alpha = clamp(this.acc / STEP, 0, 1);
    const ix = (f, i) => this.prev[i].x + (f.x - this.prev[i].x) * alpha, iy = (f, i) => this.prev[i].y + (f.y - this.prev[i].y) * alpha;
    const vdt = this.stop > 0 ? 0 : rdt * (!this.noSlow && (this.phase === 'ko' || this.koT > 0 && this.koT < 1.2) ? .35 : 1); // (la escena final la desactiva: noSlow) // tiempo de animación: el hit-stop congela la pose y el KO va en cámara lenta

    this.v.forEach((v, i) => {
      const f = this.f[i], k = 1 - Math.exp(-rdt * 16), anim = v.c.anim;
      v.turn += (f.facing - v.turn) * k; v.c.holder.rotation.y = v.turn * (PI / 2 - .28);
      if (anim) anim.lead = v.turn >= 0 ? -1 : 1; // al girarse, el lado que mira a la cámara pasa a ser el adelantado
      f.crouch += ((f.crouching ? 1 : 0) - f.crouch) * (1 - Math.exp(-rdt * 22));
      v.rig.position.set(ix(f, i), iy(f, i), 0); v.rig.rotation.z = 0;
      const e = f.flash, rc = f.rcT > 0 ? f.rcT / .35 : 0, E = elemOf(f.def.id).c;
      const ef = e * e * .38; for (const m of v.mats) m.emissive?.setRGB(ef + rc * E.r * .5, ef * .45 + rc * E.g * .5, ef * .3 + rc * E.b * .5);
      if (v.cel) { v.cel.t += vdt; const c = anim?.dir.clips[v.cel.name]; if (c && !c.hold && v.cel.t > c.dur * (anim.S.atkSpeed || 1)) v.cel = null; }
      anim?.update(vdt, f, { yaw: v.c.holder.rotation.y, action: v.cel, preview: v.preview });
      // estelas y efectos que pide la animación
      if (anim && this.vfx && vdt > 0) themed(f, () => { // con los colores y la firma de su chroma (si lleva)
        const d = anim.dir; this.vfx.trail(i, anim.anchors(), d.trails, elemOf(f.def.id));
        if (d.cues.length) { const A = anim.anchors(); for (const c of d.cues) { const an = A[c.at] || A.wF; an.tip.getWorldPosition(_p); this.vfx.cue(c, f.def.id, _p, f.facing, { x: ix(f, i) }); } }
        v.auraT -= vdt; if ((f.meter >= RULES.meterMax || (f.act && f.act.name === 'ex')) && v.auraT <= 0) { v.auraT = .06; this.vfx.aura({ x: ix(f, i) }, f.def.id); }
      });
    });
    for (const p of this.proj) themed(p.owner, () => { // el proyectil lleva el color y la estela-firma del chroma de quien lo lanza
      this.vfx?.projectile(p);
      if (TH.cur?.style && this.vfx && vdt > 0 && Math.random() < .6) signature(this.vfx, { x: p.x - (p.dir || 0) * .3, y: p.y, z: .45 }, 2, 'trail', p.dir || 0);
    });
    this.vfx?.update(vdt > 0 ? vdt : rdt * .15);
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i], u = s.userData; u.life -= rdt;
      if (u.life <= 0) { s.material.dispose(); s.removeFromParent(); this.sparks.splice(i, 1); continue; }
      const r = 1 - u.life / .28; s.scale.setScalar(u.size * (1 + r * 1.5)); s.material.opacity = 1 - r;
    }
    this.dbgOverlay?.update(this.f, this.proj);
    this.o.onHud?.({ mode: this.mode, hp: [a.hp / a.maxHp, b.hp / b.maxHp], meter: [a.meter / RULES.meterMax, b.meter / RULES.meterMax], guard: [a.guard / RULES.guardMax, b.guard / RULES.guardMax],
      wins: this.wins, timer: Math.max(0, Math.ceil(this.timer)), need: this.winsNeeded, text: this.announce, combo: this.cb, notes: this.notes, dbg: this.dbgOverlay ? infoLines(this) : null, inlog: this.mode === 'training' ? this.inlog || [] : null, adv: this.adv && this.adv.t > 0 ? this.adv : null });

    // --- cámara lateral: sigue el punto medio, se aleja para encuadrar a ambos, sube con el salto y se acerca un instante en las técnicas reforzadas ---
    const ax = ix(a, 0), bx = ix(b, 1), gap = Math.abs(ax - bx), kc = 1 - Math.exp(-rdt * 6);
    const need = clamp((gap + 5.5) / (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) * cam.aspect), 11.5, 26);
    this.zoom = Math.max(0, this.zoom - rdt * 1.6); if (this.adv) this.adv.t -= rdt;
    this.cx += (clamp((ax + bx) / 2, -6, 6) - this.cx) * kc; this.cd += (need * (1 - this.zoom * .18 * A11Y.camK) - this.cd) * kc;
    this.cy += (Math.max(iy(a, 0), iy(b, 1)) * .55 - this.cy) * kc;
    let sx = 0, sy = 0; if (this.shake > .002 && !this.sm.reduce) { sx = (Math.random() - .5) * this.shake * A11Y.camK; sy = (Math.random() - .5) * this.shake * A11Y.camK; } // (F9) efectos de cámara / cámara tranquila this.shake *= Math.exp(-rdt * 9);
    cam.position.set(this.cx + sx, 2.9 + this.cy + sy, this.cd); cam.lookAt(this.cx, 1.9 + this.cy, 0);
  }

  dispose() {
    this.setDebug(false); this.vfx?.dispose();
    for (const s of this.sparks) { s.material.dispose(); s.removeFromParent(); } this.glowMap.dispose();
    for (const v of this.v) { v.c.anim?.reset(); const h = v.c.holder; for (const m of v.mats) m.emissive?.setRGB(0, 0, 0); this.sm.stage.add(h); h.rotation.set(0, v.c.def.yaw || 0, 0); h.scale.setScalar(1); h.position.set(0, 0, 0); h.visible = false; v.rig.removeFromParent(); }
  }
}
