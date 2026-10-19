# CR-PREP-001 — UX Engineering

## Removed UI Elements

The following elements are **permanently removed** from the Preparation OS UI. Do not re-add them under any circumstances.

| Location | Element | Reason |
|----------|---------|--------|
| Operations → Preparation | "New Wave" button | Replaced by auto-session |
| Operations → Preparation | "Create Wave" dialog | Replaced by auto-session |
| Preparation session detail | "Add Orders" manual picker | Replaced by auto-attach |

---

## New Primary Entry Point

### Operations → Today's Preparation

Route: `/operations/preparation/today`

This page is the new default view when a user navigates to the Preparation section.

**Layout — Per Warehouse Card Grid:**

Each warehouse the user has access to shows one card:

```
┌─────────────────────────────────────────────────────────┐
│ Cairo Warehouse                          [Active] ●      │
│                                                          │
│  Orders   Products   Prepared   Blocked   Remaining      │
│   47        23        30/47      4         17            │
│                       64%                               │
│                                                          │
│  [Start Preparation]  or  [Continue Preparation]         │
│  ──────────────────────────────────────────────────      │
│  Session PS-20260706-0001 · Auto-created 06:00           │
└─────────────────────────────────────────────────────────┘
```

**KPI Definitions:**

| KPI | Definition |
|-----|-----------|
| Orders | preparation_session_orders WHERE detached_at IS NULL |
| Products | Distinct product_ids across active session orders |
| Prepared | preparation_wave_lines where status = 'prepared' |
| Blocked | Items with insufficient stock or missing recipe |
| Remaining | Products − Prepared |

**Button Logic:**

| Session Status | Button Label | Action |
|---------------|-------------|--------|
| draft | "Start Preparation" | PATCH /sessions/{id} status=active |
| active | "Continue Preparation" | Navigate to session detail |
| paused | "Resume Preparation" | PATCH /sessions/{id} status=active |
| completed | "View Report" | Navigate to session detail in read-only |
| closed | "View Report" | Navigate to session detail in read-only |
| No session | "Session Not Created" | Disabled; shows spinner if before 06:05 |

---

## Session Detail Page

Route: `/operations/preparation/sessions/{id}`

### Tab: Orders (default)

DataGrid showing all orders in the session.

**Columns:** #, Order #, Customer, Governorate, Area, Status, Attached By, Attached At, [Detach button — supervisor only]

**Filters:** Attachment Source (auto / manual), Status, Governorate

**Supervisor Action Bar:**
- "Attach Order" button opens order search → attaches selected order (POST /sessions/{id}/attach-order)
- "Override Warehouse" button on individual orders opens warehouse picker

### Tab: Products

Aggregated product preparation view.

**Columns:** SKU, Product Name, Qty Needed, Unit, Orders Count, Prepared, Remaining, Status

**Status chips:** `pending` / `in_progress` / `prepared` / `blocked`

This tab is read-only — preparation is tracked at the wave level, not directly here.

### Tab: Timeline

ADR-011 event timeline. Automatically populated; no user action.

---

## Warehouse Assignment Configuration

Route: `/operations/configuration/warehouse-assignment`

**Layout:**

1. **Policies Table** — DataGrid with columns: Channel, Governorate, Zone, Warehouse, Priority, Specificity Score, Status, [Edit] [Disable]

2. **New Policy Form** (slide-over):
   - Channel (searchable select, optional)
   - Governorate (searchable select, optional)
   - Zone (disabled — future)
   - Warehouse (required searchable select)
   - Priority (number 1–9999, default 100)
   - Notes

3. **Preview Panel** — "Test a combination" form:
   - Enter: channel + governorate
   - Shows which warehouse would be assigned and which policy won

---

## Unassigned Orders Queue

Route: `/operations/assignments/unassigned`

**DataGrid columns:** Order #, Customer, Channel, Governorate, Area, Order Date, [Assign Warehouse]

**Assign Warehouse action:**
- Opens a slide-over
- Warehouse select (required)
- Reason textarea (required, min 10 chars)
- "Override" button → POST /orders/{id}/override-warehouse

After override, the row disappears from this view.

---

## Design System Compliance

- All new buttons use `<Button variant="default">` / `<Button variant="outline">` from DS
- KPI cards use the existing `<KpiCard>` component pattern
- Session status badge uses `<Badge>` with matching variant
- DataGrid uses `<UniversalDataGrid>` with `ColumnDef[]` pattern (header/cell, no accessorKey for computed cols)
- Slide-overs use `<Sheet>` from DS
- Toast notifications use `useToast()` from `@/components/ds/use-toast`
- No new primitives introduced
