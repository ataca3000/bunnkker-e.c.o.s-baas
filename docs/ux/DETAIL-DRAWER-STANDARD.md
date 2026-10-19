# Detail Drawer — Standard

**Document:** DETAIL-DRAWER-STANDARD  
**Version:** 1.0  
**Status:** APPROVED — Architecture Only  
**Date:** 2026-07-05  
**Task:** TASK-UX-ARCH-001  
**Parent:** ENTERPRISE-UX-ARCHITECTURE.md

---

## 1. Mission

> Define the **Universal Detail Drawer** — the single pattern for viewing and editing any business object in ECOS. Every drawer looks the same, opens the same way, and supports the same sections.

The drawer is the fundamental unit of work in ECOS. Users live in drawers. The workspace grid is how you find records; the drawer is how you work with them.

---

## 2. Core Rule

> **A Business Object never opens as a full page by default.**

Every entity (Order, Product, Wave, PO, Customer, etc.) opens in a Detail Drawer. Full-page views exist only when the user explicitly requests them (expand to full screen).

---

## 3. Drawer Sizes

Three sizes. The workspace grid remains visible behind the drawer in all sizes.

| Size | Width | When to use |
|---|---|---|
| **Compact** | 50% | Quick reference; read-only preview; lightweight objects |
| **Standard** (default) | 70% | Standard operational use; most ECOS objects |
| **Wide** | 90% | Complex objects with many tabs; rich content (maps, charts) |
| **Full Screen** | 100% | User-requested; explicit "Expand" button; grid no longer visible |

**Rules:**
- Each module specifies its default drawer size
- User can resize any drawer by dragging the left edge
- Size preference is persisted per object type
- Keyboard shortcut: `F` to toggle full-screen; `Escape` to close

---

## 4. Drawer Anatomy

```
┌──────────────────────────────────────────────────────────────────────┐
│  DRAWER HEADER                                                        │
│  ← Back  │  [Object Icon] Object Type — Object ID  │ [Actions ▼] [✗]│
│  Status Badge · Breadcrumb path                                      │
├──────────────────────────────────────────────────────────────────────┤
│  SUMMARY SECTION (always first, always visible)                      │
│  Key fields in a 2-column layout; most critical info at a glance     │
├──────────────────────────────────────────────────────────────────────┤
│  DRAWER TABS  (horizontal; scrollable if overflow)                   │
│  [Overview] [Details] [Lines] [Timeline] [Documents] [Related] [AI] │
├──────────────────────────────────────────────────────────────────────┤
│  TAB CONTENT AREA                                                     │
│  (see Section 5 — Standard Tab Library)                             │
├──────────────────────────────────────────────────────────────────────┤
│  DRAWER FOOTER  (sticky; always visible)                             │
│  [Primary Action]  [Secondary Action]  ·  Timestamps · Actor        │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 5. Standard Tab Library

All drawers are assembled from this shared tab library. No module invents new tab names.

| Tab | Content | Required for |
|---|---|---|
| **Overview** | Summary fields; key metrics; quick-edit high-priority fields | All objects |
| **Details** | Full field listing; extended attributes; all editable fields | Most objects |
| **Lines / Items** | Related child records (Order Lines, PO Lines, Wave Items, Recipe Materials) | Documents with lines |
| **Activity** | Inline comments + audit trail (who did what, when) | All operational objects |
| **Timeline** | Full chronological history (EPS-02 powered; see TIMELINE-UX-STANDARD.md) | All objects |
| **Documents** | Attached files, photos, PDFs (EPS-03 powered; see DOCUMENTS-UX-STANDARD.md) | All objects |
| **Related** | Linked objects (e.g. Order→Customer, Wave→Orders, PO→Supplier) | Most objects |
| **AI Insights** | AI recommendations, risk flags, predictions for this record (EPS-01+AI) | Operational objects |
| **Configuration** | Object-specific settings (e.g. Supplier payment terms, Product pricing rules) | Reference objects |
| **Custom** | Module-specific tab for unique content (e.g. Recipe's Cost Engine tab) | Module-defined |

**Ordering rule:** Overview → Details → Lines/Items → [module-specific tabs] → AI Insights → Activity → Timeline → Documents → Related

---

## 6. Drawer Header

```
← Back  │  📦 Product — PRD-00234  ● Active              │  [Edit] [More ▼] [⛶ Expand] [✗]
         │  Inventory > Products > Honey 500g             │
