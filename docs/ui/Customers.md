# Customers Workspace UI Reference

**Module:** `frontend/src/features/customers/`  
**Status:** Implemented (UI Package 03 series)  
**Design:** DD-055, DD-056, DD-057, DD-059, DD-060

---

## 1. Core Design Principle — Phone First

The Customers Workspace is built around phone numbers (DD-055).

> Customer Service operators search by phone first. Everything else is secondary.

Priority order:
1. Phone
2. Address
3. Previous Orders
4. Customer Details

When the workspace opens, the search box is **auto-focused** (DD-055). The operator can immediately paste a phone number without touching the mouse.

---

## 2. Page Layout

Follows the ECOS Workspace Framework:

```
Page Header (title + Export + New Customer)
↓
Quick Stats (Total | Active | Inactive)
↓
Smart Search (auto-focused, phone-first)
  ├── Single result → Customer Quick Action Card (DD-056/057)
  ├── No results → "Customer not found" + Create CTA (DD-060)
  └── Multiple results → Data Table
↓
Data Table (when applicable)
↓
Pagination
```

---

## 3. Page Header

| Element | Details |
|---------|---------|
| Title | "Customers" |
| Subtitle | "Search by phone, name, order number or address." |
| Actions | Export button + New Customer button |

---

## 4. Quick Stats

Three clickable KPI cards. Source: 3 minimal API queries (`per_page: 1`).

| Card | Value | Filter On Click |
|------|-------|----------------|
| Total Customers | Global total | Clear all filters |
| Active | `status: 'active'` count | — |
| Inactive (90d) | `status: 'inactive'` count | — |

---

## 5. Smart Search (DD-055/056)

Single search box. Auto-focused on page mount.

**Search placeholder:** "Search by phone, name, address or order number…"

### Result Behaviors

| Result Count | Behavior |
|-------------|----------|
| 0 results | Show "Customer not found" card + "Create customer with this number" button |
| 1 result | Show Customer Quick Action Card (DD-057) — table is hidden |
| 2+ results | Show Customers Table |
| No search | Show Customers Table (all customers) |

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Esc` | Clear search + blur input |
| `Enter` | (first result already shown as Quick Card) |

---

## 6. Customer Quick Action Card (DD-057)

Shown when exactly **one** customer matches the search. An operational action hub — not an information popup.

### Layout

```
[Avatar] Customer Name  [×]
         Customer Code
         
📞 Phone Number ▼ (PhoneCell)  [+1 more]
📍 Address (city, country)
📋 Customer Memory Preview (if notes exist)

[Open Customer] [New Order]
[Call] [WhatsApp] [Copy Phone] [Copy Address]

── Status Badge ──
```

### Quick Actions

| Action | Effect |
|--------|--------|
| Open Customer | Opens CustomerFormDrawer in view/edit mode |
| New Order | Placeholder (opens order creation with customer prefilled) |
| Call | Opens `tel:` link |
| WhatsApp | Opens `https://wa.me/` in new tab |
| Copy Phone | Copies primary phone to clipboard |
| Copy Address | Copies formatted address to clipboard |
| ×  (close) | Clears search, returns to table |

Source: `features/customers/components/customer-quick-card.tsx`

---

## 7. No Results State

Shown when search returns 0 results.

```
Customer not found
No customer matches this phone number or name.

[Create customer with this number]
```

Clicking "Create customer with this number" opens the CustomerFormDrawer with:
- The searched phone number pre-filled
- Step 1 (phone validation) skipped — goes directly to form (DD-060)

---

## 8. Data Table

Shown when search returns 2+ results or when there's no active search.

### Columns

| Column | Content |
|--------|---------|
| Customer | Avatar (2-letter initials) + Name + Code |
| Phones | Primary phone (PhoneCell) + Primary badge + Secondary phone |
| Address | Street address, city, country (truncated) |
| Status | Active (emerald) / Inactive (gray) badge |
| Actions | Call icon + WhatsApp icon + ActionMenu (Edit, Copy Phone, Delete) |

### Row Behavior

- Clicking a row opens the CustomerFormDrawer (view/edit mode)
- Phone cell click intercepted (stops row click propagation)
- Actions column appears on hover (`opacity-0 → opacity-100`)
- Call and WhatsApp icon buttons visible on hover

