# TASK-GOLIVE-AUDIT-001 — Enterprise Go-Live Audit

**Type:** Enterprise Functional Audit (audit only — no code changed) · **Priority:** P0 · **Date:** 2026-08-01
**Method:** Read-only static audit of every module (frontend feature dirs + backend Resources/services), cross-checked against enterprise standards. Fan-out review across 22 modules; severities normalized by the auditor (several sub-findings were down-graded from agent-reported levels). Runtime magnitudes not exercised (no seeded data) — findings are structural/functional.

---

## 1. Executive Summary

ECOS has a **strong, enterprise-grade backend and a mature commerce-operations spine**, but it is **NOT ready for a full-platform enterprise go-live** in its current state. The dominant risk is a **"complete backend, absent frontend" gap** in two major areas — **Accounting/Finance** and **advanced CRM** (Service/Tickets, Sales, Loyalty, Customer Intelligence, Executive) — plus **fabricated data on the executive Dashboard** and several **experimental surfaces (AI Platform) that must be hidden**.

The **core commerce & operations flow is genuinely go-live capable**: Orders, Preparation, Fulfillment, Shipping/Logistics, Procurement, POS, Products, and core Inventory are functional, human-readable, and largely free of anti-patterns (the W2 verification blockers — Orders warehouse UUID and the Manufacturing placeholder tab — were already remediated).

**Recommendation: NO-GO for the full platform; CONDITIONAL GO for a scoped "Commerce & Operations Core"** once the go-live blockers below are fixed or the incomplete surfaces are gated/removed from navigation.

**Two cross-cutting known-and-gated items** (from the canonical consolidation, waves 007/007B/008): inventory **value/cost still uses the legacy `material_cost` basis** and **Stock History shows a partial movement set** — both are behind default-OFF flags awaiting seeded dual-run validation. These are documented, not defects introduced here, but they **are go-live-relevant** (numbers must be validated before finance/inventory reporting is trusted).

## 2. Module-by-Module Audit

| # | Module | Score | Readiness | Headline finding |
|---|--------|-------|-----------|------------------|
| 1 | Dashboard | 79 | CONDITIONAL | **Activity Feed = hardcoded mock events; Operations Center = static zeros** (fake exec KPIs) — P0 |
| 2 | Companies | 75 | CONDITIONAL | `CompanyResource.channels_count` hardcoded `0`; placeholder "Activity" tab |
| 3 | Branches | 78 | CONDITIONAL | Coverage-area mgmt UI absent; `default_warehouse_id` orphan risk |
| 4 | Warehouses | 75 | CONDITIONAL | KPI cards count **current page only**, shown as totals; placeholder Activity tab |
| 5 | Products | 82 | CONDITIONAL | Cost source not surfaced; disabled "Restore Channel" w/o reason |
| 6 | Raw Materials | 74 | CONDITIONAL | **`Math.random()` attachment IDs**; attachment upload has **no backend** |
| 7 | Recipes | 74 | CONDITIONAL | **`yield_quantity` missing from form** → per-unit costing broken; `cost_pending` has no resolution UI |
| 8 | Manufacturing (BOMs) | 76 | CONDITIONAL | BOM `manufacturing_cost`/`other_costs` in backend but not exposed in UI |
| 9 | Inventory (core) | 78 | CONDITIONAL | Hardcoded **SAR** currency; value on legacy `material_cost` basis (gated) |
| 10 | Inventory — Stock Transfers | 0 | **NO-GO** | **Phantom module** — placeholder page, no backend create UI |
| 11 | Inventory — Count / Waste | 80 | CONDITIONAL | Hardcoded damage-reason list; SLA/overdue computed client-side |
| 12 | Stock Ledger | 73 | CONDITIONAL | **Partial movement set** (canonical/legacy split, gated); no source drill-down |
| 13 | Procurement + Suppliers | 86 | CONDITIONAL | "Goods to Receive" **placeholder "—" badge**; timelines typed but not rendered |
| 14 | Orders | 88 | **GO** | Clean (W2 blockers already fixed); minor: PO/order state timeline not shown |
| 15 | Customers | 78 | CONDITIONAL | Enriched CRM identity fields not surfaced in form/list; client-side CLV over 200 rows |
| 16 | CRM — advanced (Service, Sales, Loyalty, Intelligence, Executive) | ~52 | **NO-GO** | **Backends complete but no frontend** + Customer-360 missing Service/Loyalty/Sales/Intelligence tabs |
| 17 | Preparation (Wave) | 85 | **GO** | Clean (W2); minor placeholder Automation section (labeled future) |
| 18 | Fulfillment | 82 | **GO** | Clean (W2); minor channel eager-load gap in list |
| 19 | Shipping / Logistics | 85 | **GO** | Strong; dispatch-block reason not surfaced; retry-exhaustion has no escalation UI |
| 20 | Accounting / Finance | 65 | **NO-GO (UI)** | **No frontend at all** (`/accounting` → ComingSoonPage); backend F1–F5 complete & sound |
| 21 | Reports | ~40 | NO-GO | No dedicated reporting UI; finance/CRM reports are backend-only |
| 22 | Analytics | 82 | CONDITIONAL | Dashboard analytics real; `revenue_target` table missing (progress always empty) |
| 23 | Marketing | 78 | CONDITIONAL | Visual workflow canvas "coming soon"; Finance-ROAS placeholders live on exec view |
| 24 | AI Platform (Engineering/Claude Bridge/AI Supervisor) | 55 | **NO-GO / HIDE** | Architecture/stub only, no LLM logic — must be hidden/role-gated at go-live |
| 25 | POS | 82 | CONDITIONAL/GO | Solid; no offline fallback; post-sale inventory decrement is async (no on-screen feedback) |

