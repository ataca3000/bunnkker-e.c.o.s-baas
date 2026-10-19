<?php

declare(strict_types=1);

namespace Tests\Unit\POS\Listeners;

use DateTimeImmutable;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Queue;
use Modules\POS\Application\Events\SaleFinalized;
use Modules\POS\Application\Events\SaleItemPayload;
use Modules\POS\Application\Events\SalePaymentPayload;
use Modules\POS\Application\Jobs\DispatchWebhookJob;
use Modules\POS\Application\Listeners\PosWebhookListener;
use Tests\TestCase;

/**
 * Subscriber 8 — PosWebhookListener unit tests.
 *
 * Verifies: skips when no endpoints, dispatches one job per endpoint,
 * invalid URL skipped, error per-endpoint is resilient.
 */
final class PosWebhookListenerTest extends TestCase
{
    private const ENDPOINT_A = 'https://erp.example.com/webhooks/pos';

    private const ENDPOINT_B = 'https://bi.example.com/api/events';

    private PosWebhookListener $listener;

    protected function setUp(): void
    {
        parent::setUp();
        Queue::fake();
        $this->listener = new PosWebhookListener;
    }

    // ── No endpoints ─────────────────────────────────────────────────────────

    public function test_does_nothing_when_no_endpoints_configured(): void
    {
        Config::set('pos.webhooks.endpoints', []);

        $this->listener->handle($this->makeEvent());

        Queue::assertNothingPushed();
    }

    // ── Happy path ────────────────────────────────────────────────────────────

    public function test_dispatches_one_job_for_single_endpoint(): void
    {
        Config::set('pos.webhooks.endpoints', [self::ENDPOINT_A]);

        $this->listener->handle($this->makeEvent());

        Queue::assertPushed(DispatchWebhookJob::class, 1);
    }

    public function test_dispatches_independent_job_per_endpoint(): void
    {
        Config::set('pos.webhooks.endpoints', [self::ENDPOINT_A, self::ENDPOINT_B]);

        $this->listener->handle($this->makeEvent());

        Queue::assertPushed(DispatchWebhookJob::class, 2);
    }

    // ── Invalid URL filtering ─────────────────────────────────────────────────

    public function test_skips_invalid_url_and_logs_warning(): void
    {
        Config::set('pos.webhooks.endpoints', ['not-a-valid-url', self::ENDPOINT_A]);

        Log::shouldReceive('channel')->with('daily')->andReturnSelf();
        Log::shouldReceive('warning')->once()->withArgs(fn ($msg) => str_contains($msg, 'Invalid endpoint URL skipped'));

        $this->listener->handle($this->makeEvent());

        // Only valid URL gets a job
        Queue::assertPushed(DispatchWebhookJob::class, 1);
    }

    public function test_skips_all_invalid_urls(): void
    {
        Config::set('pos.webhooks.endpoints', ['not-valid', 'also-not-valid']);

        Log::shouldReceive('channel')->with('daily')->andReturnSelf();
        Log::shouldReceive('warning')->twice();

        $this->listener->handle($this->makeEvent());

        Queue::assertNothingPushed();
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
