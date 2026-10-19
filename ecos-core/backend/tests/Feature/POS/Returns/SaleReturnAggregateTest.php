<?php

declare(strict_types=1);

namespace Tests\Feature\POS\Returns;

use InvalidArgumentException;
use Modules\POS\Returns\Domain\Exceptions\InvalidReturnTransitionException;
use Modules\POS\Returns\Domain\Models\SaleReturn;
use Modules\POS\Returns\Domain\ValueObjects\ReturnLine;
use Modules\POS\Shared\Domain\Enums\PaymentMethodType;
use Modules\POS\Shared\Domain\Enums\ReturnReason;
use Modules\POS\Shared\Domain\Enums\ReturnStatus;
use Modules\POS\Shared\Domain\ValueObjects\Money;
use Modules\POS\Shared\Domain\ValueObjects\Quantity;
use Tests\TestCase;

/**
 * PKG-POS-009: SaleReturn aggregate in-memory tests.
 * No RefreshDatabase — all assertions against in-memory state only.
 */
final class SaleReturnAggregateTest extends TestCase
{
    private const SALE_ID = 'sale-uuid-1';

    private const RECEIPT_NUMBER = 'RCP-2026-000001';

    private const SESSION_ID = 'session-uuid-1';

    private const SHIFT_ID = 'shift-uuid-1';

    private const TERMINAL_ID = 'terminal-uuid-1';

    private const CASHIER_ID = 'cashier-uuid-1';

    private const RETURN_NUMBER = 'RTN-2026-000001';

    private const CURRENCY = 'EGP';

    private function makeMoney(string $amount): Money
    {
        return Money::of($amount, self::CURRENCY);
    }

    private function makeReturnLine(string $lineId = 'line-1', string $price = '50.00'): ReturnLine
    {
        return ReturnLine::fromSaleLine(
            [
                'line_id' => $lineId,
                'product_id' => 'prod-1',
                'product_name' => 'Widget',
                'sku' => 'WGT-001',
                'quantity' => '2.0000',
                'unit_price' => ['amount' => $price, 'currency' => self::CURRENCY],
                'discount_type' => null,
                'discount_value' => null,
                'line_total' => ['amount' => bcmul($price, '2', 2), 'currency' => self::CURRENCY],
                'sort_order' => 0,
            ],
            Quantity::of('1'),
            ReturnReason::WrongItem,
        );
    }

    private function makeSaleReturn(
        string $saleId = self::SALE_ID,
        string $returnNumber = self::RETURN_NUMBER,
        ?string $customerId = null,
        ?array $lines = null,
        string $refundTotal = '50.00',
        ?string $notes = null,
    ): SaleReturn {
        return SaleReturn::initiate(
            saleId: $saleId,
            originalReceiptNumber: self::RECEIPT_NUMBER,
            sessionId: self::SESSION_ID,
            shiftId: self::SHIFT_ID,
            terminalId: self::TERMINAL_ID,
            cashierId: self::CASHIER_ID,
            customerId: $customerId,
            currency: self::CURRENCY,
            returnNumber: $returnNumber,
            lines: $lines ?? [$this->makeReturnLine()],
            refundTotal: $this->makeMoney($refundTotal),
            refundMethod: PaymentMethodType::Cash,
            notes: $notes,
        );
    }

    // ── initiate() ────────────────────────────────────────────────────────────

    public function test_initiate_creates_return_in_pending_status(): void
    {
        $this->assertSame(ReturnStatus::Pending, $this->makeSaleReturn()->status);
    }

    public function test_initiate_is_pending(): void
    {
        $r = $this->makeSaleReturn();
        $this->assertTrue($r->isPending());
        $this->assertFalse($r->isProcessed());
        $this->assertFalse($r->isCancelled());
    }

    public function test_initiate_stores_sale_id(): void
    {
        $this->assertSame(self::SALE_ID, $this->makeSaleReturn()->sale_id);
    }

