<?php

declare(strict_types=1);

namespace Tests\Feature\POS\Sale;

use InvalidArgumentException;
use Modules\POS\Sale\Domain\Exceptions\InvalidSaleTransitionException;
use Modules\POS\Sale\Domain\Models\Sale;
use Modules\POS\Sale\Domain\ValueObjects\PaymentSummaryLine;
use Modules\POS\Sale\Domain\ValueObjects\SaleLine;
use Modules\POS\Shared\Domain\Enums\SaleStatus;
use Modules\POS\Shared\Domain\ValueObjects\Money;
use Tests\TestCase;

/**
 * PKG-POS-008: Sale aggregate in-memory tests.
 * No RefreshDatabase — all assertions against in-memory state only.
 */
final class SaleAggregateTest extends TestCase
{
    private const CART_ID = 'cart-uuid-1';

    private const PAYMENT_ID = 'pay-uuid-1';

    private const SESSION_ID = 'session-uuid-1';

    private const SHIFT_ID = 'shift-uuid-1';

    private const TERMINAL_ID = 'terminal-uuid-1';

    private const CASHIER_ID = 'cashier-uuid-1';

    private const RECEIPT_NUMBER = 'RCP-2026-000001';

    private const CURRENCY = 'EGP';

    private function makeMoney(string $amount): Money
    {
        return Money::of($amount, self::CURRENCY);
    }

    private function makeSaleLine(string $lineId = 'line-1'): SaleLine
    {
        return SaleLine::fromCartLine([
            'id' => $lineId,
            'product_id' => 'prod-1',
            'product_name' => 'Widget',
            'sku' => 'WGT-001',
            'quantity' => '2.0000',
            'unit_price' => ['amount' => '50.00', 'currency' => self::CURRENCY],
            'discount_type' => null,
            'discount_value' => null,
            'line_total' => ['amount' => '100.00', 'currency' => self::CURRENCY],
            'sort_order' => 0,
        ]);
    }

    private function makePaymentSummary(string $type = 'cash', string $amount = '100.00'): PaymentSummaryLine
    {
        return PaymentSummaryLine::fromTender([
            'id' => 'tender-1',
            'type' => $type,
            'amount' => ['amount' => $amount, 'currency' => self::CURRENCY],
            'reference' => null,
            'metadata' => [],
        ]);
    }

    private function makeSale(
        string $total = '100.00',
        string $amountPaid = '100.00',
        string $changeGiven = '0.00',
        ?string $customerId = null,
        ?array $lines = null,
        ?array $summaries = null,
    ): Sale {
        return Sale::record(
            cartId: self::CART_ID,
            paymentId: self::PAYMENT_ID,
            sessionId: self::SESSION_ID,
            shiftId: self::SHIFT_ID,
            terminalId: self::TERMINAL_ID,
            cashierId: self::CASHIER_ID,
            customerId: $customerId,
            currency: self::CURRENCY,
            receiptNumber: self::RECEIPT_NUMBER,
            lines: $lines ?? [$this->makeSaleLine()],
            subtotal: $this->makeMoney($total),
            discountTotal: Money::zero(self::CURRENCY),
            total: $this->makeMoney($total),
            amountPaid: $this->makeMoney($amountPaid),
            changeGiven: $this->makeMoney($changeGiven),
            paymentSummaries: $summaries ?? [$this->makePaymentSummary()],
        );
    }

    // ── record() ──────────────────────────────────────────────────────────────

    public function test_record_creates_sale_in_pending_status(): void
    {
        $this->assertSame(SaleStatus::Pending, $this->makeSale()->status);
    }

    public function test_record_stores_cart_id(): void
    {
        $this->assertSame(self::CART_ID, $this->makeSale()->cart_id);
    }

    public function test_record_stores_payment_id(): void
    {
        $this->assertSame(self::PAYMENT_ID, $this->makeSale()->payment_id);
    }

    public function test_record_stores_all_identifiers(): void
    {
        $sale = $this->makeSale();
        $this->assertSame(self::SESSION_ID, $sale->session_id);
        $this->assertSame(self::SHIFT_ID, $sale->shift_id);
        $this->assertSame(self::TERMINAL_ID, $sale->terminal_id);
        $this->assertSame(self::CASHIER_ID, $sale->cashier_id);
    }

