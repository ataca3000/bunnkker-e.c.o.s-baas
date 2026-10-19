# DataGrid — Standard

**Document:** DATAGRID-STANDARD  
**Version:** 1.0  
**Status:** APPROVED — Architecture Only  
**Date:** 2026-07-05  
**Task:** TASK-UX-ARCH-001  
**Parent:** ENTERPRISE-UX-ARCHITECTURE.md

---

## 1. Mission

> Define the **Universal DataGrid** — the primary data display component used in every ECOS workspace. Every grid looks the same, behaves the same, and supports the same power features.

---

## 2. Grid Anatomy

```
┌─ Sticky Header ─────────────────────────────────────────────────────┐
│ ☐ │ Col A ↕ │ Col B ↕ │ Col C     │ Col D         │ ⋮ Actions      │
├──────────────────────────────────────────────────────────────────────┤
│ ☐ │ value   │ value   │ ● Badge   │ 1,234.00      │ [Edit] [More ▼]│  ← Row (hover shows actions)
├──────────────────────────────────────────────────────────────────────┤
│ ☐ │ value   │ value   │ ● Badge   │ value         │                │
│ ...                                                                  │
├──────────────────────────────────────────────────────────────────────┤
│  AGGREGATION ROW (optional)                                          │
│  ─    ─       ─          Total: 12,450.00  ─                        │
└──────────────────────────────────────────────────────────────────────┘
  ← Page 1 of 24  ·  240 total records  ·  25 per page  →
```

---

## 3. Column Types

| Type | Display | Example |
|---|---|---|
| `text` | Plain string | Name, SKU, Notes |
| `number` | Right-aligned, formatted | Quantity, Price |
| `currency` | Right-aligned, `EGP 1,234.00` | Cost, Total |
| `percentage` | Right-aligned, `12.5%` | Margin, Waste |
| `date` | Formatted per locale | Created At |
| `datetime` | Date + time, formatted | Occurred At |
| `badge` | Status badge with dot | Status, Type |
| `avatar` | User avatar + name | Assigned To |
| `link` | Clickable to related object | Customer, Supplier |
| `image` | Thumbnail (32×32) | Product photo |
| `boolean` | ✓ / — | Active, Published |
| `actions` | Hover-reveal action buttons | Edit, More |
| `progress` | Progress bar | Completion % |
| `ai_insight` | AI flag/indicator | Risk level, Anomaly |

---

## 4. Universal Grid Features

### 4.1 Infinite Scroll vs. Pagination

ECOS supports both. Per workspace:

| Mode | When to use |
|---|---|
| **Pagination** (default) | Most operational workspaces; user needs to know position |
| **Infinite scroll** | High-volume scanning workspaces (e.g. Wave picking list) |

Pagination shows: `← Page N of M · X total · [25 ▼ per page] ·→`

### 4.2 Grouping

Rows can be grouped by any categorical column.

```
▼ Status: Confirmed (45)
  │ ORD-001 · Ahmed Al-Rashidi · 450.00
  │ ORD-002 · Nour Market · 1,200.00
▼ Status: Preparing (12)
  │ ORD-023 · ...
```

**Behavior:**
- Group headers show count and optional aggregate (total value)
- Groups are collapsible (persist state per user)
- Grouping is triggered from Smart Toolbar → Group By

### 4.3 Hierarchy / Expandable Rows

For nested data (e.g. Order Lines inside Orders, Wave Items inside Waves):

```
▶ ORD-001 · Ahmed Al-Rashidi · 3 lines
  ▶ Honey 500g × 12 · 540.00
  ▶ Coffee Blend × 6 · 360.00
  ▶ Medjool Dates × 4 · 300.00
▶ ORD-002 · Nour Market · 1 line
```

### 4.4 Column Profiles / Saved Layouts

Users can save named column configurations:

| Action | Description |
|---|---|
| Save layout | Save current column visibility + width + order as a named layout |
| Load layout | Apply a saved layout |
| Default layout | System default, always restorable |
| Share layout | Managers can share layouts with team |

### 4.5 Inline Editing

Supported for simple field edits without opening the Detail Drawer.

**Behavior:**
- Double-click a cell → enters edit mode
- Tab moves to the next editable cell in the row
- Enter saves; Escape cancels
- Validation occurs on save; error shown as tooltip
- Only enabled on specifically marked columns

