# §5 — Driver Mobile Platform & GPS Architecture

**Directive 4:** the mobile app is an operational client only. Business decisions
remain on the server.
**Directive 5:** GPS is optional. The platform must keep working without it.

---

## 5.1 The governing idea: intents, not mutations

The device never mutates domain state. It submits **intents** — "I arrived",
"delivery failed, customer unavailable", "here is the signature", "pre-trip
inspection complete" — and the server evaluates each one against the real domain
services.

```
   Device                          Server
   ──────                          ──────
   user acts
   → intent queued locally
   → optimistic UI (clearly marked pending)
                    ──sync──▶  IntentReplayService
                                   │
                                   ├──▶ Delivery::DeliveryExecutionService
                                   ├──▶ Fleet::InspectionService
                                   └──▶ Fleet::FuelReconciliationService
                                              │
                    ◀──result──────────────────┘
   → server state replaces local
```

Three consequences, all deliberate:

1. **Every rule already built in V1 applies unchanged.** BR-1 (trip dispatched),
   BR-3 (one open attempt), BR-7 (validated POD), BR-8 (no outstanding COD) are
   enforced because the intent goes through `DeliveryExecutionService`, the same
   service the web API uses. The mobile client gets no bypass.

2. **The phone can be wrong, and that is safe.** Optimistic UI may show a
   delivery as complete; if the server refuses, the driver sees the refusal with
   the server's reason string. `ConflictResolution` is typed as `server_wins` so
   this is not a matter of discipline.

3. **No rule is duplicated on the device.** The app may *hint* — grey out a button
   for a stop that looks closed — but hints are advisory and the server never
   trusts them.

---

## 5.2 Offline-first architecture

Drivers work in basements, lifts, rural areas and buildings with no signal. Offline
is the normal case, not the error case.

### Local store

| Store | Contents | Lifetime |
|---|---|---|
| Task cache | Today's trip, stops, order summaries, customer contact | Until trip closes |
| Intent queue | Pending intents with keys, ordered | Until acknowledged |
| Media queue | Photos and signatures, compressed | Until uploaded |
| Reference cache | Failure reasons, POD requirements, checklist templates | Until version changes |
| Identity | Session token, device fingerprint | Until revoked |

The reference cache is what makes offline failure recording possible: LOG-005's
`FailureReason::catalogue()` — 15 reasons with category, retryability and
address-correction flags — is downloaded once and versioned. The driver picks a
reason offline; the server still decides what it means.

### Sync protocol

```
POST /driver/sync
  { device_id, cursor, intents: [ { key, type, payload, occurred_at }, ... ] }

200
  { accepted: [key...], rejected: [ {key, reason} ... ],
    conflicted: [ {key, server_state} ... ],
    tasks: [...], cursor, reference_versions }
```

- **Idempotency.** `IntentKey` = client UUID + monotonic sequence. Replaying a
  batch has no additional effect. This is non-negotiable on flaky mobile networks
  where a request may succeed while the response is lost.
- **Ordering.** Intents apply in the order the driver performed them, per stop.
  Out-of-order arrival is reordered server-side by sequence before replay.
- **Partial acceptance.** One rejected intent does not fail the batch. The
  response carries per-intent outcomes.
- **Cursor.** Task deltas are pulled by cursor, not full refresh, so a full day's
  work is a few kilobytes.

### Conflict handling

| Conflict | Resolution |
|---|---|
| Stop already closed by the office | Server state wins; driver told who closed it |
| Attempt no longer open | Intent rejected with the domain's own message |
| Trip cancelled mid-shift | Tasks withdrawn; driver notified with reason |
| Duplicate intent (retry) | Idempotent no-op |
| Clock skew on device | `occurred_at` retained for audit; server time is authoritative for ordering |

Recording the device's `occurred_at` while trusting server time is a small detail
that matters a lot in disputes — it preserves what the driver saw without letting
a wrong device clock corrupt the sequence.

---

## 5.3 Task synchronisation

The driver's task list is a **projection**, built by `TaskProjectionService` from
facts owned elsewhere:

