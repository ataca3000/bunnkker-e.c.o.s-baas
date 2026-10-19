# Notification Coverage Matrix

**Sprint:** SPRINT-AUTONOMOUS-001 · Phase 4b — Enterprise Notification Platform
**Date:** 2026-08-07
**Branch:** `develop`

---

## 1. What the platform was doing before this phase

The notification bell in the top bar rendered `notifications-mock-data.ts` — six
fabricated records, hardcoded in English, referencing an Aramex tracking number, a
WooCommerce store and AED amounts that no ECOS tenant has. Marking one read mutated
React state and nothing else. It was indistinguishable, to a user, from a working
notification centre.

Meanwhile the platform *was* producing real notifications. Laravel's `notifications`
table has existed since `2026_07_05_200400_create_notifications_table.php`, and the
Preparation wave lifecycle has been writing to it since. **Nothing ever read it back:
there was no endpoint.** Every wave-started, wave-completed and shortage-detected
notification written since July has been sitting unread and unreadable.

Two defects, one cause: the read side of the notification platform was never built,
so the UI was filled with fiction instead.

---

## 2. What this phase changed

| Layer | Change |
| --- | --- |
| Backend | `GET /api/notifications`, `PATCH /api/notifications/{id}/read`, `POST /api/notifications/mark-all-read` — read-only over the existing table. No schema change, no new producer, no delivery channel. |
| Authorization | Ownership, not a permission. Every query is scoped to the authenticated notifiable. A permission would be the wrong instrument — it could only widen the one boundary that must hold. |
| Frontend | `notifications-mock-data.ts` deleted. The centre now reads the live feed, is fully EN/AR localized, RTL-safe, and states an empty feed as empty. |
| Suppressions | 4,833 → 4,814 (−19). The two suppression entries for the mock files were removed, not re-baselined. |

**This is a deliberate exception to the standing "zero backend changes" constraint.**
It is recorded here rather than buried: the notification centre could not be made
truthful without a read endpoint, because the data existed and was unreachable. The
change is additive, read-only plus read-state, and touches no schema, no permission
and no existing route.

---

## 2a. Implementation verification — no parallel notification system

Verified 2026-08-07 at CTO request, before Phase 4 certification.

**Finding: the endpoints are a presentation layer over Laravel's existing Notification
infrastructure. No parallel system was introduced.**

Evidence:

| Question | Answer |
| --- | --- |
| What relation does the feed read? | `$user->notifications()` and `$user->unreadNotifications()` — the framework's `HasDatabaseNotifications` trait, reached through `Notifiable` on `App\Models\User`. |
| What model? | `Illuminate\Notifications\DatabaseNotification`. No subclass, no model of ours. |
| What table? | `notifications`, created by `2026_07_05_200400_create_notifications_table.php` with Laravel's standard schema. |
| How is a notification marked read? | `DatabaseNotification::markAsRead()` — the framework's method. |
| Did Phase 4 add a table, model or migration? | No. Commit `30ea7a12` touches four backend files: `NotificationController.php` (new), `routes/api.php` (+11 lines), `RoleTemplateCatalog.php` (the unrelated `executive` nav id) and one test. |
| Do the existing producers reach this feed unchanged? | Yes. All five Preparation notification classes still declare `via() => ['database']` and were not modified. Nothing about the producer side changed. |
| Does the frontend hold a second source of notifications? | No. `notifications-mock-data.ts` is deleted, and the only data source in `features/notifications/` is the three endpoints above. |

Two nuances, stated rather than glossed:

1. **`mark-all-read` issues one bulk `update(['read_at' => now()])` on the framework's
   `unreadNotifications()` relation** instead of iterating `markAsRead()` per record. Same
   relation, same column, same semantics — one query instead of N. It bypasses the
   `markAsRead()` method but not the infrastructure.
2. **`DB::table('notifications')->insert(...)` appears in `NotificationFeedTest`.** That is
   a test fixture arranging a row in the shape Laravel writes, so the test does not depend
   on a producer. No production code writes to the table directly.

**One parallel system does exist, and it pre-dates this sprint.** Engineering has its own
`engineering_notifications` table (migration `2026_07_21_200002`), its own
`EngineeringNotification` model, its own `EngineeringNotificationController` and its own
page. Phase 4 did not touch it and deliberately did not merge it into the user feed — see
§3.5 for why. It is recorded here so the divergence is a documented decision rather than an
undiscovered surprise.

---

## 3. The matrix

Classification:

- **Active** — a producer writes it, and a user can now see it in the bell.
- **Exists, not wired** — the producer exists but delivers to a log or is commented
  out; nothing reaches a user.
- **Backend missing** — the UI advertised this category; no producer exists.
- **Out of scope** — deliberately not part of the user notification feed.

### 3.1 Operations — Preparation

| Notification | Dispatched from | Channel | Status |
| --- | --- | --- | --- |
| `WaveStartedNotification` | `StartPreparationAction:116` | `database` | **Active** |
| `WaveCompletedNotification` | `CompleteWaveAction:169` | `database` | **Active** |
| `ShortageDetectedNotification` | `AnalyzeMaterialsAction:141` | `database`, `mail` | **Active** |
| `ExceptionRaisedNotification` | *no dispatch site in the codebase* | `database` | **Exists, not wired** |
| `QualityCheckFailedNotification` | *no dispatch site in the codebase* | `database` | **Exists, not wired** |

