import type { Notification } from '../domain/notification.ts';

// Stub delivery: real Slack/email/push integration is explicitly out of
// scope (see CLAUDE.md) — this just logs to the console and keeps an
// in-memory array so the API layer / replay output has something to read.
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
