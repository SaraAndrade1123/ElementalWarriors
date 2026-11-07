import * as THREE from 'three';
import { OUTLINE_INK } from './render/outline.js';

// CHROMAS PREMIUM (v1.7): además de recolorear la ropa, cada chroma trae un MATERIAL propio dibujado por sombreador sobre
// el modelo (sirve para cualquier personaje). Cada efecto cambia la tela de una forma distinta —no son el mismo brillo
// con otro color—: unos tiñen y oscurecen la tela, otros dibujan un patrón (escamas, facetas, circuitos…) y otros añaden
// luz que se mueve. El patrón va pegado al cuerpo (no «resbala» al caminar). La piel y la cabeza (pelo, cara) no se tocan:
// solo reciben el contorno luminoso.
//   ember   llamas que suben por la ropa              gold     pan de oro con un destello que recorre el cuerpo
//   galaxy  la tela se vuelve cielo nocturno           pulse    tatuajes que laten (Avatar)
//   storm   relámpagos que cruzan la tela              crystal  facetas de cristal con aristas brillantes
//   lava    roca oscura con grietas incandescentes     neon     cuadrícula de neón que se desplaza
//   caustic luz de agua profunda (cáusticas)           holo     holograma iridiscente con líneas de barrido
//   scales  escamas de dragón con borde luminoso       aurora   cortinas de aurora que ondulan
//   frost   escarcha que trepa desde los pies          void     tela de sombra con humo de color
//   circuit circuitos con pulsos que viajan            sakura   pétalos que flotan sobre la tela
//   sand    dunas de arena que se desplazan            prism    iridiscencia de arcoíris
//   ink     tinta que se arremolina (sumi-e)
export const CHROMA_KINDS = { ember: 1, gold: 2, galaxy: 3, pulse: 4, storm: 5, crystal: 6, lava: 7, neon: 8, caustic: 9, holo: 10, scales: 11, aurora: 12,
  frost: 13, void: 14, circuit: 15, sakura: 16, sand: 17, prism: 18, ink: 19 };
const T = { value: 0 }; // tiempo compartido por todos los chromas
export const tickChroma = dt => { T.value += dt; };

const FN = `
float ewh1(float n){ return fract(sin(n) * 43758.5453); }
float ewh2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float ewh3(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float ewn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(ewh2(i), ewh2(i + vec2(1, 0)), f.x), mix(ewh2(i + vec2(0, 1)), ewh2(i + vec2(1, 1)), f.x), f.y); }
float ewf(vec2 p){ float s = 0., a = .5; for (int i = 0; i < 4; i++) { s += a * ewn(p); p = p * 2.02 + 3.1; a *= .5; } return s; }
vec3 ewhsv(float h, float s, float v){ vec3 k = clamp(abs(mod(h * 6. + vec3(0., 4., 2.), 6.) - 3.) - 1., 0., 1.); return v * mix(vec3(1.), k, s); }
vec2 ewvor(vec2 p){ vec2 i = floor(p), f = fract(p); float d1 = 8., d2 = 8.;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) { vec2 g = vec2(float(x), float(y)); vec2 o = vec2(ewh2(i + g), ewh2(i + g + 17.3));
    float d = length(g + o - f); if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d; }
  return vec2(d1, d2); }`;

