import type { Notification } from '../domain/notification.ts';

// In-memory notification log. replaceAll() backs POST /replay: each replay
// run evaluates the full event stream fresh (its own StateTracker/Dedup),
// so re-running it should reflect "what the current rule set would produce
// against the sample data" rather than appending duplicates on top of a
// previous run's output.
export class NotificationsService {
  private notifications: Notification[] = [];

  replaceAll(notifications: Notification[]): void {
    this.notifications = [...notifications].sort(
      (a, b) => new Date(b.firedAt).getTime() - new Date(a.firedAt).getTime(),
    );
  }

  // No default/global fallback — every caller supplies recipientId
  // explicitly (enforced by the route's Zod schema).
  list(recipientId: string): Notification[] {
    return this.notifications.filter((notification) => notification.recipientId === recipientId);
  }
}
