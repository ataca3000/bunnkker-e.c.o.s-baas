# Business Invariants

**Document:** BUSINESS-INVARIANTS  
**Version:** 1.0  
**Status:** APPROVED — Architecture Only  
**Date:** 2026-07-05  
**Task:** TASK-DOMAIN-ARCH-001  
**Parent:** ENTERPRISE-DOMAIN-MODEL.md

---

## 1. What is a Business Invariant?

A **Business Invariant** is a business rule that must always be true within an aggregate's boundary. Invariants are enforced by the aggregate root before any state change is committed. They are never bypassed by code, services, or admin interfaces.

Every invariant references the **governing Policy** that controls its threshold or allows exceptions.

---

## 2. Invariant Format

```
INV-[domain]-[number]: [Rule statement]
  Aggregate: [Aggregate Root]
  Governing Policy: [Policy type and key setting]
  Exception: [When/how this can be relaxed]
  Violation: [What exception is raised]
```

---

## 3. Commerce Invariants

**INV-COM-001: Order must have at least one OrderLine**
- Aggregate: Order
- Governing Policy: None (absolute)
- Exception: None — an empty order has no business meaning
- Violation: `OrderMustHaveAtLeastOneLineException`

**INV-COM-002: OrderLine quantity must be a positive integer**
- Aggregate: Order
- Governing Policy: None (absolute)
- Exception: None
- Violation: `InvalidOrderLineQuantityException`

**INV-COM-003: Order total must equal the sum of all OrderLine totals**
- Aggregate: Order
- Governing Policy: None (derived calculation, not a policy)
- Exception: None — total is always recalculated
- Violation: `OrderTotalMismatchException` (data integrity check)

**INV-COM-004: A cancelled Order cannot be un-cancelled**
- Aggregate: Order
- Governing Policy: None (terminal state)
- Exception: None — cancellation is final
- Violation: `InvalidOrderTransitionException`

**INV-COM-005: An Order in transit cannot be cancelled directly**
- Aggregate: Order → Shipment
- Governing Policy: `FulfillmentPolicy.allow_cancel_in_transit`
- Exception: If FulfillmentPolicy allows, a return process must be initiated first
- Violation: `CannotCancelInTransitOrderException`

**INV-COM-006: A delivered Order cannot be re-delivered**
- Aggregate: Order
- Governing Policy: None (terminal state)
- Exception: Partial delivery may be followed by a second shipment for remaining items
- Violation: `InvalidOrderTransitionException`

---

## 4. Inventory Invariants

**INV-INV-001: A Reservation cannot exceed available stock**
- Aggregate: RawMaterial / Product
- Governing Policy: `InventoryPolicy.allow_negative_reservation`
- Exception: If policy allows negative reservation, a low-stock alert is raised
- Violation: `InsufficientStockForReservationException`

**INV-INV-002: A ReceiptLayer cannot be modified after posting**
- Aggregate: RawMaterial
- Governing Policy: None (FIFO immutability — absolute)
- Exception: None — reversal creates a new negative layer, not a modification
- Violation: `ReceiptLayerImmutableException`

**INV-INV-003: Consumed quantity across all layers must not exceed total available quantity**
- Aggregate: RawMaterial
- Governing Policy: None (accounting invariant)
- Exception: None
- Violation: `StockOverConsumptionException`

**INV-INV-004: A discontinued Product cannot receive new Orders**
- Aggregate: Product
- Governing Policy: None (terminal state)
- Exception: None
- Violation: `ProductDiscontinuedException`

**INV-INV-005: Product SKU is immutable after activation**
- Aggregate: Product
- Governing Policy: None (identity invariant)
- Exception: None — changing a SKU would break all external references
- Violation: `SkuImmutableAfterActivationException`

**INV-INV-006: Product must have a cost source before activation**
- Aggregate: Product
- Governing Policy: `PricingPolicy.require_cost_before_activation`
- Exception: None by default; Policy may allow draft pricing
- Violation: `ProductMissingCostSourceException`

**INV-INV-007: Product price must exceed cost (positive margin)**
- Aggregate: Product
- Governing Policy: `PricingPolicy.allow_negative_margin` + `PricingPolicy.min_margin_percentage`
- Exception: Policy may allow specific products to sell below cost (loss leaders, clearance)
- Violation: `PriceBelowCostFloorException`

---

## 5. Manufacturing Invariants

**INV-MFG-001: A Recipe must have at least one RecipeLine**
- Aggregate: Recipe
- Governing Policy: None (absolute)
- Exception: None
- Violation: `RecipeMustHaveAtLeastOneLineException`

