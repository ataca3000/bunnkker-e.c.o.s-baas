# UX Architecture
## ECOS AI Operations Platform

**Document ID:** AIOP-UX-001  
**Version:** 1.0  
**Date:** 2026-07-18  

---

## 1. Navigation Structure

AIOP is a first-class ECOS module. It appears in the Module Rail under the "Operations" group (or a dedicated "AI Ops" group at the CTO's discretion).

```
Module Rail (left sidebar)
└── AI Ops  [⚙ icon]
    ├── Dashboard
    ├── Tasks
    ├── Queue
    ├── Workers
    ├── Agents
    ├── Reviews           (badge: pending count)
    ├── Artifacts
    └── Settings
```

Routing prefix: `/operations/aiop/` or `/ai-ops/`

---

## 2. Screen Inventory

| Screen | Route | Primary User |
|---|---|---|
| Dashboard | `/ai-ops` | CTO, Manager |
| Task List | `/ai-ops/tasks` | All |
| Task Create | `/ai-ops/tasks/new` | Operator |
| Task Detail | `/ai-ops/tasks/{id}` | All |
| Queue Monitor | `/ai-ops/queue` | Manager, Admin |
| Worker List | `/ai-ops/workers` | Admin |
| Worker Detail | `/ai-ops/workers/{id}` | Admin |
| Agent Registry | `/ai-ops/agents` | Admin |
| Review Queue | `/ai-ops/reviews` | Reviewer |
| Review Detail | `/ai-ops/reviews/{id}` | Reviewer |
| Artifact Vault | `/ai-ops/artifacts` | All |
| Execution Logs | `/ai-ops/executions/{id}/logs` | All |
| Settings | `/ai-ops/settings` | Admin |
| Mobile Dashboard | `/m/ai-ops` | CTO (mobile) |

---

## 3. Screen Wireframes (Text)

### 3.1 Dashboard

```
┌─────────────────────────────────────────────────────────────────────┐
│  AI Operations Dashboard                          [+ New Task]      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────┐  ┌──────────┐  ┌─────────────┐  ┌────────────────┐  │
│  │ Queued  │  │ In Progress│  │ Pending Review│  │ Completed Today│  │
│  │    3    │  │     1     │  │      2       │  │      7        │  │
│  └─────────┘  └──────────┘  └─────────────┘  └────────────────┘  │
│                                                                     │
│  ┌───────────────────────────────┐  ┌──────────────────────────┐  │
│  │  Active Executions             │  │  Worker Status            │  │
│  │                               │  │                           │  │
│  │  ● TASK-042: CSV Export       │  │  ● Laptop-Osama   BUSY   │  │
│  │    Claude Code v1.5.7         │  │  ○ CI-Server-01   IDLE   │  │
│  │    Running tests... 65%       │  │  ○ CI-Server-02   OFFLINE│  │
│  │    ████████░░░░ 12m elapsed   │  │                           │  │
│  │                               │  │  Queue: 3 tasks waiting   │  │
│  └───────────────────────────────┘  │  Est. wait: ~15 min       │  │
│                                     └──────────────────────────┘  │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Pending Reviews                               [View All]   │   │
│  │                                                             │   │
│  │  ┌─────────────────────────────────────────────────────┐   │   │
│  │  │ TASK-039: Refactor ShippingEngine          ⚠ SLA 2h │   │   │
│  │  │ Technical Review  •  Assigned: You                  │   │   │
│  │  │ [Open Review]                                       │   │   │
│  │  └─────────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

---

### 3.2 Task List

```
┌─────────────────────────────────────────────────────────────────────┐
│  Tasks                                             [+ New Task]     │
├─────────────────────────────────────────────────────────────────────┤
│  [All Statuses ▼]  [All Types ▼]  [All Priority ▼]  [🔍 Search]   │
├─────────────────────────────────────────────────────────────────────┤
│  ID       │ Title                    │ Status        │ Priority     │
├───────────┼──────────────────────────┼───────────────┼─────────────┤
│  #042     │ Add CSV Export to Orders │ ● In Progress │ ↑ High      │
│  #041     │ Fix inventory race cond. │ ◉ Pending Rev.│ !! Critical  │
│  #040     │ Add unit tests: ShipEng  │ ✓ Completed   │ → Medium    │
│  #039     │ Refactor ShippingEngine  │ ◉ Pending Rev.│ ↑ High      │
│  #038     │ DB index for orders.stat │ ⏸ Queued      │ → Medium    │
└─────────────────────────────────────────────────────────────────────┘
  Showing 5 of 42  [← 1 2 3 →]
```

---

### 3.3 Task Detail

```
┌─────────────────────────────────────────────────────────────────────┐
│  ← Back to Tasks                                                    │
│  TASK-042: Add CSV Export to Orders                                 │
│  ● In Progress  •  Feature  •  High Priority  •  ECOS Backend      │
│                                                      [Cancel Task]  │
├─────────────────────────────────────────────────────────────────────┤
│  DESCRIPTION                                                        │
│  Implement a CSV export feature for the orders list page.           │
│  The export should include: order number, customer name, total,...  │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│  CURRENT EXECUTION                                                  │
│  Worker: Laptop-Osama   Agent: Claude Code v1.5.7   Attempt: 1     │
│  Started: 12 minutes ago                                            │
│  ████████████░░░░░░ Running tests...                                │
│                                                                     │
│  [View Live Logs]                                                   │
├─────────────────────────────────────────────────────────────────────┤
│  TABS:  [Details]  [Executions (1)]  [Logs]  [Artifacts]  [Review] │
│                                                                     │
│  Execution #1 — In Progress                                         │
│  ...                                                                │
└─────────────────────────────────────────────────────────────────────┘
```

---

### 3.4 Task Create Form

```
┌─────────────────────────────────────────────────────────────────────┐
│  New Task                                                           │
├─────────────────────────────────────────────────────────────────────┤
│  Project          [ECOS Backend ▼]                                  │
│                                                                     │
│  Title            [Add CSV export for the Orders list page    ]    │
│                                                                     │
│  Description                                                        │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Describe what the AI agent should implement.                │   │
│  │ Be specific: file paths, expected behavior, edge cases.    │   │
│  │                                                             │   │
│  │                                                             │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  Type              [Feature ▼]    Priority    [High ▼]             │
│                                                                     │
│  Required Capabilities                                              │
│  [✓ code_generation]  [✓ test_writing]  [□ documentation]         │
│                                                                     │
│  Target Branch     [main           ]                                │
│                                                                     │
│  Due Date          [2026-07-20 5:00 PM]                            │
│                                                                     │
│  Cost Budget       [$ 2.00          ]  (optional)                  │
│                                                                     │
│                              [Cancel]  [Save as Draft]  [Queue ▶] │
└─────────────────────────────────────────────────────────────────────┘
```

---

### 3.5 Review Interface

```
┌─────────────────────────────────────────────────────────────────────┐
│  Review: TASK-041 — Fix inventory race condition                    │
│  Technical Review  •  SLA: 2 hours remaining  •  Assigned: You     │
├─────────────────────────────────────────────────────────────────────┤
│  TABS:  [Summary]  [Code Diff]  [Test Results]  [Logs]             │
├─────────────────────────────────────────────────────────────────────┤
│  AI EXECUTION REPORT                                                │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Summary: Added a database-level lock in the ReserveOrderIn- │   │
│  │ ventoryAction to prevent concurrent reservation of the same │   │
│  │ inventory unit.                                             │   │
│  │                                                             │   │
│  │ Files Changed: 3    Lines Added: 47    Lines Removed: 12    │   │
│  │ Tests Added: 4      Tests Passed: 14   Tests Failed: 0      │   │
│  │ Confidence: ████████░░ 82%                                  │   │
│  │                                                             │   │
│  │ ⚠ Identified Risks:                                        │   │
│  │   - Lock timeout could cause delays under high load         │   │
│  │   - Deadlock possible if called concurrently with other lock│   │
│  │                                                             │   │
│  │ Review Focus Areas:                                         │   │
│  │   - Lock timeout value (currently 5s)                       │   │
│  │   - Error handling when lock acquisition fails              │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│  YOUR DECISION                                                      │
│                                                                     │
│  [○ Approve]  [○ Request Changes]  [○ Reject]                      │
│                                                                     │
│  Comment (required for changes/reject):                             │
│  [                                                             ]    │
│                                                                     │
│                                            [Submit Decision ▶]     │
└─────────────────────────────────────────────────────────────────────┘
```

---

### 3.6 Execution Logs Screen

```
┌─────────────────────────────────────────────────────────────────────┐
│  Execution Logs — TASK-042 Attempt #1                               │
│  ● Running   Claude Code v1.5.7   Laptop-Osama                     │
│                                            [🔍 Filter] [⬇ Download]│
├─────────────────────────────────────────────────────────────────────┤
│  [All] [Info] [Warn] [Error]                       [Auto-scroll ON] │
├─────────────────────────────────────────────────────────────────────┤
│  10:42:01  INFO   agent     Analyzing repository structure...       │
│  10:42:03  INFO   agent     Found 3 relevant files for this task   │
│  10:42:15  INFO   agent     Generated CSV export implementation     │
│  10:42:20  INFO   agent     Writing to Orders/Application/...       │
│  10:43:00  INFO   agent     Running test suite...                   │
│  10:43:45  INFO   agent     Tests passed: 14/14                     │
│  10:43:46  INFO   system    Collecting git diff...                  │
│  10:43:47  INFO   system    Uploading artifacts...           ●●●    │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

### 3.7 Worker List

```
┌─────────────────────────────────────────────────────────────────────┐
│  Workers                                       [+ Register Worker]  │
├─────────────────────────────────────────────────────────────────────┤
│  Name           │ Status   │ Agent       │ Last Seen  │ Actions     │
├─────────────────┼──────────┼─────────────┼────────────┼────────────┤
│  Laptop-Osama   │ ● BUSY   │ Claude Code │ Just now   │ [Detail]   │
│  CI-Server-01   │ ○ IDLE   │ Claude Code │ 28s ago    │ [Detail]   │
│  CI-Server-02   │ ○ OFFLINE│ Gemini CLI  │ 4h ago     │ [Detail]   │
└─────────────────────────────────────────────────────────────────────┘
```

---

### 3.8 Queue Monitor

```
┌─────────────────────────────────────────────────────────────────────┐
│  Queue Monitor                                   [Auto-refresh: ON] │
├─────────────────────────────────────────────────────────────────────┤
│  QUEUE HEALTH                                                       │
│  Queued: 3   In Progress: 1   Available Workers: 2   Est. Wait: 15m│
├─────────────────────────────────────────────────────────────────────┤
│  QUEUED TASKS (Priority Order)                                      │
│  #  │ ID     │ Title                     │ Priority  │ Waiting     │
│  1  │ #043   │ Migrate old report schema │ Critical  │ 2m          │
│  2  │ #038   │ DB index for orders.stat  │ Medium    │ 18m         │
│  3  │ #044   │ Add email notification    │ Low       │ 18m         │
├─────────────────────────────────────────────────────────────────────┤
│  IN PROGRESS                                                        │
│  TASK-042 on Laptop-Osama  •  65%  •  Running tests...             │
└─────────────────────────────────────────────────────────────────────┘
```

---

### 3.9 Mobile Dashboard

For CTO / manager on mobile (responsive layout):

```
┌────────────────────┐
│  AI Ops            │
│  ──────────────    │
│  3  Queued         │
│  1  In Progress    │
│  2  Pending Review │
│  7  Done Today     │
│  ──────────────    │
│  ⚠ Review SLA      │
│  TASK-039 due 2h   │
│  [Open Review ▶]   │
│  ──────────────    │
│  Workers           │
│  ● 2 Online        │
│  ○ 1 Offline       │
└────────────────────┘
```

---

## 4. UX Principles

### 4.1 Operator Efficiency
Task creation should take under 2 minutes. The form pre-fills common values (project, branch, capabilities) from the user's last task. Frequent task types can be saved as templates.

### 4.2 Reviewer Clarity
The review interface presents information in the order reviewers read it: summary first, risks second, diff third. Logs are available but not front-and-center — reviewers should not need to read raw logs to make a decision.

### 4.3 Real-Time Feedback
- Execution progress updates push to the browser without manual refresh (via WebSocket / Reverb)
- Log lines stream in real time during execution
- Worker status updates in Worker List reflect heartbeat changes within 30 seconds

### 4.4 Exception-Driven
Users do not need to watch the system. The dashboard shows only what needs attention. Completed tasks are archived. Alerts surface only when human action is needed.

### 4.5 Audit Transparency
The Task Detail screen shows a full timeline: Created → Queued → Assigned → In Progress → Pending Review → Approved → Completed. Every actor is named. Timestamps are shown in the user's local timezone.

---

## 5. Responsive Behavior

| Breakpoint | Layout |
|---|---|
| Desktop (≥ 1280px) | Full sidebar + main content; review interface is split-pane (report left, diff right) |
| Tablet (768–1279px) | Collapsed sidebar; single-column content; tabbed review interface |
| Mobile (< 768px) | Bottom navigation; card-based task list; read-only dashboard; no task creation |

---

## 6. Code Diff Viewer

The review screen's Code Diff tab renders a syntax-highlighted, side-by-side or unified diff:

- File tree on the left showing changed files (+ / - / ~ icons)
- Line-level annotations possible (reviewer can highlight a line and add a comment)
- Large diffs (> 500 files changed) show a summary with navigation to jump to specific files
- Binary files show placeholder with type and size; no content preview

The diff viewer uses the CodeMirror or Monaco Editor library in read-only mode. No external CDN — bundled with the frontend build.

---

## 7. Notifications

In-app notifications appear as a badge on the Module Rail icon and in a notification panel. Notification types:

| Type | Default Channel | Urgency |
|---|---|---|
| Review assigned to you | In-app + Email | High |
| Review SLA breached | In-app + Email | Urgent |
| Task completed | In-app | Normal |
| Task failed | In-app + Email | High |
| Worker offline | In-app | Normal |
| Worker heartbeat missed | In-app + Email | High |
| CTO approval required | In-app + Email | Urgent |

Users can configure channel preferences (in-app, email, Slack webhook) per notification type in Settings.
