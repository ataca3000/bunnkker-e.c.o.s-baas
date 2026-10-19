# §8 — Database Design

Architecture only — no SQL. Conventions follow ECOS DB standards and V1
precedent: BIGINT primary key plus a `uuid` public identifier, `company_id`
scoping, `created_at`/`updated_at`, actor stamps on lifecycle transitions, and
**Laravel Schema Builder only, MySQL-compatible** (no PostgreSQL-only DDL, no raw
UUID functions, no `CREATE INDEX IF NOT EXISTS`, no index name over 64 characters).

Table prefixes are per context so ownership is legible from the table name alone:
`fleet_`, `network_`, `routing_`, `dispatch_`, `telemetry_`, `carrier_`,
`driverapp_`, `driverops_`, `opscenter_`.

---

## 8.1 Fleet (14 tables)

| Table | Purpose | Key relationships |
|---|---|---|
| `fleet_fleets` | Fleet grouping by ownership/operating model | → `companies`, → `logistics_shipping_companies` (nullable) |
| `fleet_groups` | Capability cohort within a fleet | → `fleet_fleets` |
| `fleet_units` | **Operational shadow of one vehicle** | 1:1 → `logistics_vehicles`, → `fleet_groups` |
| `fleet_unit_group_history` | Versioned group membership | → `fleet_units`, → `fleet_groups` |
| `fleet_maintenance_plans` | What is due, per vehicle per type | → `fleet_units` |
| `fleet_maintenance_schedule_rules` | Interval definition (distance/time/hours) | → `fleet_maintenance_plans` |
| `fleet_work_orders` | An instance of due maintenance being executed | → `fleet_maintenance_plans` |
| `fleet_inspection_templates` | Versioned checklist per group | → `fleet_groups` |
| `fleet_inspection_template_items` | Individual checks | → `fleet_inspection_templates` |
| `fleet_inspections` | A performed inspection, immutable once submitted | → `fleet_units`, → template version |
| `fleet_inspection_results` | Per-item outcome | → `fleet_inspections` |
| `fleet_defects` | Open faults with severity | → `fleet_units`, → `fleet_inspections` (nullable) |
| `fleet_odometer_readings` | Governed reading series | → `fleet_units` |
| `fleet_fuel_transactions` | Fuel purchases | → `fleet_units`, → `fleet_fuel_cards` |
| `fleet_fuel_cards` | Card master | → `fleet_fleets` |
| `fleet_cost_entries` | Append-only cost ledger | → `fleet_units` |

*(16 rows; "14 tables" counts the two fuel tables as one functional area — the
canonical count for planning is 16.)*

### Critical design points

**`fleet_units` is 1:1 with `logistics_vehicles` and holds no vehicle attributes.**
A unique constraint on `vehicle_id` enforces the 1:1. If anyone proposes adding
`plate_number` or `capacity_orders` here, P2 has been violated.

**`fleet_odometer_readings` is the governed series.** Columns: reading in km,
`source` (enum: `manual`, `fuel_stop`, `inspection`, `maintenance`, `telemetry`),
`recorded_at`, actor, and an `is_accepted` flag. `OdometerService` is the only
writer. A rejected reading is retained — a rolled-back odometer is evidence, not
noise.

**`fleet_cost_entries` is append-only.** No update path. A correction is a
reversing entry referencing the original. This mirrors inventory movement
discipline and is what makes month-end cost reproducible.

**`fleet_inspections` stores the template version** it was performed against, so a
two-year-old inspection can still be read exactly as performed.

### Indexes

