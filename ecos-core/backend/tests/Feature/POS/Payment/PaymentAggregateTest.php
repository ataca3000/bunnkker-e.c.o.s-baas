<?php

declare(strict_types=1);

namespace Tests\Feature\POS\Payment;

use InvalidArgumentException;
use Modules\POS\Payment\Domain\Enums\PaymentStatus;
use Modules\POS\Payment\Domain\Exceptions\InsufficientPaymentException;
use Modules\POS\Payment\Domain\Exceptions\InvalidPaymentStateException;
use Modules\POS\Payment\Domain\Models\Payment;
use Modules\POS\Shared\Domain\Enums\PaymentMethodType;
use Modules\POS\Shared\Domain\ValueObjects\Money;
use Tests\TestCase;

/**
 * PKG-POS-007: Payment aggregate in-memory tests.
 * No RefreshDatabase — all assertions made against in-memory state only.
 */
final class PaymentAggregateTest extends TestCase
{
    private const CART_ID = 'cart-uuid-1';

    private const SESSION_ID = 'session-uuid-1';

    private const SHIFT_ID = 'shift-uuid-1';

    private const TERMINAL_ID = 'terminal-uuid-1';

    private const CASHIER_ID = 'cashier-uuid-1';

    private const CURRENCY = 'EGP';

    private function makeTotal(string $amount = '150.00'): Money
    {
        return Money::of($amount, self::CURRENCY);
    }

    private function makePayment(?Money $total = null): Payment
    {
        return Payment::initiate(
            cartId: self::CART_ID,
            sessionId: self::SESSION_ID,
            shiftId: self::SHIFT_ID,
            terminalId: self::TERMINAL_ID,
            cashierId: self::CASHIER_ID,
            cartTotal: $total ?? $this->makeTotal(),
        );
    }

    // ── initiate() ────────────────────────────────────────────────────────────

    public function test_initiate_creates_payment_in_pending_status(): void
    {
        $this->assertSame(PaymentStatus::Pending, $this->makePayment()->status);
    }

    public function test_initiate_stores_cart_id(): void
    {
        $this->assertSame(self::CART_ID, $this->makePayment()->cart_id);
    }

    public function test_initiate_stores_all_identifiers(): void
    {
        $payment = $this->makePayment();
        $this->assertSame(self::SESSION_ID, $payment->session_id);
        $this->assertSame(self::SHIFT_ID, $payment->shift_id);
        $this->assertSame(self::TERMINAL_ID, $payment->terminal_id);
        $this->assertSame(self::CASHIER_ID, $payment->cashier_id);
    }

    public function test_initiate_stores_cart_total(): void
    {
        $payment = $this->makePayment($this->makeTotal('200.00'));
        $this->assertSame('200.00', $payment->getCartTotal()->amount);
        $this->assertSame(self::CURRENCY, $payment->getCartTotal()->currency);
    }

    public function test_initiate_sets_zero_amount_tendered(): void
    {
        $this->assertSame('0.00', $this->makePayment()->getAmountTendered()->amount);
    }

    public function test_initiate_change_due_equals_negative_cart_total(): void
    {
        $payment = $this->makePayment($this->makeTotal('150.00'));
        $this->assertSame('-150.00', $payment->getChangeDue()->amount);
    }

    public function test_initiate_sets_empty_tenders(): void
    {
        $payment = $this->makePayment();
        $this->assertEmpty($payment->getTenders());
        $this->assertFalse($payment->hasTenders());
        $this->assertSame(0, $payment->getTenderCount());
    }

    public function test_initiate_is_pending(): void
    {
        $payment = $this->makePayment();
        $this->assertTrue($payment->isPending());
        $this->assertFalse($payment->isCaptured());
    }

    public function test_initiate_is_not_fully_paid(): void
    {
        $this->assertFalse($this->makePayment()->isFullyPaid());
    }

    public function test_initiate_throws_for_empty_cart_id(): void
    {
        $this->expectException(InvalidArgumentException::class);
        Payment::initiate('', self::SESSION_ID, self::SHIFT_ID, self::TERMINAL_ID, self::CASHIER_ID, $this->makeTotal());
    }

