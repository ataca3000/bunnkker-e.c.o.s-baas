# Database Security Standards

**Document:** DATABASE-SECURITY-STANDARDS  
**Version:** 1.0  
**Status:** APPROVED — Architecture Only  
**Date:** 2026-07-05  
**Task:** TASK-DATABASE-ENGINEERING-001  
**Parent:** DATABASE-ENGINEERING-STANDARDS.md

---

## 1. Connection Security

| Requirement | Standard |
|---|---|
| **Encryption in transit** | TLS 1.3 required for all PostgreSQL connections |
| **Connection via PgBouncer** | All application connections via PgBouncer pool; no direct connections from app pods |
| **Credentials** | Never hardcoded; always from environment variables or secret management |
| **Password rotation** | Database passwords rotated every 90 days |
| **Network isolation** | PostgreSQL not accessible from public internet; internal network only |
| **Read replica** | Reporting queries use separate read replica; never primary write connection |

---

## 2. Database Roles

ECOS uses role-based access control at the PostgreSQL level:

| Role | Permissions | Used By |
|---|---|---|
| `ecos_app` | SELECT, INSERT, UPDATE on all app tables | Application (main role) |
| `ecos_readonly` | SELECT on all tables | Reporting, analytics, read replicas |
| `ecos_migrator` | DDL (CREATE, ALTER, DROP) + all DML | Migration runner (separate credential) |
| `ecos_archive` | SELECT on archive schema + INSERT on archive tables | Archive job |
| `ecos_audit` | SELECT on audit_log + archive schema | Compliance/audit access |
| `superuser` | Full access | DBA only; never used by application |

**Application (`ecos_app`) is explicitly DENIED:**
- DDL statements (CREATE TABLE, ALTER TABLE, DROP TABLE)
- TRUNCATE
- Direct access to `archive` schema
- Access to `pg_catalog` system tables

---

## 3. PII Column Encryption

Columns classified as Level 1 (Personal) in DATA-CLASSIFICATION.md must be encrypted at rest.

| Column | Entity | Encryption Method |
|---|---|---|
| `name` | customers | Application-level AES-256 |
| `phone` | customers | Application-level AES-256 |
| `email` | customers | Application-level AES-256 |
| `address_jsonb` | customers | Application-level AES-256 for address fields |
| `name` | employees | Application-level AES-256 |
| `national_id` | employees | Application-level AES-256 |
| `salary` | employees | Application-level AES-256 |

**Encryption approach: Application-level (not database-level)**
- Application encrypts before INSERT; decrypts after SELECT
- Encrypted values stored as TEXT with a version prefix: `v1:{base64_encrypted_value}`
- Encryption key stored in secret management (not in database, not in code)
- Key rotation: Old key retained for decryption; new key used for new encrypts; gradual re-encryption job

**Implication for search:** Encrypted PII fields cannot be searched in PostgreSQL. They are indexed in Meilisearch with plaintext (Meilisearch is a separate secure service; access controlled separately).

---

## 4. SQL Injection Prevention

| Rule | Statement |
|---|---|
| **Parameterized queries always** | All queries use bound parameters; never string concatenation |
| **Eloquent by default** | ORM is the primary interface; raw SQL requires Engineering Lead review |
| **Raw SQL review** | Any `DB::statement()` or `DB::select()` with dynamic input requires security review |
| **No user input in column/table names** | Column names in dynamic queries must come from a whitelist, never directly from user input |

---

## 5. Audit and Logging

| What Is Logged | Where |
|---|---|
| All configuration changes | `audit_log` table |
| All PII access by non-standard roles | `audit_log` table |
| Failed authentication attempts | Application log + security monitoring |
| Privilege escalation | `audit_log` + security alert |
| Schema changes (DDL) | `audit_log` (logged by migrator role) |
| Large bulk operations | Application log + audit_log |

**Sensitive data in logs:**
- PII (name, phone, email) must NEVER appear in log files
- Log masking middleware masks defined PII fields before logging
- Database query logs (slow query log) must also not log PII values — use query parameterization

---

## 6. Data-at-Rest Encryption

Beyond column-level PII encryption:

| Layer | Encryption | Notes |
|---|---|---|
| Disk-level | PostgreSQL tablespace on encrypted volume (OS-level) | Infrastructure team responsibility |
| Backup encryption | Backups encrypted before storage | AES-256; key separate from data |
| Archive tablespace | Same encryption as primary | |

---

## 7. Backup and Recovery Standards

| Requirement | Standard |
|---|---|
| Full backup frequency | Daily |
| WAL archival | Continuous (point-in-time recovery) |
| Retention | 30-day rolling backup window |
| Recovery test | Monthly restore drill |
| RTO target | < 4 hours for full restore |
| RPO target | < 1 hour (WAL archival interval) |
| Backup storage | Different geographic region than primary |