    public function test_initiate_stores_original_receipt_number(): void
    {
        $this->assertSame(self::RECEIPT_NUMBER, $this->makeSaleReturn()->original_receipt_number);
    }

    public function test_initiate_stores_return_number(): void
    {
        $this->assertSame(self::RETURN_NUMBER, $this->makeSaleReturn()->return_number);
    }

    public function test_initiate_stores_all_identifiers(): void
    {
        $r = $this->makeSaleReturn();
        $this->assertSame(self::SESSION_ID, $r->session_id);
        $this->assertSame(self::SHIFT_ID, $r->shift_id);
        $this->assertSame(self::TERMINAL_ID, $r->terminal_id);
        $this->assertSame(self::CASHIER_ID, $r->cashier_id);
    }

    public function test_initiate_normalises_currency_to_uppercase(): void
    {
        $r = SaleReturn::initiate(
            self::SALE_ID, self::RECEIPT_NUMBER, self::SESSION_ID, self::SHIFT_ID,
            self::TERMINAL_ID, self::CASHIER_ID, null, 'egp', self::RETURN_NUMBER,
            [$this->makeReturnLine()], $this->makeMoney('50.00'), PaymentMethodType::Cash,
        );
        $this->assertSame('EGP', $r->currency);
    }

    public function test_initiate_customer_id_can_be_null(): void
    {
        $this->assertNull($this->makeSaleReturn(customerId: null)->customer_id);
    }

    public function test_initiate_stores_lines_snapshot(): void
    {
        $lines = [$this->makeReturnLine('l1'), $this->makeReturnLine('l2')];
        $r = $this->makeSaleReturn(lines: $lines);
        $this->assertSame(2, $r->getLineCount());
    }

    public function test_initiate_stores_refund_total(): void
    {
        $this->assertSame('75.00', $this->makeSaleReturn(refundTotal: '75.00')->getRefundTotal()->amount);
    }

    public function test_initiate_stores_refund_method(): void
    {
        $this->assertSame(PaymentMethodType::Cash, $this->makeSaleReturn()->refund_method);
    }

    public function test_initiate_stores_notes(): void
    {
        $this->assertSame('Customer was upset', $this->makeSaleReturn(notes: 'Customer was upset')->notes);
    }

    public function test_initiate_notes_can_be_null(): void
    {
        $this->assertNull($this->makeSaleReturn()->notes);
    }

    public function test_initiate_processed_at_and_cancelled_at_are_null(): void
    {
        $r = $this->makeSaleReturn();
        $this->assertNull($r->processed_at);
        $this->assertNull($r->cancelled_at);
    }

    public function test_initiate_throws_for_empty_sale_id(): void
    {
        $this->expectException(InvalidArgumentException::class);
        SaleReturn::initiate(
            '', self::RECEIPT_NUMBER, self::SESSION_ID, self::SHIFT_ID,
            self::TERMINAL_ID, self::CASHIER_ID, null, self::CURRENCY, self::RETURN_NUMBER,
            [$this->makeReturnLine()], $this->makeMoney('50.00'), PaymentMethodType::Cash,
        );
    }

    public function test_initiate_throws_for_empty_original_receipt_number(): void
    {
        $this->expectException(InvalidArgumentException::class);
        SaleReturn::initiate(
            self::SALE_ID, '', self::SESSION_ID, self::SHIFT_ID,
            self::TERMINAL_ID, self::CASHIER_ID, null, self::CURRENCY, self::RETURN_NUMBER,
            [$this->makeReturnLine()], $this->makeMoney('50.00'), PaymentMethodType::Cash,
        );
    }

    public function test_initiate_throws_for_empty_session_id(): void
    {
        $this->expectException(InvalidArgumentException::class);
        SaleReturn::initiate(
            self::SALE_ID, self::RECEIPT_NUMBER, '', self::SHIFT_ID,
            self::TERMINAL_ID, self::CASHIER_ID, null, self::CURRENCY, self::RETURN_NUMBER,
            [$this->makeReturnLine()], $this->makeMoney('50.00'), PaymentMethodType::Cash,
        );
    }

