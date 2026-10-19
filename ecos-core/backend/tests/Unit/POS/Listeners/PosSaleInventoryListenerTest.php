<?php

declare(strict_types=1);

namespace Tests\Unit\POS\Listeners;

use DateTimeImmutable;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Log;
use Mockery;
use Mockery\MockInterface;
use Modules\Inventory\InventoryItems\Application\DTO\StockOperationDTO;
use Modules\Inventory\InventoryItems\Domain\Exceptions\InsufficientStockException;
use Modules\POS\Application\Contracts\StockIssuePortInterface;
use Modules\POS\Application\Events\SaleFinalized;
use Modules\POS\Application\Events\SaleItemPayload;
use Modules\POS\Application\Events\SalePaymentPayload;
use Modules\POS\Application\Listeners\PosSaleInventoryListener;
use RuntimeException;
use Tests\TestCase;

/**
 * CRIT-003 — PosSaleInventoryListener unit tests.
 *
 * Updated to SaleFinalized: listener no longer reloads Sale/Terminal/Warehouse
 * from DB — all context comes from the event (zero N+1 queries).
 */
final class PosSaleInventoryListenerTest extends TestCase
{
    use Mockery\Adapter\Phpunit\MockeryPHPUnitIntegration;

    private const SALE_ID = 'sale-uuid-001';

    private const RECEIPT_NUMBER = 'RCP-2026-000001';

    private const TERMINAL_ID = 'terminal-uuid-001';

    private const WAREHOUSE_ID = 'warehouse-uuid-001';

    private const COMPANY_ID = 'company-uuid-001';

    private const PRODUCT_A = 'product-uuid-aaa';

    private const PRODUCT_B = 'product-uuid-bbb';

    private MockInterface $stockIssue;

    private PosSaleInventoryListener $listener;

    protected function setUp(): void
    {
        parent::setUp();

        $this->stockIssue = Mockery::mock(StockIssuePortInterface::class);
        $this->listener = new PosSaleInventoryListener($this->stockIssue);
    }

    // ── Happy path ────────────────────────────────────────────────────────────

    public function test_decrements_stock_for_single_line_item(): void
    {
        $event = $this->makeEvent(items: [
            $this->item(self::PRODUCT_A, 2.0),
        ]);

        $this->stockIssue
            ->shouldReceive('issue')
            ->once()
            ->withArgs(function (StockOperationDTO $dto) {
                return $dto->product_id === self::PRODUCT_A
                    && $dto->warehouse_id === self::WAREHOUSE_ID
                    && $dto->company_id === self::COMPANY_ID
                    && $dto->quantity === 2.0
                    && $dto->reference_type === 'pos_sale'
                    && $dto->reference_id === self::SALE_ID;
            });

        $this->listener->handle($event);
    }

    public function test_decrements_stock_once_per_line_for_multi_item_sale(): void
    {
        $event = $this->makeEvent(items: [
            $this->item(self::PRODUCT_A, 3.0),
            $this->item(self::PRODUCT_B, 1.0),
        ]);

        $this->stockIssue->shouldReceive('issue')->twice();

        $this->listener->handle($event);
    }

    public function test_passes_correct_product_and_quantity_per_line(): void
    {
        $event = $this->makeEvent(items: [
            $this->item(self::PRODUCT_A, 5.0),
            $this->item(self::PRODUCT_B, 2.5),
        ]);

        $issuedProducts = [];
        $this->stockIssue
            ->shouldReceive('issue')
            ->twice()
            ->withArgs(function (StockOperationDTO $dto) use (&$issuedProducts) {
                $issuedProducts[] = [$dto->product_id, $dto->quantity];

                return true;
            });

        $this->listener->handle($event);

        $this->assertContains([self::PRODUCT_A, 5.0], $issuedProducts);
        $this->assertContains([self::PRODUCT_B, 2.5], $issuedProducts);
    }

    // ── Insufficient stock ────────────────────────────────────────────────────

