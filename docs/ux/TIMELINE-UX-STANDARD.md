# Timeline UX — Standard

**Document:** TIMELINE-UX-STANDARD  
**Version:** 1.0  
**Status:** APPROVED — Architecture Only  
**Date:** 2026-07-05  
**Task:** TASK-UX-ARCH-001  
**Parent:** ENTERPRISE-UX-ARCHITECTURE.md  
**Backend:** ENTERPRISE-TIMELINE-PLATFORM.md (EPS-02)

---

## 1. Mission

> Every business object has one Timeline. It looks identical everywhere. It is the immutable, chronological story of everything that happened to that object.

A user switching from the Order drawer to the Supplier drawer should immediately recognize the Timeline tab. The data changes; the layout never does.

---

## 2. Where Timeline Appears

Timeline is a standard tab in every Detail Drawer that supports the following object types:

| Object Type | Timeline Tab Required |
|---|---|
| Order | Yes |
| Customer | Yes |
| Product | Yes |
| Raw Material | Yes |
| Supplier | Yes |
| Vehicle | Yes |
| Shipment | Yes |
| Manufacturing Job | Yes |
| Preparation Wave | Yes |
| Inventory Item | Yes |
| Purchase Order | Yes |
| Employee | Yes |
| Company | Yes |

---

## 3. Timeline Layout

```
┌──────────────────────────────────────────────────────────────────────┐
│  TIMELINE  [Filter ▼] [Search...] [Export]          [+ Add Note]    │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  TODAY                                                               │
│  ─────────────────────────────────────────────────                  │
│  │                                                                   │
│  ●  10:23 AM  ·  Status changed to "Preparing"                      │
│  │  Osama Fayez  ·  Preparation OS                                  │
│  │                                                                   │
│  ●  09:15 AM  ·  Approved by Manager                                │
│  │  Jana Osama  ·  Approval Engine                                  │
│  │  > "Approved — all items checked"  (comment)                     │
│  │                                                                   │
│  ●  08:45 AM  ·  AI Insight: SLA at risk                            │
│  │  AI Platform  ·  Risk Engine                                     │
│  │  Prediction: 73% probability of delay                            │
│  │                                                                   │
│  YESTERDAY                                                           │
│  ─────────────────────────────────────────────────                  │
│  │                                                                   │
│  ●  06:30 PM  ·  Order confirmed                                     │
│  │  System  ·  Commerce OS                                           │
│  │                                                                   │
│  ●  04:00 PM  ·  Invoice attached                                    │
│  │  Osama Fayez  ·  Upload                                          │
│  │  📄 Invoice-2026-0234.pdf  (click to preview)                    │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 4. Timeline Entry Anatomy

Each entry has a consistent structure:

```
● [Type Icon]  HH:MM [AM/PM]  ·  [Entry title]
│  [Actor name]  ·  [Source module]               ← always shown
│  [Entry detail / comment / AI explanation]       ← shown when present
│  [Attachment link / Related object link]         ← shown when present
```

### Entry Type Icons

| Entry Type | Icon | Color |
|---|---|---|
| `event` | Lightning bolt | info |
| `status_change` | Arrow circle | accent |
| `comment` | Chat bubble | neutral |
| `note` | Pencil | neutral |
| `attachment` | Paperclip | neutral |
| `approval` | Check circle | success |
| `assignment` | Person arrow | info |
| `ai_recommendation` | Sparkles | warning (attention) |
| `manual_override` | Hand stop | warning |
| `system_event` | Gear | neutral (dimmed) |

---

## 5. Date Grouping

Entries are grouped by date with a sticky date label:

```
TODAY
YESTERDAY  
[Day of week, e.g. Monday]  (within the last 7 days)
[Month Day, e.g. June 15]   (within the current year)
[Month Day Year]            (older)
```

---

## 6. Filtering

The Filter button opens a filter panel above the timeline:

```
[Filter ▼]
  ├── Entry types (checkboxes): Events, Status changes, Comments, Approvals, AI, Documents, System
  ├── Actor: [search by name]
  ├── Source module: [multi-select]
  ├── Date range: [from] — [to]
  └── [Apply] [Reset]
```

**Quick filter chips** appear below the toolbar when filters are active:
```
× Type: AI, Approvals  ×  Actor: Jana Osama  ×  This week
```

---

## 7. Search

Full-text search across timeline entry titles and descriptions:

- Results highlight matching text
- Real-time; 150ms debounce
- Filters and search can be combined
- "No results" state shows search term and Reset button

---

## 8. Adding Comments and Notes

```
[+ Add Note] button → inline compose area appears at top of timeline

┌──────────────────────────────────────────────────┐
│ 📝  Add a note...                                │
│ ─────────────────────────────────────────────    │
│                                                  │
│ [Cancel]                          [Add Note]     │
└──────────────────────────────────────────────────┘
```

**Rules:**
- Notes are plain text; no markdown rendering
- Comments (linked to a specific other entry) are shown as replies with indent
- Notes and comments are the only mutable timeline entries (can be edited within 5 minutes; deleted by actor or admin)
- All other timeline entries are **immutable**

---

## 9. AI Entries

AI timeline entries have a distinct visual treatment:

```
● ✨  10:23 AM  ·  AI Insight: High delivery risk
│  AI Platform  ·  Risk Engine
│  73% probability of delay based on current wave status and historical patterns.
│  [View full explanation →]  [Dismiss]  [This was helpful ✓]
```

**Rules:**
- AI entries are always marked with the sparkles icon
- Always show the model/engine source
- Always include a confidence indicator or explanation
- "View full explanation" opens the AI UX panel
- Dismiss removes the AI entry from the timeline (soft-delete; AI learns from dismissal)
- Feedback (helpful / not helpful) is always present

---

## 10. System Events

System events are subtle — important for audit but not for day-to-day reading:

- Smaller font size (`text-sm`)
- Dimmed icon (neutral color)
- Collapsed by default when > 3 system events in a row; "Show N system events" expands

---

## 11. Timeline Export

The Export button exports the visible timeline to CSV or PDF:
- Respects active filters
- CSV: one row per entry with all fields
- PDF: formatted document with the same visual layout (for compliance/audit use)

---

## 12. Performance

| Target | Value |
|---|---|
| Timeline load (first 50 entries) | < 200ms |
| Load more (next 50 entries) | < 150ms |
| Search response | < 200ms |
| Filter apply | < 150ms |

---

## 13. Governance

| Rule | Constraint |
|---|---|
| UX-GOV-010 | Timeline layout is identical in every drawer — no custom timeline implementations |
| Immutability | Only comments/notes are editable; all event entries are read-only |
| Backend | All timeline data comes from EPS-02; no module maintains its own activity log |
| AI entries | Displayed using the standard AI entry pattern — no module customizes AI entry appearance |
| System events | Always shown but visually de-emphasized; never hidden by default |
