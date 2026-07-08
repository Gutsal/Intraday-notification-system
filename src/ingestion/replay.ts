import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { EventSchema, type Event } from '../domain/events.ts';
import { SEED_RULES } from '../domain/seedRules.ts';
import type { Rule } from '../domain/rule.ts';
import type { Notification } from '../domain/notification.ts';
import { StateTracker } from '../engine/stateTracker.ts';
import { Dedup } from '../engine/dedup.ts';
import {
  ConditionPersistence,
  evaluate,
  candidatesForQueueSnapshot,
  candidateForAdherenceCheck,
  candidateForClosedAgentState,
} from '../engine/ruleEngine.ts';
import { Scheduler } from '../engine/scheduler.ts';
import { SimulatedClock } from '../engine/clock.ts';
import { StubChannel } from '../delivery/stubChannel.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const DEFAULT_EVENTS_PATH = join(__dirname, '../../data/events.jsonl');

// Reads events.jsonl and replays in ts order — the file itself isn't
// reliably sorted (evt_01HXYZ050 appears twice, 30s apart, with the second
// occurrence out of chronological position near the end of the file), so
// this sorts explicitly rather than trusting file order. Duplicate
// event_ids are also dropped defensively (idempotency-key guard, per
// api-design SKILL.md's request-dedup guidance) — harmless here since
// state updates are idempotent, but it's the same category of "replayed
// event" the guidance is about.
export function loadEvents(path: string = DEFAULT_EVENTS_PATH): Event[] {
  const raw = readFileSync(path, 'utf-8');
  const lines = raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const events: Event[] = [];
  const seenEventIds = new Set<string>();

  for (const [index, line] of lines.entries()) {
    let json: unknown;
    try {
      json = JSON.parse(line);
    } catch {
      console.warn(`Skipping unparsable line ${index + 1}`);
      continue;
    }

    const parsed = EventSchema.safeParse(json);
    if (!parsed.success) {
      console.warn(`Skipping invalid event on line ${index + 1}: ${parsed.error.message}`);
      continue;
    }

    if (seenEventIds.has(parsed.data.event_id)) {
      console.warn(`Skipping duplicate event_id ${parsed.data.event_id} on line ${index + 1}`);
      continue;
    }
    seenEventIds.add(parsed.data.event_id);
    events.push(parsed.data);
  }

  events.sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());
  return events;
}

export interface ReplayResult {
  notifications: Notification[];
  channel: StubChannel;
}

export function replay(events: Event[], rules: Rule[] = SEED_RULES): ReplayResult {
  const channel = new StubChannel();
  const notifications: Notification[] = [];
  if (events.length === 0) return { notifications, channel };

  const deliver = (batch: Notification[]): void => {
    for (const notification of batch) {
      channel.send(notification);
      notifications.push(notification);
    }
  };

  const clock = new SimulatedClock(new Date(events[0].ts));
  const tracker = new StateTracker();
  const dedup = new Dedup();
  const persistence = new ConditionPersistence();
  const scheduler = new Scheduler(clock.now());

  for (const event of events) {
    clock.set(new Date(event.ts));

    // Catch any 30s-cadence scheduler ticks that fall between the previous
    // event and this one, before this event's own effect is processed.
    deliver(scheduler.advanceTo(clock.now(), rules, tracker, dedup, persistence));

    switch (event.type) {
      case 'queue_snapshot': {
        const metrics = tracker.recordQueueSnapshot(event);
        for (const candidate of candidatesForQueueSnapshot(metrics)) {
          deliver(evaluate(rules, candidate, dedup, persistence));
        }
        break;
      }
      case 'adherence_check': {
        const status = tracker.recordAdherenceCheck(event);
        deliver(evaluate(rules, candidateForAdherenceCheck(status), dedup, persistence));
        break;
      }
      case 'agent_state_change': {
        const closedCandidate = candidateForClosedAgentState(event);
        if (closedCandidate) {
          deliver(evaluate(rules, closedCandidate, dedup, persistence));
        }
        tracker.recordAgentStateChange(event);
        break;
      }
    }
  }

  return { notifications, channel };
}

const isMainModule = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
  const events = loadEvents();
  console.log(`Loaded ${events.length} events from ${DEFAULT_EVENTS_PATH}\n`);
  const { notifications } = replay(events);
  console.log(`\nReplay complete: ${notifications.length} notification(s) fired.`);
}
