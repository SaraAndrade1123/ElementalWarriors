import * as THREE from 'three';

// CONTORNO DE TINTA (casco invertido) para el aspecto de anime 3D de los juegos de lucha (Guilty Gear):
// cada malla recibe una copia que comparte geometría (y esqueleto, si es animada), con caras traseras y un
// sombreador que la ensancha en PÍXELES de pantalla. Grosor constante a cualquier distancia; funciona con
// cualquier modelo (no depende del guerrero). Los mechones con transparencia recortan el contorno con su textura.
export const OUTLINE = { uRes: { value: new THREE.Vector2(1280, 720) }, uW: { value: 2.2 } };
const INK = new THREE.Color(0x3a2a34);
export const OUTLINE_INK = INK;

function outlineMaterial(src, color) {
  // tinta del color de la propia textura, muy oscurecida (como el contorno de color de Guilty Gear), no negro puro
  const m = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide, map: src.map || null, fog: true });
  m.userData.outline = true;
  m.onBeforeCompile = sh => {
    sh.uniforms.uRes = OUTLINE.uRes; sh.uniforms.uW = OUTLINE.uW;
    sh.vertexShader = 'uniform vec2 uRes; uniform float uW;\n' + sh.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
      vec3 oN = normal;
      #ifdef USE_SKINNING
        oN = objectNormal;
      #endif
      vec4 cn = projectionMatrix * vec4(normalize(normalMatrix * oN), 0.0);
      vec2 dir = cn.xy * uRes; float L = length(dir);
      if (L > 1e-5) gl_Position.xy += dir / L / uRes * 2.0 * uW * gl_Position.w;`);
  };
  m.customProgramCacheKey = () => 'ew-outline-' + (m.map ? 'm' : 'n');
  return m;
}

// root: modelo; color: tinta (por defecto casi negro violáceo). Devuelve cuántas mallas recibieron contorno.
export function addOutlines(root, color = INK) {
  const list = []; root.traverse(o => { if ((o.isMesh || o.isSkinnedMesh) && !o.userData.outline && !o.userData.noOutline && [].concat(o.material).every(m => m.toneMapped !== false && !(m.blending > 1) && !m.transparent && !(m.alphaTest > 0))) list.push(o); }); // los brillos (sin tono) no llevan contorno
  for (const o of list) {
    const mats = [].concat(o.material).map(m => outlineMaterial(m, color)), mat = Array.isArray(o.material) ? mats : mats[0];
    let c;
    if (o.isSkinnedMesh) { c = new THREE.SkinnedMesh(o.geometry, mat); c.bind(o.skeleton, o.bindMatrix); c.bindMode = o.bindMode; }
    else c = new THREE.Mesh(o.geometry, mat);
    c.position.copy(o.position); c.quaternion.copy(o.quaternion); c.scale.copy(o.scale);
    c.userData.outline = true; c.castShadow = false; c.receiveShadow = false; c.frustumCulled = false; c.renderOrder = o.renderOrder;
    o.parent.add(c);
  }
  return list.length;
}
