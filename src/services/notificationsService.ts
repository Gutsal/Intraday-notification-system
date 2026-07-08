import type { Notification } from '../domain/notification.ts';

// DEMO: in-memory notification log, no persistence (resets on restart —
// same tradeoff as RulesService). replaceAll() backs POST /replay: each
// replay run evaluates the full event stream fresh (its own
// StateTracker/Dedup), so re-running it should reflect "what the current
// rule set would produce against the sample data" rather than appending
// duplicates on top of a previous run's output.
export class NotificationsService {
  // Indexed by recipientId rather than one flat array — list(recipientId)
  // is on the hot path (every GET /notifications call, polled every 5s per
  // viewer) and shouldn't scan every notification ever fired by every
  // customer to find one recipient's slice of it.
  private byRecipient = new Map<string, Notification[]>();

  replaceAll(notifications: Notification[]): void {
    const sorted = [...notifications].sort((a, b) => new Date(b.firedAt).getTime() - new Date(a.firedAt).getTime());
    const next = new Map<string, Notification[]>();
    for (const notification of sorted) {
      const bucket = next.get(notification.recipientId);
      if (bucket) bucket.push(notification);
      else next.set(notification.recipientId, [notification]);
    }
    this.byRecipient = next;
  }

  // No default/global fallback — every caller supplies recipientId
  // explicitly (enforced by the route's Zod schema).
  list(recipientId: string): Notification[] {
    return this.byRecipient.get(recipientId) ?? [];
  }
}
