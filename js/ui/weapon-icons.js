// Iconos vectoriales de las armas de la tienda (originales). Línea dorada sobre fondo oscuro; sin emojis.
const P = {
  knives: '<path d="M5 19 L13 5 L14.5 6 L7 19Z"/><path d="M9 20 L15 6 L16.5 7 L11 20Z" opacity=".75"/><path d="M13 20 L17 8 L18.5 9 L15 20Z" opacity=".5"/>',
  bola: '<circle cx="6" cy="17" r="3"/><circle cx="18" cy="16" r="3"/><path d="M12 4 L6.5 14 M12 4 L17.5 13" fill="none" stroke-width="1.4"/><circle cx="12" cy="4" r="1.4"/>',
  boomerang: '<path d="M4 18 L11 5 Q12 3.8 13 5 L20 18 L17.5 19 L12 9 L6.5 19Z"/>',
  dagger: '<path d="M12 2 Q15 7 13.4 13 L10.6 13 Q9.4 7 12 2Z"/><rect x="8" y="13" width="8" height="1.8" rx=".9"/><rect x="11" y="14.8" width="2" height="5"/><circle cx="12" cy="21" r="1.3"/>',
  fan: '<path d="M12 20 L3.5 9 A11 11 0 0 1 20.5 9Z"/><path d="M12 20 L7 6 M12 20 L12 4.5 M12 20 L17 6" stroke="#0c1428" stroke-width=".9" fill="none"/>',
  hooks: '<path d="M8 21 L8 7 Q8 3 11.5 3 Q13.5 3.3 13 5.5 L11.6 5.2 Q11.6 4.5 10.6 4.6 Q9.6 4.8 9.6 7 L9.6 21Z"/><path d="M16 21 L16 9 Q16 5 19.5 5 Q21.5 5.3 21 7.5 L19.6 7.2 Q19.6 6.5 18.6 6.6 Q17.6 6.8 17.6 9 L17.6 21Z" opacity=".7"/>',
  mace: '<rect x="11" y="10" width="2" height="12" rx="1"/><path d="M12 2 L17 5.5 L17 10.5 L12 13 L7 10.5 L7 5.5Z"/><path d="M12 0.8 L12 2.5 M18.5 8 L17 8 M5.5 8 L7 8" stroke-width="1.4"/>',
  bow: '<path d="M7 2 Q19 12 7 22" fill="none" stroke-width="2.2"/><path d="M7 2 L7 22" fill="none" stroke-width=".8"/><path d="M5 12 L21 12 M18 10 L21 12 L18 14" fill="none" stroke-width="1.3"/>',
};
export const weaponIcon = (kind, cls = 'wicon') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor" stroke="currentColor" stroke-width="0" stroke-linejoin="round">${P[kind] || P.dagger}</svg>`;
