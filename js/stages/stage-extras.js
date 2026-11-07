import * as THREE from 'three';

// FONDOS RICOS (v1.4): capas pintadas con perspectiva atmosférica (lo lejano se funde con el cielo), siluetas propias de
// cada escenario y vida ambiental (pájaros, humo, olas, faroles, auroras…). Todo detrás del plano de combate (z ≤ −3)
// y bajo, para no tapar nunca a los luchadores. Se activa con cfg.extras (data/stages.json).
const tex = (w, h, draw) => {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); if (x) draw(x, w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
};
const hex = c => '#' + c.getHexString();

// ── pintores de siluetas (canvas) ──
const paint = {
  pines(x, w, h, R, col, n = 70, base = .78, size = 1) {
    x.fillStyle = col;
    for (let i = 0; i < n; i++) { const px = R() * w, ph = (40 + R() * 90) * size, py = h * base + R() * h * .1, pw = ph * .38;
      x.beginPath(); for (let k = 0; k < 4; k++) { const yy = py - ph * k / 4.2, ww = pw * (1 - k / 5); x.moveTo(px - ww, yy); x.lineTo(px, yy - ph / 2.6); x.lineTo(px + ww, yy); } x.fill(); x.fillRect(px - 3, py - 4, 6, h - py + 4); }
    x.fillRect(0, h * (base + .06), w, h);
  },
  hills(x, w, h, R, col, amp = .18, base = .6, seed = 1) {
    x.fillStyle = col; x.beginPath(); x.moveTo(0, h);
    for (let i = 0; i <= 64; i++) { const t = i / 64; x.lineTo(t * w, h * (base - amp * (.5 + .5 * Math.sin(t * 9 + seed) * Math.cos(t * 4.3 + seed * 2)))); }
    x.lineTo(w, h); x.fill();
  },
  pagoda(x, cx, by, s, col, glow) {
    x.fillStyle = col;
    for (let k = 0; k < 4; k++) { const y = by - k * 34 * s, rw = (70 - k * 12) * s;
      x.fillRect(cx - rw * .45, y - 22 * s, rw * .9, 22 * s);
      x.beginPath(); x.moveTo(cx - rw * .78, y - 20 * s); x.quadraticCurveTo(cx - rw * .55, y - 30 * s, cx - rw * .3, y - 36 * s); x.lineTo(cx + rw * .3, y - 36 * s); x.quadraticCurveTo(cx + rw * .55, y - 30 * s, cx + rw * .78, y - 20 * s); x.fill();
      if (glow) { x.fillStyle = glow; for (let j = -1; j <= 1; j++) x.fillRect(cx + j * rw * .25 - 3 * s, y - 16 * s, 6 * s, 8 * s); x.fillStyle = col; } }
    x.fillRect(cx - 2 * s, by - 160 * s, 4 * s, 30 * s);
  },
  volcano(x, w, h, col, glow) {
    const cx = w * .62; x.fillStyle = col; x.beginPath(); x.moveTo(cx - w * .32, h); x.lineTo(cx - w * .05, h * .22); x.lineTo(cx + w * .05, h * .22); x.lineTo(cx + w * .34, h); x.fill();
    const g = x.createLinearGradient(0, h * .22, 0, h * .7); g.addColorStop(0, glow); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; for (let i = 0; i < 5; i++) { x.beginPath(); const sx = cx + (i - 2) * w * .012; x.moveTo(sx - 6, h * .22); x.quadraticCurveTo(sx + (i - 2) * 30, h * .45, sx + (i - 2) * 60, h * .75); x.lineTo(sx + (i - 2) * 60 + 8, h * .75); x.quadraticCurveTo(sx + (i - 2) * 30 + 8, h * .45, sx + 6, h * .22); x.fill(); }
    const r = x.createRadialGradient(cx, h * .22, 4, cx, h * .22, w * .08); r.addColorStop(0, glow); r.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = r; x.fillRect(cx - w * .1, 0, w * .2, h * .4);
  },
  castle(x, w, h, R, col, glow) {
    x.fillStyle = col; const by = h * .82;
    for (let i = 0; i < 9; i++) { const cx = w * (.06 + i * .11) + R() * 20, tw = 40 + R() * 50, th = 90 + R() * 160;
      x.fillRect(cx - tw / 2, by - th, tw, th + h); for (let k = -2; k <= 2; k++) x.fillRect(cx + k * tw / 5 - 5, by - th - 14, 10, 14);
      if (R() < .6) { x.beginPath(); x.moveTo(cx - tw * .6, by - th); x.lineTo(cx, by - th - 60); x.lineTo(cx + tw * .6, by - th); x.fill(); }
      x.fillStyle = glow; for (let k = 0; k < 4; k++) if (R() < .6) x.fillRect(cx - 4 + (R() - .5) * tw * .5, by - th * (.2 + R() * .6), 8, 12); x.fillStyle = col; }
    x.fillRect(0, by - 50, w, h);
  },
  spires(x, w, h, R, col, n = 14) {
    x.fillStyle = col;
    for (let i = 0; i < n; i++) { const cx = R() * w, bw = 20 + R() * 40, th = h * (.35 + R() * .5);
      x.beginPath(); x.moveTo(cx - bw, h); x.lineTo(cx - bw * .3, h - th); x.lineTo(cx + bw * .2, h - th * 1.04); x.lineTo(cx + bw, h); x.fill(); }
  },
  arches(x, w, h, R, col) {
    x.fillStyle = col; this.hills(x, w, h, R, col, .1, .78, 3);
    for (let i = 0; i < 3; i++) { const cx = w * (.18 + i * .32), rw = 120 + R() * 80, rh = 150 + R() * 90, t = 34;
      x.beginPath(); x.moveTo(cx - rw, h * .8); x.lineTo(cx - rw, h * .8 - rh * .5); x.quadraticCurveTo(cx - rw, h * .8 - rh, cx, h * .8 - rh); x.quadraticCurveTo(cx + rw, h * .8 - rh, cx + rw, h * .8 - rh * .5); x.lineTo(cx + rw, h * .8);
      x.lineTo(cx + rw - t, h * .8); x.lineTo(cx + rw - t, h * .8 - rh * .5); x.quadraticCurveTo(cx + rw - t, h * .8 - rh + t, cx, h * .8 - rh + t); x.quadraticCurveTo(cx - rw + t, h * .8 - rh + t, cx - rw + t, h * .8 - rh * .5); x.lineTo(cx - rw + t, h * .8); x.fill(); }
  },
  islands(x, w, h, R, col, glow, n = 6) {
    for (let i = 0; i < n; i++) { const cx = w * (.08 + i / n) + R() * 40, cy = h * (.25 + R() * .4), rw = 50 + R() * 90;
      x.fillStyle = col; x.beginPath(); x.moveTo(cx - rw, cy); x.quadraticCurveTo(cx, cy - 18, cx + rw, cy); x.lineTo(cx + rw * .3, cy + rw * .9); x.lineTo(cx - rw * .2, cy + rw * .7); x.closePath(); x.fill();
      if (R() < .7) this.pagoda(x, cx, cy - 2, .35 + R() * .2, col, glow);
      x.strokeStyle = col; x.lineWidth = 2; for (let k = 0; k < 4; k++) { x.beginPath(); const sx = cx + (R() - .5) * rw; x.moveTo(sx, cy + 10); x.lineTo(sx + (R() - .5) * 10, cy + rw * (.5 + R() * .5)); x.stroke(); } }
  },
};

