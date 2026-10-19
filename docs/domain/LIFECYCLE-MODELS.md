# Lifecycle Models

**Document:** LIFECYCLE-MODELS  
**Version:** 1.0  
**Status:** APPROVED — Architecture Only  
**Date:** 2026-07-05  
**Task:** TASK-DOMAIN-ARCH-001  
**Parent:** ENTERPRISE-DOMAIN-MODEL.md

---

## 1. Reading Guide

Each lifecycle model shows:
- **States** (boxes) — valid status values
- **Transitions** (arrows with labels) — what triggers the state change
- **Terminal states** (marked ●) — no further transitions possible
- **Guard conditions** — business invariants that must be true for the transition to occur
- **Events produced** — domain events emitted on each transition

---

## 2. Order Lifecycle

```
draft ──[confirm]──► confirmed ──[reserve inventory]──► reserved
                                                              │
                              ┌───────────────────────────────┘
                              ▼
                        in_preparation ──[complete prep]──► ready
                                                              │
                              ┌───────────────────────────────┘
                              ▼
                          dispatched ──[delivery confirmed]──► delivered ●
                                    └──[delivery failed]──► failed
                                                                │
                                              ┌────────────────┘
                                              ▼
                                        partial_delivery ──► delivered ●
                                                         └──► returned ●

From any non-terminal state:
  ──[cancel]──► cancelled ●
  ──[hold]──► on_hold ──[unhold]──► (previous state)
```

| Transition | Guard | Event |
|---|---|---|
| draft → confirmed | At least 1 OrderLine; Customer assigned | OrderConfirmed |
| confirmed → reserved | All OrderLines have confirmed Reservations | OrderReserved |
| reserved → in_preparation | PreparationWave assigned | OrderInPreparation |
| in_preparation → ready | All WaveItems for this order are prepared | OrderReady |
| ready → dispatched | Shipment dispatched | OrderDispatched |
| dispatched → delivered | Delivery confirmed by driver | OrderDelivered |
| dispatched → failed | Delivery failed with reason | OrderDeliveryFailed |
| any → cancelled | No active Shipment in transit | OrderCancelled |
| any → on_hold | Explicit hold action | OrderOnHold |
| on_hold → previous | Explicit unhold action | OrderUnheld |

---

## 3. Reservation Lifecycle

```
pending ──[confirm stock]──► confirmed ──[consume]──► consumed ●
        └──[reject]──► rejected ●

From pending or confirmed:
  ──[cancel]──► cancelled ●
  ──[expire]──► expired ●
```

| Transition | Guard | Event |
|---|---|---|
| pending → confirmed | Available stock >= reservation quantity | ReservationConfirmed |
| confirmed → consumed | PreparationWave item prepared | ReservationConsumed |
| pending → rejected | Available stock < quantity AND policy does not allow | ReservationRejected |
| any → cancelled | Order cancelled or manual release | ReservationCancelled |
| confirmed → expired | Expiry time elapsed (per ReservationPolicy) | ReservationExpired |

---

## 4. Product Lifecycle

```
draft ──[activate]──► active ──[request review]──► pending_review
                             ◄──[approve]──────────────────────┘
                                          └──[reject]──► draft

active ──[deactivate]──► inactive ──[reactivate]──► active
active ──[discontinue]──► discontinued ●
```

| Transition | Guard | Event |
|---|---|---|
| draft → active | SKU set; cost source defined; price > 0 | ProductActivated |
| active → pending_review | Price change exceeds PricingPolicy review threshold | ProductPendingReview |
| pending_review → active | Reviewer approves | ProductApproved |
| pending_review → draft | Reviewer rejects | ProductReviewRejected |
| active → inactive | Explicit deactivation | ProductDeactivated |
| inactive → active | Reactivation (all conditions re-checked) | ProductReactivated |
| active → discontinued | Discontinue action; no active Orders | ProductDiscontinued |

---

## 5. RawMaterial Lifecycle

```
active ──[consume all stock]──► out_of_stock ──[stock added]──► active
       ──[discontinue]──► discontinued ●
```

Note: RawMaterial itself has a simple lifecycle. The complex state is in its InventoryItem stock levels.

**InventoryItem Stock States:**
```
in_stock ──[below reorder point]──► low_stock ──[reach zero]──► out_of_stock
                                            ◄──[stock added]────────────────┘
out_of_stock ──[stock added]──► in_stock or low_stock (depends on quantity)
any ──[discontinue material]──► unavailable ●
```

---

## 6. Recipe Lifecycle

```
draft ──[activate]──► active ──[new version activated]──► archived ●
      └──[clone]──► new draft
```

| Transition | Guard | Event |
|---|---|---|
| draft → active | At least 1 RecipeLine; all materials exist | RecipeActivated |
| active → archived | New Recipe version activated for same Product | RecipeArchived |
| draft → draft (clone) | Any state; creates new draft | RecipeCloned |

---

## 7. Supplier Lifecycle

```
active ──[suspend]──► suspended ──[reinstate]──► active
       ──[deactivate]──► inactive ──[reactivate]──► active
       ──[review flag]──► under_review ──[clear]──► active
                                       └──[suspend]──► suspended
```

---

## 8. PurchaseOrder Lifecycle

```
draft ──[submit]──► submitted ──[confirm]──► confirmed
                                               │
                         ┌─────────────────────┤
                         ▼                     │
              partially_received               │
                         │                     │
                         └──[all lines rcvd]──► fully_received ●

From any non-terminal state:
  ──[cancel]──► cancelled ●
```

