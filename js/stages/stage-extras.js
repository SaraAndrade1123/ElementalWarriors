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

  const E = {
    // capas de bosque: pinos lejanos azulados y pinos medios
    forestback() {
      layer((x, W, H) => { paint.hills(x, W, H, R, tone(.75), .2, .62, 2); paint.pines(x, W, H, R, tone(.7), 90, .64, .7); }, { w: 170, h: 40, y: 12, z: -34 });
      layer((x, W, H) => { paint.pines(x, W, H, R, tone(.45), 60, .7, 1.1); }, { w: 130, h: 30, y: 8, z: -24 });
    },
    temples() { layer((x, W, H) => { paint.hills(x, W, H, R, tone(.6), .25, .7, 5); paint.pagoda(x, W * .3, H * .5, 1.3, tone(.6), 'rgba(255,214,120,.9)'); paint.pagoda(x, W * .74, H * .56, .9, tone(.6), 'rgba(255,214,120,.9)'); }, { w: 150, h: 34, y: 11, z: -29 }); },
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
      layer((x, W, H) => paint.volcano(x, W, H, tone(.55), 'rgba(255,120,40,.95)'), { w: 160, h: 46, y: 15, z: -36 });
      for (let i = 0; i < 10; i++) { const sp = sprite(smokeMap, 0x2a1a1a, 8, 20, 22, -35.5, THREE.NormalBlending, .6), ph = i / 10;
        anim.push(t => { const k = (t * .06 + ph) % 1; sp.position.set(20 + k * 14 + Math.sin(t * .3 + i) * 2, 26 + k * 18, -35.5); sp.scale.setScalar(6 + k * 16); sp.material.opacity = .55 * Math.sin(Math.PI * k); }); }
      const lava = flame(20, 27, -36, 14, '#ff6a20'); anim.push(t => { lava.scale.setScalar(lava.userData.base * (1 + .15 * Math.sin(t * 2.2))); });
    },
    castle() { layer((x, W, H) => paint.castle(x, W, H, R, tone(.35, .1), 'rgba(255,150,60,.95)'), { w: 140, h: 30, y: 9, z: -24 }); },
    lavaflow() {
      const t = tex(512, 64, (x, W, H) => { const gr2 = x.createLinearGradient(0, 0, 0, H); gr2.addColorStop(0, 'rgba(255,90,20,0)'); gr2.addColorStop(.5, 'rgba(255,170,60,1)'); gr2.addColorStop(1, 'rgba(255,90,20,0)'); x.fillStyle = gr2; x.fillRect(0, 0, W, H); x.fillStyle = 'rgba(255,240,180,.8)'; for (let i = 0; i < 40; i++) x.fillRect(R() * W, H * .4 + R() * H * .2, 10 + R() * 30, 2); });
      t.wrapS = THREE.RepeatWrapping; t.repeat.set(6, 1);
      for (const [z, y, w2] of [[-8, -.3, 1.6], [-14, -.5, 2.4]]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(120, w2), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); m.rotation.x = -Math.PI / 2; add(m, 0, y, z); }
      anim.push((tm, dt) => { t.offset.x += dt * .05; });
    },
    banners() {
      for (const x of [-9, -4.5, 4.5, 9]) {
        add(new THREE.Mesh(new THREE.CylinderGeometry(.07, .09, 7, 6), poleMat), x, 3.5, -5.5);
        const f = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 3, 2, 10), new THREE.MeshBasicMaterial({ color: accent, side: THREE.DoubleSide })), pos = f.geometry.attributes.position, b = pos.array.slice();
        add(f, x + .6, 5.1, -5.5); anim.push(t => { for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin(t * 2.4 + b[i * 3 + 1] * 1.5 + x) * .18 * ((1.5 - b[i * 3 + 1]) / 3)); pos.needsUpdate = true; });
        const em = new THREE.Mesh(new THREE.CircleGeometry(.28, 16), new THREE.MeshBasicMaterial({ color: 0x1a0608 })); add(em, x + .6, 5.6, -5.48);
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
    spires() { layer((x, W, H) => paint.spires(x, W, H, R, tone(.55), 16), { w: 150, h: 36, y: 13, z: -30 }); layer((x, W, H) => paint.spires(x, W, H, R, tone(.25, .1), 9), { w: 110, h: 22, y: 7, z: -20 }); },
    canyon() { layer((x, W, H) => { paint.hills(x, W, H, R, tone(.6), .3, .55, 7); }, { w: 170, h: 40, y: 14, z: -34 }); layer((x, W, H) => { paint.hills(x, W, H, R, tone(.35, .05), .25, .7, 3); }, { w: 130, h: 30, y: 8, z: -24 }); },
    arches() { layer((x, W, H) => paint.arches(x, W, H, R, tone(.45, .05)), { w: 130, h: 32, y: 10, z: -26 }); },
    islands() { layer((x, W, H) => paint.islands(x, W, H, R, tone(.55), 'rgba(255,230,160,.9)', 7), { w: 160, h: 40, y: 14, z: -32 }); },
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
