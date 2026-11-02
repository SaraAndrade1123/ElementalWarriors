// Pantalla de título: chispas de los cuatro elementos que suben por detrás del emblema (canvas 2D muy ligero).
// Se detiene sola al entrar al menú (o con reducir movimiento no se anima).
export function startTitle(canvas) {
  if (!canvas?.getContext || matchMedia?.('(prefers-reduced-motion: reduce)').matches) return () => {};
  const g = canvas.getContext('2d'), P = [], COLS = ['255,140,60', '120,190,255', '210,230,140', '235,245,255', '241,220,154'];
  let w = 0, h = 0, raf = 0, last = performance.now(), on = true;
  const size = () => { const r = Math.min(devicePixelRatio || 1, 1.5); w = canvas.width = canvas.clientWidth * r; h = canvas.height = canvas.clientHeight * r; };
  size(); addEventListener('resize', size);
  const spawn = () => { const side = Math.random(), c = COLS[side < .25 ? 0 : side < .5 ? 1 : side < .75 ? 2 : side < .92 ? 3 : 4];
    P.push({ x: Math.random() * w, y: h + 10, vx: (Math.random() - .5) * 18, vy: -(30 + Math.random() * 70), r: .8 + Math.random() * 2.4, life: 0, max: 4 + Math.random() * 5, c, tw: Math.random() * 6 }); };
  const frame = now => {
    if (!on) return; const dt = Math.min(.05, (now - last) / 1000); last = now;
    while (P.length < 110) spawn();
    g.clearRect(0, 0, w, h); g.globalCompositeOperation = 'lighter';
    for (let i = P.length - 1; i >= 0; i--) {
      const p = P[i]; p.life += dt; p.x += (p.vx + Math.sin(p.life * 1.7 + p.tw) * 12) * dt; p.y += p.vy * dt * (devicePixelRatio > 1 ? 1.4 : 1);
      if (p.life > p.max || p.y < -20) { P.splice(i, 1); continue; }
      const a = Math.min(1, p.life * 2) * (1 - p.life / p.max) * (.6 + .4 * Math.sin(p.life * 8 + p.tw));
      const gr = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 5); gr.addColorStop(0, `rgba(${p.c},${a})`); gr.addColorStop(1, `rgba(${p.c},0)`);
      g.fillStyle = gr; g.beginPath(); g.arc(p.x, p.y, p.r * 5, 0, 6.283); g.fill();
    }
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  return () => { on = false; cancelAnimationFrame(raf); removeEventListener('resize', size); };
}
