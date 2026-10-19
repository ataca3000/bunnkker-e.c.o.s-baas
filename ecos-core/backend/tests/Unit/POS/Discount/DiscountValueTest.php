<?php

declare(strict_types=1);

namespace Tests\Unit\POS\Discount;

use InvalidArgumentException;
use Modules\POS\Discount\Domain\ValueObjects\DiscountValue;
use Modules\POS\Shared\Domain\Enums\DiscountType;
use Modules\POS\Shared\Domain\ValueObjects\Money;
use Modules\POS\Shared\Domain\ValueObjects\Percentage;
use PHPUnit\Framework\TestCase;

final class DiscountValueTest extends TestCase
{
    // ── percentage() factory ─────────────────────────────────────────────────

    public function test_percentage_factory_sets_correct_type(): void
    {
        $value = DiscountValue::percentage(Percentage::of('10'));
        $this->assertSame(DiscountType::Percentage, $value->type);
        $this->assertTrue($value->isPercentage());
        $this->assertFalse($value->isFixed());
    }

    public function test_percentage_factory_stores_raw_value(): void
    {
        $value = DiscountValue::percentage(Percentage::of('10'));
        $this->assertSame('10.0000', $value->rawValue);
    }

    public function test_percentage_factory_has_null_currency(): void
    {
        $value = DiscountValue::percentage(Percentage::of('10'));
        $this->assertNull($value->currency);
    }

    // ── fixed() factory ───────────────────────────────────────────────────────

    public function test_fixed_factory_sets_correct_type(): void
    {
        $value = DiscountValue::fixed(Money::of('50.00', 'EGP'));
        $this->assertSame(DiscountType::FixedAmount, $value->type);
        $this->assertTrue($value->isFixed());
        $this->assertFalse($value->isPercentage());
    }

    public function test_fixed_factory_stores_amount_and_currency(): void
    {
        $value = DiscountValue::fixed(Money::of('75.50', 'EGP'));
        $this->assertSame('75.50', $value->rawValue);
        $this->assertSame('EGP', $value->currency);
    }

    public function test_fixed_factory_throws_on_zero_amount(): void
    {
        $this->expectException(InvalidArgumentException::class);
        DiscountValue::fixed(Money::zero('EGP'));
    }

    public function test_fixed_factory_throws_on_negative_amount(): void
    {
        $this->expectException(InvalidArgumentException::class);
        DiscountValue::fixed(Money::of('-10.00', 'EGP'));
    }

    // ── apply() — delegates to DiscountType::computeAmount ───────────────────

    public function test_apply_percentage_computes_bcmath_result(): void
    {
        $value = DiscountValue::percentage(Percentage::of('10'));
        $base = Money::of('200.00', 'EGP');
        $result = $value->apply($base);

        $this->assertSame('20.00', $result->amount);
        $this->assertSame('EGP', $result->currency);
    }

    public function test_apply_fixed_returns_fixed_amount(): void
    {
        $value = DiscountValue::fixed(Money::of('30.00', 'EGP'));
        $base = Money::of('200.00', 'EGP');
        $result = $value->apply($base);

        $this->assertSame('30.00', $result->amount);
        $this->assertSame('EGP', $result->currency);
    }

    public function test_apply_percentage_uses_bcmath_not_float(): void
    {
        // 15% of 133.33 = 19.9995 → truncated to 19.99 at scale=2 (BCMath, not float approximation)
        $value = DiscountValue::percentage(Percentage::of('15'));
        $base = Money::of('133.33', 'EGP');
        $result = $value->apply($base);

        $this->assertSame('19.99', $result->amount);
    }

    // ── asPercentage() / asFixedAmount() ─────────────────────────────────────

    public function test_as_percentage_returns_percentage_for_percentage_type(): void
    {
        $pct = Percentage::of('20');
        $value = DiscountValue::percentage($pct);
        $this->assertTrue($pct->equals($value->asPercentage()));
    }

    public function test_as_percentage_returns_null_for_fixed_type(): void
    {
        $value = DiscountValue::fixed(Money::of('50.00', 'EGP'));
        $this->assertNull($value->asPercentage());
    }

    public function test_as_fixed_amount_returns_money_for_fixed_type(): void
    {
        $amount = Money::of('40.00', 'EGP');
        $value = DiscountValue::fixed($amount);
        $this->assertTrue($amount->equals($value->asFixedAmount()));
    }

    public function test_as_fixed_amount_returns_null_for_percentage_type(): void
    {
        $value = DiscountValue::percentage(Percentage::of('10'));
        $this->assertNull($value->asFixedAmount());
    }

    // ── toArray() / fromArray() round-trip ────────────────────────────────────

    public function test_percentage_round_trip(): void
    {
        $original = DiscountValue::percentage(Percentage::of('15'));
        $restored = DiscountValue::fromArray($original->toArray());

        $this->assertSame($original->type, $restored->type);
        $this->assertSame($original->rawValue, $restored->rawValue);
        $this->assertNull($restored->currency);
    }

    public function test_fixed_round_trip(): void
    {
        $original = DiscountValue::fixed(Money::of('99.99', 'EGP'));
        $restored = DiscountValue::fromArray($original->toArray());

        $this->assertSame($original->type, $restored->type);
        $this->assertSame($original->rawValue, $restored->rawValue);
        $this->assertSame($original->currency, $restored->currency);
    }

    public function test_to_array_contains_required_keys(): void
    {
        $data = DiscountValue::percentage(Percentage::of('5'))->toArray();
        $this->assertArrayHasKey('type', $data);
        $this->assertArrayHasKey('raw_value', $data);
        $this->assertArrayHasKey('currency', $data);
    }
}
