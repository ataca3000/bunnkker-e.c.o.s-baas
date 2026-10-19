# ADR-012 — Unified Enterprise Pricing Policy

**Date:** 2026-07-02
**Status:** Accepted
**Author:** ECOS Architecture Team
**Type:** Architecture Documentation — captures a decision already implemented in the codebase.

---

## Context

ECOS ERP serves manufacturing businesses that sell through multiple channels simultaneously:
a WooCommerce storefront, a point-of-sale terminal, wholesale accounts, and marketplaces.
Each channel is capable of displaying and — in some configurations — modifying a selling price
for the same product.

This creates a structural risk: **pricing authority fragmentation**. If WooCommerce can write
a price, and the POS terminal holds a different price, and a marketplace feed imports its own
price, no single system is authoritative. The business loses visibility into what each product
actually sells for, margin calculations become unreliable, and promotional pricing produces
unintended cross-channel discrepancies.

A secondary risk is **uncontrolled price change**. In a manufacturing business, material cost
changes propagate automatically through recipes to finished-product cost. Without a controlled
approval gate, a raw material price increase would silently erode margins without anyone
reviewing the downstream impact on selling price.

The fundamental design question is: **which system owns the selling price, and how does a
price change require approval before reaching a customer?**

---

## Decision

### 1. One Selling Price Per Product

ECOS maintains **exactly one approved selling price per product**. There are no channel-specific
prices, no warehouse-specific prices, no customer-tier prices at the product level, and no
time-limited override prices stored outside the ERP.

The `products.regular_price` column is the single source of truth for the selling price of
every product. This is the price that every channel receives. It is the price the ERP uses
for order valuation. It is the price that appears in all cost and margin reports.

| Data | Owner | Direction |
|---|---|---|
| Selling Price | ERP (`products.regular_price`) | ERP → all channels |
| Material Cost | ERP (`products.material_cost`) | Internal cascade only |
| Product Cost | ERP (`products.product_cost`) | Internal only |
| Pricing Review | ERP (`pricing_reviews`) | ERP workflow → approval → price update |

External channels are **display surfaces**. They receive the ERP's approved selling price and
show it to customers. They do not originate, override, or propose prices.

### 2. The Official Pricing Flow

Every selling price change in ECOS follows this exact sequence. No step may be skipped.

```
Approved Purchase Invoice
        │
        ▼
  Material Cost Updated
  (products.material_cost)
        │
        ▼
  Recipe Cost Updated
  (bills_of_materials.recipe_cost)
        │
        ▼
  Finished Product Cost Updated
  (products.product_cost)
        │
        ▼
  Pricing Review Created / Updated
  (pricing_reviews — status: Pending)
        │
        ▼
  Manager Approval
  (Price Review Center — action: approve / keep / custom)
        │
        ▼
  Selling Price Updated
  (products.regular_price)
        │
        ▼
  Automatic Channel Synchronisation
        │
   ┌────┼────────┬────────────┐
   ▼    ▼        ▼            ▼
Website  POS  Wholesale  Marketplace
```

**The selling price is never updated automatically.** The cost cascade (steps 1–4) is
automatic. The pricing review and the selling price update (steps 5–7) always require a
human decision.

### 3. Pricing Review Is Mandatory for Any Price Change

A `PricingReview` record is created whenever `product_cost` changes. The review captures:

| Field | Description |
|---|---|
| `previous_product_cost` | Product cost before the triggering material cost change |
| `product_cost` | New calculated product cost after cascade |
| `cost_difference` | Absolute change in product cost |
| `selling_price` | Current selling price at review creation time |
| `suggested_selling_price` | Computed price at the default target margin (30%) |
| `current_margin` | Margin at current selling price with new product cost |
| `impacts` | `cost_increased`, `cost_decreased`, `margin_below_target` |
| `status` | `Pending` → `Approved` / `Kept` / `CustomPrice` / `Snoozed` |
| `triggered_by_cost_history_id` | Reference to the material cost change that caused this review |

