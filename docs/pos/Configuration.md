# ECOS POS — Configuration Guide

**Version:** 1.0.0  
**Config file:** `backend/config/pos.php`

All options are overridable via environment variables.

---

## Cart Settings

| Environment Variable | Default | Type | Description |
|---------------------|---------|------|-------------|
| `POS_HELD_CART_EXPIRY_HOURS` | `8` | integer | Hours before a held cart is auto-expired. After this window, the cart transitions to `expired` status and cannot be resumed. |
| `POS_CART_MAX_ITEMS` | `500` | integer | Maximum number of distinct line items per cart. Prevents runaway carts and keeps JSONB documents manageable. |

---

## Payment Settings

| Environment Variable | Default | Type | Description |
|---------------------|---------|------|-------------|
| `POS_ALLOW_PARTIAL_PAYMENT` | `true` | boolean | Allow split payment across multiple tenders. When `false`, a single tender must cover the full amount. |
| `POS_CASH_ROUNDING_METHOD` | `nearest` | string | Cash rounding strategy: `nearest`, `up`, or `down`. Applied to change calculations for cash transactions. |
| `POS_CASH_ROUNDING_UNIT` | `0.25` | decimal | Rounding unit for cash. Example: `0.25` rounds to the nearest quarter. Set to `0.01` to disable rounding. |
| `POS_STORE_CREDIT_ENABLED` | `true` | boolean | Allow store credit as a payment tender. Requires integration with the Loyalty/CRM module. |

---

## Discount Settings

| Environment Variable | Default | Type | Description |
|---------------------|---------|------|-------------|
| `POS_MAX_ITEM_DISCOUNT_PCT` | `100` | integer | Maximum per-line-item discount as a percentage. `100` allows a full 100% discount. |
| `POS_MAX_ORDER_DISCOUNT_PCT` | `100` | integer | Maximum order-level discount as a percentage. |
| `POS_MANAGER_APPROVAL_PCT` | `20` | integer | Discount percentage above which manager approval is required. **Note:** The enforcement middleware is planned for v1.1 — this value is stored but not yet enforced at runtime. |

---

## Shift & Session Settings

| Environment Variable | Default | Type | Description |
|---------------------|---------|------|-------------|
| `POS_CASH_VARIANCE_TOLERANCE_PCT` | `5` | integer | Acceptable cash count variance as a percentage of expected closing. Variances above this threshold are flagged for review. |
| `POS_MAX_CASH_OUT_AMOUNT` | `5000` | integer | Maximum single cash-out transaction amount. |
| `POS_REQUIRE_OPENING_COUNT` | `true` | boolean | Require cashier to enter a physical cash count when opening a shift. |

---

## Returns & Exchanges

| Environment Variable | Default | Type | Description |
|---------------------|---------|------|-------------|
| `POS_RETURN_WINDOW_DAYS` | `30` | integer | Number of days after a sale within which returns are accepted. **Note:** Enforcement is validation-layer only in v1.0 — the date check is not yet applied automatically. |
| `POS_RETURN_WITHOUT_RECEIPT` | `false` | boolean | Allow returns without a valid sale ID. When `false`, a sale ID is required. |
| `POS_RETURN_REQUIRE_REASON` | `true` | boolean | Require a reason code for all returns. |
| `POS_RETURN_RESTOCK_BY_DEFAULT` | `true` | boolean | Pre-check the "restock" option on all return lines. Cashier can uncheck individually. |

---

## Inventory Integration

| Environment Variable | Default | Type | Description |
|---------------------|---------|------|-------------|
| `POS_ALLOW_NEGATIVE_STOCK` | `false` | boolean | Allow sales of products with zero or negative stock. When `false`, out-of-stock products cannot be added to cart (enforcement planned for v1.1). |
| `POS_USE_OFFLINE_INVENTORY` | `true` | boolean | Use a locally cached inventory snapshot when offline. |
| `POS_OFFLINE_SYNC_INTERVAL` | `300` | integer (seconds) | How often (in seconds) to sync the local inventory cache from the backend. Default: 5 minutes. |

---

## Offline Mode

> **Status:** Offline mode is pre-configured but not yet implemented in the v1.0 frontend. These settings are reserved for v1.1+.

