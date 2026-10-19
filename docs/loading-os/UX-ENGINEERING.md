# Loading & Allocation OS — UX Engineering

**Document:** UX-ENGINEERING  
**Version:** 1.0  
**Status:** APPROVED — Engineering Design Phase  
**Date:** 2026-07-05  
**Task:** TASK-LOAD-001  
**Parent:** BLUEPRINT.md

---

## 1. Design Principles

1. **Exception-driven UI.** The normal flow should be invisible. Dispatchers only intervene when exceptions are raised.
2. **Real-time state.** Status badges and counts update in real-time via WebSocket (Reverb). No page refresh required.
3. **Mobile-first for workers and drivers.** Warehouse workers and drivers use mobile interfaces. Dispatchers and managers use desktop.
4. **Every action is one click from the exception.** If something needs attention, the notification and the button to resolve it are in the same place.
5. **Keyboard shortcuts for power users.** Every primary action is accessible by keyboard shortcut for dispatchers who process sessions daily.

---

## 2. Navigation Structure

```
Operations
└── Loading & Allocation
    ├── Dashboard          /loading/dashboard          ← Entry point
    ├── Sessions           /loading/sessions           ← All loading sessions
    ├── Vehicle Planning   /loading/vehicle-plans      ← Plan review + override
    ├── Allocation         /loading/allocations        ← Allocation review center
    ├── Drivers            /loading/drivers            ← Driver status + manifest
    └── Analytics          /loading/analytics          ← KPIs + trends
```

---

## 3. Loading Dashboard

**Route:** `/loading/dashboard`  
**Primary users:** Loading Manager, Loading Dispatcher  
**Layout:** Full-page workspace with KPI strip, session cards, exceptions panel

### 3.1 KPI Strip (Top Row)

Six cards, live-updating:

| Card | Metric | Color Logic |
|---|---|---|
| Active Sessions | Count of sessions in `loading` or `allocation_review` | Blue |
| Vehicles Loading | Count of assignments in `loading` | Orange |
| Awaiting Approval | Count of assignments in `allocation_review` | Amber (pulsing if > 0) |
| Pool Available | Count of `prepared_products_pool` entries in `available` | Green |
| Open Exceptions | Count of unresolved `loading_exceptions` | Red (pulsing if > 0) |
| Released Today | Count of sessions closed today | Grey |

### 3.2 Session Cards Panel

Each active Loading Session displayed as a card:
- Session number + planning date
- Status badge (color-coded)
- Progress bar: vehicles loaded / total vehicles
- Exceptions badge (red dot if open)
- Quick actions: [Open] [View Exceptions] [Approve All]

### 3.3 Exceptions Panel (Right Sidebar)

- Lists all unresolved exceptions, sorted by severity
- Each exception: type icon + description + [Resolve] button that opens the relevant entity
- Filter tabs: All / Capacity / Route / Shipping Policy / AI Bottleneck

### 3.4 AI Panel (Collapsible, Right Side)

- Next Best Action card (EP-LOAD-AI-07)
- Capacity predictions for next 3 days (EP-LOAD-AI-04)
- Bottleneck alerts from background job (EP-LOAD-AI-06)

### 3.5 Loading States

- Initial load: skeleton cards for all panels
- Session cards: individual shimmer per card while loading
- KPI strip: 0 placeholder until loaded

### 3.6 Empty State

When no active sessions exist:
```
[Icon: truck outline]
No active loading sessions today

[Button: Create Loading Session]   [Button: View History]
```

---

## 4. Vehicle Planning Workspace

**Route:** `/loading/sessions/{id}/vehicle-plans`  
**Primary users:** Loading Manager, Loading Dispatcher  
**Layout:** Two-panel — plan list left, slot detail right

### 4.1 Plan List (Left Panel)

Lists all VehiclePlans for the session:
- Zone name + shipping company
- Slot count badge
- Status badge: `draft` / `planner_review` / `approved`
- AI confidence indicator (if AI planning was used)
- [Approve] button (manager only, disabled for non-managers)

