import * as THREE from 'three';
import { addExtras } from './stage-extras.js';

// Construye un escenario 3D a partir de su configuración (data/stages.json).
// Devuelve la MISMA interfaz que js/game/arena.js (group, sky, update, dispose) y añade react() para
// que el combate (F3) pueda hacer reaccionar el entorno a los golpes sin conocer los detalles del escenario.
// Regla de diseño: el decorado vive detrás del plano de combate (z < -2) y nunca tapa a los luchadores.

const tex = (w, h, draw) => {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
};
const glowTex = () => tex(64, 64, x => {
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.4, 'rgba(255,255,255,.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
});
const ridge = (seed, col) => tex(1024, 256, (x, w, h) => {
  x.fillStyle = col; x.beginPath(); x.moveTo(0, h);
  for (let i = 0; i <= 32; i++) x.lineTo(i * w / 32, h * (.35 + .3 * Math.abs(Math.sin(i * .7 + seed)) + .12 * Math.sin(i * 2.3 + seed * 3)));
  x.lineTo(w, h); x.fill();
});
// Generador pseudoaleatorio determinista: el mismo escenario siempre se ve igual
const rng = seed => () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
const hash = s => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
const mix = (a, b, k) => new THREE.Color(a).lerp(new THREE.Color(b), k);