| Table | Index | Serves |
|---|---|---|
| `fleet_units` | unique `vehicle_id` | 1:1 invariant |
| `fleet_units` | (`company_id`, `lifecycle_state`) | Fitness board |
| `fleet_maintenance_plans` | (`fleet_unit_id`, `type`, `is_open`) | One open plan per type |
| `fleet_maintenance_plans` | (`company_id`, `next_due_at`) | Overdue sweep |
| `fleet_defects` | (`fleet_unit_id`, `severity`, `resolved_at`) | Fitness gate |
| `fleet_odometer_readings` | (`fleet_unit_id`, `recorded_at`) | Latest reading |
| `fleet_fuel_transactions` | (`fleet_unit_id`, `transacted_at`) | Efficiency window |
| `fleet_cost_entries` | (`fleet_unit_id`, `cost_type`, `incurred_on`) | Cost rollups |

**Partial-uniqueness note.** "One open maintenance plan per (vehicle, type)" needs
a partial unique index, which MySQL does not support. Use the pattern LOG-002
already proved on `logistics_driver_vehicle_assignments`: a nullable
`active_flag` (1 = open, NULL = closed) inside a plain unique index. NULLs do not
collide in either MySQL or PostgreSQL.

### Lifecycle

`fleet_units` follow the fleet lifecycle and are never hard-deleted — retired
units retain their cost history. `fleet_inspections`, `fleet_fuel_transactions`
and `fleet_cost_entries` are immutable. `fleet_odometer_readings` are retained
indefinitely (they are small and are the audit trail for every distance-based cost).

---

## 8.2 Network (7 tables)

| Table | Purpose | Key relationships |
|---|---|---|
| `network_service_areas` | Commercial service area | → `companies` |
| `network_service_area_members` | **Composition** of existing geography | → `distribution_zones` OR → `logistics_cities` |
| `network_service_levels` | Named service tiers (same-day, next-day) | → `companies` |
| `network_coverage_rules` | Cutoff, lead time, surcharge per area × level | → `network_service_areas`, → `network_service_levels` |
| `network_capacity_plans` | Available capacity per area per date | → `network_service_areas` |
| `network_capacity_slots` | Capacity within a time window | → `network_capacity_plans` |
| `network_capacity_commitments` | Reservations against a slot | → `network_capacity_slots` |

### Critical design points

**`network_service_area_members` is the anti-duplication table.** It holds a
polymorphic reference to either a `distribution_zones` row or a `logistics_cities`
row. No place name, no coordinates, no governorate is copied. If this table ever
grows a `city_name` column, the design has failed.

**Capacity is multi-dimensional.** `network_capacity_slots` carries separate
available/committed figures for orders, weight, volume and stops, because the
binding constraint differs by product mix. A single "capacity" integer would be
wrong for half the catalogue.

**Commitments have a TTL.** A soft reservation held while an order is being placed
must expire, or abandoned baskets silently consume capacity. `expires_at` plus a
sweep job.

### Indexes

| Table | Index | Serves |
|---|---|---|
| `network_service_area_members` | (`member_type`, `member_id`) | Address → area resolution |
| `network_service_areas` | (`company_id`, `is_active`) | Active-area lookup |
| `network_capacity_slots` | (`service_area_id`, `slot_date`) | The hot capacity query |
| `network_capacity_commitments` | (`slot_id`, `status`, `expires_at`) | TTL sweep |

**Constraint:** a city may belong to at most one *active* service area per
company — the same nullable-flag unique-index pattern.

---

## 8.3 Routing (5 tables)

| Table | Purpose | Key relationships |
|---|---|---|
| `routing_route_plans` | A plan for one trip | → `distribution_trips` |
| `routing_route_legs` | Ordered legs | → `routing_route_plans` |
| `routing_route_stop_refs` | Sequence position per stop | → `routing_route_plans`, → `distribution_delivery_stops` |
| `routing_optimization_runs` | Immutable audit: snapshot, strategy, output | → `routing_route_plans` |
| `routing_eta_projections` | Per-stop ETA at a refinement level | → `routing_route_stop_refs` |

### Critical design points

**`routing_optimization_runs` stores the full input snapshot** as a JSON document.
This is the single most valuable table in V2 for the AI roadmap: it is a growing
corpus of (problem, chosen solution, actual outcome) triples from day one, at
negligible cost.

