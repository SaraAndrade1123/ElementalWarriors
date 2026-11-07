// v1.8: F9 completa (ajustes reales), 109 logros con hazañas, derrota sentada, armas con aura e impactos, giro de Zephyr.
import { register } from 'node:module'; import { readFileSync } from 'node:fs'; import { pathToFileURL } from 'node:url';
const three = pathToFileURL(process.cwd() + '/js/vendor/three/build/three.module.js').href, addons = pathToFileURL(process.cwd() + '/js/vendor/three/examples/jsm/').href;
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s,c,n){ if(s==='three') return {url:'${three}',shortCircuit:true}; if(s.startsWith('three/addons/')) return {url:'${addons}'+s.slice(13),shortCircuit:true}; return n(s,c); }`));
globalThis.document ??= { createElement: () => ({ getContext: () => null }) };
const rd = p => readFileSync(p, 'utf8'), js = p => JSON.parse(rd(p));
let bad = 0; const ok = (c, m) => { if (!c) { console.error('FALLO:', m); bad++; } else console.log('ok  ', m); };
const es = js('data/localization/es.json'), en = js('data/localization/en.json');

// 1 · F9: ajustes validados y conectados
{ const { Settings, SETTINGS_DEFAULTS } = await import('../js/systems/settings-manager.js');
  const mem = { v: {}, getItem(k) { return this.v[k] ?? null; }, setItem(k, v) { this.v[k] = v; } };
  mem.setItem('ew.settings.v1', JSON.stringify({ quality: 'ultra', res: 13, keys: { solo: { l: 'Escape' } }, tSize: 9, contrast: true }));
  const S = new Settings(mem), s = S.get();
  ok(s.quality === SETTINGS_DEFAULTS.quality && s.res === 100 && JSON.stringify(s.keys) === '{}' && s.tSize === 1 && s.contrast === true, 'los ajustes guardados inválidos vuelven al valor predeterminado (los válidos se conservan)');
  ok(S.set({ keys: { vs2: { h: 'KeyB' } } }) && S.get().keys.vs2.h === 'KeyB' && !S.set({ keys: { solo: { l: 'F1' } } }), 'teclas configurables con validación (las reservadas se rechazan)');
  S.set({ uiScale: 1.3, textSpeed: 'slow' }); S.reset(['uiScale']); ok(S.get().uiScale === 1 && S.get().textSpeed === 'slow', 'restablecer una sección no toca las demás');
  const { buildSchemes } = await import('../js/game/input.js'); const m = buildSchemes({ solo: { l: 'KeyK' } }).solo[0];
  ok(m.l[0] === 'KeyK' && !m.m.includes('KeyK'), 'una tecla reasignada pasa a la acción nueva y se quita de la anterior (sin conflictos)');
  const { A11Y, applyA11y, typed } = await import('../js/systems/a11y.js');
  applyA11y({ camFx: true, calmCam: true, reduceFlash: true, textSpeed: 'fast' }, null); ok(A11Y.camK === .3 && A11Y.flashK < 1 && A11Y.reduceFlash, 'cámara tranquila y reducir destellos ajustan los efectos');
  ok(typed(1) > typed(1, 46) - 1 && typed(1) > 46, 'la velocidad de los diálogos cambia el texto mostrado');
  applyA11y({ camFx: false, textSpeed: 'normal' }, null); ok(A11Y.camK === 0, 'efectos de cámara apagados = sin temblor ni zoom');
  const used = { 'js/game/match.js': 'A11Y.camK', 'js/game/fight-fx.js': 'A11Y.camK', 'js/game/render/post.js': 'A11Y.reduceFlash', 'js/game/cinematic.js': 'typed(', 'js/game/cinematic-end.js': 'typed(', 'js/game/story-cine.js': 'typedN(', 'js/game/scene-manager.js': 'syncOutlines', 'js/main.js': 'autoPause' };
  ok(Object.entries(used).every(([f, k]) => rd(f).includes(k)), 'cada ajuste se aplica de verdad (cámara, destellos, diálogos, contornos, resolución, pausa automática)');
  const page = rd('js/ui/settings-page.js'); ok(['graphics', 'sound', 'controls', 'touch', 'access', 'lang'].every(k => page.includes(`'${k}'`) && es['set.sec.' + k] && en['set.sec.' + k]), 'pantalla de ajustes con 6 pestañas (es/en)');
  ok(!es['set.later'] && !rd('js/ui/menu-manager.js').includes('set.later'), 'ya no aparece «Controles y accesibilidad avanzada llegan en la fase F9»');
  const css = rd('css/settings.css'); ok(/body\.hc/.test(css) && /body\.altcues/.test(css) && /--tsz/.test(css) && /touch-swap/.test(css), 'alto contraste, indicadores alternativos y botones táctiles configurables'); }

// 2 · logros
{ const A = js('data/achievements.json').achievements, tiers = new Set(A.map(a => a.tier));
  ok(A.length >= 100 && new Set(A.map(a => a.id)).size === A.length, `${A.length} logros, sin repetidos`);
  ok(['bronze', 'silver', 'gold', 'platinum', 'mythic'].every(t => tiers.has(t)) && A.every(a => es[`ach.${a.id}.name`] && en[`ach.${a.id}.desc`]), 'cinco niveles (bronce → mítico) y textos en es/en');
  const leg = A.find(a => a.id === 'legend'); ok(leg && leg.gte === A.length - 1, '«Guerrero Elemental» exige todos los demás');
  const { Progression } = await import('../js/systems/progression-system.js'); const { defaults } = await import('../js/systems/save-system.js');
  const data = defaults(), save = { data, commit(fn) { return fn(this.data); } }, P = new Progression(save, { economy: js('data/economy.json'), achievements: A });
  const keys = new Set(Object.keys(P.derive(data))); for (const r of js('data/characters.json').roster) keys.add('wins_' + r.id);
  ok(A.every(a => keys.has(a.stat)), 'cada logro mide una estadística que el juego registra');
  P.recordMatch({ matchId: 'x1', mode: 'versus_ai', outcome: 'win', characterId: 'terra', roundsWon: 2, difficulty: 'expert', maxCombo: 4, maxDamage: 30, durationSec: 25,
    feats: { rank: 'S', perfects: 1, flawless: true, exKOs: 1, counters: 2, throws: 1, parries: 1, dmg: 400, comeback: false, fast: true, mirror: false } });
  const st = save.data.stats; ok(st.rankS === 1 && st.flawless === 1 && st.fastWins === 1 && st.extremeWins === 1 && st.extremeBy.terra === 1, 'las hazañas de cada combate se registran (rango S, sin recibir golpes, rápido, Extremo)');
  ok(['first_win', 'rank_s_1', 'flawless_1', 'fast_1', 'extreme_win'].every(id => save.data.done.includes(id)), 'y desbloquean sus logros una sola vez');
  const meta = rd('js/ui/meta-panels.js'); ok(/wcards/.test(meta) && /stiles/.test(meta) && /ach-group/.test(meta) && /prog\.statsTitle/.test(meta), 'Progreso: fichas de estadísticas, tarjetas por guerrero y logros por categoría con título'); }

// 3 · animaciones
{ const { buildAttacks } = await import('../js/game/animation/attacks.js'); const { STYLES } = await import('../js/game/animation/styles.js');
  const { Director } = await import('../js/game/animation/director.js'); const { IDX } = await import('../js/game/animation/pose.js');
  let sit = true; for (const id of Object.keys(STYLES)) { const d = new Director(STYLES[id], { legLen: 1.6 }), f = { facing: 1, ko: true }, act = { name: 'lose', t: 0 }; for (let i = 0; i < 60; i++) d.compose(1 / 60, f);
    let P; for (let i = 0; i < 220; i++) { act.t += 1 / 60; P = d.compose(1 / 60, f, { action: act }); } if (!(P[IDX.comPitch] > -1.1)) { sit = false; console.error('  sigue tumbado', id, P[IDX.comPitch].toFixed(2)); } }
  ok(sit, 'en la escena final los 4 vencidos se sientan en el suelo (no vuelven a tumbarse a mitad de la frase)');
  const d = new Director(STYLES.zephyr, { legLen: 1.6 }), f = { facing: 1 }, act = { name: 'intro', t: 0 }; let prev = null, back = 0;
  for (let i = 0; i < 150; i++) { act.t += 1 / 60; const c = d.compose(1 / 60, f, { action: act.t < 1.6 ? act : null })[IDX.comPitch]; if (prev !== null && act.t > .7) back = Math.max(back, Math.abs(c - prev) > Math.PI ? 0 : c - prev); prev = c; }
  ok(back < .05, 'la voltereta de presentación de Zephyr no da una vuelta extra hacia atrás al terminar'); }

// 4 · armas
{ const wa = rd('js/game/animation/weapon-art.js'), wv = rd('js/game/weapon-vfx.js'), pv = rd('js/ui/weapon-preview.js'), vfx = rd('js/game/vfx.js');
  ok(/addAura/.test(wa) && /aura: true/.test(wa) && /\{ aura: true \}/.test(wv), 'las armas en la mano y lanzadas llevan aura elemental en el filo');
  ok(/impact\(pos, kind/.test(wv) && /__wv\.impact/.test(rd('js/elements/weapon-hook.js')), 'cada tipo de arma tiene su impacto (filo, contundente, punta)');
  ok(/Catmull-Rom/.test(vfx) && /life: \.22/.test(vfx), 'estelas de arma más largas y curvas (media luna)');
  ok(/slow = \.6/.test(pv) && /wpcard/.test(pv), 'vista previa: cámara lenta al conectar y ficha del arma'); }

// 5 · interfaz
{ ok(/heroCard/.test(rd('js/ui/menu-manager.js')) && /hero-card/.test(rd('css/theme.css')), 'Combate de prueba: tarjeta con el nombre del guerrero');
  ok(/\.song-arrow::before/.test(rd('css/audio.css')), 'flechas de la canción con chevrón dibujado y bordes limpios'); }
ok(js('package.json').version === '1.8.0' && /v1\.8\.0/.test(es['ui.version']), 'versión 1.8.0');
console.log(bad ? `\n${bad} FALLO(S)` : '\nv1.8: todo correcto'); process.exit(bad ? 1 : 0);