    public function test_initiate_throws_for_empty_shift_id(): void
    {
        $this->expectException(InvalidArgumentException::class);
        SaleReturn::initiate(
            self::SALE_ID, self::RECEIPT_NUMBER, self::SESSION_ID, '',
            self::TERMINAL_ID, self::CASHIER_ID, null, self::CURRENCY, self::RETURN_NUMBER,
            [$this->makeReturnLine()], $this->makeMoney('50.00'), PaymentMethodType::Cash,
        );
    }

    public function test_initiate_throws_for_empty_terminal_id(): void
    {
        $this->expectException(InvalidArgumentException::class);
        SaleReturn::initiate(
            self::SALE_ID, self::RECEIPT_NUMBER, self::SESSION_ID, self::SHIFT_ID,
            '', self::CASHIER_ID, null, self::CURRENCY, self::RETURN_NUMBER,
            [$this->makeReturnLine()], $this->makeMoney('50.00'), PaymentMethodType::Cash,
        );
    }

    public function test_initiate_throws_for_empty_cashier_id(): void
    {
        $this->expectException(InvalidArgumentException::class);
        SaleReturn::initiate(
            self::SALE_ID, self::RECEIPT_NUMBER, self::SESSION_ID, self::SHIFT_ID,
            self::TERMINAL_ID, '', null, self::CURRENCY, self::RETURN_NUMBER,
            [$this->makeReturnLine()], $this->makeMoney('50.00'), PaymentMethodType::Cash,
        );
    }

    public function test_initiate_throws_for_empty_return_number(): void
    {
        $this->expectException(InvalidArgumentException::class);
        SaleReturn::initiate(
            self::SALE_ID, self::RECEIPT_NUMBER, self::SESSION_ID, self::SHIFT_ID,
            self::TERMINAL_ID, self::CASHIER_ID, null, self::CURRENCY, '',
            [$this->makeReturnLine()], $this->makeMoney('50.00'), PaymentMethodType::Cash,
        );
    }

    public function test_initiate_throws_for_empty_lines(): void
    {
        $this->expectException(InvalidArgumentException::class);
        SaleReturn::initiate(
            self::SALE_ID, self::RECEIPT_NUMBER, self::SESSION_ID, self::SHIFT_ID,
            self::TERMINAL_ID, self::CASHIER_ID, null, self::CURRENCY, self::RETURN_NUMBER,
            [], $this->makeMoney('50.00'), PaymentMethodType::Cash,
        );
    }

    public function test_initiate_throws_for_zero_refund_total(): void
    {
        $this->expectException(InvalidArgumentException::class);
        SaleReturn::initiate(
            self::SALE_ID, self::RECEIPT_NUMBER, self::SESSION_ID, self::SHIFT_ID,
            self::TERMINAL_ID, self::CASHIER_ID, null, self::CURRENCY, self::RETURN_NUMBER,
            [$this->makeReturnLine()], Money::zero(self::CURRENCY), PaymentMethodType::Cash,
        );
    }

    public function test_initiate_throws_for_negative_refund_total(): void
    {
        $this->expectException(InvalidArgumentException::class);
        SaleReturn::initiate(
            self::SALE_ID, self::RECEIPT_NUMBER, self::SESSION_ID, self::SHIFT_ID,
            self::TERMINAL_ID, self::CASHIER_ID, null, self::CURRENCY, self::RETURN_NUMBER,
            [$this->makeReturnLine()], Money::of('-10.00', self::CURRENCY), PaymentMethodType::Cash,
        );
    }

    // ── process() ────────────────────────────────────────────────────────────

    public function test_process_transitions_to_processed(): void
    {
        $r = $this->makeSaleReturn();
        $r->process();
        $this->assertSame(ReturnStatus::Processed, $r->status);
    }

    public function test_process_sets_processed_at(): void
    {
        $r = $this->makeSaleReturn();
        $r->process();
        $this->assertNotNull($r->processed_at);
    }

