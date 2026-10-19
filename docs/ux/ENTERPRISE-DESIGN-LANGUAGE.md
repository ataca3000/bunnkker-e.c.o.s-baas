# Enterprise Design Language

**Document:** ENTERPRISE-DESIGN-LANGUAGE  
**Version:** 1.0  
**Status:** APPROVED — Architecture Only  
**Date:** 2026-07-05  
**Task:** TASK-UX-ARCH-001  
**Parent:** ENTERPRISE-UX-ARCHITECTURE.md

---

## 1. Mission

> Establish the **visual vocabulary** of ECOS — the tokens, patterns, and constraints that make every module feel like part of one product.

The Enterprise Design Language is not a UI kit. It is not Figma. It is the **architecture-level definition** of visual standards. Implementation translates these standards into actual CSS variables, Tailwind tokens, and DS components.

---

## 2. Design Tokens

Design tokens are the only source of visual values in ECOS. No hardcoded color values, font sizes, or spacing numbers exist in any component. All visual values come from this token system.

### 2.1 Color System

#### Semantic Color Roles

| Role | Light Mode | Dark Mode | Usage |
|---|---|---|---|
| `color-surface-0` | White | Near-black | Page background |
| `color-surface-1` | Gray-50 | Dark gray | Card / panel background |
| `color-surface-2` | Gray-100 | Mid dark | Hover state / nested panel |
| `color-border` | Gray-200 | Dark border | Borders, dividers |
| `color-text-primary` | Gray-900 | White | Body text, headings |
| `color-text-secondary` | Gray-500 | Gray-400 | Labels, meta text |
| `color-text-disabled` | Gray-300 | Gray-600 | Disabled state text |
| `color-accent` | Brand Blue | Brand Blue | Primary action, active state, links |
| `color-accent-hover` | Darker Blue | Lighter Blue | Accent hover state |
| `color-accent-subtle` | Blue-50 | Blue-900 | Accent backgrounds, pill backgrounds |

#### Status Colors

| Semantic | Color | Usage |
|---|---|---|
| `color-success` | Green-600 | Completed, delivered, paid, active |
| `color-success-subtle` | Green-50 | Success badge background |
| `color-warning` | Amber-600 | Pending, in review, delayed |
| `color-warning-subtle` | Amber-50 | Warning badge background |
| `color-error` | Red-600 | Failed, blocked, cancelled, overdue |
| `color-error-subtle` | Red-50 | Error badge background |
| `color-info` | Blue-600 | Informational, in progress |
| `color-info-subtle` | Blue-50 | Info badge background |
| `color-neutral` | Gray-500 | Draft, unknown, archived |
| `color-neutral-subtle` | Gray-100 | Neutral badge background |

#### Status Color → State Mapping

| Status | Color Role | Examples |
|---|---|---|
| Active / Published / Delivered / Paid | success | order.delivered, supplier.active |
| In Progress / Pending / Loading | info | wave.preparing, po.in_transit |
| Warning / Delayed / At Risk | warning | stock.low, sla.at_risk |
| Blocked / Failed / Cancelled / Overdue | error | wave.blocked, payment.failed |
| Draft / Inactive / Archived | neutral | product.draft, employee.inactive |
| Pending Review / Awaiting Approval | warning | cost.pending_review |

### 2.2 Typography

| Token | Value | Usage |
|---|---|---|
| `text-3xl` | 30px / 700 | Page titles (rare) |
| `text-2xl` | 24px / 700 | Module headers |
| `text-xl` | 20px / 600 | Section headings, drawer titles |
| `text-lg` | 18px / 600 | Card titles, tab labels |
| `text-base` | 14px / 400 | Body text, table cells |
| `text-sm` | 12px / 400 | Labels, meta text, secondary info |
| `text-xs` | 11px / 500 | Badges, status chips, counts |

**Font family:** System UI stack — no custom font loading that increases Time to Interactive.

**Arabic (RTL):** Cairo font family preferred for Arabic text. All typography tokens apply equally to Arabic content.

### 2.3 Spacing

ECOS uses a 4px base grid.

| Token | Value | Usage |
|---|---|---|
| `space-1` | 4px | Micro spacing (icon gap, badge padding) |
| `space-2` | 8px | Tight spacing (chip padding, avatar gap) |
| `space-3` | 12px | Standard inner padding |
| `space-4` | 16px | Card padding, section gap |
| `space-5` | 20px | Component separation |
| `space-6` | 24px | Section separation |
| `space-8` | 32px | Large section gap |
| `space-12` | 48px | Page-level spacing |
| `space-16` | 64px | Major section separation |

### 2.4 Border Radius

| Token | Value | Usage |
|---|---|---|
| `radius-sm` | 4px | Buttons, inputs, small badges |
| `radius-md` | 8px | Cards, panels, dropdowns |
| `radius-lg` | 12px | Drawers, modals, large cards |
| `radius-xl` | 16px | Overlays, floating panels |
| `radius-full` | 9999px | Circular avatars, pill badges |

### 2.5 Shadow

| Token | Usage |
|---|---|
| `shadow-xs` | Subtle card border effect (1px border + very light shadow) |
| `shadow-sm` | Elevated cards, tooltips |
| `shadow-md` | Dropdowns, popovers, floating elements |
| `shadow-lg` | Drawers, side panels |
| `shadow-xl` | Modals, full overlays |

