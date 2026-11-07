import * as THREE from 'three';

// FONDO TEMÁTICO DEL MENÚ (v1.11: entradas y salidas por elemento, luna, fuego por shader y chroma en TODO): detrás del guerrero elegido aparece el santuario de su elemento.
// Todo se mueve despacio, con curvas suaves y apariciones/desapariciones graduales (nada salta ni gira de golpe):
//   común  · sello elemental tenue que gira muy lento y «respira», resplandor del elemento detrás
//   fuego  · lenguas de fuego suaves al fondo (parpadeo con varias ondas superpuestas), calor en la base, brasas que suben
//   agua   · luz de luna, rayos de luz que se mecen como bajo el agua, ondas lentas en el suelo, burbujas que suben
//   tierra · rocas que flotan quietas en su sitio (solo se mecen), cristales que laten cada uno a su ritmo, polvo dorado
//   viento · nubes que pasan, ráfagas finas que cruzan, hojas que planean dando vueltas, motas de aire
// Cada partícula nace y muere con un fundido (sin apariciones bruscas). Geometría y texturas procedurales, aditivas,
// detrás del guerrero (z < -1.2). «reduce» (reducir movimiento) ralentiza todo; cambiar de guerrero funde los santuarios.
const ELEM_OF = { ignis: 'fire', aqua: 'water', terra: 'earth', zephyr: 'air' };
const canvas = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); if (x) draw(x, w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
const add = (o) => new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, side: THREE.DoubleSide, ...o });
const TAU = Math.PI * 2;
// ruido suave (suma de senos sin múltiplos comunes): parpadeos y vaivenes orgánicos, siempre continuos
const wob = (t, s = 0) => .5 * Math.sin(t * 1.13 + s) + .3 * Math.sin(t * 2.71 + s * 1.7) + .2 * Math.sin(t * 4.37 + s * 2.3);
const life = u => { const s = Math.sin(Math.PI * Math.min(Math.max(u, 0), 1)); return s * s; }; // 0 → 1 → 0 sin escalones

