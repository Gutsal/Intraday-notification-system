import { z } from 'zod';

// Schemas for the three event types in data/events.jsonl. Nullability here
// is defensive against real gaps observed in the sample data, not just the
// documented ones: besides violation_started_at (spec'd as nullable),
// queue_ids and volume_forecast_next_15m are also null on at least one
// event each in the 96-event sample.

export const QueueSnapshotSchema = z.object({
  event_id: z.string(),
  ts: z.string(),
  type: z.literal('queue_snapshot'),
  queue_id: z.string(),
  tickets_waiting: z.number(),
  longest_wait_sec: z.number(),
  sla_target_sec: z.number(),
  agents_available: z.number(),
  agents_on_call: z.number(),
  volume_last_15m: z.number(),
  volume_forecast_next_15m: z.number().nullable(),
});
export type QueueSnapshot = z.infer<typeof QueueSnapshotSchema>;

export const AgentStateChangeSchema = z.object({
  event_id: z.string(),
  ts: z.string(),
  type: z.literal('agent_state_change'),
  agent_id: z.string(),
  queue_ids: z.array(z.string()).nullable(),
  previous_state: z.string().nullable(),
  previous_state_duration_sec: z.number().nullable(),
  new_state: z.string(),
});
export type AgentStateChange = z.infer<typeof AgentStateChangeSchema>;

export const AdherenceCheckSchema = z.object({
  event_id: z.string(),
  ts: z.string(),
  type: z.literal('adherence_check'),
  agent_id: z.string(),
  queue_ids: z.array(z.string()).nullable(),
  scheduled_state: z.string(),
  actual_state: z.string(),
  in_violation: z.boolean(),
  violation_started_at: z.string().nullable(),
});
export type AdherenceCheck = z.infer<typeof AdherenceCheckSchema>;

export const EventSchema = z.discriminatedUnion('type', [
  QueueSnapshotSchema,
  AgentStateChangeSchema,
  AdherenceCheckSchema,
]);
export type Event = z.infer<typeof EventSchema>;
