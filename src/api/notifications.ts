import { Router } from 'express';
import { z } from 'zod';
import type { NotificationsService } from '../services/notificationsService.ts';
import { apiError, apiSuccess } from './response.ts';

const ListNotificationsQuerySchema = z.object({ recipientId: z.string().min(1) });

// GET /notifications?recipientId= — recent feed, newest first, filtered to
// the current "viewing as" identity. No pagination: fine at this data
// volume (a single replay's worth of notifications), would add
// cursor-based pagination before scaling past a few thousand rows.
export function notificationsRouter(service: NotificationsService): Router {
  const router = Router();

  router.get('/', (req, res) => {
    const parsed = ListNotificationsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json(apiError('invalid_request', parsed.error.flatten()));
      return;
    }
    res.json(apiSuccess({ notifications: service.list(parsed.data.recipientId) }));
  });

  return router;
}
