# Orders Workspace UI Reference

**Module:** `frontend/src/features/orders/`  
**Status:** Implemented  
**Design:** [Orders UI Package 01/02 + DD-028–DD-031]

---

## 1. Page Layout

Follows the ECOS Workspace Framework:

```
Page Header (title, breadcrumbs, Import + New Order buttons)
↓
Status Tabs (sticky — All + 10 status tabs with live counts)
↓
Smart Operations Toolbar (sticky — context-aware chips + More menu)
↓
Advanced Filters Panel (collapsible)
↓
Customer Intelligence Filter (collapsible)
↓
Data Table (13 columns)
↓
Pagination
```

The status tabs and toolbar are both sticky so they remain visible while scrolling.

---

## 2. Page Header

| Element | Details |
|---------|---------|
| Title | "Orders" |
| Subtitle | "Manage commerce orders from all channels" |
| Breadcrumbs | Home → Orders |
| Primary Action | **New Order** button |
| Secondary Action | **Import** button (placeholder) |

---

## 3. Status Tabs

Horizontally scrollable, sticky below page header.

| Tab | Status Key |
|-----|------------|
| All | `'all'` |
| Processing | `processing` |
| Awaiting Payment | `waiting_for_payment` |
| Review Confirmation | `review_confirmation` |
| Confirmed | `confirmed` |
| Preparing | `preparing` |
| Shipping | `shipping` |
| Delivered | `delivered` |
| Rejected | `rejected` |
| Cancelled | `cancelled` |

Each tab shows a live count badge (capped at 999+).

Active tab: primary color + underline accent.

Source: `features/orders/components/order-status-tabs.tsx`

---

## 4. Smart Operations Toolbar

Context-aware operation chips. Sticky below status tabs. (DD-028, DD-031)

### Operation Keys (OpKey)

| Key | Count Logic | Action on Click |
|-----|-------------|-----------------|
| `repeatedCustomers` | Orders sharing a `customer.id` on current page | Apply `customerFilter: 'repeated'` |
| `repeatedSameStatus` | Same as above | Apply `customerFilter: 'repeated'` |
| `sameProduct` | Orders sharing a `product_id` | Apply `advancedFilters.productId` |
| `sameShippingCompany` | Orders sharing `shipping_company_name` | Apply `advancedFilters.shippingCompany` |
| `ordersWithoutLocation` | Orders with `location === null` | Set `hasLocation: false` |
| `multipleAttempts` | Orders with `shipping_attempts >= 2` | Set `minShippingAttempts: 2` |
| `printOrders` | Total orders count (ALWAYS_SHOW) | `window.print()` |
| `packingQueue` | Total orders count (ALWAYS_SHOW) | Placeholder |
| `callCustomer` | Orders with `billing_phone` set | Open `tel:` link |
| `codOrders` | Orders with `payment_method === 'cod'` | Apply `advancedFilters.paymentMethod: 'cod'` |

### Grouped View (All Tab + Unconfigured Tabs)

```
[CUSTOMER] Repeated Customers (N) | Repeated + Status (N)
[SHIPPING] No Location (N) | Multiple Attempts (N) | Same Carrier (N)
[PRODUCT] Same Product (N)
| More ▼
```

### Context View (Specific Status Tabs)

| Status Tab | Ops Shown |
|------------|-----------|
| `waiting_for_payment` | Repeated Customers, Call Customer, COD Orders |
| `shipping` | Same Carrier, No Location, Multiple Attempts, Call Customer |
| `preparing` | Same Product, Print, Pack Queue |

### More Menu

Always available, 4 items:
- VIP Customers → `customerFilter: 'more_than_10'`
- *(separator)*
- Repeated + Same Product → combination filter
- Repeated + Same Carrier → combination filter

### Live Count Rules (DD-031)

- All counts computed `O(n)` in `useMemo` over the current page `orders` array
- Zero extra network requests
- Chips hidden when count = 0 (exception: `printOrders`, `packingQueue` always shown)
- Chips show count badge: `bg-primary/15 text-primary`

Source: `features/orders/components/order-smart-toolbar.tsx`

---

## 5. Advanced Filters Panel

Collapsible panel shown via "Filters" button.

| Filter | Type | Query Param |
|--------|------|-------------|
| Product | Combobox (API-driven) | `product_id` |
| Payment Method | Text input | `payment_method` |
| Shipping Company | Text input | `shipping_company` |
| Date From | Date input | `date_from` |
| Date To | Date input | `date_to` |
| Clear All | Button | Resets all 5 filters |

Source: `features/orders/components/order-advanced-filters.tsx`

---

## 6. Customer Intelligence Filter

Collapsible panel activated by Smart Toolbar or More menu.

| Filter | Key | Effect |
|--------|-----|--------|
| Repeated Customers | `'repeated'` | Shows customers with 2+ orders |
| VIP (10+ Orders) | `'more_than_10'` | Shows VIP customers |

Query param: `customer_filter`

Source: `features/orders/components/order-customer-intelligence.tsx`

---

## 7. Quick Actions

