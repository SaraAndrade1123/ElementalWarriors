import { Settings } from './systems/settings-manager.js';
import { loadLocale, t } from './systems/localization.js';
import { SceneManager } from './game/scene-manager.js';
import { MenuManager } from './ui/menu-manager.js';
import { Input } from './game/input.js';
import { StageManager } from './stages/stage-manager.js';
import { installStages } from './stages/stage-hook.js';
import { installStageSelect } from './ui/stage-select.js';
import { createMeta } from './systems/meta.js';
import { installMetaPanels } from './ui/meta-panels.js';
import { installAudio, ELEMENT_OF } from './audio/audio-hook.js';
import { createFlow } from './modes/flow.js';
import { installModes } from './ui/modes-ui.js';
import { CpuBrain, DUMMIES } from './game/ai.js';
import { CHALLENGES } from './modes/challenges.js';
import { LEVEL_IDS } from './game/difficulty-config.js';
import { mirrorName } from './systems/mirror-spec.js';
import { installElements } from './elements/element-hook.js';
import { installBending } from './elements/bending-hook.js';
import { installWeapons } from './elements/weapon-hook.js';
import { installWeaponShop } from './ui/weapons-ui.js';
import { installCinematic } from './game/cinematic.js';
import { installFightFx } from './game/fight-fx.js';
import { installVersusPreview } from './ui/versus-preview.js';
import { startTitle } from './ui/title.js';
import { createStoryCine } from './game/story-cine.js';
import { installFightReport } from './game/fight-report.js';
import { renderResult } from './ui/result-screen.js';
import { installPanelDock } from './ui/panel-dock.js';
import { patchFighter as patchTransform, patchCpu as patchTransformCpu, installTransform } from './game/transform.js';
import { Fighter, RULES } from './game/fighter.js';
import { installOutro } from './game/cinematic-end.js';
import { createWeaponPreview } from './ui/weapon-preview.js';

const $ = s => document.querySelector(s);
const stopTitle = (() => { try { return startTitle(document.getElementById('tfx')); } catch { return () => {}; } })(); // chispas de la pantalla de título
// Opciones de la pausa con valor («Dificultad CPU: Normal»): la etiqueta a la izquierda y el valor en una placa a la derecha.
const optText = (node, s) => { if (!node) return; const i = s.lastIndexOf(': '); if (i < 0) { node.textContent = s; return; }
  const k = document.createElement('span'), v = document.createElement('span'); k.className = 'opt-k'; v.className = 'opt-v'; k.textContent = s.slice(0, i); v.textContent = s.slice(i + 2); node.replaceChildren(k, v); };
const status = $('#status'), bar = $('#bar'), meter = $('.meter');
const MSG = {
  es: { file: 'Abre el juego con un servidor local (en la carpeta del proyecto: npx serve .). Desde file:// el navegador bloquea módulos y modelos.', boot: 'No se pudo iniciar: {e}. Revisa la consola (F12) y que WebGL esté activo.' },
  en: { file: 'Open the game through a local server (in the project folder run: npx serve .). Browsers block modules and models from file://.', boot: 'Could not start: {e}. Check the console (F12) and that WebGL is enabled.' }
};
const fail = msg => { status.textContent = msg; status.classList.add('error'); };
const json = async p => { const r = await fetch(p); if (!r.ok) throw new Error(`${p}: ${r.status}`); return r.json(); };
const optional = p => json(p).catch(e => { console.warn('[datos] opcional no disponible:', p, e.message); return null; });

