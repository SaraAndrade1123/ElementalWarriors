import * as THREE from 'three';

// POSTPROCESO estilo anime de lucha (Guilty Gear / Mortal Kombat), sin dependencias externas:
//   escena HDR → resplandor (bloom) en 2 niveles → composición con gradación de color, viñeta,
//   aberración cromática en los impactos, destello de impacto, «congelado de técnica» (oscurece y dibuja líneas
//   de velocidad hacia quien la lanza) y fundido a negro/blanco. Al final, ACES + sRGB (como la salida normal).
// Calidad: baja = sin postproceso (render directo) · media = bloom a 1/2 · alta = bloom a 1/2 + MSAA 4.
const VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }';
const quad = new THREE.PlaneGeometry(2, 2);
const pass = (frag, uniforms, extra = {}) => new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false, toneMapped: false, ...extra });

const BRIGHT = `uniform sampler2D tSrc; uniform float uThr; varying vec2 vUv;
void main(){ vec3 c = texture2D(tSrc, vUv).rgb; float l = max(c.r, max(c.g, c.b)); float k = smoothstep(uThr, uThr + .6, l); gl_FragColor = vec4(c * k, 1.); }`;
const BLUR = `uniform sampler2D tSrc; uniform vec2 uDir; varying vec2 vUv;
void main(){ vec3 s = texture2D(tSrc, vUv).rgb * .2270;
  s += (texture2D(tSrc, vUv + uDir * 1.3846).rgb + texture2D(tSrc, vUv - uDir * 1.3846).rgb) * .3162;
  s += (texture2D(tSrc, vUv + uDir * 3.2308).rgb + texture2D(tSrc, vUv - uDir * 3.2308).rgb) * .0703;
  gl_FragColor = vec4(s, 1.); }`;
