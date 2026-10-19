<?php

declare(strict_types=1);

namespace Tests\Unit\POS\Listeners;

use App\Core\Responses\OperationResult;
use DateTimeImmutable;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Log;
use Mockery;
use Mockery\MockInterface;
use Modules\Admin\Configuration\Domain\Services\ConfigurationManager;
use Modules\Commerce\Orders\Application\DTO\OrderDTO;
use Modules\Commerce\Orders\Domain\Enums\OrderStatus;
use Modules\Commerce\Orders\Domain\Models\Order;
use Modules\POS\Application\Contracts\OrderCreationPortInterface;
use Modules\POS\Application\Events\SaleFinalized;
use Modules\POS\Application\Events\SaleItemPayload;
use Modules\POS\Application\Events\SalePaymentPayload;
use Modules\POS\Application\Listeners\PosSaleOrderListener;
use RuntimeException;
use Tests\TestCase;

/**
 * CRIT-004 — PosSaleOrderListener unit tests.
 *
 * Updated to SaleFinalized: listener no longer reloads Sale from DB —
 * all context (items, customerId, channelId) comes from the event.
 */
final class PosSaleOrderListenerTest extends TestCase
{
    use Mockery\Adapter\Phpunit\MockeryPHPUnitIntegration;

    private const SALE_ID = 'sale-uuid-001';

    private const RECEIPT_NUMBER = 'RCP-2026-000001';

    private const CUSTOMER_ID = 'customer-uuid-001';

    private const GUEST_ID = 'guest-customer-uuid-001';

    private const PRODUCT_A = 'product-uuid-aaa';

    private const PRODUCT_B = 'product-uuid-bbb';

    private const ORDER_ID = 'order-uuid-001';

    private MockInterface $orderCreation;

    private PosSaleOrderListener $listener;

    protected function setUp(): void
    {
        parent::setUp();

        $this->orderCreation = Mockery::mock(OrderCreationPortInterface::class);

        // PosSaleOrderListener::__construct takes a second dependency,
        // ConfigurationManager. It is declared final, so Mockery cannot double it;
        // the container-resolved instance is used instead — the same wiring
        // production uses. It is consulted on one branch only (getBrandPolicy at
        // PosSaleOrderListener:122), which these cases do not reach.
        $this->listener = new PosSaleOrderListener(
            $this->orderCreation,
            app(ConfigurationManager::class),
        );
    }

    // ── Happy path ────────────────────────────────────────────────────────────

    public function test_creates_order_for_sale_with_known_customer(): void
    {
        $event = $this->makeEvent(customerId: self::CUSTOMER_ID, items: [
            $this->item(self::PRODUCT_A, 2.0, '50.00'),
        ]);

        $this->orderCreation
            ->shouldReceive('create')
            ->once()
            ->withArgs(function (OrderDTO $dto) {
                return $dto->customer_id === self::CUSTOMER_ID
                    && $dto->status === OrderStatus::Delivered
                    && $dto->external_order_id === self::SALE_ID
                    && count($dto->lines) === 1
                    && $dto->lines[0]['product_id'] === self::PRODUCT_A
                    && $dto->lines[0]['quantity'] === 2.0
                    && $dto->lines[0]['unit_price'] === 50.0;
            })
            ->andReturn(OperationResult::success($this->buildOrder()));

        $this->listener->handle($event);
    }

    public function test_creates_order_for_anonymous_sale_using_guest_customer(): void
    {
        Config::set('pos.erp.guest_customer_id', self::GUEST_ID);

        $event = $this->makeEvent(customerId: null, items: [
            $this->item(self::PRODUCT_A, 1.0, '25.00'),
        ]);

        $this->orderCreation
            ->shouldReceive('create')
            ->once()
            ->withArgs(fn (OrderDTO $dto) => $dto->customer_id === self::GUEST_ID)
            ->andReturn(OperationResult::success($this->buildOrder()));

        $this->listener->handle($event);
    }

    public function test_creates_order_with_correct_line_count_for_multi_item_sale(): void
    {
        $event = $this->makeEvent(customerId: self::CUSTOMER_ID, items: [
            $this->item(self::PRODUCT_A, 3.0, '10.00'),
            $this->item(self::PRODUCT_B, 1.0, '200.00'),
        ]);

        $this->orderCreation
            ->shouldReceive('create')
            ->once()
            ->withArgs(fn (OrderDTO $dto) => count($dto->lines) === 2)
            ->andReturn(OperationResult::success($this->buildOrder()));

        $this->listener->handle($event);
    }