**Plans supersede, never update.** `superseded_by_plan_id` is nullable and
self-referencing. A reroute writes a new plan; the old one stays readable, which is
what makes "why did we drive that way?" answerable.

**`routing_route_stop_refs` points at Distribution's stop, it does not copy it.**
Address, customer and order stay in V1.

### Indexes

| Table | Index | Serves |
|---|---|---|
| `routing_route_plans` | (`trip_id`, `superseded_by_plan_id`) | Current plan lookup |
| `routing_route_stop_refs` | (`route_plan_id`, `sequence`) | Ordered read |
| `routing_route_stop_refs` | (`stop_id`) | Reverse lookup from a stop |
| `routing_eta_projections` | (`stop_ref_id`, `refinement_level`) | Latest ETA |
| `routing_optimization_runs` | (`company_id`, `created_at`) | Strategy performance analysis |

### Lifecycle

Plans and legs are retained 12 months. `routing_optimization_runs` snapshots are
large; retain 90 days hot, then archive the snapshot payload while keeping the
run's metadata and outcome indefinitely.

---

## 8.4 Dispatch (6 tables)

| Table | Purpose | Key relationships |
|---|---|---|
| `dispatch_boards` | One per (origin, date) | → `companies`, → `branches` or warehouse |
| `dispatch_policies` | Named, versioned assignment rules | → `companies` |
| `dispatch_proposals` | A generated set of assignments | → `dispatch_boards`, → `dispatch_policies` |
| `dispatch_proposed_assignments` | trip ⇄ vehicle ⇄ driver with score | → `dispatch_proposals`, → `distribution_trips`, → `logistics_vehicles`, → `logistics_drivers` |
| `dispatch_assignment_blockers` | Why an assignment cannot proceed | → `dispatch_proposed_assignments` |
| `dispatch_releases` | The act of committing to V1 | → `dispatch_proposals` |

### Critical design points

**`dispatch_proposed_assignments` references V1 vehicle and driver by ID and stores
no attributes of either.** It stores the *score* and the *reason*, which are V2's
contribution.

**`dispatch_releases` records the V1 call outcome** — the created/updated trip id
and the assignment id returned by `DriverVehicleAssignmentService`. This is the
audit trail proving V2 went through V1 rather than around it, and it is what makes
the boundary verifiable after the fact.

**Proposals are immutable once decided.** A re-run creates a new proposal.

### Indexes

| Table | Index | Serves |
|---|---|---|
| `dispatch_boards` | unique (`company_id`, `origin_id`, `board_date`) | One board per origin-day |
| `dispatch_proposed_assignments` | (`proposal_id`, `status`) | Board rendering |
| `dispatch_proposed_assignments` | (`trip_id`) | Trip → assignment lookup |
| `dispatch_assignment_blockers` | (`assignment_id`) | Blocker list |

---

## 8.5 Telemetry (5 tables) — *optional deployment*

| Table | Purpose | Volume |
|---|---|---|
| `telemetry_sources` | A configured position source per asset | Low |
| `telemetry_tracked_assets` | Assets with tracking enabled | Low — one per tracked vehicle |
| `telemetry_position_snapshots` | **Latest position per asset** | Low — one row per asset, upserted |
| `telemetry_position_pings` | Raw history | **Very high — ~7M/day at target scale** |
| `telemetry_geofences` | Zones for entry/exit detection | Low |
| `telemetry_geofence_events` | Entry/exit occurrences | Medium |

### Critical design points

**The hot/cold split is the whole design.** Every user-facing query reads
`telemetry_position_snapshots` — one row per asset. Nothing on a user's request
path ever touches `telemetry_position_pings`.

**`telemetry_position_pings` is partitioned by day** and never joined to anything
in a user-facing query. Historical analysis runs as a job.

