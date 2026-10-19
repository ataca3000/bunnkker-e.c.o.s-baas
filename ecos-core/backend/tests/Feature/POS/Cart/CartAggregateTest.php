<?php

declare(strict_types=1);

namespace Tests\Feature\POS\Cart;

use InvalidArgumentException;
use Modules\POS\Cart\Domain\Exceptions\InvalidCartTransitionException;
use Modules\POS\Cart\Domain\Models\Cart;
use Modules\POS\Cart\Domain\ValueObjects\CartLine;
use Modules\POS\Cart\Domain\ValueObjects\ReceiptNumber;
use Modules\POS\Shared\Domain\Enums\CartStatus;
use Modules\POS\Shared\Domain\Enums\DiscountType;
use Modules\POS\Shared\Domain\ValueObjects\Money;
use Modules\POS\Shared\Domain\ValueObjects\Quantity;
use Tests\TestCase;

/**
 * PKG-POS-006: Cart aggregate invariant tests.
 *
 * Tests the full state machine and line-management logic in-memory.
 * No database is touched — RefreshDatabase is NOT used.
 *
 * State machine:
 *   Active ──addLine/updateLine/removeLine──▶ Active
 *   Active ──hold()──▶ Held ──resume()──▶ Active
 *   Held   ──expire()──▶ Expired (terminal)
 *   Active ──initiatePayment()──▶ Paying
 *   Paying ──cancelPayment()──▶ Active  (ADR-POS-010)
 *   Paying ──complete()──▶ Completed   (terminal)
 *   Active ──cancel()──▶ Cancelled     (terminal)
 */
final class CartAggregateTest extends TestCase
{
    private const SESSION_ID = 'session-uuid-1';

    private const SHIFT_ID = 'shift-uuid-1';

    private const TERMINAL_ID = 'terminal-uuid-1';

    private const CASHIER_ID = 'cashier-uuid-1';

    private const CURRENCY = 'EGP';

    private function makeCart(?string $customerId = null): Cart
    {
        return Cart::open(
            sessionId: self::SESSION_ID,
            shiftId: self::SHIFT_ID,
            terminalId: self::TERMINAL_ID,
            cashierId: self::CASHIER_ID,
            currency: self::CURRENCY,
            customerId: $customerId,
        );
    }

    private function addWidget(Cart $cart, string $qty = '2', string $price = '10.00'): string
    {
        return $cart->addLine(
            productId: 'prod-1',
            productName: 'Widget',
            sku: 'WGT-001',
            quantity: Quantity::of($qty),
            unitPrice: Money::of($price, self::CURRENCY),
        );
    }

    // ── open() ────────────────────────────────────────────────────────────────

    public function test_open_creates_cart_in_active_status(): void
    {
        $cart = $this->makeCart();

        $this->assertSame(CartStatus::Active, $cart->status);
        $this->assertTrue($cart->isActive());
    }

    public function test_open_stores_all_identifiers(): void
    {
        $cart = $this->makeCart('customer-1');

        $this->assertSame(self::SESSION_ID, $cart->session_id);
        $this->assertSame(self::SHIFT_ID, $cart->shift_id);
        $this->assertSame(self::TERMINAL_ID, $cart->terminal_id);
        $this->assertSame(self::CASHIER_ID, $cart->cashier_id);
        $this->assertSame('customer-1', $cart->customer_id);
    }

    public function test_open_normalises_currency_to_uppercase(): void
    {
        $cart = Cart::open(self::SESSION_ID, self::SHIFT_ID, self::TERMINAL_ID, self::CASHIER_ID, 'egp');

        $this->assertSame('EGP', $cart->currency);
    }

    public function test_open_initialises_zero_totals(): void
    {
        $cart = $this->makeCart();

        $this->assertTrue($cart->getSubtotal()->isZero());
        $this->assertTrue($cart->getDiscountTotal()->isZero());
        $this->assertTrue($cart->getTotal()->isZero());
    }

    public function test_open_initialises_empty_lines(): void
    {
        $cart = $this->makeCart();

        $this->assertFalse($cart->hasLines());
        $this->assertSame(0, $cart->getLineCount());
    }

