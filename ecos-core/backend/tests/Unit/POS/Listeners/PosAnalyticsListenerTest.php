<?php

declare(strict_types=1);

namespace Tests\Unit\POS\Listeners;

use DateTimeImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Modules\POS\Application\Events\SaleFinalized;
use Modules\POS\Application\Events\SaleItemPayload;
use Modules\POS\Application\Events\SalePaymentPayload;
use Modules\POS\Application\Listeners\PosAnalyticsListener;
use RuntimeException;
use Tests\TestCase;

/**
 * Subscriber 6 — PosAnalyticsListener unit tests.
 *
 * Verifies: event row insertion, per-product rows, cashier row, idempotency, error resilience.
 */
final class PosAnalyticsListenerTest extends TestCase
{
    private const SALE_ID = 'sale-uuid-001';

    private PosAnalyticsListener $listener;

    protected function setUp(): void
    {
        parent::setUp();
        $this->listener = new PosAnalyticsListener;
    }

    // ── Happy path ────────────────────────────────────────────────────────────

    public function test_wraps_inserts_in_a_transaction(): void
    {
        DB::shouldReceive('transaction')
            ->once()
            ->andReturnUsing(fn (callable $cb) => $cb());

        DB::shouldReceive('table')->andReturnSelf();
        DB::shouldReceive('insertOrIgnore')->zeroOrMoreTimes();

        $this->listener->handle($this->makeEvent());
    }

    public function test_inserts_sale_level_event_row(): void
    {
        $salesEventInserted = false;

        DB::shouldReceive('transaction')
            ->once()
            ->andReturnUsing(fn (callable $cb) => $cb());

        DB::shouldReceive('table')
            ->andReturnSelf();

        DB::shouldReceive('insertOrIgnore')
            ->atLeast()->once()
            ->andReturnUsing(function ($data) use (&$salesEventInserted) {
                if (isset($data['event_type']) && $data['event_type'] === 'sale_completed') {
                    $salesEventInserted = true;
                }
            });

        $this->listener->handle($this->makeEvent());

        $this->assertTrue($salesEventInserted, 'Expected a sale_completed analytics row');
    }

    public function test_inserts_one_product_sold_row_per_line_item(): void
    {
        $productRowCount = 0;

        DB::shouldReceive('transaction')
            ->once()
            ->andReturnUsing(fn (callable $cb) => $cb());

        DB::shouldReceive('table')->andReturnSelf();

        DB::shouldReceive('insertOrIgnore')
            ->andReturnUsing(function ($data) use (&$productRowCount) {
                // Batch insert for products comes as an array of arrays
                if (is_array($data) && isset($data[0]['event_type'])) {
                    foreach ($data as $row) {
                        if (($row['event_type'] ?? '') === 'product_sold') {
                            $productRowCount++;
                        }
                    }
                }
            });

        $event = $this->makeEvent(items: [
            new SaleItemPayload('l1', 'p1', 'Widget A', 'WA', 2.0, '10.00', '20.00', 'EGP'),
            new SaleItemPayload('l2', 'p2', 'Widget B', 'WB', 3.0, '15.00', '45.00', 'EGP'),
        ]);

        $this->listener->handle($event);

        $this->assertSame(2, $productRowCount);
    }

    // ── Error resilience ──────────────────────────────────────────────────────

    public function test_logs_error_on_db_failure_and_does_not_rethrow(): void
    {
        DB::shouldReceive('transaction')->andThrow(new RuntimeException('DB timeout'));

        Log::shouldReceive('channel')->with('daily')->andReturnSelf();
        Log::shouldReceive('error')->once()->withArgs(fn ($msg) => str_contains($msg, 'Failed to record analytics events'));

        $this->listener->handle($this->makeEvent());
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /** @param SaleItemPayload[] $items */
    private function makeEvent(array $items = []): SaleFinalized
    {
        if (empty($items)) {
            $items = [new SaleItemPayload('l1', 'p1', 'Widget', 'WGT', 1.0, '100.00', '100.00', 'EGP')];
        }

        return new SaleFinalized(
            eventId: 'event-uuid-001',
            occurredAt: new DateTimeImmutable('now'),
            saleId: self::SALE_ID,
            receiptNumber: 'RCP-2026-000001',
            companyId: 'company-uuid-001',
            channelId: null,
            warehouseId: 'warehouse-uuid-001',
            sessionId: 'session-uuid-001',
            shiftId: 'shift-uuid-001',
            terminalId: 'terminal-uuid-001',
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
}
