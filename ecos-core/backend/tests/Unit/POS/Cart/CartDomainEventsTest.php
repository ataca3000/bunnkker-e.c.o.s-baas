<?php

declare(strict_types=1);

namespace Tests\Unit\POS\Cart;

use Modules\POS\Cart\Domain\Events\CartCancelled;
use Modules\POS\Cart\Domain\Events\CartCompleted;
use Modules\POS\Cart\Domain\Events\CartExpired;
use Modules\POS\Cart\Domain\Events\CartHeld;
use Modules\POS\Cart\Domain\Events\CartLineAdded;
use Modules\POS\Cart\Domain\Events\CartLineRemoved;
use Modules\POS\Cart\Domain\Events\CartLineUpdated;
use Modules\POS\Cart\Domain\Events\CartOpened;
use Modules\POS\Cart\Domain\Events\CartResumed;
use Modules\POS\Shared\Domain\Contracts\DomainEvent;
use PHPUnit\Framework\TestCase;

/**
 * PKG-POS-006: Cart domain events unit tests.
 * Verifies DomainEvent contract and payload structure with no infrastructure.
 */
final class CartDomainEventsTest extends TestCase
{
    private const CART_ID = 'cart-uuid-1';

    private const SESSION_ID = 'session-uuid-1';

    private const SHIFT_ID = 'shift-uuid-1';

    private const TERMINAL_ID = 'terminal-uuid-1';

    private const CASHIER_ID = 'cashier-uuid-1';

    private const CURRENCY = 'EGP';

    // ── CartOpened ────────────────────────────────────────────────────────────

    public function test_cart_opened_implements_domain_event(): void
    {
        $this->assertInstanceOf(DomainEvent::class, $this->makeOpened());
    }

    public function test_cart_opened_event_name(): void
    {
        $this->assertSame('pos.cart.opened', $this->makeOpened()->eventName());
    }

    public function test_cart_opened_event_id_equals_correlation_id(): void
    {
        $e = $this->makeOpened();
        $this->assertSame($e->eventId(), $e->correlationId());
    }

    public function test_cart_opened_to_array_contains_required_keys(): void
    {
        $array = $this->makeOpened()->toArray();

        foreach (['event_id', 'event_name', 'occurred_at', 'event_version', 'correlation_id',
            'cart_id', 'session_id', 'shift_id', 'terminal_id', 'cashier_id',
            'customer_id', 'currency'] as $key) {
            $this->assertArrayHasKey($key, $array, "Missing: {$key}");
        }
    }

    public function test_cart_opened_nullable_customer_id(): void
    {
        $event = CartOpened::now(
            self::CART_ID, self::SESSION_ID, self::SHIFT_ID,
            self::TERMINAL_ID, self::CASHIER_ID, null, self::CURRENCY,
        );

        $this->assertNull($event->customerId);
        $this->assertNull($event->toArray()['customer_id']);
    }

    public function test_two_cart_opened_events_have_different_ids(): void
    {
        $this->assertNotSame($this->makeOpened()->eventId(), $this->makeOpened()->eventId());
    }

    // ── CartLineAdded ─────────────────────────────────────────────────────────

    public function test_cart_line_added_implements_domain_event(): void
    {
        $this->assertInstanceOf(DomainEvent::class, $this->makeLineAdded());
        $this->assertSame('pos.cart.line_added', $this->makeLineAdded()->eventName());
    }

    public function test_cart_line_added_to_array_contains_required_keys(): void
    {
        $array = $this->makeLineAdded()->toArray();

        foreach (['event_id', 'event_name', 'occurred_at', 'event_version', 'correlation_id',
            'cart_id', 'line_id', 'product_id', 'product_name', 'sku',
            'quantity', 'unit_price_amount', 'line_total_amount', 'currency'] as $key) {
            $this->assertArrayHasKey($key, $array, "Missing: {$key}");
        }
    }

    // ── CartLineUpdated ───────────────────────────────────────────────────────

    public function test_cart_line_updated_implements_domain_event(): void
    {
        $event = CartLineUpdated::now(
            self::CART_ID, 'line-1', 'prod-1', '2.0000', '3.0000', '30.00', self::CURRENCY,
        );

        $this->assertInstanceOf(DomainEvent::class, $event);
        $this->assertSame('pos.cart.line_updated', $event->eventName());
        $this->assertSame('2.0000', $event->oldQuantity);
        $this->assertSame('3.0000', $event->newQuantity);
    }

    public function test_cart_line_updated_to_array_contains_required_keys(): void
    {
        $array = CartLineUpdated::now(
            self::CART_ID, 'l', 'p', '1.0000', '2.0000', '20.00', self::CURRENCY,
        )->toArray();

        foreach (['event_id', 'cart_id', 'line_id', 'product_id', 'old_quantity',
            'new_quantity', 'line_total_amount', 'currency'] as $key) {
            $this->assertArrayHasKey($key, $array, "Missing: {$key}");
        }
    }

    // ── CartLineRemoved ───────────────────────────────────────────────────────

    public function test_cart_line_removed_implements_domain_event(): void
    {
        $event = CartLineRemoved::now(self::CART_ID, 'line-1', 'prod-1');

        $this->assertInstanceOf(DomainEvent::class, $event);
        $this->assertSame('pos.cart.line_removed', $event->eventName());
    }

    public function test_cart_line_removed_to_array_contains_required_keys(): void
    {
        $array = CartLineRemoved::now(self::CART_ID, 'line-1', 'prod-1')->toArray();

        foreach (['event_id', 'cart_id', 'line_id', 'product_id'] as $key) {
            $this->assertArrayHasKey($key, $array, "Missing: {$key}");
        }
    }

