<?php

declare(strict_types=1);

namespace Tests\Unit\POS\Receipt;

use DateTimeImmutable;
use DateTimeZone;
use Modules\POS\Receipt\Domain\Enums\ReceiptType;
use Modules\POS\Receipt\Domain\Enums\ReprintReason;
use Modules\POS\Receipt\Domain\Models\Receipt;
use Modules\POS\Receipt\Domain\Policies\ReprintPolicy;
use Modules\POS\Receipt\Domain\ValueObjects\ReceiptLineItem;
use Modules\POS\Receipt\Domain\ValueObjects\ReceiptPayment;
use Modules\POS\Receipt\Domain\ValueObjects\ReceiptTotals;
use Tests\TestCase;

final class ReprintPolicyTest extends TestCase
{
    private ReprintPolicy $policy;

    protected function setUp(): void
    {
        parent::setUp();

        $this->policy = new ReprintPolicy;
    }

    // ── canReprint() ──────────────────────────────────────────────────────────

    public function test_can_reprint_an_issued_receipt(): void
    {
        $this->assertTrue($this->policy->canReprint($this->makeReceipt()));
    }

    public function test_cannot_reprint_a_voided_receipt(): void
    {
        $receipt = $this->makeReceipt();
        $receipt->void('cashier-1', 'Test void');

        $this->assertFalse($this->policy->canReprint($receipt));
    }

    public function test_cannot_reprint_when_limit_is_reached(): void
    {
        $receipt = $this->makeReceipt();

        for ($i = 0; $i < ReprintPolicy::DEFAULT_MAX_REPRINTS; $i++) {
            $receipt->reprint('cashier-1', 'term-1', ReprintReason::CustomerRequest);
        }

        $this->assertFalse($this->policy->canReprint($receipt));
    }

    public function test_can_reprint_one_below_limit(): void
    {
        $receipt = $this->makeReceipt();

        for ($i = 0; $i < ReprintPolicy::DEFAULT_MAX_REPRINTS - 1; $i++) {
            $receipt->reprint('cashier-1', 'term-1', ReprintReason::CustomerRequest);
        }

        $this->assertTrue($this->policy->canReprint($receipt));
    }

    // ── canVoid() ─────────────────────────────────────────────────────────────

    public function test_can_void_an_issued_receipt(): void
    {
        $this->assertTrue($this->policy->canVoid($this->makeReceipt()));
    }

    public function test_cannot_void_an_already_voided_receipt(): void
    {
        $receipt = $this->makeReceipt();
        $receipt->void('cashier-1', '');

        $this->assertFalse($this->policy->canVoid($receipt));
    }

    // ── wouldExceedReprintLimit() ─────────────────────────────────────────────

    public function test_would_exceed_limit_is_false_when_below_limit(): void
    {
        $this->assertFalse($this->policy->wouldExceedReprintLimit($this->makeReceipt()));
    }

    public function test_would_exceed_limit_is_true_at_limit(): void
    {
        $receipt = $this->makeReceipt();

        for ($i = 0; $i < ReprintPolicy::DEFAULT_MAX_REPRINTS; $i++) {
            $receipt->reprint('cashier-1', 'term-1', ReprintReason::PrinterError);
        }

        $this->assertTrue($this->policy->wouldExceedReprintLimit($receipt));
    }

    // ── maxReprints() ─────────────────────────────────────────────────────────

    public function test_default_max_reprints_when_no_template(): void
    {
        $this->assertSame(
            ReprintPolicy::DEFAULT_MAX_REPRINTS,
            $this->policy->maxReprints(null),
        );
    }

    // ── Helper ────────────────────────────────────────────────────────────────

    private function makeReceipt(): Receipt
    {
        return Receipt::issue(
            receiptNumber: 'RCP-20260701-T01-00001',
            type: ReceiptType::Sale,
            originalTransactionId: 'sale-1',
            originalTransactionNumber: 'SALE-0001',
            terminalId: 'term-1',
            sessionId: 'sess-1',
            shiftId: 'shift-1',
            cashierId: 'cashier-1',
            cashierName: 'Test Cashier',
            customerId: null,
            customerName: null,
            currency: 'EGP',
            lineItems: [
                ReceiptLineItem::of('prod-1', 'Blue Shirt', 'SKU-001', '1', '100.00', '100.00', 'EGP'),
            ],
            totals: ReceiptTotals::of('100.00', '0.00', '14.00', '114.00', '120.00', '6.00', 'EGP'),
            payments: [ReceiptPayment::of('cash', '120.00', 'EGP')],
            issuedAt: new DateTimeImmutable('2026-07-01 10:00:00', new DateTimeZone('UTC')),
        );
    }
}
