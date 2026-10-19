# Enterprise Workspace Framework

**Document:** WORKSPACE-FRAMEWORK  
**Version:** 1.0  
**Status:** APPROVED — Architecture Only  
**Date:** 2026-07-05  
**Task:** TASK-UX-ARCH-001  
**Parent:** ENTERPRISE-UX-ARCHITECTURE.md

---

## 1. Mission

> Define the **Universal Enterprise Workspace** — the container that every ECOS module, OS, and view must use.

A user who opens the Inventory OS for the first time and has only used the Procurement OS should immediately know where the search is, where the filters are, where the actions are, and how to open a record. The Workspace Framework makes this possible.

---

## 2. Workspace Anatomy

Every ECOS workspace follows this structural hierarchy:

```
┌──────────────────────────────────────────────────────────────────────┐
│  GLOBAL NAVIGATION BAR (persistent, top or left rail)                │
│  Company Switcher · Module Rail · Global Search · Notifications      │
│  User Menu · AI Assistant · Command Palette                          │
├──────────────────────────────────────────────────────────────────────┤
│  MODULE HEADER                                                        │
│  Module name · Breadcrumbs · Primary Create Action · More Actions    │
├──────────────────────────────────────────────────────────────────────┤
│  WORKSPACE TABS  (optional — for modules with lifecycle states)       │
│  [All (N)] [Status A (N)] [Status B (N)] ... scrollable, sticky      │
├──────────────────────────────────────────────────────────────────────┤
│  KPI / SUMMARY CARDS  (optional — for operational modules)            │
│  Clickable cards that apply instant filters; live counts             │
├──────────────────────────────────────────────────────────────────────┤
│  SMART TOOLBAR  (see SMART-TOOLBAR-STANDARD.md)                       │
│  Views · Filters · Bulk Actions · Smart Actions · AI · Import/Export │
├──────────────────────────────────────────────────────────────────────┤
│  MAIN CONTENT AREA                                                    │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  DATAGRID / BOARD / CANVAS / CALENDAR                        │   │
│  │  (see DATAGRID-STANDARD.md)                                  │   │
│  └──────────────────────────────────────────────────────────────┘   │
├──────────────────────────────────────────────────────────────────────┤
│  STATUS BAR (optional)                                               │
│  Record count · Active filters summary · Last synced                │
└──────────────────────────────────────────────────────────────────────┘

When a record is selected:
┌──────────────────────────────────────────┐
│  DETAIL DRAWER (slides in from right)    │
│  (see DETAIL-DRAWER-STANDARD.md)         │
└──────────────────────────────────────────┘
```

---

## 3. Workspace Components

### 3.1 Module Header

| Element | Required | Description |
|---|---|---|
| Module name | Yes | Large, clear module identity |
| Breadcrumbs | Conditional | Required when workspace is nested > 1 level |
| Primary Create Action | Conditional | Required for modules with create operations |
| Header Actions | Optional | Secondary actions (Settings, Help, etc.) |
| Context indicators | Optional | Active company, active channel, active date |

### 3.2 Workspace Tabs

Workspace Tabs provide **status-first navigation**. They are:
- **Horizontally scrollable** — never wrap to a second row
- **Live counts** — each tab shows a count badge (capped at 999+)
- **Sticky** — remain visible when scrolling the content area
- **Tabs reset page to 1** on switch

**When to include Workspace Tabs:**
- Module has objects with lifecycle states (Orders, Waves, POs, etc.)
- Module benefits from pre-filtered views (e.g. "My Tasks", "Pending Approval")

**When to omit:**
- Reference data modules (Categories, Units, etc.)
- Single-entity views (Company Settings, Profile)

### 3.3 KPI / Summary Cards

Summary Cards provide instant operational context at a glance. They are:
- **Clickable** — each card applies an instant filter to the grid
- **Live** — data refreshes automatically (configurable interval)
- **Compact** — 4–6 cards per row maximum; 2 columns on mobile

**Card anatomy:**

```
┌───────────────────────┐
│  Icon  Label          │
│  N     sublabel       │
│  ▲ +3 vs yesterday    │  (optional trend)
└───────────────────────┘
```

**When to include KPI Cards:**
- Operational workspaces (Orders, Waves, Inventory, Manufacturing)
- Modules where supervisor needs situational awareness

**When to omit:**
- Simple CRUD modules (Units, Categories)
- Configuration screens

### 3.4 Demand Panel

For modules that support demand analysis (Inventory, Manufacturing, Products):
- Triggered by a "Show Demand" button in the toolbar
- Opens as a collapsible panel above or alongside the grid
- Powered by the Demand Analysis Engine (EPS-01 events + AI)
- Follows the same panel anatomy as AI Insights

### 3.5 Smart Toolbar

See `SMART-TOOLBAR-STANDARD.md`. Required for all operational modules.

### 3.6 Main Content Area

