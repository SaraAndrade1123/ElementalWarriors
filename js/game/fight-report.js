// RESUMEN DEL COMBATE (estilo Naruto Ultimate Ninja Storm): cada lado acumula bonificaciones durante el combate
// (primer golpe, combo máximo, Resonancia acertada, K.O. con Resonancia, rondas perfectas, contraataques, guardia rota…)
// y al final recibe una puntuación, un RANGO (S, A, B, C, D) y Rose Gold extra.
// Lógica pura (se prueba con Node) + un enganche que escucha el combate sin tocar match.js.
export const BONUS = {
  //  id            puntos              etiqueta (es / en en localization: rep.<id>)
  win:        { pts: 1000 },
  first:      { pts: 300 },
  combo:      { per: 60, min: 3 },     // por golpe del mejor combo
  exHit:      { per: 250 },            // técnica de Resonancia que conecta
  exKO:       { pts: 1000 },           // K.O. rematado con la técnica de Resonancia
  perfect:    { per: 1200 },           // ronda ganada sin recibir daño
  comeback:   { pts: 800 },            // ganar tras perder la primera ronda
  counter:    { per: 150 },
  crush:      { per: 250 },            // guardia rota / rompeguardia
  throws:     { per: 120 },
  bend:       { per: 60 },             // golpes de control elemental
  weapon:     { per: 100 },            // golpes con el arma
  parry:      { per: 200 },
  tf:         { pts: 600 },            // transformación definitiva activada
  blocks:     { per: 15 },
  dmg:        { per: 2 },              // por punto de daño causado
  hp:         { per: 12 },             // por % de vida restante al ganar
  time:       { per: 15 },             // por segundo restante en las rondas ganadas por K.O.
};
export const RANKS = [['S', 85], ['A', 70], ['B', 52], ['C', 35], ['D', 0]];
export const RANK_GOLD = { S: 40, A: 25, B: 15, C: 5, D: 0 };
const BEND = new Set(['eb', 'eu', 'ej']);

export const blankSide = () => ({ tf: 0, first: false, hits: 0, maxCombo: 0, exUse: 0, exHit: 0, exKO: false, perfect: 0, counter: 0, crush: 0, throws: 0, bend: 0, weapon: 0, parry: 0, blocks: 0, dmg: 0, taken: 0, rounds: 0, time: 0, kos: 0 });
export function createTracker() {
  const T = { s: [blankSide(), blankSide()], firstDone: false, roundsLog: [] };
  T.reset = () => { T.s = [blankSide(), blankSide()]; T.firstDone = false; T.roundsLog = []; };
  // e: evento del combate (hit / block / armor / crush / throw / guardbreak / tech / parry / ex / weapon)
  T.feed = e => {
    const i = e.by, me = T.s[i], foe = T.s[1 - i]; if (!me) return;
    switch (e.type) {
      case 'hit': case 'throw': {
        if (!T.firstDone) { T.firstDone = true; me.first = true; }
        me.hits++; me.dmg += e.dmg || 0; foe.taken += e.dmg || 0; me.maxCombo = Math.max(me.maxCombo, e.combo || 1);
        if (e.counter) me.counter++;
        if (e.move === 'ex') { me.exHit++; if (e.ko) me.exKO = true; }
        if (BEND.has(e.move) || e.move === 's') me.bend++;
        if (e.move === 'wp') me.weapon++;
        if (e.type === 'throw') me.throws++;
        if (e.ko) me.kos++;
        break; }
      case 'block': foe.blocks++; break; // quien bloquea es el rival del atacante
      case 'crush': case 'guardbreak': me.crush++; break;
      case 'parry': me.parry++; break;
      case 'ex': me.exUse++; break;
      case 'transform': me.tf++; break;
    }
  };
  // fin de ronda: w = ganador (−1 empate), why = 'ko' | 'time', hp = vida restante [0..1] de cada lado, left = segundos restantes
  T.round = (w, why, hp, left) => {
    T.roundsLog.push(w); if (w < 0) return;
    const me = T.s[w]; me.rounds++;
    if ((hp?.[w] ?? 0) >= .999) me.perfect++;
    if (why === 'ko' && Number.isFinite(left)) me.time += Math.max(0, Math.round(left));
  };
  return T;
}