### 4.2 Slot Detail (Right Panel)

Selected VehiclePlan's slots:
- Each slot: vehicle plate (if assigned), order count, weight bar (X kg / Y kg max), status
- Drag handles: dispatcher can drag-drop orders between slots
- [+ Add Slot] / [− Remove Slot] buttons (manager only)
- [Move Order] button: opens order selector to move one order to another slot

### 4.3 Order List within Slot

Expandable per slot:
- Order number, customer name, zone, value, payment method icon (COD / paid), items count
- Priority score badge (AI-provided when available)
- [Remove from Slot] — moves order to unassigned

### 4.4 Unassigned Orders Panel (Bottom)

- Orders not yet in any slot (from geography resolution failures or manual removal)
- [Assign to Slot] button per order

### 4.5 Capacity Visualization

Per slot, show:
- Weight bar: gradient green → amber → red as capacity fills
- Volume bar: same
- Order count bar: same
- "87% capacity" label with tooltip showing breakdown

### 4.6 Smart Toolbar

```
[← Back to Session]  [Zone: All ▼]  [Status: All ▼]  [Approve All Plans]
```

### 4.7 Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `A` | Approve selected plan |
| `R` | Recalculate selected plan |
| `←` / `→` | Navigate between vehicle plans |
| `Enter` | Expand/collapse slot detail |

---

## 5. Allocation Workspace

**Route:** `/loading/sessions/{id}/allocation`  
**Primary users:** Loading Manager, Loading Dispatcher  
**Layout:** Three-column — vehicle list, allocation matrix, order detail

### 5.1 Vehicle Column (Left)

- Each vehicle assignment as a card
- Status badge: `allocated` / `partial` / `approved`
- Partial count badge (red): "2 partial allocations"
- [Approve] button: visible when status = `allocated`, no partials

### 5.2 Allocation Matrix (Center)

For selected vehicle:
- Grid: rows = products, columns = orders
- Cell: allocated qty / ordered qty
- Partial cells highlighted amber
- Unallocated cells highlighted red
- Totals row: vehicle inventory used vs available per product

**Cell interactions:**
- Click cell → opens inline editor for qty adjustment
- Right-click → context menu: [Move to Order], [Mark as Partial], [Defer Order]

### 5.3 Order Detail (Right Drawer)

When an order row is selected:
- Order summary: number, customer, value, payment method
- Line items: product, ordered qty, allocated qty, status
- Notes field for partial resolution reason
- [Accept Partial] / [Defer Order] / [Substitute Product] buttons

### 5.4 Bulk Actions Toolbar

```
[Select All] [Approve Selected] [Resolve All Partials: Accept] [Export Manifest]
```

### 5.5 AI Suggestion Banner

When allocation_mode = `ai_suggested`:
```
[AI Icon] AI suggested allocation with 97% satisfaction score — confidence 0.83
[Accept AI Suggestions]  [Review Individually]  [Dismiss]
```

### 5.6 Partial Allocation Summary Bar

Sticky bar at bottom when partials exist:
```
⚠️  3 partial allocations require resolution  [Resolve All]  [Export Shortage Report]
```

---

## 6. Vehicle Workspace

**Route:** `/loading/vehicles/{assignmentId}`  
**Primary users:** Loading Manager, Loading Dispatcher, Warehouse Worker  
**Layout:** Header bar + tabs

### 6.1 Header Bar

- Vehicle plate number (large)
- Driver name + avatar
- Status badge (large, color-coded)
- Capacity gauge: weight (animated progress bar)
- ETA to departure countdown

### 6.2 Tabs

| Tab | Content |
|---|---|
| **Overview** | Vehicle details, capacity summary, loading progress |
| **Loading Tasks** | Task list with worker assignments, completion checkboxes |
| **Inventory** | Loaded products list: product, qty loaded, pool source |
| **Allocation** | Order allocation table (same as Allocation Workspace but vehicle-scoped) |
| **Route** | Route plan: stop sequence, distance, ETAs |
| **Timeline** | Vehicle assignment timeline events |
| **Documents** | Manifests, loading records |
| **AI** | Vehicle-specific AI suggestions + delivery risk score |

