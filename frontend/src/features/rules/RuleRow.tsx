import type { Rule } from '../../domain/rule.ts';
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
  if (rule.scope.agentIds?.length) return rule.scope.agentIds.join(', ');
  if (rule.scope.queueIds?.length === 1) return rule.scope.queueIds[0];
  if (rule.scope.queueIds?.length) return 'my agents';
  return 'unscoped';
}

function conditionLabel(rule: Rule): string {
  const value = isDurationField(rule.field) ? formatDurationSec(rule.threshold) : rule.threshold;
  const stateNote = rule.stateFilter ? ` while ${rule.stateFilter}` : '';
  return `${rule.field}${stateNote} ${rule.operator} ${value}`;
}

// Pure presentational — one row, no data fetching. Editing (including
// disabling) goes through the same RuleEditor as create; there's no
// separate toggle endpoint or delete action (see domain/rule.ts).
export function RuleRow({ rule, onEdit }: RuleRowProps) {
  return (
    <li className={`rule-row${rule.enabled ? '' : ' rule-row--disabled'}`}>
      <div className="rule-row__summary">
        <Badge tone={rule.severity}>{rule.severity}</Badge>
        <span className="rule-row__scope">{scopeLabel(rule)}</span>
        <span className="rule-row__condition">{conditionLabel(rule)}</span>
        <span className="rule-row__cooldown">cooldown {formatDurationSec(rule.cooldownSec)}</span>
        {!rule.enabled && <Badge tone="neutral">disabled</Badge>}
      </div>
      <Button type="button" onClick={() => onEdit(rule)}>
        Edit
      </Button>
    </li>
  );
}
