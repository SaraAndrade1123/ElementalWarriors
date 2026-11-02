// Captura tiras de fotogramas de secuencias REALES de combate (con proyectiles y efectos) del laboratorio de control elemental.
// Requiere Playwright, Python con Pillow y el juego servido en :5173.
// node tools/capturar-tecnicas.cjs out.png '{"p1":"ignis","p2":"terra","cam":"game","rows":[{"seq":"eb","times":[.3,.45,.6,.8]}]}'
const { chromium } = require('playwright'); const { execFileSync } = require('child_process'); const path = require('path'), os = require('os');
(async () => {
  const [out, specS] = process.argv.slice(2); const spec = Function('return (' + specS + ')')(); // admite .3 en vez de 0.3
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const pg = await b.newPage({ viewport: { width: spec.w || 640, height: spec.h || 400 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text()); });
  await pg.goto('http://localhost:5173/tools/bending-lab.html?manual', { waitUntil: 'load' });
  await pg.waitForFunction(() => window.lab && window.lab.ready, null, { timeout: 120000 });
  await pg.evaluate(s => { document.querySelector('#ui').style.display = 'none'; lab.start(s.p1, s.p2 || (s.p1 === 'aqua' ? 'ignis' : 'aqua')); lab.cam = s.cam || 'game'; lab.dist = s.dist || 8; lab.lookX = s.lookX || 0; }, spec);
  const files = []; let k = 0;
  for (const row of spec.rows) {
    await pg.evaluate(r => { lab.seq(r.seq); lab.place(r.x1 ?? -2.5, r.x2 ?? 2.5); if (r.p2) for (const [t, key] of r.p2) lab.timeline.push({ t, fn: () => { lab.p2[key] = true; } }); lab.timeline.sort((a, b) => a.t - b.t); }, row);
    let t = 0;
    for (const tt of row.times) {
      await pg.evaluate(([from, to]) => { const n = Math.max(1, Math.round((to - from) * 60)); for (let i = 0; i < n; i++) { lab.draw = i === n - 1; lab.step(); } lab.draw = true; }, [t, tt]);
      t = tt; const f = path.join(os.tmpdir(), `ew_bt_${process.pid}_${k++}.png`); await pg.screenshot({ path: f }); files.push(f);
    }
  }
  if (errs.length) console.log('ERR', [...new Set(errs)].slice(0, 8).join('\n'));
  await b.close();
  const cols = Math.max(...spec.rows.map(r => r.times.length));
  execFileSync('python3', ['-c', `
import sys
from PIL import Image
fs=sys.argv[2:]; cols=int(sys.argv[1]); ims=[Image.open(f) for f in fs]; w,h=ims[0].size
rows=${JSON.stringify(spec.rows.map(r => r.times.length))}
M=Image.new('RGB',(w*cols,h*len(rows))); i=0
for r,n in enumerate(rows):
  for c in range(n): M.paste(ims[i],(c*w,r*h)); i+=1
M.save(sys.argv[3] if False else '${out}')`, String(cols), ...files]);
})();
