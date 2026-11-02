// Pruebas de F6 (lógica de escenarios, sin navegador): npm test
import fs from 'node:fs';
import { StageManager, validateStage, RANDOM } from '../js/stages/stage-manager.js';
let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FALLA ') + m); if (!c) fails++; };
const mem = (init = {}) => { const d = { ...init }; return { getItem: k => d[k] ?? null, setItem: (k, v) => { d[k] = String(v); }, d }; };
const stages = JSON.parse(fs.readFileSync('data/stages.json', 'utf8')).stages;

ok(stages.length === 6, 'hay 6 escenarios (Bosque, Cenizas, Mareas, Bastión, Viento, Equilibrio)');
ok(stages.every(s => validateStage(s).length === 0), 'todos los escenarios del JSON son válidos');
ok(new Set(stages.map(s => s.id)).size === stages.length, 'ids únicos');
ok(validateStage({ ...stages[0], sky: ['#fff'] }).length > 0, 'detecta cielo con un solo color');
ok(validateStage({ ...stages[0], fx: { kind: 'lava', count: 5, color: '#fff000' } }).length > 0, 'detecta efecto desconocido');
ok(validateStage({ ...stages[0], fog: { color: '#000000', density: 5 } }).length > 0, 'detecta niebla fuera de rango');

{ const m = new StageManager([...stages, { id: 'roto' }, stages[0]], { storage: mem() });
  ok(m.list.length === 6 && m.problems.some(p => p.startsWith('roto')) && m.problems.some(p => p.includes('repetido')), 'omite el escenario roto y el repetido sin romper el juego'); }

{ const s = mem(), m = new StageManager(stages, { storage: s });
  ok(m.selected === 'bosque', 'por defecto el primer escenario');
  ok(m.select('mareas') && m.selected === 'mareas', 'selecciona un escenario');
  ok(new StageManager(stages, { storage: s }).selected === 'mareas', 'la selección persiste al reiniciar');
  ok(!m.select('no_existe') && m.selected === 'mareas', 'rechaza un id desconocido');
  ok(m.select(RANDOM) && m.selected === RANDOM, 'permite «aleatorio»');
  ok(m.resolve(RANDOM, () => 0).id === 'bosque' && m.resolve(RANDOM, () => .999).id === 'equilibrio', 'el aleatorio cubre todo el rango'); }

ok(new StageManager(stages, { storage: mem({ 'ew.stage.v1': '{roto' }) }).selected === 'bosque', 'guardado corrupto → valor por defecto');
ok(new StageManager(stages, { storage: mem({ 'ew.stage.v1': '"fantasma"' }) }).selected === 'bosque', 'guardado con id inexistente → valor por defecto');
ok(new StageManager(stages, { storage: null }).select('viento'), 'funciona sin almacenamiento');

{ const m = new StageManager(stages, { storage: mem(), isUnlocked: s => s.id !== 'equilibrio' });
  ok(!m.select('equilibrio'), 'no se puede elegir un escenario bloqueado');
  ok(m.resolve('equilibrio').id === 'bosque', 'un escenario bloqueado cae al primero disponible');
  ok(m.resolve(RANDOM, () => .999).id === 'viento', 'el aleatorio excluye los bloqueados'); }

{ let built = null; const m = new StageManager(stages, { storage: mem(), build: (c, o) => (built = { id: c.id, o, react: e => { built.ev = e; } }) });
  m.create('cenizas', { particles: 50 }); ok(built.id === 'cenizas' && built.o.particles === 50, 'create() construye con la configuración elegida');
  m.react({ power: 1 }); ok(built.ev?.power === 1, 'react() llega al escenario actual');
  ok(new StageManager(stages, { storage: mem() }).create('bosque') === null, 'create() sin constructor no falla'); }

console.log(fails ? `${fails} prueba(s) fallaron` : 'Todas las pruebas de F6 pasaron'); process.exit(fails ? 1 : 0);
