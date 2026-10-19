<?php

declare(strict_types=1);

namespace Tests\Unit\POS\Promotion;

use Modules\POS\Promotion\Domain\Events\PromotionActivated;
use Modules\POS\Promotion\Domain\Events\PromotionCancelled;
use Modules\POS\Promotion\Domain\Events\PromotionCreated;
use Modules\POS\Promotion\Domain\Events\PromotionExpired;
use Modules\POS\Promotion\Domain\Events\PromotionPaused;
use Modules\POS\Shared\Domain\Contracts\DomainEvent;
use PHPUnit\Framework\TestCase;

final class PromotionDomainEventsTest extends TestCase
{
    // ── PromotionCreated ──────────────────────────────────────────────────────

    public function test_promotion_created_implements_domain_event(): void
    {
        $event = $this->makeCreated();
        $this->assertInstanceOf(DomainEvent::class, $event);
    }

    public function test_promotion_created_event_name(): void
    {
        $this->assertSame('pos.promotion.created', $this->makeCreated()->eventName());
    }

    public function test_promotion_created_event_version(): void
    {
        $this->assertSame(1, $this->makeCreated()->eventVersion());
    }

    public function test_promotion_created_occurred_at_is_utc(): void
    {
        $event = $this->makeCreated();
        $this->assertSame('UTC', $event->occurredAt()->getTimezone()->getName());
    }

    public function test_promotion_created_event_id_is_unique(): void
    {
        $a = $this->makeCreated();
        $b = $this->makeCreated();
        $this->assertNotSame($a->eventId(), $b->eventId());
    }

    public function test_promotion_created_to_array_keys(): void
    {
        $data = $this->makeCreated()->toArray();
        foreach (['event_id', 'event_name', 'occurred_at', 'event_version', 'correlation_id',
            'promotion_id', 'name', 'status', 'condition_count', 'reward_type',
            'valid_from', 'valid_until', 'max_uses', 'priority'] as $key) {
            $this->assertArrayHasKey($key, $data, "Missing key: $key");
        }
    }

    public function test_promotion_created_carries_payload(): void
    {
        $event = PromotionCreated::now(
            promotionId: 'promo-001',
            name: 'Summer Sale',
            status: 'draft',
            conditionCount: 2,
            rewardType: 'percentage_discount',
            validFrom: '2026-07-01T00:00:00+00:00',
            validUntil: '2026-07-31T23:59:59+00:00',
            maxUses: 100,
            priority: 5,
        );

        $this->assertSame('promo-001', $event->promotionId);
        $this->assertSame('Summer Sale', $event->name);
        $this->assertSame('draft', $event->status);
        $this->assertSame(2, $event->conditionCount);
        $this->assertSame('percentage_discount', $event->rewardType);
        $this->assertSame(100, $event->maxUses);
        $this->assertSame(5, $event->priority);
    }

    // ── PromotionActivated ────────────────────────────────────────────────────

    public function test_promotion_activated_implements_domain_event(): void
    {
        $this->assertInstanceOf(DomainEvent::class, $this->makeActivated());
    }

    public function test_promotion_activated_event_name(): void
    {
        $this->assertSame('pos.promotion.activated', $this->makeActivated()->eventName());
    }

    public function test_promotion_activated_event_version(): void
    {
        $this->assertSame(1, $this->makeActivated()->eventVersion());
    }

    public function test_promotion_activated_occurred_at_is_utc(): void
    {
        $this->assertSame('UTC', $this->makeActivated()->occurredAt()->getTimezone()->getName());
    }

    public function test_promotion_activated_event_ids_unique(): void
    {
        $this->assertNotSame($this->makeActivated()->eventId(), $this->makeActivated()->eventId());
    }

    public function test_promotion_activated_to_array_keys(): void
    {
        $data = $this->makeActivated()->toArray();
        foreach (['event_id', 'event_name', 'occurred_at', 'event_version', 'correlation_id',
            'promotion_id', 'name', 'activated_at'] as $key) {
            $this->assertArrayHasKey($key, $data, "Missing key: $key");
        }
    }

    // ── PromotionPaused ───────────────────────────────────────────────────────

    public function test_promotion_paused_implements_domain_event(): void
    {
        $this->assertInstanceOf(DomainEvent::class, $this->makePaused());
    }

    public function test_promotion_paused_event_name(): void
    {
        $this->assertSame('pos.promotion.paused', $this->makePaused()->eventName());
    }

    public function test_promotion_paused_event_version(): void
    {
        $this->assertSame(1, $this->makePaused()->eventVersion());
    }

