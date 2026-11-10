// v1.12: Progreso sin descuadre, sin temblor de cámara, victorias/derrotas corregidas, paisajes del menú y luna con fase real,
// historia de 11 capítulos con retos, medallas y símbolos nuevos, bocadillo, arma que no se queda en la espalda, legal.
import { register } from 'node:module'; import { readFileSync } from 'node:fs'; import { pathToFileURL } from 'node:url';
const three = pathToFileURL(process.cwd() + '/js/vendor/three/build/three.module.js').href;
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s,c,n){ if(s==='three') return {url:'${three}',shortCircuit:true}; return n(s,c); }`));
const ctx = new Proxy({}, { get: (_, k) => k === 'createLinearGradient' || k === 'createRadialGradient' ? () => ({ addColorStop() {} }) : () => {} });
globalThis.document = { createElement: () => ({ getContext: () => ctx }), documentElement: {}, querySelectorAll: () => [] };
const rd = p => readFileSync(p, 'utf8'), js = p => JSON.parse(rd(p));
let bad = 0; const ok = (c, m) => { if (!c) { console.error('FALLO:', m); bad++; } else console.log('ok  ', m); };
const es = js('data/localization/es.json'), en = js('data/localization/en.json'), cfg = js('data/modes.json');

// 1 · regresiones de interfaz
{ const css = rd('css/settings.css'); ok(/#view:not\(\.docked\):has\(>\.nav\)\{display:flex/.test(css) && !/#view:not\(\.docked\)\{display:flex/.test(css), 'la regla de PC solo afecta al menú principal (Progreso y Créditos ya no se descuadran)'); }

// 2 · cámara: sin terremoto
{ const m = rd('js/game/match.js'); ok(/this\.shake \*= Math\.exp\(-rdt \* 12\)/.test(m) && !/cámara tranquila this\.shake \*=/.test(m), 'el temblor se apaga solo (antes la línea que lo amortiguaba estaba dentro de un comentario)');
  const { A11Y, applyA11y } = await import('../js/systems/a11y.js'); const { SETTINGS_DEFAULTS } = await import('../js/systems/settings-manager.js');
  applyA11y({ ...SETTINGS_DEFAULTS }, null); ok(SETTINGS_DEFAULTS.camShake === false && A11Y.shakeK === 0, 'sin temblor de cámara por defecto (opcional en Ajustes)'); }

// 3 · animaciones
{ const at = rd('js/game/animation/attacks.js'); ok(/puño libre firme junto a la cadera/.test(at) && /mano libre sobre el pecho \(antes tapaba la cara\)/.test(at) && /puños en la cintura, codos fuera/.test(at), 'victorias con los brazos bien colocados (Ignis, Aqua, Terra, Zephyr)');
  ok(/las dos manos sobre el regazo/.test(at), 'derrota de Aqua: sentada sobre los talones con las manos en el regazo');
  ok(/más abierto: se ve el cuerpo entero en el suelo/.test(rd('js/game/cinematic-end.js')), 'la cámara de la derrota muestra el cuerpo entero');
  ok(/st\.arts\.push\(an\); \/\/ aura/.test(rd('js/elements/weapon-hook.js')), 'el arma del combate ya no se queda en la espalda en el menú'); }

// 4 · menú: paisajes y luna real
{ const { MenuBackdrop, moonPhase, moonLit } = await import('../js/game/menu-backdrop.js'); const THREE = await import('three');
  ok(Math.abs(moonPhase(new Date(Date.UTC(2024, 0, 11, 11, 57)))) < .02 || moonPhase(new Date(Date.UTC(2024, 0, 11, 11, 57))) > .98, 'fase lunar real (luna nueva del 11-ene-2024)');
  ok(Math.abs(moonPhase(new Date(Date.UTC(2024, 0, 25, 17, 54))) - .5) < .03 && moonLit(.5) > .99, 'y luna llena del 25-ene-2024');
  const g = new THREE.Group(), bg = new MenuBackdrop(g); bg.set(js('data/characters.json').roster[0]); for (let i = 0; i < 30; i++) bg.update(1 / 30, i / 30);
  ok(bg.moon && bg.moon.disc.material.uniforms.uPh, 'una sola luna compartida con el terminador según la fase');
  const src = rd('js/game/menu-backdrop.js'); ok(/paperLayer/.test(src) && /midpoint|punto medio/.test(src) && !/sigilTex\(el\), s1/.test(src), 'paisajes en capas de papel por elemento, sin los sellos de runas');
  ok(/faroles de espíritu/.test(src) && /islotes flotantes/.test(src) && /bandadas lejanas/.test(src) && /humo que sube/.test(src), 'detalles propios: faroles, islotes, aves y humo del volcán');
  ok(!/const ruin = new THREE/.test(rd('js/game/scene-manager.js')), 'sin las columnas ni rocas grises genéricas'); }

// 5 · historia ampliada
{ const { StoryRun, goalOk, CHAPTERS } = await import('../js/modes/story.js');
  const S = new StoryRun(cfg, { hero: 'aqua', level: 'normal' }); ok(S.total === 11 && new Set(CHAPTERS.map(c => c.goal.t)).size >= 6, `historia de ${S.total} capítulos con ${new Set(CHAPTERS.map(c => c.goal.t)).size} tipos de reto`);
  const win = { winner: 0, time: 50, hp: [.8, 0], stats: { combo: [5, 0], ex: [1, 0], throws: [1, 0] } };
  ok(goalOk({ t: 'time', s: 80 }, win) && !goalOk({ t: 'time', s: 40 }, win) && goalOk({ t: 'combo', n: 4 }, win) && !goalOk({ t: 'hp', x: .9 }, win), 'cada reto se comprueba con el resultado del combate');
  ok(S.report({ ...win, stats: { combo: [1, 0], ex: [0, 0], throws: [0, 0] }, time: 200 }).status === 'next', 'capítulo 1: basta con ganar');
  ok(S.report({ ...win, time: 120 }).status === 'goal' && S.i === 1, 'capítulo 2: ganar sin cumplir el reto obliga a repetirlo');
  ok(S.report(win).status === 'next' && S.fight().startHp === .6, 'capítulo 3: empiezas herido');
  const e = new StoryRun(cfg, { hero: 'terra', from: 6 }); ok(e.fight().b === 'terra' && e.scenesBefore().some(s => s.key === 'story.echo.terra.pre'), 'capítulo 7: contra tu propio reflejo');
  const f = new StoryRun(cfg, { hero: 'zephyr', from: 10 }); ok(f.fight().wins === 3 && f.fight().stage === cfg.finalStage && f.isFinal, 'final: la Sombra del Sello al mejor de cinco en la Arena del Equilibrio');
  const keys = []; for (const h of ['ignis', 'aqua', 'terra', 'zephyr']) { const r = new StoryRun(cfg, { hero: h }); for (let i = 0; i < r.total; i++) { r.i = i; keys.push(...r.scenesBefore().map(s => s.key), ...r.scenesAfter(i).map(s => s.key)); } }
  const miss = [...new Set(keys)].filter(k => !es[k] || !en[k]); ok(!miss.length, `todas las escenas de la historia tienen texto en es/en${miss.length ? ' — faltan: ' + miss.slice(0, 5) : ''}`);
  ok(/story\.goal\.fail/.test(rd('js/modes/flow.js')) && /StoryRun/.test(rd('js/ui/modes-ui.js')), 'el flujo y la pantalla usan la historia nueva'); }

// 6 · interfaz y legal
{ const css = rd('css/settings.css'); ok(/MEDALLAS de Logros y Desafíos/.test(css) && /\.ach \.medal::before/.test(css), 'medallas nuevas (moneda con canto del nivel y gema)');
  ok(/placa dorada biselada/.test(css) && /letra a letra/.test(rd('js/main.js')), 'bocadillo de frases nuevo, se escribe letra a letra');
  ok(/remolino de tres brazos simétrico/.test(rd('js/main.js')), 'símbolos nuevos de agua y aire');
  ok(/slow = \.16/.test(rd('js/ui/weapon-preview.js')), 'vista previa de armas: el golpe ya no se queda en cámara lenta');
  const lg = js('data/legal.json'); ok(lg.contact === 'elementalwarriors.therealms1123@gmail.com' && /SaraAndrade1123\/ElementalWarriors/.test(rd('docs/DISTRIBUCION.md')), 'correo de contacto y repositorio oficial'); }
// 7 · (v1.12.1) muñeca al lanzar armas y repositorio
{ const wh = rd('js/elements/weapon-hook.js'), rig = rd('js/game/animation/rig.js');
  ok(/R\.blade = aim \? art\.aim : null/.test(wh) && /aim \? \.9/.test(wh), 'la muñeca solo apunta el arma mientras está en la mano y nunca se dobla más de ~50°');
  ok(/_wristBlend\(s, q, mode\)/.test(rig), 'al soltar el arma la mano pasa a la postura natural con un fundido (sin saltos)');
  const all = ['docs/DISTRIBUCION.md', 'docs/LEGAL.md', 'README.md', 'SUBIR-A-GITHUB.bat', 'subir-a-github.sh', 'data/legal.json'].map(rd).join('\n');
  const owners = new Set([...all.matchAll(/github\.com\/([\w-]+)/gi), ...all.matchAll(/([\w-]+)\.github\.io/gi)].map(m => m[1].toLowerCase()));
  ok(owners.size === 1 && owners.has('saraandrade1123') && /SaraAndrade1123\/ElementalWarriors/.test(rd('SUBIR-A-GITHUB.bat')), 'el proyecto solo apunta al repositorio de Sara (ninguna otra cuenta de GitHub)'); }
ok(/^1\.(1[2-9]|[2-9]\d)\./.test(js('package.json').version) && /v1\.1\d\.\d/.test(es['ui.version']), 'versión 1.12 o posterior');
console.log(bad ? `\n${bad} FALLO(S)` : '\nv1.12: todo correcto'); process.exit(bad ? 1 : 0);
