// Pantalla de Versus: los DOS guerreros elegidos frente a frente en 3D (el segundo con su chroma si es espejo),
// con su placa de nombre, elemento y quién lo controla, y el emblema VS en medio. Se instala sin tocar modes-ui.js.
import { t } from '../systems/localization.js';
import { mirrorName } from '../systems/mirror-spec.js';
import { RAND } from './track-ui.js';

export function installVersusPreview(menu, { scene, roster }) {
  const page = menu.page_versus?.bind(menu); if (!page) return;
  let box = null, spin = null, k = 0; // «Aleatorio»: ruleta que va mostrando a los posibles rivales
  const colOf = id => scene.__elements?.rules?.elements?.[scene.__elements?.elementOf?.(id)]?.color || '#f1dc9a';
  const elName = id => { const e = scene.__elements?.elementOf?.(id); return e ? t('elem.' + e) : ''; };
  const stop = () => { clearInterval(spin); spin = null; };
  const clear = () => { stop(); scene.clearPair?.(); box?.remove(); box = null; document.body.classList.remove('vs-select'); };
  menu.page_versus = function () {
    page();
    try {
      const v = menu.el.view, a = roster[menu.idx], rand = menu.rival === RAND, others = roster.filter(r => r !== a);
      if (!rand) stop(); else if (!spin) spin = setInterval(() => { if (menu.page !== 'versus' || menu.rival !== RAND) return stop(); k++; scene.showPair?.(a.id, others[k % others.length].id, { quiet: true }); }, 1100);
      const b = rand ? others[k % others.length] : roster[menu.rival ?? (menu.idx + 1) % roster.length]; if (!a || !b) return;
      const local = v.querySelector('.tabs')?.querySelectorAll('button')[1]?.getAttribute('aria-pressed') === 'true'; // pestaña «2 jugadores»
      scene.showPair?.(a.id, b.id, { quiet: rand });
      document.body.classList.add('vs-select');
      if (!box) { box = document.createElement('div'); box.id = 'vsprev'; box.setAttribute('aria-hidden', 'true'); document.body.append(box); }
      const mirror = a.id === b.id, bName = mirror ? mirrorName(b, t) : b.name, bCol = mirror ? (scene.mirrors?.get(b.id)?.fx?.color || colOf(b.id)) : colOf(b.id);
      const plate = (cls, who, name, el, col) => `<div class="vsp ${cls}" style="--c:${col}"><i>${who}</i><b>${name}</b><span><em class="elgem" style="--elc:${col}"></em>${el}</span></div>`;
      box.innerHTML = plate('a', t('pause.side.p1'), a.name, elName(a.id), colOf(a.id)) + '<div class="vsm"><span>VS</span></div>' + (rand ? plate('b rand', local ? t('pause.side.p2') : 'CPU', t('rival.random'), '?', '#e9d7a0') : plate('b', local ? t('pause.side.p2') : 'CPU', bName, elName(b.id), bCol));
    } catch (e) { console.warn('[versus]', e); }
  };
  const go = menu.go.bind(menu);
  menu.go = p => { if (p !== 'versus') clear(); return go(p); };
  const start = scene.startMatch.bind(scene); // al empezar el combate se retira la pantalla de selección
  scene.startMatch = (...a) => { clear(); return start(...a); };
  return { clear };
}
