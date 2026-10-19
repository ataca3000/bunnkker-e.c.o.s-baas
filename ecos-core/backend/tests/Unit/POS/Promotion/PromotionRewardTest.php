<?php

declare(strict_types=1);

namespace Tests\Unit\POS\Promotion;

use InvalidArgumentException;
use Modules\POS\Promotion\Domain\Enums\PromotionRewardType;
use Modules\POS\Promotion\Domain\ValueObjects\PromotionReward;
use Modules\POS\Shared\Domain\ValueObjects\Money;
use Modules\POS\Shared\Domain\ValueObjects\Percentage;
use PHPUnit\Framework\TestCase;

final class PromotionRewardTest extends TestCase
{
    // ── percentageDiscount() ──────────────────────────────────────────────────

    public function test_percentage_discount_has_correct_type(): void
    {
        $reward = PromotionReward::percentageDiscount(Percentage::of('15'));
        $this->assertSame(PromotionRewardType::PercentageDiscount, $reward->type);
        $this->assertTrue($reward->type->isMonetary());
    }

    public function test_percentage_discount_default_scope_is_cart_total(): void
    {
        $reward = PromotionReward::percentageDiscount(Percentage::of('10'));
        $this->assertSame('cart_total', $reward->getScope());
    }

    public function test_percentage_discount_line_item_scope(): void
    {
        $reward = PromotionReward::percentageDiscount(Percentage::of('10'), 'line_item');
        $this->assertSame('line_item', $reward->getScope());
    }

    public function test_percentage_discount_invalid_scope_throws(): void
    {
        $this->expectException(InvalidArgumentException::class);
        PromotionReward::percentageDiscount(Percentage::of('10'), 'invalid_scope');
    }

    public function test_percentage_discount_get_percentage(): void
    {
        $pct = Percentage::of('20');
        $reward = PromotionReward::percentageDiscount($pct);
        $this->assertTrue($pct->equals($reward->getPercentage()));
    }

    // ── fixedAmountDiscount() ─────────────────────────────────────────────────

    public function test_fixed_amount_discount_has_correct_type(): void
    {
        $reward = PromotionReward::fixedAmountDiscount(Money::of('50.00', 'EGP'));
        $this->assertSame(PromotionRewardType::FixedAmountDiscount, $reward->type);
    }

    public function test_fixed_amount_discount_stores_amount(): void
    {
        $amount = Money::of('75.00', 'EGP');
        $reward = PromotionReward::fixedAmountDiscount($amount);
        $this->assertTrue($amount->equals($reward->getAmount()));
    }

    public function test_fixed_amount_throws_on_zero(): void
    {
        $this->expectException(InvalidArgumentException::class);
        PromotionReward::fixedAmountDiscount(Money::zero('EGP'));
    }

    public function test_fixed_amount_throws_on_negative(): void
    {
        $this->expectException(InvalidArgumentException::class);
        PromotionReward::fixedAmountDiscount(Money::of('-10.00', 'EGP'));
    }

    // ── freeItem() ────────────────────────────────────────────────────────────

    public function test_free_item_has_correct_type(): void
    {
        $reward = PromotionReward::freeItem('prod-uuid-001');
        $this->assertSame(PromotionRewardType::FreeItem, $reward->type);
        $this->assertFalse($reward->type->isMonetary());
    }

    public function test_free_item_stores_product_and_quantity(): void
    {
        $reward = PromotionReward::freeItem('prod-uuid-001', 2);
        $this->assertSame('prod-uuid-001', $reward->getFreeItemProductId());
        $this->assertSame(2, $reward->getFreeItemQuantity());
    }

    public function test_free_item_default_quantity_is_one(): void
    {
        $reward = PromotionReward::freeItem('prod-uuid-001');
        $this->assertSame(1, $reward->getFreeItemQuantity());
    }

    public function test_free_item_throws_on_empty_product_id(): void
    {
        $this->expectException(InvalidArgumentException::class);
        PromotionReward::freeItem('');
    }

    public function test_free_item_throws_on_zero_quantity(): void
    {
        $this->expectException(InvalidArgumentException::class);
        PromotionReward::freeItem('prod-uuid-001', 0);
    }

    // ── bundlePrice() ─────────────────────────────────────────────────────────

    public function test_bundle_price_has_correct_type(): void
    {
        $reward = PromotionReward::bundlePrice(Money::of('99.00', 'EGP'));
        $this->assertSame(PromotionRewardType::BundlePrice, $reward->type);
    }

    public function test_bundle_price_stores_price(): void
    {
        $price = Money::of('199.99', 'EGP');
        $reward = PromotionReward::bundlePrice($price);
        $this->assertTrue($price->equals($reward->getAmount()));
    }

    public function test_bundle_price_throws_on_zero(): void
    {
        $this->expectException(InvalidArgumentException::class);
        PromotionReward::bundlePrice(Money::zero('EGP'));
    }

    // ── toArray() / fromArray() round-trips ───────────────────────────────────

    public function test_percentage_discount_round_trip(): void
    {
        $original = PromotionReward::percentageDiscount(Percentage::of('25'), 'line_item');
        $restored = PromotionReward::fromArray($original->toArray());
        $this->assertSame($original->type, $restored->type);
        $this->assertSame($original->getScope(), $restored->getScope());
        $this->assertTrue(Percentage::of('25')->equals($restored->getPercentage()));
    }

    public function test_fixed_amount_round_trip(): void
    {
        $original = PromotionReward::fixedAmountDiscount(Money::of('50.00', 'EGP'));
        $restored = PromotionReward::fromArray($original->toArray());
        $this->assertTrue(Money::of('50.00', 'EGP')->equals($restored->getAmount()));
    }

    public function test_free_item_round_trip(): void
    {
        $original = PromotionReward::freeItem('prod-uuid-001', 3);
        $restored = PromotionReward::fromArray($original->toArray());
        $this->assertSame('prod-uuid-001', $restored->getFreeItemProductId());
        $this->assertSame(3, $restored->getFreeItemQuantity());
    }

    public function test_bundle_price_round_trip(): void
    {
        $original = PromotionReward::bundlePrice(Money::of('299.00', 'EGP'));
        $restored = PromotionReward::fromArray($original->toArray());
        $this->assertTrue(Money::of('299.00', 'EGP')->equals($restored->getAmount()));
    }

    public function test_to_array_contains_type_and_parameters(): void
    {
        $data = PromotionReward::freeItem('prod-1')->toArray();
        $this->assertArrayHasKey('type', $data);
        $this->assertArrayHasKey('parameters', $data);
    }
}
