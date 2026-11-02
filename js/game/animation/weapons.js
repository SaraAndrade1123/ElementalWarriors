import * as THREE from 'three';

// Armas procedurales (originales) de cada guerrero, ancladas a los huesos de la mano del esqueleto.
//   Ignis · espada de hoja ancha con filo incandescente (mano adelantada)
//   Aqua  · lanza de mareas con punta de cristal líquido (mano adelantada)
//   Terra · guanteletes de piedra con runas (las dos manos)
//   Zephyr· hojas gemelas en forma de media luna, agarre invertido (las dos manos)
// Cada arma expone anclas `base` y `tip` (para las estelas de los golpes).
// El lado «adelantado» (F) cambia al girarse el guerrero: se crean copias en ambas manos y se muestra la que toca.
const grad = (() => { const t = new THREE.DataTexture(new Uint8Array([90, 170, 255]), 3, 1, THREE.RedFormat); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t; })();
const toon = (color, o = {}) => new THREE.MeshToonMaterial({ color, gradientMap: grad, ...o });
const glow = color => new THREE.MeshBasicMaterial({ color, toneMapped: false });

function extrude(points, depth, bevel = .006) {
  const sh = new THREE.Shape(); points.forEach(([x, y], i) => i ? sh.lineTo(x, y) : sh.moveTo(x, y)); sh.closePath();
  const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1, curveSegments: 6 });
  g.translate(0, 0, -depth / 2); return g;
}
const anchor = (g, y, name) => { const o = new THREE.Object3D(); o.name = name; o.position.set(0, y, 0); g.add(o); return o; };

