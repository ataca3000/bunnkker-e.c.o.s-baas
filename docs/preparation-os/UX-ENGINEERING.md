# Preparation OS — UX Engineering

**Document:** UX-ENGINEERING  
**Version:** 1.0  
**Status:** APPROVED — Engineering Design Phase  
**Date:** 2026-07-05  
**Task:** TASK-PREP-001  
**Parent:** PREPARATION-OS-BLUEPRINT.md  
**UX Standards:** docs/ux/ENTERPRISE-UX-ARCHITECTURE.md

---

## 1. Navigation Structure

```
Module Rail Entry: "Operations"

Operations
├── Preparation OS         ← /operations/preparation
│   ├── Dashboard          ← /operations/preparation          (default view)
│   ├── Waves              ← /operations/preparation/waves
│   ├── Prepared Pool      ← /operations/preparation/pool
│   ├── Stations           ← /operations/preparation/stations
│   └── Analytics          ← /operations/preparation/analytics
└── ...other OS modules
```

**Keyboard shortcuts:**
- `G + P` — Jump to Preparation OS
- `G + W` — Jump to Waves list
- `N` — New Wave (from any Preparation OS page)
- `?` — Open keyboard shortcut panel

---

## 2. Dashboard Screen

**URL:** `/operations/preparation`  
**UX Pattern:** Standard Operational Workspace (WORKSPACE-FRAMEWORK.md)  
**Refresh:** Auto-refresh every 60 seconds; manual refresh button

```
┌─────────────────────────────────────────────────────────────────────┐
│  PREPARATION OS                         [New Wave] [Refresh] [...]  │
│  Today: July 5, 2026 · Main Warehouse ▾                             │
├─────────────────────────────────────────────────────────────────────┤
│  KPI CARDS (clickable — each applies status filter to wave grid)    │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ │
│  │  3       │ │  2       │ │ 37.8%    │ │  2       │ │  6       │ │
│  │ Waves    │ │Preparing │ │Completion│ │Exceptions│ │ Workers  │ │
│  │ Today    │ │          │ │          │ │  Open    │ │  Active  │ │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘ │
│                                                                      │
│  ALERTS STRIP (only shown when alerts exist)                         │
│  ⚠ Wave PREP-202607-000002 blocked: 43.5kg Almond Extract shortage   │
│  [View Wave] [Dismiss]                                               │
├─────────────────────────────────────────────────────────────────────┤
│  ACTIVE WAVES                           [View All Waves →]          │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │ PREP-202607-001  Preparing  125 orders  44.8% ████░░░░░░        ││
│  │ Started 09:00 · Ahmed + 2 others · 0 exceptions     [Open →]    ││
│  ├─────────────────────────────────────────────────────────────────┤│
│  │ PREP-202607-002  Blocked ⚠  87 orders   0%                      ││
│  │ Shortage: Almond Extract · Waiting on procurement   [Resolve]   ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                      │
│  PREPARED POOL SUMMARY                                               │
│  0 products ready for loading · 0 units available                   │
│  [View Pool →]                                                       │
└─────────────────────────────────────────────────────────────────────┘
```

**KPI Card Interactions:**
- Clicking "Waves Today" → opens Waves list filtered to today's planning_date
- Clicking "Preparing" → opens Waves list filtered to `status=preparing`
- Clicking "Exceptions Open" → opens Waves list sorted by open_exceptions DESC
- Clicking "Workers Active" → opens Worker Status panel

---

## 3. Waves Workspace

**URL:** `/operations/preparation/waves`  
**UX Pattern:** WORKSPACE-FRAMEWORK.md + DATAGRID-STANDARD.md

### Status Tabs
```
[All (N)] [Draft (N)] [Planning (N)] [Blocked (N)] [Preparing (N)] [Completed (N)] [Cancelled (N)]
```

### KPI Cards (above grid, same as dashboard but filtered by current tab)

### Smart Toolbar
```
[Views: Table ▾] [Filters ▾] [Bulk Actions ▾] [🤖 AI] [Import] [Export]

Active Filters: planning_date = Today ×  warehouse = Main ×  [Clear All]
```

### DataGrid Columns (default visible)