*(Orders/Preparation/Fulfillment/Shipping reflect the W2 verification + the fixes I applied earlier this program.)*

## 3. Global Enterprise Findings

1. **"Backend complete, frontend absent" is the #1 go-live risk.** Finance (F1–F5) and advanced CRM (C3–C6: service, sales, loyalty, intelligence, executive) are architecturally strong but have **no usable UI**. Accountants and CRM power-users cannot operate the system via the web today.
2. **Fabricated data on an executive surface.** The Dashboard's Activity Feed (7 hardcoded events) and Operations Center (static `0` workflow counts with a "Live" badge) violate the "no fake KPIs / no phantom UI" standard on the **highest-visibility screen**.
3. **Experimental surfaces are reachable.** AI Platform (Claude Bridge = architecture-only; AI Supervisor = endpoints with no LLM logic) and Stock Transfers (phantom) are navigable but non-functional — they must be hidden or role-gated.
4. **Localization/currency inconsistency.** Hardcoded `SAR` in receiving/goods-receipt/inventory pages conflicts with an EGP-oriented platform; currency must come from org context.
5. **Timeline/History under-rendered.** Several modules load timeline/audit data but don't render it (Procurement invoice posting log, Purchase Materials, Waste investigations) — a recurring enterprise-standard gap.
6. **Canonical migration still gated (known).** Inventory value = legacy `material_cost` (not FIFO) and Stock History is partial, both behind OFF flags pending seeded dual-run. Trustworthy inventory/finance numbers depend on completing that validation.
7. **Positive:** the commerce spine is genuinely enterprise-grade — human-readable identifiers, real KPIs, immutable money/ledger snapshots, state machines, drawer/timeline standards (Orders, Suppliers-360, Shipping, POS, Finance-backend).

## 4. Go-Live Blockers (P0) — must fix or explicitly scope-out before go-live

| # | Blocker | Module | Decision needed |
|---|---------|--------|-----------------|
| B1 | Dashboard **Activity Feed mock events** + **Operations Center static zeros** presented as live | Dashboard | Wire to real data **or hide** both widgets before go-live |
| B2 | **No Accounting UI** (`/accounting` = ComingSoonPage) | Accounting | Scope-out (API/automation-only + remove from nav) **or** build minimal journal/TB/close UI |
| B3 | **Advanced CRM has no frontend** (Service/Tickets, Sales, Loyalty, Intelligence, Executive) + missing Customer-360 tabs | CRM | Scope-out & remove from nav **or** build the surfaces; do not ship half-navigable |
| B4 | **AI Platform is stub/architecture-only** (Claude Bridge, AI Supervisor — no LLM logic) | AI Platform | **Hide / role-gate to CTO** at go-live |
| B5 | **Stock Transfers phantom module** (placeholder page, no create flow) | Inventory | Remove from navigation / gate |
| B6 | **Recipe `yield_quantity` missing from form** → per-unit finished-good costing cannot be computed | Recipes/Mfg | Fix before manufacturing is in scope, or scope-out manufacturing costing |
| B7 | **Canonical inventory value/cost unvalidated** (legacy `material_cost` basis; Stock History partial) | Inventory/Finance | Run seeded `inventory:canonical-diff`, validate, decide cutover — before trusting inventory/finance reporting |