    public function test_initiate_throws_for_empty_session_id(): void
    {
        $this->expectException(InvalidArgumentException::class);
        Payment::initiate(self::CART_ID, '', self::SHIFT_ID, self::TERMINAL_ID, self::CASHIER_ID, $this->makeTotal());
    }

    public function test_initiate_throws_for_empty_shift_id(): void
    {
        $this->expectException(InvalidArgumentException::class);
        Payment::initiate(self::CART_ID, self::SESSION_ID, '', self::TERMINAL_ID, self::CASHIER_ID, $this->makeTotal());
    }

    public function test_initiate_throws_for_empty_terminal_id(): void
    {
        $this->expectException(InvalidArgumentException::class);
        Payment::initiate(self::CART_ID, self::SESSION_ID, self::SHIFT_ID, '', self::CASHIER_ID, $this->makeTotal());
    }

    public function test_initiate_throws_for_empty_cashier_id(): void
    {
        $this->expectException(InvalidArgumentException::class);
        Payment::initiate(self::CART_ID, self::SESSION_ID, self::SHIFT_ID, self::TERMINAL_ID, '', $this->makeTotal());
    }

    // ── addTender() ───────────────────────────────────────────────────────────

    public function test_add_tender_returns_tender_id(): void
    {
        $payment = $this->makePayment();
        $tenderId = $payment->addTender(PaymentMethodType::Cash, $this->makeTotal('100.00'));
        $this->assertNotEmpty($tenderId);
    }

    public function test_add_tender_increments_tender_count(): void
    {
        $payment = $this->makePayment();
        $payment->addTender(PaymentMethodType::Cash, $this->makeTotal('50.00'));
        $this->assertSame(1, $payment->getTenderCount());
        $this->assertTrue($payment->hasTenders());
    }

    public function test_add_multiple_tenders_accumulates_count(): void
    {
        $payment = $this->makePayment();
        $payment->addTender(PaymentMethodType::Cash, $this->makeTotal('50.00'));
        $payment->addTender(PaymentMethodType::Card, $this->makeTotal('100.00'));
        $this->assertSame(2, $payment->getTenderCount());
    }

    public function test_add_tender_recalculates_amount_tendered(): void
    {
        $payment = $this->makePayment($this->makeTotal('150.00'));
        $payment->addTender(PaymentMethodType::Cash, $this->makeTotal('100.00'));
        $this->assertSame('100.00', $payment->getAmountTendered()->amount);
    }

    public function test_add_tender_partial_payment_shows_remaining_balance(): void
    {
        $payment = $this->makePayment($this->makeTotal('150.00'));
        $payment->addTender(PaymentMethodType::Cash, $this->makeTotal('100.00'));
        $this->assertFalse($payment->isFullyPaid());
        $this->assertSame('50.00', $payment->getRemainingBalance()->amount);
    }

    public function test_add_tender_full_payment_marks_fully_paid(): void
    {
        $payment = $this->makePayment($this->makeTotal('150.00'));
        $payment->addTender(PaymentMethodType::Cash, $this->makeTotal('150.00'));
        $this->assertTrue($payment->isFullyPaid());
        $this->assertSame('0.00', $payment->getChangeDue()->amount);
    }

    public function test_add_tender_overpayment_produces_positive_change(): void
    {
        $payment = $this->makePayment($this->makeTotal('97.00'));
        $payment->addTender(PaymentMethodType::Cash, $this->makeTotal('100.00'));
        $this->assertTrue($payment->isFullyPaid());
        $this->assertSame('3.00', $payment->getChangeDue()->amount);
    }

    public function test_add_tender_split_payment_sums_correctly(): void
    {
        $payment = $this->makePayment($this->makeTotal('150.00'));
        $payment->addTender(PaymentMethodType::Card, $this->makeTotal('100.00'));
        $payment->addTender(PaymentMethodType::Cash, $this->makeTotal('50.00'));
        $this->assertTrue($payment->isFullyPaid());
        $this->assertSame('150.00', $payment->getAmountTendered()->amount);
    }

    public function test_add_tender_throws_when_captured(): void
    {
        $payment = $this->makePayment($this->makeTotal('100.00'));
        $payment->addTender(PaymentMethodType::Cash, $this->makeTotal('100.00'));
        $payment->capture();

        $this->expectException(InvalidPaymentStateException::class);
        $payment->addTender(PaymentMethodType::Cash, $this->makeTotal('50.00'));
    }

