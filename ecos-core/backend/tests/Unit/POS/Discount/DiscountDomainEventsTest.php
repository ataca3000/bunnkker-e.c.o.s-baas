<?php

declare(strict_types=1);

namespace Tests\Unit\POS\Discount;

use Modules\POS\Discount\Domain\Events\DiscountApproved;
use Modules\POS\Discount\Domain\Events\DiscountRejected;
use Modules\POS\Discount\Domain\Events\DiscountRequested;
use Modules\POS\Shared\Domain\Contracts\DomainEvent;
use PHPUnit\Framework\TestCase;

final class DiscountDomainEventsTest extends TestCase
{
    // ── DomainEvent contract ──────────────────────────────────────────────────

    public function test_discount_requested_implements_domain_event(): void
    {
        $this->assertInstanceOf(DomainEvent::class, $this->discountRequested());
    }

    public function test_discount_approved_implements_domain_event(): void
    {
        $this->assertInstanceOf(DomainEvent::class, $this->discountApproved());
    }

    public function test_discount_rejected_implements_domain_event(): void
    {
        $this->assertInstanceOf(DomainEvent::class, $this->discountRejected());
    }

    // ── eventName() ──────────────────────────────────────────────────────────

    public function test_discount_requested_event_name(): void
    {
        $this->assertSame('pos.discount.requested', $this->discountRequested()->eventName());
    }

    public function test_discount_approved_event_name(): void
    {
        $this->assertSame('pos.discount.approved', $this->discountApproved()->eventName());
    }

    public function test_discount_rejected_event_name(): void
    {
        $this->assertSame('pos.discount.rejected', $this->discountRejected()->eventName());
    }

    // ── eventVersion() ───────────────────────────────────────────────────────

    public function test_all_events_are_version_1(): void
    {
        $this->assertSame(1, $this->discountRequested()->eventVersion());
        $this->assertSame(1, $this->discountApproved()->eventVersion());
        $this->assertSame(1, $this->discountRejected()->eventVersion());
    }

    // ── occurredAt() UTC ─────────────────────────────────────────────────────

    public function test_all_events_have_utc_occurred_at(): void
    {
        $events = [
            $this->discountRequested(),
            $this->discountApproved(),
            $this->discountRejected(),
        ];
        foreach ($events as $event) {
            $this->assertSame('UTC', $event->occurredAt()->getTimezone()->getName());
        }
    }

    // ── unique event IDs ─────────────────────────────────────────────────────

    public function test_discount_requested_generates_unique_event_ids(): void
    {
        $a = $this->discountRequested();
        $b = $this->discountRequested();
        $this->assertNotSame($a->eventId(), $b->eventId());
    }

    // ── toArray() required keys ───────────────────────────────────────────────

    public function test_discount_requested_to_array_keys(): void
    {
        $data = $this->discountRequested()->toArray();
        foreach (['event_id', 'event_name', 'occurred_at', 'event_version', 'correlation_id',
            'discount_id', 'cashier_id', 'scope', 'discount_type',
            'raw_value', 'currency', 'requires_approval'] as $key) {
            $this->assertArrayHasKey($key, $data, "Missing key: $key");
        }
    }

    public function test_discount_approved_to_array_keys(): void
    {
        $data = $this->discountApproved()->toArray();
        foreach (['event_id', 'event_name', 'occurred_at', 'discount_id',
            'cashier_id', 'supervisor_id', 'auto_approved'] as $key) {
            $this->assertArrayHasKey($key, $data, "Missing key: $key");
        }
    }

    public function test_discount_rejected_to_array_keys(): void
    {
        $data = $this->discountRejected()->toArray();
        foreach (['event_id', 'event_name', 'occurred_at', 'discount_id',
            'cashier_id', 'supervisor_id', 'reason'] as $key) {
            $this->assertArrayHasKey($key, $data, "Missing key: $key");
        }
    }

    // ── payload correctness ───────────────────────────────────────────────────

    public function test_discount_approved_auto_flag_is_true(): void
    {
        $event = DiscountApproved::now('d-1', 'c-1', null, true);
        $this->assertTrue($event->autoApproved);
        $this->assertNull($event->supervisorId);
    }

    public function test_discount_approved_manual_flag_is_false(): void
    {
        $event = DiscountApproved::now('d-1', 'c-1', 'mgr-1', false);
        $this->assertFalse($event->autoApproved);
        $this->assertSame('mgr-1', $event->supervisorId);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function discountRequested(): DiscountRequested
    {
        return DiscountRequested::now('d-1', 'c-1', 'line_item', 'percentage', '10.0000', null, false);
    }

    private function discountApproved(): DiscountApproved
    {
        return DiscountApproved::now('d-1', 'c-1', 'mgr-1', false);
    }

    private function discountRejected(): DiscountRejected
    {
        return DiscountRejected::now('d-1', 'c-1', 'mgr-1', 'Too large');
    }
}
