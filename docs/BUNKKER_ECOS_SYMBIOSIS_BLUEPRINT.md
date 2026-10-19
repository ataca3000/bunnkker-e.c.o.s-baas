# BUNKKER × ECOS ERP — Master Architecture Symbiosis Blueprint
> **Version:** 2.0.0-ENTERPRISE-SYMBIOSIS  
> **Status:** Active & Enforced  
> **Classification:** Sovereign Enterprise Commerce Operating System (E.C.O.S.)

---

## 1. Executive Summary & Vision

This blueprint establishes the **total architectural symbiosis** between **BUNKKER** (the high-performance, local-first retail/wholesale POS, offline SQLite, Mexican SAT CFDI fiscal engine, and multi-role web platform) and **ECOS Enterprise** (the Domain-Driven Design / Clean Architecture specification developed by Osama Fayez & Claude, featuring formal Preparation OS, Loading OS, POS Cashier Blueprints, 41 ADRs, and Engineering Guardians).

By unifying these two paradigms:
1. **Zero Data or Functional Loss:** Every single manual, technical blueprint, architecture decision record (ADR), domain module, and function has been ingested into the repository under clean, well-delimited boundaries.
2. **Local Sovereignty + Enterprise Rigor:** BUNKKER's millisecond-grade SQLite local-first engine and Windows thermal printer bridge now operate under the strict bounded contexts, state machines, and mathematical guarantees of the ECOS Enterprise specifications.

---

## 2. Architectural Bounded Contexts & File Mapping

```
bunnkker-e.c.o.s-baas/
├── docs/                                  # Unified Enterprise Blueprint & Technical Manuals
│   ├── adr/                               # 41 Formal Architecture Decision Records (ADR-006 to ADR-041)
│   ├── preparation-os/                    # Preparation OS Blueprint (Waves, Picking Lists, MRP)
│   ├── loading-os/                        # Loading OS Blueprint (Vehicle bays, Dispatch, Manifests)
│   ├── pos/                               # POS OS Blueprint (Blind balancing, shifts, split payments)
│   ├── inventory/                         # Multi-location inventory, stock ledger & reservations
│   ├── logistics/ & logistics-v2/         # Routing, dispatch pools, driver handover protocols
│   ├── organization-os/                   # Enterprise multi-tenant structure, branches, roles
│   ├── claude-bridge/ & aiop/             # AI Operator & LLM conversational interface protocol
│   ├── engineering/ & verification/       # Architecture baselines, test plans, and release criteria
│   └── BUNKKER_ECOS_SYMBIOSIS_BLUEPRINT.md# This Master Symbiosis Document
│
├── engineering/                           # Automated Guardians & Engineering Enforcement
│   ├── architecture-guardian/             # Scanners for boundaries, namespaces, and duplicates
│   ├── quality-guardian/                  # Ratchet-based quality gates, linters, and pre-commit hooks
│   ├── deployment-guardian/               # Compose, SSL, environment, and health check validators
│   └── baselines/                         # Recorded architectural baselines and metric suppressions
│
├── ecos-core/                             # Preserved Enterprise DDD Codebase (Zero-loss repository)
│   ├── backend/Modules/                   # 23 Enterprise DDD Bounded Contexts (PHP/Laravel core)
│   │   ├── Admin, Commerce, Core, CostManagement, Crm, CustomerEngagement, Finance, Hr, IAM,
│   │   ├── Inventory, Logistics, Manufacturing, Marketing, MasterData, Operations, Organization,
│   │   └── Platform, POS, Purchasing, Sales, System, ClaudeBridge, Common
│   ├── frontend/src/features/             # 53 Enterprise Frontend Feature Packages
│   │   ├── boms, receiving-center, stock-transfers, conversational-commerce, stock-ledger, etc.
│   │   └── providers, router, services, store, types, utils
│   ├── docker/                            # Production & staging container orchestration
│   ├── worker/                            # Asynchronous background job worker configurations
│   └── scripts/                           # Database migration and environment seeding utilities
│
├── tasks/                                 # Enterprise Sprint & Feature Cards (COM-008A/B/C, SPRINT_000)
│
├── src/                                   # Live BUNKKER Next.js / TypeScript / React Sovereign Engine
│   ├── app/                               # Next.js App Router (POS, Inventory, Delivery, SuperAdmin)
│   │   ├── api/orders/route.ts            # Atomic Order State Machine & Conflict Prevention
│   │   ├── dashboard/inventory/page.tsx   # Preparation OS UI (Atomic claim, picking, 1a1 verify)
│   │   ├── dashboard/sales/page.tsx       # POS OS UI (Cashier queue, blind balancing, tickets)
│   │   ├── dashboard/delivery/page.tsx    # Loading OS UI (Driver dispatch, vehicle handovers)
│   │   └── cuenta/page.tsx                # Customer Omnichannel Order Tracking & Audit Trail
│   ├── components/pos/                    # POS Ergonomics, Thermal Printer, Split Tender UI
│   ├── lib/                               # Sovereign Engine Core
│   │   ├── sqlite-service.ts              # Local-first SQLite with fail-closed Mutex concurrency
│   │   ├── thermal_printer.ts             # ESC/POS direct binary generator (USB/LAN/Serial)
│   │   ├── topic_mapper.ts & classifier.ts# Local unsupervised natural language classifier
│   │   └── audit.ts                       # Immutable Append-Only OrderEvent and AuditLog
│   └── __tests__/                         # Senior-grade Vitest Automated Verification Suite (106 tests)
│
└── .agents/                               # Antigravity Persistent Memory & Engineering Axioms
    ├── manifesto/                         # Core engineering axioms & system boundaries
    ├── logs/decisions/                    # ADRs and system architectural changes
    └── learning/                          # Validated algorithms, confidence metrics, and rewards
```

