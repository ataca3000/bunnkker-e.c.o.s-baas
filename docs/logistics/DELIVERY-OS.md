# Delivery & Tracking OS — TASK-LOG-005

Module: `backend/Modules/Logistics/Delivery`
Frontend: `frontend/src/features/logistics/delivery`
API prefix: `/api/logistics/delivery`

---

## 1. Why this module exists

Distribution (TASK-LOG-004B) plans and executes a **trip**. A `DeliveryStop` is one
planned visit on one trip, and it dies with that trip. But a customer order that
fails on Monday and succeeds on Wednesday is *one* delivery across *two* trips —
there was no aggregate that owned that story, so retry, SLA and proof had nowhere
to live.

**Delivery** is that aggregate: one order's journey to the customer, spanning every
attempt across every trip.

---

## 2. Ownership boundaries (CTO decisions, binding)

| Concept | Owner | Notes |
|---|---|---|
| `DeliveryStop` | **Distribution** | Per-trip planned visit. Delivery reads it, never writes it. |
| `DeliveryProof` | **Distribution** | Stop-level proof for trip execution. |
| `DeliveryException` | **Distribution** | Trip-level operational exception. |
| `TripReturn` | **Distribution** | What physically came back on the vehicle. |
| `Delivery` | **Delivery OS** | Aggregate root, order-scoped, trip-independent. |
| `DeliveryAttempt` | **Delivery OS** | One physical attempt against a stop. |
| `ProofOfDelivery` | **Delivery OS** | Order-level evidence with a validation gate. |
| `DeliveryFailure` | **Delivery OS** | Taxonomy-driven failure record. |
| `DeliveryReturn` | **Delivery OS** | What the *customer* did not accept. |

### The Single Cash Authority

**Distribution is the Single Cash Authority.** Delivery OS may record that COD
changed hands at the door and publish `CodCollected`. It performs no settlement
arithmetic, exposes no settlement figure, and writes to no `distribution_*` table.
Trip cash balances and reconciliation remain exclusively with Distribution's
`SettlementService` at `/api/logistics/distribution/trips/{tripId}/settlement`.

This is enforced, not just documented — see
`DeliveryModuleTest::test_cod_reporting_never_writes_to_distribution_cash_tables`
and `::test_the_cod_resource_exposes_no_settlement_figures`.

### Master data

Delivery OS owns no driver, vehicle or carrier data. Driver fitness comes from
`Driver::canStartDeliveries()` (LOG-002) and vehicle fitness from
`Vehicle::canBeDispatched()` (LOG-003), both reached through the trip's
`driver_vehicle_assignment`. There is no `driver_id` or `vehicle_id` column
anywhere in this module, asserted by
`::test_delivery_tables_reference_no_duplicated_master_data`.

---

## 3. Database

Nine tables plus one permission seed, all Schema Builder, MySQL-compatible.

| Migration | Table |
|---|---|
| `2026_07_29_100000` | `delivery_deliveries` |
| `2026_07_29_100001` | `delivery_attempts` |
| `2026_07_29_100002` | `delivery_failures` |
| `2026_07_29_100003` | `delivery_pods` |
| `2026_07_29_100004` | `delivery_pod_artifacts` |
| `2026_07_29_100005` | `delivery_cod_records` |
| `2026_07_29_100006` | `delivery_returns` |
| `2026_07_29_100007` | `delivery_return_lines` |
| `2026_07_29_100008` | `delivery_tracking_events` |
| `2026_07_29_100009` | *(seed)* 10 `delivery.*` permissions |

Every aggregate carries a BIGINT primary key for joins and a `uuid` that is the
**public identifier**, matching the Trip convention set in LOG-004B.

---

## 4. State machines

**DeliveryStatus** (12) — `pending → scheduled → in_transit → out_for_delivery →
attempted → {delivered | partially_delivered | failed}`; `failed → {awaiting_retry
| returning}`; `awaiting_retry → scheduled`; `returning → returned`. Terminal:
`delivered`, `returned`, `cancelled`.

**AttemptStatus** (7) — `created → en_route → arrived → in_progress → {succeeded |
failed}`; `aborted` from any open state. There are no shortcuts: `created` cannot
jump to `arrived`.

**PodStatus** (4) — `pending → captured → {validated | rejected}`.

**DeliveryReturnStatus** (6) — `initiated → in_transit → received → {verified |
discrepancy}`.

**CodStatus** (6) — `not_applicable`, `due → collected → verified`, plus `disputed`
and `written_off`.

Each enum owns its own transition map, so an illegal move is refused by the domain
rather than by a controller `if`.

---

## 5. Business rules

| Rule | Where enforced |
|---|---|
| BR-1 The trip must be dispatched before an attempt opens | `DeliveryExecutionService::openAttempt` |
| BR-2 Driver and vehicle must pass their own readiness gates | delegated to LOG-002 / LOG-003 |
| BR-3 At most one open attempt per delivery | `Delivery::hasOpenAttempt` |
| BR-7 A validated POD is required to succeed | `DeliveryExecutionService::succeed` |
| BR-8 No outstanding COD may remain at closure | `CodRecord::isOutstanding` |
| BR-9/10 Refusal and product faults never auto-retry | `FailureReason::isRetryable` |
| BR-11/19 Address failures block retry until corrected | `Delivery::retryBlockers` |
| BR-24 A return line may not exceed the undelivered quantity | `DeliveryReturnLine::exceedsUndelivered` |
| BR-27 Three failures force manual review | `Delivery::requiresManualReview` |

**Retryability is never taken from the caller.** The client sends a reason code;
category, retryability and the address-correction flag are all derived from
`FailureReason`, so the same failure reaches the same decision whether it arrives
from the driver app, from operations, or from an integration.