| Transition | Guard | Event |
|---|---|---|
| draft → submitted | At least 1 POLine; Supplier active | POSubmitted |
| submitted → confirmed | Supplier acknowledgment recorded | POConfirmed |
| confirmed → partially_received | At least 1 GoodsReceipt posted | POPartiallyReceived |
| any received state → fully_received | All POLines fully received | POFullyReceived |
| any → cancelled | No posted GoodsReceipts (or reversal required) | POCancelled |

---

## 9. GoodsReceipt Lifecycle

```
draft ──[confirm]──► confirmed ──[post]──► posted ●
                                        └──[reverse]──► reversed ●
```

| Transition | Guard | Event |
|---|---|---|
| draft → confirmed | All GR lines have quantities and materials | GRConfirmed |
| confirmed → posted | No pending stock issues; creates ReceiptLayers | GoodsReceived (StockAdded) |
| posted → reversed | Reversal permitted; creates negative StockMovement | GoodsReceiptReversed |

---

## 10. PreparationWave Lifecycle

```
draft ──[plan]──► planned ──[start]──► in_progress ──[complete]──► completed ●
                                                  └──[block]──► blocked
                                                                    │
                                                ┌───────────────────┘
                                                ▼
                                           (resolve) ──► in_progress

From any non-terminal state:
  ──[cancel]──► cancelled ●
```

| Transition | Guard | Event |
|---|---|---|
| draft → planned | All Orders assigned; Reservations confirmed | WavePlanned |
| planned → in_progress | Warehouse staff starts picking | WaveStarted |
| in_progress → blocked | One or more WaveItems cannot be prepared | WaveBlocked |
| blocked → in_progress | Blocking issue resolved | WaveUnblocked |
| in_progress → completed | All WaveItems prepared; pool written | WaveCompleted |

---

## 11. ShippingWave Lifecycle

```
draft ──[plan]──► planned ──[start loading]──► loading ──[complete loading]──► loaded
                                                                                    │
                                                        ┌───────────────────────────┘
                                                        ▼
                                                   dispatched ──[return]──► returned ●
```

| Transition | Guard | Event |
|---|---|---|
| draft → planned | Vehicles assigned; Orders allocated | ShippingWavePlanned |
| planned → loading | At least one LoadingSession opened | LoadingSessionStarted |
| loading → loaded | All LoadingSessions closed; all orders loaded | AllocationCompleted |
| loaded → dispatched | All vehicles depart | WaveDispatched |
| dispatched → returned | Vehicles return (end of route) | WaveReturned |

---

## 12. Vehicle Lifecycle

```
available ──[assign]──► assigned ──[load]──► loading ──[dispatch]──► in_transit
                                                                           │
                   ┌───────────────────────────────────────────────────────┘
                   ▼
            returning ──[arrive]──► available

From any state:
  ──[maintenance]──► under_maintenance ──[cleared]──► available
  ──[deactivate]──► inactive ●
```

---

## 13. Shipment Lifecycle

```
created ──[dispatch]──► in_transit ──[delivery attempted]──► delivered ●
                                 ├──[partial delivery]──► partial_delivery
                                 │                               │
                                 │         ┌─────────────────────┘
                                 │         ▼
                                 │    remaining ──[reattempt]──► in_transit
                                 └──[failed]──► failed
                                                   │
                                   ┌───────────────┘
                                   ▼
                              returned ──[restocked]──► (stock restored) ●
```

---

## 14. POSSession Lifecycle

```
open ──[close]──► closed ──[reconcile]──► reconciled ●
     └──[suspend]──► suspended ──[resume]──► open
```

| Transition | Guard | Event |
|---|---|---|
| open (initial) | No other open session at same Warehouse | SessionOpened |
| open → closed | Cash reconciliation entered | SessionClosed |
| closed → reconciled | Discrepancy reviewed and acknowledged | SessionReconciled |
| open → suspended | System/power failure; resume permitted | SessionSuspended |

---

## 15. Invoice Lifecycle

```
draft ──[issue]──► issued ──[partial payment]──► partially_paid ──[full payment]──► paid ●
                         └──[full payment]──────────────────────────────────────────┘

issued / partially_paid ──[overdue date passes]──► overdue
overdue ──[payment received]──► paid ●
any ──[cancel]──► cancelled ●
paid ──[refund]──► refunded ●
```

---

## 16. Campaign Lifecycle

```
draft ──[schedule]──► scheduled ──[launch date]──► active ──[end date]──► completed ●
     └──[launch now]──────────────────────────────┘

From any non-completed:
  ──[cancel]──► cancelled ●
```

---

## 17. Customer Lifecycle

```
lead ──[first purchase]──► active ──[inactivity threshold]──► at_risk
                                 ◄──[new purchase]──────────────┘
                                 └──[churn threshold]──► churned
                                                             │
                                           ┌────────────────┘
                                           ▼
                                      (re-engaged) ──► active
inactive ──[reactivate]──► active
```

---

## 18. Document Lifecycle (EPS-03)

```
uploading ──[upload complete]──► scanning ──[clean]──► clean ──[archive]──► archived ●
                                         └──[virus found]──► quarantined ●
                                         └──[scan skipped]──► scan_skipped
```

---

## 19. AI Recommendation Lifecycle

```
active ──[acted upon]──► acted_upon ●
       ──[dismissed]──► dismissed ●
       ──[expiry time]──► expired ●
```

---

## 20. Notification Lifecycle (EPS-04)

```
pending ──[sending]──► sending ──[delivered]──► delivered ──[read]──► read ●
                              └──[failed]──► failed ──[retry]──► pending
                              └──[bounced]──► bounced ●
pending ──[expired]──► expired ●
```
