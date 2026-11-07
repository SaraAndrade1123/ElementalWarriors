// Pruebas de F8: guardado, Rose Gold, tienda, recompensas, logros y paletas (npm test)
import { readFileSync } from 'node:fs';
import { SaveSystem, MemoryStorage, sanitize, defaults } from '../js/systems/save-system.js';
import { Progression } from '../js/systems/progression-system.js';
import { Wallet } from '../js/systems/currency-system.js';
import { createMeta } from '../js/systems/meta.js';
import { hueShift, applyPalette } from '../js/systems/palette.js';
import { PALETTE_MODELS } from '../js/systems/palette-models.js';
const rd = p => JSON.parse(readFileSync(new URL('../' + p, import.meta.url), 'utf8'));
const items = rd('data/items.json').items, achievements = rd('data/achievements.json').achievements, economy = rd('data/economy.json'), roster = rd('data/characters.json').roster;
let fails = 0; const ok = (n, c) => { console.log((c ? 'ok   ' : 'FALLA ') + n); if (!c) fails++; };
const fresh = (storage = new MemoryStorage()) => ({ storage, ...createMeta({ items, achievements, economy, storage }) });
const win = (o = {}) => ({ matchId: 'm' + Math.random(), mode: 'arcade', outcome: 'win', characterId: 'ignis', roundsWon: 2, difficulty: 'normal', maxCombo: 1, ...o });
const quiet = fn => { const w = console.warn; console.warn = () => {}; try { return fn(); } finally { console.warn = w; } };

// Guardado
quiet(() => {
  const bad = new MemoryStorage(); bad.setItem('ew.save.v1', '{no es json');
  ok('JSON corrupto -> valores iniciales', new SaveSystem(bad).data.gold.balance === 0);
  const nw = new MemoryStorage(); nw.setItem('ew.save.v1', JSON.stringify({ v: 99, gold: { balance: 500 } })); const s = new SaveSystem(nw);
  s.commit(d => { d.gold.balance = 1; return { ok: true }; });
  ok('versión futura: se ignora y no se sobrescribe', s.readOnly && JSON.parse(nw.getItem('ew.save.v1')).gold.balance === 500);
  const full = { getItem: () => null, setItem() { throw new Error('lleno'); } }, f = new SaveSystem(full);
  f.commit(d => { d.gold.balance = 7; d.gold.earned = 7; return { ok: true }; }); // (v1.11) el saldo nunca supera lo ganado
  ok('sin almacenamiento: avisa y sigue en memoria', f.persistent === false && f.data.gold.balance === 7);
});
const s0 = sanitize({ gold: { balance: -5, earned: NaN, spent: 1e12 }, owned: ['a', 'a', 7, 'b'], equipped: { 'x y': 'z', ok: 'v' }, stats: { wins: 'x', maxCombo: 1e9 } });
ok('sanitize limita números y limpia listas', s0.gold.balance === 0 && s0.gold.earned === 9999999 && s0.gold.spent === 9999999 /* (v1.11) sin «ganado» válido se reconstruye: saldo + gastado */ && s0.owned.join() === 'a,b' && !('x y' in s0.equipped) && s0.stats.wins === 0 && s0.stats.maxCombo === 1e6);
{ const { storage, shop, wallet } = fresh(); wallet.add(100); const again = new SaveSystem(storage); ok('el progreso persiste entre sesiones', again.data.gold.balance === 100); }

// Rose Gold
{ const { wallet } = fresh();
  ok('add rechaza 0, negativos y decimales', !wallet.add(0).ok && !wallet.add(-3).ok && !wallet.add(1.5).ok && wallet.balance === 0);
  wallet.add(50); ok('gastar más de lo que hay falla sin cambiar saldo', wallet.spend(80).error === 'funds' && wallet.balance === 50);
  ok('gastar actualiza gastado', wallet.spend(20).ok && wallet.balance === 30 && wallet.save.data.gold.spent === 20); }

