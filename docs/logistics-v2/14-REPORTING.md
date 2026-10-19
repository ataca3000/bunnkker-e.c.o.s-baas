# §14 — Reporting & KPIs

**ADR-025 is binding:** the Dashboard API, its KPI services and
`ExecutiveInsightEngine` are frozen. New modules integrate **additively** through
the `KpiService` → `InsightEngine` pattern. V2 adds services; it does not reopen
the dashboard.

---

## 14.1 Integration pattern

```
V2 contexts ──▶ LogisticsOperationsKpiService ──▶ InsightThresholds
                                                        │
                                                        ▼
                                            ExecutiveInsightEngine (frozen)
                                                        │
                                                        ▼
                                            Dashboard API (frozen)
```

V2 contributes:

- **one KPI service per domain area** (fleet, dispatch, routing, carrier, driver),
  each following the shape of the existing five KPI services;
- **threshold registrations** with `InsightThresholds`, so the insight engine can
  produce alerts and recommendations without knowing what a vehicle is;
- **nothing else.** No change to the dashboard controller, its response shape, its
  cache orchestration, or any existing KPI service.

Two principles carried from V1's KPI layer: business rules live in a
`KpiBusinessRules` registry rather than scattered in queries, and the controller
stays a thin cache orchestrator.

---

## 14.2 Fleet KPIs

| KPI | Definition | Target direction |
|---|---|---|
| Fleet availability | Vehicles `fit` ÷ total active | ↑ |
| Utilisation | Vehicle-days dispatched ÷ vehicle-days available | ↑ |
| Unplanned downtime | Hours out of service, unscheduled | ↓ |
| Mean time between failures | Distance ÷ corrective work orders | ↑ |
| Mean time to repair | `in_progress` → `completed`, average | ↓ |
| Preventive ratio | Preventive ÷ all work orders | ↑ |
| Overdue maintenance | Plans past due, count and worst age | ↓ |
| Open critical defects | Count and age | ↓ |
| Inspection compliance | Performed ÷ due, in window | ↑ |
| Document compliance | Vehicles with no expired mandatory document | ↑ |
| Average fleet age | Weighted by vehicle | context |

**The one to watch is preventive ratio.** A fleet whose work orders are mostly
corrective is a fleet being run to failure, and it predicts the availability
problem months before availability actually drops.

---

## 14.3 Maintenance and fuel KPIs

| KPI | Definition |
|---|---|
| Maintenance cost per km | Maintenance cost ÷ distance |
| Maintenance cost per vehicle | Window total |
| Schedule adherence | Completed within the due window ÷ due |
| Repeat repair rate | Same type recurring within a threshold distance — a proxy for repair quality |
| Vendor cost variance | Cost for the same job across vendors |
| Fuel efficiency | Litres per 100 km, per vehicle and per group |
| Efficiency deviation | Vehicle vs. its group's mean |
| Fuel cost per km | Fuel cost ÷ distance |
| Fuel cost per order | Fuel cost ÷ delivered orders |
| Fuel anomaly rate | Flagged ÷ total transactions |
| Idle fuel share | *Requires Telemetry — omitted cleanly when absent* |

Efficiency deviation is more actionable than absolute efficiency: it compares a
vehicle against its peers rather than against a manufacturer's figure, and it
surfaces both mechanical decline and fuel theft.

The idle-fuel row shows the pattern for every Telemetry-derived KPI: it simply
does not appear when Telemetry is absent. No KPI report is broken by its absence
(Directive 5).

---

## 14.4 Route and dispatch KPIs

| KPI | Definition |
|---|---|
| Plan adherence | Stops completed in planned sequence ÷ total |
| Route efficiency | Planned distance ÷ actual distance *(actual requires Telemetry; falls back to planned-only reporting)* |
| Stops per route | Density measure |
| Distance per stop | ↓ is better |
| ETA accuracy | Mean absolute error, predicted vs. actual arrival |
| Optimisation uplift | Distance saved vs. the `SequentialZoneStrategy` baseline |
| Reroute frequency | Reroutes per trip |
| Dispatch cycle time | Board open → last release |
| Blocked dispatch rate | Trips blocked ÷ trips planned |
| Resource utilisation at dispatch | Assigned vehicles ÷ fit vehicles |
| Auto-acceptance rate | Proposals accepted unmodified ÷ total |

Two of these are how the optimiser proves its worth. **Optimisation uplift** is the
direct measure — always computed against the same baseline strategy so it is
comparable across time and across future AI strategies. **Auto-acceptance rate** is
the trust measure: if dispatchers modify most proposals, the optimiser's objective
function does not match reality, and that is worth knowing before anyone claims the
optimiser works.

**ETA accuracy** is the prerequisite for taking `EtaBreachPredicted` seriously. A
predictive alert with unmeasured accuracy is noise.

---

## 14.5 Carrier KPIs

