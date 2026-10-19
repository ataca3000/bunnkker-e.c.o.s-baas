# Mobile UX — Standard

**Document:** MOBILE-UX-STANDARD  
**Version:** 1.0  
**Status:** APPROVED — Architecture Only  
**Date:** 2026-07-05  
**Task:** TASK-UX-ARCH-001  
**Parent:** ENTERPRISE-UX-ARCHITECTURE.md

---

## 1. Mission

> ECOS works everywhere. Operators on the warehouse floor, drivers in vehicles, managers reviewing dashboards on tablets, executives checking KPIs on their phones — all use the same system, adapted for their context.

Mobile is not a reduced version of ECOS. It is ECOS with different priorities.

---

## 2. Breakpoints

| Name | Width Range | Primary Device |
|---|---|---|
| `mobile` | 0–767px | Smartphones |
| `tablet` | 768–1199px | Tablets, large phones |
| `desktop` | 1200px+ | Laptops, workstations |

All three breakpoints must be designed before any workspace is considered complete.

---

## 3. Responsive Layout Strategy

### Desktop → Tablet

- Navigation Rail: collapses to icons-only (labels hidden)
- Context Sidebar: slides behind an overlay toggle (hamburger)
- DataGrid: fewer visible columns; horizontal scroll for the rest
- Detail Drawer: 90% width (full-width on small tablet)
- KPI Cards: 2 columns (from 4–6)
- Smart Toolbar: secondary actions collapse into a "More" menu

### Tablet → Mobile

- Navigation Rail: moves to bottom navigation bar
- Context Sidebar: full-screen slide-over
- DataGrid: switches to a **Card List** view by default
- Detail Drawer: opens full-screen
- KPI Cards: 1 column scrollable
- Smart Toolbar: search bar + essential actions only; rest in bottom sheet

---

## 4. Mobile Navigation

### Bottom Navigation Bar

On mobile, the Module Rail moves to the bottom of the screen:

```
┌──────────────────────────────────────────────────────────┐
│  Content Area                                            │
│                                                          │
│                                                          │
└──────────────────────────────────────────────────────────┘
│  ⌂ Home  │  📦 Inv  │  🚚 Ops  │  🛒 Ord  │  ⋯ More   │
└──────────────────────────────────────────────────────────┘
```

- 4 pinned modules + "More" (opens full module list)
- User can configure which 4 modules are pinned
- Active module is highlighted with accent color + top border

### Mobile Global Search

- Tap the search icon → search bar expands to full screen
- Instant results as user types
- Recent searches shown on focus
- AI natural language supported

---

## 5. Card List View (Mobile DataGrid)

On mobile, the DataGrid switches to a Card List — a vertically scrollable list of entity cards.

```
┌──────────────────────────────────────────┐
│  [Filter ▼]  [Sort ▼]     + New Order   │
├──────────────────────────────────────────┤
│  ┌────────────────────────────────────┐  │
│  │ ORD-00234  ●Preparing             │  │
│  │ Nour Market  ·  Cairo Zone 3      │  │
│  │ 12 items  ·  EGP 2,450.00         │  │
│  │ SLA: Today 2:00 PM  ⚡ At Risk    │  │
│  └────────────────────────────────────┘  │
│  ┌────────────────────────────────────┐  │
│  │ ORD-00235  ● Confirmed            │  │
│  │ Ahmed Market  ·  Alexandria       │  │
│  │ 6 items  ·  EGP 800.00            │  │
│  │ SLA: Tomorrow 10:00 AM            │  │
│  └────────────────────────────────────┘  │
│  ...                                     │
└──────────────────────────────────────────┘
```

**Card rules:**
- Primary identifier (ID or name) + status badge always in top row
- Max 4 lines of content per card
- Priority fields are surfaced first; less important fields are hidden
- Swipe right = primary action (Edit / Approve)
- Swipe left = secondary action (Archive / Dismiss)
- Long-press = select mode (for bulk actions)

---

## 6. Mobile Detail Drawer

On mobile, Detail Drawers open **full-screen** (100% width × 100% height).