const FRAG = `
{
  vec3 ewN = normalize(normal), ewV = normalize(vViewPosition);
  float ewFr = pow(1. - clamp(abs(dot(ewN, ewV)), 0., 1.), 2.3);
  vec3 ewB = diffuseColor.rgb; float ewL = dot(ewB, vec3(.299, .587, .114));
  float ecSkin = (ewB.r > ewB.g && ewB.g > ewB.b && ewB.r > .35 && (ewB.r - ewB.b) > .06 && (ewB.r - ewB.b) < .48 && (ewB.g - ewB.b) < .3) ? 1. : 0.;
  float ewK = (1. - ecSkin * .95) * (1. - ecHead) * ecAmt, t = ecT; vec3 P = ewLp;
  vec3 ewAdd = ecRim * ewFr * ecRimK * (1. - .7 * max(ecHead, ecSkin)), alb = ewB; const vec3 W = vec3(1.);
  if (ecKind == 1.) { // llamas
    float n = ewf(vec2(P.x * 3. + P.z * 2., P.y * 2.6 - t * 2.2)), h = clamp(1. - P.y / 2.4, 0., 1.);
    float fl = smoothstep(.42, .86, n * .8 + h * .42); alb *= 1. - .3 * ewK;
    ewAdd += (mix(ecG2, ecG, fl) + W * pow(fl, 5.) * .7) * fl * 1.5 * ewK;
  } else if (ecKind == 2.) { // pan de oro
    float g = smoothstep(.12, .7, ewL); alb = mix(alb, ecG * (.45 + .75 * pow(1. - abs(ewN.y), 2.)), .65 * g * ewK);
    float y = fract(P.y * .35 - t * .45 + P.x * .1), band = smoothstep(0., .05, y) * (1. - smoothstep(.05, .16, y));
    float sp = step(.994, ewh3(floor(P * 40.) + floor(t * 7.)));
    ewAdd += (ecG2 * band * 2.2 + W * sp * 3.) * ewK;
  } else if (ecKind == 3.) { // cielo nocturno
    float neb = ewf(P.xy * 1.5 + vec2(t * .05, P.z)); vec3 deep = mix(vec3(.015, .01, .05), mix(ecG2, ecG, neb) * .4, smoothstep(.35, .85, neb));
    alb = mix(alb, deep, .82 * ewK);
    vec3 c = floor(P * 32.); float h = ewh3(c), tw = step(.972, h) * (.45 + .55 * sin(t * 3.2 + h * 60.));
    ewAdd += ((h > .992 ? W : ecG) * tw * 2.8 + ecG * smoothstep(.6, .95, neb) * .35) * ewK;
  } else if (ecKind == 4.) { // tatuajes que laten
    float s = smoothstep(.6, .9, ewL), p = .5 + .5 * sin(t * 2.3), wv = .5 + .5 * sin(P.y * 7. - t * 5.);
    ewAdd += ecG * s * (.25 + .5 * p + .5 * wv) * ewK + ecG2 * ewFr * (.3 + .4 * p) * ecAmt;
  } else if (ecKind == 5.) { // relámpagos
    alb *= 1. - .25 * ewK; float n = abs(ewf(vec2(P.x * 4. + t * .35, P.y * 2.5 - t * .25)) - .5), ln = 1. - smoothstep(0., .022, n);
    float fl = step(.8, ewh1(floor(t * 9.) + floor(P.y * 2.)));
    ewAdd += ecG2 * ln * (.5 + fl * 3.) * ewK + ecG * ewFr * (.4 + fl * 2.) * ecAmt;
  } else if (ecKind == 6.) { // facetas de cristal
    vec2 v = ewvor(P.xy * 4.2 + P.z * 1.7); float e = 1. - smoothstep(0., .07, v.y - v.x), id = ewh2(floor(P.xy * 4.2 + P.z * 1.7 + v.x));
    alb = mix(alb, alb * (.65 + .7 * fract(v.x * 3.7)) * mix(W, ecG, .55), .75 * ewK);
    float gl = pow(max(0., sin(v.x * 18. + t * 2. + dot(ewN, ewV) * 7.)), 14.);
    ewAdd += (ecG2 * e * 1.5 + W * gl * 1.1) * ewK;
  } else if (ecKind == 7.) { // roca y lava
    alb = mix(alb, alb * .3, .7 * ewK * (1. - smoothstep(.35, .7, ewL)));
    float n = abs(ewf(P.xy * 2.3 + vec2(P.z, t * .15)) * 2. - 1.), cr = 1. - smoothstep(0., .07, n);
    ewAdd += mix(ecG2, ecG, cr) * cr * 3. * ewK * (.75 + .25 * sin(t * 3.1));
  } else if (ecKind == 8.) { // cuadrícula de neón
    alb *= 1. - .4 * ewK; float gx = abs(fract(P.x * 3.2 + P.z) - .5), gy = abs(fract(P.y * 3.2 - t * .6) - .5), ln = 1. - smoothstep(0., .035, min(gx, gy));
    float sc = smoothstep(.0, .04, fract(P.y * .5 - t * .5)) * (1. - smoothstep(.04, .12, fract(P.y * .5 - t * .5)));
    ewAdd += (mix(ecG, ecG2, .5 + .5 * sin(P.y * 2. + t)) * ln * 1.5 + ecG2 * sc * 1.2) * ewK;
  } else if (ecKind == 9.) { // cáusticas
    vec2 p = P.xy * 3. + vec2(P.z, 0.); float w = sin(p.x * 2. + sin(p.y * 1.7 + t * 1.3) * 1.5) + sin(p.y * 2.3 + sin(p.x * 1.3 - t) * 1.5);
    float c = 1. - smoothstep(0., .35, abs(w)); alb = mix(alb, alb * vec3(.7, .9, 1.15), .4 * ewK);
    ewAdd += (ecG * c * 1.4 + ecG2 * c * c * .8) * ewK + ecG2 * ewFr * .35 * ecAmt;
  } else if (ecKind == 10.) { // holograma
    float hu = fract(dot(ewN, ewV) * 1.4 + P.y * .3 + t * .1); vec3 ir = ewhsv(hu, .55, 1.);
    float sc = .5 + .5 * sin(P.y * 70. - t * 9.), bd = smoothstep(.9, 1., fract(P.y * .6 - t * .45)), fk = .85 + .15 * step(.5, ewh1(floor(t * 18.)));
    alb = mix(alb, mix(alb, ir * ecG, .45), ewK);
    ewAdd += (ir * (ewFr * .9 + bd * .8) * ecAmt + ecG * sc * .14 * ewK) * fk;
  } else if (ecKind == 11.) { // escamas
    vec2 q = vec2(P.x * 6. + P.z * 3., P.y * 8.); float row = floor(q.y); q.x += mod(row, 2.) * .5; vec2 f = fract(q) - vec2(.5, 0.);
    float d = length(f), e = smoothstep(.4, .5, d) * (1. - smoothstep(.5, .58, d));
    alb = mix(alb, alb * (.6 + .6 * (1. - d)) * mix(W, ecG, .35), .7 * ewK);
    ewAdd += ecG * e * (.6 + .4 * sin(t * 2. + row)) * ewK + ecG2 * ewFr * .55 * ecAmt;
  } else if (ecKind == 12.) { // aurora
    float x = P.x * 1.5 + P.z + ewf(vec2(P.y * .6, t * .2)) * 2.2, bd = pow(.5 + .5 * sin(x * 3. + t * .8), 6.);
    vec3 col = mix(ecG, ecG2, .5 + .5 * sin(P.y * 1.5 + t * .5)); alb = mix(alb, alb * .55, .45 * ewK);
    ewAdd += col * bd * (.4 + smoothstep(0., 1.6, P.y)) * 1.2 * ewK;
  } else if (ecKind == 13.) { // escarcha
    float fr = smoothstep(.42, .72, ewf(P.xy * 3.2 + P.z) + (1.3 - P.y) * .32);
    alb = mix(alb, mix(vec3(.86, .95, 1.), ecG, .3), fr * .78 * ewK);
    float sp = step(.992, ewh3(floor(P * 55.) + floor(t * 4.)));
    ewAdd += (W * sp * 2.6 * fr + ecG2 * fr * .14) * ewK + ecG * ewFr * .55 * ecAmt;
  } else if (ecKind == 14.) { // sombra con humo
    float sm = ewf(P.xy * 1.8 + vec2(P.z, -t * .55)); alb = mix(alb, vec3(.02, 0., .04), .86 * ewK);
    ewAdd += mix(ecG2, ecG, sm) * smoothstep(.45, .85, sm) * .95 * ewK + ecG * pow(ewFr, 1.1) * 1.7 * ecAmt;
  } else if (ecKind == 15.) { // circuitos
    vec2 q = P.xy * 5. + vec2(P.z * 2., 0.), c = floor(q), f = fract(q); float hz = step(.5, ewh2(c));
    float tr = hz > .5 ? 1. - smoothstep(0., .05, abs(f.y - .5)) : 1. - smoothstep(0., .05, abs(f.x - .5));
    float nd = 1. - smoothstep(.08, .14, length(f - .5)), pu = smoothstep(.82, 1., fract((hz > .5 ? q.x : q.y) * .25 - t * .8 + ewh2(c + 5.)));
    alb *= 1. - .35 * ewK; ewAdd += (ecG * (tr * .45 + nd * .8) + ecG2 * tr * pu * 2.6) * ewK;
  } else if (ecKind == 16.) { // pétalos
    vec2 q = P.xy * 3. + vec2(t * .15, -t * .25), c = floor(q), f = fract(q) - .5; float h = ewh2(c), a = h * 6.28;
    f = mat2(cos(a), -sin(a), sin(a), cos(a)) * f; float pe = (1. - smoothstep(.12, .17, length(f * vec2(1., 1.9)))) * step(.5, h);
    alb = mix(alb, mix(alb, ecG, .35), ewK); ewAdd += ecG * pe * 1.3 * ewK + ecG2 * ewFr * .45 * ecAmt;
  } else if (ecKind == 17.) { // dunas de arena
    float s = sin(P.y * 9. + ewf(P.xz * 2.) * 4. - t * 1.2), bd = smoothstep(.7, 1., s), gr = step(.965, ewh3(floor(P * 80.)));
    alb = mix(alb, alb * vec3(1.15, 1., .78), .35 * ewK); ewAdd += (ecG * bd * .55 + ecG2 * gr * .9) * ewK;
  } else if (ecKind == 18.) { // prisma
    float hu = fract(dot(ewN, ewV) * 1.2 + P.y * .25 + t * .08); vec3 ir = ewhsv(hu, .55, 1.);
    alb = mix(alb, alb * ir * 1.35, .6 * ewK * smoothstep(.2, .8, ewL));
    ewAdd += ir * ewFr * 1.2 * ecAmt + ir * pow(max(0., sin(P.y * 5. + t * 2.)), 20.) * .6 * ewK;
  } else if (ecKind == 19.) { // tinta
    vec2 q = P.xy * 1.4; q += vec2(ewf(q + t * .1), ewf(q - t * .12 + 4.)) * 1.6; float n = ewf(q * 1.3);
    float ik = smoothstep(.45, .56, n), ed = 1. - smoothstep(0., .045, abs(n - .5));
    alb = mix(alb, vec3(.03, .02, .05), ik * .85 * ewK); ewAdd += ecG * ed * 1.5 * ewK + ecG2 * ewFr * .45 * ecAmt;
  }
  diffuseColor.rgb = alb;
  totalEmissiveRadiance += ewAdd;
}`;