A manager resolves each review through the **Price Review Center** by choosing one of:

- **Approve suggested price** — adopt the system-calculated margin-preserving price.
- **Keep current price** — accept the margin change without adjusting the selling price.
- **Set custom price** — enter a specific selling price.

The selling price changes only when the manager makes this choice. No automated process may
update `products.regular_price` without a resolved `PricingReview`.

### 4. Duplicate Review Prevention

If a product's cost changes twice before the manager reviews the first change, ECOS does not
create two separate reviews. The existing open (`Pending` or `Snoozed`) review is updated
in place with the latest cost data.

`previous_product_cost` is preserved from the original review so that the manager always sees
the total cost drift since the last approval, not just the most recent movement.

If the most recent review was already resolved (approved, kept, or custom-priced), a new review
is created for the subsequent cost change.

### 5. No-Op When Cost Does Not Change

If a material cost update is recorded at the same value (no change), the cascade runs but
produces no `PricingReview`. There is nothing for the manager to review.

The threshold for "no change" is `< 0.0001` in cost units (i.e., less than a tenth of a cent).
This prevents floating-point rounding from generating spurious reviews.

### 6. Channel Synchronisation After Approval

When a manager approves a pricing review and a new selling price is written to `products.regular_price`,
the price change is synchronised to every connected channel automatically. The synchronisation
mechanism follows the channel integration pattern established in **ADR-003**:

- A model observer or domain event triggers a queued sync job.
- The job pushes the updated price to each connected channel.
- Every sync attempt — success or failure — is recorded in `sync_logs`.

Channels receive the same price. There is no per-channel price override in the sync payload.

### 7. Sync Failure Does Not Affect ERP Authority

If a channel fails to accept the price update:

- `products.regular_price` in the ERP is already correct. **The ERP price stands.**
- The failed sync job is retried with exponential backoff (up to 3 attempts).
- Failed jobs after exhausting retries are recorded as failed in `sync_logs`.
- The failure is visible in the **Synchronisation Center** under the channel's health view.

A channel displaying a stale price because of a sync failure is a display problem, not a
pricing authority problem. The ERP's record is correct. When the channel recovers and the
job retries, the correct price is pushed.

### 8. External Channels Must Never Become the Pricing Source of Truth

No inbound event from any channel may update `products.regular_price` in the ERP.

If WooCommerce's price is edited directly in the WooCommerce admin panel, the sync system
must not import that edit back into the ERP. The ERP's price overrides the channel's price
on the next outbound sync, not the reverse.

If a marketplace feed contains a different price for the same product, that feed price is
irrelevant to the ERP record. Channels adapt to the ERP; the ERP does not adapt to channels.

This rule is absolute. Any future integration, import, or sync feature that would write a
channel-originated price into `products.regular_price` requires an explicit ADR superseding
this decision.

---

## Implementation Notes

This ADR documents a decision that is already implemented. The relevant components are:

| Component | Location |
|---|---|
| Cost cascade | `Modules/CostManagement/Domain/Services/CostCascadeService` |
| Material cost service | `Modules/CostManagement/Domain/Services/MaterialCostService` |
| Pricing review upsert | `Modules/CostManagement/Domain/Services/PricingReviewService::upsertForProduct()` |
| Review resolution | `Modules/CostManagement/Domain/Services/PricingReviewService::resolve()` |
| Price history | `Modules/CostManagement/Domain/Models/MaterialCostHistory` |
| Pricing reviews table | `pricing_reviews` (migration 2026_07_02_200004) |
| Price approvals audit | `price_approvals` (migration 2026_07_02_200005) |
| Price Review Center | Frontend: `features/cost-management/price-review-center` |

---

## Consequences

### Positive

- **Pricing authority is unambiguous.** Every product has exactly one price. Every team member,
  every system, and every channel works from the same number.

- **Margin is never silently eroded.** Every material cost change that affects finished-product
  cost produces a visible review. The margin impact is computed and displayed before any
  selling price decision is made.

