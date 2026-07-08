import { z } from 'zod';
import { SeveritySchema } from './rule.ts';

export const NotificationSchema = z.object({
  id: z.string(),
  ruleId: z.string(),
  recipientId: z.string(),
  severity: SeveritySchema, // matches Assembled's real Realtime Analysis Thresholds vocabulary
  firedAt: z.string(), // ISO timestamp, simulated clock
  message: z.string(), // human-readable, includes the "why" (values that triggered it)
  context: z.record(z.string(), z.unknown()), // raw values for debugging/audit
});
export type Notification = z.infer<typeof NotificationSchema>;