| Element | Source |
|---|---|
| Trip and its stops | Distribution |
| Delivery status, attempts remaining, promised time | Delivery |
| Required POD artifacts | Delivery `delivery_pods.required_artifacts` |
| COD amount due | Delivery `delivery_cod_records` |
| Stop sequence and ETA | Routing |
| Pre-trip checklist | Fleet |

Because it is a projection, no driver-specific copy of these facts exists. The
projection is rebuilt, never edited (ADR-024).

**Scoping.** A driver sees only their own active trip. This is enforced server-side
by the driver↔vehicle assignment (LOG-002) joined to the trip — not by a filter the
client sends.

---

## 5.4 Photo and media synchronisation

Media is the heaviest payload and the most likely to fail mid-upload.

```
1. Device captures → compresses → stores locally with an intent reference
2. Device requests a MediaUploadTicket (short-lived, scoped to one intent)
3. Device uploads directly to storage, resumable, chunked
4. Device confirms; server attaches the artifact via Delivery's POD service
```

Design points:

- The **intent is independent of its media**. A delivery can be recorded before
  its photo finishes uploading; the POD simply cannot be *validated* until the
  required artifacts are present — which is precisely LOG-005's existing
  `missingArtifacts()` rule, unchanged.
- Uploads are resumable and retried with backoff; a failed upload never blocks the
  driver's next task.
- Compression targets are configurable; the default should assume a 2G-class link.
- Storage paths are never returned to any client — LOG-005 already withholds
  `file_path` from `PodResource`, and the mobile API must keep that guarantee.

---

## 5.5 GPS integration architecture

### Optionality is structural, not a setting

Telemetry is a separate context with **no inbound dependency from any decision
path**. The rules:

| Rule | Consequence |
|---|---|
| No state machine guard may read a Telemetry table | Transitions work without GPS |
| No readiness or fitness computation may read Telemetry | Dispatch works without GPS |
| No settlement or cash logic may read Telemetry | Finance works without GPS |
| Every Telemetry-derived UI element renders a `PositionFreshness` | Operators are never misled |
| Every Telemetry-driven automation has a manual equivalent | Operations continue when it degrades |

### Sources

| Source | Notes |
|---|---|
| Driver mobile app | Cheapest, no hardware; battery-sensitive; stops when the app is killed |
| Vehicle tracker hardware | Reliable, independent of the phone; capital cost |
| Carrier-provided tracking | For shipments on third-party fleets; arrives via the carrier adapter |
| None | A first-class, fully supported configuration |

All sources normalise to the same `PositionPing`, so a mixed fleet is not a
special case.

### Ingestion

```
Device/tracker ──batch──▶ Ingestion endpoint ──▶ queue ──▶ PositionIngestionService
                                                              ├──▶ PositionPing (append-only)
                                                              ├──▶ PositionSnapshot (upsert, hot)
                                                              └──▶ GeofenceEvaluationService
```

- **Batched**, never one request per ping. Default 30–60 s of buffered pings per
  request, which is also far kinder to battery than a per-ping radio wake.
- **Idempotent** by (asset, device timestamp).
- **Back-pressure aware.** Under load, ingestion sheds the historical write and
  keeps only the snapshot update. A degraded live map is acceptable; a queue
  collapse that takes down dispatch is not.
- `PositionSnapshot` is the single hot row per asset and is what the live map
  reads. Nothing user-facing scans `position_pings`.

### Degradation ladder

```
L3  Live GPS                 → precise position, live ETA, automatic arrival hints
L2  Stale GPS (> threshold)  → last-known shown WITH staleness; automation suspended
L1  No GPS, driver check-ins → position inferred from the stop the driver acted on
L0  No GPS, no check-ins     → plan-based inference only; UI states "no signal"
```

The transition between levels is published (`TelemetrySourceDegraded`,
`AssetWentDark`) so the operations centre *sees the degradation* rather than
silently trusting an old dot on a map. Silent staleness is the specific failure
mode this design is built to prevent.

### Battery and privacy

- Adaptive ping rate: frequent while moving between stops, sparse while stationary,
  suspended outside shift hours.
