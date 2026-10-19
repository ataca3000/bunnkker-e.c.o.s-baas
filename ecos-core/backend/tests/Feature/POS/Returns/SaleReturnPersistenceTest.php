<?php

declare(strict_types=1);

namespace Tests\Feature\POS\Returns;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Modules\POS\Returns\Domain\Contracts\SaleReturnRepositoryInterface;
use Modules\POS\Returns\Domain\Models\SaleReturn;
use Modules\POS\Returns\Domain\ValueObjects\ReturnLine;
use Modules\POS\Shared\Domain\Enums\PaymentMethodType;
use Modules\POS\Shared\Domain\Enums\ReturnReason;
use Modules\POS\Shared\Domain\Enums\ReturnStatus;
use Modules\POS\Shared\Domain\ValueObjects\Money;
use Modules\POS\Shared\Domain\ValueObjects\Quantity;
use Tests\TestCase;

/**
 * PKG-POS-009: SaleReturn repository persistence tests.
 *
 * Requires a running PostgreSQL database.
 * Run when database is available:
 *   php artisan test tests/Feature/POS/Returns/SaleReturnPersistenceTest.php
 */
final class SaleReturnPersistenceTest extends TestCase
{
    use RefreshDatabase;

    private SaleReturnRepositoryInterface $repository;

    private const SALE_ID = 'a1000000-0000-4000-a000-000000000001';

    private const SESSION_ID = 'c1000000-0000-4000-c000-000000000001';

    private const SHIFT_ID = 'd1000000-0000-4000-d000-000000000001';

    private const TERMINAL_ID = 'e1000000-0000-4000-e000-000000000001';

    private const CASHIER_ID = 'f1000000-0000-4000-f000-000000000001';

    private const RECEIPT_NUMBER = 'RCP-2026-PER-001';

    private const RETURN_NUMBER = 'RTN-2026-PER-001';

    private const CURRENCY = 'EGP';

    protected function setUp(): void
    {
        parent::setUp();
        $this->repository = app(SaleReturnRepositoryInterface::class);
    }

    private function makeReturnLine(string $lineId = 'line-persist-1'): ReturnLine
    {
        return ReturnLine::fromSaleLine(
            [
                'line_id' => $lineId,
                'product_id' => 'prod-1',
                'product_name' => 'Widget',
                'sku' => 'WGT-001',
                'quantity' => '2.0000',
                'unit_price' => ['amount' => '50.00', 'currency' => self::CURRENCY],
                'discount_type' => null,
                'discount_value' => null,
                'line_total' => ['amount' => '100.00', 'currency' => self::CURRENCY],
                'sort_order' => 0,
            ],
            Quantity::of('1'),
            ReturnReason::WrongItem,
        );
    }

    private function makeSaleReturn(
        string $saleId = self::SALE_ID,
        string $returnNumber = self::RETURN_NUMBER,
        string $refundTotal = '50.00',
    ): SaleReturn {
        return SaleReturn::initiate(
            saleId: $saleId,
            originalReceiptNumber: self::RECEIPT_NUMBER,
            sessionId: self::SESSION_ID,
            shiftId: self::SHIFT_ID,
            terminalId: self::TERMINAL_ID,
            cashierId: self::CASHIER_ID,
            customerId: null,
            currency: self::CURRENCY,
            returnNumber: $returnNumber,
            lines: [$this->makeReturnLine()],
            refundTotal: Money::of($refundTotal, self::CURRENCY),
            refundMethod: PaymentMethodType::Cash,
        );
    }

    // ── Basic CRUD ────────────────────────────────────────────────────────────

    public function test_save_and_find_by_id(): void
    {
        $r = $this->makeSaleReturn();
        $this->repository->save($r);

        $found = $this->repository->findById($r->id);

        $this->assertNotNull($found);
        $this->assertSame($r->id, $found->id);
        $this->assertSame(ReturnStatus::Pending, $found->status);
        $this->assertSame(self::CURRENCY, $found->currency);
    }