| Column | Type | Notes |
|---|---|---|
| Wave # | text | Link to detail drawer |
| Status | badge | Color-coded per status |
| Planning Date | date | |
| Orders | int | Count |
| Products | int | Count |
| Required | decimal | Total units |
| Prepared | decimal | Total prepared units |
| Completion | progress bar | %, color: green/amber/red |
| Shortage | badge | Yes/No — only shown if Yes |
| Exceptions | int | Open exceptions count; 0 is hidden |
| Workers | avatars | Up to 3 avatars + overflow count |
| Created | relative time | "2 hours ago" |
| Actions | icon menu | Start, Complete, Cancel, View |

**Row actions:**
- Single-click → Select row (for bulk actions)
- Double-click / click wave number → Open detail drawer

### Bulk Actions
- `Cancel selected waves` (requires reason modal)
- `Export to CSV`

### AI Panel (EP-AI-02)
When `🤖 AI` is clicked, right panel opens:
```
AI Insights
──────────
▸ Wave PREP-001 has high shortage risk based on current material levels
▸ Yesterday's pattern suggests 8AM start minimizes delays
▸ 3 orders in Wave PREP-001 are approaching SLA deadline

[See all recommendations →]
```

---

## 4. Wave Detail Drawer

**UX Pattern:** DETAIL-DRAWER-STANDARD.md — Wide (90% viewport)  
**Opens:** From wave list row click or wave number link

```
┌──────────────────────────────────────────────────────────────────────┐
│  PREP-202607-000001                          [Start] [Complete] [×]  │
│  Preparing · July 5, 2026 · Main Warehouse                           │
│  125 orders · 12 products · 4,215 units required                     │
│  ████████████░░░░░░░░ 44.8% (1,890 of 4,215 units)                  │
├──────────────────────────────────────────────────────────────────────┤
│  [Summary] [Products] [Materials] [Orders] [Workers] [Timeline] [Docs]│
└──────────────────────────────────────────────────────────────────────┘
```

### Tab: Summary
```
Wave Status Card
  Status: Preparing
  Started: 09:00 by Ahmed Hassan
  Approved: 08:45 by Mohammed Al-Rashid

Progress
  Products: 5 of 12 prepared (41.7%)
  Units: 1,890 of 4,215 (44.8%)
  Short items: 1 (HONEY-500G: 2 units short)

Workers (3)
  Ahmed Hassan — Operator — Zone A picking
  Fatima Khalil — Operator — Zone B picking
  Mohammed Al-Rashid — Supervisor

Exceptions (0)
  No open exceptions

Actions
  [Add Worker] [Add Exception] [Cancel Wave]
```

### Tab: Products

DataGrid showing all WaveItems:
| Column | Content |
|---|---|
| Product | Thumbnail + SKU + Name |
| Required | Quantity |
| Prepared | Quantity + progress bar |
| Short | Quantity (hidden if 0) |
| Status | Badge |
| Location | Zone + Shelf |
| Action | [Update Qty] |

Inline update: Clicking [Update Qty] opens a popover to enter prepared quantity without leaving the drawer.

### Tab: Materials

DataGrid showing all MaterialRequirements:
| Column | Content |
|---|---|
| Material | Name + Unit |
| Required | Qty |
| Available | Qty (snapshot) |
| To Purchase | Qty |
| Shortage | Badge (only if shortage = true) |
| Status | Resolved? |

Shortage items are highlighted in amber. Resolved items show green checkmark.

### Tab: Orders

Compact list of all orders in this wave:
| Column | Content |
|---|---|
| Order # | Link (opens Order detail in another drawer) |
| Customer | Name (masked: "M. Hassan") |
| Zone | Delivery zone |
| Added | Time |

### Tab: Workers

Active and historical worker assignments:
| Column | Content |
|---|---|
| Name | Worker name |
| Role | Badge |
| Assigned | Time |
| Released | Time (blank if active) |

Actions: [Assign Worker] [Release Worker]

### Tab: Timeline
Per TIMELINE-UX-STANDARD.md. Shows all wave events in chronological order with actor and timestamp.

### Tab: Documents
Per DOCUMENTS-UX-STANDARD.md. Upload/view documents related to this wave (e.g., QC reports).

---