**INV-MFG-002: Only one Recipe version may be active per Product at any time**
- Aggregate: Recipe
- Governing Policy: None (business identity invariant)
- Exception: None — activating a new version automatically archives the previous one
- Violation: `MultipleActiveRecipesForProductException`

**INV-MFG-003: Waste percentage must be between 0% and 100%**
- Aggregate: Recipe (RecipeLine)
- Governing Policy: `ManufacturingPolicy.max_waste_percentage`
- Exception: Policy may set a maximum below 100%
- Violation: `InvalidWastePercentageException`

**INV-MFG-004: RecipeLine quantity must be positive**
- Aggregate: Recipe
- Governing Policy: None (absolute)
- Exception: None
- Violation: `InvalidRecipeLineQuantityException`

**INV-MFG-005: Production job cannot consume more material than reserved**
- Aggregate: ProductionJob
- Governing Policy: `ManufacturingPolicy.allow_overprepare`
- Exception: Policy may allow over-consumption with explicit approval
- Violation: `ProductionExceedsReservationException`

---

## 6. Procurement Invariants

**INV-PRC-001: A PurchaseOrder must have at least one line**
- Aggregate: PurchaseOrder
- Governing Policy: None (absolute)
- Exception: None
- Violation: `POMusthaveAtLeastOneLineException`

**INV-PRC-002: GoodsReceipt quantity per line cannot exceed ordered quantity**
- Aggregate: PurchaseOrder
- Governing Policy: `InventoryPolicy.allow_over_receipt`
- Exception: Policy may allow receiving more than ordered (surplus acceptance)
- Violation: `ReceiptExceedsOrderedQuantityException`

**INV-PRC-003: A cancelled PurchaseOrder cannot receive new GoodsReceipts**
- Aggregate: PurchaseOrder
- Governing Policy: None (terminal state)
- Exception: None
- Violation: `POCancelledCannotReceiveGoodsException`

**INV-PRC-004: A suspended Supplier cannot receive new PurchaseOrders**
- Aggregate: Supplier
- Governing Policy: `ApprovalPolicy.allow_emergency_po_on_suspended_supplier`
- Exception: Emergency procurement may be allowed with explicit approval
- Violation: `SupplierSuspendedException`

**INV-PRC-005: A PurchaseOrder above the approval threshold requires approval before submission**
- Aggregate: PurchaseOrder
- Governing Policy: `ApprovalPolicy.po_approval_threshold_egp`
- Exception: None — all POs above threshold must be approved
- Violation: `POApprovalRequiredException`

**INV-PRC-006: A posted GoodsReceipt cannot be modified**
- Aggregate: PurchaseOrder (GoodsReceipt)
- Governing Policy: None (accounting invariant)
- Exception: Reversal creates a new negative GR — never modifies the original
- Violation: `GoodsReceiptImmutableAfterPostingException`

---

## 7. Fulfillment Invariants

**INV-FUL-001: Prepared quantity cannot exceed reserved quantity**
- Aggregate: PreparationWave
- Governing Policy: `ManufacturingPolicy.allow_overprepare`
- Exception: Policy may allow preparation above reservation to buffer for damage/waste
- Violation: `PreparedExceedsReservedQuantityException`

**INV-FUL-002: A PreparationWave cannot be completed if any WaveItem is blocked**
- Aggregate: PreparationWave
- Governing Policy: `FulfillmentPolicy.allow_partial_wave_completion`
- Exception: Policy may allow completing a wave with short items if Order priority permits
- Violation: `WaveHasBlockedItemsException`

**INV-FUL-003: Vehicle loaded weight cannot exceed configured capacity**
- Aggregate: Vehicle / ShippingWave
- Governing Policy: `VehiclePolicy.max_weight_kg` + `VehiclePolicy.allow_overload_exception`
- Exception: Policy may allow a configurable overload buffer with explicit approval
- Violation: `VehicleCapacityExceededException`

**INV-FUL-004: Vehicle loaded volume cannot exceed configured capacity**
- Aggregate: Vehicle / ShippingWave
- Governing Policy: `VehiclePolicy.max_volume_m3` + `VehiclePolicy.allow_overload_exception`
- Exception: Same as weight
- Violation: `VehicleVolumeCapacityExceededException`

**INV-FUL-005: A ShippingWave cannot be dispatched before all required fulfillment stages complete**
- Aggregate: Shipment / ShippingWave
- Governing Policy: `FulfillmentPolicy` (profile-defined required stages)
- Exception: None — stages defined in FulfillmentProfile must all complete
- Violation: `RequiredFulfillmentStageIncompleteException`

