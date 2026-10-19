# Configuration Audit — Specification

**Document:** CONFIGURATION-AUDIT  
**Version:** 1.0  
**Status:** APPROVED — Architecture Only  
**Date:** 2026-07-05  
**Task:** TASK-CONFIGURATION-ARCH-001  
**Platform:** Enterprise Configuration & Policy Platform

---

## 1. Mission

> Every configuration change and every policy evaluation is permanently recorded and queryable.

The Configuration Audit provides two complementary audit trails:

1. **Configuration Change Audit** — who changed what, when, from what value, to what value, and why
2. **Policy Evaluation Audit** — every time a Decision Engine used a Policy to make a decision

Together, they make every operational decision in ECOS fully explainable and reproducible.

---

## 2. Configuration Change Audit

### ConfigurationChangeAudit Entity

```
ConfigurationChangeAudit
├── id                        uuid
├── event_type                enum:
│                               version_created
│                               version_submitted_for_approval
│                               version_approved
│                               version_rejected
│                               version_published
│                               version_archived
│                               version_rolled_back
│                               changeset_published
│                               feature_flag_changed
├── config_version_id         → ConfigurationVersion (nullable for feature flags)
├── feature_flag_id           → FeatureFlag (nullable for config changes)
├── setting_key               string
├── setting_category          string
├── scope_type                string
├── scope_id                  string (nullable)
├── version_number            int
├── old_value                 text (nullable — masked if setting.is_sensitive)
├── new_value                 text (nullable — masked if setting.is_sensitive)
├── changed_by                → User
├── change_reason             string
├── ip_address                string
├── user_agent                string
├── affected_policies[]       JSONB           — which policy types this setting feeds into
├── affected_modules[]        JSONB           — which modules depend on this setting
└── recorded_at               timestamp
```

**Masking:** If `ConfigurationSetting.is_sensitive = true`, `old_value` and `new_value` are replaced with `[REDACTED]` in the audit record. The actual values remain in `ConfigurationVersion` — only the audit display masks them.

**Immutability guarantee:** `ConfigurationChangeAudit` records cannot be modified or deleted after creation. The table has `REVOKE UPDATE, DELETE ON configuration_change_audits`.

---

## 3. Policy Evaluation Audit

### PolicyEvaluationAudit Entity

```
PolicyEvaluationAudit
├── id                        uuid
├── policy_id                 → Policy
├── policy_type               string
├── policy_version            int
├── config_version_id         → ConfigurationVersion
├── scope_type                string
├── scope_id                  string (nullable)
│
├── calling_module            string          — which Decision Engine called the Policy Engine
├── calling_context           string          — what operation triggered the evaluation
│                                               e.g. "AllocationEngine.allocate(wave-123)"
├── input_snapshot            JSONB           — snapshot of the evaluation context
│                                               (redacted if contains PII)
│
├── decision                  text            — the decision value
├── decision_type             string          — what kind of decision
├── reason                    text            — human-readable explanation
│
├── rules_evaluated           int
├── rules_matched             int
├── matched_rule_ids          JSONB           — IDs of rules that fired
├── is_ai_assisted            bool
├── ai_confidence             decimal (nullable) — AI confidence if ai_assisted
│
├── actor_type                enum: system | dispatcher | driver | supervisor
├── actor_id                  → User (nullable for system evaluations)
│
└── evaluated_at              timestamp
```

**Volume note:** Policy evaluations happen frequently (every order, every loading session, every allocation). The `ai.audit_all_evaluations` configuration flag controls whether *all* evaluations are logged or only exceptions and manual overrides. When set to `false`, the engine still creates an audit record for:
- Evaluations involving AI-assisted rules
- Evaluations that resulted in a blocked/exception decision
- Evaluations where a manual override was applied
- Evaluations requested as part of a historical replay

---

## 4. Audit Queries

### 4.1 — What changed configuration for channel X in the last 30 days?