    public function test_open_throws_for_empty_session_id(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('Session ID');

        Cart::open('', self::SHIFT_ID, self::TERMINAL_ID, self::CASHIER_ID, self::CURRENCY);
    }

    public function test_open_throws_for_empty_shift_id(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('Shift ID');

        Cart::open(self::SESSION_ID, '', self::TERMINAL_ID, self::CASHIER_ID, self::CURRENCY);
    }

    public function test_open_throws_for_empty_terminal_id(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('Terminal ID');

        Cart::open(self::SESSION_ID, self::SHIFT_ID, '', self::CASHIER_ID, self::CURRENCY);
    }

    public function test_open_throws_for_empty_cashier_id(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('Cashier ID');

        Cart::open(self::SESSION_ID, self::SHIFT_ID, self::TERMINAL_ID, '', self::CURRENCY);
    }

    public function test_open_throws_for_empty_currency(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('Currency');

        Cart::open(self::SESSION_ID, self::SHIFT_ID, self::TERMINAL_ID, self::CASHIER_ID, '');
    }

    // ── addLine() ─────────────────────────────────────────────────────────────

    public function test_add_line_returns_line_id(): void
    {
        $cart = $this->makeCart();
        $lineId = $this->addWidget($cart);

        $this->assertNotEmpty($lineId);
    }

    public function test_add_line_increments_line_count(): void
    {
        $cart = $this->makeCart();
        $this->addWidget($cart);
        $this->addWidget($cart);

        $this->assertSame(2, $cart->getLineCount());
        $this->assertTrue($cart->hasLines());
    }

    public function test_add_line_recalculates_subtotal(): void
    {
        $cart = $this->makeCart();
        $this->addWidget($cart, '2', '10.00'); // 20.00
        $this->addWidget($cart, '3', '5.00');  // 15.00

        $this->assertSame('35.00', $cart->getSubtotal()->amount);
        $this->assertSame('35.00', $cart->getTotal()->amount);
    }

    public function test_add_line_with_percentage_discount_reflects_in_line_total(): void
    {
        $cart = $this->makeCart();
        $cart->addLine(
            'p', 'Widget', 'SKU', Quantity::of(2), Money::of('10.00', self::CURRENCY),
            DiscountType::Percentage, '10', // 10% off 20.00 → 2.00 discount → 18.00
        );

        $this->assertSame('18.00', $cart->getSubtotal()->amount);
    }

    public function test_add_line_throws_when_not_active(): void
    {
        $cart = $this->makeCart();
        $this->addWidget($cart);
        $cart->hold();

        $this->expectException(InvalidCartTransitionException::class);

        $this->addWidget($cart);
    }

    public function test_add_line_throws_on_currency_mismatch(): void
    {
        $cart = $this->makeCart();

        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('Currency mismatch');

        $cart->addLine('p', 'P', 'SKU', Quantity::of(1), Money::of('10.00', 'USD'));
    }

    public function test_add_line_throws_for_zero_quantity(): void
    {
        $cart = $this->makeCart();

        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('positive');

        $cart->addLine('p', 'P', 'SKU', Quantity::of(0), Money::of('10.00', self::CURRENCY));
    }

    // ── updateLine() ──────────────────────────────────────────────────────────

    public function test_update_line_changes_quantity_and_recalculates_total(): void
    {
        $cart = $this->makeCart();
        $lineId = $this->addWidget($cart, '2', '10.00'); // 20.00

        $cart->updateLine($lineId, Quantity::of('5'));

        $this->assertSame('50.00', $cart->getTotal()->amount);
        $this->assertSame('5.0000', $cart->getLines()[0]->quantity->value);
    }

    public function test_update_line_throws_when_line_not_found(): void
    {
        $cart = $this->makeCart();

        $this->expectException(InvalidCartTransitionException::class);
        $this->expectExceptionMessage('no line with ID');

        $cart->updateLine('non-existent-uuid', Quantity::of(2));
    }

