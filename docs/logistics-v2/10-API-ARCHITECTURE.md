# §10 — API Architecture

Contracts only. No implementation.

Conventions inherited from V1 and applied without exception:

| Convention | Rule |
|---|---|
| Prefix | `/api/logistics/<context>` |
| Identity | UUID in the path; the API `id` field **is** the UUID |
| Envelope | `JsonResource` — responses carry a `data` key. Never `response()->json($resource, 201)` |
| Auth | `auth:sanctum` on every route |
| Authorisation | `permission:<name>` middleware as the coarse gate; a Policy for record-level company scoping |
| Domain violation | HTTP **422** with a human-readable `message` |
| Upsert semantics | Always **200**, never 201 — the contract must not depend on prior existence |
| Refusals | Always return the ordered reason list alongside the boolean |
| Collections | Paginated with `meta { current_page, last_page, per_page, total }` |

---

## 10.1 Fleet — `/api/logistics/fleet`

### Reference and analytics

| Method | Path | Permission |
|---|---|---|
| GET | `/options` | `fleet.view` |
| GET | `/stats` | `fleet.view` |

### Fleet units

| Method | Path | Permission | Notes |
|---|---|---|---|
| GET | `/units` | `fleet.view` | Filters: `lifecycle_state`, `verdict`, `group_id`, `overdue`, `has_defect` |
| GET | `/units/{uuid}` | `fleet.view` | |
| POST | `/units` | `fleet.manage` | Creates the FleetUnit for an existing V1 vehicle |
| PATCH | `/units/{uuid}/lifecycle` | `fleet.manage` | 422 on illegal transition |
| GET | `/units/{uuid}/fitness` | `fleet.view` | **Returns `FitnessVerdict` with ordered blockers** |
| GET | `/units/{uuid}/health` | `fleet.view` | Score with contributing factors |
| POST | `/units/{uuid}/fitness-override` | `fleet.health.override` | Requires a reason; audited |

### Maintenance

| Method | Path | Permission |
|---|---|---|
| GET / POST | `/units/{uuid}/maintenance-plans` | `fleet.view` / `fleet.maintenance.schedule` |
| GET | `/work-orders` | `fleet.view` |
| POST | `/work-orders` | `fleet.maintenance.schedule` |
| PATCH | `/work-orders/{uuid}/start` | `fleet.maintenance.schedule` |
| PATCH | `/work-orders/{uuid}/complete` | `fleet.maintenance.complete` |
| PATCH | `/work-orders/{uuid}/cancel` | `fleet.maintenance.schedule` |

`complete` is the endpoint that writes the V1 maintenance record via
`VehicleMaintenanceService`. Its response includes the created V1 record id, so
the caller can see the boundary was crossed correctly.

### Inspections, defects, fuel, cost

| Method | Path | Permission |
|---|---|---|
| GET | `/inspection-templates` | `fleet.view` |
| POST | `/units/{uuid}/inspections` | `fleet.inspection.perform` |
| PATCH | `/inspections/{uuid}/submit` | `fleet.inspection.perform` |
| PATCH | `/inspections/{uuid}/approve` | `fleet.inspection.approve` |
| PATCH | `/inspections/{uuid}/reject` | `fleet.inspection.approve` |
| GET | `/defects` | `fleet.view` |
| PATCH | `/defects/{uuid}/{acknowledge\|resolve\|dismiss}` | `fleet.manage` |
| GET / POST | `/fuel-transactions` | `fleet.view` / `fleet.fuel.record` |
| PATCH | `/fuel-transactions/{uuid}/{validate\|reconcile\|dispute}` | `fleet.fuel.reconcile` |
| POST | `/units/{uuid}/odometer` | `fleet.fuel.record` |
| GET | `/units/{uuid}/costs` | `fleet.cost.view` |
| GET | `/costs/summary` | `fleet.cost.view` |

**~34 routes.**

---

## 10.2 Network — `/api/logistics/network`

