import type { Notification } from '../domain/notification.ts';

export interface NotificationPage {
  notifications: Notification[];
  // Opaque cursor (the last-in-page notification's id) for the next
  // GET /notifications?...&before= call; null once there's nothing older
  // left. Keyset pagination off recipientId's already-sorted array, not
  // offset-based — stable even while replaceAll() rewrites the underlying
  // data between page fetches.
  nextCursor: string | null;
}

const DEFAULT_PAGE_LIMIT = 30;
const MAX_PAGE_LIMIT = 200;

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
  // explicitly (enforced by the route's Zod schema). Paginated rather than
  // returning the full list: at real scale a recipient's history could be
  // enormous, and this is the boundary that actually matters — bounding
  // what ever leaves the server, not just how the client renders it.
  list(recipientId: string, options: { limit?: number; before?: string } = {}): NotificationPage {
    const all = this.byRecipient.get(recipientId) ?? [];
    const limit = Math.min(options.limit ?? DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT);

    let startIndex = 0;
    if (options.before) {
      const cursorIndex = all.findIndex((n) => n.id === options.before);
      // Unknown/stale cursor (e.g. the referenced notification aged out) —
      // fail closed to "no more results" rather than silently restarting
      // from the top, which would re-show already-seen pages.
      if (cursorIndex === -1) return { notifications: [], nextCursor: null };
      startIndex = cursorIndex + 1;
    }

    const page = all.slice(startIndex, startIndex + limit);
    const hasMore = startIndex + limit < all.length;
    const nextCursor = hasMore ? page[page.length - 1].id : null;

    return { notifications: page, nextCursor };
  }
}
