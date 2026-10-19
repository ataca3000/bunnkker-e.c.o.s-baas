# ECOS POS — Backup & Recovery Guide

**Version:** 1.0.0  
**Audience:** System administrators, DevOps engineers

---

## Table of Contents

1. [Database Backup](#database-backup)
2. [Receipt Recovery](#receipt-recovery)
3. [Session Recovery](#session-recovery)
4. [Shift Recovery](#shift-recovery)
5. [Disaster Recovery](#disaster-recovery)
6. [Restore Validation](#restore-validation)

---

## Database Backup

### Critical POS Tables

All POS transaction data is stored in PostgreSQL. The following tables must be included in every backup:

| Table | Contents | Priority |
|-------|----------|----------|
| `pos_sessions` | Terminal session records | Critical |
| `pos_shifts` | Shift lifecycle and cash counts | Critical |
| `pos_carts` | Cart state (JSONB lines, totals, metadata) | Critical |
| `pos_sales` | Completed sale records | Critical |
| `pos_receipts` | Receipt archive (JSONB line items) | Critical |
| `pos_returns` | Return records | Critical |
| `pos_exchanges` | Exchange records | Critical |
| `pos_payments` | Payment audit trail | Critical |
| `pos_cash_drawers` | Cash drawer records | High |

### Backup Strategy

#### Full Database Backup (Daily)

```bash
pg_dump \
  --host=localhost \
  --port=5432 \
  --username=ecos \
  --no-password \
  --format=custom \
  --compress=9 \
  --file=/backups/ecos_$(date +%Y%m%d_%H%M%S).dump \
  ecos_production
```

Schedule via cron:
```cron
0 2 * * * /usr/local/bin/pg_dump ... >> /var/log/backup.log 2>&1
```

#### Transaction Log Backup (Continuous / WAL Archiving)

Configure PostgreSQL WAL archiving for point-in-time recovery (PITR):

```ini
# postgresql.conf
wal_level = replica
archive_mode = on
archive_command = 'cp %p /wal_archive/%f'
```

This enables recovery to any point in time, not just daily backup snapshots.

#### POS-tables-only Backup

For smaller targeted restores:
```bash
pg_dump \
  --host=localhost \
  --username=ecos \
  --table=pos_sessions \
  --table=pos_shifts \
  --table=pos_carts \
  --table=pos_sales \
  --table=pos_receipts \
  --table=pos_returns \
  --table=pos_exchanges \
  --table=pos_payments \
  --format=custom \
  --file=/backups/ecos_pos_$(date +%Y%m%d).dump \
  ecos_production
```

### Retention Policy

| Backup Type | Retention |
|-------------|-----------|
| Daily full backup | 30 days |
| Weekly full backup | 12 weeks |
| Monthly full backup | 12 months |
| WAL archive | 7 days |

### Off-site Storage

- Replicate daily backups to an off-site location (S3, Azure Blob, GCS)
- Verify off-site transfer daily
- Encrypt backups at rest using AES-256

---

## Receipt Recovery

### Individual Receipt Recovery

Receipts are stored in the `pos_receipts` table. Every receipt is immutable once issued.

**To retrieve a specific receipt:**
```sql
SELECT * FROM pos_receipts WHERE id = 'receipt-uuid';
SELECT * FROM pos_receipts WHERE receipt_number = 'TERM-001-20260701-00042';
```

**To retrieve all receipts for a sale:**
```sql
SELECT r.*
FROM pos_receipts r
JOIN pos_sales s ON r.original_transaction_id = s.id::text
WHERE s.id = 'sale-uuid';
```

**Via API:**
```
GET /api/pos/receipts/{receipt_id}
POST /api/pos/receipts/{receipt_id}/reprint
```

### Bulk Receipt Recovery

If receipts were lost from the `pos_receipts` table (e.g., accidental delete — not possible via normal POS operation), restore from backup:

1. Restore the `pos_receipts` table from the last known good backup to a staging database
2. Extract the missing receipts
3. Insert them into the production database

```bash
# Restore specific table to staging
pg_restore \
  --host=staging-db \
  --username=ecos \
  --table=pos_receipts \
  --dbname=ecos_staging \
  /backups/ecos_20260701_020000.dump
```

---

## Session Recovery

### Recovering an Active Session

If a session ID is lost from localStorage but the session is still open in the database:

1. Query the database:
```sql
SELECT id, terminal_id, cashier_id, status, opened_at
FROM pos_sessions
WHERE terminal_id = 'TERM-001'
  AND status = 'open'
ORDER BY opened_at DESC
LIMIT 1;
```

2. Set the session ID in the browser:
```javascript
// In browser console
const ctx = JSON.parse(localStorage.getItem('ecos_pos_context'));
ctx.sessionId = 'recovered-session-uuid';
localStorage.setItem('ecos_pos_context', JSON.stringify(ctx));
// Then reload the page
```

### Session Stuck Open

If a session remains `open` after a terminal failure and cannot be closed via the POS:

```sql
-- After verifying no active sales or shifts are pending
UPDATE pos_sessions
SET status = 'closed', closed_at = NOW()
WHERE id = 'stuck-session-uuid';
```

---

## Shift Recovery

### Recovering Shift Data

If a shift was closed but the closing count data appears incorrect:

1. Query the shift record:
```sql
SELECT * FROM pos_shifts WHERE id = 'shift-uuid';
```

2. Recalculate cash flow:
```sql
-- Total cash sales for the shift
SELECT SUM((amount->>'amount')::numeric) as total_cash_sales
FROM pos_payments
WHERE shift_id = 'shift-uuid'
  AND method = 'cash';

-- Total cash refunds for the shift
SELECT SUM((refund_total->>'amount')::numeric) as total_cash_refunds
FROM pos_returns
WHERE shift_id = 'shift-uuid'
  AND refund_method = 'cash';
```

3. If the expected closing amount was entered incorrectly during approval, correct it:
```sql
-- Only do this with manager authorization and audit trail
UPDATE pos_shifts
SET expected_closing = '{"amount": "1500.00", "currency": "EGP"}'
WHERE id = 'shift-uuid';
```

### Shift Stuck in "Closing" State

If a shift was submitted but never approved/rejected:

Via API:
```
PUT /api/pos/shifts/{shift_id}/approve
PUT /api/pos/shifts/{shift_id}/reject
```

---

## Disaster Recovery

### Recovery Time Objective (RTO)

| Scenario | Target RTO |
|----------|------------|
| Single terminal failure | 5 minutes (reload browser) |
| Application server failure | 30 minutes (restart + health check) |
| Database failure | 2 hours (restore from backup) |
| Full site disaster | 4 hours (restore + validation) |

### Recovery Point Objective (RPO)

| Backup Type | RPO |
|-------------|-----|
| WAL archiving (continuous) | ~5 minutes |
| Hourly backup | 1 hour |
| Daily backup | 24 hours |

### Full Site Restore Procedure

1. **Provision new infrastructure** (database server, application server)

2. **Restore database:**
```bash
createdb ecos_production
pg_restore \
  --host=new-db \
  --username=ecos \
  --dbname=ecos_production \
  --no-owner \
  /backups/ecos_latest.dump
```

3. **Apply WAL to reach desired recovery point (PITR):**
```bash
# Set in recovery.conf / postgresql.conf (PostgreSQL 12+)
restore_command = 'cp /wal_archive/%f %p'
recovery_target_time = '2026-07-01 18:00:00'
```

4. **Deploy application code:**
```bash
git checkout v1.0.0
composer install --no-dev
cd frontend && npm ci && npm run build
```

5. **Verify configuration** — update `.env` with new database host

6. **Run validation checklist** (see [Restore Validation](#restore-validation))

7. **Notify store managers** — advise them to verify their last session and shift data

---

## Restore Validation

After every restore (planned or emergency), run the following checks:

### Database Integrity

```sql
-- Verify session counts match expected
SELECT status, COUNT(*) FROM pos_sessions GROUP BY status;

-- Verify no orphaned carts (carts without a session)
SELECT COUNT(*) FROM pos_carts c
WHERE NOT EXISTS (SELECT 1 FROM pos_sessions s WHERE s.id = c.session_id);

-- Verify no sales without receipts
SELECT COUNT(*) FROM pos_sales s
WHERE status = 'completed'
  AND NOT EXISTS (SELECT 1 FROM pos_receipts r WHERE r.original_transaction_id = s.id::text AND r.type = 'sale');

-- Verify receipt number uniqueness per terminal per day
SELECT terminal_id, receipt_number, COUNT(*)
FROM pos_receipts
GROUP BY terminal_id, receipt_number
HAVING COUNT(*) > 1;
```

### Application Validation

```bash
# Run POS integration test suite
php artisan test --filter=POS
```

### Functional Validation Checklist

- [ ] `GET /api/health` returns all services green
- [ ] `POST /api/auth/login` succeeds with valid credentials
- [ ] `GET /api/pos/sessions` returns session list
- [ ] `GET /api/products` returns product catalog
- [ ] Test a complete sale on one terminal: open session → open shift → add product → pay → receipt appears
- [ ] Test a return against a known historical sale
- [ ] Verify receipt reprint works for a past receipt
- [ ] Compare total sale count from restored database against last known count
- [ ] Verify the most recent transaction in the database matches the known last transaction before the incident

### Sign-Off

After all validation checks pass, the store manager and a technical representative must sign off before normal operations resume. Document the restore event including:
- Date and time of incident
- Date and time of restore
- Data loss (if any) in minutes/transactions
- Actions taken
