// PANTALLA DE RESULTADOS: cabecera (veredicto en una línea, ganador y datos clave como chapas), una tarjeta por jugador
// con su RANGO (S/A/B/C/D), las bonificaciones del combate (estilo Naruto Storm), la puntuación que sube contando y el
// Rose Gold ganado; en 2 jugadores, dos tarjetas (J1 y J2). Sin resumen (fin de escalera, pruebas) muestra una tabla limpia.
const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
const fmt = n => Math.round(n).toLocaleString();
const CHIP = new Set(['result.rounds', 'result.time']); // datos que van como chapas; daño / combo / oro ya están en las tarjetas

function countUp(node, to, ms = 900, delay = 0) {
  const t0 = performance.now() + delay, from = 0;
  const step = now => { const k = Math.max(0, Math.min(1, (now - t0) / ms)), e = 1 - Math.pow(1 - k, 3); node.textContent = fmt(from + (to - from) * e); if (k < 1) requestAnimationFrame(step); };
  if (typeof requestAnimationFrame === 'function' && !document.body.dataset.reduce?.startsWith('1')) { node.textContent = '0'; requestAnimationFrame(step); } else node.textContent = fmt(to);
}

export function renderResult(p, pack, { t, sideName, sideFx, colorOf } = {}) {
  const $ = s => document.querySelector(s), title = $('#r-title'), panel = title.closest('.panel');
  title.textContent = p.title; title.classList.toggle('long', String(p.title).length > 11); title.classList.toggle('xlong', String(p.title).length > 17);
  $('#r-sub').textContent = p.sub || '';
  const rep = pack?.rep, cards = $('#r-cards'), chips = $('#r-chips'), stats = $('#r-stats');
  const verdict = rep ? (rep.result.winner < 0 ? 'draw' : (pack.local ? 'win' : rep.result.winner === 0 ? 'win' : 'lose')) : 'plain';
  panel.dataset.v = verdict; panel.classList.toggle('has-cards', !!rep); panel.classList.toggle('duo', !!(rep && pack.local));
  // chapas (rondas, tiempo) o tabla completa si no hay resumen
  const rows = p.rows || [];
  chips.replaceChildren(...(rep ? rows.filter(([k]) => CHIP.has(k)) : []).map(([k, v]) => { const c = el('span', 'chip'); c.append(el('i', '', t(k)), el('b', '', v)); return c; }));
  const rest = rep ? rows.filter(([k]) => !CHIP.has(k) && !['result.damage', 'result.combo', 'result.gold'].includes(k)) : rows;
  stats.replaceChildren(...rest.flatMap(([k, v]) => [el('dt', '', t(k)), el('dd', '', String(v))]));
  stats.hidden = !rest.length;
  cards.replaceChildren(); cards.hidden = !rep;
  if (!rep) return;
  const cfg = pack.cfg, sides = pack.local ? [0, 1] : [0];
  sides.forEach((i, k) => {
    const S = rep.sides[i], id = i ? cfg.b : cfg.a, col = colorOf?.(id) || sideFx?.(cfg, i)?.light || '#f1dc9a', won = rep.result.winner === i;
    const card = el('article', 'rcard' + (won ? ' won' : '')); card.style.setProperty('--c', col); card.style.setProperty('--d', `${k * .25}s`);
    const rk = el('div', 'rk rk-' + S.rank); rk.append(el('span', 'rk-l', S.rank), el('i', '', t('rep.rank')));
    const who = el('div', 'rc-who'); who.append(el('i', '', pack.local ? t(i ? 'pause.side.p2' : 'pause.side.p1') : t('pause.side.you')), el('b', '', sideName?.(cfg, i) ?? id));
    if (won) who.append(el('em', 'rc-win', t('rep.winner')));
    const head = el('div', 'rc-side'); head.append(rk, who);
    const list = el('ol', 'rc-bon'), bon = [...S.bonuses].sort((a, b) => b.pts - a.pts);
    bon.forEach((b, j) => { const li = el('li'); li.style.setProperty('--i', j); const lbl = t('rep.' + b.id, { n: b.n });
      li.append(el('span', '', lbl), el('b', '', '+' + fmt(b.pts))); list.append(li); });
    if (!bon.length) list.append(el('li', 'none', t('rep.none')));
    const tot = el('div', 'rc-tot'), num = el('b', '', '0'); tot.append(el('span', '', t('rep.score')), num);
    const gold = el('div', 'rc-gold'); gold.append(el('span', 'gem'), el('b', '', '+' + fmt(pack.gold?.[i] || 0)), el('i', '', 'Rose Gold'));
    const body = el('div', 'rc-body'); body.append(list, tot, gold);
    card.append(head, body); cards.append(card);
    countUp(num, S.score, 1000, 350 + k * 250);
  });
}