// sello: anillo de runas + símbolo del elemento en el centro (trazos finos; se ve como grabado de luz, no como cartel)
function sigilTex(el) {
  return canvas(512, 512, (x, S) => {
    const c = S / 2; x.translate(c, c); x.strokeStyle = '#fff'; x.fillStyle = '#fff'; x.lineCap = 'round'; x.lineJoin = 'round';
    x.shadowColor = '#fff'; x.shadowBlur = 6;
    x.globalAlpha = .85; x.lineWidth = 3; x.beginPath(); x.arc(0, 0, 244, 0, TAU); x.stroke();
    x.globalAlpha = .55; x.lineWidth = 1.4; x.beginPath(); x.arc(0, 0, 226, 0, TAU); x.stroke(); x.beginPath(); x.arc(0, 0, 150, 0, TAU); x.stroke();
    for (let i = 0; i < 24; i++) { x.save(); x.rotate(i / 24 * TAU); x.translate(0, -235); x.lineWidth = 1.8; x.globalAlpha = .75; x.beginPath();
      const k = i % 4; if (k === 0) { x.moveTo(-4, -5); x.lineTo(0, 5); x.lineTo(4, -5); } else if (k === 1) { x.moveTo(-5, 0); x.lineTo(5, 0); x.moveTo(0, -5); x.lineTo(0, 5); }
      else if (k === 2) { x.arc(0, 0, 4, 0, Math.PI); } else { x.moveTo(-4, 4); x.lineTo(0, -5); x.lineTo(4, 4); x.closePath(); } x.stroke(); x.restore(); }
    x.lineWidth = 1.1; x.globalAlpha = .35; x.beginPath(); for (let i = 0; i <= 16; i++) { const a = i / 16 * TAU - Math.PI / 2, r = i % 2 ? 100 : 218; i ? x.lineTo(Math.cos(a) * r, Math.sin(a) * r) : x.moveTo(Math.cos(a) * r, Math.sin(a) * r); } x.stroke();
    x.globalAlpha = .9; x.lineWidth = 4.5; x.shadowBlur = 10; x.beginPath();
    if (el === 'fire') { x.moveTo(0, -95); x.bezierCurveTo(60, -30, 70, 40, 0, 90); x.bezierCurveTo(-70, 40, -60, -30, 0, -95); x.moveTo(0, -10); x.bezierCurveTo(28, 20, 22, 60, 0, 70); x.bezierCurveTo(-22, 60, -28, 20, 0, -10); }
    else if (el === 'water') { for (const y of [-40, 0, 40]) { x.moveTo(-90, y); x.bezierCurveTo(-45, y - 32, -15, y + 32, 0, y); x.bezierCurveTo(15, y - 32, 45, y + 32, 90, y); } }
    else if (el === 'earth') { x.moveTo(-95, 70); x.lineTo(-30, -60); x.lineTo(0, 0); x.lineTo(35, -85); x.lineTo(95, 70); x.closePath(); x.moveTo(-60, 70); x.lineTo(60, 70); }
    else { x.moveTo(-90, -30); x.bezierCurveTo(-20, -90, 70, -60, 40, -10); x.bezierCurveTo(20, 20, -20, 0, 0, -20); x.moveTo(-90, 30); x.bezierCurveTo(0, 30, 60, 50, 90, 20); x.moveTo(-70, 70); x.bezierCurveTo(-10, 70, 30, 85, 70, 65); }
    x.stroke();
  });
}
// lengua de fuego difuminada (capas con desenfoque): sin bordes duros de «gota»
const flameTex = canvas(96, 192, (x) => {
  const shape = (s, a) => { x.save(); x.translate(48, 186); x.scale(s, s); x.globalAlpha = a; x.beginPath(); x.moveTo(0, -176); x.bezierCurveTo(16, -120, 40, -86, 34, -44); x.bezierCurveTo(30, -6, -30, -6, -34, -44); x.bezierCurveTo(-40, -86, -12, -120, 0, -176); x.fill(); x.restore(); };
  x.fillStyle = '#fff'; x.filter = 'blur(7px)'; shape(1, .45); x.filter = 'blur(4px)'; shape(.72, .6); x.filter = 'blur(2px)'; shape(.42, .9); x.filter = 'none';
});
const dotTex = canvas(64, 64, (x) => { const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.35, 'rgba(255,255,255,.45)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); });
const glowTex = canvas(128, 128, (x) => { const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(.25, 'rgba(255,255,255,.35)'); g.addColorStop(.6, 'rgba(255,255,255,.08)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); });
const ringTex = canvas(256, 256, (x) => { x.strokeStyle = '#fff'; x.lineWidth = 2.5; x.shadowColor = '#fff'; x.shadowBlur = 10; x.beginPath(); x.arc(128, 128, 112, 0, TAU); x.stroke(); });
const leafTex = canvas(64, 64, (x) => { x.fillStyle = '#fff'; x.beginPath(); x.moveTo(6, 32); x.quadraticCurveTo(32, 6, 58, 32); x.quadraticCurveTo(32, 58, 6, 32); x.fill(); x.globalCompositeOperation = 'destination-out'; x.lineWidth = 1.5; x.beginPath(); x.moveTo(10, 32); x.lineTo(54, 32); x.stroke(); });
const streakTex = canvas(256, 16, (x, W, H) => { const g = x.createLinearGradient(0, 0, W, 0); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(.7, 'rgba(255,255,255,.9)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; const v = x.createLinearGradient(0, 0, 0, H); x.fillRect(0, 0, W, H); x.globalCompositeOperation = 'destination-in'; v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(.5, 'rgba(0,0,0,1)'); v.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = v; x.fillRect(0, 0, W, H); });
const rayTex = canvas(64, 256, (x, W, H) => { const g = x.createLinearGradient(0, 0, W, 0); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(.5, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, W, H);
  x.globalCompositeOperation = 'destination-in'; const v = x.createLinearGradient(0, 0, 0, H); v.addColorStop(0, 'rgba(0,0,0,.9)'); v.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = v; x.fillRect(0, 0, W, H); });
const hazeTex = canvas(16, 128, (x, W, H) => { const g = x.createLinearGradient(0, H, 0, 0); g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(.35, 'rgba(255,255,255,.3)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, W, H); });
const cloudTex = canvas(256, 128, (x) => { x.fillStyle = '#fff'; x.filter = 'blur(10px)'; for (const [cx, cy, r] of [[70, 80, 34], [118, 64, 44], [170, 78, 36], [205, 88, 24], [42, 92, 22]]) { x.globalAlpha = .55; x.beginPath(); x.arc(cx, cy, r, 0, TAU); x.fill(); } x.filter = 'none'; });

const spiralTex = canvas(512, 512, (x, S) => { const c = S / 2; x.translate(c, c); x.strokeStyle = '#fff'; x.lineCap = 'round';
  for (let k = 0; k < 3; k++) for (let w = 0; w < 3; w++) { x.save(); x.filter = `blur(${2 + w * 3}px)`; x.globalAlpha = [.8, .35, .18][w]; x.lineWidth = [3, 7, 14][w]; x.beginPath();
    for (let i = 0; i <= 120; i++) { const u = i / 120, a = k * TAU / 3 + u * 4.2, r = 30 + u * 205; x.lineTo(Math.cos(a) * r, Math.sin(a) * r); } x.stroke(); x.restore(); } });

// semilla fija por tema: el santuario es siempre el mismo (no cambia de forma cada vez que se abre el menú)
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

// Luna pintada a mano en un lienzo: degradado de limbo (más oscura en el borde), mares, cráteres con luz y sombra y grano fino.
const moonTex = canvas(512, 512, (x, S) => {
  const c = S / 2, r = S * .46, R0 = rng(77), Rr = (a, b) => a + R0() * (b - a);
  x.save(); x.beginPath(); x.arc(c, c, r, 0, TAU); x.clip();
  const g = x.createRadialGradient(c - r * .25, c - r * .3, r * .1, c, c, r); g.addColorStop(0, '#f6f2e6'); g.addColorStop(.55, '#d9d3c6'); g.addColorStop(1, '#9d978d'); x.fillStyle = g; x.fillRect(0, 0, S, S);
  x.filter = 'blur(12px)'; x.fillStyle = 'rgba(96,94,108,.55)';
  for (const [mx, my, mr] of [[-.28, -.18, .3], [.12, -.3, .2], [.25, .05, .24], [-.05, .22, .18], [-.38, .2, .14]]) { x.beginPath(); x.ellipse(c + mx * r, c + my * r, mr * r, mr * r * .8, mx * 2, 0, TAU); x.fill(); }
  x.filter = 'none';
  for (let i = 0; i < 70; i++) { const a = Rr(0, TAU), d = Math.sqrt(R0()) * r * .95, cx = c + Math.cos(a) * d, cy = c + Math.sin(a) * d, cr = Rr(2, i < 6 ? 22 : 9);
    x.fillStyle = 'rgba(70,68,80,.34)'; x.beginPath(); x.arc(cx, cy, cr, 0, TAU); x.fill();
    x.strokeStyle = 'rgba(255,255,255,.35)'; x.lineWidth = Math.max(1, cr * .18); x.beginPath(); x.arc(cx + cr * .12, cy + cr * .12, cr, Math.PI * .9, Math.PI * 1.9); x.stroke(); }
  for (let i = 0; i < 2600; i++) { x.fillStyle = `rgba(${R0() < .5 ? '255,255,255' : '60,60,70'},${Rr(.02, .07)})`; x.fillRect(Rr(0, S), Rr(0, S), 2, 2); }
  const sh = x.createRadialGradient(c + r * .35, c + r * .4, r * .2, c, c, r * 1.05); sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(.75, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(10,12,30,.6)'); x.fillStyle = sh; x.fillRect(0, 0, S, S);
  x.restore();
});

// Fuego de verdad (shader): ruido fractal que sube, lenguas que se separan y se apagan arriba, rampa de color del elemento
// (oscuro → color → luz → blanco en el corazón). uGrow = cuánto ha prendido (0 = apagado a ras de suelo).
const FIRE_VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
const FIRE_FS = `varying vec2 vUv; uniform float uT, uOp, uGrow, uSeed, uSc; uniform vec3 uC, uL;
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h(i), h(i + vec2(1.0, 0.0)), f.x), mix(h(i + vec2(0.0, 1.0)), h(i + vec2(1.0, 1.0)), f.x), f.y); }
float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ v += a * n(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; } return v; }
void main(){
  float g = max(uGrow, 0.001), y = vUv.y / g; if (y > 1.0) discard;
  float x = vUv.x * uSc + uSeed;
  // dos capas de ruido que suben a distinta velocidad + desplazamiento lateral: lenguas que se estiran, se separan y se apagan
  float sway = (n(vec2(y * 2.0 - uT * 0.7, x * 0.35)) - 0.5) * 0.6 * y;
  float n1 = fbm(vec2(x * 1.1 + sway, y * 1.6 - uT * 1.5));
  float n2 = fbm(vec2(x * 2.3 + 5.0 + sway, y * 3.0 - uT * 2.6));
  float nz = n1 * 0.62 + n2 * 0.38;
  float f = clamp(nz * 1.75 - y * 1.35 - 0.12, 0.0, 1.0);
  f = pow(f, 0.85);
  float edge = smoothstep(0.0, 0.14, vUv.x) * smoothstep(1.0, 0.86, vUv.x) * smoothstep(0.0, 0.04, y);
  vec3 col = mix(uC * 0.55, uC, smoothstep(0.05, 0.3, f)); col = mix(col, uL, smoothstep(0.3, 0.62, f)); col = mix(col, vec3(1.0, 0.96, 0.86), smoothstep(0.7, 1.0, f) * 0.7);
  float a = smoothstep(0.04, 0.42, f) * edge * uOp * min(1.0, uGrow * 1.5);
  gl_FragColor = vec4(col, a);
}`;
function fireMat(C, L, seed, sc) {
  const m = new THREE.ShaderMaterial({ uniforms: { uT: { value: 0 }, uOp: { value: 1 }, uGrow: { value: 0 }, uSeed: { value: seed }, uSc: { value: sc }, uC: { value: C }, uL: { value: L } },
    vertexShader: FIRE_VS, fragmentShader: FIRE_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  m.userData.shader = true; return m;
}

// Partículas con ciclo de vida: cada una nace transparente, se ilumina y se apaga antes de reaparecer en otro sitio.
// (color por vértice con mezcla aditiva = brillo por partícula). `C` es el color VIVO del tema (sigue al chroma).
function motes(n, C, size, spawn, move, R) {
  const pos = new Float32Array(n * 3), colA = new Float32Array(n * 3), P = [];
  for (let i = 0; i < n; i++) { const p = { i, life: 0, dur: 1, age: 0 }; spawn(p, R); p.age = R() * p.dur; P.push(p); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(colA, 3));
  const mat = new THREE.PointsMaterial({ map: dotTex, size, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 1, fog: false });
  const pts = new THREE.Points(geo, mat); pts.frustumCulled = false;
  const tick = (t, dt, e = 1) => {
    for (const p of P) {
      p.age += dt; if (p.age > p.dur) { spawn(p, R); p.age = 0; }
      const [x, y, z] = move(p, p.age, t), a = life(p.age / p.dur) * (p.bright ?? 1) * e;
      pos[p.i * 3] = x; pos[p.i * 3 + 1] = y; pos[p.i * 3 + 2] = z; colA[p.i * 3] = C.r * a; colA[p.i * 3 + 1] = C.g * a; colA[p.i * 3 + 2] = C.b * a;
    }
    geo.attributes.position.needsUpdate = true; geo.attributes.color.needsUpdate = true;
  };
  return { pts, mat, tick };
}
// avance de la entrada de cada pieza con retraso: 0 → 1 suave (la coreografía de entrar/salir)
const stag = (e, d) => { const u = Math.max(0, Math.min(1, (e - d) / (1 - d))); return u * u * (3 - 2 * u); };

function theme(el, col, light, seed) {
  const g = new THREE.Group(), C = new THREE.Color(col), L = new THREE.Color(light), W = new THREE.Color(0xffffff), anim = [], mats = [], R = rng(seed), RR = (a, b) => a + R() * (b - a);
  // cada material recuerda su «papel» de color (C, L, blanco o luna) para teñirse entero con el chroma: todo o nada
  const M = o => { const role = o.color === C ? 'C' : o.color === L ? 'L' : o.role || null; delete o.role; const m = add(o); m.userData.role = role; mats.push(m); m.userData.base = m.opacity; return m; };
  const plane = (w, h, o, x, y, z) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), M(o)); m.position.set(x, y, z); g.add(m); return m; };
  // común: resplandor y sello tenue que gira muy despacio y respira; al entrar se abre girando
  const glow = plane(9, 9, { map: glowTex, color: C, opacity: .3 }, 0, 2.5, -4.4);
  const sig = sigilTex(el), s1 = plane(6.6, 6.6, { map: sig, color: C, opacity: .2 }, 0, 2.55, -3.9), s2 = plane(4.1, 4.1, { map: sig, color: L, opacity: .1 }, 0, 2.55, -3.85);
  let r1 = 0, r2 = 0;
  anim.push((t, dt, e) => { r1 += dt * .022; r2 -= dt * .035; const k = stag(e, 0); s1.rotation.z = r1 - (1 - k) * .9; s2.rotation.z = r2 + (1 - k) * 1.2; s1.scale.setScalar(.82 + .18 * k); s2.scale.setScalar(.7 + .3 * stag(e, .15));
    const b = .5 + .5 * Math.sin(t * .55); s1.material.userData.k = (.8 + .2 * b) * k; s2.material.userData.k = (.75 + .25 * (1 - b)) * stag(e, .15); glow.material.userData.k = (.9 + .1 * Math.sin(t * .4)) * k; });
  // LUNA (todos): disco pintado con mares y cráteres, halo y anillo de bruma; toma un toque del color del elemento y sube al entrar
  { const mg = new THREE.Group(); mg.position.set(2.9, 5.0, -4.8); g.add(mg);
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 4.2), M({ map: glowTex, color: L, opacity: .3 })); mg.add(halo);
    const ring = new THREE.Mesh(new THREE.RingGeometry(.86, .9, 96), M({ color: L, opacity: .14 })); mg.add(ring);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(.78, 64), new THREE.MeshBasicMaterial({ map: moonTex, transparent: true, depthWrite: false, fog: false, opacity: .92 })); disc.material.userData = { role: 'moon', base: .86 }; mats.push(disc.material); disc.position.z = .02; mg.add(disc);
    anim.push((t, dt, e) => { const k = stag(e, .2); mg.position.y = 5.0 - (1 - k) * .9; mg.rotation.z = Math.sin(t * .05) * .05; halo.material.userData.k = (.85 + .15 * Math.sin(t * .3)) * k; ring.material.userData.k = k; disc.material.userData.k = k; }); }

  if (el === 'fire') {
    // fuego de verdad que prende desde el suelo: cortina trasera ancha y una delantera más baja, cada una con su ritmo
    const back = new THREE.Mesh(new THREE.PlaneGeometry(12, 3.6), fireMat(C, L, RR(0, 50), 8)); back.position.set(0, 1.55, -3.5); g.add(back);
    const front = new THREE.Mesh(new THREE.PlaneGeometry(9.5, 2.1), fireMat(C, L, RR(0, 50), 10)); front.position.set(0, .8, -2.5); g.add(front);
    for (const m of [back.material, front.material]) { m.userData.base = 1; mats.push(m); }
    back.material.userData.base = .85; front.material.userData.base = .6;
    const haze = plane(12, 2.4, { map: hazeTex, color: C, opacity: .26 }, 0, .9, -3.2);
    anim.push((t, dt, e) => { back.material.uniforms.uT.value = t; front.material.uniforms.uT.value = t * 1.15 + 7; back.material.uniforms.uGrow.value = stag(e, .1); front.material.uniforms.uGrow.value = stag(e, .3);
      back.position.y = .02 + 1.8 * stag(e, .1); front.position.y = .02 + 1.05 * stag(e, .3); back.scale.y = Math.max(.001, stag(e, .1)); front.scale.y = Math.max(.001, stag(e, .3)); // crece desde el suelo
      haze.material.userData.k = (.85 + .15 * wob(t * .8)) * stag(e, 0); });
    const emb = motes(46, L, .085, (p, r) => { p.x0 = (r() - .5) * 8; p.z = -1.4 - r() * 3; p.vy = .32 + r() * .4; p.dur = 4 + r() * 4; p.sw = r() * 6; p.bright = .5 + r() * .7; },
      (p, a, t) => [p.x0 + .25 * Math.sin(a * .9 + p.sw), .1 + a * p.vy, p.z], R);
    g.add(emb.pts); mats.push(emb.mat); anim.push((t, dt, e) => emb.tick(t, dt, stag(e, .4)));
  } else if (el === 'water') {
    // rayos de luz que se mecen como bajo el agua (bajan desde arriba al entrar)
    const rays = []; for (let i = 0; i < 6; i++) { const m = plane(RR(.5, 1), 7, { map: rayTex, color: i % 2 ? L : C, opacity: RR(.08, .14) }, RR(-4, 4), 3.2, RR(-3.6, -2.4)); m.userData = { x: m.position.x, ph: RR(0, 40), r: RR(-.18, .18), d: i * .07 }; m.rotation.z = m.userData.r; rays.push(m); }
    anim.push((t, dt, e) => { for (const m of rays) { const u = m.userData, k = stag(e, u.d); m.position.x = u.x + .35 * wob(t * .25, u.ph); m.position.y = 3.2 + (1 - k) * 1.2; m.rotation.z = u.r + .05 * wob(t * .2, u.ph + 2); m.material.userData.k = (.55 + .45 * (.5 + .5 * wob(t * .3, u.ph + 5))) * k; } });
    // ondas lentas en el suelo (la primera nace al entrar, desde los pies del guerrero)
    const rings = []; for (let i = 0; i < 3; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), M({ map: ringTex, color: i % 2 ? L : C, opacity: .4 })); m.rotation.x = -Math.PI / 2; m.position.set(0, .03, -.4); m.userData.ph = i / 3; g.add(m); rings.push(m); }
    anim.push((t, dt, e) => { for (const m of rings) { const u = (t * .085 + m.userData.ph) % 1, ee = 1 - (1 - u) * (1 - u); m.scale.set(3 + ee * 8, 3 + ee * 8 * .9, 1); m.material.userData.k = life(u) * .9 * stag(e, .1); } });
    // arco de agua que se levanta del suelo detrás del sello (corre despacio)
    const wt = streakTex.clone(); wt.wrapS = THREE.RepeatWrapping; wt.repeat.set(2.5, 1); wt.needsUpdate = true;
    const arc = new THREE.Mesh(new THREE.TorusGeometry(3.9, .05, 8, 96, Math.PI), M({ map: wt, color: L, opacity: .35 })); arc.position.set(0, 0, -3.3); g.add(arc);
    anim.push((t, dt, e) => { wt.offset.x = -(t * .12) % 1; const k = stag(e, .25); arc.scale.set(1, Math.max(.001, k), 1); arc.material.userData.k = k; });
    const bub = motes(30, L, .12, (p, r) => { p.x0 = (r() - .5) * 8; p.z = -1.3 - r() * 3; p.vy = .22 + r() * .25; p.dur = 6 + r() * 5; p.sw = r() * 6; p.bright = .45 + r() * .5; },
      (p, a, t) => [p.x0 + .18 * Math.sin(a * 1.7 + p.sw), .2 + a * p.vy, p.z], R);
    g.add(bub.pts); mats.push(bub.mat); anim.push((t, dt, e) => bub.tick(t, dt, stag(e, .3)));
  } else if (el === 'earth') {
    // rocas que BROTAN del suelo al entrar (cada una a su tiempo) y SE RETRAEN al cambiar de guerrero; luego flotan en su sitio
    const rm = new THREE.MeshStandardMaterial({ color: 0x4d4838, roughness: .95, flatShading: true, emissive: C.clone(), emissiveIntensity: .05, transparent: true, opacity: 1 }); rm.userData = { base: 1, role: 'rock' }; mats.push(rm);
    const rocks = []; const spots = [[-4.1, 3.4, -3.2, .42], [-2.9, 1.7, -2.6, .26], [-3.5, 5.1, -3.8, .3], [3.8, 3.9, -3.4, .46], [2.7, 2.1, -2.4, .24], [4.4, 1.3, -2.9, .3], [1.6, 5.4, -3.9, .22], [-1.4, 5.8, -4, .2]];
    spots.forEach(([x, y, z, s], i) => { const r = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), rm); r.position.set(x, y, z); r.rotation.set(RR(0, 3), RR(0, 3), 0);
      r.userData = { y, ph: RR(0, TAU), sp: RR(.35, .55), ry: RR(.04, .09) * (R() < .5 ? -1 : 1), d: (i % 4) * .1 + (y > 4 ? .1 : 0), ry0: 0 }; g.add(r); rocks.push(r); });
    anim.push((t, dt, e) => { for (const r of rocks) { const u = r.userData, k = stag(e, u.d); u.ry0 += dt * u.ry; r.position.y = u.y + .09 * Math.sin(t * u.sp + u.ph) - (1 - k) * 1.2; r.rotation.y = u.ry0 + (1 - k) * 2; r.rotation.x = .15 * Math.sin(t * u.sp * .7 + u.ph); r.scale.setScalar(.35 + .65 * k); r.visible = k > .01; } });
    // grupos de cristales (prismas hexagonales con punta) que crecen desde el suelo; cada grupo late a su ritmo
    const crystals = [], prism = (r, h) => { const body = new THREE.CylinderGeometry(r * .82, r, h, 6), tip = new THREE.ConeGeometry(r * .82, r * 2.2, 6); tip.translate(0, h / 2 + r * 1.1, 0); return [body, tip]; };
    for (let i = 0; i < 5; i++) { const cm = new THREE.MeshStandardMaterial({ color: C.clone(), emissive: C.clone(), emissiveIntensity: .35, roughness: .2, metalness: .3, flatShading: true, transparent: true, opacity: .82 }); cm.userData = { base: .82, role: 'crystal' }; mats.push(cm);
      const grp = new THREE.Group(), a = (i / 4 - .5) * 2.4; grp.position.set(Math.sin(a) * 3.9, -.1, -Math.cos(a) * 2.2 - 1.3); grp.rotation.y = RR(0, TAU);
      for (let j = 0; j < 3; j++) { const r = RR(.07, .13) * (j ? .8 : 1.2), h = RR(.45, 1.1) * (j ? .7 : 1.25); for (const geo of prism(r, h)) { const c = new THREE.Mesh(geo, cm); c.position.set(j ? (j === 1 ? .16 : -.14) : 0, h / 2, j ? RR(-.08, .08) : 0); c.rotation.z = j ? (j === 1 ? -.38 : .42) : RR(-.1, .1); grp.add(c); } }
      grp.userData = { ph: RR(0, TAU), m: cm, d: .05 + Math.abs(i - 2) * .08 }; g.add(grp); crystals.push(grp); }
    anim.push((t, dt, e) => { for (const c of crystals) { const k = stag(e, c.userData.d); c.scale.set(.6 + .4 * k, Math.max(.001, k), .6 + .4 * k); c.visible = k > .01; c.userData.m.emissiveIntensity = .28 + .18 * (.5 + .5 * Math.sin(t * .6 + c.userData.ph)); } });
    const glowB = plane(10, 1.6, { map: hazeTex, color: C, opacity: .22 }, 0, .55, -3);
    anim.push((t, dt, e) => { glowB.material.userData.k = (.85 + .15 * Math.sin(t * .45)) * stag(e, 0); });
    const dust = motes(38, L, .075, (p, r) => { p.x0 = (r() - .5) * 9; p.y0 = r() * 4.5; p.z = -1.3 - r() * 3; p.vx = .05 + r() * .08; p.vy = .03 + r() * .06; p.dur = 7 + r() * 6; p.sw = r() * 6; p.bright = .35 + r() * .5; },
      (p, a, t) => [p.x0 + a * p.vx, p.y0 + a * p.vy + .08 * Math.sin(a * .6 + p.sw), p.z], R);
    g.add(dust.pts); mats.push(dust.mat); anim.push((t, dt, e) => dust.tick(t, dt, stag(e, .3)));
  } else {
    // espiral de viento (el corazón del santuario): entra girando desde pequeña y luego gira muy despacio
    const spiral = plane(7.6, 7.6, { map: spiralTex, color: L, opacity: .3 }, 0, 2.55, -4.05); let rs = 0;
    anim.push((t, dt, e) => { rs -= dt * .06; const k = stag(e, .05); spiral.rotation.z = rs - (1 - k) * 2; spiral.scale.setScalar(.45 + .55 * k); spiral.material.userData.k = (.8 + .2 * Math.sin(t * .5)) * k; });
    // mar de nubes que llega desde los lados al entrar y se aparta al salir
    const sea = []; for (let i = 0; i < 9; i++) { const w = RR(4.5, 7), m = plane(w, w / 2.2, { map: cloudTex, color: i % 3 ? W : L, opacity: RR(.16, .26) }, -9 + i * 2.2 + RR(-.6, .6), RR(.45, 1.35), RR(-5, -3.4)); m.userData = { sp: RR(.05, .09), y: m.position.y, ph: RR(0, TAU), x: m.position.x }; sea.push(m); }
    anim.push((t, dt, e) => { for (const m of sea) { const u = m.userData; u.x += dt * u.sp; if (u.x > 10) u.x -= 20; const k = stag(e, .1), side = u.x < 0 ? -1 : 1;
      m.position.x = u.x + side * (1 - k) * 2; m.position.y = u.y + .06 * Math.sin(t * .3 + u.ph); m.material.userData.k = Math.min(1, (10 - Math.abs(u.x)) / 3) * k; } });
    // ráfagas finas que cruzan siguiendo una curva suave (nacen y se apagan)
    const gust = []; for (let i = 0; i < 9; i++) { const m = plane(RR(1.8, 3), RR(.05, .09), { map: streakTex, color: i % 3 ? L : C, opacity: RR(.3, .5) }, 0, 0, RR(-3.4, -1.6)); m.userData = { age: RR(0, 4), dur: RR(2.6, 4), y: RR(.6, 4.8), sp: RR(1.4, 2.2), amp: RR(.15, .35), ph: RR(0, TAU) }; gust.push(m); }
    anim.push((t, dt, e) => { for (const m of gust) { const u = m.userData; u.age += dt; if (u.age > u.dur) { u.age = 0; u.y = .6 + R() * 4.2; u.ph = R() * TAU; } const k = u.age / u.dur, x = -5.5 + k * u.dur * u.sp;
      const y = u.y + u.amp * Math.sin(k * Math.PI * 1.5 + u.ph); m.position.set(x, y, m.position.z); m.rotation.z = u.amp * 1.5 * Math.PI / (u.dur * u.sp) * Math.cos(k * Math.PI * 1.5 + u.ph) * .35; m.material.userData.k = life(k) * stag(e, .3); } });
    // hojas que planean y dan vueltas (giro en 3D, como de verdad) siguiendo el viento
    const leaves = []; for (let i = 0; i < 9; i++) { const m = plane(.2, .2, { map: leafTex, color: i % 2 ? L : W, opacity: .75 }, 0, 0, RR(-3.2, -1.4)); m.userData = { age: RR(0, 9), dur: RR(7, 10), y: RR(1, 4.6), ph: RR(0, TAU), spin: RR(1.2, 2.2) }; leaves.push(m); }
    anim.push((t, dt, e) => { for (const m of leaves) { const u = m.userData; u.age += dt; if (u.age > u.dur) { u.age = 0; u.y = 1 + R() * 3.6; } const k = u.age / u.dur;
      m.position.set(-5.2 + k * 10.4, u.y + .45 * Math.sin(k * TAU * 1.2 + u.ph) - k * .6, m.position.z); m.rotation.set(Math.sin(u.age * u.spin) * 1.1, u.age * .5, Math.sin(u.age * u.spin * .8 + 1) * .9); m.material.userData.k = life(k) * stag(e, .4); } });
    const air = motes(36, L, .07, (p, r) => { p.x0 = -5 - r() * 2; p.y0 = r() * 5; p.z = -1.3 - r() * 3; p.vx = .5 + r() * .5; p.dur = 9 + r() * 5; p.sw = r() * 6; p.bright = .4 + r() * .5; },
      (p, a, t) => [p.x0 + a * p.vx, p.y0 + .3 * Math.sin(a * .8 + p.sw), p.z], R);
    g.add(air.pts); mats.push(air.mat); anim.push((t, dt, e) => air.tick(t, dt, stag(e, .3)));
  }
  for (const m of mats) if (m.userData.base == null) m.userData.base = m.opacity;
  g.traverse(o => { o.renderOrder = -1; if (o.isMesh || o.isPoints) o.frustumCulled = false; });
  return { g, anim, mats, w: 0, C, L, C0: C.clone(), L0: L.clone() };
}

// pinta cada material según su papel con los colores vivos del tema (el chroma tiñe TODO el santuario, sin restos del color original)
const _w = new THREE.Color(0xffffff), _t = new THREE.Color();
function paint(th) {
  for (const m of th.mats) {
    const r = m.userData.role; if (!r) continue;
    if (r === 'C') m.color.copy(th.C); else if (r === 'L') m.color.copy(th.L);
    else if (r === 'moon') m.color.copy(_w).lerp(th.L, .22).multiplyScalar(.92);
    else if (r === 'rock') m.emissive.copy(th.C);
    else if (r === 'crystal') { _t.copy(th.C).lerp(_w, .15); m.color.copy(_t).multiplyScalar(.22); m.emissive.copy(_t).multiplyScalar(.5); }
  }
}

export class MenuBackdrop {
  constructor(parent) { this.parent = parent; this.themes = new Map(); this.cur = null; }
  set(def) {
    if (!def) return; const id = def.id;
    if (!this.themes.has(id)) { try { const el = ELEM_OF[id] || def.element || 'air', th = theme(el === 'wind' ? 'air' : el, def.fx?.color || '#47b3ff', def.fx?.light || def.fx?.color || '#ffffff', [...id].reduce((a, c) => a * 31 + c.charCodeAt(0), 7)); paint(th); this.parent.add(th.g); this.themes.set(id, th); } catch (e) { console.warn('[menú] fondo temático', e); return; } }
    this.cur = id;
  }
  // tint: { color, light } del menú (incluye el chroma equipado); solo tiñe el santuario visible
  update(dt, t, reduce = false, tint = null) {
    const m = reduce ? .25 : 1;
    for (const [id, th] of this.themes) {
      const target = id === this.cur ? 1 : 0;
      const snap = th.w === 0; // aparece desde cero: toma ya los colores del chroma (sin un instante con los originales)
      // entrada ~1,2 s y salida ~1 s, lineales en el tiempo (la curva la pone cada pieza): coreografía estable
      th.w = target ? Math.min(1, th.w + dt / 1.2) : Math.max(0, th.w - dt / 1.0);
      th.g.visible = th.w > .002; if (!th.g.visible) continue;
      if (target && tint) { const k = snap ? 1 : 1 - Math.exp(-dt * 4); th.C.lerp(tint.color, k); th.L.lerp(tint.light, k); paint(th); } // el chroma tiñe con un fundido suave
      const e = th.w, fade = Math.min(1, e * 2.5);
      for (const mt of th.mats) { if (mt.userData.shader) { mt.uniforms.uOp.value = mt.userData.base * fade; continue; } mt.opacity = mt.userData.base * fade * (mt.userData.k ?? 1); }
      th.t = (th.t ?? t) + dt * m; for (const f of th.anim) f(th.t, dt * m, e);
    }
  }
}
