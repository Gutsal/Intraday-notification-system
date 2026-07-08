# Intraday Notification System (Assembled take-home)

## 1. Audience & scope decision

The primary audience is the **team lead**: they own multiple queues and
multiple agents, so their rules are genuinely conditional — "the billing
queue breaches SLA," or "any of my agents is on a call too long." That's
where rule configuration is actually product-interesting, because the rule
has to resolve against a set (agents under a queue), not a single fixed
target.

**Agent** is a thin secondary example: one rule, one condition (their own
adherence drift). It's enough to show the model generalizes across
audiences without building a second full experience around it.

**Head of support is explicitly out of scope.** Their need — "give me a
summary, don't page me unless something's on fire" — is a digest/aggregation
problem, not a rule-evaluation one. Building a half version of that would
read as unscoped rather than scoped, so it's cut and named here instead.

## 2. Architecture

```
data/events.jsonl
      │  read, sorted by ts (file order isn't reliable — see note below),
      │  deduped by event_id
      ▼
ingestion/replay.ts ────────────────────────────┐
      │ per event, clock.set(event.ts)           │ before each event, sweep
      ▼                                          │ any 30s ticks that fall
engine/stateTracker.ts                           │ between it and the last
  - queue metrics (sla_margin_sec, tickets)       │ event — independent of
  - open agent states {agentId, state, since}     │ whether an event arrives
  - adherence violation windows                   ▼
      │                                   engine/scheduler.ts
      ▼                                   (sweeps every open agent state)
engine/ruleEngine.ts  ◄───────────────────────────┘
  evaluate(rules, candidate):
    field match → scope match ("my agents"/"my queues")
    → operator/threshold check → minDurationSec persistence gate
      │
      ▼
engine/dedup.ts (cooldownSec suppression, keyed per rule + entity)
      │
      ▼
delivery/stubChannel.ts (console log + in-memory array — no real
Slack/email/push; that's stubbed intentionally, see Out of scope)
      │
      ▼
NotificationsService (in-memory) ◄── RulesService (in-memory, seeded from
      │                                domain/seedRules.ts, mutated via
      ▼                                POST/PATCH /rules)
GET /notifications?recipientId=   GET/POST /rules, PATCH /rules/:id
      │                                  │
      └──────────────┬───────────────────┘
                      ▼
         frontend/ (Vite/React, polls both endpoints)
         ViewingAsSwitcher → NotificationFeed + RuleList
```

`ruleEngine.evaluate()` is the single function both triggers funnel through
— an incoming `queue_snapshot`/`adherence_check`/`agent_state_change` event
and a scheduler tick both just produce an `EvaluationCandidate`, so there's
one matching/dedup/persistence code path, not two.

`POST /replay` (and an automatic run at server boot) re-runs the full event
stream fresh against whatever rules currently exist in `RulesService` — so
editing or disabling a rule and re-triggering replay reflects that change
rather than reusing stale engine state from a previous run.

## 3. The event-driven vs. scheduled-evaluation tradeoff

`queue_snapshot` and `adherence_check` events are polled on a cadence and
carry their own duration context, so a rule on those fields can be
evaluated correctly the moment a new event arrives.

`agent_state_change` is different: it fires only on transition, and a
state's duration (`previous_state_duration_sec`) is only reported on the
*next* transition — after the state has already ended. A rule like "agent
on a call over 45 minutes" can't be caught by reacting to events alone: by
the time the transition-out event shows up, the call is already over.

The rejected alternative was staying purely event-reactive and accepting
that long-running-state rules would only fire retroactively, after the
fact. That's not good enough for a monitoring system — the whole point is
catching it while it's still happening. So the engine also runs a
**periodic scheduler tick** (`scheduler.ts`, simulated every 30s of
event-stream time) that sweeps every currently *open* agent state against
elapsed duration, independent of whether any event arrived.

The real data proves this matters: replaying `events.jsonl`, agent `a_11`
goes `on_call` at 09:10:00 and doesn't transition out until 10:20:00 — a
70-minute call. `a_07` and `a_31` show the same pattern. **None of the
three ever produce a transition-out event within the sample window**, so a
purely event-reactive engine would never have flagged them at all, not
even late. The scheduler sweep catches all three while the calls are still
in progress — see `tests/scheduler.test.ts`.