    public function test_process_sets_is_processed(): void
    {
        $r = $this->makeSaleReturn();
        $r->process();
        $this->assertTrue($r->isProcessed());
        $this->assertFalse($r->isPending());
    }

    public function test_process_throws_when_already_processed(): void
    {
        $r = $this->makeSaleReturn();
        $r->process();
        $this->expectException(InvalidReturnTransitionException::class);
        $r->process();
    }

    public function test_process_throws_when_cancelled(): void
    {
        $r = $this->makeSaleReturn();
        $r->cancel();
        $this->expectException(InvalidReturnTransitionException::class);
        $r->process();
    }

    // ── cancel() ─────────────────────────────────────────────────────────────

    public function test_cancel_transitions_to_cancelled(): void
    {
        $r = $this->makeSaleReturn();
        $r->cancel();
        $this->assertSame(ReturnStatus::Cancelled, $r->status);
    }

    public function test_cancel_sets_cancelled_at(): void
    {
        $r = $this->makeSaleReturn();
        $r->cancel();
        $this->assertNotNull($r->cancelled_at);
    }

    public function test_cancel_stores_provided_reason(): void
    {
        $r = $this->makeSaleReturn();
        $r->cancel('Manager override');
        $this->assertSame('Manager override', $r->cancelled_reason);
    }

    public function test_cancel_stores_empty_reason_by_default(): void
    {
        $r = $this->makeSaleReturn();
        $r->cancel();
        $this->assertSame('', $r->cancelled_reason);
    }

    public function test_cancel_sets_is_cancelled(): void
    {
        $r = $this->makeSaleReturn();
        $r->cancel();
        $this->assertTrue($r->isCancelled());
        $this->assertFalse($r->isPending());
    }

    public function test_cancel_throws_when_already_processed(): void
    {
        $r = $this->makeSaleReturn();
        $r->process();
        $this->expectException(InvalidReturnTransitionException::class);
        $r->cancel();
    }

    public function test_cancel_throws_when_already_cancelled(): void
    {
        $r = $this->makeSaleReturn();
        $r->cancel();
        $this->expectException(InvalidReturnTransitionException::class);
        $r->cancel();
    }

    // ── Getters ───────────────────────────────────────────────────────────────

    public function test_get_lines_returns_return_line_instances(): void
    {
        $r = $this->makeSaleReturn(lines: [$this->makeReturnLine('l1'), $this->makeReturnLine('l2')]);
        $lines = $r->getLines();
        $this->assertCount(2, $lines);
        $this->assertContainsOnlyInstancesOf(ReturnLine::class, $lines);
    }

    public function test_get_refund_total_returns_money(): void
    {
        $this->assertSame('125.00', $this->makeSaleReturn(refundTotal: '125.00')->getRefundTotal()->amount);
        $this->assertSame(self::CURRENCY, $this->makeSaleReturn()->getRefundTotal()->currency);
    }

    public function test_get_line_count_returns_count(): void
    {
        $r = $this->makeSaleReturn(lines: [
            $this->makeReturnLine('l1'),
            $this->makeReturnLine('l2'),
            $this->makeReturnLine('l3'),
        ]);
        $this->assertSame(3, $r->getLineCount());
    }

    // ── Full lifecycle ────────────────────────────────────────────────────────

    public function test_full_lifecycle_initiate_then_process(): void
    {
        $r = $this->makeSaleReturn();
        $this->assertTrue($r->isPending());

        $r->process();
        $this->assertTrue($r->isProcessed());
        $this->assertNotNull($r->processed_at);
        $this->assertTrue($r->status->isTerminal());
    }

    public function test_full_lifecycle_initiate_then_cancel(): void
    {
        $r = $this->makeSaleReturn();
        $r->cancel('Policy violation');
        $this->assertTrue($r->isCancelled());
        $this->assertSame('Policy violation', $r->cancelled_reason);
        $this->assertTrue($r->status->isTerminal());
    }
}
