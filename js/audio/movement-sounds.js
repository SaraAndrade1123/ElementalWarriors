// Pasos, salto y aterrizaje a partir del estado REAL de los luchadores (match.f). Lógica pura: se prueba con Node.
// Lee solo: f.air, f.vy, f.x, f.walk, f.state. Si F3 cambia el combate y alguno no existe, simplemente no suena (no falla).
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export class MovementSounds {
  constructor(audio) { this.audio = audio; this.st = []; }
  reset() { this.st = []; }

  update(match, dt) {
    if (!match || match.paused || !Array.isArray(match.f)) return;
    dt = clamp(dt, 0, 0.25);
    match.f.forEach((f, i) => {
      const s = (this.st[i] ??= { air: !!f.air, vy: 0, step: 0 });
      if (f.air && !s.air) this.audio.sfx('jump', { x: f.x });
      else if (!f.air && s.air) this.audio.sfx('land', { x: f.x, vol: clamp(Math.abs(s.vy) / 14, 0.35, 1) });
      s.air = !!f.air; if (f.air) s.vy = f.vy;
      if (!f.air && (f.state === 'walk' || f.state === 'run')) {
        s.step += dt; const every = clamp(1.6 / (f.walk || 5), 0.22, 0.45);
        if (s.step >= every) { s.step = 0; this.audio.sfx('step', { x: f.x, vol: 0.7 }); }
      } else s.step = 0.2; // el primer paso suena enseguida al empezar a caminar
    });
  }
}
