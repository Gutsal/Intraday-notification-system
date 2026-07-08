import { randomUUID } from 'node:crypto';
import type { Rule, RuleInput } from '../domain/rule.ts';

// In-memory rules store — no persistence, per the take-home's stated scope
// (see README "What I'd build next"). Route handlers never touch this
// directly; they parse/validate then call these methods, per api-design
// SKILL.md's service-layer convention.
export class RulesService {
  private readonly rules = new Map<string, Rule>();

  constructor(seed: Rule[] = []) {
    for (const rule of seed) this.rules.set(rule.id, rule);
  }

  // No default/global fallback here on purpose — every call site must
  // supply ownerId explicitly (enforced by the route's Zod schema), so a
  // query can never silently span identities.
  list(ownerId: string): Rule[] {
    return Array.from(this.rules.values()).filter((rule) => rule.ownerId === ownerId);
  }

  get(id: string): Rule | undefined {
    return this.rules.get(id);
  }

  // Returns every rule regardless of owner — used only by the replay
  // trigger, which needs to evaluate the full rule set, not one identity's
  // slice of it.
  listAll(): Rule[] {
    return Array.from(this.rules.values());
  }

  create(input: RuleInput): Rule {
    const rule: Rule = { ...input, id: randomUUID() };
    this.rules.set(rule.id, rule);
    return rule;
  }

  // Full replace, not a partial patch — the RuleEditor form always submits
  // the complete rule body (create and edit share one component), so
  // there's no separate narrow "toggle enabled" path to keep in sync.
  update(id: string, input: RuleInput): Rule | undefined {
    if (!this.rules.has(id)) return undefined;
    const rule: Rule = { ...input, id };
    this.rules.set(id, rule);
    return rule;
  }
}
