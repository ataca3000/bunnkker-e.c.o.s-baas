# Activity System

**Status:** Approved (Architecture Package 01)
**Layer:** Cross-cutting (Commerce + Operations + Finance)

---

## 1. Overview

The ECOS Activity System provides a **unified activity feed** for every major business entity.

An entity's Activity Feed is the complete historical record of everything that happened to, around, or because of that entity.

### Entities with Activity Feeds

| Entity | Feed Name |
|--------|-----------|
| Customer | Customer Timeline |
| Order | Order Activity |
| Fulfillment Batch | Batch Activity |
| Product | Product History |
| Channel | Channel Activity |
| Warehouse | Warehouse Log |

---

## 2. Unified Activity Model

All activity events share the same base model, regardless of which entity they belong to.

### Base Activity Event

```
ActivityEvent
├── id (uuid)
├── entity_type: string  (e.g. "order", "customer", "batch")
├── entity_id: string
├── type: ActivityEventType
├── sub_type: string | null  (e.g. "status_changed", "phone_added")
├── content: string | null   (human-readable description)
├── metadata: json | null    (structured data for the event)
├── actor_type: "user" | "system" | "api"
├── actor_id: string | null  (user ID or system identifier)
├── actor_name: string | null
├── created_at: timestamp
└── attachments[]
    ├── id
    ├── name
    ├── url
    ├── mime_type
    └── size_bytes
```

---

## 3. Activity Event Types

### 3.1 Notes

A free-form text entry added by a user.

```
type: "note"
content: "Customer called — wants delivery between 2-5 PM"
actor: { type: "user", id: "...", name: "Sara Ahmed" }
```

Notes support:
- Rich text (markdown)
- Attachments (images, documents)
- @mentions (notify team members)
- Pinning (stay visible at the top)

### 3.2 Comments

Team discussion entries attached to an entity.

```
type: "comment"
content: "Confirmed address with customer — proceed"
metadata: { reply_to: "<event_id>" }
```

Comments support:
- Reply threading (one level deep)
- @mentions
- Reactions (thumbs up, etc.)

### 3.3 Mentions

Notification entries generated when a user is @mentioned in a note or comment.

```
type: "mention"
metadata: {
  mentioned_user_id: "...",
  mentioned_in_event_id: "...",
  context_snippet: "...wants delivery between 2-5 PM @sara please confirm..."
}
```

Mentions are stored as separate events so they can be queried as a notification feed per user.

### 3.4 Attachments

File uploads attached to an entity.

```
type: "attachment"
content: "Order confirmation PDF"
metadata: { file_name: "order-WC-12345.pdf", size: 124800, mime: "application/pdf" }
attachments: [{ id, name, url, mime_type, size_bytes }]
```

Attachment rules:
- Files are stored in object storage (S3 / compatible)
- Maximum file size: configurable per entity type
- Supported types: images (jpg, png, webp), documents (pdf, xlsx), audio (mp3)
- Attachments are never deleted when the event is archived

### 3.5 System Events

Events generated automatically by the system.

```
type: "system"
sub_type: "status_changed"
content: "Status changed from Confirmed to Preparing"
metadata: { from: "confirmed", to: "preparing" }
actor: { type: "system", name: "ECOS" }
```

System events are informational — they cannot be edited, deleted, or replied to.

### 3.6 Audit Events

High-importance system events that represent permission-sensitive operations.

```
type: "audit"
sub_type: "merge_completed"
content: "Customer CUST-0042 merged into CUST-0007"
metadata: { source_customer_id: "...", target_customer_id: "...", merged_by: "..." }
```

Audit events:
- Cannot be filtered out (always visible in audit mode)
- Cannot be archived or deleted
- Include the full diff of what changed (old values + new values)
- Available for compliance export

### 3.7 Phone Call Events

Manual call log entries.

```
type: "phone_call"
content: "Called customer — confirmed delivery address"
metadata: {
  phone_number: "01012345678",
  direction: "outbound",
  duration_seconds: 124,
  outcome: "confirmed" | "no_answer" | "voicemail" | "wrong_number"
}
```

