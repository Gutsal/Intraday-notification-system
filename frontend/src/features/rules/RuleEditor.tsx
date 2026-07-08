import { useReducer } from 'react';
import {
  AGENT_STATE_OPTIONS,
  CONDITION_FIELD_OPTIONS,
  OPERATOR_OPTIONS,
  QUEUE_ID_OPTIONS,
  SEVERITY_OPTIONS,
  type Rule,
} from '../../domain/rule.ts';
import { Button } from '../../components/Button.tsx';
import { useRuleMutations } from './useRules.ts';
import {
  buildRuleInput,
  defaultFormState,
  fieldOptionsForScope,
  formStateFromRule,
  isDurationField,
  ruleFormReducer,
  scopeTypeOptionsForRole,
  unitLabelForField,
} from './ruleFormReducer.ts';
import './RuleEditor.scss';

const SCOPE_TYPE_LABEL: Record<string, string> = {
  queue: 'A queue',
  agents: 'My agents',
  self: 'Myself',
};

const COOLDOWN_PRESETS_SEC = [300, 600, 900, 1800, 3600];

interface RuleEditorProps {
  ownerId: string;
  role: 'team_lead' | 'agent';
  rule?: Rule; // present in edit mode, prefilled; absent in create mode
  onClose: () => void;
}

// Inline slide-over panel (see css-best-practices SKILL.md — --shadow-panel,
// no dimmed backdrop), not a modal. The same component and reducer handle
// both create and edit, per the spec's decision to keep one form for both.
export function RuleEditor({ ownerId, role, rule, onClose }: RuleEditorProps) {
  const [state, dispatch] = useReducer(ruleFormReducer, rule ? formStateFromRule(rule) : defaultFormState(role));
  const { create, update } = useRuleMutations(ownerId);

  const scopeTypeOptions = scopeTypeOptionsForRole(role);
  const fieldOptions = fieldOptionsForScope(state.scopeType);
  const pending = create.isPending || update.isPending;
  const mutationError = create.error ?? update.error;

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const input = buildRuleInput(state, ownerId);
    if (rule) {
      update.mutate({ id: rule.id, input }, { onSuccess: onClose });
    } else {
      create.mutate(input, { onSuccess: onClose });
    }
  }

  return (
    <div className="rule-editor" role="dialog" aria-label={rule ? 'Edit rule' : 'New rule'}>
      <form className="rule-editor__panel" onSubmit={handleSubmit}>
        <div className="rule-editor__title">{rule ? 'Edit rule' : 'New rule'}</div>
        <div className="rule-editor__subtitle">Notify when a condition holds for a set amount of time</div>

        {scopeTypeOptions.length > 1 && (
          <div className="rule-editor__field">
            <label htmlFor="scope-type">Applies to</label>
            <select
              id="scope-type"
              value={state.scopeType}
              onChange={(e) => dispatch({ type: 'SET_SCOPE_TYPE', scopeType: e.target.value as typeof state.scopeType })}
            >
              {scopeTypeOptions.map((option) => (
                <option key={option} value={option}>
                  {SCOPE_TYPE_LABEL[option]}
                </option>
              ))}
            </select>
          </div>
        )}

        {state.scopeType === 'queue' && (
          <div className="rule-editor__field">
            <label htmlFor="queue-id">Queue</label>
            <select id="queue-id" value={state.queueId} onChange={(e) => dispatch({ type: 'SET_QUEUE_ID', queueId: e.target.value })}>
              {QUEUE_ID_OPTIONS.map((queueId) => (
                <option key={queueId} value={queueId}>
                  {queueId}
                </option>
              ))}
            </select>
          </div>
        )}

        {state.scopeType === 'agents' && (
          <div className="rule-editor__field">
            <span className="rule-editor__static-value">All my agents</span>
          </div>
        )}

        <div className="rule-editor__field">
          <label htmlFor="field">Condition</label>
          <select id="field" value={state.field} onChange={(e) => dispatch({ type: 'SET_FIELD', field: e.target.value as typeof state.field })}>
            {CONDITION_FIELD_OPTIONS.filter((option) => fieldOptions.includes(option.value)).map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {state.field === 'agent_state_duration_sec' && (
          <div className="rule-editor__field">
            <label htmlFor="state-filter">While in state</label>
            <select id="state-filter" value={state.stateFilter} onChange={(e) => dispatch({ type: 'SET_STATE_FILTER', stateFilter: e.target.value })}>
              {AGENT_STATE_OPTIONS.map((agentState) => (
                <option key={agentState} value={agentState}>
                  {agentState}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="rule-editor__row">
          <div className="rule-editor__field">
            <label htmlFor="operator">Operator</label>
            <select id="operator" value={state.operator} onChange={(e) => dispatch({ type: 'SET_OPERATOR', operator: e.target.value as typeof state.operator })}>
              {OPERATOR_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="rule-editor__field">
            <label htmlFor="threshold">Threshold ({unitLabelForField(state.field)})</label>
            <input
              id="threshold"
              type="number"
              value={state.threshold}
              onChange={(e) => dispatch({ type: 'SET_THRESHOLD', threshold: Number(e.target.value) })}
            />
          </div>
        </div>

        {!isDurationField(state.field) && (
          <div className="rule-editor__field">
            <label className="rule-editor__checkbox-label">
              <input
                type="checkbox"
                checked={state.useMinDuration}
                onChange={(e) => dispatch({ type: 'SET_USE_MIN_DURATION', useMinDuration: e.target.checked })}
              />
              Require condition held for a minimum duration
            </label>
            {state.useMinDuration && (
              <input
                type="number"
                aria-label="Minimum duration in seconds"
                value={state.minDurationSec}
                onChange={(e) => dispatch({ type: 'SET_MIN_DURATION_SEC', minDurationSec: Number(e.target.value) })}
              />
            )}
          </div>
        )}

        <div className="rule-editor__field">
          <label htmlFor="cooldown">Don't repeat for</label>
          <select id="cooldown" value={state.cooldownSec} onChange={(e) => dispatch({ type: 'SET_COOLDOWN_SEC', cooldownSec: Number(e.target.value) })}>
            {COOLDOWN_PRESETS_SEC.map((sec) => (
              <option key={sec} value={sec}>
                {sec / 60} minutes
              </option>
            ))}
          </select>
        </div>

        <div className="rule-editor__field">
          <label htmlFor="severity">Severity</label>
          <select id="severity" value={state.severity} onChange={(e) => dispatch({ type: 'SET_SEVERITY', severity: e.target.value as typeof state.severity })}>
            {SEVERITY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="rule-editor__field">
          <label className="rule-editor__checkbox-label">
            <input type="checkbox" checked={state.enabled} onChange={(e) => dispatch({ type: 'SET_ENABLED', enabled: e.target.checked })} />
            Enabled
          </label>
        </div>

        {mutationError && <p className="rule-editor__error">Couldn't save this rule. Try again.</p>}

        <div className="rule-editor__actions">
          <Button type="button" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={pending}>
            {rule ? 'Save rule' : 'Create rule'}
          </Button>
        </div>
      </form>
    </div>
  );
}
