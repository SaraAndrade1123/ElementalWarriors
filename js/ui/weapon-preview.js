// VISTA PREVIA DE ARMAS (tienda): un combate de demostración real, con el guerrero elegido y el arma puesta,
// que saca el arma, lanza su técnica contra un maniquí y la vuelve a guardar en bucle. Usa los mismos
// modelos, animaciones y efectos que el combate (no es un vídeo), así que también vale para armas nuevas.
// open(weaponId, heroId) · close() · se cierra sola al salir de la tienda.
import { t } from '../systems/localization.js';

// Entrada simulada: pulsa el botón de arma cuando está listo y, entre usos, se recoloca.
export function previewInput(getMatch) {
  let wait = .5, last = 0;
  const I = o => ({ x: 0, down: false, guard: false, jump: false, l: false, m: false, h: false, s: false, r: false, w: false, ...o });
  return {
    read(p) {
      const m = getMatch(); if (p !== 0 || !m) return I();
      const a = m.f[0], b = m.f[1], now = m.t || 0, dt = Math.max(0, Math.min(.1, now - last)); last = now;
      if (a.act || a.stun > 0 || a.air) return I();
      const gap = Math.abs(b.x - a.x), want = 3.4;
      if (gap > want + .6) return I({ x: a.facing }); if (gap < want - .9) return I({ x: -a.facing });
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
    o.box?.remove(); doc.body.classList.remove('wpreview');
  }
  function open(weaponId, heroId) {
    close();
    const hero = heroId || roster[0].id, foe = (roster.find(r => r.id !== hero) || roster[0]).id;
    const input = previewInput(() => scene.match);
    try {
      scene.startMatch(hero, foe, input, { moves, mode: 'training', dummy: 'still', infinite: true, weapon1: weaponId, weapon2: null, cinematic: false, outro: false, preview: true,
        onHud() {}, onResult() {}, onEvent() {}, onFx: (n, d) => { try { sfx?.(n, d); } catch { /* sin audio */ } }, onReact() {} });
    } catch (e) { console.warn('[vista previa] no se pudo iniciar', e); return false; }
    const m = scene.match; m.phase = 'fight'; m.f[0].x = -1.7; m.f[1].x = 1.7; m.prev = m.f.map(f => ({ x: f.x, y: f.y }));
    // cámara de exhibición: encuadra a los dos a la derecha del panel (en vertical, arriba)
    const render = m.render;
    m.render = function (rdt, cam) {
      const r = render.call(this, rdt, cam), [a, b] = this.f, mx = (a.x + b.x) / 2, land = cam.aspect > 1.15;
      const D = land ? 12.5 : 15, half = D * Math.tan(cam.fov * Math.PI / 360) * cam.aspect, sh = land ? half * .3 : 0;
      cam.position.set(mx - sh, land ? 2.4 : 3.8, D); cam.lookAt(mx - sh, land ? 1.7 : 2.6, 0); return r;
    };
    doc.body.classList.add('wpreview');
    const box = doc.createElement('div'); box.id = 'wprev'; box.setAttribute('role', 'status');
    const k = s => t(s); box.innerHTML = `<i>${k('wpn.preview.live')}</i><b></b><span></span><button type="button" class="mini">${k('wpn.preview.close')}</button>`;
    box.querySelector('b').textContent = t('item.' + weaponId); box.querySelector('span').textContent = t(`wpn.${weaponId}.power`);
    box.querySelector('button').addEventListener('click', close);
    doc.body.append(box);
    on = { weaponId, box }; return true;
  }
  return { open, close, get active() { return on?.weaponId || null; } };
}
