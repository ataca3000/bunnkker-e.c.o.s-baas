# ECOS UI Design Principles

These principles govern all UI development in the ECOS ERP frontend. They are established through ADRs, DD-series design decisions, and post-implementation review. Each principle has a source decision and applies to all current and future modules.

---

## DP-001 — Operations First

> Every UI element in an operational module must justify its existence by operational value.

A button, chip, filter, or section earns its place only if it:

- Is used **frequently** in daily operations
- **Reduces clicks** or navigation steps
- **Saves operator time** per workflow cycle
- Helps process **groups of items faster** (not just one at a time)
- Fits **naturally** into the existing workflow sequence
- Adds **no visual clutter**

If a feature does not improve operational efficiency, it must not be added. Dead buttons, stub actions, and placeholder chips violate this principle.

**Source:** DD-030 (Orders module), applies to all operational modules.

---

## DP-002 — Status-First Navigation

> Status is the primary navigation axis for operational data.

Every module with lifecycle states (orders, purchases, manufacturing, inventory) must expose status tabs as the top-level navigation control — not sidebar filters or secondary dropdowns. Status tabs must:

- Show counts per status
- Be persistent (URL param or session state)
- Drive the entire context of the page including toolbar actions

**Source:** DD-025, Orders + Products redesign.

---

## DP-003 — Zero Extra Requests for Derived Data

> Compute counts, summaries, and derived state from data already fetched — never fire a second request to annotate existing data.

If the current page already loads a list of entities, any chip count, badge, or summary derived from that list must be computed client-side (`useMemo`, `reduce`, `filter`) from the existing array. Do not issue per-chip API calls to get counts.

**Source:** DD-031 (Live Smart Operations), performance constraint.

---

## DP-004 — Live Counts; Hide When Zero

> Action chips and filter buttons display a live count. When count is zero, the chip is hidden.

Chips that show actions on subsets of the current view must:

- Compute their count from `useMemo` over the current items array
- Show a badge with the count when > 0
- Be hidden entirely (not disabled, not greyed — **hidden**) when count = 0
- Exception: "always-show" action operations (Print, Pack Queue) are never hidden because they act on the whole list, not a filtered subset

**Source:** DD-031.

---

## DP-005 — Context-Aware Toolbars

> Toolbar actions change based on the active status tab.

Each status tab has a different operational context. The toolbar must surface:

- **Context ops** for specific tabs (flat list, count-filtered)
- **Default grouped view** for the "All" tab and unconfigured tabs

Groups (Customer, Shipping, Product) appear when no tab-specific context is configured. Context ops override groups entirely for tabs that have them.

**Source:** DD-028, DD-031.

---

## DP-006 — Density Over Minimalism

> Operators need information density. Pack rows with relevant data; use compact sizing.

Table rows at 44px, text at `text-xs` / `text-sm`, badges instead of full-word labels. Operators process hundreds of items per session — sparse layouts cause more scrolling and more cognitive load.

- Use `text-xs` for secondary data (phone, date, SKU)
- Use `text-sm` for primary data (order number, product name)
- Use badges for status, sync state, payment method
- Use icon-only buttons in table action columns (with tooltip)

**Source:** Orders and Products workspace redesign, DD-023–DD-029.

---

## DP-007 — Table-First; Drawer for Detail

> The primary view is always a table. Detail appears in a side drawer, not a new page.

Full-page detail views are reserved for complex, multi-tab entities where the drawer would be too narrow. For standard CRUD (orders, products, customers), the drawer is the correct container. The table stays visible and interactive while the drawer is open.

**Source:** DD-013, established in Orders + Products.

---

## DP-008 — Generic Components; Domain Wrappers

> Build components with no domain dependency. Add a thin domain wrapper for i18n and types.

A component like `PhoneCell` has no knowledge of orders or customers — it accepts a `phone` string and a `labels` object. The domain wrapper (`OrderPhoneCell`) is a one-liner that passes translated labels from `useTranslation('orders')`.

This pattern enables:
- Reuse across all modules without re-importing domain hooks
- Testing the generic component in isolation
- Consistent visual behaviour regardless of which module renders it

**Source:** Foundation Sprint 01.

---

## DP-009 — Consistent Visual Language; Single Source of Truth

> All modules use the same tokens, badge styles, spacing, and component shapes.

- Status semantic colors: `emerald` (success), `amber` (warning), `red` (error), `blue` (info), `muted` (neutral)
- Badge markup: `rounded-md border px-1.5 py-0.5 text-[11px] font-medium inline-flex items-center gap-1`
- Import shared components from `@/components/ecos` — never duplicate badge or table markup across modules

When a new visual pattern is needed in one module, it must be extracted to `components/ecos/` before being used — not inlined in a feature directory.

**Source:** Foundation Sprint 01, design token file `components/ecos/tokens.ts`.

---

## DP-010 — No Dead Features

> Never ship a button, action, chip, or menu item whose handler is empty, stubbed, or `console.log`.

If an action has no implementation, it must not exist in the UI. Features are either:

- **Fully implemented** with a real handler
- **Not present** in the UI

`break` with no side effect, `TODO` comments, and empty `onClick` are build blockers. This principle enforces DD-030 at the component level and prevents UX confusion ("why does this button do nothing?").

**Source:** DD-030, DD-031.

---

## Summary Table

| # | Principle | Source | Scope |
|---|-----------|--------|-------|
| DP-001 | Operations First | DD-030 | All operational modules |
| DP-002 | Status-First Navigation | DD-025 | Lifecycle modules |
| DP-003 | Zero Extra Requests | DD-031 | All data-driven pages |
| DP-004 | Live Counts; Hide When Zero | DD-031 | All chip/filter components |
| DP-005 | Context-Aware Toolbars | DD-028/031 | All workspace toolbars |
| DP-006 | Density Over Minimalism | DD-023–029 | All tables |
| DP-007 | Table-First; Drawer for Detail | DD-013 | All CRUD modules |
| DP-008 | Generic Components; Domain Wrappers | Sprint 01 | All shared components |
| DP-009 | Consistent Visual Language | Sprint 01 | All modules |
| DP-010 | No Dead Features | DD-030/031 | All UI |