    public function test_record_stores_receipt_number(): void
    {
        $this->assertSame(self::RECEIPT_NUMBER, $this->makeSale()->receipt_number);
    }

    public function test_record_normalises_currency_to_uppercase(): void
    {
        $sale = Sale::record(
            cartId: self::CART_ID, paymentId: self::PAYMENT_ID,
            sessionId: self::SESSION_ID, shiftId: self::SHIFT_ID,
            terminalId: self::TERMINAL_ID, cashierId: self::CASHIER_ID,
            customerId: null, currency: 'egp', receiptNumber: 'RCP-001',
            lines: [$this->makeSaleLine()],
            subtotal: $this->makeMoney('10.00'), discountTotal: Money::zero(self::CURRENCY),
            total: $this->makeMoney('10.00'), amountPaid: $this->makeMoney('10.00'),
            changeGiven: Money::zero(self::CURRENCY),
            paymentSummaries: [$this->makePaymentSummary()],
        );
        $this->assertSame('EGP', $sale->currency);
    }

    public function test_record_customer_id_can_be_null(): void
    {
        $this->assertNull($this->makeSale(customerId: null)->customer_id);
    }

    public function test_record_stores_lines_snapshot(): void
    {
        $sale = $this->makeSale(lines: [$this->makeSaleLine('l1'), $this->makeSaleLine('l2')]);
        $this->assertSame(2, $sale->getLineCount());
    }

    public function test_record_stores_subtotal(): void
    {
        $this->assertSame('150.00', $this->makeSale(total: '150.00')->getSubtotal()->amount);
    }

    public function test_record_stores_discount_total(): void
    {
        $this->assertSame('0.00', $this->makeSale()->getDiscountTotal()->amount);
    }

    public function test_record_stores_total(): void
    {
        $this->assertSame('200.00', $this->makeSale(total: '200.00')->getTotal()->amount);
    }

    public function test_record_stores_amount_paid(): void
    {
        $this->assertSame('210.00', $this->makeSale(amountPaid: '210.00')->getAmountPaid()->amount);
    }

    public function test_record_stores_change_given(): void
    {
        $this->assertSame('10.00', $this->makeSale(amountPaid: '110.00', changeGiven: '10.00')->getChangeGiven()->amount);
    }

    public function test_record_stores_payment_summaries(): void
    {
        $summaries = [$this->makePaymentSummary('cash', '60.00'), $this->makePaymentSummary('card', '40.00')];
        $sale = $this->makeSale(summaries: $summaries);
        $this->assertCount(2, $sale->getPaymentSummaries());
    }

    public function test_record_is_pending(): void
    {
        $sale = $this->makeSale();
        $this->assertTrue($sale->isPending());
        $this->assertFalse($sale->isCompleted());
    }

    public function test_record_throws_for_empty_cart_id(): void
    {
        $this->expectException(InvalidArgumentException::class);
        Sale::record('', self::PAYMENT_ID, self::SESSION_ID, self::SHIFT_ID, self::TERMINAL_ID,
            self::CASHIER_ID, null, self::CURRENCY, self::RECEIPT_NUMBER,
            [$this->makeSaleLine()], $this->makeMoney('10.00'), Money::zero(self::CURRENCY),
            $this->makeMoney('10.00'), $this->makeMoney('10.00'), Money::zero(self::CURRENCY),
            [$this->makePaymentSummary()],
        );
    }

    public function test_record_throws_for_empty_payment_id(): void
    {
        $this->expectException(InvalidArgumentException::class);
        Sale::record(self::CART_ID, '', self::SESSION_ID, self::SHIFT_ID, self::TERMINAL_ID,
            self::CASHIER_ID, null, self::CURRENCY, self::RECEIPT_NUMBER,
            [$this->makeSaleLine()], $this->makeMoney('10.00'), Money::zero(self::CURRENCY),
            $this->makeMoney('10.00'), $this->makeMoney('10.00'), Money::zero(self::CURRENCY),
            [$this->makePaymentSummary()],
        );
    }

