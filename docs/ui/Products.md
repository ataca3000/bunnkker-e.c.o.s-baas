# Products Workspace UI Reference

**Module:** `frontend/src/features/products/`  
**Status:** Implemented  
**Design:** [Orders/Products UI Package 02]

---

## 1. Page Layout

Follows the ECOS Workspace Framework (DD-023):

```
Page Header (title, breadcrumbs, Import + New buttons)
↓
Quick Stats Row (5 clickable KPI cards)
↓
Toolbar (Search | Column Picker | Density | Refresh | Bulk Actions)
↓
Filter Bar (Category | Warehouse | Channel | Status | Type | Chips | More Filters)
↓
Data Table (12 columns, resizable, density control)
↓
Pagination (X of Y, Previous / Next)
```

The drawer (Product Detail / Form) overlays from the right without navigating away.

---

## 2. Page Header

| Element | Details |
|---------|---------|
| Title | "Finished Goods" or "Raw Materials" depending on route |
| Subtitle | Module description |
| Breadcrumbs | Home → [Module Title] |
| Primary Action | **Import** button (placeholder) |
| Secondary Action | **New Product** button (Ctrl+N shortcut) |

---

## 3. Quick Stats

Five clickable KPI cards. Clicking any card applies its filter instantly.

| Card | Color | Filter Applied |
|------|-------|----------------|
| Total Products | Neutral | Clear all filters |
| Published | Blue | `is_published: true` |
| Low Stock | Amber | `low_stock: true` |
| Not Synced | Red | `not_synced: true` |
| Inactive | Gray | `status: 'inactive'` |

Source: `features/products/components/product-quick-stats.tsx`

---

## 4. Toolbar

Left-to-right order:

| Control | Type | Behavior |
|---------|------|----------|
| Search Input | Text (debounced 300ms) | Searches product name, SKU; Ctrl+K or `/` to focus; Esc to clear |
| *(separator)* | — | Flex spacer |
| Bulk Actions | Dropdown | Visible only when rows are selected; options: Activate, Deactivate, Publish, Assign Category, Export Selected, Archive |
| Export All | Button | Placeholder toast |
| Columns Picker | Dropdown | Checkbox list of 10 toggleable columns + Reset to defaults; persisted to localStorage |
| Density Toggle | Button | Comfortable ↔ Compact; persisted to `ecos_products_density` localStorage key |
| Refresh | Icon button | Spinning when `isFetching` |

---

## 5. Filters

### Primary Filters (Always Visible)

| Filter | Type | Default | Options |
|--------|------|---------|---------|
| Category | Combobox | null (all) | API-driven category list |
| Warehouse | Select | null (all) | API-driven warehouse list |
| Channel | Select | null (all) | API-driven channel list |
| Status | Select | `'all'` | All / Active / Inactive |
| Product Type | Select | null (all) | All / Finished Good / Raw Material |
| Low Stock | Toggle chip | false | Boolean toggle |
| Out of Stock | Toggle chip | false | Boolean toggle |

### Advanced Filters (Expandable via "More Filters")

| Filter | Type |
|--------|------|
| Published | Select: All / Published / Unpublished |
| Has Images | Select: All / With images / Without images |

### Clear Filters

"Clear Filters" button appears when any filter is active. Resets all filters, search, and page to defaults.

---

## 6. Quick Actions

| Action | Trigger | Effect |
|--------|---------|--------|
| New Product | Header button or Ctrl+N | Opens detail drawer in edit/create mode |
| Import | Header button | Toast: "coming soon" |
| Click product name | Table row | Opens drawer in view mode |
| Edit | Row hover button | Opens drawer in edit mode |
| Duplicate | Row hover button | Toast: "Duplicating…" (stub) |
| Publish | Row More menu | Mutation to publish |
| Archive / Delete | Row More menu (destructive) | ConfirmDialog → `deleteProduct` mutation |
| Select All | Table header checkbox | Sets `selectedIds` to all product IDs on page |

---

## 7. Data Table

### Columns