| Method | Path | Permission | Notes |
|---|---|---|---|
| GET | `/options` | `network.view` | |
| GET / POST | `/service-areas` | `network.view` / `network.manage` | |
| GET / PUT | `/service-areas/{uuid}` | `network.view` / `network.manage` | |
| POST / DELETE | `/service-areas/{uuid}/members` | `network.manage` | Attaches an existing zone or city |
| GET / POST | `/service-areas/{uuid}/coverage-rules` | `network.view` / `network.manage` | |
| GET / POST | `/capacity-plans` | `network.view` / `network.capacity.manage` | |
| PATCH | `/capacity-plans/{uuid}/publish` | `network.capacity.manage` | |
| **GET** | **`/capacity/availability`** | `network.view` | **Orders integration point** |
| POST | `/capacity/reserve` | `network.capacity.commit` | Soft hold with TTL |
| PATCH | `/capacity/{uuid}/{commit\|release}` | `network.capacity.commit` | |
| POST | `/coverage/resolve` | `network.view` | Address → service area |

Two contracts deserve emphasis.

**`GET /capacity/availability`** is advisory and must never reject:

```
request   { service_area_id | address, date, units: { orders, weight_kg } }
response  { available: {...}, committed: {...}, remaining: {...},
            can_accommodate: bool, shortfall: {...} | null,
            alternatives: [ { date, remaining } ] }
```

`can_accommodate: false` is information. Orders decides what to do with it — the
same stance `BranchAssignmentEngine` takes when there is no coverage.

**`POST /coverage/resolve`** returns the matched area, the service levels
available, and cutoff times — or an explicit no-coverage result with the nearest
covered areas.

**~18 routes.**

---

## 10.3 Routing — `/api/logistics/routing`

| Method | Path | Permission | Notes |
|---|---|---|---|
| GET | `/options` | `routing.view` | Includes available strategies |
| GET | `/trips/{tripUuid}/plan` | `routing.view` | Current (non-superseded) plan |
| GET | `/trips/{tripUuid}/plans` | `routing.view` | Full history |
| POST | `/trips/{tripUuid}/optimize` | `routing.optimize` | **202 when queued**, 200 when synchronous |
| POST | `/trips/{tripUuid}/reoptimize` | `routing.optimize` | Remainder only |
| PATCH | `/plans/{uuid}/accept` | `routing.optimize` | Makes it the active plan |
| GET | `/plans/{uuid}/eta` | `routing.view` | Per-stop, with refinement level |
| GET | `/runs/{uuid}` | `routing.view` | Optimisation audit incl. snapshot |
| POST | `/boards/{boardUuid}/optimize` | `routing.optimize` | Multi-trip; always queued |
| GET | `/strategies` | `routing.manage` | |
| PUT | `/strategies/policy` | `routing.manage` | Which strategy for which scope |

The 202-with-job-reference pattern matters: a 40,000-stop plan cannot be a
synchronous request, and the UI subscribes to `RoutePlanned` rather than polling.

Every ETA response states its `refinement_level` (L0–L3) so a consumer knows
whether it is looking at a plan estimate or a position-adjusted one.

**~11 routes.**

---

## 10.4 Dispatch — `/api/logistics/dispatch`

| Method | Path | Permission | Notes |
|---|---|---|---|
| GET | `/options` | `dispatch.view` | |
| GET | `/boards` | `dispatch.view` | |
| POST | `/boards` | `dispatch.manage` | For an (origin, date) |
| GET | `/boards/{uuid}` | `dispatch.view` | Full board with blockers |
| POST | `/boards/{uuid}/propose` | `dispatch.propose` | Generates assignments |
| GET | `/boards/{uuid}/resource-pool` | `dispatch.view` | Fit vehicles × available drivers |
| PATCH | `/proposals/{uuid}/accept` | `dispatch.release` | |
| PATCH | `/proposals/{uuid}/reject` | `dispatch.propose` | |
| PATCH | `/assignments/{uuid}` | `dispatch.propose` | Manual override |
| **POST** | **`/boards/{uuid}/release`** | `dispatch.release` | **Calls V1 services** |
| POST | `/assignments/{uuid}/release` | `dispatch.release` | Single trip |
| GET | `/boards/{uuid}/blockers` | `dispatch.view` | |
| PATCH | `/boards/{uuid}/close` | `dispatch.manage` | |

**The release contract** is the most important in V2:

```
response 200
  { released: [ { trip_uuid, v1_trip_id, v1_assignment_id } ],
    blocked:  [ { trip_uuid, blockers: [ "...", "..." ] } ] }
```

Partial success is a normal 200, not an error — mirroring the
`partially_released` board state. `v1_trip_id` and `v1_assignment_id` are echoed
back as evidence that V1 committed the change, which is what makes the boundary
auditable from the API alone.

**~13 routes.**

