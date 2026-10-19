# Preparation OS — AI Integration

**Document:** AI-INTEGRATION  
**Version:** 1.0  
**Status:** APPROVED — Engineering Design Phase  
**Date:** 2026-07-05  
**Task:** TASK-PREP-001  
**Parent:** PREPARATION-OS-BLUEPRINT.md  
**AI Architecture:** docs/architecture/AI-DATA-ARCHITECTURE.md  
**UX Standard:** docs/ux/AI-UX-STANDARD.md

---

## 1. AI Integration Philosophy

> AI in Preparation OS assists human decision-makers. It never takes autonomous actions on preparation waves.  
> All AI outputs are labeled as recommendations. Any AI override creates an audit trail.  
> GOV-008: AI must declare — Policy Used, Confidence, Explanation, Override Possibility.

---

## 2. AI Entry Points (Current Phase)

Entry points are defined as signals Preparation OS sends to the AI Platform and recommendations it receives back. All entry points use the `AIService` contract (SVC-AI-001).

---

### EP-PREP-AI-01: Wave Duration Prediction

**When:** After `StartPreparationAction` (preparation.wave.started event)  
**Signal sent to AI:**
```json
{
  "entry_point": "EP-PREP-AI-01",
  "wave_id": "UUID",
  "products_count": 12,
  "total_units_required": 4215.0,
  "workers_assigned": 3,
  "has_shortage": false,
  "planning_date": "2026-07-05",
  "warehouse_id": "UUID",
  "historical_avg_duration_minutes": 148
}
```

**AI Returns:**
```json
{
  "prediction_type": "wave_duration",
  "predicted_completion_minutes": 135,
  "confidence": 0.78,
  "explanation": "Based on 45 similar waves: 12 products, 3 workers, no shortage",
  "policy_version": "v1.2",
  "generated_at": "2026-07-05T09:00:15Z"
}
```

**UX Display:** Dashboard shows "Estimated completion: 11:15 AM (±15 min)" below wave progress bar.

---

### EP-PREP-AI-02: Shortage Risk Forecast

**When:** Wave is in `draft` or `planning` status — before MRP is run  
**Trigger:** Planner views wave details; AI pre-flight check  
**Signal sent to AI:**
```json
{
  "entry_point": "EP-PREP-AI-02",
  "wave_id": "UUID",
  "product_ids": ["UUID", "..."],
  "planning_date": "2026-07-05",
  "warehouse_id": "UUID"
}
```

**AI Returns:**
```json
{
  "prediction_type": "shortage_risk",
  "risk_level": "medium",
  "confidence": 0.65,
  "at_risk_materials": [
    {
      "raw_material_id": "UUID",
      "material_name": "Almond Extract",
      "risk_reason": "Below reorder point; 2 of last 3 waves had shortages",
      "risk_score": 0.82
    }
  ],
  "recommendation": "Run MRP now and create purchase request for Almond Extract"
}
```

**UX Display:** Smart Action Chip in wave detail: "⚠ Shortage risk detected — Almond Extract"

---

### EP-PREP-AI-03: Wave Start Time Recommendation

**When:** Planner opens New Wave creation form  
**Signal sent to AI:**
```json
{
  "entry_point": "EP-PREP-AI-03",
  "planning_date": "2026-07-06",
  "orders_count": 130,
  "warehouse_id": "UUID"
}
```

**AI Returns:**
```json
{
  "prediction_type": "optimal_start_time",
  "recommended_start": "08:30",
  "confidence": 0.71,
  "explanation": "Based on 30 waves: waves started 08:00–09:00 had 94% on-time completion vs 78% for later starts",
  "alternative": "09:00 if fewer workers available"
}
```

**UX Display:** Form helper text: "AI recommends starting at 08:30 based on historical patterns"

---

### EP-PREP-AI-04: Bottleneck Detection

**When:** During preparation (wave in `preparing` status); polling every 10 minutes  
**Signal sent to AI:**
```json
{
  "entry_point": "EP-PREP-AI-04",
  "wave_id": "UUID",
  "elapsed_minutes": 60,
  "predicted_duration_minutes": 135,
  "products_completion_pct": 28.5,
  "items_by_status": {
    "pending": 4,
    "in_progress": 3,
    "prepared": 5,
    "short": 0,
    "blocked": 0
  },
  "workers_count": 3
}
```

**AI Returns:**
```json
{
  "prediction_type": "bottleneck_detection",
  "at_risk": true,
  "confidence": 0.72,
  "risk_reason": "Pace is 28.5% complete after 44% of predicted time — running behind",
  "next_best_action": {
    "action": "add_worker",
    "reason": "Adding 1 more worker reduces estimated delay by ~35 minutes",
    "urgency": "medium"
  }
}
```

