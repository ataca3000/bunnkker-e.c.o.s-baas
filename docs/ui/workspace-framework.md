# ECOS Workspace Framework

**Status:** Approved (Foundation Sprint 02) — Implementation Reference  
**Applies to:** All operational workspaces in ECOS ERP

> **Architecture Notice:** The workspace structure and behavioral rules are now governed by the Enterprise UX Architecture documents in `docs/ux/`. Specifically:
> - `docs/ux/WORKSPACE-FRAMEWORK.md` — Architecture-level workspace standard (supersedes this document for structural decisions)
> - `docs/ux/SMART-TOOLBAR-STANDARD.md` — Smart Toolbar specification
> - `docs/ux/DATAGRID-STANDARD.md` — DataGrid specification
> - `docs/ux/DETAIL-DRAWER-STANDARD.md` — Detail Drawer specification
>
> This document remains as the **implementation reference** for the current CRUD component library. New modules should follow `docs/ux/` architecture first, then map to these implementation components.

---

## 1. Overview

Every operational workspace in ECOS ERP follows the same structural framework.

This document defines the required anatomy, component contracts, and behavioral rules.

**No module may deviate from this structure without explicit approval.**

---

## 2. Workspace Anatomy

```
┌─────────────────────────────────────────────────────────┐
│  Page Header                                            │
│  Title · Breadcrumbs · Action Buttons                  │
├─────────────────────────────────────────────────────────┤
│  Quick Stats / KPI Cards (when applicable)              │
│  Clickable cards that apply instant filters             │
├─────────────────────────────────────────────────────────┤
│  Context Tabs (when applicable)                         │
│  Status-first navigation · Live counts · Sticky         │
├─────────────────────────────────────────────────────────┤
│  Search                                                 │
│  Single smart search box · Auto-focus for CS modules    │
├─────────────────────────────────────────────────────────┤
│  Primary Filters                                        │
│  Always-visible filter controls · Clear All             │
├─────────────────────────────────────────────────────────┤
│  Smart Operations Toolbar                               │
│  Context-aware chips with live counts · More menu       │
├─────────────────────────────────────────────────────────┤
│  Bulk Actions Toolbar                                   │
│  Visible ONLY when rows are selected · Count label      │
├─────────────────────────────────────────────────────────┤
│  Main Data Table                                        │
│  Sticky header · Sortable · Selectable · Resizable     │
├─────────────────────────────────────────────────────────┤
│  Pagination                                             │
│  Page X of Y · N total · Previous/Next                 │
└─────────────────────────────────────────────────────────┘
```

Optional sections (omit when not applicable):
- Quick Stats: optional for simple reference modules
- Context Tabs: required for modules with lifecycle states
- Smart Operations Toolbar: required for operational modules
- Bulk Actions: required when multi-select is supported

---

## 3. Drawer Anatomy

The Universal Drawer is used for all entity detail and create/edit views.

```
┌─────────────────────────────────────┐
│  Drawer Header                      │
│  Title · Close Button               │
├─────────────────────────────────────┤
│  Primary Actions                    │
│  Status badge · Quick action buttons│
├─────────────────────────────────────┤
│  Tabs                               │
│  Summary | Details | Activity | ... │
├─────────────────────────────────────┤
│  Scrollable Content Area            │
│  Tab-specific content               │
├─────────────────────────────────────┤
│  Sticky Footer                      │
│  [Cancel]  [Primary Action]         │
└─────────────────────────────────────┘
```

### Drawer Rules

- Opens from the right side as a sheet (not a modal)
- The table behind the drawer remains visible and accessible
- Minimum width: 480px on tablet; full-width on mobile
- Content area scrolls independently; header and footer are sticky
- Submit action is always in the footer
- Secondary actions (Back, Cancel) are also in the footer

**Component:** `components/crud/entity-drawer`

---

## 4. Table Anatomy

