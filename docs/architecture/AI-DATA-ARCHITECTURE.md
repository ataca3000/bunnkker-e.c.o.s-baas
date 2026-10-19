# ECOS ERP — AI Data Architecture: Manufacturing & Procurement

**Document:** AI-DATA-ARCHITECTURE  
**Version:** 1.0  
**Task:** TASK-MFG-DB-001  
**Status:** Draft — Awaiting Approval  
**Date:** 2026-06-29  
**Scope:** Phase G — AI Entry Points, Analytical Datasets, Training Data Design

**IMPORTANT:** This document describes the AI readiness of the data model. No migrations, models, or code are created here.

---

## Purpose

This document identifies every place in the manufacturing and procurement database design where AI can improve system behavior — either as real-time prediction or as offline model training input. It catalogs the analytical datasets the new tables produce and how those datasets are structured for AI consumption.

The system described here is **demand-driven**: every manufacturing and procurement action starts from a customer order. This makes the data model unusually clean for AI — every event has a clear cause (an order), a clear actor (the decision engine), and a clear outcome (inventory change or cost change). The decision chain is fully logged.

---

## AI Entry Points

### Entry Point 1 — Decision Engine Suggestions

**Where:** `decision_logs` table  
**Signal:** The engine already classifies every incoming event (GOODS_RECEIPT, ORDER_PLACED, etc.) against a 22-row decision matrix and logs its result.

**Current (rule-based):** Decisions are deterministic — the same inputs always produce the same output. No uncertainty, no ranking.

**AI opportunity:** Replace or augment threshold comparisons with probability scores:
- "Should we manufacture now or wait for a cheaper procurement cycle?" — score both options from historical cost data
- "Will this stock be consumed fast enough to justify manufacturing today?" — score from consumption velocity data
- "Which supplier should the purchase request be routed to?" — score from `supplier_performance_analytics` (see below)

**Training signal:** The `decision_logs` table provides labeled outcome data. Each log row records: input event → decision taken → resolution outcome (did the manufacturing succeed? did inventory satisfy the order?). This is a natural multi-class classification dataset.

**Key columns for training:**
```
decision_logs:
  triggering_event        -- input class
  event_payload           -- JSONB features (order_qty, stock_on_hand, etc.)
  decision_type           -- output class
  resolution_status       -- was this the right decision? (from downstream outcome)
  resolution_notes        -- human override description
```

---

### Entry Point 2 — Procurement Scheduler

**Where:** `scheduler_runs` table + `procurement_queue_entries`  
**Signal:** Every scheduler run generates a snapshot of net requirements (procurement_queue) and emits purchase_requests.

**Current (rule-based):** Net Requirement = Demand − (Stock + In-Transit + In-Production). Safety stock threshold is a manually configured constant per product.

**AI opportunity:**
- **Dynamic safety stock** — replace the static threshold with a predicted safety stock level based on lead time variability, demand volatility, and seasonal patterns
- **Lead time prediction** — predict expected delivery time for a supplier+product pair from historical GR timing vs PO date
- **Demand spike detection** — flag orders that look anomalous before they flow into the queue, to avoid over-manufacturing

**Training signal:** `scheduler_runs` + `procurement_queue_entries` + `purchase_requests` + actual GR dates. The gap between `estimated_delivery_date` (set on PR creation) and actual GR `received_at` is a direct lead time error signal.

---

### Entry Point 3 — Recipe Cost Estimation

**Where:** `bills_of_materials` + `bill_of_material_lines` + `product_cost_histories`  
**Signal:** Every time a product's cost is recalculated by the Cost Engine, a `product_cost_histories` row is written with the new cost, the cost source, and the previous cost.

**Current (rule-based):** Cost is calculated exactly from BOM lines × current input costs. No forecasting.

**AI opportunity:**
- **Cost trend forecasting** — predict where a product's manufacturing cost will be in 30/60/90 days based on raw material cost trends
- **Recipe optimization suggestions** — detect when a substitute input material would produce the same output at lower cost (requires product similarity model)
- **Variance alerts** — flag when actual manufacturing cost deviates significantly from the BOM-predicted cost (signals wastage or measurement error)

**Training signal:** `product_cost_histories` joined with `manufacturing_transactions` (actual cost) and `goods_receipts` (input material cost at GR time).

---

### Entry Point 4 — Supplier Selection

**Where:** `purchase_requests` + `purchase_orders` + `goods_receipts`  
**Signal:** The full supplier lifecycle is captured — PR created → PO issued to supplier → GR received. Every GR records received quantity vs ordered quantity, and received_at vs promised delivery date.

**Current:** Supplier is selected manually when converting a PR to a PO.

**AI opportunity:**
- **Supplier ranking** — score suppliers on: on-time delivery rate, quantity accuracy, price stability, lead time consistency
- **Supplier recommendation** — when converting a PR to a PO, suggest the best supplier for that product based on recent performance

**Training signal:** See Supplier Performance Analytics section below.

---

### Entry Point 5 — Inventory Consumption Patterns

**Where:** `inventory_layer_consumptions` (extended) + `order_lines` + `products`  
**Signal:** Every FIFO consumption records: which product, which warehouse, consumed quantity, and (post-migration) whether it was consumed for a sale or for manufacturing.

**Current:** No forecasting. Inventory is reactive.

