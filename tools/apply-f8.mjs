// Aplica F8 sobre tu proyecto con ediciones mínimas e idempotentes. Ejecutar desde la raíz: node tools/apply-f8.mjs
import fs from 'node:fs';
const rd = p => fs.readFileSync(p, 'utf8'), wr = (p, s) => fs.writeFileSync(p, s);
const report = [];
const say = (ok, msg) => { report.push((ok ? '  OK  ' : ' AVISO ') + msg); };

function patch(file, marker, edits, manualHint) {
  if (!fs.existsSync(file)) return say(false, `${file}: no existe (${manualHint})`);
  let s = rd(file);
  if (s.includes(marker)) return say(true, `${file}: ya estaba aplicado`);
  for (const [anchor] of edits) if (!s.includes(anchor)) return say(false, `${file}: no encontré «${anchor.trim().slice(0, 50)}…». Hazlo a mano: ${manualHint}`);
  for (const [anchor, repl] of edits) s = s.replace(anchor, () => repl);
  wr(file, s); say(true, `${file}: actualizado`);
}

// 1) Textos: solo AÑADE claves que falten (no pisa tus cambios)
for (const l of ['es', 'en']) {
  const p = `data/localization/${l}.json`, cur = JSON.parse(rd(p)), add = JSON.parse(rd(`patch/locales/${l}.json`)); let n = 0;
  for (const [k, v] of Object.entries(add)) if (!(k in cur)) { cur[k] = v; n++; }
  wr(p, JSON.stringify(cur, null, 1) + '\n'); say(true, `${p}: ${n} claves añadidas`);
}

// 2) Menú: Colección, Tienda y Progreso pasan a estar disponibles
{
  const p = 'data/menu.json', m = JSON.parse(rd(p)); let n = 0;
  for (const it of m.items) if (['collection', 'shop', 'progress'].includes(it.id) && it.status !== 'ready') { it.status = 'ready'; delete it.phase; n++; }
  wr(p, JSON.stringify(m)); say(true, `${p}: ${n} opciones activadas`);
}

// 3) main.js
patch('js/main.js', 'createMeta', [
  ["import { Input } from './game/input.js';", "import { Input } from './game/input.js';\nimport { createMeta } from './systems/meta.js';\nimport { installMetaPanels } from './ui/meta-panels.js';"],
  ["const [{ roster }, { items }] = await Promise.all([json('data/characters.json'), json('data/menu.json')]);",
   "const [{ roster }, { items }, shopData, achData, economy] = await Promise.all([json('data/characters.json'), json('data/menu.json'), json('data/items.json'), json('data/achievements.json'), json('data/economy.json')]);"],
  ['let paused = false;', "const dev = new URLSearchParams(location.search).has('dev');\n    const meta = createMeta({ items: shopData.items, achievements: achData.achievements, economy });\n    roster.forEach(r => scene.setPalette(r.id, meta.shop.paletteOf(r.id)));\n    installMetaPanels(menu, { meta, scene, roster, dev });\n    if (dev) window.ew = meta; // consola: ew.progression.recordMatch({...})\n    let paused = false;"]
], 'docs/INSTALAR-F8.md, sección «Edición manual de main.js»');

// 4) scene-manager.js
patch('js/game/scene-manager.js', 'setPalette', [
  ["import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';", "import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';\nimport { recolorImage } from '../systems/palette.js';"],
  ['m.dispose(); return n;', 'n.name = m.name; m.dispose(); return n;'],
  ['\n  show(id) {', `
  // Paleta alternativa {hue, sat} o null (original). Solo toca cuerpo/ropa; la cabeza (rostro y cabello) no cambia.
  setPalette(id, pal) {
    const c = this.chars.get(id); if (!c) return;
    c.holder.traverse(o => {
      if (!o.isMesh) return;
      for (const m of [].concat(o.material)) {
        if (!m.map || /head|face|eye/i.test(m.name || '')) continue;
        const og = (m.userData.orig ??= m.map), cache = (m.userData.cache ??= {}), key = pal ? \`\${pal.hue}|\${pal.sat ?? 1}\` : '';
        if (pal && !cache[key]) {
          const cv = recolorImage(og.image, pal.hue, pal.sat ?? 1);
          if (cv) { const tx = new THREE.CanvasTexture(cv); Object.assign(tx, { flipY: og.flipY, colorSpace: og.colorSpace, wrapS: og.wrapS, wrapT: og.wrapT, anisotropy: og.anisotropy }); cache[key] = tx; }
        }
        m.map = (pal && cache[key]) || og; m.needsUpdate = true;
      }
    });
  }

  show(id) {`]
], 'docs/INSTALAR-F8.md, sección «Edición manual de scene-manager.js»');

// 5) package.json y check.mjs
{
  const p = 'package.json', j = JSON.parse(rd(p)); j.scripts ??= {};
  const cur = j.scripts.test || '';
  if (!cur.includes('test-progression')) { j.scripts.test = cur ? `${cur} && node tools/test-progression.mjs` : 'node tools/test-progression.mjs'; wr(p, JSON.stringify(j, null, 1) + '\n'); say(true, `${p}: script test ampliado`); } else say(true, `${p}: ya estaba aplicado`);
}
patch('tools/check.mjs', 'items.json', [['const ref = Object.keys(langs.es);',
  "const items = rd('data/items.json').items, achs = rd('data/achievements.json').achievements;\nfor (const i of items) if (!roster.some(c => c.id === i.char)) err(`Objeto ${i.id}: guerrero desconocido ${i.char}`);\nneed.push(...items.map(i => 'item.' + i.id), ...achs.flatMap(a => [`ach.${a.id}.name`, `ach.${a.id}.desc`]));\nconst ref = Object.keys(langs.es);"]],
  'añade la validación de items/logros (opcional)');

// 6) Checklist
if (fs.existsSync('docs/CHECKLIST.md')) {
  let s = rd('docs/CHECKLIST.md');
  if (!s.includes('F8 (núcleo)')) {
    const row = '| F8 (núcleo) | EN PROGRESO | Rose Gold, tienda de paletas, colección, progreso, logros y guardado validado (sin depender de F3) | js/systems/{save,currency,shop,progression}-system.js, palette.js, meta.js, js/ui/meta-panels.js, data/{items,achievements,economy}.json | `npm test` (pruebas de economía, guardado y logros). Pantallas: pendiente de tu prueba en navegador | Conectar F3: llamar a `progression.recordMatch()` al terminar un combate (docs/INTEGRACION-F3.md) |\n';
    s = s.replace(/^\| F3–F10 \|.*\n/m, m => row + m);
    s += '\n- F8: el guardado es local (localStorage) y NO es seguro para economía competitiva en línea. Las compras son solo cosméticas. Paletas = rotación de matiz de la textura del cuerpo/ropa (la cabeza no cambia); ajusta `hue`/`sat` en data/items.json.\n- F8: mientras F3 no esté integrada, `?dev=1` en la URL muestra botones de prueba (+500 Rose Gold, simular victoria).\n';
    wr('docs/CHECKLIST.md', s); say(true, 'docs/CHECKLIST.md: actualizado');
  } else say(true, 'docs/CHECKLIST.md: ya estaba aplicado');
}
console.log('\nF8 — resultado:\n' + report.join('\n') + '\n\nSiguiente: npm run check && npm test');
