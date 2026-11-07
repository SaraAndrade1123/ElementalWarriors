// Genera index.html: el juego COMPLETO en un solo archivo (código, estilos, datos, tipografías y modelos 3D dentro).
// Se abre con doble clic (file://), sin servidor, y es la misma página que se publica en línea.
//   npm run build        (fuente: tools/dev/index.html + js/; solo para desarrollar)
import { build } from 'esbuild';
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, extname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = p => readFileSync(join(ROOT, p));
const walk = d => readdirSync(join(ROOT, d)).flatMap(f => { const p = join(d, f); return statSync(join(ROOT, p)).isDirectory() ? walk(p) : [p]; });

// 1 · código: un único script clásico (sin módulos: los navegadores bloquean módulos desde file://)
const res = await build({
  entryPoints: [join(ROOT, 'js/main.js')], bundle: true, format: 'iife', minify: true, write: false, target: 'es2020', legalComments: 'none', define: { 'globalThis.__EW_BUILD__': 'true' }, drop: ['debugger'], // (v1.11) sin herramientas de depuración en la versión publicada
  alias: { three: join(ROOT, 'js/vendor/three/build/three.module.js') },
  plugins: [{ name: 'addons', setup(b) { b.onResolve({ filter: /^three\/addons\// }, a => ({ path: join(ROOT, 'js/vendor/three/examples/jsm', a.path.slice('three/addons/'.length)) })); } }],
});
const js = res.outputFiles[0].text;

// 2 · datos y modelos: se sirven a fetch() desde memoria
const assets = {};
for (const f of walk('data').filter(f => f.endsWith('.json'))) assets[f.replaceAll('\\', '/')] = { t: 'json', v: JSON.parse(rd(f)) };
for (const f of walk('assets/characters').filter(f => /\.(glb|gltf|png|jpg)$/i.test(f))) assets[f.replaceAll('\\', '/')] = { t: 'b64', m: extname(f) === '.glb' ? 'model/gltf-binary' : 'application/octet-stream', v: rd(f).toString('base64') };

// 3 · estilos: todas las hojas en el orden en que el juego las carga (tipografías incrustadas)
const SHEETS = ['css/fonts.css', 'css/main.css', 'css/theme.css', 'css/modes.css', 'css/meta.css', 'css/stages.css', 'css/elements.css', 'css/audio.css', 'css/cinema.css', 'css/result.css', 'css/settings.css', 'css/mobile.css'];
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

let html = rd('tools/dev/index.html').toString();
html = html.replace(/<base [^>]*>(<!--[^>]*-->)?\s*/, '').replace(/<link rel="stylesheet" href="css\/[^"]+">\s*/g, '').replace(/<script type="importmap">[\s\S]*?<\/script>\s*/, '').replace(/<script type="module" src="js\/main.js"><\/script>/, '');
const esc = s => s.replace(/<\/script/gi, '<\\/script');
html = html.replace('</head>', () => `<style>\n${css}\n</style>\n</head>`); // (función: el código puede contener $& / $')
html = html.replace('</body>', () => `<script>window.__EW_ASSETS=${esc(JSON.stringify(assets))};</script>\n<script>${esc(shim)}</script>\n<script>${esc(js)}</script>\n</body>`);
html = html.replace('<!doctype html>', '<!doctype html>\n<!-- Archivo GENERADO por tools/build-standalone.mjs a partir de tools/dev/index.html: no editar a mano. -->');
writeFileSync(join(ROOT, 'index.html'), html);
console.log(`index.html listo: ${(html.length / 1048576).toFixed(1)} MB (código ${(js.length / 1024).toFixed(0)} KB, ${Object.keys(assets).length} recursos)`);

// 5 · versión para publicar en línea (página alojada): mismo contenido sin <html>/<head>/<body> (el alojamiento los pone)
import { mkdirSync } from 'node:fs';
{
  const head = html.slice(html.indexOf('<head>') + 6, html.indexOf('</head>')).replace(/<meta charset[^>]*>\s*/i, '').replace(/<meta name="viewport"[^>]*>\s*/i, '');
  const body = html.slice(html.indexOf('>', html.indexOf('<body')) + 1, html.lastIndexOf('</body>'));
  const boot = `<script>document.documentElement.lang='es';if(document.body)document.body.dataset.reduce='0';</script>`;
  const css = `<style>html,body{height:100%;margin:0;padding:0!important;background:#05070f;color:#e8ecf5;overflow:hidden}</style>`;
  mkdirSync(join(ROOT, 'dist'), { recursive: true });
  writeFileSync(join(ROOT, 'dist/elemental-warriors-online.html'), head.replace(/<title>[^<]*<\/title>/, '<title>Elemental Warriors</title>') + css + '\n' + boot + body);
  console.log('dist/elemental-warriors-online.html listo (para publicar en línea)');
}

// 6 · (v1.11) VERSIÓN WEB INSTALABLE para distribuir por un enlace (GitHub Pages, itch.io, Netlify…): dist/web/
//   · index.html con manifiesto (se puede «instalar» como app en el celular y en PC), iconos y política de seguridad (CSP)
//   · sw.js: guarda el juego para jugar sin conexión y, cuando se publica una versión nueva, avisa «Hay una versión nueva»
//     y se actualiza con un toque (sin descargar zips). version.json siempre se pide a la red.
import { createHash } from 'node:crypto';
import { copyFileSync } from 'node:fs';
{
  const pkg = JSON.parse(rd('package.json')), build = createHash('sha256').update(html).digest('hex').slice(0, 10), V = `${pkg.version}-${build}`;
  const W = join(ROOT, 'dist/web'); mkdirSync(join(W, 'icons'), { recursive: true });
  for (const f of ['icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png']) copyFileSync(join(ROOT, 'assets/icons', f), join(W, 'icons', f));
  const csp = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; media-src 'self' data: blob:; connect-src 'self' data: blob:; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'";
  const headAdd = `<meta http-equiv="Content-Security-Policy" content="${csp}">\n<meta name="referrer" content="no-referrer">\n<link rel="manifest" href="manifest.webmanifest">\n<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">\n<meta name="ew-version" content="${V}">\n`;
  const upd = `<script>/* actualización automática (versión web) */(function(){var want=false;if(!('serviceWorker' in navigator)||location.protocol==='file:')return;
function toast(reg){var es=(document.documentElement.lang||navigator.language||'es').slice(0,2)==='es';if(document.getElementById('ewupd'))return;var d=document.createElement('div');d.id='ewupd';d.setAttribute('role','status');
d.style.cssText='position:fixed;left:50%;bottom:max(16px,env(safe-area-inset-bottom));transform:translateX(-50%);z-index:9999;display:flex;gap:12px;align-items:center;padding:10px 14px;border:1px solid #e2bd5e;border-radius:4px;background:rgba(8,12,28,.95);color:#f1e6c4;font:600 14px system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.6)';
d.innerHTML='<span>'+(es?'Hay una versión nueva del juego':'A new version is available')+'</span>';var b=document.createElement('button');b.textContent=es?'Actualizar':'Update';
b.style.cssText='padding:6px 12px;border:0;border-radius:3px;background:linear-gradient(#fff3c8,#c9a44c);color:#1a1206;font:800 13px system-ui,sans-serif;cursor:pointer';
b.onclick=function(){want=true;if(reg.waiting)reg.waiting.postMessage('skip');else location.reload();};d.appendChild(b);document.body.appendChild(d);}
var reloading=false;navigator.serviceWorker.addEventListener('controllerchange',function(){if(reloading||!want)return;reloading=true;location.reload();}); /* solo recarga si el jugador pidió actualizar (la primera instalación no interrumpe) */
function go(){navigator.serviceWorker.register('sw.js').then(function(reg){if(reg.waiting&&navigator.serviceWorker.controller)toast(reg);
reg.addEventListener('updatefound',function(){var w=reg.installing;w&&w.addEventListener('statechange',function(){if(w.state==='installed'&&navigator.serviceWorker.controller)toast(reg);});});
setInterval(function(){reg.update().catch(function(){});},30*60*1000);document.addEventListener('visibilitychange',function(){if(!document.hidden)reg.update().catch(function(){});});}).catch(function(){});}
/* se registra cuando el juego ya cargó: así la primera descarga no compite con la copia para jugar sin conexión */
if(navigator.serviceWorker.controller)go();else window.addEventListener('load',function(){setTimeout(go,6000);});})();</script>\n`;
  let web = html.replace('<head>', '<head>\n' + headAdd).replace('</body>', () => upd + '</body>');
  writeFileSync(join(W, 'index.html'), web);
  writeFileSync(join(W, 'manifest.webmanifest'), JSON.stringify({ name: 'Elemental Warriors', short_name: 'Elemental', description: 'Juego de lucha anime 2.5D de los cuatro elementos.', lang: 'es', start_url: './', scope: './', display: 'fullscreen', orientation: 'landscape', background_color: '#05070f', theme_color: '#0b1226',
    icons: [{ src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' }, { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' }, { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }] }, null, 1));
  writeFileSync(join(W, 'version.json'), JSON.stringify({ version: pkg.version, build: V }));
  writeFileSync(join(W, '.nojekyll'), '');
  writeFileSync(join(W, 'sw.js'), `// Generado por tools/build-standalone.mjs · ${V}
const V = 'ew-${V}', FILES = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png', './icons/apple-touch-icon.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => c.addAll(FILES))); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('message', e => { if (e.data === 'skip') self.skipWaiting(); });
self.addEventListener('fetch', e => {
  const r = e.request; if (r.method !== 'GET') return; const u = new URL(r.url); if (u.origin !== location.origin || u.pathname.endsWith('version.json')) return;
  e.respondWith(caches.match(r, { ignoreSearch: true }).then(hit => hit || fetch(r).then(res => { if (res.ok && res.type === 'basic') { const cp = res.clone(); caches.open(V).then(c => c.put(r, cp)); } return res; }).catch(() => caches.match('./index.html'))));
});
`);
  console.log(`dist/web/ listo (versión web instalable ${V}: index.html, sw.js, manifest, iconos)`);
}
