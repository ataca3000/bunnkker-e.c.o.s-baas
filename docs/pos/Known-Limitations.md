# ECOS POS — Known Limitations

**Version:** 1.0.0  
**Date:** 2026-07-01

This document lists genuine limitations of ECOS POS v1.0. Items are grouped by status.

---

## Current (v1.0)

These limitations exist in the current production release.

### Authorization

**Shift approval has no role guard**  
Any authenticated user can approve or reject a shift count. The system does not differentiate between cashier and manager roles at the API level.  
*Target: v1.1 — POS authorization policy*

### Hardware

**Thermal printing not active**  
The `pos.php` configuration includes printer settings and HAL agent configuration, but the HAL (Hardware Abstraction Layer) agent that bridges the POS to local hardware (printer, cash drawer, customer display) is not yet built.  
*Workaround: Receipts display on screen and can be reprinted via the POS interface.*  
*Target: v1.1*

**Cash drawer control not active**  
The POS does not open the cash drawer automatically on sale completion in v1.0.  
*Target: v1.1 (requires HAL agent)*

### Offline Mode

**No offline transaction capability**  
The POS requires an active network connection. If the connection drops during a sale, the transaction must wait for connectivity to be restored. The `pos.php` configuration has offline mode settings (queue size, encryption, conflict strategy), but the frontend offline queue is not implemented.  
*Target: v1.1*

### Inventory

**No real-time stock enforcement**  
Products can be added to a cart regardless of their current stock level. The catalog displays a `stock_status` field (`in_stock`, `low_stock`, `out_of_stock`) but the POS does not block a sale for out-of-stock items. `POS_ALLOW_NEGATIVE_STOCK=false` is the default configuration, but the enforcement is not yet implemented.  
*Target: v1.1*

### Loyalty

**Loyalty points redemption UI not implemented**  
The backend publishes `LoyaltyPointsAccrued` domain events and the `POS_LOYALTY_ENABLED` configuration is present, but the cashier has no UI to look up a customer's point balance or redeem points as a payment tender.  
*Workaround: Points accrue automatically on sales if loyalty integration is configured.*  
*Target: v1.1*

### Discounts

**Manager approval threshold not enforced at runtime**  
`POS_MANAGER_APPROVAL_PCT=20` is stored in configuration, but there is no runtime enforcement requiring manager override when a discount exceeds this threshold.  
*Target: v1.1*

### Quantity Updates

**Cart line quantity update uses two API calls**  
When a cashier edits a quantity or a barcode scan increments an existing line, the operation is implemented as: (1) DELETE the existing line, (2) POST a new line with the updated quantity. This is visible as two requests in the network tab and could result in a momentary missing line in the cart display on slow connections.  
*Impact: Cosmetic only — the final state is always correct.*  
*Target: v1.1 — implement a dedicated PATCH /lines/{id} endpoint*

### Receipts

**No product image on receipt**  
Printed/displayed receipts include product name and SKU but not product images.  
*Target: v1.1*

**No tax line on receipt**  
The receipt totals have a `tax` field but it is currently hardcoded to `0.00`. Tax calculation is not implemented.  
*Target: v1.x (requires tax configuration module)*

### Search

**Barcode thresholds not configurable via environment**  
The `BARCODE_THRESHOLD_MS`, `RESET_GAP_MS`, and `MIN_BARCODE_LENGTH` constants in the barcode scanner hook are compile-time constants, not runtime configurable. Stores with non-standard scanners must edit the source and rebuild.  
*Target: v1.1 — expose via VITE_ environment variables*

---

## Planned (v1.1)

Limitations confirmed for resolution in the next minor version:

| Limitation | Planned Solution |
|------------|-----------------|
| No RBAC for shift approval | POS authorization policy with Manager role |
| No thermal printer support | HAL agent WebSocket bridge |
| No offline mode | Frontend transaction queue with sync |
| No stock enforcement | Real-time stock check on addLine |
| No loyalty redemption UI | Points balance panel + payment tender |
| No manager discount approval | Runtime discount threshold middleware |
| 2-call quantity update | `PATCH /pos/carts/{id}/lines/{line}` endpoint |
| Barcode thresholds not configurable | VITE_ environment variables |

---

## Out of Scope

These items are explicitly not planned for the POS module v1.x lifecycle.

| Item | Rationale |
|------|-----------|
| Multi-currency cart | Single currency per cart is a design constraint (ADR-POS-001). Cross-currency transactions require a separate settlement workflow. |
| E-commerce integration | POS is an in-store module. E-commerce sales flow through the Commerce module (WooCommerce, Shopify channels). |
| Table service / reservation | ECOS POS is a retail POS, not a hospitality POS. F&B workflows (table management, course ordering, kitchen display) are out of scope. |
| Layaway / installment plans | Installment workflows belong to a Finance module, not the POS. |
| Gift cards | Gift card issuance and redemption are planned as a separate Gift Card module integrating via the payment tender interface. |
| Barcode printing / label printing | Product label printing is an Inventory module feature. |
| Customer-facing display | Planned as HAL agent feature (v1.1+), not a POS v1.0 commitment. |
| POS analytics dashboard | Sales reporting is handled by the Reports/Analytics module. The POS collects the data; reporting is a separate concern. |