    public function test_add_tender_throws_on_currency_mismatch(): void
    {
        $payment = $this->makePayment();
        $this->expectException(InvalidArgumentException::class);
        $payment->addTender(PaymentMethodType::Cash, Money::of('100.00', 'USD'));
    }

    // ── removeTender() ────────────────────────────────────────────────────────

    public function test_remove_tender_decrements_count(): void
    {
        $payment = $this->makePayment();
        $tenderId = $payment->addTender(PaymentMethodType::Cash, $this->makeTotal('150.00'));
        $payment->removeTender($tenderId);
        $this->assertSame(0, $payment->getTenderCount());
    }

    public function test_remove_tender_recalculates_amounts(): void
    {
        $payment = $this->makePayment($this->makeTotal('150.00'));
        $tenderId1 = $payment->addTender(PaymentMethodType::Cash, $this->makeTotal('100.00'));
        $payment->addTender(PaymentMethodType::Card, $this->makeTotal('50.00'));
        $payment->removeTender($tenderId1);

        $this->assertSame('50.00', $payment->getAmountTendered()->amount);
        $this->assertFalse($payment->isFullyPaid());
    }

    public function test_remove_tender_throws_when_not_found(): void
    {
        $payment = $this->makePayment();
        $this->expectException(InvalidPaymentStateException::class);
        $payment->removeTender('non-existent-tender-id');
    }

    public function test_remove_tender_throws_when_captured(): void
    {
        $payment = $this->makePayment($this->makeTotal('100.00'));
        $tenderId = $payment->addTender(PaymentMethodType::Cash, $this->makeTotal('100.00'));
        $payment->capture();

        $this->expectException(InvalidPaymentStateException::class);
        $payment->removeTender($tenderId);
    }

    // ── isFullyPaid() ─────────────────────────────────────────────────────────

    public function test_is_fully_paid_false_with_no_tenders(): void
    {
        $this->assertFalse($this->makePayment()->isFullyPaid());
    }

    public function test_is_fully_paid_false_with_insufficient_tenders(): void
    {
        $payment = $this->makePayment($this->makeTotal('150.00'));
        $payment->addTender(PaymentMethodType::Cash, $this->makeTotal('100.00'));
        $this->assertFalse($payment->isFullyPaid());
    }

    public function test_is_fully_paid_true_with_exact_payment(): void
    {
        $payment = $this->makePayment($this->makeTotal('100.00'));
        $payment->addTender(PaymentMethodType::Cash, $this->makeTotal('100.00'));
        $this->assertTrue($payment->isFullyPaid());
    }

    public function test_is_fully_paid_true_with_overpayment(): void
    {
        $payment = $this->makePayment($this->makeTotal('100.00'));
        $payment->addTender(PaymentMethodType::Cash, $this->makeTotal('120.00'));
        $this->assertTrue($payment->isFullyPaid());
    }

    // ── getChangeDue() ────────────────────────────────────────────────────────

    public function test_change_due_negative_when_underpaid(): void
    {
        $payment = $this->makePayment($this->makeTotal('100.00'));
        $payment->addTender(PaymentMethodType::Cash, $this->makeTotal('60.00'));
        $this->assertSame('-40.00', $payment->getChangeDue()->amount);
    }

    public function test_change_due_zero_when_exact_payment(): void
    {
        $payment = $this->makePayment($this->makeTotal('100.00'));
        $payment->addTender(PaymentMethodType::Cash, $this->makeTotal('100.00'));
        $this->assertSame('0.00', $payment->getChangeDue()->amount);
    }

    public function test_change_due_positive_when_overpaid(): void
    {
        $payment = $this->makePayment($this->makeTotal('97.50'));
        $payment->addTender(PaymentMethodType::Cash, $this->makeTotal('100.00'));
        $this->assertSame('2.50', $payment->getChangeDue()->amount);
    }

    // ── getRemainingBalance() ─────────────────────────────────────────────────

    public function test_remaining_balance_equals_cart_total_initially(): void
    {
        $payment = $this->makePayment($this->makeTotal('150.00'));
        $this->assertSame('150.00', $payment->getRemainingBalance()->amount);
    }

