// Captura tiras de fotogramas de cualquier clip (para revisar animaciones). Requiere: npm i -D playwright, Python con Pillow y el juego servido en :5173.
// node tools/capturar-poses.cjs out.png '{"p1":"ignis","p2":"aqua","cam":"side","dist":7,"rows":[{"clip":"l","times":[0,.07,.13,.2]}]}'
const { chromium } = require('playwright'); const { execFileSync } = require('child_process');
(async () => {
  const [out, specS] = process.argv.slice(2); const spec = JSON.parse(specS);
  const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
  const pg = await b.newPage({ viewport: { width: spec.w || 420, height: spec.h || 420 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => { if (m.type()==='error' || m.type()==='warning') errs.push(m.text()); });
  await pg.goto('http://localhost:5173/tools/anim-lab.html?manual', { waitUntil: 'load' });
  await pg.waitForFunction(() => window.lab && window.lab.ready, null, { timeout: 120000 });
  await pg.evaluate(s => { document.querySelector('#ui').style.display='none'; lab.start(s.p1, s.p2 || (s.p1==='aqua'?'ignis':'aqua')); lab.cam = s.cam || 'side'; lab.dist = s.dist || 7; lab.lookX = s.lookX || 0; sm_ = lab.sm; lab.place(s.x1 ?? -1, s.x2 ?? 6); }, spec);
  const files = []; let k = 0;
  for (const row of spec.rows) {
    await pg.evaluate(r => { lab.reset(); lab.place(r.x1 ?? -1, r.x2 ?? 6); window.__pv = r.clip ? { name: r.clip, t: 0 } : null; lab.sm.match.v[0].preview = window.__pv; if (r.seq) lab.seq(r.seq); }, row);
    let t = 0;
    for (const tt of row.times) {
      await pg.evaluate(([from, to]) => { const n = Math.max(1, Math.round((to - from) * 60)); for (let i = 0; i < n; i++) { if (window.__pv) window.__pv.t = from + (to - from) * (i + 1) / n; lab.draw = i === n - 1; lab.step(); } lab.draw = true; }, [t, tt]);
      t = tt; const f = require('path').join(require('os').tmpdir(), `ew_pv_${process.pid}_${k++}.png`); await pg.screenshot({ path: f }); files.push(f);
    }
  }
  if (errs.length) console.log('ERR', [...new Set(errs)].slice(0, 8).join('\n'));
  await b.close();
  const cols = Math.max(...spec.rows.map(r => r.times.length));
  execFileSync('python3', ['-c', `
import sys
from PIL import Image, ImageDraw
fs=sys.argv[2:]; cols=int(sys.argv[1]); ims=[Image.open(f) for f in fs]; w,h=ims[0].size
rows=${JSON.stringify(spec.rows.map(r=>r.times.length))}
M=Image.new('RGB',(w*cols,h*len(rows))); i=0
for r,n in enumerate(rows):
  for c in range(n): M.paste(ims[i],(c*w,r*h)); i+=1
M.save('${out}')`, String(cols), ...files]);
})();
