<?php

declare(strict_types=1);

namespace Tests\Feature\POS\Promotion;

use DateTimeImmutable;
use DateTimeZone;
use InvalidArgumentException;
use Modules\POS\Promotion\Domain\Enums\PromotionStatus;
use Modules\POS\Promotion\Domain\Events\PromotionActivated;
use Modules\POS\Promotion\Domain\Events\PromotionCancelled;
use Modules\POS\Promotion\Domain\Events\PromotionCreated;
use Modules\POS\Promotion\Domain\Events\PromotionExpired;
use Modules\POS\Promotion\Domain\Events\PromotionPaused;
use Modules\POS\Promotion\Domain\Exceptions\InvalidPromotionTransitionException;
use Modules\POS\Promotion\Domain\Models\Promotion;
use Modules\POS\Promotion\Domain\ValueObjects\PromotionCondition;
use Modules\POS\Promotion\Domain\ValueObjects\PromotionReward;
use Modules\POS\Shared\Domain\ValueObjects\Percentage;
use Tests\TestCase;

final class PromotionAggregateTest extends TestCase
{
    // ── Helpers ───────────────────────────────────────────────────────────────

    private function makePromotion(
        array $conditions = [],
        ?DateTimeImmutable $validUntil = null,
        ?int $maxUses = null,
        int $priority = 0,
    ): Promotion {
        if (empty($conditions)) {
            $conditions = [PromotionCondition::anyPurchase()];
        }
        $reward = PromotionReward::percentageDiscount(Percentage::of('10'));
        $validFrom = new DateTimeImmutable('2026-07-01 00:00:00', new DateTimeZone('UTC'));

        return Promotion::create('Summer Sale', $conditions, $reward, $validFrom, $validUntil, $maxUses, $priority);
    }

    // ── create() guards ───────────────────────────────────────────────────────

    public function test_create_throws_on_empty_name(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $reward = PromotionReward::percentageDiscount(Percentage::of('10'));
        Promotion::create('', [PromotionCondition::anyPurchase()], $reward,
            new DateTimeImmutable('2026-07-01'));
    }

    public function test_create_throws_with_no_conditions(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $reward = PromotionReward::percentageDiscount(Percentage::of('10'));
        Promotion::create('Test', [], $reward, new DateTimeImmutable('2026-07-01'));
    }

    public function test_create_throws_when_condition_not_instance(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $reward = PromotionReward::percentageDiscount(Percentage::of('10'));
        Promotion::create('Test', ['not-a-condition'], $reward, new DateTimeImmutable('2026-07-01'));
    }

    public function test_create_throws_when_valid_until_not_after_valid_from(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $validFrom = new DateTimeImmutable('2026-07-01');
        $validUntil = new DateTimeImmutable('2026-07-01'); // same — not strictly after
        $reward = PromotionReward::percentageDiscount(Percentage::of('10'));
        Promotion::create('Test', [PromotionCondition::anyPurchase()], $reward, $validFrom, $validUntil);
    }

    public function test_create_throws_on_zero_max_uses(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $reward = PromotionReward::percentageDiscount(Percentage::of('10'));
        Promotion::create('Test', [PromotionCondition::anyPurchase()], $reward,
            new DateTimeImmutable('2026-07-01'), null, 0);
    }

    public function test_create_throws_on_negative_priority(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $reward = PromotionReward::percentageDiscount(Percentage::of('10'));
        Promotion::create('Test', [PromotionCondition::anyPurchase()], $reward,
            new DateTimeImmutable('2026-07-01'), null, null, -1);
    }

    // ── create() initial state ────────────────────────────────────────────────

    public function test_created_promotion_is_draft(): void
    {
        $promo = $this->makePromotion();
        $this->assertTrue($promo->isDraft());
        $this->assertSame(PromotionStatus::Draft, $promo->getStatus());
    }

    public function test_created_promotion_fires_promotion_created_event(): void
    {
        $promo = $this->makePromotion();
        $events = $promo->pullDomainEvents();

        $this->assertCount(1, $events);
        $this->assertInstanceOf(PromotionCreated::class, $events[0]);
    }

    public function test_created_promotion_use_count_is_zero(): void
    {
        $promo = $this->makePromotion();
        $promo->pullDomainEvents();
        $this->assertSame(0, $promo->use_count);
    }