// Resumen de un lado: lista de bonificaciones, puntuación, índice de actuación (0–100), rango y Rose Gold extra.
export function summarize(T, side, res) {
  const s = T.s[side], o = T.s[1 - side], won = res.winner === side, out = [];
  const add = (id, pts, n) => { if (pts > 0) out.push({ id, pts: Math.round(pts), n }); };
  if (won) add('win', BONUS.win.pts);
  if (s.first) add('first', BONUS.first.pts);
  if (s.maxCombo >= BONUS.combo.min) add('combo', s.maxCombo * BONUS.combo.per, s.maxCombo);
  if (s.exHit) add('exHit', s.exHit * BONUS.exHit.per, s.exHit);
  if (s.exKO) add('exKO', BONUS.exKO.pts);
  if (s.perfect) add('perfect', s.perfect * BONUS.perfect.per, s.perfect);
  if (won && T.roundsLog[0] === 1 - side) add('comeback', BONUS.comeback.pts);
  if (s.counter) add('counter', s.counter * BONUS.counter.per, s.counter);
  if (s.crush) add('crush', s.crush * BONUS.crush.per, s.crush);
  if (s.throws) add('throws', s.throws * BONUS.throws.per, s.throws);
  if (s.bend) add('bend', s.bend * BONUS.bend.per, s.bend);
  if (s.weapon) add('weapon', s.weapon * BONUS.weapon.per, s.weapon);
  if (s.parry) add('parry', s.parry * BONUS.parry.per, s.parry);
  if (s.tf) add('tf', BONUS.tf.pts);
  if (s.blocks) add('blocks', s.blocks * BONUS.blocks.per, s.blocks);
  if (s.dmg) add('dmg', s.dmg * BONUS.dmg.per, Math.round(s.dmg));
  const hpPct = Math.round((res.hp?.[side] ?? 0) * 100);
  if (won && hpPct > 0) add('hp', hpPct * BONUS.hp.per, hpPct);
  if (s.time) add('time', s.time * BONUS.time.per, s.time);
  const score = out.reduce((n, b) => n + b.pts, 0);
  // índice de actuación: ganar, vida que conserva, rondas perfectas, cuota de daño, combo, técnica…
  const share = s.dmg + o.dmg > 0 ? s.dmg / (s.dmg + o.dmg) : .5;
  const lost = T.roundsLog.filter(w => w === 1 - side).length;
  const perf = Math.max(0, Math.min(100, (won ? 30 : 0) + (won ? 18 * (res.hp?.[side] ?? 0) : 0) + 10 * Math.min(2, s.perfect) + 22 * share
    + Math.min(8, s.maxCombo) + Math.min(6, s.exHit * 3) + (s.exKO ? 5 : 0) + (s.first ? 3 : 0) + Math.min(4, s.counter + s.crush) - 6 * lost));
  const rank = RANKS.find(([, min]) => perf >= min)[0];
  const gold = Math.floor(score / 150) + RANK_GOLD[rank];
  return { side, bonuses: out, score, perf: Math.round(perf), rank, gold, stats: { ...s } };
}

// Enganche: cada combate lleva su contador; scene.__report.last = { sides: [resumen J1, resumen J2], result } al terminar.
export function installFightReport({ scene } = {}) {
  if (!scene || scene.__report) return scene?.__report;
  const api = { last: null, tracker: null, build: (res, m = scene.match) => { const T = m?.__rep; if (!T) return null; const sides = [0, 1].map(i => summarize(T, i, res)); api.last = { sides, result: res }; return api.last; } };
  scene.__report = api;
  const start = scene.startMatch.bind(scene);
  scene.startMatch = function (a, b, input, opts = {}) {
    const r = start(a, b, input, opts), m = this.match; if (!m || opts.preview) return r;
    try {
      const T = m.__rep = createTracker(); api.tracker = T;
      const ev = m.event.bind(m); m.event = e => { try { T.feed(e); } catch { /* nunca rompe el combate */ } return ev(e); };
      const fe = m.onFighterEv.bind(m); m.onFighterEv = (e, f, i) => { if (e.t === 'ex' || e.t === 'parry') T.feed({ type: e.t, by: i }); return fe(e, f, i); };
      const er = m.endRound.bind(m); m.endRound = (w, why) => { T.round(w, why, m.f.map(f => f.hp / f.maxHp), m.timer); return er(w, why); };
      const rs = m.restart.bind(m); m.restart = () => { T.reset(); return rs(); };
    } catch (e) { console.warn('[resumen] desactivado', e); }
    return r;
  };
  return api;
}