    public function test_update_line_throws_when_not_active(): void
    {
        $cart = $this->makeCart();
        $lineId = $this->addWidget($cart);
        $cart->hold();

        $this->expectException(InvalidCartTransitionException::class);

        $cart->updateLine($lineId, Quantity::of(5));
    }

    public function test_update_line_throws_for_zero_quantity(): void
    {
        $cart = $this->makeCart();
        $lineId = $this->addWidget($cart);

        $this->expectException(InvalidArgumentException::class);

        $cart->updateLine($lineId, Quantity::of(0));
    }

    // ── removeLine() ──────────────────────────────────────────────────────────

    public function test_remove_line_decrements_count(): void
    {
        $cart = $this->makeCart();
        $lineId = $this->addWidget($cart);
        $this->addWidget($cart);

        $cart->removeLine($lineId);

        $this->assertSame(1, $cart->getLineCount());
    }

    public function test_remove_line_recalculates_totals(): void
    {
        $cart = $this->makeCart();
        $lineId = $this->addWidget($cart, '2', '10.00'); // 20.00
        $this->addWidget($cart, '1', '5.00');            // 5.00 → total 25.00

        $cart->removeLine($lineId);

        $this->assertSame('5.00', $cart->getTotal()->amount);
    }

    public function test_remove_line_throws_when_not_found(): void
    {
        $cart = $this->makeCart();

        $this->expectException(InvalidCartTransitionException::class);

        $cart->removeLine('ghost-uuid');
    }

    public function test_remove_line_throws_when_not_active(): void
    {
        $cart = $this->makeCart();
        $lineId = $this->addWidget($cart);
        $cart->hold();

        $this->expectException(InvalidCartTransitionException::class);

        $cart->removeLine($lineId);
    }

    // ── applyOrderDiscount() / removeOrderDiscount() ──────────────────────────

    public function test_apply_percentage_order_discount_reduces_total(): void
    {
        $cart = $this->makeCart();
        $this->addWidget($cart, '2', '50.00'); // subtotal = 100.00

        $cart->applyOrderDiscount(DiscountType::Percentage, '10'); // 10% off = 10.00

        $this->assertSame('100.00', $cart->getSubtotal()->amount);
        $this->assertSame('10.00', $cart->getDiscountTotal()->amount);
        $this->assertSame('90.00', $cart->getTotal()->amount);
    }

    public function test_apply_fixed_order_discount_reduces_total(): void
    {
        $cart = $this->makeCart();
        $this->addWidget($cart, '1', '100.00');

        $cart->applyOrderDiscount(DiscountType::FixedAmount, '25.00');

        $this->assertSame('75.00', $cart->getTotal()->amount);
    }

    public function test_remove_order_discount_restores_total(): void
    {
        $cart = $this->makeCart();
        $this->addWidget($cart, '1', '100.00');
        $cart->applyOrderDiscount(DiscountType::Percentage, '10');

        $cart->removeOrderDiscount();

        $this->assertSame('100.00', $cart->getTotal()->amount);
        $this->assertTrue($cart->getDiscountTotal()->isZero());
        $this->assertNull($cart->order_discount_type);
    }

    public function test_apply_order_discount_throws_when_not_active(): void
    {
        $cart = $this->makeCart();
        $this->addWidget($cart);
        $cart->cancel();

        $this->expectException(InvalidCartTransitionException::class);

        $cart->applyOrderDiscount(DiscountType::Percentage, '10');
    }

    // ── hold() / resume() ─────────────────────────────────────────────────────

    public function test_hold_transitions_active_to_held(): void
    {
        $cart = $this->makeCart();
        $cart->hold();

        $this->assertSame(CartStatus::Held, $cart->status);
        $this->assertTrue($cart->isHeld());
    }

    public function test_hold_records_held_at(): void
    {
        $cart = $this->makeCart();
        $cart->hold();

        $this->assertNotNull($cart->held_at);
    }

    public function test_hold_throws_from_non_active(): void
    {
        $cart = $this->makeCart();
        $cart->hold();

        $this->expectException(InvalidCartTransitionException::class);
        $this->expectExceptionMessage('"held"');

        $cart->hold();
    }