```sql
SELECT
    cca.event_type,
    cca.setting_key,
    cca.old_value,
    cca.new_value,
    cca.change_reason,
    u.name AS changed_by,
    cca.recorded_at
FROM configuration_change_audits cca
JOIN users u ON u.id = cca.changed_by
WHERE cca.scope_type = 'channel'
  AND cca.scope_id = 'channel-xyz'
  AND cca.recorded_at >= NOW() - INTERVAL '30 days'
ORDER BY cca.recorded_at DESC;
```

---

### 4.2 — Why did the system allocate in priority mode for order X?

```sql
SELECT
    pea.policy_type,
    pea.policy_version,
    pea.config_version_id,
    pea.decision,
    pea.reason,
    pea.matched_rule_ids,
    pea.is_ai_assisted,
    pea.evaluated_at
FROM policy_evaluation_audits pea
WHERE pea.calling_context LIKE '%order-xyz%'
  AND pea.policy_type = 'AllocationPolicy'
ORDER BY pea.evaluated_at ASC;
```

---

### 4.3 — What was the exact configuration version that produced this allocation decision?

```sql
-- Step 1: Get config_version_id from evaluation audit
SELECT config_version_id FROM policy_evaluation_audits WHERE id = 'eval-abc';

-- Step 2: Get the full configuration value at that version
SELECT cv.version_number, cv.value, cv.effective_from, cv.changelog
FROM configuration_versions cv
WHERE cv.id = 'version-id-from-step-1';
```

---

### 4.4 — How many AI-assisted decisions were made today, and what was the average confidence?

```sql
SELECT
    policy_type,
    COUNT(*) AS total_evaluations,
    AVG(ai_confidence) AS avg_confidence,
    SUM(CASE WHEN ai_confidence >= 0.85 THEN 1 ELSE 0 END) AS high_confidence_decisions
FROM policy_evaluation_audits
WHERE is_ai_assisted = true
  AND DATE(evaluated_at) = CURRENT_DATE
GROUP BY policy_type;
```

---

### 4.5 — Who changed the partial delivery setting and when?

```sql
SELECT
    cca.version_number,
    cca.old_value,
    cca.new_value,
    cca.change_reason,
    u.name AS changed_by,
    cca.recorded_at
FROM configuration_change_audits cca
JOIN users u ON u.id = cca.changed_by
WHERE cca.setting_key = 'fulfillment.delivery.require_pod'
ORDER BY cca.recorded_at DESC;
```

---

## 5. Audit Retention Policy

| Audit Type | Minimum Retention | Maximum Retention | Notes |
|---|---|---|---|
| Configuration Change Audit | Indefinite | Indefinite | Immutable; business compliance |
| Policy Evaluation Audit (all) | 1 year | 3 years | High volume; configurable by `ai.audit_all_evaluations` |
| Policy Evaluation Audit (exceptions + overrides) | Indefinite | Indefinite | Low volume; always retained |
| Configuration Approval Records | Indefinite | Indefinite | Compliance |

---

## 6. Audit Dashboard

The Audit Dashboard provides real-time visibility into:

| Section | Displays |
|---|---|
| **Recent Changes** | Last 50 configuration changes, filterable by category/scope/user |
| **Active Policies** | Currently active policy for each scope level |
| **Decision Volume** | Evaluations per policy type per hour (sparkline) |
| **AI Decisions** | AI-assisted evaluation rate + average confidence |
| **Pending Approvals** | Configuration changes awaiting approval |
| **Scheduled Changes** | Future-dated published versions |
| **Override Tracker** | Manual overrides in the last 24 hours |

---

## 7. Integration with Configuration Versioning

The audit and versioning systems share the same `ConfigurationVersion` entity. Every audit record references a specific version — creating an unbreakable link between:

```
Operational Decision
    → PolicyEvaluationAudit.config_version_id
        → ConfigurationVersion.id
            → ConfigurationVersion.value (the exact setting used)
            → ConfigurationVersion.published_by + published_at
            → ConfigurationChangeAudit records for that version
```

This chain means any decision can be fully reconstructed from audit records alone.