| KPI | Definition |
|---|---|
| On-time delivery rate | Per carrier, per service area |
| First-attempt success | Per carrier |
| Transit time | Actual vs. committed |
| Cost per shipment | Per carrier, per service level |
| Cost per kilogram | Comparable across carriers |
| Tender acceptance rate | Accepted ÷ tendered |
| Exception rate | Shipments entering `exception` ÷ total |
| Return rate | Returned ÷ tendered |
| API availability | Success rate over a window |
| Webhook latency | Carrier event time → received |
| **Reconciliation drift** | Mismatches per day |
| **Unmapped status count** | Integration gaps outstanding |
| Volume share | Actual vs. contracted quota |

The last three are integration-quality metrics rather than carrier-performance
metrics, and they matter because they measure *whether the other numbers can be
trusted*. Rising drift means the on-time figure is being computed from incomplete
data.

---

## 14.6 Driver KPIs

| KPI | Definition |
|---|---|
| First-attempt success rate | Successful first attempts ÷ deliveries |
| Stops per hour | Productivity |
| Average dwell time | Per stop, by stop type |
| POD compliance | Complete PODs ÷ deliveries |
| COD accuracy | Collected matching due ÷ COD deliveries |
| Failure rate by category | Using LOG-005's `FailureCategory` |
| **Customer-fault share** | Failures attributable to the customer ÷ all failures |
| Schedule adherence | Departure and return vs. plan |
| Inspection compliance | Pre-trip inspections completed ÷ shifts |
| Safety incidents | Defects attributed to handling |

**Every driver metric carries its sample size.** A 100% success rate over three
deliveries is not a 100% success rate, and a performance system that cannot make
that distinction will be gamed or distrusted within a month.

**Customer-fault share exists to make the scorecard fair.** LOG-005's
`FailureReason::isCustomerFault()` already distinguishes a driver who cannot find
an address from a customer who refused the order. Without that separation, drivers
working difficult areas are penalised for their route, and the whole scorecard
loses legitimacy.

---

## 14.7 Operational KPIs

The composite measures a logistics director actually reports on:

| KPI | Definition | Objective |
|---|---|---|
| **Cost per delivered order** | Total logistics cost ÷ delivered orders | BO-2 |
| Cost per kilometre | Total cost ÷ total distance | BO-2 |
| Cost by service area | Allocated by stops served | BO-8 |
| Own-fleet vs. carrier cost | Comparable per order | Make-or-buy |
| Delivery success rate | Overall | BO-5 |
| SLA compliance | Delivered within promise ÷ total | BO-5 |
| **Predicted vs. actual breaches** | Forecast accuracy | Validates the ETA engine |
| Capacity utilisation | Committed ÷ available, by area by day | BO-8 |
| Capacity accuracy | Served ÷ promised | BO-8 |
| Exception resolution time | Alert raised → resolved | BO-7 |
| Orders per vehicle-day | Throughput | BO-1 |

*Cost per delivered order* is the number the whole platform exists to move, and it
is only computable once fuel, maintenance, depreciation and carrier cost are all
captured — which is why Fleet's cost ledger is foundational rather than a
reporting afterthought.

---

## 14.8 Report delivery

| Report | Audience | Cadence |
|---|---|---|
| Daily operations summary | Operations manager | Daily, automated |
| Fleet health report | Fleet supervisor | Weekly |
| Maintenance forecast | Fleet manager | Monthly, forward-looking |
| Fuel exception report | Fleet manager | Weekly |
| Cost analysis | Finance | Monthly |
| Carrier scorecard | Carrier manager | Monthly |
| Driver scorecards | Line management | Monthly |
| Capacity vs. demand | Sales and operations | Weekly |
| Route optimisation effectiveness | Operations manager | Monthly |

Reports reuse the existing reporting infrastructure. Aggregates are computed by
scheduled jobs into projection tables, never on a user's request path.

---

## 14.9 Data quality dependencies

Every KPI in this document depends on inputs that can silently fail. These
dependencies should be monitored as first-class health metrics, because a KPI
computed from bad data is worse than no KPI:

| KPI family | Depends on | Fails silently when |
|---|---|---|
| All cost-per-km | Odometer completeness | Readings are missed; distance under-counts and cost/km inflates |
| Fuel efficiency | Odometer **at the fuel stop** | The reading is skipped; efficiency becomes meaningless |
| Utilisation | Trip closure discipline | Trips are left open; vehicles look busy |
| Route efficiency | Telemetry, if used | GPS gaps; actual distance under-reports |
| Carrier on-time | Webhook completeness | Silent webhook failure; drift is the detector |
| Driver first-attempt | Failure reason accuracy | Drivers pick the easiest reason; category mix is the detector |
| Capacity accuracy | Commitment discipline | Reservations never released; capacity looks consumed |

Two of these deserve to be alerts rather than footnotes:

- **Odometer completeness.** Distance is the denominator of most cost metrics.
  A vehicle with no reading for two weeks should raise an alert, not quietly
  distort a report.
- **Failure reason distribution.** A driver whose failures are 95% one reason is
  either facing a systemic problem or picking the fastest button. Both are worth
  seeing.
