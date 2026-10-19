# Navigation System — Standard

**Document:** NAVIGATION-SYSTEM  
**Version:** 1.0  
**Status:** APPROVED — Architecture Only  
**Date:** 2026-07-05  
**Task:** TASK-UX-ARCH-001  
**Parent:** ENTERPRISE-UX-ARCHITECTURE.md

---

## 1. Mission

> Design a navigation architecture where users always know where they are, can get anywhere in 2 clicks, and never feel lost in a large enterprise system.

ECOS has many modules. The Navigation System must make all of them accessible without cognitive overhead. The user who lives in Procurement should be able to jump to Inventory and back without breaking their mental model.

---

## 2. Navigation Hierarchy

```
Level 1 — Global Navigation Rail
  Vertical icon rail on the left edge
  Always visible; switches top-level module areas

Level 2 — Context Sidebar
  Expands when a module area is active
  Shows sub-modules, sections, and pinned items

Level 3 — Workspace Tabs
  Horizontal tabs within a workspace
  Filter by status, type, or saved view

Level 4 — Detail Navigation
  Tabs inside the Detail Drawer
  Navigate between sections of one entity
```

---

## 3. Global Navigation Rail (Module Rail)

The Module Rail is the leftmost element of every ECOS screen. It is always visible.

### Rail Anatomy

```
┌────┐
│ ⌂  │  ← Home (Dashboard)
│    │
│ 🛒 │  ← Commerce
│ 📦 │  ← Inventory
│ 🏭 │  ← Manufacturing
│ 🚚 │  ← Operations
│ 🏪 │  ← POS
│ 👥 │  ← CRM
│ 📋 │  ← Procurement
│ 💰 │  ← Finance
│    │
│ ── │  ← Divider
│ ⚙  │  ← Configuration
│ 🤖 │  ← AI Platform
│    │
│ ── │  ← Bottom
│ 🔔 │  ← Notifications
│ 👤 │  ← Profile
└────┘
```

### Rail Rules

- **Icons only** when collapsed (default on most screens)
- **Icon + Label** when expanded (user toggle; persists)
- **Active module** highlighted with accent color + left border indicator
- **Notification badge** on Notifications icon (red dot with count)
- **Hover tooltip** shows module name when rail is collapsed
- **Keyboard navigation**: Tab through rail items; Enter to activate

### Rail Modules

| Icon Area | Module Group | Sub-modules |
|---|---|---|
| Commerce | Orders, Channels, Customers | Sales Orders, WooCommerce, Shopify |
| Inventory | Products, Raw Materials, Stock, Categories | All inventory sub-modules |
| Manufacturing | Recipes, Production, Quality | BOM, Production Jobs, QC |
| Operations | Preparation, Loading, Fulfillment | All Operations OSes |
| POS | Sessions, Sales, Cash | POS screens |
| CRM | Customers, Campaigns, Loyalty | CRM sub-modules |
| Procurement | Suppliers, Purchase Orders, Receiving | All Procurement sub-modules |
| Finance | Invoices, Payments, Reports | Finance screens |
| Configuration | Company, Policies, Features | Config OS |
| AI Platform | Models, Recommendations, Audit | AI management |

---

## 4. Context Sidebar

When a module area is active, the Context Sidebar expands to the right of the Rail.

### Sidebar Anatomy

```
┌──────────────────────────────┐
│  Module Name                 │
│  ─────────────────           │
│  ▼ Sub-Section A             │
│    ├── Page 1                │  ← active (highlighted)
│    ├── Page 2                │
│    └── Page 3                │
│  ► Sub-Section B             │  ← collapsed
│  ─────────────────           │
│  📌 PINNED                   │
│    Order #ORD-00234          │
│    Supplier Ahmed Trading    │
│  ─────────────────           │
│  🕐 RECENT                   │
│    Products — 2 min ago      │
│    Raw Materials — 1h ago    │
└──────────────────────────────┘
```

### Sidebar Sections

| Section | Description |
|---|---|
| **Navigation Tree** | Hierarchical list of all sub-modules in this area |
| **Pinned Items** | Business objects the user pinned (max 10) |
| **Recent Items** | Last 5 objects/pages visited in this module area |

### Sidebar Rules

- Sidebar collapses to zero width when the Rail icon is clicked again
- Sub-sections remember expanded/collapsed state per user
- Pinned items link directly to the object's Detail Drawer
- Recent items are deduplicated (same object visited 5 times = 1 recent entry)
- Sidebar width is resizable (min 200px, max 320px); persists

---

## 5. Global Search

Global Search is the fastest way to find anything in ECOS.

### Access

- **Keyboard**: `Cmd/Ctrl + K` opens the Command Palette (which includes search)
- **Click**: Search icon in Global Nav Bar
- **Inline**: Some workspaces have an always-visible search in the Smart Toolbar

### Search Anatomy

