# CR-PREP-001 — API Contracts

## Base URL

`/api/v1/operations/preparation`

---

## Warehouse Assignment Policies

### GET /warehouse-assignment-policies

List all policies for the authenticated company.

**Query params:** `warehouse_id`, `channel_id`, `is_active`, `per_page`

**Response 200:**
```json
{
  "data": [
    {
      "id": "uuid",
      "channel_id": "uuid|null",
      "channel_name": "string|null",
      "governorate": "string|null",
      "zone": "string|null",
      "warehouse_id": "uuid",
      "warehouse_name": "string",
      "priority": 100,
      "is_active": true,
      "notes": "string|null",
      "specificity": 3
    }
  ],
  "meta": { "page": 1, "per_page": 25, "total": 12, "last_page": 1 }
}
```

### POST /warehouse-assignment-policies

Create a new assignment policy.

**Body:**
```json
{
  "channel_id": "uuid|null",
  "governorate": "string|null",
  "zone": "string|null",
  "warehouse_id": "uuid",
  "priority": 100,
  "notes": "string|null"
}
```

**Response 201:** Created policy object.

### PUT /warehouse-assignment-policies/{id}

Update a policy. Only the calling company's policies may be updated.

### DELETE /warehouse-assignment-policies/{id}

Soft-delete (set `is_active = false`). Returns 204.

---

## Warehouse Assignment (Orders)

### POST /orders/{orderId}/assign-warehouse

Trigger policy evaluation for a single order (re-runs the engine).

**Response 200:**
```json
{
  "order_id": "uuid",
  "warehouse_id": "uuid",
  "warehouse_name": "string",
  "source": "auto_policy",
  "policy_id": "uuid|null",
  "assigned_at": "ISO-8601"
}
```

### POST /orders/{orderId}/override-warehouse

Supervisor manual override.

**Body:**
```json
{
  "warehouse_id": "uuid",
  "reason": "string (required, max 500)"
}
```

**Authorization:** `supervisor` or `operations_manager` role required.

**Response 200:** Same shape as assign-warehouse response, with `"source": "manual_override"`.

### GET /orders/{orderId}/assignment-history

Returns the list of `WarehouseAssignmentOverride` records for this order.

**Response 200:**
```json
{
  "data": [
    {
      "id": "uuid",
      "previous_warehouse_id": "uuid|null",
      "previous_warehouse_name": "string|null",
      "new_warehouse_id": "uuid",
      "new_warehouse_name": "string",
      "reason": "string",
      "overridden_by_name": "string",
      "overridden_at": "ISO-8601"
    }
  ]
}
```

---

## Preparation Session Policies

### GET /preparation-session-policies

Returns active policies for the company.

**Response 200:**
```json
{
  "data": [
    {
      "id": "uuid",
      "warehouse_id": "uuid|null",
      "warehouse_name": "string|null",
      "auto_create_time": "06:00:00",
      "auto_close_time": "23:59:00|null",
      "eligible_order_statuses": ["confirm_order", "in_progress"],
      "auto_attach_orders": true,
      "auto_recalculate_demand": true,
      "is_active": true
    }
  ]
}
```

### POST /preparation-session-policies

Create or update a policy. UPSERT on (company_id, warehouse_id).

---

## Daily Sessions

### GET /sessions/today

Returns today's sessions for all company warehouses.

**Response 200:**
```json
{
  "data": [
    {
      "id": "uuid",
      "session_number": "PS-20260706-0001",
      "warehouse_id": "uuid",
      "warehouse_name": "Cairo Warehouse",
      "planning_date": "2026-07-06",
      "status": "active",
      "auto_created": true,
      "orders_count": 47,
      "products_count": 23,
      "prepared_percent": 64,
      "created_at": "ISO-8601"
    }
  ]
}
```

### GET /sessions/{sessionId}/orders

Orders attached to a session.

**Query params:** `attachment_source`, `detached` (boolean), `per_page`

**Response 200:**
```json
{
  "data": [
    {
      "id": "uuid",
      "order_id": "uuid",
      "order_number": "ORD-00123",
      "customer_name": "Ahmed Ali",
      "governorate": "Cairo",
      "area": "Nasr City",
      "attachment_source": "auto",
      "attached_at": "ISO-8601",
      "is_active": true
    }
  ],
  "meta": { "page": 1, "per_page": 50, "total": 47, "last_page": 1 }
}
```

### POST /sessions/{sessionId}/attach-order

Manually attach a specific order (supervisor action).

**Body:** `{ "order_id": "uuid" }`

### DELETE /sessions/{sessionId}/orders/{sessionOrderId}

Detach an order from the session.

**Body:** `{ "reason": "string" }`

**Response 204.**

### GET /sessions/{sessionId}/products

Aggregated products-to-prepare view (Part 3 — Product Aggregation).

**Response 200:**
```json
{
  "data": [
    {
      "product_id": "uuid",
      "product_name": "string",
      "sku": "string",
      "total_quantity_needed": 120,
      "unit": "kg",
      "orders_count": 18,
      "prepared_quantity": 80,
      "remaining_quantity": 40,
      "status": "in_progress"
    }
  ]
}
```

---

## Error Responses

| Code | Scenario |
|------|----------|
| 422 | Validation failure — body lists field-level errors |
| 403 | Supervisor-only action called by non-supervisor |
| 409 | Order already attached to another active session |
| 404 | Resource not found or belongs to another company |
