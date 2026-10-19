# Database Change Policy

**Document:** DATABASE-CHANGE-POLICY  
**Version:** 1.0  
**Status:** APPROVED — Architecture Only  
**Date:** 2026-07-05  
**Task:** TASK-DATABASE-ENGINEERING-001  
**Parent:** DATABASE-ENGINEERING-STANDARDS.md

---

## 1. Policy Purpose

Every change to the ECOS database schema — whether adding a table, renaming a column, or dropping an index — must follow this policy. No migration should reach production without passing through the defined review and approval gates.

---

## 2. Change Classification

| Class | Description | Examples | Approval Required |
|---|---|---|---|
| **Class A — Safe Additive** | Backwards-compatible; no downtime risk | Add nullable column, add index CONCURRENTLY, add new table | Engineering Lead review |
| **Class B — Risky Additive** | Additive but needs careful execution | Add NOT NULL column (requires backfill), add FK to large table | Engineering Lead + PR review |
| **Class C — Structural Change** | Modifies existing structure; deployment coordination | Rename column (3-phase), change column type, add NOT NULL without backfill | Engineering Lead + Architecture Board |
| **Class D — Destructive** | Irreversible removal | Drop column, drop table, drop index that may still be used | Engineering Lead + Architecture Board + CTO |

---

## 3. Change Request Process

### Class A (Safe Additive)
```
1. Developer creates migration following MIGRATION-STANDARDS.md
2. PR opened; migration checklist self-review
3. Engineering Lead reviews migration file
4. CI passes (schema-verify job)
5. Merge to main branch
6. Deploy in next release
```

### Class B (Risky Additive)
```
1. Developer creates migration; writes backfill plan if required
2. PR opened with migration + backfill migration (two files)
3. Engineering Lead reviews both files + execution order
4. Test on staging: run migrate, verify no lock time
5. CI passes
6. Merge after explicit Engineering Lead approval comment
7. Deploy with monitoring enabled on affected table
```

### Class C (Structural Change)
```
1. Developer documents proposed change in a comment on the relevant ADR or creates a new note
2. Architecture Board discusses and approves the approach
3. Developer creates multi-phase migration plan (Phase 1 additive, Phase 2 application, Phase 3 cleanup)
4. Phases deployed in separate releases
5. Engineering Lead signs off each phase before deployment
```

### Class D (Destructive)
```
1. Developer opens a change request document in docs/engineering/changes/
2. Document must include: what is being removed, why, impact analysis, rollback plan
3. Architecture Board reviews
4. CTO approves
5. Minimum 2-week notice period before execution
6. Executed during a scheduled maintenance window with DBA present
```

---

## 4. Migration Review Checklist

Every PR that contains a migration must self-verify:

```
Schema Standards
[ ] Table name follows naming convention (snake_case, plural)
[ ] PK is UUID, not auto-increment
[ ] company_id present (unless platform table explicitly excluded)
[ ] Audit columns present (created_at, created_by, updated_at, updated_by)
[ ] Status column uses VARCHAR + CHECK constraint (not ENUM)

Safety
[ ] One concern per migration file
[ ] NOT NULL columns have a DEFAULT or backfill migration precedes this one
[ ] No raw string concatenation in SQL (SQL injection risk)
[ ] Indexes created with CONCURRENTLY
[ ] down() method is correct and reversible

Performance
[ ] No table lock risk on large tables (use CONCURRENTLY for indexes, multi-step for column changes)
[ ] Index created for new FK columns
[ ] EXPLAIN ANALYZE run if adding/changing indexes on tables with > 100k rows (staging)

Documentation
[ ] Migration name describes the change
[ ] Constraint names follow naming convention
[ ] FK is within-domain (not cross-domain)
```

---

## 5. Emergency Change Procedure

For production emergencies (data corruption, critical bug requiring schema fix):

```
1. Engineering Lead and CTO verbally approve
2. Developer prepares migration
3. Engineering Lead reviews (15-minute fast track)
4. Migration deployed to staging; smoke test (5 minutes)
5. Deploy to production
6. Post-incident: full review within 48 hours; any debt captured in backlog
```

**Emergency changes that are Class C or D require:**
- Backup confirmed before deployment
- DBA monitoring during execution
- Rollback SQL prepared and tested before deploy

---

## 6. Rollback Procedure

Every migration must have a working `down()` method. Before deploying to production:

1. Test `down()` on staging: `php artisan migrate:rollback --step=1`
2. Verify application functions correctly after rollback
3. Document rollback execution time (important for window planning)

**If a rollback is needed in production:**
```
1. Engineering Lead approves rollback
2. Put application in maintenance mode: php artisan down
3. Run: php artisan migrate:rollback --step=N
4. Verify database state
5. Restore application: php artisan up
6. Monitor for 15 minutes
7. Document incident
```

**Rollback is NOT possible for:**
- Data migrations (data transforms; cannot be automatically reversed)
- Migrations with irreversible data changes (column drops with data)
- These require a compensating forward migration instead

---

## 7. Schema Change Changelog

Every significant schema change is recorded in `docs/engineering/SCHEMA-CHANGELOG.md`:

```markdown
## [1.2.0] — 2026-07-05

### Added
- `categories.category_scope` column (VARCHAR, NOT NULL)
- Partial unique index `uq_categories_company_scope_name_active`

### Changed
- `categories.type` renamed to `categories.category_scope` (3-phase migration)

### Removed
- (none)
```

The changelog entry is required for every schema milestone version.

---

## 8. Forbidden Operations

The following operations are forbidden without Architecture Board + CTO approval:

| Forbidden Operation | Why |
|---|---|
| `DROP TABLE` on any table with business data | Irreversible data loss |
| `TRUNCATE` any table in production | Irreversible data loss |
| `ALTER TABLE ... DROP COLUMN` without Class D review | Column may be referenced in application code or reports |
| Adding NOT NULL constraint without backfill | Will fail on tables with existing rows |
| Creating PostgreSQL ENUM types | ALTER TYPE causes table rewrites; use VARCHAR + CHECK |
| Direct `psql` edits to production schema (bypassing migrations) | Breaks schema version tracking |
| Disabling `autovacuum` on any table | Causes MVCC bloat; performance degradation |
| Changing `company_id` column type or scope | Breaks tenant isolation model |

---

## 9. Governance Rules

| Rule | Statement |
|---|---|
| **CHG-001** | Every schema change must go through the classification and approval process defined in this document. |
| **CHG-002** | No direct schema changes are permitted on production outside of migrations. |
| **CHG-003** | Class C and D changes require Architecture Board review before any implementation begins. |
| **CHG-004** | Emergency changes require post-incident review within 48 hours. |
| **CHG-005** | Every destructive operation must have a tested rollback plan before deployment. |
| **CHG-006** | The Schema Changelog must be updated for every milestone version. |
| **CHG-007** | Migrations that touch PII columns require Data Privacy Officer notification. |
