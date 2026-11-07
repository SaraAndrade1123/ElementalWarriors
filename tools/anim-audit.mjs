// Auditoría de fluidez (node tools/anim-audit.mjs [segundos]): combates IA contra IA de todas las parejas y mide los
// «tirones» de cada canal de la pose: cambios bruscos de velocidad entre fotogramas (aceleración anómala) y saltos.
// Agrupa por guerrero y por la transición o clip en que ocurren, para saber qué arreglar. No es una prueba (no falla).
import { readFileSync } from 'node:fs';
import { Fighter, separate, resolveBoth, resolveThrows, stepProjectiles, makeProjectile } from '../js/game/fighter.js';
import { CpuBrain } from '../js/game/ai.js';
import { STYLES } from '../js/game/animation/styles.js';
import { Director } from '../js/game/animation/director.js';
import { CH, IDX } from '../js/game/animation/pose.js';
const MOVES = JSON.parse(readFileSync('data/moves.json', 'utf8')), { roster } = JSON.parse(readFileSync('data/characters.json', 'utf8'));
const DT = 1 / 60, SECS = +process.argv[2] || 30, L = 1.6;
const POS = new Set(['comX', 'comY', 'comZ', 'hnFx', 'hnFy', 'hnFz', 'hnBx', 'hnBy', 'hnBz', 'ftFx', 'ftFy', 'ftFz', 'ftBx', 'ftBy', 'ftBz']);
const SKIP = new Set(['wpSpin', 'comYaw']);
const lim = c => POS.has(c) ? (c.startsWith('com') ? .03 * L : .04) : /fist|flare/.test(c) ? .25 : .08; // cambio mínimo por fotograma para contar // tope de cambio de velocidad por fotograma
export function audit({ secs = SECS, seeds = 2, levels = ['hard', 'expert'], onFrame } = {}) {
  const stats = {}, total = { frames: 0, pops: 0 };
  for (const A of roster) for (const B of roster) for (let seed = 1; seed <= seeds; seed++) {
    let s = seed * 7919 + A.id.length * 31 + B.id.length; const rng = () => (s = (s * 16807) % 2147483647) / 2147483647;
    const a = new Fighter(A, -2.2, 1, MOVES), b = new Fighter(B, 2.2, -1, MOVES);
    const ba = new CpuBrain(rng, levels[seed % levels.length]), bb = new CpuBrain(rng, levels[(seed + 1) % levels.length]);
    const D = [new Director(STYLES[A.id], { legLen: L }), new Director(STYLES[B.id], { legLen: L })], proj = [];
    const hist = D.map(() => ({ p: null, v: null, vv: null, key: '', pkey: '' }));
    for (let i = 0; i < 60 * secs; i++) {
      a.update(DT, ba.think(DT, a, b), b); b.update(DT, bb.think(DT, b, a), a); separate(a, b); resolveThrows(a, b); resolveBoth(a, b);
      for (const f of [a, b]) for (const e of f.ev) if (e.t === 'proj') proj.push(makeProjectile(f, e)); stepProjectiles(proj, [a, b], DT);
      if (a.ko || b.ko) { if ((a.koT = (a.koT || 0) + DT) > 2) { a.revive(); b.revive(); a.koT = 0; } } // también se ve la caída y el suelo
      [a, b].forEach((f, j) => {
        f.crouch = (f.crouch || 0) + ((f.crouching ? 1 : 0) - (f.crouch || 0)) * (1 - Math.exp(-DT * 22));
        const d = D[j], P = d.compose(DT, f), h = hist[j], id = f.def.id;
        const tag = (typeof d.key === 'object' ? 'clip:' + d.key.name : d.key.replace(/\d+$/, ''));
        if (h.p) {
          const v = P.map((x, k) => x - h.p[k]);
          if (h.v && h.vv) for (let k = 0; k < CH.length; k++) { // juzga el fotograma anterior (h.v) con sus dos vecinos
            const c = CH[k]; if (SKIP.has(c)) continue;
            const a0 = Math.abs(h.vv[k]), a1 = Math.abs(h.v[k]), a2 = Math.abs(v[k]), T = lim(c);
            const step = a1 > T && a1 > 3 * Math.max(a0, a2);                                   // salto aislado de un fotograma
            const snap = h.v[k] * h.vv[k] < 0 && Math.min(a1, a0) > T * .8;                     // rebote: va y vuelve de golpe
            if (step || snap) {
              const where = h.pkey !== h.key ? `${h.pkey}→${h.key}` : h.key;
              const S = (stats[id] ??= {}), e = (S[where] ??= { n: 0, ch: {}, max: 0, kind: {} });
              e.n++; e.ch[c] = (e.ch[c] || 0) + 1; e.max = Math.max(e.max, a1 / T); e.kind[step ? 'salto' : 'rebote'] = (e.kind[step ? 'salto' : 'rebote'] || 0) + 1; total.pops++;
            }
          }
          h.vv = h.v; h.v = v;
        }
        h.pkey = h.key;
        h.p = P; h.key = tag; total.frames++; onFrame?.(id, tag, P);
      });
    }
  }
  return { stats, total };
}
if (process.argv[1]?.endsWith('anim-audit.mjs')) {
  const { stats, total } = audit();
  console.log(`fotogramas ${total.frames} · tirones ${total.pops} (${(total.pops / total.frames * 1000).toFixed(1)} por 1000)`);
  for (const id of Object.keys(stats)) {
    const rows = Object.entries(stats[id]).sort((x, y) => y[1].n - x[1].n).slice(0, 14);
    console.log(`\n== ${id}`); for (const [w, e] of rows) console.log(String(e.n).padStart(5), w.padEnd(26), 'x' + e.max.toFixed(1), JSON.stringify(e.kind), Object.entries(e.ch).sort((x, y) => y[1] - x[1]).slice(0, 5).map(([c, n]) => c + ':' + n).join(' '));
  }
}
