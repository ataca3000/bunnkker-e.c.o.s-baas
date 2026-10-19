# Notification UX — Standard

**Document:** NOTIFICATION-UX-STANDARD  
**Version:** 1.0  
**Status:** APPROVED — Architecture Only  
**Date:** 2026-07-05  
**Task:** TASK-UX-ARCH-001  
**Parent:** ENTERPRISE-UX-ARCHITECTURE.md  
**Backend:** ENTERPRISE-NOTIFICATION-PLATFORM.md (EPS-04)

---

## 1. Mission

> Every notification in ECOS follows one standard. Users know what to do with every notification because they all look the same, behave the same, and live in the same place.

Notifications are not noise. Every notification must be actionable or informational. Notifications that require no response are marked as informational. Notifications that require a decision are tasks.

---

## 2. Notification Types

| Type | Description | Requires Action |
|---|---|---|
| **Alert** | Something happened that the user should know about | No |
| **Task** | Something the user must do | Yes |
| **Approval** | A business object awaiting the user's approval decision | Yes |
| **Assignment** | A record has been assigned to the user | Conditional |
| **Warning** | A threshold has been exceeded or a problem detected | No |
| **Mention** | A user was mentioned in a comment or note | No |
| **AI Notification** | AI has a recommendation requiring review | Conditional |
| **Exception** | A critical business exception that needs immediate attention | Yes |

---

## 3. In-App Notification Bell

The Notification Bell (🔔) lives in the Global Navigation Rail.

```
🔔 (12)   ← red badge with unread count
```

### Bell Panel

Clicking the bell opens the Notification Panel as a slide-in overlay:

```
┌──────────────────────────────────────────────────────────────────────┐
│  Notifications                          [Mark all read] [Inbox →]   │
├──────────────────────────────────────────────────────────────────────┤
│  ALL  │  TASKS (4)  │  ALERTS  │  APPROVALS (2)  │  MENTIONS        │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ● [unread]  CRITICAL  ·  2 min ago                                 │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ ⚡ Order ORD-00234 SLA breached                              │   │
│  │ Customer: Nour Market was expecting delivery by 10:00 AM.   │   │
│  │ [View order →]  [Dismiss]                                    │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ● [unread]  APPROVAL  ·  15 min ago                                │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ ✅ Purchase Order PO-2026-00123 awaiting your approval       │   │
│  │ Submitted by: Osama Fayez · Total: EGP 12,400               │   │
│  │ [Approve]  [Reject]  [View details →]                       │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ○ [read]  ALERT  ·  1 hour ago                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ 📦 Honey 500g stock below reorder point                     │   │
│  │ Current: 45 units · Reorder point: 100 units                │   │
│  │ [Create purchase order →]  [View product →]                 │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  [Load more notifications]                                          │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 4. Notification Entry Anatomy

```
● [read/unread dot]  [Priority badge]  ·  [Time ago]
┌────────────────────────────────────────────────────┐
│ [Icon]  [Title — short, action-oriented]           │
│ [Supporting details — 1-2 lines max]               │
│ [Primary Action]  [Secondary Action]  [Dismiss]   │
└────────────────────────────────────────────────────┘
```

**Priority badges:**

| Priority | Badge | Color | Example |
|---|---|---|---|
| Critical | ⚡ CRITICAL | error | SLA breach, system failure |
| High | ▲ HIGH | warning | Approval pending, blocked wave |
| Normal | (none) | neutral | Assignment, task |
| Low | ▼ LOW | neutral (dimmed) | Informational alert |

---

## 5. Toast Notifications (Transient)

For immediate feedback on actions the user just performed.

```
╭──────────────────────────────────────────────────────╮
│ ✓  Wave #45 approved                    [Undo]  [✗] │
╰──────────────────────────────────────────────────────╯
(appears bottom-center; auto-dismisses after 5 seconds)
```

**Toast types:**

| Type | Color | Example |
|---|---|---|
| Success | success | "Order confirmed", "File uploaded" |
| Error | error | "Save failed — retry?", "Import error" |
| Warning | warning | "Low stock warning triggered" |
| Info | info | "Background export started" |

**Rules:**
- Toasts auto-dismiss after 5 seconds
- Undo action available for 5 seconds on reversible operations
- Multiple toasts stack vertically (max 3 visible; oldest dismissed first)
- Critical errors do not auto-dismiss — require user acknowledgment

---

## 6. Enterprise Inbox

The Enterprise Inbox is the full-page notification management center. Accessed via `[Inbox →]` in the Notification Panel or `G + B` keyboard shortcut.

```
┌──────────────────────────────────────────────────────────────────────┐
│  Enterprise Inbox                                                     │
│  12 unread  ·  4 tasks  ·  2 approvals  ·  1 escalation             │
├──────────────────────────────────────────────────────────────────────┤
│  SIDEBAR            │  MAIN AREA                                      │
│  ─────────────────  │  ────────────────────────────────────────────  │
│  ● All (12)         │  [Filter ▼]  [Search...]  [Mark all read]      │
│  ● Tasks (4)        │                                                 │
│  ● Approvals (2)    │  ● PO-2026-00123 awaiting approval             │
│  ● Assignments (0)  │    Submitted: Osama F.  ·  Total: 12,400       │
│  ● Exceptions (1)   │    [Approve]  [Reject]  [View →]               │
│  ● Escalations (0)  │                                                 │
│  ● Mentions (1)     │  ● Honey 500g stock below reorder point        │
│  ● AI Tasks (3)     │    Current: 45 units  ·  Reorder at: 100       │
│                     │    [Create PO →]  [Snooze 1h]  [Dismiss]      │
│  LABELS             │                                                 │
│  ─────────────────  │  ...                                           │
│  + Add label        │                                                 │
└──────────────────────────────────────────────────────────────────────┘
```

### Inbox Sections

| Section | Description |
|---|---|
| **Tasks** | Items requiring a specific user action |
| **Approvals** | Business objects in an approval workflow step assigned to this user |
| **Assignments** | Records assigned to this user (orders, waves, etc.) |
| **Exceptions** | Critical business exceptions that escalated to this user |
| **Escalations** | Items escalated from another user or from an automated threshold |
| **Mentions** | Comments or notes where the user was mentioned |
| **AI Tasks** | AI recommendations flagged as requiring user decision |

### Inbox Actions (per notification)

- **One-click action**: Primary action button (Approve, View, Create, Assign, etc.)
- **Snooze**: Defer for 1h, 4h, tomorrow, or custom time
- **Dismiss**: Mark as done / no action needed
- **Labels**: Assign color labels for personal organization
- **Share**: Forward notification context to another user

---

## 7. Notification Preferences

Users control how they receive notifications from their Profile:

```
Notification Settings
──────────────────────────────────────────────────────
                         In-App  Email  WhatsApp  SMS
