# §11 — UI / UX Architecture

Built on the existing ECOS design system: Module Rail + Context Sidebar,
`WorkspaceHeader` / `WorkspacePage` / `SmartToolbar` / `PageDrawer`, Radix tabs,
`@/components/ui/*` primitives. **No new primitives.** V2 introduces feature
components only, under `frontend/src/features/logistics/<context>/`.

Conventions carried from V1: TanStack Query with per-context key prefixes;
mutations invalidate the broad prefix (ADR-024); `/options` cached with
`staleTime: Infinity`; UUID as the client-side id.

---

## 11.1 Design principles

**DD-030 — every element earns its place.** Established for Orders and applied
here: if a control does not reduce clicks, save time, or prevent an error, it does
not ship.

**Exception-first.** The default state of every operational screen is *what needs
you*, not *everything that exists*. LOG-005's Delivery Command Center is the
template.

**Refusals are explained in place.** Every disabled action states why, from the
server's own reason list. No screen may show a greyed-out button with no
explanation — this is the single most consistent UX rule in the design.

**Degradation is visible.** When GPS is stale, when a carrier is failing, when a
projection is behind — the UI says so. Silent degradation is worse than visible
failure because it produces confident wrong decisions.

---

## 11.2 Navigation

New entries in the Shipping module's context sidebar, extending the existing
Logistics section:

```
Shipping
├── Fulfillments
├── Carriers ─────────────── section
│   ├── Shipping Companies       (V1)
│   ├── Drivers                  (V1)
│   ├── Vehicles                 (V1)
│   └── Carrier Workspace        ← V2
├── Fleet ────────────────── section          ← V2
│   ├── Fleet Dashboard
│   ├── Maintenance Workspace
│   ├── Inspections
│   └── Fuel & Costs
├── Geography ───────────── section
│   └── Egypt Geography          (V1)
├── Network ─────────────── section           ← V2
│   ├── Service Areas
│   └── Capacity Planning
├── Distribution ────────── section
│   ├── Distribution Zones       (V1)
│   ├── Distribution Planning    (V1)
│   └── Dispatch Command Center  ← V2
├── Delivery ────────────── section
│   ├── Delivery & Tracking      (V1 / LOG-005)
│   └── Live Map                 ← V2, hidden when Telemetry is absent
└── Operations ──────────── section           ← V2
    ├── Operations Center
    └── Driver Performance
```

**No V1 entry is moved or renamed.** V2 adds sections and items alongside them.

`Live Map` is conditionally rendered on Telemetry deployment — the one place
Directive 5 shows up in navigation.

---

## 11.3 Desktop — the primary surface

### Operations Center

Three-band layout:

```
┌─ WorkspaceHeader ─ metrics strip (6 KPI tiles, each a filter link) ──┐
├─ SmartToolbar ─ refresh · date · origin · severity ──────────────────┤
├───────────────┬──────────────────────────────────────────────────────┤
│ Queues        │  Exception feed                                      │
│ (counts)      │  merged · deduplicated · severity-ordered            │
│               │                                                      │
│ Awaiting  12  │  ⚠ VEH-033 unfit — brake inspection lapsed 3d       │
│ Blocked    3  │    Fleet · 06:12 · 2 trips affected   [Substitute]   │
│ SLA risk   7  │                                                      │
│ Retry     22  │  ⚠ 7 deliveries predicted to breach SLA             │
│ Unfit      3  │    Routing · 09:40                    [Open queue]   │
│ Carrier    5  │                                                      │
└───────────────┴──────────────────────────────────────────────────────┘
```

Every alert row carries its source context, its age, its blast radius, and a
primary action. An alert with no action is a notification, and notifications
belong somewhere else.

### Dispatch Command Center

