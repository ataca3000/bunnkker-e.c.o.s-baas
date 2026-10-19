# ECOS POS v1.0 — Architecture Summary

**Version:** 1.0.0  
**Date:** 2026-07-01  
**Status:** Production

> This is a summary document. Detailed specifications are in the ADR files listed in the ADR Index below.

---

## Overview

ECOS POS is a Domain-Driven Design module within the ECOS ERP monorepo. It follows the same bounded-context structure as all other ECOS modules: isolated domain models, repository interfaces, application services, and a REST API layer. It shares the platform infrastructure (PostgreSQL, Redis, Laravel Sanctum auth, Vite/React frontend) but has no hard foreign-key dependencies on other modules.

---

## Bounded Contexts

The POS module is divided into eight internal sub-contexts:

| Sub-Context | Primary Aggregate / Model | Responsibility |
|-------------|--------------------------|----------------|
| **Session** | `Session` | Terminal operational period |
| **Shift** | `Shift` | Cashier working period + cash reconciliation |
| **Cart** | `Cart` (aggregate root) | Active transaction: lines, totals, state machine |
| **Sale** | `Sale` | Completed transaction record |
| **Receipt** | `Receipt` | Immutable receipt archive |
| **Return** | `SaleReturn` | Return + refund workflow |
| **Exchange** | `Exchange` | Exchange workflow |
| **Payment** | `Payment` | Payment capture and audit |

Each sub-context lives under `backend/Modules/POS/{SubContext}/`.

---

## Domain Model

### Cart (Aggregate Root)

The `Cart` is the central aggregate. State machine:

```
Active ──addLine/removeLine──▶ Active
Active ──hold()──────────────▶ Held ──resume()──▶ Active
Held   ──expire()────────────▶ Expired   (terminal)
Active ──initiatePayment()───▶ Paying
Paying ──cancelPayment()─────▶ Active   (ADR-POS-010)
Paying ──complete()──────────▶ Completed (terminal)
Active ──cancel()────────────▶ Cancelled (terminal)
```

**Invariants:**
- Only one cart per session can be in `paying` status (enforced via partial unique index)
- All monetary values use the `Money` value object (BCMath, 2dp scale, immutable)
- Currency is fixed at cart creation and validated on every line addition
- Lines are stored as JSONB; calculated totals are stored as JSONB

### Money Value Object

`Money` is `final readonly` with BCMath arithmetic:
- Properties: `string $amount`, `string $currency`
- Methods: `add`, `subtract`, `multiply`, `divide`, `allocate`, `isZero`, `isPositive`, `isNegative`
- All currency mismatches throw `InvalidMoneyOperationException`

### Receipt (Immutable)

Receipts are write-once. They capture a snapshot of the transaction at issuance time. Receipt numbers are generated per terminal per day (`TERM-YYYYMMDD-NNNNN`) using a `ReceiptNumberingStrategyInterface`.

---

## Event Flow

The POS module follows an event-driven pattern. Domain events are collected on aggregates and published AFTER the database transaction commits.

### Key Events

| Event | Trigger |
|-------|---------|
| `CartOpened` | New cart created |
| `CartLineAdded` | Product added to cart |
| `CartLineRemoved` | Product removed from cart |
| `CartHeld` | Cart placed on hold |
| `CartResumed` | Held cart resumed |
| `CartCompleted` | Sale completed |
| `CartCancelled` | Cart cancelled |
| `CartExpired` | Held cart expired |
| `SaleCompleted` | Sale processed |
| `ReturnProcessed` | Return completed |
| `ExchangeProcessed` | Exchange completed |
| `LoyaltyPointsAccrued` | Points earned on sale |

Events are published via `DomainEventPublisherInterface`. Listeners can dispatch to the queue or handle synchronously.

---

## Application Layer

The application layer follows the Command/Service/Result pattern:

```
Controller → FormRequest (validates) → Command (DTO) → Service (orchestrates) → Result (DTO)
```

Key services:

| Service | Responsibility |
|---------|---------------|
| `OpenCartService` | Creates new Cart aggregate |
| `AddCartLineService` | Adds a line to an active cart |
| `SetCartCustomerService` | Binds a customer to a cart |
| `HoldCartService` | Transitions cart to Held |
| `ResumeCartService` | Transitions Held cart to Active |
| `ProcessSaleService` | Atomically captures payment, records sale, completes cart, issues receipt |
| `ProcessReturnService` | Atomically records return, updates sale status, issues return receipt |
| `ProcessExchangeService` | Atomically records exchange, issues exchange receipt |
| `OpenShiftService` | Opens a shift and records opening cash |
| `CloseShiftService` | Submits closing cash count |
| `ApproveShiftService` | Manager approves shift count |

All state-changing services that involve multiple aggregates use `DB::transaction()`.

---

## API Layer

**Base path:** `/api/pos`  
**Authentication:** All endpoints require `auth:sanctum`  
**Format:** JSON with `HasApiResponse` trait (consistent envelope)

