// Aplica F6 (escenarios) con ediciones mínimas e idempotentes. Ejecutar desde la raíz: node tools/apply-f6.mjs
import fs from 'node:fs';
const rd = p => fs.readFileSync(p, 'utf8'), wr = (p, s) => fs.writeFileSync(p, s);
const say = (ok, m) => console.log((ok ? '  OK  ' : ' AVISO ') + m);

for (const l of ['es', 'en']) {
  const p = `data/localization/${l}.json`, cur = JSON.parse(rd(p)), add = JSON.parse(rd(`patch/locales-f6-${l}.json`)); let n = 0;
  for (const [k, v] of Object.entries(add)) if (!(k in cur)) { cur[k] = v; n++; }
  wr(p, JSON.stringify(cur, null, 1) + '\n'); say(true, `${p}: ${n} claves añadidas`);
}

function patch(file, marker, edits, hint) {
  if (!fs.existsSync(file)) return say(false, `${file}: no existe (${hint})`);
  let s = rd(file); if (s.includes(marker)) return say(true, `${file}: ya estaba aplicado`);
  for (const [a] of edits) if (!s.includes(a)) return say(false, `${file}: no encontré «${a.trim().slice(0, 50)}…». Hazlo a mano: ${hint}`);
  for (const [a, r] of edits) s = s.replace(a, () => r);
  wr(file, s); say(true, `${file}: actualizado`);
}

patch('js/main.js', 'installStages', [
  ["import { Input } from './game/input.js';", "import { Input } from './game/input.js';\nimport { StageManager } from './stages/stage-manager.js';\nimport { installStages } from './stages/stage-hook.js';\nimport { installStageSelect } from './ui/stage-select.js';"],
  ["const [{ roster }, { items }, shopData, achData, economy] = await Promise.all([json('data/characters.json'), json('data/menu.json'), json('data/items.json'), json('data/achievements.json'), json('data/economy.json')]);",
   "const [{ roster }, { items }, shopData, achData, economy, stageData] = await Promise.all([json('data/characters.json'), json('data/menu.json'), json('data/items.json'), json('data/achievements.json'), json('data/economy.json'), json('data/stages.json')]);"],
  ['let paused = false;', "const stages = new StageManager(stageData.stages);\n    stages.problems.forEach(p => console.warn('[stages]', p));\n    installStages(scene, stages); installStageSelect(menu, { stages });\n    if (dev) window.ewStages = stages; // consola: ewStages.react({ power: 1 })\n    let paused = false;"]
], 'docs/INTEGRACION-F6.md');

patch('tools/check.mjs', 'stages.json', [
  ["const ref = Object.keys(langs.es);", "const stg = rd('data/stages.json').stages;\nneed.push(...stg.flatMap(s => [`stage.${s.id}.name`, `stage.${s.id}.desc`, `stage.el.${s.element}`]));\nconst ref = Object.keys(langs.es);"]
], 'añade las claves stage.<id>.name/desc a la lista `need`');

patch('package.json', 'test-stages', [
  ['node tools/test-progression.mjs', 'node tools/test-progression.mjs && node tools/test-stages.mjs']
], 'añade `&& node tools/test-stages.mjs` a "test"');

// Checklist: añade la fila de F6 si no existe
{
  const p = 'docs/CHECKLIST.md';
  if (fs.existsSync(p)) {
    let c = rd(p);
    if (!c.includes('F6 (parcial)')) { c = c.trimEnd() + '\n\n| F6 (parcial) | EN PROGRESO | 6 escenarios por datos + selector en «Jugar» (ver docs/INTEGRACION-F6.md) | js/stages/*, js/ui/stage-select.js, data/stages.json | npm test (F6) y navegador headless | Contornos, transiciones y reacciones reales (con F3) |\n'; wr(p, c); say(true, p + ': fila F6 añadida'); }
    else say(true, p + ': ya tenía F6');
  }
}
