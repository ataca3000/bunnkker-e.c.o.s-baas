# AI UX — Standard

**Document:** AI-UX-STANDARD  
**Version:** 1.0  
**Status:** APPROVED — Architecture Only  
**Date:** 2026-07-05  
**Task:** TASK-UX-ARCH-001  
**Parent:** ENTERPRISE-UX-ARCHITECTURE.md  
**Backend:** AI-DATA-ARCHITECTURE.md, ENTERPRISE-EVENT-PLATFORM.md (EPS-01)

---

## 1. Mission

> AI in ECOS is a co-worker, not a feature. The AI experience is consistent, transparent, and actionable. Users always know when AI is involved, why it suggests something, and how confident it is.

AI never hides. AI never decides without the user. AI accelerates work; it does not replace judgment.

---

## 2. AI Interaction Principles

| Principle | Rule |
|---|---|
| **Transparent** | Every AI output shows its source, model, and confidence |
| **Actionable** | Every AI suggestion has a one-click action |
| **Explainable** | Every AI decision can be expanded to show reasoning |
| **Dismissible** | Every AI output can be dismissed; dismissal provides feedback |
| **Non-blocking** | AI suggestions are always optional; workflows never require AI approval |
| **Auditable** | All AI interactions are logged in the Timeline via EPS-02 |

---

## 3. AI Entry Points

Six standard ways AI surfaces in the ECOS UI:

### EP-AI-01: AI Insights Column (DataGrid)

An optional column in any DataGrid showing a per-row AI indicator:

```
● ⚡ High risk    (for rows with high-priority AI flags)
● ⚠ Anomaly      (for detected deviations)
● 💡 Suggestion  (for optimization opportunities)
```

Clicking the indicator opens the AI panel focused on that row.

### EP-AI-02: Smart Toolbar AI Button

The `✨ AI: N suggestions` button in the Smart Toolbar (see SMART-TOOLBAR-STANDARD.md).

Opens a **Workspace AI Panel** above or beside the grid.

### EP-AI-03: Detail Drawer AI Insights Tab

A dedicated tab in every Detail Drawer for AI recommendations specific to that record.

### EP-AI-04: Timeline AI Entries

AI events appear as distinct entries in the Timeline (see TIMELINE-UX-STANDARD.md).

### EP-AI-05: AI Assistant (Global)

The `🤖` icon in the Global Navigation Rail opens the AI Assistant panel — a conversational interface available across the entire application.

### EP-AI-06: Contextual AI Hints

Small, inline AI annotations next to specific fields when AI has something to say:

```
Cost per unit:  EGP 8.50   ⚠️ 23% above market average  [Why?]
```

---

## 4. AI Panel (Workspace Level)

The Workspace AI Panel is triggered from the Smart Toolbar AI button.

```
┌──────────────────────────────────────────────────────────────────────┐
│  ✨ AI Insights  ·  3 suggestions  [Dismiss all]              [✗]   │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ⚡ HIGH PRIORITY                                                    │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │ 12 orders are at SLA risk                                      │ │
│  │ Based on current preparation status and historical delivery    │ │
│  │ times, these orders may miss their SLA window.                 │ │
│  │ Confidence: 81%                                                │ │
│  │ [Review orders →]  [Why?]  [Dismiss]                          │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  💡 SUGGESTION                                                       │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │ Wave #45 and Wave #46 can be merged                            │ │
│  │ Both waves serve overlapping routes. Merging reduces vehicle   │ │
│  │ usage by 1 truck and saves ~EGP 320 in fuel costs.            │ │
│  │ Confidence: 94%                                                │ │
│  │ [Merge waves →]  [Why?]  [Dismiss]                            │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  ⚠ ANOMALY                                                           │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │ Supplier Ahmed Trading cost deviation detected                 │ │
│  │ Last 3 invoices show 18% increase vs. contract price.         │ │
│  │ Confidence: 97%                                                │ │
│  │ [View supplier →]  [Why?]  [Dismiss]                          │ │
│  └────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 5. AI Insights Tab (Drawer Level)

In the Detail Drawer's AI Insights tab:

```
┌──────────────────────────────────────────────────────────────────────┐
│  AI INSIGHTS  ·  Order ORD-00234  ·  Analyzed: 2 min ago  [Refresh]│
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  RISK ANALYSIS                                                       │
│  Overall risk: ● Medium  (Score: 42/100)                            │
│  Delivery risk: ⚡ High (73%)  │  Payment risk: ● Low (12%)         │
│  SLA risk: ⚠ Medium (54%)     │  Cancellation risk: ● Low (8%)     │
│                                                                      │
│  KEY FACTORS                                                         │
│  • Preparation wave has 3 blocked items                             │
│  • Historical delivery to this customer: 78% on-time               │
│  • Current traffic conditions on route: elevated                    │
│                                                                      │
│  AI RECOMMENDATION                                                   │
│  Escalate to supervisor. Consider partial shipment for the 9        │
│  items that are ready. Customer historically accepts partial        │
│  deliveries when notified in advance.                               │
│  [Take action →]  [Why?]  [Dismiss this recommendation]            │
│                                                                      │
│  NEXT BEST ACTIONS                                                   │
│  1. Contact customer to discuss partial delivery  [Notify customer]│
│  2. Reprioritize the blocked item in manufacturing [Escalate]       │
│  3. Assign to fastest driver on this route        [Assign]         │
│                                                                      │
│  ─────────────────────────────────────────────────────────────────  │
│  Model: Risk Engine v2.3  ·  Policy: AIPolicy#42  ·  v3.1          │
│  Event: ai.risk_assessment.computed (2 min ago)                    │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 6. "Why?" Explanation Panel