```
┌────────────────────────────────────────────────┐
│  🔍  Search orders, products, customers...     │
├────────────────────────────────────────────────┤
│  RECENT SEARCHES                               │
│  "Ahmed Al-Rashidi"  ·  "ORD-00234"            │
│                                                │
│  SUGGESTED                                     │
│  📦 Product · Honey 500g                       │
│  🛒 Order · ORD-00234 · Pending                │
│  👤 Customer · Ahmed Al-Rashidi                │
├────────────────────────────────────────────────┤
│  RESULTS FOR "honey"                           │
│  ─── Products ───                              │
│  📦 Honey 500g (SKU: HNY-500)                  │
│  📦 Honey 1kg (SKU: HNY-1000)                  │
│  ─── Raw Materials ───                         │
│  🧪 Sidr Honey Concentrate · Lot: 2026-007     │
│  ─── Orders ───                                │
│  🛒 ORD-00234 · Customer: Nour Market · 48 units│
└────────────────────────────────────────────────┘
```

### Search Behavior

| Behavior | Spec |
|---|---|
| **Instant results** | Results appear as user types; no Enter required |
| **Debounce** | 150 ms after last keystroke |
| **Result categories** | Grouped by entity type; max 3 results per category in dropdown |
| **Full results** | "See all results for X" navigates to full search results page |
| **Keyboard navigation** | Arrow keys navigate results; Enter opens selected |
| **Scope** | Searches within active company; Admin can toggle global company search |
| **AI enhancement** | Natural language queries: "orders from Cairo last week" |

---

## 6. Breadcrumbs

Breadcrumbs show the user's current location and allow navigation up the hierarchy.

### Breadcrumb Rules

- **Show when**: depth > 1 (i.e. inside a sub-module or entity view)
- **Never show**: on top-level module home screens
- **Truncation**: Long paths truncate the middle sections; first and last are always visible
- **Clickable**: Each segment is a link
- **Current page**: Last segment is not a link (visually distinct)

### Examples

```
Inventory > Products > Honey 500g
Procurement > Purchase Orders > PO-2026-00123
Operations > Preparation Waves > WAVE-2026-00045 > Materials
```

---

## 7. Favorites

Users can favorite any page or business object for quick access.

### Favoriting

- **Star icon** appears on hover on any module rail item, page header, or entity
- **Favorites** are listed at the top of the relevant Context Sidebar section
- **Max 20** favorites per user (configurable by admin)
- **Synced** across devices via server-side user preferences

---

## 8. Quick Switch

The Quick Switch allows rapid module-to-module jumps without mouse navigation.

### Access

- `G` then a letter: `G + I` = Inventory, `G + O` = Orders, `G + P` = Procurement, etc.
- The Quick Switch modal lists all available shortcuts

### Module Key Map

| Key | Module |
|---|---|
| `G + H` | Home |
| `G + O` | Orders (Commerce) |
| `G + I` | Inventory |
| `G + M` | Manufacturing |
| `G + W` | Operations (Waves) |
| `G + P` | Procurement |
| `G + C` | CRM |
| `G + S` | POS (Sales) |
| `G + F` | Finance |
| `G + X` | Configuration |

---

## 9. Company Switcher + Channel Switcher

### Company Switcher

- Located in the top of the Global Nav Bar
- Shows active company name + logo
- Click to open company selector
- Available to users with multi-company access
- Switching company reloads the current workspace in the context of the new company

### Channel Switcher

- Available in workspace headers where channel context matters (Commerce, Fulfillment, Config)
- Shows "All Channels" or specific channel name
- Filtering by channel is a workspace-level filter, not a navigation change

---

## 10. Command Palette

The Command Palette (`Cmd/Ctrl + K`) is a universal action layer.

### Capabilities

```
┌──────────────────────────────────────────────────────┐
│  ⌘K  Run a command...                               │
├──────────────────────────────────────────────────────┤
│  RECENT ACTIONS                                      │
│  Create Order                                        │
│  Open WAVE-2026-00045                                │
│                                                      │
│  NAVIGATE                                            │
│  Go to Products                                      │
│  Go to Procurement Hub                               │
│                                                      │
│  CREATE                                              │
│  New Purchase Order                                  │
│  New Preparation Wave                                │
│                                                      │
│  SEARCH                                              │
│  Search "honey" in Products                          │
└──────────────────────────────────────────────────────┘
```

### Command Types

| Type | Examples |
|---|---|
| **Navigate** | "Go to Products", "Open Order ORD-00234" |
| **Create** | "New Purchase Order", "Create Preparation Wave" |
| **Search** | "Search products for honey" |
| **Action** | "Export current view", "Refresh data" |
| **Settings** | "Open my preferences", "Toggle dark mode" |
| **AI** | "Ask AI about today's operations" |

---

## 11. URL Architecture

Every ECOS view has a unique, shareable URL.

### URL Structure

```
/[module]/[sub-module]/[object-type]/[object-id]?[filters]

Examples:
/inventory/products                           — Products workspace
/inventory/products?status=low_stock          — Filtered view
/inventory/products/PRD-001                   — Product drawer (URL triggers drawer open)
/procurement/purchase-orders/PO-001           — PO drawer
/operations/preparation/waves/WAVE-001/materials — Wave materials tab
```

### Deep Link Rules

- Every drawer state is URL-addressable
- Sharing a URL must reproduce the exact same view including active filters
- Active tab in drawer is part of the URL hash: `#timeline`
- Filters persist in URL query params (not just localStorage)
