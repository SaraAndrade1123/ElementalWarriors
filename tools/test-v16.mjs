// v1.6: un solo index, favicon, vigilante de carga, dificultad en combate de prueba, pulgar, poses K.O., gesto de derrota, UI.
import { register } from 'node:module'; import { readFileSync, existsSync } from 'node:fs'; import { pathToFileURL } from 'node:url';
const three = pathToFileURL(process.cwd() + '/js/vendor/three/build/three.module.js').href, addons = pathToFileURL(process.cwd() + '/js/vendor/three/examples/jsm/').href;
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s,c,n){ if(s==='three') return {url:'${three}',shortCircuit:true}; if(s.startsWith('three/addons/')) return {url:'${addons}'+s.slice(13),shortCircuit:true}; return n(s,c); }`));
const rd = p => readFileSync(p, 'utf8'), js = p => JSON.parse(rd(p));
let bad = 0; const ok = (c, m) => { if (!c) { console.error('FALLO:', m); bad++; } else console.log('ok  ', m); };

// 1 · un solo index para jugar + favicon + vigilante de carga
ok(!existsSync('index-dev.html') && existsSync('tools/dev/index.html'), 'solo hay un index.html en la raíz (desarrollo en tools/dev/index.html)');
const dev = rd('tools/dev/index.html'), main = rd('js/main.js');
ok(/rel="icon"[^>]*image\/svg\+xml/.test(dev), 'la pestaña tiene un logo propio (favicon SVG)');
ok(/__EW_BOOT/.test(dev) && /setTimeout\([^)]*30000|30000\)/.test(dev) && /Modo ligero|bootfix/.test(dev), 'vigilante de carga: a los 30 s explica dónde se detuvo y ofrece Reintentar / Modo ligero');
ok(/__EW_BOOT\s*=\s*['"]ok['"]|stage\(['"]ok['"]\)/.test(main) && /__EW_HELP/.test(main), 'el arranque marca cada paso y avisa si falla');
ok(/id="fullscr"/.test(dev) && /requestFullscreen/.test(main), 'botón de pantalla completa para el celular');
if (existsSync('index.html')) { const ix = rd('index.html'); ok(/rel="icon"/.test(ix) && /__EW_BOOT/.test(ix) && !/<base /.test(ix), 'index.html (un archivo) incluye favicon y vigilante, sin <base>'); }

// 2 · dificultad con nombres claros
const es = js('data/localization/es.json'), en = js('data/localization/en.json');
const { LEVEL_IDS } = await import('../js/game/ai.js');
ok(LEVEL_IDS.length === 4 && LEVEL_IDS.map(l => es[`level.${l}`] ?? es[`levels.${l}`] ?? es[`cpu.${l}`]).join() !== '', '4 niveles de CPU');
const names = Object.entries(es).filter(([k]) => LEVEL_IDS.some(l => k.endsWith('.' + l))).map(([, v]) => v);
ok(['Fácil', 'Medio', 'Difícil', 'Extremo'].every(n => names.includes(n)), 'niveles: Fácil · Medio · Difícil · Extremo');
ok(/play\.level/.test(rd('js/ui/menu-manager.js')) && /lvl-/.test(rd('js/ui/menu-manager.js')), 'Combate de prueba permite elegir la dificultad');
ok(es['play.level'] && en['play.level'] && es['ui.fullscreen'] && en['ui.fullscreen'], 'textos nuevos en es/en');

// 3 · pulgar, poses K.O. y gesto de derrota
ok(/\.tq\s*=/.test(rd('js/game/animation/rig.js')) && /cv\.tq/.test(rd('js/game/animation/rig.js')), 'el pulgar del puño cruza por delante de los dedos');
const loco = rd('js/game/animation/locomotion.js');
ok(['ignis', 'aqua', 'terra', 'zephyr'].every(id => new RegExp(`\\b${id}\\s*:`).test(loco.slice(loco.indexOf('const KO')))), 'cada guerrero tiene su propia pose en el suelo');
const { ATTACKS } = await import('../js/game/animation/attacks.js');
ok(ATTACKS.includes('lose'), 'existe la animación de derrota');
const atk = rd('js/game/animation/attacks.js');
ok((atk.match(/\blose\s*:/g) || []).length >= 4, 'cada guerrero tiene un gesto de derrota distinto');
const cine = rd('js/game/cinematic-end.js');
ok(/lose\?\.ground \? \{ name: 'lose'/.test(cine) && /L\.ko = true/.test(cine), 'en la escena final el perdedor sigue en el suelo, mira al ganador y hace su gesto');

// 4 · interfaz
{ const eh = rd('js/elements/element-hook.js'), body = eh.slice(eh.indexOf('function decorateHeader'), eh.indexOf('function refreshMenu')); ok(body.length > 0 && !/elem\.rel|neutral/.test(body), 'Terra ya no muestra «Neutro» en el menú'); }
ok(/song-pick/.test(rd('js/audio/audio-hook.js')) && /song-pick/.test(rd('css/audio.css')), 'canción: una sola visible con flechas a los lados');
ok(/story-acts/.test(rd('js/ui/modes-ui.js')) && /story-acts/.test(rd('css/mobile.css')), 'historia: «Continuar» y «Empezar desde el principio» ordenados');
ok(/hover:\s*none/.test(rd('css/mobile.css')), 'sin hover pegado en pantallas táctiles');
ok(/pairScale/.test(rd('js/game/scene-manager.js')), 'versus 2J: los guerreros se encuadran en el espacio libre');
ok(/^1\.[6-9]\./.test(js('package.json').version), 'versión 1.6 o posterior');

console.log(bad ? `\n${bad} FALLO(S)` : '\nv1.6: todo correcto'); process.exit(bad ? 1 : 0);