This also generalizes to "thousands of agents, millions of events/day"
better than it might look: it's a timer sweep over one indexed table
(`{agentId, state, since}`), not a scan over event history.

## 4. Data model

```ts
interface Rule {
  id: string;
  ownerId: string;                 // team lead or agent this rule belongs to
  recipientId: string;             // usually === ownerId
  scope: { queueIds?: string[]; agentIds?: string[] };
  field: ConditionField;
  stateFilter?: string;            // only meaningful with agent_state_duration_sec
  operator: '>' | '>=' | '=';
  threshold: number;
  minDurationSec?: number;         // gates WHETHER a condition counts
  cooldownSec: number;             // gates HOW OFTEN it can re-fire
  severity: 'warning' | 'danger';
  enabled: boolean;
}
```

- **`scope`** is queue-based or agent-based. A team lead's "any of my
  agents" rule is expressed as `scope.queueIds` — the engine resolves which
  agents that means by checking each agent's own `queue_ids` against the
  rule's owned queues, not from a hand-maintained roster. That's the same
  mechanism that lets it generalize past "one team lead owns everything."
- **`stateFilter`** is a deliberate addition beyond the original spec. The
  spec describes seed rule 2 as "`agent_state_duration_sec > 2700` while
  `state == on_call`," but the `Rule` shape as originally specified has no
  field to express "while state == X" — without one, that condition would
  fire on *any* sustained state (available, on_break, offline...), not
  specifically calls. Flagged and confirmed before implementing rather than
  silently picking an interpretation.
- **`minDurationSec` vs. `cooldownSec`** do two different jobs, easy to
  conflate: `minDurationSec` gates whether a condition counts in the first
  place ("tickets_waiting > 20 for more than 10 minutes" — a debounce on
  the raw condition). `cooldownSec` gates how often an already-firing rule
  is allowed to notify again, so a sustained breach doesn't spam a
  notification on every single snapshot.
- **`enabled`**, not `DELETE /rules/:id`: disabling is the only removal
  path, so a `Notification.ruleId` never dangles on a deleted rule.

Derived fields (`sla_margin_sec`, `tickets_waiting`, duration fields) are
computed once by `stateTracker.ts` from raw event data and never
recomputed elsewhere — the frontend renders `Notification.severity` etc.
as-is rather than re-deriving them client-side. Frontend types
(`frontend/src/domain/`) mirror these rather than importing them directly:
the repo isn't set up as an npm workspace (root is the backend package
itself, not a peer of `frontend/`), so cross-package imports would need a
restructure the spec doesn't otherwise call for. Stated tradeoff, not an
oversight.

## 5. What's tested and why

- **Rule engine correctness on real sustained sequences** — `ruleEngine.test.ts`
  uses the actual `billing` SLA-breach snapshots (9:30–10:00) and the real
  `a_19` adherence-violation checks (9:35 onward) as fixtures, not invented
  numbers.
- **Cooldown/dedup, both directions** — suppressed within the window, fires
  again once it's elapsed.
- **Scheduler catches an in-progress duration breach** — the highest-value
  test in the suite: proves `a_11`'s call fires a notification *before* any
  transition-out event exists, using a `SimulatedClock` rather than real
  sleeps.