    public function test_resume_transitions_held_to_active(): void
    {
        $cart = $this->makeCart();
        $cart->hold();
        $cart->resume();

        $this->assertSame(CartStatus::Active, $cart->status);
        $this->assertTrue($cart->isActive());
    }

    public function test_resume_clears_held_at(): void
    {
        $cart = $this->makeCart();
        $cart->hold();
        $cart->resume();

        $this->assertNull($cart->held_at);
    }

    public function test_resume_throws_from_non_held(): void
    {
        $cart = $this->makeCart();

        $this->expectException(InvalidCartTransitionException::class);

        $cart->resume();
    }

    // ── expire() ──────────────────────────────────────────────────────────────

    public function test_expire_transitions_held_to_expired(): void
    {
        $cart = $this->makeCart();
        $cart->hold();
        $cart->expire();

        $this->assertSame(CartStatus::Expired, $cart->status);
        $this->assertTrue($cart->isExpired());
    }

    public function test_expire_records_expired_at(): void
    {
        $cart = $this->makeCart();
        $cart->hold();
        $cart->expire();

        $this->assertNotNull($cart->expired_at);
    }

    public function test_expire_throws_from_active(): void
    {
        $cart = $this->makeCart();

        $this->expectException(InvalidCartTransitionException::class);

        $cart->expire();
    }

    // ── initiatePayment() ─────────────────────────────────────────────────────

    public function test_initiate_payment_transitions_active_to_paying(): void
    {
        $cart = $this->makeCart();
        $this->addWidget($cart);
        $cart->initiatePayment();

        $this->assertSame(CartStatus::Paying, $cart->status);
        $this->assertTrue($cart->isPaying());
    }

    public function test_initiate_payment_throws_when_cart_is_empty(): void
    {
        $cart = $this->makeCart();

        $this->expectException(InvalidCartTransitionException::class);
        $this->expectExceptionMessage('no items');

        $cart->initiatePayment();
    }

    public function test_initiate_payment_throws_when_not_active(): void
    {
        $cart = $this->makeCart();
        $this->addWidget($cart);
        $cart->hold();

        $this->expectException(InvalidCartTransitionException::class);

        $cart->initiatePayment();
    }

    public function test_can_add_items_returns_false_when_paying(): void
    {
        $cart = $this->makeCart();
        $this->addWidget($cart);
        $cart->initiatePayment();

        $this->assertFalse($cart->canAddItems());
    }

    // ── cancelPayment() ───────────────────────────────────────────────────────

    public function test_cancel_payment_returns_cart_to_active(): void
    {
        $cart = $this->makeCart();
        $this->addWidget($cart);
        $cart->initiatePayment();
        $cart->cancelPayment();

        $this->assertSame(CartStatus::Active, $cart->status);
    }

    public function test_cancel_payment_throws_when_not_paying(): void
    {
        $cart = $this->makeCart();

        $this->expectException(InvalidCartTransitionException::class);

        $cart->cancelPayment();
    }

    // ── complete() ────────────────────────────────────────────────────────────

    public function test_complete_transitions_paying_to_completed(): void
    {
        $cart = $this->makeCart();
        $this->addWidget($cart);
        $cart->initiatePayment();
        $cart->complete(ReceiptNumber::of('RCP-2026-000001'));

        $this->assertSame(CartStatus::Completed, $cart->status);
        $this->assertTrue($cart->isCompleted());
    }

    public function test_complete_stores_receipt_number(): void
    {
        $cart = $this->makeCart();
        $this->addWidget($cart);
        $cart->initiatePayment();
        $cart->complete(ReceiptNumber::of('RCP-2026-000042'));

        $rn = $cart->getReceiptNumber();
        $this->assertNotNull($rn);
        $this->assertSame('RCP-2026-000042', $rn->value);
    }

