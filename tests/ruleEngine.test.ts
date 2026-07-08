import { describe, it, expect } from 'vitest';
import { StateTracker } from '../src/engine/stateTracker.ts';
import { Dedup } from '../src/engine/dedup.ts';
import { ConditionPersistence, RuleIndex, evaluate, candidatesForQueueSnapshot, candidateForAdherenceCheck } from '../src/engine/ruleEngine.ts';
import { SEED_RULES } from '../src/domain/seedRules.ts';
import type { QueueSnapshot, AdherenceCheck } from '../src/domain/events.ts';

// Built once — RuleIndex is a read-only view over SEED_RULES, safe to
// share across tests (evaluate() never mutates it).
const index = new RuleIndex(SEED_RULES);

// Real billing SLA-breach sequence from data/events.jsonl — six
// consecutive breaching snapshots, 09:30-10:00.
const billingBreachSnapshots: QueueSnapshot[] = [
  { event_id: 'evt_01HXYZ039', ts: '2026-05-26T09:30:00Z', type: 'queue_snapshot', queue_id: 'billing', tickets_waiting: 18, longest_wait_sec: 130, sla_target_sec: 120, agents_available: 0, agents_on_call: 4, volume_last_15m: 28, volume_forecast_next_15m: 38 },
  { event_id: 'evt_01HXYZ049', ts: '2026-05-26T09:36:00Z', type: 'queue_snapshot', queue_id: 'billing', tickets_waiting: 22, longest_wait_sec: 180, sla_target_sec: 120, agents_available: 0, agents_on_call: 3, volume_last_15m: 30, volume_forecast_next_15m: 40 },
  { event_id: 'evt_01HXYZ052', ts: '2026-05-26T09:40:00Z', type: 'queue_snapshot', queue_id: 'billing', tickets_waiting: 20, longest_wait_sec: 240, sla_target_sec: 120, agents_available: 1, agents_on_call: 3, volume_last_15m: 32, volume_forecast_next_15m: 40 },
  { event_id: 'evt_01HXYZ055', ts: '2026-05-26T09:45:00Z', type: 'queue_snapshot', queue_id: 'billing', tickets_waiting: 19, longest_wait_sec: 260, sla_target_sec: 120, agents_available: 1, agents_on_call: 3, volume_last_15m: 32, volume_forecast_next_15m: 42 },
  { event_id: 'evt_01HXYZ066', ts: '2026-05-26T09:50:00Z', type: 'queue_snapshot', queue_id: 'billing', tickets_waiting: 17, longest_wait_sec: 270, sla_target_sec: 120, agents_available: 0, agents_on_call: 3, volume_last_15m: 32, volume_forecast_next_15m: 38 },
  { event_id: 'evt_01HXYZ068', ts: '2026-05-26T10:00:00Z', type: 'queue_snapshot', queue_id: 'billing', tickets_waiting: 14, longest_wait_sec: 200, sla_target_sec: 120, agents_available: 1, agents_on_call: 3, volume_last_15m: 30, volume_forecast_next_15m: null },
];

// Real a_19 adherence-violation sequence — violation_started_at 09:35:00,
// continuous across four checks, 09:36-10:01.
const a19ViolationChecks: AdherenceCheck[] = [
  { event_id: 'evt_01HXYZ050', ts: '2026-05-26T09:36:00Z', type: 'adherence_check', agent_id: 'a_19', queue_ids: ['billing'], scheduled_state: 'available', actual_state: 'on_break', in_violation: true, violation_started_at: '2026-05-26T09:35:00Z' },
  { event_id: 'evt_01HXYZ057', ts: '2026-05-26T09:45:00Z', type: 'adherence_check', agent_id: 'a_19', queue_ids: ['billing'], scheduled_state: 'available', actual_state: 'on_break', in_violation: true, violation_started_at: '2026-05-26T09:35:00Z' },
  { event_id: 'evt_01HXYZ067', ts: '2026-05-26T09:55:00Z', type: 'adherence_check', agent_id: 'a_19', queue_ids: ['billing'], scheduled_state: 'available', actual_state: 'on_break', in_violation: true, violation_started_at: '2026-05-26T09:35:00Z' },
  { event_id: 'evt_01HXYZ071', ts: '2026-05-26T10:01:00Z', type: 'adherence_check', agent_id: 'a_19', queue_ids: ['billing'], scheduled_state: 'available', actual_state: 'on_break', in_violation: true, violation_started_at: '2026-05-26T09:35:00Z' },
];

