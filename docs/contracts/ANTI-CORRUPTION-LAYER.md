# Anti-Corruption Layer

**Document:** ANTI-CORRUPTION-LAYER  
**Version:** 1.0  
**Status:** APPROVED — Architecture Only  
**Date:** 2026-07-05  
**Task:** TASK-CONTRACT-ARCH-001  
**Parent:** ENTERPRISE-CONTRACTS.md

---

## 1. What Is an Anti-Corruption Layer?

An Anti-Corruption Layer (ACL) is a boundary that translates between an external system's model and ECOS's internal domain model. Without an ACL, external system concepts contaminate the domain — orders become "WooCommerce orders," products become "Meta catalog items," and every schema change in the external system breaks the domain.

**CON-GOV-003:** Every external system uses an Anti-Corruption Layer. No external system model may appear directly in a domain entity.

---

## 2. ACL Architecture

```
External System
     ↓
┌────────────────────────────────────────────────────────┐
│  ANTI-CORRUPTION LAYER                                 │
│                                                        │
│  Translator:     Converts external model → ECOS model │
│  Validator:      Validates incoming data               │
│  Enricher:       Adds missing data from ECOS context   │
│  Deduplicator:   Prevents duplicate processing         │
│  Error Handler:  Quarantines invalid payloads          │
└────────────────────────────┬───────────────────────────┘
                             ↓
                    ECOS Domain Model
                 (clean, context-agnostic)
```

Every ACL exposes one or more of these operations:
- **translate(externalModel) → domainModel** — inbound
- **serialize(domainModel) → externalModel** — outbound
- **validate(externalModel) → ValidationResult** — before translation

---

## 3. WooCommerce ACL

### Purpose
Translate WooCommerce orders/products to ECOS Orders/Products and push stock/price updates back.

### Inbound: WooCommerce Order → ECOS Order
```
Translator: WooCommerceOrderTranslator
Input:      WooCommerce REST API order object
Output:     Commerce.CreateOrderCommand

Mapping:
  woo.id                    → order.external_reference = "woo:{site_id}:{woo.id}"
  woo.status                → order.status (via WooStatusMap)
  woo.billing.email         → customer lookup by email (CRM query)
  woo.billing.*             → order.delivery_address (AddressVO)
  woo.line_items[]          → order.lines[] (product lookup by SKU)
  woo.line_items[].sku      → inventory.product_id (via SKU lookup)
  woo.line_items[].quantity → line.quantity (QuantityVO)
  woo.line_items[].price    → line.unit_price (MoneyVO, currency from site config)
  woo.shipping_total        → order.shipping_amount
  woo.total                 → order.total_amount (verified against sum of lines)
  woo.date_created          → order.external_created_at

WooStatusMap:
  pending     → draft
  processing  → confirmed
  on-hold     → on_hold
  completed   → delivered
  cancelled   → cancelled
  refunded    → (Finance handles separately)

Deduplication: Check for existing order with external_reference before creating
Enricher:
  - Resolve ECOS customer_id from email (create if not found, per CRM policy)
  - Resolve ECOS product_id from SKU (error if not found)
  - Apply Channel = Channel where woo_site_id matches
  - Apply Warehouse from Channel config
```

### Outbound: ECOS Stock/Price → WooCommerce
```
Translator: WooCommerceProductSerializer
Input:      inventory.raw_material.stock_added or pricing event
Output:     WooCommerce REST API product update

Mapping:
  product.sku                → woo product lookup by sku
  product.available_qty      → woo.stock_quantity
  product.in_stock           → woo.in_stock (true if > 0)
  product.channel_price      → woo.regular_price

Rate limit protection: Batch updates within 60s windows; never push individual item changes
```

### Error Handling
```
Invalid SKU:          Quarantine order to manual review queue; alert
Missing customer:     Create new CRM customer with minimal data; flag for enrichment
Amount mismatch:      Log warning; use ECOS-calculated total
Duplicate order:      Skip; log deduplication event
Schema change:        Catch unexpected fields; log; continue with mapped fields
```

---

## 4. Meta (Facebook/Instagram) ACL

### Purpose
Sync product catalog to Meta Commerce Manager and receive orders from Meta shops.

### Inbound: Meta Order → ECOS Order
```
Translator: MetaOrderTranslator
Input:      Meta Webhook payload (order.created)
Output:     Commerce.CreateOrderCommand

Mapping:
  meta.order_id             → order.external_reference = "meta:{account_id}:{meta.order_id}"
  meta.buyer.email          → customer lookup (same as WooCommerce)
  meta.shipping_address     → order.delivery_address
  meta.items[]              → order.lines[] (lookup by retailer_id = ECOS SKU)
  meta.selected_shipping    → order.shipping_method
  meta.estimated_payment    → order.total_amount

Deduplication: Check external_reference before creating
```