## 5. Demand Panel

**Accessed from:** Wave drawer → Summary → [Generate Demand] button  
**Pattern:** Modal (not a new page) — medium size

```
┌──────────────────────────────────────┐
│  Generate Product Demand             │
│  Wave: PREP-202607-000001            │
├──────────────────────────────────────┤
│  This will sum all product quantities│
│  across 125 orders in this wave.     │
│                                      │
│  ┌─────────────────────────────────┐ │
│  │  Orders: 125                    │ │
│  │  Products: calculating...       │ │
│  │  Units: calculating...          │ │
│  └─────────────────────────────────┘ │
│                                      │
│  [Cancel]           [Generate →]     │
└──────────────────────────────────────┘
```

After generation, drawer auto-navigates to Products tab showing all items.

---

## 6. Material Analysis Panel

**Accessed from:** Wave drawer → Materials → [Analyze Materials]  
**Pattern:** Right panel within drawer (not modal)

Shows real-time progress as MRP runs:
```
Analyzing 12 products...
  ✓ Raw Honey — 3 materials
  ✓ Coffee Blend — 5 materials
  ⚠ Almond Butter — SHORTAGE: 43.5 kg
  ...

Results: 2 shortages detected
[View Shortages] [Proceed Anyway (Supervisor)]
```

---

## 7. Prepared Products Pool Screen

**URL:** `/operations/preparation/pool`  
**UX Pattern:** WORKSPACE-FRAMEWORK.md

### Filter Toolbar
```
Warehouse ▾  |  Quality Status ▾  |  Wave ▾  |  Available Only [✓]
```

### DataGrid

| Column | Content |
|---|---|
| Product | Thumbnail + SKU + Name |
| Wave | Wave number link |
| Available | Qty (green if > 0) |
| Reserved | Qty (amber if > 0) |
| Loaded | Qty |
| Quality | Status badge |
| Prepared | Timestamp |
| Action | [Quality Check] [View Movements] |

### Quality Check Panel
Clicking [Quality Check] opens a popover:
```
Product: Raw Honey 500g
Wave: PREP-202607-000001
Quantity: 418.0 units

Quality Result:
○ Passed  ● Failed

Notes: (required if Failed)

[Submit Check]
```

---

## 8. Stations Screen

**URL:** `/operations/preparation/stations`  
**UX Pattern:** WORKSPACE-FRAMEWORK.md

### DataGrid

| Column | Content |
|---|---|
| Name | Station name |
| Type | Badge |
| Zone | Text |
| Capacity | N workers max |
| Active Workers | Count (avatars) |
| Status | Badge |
| Action | [Edit] [Deactivate] |

**New Station** button opens a form drawer (right panel):
```
Name (required)
Station Type (required — select)
Warehouse Zone
Capacity (optional)
Notes
```

---

## 9. Analytics Screen

**URL:** `/operations/preparation/analytics`  
**UX Pattern:** WORKSPACE-FRAMEWORK.md — Analytics variant

### Date Range Selector
```
[Last 7 days ▾]  [Main Warehouse ▾]
```

### Summary Cards (top row)
```
[Waves] [Completed] [Avg Duration] [Avg Completion%] [Shortage Rate]
```

### Charts
1. **Daily Throughput** — bar chart; units prepared per day
2. **Completion Rate Trend** — line chart; % completion over time
3. **Shortage Frequency** — top 10 products/materials most often short
4. **Wave Duration Distribution** — histogram of completion times

### Data Table
Tabular breakdown by date with drill-down to individual waves.

---

## 10. Universal DataGrid Standards

All grids in Preparation OS follow DATAGRID-STANDARD.md:
- Column visibility: Columns Manager (gear icon)
- Sorting: Click column header (single column)
- Pagination: 25 / 50 / 100 per page selector
- Row selection: Checkbox per row + header select-all
- Sticky header: Yes
- Keyboard: Arrow keys navigate rows; Enter opens detail

---

## 11. Mobile Experience

**Target device:** Warehouse floor tablet (landscape) and phone (portrait)  
**UX Pattern:** MOBILE-UX-STANDARD.md

### Primary Mobile Screens

