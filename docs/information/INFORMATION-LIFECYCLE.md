# Information Lifecycle

**Document:** INFORMATION-LIFECYCLE  
**Version:** 1.0  
**Status:** APPROVED — Architecture Only  
**Date:** 2026-07-05  
**Task:** TASK-INFORMATION-ARCH-001  
**Parent:** ENTERPRISE-INFORMATION-ARCHITECTURE.md

---

## 1. Information Lifecycle Model

Every piece of data in ECOS follows a defined lifecycle. The lifecycle determines how data is created, validated, used, archived, and purged.

```
CREATE ──→ ACTIVE ──→ ARCHIVED ──→ PURGED
  │           │           │
  │           │           └── Retained but not queryable in UI
  │           └────────── Soft-deleted: accessible only to audit
  └── Validation at origin
```

---

## 2. Lifecycle Stages

| Stage | Description | Query Access | Storage |
|---|---|---|---|
| **Active** | Normal operational state; fully accessible | Full read/write | Operational tables |
| **Archived** | No longer used operationally; retained for compliance | Audit queries only | Archive table or partition |
| **Anonymized** | PII replaced with anonymized values; structure preserved | Limited (GDPR-compliant) | Operational tables (anonymized) |
| **Purged** | Permanently deleted after retention period | None | Removed |

---

## 3. Lifecycle by Data Category

### 3.1 Master Data Lifecycle

| Entity | Active Period | Archival Trigger | Retention After Archival | Purge |
|---|---|---|---|---|
| Product | Until discontinued | `discontinued` status set | 7 years (referenced by orders) | After 7 years + no open orders |
| RawMaterial | Until discontinued | `discontinued` status + no open POs | 7 years | After 7 years |
| Customer | Until inactive + GDPR request | GDPR erasure request | PII anonymized immediately; structure 7 years | After 7 years |
| Supplier | Until inactive | `inactive` status | 7 years | After 7 years |
| Employee | Until terminated | HR termination record | PII anonymized on request; employment record 7 years | After 7 years |
| Vehicle | Until decommissioned | `decommissioned` status | 3 years | After 3 years |

### 3.2 Transactional Data Lifecycle

| Entity | Retention Period | Archival | Purge Trigger |
|---|---|---|---|
| Order | 7 years | After 2 years to archive partition | After 7 years |
| Invoice | 10 years | After 2 years to archive partition | After 10 years (Egyptian tax law) |
| Payment | 10 years | After 2 years | After 10 years |
| StockMovement | 7 years | After 2 years | After 7 years |
| ReceiptLayer | 7 years | After 2 years (when fully consumed) | After 7 years |
| PurchaseOrder | 7 years | After 2 years | After 7 years |
| GoodsReceipt | 7 years | After 2 years | After 7 years |
| POSSale | 7 years | After 2 years | After 7 years |
| PreparationWave | 2 years | After 6 months | After 2 years |
| ShippingWave | 2 years | After 6 months | After 2 years |
| Shipment | 3 years | After 1 year | After 3 years |

### 3.3 Event Data Lifecycle (EPS-01)

| Event Category | Retention | Notes |
|---|---|---|
| Financial events (orders.order.*, finance.*) | 7 years | Legal/audit requirement |
| Inventory events (inventory.*) | 7 years | FIFO cost audit requirement |
| Fulfillment events | 2 years | Operational record |
| Logistics events | 2 years | Operational record |
| Platform events (notifications, documents) | 1 year | Operational record |
| AI recommendation events | 6 months | Short-lived; models improve over time |

### 3.4 Analytical Data Lifecycle

| Data | Retention | Notes |
|---|---|---|
| Read models (CQRS projections) | Indefinite (rebuilt from events) | No separate retention — event retention governs |
| KPI snapshots | 2 years | Rolling history for trend analysis |
| Demand forecasting data | 3 years | Seasonal patterns |
| AI training datasets | 1 year per version | Versioned; old sets purged when new model deployed |

---

## 4. Archival Strategy

**Archive by partition:**
- Data older than N years is moved to an archive partition (same PostgreSQL cluster, separate tablespace)
- Archive partitions are read-only; operational tables remain fast
- Archive partition queries available only to authorized audit users

**Archive access control:**
- Active data: standard user access
- Archived data: finance/audit role only
- Purged data: no access (permanent)

---

## 5. GDPR Lifecycle (Personal Data)

Personal data follows a different lifecycle path:

```
Created → Active → GDPR Request → Anonymized → Retained (anonymized) → Purged
```

**Anonymization rules (not deletion):**
- Name → "ANONYMIZED USER #{id_hash}"
- Phone → "+00000000000"
- Email → "anonymized@{id_hash}.gdpr"
- Address → nulled fields; governorate retained for analytics
- Transaction history → preserved with anonymized actor reference

**What survives anonymization:**
- Order history (customer_id preserved, all PII nulled)
- Invoice history (same)
- GDPR request record (proof of compliance)

---

## 6. Lifecycle Enforcement Mechanism

| Mechanism | How It Works |
|---|---|
| **Scheduled archival jobs** | Daily job identifies records past active period; moves to archive partition |
| **Retention policy config** | Retention periods are configured via ConfigurationPlatform; not hardcoded |
| **GDPR request workflow** | Privacy Officer initiates via Configuration OS; system anonymizes within 30 days |
| **Purge jobs** | Monthly job; purges records that have exceeded full retention; requires supervisor approval |
| **Audit before purge** | Every purge operation is logged before execution (audit record survives the purge) |
