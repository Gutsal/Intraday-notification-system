// Cooldown/suppression: a rule shouldn't re-fire on every event while a
// condition stays true (e.g. six consecutive breaching queue_snapshots),
// but should fire again once cooldownSec has elapsed. Keyed per
// rule+triggering-entity (a queue id or agent id), not just per rule, so
// e.g. rule 2 ("any of my agents on a long call") cooldowns independently
// per agent rather than one agent's notification silencing another's.
export class Dedup {
  private readonly lastFiredAt = new Map<string, number>();

  private key(ruleId: string, entityId: string): string {
    return `${ruleId}:${entityId}`;
  }

  shouldFire(ruleId: string, entityId: string, now: Date, cooldownSec: number): boolean {
    const last = this.lastFiredAt.get(this.key(ruleId, entityId));
    if (last === undefined) return true;
    return (now.getTime() - last) / 1000 >= cooldownSec;
  }

  recordFired(ruleId: string, entityId: string, now: Date): void {
    this.lastFiredAt.set(this.key(ruleId, entityId), now.getTime());
  }
}
