// Rose Gold: solo enteros positivos; toda operación pasa por SaveSystem.commit (atómica).
export class Wallet {
  constructor(save) { this.save = save; }
  get balance() { return this.save.data.gold.balance; }
  add(n) {
    if (!Number.isInteger(n) || n <= 0) return { ok: false, error: 'invalid' };
    return this.save.commit(d => { d.gold.balance += n; d.gold.earned += n; return { ok: true }; });
  }
  spend(n) {
    if (!Number.isInteger(n) || n <= 0) return { ok: false, error: 'invalid' };
    return this.save.commit(d => {
      if (d.gold.balance < n) return { ok: false, error: 'funds', missing: n - d.gold.balance };
      d.gold.balance -= n; d.gold.spent += n; return { ok: true };
    });
  }
}
