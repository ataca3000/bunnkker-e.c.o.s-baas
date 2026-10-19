# Rule Evaluation Engine — Specification

**Document:** RULE-EVALUATION-ENGINE  
**Version:** 1.0  
**Status:** APPROVED — Architecture Only  
**Date:** 2026-07-05  
**Task:** TASK-CONFIGURATION-ARCH-001  
**Platform:** Enterprise Configuration & Policy Platform

---

## 1. Mission

> Evaluate business rules consistently, returning structured decisions that are fully explainable and auditable.

The Rule Evaluation Engine evaluates PolicyRule sets against a given input context. It does not store rules — it receives them from the Policy Engine and evaluates them.

---

## 2. Rule Types

Eleven rule types are supported. Each has its own evaluator.

| Rule Type | Description | Example Use Case |
|---|---|---|
| `conditional` | If-then logic based on input field values | If `order.payment_status = 'paid'` → priority = 1 |
| `priority` | Ordered ranking — first matching rule wins | Rank order types from highest to lowest priority |
| `score` | Numeric scoring — sum or average of matched rules | Score a supplier: delivery rate + price stability + lead time |
| `threshold` | Trigger when a numeric value crosses a limit | Alert when vehicle utilization > 90% |
| `time` | Rules that depend on time of day, day of week, or date range | Disallow partial delivery after 20:00 |
| `location` | Rules that depend on geographic attributes | Use refrigerated vehicle for orders in Zone X |
| `customer` | Rules that depend on customer tier or attributes | Gold-tier customers get priority 1 allocation |
| `company` | Rules that apply to a specific company context | Company A: max discount 15% |
| `channel` | Rules that apply to a specific channel | Channel "Wholesale": always pallet-build |
| `ai_assisted` | AI produces a scored recommendation; rule decides whether to apply it | Apply AI allocation suggestion if confidence > 0.85 |
| `manual_override` | Supervisor or dispatcher declared an explicit override | Driver override: reduce allocation with reason |

---

## 3. Rule Evaluation Result

Every evaluation returns a `RuleEvaluationResult`:

```
RuleEvaluationResult
├── decision                  mixed           — the output value (string, int, bool, object)
├── decision_type             string          — what kind of decision this is (e.g. "allocation_priority")
├── reason                    string          — human-readable explanation of why this decision was made
├── policy_id                 → Policy
├── policy_type               string
├── policy_version            int
├── config_version_id         → ConfigurationVersion
├── scope_type                string
├── scope_id                  string (nullable)
├── rules_evaluated           int
├── rules_matched             int
├── matched_rules[]           → PolicyRule[]  — the specific rules that fired
├── input_snapshot            JSONB           — snapshot of the input context at evaluation time
├── evaluated_at              timestamp
├── effective_config_at       timestamp       — config was published at this time
└── is_ai_assisted            bool            — true if an AI-assisted rule contributed
```

---

## 4. Evaluation Engine Contract

```php
interface RuleEvaluationEngineContract
{
    public function evaluate(
        Policy $policy,
        array $context,
        string $decisionType
    ): RuleEvaluationResult;
}
```

The `$context` array contains the input data. It is always validated against the policy's expected input schema before evaluation begins. If context is invalid, a `RuleEvaluationContextException` is thrown — never silently ignored.

---

## 5. Rule Type Specifications

### 5.1 Conditional Rule

Evaluates a boolean condition on the input context. If the condition matches, returns the configured action.

```json
{
  "rule_type": "conditional",
  "condition_expression": {
    "field": "order.payment_status",
    "operator": "eq",
    "value": "paid"
  },
  "action": {
    "priority_rank": 1
  }
}
```

