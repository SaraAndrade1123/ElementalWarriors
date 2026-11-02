// VISTA PREVIA DE ARMAS (tienda): un combate de demostración real, con el guerrero elegido y el arma puesta,
// que saca el arma, lanza su técnica contra un maniquí y la vuelve a guardar en bucle. Usa los mismos
// modelos, animaciones y efectos que el combate (no es un vídeo), así que también vale para armas nuevas.
// open(weaponId, heroId) · close() · se cierra sola al salir de la tienda.

// Entrada simulada: pulsa el botón de arma cuando está listo y, entre usos, se recoloca.
export function previewInput(getMatch, { want = 3.4 } = {}) {
  let wait = .5, last = 0;
  const I = o => ({ x: 0, down: false, guard: false, jump: false, l: false, m: false, h: false, s: false, r: false, w: false, ...o });
  return {
    read(p) {
      const m = getMatch(); if (p !== 0 || !m) return I();
      const a = m.f[0], b = m.f[1], now = m.t || 0, dt = Math.max(0, Math.min(.1, now - last)); last = now;
      if (a.act || a.stun > 0 || a.air) return I();
      const gap = Math.abs(b.x - a.x);
      if (gap > want + .35) return I({ x: a.facing }); if (gap < want - .6) return I({ x: -a.facing });
      if ((a.wcd || 0) > .9) a.wcd = .9; // la demo no espera el enfriamiento completo
      wait -= dt; if (wait > 0 || (a.wcd || 0) > 0) return I();
      wait = 1.1; return I({ w: true });
    },
    consume() {}, clear() {}, attach() {}, detach() {}, setScheme() {}, paused: false, scheme: 'solo'
  };
}

export function createWeaponPreview({ scene, roster, moves, sfx = null, doc = globalThis.document } = {}) {
  let on = null;
  function close() {
    if (!on) return; const o = on; on = null;
    try { scene.endMatch(); } catch (e) { console.warn('[vista previa]', e); }
    doc.body.classList.remove('wpreview');
  }
  function open(weaponId, heroId) {
    close();
    const hero = heroId || roster[0].id, foe = (roster.find(r => r.id !== hero) || roster[0]).id;
    // distancia de exhibición según el arma: las de cuerpo a cuerpo se acercan lo justo para conectar; la daga (contraataque)
    // necesita que el maniquí ataque para poder responder
    const w = scene.__weapons?.data?.weapons?.[weaponId], mv = w?.move || {}, melee = !mv.proj, parry = !!(w?.parry || mv.parry);
    const want = melee ? Math.max(1.4, Math.min(3.2, (mv.range || 2) * .82)) : 3.4;
    const input = previewInput(() => scene.match, { want });
    try {
      scene.startMatch(hero, foe, input, { moves, mode: 'training', dummy: 'still', infinite: true, weapon1: weaponId, weapon2: null, cinematic: false, outro: false, preview: true,
        onHud() {}, onResult() {}, onEvent() {}, onFx: (n, d) => { try { sfx?.(n, d); } catch { /* sin audio */ } }, onReact() {} });
    } catch (e) { console.warn('[vista previa] no se pudo iniciar', e); return false; }
    const m = scene.match; m.phase = 'fight';
    // daga de contraataque: el maniquí ataca JUSTO cuando la daga está en guardia, así se ve el bloqueo y la respuesta
    if (parry) { let swung = false; const B = o => ({ x: 0, down: false, guard: false, jump: false, l: false, m: false, h: false, s: false, r: false, w: false, ...o });
      m.brain = { reset() {}, think(dt, me, hero) { const a = hero.act; if (!a || a.name !== 'wp') { swung = false; return B(); }
        const win = a.def?.parry; if (!swung && win && a.t >= win[0] + .02 && !me.act && !(me.stun > 0)) { swung = true; return B({ m: true }); } return B(); } }; } m.f[0].x = -want / 2; m.f[1].x = want / 2; m.prev = m.f.map(f => ({ x: f.x, y: f.y }));
    // cámara de exhibición: encuadra a los dos a la derecha del panel (en vertical, arriba)
    const render = m.render;
    m.render = function (rdt, cam) {
      const r = render.call(this, rdt, cam), [a, b] = this.f, mx = (a.x + b.x) / 2, land = cam.aspect > 1.15;
      const D = land ? 12.5 : 15, half = D * Math.tan(cam.fov * Math.PI / 360) * cam.aspect, sh = land ? half * .3 : 0;
      cam.position.set(mx - sh, land ? 2.4 : 3.8, D); cam.lookAt(mx - sh, land ? 1.7 : 2.6, 0); return r;
    };
    doc.body.classList.add('wpreview');
    on = { weaponId }; return true;
  }
  return { open, close, get active() { return on?.weaponId || null; } };
}
