# ECOS Enterprise Platform Services (EPS)

**Document:** ENTERPRISE-PLATFORM-SERVICES  
**Version:** 1.0  
**Status:** APPROVED — Architecture Freeze  
**Date:** 2026-07-05  
**Task:** TASK-EPS-ARCH-001

---

## 1. What Are Enterprise Platform Services?

Enterprise Platform Services (EPS) are the **shared infrastructure layer** of ECOS. They provide capabilities used by every Operating System, every Decision Engine, and every AI component — without being owned by any one of them.

EPS is not business logic.  
EPS is not domain-specific.  
EPS is the foundation everything else builds on.

### The Four Services

| Service | Code | Purpose |
|---|---|---|
| Enterprise Event Platform | EPS-01 | Unified business event bus — the backbone of cross-module communication |
| Enterprise Timeline Platform | EPS-02 | Unified chronological history for every business object |
| Enterprise Document Platform | EPS-03 | Centralized document and file management for all business objects |
| Enterprise Notification Platform | EPS-04 | Unified, policy-driven notification delivery across all channels |

---

## 2. Why EPS Exists

Without shared platform services, every business module independently builds:
- Its own event bus (incompatible schemas, no correlation)
- Its own activity log (fragmented history, no unified timeline)
- Its own file storage (duplicate files, no versioning)
- Its own notification system (no consistent policies, no rate limiting)

This leads to:
- **Fragmentation** — identical capabilities built 12 times differently
- **Inconsistency** — customers see different notification formats per module
- **Unmaintainability** — bug in notification logic must be fixed in 12 places
- **Opacity** — no unified timeline means no single source of truth for business object history

EPS eliminates all of these problems by providing each capability once, correctly.

---

## 3. Platform Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        BUSINESS LAYER                               │
│  Commerce │ Inventory │ Manufacturing │ Procurement │ POS │ CRM    │
│  Preparation OS │ Loading OS │ Packing OS │ Logistics OS           │
└───────────────────────────────┬─────────────────────────────────────┘
                                │ Business Events
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│              ENTERPRISE PLATFORM SERVICES (EPS)                     │
│                                                                     │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  │
│  │  EPS-01          │  │  EPS-02          │  │  EPS-03          │  │
│  │  Enterprise      │  │  Enterprise      │  │  Enterprise      │  │
│  │  Event Platform  │  │  Timeline        │  │  Document        │  │
│  │                  │  │  Platform        │  │  Platform        │  │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘  │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  EPS-04 — Enterprise Notification Platform                   │   │
│  └──────────────────────────────────────────────────────────────┘   │
└───────────────────────────────┬─────────────────────────────────────┘
                                │ Services + Governance
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│              CORE PLATFORM LAYER                                    │
│  Configuration Platform │ Policy Engine │ Rule Engine               │
│  Feature Management │ Identity Platform │ Audit Platform            │
│  AI Platform │ Decision Engines                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 4. EPS Service Summaries

### EPS-01 — Enterprise Event Platform

Every important business action produces an immutable **BusinessEvent**. Events are published to the platform. Modules subscribe to events they care about. No module directly calls another module for business workflow.

> Full specification: `ENTERPRISE-EVENT-PLATFORM.md`

### EPS-02 — Enterprise Timeline Platform

Every business object (Order, Customer, Vehicle, Product, etc.) has a unified chronological timeline. Timeline entries are generated automatically from Events, supplemented by Comments, Approvals, Assignments, and AI Recommendations. Cross-module, immutable, searchable.

> Full specification: `ENTERPRISE-TIMELINE-PLATFORM.md`

### EPS-03 — Enterprise Document Platform

All documents, images, PDFs, invoices, delivery proofs, contracts, and files are stored in one place. Documents attach to Business Objects (not modules). Versioned, permissioned, audited, virus-scanned. Storage provider abstraction means switching from S3 to any provider requires no application code change.

> Full specification: `ENTERPRISE-DOCUMENT-PLATFORM.md`

### EPS-04 — Enterprise Notification Platform

All notifications across all channels (In-App, Email, SMS, WhatsApp, Push, Webhook) flow through a single, policy-driven platform. Notification behavior (priority, escalation, retry, rate limits, working hours) is configured via the Policy Engine — never hardcoded.

> Full specification: `ENTERPRISE-NOTIFICATION-PLATFORM.md`

---

## 5. Cross-Platform Integration Matrix

| EPS Service | Configuration Platform | Policy Engine | AI Platform | Audit Platform | Identity Platform | Feature Management |
|---|---|---|---|---|---|---|
| **EPS-01 Events** | Reads event retention policies | Reads EventPolicy | AI subscribes; produces AI events | Event records are immutable audit | Events carry actor_id | `modules.event_platform` |
| **EPS-02 Timeline** | Reads retention + display config | — | AI Recommendations appear as entries | Timeline is append-only | User links on entries | `modules.timeline` |
| **EPS-03 Documents** | Reads storage, retention, scan config | Reads DocumentPolicy | AI generates documents (future) | Every upload/version is audited | Permissions per user | `modules.document_platform` |
| **EPS-04 Notifications** | Reads channel config, rate limits | **Reads NotificationPolicy** | AI-triggered recommendations | Every delivery attempt audited | Role targeting | `modules.notification_platform` |

