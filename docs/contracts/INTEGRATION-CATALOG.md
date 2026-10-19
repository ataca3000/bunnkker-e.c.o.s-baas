# Integration Catalog

**Document:** INTEGRATION-CATALOG  
**Version:** 1.0  
**Status:** APPROVED — Architecture Only  
**Date:** 2026-07-05  
**Task:** TASK-CONTRACT-ARCH-001  
**Parent:** ENTERPRISE-CONTRACTS.md

---

## 1. Purpose

The Integration Catalog is the single source of truth for every integration point in ECOS — both internal (module-to-module) and external (third-party systems). Every contract registered in COMMAND-CONTRACTS.md, QUERY-CONTRACTS.md, EVENT-CONTRACTS.md, and SERVICE-CONTRACTS.md must have an entry here.

**CON-GOV-010:** Every contract must be registered in this catalog before consumers may adopt it.

---

## 2. Internal Integration Map

### 2.1 Event-Driven Integrations (Module Produces → Module Consumes)

| Producer | Event | Consumer | Consumer Action |
|---|---|---|---|
| Commerce | orders.order.confirmed | Inventory | ReserveInventory per line |
| Commerce | orders.order.cancelled | Inventory | ReleaseReservation per line |
| Inventory | inventory.raw_material.stock_reserved | Fulfillment | Wave pre-check passes |
| Fulfillment | fulfillment.preparation_wave.started | Commerce | Orders → in_preparation |
| Fulfillment | fulfillment.preparation_wave.completed | Inventory | ConsumeReservation per item |
| Fulfillment | fulfillment.preparation_wave.completed | Commerce | Orders → ready |
| Fulfillment | fulfillment.prepared_pool.added | Loading OS | Items available for vehicle assignment |
| Fulfillment | fulfillment.shipping_wave.vehicle_assigned | Logistics | Create LoadingSession; Vehicle → assigned |
| Fulfillment | fulfillment.shipping_wave.allocation_completed | Loading OS | Begin physical loading |
| Fulfillment | fulfillment.shipment.dispatched | Commerce | Orders → dispatched |
| Fulfillment | fulfillment.shipment.dispatched | Logistics | Vehicle → in_transit |
| Fulfillment | fulfillment.shipment.delivered | Commerce | ConfirmDelivery → orders.order.delivered |
| Fulfillment | fulfillment.shipment.failed | Commerce | orders.order.delivery_failed |
| Commerce | orders.order.delivered | Finance | CreateInvoice |
| Commerce | orders.order.delivered | CRM | Update lifetime value |
| Finance | finance.invoice.issued | CRM | Update customer balance |
| Finance | finance.invoice.paid | CRM | Update account status |
| Finance | finance.pos_sale.completed | Inventory | Decrement product stock |
| Finance | finance.pos_sale.completed | Commerce | Create + deliver Order |
| Procurement | procurement.goods_receipt.posted | Inventory | PostGoodsReceipt → stock_added |
| Procurement | procurement.goods_receipt.posted | Finance | AP accrual |
| AI Platform | platform.ai.recommendation_generated | EPS-02 | Timeline entry on object |
| AI Platform | platform.ai.recommendation_generated | EPS-04 | Notify user (if policy) |
| EPS-03 | platform.document.attached | EPS-02 | Timeline entry "Document attached" |
| Any module | Any domain event | EPS-02 | Generate timeline entry (auto-mapping) |
| Any module | Any domain event | Audit | Immutable audit record |
| Any module | Any domain event | AI Platform | Subscription for recommendation triggers |

### 2.2 Query Integrations (Module Calls → Module Answers)

| Consumer Module | Query | Source Module | Use Case |
|---|---|---|---|
| Fulfillment | QRY-INV-001 InventoryAvailabilityQuery | Inventory | Wave feasibility check |
| Fulfillment | QRY-INV-003 BulkInventoryAvailabilityQuery | Inventory | Batch wave planning |
| Manufacturing | QRY-INV-001 InventoryAvailabilityQuery | Inventory | Recipe material check |
| Commerce | QRY-CRM-001 CustomerSummaryQuery | CRM | Order drawer customer panel |
| Finance | QRY-COM-002 OrderDetailQuery | Commerce | Invoice line generation |
| Loading OS | QRY-FUL-003 PreparedProductsPoolQuery | Fulfillment | Allocation planning |
| Operations CC | QRY-FUL-001 PreparationDashboardQuery | Fulfillment | Dashboard KPIs |
| Operations CC | QRY-FUL-004 VehicleDashboardQuery | Fulfillment | Fleet status |
| CRM | QRY-COM-001 OrderListQuery | Commerce | Customer order history |
| Any UI | QRY-EPS-001 TimelineQuery | EPS-02 | Detail drawer Timeline tab |
| Any UI | QRY-EPS-002 DocumentListQuery | EPS-03 | Detail drawer Documents tab |
| Any UI | QRY-EPS-003 NotificationInboxQuery | EPS-04 | Notification panel |
| Any module | QRY-AI-001 AIRecommendationsQuery | AI Platform | Drawer AI Insights tab |

---

## 3. External Integration Catalog

