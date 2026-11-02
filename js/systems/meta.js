import { SaveSystem } from './save-system.js';
import { Wallet } from './currency-system.js';
import { Shop } from './shop-system.js';
import { Progression } from './progression-system.js';

export function createMeta({ items, achievements, economy, storage }) {
  const save = new SaveSystem(storage), wallet = new Wallet(save);
  const progression = new Progression(save, { economy, achievements });
  const shop = new Shop(items, save, () => progression.evaluate());
  return { save, wallet, shop, progression, items, achievements };
}
