// Aplica el sistema de audio sobre tu proyecto con ediciones mínimas e idempotentes.
// Ejecutar desde la raíz del proyecto: node tools/apply-audio.mjs
import fs from 'node:fs';
const rd = p => fs.readFileSync(p, 'utf8'), wr = (p, s) => fs.writeFileSync(p, s);
const report = [];
const say = (ok, msg) => report.push((ok ? '  OK  ' : ' AVISO ') + msg);

function patch(file, marker, edits, manualHint) {
  if (!fs.existsSync(file)) return say(false, `${file}: no existe (${manualHint})`);
  let s = rd(file);
  if (s.includes(marker)) return say(true, `${file}: ya estaba aplicado`);
  for (const [anchor] of edits) if (!s.includes(anchor)) return say(false, `${file}: no encontré «${anchor.trim().slice(0, 55)}…». Hazlo a mano: ${manualHint}`);
  for (const [anchor, repl] of edits) s = s.replace(anchor, () => repl);
  wr(file, s); say(true, `${file}: actualizado`);
}

// 1) Textos: solo AÑADE las claves que falten
for (const l of ['es', 'en']) {
  const p = `data/localization/${l}.json`, src = `patch/locales-audio-${l}.json`;
  if (!fs.existsSync(p) || !fs.existsSync(src)) { say(false, `${p}: falta ${p} o ${src}`); continue; }
  const cur = JSON.parse(rd(p)), add = JSON.parse(rd(src)); let n = 0;
  for (const [k, v] of Object.entries(add)) if (!(k in cur)) { cur[k] = v; n++; }
  wr(p, JSON.stringify(cur, null, 1) + '\n'); say(true, `${p}: ${n} claves añadidas`);
}

// 1b) La nota de Ajustes ya no debe prometer el sonido (solo se cambia si aún lo menciona)
{
  const NEW = { es: 'Controles y accesibilidad avanzada llegan en la fase F9.', en: 'Controls and advanced accessibility arrive in phase F9.' };
  for (const l of ['es', 'en']) {
    const p = `data/localization/${l}.json`; if (!fs.existsSync(p)) continue;
    const cur = JSON.parse(rd(p)), v = cur['set.later'];
    if (typeof v === 'string' && /sonid|sound/i.test(v)) { cur['set.later'] = NEW[l]; wr(p, JSON.stringify(cur, null, 1) + '\n'); say(true, `${p}: nota «set.later» actualizada`); }
  }
}

// 2) main.js: importar e instalar (después de instalar escenarios y paneles meta, porque envuelve startMatch/endMatch y shop.buy)
patch('js/main.js', 'installAudio', [
  ["import { installMetaPanels } from './ui/meta-panels.js';", "import { installMetaPanels } from './ui/meta-panels.js';\nimport { installAudio } from './audio/audio-hook.js';"],
  ['installStages(scene, stages); installStageSelect(menu, { stages });',
   "installStages(scene, stages); installStageSelect(menu, { stages });\n    const audio = installAudio({ menu, scene, meta, stages });\n    if (dev) window.ewAudio = audio; // consola: ewAudio.sfx('hit_heavy', { element: 'fire' })"]
], 'docs/INTEGRACION-AUDIO.md, sección «Edición manual de main.js»');

// 3) package.json: npm test también corre las pruebas de audio
{
  const p = 'package.json', j = JSON.parse(rd(p));
  if (j.scripts?.test && !j.scripts.test.includes('test-audio')) { j.scripts.test += ' && node tools/test-audio.mjs'; wr(p, JSON.stringify(j, null, 1) + '\n'); say(true, 'package.json: npm test incluye audio'); }
  else say(true, 'package.json: ya estaba aplicado');
}

// 4) Checklist
{
  const p = 'docs/CHECKLIST.md';
  if (fs.existsSync(p) && !rd(p).includes('F9 (audio)'))
    { fs.appendFileSync(p, '\n| F9 (audio) | EN PROGRESO | Sonido 100 % sintetizado por código: 30 efectos con variantes por elemento, 5 piezas musicales (menú/combate), volúmenes de música y efectos, silencio, pausa con atenuación, sonidos de interfaz, tienda y logros | js/audio/*, js/systems/audio-manager.js, css/audio.css, audio-lab.html, tools/test-audio.mjs | `npm test` (audio) y medición en audio-lab.html (0 saturaciones, 0 silencios). **Pendiente tu escucha** | Conectar F3: `ew:sfx` o `audio.sfx(...)` (docs/INTEGRACION-AUDIO.md) |\n'); say(true, 'docs/CHECKLIST.md: fila F9 añadida'); }
  else say(true, 'docs/CHECKLIST.md: sin cambios');
}

console.log(report.join('\n'));
console.log(report.some(r => r.includes('AVISO')) ? '\nTermina los AVISOS a mano y ejecuta: npm run check && npm test' : '\nListo. Ahora: npm run check && npm test, y abre http://localhost:5173/?dev=1');
