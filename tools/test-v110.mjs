// v1.10: rival aleatorio contra la CPU, santuarios del menú pulidos, escenarios de Tierra (calmado) y Viento (nuevo),
// botones grandes en PC y derrotas con contacto real con el suelo (cadera apoyada, manos en el suelo, rodillas).
import { register } from 'node:module'; import { readFileSync } from 'node:fs'; import { pathToFileURL } from 'node:url';
const three = pathToFileURL(process.cwd() + '/js/vendor/three/build/three.module.js').href;
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s,c,n){ if(s==='three') return {url:'${three}',shortCircuit:true}; return n(s,c); }`));
const ctx = new Proxy({}, { get: (_, k) => k === 'createLinearGradient' || k === 'createRadialGradient' ? () => ({ addColorStop() {} }) : () => {} });
globalThis.document = { createElement: () => ({ getContext: () => ctx }), documentElement: {}, querySelectorAll: () => [] };
const rd = p => readFileSync(p, 'utf8'), js = p => JSON.parse(rd(p));
let bad = 0; const ok = (c, m) => { if (!c) { console.error('FALLO:', m); bad++; } else console.log('ok  ', m); };
const es = js('data/localization/es.json'), en = js('data/localization/en.json'), { roster } = js('data/characters.json');
const THREE = await import('three');

// 1 · rival aleatorio
{ const tr = rd('js/ui/track-ui.js'); ok(/export function rivalPicker/.test(tr) && /export const RAND/.test(tr), 'selector de rival con fichas por guerrero y «Aleatorio»');
  const { resolveRival, RAND } = await import('../js/ui/track-ui.js'); const seen = new Set(); for (let i = 0; i < 40; i++) seen.add(resolveRival(RAND, roster, () => i / 40));
  ok(seen.size === roster.length && resolveRival(2, roster) === 2, 'el aleatorio se sortea entre los 4 guerreros (y un rival elegido se respeta)');
  ok(/rivalPicker/.test(rd('js/ui/menu-manager.js')) && /rivalPicker/.test(rd('js/ui/modes-ui.js')), 'en Combate de prueba y en Versus (CPU, 2 jugadores y espectador)');
  ok(/RAND/.test(rd('js/ui/versus-preview.js')) && ['rival.random', 'rival.random.desc', 'rival.mirror'].every(k => es[k] && en[k]), 'vista de Versus con ruleta del rival aleatorio (es/en)'); }

// 2 · santuarios del menú: suaves y sin saltos
{ const { MenuBackdrop } = await import('../js/game/menu-backdrop.js'); const g = new THREE.Group(), bg = new MenuBackdrop(g);
  for (const r of roster) bg.set(r);
  const snap = () => { const v = []; g.traverse(o => { if (o.isMesh) v.push([o.position.x, o.position.y, o.rotation.z, o.material.opacity ?? 1]); }); return v; }; // lo invisible (al renacer) no cuenta
  let worst = 0; for (const r of roster) { bg.set(r); for (let i = 0; i < 30; i++) bg.update(1 / 60, i / 60); let a = snap(); for (let i = 0; i < 240; i++) { bg.update(1 / 60, 1 + i / 60); const b = snap(); for (let k = 0; k < a.length; k++) { if (Math.min(a[k][3], b[k][3]) < .02) continue; for (let j = 0; j < 3; j++) worst = Math.max(worst, Math.abs(b[k][j] - a[k][j])); } a = b; } }
  ok(worst < .06, `los fondos del menú se mueven despacio (máximo ${worst.toFixed(3)} por fotograma)`);
  const src = rd('js/game/menu-backdrop.js'); ok(!/bandTex, color: C, opacity: \.18/.test(src) && /life\(/.test(src) && /spiralTex/.test(src), 'sin la columna de luz rectangular; partículas con fundido; espiral y mar de nubes en Aire'); }

// 3 · escenarios
{ const st = js('data/stages.json').stages, v = st.find(s => s.id === 'viento'), b = rd('js/stages/stage-builder.js'), x = rd('js/stages/stage-extras.js');
  ok(['airtemple', 'windmills', 'prayerflags'].every(p => v.props.includes(p) && b.includes(p + '()')) && ['sunrays', 'gusts'].every(e => v.extras.includes(e) && x.includes(e + '()')), 'Santuario del Viento: templos en islas flotantes, molinos, banderas de oración, sol con rayos y ráfagas');
  ok(!v.props.includes('bridges') && v.sky[0] !== '#6a8fd6', 'Viento deja el puente blanco y el cielo plano');
  ok(/dt \* \(1\.1 \+ \(i % 5\) \* \.25\)/.test(x) && /t \* \.12 \+ c\.userData\.ph/.test(b) && /o\.a \+ t \* \.08/.test(x), 'Bastión calmado: arena, cristales y rocas más lentos'); }

// 4 · PC: botones grandes, textos de abajo normales
{ const css = rd('css/settings.css'); ok(/@media \(min-width:1100px\)[^{]*pointer:fine\)\{\n  \.left\{width:clamp\(390px,30vw,620px\)\}/.test(css) && /\.left \.ver\{font-size:\.88rem\}/.test(css), 'en PC los botones del menú crecen (30 % del ancho) y la versión no'); }

// 5 · derrotas con contacto real con el suelo
{ const { CH, IDX } = await import('../js/game/animation/pose.js'); ok(['seat', 'seatH', 'knFx', 'knBx', 'hnFgnd', 'hnBgnd'].every(c => CH.includes(c)), 'canales nuevos: cadera apoyada, rodillas y manos en el suelo');
  const rig = rd('js/game/animation/rig.js'); ok(/c\('seatH'\) \* this\.legLen/.test(rig) && /hn' \+ f \+ 'gnd/.test(rig), 'el esqueleto apoya la cadera a la altura real del modelo y planta la mano en el suelo');
  const { buildAttacks } = await import('../js/game/animation/attacks.js'); const { STYLES } = await import('../js/game/animation/styles.js'); const { Director } = await import('../js/game/animation/director.js');
  for (const id of Object.keys(STYLES)) { const d = new Director(STYLES[id], { legLen: 1.6 }), f = { facing: 1, ko: true }, act = { name: 'lose', t: 0 }; for (let i = 0; i < 60; i++) d.compose(1 / 60, f);
    let P, minSeat = 1; for (let i = 0; i < 200; i++) { act.t += 1 / 60; P = d.compose(1 / 60, f, { action: act }); if (act.t > .3) minSeat = Math.min(minSeat, P[IDX.seat]); }
    ok(P[IDX.seat] > .95 && minSeat > .9, `${id}: la cadera no se despega del suelo en toda la escena (seat ≥ ${minSeat.toFixed(2)}, altura ${P[IDX.seatH].toFixed(2)})`); }
  const at = rd('js/game/animation/attacks.js'); ok((at.match(/hnBgnd: 1/g) || []).length >= 3 && /seatH: \.56/.test(at) && /knFx: \.95/.test(at), 'posturas reales: apoyado en la mano (Ignis, Aqua, Zephyr), rodilla en tierra (Terra), piernas cruzadas (Zephyr)');
  ok(/s\('seat', 1 - air\)/.test(rd('js/game/animation/locomotion.js')), 'tumbado tras un K.O.: la cadera toca el suelo en todos los modelos'); }
ok(/^1\.(1\d|[2-9]\d)\./.test(js('package.json').version), 'versión 1.10 o posterior');
console.log(bad ? `\n${bad} FALLO(S)` : '\nv1.10: todo correcto'); process.exit(bad ? 1 : 0);
