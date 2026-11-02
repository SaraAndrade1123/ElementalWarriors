import * as THREE from 'three';
import { WORLD } from './fighter.js';

const tex = (w, h, draw, repeat) => {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
};
export const glow = () => tex(64, 64, (x) => {
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.4, 'rgba(255,255,255,.35)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64);
});
const ridge = (seed, col) => tex(1024, 256, (x, w, h) => {
  x.fillStyle = col; x.beginPath(); x.moveTo(0, h);
  for (let i = 0; i <= 32; i++) x.lineTo(i * w / 32, h * (.35 + .3 * Math.abs(Math.sin(i * .7 + seed)) + .12 * Math.sin(i * 2.3 + seed * 3)));
  x.lineTo(w, h); x.fill();
});

// Arena original «Ruinas del Equilibrio»: suelo de losas, anillo elemental, montañas con paralaje e islas flotantes.
export function buildArena(color) {
  const g = new THREE.Group(), c = new THREE.Color(color), W = WORLD.half + 1.6;
  const stone = new THREE.MeshStandardMaterial({ color: 0x2a3556, roughness: .9, flatShading: true });
  const emis = new THREE.MeshBasicMaterial({ color: c });
  const floor = new THREE.Mesh(new THREE.BoxGeometry(W * 2, .8, 5.4), stone); floor.position.y = -.4; floor.receiveShadow = true; g.add(floor);
  const slabs = tex(1024, 256, (x, w, h) => {
    x.fillStyle = '#34416a'; x.fillRect(0, 0, w, h); x.strokeStyle = '#1b2440'; x.lineWidth = 4;
    for (let i = 0; i <= 16; i++) { x.beginPath(); x.moveTo(i * w / 16, 0); x.lineTo(i * w / 16, h); x.stroke(); }
    for (let i = 0; i <= 4; i++) { x.beginPath(); x.moveTo(0, i * h / 4); x.lineTo(w, i * h / 4); x.stroke(); }
    x.strokeStyle = '#' + c.getHexString(); x.lineWidth = 6; x.beginPath(); x.arc(w / 2, h / 2, 100, 0, 7); x.stroke(); x.beginPath(); x.arc(w / 2, h / 2, 60, 0, 7); x.stroke();
  });
  const deck = new THREE.Mesh(new THREE.PlaneGeometry(W * 2, 5.4), new THREE.MeshStandardMaterial({ map: slabs, roughness: .8 }));
  deck.rotation.x = -Math.PI / 2; deck.position.y = .005; deck.receiveShadow = true; g.add(deck);
  for (const s of [-1, 1]) { // pilares de límite con cristal
    const p = new THREE.Mesh(new THREE.CylinderGeometry(.5, .65, 3.6, 8), stone); p.position.set(s * (W + .2), 1.8, -.4); p.castShadow = true; g.add(p);
    const k = new THREE.Mesh(new THREE.OctahedronGeometry(.45), emis); k.position.set(s * (W + .2), 4.3, -.4); g.add(k); k.userData.spin = 1;
  }
  const ring = new THREE.Mesh(new THREE.TorusGeometry(4.2, .22, 12, 64), emis); ring.position.set(0, 6.2, -11); g.add(ring);
  const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow(), color: c, transparent: true, opacity: .55, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  sun.scale.setScalar(24); sun.position.set(0, 6.2, -12); g.add(sun);
  for (const s of [-1, 1]) for (const [x, z, h] of [[7, -9, 8], [13, -13, 10]]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(.7, .9, h, 8), stone); p.position.set(s * x, h / 2 - .4, z); g.add(p);
  }
  for (const [seed, col, z, y, w, h] of [[1, '#1b2142', -34, 9, 120, 30], [4, '#141a33', -22, 5, 90, 20]]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: ridge(seed, col), transparent: true, depthWrite: false }));
    m.position.set(0, y, z); g.add(m);
  }
  const isl = [], geo = new THREE.DodecahedronGeometry(.5, 0);
  for (let i = 0; i < 7; i++) {
    const m = new THREE.Mesh(geo, stone), s = 1 + (i % 3) * .7; m.scale.set(s * 1.6, s * .6, s);
    m.position.set(-18 + i * 6, 7 + (i % 3) * 2.5, -14 - (i % 2) * 5); m.userData = { y: m.position.y, ph: i * 1.7 }; g.add(m); isl.push(m);
  }
  const N = 120, pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) pos.set([(Math.random() * 2 - 1) * 14, Math.random() * 7, -4 + Math.random() * 6], i * 3);
  const geoP = new THREE.BufferGeometry(); geoP.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(geoP, new THREE.PointsMaterial({ map: glow(), color: c, size: .12, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); pts.frustumCulled = false; g.add(pts);
  const sky = tex(4, 256, (x, w, h) => {
    const gr = x.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#070b1e'); gr.addColorStop(.55, '#2a2352'); gr.addColorStop(1, '#a8566a'); x.fillStyle = gr; x.fillRect(0, 0, w, h);
  });
  return {
    group: g, sky,
    update(t, dt, reduce) {
      const m = reduce ? .2 : 1;
      ring.rotation.z += dt * .12 * m; ring.rotation.y = Math.sin(t * .2 * m) * .25;
      for (const o of g.children) if (o.userData.spin) o.rotation.y += dt * m;
      for (const r of isl) r.position.y = r.userData.y + Math.sin(t * .4 * m + r.userData.ph) * .3;
      const a = geoP.attributes.position.array;
      for (let i = 0; i < N; i++) { a[i * 3 + 1] += dt * m * (.3 + (i % 5) * .1); if (a[i * 3 + 1] > 7) a[i * 3 + 1] = 0; }
      geoP.attributes.position.needsUpdate = true;
    },
    dispose() {
      g.traverse(o => { o.geometry?.dispose(); const ms = o.material; if (ms) { ms.map?.dispose(); ms.dispose(); } });
      sky.dispose(); g.removeFromParent();
    }
  };
}
