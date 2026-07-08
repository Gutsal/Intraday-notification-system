import { AGENT_STATE_OPTIONS, QUEUE_ID_OPTIONS, type ConditionField, type Operator, type Rule, type RuleInput, type Severity } from '../../domain/rule.ts';

// This is the real logic behind the RuleEditor (per design/reference/rule-editor-mockup.html's
// comments): "Applies to" controls whether/what the scope-target row shows,
// and "Condition" controls whether a duration-related row appears and what
// the threshold's unit means. Grouped here in a reducer, per
// react-typescript-best-practices SKILL.md's guidance for form state where
// sub-values change together.

export type ScopeType = 'queue' | 'agents' | 'self';

export interface RuleFormState {
  scopeType: ScopeType;
  queueId: string;
  field: ConditionField;
  stateFilter: string;
  operator: Operator;
  threshold: number;
  useMinDuration: boolean;
  minDurationSec: number;
  cooldownSec: number;
  severity: Severity;
  enabled: boolean;
}

// "A queue" / "My agents" for a team lead (queue-owned rules); an agent
// identity only ever makes rules about themselves in this scope (see spec's
// "thin secondary example" decision) — reusing the same RuleEditor, not a
// second experience.
export function scopeTypeOptionsForRole(role: 'team_lead' | 'agent'): ScopeType[] {
  return role === 'agent' ? ['self'] : ['queue', 'agents'];
}

// Queue-level fields (sla_margin_sec, tickets_waiting) only make sense
// scoped to a queue; agent-level fields (durations) only make sense scoped
// to an agent or a team lead's owned agents.
export function fieldOptionsForScope(scopeType: ScopeType): ConditionField[] {
  if (scopeType === 'queue') return ['sla_margin_sec', 'tickets_waiting'];
  return ['adherence_violation_duration_sec', 'agent_state_duration_sec'];
}

export function isDurationField(field: ConditionField): boolean {
  return field === 'adherence_violation_duration_sec' || field === 'agent_state_duration_sec';
}

export function unitLabelForField(field: ConditionField): string {
  switch (field) {
    case 'sla_margin_sec':
      return 'sec over target';
    case 'tickets_waiting':
      return 'tickets';
    case 'adherence_violation_duration_sec':
    case 'agent_state_duration_sec':
      return 'sec';
  }
}

function defaultThresholdForField(field: ConditionField): number {
  switch (field) {
    case 'sla_margin_sec':
      return 0;
    case 'tickets_waiting':
      return 20;
    case 'adherence_violation_duration_sec':
      return 600;
    case 'agent_state_duration_sec':
      return 2700;
  }
}

export function defaultFormState(role: 'team_lead' | 'agent'): RuleFormState {
  const scopeType: ScopeType = scopeTypeOptionsForRole(role)[0];
  const field = fieldOptionsForScope(scopeType)[0];
  return {
    scopeType,
    queueId: QUEUE_ID_OPTIONS[0],
    field,
    stateFilter: 'on_call',
    operator: '>',
    threshold: defaultThresholdForField(field),
    useMinDuration: false,
    minDurationSec: 600,
    cooldownSec: 600,
    severity: 'warning',
    enabled: true,
  };
}

export function formStateFromRule(rule: Rule): RuleFormState {
  const scopeType: ScopeType = rule.scope.agentIds?.length
    ? 'self'
    : rule.field === 'sla_margin_sec' || rule.field === 'tickets_waiting'
      ? 'queue'
      : 'agents';

  return {
    scopeType,
    queueId: rule.scope.queueIds?.[0] ?? QUEUE_ID_OPTIONS[0],
    field: rule.field,
    stateFilter: rule.stateFilter ?? AGENT_STATE_OPTIONS[1],
    operator: rule.operator,
    threshold: rule.threshold,
    useMinDuration: rule.minDurationSec !== undefined,
    minDurationSec: rule.minDurationSec ?? 600,
    cooldownSec: rule.cooldownSec,
    severity: rule.severity,
    enabled: rule.enabled,
  };
}

export type RuleFormAction =
  | { type: 'SET_SCOPE_TYPE'; scopeType: ScopeType }
  | { type: 'SET_QUEUE_ID'; queueId: string }
  | { type: 'SET_FIELD'; field: ConditionField }
  | { type: 'SET_STATE_FILTER'; stateFilter: string }
  | { type: 'SET_OPERATOR'; operator: Operator }
  | { type: 'SET_THRESHOLD'; threshold: number }
  | { type: 'SET_USE_MIN_DURATION'; useMinDuration: boolean }
  | { type: 'SET_MIN_DURATION_SEC'; minDurationSec: number }
  | { type: 'SET_COOLDOWN_SEC'; cooldownSec: number }
  | { type: 'SET_SEVERITY'; severity: Severity }
  | { type: 'SET_ENABLED'; enabled: boolean }
  | { type: 'RESET'; state: RuleFormState };

export function ruleFormReducer(state: RuleFormState, action: RuleFormAction): RuleFormState {
  switch (action.type) {
    case 'SET_SCOPE_TYPE': {
      const fieldOptions = fieldOptionsForScope(action.scopeType);
      const field = fieldOptions.includes(state.field) ? state.field : fieldOptions[0];
      return {
        ...state,
        scopeType: action.scopeType,
        field,
        threshold: field === state.field ? state.threshold : defaultThresholdForField(field),
      };
    }
    case 'SET_QUEUE_ID':
      return { ...state, queueId: action.queueId };
    case 'SET_FIELD':
      return {
        ...state,
        field: action.field,
        threshold: defaultThresholdForField(action.field),
        useMinDuration: isDurationField(action.field) ? false : state.useMinDuration,
      };
    case 'SET_STATE_FILTER':
      return { ...state, stateFilter: action.stateFilter };
    case 'SET_OPERATOR':
      return { ...state, operator: action.operator };
    case 'SET_THRESHOLD':
      return { ...state, threshold: action.threshold };
    case 'SET_USE_MIN_DURATION':
      return { ...state, useMinDuration: action.useMinDuration };
    case 'SET_MIN_DURATION_SEC':
      return { ...state, minDurationSec: action.minDurationSec };
    case 'SET_COOLDOWN_SEC':
      return { ...state, cooldownSec: action.cooldownSec };
    case 'SET_SEVERITY':
      return { ...state, severity: action.severity };
    case 'SET_ENABLED':
      return { ...state, enabled: action.enabled };
    case 'RESET':
      return action.state;
    default:
      return state;
  }
}

export function buildRuleInput(state: RuleFormState, ownerId: string): RuleInput {
  const scope =
    state.scopeType === 'queue'
      ? { queueIds: [state.queueId] }
      : state.scopeType === 'agents'
        ? { queueIds: [...QUEUE_ID_OPTIONS] } // "any of my agents" resolved via owned-queue membership
        : { agentIds: [ownerId] };

  return {
    ownerId,
    recipientId: ownerId,
    scope,
    field: state.field,
    stateFilter: state.field === 'agent_state_duration_sec' ? state.stateFilter : undefined,
    operator: state.operator,
    threshold: state.threshold,
    minDurationSec: !isDurationField(state.field) && state.useMinDuration ? state.minDurationSec : undefined,
    cooldownSec: state.cooldownSec,
    severity: state.severity,
    enabled: state.enabled,
  };
}