```

**Header elements:**
- **Back arrow**: returns focus to the grid (does not close; collapses drawer)
- **Object icon**: entity-type icon from the Lucide icon set
- **Object type + ID**: always shown; ID is copyable (click = copy to clipboard)
- **Status badge**: current status; always visible in header
- **Primary Action button**: the most common action (Edit, Approve, Confirm, etc.)
- **More menu**: all other actions
- **Expand icon**: toggles full-screen mode
- **Close (×)**: closes the drawer entirely

---

## 7. Summary Section

The Summary Section is always the first content block. It is visible regardless of which tab is active.

```
┌──────────────────────────────────────────────────────┐
│  Honey 500g                     │  Cost: EGP 8.50    │
│  SKU: HNY-500                   │  Price: EGP 22.00  │
│  Category: Finished Products    │  Margin: 61.4%     │
│  Created: 12 Jan 2026           │  Stock: 450 units  │
└──────────────────────────────────────────────────────┘
```

**Rules:**
- Maximum 8 fields (4 rows × 2 columns)
- Only the most critical, decision-relevant fields
- Fields are not editable inline in the summary section (edit happens in Details tab)
- Summary section is collapsible (pinned open by default; user can collapse)

---

## 8. Drawer Footer

```
┌──────────────────────────────────────────────────────────────────────┐
│  [Save Changes]   [Cancel]         Created: 12 Jan 2026 by Osama F. │
│                                    Last modified: Today at 10:23 AM  │
└──────────────────────────────────────────────────────────────────────┘
```

**Rules:**
- Footer only shows action buttons when the drawer is in edit mode
- Timestamps are always shown
- Actor name on creation and last modification is always shown
- Destructive actions (Delete, Archive) are never in the footer; they are in the header More menu

---

## 9. Drawer Navigation

### Opening a Drawer

| Trigger | Behavior |
|---|---|
| Click row in grid | Opens drawer at Standard size |
| Press Enter on focused row | Opens drawer |
| Click a linked object | Opens drawer (may be a different object type) |
| Deep link URL | Opens workspace + drawer at the same time |
| Command Palette "Open X" | Opens workspace + drawer |

### Navigating Between Records

From within an open drawer, users can navigate to adjacent records without returning to the grid:

```
← Previous record        Next record →
```

Navigation arrows appear in the drawer header when the drawer was opened from a grid. Arrow navigation respects the current grid sort and filters.

### Nested Drawers

When the user clicks a linked object inside a drawer, a **nested drawer** opens on top:

```
Level 1: Product drawer
  Level 2: Supplier drawer (opened from Product's supplier link)
    Level 3: Contact drawer (opened from Supplier's contact)
```

**Rules:**
- Maximum 3 drawer nesting levels
- Each level dims the layer below
- Back arrow navigates up one level
- Closing the top drawer returns to the previous level

---

## 10. Edit Mode

When the user clicks "Edit" in the drawer header:

1. The drawer enters **Edit Mode**
2. All editable fields become interactive inputs
3. A "Save Changes" + "Cancel" pair appears in the footer
4. The header shows a yellow "Editing" indicator
5. Navigation away from the drawer (back arrow / close / Escape) triggers an "Unsaved changes" warning

**Validation:**
- Inline validation runs on field blur
- Save triggers full validation; errors shown as field-level messages
- If async validation is needed (e.g. checking SKU uniqueness), show a spinner on the Save button

---

## 11. Keyboard Shortcuts

| Key | Action |
|---|---|
| `Escape` | Close drawer (prompts if unsaved changes) |
| `F` | Toggle full-screen |
| `E` | Enter edit mode |
| `S` (in edit mode) | Save |
| `←/→` | Navigate to previous/next record |
| `1–9` | Jump to drawer tab by number |
| `Tab` | Navigate between fields in edit mode |

---

## 12. Drawer Performance

| Target | Value |
|---|---|
| Drawer open animation | 150ms |
| Initial content render | < 300ms |
| Tab switch | < 100ms (lazy load if data not yet fetched) |
| Edit mode toggle | Instant (< 50ms) |

---

## 13. Governance

| Rule | Constraint |
|---|---|
| UX-GOV-001 | Every Business Object opens in a Detail Drawer — never full-page by default |
| UX-GOV-009 | Detail Drawer follows this standard — no custom drawer implementations |
| Tab names | Only from the Standard Tab Library; custom tabs must be named "Custom" in architecture |
| Footer actions | Save/Cancel only in edit mode; never show both edit and save simultaneously |
| No full-page default | Any "detail page" without this drawer pattern violates UX-GOV-001 |