export function buildStage(cfg, { half = 8.2, particles = 300 } = {}) {
  const g = new THREE.Group(), R = rng(hash(cfg.id)), W = half + 1.6;
  const accent = new THREE.Color(cfg.accent), ground = new THREE.Color(cfg.ground), slabC = new THREE.Color(cfg.slab);
  const stone = new THREE.MeshStandardMaterial({ color: slabC.clone().multiplyScalar(.8), roughness: .9, flatShading: true });
  const dark = new THREE.MeshStandardMaterial({ color: ground.clone().multiplyScalar(.7), roughness: 1, flatShading: true });
  const emis = new THREE.MeshBasicMaterial({ color: accent });
  const glow = glowTex(), anim = [], sprites = [], pulses = [];
  const add = (m, x, y, z) => { m.position.set(x, y, z); g.add(m); return m; };
  const flame = (x, y, z, s, col = accent) => {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: col, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    sp.scale.setScalar(s); sp.position.set(x, y, z); sp.userData.base = s; g.add(sp); sprites.push(sp); return sp;
  };

  // --- Suelo de combate (siempre igual de legible) ---
  add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(W * 2, .8, 5.4), stone), { receiveShadow: true }), 0, -.4, 0);
  const slabs = tex(1024, 256, (x, w, h) => {
    x.fillStyle = '#' + slabC.getHexString(); x.fillRect(0, 0, w, h); x.strokeStyle = 'rgba(0,0,0,.35)'; x.lineWidth = 4;
    for (let i = 0; i <= 16; i++) { x.beginPath(); x.moveTo(i * w / 16, 0); x.lineTo(i * w / 16, h); x.stroke(); }
    for (let i = 0; i <= 4; i++) { x.beginPath(); x.moveTo(0, i * h / 4); x.lineTo(w, i * h / 4); x.stroke(); }
    x.strokeStyle = '#' + accent.getHexString(); x.lineWidth = 6; x.beginPath(); x.arc(w / 2, h / 2, 100, 0, 7); x.stroke(); x.beginPath(); x.arc(w / 2, h / 2, 60, 0, 7); x.stroke();
  });
  const deck = new THREE.Mesh(new THREE.PlaneGeometry(W * 2, 5.4), new THREE.MeshStandardMaterial({ map: slabs, roughness: .8 }));
  deck.rotation.x = -Math.PI / 2; deck.receiveShadow = true; add(deck, 0, .005, 0);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(160, 90), new THREE.MeshStandardMaterial({ color: ground.clone().multiplyScalar(.55), roughness: 1 }));
  back.rotation.x = -Math.PI / 2; add(back, 0, -.8, -40);
  for (const s of [-1, 1]) { // pilares de límite: marcan el borde jugable
    const p = new THREE.Mesh(new THREE.CylinderGeometry(.5, .65, 3.6, 8), stone); p.castShadow = true; add(p, s * (W + .2), 1.8, -.4);
    const k = new THREE.Mesh(new THREE.OctahedronGeometry(.45), emis); add(k, s * (W + .2), 4.3, -.4); anim.push(t => { k.rotation.y = t; });
  }

  // --- Cielo lejano / montañas ---
  if (cfg.props.includes('mountains')) for (const [seed, k, z, y, w, h] of [[1, .35, -38, 10, 130, 32], [4, .6, -26, 6, 100, 22]]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: ridge(seed + hash(cfg.id) % 5, '#' + mix(cfg.sky[1], cfg.ground, k).getHexString()), transparent: true, depthWrite: false }));
    add(m, 0, y, z);
  }
  if (cfg.props.includes('sunglow')) flame(0, 9, -34, 36, cfg.rim);

  // --- Props por tipo ---
  const P = {
    trees() {
      const trunk = new THREE.MeshStandardMaterial({ color: 0x4a3322, roughness: 1 }), leaf = new THREE.MeshStandardMaterial({ color: ground.clone().offsetHSL(0, .1, -.05), roughness: .9, flatShading: true });
      for (let i = 0; i < 16; i++) {
        const x = -26 + i * 3.4 + R() * 1.5, z = -9 - R() * 9, h = 4 + R() * 3.5;
        add(new THREE.Mesh(new THREE.CylinderGeometry(.28, .4, h, 6), trunk), x, h / 2 - .4, z);
        for (let j = 0; j < 3; j++) add(new THREE.Mesh(new THREE.ConeGeometry(1.9 - j * .4, 2.6, 7), leaf), x, h + j * 1.2 - .4, z);
      }
    },
    ruins() {
      for (const s of [-1, 1]) {
        add(new THREE.Mesh(new THREE.BoxGeometry(1.1, 7, 1.1), stone), s * 6, 3.1, -9); add(new THREE.Mesh(new THREE.BoxGeometry(1.1, 5, 1.1), stone), s * 10, 2.1, -9);
      }
      add(new THREE.Mesh(new THREE.BoxGeometry(14, 1, 1.4), stone), -3, 6.8, -9);
    },
    fortress() {
      for (let i = 0; i < 14; i++) { add(new THREE.Mesh(new THREE.BoxGeometry(2.4, 7, 1.6), dark), -22 + i * 3.4, 3, -12); if (i % 2) add(new THREE.Mesh(new THREE.BoxGeometry(1.6, 1, 1.6), dark), -22 + i * 3.4, 6.9, -12); }
      for (const s of [-1, 1]) { add(new THREE.Mesh(new THREE.CylinderGeometry(2, 2.4, 14, 8), dark), s * 14, 6.6, -14); add(new THREE.Mesh(new THREE.ConeGeometry(2.6, 3.4, 8), stone), s * 14, 15.2, -14); }
    },
    torches() {
      for (const x of [-12, -7, -2.5, 2.5, 7, 12]) {
        add(new THREE.Mesh(new THREE.CylinderGeometry(.07, .1, 2.4, 6), dark), x, 1.2, -4.6);
        const f = flame(x, 2.8, -4.6, 1.6, '#ff9a3a'); f.userData.ph = R() * 6; anim.push(t => { const s = f.userData.base * (1 + .18 * Math.sin(t * 11 + f.userData.ph) + .08 * Math.sin(t * 23)); f.scale.setScalar(s); });
      }
    },
    cracks() {
      const t = tex(1024, 256, (x, w, h) => { x.clearRect(0, 0, w, h); x.strokeStyle = '#fff'; x.lineWidth = 3; for (let i = 0; i < 14; i++) { let px = R() * w, py = R() * h; x.beginPath(); x.moveTo(px, py); for (let j = 0; j < 6; j++) { px += (R() - .5) * 120; py += (R() - .5) * 60; x.lineTo(px, py); } x.stroke(); } });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(W * 2, 5.4), new THREE.MeshBasicMaterial({ map: t, color: accent, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      m.rotation.x = -Math.PI / 2; add(m, 0, .02, 0); anim.push(tm => { m.material.opacity = .55 + .25 * Math.sin(tm * 1.4); });
    },
    temple() {
      for (let i = 0; i < 7; i++) add(new THREE.Mesh(new THREE.CylinderGeometry(.55, .65, 8, 10), stone), -15 + i * 5, 3.6, -11);
      add(new THREE.Mesh(new THREE.BoxGeometry(36, 1.4, 3), stone), 0, 8.1, -11); add(new THREE.Mesh(new THREE.BoxGeometry(30, 1.2, 2.4), stone), 0, 9.3, -11);
    },
    waterfall() {
      const t = tex(128, 512, (x, w, h) => { const gr = x.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, '#2f8cff'); gr.addColorStop(.5, '#d8f4ff'); gr.addColorStop(1, '#2f8cff'); x.fillStyle = gr; x.fillRect(0, 0, w, h); x.fillStyle = 'rgba(255,255,255,.5)'; for (let i = 0; i < 60; i++) x.fillRect(R() * w, R() * h, 2 + R() * 3, 20 + R() * 50); });
      t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 2);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(7, 16), new THREE.MeshBasicMaterial({ map: t, transparent: true, opacity: .75, depthWrite: false })); add(m, 0, 6, -16);
      anim.push((_, dt) => { t.offset.y -= dt * .35; });
    },
    pool() {
      const t = tex(256, 256, (x, w, h) => { x.fillStyle = '#1a5a9a'; x.fillRect(0, 0, w, h); x.strokeStyle = 'rgba(200,240,255,.35)'; x.lineWidth = 2; for (let i = 0; i < 22; i++) { x.beginPath(); x.ellipse(R() * w, R() * h, 10 + R() * 30, 3 + R() * 6, 0, 0, 7); x.stroke(); } });
      t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(8, 4);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(90, 36), new THREE.MeshBasicMaterial({ map: t, transparent: true, opacity: .85 })); m.rotation.x = -Math.PI / 2; add(m, 0, -.6, -22);
      anim.push((_, dt) => { t.offset.x += dt * .02; t.offset.y += dt * .015; });
    },
    pillars() {
      for (const s of [-1, 1]) for (const [x, z, h] of [[9, -8, 9], [14, -12, 11], [20, -9, 7]]) {
        add(new THREE.Mesh(new THREE.CylinderGeometry(.8, 1, h, 8), stone), s * x, h / 2 - .4, z); add(new THREE.Mesh(new THREE.BoxGeometry(2.2, .6, 2.2), stone), s * x, h - .1, z);
      }
    },
    colossus() {
      add(new THREE.Mesh(new THREE.BoxGeometry(7, 9, 3.5), stone), 0, 4.1, -17); add(new THREE.Mesh(new THREE.BoxGeometry(3.6, 3.4, 3), stone), 0, 10.3, -17);
      for (const s of [-1, 1]) add(new THREE.Mesh(new THREE.BoxGeometry(2.4, 8, 2.6), dark), s * 5, 4.1, -17);
      add(new THREE.Mesh(new THREE.BoxGeometry(1.2, .4, .4), emis), 0, 10.6, -15.4);
    },
    crystals() {
      const m = new THREE.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: .9, roughness: .3, flatShading: true });
      for (let i = 0; i < 12; i++) {
        const c = new THREE.Mesh(new THREE.OctahedronGeometry(.5 + R() * .7), m), s = i % 2 ? 1 : -1, x = s * (5 + R() * 15), y0 = .8 + R() * 3.5;
        c.scale.y = 1.9; add(c, x, y0, -5.5 - R() * 5); c.userData.ph = R() * 6; anim.push(t => { c.rotation.y = t * .12 + c.userData.ph; c.position.y = y0 + Math.sin(t * .45 + c.userData.ph) * .1; }); // (v1.10) más calmado
      }
    },
    bridges() {
      const m = new THREE.MeshStandardMaterial({ color: slabC, roughness: .85, flatShading: true });
      add(new THREE.Mesh(new THREE.BoxGeometry(70, .5, 3), m), 0, 3.4, -11); add(new THREE.Mesh(new THREE.BoxGeometry(70, .15, .15), emis), 0, 4.5, -9.6); add(new THREE.Mesh(new THREE.BoxGeometry(70, .15, .15), emis), 0, 4.5, -12.4);
      for (let i = 0; i < 10; i++) add(new THREE.Mesh(new THREE.CylinderGeometry(.25, .3, 3.2, 6), m), -30 + i * 6.7, 1.7, -11);
    },
    flags() {
      for (const x of [-11, -6, 6, 11]) {
        add(new THREE.Mesh(new THREE.CylinderGeometry(.06, .08, 6, 6), dark), x, 3, -6);
        const f = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.3, 12, 2), new THREE.MeshBasicMaterial({ color: accent, side: THREE.DoubleSide })), pos = f.geometry.attributes.position, base = pos.array.slice();
        add(f, x + 1.2, 5.3, -6); anim.push(t => { for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin(t * 3 + base[i * 3] * 2.2 + x) * .22 * ((base[i * 3] + 1.2) / 2.4)); pos.needsUpdate = true; });
      }
    },
    clouds() {
      for (let i = 0; i < 9; i++) { const sp = flame(-30 + i * 7.5 + R() * 3, 6 + R() * 12, -22 - R() * 10, 12 + R() * 8, '#ffffff'); sp.material.opacity = .5; sp.userData.x0 = sp.position.x; sp.userData.ph = R() * 6; anim.push(t => { sp.position.x = sp.userData.x0 + Math.sin(t * .05 + sp.userData.ph) * 3; }); }
    },
    // (v1.10) SANTUARIO DEL VIENTO: templos sobre islas flotantes, molinos de viento y banderas de oración
    airtemple() {
      const wall = new THREE.MeshStandardMaterial({ color: 0xece4d2, roughness: .8, flatShading: true }), roof = new THREE.MeshStandardMaterial({ color: 0x3d68b8, roughness: .55, flatShading: true }),
        gold = new THREE.MeshStandardMaterial({ color: 0xffc35a, emissive: 0x6a3a00, roughness: .35, metalness: .5 }), rock = new THREE.MeshStandardMaterial({ color: ground.clone().lerp(new THREE.Color(0x6d6a72), .5), roughness: 1, flatShading: true }),
        moss = new THREE.MeshStandardMaterial({ color: 0x7fae6a, roughness: 1, flatShading: true });
      const tower = (grp, x, z, s) => { let y = .3; for (let k = 0; k < 3; k++) { const r = (1.25 - k * .32) * s, h = (1.5 - k * .25) * s;
          const w = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.05, h, 10), wall); w.position.set(x, y + h / 2, z); grp.add(w); y += h;
          const rf = new THREE.Mesh(new THREE.ConeGeometry(r * 1.55, r * 1.1, 10), roof); rf.position.set(x, y + r * .5, z); grp.add(rf); y += r * .75; }
        const sp = new THREE.Mesh(new THREE.ConeGeometry(.12 * s, 1.2 * s, 6), gold); sp.position.set(x, y + .45 * s, z); grp.add(sp); };
      const isle = (x, y, z, r, towers, ph) => { const grp = new THREE.Group(); grp.position.set(x, y, z); g.add(grp);
        const under = new THREE.Mesh(new THREE.ConeGeometry(r, r * 1.6, 8), rock); under.rotation.x = Math.PI; under.position.y = -r * .8; grp.add(under);
        const top = new THREE.Mesh(new THREE.CylinderGeometry(r, r * .96, .45, 8), moss); grp.add(top);
        for (const [tx, tz, ts] of towers) tower(grp, tx, tz, ts);
        anim.push(t => { grp.position.y = y + Math.sin(t * .22 + ph) * .3; grp.rotation.y = Math.sin(t * .05 + ph) * .04; }); };
      isle(-15, 2.6, -32, 4.6, [[0, 0, 1.25], [-2.3, .8, .8], [2.2, -.6, .7]], 0);
      isle(16, 1.6, -26, 3.2, [[0, 0, .95], [1.6, .5, .6]], 2);
      isle(3.5, 7.2, -46, 2.6, [[0, 0, .8]], 4);
    },
    windmills() {
      const wood = new THREE.MeshStandardMaterial({ color: 0x8a6a4a, roughness: 1 }), cloth = [0xffae42, 0xfff2d8];
      for (const [x, z, h, sp] of [[-11.5, -13, 4.6, .5], [8.5, -15, 5.2, -.4], [13.5, -12, 4, .62]]) {
        add(new THREE.Mesh(new THREE.CylinderGeometry(.09, .14, h, 6), wood), x, h / 2 - .4, z);
        const rot = new THREE.Group(); rot.position.set(x, h - .3, z + .15); g.add(rot);
        for (let i = 0; i < 4; i++) { const b = new THREE.Mesh(new THREE.PlaneGeometry(.42, 1.5), new THREE.MeshStandardMaterial({ color: cloth[i % 2], side: THREE.DoubleSide, roughness: .9 })); b.position.y = .85; b.rotation.y = .35; const arm = new THREE.Group(); arm.rotation.z = i * Math.PI / 2; arm.add(b); rot.add(arm); }
        add(new THREE.Mesh(new THREE.SphereGeometry(.13, 8, 6), new THREE.MeshStandardMaterial({ color: 0xffc35a, roughness: .4 })), x, h - .3, z + .2);
        anim.push(t => { rot.rotation.z = t * sp + Math.sin(t * .6 + x) * .15; });
      }
    },
    prayerflags() {
      const cols = [0x4f86e0, 0xf2f2ea, 0xe0503c, 0x5fbf6a, 0xffc94a];
      for (const [x0, x1, z, y] of [[-17, -5.5, -10, 3.8], [5.5, 17, -10, 3.8]]) {
        for (const x of [x0, x1]) add(new THREE.Mesh(new THREE.CylinderGeometry(.045, .06, y + .5, 6), dark), x, (y + .5) / 2 - .4, z);
        const n = 14; for (let i = 1; i < n; i++) { const u = i / n, px = x0 + (x1 - x0) * u, py = y - Math.sin(u * Math.PI) * .9;
          const f = new THREE.Mesh(new THREE.PlaneGeometry(.42, .5), new THREE.MeshStandardMaterial({ color: cols[i % cols.length], side: THREE.DoubleSide, roughness: .9 })); f.geometry.translate(0, -.25, 0); add(f, px, py, z); const ph = i * .7 + x0;
          anim.push(t => { f.rotation.x = .25 + .2 * Math.sin(t * 1.6 + ph); f.rotation.y = .15 * Math.sin(t * 1.1 + ph * 1.3); }); }
      }
    },
    sigils() {
      const defs = [['#ff7a35', () => new THREE.ConeGeometry(.9, 1.8, 4)], ['#5fd0ff', () => new THREE.SphereGeometry(.8, 12, 10)], ['#b9d86a', () => new THREE.BoxGeometry(1.3, 1.3, 1.3)], ['#e6f4ff', () => new THREE.TorusGeometry(.7, .2, 8, 20)]];
      defs.forEach(([col, geo], i) => {
        const m = new THREE.Mesh(geo(), new THREE.MeshBasicMaterial({ color: col })), x = -9 + i * 6, y0 = 5.5 + (i % 2) * 1.2;
        add(m, x, y0, -9); pulses.push(m); anim.push(t => { m.rotation.y = t * .8 + i; m.position.y = y0 + Math.sin(t + i) * .25; });
        flame(x, y0, -9.5, 3.4, col);
      });
    },
    ringhalo() {
      const r = new THREE.Mesh(new THREE.TorusGeometry(4.6, .22, 12, 64), emis); add(r, 0, 6.2, -12); anim.push(t => { r.rotation.z = t * .12; r.rotation.y = Math.sin(t * .2) * .25; });
      flame(0, 6.2, -12.5, 26, cfg.rim);
    }
  };
  for (const p of cfg.props) P[p]?.();
  addExtras(cfg, { g, add, flame, anim, R, glow, accent, stone, dark, emis }); // fondos ricos por escenario (js/stages/stage-extras.js)

  // --- Partículas ambientales (la cantidad respeta la calidad gráfica) ---
  const N = Math.max(0, Math.min(cfg.fx.count, particles)), pos = new Float32Array(N * 3), seed = new Float32Array(N);
  for (let i = 0; i < N; i++) { pos.set([(R() * 2 - 1) * 14, R() * 8, -4 + R() * 6], i * 3); seed[i] = R(); }
  const geoP = new THREE.BufferGeometry(); geoP.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(geoP, new THREE.PointsMaterial({ map: glow, color: cfg.fx.color, size: cfg.fx.size, transparent: true, depthWrite: false, blending: cfg.fx.kind === 'ash' || cfg.fx.kind === 'motes' || cfg.fx.kind === 'bubbles' ? THREE.AdditiveBlending : THREE.NormalBlending }));
  pts.frustumCulled = false; g.add(pts);
  const MOVE = { // [vy, vx, balanceo] por tipo de efecto
    leaves: [-.5, .35, .8], ash: [-.45, .15, .35], bubbles: [.55, 0, .3], dust: [.08, .25, .5], streaks: [0, 3.2, .1], motes: [.3, 0, .4]
  }[cfg.fx.kind] || [.2, 0, .3];

  // --- Cielo ---
  const sky = tex(4, 256, (x, w, h) => { const gr = x.createLinearGradient(0, 0, 0, h); cfg.sky.forEach((c, i) => gr.addColorStop(i / (cfg.sky.length - 1), c)); x.fillStyle = gr; x.fillRect(0, 0, w, h); });

  let pulse = 0, calm = false;
  return {
    group: g, sky, id: cfg.id,
    env: { fogColor: cfg.fog.color, fogDensity: cfg.fog.density, key: cfg.key, keyIntensity: cfg.keyI, rim: cfg.rim },
    // Hook para F3: stage.react({ power: 0..1, color?: '#hex' }) en cada golpe importante
    react({ power = .5, color } = {}) {
      if (calm) return; pulse = Math.min(1, pulse + power);
      if (color) pulses.forEach(m => m.material.color.set(color));
    },
    update(t, dt, reduce) {
      const m = reduce ? .2 : 1; calm = !!reduce;
      pulse = Math.max(0, pulse - dt * 2.5);
      for (const a of anim) a(t * m, dt * m);
      for (const s of sprites) s.material.opacity = Math.min(1, (s.userData.keep ??= s.material.opacity) + pulse * .5);
      for (const p of pulses) p.scale.setScalar(1 + pulse * .6);
      const a = geoP.attributes.position.array;
      for (let i = 0; i < N; i++) {
        const j = i * 3, s = seed[i];
        a[j + 1] += MOVE[0] * dt * m * (.6 + s); a[j] += (MOVE[1] + Math.sin(t * 1.3 + s * 40) * MOVE[2]) * dt * m * (.6 + s);
        if (a[j + 1] > 8) a[j + 1] = 0; else if (a[j + 1] < 0) a[j + 1] = 8;
        if (a[j] > 14) a[j] = -14; else if (a[j] < -14) a[j] = 14;
      }
      geoP.attributes.position.needsUpdate = true;
    },
    dispose() {
      const seen = new Set();
      g.traverse(o => { o.geometry?.dispose(); for (const mt of [].concat(o.material || [])) { if (seen.has(mt)) continue; seen.add(mt); mt.map?.dispose(); mt.dispose(); } });
      glow.dispose(); sky.dispose(); g.removeFromParent();
    }
  };
}
