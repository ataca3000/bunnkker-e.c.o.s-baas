<?php

declare(strict_types=1);

namespace Tests\Feature\POS\Sale;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Modules\POS\Sale\Domain\Contracts\SaleRepositoryInterface;
use Modules\POS\Sale\Domain\Models\Sale;
use Modules\POS\Sale\Domain\ValueObjects\PaymentSummaryLine;
use Modules\POS\Sale\Domain\ValueObjects\SaleLine;
use Modules\POS\Shared\Domain\Enums\SaleStatus;
use Modules\POS\Shared\Domain\ValueObjects\Money;
use Tests\TestCase;

/**
 * PKG-POS-008: Sale repository persistence tests.
 *
 * Requires a running PostgreSQL database.
 * Run when database is available:
 *   php artisan test tests/Feature/POS/Sale/SalePersistenceTest.php
 */
final class SalePersistenceTest extends TestCase
{
    use RefreshDatabase;

    private SaleRepositoryInterface $repository;

    private const CART_ID = 'a1000000-0000-4000-a000-000000000001';

    private const PAYMENT_ID = 'b1000000-0000-4000-b000-000000000001';

    private const SESSION_ID = 'c1000000-0000-4000-c000-000000000001';

    private const SHIFT_ID = 'd1000000-0000-4000-d000-000000000001';

    private const TERMINAL_ID = 'e1000000-0000-4000-e000-000000000001';

    private const CASHIER_ID = 'f1000000-0000-4000-f000-000000000001';

    private const RECEIPT_NUMBER = 'RCP-2026-PER-001';

    private const CURRENCY = 'EGP';

    protected function setUp(): void
    {
        parent::setUp();
        $this->repository = app(SaleRepositoryInterface::class);
    }

    private function makeSaleLine(string $lineId = 'line-persist-1'): SaleLine
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

    private function makePaymentSummary(): PaymentSummaryLine
    {
        return PaymentSummaryLine::fromTender([
            'id' => 'tender-1',
            'type' => 'cash',
            'amount' => ['amount' => '100.00', 'currency' => self::CURRENCY],
            'reference' => null,
            'metadata' => [],
        ]);
    }

    private function makeSale(
        string $cartId = self::CART_ID,
        string $paymentId = self::PAYMENT_ID,
        string $receiptNum = self::RECEIPT_NUMBER,
        string $total = '100.00',
    ): Sale {
        return Sale::record(
            cartId: $cartId,
            paymentId: $paymentId,
            sessionId: self::SESSION_ID,
            shiftId: self::SHIFT_ID,
            terminalId: self::TERMINAL_ID,
            cashierId: self::CASHIER_ID,
            customerId: null,
            currency: self::CURRENCY,
            receiptNumber: $receiptNum,
            lines: [$this->makeSaleLine()],
            subtotal: Money::of($total, self::CURRENCY),
            discountTotal: Money::zero(self::CURRENCY),
            total: Money::of($total, self::CURRENCY),
            amountPaid: Money::of($total, self::CURRENCY),
            changeGiven: Money::zero(self::CURRENCY),
            paymentSummaries: [$this->makePaymentSummary()],
        );
    }

    // ── Basic CRUD ────────────────────────────────────────────────────────────

    public function test_save_and_find_by_id(): void
    {
        $sale = $this->makeSale();
        $this->repository->save($sale);

        $found = $this->repository->findById($sale->id);

        $this->assertNotNull($found);
        $this->assertSame($sale->id, $found->id);
        $this->assertSame(SaleStatus::Pending, $found->status);
        $this->assertSame(self::CURRENCY, $found->currency);
    }

    public function test_find_by_id_returns_null_for_unknown(): void
    {
        $this->assertNull($this->repository->findById('00000000-0000-0000-0000-000000000000'));
    }

    public function test_find_by_cart_id_returns_sale(): void
    {
        $sale = $this->makeSale();
        $this->repository->save($sale);

        $found = $this->repository->findByCartId(self::CART_ID);

        $this->assertNotNull($found);
        $this->assertSame($sale->id, $found->id);
    }

