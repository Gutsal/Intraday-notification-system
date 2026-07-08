import { describe, it, expect } from 'vitest';
import {
  buildRuleInput,
  defaultFormState,
  fieldOptionsForScope,
  isDurationField,
  ruleFormReducer,
  scopeTypeOptionsForRole,
  type RuleFormState,
} from './ruleFormReducer.ts';

// This is the real logic behind the RuleEditor, not presentation: the
// duration row's visibility and the scope-target field's shape both depend
// on other field selections (see design/reference/rule-editor-mockup.html's
// comments and testing-strategy SKILL.md's explicit call-out).
describe('ruleFormReducer — conditional field logic', () => {
  it('defaults a team lead to queue scope and a queue-level field', () => {
    const state = defaultFormState('team_lead');
    expect(state.scopeType).toBe('queue');
    expect(fieldOptionsForScope('queue')).toContain(state.field);
  });

  it('defaults an agent to self scope with only one scope option available', () => {
    const state = defaultFormState('agent');
    expect(state.scopeType).toBe('self');
    expect(scopeTypeOptionsForRole('agent')).toEqual(['self']);
  });

  it('resets the field when switching scope type away from a queue-only field', () => {
    const initial = defaultFormState('team_lead'); // scopeType: 'queue', field: 'sla_margin_sec'
    const next = ruleFormReducer(initial, { type: 'SET_SCOPE_TYPE', scopeType: 'agents' });

    // sla_margin_sec isn't a valid field for the 'agents' scope, so the
    // reducer must not leave the form in an invalid combination.
    expect(fieldOptionsForScope('agents')).not.toContain('sla_margin_sec');
    expect(fieldOptionsForScope('agents')).toContain(next.field);
  });

  it('keeps a still-valid field when switching scope type', () => {
    const state: RuleFormState = { ...defaultFormState('team_lead'), scopeType: 'agents', field: 'agent_state_duration_sec' };
    const next = ruleFormReducer(state, { type: 'SET_SCOPE_TYPE', scopeType: 'agents' });
    expect(next.field).toBe('agent_state_duration_sec');
  });

  it('forces useMinDuration off when switching to a duration-shaped field', () => {
    const state: RuleFormState = { ...defaultFormState('team_lead'), field: 'tickets_waiting', useMinDuration: true };
    const next = ruleFormReducer(state, { type: 'SET_FIELD', field: 'agent_state_duration_sec' });
    expect(isDurationField(next.field)).toBe(true);
    expect(next.useMinDuration).toBe(false);
  });

  it('allows useMinDuration to be toggled on for a non-duration field', () => {
    const state = defaultFormState('team_lead'); // field: 'sla_margin_sec'
    const next = ruleFormReducer(state, { type: 'SET_USE_MIN_DURATION', useMinDuration: true });
    expect(next.useMinDuration).toBe(true);
  });

  it('buildRuleInput: queue scope produces a single-queue scope', () => {
    const state: RuleFormState = { ...defaultFormState('team_lead'), scopeType: 'queue', queueId: 'vip' };
    const input = buildRuleInput(state, 'lead_1');
    expect(input.scope).toEqual({ queueIds: ['vip'] });
  });

  it("buildRuleInput: agents scope resolves to all owned queues, not a literal agent list", () => {
    const state: RuleFormState = { ...defaultFormState('team_lead'), scopeType: 'agents', field: 'agent_state_duration_sec' };
    const input = buildRuleInput(state, 'lead_1');
    expect(input.scope).toEqual({ queueIds: ['billing', 'tier_2', 'vip'] });
  });

  it('buildRuleInput: self scope resolves to the current owner as the sole agent', () => {
    const state = defaultFormState('agent');
    const input = buildRuleInput(state, 'a_19');
    expect(input.scope).toEqual({ agentIds: ['a_19'] });
  });

  it('buildRuleInput: stateFilter is only included for agent_state_duration_sec', () => {
    const durationState: RuleFormState = { ...defaultFormState('team_lead'), scopeType: 'agents', field: 'agent_state_duration_sec', stateFilter: 'on_call' };
    expect(buildRuleInput(durationState, 'lead_1').stateFilter).toBe('on_call');

    const otherState: RuleFormState = { ...defaultFormState('team_lead'), field: 'tickets_waiting' };
    expect(buildRuleInput(otherState, 'lead_1').stateFilter).toBeUndefined();
  });

  it('buildRuleInput: minDurationSec is only included when useMinDuration is on for a non-duration field', () => {
    const state: RuleFormState = {
      ...defaultFormState('team_lead'),
      field: 'tickets_waiting',
      useMinDuration: true,
      minDurationSec: 300,
    };
    expect(buildRuleInput(state, 'lead_1').minDurationSec).toBe(300);

    const withoutToggle: RuleFormState = { ...state, useMinDuration: false };
    expect(buildRuleInput(withoutToggle, 'lead_1').minDurationSec).toBeUndefined();
  });
});
