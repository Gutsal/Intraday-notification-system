import { describe, it, expect } from 'vitest';
import { Dedup } from '../src/engine/dedup.ts';

describe('Dedup', () => {
  it('allows the first fire for a rule+entity pair', () => {
    const dedup = new Dedup();
    expect(dedup.shouldFire('rule-1', 'billing', new Date('2026-05-26T09:30:00Z'), 600)).toBe(true);
  });

  it('suppresses a repeat within the cooldown window', () => {
    const dedup = new Dedup();
    const t0 = new Date('2026-05-26T09:30:00Z');
    dedup.recordFired('rule-1', 'billing', t0);
    const withinCooldown = new Date(t0.getTime() + 5 * 60_000);
    expect(dedup.shouldFire('rule-1', 'billing', withinCooldown, 600)).toBe(false);
  });

  it('allows a fresh fire once the cooldown window has elapsed', () => {
    const dedup = new Dedup();
    const t0 = new Date('2026-05-26T09:30:00Z');
    dedup.recordFired('rule-1', 'billing', t0);
    const afterCooldown = new Date(t0.getTime() + 601 * 1000);
    expect(dedup.shouldFire('rule-1', 'billing', afterCooldown, 600)).toBe(true);
  });

  it('tracks cooldowns independently per entity, not globally per rule', () => {
    const dedup = new Dedup();
    const t0 = new Date('2026-05-26T09:30:00Z');
    dedup.recordFired('rule-2', 'a_11', t0);
    // A different agent under the same rule shouldn't be suppressed by
    // a_11's cooldown — rule 2 applies to "any of my agents" independently.
    expect(dedup.shouldFire('rule-2', 'a_05', t0, 900)).toBe(true);
  });
});
