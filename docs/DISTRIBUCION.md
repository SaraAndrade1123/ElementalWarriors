# Distribuir el juego por un enlace que se actualiza solo

## Cómo funciona
`npm run build` genera, además del `index.html` de siempre, la carpeta **`dist/web/`**: la versión web instalable.
- **Un solo enlace** para jugar en celular y PC. Se puede «instalar» como app desde el navegador (icono propio,
  pantalla completa, horizontal) y funciona sin conexión después de la primera visita.
- **Actualizaciones automáticas**: cada vez que se publica una versión nueva, quien tenga el juego abierto o instalado
  ve el aviso «Hay una versión nueva del juego · Actualizar» y con un toque pasa a la nueva. Nadie descarga zips.
- **Seguridad**: política de seguridad de contenido (CSP), sin herramientas de consola, guardado cifrado y firmado.

## Opción recomendada: GitHub Pages (gratis)
Ya está todo preparado en `.github/workflows/pages.yml`: en cada cambio subido a la rama `main`, GitHub ejecuta las
24 baterías de pruebas, compila el juego y lo publica. Si una prueba falla, no se publica nada roto.

Pasos (una sola vez):
1. En GitHub (cuenta `SaraAndrade1123`), crea un repositorio vacío llamado `elemental-warriors`
   (público, o privado si tienes GitHub Pro).
2. Sube el proyecto a ese repositorio (Claude puede hacerlo por ti en cuanto exista).
3. En el repositorio: **Settings › Pages › Build and deployment › Source: GitHub Actions**.
4. A los 2-3 minutos el juego queda en `https://saraandrade1123.github.io/ElementalWarriors/`.

Desde ahí, publicar una mejora = subir los cambios. El enlace no cambia nunca.
Si quieres un dominio propio (por ejemplo `elementalwarriors.com`), se configura en Settings › Pages › Custom domain.

## Otras opciones
- **itch.io** (tienda de juegos indie, permite donaciones o precio): sube un zip de `dist/web/` como «HTML game».
  Las actualizaciones se suben con su herramienta `butler` (se puede automatizar igual que GitHub Pages).
- **Netlify / Cloudflare Pages**: conectas el repositorio, comando `npm run build`, carpeta `dist/web`.
- **El enlace de Claude** (el artefacto actual): sirve para probar y enseñar, se actualiza cada vez que Claude publica,
  pero es privado hasta que lo compartes y depende de tu cuenta: no es para distribución pública.

## Antes de difundir en público
Lee `docs/LEGAL.md`: sobre todo, hay que sustituir los modelos provisionales por guerreros originales.