describe('rule engine — real sustained-condition sequences', () => {
  it('fires the billing SLA-breach rule, but suppresses repeats via cooldown across all six breaching snapshots', () => {
    const tracker = new StateTracker();
    const dedup = new Dedup();
    const persistence = new ConditionPersistence();
    const fired: string[] = [];

    for (const snapshot of billingBreachSnapshots) {
      const metrics = tracker.recordQueueSnapshot(snapshot);
      for (const candidate of candidatesForQueueSnapshot(metrics)) {
        fired.push(...evaluate(index, candidate, dedup, persistence).map((n) => n.ruleId));
      }
    }

    const rule1Fires = fired.filter((id) => id === 'rule-1');
    expect(rule1Fires.length).toBeGreaterThan(0);
    expect(rule1Fires.length).toBeLessThan(billingBreachSnapshots.length);
  });

  it('fires the a_19 adherence-violation rule, but suppresses repeats via cooldown across the sustained violation', () => {
    const tracker = new StateTracker();
    const dedup = new Dedup();
    const persistence = new ConditionPersistence();
    const fired: string[] = [];

    for (const check of a19ViolationChecks) {
      const status = tracker.recordAdherenceCheck(check);
      fired.push(...evaluate(index, candidateForAdherenceCheck(status), dedup, persistence).map((n) => n.ruleId));
    }

    const rule3Fires = fired.filter((id) => id === 'rule-3');
    expect(rule3Fires.length).toBeGreaterThan(0);
    expect(rule3Fires.length).toBeLessThan(a19ViolationChecks.length);
  });

  it('allows a fresh notification once the cooldown window has fully elapsed', () => {
    const dedup = new Dedup();
    const persistence = new ConditionPersistence();
    const violationStartedAt = new Date('2026-05-26T09:35:00Z');
    // 11 min after the violation started — already past rule-3's 10-min
    // duration threshold, so this candidate should fire immediately.
    const base = new Date('2026-05-26T09:46:00Z');

    const makeCandidate = (ts: Date) =>
      candidateForAdherenceCheck({
        eventId: 'evt_test',
        agentId: 'a_19',
        inViolation: true,
        violationStartedAt,
        queueIds: ['billing'],
        ts,
      });

    const first = evaluate(index, makeCandidate(base), dedup, persistence);
    expect(first.some((n) => n.ruleId === 'rule-3')).toBe(true);

    // Still within the 10-min cooldown — suppressed.
    const within = evaluate(index, makeCandidate(new Date(base.getTime() + 5 * 60_000)), dedup, persistence);
    expect(within.some((n) => n.ruleId === 'rule-3')).toBe(false);

    // Past the cooldown — fires again.
    const after = evaluate(index, makeCandidate(new Date(base.getTime() + 11 * 60_000)), dedup, persistence);
    expect(after.some((n) => n.ruleId === 'rule-3')).toBe(true);
  });

  it('treats violation_started_at: null with in_violation: true defensively (real a_23 edge case)', () => {
    const tracker = new StateTracker();
    const status = tracker.recordAdherenceCheck({
      event_id: 'evt_01HXYZ086',
      ts: '2026-05-26T10:15:30Z',
      type: 'adherence_check',
      agent_id: 'a_23',
      queue_ids: ['tier_2'],
      scheduled_state: 'available',
      actual_state: 'in_meeting',
      in_violation: true,
      violation_started_at: null,
    });

    expect(status.inViolation).toBe(true);
    // No prior tracked violation for a_23 and no reported start — falls
    // back to this event's own timestamp rather than throwing or leaving
    // duration undefined.
    expect(status.violationStartedAt).toEqual(new Date('2026-05-26T10:15:30Z'));
  });

  it('does not fire an agent-scoped rule for an agent outside its scope', () => {
    const dedup = new Dedup();
    const persistence = new ConditionPersistence();
    const status = {
      eventId: 'evt_test',
      agentId: 'a_05',
      inViolation: true,
      violationStartedAt: new Date('2026-05-26T09:00:00Z'),
      queueIds: ['vip'],
      ts: new Date('2026-05-26T09:20:00Z'), // 20 min in violation, past rule-3's 10-min threshold
    };
    // rule-3 is scoped to agentIds: ['a_19'] only.
    const notifications = evaluate(index, candidateForAdherenceCheck(status), dedup, persistence);
    expect(notifications.some((n) => n.ruleId === 'rule-3')).toBe(false);
  });
});