### Endpoints Summary

```
POST   /pos/sessions              Open session
GET    /pos/sessions/{id}         Get session
DELETE /pos/sessions/{id}         Close session

POST   /pos/shifts                Open shift
GET    /pos/shifts/{id}           Get shift
DELETE /pos/shifts/{id}           Submit closing count
PUT    /pos/shifts/{id}/approve   Approve shift (manager)
PUT    /pos/shifts/{id}/reject    Reject shift (manager)

POST   /pos/carts                 Open cart
GET    /pos/carts/{id}            Get cart
POST   /pos/carts/{id}/hold       Hold cart
DELETE /pos/carts/{id}/hold       Resume cart
PUT    /pos/carts/{id}/customer   Set/clear customer
DELETE /pos/carts/{id}            Cancel cart

POST   /pos/carts/{id}/lines      Add cart line
DELETE /pos/carts/{id}/lines/{l}  Remove cart line

POST   /pos/sales                 Process sale
GET    /pos/sales/{id}            Get sale

POST   /pos/returns               Process return
POST   /pos/exchanges             Process exchange

GET    /pos/receipts/{id}         Get receipt
POST   /pos/receipts/{id}/reprint Reprint receipt
DELETE /pos/receipts/{id}         Void receipt
```

---

## Frontend

**Framework:** React 19 + TypeScript  
**Build:** Vite  
**State:** Zustand (persisted) + TanStack Query v5 (server state)  
**Routing:** Part of the ECOS SPA — `/pos` route

### Architecture

```
pos-page.tsx (gate: session/shift required)
  └── PosErrorBoundary
      └── PosWorkspace (mode orchestrator)
          ├── PosHeader (mode switcher, session status)
          ├── CustomerPanel (search, bind)
          ├── ProductGrid → ProductSearch + ProductCard
          ├── CartPanel → CartLineRow (keyboard nav)
          ├── PaymentPanel (tender, confirm)
          ├── ReceiptPanel (display, reprint)
          ├── ReturnPanel (lookup, lines, validate)
          ├── ExchangePanel (lookup, returned, replacement)
          ├── HeldCartsPanel (list, resume, delete)
          ├── ManagerPanel (session/shift management)
          └── KeyboardHelp (shortcut overlay)
```

### State Management

**Zustand store (`ecos_pos_context`)** — persists terminal identity and cart reference to localStorage.  
**TanStack Query** — manages all server state with `posKeys` factory for consistent cache invalidation.

Key cache decisions:
- Cart: `staleTime: 0` — always refetched on access
- Catalog: `staleTime: 60s` — product catalog is relatively stable
- Receipt/Sale: `staleTime: 60s` — immutable once created

### Barcode Integration

`useBarcodeScanner` registers one global `keydown` listener. It distinguishes scanner input (rapid inter-key < 100ms) from manual typing. On Enter, fires `onScan(barcode)`. Concurrent scans are serialized via `isScanningRef`.

---

## Security

| Layer | Control |
|-------|---------|
| Authentication | Laravel Sanctum token auth on all API routes |
| CSRF | Not applicable (token auth, not cookie sessions) |
| SQL Injection | Eloquent ORM, no raw queries in POS module |
| XSS | React JSX escapes all string renders; no `dangerouslySetInnerHTML` |
| UUID IDs | Non-guessable v4 UUIDs for all entity references |
| HTTPS | Required in production (Nginx TLS) |
| Role Authorization | Currently: any authenticated user; RBAC planned for v1.1 |

---

## Integrations

| Integration | Direction | Status |
|-------------|-----------|--------|
| IAM (auth) | Inbound (token validation) | Active |
| Product Catalog | Inbound (`/api/products`) | Active |
| Customer/CRM | Inbound (`/api/customers`) | Active |
| Loyalty | Outbound (domain events → listener) | Wired, backend ready |
| Inventory | Outbound (planned deduction on sale completion) | Planned v1.1 |
| HAL Agent (hardware) | Outbound (WebSocket) | Planned v1.1 |
| Offline Sync | Local queuing | Planned v1.1 |

---

## ADR Index

All architectural decisions for the POS module are documented in `docs/architecture/pos/`:

| ADR | Title |
|-----|-------|
| ADR-POS-001 | PostgreSQL as the exclusive database (JSONB, partial indexes) |
| ADR-POS-002 | Frontend: Vite + React 19 |
| ADR-POS-003 | HAL deployment architecture |
| ADR-POS-004 | Store credit ownership model |
| ADR-POS-005 | Held cart expiry policy |
| ADR-POS-006 | Shift rejection workflow |
| ADR-POS-007 | Exchange atomicity guarantee |
| ADR-POS-008 | Session recovery strategy |
| ADR-POS-009 | Missing vision document policy |
| ADR-POS-010 | Cart state machine (including Paying → Active back-transition) |
| ADR-POS-011 | Session + shift concurrency model |
| ADR-POS-012 | Session close / shift guard |