    public function test_complete_records_completed_at(): void
    {
        $cart = $this->makeCart();
        $this->addWidget($cart);
        $cart->initiatePayment();
        $cart->complete(ReceiptNumber::of('RCP-001'));

        $this->assertNotNull($cart->completed_at);
    }

    public function test_complete_throws_when_not_paying(): void
    {
        $cart = $this->makeCart();
        $this->addWidget($cart);

        $this->expectException(InvalidCartTransitionException::class);

        $cart->complete(ReceiptNumber::of('RCP-001'));
    }

    // ── cancel() ──────────────────────────────────────────────────────────────

    public function test_cancel_transitions_active_to_cancelled(): void
    {
        $cart = $this->makeCart();
        $cart->cancel();

        $this->assertSame(CartStatus::Cancelled, $cart->status);
        $this->assertTrue($cart->isCancelled());
    }

    public function test_cancel_records_cancelled_at(): void
    {
        $cart = $this->makeCart();
        $cart->cancel();

        $this->assertNotNull($cart->cancelled_at);
    }

    public function test_cancel_is_allowed_from_held(): void
    {
        $cart = $this->makeCart();
        $cart->hold();
        $cart->cancel();

        $this->assertSame(CartStatus::Cancelled, $cart->status);
    }

    public function test_cancel_throws_from_paying(): void
    {
        $cart = $this->makeCart();
        $this->addWidget($cart);
        $cart->initiatePayment();

        $this->expectException(InvalidCartTransitionException::class);

        $cart->cancel();
    }

    public function test_cancel_throws_from_terminal_state(): void
    {
        $cart = $this->makeCart();
        $cart->cancel();

        $this->expectException(InvalidCartTransitionException::class);
        $this->expectExceptionMessage('terminal state');

        $cart->cancel();
    }

    // ── getLines() / CartLine reconstruction ──────────────────────────────────

    public function test_get_lines_returns_cart_line_objects(): void
    {
        $cart = $this->makeCart();
        $this->addWidget($cart, '3', '10.00');

        $lines = $cart->getLines();

        $this->assertCount(1, $lines);
        $this->assertInstanceOf(CartLine::class, $lines[0]);
        $this->assertSame('3.0000', $lines[0]->quantity->value);
        $this->assertSame('30.00', $lines[0]->lineTotal->amount);
    }

    public function test_receipt_number_is_null_before_completion(): void
    {
        $this->assertNull($this->makeCart()->getReceiptNumber());
    }

    // ── Full lifecycle ────────────────────────────────────────────────────────

    public function test_full_lifecycle(): void
    {
        $cart = $this->makeCart();
        $this->assertSame(CartStatus::Active, $cart->status);

        // Add items
        $id1 = $this->addWidget($cart, '2', '25.00'); // 50.00
        $id2 = $this->addWidget($cart, '1', '10.00'); // 10.00
        $this->assertSame('60.00', $cart->getTotal()->amount);

        // Update a line
        $cart->updateLine($id2, Quantity::of('3')); // 30.00
        $this->assertSame('80.00', $cart->getTotal()->amount);

        // Remove a line
        $cart->removeLine($id1);
        $this->assertSame('30.00', $cart->getTotal()->amount);

        // Apply a 10% order discount
        $cart->applyOrderDiscount(DiscountType::Percentage, '10'); // -3.00 → 27.00
        $this->assertSame('27.00', $cart->getTotal()->amount);

        // Hold and resume
        $cart->hold();
        $this->assertSame(CartStatus::Held, $cart->status);
        $cart->resume();
        $this->assertSame(CartStatus::Active, $cart->status);

        // Initiate payment, cancel back, re-initiate
        $cart->initiatePayment();
        $this->assertSame(CartStatus::Paying, $cart->status);
        $cart->cancelPayment();
        $this->assertSame(CartStatus::Active, $cart->status);
        $cart->initiatePayment();

        // Complete
        $cart->complete(ReceiptNumber::of('RCP-2026-000001'));
        $this->assertSame(CartStatus::Completed, $cart->status);
        $this->assertNotNull($cart->getReceiptNumber());
        $this->assertSame('27.00', $cart->getTotal()->amount);
    }
}
