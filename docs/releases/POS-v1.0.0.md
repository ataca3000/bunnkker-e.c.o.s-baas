# ECOS POS v1.0.0 — Release Notes

**Version:** 1.0.0  
**Release Date:** 2026-07-01  
**Status:** Production Certified  
**Module:** ECOS Point of Sale

---

## Summary

ECOS POS v1.0 is the first production release of the Point of Sale module for the ECOS ERP platform. It delivers a complete retail POS experience: session and shift management, product scanning, cart management, multi-tender payment processing, receipt issuance, returns, and exchanges. The system is built on a full Domain-Driven Design stack with an event-sourced audit trail, PostgreSQL-backed persistence, and a React 19 frontend optimized for cashier keyboard operation.

---

## Major Features

### Session & Shift Management
- Open, suspend, and close POS sessions per terminal
- Shift lifecycle: open → close (cashier count) → approve/reject (manager)
- Opening and closing cash count recording
- Cash variance calculation and configurable tolerance

### Cart Management
- Full cart aggregate with state machine: Active → Paying → Completed; Active ↔ Held; terminal states: Cancelled, Expired
- Add, update, and remove line items
- Per-line discounts (percentage and fixed amount)
- Order-level discounts
- Hold and resume carts (configurable expiry, default 8 hours)
- Up to 500 line items per cart (configurable)

### Product Catalog Integration
- Real-time product search with 300ms debounce
- Category filtering with persistent category selection
- Paginated catalog grid (48 products per page)
- Barcode scanner support (USB HID, 100ms threshold)
- Duplicate-scan increment: scanning an existing cart item increments its quantity

### Customer Binding
- Customer search by name, phone, code, or email
- Customer bound to cart on backend via `PUT /pos/carts/{id}/customer`
- Customer state persists through hold/resume, refresh, and checkout
- Ctrl+K keyboard shortcut for instant customer search

### Payment Processing
- Cash, card, wallet, and store credit tender types
- Split payment across multiple tender types
- Quick-amount buttons for cash (50, 100, 200, 500)
- Change calculation
- Enter-key payment confirmation
- Atomic transaction: payment + sale + cart completion + receipt in one DB transaction

### Receipt Management
- Auto-generated receipt numbers per terminal
- Receipt types: sale, return, exchange, void, reprint
- Receipt retrieval and reprint via API
- JSONB storage for receipt line items, totals, and payments

### Returns
- Return against any historical sale by sale ID
- Per-line refund amount with inline validation (> 0)
- Refund method selection
- Partial and full refund support
- Sale status updated: refunded / partially_refunded
- Automatic return receipt issuance

### Exchanges
- Exchange against any historical sale by sale ID
- Returned items selection (individual or all)
- Replacement items (blank lines with product ID and price)
- Reason required; notes required when reason is "other"
- Atomic exchange receipt issuance

### Keyboard Navigation
- Full cashier operation without a mouse
- Arrow keys for cart item selection
- Enter, +/−, Delete for quantity editing and removal
- F8 payment, F9 hold, Ctrl+N new sale, Escape cancel
- Keyboard shortcuts help overlay (Shift+?)

### Manager Mode
- Dedicated manager view for shift and session management
- Shift approval/rejection workflow
- Session close from manager view

### Accessibility
- ARIA listbox/option roles for cart navigation
- `aria-activedescendant` tracking for screen readers
- All interactive elements have accessible labels
- Focus management: auto-focus on payment input, customer search, product search after scan

---

## Bug Fixes (Certification — PKG-POS-022)

| ID | Description |
|----|-------------|
| BUG-0 | **CRITICAL** — `CartResource` called `Money::amount()` (method) instead of accessing `Money::$amount` (property); all cart API responses were fatal PHP errors |
| BUG-1 | Resume cart did not restore customer display from the Zustand store; customer bar went blank after resuming a held cart with a bound customer |
| BUG-2 | Rapid successive barcode scans could overlap and attempt to delete an already-deleted cart line, surfacing a spurious "Failed to update quantity" toast |
| BUG-3 | `aria-activedescendant` on the cart listbox referenced line UUIDs but cart line elements had no `id` attribute; screen readers could not follow keyboard navigation |
| BUG-4 | Payment panel close button had no `aria-label`; screen readers announced an unlabeled button |
| BUG-7 | No React error boundary around `PosWorkspace`; uncaught render errors crashed the terminal with a blank screen requiring a full page reload |

---

## Known Limitations

See [Known-Limitations.md](../pos/Known-Limitations.md) for the full list.

Summary of current limitations:
- Offline mode configuration present but not yet implemented in frontend
- HAL (Hardware Abstraction Layer) agent integration not yet active
- Thermal receipt printing requires the HAL agent (planned)
- Loyalty points redemption UI not implemented (backend ready)
- Shift approval has no role-based authorization guard (any authenticated user can approve)
- No product image display in catalog grid

---

## Upgrade Notes

This is the initial release. No existing POS data to migrate.

Run the following migrations in order before deploying:

```
php artisan migrate
```

Specific POS migration files (run in order):
1. `2026_07_01_000001_create_pos_sessions_table`
2. `2026_07_01_000002_create_pos_shifts_table`
3. `2026_07_01_000003_create_pos_cash_drawers_table`
4. `2026_07_01_000004_create_pos_carts_table`
5. `2026_07_01_000005_create_pos_sales_table`
6. `2026_07_01_000006_create_pos_receipts_table`
7. `2026_07_01_000007_create_pos_returns_table`
8. `2026_07_01_000008_create_pos_exchanges_table`
9. `2026_07_01_000009_create_pos_payments_table`

---

## Breaking Changes

None — this is the initial production release.

---

## Development Phases

| Phase | Package | Description |
|-------|---------|-------------|
| PKG-POS-012 | Cart Domain | Cart aggregate root, state machine, line management |
| PKG-POS-013 | Session Domain | Session lifecycle, terminal binding |
| PKG-POS-014 | Customer & Loyalty Integration | Customer binding, loyalty hooks |
| PKG-POS-015 | Exchange Domain | Exchange workflow, atomicity |
| PKG-POS-016 | Receipt Domain | Receipt model, numbering strategy |
| PKG-POS-017 | Application Layer | All use-case services and commands |
| PKG-POS-018 | API Layer | REST controllers, request validation, resources |
| PKG-POS-019 | Architecture Hardening | Domain models, payment, shift reconciliation |
| PKG-POS-020 | Frontend | React 19 workspace, all UI components |
| PKG-POS-021 Rev A | Production Readiness | Cart↔Customer binding, keyboard nav, inline validation |
| PKG-POS-022 | Production Certification | 9-phase audit, 6 bugs fixed |
| PKG-POS-023 | Release | Official v1.0.0 release documentation |