- **`violation_started_at: null` with `in_violation: true`** — the real
  `a_23` edge case from the sample data, handled defensively (falls back to
  the check's own timestamp as the best-known violation start) rather than
  assumed away.
- **RuleEditor's conditional-field logic** — `ruleFormReducer.test.ts`
  covers the real logic (not presentation): switching scope type resets an
  invalid field selection, switching to a duration field forces
  `minDurationSec` off, and `buildRuleInput` produces the right `scope`
  shape for each of "a queue" / "my agents" / "myself." This is a pure
  reducer, so it's covered directly with Vitest rather than needing React
  Testing Library for this part.
- **Deliberately skipped**: exhaustive CRUD/API endpoint tests, UI
  snapshot/visual-regression tests, and real delivery-channel integration
  tests. Lower-signal for what's being graded here — the API routes are
  thin parse-validate-delegate wrappers over already-tested services, and
  pixel/appearance testing wasn't worth the time relative to the engine
  work above.

## 6. AI usage note

Built with Claude Code (Claude Sonnet 5) in an interactive pairing session,
not a single unreviewed generation pass:

- Before writing any code, had Claude Code audit all the spec/skill
  markdown files against each other *and* against the real
  `data/events.jsonl` for inconsistencies. That surfaced two real problems
  I hadn't caught myself: (1) the `Rule` schema had no way to express seed
  rule 2's "while state == on_call" — resolved by adding `stateFilter`
  rather than guessing; (2) the spec's own claim that `a_05` shows a
  confirmed 60-minute on-call trigger doesn't hold up — `a_05`'s only
  on-call segment in the data is 16 minutes; the 60-minute figure belongs
  to its preceding `available` state. Both were flagged to me explicitly
  before proceeding, not silently resolved.
- Claude Code wrote the domain Zod schemas, state tracker, dedup, rule
  engine, scheduler, replay ingestion, the Express API layer, and the full
  React frontend (identity/notifications/rules features, SCSS styling per
  the design mockups' structure, translated to this project's own tokens).
- Verification wasn't "it compiled": ran the backend test suite (12/12) and
  the actual replay against `events.jsonl`, read the fired-notification log
  line by line against expected seed-rule behavior, then curl'd every API
  route by hand (including the 400 case for a missing `ownerId`/`recipientId`
  query param) before touching the frontend. Once the UI was built, drove it
  with a headless-Chromium Playwright script — not just `tsc`/lint passing —
  switching identities, opening the RuleEditor, and switching scope type to
  confirm the conditional-field logic actually re-renders correctly, then
  checked the console for errors. Screenshots from that run are what caught
  that the conditional logic worked as designed rather than just compiling.
- One test (`ruleEngine.test.ts`'s cooldown test) initially failed — traced
  it to the test fixture's own timestamp math being wrong (60s elapsed vs.
  a 600s threshold), not an engine bug, fixed and re-verified. Separately,
  Zod v4 rejected `.omit()` on the already-`.refine()`d `Rule` schema at
  server startup — restructured into a base shape schema with the
  refinement layered on both the full and input schemas afterward. Also hit
  a CORS failure from running two frontend dev-server instances at once
  (Vite auto-bumped to a second port when 5173 was already taken) — the
  backend's CORS was hardcoded to one port; changed it to match any
  `http://localhost:<port>` origin, which is the actual dev-only intent.
- `git init` and all dependency installs (`npm install`, Playwright browser
  binaries) were run by hand, not by Claude Code, per my preference to keep
  those steps in my own hands.

## 7. What I'd build next

- Head-of-support digest/aggregation view (explicitly deferred, see §1).
- Escalation chains (re-route or widen the audience if a notification goes
  unacknowledged).
- Persistent storage instead of in-memory rules/notifications — fine for a
  demo, not for a restart-safe production system.
- Real streaming ingestion (Kafka/webhook-style) instead of a file replay,
  once there's an actual event source instead of a sample file.
- Notification preferences beyond on/off — quiet hours, per-severity
  channel routing.

## 8. How to run it

```
# Backend (from repo root) — installs, runs tests, replays events.jsonl
# once at boot, then serves the API on :3001
npm install
npm test
npm run dev

# Frontend (separate terminal, from repo root)
cd frontend
npm install
npm test
npm run dev   # serves on :5173
```

Open `http://localhost:5173` — the notification feed and rules are seeded
immediately from the backend's boot-time replay. Creating or editing a rule
does **not** retroactively re-fire it: the feed shows the *last* replay
run's output, so click **"Replay sample data"** (top of the notification
feed) after changing a rule to see its effect. That button is explicitly a
demo affordance, not a stand-in for a real product action — see the note
below.

**Why replay is a button and not automatic.** This system has no live event
stream, just the fixed `data/events.jsonl` sample, so "see this new rule
fire" requires re-processing that fixed history — closer to a backfill job
than anything a real user would do. In production there'd be nothing to
click: a new/edited rule just starts evaluating the live stream and any
currently-open agent states from that point forward, the same way the
scheduler already sweeps open states independent of new events arriving
(see §3). The button is labeled and captioned accordingly rather than
implying "replay" is a normal step in editing a rule.
