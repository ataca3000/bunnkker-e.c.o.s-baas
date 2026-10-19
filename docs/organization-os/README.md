# Organization OS V2.2 — Design Documents

**ADR:** ADR-011 V2.2  
**Status:** APPROVED FOR IMPLEMENTATION  
**Date:** 2026-07-05  
**Supersedes:** V2.1 (Business Account added, channel_type not yet defined)

## Documents

| Doc | Purpose |
|---|---|
| [DOMAIN-MODEL.md](DOMAIN-MODEL.md) | Entity definitions — Company, Brand, Business Account, Sales Channel, Warehouse |
| [MIGRATION-PLAN.md](MIGRATION-PLAN.md) | Phased migration P0–P5: Brand → Business Account → Sales Channels → Warehouse decouple |
| [DEPENDENCY-MATRIX.md](DEPENDENCY-MATRIX.md) | Module dependencies, blast radius, API changes, event payload changes |
| [REFACTOR-PLAN.md](REFACTOR-PLAN.md) | Work packages WP-ORG-001 to WP-ORG-008 |
| [RISK-ASSESSMENT.md](RISK-ASSESSMENT.md) | Risk matrix + mitigation (R-001 to R-012) |

## Hierarchy (V2.2 — Final)

```
Company (COM-000001)
│
├── Brands (BRD-000001)                          ← Commercial Identity
│      │
│      ├── Business Accounts (BA-000001)          ← Integration Root
│      │        │
│      │        ├── Sales Channels (CH-000001)    ← Operational Selling Endpoint
│      │        ├── Advertising Assets
│      │        ├── Catalogs
│      │        ├── Integrations
│      │        ├── Credentials
│      │        ├── Webhooks
│      │        └── Sync Settings
│      │
│      └── Brand Settings
│
├── Warehouses (WH-000001)                        ← Operational Location (Company-direct)
│
├── Teams (TM-000001)
│
├── Users
│
├── Roles & Permissions
│
└── Organization Settings
```

Branch is deprecated. No new code may reference `branches.id`.

## Ownership Matrix

| Entity | Owner Module |
|---|---|
| Company | Organization OS |
| Brand | Organization OS |
| Business Account | Organization OS |
| Sales Channel | Organization OS |
| Warehouse | Organization OS |
| Team | Organization OS |
| User | IAM |
| Product | Commerce OS |
| Product Publication | Commerce OS |

## channel_type Values

`website` · `marketplace` · `social_commerce` · `pos` · `b2b` · `custom`

## Key V2.2 Changes from V2.1

| Change | V2.1 | V2.2 |
|---|---|---|
| Entity name | Channel | **Sales Channel** |
| Channel type field | Not defined | **channel_type enum** |
| BA expanded ownership | Credentials + Settings | **+ Webhooks + Sync Settings + Catalogs + Advertising Assets** |
| Product ownership | Implicit | **Explicit: Company only** |
| Product Publication | Not documented | **Reserved by Organization; owned by Commerce OS** |
| WP sequence | WP-001 to 008 (branch migration focus) | **WP-001 to 008 (commerce + marketing integration included)** |
| Implementation status | Design only | **APPROVED FOR IMPLEMENTATION** |

## Implementation Sequence

```
WP-ORG-001   Brand Module
     ↓
WP-ORG-001B  Business Account Module
     ↓
WP-ORG-002   Sales Channels Refactor
     ↓
WP-ORG-003   Warehouses Refactor
     ↓
WP-ORG-004   Companies Workspace
     ↓
WP-ORG-005   Teams + Users + Permissions
     ↓
WP-ORG-006   Commerce Integration
WP-ORG-007   Marketing Integration
     ↓
WP-ORG-008   Legacy Branch Removal
```

## Implementation Gate

**ADR-011 V2.2 is APPROVED FOR IMPLEMENTATION.**  
Work begins with **WP-ORG-001** — Brand module scaffold and migration.
