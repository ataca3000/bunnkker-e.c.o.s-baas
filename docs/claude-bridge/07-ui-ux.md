# UI / UX Architecture
## ECOS Claude Bridge v1.0

**Document ID:** CB-UX-001  
**Version:** 1.0  
**Date:** 2026-07-18  

---

## Five Pages

```
/cb                  → Dashboard
/cb/tasks            → Task List
/cb/tasks/new        → Create Task
/cb/tasks/:id        → Task Detail (logs + report + review)
/cb/settings         → Settings
```

Dashboard and Task Detail are the primary screens. Everything else is supporting.

---

## Design Approach

**Mobile first.** The developer reviews Claude Code output from their phone. Every interaction must work on a 375px screen with thumbs.

**Single column.** No complex grid layouts. Cards stacked vertically. One action per tap.

**Data, not decoration.** Show the status, the log, the diff, the report. No empty states that require tutorials.

---

## Navigation

```
Mobile (bottom bar):
  [Dashboard]  [Tasks]  [+New]  [Settings]

Desktop (sidebar or top nav):
  Claude Bridge
  ├── Dashboard
  ├── Tasks
  ├── + New Task
  └── Settings
```

No sub-navigation beyond these five.

---

## Page 1: Dashboard

```
┌────────────────────────────────────┐
│  Claude Bridge                     │
├────────────────────────────────────┤
│  Worker: Osama-PC  ● Online        │
│  Last seen: 28 seconds ago         │
├────────────────────────────────────┤
│  RUNNING NOW                       │
│  ┌──────────────────────────────┐  │
│  │  Add CSV export to Orders    │  │
│  │  ████████░░░░  12 min ago    │  │
│  │  [View Live Log ▶]           │  │
│  └──────────────────────────────┘  │
├────────────────────────────────────┤
│  NEEDS REVIEW  (3)                 │
│  ┌──────────────────────────────┐  │
│  │  Fix inventory race          │  │
│  │  Done · 2 hours ago          │  │
│  │  [Review ▶]                  │  │
│  └──────────────────────────────┘  │
│  ┌──────────────────────────────┐  │
│  │  Refactor ShippingEngine     │  │
│  │  Done · Yesterday            │  │
│  │  [Review ▶]                  │  │
│  └──────────────────────────────┘  │
├────────────────────────────────────┤
│  TODAY                             │
│  5 approved  ·  2 failed  ·  3 queued │
└────────────────────────────────────┘
```

**Behavior:**
- Page refreshes on load. No auto-refresh in Phase 1.
- "View Live Log" links to Task Detail with the log tab open.
- "Review" links to Task Detail with the report tab open.
- Worker offline state: replace worker status with a red banner: "Worker offline — last seen N minutes ago."

---

## Page 2: Task List

```
┌────────────────────────────────────┐
│  Tasks                    [+ New]  │
├────────────────────────────────────┤
│  [All ▼]  [Any Priority ▼]        │
├────────────────────────────────────┤
│  ● RUNNING                         │
│  Add CSV export to Orders          │
│  normal · 12 min ago               │
├────────────────────────────────────┤
│  ◉ NEEDS REVIEW                    │
│  Fix inventory race condition      │
│  high · 2 hours ago                │
├────────────────────────────────────┤
│  ○ QUEUED                          │
│  Add email notifications           │
│  normal · 18 min ago               │
├────────────────────────────────────┤
│  ✓ APPROVED                        │
│  DB index for orders.status        │
│  Yesterday                         │
├────────────────────────────────────┤
│  ✓ MERGED                          │
│  Refactor ShippingEngine           │
│  3 days ago                        │
└────────────────────────────────────┘
```

**Status icons:**
- ● Running (pulse animation)
- ◉ Needs Review (orange dot)
- ○ Queued
- ✓ Approved / Merged
- ✗ Failed / Cancelled

Each row is tappable and navigates to Task Detail.

---

## Page 3: Create Task

```
┌────────────────────────────────────┐
│  ← New Task                        │
├────────────────────────────────────┤
│  Title                             │
│  [Add CSV export to Orders     ]   │
├────────────────────────────────────┤
│  Description                       │
│  ┌──────────────────────────────┐  │
│  │ Implement GET /api/orders/   │  │
│  │ export?format=csv ...        │  │
│  │                              │  │
│  └──────────────────────────────┘  │
│  Be specific. Claude will read     │
│  this as the task prompt.          │
├────────────────────────────────────┤
│  Repository Path                   │
│  [C:\Projects\ecos-erp        ]    │
│  (pre-filled from Settings)        │
├────────────────────────────────────┤
│  Target Branch   [main         ]   │
│  Priority        [Normal ▼     ]   │
├────────────────────────────────────┤
│       [Save Draft]  [Queue ▶]      │
└────────────────────────────────────┘
```