// Tienda
{ const { shop, wallet, save } = fresh(); const it = items[0];
  ok('comprar sin fondos: no cobra ni entrega', shop.buy(it.id).error === 'funds' && !shop.owns(it.id) && wallet.balance === 0);
  wallet.add(400); const r1 = shop.buy(it.id), r2 = shop.buy(it.id);
  ok('doble compra solo cobra una vez', r1.ok && r2.error === 'owned' && save.data.gold.spent === it.price && save.data.stats.purchases === 1 && save.data.owned.length === 1);
  ok('objeto desconocido', shop.buy('nope').error === 'unknown');
  const other = items.find(i => i.char !== it.char);
  ok('no se puede equipar lo no comprado', shop.equip(other.id).error === 'locked' && shop.paletteOf(other.char) === null);
  shop.equip(it.id); ok('equipar devuelve su paleta', shop.paletteOf(it.char)?.hue === it.hue);
  shop.unequip(it.char); ok('quitar vuelve al original', shop.paletteOf(it.char) === null); }

// Recompensas
{ const { progression, wallet } = fresh();
  ok('arcade normal, victoria, 2 rondas = 50', progression.rewardFor({ mode: 'arcade', outcome: 'win', roundsWon: 2, difficulty: 'normal' }) === 50);
  ok('versus local paga la mitad', progression.rewardFor({ mode: 'versus_local', outcome: 'win', roundsWon: 2, difficulty: 'normal' }) === 25);
  ok('dificultad difícil x1.4', progression.rewardFor({ mode: 'arcade', outcome: 'win', roundsWon: 2, difficulty: 'hard' }) === 70);
  const m = win({ matchId: 'x1' }); const a = progression.recordMatch(m), b = progression.recordMatch(m);
  ok('mismo matchId no paga dos veces', a.ok && b.error === 'duplicate' && progression.save.data.stats.matches === 1);
  const before = wallet.balance; const t = progression.recordMatch(win({ mode: 'training' }));
  ok('entrenamiento no cuenta ni paga', t.ignored && wallet.balance === before && progression.save.data.stats.matches === 1);
  ok('datos inválidos rechazados', !progression.recordMatch({}).ok && !progression.recordMatch(win({ outcome: 'ganó' })).ok && !progression.recordMatch(win({ matchId: '' })).ok); }

// Logros
{ const { progression, wallet, save } = fresh();
  const r = progression.recordMatch(win({ maxCombo: 4 }));
  ok('primera victoria + primer combo pagan sus logros', r.unlocked.includes('first_win') && r.unlocked.includes('first_combo') && r.bonus === 75);
  const bal = wallet.balance; const r2 = progression.recordMatch(win()); 
  ok('un logro se paga una sola vez', r2.unlocked.length === 0 && wallet.balance === bal + r2.gold);
  for (const c of ['aqua', 'terra', 'zephyr']) progression.recordMatch(win({ characterId: c }));
  ok('ganar con los 4 guerreros desbloquea win_all', save.data.done.includes('win_all'));
  progression.recordEvent('arcade_clear'); ok('evento arcade_clear', save.data.done.includes('arcade_clear')); }
{ const seen = [], meta = fresh(); meta.progression.onUnlock = l => seen.push(...l.map(a => a.id)); meta.wallet.add(500); meta.shop.buy(items[0].id);
  ok('comprar dispara first_purchase', seen.includes('first_purchase') && meta.save.data.done.includes('first_purchase')); }

// Datos
ok('ids de objetos únicos y precios enteros > 0', new Set(items.map(i => i.id)).size === items.length && items.every(i => Number.isInteger(i.price) && i.price > 0));
ok('cada objeto pertenece a un guerrero existente (las armas son de todos: char "*")', items.every(i => i.type === 'weapon' ? i.char === '*' : roster.some(r => r.id === i.char)));
{ const P = new Progression({ data: defaults() }, { economy: {}, achievements: [] }), keys = new Set(Object.keys(P.derive(defaults()))); for (const r of roster) keys.add('wins_' + r.id); // todo lo que deriva la progresión
  ok('logros usan estadísticas válidas', achievements.every(a => keys.has(a.stat) && a.gte > 0 && a.reward > 0)); }

// Paletas
{ const px = new Uint8ClampedArray([200, 40, 20, 255, 90, 90, 90, 255, 10, 20, 30, 0]), o = [...px];
  hueShift(px, 0); ok('hue 0 no cambia nada', o.every((v, i) => v === px[i]));
  const g = new Uint8ClampedArray([90, 90, 90, 255]); hueShift(g, 137, 1.4); ok('un gris sigue siendo gris', Math.abs(g[0] - g[1]) <= 1 && Math.abs(g[1] - g[2]) <= 1);
  const t = new Uint8ClampedArray(o); hueShift(t, 360); ok('hue 360 ≈ original', o.every((v, i) => Math.abs(v - t[i]) <= 1));
  const c = new Uint8ClampedArray(o); hueShift(c, 120); ok('hue 120 cambia el color pero no el alfa', c[0] !== o[0] && c[3] === 255 && c[11] === 0); }


