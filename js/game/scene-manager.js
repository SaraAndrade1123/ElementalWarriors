import * as THREE from 'three';
import { PostFX } from './render/post.js';
import { addOutlines, OUTLINE } from './render/outline.js';
import { applyChromaFx, tickChroma } from './chroma-fx.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { recolorImage } from '../systems/palette.js';
import { buildArena } from './arena.js';
import { Match } from './match.js';
import { Animator } from './animation/animator.js';
import { cloneModel, applyChroma } from './mirror.js';
import { mirrorSpec } from '../systems/mirror-spec.js';
import { MenuBackdrop } from './menu-backdrop.js';

const QUALITY = {
  low: { dpr: 1, shadows: false, particles: 120, post: false, msaa: 0 },
  medium: { dpr: 1.5, shadows: true, particles: 300, post: true, msaa: 0 },
  high: { dpr: 2, shadows: true, particles: 600, post: true, msaa: 4 }
};
const REGION = { x: 7, y: 6, z0: -6, z1: 3 };
const MAXP = 600;
const ease = t => 1 - Math.pow(1 - t, 3);
const SHOW = { x: 0, y: 0, vx: 0, vy: 0, facing: 1, air: false, crouch: 0, jumpV: 14, walk: 5, stun: 0, meter: 0 }; // estado sintético del menú

const canvasTex = (w, h, draw) => {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
};
const glowTex = () => canvasTex(64, 64, (x) => {
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.4, 'rgba(255,255,255,.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
});
const skyTex = () => canvasTex(4, 256, (x, w, h) => {
  const g = x.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#04070f'); g.addColorStop(.55, '#0d1936'); g.addColorStop(1, '#1b2d5c');
  x.fillStyle = g; x.fillRect(0, 0, w, h);
});
const runeTex = () => canvasTex(512, 512, (x, s) => {
  x.translate(s / 2, s / 2); x.strokeStyle = '#fff'; x.lineWidth = 3;
  for (const r of [240, 215, 150]) { x.beginPath(); x.arc(0, 0, r, 0, 7); x.stroke(); }
  x.lineWidth = 2;
  for (let i = 0; i < 2; i++) { x.rotate(Math.PI / 4); x.strokeRect(-150, -150, 300, 300); }
  for (let i = 0; i < 48; i++) { x.rotate(Math.PI / 24); x.beginPath(); x.moveTo(215, 0); x.lineTo(i % 4 ? 228 : 242, 0); x.stroke(); }
});
const toonGradient = (() => {
  // dos tonos limpios (luz / sombra) con un escalón intermedio estrecho: el sombreado de anime de los juegos de lucha
  const t = new THREE.DataTexture(new Uint8Array([150, 150, 150, 205, 255, 255, 255, 255]), 8, 1, THREE.RedFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t;
})();

function toToon(root) {
  root.traverse(o => {
    if (!o.isMesh) return;
    o.castShadow = true; o.frustumCulled = false;
    const conv = m => {
      const n = new THREE.MeshToonMaterial({ map: m.map, color: m.color, gradientMap: toonGradient, side: m.side, transparent: m.transparent, alphaTest: m.transparent ? 0.4 : 0 });
      n.name = m.name; n.userData.charMat = true; m.dispose(); return n; // charMat: material del guerrero (los chromas premium lo usan)
    };
    o.material = Array.isArray(o.material) ? o.material.map(conv) : conv(o.material);
  });
}
// Marcador provisional visible (no se hace pasar por un modelo definitivo)
function placeholder(def) {
  const g = new THREE.Group();
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(.5, 1.6, 6, 12), new THREE.MeshBasicMaterial({ color: def.fx.color, wireframe: true }));
  m.position.y = 1.3; g.add(m); g.userData.placeholder = true; return g;
}

export class SceneManager {
  constructor(canvas, settings) {
    this.canvas = canvas; this.time = 0; this.loadErrors = []; this.chars = new Map(); this.mirrors = new Map(); this.mirrorData = null; this.active = null; this.fx = null;
    this.tint = { light: new THREE.Color('#47b3ff'), color: new THREE.Color('#47b3ff') };
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    const r = this.renderer;
    r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.05;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    this.post = new PostFX(r); // aspecto anime: resplandor, gradación, destellos y congelado de técnica (render/post.js)
    this.scene = new THREE.Scene();
    this.scene.background = skyTex(); this.scene.fog = new THREE.FogExp2(0x0a1226, .03);
    this.camera = new THREE.PerspectiveCamera(32, 1, .1, 100);
    this.clock = new THREE.Clock();
    this.stage = new THREE.Group(); this.scene.add(this.stage);
    this.backdrop = new THREE.Group(); this.scene.add(this.backdrop); this.match = null; this.arena = null;
    this._buildStage(); this._buildLights(); this._buildParticles();
    this.themeBg = new MenuBackdrop(this.stage); // (v1.9) santuario animado del elemento detrás del guerrero
    this.q = QUALITY[settings.quality]; this.reduce = settings.reduceMotion;
    addEventListener('resize', () => this.resize());
    this.apply(settings);
  }

