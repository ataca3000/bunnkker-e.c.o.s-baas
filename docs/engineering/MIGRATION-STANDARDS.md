# Migration Standards

**Document:** MIGRATION-STANDARDS  
**Version:** 1.0  
**Status:** APPROVED — Architecture Only  
**Date:** 2026-07-05  
**Task:** TASK-DATABASE-ENGINEERING-001  
**Parent:** DATABASE-ENGINEERING-STANDARDS.md

---

## 1. Migration File Rules

| Rule | Requirement |
|---|---|
| **One concern per migration** | Each migration addresses exactly one concern (one table, one column, one index) |
| **Naming** | `YYYY_MM_DD_HHMMSS_descriptive_action_and_subject.php` |
| **Naming examples** | `2026_07_05_120000_create_products_table.php` / `2026_07_05_130000_add_status_to_orders.php` |
| **No raw SQL** | Use Laravel Blueprint/Schema Builder; exceptions require Engineering Lead approval |
| **Reversible** | `down()` method must be the exact reverse of `up()` |
| **No data in migrations** | Data modifications go in seeders or standalone jobs |
| **Test locally first** | Run `php artisan migrate:fresh` successfully before committing |

---

## 2. Migration Types and Patterns

### Create Table
```php
Schema::create('products', function (Blueprint $table) {
    // See DATABASE-ENGINEERING-STANDARDS.md for column ordering
});
```

### Add Column (safe — backward compatible)
```php
Schema::table('orders', function (Blueprint $table) {
    $table->string('external_source', 50)->nullable()->after('external_reference');
});
```

### Add Index
```php
Schema::table('orders', function (Blueprint $table) {
    $table->index(['company_id', 'status'], 'idx_orders_company_id_status');
});
```

### Breaking Changes (multi-step pattern)
Breaking changes (rename column, change type, remove column) must use this multi-step pattern:

**Step 1 Migration:** Add new column / new structure (backward compatible)
```php
$table->string('new_column', 100)->nullable()->after('old_column');
```

**Deploy Step 1** — application reads both old and new column; writes to both

**Step 2 Migration:** Backfill data (if needed — use a job, not migration)

**Step 3 Migration:** Remove old column (after application no longer reads it)
```php
Schema::table('table', function (Blueprint $table) {
    $table->dropColumn('old_column');
});
```

---

## 3. Zero-Downtime Migration Rules

| Pattern | Safe for Zero-Downtime? | Notes |
|---|---|---|
| Add nullable column | ✅ Yes | Can apply while app is running |
| Add NOT NULL column with DEFAULT | ✅ Yes | PostgreSQL 11+ adds instantly with a default |
| Add index with CONCURRENTLY | ✅ Yes | `CREATE INDEX CONCURRENTLY` in raw SQL or custom migration |
| Drop column | ⚠️ Only after code removed | App must not reference it |
| Rename column | ❌ No | Use add + backfill + remove pattern |
| Change column type | ❌ No | Use add + backfill + remove pattern |
| Add NOT NULL without DEFAULT | ❌ No | Table lock; must backfill first |

---

## 4. Concurrently Index Creation

For large tables, index creation must use CONCURRENTLY to avoid table locks:

```php
// In a migration, for large tables:
public function up(): void
{
    // Cannot use Blueprint for CONCURRENTLY — use raw statement
    DB::statement(
        'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_company_id_status 
         ON orders (company_id, status)'
    );
}

public function down(): void
{
    DB::statement('DROP INDEX CONCURRENTLY IF EXISTS idx_orders_company_id_status');
}
```

---

## 5. Migration Review Checklist

Before a migration is approved for merge, the reviewer checks:

```
[ ] Migration naming follows convention
[ ] Entity exists in LOGICAL-ENTITY-MODEL.md
[ ] Columns follow DATABASE-NAMING-CONVENTIONS.md
[ ] UUID primary key (not auto-increment)
[ ] company_id column present (for tenant-scoped entities)
[ ] Audit columns present (created_at, created_by, updated_at, updated_by)
[ ] Soft-delete columns if entity uses soft delete
[ ] Natural key UNIQUE constraint defined
[ ] company_id index defined
[ ] Status column uses VARCHAR (not ENUM type)
[ ] Cross-domain UUID refs have NO FK constraint
[ ] down() is the exact inverse of up()
[ ] No data mutations in migration
[ ] Large-table index uses CONCURRENTLY
[ ] Migration runs successfully from scratch (migrate:fresh tested)
[ ] Test suite passes after migration
```

---

## 6. Migration Versioning

Every migration file is committed to version control. The schema version is tracked in two ways:

1. **Laravel migrations table** — `migrations` table records which migrations have run
2. **Schema version document** — `docs/engineering/DATABASE-VERSIONING.md` tracks major schema milestones

---

## 7. Emergency Migration Procedure

For urgent production fixes:

```
1. Engineering Lead creates an expedited PR
2. PR includes: migration + test + rollback plan
3. DBA or Engineering Lead reviews (not standard PR review)
4. Run during off-peak hours if any table lock possible
5. Post-migration: update DATABASE-VERSIONING.md within 24h
6. Retrospective: add checklist item if new risk pattern discovered
```
