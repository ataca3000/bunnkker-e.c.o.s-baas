# ECOS Enterprise UX Architecture

**Document:** ENTERPRISE-UX-ARCHITECTURE  
**Version:** 1.0  
**Status:** APPROVED — Architecture Only  
**Date:** 2026-07-05  
**Task:** TASK-UX-ARCH-001

---

## 1. Mission

> Create one unified UX language across all ECOS Operating Systems, so that the user never feels they are working inside a large ERP — they always feel they are working inside **one workspace**.

This document is the authoritative architecture for the ECOS Enterprise User Experience. Every module, OS, and future feature must conform to this architecture. No module creates its own UX framework. No screen deviates from the standards defined here without a formal approval.

---

## 2. Design Principles

| # | Principle | Meaning |
|---|---|---|
| 1 | **Enterprise First** | Designed for power users who use ECOS 8 hours a day. Not for occasional visitors. |
| 2 | **Workflow First** | Screens are designed around workflows, not database tables. |
| 3 | **Data First** | Show the data. Remove chrome, decoration, and noise. Every pixel must earn its place. |
| 4 | **Action First** | Every screen has a clear, prominent primary action. Users should never wonder what to do next. |
| 5 | **Keyboard First** | Every interaction is keyboard-accessible. Power users never need the mouse. |
| 6 | **Mobile First** | Every workspace is fully functional on mobile. Desktop adds power, not baseline capability. |
| 7 | **AI Assisted** | AI is embedded everywhere — but never intrusive. It surfaces when it has something useful to say. |
| 8 | **Zero Learning Curve** | A user who knows one ECOS module should instantly feel at home in any other. |
| 9 | **Maximum Three Clicks** | Any action must be reachable in 3 clicks or fewer from the current context. |
| 10 | **Progressive Disclosure** | Simple by default. Power features reveal themselves as the user advances. |

---

## 3. UX Philosophy

The user should never feel that ECOS is a large ERP.  
The user should always feel they are working inside **one workspace**.

**The three feelings ECOS must produce:**

1. **"I know where I am"** — Navigation is always clear. Context is always visible. I can always get back.
2. **"I know what to do"** — Every screen has a primary action. Exceptions and tasks surface automatically.
3. **"The system is helping me"** — AI suggestions appear when relevant. Patterns are detected. Predictions are offered.

**What ECOS must NEVER feel like:**

- A collection of disconnected modules
- A form-heavy data entry system
- An ERP that requires a 2-day training course
- A desktop application frozen in 2010

---

## 4. Enterprise Workspace Model

Every ECOS module, OS, and workspace uses the same architectural hierarchy:

```
┌─────────────────────────────────────────────────────────────────┐
│  WORKSPACE                                                      │
│  Module identity + global context (company, channel, date)     │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  SMART TOOLBAR                                          │   │
│  │  Views · Filters · Bulk Actions · AI Suggestions        │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │  CONTEXT PANEL                                          │   │
│  │  KPI Cards · Status Tabs · Active Filters               │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │  MAIN GRID / BOARD / CANVAS                             │   │
│  │  Primary data view — list, kanban, calendar, or map     │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘

When a row/item is selected → DETAIL DRAWER opens:
┌──────────────────────────────────────���
│  DETAIL DRAWER                       │
│  Summary · Timeline · Documents      │
│  AI Insights · Relationships         │
│  History · Configuration             │
└──────────────────────────────────────┘

Overlay layers (context-persistent):
├── AI ASSISTANT — available on any screen via hotkey or panel
├── NOTIFICATION CENTER — global, always accessible
├── ACTION CENTER — floating task queue
└── COMMAND PALETTE — Cmd+K anywhere
```

---

## 5. UX Component Architecture

### 5.1 The 12 UX Standards

