# Business Rules (Decision Log)

**Status:** Official Reference
**Scope:** All approved design decisions (DD series) governing ECOS ERP behavior

> Every DD in this file has been approved. Mark future proposals as `Future` until approved.

---

## Decision Log

### DD-013 — Phone Cell Interaction

**Status:** Approved  
**Layer:** UI/UX

Clicking a phone number in any table or drawer must NOT initiate a phone call directly.

Instead: clicking a phone number opens a small action menu with:
- Call (opens `tel:` link)
- WhatsApp (opens `https://wa.me/` link)
- Copy Number (copies to clipboard)

**Rationale:** Accidental dialing wastes operator time and is disruptive in an office environment. The extra click to confirm intent is acceptable.

**Implementation:** `components/ecos/phone-cell.tsx` (generic) + domain wrappers per module.

---

### DD-020 — Order Immutability

**Status:** Approved  
**Layer:** Domain / Commerce

Orders are immutable snapshots of a point-in-time commercial agreement.

An order records:
- The customer's name and address *at time of order*
- The product names, SKUs, and prices *at time of order*
- The payment method *at time of order*

None of these fields are automatically modified when the underlying customer, product, or price list changes.

**Rationale:** An order represents what was agreed at the time of sale. Retroactively modifying order data would misrepresent the commercial agreement, affect financial reporting, and break the audit chain.

---

### DD-021 — Customer-Order Reference

**Status:** Approved  
**Layer:** Domain / Commerce

The Order entity stores:
1. A `customer_id` reference (nullable link to the Customer record)
2. A complete **snapshot** of the customer's billing/shipping data at time of order

The `customer_id` is used for analytics and customer timeline linking only.

Changes to the Customer record never propagate to existing orders.

If a customer is merged, the `customer_id` on historical orders is updated to the surviving customer ID. The order data (name, address, phone) is NOT changed.

---

### DD-022 — Order Modification Session

**Status:** Approved  
**Layer:** Domain / Commerce

Orders may be modified after creation through a controlled Modification Session.

Allowed modifications:
- Delivery address update (before dispatch)
- Tracking number / shipping company update (anytime)
- Notes and internal comments (anytime)
- Status transitions (per lifecycle rules)
- Manual discount (authorized role only)

All modifications are recorded with: modified_by, modified_at, old_value, new_value, reason.

Modifications to products or quantities require a supervisor role and are locked after Preparing status.

---

### DD-023 — Products Workspace Layout

**Status:** Approved  
**Layer:** UI/UX

The Products workspace uses a top-to-bottom layout:

Page Header → Quick Stats → Toolbar (Search + Controls) → Filter Bar → Data Table → Pagination

Quick Stats cards are clickable and act as instant filters.

No separate filter page or modal — all filtering is inline.

---

### DD-024 — Products Quick Stats

**Status:** Approved  
**Layer:** UI/UX

The Products workspace displays 5 quick stat cards:
- Total Products (neutral)
- Published (blue)
- Low Stock (amber)
- Not Synced (red)
- Inactive (gray)

Each card applies an instant filter when clicked. The active filter is highlighted.

---

### DD-025 — Status Tabs as Primary Navigation

**Status:** Approved  
**Layer:** UI/UX

For operational modules (Orders, Purchases, Fulfillments), the primary navigation is via **Status Tabs** — not sidebar navigation, not filter dropdowns.

Status tabs:
- Are shown as horizontally scrollable tabs below the page header
- Display live counts per status
- Are sticky (remain visible while scrolling the table)
- Reset the page number when switched
- Drive the entire context of the toolbar

---

### DD-026 — Filter Panel Behavior

**Status:** Approved  
**Layer:** UI/UX

Filters are organized into two tiers:
1. **Primary filters** (always visible): the most common filter fields
2. **Advanced filters** (collapsed, expandable): less common fields accessible via a "Filters" button

A "Clear All" button appears when any filter is active.

Filters do NOT navigate to a new page or open a modal.

---

### DD-027 — Toolbar Structure

