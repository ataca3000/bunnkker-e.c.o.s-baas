<?php

declare(strict_types=1);

namespace Tests\Feature\POS\Receipt;

use DateTimeImmutable;
use DateTimeZone;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Modules\POS\Receipt\Domain\Enums\ReceiptStatus;
use Modules\POS\Receipt\Domain\Enums\ReceiptType;
use Modules\POS\Receipt\Domain\Enums\ReprintReason;
use Modules\POS\Receipt\Domain\Exceptions\ReceiptNotFoundException;
use Modules\POS\Receipt\Domain\Models\Receipt;
use Modules\POS\Receipt\Domain\ValueObjects\ReceiptLineItem;
use Modules\POS\Receipt\Domain\ValueObjects\ReceiptPayment;
use Modules\POS\Receipt\Domain\ValueObjects\ReceiptTotals;
use Modules\POS\Receipt\Infrastructure\Repositories\EloquentReceiptRepository;
use Tests\TestCase;

final class ReceiptPersistenceTest extends TestCase
{
    use RefreshDatabase;

    private EloquentReceiptRepository $repo;

    protected function setUp(): void
    {
        parent::setUp();

        $this->repo = new EloquentReceiptRepository;
    }

    // ── save / findById ───────────────────────────────────────────────────────

    public function test_saves_and_retrieves_by_id(): void
    {
        $receipt = $this->makeReceipt('RCP-PERSIST-001');
        $this->repo->save($receipt);

        $found = $this->repo->findById((string) $receipt->id);

        $this->assertSame((string) $receipt->id, (string) $found->id);
        $this->assertSame('RCP-PERSIST-001', $found->receipt_number);
    }

    public function test_find_by_id_throws_for_unknown(): void
    {
        $this->expectException(ReceiptNotFoundException::class);

        $this->repo->findById('00000000-0000-0000-0000-000000000000');
    }

    // ── findByNumber ──────────────────────────────────────────────────────────

    public function test_find_by_number_retrieves_correct_receipt(): void
    {
        $receipt = $this->makeReceipt('RCP-NUMBER-001');
        $this->repo->save($receipt);

        $found = $this->repo->findByNumber('RCP-NUMBER-001');

        $this->assertSame('RCP-NUMBER-001', $found->receipt_number);
    }

    public function test_find_by_number_throws_for_unknown(): void
    {
        $this->expectException(ReceiptNotFoundException::class);

        $this->repo->findByNumber('RCP-DOES-NOT-EXIST');
    }

    // ── findByTransactionId ───────────────────────────────────────────────────

    public function test_find_by_transaction_id_returns_all_receipts(): void
    {
        $this->repo->save($this->makeReceipt('RCP-TXN-001', saleId: 'sale-99'));
        $this->repo->save($this->makeReceipt('RCP-TXN-002', saleId: 'sale-99'));
        $this->repo->save($this->makeReceipt('RCP-TXN-003', saleId: 'sale-other'));

        $results = $this->repo->findByTransactionId('sale-99');

        $this->assertCount(2, $results);
    }

    public function test_find_by_transaction_id_returns_empty_when_none(): void
    {
        $this->assertEmpty($this->repo->findByTransactionId('sale-nonexistent'));
    }

    // ── JSONB round-trips ─────────────────────────────────────────────────────

    public function test_line_items_persist_and_reload_correctly(): void
    {
        $receipt = $this->makeReceipt('RCP-JSON-001');
        $this->repo->save($receipt);

        $found = $this->repo->findById((string) $receipt->id);
        $lines = $found->getLineItems();

        $this->assertCount(1, $lines);
        $this->assertSame('prod-1', $lines[0]['product_id']);
        $this->assertSame('Blue Shirt', $lines[0]['product_name']);
        $this->assertSame('100.00', $lines[0]['unit_price_amount']);
        $this->assertSame('EGP', $lines[0]['currency']);
    }

    public function test_totals_persist_and_reload_correctly(): void
    {
        $receipt = $this->makeReceipt('RCP-TOT-001');
        $this->repo->save($receipt);

        $found = $this->repo->findById((string) $receipt->id);
        $totals = $found->getTotals();

        $this->assertSame('114.00', $totals->totalAmount);
        $this->assertSame('120.00', $totals->tenderedAmount);
        $this->assertSame('6.00', $totals->changeAmount);
        $this->assertSame('EGP', $totals->currency);
    }

    public function test_payments_persist_and_reload_correctly(): void
    {
        $receipt = $this->makeReceipt('RCP-PAY-001');
        $this->repo->save($receipt);

        $found = $this->repo->findById((string) $receipt->id);
        $payments = $found->getPayments();

        $this->assertCount(1, $payments);
        $this->assertSame('cash', $payments[0]['payment_method']);
        $this->assertSame('120.00', $payments[0]['amount']);
    }

    // ── status / reprint persistence ──────────────────────────────────────────

    public function test_reprint_count_and_records_persist(): void
    {
        $receipt = $this->makeReceipt('RCP-RPT-001');
        $receipt->reprint('cashier-1', 'term-1', ReprintReason::CustomerRequest);
        $this->repo->save($receipt);

        $found = $this->repo->findById((string) $receipt->id);

        $this->assertSame(1, $found->reprint_count);
        $this->assertCount(1, $found->getReprintRecords());
        $this->assertSame('customer_request', $found->getReprintRecords()[0]->reason);
    }

    public function test_voided_status_persists(): void
    {
        $receipt = $this->makeReceipt('RCP-VOID-001');
        $receipt->void('cashier-1', 'Printed in error');
        $this->repo->save($receipt);

        $found = $this->repo->findById((string) $receipt->id);

        $this->assertSame(ReceiptStatus::Voided, $found->getStatus());
        $this->assertSame('cashier-1', $found->voided_by);
        $this->assertSame('Printed in error', $found->void_reason);
        $this->assertNotNull($found->voided_at);
    }

    // ── type and issued_at ────────────────────────────────────────────────────

    public function test_receipt_type_persists(): void
    {
        $receipt = $this->makeReceipt('RCP-TYPE-001', type: ReceiptType::Return);
        $this->repo->save($receipt);

        $found = $this->repo->findById((string) $receipt->id);

        $this->assertSame(ReceiptType::Return, $found->type);
    }

    public function test_issued_at_persists(): void
    {
        $issuedAt = new DateTimeImmutable('2026-07-01 10:00:00', new DateTimeZone('UTC'));
        $receipt = $this->makeReceipt('RCP-TIME-001', issuedAt: $issuedAt);
        $this->repo->save($receipt);

        $found = $this->repo->findById((string) $receipt->id);

        $this->assertSame('2026-07-01', $found->issued_at->format('Y-m-d'));
    }

    // ── Helper ────────────────────────────────────────────────────────────────

    private function makeReceipt(
        string $receiptNumber = 'RCP-001',
        string $saleId = 'sale-001',
        ReceiptType $type = ReceiptType::Sale,
        ?DateTimeImmutable $issuedAt = null,
    ): Receipt {
        return Receipt::issue(
            receiptNumber: $receiptNumber,
            type: $type,
            originalTransactionId: $saleId,
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
            issuedAt: $issuedAt ?? new DateTimeImmutable('2026-07-01 10:00:00', new DateTimeZone('UTC')),
        );
    }
}
