# Data Classification

**Document:** DATA-CLASSIFICATION  
**Version:** 1.0  
**Status:** APPROVED — Architecture Only  
**Date:** 2026-07-05  
**Task:** TASK-INFORMATION-ARCH-001  
**Parent:** ENTERPRISE-INFORMATION-ARCHITECTURE.md

---

## 1. Classification Model

Every data field in ECOS is classified at design time. Classification determines how the data is stored, accessed, transmitted, logged, and retained.

**Four classifications:**

| Level | Name | Definition | Examples |
|---|---|---|---|
| L1 | **Personal (PII)** | Information that identifies a natural person | Customer name, phone, email, address; Employee national ID |
| L2 | **Confidential** | Sensitive business data not meant for general access | Supplier pricing, employee salary, company financial data |
| L3 | **Internal** | Business data accessible to authorized employees | Product costs, stock levels, order details |
| L4 | **Public** | Data suitable for public display or export | Product catalog for website, public pricing |

---

## 2. PII (Level 1) Inventory

These are the fields classified as Personal Identifiable Information across all ECOS entities.

| Entity | PII Fields | Sensitivity |
|---|---|---|
| Customer | name, phone, email, address (street, building) | High — GDPR applies |
| Customer | date_of_birth (if collected) | High |
| Employee | name, phone, email, national_id, address | High — labor law applies |
| Employee | salary, bank_account | Very High |
| Supplier (contact) | contact_name, contact_phone, contact_email | Medium — B2B relationship |
| Driver | name, phone, driver_license_number | High |
| OrderLine (delivery notes) | custom delivery instructions mentioning a person | Medium |

**PII Handling Rules:**
- PII fields must be encrypted at rest using database-level encryption
- PII fields must not appear in log files (logging middleware must mask them)
- PII fields must not appear in error messages returned to API clients
- PII in event payloads must be minimized — include IDs, not raw PII, where possible
- AI training data must never contain raw PII fields
- Exports containing PII require manager approval

---

## 3. Confidential (Level 2) Inventory

| Entity | Confidential Fields | Notes |
|---|---|---|
| Product | cost_price, purchase_price | Internal pricing |
| Product | supplier_price_list entries | Supplier agreement data |
| Recipe | recipe_cost, ingredient quantities | Manufacturing IP |
| Invoice | amounts, payment terms | Financial |
| PurchaseOrder | unit prices, total amount | Procurement data |
| Employee | performance_rating, salary | HR data |
| Company | financial_statements, bank_details | Executive access only |

**Confidential Handling Rules:**
- Not displayed in public-facing UIs
- API endpoints returning confidential data require role authorization
- Confidential fields are excluded from general export functions
- Audit log records access to confidential data by non-default roles

---

## 4. Internal (Level 3) Data

| Category | Examples | Access |
|---|---|---|
| Inventory data | Stock levels, movement history | All internal users |
| Order data | Order status, order lines | Commerce, Fulfillment, Finance roles |
| Supplier performance | Delivery rates, quality scores | Procurement roles |
| Vehicle tracking | Route history, loading records | Logistics, Fulfillment roles |

**Internal Handling Rules:**
- Standard role-based access control applies
- Accessible within the company; not shared externally without explicit export
- Available in internal dashboards and reports

---

## 5. Public (Level 4) Data

| Category | Examples | Distribution |
|---|---|---|
| Product catalog | Name, images, public description | Website, WooCommerce, Meta catalog |
| Channel pricing | Price displayed to customer | Published to sales channels |
| Company public info | Company name, public address | Public profiles |

**Public Handling Rules:**
- May be exported and shared externally
- Published to external channels via ACL translators
- No restrictions on access within ECOS

---

## 6. Field-Level Classification Rules

| Rule | Statement |
|---|---|
| **CLASS-001** | Every new entity must have every field classified before it is added to the domain model |
| **CLASS-002** | PII fields must be identified in the migration comments and the entity catalog |
| **CLASS-003** | Fields holding PII must use encrypted column storage |
| **CLASS-004** | Classification can be upgraded (more sensitive) but never downgraded without Privacy Officer approval |
| **CLASS-005** | Mixed-classification entities (e.g. Order has L3 data + L1 delivery address) are classified at their highest level for access purposes |
| **CLASS-006** | Logs, errors, and event payloads must not include PII or Confidential data |

---

## 7. Transmission Rules by Classification

| Classification | In-Transit Encryption | At-Rest Encryption | External Transmission |
|---|---|---|---|
| L1 Personal | TLS 1.3 required | Column-level encryption required | Prohibited without explicit consent + ACL |
| L2 Confidential | TLS 1.3 required | Encrypted in storage | Prohibited without manager approval |
| L3 Internal | TLS 1.3 required | Standard PostgreSQL encryption | Internal API only |
| L4 Public | TLS 1.3 recommended | Standard | Freely transmittable |

---

## 8. GDPR Applicability

ECOS serves Egypt-first, with global expansion planned. Egyptian Personal Data Protection Law No. 151/2020 and GDPR (for EU customers) both apply.

| Requirement | ECOS Response |
|---|---|
| Right to erasure | GDPR anonymization flow (INFORMATION-LIFECYCLE.md) |
| Right to access | Export API per customer — returns all their PII in structured format |
| Data minimization | PII fields only collected when necessary; optional fields are optional |
| Consent tracking | Customer consent timestamp stored on Customer entity |
| Data breach notification | Security incident → EPS-04 alerts Privacy Officer + management |
| Retention limits | Defined in INFORMATION-LIFECYCLE.md; enforced by scheduled jobs |