    public function test_find_by_id_returns_null_for_unknown(): void
    {
        $this->assertNull($this->repository->findById('00000000-0000-0000-0000-000000000000'));
    }

    public function test_find_by_return_number_returns_sale_return(): void
    {
        $r = $this->makeSaleReturn();
        $this->repository->save($r);

        $found = $this->repository->findByReturnNumber(self::RETURN_NUMBER);
        $this->assertNotNull($found);
        $this->assertSame($r->id, $found->id);
    }

    public function test_find_by_return_number_returns_null_for_unknown(): void
    {
        $this->assertNull($this->repository->findByReturnNumber('RTN-UNKNOWN'));
    }

    public function test_find_by_sale_id_returns_all_returns_for_sale(): void
    {
        $this->repository->save($this->makeSaleReturn(returnNumber: 'RTN-PER-A'));
        $this->repository->save($this->makeSaleReturn(returnNumber: 'RTN-PER-B'));

        $results = $this->repository->findBySaleId(self::SALE_ID);
        $this->assertCount(2, $results);
        $this->assertContainsOnlyInstancesOf(SaleReturn::class, $results);
    }

    public function test_find_by_sale_id_returns_empty_array_when_no_returns(): void
    {
        $results = $this->repository->findBySaleId('00000000-0000-0000-0000-000000000000');
        $this->assertSame([], $results);
    }

    // ── JSONB round-trips ─────────────────────────────────────────────────────

    public function test_lines_round_trip(): void
    {
        $r = $this->makeSaleReturn();
        $this->repository->save($r);

        $found = $this->repository->findById($r->id);
        $this->assertNotNull($found);
        $this->assertSame(1, $found->getLineCount());

        $line = $found->getLines()[0];
        $this->assertSame('Widget', $line->productName);
        $this->assertSame('1.0000', $line->quantity->value);
        $this->assertSame('50.00', $line->refundAmount->amount);
        $this->assertSame(ReturnReason::WrongItem, $line->reason);
        $this->assertTrue($line->shouldRestock);
    }

    public function test_refund_total_round_trip(): void
    {
        $r = $this->makeSaleReturn(refundTotal: '125.50');
        $this->repository->save($r);

        $found = $this->repository->findById($r->id);
        $this->assertNotNull($found);
        $this->assertSame('125.50', $found->getRefundTotal()->amount);
        $this->assertSame(self::CURRENCY, $found->getRefundTotal()->currency);
    }

    // ── Unique constraint ─────────────────────────────────────────────────────

    public function test_duplicate_return_number_is_rejected_by_database(): void
    {
        $this->repository->save($this->makeSaleReturn());

        $this->expectException(\Illuminate\Database\QueryException::class);
        $this->repository->save($this->makeSaleReturn(
            saleId: 'a2000000-0000-4000-a000-000000000002',
            returnNumber: self::RETURN_NUMBER,
        ));
    }

    // ── Status persistence ────────────────────────────────────────────────────

    public function test_processed_status_persists(): void
    {
        $r = $this->makeSaleReturn();
        $r->process();
        $this->repository->save($r);

        $found = $this->repository->findById($r->id);
        $this->assertNotNull($found);
        $this->assertSame(ReturnStatus::Processed, $found->status);
        $this->assertTrue($found->isProcessed());
        $this->assertNotNull($found->processed_at);
    }

    public function test_cancelled_status_and_reason_persist(): void
    {
        $r = $this->makeSaleReturn();
        $r->cancel('Wrong product returned');
        $this->repository->save($r);

        $found = $this->repository->findById($r->id);
        $this->assertNotNull($found);
        $this->assertSame(ReturnStatus::Cancelled, $found->status);
        $this->assertSame('Wrong product returned', $found->cancelled_reason);
        $this->assertNotNull($found->cancelled_at);
    }

    public function test_refund_method_persists(): void
    {
        $r = $this->makeSaleReturn();
        $this->repository->save($r);

        $found = $this->repository->findById($r->id);
        $this->assertNotNull($found);
        $this->assertSame(PaymentMethodType::Cash, $found->refund_method);
    }
}