### 6.3 Loading Tasks Tab

Each task shows:
- Product name + SKU
- Quantity to load
- Assigned worker (or unassigned)
- Status: `pending` / `in_progress` / `completed` / `discrepancy`
- Scan confirmation badge

**Mobile-optimized version** (same route on mobile):
- Single task at a time, full-screen
- Large [✓ Done] button
- Barcode scan trigger button

---

## 7. Driver Workspace

**Route:** `/loading/driver/{driverId}` (Desktop) + Mobile App  
**Primary users:** Drivers (mobile-primary)  
**Layout:** Mobile-first card stack

### 7.1 Desktop View (Manager perspective)

- Driver name, photo, vehicle plate
- Status: `available` / `assigned` / `loading` / `on_route` / `returning`
- Today's route summary: X stops, Y km estimated
- Last location update timestamp
- [Contact Driver] button

### 7.2 Mobile View (Driver's own device)

**Screens:**
1. **Assignment Card** — vehicle plate, departure time, stop count
2. **Route Screen** — stop list with address, customer name, items to deliver
3. **Stop Detail** — order items, delivery notes, [Mark Delivered] / [Report Issue] buttons
4. **Manifest** — PDF viewer of delivery manifest
5. **Return Screen** — [I'm Back at Warehouse] button

**Data available offline:**
- Route list
- Order items per stop
- Customer contact numbers
- Manifest PDF

---

## 8. Shipment Groups Workspace

**Route:** `/loading/sessions/{id}/shipment-groups`  
**Purpose:** Manage how orders are grouped into physical shipments for each vehicle

### 8.1 Layout

- Table: Shipment Group | Vehicle | Orders | Products | Weight | Status
- Filter: by vehicle, by zone, by status
- [Create Group] button for manual grouping
- [Auto-Group] button to regenerate groups based on current vehicle plan

### 8.2 Group Detail Drawer

- Shipment group header: Group code, vehicle, zone, shipping company
- Order table: order number, items, weight, delivery window
- [Split Group] / [Merge Groups] actions
- Documents tab: attach packing lists, manifests

---

## 9. Exceptions Workspace

**Route:** `/loading/sessions/{id}/exceptions`  
**Primary users:** Loading Manager, Loading Dispatcher  
**Layout:** Table with resolve panel

### 9.1 Exception Table Columns

| Column | Description |
|---|---|
| Severity | CRITICAL / HIGH / MEDIUM / LOW icon |
| Type | Capacity / Route Constraint / Shipping Policy / AI Bottleneck / Stock Discrepancy |
| Description | Human-readable exception message |
| Entity | Link to affected entity (vehicle plan, assignment, order) |
| Raised At | Timestamp |
| Status | `open` / `acknowledged` / `resolved` |
| Actions | [Resolve] [Acknowledge] [Escalate] |

### 9.2 Resolve Panel (Right Slide-in)

- Exception detail
- Suggested resolution (AI or rule-based)
- Resolution form: type + notes
- [Confirm Resolution] button

---

## 10. Analytics Workspace

**Route:** `/loading/analytics`  
**Primary users:** Loading Manager, Operations Viewer  
**Layout:** Filter bar + chart grid

### 10.1 Filters

- Date range picker
- Warehouse selector
- Shipping company selector

### 10.2 Chart Grid

| Chart | Type | Metric |
|---|---|---|
| Sessions per Day | Bar chart | Daily session volume |
| Vehicles per Session | Line + range | Avg / min / max vehicles |
| Loading Time | Histogram | Minutes from session create to last vehicle loaded |
| Allocation Success Rate | Gauge | % of orders with full allocation |
| Partial Allocation Trend | Line | Partial allocation % over time |
| Capacity Utilization | Stacked bar | Per-vehicle type utilization |
| Exception Frequency | Bar (stacked by type) | Exceptions per session |
| On-Time Departure | Gauge | % vehicles departing within 15 min of plan |

---

## 11. Detail Drawers

### 11.1 Vehicle Drawer

Opens from: Session cards, Vehicle Planning Workspace, any vehicle reference  
Tabs: Overview, Loading Tasks, Inventory, Allocation, Route, Timeline, Documents, AI  
Header: plate number, driver, status badge, capacity gauges

### 11.2 Allocation Drawer

Opens from: Allocation Workspace, order references  
Tabs: Summary, Line Items, History, Adjustments  
Content: full allocation matrix for this order across all vehicles + versions

### 11.3 Driver Drawer

Opens from: Driver column in assignment table, Driver Workspace  
Tabs: Profile, Today's Route, History, Documents  
Content: driver photo, license details, vehicle history, today's delivery summary

### 11.4 Loading Session Drawer

Opens from: Session list, anywhere a session is referenced  
Tabs: Overview, Vehicle Plans, Exceptions, Timeline, Documents, Analytics  
Header: session number, planning date, status, progress summary

---

## 12. Mobile Loading Interface

**Target users:** Warehouse workers  
**Device:** Android/iOS tablet or phone  
**Key screens:**

### 12.1 Worker Login

- Scan QR code on warehouse zone OR enter PIN
- Shows assigned tasks for current session

### 12.2 Task Queue Screen

- Card per task: product image + name + quantity
- Status: pending / in_progress / done
- [Start Task] → expands to full-screen task

### 12.3 Active Task Screen

- Full-screen: product name, quantity required, quantity already loaded
- [Scan Barcode] button → camera opens, scans product barcode
- Scan verified → qty counter increments
- [Mark Complete] when done
- [Report Discrepancy] if quantity doesn't match

### 12.4 Discrepancy Flow

- Reason picker: damaged / missing / wrong product / over-quantity
- Notes field (optional)
- Photo attachment (optional)
- [Submit] → creates LoadingException; supervisor notified

---

## 13. Tablet Experience (Dispatcher)

**Target:** Warehouse dispatcher standing at loading dock  
**Layout:** Optimized for 10" landscape tablet

- Simplified Vehicle Planning overview (read-only)
- Loading progress per vehicle (live updating)
- Quick exception resolve (tap to acknowledge)
- [Release Vehicle] button visible when loaded + approved

---

## 14. Loading States

| Component | Loading State |
|---|---|
| Dashboard KPI strip | Skeleton shimmer (6 grey card outlines) |
| Session cards | Shimmer card × 3 |
| Vehicle plan list | Table skeleton (5 rows) |
| Allocation matrix | Grey grid with spinner in center |
| Chart grid | Skeleton rectangle per chart |
| Drawer tabs | Grey tabs + content skeleton |

---

## 15. Error States

| Error | Display |
|---|---|
| Network error loading session | Red banner: "Could not load session — [Retry]" |
| Action failed (API error) | Toast: red background, error.code + human message |
| Optimistic update failed | Revert UI + toast: "Action failed — state restored" |
| Session cancelled while viewing | Full-page banner: "This session has been cancelled" with [Return to Dashboard] |
| Vehicle plan recalculated while viewing | Banner: "Plan was updated — [Reload Plan]" |

---

## 16. Empty States

| Context | Empty State |
|---|---|
| No sessions today | Truck outline icon + "No sessions planned" + [Create Session] |
| No exceptions | Green checkmark + "No open exceptions" |
| No vehicles assigned | Vehicle outline + "No vehicles assigned yet" + [Assign Vehicle] |
| No allocation records | "Allocation has not been run yet" + [Run Allocation] |
| No AI suggestions | "AI analysis not available for this session" |

---

## 17. Keyboard Shortcuts (Dispatcher Desktop)

| Shortcut | Action |
|---|---|
| `N` | New Loading Session |
| `A` | Approve (context-sensitive) |
| `R` | Recalculate vehicle plan |
| `E` | Open Exceptions panel |
| `/` | Focus search |
| `Escape` | Close drawer / cancel |
| `1`–`8` | Switch drawer tab (when drawer open) |
| `Ctrl+Enter` | Confirm action in modal |