    public function test_record_throws_for_empty_session_id(): void
    {
        $this->expectException(InvalidArgumentException::class);
        Sale::record(self::CART_ID, self::PAYMENT_ID, '', self::SHIFT_ID, self::TERMINAL_ID,
            self::CASHIER_ID, null, self::CURRENCY, self::RECEIPT_NUMBER,
            [$this->makeSaleLine()], $this->makeMoney('10.00'), Money::zero(self::CURRENCY),
            $this->makeMoney('10.00'), $this->makeMoney('10.00'), Money::zero(self::CURRENCY),
            [$this->makePaymentSummary()],
        );
    }

    public function test_record_throws_for_empty_shift_id(): void
    {
        $this->expectException(InvalidArgumentException::class);
        Sale::record(self::CART_ID, self::PAYMENT_ID, self::SESSION_ID, '', self::TERMINAL_ID,
            self::CASHIER_ID, null, self::CURRENCY, self::RECEIPT_NUMBER,
            [$this->makeSaleLine()], $this->makeMoney('10.00'), Money::zero(self::CURRENCY),
            $this->makeMoney('10.00'), $this->makeMoney('10.00'), Money::zero(self::CURRENCY),
            [$this->makePaymentSummary()],
        );
    }

    public function test_record_throws_for_empty_terminal_id(): void
    {
        $this->expectException(InvalidArgumentException::class);
        Sale::record(self::CART_ID, self::PAYMENT_ID, self::SESSION_ID, self::SHIFT_ID, '',
            self::CASHIER_ID, null, self::CURRENCY, self::RECEIPT_NUMBER,
            [$this->makeSaleLine()], $this->makeMoney('10.00'), Money::zero(self::CURRENCY),
            $this->makeMoney('10.00'), $this->makeMoney('10.00'), Money::zero(self::CURRENCY),
            [$this->makePaymentSummary()],
        );
    }

    public function test_record_throws_for_empty_cashier_id(): void
    {
        $this->expectException(InvalidArgumentException::class);
        Sale::record(self::CART_ID, self::PAYMENT_ID, self::SESSION_ID, self::SHIFT_ID,
            self::TERMINAL_ID, '', null, self::CURRENCY, self::RECEIPT_NUMBER,
            [$this->makeSaleLine()], $this->makeMoney('10.00'), Money::zero(self::CURRENCY),
            $this->makeMoney('10.00'), $this->makeMoney('10.00'), Money::zero(self::CURRENCY),
            [$this->makePaymentSummary()],
        );
    }

    public function test_record_throws_for_empty_receipt_number(): void
    {
        $this->expectException(InvalidArgumentException::class);
        Sale::record(self::CART_ID, self::PAYMENT_ID, self::SESSION_ID, self::SHIFT_ID,
            self::TERMINAL_ID, self::CASHIER_ID, null, self::CURRENCY, '',
            [$this->makeSaleLine()], $this->makeMoney('10.00'), Money::zero(self::CURRENCY),
            $this->makeMoney('10.00'), $this->makeMoney('10.00'), Money::zero(self::CURRENCY),
            [$this->makePaymentSummary()],
        );
    }

    public function test_record_throws_for_empty_lines(): void
    {
        $this->expectException(InvalidArgumentException::class);
        Sale::record(self::CART_ID, self::PAYMENT_ID, self::SESSION_ID, self::SHIFT_ID,
            self::TERMINAL_ID, self::CASHIER_ID, null, self::CURRENCY, self::RECEIPT_NUMBER,
            [], $this->makeMoney('10.00'), Money::zero(self::CURRENCY),
            $this->makeMoney('10.00'), $this->makeMoney('10.00'), Money::zero(self::CURRENCY),
            [$this->makePaymentSummary()],
        );
    }

    public function test_record_throws_for_empty_payment_summaries(): void
    {
        $this->expectException(InvalidArgumentException::class);
        Sale::record(self::CART_ID, self::PAYMENT_ID, self::SESSION_ID, self::SHIFT_ID,
            self::TERMINAL_ID, self::CASHIER_ID, null, self::CURRENCY, self::RECEIPT_NUMBER,
            [$this->makeSaleLine()], $this->makeMoney('10.00'), Money::zero(self::CURRENCY),
            $this->makeMoney('10.00'), $this->makeMoney('10.00'), Money::zero(self::CURRENCY),
            [],
        );
    }

