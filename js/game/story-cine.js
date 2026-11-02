// MODO HISTORIA CINEMATOGRÁFICO: las escenas entre combates se ruedan en 3D con los dos guerreros frente a frente.
//  · Tarjeta de capítulo («Capítulo 2 · Ignis contra Aqua») con grúa que baja.
//  · El narrador habla sobre un plano general que gira despacio (texto centrado, viñeta oscura).
//  · Cada guerrero habla en primer plano 3/4; si repite, plano por encima del hombro del otro. Al hablar por
//    primera vez hace su gesto de presentación.
//  · El desenlace (final de la historia) cierra con contraluz dorado y el gesto de victoria del héroe.
// Toque / clic / Enter / Espacio: completa el texto y, si ya está completo, pasa al siguiente plano. «Saltar escena» lo salta todo.
// No depende del combate: usa la escena del menú (scene.showPair + scene.cineCam), así sirve antes, entre y después de los combates.
import * as THREE from 'three';
import { t } from '../systems/localization.js';

const ease = x => x < 0 ? 0 : x > 1 ? 1 : x * x * (3 - 2 * x);
export const readTime = text => Math.max(2.6, Math.min(6.5, 1.4 + String(text).length * .05));
const _p = new THREE.Vector3(), _l = new THREE.Vector3();

// Plan de planos a partir de las líneas del flujo ({who, key}); se prueba sin DOM.
export function planStory(scenes, { hero, rival, chapter = 0, total = 0, card = true } = {}) {
  const shots = []; let cur = rival || null; const spoke = new Set();
  const isEnd = s => /\.ending$|^story\.fin$/.test(s.key);
  if (card) shots.push({ kind: 'card', dur: 2.6, rival: cur, auto: true });
  for (const s of scenes) {
    if (s.who !== 'narrator' && s.who !== hero) cur = s.who;
    const kind = s.who === 'narrator' ? (isEnd(s) ? 'ending' : 'narr') : 'line';
    const side = s.who === hero ? 0 : 1;
    shots.push({ kind, who: s.who, side, key: s.key, rival: cur, first: kind === 'line' && !spoke.has(s.who), ots: kind === 'line' && spoke.has(s.who) });
    if (kind === 'line') spoke.add(s.who);
  }
  if (shots[0]?.kind === 'card') shots[0].rival = shots.find(x => x.rival)?.rival || rival || null;
  return shots;
}