**Retention is tiered** ([§5.6](05-DRIVER-MOBILE-PLATFORM.md#56-telemetry-volume-and-retention)):
snapshots current, raw pings 7–30 days, simplified per-trip traces 12 months,
daily aggregates indefinitely.

**Every one of these tables can be absent.** No foreign key from any other context
points into `telemetry_*`. References go the other way, or through an
application-level id with no constraint. This is what makes Directive 5
structurally true rather than a policy.

### Indexes

| Table | Index | Serves |
|---|---|---|
| `telemetry_position_snapshots` | unique (`asset_id`) | The live map read |
| `telemetry_position_pings` | (`asset_id`, `recorded_at`) within partition | Trace replay |
| `telemetry_geofence_events` | (`asset_id`, `occurred_at`) | Event history |

Deliberately **no** spatial index on `position_pings` — the query patterns are
"latest per asset" and "trace for one asset over a window", neither of which is
spatial. Adding a spatial index to a 7M-row/day table would cost far more than it
returns.

---

## 8.6 Carriers (8 tables)

| Table | Purpose | Key relationships |
|---|---|---|
| `carrier_accounts` | A connected account | → `logistics_shipping_companies` (1:N) |
| `carrier_capabilities` | Declared capability set per account | → `carrier_accounts` |
| `carrier_service_mappings` | Carrier service code ⇄ ECOS service level | → `carrier_accounts`, → `network_service_levels` |
| `carrier_status_mappings` | Carrier status ⇄ ECOS `DeliveryStatus` / `FailureReason` | → `carrier_accounts` |
| `carrier_shipments` | A tendered shipment | → `carrier_accounts`, → `delivery_deliveries` |
| `carrier_tender_attempts` | Each tender try and its outcome | → `carrier_shipments` |
| `carrier_webhook_events` | Raw + normalized inbound events | → `carrier_accounts` |
| `carrier_rate_quotes` | Cached quotes | → `carrier_accounts` |

### Critical design points

**Credentials are NOT here.** They live in the existing Provider Platform's
encrypted store. `carrier_accounts` holds a provider reference, not a secret.

**`carrier_status_mappings` is data, not code.** A new carrier status can be mapped
by configuration; only genuinely new *behaviour* requires an adapter change. An
unmapped status is recorded and surfaced rather than guessed.

**`carrier_webhook_events` stores the raw payload alongside the normalized result.**
This is what makes replay possible after a mapping bug — the single most valuable
recovery mechanism in any webhook integration.

**`carrier_shipments` is 1:1 with a `delivery_deliveries` row** when tendered.
Carriers reads that row; it never writes it.

### Indexes

| Table | Index | Serves |
|---|---|---|
| `carrier_shipments` | (`carrier_account_id`, `status`) | Carrier workspace |
| `carrier_shipments` | unique (`carrier_account_id`, `tracking_number`) | Webhook → shipment resolution |
| `carrier_shipments` | (`delivery_id`) | Delivery → shipment lookup |
| `carrier_webhook_events` | unique (`carrier_account_id`, `carrier_event_id`) | **Deduplication** |
| `carrier_webhook_events` | (`processed_at`) | Backlog sweep |

### Lifecycle

`carrier_webhook_events` raw payloads: 90 days, then the raw column is purged and
the normalized result retained. Shipments follow their delivery's retention.

---

## 8.7 DriverApp, DriverOps, OperationsCenter (11 tables)

### DriverApp (4)

| Table | Purpose | Note |
|---|---|---|
| `driverapp_devices` | Registered devices | → `logistics_drivers` |
| `driverapp_sessions` | Active sessions, one per driver | Revocable |
| `driverapp_intents` | Submitted intents and their outcomes | **Deduplicated by `intent_key`** |
| `driverapp_media_tickets` | Short-lived upload authorisations | TTL |

`driverapp_intents` has a unique index on (`device_id`, `intent_key`) — this is
the idempotency guarantee, enforced by the database rather than by application
care. Intents are retained 30 days for dispute resolution.

### DriverOps (4)

| Table | Purpose |
|---|---|
| `driverops_scorecards` | Per (driver, period) — a projection |
| `driverops_scorecard_metrics` | Individual metrics with **sample size** |
| `driverops_incidents` | Performance incidents |
| `driverops_coaching_notes` | Follow-up record |

Scorecards are projections and rebuildable. Sample size is a column, not a
derived afterthought — see [§2.9](02-DOMAIN-ARCHITECTURE.md#29-context-driverops).

### OperationsCenter (3)

| Table | Purpose |
|---|---|
| `opscenter_alert_rules` | Named, versioned rules per company |
| `opscenter_alerts` | Raised alerts and their acknowledgement lifecycle |
| `opscenter_queues` | Saved filtered views — configuration |

`opscenter_alerts` has a unique index on (`company_id`, `alert_key`,
`resolved_at`) using the nullable-flag pattern, so an unresolved alert with a given
key can exist only once. This is deduplication enforced structurally.

---

## 8.8 Table count summary

| Context | Tables |
|---|---|
| Fleet | 16 |
| Network | 7 |
| Routing | 5 |
| Dispatch | 6 |
| Telemetry | 6 *(optional)* |
| Carriers | 8 |
| DriverApp | 4 |
| DriverOps | 4 |
| OperationsCenter | 3 |
| **Total** | **59** *(53 if Telemetry is not deployed)* |

Plus one permission-seed migration per context, following the LOG-005 pattern.

**Zero V1 tables are modified**, subject to §8.9.

---

## 8.9 Additive V1 extensions requiring approval

The design needs exactly two touches on V1. Both are additive, neither changes
existing semantics, and neither is assumed — **both require explicit CTO approval.**

### V1-EXT-1 — Coordinates on geography *(recommended)*

**What:** add nullable `latitude` / `longitude` to `logistics_cities`, and
optionally to Distribution's stop or the customer address, so Routing has
coordinates to work with.

**Why:** route optimisation needs points. Today ECOS geocodes nothing.

**Risk:** very low. Nullable columns, no behaviour change, no existing query
affected.

**Alternative if refused:** hold coordinates in a `routing_geocoded_locations`
table keyed by address hash. This keeps V1 completely untouched at the cost of a
lookup and a slow drift between the two stores. Workable, but the duplication is
real and P2 argues against it.

### V1-EXT-2 — Fleet verdict in `Vehicle::canBeDispatched()` *(optional)*

**What:** allow LOG-003's `Vehicle::canBeDispatched()` to consult an injected,
nullable `FleetReadinessQueryInterface`, defaulting to "no opinion" when Fleet is
absent.

**Why:** makes an unfit vehicle unusable even when Dispatch is bypassed.

**Risk:** low but non-zero — it changes a V1 method used by LOG-005's
`openAttempt()`, and LOG-003's own tests cover it.

**Alternative if refused:** enforcement stays at the Dispatch layer only, per
[§3.4](03-FLEET-ARCHITECTURE.md#34-the-readiness-seam). This is the default
assumption throughout this design; nothing else depends on the extension.

---

## 8.10 Cross-cutting conventions

| Convention | Rule |
|---|---|
| Identity | BIGINT PK for joins; `uuid` as the public API `id` |
| Company scoping | `company_id` on every root aggregate; branch/warehouse where relevant |
| Soft delete | Only where an entity can be withdrawn without losing history; ledgers never |
| Actor stamps | `created_by`, plus per-transition actor on every state change |
| Money | Amount + currency together, always — matching V1's maintenance-record pattern |
| Quantities | `decimal(12,3)` — matching LOG-005's return lines |
| Timestamps | UTC in storage, rendered in the operator's timezone |
| Enums | PHP backed enums with `label()`, `values()`, `options()`, `allowedTransitions()` |
| Index names | ≤ 64 characters — MySQL's limit already broke `migrate:fresh` once in this codebase |
| Foreign keys | Within a context and to V1: real FKs. Into `telemetry_*`: never |
