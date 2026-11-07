// Botón principal SIEMPRE visible y sin tapar nada: en los paneles del menú con botón de acción («¡Combatir!»,
// «Comenzar historia»…), el contenido se desplaza dentro de su propio cuerpo y el botón queda en un pie fijo debajo.
// Se aplica después de que todas las extensiones hayan terminado de pintar la pantalla (microtarea) y conserva el
// desplazamiento y el foco al volver a pintar la misma pantalla (p. ej. al tocar una pestaña).
export function installPanelDock(menu) {
  const panel = menu.panel.bind(menu), view = menu.el.view; let lastPage = null, lastTop = 0;
  const dock = () => {
    const sec = view.querySelector(':scope > section.panel'); view.classList.remove('docked'); if (!sec || sec.querySelector(':scope > .pbody')) return;
    const acts = [...sec.children].filter(c => c.matches('.cta') || (c.matches('.row') && c.querySelector(':scope > .cta')));
    if (!acts.length) return;
    const focus = document.activeElement, body = document.createElement('div'), foot = document.createElement('div');
    body.className = 'pbody'; foot.className = 'pdock';
    for (const c of [...sec.children]) (acts.includes(c) ? foot : body).append(c);
    sec.append(body, foot); view.classList.add('docked');
    if (lastPage === menu.page) body.scrollTop = lastTop;
    if (focus && sec.contains(focus)) focus.focus({ preventScroll: true });
    requestAnimationFrame(() => { body.style.minHeight = '0.5px'; void body.offsetHeight; body.style.minHeight = ''; }); // recalcula la cuadrícula (filas con tarjetas)
  };
  menu.panel = function (...a) {
    const b = view.querySelector('.pbody'); lastTop = b ? b.scrollTop : 0; lastPage = view.dataset.page || null;
    const r = panel(...a); view.dataset.page = menu.page; queueMicrotask(dock); return r;
  };
  const go = menu.go.bind(menu); menu.go = p => { view.classList.remove('docked'); return go(p); };
  return { dock };
}
