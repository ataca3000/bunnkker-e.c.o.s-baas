<?php

declare(strict_types=1);

namespace Tests\Feature\POS\Receipt;

use DateTimeImmutable;
use DateTimeZone;
use InvalidArgumentException;
use Modules\POS\Receipt\Domain\Enums\ReceiptStatus;
use Modules\POS\Receipt\Domain\Enums\ReceiptType;
use Modules\POS\Receipt\Domain\Enums\ReprintReason;
use Modules\POS\Receipt\Domain\Events\ReceiptIssued;
use Modules\POS\Receipt\Domain\Events\ReceiptReprinted;
use Modules\POS\Receipt\Domain\Events\ReceiptVoided;
use Modules\POS\Receipt\Domain\Exceptions\ReceiptAlreadyVoidedException;
use Modules\POS\Receipt\Domain\Exceptions\ReprintNotAllowedException;
use Modules\POS\Receipt\Domain\Models\Receipt;
use Modules\POS\Receipt\Domain\ValueObjects\ReceiptLineItem;
use Modules\POS\Receipt\Domain\ValueObjects\ReceiptPayment;
use Modules\POS\Receipt\Domain\ValueObjects\ReceiptTotals;
use Tests\TestCase;

final class ReceiptAggregateTest extends TestCase
{
    // ── issue() guards ────────────────────────────────────────────────────────

    public function test_rejects_empty_receipt_number(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('Receipt number cannot be empty');

        $this->makeReceipt(receiptNumber: '');
    }

    public function test_rejects_empty_original_transaction_id(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('Original transaction ID cannot be empty');

        $this->makeReceipt(originalTransactionId: '');
    }

    public function test_rejects_empty_original_transaction_number(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('Original transaction number cannot be empty');

        $this->makeReceipt(originalTransactionNumber: '');
    }

    public function test_rejects_empty_terminal_id(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('Terminal ID cannot be empty');

        $this->makeReceipt(terminalId: '');
    }

    public function test_rejects_empty_cashier_id(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('Cashier ID cannot be empty');

        $this->makeReceipt(cashierId: '');
    }

    public function test_rejects_empty_line_items(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('at least one line item');

        $this->makeReceipt(lineItems: []);
    }

    public function test_rejects_non_instance_line_item(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('ReceiptLineItem instance');

        $this->makeReceipt(lineItems: ['not-a-line-item']);
    }

    public function test_rejects_non_instance_payment(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('ReceiptPayment instance');

        $this->makeReceipt(payments: ['not-a-payment']);
    }

    // ── successful issuance ───────────────────────────────────────────────────

    public function test_issue_creates_issued_status(): void
    {
        $receipt = $this->makeReceipt();

        $this->assertSame(ReceiptStatus::Issued, $receipt->getStatus());
        $this->assertTrue($receipt->isIssued());
        $this->assertFalse($receipt->isVoided());
    }

    public function test_issue_assigns_uuid(): void
    {
        $receipt = $this->makeReceipt();

        $this->assertNotNull($receipt->id);
        $this->assertMatchesRegularExpression(
            '/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/',
            (string) $receipt->id,
        );
    }

    public function test_issue_sets_reprint_count_to_zero(): void
    {
        $this->assertSame(0, $this->makeReceipt()->reprint_count);
    }

    public function test_issue_fires_receipt_issued_event(): void
    {
        $receipt = $this->makeReceipt();
        $events = $receipt->pullDomainEvents();

        $this->assertCount(1, $events);
        $this->assertInstanceOf(ReceiptIssued::class, $events[0]);
    }

    public function test_pull_domain_events_clears_queue(): void
    {
        $receipt = $this->makeReceipt();
        $receipt->pullDomainEvents();

        $this->assertEmpty($receipt->pullDomainEvents());
    }

    public function test_currency_is_uppercased(): void
    {
        $receipt = $this->makeReceipt(currency: 'egp');

        $this->assertSame('EGP', $receipt->currency);
    }

    // ── reprint() ─────────────────────────────────────────────────────────────

    public function test_reprint_increments_count(): void
    {
        $receipt = $this->makeReceipt();
        $receipt->reprint('cashier-1', 'term-1', ReprintReason::CustomerRequest);

        $this->assertSame(1, $receipt->reprint_count);
    }

    public function test_reprint_appends_reprint_record(): void
    {
        $receipt = $this->makeReceipt();
        $receipt->reprint('cashier-1', 'term-1', ReprintReason::CustomerRequest);

        $records = $receipt->getReprintRecords();

        $this->assertCount(1, $records);
        $this->assertSame('cashier-1', $records[0]->cashierId);
        $this->assertSame('term-1', $records[0]->terminalId);
        $this->assertSame('customer_request', $records[0]->reason);
    }

    public function test_reprint_fires_receipt_reprinted_event(): void
    {
        $receipt = $this->makeReceipt();
        $receipt->pullDomainEvents();

        $receipt->reprint('cashier-1', 'term-1', ReprintReason::PrinterError);
        $events = $receipt->pullDomainEvents();

        $this->assertCount(1, $events);
        $this->assertInstanceOf(ReceiptReprinted::class, $events[0]);
        $this->assertSame(1, $events[0]->reprintCount);
    }