// cordillera con luz y sombra (cara iluminada / cara en sombra) y nieve opcional en las cumbres
paint.range = function (x, w, h, R, light, dark, snow, n = 9, base = .95, top = .12) {
  const peaks = []; for (let i = 0; i < n; i++) peaks.push({ cx: (i + .2 + R() * .6) / n * w, py: h * (top + R() * .38), bw: w / n * (.9 + R() * .7) });
  peaks.sort((a, b) => a.py - b.py).reverse(); // las más bajas delante
  for (const p of peaks) {
    const L = p.cx - p.bw, Rr = p.cx + p.bw, sh = (R() - .5) * p.bw * .3;
    x.fillStyle = dark; x.beginPath(); x.moveTo(L, h * base); x.lineTo(p.cx + sh, p.py); x.lineTo(Rr, h * base); x.fill();
    x.fillStyle = light; x.beginPath(); x.moveTo(L, h * base); x.lineTo(p.cx + sh, p.py); x.lineTo(p.cx + sh + p.bw * .18, h * base); x.fill();
    if (snow) { const sy = p.py + (h * base - p.py) * .22; x.fillStyle = snow; x.beginPath(); x.moveTo(p.cx + sh, p.py);
      for (let k = 0; k <= 6; k++) { const tx = L + (Rr - L) * (.5 + (k / 6 - .5) * .44 * ((sy - p.py) / (h * base - p.py) * 4.5)); x.lineTo(tx, sy + (k % 2 ? 10 : -4)); }
      x.closePath(); x.fill(); }
  }
  x.fillStyle = dark; x.fillRect(0, h * base - 2, w, h);
};