---

## 9. Customer Form Drawer — Phone-First Flow (DD-060)

### Create Mode: 2-Step Flow

**Step 1 — Phone Validation:**
```
Enter Primary Phone Number
We'll check if this customer already exists.

[Phone input — auto-focused]

[Cancel]  [Continue →]
```
- `Enter` key triggers Continue
- System searches existing customers by phone
- If match found → show "Customer already exists" warning with [Open Existing Customer] + [Cancel]
- If no match → proceed to Step 2

**Step 2 — Customer Form:**
```
← Primary Phone (back button)

[Form fields: Name (required), Phone (prefilled), Mobile, Email, City, Country, Address, Notes, Active]

[Cancel]  [Create customer]
```
- Phone is pre-filled from Step 1
- Back button returns to Step 1
- Name is the only other required field

### Edit Mode

Opens directly at Step 2 (form). No phone validation step.

### Entry Points

All entry points open the same drawer:
- Customers Workspace → New Customer button
- Quick Card → (future: edit address)
- No Results state → "Create customer with this number" (phone pre-filled)
- Orders Workspace → (future: create customer while creating order)

Source: `features/customers/components/customer-form-drawer.tsx`

---

## 10. Responsive Rules

| Breakpoint | Behavior |
|------------|----------|
| Mobile `< 640px` | Search full-width; Quick Card full-width; table horizontal scroll |
| Tablet `640px–1024px` | Quick Card constrained to 448px (`max-w-md`) |
| Desktop `> 1024px` | Full layout; table shows all columns |

---

## 11. Dark Mode

All components use CSS variables. Badge colors use semantic `dark:` classes. Quick Card uses `bg-background` with `border`.

---

## 12. Keyboard Navigation

| Shortcut | Action |
|----------|--------|
| Auto-focus on mount | Search box receives focus immediately |
| `Esc` | Clear search |
| `Enter` in phone step | Proceed with phone lookup |
| `Tab` | Navigate form fields in drawer |
| `Ctrl+Enter` or form submit | Save customer |

---

## 13. Design Decisions

| DD | Rule |
|----|------|
| DD-055 | Phone First Experience — search auto-focused, phone before name |
| DD-056 | Single result → Quick Card (not table), multiple → table |
| DD-057 | Quick Action Card is an action hub, not an info popup |
| DD-059 | Create requires Name + Phone only; all else optional |
| DD-060 | Create always starts with phone; never type it twice |
| DD-013 | Phone cells open Call/WhatsApp/Copy menu |
| DD-042 | Bulk actions toolbar when rows selected (future) |
| DD-043 | Dark mode + RTL support |
| DD-044 | Keyboard navigation |

---

## 14. Components Used

| Component | Source |
|-----------|--------|
| `PageHeader`, `Pagination`, `ConfirmDialog` | `@/components/crud` |
| `EmptyState`, `ErrorState`, `ActionMenu` | `@/components/crud` |
| `QuickStatCard` | `@/components/ds` |
| `PhoneCell` | `@/components/ecos` |
| `CustomerQuickCard` | `features/customers/components/customer-quick-card` |
| `CustomerFormDrawer` | `features/customers/components/customer-form-drawer` |
| `CustomerFormFields` | `features/customers/components/customer-form` |

---

## 15. Future Enhancements (NOT implemented — requires approval)

1. **Multiple Phones Tab** — full phone management in drawer (Set Primary, Add Phone, Deactivate)
2. **Address Book Tab** — full address management with location pins
3. **Orders Tab** — customer's order history inside the drawer
4. **Activity Timeline** — unified activity feed per customer
5. **Customer Memory Tab** — pinned operational notes
6. **Smart Status Tabs** — All | Active | Inactive | VIP | Has Active Orders
7. **Bulk Selection** — checkbox per row, bulk operations (export, deactivate, merge)
8. **Column Visibility** — toggle visible columns, persist to localStorage
9. **Smart Operations Toolbar** — chips for Repeat Customers, VIP, etc.
10. **Merge Flow** — two-customer merge wizard with history preservation
