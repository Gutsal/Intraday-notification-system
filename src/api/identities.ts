import { Router } from 'express';
import { SEED_IDENTITIES } from '../domain/identity.ts';
import { apiSuccess } from './response.ts';

// GET /identities — the two seed identities for the Viewing As dropdown.
// Trivial now (a hardcoded array), but modeling it as its own endpoint
// rather than a frontend constant is what makes swapping in real auth
// later a non-rewrite.
export function identitiesRouter(): Router {
  const router = Router();

  router.get('/', (_req, res) => {
    res.json(apiSuccess({ identities: SEED_IDENTITIES }));
  });

  return router;
}