**Supported operators:** `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `in`, `not_in`, `contains`, `starts_with`, `is_null`, `is_not_null`

**Compound conditions:**
```json
{
  "rule_type": "conditional",
  "condition_expression": {
    "operator": "AND",
    "conditions": [
      { "field": "order.payment_status", "operator": "eq", "value": "paid" },
      { "field": "order.customer_tier", "operator": "in", "value": ["gold", "platinum"] }
    ]
  },
  "action": {
    "priority_rank": 1
  }
}
```

---

### 5.2 Priority Rule

Returns the action from the first matching rule in a sorted list. Rules are sorted by `sequence` ascending.

```json
[
  {
    "rule_type": "priority",
    "sequence": 1,
    "condition_expression": { "field": "order.payment_status", "operator": "eq", "value": "paid" },
    "action": { "priority_rank": 1, "label": "Paid Order" }
  },
  {
    "rule_type": "priority",
    "sequence": 2,
    "condition_expression": { "field": "order.payment_status", "operator": "eq", "value": "cod" },
    "action": { "priority_rank": 2, "label": "COD Order" }
  },
  {
    "rule_type": "priority",
    "sequence": 99,
    "condition_expression": { "operator": "always_true" },
    "action": { "priority_rank": 99, "label": "Default" }
  }
]
```

The last rule uses `"operator": "always_true"` as a catch-all. Without it, unmatched input raises an exception.

---

### 5.3 Score Rule

Each matching rule contributes a numeric score. The evaluation returns the total score and the breakdown.

```json
[
  {
    "rule_type": "score",
    "name": "on_time_delivery",
    "condition_expression": { "field": "supplier.on_time_rate", "operator": "gte", "value": 0.95 },
    "action": { "score": 30 }
  },
  {
    "rule_type": "score",
    "name": "price_stability",
    "condition_expression": { "field": "supplier.price_deviation_ratio", "operator": "lte", "value": 1.05 },
    "action": { "score": 25 }
  },
  {
    "rule_type": "score",
    "name": "lead_time",
    "condition_expression": { "field": "supplier.avg_lead_time_days", "operator": "lte", "value": 3 },
    "action": { "score": 20 }
  }
]
```

**Decision:** `{ total_score: 75, breakdown: { on_time_delivery: 30, price_stability: 25, lead_time: 20 } }`

---

### 5.4 Threshold Rule

Triggers when a numeric field crosses a configured boundary.

```json
{
  "rule_type": "threshold",
  "condition_expression": {
    "field": "vehicle.utilization_pct",
    "operator": "gt",
    "value": 90
  },
  "action": {
    "alert": "vehicle_near_capacity",
    "severity": "warning"
  }
}
```

---

### 5.5 Time Rule

Applies only during specific time windows.

```json
{
  "rule_type": "time",
  "condition_expression": {
    "day_of_week": ["saturday", "sunday"],
    "time_range": { "from": "08:00", "to": "16:00" }
  },
  "action": {
    "max_orders_per_vehicle": 30
  }
}
```

**Supported time fields:** `day_of_week`, `time_range`, `date_range`, `month`, `is_holiday`

---

### 5.6 Location Rule

Applies based on geographic attributes of the input.

```json
{
  "rule_type": "location",
  "condition_expression": {
    "governorate_id": "ALEX",
    "zone_ids": ["SMOUHA", "CLEOPATRA"]
  },
  "action": {
    "require_refrigerated_vehicle": true
  }
}
```

---

### 5.7 AI-Assisted Rule

Delegates to the AI Platform for a scored recommendation. The rule then decides whether to accept the recommendation based on confidence threshold.

```json
{
  "rule_type": "ai_assisted",
  "condition_expression": {
    "ai_entry_point": "EP-A1",
    "min_confidence": 0.85
  },
  "action": {
    "apply_ai_recommendation": true,
    "fallback_to_next_rule": true
  }
}
```

**If AI confidence < min_confidence:** The rule does not fire. The engine continues to the next rule. If `fallback_to_next_rule = false`, a `LowConfidenceException` is raised.

**AI recommendations always include:**
- Policy used
- Confidence level
- Explanation
- Override possibility flag

---

### 5.8 Manual Override Rule

Records an explicit human decision. Applied when a dispatcher or driver overrides a system decision.

```json
{
  "rule_type": "manual_override",
  "condition_expression": {
    "override_recorded": true,
    "actor_type": "driver"
  },
  "action": {
    "apply_manual_decision": true
  }
}
```

Manual override rules always create an `AllocationRevision` record (or equivalent in the relevant module) with mandatory reason.

---

## 6. Evaluation Algorithm

```
function evaluate(policy, context, decisionType):

    result = new RuleEvaluationResult(policy, context)
    rules = policy.rules.sortBy('sequence ASC').filter(is_active)

    for rule in rules:
        evaluator = getEvaluator(rule.rule_type)

        if evaluator.matches(rule.condition_expression, context):
            result.addMatchedRule(rule)
            decision = evaluator.apply(rule.action, context, result)
            result.setDecision(decision)

            // Stop after first match for priority/conditional rules
            if rule.rule_type in ['priority', 'conditional']:
                break

    if result.decision is null:
        // No rule matched — check if policy has a required fallback
        if policy.requires_decision:
            throw NoRuleMatchedException(policy, context)
        else:
            result.setDecision(policy.default_value)

    result.finalize()
    auditEngine.record(result)
    return result
```

---

## 7. Context Validation

Before evaluation begins, the input `$context` is validated against the policy type's expected schema.

```php
interface PolicyContextSchema
{
    public function validate(array $context): ValidationResult;
    public function requiredFields(): array;
    public function optionalFields(): array;
}
```

If validation fails:
- Throw `RuleEvaluationContextException` with field-level errors
- Record the failed evaluation in the audit log
- Never silently ignore missing context fields

---

## 8. Rule Evaluator Registry

Each rule type is handled by a dedicated evaluator class. New rule types are added by registering a new evaluator — the engine itself is not modified.

```php
interface RuleEvaluatorContract
{
    public function ruleType(): string;
    public function matches(array $conditionExpression, array $context): bool;
    public function apply(array $action, array $context, RuleEvaluationResult $result): mixed;
}
```

**Evaluator Registry:**

```
ConditionalRuleEvaluator    → handles 'conditional'
PriorityRuleEvaluator       → handles 'priority'
ScoreRuleEvaluator          → handles 'score'
ThresholdRuleEvaluator      → handles 'threshold'
TimeRuleEvaluator           → handles 'time'
LocationRuleEvaluator       → handles 'location'
CustomerRuleEvaluator       → handles 'customer'
CompanyRuleEvaluator        → handles 'company'
ChannelRuleEvaluator        → handles 'channel'
AiAssistedRuleEvaluator     → handles 'ai_assisted'
ManualOverrideRuleEvaluator → handles 'manual_override'
```

---

## 9. Audit Integration

Every `RuleEvaluationResult` is automatically forwarded to the Configuration Audit system. This is not optional. The audit call is inside the engine — not in the Decision Engine.

```php
// Inside RuleEvaluationEngine.evaluate():
$result = $this->doEvaluate($policy, $context, $decisionType);
$this->auditService->recordEvaluation($result);  // always runs
return $result;
```

Decision Engines do not need to call audit separately.