    public function test_logs_error_on_insufficient_stock_when_negative_not_allowed(): void
    {
        Config::set('pos.inventory.allow_negative_stock', false);

        $event = $this->makeEvent(items: [$this->item(self::PRODUCT_A, 99.0)]);

        $this->stockIssue
            ->shouldReceive('issue')
            ->andThrow(new InsufficientStockException(self::PRODUCT_A, self::WAREHOUSE_ID, 99.0, 10.0));

        Log::shouldReceive('channel')->with('daily')->andReturnSelf();
        Log::shouldReceive('error')->once()->withArgs(fn ($msg) => str_contains($msg, 'Insufficient stock'));

        $this->listener->handle($event);
    }

    public function test_logs_warning_on_insufficient_stock_when_negative_allowed(): void
    {
        Config::set('pos.inventory.allow_negative_stock', true);

        $event = $this->makeEvent(items: [$this->item(self::PRODUCT_A, 5.0)]);

        $this->stockIssue
            ->shouldReceive('issue')
            ->andThrow(new InsufficientStockException(self::PRODUCT_A, self::WAREHOUSE_ID, 5.0, 3.0));

        Log::shouldReceive('channel')->with('daily')->andReturnSelf();
        Log::shouldReceive('warning')->once()->withArgs(fn ($msg) => str_contains($msg, 'Insufficient stock'));

        $this->listener->handle($event);
    }

    // ── Unexpected exceptions ─────────────────────────────────────────────────

    public function test_logs_error_on_unexpected_exception_and_does_not_rethrow(): void
    {
        $event = $this->makeEvent(items: [$this->item(self::PRODUCT_A, 1.0)]);

        $this->stockIssue
            ->shouldReceive('issue')
            ->andThrow(new RuntimeException('Database connection lost'));

        Log::shouldReceive('channel')->with('daily')->andReturnSelf();
        Log::shouldReceive('error')->once()->withArgs(fn ($msg) => str_contains($msg, 'Unexpected error'));

        $this->listener->handle($event);
    }

    public function test_processes_remaining_lines_when_one_fails(): void
    {
        $event = $this->makeEvent(items: [
            $this->item(self::PRODUCT_A, 1.0),
            $this->item(self::PRODUCT_B, 2.0),
        ]);

        $this->stockIssue
            ->shouldReceive('issue')
            ->times(2)
            ->andReturnUsing(function (StockOperationDTO $dto) {
                if ($dto->product_id === self::PRODUCT_A) {
                    throw new InsufficientStockException(self::PRODUCT_A, self::WAREHOUSE_ID, 1.0, 0.0);
                }
            });

        Log::shouldReceive('channel')->andReturnSelf();
        Log::shouldReceive('error')->zeroOrMoreTimes();
        Log::shouldReceive('warning')->zeroOrMoreTimes();

        $this->listener->handle($event);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /** @param SaleItemPayload[] $items */
    private function makeEvent(array $items = []): SaleFinalized
    {
        if (empty($items)) {
            $items = [$this->item(self::PRODUCT_A, 1.0)];
        }

        return new SaleFinalized(
            eventId: 'event-uuid-001',
            occurredAt: new DateTimeImmutable('now'),
            saleId: self::SALE_ID,
            receiptNumber: self::RECEIPT_NUMBER,
            companyId: self::COMPANY_ID,
            channelId: null,
            warehouseId: self::WAREHOUSE_ID,
            sessionId: 'session-uuid-001',
            shiftId: 'shift-uuid-001',
            terminalId: self::TERMINAL_ID,
            cashierId: 'cashier-uuid-001',
            customerId: 'customer-uuid-001',
            items: $items,
            payments: [new SalePaymentPayload('cash', '100.00', 'EGP', null)],
            subtotal: '100.00',
            discountTotal: '0.00',
            grandTotal: '100.00',
            amountPaid: '100.00',
            changeGiven: '0.00',
            currency: 'EGP',
        );
    }

    private function item(string $productId, float $qty): SaleItemPayload
    {
        return new SaleItemPayload(
            lineId: 'line-'.$productId,
            productId: $productId,
            productName: 'Product '.$productId,
            sku: 'SKU-'.$productId,
            quantity: $qty,
            unitPrice: '50.00',
            lineTotal: (string) ($qty * 50),
            currency: 'EGP',
        );
    }
}