export function createStoryCine({ scene, roster = [], doc = globalThis.document, colorOf = null } = {}) {
  const hasDom = !!doc?.createElement;
  const def = id => roster.find(r => r.id === id);
  const nameOf = id => def(id)?.name ?? id;
  const col = id => colorOf?.(id) || def(id)?.fx?.light || '#f1dc9a';
  let cur = null;

  function play(scenes, done, ctx = {}) {
    if (cur) cur.finish(true);
    const hero = ctx.hero || scenes.find(s => s.who !== 'narrator')?.who || roster[0]?.id;
    const shots = planStory(scenes, { ...ctx, hero, card: ctx.card !== false });
    if (!shots.length) return done();
    if (scene.match) scene.endMatch();
    const savedX = scene.stage?.position.x ?? 0; if (scene.stage) scene.stage.position.x = 0;
    let k = -1, st = 0, typed = 0, pair = null, el = null, box = null, who = null, txt = null, card = null, auto = 0, finished = false;
    if (hasDom) {
      doc.body.classList.add('story-cine');
      el = doc.createElement('div'); el.id = 'scine';
      el.innerHTML = `<div class="cbar top"></div><div class="cbar bot"></div><div class="srays"></div>
        <div class="scard"><i></i><b></b><em></em></div>
        <div class="csub"><div class="cwho"><b></b><i></i></div><p></p></div>
        <p class="snarr"></p><div class="oflash"></div>
        <button class="sskip" type="button"></button><span class="snext" aria-hidden="true">▶</span>`;
      doc.body.append(el);
      card = el.querySelector('.scard'); box = el.querySelector('.csub'); who = box.querySelector('.cwho b'); txt = box.querySelector('p');
      el.querySelector('.sskip').textContent = t('story.skip') === 'story.skip' ? 'Saltar escena' : t('story.skip');
      el.querySelector('.sskip').addEventListener('click', e => { e.stopPropagation(); finish(); });
    }
    const textOf = s => t(s.key);
    const go = () => {
      k++; st = 0; typed = 0; auto = 0;
      if (k >= shots.length) return finish();
      const s = shots[k], r = s.rival || ctx.rival;
      if (r && (!pair || pair !== r)) { scene.showPair?.(hero, r); pair = r; }
      if (s.kind === 'line' && s.first) { const p = scene.pair?.[s.side]; if (p?.anim) p.intro = { name: 'intro', t: 0 }; }
      if (s.kind === 'ending') { const p = scene.pair?.[0]; if (p?.anim && p.anim.dir?.clips?.win) p.intro = { name: 'win', t: 0 }; }
      if (!el) return;
      el.dataset.shot = s.kind; el.classList.remove('cut'); void el.offsetWidth; el.classList.add('cut');
      el.style.setProperty('--c', col(s.kind === 'line' ? s.who : hero));
      card.classList.toggle('on', s.kind === 'card');
      if (s.kind === 'card') {
        const last = ctx.total && ctx.chapter >= ctx.total - 1, epi = shots.some(x => x.kind === 'ending');
        card.querySelector('i').textContent = epi ? t('story.card.epilogue') : ctx.total ? (last ? t('story.card.final') : t('story.card.n', { n: (ctx.chapter ?? 0) + 1 })) : t('menu.story');
        card.querySelector('b').textContent = s.rival ? t('story.card.vs', { a: nameOf(hero), b: nameOf(s.rival) }) : nameOf(hero);
        const place = s.rival ? t(`story.place.${s.rival}`) : ''; card.querySelector('em').textContent = place.startsWith('story.') ? '' : place;
      }
      box.classList.toggle('on', s.kind === 'line'); box.classList.toggle('r', s.side === 1);
      if (s.kind === 'line') { who.textContent = nameOf(s.who); const al = t(`char.${s.who}.alias`); box.querySelector('.cwho i').textContent = al.startsWith('char.') ? '' : al; txt.textContent = ''; }
      el.querySelector('.snarr').textContent = ''; el.querySelector('.snarr').classList.toggle('on', s.kind === 'narr' || s.kind === 'ending');
    };
    const full = s => s && s.kind !== 'card' ? textOf(s) : '';
    const advance = () => { const s = shots[k]; if (!s) return; const f = full(s); if (typed < f.length) { typed = f.length; return; } go(); };
    const onKey = e => {
      if (e.type === 'keydown') { if (e.repeat) return; if (e.code === 'Escape') { e.preventDefault(); return finish(); } if (!/^(Enter|Space|KeyJ|KeyZ|ArrowRight|NumpadEnter)$/.test(e.code)) return; }
      else if (e.target?.closest?.('.sskip')) return;
      e.preventDefault?.(); e.stopPropagation?.(); advance();
    };
    addEventListener('keydown', onKey, true); el?.addEventListener('pointerdown', onKey);
    function finish(silent) {
      if (finished) return; finished = true; cur = null;
      removeEventListener('keydown', onKey, true);
      scene.cineCam = null; scene.clearPair?.(); if (scene.stage) scene.stage.position.x = savedX; scene.resize?.();
      if (el) { el.classList.add('out'); const e2 = el; setTimeout(() => e2.remove(), 420); doc.body.classList.remove('story-cine'); }
      if (!silent) { try { done(); } catch (e) { console.error('[historia]', e); } }
    }
    cur = { finish };
    scene.cineCam = (dt, cam) => {
      if (finished) return; st += dt; const s = shots[k]; if (!s) return;
      const u = Math.min(1, st / (s.kind === 'card' ? s.dur : 7)), e = ease(u), P = scene.pair;
      const pos = i => P?.[i]?.holder?.position ?? _l.set(i ? 1.55 : -1.55, 0, -.2);
      if (s.kind === 'card') { _p.set(0, 5.2 - 2.2 * e, 14 - 3 * e); _l.set(0, 1.5, 0); }
      else if (s.kind === 'narr') { const a = -.3 + .6 * u; _p.set(Math.sin(a) * 10.5, 3.2, Math.cos(a) * 10.5); _l.set(0, 1.4, 0); }
      else if (s.kind === 'ending') { _p.set(pos(0).x + .2, .9 + .5 * e, 6.5 - 1.6 * e); _l.set(pos(0).x, 2, 0); }
      else {
        const me = pos(s.side).clone(), other = pos(1 - s.side), dir = Math.sign(other.x - me.x) || 1;
        if (s.ots) { _p.set(other.x + dir * .75, 2.55, other.z + 1.8); _l.set(me.x, 2.2, me.z); }
        else { _p.set(me.x + dir * (1.9 - .25 * e), 2.25, me.z + 3.1 - .4 * e); _l.set(me.x + dir * .15, 2.15, me.z); }
      }
      cam.position.copy(_p); cam.lookAt(_l);
      // texto que se escribe solo y avance automático cuando ya se ha podido leer
      if (el && s.kind !== 'card') {
        const f = full(s); typed = Math.min(f.length, Math.max(typed, Math.floor(st * 42)));
        const node = s.kind === 'line' ? txt : el.querySelector('.snarr'); if (node.textContent.length !== typed) node.textContent = f.slice(0, typed);
        node.classList.toggle('done', typed >= f.length); el.classList.toggle('ready', typed >= f.length);
        if (typed >= f.length && (auto += dt) > readTime(f) * .9) go();
      } else if (s.kind === 'card' && st > s.dur) go();
      if (!el && st > 2) go();
    };
    go();
    return { finish, shots };
  }
  return { play, get playing() { return !!cur; }, skip: () => cur?.finish() };
}
