<?php

declare(strict_types=1);

namespace Tests\Unit\POS\Promotion;

use DateTimeImmutable;
use DateTimeZone;
use Modules\POS\Promotion\Domain\Models\Promotion;
use Modules\POS\Promotion\Domain\Policies\PromotionEligibilityPolicy;
use Modules\POS\Promotion\Domain\ValueObjects\PromotionCondition;
use Modules\POS\Promotion\Domain\ValueObjects\PromotionContext;
use Modules\POS\Promotion\Domain\ValueObjects\PromotionReward;
use Modules\POS\Shared\Domain\ValueObjects\Money;
use Modules\POS\Shared\Domain\ValueObjects\Percentage;
use PHPUnit\Framework\TestCase;

final class PromotionEligibilityPolicyTest extends TestCase
{
    private PromotionEligibilityPolicy $policy;

    private DateTimeImmutable $now;

    protected function setUp(): void
    {
        parent::setUp();
        $this->policy = new PromotionEligibilityPolicy;
        $this->now = new DateTimeImmutable('2026-07-01 12:00:00', new DateTimeZone('UTC'));
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function makeActivePromotion(
        array $conditions,
        ?DateTimeImmutable $validUntil = null,
        ?int $maxUses = null,
    ): Promotion {
        $reward = PromotionReward::percentageDiscount(Percentage::of('10'));
        $validFrom = new DateTimeImmutable('2026-07-01 00:00:00', new DateTimeZone('UTC'));
        $promo = Promotion::create('Test Promo', $conditions, $reward, $validFrom, $validUntil, $maxUses);
        $promo->activate();
        $promo->pullDomainEvents(); // clear events

        return $promo;
    }

    private function baseContext(
        string $cartTotal = '200.00',
        array $items = [],
        ?string $customerId = null,
        array $groups = [],
    ): PromotionContext {
        return PromotionContext::of(
            cartTotal: Money::of($cartTotal, 'EGP'),
            items: $items,
            customerId: $customerId,
            customerGroups: $groups,
            evaluatedAt: $this->now,
        );
    }

    // ── Lifecycle gate ────────────────────────────────────────────────────────

    public function test_inactive_promotion_is_not_eligible(): void
    {
        $reward = PromotionReward::percentageDiscount(Percentage::of('10'));
        $from = new DateTimeImmutable('2026-07-01 00:00:00', new DateTimeZone('UTC'));
        $promo = Promotion::create('Draft Promo', [PromotionCondition::anyPurchase()], $reward, $from);
        // still Draft — never activated

        $this->assertFalse($this->policy->isEligible($promo, $this->baseContext()));
    }

    public function test_paused_promotion_is_not_eligible(): void
    {
        $promo = $this->makeActivePromotion([PromotionCondition::anyPurchase()]);
        $promo->pause();

        $this->assertFalse($this->policy->isEligible($promo, $this->baseContext()));
    }

    // ── Date-range gates ──────────────────────────────────────────────────────

    public function test_before_valid_from_is_not_eligible(): void
    {
        $future = new DateTimeImmutable('2026-08-01 00:00:00', new DateTimeZone('UTC'));
        $reward = PromotionReward::percentageDiscount(Percentage::of('10'));
        $promo = Promotion::create('Future', [PromotionCondition::anyPurchase()], $reward, $future);
        $promo->activate();

        $this->assertFalse($this->policy->isEligible($promo, $this->baseContext()));
    }

    public function test_after_valid_until_is_not_eligible(): void
    {
        // validFrom = 2026-07-01 00:00:00; validUntil must be after that but before $this->now (12:00:00)
        $earlyMorning = new DateTimeImmutable('2026-07-01 06:00:00', new DateTimeZone('UTC'));
        $promo = $this->makeActivePromotion([PromotionCondition::anyPurchase()], validUntil: $earlyMorning);
        // $this->now is 2026-07-01 12:00:00, which is past validUntil

        $this->assertFalse($this->policy->isEligible($promo, $this->baseContext()));
    }

    public function test_within_date_range_is_eligible(): void
    {
        $tomorrow = new DateTimeImmutable('2026-07-02 00:00:00', new DateTimeZone('UTC'));
        $promo = $this->makeActivePromotion([PromotionCondition::anyPurchase()], validUntil: $tomorrow);

        $this->assertTrue($this->policy->isEligible($promo, $this->baseContext()));
    }

    public function test_no_valid_until_is_always_within_range(): void
    {
        $promo = $this->makeActivePromotion([PromotionCondition::anyPurchase()]);
        $this->assertTrue($this->policy->isEligible($promo, $this->baseContext()));
    }

    // ── Use-count gate ────────────────────────────────────────────────────────

    public function test_max_uses_exhausted_is_not_eligible(): void
    {
        $promo = $this->makeActivePromotion([PromotionCondition::anyPurchase()], maxUses: 1);
        $promo->recordUse(); // use_count = 1, max_uses = 1 → exhausted

        $this->assertFalse($this->policy->isEligible($promo, $this->baseContext()));
    }

    public function test_max_uses_not_exhausted_is_eligible(): void
    {
        $promo = $this->makeActivePromotion([PromotionCondition::anyPurchase()], maxUses: 3);
        $promo->recordUse();

        $this->assertTrue($this->policy->isEligible($promo, $this->baseContext()));
    }

    public function test_unlimited_uses_always_eligible(): void
    {
        $promo = $this->makeActivePromotion([PromotionCondition::anyPurchase()], maxUses: null);

        for ($i = 0; $i < 100; $i++) {
            $promo->recordUse();
        }

        $this->assertTrue($this->policy->isEligible($promo, $this->baseContext()));
    }

    // ── AnyPurchase condition ─────────────────────────────────────────────────

    public function test_any_purchase_condition_always_satisfied(): void
    {
        $promo = $this->makeActivePromotion([PromotionCondition::anyPurchase()]);
        $ctx = $this->baseContext(cartTotal: '0.01');

        $this->assertTrue($this->policy->isEligible($promo, $ctx));
    }

    // ── MinimumCartTotal condition ────────────────────────────────────────────

    public function test_minimum_cart_total_met_is_eligible(): void
    {
        $promo = $this->makeActivePromotion([PromotionCondition::minimumCartTotal(Money::of('100.00', 'EGP'))]);
        $ctx = $this->baseContext(cartTotal: '100.00'); // exactly equal → >=

        $this->assertTrue($this->policy->isEligible($promo, $ctx));
    }

    public function test_minimum_cart_total_not_met_is_not_eligible(): void
    {
        $promo = $this->makeActivePromotion([PromotionCondition::minimumCartTotal(Money::of('500.00', 'EGP'))]);
        $ctx = $this->baseContext(cartTotal: '499.99');

        $this->assertFalse($this->policy->isEligible($promo, $ctx));
    }

    // ── MinimumQuantity condition ─────────────────────────────────────────────

    public function test_minimum_quantity_total_met(): void
    {
        $promo = $this->makeActivePromotion([PromotionCondition::minimumQuantity(3)]);
        $ctx = $this->baseContext(items: [
            ['product_id' => 'p1', 'quantity' => 2],
            ['product_id' => 'p2', 'quantity' => 1],
        ]);

        $this->assertTrue($this->policy->isEligible($promo, $ctx));
    }

    public function test_minimum_quantity_total_not_met(): void
    {
        $promo = $this->makeActivePromotion([PromotionCondition::minimumQuantity(5)]);
        $ctx = $this->baseContext(items: [
            ['product_id' => 'p1', 'quantity' => 2],
        ]);

        $this->assertFalse($this->policy->isEligible($promo, $ctx));
    }

    public function test_minimum_quantity_for_specific_product_met(): void
    {
        $promo = $this->makeActivePromotion([PromotionCondition::minimumQuantity(2, 'p1')]);
        $ctx = $this->baseContext(items: [
            ['product_id' => 'p1', 'quantity' => 2],
            ['product_id' => 'p2', 'quantity' => 10],
        ]);

        $this->assertTrue($this->policy->isEligible($promo, $ctx));
    }

    public function test_minimum_quantity_for_specific_product_not_met(): void
    {
        $promo = $this->makeActivePromotion([PromotionCondition::minimumQuantity(3, 'p1')]);
        $ctx = $this->baseContext(items: [
            ['product_id' => 'p1', 'quantity' => 2],
            ['product_id' => 'p2', 'quantity' => 10], // total is 12, but only 2 of p1
        ]);

        $this->assertFalse($this->policy->isEligible($promo, $ctx));
    }

    // ── SpecificProduct condition ─────────────────────────────────────────────

    public function test_specific_product_present_is_eligible(): void
    {
        $promo = $this->makeActivePromotion([PromotionCondition::specificProduct('prod-001')]);
        $ctx = $this->baseContext(items: [['product_id' => 'prod-001', 'quantity' => 1]]);

        $this->assertTrue($this->policy->isEligible($promo, $ctx));
    }

    public function test_specific_product_absent_is_not_eligible(): void
    {
        $promo = $this->makeActivePromotion([PromotionCondition::specificProduct('prod-001')]);
        $ctx = $this->baseContext(items: [['product_id' => 'prod-999', 'quantity' => 3]]);

        $this->assertFalse($this->policy->isEligible($promo, $ctx));
    }

    // ── CustomerGroup condition ───────────────────────────────────────────────

    public function test_customer_in_group_is_eligible(): void
    {
        $promo = $this->makeActivePromotion([PromotionCondition::customerGroup('vip')]);
        $ctx = $this->baseContext(customerId: 'cust-1', groups: ['vip', 'loyalty']);

        $this->assertTrue($this->policy->isEligible($promo, $ctx));
    }

    public function test_customer_not_in_group_is_not_eligible(): void
    {
        $promo = $this->makeActivePromotion([PromotionCondition::customerGroup('vip')]);
        $ctx = $this->baseContext(customerId: 'cust-1', groups: ['standard']);

        $this->assertFalse($this->policy->isEligible($promo, $ctx));
    }

    // ── AND logic across multiple conditions ──────────────────────────────────

    public function test_all_conditions_must_be_satisfied(): void
    {
        $promo = $this->makeActivePromotion([
            PromotionCondition::minimumCartTotal(Money::of('100.00', 'EGP')),
            PromotionCondition::specificProduct('prod-001'),
        ]);
        // Meets cart total but not product condition
        $ctx = $this->baseContext(cartTotal: '200.00', items: [['product_id' => 'prod-999', 'quantity' => 1]]);

        $this->assertFalse($this->policy->isEligible($promo, $ctx));
    }

    public function test_all_conditions_satisfied_is_eligible(): void
    {
        $promo = $this->makeActivePromotion([
            PromotionCondition::minimumCartTotal(Money::of('100.00', 'EGP')),
            PromotionCondition::specificProduct('prod-001'),
        ]);
        $ctx = $this->baseContext(cartTotal: '150.00', items: [['product_id' => 'prod-001', 'quantity' => 2]]);

        $this->assertTrue($this->policy->isEligible($promo, $ctx));
    }

    // ── getSatisfied / getUnsatisfied ─────────────────────────────────────────

    public function test_get_satisfied_conditions(): void
    {
        $promo = $this->makeActivePromotion([
            PromotionCondition::anyPurchase(),
            PromotionCondition::minimumCartTotal(Money::of('1000.00', 'EGP')), // not met
        ]);
        $ctx = $this->baseContext(cartTotal: '50.00');

        $satisfied = $this->policy->getSatisfiedConditions($promo, $ctx);
        $this->assertCount(1, $satisfied);
    }

    public function test_get_unsatisfied_conditions(): void
    {
        $promo = $this->makeActivePromotion([
            PromotionCondition::anyPurchase(),
            PromotionCondition::minimumCartTotal(Money::of('1000.00', 'EGP')), // not met
        ]);
        $ctx = $this->baseContext(cartTotal: '50.00');

        $unsatisfied = $this->policy->getUnsatisfiedConditions($promo, $ctx);
        $this->assertCount(1, $unsatisfied);
    }
}
