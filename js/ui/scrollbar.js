// UNA SOLA BARRA DE DESPLAZAMIENTO, BONITA Y POR FUERA (v1.11)
// Las barras nativas se ocultan en todo el juego (css/settings.css). Por cada zona que se desplaza y se ve en pantalla
// (paneles del menú, pausa, historia, resultados…) se dibuja una barra dorada FUERA de su borde derecho, así no le quita
// ancho al contenido. Si dos zonas están una dentro de otra, solo cuenta la de dentro (nunca dos barras para lo mismo).
// La barra se puede arrastrar y pulsar; con la rueda o el dedo se desplaza el contenido como siempre.
// Cuando el botón «Volver» (o el principio del panel) queda fuera de la vista aparece un botón ▲ para subir de golpe.
import { t } from '../systems/localization.js';

const SEL = ['#view.docked>.panel>.pbody', '#view', '#view .panel', '.pz', '.pz .guide', '#story .panel', '#result', '.rc-bon', '.settings-body', '.sp-body'];

export function installScrollbars(doc = document) {
  if (!doc?.body) return null;
  const root = doc.createElement('div'); root.id = 'ewbars'; root.setAttribute('aria-hidden', 'true'); doc.body.append(root);
  const bars = new Map(); // elemento → { bar, thumb, up }
  const make = el => {
    const bar = doc.createElement('div'); bar.className = 'ewbar'; const thumb = doc.createElement('i'); bar.append(thumb);
    const up = doc.createElement('button'); up.type = 'button'; up.className = 'ewup'; up.tabIndex = -1; up.title = t('ui.top'); up.setAttribute('aria-label', t('ui.top')); up.innerHTML = '<svg viewBox="0 0 16 16"><path d="M3 10.5 8 5.5l5 5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    up.onclick = () => el.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    root.append(bar, up);
    // arrastrar el pulgar / pulsar la pista
    let drag = null;
    thumb.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); drag = { y: e.clientY, s: el.scrollTop }; thumb.setPointerCapture(e.pointerId); bar.classList.add('drag'); });
    thumb.addEventListener('pointermove', e => { if (!drag) return; const k = (el.scrollHeight - el.clientHeight) / Math.max(1, bar.clientHeight - thumb.offsetHeight); el.scrollTop = drag.s + (e.clientY - drag.y) * k; });
    const end = () => { drag = null; bar.classList.remove('drag'); }; thumb.addEventListener('pointerup', end); thumb.addEventListener('pointercancel', end);
    bar.addEventListener('pointerdown', e => { if (e.target !== bar) return; const r = bar.getBoundingClientRect(); el.scrollBy({ top: (e.clientY < r.top + thumb.offsetTop ? -1 : 1) * el.clientHeight * .85, behavior: 'smooth' }); });
    return { bar, thumb, up };
  };
  const scrollable = el => el && el.isConnected && el.offsetParent !== null && el.scrollHeight > el.clientHeight + 2 && getComputedStyle(el).overflowY !== 'visible' && getComputedStyle(el).overflowY !== 'hidden';
  let raf = 0;
  const frame = () => {
    raf = requestAnimationFrame(frame);
    const found = new Set(); for (const s of SEL) for (const el of doc.querySelectorAll(s)) if (scrollable(el)) found.add(el);
    for (const el of [...found]) for (const o of found) if (o !== el && el.contains(o)) { found.delete(el); break; } // solo la más interior
    for (const [el, b] of bars) if (!found.has(el)) { b.bar.remove(); b.up.remove(); bars.delete(el); }
    const vw = innerWidth;
    for (const el of found) {
      const b = bars.get(el) || (bars.set(el, make(el)), bars.get(el)), r = el.getBoundingClientRect();
      const panel = el.closest('.panel') || el, pr = panel.getBoundingClientRect(), outside = pr.right + 11 <= vw;
      const x = outside ? Math.min(pr.right + 6, vw - 8) : r.right - 10, top = r.top + 4, h = Math.max(24, r.height - 8);
      b.bar.style.cssText = `left:${x}px;top:${top}px;height:${h}px`;
      const k = el.clientHeight / el.scrollHeight, th = Math.max(28, h * k), max = el.scrollHeight - el.clientHeight;
      b.thumb.style.cssText = `height:${th}px;transform:translateY(${max > 0 ? (el.scrollTop / max) * (h - th) : 0}px)`;
      // ▲ cuando «Volver» (o el principio) ya no se ve
      const back = el.querySelector(':scope > .back, :scope .back'), br = back?.getBoundingClientRect(), gone = back ? br.bottom < r.top + 4 : el.scrollTop > 80;
      b.up.classList.toggle('on', gone); b.up.style.cssText = `left:${Math.min(x + 3 - 13, vw - 30)}px;top:${Math.max(4, top - 2)}px`; b.bar.classList.toggle('below', gone);
    }
  };
  raf = requestAnimationFrame(frame);
  return { stop: () => cancelAnimationFrame(raf), bars };
}
