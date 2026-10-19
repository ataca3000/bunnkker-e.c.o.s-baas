# ECOS Navigation Architecture

**Last updated:** 2026-07-16  
**Status:** Canonical — single source of truth established

---

## Overview

ECOS uses a two-level navigation system:

```
Module Rail (left strip)          Context Sidebar (secondary panel)
─────────────────────             ──────────────────────────────────
Commerce          ──────────────► Orders
Inventory                         Fulfillments
Operations                        Customers
Logistics         ──────────────► ── Geography ──
Marketing                           Egypt Geography
Administration                    ── Distribution ──
...                                 Distribution Zones
                                    Distribution Planning
```

Both levels are driven by a **single configuration file**.

---

## Single Source of Truth

```
frontend/src/config/module-navigation.ts
```

This is the **only** navigation configuration file in the system. Every other file that needs navigation data must derive it from here.

### What it exports

| Export | Used by |
|---|---|
| `APP_MODULES: AppModule[]` | ModuleRail, AppSidebar, mobile-menu |
| `findModuleByPath(pathname)` | `useActiveModule` hook |
| `findNavItemByPath(pathname)` | AppBreadcrumbs, ComingSoonPage |
| `ModuleId`, `AppModule`, `ModuleNavItem`, `ModuleNavLink`, `ModuleNavSection` | Type consumers |

---

## Navigation Flow

```
URL change
    │
    ▼
useActiveModule()                     ← hooks/use-active-module.ts
    │
    ├── findModuleByPath(pathname)    ← module-navigation.ts
    │       Searches APP_MODULES:
    │         1. m.defaultPath === pathname
    │         2. m.items[].path === pathname  (prefix match)
    │
    ▼
activeModule: AppModule | undefined
    │
    ├──► ModuleRail                   ← layout/module-rail.tsx
    │       Renders all APP_MODULES as rail icons.
    │       Highlights the active module's icon.
    │
    └──► AppSidebar                   ← layout/app-sidebar.tsx
            Renders activeModule.items as nav links.
            Section dividers use isSection: true items.
            Returns null if activeModule is undefined or items is empty.
```

---

## Route Registration Flow

Every new page requires exactly **two** registration steps:

### Step 1 — `src/router/routes.ts`

Add a path constant:

```ts
export const ROUTES = {
  // ...existing routes
  myNewFeature: '/my-module/my-feature',
} as const;
```

### Step 2 — `src/config/module-navigation.ts`

Add a nav item inside the correct module's `items` array:

```ts
{
  id: 'my-module',
  // ...
  items: [
    // ...existing items
    {
      key: 'my-feature',
      label: 'My Feature',
      path: ROUTES.myNewFeature,
      icon: SomeLucideIcon,
    },
  ],
},
```

### Step 3 — `src/router/router.ts`

Register the component:

```ts
import { MyFeaturePage } from '@/features/my-module/pages/my-feature-page';

// inside the children array:
{ path: ROUTES.myNewFeature, Component: MyFeaturePage },
```

That is all. No other file needs to change for a new page to appear in the sidebar with correct breadcrumbs and module activation.

---

## AppModule Shape

```ts
type AppModule = {
  id: ModuleId;          // unique identifier: 'logistics', 'commerce', etc.
  label: string;          // sidebar header + breadcrumb fallback
  railLabel: string;      // short label shown under rail icon (≤8 chars)
  icon: LucideIcon;       // rail icon
  defaultPath: string;    // where the rail icon navigates on click
  items: ModuleNavItem[]; // sidebar links (ModuleNavLink) and section headers (ModuleNavSection)
};
```

### Section headers

Use `isSection: true` to insert a non-clickable divider label between groups of items:

```ts
{ key: 'dist-section', label: 'Distribution', isSection: true },
{ key: 'dist-zones',   label: 'Distribution Zones', path: ROUTES.logisticsDistributionZones, icon: Network },
```

### Modules with no sidebar items

Set `items: []`. The module still appears in the rail and navigates to `defaultPath`. No sidebar is rendered (`AppSidebar` returns `null` when `items` is empty).

---

## Breadcrumbs and ComingSoonPage

Both derive their label from `findNavItemByPath(pathname)`:

```
pathname → findNavItemByPath → { label } → rendered as breadcrumb segment
```

The function searches:
1. Every `ModuleNavLink` in every module's `items` array (exact path match).
2. Every module's `defaultPath` (covers modules with `items: []`).

If no match is found, breadcrumbs show only "Home" and ComingSoonPage falls back to the label `"Module"`.

---

## What Was Removed

| File | Status | Reason |
|---|---|---|
| `src/config/navigation.ts` | **Deleted** 2026-07-16 | Duplicate flat list of nav items. Only `findNavItemByPath` was consumed (by 2 files). Function migrated to `module-navigation.ts` and consumers updated. `NAV_GROUPS` and `NAV_ITEMS` were unused by any layout component. |

---

## Module Registry

Current modules in `APP_MODULES` order:

| `id` | Rail label | Default path | Sidebar items |
|---|---|---|---|
| `dashboard` | Home | /dashboard | — |
| `pos` | POS | /pos | — |
| `commerce` | Commerce | /orders | Orders, Fulfillments, Customers, Product Mapping, Sync Logs |
| `inventory` | Inventory | /inventory/dashboard | Dashboard, Products, Raw Materials, Recipes, Price Review, Stock Ledger, Inventory Count, Waste, Liabilities, Categories, Units |
| `purchasing` | Procure | /purchasing/hub | Hub, Suppliers, Material Requests, Purchases, Invoices, Receiving, Returns |
| `finance` | Finance | /accounting | — |
| `crm` | CRM | /crm | — |
| `manufacturing` | Mfg. | /inventory/recipes | Production Orders |
| `operations` | Ops. | /operations/preparation/wave-workspace | Wave Workspace |
| `marketing` | Mktg. | /marketing | Dashboard, Initiatives, Campaigns, Assets, Connect, Studio, Automation… |
| `customerEngagement` | Engage | /customer-engagement | Inbox, Dashboard, Leads |
| `omnichannel` | Omni | /omnichannel | Inbox, Dashboard, Providers, Macros, Routing |
| `core` | Core | /core/business-attribution | Journey Explorer, Business Timeline |
| `logistics` | Logistics | /logistics/geography | Egypt Geography, Distribution Zones, Distribution Planning |
| `reports` | Reports | /reports | — |
| `administration` | Admin | /organization | Organization, Companies, Brands, Accounts, Channels, Warehouses, Teams, Users, Roles, Settings, Config OS |

---

## Adding a New Top-Level Module

When a new domain is large enough to warrant its own module (e.g., Fleet, HR, Accounting):

1. Add its `ModuleId` to the `ModuleId` union type in `module-navigation.ts`.
2. Push a new `AppModule` object into `APP_MODULES`.
3. Register all its routes in `routes.ts` and `router.ts`.
4. That is all — rail icon, sidebar, breadcrumbs, and mobile menu are automatic.

---

## Anti-Patterns (Do Not Do)

| Anti-pattern | Why it breaks |
|---|---|
| Adding a page only to `routes.ts` + `router.ts` | Page is reachable by URL but invisible in the UI |
| Creating a new `*-navigation.ts` config file | Splits the source of truth; future modules won't know which file to update |
| Importing `@/config/navigation` | File deleted; this will cause a build error — use `@/config/module-navigation` |
| Hardcoding path strings in nav items | Always reference `ROUTES.*` so a path change propagates everywhere automatically |