  _buildStage() {
    const stone = new THREE.MeshStandardMaterial({ color: 0x1a2236, roughness: .85, flatShading: true });
    const plat = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.5, .5, 48), stone);
    plat.position.y = -.25; plat.receiveShadow = true; this.stage.add(plat);
    this.rune = new THREE.Mesh(new THREE.CircleGeometry(3.1, 64), new THREE.MeshBasicMaterial({ map: runeTex(), transparent: true, depthWrite: false, opacity: .8 }));
    this.rune.rotation.x = -Math.PI / 2; this.rune.position.y = .012; this.stage.add(this.rune);
    this.halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), transparent: true, opacity: .4, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    this.halo.scale.setScalar(11); this.halo.position.set(0, 2.3, -3); this.stage.add(this.halo);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), new THREE.MeshStandardMaterial({ color: 0x0a1020, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -.55; this.backdrop.add(ground);
    const ruin = new THREE.MeshStandardMaterial({ color: 0x1b2740, roughness: .9, flatShading: true });
    for (let i = 0; i < 10; i++) {
      const a = (-80 + i * 17.7) * Math.PI / 180, h = 4 + Math.random() * 5;
      const p = new THREE.Mesh(new THREE.CylinderGeometry(.55, .7, h, 8), ruin);
      p.position.set(Math.sin(a) * 13, h / 2 - .55, -Math.cos(a) * 13 - 2); this.backdrop.add(p);
    }
    const rockGeo = new THREE.DodecahedronGeometry(.5, 0);
    this.rocks = [];
    for (let i = 0; i < 14; i++) {
      const r = new THREE.Mesh(rockGeo, ruin), s = .4 + Math.random() * 1.1;
      r.scale.setScalar(s); r.position.set((Math.random() * 2 - 1) * 12, 2 + Math.random() * 6, -4 - Math.random() * 9);
      r.userData = { y: r.position.y, ph: Math.random() * 6.28 }; this.backdrop.add(r); this.rocks.push(r);
    }
  }

  _buildLights() {
    this.scene.add(new THREE.HemisphereLight(0x9fb4ff, 0x2a2230, .85));
    this.key = new THREE.DirectionalLight(0xfff1d6, 1.85); this.key.position.set(-4, 7, 6);
    Object.assign(this.key.shadow.camera, { left: -5, right: 5, top: 6, bottom: -2 }); this.key.shadow.mapSize.set(1024, 1024); this.key.shadow.bias = -.0005;
    this.rim = new THREE.DirectionalLight(0x47b3ff, 2.5); this.rim.position.set(5, 4, -6);
    this.under = new THREE.PointLight(0x47b3ff, 8, 10, 2); this.under.position.set(0, .4, 1.5);
    this.scene.add(this.key, this.rim); this.stage.add(this.under);
  }

  _buildParticles() {
    const pos = new Float32Array(MAXP * 3); this.seeds = new Float32Array(MAXP);
    for (let i = 0; i < MAXP; i++) {
      pos[i * 3] = (Math.random() * 2 - 1) * REGION.x; pos[i * 3 + 1] = Math.random() * REGION.y;
      pos[i * 3 + 2] = REGION.z0 + Math.random() * (REGION.z1 - REGION.z0); this.seeds[i] = Math.random();
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.pts = new THREE.Points(geo, new THREE.PointsMaterial({ map: glowTex(), size: .1, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.pts.frustumCulled = false; this.scene.add(this.pts);
  }

  apply(s) {
    // (F9) la calidad elige la base y cada ajuste fino puede sobrescribirla (resolución, sombras, partículas, posprocesado)
    const q = { ...QUALITY[s.quality] };
    if (s.shadows === 'on' || s.shadows === 'off') q.shadows = s.shadows === 'on';
    if (s.particles && s.particles !== 'auto') q.particles = { low: 120, medium: 300, high: 600 }[s.particles] ?? q.particles;
    if (s.post === 'on' || s.post === 'off') q.post = s.post === 'on';
    q.res = (s.res || 100) / 100; this.outlines = s.outlines !== false;
    this.q = q; this.reduce = s.reduceMotion; this._prOverride = null; if (this._ad) this._ad.pr = null; for (const c of [...(this.chars?.values() ?? []), ...(this.mirrors?.values() ?? [])]) c.anim?.setReduce(this.reduce);
    this.renderer.shadowMap.enabled = this.q.shadows; this.key.castShadow = this.q.shadows; this.post.setQuality(this.q);
    this.pts.geometry.setDrawRange(0, this.q.particles);
    this.scene.traverse(o => { if (o.material && !Array.isArray(o.material)) o.material.needsUpdate = true; });
    this.syncOutlines();
    this.resize();
  }

  // (F9) contornos de tinta: se ocultan o muestran todos (guerreros, espejos y armas)
  syncOutlines() { const on = this.outlines !== false; this.scene.traverse(o => { if (o.userData?.outline && (o.isMesh || o.isSkinnedMesh)) o.visible = on; }); }

  resize() {
    const w = this.canvas.clientWidth || innerWidth, h = this.canvas.clientHeight || innerHeight;
    this.renderer.setPixelRatio(Math.max(.35, Math.min(devicePixelRatio, this.q.dpr, this._prOverride ?? 9) * (this.q.res || 1))); this.renderer.setSize(w, h, false); // (F9) resolución de renderizado
    const pr = this.renderer.getPixelRatio(); this.post.setSize(w * pr, h * pr); OUTLINE.uRes.value.set(w * pr, h * pr); OUTLINE.uW.value = Math.max(1, 1.45 * pr * Math.min(1.25, h / 720));
    const aspect = w / h; this.camera.aspect = aspect;
    if (aspect > 1.15) { // horizontal: el guerrero queda centrado en el hueco libre a la derecha del panel del menú
      this.camera.position.set(0, 2, 9.5); this.look = new THREE.Vector3(0, 1.7, 0);
      const halfW = 9.5 * Math.tan(THREE.MathUtils.degToRad(16)) * aspect, left = globalThis.document?.querySelector?.('.left'), menuOn = left && !document.getElementById('menu')?.hidden;
      const x0 = menuOn ? Math.min(.72, Math.max(.2, left.getBoundingClientRect().right / w)) : .3;
      this.stage.position.x = ((x0 + 1) / 2 * 2 - 1) * halfW; this.freeW = (1 - x0) * 2 * halfW;
      this.pairScale = Math.max(.55, Math.min(.95, this.freeW / 5.2));
    } else { // vertical: el guerrero queda arriba del panel
      this.camera.position.set(0, 2.4, 17); this.look = new THREE.Vector3(0, .5, 0); this.stage.position.x = 0;
    }
    this.camera.lookAt(this.look); this.camera.updateProjectionMatrix();
  }

  async loadCharacters(defs, onStep) {
    const loader = new GLTFLoader(), failed = []; let done = 0;
    await Promise.all(defs.map(async d => {
      let g = null;
      try { g = await loader.loadAsync(d.model); }
      catch (e) { console.error(`[assets] No se pudo cargar ${d.model}. Comprueba que el archivo existe y que usas un servidor local (npm start).`, e); failed.push(d.id); this.loadErrors.push(`${d.id}: ${e?.message || e}`); this._register(d, placeholder(d), true); }
      if (g) {
        try { this._register(d, g.scene, false); }
        catch (e) { // el modelo cargó pero un extra (contorno, copia espejo…) falló en este navegador: se registra en modo seguro
          console.error(`[assets] ${d.id}: preparación completa fallida, se usa el modo seguro`, e); this.loadErrors.push(`${d.id}: ${e?.message || e}`);
          try { this.chars.delete(d.id); this._register(d, g.scene, false, true); }
          catch (e2) { console.error(`[assets] ${d.id}: tampoco en modo seguro`, e2); failed.push(d.id); this._register(d, placeholder(d), true); }
        }
      }
      onStep?.(++done, defs.length, failed);
    }));
    return failed;
  }

  _register(d, root, isPlaceholder, safe = false) {
    if (!isPlaceholder) toToon(root);
    if (!isPlaceholder && !safe) addOutlines(root); // contorno de tinta (estilo anime); se clona con el modelo para el espejo
    root.updateMatrixWorld(true);
    const b1 = new THREE.Box3().setFromObject(root, true);
    root.scale.multiplyScalar(d.height / ((b1.max.y - b1.min.y) || 1)); root.updateMatrixWorld(true);
    const b2 = new THREE.Box3().setFromObject(root, true), c = b2.getCenter(new THREE.Vector3());
    root.position.set(root.position.x - c.x, root.position.y - b2.min.y, root.position.z - c.z);
    let src = null; // copia intacta (sin poses ni armas) para crear el guerrero espejo cuando se necesite
    if (!isPlaceholder) try { src = cloneModel(root); } catch (e) { console.warn(`[espejo] ${d.id}: no se pudo preparar la copia`, e); }
    const holder = new THREE.Group(); holder.add(root); holder.rotation.y = d.yaw || 0; holder.visible = false; this.stage.add(holder);
    let anim = null;
    if (!isPlaceholder) {
      try { anim = new Animator(root, holder, d.id, { facing: -1 }); anim.setReduce(this.reduce); }
      catch (e) { console.error(`[anim] ${d.id}: no se pudo crear el esqueleto animado`, e); }
    }
    this.chars.set(d.id, { def: d, holder, anim, t0: 0, intro: null, src, placeholder: isPlaceholder });
  }

  // Paleta alternativa (objeto de data/items.json) o null = original. Recolorea colores concretos de la textura:
  // la piel y el cabello no cambian; en la cabeza solo se tocan ojos y la flecha. También cambia el color del aura/partículas.
  setPalette(id, pal) {
    const c = this.chars.get(id); if (!c) return;
    c.holder.traverse(o => {
      if (!o.isMesh || o.userData.outline) return;
      for (const m of [].concat(o.material)) {
        if (!m.map) continue;
        const og = (m.userData.orig ??= m.map), cache = (m.userData.cache ??= {});
        const isHead = /head|face|eye/i.test(m.name || ''), use = pal && (!isHead || pal.slots);
        if (use && !cache[pal.id]) {
          const cv = recolorImage(og.image, pal, id, isHead ? ['eyes', 'arrow', 'band', 'bandGold', 'pom'] : null);
          if (cv) { const tx = new THREE.CanvasTexture(cv); Object.assign(tx, { flipY: og.flipY, colorSpace: og.colorSpace, wrapS: og.wrapS, wrapT: og.wrapT, anisotropy: og.anisotropy }); cache[pal.id] = tx; }
        }
        m.map = (use && cache[pal.id]) || og; m.needsUpdate = true;
      }
    });
    c.fx = pal?.fx ? { ...c.def.fx, ...pal.fx } : null;
    c.pal = pal || null; try { applyChromaFx(c.holder, pal); } catch (e) { console.warn('[chroma]', id, e); }
    if (this.active === c) this._tintFx(c);
  }

  _tintFx(c) { const f = c.fx ?? c.def.fx; this.fx = f; this.tint.light.set(f.light); this.tint.color.set(f.color); this.pts.material.size = f.size; try { this.onTint?.(f, c.def); } catch (e) { console.warn('[menú] tinte', e); } }

  // Versus: muestra a los dos elegidos (el segundo es el espejo si es el mismo guerrero). null/undefined = vuelve a uno solo.
  showPair(a, b, { quiet = false } = {}) {
    if (!a || !b) return this.clearPair();
    const A = this.chars.get(a), B = a === b ? this.mirror(b) : this.chars.get(b); if (!A || !B) return;
    const prev = this.pair; if (prev && prev[0] === A && prev[1] === B) return;
    if (prev) for (const p of prev) if (p !== A && p !== B) this._rest(p);
    if (this.active) this.active.holder.visible = false;
    for (const p of [A, B]) { if (!prev?.includes(p)) { p.t0 = this.time; if (p.anim) { p.anim.reset(); p.intro = this.reduce || (quiet && p === B) ? null : { name: 'intro', t: 0 }; } } p.holder.visible = true; }
    this.pair = [A, B]; this._tintFx(A);
  }
  clearPair() { if (!this.pair) return; for (const p of this.pair) this._rest(p); this.pair = null; if (this.active) { this.active.holder.visible = true; this._tintFx(this.active); } }
  _rest(p) { p.holder.visible = false; p.holder.position.set(0, 0, 0); p.holder.scale.setScalar(1); p.holder.rotation.y = p.def.yaw || 0; }

  show(id) {
    const c = this.chars.get(id); if (!c || c === this.active) return;
    if (this.active) this.active.holder.visible = false;
    this.active = c; c.holder.visible = !this.pair; c.t0 = this.time; if (!this.pair) this._tintFx(c);
    if (c.anim) { c.anim.reset(); c.intro = this.reduce ? null : { name: 'intro', t: 0 }; } // al elegirlo hace su presentación
    this.themeBg?.set(c.def); this.onShow?.(c.def);
  }

  // Anima al guerrero del menú: reposo con su personalidad + gesto de presentación al elegirlo.
  animate(c, dt) {
    if (!c.anim) return;
    c.anim.setReduce(this.reduce);
    if (c.intro) { c.intro.t += dt; if (c.intro.t >= (c.anim.dir.clips.intro?.dur || 1) * c.anim.S.atkSpeed) c.intro = null; }
    c.anim.update(dt, SHOW, { yaw: c.def.yaw || 0, action: c.intro });
  }

  // Guerrero ESPEJO: segunda instancia animada e independiente del mismo personaje, con su chroma (data/mirror.json).
  // Se crea la primera vez que se pide y se reutiliza. Sirve para cualquier modelo con esqueleto (también los futuros).
  mirror(id) {
    if (this.mirrors.has(id)) return this.mirrors.get(id);
    const c = this.chars.get(id); if (!c) return null;
    const d = c.def, spec = mirrorSpec(d, this.mirrorData);
    const root = c.src ? cloneModel(c.src) : placeholder({ ...d, fx: spec.fx });
    const holder = new THREE.Group(); holder.add(root); holder.rotation.y = d.yaw || 0; holder.visible = false; this.stage.add(holder);
    let anim = null;
    if (c.src) { try { anim = new Animator(root, holder, d.id, { facing: -1 }); anim.setReduce(this.reduce); } catch (e) { console.error(`[espejo] ${d.id}: sin esqueleto animado`, e); } }
    applyChroma(holder, spec); // después de crear las armas: también se tiñen
    // (v1.7) el espejo lleva además su propio efecto de material y su estilo de técnicas (data/mirror.json → chroma, vfx)
    const pal = spec.chroma ? { id: 'mirror_' + d.id, fx: spec.fx, chroma: spec.chroma, vfx: spec.vfx } : null;
    if (pal) try { applyChromaFx(holder, pal); } catch (e) { console.warn('[espejo] chroma', e); }
    const m = { def: d, holder, anim, t0: 0, intro: null, fx: spec.fx, mirror: spec, pal };
    this.mirrors.set(id, m); return m;
  }

  startMatch(id1, id2, input, opts) {
    const a = this.chars.get(id1), b = id1 === id2 ? this.mirror(id2) : this.chars.get(id2);
    if (!a || !b) throw new Error(`Combate inválido: ${id1} vs ${id2}`);
    this.clearPair(); this.endMatch();
    this.arena = buildArena((a.fx ?? a.def.fx).color); this.scene.add(this.arena.group);
    this.saved = { bg: this.scene.background, fog: [this.scene.fog.density, this.scene.fog.color.getHex()] };
    this.scene.background = this.arena.sky; this.scene.fog.density = .012; this.scene.fog.color.set(0x1d1a3a);
    for (const o of [this.stage, this.pts, this.backdrop]) o.visible = false;
    Object.assign(this.key.shadow.camera, { left: -13, right: 13, top: 7, bottom: -3 }); this.key.shadow.camera.updateProjectionMatrix();
    this.tint.light.set((a.fx ?? a.def.fx).light); this.tint.color.set((a.fx ?? a.def.fx).color);
    this.match = new Match(this, input, a, b, opts);
    if (this.outlines === false) this.syncOutlines();
  }

  endMatch() {
    if (!this.match) return;
    this.match.dispose(); this.match = null; this.arena.dispose(); this.arena = null;
    this.scene.background = this.saved.bg; this.scene.fog.density = this.saved.fog[0]; this.scene.fog.color.setHex(this.saved.fog[1]);
    for (const o of [this.stage, this.pts, this.backdrop]) o.visible = true;
    Object.assign(this.key.shadow.camera, { left: -5, right: 5, top: 6, bottom: -2 }); this.key.shadow.camera.updateProjectionMatrix();
    const id = this.active?.def.id; this.active = null; if (id) this.show(id); this.resize();
  }

  start() { this.renderer.setAnimationLoop(() => this._frame()); }

  _frame() {
    const raw = this.clock.getDelta(), dt = Math.min(raw, .1); this.time += dt; this._adapt(raw); tickChroma(dt);
    const k = 1 - Math.exp(-dt * 5), t = this.time;
    this.rim.color.lerp(this.tint.light, k); this.under.color.lerp(this.tint.light, k);
    this.halo.material.color.lerp(this.tint.light, k); this.pts.material.color.lerp(this.tint.color, k);
    this.rune.material.color.lerp(this.tint.color, k);
    if (this.match) {
      if (!this.match.paused) { // un error en un fotograma no debe congelar el juego para siempre: se informa (una vez) y se sigue
        try { this.match.update(dt, this.camera); this.arena?.update(t, dt, this.reduce); }
        catch (e) { if (!this._errShown) { this._errShown = true; console.error('[combate] error en un fotograma; el juego continúa', e); } }
      }
      this.post.update(dt); this.post.render(this.scene, this.camera); return;
    }
    const m = this.reduce ? .2 : 1;
    this.rune.rotation.z += dt * .15 * m;
    for (const r of this.rocks) { r.position.y = r.userData.y + Math.sin(t * .5 * m + r.userData.ph) * .25; r.rotation.y += dt * .1 * m; }
    this._particles(dt * m, t);
    try { this.themeBg?.update(dt, t, this.reduce, this.tint); } catch (e) { console.warn('[menú] fondo', e); this.themeBg = null; }
    const c = this.active;
    if (this.pair) { // selección de Versus: los dos guerreros frente a frente
      this.pair.forEach((p, i) => { const a = ease(Math.min((t - p.t0) / .45, 1)), s = i ? 1 : -1;
        const sc = this.cineCam ? .86 : (this.pairScale ?? .86), gap = this.cineCam ? 1.55 : 1.3 * sc / .86; // Versus: más juntos y del tamaño del hueco libre
        p.holder.position.set(s * (gap + (1 - a) * 1.2), 0, -.2); p.holder.scale.setScalar(sc); p.holder.rotation.y = -s * .78; this.animate(p, dt); });
    } else if (c) {
      const a = ease(Math.min((t - c.t0) / .5, 1));
      c.holder.scale.setScalar(.92 + .08 * a); c.holder.position.y = (1 - a) * -.35;
      this.animate(c, dt);
    }
    if (this.cineCam) { try { this.cineCam(dt, this.camera); } catch (e) { console.warn('[cine]', e); this.cineCam = null; } } // cinemáticas del menú (historia, vista previa)
    this.post.update(dt); this.post.render(this.scene, this.camera);
  }

  // Resolución dinámica: la fluidez es lo primero. Si el equipo no llega a ~50 fps baja la resolución interna
  // (hasta 0,6×) y, si aun así no llega, apaga el resplandor; cuando sobra potencia vuelve a subirla.
  _adapt(raw) {
    if (!(raw > 0) || raw > .5) return; const A = this._ad ||= { t: 0, n: 0, sum: 0, pr: null, lite: false };
    A.t += raw; A.n++; A.sum += raw; if (A.t < 1.5) return;
    const ft = A.sum / A.n; A.t = 0; A.n = 0; A.sum = 0;
    const max = Math.min(devicePixelRatio, this.q.dpr), cur = A.pr ?? max;
    let pr = cur;
    if (ft > 1 / 48) pr = Math.max(.6, cur - .25); else if (ft < 1 / 58 && cur < max) pr = Math.min(max, cur + .25);
    if (ft > 1 / 40 && cur <= .6 && !A.lite) { A.lite = true; this.post.lite = true; }
    if (ft < 1 / 58 && A.lite && pr >= max) { A.lite = false; this.post.lite = false; }
    if (pr !== cur) { A.pr = pr; this._prOverride = pr; this.resize(); }
  }

  _particles(dt, t) {
    const f = this.fx; if (!f) return;
    const p = this.pts.geometry.attributes.position, a = p.array;
    for (let i = 0; i < this.q.particles; i++) {
      const s = this.seeds[i], j = i * 3;
      a[j + 1] += f.rise * dt * (.5 + s);
      a[j] += (Math.sin(t * 1.3 + s * 40) * f.sway * .4 + f.drift) * dt;
      if (a[j + 1] > REGION.y || a[j] > REGION.x || a[j] < -REGION.x) { a[j] = (Math.random() * 2 - 1) * REGION.x; a[j + 1] = Math.random() * .5; }
    }
    p.needsUpdate = true;
  }
}
