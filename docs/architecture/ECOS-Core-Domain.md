# ECOS Core Domain Architecture

**Status:** Final Approved (Domain Sprint 04)
**Type:** Highest-level business architecture reference

> Nothing in ECOS ERP should contradict this document.

---

## 1. ECOS Philosophy

ECOS is NOT a traditional ERP.

**ECOS is an Enterprise Commerce Operating System.**

Traditional ERP is organized around:
- Accounting
- Inventory
- CRUD data management

ECOS is organized around:
- **Daily operations**
- **Order fulfillment speed**
- **Customer experience**

Every module, every screen, and every decision in ECOS must serve operational efficiency.

---

## 2. Core Layers

```
┌─────────────────────────────────────────────────┐
│  LAYER 5 — Intelligence                         │
│  Analytics · KPIs · Forecasting · AI           │
├─────────────────────────────────────────────────┤
│  LAYER 4 — Finance                              │
│  Purchasing · Payments · Accounting · Reports  │
├─────────────────────────────────────────────────┤
│  LAYER 3 — Execution                            │
│  Inventory · Manufacturing · Warehouse          │
│  Packing · Loading · Shipping · Returns         │
├─────────────────────────────────────────────────┤
│  LAYER 2 — Operations Planning                  │
│  Planning · Fulfillment Batches                 │
│  MRP · PRP · Vehicle Planning · Dispatch        │
├─────────────────────────────────────────────────┤
│  LAYER 1 — Commerce                             │
│  Customers · Products · Orders · Channels       │
│  Marketing                                      │
└─────────────────────────────────────────────────┘
```

### Layer Interaction Rules

- **Commerce** generates demand (orders)
- **Operations Planning** converts demand into execution plans
- **Execution** performs the physical work
- **Finance** records the financial impact
- **Intelligence** analyzes results and generates insights

Layers must not skip each other. Orders flow through Planning before reaching Execution.

---

## 3. Core Business Entities

| Entity | Layer | Description |
|--------|-------|-------------|
| Customer | Commerce | Person who purchases |
| Order | Commerce | Purchase commitment from a customer |
| Product | Commerce | Item sold through channels |
| Channel | Commerce | Commerce integration point |
| Fulfillment Batch | Operations | Grouped orders for warehouse execution |
| Inventory | Execution | Stock availability service |
| Manufacturing Job | Execution | Production work order |
| Vehicle | Execution | Delivery transport unit |
| Warehouse | Execution | Physical storage and dispatch location |
| Activity | Cross-cutting | Unified event record for all entities |

---

## 4. Official Principles

### Commerce Principles

| # | Principle |
|---|-----------|
| C-01 | Customer is an independent entity — not derived from orders |
| C-02 | Orders are immutable snapshots of a point-in-time agreement |
| C-03 | Customer updates never modify previous orders |
| C-04 | Two customers may share a name — phone number is the unique identity |
| C-05 | Phone number is never automatically merged |

### Operations Principles

| # | Principle |
|---|-----------|
| O-01 | Warehouse teams execute Fulfillment Batches, not individual orders |
| O-02 | Customer Service executes orders (not the warehouse) |
| O-03 | Planning happens once; execution happens many times |
| O-04 | Wave Picking precedes packing and distribution |
| O-05 | Channel Dispatch Profiles govern post-picking distribution |

### Inventory Principles

| # | Principle |
|---|-----------|
| I-01 | Inventory is a shared operational service — not the center of the system |
| I-02 | Inventory does not control operations; Operations Planning does |
| I-03 | Inventory services: Availability, Reservation, Issue, Receive, Transfer, Adjust |
| I-04 | Stock Ledger is the single source of truth for all inventory movements |
| I-05 | Inventory events are domain events (versioned, correlatable) |

### System Principles

| # | Principle |
|---|-----------|
| S-01 | Everything generates Activity |
| S-02 | Everything has History |
| S-03 | Everything is auditable |
| S-04 | Human First — operators, not algorithms, make business decisions |
| S-05 | Operations First — every UI element must serve operational efficiency |
| S-06 | Business First — domain accuracy over technical elegance |
| S-07 | Events First — domain events connect bounded contexts |

---

## 5. Daily Operations Philosophy