    public function test_promotion_paused_to_array_keys(): void
    {
        $data = $this->makePaused()->toArray();
        foreach (['event_id', 'event_name', 'occurred_at', 'event_version',
            'promotion_id', 'name', 'paused_at'] as $key) {
            $this->assertArrayHasKey($key, $data, "Missing key: $key");
        }
    }

    // ── PromotionExpired ──────────────────────────────────────────────────────

    public function test_promotion_expired_implements_domain_event(): void
    {
        $this->assertInstanceOf(DomainEvent::class, $this->makeExpired());
    }

    public function test_promotion_expired_event_name(): void
    {
        $this->assertSame('pos.promotion.expired', $this->makeExpired()->eventName());
    }

    public function test_promotion_expired_event_version(): void
    {
        $this->assertSame(1, $this->makeExpired()->eventVersion());
    }

    public function test_promotion_expired_carries_total_uses(): void
    {
        $event = PromotionExpired::now(
            promotionId: 'promo-1',
            name: 'Old Sale',
            totalUses: 42,
            expiredAt: '2026-07-31T23:59:59+00:00',
        );
        $data = $event->toArray();
        $this->assertSame(42, $data['total_uses']);
    }

    public function test_promotion_expired_to_array_keys(): void
    {
        $data = $this->makeExpired()->toArray();
        foreach (['event_id', 'event_name', 'occurred_at', 'event_version',
            'promotion_id', 'name', 'total_uses', 'expired_at'] as $key) {
            $this->assertArrayHasKey($key, $data, "Missing key: $key");
        }
    }

    // ── PromotionCancelled ────────────────────────────────────────────────────

    public function test_promotion_cancelled_implements_domain_event(): void
    {
        $this->assertInstanceOf(DomainEvent::class, $this->makeCancelled());
    }

    public function test_promotion_cancelled_event_name(): void
    {
        $this->assertSame('pos.promotion.cancelled', $this->makeCancelled()->eventName());
    }

    public function test_promotion_cancelled_event_version(): void
    {
        $this->assertSame(1, $this->makeCancelled()->eventVersion());
    }

    public function test_promotion_cancelled_reason_can_be_null(): void
    {
        $event = PromotionCancelled::now(
            promotionId: 'promo-1',
            name: 'Old',
            cancelledAt: '2026-07-01T12:00:00+00:00',
            reason: null,
        );
        $this->assertNull($event->toArray()['reason']);
    }

    public function test_promotion_cancelled_reason_is_stored(): void
    {
        $event = PromotionCancelled::now(
            promotionId: 'promo-1',
            name: 'Old',
            cancelledAt: '2026-07-01T12:00:00+00:00',
            reason: 'Duplicate campaign',
        );
        $this->assertSame('Duplicate campaign', $event->toArray()['reason']);
    }

    public function test_promotion_cancelled_to_array_keys(): void
    {
        $data = $this->makeCancelled()->toArray();
        foreach (['event_id', 'event_name', 'occurred_at', 'event_version',
            'promotion_id', 'name', 'cancelled_at', 'reason'] as $key) {
            $this->assertArrayHasKey($key, $data, "Missing key: $key");
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function makeCreated(): PromotionCreated
    {
        return PromotionCreated::now(
            promotionId: 'promo-test',
            name: 'Test',
            status: 'draft',
            conditionCount: 1,
            rewardType: 'percentage_discount',
            validFrom: '2026-07-01T00:00:00+00:00',
            validUntil: null,
            maxUses: null,
            priority: 0,
        );
    }

    private function makeActivated(): PromotionActivated
    {
        return PromotionActivated::now(
            promotionId: 'promo-test',
            name: 'Test',
            activatedAt: '2026-07-01T12:00:00+00:00',
        );
    }

    private function makePaused(): PromotionPaused
    {
        return PromotionPaused::now(
            promotionId: 'promo-test',
            name: 'Test',
            pausedAt: '2026-07-01T12:00:00+00:00',
        );
    }

    private function makeExpired(): PromotionExpired
    {
        return PromotionExpired::now(
            promotionId: 'promo-test',
            name: 'Test',
            totalUses: 0,
            expiredAt: '2026-07-01T12:00:00+00:00',
        );
    }

    private function makeCancelled(): PromotionCancelled
    {
        return PromotionCancelled::now(
            promotionId: 'promo-test',
            name: 'Test',
            cancelledAt: '2026-07-01T12:00:00+00:00',
            reason: null,
        );
    }
}