---

## 6. EPS Architecture Governance

The following governance rules extend the existing GOV-001–010 from the Configuration Platform.

| Rule | Constraint |
|---|---|
| GOV-011 | Business communication between modules occurs exclusively through Enterprise Events (EPS-01) |
| GOV-012 | Timeline (EPS-02) is generated from Events and Audit Records; no module builds its own activity log |
| GOV-013 | Documents are attached to Business Objects, not modules; all files go through EPS-03 |
| GOV-014 | Notifications are triggered by Events and Policies; no module sends its own notifications |
| GOV-015 | AI consumes Events from EPS-01 and produces Recommendations; AI never queries operational modules directly |
| GOV-016 | No Business OS may implement its own event bus, timeline, document repository, or notification engine |

---

## 7. What EPS Is NOT

| Excluded Concern | Belongs To |
|---|---|
| Business rules | Policy Engine / Decision Engines |
| Inventory tracking | Inventory Module |
| Order management | Commerce Module |
| Configuration storage | Configuration Platform |
| Identity and auth | Identity Platform |
| Reporting and analytics | Analytics Platform |
| Specific workflow decisions | Business OS modules |

EPS never contains business logic. If it does, that is a boundary violation.

---

## 8. DDD Module Structure

```
Modules/
└── Core/
    └── EnterpriseServices/
        ├── EventPlatform/              (EPS-01)
        │   ├── Domain/
        │   │   ├── Models/
        │   │   │   ├── BusinessEvent.php
        │   │   │   └── EventSubscription.php
        │   │   └── Contracts/
        │   │       ├── EventPublisherContract.php
        │   │       └── EventSubscriberContract.php
        │   └── Application/
        │       └── Services/
        ├── TimelinePlatform/           (EPS-02)
        │   ├── Domain/
        │   │   └── Models/
        │   │       └── TimelineEntry.php
        │   └── Application/
        │       └── Services/
        ├── DocumentPlatform/           (EPS-03)
        │   ├── Domain/
        │   │   └── Models/
        │   │       ├── Document.php
        │   │       ├── DocumentVersion.php
        │   │       └── DocumentRelationship.php
        │   └── Application/
        │       └── Services/
        └── NotificationPlatform/       (EPS-04)
            ├── Domain/
            │   └── Models/
            │       ├── Notification.php
            │       └── NotificationDelivery.php
            └── Application/
                └── Services/
```

---

## 9. Architecture Freeze Declaration

> **ECOS Enterprise Architecture v1.0 — Architecture Freeze**  
> **Effective:** 2026-07-05  
> **Status:** OFFICIAL

With the completion of TASK-EPS-ARCH-001, the ECOS Enterprise Architecture v1.0 is declared **frozen**.

The complete architecture consists of:

| Layer | Documents |
|---|---|
| **Enterprise Platform Services** | ENTERPRISE-PLATFORM-SERVICES.md + 4 EPS specs |
| **Configuration & Policy Platform** | ENTERPRISE-CONFIGURATION-PLATFORM.md + 6 component specs |
| **Enterprise Fulfillment Platform** | ADR-015 + ENTERPRISE-FULFILLMENT-PLATFORM.md + 8 specs |
| **Decision Engines** | GEOGRAPHY-COVERAGE-ENGINE.md + VEHICLE-PLANNING-ENGINE.md + PRODUCT-ALLOCATION-ENGINE.md + PARTIAL-FULFILLMENT-RULES.md |
| **Operational Domain** | Operations-Planning.md + Operations ADRs (ADR-006/008/009/010/012/013/015) |
| **AI Platform** | AI-DATA-ARCHITECTURE.md |
| **Enterprise Domain Model** | docs/domain/ENTERPRISE-DOMAIN-MODEL.md + 9 sub-documents |
| **Enterprise UX Architecture** | docs/ux/ENTERPRISE-UX-ARCHITECTURE.md + 11 standards |

### What "Architecture Freeze" Means

**Frozen (requires formal ADR + CTO approval to change):**
- Foundational architectural layers and their boundaries
- Cross-cutting governance rules (GOV-001 to GOV-016)
- EPS service boundaries
- Configuration Platform scope hierarchy
- Event schema structure
- Decision Engine patterns

**Not frozen (normal delivery work continues):**
- UI/UX design and implementation
- Database schema design and migrations
- API design and implementation
- Feature packages and implementation sprints
- Module-level implementation details
- AI model training and integration

**Process for architectural change:**
1. Propose a new ADR (e.g., ADR-016)
2. CTO review and approval
3. Update affected architecture documents
4. Update memory index

---

