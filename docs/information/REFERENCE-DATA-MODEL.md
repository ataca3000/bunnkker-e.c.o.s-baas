# Reference Data Model

**Document:** REFERENCE-DATA-MODEL  
**Version:** 1.0  
**Status:** APPROVED — Architecture Only  
**Date:** 2026-07-05  
**Task:** TASK-INFORMATION-ARCH-001  
**Parent:** ENTERPRISE-INFORMATION-ARCHITECTURE.md

---

## 1. What Is Reference Data?

Reference data provides the standardized vocabulary of the system — the lookup values, codes, and classifications that all other data references. Reference data changes very rarely, is centrally owned, and is shared across all domains.

**Characteristics:**
- Finite, enumerable sets of values
- Owned by Platform or Organization (never by a feature module)
- Changes rarely — a new Currency or Country is an exceptional event
- Versioned when it changes (existing references must not break)
- Many-to-one relationship: thousands of transactions reference a small set of reference values

---

## 2. Reference Data Catalog

### 2.1 Geographic Reference Data
```
Entity: Country
  Owner: Platform (global, not company-scoped)
  Identity: ISO 3166-1 alpha-2 code (e.g. EG, US, SA)
  Fields: code, name_en, name_ar, phone_prefix, currency_code
  Change: Added when ECOS expands to a new market

Entity: Governorate (Egyptian administrative divisions)
  Owner: Platform
  Identity: system UUID + governorate_code
  Fields: code, name_en, name_ar, country_code
  Note: Used for delivery zone mapping, coverage engine

Entity: DeliveryZone
  Owner: Logistics (company-scoped)
  Identity: (company_id, zone_code)
  Fields: zone_code, name, governorate_ids[], polygon_data (future)
  Note: Company-defined geographic grouping for delivery routing
```

### 2.2 Currency Reference Data
```
Entity: Currency
  Owner: Platform (global)
  Identity: ISO 4217 code (e.g. EGP, USD, SAR)
  Fields: code, name_en, name_ar, symbol, decimal_places
  Note: EGP is the primary currency; all Money values store currency code
  Change: New currency added when entering a new market
```

### 2.3 Unit of Measure Reference Data
```
Entity: Unit
  Owner: Organization (company-scoped — companies define their own units)
  Identity: UUID
  Business Key: (company_id, unit_code)
  Fields: unit_code, name_en, name_ar, unit_type (weight|volume|length|count|area)
  Predefined examples:
    KG  — Kilogram (weight)
    G   — Gram (weight)
    L   — Liter (volume)
    ML  — Milliliter (volume)
    PC  — Piece (count)
    PKG — Package (count)
    M   — Meter (length)
    M2  — Square Meter (area)
  Company can add custom units (e.g. "Tray of 30" for their business)
  Immutability: unit_code and unit_type are immutable once used in a transaction
```

### 2.4 Category Reference Data
```
Entity: Category
  Owner: Inventory (company-scoped)
  Identity: UUID
  Business Key: (company_id, category_scope, category_code)
  Fields: category_scope (product|material), name_en, name_ar, parent_id (nullable for hierarchy)
  Governance: Categories are hierarchical (max 3 levels); leaf categories are used on entities
  Note: category_scope separates product categories from material categories — cross-scope assignment is forbidden
```

### 2.5 Tax Reference Data
```
Entity: TaxRate
  Owner: Finance (company-scoped)
  Identity: UUID
  Fields: name, rate (percentage), applies_to (product|service|all), effective_from, effective_to
  Note: Egypt VAT = 14%; Tax rates are versioned with effective dates
```

### 2.6 Payment Method Reference Data
```
Entity: PaymentMethod
  Owner: Platform (predefined enum)
  Values: cash, card, bank_transfer, cheque, digital_wallet, cod
  Note: Not stored as a table — a validated enum in application layer
```

### 2.7 Status Reference Data
```
Note: Statuses are NOT stored as a lookup table. Each aggregate defines its own status
model as an enum in the application layer. The lifecycle models are defined in
LIFECYCLE-MODELS.md. No generic "statuses" table exists.
```

---

## 3. Reference Data Governance

| Rule | Statement |
|---|---|
| **REF-GOV-001** | Global reference data (Country, Currency) is owned by Platform; company admins cannot modify it |
| **REF-GOV-002** | Company-scoped reference data (Unit, Category) is owned by the company admin |
| **REF-GOV-003** | Reference data used in transactions is immutable — only new values can be added, existing values cannot be removed |
| **REF-GOV-004** | Reference data changes do not require a new schema version; they are additive row insertions |
| **REF-GOV-005** | All reference data is seeded from a canonical source in migrations; no module creates ad-hoc reference values |

---

## 4. Seeding Strategy

Reference data is maintained in seed files, not hardcoded in application logic.

| Dataset | Source | Update Frequency |
|---|---|---|
| Countries | ISO 3166-1 alpha-2 dataset | When entering new market |
| Governorates | Egyptian government data | Rarely — administrative change |
| Currencies | ISO 4217 | When entering new market |
| Default Units | Predefined in migration | Company can supplement |
| Tax Rates | Company configuration | When tax law changes |
| Categories | Company-defined at setup | Ongoing |