---

## 3. Operational Lifecycles & State Symbiosis

### A. Preparation OS $\iff$ Live Warehouse Picking
- **Manual Reference:** `docs/preparation-os/PREPARATION-OS-BLUEPRINT.md`
- **Live Implementation:** `src/app/dashboard/inventory/page.tsx` & `src/components/pos/OrderPickingAssistant.tsx`
- **Rule:** When an order is created with `STORE_PICKUP` or `COUNTER_PICKUP`, it enters the unassigned pool. An inventory operator claims it atomically (`claim_order`). The operator verifies items 1-by-1 (`OrderPickingAssistant`). Once fully verified, the order moves to `READY_FOR_PICKUP_UNPAID` (or `PREPARED_PENDING_LOADING`).
- **Physical Barrier:** Inventory staff can never bypass directly to customer handover.

### B. POS OS $\iff$ Live Cashier Desk & Fiscal Tickets
- **Manual Reference:** `docs/pos/BLUEPRINT.md` & `docs/pos/CASHIER-USER-GUIDE.md`
- **Live Implementation:** `src/app/dashboard/sales/page.tsx`, `src/components/pos/PaymentModal.tsx`, `src/lib/thermal_printer.ts`
- **Rule:** Delivery orders are strictly isolated from the cashier counter queue. The cashier only collects payment for store/patio pickup orders or counter sales. Upon receiving payment, the order transitions to `READY_FOR_PICKUP_PAID` (or `PAID`), generating an immutable fiscal receipt.

### C. Loading OS $\iff$ Live Delivery & Patio Dispatch
- **Manual Reference:** `docs/loading-os/BLUEPRINT.md` & `docs/logistics-v2/`
- **Live Implementation:** `src/app/dashboard/delivery/page.tsx` & `src/components/DeliveryDashboardWorker.tsx`
- **Rule:** Physical release of goods at loading bays or patios requires presentation of the verified cashier receipt (`confirm_pickup_receipt`). Delivery orders (`DELIVERY`) belong strictly to the driver dispatch pool, where drivers manage routing and direct customer delivery.

### D. Inventory Mutex & Cancellation Restock
- **Manual Reference:** `docs/inventory/` & `docs/adr/ADR-027-reservation-ownership-policy.md`
- **Live Implementation:** `src/app/api/orders/route.ts` & `src/lib/sqlite-service.ts`
- **Rule:** Cancellations trigger immediate stock release:
  - If the order was only claimed/pending: `reservedStock = max(0, reservedStock - qty)`.
  - If the order was fully finalized/delivered: `stock = stock + qty`.
  - Every transition writes an immutable `OrderEvent` and `AuditLog`.

---

## 4. Engineering Guardian & Ratchet Policy

Following the **"Ratchet, never cliff"** principle defined in `engineering/quality-guardian/README.md`:
- **TypeScript:** Strict type checking (`tsc --noEmit`) must compile with **0 errors**.
- **ESLint:** Codebase must pass with **0 errors**.
- **Vitest:** Automated test suite (concurrency races, state machines, printer drivers, classification) must maintain **100% pass rate** (106/106 tests).
- **Build Guard:** `npm run guard:build` runs pre-flight compilation checks before any release is allowed to package or deploy.

---

## 5. Summary of Integration Deliverables

| Asset | Location in bunnkker-e.c.o.s-baas | Purpose |
|---|---|---|
| **41 Enterprise ADRs** | `docs/adr/` | Theoretical & architectural rationale for all enterprise workflows |
| **Preparation OS Blueprint** | `docs/preparation-os/` | Picking waves, MRP, and item verification protocols |
| **Loading OS Blueprint** | `docs/loading-os/` | Dispatch, bay allocation, and logistics buffer |
| **POS Blueprints & Guides** | `docs/pos/` | Cashier shift management, drawer audits, split payments |
| **23 DDD Enterprise Modules** | `ecos-core/backend/Modules/` | Reference enterprise models for deep scaling |
| **53 Feature Packages** | `ecos-core/frontend/src/features/` | Comprehensive UI/UX domain logic and contracts |
| **Architecture & Quality Guardians** | `engineering/` | Automated scanners and ratchet baseline tracking |
| **Active Live Runtime** | `src/` | High-speed Next.js / TypeScript / SQLite sovereign application |