const CK = 'ew-chroma2';
// IMPORTANTE: Three.js reutiliza el programa ya compilado y se queda con los uniformes de la primera vez. Por eso cada
// material guarda SUS uniformes (userData.ewU) y al cambiar de chroma solo se actualizan sus valores. (Antes se creaban
// uniformes nuevos en cada cambio y todos los chromas se veían con el efecto del primero que se aplicó.)
function inject(m, vals, head) {
  const ud = m.userData;
  if (!ud.ewU) ud.ewU = { ecT: T, ecKind: { value: 0 }, ecAmt: { value: 1 }, ecRimK: { value: .7 }, ecHead: { value: head ? 1 : 0 }, ecRim: { value: new THREE.Color() }, ecG: { value: new THREE.Color() }, ecG2: { value: new THREE.Color() } };
  const U = ud.ewU; U.ecKind.value = vals.kind; U.ecAmt.value = vals.amt; U.ecRimK.value = vals.rimK; U.ecRim.value.copy(vals.rim); U.ecG.value.copy(vals.g); U.ecG2.value.copy(vals.g2);
  if (ud.ewChroma) return; // ya lleva el sombreador: basta con los valores nuevos
  ud.ewBase = { obc: m.onBeforeCompile, key: m.customProgramCacheKey }; // conserva el sombreador previo (p. ej. el del espejo)
  const prev = ud.ewBase.obc, pk = ud.ewBase.key;
  m.onBeforeCompile = (sh, r) => {
    prev?.call(m, sh, r);
    Object.assign(sh.uniforms, U);
    sh.vertexShader = 'varying vec3 ewLp;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n\tewLp = (modelMatrix * vec4(transformed, 1.0)).xyz - modelMatrix[3].xyz;');
    sh.fragmentShader = 'varying vec3 ewLp; uniform float ecT, ecKind, ecAmt, ecRimK, ecHead; uniform vec3 ecRim, ecG, ecG2;\n' + FN + '\n' +
      sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n' + FRAG);
  };
  const base = pk && pk !== THREE.Material.prototype.customProgramCacheKey ? pk : null;
  m.customProgramCacheKey = () => (base ? base.call(m) : '') + CK;
  m.needsUpdate = true;
}
const C = h => new THREE.Color(h || '#ffffff');
const isHead = m => /head|face|hair|eye/i.test(m.name || '');

