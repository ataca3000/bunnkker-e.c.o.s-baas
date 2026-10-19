# Reporting Information Model

**Document:** REPORTING-INFORMATION-MODEL  
**Version:** 1.0  
**Status:** APPROVED — Architecture Only  
**Date:** 2026-07-05  
**Task:** TASK-INFORMATION-ARCH-001  
**Parent:** ENTERPRISE-INFORMATION-ARCHITECTURE.md

---

## 1. Reporting Philosophy

> Reports answer "how are we doing?" Transactions answer "what happened?" These are different information needs and require different data models.

ECOS reporting is built on projections and KPI snapshots derived from events — not on direct queries of operational tables. This ensures:
- Reports are fast (pre-aggregated, not re-computed on every view)
- Reports do not compete with operational transactions for database resources
- Report consumers cannot accidentally modify operational data

---

## 2. Reporting Data Sources

| Source Type | Used For | Freshness |
|---|---|---|
| Read Models (CQRS) | Detail views, filtered lists | Near real-time (< 30s) |
| KPI Snapshots | Dashboard cards, trends | Periodic (hourly to daily) |
| Analytical Projections | Charts, forecasts, AI inputs | Daily |
| Direct OLTP (limited) | Exact financial totals for reconciliation | Real-time (authorized only) |

**NOTE:** Direct OLTP queries for reporting are only permitted for financial reconciliation in Finance workflows and must use read-replica connections (never primary write connection).

---

## 3. Canonical KPI Definitions

### 3.1 Commerce KPIs

| KPI | Formula | Period | Data Source |
|---|---|---|---|
| Total Revenue | SUM(invoice.total_amount) WHERE status IN (issued, paid) | Day/Week/Month | finance.invoice |
| Order Count | COUNT(orders) WHERE status = delivered | Day/Week/Month | orders projection |
| Average Order Value | Total Revenue / Order Count | Day/Week/Month | Computed |
| Conversion Rate | Delivered / Confirmed × 100 | Week/Month | orders projection |
| Return Rate | Failed deliveries / Total dispatched × 100 | Month | fulfillment projection |

### 3.2 Fulfillment KPIs

| KPI | Formula | Period | Data Source |
|---|---|---|---|
| On-Time Delivery Rate | Delivered on/before expected / Total delivered × 100 | Week/Month | shipment projection |
| Average Preparation Time | AVG(wave.completed_at - wave.started_at) | Week/Month | preparation wave projection |
| Wave Completion Rate | Completed waves / Total waves × 100 | Day/Week | preparation wave projection |
| Vehicle Utilization | AVG(loaded_weight / vehicle_capacity_weight) × 100 | Week/Month | vehicle projection |
| Failed Delivery Rate | Failed deliveries / Total dispatched × 100 | Week/Month | shipment projection |

### 3.3 Inventory KPIs

| KPI | Formula | Period | Data Source |
|---|---|---|---|
| Inventory Value | SUM(receipt_layers.remaining_qty × unit_cost) | Current | inventory.availability |
| Stock Turn Rate | COGS / Average Inventory Value | Month | computed from finance + inventory |
| Low Stock Count | COUNT(products WHERE available < reorder_point) | Current | inventory.availability |
| Stock Accuracy | Counted items matching system / Total counted × 100 | Per cycle count | cycle count records |
| Waste Rate | Waste quantity / Production quantity × 100 | Month | manufacturing projection |

### 3.4 Procurement KPIs

| KPI | Formula | Period | Data Source |
|---|---|---|---|
| On-Time Receipt Rate | GRs received on/before expected / Total GRs × 100 | Month | procurement projection |
| Supplier Rejection Rate | Returned items / Total received × 100 | Month/Quarter | supplier return projection |
| Purchase Order Accuracy | Lines received as ordered / Total lines × 100 | Month | procurement projection |
| Average Lead Time | AVG(gr.received_at - po.confirmed_at) in days | Month | procurement projection |
| Total Procurement Spend | SUM(po.total_amount) WHERE status = received | Month | purchase order projection |

### 3.5 Finance KPIs

| KPI | Formula | Period | Data Source |
|---|---|---|---|
| Accounts Receivable Aging | SUM(invoice.outstanding) grouped by 0-30, 31-60, 61-90, 90+ days | Current | finance.ar_summary |
| Gross Profit Margin | (Revenue - COGS) / Revenue × 100 | Month | computed |
| Cash Collection Rate | Collected / Invoiced × 100 | Month | finance projection |
| POS Daily Revenue | SUM(pos_sale.total) | Day | POS projection |
| Average Invoice Payment Days | AVG(payment.received_at - invoice.issued_at) | Month | finance projection |

---

## 4. Standard Report Catalog

| Report | Consumer | Data Source | Frequency |
|---|---|---|---|
| Daily Operations Summary | Operations Manager | Multiple projections | Daily (auto-generated) |
| Inventory Valuation Report | Finance Manager | inventory + finance | Weekly |
| Supplier Performance Report | Procurement Manager | procurement projection | Monthly |
| Customer Revenue Report | CRM Manager | crm + orders + finance | Monthly |
| Fulfillment Efficiency Report | Operations Manager | fulfillment projection | Weekly |
| Financial Statement (P&L) | CFO / Executive | finance OLTP (read replica) | Monthly |
| GDPR Data Subject Report | Privacy Officer | Customer data export | On request |
| Audit Trail Report | Compliance | Audit records | On request |

---

## 5. Reporting Access Control

| Report Type | Access Level | Notes |
|---|---|---|
| Operational dashboards | All managers for their domain | Scoped to company |
| Cross-domain reports | Senior Manager / Director | Requires elevated role |
| Financial statements | Finance Manager, CFO | Confidential classification |
| PII-containing reports | Privacy Officer | Requires Privacy Officer role |
| AI performance reports | AI Operator | Recommendation quality metrics |
| Audit reports | Compliance Officer | Full history including archived |

---

## 6. Report Information Governance

| Rule | Statement |
|---|---|
| **RPT-GOV-001** | Reports must never query operational tables directly in production read paths |
| **RPT-GOV-002** | KPI definitions are canonical — a KPI may only be defined once in this document |
| **RPT-GOV-003** | Reports containing PII require Privacy Officer role; export of PII requires approval |
| **RPT-GOV-004** | Archived data is included in reports only when the date range explicitly spans the archive period |
| **RPT-GOV-005** | Financial reports (P&L, AR aging) use read-replica OLTP for accuracy; not projections |
| **RPT-GOV-006** | All reports are company-scoped; no cross-tenant data may appear in any report |
