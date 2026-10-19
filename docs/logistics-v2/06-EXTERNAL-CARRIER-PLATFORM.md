# §6 — External Carrier Platform

**Directive 6 governs this document:** carrier integrations use the Adapter
Pattern. No carrier-specific business logic may leak into the core domain.

---

## 6.1 What already exists, and what V2 adds

V1's **LOG-001 Shipping Companies** owns carrier *identity*: the company record,
its contracts (`logistics_shipping_contracts`, one active per company) and the
ECOS-company mapping. That does not change.

ECOS also already has a **Provider Platform** (TASK-PROVIDER-PLATFORM-001) built
for Meta but deliberately generic: `ProviderRegistry`,
`ProviderCapabilityEngine`, `ProviderCredentialService`,
`ProviderCredentialContext` (queue isolation), `ProviderHealthMonitor`, secret
rotation, a `ValidatorRegistry` and a 20-event audit catalogue.

**Decision (P2 applied to infrastructure):** the Carriers context *reuses* that
platform for registry, credential storage, rotation, health monitoring and audit.
It builds only what is genuinely carrier-shaped.

| Concern | Where it lives |
|---|---|
| Carrier identity, contract, commercial terms | **LOG-001** (unchanged) |
| Credential storage, rotation, queue isolation | **Provider Platform** (reused) |
| Capability declaration and negotiation | **Provider Platform** (reused, extended vocabulary) |
| Connection health monitoring | **Provider Platform** (reused) |
| Shipment lifecycle, tendering, labels, tracking | **V2 Carriers** (new) |
| Carrier↔ECOS status translation | **V2 Carriers adapters** (new) |

This avoids a second credential vault and a second health monitor, which is
exactly the duplication Directive 2 exists to prevent.

---

## 6.2 Carrier abstraction

The core domain knows a carrier only through two things: a `CarrierAccount` and
`CarrierAdapterInterface`. It never knows a carrier's name.

```
CarrierAdapterInterface

    capabilities(): CarrierCapabilitySet
    quote(RateRequest): RateQuote[]
    tender(TenderRequest): TenderResult
    label(CarrierShipment): CarrierLabel
    track(TrackingNumber): CarrierTrackingSnapshot
    cancel(CarrierShipment): CancellationResult
    parseWebhook(RawWebhookPayload): NormalizedCarrierEvent
    verifyWebhookSignature(RawWebhookPayload): bool
```

### The four rules that make this an anticorruption layer

**1. Foreign vocabulary stops at the adapter.**
`NormalizedCarrierEvent` speaks ECOS: `DeliveryStatus`, `FailureReason`,
`AttemptStatus` — the enums LOG-005 already defines. A carrier's
`"OUT_FOR_DEL"`, `"NDR_CNA"` or `"RTO_INITIATED"` never travels past its adapter.

**2. Unmappable is explicit, never silent.**
When a carrier sends a status with no ECOS equivalent, the adapter raises
`CarrierStatusUnmapped` carrying the raw value. The event is recorded and
surfaced to the Carrier Workspace as an integration gap. It is never coerced to a
"closest" status, because a wrong status silently applied to a customer's order is
worse than a visible gap.

**3. Capabilities are declared, then asked.**
Carriers differ enormously — some offer rating, some don't; some support
cancellation, some don't; some push webhooks, some require polling. The core calls
`capabilities()` and adapts. A missing capability is a normal answer.

| Capability | Meaning if absent |
|---|---|
| `rating` | No rate shopping; contract rates from LOG-001 are used |
| `label_generation` | Carrier prints its own; ECOS stores the tracking number only |
| `webhooks` | Fall back to scheduled polling |
| `cancellation` | Cancellation is a manual, out-of-band process |
| `proof_of_delivery` | ECOS POD is not available for these shipments |
| `cod` | COD cannot be tendered to this carrier |
| `multi_piece` | One shipment per order only |

**4. Adapters write nothing.**
An adapter returns data. It does not write a `delivery_*` row, does not dispatch a
domain event of another context, and does not call another module's service. A
listener in `Carriers` receives the normalized event and calls Delivery's own
services — so BR-7 (POD required), BR-8 (COD settled) and every other Delivery rule
still apply to a carrier-delivered order.

