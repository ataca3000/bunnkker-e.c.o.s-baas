# Archive Strategy

**Document:** ARCHIVE-STRATEGY  
**Version:** 1.0  
**Status:** APPROVED — Architecture Only  
**Date:** 2026-07-05  
**Task:** TASK-DATA-ARCH-001  
**Parent:** ENTERPRISE-LOGICAL-DATA-ARCHITECTURE.md

---

## 1. Archive vs. Purge

| Action | Description | When |
|---|---|---|
| **Archive** | Move data from active operational tables to archive storage; data still accessible for audit | After active period expires (e.g., 2 years after transaction) |
| **Purge** | Permanently delete data | After full retention period (e.g., 7 years for financial data) |

Data passes through Active → Archived → Purged. Data can never skip Archive and go directly to Purge.

---

## 2. Archive Mechanisms

### Mechanism 1: Partition Detachment (Primary — for partitioned tables)

Used for: business_events, stock_movements, timeline_entries, audit_log, orders (large partition)

```
Process:
  1. Identify partitions older than 2 years (or per table's active period)
  2. ALTER TABLE {table} DETACH PARTITION {partition_name}
  3. Move partition to archive tablespace: ALTER TABLE {partition} SET TABLESPACE archive_ts
  4. Partition is no longer queried via the parent table
  5. Accessible only via: SELECT * FROM {partition_name} (explicit partition name)
  6. Record in archive_log: partition_name, table_name, archived_at, archived_by, data_from, data_to

Required:
  - Engineering Lead approval for each partition detachment
  - Audit log entry created before detachment
```

### Mechanism 2: Archive Table Move (for non-partitioned tables)

Used for: orders (older than active period), invoices, receipts

```
Schema: Each eligible table has a shadow archive table in an `archive` schema
  archive.orders (same structure as orders)
  archive.invoices
  archive.purchase_orders

Process:
  1. Archive job identifies records past active period (created_at < 2 years ago)
  2. INSERT INTO archive.{table} SELECT * FROM {table} WHERE ...
  3. Verify row count matches
  4. DELETE FROM {table} WHERE id IN (archived IDs)  ← only after verification
  5. Record in archive_log

Access:
  Normal queries: archive schema not included
  Archive queries: explicit SELECT * FROM archive.{table}
  Admin/Audit UI: can toggle to "show archived"
```

---

## 3. Archive Schedule

| Table | Active Period | Archive Trigger | Notes |
|---|---|---|---|
| orders | 2 years | created_at < now - 2 years | Financial: archived, not purged yet |
| invoices | 2 years | issue_date < now - 2 years | Archived; retained 10 years total |
| stock_movements | 2 years | occurred_at < now - 2 years | Partition-based |
| business_events | 2 years | occurred_at < now - 2 years | Financial events archived; operational purged earlier |
| timeline_entries | 1 year | occurred_at < now - 1 year | Operational; less retention needed |
| audit_log | 3 years | occurred_at < now - 3 years | Archived; financial subset retained 10 years |
| preparation_waves | 6 months | completed_at < now - 6 months | Operational only |
| shipments | 1 year | delivered_at < now - 1 year | |
| notification_deliveries | 6 months | created_at < now - 6 months | |

---

## 4. Purge Schedule

| Table | Full Retention Period | Purge Trigger | Notes |
|---|---|---|---|
| orders | 7 years | created_at < now - 7 years | Financial |
| invoices | 10 years | issue_date < now - 10 years | Egyptian tax law |
| payments | 10 years | created_at < now - 10 years | |
| stock_movements | 7 years | occurred_at < now - 7 years | FIFO cost audit |
| receipt_layers | 7 years | (when remaining_qty = 0 AND received_at < now - 7 years) | |
| purchase_orders | 7 years | created_at < now - 7 years | |
| business_events (financial) | 7 years | occurred_at < now - 7 years | Financial category only |
| business_events (operational) | 2 years | occurred_at < now - 2 years | Can purge directly from active |
| customers (anonymized) | 7 years after anonymization | anonymized_at < now - 7 years | GDPR |

---

## 5. Archive Governance

| Rule | Statement |
|---|---|
| **ARCH-GOV-001** | No data may be purged without first being archived |
| **ARCH-GOV-002** | Purge operations require Engineering Lead approval and an audit log entry before execution |
| **ARCH-GOV-003** | Financial data (orders, invoices, payments) may never be purged before its retention period expires |
| **ARCH-GOV-004** | Archive and purge jobs run in low-traffic windows (scheduled maintenance window) |
| **ARCH-GOV-005** | Archive jobs are idempotent — re-running does not create duplicates |
| **ARCH-GOV-006** | The archive_log table is never purged; it is the permanent record of what was archived and when |