Three layout modes. Each module specifies which modes it supports:

| Mode | When to use |
|---|---|
| **Grid (default)** | Data-heavy modules; all operational OS |
| **Board** | Workflow-oriented modules (Kanban-style); Preparation OS, CRM pipeline |
| **Canvas** | Spatial/planning views; Vehicle Planning, Route Planning |
| **Calendar** | Time-based modules; Operational Day planning, Scheduling |

Mode switcher is in the Smart Toolbar (View Modes section).

### 3.7 Status Bar

Optional bottom bar showing:
- Total record count and filtered count
- Summary of active filters (as removable chips)
- Last data refresh timestamp
- AI processing status (when background analysis is running)

---

## 4. Workspace Variants

### 4.1 Standard Operational Workspace

The default. Used by: Inventory OS, Manufacturing OS, Procurement OS, Logistics OS, POS, CRM.

**Required components:** Module Header + Workspace Tabs + KPI Cards + Smart Toolbar + DataGrid

### 4.2 Command Center Workspace

For supervisory dashboards. Used by: Operations Command Center, Fulfillment Dashboard.

**Required components:** Module Header + KPI Cards (large) + Exception Feed + Smart Actions  
**Optional components:** Live Map, Wave Board, AI Feed

### 4.3 Configuration Workspace

For settings and administration. Used by: Configuration OS, Admin panels.

**Required components:** Module Header + Category Navigation (sidebar) + Settings Form  
**No grid** — replaced with structured form sections

### 4.4 Planning Workspace

For batch planning and optimization. Used by: Wave Builder, Vehicle Planning, Demand Planning.

**Required components:** Module Header + Summary Cards + Main Canvas/Board + Action Panels  
**Drawer behavior**: Planning items open in a split-panel, not a drawer

### 4.5 Analytics Workspace

For executives and reporting. Used by: Analytics OS.

**Required components:** Module Header + Date Range Picker + Dashboard Tiles  
**No grid** — replaced with charts, KPI tiles, and summary tables

---

## 5. Workspace Memory

Every workspace persists user preferences. The following state is always remembered:

| State | Scope | Persistence |
|---|---|---|
| Active tab | Per module | Session + localStorage |
| Active filters | Per module | Session only (cleared on navigation away) |
| Saved filters / views | Per module | Persistent (server-side for multi-device) |
| Column visibility | Per module | Persistent |
| Column widths | Per module | Persistent |
| Row density | Global | Persistent |
| Sort field + direction | Per module | Session |
| Rows per page | Per module | Persistent |
| View mode (grid/board/canvas) | Per module | Persistent |
| Drawer width | Global | Persistent |
| Sidebar collapsed state | Global | Persistent |

**Implementation:** Server-side user preferences (via TASK-ARCH-007 foundation). localStorage is a fallback for anonymous or unauthenticated views only.

---

## 6. Workspace Loading States

| State | UI Pattern |
|---|---|
| **Initial load** | Skeleton rows (8 rows) + skeleton toolbar |
| **Filtering / sorting** | Spinner overlay on grid only; toolbar stays active |
| **Background refresh** | Subtle indicator in Status Bar; grid does not re-render unless data changed |
| **Optimistic update** | Show change immediately; revert if server responds with error |
| **Empty state** | Contextual empty state with primary action (create) |
| **Error state** | Error message + Retry button; partial data shown where available |

---

## 7. Workspace Keyboard Shortcuts

Every workspace must support these universal shortcuts:

| Shortcut | Action |
|---|---|
| `Cmd/Ctrl + K` | Open Command Palette |
| `Cmd/Ctrl + F` | Focus Smart Toolbar search |
| `Cmd/Ctrl + N` | Primary Create Action |
| `Escape` | Close active drawer / close active panel |
| `?` | Show keyboard shortcut help |
| `G then H` | Go to Home (dashboard) |
| `G then [module key]` | Jump to module |
| `Arrow Up/Down` | Navigate grid rows when grid is focused |
| `Enter` | Open selected row in Detail Drawer |
| `Space` | Toggle row selection |

Module-specific shortcuts are added on top of the universal set, never replacing them.

---

## 8. Workspace Performance Standards

| Metric | Target |
|---|---|
| Time to Interactive (initial load) | < 1.5 seconds |
| Filter response time | < 300 ms |
| Row click → Drawer open | < 150 ms |
| Background data refresh | Every 30s (configurable); no UI disruption |
| Virtual scroll re-render | < 16 ms per frame |

---

## 9. Workspace Governance

| Rule | Constraint |
|---|---|
| UX-GOV-012 | Every workspace must follow this framework — no structural deviations |
| UX-GOV-001 | Entities always open in Detail Drawer — never navigate to a new full page |
| Every workspace | Must have a loading state, empty state, and error state |
| KPI Cards | Must be backed by real-time data from EPS-01 events |
| Workspace memory | Preferences must be server-side (not localStorage-only) |