async function boot() {
  const settings = new Settings(); let lang = settings.get().lang, menu = null;
  const L = MSG[lang];
  if (location.protocol === 'file:' && !globalThis.__EW_STANDALONE) return fail(L.file); // la versión de un solo archivo (index.html) funciona sin servidor
  try {
    await loadLocale(lang);
    const [{ roster }, { items }, shopData, achData, economy, stageData, moves, modes, mirrorData, weaponData, introData, outroData] = await Promise.all([json('data/characters.json'), json('data/menu.json'), json('data/items.json'), json('data/achievements.json'), json('data/economy.json'), json('data/stages.json'), json('data/moves.json'), json('data/modes.json'), optional('data/mirror.json'), optional('data/weapons.json'), optional('data/intros.json'), optional('data/outros.json')]);
    const scene = new SceneManager($('#stage'), settings.get()); scene.mirrorData = mirrorData;
    settings.subscribe(s => {
      scene.apply(s); document.body.dataset.reduce = s.reduceMotion ? '1' : '0';
      if (s.lang !== lang) { // cambio de idioma desde Ajustes
        lang = s.lang;
        loadLocale(lang).then(() => menu?.refresh()).catch(e => console.error('[i18n]', e));
      }
    });
    const failed = await scene.loadCharacters(roster, (done, total) => {
      bar.style.width = `${(done / total) * 100}%`; meter.setAttribute('aria-valuenow', Math.round((done / total) * 100));
      status.textContent = t('ui.loading', { done, total });
    });
    scene.show(roster[0].id); scene.start();
    status.textContent = failed.length ? t('ui.partial', { n: failed.length }) : t('ui.ready'); if (failed.length && scene.loadErrors?.length) status.title = scene.loadErrors.join('\n'); // detalle al pasar el ratón
    // Dificultad de la CPU para los combates sueltos (Jugar / Entrenamiento con maniquí CPU); se guarda en este navegador.
    const store = { get: k => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } } };
    let cpuLevel = LEVEL_IDS.includes(store.get('ew.cpuLevel')) ? store.get('ew.cpuLevel') : 'normal';
    menu = new MenuManager({
      menu: items, roster, scene, settings, moves, onPlay: (a, b, m) => flow.begin({ kind: 'plain', cfg: { a, b, mode: m, rec: m === 'training' ? 'training' : 'versus_ai', level: cpuLevel } }),
      el: { view: $('#view'), prev: $('#prev'), next: $('#next'), dots: $('#pl-dots'), name: $('#pl-name'), alias: $('#pl-alias'), elem: $('#pl-el'), toast: $('#toast') }
    });
    const dev = new URLSearchParams(location.search).has('dev');
    const meta = createMeta({ items: shopData.items, achievements: achData.achievements, economy });
    roster.forEach(r => scene.setPalette(r.id, meta.shop.paletteOf(r.id)));
    installMetaPanels(menu, { meta, scene, roster, dev });
    if (dev) window.ew = meta; // consola: ew.progression.recordMatch({...})
    const stages = new StageManager(stageData.stages);
    stages.problems.forEach(p => console.warn('[stages]', p));
    installStages(scene, stages); installStageSelect(menu, { stages });
    const audio = installAudio({ menu, scene, meta, stages });
    const elements = installElements({ menu, scene, roster }); // triángulo elemental (docs/ELEMENTOS.md)
    const bending = installBending({ menu, scene, roster }); // control elemental (docs/CONTROL-ELEMENTAL.md)
    installWeapons({ scene, roster, save: meta.save, data: weaponData }); // armas de la tienda y rompeguardia (docs/ARMAS.md)
    const wPreview = createWeaponPreview({ scene, roster, moves, sfx: (n, d = {}) => audio.sfx(n, { ...d, element: ELEMENT_OF[d.who] }) });
    if (weaponData) installWeaponShop(menu, { meta, roster, data: weaponData, preview: wPreview });
    installFightFx({ scene, roster }); // impactos, congelado de técnica y K.O. con más producción (docs/PRESENTACION.md)
    installCinematic({ scene, roster, data: introData }); // cinemática con diálogo antes de cada combate
    patchTransform(Fighter, RULES); patchTransformCpu(CpuBrain); installTransform({ scene, t, colorOf: id => scene.__elements?.rules?.elements?.[scene.__elements?.elementOf?.(id)]?.color }); // transformación definitiva (F5)
    installFightReport({ scene }); // bonificaciones y rango de cada combate (pantalla de resultados)
    installOutro({ scene, roster, data: outroData }); // cinemática de victoria al terminar cada combate (antes del panel)
    if (dev) window.ewAudio = audio; // consola: ewAudio.sfx('hit_heavy', { element: 'fire' })
    if (dev) window.ewStages = stages; // consola: ewStages.react({ power: 1 })
    if (dev) window.ewScene = scene; // consola: ewScene.match.f[1].hp = 1
    if (dev) window.ewMenu = menu; // consola: ewMenu.go('versus')
    let paused = false;
    const QS = ['low', 'medium', 'high'], pz = $('#pause'), rz = $('#result');
    const label = () => { optText($('#p-quality .lbl'), t('pause.quality', { q: t('set.q.' + settings.get().quality) })); };
    const pause = on => {
      if (menu.enabled || !scene.match || !rz.hidden || !$('#story').hidden) return; paused = on ?? !paused;
      scene.match.paused = input.paused = paused; input.clear(); pz.hidden = !paused;
      if (paused) { label(); optLabels(); renderDuel(); $('#p-resume').focus(); } else document.activeElement?.blur();
    };
    const input = new Input($('#touch'), () => pause());
    const dbgEl = $('#dbg'); let dbgOn = false, lastDbg = '';
    const H = { hp: [$('#hp1'), $('#hp2')], tr: [$('#tr1'), $('#tr2')], gd: [$('#gd1'), $('#gd2')], res: [$('#res1'), $('#res2')], pips: [$('#pips1'), $('#pips2')], timer: $('#timer'), ann: $('#announce'), combo: $('#combo'), notes: $('#notes') };
    let lastAnn = '', lastPips = '', lastNotes = '', lastRes = '';
    const hud = s => {
      s.hp.forEach((v, i) => { const w = (v * 100).toFixed(1) + '%'; H.hp[i].style.width = w; H.tr[i].style.width = w; });
      s.guard?.forEach((v, i) => { H.gd[i].style.width = (v * 100).toFixed(0) + '%'; });
      const rk = s.meter?.map(v => Math.floor(v * 100)).join(); if (rk && rk !== lastRes) { lastRes = rk; s.meter.forEach((v, i) => { // barra con marcas de coste (25 / 50) y número
        const el = H.res[i], n = Math.floor(v * 100); el.querySelector('i').style.width = n + '%'; el.classList.toggle('full', n >= 100);
        el.querySelector('.rlbl').innerHTML = `${t('hud.res')} <em>${n}</em>`; }); }
      const nk = (s.notes || []).map(n => n.text + n.side).join('|'); if (nk !== lastNotes) { lastNotes = nk; H.notes.replaceChildren(...(s.notes || []).map(n => { const p = document.createElement('p'); p.className = (n.side ? 'r ' : 'l ') + n.kind; p.textContent = n.text; return p; })); }
      const tr = s.mode === 'training'; H.timer.hidden = tr;
      const need = s.need ?? 2, p = tr ? ['', ''] : s.wins.map(w => '●'.repeat(w) + '○'.repeat(Math.max(0, need - w))); if (p.join() !== lastPips) { lastPips = p.join(); p.forEach((x, i) => { H.pips[i].textContent = x; }); }
      H.timer.textContent = Number.isFinite(s.timer) ? s.timer : '∞';
      if (s.text !== lastAnn) { lastAnn = s.text; H.ann.textContent = s.text; H.ann.classList.remove('pop'); void H.ann.offsetWidth; if (s.text) H.ann.classList.add('pop'); }
      const dl = s.dbg ? s.dbg.join('\n') : ''; if (dl !== lastDbg) { lastDbg = dl; dbgEl.textContent = dl; } dbgEl.hidden = !s.dbg;
      const c = s.combo; H.combo.hidden = !c; if (c) { H.combo.textContent = c.n > 1 ? t('hud.combo', { n: c.n }) : ''; if (tr && c.dmg) { const sm = document.createElement('small'); sm.textContent = t('hud.dmg', { d: c.dmg.toFixed(1) }); H.combo.append(sm); } H.combo.className = 'combo ' + (c.side ? 'r' : 'l'); }
    };
    // ---------- combates, resultados y diálogos (el orden de los combates lo decide js/modes/flow.js)
    let cur = null, again = null, nxt = null, onMenu = null, flow;
    const nameOf = id => roster.find(r => r.id === id)?.name ?? id;
    // Nombre de cada lado de un combate: en un duelo espejo el J2 lleva el nombre de su chroma (p. ej. «Ignis · Llama Jade»).
    const sideName = (c, i) => { const id = i ? c?.b : c?.a; return i && c?.a === c?.b ? mirrorName(roster.find(r => r.id === id), t) : nameOf(id); };
    const sideFx = (c, i) => { const id = i ? c.b : c.a, def = roster.find(r => r.id === id); return (i && c.a === c.b ? scene.mirrors.get(id)?.fx : scene.chars.get(id)?.fx) ?? def.fx; };
    // Cartel de duelo de la pausa: dos placas enfrentadas (quién controla cada lado, nombre, elemento) y emblema VS.
    const sideTag = (c, i) => { const md = c.mode || 'cpu'; if (md === 'versus') return t(i ? 'pause.side.p2' : 'pause.side.p1');
      if (md === 'training') return t(i ? 'pause.side.dummy' : 'pause.side.you'); return i ? t('pause.side.cpu', { level: t('level.' + (scene.match?.brain?.level || c.level || cpuLevel)) }) : t('pause.side.you'); };
    const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
    const renderDuel = () => {
      if (!cur) return; const box = $('#pause-vs'), E = scene.__elements;
      const plate = i => { const id = i ? cur.b : cur.a, side = el('div', 'duel-side p' + (i + 1)), fx = sideFx(cur, i), elId = E?.elementOf?.(id);
        side.style.setProperty('--sc', fx.light || fx.color);
        const sub = el('span', 'duel-sub'); if (elId) { const g = el('span', 'elgem'); g.style.setProperty('--elc', E.rules.elements[elId]?.color || '#b5b9c2'); sub.append(g, el('span', '', t('elem.' + elId))); }
        if (i && cur.a === cur.b) sub.append(el('span', 'duel-mirror', t('mirror.tag')));
        const wid = scene.match?.f?.[i]?.weaponId; if (wid) sub.append(el('span', 'duel-weapon', t('item.' + wid))); // arma equipada
        // En un duelo espejo el nombre grande es el del guerrero y el epíteto del chroma va en su propia línea (sin recortes).
        const full = sideName(cur, i), base = nameOf(id), mir = i && cur.a === cur.b, epi = mir && full !== base ? (full.startsWith(base + ' · ') ? full.slice(base.length + 3) : full) : null;
        side.append(el('span', 'duel-who', sideTag(cur, i)), el('b', 'duel-name', mir ? base : full)); if (epi) side.append(el('span', 'duel-epithet', epi)); side.append(sub); return side; };
      const vs = el('div', 'duel-vs'); const gem = el('b'); gem.append(el('span', '', t('pause.vsmark'))); vs.append(gem);
      box.replaceChildren(plate(0), vs, plate(1)); box.setAttribute('aria-label', t('pause.vs', { a: sideName(cur, 0), b: sideName(cur, 1) }));
      const m = scene.match, st = stages.current?.id;
      const rule = m?.mode === 'training' ? t('pause.rule.train') : t('pause.rule.bo', { n: (m?.winsNeeded ?? 2) * 2 - 1 });
      $('#pause-meta').textContent = [m?.mode === 'training' ? null : t('pause.round', { n: m?.round ?? 1 }), rule, st ? t(`stage.${st}.name`) : null].filter(Boolean).join('  ·  ');
    };
    // Fin de combate → Rose Gold, estadísticas y logros (una sola vez por combate: matchId único).
    // Fin de combate → Rose Gold (base + bonificaciones del resumen), estadísticas y logros. En 2 jugadores el J2 también suma a la misma cuenta.
    let pending = null;
    const record = (r, c) => {
      const id = globalThis.crypto?.randomUUID?.() ?? `m-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      const rep = scene.__report?.build(r) || null, local = c.mode === 'versus', out = w => w < 0 ? 'draw' : w ? 'loss' : 'win';
      const rec = meta.progression.recordMatch({ matchId: id, mode: c.rec ?? 'versus_ai', outcome: out(r.winner),
        characterId: c.a, roundsWon: r.wins[0], difficulty: c.level || 'normal', maxCombo: r.stats.combo[0], maxDamage: Math.round(r.stats.best[0]), durationSec: Math.round(r.time), transformations: rep?.sides[0].stats.tf || 0,
        bonusGold: rep?.sides[0].gold || 0, p2: local && rep ? { outcome: r.winner < 0 ? 'draw' : r.winner === 1 ? 'win' : 'loss', roundsWon: r.wins[1], bonusGold: rep.sides[1].gold } : null });
      const ok = rec.ok && !rec.ignored;
      pending = rep ? { rep, cfg: c, local, gold: ok ? [rec.base + rec.extra + (rec.bonus || 0), rec.p2] : [0, 0], result: r } : null;
      if (local && rep) book('pvp', { res: r, rep, cfg: c, count: pvpCount() });
      return ok ? rec.gold + (rec.bonus || 0) : 0;
    };
    // Desafíos que se cumplen jugando (modos y 2 jugadores): se comprueban al ocurrir el evento y pagan una sola vez.
    const book = (on, ev) => { try {
      const done = meta.save.data.challenges;
      for (const c of CHALLENGES) if (c.on === on && !done.includes(c.id) && c.check(ev)) { const rc = meta.progression.recordChallenge(c.id, c.gold); if (rc.ok) setTimeout(() => menu.toast(t('challenge.toast', { name: t(`ch.${c.id}.name`), n: rc.gold })), 400); }
    } catch (e) { console.warn('[desafíos]', e); } };
    { const P = meta.progression, rr = P.recordRun.bind(P), re = P.recordEvent.bind(P);
      P.recordRun = s => { const r = rr(s); if (s?.kind === 'arcade' || s?.kind === 'survival') book(s.kind, s); return r; };
      P.recordEvent = n => { const r = re(n); if (n === 'story_clear') book('story', { all: roster.every(c => (meta.save.data.story?.[c.id] || 0) >= (modes.order[c.id]?.length || 3)) }); return r; }; }
    const pvpCount = () => { try { const n = (+localStorage.getItem('ew.pvp') || 0) + 1; localStorage.setItem('ew.pvp', n); return n; } catch { return 1; } };
    const showPanel = p => {
      const rep = pending; pending = null;
      renderResult(p, rep, { t, roster, sideName, sideFx, colorOf: id => scene.__elements?.rules?.elements?.[scene.__elements?.elementOf?.(id)]?.color });
      again = p.again?.run ?? null; nxt = p.next?.run ?? null; onMenu = p.onMenu ?? null;
      $('#r-again').hidden = !p.again; if (p.again) $('#r-again .lbl').textContent = p.again.label;
      $('#r-next').hidden = !p.next; if (p.next) $('#r-next .lbl').textContent = p.next.label;
      pz.hidden = true; paused = false; rz.hidden = false; input.clear(); ($('#r-next').hidden ? $('#r-again').hidden ? $('#r-menu') : $('#r-again') : $('#r-next')).focus();
    };
    // Diálogo de historia: lista de {who, key}; «Continuar» sigue con el flujo.
    // Historia: escenas rodadas en 3D (js/game/story-cine.js); si algo falla, el diálogo clásico de siempre.
    const storyCine = createStoryCine({ scene, roster, colorOf: id => scene.__elements?.rules?.elements?.[scene.__elements?.elementOf?.(id)]?.color });
    const showStory = (scenes, done, ctx) => {
      if (!settings.get().reduceMotion) try {
        const wasMenu = $('#menu').hidden, en = menu.enabled; rz.hidden = true; $('#hud').hidden = true; $('#menu').hidden = true; menu.enabled = false; input.detach?.();
        storyCine.play(scenes, () => { $('#menu').hidden = wasMenu; menu.enabled = en; done(); }, ctx); return;
      } catch (e) { console.warn('[historia] escena 3D no disponible', e); }
      return showStoryPanel(scenes, done);
    };
    const showStoryPanel = (scenes, done) => {
      const box = $('#story-lines'); box.replaceChildren(...scenes.map(s => { const p = document.createElement('p'), who = s.who === 'narrator' ? t('story.narrator') : nameOf(s.who);
        p.className = 'line' + (s.who === 'narrator' ? ' narr' : ''); if (s.who !== 'narrator') { const b = document.createElement('b'); b.textContent = who; p.append(b); } p.append(t(s.key)); return p; }));
      const go = $('#story-next'); rz.hidden = true; $('#story').hidden = false; go.focus();
      go.onclick = () => { $('#story').hidden = true; go.onclick = null; done(); };
    };
    const hintEl = $('#hint');
    const showHint = txt => { hintEl.textContent = txt; hintEl.classList.remove('fade'); void hintEl.offsetWidth; hintEl.classList.add('fade'); };
    flow = createFlow({
      cfg: modes, progression: meta.progression, t, nameOf, sideName, record, restart: () => { rz.hidden = true; scene.match.restart(); },
      fight: c => fight(c), panel: showPanel, report: () => pending?.rep, story: showStory, hint: txt => { hintEl.textContent = txt; hintEl.classList.remove('fade'); },
      pauseMatch: on => { if (!scene.match) return; scene.match.paused = input.paused = on; input.clear(); }
    });
    const showResult = r => flow.onResult(r);
    const fight = c => {
      cur = c; const { a, b, mode = 'cpu' } = c, vs = mode === 'versus';
      try {
        input.setScheme(vs ? 'versus' : 'solo');
        scene.startMatch(a, b, input, { moves, mode, level: c.level || cpuLevel, wins: c.wins, maxRounds: c.maxRounds, roundTime: c.roundTime, startHp: c.startHp, dummy: c.dummy, infinite: c.infinite, stage: c.stage,
          onEvent: e => flow.onEvent(e), onHud: hud, onResult: showResult, onFx: (n, d = {}) => audio.sfx(n, { ...d, element: ELEMENT_OF[d.who] }), onReact: p => stages.react(p) });
      } catch (e) { console.error('[match]', e); return menu.toast(t('play.err', { e: e.message })); }
      $('#hud-n1').textContent = sideName(c, 0); $('#hud-n2').textContent = sideName(c, 1);
      [0, 1].forEach(i => { const fx = sideFx(c, i); H.res[i].style.setProperty('--rc1', fx.light); H.res[i].style.setProperty('--rc2', fx.color); }); lastRes = ''; lastNotes = '';
      renderDuel(); showHint(t(vs ? 'hud.hint.versus' : mode === 'training' ? 'hud.hint.train' : 'hud.hint.cpu'));
      $('#guide-solo').hidden = vs; $('#guide-vs').hidden = !vs;
      for (const li of document.querySelectorAll('.train-only')) li.hidden = mode !== 'training';
      for (const li of document.querySelectorAll('.cpu-only')) li.hidden = mode !== 'cpu';
      scene.match.setDebug(dbgOn); paused = input.paused = false; pz.hidden = true; rz.hidden = true; $('#story').hidden = true;
      menu.enabled = false; $('#menu').hidden = true; $('#hud').hidden = false; input.attach(); document.activeElement?.blur();
    };
    const leave = () => {
      if (menu.enabled) return; onMenu?.(); onMenu = null; flow.abandon(); paused = input.paused = false; pz.hidden = true; rz.hidden = true; $('#story').hidden = true; input.detach(); scene.endMatch();
      $('#hud').hidden = true; $('#menu').hidden = false; menu.enabled = true; menu.select(menu.idx); menu.go('home');
    };
    installModes(menu, { cfg: modes, roster, stages, meta, flow });
    installVersusPreview(menu, { scene, roster }); // Versus: los dos elegidos frente a frente
    installPanelDock(menu); // botón principal fijo al pie del panel (no tapa el contenido)
    for (const href of ['css/cinema.css', 'css/result.css', 'css/mobile.css']) { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = href; document.head.append(l); } // cinemáticas v1.3 y ajustes de celular: siempre las últimas hojas
    // Pausa: maniquí, vida infinita y reinicio de posiciones (entrenamiento) · dificultad de la CPU (combate contra la CPU)
    const optLabels = () => {
      const m = scene.match;
      optText($('#p-dummy .lbl'), t('pause.dummy', { name: t('dummy.' + (m?.dummy || 'still')) }));
      optText($('#p-inf .lbl'), t('pause.infinite', { v: t(m?.infinite ? 'pause.on' : 'pause.off') }));
      optText($('#p-opt .lbl'), t('pause.level', { m: t('level.' + (m?.brain?.level || cpuLevel)) }));
    };
    $('#p-dummy').addEventListener('click', () => { const m = scene.match; m.setDummy(DUMMIES[(DUMMIES.indexOf(m.dummy || 'still') + 1) % DUMMIES.length]); optLabels(); });
    $('#p-inf').addEventListener('click', () => { scene.match.infinite = !scene.match.infinite; optLabels(); });
    $('#p-reset').addEventListener('click', () => { scene.match.resetPositions(); pause(false); });
    $('#p-opt').addEventListener('click', () => {
      const m = scene.match; if (m?.mode !== 'cpu') return; const now = m.brain?.level || cpuLevel;
      cpuLevel = LEVEL_IDS[(LEVEL_IDS.indexOf(now) + 1) % LEVEL_IDS.length]; store.set('ew.cpuLevel', cpuLevel); m.brain = new CpuBrain(Math.random, cpuLevel); if (cur) cur.level = cpuLevel; optLabels();
    });
    addEventListener('keydown', e => { if (e.code === 'KeyR' && !e.repeat && !paused && scene.match?.mode === 'training' && rz.hidden && pz.hidden && input.scheme === 'solo') scene.match.resetPositions(); }); // R: reinicia posiciones
    addEventListener('keydown', e => { // F1: herramientas de depuración del combate (cajas de golpe/daño y datos de fotogramas)
      if (e.code !== 'F1') return; e.preventDefault(); if (e.repeat || menu.enabled || !scene.match) return;
      dbgOn = !dbgOn; scene.match.setDebug(dbgOn); if (!dbgOn) { dbgEl.hidden = true; lastDbg = ''; }
    });
    $('#exit').addEventListener('click', () => pause(true));
    $('#p-resume').addEventListener('click', () => pause(false));
    $('#p-restart').addEventListener('click', () => { scene.match.restart(); pause(false); });
    $('#r-again').addEventListener('click', () => { rz.hidden = true; const f = again; again = null; f?.(); });
    $('#r-next').addEventListener('click', () => { rz.hidden = true; const f = nxt; nxt = null; f?.(); });
    $('#r-menu').addEventListener('click', leave);
    $('#p-quality').addEventListener('click', () => { settings.set({ quality: QS[(QS.indexOf(settings.get().quality) + 1) % 3] }); label(); });
    $('#p-menu').addEventListener('click', leave);
    addEventListener('keydown', e => { // navegación con flechas dentro de la pausa
      const ov = !pz.hidden ? pz : !rz.hidden ? rz : null; if (!ov || (e.key !== 'ArrowDown' && e.key !== 'ArrowUp')) return;
      const b = [...ov.querySelectorAll('.nav-item')].filter(x => !x.closest('[hidden]') && !x.hidden), i = b.indexOf(document.activeElement);
      b[(i + (e.key === 'ArrowDown' ? 1 : -1) + b.length) % b.length]?.focus(); e.preventDefault();
    });
    document.addEventListener('visibilitychange', () => { if (document.hidden && !paused) pause(true); });
    const start = $('#start'); start.hidden = false; start.focus();
    start.addEventListener('click', () => {
      stopTitle(); $('#loader').classList.add('out'); $('#menu').hidden = false; menu.init();
      setTimeout(() => { $('#loader').hidden = true; }, 650);
    }, { once: true });
  } catch (e) {
    console.error('[boot]', e);
    fail(L.boot.replace('{e}', e.message));
  }
}
boot();
