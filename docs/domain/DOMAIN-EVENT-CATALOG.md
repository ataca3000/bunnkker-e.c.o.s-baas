# Domain Event Catalog

**Document:** DOMAIN-EVENT-CATALOG  
**Version:** 1.0  
**Status:** APPROVED — Architecture Only  
**Date:** 2026-07-05  
**Task:** TASK-DOMAIN-ARCH-001  
**Parent:** ENTERPRISE-DOMAIN-MODEL.md  
**Backend:** ENTERPRISE-EVENT-PLATFORM.md (EPS-01)

---

## 1. Event Naming Convention

```
<category>.<entity>.<action>   (past tense, lowercase, dot-separated)

Examples:
  orders.order.confirmed
  inventory.raw_material.stock_added
  fulfillment.wave.completed
```

---

## 2. Event Schema (all events share this structure)

```
event_id        UUID            — Unique event ID (idempotency key)
event_type      string          — Dot-notation type name
event_version   int             — Schema version (starts at 1)
aggregate_type  string          — Aggregate root entity name
aggregate_id    UUID            — Aggregate root ID
company_id      UUID            — Multi-tenancy isolation
occurred_at     datetime        — When the business event happened
triggered_by    UUID            — Actor ID
triggered_by_type enum          — user | system | ai | scheduled | external
correlation_id  UUID            — Links all events in one business flow
causation_id    UUID?           — The event that caused this one (optional)
source_module   string          — Producing module name
payload         JSONB           — Event-specific data
```

---

## 3. Commerce Domain Events

| Event Type | Aggregate | Trigger | Key Consumers | Business Meaning |
|---|---|---|---|---|
| `orders.order.created` | Order | Order saved as draft | CRM, Analytics | New order exists but not yet confirmed |
| `orders.order.confirmed` | Order | Customer confirms order | Inventory (reserve), Finance (invoice draft) | Order is binding; inventory must be reserved |
| `orders.order.reserved` | Order | All reservations confirmed | Fulfillment (wave assignment) | Order is ready to be assigned to a wave |
| `orders.order.in_preparation` | Order | Wave assignment | Commerce (status update) | Order is being prepared in the warehouse |
| `orders.order.ready` | Order | All wave items prepared | Commerce, Loading OS | Order is ready for loading |
| `orders.order.dispatched` | Order | Shipment dispatched | Commerce, CRM, Notifications | Order is on its way |
| `orders.order.delivered` | Order | Delivery confirmed | Finance (close invoice), CRM, Analytics | Order fulfilled successfully |
| `orders.order.cancelled` | Order | Manual or automatic cancel | Inventory (release reservations), Finance | Order is dead; resources must be freed |
| `orders.order.on_hold` | Order | Hold action | Fulfillment (pause wave), Notifications | Order paused; reason required |
| `orders.order.delivery_failed` | Order | Delivery attempt failed | CRM (notify customer), Operations | Delivery could not be completed |
| `orders.order.partial_delivery` | Order | Some items delivered | Finance (partial invoice), Fulfillment | Only part of order was delivered |

---

## 4. Inventory Domain Events