    public function test_created_promotion_has_unlimited_uses_by_default(): void
    {
        $promo = $this->makePromotion();
        $this->assertTrue($promo->hasRemainingUses());
        $this->assertNull($promo->getRemainingUses());
    }

    public function test_created_promotion_with_max_uses(): void
    {
        $promo = $this->makePromotion(maxUses: 5);
        $this->assertSame(5, $promo->getRemainingUses());
    }

    public function test_priority_stored_correctly(): void
    {
        $promo = $this->makePromotion(priority: 10);
        $this->assertSame(10, $promo->priority);
    }

    // ── activate() ────────────────────────────────────────────────────────────

    public function test_draft_promotion_can_be_activated(): void
    {
        $promo = $this->makePromotion();
        $promo->pullDomainEvents();
        $promo->activate();

        $this->assertTrue($promo->isActive());
    }

    public function test_activate_fires_promotion_activated_event(): void
    {
        $promo = $this->makePromotion();
        $promo->pullDomainEvents();
        $promo->activate();

        $events = $promo->pullDomainEvents();
        $this->assertCount(1, $events);
        $this->assertInstanceOf(PromotionActivated::class, $events[0]);
    }

    public function test_paused_promotion_can_be_activated(): void
    {
        $promo = $this->makePromotion();
        $promo->pullDomainEvents();
        $promo->activate();
        $promo->pullDomainEvents();
        $promo->pause();
        $promo->pullDomainEvents();
        $promo->activate();

        $this->assertTrue($promo->isActive());
    }

    public function test_active_promotion_cannot_be_activated_again(): void
    {
        $this->expectException(InvalidPromotionTransitionException::class);
        $promo = $this->makePromotion();
        $promo->activate();
        $promo->activate();
    }

    public function test_terminal_promotion_cannot_be_activated(): void
    {
        $this->expectException(InvalidPromotionTransitionException::class);
        $promo = $this->makePromotion();
        $promo->activate();
        $promo->expire();
        $promo->activate();
    }

    // ── pause() ───────────────────────────────────────────────────────────────

    public function test_active_promotion_can_be_paused(): void
    {
        $promo = $this->makePromotion();
        $promo->activate();
        $promo->pullDomainEvents();
        $promo->pause();

        $this->assertTrue($promo->isPaused());
    }

    public function test_pause_fires_promotion_paused_event(): void
    {
        $promo = $this->makePromotion();
        $promo->activate();
        $promo->pullDomainEvents();
        $promo->pause();

        $events = $promo->pullDomainEvents();
        $this->assertCount(1, $events);
        $this->assertInstanceOf(PromotionPaused::class, $events[0]);
    }

    public function test_draft_promotion_cannot_be_paused(): void
    {
        $this->expectException(InvalidPromotionTransitionException::class);
        $promo = $this->makePromotion();
        $promo->pause();
    }

    // ── expire() ──────────────────────────────────────────────────────────────

    public function test_active_promotion_can_expire(): void
    {
        $promo = $this->makePromotion();
        $promo->activate();
        $promo->pullDomainEvents();
        $promo->expire();

        $this->assertTrue($promo->isExpired());
        $this->assertTrue($promo->isTerminal());
    }

    public function test_paused_promotion_can_expire(): void
    {
        $promo = $this->makePromotion();
        $promo->activate();
        $promo->pause();
        $promo->pullDomainEvents();
        $promo->expire();

        $this->assertTrue($promo->isExpired());
    }

    public function test_expire_fires_promotion_expired_event(): void
    {
        $promo = $this->makePromotion();
        $promo->activate();
        $promo->pullDomainEvents();
        $promo->expire();

        $events = $promo->pullDomainEvents();
        $this->assertCount(1, $events);
        $this->assertInstanceOf(PromotionExpired::class, $events[0]);
    }

    public function test_draft_promotion_cannot_expire(): void
    {
        $this->expectException(InvalidPromotionTransitionException::class);
        $promo = $this->makePromotion();
        $promo->expire();
    }

    // ── cancel() ──────────────────────────────────────────────────────────────

    public function test_draft_promotion_can_be_cancelled(): void
    {
        $promo = $this->makePromotion();
        $promo->pullDomainEvents();
        $promo->cancel('Admin decision');

        $this->assertTrue($promo->isCancelled());
        $this->assertTrue($promo->isTerminal());
        $this->assertSame('Admin decision', $promo->cancelled_reason);
    }

