# Configuration Versioning — Specification

**Document:** CONFIGURATION-VERSIONING  
**Version:** 1.0  
**Status:** APPROVED — Architecture Only  
**Date:** 2026-07-05  
**Task:** TASK-CONFIGURATION-ARCH-001  
**Platform:** Enterprise Configuration & Policy Platform

---

## 1. Core Rule

> No configuration value is ever edited in place. Every change creates a new immutable version.

Configuration Versioning guarantees that the system can always answer: *"What configuration was active at 14:32 on 2026-06-15?"* — and reproduce any historical decision exactly.

---

## 2. Version Lifecycle

```
         ┌─────────────┐
         │    DRAFT     │  — Created; not yet active; editable
         └──────┬───────┘
                │ Submit for Approval
                ▼
         ┌─────────────┐
         │  PENDING    │  — Under review; not editable
         │  APPROVAL   │
         └──────┬───────┘
                │ Approve         OR    Reject
                ▼                        ↓
         ┌─────────────┐          Returns to DRAFT
         │  APPROVED   │  — Approved; not yet effective
         └──────┬───────┘
                │ Publish (manual) OR effective_from reached
                ▼
         ┌─────────────┐
         │  PUBLISHED  │  — Active; read-only; cannot be modified
         └──────┬───────┘
                │ New version published → this version archived
                ▼
         ┌─────────────┐
         │  ARCHIVED   │  — Inactive; permanently preserved; queryable
         └─────────────┘
```

**Important transitions:**
- DRAFT → APPROVED: requires `requires_approval = true` on the setting; otherwise skips to PUBLISHED
- PUBLISHED → ARCHIVED: happens automatically when a newer version is published for the same (setting, scope)
- ARCHIVED → PUBLISHED: rollback operation (see Section 6)
- PUBLISHED cannot be deleted — ever

---

## 3. Version Number

Version numbers are auto-incremented per `(setting_key, scope_type, scope_id)` tuple. They are always positive integers starting at 1. Gaps are acceptable (if draft versions are discarded without publishing).

```
Setting: fulfillment.allocation.mode
Scope: channel / website-a

Version 1: published (2026-06-01) → archived
Version 2: published (2026-06-15) → archived
Version 3: published (2026-07-01) → current
Version 4: draft (in review)
```

---

## 4. Approval Workflow

Settings with `requires_approval = true` cannot be published without an approval step.

### Approval Entity

```
ConfigurationApproval
├── id                        uuid
├── config_version_id         → ConfigurationVersion
├── status                    enum: pending | approved | rejected
├── requested_by              → User
├── requested_at              timestamp
├── reviewed_by               → User (nullable)
├── reviewed_at               timestamp (nullable)
├── review_notes              string (nullable)
└── rejection_reason          string (nullable — required if rejected)
```

### Approval Flow

```
1. User submits draft for approval
2. ConfigurationApproval record created (status: pending)
3. Approvers are notified
4. Approver reviews → approves or rejects
5. If approved: version moves to APPROVED status
6. User may then publish (or set future effective_from)
7. If rejected: version returns to DRAFT with rejection reason
```

### Who Can Approve

Approval authority depends on the setting category:

| Category | Required Approver Role |
|---|---|
| `enterprise` | System Administrator |
| `security` | System Administrator |
| `accounting` | Finance Manager + Administrator |
| `ai.auto_apply.*` | System Administrator |
| All others | Administrator |

---

## 5. Future Effective Date

A published version can have a future `effective_from` date. This allows:
- Scheduling price changes for the start of a new pricing period
- Pre-configuring holiday operating rules
- Planning configuration changes that coincide with a deployment

```
Current: version 3 (effective_from: 2026-01-01)
Scheduled: version 4 (status: published, effective_from: 2026-08-01)

On 2026-07-31 at 23:59: system uses version 3
On 2026-08-01 at 00:00: system uses version 4 (version 3 → archived automatically)
```

Future-dated versions are included in the Audit and are visible in the Version History — clearly labeled "Scheduled."

---

## 6. Rollback

Rollback restores an archived version to active status.

### Rollback Rules

1. Only ARCHIVED versions may be rolled back
2. The rollback creates a new version (a copy of the archived version) — it does not resurrect the original
3. The new version has `changelog` pre-populated: "Rollback to version N: [original changelog]"
4. The rollback requires a reason (entered by the administrator)
5. The rollback requires approval if the setting has `requires_approval = true`
6. The rolled-back version goes through the normal DRAFT → APPROVED → PUBLISHED lifecycle

```
Rollback to version 2:
  1. Create version 5 (copy of version 2 data)
  2. version 5 changelog: "Rollback to v2 (2026-06-15): [original reason]. Rollback reason: [admin input]"
  3. Submit version 5 for approval (if required)
  4. Publish → version 3 archived, version 5 becomes active
```

---

## 7. Bulk Configuration Changes

When multiple settings need to change together (e.g., updating all fulfillment settings for a new channel), a **Configuration Changeset** groups them:

```
ConfigurationChangeset
├── id                        uuid
├── name                      string          — e.g. "Q3 2026 Fulfillment Update"
├── description               text
├── status                    enum: draft | submitted | approved | published | rejected
├── versions[]                → ConfigurationVersion[]  — all settings in this change
├── created_by                → User
├── approved_by               → User (nullable)
├── published_at              timestamp (nullable)
├── effective_from            timestamp (nullable)    — applied to all versions in changeset
└── changelog                 text
```

A Changeset is approved and published atomically — either all versions publish, or none do.

---

## 8. Version History Query

The Version History is queryable for any (setting, scope) combination:

```sql
-- What configuration has been active for fulfillment.allocation.mode for channel X?
SELECT
    cv.version_number,
    cv.status,
    cv.value,
    cv.effective_from,
    cv.archived_at,
    cv.changed_by,
    cv.changelog
FROM configuration_versions cv
WHERE cv.setting_key = 'fulfillment.allocation.mode'
  AND cv.scope_type = 'channel'
  AND cv.scope_id = 'channel-xyz'
ORDER BY cv.version_number DESC;
```

---

## 9. Point-in-Time Replay

Any historical decision can be reproduced by querying the active version at a specific timestamp:

```sql
-- What was the allocation mode for channel X at 2026-06-15 14:32?
SELECT cv.value
FROM configuration_versions cv
WHERE cv.setting_key = 'fulfillment.allocation.mode'
  AND cv.scope_type = 'channel'
  AND cv.scope_id = 'channel-xyz'
  AND cv.status IN ('published', 'archived')
  AND cv.effective_from <= '2026-06-15 14:32:00'
  AND (cv.effective_to IS NULL OR cv.effective_to > '2026-06-15 14:32:00')
ORDER BY cv.effective_from DESC
LIMIT 1;
```

The `RuleEvaluationResult` stores the `config_version_id` — so replaying a decision is always possible by fetching that specific version.
