# Loading & Allocation OS — AI Integration

**Document:** AI-INTEGRATION  
**Version:** 1.0  
**Status:** APPROVED — Engineering Design Phase  
**Date:** 2026-07-05  
**Task:** TASK-LOAD-001  
**Parent:** BLUEPRINT.md  
**Constraint:** Design only — NO implementation

---

## 1. AI Integration Principles

1. **AI is advisory, never mandatory.** Every AI suggestion can be ignored or overridden by a human dispatcher with no data loss.
2. **AI is gated by feature flags.** Each AI service is individually enabled/disabled per company via the Configuration OS.
3. **AI suggestions are persisted.** Every AI recommendation is stored as an `AISuggestion` record with acceptance/rejection outcome for model feedback.
4. **AI failures are silent.** If an AI service is unavailable or returns an error, the workflow continues without AI input and logs a warning.
5. **AI never executes commands.** AI may suggest — a human or auto-approval policy must execute.

---

## 2. AI Entry Points

### EP-LOAD-AI-01 — Vehicle Planning Recommendations

**Trigger:** After Geography Engine produces GeographyGroups, before Vehicle Planning Engine runs  
**Feature Flag:** `loading.ai_vehicle_planning` (company-scoped)  
**Mode:** Synchronous suggestion (waits up to 3 seconds; timeout = proceed without AI)

**What the AI recommends:**
- Optimal number of vehicles per GeographyGroup
- Suggested order-to-vehicle assignments based on historical delivery performance
- Predicted loading time per vehicle based on SKU mix and warehouse layout
- Alternative vehicle groupings if current split results in underutilized vehicles

**Input to AI:**
```json
{
  "company_id": "uuid",
  "planning_date": "2026-07-05",
  "geography_groups": [
    {
      "zone_id": "uuid",
      "zone_name": "Nasr City",
      "shipping_company_id": "uuid",
      "orders_count": 47,
      "total_weight_kg": 420.5,
      "orders": [{ "order_id": "uuid", "weight_kg": 8.9, "volume_m3": 0.04 }]
    }
  ],
  "available_vehicles": [
    { "vehicle_id": "uuid", "max_weight_kg": 200, "vehicle_type": "standard" }
  ],
  "historical_context": {
    "avg_orders_per_vehicle_last_30d": 14.2,
    "avg_delivery_success_rate": 0.94
  }
}
```

**Output from AI:**
```json
{
  "suggestion_id": "uuid",
  "confidence": 0.87,
  "recommended_vehicle_count": 3,
  "vehicle_assignments": [
    {
      "vehicle_slot": 1,
      "order_ids": ["uuid", "uuid"],
      "predicted_load_time_minutes": 25,
      "predicted_delivery_success_rate": 0.96,
      "reasoning": "High-value paid orders grouped for priority delivery"
    }
  ],
  "warnings": ["Vehicle slot 2 is at 94% capacity — consider splitting"]
}
```

**Storage:**
```
loading_ai_suggestions
  id               UUID
  company_id       UUID
  session_id       UUID
  suggestion_type  'vehicle_planning'
  input_snapshot   JSONB
  output_snapshot  JSONB
  confidence       DECIMAL(4,3)
  accepted         BOOLEAN NULL  — NULL until dispatcher acts
  accepted_by      UUID NULL
  accepted_at      TIMESTAMPTZ NULL
  rejection_reason TEXT NULL
```

---

### EP-LOAD-AI-02 — Route Optimization

**Trigger:** After all vehicle assignments confirmed; before Route Plan is finalized  
**Feature Flag:** `loading.route_optimization`  
**Mode:** Asynchronous job (background; result displayed in UI when ready)

**What the AI recommends:**
- Optimal stop sequence for each vehicle (TSP/VRP optimization)
- Estimated time of arrival per stop
- Predicted fuel consumption
- Traffic-adjusted departure time per vehicle
- Alternative routes if primary route has predicted delays

**Input to AI:**
```json
{
  "company_id": "uuid",
  "vehicle_assignments": [
    {
      "assignment_id": "uuid",
      "vehicle_id": "uuid",
      "warehouse_location": { "lat": 30.0626, "lng": 31.2497 },
      "stops": [
        {
          "order_id": "uuid",
          "address": "145 Mohamed Naguib St, Nasr City",
          "geocode": { "lat": 30.0741, "lng": 31.3406 },
          "delivery_window": { "start": "10:00", "end": "14:00" },
          "items_count": 3
        }
      ]
    }
  ],
  "planning_date": "2026-07-05",
  "departure_time": "2026-07-05T11:00:00"
}
```