| Event Type | Aggregate | Trigger | Key Consumers | Business Meaning |
|---|---|---|---|---|
| `inventory.product.created` | Product | Product saved | Manufacturing, Analytics | New product exists |
| `inventory.product.activated` | Product | Product made active | Commerce (can now be sold), Channels | Product is available for ordering |
| `inventory.product.deactivated` | Product | Manual deactivation | Commerce (remove from channels) | Product temporarily unavailable |
| `inventory.product.price_changed` | Product | Price update | Finance, Channels, Analytics | Price must be updated everywhere |
| `inventory.product.pending_review` | Product | Price exceeds review threshold | Finance, Notifications | Price change requires approval |
| `inventory.product.discontinued` | Product | Discontinue action | Commerce, Manufacturing | Product will never be sold again |
| `inventory.raw_material.stock_added` | RawMaterial | GoodsReceipt posted | Manufacturing (check MRP), Procurement | Physical stock added; cost layer created |
| `inventory.raw_material.stock_consumed` | RawMaterial | Reservation consumed in wave | Analytics, Procurement (trigger reorder) | Materials used in production |
| `inventory.raw_material.stock_adjusted` | RawMaterial | Inventory count correction | Analytics, Audit | Manual correction applied |
| `inventory.raw_material.stock_reserved` | RawMaterial | Reservation created | Fulfillment (can now plan wave) | Quantity held for production |
| `inventory.raw_material.reservation_cancelled` | RawMaterial | Reservation released | Fulfillment, Manufacturing | Quantity available again |
| `inventory.raw_material.low_stock_alert` | RawMaterial | Below reorder point | Procurement (create MR), Notifications | Time to reorder |
| `inventory.raw_material.out_of_stock` | RawMaterial | Stock reaches zero | Manufacturing (block jobs), Notifications | Critical — production impact |
| `inventory.cost_layer.added` | RawMaterial | GoodsReceipt posted | Manufacturing (update recipe costs), Finance | New FIFO cost layer available |

---

## 5. Manufacturing Domain Events

| Event Type | Aggregate | Trigger | Key Consumers | Business Meaning |
|---|---|---|---|---|
| `manufacturing.recipe.created` | Recipe | Recipe saved as draft | Analytics | New recipe version in draft |
| `manufacturing.recipe.activated` | Recipe | Recipe made active | Inventory (update product cost), Manufacturing | This is now the active recipe for the product |
| `manufacturing.recipe.archived` | Recipe | New version activated | Analytics | Previous version is superseded |
| `manufacturing.recipe.cost_recalculated` | Recipe | Material cost changed | Inventory (update product cost), Finance | Recipe cost has changed; product price may need review |
| `manufacturing.recipe.cloned` | Recipe | Clone action | Analytics | Copy of recipe created |
| `manufacturing.production_job.started` | ProductionJob | Job begins | Inventory (reserve materials) | Production is underway |
| `manufacturing.production_job.completed` | ProductionJob | Job done | Inventory (add finished product stock) | Finished goods added to stock |
| `manufacturing.production_job.cancelled` | ProductionJob | Job cancelled | Inventory (release material reservations) | Materials freed |

---

## 6. Procurement Domain Events

| Event Type | Aggregate | Trigger | Key Consumers | Business Meaning |
|---|---|---|---|---|
| `procurement.supplier.created` | Supplier | Supplier added | Analytics | New supplier available |
| `procurement.supplier.activated` | Supplier | Supplier activated | Procurement (can receive POs) | Supplier is available for ordering |
| `procurement.supplier.suspended` | Supplier | Suspension action | Procurement (block new POs), Notifications | Supplier cannot receive new orders |
| `procurement.purchase_order.created` | PurchaseOrder | PO saved as draft | Analytics | New PO in draft |
| `procurement.purchase_order.submitted` | PurchaseOrder | Submit for approval | Approvals (trigger workflow), Notifications | PO sent for approval |
| `procurement.purchase_order.confirmed` | PurchaseOrder | Supplier confirms | Analytics | PO accepted by supplier |
| `procurement.purchase_order.goods_received` | PurchaseOrder | GoodsReceipt posted | Inventory (stock_added), Finance | Physical goods arrived |
| `procurement.purchase_order.fully_received` | PurchaseOrder | All lines received | Finance (finalize invoice), Analytics | PO complete |
| `procurement.purchase_order.cancelled` | PurchaseOrder | Cancellation | Finance (void invoice), Notifications | PO is dead |
| `procurement.goods_receipt.reversed` | PurchaseOrder | GR reversal | Inventory (remove stock), Finance | Receipt reversed; stock removed |
| `procurement.supplier_invoice.posted` | PurchaseOrder | Invoice posted | Finance (create payable), Analytics | Supplier payment is now due |
| `procurement.material_request.approved` | PurchaseOrder | MR approval | Procurement (create PO), Notifications | Procurement can now raise a PO |

