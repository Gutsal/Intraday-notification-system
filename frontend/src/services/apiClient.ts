import type { Identity } from '../domain/identity.ts';
import type { Rule, RuleInput } from '../domain/rule.ts';
import type { Notification } from '../domain/notification.ts';

// Dev-only: the backend runs on a fixed local port. Would become an env
// var before this ever pointed at a real deployment.
const API_BASE_URL = 'http://localhost:3001';

interface ApiSuccessBody<T> {
  ok: true;
  data: T;
}
interface ApiErrorBody {
  ok: false;
  error: string;
  details?: unknown;
}

export class ApiRequestError extends Error {
  readonly code: string;
  readonly details?: unknown;

  constructor(code: string, details?: unknown) {
    super(code);
    this.name = 'ApiRequestError';
    this.code = code;
    this.details = details;
  }
}

// Every response is validated against the {ok, data|error} envelope shape
// before its payload is trusted as typed data — the lightweight trust-
// boundary check called for by react-typescript-best-practices SKILL.md,
// rather than a full per-field Zod schema (the backend and frontend are
// built together for this take-home, so the deeper validation cost isn't
// worth it here; would add Zod parsing here first if this client ever
// talked to a service outside this repo).
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  const body = (await res.json()) as ApiSuccessBody<T> | ApiErrorBody;
  if (!body.ok) {
    throw new ApiRequestError(body.error, body.details);
  }
  return body.data;
}

export async function fetchIdentities(): Promise<Identity[]> {
  const { identities } = await request<{ identities: Identity[] }>('/identities');
  return identities;
}

export async function fetchRules(ownerId: string): Promise<Rule[]> {
  const { rules } = await request<{ rules: Rule[] }>(`/rules?ownerId=${encodeURIComponent(ownerId)}`);
  return rules;
}

export async function createRule(input: RuleInput): Promise<Rule> {
  const { rule } = await request<{ rule: Rule }>('/rules', { method: 'POST', body: JSON.stringify(input) });
  return rule;
}

export async function updateRule(id: string, input: RuleInput): Promise<Rule> {
  const { rule } = await request<{ rule: Rule }>(`/rules/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
  return rule;
}

export interface NotificationsPage {
  notifications: Notification[];
  nextCursor: string | null;
}

export async function fetchNotifications(
  recipientId: string,
  options: { limit?: number; cursor?: string } = {},
): Promise<NotificationsPage> {
  const params = new URLSearchParams({ recipientId });
  if (options.limit) params.set('limit', String(options.limit));
  if (options.cursor) params.set('before', options.cursor);
  return request<NotificationsPage>(`/notifications?${params.toString()}`);
}

// DEMO: reprocesses the fixed data/events.jsonl sample against
// whatever rules exist right now. Stands in for not having a live event
// stream — see ReplaySampleDataButton.tsx for the full context.
export function triggerReplay(): Promise<{ notificationCount: number }> {
  return request<{ notificationCount: number }>('/replay', { method: 'POST' });
}
