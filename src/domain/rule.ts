import { z } from 'zod';

export const ConditionFieldSchema = z.enum([
  'sla_margin_sec', // derived: longest_wait_sec - sla_target_sec, from queue_snapshot
  'tickets_waiting', // queue_snapshot
  'adherence_violation_duration_sec', // derived from adherence_check
  'agent_state_duration_sec', // derived from open agent state + scheduler tick
]);
export type ConditionField = z.infer<typeof ConditionFieldSchema>;

export const OperatorSchema = z.enum(['>', '>=', '=']);
export type Operator = z.infer<typeof OperatorSchema>;

export const SeveritySchema = z.enum(['warning', 'danger']);
export type Severity = z.infer<typeof SeveritySchema>;

// Every domain entity that would eventually belong to a customer/org carries
// an explicit scoping field (ownerId/recipientId here) even though
// multi-tenancy plumbing itself is out of scope — see api-design SKILL.md #5.
export const RuleScopeSchema = z
  .object({
    queueIds: z.array(z.string()).optional(),
    agentIds: z.array(z.string()).optional(),
  })
  .refine((scope) => Boolean(scope.queueIds?.length) || Boolean(scope.agentIds?.length), {
    message: 'scope must specify at least one queueId or agentId',
  });
export type RuleScope = z.infer<typeof RuleScopeSchema>;

export const RuleSchema = z
  .object({
    id: z.string(),
    ownerId: z.string(),
    recipientId: z.string(),
    scope: RuleScopeSchema,
    field: ConditionFieldSchema,
    // Only meaningful when field === 'agent_state_duration_sec'. The spec's
    // seed rule ("on a call over 45 min") needs to restrict which open
    // agent state the duration measures — without this, the field would
    // fire on any sustained state (available/on_break/offline included),
    // conflating unrelated signals under one rule. Not part of the spec's
    // literal Rule interface; added deliberately to make that rule
    // expressible. See CLAUDE.md/README for the note on this addition.
    stateFilter: z.string().optional(),
    operator: OperatorSchema,
    threshold: z.number(),
    minDurationSec: z.number().nonnegative().optional(),
    cooldownSec: z.number().nonnegative(),
    severity: SeveritySchema,
    enabled: z.boolean(),
  })
  .refine((rule) => rule.field === 'agent_state_duration_sec' || rule.stateFilter === undefined, {
    message: 'stateFilter is only valid when field is agent_state_duration_sec',
    path: ['stateFilter'],
  });
export type Rule = z.infer<typeof RuleSchema>;

// Same shape backs both POST /rules (create) and PATCH /rules/:id (full
// edit) — the RuleEditor form always submits the complete rule body, per the
// spec's "no separate narrow toggle endpoint" decision.
export const RuleInputSchema = RuleSchema.omit({ id: true });
export type RuleInput = z.infer<typeof RuleInputSchema>;
