# §13 — Security

Built on the existing IAM module: `permission:` middleware
(`RequirePermissionMiddleware`), `BasePolicy` with an injected
`PermissionServiceInterface`, and `Gate::before()` in `IamServiceProvider` giving
system roles an unconditional bypass. V2 adds no new authorisation mechanism.

---

## 13.1 Permission model

**37 permissions across nine contexts** — the full catalogue is in
[§10.9](10-API-ARCHITECTURE.md#109-permission-catalogue).

Two layers, exactly as LOG-005 established:

| Layer | Enforces | Mechanism |
|---|---|---|
| Route middleware | *May this user perform this kind of action at all?* | `permission:<name>` |
| Policy | *May they do it to **this** record?* | Company / branch / fleet scoping |

Middleware alone is insufficient because it cannot express "this vehicle belongs to
your company". Policies alone are insufficient because they do not gate
collection endpoints cleanly. Both are required.

### Separation of duties

The permission split is deliberate and recurring:

| Split | Prevents |
|---|---|
| `fleet.inspection.perform` vs. `.approve` | A driver signing off their own failed inspection |
| `fleet.fuel.record` vs. `.reconcile` | The person entering a fuel purchase clearing their own anomaly |
| `fleet.maintenance.schedule` vs. `.complete` | Marking work done that was never scheduled or performed |
| `dispatch.propose` vs. `.release` | An automated proposal committing itself |
| `network.capacity.manage` vs. `.commit` | Sales raising the ceiling to fit their own order |
| `telemetry.view` vs. `.history.view` | Casual access to a driver's movement history |
| `fleet.health.override` (standalone) | Routine dismissal of safety blockers |

This follows LOG-005's POD `capture` vs. `validate` precedent, which existed for
the same reason: evidence should not be self-certified.

### Role templates

Suggested, not enforced — role composition stays an operator decision.

| Role | Permissions |
|---|---|
| Fleet Supervisor | `fleet.*` except `health.override`; `operations.view` |
| Fleet Manager | All `fleet.*`; `driverops.view` |
| Dispatcher | `dispatch.view/propose/release`; `routing.view/optimize`; `fleet.view`; `network.view`; `operations.view` |
| Operations Manager | `operations.*`; view on everything; `dispatch.release` |
| Carrier Manager | `carrier.*`; `operations.view` |
| Driver | `driver.app.access` only |
| Finance | `fleet.cost.view`; `carrier.view`; `operations.view` |
| Network Planner | `network.*`; `operations.view` |

The Driver role holding exactly one permission is the point: the mobile app is a
client, and its user needs no domain permissions because the server performs every
action on their behalf after checking the driver's own scope.

---

## 13.2 Record-level scoping

Every V2 policy enforces at minimum:

```
company scope   the record's company_id matches the actor's
branch scope    where the context is branch-aware (dispatch boards, fleets)
fleet scope     a supervisor may be limited to named fleets
driver scope    a driver reaches only their own assigned trip
```

The driver scope is the strictest and is enforced **server-side from the
assignment**, never from a parameter the client sends. The chain is: session →
driver → active `logistics_driver_vehicle_assignments` row → trip → stops. A
client-supplied trip id is validated against that chain, never trusted.

---

## 13.3 Audit

ECOS already has `ConfigAuditService` and the Enterprise Event Platform's
actor-stamped immutable events (ADR-011). V2 uses both rather than adding a third
audit mechanism.

**Always audited, with actor and reason:**

| Action | Why it matters |
|---|---|
| Fitness override | Someone dispatched a vehicle the system called unfit |
| Defect dismissal (critical) | A safety finding was closed without repair |
| Inspection approval | Who certified the vehicle |
| Fuel dispute resolution and write-off | Money |
| Dispatch release | Which human committed resources |
| Manual assignment override | A human overruled the optimiser |
| Capacity ceiling change | Commercial exposure |
| Carrier credential change | Reuses the Provider Platform's rotation audit |
| Status-mapping change | Alters how carrier events are interpreted |
| Telemetry enable/disable per asset | Privacy-relevant |
| Driver device revocation | Access control |
| Alert rule change | Alters what the operation is told about |

Audit records are immutable, actor-stamped, timestamped, and carry the *reason
string* where one was required. An override without a reason must be impossible to
submit.

---

## 13.4 GPS privacy

Location data about identifiable employees is the most sensitive data V2 handles,
and the design treats it that way.

### Collection

| Control | Rule |
|---|---|
| Shift-bound | Collection only within an open shift. Enforced **server-side** — pings outside a shift window are rejected, not merely "not sent" |
| Purpose-bound | Operational use only: dispatch, ETA, dispute resolution |
| Driver-visible | The driver can see that tracking is active and when it stopped |
| Vehicle-oriented | Tracking is of the *asset*; the driver link is derived from the assignment and is itself scoped |
| Consent | Recorded per driver per employment agreement; captured in Drivers, referenced by Telemetry |

### Access

| Access | Permission | Notes |
|---|---|---|
| Live position, current shift | `telemetry.view` | Operational necessity |
| Historical trace | `telemetry.history.view` | **Separate, higher permission** |
| Trace of a specific past date | `telemetry.history.view` + audited | Every access logged with actor and reason |
| Export | `telemetry.history.view` + explicit approval | Audited |

Historical location access being separately permissioned *and audited* is the
control that distinguishes operational tracking from employee surveillance.

### Retention and minimisation

- Raw pings: 7–30 days, configurable. The default should be the shorter end.
- After that: a simplified per-trip trace, sufficient for dispute resolution.
- After 12 months: aggregates only — distance, moving time, idle time. Not a path.
- Off-shift positions: never stored. If a ping arrives outside a shift, it is
  discarded at ingestion, not stored-and-filtered.

### Legal posture

Where jurisdiction requires it: documented lawful basis, driver notification,
access rights, and deletion procedures. This is deliberately deferred to legal
review rather than assumed — the architecture supports whatever the answer is,
because retention windows and permissions are configuration.

---

## 13.5 Mobile security

Full treatment in [§5.8](05-DRIVER-MOBILE-PLATFORM.md#58-mobile-security-model).
The essentials:

| Control | Rule |
|---|---|
| Auth | Sanctum token bound to a device fingerprint |
| Sessions | One per driver; a new device revokes the old, audited |
| Revocation | Immediate; local cache wiped on next contact |
| At rest | Encrypted local store; task cache purged when the trip closes |
| Media | Direct-to-storage with short-lived scoped tickets; no permanent credentials on device |
| Transport | TLS with certificate pinning |
| Compromised devices | Root/jailbreak detection reported; policy decides |

**Data minimisation on device:** today's stops only. No pricing, no margins, no
other drivers, no settlement figures, no customer history. A lost phone should
expose one day of one driver's work.

---

## 13.6 Carrier integration security

| Concern | Control |
|---|---|
| Credentials | Existing Provider Platform's encrypted store — **never in `carrier_*` tables** |
| Queue isolation | `ProviderCredentialContext`, already built for exactly this |
| Rotation | Provider Platform's rotation, with audit |
| Webhook authenticity | Signature verified **inside the adapter** before any processing |
| Webhook replay | Deduplicated by carrier event id |
| Webhook flooding | Per-account rate limiting; raw persist is cheap, processing is queued |
| Outbound egress | Allow-listed carrier endpoints |
| PII to carriers | Minimum necessary — name, address, phone. Never order value unless COD requires it |

The webhook endpoint is the only unauthenticated route in V2. It is therefore the
one that gets signature verification, rate limiting, fast acknowledgement and
queued processing — in that order.

---

## 13.7 Data ownership and residency

| Data | Owner | Notes |
|---|---|---|
| Vehicle, driver, carrier identity | V1 modules | V2 holds FKs only |
| Fleet condition, cost | V2 Fleet | Company-scoped |
| Location | V2 Telemetry | Employee-related; strictest treatment |
| Route plans and optimisation snapshots | V2 Routing | May contain customer addresses — same protection as CRM |
| Carrier shipment data | V2 Carriers | Shared with the carrier by necessity |
| Driver performance | V2 DriverOps | Employee-related; access-restricted |

**Two categories that are easy to under-protect and must not be:**

1. **Optimisation snapshots** contain full customer addresses. They are a
   customer-data store, not a technical log, and inherit CRM-grade protection and
   retention.
2. **Driver scorecards** are employment data. Access is restricted to the driver
   themselves and their management chain, not to all of operations.

### Multi-tenancy

Every V2 root aggregate carries `company_id`. Every policy checks it. The existing
tenant-isolation test suite (23/23 in TASK-ENTERPRISE-STABILIZATION-001) should be
extended to cover the nine new contexts rather than a new suite being written.

---

## 13.8 Security test requirements

| # | Test |
|---|---|
| 1 | Every V2 route requires authentication |
| 2 | Every V2 route enforces its declared permission (403 without) |
| 3 | Cross-company access is refused for every V2 aggregate |
| 4 | A driver cannot reach another driver's trip, stop or delivery |
| 5 | A driver cannot reach a trip they are not currently assigned to |
| 6 | Fitness override without a reason is refused |
| 7 | A critical defect cannot be dismissed without `fleet.health.override` |
| 8 | An inspection with a failed critical item cannot be approved by its performer |
| 9 | Telemetry pings outside an open shift window are rejected |
| 10 | Historical telemetry access is refused with `telemetry.view` alone |
| 11 | Historical telemetry access is audited |
| 12 | A carrier webhook with an invalid signature is rejected |
| 13 | A replayed carrier webhook has no additional effect |
| 14 | Carrier credentials never appear in any API response |
| 15 | POD artifact storage paths never appear in any API response |
| 16 | A driver device token is invalid immediately after revocation |
| 17 | The driver task projection contains no pricing or settlement data |
