<?php

declare(strict_types=1);

namespace Tests\Unit\POS\Events;

use DateTimeImmutable;
use Modules\POS\Application\Events\SaleFinalized;
use Modules\POS\Application\Events\SaleItemPayload;
use Modules\POS\Application\Events\SalePaymentPayload;
use Modules\POS\Sale\Domain\ValueObjects\PaymentSummaryLine;
use Modules\POS\Sale\Domain\ValueObjects\SaleLine;
use Modules\POS\Shared\Domain\Enums\PaymentMethodType;
use Modules\POS\Shared\Domain\ValueObjects\Money;
use Modules\POS\Shared\Domain\ValueObjects\Quantity;
use Tests\TestCase;

/**
 * SaleFinalized event unit tests.
 *
 * Verifies: event assembly via fromSaleContext(), toArray() shape,
 * computed helpers (totalUnits, hasCustomer), DomainEvent interface compliance.
 */
final class SaleFinalizedTest extends TestCase
{
    private const SALE_ID = 'sale-uuid-001';

    private const RECEIPT_NUMBER = 'RCP-2026-000001';

    private const COMPANY_ID = 'company-uuid-001';

    private const WAREHOUSE_ID = 'warehouse-uuid-001';

    private const CUSTOMER_ID = 'customer-uuid-001';

    // ── DomainEvent interface ─────────────────────────────────────────────────

    public function test_event_name_is_pos_sale_finalized(): void
    {
        $event = $this->makeEvent();
        $this->assertSame('pos.sale.finalized', $event->eventName());
    }

    public function test_event_version_is_1(): void
    {
        $event = $this->makeEvent();
        $this->assertSame(1, $event->eventVersion());
    }

    public function test_event_id_equals_correlation_id(): void
    {
        $event = $this->makeEvent();
        $this->assertSame($event->eventId(), $event->correlationId());
    }

    public function test_event_id_is_a_valid_uuid(): void
    {
        // Use fromSaleContext() to get a system-generated UUID v4
        $event = $this->makeViaFactory();
        $this->assertMatchesRegularExpression(
            '/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/',
            $event->eventId(),
        );
    }

    public function test_occurred_at_is_a_datetime_immutable(): void
    {
        $event = $this->makeEvent();
        $this->assertInstanceOf(DateTimeImmutable::class, $event->occurredAt());
    }

    // ── toArray shape ─────────────────────────────────────────────────────────

    public function test_to_array_contains_required_top_level_keys(): void
    {
        $event = $this->makeEvent();
        $arr = $event->toArray();
        $keys = [
            'event_id', 'event_name', 'event_version', 'occurred_at', 'correlation_id',
            'sale_id', 'receipt_number', 'company_id', 'channel_id', 'warehouse_id',
            'session_id', 'shift_id', 'terminal_id', 'cashier_id', 'customer_id',
            'items', 'payments', 'subtotal', 'discount_total', 'grand_total',
            'amount_paid', 'change_given', 'currency',
        ];

        foreach ($keys as $key) {
            $this->assertArrayHasKey($key, $arr, "Missing key: $key");
        }
    }

    public function test_to_array_items_contain_correct_product_data(): void
    {
        $item = new SaleItemPayload('line-1', 'product-aaa', 'Widget', 'WGT-001', 3.0, '25.00', '75.00', 'EGP');
        $event = $this->makeEvent(items: [$item]);
        $arr = $event->toArray();

        $this->assertCount(1, $arr['items']);
        $this->assertSame('product-aaa', $arr['items'][0]['product_id']);
        $this->assertSame(3.0, $arr['items'][0]['quantity']);
        $this->assertSame('25.00', $arr['items'][0]['unit_price']);
    }

    public function test_to_array_channel_id_is_null_for_pos_sales(): void
    {
        $event = $this->makeEvent(channelId: null);
        $this->assertNull($event->toArray()['channel_id']);
    }

    // ── Computed helpers ──────────────────────────────────────────────────────

    public function test_total_units_sums_all_line_quantities(): void
    {
        $items = [
            new SaleItemPayload('l1', 'p1', 'P1', 'S1', 2.5, '10.00', '25.00', 'EGP'),
            new SaleItemPayload('l2', 'p2', 'P2', 'S2', 3.0, '10.00', '30.00', 'EGP'),
        ];
        $event = $this->makeEvent(items: $items);

        $this->assertSame(5.5, $event->totalUnits());
    }

    public function test_has_customer_returns_true_when_customer_present(): void
    {
        $event = $this->makeEvent(customerId: self::CUSTOMER_ID);
        $this->assertTrue($event->hasCustomer());
    }

    public function test_has_customer_returns_false_when_anonymous_sale(): void
    {
        $event = $this->makeEvent(customerId: null);
        $this->assertFalse($event->hasCustomer());
    }

    // ── Immutability ──────────────────────────────────────────────────────────

    public function test_two_events_have_different_event_ids(): void
    {
        // fromSaleContext() auto-generates a UUID v4 each call
        $event1 = $this->makeViaFactory();
        $event2 = $this->makeViaFactory();

        $this->assertNotSame($event1->eventId(), $event2->eventId());
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function makeViaFactory(): SaleFinalized
    {
        $line = new SaleLine(
            lineId: 'line-1',
            productId: 'product-aaa',
            productName: 'Widget',
            sku: 'WGT-001',
            quantity: Quantity::of(2.0),
            unitPrice: Money::of('50.00', 'EGP'),
            discountType: null,
            discountValue: null,
            lineTotal: Money::of('100.00', 'EGP'),
            sortOrder: 0,
        );

        $payment = new PaymentSummaryLine(
            type: PaymentMethodType::Cash,
            amount: Money::of('100.00', 'EGP'),
            reference: null,
        );

        return SaleFinalized::fromSaleContext(
            saleId: self::SALE_ID,
            receiptNumber: self::RECEIPT_NUMBER,
            companyId: self::COMPANY_ID,
            channelId: null,
            warehouseId: self::WAREHOUSE_ID,
            sessionId: 'session-uuid-001',
            shiftId: 'shift-uuid-001',
            terminalId: 'terminal-uuid-001',
            cashierId: 'cashier-uuid-001',
            customerId: self::CUSTOMER_ID,
            saleLines: [$line],
            paymentSummaries: [$payment],
            subtotal: '100.00',
            discountTotal: '0.00',
            grandTotal: '100.00',
            amountPaid: '100.00',
            changeGiven: '0.00',
            currency: 'EGP',
        );
    }

    /** @param SaleItemPayload[] $items */
    private function makeEvent(
        ?string $customerId = self::CUSTOMER_ID,
        ?string $channelId = null,
        array $items = [],
    ): SaleFinalized {
        if (empty($items)) {
            $items = [
                new SaleItemPayload('line-1', 'product-aaa', 'Widget', 'WGT-001', 2.0, '50.00', '100.00', 'EGP'),
            ];
        }

        return new SaleFinalized(
            eventId: 'event-uuid-'.random_int(1000, 9999),
            occurredAt: new DateTimeImmutable('now'),
            saleId: self::SALE_ID,
            receiptNumber: self::RECEIPT_NUMBER,
            companyId: self::COMPANY_ID,
            channelId: $channelId,
            warehouseId: self::WAREHOUSE_ID,
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
}
