# Customer Domain

**Status:** Approved (Domain Sprint 01)
**Layer:** Commerce

---

## 1. Customer Identity

Customer is an **independent first-class entity** in ECOS ERP.

A Customer is NOT an Order. A Customer exists independently of whether they have any orders.

Orders reference a Customer — a Customer does not belong to an Order.

### Identity Rules

- A Customer is uniquely identified by their **primary phone number**
- Two customers may share the same name without being merged
- Customer identity is established at creation and never automatically merged
- The primary phone number is the operational identity (used for lookup, deduplication, search)

---

## 2. Phone Numbers

### Multiple Phones

A Customer may have multiple phone numbers.

Each phone number has:
- **Number** — the phone number string
- **Label** — optional label (e.g. "Personal", "Work", "Home")
- **Is Primary** — boolean; exactly one number is marked primary at any time
- **Is Active** — boolean; inactive numbers are preserved but hidden by default
- **Created At** — timestamp
- **Added By** — user reference

### Primary Phone

- Exactly one phone number is marked as primary at all times
- The primary phone is the default for Call, WhatsApp, Copy actions
- Changing the primary phone is logged in the customer timeline
- A customer must always have at least one active phone number

### Search Rules

- Searching any stored phone number (primary or secondary, active or inactive) returns the same customer
- Phone number search is exact and normalized (strips formatting, keeps digits)
- Phone numbers are **never** searchable across customer merge history — only the surviving customer's numbers apply

### No Automatic Merging

- Phone numbers are never automatically merged or transferred between customers
- If the same number appears on two customers, a **suggestion** is shown
- Resolution is always manual and requires explicit user action

---

## 3. Customer Creation

### Deduplication First

Customer creation always begins with phone validation:

1. Operator enters a primary phone number
2. System checks all stored phone numbers (primary + secondary)
3. If a match is found → existing customer is displayed
4. If no match → creation proceeds

### Creation Rules

- If no phone number matches: **always create a new customer**, even if another customer has the same name
- Two customers may legitimately share a name (common names, family members ordering separately)
- Required fields: **Customer Name** + **Primary Phone** only
- All other fields are optional and can be completed later

---

## 4. Smart Suggestions

When customer data is similar to an existing customer (same name + similar address, or same address + different phone):

- A **suggestion panel** is shown with the potentially similar customer
- The suggestion is informational only — no automatic action is taken
- The operator decides: ignore, investigate, or merge
- Smart suggestions are **never** automatically acted upon

Suggestion triggers (examples):
- Same name + same city + created within 30 days
- Same default address + different phone
- Same name + phone is 1 digit different (possible typo)

---

## 5. Customer Merge

### Merge Policy

- Customer merge is **always manual** — no automatic merging
- Merge requires explicit **Merge Permission** (role-based access control)
- The merge operation must be deliberately initiated by an authorized user

### Merge Process

1. Select two customers to merge (merge source + merge target)
2. Choose which data to keep (phones, addresses, memory, tags)
3. Review merge preview
4. Confirm merge
5. All historical orders from both customers are reassigned to the surviving customer
6. The merged (source) customer is **archived**, not deleted

### Merge Preservation

- All orders from both customers are preserved and reassigned to the surviving customer
- All phone numbers from both customers are preserved (secondary numbers are carried over)
- All addresses from both customers are available in the surviving customer's address book
- Customer Memory from both customers is concatenated
- Timeline entries from both customers are merged into the surviving customer's timeline
- The merged customer entry is archived with an audit record of the merge

### Audit

- Every merge records: merged_by, merged_at, source_customer_id, target_customer_id, data_kept
- The archived customer record is preserved indefinitely for audit and legal purposes

---

## 6. Address Book

Each Customer owns multiple addresses. Every address is an independent entity.

### Address Fields

| Field | Type | Required |
|-------|------|----------|
| Address Name | string | Yes (e.g. "Home", "Work", "Mother's House") |
| Recipient Name | string | Yes |
| Recipient Phone | string | No |
| Governorate | string | Yes |
| City | string | Yes |
| Area | string | No |
| Full Address | text | Yes |
| Location | geo coordinates | No |
| Delivery Notes | text | No |
| Is Default | boolean | No (one per customer) |
| Is Active | boolean | Yes |

### Address Rules

- A customer may have unlimited addresses
- Exactly one address may be marked as default (optional — a customer may have no default)
- Addresses are never deleted; they are deactivated (preserves order history)
- The default address is pre-populated when creating a new order for this customer
- Addresses are independent of orders — editing an address does not affect existing orders

---

## 7. Order Snapshot

Orders always **copy** customer information at the time of order creation.

This snapshot includes:
- Customer name
- Billing phone
- Billing address
- Shipping name, phone, and address

**Customer updates never modify previous orders.** This is an absolute rule.

If a customer changes their address after an order is created, the order retains the original address. This preserves the historical accuracy of what was agreed at time of sale.

---

## 8. Customer Memory

Customer Memory is a persistent, operational notes area — distinct from the order-level notes.

### Purpose

Customer Memory stores long-term behavioral and preference notes about a customer that are relevant across all interactions.

### Examples

> Prefers WhatsApp over phone calls
> Call after 6 PM only
> Usually changes delivery address — always confirm before shipping
> Prefers cash on delivery
> VIP — always prioritize
> Do not leave with neighbor

### Rules