export function addExtras(cfg, K) {
  const { g, add, flame, anim, R, glow, accent } = K, ex = cfg.extras || [];
  if (!ex.length) return;
  const sky = cfg.sky.map(c => new THREE.Color(c)), gr = new THREE.Color(cfg.ground);
  // color de una capa según distancia: cerca = suelo oscuro, lejos = cielo (perspectiva atmosférica)
  const tone = (far, dark = 0) => hex(gr.clone().multiplyScalar(.55 - dark).lerp(sky[Math.min(2, sky.length - 1)].clone().lerp(sky[1], .5), far));
  const layer = (draw, { w = 150, h = 34, y = 10, z = -30, op = 1, add: additive = false } = {}) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex(2048, 512, (x, W, H) => draw(x, W, H)), transparent: true, opacity: op, depthWrite: false, fog: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending }));
    m.renderOrder = -5; return add(m, 0, y, z);
  };
  const sprite = (map, col, s, x, y, z, blend = THREE.NormalBlending, op = 1) => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map, color: col, transparent: true, opacity: op, depthWrite: false, blending: blend, fog: false })); sp.scale.setScalar(s); sp.position.set(x, y, z); g.add(sp); return sp; };
  const smokeMap = tex(64, 64, x => { const r = x.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, 'rgba(255,255,255,.7)'); r.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = r; x.fillRect(0, 0, 64, 64); });
  const birdMap = tex(64, 32, x => { x.strokeStyle = '#000'; x.lineWidth = 4; x.lineCap = 'round'; x.beginPath(); x.moveTo(4, 10); x.quadraticCurveTo(18, 4, 32, 18); x.quadraticCurveTo(46, 4, 60, 10); x.stroke(); });
  const lanternMat = new THREE.MeshBasicMaterial({ color: 0xffb35a }), poleMat = new THREE.MeshStandardMaterial({ color: gr.clone().multiplyScalar(.5), roughness: 1 });
  const rockMat = new THREE.MeshStandardMaterial({ color: gr.clone().lerp(new THREE.Color(cfg.slab), .5).multiplyScalar(.85), roughness: 1, flatShading: true });

  const pts = (n, spread, size, col, op, blend = THREE.NormalBlending) => { const pos = new Float32Array(n * 3); for (let i = 0; i < n; i++) pos.set([(R() * 2 - 1) * spread[0], R() * spread[1], spread[2][0] + R() * (spread[2][1] - spread[2][0])], i * 3);
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); const p = new THREE.Points(geo, new THREE.PointsMaterial({ map: glow, color: col, size, transparent: true, opacity: op, depthWrite: false, blending: blend, fog: false })); p.frustumCulled = false; g.add(p); return p; };
  const light = (k = 0) => hex(sky[Math.min(2, sky.length - 1)].clone().lerp(gr, .35 + k)), shade = (k = 0) => hex(gr.clone().multiplyScalar(.75 - k).lerp(sky[1], .25));
  const E = {
    // ── cordilleras grandes y visibles detrás del ring (dos filas, con nieve si el clima es frío) ──
    peaks() { // contraste garantizado: siluetas más oscuras que el cielo, cara iluminada con el color del escenario y nieve en los climas fríos
      const snow = ['snow', 'rain'].includes(cfg.weather) ? 'rgba(240,248,255,.95)' : null, acc = new THREE.Color(cfg.rim);
      const lum = sky[1].r * .3 + sky[1].g * .59 + sky[1].b * .11, base = sky[1].clone().lerp(new THREE.Color(0x1a2240), .35);
      const far = base.clone().multiplyScalar(lum > .45 ? .66 : .55), near = base.clone().lerp(gr, .4).multiplyScalar(lum > .45 ? .46 : .38);
      const lit = c => hex(c.clone().lerp(acc, .25).multiplyScalar(1.35));
      layer((x, W, H) => paint.range(x, W, H, R, lit(far), hex(far), snow, 9, .97, .22), { w: 150, h: 22, y: 3, z: -23 });
      layer((x, W, H) => paint.range(x, W, H, R, lit(near), hex(near), null, 12, .98, .28), { w: 120, h: 14, y: 2.5, z: -17 }); },
    // ── clima ──
    rain() { const n = 360, pos = new Float32Array(n * 6), sp = [];
      for (let i = 0; i < n; i++) { const x0 = (R() * 2 - 1) * 22, y0 = R() * 16, z0 = -10 + R() * 9; pos.set([x0, y0, z0, x0 - .08, y0 + .7, z0], i * 6); sp.push(14 + R() * 8); }
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const ln = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xcfe6ff, transparent: true, opacity: .35, depthWrite: false, fog: false })); ln.frustumCulled = false; g.add(ln);
      anim.push((t, dt) => { const a = geo.attributes.position.array; for (let i = 0; i < n; i++) { const j = i * 6, d = sp[i] * dt; a[j + 1] -= d; a[j + 4] -= d; a[j] -= d * .06; a[j + 3] -= d * .06; if (a[j + 1] < -.2) { const x0 = (R() * 2 - 1) * 22; a[j] = x0; a[j + 1] = 16; a[j + 3] = x0 - .08; a[j + 4] = 16.7; } } geo.attributes.position.needsUpdate = true; });
      const rings = []; for (let i = 0; i < 10; i++) { const r = sprite(smokeMap, 0xdfefff, .5, 0, .05, 0, THREE.AdditiveBlending, 0); rings.push({ r, t: R() }); }
      anim.push((t, dt) => { for (const o of rings) { o.t += dt * 2.2; if (o.t > 1) { o.t = 0; o.r.position.set((R() * 2 - 1) * 9, .05, -3 + R() * 5); } o.r.scale.set(.3 + o.t * 1.2, .08 + o.t * .2, 1); o.r.material.opacity = .5 * (1 - o.t); } }); },
    lightning() { const fl = new THREE.Mesh(new THREE.PlaneGeometry(220, 90), new THREE.MeshBasicMaterial({ color: 0xdfe8ff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); add(fl, 0, 15, -39);
      const bolt = new THREE.Mesh(new THREE.PlaneGeometry(3, 26), new THREE.MeshBasicMaterial({ map: tex(64, 512, (x, W, H) => { x.strokeStyle = '#fff'; x.lineWidth = 5; x.shadowColor = '#9fd0ff'; x.shadowBlur = 14; x.beginPath(); let px = W / 2; x.moveTo(px, 0); for (let y = 0; y < H; y += 32) { px = W / 2 + (R() - .5) * 40; x.lineTo(px, y); } x.stroke(); }), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); add(bolt, 8, 14, -38);
      let next = 3 + R() * 5, f = 0; anim.push((t, dt) => { next -= dt; if (next <= 0) { next = 4 + R() * 7; f = 1; bolt.position.x = (R() * 2 - 1) * 30; } f = Math.max(0, f - dt * 3.2); const flick = f > 0 ? f * (.6 + .4 * Math.sin(t * 90)) : 0; fl.material.opacity = flick * .5; bolt.material.opacity = flick; }); },
    snow() { const p = pts(500, [24, 16, [-12, 3]], .16, 0xffffff, .9); const a = p.geometry.attributes.position.array, ph = new Float32Array(500).map(() => R() * 6);
      anim.push((t, dt) => { for (let i = 0; i < 500; i++) { const j = i * 3; a[j + 1] -= dt * (.7 + ph[i] * .12); a[j] += Math.sin(t * .8 + ph[i]) * dt * .5 + dt * .6; if (a[j + 1] < 0) { a[j + 1] = 16; a[j] = (R() * 2 - 1) * 24; } if (a[j] > 24) a[j] = -24; } p.geometry.attributes.position.needsUpdate = true; }); },
    mist() { for (let i = 0; i < 7; i++) { const sp = sprite(smokeMap, cfg.fog.color, 14 + R() * 8, (R() * 2 - 1) * 20, .8 + R() * 1.5, -5 - R() * 9, THREE.NormalBlending, .35), x0 = sp.position.x, ph = R() * 6; sp.scale.y *= .3;
      anim.push(t => { sp.position.x = x0 + Math.sin(t * .07 + ph) * 4; sp.material.opacity = .25 + .12 * Math.sin(t * .3 + ph); }); } },
    sandstorm() { // (v1.10) arena que pasa calmada: menos granos, más lentos y con un vaivén suave
      const N = 240, p = pts(N, [26, 7, [-10, 3]], .2, 0xd8c08a, .38); const a = p.geometry.attributes.position.array, ph = new Float32Array(N).map(() => R() * 6);
      anim.push((t, dt) => { for (let i = 0; i < N; i++) { const j = i * 3; a[j] += dt * (1.1 + (i % 5) * .25); a[j + 1] += Math.sin(t * .9 + ph[i]) * dt * .18; if (a[j] > 26) { a[j] = -26; a[j + 1] = R() * 7; } } p.geometry.attributes.position.needsUpdate = true; }); this.mist(); },
    meteors() { const ms = []; for (let i = 0; i < 3; i++) { const s2 = sprite(smokeMap, 0xff8a3a, 1.6, 0, 30, -34, THREE.AdditiveBlending, 0); ms.push({ s: s2, t: 1 + i, x0: 0 }); }
      anim.push((t, dt) => { for (const m of ms) { m.t += dt * .5; if (m.t > 1.6) { m.t = 0; m.x0 = (R() * 2 - 1) * 40; } const k = Math.min(1, m.t); m.s.position.set(m.x0 + k * 14, 26 - k * 18, -34); m.s.material.opacity = m.t < 1 ? .9 : 0; m.s.scale.set(4, 1.2, 1); m.s.material.rotation = -.9; } }); },
    // ── cascada del bosque: acantilado, caída de agua animada, espuma y río ──
    cascade() {
      const rockC = gr.clone().multiplyScalar(.6).lerp(new THREE.Color(0x56606e), .45), cliff = new THREE.Mesh(new THREE.PlaneGeometry(22, 14), new THREE.MeshBasicMaterial({ map: tex(1024, 512, (x, W, H) => { const g3 = x.createLinearGradient(W, 0, 0, 0); g3.addColorStop(0, hex(rockC.clone().multiplyScalar(1.25))); g3.addColorStop(1, hex(rockC.clone().multiplyScalar(.7))); x.fillStyle = g3; x.beginPath(); x.moveTo(0, H); x.lineTo(0, H * .12); for (let i = 0; i <= 20; i++) x.lineTo(i * W / 20, H * (.08 + R() * .1)); x.lineTo(W, H); x.fill();
        x.fillStyle = 'rgba(0,0,0,.22)'; for (let i = 0; i < 60; i++) x.fillRect(R() * W, H * (.2 + R() * .75), 30 + R() * 90, 5 + R() * 12); x.fillStyle = 'rgba(255,255,255,.08)'; for (let i = 0; i < 30; i++) x.fillRect(R() * W, H * (.2 + R() * .7), 20 + R() * 60, 3); paint.pines(x, W, H, R, hex(gr.clone().multiplyScalar(.55)), 22, .16, .45); }), transparent: true, depthWrite: false, fog: false }));
      cliff.renderOrder = -4; add(cliff, -9.5, 5.2, -8.8);
      const wt = tex(128, 512, (x, W, H) => { const g2 = x.createLinearGradient(0, 0, W, 0); g2.addColorStop(0, 'rgba(160,215,255,.3)'); g2.addColorStop(.5, 'rgba(235,250,255,.95)'); g2.addColorStop(1, 'rgba(160,215,255,.3)'); x.fillStyle = g2; x.fillRect(0, 0, W, H); x.fillStyle = 'rgba(255,255,255,.7)'; for (let i = 0; i < 80; i++) x.fillRect(R() * W, R() * H, 2 + R() * 3, 24 + R() * 60); });
      wt.wrapT = THREE.RepeatWrapping; wt.repeat.set(1, 2.5);
      const fall = new THREE.Mesh(new THREE.PlaneGeometry(3, 12, 1, 8), new THREE.MeshBasicMaterial({ map: wt, transparent: true, opacity: .9, depthWrite: false, fog: false })); fall.renderOrder = -3; add(fall, -6.2, 5.6, -8.6);
      anim.push((t, dt) => { wt.offset.y += dt * 1.1; });
      for (let i = 0; i < 10; i++) { const sp = sprite(smokeMap, 0xffffff, 3, -6.2 + (R() - .5) * 3, -.2, -8.3, THREE.NormalBlending, .5), ph = R() * 6; anim.push(t => { const k = (t * .5 + ph) % 1; sp.position.y = -.2 + k * 2.5; sp.scale.setScalar(2 + k * 4); sp.material.opacity = .55 * (1 - k); }); }
      const rt = tex(256, 64, (x, W, H) => { x.fillStyle = '#6fbde8'; x.fillRect(0, 0, W, H); x.strokeStyle = 'rgba(255,255,255,.5)'; for (let i = 0; i < 30; i++) { x.beginPath(); const y = R() * H; x.moveTo(R() * W, y); x.lineTo(R() * W, y); x.stroke(); } }); rt.wrapS = THREE.RepeatWrapping; rt.repeat.set(6, 1);
      const river = new THREE.Mesh(new THREE.PlaneGeometry(60, 2.4), new THREE.MeshBasicMaterial({ map: rt, transparent: true, opacity: .85, fog: false })); river.rotation.x = -Math.PI / 2; add(river, 0, -.3, -6.4); anim.push((t, dt) => { rt.offset.x += dt * .25; }); },
    // ── símbolos de cada elemento ──
    brazier() { // pebetero de la llama eterna
      for (const sx of [-1, 1]) { const x0 = sx * 13; add(new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.5, 6, 8), K.stone), x0, 2.6, -11); add(new THREE.Mesh(new THREE.CylinderGeometry(2, 1, 1.2, 10), K.dark), x0, 6.2, -11);
        const fl = []; for (let i = 0; i < 5; i++) fl.push(flame(x0 + (R() - .5), 7.2 + i * .5, -10.8, 4 - i * .5, i % 2 ? '#ffb347' : '#ff5a1f'));
        anim.push(t => fl.forEach((f, i) => { f.scale.setScalar(f.userData.base * (1 + .2 * Math.sin(t * 9 + i * 2))); f.position.y = 7.2 + i * .5 + Math.sin(t * 6 + i) * .15; })); } },
    waterspout() { // tromba de agua que gira en el mar
      const wt = tex(256, 256, (x, W, H) => { x.fillStyle = 'rgba(120,200,255,.45)'; x.fillRect(0, 0, W, H); x.strokeStyle = 'rgba(235,250,255,.8)'; x.lineWidth = 3; for (let i = 0; i < 26; i++) { x.beginPath(); const y = R() * H; x.moveTo(0, y); x.bezierCurveTo(W * .3, y - 20, W * .6, y + 20, W, y - 10); x.stroke(); } });
      wt.wrapS = wt.wrapT = THREE.RepeatWrapping; wt.repeat.set(2, 2);
      const sp = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 3.2, 16, 24, 6, true), new THREE.MeshBasicMaterial({ map: wt, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false })); add(sp, 16, 7, -30);
      anim.push((t, dt) => { wt.offset.x += dt * .5; wt.offset.y -= dt * .3; sp.rotation.y += dt * .8; }); },
    monolith() { // monolito con runas y rocas que orbitan
      const m = add(new THREE.Mesh(new THREE.BoxGeometry(2.4, 9, 2), K.stone), 14, 4.1, -12); m.rotation.y = .3;
      add(new THREE.Mesh(new THREE.BoxGeometry(.25, 6, .1), K.emis), 14.2, 4.4, -10.95).rotation.y = .3;
      const rocks = []; for (let i = 0; i < 7; i++) { const r = new THREE.Mesh(new THREE.DodecahedronGeometry(.35 + R() * .45, 0), rockMat); g.add(r); rocks.push({ r, a: i / 7 * 6.28, y: 2 + R() * 6, rad: 2.6 + R() * 1.2 }); }
      anim.push(t => rocks.forEach(o => { const a = o.a + t * .08; o.r.position.set(14 + Math.cos(a) * o.rad, o.y + Math.sin(t * .4 + o.a) * .15, -12 + Math.sin(a) * o.rad * .5); o.r.rotation.x = t * .12 + o.a; })); }, // (v1.10) órbita lenta
    tornado() { const tt = tex(256, 256, (x, W, H) => { x.fillStyle = 'rgba(230,240,255,.18)'; x.fillRect(0, 0, W, H); x.strokeStyle = 'rgba(255,255,255,.55)'; x.lineWidth = 2; for (let i = 0; i < 24; i++) { x.beginPath(); const y = R() * H; x.moveTo(0, y); x.lineTo(W, y - 30); x.stroke(); } });
      tt.wrapS = tt.wrapT = THREE.RepeatWrapping; tt.repeat.set(3, 2);
      const tw = new THREE.Mesh(new THREE.CylinderGeometry(4, .5, 20, 24, 8, true), new THREE.MeshBasicMaterial({ map: tt, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false })); add(tw, -18, 9, -32);
      const b = tw.geometry.attributes.position.array.slice(); anim.push((t, dt) => { tt.offset.x += dt * .9; const p = tw.geometry.attributes.position; for (let i = 0; i < p.count; i++) { const y = b[i * 3 + 1]; p.setX(i, b[i * 3] + Math.sin(t * 1.3 + y * .25) * (10 - y) * .06); } p.needsUpdate = true; }); },
    orbs() { // los cuatro elementos orbitando alrededor del Sello
      const cols = [0xff7a35, 0x5fd0ff, 0xb9d86a, 0xe6f4ff], orbs = cols.map(c => ({ s: flame(0, 9, -14, 2.4, '#' + new THREE.Color(c).getHexString()), m: add(new THREE.Mesh(new THREE.SphereGeometry(.45, 16, 12), new THREE.MeshBasicMaterial({ color: c })), 0, 9, -14) }));
      anim.push(t => orbs.forEach((o, i) => { const a = t * .5 + i * Math.PI / 2, x = Math.cos(a) * 6, y = 8 + Math.sin(a) * 2.2, z = -14 + Math.sin(a) * 2; o.s.position.set(x, y, z); o.m.position.set(x, y, z); })); },

    // (v1.10) sol bajo con rayos de luz que se abren en abanico y respiran despacio (santuario del viento)
    sunrays() { const sx = 7, sy = 5.5, sz = -40; flame(sx, sy, sz, 20, '#ffd9a8').material.opacity = .7; flame(sx, sy, sz + .5, 6, '#fff3dc').material.opacity = .8;
      const rt = tex(64, 512, (x, W, H) => { const a = x.createLinearGradient(0, 0, W, 0); a.addColorStop(0, 'rgba(255,255,255,0)'); a.addColorStop(.5, 'rgba(255,255,255,1)'); a.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = a; x.fillRect(0, 0, W, H);
        x.globalCompositeOperation = 'destination-in'; const v = x.createLinearGradient(0, H, 0, 0); v.addColorStop(0, 'rgba(0,0,0,1)'); v.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = v; x.fillRect(0, 0, W, H); });
      for (let i = 0; i < 7; i++) { const geo = new THREE.PlaneGeometry(4 + R() * 4, 46); geo.translate(0, 23, 0); const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: rt, color: 0xfff0d0, transparent: true, opacity: .08 + R() * .06, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
        const a0 = (i / 6 - .5) * 2.2; m.rotation.z = a0; m.renderOrder = -4; add(m, sx, sy, sz + 1); const ph = R() * 6, op = m.material.opacity;
        anim.push(t => { m.rotation.z = a0 + .04 * Math.sin(t * .12 + ph); m.material.opacity = op * (.7 + .3 * Math.sin(t * .35 + ph)); }); } },
    // (v1.10) ráfagas de viento que cruzan el fondo (nacen y se apagan con suavidad)
    gusts() { const st = tex(256, 16, (x, W, H) => { const a = x.createLinearGradient(0, 0, W, 0); a.addColorStop(0, 'rgba(255,255,255,0)'); a.addColorStop(.75, 'rgba(255,255,255,.9)'); a.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = a; x.fillRect(0, H * .3, W, H * .4); });
      for (let i = 0; i < 12; i++) { const z = -6 - R() * 16, k = -z / 10, m = new THREE.Mesh(new THREE.PlaneGeometry((2.5 + R() * 3) * k, .07 * k), new THREE.MeshBasicMaterial({ map: st, color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, fog: false }));
        add(m, 0, 0, z); const o = { age: R() * 5, dur: 3 + R() * 2.5, y: 1 + R() * 8, sp: (3 + R() * 2) * k, amp: .2 + R() * .4, ph: R() * 6, op: .35 + R() * .3 };
        anim.push((t, dt) => { o.age += dt; if (o.age > o.dur) { o.age = 0; o.y = 1 + R() * 8; o.ph = R() * 6; } const u = o.age / o.dur, span = 30 * k;
          m.position.set(-span / 2 + u * span, o.y + o.amp * Math.sin(u * 4 + o.ph), z); m.material.opacity = o.op * Math.sin(Math.PI * u) ** 2; }); } },
    // capas de bosque: pinos lejanos azulados y pinos medios
    forestback() {
      layer((x, W, H) => { paint.hills(x, W, H, R, tone(.75), .2, .62, 2); paint.pines(x, W, H, R, tone(.7), 90, .64, .7); }, { w: 170, h: 40, y: 7, z: -34 });
      layer((x, W, H) => { paint.pines(x, W, H, R, tone(.45), 60, .7, 1.1); }, { w: 130, h: 30, y: 8, z: -24 });
    },
    temples() { layer((x, W, H) => { paint.hills(x, W, H, R, tone(.6), .25, .7, 5); paint.pagoda(x, W * .3, H * .5, 1.3, tone(.6), 'rgba(255,214,120,.9)'); paint.pagoda(x, W * .74, H * .56, .9, tone(.6), 'rgba(255,214,120,.9)'); }, { w: 150, h: 34, y: 6, z: -29 }); },
    birds() {
      for (let i = 0; i < 9; i++) { const sp = sprite(birdMap, new THREE.Color(cfg.ground).multiplyScalar(.4), .9 + R() * .5, -40 + R() * 20, 9 + R() * 6, -20 - R() * 6), ph = R() * 6, sp0 = 1.5 + R();
        anim.push((t) => { sp.position.x = -40 + ((t * sp0 + ph * 10) % 80); sp.position.y += Math.sin(t * 2 + ph) * .004; sp.scale.y = (.45 + .25 * Math.abs(Math.sin(t * 8 + ph))) * sp.scale.x; }); }
    },
    lanterns() { // faroles colgantes que se mecen detrás del ring
      for (const x of [-10.5, -6.5, 6.5, 10.5]) {
        add(new THREE.Mesh(new THREE.CylinderGeometry(.06, .09, 4.2, 6), poleMat), x, 2.1, -4.2); add(new THREE.Mesh(new THREE.BoxGeometry(.9, .08, .08), poleMat), x + .4, 4.1, -4.2);
        const L = new THREE.Group(); L.position.set(x + .8, 4.05, -4.2); g.add(L);
        const body = new THREE.Mesh(new THREE.CylinderGeometry(.22, .22, .5, 8), lanternMat); body.position.y = -.42; L.add(body);
        const f = flame(x + .8, 3.6, -4.1, 1.5, '#ffb35a'); const ph = R() * 6;
        anim.push(t => { L.rotation.z = Math.sin(t * 1.4 + ph) * .12; f.position.x = x + .8 + Math.sin(t * 1.4 + ph) * .05; f.scale.setScalar(f.userData.base * (1 + .1 * Math.sin(t * 9 + ph))); });
      }
    },
    rocks() { // rocas y matas al fondo del ring (bajas: nunca tapan)
      for (let i = 0; i < 14; i++) { const s = i % 2 ? 1 : -1, x = s * (3 + R() * 11), r = .25 + R() * .55, m = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), rockMat);
        m.scale.y = .6 + R() * .4; m.rotation.y = R() * 6; m.castShadow = true; add(m, x, r * .3, -3.2 - R() * 2.5); }
    },
    volcano() {
      layer((x, W, H) => paint.volcano(x, W, H, '#3b1714', 'rgba(255,120,40,.95)'), { w: 160, h: 46, y: -3, z: -36 });
      for (let i = 0; i < 10; i++) { const sp = sprite(smokeMap, 0x2a1a1a, 8, 19, 10, -35.5, THREE.NormalBlending, .6), ph = i / 10;
        anim.push(t => { const k = (t * .06 + ph) % 1; sp.position.set(19 + k * 14 + Math.sin(t * .3 + i) * 2, 10 + k * 14, -35.5); sp.scale.setScalar(6 + k * 16); sp.material.opacity = .55 * Math.sin(Math.PI * k); }); }
      const lava = flame(19, 10.5, -36, 12, '#ff6a20'); anim.push(t => { lava.scale.setScalar(lava.userData.base * (1 + .15 * Math.sin(t * 2.2))); });
    },
    castle() { layer((x, W, H) => paint.castle(x, W, H, R, tone(.35, .1), 'rgba(255,150,60,.95)'), { w: 140, h: 30, y: 9, z: -24 }); },
    lavaflow() {
      const t = tex(512, 64, (x, W, H) => { const gr2 = x.createLinearGradient(0, 0, 0, H); gr2.addColorStop(0, 'rgba(255,90,20,0)'); gr2.addColorStop(.5, 'rgba(255,170,60,1)'); gr2.addColorStop(1, 'rgba(255,90,20,0)'); x.fillStyle = gr2; x.fillRect(0, 0, W, H); x.fillStyle = 'rgba(255,240,180,.8)'; for (let i = 0; i < 40; i++) x.fillRect(R() * W, H * .4 + R() * H * .2, 10 + R() * 30, 2); });
      t.wrapS = THREE.RepeatWrapping; t.repeat.set(6, 1);
      for (const [z, y, w2] of [[-8, -.3, 1.6], [-14, -.5, 2.4]]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(120, w2), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); m.rotation.x = -Math.PI / 2; add(m, 0, y, z); }
      anim.push((tm, dt) => { t.offset.x += dt * .05; });
    },
    banners() {
      // tela pintada: degradado oscuro→color del escenario, ribete dorado, emblema de llama y cola en dos puntas
      const ac = new THREE.Color(accent), deep = ac.clone().multiplyScalar(.28), mid = ac.clone().multiplyScalar(.62);
      const bt = tex(128, 352, (x, W, H) => {
        const cut = H - 42; x.beginPath(); x.moveTo(0, 0); x.lineTo(W, 0); x.lineTo(W, H); x.lineTo(W / 2, cut); x.lineTo(0, H); x.closePath();
        const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, hex(deep)); g.addColorStop(.55, hex(mid)); g.addColorStop(1, hex(deep));
        x.fillStyle = g; x.fill(); x.save(); x.clip();
        x.strokeStyle = 'rgba(255,214,120,.9)'; x.lineWidth = 6; x.strokeRect(9, -4, W - 18, H + 8);
        x.fillStyle = 'rgba(0,0,0,.25)'; for (let i = 0; i < 8; i++) x.fillRect(16 + i * 13, 0, 2, H);
        x.restore();
        const cx = W / 2, cy = 120; x.fillStyle = 'rgba(20,6,8,.85)'; x.beginPath(); x.arc(cx, cy, 34, 0, 7); x.fill();
        x.strokeStyle = 'rgba(255,214,120,.95)'; x.lineWidth = 3; x.stroke();
        x.fillStyle = 'rgba(255,190,90,.95)'; x.beginPath(); x.moveTo(cx, cy - 24); x.quadraticCurveTo(cx + 20, cy, cx + 8, cy + 20); x.quadraticCurveTo(cx, cy + 10, cx - 8, cy + 20); x.quadraticCurveTo(cx - 20, cy, cx, cy - 24); x.fill();
        x.fillStyle = 'rgba(255,214,120,.9)'; x.fillRect(14, 210, W - 28, 3); x.fillRect(14, 218, W - 28, 1.5);
      });
      for (const x of [-9, -4.5, 4.5, 9]) {
        add(new THREE.Mesh(new THREE.CylinderGeometry(.07, .09, 7, 6), poleMat), x, 3.5, -5.5);
        add(new THREE.Mesh(new THREE.CylinderGeometry(.04, .04, 1.4, 6).rotateZ(Math.PI / 2), poleMat), x + .6, 6.62, -5.5);
        const f = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 3, 2, 10), new THREE.MeshBasicMaterial({ map: bt, transparent: true, alphaTest: .4, side: THREE.DoubleSide })), pos = f.geometry.attributes.position, b = pos.array.slice();
        add(f, x + .6, 5.1, -5.5); anim.push(t => { for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin(t * 2.4 + b[i * 3 + 1] * 1.5 + x) * .18 * ((1.5 - b[i * 3 + 1]) / 3)); pos.needsUpdate = true; });
      }
    },
    moon() { flame(-14, 17, -38, 16, cfg.rim); const m = new THREE.Mesh(new THREE.CircleGeometry(3.4, 40), new THREE.MeshBasicMaterial({ color: 0xeaf6ff, fog: false })); add(m, -14, 17, -38.5); },
    waves() {
      const t = tex(1024, 128, (x, W, H) => { x.fillStyle = hex(new THREE.Color(cfg.sky[1]).multiplyScalar(.7)); x.fillRect(0, 0, W, H); x.strokeStyle = 'rgba(190,235,255,.55)'; x.lineWidth = 2; for (let i = 0; i < 70; i++) { const y = R() * H; x.beginPath(); x.moveTo(R() * W, y); x.lineTo(R() * W, y); x.stroke(); } });
      t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(4, 2);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(200, 40), new THREE.MeshBasicMaterial({ map: t, fog: false })); m.rotation.x = -Math.PI / 2; add(m, 0, -.7, -40);
      anim.push((tm, dt) => { t.offset.x += dt * .01; t.offset.y += dt * .03; });
    },
    floatlanterns() {
      for (let i = 0; i < 16; i++) { const x0 = -24 + R() * 48, z = -14 - R() * 16, sp = flame(x0, 0, z, .9 + R() * .6, '#ffb35a'), ph = R(), spd = .03 + R() * .03;
        anim.push(t => { const k = (t * spd + ph) % 1; sp.position.set(x0 + Math.sin(t * .4 + ph * 9) * .6, k * 16, z); sp.material.opacity = Math.min(1, k * 5) * (1 - k * k); }); }
    },
    spires() { layer((x, W, H) => paint.spires(x, W, H, R, tone(.55), 16), { w: 150, h: 36, y: 8, z: -30 }); layer((x, W, H) => paint.spires(x, W, H, R, tone(.25, .1), 9), { w: 110, h: 22, y: 7, z: -20 }); },
    canyon() { layer((x, W, H) => { paint.hills(x, W, H, R, tone(.6), .3, .55, 7); }, { w: 170, h: 40, y: 14, z: -34 }); layer((x, W, H) => { paint.hills(x, W, H, R, tone(.35, .05), .25, .7, 3); }, { w: 130, h: 30, y: 8, z: -24 }); },
    arches() { layer((x, W, H) => paint.arches(x, W, H, R, tone(.45, .05)), { w: 130, h: 32, y: 10, z: -26 }); },
    islands() { layer((x, W, H) => paint.islands(x, W, H, R, tone(.55), 'rgba(255,230,160,.9)', 7), { w: 160, h: 40, y: 9, z: -32 }); },
    cloudsea() {
      for (let i = 0; i < 16; i++) { const sp = sprite(smokeMap, 0xffffff, 10 + R() * 10, -50 + i * 6.5, -1 + R() * 2, -18 - R() * 14, THREE.NormalBlending, .7), x0 = sp.position.x, ph = R() * 6;
        anim.push(t => { sp.position.x = x0 + Math.sin(t * .05 + ph) * 3; }); }
    },
    kites() {
      for (let i = 0; i < 4; i++) { const k = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.2), new THREE.MeshBasicMaterial({ color: [0xff6a55, 0xffd257, 0x5aa9ff, 0x5fd38a][i], side: THREE.DoubleSide })); k.rotation.z = Math.PI / 4;
        const x0 = -12 + i * 8, y0 = 9 + R() * 3, z = -12 - R() * 4; add(k, x0, y0, z); const ph = R() * 6;
        anim.push(t => { k.position.set(x0 + Math.sin(t * .5 + ph) * 1.2, y0 + Math.sin(t * .9 + ph) * .6, z); k.rotation.y = Math.sin(t * 1.3 + ph) * .4; }); }
    },
    stars() {
      const N = 400, pos = new Float32Array(N * 3); for (let i = 0; i < N; i++) pos.set([(R() * 2 - 1) * 80, 6 + R() * 40, -38 - R() * 6], i * 3);
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const pts = new THREE.Points(geo, new THREE.PointsMaterial({ map: glow, color: 0xffffff, size: .55, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
      pts.frustumCulled = false; g.add(pts); anim.push(t => { pts.material.opacity = .75 + .25 * Math.sin(t * 1.7); });
    },
    aurora() {
      const t = tex(1024, 128, (x, W, H) => { const gr2 = x.createLinearGradient(0, 0, 0, H); gr2.addColorStop(0, 'rgba(120,255,200,0)'); gr2.addColorStop(.5, 'rgba(140,255,210,.8)'); gr2.addColorStop(1, 'rgba(180,120,255,0)'); x.fillStyle = gr2;
        for (let i = 0; i < W; i += 3) { const hh = H * (.5 + .5 * Math.sin(i * .02) * Math.sin(i * .007)); x.globalAlpha = .4 + .6 * Math.abs(Math.sin(i * .013)); x.fillRect(i, (H - hh) / 2, 3, hh); } });
      t.wrapS = THREE.RepeatWrapping;
      for (const [y, z, op] of [[22, -37, .6], [18, -35, .35]]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(160, 10, 40, 1), new THREE.MeshBasicMaterial({ map: t, transparent: true, opacity: op, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, side: THREE.DoubleSide })), p = m.geometry.attributes.position, b = p.array.slice();
        add(m, 0, y, z); anim.push((tm, dt) => { t.offset.x += dt * .004; for (let i = 0; i < p.count; i++) p.setY(i, b[i * 3 + 1] + Math.sin(tm * .4 + b[i * 3] * .06) * 2.2); p.needsUpdate = true; }); }
    },
  };
  for (const e of ex) { try { E[e]?.(); } catch (err) { console.warn('[escenario] adorno', e, err); } }
}