**Output from AI:**
```json
{
  "suggestion_id": "uuid",
  "confidence": 0.91,
  "optimized_routes": [
    {
      "assignment_id": "uuid",
      "stop_sequence": ["order_uuid_3", "order_uuid_1", "order_uuid_2"],
      "total_distance_km": 42.3,
      "estimated_duration_minutes": 185,
      "predicted_fuel_liters": 4.8,
      "stop_etas": [
        { "order_id": "uuid", "eta": "2026-07-05T12:15:00" }
      ]
    }
  ],
  "warnings": ["Stop #3 is outside the requested delivery window — dispatcher review needed"]
}
```

---

### EP-LOAD-AI-03 — Allocation Suggestions

**Trigger:** Before `AllocateProductsAction` runs; only when allocation_mode = `ai_suggested`  
**Feature Flag:** `loading.ai_allocation_suggestions`  
**Mode:** Synchronous (waits up to 5 seconds)

**What the AI recommends:**
- Which orders should receive full allocation vs partial
- Recommended quantity adjustments when shortage exists
- Priority order for allocation when inventory is insufficient
- Predicted customer satisfaction impact per allocation decision

**Input to AI:**
```json
{
  "assignment_id": "uuid",
  "vehicle_inventory": [
    { "product_id": "uuid", "quantity_available": 50.0 }
  ],
  "orders": [
    {
      "order_id": "uuid",
      "customer_id": "uuid",
      "payment_method": "paid",
      "order_value": 250.0,
      "lines": [
        { "product_id": "uuid", "quantity_ordered": 5.0 }
      ],
      "customer_history": {
        "lifetime_value": 8400.0,
        "previous_partial_count": 0
      }
    }
  ]
}
```

**Output from AI:**
```json
{
  "suggestion_id": "uuid",
  "confidence": 0.83,
  "allocation_mode_used": "ai_suggested",
  "allocations": [
    {
      "order_id": "uuid",
      "product_id": "uuid",
      "suggested_quantity": 5.0,
      "is_full": true,
      "priority_score": 0.94,
      "reasoning": "High-LTV paid customer; zero prior partials"
    }
  ],
  "shortfall_orders": [],
  "total_satisfaction_score": 0.97
}
```

---

### EP-LOAD-AI-04 — Capacity Prediction

**Trigger:** On-demand from Loading Dashboard analytics panel  
**Feature Flag:** `loading.ai_capacity_prediction`  
**Mode:** Asynchronous background analytics

**What the AI predicts:**
- Expected pool entry volume for the next 3 planning dates
- Recommended number of vehicles to pre-assign
- Predicted peak loading hours for staffing recommendations
- Vehicle utilization forecast

**Output:** Returned as part of the analytics dashboard response:
```json
{
  "predictions": {
    "next_3_days": [
      {
        "planning_date": "2026-07-06",
        "predicted_pool_entries": 142,
        "recommended_vehicles": 4,
        "confidence": 0.78
      }
    ],
    "staffing_recommendation": {
      "peak_loading_window": "09:00–11:00",
      "recommended_workers": 6
    }
  }
}
```

---

### EP-LOAD-AI-05 — Delivery Risk Prediction

**Trigger:** Before `ReleaseVehicleAction` executes  
**Feature Flag:** `loading.ai_delivery_risk`  
**Mode:** Synchronous (waits up to 2 seconds; timeout = proceed with risk = unknown)

**What the AI predicts:**
- Per-order delivery success probability
- Vehicle-level risk score
- Top risk factors per vehicle (traffic, time windows, COD concentration, route length)

**Output shown to dispatcher before release:**
```json
{
  "suggestion_id": "uuid",
  "overall_risk": "low",
  "risk_score": 0.12,
  "high_risk_orders": [],
  "risk_factors": ["2 deliveries have narrow time windows"],
  "recommendation": "Proceed — risk is within acceptable range"
}
```

If `overall_risk = high`, the dispatcher is shown a warning badge on the Release button (non-blocking unless policy = `block_on_high_risk`).

---

### EP-LOAD-AI-06 — Bottleneck Detection

**Trigger:** Background job — runs every 30 minutes during active loading sessions  
**Feature Flag:** `loading.ai_bottleneck_detection`  
**Mode:** Background; results surfaced in Exceptions panel

