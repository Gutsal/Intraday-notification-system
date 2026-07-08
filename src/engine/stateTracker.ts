import type { AdherenceCheck, AgentStateChange, QueueSnapshot } from '../domain/events.ts';

export interface OpenAgentState {
  eventId: string;
  agentId: string;
  state: string;
  since: Date;
  queueIds: string[];
}

export interface QueueMetrics {
  eventId: string;
  queueId: string;
  ticketsWaiting: number;
  longestWaitSec: number;
  slaTargetSec: number;
  slaMarginSec: number; // derived: longest_wait_sec - sla_target_sec
  ts: Date;
}

export interface AdherenceStatus {
  eventId: string;
  agentId: string;
  inViolation: boolean;
  violationStartedAt: Date | null;
  queueIds: string[];
  ts: Date;
}

// Tracks the three pieces of live state the rule engine and scheduler read
// from: open agent states (for duration-in-progress sweeps), the latest
// queue metrics (for SLA/ticket-count rules), and adherence violation
// windows (for adherence-duration rules). Small in-memory tables keyed by
// id — generalizes to "thousands of customers, millions of events/day"
// since each lookup/update is O(1) against an indexed row, not a scan.
export class StateTracker {
  private readonly openAgentStates = new Map<string, OpenAgentState>();
  private readonly queueMetrics = new Map<string, QueueMetrics>();
  private readonly adherenceStatus = new Map<string, AdherenceStatus>();

  recordQueueSnapshot(event: QueueSnapshot): QueueMetrics {
    const metrics: QueueMetrics = {
      eventId: event.event_id,
      queueId: event.queue_id,
      ticketsWaiting: event.tickets_waiting,
      longestWaitSec: event.longest_wait_sec,
      slaTargetSec: event.sla_target_sec,
      slaMarginSec: event.longest_wait_sec - event.sla_target_sec,
      ts: new Date(event.ts),
    };
    this.queueMetrics.set(event.queue_id, metrics);
    return metrics;
  }

  recordAgentStateChange(event: AgentStateChange): OpenAgentState {
    // previous_state/previous_state_duration_sec describe the state that
    // just closed; the open-state table only needs to start tracking the
    // new one — closed-state duration rules are evaluated directly off this
    // event by the rule engine, not read back from this table.
    const open: OpenAgentState = {
      eventId: event.event_id,
      agentId: event.agent_id,
      state: event.new_state,
      since: new Date(event.ts),
      queueIds: event.queue_ids ?? [],
    };
    this.openAgentStates.set(event.agent_id, open);
    return open;
  }

  recordAdherenceCheck(event: AdherenceCheck): AdherenceStatus {
    const ts = new Date(event.ts);
    let violationStartedAt: Date | null = null;

    if (event.in_violation) {
      if (event.violation_started_at) {
        violationStartedAt = new Date(event.violation_started_at);
      } else {
        // violation_started_at can be null even when in_violation is true.
        // Keep following the previously tracked start if this agent was
        // already in violation; otherwise the true start is unknown, so
        // treat this event's own timestamp as the best-known start
        // (duration reads as 0 at first observation rather than guessing).
        const previous = this.adherenceStatus.get(event.agent_id);
        violationStartedAt =
          previous?.inViolation && previous.violationStartedAt ? previous.violationStartedAt : ts;
      }
    }

    const status: AdherenceStatus = {
      eventId: event.event_id,
      agentId: event.agent_id,
      inViolation: event.in_violation,
      violationStartedAt,
      queueIds: event.queue_ids ?? [],
      ts,
    };
    this.adherenceStatus.set(event.agent_id, status);
    return status;
  }

  getOpenAgentState(agentId: string): OpenAgentState | undefined {
    return this.openAgentStates.get(agentId);
  }

  getAllOpenAgentStates(): OpenAgentState[] {
    return Array.from(this.openAgentStates.values());
  }

  getQueueMetrics(queueId: string): QueueMetrics | undefined {
    return this.queueMetrics.get(queueId);
  }

  getAdherenceStatus(agentId: string): AdherenceStatus | undefined {
    return this.adherenceStatus.get(agentId);
  }
}
