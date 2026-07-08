import { Router } from 'express';
import { z } from 'zod';
import { RuleInputSchema } from '../domain/rule.ts';
import type { RulesService } from '../services/rulesService.ts';
import { apiError, apiSuccess } from './response.ts';

const ListRulesQuerySchema = z.object({ ownerId: z.string().min(1) });

// GET/POST /rules, PATCH /rules/:id — no DELETE (see domain/rule.ts:
// disabling is the only removal path so Notification.ruleId never dangles).
export function rulesRouter(service: RulesService): Router {
  const router = Router();

  router.get('/', (req, res) => {
    const parsed = ListRulesQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json(apiError('invalid_request', parsed.error.flatten()));
      return;
    }
    res.json(apiSuccess({ rules: service.list(parsed.data.ownerId) }));
  });

  router.post('/', (req, res) => {
    const parsed = RuleInputSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json(apiError('invalid_request', parsed.error.flatten()));
      return;
    }
    const rule = service.create(parsed.data);
    res.status(201).json(apiSuccess({ rule }));
  });

  router.patch('/:id', (req, res) => {
    const parsed = RuleInputSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json(apiError('invalid_request', parsed.error.flatten()));
      return;
    }
    const rule = service.update(req.params.id, parsed.data);
    if (!rule) {
      res.status(404).json(apiError('not_found'));
      return;
    }
    res.json(apiSuccess({ rule }));
  });

  return router;
}
