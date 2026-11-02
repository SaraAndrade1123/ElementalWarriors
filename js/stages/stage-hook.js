import { buildStage } from './stage-builder.js';

// Adaptador F6 ↔ SceneManager. NO edita scene-manager.js: envuelve startMatch/endMatch.
// Así sigue funcionando aunque F3 cambie el combate, mientras SceneManager conserve estos nombres
// (startMatch, endMatch, arena, scene, key, tint, q, reduce). Ver docs/INTEGRACION-F6.md.
export function installStages(scene, stages, { half = 8.2 } = {}) {
  if (scene.__stages) return; scene.__stages = stages;
  stages.build = (cfg, o) => buildStage(cfg, { half, particles: scene.q?.particles ?? 300, ...o });
  const start = scene.startMatch.bind(scene), end = scene.endMatch.bind(scene);

  scene.startMatch = function (a, b, input, opts = {}) {
    start(a, b, input, opts);
    try {
      const st = stages.create(opts.stage ?? stages.selected); if (!st) return;
      this.arena?.dispose(); this.arena = st; this.scene.add(st.group);
      const e = st.env;
      this.scene.background = st.sky; this.scene.fog.density = e.fogDensity; this.scene.fog.color.set(e.fogColor);
      this._stageSaved = { key: [this.key.color.getHex(), this.key.intensity] };
      this.key.color.set(e.key); this.key.intensity = e.keyIntensity; this.tint.light.set(e.rim);
    } catch (err) { console.error('[stages] No se pudo construir el escenario; se mantiene la arena por defecto.', err); }
  };
  scene.endMatch = function () {
    if (this._stageSaved) { this.key.color.setHex(this._stageSaved.key[0]); this.key.intensity = this._stageSaved.key[1]; this._stageSaved = null; }
    stages.current = null; end();
  };
}