---

## 7. Fulfillment Domain Events

| Event Type | Aggregate | Trigger | Key Consumers | Business Meaning |
|---|---|---|---|---|
| `fulfillment.preparation_wave.created` | PreparationWave | Wave created | Operations (plan pick list), Analytics | New preparation batch created |
| `fulfillment.preparation_wave.started` | PreparationWave | Preparation begins | Orders (in_preparation status), Analytics | Warehouse staff picking |
| `fulfillment.preparation_wave.completed` | PreparationWave | All items prepared | Loading OS (pool available), Analytics | Products ready for loading |
| `fulfillment.preparation_wave.blocked` | PreparationWave | Item cannot be prepared | Operations (exception), Notifications | Supervisor action required |
| `fulfillment.preparation_wave.cancelled` | PreparationWave | Wave cancelled | Inventory (release reservations), Orders | Wave aborted |
| `fulfillment.prepared_pool.added` | PreparationWave | Wave item completed | Loading OS | Products in pool, available for loading |
| `fulfillment.shipping_wave.created` | ShippingWave | Wave planned | Operations (loading OS), Analytics | New shipping batch created |
| `fulfillment.shipping_wave.vehicle_assigned` | ShippingWave | Vehicle assignment | Vehicle (status → assigned), Logistics | Vehicle committed to this wave |
| `fulfillment.shipping_wave.allocation_completed` | ShippingWave | All orders allocated to vehicles | Operations, Analytics | Ready to load |
| `fulfillment.shipping_wave.dispatched` | ShippingWave | Wave departs | Orders (dispatched status), Notifications | Vehicles on the road |
| `fulfillment.loading_session.started` | ShippingWave | Loading session opened | Operations, Analytics | Physical loading began |
| `fulfillment.loading_session.closed` | ShippingWave | Loading session closed | Operations | Vehicle loading complete |
| `fulfillment.shipment.created` | Shipment | Shipment record created | Logistics, Analytics | Formal shipment record |
| `fulfillment.shipment.dispatched` | Shipment | Vehicle departs | Orders (dispatched), Notifications | Shipment is on its way |
| `fulfillment.shipment.delivered` | Shipment | Driver confirms delivery | Orders (delivered), Finance (close invoice), CRM | Successful delivery |
| `fulfillment.shipment.failed` | Shipment | Delivery failed | Operations (exception), CRM, Notifications | Could not deliver |
| `fulfillment.shipment.returned` | Shipment | Vehicle returns to warehouse | Inventory (restock), Analytics | Undelivered items returned |

---

## 8. Logistics Domain Events

| Event Type | Aggregate | Trigger | Key Consumers | Business Meaning |
|---|---|---|---|---|
| `logistics.vehicle.assigned` | Vehicle | Driver + wave assignment | Fulfillment, Analytics | Vehicle committed |
| `logistics.vehicle.loaded` | Vehicle | Loading session completed | Fulfillment, Analytics | Vehicle has cargo |
| `logistics.vehicle.dispatched` | Vehicle | Departs warehouse | Fulfillment, Analytics | Vehicle on route |
| `logistics.vehicle.returned` | Vehicle | Returns to warehouse | Fulfillment (reconcile), Analytics | Route complete |
| `logistics.vehicle.under_maintenance` | Vehicle | Maintenance starts | Operations (availability alert) | Vehicle unavailable |
| `logistics.driver.assigned` | Vehicle | Driver assignment | Operations, Analytics | Driver confirmed for vehicle |

---

## 9. CRM Domain Events