**Status:** Approved  
**Layer:** UI/UX

Every operational workspace toolbar follows this structure (left to right):

`[Search] ... [Bulk Actions?] [Column Picker] [Density Toggle] [Refresh]`

The bulk actions section only appears when rows are selected.

---

### DD-028 — Context-Aware Smart Toolbar

**Status:** Approved  
**Layer:** UI/UX

The Smart Toolbar provides operation chips that are contextual to the active status tab.

- The **All** tab and unconfigured tabs show grouped operations (by: Customer, Shipping, Product)
- Specific status tabs show a flat list of the most relevant operations for that status

Operations are not duplicated between tabs.

---

### DD-029 — Operation Groups

**Status:** Approved  
**Layer:** UI/UX

Smart Toolbar operations are organized into semantic groups when in grouped view:

- **Customer** group: customer relationship operations (Repeated Customers, Same Status)
- **Shipping** group: shipping and logistics operations (Same Carrier, No Location, Multiple Attempts)
- **Product** group: product-level operations (Same Product)

Group headers are shown in small uppercase tracking text, not as buttons.

---

### DD-030 — Operations First

**Status:** Approved  
**Layer:** UI/UX Principle

Every button, filter, shortcut, or toolbar action in an operational module must satisfy ALL of:

- **Used frequently** in daily operations
- **Reduces clicks** or navigation steps
- **Saves operator time** per workflow cycle
- **Helps process groups of orders faster** (not just one at a time)
- **Fits naturally** into the existing workflow
- **Does not add visual clutter**

If a feature does not improve operational efficiency, it must not be added.

**No dead buttons. No stub actions. No placeholders.**

---

### DD-031 — Live Smart Operations

**Status:** Approved  
**Layer:** UI/UX

Smart Toolbar operation chips must display **live counts** derived from the current page data.

Rules:
- Counts are computed `O(n)` in `useMemo` over the current `orders` array — zero extra network requests
- Chips with count = 0 are **hidden** (not disabled — hidden)
- Exception: action chips (Print, Pack Queue) are always shown regardless of count
- Counts update automatically when the orders array changes (filter, page change, refresh)

---

### DD-032 — Inventory Domain Events

**Status:** Approved  
**Layer:** Domain / Inventory

The Inventory module publishes domain events for all stock movements.

All events include:
- `version` field (for forward-compatibility)
- `correlationId` (for request tracing)
- `warehouseId` (scoping)
- Timestamp in UTC

Events are logged to `sync_logs` table with correlation tracking.

---

### DD-033 — FIFO Costing Engine

**Status:** Approved  
**Layer:** Domain / Inventory

Inventory cost calculations use FIFO (First In, First Out) methodology.

- Each lot received is tracked with its purchase cost
- Issues deduct from the oldest lot first
- FIFO layers are stored in the stock ledger
- No weighted average — cost must be traceable to source purchase

---

### DD-034 — Stock Ledger as Source of Truth

**Status:** Approved  
**Layer:** Domain / Inventory

The Stock Ledger (`stock_ledger` table) is the single source of truth for all inventory.

Rules:
- All movements create ledger entries (never UPDATE stock directly)
- Ledger entries are immutable (INSERT only, never DELETE or UPDATE)
- Current stock is computed by summing all ledger entries for a product+warehouse
- Balance snapshots may be maintained for performance, but ledger is authoritative

---

### DD-035 — Channel Sync Dual-Run Mode

**Status:** Approved  
**Layer:** Infrastructure / Channels

The WooCommerce channel synchronization engine supports Dual-Run Mode during migration.

In Dual-Run:
- Sync runs via both the old and new synchronization paths simultaneously
- Results are compared and logged
- Discrepancies are reported but do not block operations
- After validation, the old path is disabled and new path becomes primary

---

### DD-036 — Inventory Counting (Cycle Count)

**Status:** Approved  
**Layer:** Domain / Inventory

Physical inventory counts use a Cycle Count methodology:

- Count sessions are created for a warehouse + set of products
- Warehouse staff records physical counts
- System calculates variance (counted vs expected)
- Variances above threshold require supervisor approval before adjustment
- All adjustments create stock ledger entries

---

### DD-037 — Reservation Policy

**Status:** Approved  
**Layer:** Domain / Inventory / Commerce

Stock is reserved when an order transitions to Confirmed status.

Rules:
- A reservation is created per order line (product + quantity + warehouse)
- Reservations reduce available stock for new orders
- If stock is insufficient for reservation, order moves to Waiting For Stock
- Reservation is released when: order is cancelled, rejected, or stock is issued
- Reservation is consumed (becomes an issue) when batch is prepared

---

### DD-038 — ABC Analysis Classification

**Status:** Approved  
**Layer:** Domain / Inventory Intelligence

Products are classified A/B/C based on cumulative revenue contribution:

- **Class A**: Top 70% of revenue (high value, ~20% of products)
- **Class B**: Next 20% of revenue (medium value)
- **Class C**: Bottom 10% of revenue (low value, ~50% of products)

Classification runs on demand (not scheduled). Each run creates a snapshot.

---

### DD-039 — Warehouse Scope

**Status:** Approved  
**Layer:** Domain / Inventory

All inventory operations are scoped to a specific Warehouse.

- Stock availability is per-product per-warehouse
- Transfers between warehouses create paired debit/credit ledger entries
- Orders are assigned a warehouse at Confirmed status
- Fulfillment Batches operate within a single warehouse per batch

---

### DD-040 — Shipping Attempts Tracking

**Status:** Approved  
**Layer:** Domain / Operations

The Order entity tracks the number of shipping attempts (`shipping_attempts: number`).

- Starts at 0 (never attempted)
- Increments each time a delivery is attempted but not completed
- Used in Smart Toolbar: `multipleAttempts` chip filters orders with 2+ attempts
- Color coding in table: 0=gray, 1=blue, 2=orange, 3+=red

---

### DD-041 — Order Location

**Status:** Approved  
**Layer:** Domain / Operations

Orders may have a geographic location associated (GPS coordinates).

- Location is separate from the shipping address
- Location is set by CS team after confirming delivery point with customer
- `ordersWithoutLocation` Smart Toolbar chip filters orders missing location
- Location enables map-based delivery features

---

### DD-042 — Bulk Actions Toolbar

**Status:** Approved  
**Layer:** UI/UX

A Bulk Actions toolbar appears ONLY when one or more table rows are selected.

- Shown below the Smart Toolbar, above the table
- Shows count of selected items ("3 orders selected")
- Contains relevant bulk operations (Confirm, Mark Shipping, Cancel, etc.)
- Disappears when selection is cleared

---

### DD-043 — Dark Mode and RTL Support

**Status:** Approved  
**Layer:** UI/UX

All ECOS UI components must support:
- **Dark Mode**: via Tailwind `dark:` classes and CSS variables
- **RTL (Right-to-Left)**: via `dir="rtl"` on the root element; layout must not break

No component may hardcode colors — use CSS variables (`text-foreground`, `bg-background`, etc.).

No component may use absolute left/right positioning without RTL equivalents.

---

### DD-044 — Keyboard Navigation

**Status:** Approved  
**Layer:** UI/UX

Operational interfaces must be keyboard-navigable.

Required shortcuts:
- `Ctrl+K` or `/` → Focus search input
- `Ctrl+N` → Create new entity
- `Esc` → Close drawer / clear search
- `Tab` → Move between form fields
- `Enter` → Confirm / Submit
- `Ctrl+S` → Save (in edit forms)

All interactive elements must be focusable and have visible focus rings.

---

### DD-055 — Phone First Experience

**Status:** Approved  
**Layer:** UI/UX / Customer Domain

The Customers Workspace is designed around phone numbers.

Customer Service operators search by phone first. Everything else is secondary.

Priority order:
1. Phone
2. Address
3. Previous Orders
4. Customer Details

When the Customers Workspace opens, the search box is auto-focused. The operator can immediately paste a phone number.