    public function test_sets_external_order_id_to_sale_id_for_traceability(): void
    {
        $event = $this->makeEvent(customerId: self::CUSTOMER_ID, items: [
            $this->item(self::PRODUCT_A, 1.0, '50.00'),
        ]);

        $this->orderCreation
            ->shouldReceive('create')
            ->once()
            ->withArgs(fn (OrderDTO $dto) => $dto->external_order_id === self::SALE_ID)
            ->andReturn(OperationResult::success($this->buildOrder()));

        $this->listener->handle($event);
    }

    public function test_order_status_is_completed_for_pos_sale(): void
    {
        $event = $this->makeEvent(customerId: self::CUSTOMER_ID, items: [
            $this->item(self::PRODUCT_A, 1.0, '50.00'),
        ]);

        $this->orderCreation
            ->shouldReceive('create')
            ->once()
            ->withArgs(fn (OrderDTO $dto) => $dto->status === OrderStatus::Delivered)
            ->andReturn(OperationResult::success($this->buildOrder()));

        $this->listener->handle($event);
    }

    public function test_channel_id_comes_from_event(): void
    {
        $event = $this->makeEvent(customerId: self::CUSTOMER_ID, channelId: 'channel-uuid-001');

        $this->orderCreation
            ->shouldReceive('create')
            ->once()
            ->withArgs(fn (OrderDTO $dto) => $dto->channel_id === 'channel-uuid-001')
            ->andReturn(OperationResult::success($this->buildOrder()));

        $this->listener->handle($event);
    }

    // ── Guard-clauses ─────────────────────────────────────────────────────────

    public function test_skips_order_when_no_customer_and_no_guest_configured(): void
    {
        Config::set('pos.erp.guest_customer_id', null);

        Log::shouldReceive('channel')->with('daily')->andReturnSelf();
        Log::shouldReceive('warning')->once()->withArgs(fn ($msg) => str_contains($msg, 'POS_GUEST_CUSTOMER_ID'));

        $event = $this->makeEvent(customerId: null);
        $this->orderCreation->shouldNotReceive('create');

        $this->listener->handle($event);
    }

    // ── Failure resilience ────────────────────────────────────────────────────

    public function test_logs_error_on_order_creation_failure_and_does_not_rethrow(): void
    {
        $event = $this->makeEvent(customerId: self::CUSTOMER_ID);

        $this->orderCreation
            ->shouldReceive('create')
            ->andThrow(new RuntimeException('DB error'));

        Log::shouldReceive('channel')->with('daily')->andReturnSelf();
        Log::shouldReceive('error')->once()->withArgs(fn ($msg) => str_contains($msg, 'Failed to create ERP order'));

        $this->listener->handle($event);
    }

    public function test_notes_contain_receipt_number(): void
    {
        $event = $this->makeEvent(customerId: self::CUSTOMER_ID);

        $this->orderCreation
            ->shouldReceive('create')
            ->once()
            ->withArgs(fn (OrderDTO $dto) => str_contains((string) $dto->notes, self::RECEIPT_NUMBER))
            ->andReturn(OperationResult::success($this->buildOrder()));

        $this->listener->handle($event);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /** @param SaleItemPayload[] $items */
    private function makeEvent(
        ?string $customerId = self::CUSTOMER_ID,
        array $items = [],
        ?string $channelId = null,
    ): SaleFinalized {
        if (empty($items)) {
            $items = [$this->item(self::PRODUCT_A, 1.0, '100.00')];
        }

        return new SaleFinalized(
            eventId: 'event-uuid-001',
            occurredAt: new DateTimeImmutable('now'),
            saleId: self::SALE_ID,
            receiptNumber: self::RECEIPT_NUMBER,
            companyId: 'company-uuid-001',
            channelId: $channelId,
            warehouseId: 'warehouse-uuid-001',
            sessionId: 'session-uuid-001',
            shiftId: 'shift-uuid-001',
            terminalId: 'terminal-uuid-001',
            cashierId: 'cashier-uuid-001',
            customerId: $customerId,
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

    private function item(string $productId, float $qty, string $unitPrice): SaleItemPayload
    {
        return new SaleItemPayload(
            lineId: 'line-'.$productId,
            productId: $productId,
            productName: 'Product '.$productId,
            sku: 'SKU-'.$productId,
            quantity: $qty,
            unitPrice: $unitPrice,
            lineTotal: (string) ($qty * (float) $unitPrice),
            currency: 'EGP',
        );
    }

    private function buildOrder(): Order
    {
        $order = new Order;
        $order->id = self::ORDER_ID;

        return $order;
    }
}