- Tracking is **shift-bound**. Collection stops when the driver ends their shift —
  enforced server-side by rejecting pings outside an open shift window, not by
  trusting the app to stop sending.
- Full privacy treatment in [§13](13-SECURITY.md#134-gps-privacy).

---

## 5.6 Telemetry volume and retention

At the design target — 500 vehicles, one ping per 5 s, 10 h/day — raw ingest is
roughly **7 million rows per day**. This single figure drives three decisions:

| Decision | Rationale |
|---|---|
| Telemetry is its own context with its own storage policy | Its retention needs are unlike any other logistics data |
| `position_pings` is partitioned by day and never joined in user-facing queries | Keeps hot paths off cold data |
| Tiered retention | Raw data loses value quickly; aggregates do not |

**Retention tiers**

| Tier | Content | Retention | Purpose |
|---|---|---|---|
| Hot | `PositionSnapshot` (1 row/asset) | Current | Live map |
| Warm | Raw pings | 7–30 days, configurable | Dispute resolution, replay |
| Cold | Per-trip route trace, simplified | 12 months | Historical route analysis |
| Aggregate | Distance, moving time, idle time per vehicle-day | Indefinite | Cost and utilisation KPIs |

Trace simplification (Douglas–Peucker or similar) typically cuts stored points by
an order of magnitude with no visible loss on a map.

**If Telemetry is not deployed at all, none of these tables exist and nothing else
changes.** That is the test of Directive 5.

---

## 5.7 Navigation integration

The app hands off to the device's native navigation (Google Maps, Waze, Apple
Maps) rather than embedding a map engine.

| Aspect | Decision |
|---|---|
| Turn-by-turn | Native app via deep link |
| Which app | Driver preference, per device |
| Sequence | ECOS owns it; navigation gets one destination at a time |
| Return signal | None assumed — the driver comes back and taps "arrived" |

Rationale: embedded navigation is expensive to license, heavy on battery, and
worse than what drivers already use daily. The valuable part — *which stop is
next* — is ours; the turn-by-turn is a commodity.

Because no return signal is assumed, navigation hand-off is stateless and works
identically with or without Telemetry.

---

## 5.8 Mobile security model

| Concern | Approach |
|---|---|
| Authentication | Sanctum token bound to a device fingerprint |
| Session | One active session per driver; a new device revokes the old, with an audit event |
| Authorisation | Server-side; the driver's own assigned trip only |
| Revocation | Immediate; the device is signed out and the local cache is wiped on next contact |
| Offline data at rest | Encrypted local store; task cache purged when the trip closes |
| Media | Direct-to-storage with short-lived scoped tickets; no permanent credentials on device |
| Rooted / jailbroken devices | Detected and reported; policy decides whether to block |
| Transport | TLS only; certificate pinning |

**Deliberately absent from the device:** pricing rules, margins, customer lists
beyond today's stops, other drivers' data, any settlement figure. A lost phone
should expose one day of one driver's work and nothing more.

---

## 5.9 Mobile capability set

What the driver can do, and which server service actually decides it:

| Capability | Server authority |
|---|---|
| View today's trip and stops | `TaskProjectionService` (projection) |
| Pre-trip inspection | Fleet `InspectionService` |
| Accept the trip / custody | Distribution `TripService` |
| Start a stop | Delivery `DeliveryExecutionService` |
| Mark arrived | Delivery `DeliveryExecutionService` |
| Capture POD (signature, photo, OTP) | Delivery `PodValidationService` |
| Record COD collection | Delivery `CodCompletionService` (reporting only) |
| Record a failure with a reason | Delivery `DeliveryExecutionService` |
| Record a customer return | Delivery `DeliveryReturnService` |
| Log a fuel stop | Fleet `FuelReconciliationService` |
| Report a defect | Fleet `InspectionService` |
| Navigate to a stop | Native app (no server) |
| End shift | `DeviceSessionService` |

Every row in that right-hand column is an existing or newly designed **server**
service. There is no row where the device is the authority. That is Directive 4,
made checkable.