---

### DD-056 — Customer Quick Access

**Status:** Approved  
**Layer:** UI/UX / Customer Domain

Customer lookup is designed around incoming phone calls.

Search result behavior:
- **No results** → Show "Customer not found" + Create New Customer (phone prefilled)
- **Single result** → Show Customer Quick Card (do NOT auto-navigate)
- **Multiple results** → Show Customers Table

The Customer Quick Card shows: Name, Code, VIP badge, Primary Phone, Default Address, Last Order, Total Orders, Customer Memory indicator, Active Order shortcut.

---

### DD-057 — Customer Quick Action Card

**Status:** Approved  
**Layer:** UI/UX / Customer Domain

The Customer Quick Action Card is an **operational action hub**, not an information popup.

Its purpose is action, not browsing.

Layout:
- Customer Name + Code + Tags
- Primary Phone + WhatsApp + Call + Copy
- Default Address + Map + Copy
- Active Order (if exists)
- Customer Memory Preview (latest 3 pinned notes)
- Quick Actions: Open Active Order | Create New Order | Call | WhatsApp | Edit Address | Open Profile

**All actions must be completable without opening the full Customer Profile.**

---

### DD-059 — Create Customer Experience

**Status:** Approved  
**Layer:** UI/UX / Customer Domain

Customer creation must complete with the minimum required information.

Required fields: **Customer Name** + **Primary Phone** only.

All other information can be added later.

Entry points: Customers Workspace, Orders Workspace, Phone Lookup, Quick Action Card.

All entry points open the **same Customer Drawer** (no separate page).

Duplicate detection: while typing the phone number, search existing customers and display any match before allowing creation.

---

### DD-060 — Phone Before Customer

**Status:** Approved  
**Layer:** UI/UX / Customer Domain

Customer creation always starts with the primary phone number.

Step 1 → Enter primary phone  
Step 2 → Validate: exists? → Open existing customer | Doesn't exist → Continue to creation  
Step 3 → Minimal form (Name + Phone prefilled, all else optional)  
Step 4 → Save → Remain in drawer for optional additions

The phone number is **never typed twice**. If a customer is found, the existing customer is displayed without re-entering the phone.

---

## Index

| DD | Title | Status |
|----|-------|--------|
| DD-013 | Phone Cell Interaction | Approved |
| DD-020 | Order Immutability | Approved |
| DD-021 | Customer-Order Reference | Approved |
| DD-022 | Order Modification Session | Approved |
| DD-023 | Products Workspace Layout | Approved |
| DD-024 | Products Quick Stats | Approved |
| DD-025 | Status Tabs as Primary Navigation | Approved |
| DD-026 | Filter Panel Behavior | Approved |
| DD-027 | Toolbar Structure | Approved |
| DD-028 | Context-Aware Smart Toolbar | Approved |
| DD-029 | Operation Groups | Approved |
| DD-030 | Operations First | Approved |
| DD-031 | Live Smart Operations | Approved |
| DD-032 | Inventory Domain Events | Approved |
| DD-033 | FIFO Costing Engine | Approved |
| DD-034 | Stock Ledger as Source of Truth | Approved |
| DD-035 | Channel Sync Dual-Run Mode | Approved |
| DD-036 | Inventory Counting (Cycle Count) | Approved |
| DD-037 | Reservation Policy | Approved |
| DD-038 | ABC Analysis Classification | Approved |
| DD-039 | Warehouse Scope | Approved |
| DD-040 | Shipping Attempts Tracking | Approved |
| DD-041 | Order Location | Approved |
| DD-042 | Bulk Actions Toolbar | Approved |
| DD-043 | Dark Mode and RTL Support | Approved |
| DD-044 | Keyboard Navigation | Approved |
| DD-055 | Phone First Experience | Approved |
| DD-056 | Customer Quick Access | Approved |
| DD-057 | Customer Quick Action Card | Approved |
| DD-059 | Create Customer Experience | Approved |
| DD-060 | Phone Before Customer | Approved |