// Todas las piezas se construyen con la empuñadura en el origen y la hoja hacia +Y; la cara plana mira a ±Z.
function sword(c) {
  const g = new THREE.Group(), steel = toon(0x2a2a33), gold = toon(0xc9952e), L = 1.45;
  const blade = new THREE.Mesh(extrude([[-.075, .2], [.075, .2], [.085, 1.05], [.05, L - .1], [0, L], [-.06, L - .14], [-.08, .9]], .035), steel); g.add(blade);
  const edge = new THREE.Mesh(extrude([[.05, .26], [.085, .26], [.095, 1.05], [.058, L - .1], [.006, L - .015], [.03, L - .12], [.06, 1.05]], .045, 0), glow(c.edge)); g.add(edge);
  const fuller = new THREE.Mesh(extrude([[-.018, .26], [.012, .26], [.006, 1.0], [-.012, 1.0]], .05, 0), glow(c.core)); g.add(fuller);
  const guard = new THREE.Mesh(extrude([[-.2, .13], [-.06, .19], [.06, .19], [.2, .13], [.16, .21], [0, .24], [-.16, .21]], .09, .01), gold); g.add(guard);
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(.034, .038, .3, 8), toon(0x4a1810)); grip.position.y = 0; g.add(grip);
  const pommel = new THREE.Mesh(new THREE.OctahedronGeometry(.06, 0), gold); pommel.position.y = -.17; g.add(pommel);
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(.035, 0), glow(c.edge)); gem.position.set(0, .2, .05); g.add(gem);
  return { g, base: anchor(g, .3, 'base'), tip: anchor(g, L, 'tip') };
}
function lance(c) {
  const g = new THREE.Group(), silver = toon(0xb9c8dc), deep = toon(0x1f3f78), L = 1.75, B = -.95;
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(.028, .032, L - B, 8), deep); shaft.position.y = (L + B) / 2 - .25; g.add(shaft);
  for (const y of [-.5, .1, .55, L - .42]) { const r = new THREE.Mesh(new THREE.TorusGeometry(.04, .012, 6, 12), silver); r.rotation.x = Math.PI / 2; r.position.y = y; g.add(r); }
  const head = new THREE.Mesh(extrude([[0, L - .38], [.09, L - .2], [.05, L], [0, L + .22], [-.05, L], [-.09, L - .2]], .03), new THREE.MeshToonMaterial({ color: c.edge, gradientMap: grad, transparent: true, opacity: .9, emissive: new THREE.Color(c.core), emissiveIntensity: .6 })); g.add(head);
  const wing = new THREE.Mesh(extrude([[0, L - .44], [.2, L - .3], [.13, L - .36], [.05, L - .3], [-.05, L - .3], [-.13, L - .36], [-.2, L - .3]], .02), silver); g.add(wing);
  const butt = new THREE.Mesh(new THREE.ConeGeometry(.04, .14, 8), silver); butt.position.y = B - .3; butt.rotation.x = Math.PI; g.add(butt);
  const orb = new THREE.Mesh(new THREE.SphereGeometry(.05, 10, 8), glow(c.core)); orb.position.y = L - .42; g.add(orb);
  return { g, base: anchor(g, .4, 'base'), tip: anchor(g, L + .2, 'tip') };
}
function gauntlet(c) {
  const g = new THREE.Group(), rock = toon(0x6e6656), dark = toon(0x3d3a33);
  const fist = new THREE.Mesh(new THREE.DodecahedronGeometry(.17, 0), rock); fist.scale.set(1.05, .95, 1.25); g.add(fist);
  for (const [x, y, z, s] of [[.1, .08, .1, .07], [-.1, .1, .08, .06], [.02, .14, -.04, .065], [.0, -.1, .12, .055]]) { const k = new THREE.Mesh(new THREE.TetrahedronGeometry(s, 0), dark); k.position.set(x, y, z); k.rotation.set(x * 9, y * 7, z * 5); g.add(k); }
  const rune = new THREE.Mesh(new THREE.TorusGeometry(.1, .012, 4, 6), glow(c.edge)); rune.position.z = .19; rune.rotation.z = Math.PI / 6; g.add(rune);
  const cuff = new THREE.Mesh(new THREE.CylinderGeometry(.15, .13, .3, 6), rock); cuff.position.y = -.27; g.add(cuff);
  const line = new THREE.Mesh(new THREE.BoxGeometry(.02, .24, .02), glow(c.edge)); line.position.set(0, -.27, .14); g.add(line);
  return { g, base: anchor(g, -.12, 'base'), tip: anchor(g, .2, 'tip'), fist: true };
}
function crescent(c) {
  const g = new THREE.Group(), steel = toon(0xdfe8f2), L = .78;
  const pts = []; for (let i = 0; i <= 10; i++) { const a = i / 10; pts.push([.06 + .07 * Math.sin(a * Math.PI) + a * .02, .1 + a * (L - .1)]); }
  for (let i = 10; i >= 0; i--) { const a = i / 10; pts.push([-.01 + .16 * Math.sin(a * Math.PI) * .55 - (1 - a) * .04 + a * .03, .1 + a * (L - .1) - (a > .95 ? .02 : 0)]); }
  const blade = new THREE.Mesh(extrude(pts, .02), steel); g.add(blade);
  const edge = new THREE.Mesh(extrude(pts.slice(0, 11).map(([x, y]) => [x + .008, y]).concat(pts.slice(0, 11).reverse().map(([x, y]) => [x - .02, y])), .028, 0), glow(c.edge)); g.add(edge);
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(.028, .028, .24, 8), toon(0x6fa0d8)); g.add(grip);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(.055, .012, 6, 14), glow(c.core)); ring.position.y = -.15; ring.rotation.x = Math.PI / 2; g.add(ring);
  const tassel = new THREE.Mesh(new THREE.ConeGeometry(.03, .16, 6), toon(0xbfe3ff)); tassel.position.y = -.26; tassel.rotation.x = Math.PI; g.add(tassel);
  return { g, base: anchor(g, .15, 'base'), tip: anchor(g, L, 'tip') };
}

