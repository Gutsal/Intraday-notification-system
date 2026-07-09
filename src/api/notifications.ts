import { Router } from 'express';
import { z } from 'zod';
import type { NotificationsService } from '../services/notificationsService.ts';
import { apiError, apiSuccess } from './response.ts';

const ListNotificationsQuerySchema = z.object({
  recipientId: z.string().min(1),
  limit: z.coerce.number().int().positive().optional(),
  before: z.string().optional(), // opaque cursor: the last notification id from the previous page
});

// GET /notifications?recipientId=&limit=&before= — keyset-paginated feed,
// newest first, filtered to the current "viewing as" identity. Cursor-based
// rather than offset-based so a page fetch stays correct even if
// replaceAll() rewrites the underlying data between requests.
export function notificationsRouter(service: NotificationsService): Router {
  const router = Router();

  router.get('/', (req, res) => {
    const parsed = ListNotificationsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json(apiError('invalid_request', parsed.error.flatten()));
      return;
    }
    const { recipientId, limit, before } = parsed.data;
    res.json(apiSuccess(service.list(recipientId, { limit, before })));
  });

  return router;
}