──────────────────────────────────────────────────────
SLA Breach (Critical)     ✓       ✓        ✓       ✓
Approval Required         ✓       ✓        ✓       —
Stock Alert               ✓       —        —       —
AI Recommendation         ✓       —        —       —
Mention                   ✓       ✓        —       —
Assignment                ✓       —        —       —
──────────────────────────────────────────────────────

Working Hours: [09:00 AM ▼]  to  [06:00 PM ▼]
Timezone: [Cairo (UTC+3) ▼]
Quiet Hours: ✓ Enabled  (no SMS/WhatsApp outside working hours)
```

**Rules:**
- In-app notifications are always delivered regardless of preferences
- External channel preferences follow the NotificationPolicy constraints
- Company admins can set minimum notification requirements (e.g. SLA breach always sends SMS)

---

## 8. Real-Time Delivery

In-app notifications are delivered in real-time via Laravel Reverb (WebSocket).

```
New notification arrives → Bell badge count increments → Toast appears (if Critical/High priority)
                        ↓
User opens Bell panel → notification appears at top
```

Notification panel auto-refreshes when new events arrive. No manual refresh needed.

---

## 9. Governance

| Rule | Constraint |
|---|---|
| UX-GOV-004 | Notification UX follows this standard — no module-specific notification panels |
| Backend | All notifications are generated by EPS-04; modules never generate notifications directly |
| Policy-driven | Every notification type must have a corresponding NotificationPolicy entry |
| Actionable | Every notification must have at least one action button or a Dismiss |
| No notification flooding | Rate limiting enforced by NotificationPolicy; no burst notifications |
| Audit trail | All notification deliveries logged in EPS-04 NotificationDelivery entity |