    public function test_active_promotion_can_be_cancelled(): void
    {
        $promo = $this->makePromotion();
        $promo->activate();
        $promo->pullDomainEvents();
        $promo->cancel();

        $this->assertTrue($promo->isCancelled());
    }

    public function test_cancel_fires_promotion_cancelled_event(): void
    {
        $promo = $this->makePromotion();
        $promo->pullDomainEvents();
        $promo->cancel('Reason');

        $events = $promo->pullDomainEvents();
        $this->assertCount(1, $events);
        $this->assertInstanceOf(PromotionCancelled::class, $events[0]);
    }

    public function test_expired_promotion_cannot_be_cancelled(): void
    {
        $this->expectException(InvalidPromotionTransitionException::class);
        $promo = $this->makePromotion();
        $promo->activate();
        $promo->expire();
        $promo->cancel();
    }

    // ── recordUse() ───────────────────────────────────────────────────────────

    public function test_record_use_increments_use_count(): void
    {
        $promo = $this->makePromotion(maxUses: 3);
        $promo->activate();
        $promo->recordUse();

        $this->assertSame(1, $promo->use_count);
        $this->assertSame(2, $promo->getRemainingUses());
    }

    public function test_record_use_throws_when_not_active(): void
    {
        $this->expectException(InvalidPromotionTransitionException::class);
        $promo = $this->makePromotion();
        $promo->recordUse(); // Draft
    }

    public function test_remaining_uses_reaches_zero(): void
    {
        $promo = $this->makePromotion(maxUses: 2);
        $promo->activate();
        $promo->recordUse();
        $promo->recordUse();

        $this->assertFalse($promo->hasRemainingUses());
        $this->assertSame(0, $promo->getRemainingUses());
    }

    // ── isExpiredByDate() ─────────────────────────────────────────────────────

    public function test_is_expired_by_date_when_past_valid_until(): void
    {
        // validFrom = 2026-07-01 00:00:00; validUntil must be strictly after validFrom
        $validUntil = new DateTimeImmutable('2026-07-01 06:00:00', new DateTimeZone('UTC'));
        $promo = $this->makePromotion(validUntil: $validUntil);
        // pass a "now" that is past validUntil
        $now = new DateTimeImmutable('2026-07-01 12:00:00', new DateTimeZone('UTC'));

        $this->assertTrue($promo->isExpiredByDate($now));
    }

    public function test_not_expired_by_date_before_valid_until(): void
    {
        $validUntil = new DateTimeImmutable('2026-07-31 23:59:59', new DateTimeZone('UTC'));
        $promo = $this->makePromotion(validUntil: $validUntil);
        $now = new DateTimeImmutable('2026-07-01 12:00:00', new DateTimeZone('UTC'));

        $this->assertFalse($promo->isExpiredByDate($now));
    }

    public function test_no_valid_until_never_expired_by_date(): void
    {
        $promo = $this->makePromotion(); // no validUntil
        $far = new DateTimeImmutable('2099-12-31', new DateTimeZone('UTC'));

        $this->assertFalse($promo->isExpiredByDate($far));
    }

    // ── getConditions() / getReward() ─────────────────────────────────────────

    public function test_get_conditions_returns_promotion_condition_instances(): void
    {
        $conds = [PromotionCondition::anyPurchase(), PromotionCondition::minimumQuantity(2)];
        $promo = $this->makePromotion(conditions: $conds);

        $retrieved = $promo->getConditions();
        $this->assertCount(2, $retrieved);
        foreach ($retrieved as $c) {
            $this->assertInstanceOf(PromotionCondition::class, $c);
        }
    }

    public function test_get_reward_returns_promotion_reward_instance(): void
    {
        $promo = $this->makePromotion();
        $this->assertInstanceOf(PromotionReward::class, $promo->getReward());
    }

    // ── pullDomainEvents() clears the queue ───────────────────────────────────

    public function test_pull_domain_events_clears_queue(): void
    {
        $promo = $this->makePromotion();
        $promo->pullDomainEvents(); // clear create event
        $this->assertEmpty($promo->pullDomainEvents());
    }
}