**Fields that support inline editing:** Text, Number, Select/Badge, Date  
**Fields that never support inline editing:** Complex relationships, multi-value fields

### 4.6 Bulk Editing

When multiple rows are selected and bulk edit is triggered:

- A **Bulk Edit Panel** slides in from the right (not a modal)
- Only fields common to all selected rows are shown
- Empty field = "keep current value"; filled field = apply to all
- Preview shows "Will affect N rows"
- Confirm applies the changes; progress bar shows if async

### 4.7 Selection Memory

Grid remembers which rows are selected as the user:
- Sorts the grid (selection preserved by row ID, not position)
- Filters the grid (hidden rows are deselected; remembered if filter is removed)
- Navigates between pages (selection preserved across pages)
- Refreshes data (selection preserved if rows still exist)

"Select all on this page" vs. "Select all N records" — both are available when grid has many pages.

### 4.8 Keyboard Navigation

| Key | Action |
|---|---|
| `Arrow Up/Down` | Move focus between rows |
| `Enter` | Open focused row in Detail Drawer |
| `Space` | Toggle selection on focused row |
| `Shift + Space` | Range-select from last selection to focused row |
| `Cmd/Ctrl + A` | Select all visible rows |
| `Tab` | Move focus to next interactive column |
| `Escape` | Close edit mode / clear selection |
| `Home / End` | Jump to first / last row |

### 4.9 Aggregation Row

An optional sticky row at the bottom of the grid showing column aggregates:

```
Count: 45  ·  Subtotal: EGP 45,230.00  ·  Avg Margin: 28.3%
```

Supported aggregations: Count, Sum, Average, Min, Max (per column type)

### 4.10 Color Rules

Rows can be conditionally colored based on field values:

| Rule | Color | Example |
|---|---|---|
| Status = Blocked | error-subtle background | Blocked waves, overdue orders |
| SLA remaining < 2h | warning-subtle background | Orders at SLA risk |
| Stock = 0 | error-subtle background | Out of stock items |
| AI anomaly detected | warning-subtle with AI icon | Unusual patterns |

Color rules are configured per workspace; not hardcoded in grid component.

### 4.11 AI Insights Column

An optional column that shows AI-generated insights per row:

```
⚡ High risk     (delivery failure prediction > 70%)
⚠ Anomaly       (cost deviation detected)
💡 Suggestion   (can be merged with Wave #46)
```

Clicking the AI insight opens the AI Panel focused on that row.

---

## 5. Row Actions

### Hover-Reveal Pattern

```
[ Checkbox ] [ data ] [ data ] [ data ]  [ Edit ]  [ More ▼ ]  ← visible on hover/focus
```

**Rules:**
- Primary action (Edit/View/Approve) is always shown first
- More menu contains secondary actions
- Destructive actions (Delete) are always in More menu, never as hover buttons
- On mobile, actions are always visible (no hover state on touch)

---

## 6. Density Options

Three density modes, user-configurable:

| Mode | Row height | Font size |
|---|---|---|
| Compact | 32px | 12px |
| Comfortable (default) | 40px | 14px |
| Spacious | 52px | 14px (more padding) |

---

## 7. Status Indicators

Status indicators are always the same badge component from the Design Language. Grid-specific additions:

- **Row-level indicator**: colored left border (2px) on rows with error/warning status
- **Cell-level indicator**: icon + tooltip for specific cell warnings
- **Count badges**: in group headers and aggregation rows

---

## 8. Grid Performance

| Target | Value |
|---|---|
| Initial render (50 rows) | < 100ms |
| Scroll frame rate | 60fps (virtual scrolling for > 100 rows) |
| Sort response | < 200ms |
| Inline edit commit | < 100ms |
| Column resize | Real-time (no jank) |

---

## 9. Governance

| Rule | Constraint |
|---|---|
| UX-GOV-008 | DataGrid follows this standard — no custom table implementations |
| Column types | Only registered column types allowed; custom renderers via plugin API |
| Actions column | Always the last column; never in the middle |
| Checkbox column | Always the first column when selection is enabled |
| No nested grids | Deep nesting > 2 levels requires a different pattern (e.g. drill-down page) |
