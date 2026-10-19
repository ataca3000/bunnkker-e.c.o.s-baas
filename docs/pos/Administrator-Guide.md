# ECOS POS — Administrator Guide

**Version:** 1.0.0  
**Audience:** System administrators, store managers

---

## Table of Contents

1. [Terminal Registration](#terminal-registration)
2. [Session Management](#session-management)
3. [Shift Management](#shift-management)
4. [Receipt Configuration](#receipt-configuration)
5. [Hardware Configuration](#hardware-configuration)
6. [User Permissions](#user-permissions)
7. [Troubleshooting](#troubleshooting)
8. [Backup Recommendations](#backup-recommendations)

---

## Terminal Registration

Each physical checkout station is identified by a **Terminal ID** — a unique string that persists in the browser's localStorage under the key `ecos_pos_context`.

### Setting the Terminal ID

The terminal ID is set when the cashier first opens a session. It defaults to `TERM-001`. For production, assign a meaningful ID per station (e.g., `STORE-01-TILL-01`).

To change the terminal ID before the first session:
1. Open the browser developer tools (F12)
2. Navigate to Application → Local Storage
3. Find the key `ecos_pos_context`
4. Update the `terminalId` field
5. Refresh the browser

> In a future release, terminal registration will be configurable via the Manager Panel.

### Multiple Terminals

Each terminal must have a unique `terminal_id`. Receipt numbers and shift numbers are scoped per terminal. Sessions are also per-terminal.

---

## Session Management

A **session** represents a terminal's operational period. A session must be open before any sale can be processed.

### Opening a Session

From the POS home screen (when no session is active):
1. Click **Open Session**
2. A dialog confirms the terminal ID and cashier ID
3. The system creates a `pos_sessions` record with status `open`

Via API:
```
POST /api/pos/sessions
{
  "terminal_id": "TERM-001",
  "cashier_id":  "user-uuid",
  "device_fingerprint": "browser-fingerprint",
  "ip_address":  "192.168.1.100",
  "device_type": "desktop"
}
```

### Closing a Session

From the Manager Panel → Close Session:
1. All open shifts for the session must be closed first
2. Click **Close Session**
3. The session status changes to `closed`

Via API:
```
DELETE /api/pos/sessions/{session_id}
```

### Session Recovery

If a session becomes invalid (e.g., closed remotely while the terminal is active), the POS detects this on the next API call and automatically resets Zustand state, displaying a "Session expired" warning with instructions to open a new session.

### Configuration

| Key | Default | Description |
|-----|---------|-------------|
| `POS_HELD_CART_EXPIRY_HOURS` | `8` | Hours before a held cart auto-expires |

---

## Shift Management

A **shift** tracks a cashier's working period within a session. It records opening and closing cash counts for cash reconciliation.

### Opening a Shift

From the POS home screen (when a session is active but no shift is open):
1. Click **Open Shift**
2. Enter the opening cash amount (physical count of cash in the drawer)
3. Click **Open**

The system records `opening_cash` and sets shift status to `open`.

### Closing a Shift (Cashier)

From Manager Panel → Close Shift:
1. Enter the physical closing cash count
2. Click **Submit Count**
3. Shift status changes to `closing` (pending manager approval)

### Approving a Shift (Manager)

From Manager Panel → Approve Shift:
1. Enter the expected closing amount (calculated from opening + net cash sales)
2. Click **Approve** or **Reject**

On approval:
- Variance = expected − counted
- If variance exceeds `POS_CASH_VARIANCE_TOLERANCE_PCT` (default 5%), the system flags it
- Shift status changes to `closed`

On rejection:
- Cashier must recount and resubmit

### Configuration

| Key | Default | Description |
|-----|---------|-------------|
| `POS_CASH_VARIANCE_TOLERANCE_PCT` | `5` | Acceptable variance % before flagging |
| `POS_MAX_CASH_OUT_AMOUNT` | `5000` | Maximum cash-out transaction |
| `POS_REQUIRE_OPENING_COUNT` | `true` | Require opening cash count to open shift |

---

## Receipt Configuration

Receipts are generated automatically for every completed sale, return, and exchange.

### Receipt Numbering

Receipt numbers are generated per terminal using the format `TERM-YYYYMMDD-NNNNN`. They are unique within a terminal per day.

### Configuration

| Key | Default | Description |
|-----|---------|-------------|
| `POS_RECEIPT_FORMAT` | `thermal_80mm` | Default receipt format |
| `POS_RECEIPT_AUTO_PRINT` | `true` | Auto-print on sale completion (requires HAL agent) |
| `POS_RECEIPT_AUTO_EMAIL` | `false` | Email receipt to customer on sale |

### Thermal Printing

Thermal printing requires the HAL (Hardware Abstraction Layer) agent running locally on the terminal. The HAL agent connects via WebSocket to the POS backend.

| Key | Default | Description |
|-----|---------|-------------|
| `POS_HAL_AGENT_URL` | `ws://localhost:8765` | WebSocket URL of the local HAL agent |
| `POS_HAL_AGENT_TIMEOUT_MS` | `3000` | Connection timeout in milliseconds |

> **Status:** HAL agent integration is planned. In v1.0, receipts are displayed on screen and can be reprinted via the POS interface.

---

## Hardware Configuration

### Barcode Scanners

ECOS POS supports standard USB HID barcode scanners (keyboard-emulation mode).

The frontend barcode listener uses these constants (not currently configurable via environment):

| Constant | Value | Description |
|----------|-------|-------------|
| `BARCODE_THRESHOLD_MS` | `100` | Max inter-key delay (ms) within a scan |
| `RESET_GAP_MS` | `1000` | Gap after which the buffer is cleared |
| `MIN_BARCODE_LENGTH` | `4` | Minimum barcode length to trigger lookup |

**Requirements:**
- Scanner must be in HID keyboard emulation mode
- Scanner must send an Enter key (0x0D) to terminate the barcode
- The product search input (`id="pos-product-search"`) receives focus after each scan

### Cash Drawers

Cash drawer integration requires the HAL agent (planned for v1.1).

---

## User Permissions

### Current State (v1.0)

Authentication is handled by Laravel Sanctum. All POS endpoints require a valid `auth:sanctum` token. The POS does not enforce role-based authorization beyond authentication.

**Implication:** Any authenticated user can perform any POS operation, including shift approval. This is acceptable for single-role retail environments. For stores requiring manager approval enforcement, implement a custom middleware.

### Planned (v1.1)

A dedicated POS authorization policy will gate:
- Shift approval/rejection → Manager role required
- Discount above threshold → Manager override required
- Void receipt → Manager role required

### Cashier Configuration

| Key | Default | Description |
|-----|---------|-------------|
| `POS_MANAGER_APPROVAL_PCT` | `20` | Discount % above which manager approval is required (configuration ready; enforcement planned) |
| `POS_MAX_ITEM_DISCOUNT_PCT` | `100` | Maximum per-item discount |
| `POS_MAX_ORDER_DISCOUNT_PCT` | `100` | Maximum order-level discount |

---

## Troubleshooting

### "No Active Session" on startup

**Cause:** The session stored in localStorage has been closed or expired.  
**Fix:** Click "Open Session" to start a new session.

### "Previous cart is no longer available"

**Cause:** The cart ID in localStorage refers to a cart that was cancelled, completed, or expired on the backend.  
**Fix:** The system automatically clears the stale cart. Start a new sale.

### Barcode scan does nothing

**Checks:**
1. Confirm the scanner is in HID keyboard mode (test in Notepad — it should type characters)
2. Confirm the product search input is focused (click on it or press `/`)
3. Confirm the scan ends with an Enter keystroke
4. Check that the scanned value is ≥ 4 characters
5. Verify the product exists in the catalog with matching SKU/barcode

### Cart keyboard shortcuts not responding

**Cause:** Shortcuts are disabled when an input field has focus.  
**Fix:** Click on an empty area of the cart or press Escape to close any open input.

### "Failed to update quantity" toast

**Cause:** A rapid double-scan attempted to delete a line that was already modified.  
**Status:** Fixed in v1.0 (BUG-2). If it recurs, contact support.

### POS shows a red error screen ("POS Error")

**Cause:** An uncaught React rendering error.  
**Fix:** Click "Reload POS". If the error persists, clear localStorage and re-open a session.  
**Investigation:** Check the browser console for the error message (logged with `[POS]` prefix).

---

## Backup Recommendations

See [Backup-Recovery.md](./Backup-Recovery.md) for the full backup strategy.

**Critical tables to back up:**
- `pos_sessions` — session records
- `pos_shifts` — shift and cash records
- `pos_carts` — cart state (including JSONB lines)
- `pos_sales` — completed sale records
- `pos_receipts` — receipt archive
- `pos_returns` — return records
- `pos_exchanges` — exchange records
- `pos_payments` — payment audit trail

**Recommended schedule:**
- Full database backup: daily, retained 30 days
- Transaction log backup: every 15 minutes during business hours
- Test restore quarterly
