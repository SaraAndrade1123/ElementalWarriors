// Comprueba datos, rutas e idiomas (npm run check)
import { readFileSync, existsSync, readdirSync } from 'node:fs';
const rd = p => JSON.parse(readFileSync(p, 'utf8'));
const roster = rd('data/characters.json').roster, menu = rd('data/menu.json').items;
const langs = Object.fromEntries(readdirSync('data/localization').map(f => [f.replace('.json', ''), rd('data/localization/' + f)]));
let bad = 0; const err = m => { console.error(m); bad++; };
for (const c of roster) if (!existsSync(c.model)) err(`FALTA modelo: ${c.id} -> ${c.model}`);
const need = ['ann.fight','ann.ko','result.again','result.menu','play.title','play.go','hud.pause','pause.resume','pause.restart','pause.menu','guide.title',...menu.map(m => 'menu.' + m.id), ...roster.flatMap(c => ['alias', 'element', 'desc', 'weapon', 'style', 'special', 'transformation'].map(k => `char.${c.id}.${k}`))];
const items = rd('data/items.json').items, achs = rd('data/achievements.json').achievements;
for (const i of items) if (i.type !== 'weapon' && !roster.some(c => c.id === i.char)) err(`Objeto ${i.id}: guerrero desconocido ${i.char}`);
need.push(...items.map(i => 'item.' + i.id), ...achs.flatMap(a => [`ach.${a.id}.name`, `ach.${a.id}.desc`]));
const stg = rd('data/stages.json').stages;
const modes = rd('data/modes.json');
const { CHALLENGES } = await import('../js/modes/challenges.js');
need.push(...CHALLENGES.flatMap(c => [`ch.${c.id}.name`, `ch.${c.id}.goal`]), ...roster.flatMap(c => [`story.${c.id}.intro`, `story.${c.id}.ending`, `story.rival.${c.id}.pre`, `story.rival.${c.id}.post`]), ...modes.levels.flatMap(l => [`level.${l}`, `level.desc.${l}`]), 'story.prologue.1', 'story.prologue.2', 'story.fin');
for (const [h, rs] of Object.entries(modes.order)) { if (!roster.some(c => c.id === h)) err(`modes.json: guerrero desconocido ${h}`); if (rs.includes(h)) err(`modes.json: ${h} se enfrenta a sí mismo`); for (const r of rs) if (!roster.some(c => c.id === r)) err(`modes.json: rival desconocido ${r}`); }
for (const s of [...Object.values(modes.stageByElement), modes.finalStage]) if (!stg.some(x => x.id === s)) err(`modes.json: escenario desconocido ${s}`);
need.push(...stg.flatMap(s => [`stage.${s.id}.name`, `stage.${s.id}.desc`, `stage.el.${s.element}`]));
const ref = Object.keys(langs.es);
for (const [l, d] of Object.entries(langs)) {
  for (const k of need) if (!d[k]) err(`[${l}] falta ${k}`);
  for (const k of ref) if (!(k in d)) err(`[${l}] falta la clave ${k}`);
  for (const k of Object.keys(d)) if (!(k in langs.es)) err(`[${l}] clave sobrante ${k}`);
}
console.log(bad ? `${bad} problema(s)` : `OK: ${roster.length} personajes, menú e idiomas (${Object.keys(langs).join(', ')}) válidos`);
process.exit(bad ? 1 : 0);
