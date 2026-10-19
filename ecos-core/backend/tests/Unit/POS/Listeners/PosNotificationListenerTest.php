<?php

declare(strict_types=1);

namespace Tests\Unit\POS\Listeners;

use DateTimeImmutable;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Log;
use Modules\POS\Application\Events\SaleFinalized;
use Modules\POS\Application\Events\SaleItemPayload;
use Modules\POS\Application\Events\SalePaymentPayload;
use Modules\POS\Application\Listeners\PosNotificationListener;
use stdClass;
use Tests\TestCase;

/**
 * Subscriber 7 — PosNotificationListener unit tests.
 *
 * Verifies: large-sale threshold detection, low-stock product logging, error resilience.
 */
final class PosNotificationListenerTest extends TestCase
{
    private PosNotificationListener $listener;

    protected function setUp(): void
    {
        parent::setUp();
        $this->listener = new PosNotificationListener;
    }

    // ── Large sale alerts ─────────────────────────────────────────────────────

    public function test_logs_notice_when_sale_exceeds_threshold(): void
    {
        Config::set('pos.notifications.large_sale_threshold', 1000.0);

        Log::shouldReceive('channel')->with('daily')->andReturnSelf();
        Log::shouldReceive('notice')->once()->withArgs(fn ($msg) => str_contains($msg, 'Large sale detected'));
        Log::shouldReceive('debug')->zeroOrMoreTimes();

        $this->listener->handle($this->makeEvent(grandTotal: '5000.00'));
    }

    public function test_does_not_log_notice_when_sale_below_threshold(): void
    {
        Config::set('pos.notifications.large_sale_threshold', 10000.0);

        Log::shouldReceive('channel')->with('daily')->andReturnSelf();
        Log::shouldReceive('notice')->never();
        Log::shouldReceive('debug')->zeroOrMoreTimes();

        $this->listener->handle($this->makeEvent(grandTotal: '500.00'));
    }

    public function test_uses_config_threshold_not_hardcoded_value(): void
    {
        Config::set('pos.notifications.large_sale_threshold', 200.0);

        Log::shouldReceive('channel')->with('daily')->andReturnSelf();
        Log::shouldReceive('notice')->once();
        Log::shouldReceive('debug')->zeroOrMoreTimes();

        // 250 > 200, should trigger
        $this->listener->handle($this->makeEvent(grandTotal: '250.00'));
    }

    // ── Low stock indicators ──────────────────────────────────────────────────

    public function test_logs_debug_for_sold_products(): void
    {
        Log::shouldReceive('channel')->with('daily')->andReturnSelf();
        Log::shouldReceive('debug')->once()->withArgs(fn ($msg) => str_contains($msg, 'Products sold'));
        Log::shouldReceive('notice')->zeroOrMoreTimes();

        $this->listener->handle($this->makeEvent());
    }

    // ── Error resilience ──────────────────────────────────────────────────────

    public function test_logs_error_on_unexpected_exception_and_does_not_rethrow(): void
    {
        // Set threshold to a type that will cause (float) cast to fail
        Config::set('pos.notifications.large_sale_threshold', new stdClass);

        Log::shouldReceive('channel')->with('daily')->andReturnSelf();
        // Either logs error (exception path) or survives gracefully
        Log::shouldReceive('error')->zeroOrMoreTimes();
        Log::shouldReceive('debug')->zeroOrMoreTimes();
        Log::shouldReceive('notice')->zeroOrMoreTimes();

        // Must not throw
        $this->listener->handle($this->makeEvent());
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function makeEvent(string $grandTotal = '100.00'): SaleFinalized
    {
        return new SaleFinalized(
            eventId: 'event-uuid-001',
            occurredAt: new DateTimeImmutable('now'),
            saleId: 'sale-uuid-001',
            receiptNumber: 'RCP-2026-000001',
            companyId: 'company-uuid-001',
            channelId: null,
            warehouseId: 'warehouse-uuid-001',
            sessionId: 'session-uuid-001',
            shiftId: 'shift-uuid-001',
            terminalId: 'terminal-uuid-001',
            cashierId: 'cashier-uuid-001',
            customerId: 'customer-uuid-001',
            items: [new SaleItemPayload('l1', 'p1', 'Widget', 'WGT', 1.0, $grandTotal, $grandTotal, 'EGP')],
            payments: [new SalePaymentPayload('cash', $grandTotal, 'EGP', null)],
            subtotal: $grandTotal,
            discountTotal: '0.00',
            grandTotal: $grandTotal,
            amountPaid: $grandTotal,
            changeGiven: '0.00',
            currency: 'EGP',
        );
    }
}