    public function test_record_throws_for_negative_change_given(): void
    {
        $this->expectException(InvalidArgumentException::class);
        Sale::record(self::CART_ID, self::PAYMENT_ID, self::SESSION_ID, self::SHIFT_ID,
            self::TERMINAL_ID, self::CASHIER_ID, null, self::CURRENCY, self::RECEIPT_NUMBER,
            [$this->makeSaleLine()], $this->makeMoney('100.00'), Money::zero(self::CURRENCY),
            $this->makeMoney('100.00'), $this->makeMoney('100.00'),
            Money::of('-10.00', self::CURRENCY),
            [$this->makePaymentSummary()],
        );
    }

    // ── complete() ────────────────────────────────────────────────────────────

    public function test_complete_transitions_to_completed(): void
    {
        $sale = $this->makeSale();
        $sale->complete();
        $this->assertSame(SaleStatus::Completed, $sale->status);
    }

    public function test_complete_sets_completed_at(): void
    {
        $sale = $this->makeSale();
        $sale->complete();
        $this->assertNotNull($sale->completed_at);
    }

    public function test_complete_sets_is_completed(): void
    {
        $sale = $this->makeSale();
        $sale->complete();
        $this->assertTrue($sale->isCompleted());
        $this->assertFalse($sale->isPending());
    }

    public function test_complete_throws_when_already_completed(): void
    {
        $sale = $this->makeSale();
        $sale->complete();
        $this->expectException(InvalidSaleTransitionException::class);
        $sale->complete();
    }

    public function test_complete_throws_when_voided(): void
    {
        $sale = $this->makeSale();
        $sale->void();
        $this->expectException(InvalidSaleTransitionException::class);
        $sale->complete();
    }

    // ── void() ───────────────────────────────────────────────────────────────

    public function test_void_transitions_to_voided(): void
    {
        $sale = $this->makeSale();
        $sale->void();
        $this->assertSame(SaleStatus::Voided, $sale->status);
    }

    public function test_void_sets_voided_at(): void
    {
        $sale = $this->makeSale();
        $sale->void();
        $this->assertNotNull($sale->voided_at);
    }

    public function test_void_stores_provided_reason(): void
    {
        $sale = $this->makeSale();
        $sale->void('Duplicate transaction');
        $this->assertSame('Duplicate transaction', $sale->voided_reason);
    }

    public function test_void_stores_empty_reason_by_default(): void
    {
        $sale = $this->makeSale();
        $sale->void();
        $this->assertSame('', $sale->voided_reason);
    }

    public function test_void_sets_is_voided(): void
    {
        $sale = $this->makeSale();
        $sale->void();
        $this->assertTrue($sale->isVoided());
    }

    public function test_void_throws_when_completed(): void
    {
        $sale = $this->makeSale();
        $sale->complete();
        $this->expectException(InvalidSaleTransitionException::class);
        $sale->void();
    }

    public function test_void_throws_when_already_voided(): void
    {
        $sale = $this->makeSale();
        $sale->void();
        $this->expectException(InvalidSaleTransitionException::class);
        $sale->void();
    }

    // ── markRefunded() ────────────────────────────────────────────────────────

    public function test_mark_refunded_transitions_completed_to_refunded(): void
    {
        $sale = $this->makeSale();
        $sale->complete();
        $sale->markRefunded();
        $this->assertSame(SaleStatus::Refunded, $sale->status);
    }

    public function test_mark_refunded_sets_is_refunded(): void
    {
        $sale = $this->makeSale();
        $sale->complete();
        $sale->markRefunded();
        $this->assertTrue($sale->isRefunded());
    }

    public function test_mark_refunded_throws_when_pending(): void
    {
        $sale = $this->makeSale();
        $this->expectException(InvalidSaleTransitionException::class);
        $sale->markRefunded();
    }

    public function test_mark_refunded_throws_when_voided(): void
    {
        $sale = $this->makeSale();
        $sale->void();
        $this->expectException(InvalidSaleTransitionException::class);
        $sale->markRefunded();
    }

    public function test_mark_refunded_transitions_partially_refunded_to_refunded(): void
    {
        $sale = $this->makeSale();
        $sale->complete();
        $sale->markPartiallyRefunded();
        $sale->markRefunded();
        $this->assertSame(SaleStatus::Refunded, $sale->status);
    }

    // ── markPartiallyRefunded() ───────────────────────────────────────────────

