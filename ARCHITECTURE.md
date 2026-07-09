# Architecture

Detailed reference diagrams for the whole system — backend and frontend,
module by module, plus the data flows that tie them together. This is a
deep-dive companion to `README.md`'s higher-level architecture section
(§2); that one's written for the 30-minute review narrative, this one's
written to be exhaustive. Every node/edge below is a real import or call
site as of this writing, not an idealized sketch — see the file paths named
throughout if you want to check any single edge against the code.

## Contents

1. [System overview](#1-system-overview)
2. [Backend module graph](#2-backend-module-graph)
3. [Frontend module graph](#3-frontend-module-graph)
4. [Domain model](#4-domain-model)
5. [Sequence: replay boot → event-driven notification](#5-sequence-replay-boot--event-driven-notification)
6. [Sequence: scheduler catches an in-progress duration breach](#6-sequence-scheduler-catches-an-in-progress-duration-breach)
7. [Sequence: creating a rule via the UI](#7-sequence-creating-a-rule-via-the-ui)
8. [Sequence: notification feed — pagination + virtualization](#8-sequence-notification-feed--pagination--virtualization)

---

## 1. System overview

Two independent processes, no shared runtime — the frontend only ever
talks to the backend over HTTP (dev-only CORS, any `localhost:<port>`
origin; see `src/server.ts`).

```mermaid
flowchart LR
  subgraph SampleData["Demo data source"]
    EJ[("data/events.jsonl<br/>96 events<br/>DEMO: stands in for a live event stream")]
  end

  subgraph BackendProc["Backend process - tsx watch src/server.ts - port 3001"]
    Engine[["Rule engine<br/>domain/ engine/ ingestion/ delivery/"]]
    Services[["Services, in-memory<br/>RulesService, NotificationsService"]]
    API[["Express API<br/>identities, rules, notifications, replay"]]
  end

  subgraph FrontendProc["Frontend process - vite - port 5173"]
    UI[["React app<br/>ViewingAsSwitcher, NotificationFeed, RuleList"]]
  end

  Browser(["Team lead Jordan (lead_1)<br/>or Agent a_19, in a browser"])

  EJ --> Engine
  Engine --> Services
  Services --> API
  Browser <--> FrontendProc
  UI <--> API
```

## 2. Backend module graph

Every arrow is a real `import` edge (verified against the source, not
inferred). Grouped by directory to match the actual folder structure.

```mermaid
flowchart TB
  subgraph domainGroup["src/domain"]
    events["events.ts<br/>QueueSnapshot, AgentStateChange,<br/>AdherenceCheck, EventSchema"]
    rule["rule.ts<br/>Rule, RuleInput, RuleSchema,<br/>CONDITION_FIELD_LABELS,<br/>AGENT_STATE_LABELS, QUEUE_LABELS"]
    notification["notification.ts<br/>Notification"]
    identity["identity.ts<br/>Identity, SEED_IDENTITIES"]
    seedRules["seedRules.ts<br/>SEED_RULES"]
  end

  subgraph engineGroup["src/engine"]
    clock["clock.ts<br/>SimulatedClock"]
    stateTracker["stateTracker.ts<br/>StateTracker"]
    dedup["dedup.ts<br/>Dedup"]
    ruleEngine["ruleEngine.ts<br/>RuleIndex, evaluate,<br/>ConditionPersistence,<br/>candidate builders, buildMessage"]
    scheduler["scheduler.ts<br/>Scheduler, sweep"]
  end

  subgraph ingestionGroup["src/ingestion"]
    replay["replay.ts<br/>loadEvents, replay"]
  end

  subgraph deliveryGroup["src/delivery"]
    stubChannel["stubChannel.ts<br/>StubChannel, DEMO only"]
  end

  subgraph servicesGroup["src/services"]
    rulesService["rulesService.ts<br/>RulesService, owner-indexed"]
    notificationsService["notificationsService.ts<br/>NotificationsService,<br/>recipient-indexed, keyset paginated"]
  end

  subgraph apiGroup["src/api"]
    apiResponse["response.ts<br/>apiSuccess, apiError"]
    apiRules["rules.ts<br/>rulesRouter"]
    apiNotifications["notifications.ts<br/>notificationsRouter"]
    apiIdentities["identities.ts<br/>identitiesRouter"]
  end

  serverTs[["server.ts<br/>entry point, port 3001"]]

  notification --> rule
  seedRules --> rule

  stateTracker --> events

  ruleEngine --> rule
  ruleEngine --> notification
  ruleEngine --> dedup
  ruleEngine --> stateTracker
  ruleEngine --> events

  scheduler --> notification
  scheduler --> dedup
  scheduler --> ruleEngine
  scheduler --> stateTracker

  replay --> events
  replay --> seedRules
  replay --> rule
  replay --> notification
  replay --> stateTracker
  replay --> dedup
  replay --> ruleEngine
  replay --> scheduler
  replay --> clock
  replay --> stubChannel

  stubChannel --> notification

  rulesService --> rule
  notificationsService --> notification

  apiRules --> rule
  apiRules --> rulesService
  apiRules --> apiResponse
  apiNotifications --> notificationsService
  apiNotifications --> apiResponse
  apiIdentities --> identity
  apiIdentities --> apiResponse

  serverTs --> seedRules
  serverTs --> rulesService
  serverTs --> notificationsService
  serverTs --> apiRules
  serverTs --> apiNotifications
  serverTs --> apiIdentities
  serverTs --> apiResponse
  serverTs --> replay
```

## 3. Frontend module graph

Rooted at `frontend/src/`, per `react-typescript-best-practices/SKILL.md`'s
Code Organization section. Domain types here are a deliberate duplicate of
the backend's (see `frontend/src/domain/rule.ts`'s header comment), not an
import across the process boundary.

```mermaid
flowchart TB
  subgraph fdomainGroup["frontend/src/domain"]
    fRule["rule.ts<br/>Rule, RuleInput, label maps,<br/>OPTIONS lists"]
    fNotification["notification.ts<br/>Notification"]
    fIdentity["identity.ts<br/>Identity"]
  end

  subgraph fservicesGroup["frontend/src/services"]
    apiClient["apiClient.ts<br/>fetchIdentities, fetchRules,<br/>create and update Rule, fetchNotifications,<br/>triggerReplay"]
  end

  subgraph futilsGroup["frontend/src/utils"]
    formatDuration["formatDuration.ts"]
    formatTime["formatTime.ts"]
  end

  subgraph fcomponentsGroup["frontend/src/components"]
    Badge["Badge.tsx"]
    Button["Button.tsx"]
    ErrorBoundary["ErrorBoundary.tsx"]
  end

  subgraph identityFeature["features/identity"]
    ViewingAsContext["ViewingAsContext.ts"]
    ViewingAsProvider["ViewingAsProvider.tsx"]
    useViewingAs["useViewingAs.ts"]
    ViewingAsSwitcher["ViewingAsSwitcher.tsx"]
  end

  subgraph notificationsFeature["features/notifications"]
    useNotificationFeed["useNotificationFeed.ts<br/>useInfiniteQuery"]
    useReplay["useReplay.ts"]
    NotificationFeed["NotificationFeed.tsx<br/>tanstack react-virtual"]
    NotificationItem["NotificationItem.tsx"]
    ReplaySampleDataButton["ReplaySampleDataButton.tsx"]
  end

  subgraph rulesFeature["features/rules"]
    ruleFormReducer["ruleFormReducer.ts"]
    useRules["useRules.ts"]
    RuleEditor["RuleEditor.tsx"]
    RuleList["RuleList.tsx"]
    RuleRow["RuleRow.tsx"]
  end

  AppTsx[["App.tsx"]]
  MainTsx[["main.tsx, entry point"]]

  fNotification --> fRule
  apiClient --> fRule
  apiClient --> fNotification
  apiClient --> fIdentity

  ViewingAsContext --> fIdentity
  ViewingAsProvider --> apiClient
  ViewingAsProvider --> ViewingAsContext
  useViewingAs --> ViewingAsContext
  ViewingAsSwitcher --> useViewingAs

  useNotificationFeed --> apiClient
  useReplay --> apiClient
  NotificationFeed --> useViewingAs
  NotificationFeed --> useNotificationFeed
  NotificationFeed --> NotificationItem
  NotificationFeed --> ReplaySampleDataButton
  NotificationItem --> fNotification
  NotificationItem --> Badge
  NotificationItem --> formatTime
  ReplaySampleDataButton --> useReplay
  ReplaySampleDataButton --> Button

  ruleFormReducer --> fRule
  useRules --> apiClient
  useRules --> fRule
  RuleRow --> fRule
  RuleRow --> Badge
  RuleRow --> Button
  RuleRow --> formatDuration
  RuleRow --> ruleFormReducer
  RuleEditor --> fRule
  RuleEditor --> Button
  RuleEditor --> useRules
  RuleEditor --> ruleFormReducer
  RuleList --> fRule
  RuleList --> useViewingAs
  RuleList --> useRules
  RuleList --> RuleRow
  RuleList --> RuleEditor
  RuleList --> Button

  AppTsx --> ViewingAsSwitcher
  AppTsx --> NotificationFeed
  AppTsx --> RuleList
  AppTsx --> ErrorBoundary

  MainTsx --> AppTsx
  MainTsx --> ViewingAsProvider
```

## 4. Domain model

```mermaid
classDiagram
  class Rule {
    +string id
    +string ownerId
    +string recipientId
    +RuleScope scope
    +string field
    +string stateFilter
    +string operator
    +number threshold
    +number minDurationSec
    +number cooldownSec
    +string severity
    +boolean enabled
  }
  class RuleScope {
    +string[] queueIds
    +string[] agentIds
  }
  class Notification {
    +string id
    +string ruleId
    +string recipientId
    +string severity
    +string firedAt
    +string message
    +object context
  }
  class Identity {
    +string id
    +string displayName
    +string role
  }
  class QueueSnapshot {
    +string event_id
    +string ts
    +string queue_id
    +number tickets_waiting
    +number longest_wait_sec
    +number sla_target_sec
    +number agents_available
    +number agents_on_call
  }
  class AgentStateChange {
    +string event_id
    +string ts
    +string agent_id
    +string previous_state
    +number previous_state_duration_sec
    +string new_state
  }
  class AdherenceCheck {
    +string event_id
    +string ts
    +string agent_id
    +string scheduled_state
    +string actual_state
    +boolean in_violation
    +string violation_started_at
  }

  Rule o-- RuleScope
  Rule --> Notification : fires, keyed by ruleId
  Rule ..> Identity : ownerId and recipientId
  Notification ..> Identity : recipientId
  QueueSnapshot ..> Notification : derives sla_margin_sec, tickets_waiting
  AgentStateChange ..> Notification : derives agent_state_duration_sec
  AdherenceCheck ..> Notification : derives adherence_violation_duration_sec
```

Fields not shown as plain `string`/`number`/`boolean` above but worth
calling out explicitly:

- `Rule.field` is `ConditionField` = `sla_margin_sec | tickets_waiting |
  adherence_violation_duration_sec | agent_state_duration_sec`.
- `Rule.operator` is `Operator` = `> | >= | =`.
- `Rule.severity` and `Notification.severity` are `Severity` = `warning |
  danger`.
- `Identity.role` is `'team_lead' | 'agent'`.
- `Rule.stateFilter`, `Rule.minDurationSec`, `AgentStateChange.previous_state`,
  `AgentStateChange.previous_state_duration_sec`, and
  `AdherenceCheck.violation_started_at` are all optional/nullable — see
  `src/domain/rule.ts` and `src/domain/events.ts` for the exact Zod schemas.

## 5. Sequence: replay boot → event-driven notification

```mermaid
sequenceDiagram
  autonumber
  participant Boot as server.ts boot
  participant Replay as replay.ts
  participant Tracker as StateTracker
  participant Index as RuleIndex
  participant Eval as evaluate
  participant Dedup as Dedup
  participant Persist as ConditionPersistence
  participant Sched as Scheduler
  participant Channel as StubChannel

  Boot->>Replay: replay(loadEvents(), rulesService.listAll())
  Replay->>Index: new RuleIndex(rules), built once per run
  loop each event, sorted by ts, not file order
    Replay->>Sched: advanceTo(now, index, tracker, dedup, persist)
    Note right of Sched: sweeps any open agent state whose 30s<br/>tick boundary was crossed, see section 6
    alt queue_snapshot
      Replay->>Tracker: recordQueueSnapshot(event)
      Tracker-->>Replay: QueueMetrics, sla_margin_sec and tickets_waiting
      Replay->>Eval: evaluate(index, candidate), called twice
    else adherence_check
      Replay->>Tracker: recordAdherenceCheck(event)
      Tracker-->>Replay: AdherenceStatus, defensive null-start handling
      Replay->>Eval: evaluate(index, candidate)
    else agent_state_change
      Replay->>Eval: evaluate(index, closedStateCandidate)
      Replay->>Tracker: recordAgentStateChange(event), opens new state
    end
    Eval->>Index: forField(candidate.field)
    Eval->>Dedup: shouldFire(ruleId, entityId, now, cooldownSec)
    Eval->>Persist: check(ruleId, entityId, now, conditionTrue, minDurationSec)
    Eval-->>Replay: zero or more Notifications
    Replay->>Channel: send(notification)
  end
  Replay-->>Boot: notifications and channel
  Boot->>Boot: notificationsService.replaceAll(notifications)
```

## 6. Sequence: scheduler catches an in-progress duration breach

The single most important design decision in the system (see README §3) —
`agent_state_change` fires only on transition, so a rule like "on a call
over 45 min" needs this sweep to catch it while still happening.

```mermaid
sequenceDiagram
  autonumber
  participant Sched as Scheduler
  participant Tracker as StateTracker
  participant Eval as evaluate

  Note over Sched,Eval: Real example from data/events.jsonl: a_11 goes<br/>on_call at 09:10, no transition-out event exists<br/>until 10:20 - a naive event-reactive engine<br/>would never flag this.

  Sched->>Sched: walk every 30s tick boundary<br/>crossed since lastTickAtMs
  loop each crossed tick
    Sched->>Tracker: getAllOpenAgentStates()
    loop each open state, agentId state since
      Sched->>Sched: durationSec = tickTime minus since
      Sched->>Eval: evaluate(index, candidate) for agent_state_duration_sec
      Eval-->>Sched: fires once past 2700s, then<br/>cooldown-suppressed on later ticks
    end
  end
```

## 7. Sequence: creating a rule via the UI

```mermaid
sequenceDiagram
  autonumber
  actor User as Team lead
  participant Editor as RuleEditor
  participant Reducer as ruleFormReducer
  participant Mutation as useRuleMutations
  participant Client as apiClient
  participant Route as rules route
  participant Zod as RuleInputSchema
  participant Svc as RulesService

  User->>Editor: fill form, scope condition threshold
  Editor->>Reducer: dispatch SET_SCOPE_TYPE, SET_FIELD, etc
  Reducer-->>Editor: next form state, field options and<br/>stateFilter visibility re-derived
  User->>Editor: submit Create rule
  Editor->>Reducer: buildRuleInput(state, ownerId)
  Editor->>Mutation: create.mutate(input)
  Mutation->>Client: createRule(input)
  Client->>Route: POST /rules with ownerId scope field etc
  Route->>Zod: safeParse(req.body)
  alt invalid
    Zod-->>Route: error
    Route-->>Client: 400, ok false, error and details
  else valid
    Zod-->>Route: parsed RuleInput
    Route->>Svc: create(input)
    Svc-->>Route: Rule with a fresh random id
    Route-->>Client: 201, ok true, data rule
  end
  Client-->>Mutation: Rule
  Mutation->>Mutation: invalidate rules query for this ownerId
  Mutation-->>Editor: onSuccess, then onClose
  Note over Mutation: RuleList's useRules refetches<br/>automatically via the invalidated query key
```

## 8. Sequence: notification feed — pagination + virtualization

```mermaid
sequenceDiagram
  autonumber
  participant Feed as NotificationFeed
  participant Hook as useNotificationFeed
  participant Client as apiClient
  participant Route as notifications route
  participant Svc as NotificationsService
  participant Virt as react-virtual

  Feed->>Hook: useNotificationFeed(recipientId)
  Hook->>Client: fetchNotifications(recipientId, limit 30)
  Client->>Route: GET with recipientId and limit
  Route->>Svc: list(recipientId, limit 30)
  Svc-->>Route: notifications and nextCursor
  Route-->>Client: 200, ok true, data
  Client-->>Hook: page 1
  Hook-->>Feed: first page of data

  Feed->>Virt: useVirtualizer, count getScrollElement<br/>estimateSize getItemKey
  Virt-->>Feed: virtualItems, only rows near the viewport
  Feed->>Feed: render virtualItems only,<br/>positioned via translateY

  Note over Feed,Virt: user scrolls near the end of loaded rows
  Feed->>Hook: fetchNextPage, cursor is last page's nextCursor
  Hook->>Client: fetchNotifications(recipientId, limit 30, cursor)
  Client->>Route: GET with before equal to last id
  Route->>Svc: list(recipientId, limit 30, before)
  Svc-->>Route: next page, keyset based, stable under replaceAll
  Route-->>Client: 200, ok true, data
  Client-->>Hook: page 2 appended

  Note over Hook: maxPages 10 caps memory and poll cost,<br/>oldest page dropped once exceeded
  loop every 5s, refetchInterval
    Hook->>Client: re-fetch currently-loaded pages
  end
```
