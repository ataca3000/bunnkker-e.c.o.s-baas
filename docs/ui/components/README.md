# ECOS Component Library

Single source of truth for all shared UI components in the ECOS ERP frontend.

**Import path:** `@/components/ecos`

```ts
import { PhoneCell, SyncBadge, EntityTable, StatusBadge, BADGE_VARIANTS } from '@/components/ecos';
```

---

## Directory Structure

```
frontend/src/
├── components/
│   ├── crud/          # Generic CRUD kit (re-exported via ecos)
│   ├── ds/            # Design system primitives (re-exported via ecos)
│   └── ecos/          # Domain-shared components + barrel index
│       ├── index.ts       ← single import entry point
│       ├── phone-cell.tsx ← generic phone display with action menu
│       ├── sync-badge.tsx ← WooCommerce sync status badge
│       └── tokens.ts      ← design token constants
├── hooks/
│   ├── use-column-visibility.ts ← localStorage column show/hide + widths
│   ├── use-bulk-selection.ts    ← Set-based row selection for tables
│   └── use-drawer-state.ts      ← create/edit/view drawer state machine
└── features/
    ├── orders/
    │   └── components/
    │       └── order-phone-cell.tsx  ← wraps PhoneCell with 'orders' i18n
    └── products/
        └── components/badges/
            └── sync-badge.tsx        ← re-exports SyncBadge from ecos
```

---

## Components

### `PhoneCell`

Generic phone number cell with Call / WhatsApp / Copy dropdown. No i18n dependency.

```tsx
import { PhoneCell } from '@/components/ecos';

// With default English labels:
<PhoneCell phone="+201234567890" />

// With translated labels:
<PhoneCell
  phone={order.billing_phone}
  labels={{ call: t('phone.call'), whatsapp: t('phone.whatsapp'), copy: t('phone.copy'), copied: t('phone.copied') }}
/>
```

**Props:**

| Prop | Type | Default |
|------|------|---------|
| `phone` | `string \| null` | required |
| `labels.call` | `string` | `"Call"` |
| `labels.whatsapp` | `string` | `"WhatsApp"` |
| `labels.copy` | `string` | `"Copy"` |
| `labels.copied` | `string` | `"Copied!"` |

**Domain wrapper:** `OrderPhoneCell` in `features/orders/components/order-phone-cell.tsx`

---

### `SyncBadge`

WooCommerce sync status badge. Four statuses: `synced`, `pending`, `failed`, `not_synced`.

```tsx
import { SyncBadge } from '@/components/ecos';

<SyncBadge status={product.sync_status} />
<SyncBadge status={null} />        {/* renders "—" */}
<SyncBadge status="pending" className="ml-2" />
```

**Props:**

| Prop | Type | Default |
|------|------|---------|
| `status` | `SyncStatus \| null \| undefined` | required |
| `className` | `string` | — |

**Currently used in:** `product-table.tsx`, `product-detail-drawer.tsx`

---

### `StatusBadge` (from crud)

Generic configurable status badge. Accepts a `config` map for flexible styling.

```tsx
import { StatusBadge } from '@/components/ecos';
```

---

### `EntityTable` (from crud)

Standardised table shell with sticky header, column resizing, and checkbox column support.

---

### `EntityDrawer` (from crud)

Side-sheet drawer with header, scrollable body, and footer action area.

---

### `EntityToolbar` (from crud)

Toolbar bar combining search + filter + action buttons in a consistent layout.

---

### `PageHeader` (from crud)

Page-level header with title, subtitle, and right-side action slot.

---

### `Pagination` (from crud)

Page navigation with page size selector. Matches `PAGINATION.defaultPageSize` from tokens.

---

### `EmptyState` / `LoadingState` / `ErrorState` (from crud)

Standard table body states. Use these instead of ad-hoc inline empty states.

---

### `QuickStatCard` (from ds)

Dashboard KPI card with label, value, and optional trend indicator.

---

## Hooks

### `useColumnVisibility`

localStorage-backed column show/hide + resize state. Generic — provide your own column keys and defaults.

```ts
import { useColumnVisibility } from '@/hooks/use-column-visibility';

const { visible, setVisible, getWidth, setWidth, resetPrefs } = useColumnVisibility({
  storageKey: 'orders',          // → localStorage keys: ecos_orders_cols, ecos_orders_col_widths
  defaults: DEFAULT_VISIBILITY,  // Record<ColKey, boolean>
  defaultWidths: DEFAULT_WIDTHS, // Record<string, number>
});
```

---

### `useBulkSelection`

Set-based bulk row selection with toggle, select-all, and clear.

```ts
import { useBulkSelection } from '@/hooks/use-bulk-selection';

const { selectedIds, toggle, toggleAll, clear, count } = useBulkSelection();

// Header checkbox:
<input type="checkbox" onChange={() => toggleAll(rows.map(r => r.id))} />

// Row checkbox:
<input type="checkbox" checked={selectedIds.has(row.id)} onChange={() => toggle(row.id)} />
```

---

### `useDrawerState`

Typed state machine for create / edit / view drawer lifecycle.

```ts
import { useDrawerState } from '@/hooks/use-drawer-state';

const drawer = useDrawerState<Order>();

// Open modes:
drawer.openCreate();
drawer.openEdit(order);
drawer.openView(order);
drawer.close();

// Read state:
drawer.open    // boolean
drawer.mode    // 'create' | 'edit' | 'view'
drawer.entity  // Order | null
```

---

## Design Tokens

```ts
import { BADGE_VARIANTS, LAYOUT, DURATION, PAGINATION, lsKey } from '@/components/ecos';

// Status badge className:
<span className={BADGE_VARIANTS.success}>Synced</span>

// localStorage key:
localStorage.setItem(lsKey('orders', 'cols'), JSON.stringify(visibility));

// Debounce search input:
setTimeout(search, DURATION.searchDebounce);
```

Full token reference: [`tokens.ts`](../../frontend/src/components/ecos/tokens.ts)

---

## Guidelines

1. **Always import from `@/components/ecos`** — not from `crud/` or `ds/` directly.
2. **Generic first** — if a component has an i18n dependency, extract the pure part to ecos, then create a domain wrapper.
3. **No feature imports in ecos** — components in `components/ecos/` must not import from `features/`.
4. **Tokens over magic numbers** — use `LAYOUT.rowHeight`, `DURATION.searchDebounce`, etc. instead of inline numbers.
5. **New shared component?** — add to `components/ecos/`, export from `index.ts`, document here.

---

## Design Principles

Full principles: [`docs/architecture/ECOS-DESIGN-PRINCIPLES.md`](../../docs/architecture/ECOS-DESIGN-PRINCIPLES.md)
