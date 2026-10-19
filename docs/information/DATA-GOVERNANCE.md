# Data Governance

**Document:** DATA-GOVERNANCE  
**Version:** 1.0  
**Status:** APPROVED — Architecture Only  
**Date:** 2026-07-05  
**Task:** TASK-INFORMATION-ARCH-001  
**Parent:** ENTERPRISE-INFORMATION-ARCHITECTURE.md

---

## 1. Governance Framework

Data governance in ECOS ensures that data is accurate, consistent, secure, and used appropriately. It defines who is responsible for data, how disputes are resolved, and how quality is measured.

---

## 2. Ownership Model

### 2.1 Data Owner (Business)
The domain module that creates and is accountable for the data.

| Data Domain | Data Owner Role |
|---|---|
| Products, RawMaterials, Stock | Inventory Manager |
| Orders, Channels | Commerce Manager |
| Customers, Campaigns | CRM Manager |
| Suppliers, POs, GRs | Procurement Manager |
| Invoices, Payments | Finance Manager |
| Employees, Warehouses | Organization Admin |
| Vehicles, Routes | Fleet Manager |
| Recipes, ProductionJobs | Manufacturing Manager |

### 2.2 Data Steward (Engineering)
Responsible for the schema design, migration standards, query performance, and data quality tooling.

The Data Steward for all ECOS data is the **Engineering Lead** (responsible for adhering to DATABASE-ENGINEERING-STANDARDS.md).

### 2.3 Data Consumer (Any Module or User)
Any module, report, or user that reads the data via Query Contracts.
- Consumers must use published Query Contracts (CON-GOV-002)
- Consumers must not bypass Query Contracts with direct SQL joins across module boundaries

### 2.4 Privacy Officer
Accountable for:
- PII data classification audits
- GDPR erasure requests
- Data breach notification
- Retention policy enforcement

---

## 3. Data Quality Dimensions

| Dimension | Definition | Measurement |
|---|---|---|
| **Completeness** | Required fields are populated | % of records with all mandatory fields non-null |
| **Accuracy** | Values are correct and match business reality | Validation pass rate at origin |
| **Consistency** | Same data appears consistently across related records | Cross-entity consistency checks |
| **Timeliness** | Data is available when needed | Read model staleness; event processing lag |
| **Uniqueness** | No duplicates for entities with uniqueness rules | Duplicate detection rate |
| **Validity** | Values conform to their defined domain | Schema validation pass rate |

---

## 4. Data Quality Rules

These rules are enforced at origination (INFO-GOV-003):

| Rule | Entity | Enforcement |
|---|---|---|
| **DQ-001** | All entities | company_id is required; cannot be null |
| **DQ-002** | All entities | created_by is required; cannot be null |
| **DQ-003** | All entities | created_at is set by the system; not user-provided |
| **DQ-004** | Product | SKU must match pattern [A-Z0-9-]{3,50} |
| **DQ-005** | Customer | Phone, if provided, must be E.164 format |
| **DQ-006** | Customer | Email, if provided, must be valid RFC 5322 |
| **DQ-007** | Invoice | Total = sum of line amounts; enforced by application |
| **DQ-008** | StockMovement | Quantity must be > 0; direction field determines add/subtract |
| **DQ-009** | ReceiptLayer | unit_cost must be > 0; zero-cost receipt is a validation error (policy exception required) |
| **DQ-010** | Order | Total must equal sum of line totals + shipping |

---

## 5. Data Quality Violation Procedures

When a quality violation is detected:

| Violation Severity | Response |
|---|---|
| **Blocking** (prevents transaction) | Return validation error to caller; do not persist bad data |
| **Warning** (data persisted but flagged) | Persist with `data_quality_flag = true`; surface in Data Quality dashboard |
| **Historical** (discovered in existing data) | Log in data quality issue register; assign to Data Owner for review |
| **Critical** (affects financial data) | Immediate alert to Finance Manager and Engineering Lead |

---

## 6. Cross-Domain Data Consistency

When data exists in multiple domains (e.g., a customer_id referenced by both Commerce and Finance), consistency is maintained by:

1. **Single source of truth** — Customer data lives in CRM; Commerce and Finance only hold customer_id
2. **Event-driven updates** — When CRM updates a customer, it publishes an event; downstream modules update their read models
3. **Point-in-time snapshots** — Transactions capture the state at the time of the transaction (e.g., order captures customer address at order time, not customer's current address)
4. **No retroactive updates** — A change to the customer's address does not update historical orders

---

## 7. Master Data Conflict Resolution

When two records that should represent the same entity are discovered:

| Entity | Conflict Type | Resolution |
|---|---|---|
| Customer | Same person, two records | CRM Manager reviews; merge via Customer Merge workflow; older record becomes alias |
| Product | Same product, two SKUs | Inventory Manager reviews; one SKU is discontinued; orders mapped to canonical |
| Supplier | Same supplier, two codes | Procurement Manager reviews; one deactivated; POs transferred |

Merge workflows are future implementation features — the governance rules are defined here.

---

## 8. Data Access Control

| Access Type | Control Mechanism |
|---|---|
| Module-to-module | Query Contracts (CON-GOV-002) |
| User-to-data | Role-based permissions (IdentityService) |
| API-to-data | Authentication + authorization middleware |
| External system access | ACL translators only (CON-GOV-003) |
| Analytical/reporting | Dedicated read replicas or projections; never production OLTP |
| Audit access | Audit role; read-only; full history including archived data |
