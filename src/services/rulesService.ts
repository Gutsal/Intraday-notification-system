import { randomUUID } from 'node:crypto';
import type { Rule, RuleInput } from '../domain/rule.ts';

// DEMO: in-memory rules store — no persistence, per the take-home's stated
// scope (see README "What I'd build next"); everything resets on restart.
// A production version would swap the Maps below for a real database
// behind this same method signature. Route handlers never touch this
// directly; they parse/validate then call these methods, per api-design
// SKILL.md's service-layer convention.
export class RulesService {
  private readonly rulesById = new Map<string, Rule>();
  // Secondary index: list(ownerId) is on the hot path (every GET /rules
  // call) and shouldn't scan every rule in the system to find one owner's
  // slice of it — this makes that lookup O(owner's rule count), not
  // O(total rules across every customer).
  private readonly ruleIdsByOwner = new Map<string, Set<string>>();

  constructor(seed: Rule[] = []) {
    for (const rule of seed) this.index(rule);
  }

  private index(rule: Rule): void {
    this.rulesById.set(rule.id, rule);
    let owned = this.ruleIdsByOwner.get(rule.ownerId);
    if (!owned) {
      owned = new Set();
      this.ruleIdsByOwner.set(rule.ownerId, owned);
    }
    owned.add(rule.id);
  }

  private unindexOwner(id: string, ownerId: string): void {
    this.ruleIdsByOwner.get(ownerId)?.delete(id);
  }

  // No default/global fallback here on purpose — every call site must
  // supply ownerId explicitly (enforced by the route's Zod schema), so a
  // query can never silently span identities.
  list(ownerId: string): Rule[] {
    const ids = this.ruleIdsByOwner.get(ownerId);
    if (!ids) return [];
    return Array.from(ids, (id) => this.rulesById.get(id)!);
  }

  get(id: string): Rule | undefined {
    return this.rulesById.get(id);
  }

  // Returns every rule regardless of owner — used only by the replay
  // trigger, which needs to evaluate the full rule set, not one identity's
  // slice of it.
  listAll(): Rule[] {
    return Array.from(this.rulesById.values());
  }

  create(input: RuleInput): Rule {
    const rule: Rule = { ...input, id: randomUUID() };
    this.index(rule);
    return rule;
  }

  // Full replace, not a partial patch — the RuleEditor form always submits
  // the complete rule body (create and edit share one component), so
  // there's no separate narrow "toggle enabled" path to keep in sync.
  update(id: string, input: RuleInput): Rule | undefined {
    const existing = this.rulesById.get(id);
    if (!existing) return undefined;

    const rule: Rule = { ...input, id };
    // ownerId isn't user-editable in the RuleEditor today, but the owner
    // index would silently go stale if it ever became one without this.
    if (existing.ownerId !== rule.ownerId) {
      this.unindexOwner(id, existing.ownerId);
    }
    this.index(rule);
    return rule;
  }
}
