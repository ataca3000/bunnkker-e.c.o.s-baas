# Master Data Model

**Document:** MASTER-DATA-MODEL  
**Version:** 1.0  
**Status:** APPROVED — Architecture Only  
**Date:** 2026-07-05  
**Task:** TASK-INFORMATION-ARCH-001  
**Parent:** ENTERPRISE-INFORMATION-ARCHITECTURE.md

---

## 1. What Is Master Data?

Master data defines the core entities of the business. It is shared across multiple transactions and processes. It changes slowly, and when it does change, the change must be governed, versioned, and audited.

**Characteristics:**
- Referenced by many transactions (an Order references a Customer, Product, Warehouse)
- Relatively stable — changes require approval or audit trail
- Inaccurate master data corrupts every transaction that references it
- Duplicates cause reconciliation problems; a single Product in ECOS should never have two records

---

## 2. Master Data Domains

### 2.1 Organization Master Data
```
Entity: Company
  Owner: Organization
  Business Key: company_code (alphanumeric, unique globally)
  Identity: UUID
  Scope: Root entity — everything belongs to a Company
  Governance: Created by platform admin; cannot be deleted while active
  Change Control: Company name, settings — logged change; no approval required
                  Company deletion — requires platform admin + data export

Entity: Branch
  Owner: Organization
  Business Key: (company_id, branch_code)
  Identity: UUID
  Governance: Created by company admin; status changes are audited

Entity: Warehouse
  Owner: Organization
  Business Key: (company_id, warehouse_code)
  Identity: UUID
  Governance: Location, capacity — audit logged
  PII: Address (physical location, not personal — classified as Internal)

Entity: Channel
  Owner: Organization
  Business Key: (company_id, channel_code)
  Identity: UUID
  Governance: Channel config changes are audit logged; type is immutable after creation

Entity: Employee
  Owner: Organization
  Business Key: (company_id, employee_number)
  Identity: UUID
  PII: Name, phone, email, national_id — classified as Confidential
  Governance: HR creates; status changes require HR approval; PII anonymized on GDPR request
```

### 2.2 Inventory Master Data
```
Entity: Product
  Owner: Inventory
  Business Key: SKU (uppercase, alphanumeric, hyphens; unique per company)
  Identity: UUID
  SKU is immutable once a product is activated
  Status: draft → active → discontinued
  Governance: New product requires manager approval before activation
  Change Control: Price changes → version history; name/description → audit log; SKU → immutable

Entity: RawMaterial
  Owner: Inventory
  Business Key: (company_id, material_code)
  Identity: UUID
  Status: draft → active → discontinued
  Governance: Creation by procurement; discontinuation requires no open PO lines

Entity: Unit
  Owner: Reference Data (see REFERENCE-DATA-MODEL.md)
  Business Key: unit_code (e.g. KG, L, PC)
  Note: Shared across Inventory, Manufacturing, Procurement
```

### 2.3 Procurement Master Data
```
Entity: Supplier
  Owner: Procurement
  Business Key: (company_id, supplier_code)
  Identity: UUID
  Status: prospect → active → suspended → inactive
  PII: Contact name, email, phone — classified as Confidential
  Governance: New supplier requires procurement manager approval
  Change Control: Price changes in supplier price lists → versioned; contact changes → audit log
```

### 2.4 CRM Master Data
```
Entity: Customer
  Owner: CRM
  Business Key: (company_id, customer_code) + natural keys: phone, email
  Identity: UUID
  Status: active → inactive → blocked
  PII: Name, phone, email, address — classified as Personal (GDPR applies)
  Deduplication: Phone number uniqueness enforced per company; email uniqueness enforced per company
  Governance: GDPR deletion → anonymize PII fields; retain transaction history with anonymized reference
  Change Control: All field changes audit logged; status changes require reason
```

### 2.5 Logistics Master Data
```
Entity: Vehicle
  Owner: Logistics
  Business Key: (company_id, license_plate)
  Identity: UUID
  Status: available → assigned → in_transit → under_maintenance → decommissioned
  Governance: Registration change → manager approval; decommission → fleet admin

Entity: Driver
  Owner: Logistics
  Business Key: (company_id, employee_id) — driver is a role on Employee
  PII: Name, phone, license number — classified as Confidential
```

---

## 3. Master Data Quality Rules

| Rule | Applied To | Statement |
|---|---|---|
| **MDQ-001** | Product | SKU must be unique per company; system enforces uniqueness |
| **MDQ-002** | Product | Name must not be blank; max 255 chars |
| **MDQ-003** | Customer | Phone must be valid E.164 format when provided |
| **MDQ-004** | Customer | Email must be valid RFC 5322 format when provided |
| **MDQ-005** | Supplier | At least one contact method required (phone or email) |
| **MDQ-006** | Warehouse | Address must include governorate; coordinates optional |
| **MDQ-007** | RawMaterial | Unit of measure is required and must be a valid reference value |
| **MDQ-008** | All entities | company_id is always required; no orphaned records |
| **MDQ-009** | All entities | created_by (actor_id) is required; system actors use a system UUID |
| **MDQ-010** | All entities | status field must use values from the defined status model only |

---

## 4. Master Data Change Control

| Entity | Change Type | Control Required |
|---|---|---|
| Product | SKU | Immutable after activation; requires new product + discontinue old |
| Product | Price | Versioned; old price preserved; change logged with actor |
| Product | Status | Activation requires manager approval |
| Customer | PII (name, phone, email) | Audit logged; GDPR erasure → anonymization |
| Supplier | Status (suspend/inactive) | Procurement manager approval required |
| Vehicle | License plate | Manager approval (legal document change) |
| Employee | Status (terminate) | HR manager; PII governance applies |

---

## 5. Master Data Deduplication Strategy

| Entity | Deduplication Key | Enforcement |
|---|---|---|
| Product | (company_id, sku) | Unique constraint; validation on create |
| RawMaterial | (company_id, material_code) | Unique constraint |
| Customer | (company_id, phone) + (company_id, email) | Both enforced; system suggests merge for duplicates |
| Supplier | (company_id, tax_id) when provided | Advisory check; not hard constraint |
| Warehouse | (company_id, warehouse_code) | Unique constraint |
| Vehicle | (company_id, license_plate) | Unique constraint |
