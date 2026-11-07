// v1.11: ficha del jugador, derrotas de Aqua (seiza) y Zephyr, fuego por shader, entradas y salidas del menú con luna, chroma en todo
// el santuario, una sola barra de desplazamiento, guardado cifrado y firmado, versión web con actualización automática y legal.
import { register } from 'node:module'; import { readFileSync, existsSync } from 'node:fs'; import { pathToFileURL } from 'node:url';
const three = pathToFileURL(process.cwd() + '/js/vendor/three/build/three.module.js').href;
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s,c,n){ if(s==='three') return {url:'${three}',shortCircuit:true}; return n(s,c); }`));
const ctx = new Proxy({}, { get: (_, k) => k === 'createLinearGradient' || k === 'createRadialGradient' ? () => ({ addColorStop() {} }) : () => {} });
globalThis.document = { createElement: () => ({ getContext: () => ctx }), documentElement: {}, querySelectorAll: () => [] };
const rd = p => readFileSync(p, 'utf8'), js = p => JSON.parse(rd(p));
let bad = 0; const ok = (c, m) => { if (!c) { console.error('FALLO:', m); bad++; } else console.log('ok  ', m); };
const es = js('data/localization/es.json'), en = js('data/localization/en.json'), { roster } = js('data/characters.json');
const THREE = await import('three');

// 1 · ficha del jugador
{ const { shortNum } = await import('../js/ui/format.js'); ok(['999', '1k', '12k', '1M', '3B'].every((v, i) => shortNum([999, 1000, 12500, 1000000, 3e9][i]) === v) && /^1.2k$/.test(shortNum(1234)), 'cifras cortas: 999 · 1,2k · 12k · 1M');
  const m = rd('js/main.js'); ok(/e\('div', 'pcard'\)/.test(m) && !/pcard.*onclick/.test(m) && /EMBLEM/.test(m) && /scene\.onTint = /.test(m), 'la ficha no lleva a ningún sitio y su emblema sigue al guerrero y al chroma');
  ok(es['menu.say.zephyr.3'] && !/lengua/.test(es['menu.say.zephyr.3']), 'frase nueva de Zephyr'); }

// 2 · derrotas
{ const at = rd('js/game/animation/attacks.js'); ok(/seiza/.test(at) && /seatH: \.27/.test(at), 'Aqua: derrota sentada sobre los talones, piernas juntas');
  ok(/mano en la nuca \(codo arriba y hacia fuera\)/.test(at), 'Zephyr: mano en la nuca bien colocada'); ok(/\(oz \+ \.05\) \/ \.2/.test(rd('js/game/animation/rig.js')), 'de rodillas las rodillas van al frente (no hacia arriba)'); }

// 3 · santuarios: entrada/salida, luna, fuego y chroma
{ const { MenuBackdrop } = await import('../js/game/menu-backdrop.js'); const g = new THREE.Group(), bg = new MenuBackdrop(g);
  for (const r of roster) bg.set(r); bg.set(roster[2]); for (let i = 0; i < 90; i++) bg.update(1 / 60, i / 60, false, { color: new THREE.Color('#ff0000'), light: new THREE.Color('#ff8080') });
  const th = bg.themes.get(roster[2].id), cols = th.mats.filter(m => m.userData.role === 'C').map(m => m.color.getHexString());
  const rock = th.mats.find(m => m.userData.role === 'rock'), lcol = th.mats.filter(m => m.userData.role === 'L').map(m => m.color.getHexString());
  ok(cols.length >= 3 && cols.every(c => c === 'ff0000') && lcol.every(c => c === 'ff8080') && rock.emissive.getHexString() === 'ff0000', `el chroma tiñe TODO el santuario (${cols.length + lcol.length + 1} piezas: sello, resplandor, luna, rocas, cristales)`);
  const src = rd('js/game/menu-backdrop.js'); ok(/moonTex/.test(src) && /LUNA \(todos\)/.test(src), 'luna pintada en los cuatro santuarios');
  ok(/FIRE_FS/.test(src) && /ShaderMaterial/.test(src) && !/flameTex, color/.test(src), 'fuego por shader (ya no gotas)');
  ok(/BROTAN del suelo/.test(src) && /SE RETRAEN/.test(src) && /stag\(/.test(src), 'entradas y salidas propias (las rocas de Terra se retraen)'); }

// 4 · barra de desplazamiento
{ const sb = rd('js/ui/scrollbar.js'), css = rd('css/settings.css'); ok(/solo la más interior/.test(sb) && /ewup/.test(sb) && /scrollbar-width:none!important/.test(css) && es['ui.top'], 'una sola barra dorada por fuera y botón para subir'); }

// 5 · seguridad
{ const { SaveSystem, MemoryStorage, seal, unseal } = await import('../js/systems/save-system.js');
  const st = new MemoryStorage(), S = new SaveSystem(st); S.commit(d => { d.gold.balance = 300; d.gold.earned = 300; return { ok: true }; });
  const raw = st.getItem('ew.save.v1'); ok(/^EW2\./.test(raw) && !raw.includes('balance'), 'el guardado no es JSON legible');
  const evil = seal({ ...S.data, gold: { balance: 999999, earned: 999999, spent: 0 } }).replace(/^EW2\.[0-9a-z]+\./, 'EW2.abc.'); st.setItem('ew.save.v1', evil);
  const S2 = new SaveSystem(st); ok(S2.tampered && S2.data.gold.balance === 300, 'si se edita a mano, la firma no cuadra y se recupera la copia buena');
  const leg = new MemoryStorage(); leg.setItem('ew.save.v1', JSON.stringify({ v: 1, gold: { balance: 50, earned: 50, spent: 0 } })); ok(new SaveSystem(leg).data.gold.balance === 50, 'los guardados de versiones anteriores siguen funcionando');
  const inf = new MemoryStorage(); inf.setItem('ew.save.v1', JSON.stringify({ v: 1, gold: { balance: 9e6, earned: 100, spent: 0 } })); ok(new SaveSystem(inf).data.gold.balance === 100, 'no se puede tener más Rose Gold del ganado');
  ok(unseal('basura').state === 'bad', 'guardado dañado: se detecta');
  ok(/!globalThis\.__EW_BUILD__ && /.test(rd('js/main.js')) && /'globalThis\.__EW_BUILD__': 'true'/.test(rd('tools/build-standalone.mjs')) && !/__ewInput/.test(rd('js/main.js')), 'sin herramientas de consola en la versión publicada'); }

// 6 · distribución y legal
{ const b = rd('tools/build-standalone.mjs'); ok(/dist\/web/.test(b) && /sw\.js/.test(b) && /manifest\.webmanifest/.test(b) && /Content-Security-Policy/.test(b) && /Hay una versión nueva/.test(b), 'versión web instalable con aviso de actualización y CSP');
  ok(existsSync('.github/workflows/pages.yml') && /deploy-pages/.test(rd('.github/workflows/pages.yml')) && /npm test/.test(rd('.github/workflows/pages.yml')), 'publicación automática en GitHub Pages (solo si pasan las pruebas)');
  ok(['icon-192.png', 'icon-512.png', 'icon-maskable-512.png'].every(f => existsSync('assets/icons/' + f)), 'iconos de la app');
  ok(['own', 'terms', 'priv', 'third', 'tm', 'contact'].every(k => es[`lg.${k}.h`] && en[`lg.${k}.h`]) && /lg\.third\.models/.test(rd('js/ui/menu-manager.js')), 'Créditos › Legal: titularidad, términos, privacidad, licencias, marcas y contacto');
  ok(existsSync('docs/LEGAL.md') && existsSync('docs/THIRD-PARTY-NOTICES.md') && /MIT License/.test(rd('docs/THIRD-PARTY-NOTICES.md')) && existsSync('docs/DISTRIBUCION.md'), 'documentos legales y de distribución');
  ok(!/No usa personajes/.test(es['cr.insp']), 'los créditos ya no dicen que no se usan personajes de otra franquicia'); }
ok(js('package.json').version === '1.11.0' && /v1\.11\.0/.test(es['ui.version']), 'versión 1.11.0');
console.log(bad ? `\n${bad} FALLO(S)` : '\nv1.11: todo correcto'); process.exit(bad ? 1 : 0);
