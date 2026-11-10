// Flujo de las partidas con modos (Arcade, Historia, Supervivencia, Versus, Desafíos y combates sueltos).
// Decide qué pasa al acabar cada combate; no toca el DOM: la interfaz llega por `env` (se prueba con Node).
//   env.fight(cfg)  inicia un combate       env.panel(spec)  muestra el panel de resultados     env.story(scenes, done)  diálogo
//   env.record(result, cfg) → Rose Gold ganado (progression.recordMatch)   env.hint(text)  texto de objetivo en el HUD
//   env.restart()   reinicia el combate actual   env.pauseMatch(on)   env.nameOf(id)   env.progression   env.cfg   env.t
import { ChallengeTracker, CHALLENGES } from './challenges.js';
import { goalText } from './story.js';

const fmt = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
export function createFlow(env) {
  const { t, progression } = env; let ses = null, tracker = null, last = null;
  const run = fc => { last = fc; env.fight(fc); if (tracker) env.hint(progressText()); else if (fc?.goal && fc.goal.t !== 'win') env.hint(t('story.goal.hud', { n: fc.chapter, goal: goalText(fc.goal, t) })); };
  const hero = () => env.nameOf(last.a);
  const side = i => env.sideName ? env.sideName(last, i) : env.nameOf(i ? last.b : last.a); // en un duelo espejo el J2 tiene otro nombre
  const progressText = () => `${t(`ch.${tracker.def.id}.goal`)} · ${tracker.count}/${tracker.def.goal}`;
  // (v1.12) el reto del capítulo se convierte en texto antes de la escena
  const withGoal = scenes => scenes.map(s => s.p?.goal ? { ...s, p: { ...s.p, goal: goalText(s.p.goal, t) } } : s);
  const story = (scenes, done) => (ses?.kind === 'story' && scenes.length ? env.story(withGoal(scenes), done, { hero: ses.obj.hero, rival: ses.obj.rivals?.[Math.min(ses.obj.i, ses.obj.total - 1)], chapter: Math.min(ses.obj.i, ses.obj.total - 1), total: ses.obj.total, world: ses.obj.stageAt?.(Math.min(ses.obj.i, ses.obj.total - 1)), home: env.cfg?.stageByElement?.[env.cfg?.elementOf?.[ses.obj.hero]], final: env.cfg?.finalStage }) : done());
  const base = (r, gold) => [['result.rounds', `${r.wins[0]} - ${r.wins[1]}`], ['result.damage', `${Math.round(r.stats.dmg[0])} / ${Math.round(r.stats.dmg[1])}`], ['result.combo', `${r.stats.combo[0]} / ${r.stats.combo[1]}`], ['result.time', fmt(r.time)], ...(gold ? [['result.gold', `+${gold}`]] : [])];
  const totals = (o, extra = []) => [['result.score', o.score.toLocaleString()], ['result.wins', o.wins], ['result.time', fmt(o.time)], ...extra];

  function begin(session) {
    ses = session; tracker = null; last = null;
    switch (ses.kind) {
      case 'arcade': case 'story': { const L = ses.obj; story(L.scenesBefore(), () => run(L.fight())); break; }
      case 'survival': run(ses.obj.fight()); break;
      case 'challenge': {
        const d = ses.def;
        if (d.kind === 'fight') { ses.kind = 'challenge_fight'; run({ a: ses.hero, b: ses.rival, mode: 'cpu', rec: 'versus_ai', level: d.level, wins: d.wins, maxRounds: d.wins * 2 + 1, roundTime: d.roundTime ?? 60 }); break; }
        tracker = new ChallengeTracker(d); run({ a: ses.hero, b: ses.rival, mode: 'training', rec: 'training', dummy: d.dummy, infinite: d.infinite }); break; }
      default: ses = { kind: 'plain', cfg: session.cfg }; run(session.cfg);
    }
  }

  function onEvent(e) {
    if (ses?.kind !== 'challenge' || !tracker || tracker.done) return;
    const before = tracker.count, done = tracker.feed(e); if (tracker.count !== before) env.hint(progressText()); if (done) complete();
  }
  function complete() {
    const d = tracker.def, r = progression.recordChallenge(d.id, d.gold), live = CHALLENGES.filter(c => !c.locked && !c.kind), nxt = live[(live.indexOf(d) + 1) % live.length];
    env.pauseMatch(true);
    env.panel({ title: t('result.ch.done'), sub: t(`ch.${d.id}.name`), rows: r.ok ? [['result.gold', `+${r.gold}`]] : [['result.ch.again', '✓']],
      again: { label: t('result.ch.keep'), run: () => env.pauseMatch(false) },
      next: nxt !== d ? { label: t('result.ch.next'), run: () => begin({ kind: 'challenge', def: nxt, hero: ses.hero, rival: ses.rival }) } : null });
  }

  function onResult(r) {
    const gold = env.record(r, last) || 0, kind = ses?.kind ?? 'plain', win = r.winner === 0;
    const verdict = r.winner < 0 ? t('result.draw') : win ? t('result.win') : t('result.lose');
    if (kind === 'plain' || kind === 'versus') {
      return env.panel({ title: verdict, sub: r.winner < 0 ? '' : t('result.winner', { name: side(r.winner) }), rows: base(r, gold), again: { label: t('result.again'), run: () => env.restart() } });
    }
    if (kind === 'arcade' || kind === 'story') return ladderResult(r, gold, verdict);
    if (kind === 'challenge_fight') { // desafío de combate: la condición se mira con el resumen del combate
      const d = ses.def, rep = env.report?.(), c = { res: r, rep, s: rep?.sides?.[0], cfg: last }, ok = !!(c.s && d.check(c));
      const rc = ok ? progression.recordChallenge(d.id, d.gold) : null, rows = base(r, gold);
      if (rc?.ok) rows.push(['result.ch.reward', `+${rc.gold}`]);
      return env.panel({ title: ok ? t('result.ch.done') : t('result.ch.fail'), sub: t(`ch.${d.id}.goal`), rows,
        again: { label: t(ok ? 'result.ch.again2' : 'result.retry'), run: () => run(last) } });
    }
    if (kind === 'survival') return survivalResult(r, gold, verdict);
  }

  function ladderResult(r, gold, verdict) {
    const L = ses.obj, i = L.i, rep = L.report(r), story = ses.kind === 'story', rows = base(r, gold);
    if (rep.status === 'draw') return env.panel({ title: verdict, rows, again: { label: t('result.replay'), run: () => run(L.fight()) } });
    if (rep.status === 'next') {
      if (story) progression.setStory(L.hero, L.i);
      return env.panel({ title: verdict, sub: t('result.next.rival', { name: env.nameOf(L.rivals[L.i]), n: L.i + 1, total: L.total }), rows: [...rows, ['result.score', L.score.toLocaleString()]],
        next: { label: t('result.next'), run: () => envStory([...L.scenesAfter(i), ...L.scenesBefore()], () => run(L.fight())) } });
    }
    if (rep.status === 'goal') { // (v1.12) historia: ganó pero sin cumplir el reto del capítulo → se repite
      return env.panel({ title: t('story.goal.fail'), sub: goalText(rep.goal, t), rows, again: { label: t('result.retry'), run: () => run(L.useContinue()) }, onMenu: () => L.giveUp() });
    }
    if (rep.status === 'lost') {
      const left = L.continuesLeft; const label = story ? t('result.retry') : t('result.retry.left', { n: left });
      return env.panel({ title: verdict, sub: t('result.lose.sub', { name: env.nameOf(L.rivals[L.i]) }), rows, again: { label, run: () => run(L.useContinue()) }, onMenu: () => L.giveUp() });
    }
    // clear / over: fin de la escalera
    const S = L.summary(), cleared = rep.status === 'clear'; let record = false;
    if (cleared) { if (story) { progression.setStory(L.hero, L.total); progression.recordEvent('story_clear'); } else progression.recordEvent('arcade_clear'); }
    if (!story) record = !!progression.recordRun(S).record;
    const fin = () => env.panel({ title: cleared ? t(story ? 'result.story.clear' : 'result.arcade.clear') : t('result.arcade.over'), sub: cleared ? t('result.hero.done', { name: hero() }) : '',
      rows: [...totals(S, story ? [] : [['result.continues', S.continues], ['result.level', t('level.' + S.level)]]), ...(record ? [['result.record', '★']] : []), ...(gold ? [['result.gold', `+${gold}`]] : [])] });
    if (cleared && story) envStory(L.scenesAfter(i), fin); else fin();
  }
  const envStory = (scenes, done) => story(scenes, done);

  function survivalResult(r, gold, verdict) {
    const S = ses.obj, rep = S.report(r), rows = base(r, gold);
    if (rep.status === 'draw') return env.panel({ title: verdict, rows, again: { label: t('result.replay'), run: () => run(S.fight()) } });
    if (rep.status === 'next') return env.panel({ title: verdict, sub: t('result.surv.next', { name: env.nameOf(S.rival), hp: Math.round(S.hp * 100) }), rows: [...rows, ['result.score', S.score.toLocaleString()], ['result.wins', S.wins]], next: { label: t('result.next'), run: () => run(S.fight()) } });
    const sum = S.summary(), record = !!progression.recordRun(sum).record;
    env.panel({ title: t('result.surv.over'), sub: t('result.surv.sub', { n: sum.wins }), rows: [...totals(sum), ['result.level', t('level.' + sum.level)], ...(record ? [['result.record', '★']] : []), ...(gold ? [['result.gold', `+${gold}`]] : [])] });
  }

  // Al salir al menú tras una derrota en arcade, la escalera termina (no cuenta como completada).
  const abandon = () => { if (ses?.kind === 'arcade' && !ses.obj.done) ses.obj.giveUp(); ses = null; tracker = null; };
  return { begin, onResult, onEvent, abandon, get kind() { return ses?.kind ?? null; }, get tracker() { return tracker; } };
}