| Environment Variable | Default | Type | Description |
|---------------------|---------|------|-------------|
| `POS_OFFLINE_ENABLED` | `true` | boolean | Master switch for offline mode. When enabled, the frontend will queue operations locally when the network is unavailable. |
| `POS_OFFLINE_MAX_QUEUE` | `1000` | integer | Maximum number of offline operations to queue locally before refusing new transactions. |
| `POS_OFFLINE_ENCRYPTION` | `AES-256-GCM` | string | Encryption algorithm for locally queued operations. |
| `POS_OFFLINE_CONFLICT_STRATEGY` | `server_wins` | string | Conflict resolution strategy when syncing offline operations: `server_wins` or `client_wins`. |

---

## Hardware Abstraction Layer (HAL)

> **Status:** HAL agent integration is planned for v1.1. These settings have no effect in v1.0.

| Environment Variable | Default | Type | Description |
|---------------------|---------|------|-------------|
| `POS_HAL_AGENT_URL` | `ws://localhost:8765` | string | WebSocket URL of the local HAL agent for hardware control (printer, cash drawer, customer display). |
| `POS_HAL_AGENT_TIMEOUT_MS` | `3000` | integer | Connection timeout in milliseconds before the POS falls back to screen-only mode. |

---

## Loyalty / CRM Integration

| Environment Variable | Default | Type | Description |
|---------------------|---------|------|-------------|
| `POS_LOYALTY_ENABLED` | `true` | boolean | Enable loyalty points accrual and redemption. When enabled, sales publish `LoyaltyPointsAccrued` events consumed by the CRM module. |
| `POS_POINTS_PER_CURRENCY` | `1` | integer | Loyalty points earned per 1 unit of currency spent. |
| `POS_CURRENCY_PER_POINT` | `0.01` | decimal | Currency value of 1 loyalty point when redeemed. |

---

## Pricing

| Environment Variable | Default | Type | Description |
|---------------------|---------|------|-------------|
| `POS_DEFAULT_CURRENCY` | `EGP` | string | ISO 4217 currency code used for new carts and price display. |
| `POS_PRICING_PREFER_SALE_PRICE` | `true` | boolean | Use the product's promotional sale price when available, falling back to the regular selling price. |

---

## Receipt Settings

| Environment Variable | Default | Type | Description |
|---------------------|---------|------|-------------|
| `POS_RECEIPT_FORMAT` | `thermal_80mm` | string | Default receipt format: `thermal_80mm`, `thermal_58mm`, `a4`, `a5`. |
| `POS_RECEIPT_AUTO_PRINT` | `true` | boolean | Automatically send receipts to the connected printer after each sale (requires HAL agent in v1.1). |
| `POS_RECEIPT_AUTO_EMAIL` | `false` | boolean | Automatically email receipts to the customer if an email address is available. |

---

## Barcode Scanner Settings

The barcode scanner thresholds are compiled into the frontend JavaScript and are not configurable via environment variables in v1.0.

| Constant | Default | Description |
|----------|---------|-------------|
| `BARCODE_THRESHOLD_MS` | `100` | Maximum inter-keystroke delay (ms) that identifies input as a barcode scan rather than manual typing |
| `RESET_GAP_MS` | `1000` | Gap (ms) with no input that clears the scanner buffer |
| `MIN_BARCODE_LENGTH` | `4` | Minimum character count to trigger a product lookup |

> To change scanner thresholds, edit `frontend/src/features/pos/hooks/use-barcode-scanner.ts` and rebuild.

---

## Frontend Storage

The POS frontend persists session context in `localStorage` under the key `ecos_pos_context`.

**Persisted fields:**
- `sessionId` — current session UUID
- `shiftId` — current shift UUID
- `cartId` — current cart UUID
- `terminalId` — terminal identifier string
- `cashierId` — logged-in cashier UUID
- `cashierName` — cashier display name
- `currency` — active currency code
- `heldCartSnapshots` — local snapshot of held cart metadata

**Not persisted (reset on browser reload):**
- `mode` (sale/return/exchange/manager)
- `activeCustomerId`, `activeCustomerName`
- `paymentPanelOpen`
- `returnSaleId`, `exchangeSaleId`
- `lastReceiptId`
- `customerSearchTick`, `keyboardHelpOpen`
