# Audit Data Model

**Document:** AUDIT-DATA-MODEL  
**Version:** 1.0  
**Status:** APPROVED — Architecture Only  
**Date:** 2026-07-05  
**Task:** TASK-DATA-ARCH-001  
**Parent:** ENTERPRISE-LOGICAL-DATA-ARCHITECTURE.md

---

## 1. Audit Strategy

ECOS uses a two-layer audit approach:

| Layer | Mechanism | Scope | Where |
|---|---|---|---|
| **Row-level audit** | Audit columns on every entity | Who created/updated/deleted each row | Inline columns on every table |
| **Event-level audit** | BusinessEvent stream (EPS-01) | Every significant business action | `business_events` table |
| **Change audit** | Timeline entries (EPS-02) | Human-readable history per business object | `timeline_entries` table |
| **Action audit** | Audit log table | Config changes, policy evaluations, security events | `audit_log` table (Platform) |

---

## 2. Mandatory Audit Columns

Every entity table in ECOS carries these columns:

### Standard Entity (mutable)
```
created_at    TIMESTAMP NOT NULL  — System-set at INSERT; never user-provided; never mutated
created_by    UUID NOT NULL       — Actor ID (user or system UUID); FK to users within company
updated_at    TIMESTAMP NOT NULL  — System-set at every UPDATE; never user-provided
updated_by    UUID NOT NULL       — Actor who last updated
deleted_at    TIMESTAMP NULL      — Set on soft-delete; NULL when active
deleted_by    UUID NULL           — Actor who soft-deleted
```

### Append-Only Entity (immutable records)
```
created_at    TIMESTAMP NOT NULL  — System-set at INSERT
created_by    UUID NOT NULL       — Actor who caused the record to be created
(no updated_at, updated_by, deleted_at, deleted_by — records are immutable)
```

### Status-Change Tables (no content changes, only lifecycle)
Some entities combine update audit with status transitions:
```
confirmed_at     TIMESTAMP NULL / confirmed_by    UUID NULL
dispatched_at    TIMESTAMP NULL / dispatched_by   UUID NULL
completed_at     TIMESTAMP NULL / completed_by    UUID NULL
cancelled_at     TIMESTAMP NULL / cancelled_at    UUID NULL
```
These status-transition pairs follow the pattern: `{status}_at + {status}_by` on the main entity.

---

## 3. Actor Tracking

### Actor Types
Every audit entry records not just who, but what type of actor:

| Actor Type | Description | System UUID |
|---|---|---|
| `user` | Human user logged into ECOS | Their user UUID |
| `system` | Automated job, scheduled process | `00000000-0000-0000-0000-000000000001` |
| `api` | API call (external integration) | UUID of the API credential |
| `ai` | AI recommendation accepted by user | The user UUID (AI acts on behalf of user) |
| `migration` | Database migration script | `00000000-0000-0000-0000-000000000002` |

### System UUIDs
Reserved system actor UUIDs are seeded in the database:
```
SYSTEM_ACTOR_UUID = 00000000-0000-0000-0000-000000000001
MIGRATION_ACTOR_UUID = 00000000-0000-0000-0000-000000000002
```

---

## 4. Audit Log Entity

For high-value actions (configuration changes, policy evaluations, security events, PII access), a dedicated audit log is maintained.

### Entity: audit_log
```
Table:  audit_log
Domain: Platform
Identity: ULID (time-ordered)
Company Scoped: Yes (NULL for system-level events)
Append-Only: Yes

Columns:
  id:             ULID NOT NULL
  company_id:     UUID NULL
  actor_id:       UUID NULL
  actor_type:     VARCHAR(50) NOT NULL
  action:         VARCHAR(100) NOT NULL — e.g. 'config.published', 'policy.evaluated', 'gdpr.anonymized'
  object_type:    VARCHAR(50) NULL
  object_id:      UUID NULL
  before_state:   JSONB NULL — state before the action (confidential changes)
  after_state:    JSONB NULL — state after the action
  ip_address:     INET NULL
  user_agent:     TEXT NULL
  source:         VARCHAR(50) NULL — 'web', 'api', 'job', 'migration'
  occurred_at:    TIMESTAMP NOT NULL
  created_at:     TIMESTAMP NOT NULL

Retention: 10 years for financial/compliance; 3 years for operational
```

### Actions Audited

| Action Category | Examples | Retention |
|---|---|---|
| Configuration changes | config.published, config.rolled_back | 7 years |
| Policy evaluations | policy.evaluated (for significant decisions) | 2 years |
| Security events | auth.failed, auth.success, permission.denied | 3 years |
| PII access | customer.pii_accessed, customer.pii_exported | 7 years |
| GDPR actions | gdpr.erasure_requested, gdpr.anonymized | 10 years |
| Financial | invoice.voided, payment.refunded, pos_session.reconciled | 10 years |
| Data purge | data.purged (before purge executes) | Indefinite |

---

## 5. Audit Query Patterns

### "Who changed this entity last?"
```
SELECT updated_by, updated_at FROM {table} WHERE id = :id
```

### "What happened to this order?"
```
SELECT * FROM timeline_entries 
WHERE object_type = 'order' AND object_id = :order_id
ORDER BY occurred_at DESC
```

### "What business events caused this?"
```
SELECT * FROM business_events
WHERE aggregate_type = 'order' AND aggregate_id = :order_id
ORDER BY occurred_at ASC
```

### "Who changed this configuration setting?"
```
SELECT * FROM audit_log
WHERE action LIKE 'config.%' AND object_id = :config_id
ORDER BY occurred_at DESC
```

---

## 6. Audit Governance

| Rule | Statement |
|---|---|
| **AUD-GOV-001** | Audit columns (created_at, created_by) must never be user-provided; always system-set |
| **AUD-GOV-002** | Audit log entries are append-only; no UPDATE or DELETE on audit_log |
| **AUD-GOV-003** | before_state and after_state must not contain PII in plain text |
| **AUD-GOV-004** | The audit log is never truncated; only archived after retention period expires |
| **AUD-GOV-005** | System-level actor UUIDs are reserved and cannot be used by real users |
| **AUD-GOV-006** | Every significant business event produces both a BusinessEvent (EPS-01) and audit columns on the entity |
