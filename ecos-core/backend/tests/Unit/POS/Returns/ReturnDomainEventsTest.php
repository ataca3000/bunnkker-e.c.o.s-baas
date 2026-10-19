<?php

declare(strict_types=1);

namespace Tests\Unit\POS\Returns;

use Modules\POS\Returns\Domain\Events\ReturnCancelled;
use Modules\POS\Returns\Domain\Events\ReturnInitiated;
use Modules\POS\Returns\Domain\Events\ReturnProcessed;
use Modules\POS\Shared\Domain\Contracts\DomainEvent;
use PHPUnit\Framework\TestCase;

/**
 * PKG-POS-009: Return domain events unit tests.
 * Verifies DomainEvent contract and payload structure with no infrastructure.
 */
final class ReturnDomainEventsTest extends TestCase
{
    private const RETURN_ID = 'return-uuid-1';

    private const SALE_ID = 'sale-uuid-1';

    private const RECEIPT_NUMBER = 'RCP-2026-000001';

    private const RETURN_NUMBER = 'RTN-2026-000001';

    private const SESSION_ID = 'session-uuid-1';

    private const SHIFT_ID = 'shift-uuid-1';

    private const TERMINAL_ID = 'terminal-uuid-1';

    private const CASHIER_ID = 'cashier-uuid-1';

    private const CURRENCY = 'EGP';

    private const REFUND_TOTAL = '100.00';

    private const REFUND_METHOD = 'cash';

    // ── ReturnInitiated ───────────────────────────────────────────────────────

    public function test_return_initiated_implements_domain_event(): void
    {
        $this->assertInstanceOf(DomainEvent::class, $this->makeInitiated());
    }

    public function test_return_initiated_event_name(): void
    {
        $this->assertSame('pos.return.initiated', $this->makeInitiated()->eventName());
    }

    public function test_return_initiated_version_is_one(): void
    {
        $this->assertSame(1, $this->makeInitiated()->eventVersion());
    }

    public function test_return_initiated_nullable_customer_id(): void
    {
        $event = ReturnInitiated::now(
            self::RETURN_ID, self::SALE_ID, self::RECEIPT_NUMBER, self::RETURN_NUMBER,
            self::SESSION_ID, self::SHIFT_ID, self::TERMINAL_ID, self::CASHIER_ID, null,
            self::CURRENCY, self::REFUND_TOTAL, self::REFUND_METHOD, 2,
        );
        $this->assertNull($event->customerId);
    }

    public function test_return_initiated_to_array_contains_required_keys(): void
    {
        $array = $this->makeInitiated()->toArray();
        foreach ([
            'event_id', 'event_name', 'occurred_at', 'event_version', 'correlation_id',
            'return_id', 'sale_id', 'original_receipt_number', 'return_number',
            'session_id', 'shift_id', 'terminal_id', 'cashier_id', 'customer_id',
            'currency', 'refund_total', 'refund_method', 'line_count',
        ] as $key) {
            $this->assertArrayHasKey($key, $array, "Missing: {$key}");
        }
    }

    public function test_two_return_initiated_events_have_different_ids(): void
    {
        $this->assertNotSame(
            $this->makeInitiated()->eventId(),
            $this->makeInitiated()->eventId(),
        );
    }

    // ── ReturnProcessed ───────────────────────────────────────────────────────

    public function test_return_processed_implements_domain_event(): void
    {
        $this->assertInstanceOf(DomainEvent::class, $this->makeProcessed());
    }

    public function test_return_processed_event_name(): void
    {
        $this->assertSame('pos.return.processed', $this->makeProcessed()->eventName());
    }

    public function test_return_processed_to_array_contains_required_keys(): void
    {
        $array = $this->makeProcessed()->toArray();
        foreach ([
            'event_id', 'return_id', 'return_number', 'sale_id',
            'refund_total', 'currency', 'refund_method',
        ] as $key) {
            $this->assertArrayHasKey($key, $array, "Missing: {$key}");
        }
    }

    public function test_return_processed_carries_refund_total(): void
    {
        $this->assertSame(self::REFUND_TOTAL, $this->makeProcessed()->refundTotal);
    }

    // ── ReturnCancelled ───────────────────────────────────────────────────────

    public function test_return_cancelled_implements_domain_event(): void
    {
        $this->assertInstanceOf(DomainEvent::class, $this->makeCancelled());
    }

    public function test_return_cancelled_event_name(): void
    {
        $this->assertSame('pos.return.cancelled', $this->makeCancelled()->eventName());
    }

    public function test_return_cancelled_carries_reason(): void
    {
        $event = ReturnCancelled::now(self::RETURN_ID, self::RETURN_NUMBER, self::SALE_ID, 'Manager override');
        $this->assertSame('Manager override', $event->reason);
    }

    public function test_return_cancelled_to_array_contains_required_keys(): void
    {
        $array = $this->makeCancelled()->toArray();
        foreach (['event_id', 'return_id', 'return_number', 'sale_id', 'reason'] as $key) {
            $this->assertArrayHasKey($key, $array, "Missing: {$key}");
        }
    }

    // ── UTC timezone ──────────────────────────────────────────────────────────

    public function test_all_events_have_utc_occurred_at(): void
    {
        $events = [
            $this->makeInitiated(),
            $this->makeProcessed(),
            $this->makeCancelled(),
        ];

        foreach ($events as $event) {
            $this->assertSame('UTC', $event->occurredAt()->getTimezone()->getName(), get_class($event));
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function makeInitiated(): ReturnInitiated
    {
        return ReturnInitiated::now(
            self::RETURN_ID, self::SALE_ID, self::RECEIPT_NUMBER, self::RETURN_NUMBER,
            self::SESSION_ID, self::SHIFT_ID, self::TERMINAL_ID, self::CASHIER_ID, 'customer-1',
            self::CURRENCY, self::REFUND_TOTAL, self::REFUND_METHOD, 2,
        );
    }

    private function makeProcessed(): ReturnProcessed
    {
        return ReturnProcessed::now(
            self::RETURN_ID, self::RETURN_NUMBER, self::SALE_ID,
            self::REFUND_TOTAL, self::CURRENCY, self::REFUND_METHOD,
        );
    }

    private function makeCancelled(): ReturnCancelled
    {
        return ReturnCancelled::now(self::RETURN_ID, self::RETURN_NUMBER, self::SALE_ID, 'Test cancellation');
    }
}