```
Customer creates demand
    ↓
Orders represent commitments
    ↓
Operations Planning converts commitments into execution plans
    ↓
Execution teams perform the physical work
    ↓
Finance records the financial impact
    ↓
Intelligence analyzes the results
```

This is the operational heartbeat of ECOS. Every feature should serve one of these steps.

---

## 6. Operational Flow (Complete)

```
Customer (phone call / website / marketplace)
    ↓
Order created (via Channel sync or manual CS entry)
    ↓
Order confirmed (CS team)
    ↓
Operations Planning session
    ├── Material Requirements Planning
    ├── Production Requirements Planning
    └── Vehicle Planning
    ↓
Fulfillment Batch created
    ↓
Manufacturing Jobs executed (if needed)
    ↓
Wave Picking (warehouse collects all products)
    ↓
Channel Distribution (dispatch profiles applied)
    ↓
Vehicle Loading (products → vehicles)
    ↓
Shipping (vehicles dispatched)
    ↓
Delivery (confirmed by driver or customer)
    ↓
Order Completed
    ↓
Finance: Invoice + Revenue Recognition
    ↓
Intelligence: Analytics + Forecasting Update
```

---

## 7. Inventory Philosophy

Inventory is a **service layer** — not the operational center.

Inventory responds to requests from other layers:

| Request | From | Response |
|---------|------|----------|
| Check Availability | Commerce / Planning | Available / Shortage |
| Reserve Stock | Planning | Reservation confirmed |
| Issue Stock | Execution | Stock deducted |
| Receive Stock | Purchasing | Stock added |
| Transfer Stock | Warehouse | Stock moved |
| Adjust Stock | Cycle Count | Stock corrected |

Operations Planning does not manage inventory. It queries inventory availability, then requests operations (reserve, issue) from the inventory service.

---

## 8. Fulfillment Philosophy

Orders are never executed individually by warehouse teams.

```
Individual Orders
    ↓
Grouped into Fulfillment Batch
    ↓
Batch executed as single warehouse operation
    ↓
Wave Pick List (consolidated product quantities)
    ↓
Dispatch by Channel (each channel's dispatch profile)
    ↓
Vehicle assignment
```

### Dispatch Profile Extension

Each channel defines how orders are fulfilled:
- `bulk_distribution` — products loaded by quantity, no packing
- `pack_during_loading` — pack at vehicle handover
- `pre_packed` — pack in warehouse before vehicle arrives

New profiles can be added without changing the planning engine. This is an extension point.

---

## 9. Workspace Philosophy

> Every operational area is a Workspace.
> Never design CRUD pages.
> Every Workspace must help users complete operational tasks with minimum clicks.

### Workspace Principles

1. **Operations First** — every element must serve daily operations
2. **Status First** — primary navigation via status tabs
3. **Table First** — primary view is always a dense data table
4. **Drawer for Detail** — detail in a side drawer, not a new page
5. **Zero Extra Requests** — derive data from what's already fetched
6. **Context-Aware** — toolbar and actions adapt to the current context

---

## 10. Domain Diagram

```
                    ┌──────────────┐
                    │  Intelligence │
                    └──────┬───────┘
                           │ analyzes
                    ┌──────┴───────┐
                    │    Finance   │
                    └──────┬───────┘
                           │ records
         ┌─────────────────┴───────────────────┐
         │            Execution                │
         │  Inventory · Manufacturing          │
         │  Warehouse · Shipping · Returns     │
         └─────────────────┬───────────────────┘
                           │ executes
         ┌─────────────────┴───────────────────┐
         │         Operations Planning         │
         │  Batches · MRP · PRP · Vehicles     │
         └─────────────────┬───────────────────┘
                           │ plans
         ┌─────────────────┴───────────────────┐
         │             Commerce                │
         │  Customers · Orders · Products      │
         │  Channels · Marketing               │
         └─────────────────────────────────────┘
                           ↑
                      Customer demand
```

---

## 11. Future Extension Points

| Area | Extension |
|------|-----------|
| New Channel Types | New channel type config without changing core |
| New Dispatch Profiles | New dispatch profile without changing planning engine |
| New Activity Event Types | New event type without changing timeline UI |
| New Inventory Operations | New operation type without changing ledger |
| Intelligence Modules | Add AI models without changing domain layer |
| New Commerce Entities | Add Gift Cards, Subscriptions, Bundles as extensions |
