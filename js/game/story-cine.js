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
import { typed as typedN } from '../systems/a11y.js';

const ease = x => x < 0 ? 0 : x > 1 ? 1 : x * x * (3 - 2 * x);
export const readTime = text => Math.max(2.6, Math.min(6.5, 1.4 + String(text).length * .05));
const _p = new THREE.Vector3(), _l = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3();

// Plan de planos a partir de las líneas del flujo ({who, key}); se prueba sin DOM.
// Cada plano lleva su MUNDO (escenario que se ve): el prólogo recorre los mundos de los elementos, el héroe se presenta en
// el suyo, el capítulo ocurre en el del rival y el desenlace en la Arena del Equilibrio.
export const TOUR = ['cenizas', 'mareas', 'bastion', 'viento'];
export function planStory(scenes, { hero, rival, chapter = 0, total = 0, card = true, world = null, home = null, final = 'equilibrio' } = {}) {
  const shots = []; let cur = rival || null; const spoke = new Set();
  const isEnd = s => /\.ending$|^story\.fin$/.test(s.key);
  if (card) shots.push({ kind: 'card', dur: 2.6, rival: cur, auto: true, world });
  for (const s of scenes) {
    if (s.who !== 'narrator' && s.who !== hero) cur = s.who;
    let kind = s.who === 'narrator' ? (isEnd(s) ? 'ending' : 'narr') : 'line';
    const side = s.who === hero ? 0 : 1;
    let w = world, tour = null;
    if (s.key === 'story.prologue.1') { kind = 'world'; w = final; }
    else if (s.key === 'story.prologue.2') { kind = 'world'; tour = TOUR; w = TOUR[0]; }
    else if (/^story\.arrive\./.test(s.key)) { kind = 'world'; w = s.key.slice(13) || world; }
    else if (s.key === `story.${hero}.intro` && home) w = home;
    else if (kind === 'ending') w = final;
    shots.push({ kind, who: s.who, side, key: s.key, rival: cur, world: w, tour, first: kind === 'line' && !spoke.has(s.who), ots: kind === 'line' && spoke.has(s.who) });
    if (kind === 'line') spoke.add(s.who);
  }
  if (shots[0]?.kind === 'card') shots[0].rival = shots.find(x => x.rival)?.rival || rival || null;
  return shots;
}

