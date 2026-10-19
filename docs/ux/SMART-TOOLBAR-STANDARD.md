# Smart Toolbar — Standard

**Document:** SMART-TOOLBAR-STANDARD  
**Version:** 1.0  
**Status:** APPROVED — Architecture Only  
**Date:** 2026-07-05  
**Task:** TASK-UX-ARCH-001  
**Parent:** ENTERPRISE-UX-ARCHITECTURE.md

---

## 1. Mission

> Define the **Universal Smart Toolbar** that every ECOS workspace must use — a single, consistent control surface for search, filtering, actions, and personalization.

Every module has the same toolbar. Users never search for the export button. They never wonder where the filter is. It is always in the same place, with the same layout.

---

## 2. Toolbar Anatomy

```
┌──────────────────────────────────────────────────────────────────────┐
│  LEFT ZONE                      CENTER ZONE       RIGHT ZONE         │
│                                                                      │
│  [🔍 Search...]  [Filters ▼]   [Views ▼]  [AI ✨]  [⬆ Import]      │
│                                            [Bulk Actions?]  [⬇ Export]│
│                                                         [⋮ More]     │
│                                                         [↻ Refresh]  │
└──────────────────────────────────────────────────────────────────────┘

When rows are selected:
┌──────────────────────────────────────────────────────────────────────┐
│  [✗ N selected]  [Bulk Action 1]  [Bulk Action 2]  [More ▼]  [✗ Clear]│
└──────────────────────────────────────────────────────────────────────┘
```

---

## 3. Toolbar Zones

### 3.1 Left Zone — Search

- **Single smart search input**: searches all relevant fields for the current workspace
- **Placeholder text**: "Search [entity name]..." (e.g. "Search orders...")
- **Auto-focus**: modules where speed matters (POS, order management) auto-focus search on load
- **Search scope**: shown as a label after results appear ("Showing results for 'honey'")
- **Clear button**: appears when search has text; clears instantly

### 3.2 Left Zone — Quick Filters

Active filters appear as removable chips to the right of the search input:

```
[🔍 Search...]  × Status: Pending  × Channel: WooCommerce  [+ Add Filter]
```

- Each active filter is a chip with `×` to remove
- "Clear All" appears when > 1 filter is active
- "Add Filter" opens the advanced filter panel

### 3.3 Center Zone — Views

**Saved Views** allow users to save and recall filter+sort+column combinations.

```
[Views ▼]
  ├── My Queue (saved)
  ├── Today's Pending (saved)
  ├── ─────────────────
  ├── Save current view...
  ├── Manage views...
```

**Rules:**
- Default view ("All") is always present and cannot be deleted
- Users can save up to 20 views per workspace
- Views are personal by default; Managers can share views with the team
- Active saved view name appears in the button (e.g. "My Queue ▼")

### 3.4 Center Zone — AI Suggestions

The AI Suggestions button surfaces context-aware recommendations:

```
[✨ AI: 3 suggestions]
  ├── 12 orders are at SLA risk — Review now
  ├── Wave #45 can be merged with Wave #46
  └── Supplier Ahmed Trading has 2 overdue invoices
```

**Behavior:**
- Button shows count of current suggestions (hidden when 0)
- Clicking opens an AI Suggestions panel (not a modal)
- Each suggestion has a "Take Action" and "Dismiss" button
- Dismissing sends feedback to the AI model

### 3.5 Right Zone — View Modes

Switches the main content area between Grid, Board, Canvas, Calendar:

```
[≡ Grid]  [⊞ Board]  [📅 Calendar]
```

Modes not applicable to the current workspace are hidden (not disabled).

### 3.6 Right Zone — Import

- Opens a file picker + import wizard
- Supported formats defined per workspace (CSV, Excel)
- Import uses progressive disclosure: upload → preview → confirm → import
- Import errors shown inline; partial imports are allowed with error report

### 3.7 Right Zone — Export

- Exports current view (respects active filters, columns, sort)
- Format options: CSV, Excel, PDF (PDF only for report-style modules)
- Bulk export (selected rows only) available when rows are selected
- Large exports (> 1000 rows) are processed as a background job; notification on completion

### 3.8 Right Zone — More Menu

Secondary actions that don't fit in the main toolbar:

```
[⋮ More]
  ├── Column Settings
  ├── Saved Layouts
  ├── Density (Compact / Comfortable / Spacious)
  ├── ─────────────────
  ├── Keyboard Shortcuts
  └── Report a Problem
```

### 3.9 Right Zone — Refresh

- Manual refresh button
- Shows time since last refresh on hover
- Auto-refresh indicator (spinning dot when background refresh is active)

---

## 4. Bulk Actions Mode

When 1 or more rows are selected, the toolbar switches to **Bulk Actions Mode**:

```
[✗ 12 selected]  [Approve]  [Export]  [Assign to Wave]  [More ▼]  [✗ Clear selection]
```

**Rules:**
- Bulk Actions Mode replaces the normal toolbar completely — no search, no filters
- "N selected" shows a count and a close button
- Available bulk actions are context-aware (depend on selected rows' statuses)
- "More" contains less common bulk operations
- "Clear selection" deselects all and returns to normal toolbar
- Bulk destructive actions (Delete, Archive) require a confirmation dialog

**Bulk Action Behavior:**
- **Instant actions**: Execute immediately with undo toast (5 second window)
- **Async actions**: Show progress indicator; notify on completion
- **Mixed-state actions**: If some rows cannot receive the action, show a warning ("3 of 12 rows cannot be approved")

---

## 5. Smart Actions (Context-Aware Chips)

For operational workspaces, the Smart Toolbar includes a row of **Smart Action Chips** below the main toolbar row. These are live-count chips for the most relevant operational actions.

```
[Pending Approval (12)] │ [Overdue (3)] │ [SLA At Risk (8)] │ [Ready to Ship (24)]
```

**Rules:**
- Chips are hidden when count = 0
- Clicking a chip applies an instant filter to the grid
- Chips update in real-time from EPS-01 events
- Maximum 6 chips; "Show more" link if module has more
- Chip colors follow semantic color system (warning/error/info/success)

---

## 6. Personalization

Users can customize their toolbar:

| Feature | Description |
|---|---|
| **Pin actions** | Pin frequently-used actions to the toolbar |
| **Reorder sections** | Drag toolbar sections within their zones |
| **Hide sections** | Hide sections not relevant to their workflow |
| **Keyboard shortcuts** | All toolbar actions have assignable shortcuts |

---

## 7. Keyboard Access

| Shortcut | Action |
|---|---|
| `Cmd/Ctrl + F` | Focus search |
| `Cmd/Ctrl + Shift + F` | Open filter panel |
| `Cmd/Ctrl + E` | Export current view |
| `Cmd/Ctrl + I` | Open import wizard |
| `Cmd/Ctrl + Shift + S` | Save current view |
| `V` (when grid focused) | Toggle view mode |

---

## 8. Governance

| Rule | Constraint |
|---|---|
| UX-GOV-002 | Every module uses this Universal Smart Toolbar — no custom toolbars |
| Search position | Always left zone; never right; never in page header |
| Bulk actions | Always replace the full toolbar in bulk mode; never overlap |
| Export | Always right zone; never hidden in more menus on first use |
| AI Suggestions | Always present if module has AI capabilities; never in more menu |