---

## 10.5 Telemetry — `/api/logistics/telemetry` *(optional)*

| Method | Path | Permission | Notes |
|---|---|---|---|
| POST | `/ingest` | `telemetry.ingest` | **Batched**; device or tracker |
| GET | `/positions` | `telemetry.view` | Snapshots for the live map |
| GET | `/assets/{uuid}/position` | `telemetry.view` | Latest, **with freshness** |
| GET | `/assets/{uuid}/trace` | `telemetry.view` | Simplified historical trace |
| GET / POST | `/assets` | `telemetry.view` / `telemetry.manage` | |
| PATCH | `/assets/{uuid}/{enable\|disable}` | `telemetry.manage` | |
| GET / POST | `/geofences` | `telemetry.view` / `telemetry.manage` | |
| GET | `/health` | `telemetry.view` | Source quality and degradation |

**Every position response carries `freshness`.** There is no endpoint that returns
a coordinate without it — a client physically cannot render a stale position as
live.

**If Telemetry is not deployed, none of these routes exist** and every other route
in V2 behaves identically.

**~11 routes.**

---

## 10.6 Carriers — `/api/logistics/carriers`

| Method | Path | Permission | Notes |
|---|---|---|---|
| GET | `/options` | `carrier.view` | |
| GET / POST | `/accounts` | `carrier.view` / `carrier.manage` | |
| GET | `/accounts/{uuid}/capabilities` | `carrier.view` | Declared, from the adapter |
| POST | `/accounts/{uuid}/test-connection` | `carrier.manage` | |
| GET / PUT | `/accounts/{uuid}/status-mappings` | `carrier.manage` | Data, not code |
| GET | `/accounts/{uuid}/health` | `carrier.view` | Verdict with signals |
| POST | `/quotes` | `carrier.quote` | Rate shopping across eligible carriers |
| POST | `/shipments` | `carrier.tender` | Creates a draft |
| POST | `/shipments/{uuid}/tender` | `carrier.tender` | Returns `TenderDecision` |
| GET | `/shipments/{uuid}` | `carrier.view` | |
| GET | `/shipments/{uuid}/label` | `carrier.view` | Streams; never returns a storage path |
| POST | `/shipments/{uuid}/refresh` | `carrier.view` | Manual status poll |
| POST | `/shipments/{uuid}/cancel` | `carrier.tender` | 422 if the capability is absent |
| GET | `/shipments` | `carrier.view` | Filters incl. `status`, `drift` |
| GET | `/unmapped-statuses` | `carrier.manage` | **The integration-gap queue** |
| GET | `/reconciliation/drift` | `carrier.manage` | |
| **POST** | **`/{carrier}/webhook/{accountUuid}`** | *public, signature-verified* | Not behind sanctum |

The webhook route is the only unauthenticated endpoint in V2. It verifies the
carrier's signature inside the adapter, persists raw, returns 200 immediately, and
queues processing. It is rate-limited per account.

`/unmapped-statuses` exists because silent mapping failure is the most damaging
carrier bug; giving it a queue makes it a visible piece of work.

**~19 routes.**

---

## 10.7 Driver mobile — `/api/logistics/driver`

Purposefully small. Directive 4: the device submits intents; the server decides.

| Method | Path | Permission | Notes |
|---|---|---|---|
| POST | `/session` | *driver auth* | Device registration + session |
| DELETE | `/session` | driver | End shift; stops telemetry collection |
| **POST** | **`/sync`** | driver | **The single write endpoint** |
| GET | `/tasks` | driver | Projection of today's work |
| GET | `/tasks/{stopUuid}` | driver | Stop detail |
| GET | `/reference` | driver | Failure reasons, POD requirements, checklists — versioned |
| POST | `/media/ticket` | driver | Short-lived scoped upload authorisation |
| POST | `/media/confirm` | driver | Attaches the artifact via Delivery |
| POST | `/telemetry` | driver | **Optional**; batched pings |

**`POST /sync` is the whole write surface.** Every driver action is an intent in
that batch, replayed server-side through the owning module's service:

```
request   { device_id, cursor,
            intents: [ { key, type, payload, occurred_at } ] }

response  { accepted:   [ key ],
            rejected:   [ { key, reason } ],     ← the domain's own 422 message
            conflicted: [ { key, server_state } ],
            tasks: [...], cursor, reference_versions }
```

