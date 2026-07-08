import express from 'express';
import cors from 'cors';

import { SEED_RULES } from './domain/seedRules.ts';
import { RulesService } from './services/rulesService.ts';
import { NotificationsService } from './services/notificationsService.ts';
import { rulesRouter } from './api/rules.ts';
import { notificationsRouter } from './api/notifications.ts';
import { identitiesRouter } from './api/identities.ts';
import { apiSuccess } from './api/response.ts';
import { loadEvents, replay } from './ingestion/replay.ts';

const app = express();

// Permissive dev-only CORS for the Vite frontend's origin — no
// auth/multi-tenancy to protect here, so this doesn't need to be a
// production-grade policy (api-design SKILL.md #9). Matches any localhost
// port rather than hardcoding 5173: Vite auto-increments to 5174/5175/...
// if the default port is already taken by another running instance.
const LOCALHOST_ORIGIN = /^http:\/\/localhost:\d+$/;
app.use(
  cors({
    origin: (origin, callback) => {
      callback(null, !origin || LOCALHOST_ORIGIN.test(origin));
    },
  }),
);
app.use(express.json());

const rulesService = new RulesService(SEED_RULES);
const notificationsService = new NotificationsService();

// Each run replays the full event stream fresh against whatever rules
// currently exist, so editing/disabling a rule and re-running reflects
// that change rather than reusing stale engine state.
function runReplay(): number {
  const events = loadEvents();
  const { notifications } = replay(events, rulesService.listAll());
  notificationsService.replaceAll(notifications);
  return notifications.length;
}

app.use('/rules', rulesRouter(rulesService));
app.use('/notifications', notificationsRouter(notificationsService));
app.use('/identities', identitiesRouter());

// Optional per the spec — kicks off the events.jsonl replay against
// current rules. Also run once at boot below so the feed isn't empty the
// first time the frontend loads.
app.post('/replay', (_req, res) => {
  const count = runReplay();
  res.json(apiSuccess({ notificationCount: count }));
});

const notificationCount = runReplay();
console.log(`Seeded ${notificationCount} notification(s) from the initial replay.`);

const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;
app.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`);
});