// Paletas por color (F8.1)
{ const HEX = /^#[0-9a-f]{6}$/i, sale = items.filter(i => !i.hidden && i.type === 'palette');
  ok('3 paletas a la venta por guerrero', roster.every(r => sale.filter(i => i.char === r.id).length === 3));
  ok('cada paleta usa ranuras que existen en el modelo del guerrero', sale.every(i => Object.keys(i.slots).every(k => k in PALETTE_MODELS[i.char].slots)));
  ok('colores de paleta, aura y muestra son hexadecimales válidos', sale.every(i => Object.values(i.slots).every(c => HEX.test(c)) && HEX.test(i.fx.color) && HEX.test(i.fx.light) && i.swatch.length === 3 && i.swatch.every(c => HEX.test(c))));
  ok('los colores de referencia del modelo son hexadecimales válidos', Object.values(PALETTE_MODELS).every(m => [...Object.values(m.slots).flat(), ...m.keep].every(c => HEX.test(c))));
  const px = (...c) => new Uint8ClampedArray(c.flatMap(x => [...[1, 3, 5].map(i => parseInt(x.slice(i, i + 2), 16)), 255]));
  const m = PALETTE_MODELS.ignis;
  const a = px('#641913', '#efd3bd', '#00ff00', '#431311'); applyPalette(a, m, { cloth: '#1e6bff' });
  ok('el color principal pasa exactamente al color nuevo', Math.abs(a[0] - 0x1e) <= 1 && Math.abs(a[1] - 0x6b) <= 1 && Math.abs(a[2] - 0xff) <= 1);
  ok('la piel no cambia', a[4] === 0xef && a[5] === 0xd3 && a[6] === 0xbd);
  ok('un color desconocido no se toca', a[8] === 0 && a[9] === 255 && a[10] === 0);
  ok('una sombra de la ranura da un tono más oscuro del color nuevo', a[12] < a[0] && a[14] < a[2] && a[14] > 100);
  const b = px('#641913', '#a47c2c'); applyPalette(b, m, { cloth: '#1e6bff', eyes: '#ffffff' }, { only: ['eyes'] });
  ok('"only" limita a las ranuras indicadas (cabeza: solo ojos)', b[0] === 0x64 && b[4] > 200);
  const c = px('#7c5434'); applyPalette(c, m, { eyes: '#ffffff' }, { flat: ['eyes'] });
  ok('"flat" da brillo uniforme sin sombreado', c[0] === 255 && c[1] === 255 && c[2] === 255);
  const d = new Uint8ClampedArray([0x64, 0x19, 0x13, 0]); applyPalette(d, m, { cloth: '#1e6bff' });
  ok('los pixeles transparentes no se tocan', d[0] === 0x64 && d[3] === 0);
  // objetos antiguos ya comprados: se conservan y se pueden equipar, pero no se venden ni se pueden comprar
  const { shop, save, wallet } = fresh(); const old = items.find(i => i.hidden);
  save.commit(dd => { dd.owned.push(old.id); return { ok: true }; });
  ok('lo antiguo ya comprado aparece en la colección, no en la tienda', shop.ownedOf(old.char).some(i => i.id === old.id) && !shop.list(old.char).some(i => i.id === old.id));
  wallet.add(900); ok('un objeto antiguo ya no se puede comprar', shop.buy(items.find(i => i.hidden && i.id !== old.id).id).error === 'unknown');
  const nw = sale.find(i => i.char === 'ignis'); shop.buy(nw.id); shop.equip(nw.id);
  ok('la paleta equipada entrega sus colores de aura', shop.fxOf('ignis')?.light === nw.fx.light && shop.paletteOf('ignis').id === nw.id); }

console.log(fails ? `\n${fails} prueba(s) fallaron` : '\nTodas las pruebas de F8 pasaron'); process.exit(fails ? 1 : 0);