    public function test_find_by_cart_id_returns_null_for_unknown(): void
    {
        $this->assertNull($this->repository->findByCartId('00000000-0000-0000-0000-000000000000'));
    }

    public function test_find_by_receipt_number_returns_sale(): void
    {
        $sale = $this->makeSale();
        $this->repository->save($sale);

        $found = $this->repository->findByReceiptNumber(self::RECEIPT_NUMBER);

        $this->assertNotNull($found);
        $this->assertSame($sale->id, $found->id);
    }

    public function test_find_by_receipt_number_returns_null_for_unknown(): void
    {
        $this->assertNull($this->repository->findByReceiptNumber('RCP-UNKNOWN'));
    }

    // ── JSONB round-trips ─────────────────────────────────────────────────────

    public function test_lines_round_trip(): void
    {
        $sale = $this->makeSale(total: '100.00');
        $this->repository->save($sale);

        $found = $this->repository->findById($sale->id);

        $this->assertNotNull($found);
        $this->assertSame(1, $found->getLineCount());
        $line = $found->getLines()[0];
        $this->assertSame('Widget', $line->productName);
        $this->assertSame('2.0000', $line->quantity->value);
        $this->assertSame('100.00', $line->lineTotal->amount);
    }

    public function test_payment_summaries_round_trip(): void
    {
        $sale = $this->makeSale();
        $this->repository->save($sale);

        $found = $this->repository->findById($sale->id);

        $this->assertNotNull($found);
        $summaries = $found->getPaymentSummaries();
        $this->assertCount(1, $summaries);
        $this->assertSame('100.00', $summaries[0]->amount->amount);
    }

    public function test_totals_round_trip(): void
    {
        $sale = $this->makeSale(total: '175.50');
        $this->repository->save($sale);

        $found = $this->repository->findById($sale->id);

        $this->assertNotNull($found);
        $this->assertSame('175.50', $found->getTotal()->amount);
        $this->assertSame('0.00', $found->getDiscountTotal()->amount);
    }

    // ── Unique constraints ────────────────────────────────────────────────────

    public function test_duplicate_cart_id_is_rejected_by_database(): void
    {
        $this->repository->save($this->makeSale());

        $this->expectException(\Illuminate\Database\QueryException::class);
        $this->repository->save($this->makeSale(
            cartId: self::CART_ID,
            paymentId: 'b2000000-0000-4000-b000-000000000002',
            receiptNum: 'RCP-DIFF-002',
        ));
    }

    public function test_duplicate_payment_id_is_rejected_by_database(): void
    {
        $this->repository->save($this->makeSale());

        $this->expectException(\Illuminate\Database\QueryException::class);
        $this->repository->save($this->makeSale(
            cartId: 'a2000000-0000-4000-a000-000000000002',
            paymentId: self::PAYMENT_ID,
            receiptNum: 'RCP-DIFF-003',
        ));
    }

    public function test_duplicate_receipt_number_is_rejected_by_database(): void
    {
        $this->repository->save($this->makeSale());

        $this->expectException(\Illuminate\Database\QueryException::class);
        $this->repository->save($this->makeSale(
            cartId: 'a3000000-0000-4000-a000-000000000003',
            paymentId: 'b3000000-0000-4000-b000-000000000003',
            receiptNum: self::RECEIPT_NUMBER,
        ));
    }

    // ── Status persistence ────────────────────────────────────────────────────

    public function test_completed_status_persists(): void
    {
        $sale = $this->makeSale();
        $sale->complete();
        $this->repository->save($sale);

        $found = $this->repository->findById($sale->id);

        $this->assertNotNull($found);
        $this->assertSame(SaleStatus::Completed, $found->status);
        $this->assertTrue($found->isCompleted());
        $this->assertNotNull($found->completed_at);
    }

    public function test_voided_status_and_reason_persist(): void
    {
        $sale = $this->makeSale();
        $sale->void('Scanned wrong item');
        $this->repository->save($sale);

        $found = $this->repository->findById($sale->id);

        $this->assertNotNull($found);
        $this->assertSame(SaleStatus::Voided, $found->status);
        $this->assertSame('Scanned wrong item', $found->voided_reason);
        $this->assertNotNull($found->voided_at);
    }
}