    // ── CartHeld ──────────────────────────────────────────────────────────────

    public function test_cart_held_implements_domain_event(): void
    {
        $event = CartHeld::now(
            self::CART_ID, self::SESSION_ID, self::TERMINAL_ID, self::CASHIER_ID, 3, '150.00', self::CURRENCY,
        );

        $this->assertInstanceOf(DomainEvent::class, $event);
        $this->assertSame('pos.cart.held', $event->eventName());
        $this->assertSame(3, $event->lineCount);
        $this->assertSame('150.00', $event->totalAmount);
    }

    public function test_cart_held_to_array_contains_required_keys(): void
    {
        $array = CartHeld::now(
            self::CART_ID, self::SESSION_ID, self::TERMINAL_ID, self::CASHIER_ID, 1, '10.00', self::CURRENCY,
        )->toArray();

        foreach (['event_id', 'cart_id', 'session_id', 'terminal_id', 'cashier_id',
            'line_count', 'total_amount', 'currency'] as $key) {
            $this->assertArrayHasKey($key, $array, "Missing: {$key}");
        }
    }

    // ── CartResumed ───────────────────────────────────────────────────────────

    public function test_cart_resumed_implements_domain_event(): void
    {
        $event = CartResumed::now(
            self::CART_ID, self::SESSION_ID, self::TERMINAL_ID, self::CASHIER_ID,
        );

        $this->assertInstanceOf(DomainEvent::class, $event);
        $this->assertSame('pos.cart.resumed', $event->eventName());
    }

    // ── CartCompleted ─────────────────────────────────────────────────────────

    public function test_cart_completed_implements_domain_event(): void
    {
        $event = $this->makeCompleted();

        $this->assertInstanceOf(DomainEvent::class, $event);
        $this->assertSame('pos.cart.completed', $event->eventName());
    }

    public function test_cart_completed_carries_receipt_and_financial_fields(): void
    {
        $event = $this->makeCompleted();

        $this->assertSame('RCP-2026-000001', $event->receiptNumber);
        $this->assertSame('150.00', $event->totalAmount);
        $this->assertSame(3, $event->lineCount);
    }

    public function test_cart_completed_to_array_contains_required_keys(): void
    {
        $array = $this->makeCompleted()->toArray();

        foreach (['event_id', 'cart_id', 'session_id', 'terminal_id', 'cashier_id',
            'receipt_number', 'total_amount', 'currency', 'line_count'] as $key) {
            $this->assertArrayHasKey($key, $array, "Missing: {$key}");
        }
    }

    // ── CartCancelled ─────────────────────────────────────────────────────────

    public function test_cart_cancelled_implements_domain_event(): void
    {
        $event = CartCancelled::now(
            self::CART_ID, self::SESSION_ID, self::TERMINAL_ID, self::CASHIER_ID,
        );

        $this->assertInstanceOf(DomainEvent::class, $event);
        $this->assertSame('pos.cart.cancelled', $event->eventName());
    }

    // ── CartExpired ───────────────────────────────────────────────────────────

    public function test_cart_expired_implements_domain_event(): void
    {
        $event = CartExpired::now(self::CART_ID, self::SESSION_ID, self::TERMINAL_ID);

        $this->assertInstanceOf(DomainEvent::class, $event);
        $this->assertSame('pos.cart.expired', $event->eventName());
    }

    public function test_cart_expired_to_array_contains_required_keys(): void
    {
        $array = CartExpired::now(self::CART_ID, self::SESSION_ID, self::TERMINAL_ID)->toArray();

        foreach (['event_id', 'cart_id', 'session_id', 'terminal_id'] as $key) {
            $this->assertArrayHasKey($key, $array, "Missing: {$key}");
        }
    }

    public function test_all_events_have_utc_occurred_at(): void
    {
        $events = [
            $this->makeOpened(),
            $this->makeLineAdded(),
            CartLineRemoved::now(self::CART_ID, 'l', 'p'),
            CartHeld::now(self::CART_ID, self::SESSION_ID, self::TERMINAL_ID, self::CASHIER_ID, 1, '10.00', self::CURRENCY),
            CartResumed::now(self::CART_ID, self::SESSION_ID, self::TERMINAL_ID, self::CASHIER_ID),
            $this->makeCompleted(),
            CartCancelled::now(self::CART_ID, self::SESSION_ID, self::TERMINAL_ID, self::CASHIER_ID),
            CartExpired::now(self::CART_ID, self::SESSION_ID, self::TERMINAL_ID),
        ];

        foreach ($events as $event) {
            $this->assertSame('UTC', $event->occurredAt()->getTimezone()->getName(), get_class($event));
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function makeOpened(): CartOpened
    {
        return CartOpened::now(
            self::CART_ID, self::SESSION_ID, self::SHIFT_ID,
            self::TERMINAL_ID, self::CASHIER_ID, 'customer-1', self::CURRENCY,
        );
    }

    private function makeLineAdded(): CartLineAdded
    {
        return CartLineAdded::now(
            self::CART_ID, 'line-1', 'prod-1', 'Widget', 'WGT-001',
            '2.0000', '10.00', '20.00', self::CURRENCY,
        );
    }

    private function makeCompleted(): CartCompleted
    {
        return CartCompleted::now(
            self::CART_ID, self::SESSION_ID, self::TERMINAL_ID, self::CASHIER_ID,
            'RCP-2026-000001', '150.00', self::CURRENCY, 3,
        );
    }
}