    public function test_mark_partially_refunded_transitions_completed(): void
    {
        $sale = $this->makeSale();
        $sale->complete();
        $sale->markPartiallyRefunded();
        $this->assertSame(SaleStatus::PartiallyRefunded, $sale->status);
    }

    public function test_mark_partially_refunded_sets_is_partially_refunded(): void
    {
        $sale = $this->makeSale();
        $sale->complete();
        $sale->markPartiallyRefunded();
        $this->assertTrue($sale->isPartiallyRefunded());
    }

    public function test_mark_partially_refunded_throws_when_pending(): void
    {
        $sale = $this->makeSale();
        $this->expectException(InvalidSaleTransitionException::class);
        $sale->markPartiallyRefunded();
    }

    public function test_mark_partially_refunded_throws_when_voided(): void
    {
        $sale = $this->makeSale();
        $sale->void();
        $this->expectException(InvalidSaleTransitionException::class);
        $sale->markPartiallyRefunded();
    }

    public function test_mark_partially_refunded_throws_when_already_refunded(): void
    {
        $sale = $this->makeSale();
        $sale->complete();
        $sale->markRefunded();
        $this->expectException(InvalidSaleTransitionException::class);
        $sale->markPartiallyRefunded();
    }

    // ── Getters ───────────────────────────────────────────────────────────────

    public function test_get_lines_returns_sale_line_instances(): void
    {
        $sale = $this->makeSale(lines: [$this->makeSaleLine('l1'), $this->makeSaleLine('l2')]);
        $lines = $sale->getLines();
        $this->assertCount(2, $lines);
        $this->assertContainsOnlyInstancesOf(SaleLine::class, $lines);
    }

    public function test_get_payment_summaries_returns_summary_instances(): void
    {
        $sale = $this->makeSale(summaries: [$this->makePaymentSummary()]);
        $summaries = $sale->getPaymentSummaries();
        $this->assertCount(1, $summaries);
        $this->assertContainsOnlyInstancesOf(PaymentSummaryLine::class, $summaries);
    }

    public function test_get_subtotal_returns_money(): void
    {
        $sale = $this->makeSale(total: '250.00');
        $this->assertSame('250.00', $sale->getSubtotal()->amount);
        $this->assertSame(self::CURRENCY, $sale->getSubtotal()->currency);
    }

    public function test_get_total_returns_money(): void
    {
        $this->assertSame('300.00', $this->makeSale(total: '300.00')->getTotal()->amount);
    }

    public function test_get_amount_paid_returns_money(): void
    {
        $this->assertSame('310.00', $this->makeSale(amountPaid: '310.00')->getAmountPaid()->amount);
    }

    public function test_get_change_given_returns_money(): void
    {
        $this->assertSame('10.00', $this->makeSale(amountPaid: '110.00', changeGiven: '10.00')->getChangeGiven()->amount);
    }

    public function test_get_line_count_returns_count(): void
    {
        $sale = $this->makeSale(lines: [
            $this->makeSaleLine('l1'),
            $this->makeSaleLine('l2'),
            $this->makeSaleLine('l3'),
        ]);
        $this->assertSame(3, $sale->getLineCount());
    }

    // ── Full lifecycle ────────────────────────────────────────────────────────

    public function test_full_lifecycle_record_complete_refund(): void
    {
        $sale = $this->makeSale();
        $this->assertTrue($sale->isPending());

        $sale->complete();
        $this->assertTrue($sale->isCompleted());
        $this->assertNotNull($sale->completed_at);

        $sale->markRefunded();
        $this->assertTrue($sale->isRefunded());
    }

    public function test_full_lifecycle_record_void(): void
    {
        $sale = $this->makeSale();
        $sale->void('Wrong item scanned');
        $this->assertTrue($sale->isVoided());
        $this->assertSame('Wrong item scanned', $sale->voided_reason);
        $this->assertNotNull($sale->voided_at);
    }

    public function test_full_lifecycle_partial_then_full_refund(): void
    {
        $sale = $this->makeSale();
        $sale->complete();
        $sale->markPartiallyRefunded();
        $this->assertTrue($sale->isPartiallyRefunded());
        $sale->markRefunded();
        $this->assertTrue($sale->isRefunded());
    }
}
