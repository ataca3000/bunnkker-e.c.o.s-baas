<?php

declare(strict_types=1);

namespace Tests\Unit\POS\Promotion;

use InvalidArgumentException;
use Modules\POS\Promotion\Domain\Enums\PromotionConditionType;
use Modules\POS\Promotion\Domain\ValueObjects\PromotionCondition;
use Modules\POS\Shared\Domain\ValueObjects\Money;
use PHPUnit\Framework\TestCase;

final class PromotionConditionTest extends TestCase
{
    // ── anyPurchase() ─────────────────────────────────────────────────────────

    public function test_any_purchase_has_correct_type(): void
    {
        $cond = PromotionCondition::anyPurchase();
        $this->assertSame(PromotionConditionType::AnyPurchase, $cond->type);
        $this->assertEmpty($cond->parameters);
    }

    // ── minimumCartTotal() ────────────────────────────────────────────────────

    public function test_minimum_cart_total_stores_amount(): void
    {
        $min = Money::of('100.00', 'EGP');
        $cond = PromotionCondition::minimumCartTotal($min);

        $this->assertSame(PromotionConditionType::MinimumCartTotal, $cond->type);
        $this->assertTrue($min->equals($cond->getMinAmount()));
    }

    public function test_minimum_cart_total_throws_on_zero(): void
    {
        $this->expectException(InvalidArgumentException::class);
        PromotionCondition::minimumCartTotal(Money::zero('EGP'));
    }

    public function test_minimum_cart_total_throws_on_negative(): void
    {
        $this->expectException(InvalidArgumentException::class);
        PromotionCondition::minimumCartTotal(Money::of('-50.00', 'EGP'));
    }

    // ── minimumQuantity() ─────────────────────────────────────────────────────

    public function test_minimum_quantity_without_product(): void
    {
        $cond = PromotionCondition::minimumQuantity(3);
        $this->assertSame(PromotionConditionType::MinimumQuantity, $cond->type);
        $this->assertSame(3, $cond->getMinQuantity());
        $this->assertNull($cond->getProductId());
    }

    public function test_minimum_quantity_with_specific_product(): void
    {
        $cond = PromotionCondition::minimumQuantity(2, 'prod-uuid-001');
        $this->assertSame(2, $cond->getMinQuantity());
        $this->assertSame('prod-uuid-001', $cond->getProductId());
    }

    public function test_minimum_quantity_throws_on_zero(): void
    {
        $this->expectException(InvalidArgumentException::class);
        PromotionCondition::minimumQuantity(0);
    }

    public function test_minimum_quantity_throws_on_negative(): void
    {
        $this->expectException(InvalidArgumentException::class);
        PromotionCondition::minimumQuantity(-1);
    }

    // ── specificProduct() ─────────────────────────────────────────────────────

    public function test_specific_product_stores_product_id(): void
    {
        $cond = PromotionCondition::specificProduct('prod-uuid-001');
        $this->assertSame(PromotionConditionType::SpecificProduct, $cond->type);
        $this->assertSame('prod-uuid-001', $cond->getProductId());
    }

    public function test_specific_product_throws_on_empty_id(): void
    {
        $this->expectException(InvalidArgumentException::class);
        PromotionCondition::specificProduct('');
    }

    // ── customerGroup() ───────────────────────────────────────────────────────

    public function test_customer_group_stores_group_id(): void
    {
        $cond = PromotionCondition::customerGroup('grp-vip');
        $this->assertSame(PromotionConditionType::CustomerGroup, $cond->type);
        $this->assertSame('grp-vip', $cond->getGroupId());
    }

    public function test_customer_group_throws_on_empty_id(): void
    {
        $this->expectException(InvalidArgumentException::class);
        PromotionCondition::customerGroup('');
    }

    // ── toArray() / fromArray() round-trips ───────────────────────────────────

    public function test_any_purchase_round_trip(): void
    {
        $original = PromotionCondition::anyPurchase();
        $restored = PromotionCondition::fromArray($original->toArray());
        $this->assertSame($original->type, $restored->type);
    }

    public function test_minimum_cart_total_round_trip(): void
    {
        $original = PromotionCondition::minimumCartTotal(Money::of('250.00', 'EGP'));
        $restored = PromotionCondition::fromArray($original->toArray());
        $this->assertSame($original->type, $restored->type);
        $this->assertTrue(Money::of('250.00', 'EGP')->equals($restored->getMinAmount()));
    }

    public function test_minimum_quantity_round_trip(): void
    {
        $original = PromotionCondition::minimumQuantity(5, 'prod-uuid-001');
        $restored = PromotionCondition::fromArray($original->toArray());
        $this->assertSame(5, $restored->getMinQuantity());
        $this->assertSame('prod-uuid-001', $restored->getProductId());
    }

    public function test_specific_product_round_trip(): void
    {
        $original = PromotionCondition::specificProduct('prod-abc');
        $restored = PromotionCondition::fromArray($original->toArray());
        $this->assertSame('prod-abc', $restored->getProductId());
    }

    public function test_customer_group_round_trip(): void
    {
        $original = PromotionCondition::customerGroup('grp-premium');
        $restored = PromotionCondition::fromArray($original->toArray());
        $this->assertSame('grp-premium', $restored->getGroupId());
    }

    public function test_to_array_contains_type_and_parameters_keys(): void
    {
        $data = PromotionCondition::anyPurchase()->toArray();
        $this->assertArrayHasKey('type', $data);
        $this->assertArrayHasKey('parameters', $data);
    }
}
