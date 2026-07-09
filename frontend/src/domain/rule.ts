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

// Mirrors backend/src/domain/rule.ts's label maps (same duplication
// tradeoff as above) — the frontend needs its own copy since RuleRow and
// RuleEditor build their UI text directly from Rule data, with no
// backend round-trip to source a formatted string from (unlike
// Notification.message, which the backend already labels this same way in
// ruleEngine.ts's buildMessage()).
export const CONDITION_FIELD_LABELS: Record<ConditionField, string> = {
  sla_margin_sec: 'SLA margin',
  tickets_waiting: 'Tickets waiting',
  adherence_violation_duration_sec: 'Adherence violation duration',
  agent_state_duration_sec: 'Agent state duration',
};

export const CONDITION_FIELD_OPTIONS: { value: ConditionField; label: string }[] = (
  Object.entries(CONDITION_FIELD_LABELS) as [ConditionField, string][]
).map(([value, label]) => ({ value, label }));

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

export const AGENT_STATE_LABELS: Record<string, string> = {
  available: 'available',
  on_call: 'on a call',
  on_break: 'on break',
  in_meeting: 'in a meeting',
  offline: 'offline',
};

// Hardcoded per the spec: only three queues, fixed by the sample data — a
// "list queues" endpoint would be pure ceremony at this scope.
export const QUEUE_ID_OPTIONS = ['billing', 'tier_2', 'vip'] as const;

export const QUEUE_LABELS: Record<string, string> = {
  billing: 'Billing',
  tier_2: 'Tier 2',
  vip: 'VIP',
};