| Event Type | Aggregate | Trigger | Key Consumers | Business Meaning |
|---|---|---|---|---|
| `crm.customer.created` | Customer | Customer added | Commerce (can now receive orders), Analytics | New customer in system |
| `crm.customer.updated` | Customer | Profile update | Channels (sync customer data), Analytics | Customer data changed |
| `crm.customer.merged` | Customer | Merge action | All domains (update references), Analytics | Duplicate resolved; one surviving record |
| `crm.customer.churned` | Customer | Churn threshold met | CRM (re-engagement campaign), Analytics | Customer not buying |
| `crm.customer.reactivated` | Customer | New purchase after churn | Analytics | Churned customer returned |
| `crm.campaign.launched` | Campaign | Campaign starts | Notifications (send campaign), Analytics | Campaign is live |
| `crm.campaign.completed` | Campaign | Campaign ends | Analytics | Campaign over; results available |
| `crm.lead.converted` | Campaign | Lead → Customer | CRM (create Customer), Analytics | Acquisition successful |

---

## 10. Finance Domain Events

| Event Type | Aggregate | Trigger | Key Consumers | Business Meaning |
|---|---|---|---|---|
| `finance.invoice.issued` | Invoice | Invoice sent | CRM (notify customer), Analytics | Payment due |
| `finance.invoice.payment_received` | Invoice | Payment recorded | Analytics, CRM | Money received |
| `finance.invoice.paid` | Invoice | Full payment | Analytics, CRM | Fully settled |
| `finance.invoice.overdue` | Invoice | Due date passed without payment | CRM (chase), Notifications | Escalation required |
| `finance.invoice.cancelled` | Invoice | Cancellation | Analytics | Invoice void |
| `finance.refund.issued` | Invoice | Refund action | Inventory (restock if needed), CRM | Money returned |
| `finance.pos_session.opened` | POSSession | Session start | Analytics | POS is live |
| `finance.pos_session.closed` | POSSession | Session end | Analytics, Finance | POS closed for the day |
| `finance.pos_sale.completed` | POSSession | Sale finalized | Inventory (deduct stock), Finance (create invoice) | POS sale done |
| `finance.pos_sale.refunded` | POSSession | Refund action | Inventory (return stock) | POS sale reversed |

---

## 11. Platform Domain Events (EPS)

| Event Type | Aggregate | Trigger | Key Consumers | Business Meaning |
|---|---|---|---|---|
| `platform.document.attached` | Document | File uploaded | Timeline (record), Analytics | File associated with business object |
| `platform.document.quarantined` | Document | Virus found | Notifications (alert admin), Audit | File is infected |
| `platform.notification.sent` | Notification | Delivery attempted | Analytics, Audit | Notification dispatched |
| `platform.notification.failed` | Notification | Delivery failed | Audit, Retry queue | Notification not delivered |
| `platform.ai.recommendation_generated` | AIRecommendation | AI model output | Notifications (if high priority), Timeline | AI has a suggestion |
| `platform.ai.recommendation_acted_upon` | AIRecommendation | User acts | AI model (feedback), Analytics | User followed AI advice |
| `platform.ai.recommendation_dismissed` | AIRecommendation | User dismisses | AI model (negative feedback) | User rejected AI advice |

---

## 12. Event Consumer Matrix

| Consumer Module | Subscribed Event Categories |
|---|---|
| Inventory | orders, procurement, manufacturing, pos |
| Finance | orders, procurement, fulfillment, pos |
| Fulfillment | orders, inventory, logistics |
| CRM | orders, finance, crm |
| Manufacturing | inventory, procurement |
| Notifications (EPS-04) | ALL (policy-filtered) |
| Timeline (EPS-02) | ALL |
| AI Platform | ALL |
| Analytics | ALL |
| Audit Platform | ALL |

---

## 13. Governance

| Rule | Constraint |
|---|---|
| DOM-GOV-004 | Every aggregate must produce a Business Event for every state change |
| Idempotency | event_id is the idempotency key; consumers must check before processing |
| Ordering | Events within a single aggregate are ordered by occurred_at; cross-aggregate ordering is eventual |
| Immutability | Published events are never modified or deleted |
| Versioning | Event schema changes increment event_version; consumers must use Tolerant Reader pattern |
