// Actualiza F8 → F8.1 (paletas por color). Ejecutar desde la raíz del proyecto: node tools/apply-f8-1.mjs
import fs from 'node:fs';
const rd = p => fs.readFileSync(p, 'utf8'), wr = (p, s) => fs.writeFileSync(p, s);
const out = [], say = (ok, m) => out.push((ok ? '  OK  ' : ' AVISO ') + m);

for (const l of ['es', 'en']) { // textos: solo añade los que faltan
  const p = `data/localization/${l}.json`, cur = JSON.parse(rd(p)), add = JSON.parse(rd(`patch/locales-f8-1/${l}.json`)); let n = 0;
  for (const [k, v] of Object.entries(add)) if (!(k in cur)) { cur[k] = v; n++; }
  wr(p, JSON.stringify(cur, null, 1) + '\n'); say(true, `${p}: ${n} claves añadidas`);
}

const NEW_METHOD = `  // Paleta alternativa (objeto de data/items.json) o null = original. Recolorea colores concretos de la textura:
  // la piel y el cabello no cambian; en la cabeza solo se tocan ojos y la flecha. También cambia el color del aura/partículas.
  setPalette(id, pal) {
    const c = this.chars.get(id); if (!c) return;
    c.holder.traverse(o => {
      if (!o.isMesh) return;
      for (const m of [].concat(o.material)) {
        if (!m.map) continue;
        const og = (m.userData.orig ??= m.map), cache = (m.userData.cache ??= {});
        const isHead = /head|face|eye/i.test(m.name || ''), use = pal && (!isHead || pal.slots);
        if (use && !cache[pal.id]) {
          const cv = recolorImage(og.image, pal, id, isHead ? ['eyes', 'arrow'] : null);
          if (cv) { const tx = new THREE.CanvasTexture(cv); Object.assign(tx, { flipY: og.flipY, colorSpace: og.colorSpace, wrapS: og.wrapS, wrapT: og.wrapT, anisotropy: og.anisotropy }); cache[pal.id] = tx; }
        }
        m.map = (use && cache[pal.id]) || og; m.needsUpdate = true;
      }
    });
    c.fx = pal?.fx ? { ...c.def.fx, ...pal.fx } : null;
    if (this.active === c) this._tintFx(c);
  }

  _tintFx(c) { const f = c.fx ?? c.def.fx; this.fx = f; this.tint.light.set(f.light); this.tint.color.set(f.color); this.pts.material.size = f.size; }

`;

{
  const file = 'js/game/scene-manager.js';
  if (!fs.existsSync(file)) say(false, `${file} no existe`);
  else {
    let s = rd(file);
    if (s.includes('_tintFx')) say(true, `${file}: ya estaba actualizado`);
    else if (!s.includes('setPalette(id, pal)')) say(false, `${file}: falta setPalette. Ejecuta primero: node tools/apply-f8.mjs`);
    else {
      const a = s.indexOf('  // Paleta alternativa'), b = s.indexOf('  show(id) {');
      const showRe = /this\.fx = c\.def\.fx;\s*this\.tint\.light\.set\(c\.def\.fx\.light\); this\.tint\.color\.set\(c\.def\.fx\.color\); this\.pts\.material\.size = c\.def\.fx\.size;/;
      if (a < 0 || b < a || !showRe.test(s)) say(false, `${file}: no encontré el bloque setPalette/show. Hazlo a mano (docs/INSTALAR-F8-1.md, paso «Edición manual»)`);
      else {
        s = s.slice(0, a) + NEW_METHOD + s.slice(b);
        s = s.replace(showRe, 'this._tintFx(c);');
        // el combate usa los colores de la paleta equipada del jugador 1 (si existen)
        s = s.replace('buildArena(a.def.fx.color)', 'buildArena((a.fx ?? a.def.fx).color)')
             .replace('this.tint.light.set(a.def.fx.light); this.tint.color.set(a.def.fx.color);', 'this.tint.light.set((a.fx ?? a.def.fx).light); this.tint.color.set((a.fx ?? a.def.fx).color);');
        wr(file, s); say(true, `${file}: setPalette actualizado y colores de aura/partículas enlazados`);
      }
    }
  }
}
if (fs.existsSync('docs/CHECKLIST.md')) {
  let s = rd('docs/CHECKLIST.md');
  if (!s.includes('F8.1')) { wr('docs/CHECKLIST.md', s + '\n- F8.1: paletas por color concreto (js/systems/palette-models.js mide las texturas de cada modelo; si cambias un modelo, vuelve a medir sus colores). 3 paletas por guerrero; las 8 antiguas siguen disponibles solo si ya las habías comprado. Cada paleta también cambia el color del aura y las partículas.\n'); say(true, 'docs/CHECKLIST.md: nota añadida'); }
}
console.log('\nF8.1 — resultado:\n' + out.join('\n') + '\n\nSiguiente: npm run check && npm test');
