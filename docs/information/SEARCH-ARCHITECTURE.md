# Search Architecture

**Document:** SEARCH-ARCHITECTURE  
**Version:** 1.0  
**Status:** APPROVED — Architecture Only  
**Date:** 2026-07-05  
**Task:** TASK-INFORMATION-ARCH-001  
**Parent:** ENTERPRISE-INFORMATION-ARCHITECTURE.md

---

## 1. Search Platform

ECOS uses **Meilisearch** as the dedicated search platform. Meilisearch is a fast, typo-tolerant, relevance-ranked search engine well-suited for enterprise workspaces with large datasets.

**PostgreSQL is NOT the search engine.** Full-text search on PostgreSQL is reserved for simple `LIKE` queries on small datasets. All significant search — product catalog, customer lookup, order search — goes through Meilisearch.

---

## 2. Search Architecture

```
Operational Store (PostgreSQL)
         │
         │ Domain events trigger indexing
         ▼
┌──────────────────────────────────────────┐
│  SEARCH INDEXING LAYER                   │
│  Event listeners → index queue → indexer │
│  Batch indexer (initial + rebuild)       │
└──────────────┬───────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────┐
│  MEILISEARCH                             │
│  Per-entity search indexes               │
│  Company-scoped (company_id filter)      │
└──────────────┬───────────────────────────┘
               │
               ▼
API Layer (Query Contracts) → UI Search
```

---

## 3. Search Index Catalog

### IDX-001: Products Index
```
Index Name:     products_{company_id}  (or shared index with company_id filter attribute)
Indexed Fields:
  searchable:   name, sku, description, category_name, tags
  filterable:   company_id, status, category_id, is_available, channel_ids
  sortable:     name, created_at, price
  display:      id, sku, name, status, available_qty, price, image_url, category_name
Indexing Trigger: Product created, name/SKU/category changed, status changed, availability changed
Rebuild Strategy: Full rebuild on category rename; delta on individual product changes
```

### IDX-002: Raw Materials Index
```
Index Name:     raw_materials_{company_id}
Indexed Fields:
  searchable:   name, material_code, description, category_name
  filterable:   company_id, status, category_id, unit_id
  sortable:     name, created_at
  display:      id, material_code, name, status, available_qty, unit_name, category_name
Indexing Trigger: RawMaterial created, name/code/category changed, status changed
```

### IDX-003: Customers Index
```
Index Name:     customers_{company_id}
Indexed Fields:
  searchable:   name, phone, email, customer_code (PII fields — see privacy note)
  filterable:   company_id, status, risk_level, tags
  sortable:     name, created_at, lifetime_value
  display:      id, customer_code, name, phone (masked), status, lifetime_value
Privacy Note:   Full PII only indexed for internal search; public search uses masked versions
                Customer name and phone stored in search index but not exported in bulk
Indexing Trigger: Customer created, name/phone/email/status changed
```

### IDX-004: Orders Index
```
Index Name:     orders_{company_id}
Indexed Fields:
  searchable:   order_number, customer_name, channel_name
  filterable:   company_id, status, channel_id, warehouse_id, created_date, customer_id
  sortable:     created_at, total_amount, status
  display:      id, order_number, customer_name, status, total_amount, created_at, channel_name
Indexing Trigger: Order confirmed, status changed, customer name changed (from CRM event)
```

### IDX-005: Suppliers Index
```
Index Name:     suppliers_{company_id}
Indexed Fields:
  searchable:   name, supplier_code, contact_name, contact_phone
  filterable:   company_id, status, category_ids
  sortable:     name, health_score, created_at
  display:      id, supplier_code, name, status, health_score, contact_name
Indexing Trigger: Supplier created, name/status/contact changed, health score updated
```

### IDX-006: Recipes Index
```
Index Name:     recipes_{company_id}
Indexed Fields:
  searchable:   name, recipe_code, product_name, category_name
  filterable:   company_id, status, category_id, eligible_for_production
  sortable:     name, recipe_cost, created_at
  display:      id, recipe_code, name, product_name, status, recipe_cost
Indexing Trigger: Recipe created, name/status/cost changed
```

---

## 4. Index Lifecycle

| Stage | When | Action |
|---|---|---|
| **Initial Index** | When a company first activates a module | Full table scan → batch index all existing records |
| **Delta Index** | On domain events | Event listener queues individual record for re-indexing |
| **Rebuild** | Manual trigger (after schema change or index corruption) | Truncate index; full re-index from PostgreSQL |
| **Company Isolation** | Always | company_id is always a filter attribute; every query includes it |

---

## 5. Search Query Patterns

### Global Search (Cmd+K)
```
Scope:      All enabled indexes for company
Query:      Free text across all indexes
Results:    Grouped by entity type; max 3 per type
Ranking:    Relevance score; most recently active first on tie
```

### Module-Level Search
```
Scope:      Single entity index
Query:      Free text + applied filters from Smart Toolbar
Results:    Paginated (20 per page default)
Ranking:    Relevance, then sort field
```

### Autocomplete / Typeahead
```
Scope:      Specific index (e.g. customer lookup in order creation)
Query:      Prefix match; min 2 characters before triggering
Results:    Max 8 suggestions; displayed in dropdown
Performance: < 50ms
```

---

## 6. Search Governance

| Rule | Statement |
|---|---|
| **SEARCH-GOV-001** | Search indexes are projections; source of truth is always PostgreSQL |
| **SEARCH-GOV-002** | company_id is always a required filter; no cross-tenant search is possible |
| **SEARCH-GOV-003** | PII in search indexes follows DATA-CLASSIFICATION.md handling rules |
| **SEARCH-GOV-004** | Search indexes must be rebuildable from PostgreSQL data without data loss |
| **SEARCH-GOV-005** | Search index schema changes are backward compatible; rebuilds are always possible |
| **SEARCH-GOV-006** | Financial data (amounts, costs) is not the authoritative source in search indexes; always confirm from PostgreSQL before financial operations |
