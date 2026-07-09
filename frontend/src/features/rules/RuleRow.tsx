import { AGENT_STATE_LABELS, CONDITION_FIELD_LABELS, QUEUE_LABELS, type Rule } from '../../domain/rule.ts';
import { Badge } from '../../components/Badge.tsx';
import { Button } from '../../components/Button.tsx';
import { formatDurationSec } from '../../utils/formatDuration.ts';
import { isDurationField } from './ruleFormReducer.ts';
import './RuleRow.scss';

interface RuleRowProps {
  rule: Rule;
  onEdit: (rule: Rule) => void;
}

function scopeLabel(rule: Rule): string {
  // buildRuleInput's "self" scope always sets agentIds to [ownerId] — the
  // one case worth a friendly label instead of the raw id, matching the
  // editor's own "Myself" option (see ruleFormReducer.ts's ScopeType).
  if (rule.scope.agentIds?.length === 1 && rule.scope.agentIds[0] === rule.ownerId) return 'Myself';
  if (rule.scope.agentIds?.length) return rule.scope.agentIds.join(', ');
  if (rule.scope.queueIds?.length === 1) return QUEUE_LABELS[rule.scope.queueIds[0]] ?? rule.scope.queueIds[0];
  if (rule.scope.queueIds?.length) return 'my agents';
  return 'unscoped';
}

function conditionLabel(rule: Rule): string {
  const value = isDurationField(rule.field) ? formatDurationSec(rule.threshold) : rule.threshold;
  const stateNote = rule.stateFilter ? ` while ${AGENT_STATE_LABELS[rule.stateFilter] ?? rule.stateFilter}` : '';
  const fieldLabel = CONDITION_FIELD_LABELS[rule.field];
  return `${fieldLabel}${stateNote} ${rule.operator} ${value}`;
}

// Pure presentational — one row, no data fetching. Editing (including
// disabling) goes through the same RuleEditor as create; there's no
// separate toggle endpoint or delete action (see domain/rule.ts).
// Grid columns (severity / scope / condition / cooldown / status / edit)
// are fixed-width at tablet-up so every row's fields line up vertically
// like a table — see RuleRow.scss and css-best-practices SKILL.md's Grid
// guidance. Each column gets its own element (even the conditionally-empty
// status one) so a missing "disabled" badge doesn't shift the edit button.
export function RuleRow({ rule, onEdit }: RuleRowProps) {
  return (
    <li className={`rule-row${rule.enabled ? '' : ' rule-row--disabled'}`}>
      <span className="rule-row__severity">
        <Badge tone={rule.severity}>{rule.severity}</Badge>
      </span>
      <span className="rule-row__scope">{scopeLabel(rule)}</span>
      <span className="rule-row__condition">{conditionLabel(rule)}</span>
      <span className="rule-row__cooldown">cooldown {formatDurationSec(rule.cooldownSec)}</span>
      <span className="rule-row__status">{!rule.enabled && <Badge tone="neutral">disabled</Badge>}</span>
      <Button type="button" className="rule-row__edit" onClick={() => onEdit(rule)}>
        Edit
      </Button>
    </li>
  );
}