**SLA breach is derived, never stored as truth.** `Delivery::isSlaBreached()`
compares `promised_at + sla_grace_minutes` against `delivered_at ?? now()`.

---

## 6. Proof of delivery

The required-artifact list is **snapshotted onto the POD at capture time**
(`required_artifacts`), so tightening the policy later cannot retroactively
invalidate historic evidence. Default policy is signature + photo;
`HIGH_VALUE_REQUIRED` adds an OTP.

Capturing (`delivery.pod.capture`) and validating (`delivery.pod.validate`) are
**separate permissions** — the person who took the photo should not be the person
who signs it off. A validated POD is immutable.

`file_path` is never serialised; artifacts are reached through the authenticated
endpoint only.

---

## 7. Tracking projection

`delivery_tracking_events` is append-only with a `visibility` column. Two
projections read it:

- **Internal timeline** — `GET /{id}/timeline`, every event including operator notes.
- **Public timeline** — `GET /{id}/public-timeline`, built by
  `TrackingProjectionService::publicTimeline()`. It selects customer-visible
  entries and drops actor identity, metadata and GPS. It does **not** reuse
  `TrackingEventResource`, so a future field added to the internal resource cannot
  leak to customers by accident.

---

## 8. Domain events (13)

`DeliveryCreated`, `DeliveryAttemptStarted`, `DeliverySucceeded`,
`DeliveryPartiallySucceeded`, `DeliveryFailed`, `DeliveryRetryScheduled`,
`DeliveryRetryExhausted`, `PodValidated`, `PodRejected`, `CodCollected`,
`ReturnInitiated`, `ReturnReceived`, `SlaBreached`.

`CodCollected` is the integration seam for Distribution's settlement: Delivery
reports the fact, Distribution does the money.

---

## 9. API

38 routes under `/api/logistics/delivery`, all behind `auth:sanctum` plus a
`permission:` gate.

**Reference & analytics**
`GET /options`, `GET /stats`

**Deliveries** (`delivery.view` / `delivery.execute`)
`GET /`, `POST /`, `GET /{id}`, `PATCH /{id}/status`, `PATCH /{id}/escalate`

**Retry** (`delivery.retry`)
`GET /{id}/retry-eligibility`, `POST /{id}/retry`, `PATCH /{id}/address-corrected`

**Cancel** (`delivery.cancel`)
`PATCH /{id}/cancel`

**Tracking** (`delivery.view`)
`GET /{id}/timeline`, `GET /{id}/public-timeline`

**Attempts** (`delivery.execute`)
`GET|POST /{deliveryId}/attempts`, `GET /{deliveryId}/attempts/{attemptId}`,
`PATCH .../advance`, `PATCH .../succeed`, `PATCH .../fail`, `PATCH .../abort`

**POD** (`delivery.pod.capture` / `delivery.pod.validate`)
`GET|POST .../pod`, `POST .../pod/artifacts`, `PATCH .../pod/validate`,
`PATCH .../pod/reject`

**Returns** (`delivery.return.manage`)
`GET|POST /{deliveryId}/returns`, `GET /{deliveryId}/returns/{returnId}`,
`PATCH .../in-transit`, `PATCH .../receive`, `PATCH .../verify`,
`PATCH .../discrepancy`

**COD** (`delivery.cod.collect` / `delivery.cod.verify`)
`GET|POST /{deliveryId}/cod`, `PATCH /cod/collect`, `PATCH /cod/verify`,
`PATCH /cod/dispute`, `PATCH /cod/write-off`

Domain violations return **422** with a human-readable `message`. Upserts
(`POST .../pod`, `POST .../cod`) always return **200**, never 201, so the contract
does not depend on whether the record already existed.

---

## 10. Permissions

`delivery.view`, `delivery.execute`, `delivery.pod.capture`,
`delivery.pod.validate`, `delivery.retry`, `delivery.cancel`,
`delivery.return.manage`, `delivery.cod.collect`, `delivery.cod.verify`,
`delivery.analytics.view`.

Route middleware is the coarse gate; `DeliveryPolicy` adds the part middleware
cannot express — the record must belong to the actor's company. System roles bypass
both via `Gate::before()` in `IamServiceProvider`.

---

## 11. Frontend

`/logistics/delivery` — **Delivery Command Center**, exception-driven by design.
The default view hides closed deliveries and leads with what is failing, breaching
SLA, or waiting on a retry decision. Filters cover status, SLA breach and failure
category; the list carries the latest failure reason so triage needs no click.

The drawer has four tabs — Overview (status, SLA, retry blockers, COD summary,
cancel), Attempts (per-attempt timing, failure detail, POD validation), Returns
(line-level reconciliation against the warehouse count), Timeline.

Every mutation invalidates both the `logistics-delivery` and
`logistics-distribution` query prefixes, per ADR-024.

---

## 12. Tests

`backend/tests/Feature/Logistics/DeliveryModuleTest.php` — 35 tests, 260
assertions, all green. Full Logistics suite: 230 passed.

Boundary coverage worth naming:
- `test_delivery_execution_never_mutates_distribution_tables` — snapshots four
  `distribution_*` tables and the stop row across a full open→POD→succeed flow.
- `test_cod_reporting_never_writes_to_distribution_cash_tables`
- `test_the_cod_resource_exposes_no_settlement_figures`
- `test_delivery_tables_reference_no_duplicated_master_data`

---

## 13. Known gaps

- Attempt opening is exposed by API but has no dedicated driver-app screen yet;
  the workspace is operations-facing.
- POD artifact upload takes a `file_path` reference rather than a multipart
  stream — file storage integration is a follow-up.
- `SlaBreached` is defined and dispatchable but no scheduled job scans for
  breaches yet; the UI derives breach state on read.
