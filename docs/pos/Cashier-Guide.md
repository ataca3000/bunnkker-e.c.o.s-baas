# ECOS POS — Cashier Guide

**Version:** 1.0.0  
**Audience:** Cashiers and sales staff

---

## Table of Contents

1. [Login](#login)
2. [Open Session](#open-session)
3. [Open Shift](#open-shift)
4. [Product Search](#product-search)
5. [Barcode Scanning](#barcode-scanning)
6. [Customer Selection](#customer-selection)
7. [Cart Management](#cart-management)
8. [Hold Cart](#hold-cart)
9. [Resume Cart](#resume-cart)
10. [Checkout](#checkout)
11. [Cash Payment](#cash-payment)
12. [Card Payment](#card-payment)
13. [Split Payment](#split-payment)
14. [Receipt Reprint](#receipt-reprint)
15. [Return](#return)
16. [Exchange](#exchange)
17. [Close Shift](#close-shift)
18. [Close Session](#close-session)
19. [Keyboard Shortcuts](#keyboard-shortcuts)

---

## Login

1. Open the ECOS ERP application in your browser
2. Enter your username and password
3. Click **Login**
4. Navigate to the **POS** module from the sidebar

---

## Open Session

A session must be open before any sale can be processed.

If you see the "No Active Session" screen:

1. Click **Open Session**
2. The system detects your terminal ID automatically
3. Confirm your cashier information
4. Click **Open**

The POS workspace loads and you are ready to sell.

---

## Open Shift

A shift must be open before the first sale of your working period.

If you see the "No Active Shift" screen:

1. Click **Open Shift**
2. Count the physical cash in the drawer
3. Enter the total opening cash amount
4. Select the currency
5. Click **Open Shift**

The opening amount is recorded and your shift begins.

---

## Product Search

1. The product search bar at the top of the left panel is focused by default
2. Type the product name or SKU
3. Products appear after a short delay (300ms)
4. Click on a product card to add it to the cart

**Tip:** Press `/` from anywhere in the POS to jump to the search bar.

You can also filter products by category using the category chips below the search bar. Your last selected category is remembered.

---

## Barcode Scanning

Point the barcode scanner at the product barcode and pull the trigger (or let it auto-scan). The product is looked up instantly and added to the cart.

- If the same product is scanned again, the quantity increments automatically
- A loading indicator appears briefly during lookup
- If the barcode is not found, a red error bar appears for 3 seconds

After every scan, focus returns to the product search bar automatically so you can scan the next item without clicking.

---

## Customer Selection

To attach a customer to the current sale:

1. Press **Ctrl+K** or click **Add Customer** at the top of the left panel
2. The search bar expands — type the customer's name, phone number, or code
3. Results appear after typing 2 or more characters
4. Click the customer to select them

The customer name appears in the bar. The customer is saved to the cart on the backend.

To remove a customer, click the **×** next to the customer name.

---

## Cart Management

The cart panel is on the right side of the screen.

**Viewing the cart:**
- Each line shows the product name, SKU, quantity, and line total
- The cart shows subtotal, any discounts, and the final total
- The item count badge updates as products are added

**Adjusting quantities with mouse:**
- Click the **−** button to decrease quantity
- Click the **+** button to increase quantity
- Click the quantity number to type a specific quantity, then press Enter to confirm

**Removing items:**
- Click the **trash** icon on any line to remove it

---

## Hold Cart

If you need to serve another customer while keeping the current cart:

1. Press **F9** or click the pause icon in the cart header
2. The cart is saved to a "held" state
3. A new empty cart is ready for the next customer

Held carts are listed with the count badge on the **Held** button in the cart header.

---

## Resume Cart

To return to a held cart:

1. Press **Ctrl+H** or click the **Held** button
2. The Held Carts panel opens on the right
3. Click **Resume** next to the cart you want to continue
4. The cart loads with all items and the customer restored

> **Note:** Held carts expire after 8 hours if not resumed.

---

## Checkout

When ready to take payment:

1. Review the cart total at the bottom of the cart panel
2. Click the **Pay** button (or press **F8**)
3. The Payment panel opens

---

## Cash Payment

In the Payment panel:

1. **Cash** is selected by default
2. The amount input shows the total due as a placeholder
3. Enter the cash amount received (or use the quick-amount buttons: 50, 100, 200, 500)
4. If sufficient, press **Enter** or click **Confirm Payment**
5. The change due is displayed
6. The receipt appears automatically

**Quick amounts:** Click 50, 100, 200, or 500 buttons to pre-fill common cash amounts.

---

## Card Payment

In the Payment panel:

1. Click **Card** in the payment method grid
2. The amount input shows the total due
3. Process the card on the card terminal (external device)
4. Enter the card amount in the amount field (or leave it as-is for the full amount)
5. Click **Confirm Payment**

---

## Split Payment

To split a payment across multiple tender types:

1. Select the first payment method (e.g., Cash)
2. Enter the partial amount
3. Click **+ Add Tender**
4. The tender is listed below with a × to remove it
5. Select the second payment method (e.g., Card)
6. Enter the remaining amount
7. When the total tendered ≥ total due, click **Confirm Payment**

---

## Receipt Reprint

After a completed sale, the receipt appears automatically on the right panel.

To reprint a receipt:

1. From the Receipt panel, click **Reprint**
2. Or use the receipt ID from a previous transaction and look it up via the Manager Panel

---

## Return

To process a return:

1. Press **Ctrl+R** or select **Return** from the mode switcher in the header
2. The Return panel opens on the right
3. Enter the original Sale ID in the "Original Sale ID" field
4. Press Enter or click the search icon to load the sale details
5. Click **Return All Items** to add all lines, or manually add individual items
6. Adjust refund amounts per line if doing a partial refund
7. Select the **Refund Method** (cash, card, etc.)
8. Add optional notes
9. Click **Process Return**

The system updates the sale status and issues a return receipt.

---

## Exchange

To process an exchange:

1. Press **Ctrl+E** or select **Exchange** from the mode switcher
2. The Exchange panel opens on the right
3. Enter the original Sale ID and search
4. Click **All Items** to select all items for return, or remove items you are not exchanging
5. Click **Add** in the Replacement Items section for each item the customer is receiving
6. Fill in the product ID and price for each replacement item
7. Enter a **Reason** (required)
8. If reason is "other", enter **Notes** (required)
9. Click **Process Exchange**

---

## Close Shift

At the end of your working period:

1. Switch to **Manager** mode (Ctrl+M)
2. Click **Close Shift**
3. Count the physical cash in the drawer
4. Enter the closing cash count
5. Click **Submit Count**

The shift enters "closing" status. A manager must approve or reject the count.

---

## Close Session

At the end of the day:

1. Ensure all shifts are closed and approved
2. Switch to **Manager** mode (Ctrl+M)
3. Click **Close Session**
4. Confirm the closure

The session is closed. The terminal is ready for the next day's session.

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| **Ctrl+N** | New sale (clear current cart) |
| **F8** | Open payment panel |
| **F9** | Hold current cart |
| **Escape** | Close current panel / cancel |
| **Ctrl+R** | Switch to Return mode |
| **Ctrl+E** | Switch to Exchange mode |
| **Alt+1** | Switch to Sale mode |
| **Ctrl+M** | Switch to Manager view |
| **Ctrl+H** | Toggle Held Carts panel |
| **Ctrl+K** | Open Customer search |
| **/** | Focus product search bar |
| **↑** | Select previous cart item |
| **↓** | Select next cart item |
| **Enter** | Edit quantity of selected item |
| **+** or **=** | Increase selected item quantity |
| **−** | Decrease selected item quantity |
| **Delete** | Remove selected item from cart |
| **Shift+?** | Show keyboard shortcuts help |

> **Note:** Shortcuts that involve cart navigation (arrows, Enter, +, −, Delete) are disabled when a text input field is focused. Press Escape to return focus to the main workspace.
