import type { Rule } from '../domain/rule.ts';
import type { Notification } from '../domain/notification.ts';
import type { Dedup } from './dedup.ts';
import { evaluate, ConditionPersistence, type EvaluationCandidate } from './ruleEngine.ts';
import type { OpenAgentState, StateTracker } from './stateTracker.ts';

// Core design decision (see CLAUDE.md / spec's "Core design decision"
// section): agent_state_change fires only on transition, and a state's
// duration is only known once it ends. A rule like "on a call over 45 min"
// can't be caught by reacting to events alone — by the time the transition
// event arrives, the call is already over. This sweep re-evaluates every
// currently *open* agent state against elapsed duration on a fixed cadence,
// independent of whether any new event arrived. It's a timer sweep over an
// indexed open-state table, so it generalizes to thousands of agents
// without scanning event history.
function candidateForOpenState(open: OpenAgentState, now: Date): EvaluationCandidate {
  const durationSec = (now.getTime() - open.since.getTime()) / 1000;
  return {
    eventId: open.eventId,
    field: 'agent_state_duration_sec',
    value: durationSec,
    entityType: 'agent',
    entityId: open.agentId,
    queueIds: open.queueIds,
    stateFilter: open.state,
    ts: now,
    context: { agentId: open.agentId, state: open.state, durationSec },
  };
}

export function sweep(
  rules: Rule[],
  tracker: StateTracker,
  dedup: Dedup,
  persistence: ConditionPersistence,
  now: Date,
): Notification[] {
  const notifications: Notification[] = [];
  for (const open of tracker.getAllOpenAgentStates()) {
    const candidate = candidateForOpenState(open, now);
    notifications.push(...evaluate(rules, candidate, dedup, persistence));
  }
  return notifications;
}

// Drives the periodic tick itself: given the next known point in time (an
// incoming event's timestamp, or the replay's end), fires one sweep per
// intervalMs boundary crossed since the last tick — so a long gap between
// events still gets swept at the full cadence, not just once when the next
// event happens to arrive.
export class Scheduler {
  private lastTickAtMs: number;

  constructor(
    start: Date,
    private readonly intervalMs: number = 30_000,
  ) {
    this.lastTickAtMs = start.getTime();
  }

  advanceTo(
    now: Date,
    rules: Rule[],
    tracker: StateTracker,
    dedup: Dedup,
    persistence: ConditionPersistence,
  ): Notification[] {
    const notifications: Notification[] = [];
    let nextTickMs = this.lastTickAtMs + this.intervalMs;

    while (nextTickMs <= now.getTime()) {
      notifications.push(...sweep(rules, tracker, dedup, persistence, new Date(nextTickMs)));
      this.lastTickAtMs = nextTickMs;
      nextTickMs += this.intervalMs;
    }

    return notifications;
  }
}