    public function test_remaining_balance_decreases_with_each_tender(): void
    {
        $payment = $this->makePayment($this->makeTotal('150.00'));
        $payment->addTender(PaymentMethodType::Cash, $this->makeTotal('50.00'));
        $this->assertSame('100.00', $payment->getRemainingBalance()->amount);
    }

    public function test_remaining_balance_zero_when_fully_paid(): void
    {
        $payment = $this->makePayment($this->makeTotal('150.00'));
        $payment->addTender(PaymentMethodType::Cash, $this->makeTotal('150.00'));
        $this->assertSame('0.00', $payment->getRemainingBalance()->amount);
    }

    // ── capture() ────────────────────────────────────────────────────────────

    public function test_capture_transitions_to_captured(): void
    {
        $payment = $this->makePayment($this->makeTotal('100.00'));
        $payment->addTender(PaymentMethodType::Cash, $this->makeTotal('100.00'));
        $payment->capture();
        $this->assertSame(PaymentStatus::Captured, $payment->status);
    }

    public function test_capture_sets_captured_at(): void
    {
        $payment = $this->makePayment($this->makeTotal('100.00'));
        $payment->addTender(PaymentMethodType::Cash, $this->makeTotal('100.00'));
        $payment->capture();
        $this->assertNotNull($payment->captured_at);
    }

    public function test_capture_sets_is_captured(): void
    {
        $payment = $this->makePayment($this->makeTotal('100.00'));
        $payment->addTender(PaymentMethodType::Cash, $this->makeTotal('100.00'));
        $payment->capture();
        $this->assertTrue($payment->isCaptured());
        $this->assertFalse($payment->isPending());
    }

    public function test_capture_throws_when_already_captured(): void
    {
        $payment = $this->makePayment($this->makeTotal('100.00'));
        $payment->addTender(PaymentMethodType::Cash, $this->makeTotal('100.00'));
        $payment->capture();

        $this->expectException(InvalidPaymentStateException::class);
        $payment->capture();
    }

    public function test_capture_throws_when_not_fully_paid(): void
    {
        $payment = $this->makePayment($this->makeTotal('150.00'));
        $payment->addTender(PaymentMethodType::Cash, $this->makeTotal('100.00'));

        $this->expectException(InsufficientPaymentException::class);
        $payment->capture();
    }

    public function test_capture_throws_when_no_tenders(): void
    {
        $payment = $this->makePayment($this->makeTotal('100.00'));

        $this->expectException(InsufficientPaymentException::class);
        $payment->capture();
    }

    public function test_capture_succeeds_with_overpayment(): void
    {
        $payment = $this->makePayment($this->makeTotal('100.00'));
        $payment->addTender(PaymentMethodType::Cash, $this->makeTotal('120.00'));
        $payment->capture();

        $this->assertTrue($payment->isCaptured());
        $this->assertSame('20.00', $payment->getChangeDue()->amount);
    }

    // ── Full lifecycle ────────────────────────────────────────────────────────

    public function test_full_lifecycle_split_payment(): void
    {
        $payment = $this->makePayment($this->makeTotal('175.00'));

        $payment->addTender(PaymentMethodType::Card, $this->makeTotal('100.00'));
        $payment->addTender(PaymentMethodType::Cash, $this->makeTotal('75.00'));

        $this->assertTrue($payment->isFullyPaid());
        $this->assertSame(2, $payment->getTenderCount());
        $this->assertSame('0.00', $payment->getChangeDue()->amount);

        $payment->capture();
        $this->assertTrue($payment->isCaptured());
        $this->assertCount(2, $payment->getTenders());
    }

    public function test_tender_removal_and_re_add(): void
    {
        $payment = $this->makePayment($this->makeTotal('100.00'));
        $id1 = $payment->addTender(PaymentMethodType::Cash, $this->makeTotal('50.00'));

        $payment->removeTender($id1);
        $this->assertSame(0, $payment->getTenderCount());

        $payment->addTender(PaymentMethodType::Card, $this->makeTotal('100.00'));
        $this->assertSame(1, $payment->getTenderCount());
        $this->assertTrue($payment->isFullyPaid());
    }
}
