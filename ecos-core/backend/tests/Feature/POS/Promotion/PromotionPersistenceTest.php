<?php

declare(strict_types=1);

namespace Tests\Feature\POS\Promotion;

use DateTimeImmutable;
use DateTimeZone;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Modules\POS\Promotion\Domain\Enums\PromotionStatus;
use Modules\POS\Promotion\Domain\Models\Promotion;
use Modules\POS\Promotion\Domain\ValueObjects\PromotionCondition;
use Modules\POS\Promotion\Domain\ValueObjects\PromotionReward;
use Modules\POS\Promotion\Infrastructure\Repositories\EloquentPromotionRepository;
use Modules\POS\Shared\Domain\ValueObjects\Money;
use Modules\POS\Shared\Domain\ValueObjects\Percentage;
use Tests\TestCase;

final class PromotionPersistenceTest extends TestCase
{
    use RefreshDatabase;

    private EloquentPromotionRepository $repo;

    protected function setUp(): void
    {
        parent::setUp();
        $this->repo = new EloquentPromotionRepository;
    }

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

        return Promotion::create('Test Promo', $conditions, $reward, $validFrom, $validUntil, $maxUses, $priority);
    }

    // ── save() / findById() ───────────────────────────────────────────────────

    public function test_save_and_find_by_id(): void
    {
        $promo = $this->makePromotion();
        $this->repo->save($promo);

        $found = $this->repo->findById((string) $promo->id);
        $this->assertNotNull($found);
        $this->assertSame((string) $promo->id, (string) $found->id);
        $this->assertSame('Test Promo', $found->name);
    }

    public function test_find_by_id_returns_null_for_unknown_id(): void
    {
        $result = $this->repo->findById('00000000-0000-0000-0000-000000000000');
        $this->assertNull($result);
    }

    // ── Status persistence ────────────────────────────────────────────────────

    public function test_draft_status_persists(): void
    {
        $promo = $this->makePromotion();
        $this->repo->save($promo);

        $found = $this->repo->findById((string) $promo->id);
        $this->assertSame(PromotionStatus::Draft, $found->getStatus());
    }

    public function test_active_status_persists(): void
    {
        $promo = $this->makePromotion();
        $promo->activate();
        $this->repo->save($promo);

        $found = $this->repo->findById((string) $promo->id);
        $this->assertTrue($found->isActive());
    }

    public function test_paused_status_persists(): void
    {
        $promo = $this->makePromotion();
        $promo->activate();
        $promo->pause();
        $this->repo->save($promo);

        $found = $this->repo->findById((string) $promo->id);
        $this->assertTrue($found->isPaused());
    }

    public function test_expired_status_persists(): void
    {
        $promo = $this->makePromotion();
        $promo->activate();
        $promo->expire();
        $this->repo->save($promo);

        $found = $this->repo->findById((string) $promo->id);
        $this->assertTrue($found->isExpired());
        $this->assertTrue($found->isTerminal());
    }

    public function test_cancelled_status_with_reason_persists(): void
    {
        $promo = $this->makePromotion();
        $promo->cancel('Duplicate');
        $this->repo->save($promo);

        $found = $this->repo->findById((string) $promo->id);
        $this->assertTrue($found->isCancelled());
        $this->assertSame('Duplicate', $found->cancelled_reason);
    }

    // ── JSONB conditions round-trip ───────────────────────────────────────────

    public function test_any_purchase_condition_roundtrips(): void
    {
        $promo = $this->makePromotion(conditions: [PromotionCondition::anyPurchase()]);
        $this->repo->save($promo);

        $found = $this->repo->findById((string) $promo->id);
        $conditions = $found->getConditions();
        $this->assertCount(1, $conditions);
        $this->assertInstanceOf(PromotionCondition::class, $conditions[0]);
    }

    public function test_minimum_cart_total_condition_roundtrips(): void
    {
        $cond = PromotionCondition::minimumCartTotal(Money::of('150.00', 'EGP'));
        $promo = $this->makePromotion(conditions: [$cond]);
        $this->repo->save($promo);

        $found = $this->repo->findById((string) $promo->id);
        $restored = $found->getConditions()[0];
        $this->assertTrue(Money::of('150.00', 'EGP')->equals($restored->getMinAmount()));
    }

    public function test_multiple_conditions_all_roundtrip(): void
    {
        $conds = [
            PromotionCondition::anyPurchase(),
            PromotionCondition::minimumQuantity(3, 'prod-001'),
            PromotionCondition::customerGroup('vip'),
        ];
        $promo = $this->makePromotion(conditions: $conds);
        $this->repo->save($promo);

        $found = $this->repo->findById((string) $promo->id);
        $this->assertCount(3, $found->getConditions());
    }

    // ── JSONB reward round-trip ───────────────────────────────────────────────

    public function test_percentage_discount_reward_roundtrips(): void
    {
        $promo = $this->makePromotion();
        $this->repo->save($promo);

        $found = $this->repo->findById((string) $promo->id);
        $reward = $found->getReward();
        $this->assertInstanceOf(PromotionReward::class, $reward);
        $this->assertTrue(Percentage::of('10')->equals($reward->getPercentage()));
    }

    public function test_free_item_reward_roundtrips(): void
    {
        $reward = PromotionReward::freeItem('prod-001', 2);
        $validFrom = new DateTimeImmutable('2026-07-01', new DateTimeZone('UTC'));
        $promo = Promotion::create('Free Item Promo', [PromotionCondition::anyPurchase()], $reward, $validFrom);
        $this->repo->save($promo);

        $found = $this->repo->findById((string) $promo->id);
        $persisted = $found->getReward();
        $this->assertSame('prod-001', $persisted->getFreeItemProductId());
        $this->assertSame(2, $persisted->getFreeItemQuantity());
    }

    // ── Scalar fields ─────────────────────────────────────────────────────────

    public function test_max_uses_and_use_count_persist(): void
    {
        $promo = $this->makePromotion(maxUses: 10);
        $promo->activate();
        $promo->recordUse();
        $promo->recordUse();
        $this->repo->save($promo);

        $found = $this->repo->findById((string) $promo->id);
        $this->assertSame(10, $found->max_uses);
        $this->assertSame(2, $found->use_count);
        $this->assertSame(8, $found->getRemainingUses());
    }

    public function test_valid_until_persists_as_null(): void
    {
        $promo = $this->makePromotion(); // no validUntil
        $this->repo->save($promo);

        $found = $this->repo->findById((string) $promo->id);
        $this->assertNull($found->getValidUntil());
    }

    public function test_valid_until_persists_correctly(): void
    {
        $until = new DateTimeImmutable('2026-12-31 23:59:59', new DateTimeZone('UTC'));
        $promo = $this->makePromotion(validUntil: $until);
        $this->repo->save($promo);

        $found = $this->repo->findById((string) $promo->id);
        $roundtrip = $found->getValidUntil();
        $this->assertNotNull($roundtrip);
        $this->assertSame('2026-12-31', $roundtrip->format('Y-m-d'));
    }

    public function test_priority_persists(): void
    {
        $promo = $this->makePromotion(priority: 7);
        $this->repo->save($promo);

        $found = $this->repo->findById((string) $promo->id);
        $this->assertSame(7, $found->priority);
    }

    // ── findAllActive() ───────────────────────────────────────────────────────

    public function test_find_all_active_returns_only_active_promotions(): void
    {
        $active1 = $this->makePromotion();
        $active1->activate();
        $this->repo->save($active1);

        $active2 = $this->makePromotion();
        $active2->activate();
        $this->repo->save($active2);

        $draft = $this->makePromotion();
        $this->repo->save($draft);

        $expired = $this->makePromotion();
        $expired->activate();
        $expired->expire();
        $this->repo->save($expired);

        $actives = $this->repo->findAllActive();
        $this->assertCount(2, $actives);
        foreach ($actives as $p) {
            $this->assertTrue($p->isActive());
        }
    }

    public function test_find_all_active_returns_empty_when_none_active(): void
    {
        $promo = $this->makePromotion();
        $this->repo->save($promo);

        $this->assertEmpty($this->repo->findAllActive());
    }

    // ── Timestamps ───────────────────────────────────────────────────────────

    public function test_created_at_and_updated_at_are_set(): void
    {
        $promo = $this->makePromotion();
        $this->repo->save($promo);

        $found = $this->repo->findById((string) $promo->id);
        $this->assertNotNull($found->created_at);
        $this->assertNotNull($found->updated_at);
    }
}