**What the AI detects:**
- Loading tasks that are running behind schedule (based on historical task completion times)
- Vehicle assignments that are at risk of missing planned departure
- Warehouse zones with high worker load vs low throughput
- Allocation queues that are growing too large for manual review

**Output:** Creates `loading_exceptions` entries with `exception_type = ai_bottleneck`:
```json
{
  "bottleneck_type": "loading_delay",
  "affected_assignment_id": "uuid",
  "vehicle_plate": "ABC-1234",
  "estimated_delay_minutes": 35,
  "risk_to_departure": "HIGH",
  "suggested_action": "Assign 2 additional workers to Station 3",
  "confidence": 0.79
}
```

---

### EP-LOAD-AI-07 — Next Best Action

**Trigger:** On demand from the Loading Dashboard AI Panel  
**Feature Flag:** `loading.ai_next_best_action`  
**Mode:** Synchronous (waits up to 3 seconds)

**What the AI recommends:**
- The single highest-priority action a dispatcher should take right now
- Contextual awareness: current session state, open exceptions, time pressure, vehicle readiness

**Output:**
```json
{
  "next_best_action": {
    "action_type": "resolve_exception",
    "priority": "CRITICAL",
    "description": "3 orders in Zone B have no shipping company coverage. Manually assign to Fallback Carrier or defer.",
    "target_entity_type": "LoadingSession",
    "target_entity_id": "uuid",
    "action_url": "/loading/sessions/{id}/exceptions",
    "estimated_time_to_complete_minutes": 5
  },
  "context_summary": "2 of 4 vehicles are loaded. Session is 15 minutes behind planned departure.",
  "confidence": 0.89
}
```

---

## 3. AI Suggestion Storage Schema

All AI suggestions are stored in `loading_ai_suggestions` for feedback loops and model improvement.

```
loading_ai_suggestions
  id                UUID NOT NULL PK
  company_id        UUID NOT NULL
  session_id        UUID NOT NULL             — FK → loading_sessions
  entry_point       VARCHAR(50) NOT NULL      — 'vehicle_planning' | 'route_optimization' | ...
  input_snapshot    JSONB NOT NULL            — Exact input sent to AI
  output_snapshot   JSONB NOT NULL            — Exact response from AI
  confidence        DECIMAL(4,3)             — AI confidence score (0.000–1.000)
  accepted          BOOLEAN NULL              — NULL: not yet acted on; TRUE: accepted; FALSE: rejected
  accepted_by       UUID NULL                 — User who accepted/rejected
  accepted_at       TIMESTAMPTZ NULL
  rejection_reason  TEXT NULL                 — Free text reason for rejection
  outcome           VARCHAR(50) NULL          — 'correct' | 'incorrect' | 'partial' (backfill from Logistics)
  created_at        TIMESTAMPTZ NOT NULL
```

---

## 4. AI Panel in UX

Each major workspace (Loading Dashboard, Vehicle Planning, Allocation Workspace) has an AI Panel (right sidebar, collapsible) displaying:

1. **Active Suggestions** — pending AI recommendations for the current entity
2. **Next Best Action** — contextual recommendation for the dispatcher
3. **Risk Indicators** — delivery risk scores per vehicle
4. **Confidence Level** — displayed on every suggestion (color-coded: green ≥0.85, yellow 0.70–0.84, red <0.70)

**Interaction pattern:**
- Accept button → calls the relevant override API with `ai_suggestion_id` in the payload; backend marks suggestion as `accepted = true`
- Reject button → prompts for reason (optional text); marks `accepted = false`
- Dismiss → hides the suggestion without recording acceptance/rejection

---

## 5. Feature Flag Summary

| Flag | EP | Default | Description |
|---|---|---|---|
| `loading.ai_vehicle_planning` | EP-01 | `false` | Vehicle plan recommendations |
| `loading.route_optimization` | EP-02 | `false` | Route order optimization |
| `loading.ai_allocation_suggestions` | EP-03 | `false` | Allocation mode: ai_suggested |
| `loading.ai_capacity_prediction` | EP-04 | `false` | Predictive capacity analytics |
| `loading.ai_delivery_risk` | EP-05 | `false` | Pre-release risk scoring |
| `loading.ai_bottleneck_detection` | EP-06 | `false` | Background bottleneck job |
| `loading.ai_next_best_action` | EP-07 | `false` | Contextual NBA in AI panel |
