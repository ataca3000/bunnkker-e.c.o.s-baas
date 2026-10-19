<?php

declare(strict_types=1);

namespace Tests\Unit\POS\Sale;

use Modules\POS\Sale\Domain\Events\SaleCompleted;
use Modules\POS\Sale\Domain\Events\SalePartiallyRefunded;
use Modules\POS\Sale\Domain\Events\SaleRecorded;
use Modules\POS\Sale\Domain\Events\SaleRefunded;
use Modules\POS\Sale\Domain\Events\SaleVoided;
use Modules\POS\Shared\Domain\Contracts\DomainEvent;
use PHPUnit\Framework\TestCase;

/**
 * PKG-POS-008: Sale domain events unit tests.
 * Verifies DomainEvent contract and payload structure with no infrastructure.
 */
final class SaleDomainEventsTest extends TestCase
{
    private const SALE_ID = 'sale-uuid-1';

    private const CART_ID = 'cart-uuid-1';

    private const PAYMENT_ID = 'pay-uuid-1';

    private const SESSION_ID = 'session-uuid-1';

    private const SHIFT_ID = 'shift-uuid-1';

    private const TERMINAL_ID = 'terminal-uuid-1';

    private const CASHIER_ID = 'cashier-uuid-1';

    private const RECEIPT_NUMBER = 'RCP-2026-000001';

    private const CURRENCY = 'EGP';

    // ── SaleRecorded ──────────────────────────────────────────────────────────

    public function test_sale_recorded_implements_domain_event(): void
    {
        $this->assertInstanceOf(DomainEvent::class, $this->makeRecorded());
    }

    public function test_sale_recorded_event_name(): void
    {
        $this->assertSame('pos.sale.recorded', $this->makeRecorded()->eventName());
    }

    public function test_sale_recorded_version_is_one(): void
    {
        $this->assertSame(1, $this->makeRecorded()->eventVersion());
    }

    public function test_sale_recorded_nullable_customer_id(): void
    {
        $event = SaleRecorded::now(
            self::SALE_ID, self::CART_ID, self::PAYMENT_ID, self::SESSION_ID,
            self::SHIFT_ID, self::TERMINAL_ID, self::CASHIER_ID, null,
            self::RECEIPT_NUMBER, '150.00', '150.00', self::CURRENCY, 3,
        );
        $this->assertNull($event->customerId);
    }

    public function test_sale_recorded_to_array_contains_required_keys(): void
    {
        $array = $this->makeRecorded()->toArray();
        foreach ([
            'event_id', 'event_name', 'occurred_at', 'event_version', 'correlation_id',
            'sale_id', 'cart_id', 'payment_id', 'session_id', 'shift_id', 'terminal_id',
            'cashier_id', 'customer_id', 'receipt_number', 'total_amount', 'amount_paid',
            'currency', 'line_count',
        ] as $key) {
            $this->assertArrayHasKey($key, $array, "Missing: {$key}");
        }
    }

    public function test_two_sale_recorded_events_have_different_ids(): void
    {
        $this->assertNotSame($this->makeRecorded()->eventId(), $this->makeRecorded()->eventId());
    }

    // ── SaleCompleted ─────────────────────────────────────────────────────────

    public function test_sale_completed_implements_domain_event(): void
    {
        $this->assertInstanceOf(DomainEvent::class, $this->makeCompleted());
    }

    public function test_sale_completed_event_name(): void
    {
        $this->assertSame('pos.sale.completed', $this->makeCompleted()->eventName());
    }

    public function test_sale_completed_to_array_contains_required_keys(): void
    {
        $array = $this->makeCompleted()->toArray();
        foreach ([
            'event_id', 'sale_id', 'receipt_number',
            'total_amount', 'amount_paid', 'change_given', 'currency',
        ] as $key) {
            $this->assertArrayHasKey($key, $array, "Missing: {$key}");
        }
    }

    // ── SaleVoided ────────────────────────────────────────────────────────────