export function createStoryCine({ scene, roster = [], doc = globalThis.document, colorOf = null, stages = null } = {}) {
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
    // ── mundos: el escenario real (con su clima y efectos) sustituye a la plataforma del menú ──
    let world = null; const plat = () => (scene.stage?.children || []).filter(c => c.isMesh || c.isSprite);
    const setWorld = id => {
      if (!stages?.create || !id || world?.id === id) return; clearWorld();
      let A = null; try { A = stages.create(id); } catch (e) { console.warn('[historia] mundo', id, e); } if (!A) return;
      const S = scene.scene; world = { id, A, saved: { bg: S.background, fog: S.fog ? [S.fog.density, S.fog.color.getHex()] : null, key: scene.key ? [scene.key.color.getHex(), scene.key.intensity] : null } };
      S.add(A.group); S.background = A.sky; if (S.fog && A.env) { S.fog.density = A.env.fogDensity; S.fog.color.set(A.env.fogColor); }
      if (scene.key && A.env) { scene.key.color.set(A.env.key); scene.key.intensity = A.env.keyIntensity; }
      for (const o of [...plat(), scene.backdrop, scene.pts]) if (o) o.visible = false;
    };
    function clearWorld() {
      if (!world) return; const S = scene.scene, w = world; world = null;
      w.A.group.removeFromParent(); try { w.A.dispose(); } catch { /* ya liberado */ }
      S.background = w.saved.bg; if (w.saved.fog) { S.fog.density = w.saved.fog[0]; S.fog.color.setHex(w.saved.fog[1]); } if (w.saved.key) { scene.key.color.setHex(w.saved.key[0]); scene.key.intensity = w.saved.key[1]; }
      for (const o of [...plat(), scene.backdrop, scene.pts]) if (o) o.visible = true;
    }
    let k = -1, st = 0, typed = 0, pair = null, el = null, box = null, who = null, txt = null, card = null, auto = 0, finished = false;
    if (hasDom) {
      doc.body.classList.add('story-cine');
      el = doc.createElement('div'); el.id = 'scine';
      el.innerHTML = `<div class="cbar top"></div><div class="cbar bot"></div><div class="srays"></div>
        <div class="scard"><i></i><b></b><em></em></div>
        <div class="csub"><div class="cwho"><b></b><i></i></div><p></p></div>
        <p class="snarr"></p><p class="sworld"></p><div class="oflash"></div>
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
      setWorld(s.world); s.tourI = 0; const wl = () => { if (el) el.querySelector('.sworld').textContent = s.kind === 'world' && world ? t(`stage.${world.id}.name`) : ''; }; s.wl = wl; wl();
      for (const p of scene.pair || []) p.holder.visible = s.kind !== 'world'; // los planos de mundo no muestran a los guerreros
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
      el.querySelector('.snarr').textContent = ''; el.querySelector('.snarr').classList.toggle('on', s.kind === 'narr' || s.kind === 'ending' || s.kind === 'world');
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
      scene.cineCam = null; clearWorld(); scene.clearPair?.(); if (scene.stage) scene.stage.position.x = savedX; scene.resize?.();
      if (el) { el.classList.add('out'); const e2 = el; setTimeout(() => e2.remove(), 420); doc.body.classList.remove('story-cine'); }
      if (!silent) { try { done(); } catch (e) { console.error('[historia]', e); } }
    }
    cur = { finish };
    scene.cineCam = (dt, cam) => {
      if (finished) return; st += dt; const s = shots[k]; if (!s) return;
      const u = Math.min(1, st / (s.kind === 'card' ? s.dur : 7)), e = ease(u), P = scene.pair;
      const pos = i => P?.[i]?.holder ? P[i].holder.getWorldPosition(i ? _b : _a) : (i ? _b : _a).set(i ? 1.55 : -1.55, 0, -.2); // posición real (el escenario del menú puede estar desplazado)
      const mid = (pos(0).x + pos(1).x) / 2;
      if (world) { try { world.A.update(scene.time ?? st, dt, false); } catch { /* adorno */ } }
      if (s.kind === 'world') { // vuelo sobre el mundo; el recorrido del prólogo cambia de mundo cada cuarto del plano
        if (s.tour) { const n = s.tour.length, len = readTime(textOf(s)) * 1.1, i = Math.min(n - 1, Math.floor(st / (len / n))); if (i !== s.tourI) { s.tourI = i; setWorld(s.tour[i]); s.wl?.(); if (el) { el.classList.remove('cut'); void el.offsetWidth; el.classList.add('cut'); } world?.A.react?.({ power: 1 }); } }
        const lu = s.tour ? (st % (readTime(textOf(s)) * 1.1 / s.tour.length)) / (readTime(textOf(s)) * 1.1 / s.tour.length) : Math.min(1, st / 6), a = -.5 + lu * .8;
        _p.set(Math.sin(a) * 14, 4.2 + lu * 1.5, 6 + Math.cos(a) * 8); _l.set(Math.sin(a) * 3, 4.5, -14); if (s.tour && Math.random() < .3) world?.A.react?.({ power: .4 }); }
      else if (s.kind === 'card') { _p.set(mid, 5.2 - 2.2 * e, 14 - 3 * e); _l.set(mid, 1.5, 0); }
      else if (s.kind === 'narr') { const a = -.3 + .6 * u; _p.set(mid + Math.sin(a) * 10.5, 3.2, Math.cos(a) * 10.5); _l.set(mid, 1.4, 0); }
      else if (s.kind === 'ending') { _p.set(pos(0).x + .2, .9 + .5 * e, 6.5 - 1.6 * e); _l.set(pos(0).x, 2, 0); }
      else {
        const me = pos(s.side).clone(), other = pos(1 - s.side), dir = Math.sign(other.x - me.x) || 1;
        if (s.ots) { _p.set(other.x + dir * .75, 2.55, other.z + 1.8); _l.set(me.x, 2.2, me.z); }
        else { _p.set(me.x + dir * (1.9 - .25 * e), 2.25, me.z + 3.1 - .4 * e); _l.set(me.x + dir * .15, 2.15, me.z); }
      }
      cam.position.copy(_p); cam.lookAt(_l);
      // texto que se escribe solo y avance automático cuando ya se ha podido leer
      if (el && s.kind !== 'card') {
        const f = full(s); typed = Math.min(f.length, Math.max(typed, typedN(st, 42)));
        const node = s.kind === 'line' ? txt : el.querySelector('.snarr'); if (node.textContent.length !== typed) node.textContent = f.slice(0, typed);
        node.classList.toggle('done', typed >= f.length); el.classList.toggle('ready', typed >= f.length);
        if (typed >= f.length && (auto += dt) > readTime(f) * (s.tour ? .4 + .2 : .9) && (!s.tour || st > readTime(f) * 1.1)) go();
      } else if (s.kind === 'card' && st > s.dur) go();
      if (!el && st > 2) go();
    };
    go();
    return { finish, shots };
  }
  return { play, get playing() { return !!cur; }, skip: () => cur?.finish() };
}