### Outbound: ECOS Catalog → Meta
```
Translator: MetaCatalogSerializer
Output:     Meta Product Catalog Feed (CSV/JSON batch)

Mapping:
  product.sku               → retailer_id
  product.name              → title
  product.channel_price     → price
  product.available_qty     → availability ("in stock" | "out of stock")
  product.image_url         → image_link (via EPS-03 CDN URL)
  product.description       → description

Sync frequency: Hourly batch; real-time for price changes
```

---

## 5. Bosta (Logistics Provider) ACL

### Purpose
Dispatch shipments to Bosta and receive tracking/delivery status updates.

### Outbound: ECOS Shipment → Bosta
```
Translator: BostaShipmentSerializer
Input:      Shipment aggregate + order details
Output:     Bosta POST /deliveries payload

Mapping:
  shipment.id               → business_reference (stored as bosta_reference on Shipment)
  order.delivery_address    → receiver (name, phone, address)
  order.total_amount        → cod_amount (Cash on Delivery, if payment method = cod)
  warehouse.address         → pickup_address
  order.lines               → order_description (item names, count)

Idempotency: Check bosta_reference on Shipment before creating — never double-create
```

### Inbound: Bosta Webhook → ECOS Shipment Status
```
Translator: BostaStatusTranslator
Input:      Bosta webhook event
Output:     Fulfillment command (ConfirmDelivery or FailDelivery)

BostaStatusMap:
  "Delivered"         → ConfirmDelivery (proof_type = bosta_confirmed)
  "Not Available"     → FailDelivery (reason = customer_absent)
  "Refused"           → FailDelivery (reason = refused)
  "In Transit"        → Shipment status update only (no command)
  "Returned"          → FailDelivery + return to warehouse flow
  unknown status      → Log + alert; no command issued

Validation: Verify bosta_reference maps to a known Shipment before translating
```

---

## 6. WhatsApp Business ACL

### Purpose
Send pre-approved WhatsApp templates as a notification delivery channel through EPS-04.

### Outbound: ECOS Notification → WhatsApp Message
```
Translator: WhatsAppMessageSerializer
Input:      EPS-04 NotificationDelivery request
Output:     WhatsApp Business API send_message payload

Mapping:
  notification.recipient    → to (phone number from customer profile)
  notification.type         → template_name (via TemplateRegistry)
  notification.payload      → components (template variable substitution)

TemplateRegistry:
  order_confirmation        → template "order_confirmed" (order_number, total)
  shipment_dispatch         → template "order_dispatched" (order_number, driver_name, eta)
  delivery_confirmation     → template "order_delivered" (order_number)
  invoice_issued            → template "invoice_ready" (invoice_number, amount, due_date)
  otp                       → template "verification_otp" (otp_code)

Phone format: Must be E.164 format (+2010XXXXXXXX for Egypt)
Fallback: SMS if WhatsApp delivery fails
```

---

## 7. Payment Gateway ACL

### Purpose
Process payments via external gateways (Stripe, Paymob, Fawry) and receive payment confirmations.

### Outbound: ECOS Invoice → Gateway Charge
```
Translator: PaymentGatewaySerializer (per gateway)
Input:      Invoice + PaymentMethod + customer payment details
Output:     Gateway-specific charge request

Common mapping:
  invoice.id                → idempotency_key (prevents double-charge)
  invoice.total_amount      → amount + currency
  customer.email            → customer email
  customer.phone            → customer phone

Gateway-specific:
  Stripe:   amount in smallest currency unit (piasters for EGP)
  Paymob:   order object + payment_key flow
  Fawry:    referenceNumber = invoice.id
```

### Inbound: Gateway Webhook → ECOS Payment
```
Translator: PaymentWebhookTranslator (per gateway)
Input:      Gateway webhook event
Output:     Finance.RecordPayment command

Mapping:
  gateway.payment_id        → payment_reference
  gateway.amount            → payment_amount (validated against Invoice)
  gateway.status            → if "succeeded" → RecordPayment; if "failed" → log + alert
  gateway.idempotency_key   → invoice_id (resolves Invoice)

Validation:
  Amount must match Invoice total (or partial payment amount per policy)
  Replay protection: check if payment_reference already recorded
```

---

## 8. Generic Extensible ACL Pattern

For future integrations (marketplace connectors, ERP bridges, courier companies):

```
Every new integration must implement:

1. {Provider}OrderTranslator extends InboundACL
   translate(externalPayload): DomainCommand

2. {Provider}DataSerializer extends OutboundACL
   serialize(domainModel): ExternalPayload

3. {Provider}WebhookValidator
   validate(incomingPayload): boolean

4. {Provider}StatusMap
   mapStatus(externalStatus): EcosStatus

5. Dead-letter handler: quarantineUnmappable(payload, reason)

Naming convention: Modules/Integration/{Provider}/ACL/
```