**UX Display:** Dashboard alert: "Wave PREP-001 may run late — AI recommends adding a worker" with [Assign Worker] button.

---

### EP-PREP-AI-05: Next Best Action

**When:** Any state where the planner or supervisor has a choice  
**Surfaces as:** Smart Action Chips (EP-AI-01) in wave detail drawer

| Wave State | Possible Actions AI Evaluates |
|---|---|
| `draft` (demand generated) | "Analyze materials now" vs "Wait for more orders" |
| `planning` (no shortage) | "Start preparation now" vs "Add more orders" |
| `shortage_blocked` | "Override and proceed with shortage" vs "Wait for procurement" |
| `preparing` (behind pace) | "Add worker" vs "Extend deadline" vs "Partial complete" |

---

## 3. AI KPIs

These metrics are tracked by the AI Platform for training and model quality:

| KPI | Description | Data Source |
|---|---|---|
| `prep.wave.duration_accuracy` | Predicted duration vs actual | `preparation_waves` |
| `prep.shortage.prediction_accuracy` | Shortage predicted before MRP vs actual shortage | `preparation_material_requirements` |
| `prep.bottleneck.early_detection_rate` | Bottleneck detected > 30 min before SLA breach | `preparation_waves` timeline |
| `prep.recommendation.acceptance_rate` | % of AI recommendations acted upon | User interaction log |
| `prep.shortstart_rate` | % of waves where AI's recommended start time was earlier than actual | `preparation_waves` |

---

## 4. AI Training Datasets

| Dataset | Tables | AI Purpose |
|---|---|---|
| `DS-PREP-01 Wave Performance` | `preparation_waves`, `preparation_wave_items` | Duration model, completion rate model |
| `DS-PREP-02 Shortage Patterns` | `preparation_material_requirements`, `prepared_products_pool` | Shortage risk model |
| `DS-PREP-03 Worker Efficiency` | `preparation_wave_workers`, `preparation_waves` | Workers-per-wave optimization |
| `DS-PREP-04 Product Completion` | `preparation_wave_items` | Product-level preparation time model |
| `DS-PREP-05 Exception History` | `preparation_exceptions` | Exception type prediction; prevention |

All datasets use anonymized operational data. No PII in training datasets (customer names excluded from DS-PREP-01 to DS-PREP-05).

---

## 5. AI Governance (GOV-008, GOV-009)

| Rule | Implementation |
|---|---|
| AI must declare policy used | Every AI response includes `policy_version` field |
| AI must declare confidence | Every AI response includes `confidence` (0.0–1.0) |
| AI must provide explanation | Every AI response includes `explanation` string |
| AI must declare override possibility | All recommendations are labeled "Recommendation" not "Action" |
| AI cannot bypass Policy Engine | AI recommendations respect ManufacturingPolicy, FulfillmentPolicy |
| AI actions create audit trail | Any wave action taken based on AI recommendation logs `ai_recommendation_id` |

---

## 6. Future AI Hooks (Post-MVP)

These hooks are designed but not activated in the initial implementation.

| Hook | Description | Target Phase |
|---|---|---|
| `FH-PREP-01` Auto Wave Builder | AI suggests optimal wave groupings from order pool | Phase 2 |
| `FH-PREP-02` Dynamic Rebalancing | AI suggests moving orders between waves in real-time | Phase 2 |
| `FH-PREP-03` Predictive MRP | AI pre-calculates likely shortages before the day starts using historical sales patterns | Phase 3 |
| `FH-PREP-04` Worker Scheduling | AI recommends optimal worker count and assignment by hour | Phase 3 |
| `FH-PREP-05` Station Optimization | AI recommends pick path and station assignment to minimize movement | Phase 3 |
| `FH-PREP-06` Quality Prediction | AI flags products likely to fail QC based on production batch history | Phase 4 |
| `FH-PREP-07` SLA Risk Scoring | AI scores each wave's SLA breach risk at creation; influences planner priority | Phase 2 |

All future hooks follow the same signal/response contract pattern. Adding a new hook does NOT require changes to Preparation OS code — only new `entry_point` registrations in the AI Platform.

---

## 7. AI Response Schema (Standard)

All AI recommendations follow this standard schema (SVC-AI-001):

```json
{
  "recommendation_id": "UUID",
  "entry_point": "EP-PREP-AI-01",
  "prediction_type": "string",
  "confidence": 0.0,
  "explanation": "string",
  "policy_version": "string",
  "generated_at": "ISO 8601",
  "valid_until": "ISO 8601",
  "payload": {}
}
```

Recommendations are stored in `ai_recommendations` table (AI Platform) and linked from wave/pool records for auditability.
