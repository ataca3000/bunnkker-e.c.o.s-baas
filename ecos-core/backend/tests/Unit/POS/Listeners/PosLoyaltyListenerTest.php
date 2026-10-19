<?php

declare(strict_types=1);

namespace Tests\Unit\POS\Listeners;

use DateTimeImmutable;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Log;
use Mockery;
use Mockery\MockInterface;
use Modules\POS\Application\Events\SaleFinalized;
use Modules\POS\Application\Events\SaleItemPayload;
use Modules\POS\Application\Events\SalePaymentPayload;
use Modules\POS\Application\Listeners\PosLoyaltyListener;
use Modules\POS\Customer\Domain\Contracts\LoyaltyGatewayInterface;
use RuntimeException;
use Tests\TestCase;

/**
 * Subscriber 5 — PosLoyaltyListener unit tests.
 *
 * Verifies: config gate, anonymous-sale skip, gateway delegation, error resilience.
 */
final class PosLoyaltyListenerTest extends TestCase
{
    use Mockery\Adapter\Phpunit\MockeryPHPUnitIntegration;

    private const SALE_ID = 'sale-uuid-001';

    private const CUSTOMER_ID = 'customer-uuid-001';

    private MockInterface $loyalty;

    private PosLoyaltyListener $listener;

    protected function setUp(): void
    {
        parent::setUp();

        $this->loyalty = Mockery::mock(LoyaltyGatewayInterface::class);
        $this->listener = new PosLoyaltyListener($this->loyalty);
    }

    // ── Config gate ───────────────────────────────────────────────────────────

    public function test_skips_when_loyalty_disabled_in_config(): void
    {
        Config::set('pos.loyalty.enabled', false);

        $this->loyalty->shouldNotReceive('earnPoints');

        $this->listener->handle($this->makeEvent());
    }

    // ── Anonymous sale skip ───────────────────────────────────────────────────

    public function test_skips_when_no_customer_even_if_loyalty_enabled(): void
    {
        Config::set('pos.loyalty.enabled', true);

        $this->loyalty->shouldNotReceive('earnPoints');

        $this->listener->handle($this->makeEvent(customerId: null));
    }

    // ── Happy path ────────────────────────────────────────────────────────────

    public function test_earns_points_when_loyalty_enabled_and_customer_present(): void
    {
        Config::set('pos.loyalty.enabled', true);

        $this->loyalty
            ->shouldReceive('earnPoints')
            ->once()
            ->withArgs(function (string $customerId, $saleTotal, string $transactionRef) {
                return $customerId === self::CUSTOMER_ID
                    && $transactionRef === self::SALE_ID;
            })
            ->andReturn(10);

        Log::shouldReceive('channel')->with('daily')->andReturnSelf();
        Log::shouldReceive('info')->once()->withArgs(fn ($msg) => str_contains($msg, 'Points earned'));

        $this->listener->handle($this->makeEvent());
    }

    public function test_uses_sale_id_as_transaction_ref_for_idempotency(): void
    {
        Config::set('pos.loyalty.enabled', true);

        $capturedRef = null;
        $this->loyalty
            ->shouldReceive('earnPoints')
            ->once()
            ->withArgs(function ($cid, $total, string $ref) use (&$capturedRef) {
                $capturedRef = $ref;

                return true;
            })
            ->andReturn(5);

        Log::shouldReceive('channel')->andReturnSelf();
        Log::shouldReceive('info')->zeroOrMoreTimes();

        $this->listener->handle($this->makeEvent());

        $this->assertSame(self::SALE_ID, $capturedRef);
    }

    // ── Error resilience ──────────────────────────────────────────────────────

    public function test_logs_error_on_gateway_failure_and_does_not_rethrow(): void
    {
        Config::set('pos.loyalty.enabled', true);

        $this->loyalty
            ->shouldReceive('earnPoints')
            ->andThrow(new RuntimeException('Loyalty gateway timeout'));

        Log::shouldReceive('channel')->with('daily')->andReturnSelf();
        Log::shouldReceive('error')->once()->withArgs(fn ($msg) => str_contains($msg, 'Failed to award loyalty points'));

        $this->listener->handle($this->makeEvent());
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
            items: [new SaleItemPayload('l1', 'p1', 'Widget', 'WGT', 2.0, '75.00', '150.00', 'EGP')],
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
