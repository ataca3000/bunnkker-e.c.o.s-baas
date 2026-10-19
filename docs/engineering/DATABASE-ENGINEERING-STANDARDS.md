# Database Engineering Standards

**Document:** DATABASE-ENGINEERING-STANDARDS  
**Version:** 1.0  
**Status:** APPROVED — Architecture Only  
**Date:** 2026-07-05  
**Task:** TASK-DATABASE-ENGINEERING-001

> **CTO Directive:** No migration, table, model, or SQL should be created before these standards are approved. This document officially transitions ECOS from Architecture Phase to Engineering Governance Phase.

---

## 1. Mission

> Define mandatory, enforceable standards for every migration, table, model, index, and SQL query in ECOS. These standards translate the Logical Data Architecture into consistent, high-quality physical database objects.

All database engineering in ECOS follows these standards without exception. Deviations require Engineering Lead approval and a written rationale.

---

## 2. Technology Stack

| Component | Technology | Version |
|---|---|---|
| Primary Database | PostgreSQL | 16+ |
| Connection Pool | PgBouncer | (production) |
| ORM | Laravel Eloquent | 12+ |
| Migration Tool | Laravel Migrations | 12+ |
| Search | Meilisearch | Latest stable |
| Cache | Redis | 7+ |
| Queue | Redis | 7+ |

---

## 3. Architecture Compliance

All database work must comply with these upstream documents:

| Document | Governs |
|---|---|
| `docs/data/ENTERPRISE-LOGICAL-DATA-ARCHITECTURE.md` | Entity structure, relationships, mandatory columns |
| `docs/data/IDENTITY-STRATEGY.md` | UUID vs ULID vs business number |
| `docs/data/TEMPORAL-DATA-MODEL.md` | Effective dates, event sourcing, snapshots |
| `docs/data/AUDIT-DATA-MODEL.md` | Mandatory audit columns |
| `docs/data/SOFT-DELETE-ARCHITECTURE.md` | Soft delete strategy per entity |
| `docs/data/DATA-PARTITIONING-STRATEGY.md` | Which tables partition and how |
| `docs/information/DATA-CLASSIFICATION.md` | PII columns requiring encryption |

---

## 4. Standard Migration Structure

Every migration follows this exact structure:

```php
// Pattern for naming: YYYY_MM_DD_HHMMSS_description
// Example: 2026_07_05_120000_create_products_table

public function up(): void
{
    Schema::create('products', function (Blueprint $table) {
        // 1. Primary key (UUID)
        $table->uuid('id')->primary();
        
        // 2. Tenant isolation (always second)
        $table->uuid('company_id')->index();
        
        // 3. Business columns (ordered by importance)
        $table->string('sku', 50)->notNull();
        // ... more columns
        
        // 4. Audit columns (always last group before indexes)
        $table->uuid('created_by');
        $table->timestamp('created_at');
        $table->uuid('updated_by');
        $table->timestamp('updated_at');
        // Soft delete columns (if applicable):
        $table->uuid('deleted_by')->nullable();
        $table->timestamp('deleted_at')->nullable();
        
        // 5. Indexes (defined in this migration, not separate)
        $table->unique(['company_id', 'sku']);
        $table->index(['company_id', 'status']);
        // ... additional indexes
        
        // 6. Foreign keys (within-domain only)
        // $table->foreign('category_id')->references('id')->on('categories');
    });
}

public function down(): void
{
    Schema::dropIfExists('products');
}
```

---

## 5. Engineering Governance Rules

| Rule | Statement |
|---|---|
| **ENG-GOV-001** | No table may be created without a corresponding entity in LOGICAL-ENTITY-MODEL.md |
| **ENG-GOV-002** | All migrations are forward-only; the `down()` method drops the table/column but never destructively modifies data |
| **ENG-GOV-003** | No migration may modify data — data changes use seeders or dedicated data migration jobs |
| **ENG-GOV-004** | Every column must have a comment if its purpose is not self-evident from the name |
| **ENG-GOV-005** | Migrations are reviewed by Engineering Lead before merging to main |
| **ENG-GOV-006** | No raw SQL in migrations — always use Blueprint/Schema Builder methods |
| **ENG-GOV-007** | Breaking schema changes (column removal, type change) require a multi-step migration plan |
| **ENG-GOV-008** | Database schema changes must be backward compatible for at least one release cycle |
| **ENG-GOV-009** | Test suite must pass before any migration is merged |
| **ENG-GOV-010** | Production migrations are run during maintenance windows; never during peak hours |

---

## 6. Document Index

| Document | Purpose |
|---|---|
| `DATABASE-NAMING-CONVENTIONS.md` | Table names, column names, index names, constraint names |
| `MIGRATION-STANDARDS.md` | Migration file structure, rollback rules, review checklist |
| `INDEXING-STANDARDS.md` | When to index, index types, composite indexes, maintenance |
| `FOREIGN-KEY-STANDARDS.md` | When FKs apply, naming, cascade rules, cross-domain rules |
| `CONSTRAINT-STANDARDS.md` | CHECK constraints, NOT NULL, UNIQUE, DEFAULT values |
| `DATABASE-SECURITY-STANDARDS.md` | Encryption, role permissions, connection security |
| `DATABASE-PERFORMANCE-STANDARDS.md` | Query patterns, N+1 prevention, EXPLAIN targets |
| `DATABASE-VERSIONING.md` | Migration version tracking, schema version table |
| `DATABASE-CHANGE-POLICY.md` | Approval process, emergency changes, rollback procedure |

---

## 7. Related Documents

- `docs/data/ENTERPRISE-LOGICAL-DATA-ARCHITECTURE.md` — Logical blueprint
- `docs/domain/ENTERPRISE-DOMAIN-MODEL.md` — Source domain model
- `docs/information/DATA-CLASSIFICATION.md` — PII encryption requirements
- `docs/contracts/ENTERPRISE-CONTRACTS.md` — Query Contracts consume the schema