    public function test_reprint_throws_when_voided(): void
    {
        $receipt = $this->makeReceipt();
        $receipt->void('cashier-1', 'Duplicate');

        $this->expectException(ReprintNotAllowedException::class);
        $this->expectExceptionMessage('voided');

        $receipt->reprint('cashier-1', 'term-1', ReprintReason::Damaged);
    }

    public function test_reprint_throws_when_limit_exceeded(): void
    {
        $receipt = $this->makeReceipt();
        $maxReprints = 2;

        $receipt->reprint('cashier-1', 'term-1', ReprintReason::CustomerRequest, $maxReprints);
        $receipt->reprint('cashier-1', 'term-1', ReprintReason::CustomerRequest, $maxReprints);

        $this->expectException(ReprintNotAllowedException::class);
        $this->expectExceptionMessage('maximum reprint limit');

        $receipt->reprint('cashier-1', 'term-1', ReprintReason::CustomerRequest, $maxReprints);
    }

    public function test_multiple_reprints_accumulate(): void
    {
        $receipt = $this->makeReceipt();
        $receipt->reprint('cashier-1', 'term-1', ReprintReason::CustomerRequest);
        $receipt->reprint('cashier-1', 'term-1', ReprintReason::PrinterError);

        $this->assertSame(2, $receipt->reprint_count);
        $this->assertCount(2, $receipt->getReprintRecords());
    }

    // ── void() ────────────────────────────────────────────────────────────────

    public function test_void_transitions_to_voided(): void
    {
        $receipt = $this->makeReceipt();
        $receipt->void('cashier-1', 'Duplicate receipt');

        $this->assertSame(ReceiptStatus::Voided, $receipt->getStatus());
        $this->assertTrue($receipt->isVoided());
        $this->assertFalse($receipt->isIssued());
    }

    public function test_void_fires_receipt_voided_event(): void
    {
        $receipt = $this->makeReceipt();
        $receipt->pullDomainEvents();

        $receipt->void('cashier-1', 'Error');
        $events = $receipt->pullDomainEvents();

        $this->assertCount(1, $events);
        $this->assertInstanceOf(ReceiptVoided::class, $events[0]);
        $this->assertSame('cashier-1', $events[0]->voidedBy);
        $this->assertSame('Error', $events[0]->voidReason);
    }

    public function test_void_stores_cashier_and_reason(): void
    {
        $receipt = $this->makeReceipt();
        $receipt->void('cashier-2', 'Printed in error');

        $this->assertSame('cashier-2', $receipt->voided_by);
        $this->assertSame('Printed in error', $receipt->void_reason);
        $this->assertNotNull($receipt->voided_at);
    }

    public function test_void_reason_is_null_when_empty_string_provided(): void
    {
        $receipt = $this->makeReceipt();
        $receipt->void('cashier-1', '');

        $this->assertNull($receipt->void_reason);
    }

    public function test_void_throws_when_already_voided(): void
    {
        $receipt = $this->makeReceipt();
        $receipt->void('cashier-1', '');

        $this->expectException(ReceiptAlreadyVoidedException::class);

        $receipt->void('cashier-2', '');
    }

    // ── getters ───────────────────────────────────────────────────────────────

    public function test_get_line_items_returns_array(): void
    {
        $receipt = $this->makeReceipt();

        $this->assertCount(1, $receipt->getLineItems());
    }

    public function test_get_totals_returns_receipt_totals(): void
    {
        $receipt = $this->makeReceipt();

        $totals = $receipt->getTotals();

        $this->assertSame('114.00', $totals->totalAmount);
        $this->assertSame('EGP', $totals->currency);
    }

    public function test_get_payments_returns_array(): void
    {
        $receipt = $this->makeReceipt();

        $this->assertCount(1, $receipt->getPayments());
    }

    // ── Helper ────────────────────────────────────────────────────────────────

    private function makeReceipt(
        string $receiptNumber = 'RCP-20260701-T01-00001',
        string $originalTransactionId = 'sale-1',
        string $originalTransactionNumber = 'SALE-0001',
        string $terminalId = 'term-1',
        string $cashierId = 'cashier-1',
        string $currency = 'EGP',
        ?array $lineItems = null,
        ?array $payments = null,
    ): Receipt {
        return Receipt::issue(
            receiptNumber: $receiptNumber,
            type: ReceiptType::Sale,
            originalTransactionId: $originalTransactionId,
            originalTransactionNumber: $originalTransactionNumber,
            terminalId: $terminalId,
            sessionId: 'sess-1',
            shiftId: 'shift-1',
            cashierId: $cashierId,
            cashierName: 'Test Cashier',
            customerId: null,
            customerName: null,
            currency: $currency,
            lineItems: $lineItems ?? [
                ReceiptLineItem::of('prod-1', 'Blue Shirt', 'SKU-001', '1', '100.00', '100.00', 'EGP'),
            ],
            totals: ReceiptTotals::of('100.00', '0.00', '14.00', '114.00', '120.00', '6.00', 'EGP'),
            payments: $payments ?? [ReceiptPayment::of('cash', '120.00', 'EGP')],
            issuedAt: new DateTimeImmutable('2026-07-01 10:00:00', new DateTimeZone('UTC')),
        );
    }
}