### File boundary

```
Carriers/Infrastructure/Adapters/
    Aramex/AramexAdapter.php          ← the ONLY place "Aramex" appears
    Bosta/BostaAdapter.php
    Mylerz/MylerzAdapter.php
    Generic/CsvManifestAdapter.php    ← for carriers with no API at all
```

An architecture test should assert that no carrier brand name appears anywhere
outside `Carriers/Infrastructure/Adapters/**` and configuration.

The `CsvManifestAdapter` is worth calling out: many regional carriers have no API.
Modelling manifest-file exchange as *just another adapter* means the rest of the
platform cannot tell the difference, and a carrier can be upgraded from CSV to API
without any change outside its own folder.

---

## 6.3 Shipment lifecycle

```
draft ──▶ tendering ──▶ tendered ──▶ in_transit ──▶ delivered
   │           │            │             │
   │           ▼            │             ├──▶ exception ──▶ in_transit
   │       rejected         │             │
   │                        ▼             └──▶ returned
   └──▶ cancelled ◀─────────┘
```

| State | Meaning |
|---|---|
| `draft` | Shipment prepared, not yet sent |
| `tendering` | Tender in flight to the carrier |
| `tendered` | Carrier accepted; tracking number issued |
| `rejected` | Carrier refused (out of area, oversize, COD limit) |
| `in_transit` | Carrier is moving it |
| `exception` | Carrier reported a problem; may recover |
| `delivered` | Terminal success |
| `returned` | Terminal — returning to origin |
| `cancelled` | Terminal — cancelled before or during transit |

`CarrierShipment` is 1:1 with a `delivery_deliveries` row when an order is tendered
externally. This is the join that lets one Delivery Command Center cover both own-fleet
and carrier deliveries — the operator sees one queue, not two systems.

### Mapping to Delivery

The normalized carrier event drives Delivery through Delivery's own API:

| Carrier event | ECOS effect |
|---|---|
| Accepted | `DeliveryStatus::Scheduled` |
| Picked up / in transit | `DeliveryStatus::InTransit` |
| Out for delivery | `DeliveryStatus::OutForDelivery` |
| Delivered | Attempt succeeded; POD attached if the carrier supplies one |
| Failed attempt | Attempt failed with a mapped `FailureReason` |
| Returning | `DeliveryStatus::Returning` |
| Returned to origin | `DeliveryStatus::Returned` |

Two consequences of routing this through Delivery rather than around it:
retry policy is identical for own-fleet and carrier orders, and if a carrier
supplies no POD, `PodValidationService` must be configured with an empty required
set for that carrier's shipments — an explicit policy decision, recorded on the
POD, rather than a silent skip of BR-7.

---

## 6.4 Multi-carrier management

### Tendering decision

```
TenderRequest ──▶ CarrierSelectionService ──▶ TenderDecision
                          │
                          ├── eligibility  (coverage, weight, COD, service level)
                          ├── health       (is this carrier answering?)
                          ├── rates        (if rating is supported)
                          ├── performance  (historical on-time, failure rate)
                          └── policy       (allocation quotas, preferred carrier)
```

`TenderDecision` follows the verdict pattern: the chosen carrier, the ranked
alternatives, and the reason each rejected carrier was excluded. A dispatcher must
always be able to ask "why this carrier?" and get an answer.

### Selection strategies

Like Routing, selection is a strategy so the policy can change without code:

| Strategy | Objective |
|---|---|
| `CheapestEligible` | Minimum cost |
| `FastestEligible` | Minimum transit time |
| `BestPerforming` | Highest historical success in this service area |
| `QuotaBalanced` | Honour contractual volume commitments |
| `PreferredWithFallback` | Default carrier, fall back on failure or ineligibility |

### Failover

If a tender is rejected or times out, the next-ranked eligible carrier is tried,
up to a configured attempt limit. Each attempt is recorded as a `TenderAttempt`
with its outcome, so a pattern of rejections becomes visible rather than being
absorbed as retries.

---

## 6.5 Webhook architecture

