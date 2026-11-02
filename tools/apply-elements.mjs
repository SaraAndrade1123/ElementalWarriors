// Instala el TRIÁNGULO ELEMENTAL y el CONTROL ELEMENTAL en cualquier versión del proyecto (v0.6.0, F7 o posteriores).
// Ejecutar desde la raíz del proyecto (donde está index.html):   node tools/apply-elements.mjs
// Se puede repetir sin duplicar nada. Solo hace esto:
//   1. data/characters.json → añade "element" a cada guerrero que no lo tenga (ignis=fire, aqua=water, terra=earth, zephyr=wind).
//   2. data/localization/*.json → añade los textos que falten, renombra el elemento de Zephyr a «Aire» y actualiza la ayuda del HUD
//      (solo si sigue siendo la original de v0.6.0).
//   3. js/main.js → añade 2 import y 2 llamadas (installElements + installBending) justo después de installAudio / installStageSelect.
//   4. package.json → añade tools/test-elements.mjs y tools/test-bending.mjs a «npm test».
// Los archivos nuevos vienen en el paquete (cópialos antes, combinando carpetas). No toca fighter.js, match.js, ai.js,
// scene-manager.js ni menu-manager.js.
import fs from 'node:fs';
const rd = p => fs.readFileSync(p, 'utf8'), wr = (p, s) => fs.writeFileSync(p, s);
const out = [], say = (ok, m) => out.push((ok ? '  OK  ' : ' AVISO ') + m);
let warn = 0; const fail = m => { say(false, m); warn++; };

const NEED = ['data/elements.json', 'data/bending.json', 'js/game/elements.js', 'js/game/bending.js', 'js/game/bending-vfx.js', 'js/game/animation/bending-clips.js',
  'js/elements/element-hook.js', 'js/elements/bending-hook.js', 'css/elements.css', 'patch/locales-elements/es.json', 'patch/locales-elements/en.json'];
for (const f of NEED) if (!fs.existsSync(f)) fail(`falta ${f}: copia el paquete dentro del proyecto antes de ejecutar este script`);
for (const f of ['js/game/fighter.js', 'js/game/match.js', 'js/game/ai.js', 'js/game/animation/attacks.js', 'js/game/animation/pose.js', 'js/game/vfx.js']) if (!fs.existsSync(f)) fail(`${f} no existe: esta versión del juego no es compatible (se necesita F4 o posterior)`);

// 1) Elemento de cada guerrero
const DEF = { ignis: 'fire', aqua: 'water', terra: 'earth', zephyr: 'wind' };
{
  const p = 'data/characters.json';
  if (!fs.existsSync(p)) fail(`${p} no existe`);
  else {
    const j = JSON.parse(rd(p)), els = fs.existsSync('data/elements.json') ? Object.keys(JSON.parse(rd('data/elements.json')).elements) : Object.values(DEF);
    const bend = fs.existsSync('data/bending.json') ? JSON.parse(rd('data/bending.json')) : {};
    let n = 0;
    j.roster = j.roster.map(c => {
      if (!bend[c.id]) say(false, `${c.id}: guerrero sin técnicas de control elemental en data/bending.json (podrá jugar, pero sin ellas)`);
      if (c.element) { if (!els.includes(c.element)) fail(`${c.id}: elemento "${c.element}" no existe en data/elements.json`); return c; }
      const el = DEF[c.id]; if (!el) { fail(`${c.id}: guerrero nuevo sin "element" (será neutro). Añádelo a mano en ${p}`); return c; }
      n++; const o = {}; for (const [k, v] of Object.entries(c)) { o[k] = v; if (k === 'name') o.element = el; } if (!o.element) o.element = el; return o;
    });
    wr(p, JSON.stringify(j, null, 1) + '\n'); say(true, `${p}: ${n} guerreros con elemento añadido`);
  }
}