**INV-FUL-006: An Order can be in at most one active PreparationWave at a time**
- Aggregate: PreparationWave
- Governing Policy: None (operational consistency)
- Exception: None
- Violation: `OrderAlreadyInActiveWaveException`

**INV-FUL-007: A Vehicle must be in `available` status to be assigned to a ShippingWave**
- Aggregate: Vehicle
- Governing Policy: None (operational state invariant)
- Exception: None
- Violation: `VehicleNotAvailableException`

---

## 8. Finance Invariants

**INV-FIN-001: Invoice total must equal the sum of all InvoiceLines**
- Aggregate: Invoice
- Governing Policy: None (accounting invariant)
- Exception: None — total is always derived
- Violation: `InvoiceTotalMismatchException`

**INV-FIN-002: Payment amount cannot exceed Invoice total**
- Aggregate: Invoice
- Governing Policy: None (accounting invariant)
- Exception: Overpayment creates a credit note, not an exception bypass
- Violation: `PaymentExceedsInvoiceException`

**INV-FIN-003: A paid Invoice cannot be directly modified**
- Aggregate: Invoice
- Governing Policy: None (accounting invariant)
- Exception: Corrections require a credit note and re-issue
- Violation: `PaidInvoiceImmutableException`

**INV-FIN-004: Only one POS Session can be open per Warehouse at a time**
- Aggregate: POSSession
- Governing Policy: `POSPolicy.allow_multiple_sessions_per_warehouse`
- Exception: Policy may allow multiple registers per warehouse
- Violation: `ActiveSessionAlreadyOpenException`

**INV-FIN-005: POS Session closing balance must reconcile with opening float + sales − refunds**
- Aggregate: POSSession
- Governing Policy: `POSPolicy.allow_cash_discrepancy_egp`
- Exception: Policy defines acceptable discrepancy amount before escalation
- Violation: `SessionCashDiscrepancyException`

---

## 9. CRM Invariants

**INV-CRM-001: Customer must have at least one phone number**
- Aggregate: Customer
- Governing Policy: None (identity invariant)
- Exception: None
- Violation: `CustomerMissingContactException`

**INV-CRM-002: Customer phone number must be unique within Company**
- Aggregate: Customer
- Governing Policy: None (identity invariant)
- Exception: None
- Violation: `CustomerPhoneDuplicateException`

**INV-CRM-003: A Customer cannot be deleted if they have active Orders**
- Aggregate: Customer
- Governing Policy: None (referential integrity)
- Exception: GDPR anonymization is allowed; hard deletion is not
- Violation: `CustomerHasActiveOrdersException`

**INV-CRM-004: Customer merge must transfer all associated data to the surviving record**
- Aggregate: Customer
- Governing Policy: `CRMPolicy.merge_strategy`
- Exception: Policy defines how to resolve duplicate addresses and contacts
- Violation: `CustomerMergeDataLossException`

---

## 10. Organization Invariants

**INV-ORG-001: Channel must belong to exactly one Company**
- Aggregate: Company
- Governing Policy: None (organizational invariant)
- Exception: None
- Violation: `ChannelMustBelongToOneCompanyException`

**INV-ORG-002: Company code is immutable once set**
- Aggregate: Company
- Governing Policy: None (identity invariant)
- Exception: None
- Violation: `CompanyCodeImmutableException`

**INV-ORG-003: Every operational entity must have a company_id**
- Aggregate: All
- Governing Policy: None (multi-tenancy invariant — absolute)
- Exception: Only global reference data (Governorate, Currency) is exempt
- Violation: `MissingCompanyContextException`

---

## 11. Cross-Domain Invariants

**INV-XD-001: An entity may only reference another domain's Aggregate Root**
- Applies to: All domains
- Governing Policy: DOM-GOV-006 (architecture rule)
- Exception: None
- Violation: `CrossDomainInternalEntityReferenceException`

**INV-XD-002: An Aggregate's state may only be modified through its own Root**
- Applies to: All aggregates
- Governing Policy: DOM-GOV-001 (architecture rule)
- Exception: None
- Violation: `DirectAggregateChildModificationException`

**INV-XD-003: A Business Event must be produced for every aggregate state change**
- Applies to: All aggregates
- Governing Policy: DOM-GOV-004 (architecture rule)
- Exception: None — events are mandatory for all state transitions
- Violation: `MissingDomainEventException`
