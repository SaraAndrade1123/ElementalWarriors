let dict = {}, base = {}, current = 'es';
export const getLang = () => current;
export const t = (k, v = {}) => (dict[k] ?? base[k] ?? k).replace(/\{(\w+)\}/g, (_, n) => v[n] ?? '');

const load = async lang => {
  const r = await fetch(`data/localization/${lang}.json`);
  if (!r.ok) throw new Error(`No se pudo cargar el idioma / Could not load language "${lang}" (${r.status})`);
  return r.json();
};

// Carga el idioma pedido (español es el idioma base de respaldo) y actualiza los textos estáticos del HTML.
export async function loadLocale(lang = 'es') {
  const [b, d] = await Promise.all([load('es'), lang === 'es' ? null : load(lang)]);
  base = b; dict = d || b; current = lang;
  document.documentElement.lang = lang;
  document.querySelectorAll('[data-i18n]').forEach(e => { e.textContent = t(e.dataset.i18n); });
  document.querySelectorAll('[data-i18n-aria]').forEach(e => { e.setAttribute('aria-label', t(e.dataset.i18nAria)); });
}
