// Herramienta de desarrollo: escuchar y medir todos los sonidos. Abre audio-lab.html con el servidor local.
import { AudioManager } from '../systems/audio-manager.js';
import { SFX, ELEMENTS, layersFor, durationOf } from './sfx-bank.js';
import { renderLayers } from './synth.js';
import { TRACKS, TRACK_IDS, MODES, renderTrack } from './music.js';

const $ = s => document.querySelector(s);
const audio = new AudioManager({ storage: null });
const el = () => $('#el').value || undefined;
const unlock = () => audio.unlock();

$('#v-music').oninput = e => { audio.setVolume('music', e.target.value / 100); };
$('#v-sfx').oninput = e => { audio.setVolume('sfx', e.target.value / 100); };
for (const id of TRACK_IDS) for (const mode of MODES) {
  const b = document.createElement('button'); b.textContent = `${id} · ${mode}`;
  b.onclick = async () => { await unlock(); audio.music(id, mode); document.querySelectorAll('#music button').forEach(x => x.classList.toggle('on', x === b)); };
  $('#music').append(b);
}
const stop = document.createElement('button'); stop.textContent = '■ parar'; stop.onclick = () => { audio.stopMusic(); document.querySelectorAll('#music button').forEach(x => x.classList.remove('on')); }; $('#music').append(stop);
for (const name of Object.keys(SFX)) {
  const b = document.createElement('button'); b.textContent = name; b.onclick = async () => { await unlock(); audio.last.clear(); audio.sfx(name, { element: el() }); }; $('#sfx').append(b);
}

// ---------- Medición ----------
const SR = 44100;
function fft(re, im) { // FFT radix-2 en sitio
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) { let cr = 1, ci = 0; for (let k = 0; k < len / 2; k++) {
      const a = i + k, b = a + len / 2, tr = re[b] * cr - im[b] * ci, ti = re[b] * ci + im[b] * cr;
      re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti; const nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr; } }
  }
}
function analyze(d) {
  let peak = 0, sum = 0, bad = 0, active = 0;
  for (let i = 0; i < d.length; i++) { const v = d[i]; if (!Number.isFinite(v)) { bad++; continue; } const a = Math.abs(v); if (a > peak) peak = a; if (a > 0.002) { sum += v * v; active++; } }
  const rms = active ? Math.sqrt(sum / active) : 0;
  let last = 0; for (let i = d.length - 1; i >= 0; i--) if (Math.abs(d[i]) > 0.003) { last = i; break; }
  let centroid = 0, wsum = 0; const N = 2048, re = new Float32Array(N), im = new Float32Array(N);
  for (let s = 0; s + N <= d.length; s += N * 2) {
    for (let i = 0; i < N; i++) { re[i] = d[s + i] * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / N)); im[i] = 0; }
    fft(re, im); for (let k = 1; k < N / 2; k++) { const m = Math.hypot(re[k], im[k]); centroid += m * k * SR / N; wsum += m; }
  }
  return { peak, rms, dur: last / SR, centroid: wsum ? centroid / wsum : 0, nan: bad };
}
async function renderOne(layers, seconds) {
  const oc = new OfflineAudioContext(1, Math.ceil(SR * seconds), SR), out = oc.createGain(); out.connect(oc.destination);
  layers(oc, out); const buf = await oc.startRendering(); return analyze(buf.getChannelData(0));
}

window.__measure = async () => {
  const rows = [];
  for (const [name, def] of Object.entries(SFX)) {
    const variants = ELEMENTS.some(e => layersFor(name, e).length !== def.layers.length) ? [undefined, ...ELEMENTS] : [undefined];
    for (const e of variants) {
      const L = layersFor(name, e), r = await renderOne((oc, out) => { const g = oc.createGain(); g.gain.value = def.trim; g.connect(out); renderLayers(oc, g, L, 0, { seed: 1 }); }, durationOf(L) + 0.4);
      rows.push({ kind: 'sfx', name: e ? `${name}@${e}` : name, ...r });
    }
  }
  for (const id of TRACK_IDS) for (const mode of MODES) {
    const bars = 4, secs = bars * 16 * 60 / TRACKS[id].bpm / 4;
    const r = await renderOne((oc, out) => { const g = oc.createGain(); g.gain.value = TRACKS[id].trim ?? 1; g.connect(out); renderTrack(oc, g, id, mode, bars); }, secs + 2.5);
    rows.push({ kind: 'music', name: `${id}/${mode}`, ...r });
  }
  const tb = rows.map(r => {
    const clip = r.peak > 0.98, silent = r.peak < 0.01 || r.nan > 0;
    return `<tr><td>${r.kind} · ${r.name}</td><td class="${clip ? 'bad' : ''}">${r.peak.toFixed(2)}</td><td>${r.rms.toFixed(3)}</td><td>${r.dur.toFixed(2)} s</td><td>${Math.round(r.centroid)} Hz</td><td class="${clip || silent ? 'bad' : 'ok'}">${silent ? 'silencio/NaN' : clip ? 'satura' : 'ok'}</td></tr>`;
  }).join('');
  $('#report').innerHTML = `<table><tr><th>sonido</th><th>pico</th><th>RMS</th><th>duración</th><th>brillo medio</th><th>estado</th></tr>${tb}</table>`;
  window.__audioReport = rows; return rows;
};
$('#measure').onclick = async () => { $('#status').textContent = ' midiendo…'; await window.__measure(); $('#status').textContent = ' listo'; };
