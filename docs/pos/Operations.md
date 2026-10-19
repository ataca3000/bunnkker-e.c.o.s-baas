# ECOS POS — Operations Guide

**Version:** 1.0.0  
**Audience:** Store managers, supervisors, operations staff

---

## Table of Contents

1. [Daily Startup](#daily-startup)
2. [Daily Shutdown](#daily-shutdown)
3. [Opening Procedures](#opening-procedures)
4. [Closing Procedures](#closing-procedures)
5. [Cash Reconciliation](#cash-reconciliation)
6. [Receipt Recovery](#receipt-recovery)
7. [Failure Recovery](#failure-recovery)
8. [Incident Handling](#incident-handling)
9. [Support Procedures](#support-procedures)

---

## Daily Startup

### Before Opening the Store

1. **Start backend services** (if not running 24/7):
   - Confirm the web server is running
   - Confirm Redis is running
   - Confirm queue workers are running
   - Run `GET /api/health` and verify all services are green

2. **Prepare each terminal:**
   - Power on the POS terminal
   - Open the browser and navigate to the ECOS POS URL
   - Log in with cashier credentials

3. **Open a session** for each terminal (see [Open Session](./Cashier-Guide.md#open-session))

4. **Count opening cash** for each terminal:
   - Count the physical cash in each drawer
   - Open a shift with the recorded amount
   - Record the count independently on a paper log as backup

5. **Verify catalog is loading:**
   - Scan a known barcode to confirm product lookup is working
   - Verify the product appears correctly in the cart

---

## Daily Shutdown

### End of Business Day

1. **Complete all in-progress transactions:**
   - Ensure no carts are in `paying` status
   - Resume and complete or cancel any held carts that will not be processed

2. **Cashier closes each shift:**
   - Count the physical cash in the drawer
   - Submit the closing count via the POS
   - Note any discrepancies before submitting

3. **Manager reviews and approves shifts:**
   - Review the expected vs. actual closing count for each terminal
   - Approve shifts within tolerance
   - Reject and recount shifts that exceed the variance threshold

4. **Close each session** after all shifts are approved

5. **Back up the database** (see [Backup-Recovery.md](./Backup-Recovery.md))

6. **Power off terminals** if required

---

## Opening Procedures

### Each Terminal

| Step | Action | Who |
|------|--------|-----|
| 1 | Count opening cash float | Cashier |
| 2 | Log in to POS | Cashier |
| 3 | Open session | Cashier |
| 4 | Open shift with opening count | Cashier |
| 5 | Test scan one product | Cashier |
| 6 | Verify customer search works | Cashier |
| 7 | Confirm receipts display | Cashier |

---

## Closing Procedures

### Each Terminal

| Step | Action | Who |
|------|--------|-----|
| 1 | Process all pending transactions | Cashier |
| 2 | Resume and complete/cancel all held carts | Cashier |
| 3 | Count physical cash in drawer | Cashier |
| 4 | Submit closing count | Cashier |
| 5 | Review variance report | Manager |
| 6 | Approve or reject shift | Manager |
| 7 | Extract closing cash from drawer | Manager |
| 8 | Close session | Manager |

---

## Cash Reconciliation

### What is Reconciled

The POS tracks cash flow through:
- **Opening cash float** (entered when opening shift)
- **Cash sales** (recorded per payment tender)
- **Cash refunds** (recorded per return)
- **Closing count** (entered by cashier)

### Expected Closing Amount

```
Expected = Opening Cash + Cash Sales − Cash Refunds − Cash Outs
```

The manager enters the expected closing amount when approving a shift. The system calculates:

```
Variance = Expected − Actual Count
```

A positive variance means the drawer has less cash than expected (shortage).  
A negative variance means the drawer has more than expected (overage).

### Tolerance

Configure `POS_CASH_VARIANCE_TOLERANCE_PCT` (default 5%) to set the acceptable variance range. Shifts within tolerance are approved normally. Shifts outside tolerance are flagged for investigation.

### Reconciliation Checklist

- [ ] Closing count matches expected within tolerance
- [ ] All cash sales for the shift are accounted for
- [ ] All cash refunds for the shift are documented
- [ ] Any cash-out transactions have matching authorization
- [ ] Paper float count sheet matches POS entry

---

## Receipt Recovery

### Finding a Past Receipt

Via the POS:
1. Switch to Return mode (Ctrl+R)
2. Enter the sale ID in the "Original Sale ID" field
3. The sale details including receipt number appear

Via the API (for system administrators):
```
GET /api/pos/receipts/{receipt_id}
GET /api/pos/sales/{sale_id}
```

### Reprinting a Receipt

From the Receipt panel after a sale, click **Reprint**.

For past receipts, locate the receipt ID via the sale lookup, then:
```
POST /api/pos/receipts/{receipt_id}/reprint
```

### Receipt Numbering

Receipt numbers use the format `TERM-YYYYMMDD-NNNNN` where:
- `TERM` is the terminal ID
- `YYYYMMDD` is the transaction date
- `NNNNN` is a sequential number per terminal per day

Receipt numbers are unique within a terminal per day but may overlap across terminals.

---

## Failure Recovery

### Network Interruption During a Sale

**Symptom:** API calls timeout or return network errors during checkout.

**Actions:**
1. Do not power off the terminal
2. The cart remains in the backend database
3. Restore network connectivity
4. Reload the POS page — the cart ID in localStorage reconnects to the existing cart
5. Resume the payment process

> In v1.0, transactions require an active network connection. Offline mode is planned for v1.1.

### Browser Crash / Tab Closed During Checkout

**Symptom:** POS terminal lost its state mid-transaction.

**Actions:**
1. Reopen the browser and navigate to the POS URL
2. The session, shift, and cart are restored from localStorage
3. If the cart was in `paying` status on the backend, it remains there
4. The `one_paying_per_session` constraint prevents a duplicate charge — the existing transaction must be resolved first

**If the sale is stuck in "paying" status:**
1. Use the API to check the cart status: `GET /api/pos/carts/{cart_id}`
2. If payment was captured (sale record exists), the cart can be manually completed by support staff
3. If payment was NOT captured, cancel the cart: `DELETE /api/pos/carts/{cart_id}` and reprocess

### Session Expired Remotely

**Symptom:** POS shows "Session expired" warning.

**Actions:**
1. The system automatically resets the POS state
2. Click **Open Session** to create a new session
3. No data is lost — carts and sales are preserved in the database

### Held Cart Expired

**Symptom:** Cashier tries to resume a held cart but gets an error.

**Actions:**
1. The held cart has transitioned to `expired` status (after 8 hours by default)
2. The cart cannot be resumed — it must be recreated
3. If the customer returns, manually look up what items were in the cart via the API and re-add them
4. Remove the expired snapshot from the Held Carts panel

---

## Incident Handling

### POS Error Screen (Red Error)

**Symptom:** Red screen with "POS Error" heading and "Reload POS" button.

**Immediate action:**
1. Click **Reload POS** — the page reloads and state is restored from localStorage
2. If the error recurs after reload:
   a. Open browser developer tools (F12)
   b. Check the Console for the `[POS]` prefixed error message
   c. Note the error message and report to technical support

**Common causes:**
- JavaScript bundle failed to load (CDN/network issue)
- Incompatible browser version
- Corrupted localStorage state

**If the error persists:**
1. Open developer tools → Application → Local Storage
2. Delete the `ecos_pos_context` key
3. Reload the page
4. Open a new session

### Duplicate Charges

**Symptom:** Customer's card was charged twice or a sale appears twice.

**Immediate action:**
1. Do not process any further transactions on this cart
2. Contact technical support immediately with:
   - Terminal ID
   - Session ID (visible in the POS header / localStorage)
   - Sale amount and time
   - Customer card last 4 digits (if known)

**Investigation:**
- The `one_paying_per_session` partial unique index prevents the POS itself from creating duplicate sales
- Duplicate charges typically indicate an external payment gateway issue
- Check the `pos_payments` and `pos_sales` tables for the affected session

### Wrong Amount Charged

**Actions:**
1. If the sale can be voided: process a full return immediately
2. If the sale cannot be voided: process a return for the difference
3. Issue a corrected receipt and void the original

---

## Support Procedures

### Before Contacting Support

Collect the following information:
1. **Terminal ID** — visible in the POS header or `ecos_pos_context.terminalId` in localStorage
2. **Session ID** — `ecos_pos_context.sessionId` in localStorage
3. **Shift ID** — `ecos_pos_context.shiftId` in localStorage
4. **Browser and version** — F12 → Console → `navigator.userAgent`
5. **Exact error message** — screenshot or copy from browser console
6. **Time of incident** — as precise as possible
7. **Steps to reproduce** — what the cashier was doing when the error occurred

### API Access for Support

Technical support can access transaction data via:
```
GET /api/pos/sessions/{id}
GET /api/pos/shifts/{id}
GET /api/pos/carts/{id}
GET /api/pos/sales/{id}
GET /api/pos/receipts/{id}
```

All endpoints require a valid `auth:sanctum` token.