| Column | Visible Default | Sortable | Resizable |
|--------|----------------|----------|-----------|
| Checkbox | Yes | No | No |
| Image | Yes | No | Yes (56px) |
| Product Name | Yes | Yes | Yes (220px) |
| Category | No | No | Yes (128px) |
| Price | No | Yes | Yes (96px) |
| Discount Price | No | No | Yes (112px) |
| Status | Yes | No | Yes (100px) |
| Channels | Yes | No | Yes (144px) |
| Sync | Yes | No | Yes (96px) |
| Last Updated | No | Yes | Yes (128px) |
| SKU | No | No | Yes (112px) |
| Actions | Yes | No | No (48px) |

### Table Features

- **Column resizing**: Drag handle on right edge of `<th>`, stored in `localStorage` via `useColumnPrefs()`
- **Column visibility**: Toggle per-column via Columns Picker dropdown; stored in `localStorage`
- **Row density**: Compact (rows `py-1.5`) or Comfortable (`py-2.5`)
- **Sort**: Click header to cycle asc → desc → none
- **Selection**: Per-row checkbox + Select All in header (with indeterminate state)
- **Hover actions**: Edit + Duplicate appear on row hover
- **Sticky header**: `sticky top-0 z-10` while scrolling

### Loading State

8 skeleton rows with a `<Skeleton>` placeholder per cell.

### Empty State

`ProductEmptyState` with Import + Create New buttons.

### Error State

Error message in a cell spanning all columns.

---

## 8. Product Drawer

A unified drawer for view and edit modes. Opens from the right.

### View Mode Tabs

| Tab | Content |
|-----|---------|
| General | Image, SKU, Barcode, Category, Unit, Type, Status, Descriptions |
| Pricing | Regular Price, Sale Price, Cost Price, Margin % |
| Inventory | Stock per warehouse, Reorder point |
| Channels | Sync status per channel, external IDs |

### Edit Mode

Same tab structure, but fields are editable. Submit button in sticky footer.

---

## 9. Responsive Rules

| Breakpoint | Behavior |
|------------|----------|
| Mobile `< 640px` | Search full-width; toolbar controls stack; filters collapse to "More" dropdown; table scrolls horizontally |
| Tablet `640px–1024px` | Controls on one line; most columns shown |
| Desktop `> 1024px` | Full layout; all columns available; optimal density |

---

## 10. Dark Mode

All components use CSS variables (`bg-background`, `text-foreground`, etc.). Status and sync badges use semantic `dark:` color classes. No hardcoded colors.

---

## 11. Keyboard Navigation

| Shortcut | Action |
|----------|--------|
| `Ctrl+N` | Open New Product drawer |
| `Ctrl+K` or `/` | Focus search input |
| `Esc` | Clear search / close drawer |
| `Tab` | Navigate form fields in drawer |
| `Enter` | Submit form |

---

## 12. Design Decisions

- **DD-023**: Workspace layout (Page Header → Quick Stats → Toolbar → Filters → Table → Pagination)
- **DD-024**: Quick Stats cards are clickable filters
- **DD-030**: Operations First — only high-frequency operations in toolbar
- **DP-006**: Density over minimalism — compact table rows, small text for secondary data
- **DP-007**: Table-First; Drawer for Detail — no separate product detail page
- **DP-008**: Generic components — `SyncBadge` extracted to `components/ecos/`, domain-specific badges stay in feature

---

## 13. Components Used

| Component | Source |
|-----------|--------|
| `PageHeader` | `@/components/crud` |
| `EntityTable` | `@/components/crud` |
| `EntityToolbar` | `@/components/crud` |
| `Pagination` | `@/components/crud` |
| `EmptyState` / `LoadingState` / `ErrorState` | `@/components/crud` |
| `ConfirmDialog` | `@/components/crud` |
| `StatusBadge` | `@/components/crud` |
| `Combobox` | `@/components/crud` |
| `QuickStatCard` | `@/components/ds` |
| `SyncBadge` | `@/components/ecos` |
| `PhoneCell` | `@/components/ecos` |
| `ProductTable` | `features/products/components/product-table` |
| `ProductDetailDrawer` | `features/products/components/product-detail-drawer` |
| `ProductFilterBar` | `features/products/components/product-filter-bar` |
| `ProductQuickStats` | `features/products/components/product-quick-stats` |
