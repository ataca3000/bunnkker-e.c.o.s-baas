<?php

declare(strict_types=1);

namespace Tests\Unit\POS\Payment;

use Modules\POS\Payment\Domain\Events\PaymentCaptured;
use Modules\POS\Payment\Domain\Events\PaymentInitiated;
use Modules\POS\Payment\Domain\Events\TenderAdded;
use Modules\POS\Payment\Domain\Events\TenderRemoved;
use Modules\POS\Shared\Domain\Contracts\DomainEvent;
use PHPUnit\Framework\TestCase;

/**
 * PKG-POS-007: Payment domain events unit tests.
 * Verifies DomainEvent contract and payload structure with no infrastructure.
 */
final class PaymentDomainEventsTest extends TestCase
{
    private const PAYMENT_ID = 'pay-uuid-1';

    private const CART_ID = 'cart-uuid-1';

    private const SESSION_ID = 'session-uuid-1';

    private const SHIFT_ID = 'shift-uuid-1';

    private const TERMINAL_ID = 'terminal-uuid-1';

    private const CASHIER_ID = 'cashier-uuid-1';

    private const CURRENCY = 'EGP';

    // ── PaymentInitiated ──────────────────────────────────────────────────────

    public function test_payment_initiated_implements_domain_event(): void
    {
        $this->assertInstanceOf(DomainEvent::class, $this->makeInitiated());
    }

    public function test_payment_initiated_event_name(): void
    {
        $this->assertSame('pos.payment.initiated', $this->makeInitiated()->eventName());
    }

    public function test_payment_initiated_version_is_one(): void
    {
        $this->assertSame(1, $this->makeInitiated()->eventVersion());
    }

    public function test_payment_initiated_to_array_contains_required_keys(): void
    {
        $array = $this->makeInitiated()->toArray();
        foreach ([
            'event_id', 'event_name', 'occurred_at', 'event_version', 'correlation_id',
            'payment_id', 'cart_id', 'session_id', 'shift_id', 'terminal_id',
            'cashier_id', 'cart_total_amount', 'currency',
        ] as $key) {
            $this->assertArrayHasKey($key, $array, "Missing: {$key}");
        }
    }

    // ── TenderAdded ───────────────────────────────────────────────────────────

    public function test_tender_added_implements_domain_event(): void
    {
        $this->assertInstanceOf(DomainEvent::class, $this->makeTenderAdded());
    }

    public function test_tender_added_event_name(): void
    {
        $this->assertSame('pos.payment.tender_added', $this->makeTenderAdded()->eventName());
    }

    public function test_tender_added_carries_tender_fields(): void
    {
        $event = $this->makeTenderAdded();
        $this->assertSame('tender-uuid-1', $event->tenderId);
        $this->assertSame('cash', $event->type);
        $this->assertSame('100.00', $event->tenderAmount);
        $this->assertNull($event->reference);
    }

    public function test_tender_added_to_array_contains_required_keys(): void
    {
        $array = $this->makeTenderAdded()->toArray();
        foreach ([
            'event_id', 'payment_id', 'cart_id', 'tender_id',
            'type', 'tender_amount', 'currency', 'reference', 'amount_tendered_total',
        ] as $key) {
            $this->assertArrayHasKey($key, $array, "Missing: {$key}");
        }
    }

    // ── TenderRemoved ─────────────────────────────────────────────────────────

    public function test_tender_removed_implements_domain_event(): void
    {
        $this->assertInstanceOf(DomainEvent::class, $this->makeTenderRemoved());
    }

    public function test_tender_removed_event_name(): void
    {
        $this->assertSame('pos.payment.tender_removed', $this->makeTenderRemoved()->eventName());
    }

    public function test_tender_removed_to_array_contains_required_keys(): void
    {
        $array = $this->makeTenderRemoved()->toArray();
        foreach ([
            'event_id', 'payment_id', 'cart_id', 'tender_id', 'type', 'amount_tendered_total',
        ] as $key) {
            $this->assertArrayHasKey($key, $array, "Missing: {$key}");
        }
    }

    // ── PaymentCaptured ───────────────────────────────────────────────────────

    public function test_payment_captured_implements_domain_event(): void
    {
        $this->assertInstanceOf(DomainEvent::class, $this->makeCaptured());
    }

    public function test_payment_captured_event_name(): void
    {
        $this->assertSame('pos.payment.captured', $this->makeCaptured()->eventName());
    }

    public function test_payment_captured_carries_financial_fields(): void
    {
        $event = $this->makeCaptured();
        $this->assertSame('150.00', $event->cartTotalAmount);
        $this->assertSame('160.00', $event->amountTenderedAmount);
        $this->assertSame('10.00', $event->changeDueAmount);
        $this->assertSame(2, $event->tenderCount);
    }

    public function test_payment_captured_to_array_contains_required_keys(): void
    {
        $array = $this->makeCaptured()->toArray();
        foreach ([
            'event_id', 'payment_id', 'cart_id', 'session_id', 'terminal_id', 'cashier_id',
            'cart_total_amount', 'amount_tendered_amount', 'change_due_amount',
            'currency', 'tender_count',
        ] as $key) {
            $this->assertArrayHasKey($key, $array, "Missing: {$key}");
        }
    }

    // ── UTC timezone ──────────────────────────────────────────────────────────

    public function test_all_events_have_utc_occurred_at(): void
    {
        $events = [
            $this->makeInitiated(),
            $this->makeTenderAdded(),
            $this->makeTenderRemoved(),
            $this->makeCaptured(),
        ];

        foreach ($events as $event) {
            $this->assertSame('UTC', $event->occurredAt()->getTimezone()->getName(), get_class($event));
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function makeInitiated(): PaymentInitiated
    {
        return PaymentInitiated::now(
            self::PAYMENT_ID, self::CART_ID, self::SESSION_ID, self::SHIFT_ID,
            self::TERMINAL_ID, self::CASHIER_ID, '150.00', self::CURRENCY,
        );
    }

    private function makeTenderAdded(): TenderAdded
    {
        return TenderAdded::now(
            self::PAYMENT_ID, self::CART_ID, 'tender-uuid-1', 'cash',
            '100.00', self::CURRENCY, null, '100.00',
        );
    }

    private function makeTenderRemoved(): TenderRemoved
    {
        return TenderRemoved::now(
            self::PAYMENT_ID, self::CART_ID, 'tender-uuid-1', 'cash', '0.00',
        );
    }

    private function makeCaptured(): PaymentCaptured
    {
        return PaymentCaptured::now(
            self::PAYMENT_ID, self::CART_ID, self::SESSION_ID, self::TERMINAL_ID,
            self::CASHIER_ID, '150.00', '160.00', '10.00', self::CURRENCY, 2,
        );
    }
}
