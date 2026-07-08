import type { Rule } from './rule.ts';

const OWNED_QUEUE_IDS = ['billing', 'tier_2', 'vip'];

// DEMO: seed data standing in for rules a team lead/agent would actually
// create through the UI over time — this file's only job is to seed
// RulesService (see server.ts) with something to demo on boot. Rules
// created via the real POST /rules flow don't touch this file at all.
// Values from the spec's "Seed rules to ship" section, mirroring the
// prompt's own examples and confirmed real triggers in data/events.jsonl.
// cooldownSec values for rules 2/3/4 aren't specified in the spec (only
// rules 1/1b give an explicit 10-min cooldown) — picked 10 min for the
// other sustained-condition alerts (adherence, ticket backlog) to match
// that cadence, and 15 min for the long-call warning since it's normally a
// one-shot escalate-and-wait signal, not something worth re-nagging every
// 10 minutes while the call continues.
export const SEED_RULES: Rule[] = [
  {
    id: 'rule-1',
    ownerId: 'lead_1',
    recipientId: 'lead_1',
    scope: { queueIds: ['billing'] },
    field: 'sla_margin_sec',
    operator: '>',
    threshold: 0,
    cooldownSec: 600,
    severity: 'danger',
    enabled: true,
  },
  {
    id: 'rule-1b',
    ownerId: 'lead_1',
    recipientId: 'lead_1',
    scope: { queueIds: ['billing'] },
    field: 'sla_margin_sec',
    operator: '>',
    threshold: -30,
    cooldownSec: 600,
    severity: 'warning',
    enabled: true,
  },
  {
    id: 'rule-2',
    ownerId: 'lead_1',
    recipientId: 'lead_1',
    scope: { queueIds: OWNED_QUEUE_IDS },
    field: 'agent_state_duration_sec',
    stateFilter: 'on_call',
    operator: '>',
    threshold: 2700,
    cooldownSec: 900,
    severity: 'warning',
    enabled: true,
  },
  {
    id: 'rule-3',
    ownerId: 'a_19',
    recipientId: 'a_19',
    scope: { agentIds: ['a_19'] },
    field: 'adherence_violation_duration_sec',
    operator: '>',
    threshold: 600,
    cooldownSec: 600,
    severity: 'warning',
    enabled: true,
  },
  {
    id: 'rule-4',
    ownerId: 'lead_1',
    recipientId: 'lead_1',
    scope: { queueIds: OWNED_QUEUE_IDS },
    field: 'tickets_waiting',
    operator: '>',
    threshold: 20,
    cooldownSec: 600,
    severity: 'danger',
    enabled: true,
  },
];