    public function test_sale_voided_implements_domain_event(): void
    {
        $this->assertInstanceOf(DomainEvent::class, $this->makeVoided());
    }

    public function test_sale_voided_event_name(): void
    {
        $this->assertSame('pos.sale.voided', $this->makeVoided()->eventName());
    }

    public function test_sale_voided_carries_reason(): void
    {
        $event = SaleVoided::now(self::SALE_ID, self::RECEIPT_NUMBER, 'Customer changed mind');
        $this->assertSame('Customer changed mind', $event->reason);
    }

    public function test_sale_voided_to_array_contains_required_keys(): void
    {
        $array = $this->makeVoided()->toArray();
        foreach (['event_id', 'sale_id', 'receipt_number', 'reason'] as $key) {
            $this->assertArrayHasKey($key, $array, "Missing: {$key}");
        }
    }

    // ── SaleRefunded ──────────────────────────────────────────────────────────

    public function test_sale_refunded_implements_domain_event(): void
    {
        $this->assertInstanceOf(DomainEvent::class, $this->makeRefunded());
    }

    public function test_sale_refunded_event_name(): void
    {
        $this->assertSame('pos.sale.refunded', $this->makeRefunded()->eventName());
    }

    public function test_sale_refunded_to_array_contains_required_keys(): void
    {
        $array = $this->makeRefunded()->toArray();
        foreach (['event_id', 'sale_id', 'receipt_number'] as $key) {
            $this->assertArrayHasKey($key, $array, "Missing: {$key}");
        }
    }

    // ── SalePartiallyRefunded ─────────────────────────────────────────────────

    public function test_sale_partially_refunded_implements_domain_event(): void
    {
        $this->assertInstanceOf(DomainEvent::class, $this->makePartiallyRefunded());
    }

    public function test_sale_partially_refunded_event_name(): void
    {
        $this->assertSame('pos.sale.partially_refunded', $this->makePartiallyRefunded()->eventName());
    }

    public function test_sale_partially_refunded_to_array_contains_required_keys(): void
    {
        $array = $this->makePartiallyRefunded()->toArray();
        foreach (['event_id', 'sale_id', 'receipt_number'] as $key) {
            $this->assertArrayHasKey($key, $array, "Missing: {$key}");
        }
    }

    // ── UTC timezone ──────────────────────────────────────────────────────────

    public function test_all_events_have_utc_occurred_at(): void
    {
        $events = [
            $this->makeRecorded(),
            $this->makeCompleted(),
            $this->makeVoided(),
            $this->makeRefunded(),
            $this->makePartiallyRefunded(),
        ];

        foreach ($events as $event) {
            $this->assertSame('UTC', $event->occurredAt()->getTimezone()->getName(), get_class($event));
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function makeRecorded(): SaleRecorded
    {
        return SaleRecorded::now(
            self::SALE_ID, self::CART_ID, self::PAYMENT_ID, self::SESSION_ID,
            self::SHIFT_ID, self::TERMINAL_ID, self::CASHIER_ID, 'customer-1',
            self::RECEIPT_NUMBER, '150.00', '150.00', self::CURRENCY, 3,
        );
    }

    private function makeCompleted(): SaleCompleted
    {
        return SaleCompleted::now(
            self::SALE_ID, self::RECEIPT_NUMBER, '150.00', '200.00', '50.00', self::CURRENCY,
        );
    }

    private function makeVoided(): SaleVoided
    {
        return SaleVoided::now(self::SALE_ID, self::RECEIPT_NUMBER, 'Test void');
    }

    private function makeRefunded(): SaleRefunded
    {
        return SaleRefunded::now(self::SALE_ID, self::RECEIPT_NUMBER);
    }

    private function makePartiallyRefunded(): SalePartiallyRefunded
    {
        return SalePartiallyRefunded::now(self::SALE_ID, self::RECEIPT_NUMBER);
    }
}
