// Genera index.html: el juego COMPLETO en un solo archivo (código, estilos, datos, tipografías y modelos 3D dentro).
// Se abre con doble clic (file://), sin servidor, y es la misma página que se publica en línea.
//   npm run build        (fuente para desarrollar: index-dev.html + js/ con un servidor local)
import { build } from 'esbuild';
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, extname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = p => readFileSync(join(ROOT, p));
const walk = d => readdirSync(join(ROOT, d)).flatMap(f => { const p = join(d, f); return statSync(join(ROOT, p)).isDirectory() ? walk(p) : [p]; });

// 1 · código: un único script clásico (sin módulos: los navegadores bloquean módulos desde file://)
const res = await build({
  entryPoints: [join(ROOT, 'js/main.js')], bundle: true, format: 'iife', minify: true, write: false, target: 'es2020', legalComments: 'none',
  alias: { three: join(ROOT, 'js/vendor/three/build/three.module.js') },
  plugins: [{ name: 'addons', setup(b) { b.onResolve({ filter: /^three\/addons\// }, a => ({ path: join(ROOT, 'js/vendor/three/examples/jsm', a.path.slice('three/addons/'.length)) })); } }],
});
const js = res.outputFiles[0].text;

// 2 · datos y modelos: se sirven a fetch() desde memoria
const assets = {};
for (const f of walk('data').filter(f => f.endsWith('.json'))) assets[f.replaceAll('\\', '/')] = { t: 'json', v: JSON.parse(rd(f)) };
for (const f of walk('assets/characters').filter(f => /\.(glb|gltf|png|jpg)$/i.test(f))) assets[f.replaceAll('\\', '/')] = { t: 'b64', m: extname(f) === '.glb' ? 'model/gltf-binary' : 'application/octet-stream', v: rd(f).toString('base64') };

// 3 · estilos: todas las hojas en el orden en que el juego las carga (tipografías incrustadas)
const SHEETS = ['css/fonts.css', 'css/main.css', 'css/theme.css', 'css/modes.css', 'css/meta.css', 'css/stages.css', 'css/elements.css', 'css/audio.css', 'css/cinema.css', 'css/result.css', 'css/mobile.css'];
const css = SHEETS.map(f => {
  let s = rd(f).toString();
  s = s.replace(/url\((\.\.\/assets\/fonts\/[^)]+\.woff2)\)/g, (_, u) => `url(data:font/woff2;base64,${rd(join('css', u)).toString('base64')})`);
  return `/* ${f} */\n${s}`;
}).join('\n');

// 4 · arranque: marca de versión autónoma, fetch desde memoria y sin <link> de hojas ya incrustadas
const shim = `window.__EW_STANDALONE=true;(function(){var A=window.__EW_ASSETS,F=window.fetch&&window.fetch.bind(window);
function key(u){u=String(u&&u.url||u);try{u=decodeURIComponent(new URL(u,location.href).pathname)}catch(e){}u=u.replace(/^\\.?\\//,'');for(var k in A){if(u===k||u.slice(-k.length-1)==='/'+k)return k}return null}
window.fetch=function(u,o){var k=key(u);if(!k)return F?F(u,o):Promise.reject(new Error('sin red: '+u));var a=A[k];
if(a.t==='json')return Promise.resolve(new Response(JSON.stringify(a.v),{status:200,headers:{'Content-Type':'application/json'}}));
if(!a.bin){var s=atob(a.v),n=s.length,b=new Uint8Array(n);for(var i=0;i<n;i++)b[i]=s.charCodeAt(i);a.bin=b}
return Promise.resolve(new Response(new Blob([a.bin],{type:a.m}),{status:200,headers:{'Content-Type':a.m}}))};
var S=${JSON.stringify(SHEETS)};function skip(n){return n&&n.tagName==='LINK'&&n.rel==='stylesheet'&&S.some(function(f){return (n.getAttribute('href')||'').slice(-f.length)===f})}
var ap=Element.prototype.append,ac=Node.prototype.appendChild;Element.prototype.append=function(){var a=[].filter.call(arguments,function(n){return !skip(n)});return ap.apply(this,a)};
Node.prototype.appendChild=function(n){return skip(n)?n:ac.call(this,n)}})();`;

let html = rd('index-dev.html').toString();
html = html.replace(/<link rel="stylesheet" href="css\/[^"]+">\s*/g, '').replace(/<script type="importmap">[\s\S]*?<\/script>\s*/, '').replace(/<script type="module" src="js\/main.js"><\/script>/, '');
const esc = s => s.replace(/<\/script/gi, '<\\/script');
html = html.replace('</head>', () => `<style>\n${css}\n</style>\n</head>`); // (función: el código puede contener $& / $')
html = html.replace('</body>', () => `<script>window.__EW_ASSETS=${esc(JSON.stringify(assets))};</script>\n<script>${esc(shim)}</script>\n<script>${esc(js)}</script>\n</body>`);
html = html.replace('<!doctype html>', '<!doctype html>\n<!-- Archivo GENERADO por tools/build-standalone.mjs a partir de index-dev.html: no editar a mano. -->');
writeFileSync(join(ROOT, 'index.html'), html);
console.log(`index.html listo: ${(html.length / 1048576).toFixed(1)} MB (código ${(js.length / 1024).toFixed(0)} KB, ${Object.keys(assets).length} recursos)`);

// 5 · versión para publicar en línea (página alojada): mismo contenido sin <html>/<head>/<body> (el alojamiento los pone)
import { mkdirSync } from 'node:fs';
{
  const head = html.slice(html.indexOf('<head>') + 6, html.indexOf('</head>')).replace(/<meta charset[^>]*>\s*/i, '').replace(/<meta name="viewport"[^>]*>\s*/i, '');
  const body = html.slice(html.indexOf('>', html.indexOf('<body')) + 1, html.lastIndexOf('</body>'));
  const boot = `<script>document.documentElement.lang='es';document.body.dataset.reduce='0';</script>`;
  const css = `<style>html,body{height:100%;margin:0;padding:0!important;background:#05070f;color:#e8ecf5;overflow:hidden}</style>`;
  mkdirSync(join(ROOT, 'dist'), { recursive: true });
  writeFileSync(join(ROOT, 'dist/elemental-warriors-online.html'), head.replace(/<title>[^<]*<\/title>/, '<title>Elemental Warriors</title>') + css + '\n' + boot + body);
  console.log('dist/elemental-warriors-online.html listo (para publicar en línea)');
}