Board-per-origin, trip cards, blockers inline with adjacent remedies — see the
sketch in [§7.5](07-OPERATIONS-CENTER.md#75-dispatch-command-center). Bulk
"release all clean" is offered; bulk override of blockers is not.

### Fleet Dashboard

Fitness board grouped by verdict, then panels for maintenance calendar, defects,
fuel, cost, utilisation and expiring documents. The document panel reads V1's
`logistics_vehicle_documents.expires_at` — presented in V2, owned by V1.

### Maintenance Workspace

Split view: plan calendar on the left, work order detail in a `PageDrawer` on the
right. Completing a work order requires cost, odometer and description, because
those three are what the V1 record needs — the form is shaped by the V1 contract
it will satisfy.

### Carrier Workspace

Tabs: Accounts · Shipments · Rates · Health · **Unmapped statuses**.

The unmapped-statuses tab is unusual for a workspace and deliberate: it turns a
silent integration failure into a visible queue of work with a one-click mapping
action.

### Network — Service Areas & Capacity

Service Areas is a composition editor: pick existing zones and cities, attach
coverage rules. It must be *obvious* that it selects rather than creates
geography — a transfer-list, not a form with a name field.

Capacity Planning is a grid of area × date with utilisation bars, colour-coded at
thresholds, with a forecast row.

---

## 11.4 Tablet

Tablets are used on the warehouse floor and at the loading bay. Not every screen
needs a tablet layout; these do:

| Screen | Adaptation |
|---|---|
| Dispatch Command Center | Single-column boards, larger tap targets, release confirmation as a sheet |
| Fleet fitness board | Card grid, 2-up |
| Inspection execution | **Tablet-first** — large checkboxes, photo capture, one item per row |
| Live map | Full-bleed with a collapsible side panel |

Inspections are designed for tablet before desktop, because that is where they are
actually performed. Everything else adapts down.

---

## 11.5 Driver Mobile

A separate application (React Native or PWA), not a responsive squeeze of the
desktop app. Its constraints are genuinely different: one hand, sunlight, gloves,
intermittent signal, battery anxiety.

### Screens

```
Shift Start          Task List             Stop Detail
─────────────        ─────────────         ─────────────
Pre-trip             Stop 3 of 24          Customer + address
inspection           ↓                     Items · COD due
Vehicle check        ▸ 14 Zamalek St       [Navigate]
Accept custody         12:40 · COD 450     [Arrived]
[Start Shift]        ▸ 8 Gezira Rd         [Delivered] [Failed]
                       13:05
                     ⏳ 2 pending sync
```

### Non-negotiable behaviours

| Rule | Why |
|---|---|
| Every action works offline | Basements, lifts, rural routes |
| Pending items are visibly pending | The driver must never assume a queued action landed |
| Server refusals are shown verbatim | The domain's own message is the clearest one available |
| Failure reasons come from the cached catalogue | LOG-005's 15 reasons, downloaded and versioned |
| POD capture shows missing artifacts | Reuses `missingArtifacts()`; the driver sees what is still needed |
| COD shows amount due, never a settlement figure | Distribution is the Single Cash Authority |
| One-handed operation throughout | Primary actions in the thumb zone |
| High-contrast mode | Sunlight readability |
| Battery-aware telemetry | Adaptive rate; suspended off-shift |

**What the driver app never shows:** margins, pricing rules, other drivers' work,
customer history beyond today's stop, any settlement or reconciliation figure. A
lost phone should expose one day of one driver's work.

---

## 11.6 Live Map

| Element | Treatment |
|---|---|
| Live position | Solid marker, heading arrow |
| Stale position | Hollow marker with an age label |
| Dark asset | Last-known marker, explicitly labelled |
| No telemetry at all | Layer absent; banner explains; plan and stop layers remain |
| Planned route | Polyline, dimmed |
| Completed stops | Filled |
| Failed stops | Distinct, always visible even at low zoom |
| Service areas | Optional overlay |

**The freshness rule is a rendering invariant:** the component must not accept a
position without a freshness value. Enforce it in the TypeScript type, so a stale
dot rendered as live is a compile error rather than a judgement call.

Performance: reads snapshots only, clusters at low zoom, streams deltas over a
websocket.

---

## 11.7 Component inventory

Reused from the existing design system — `WorkspaceHeader`, `WorkspacePage`,
`SmartToolbar`, `PageDrawer`, `Pagination`, `Badge`, `Alert`, `Tabs`, `Select`
(`ecos-select`), `Skeleton`, `useToast`.

New **feature** components (no new primitives):

| Component | Used by |
|---|---|
| `FitnessVerdictBadge` | Fleet, Dispatch |
| `BlockerList` | Everywhere a refusal is shown |
| `MaintenanceCalendar` | Maintenance workspace |
| `InspectionChecklist` | Tablet, mobile |
| `OdometerInput` | Fuel, maintenance, inspection — enforces monotonicity client-side as a hint |
| `FuelEfficiencyChart` | Fleet dashboard |
| `CostBreakdownPanel` | Fleet, reporting |
| `CapacityGrid` | Network |
| `ServiceAreaComposer` | Network |
| `RouteSequenceList` | Routing, dispatch |
| `RouteMapLayer` | Live map |
| `DispatchBoard` / `DispatchTripCard` | Dispatch |
| `ResourcePoolPicker` | Dispatch |
| `CarrierHealthBadge` | Carrier workspace |
| `ShipmentTimeline` | Carrier workspace |
| `StatusMappingEditor` | Carrier workspace |
| `AlertFeed` / `AlertCard` | Operations center |
| `QueueSidebar` | Operations center |
| `PositionFreshnessIndicator` | Live map |
| `ScorecardPanel` | Driver performance |

`BlockerList` appearing in nine places is the point: one component, one visual
language for "here is why you cannot do that."

---

## 11.8 State and data conventions

| Concern | Approach |
|---|---|
| Server state | TanStack Query, prefix per context (`logistics-fleet`, `logistics-dispatch`, …) |
| Invalidation | Broad prefix on mutation, plus related contexts (ADR-024) |
| Reference data | `/options` per context, `staleTime: Infinity` |
| Live data | Websocket for map and alerts; 30 s polling for dashboard headlines |
| Local state | Ephemeral UI only. **No persistent local state** (ADR-024) |
| Optimistic updates | Only in the driver app, and always visibly pending |
| Identity | UUID everywhere |

**Cross-context invalidation** is a real requirement here: releasing a dispatch
board changes trips (Distribution), assignments (Drivers) and board state
(Dispatch). The mutation must invalidate all three prefixes, exactly as LOG-005's
delivery mutations invalidate both `logistics-delivery` and
`logistics-distribution`.

---

## 11.9 Accessibility and i18n

- All new strings go through the existing lazy-loaded i18n namespaces
  (TASK-I18N-ARCH-001). One namespace per context.
- RTL support via the existing CSS layer — Arabic is a first-class language here,
  and Arabic street addresses appear throughout the driver app.
- Colour is never the sole carrier of meaning: severity uses an icon plus a label,
  fitness uses a word plus a colour.
- Keyboard operation for the dispatch board — it is a high-volume repetitive
  screen and a dispatcher should not need the mouse.
- Numeric columns use `tabular-nums`, as V1's tables already do.