```
┌──────────────────────────────────────────┐
│  ← Back  │  ORD-00234  ● Preparing [⋮] │
├──────────────────────────────────────────┤
│  SUMMARY                                 │
│  Nour Market · EGP 2,450 · 12 items     │
│  SLA: Today 2:00 PM  ⚡ At Risk         │
├──────────────────────────────────────────┤
│  [Overview] [Details] [Lines] [Timeline] │  ← scrollable tabs
├──────────────────────────────────────────┤
│  Tab content area (scrollable)           │
│                                          │
│                                          │
├──────────────────────────────────────────┤
│  [Primary Action]    [Secondary Action]  │  ← sticky footer
└──────────────────────────────────────────┘
```

**Mobile drawer rules:**
- Tabs are horizontally scrollable (no wrapping)
- Summary section collapses to a single-line strip on scroll
- Sticky header with back arrow, title, and action menu
- Sticky footer with primary/secondary actions
- Swipe left/right to navigate between records (same as desktop arrow navigation)

---

## 7. Touch Interactions

| Gesture | Action |
|---|---|
| Tap | Select / activate |
| Tap + hold | Multi-select mode |
| Swipe right | Primary action (context-dependent) |
| Swipe left | Secondary action (context-dependent) |
| Swipe down | Refresh (pull-to-refresh) |
| Pinch | Zoom (maps, images) |
| Two-finger scroll | Scroll within nested scroll areas |

**Touch target rules:**
- Minimum touch target: 44×44px (WCAG 2.1 AA)
- Preferred touch target: 48×48px for primary actions
- Spacing between touch targets: minimum 8px

---

## 8. Offline Behavior

ECOS is an online-first application. Offline support is limited but graceful.

| Capability | Online | Offline |
|---|---|---|
| View cached data | ✓ | ✓ (last sync) |
| Create records | ✓ | ✓ (queued; sync on reconnect) |
| Edit records | ✓ | ✓ (queued; sync on reconnect) |
| Real-time updates | ✓ | ✗ (stale data banner) |
| File upload | ✓ | ✓ (queued) |
| Search | ✓ | Partial (local cache only) |
| Reports / AI | ✓ | ✗ |

**Offline UI signals:**
- A yellow banner at the top: "You are offline. Changes are saved locally and will sync when you reconnect."
- Unsynced records are marked with a sync icon (⟳)
- Background sync resolves conflicts using last-write-wins by default; flagged conflicts require manual resolution

---

## 9. Mobile Notifications

On mobile, notifications are delivered via:
- **In-app**: Bell icon in bottom navigation; notification panel
- **Push notifications**: Native mobile push (when PWA is installed or native app is used)
- **WhatsApp / SMS**: For critical alerts when configured

Push notification tap opens the relevant object directly (deep link).

---

## 10. Performance on Mobile

| Target | Value |
|---|---|
| Time to Interactive (4G) | < 3 seconds |
| Time to Interactive (3G) | < 5 seconds |
| Card list render (25 items) | < 200ms |
| Drawer open animation | 200ms |
| Scroll frame rate | 60fps |
| Bundle size | < 200KB first meaningful paint |

**Optimization strategies:**
- Lazy load drawer tabs (only fetch data when tab is activated)
- Image lazy loading with blur placeholder
- Virtualized card list (no DOM nodes for off-screen items)
- Critical CSS inlined; non-critical CSS deferred

---

## 11. Accessibility on Mobile

- All touch targets ≥ 44×44px
- Screen reader support (VoiceOver on iOS; TalkBack on Android)
- Dynamic type support (font sizes scale with OS accessibility settings)
- High contrast mode support (respects OS setting)
- Reduced motion support (respects OS setting)
- No interactions that rely solely on gesture (always an alternative tap target)

---

## 12. Governance

| Rule | Constraint |
|---|---|
| UX-GOV-005 | Every workspace must be responsive and functional on mobile |
| Desktop first | Implement desktop layout first, then add responsive adaptations |
| No mobile-only modules | Every module must work on desktop and mobile; mobile may be simplified |
| Card list | DataGrid automatically uses card list on mobile; no separate mobile implementation |
| Full-screen drawer | On mobile, Detail Drawers are always full-screen — no 70%/90% sizing |
| Touch targets | Minimum 44×44px for all interactive elements on all screen sizes |
