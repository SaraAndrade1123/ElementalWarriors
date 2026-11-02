// Tienda + inventario. Todo es cosmético: nada aquí modifica estadísticas de combate.
export class Shop {
  constructor(items, save, onChange) {
    this.items = new Map(items.map(i => [i.id, i])); this.save = save; this.onChange = onChange;
  }
  list(charId) { return [...this.items.values()].filter(i => i.char === charId && !i.hidden); } // lo que se vende
  ownedOf(charId) { return [...this.items.values()].filter(i => i.char === charId && this.owns(i.id)); } // incluye objetos antiguos ya comprados
  owns(id) { return this.save.data.owned.includes(id); }
  equippedId(charId) { return this.save.data.equipped[charId] ?? null; }
  paletteOf(charId) {
    const it = this.items.get(this.equippedId(charId));
    return it && it.type === 'palette' && this.owns(it.id) ? it : null; // el objeto completo: slots, fx, swatch…
  }
  fxOf(charId) { return this.paletteOf(charId)?.fx ?? null; } // colores de aura/partículas de la paleta equipada
  buy(id) {
    const it = this.items.get(id); if (!it || it.hidden) return { ok: false, error: 'unknown' };
    const r = this.save.commit(d => { // validar y cobrar en una sola operación: sin cobros duplicados
      if (d.owned.includes(id)) return { ok: false, error: 'owned' };
      if (d.gold.balance < it.price) return { ok: false, error: 'funds', missing: it.price - d.gold.balance };
      d.gold.balance -= it.price; d.gold.spent += it.price; d.owned.push(id); d.stats.purchases++;
      return { ok: true };
    });
    if (r.ok) this.onChange?.('buy', id);
    return r;
  }
  equip(id) {
    const it = this.items.get(id); if (!it) return { ok: false, error: 'unknown' };
    return this.save.commit(d => (d.owned.includes(id) ? ((d.equipped[it.char] = id), { ok: true }) : { ok: false, error: 'locked' }));
  }
  unequip(charId) { return this.save.commit(d => { delete d.equipped[charId]; return { ok: true }; }); }
}
