import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';

// Chroma ESPEJO aplicado en el SOMBREADOR (no en la textura): gira el matiz, ajusta saturación y brillo, respeta los tonos
// de piel, tiñe metales/blancos y añade un contorno luminoso (fresnel). Funciona con cualquier modelo y cualquier
// número de materiales (también las armas procedurales), por eso sirve para personajes personalizados futuros.
const GLSL_FN = `
uniform float ewHue; uniform float ewSat; uniform float ewVal; uniform float ewSkin; uniform vec3 ewTint; uniform float ewTintK;
uniform vec3 ewRim; uniform float ewRimK; uniform float ewRimP;
vec3 ewRgb2hsv(vec3 c){ vec4 K = vec4(0., -1./3., 2./3., -1.); vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g)); vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r)); float d = q.x - min(q.w, q.y); float e = 1.0e-10; return vec3(abs(q.z + (q.w - q.y) / (6. * d + e)), d / (q.x + e), q.x); }
vec3 ewHsv2rgb(vec3 c){ vec3 p = abs(fract(c.xxx + vec3(1., 2./3., 1./3.)) * 6. - 3.); return c.z * mix(vec3(1.), clamp(p - 1., 0., 1.), c.y); }
vec3 ewChroma(vec3 lin){
  vec3 s = pow(max(lin, vec3(0.)), vec3(1. / 2.2)); vec3 h = ewRgb2hsv(s);
  float skin = ewSkin * (1. - smoothstep(.1, .14, h.x)) * smoothstep(.1, .22, h.y) * (1. - smoothstep(.62, .78, h.y)) * smoothstep(.22, .38, h.z);
  vec3 o = ewHsv2rgb(vec3(fract(h.x + ewHue), clamp(h.y * ewSat, 0., 1.), clamp(h.z * ewVal, 0., 1.)));
  o = mix(o, o * ewTint * 1.35, (1. - h.y) * ewTintK);
  return mix(pow(o, vec3(2.2)), lin, skin);
}`;
export function chromaMaterial(src, spec) {
  const m = src.clone(); if (src.userData?.orig) m.map = src.userData.orig; // nunca la textura de una paleta de la tienda
  m.userData = { ...src.userData, chroma: spec.id, cache: {} }; delete m.userData.orig;
  const U = {
    ewHue: { value: ((spec.hue % 360) + 360) % 360 / 360 }, ewSat: { value: spec.sat }, ewVal: { value: spec.val }, ewSkin: { value: spec.keepSkin ? 1 : 0 },
    ewTint: { value: new THREE.Color(spec.tint) }, ewTintK: { value: spec.tintAmount }, ewRim: { value: new THREE.Color(spec.rim) }, ewRimK: { value: spec.rimStrength }, ewRimP: { value: spec.rimPower },
  };
  const rim = /Toon|Standard|Physical|Phong|Lambert/.test(m.type);
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, U);
    sh.fragmentShader = sh.fragmentShader.replace('void main() {', GLSL_FN + '\nvoid main() {')
      .replace('#include <color_fragment>', '#include <color_fragment>\n\tdiffuseColor.rgb = ewChroma(diffuseColor.rgb);');
    if (rim && sh.fragmentShader.includes('#include <emissivemap_fragment>') && /vViewPosition/.test(sh.fragmentShader + sh.vertexShader))
      sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n\t{ float fr = pow(1. - clamp(abs(dot(normalize(normal), normalize(vViewPosition))), 0., 1.), ewRimP); totalEmissiveRadiance += ewRim * fr * ewRimK; }');
  };
  m.customProgramCacheKey = () => 'ew-mirror-' + (rim ? 'r' : 'n');
  m.needsUpdate = true; m.userData.ewUniforms = U;
  return m;
}
export function applyChroma(holder, spec) {
  const seen = new Map();
  holder.traverse(o => { if ((!o.isMesh && !o.isSkinnedMesh) || o.userData.outline) return; // el contorno de tinta se queda igual
    o.material = Array.isArray(o.material) ? o.material.map(x => seen.get(x) || seen.set(x, chromaMaterial(x, spec)).get(x)) : (seen.get(o.material) || seen.set(o.material, chromaMaterial(o.material, spec)).get(o.material)); });
  return seen.size;
}
export const cloneModel = root => cloneSkinned(root);
