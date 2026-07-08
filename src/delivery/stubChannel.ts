import type { Notification } from '../domain/notification.ts';

// DEMO: stub delivery channel — real Slack/email/push integration is
// explicitly out of scope. A production channel would call out to an
// external API here; this just logs to the console and keeps an in-memory
// array so the API layer / replay output has something to read.
export class StubChannel {
  private readonly log: Notification[] = [];

  send(notification: Notification): void {
    this.log.push(notification);
    console.log(`[${notification.severity}] -> ${notification.recipientId}: ${notification.message}`);
  }

  getLog(): readonly Notification[] {
    return this.log;
  }
}