- Customer Memory is **pinned** — always visible in the customer drawer header area
- Customer Memory is separate from the Activity Timeline
- Multiple memory notes can be created; each is individually pinnable
- Memory notes can be created by any authorized user
- Memory notes are never deleted — they are archived when no longer relevant
- Memory notes appear in the Customer Quick Card and Quick Action Card for immediate visibility

---

## 9. Activity Timeline

The Customer owns a **unified Activity Timeline** that aggregates all interactions and events across the customer's lifetime.

### Timeline Event Types

| Category | Events |
|----------|--------|
| Notes | Operator notes, freeform text |
| Comments | Team comments on the customer |
| Mentions | @mention notifications |
| Attachments | Documents, images, receipts |
| Phone Calls | Call log entries (manual + future: auto-log) |
| Address Changes | When an address is added, edited, deactivated, or set as default |
| Merge Events | When a customer is merged (from or into this customer) |
| Order Events | Order created, order status changes, order cancelled |
| System Events | Customer created, phone added, memory note pinned |

### Timeline Rules

- All events are timestamped and attributed to a user or system
- Timeline is append-only — events cannot be deleted
- Timeline supports search and filter by event type, user, and date range
- Future: timeline may include WhatsApp message history, email threads, call recordings

---

## 10. Audit

Every customer modification records a complete audit trail.

### Audit Fields

| Field | Description |
|-------|-------------|
| Created By | User who created the customer |
| Created At | Timestamp of creation |
| Last Modified By | User who made the most recent change |
| Last Modified At | Timestamp of most recent change |
| Reason | Required for certain operations (merge, deactivation) |

### Audited Operations

- Customer creation
- Phone number changes (add, remove, set primary, deactivate)
- Address changes (add, edit, set default, deactivate)
- Customer Memory changes
- Tag changes
- Merge operations
- Customer status changes

---

## 11. Entity Relationships

```
Customer
├── id
├── code (auto-generated, unique)
├── name
├── type (retail | wholesale | vip)
├── status (active | inactive | archived)
├── tags[]
├── created_by
├── created_at
├── modified_by
├── modified_at
│
├── PhoneNumbers[]
│   ├── id
│   ├── number
│   ├── label
│   ├── is_primary
│   ├── is_active
│   ├── created_by
│   └── created_at
│
├── Addresses[]
│   ├── id
│   ├── name
│   ├── recipient_name
│   ├── recipient_phone
│   ├── governorate
│   ├── city
│   ├── area
│   ├── full_address
│   ├── location { lat, lng }
│   ├── delivery_notes
│   ├── is_default
│   ├── is_active
│   ├── created_by
│   └── created_at
│
├── MemoryNotes[]
│   ├── id
│   ├── content
│   ├── is_pinned
│   ├── is_archived
│   ├── created_by
│   └── created_at
│
├── ActivityEvents[]
│   ├── id
│   ├── type
│   ├── content
│   ├── metadata
│   ├── created_by
│   └── created_at
│
└── Orders[] (referenced, not owned)
    └── → Order.customer_id
```

---

## 12. Suggested UI Structure

### Customers Workspace

```
Page Header: "Customers" + [New Customer] [Merge] [Export] [Import]
↓
Quick Stats: Total | New | Returning | VIP | Active Orders | Inactive (90d)
↓
Smart Search: phone | name | recipient | order number | address
↓
Filters: Channel | Governorate | City | Type | Tags | Created Date | Last Order Date
↓
Smart Operations: New Customer | Merge | Export | Print | More ▼
↓
Bulk Actions (when rows selected)
↓
Customers Table:
  Customer | Phones | Default Address | Previous Orders | Intelligence | Actions
↓
Pagination
```

### Customer Drawer Tabs

```
Summary → Customer card, primary phone, default address, last order, quick actions
Phones → All numbers, primary badge, Call/WhatsApp/Copy/Set Primary actions
Addresses → Card layout, location, default badge, Navigate/Copy/Edit actions
Orders → Order list with status, date, total
Activity → Unified timeline with filter/search
Customer Memory → Pinned notes, quick add
Attachments → Documents, images
Statistics → Orders, revenue, preferences, behavior
Audit → Full change log
```

---

## 13. Open Questions

1. **Customer Code Format** — auto-generated (e.g. CUST-001234) or user-defined? Who can edit it?
2. **Phone normalization** — should +20 and 0 prefix be treated as the same number? Which format is canonical?
3. **Customer Type** — are Wholesale customers billed differently? Is type used in pricing rules?
4. **Inactive Customer Rules** — what makes a customer inactive? 90 days without order? Manual toggle?
5. **Duplicate Detection Threshold** — what similarity score triggers a suggestion? Is it configurable?
6. **Merge Permissions** — which roles can merge? Is there an approval workflow for merges?
7. **Address Geocoding** — is location always entered manually, or should there be auto-geocoding from address fields?
8. **Activity Feed Scope** — should the customer timeline include ALL order status events, or only key milestones?

---

## 14. Future Enhancements

- **WhatsApp Integration** — auto-log WhatsApp conversations to the customer timeline
- **Call Recording** — log phone calls and attach recordings to the timeline
- **Customer Scoring** — automated score based on order frequency, value, cancellation rate
- **Loyalty Points** — track and display loyalty points balance
- **Customer Segments** — automatic segment assignment based on behavior rules
- **AI Insights** — suggest optimal call time based on past interaction patterns
- **Document Management** — national ID, contracts, signed forms attached to customer
- **Customer Portal** — self-service portal for address management and order tracking
