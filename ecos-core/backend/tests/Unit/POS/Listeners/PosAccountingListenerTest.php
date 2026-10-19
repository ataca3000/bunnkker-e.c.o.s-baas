<?php

declare(strict_types=1);

namespace Tests\Unit\POS\Listeners;

use DateTimeImmutable;
use Illuminate\Support\Facades\Log;
use Mockery;
use Mockery\MockInterface;
use Modules\POS\Application\Contracts\AccountingPortInterface;
use Modules\POS\Application\Events\SaleFinalized;
use Modules\POS\Application\Events\SaleItemPayload;
use Modules\POS\Application\Events\SalePaymentPayload;
use Modules\POS\Application\Listeners\PosAccountingListener;
use RuntimeException;
use Tests\TestCase;

/**
 * Subscriber 3 — PosAccountingListener unit tests.
 */
final class PosAccountingListenerTest extends TestCase
{
    use Mockery\Adapter\Phpunit\MockeryPHPUnitIntegration;

    private MockInterface $accounting;

    private PosAccountingListener $listener;

    protected function setUp(): void
    {
        parent::setUp();

        $this->accounting = Mockery::mock(AccountingPortInterface::class);
        $this->listener = new PosAccountingListener($this->accounting);
    }

    public function test_delegates_to_accounting_port(): void
    {
        $event = $this->makeEvent();

        $this->accounting
            ->shouldReceive('recordSale')
            ->once()
            ->with($event);

        $this->listener->handle($event);
    }

    public function test_passes_exact_event_to_adapter(): void
    {
        $event = $this->makeEvent();
        $received = null;

        $this->accounting
            ->shouldReceive('recordSale')
            ->once()
            ->withArgs(function (SaleFinalized $e) use (&$received) {
                $received = $e;

                return true;
            });

        $this->listener->handle($event);

        $this->assertSame($event, $received);
    }

    public function test_logs_error_on_accounting_failure_and_does_not_rethrow(): void
    {
        $event = $this->makeEvent();

        $this->accounting
            ->shouldReceive('recordSale')
            ->andThrow(new RuntimeException('Accounting service unavailable'));

        Log::shouldReceive('channel')->with('daily')->andReturnSelf();
        Log::shouldReceive('error')->once()->withArgs(fn ($msg) => str_contains($msg, 'Failed to record sale in accounting system'));

        $this->listener->handle($event);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function makeEvent(): SaleFinalized
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
            items: [new SaleItemPayload('l1', 'p1', 'Widget', 'WGT', 1.0, '100.00', '100.00', 'EGP')],
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