### 3.8 Address Change Events

Generated when a customer address is added, edited, or deactivated.

```
type: "address_change"
sub_type: "address_added" | "address_edited" | "address_deactivated" | "default_changed"
content: "Default address changed to 'Work'"
metadata: { address_id: "...", old_values: {...}, new_values: {...} }
```

### 3.9 Merge Events

Generated when a customer merge is completed.

```
type: "merge_event"
sub_type: "merged_into" | "source_of_merge"
content: "Customer was merged into CUST-0007 by Ahmed"
metadata: {
  merge_id: "...",
  direction: "merged_into" | "source_of_merge",
  other_customer_id: "...",
  merged_by: "...",
  merged_at: "..."
}
```

### 3.10 Order Events (on Customer Timeline)

Order-related events appear in the customer's timeline.

```
type: "order_event"
sub_type: "order_created" | "order_delivered" | "order_cancelled"
content: "Order WC-12345 was delivered"
metadata: { order_id: "...", order_number: "WC-12345", status: "delivered", total: 350 }
```

---

## 4. Timeline

The Timeline is the read-layer view of the activity feed for a specific entity.

### Timeline Features

- **Chronological** — newest events first (or oldest first, user preference)
- **Filterable** by event type (Notes, Comments, System Events, Audit Events, etc.)
- **Searchable** — full-text search within event content
- **Paginated** — loads older events on scroll
- **Real-time** — new events appear without page refresh (WebSocket or polling)

### Timeline Grouping

Events may be grouped by date:
- Today
- Yesterday
- This week
- Older

---

## 5. Activity Panel UI

The Activity Panel is a reusable UI component embedded in every entity drawer.

### Panel Anatomy

```
Activity Panel
├── Filter Bar
│   ├── [All] [Notes] [Comments] [System] [Audit] [Calls] [Attachments]
│   └── Search input
├── Event List
│   ├── Event cards (one per event)
│   │   ├── Avatar + actor name + timestamp
│   │   ├── Event icon (type indicator)
│   │   ├── Content (text, rich text, or system message)
│   │   ├── Attachments (thumbnails)
│   │   └── Actions: Reply | Pin | Copy Link
│   └── Load older events...
└── Compose Box
    ├── Textarea (markdown supported)
    ├── Attachment button
    ├── @mention trigger
    └── [Add Note] button
```

### Compose Box Rules

- Shows at the bottom of the panel (sticky)
- Pressing Enter adds a line break; Ctrl+Enter submits
- @mention triggers a user search popover
- Attachment drag-and-drop is supported

---

## 6. Search

Activity can be searched at two levels:

### Entity-Level Search

Within a single entity's activity feed:
- Search by content text
- Filter by event type
- Filter by actor (user)
- Filter by date range

### Global Activity Search

Future: search across all entities for a specific note, @mention, or file.

---

## 7. Audit Events

Audit events are a special class of activity event intended for compliance and oversight.

### Audit Event Rules

1. **Immutable** — cannot be edited, archived, or deleted
2. **Always present** — cannot be filtered from the audit view
3. **Structured** — always include `old_values` and `new_values` in metadata
4. **Exportable** — available as CSV or JSON for compliance reporting
5. **Timestamped in UTC** — with microsecond precision

### Audit Retention

- Audit events are retained for the lifetime of the business
- Archiving an entity does not delete its audit events
- Merging customers carries all audit events to the surviving customer record

---

## 8. Future Integrations

- **WhatsApp Integration** — WhatsApp messages auto-logged as activity events with full conversation
- **Email Integration** — customer emails auto-appended to customer timeline
- **Call Recording** — phone calls auto-recorded and linked as audio attachments
- **Notification Engine** — @mentions and key events trigger push, WhatsApp, or email notifications
- **AI Summarization** — AI generates a summary of customer/order activity on demand
- **Automation Triggers** — activity events can trigger automated responses or workflows
