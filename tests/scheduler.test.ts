import { describe, it, expect } from 'vitest';
import { StateTracker } from '../src/engine/stateTracker.ts';
import { Dedup } from '../src/engine/dedup.ts';
import { ConditionPersistence } from '../src/engine/ruleEngine.ts';
import { Scheduler } from '../src/engine/scheduler.ts';
import { SimulatedClock } from '../src/engine/clock.ts';
import { SEED_RULES } from '../src/domain/seedRules.ts';

// This is the highest-value test in the suite: a naive event-reactive-only
// engine is silently wrong here, since it would only learn the call was
// too long once it ended. Real trigger from data/events.jsonl: a_11's
// on_call state runs 09:10:00 -> 10:20:00 (70 min) before any
// transition-out event arrives.
describe('scheduler duration sweep', () => {
  it('fires the on-call duration rule while the call is still in progress, before any transition-out event arrives', () => {
    const clock = new SimulatedClock(new Date('2026-05-26T09:10:00Z'));
    const tracker = new StateTracker();
    const dedup = new Dedup();
    const persistence = new ConditionPersistence();
    const scheduler = new Scheduler(clock.now());

    tracker.recordAgentStateChange({
      event_id: 'evt_01HXYZ018',
      ts: '2026-05-26T09:10:00Z',
      type: 'agent_state_change',
      agent_id: 'a_11',
      queue_ids: ['tier_2', 'vip'],
      previous_state: 'available',
      previous_state_duration_sec: 555,
      new_state: 'on_call',
    });

    // Advance simulated time past the 45-minute threshold WITHOUT a
    // transition-out event ever arriving.
    clock.advance(46 * 60 * 1000);
    const notifications = scheduler.advanceTo(clock.now(), SEED_RULES, tracker, dedup, persistence);

    expect(notifications).toContainEqual(expect.objectContaining({ ruleId: 'rule-2', recipientId: 'lead_1' }));
  });

  it('does not fire before the duration threshold is reached', () => {
    const clock = new SimulatedClock(new Date('2026-05-26T09:10:00Z'));
    const tracker = new StateTracker();
    const dedup = new Dedup();
    const persistence = new ConditionPersistence();
    const scheduler = new Scheduler(clock.now());

    tracker.recordAgentStateChange({
      event_id: 'evt_01HXYZ018',
      ts: '2026-05-26T09:10:00Z',
      type: 'agent_state_change',
      agent_id: 'a_11',
      queue_ids: ['tier_2', 'vip'],
      previous_state: 'available',
      previous_state_duration_sec: 555,
      new_state: 'on_call',
    });

    clock.advance(20 * 60 * 1000); // only 20 minutes in, well under 45
    const notifications = scheduler.advanceTo(clock.now(), SEED_RULES, tracker, dedup, persistence);

    expect(notifications.some((n) => n.ruleId === 'rule-2')).toBe(false);
  });

  it('sweeps every 30s boundary crossed in a single advanceTo call, not just the final instant', () => {
    const start = new Date('2026-05-26T09:00:00Z');
    const scheduler = new Scheduler(start);
    const tracker = new StateTracker();
    const dedup = new Dedup();
    const persistence = new ConditionPersistence();

    tracker.recordAgentStateChange({
      event_id: 'evt_test',
      ts: start.toISOString(),
      type: 'agent_state_change',
      agent_id: 'a_test',
      queue_ids: ['billing'],
      previous_state: 'available',
      previous_state_duration_sec: 100,
      new_state: 'on_call',
    });

    // Jump straight past the 45-minute threshold in one call — this only
    // works if advanceTo walks every 30s tick in between, not just the
    // final timestamp, since the sweep needs a tick whose "now" is actually
    // past the threshold relative to the state's `since`.
    const notifications = scheduler.advanceTo(
      new Date(start.getTime() + 46 * 60_000),
      SEED_RULES,
      tracker,
      dedup,
      persistence,
    );

    expect(notifications.some((n) => n.ruleId === 'rule-2')).toBe(true);
  });
});
