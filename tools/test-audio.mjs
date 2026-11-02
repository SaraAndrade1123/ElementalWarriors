// Pruebas del audio (npm test). Sin navegador: usa un AudioContext simulado que cuenta los nodos creados.
import { SFX, ELEMENT_LAYERS, ELEMENTS, REQUIRED_SFX, layersFor, durationOf } from '../js/audio/sfx-bank.js';
import { TRACKS, TRACK_IDS, MODES, trackFor, renderTrack } from '../js/audio/music.js';
import { renderLayers, mulberry32 } from '../js/audio/synth.js';
import { AudioManager, volToGain, MAX_VOICES } from '../js/systems/audio-manager.js';
import { MovementSounds } from '../js/audio/movement-sounds.js';

let bad = 0;
const ok = (c, m) => { console.log(`${c ? 'ok  ' : 'FALLA'} ${m}`); if (!c) bad++; };
const throws = fn => { try { fn(); return false; } catch { return true; } };

// ---------- AudioContext simulado ----------
const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {}, cancelScheduledValues() {} });
class FakeCtx {
  constructor() { this.sampleRate = 44100; this.currentTime = 0; this.state = 'suspended'; this.count = 0; this.destination = {}; }
  #n(extra = {}) { this.count++; return { connect(n) { return n; }, disconnect() {}, start() {}, stop() {}, frequency: param(), gain: param(), Q: param(), detune: param(), ...extra }; }
  createOscillator() { return this.#n({ type: 'sine' }); } createGain() { return this.#n(); } createBiquadFilter() { return this.#n({ type: 'lowpass' }); }
  createBufferSource() { return this.#n({ buffer: null, loop: false }); } createStereoPanner() { return this.#n({ pan: param() }); }
  createDynamicsCompressor() { return this.#n({ threshold: param(), knee: param(), ratio: param(), attack: param(), release: param() }); }
  createBuffer(ch, len) { const d = new Float32Array(len); return { getChannelData: () => d }; }
  resume() { this.state = 'running'; return Promise.resolve(); } suspend() { this.state = 'suspended'; return Promise.resolve(); }
}
const mem = () => { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), _m: m }; };

// ---------- Banco de efectos ----------
const TYPES = ['osc', 'noise', 'crackle', 'bubbles'], WAVES = ['sine', 'square', 'sawtooth', 'triangle'], FT = ['lowpass', 'highpass', 'bandpass'];
ok(REQUIRED_SFX.every(n => SFX[n]), 'existen todos los efectos que el combate necesita');
let layerErr = [];
for (const [name, def] of Object.entries(SFX)) {
  if (!(def.trim > 0.05 && def.trim < 5)) layerErr.push(`${name}: trim fuera de rango`);
  if (!(def.cd >= 0)) layerErr.push(`${name}: cd inválido`);
  for (const L of [...def.layers, ...Object.values(ELEMENT_LAYERS[name] ?? {}).flat()]) {
    if (!TYPES.includes(L.type)) { layerErr.push(`${name}: tipo ${L.type}`); continue; }
    if (!(L.gain > 0 && L.gain <= 1)) layerErr.push(`${name}: gain ${L.gain}`);
    if ((L.delay ?? 0) < 0 || (L.delay ?? 0) > 2) layerErr.push(`${name}: delay`);
    if (L.type === 'osc') {
      if (!(L.f0 >= 20 && L.f0 <= 20000) || (L.f1 && !(L.f1 >= 20 && L.f1 <= 20000))) layerErr.push(`${name}: frecuencia osc`);
      if (!WAVES.includes(L.wave ?? 'sine')) layerErr.push(`${name}: onda`);
    }
    if (L.type === 'noise' && (!FT.includes(L.filter.type) || !(L.filter.f0 >= 20 && L.filter.f0 <= 20000) || (L.filter.f1 && !(L.filter.f1 >= 20 && L.filter.f1 <= 20000)))) layerErr.push(`${name}: filtro de ruido`);
    if (L.type === 'osc' || L.type === 'noise') if (!(L.dur > 0.01 && L.dur <= 3)) layerErr.push(`${name}: dur ${L.dur}`);
    if (L.type === 'crackle' || L.type === 'bubbles') if (!(L.count >= 1 && L.count <= 40 && L.span > 0 && L.span <= 2)) layerErr.push(`${name}: count/span`);
  }
}
ok(!layerErr.length, `todas las capas tienen valores válidos${layerErr.length ? ' → ' + layerErr.slice(0, 4).join('; ') : ''}`);
ok(Object.entries(ELEMENT_LAYERS).every(([n, v]) => SFX[n] && Object.keys(v).every(e => ELEMENTS.includes(e))), 'las variantes por elemento apuntan a efectos y elementos reales');
ok(Object.keys(SFX).every(n => ELEMENTS.every(e => { const d = durationOf(layersFor(n, e)); return Number.isFinite(d) && d > 0 && d < 3.5; })), 'ningún efecto dura más de 3,5 s');
ok(layersFor('nope', 'fire') === null, 'un efecto inexistente devuelve null');
ok(ELEMENTS.every(e => layersFor('hit_heavy', e).length > SFX.hit_heavy.layers.length), 'los golpes tienen capa propia por elemento');

// ---------- Música ----------
ok(TRACK_IDS.length >= 9 && ELEMENTS.every(e => TRACKS[e]) && TRACKS.neutral && ['epic', 'synth', 'lofi', 'drums'].every(k => TRACKS[k]?.lead?.length >= 4), 'hay una pieza por elemento, una neutra y 4 canciones extra con melodía');
ok(TRACK_IDS.every(id => { const t = TRACKS[id]; return t.bpm >= 50 && t.bpm <= 180 && t.chords.length >= 2 && t.chords.every(c => c.length >= 3 && c.every(Number.isInteger)) && MODES.every(m => t.arp[m].length === 16 && t.drums[m].length === 16 && t.arp[m].every(a => Number.isInteger(a) && a >= -1 && a < 8) && /^[kshtT.]+$/.test(t.drums[m])) && t.trim >= 0.5 && t.trim <= 2; }), 'compases, acordes, patrones y trim válidos en todas las piezas');
ok(trackFor('fire') === 'fire' && trackFor('xyz') === 'neutral' && trackFor(undefined) === 'neutral', 'un elemento desconocido usa la pieza neutra');
{
  const c = new FakeCtx(), out = c.createGain(); let all = true, max = 0;
  for (const id of TRACK_IDS) for (const m of MODES) { const before = c.count, d = renderTrack(c, out, id, m, 2); max = Math.max(max, c.count - before); all &&= d > 3; }
  ok(all, 'renderTrack programa todas las piezas y modos sin errores');
  ok(max < 2500, `2 compases usan un número razonable de nodos (máx. ${max})`);
}
{
  const c = new FakeCtx(), a = c.createGain(), b = c.createGain(), base = c.count;
  renderLayers(c, a, layersFor('hit_heavy', 'fire'), 0, { seed: 5 }); const first = c.count - base, mid = c.count;
  renderLayers(c, b, layersFor('hit_heavy', 'fire'), 0, { seed: 5 }); const second = c.count - mid;
  ok(first > 10 && first === second, `mismo seed → mismo número de nodos (${first} = ${second}, reproducible)`);
  const r1 = mulberry32(3), r2 = mulberry32(3); ok(r1() === r2() && r1() !== mulberry32(4)(), 'el generador con semilla es determinista');
  ok(throws(() => renderLayers(c, a, [{ type: 'raro' }], 0)), 'una capa de tipo desconocido lanza un error claro');
}

// ---------- AudioManager ----------
ok(volToGain(0) === 0 && volToGain(1) === 1 && volToGain(0.5) < 0.5 && volToGain(2) === 1 && volToGain(-1) === 0, 'volToGain: curva perceptual y límites');
{
  const a = new AudioManager({ storage: null, AudioCtor: null });
  ok(!a.available && a.sfx('hit_heavy') === false && (a.music('fire'), true), 'sin WebAudio no lanza errores y queda en silencio');
}
{
  const s = mem(), a = new AudioManager({ storage: s, AudioCtor: FakeCtx });
  ok(a.sfx('ui_click') === false, 'antes del primer gesto no suena nada');
  a.music('water', 'battle');
  await a.unlock();
  ok(a.ready && a.nowPlaying?.track === 'water' && a.nowPlaying?.mode === 'battle', 'la música pedida antes del gesto arranca al desbloquear');
  ok(a.sfx('hit_light', { element: 'fire', x: 4 }) === true, 'tras el gesto suenan los efectos (con paneo)');
  ok(a.sfx('hit_light') === false, 'el mismo efecto no se repite dentro de su tiempo de espera (cd)');
  ok(a.sfx('no_existe') === false, 'un efecto desconocido se ignora');
  a.music('water', 'menu'); ok(a.nowPlaying.track === 'water' && a.nowPlaying.mode === 'menu', 'mismo tema: solo cambia de modo, sin reiniciar');
  a.music('earth', 'menu'); ok(a.nowPlaying.track === 'earth', 'otro elemento: cambia de pieza');
  a.music('inexistente', 'menu'); ok(a.nowPlaying.track === 'neutral', 'elemento desconocido → pieza neutra');
  a.stopMusic(0.01); ok(a.nowPlaying === null, 'stopMusic detiene la música');
  a.setVolume('music', 5); a.setVolume('sfx', -3);
  ok(a.settings.music === 1 && a.settings.sfx === 0, 'los volúmenes se limitan a 0–1');
  ok(a.setVolume('sfx', NaN) === false && a.setVolume('muted', 1) === false && a.setVolume('xx', 1) === false, 'valores inválidos se rechazan');
  a.setMuted(true); a.last.clear(); ok(a.sfx('ui_confirm') === false, 'en silencio no suena nada');
  a.setMuted(false); a.setVolume('sfx', 0.8);
  const saved = JSON.parse(s._m.get('ew.audio.v1')); ok(saved.music === 1 && saved.muted === false, 'los ajustes se guardan');
  const b = new AudioManager({ storage: s, AudioCtor: FakeCtx }); ok(b.settings.music === 1 && b.settings.sfx === 0.8, 'los ajustes se recuperan al reiniciar');
  a.reset(); ok(a.settings.music === 0.5 && a.settings.sfx === 0.8 && !a.settings.muted, 'reset vuelve a los valores por defecto');
  a.last.clear(); a.setHidden(true); ok(a.sfx('ui_confirm') === false, 'con la pestaña oculta no suena nada'); a.setHidden(false);
  // límite de voces
  a.last.clear(); a.active = MAX_VOICES; ok(a.sfx('ui_hover') === false && a.sfx('hit_heavy') === true, `con ${MAX_VOICES} voces solo pasan los golpes pesados`);
  a.player.dispose(); b.player?.dispose();
}
{
  const bad1 = new AudioManager({ storage: { getItem: () => '{roto', setItem() {} }, AudioCtor: FakeCtx });
  const bad2 = new AudioManager({ storage: { getItem: () => JSON.stringify({ music: 'alto', sfx: 9, voice: null, muted: 'si' }), setItem() {} }, AudioCtor: FakeCtx });
  ok(bad1.settings.music === 0.5, 'guardado corrupto → valores por defecto');
  ok(bad2.settings.music === 0.5 && bad2.settings.sfx === 1 && bad2.settings.muted === false, 'valores inválidos o fuera de rango se corrigen');
  const nostore = new AudioManager({ storage: { getItem() { throw new Error('bloqueado'); }, setItem() { throw new Error('bloqueado'); } }, AudioCtor: FakeCtx });
  nostore.setVolume('music', 0.2); ok(nostore.settings.music === 0.2, 'sin acceso al almacenamiento sigue funcionando');
  const boom = new AudioManager({ storage: null, AudioCtor: class { constructor() { throw new Error('sin dispositivo'); } } });
  ok((await boom.unlock()) === false && !boom.available && boom.sfx('ui_click') === false, 'si el contexto no se puede crear, el audio se desactiva sin romper el juego');
}

// ---------- Pasos, salto y aterrizaje ----------
{
  const calls = [], audio = { sfx: (n, o) => calls.push([n, o]) }, mv = new MovementSounds(audio);
  const names = () => calls.map(c => c[0]), mk = () => ({ paused: false, f: [{ air: false, vy: 0, x: -2, walk: 5, state: 'idle' }, { air: false, vy: 0, x: 2, walk: 5, state: 'idle' }] });
  const m = mk();
  mv.update(m, 0.016); ok(!calls.length, 'quieto: no suena nada');
  m.f[0].state = 'walk'; for (let i = 0; i < 60; i++) mv.update(m, 1 / 60);
  const steps = names().filter(n => n === 'step').length; ok(steps >= 3 && steps <= 5, `caminar 1 s a 60 FPS da pasos a buen ritmo (${steps})`);
  calls.length = 0; m.f[0].state = 'idle'; m.f[0].air = true; m.f[0].vy = 12; mv.update(m, 0.016); mv.update(m, 0.016);
  ok(names().join() === 'jump', 'despegar suena una sola vez, aunque pasen varios fotogramas en el aire');
  m.f[0].vy = -14; mv.update(m, 0.016); calls.length = 0; m.f[0].air = false; m.f[0].vy = 0; mv.update(m, 0.016);
  ok(names().join() === 'land' && calls[0][1].vol === 1, 'aterrizar suena «land» con la fuerza de la caída (usa la última velocidad en el aire)');
  calls.length = 0; m.f[0].air = true; m.f[0].vy = 2; mv.update(m, 0.016); m.f[0].vy = -3; mv.update(m, 0.016); calls.length = 0; m.f[0].air = false; m.f[0].vy = 0; mv.update(m, 0.016);
  ok(calls[0][1].vol >= 0.35 && calls[0][1].vol < 0.5, 'una caída suave suena más flojo (con mínimo audible)');
  calls.length = 0; m.f[0].state = 'walk'; m.f[0].air = true; for (let i = 0; i < 30; i++) mv.update(m, 1 / 60); ok(!names().includes('step'), 'en el aire no suenan pasos');
  m.f[0].air = false; calls.length = 0; m.paused = true; for (let i = 0; i < 60; i++) mv.update(m, 1 / 60); ok(!calls.length, 'en pausa no suena nada');
  ok((mv.update(null, 0.016), mv.update({}, 0.016), mv.update({ f: 5 }, 0.016), true), 'sin combate o con un formato distinto (F3) no falla');
  const slow = new MovementSounds({ sfx: n => calls.push([n]) }), ms = mk(); ms.f[1].state = 'walk'; calls.length = 0; for (let i = 0; i < 6; i++) slow.update(ms, 0.25);
  ok(calls.filter(c => c[0] === 'step').length >= 3, 'con pocos FPS (4) los pasos siguen sonando a un ritmo razonable');
}

console.log(bad ? `\n${bad} prueba(s) de audio fallaron` : '\nTodas las pruebas de audio pasaron');
process.exit(bad ? 1 : 0);
