// Standard response envelope (api-design SKILL.md #4) — every route returns
// one of these two shapes, never a bare object or a raw Zod error.
export interface ApiSuccess<T> {
  ok: true;
  data: T;
}

export interface ApiError {
  ok: false;
  error: string;
  details?: unknown;
}

export function apiSuccess<T>(data: T): ApiSuccess<T> {
  return { ok: true, data };
}

export function apiError(error: string, details?: unknown): ApiError {
  return { ok: false, error, details };
}