| Component | Standard Document | Governs |
|---|---|---|
| **Workspace** | `WORKSPACE-FRAMEWORK.md` | Page layout, tabs, KPIs, workspace memory |
| **Navigation** | `NAVIGATION-SYSTEM.md` | Module Rail, Context Sidebar, Search, Breadcrumbs |
| **Design Language** | `ENTERPRISE-DESIGN-LANGUAGE.md` | Tokens, typography, color, spacing, motion |
| **Smart Toolbar** | `SMART-TOOLBAR-STANDARD.md` | Views, filters, actions, import/export |
| **DataGrid** | `DATAGRID-STANDARD.md` | Columns, sorting, selection, editing, aggregation |
| **Detail Drawer** | `DETAIL-DRAWER-STANDARD.md` | Entity detail, tabs, actions, sizes |
| **Timeline** | `TIMELINE-UX-STANDARD.md` | Activity history, entry types, interactions |
| **Documents** | `DOCUMENTS-UX-STANDARD.md` | File display, upload, preview, versions |
| **AI UX** | `AI-UX-STANDARD.md` | Recommendations, summaries, Ask AI, decisions |
| **Notifications** | `NOTIFICATION-UX-STANDARD.md` | Alerts, inbox, delivery, preferences |
| **Mobile** | `MOBILE-UX-STANDARD.md` | Responsive, touch, offline, accessibility |

---

## 6. Role-Based UX

ECOS serves 6 user roles. Each role has a different default experience.

| Role | Primary Need | Default View | Key Features |
|---|---|---|---|
| **Operator** | Execute tasks efficiently | Task queue + execution screens | Action-heavy UI, keyboard shortcuts, batch operations |
| **Supervisor** | Monitor and resolve exceptions | Exception dashboard + approvals | Exception-first, approval workflows, team visibility |
| **Manager** | Plan and oversee | KPI dashboard + planning tools | Summary cards, trend charts, batch planning |
| **Executive** | Strategic overview | Analytics dashboard | High-level KPIs, no operational detail |
| **Administrator** | Configure the system | Configuration OS | Settings, policies, user management, audit |
| **AI Operator** | Manage AI recommendations | AI platform dashboard | Model performance, recommendation review, confidence tuning |

### Role Customization Rules

- Every workspace **shows role-appropriate defaults** — an Operator sees execution tools; an Executive sees summaries
- Roles are **not restrictive** — users can navigate anywhere they have permission
- Role-appropriate defaults are **personalization suggestions**, not hard limits
- Power users can override any default view preference

---

## 7. Cross-Module Consistency

The following UX elements must appear **identical** across all modules:

| Element | Standard | Notes |
|---|---|---|
| Smart Toolbar | `SMART-TOOLBAR-STANDARD.md` | Same layout, same button positions, same keyboard shortcuts |
| Detail Drawer | `DETAIL-DRAWER-STANDARD.md` | Same drawer sizes, same tab structure, same header format |
| Timeline | `TIMELINE-UX-STANDARD.md` | Same entry types, same visual treatment, same interactions |
| Document section | `DOCUMENTS-UX-STANDARD.md` | Same upload button, same preview, same version history |
| AI panel | `AI-UX-STANDARD.md` | Same panel position, same confidence indicators, same override flow |
| Notification center | `NOTIFICATION-UX-STANDARD.md` | Same bell icon, same panel, same notification anatomy |
| DataGrid | `DATAGRID-STANDARD.md` | Same column types, same sort behavior, same selection patterns |
| Status badges | `ENTERPRISE-DESIGN-LANGUAGE.md` | Same badge styles, same color semantics |
| Action menus | `ENTERPRISE-DESIGN-LANGUAGE.md` | Same dropdown structure, same icon positions |
| Empty states | `ENTERPRISE-DESIGN-LANGUAGE.md` | Same empty state layout and copy conventions |

---

## 8. UX Governance Rules

The following rules are enforced in all ECOS UI/UX decisions. They extend the business governance rules (GOV-001 to GOV-016).