**AI opportunity:**
- **Demand forecasting per product** — predict next 7/14/30 day sales volume per product per warehouse
- **Reorder point optimization** — combine demand forecast with lead time prediction to recommend when to trigger procurement
- **Dead stock detection** — flag products with consumption_velocity < threshold for a configurable period

**Training signal:** `inventory_layer_consumptions` WHERE consumption_type = 'sales' joined with `order_lines` for date and channel context.

---

### Entry Point 6 — Disassembly Recovery Rate

**Where:** `disassembly_recoveries` + `disassembly_transactions` + `bills_of_materials`  
**Signal:** Every disassembly records expected recovery (from BOM) vs actual recovery (from `disassembly_recoveries.recovered_quantity`).

**Current:** Recovery rate is assumed to equal the BOM quantity. No actuals tracked.

**AI opportunity:**
- **Recovery rate prediction** — predict actual recovery yield for a product based on historical disassembly outcomes
- **Variance alerting** — flag disassemblies where actual recovery diverges significantly from BOM expectation

**Training signal:** `disassembly_recoveries` (recovered_quantity) vs expected from `bill_of_material_lines` (quantity × unit conversion).

---

## Analytical Datasets

Each section below describes an analytical view — the source tables, join logic, grain, and intended AI/analytics use.

---

### DS-001 · Decision History Analytics

**Purpose:** Train the Decision Engine classifier and audit decision quality over time.

**Grain:** One row per decision log entry

**Source tables:**
```
decision_logs               -- core fact
products                    -- product features (can_manufacture, can_disassemble, cost_source)
orders                      -- order context (value, customer, channel)
procurement_queue_entries   -- net requirement at decision time
```

**Key analytical fields:**
```
decision_logs.id
decision_logs.company_id
decision_logs.triggering_event
decision_logs.decision_type
decision_logs.event_payload              -- JSONB: stock_on_hand, order_qty, cost, etc.
decision_logs.resolution_status          -- 'auto' | 'human_override' | 'failed' | 'pending'
decision_logs.created_at
-- derived:
event_payload->>'stock_on_hand'          -- stock at decision time
event_payload->>'order_quantity'         -- demand quantity
event_payload->>'current_cost'           -- cost at decision time
p.can_manufacture                        -- product capability
p.cost_source                            -- cost policy
```

**AI use:**
- Multi-class classification: (event + features) → decision_type
- Anomaly detection: which decisions were overridden by humans? what were their feature values?
- Decision latency analysis: time-to-resolution by event type

**Refresh cadence:** Append-only. No refresh needed — query directly.

---

### DS-002 · Demand History

**Purpose:** Train demand forecasting models and reorder point optimization.

**Grain:** One row per order line (consumed from inventory)

**Source tables:**
```
order_lines                     -- the demand event
orders                          -- date, channel, branch
inventory_layer_consumptions    -- actual FIFO consumption tied to this order line
products                        -- product features
```

**Key analytical fields:**
```
ol.product_id
ol.quantity                      -- ordered quantity
ol.unit_price                    -- sale price at time of order
o.created_at                     -- demand date
o.branch_id                      -- location of demand
o.channel                        -- WooCommerce / retail / wholesale
p.product_type                   -- raw / finished / service / merchandise
-- derived:
DATE_TRUNC('week', o.created_at) -- weekly demand bucket
DATE_TRUNC('month', o.created_at)-- monthly demand bucket
```

**AI use:**
- Time-series forecasting: demand by product + week/month
- Seasonality detection: holiday spikes, weekly patterns
- Demand elasticity: price sensitivity per product category

**Refresh cadence:** Continuous — new rows append on every order. Historical window: rolling 2 years minimum.

---

### DS-003 · Supplier Performance

**Purpose:** Score suppliers for selection recommendations and lead time prediction.

**Grain:** One row per goods receipt line (one supplier delivery for one product)

**Source tables:**
```
goods_receipt_lines     -- received quantity + cost
goods_receipts          -- received_at, supplier_id, purchase_order_id
purchase_orders         -- expected_delivery_date, po_date
purchase_order_lines    -- ordered quantity + agreed unit cost
products                -- product context
```

**Key analytical fields:**
```
gr.supplier_id
grl.product_id
grl.quantity_received
pol.quantity_ordered
grl.unit_cost                               -- actual GR unit cost
pol.unit_price                              -- PO agreed price
po.expected_delivery_date                   -- promised date
gr.received_at                              -- actual receipt date
-- derived:
grl.quantity_received / pol.quantity_ordered AS quantity_fill_rate
EXTRACT(DAYS FROM gr.received_at - po.expected_delivery_date) AS delivery_delay_days
grl.unit_cost / pol.unit_price              AS price_deviation_ratio
```

**AI use:**
- Supplier scoring: on-time rate, quantity accuracy, price stability
- Lead time prediction: predict expected delivery date for (supplier, product) pair
- Supplier ranking per product: who to route a PR to