### 2.6 Motion

| Token | Value | Usage |
|---|---|---|
| `duration-fast` | 100ms | Micro interactions (hover, focus) |
| `duration-normal` | 200ms | Standard transitions (panel show/hide) |
| `duration-slow` | 350ms | Drawer open/close, page transitions |
| `easing-standard` | `ease-in-out` | Standard transitions |
| `easing-decelerate` | `ease-out` | Elements entering the screen |
| `easing-accelerate` | `ease-in` | Elements leaving the screen |

**Reduce Motion:** ECOS respects `prefers-reduced-motion`. All animations must have a reduced-motion fallback (instant transition).

---

## 3. Component Language

### 3.1 Status Badges

Status badges are the most repeated visual element in ECOS. They must be 100% consistent.

**Anatomy:** `[Dot] [Label]` on a subtle background.

```
● Active          (success color)
● Preparing       (info color)
● Blocked         (error color)
● Pending Review  (warning color)
● Draft           (neutral color)
```

**Rules:**
- Badge text is always the raw state label (not a user-facing translation of code)
- Arabic state labels are provided alongside English; badge displays based on user locale
- Badge never exceeds 1 line; text truncates at 120px
- No icons in badges (dot is sufficient)

### 3.2 Action Menus

Every action menu in ECOS follows the same structure:

```
Primary Action (most common, outside menu)
[▼ More]
  ├── Section A
  │   ├── Action 1 (with icon)
  │   └── Action 2 (with icon)
  ├── ─────────────────
  ├── Section B
  │   └── Destructive Action  (red text)
```

**Rules:**
- Destructive actions are always at the bottom of the menu, separated by a divider
- Each action has an icon (no exceptions)
- Maximum 2 sections with a divider
- No more than 7 actions total in a menu (promote or rethink if more needed)

### 3.3 Empty States

Every empty state uses the same layout:

```
        [ Icon ]
    No [Entity] Found
  Try adjusting your filters
  or create a new [entity].
  
  [+ Create [Entity]]   (primary action button)
```

**Rules:**
- Icon is a line-style icon from the DS icon set; 64px; `color-text-disabled`
- Title is "No [Entity] found" or context-specific
- Subtitle offers a hint (try search, adjust filters, or clear criteria)
- CTA is the primary action for this workspace (optional for read-only views)

### 3.4 Loading Skeleton

Every list/table shows skeleton rows while loading.

```
[  ████████████  ██████  ███  ]  ← skeleton row
[  ██████████████████  █████  ]
[  ████████  ██████████  ████ ]
...
```

**Rules:**
- 8 skeleton rows by default (configurable per workspace)
- Skeleton animation: subtle shimmer (left to right; 1.5s loop)
- Skeleton respects `prefers-reduced-motion` (no animation; static gray blocks)
- Skeleton columns match the actual column layout

---

## 4. Icon System

- **Icon set:** Lucide Icons (open source, consistent stroke weight)
- **Sizes:** 16px (inline), 20px (toolbar/nav), 24px (headers/standalone)
- **Stroke width:** 1.5px for all icons (consistent visual weight)
- **Color:** Inherits from text color (`currentColor`) unless semantic override
- **Module icons:** Each top-level module has a dedicated icon from the Lucide set

---

## 5. Localization and RTL

ECOS is Arabic-first in the Egyptian market. The design language fully supports RTL.

### RTL Rules

| Element | LTR | RTL |
|---|---|---|
| Layout direction | Left to right | Right to left (mirrored) |
| Navigation Rail | Left edge | Right edge |
| Drawer | Slides from right | Slides from left |
| Breadcrumbs | Left to right with `>` | Right to left with `<` |
| Table | Column headers left | Column headers right-aligned |
| Icons (directional) | Arrow right | Arrow left |
| Checkboxes | Left of label | Right of label |

**Non-mirrored elements (same in both directions):**
- Clocks and time values
- Charts and graphs
- Images and logos
- Brand marks

### Language Switching

- Language preference is per-user (stored server-side)
- Switching language reloads the current page
- All text strings are sourced from translation files — no hardcoded strings in components
- Date/number formats follow locale (Egyptian Arabic uses Arabic numerals; English uses Western)

---

## 6. Accessibility

All ECOS interfaces must meet **WCAG 2.1 AA** minimum.

| Requirement | Standard |
|---|---|
| Color contrast (text) | 4.5:1 minimum for normal text; 3:1 for large text |
| Color contrast (UI components) | 3:1 for borders, icons |
| Focus indicators | Always visible; 2px outline, `color-accent` |
| Touch target size | 44×44px minimum |
| Screen reader support | All interactive elements have `aria-label` or `aria-labelledby` |
| Keyboard navigation | All interactive elements reachable via Tab; logical focus order |
| Error messages | Linked to input via `aria-describedby` |
| Status changes | Announced via `aria-live` region |

### High Contrast Mode

ECOS supports `prefers-contrast: more`. Design tokens include high-contrast overrides.

---

## 7. Governance

| Rule | Constraint |
|---|---|
| UX-GOV-006 | No module creates its own design tokens or visual values |
| UX-GOV-007 | All visual values come from this design language's tokens |
| Token override | Only permitted via the documented CSS variable override mechanism; never inline styles |
| Color in code | No hex codes, RGB values, or named CSS colors in component files |