| Rule | Statement |
|---|---|
| **UX-GOV-001** | Every Business Object opens in a Detail Drawer — never a full page by default |
| **UX-GOV-002** | Every module uses the Universal Smart Toolbar — no custom toolbars allowed |
| **UX-GOV-003** | Timeline layout is identical across all modules — governed by TIMELINE-UX-STANDARD |
| **UX-GOV-004** | AI interactions follow AI-UX-STANDARD — no module implements its own AI UX |
| **UX-GOV-005** | Navigation follows NAVIGATION-SYSTEM — no module creates its own navigation pattern |
| **UX-GOV-006** | No module creates its own UI framework, component library, or design token set |
| **UX-GOV-007** | All visual values (colors, spacing, typography) come exclusively from design tokens |
| **UX-GOV-008** | DataGrid follows DATAGRID-STANDARD — no custom table implementations |
| **UX-GOV-009** | Document display follows DOCUMENTS-UX-STANDARD across all modules |
| **UX-GOV-010** | Notification display follows NOTIFICATION-UX-STANDARD |
| **UX-GOV-011** | Every module must pass mobile viewport review before any feature is considered complete |
| **UX-GOV-012** | Every workspace follows WORKSPACE-FRAMEWORK — deviations require formal architecture review |

---

## 9. Implementation Relationship

This document governs **architecture**. The implementation layer lives in `docs/ui/`.

| Layer | Location | Contains |
|---|---|---|
| UX Architecture (this) | `docs/ux/` | Standards, principles, patterns — implementation-agnostic |
| UI Implementation | `docs/ui/` | Component names, props, localStorage keys, code examples |
| Design System | `frontend/src/components/ds/` | Actual DS components |
| Workspace Implementations | `frontend/src/features/*/` | Module-specific implementations |

UX Architecture is the specification. UI Implementation translates it into code. The two must stay in sync.

---

## 10. Enterprise Experience Phase Roadmap

This task officially starts the **Enterprise Experience Phase**.

| Phase | Status |
|---|---|
| ✅ Enterprise Architecture | Complete (ADR-015 + Config Platform + EPS) |
| ✅ Enterprise Platform Services | Complete (EPS-01 to EPS-04) |
| ✅ Enterprise UX Architecture | **This document** |
| ✅ Enterprise Domain Model | Complete (TASK-DOMAIN-ARCH-001) |
| ⏳ Enterprise Database Design | Next |
| ⏳ Enterprise API Contracts | Following |
| ⏳ Implementation Packages | Following |
| ⏳ Production Development | Final |

---

## 11. Related Documents

- `WORKSPACE-FRAMEWORK.md` — Universal Workspace anatomy and behavior
- `NAVIGATION-SYSTEM.md` — Global navigation architecture
- `ENTERPRISE-DESIGN-LANGUAGE.md` — Design tokens, typography, color system
- `SMART-TOOLBAR-STANDARD.md` — Smart Toolbar specification
- `DATAGRID-STANDARD.md` — Universal DataGrid specification
- `DETAIL-DRAWER-STANDARD.md` — Detail Drawer specification
- `TIMELINE-UX-STANDARD.md` — Timeline UX specification
- `DOCUMENTS-UX-STANDARD.md` — Documents UX specification
- `AI-UX-STANDARD.md` — AI UX specification
- `NOTIFICATION-UX-STANDARD.md` — Notification UX specification
- `MOBILE-UX-STANDARD.md` — Mobile UX specification
- `../ui/workspace-framework.md` — Implementation-level workspace spec (existing)
- `../architecture/ENTERPRISE-PLATFORM-SERVICES.md` — EPS (events, timeline, documents, notifications)
- `../domain/ENTERPRISE-DOMAIN-MODEL.md` — Canonical business model (every entity displayed in UX)
- `../domain/ENTITY-CATALOG.md` — Every entity that has a Detail Drawer in ECOS
- `../domain/LIFECYCLE-MODELS.md` — Status values displayed as badges in the DataGrid