const COMPOSE = `uniform sampler2D tScene; uniform sampler2D tB1; uniform sampler2D tB2;
uniform float uBloom, uSat, uCon, uVig, uCA, uFlash, uInv, uSuper, uLines, uFade, uTime, uAspect; uniform vec3 uTint, uFlashC, uFadeC; uniform vec2 uCenter;
varying vec2 vUv;
float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main(){
  vec2 d = vUv - .5; float r = length(d * vec2(uAspect, 1.));
  vec2 off = d * uCA * .02;
  vec3 c = vec3(texture2D(tScene, vUv + off).r, texture2D(tScene, vUv).g, texture2D(tScene, vUv - off).b);
  vec3 b = texture2D(tB1, vUv).rgb * .6 + texture2D(tB2, vUv).rgb * .9;
  c += b * uBloom;
  // gradación: saturación, contraste y tinte del escenario
  float l = dot(c, vec3(.2126, .7152, .0722));
  c = mix(vec3(l), c, uSat); c = (c - .18) * uCon + .18; c *= uTint;
  // congelado de técnica: el fondo se oscurece y se tiñe; líneas de velocidad hacia el centro de la técnica
  if (uSuper > 0.) {
    float l2 = dot(c, vec3(.299, .587, .114)), keep = smoothstep(.55, 1.3, l2);
    c = mix(c, mix(c * .22 + vec3(.02, .01, .05), c, keep), uSuper);
  }
  if (uLines > 0.) {
    vec2 q = vUv - uCenter; q.x *= uAspect; float a = atan(q.y, q.x), rr = length(q);
    float n = h(vec2(floor(a * 90.), floor(uTime * 20.))); float line = step(.9, n) * smoothstep(.3, .85, rr);
    c = mix(c, vec3(1.), line * uLines * .4);
  }
  c *= mix(1., 1. - smoothstep(.45, 1.15, r), uVig);
  c = mix(c, uFlashC * 3., uFlash);
  c = mix(c, vec3(1.6) - c * 1.4, uInv);
  c = mix(c, uFadeC, uFade);
  gl_FragColor = vec4(max(c, 0.), 1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export class PostFX {
  constructor(renderer) {
    this.r = renderer; this.enabled = false; this.samples = 0; this.w = 1; this.h = 1; this.time = 0;
    const rt = (depth = false) => new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: depth });
    this.rtScene = rt(true); this.a1 = rt(); this.b1 = rt(); this.a2 = rt(); this.b2 = rt();
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1); this.mesh = new THREE.Mesh(quad); this.fs = new THREE.Scene(); this.fs.add(this.mesh); this.mesh.frustumCulled = false;
    this.mBright = pass(BRIGHT, { tSrc: { value: null }, uThr: { value: 1.35 } });
    this.mBlur = pass(BLUR, { tSrc: { value: null }, uDir: { value: new THREE.Vector2() } });
    this.U = { tScene: { value: null }, tB1: { value: null }, tB2: { value: null }, uBloom: { value: .85 }, uSat: { value: 1.12 }, uCon: { value: 1.06 }, uVig: { value: .55 },
      uCA: { value: 0 }, uFlash: { value: 0 }, uInv: { value: 0 }, uSuper: { value: 0 }, uLines: { value: 0 }, uFade: { value: 0 }, uTime: { value: 0 }, uAspect: { value: 1 },
      uTint: { value: new THREE.Color(1, 1, 1) }, uFlashC: { value: new THREE.Color(1, 1, 1) }, uFadeC: { value: new THREE.Color(0, 0, 0) }, uCenter: { value: new THREE.Vector2(.5, .5) } };
    this.mCompose = pass(COMPOSE, this.U); this.mCompose.toneMapped = true;
    // estado que se anima (los sistemas de combate escriben aquí; decae solo)
    this.fx = { flash: 0, inv: 0, ca: 0, super: 0, lines: 0, fade: 0 }; this.grade = { sat: 1.12, con: 1.06, tint: new THREE.Color(1, 1, 1), bloom: .85 };
  }
  setQuality(q) {
    this.enabled = !!q?.post; const s = q?.msaa || 0;
    if (s !== this.samples) { this.samples = s; this.rtScene.dispose(); this.rtScene = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: s }); this.setSize(this.w, this.h); }
  }
  setSize(w, h) {
    this.w = Math.max(1, w | 0); this.h = Math.max(1, h | 0);
    this.rtScene.setSize(this.w, this.h);
    const w2 = Math.max(1, this.w >> 2), h2 = Math.max(1, this.h >> 2), w4 = Math.max(1, this.w >> 4), h4 = Math.max(1, this.h >> 4); // resplandor a 1/4 y 1/16: barato y suave
    this.a1.setSize(w2, h2); this.b1.setSize(w2, h2); this.a2.setSize(w4, h4); this.b2.setSize(w4, h4);
    this.U.uAspect.value = this.w / this.h;
  }
  // Efectos puntuales (se suman y decaen): impact(k) destello · invert(k) fotograma de impacto · superFreeze(sec, center)
  impact(k = 1, color = 0xffffff) { this.fx.flash = Math.max(this.fx.flash, .22 * k); this.fx.ca = Math.max(this.fx.ca, 1.2 * k); this.U.uFlashC.value.set(color); }
  invertFrame(k = 1) { this.fx.inv = Math.max(this.fx.inv, .9 * k); }
  superFreeze(t = .5, center = null) { this.fx.super = 1; this.fx.lines = 1; this.superT = t; if (center) this.U.uCenter.value.copy(center); }
  update(dt) {
    const f = this.fx, k = Math.exp(-dt * 9);
    f.flash *= Math.exp(-dt * 14); f.ca *= k; f.inv *= Math.exp(-dt * 30);
    if (this.superT > 0) this.superT -= dt; else { f.super *= Math.exp(-dt * 7); f.lines *= Math.exp(-dt * 9); }
    this.time += dt;
  }
  _blit(mat, target) { this.mesh.material = mat; this.r.setRenderTarget(target); this.r.render(this.fs, this.cam); }
  render(scene, camera) {
    if (!this.enabled) { this.r.setRenderTarget(null); this.r.render(scene, camera); return; }
    if (this.lite && !(this.fx.super > .01 || this.fx.flash > .01 || this.fx.inv > .01 || this.fx.fade > .01)) { this.r.setRenderTarget(null); this.r.render(scene, camera); return; } // equipo lento: sin postproceso salvo en los momentos clave
    const r = this.r, U = this.U, f = this.fx, g = this.grade;
    r.setRenderTarget(this.rtScene); r.render(scene, camera);
    this.mBright.uniforms.tSrc.value = this.rtScene.texture; this._blit(this.mBright, this.a1);
    const blur = (src, dst, dx, dy, w, h) => { this.mBlur.uniforms.tSrc.value = src.texture; this.mBlur.uniforms.uDir.value.set(dx / w, dy / h); this._blit(this.mBlur, dst); };
    blur(this.a1, this.b1, 1, 0, this.a1.width, this.a1.height); blur(this.b1, this.a1, 0, 1, this.a1.width, this.a1.height);
    blur(this.a1, this.a2, 1, 0, this.a1.width, this.a1.height); blur(this.a2, this.b2, 1.5, 0, this.a2.width, this.a2.height); blur(this.b2, this.a2, 0, 1.5, this.a2.width, this.a2.height);
    U.tScene.value = this.rtScene.texture; U.tB1.value = this.a1.texture; U.tB2.value = this.a2.texture;
    U.uBloom.value = g.bloom; U.uSat.value = g.sat; U.uCon.value = g.con; U.uTint.value.copy(g.tint);
    U.uCA.value = f.ca; U.uFlash.value = Math.min(.8, f.flash); U.uInv.value = Math.min(1, f.inv); U.uSuper.value = Math.min(1, f.super); U.uLines.value = Math.min(1, f.lines); U.uFade.value = f.fade; U.uTime.value = this.time;
    this._blit(this.mCompose, null);
  }
  dispose() { for (const t of [this.rtScene, this.a1, this.b1, this.a2, this.b2]) t.dispose(); for (const m of [this.mBright, this.mBlur, this.mCompose]) m.dispose(); }
}