```
Carrier ──POST──▶ /api/logistics/carriers/{carrier}/webhook/{accountUuid}
                        │
                        ├── signature verification (adapter)
                        ├── raw payload persisted immediately
                        ├── 200 returned FAST
                        └── queued for processing
                                 │
                                 ├── adapter.parseWebhook() → NormalizedCarrierEvent
                                 ├── deduplicate by carrier event id
                                 └── listener → Delivery services
```

Design rules:

1. **Persist raw, then acknowledge, then process.** Carriers retry aggressively
   and penalise slow endpoints. Never do domain work inside the request.
2. **Verify signatures in the adapter.** Each carrier signs differently; that is
   carrier-specific knowledge and belongs nowhere else.
3. **Deduplicate by the carrier's own event id.** Duplicate delivery is normal.
4. **Out-of-order tolerance.** Events carry the carrier's timestamp; an event
   older than the current state is recorded but does not regress the status.
5. **Replayable.** Raw payloads are retained, so a mapping bug can be fixed and
   the backlog reprocessed — which is the only realistic recovery when an adapter
   has been mis-mapping a status for a week.
6. **Per-account endpoints.** The URL carries the account UUID so one carrier with
   several accounts stays unambiguous.

---

## 6.6 Status synchronisation and reconciliation

Webhooks are necessary but never sufficient — they get lost, carriers have
outages, and some carriers have no webhooks at all.

| Mechanism | Cadence | Role |
|---|---|---|
| Webhook | Real time | Primary, when supported |
| Targeted poll | Every 15–60 min for in-flight shipments | Fills gaps; sole mechanism when webhooks are absent |
| Daily reconciliation | Nightly | Compares ECOS state against the carrier's full manifest |
| Manual refresh | On demand | Operator-triggered for a single shipment |

`CarrierReconciliationDrift` is raised when the nightly comparison finds a
mismatch. Drift is the honest measure of integration quality: a carrier whose
webhooks quietly fail shows up as rising drift long before anyone notices missing
updates.

Polling is **adaptive** — frequent near the expected delivery window, sparse
otherwise — because uniform polling across 15 carriers is both expensive and
mostly wasted.

---

## 6.7 Carrier health

Reuses `ProviderHealthMonitor` with a carrier-shaped verdict:

| Signal | Meaning |
|---|---|
| Authentication status | Credentials valid and unexpired |
| API responsiveness | Success rate and latency over a window |
| Webhook liveness | Time since the last received webhook vs. expected |
| Tender acceptance rate | Rejections as a share of tenders |
| Reconciliation drift | Mismatches per day |
| SLA performance | On-time delivery vs. contract |

`CarrierHealthVerdict` is `healthy` / `degraded` / `failing` plus the contributing
signals — again the verdict-with-reasons pattern. A `failing` carrier is excluded
from automatic selection while remaining available for manual override, so a
partial outage does not become a stalled operation.

Health degradation raises `CarrierHealthDegraded`, which surfaces in the
Operations Center alongside fleet and delivery alerts. One operator, one queue,
regardless of whether the problem is a van or an API.

---

## 6.8 Onboarding a new carrier

The measure of whether Directive 6 was honoured is how much has to change to add
carrier number sixteen:

| Step | Artifact |
|---|---|
| 1 | Create the `ShippingCompany` in LOG-001 (existing UI, no code) |
| 2 | Implement `CarrierAdapterInterface` in a new folder |
| 3 | Declare `capabilities()` |
| 4 | Provide the status mapping table |
| 5 | Register the adapter in configuration |
| 6 | Store credentials via the Provider Platform (existing UI) |
| 7 | Run the connection test and the mapping conformance suite |

**Only step 2 is code, and it is entirely new code in a new folder.** No existing
service, controller, migration or table changes. If a future carrier requires
editing anything outside its own adapter directory, the abstraction has failed and
should be fixed rather than worked around.

A shared **adapter conformance test suite** should ship with the platform: given a
fixture set of raw payloads, assert every adapter produces well-formed normalized
events and declares capabilities honestly. This turns "the adapter is correct" into
something CI can check for all fifteen carriers at once.