### 3.1 WooCommerce (Commerce Channel)
```
Type:           Bidirectional sync
Direction:      ECOS → WooCommerce (products, prices, stock)
                WooCommerce → ECOS (orders, customers)
ACL:            WooCommerceACL (see ANTI-CORRUPTION-LAYER.md)
Authentication: API Key (per store)
Sync Mode:      Pull (scheduled + webhook)
Endpoints consumed:
  - GET /wp-json/wc/v3/orders
  - GET /wp-json/wc/v3/products
  - PUT /wp-json/wc/v3/products/{id} (price/stock push)
  - POST /wp-json/wc/v3/orders/{id}/notes
Webhook events received:
  - order.created, order.updated, order.completed
  - product.updated
Rate limits:    Per-store API key; respect 429 Retry-After
Retry policy:   Exponential backoff, max 5 retries; dead-letter after failure
Data contract:  WooCommerceOrderDTO, WooCommerceProductDTO (ACL translated)
```

### 3.2 Meta (Facebook/Instagram Commerce)
```
Type:           Product catalog sync + order ingestion
Direction:      ECOS → Meta (catalog feed)
                Meta → ECOS (orders via webhook)
ACL:            MetaACL (see ANTI-CORRUPTION-LAYER.md)
Authentication: App access token (per Business account)
Sync Mode:      Push (catalog batch hourly), Pull (orders webhook)
APIs used:
  - Catalog API: batch product upsert
  - Webhooks: orders.created
Rate limits:    10k requests/hour per token
Retry policy:   Exponential backoff, max 3 retries
```

### 3.3 WhatsApp Business (Notifications + CRM)
```
Type:           Outbound messaging channel
Direction:      ECOS → WhatsApp (EPS-04 delivery channel)
ACL:            WhatsAppACL
Authentication: Meta WhatsApp Business API token
Use cases:      Order confirmation, shipment dispatch, delivery OTP, invoice
Message format: Template messages only (pre-approved)
Rate limits:    Per phone number; per 24h window
Failure:        Falls back to SMS; logged as delivery failure
```

### 3.4 Bosta (Logistics / Shipping)
```
Type:           Shipment dispatch + tracking
Direction:      ECOS → Bosta (create shipment)
                Bosta → ECOS (tracking webhooks)
ACL:            BostaACL (see ANTI-CORRUPTION-LAYER.md)
Authentication: API Key
APIs:
  - POST /deliveries (create shipment)
  - GET /deliveries/{id} (status check)
  - Webhook: delivery status updates
Retry:          3 retries with backoff; alert if Bosta unreachable
Idempotency:    bosta_reference stored on Shipment to prevent double-create
```

### 3.5 Payment Gateways
```
Type:           Payment processing
Direction:      ECOS → Gateway (charge)
                Gateway → ECOS (webhook: payment confirmed)
ACL:            PaymentACL
Supported:      Stripe (initial), Paymob, Fawry (Egypt-first)
Authentication: API Key (per gateway, per environment)
APIs:
  - Create payment intent / charge
  - Webhook: payment.succeeded, payment.failed, refund.created
Idempotency:    Idempotency key = Invoice ID (prevent double-charge)
Failure:        Charge failure → Invoice stays in pending_payment state; retry window per PaymentPolicy
```

### 3.6 Egypt Post / Courier Companies (Future)
```
Type:           Label generation + tracking
Status:         Future integration — ACL pattern defined, no active implementation
ACL:            Generic CourierACL (extensible)
Authentication: Varies per courier
```

### 3.7 ERP Connectors (Future)
```
Type:           Bidirectional data sync (accounting, HR, payroll)
Status:         Architecture reserved — no active integration
ACL:            ERPConnectorACL pattern
Note:           Finance module is designed to be the source of truth for all financial data;
                external ERP sync is export-only
```

---

## 4. Consumer Registry

This section tracks every registered consumer per contract. Updated before sunset decisions.

### Command Consumers

| Command | Version | Registered Consumers |
|---|---|---|
| ReserveInventory | v1 | Commerce (auto-triggered on order.confirmed) |
| ReleaseReservation | v1 | Commerce (auto-triggered on order.cancelled) |
| StartPreparation | v1 | Preparation OS UI, AI suggestion engine |
| CompletePreparation | v1 | Preparation OS UI |
| AssignVehicle | v1 | Loading OS UI, Vehicle Planning Engine |
| AllocateProducts | v1 | Loading OS (Product Allocation Engine) |
| DispatchShipment | v1 | Loading OS UI |
| CreateInvoice | v1 | Finance (auto-triggered on order.delivered) |
| RecordPayment | v1 | Finance UI, Payment Gateway webhook handler |

### Event Consumers

| Event | Version | Registered Consumers |
|---|---|---|
| orders.order.confirmed | v1 | Inventory, EPS-02, EPS-04 |
| orders.order.cancelled | v1 | Inventory, EPS-02, EPS-04 |
| orders.order.delivered | v1 | Finance, CRM, EPS-02, EPS-04 |
| inventory.raw_material.stock_added | v1 | Finance, EPS-02, EPS-04 |
| fulfillment.preparation_wave.completed | v1 | Inventory, Commerce, EPS-04 |
| fulfillment.shipment.dispatched | v1 | Commerce, Logistics, EPS-04 |
| finance.invoice.issued | v1 | CRM, EPS-04 |
| platform.ai.recommendation_generated | v1 | EPS-02, EPS-04 |

---

## 5. Integration Health

Each active external integration must have:

| Requirement | Description |
|---|---|
| **Health check endpoint** | A lightweight ping that verifies the integration is reachable |
| **Circuit breaker** | If health check fails N times, stop attempting + alert |
| **Dead-letter queue** | Failed messages that exhausted retries are queued for manual review |
| **Monitoring dashboard** | Integration success rate, latency, error rate tracked per integration |
| **Runbook** | Step-by-step recovery procedure per integration in the ops runbook |
