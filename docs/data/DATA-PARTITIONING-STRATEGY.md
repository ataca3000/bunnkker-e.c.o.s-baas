# Data Partitioning Strategy

**Document:** DATA-PARTITIONING-STRATEGY  
**Version:** 1.0  
**Status:** APPROVED — Architecture Only  
**Date:** 2026-07-05  
**Task:** TASK-DATA-ARCH-001  
**Parent:** ENTERPRISE-LOGICAL-DATA-ARCHITECTURE.md

---

## 1. Why Partition?

High-volume tables in ECOS grow continuously. Without partitioning:
- Query performance degrades as table size grows
- VACUUM and maintenance operations become slow
- Archival requires scanning the entire table
- Index sizes become unwieldy

Partitioning is the proactive architectural response to expected data volume.

---

## 2. Partition Candidates

Not all tables need partitioning. Partitioning adds implementation complexity and should only be applied where volume justifies it.

### Tables That Require Partitioning

| Table | Estimated Volume | Partition Strategy | Partition Key |
|---|---|---|---|
| `business_events` | Millions per month | Time (monthly) | `occurred_at` |
| `stock_movements` | Millions per month | Time (monthly) | `occurred_at` |
| `timeline_entries` | Millions per month | Time (monthly) | `occurred_at` |
| `notification_deliveries` | High volume | Time (monthly) | `created_at` |
| `orders` | Tens of thousands per month | Time (yearly) | `created_at` |
| `audit_log` | High volume | Time (monthly) | `occurred_at` |
| `pos_sales` | Thousands per day (high-POS companies) | Time (monthly) | `completed_at` |

### Tables That Do NOT Need Partitioning

| Table | Reason |
|---|---|
| `products` | Small, bounded set; ~thousands max |
| `customers` | Manageable; ~hundreds of thousands max |
| `invoices` | Moderate volume; 1:1 with orders |
| `receipt_layers` | Bounded by GR activity; moderate volume |
| `employees` | Very small |
| `vehicles` | Very small |
| All reference data | Tiny, static |

---

## 3. Partition Strategies

### Strategy P1: Time-Based Range Partitioning (Primary Strategy)

Partition by time range. Each partition holds records for one month or one year.

```
Parent table: stock_movements (no data stored directly)
Child partitions:
  stock_movements_2026_01  (occurred_at: 2026-01-01 to 2026-01-31)
  stock_movements_2026_02  (occurred_at: 2026-02-01 to 2026-02-28)
  ... (created monthly by a maintenance job)
  
Archive partitions (> 2 years old):
  stock_movements_2024_01  → moved to archive tablespace (read-only)
```

**Query behavior:**
- Queries with `WHERE occurred_at >= 'date'` touch only relevant partitions (partition pruning)
- Old partitions become read-only → VACUUM skips them
- Archive = detach partition from parent and move to archive tablespace

### Strategy P2: Company + Time Composite (Multi-tenant optimization)

For very high-volume multi-tenant deployments, partition by (company_id range hash + time). This ensures a busy tenant's data doesn't slow queries for others.

**Initial deployment:** Time-only partitioning (P1).  
**Future upgrade path:** If a single tenant's volume creates contention, add company-range sub-partitions.

---

## 4. Archive Partition Lifecycle

```
Active partition:   Receives writes; queried in normal operations
                    Retained for: current period + 2 years

Cold partition:     No new writes; queried for historical reports
                    Implemented as: read-only partition on standard tablespace
                    Age: 2-5 years old

Archive partition:  Detached from parent table; not queryable via normal queries
                    Implemented as: separate tablespace; accessible only via explicit archive query
                    Age: > 5 years (or per retention policy from INFORMATION-LIFECYCLE.md)

Purge:              Partition drop after full retention period expired
                    Audit log entry created before drop
```

---

## 5. Partition Creation Automation

A scheduled maintenance job creates new partitions proactively:

```
Job: CreateNextPartition
Schedule: 1st of every month (creates next month's partition)
Scope: All partitioned tables
Action:
  1. Check if next month's partition exists
  2. If not: CREATE TABLE {table}_{year}_{month} PARTITION OF {table}
             FOR VALUES FROM ('{year}-{month}-01') TO ('{year}-{month+1}-01')
  3. Log partition creation to audit_log
```

---

## 6. Partitioning Governance

| Rule | Statement |
|---|---|
| **PART-GOV-001** | Partitioning is applied only to tables listed in this document; no ad-hoc partitioning |
| **PART-GOV-002** | Partition creation is automated; manual partition management is only for incidents |
| **PART-GOV-003** | Archive partition detachment requires Engineering Lead approval |
| **PART-GOV-004** | Queries against partitioned tables must always include the partition key in WHERE clause filters to enable partition pruning |
| **PART-GOV-005** | Foreign keys to partitioned tables are not supported in PostgreSQL native partitioning; cross-domain references (which use UUID without FK) are unaffected |