There is deliberately **no** `POST /deliveries/{id}/succeed` on the driver API. A
driver-facing endpoint that mutates a delivery directly would be a second path
into the domain, and second paths are how business rules get bypassed.

**~9 routes.**

---

## 10.8 DriverOps and Operations Center

### DriverOps — `/api/logistics/driver-ops` (~7 routes)

| Method | Path | Permission |
|---|---|---|
| GET | `/scorecards` | `driverops.view` |
| GET | `/drivers/{uuid}/scorecard` | `driverops.view` |
| GET | `/drivers/{uuid}/trend` | `driverops.view` |
| GET | `/incidents` | `driverops.view` |
| PATCH | `/incidents/{uuid}/acknowledge` | `driverops.manage` |
| POST | `/drivers/{uuid}/coaching-notes` | `driverops.manage` |
| GET | `/leaderboard` | `driverops.view` |

Every metric response includes its **sample size**. A percentage without a
denominator is not a metric.

### Operations Center — `/api/logistics/operations` (~12 routes)

| Method | Path | Permission |
|---|---|---|
| GET | `/dashboard` | `operations.view` |
| GET | `/fleet-dashboard` | `operations.view` |
| GET | `/queues` | `operations.view` |
| GET | `/queues/{key}` | `operations.view` |
| POST / DELETE | `/queues` | `operations.manage` |
| GET | `/alerts` | `operations.view` |
| PATCH | `/alerts/{uuid}/{acknowledge\|resolve}` | `operations.alerts.manage` |
| GET / POST / PUT | `/alert-rules` | `operations.manage` |
| GET | `/live-map` | `operations.view` |

`/live-map` composes plan, stops, service areas and — *if available* — positions.
Its response states which layers are present and why any are absent, so the client
renders an explanation rather than an empty map.

---

## 10.9 Permission catalogue

Nine seed migrations, one per context, following LOG-005's idempotent
name-keyed pattern.

| Context | Permissions |
|---|---|
| Fleet | `fleet.view`, `fleet.manage`, `fleet.maintenance.schedule`, `fleet.maintenance.complete`, `fleet.inspection.perform`, `fleet.inspection.approve`, `fleet.fuel.record`, `fleet.fuel.reconcile`, `fleet.cost.view`, `fleet.health.override` |
| Network | `network.view`, `network.manage`, `network.capacity.manage`, `network.capacity.commit` |
| Routing | `routing.view`, `routing.optimize`, `routing.manage` |
| Dispatch | `dispatch.view`, `dispatch.propose`, `dispatch.release`, `dispatch.manage` |
| Telemetry | `telemetry.view`, `telemetry.ingest`, `telemetry.manage`, `telemetry.history.view` |
| Carriers | `carrier.view`, `carrier.manage`, `carrier.quote`, `carrier.tender` |
| DriverApp | `driver.app.access` |
| DriverOps | `driverops.view`, `driverops.manage` |
| OperationsCenter | `operations.view`, `operations.manage`, `operations.alerts.manage` |

**37 permissions.** The recurring split — perform vs. approve, record vs.
reconcile, propose vs. release, view vs. history.view — is separation of duties,
following the precedent LOG-005 set with POD capture vs. validate.

---

## 10.10 Route count and shared conventions

| Context | Routes |
|---|---|
| Fleet | ~34 |
| Network | ~18 |
| Routing | ~11 |
| Dispatch | ~13 |
| Telemetry | ~11 *(optional)* |
| Carriers | ~19 |
| DriverApp | ~9 |
| DriverOps | ~7 |
| OperationsCenter | ~12 |
| **Total** | **~134** *(123 without Telemetry)* |

### Conventions applied throughout

**Refusals explain themselves.** Any endpoint that can refuse returns the ordered
reason list — `FitnessVerdict.blockers`, `AssignmentBlocker[]`,
`RouteConstraintViolation[]`, `TenderDecision.rejected_reasons`. This is the
LOG-005 `retryBlockers()` contract generalised.

**Long work is queued.** Anything that can exceed a second returns **202** with a
job reference and publishes a domain event on completion.

**Options endpoints are cached hard.** Every context exposes `/options` carrying
its enums and catalogues; it changes only on deploy, so clients cache with
`staleTime: Infinity` as V1's frontends already do.

**Upserts are 200.** Established while building LOG-005: an endpoint whose status
code depends on whether a row already existed is a contract that cannot be
programmed against.