Clicking "Why?" on any AI output opens an **Explanation Panel**:

```
┌──────────────────────────────────────────────────────┐
│  Why did AI flag this?                          [✗] │
├──────────────────────────────────────────────────────┤
│  Input signals used:                               │
│  • Wave status: 3 items blocked (weight: 40%)      │
│  • Customer historical on-time rate: 78%           │
│    (current order risk: +12% vs average)           │
│  • SLA window: 4 hours remaining (weight: 30%)     │
│  • Similar orders in last 30 days:                 │
│    18 / 24 at this stage were delayed              │
│                                                    │
│  Confidence: 73%                                   │
│  Model: Risk Engine v2.3                           │
│  Policy: AIPolicy#42 (SLA monitoring)              │
│                                                    │
│  Was this explanation helpful?  [Yes ✓]  [No ✗]  │
└──────────────────────────────────────────────────────┘
```

---

## 7. AI Assistant (Global)

The global AI Assistant is a conversational interface accessible from the Navigation Rail.

```
┌──────────────────────────────────────────────────────────────────────┐
│  🤖 ECOS AI Assistant                                          [✗] │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ╭──────────────────────────────────────────────╮                  │
│  │ Good morning. Here's your daily summary:    │                   │
│  │ • 34 orders in preparation                  │                   │
│  │ • 12 at SLA risk                            │                   │
│  │ • 1 supplier invoice anomaly detected       │                   │
│  ╰──────────────────────────────────────────────╯                  │
│                                                                      │
│  [You]  How many orders are overdue in Cairo?                       │
│                                                                      │
│  [AI]  There are 7 overdue orders in Cairo. The oldest is          │
│        ORD-00198, overdue by 3 hours. Route CM-12 has the most     │
│        concentration. Would you like me to show them in the        │
│        Orders workspace?                                           │
│        [Show me →]  [Show on map →]                                │
│                                                                      │
├──────────────────────────────────────────────────────────────────────┤
│  Ask AI...                                              [⬆ Send]   │
└──────────────────────────────────────────────────────────────────────┘
```

**Capabilities:**
- Answer questions about current data (counts, statuses, summaries)
- Navigate to specific records or filtered views
- Generate reports or summaries
- Detect problems and surface them pro-actively
- Suggest next best actions
- Explain past decisions

**Cannot:**
- Execute destructive actions without explicit user confirmation
- Access data outside the user's company context
- Override business policies

---

## 8. AI States and Feedback

### Loading State

```
✨  Analyzing...    (spinner animation; appears inline)
```

### Error State

```
⚠  AI is temporarily unavailable. Retry?   [Retry]
```

### Empty State

```
✨  No AI insights for this record.
    AI analysis runs every 15 minutes.
    Last analyzed: 20 min ago  [Analyze now]
```

### Feedback Loop

Every AI output has a feedback mechanism:
- **[✓ Helpful]** — positive signal; improves model
- **[✗ Not helpful]** — negative signal; optional free-text reason
- **[Dismiss]** — soft-dismiss; AI removes this suggestion from view; AI does not re-surface the same suggestion within 24 hours

---

## 9. AI Confidence Display

AI confidence is always displayed when present:

| Confidence | Display |
|---|---|
| ≥ 90% | ● High confidence: 94% |
| 70–89% | ● Medium confidence: 81% |
| 50–69% | ⚠ Low confidence: 63% — treat as a hint |
| < 50% | AI suggestions hidden by default (shown on request) |

---

## 10. AI Governance (UX)

| Rule | Constraint |
|---|---|
| UX-GOV-003 | AI interactions follow this standard — no module-specific AI widgets |
| Transparency | Every AI output must show model, policy_id, confidence |
| Auditability | All AI interactions are logged in the Timeline (EPS-02) |
| No auto-execute | AI cannot execute any action without explicit user confirmation |
| Dismissible | Every AI suggestion must be dismissible; dismissal is recorded |
| Policy-bound | AI recommendations declare the AIPolicy they were generated under |