```
┌─ Sticky Header ─────────────────────────────────────────┐
│ ☐ │ Column A ↕ │ Column B ↕ │ Column C │ Actions        │
├─────────────────────────────────────────────────────────┤
│ ☐ │ value      │ value      │ badge    │ [Edit] [More]  │  ← hover shows actions
├─────────────────────────────────────────────────────────┤
│ ☐ │ value      │ value      │ badge    │                │
│ ...                                                      │
└─────────────────────────────────────────────────────────┘
  ← Previous    Page 1 of 12 · 240 total    Next →
```

### Table Features (Universal Requirements)

| Feature | Required | Notes |
|---------|----------|-------|
| Sticky header | Yes | `sticky top-0 z-10` |
| Sortable columns | Yes | Click header to sort |
| Row selection | Yes | Checkbox per row + Select All |
| Hover actions | Yes | Actions appear on row hover |
| Loading skeleton | Yes | 8 rows by default |
| Empty state | Yes | Generic `EmptyState` from crud |
| Error state | Yes | Generic `ErrorState` + retry button |
| Horizontal scroll | Yes | `overflow-x-auto` on table wrapper |

### Table Features (Optional)

| Feature | When to include |
|---------|----------------|
| Column resizing | Complex tables with many columns (Orders, Products) |
| Column visibility | Tables with 8+ columns |
| Row density toggle | Tables with high-volume data (Orders, Products) |
| Expandable rows | Multi-level data structures |

---

## 5. Toolbar Anatomy

```
[Search Input]   ·   ·   ·   [Bulk Actions?] [Columns] [Density] [Refresh]
```

Left-aligned: search  
Right-aligned: all controls  
Bulk Actions section: only visible when rows selected

---

## 6. Smart Operations Toolbar

```
[Group: Customer] Chip₁ (N) │ Chip₂ (N) ║ [Group: Shipping] Chip₃ (N) │ ... │ More ▼
```

### Operation Chip Rules

1. Each chip has a label and an optional live count badge
2. Chips are hidden when count = 0 (exception: "always show" action ops)
3. Clicking a chip executes the operation (filter, navigate, action)
4. Operations are grouped by semantic category
5. The active status tab determines which operations are shown (Context Ops)
6. The "All" tab shows grouped view with all operation groups
7. More menu contains secondary operations

**Source:** `features/orders/components/order-smart-toolbar.tsx` (current implementation)  
**Target:** Extract to `components/ecos/smart-toolbar.tsx` (inject ops via props)

---

## 7. Context Tabs (Status Navigation)

```
[All (240)] [Processing (12)] [Confirmed (45)] [Preparing (28)] [Shipping (91)] ...
```

- Horizontally scrollable
- Sticky below page header
- Each tab shows a live count (capped at 999+)
- Active tab has primary color + underline accent
- Switching tabs resets page to 1

**Component:** `features/orders/components/order-status-tabs.tsx`  
**Extraction target:** `components/ecos/status-tabs.tsx`

---

## 8. Workspace Memory

Every workspace persists user preferences across sessions.

### Persisted State

| State | localStorage Key | Notes |
|-------|-----------------|-------|
| Search value | `ecos_{module}_search` | Cleared on browser close |
| Active tab | `ecos_{module}_tab` | Persists |
| Column visibility | `ecos_{module}_cols` | Persists |
| Column widths | `ecos_{module}_col_widths` | Persists |
| Row density | `ecos_{module}_density` | Persists |
| Sort field | `ecos_{module}_sort_by` | Persists |
| Sort direction | `ecos_{module}_sort_dir` | Persists |
| Rows per page | `ecos_{module}_per_page` | Persists |

### Key Generator

```ts
import { lsKey } from '@/components/ecos/tokens';
// lsKey('products', 'cols') → 'ecos_products_cols'
```

### Hook

```ts
import { useColumnVisibility } from '@/hooks/use-column-visibility';
const { visible, setVisible, getWidth, setWidth } = useColumnVisibility({
  storageKey: 'orders',
  defaults: DEFAULT_VISIBILITY,
  defaultWidths: DEFAULT_WIDTHS,
});
```

