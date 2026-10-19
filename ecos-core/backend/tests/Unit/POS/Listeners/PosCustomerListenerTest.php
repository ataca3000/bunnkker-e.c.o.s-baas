<?php

declare(strict_types=1);

namespace Tests\Unit\POS\Listeners;

use DateTimeImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Modules\POS\Application\Events\SaleFinalized;
use Modules\POS\Application\Events\SaleItemPayload;
use Modules\POS\Application\Events\SalePaymentPayload;
use Modules\POS\Application\Listeners\PosCustomerListener;
use RuntimeException;
use Tests\TestCase;

/**
 * Subscriber 4 — PosCustomerListener unit tests.
 *
 * Verifies: skip-on-anonymous, idempotent upsert dispatch, error resilience.
 */
final class PosCustomerListenerTest extends TestCase
{
    private const SALE_ID = 'sale-uuid-001';

    private const CUSTOMER_ID = 'customer-uuid-001';

    private PosCustomerListener $listener;

    protected function setUp(): void
    {
        parent::setUp();
        $this->listener = new PosCustomerListener;
    }

    // ── Skip on anonymous ─────────────────────────────────────────────────────

    public function test_skips_when_no_customer_on_sale(): void
    {
        DB::shouldReceive('statement')->never();

        $event = $this->makeEvent(customerId: null);
        $this->listener->handle($event);
    }

    // ── Happy path ────────────────────────────────────────────────────────────

    public function test_executes_upsert_for_known_customer(): void
    {
        $event = $this->makeEvent();

        DB::shouldReceive('statement')
            ->once()
            ->withArgs(function (string $sql, array $bindings) {
                return str_contains($sql, 'pos_customer_stats')
                    && str_contains($sql, 'ON CONFLICT')
                    && $bindings['customer_id'] === self::CUSTOMER_ID
                    && $bindings['sale_id'] === self::SALE_ID
                    && $bindings['amount'] === '150.00';
            });

        Log::shouldReceive('channel')->with('daily')->andReturnSelf();
        Log::shouldReceive('info')->once()->withArgs(fn ($msg) => str_contains($msg, 'Statistics updated'));

        $this->listener->handle($event);
    }

    public function test_upsert_sql_contains_idempotency_guard(): void
    {
        $event = $this->makeEvent();

        $capturedSql = '';
        DB::shouldReceive('statement')
            ->once()
            ->withArgs(function (string $sql) use (&$capturedSql) {
                $capturedSql = $sql;

                return true;
            });

        Log::shouldReceive('channel')->andReturnSelf();
        Log::shouldReceive('info')->zeroOrMoreTimes();

        $this->listener->handle($event);

        $this->assertStringContainsString('IS DISTINCT FROM', $capturedSql);
        $this->assertStringContainsString('last_pos_sale_id', $capturedSql);
    }

    // ── Error resilience ──────────────────────────────────────────────────────

    public function test_logs_error_on_db_failure_and_does_not_rethrow(): void
    {
        $event = $this->makeEvent();

        DB::shouldReceive('statement')->andThrow(new RuntimeException('Connection lost'));

        Log::shouldReceive('channel')->with('daily')->andReturnSelf();
        Log::shouldReceive('error')->once()->withArgs(fn ($msg) => str_contains($msg, 'Failed to update customer statistics'));

        $this->listener->handle($event);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function makeEvent(?string $customerId = self::CUSTOMER_ID): SaleFinalized
    {
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
            customerId: $customerId,
            items: [new SaleItemPayload('l1', 'p1', 'Widget', 'WGT', 3.0, '50.00', '150.00', 'EGP')],
            payments: [new SalePaymentPayload('cash', '150.00', 'EGP', null)],
            subtotal: '150.00',
            discountTotal: '0.00',
            grandTotal: '150.00',
            amountPaid: '150.00',
            changeGiven: '0.00',
            currency: 'EGP',
        );
    }
}