// 2) Textos
const RENAME = { es: { 'char.zephyr.element': 'Aire' }, en: { 'char.zephyr.element': 'Air' } };
const HINT0 = { es: 'J/K/L ligero·medio·pesado · U especial · I Resonancia · J+K lanzamiento · ← guardia · F1 depuración', en: 'J/K/L light·medium·heavy · U special · I Resonance · J+K throw · ← guard · F1 debug' };
const HINT = fs.existsSync('patch/locales-elements/hint.json') ? JSON.parse(rd('patch/locales-elements/hint.json')) : {};
for (const l of ['es', 'en']) {
  const p = `data/localization/${l}.json`, src = `patch/locales-elements/${l}.json`;
  if (!fs.existsSync(p) || !fs.existsSync(src)) { fail(`no encontré ${p} o ${src}`); continue; }
  const cur = JSON.parse(rd(p)), add = JSON.parse(rd(src)); let n = 0, r = 0;
  for (const [k, v] of Object.entries(add)) if (!(k in cur)) { cur[k] = v; n++; }
  for (const [k, v] of Object.entries(RENAME[l])) if (k in cur && cur[k] !== v) { cur[k] = v; r++; }
  if (HINT[l] && cur['hud.hint.cpu'] === HINT0[l]) { cur['hud.hint.cpu'] = HINT[l]; r++; }
  wr(p, JSON.stringify(cur, null, 1) + '\n'); say(true, `${p}: ${n} claves añadidas, ${r} actualizada(s)`);
}
for (const f of fs.existsSync('data/localization') ? fs.readdirSync('data/localization') : []) if (!['es.json', 'en.json'].includes(f)) say(false, `data/localization/${f}: idioma extra, añade a mano las claves de patch/locales-elements/en.json`);

// 3) main.js
{
  const p = 'js/main.js';
  if (!fs.existsSync(p)) fail(`${p} no existe`);
  else {
    let s = rd(p); const before = s;
    const lines = () => s.split('\n');
    const insertAfterLine = (re, text) => { const L = lines(), i = L.findIndex(x => re.test(x)); if (i < 0) return false; L.splice(i + 1, 0, text); s = L.join('\n'); return true; };
    const indentOf = re => (lines().find(x => re.test(x)) || '').match(/^\s*/)[0];
    const lastImportRe = () => { const L = lines(); let i = -1; L.forEach((x, k) => { if (/^import .*;\s*$/.test(x)) i = k; }); return i; };
    if (!s.includes('installElements(')) {
      const anchor = [/installAudio\(/, /installStageSelect\(/, /installMetaPanels\(/].find(re => lines().some(x => re.test(x)));
      const li = lastImportRe();
      if (!anchor || li < 0) fail(`${p}: no encontré dónde instalar. Añade a mano (docs/CONTROL-ELEMENTAL.md):\n        import { installElements } from './elements/element-hook.js';\n        import { installBending } from './elements/bending-hook.js';\n        const elements = installElements({ menu, scene, roster });\n        const bending = installBending({ menu, scene, roster });`);
      else {
        const ind = indentOf(anchor);
        insertAfterLine(anchor, `${ind}const elements = installElements({ menu, scene, roster }); // triángulo elemental (docs/ELEMENTOS.md)`);
        const L = lines(); L.splice(lastImportRe() + 1, 0, "import { installElements } from './elements/element-hook.js';"); s = L.join('\n');
      }
    }
    if (s.includes('installElements(') && !s.includes('installBending(')) {
      const ind = indentOf(/installElements\(/);
      const after = lines().some(x => /window\.ewElements/.test(x)) ? /window\.ewElements/ : /installElements\(/;
      insertAfterLine(after, `${ind}const bending = installBending({ menu, scene, roster }); // control elemental (docs/CONTROL-ELEMENTAL.md)`);
      insertAfterLine(/^import \{ installElements \}/, "import { installBending } from './elements/bending-hook.js';");
      if (!s.includes("import { installBending }")) { const L = lines(); L.splice(lastImportRe() + 1, 0, "import { installBending } from './elements/bending-hook.js';"); s = L.join('\n'); }
    }
    if (s !== before) { wr(p, s); say(true, `${p}: instalados los ganchos (installElements + installBending)`); } else if (s.includes('installBending(')) say(true, `${p}: ya estaba instalado`);
  }
}

// 4) npm test
{
  const p = 'package.json';
  if (fs.existsSync(p)) {
    const j = JSON.parse(rd(p)); let n = 0;
    for (const t of ['tools/test-elements.mjs', 'tools/test-bending.mjs']) if (j.scripts?.test && fs.existsSync(t) && !j.scripts.test.includes(t)) { j.scripts.test += ` && node ${t}`; n++; }
    if (n) { wr(p, JSON.stringify(j, null, 1) + '\n'); say(true, `${p}: ${n} prueba(s) añadidas a npm test`); } else say(true, `${p}: sin cambios`);
  }
}
console.log(out.join('\n'));
console.log(warn ? `\n${warn} aviso(s): revisa los puntos marcados.` : '\nTriángulo elemental y control elemental instalados. Comprueba con: npm run check && npm test');
process.exit(warn ? 1 : 0);
