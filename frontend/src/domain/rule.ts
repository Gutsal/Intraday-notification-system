// Mirrors backend/src/domain/rule.ts. Deliberately duplicated rather than
// imported from the backend package: this repo isn't set up as an npm
// workspace (root is the backend itself, not a peer package), so a
// cross-package import would require restructuring that layout. The spec
// allows this fallback explicitly
// ("or a shared package if the build setup makes that easy — don't
// hand-duplicate the type definitions" — it isn't easy here without that
// restructure, so duplication is the stated tradeoff).
export type ConditionField =
  | 'sla_margin_sec'
  | 'tickets_waiting'
  | 'adherence_violation_duration_sec'
  | 'agent_state_duration_sec';

export type Operator = '>' | '>=' | '=';

export type Severity = 'warning' | 'danger';

export interface RuleScope {
  queueIds?: string[];
  agentIds?: string[];
}

export interface Rule {
  id: string;
  ownerId: string;
  recipientId: string;
  scope: RuleScope;
  field: ConditionField;
  stateFilter?: string; // only meaningful when field === 'agent_state_duration_sec'
  operator: Operator;
  threshold: number;
  minDurationSec?: number;
  cooldownSec: number;
  severity: Severity;
  enabled: boolean;
}

export type RuleInput = Omit<Rule, 'id'>;

export const CONDITION_FIELD_OPTIONS: { value: ConditionField; label: string }[] = [
  { value: 'sla_margin_sec', label: 'SLA margin (sec)' },
  { value: 'tickets_waiting', label: 'Tickets waiting' },
  { value: 'adherence_violation_duration_sec', label: 'Adherence violation duration (sec)' },
  { value: 'agent_state_duration_sec', label: 'Agent state duration (sec)' },
];

export const OPERATOR_OPTIONS: { value: Operator; label: string }[] = [
  { value: '>', label: '>' },
  { value: '>=', label: '>=' },
  { value: '=', label: '=' },
];

export const SEVERITY_OPTIONS: { value: Severity; label: string }[] = [
  { value: 'warning', label: 'Warning' },
  { value: 'danger', label: 'Danger' },
];

// Real values observed in data/events.jsonl's agent_state_change/adherence_check.
export const AGENT_STATE_OPTIONS = ['available', 'on_call', 'on_break', 'in_meeting', 'offline'] as const;

// Hardcoded per the spec: only three queues, fixed by the sample data — a
// "list queues" endpoint would be pure ceremony at this scope.
export const QUEUE_ID_OPTIONS = ['billing', 'tier_2', 'vip'] as const;