The three Active rows are the notifications that were already being written and are
now readable for the first time. The two unwired classes are complete and correct —
they simply have no caller. Wiring them means adding a `->notify()` at the exception
and quality-check transitions, which is an Operations change, not a platform one.

### 3.2 Marketing — Provider Platform

| Notification | Dispatched from | Channel | Status |
| --- | --- | --- | --- |
| Provider health degraded | `NotifyOnProviderHealthChangeListener::handleHealthChanged` | Slack log + `Log::warning` | **Exists, not wired** |
| Provider token expired | `…::handleTokenExpired` | Slack log + `Log::warning` | **Exists, not wired** |
| Provider credential validation failed | `…::handleValidationFailed` | Slack log + `Log::warning` | **Exists, not wired** |

The listener's own docblock says it: *"The Notification OS is not yet implemented, so
this listener logs the notification intent and prepares the payload."* The payload is
already assembled with a company id, a severity and a message — it needs a
`Notification` class and a `->notify()`, nothing more. These three are the highest-value
wiring candidates: a marketing integration whose token expired currently fails silently
from the operator's point of view.

### 3.3 POS

| Notification | Dispatched from | Channel | Status |
| --- | --- | --- | --- |
| Large sale detected | `PosNotificationListener::checkLargeSale` | `Log::notice` | **Exists, not wired** |
| Low-stock indicators after sale | `PosNotificationListener::checkLowStockIndicators` | `Log::debug` | **Exists, not wired** |

Both carry an explicit `// Future:` comment naming the intended dispatch. The low-stock
one additionally notes that POS has no stock figure at that point, so it needs a
downstream job before it can notify anything meaningful.

### 3.4 Logistics — Automation

| Notification | Dispatched from | Channel | Status |
| --- | --- | --- | --- |
| `Notify` / `Alert` / `EscalationNotice` automation actions | `NotificationDispatcher::dispatch` | `Log::info` / `Log::warning` | **Exists, not wired** |

The dispatcher's docblock states the design intent: *"A real channel (mail, Slack,
webhook) plugs in behind this method without changing any caller — the AutomationAction
already carries the channel and target."* That remains true; the database channel is now
one of the options available to it.

### 3.5 Engineering

| Notification | Dispatched from | Channel | Status |
| --- | --- | --- | --- |
| Pipeline notifications | `PipelineNotificationService` | `engineering_notifications` table | **Active — separate platform** |

Engineering has its own table, its own controller (`EngineeringNotificationController`)
and its own page (`engineering-notifications-page.tsx`). It is deliberately **not**
merged into the user feed: those notifications are company-wide engineering events with
no notifiable, and folding them into a per-user feed would either duplicate them per
user or lose their addressing. **Out of scope** for the bell.

### 3.6 Categories the mock advertised

| Mock category | Reality | Status |
| --- | --- | --- |
| Orders (`New Order Received`, `Order Shipped`) | No order notification producer exists anywhere in `Modules/Orders`. | **Backend missing** |
| Inventory (`Low Stock Alert`) | No inventory notification producer. `Modules/Logistics/Operations/Domain/Services/OperationalAlertService` produces operational alerts, but they are read through `/operations/exceptions/alerts`, not notified. | **Backend missing** |
| Finance (`Invoice Overdue`) | No finance notification producer. Budget threshold breaches exist as `GET /finance/budgets/{uuid}/alerts` — a pull endpoint, surfaced in the Budgets workspace (Phase 7), not a push notification. | **Backend missing** |
| Integrations (`WooCommerce Sync Complete`) | Channel sync writes `sync_logs`; nothing notifies. | **Backend missing** |
| System | Covered in part by the Provider Platform rows above (unwired). | **Exists, not wired** |

Four of the five categories the bell advertised had no producer at all. That is the
substantive finding of this phase: the mock was not a placeholder for a nearly-finished
feature — it was standing in for four features that do not exist.

---

## 4. Summary

| Status | Count |
| --- | --- |
| Active (reaches a user today) | 3 |
| Active — separate platform | 1 |
| Exists, not wired | 8 |
| Backend missing | 4 |
| Out of scope | 1 |

The feed is now truthful in both directions: what exists is shown, and what does not
exist is absent rather than simulated. A tenant with no Preparation activity will see an
empty bell — which is the correct answer, and was not previously obtainable.

---

## 5. Recommended next work (not done here)

Ordered by value per unit of effort:

1. **Wire the three Provider Platform notifications** (~1 notification class + 3 call
   sites). An expired marketing token is currently invisible to the operator who has to
   fix it.
2. **Wire `ExceptionRaisedNotification` and `QualityCheckFailedNotification`** — the
   classes are already written and tested-shaped; they need callers at the two
   Preparation transitions.
3. **Decide the Orders and Inventory notification contracts.** These are the two
   categories operators will expect first, and neither has a producer. This is a design
   decision about which order and stock transitions warrant a push, not an
   implementation task — it should not be invented by the UI layer.
4. **A standalone notifications page.** The drawer shows the most recent page of a
   paginated feed and says so. A full-history view is worth having once volume justifies
   it.
