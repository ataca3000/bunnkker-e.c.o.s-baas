# Analytical Data Model

**Document:** ANALYTICAL-DATA-MODEL  
**Version:** 1.0  
**Status:** APPROVED — Architecture Only  
**Date:** 2026-07-05  
**Task:** TASK-INFORMATION-ARCH-001  
**Parent:** ENTERPRISE-INFORMATION-ARCHITECTURE.md

---

## 1. What Is Analytical Data?

Analytical data is derived from transactional and master data, pre-aggregated for reporting, dashboards, and AI. It answers "how are we doing?" rather than "what just happened?"

**Characteristics:**
- Derived — always computed from operational data, never entered directly
- Refreshed — updated by event subscriptions or scheduled jobs
- Read-optimized — designed for fast queries, not transactional updates
- May be stale — tolerable lag (seconds to minutes); never used for financial decisions
- Separate from operational store — never in the same tables as transactional data

**INFO-GOV-007:** Analytical data is derived from events and transactions; never from operational mutations.

---

## 2. Analytical Data Categories

### Category A: Read Models (CQRS Projections)
Real-time-ish projections maintained by event listeners. Updated within seconds of the originating event.

| Read Model | Source Events | Consumers | Staleness Tolerance |
|---|---|---|---|
| `orders.summary` | orders.order.* | Commerce list, CRM | < 30s |
| `inventory.availability` | inventory.*.stock_* | Fulfillment, Manufacturing | < 30s |
| `fulfillment.wave_status` | fulfillment.preparation_wave.* | Preparation OS dashboard | < 15s |
| `logistics.fleet_status` | logistics.vehicle.* | Loading OS, Operations CC | < 30s |
| `procurement.supplier_health` | procurement.* | Supplier workspace | < 5 min |
| `crm.customer_summary` | orders.order.delivered, finance.invoice.* | CRM, Commerce | < 5 min |
| `finance.ar_summary` | finance.invoice.*, finance.*.payment_* | Finance dashboard | < 5 min |

### Category B: KPI Snapshots
Pre-computed aggregates refreshed on a schedule. Used for dashboard KPI cards.

| Snapshot | Refresh | Period | Contents |
|---|---|---|---|
| `kpi.daily_orders` | Hourly | Rolling 30 days | order_count, revenue, avg_order_value per day |
| `kpi.fulfillment_performance` | Hourly | Rolling 7 days | on_time_rate, avg_prep_time, wave_completion_rate |
| `kpi.inventory_health` | Every 4h | Current | low_stock_count, overstock_count, total_value |
| `kpi.supplier_performance` | Daily | Rolling 90 days | on_time_delivery_rate, quality_score per supplier |
| `kpi.revenue_by_channel` | Daily | Rolling 90 days | revenue, order_count per channel |

### Category C: Demand Analysis Projections
Used by the Demand Analysis Engine and AI platform.

| Projection | Source | Update Frequency |
|---|---|---|
| `demand.product_velocity` | StockMovements (consumption) | Daily |
| `demand.order_patterns` | Orders (by channel, day, region) | Daily |
| `demand.reorder_signals` | ReceiptLayers + consumption rate | Daily |
| `demand.seasonal_index` | Historical orders by period | Weekly |

### Category D: AI Training Data
Prepared datasets for AI model training. Separate from operational data.

| Dataset | Source | Privacy Treatment |
|---|---|---|
| Order history (anonymized) | Orders + customer segments | Customer PII removed; segment ID retained |
| Delivery performance | Shipments + routes | No PII; all driver IDs pseudonymized |
| Demand forecasting inputs | Product velocity + stock levels | No PII |
| Supplier reliability | GR timing + quality scores | No PII |

---

## 3. Analytical Data Architecture

```
Operational Events (EPS-01)
           │
           ▼
┌──────────────────────────────────────────────────────┐
│  EVENT LISTENER LAYER                                │
│  Subscribes to domain events; populates projections  │
└───────────────────────────┬──────────────────────────┘
                            │
           ┌────────────────┴────────────────┐
           ▼                                 ▼
┌──────────────────────┐       ┌─────────────────────────┐
│  READ MODELS (CQRS)  │       │  ANALYTICAL STORE       │
│  Same PostgreSQL DB  │       │  (Separate schema or    │
│  Separate schema     │       │   separate DB — TBD)    │
│  Rebuilt from events │       │  KPI Snapshots          │
│  Near real-time      │       │  Demand Projections     │
└──────────────────────┘       └──────────┬──────────────┘
                                           │
                                           ▼
                               ┌───────────────────────┐
                               │  AI Training Datasets │
                               │  (Anonymized extract) │
                               └───────────────────────┘
```

---

## 4. Governance Rules for Analytical Data

| Rule | Statement |
|---|---|
| **ANA-GOV-001** | Analytical data is never the source of truth for financial decisions; operational tables are authoritative |
| **ANA-GOV-002** | Read models can be fully rebuilt from events — they are projections, not primary records |
| **ANA-GOV-003** | KPI snapshots are labeled with their refresh timestamp so consumers know the data age |
| **ANA-GOV-004** | AI training datasets must not contain PII; anonymization is enforced before export |
| **ANA-GOV-005** | Analytical schema changes do not require a migration rollback plan — the projection is rebuildable |
| **ANA-GOV-006** | No analytical read model may be queried directly in a transaction-critical path |

---

## 5. Projection Rebuild Strategy

When a read model is corrupted, stale, or newly created:

```
1. Truncate the projection table (or create fresh)
2. Replay all relevant events from EPS-01 event store
3. Run event listeners in chronological order
4. Mark projection as "rebuilding" during this window (UI shows "data loading")
5. Swap to new projection when complete
```

This rebuild strategy means read models carry zero long-term risk — they are always disposable and recreatable.
