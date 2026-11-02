import * as THREE from 'three';
import { OUTLINE_INK } from './render/outline.js';

// CHROMAS PREMIUM de la tienda: además de recolorear la ropa, cada paleta trae un efecto propio dibujado por sombreador
// sobre el modelo (funciona con cualquier personaje): contorno luminoso, y uno de estos efectos animados:
//   ember  llamas que suben por la ropa          gold    destello metálico que recorre el cuerpo
//   galaxy estrellas que titilan en la tela       pulse   las zonas claras brillan al ritmo de un latido (Avatar)
//   storm  relámpagos en el contorno             crystal facetas de cristal que destellan
//   lava   grietas incandescentes en lo oscuro   neon    franjas de neón que fluyen
// La piel no se toca. En combate, el chroma suelta además partículas de su color (aura) — ver fight-fx.js.
export const CHROMA_KINDS = { ember: 1, gold: 2, galaxy: 3, pulse: 4, storm: 5, crystal: 6, lava: 7, neon: 8 };
const T = { value: 0 }; // tiempo compartido por todos los chromas
export const tickChroma = dt => { T.value += dt; };

const FN = `
float ewh1(float n){ return fract(sin(n) * 43758.5453); }
float ewh3(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float ewn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  float a = fract(sin(dot(i, vec2(127.1, 311.7))) * 43758.5453), b = fract(sin(dot(i + vec2(1, 0), vec2(127.1, 311.7))) * 43758.5453);
  float c = fract(sin(dot(i + vec2(0, 1), vec2(127.1, 311.7))) * 43758.5453), d = fract(sin(dot(i + vec2(1, 1), vec2(127.1, 311.7))) * 43758.5453);
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y); }
float ewf(vec2 p){ float s = 0., a = .5; for (int i = 0; i < 4; i++) { s += a * ewn(p); p = p * 2.02 + 3.1; a *= .5; } return s; }`;
const FRAG = `
{
  vec3 ewN = normalize(normal), ewV = normalize(vViewPosition);
  float ewFr = pow(1. - clamp(abs(dot(ewN, ewV)), 0., 1.), 2.3);
  vec3 ewB = diffuseColor.rgb; float ewL = dot(ewB, vec3(.299, .587, .114));
  float ewSkin = (ewB.r > ewB.g && ewB.g > ewB.b && ewB.r > .35 && (ewB.r - ewB.b) > .06 && (ewB.r - ewB.b) < .48 && (ewB.g - ewB.b) < .3) ? 1. : 0.;
  float ewK = (1. - ewSkin * .9) * ewAmt, t = ewT; vec3 P = ewWp; vec3 ewAdd = ewRim * ewFr * ewRimK;
  if (ewKind == 1.) { float n = ewf(vec2(P.x * 2.6 + P.z * 2., P.y * 2.2 - t * 1.7)); ewAdd += mix(ewG2, ewG, smoothstep(.55, .8, n)) * smoothstep(.5, .78, n) * (1.1 - ewL) * 1.05 * ewK; }
  else if (ewKind == 2.) { float y = fract(P.y * .22 - t * .33 + P.x * .05); float band = smoothstep(0., .05, y) * (1. - smoothstep(.05, .13, y)); ewAdd += ewG * band * 2.4 * ewK + ewG2 * ewFr * .45 * ewAmt; }
  else if (ewKind == 3.) { vec3 c = floor(P * 26.); float h = ewh3(c); float tw = step(.982, h) * (.45 + .55 * sin(t * 4. + h * 60.)); ewAdd += (h > .991 ? ewG2 : ewG) * tw * 3.2 * ewK + ewG * ewFr * .3 * ewAmt; }
  else if (ewKind == 4.) { float p = .5 + .5 * sin(t * 2.3); ewAdd += ewG * smoothstep(.62, .9, ewL) * (.25 + .75 * p) * .9 * ewK + ewG2 * ewFr * (.3 + .4 * p) * ewAmt; }
  else if (ewKind == 5.) { float f = step(.9, ewh1(floor(t * 13.))); float vein = 1. - smoothstep(0., .06, abs(ewf(vec2(P.x * 3. + t * .5, P.y * 3.)) - .5)); ewAdd += ewG * ewFr * (.5 + f * 3.) * ewAmt + ewG2 * vein * (.25 + f * 1.6) * ewK; }
  else if (ewKind == 6.) { float n = ewf(P.xy * 5. + P.z * 3. + vec2(t * .1, 0.)); float fac = pow(smoothstep(.55, .8, n), 3.); ewAdd += ewG * fac * 2.6 * ewK * (.6 + .4 * sin(t * 3. + P.y * 4.)) + ewG2 * ewFr * .5 * ewAmt; }
  else if (ewKind == 7.) { float n = abs(ewf(P.xy * 2.3 + vec2(P.z, t * .15)) * 2. - 1.); float crack = 1. - smoothstep(0., .07, n); ewAdd += mix(ewG2, ewG, crack) * crack * (1. - smoothstep(.12, .45, ewL)) * 3. * ewK * (.75 + .25 * sin(t * 3.1)); }
  else if (ewKind == 8.) { float y = fract(P.y * 1.6 + P.x * .4 - t * .8); float line = smoothstep(.0, .04, y) * (1. - smoothstep(.04, .1, y)); ewAdd += mix(ewG, ewG2, .5 + .5 * sin(P.y * 3. + t)) * line * 1.8 * ewK + ewG * ewFr * .4 * ewAmt; }
  totalEmissiveRadiance += ewAdd;
}`;

function inject(m, U) {
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = 'varying vec3 ewWp;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n\tewWp = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = 'varying vec3 ewWp; uniform float ewT, ewKind, ewAmt, ewRimK; uniform vec3 ewRim, ewG, ewG2;\n' + FN + '\n' +
      sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n' + FRAG);
  };
  m.customProgramCacheKey = () => 'ew-chroma';
  m.needsUpdate = true;
}
const C = h => new THREE.Color(h || '#ffffff');

// Aplica (o quita, con pal = null) el chroma premium a las mallas del guerrero.
export function applyChromaFx(holder, pal) {
  const ch = pal?.chroma, kind = ch ? CHROMA_KINDS[ch.kind] || 0 : 0;
  const U = ch ? { ewT: T, ewKind: { value: kind }, ewAmt: { value: ch.amount ?? 1 }, ewRimK: { value: ch.rimK ?? .7 },
    ewRim: { value: C(ch.rim || pal.fx?.color) }, ewG: { value: C(ch.glow || pal.fx?.color) }, ewG2: { value: C(ch.glow2 || pal.fx?.light) } } : null;
  holder.traverse(o => {
    if (!(o.isMesh || o.isSkinnedMesh)) return;
    for (const m of [].concat(o.material)) {
      if (m.userData.outline) { m.color.copy(ch?.outline ? C(ch.outline) : OUTLINE_INK); continue; }
      if (!m.userData.charMat) continue;
      if (U) inject(m, U);
      else if (m.userData.ewChroma) { m.onBeforeCompile = () => {}; m.customProgramCacheKey = () => ''; m.needsUpdate = true; }
      m.userData.ewChroma = !!U;
    }
  });
  return !!U;
}
