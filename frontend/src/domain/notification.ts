import type { Severity } from './rule.ts';

// Mirrors backend/src/domain/notification.ts — see rule.ts's header comment
// for why this is duplicated rather than imported.
export interface Notification {
  id: string;
  ruleId: string;
  recipientId: string;
  severity: Severity;
  firedAt: string;
  message: string;
  context: Record<string, unknown>;
}