export const WEAPONS = {
  ignis: { make: sword, hands: 'F', aim: true, grip: { along: .55, out: 0 }, tilt: 0, colors: { edge: 0xff7a2a, core: 0xffd27a } },
  aqua: { make: lance, hands: 'F', aim: true, grip: { along: .55, out: 0 }, tilt: 0, colors: { edge: 0x7fe4ff, core: 0x2f8cff } },
  terra: { make: gauntlet, hands: 'FB', grip: { along: .35, out: 0 }, fist: true, colors: { edge: 0x9cff5a, core: 0x6fbf4a } },
  zephyr: { make: crescent, hands: 'FB', grip: { along: .55, out: 0 }, reverse: true, colors: { edge: 0xbfe6ff, core: 0x9cc8ff } },
};

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
// Marco de la mano en reposo (espacio del guerrero): palma y ejes del arma. W: { grip:{along}, reverse, fist }.
export function handFrame(rig, side, W) {
  const hi = rig.I['ha' + side], arm = rig.limb['arm' + side], H = rig.P0[hi], u2 = arm.u2.clone();
  // palma: entre la muñeca y la base de los dedos
  const kids = rig.kids[hi].filter(j => rig.kind[j] === 11); const fb = new THREE.Vector3(); kids.forEach(j => fb.add(rig.P0[j])); if (kids.length) fb.divideScalar(kids.length); else fb.copy(H).addScaledVector(u2, .08);
  const palm = H.clone().lerp(fb, W.grip?.along ?? .55);
  // ejes del arma en el espacio del guerrero (en reposo): Z = a lo largo de la mano, Y = hacia delante (lado del pulgar)
  const Zw = u2.clone().normalize(), F = new THREE.Vector3(0, 0, 1), Yw = F.addScaledVector(Zw, -F.dot(Zw)).normalize();
  if (W.reverse) Yw.multiplyScalar(-1).addScaledVector(Zw, -.9).normalize(); // agarre invertido: la hoja corre por el antebrazo
  if (W.fist) Yw.copy(Zw);                                                    // guantelete: alineado con la mano
  const Xw = new THREE.Vector3().crossVectors(Yw, W.fist ? new THREE.Vector3(0, 0, 1) : Zw).normalize(); const Zf = new THREE.Vector3().crossVectors(Xw, Yw).normalize();
  return { hi, Yw, M: new THREE.Matrix4().makeBasis(Xw, Yw, Zf).setPosition(palm) };
}
// Cuelga un grupo de un hueso con una transformación deseada en el espacio del guerrero (M).
export function mount(rig, holder, boneIdx, g, M) {
  const bone = rig.bones[boneIdx]; holder.updateMatrixWorld(true); bone.updateMatrixWorld(true);
  _m.copy(bone.matrixWorld).invert().multiply(holder.matrixWorld).multiply(M); _m.decompose(_p, _q, _s);
  g.position.copy(_p); g.quaternion.copy(_q); g.scale.copy(_s); g.userData.restQ = _q.clone(); g.userData.restS = _s.clone();
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
  bone.add(g); return g;
}
export class WeaponSet {
  // ghost: los golpes normales son SIN arma (v0.9). No se crea ninguna malla, pero las manos de los guerreros que
  // estaban diseñados con arma «apuntable» siguen orientándose (canal pitch = ángulo absoluto, con giro limitado de muñeca).
  constructor(rig, holder, id, { ghost = false } = {}) {
    const W = WEAPONS[id]; this.ok = !!W && !ghost; this.hands = W?.hands || ''; this.items = { L: null, R: null }; this.lead = 0;
    if (!W) return;
    holder.updateMatrixWorld(true);
    for (const side of ['L', 'R']) {
      const fr = handFrame(rig, side, W);
      if (ghost) continue; // sin arma: la muñeca NO apunta una hoja inexistente (eso torcía la mano)
      if (W.aim) (rig.blade ||= {})[side] = fr.Yw.clone(); // dirección de la hoja en reposo (para apuntarla)
      const w = W.make(W.colors); mount(rig, holder, fr.hi, w.g, fr.M); w.g.visible = false; this.items[side] = w;
    }
    // los golpes de estos guerreros se diseñaron con el ángulo de una hoja: sin arma se traducen a un giro de muñeca natural
    if (ghost) { rig.wristK = W.aim ? .28 : .6; rig.wristMax = .5; rig.rollMax = .7; }
  }
  // lead: +1 si el lado adelantado es el izquierdo
  setLead(lead) {
    if (!this.ok || lead === this.lead) return; this.lead = lead;
    const F = lead > 0 ? 'L' : 'R', B = F === 'L' ? 'R' : 'L';
    this.items[F].g.visible = this.hands.includes('F'); this.items[B].g.visible = this.hands.includes('B');
    this.F = this.items[F]; this.B = this.items[B];
  }
  spin(angF, angB) { // molinete: gira el arma sobre su empuñadura (eje de la mano)
    for (const [w, a] of [[this.F, angF], [this.B, angB]]) if (w) { w.g.quaternion.copy(w.g.userData.restQ); if (a) w.g.rotateX(a); }
  }
  setVisible(v) { if (!this.ok) return; for (const s of ['L', 'R']) this.items[s].g.visible = v && (this.items[s] === this.F ? this.hands.includes('F') : this.hands.includes('B')); }
  dispose() { for (const s of ['L', 'R']) { const w = this.items[s]; if (!w) continue; w.g.removeFromParent(); w.g.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } }); } }
}