**Behavior:**
- "Save Draft" creates the task in `pending` status without queuing.
- "Queue ▶" creates the task and immediately queues it.
- Repository path is pre-filled from the last used path (stored in browser localStorage).
- No validation on repository path format in Phase 1 — the worker will fail and report if it's wrong.

---

## Page 4: Task Detail

Four tabs. Opens on the most relevant tab based on task status.

```
┌────────────────────────────────────┐
│  ← Tasks                [Cancel]  │
│  Add CSV export to Orders          │
│  ● Running · normal · main         │
├────────────────────────────────────┤
│  [Summary] [Log] [Diff] [Report]  │
├────────────────────────────────────┤

TAB: SUMMARY (default when running or done)
  ──────────────────────────────────
  Status      Running
  Started     12 minutes ago
  Worker      Osama-PC
  Attempt     1 of 3 max
  ──────────────────────────────────
  DESCRIPTION
  Implement GET /api/orders/export...
  
  When DONE (awaiting review):
  ──────────────────────────────────
  REVIEW
  [Approve ✓]  [Request Changes ↩]
  
  Comment (required for changes):
  [                              ]
  ──────────────────────────────────

TAB: LOG
  ──────────────────────────────────
  10:01:22  Reading files...
  10:01:23  Analyzing Orders module
  10:01:45  Writing export endpoint
  10:03:12  Running tests...
  10:04:01  Tests passed (14/14)
  ──────────────────────────────────
  [Load more ↓]    [Download Log]

TAB: DIFF
  ──────────────────────────────────
  3 files changed  +120 −12
  ──────────────────────────────────
  backend/Modules/.../OrderController.php
  ┌────────────────────────────────┐
  │ + public function export(...)  │
  │ + {                            │
  │ +   return response()->stream  │
  │     ...                        │
  └────────────────────────────────┘
  [Download Diff]
  ──────────────────────────────────

TAB: REPORT
  ──────────────────────────────────
  (rendered markdown from report.md)
  
  ## What I did
  Added a CSV export endpoint...
  
  ## Files changed
  - OrderController.php
  - OrderExportJob.php (new)
  
  ## Tests
  All existing tests pass. Added 2 new tests.
  ──────────────────────────────────
  [Download Report]
```

**Review actions (Summary tab, only when status is `done`):**

```
┌──────────────────────────────────┐
│  REVIEW DECISION                 │
│                                  │
│  [  ✓ Approve  ]  [ ↩ Changes ] │
│                                  │
│  Comment:                        │
│  [                              ]│
│                                  │
│  Required for "Changes".         │
└──────────────────────────────────┘
```

When approved, the status changes to `approved` and a "Mark as Merged" button appears (for after the developer manually merges).

---

## Page 5: Settings

```
┌────────────────────────────────────┐
│  Settings                          │
├────────────────────────────────────┤
│  WORKER                            │
│  Name:       Osama-PC              │
│  Status:     ● Online              │
│  Last seen:  28 seconds ago        │
│  Claude:     v1.5.7                │
│                                    │
│  [Regenerate API Token]            │
│  [Deactivate Worker]               │
├────────────────────────────────────┤
│  DEFAULT SETTINGS                  │
│  Repository: [C:\Projects\ecos    ]│
│  Branch:     [main                ]│
│                                    │
│  (saved to browser for pre-fill)   │
├────────────────────────────────────┤
│  WORKER SETUP                      │
│  [Download Worker Package]         │
│  [View Setup Instructions]         │
└────────────────────────────────────┘
```

The "Regenerate API Token" action shows the new token once, instructs the user to update `config.json`, and warns that the old token is immediately invalid.

---

## Mobile Behavior

All pages are single-column. The diff viewer scrolls horizontally within its own container. The log viewer shows the most recent 100 lines; older lines loaded with "Load more." Review action buttons are full-width, thumb-friendly (min 48px height).

---

## Responsive Breakpoints

| Width | Layout |
|---|---|
| < 640px | Single column; bottom navigation |
| 640–1024px | Single column; top navigation |
| > 1024px | Optional sidebar; content max-width 800px |

The product works at every breakpoint. Desktop is not the primary target.

---

## What Is Not in the UI

- No real-time log streaming (page refresh or manual "Load more" in Phase 1)
- No task edit after queuing (cancel and re-create)
- No bulk actions
- No user management (handled by ECOS platform)
- No analytics charts
- No dark mode theming (uses ECOS platform theme)
- No keyboard shortcuts (Phase 2)