## 11. Enterprise Domain Model Dependency (TASK-DOMAIN-ARCH-001)

Every EPS service is domain-agnostic by design. The Enterprise Domain Model defines which aggregates produce events (EPS-01), have timelines (EPS-02), may have documents (EPS-03), and receive notifications (EPS-04).

| EPS Service | Domain Model Integration |
|---|---|
| EPS-01 | Every Aggregate Root from AGGREGATE-CATALOG.md produces events listed in DOMAIN-EVENT-CATALOG.md |
| EPS-02 | Every Aggregate Root has a Timeline keyed by (object_type, object_id) per ENTITY-CATALOG.md |
| EPS-03 | Any Aggregate Root may have Documents attached (polymorphic) |
| EPS-04 | Domain Events from DOMAIN-EVENT-CATALOG.md are the source triggers for Notifications |

> Full Domain Model: `docs/domain/ENTERPRISE-DOMAIN-MODEL.md`

---

## 10. Enterprise UX Architecture Dependency (TASK-UX-ARCH-001)

With the completion of TASK-UX-ARCH-001, all four EPS services have defined UX standards. The UX layer sits **above** the EPS layer and consumes it.

| EPS Service | UX Standard | How EPS Powers the UX |
|---|---|---|
| EPS-01 Event Platform | SMART-TOOLBAR-STANDARD.md | Smart Action Chips update in real-time from EPS-01 events |
| EPS-01 Event Platform | DATAGRID-STANDARD.md | AI Insights column flags are EPS-01 event-driven |
| EPS-02 Timeline Platform | TIMELINE-UX-STANDARD.md | Timeline tab in every drawer is powered by EPS-02 |
| EPS-03 Document Platform | DOCUMENTS-UX-STANDARD.md | Documents tab in every drawer is powered by EPS-03 |
| EPS-04 Notification Platform | NOTIFICATION-UX-STANDARD.md | Notification Bell, Toast, and Enterprise Inbox are powered by EPS-04 |
| EPS-01 + AI | AI-UX-STANDARD.md | AI Insights panel and AI Assistant consume EPS-01 events |

The Enterprise UX Architecture is defined in `docs/ux/`. See `docs/ux/ENTERPRISE-UX-ARCHITECTURE.md`.

### UX Governance Note

GOV-011: EPS services provide data and events; they never implement UI.  
GOV-012: UI components consume EPS services through defined contracts; never directly.  
UX-GOV-010: The Timeline UX is identical in every drawer — EPS-02 is the single source of truth.  
UX-GOV-011: The Documents UX is identical in every drawer — EPS-03 is the single source of truth.

---

## 12. Enterprise Contract Architecture Dependency (TASK-CONTRACT-ARCH-001)

The Enterprise Integration Contracts define the formal published interfaces for all four EPS services. Every consumer of an EPS service must use the published Service Contract, not call the service internals directly.

| EPS Service | Service Contract | Governance |
|---|---|---|
| EPS-01 EventPublisherService | SVC-EPS-01 | CON-GOV-001: no module reaches into another module's internals |
| EPS-02 TimelineService | SVC-EPS-02 | CON-GOV-010: all contracts registered in INTEGRATION-CATALOG.md |
| EPS-03 DocumentService | SVC-EPS-03 | CON-GOV-005: every service contract references its owner |
| EPS-04 NotificationService | SVC-EPS-04 | CON-GOV-007: breaking changes increment major version |

> Full Contract Architecture: `docs/contracts/ENTERPRISE-CONTRACTS.md`  
> Service Contracts: `docs/contracts/SERVICE-CONTRACTS.md`  
> Integration Catalog: `docs/contracts/INTEGRATION-CATALOG.md`

---

## 13. Database Engineering Standards Dependency (TASK-DATABASE-ENGINEERING-001)

EPS platform tables are subject to the full Database Engineering Standards. Key implications:

| EPS Table | Identity | Partitioned | Notes |
|---|---|---|---|
| `business_events` | ULID | Monthly range | EPS-01; high-volume append-only |
| `timeline_entries` | ULID | Monthly range | EPS-02; append-only |
| `documents` | UUID | No | EPS-03; bounded volume |
| `notification_deliveries` | ULID | Monthly range | EPS-04; high-volume |

**Mandatory standards applied to all EPS tables:**
- `ENG-GOV-001`: Column naming follows DATABASE-NAMING-CONVENTIONS.md
- `ENG-GOV-003`: All migrations follow MIGRATION-STANDARDS.md
- `ENG-GOV-006`: Database Security Standards (ecos_app role, PII encryption)
- `CHG-001`: All EPS schema changes go through DATABASE-CHANGE-POLICY.md classification

> Full Standards: `docs/engineering/DATABASE-ENGINEERING-STANDARDS.md`  
> Migration Standards: `docs/engineering/MIGRATION-STANDARDS.md`  
> Partitioning Strategy: `docs/data/DATA-PARTITIONING-STRATEGY.md`