**1. Wave Product Queue (tablet — landscape)**
```
┌──────────────────────────────────────────────────────┐
│ PREP-202607-001  Preparing           44.8% ████░░░░  │
├──────────────────────────────────────────────────────┤
│  RAW HONEY 500g                      Zone A · A-12-B  │
│  Required: 420        Prepared: 200     IN PROGRESS   │
│  [────────────────────────────────────────] 47.6%    │
│  [Update Quantity]                                    │
├──────────────────────────────────────────────────────┤
│  COFFEE BLEND                        Zone B · B-05-C  │
│  Required: 180        Prepared: 180     ✓ PREPARED    │
└──────────────────────────────────────────────────────┘
```

**2. Quick Quantity Update (phone)**
Large tap targets; numeric keypad:
```
┌─────────────────────┐
│  Raw Honey 500g     │
│  Required: 420 units│
│                     │
│  [    418     ]     │
│  ──────────────     │
│  [7] [8] [9]        │
│  [4] [5] [6]        │
│  [1] [2] [3]        │
│  [0]  [.]  [⌫]      │
│                     │
│  [Cancel] [Save ✓]  │
└─────────────────────┘
```

**3. Wave Status Overview (phone)**
Card-per-wave view; no table on small screens.

---

## 12. Loading States

| Screen | Loading Behavior |
|---|---|
| Dashboard | KPI cards show skeleton loaders; auto-retry |
| Wave list | Table skeleton (3 rows) while fetching |
| Wave drawer | Tab content loads on tab open (lazy); spinner per tab |
| Analytics | Charts show placeholder animation |
| Material analysis | Progressive results as each product is analyzed |

---

## 13. Error States

| Error | Display |
|---|---|
| Network error | Inline banner: "Could not load data. [Retry]" |
| Permission error (403) | Full-screen: "You don't have access to this page" + contact admin |
| Wave not found (404) | Full-screen: "Wave not found" + [Back to Waves] |
| Action failed (422) | Toast notification: error message from API |
| Server error (500) | Toast notification: "Something went wrong. Please try again." |

---

## 14. Empty States

| Screen | Empty State |
|---|---|
| Waves list (no waves today) | Illustration + "No waves for today" + [Create Wave] |
| Products tab (demand not generated) | "Product demand not generated yet" + [Generate Demand] |
| Materials tab (analysis not run) | "Material analysis not run yet" + [Analyze Materials] |
| Prepared Pool (empty) | "No products in the Prepared Pool" — explain pool fills after wave completion |
| Analytics (no data) | "No preparation data for this period" |

---

## 15. Keyboard Shortcuts (full list)

| Shortcut | Action | Context |
|---|---|---|
| `N` | New Wave | Waves list |
| `Enter` | Open detail drawer | Any list row focused |
| `Esc` | Close drawer / modal | Drawer or modal open |
| `G + P` | Go to Preparation OS | Global |
| `G + W` | Go to Waves | Global |
| `G + L` | Go to Pool (pooL) | Global |
| `F` | Focus filter toolbar | Any workspace |
| `?` | Open shortcut panel | Global |
| `Ctrl + E` | Export current view | Any list |
| `R` | Refresh dashboard | Dashboard |

---

## 16. Notification & Alert Integration

Preparation OS generates notifications via EPS-04 (NOTIFICATION-UX-STANDARD.md):

| Event | Notification | Recipients |
|---|---|---|
| Shortage detected | Alert (blocking) — Wave banner + push | Preparation supervisor, planner |
| Wave completed | Success — in-app toast | Creator |
| Exception raised | Alert — in-app + email | Preparation supervisor |
| Quality check failed | Alert — in-app | Preparation supervisor, loading supervisor |
| Worker assigned | Info — in-app | Assigned worker |

---

## 17. AI Panel Integration

Per AI-UX-STANDARD.md (EP-AI-01 Smart Action Chips, EP-AI-02 Workspace Panel):

**Smart Action Chips** (in wave detail):
- "Start preparation now — all materials available"
- "Shortage risk detected — consider partial wave"
- "3 orders approaching SLA — prioritize these products"

**Workspace Panel** (right side, collapsible):
- Wave bottleneck predictions
- Recommended wave start times
- Material shortage risk forecast
- Historical average for similar wave sizes