*(Severity calibration: items several sub-audits marked P0 — hardcoded `channels_count`, warehouse KPI counts, "Goods to Receive" badge — are re-classified as P1/P2 below; they are data-quality issues, not launch-stopping.)*

## 5. Must-Fix Items (P1)

- **Currency from org context** — remove hardcoded `SAR` (`receiving-center-page.tsx:140`, `goods-receipts-page.tsx`, inventory dashboard).
- **Warehouses KPI counts** — use `meta.total`, not current-page counts (`warehouses-page.tsx:173,181`).
- **Procurement "Goods to Receive" badge** — real draft-GR count or remove the static "—" (`procurement-hub-page.tsx:233`).
- **Raw Materials** — replace `Math.random()` attachment IDs; disable the attachment feature until a backend exists (silent data loss today).
- **Companies** `channels_count` hardcoded `0` → derive or drop (`CompanyResource.php:51`); resolve placeholder "Activity" tabs (Companies/Warehouses) — implement audit log or remove tab.
- **Customers** — surface enriched CRM identity fields (customer_type/business/tax id/group) if B2B customers are in scope; move client-side CLV/AOV (200-row aggregation) to a backend endpoint.
- **Marketing** — hide "coming soon" Finance/ROAS placeholders on the exec view; gate the unbuilt visual workflow canvas.
- **Render loaded timelines** — Procurement invoice posting log/errors, Purchase Materials events, Waste investigation events.
- **Manufacturing (BOM)** — expose `manufacturing_cost`/`other_costs` or hide the incomplete costing.

## 6. Recommended Improvements (P2 / P3)

- Revenue-target support so Monthly Progress/Analytics is meaningful (P2).
- Drill-down from Dashboard/Stock Ledger KPIs to underlying records (P2).
- Server-side SLA/overdue computation for Waste/Liability (P2).
- POS: offline fallback + on-screen post-sale inventory confirmation; concurrent-terminal pre-flight check (P2).
- Shipping: surface dispatch-blocker reason inline; retry-exhaustion escalation queue (P2).
- Master-data lookups for hardcoded lists (damage reasons) (P2).
- Consolidate near-duplicate BOM/Recipe domains; soft-delete restore UIs; audit-log viewers (P3).

## 7. Overall Enterprise Score

**74 / 100** (weighted across modules).
- Commerce & Operations core (Orders, Preparation, Fulfillment, Shipping, Procurement, POS, Products, core Inventory): **~85** — go-live capable.
- Finance & advanced CRM (UI): **~35** — not usable via web.
- Executive Dashboard integrity: **~60** — undermined by fabricated widgets.
- Platform hygiene (phantom/experimental surfaces reachable): **~55**.

## 8. GO / NO-GO Recommendation

**Full platform: NO-GO.** Finance and advanced CRM have no operable UI; the executive Dashboard shows fabricated data; experimental surfaces (AI Platform, Stock Transfers) are reachable.

**Scoped "Commerce & Operations Core": CONDITIONAL GO**, contingent on:
1. **Fix or hide** the Dashboard fake widgets (B1).
2. **Remove from navigation / role-gate** every incomplete surface so nothing half-built is reachable: Accounting UI, advanced CRM (Service/Sales/Loyalty/Intelligence/Executive), AI Platform, Stock Transfers, Marketing visual-canvas & Finance placeholders (B2–B5, parts of P1).
3. **Currency-from-context** and the Warehouses/Procurement KPI corrections (P1).
4. **Validate canonical inventory/cost** (seeded `inventory:canonical-diff`) before inventory/finance figures are trusted (B7); keep flags OFF until then.
5. Decide manufacturing-costing scope (B6) — include only if `yield_quantity` is wired.

With that scope and those gates, ECOS can support an enterprise customer's **order-to-delivery, procurement-to-receipt, and point-of-sale** operations at go-live, with Finance running as backend/automation and advanced CRM/AI deferred to a fast-follow.

---

*Audit complete. No code modified. Published for CTO review. Pre-Go-Live testing NOT started — awaiting approval.*