**Refresh cadence:** Append-only (GRs don't change after posting). Recalculate supplier scores weekly.

---

### DS-004 · Recipe Performance

**Purpose:** Detect BOM accuracy issues and optimize recipe quantities.

**Grain:** One row per manufacturing transaction

**Source tables:**
```
manufacturing_transactions      -- output quantity, status, cost
manufacturing_consumptions      -- actual input consumed per ingredient
bills_of_materials              -- the recipe used
bill_of_material_lines          -- expected input quantity per ingredient
decision_logs                   -- the decision that triggered this transaction
```

**Key analytical fields:**
```
mt.id
mt.product_id                            -- finished product
mt.quantity_produced
mt.actual_unit_cost                      -- actual cost per unit
mt.bom_id                                -- which BOM was used
mt.bom_version_number                    -- which version
mt.status                                -- completed | failed
mt.created_at
-- per ingredient (join to manufacturing_consumptions):
mc.input_product_id
mc.quantity_consumed                     -- actual
bml.quantity                             -- expected (from BOM line)
mc.quantity_consumed / bml.quantity AS yield_ratio   -- 1.0 = perfect
-- derived:
mt.actual_unit_cost / bom_expected_cost AS cost_variance
```

**AI use:**
- BOM accuracy scoring: which recipes produce the expected yield?
- Manufacturing variance detection: flag transactions where yield deviates from BOM
- Cost prediction: predict manufacturing cost given current input costs
- Failure pattern analysis: what conditions correlate with manufacturing failures?

**Refresh cadence:** Append-only. Query directly.

---

### DS-005 · Cost Trend Analysis

**Purpose:** Forecast future product costs and detect pricing anomalies.

**Grain:** One row per cost history entry per product

**Source tables:**
```
product_cost_histories      -- core fact
products                    -- product context
```

**Key analytical fields:**
```
pch.product_id
pch.cost_source             -- what drove this cost change?
pch.new_cost
pch.previous_cost
pch.created_at
-- derived:
pch.new_cost - pch.previous_cost AS cost_delta
(pch.new_cost - pch.previous_cost) / NULLIF(pch.previous_cost, 0) AS cost_change_pct
DATE_TRUNC('month', pch.created_at) AS cost_month
```

**AI use:**
- Cost forecasting: predict unit cost in 30/60/90 days
- Anomaly detection: sudden cost jumps (supplier price shock, recipe error)
- Cost correlation: which raw material cost changes drive finished product cost changes?
- Margin erosion alerts: when cost trends upward but selling price is fixed

**Refresh cadence:** Append-only. Build time-series index on (product_id, created_at).

---

### DS-006 · Inventory Consumption Velocity

**Purpose:** Track how fast each product moves through inventory and detect slow/dead stock.

**Grain:** Daily consumption total per product per warehouse

**Source tables:**
```
inventory_layer_consumptions    -- individual FIFO consumption events (extended)
inventory_receipt_layers        -- stock receipt events (to calculate days on hand)
products                        -- product context
```

**Key analytical fields:**
```
ilc.product_id
ilc.warehouse_id                         -- where consumed
ilc.consumption_type                     -- sales | manufacturing | disassembly
DATE(ilc.consumed_at) AS consumption_date
SUM(ilc.quantity_consumed) AS daily_consumed
-- derived (requires join to receipt layers):
AVG(daily_consumed) OVER (
  PARTITION BY ilc.product_id, ilc.warehouse_id
  ORDER BY consumption_date
  ROWS BETWEEN 29 PRECEDING AND CURRENT ROW
) AS rolling_30d_avg_daily_consumption
```

**AI use:**
- Days-on-hand prediction: current_stock / rolling_avg_daily_consumption
- Stockout risk scoring: probability of stockout before next procurement cycle
- Dead stock detection: products with rolling avg consumption near zero for 90+ days
- ABC classification improvement: current ABC is static; replace with velocity-weighted dynamic classification

**Refresh cadence:** Materialized view refreshed daily at end of operational day.

---

### DS-007 · Procurement Queue Evolution

**Purpose:** Track how the net requirement changes over time to understand demand-procurement lag.

**Grain:** One row per scheduler run per queue entry

**Source tables:**
```
scheduler_runs              -- the run that produced this snapshot
procurement_queue_entries   -- current queue state
purchase_requests           -- what was generated
goods_receipts              -- when was the demand actually fulfilled
```

**Key analytical fields:**
```
sr.id AS scheduler_run_id
sr.company_id
sr.triggered_at
pqe.product_id
pqe.net_requirement_quantity
pqe.on_hand_quantity
pqe.in_transit_quantity
pqe.demand_source_payload   -- JSONB: order IDs driving the demand
pr.id AS purchase_request_id
pr.requested_quantity
pr.status
-- derived (after GR):
gr.received_at AS fulfilled_at
EXTRACT(DAYS FROM gr.received_at - sr.triggered_at) AS demand_to_fulfillment_days
```

**AI use:**
- Procurement cycle optimization: how many days between demand appearing in queue and inventory arriving?
- Safety stock calibration: what minimum stock prevents stockouts given observed fulfillment times?
- Queue accuracy: does net_requirement_quantity predict actual order volume for the next N days?

**Refresh cadence:** Built from scheduler run events. Append-only core; derived metrics recalculated after GR posting.

---

### DS-008 · Disassembly Recovery Analysis

**Purpose:** Track actual recovery yield vs BOM expectations per product and per version.

**Grain:** One row per disassembly recovery (one row per recovered component per transaction)

**Source tables:**
```
disassembly_recoveries          -- actual recovered
disassembly_transactions        -- parent transaction
bills_of_materials              -- recipe used
bill_of_material_lines          -- expected recovery quantities
products                        -- input (finished) and output (component) context
```

**Key analytical fields:**
```
dt.product_id                           -- disassembled product
dt.quantity_disassembled
dt.bom_id
dt.bom_version_number
dr.output_product_id                    -- recovered component
dr.recovered_quantity                   -- actual
bml.quantity                            -- expected per BOM
bml.quantity * dt.quantity_disassembled AS expected_total
dr.recovered_quantity / (bml.quantity * dt.quantity_disassembled) AS recovery_rate
dt.created_at
```

**AI use:**
- Recovery rate modeling: predict expected recovery for a disassembly job before it runs
- Anomaly detection: flag transactions where recovery rate < threshold
- BOM accuracy: if recovery rates consistently differ from BOM quantities, the BOM is wrong
- Cost estimation improvement: adjust disassembly cost estimates based on observed recovery rates

**Refresh cadence:** Append-only. Query directly.

---

## Event Stream Schema

The database design is well-suited to event-driven AI pipelines. The following tables are natural event sources:

| Table | Event | Payload |
|-------|-------|---------|
| `decision_logs` | DecisionMade | triggering_event, decision_type, event_payload |
| `manufacturing_transactions` (status change) | ManufacturingCompleted / ManufacturingFailed | product_id, qty, actual_unit_cost |
| `disassembly_transactions` (status change) | DisassemblyCompleted | product_id, qty |
| `product_cost_histories` | CostUpdated | product_id, new_cost, previous_cost, cost_source |
| `scheduler_runs` (completed) | SchedulerRunCompleted | company_id, products_queued, requests_generated |
| `purchase_requests` (status change) | PurchaseRequestConverted | product_id, supplier_id, quantity |
| `procurement_queue_entries` (net_requirement change) | QueueEntryUpdated | product_id, new_requirement, demand_sources |

These events can be streamed via PostgreSQL LISTEN/NOTIFY to an AI inference service for real-time predictions.

---

## Data Retention & Training Windows

| Dataset | Minimum History | Maximum History | Notes |
|---------|----------------|----------------|-------|
| DS-001 Decision History | 1 year | Indefinite | Immutable — never deleted |
| DS-002 Demand History | 2 years | 5 years | Seasonal patterns require 2+ years |
| DS-003 Supplier Performance | 1 year | 3 years | Supplier relationships change |
| DS-004 Recipe Performance | 6 months | Indefinite | Per BOM version |
| DS-005 Cost Trends | 2 years | 5 years | Cycle detection needs 2+ years |
| DS-006 Consumption Velocity | 1 year | 3 years | Seasonal window |
| DS-007 Procurement Queue | 1 year | Indefinite | Immutable scheduler_runs |
| DS-008 Disassembly Recovery | 6 months | Indefinite | Builds slowly |

---

## AI Readiness Checklist

| Requirement | Status | Notes |
|-------------|--------|-------|
| All decisions logged with full payload | ✓ DESIGNED | decision_logs with JSONB event_payload |
| Immutable transaction history | ✓ DESIGNED | 4 immutable tables + DB-level REVOKE |
| Outcome tracking per decision | ✓ DESIGNED | resolution_status + resolution_notes in decision_logs |
| Supplier performance data | ✓ EXISTING | goods_receipts + purchase_orders already exist |
| Recipe vs actual cost comparison | ✓ DESIGNED | manufacturing_consumptions vs bill_of_material_lines |
| Demand time-series | ✓ EXISTING | order_lines + orders already exist |
| Recovery yield tracking | ✓ DESIGNED | disassembly_recoveries with recovered_quantity |
| Cost change history | ✓ DESIGNED | product_cost_histories (append-only) |
| Event payload stored as JSONB | ✓ DESIGNED | event_payload in decision_logs |
| Consumption type discrimination | ✓ DESIGNED | consumption_type in inventory_layer_consumptions |
| Human override tracking | ✓ DESIGNED | resolution_status = 'human_override' in decision_logs |
| Per-BOM version performance | ✓ DESIGNED | bom_version_number in manufacturing_transactions |

**Awaiting approval before any implementation begins.**

---

## Enterprise Platform Services AI Integration (TASK-EPS-ARCH-001)

### AI and EPS-01 — Enterprise Event Platform

AI integrates with the Enterprise Event Platform as a first-class subscriber and publisher.

**AI as subscriber:**
- AI subscribes to event categories relevant to its models (logistics, preparation, allocation, manufacturing, etc.)
- AI never queries operational modules directly — all historical data is sourced from events
- AI event subscriptions are configured via `AIPolicy` (`ai.event_subscriptions` setting)

**AI as publisher (ai.* event category):**
- `ai.recommendation.generated` — a new recommendation is ready
- `ai.prediction.made` — a demand/availability/delay prediction is produced
- `ai.anomaly.detected` — pattern deviation detected in operational data
- `ai.model.retrained` — a model completed a training cycle

**Governance (GOV-015):**
AI consumes Events and produces Recommendations. AI never queries operational module databases directly.

### AI and EPS-04 — Enterprise Notification Platform

AI-triggered notifications flow exclusively through the Notification Platform:
- AI publishes `ai.recommendation.generated` event → EPS-04 delivers to relevant users
- Notification priority and targeting governed by `NotificationPolicy`
- AI may not call notification delivery APIs directly

### AI Event Entry Points (EPS extensions)

| Entry Point | Event Consumed | AI Action |
|---|---|---|
| EP-AI-01 | `logistics.delivery.failed` | Update delivery failure prediction model |
| EP-AI-02 | `preparation.shortage.detected` | Update shortage risk scores |
| EP-AI-03 | `loading.exception.raised` | Update loading delay prediction model |
| EP-AI-04 | `allocation.partial` | Train partial allocation pattern detector |
| EP-AI-05 | `manufacturing.job.completed` | Update yield prediction model |
| EP-AI-06 | `order.confirmed` | Update demand forecast |

---

## Configuration Platform AI Integration (TASK-CONFIGURATION-ARCH-001)

The AI Platform is governed by `AIPolicy` resolved from the Enterprise Configuration Platform. AI never bypasses the Policy Engine.

### AIPolicy Configuration Settings

| Setting Key | Description |
|---|---|
| `ai.recommendations_enabled` | Global AI recommendations switch |
| `ai.min_confidence_threshold` | Minimum confidence to surface a recommendation |
| `ai.require_explanation` | AI must always provide explanation text |
| `ai.allow_auto_apply` | AI may apply recommendations without human approval |
| `ai.auto_apply_max_confidence` | Confidence floor for auto-apply |
| `ai.audit_all_evaluations` | Log every AI evaluation (high-volume toggle) |

### AI Recommendation Structure

Every AI recommendation must include:

```
AIRecommendation
├── entry_point               string    — which EP-* generated this (e.g. "EP-A1")
├── policy_id                 → Policy  — which policy was consulted
├── policy_version            int
├── config_version_id         → ConfigurationVersion
├── recommendation            mixed     — the suggested decision
├── confidence                decimal   — 0.0 to 1.0
├── explanation               text      — human-readable reason
├── override_permitted        bool      — can a human override this?
├── evaluation_audit_id       → PolicyEvaluationAudit
└── generated_at              timestamp
```

### Feature Flags for AI

```
ai.recommendations.enabled                 — global toggle
ai.recommendations.allocation              — allocation suggestions
ai.recommendations.vehicle_planning        — vehicle planning suggestions
ai.recommendations.route_optimization      — route optimization
ai.recommendations.demand_forecast         — demand forecasting
ai.recommendations.supplier_scoring        — supplier scoring
ai.auto_apply.enabled                      — auto-application without human review
```

---

## Enterprise Fulfillment AI Integration

> **Added:** TASK-FULFILLMENT-ARCH-001 (ADR-015)  
> **Scope:** Fulfillment Platform — Preparation OS, Loading & Allocation OS, Vehicle Mobile Warehouse, Logistics OS

The Enterprise Fulfillment Platform generates rich operational data at each stage of the fulfillment pipeline. This section documents the AI entry points and training datasets produced by the new fulfillment modules.

---

### Entry Point EP-G1 — Shipping Company Auto-Selection Optimization

**Where:** `channel_shipping_rules` + `shipping_coverage` + historical delivery performance  
**Signal:** Every auto-selected shipping company, with the delivery outcome (on-time, failed, returned).

**Current (rule-based):** Selection is deterministic — first company with coverage + available capacity, ordered by static priority number.

**AI opportunity:**
- **Dynamic priority scoring** — replace static priority numbers with predicted delivery success rates per company per zone per day-of-week
- **Capacity prediction** — predict which companies will hit their daily cap before planning starts
- **Zone performance patterns** — detect that Company A consistently fails in Zone X during Ramadan; auto-deprioritize

**Training signal:** `shipping_coverage` + `channel_shipping_rules` + delivery outcome per (company, zone, channel) combination.

---

### Entry Point EP-G2 — Address Resolution Quality

**Where:** `orders` (geography_zone_id resolution status)  
**Signal:** Orders that failed address resolution vs. those that succeeded, with the zone they eventually landed in.

**AI opportunity:**
- **Fuzzy address matching** — use historical resolution patterns to resolve ambiguous addresses automatically
- **Address quality scoring** — predict at order creation whether the address is likely to fail geocoding
- **Zone boundary learning** — learn zone assignments from manually resolved cases

**Training signal:** Historical manual zone assignments + their corresponding raw address strings.

---

### Entry Point EP-V1 — Vehicle Count Pre-Estimation

**Where:** `vehicle_plans` + `geography_groups`  
**Signal:** Historical VehiclePlans with their final vehicle count, total orders, total weight, total volume, and any planner-added extra vehicles.

**Current (rule-based):** CEIL formula applied separately for each constraint dimension.

**AI opportunity:**
- **Pre-estimation** — predict final vehicle count before full calculation (reduces planning latency for large order sets)
- **Planner override prediction** — predict when the planner is likely to add/remove vehicles and pre-suggest it
- **Utilization optimization** — suggest order redistributions that bring all vehicles to within 5% utilization of each other

**Training signal:** `vehicle_plans` + `vehicle_plan_slots` (final approved distribution) vs. initial calculated distribution.

---

### Entry Point EP-V2 — Route-Aware Order Distribution

**Where:** `vehicle_plan_slots` + `orders` (delivery addresses) + `delivery_stops` (historical timing)  
**Signal:** Clusters of orders that, when assigned to the same vehicle, produced efficient routes vs. those that caused backtracking.

**AI opportunity:**
- **Geographic clustering** — automatically group orders into slots that minimize total route distance
- **Backtracking detection** — flag proposed slot distributions that will require inefficient routing
- **Time-window optimization** — group orders with similar customer-preferred delivery windows

**Training signal:** `delivery_stops` (sequence vs. actual travel times) + `vehicle_plan_slots` (order distribution) + geographic coordinates.

---

### Entry Point EP-A1 — Allocation Priority Learning

**Where:** `order_allocations` + `partial_fulfillment_events`  
**Signal:** Which allocation priority policies produced the best delivery outcomes (on-time, no returns, no complaints).

**Current (rule-based):** Priority is a static ordered list (Paid → COD → Deferred → Others).

**AI opportunity:**
- **Dynamic priority scoring** — score each order's delivery success probability and use it to sequence allocation
- **Partial allocation impact modeling** — predict which partial allocations will lead to customer complaints
- **Policy recommendation** — suggest changes to the AllocationPriorityPolicy based on observed outcomes

**Training signal:** `order_allocations` (allocation_mode, priority_rank) + delivery outcomes + return rates per order type.

---

### Entry Point EP-A2 — Driver Override Pattern Analysis

**Where:** `allocation_revisions` (actor_type = driver)  
**Signal:** Which driver overrides led to better outcomes vs. worse outcomes.

**AI opportunity:**
- **Override quality scoring** — score drivers on whether their overrides improve or degrade delivery success
- **Override anomaly detection** — detect drivers who consistently override in patterns that suggest fraud or negligence
- **Driver coaching** — identify specific override types that correlate with improved customer satisfaction

**Training signal:** `allocation_revisions` (driver overrides) + delivery outcomes + customer feedback per order.

---

### Entry Point EP-F1 — Preparation Wave Size Optimization

**Where:** `preparation_waves` + `wave_pick_lists` + `prepared_products_pool`  
**Signal:** Every wave records planned vs. actual preparation quantities, preparation time, and quality status.

**Current (rule-based):** Wave size is configured manually per channel (`wave_size_max` in FulfillmentProfile).

**AI opportunity:**
- **Optimal wave size prediction** — predict the ideal wave size to minimize preparation time and pool wait time based on today's order volume, staff headcount, and available warehouse zones
- **Preparation time estimation** — estimate how long a wave will take given its product mix and quantity
- **Quality failure prediction** — predict which products are most likely to fail QC based on batch history

**Training signal:** `preparation_waves` (planned vs. actual completion time) + `prepared_products_pool` (quality_status per entry) + staffing data.

---

### Entry Point EP-F2 — Shipping Wave Auto-Planning

**Where:** `shipping_waves` + `vehicle_assignments` + `orders`  
**Signal:** Every shipping wave records which orders were grouped together, which vehicles were assigned, utilization percentages, and whether the wave completed on time.

**Current (rule-based):** Wave planner manually assigns orders to vehicles by region.

**AI opportunity:**
- **Auto-wave creation** — automatically group today's orders into optimal waves by region, vehicle capacity, and SLA deadline
- **Vehicle assignment optimization** — recommend which vehicle to assign to each wave sub-group based on capacity and geographic coverage
- **SLA risk prediction** — predict which waves are at risk of missing their SLA deadline based on current loading progress

**Training signal:** Historical waves with vehicle utilization, on-time completion, and order groupings.

---

### Entry Point EP-F3 — Loading Session Anomaly Detection

**Where:** `loading_sessions` + `loading_exceptions`  
**Signal:** Every loading session records start time, completion time, products loaded, required quantities, and any exceptions raised.

**Current (rule-based):** Exceptions are raised reactively when a scan reveals a missing product or wrong quantity.

**AI opportunity:**
- **Pre-loading shortage prediction** — before a loading session opens, predict which products are likely to be missing from the Prepared Products Pool
- **Loading duration estimation** — estimate how long a loading session will take given the vehicle type and product count
- **Exception pattern detection** — detect patterns (same product missing every Monday, same vehicle consistently under-loaded) for proactive intervention

**Training signal:** `loading_sessions` (duration, exception count) + `loading_exceptions` (exception_type, product_id) + pool availability at session start.

---

### Entry Point EP-F4 — Vehicle Capacity Utilization

**Where:** `vehicle_inventory_items` + `vehicles`  
**Signal:** Every loaded vehicle has a complete weight and volume utilization record per trip.

**Current (rule-based):** Capacity is checked reactively during loading — block if overloaded.

**AI opportunity:**
- **Load optimization** — given a set of orders and available vehicles, recommend the optimal distribution to maximize utilization while staying within capacity
- **Vehicle fleet planning** — predict how many vehicles of each type are needed for tomorrow's orders based on demand forecast
- **Refrigerated vehicle demand prediction** — predict demand for refrigerated capacity based on temperature-sensitive product orders

**Training signal:** Historical `vehicle_inventory_items` (total weight, volume per trip) + orders per trip + delivery completion rates.

---

### Entry Point EP-F5 — Route & Delivery Optimization

**Where:** `vehicle_routes` + `delivery_stops`  
**Signal:** Every route records planned vs. actual delivery time per stop, stop sequence, total distance, and completion status.

**Current (rule-based):** Route planning is manual or uses static geographic zones.

**AI opportunity:**
- **Dynamic route optimization** — reorder delivery stops in real time based on traffic, weather, and driver feedback
- **ETA prediction** — predict arrival time at each stop based on current position, remaining stops, and historical travel patterns
- **Failed delivery prediction** — predict which stops are likely to result in failed delivery (customer not home, address issue) based on historical patterns

**Training signal:** `delivery_stops` (planned_arrival vs. actual_arrival, status) + geographic data + time-of-day patterns.

---

### Entry Point EP-F6 — End-of-Shift Reconciliation Variance Prediction

**Where:** `vehicle_shift_reconciliations` + `vehicle_inventory_movements`  
**Signal:** Every reconciliation records whether variance was found, the variance amount per product, and how it was resolved.

**Current (rule-based):** Variance is detected and resolved manually at end of shift.

**AI opportunity:**
- **Variance prediction** — before the shift ends, predict which vehicles are likely to report variance based on their delivery confirmation patterns
- **Write-off risk scoring** — predict which variances are likely to be written off vs. resolved as late delivery confirmations
- **Driver performance scoring** — score drivers on delivery confirmation timeliness and reconciliation accuracy

**Training signal:** `vehicle_shift_reconciliations` (has_variance, variance_resolution) + `vehicle_inventory_movements` (movement timestamps, confirmation gaps).

---

### Entry Point EP-F7 — Fulfillment Profile Performance

**Where:** `fulfillment_profiles` + `fulfillment_stages` + order outcome data  
**Signal:** Every executed fulfillment profile generates a completion time and outcome (delivered, failed, returned) per stage.

**Current:** No per-profile performance measurement.

**AI opportunity:**
- **Profile effectiveness scoring** — score each profile by on-time delivery rate, exception rate, and cost per delivery
- **Stage bottleneck detection** — detect which stage in a profile adds the most delay across all channels
- **Profile configuration suggestions** — suggest profile modifications based on performance data (e.g., "enabling `allow_partial_loading` for Channel X would improve on-time rate by X%")

**Training signal:** Per-order stage completion times + outcome metrics joined to `fulfillment_profiles.id`.

---

### Entry Point EP-F8 — Returns Prediction

**Where:** `returns` + `delivery_stops` + product and customer data  
**Signal:** Returns capture: product, customer, channel, return reason, and whether the inventory was restocked or written off.

**Current:** Returns are reactive — processed after they arrive.

**AI opportunity:**
- **Return probability scoring** — at order creation, score the probability that an order will be returned based on product, customer, and channel history
- **Return reason classification** — automatically classify return reasons from free-text descriptions
- **Restocking feasibility** — predict whether a returned product can be restocked (condition prediction) before it physically arrives

**Training signal:** Historical returns with return_reason + product condition at return + restock outcome.

---

## Fulfillment Training Datasets

---

### DS-G1 · Shipping Company Performance by Zone

**Purpose:** Train shipping company selection optimization and delivery success prediction models.

**Grain:** One row per order delivery, with shipping company, zone, channel, and outcome

**Source tables:**
```
orders                          — order context
delivery_stops                  — actual delivery outcome per stop
shipping_companies              — carrier context
zones                           — geographic context
```

**Key analytical fields:**
```
o.channel_id
ds.vehicle_id → va.shipping_company_id   -- which company served this order
z.id AS zone_id
z.governorate_id
ds.status                                -- delivered | failed
DAYOFWEEK(ds.planned_arrival)            -- day of week
MONTH(ds.planned_arrival)                -- month (seasonal patterns)
ds.actual_arrival IS NOT NULL            -- was it on time?
```

---

### DS-V1 · Vehicle Plan Accuracy

**Purpose:** Train vehicle count pre-estimation and planner override prediction models.

**Grain:** One row per VehiclePlan

**Source tables:**
```
vehicle_plans               — core fact
vehicle_plan_slots          — final distribution
geography_groups            — input context
```

**Key analytical fields:**
```
vp.geography_group_id
vp.shipping_company_id
gg.zone_id
gg.total_order_count
gg.total_weight_kg
gg.total_volume_m3
COUNT(vps.id) AS final_vehicle_count
AVG(vps.utilization_pct) AS avg_utilization
MAX(vps.order_count) - MIN(vps.order_count) AS slot_imbalance
```

---

### DS-A1 · Allocation Decision Outcomes

**Purpose:** Train allocation priority optimization and override quality models.

**Grain:** One row per OrderAllocation with its final delivery outcome

**Source tables:**
```
order_allocations               — allocation decisions
allocation_revisions            — override history
delivery_stops                  — final delivery outcome
orders                          — order context (payment_status, type)
```

**Key analytical fields:**
```
oa.allocation_mode
oa.priority_rank
oa.is_partial
oa.allocated_by                 -- system | dispatcher | driver
COUNT(ar.id) AS override_count
ds.status AS delivery_outcome   -- delivered | failed
o.payment_status
o.order_type
```

---

### DS-F1 · Preparation Wave Performance

**Purpose:** Train preparation time estimation and wave size optimization models.

**Grain:** One row per preparation wave

**Source tables:**
```
preparation_waves           -- core fact
wave_pick_lists             -- pick list completion timing
prepared_products_pool      -- output (quality status, quantity per product)
```

**Key analytical fields:**
```
pw.id
pw.orders_count
pw.products_count
pw.planning_date
pw.approved_at
pw.completed_at
-- derived:
EXTRACT(EPOCH FROM pw.completed_at - pw.approved_at) / 60 AS preparation_minutes
COUNT(ppp.id) FILTER (WHERE ppp.quality_status = 'failed') AS quality_failures
```

---

### DS-F2 · Shipping Wave Efficiency

**Purpose:** Train wave auto-planning and SLA prediction models.

**Grain:** One row per shipping wave

**Source tables:**
```
shipping_waves              -- core fact
vehicle_assignments         -- vehicles assigned
loading_sessions            -- loading timing
orders                      -- orders in wave
```

**Key analytical fields:**
```
sw.id
sw.wave_number
sw.orders_count
sw.vehicles_count
sw.region
sw.sla_deadline
sw.loading_completed_at
-- derived:
sw.sla_deadline > sw.dispatch_at AS met_sla
COUNT(ls.exceptions) AS total_loading_exceptions
AVG(va.utilization_pct) AS avg_vehicle_utilization
```

---

### DS-F3 · Vehicle Trip Analytics

**Purpose:** Train vehicle capacity optimization and driver performance models.

**Grain:** One row per vehicle trip (one wave per vehicle per day)

**Source tables:**
```
vehicle_inventory_items         -- products loaded + delivered
vehicle_inventory_movements     -- movement events
vehicle_shift_reconciliations   -- end-of-shift outcome
vehicles                        -- capacity specs
```

**Key analytical fields:**
```
vii.vehicle_id
vsr.trip_date
SUM(vii.quantity_loaded * p.weight_per_unit) AS total_weight_loaded
v.capacity_weight_kg
SUM(vii.quantity_loaded * p.weight_per_unit) / v.capacity_weight_kg AS weight_utilization_pct
SUM(vii.quantity_delivered) / SUM(vii.quantity_loaded) AS delivery_completion_rate
vsr.has_variance
vsr.variance_resolution
```

---

### DS-F4 · Delivery Stop Performance

**Purpose:** Train route optimization and ETA prediction models.

**Grain:** One row per delivery stop

**Source tables:**
```
delivery_stops              -- core fact
vehicle_routes              -- route context
orders                      -- order context (address, channel)
```

**Key analytical fields:**
```
ds.id
ds.vehicle_id
ds.trip_date
ds.sequence
ds.planned_arrival
ds.actual_arrival
ds.status
-- derived:
EXTRACT(EPOCH FROM ds.actual_arrival - ds.planned_arrival) / 60 AS arrival_delta_minutes
ds.status = 'failed' AS is_failed_delivery
DAYOFWEEK(ds.planned_arrival) AS day_of_week
HOUR(ds.planned_arrival) AS hour_of_day
```

---

### DS-F5 · Loading Session Audit

**Purpose:** Train loading duration estimation and exception prediction models.

**Grain:** One row per loading session

**Source tables:**
```
loading_sessions            -- core fact
loading_exceptions          -- exceptions raised
```

**Key analytical fields:**
```
ls.id
ls.vehicle_id
ls.wave_id
ls.started_at
ls.finished_at
ls.status
COUNT(DISTINCT le.id) AS exception_count
COUNT(DISTINCT le.id) FILTER (WHERE le.severity = 'blocking') AS blocking_exceptions
-- derived:
EXTRACT(EPOCH FROM ls.finished_at - ls.started_at) / 60 AS session_duration_minutes
ls.status = 'closed_with_exceptions' AS had_exceptions
```

---

## Fulfillment AI Readiness Checklist

| Requirement | Status | Notes |
|---|---|---|
| Wave performance data | ✓ DESIGNED | preparation_waves with timing fields |
| Vehicle inventory movements (immutable) | ✓ DESIGNED | VehicleInventoryMovement append-only |
| Delivery stop timing | ✓ DESIGNED | planned vs actual arrival per stop |
| Loading exception catalog | ✓ DESIGNED | 8 exception types with severity |
| End-of-shift reconciliation outcome | ✓ DESIGNED | VehicleShiftReconciliation with variance_resolution |
| Fulfillment profile version history | ✓ DESIGNED | profile versioning on every modification |
| Return reason tracking | ✓ DESIGNED | Returns linked to order + vehicle + loading session |
| SLA tracking per wave | ✓ DESIGNED | sla_deadline vs actual dispatch |
| Vehicle utilization data | ✓ DESIGNED | weight + volume per trip |
| Quality status per pool entry | ✓ DESIGNED | PreparedProductsPool.quality_status |
| Shipping company performance per zone | ✓ DESIGNED | delivery_stops + zone_id + shipping_company_id |
| Vehicle plan accuracy tracking | ✓ DESIGNED | vehicle_plans with final slot distribution |
| Allocation decision chain (immutable) | ✓ DESIGNED | allocation_revisions append-only |
| Driver override tracking | ✓ DESIGNED | allocation_revisions with actor_type = driver |
| Partial fulfillment event catalog | ✓ DESIGNED | partial_fulfillment_events with reason + outcome |
| Geography resolution quality | ✓ DESIGNED | orders.geography_zone_id + resolution status |

**Architecture approved. Implementation deferred pending module development.**
