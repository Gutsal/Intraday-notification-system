import { randomUUID } from 'node:crypto';
import type { Rule } from '../domain/rule.ts';
import type { Notification } from '../domain/notification.ts';
import type { Dedup } from './dedup.ts';
import type { AdherenceStatus, QueueMetrics } from './stateTracker.ts';
import type { AgentStateChange } from '../domain/events.ts';

// A single measured value ready to be checked against rules — the common
// shape produced by both event-driven updates (queue_snapshot,
// adherence_check, agent_state_change) and the scheduler's periodic sweep
// over open agent states. Keeping this shape uniform is what lets one
// evaluate() function serve both triggers instead of duplicating matching
// logic per event type.
export interface EvaluationCandidate {
  eventId: string;
  field: Rule['field'];
  value: number;
  entityType: 'queue' | 'agent';
  entityId: string; // queueId or agentId — dedup key and scope-match target
  queueIds: string[]; // queues this entity belongs to; resolves "any of my agents" scope
  stateFilter?: string; // current agent state, only set for agent_state_duration_sec candidates
  ts: Date;
  context: Record<string, unknown>;
}

function matchesOperator(value: number, operator: Rule['operator'], threshold: number): boolean {
  switch (operator) {
    case '>':
      return value > threshold;
    case '>=':
      return value >= threshold;
    case '=':
      return value === threshold;
    default:
      return false;
  }
}

function matchesScope(rule: Rule, candidate: EvaluationCandidate): boolean {
  if (candidate.entityType === 'queue') {
    return rule.scope.queueIds?.includes(candidate.entityId) ?? false;
  }
  // Agent candidate: matches a literal agentIds list, or resolves "any of
  // my agents" by checking the agent's own queue membership against the
  // rule's owned queues — per the spec, a team lead's agent-scoped rule is
  // expressed as queue ownership, not a hand-maintained agent roster.
  if (rule.scope.agentIds?.includes(candidate.entityId)) return true;
  if (rule.scope.queueIds) {
    return candidate.queueIds.some((q) => rule.scope.queueIds?.includes(q));
  }
  return false;
}

function matchesField(rule: Rule, candidate: EvaluationCandidate): boolean {
  if (rule.field !== candidate.field) return false;
  if (rule.field === 'agent_state_duration_sec' && rule.stateFilter) {
    return rule.stateFilter === candidate.stateFilter;
  }
  return true;
}

function buildMessage(rule: Rule, candidate: EvaluationCandidate): string {
  const subject = candidate.entityType === 'queue' ? `queue ${candidate.entityId}` : `agent ${candidate.entityId}`;
  const stateNote = candidate.stateFilter ? ` while ${candidate.stateFilter}` : '';
  return `${candidate.eventId}: ${subject}: ${rule.field}${stateNote} ${rule.operator} ${rule.threshold} (currently ${candidate.value.toFixed(1)})`;
}

// Persistence gate for minDurationSec: "for more than N minutes" gates
// *whether* a condition counts at all, separate from cooldownSec which
// gates *how often* an already-counting condition may re-fire. Tracks, per
// rule+entity, when the operator/threshold check most recently became
// continuously true; resets the moment it stops being true.
export class ConditionPersistence {
  private readonly trueSince = new Map<string, number>();

  private key(ruleId: string, entityId: string): string {
    return `${ruleId}:${entityId}`;
  }

  check(ruleId: string, entityId: string, now: Date, conditionTrue: boolean, minDurationSec?: number): boolean {
    const key = this.key(ruleId, entityId);
    if (!conditionTrue) {
      this.trueSince.delete(key);
      return false;
    }
    if (!minDurationSec) return true;

    const since = this.trueSince.get(key);
    if (since === undefined) {
      this.trueSince.set(key, now.getTime());
      return minDurationSec <= 0;
    }
    return (now.getTime() - since) / 1000 >= minDurationSec;
  }
}

export function evaluate(
  rules: Rule[],
  candidate: EvaluationCandidate,
  dedup: Dedup,
  persistence: ConditionPersistence,
): Notification[] {
  const notifications: Notification[] = [];

  for (const rule of rules) {
    if (!rule.enabled) continue;
    if (!matchesField(rule, candidate)) continue;
    if (!matchesScope(rule, candidate)) continue;

    const conditionTrue = matchesOperator(candidate.value, rule.operator, rule.threshold);
    const eligible = persistence.check(rule.id, candidate.entityId, candidate.ts, conditionTrue, rule.minDurationSec);
    if (!eligible) continue;

    if (!dedup.shouldFire(rule.id, candidate.entityId, candidate.ts, rule.cooldownSec)) continue;

    const notification: Notification = {
      id: randomUUID(),
      ruleId: rule.id,
      recipientId: rule.recipientId,
      severity: rule.severity,
      firedAt: candidate.ts.toISOString(),
      message: buildMessage(rule, candidate),
      context: { ...candidate.context, field: candidate.field, value: candidate.value, threshold: rule.threshold },
    };
    notifications.push(notification);
    dedup.recordFired(rule.id, candidate.entityId, candidate.ts);
  }

  return notifications;
}

// --- Candidate builders: turn a state-tracker update into the
// EvaluationCandidate(s) it can immediately produce. queue_snapshot and
// adherence_check carry enough context to evaluate right away; a
// transition-out agent_state_change also evaluates the just-closed
// duration directly (the scheduler sweep separately covers states still
// open — see scheduler.ts).

export function candidatesForQueueSnapshot(metrics: QueueMetrics): EvaluationCandidate[] {
  const base = {
    eventId: metrics.eventId,
    entityType: 'queue' as const,
    entityId: metrics.queueId,
    queueIds: [metrics.queueId],
    ts: metrics.ts,
  };
  return [
    {
      ...base,
      field: 'sla_margin_sec',
      value: metrics.slaMarginSec,
      context: { queueId: metrics.queueId, longestWaitSec: metrics.longestWaitSec, slaTargetSec: metrics.slaTargetSec },
    },
    {
      ...base,
      field: 'tickets_waiting',
      value: metrics.ticketsWaiting,
      context: { queueId: metrics.queueId, ticketsWaiting: metrics.ticketsWaiting },
    },
  ];
}

export function candidateForAdherenceCheck(status: AdherenceStatus): EvaluationCandidate {
  const durationSec = status.inViolation && status.violationStartedAt
    ? (status.ts.getTime() - status.violationStartedAt.getTime()) / 1000
    : 0;
  return {
    eventId: status.eventId,
    field: 'adherence_violation_duration_sec',
    value: durationSec,
    entityType: 'agent',
    entityId: status.agentId,
    queueIds: status.queueIds,
    ts: status.ts,
    context: { agentId: status.agentId, inViolation: status.inViolation, durationSec },
  };
}

export function candidateForClosedAgentState(event: AgentStateChange): EvaluationCandidate | undefined {
  if (event.previous_state === null || event.previous_state_duration_sec === null) return undefined;
  return {
    eventId: event.event_id,
    field: 'agent_state_duration_sec',
    value: event.previous_state_duration_sec,
    entityType: 'agent',
    entityId: event.agent_id,
    queueIds: event.queue_ids ?? [],
    stateFilter: event.previous_state,
    ts: new Date(event.ts),
    context: { agentId: event.agent_id, state: event.previous_state, durationSec: event.previous_state_duration_sec },
  };
}
