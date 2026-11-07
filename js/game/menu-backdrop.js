import * as THREE from 'three';

// FONDO TEMÁTICO DEL MENÚ (v1.9): detrás del guerrero elegido aparece el santuario de su elemento, animado.
//   común  · sello elemental gigante (dos anillos de runas que giran en sentido contrario) y columna de luz
//   fuego  · lenguas de fuego que suben tras la plataforma, sol carmesí, brasas que ascienden
//   agua   · ondas concéntricas en el suelo, arco de marea que fluye, burbujas que suben
//   tierra · rocas que orbitan, cristales que brotan del suelo y laten, polvo dorado
//   viento · cintas de viento en espiral, anillos de aire, hojas que cruzan
// Todo es geometría y texturas procedurales (originales), aditivo y detrás del guerrero (z < -1.5) para no taparlo.
// Cambiar de guerrero funde un santuario con otro. «reduce» (reducir movimiento) ralentiza las animaciones.
const ELEM_OF = { ignis: 'fire', aqua: 'water', terra: 'earth', zephyr: 'air' };
const canvas = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); if (x) draw(x, w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
const add = (o) => new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, side: THREE.DoubleSide, ...o });

// sello: anillo de runas + símbolo del elemento en el centro
function sigilTex(el) {
  return canvas(512, 512, (x, S) => {
    const c = S / 2; x.translate(c, c); x.strokeStyle = '#fff'; x.fillStyle = '#fff'; x.lineCap = 'round';
    x.globalAlpha = .9; x.lineWidth = 5; x.beginPath(); x.arc(0, 0, 246, 0, 7); x.stroke();
    x.lineWidth = 2; x.beginPath(); x.arc(0, 0, 226, 0, 7); x.stroke(); x.beginPath(); x.arc(0, 0, 150, 0, 7); x.stroke();
    // runas (trazos originales) entre los dos anillos
    for (let i = 0; i < 24; i++) { x.save(); x.rotate(i / 24 * Math.PI * 2); x.translate(0, -236); x.lineWidth = 2.4; x.beginPath();
      const k = i % 4; if (k === 0) { x.moveTo(-5, -6); x.lineTo(0, 6); x.lineTo(5, -6); } else if (k === 1) { x.moveTo(-6, 0); x.lineTo(6, 0); x.moveTo(0, -6); x.lineTo(0, 6); }
      else if (k === 2) { x.arc(0, 0, 5, 0, Math.PI); } else { x.moveTo(-5, 5); x.lineTo(0, -6); x.lineTo(5, 5); x.closePath(); } x.stroke(); x.restore(); }
    // estrella de ocho puntas
    x.lineWidth = 1.6; x.globalAlpha = .6; x.beginPath(); for (let i = 0; i <= 16; i++) { const a = i / 16 * Math.PI * 2 - Math.PI / 2, r = i % 2 ? 96 : 220; i ? x.lineTo(Math.cos(a) * r, Math.sin(a) * r) : x.moveTo(Math.cos(a) * r, Math.sin(a) * r); } x.stroke();
    x.globalAlpha = 1; x.lineWidth = 7; x.beginPath();
    if (el === 'fire') { x.moveTo(0, -95); x.bezierCurveTo(60, -30, 70, 40, 0, 90); x.bezierCurveTo(-70, 40, -60, -30, 0, -95); x.moveTo(0, -10); x.bezierCurveTo(28, 20, 22, 60, 0, 70); x.bezierCurveTo(-22, 60, -28, 20, 0, -10); }
    else if (el === 'water') { for (const y of [-40, 0, 40]) { x.moveTo(-90, y); x.bezierCurveTo(-45, y - 32, -15, y + 32, 0, y); x.bezierCurveTo(15, y - 32, 45, y + 32, 90, y); } }
    else if (el === 'earth') { x.moveTo(-95, 70); x.lineTo(-30, -60); x.lineTo(0, 0); x.lineTo(35, -85); x.lineTo(95, 70); x.closePath(); x.moveTo(-60, 70); x.lineTo(60, 70); }
    else { x.moveTo(-90, -30); x.bezierCurveTo(-20, -90, 70, -60, 40, -10); x.bezierCurveTo(20, 20, -20, 0, 0, -20); x.moveTo(-90, 30); x.bezierCurveTo(0, 30, 60, 50, 90, 20); x.moveTo(-70, 70); x.bezierCurveTo(-10, 70, 30, 85, 70, 65); }
    x.stroke();
  });
}
const flameTex = canvas(64, 128, (x) => { const g = x.createRadialGradient(32, 96, 2, 32, 80, 64); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.35, 'rgba(255,255,255,.7)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.beginPath(); x.moveTo(32, 2); x.bezierCurveTo(50, 40, 62, 72, 56, 98); x.bezierCurveTo(50, 124, 14, 124, 8, 98); x.bezierCurveTo(2, 72, 14, 40, 32, 2); x.fillStyle = g; x.fill(); });
const dotTex = canvas(64, 64, (x) => { const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.4, 'rgba(255,255,255,.4)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); });
const ringTex = canvas(256, 256, (x) => { x.strokeStyle = '#fff'; x.lineWidth = 6; x.shadowColor = '#fff'; x.shadowBlur = 14; x.beginPath(); x.arc(128, 128, 110, 0, 7); x.stroke(); });
const leafTex = canvas(64, 64, (x) => { x.fillStyle = '#fff'; x.beginPath(); x.moveTo(6, 32); x.quadraticCurveTo(32, 2, 58, 32); x.quadraticCurveTo(32, 62, 6, 32); x.fill(); });
const bandTex = canvas(256, 16, (x, W, H) => { const g = x.createLinearGradient(0, 0, W, 0); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(.5, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, W, H); });

const R = (a, b) => a + Math.random() * (b - a);
function theme(el, col, light) {
  const g = new THREE.Group(), C = new THREE.Color(col), L = new THREE.Color(light), anim = [], mats = [];
  const M = o => { const m = add(o); mats.push(m); m.userData.base = m.opacity; return m; };
  // sello y columna de luz
  const sig = sigilTex(el);
  const s1 = new THREE.Mesh(new THREE.PlaneGeometry(7.4, 7.4), M({ map: sig, color: C, opacity: .32 })); s1.position.set(0, 2.6, -3.6); g.add(s1);
  const s2 = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 4.6), M({ map: sig, color: L, opacity: .22 })); s2.position.set(0, 2.6, -3.55); g.add(s2);
  const beam = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 9), M({ map: bandTex, color: C, opacity: .18 })); beam.rotation.z = Math.PI / 2; beam.position.set(0, 4, -3.8); beam.scale.set(1, .6, 1); g.add(beam);
  anim.push((t, dt) => { s1.rotation.z += dt * .08; s2.rotation.z -= dt * .14; const p = .5 + .5 * Math.sin(t * 1.3); s1.material.userData.k = .75 + .35 * p; });
  if (el === 'fire') {
    const sun = new THREE.Mesh(new THREE.CircleGeometry(1.7, 48), M({ map: dotTex, color: C, opacity: .55 })); sun.position.set(0, 3.2, -4.2); sun.scale.setScalar(2.2); g.add(sun);
    const fl = []; for (let i = 0; i < 16; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(.75, 1.5), M({ map: flameTex, color: i % 3 ? C : L, opacity: .42 })); const a = (i / 15 - .5) * 2.8;
      m.userData = { x: Math.sin(a) * 3.6, z: -Math.cos(a) * 2.6 - 1.4, ph: R(0, 6), sp: R(.8, 1.5), h: R(.8, 1.7) }; m.position.set(m.userData.x, 0, m.userData.z); g.add(m); fl.push(m); }
    anim.push(t => { for (const m of fl) { const u = m.userData, k = .5 + .5 * Math.sin(t * u.sp * 3 + u.ph); m.scale.set(.8 + .3 * k, u.h * (.7 + .5 * k), 1); m.position.y = .45 * m.scale.y; } sun.scale.setScalar(2.1 + .12 * Math.sin(t * .9)); });
  } else if (el === 'water') {
    const rings = []; for (let i = 0; i < 4; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), M({ map: ringTex, color: i % 2 ? L : C, opacity: .55 })); m.rotation.x = -Math.PI / 2; m.position.y = .02; m.userData.ph = i / 4; g.add(m); rings.push(m); }
    anim.push(t => { for (const m of rings) { const u = (t * .22 + m.userData.ph) % 1; m.scale.setScalar(2 + u * 9); m.material.userData.k = (1 - u) * (u < .1 ? u * 10 : 1); } });
    const arc = new THREE.Mesh(new THREE.TorusGeometry(4.2, .14, 8, 64, Math.PI), M({ map: bandTex, color: L, opacity: .45 })); arc.position.set(0, 0, -3.2); g.add(arc);
    const arc2 = new THREE.Mesh(new THREE.TorusGeometry(4.6, .07, 8, 64, Math.PI), M({ color: C, opacity: .35 })); arc2.position.set(0, 0, -3.3); g.add(arc2);
    anim.push(t => { arc.material.map.offset.x = (t * .3) % 1; arc2.rotation.z = Math.sin(t * .4) * .04; });
  } else if (el === 'earth') {
    const rocks = [], rm = new THREE.MeshStandardMaterial({ color: 0x4a4636, roughness: .9, flatShading: true, emissive: C, emissiveIntensity: .06, transparent: true, opacity: 1 }); mats.push(rm);
    for (let i = 0; i < 9; i++) { const r = new THREE.Mesh(new THREE.DodecahedronGeometry(R(.18, .38), 0), rm); r.userData = { a: i / 9 * Math.PI * 2, y: R(.8, 3.6), r: R(2.6, 3.4), sp: R(.15, .3) }; g.add(r); rocks.push(r); }
    anim.push((t, dt) => { for (const r of rocks) { const u = r.userData; u.a += dt * u.sp; r.position.set(Math.cos(u.a) * u.r, u.y + Math.sin(t + u.a) * .15, Math.sin(u.a) * u.r * .6 - 2.4); r.rotation.x += dt * .4; r.rotation.y += dt * .3; } });
    const cm = new THREE.MeshStandardMaterial({ color: C.clone().multiplyScalar(.35), emissive: C.clone().multiplyScalar(.6), emissiveIntensity: .7, roughness: .25, metalness: .2, flatShading: true, transparent: true, opacity: .9 }); mats.push(cm);
    const crystals = []; for (let i = 0; i < 7; i++) { const h = R(.8, 2.2), c = new THREE.Mesh(new THREE.ConeGeometry(R(.18, .32), h, 5), cm); const a = (i / 6 - .5) * 2.2;
      c.position.set(Math.sin(a) * 3.6, h / 2 - .1, -Math.cos(a) * 2.6 - 1); c.rotation.z = R(-.25, .25); c.userData.ph = R(0, 6); g.add(c); crystals.push(c); }
    anim.push(t => { cm.emissiveIntensity = .45 + .25 * Math.sin(t * 1.6); });
  } else {
    const rib = []; for (let k = 0; k < 3; k++) { const pts = []; for (let i = 0; i <= 80; i++) { const u = i / 80, a = u * Math.PI * 5 + k * 2.1; pts.push(new THREE.Vector3(Math.cos(a) * (2.4 + u * .8), u * 5.2, Math.sin(a) * (1.6 + u * .5) - 2.2)); }
      const tex = bandTex.clone(); tex.wrapS = THREE.RepeatWrapping; tex.needsUpdate = true; tex.repeat.set(3, 1);
      const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 160, .025, 4), M({ map: tex, color: k ? L : C, opacity: .32 })); g.add(m); rib.push(m); }
    anim.push((t, dt) => { rib.forEach((m, i) => { m.rotation.y += dt * (.35 + i * .1); m.material.map.offset.x = (t * (.4 + i * .1)) % 1; }); });
    const leaves = []; for (let i = 0; i < 14; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(.22, .22), M({ map: leafTex, color: i % 2 ? L : C, opacity: .8 })); m.userData = { x: R(-6, 6), y: R(.5, 5), z: R(-4, -1.5), sp: R(.8, 1.6), ph: R(0, 6) }; g.add(m); leaves.push(m); }
    anim.push((t, dt) => { for (const m of leaves) { const u = m.userData; u.x += dt * u.sp; if (u.x > 6.5) u.x = -6.5; m.position.set(u.x, u.y + Math.sin(t * 1.5 + u.ph) * .3, u.z); m.rotation.z += dt * 2; } });
  }
  // motas propias que suben (brasas, burbujas, polvo, aire)
  const n = 40, pos = new Float32Array(n * 3), sd = []; for (let i = 0; i < n; i++) { pos.set([R(-4, 4), R(0, 5), R(-4, -1)], i * 3); sd.push(R(.3, 1)); }
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pm = new THREE.PointsMaterial({ map: dotTex, color: L, size: el === 'water' ? .16 : .11, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: .9, fog: false }); mats.push(pm); pm.userData.base = .9;
  const pts = new THREE.Points(pg, pm); pts.frustumCulled = false; g.add(pts);
  const rise = { fire: 1.1, water: .5, earth: .25, air: .4 }[el];
  anim.push((t, dt) => { const a = pg.attributes.position.array; for (let i = 0; i < n; i++) { a[i * 3 + 1] += dt * rise * sd[i]; a[i * 3] += Math.sin(t + i) * dt * (el === 'air' ? .8 : .15); if (a[i * 3 + 1] > 5.5) { a[i * 3 + 1] = 0; a[i * 3] = R(-4, 4); } } pg.attributes.position.needsUpdate = true; });
  for (const m of mats) if (m.userData.base == null) m.userData.base = m.opacity;
  g.traverse(o => { o.renderOrder = -1; if (o.isMesh || o.isPoints) o.frustumCulled = false; });
  return { g, anim, mats, w: 0 };
}

export class MenuBackdrop {
  constructor(parent) { this.parent = parent; this.themes = new Map(); this.cur = null; }
  set(def) {
    if (!def) return; const id = def.id;
    if (!this.themes.has(id)) { try { const th = theme(ELEM_OF[id] || def.element || 'air', def.fx?.color || '#47b3ff', def.fx?.light || def.fx?.color || '#ffffff'); this.parent.add(th.g); this.themes.set(id, th); } catch (e) { console.warn('[menú] fondo temático', e); return; } }
    this.cur = id;
  }
  update(dt, t, reduce = false) {
    const m = reduce ? .25 : 1;
    for (const [id, th] of this.themes) {
      th.w += ((id === this.cur ? 1 : 0) - th.w) * (1 - Math.exp(-dt * 6)); th.g.visible = th.w > .01; if (!th.g.visible) continue;
      for (const mt of th.mats) mt.opacity = mt.userData.base * th.w * (mt.userData.k ?? 1);
      for (const f of th.anim) f(t * m, dt * m);
    }
  }
}