| Action | Trigger | Effect |
|--------|---------|--------|
| New Order | Header button | Opens form drawer in create mode |
| Import | Header button | Toast: placeholder |
| View Order | Click row | Opens detail drawer |
| Edit | Row hover / More menu | Opens form drawer in edit mode |
| Status Change | Row More menu | Mutation to change status |
| Delete | Row More menu (destructive) | ConfirmDialog → `deleteOrder` mutation |

---

## 8. Data Table

### Columns (Fixed Order)

| # | Column | Content |
|---|--------|---------|
| 1 | Checkbox | Select row / Select All |
| 2 | Order Number | `order_number`, monospace, clickable |
| 3 | Store/Channel | `channel.name` |
| 4 | Customer | `OrderCustomerBadge` — name + stats popover |
| 5 | Phone | `PhoneCell` — Call/WhatsApp/Copy dropdown |
| 6 | Status | `OrderStatusBadge` — 13 states |
| 7 | Total | Formatted currency, right-aligned |
| 8 | Payment | `payment_method` or title |
| 9 | Items | Count of order lines |
| 10 | Address | `OrderAddressCell` — location indicator |
| 11 | Attempts | Color-coded: 0=gray, 1=blue, 2=orange, 3+=red |
| 12 | Carrier | `shipping_company_name` |
| 13 | Actions | Edit button + More menu |

### Features

- **Selection**: Checkbox per row + Select All in header
- **Sorting**: `order_number`, `created_at`, `total`, `status`
- **Loading**: 8 skeleton rows
- **Empty State**: "No orders found" with illustration
- **Hover Actions**: Edit button appears on hover
- **Sticky Header**: while scrolling

---

## 9. Order Drawer

Multi-tab detail drawer, opened on row click.

| Tab | Content |
|-----|---------|
| Summary | Order #, date, status, channel, external ID, payment method, financial summary |
| Customer | Name, email, phone (PhoneCell), billing address, shipping address |
| Items | Order lines table: product, quantity, price, total |
| Shipping | Carrier, tracking number, address, attempts history |
| Payment | Method, transaction ID, date paid |
| Manufacturing | Linked manufacturing orders (if any) |
| Notes | Customer note, internal notes |
| Timeline | Status events, modifications, communications |
| History | Full change log |
| Location | Map (if location coordinates set) |

---

## 10. Order Form Drawer

Used for create and edit modes.

Header fields:
- Order Number / External ID
- Channel
- Customer (searchable combobox)
- Status

Product lines editor:
- Add/remove lines
- Product search per line
- Quantity, price override

Financial summary (live calculated):
- Subtotal, shipping, discount, tax, **total**

---

## 11. Responsive Rules

| Breakpoint | Behavior |
|------------|----------|
| Mobile `< 640px` | Tabs scroll horizontally; toolbar chips scroll; table horizontal scroll; fewer columns visible |
| Tablet `640px–1024px` | Tabs + toolbar visible; most columns shown |
| Desktop `> 1024px` | Full layout; all 13 columns; sticky tabs + toolbar |

---

## 12. Dark Mode

All components use CSS variables. Status badges use `dark:` semantic variants. No hardcoded colors.

---

## 13. Keyboard Navigation

| Shortcut | Action |
|----------|--------|
| `Ctrl+K` or `/` | Focus search |
| `Esc` | Clear search / close drawer |
| `Ctrl+N` | New Order |
| Tab / Enter | Form navigation |

---

## 14. Design Decisions

| DD | Rule |
|----|------|
| DD-013 | Phone cell opens Call/WhatsApp/Copy menu |
| DD-025 | Status tabs as primary navigation |
| DD-028 | Context-aware smart toolbar per status tab |
| DD-029 | Toolbar operations grouped by Customer / Shipping / Product |
| DD-030 | Operations First — no placeholder buttons |
| DD-031 | Live counts from current page, hide when zero |
| DD-040 | Shipping attempts color coding |
| DD-041 | Order location tracking |
| DD-042 | Bulk actions toolbar when rows selected |
| DD-043 | Dark mode + RTL support |
| DD-044 | Keyboard navigation |

---

## 15. Components Used

| Component | Source |
|-----------|--------|
| `PageHeader`, `Pagination`, `ConfirmDialog` | `@/components/crud` |
| `QuickStatCard`, `Tabs` | `@/components/ds` |
| `PhoneCell` | `@/components/ecos` |
| `OrderStatusTabs` | `features/orders/components/order-status-tabs` |
| `OrderSmartToolbar` | `features/orders/components/order-smart-toolbar` |
| `OrderTable` | `features/orders/components/order-table` |
| `OrderDetailDrawer` | `features/orders/components/order-detail-drawer` |
| `OrderFormDrawer` | `features/orders/components/order-form-drawer` |
| `OrderAdvancedFilters` | `features/orders/components/order-advanced-filters` |
| `OrderCustomerIntelligence` | `features/orders/components/order-customer-intelligence` |
| `OrderStatusBadge` | `features/orders/components/order-status-badge` |
| `OrderCustomerBadge` | `features/orders/components/order-customer-badge` |
| `OrderAddressCell` | `features/orders/components/order-address-cell` |