---

## 9. Activity Panel

The Universal Activity Panel is used in entity drawers to show the unified timeline.

```
┌─ Filter Bar ────────────────────────────────────────────┐
│ [All] [Notes] [System] [Audit] [Calls]  [Search…]      │
├─────────────────────────────────────────────────────────┤
│ ● Ahmed S.  Added a note          Today, 14:30          │
│   "Customer confirmed address — proceed with shipping"  │
│   [Reply] [Pin] [Copy]                                  │
│                                                         │
│ ● ECOS     Status changed: Confirmed → Preparing        │
│             Today, 12:01                                │
├─────────────────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────────────┐   │
│ │ Add a note…                                      │   │
│ │                                              [Add]│   │
│ └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

**Status:** Designed, not yet implemented. Extraction target: `components/ecos/activity-panel.tsx`

---

## 10. Design Tokens

All workspace components use centralized tokens. Never hardcode values.

```ts
import { LAYOUT, DURATION, PAGINATION, BADGE_VARIANTS, lsKey } from '@/components/ecos/tokens';

LAYOUT.headerHeight        // 56px
LAYOUT.tabsHeight          // 40px
LAYOUT.toolbarHeight       // 40px
LAYOUT.rowHeight           // 44px
DURATION.searchDebounce    // 300ms
PAGINATION.defaultPageSize // 20
BADGE_VARIANTS.success     // 'text-emerald-700 bg-emerald-50 ...'
lsKey('orders', 'cols')   // 'ecos_orders_cols'
```

Full reference: `components/ecos/tokens.ts`

---

## 11. Module Compliance

| Module | Workspace Framework | Notes |
|--------|--------------------|----|
| Products | ✅ | Quick stats, toolbar, filter bar, table, pagination |
| Orders | ✅ | Status tabs, smart toolbar, table, pagination |
| Customers | ✅ | Phone-first search, quick stats, quick card, table |
| Channels | 📋 Planned | Domain Sprint 02 specification |
| Purchase Orders | 📋 Partial | Table and drawer exist; no smart toolbar yet |
| Fulfillment Batches | 📋 Planned | Operations Planning specification |
| Manufacturing | 📋 Planned | Future module |

---

## 12. Shared Components Reference

| Component | Import Path | Purpose |
|-----------|-------------|---------|
| `PageHeader` | `@/components/crud` | Page title + breadcrumbs + actions |
| `EntityTable` | `@/components/crud` | Generic data table |
| `EntityToolbar` | `@/components/crud` | Search + action controls row |
| `EntityDrawer` | `@/components/crud` | Side drawer shell |
| `EntityForm` + `FormField` | `@/components/crud` | Form wrapper + labeled field |
| `Pagination` | `@/components/crud` | Page navigation |
| `EmptyState` | `@/components/crud` | Empty table placeholder |
| `LoadingState` | `@/components/crud` | Loading skeleton |
| `ErrorState` | `@/components/crud` | Error + retry |
| `ConfirmDialog` | `@/components/crud` | Destructive action confirmation |
| `ActionMenu` | `@/components/crud` | Row-level actions dropdown |
| `SearchInput` | `@/components/crud` | Debounced search with clear |
| `Combobox` | `@/components/crud` | Searchable select dropdown |
| `StatusBadge` | `@/components/crud` | Generic status display |
| `QuickStatCard` | `@/components/ds` | KPI card with click-to-filter |
| `Tabs` | `@/components/ds` | Tab navigation |
| `PhoneCell` | `@/components/ecos` | Phone + Call/WhatsApp/Copy |
| `SyncBadge` | `@/components/ecos` | Sync status badge |
| `useColumnVisibility` | `@/hooks/use-column-visibility` | Column show/hide + widths |
| `useBulkSelection` | `@/hooks/use-bulk-selection` | Row selection state |
| `useDrawerState` | `@/hooks/use-drawer-state` | Drawer open/mode/entity |