- **Audit trail is complete.** Every price change is preceded by a `PricingReview` record and
  followed by a `PriceApproval` record. Management can reconstruct the full pricing history for
  any product at any point in time.

- **Multi-channel consistency is structural, not procedural.** Because there is one price in the
  ERP and all channels receive it from the ERP, price consistency across channels is enforced
  by architecture, not by team discipline.

- **Scale is straightforward.** Adding a new sales channel means adding a new sync adapter.
  The pricing policy does not change. The new channel receives the same price every other
  channel receives.

### Negative / Trade-offs

- **No channel-specific promotions at the product level.** A business that needs WooCommerce to
  show a different price than the POS terminal cannot do so through the ERP's product record.
  Channel-specific promotions must be implemented inside the channel (e.g., WooCommerce coupon
  or sale price at the WooCommerce layer), not as a separate ERP selling price.

- **Manager review is required for every cost-driven price change.** A business that frequently
  adjusts material costs and does not review every resulting pricing suggestion will accumulate
  pending reviews. The Price Review Center must be part of the regular operational workflow.

- **Eventual consistency in channels.** There is a brief window after the manager approves a
  price when the ERP holds the new price but the channel has not yet received the sync update.
  This is acceptable given typical queue processing latency (seconds to minutes).

---

## Relationship to Existing ADRs

### ADR-003 — External Sales Channel Integration Philosophy

This ADR is a direct extension of ADR-003's master-of-record principle. ADR-003 establishes
that `Prices | ERP | ERP → Channel` in the data ownership table. ADR-012 defines the specific
rules that govern how selling prices are established, changed, and distributed.

The channel synchronisation mechanism (observer → queued job → channel API) defined in ADR-003
is the transport layer for price updates after approval. ADR-012 does not change that transport;
it defines what triggers a price push and what approval must precede it.

### ADR-004 — Inventory Architecture

ADR-004 defines the FIFO costing layer (`inventory_receipt_layers`) and the weighted-average
and current-FIFO-cost fields on the product record. These cost signals feed into the material
cost calculation that initiates the pricing cascade defined in this ADR.

The cost cascade (`material_cost → recipe_cost → product_cost`) is the bridge between ADR-004's
inventory costing layer and ADR-012's pricing review workflow.

### ADR-005 — Order Ownership and Lifecycle

ADR-005 establishes that channels are display surfaces for order status. ADR-012 extends the
same principle to price: channels are display surfaces for the ERP's approved selling price.
Both decisions share the same architectural root — the ERP is the authority, channels are
consumers.

### ADR-006 — Inventory Domain Events

The `InventoryStockReceived` event — published when a goods receipt is posted — is the upstream
trigger for the entire pricing cascade. The goods receipt posts the cost (`landed_unit_cost`),
which updates `material_cost`, which cascades through recipes to `product_cost`, which creates
a `PricingReview`. ADR-006's event architecture is the entry point into the flow defined here.

---

## Future Considerations

- **Per-channel promotional price layer.** If the business requires a channel-specific sale
  price (e.g., a WooCommerce promotional price that differs from the ERP base price), this
  must be implemented as a separate `channel_price_overrides` table and a dedicated ADR,
  not as a modification to `products.regular_price`. The base selling price in the ERP must
  remain singular and authoritative.

- **Customer-tier pricing.** Wholesale or VIP pricing tiers applied at order time (not at
  the product level) are outside the scope of this ADR. If implemented, they must be computed
  as a discount from the ERP base price, never as a competing source of truth.

- **Automated snooze expiry.** A snoozed `PricingReview` should automatically return to
  `Pending` when its `snooze_until` date passes. A scheduled task or queue job is required
  to enforce this transition.

- **Configurable target margin per product.** The default 30% target margin used to compute
  `suggested_selling_price` should eventually be configurable at the product or category level.
  This is a data change, not an architectural change, and does not require a new ADR.

- **Bulk approval workflow.** When many products are affected by a single material cost change,
  the Price Review Center should support selecting and resolving multiple reviews in one action.
  This is a UI enhancement within the existing approval architecture.
