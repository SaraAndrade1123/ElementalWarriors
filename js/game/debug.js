// Herramientas de depuración del combate (F1): cajas de daño/golpe/colisión y datos de fotogramas.
// `boxesOf` y `infoLines` son puras (se prueban con Node); `DebugOverlay` solo dibuja con Three.js.
import * as THREE from 'three';
import { WORLD } from './fighter.js';

const FPS = 60;
export const COLORS = { hurt: 0x39ff6a, hit: 0xff3030, reach: 0xffd23a, body: 0x35c8ff };

// Fase del golpe en curso: «startup» (preparación), «active» (hace daño), «recovery» (recuperación) o null.
export function phaseOf(f) {
  const a = f.act; if (!a) return null; const d = a.def;
  return a.t < d.startup ? 'startup' : a.t < d.startup + d.active ? 'active' : 'recovery';
}

// Cajas del luchador en coordenadas lógicas (x, y). `hit` solo existe durante la ventana activa; `reach` es el alcance
// total del golpe en curso (también en preparación y recuperación) para ver de dónde puede salir el golpe.
export function boxesOf(f) {
  const out = { hurt: f.hurt(), hit: f.hitbox(), reach: null, body: { x0: f.x - WORLD.minGap / 2, x1: f.x + WORLD.minGap / 2, y0: f.y, y1: f.y } };
  if (f.act) {
    const d = f.act.def, e = f.x + f.facing * d.range, s = f.x + f.facing * .2;
    out.reach = { x0: Math.min(s, e), x1: Math.max(s, e), y0: f.y + d.y0, y1: f.y + d.y1 };
  }
  return out;
}

const fr = s => Math.round(s * FPS);
// Líneas de texto del panel de depuración (una por luchador + datos globales). Todo sale del estado real de la simulación.
export function infoLines(m) {
  const L = [`F1 depuración · simulación fija ${FPS} Hz · pasos/fotograma ${m.lastSteps} · ronda ${m.round} · fase ${m.phase}`];
  m.f.forEach((f, i) => {
    const ph = phaseOf(f), a = f.act, d = a?.def;
    const mv = a ? `${a.name} ${ph} ${fr(a.t)}f [${fr(d.startup)}+${fr(d.active)}+${fr(d.recovery)}]` : '—';
    L.push(`J${i + 1} ${f.def.name}: ${f.state} · vida ${f.hp.toFixed(1)}/${f.maxHp} · x ${f.x.toFixed(2)} y ${f.y.toFixed(2)} · mira ${f.facing > 0 ? '→' : '←'}`);
    L.push(`    golpe ${mv} · aturdido ${f.stun > 0 ? fr(f.stun) + 'f (' + f.stunType + ')' : '—'} · combo recibido ${f.combo} · cadena ${f.chain} · aire ${f.juggle}/${6}`);
    L.push(`    Resonancia ${Math.round(f.meter ?? 0)}/100 · guardia ${Math.round(f.guard ?? 0)}/100 · invulnerable ${f.inv > 0 || f.down > 0 || f.getup > 0 ? 'sí' : 'no'} · búfer [${(f.buf || []).map(e => e.b).join(' ')}]`);
  });
  const e = m.lastEv; L.push(e ? `último contacto: ${e.a.def.name} ${e.move} → ${e.blocked ? 'BLOQUEADO' : e.dmg.toFixed(1) + ' de daño' + (e.ko ? ' (K.O.)' : '')}` : 'último contacto: —');
  return L;
}

// Dibuja los rectángulos como líneas por encima de todo (sin depth test) en el plano de combate.
export class DebugOverlay {
  constructor(scene) {
    this.group = new THREE.Group(); this.group.renderOrder = 999; scene.add(this.group); this.scene = scene;
    this.items = [0, 1].map(() => ({
      hurt: this.#rect(COLORS.hurt), hit: this.#rect(COLORS.hit), reach: this.#rect(COLORS.reach, .45), body: this.#rect(COLORS.body)
    }));
    this.projBoxes = [0, 1, 2, 3].map(() => this.#rect(COLORS.hit));
  }
  #rect(color, opacity = 1) {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(8 * 3), 3));
    const m = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthTest: false, depthWrite: false, fog: false }));
    m.frustumCulled = false; m.renderOrder = 999; m.visible = false; this.group.add(m); return m;
  }
  static #set(line, b, z = .8) {
    if (!b) { line.visible = false; return; }
    const { x0, x1, y0, y1 } = b, h = y1 === y0 ? .04 : 0, p = line.geometry.attributes.position.array; // una caja plana (y0=y1) se dibuja como una barra fina
    p.set([x0, y0, z, x1, y0, z, x1, y0, z, x1, y1 + h, z, x1, y1 + h, z, x0, y1 + h, z, x0, y1 + h, z, x0, y0, z]);
    line.geometry.attributes.position.needsUpdate = true; line.visible = true;
  }
  update(fighters, proj = []) {
    this.projBoxes.forEach((l, i) => { const p = proj[i]; DebugOverlay.#set(l, p ? { x0: p.x - p.w / 2, x1: p.x + p.w / 2, y0: p.y - p.h / 2, y1: p.y + p.h / 2 } : null, .86); });
    fighters.forEach((f, i) => { const b = boxesOf(f), it = this.items[i];
      DebugOverlay.#set(it.hurt, b.hurt); DebugOverlay.#set(it.hit, b.hit, .85); DebugOverlay.#set(it.reach, b.reach, .82); DebugOverlay.#set(it.body, b.body, .78); });
  }
  dispose() {
    this.group.traverse(o => { if (o.isLineSegments) { o.geometry.dispose(); o.material.dispose(); } }); this.group.removeFromParent();
  }
}