// Aplica (o quita, con pal = null) el chroma premium a las mallas del guerrero.
export function applyChromaFx(holder, pal) {
  const ch = pal?.chroma, kind = ch ? CHROMA_KINDS[ch.kind] || 0 : 0;
  const vals = ch ? { kind, amt: ch.amount ?? 1, rimK: ch.rimK ?? .7, rim: C(ch.rim || pal.fx?.color), g: C(ch.glow || pal.fx?.color), g2: C(ch.glow2 || pal.fx?.light) } : null;
  holder.traverse(o => {
    if (!(o.isMesh || o.isSkinnedMesh)) return;
    for (const m of [].concat(o.material)) {
      if (m.userData.outline) { if (!m.userData.ewInk) m.userData.ewInk = m.color.clone(); m.color.copy(ch?.outline ? C(ch.outline) : m.userData.ewInk); continue; }
      if (!m.userData.charMat) continue;
      if (vals) { inject(m, vals, isHead(m)); m.userData.ewChroma = true; }
      else if (m.userData.ewChroma) { const b = m.userData.ewBase || {}; m.onBeforeCompile = b.obc || (() => {}); m.customProgramCacheKey = b.key || THREE.Material.prototype.customProgramCacheKey; m.needsUpdate = true; m.userData.ewChroma = false; }
    }
  });
  return !!vals;
}
export { OUTLINE_INK };
