<?php

declare(strict_types=1);

namespace Tests\Unit\POS\Discount;

use Modules\POS\Discount\Domain\Exceptions\InvalidDiscountException;
use Modules\POS\Discount\Domain\ValueObjects\DiscountLimit;
use Modules\POS\Discount\Domain\ValueObjects\DiscountValue;
use Modules\POS\Shared\Domain\ValueObjects\Money;
use Modules\POS\Shared\Domain\ValueObjects\Percentage;
use PHPUnit\Framework\TestCase;

final class DiscountLimitTest extends TestCase
{
    // ── unlimited() ───────────────────────────────────────────────────────────

    public function test_unlimited_has_no_constraints(): void
    {
        $limit = DiscountLimit::unlimited();
        $this->assertNull($limit->maxPercentage);
        $this->assertNull($limit->maxFixedAmount);
    }

    public function test_unlimited_allows_any_percentage(): void
    {
        $limit = DiscountLimit::unlimited();
        $value = DiscountValue::percentage(Percentage::of('99'));
        $limit->validate($value); // no exception
        $this->assertTrue($limit->isWithin($value));
    }

    public function test_unlimited_allows_any_fixed_amount(): void
    {
        $limit = DiscountLimit::unlimited();
        $value = DiscountValue::fixed(Money::of('9999.99', 'EGP'));
        $limit->validate($value); // no exception
        $this->assertTrue($limit->isWithin($value));
    }

    // ── percentageOnly() ──────────────────────────────────────────────────────

    public function test_percentage_only_within_limit(): void
    {
        $limit = DiscountLimit::percentageOnly(Percentage::of('20'));
        $value = DiscountValue::percentage(Percentage::of('10'));
        $limit->validate($value);
        $this->assertTrue($limit->isWithin($value));
    }

    public function test_percentage_only_at_exact_limit(): void
    {
        $limit = DiscountLimit::percentageOnly(Percentage::of('20'));
        $value = DiscountValue::percentage(Percentage::of('20'));
        $limit->validate($value);
        $this->assertTrue($limit->isWithin($value));
    }

    public function test_percentage_only_exceeds_limit(): void
    {
        $limit = DiscountLimit::percentageOnly(Percentage::of('20'));
        $value = DiscountValue::percentage(Percentage::of('25'));
        $this->expectException(InvalidDiscountException::class);
        $limit->validate($value);
    }

    public function test_percentage_limit_does_not_constrain_fixed_amount(): void
    {
        $limit = DiscountLimit::percentageOnly(Percentage::of('20'));
        $value = DiscountValue::fixed(Money::of('9999.00', 'EGP'));
        $limit->validate($value); // no exception — no fixed constraint set
        $this->assertTrue($limit->isWithin($value));
    }

    // ── fixedOnly() ───────────────────────────────────────────────────────────

    public function test_fixed_only_within_limit(): void
    {
        $limit = DiscountLimit::fixedOnly(Money::of('100.00', 'EGP'));
        $value = DiscountValue::fixed(Money::of('50.00', 'EGP'));
        $limit->validate($value);
        $this->assertTrue($limit->isWithin($value));
    }

    public function test_fixed_only_at_exact_limit(): void
    {
        $limit = DiscountLimit::fixedOnly(Money::of('100.00', 'EGP'));
        $value = DiscountValue::fixed(Money::of('100.00', 'EGP'));
        $limit->validate($value);
        $this->assertTrue($limit->isWithin($value));
    }

    public function test_fixed_only_exceeds_limit(): void
    {
        $limit = DiscountLimit::fixedOnly(Money::of('100.00', 'EGP'));
        $value = DiscountValue::fixed(Money::of('150.00', 'EGP'));
        $this->expectException(InvalidDiscountException::class);
        $limit->validate($value);
    }

    public function test_fixed_limit_does_not_constrain_percentage(): void
    {
        $limit = DiscountLimit::fixedOnly(Money::of('100.00', 'EGP'));
        $value = DiscountValue::percentage(Percentage::of('99'));
        $limit->validate($value); // no exception
        $this->assertTrue($limit->isWithin($value));
    }

    // ── both() ────────────────────────────────────────────────────────────────

    public function test_both_validates_percentage_dimension(): void
    {
        $limit = DiscountLimit::both(Percentage::of('15'), Money::of('200.00', 'EGP'));
        $value = DiscountValue::percentage(Percentage::of('20'));
        $this->expectException(InvalidDiscountException::class);
        $limit->validate($value);
    }

    public function test_both_validates_fixed_dimension(): void
    {
        $limit = DiscountLimit::both(Percentage::of('15'), Money::of('200.00', 'EGP'));
        $value = DiscountValue::fixed(Money::of('250.00', 'EGP'));
        $this->expectException(InvalidDiscountException::class);
        $limit->validate($value);
    }

    // ── isWithin() ────────────────────────────────────────────────────────────

    public function test_is_within_returns_false_when_exceeds(): void
    {
        $limit = DiscountLimit::percentageOnly(Percentage::of('10'));
        $value = DiscountValue::percentage(Percentage::of('50'));
        $this->assertFalse($limit->isWithin($value));
    }

    // ── toArray / fromArray round-trip ────────────────────────────────────────

    public function test_unlimited_round_trip(): void
    {
        $original = DiscountLimit::unlimited();
        $restored = DiscountLimit::fromArray($original->toArray());
        $this->assertNull($restored->maxPercentage);
        $this->assertNull($restored->maxFixedAmount);
    }

    public function test_percentage_only_round_trip(): void
    {
        $original = DiscountLimit::percentageOnly(Percentage::of('25'));
        $restored = DiscountLimit::fromArray($original->toArray());
        $this->assertNotNull($restored->maxPercentage);
        $this->assertTrue(Percentage::of('25')->equals($restored->maxPercentage));
    }

    public function test_fixed_only_round_trip(): void
    {
        $original = DiscountLimit::fixedOnly(Money::of('500.00', 'EGP'));
        $restored = DiscountLimit::fromArray($original->toArray());
        $this->assertNotNull($restored->maxFixedAmount);
        $this->assertTrue(Money::of('500.00', 'EGP')->equals($restored->maxFixedAmount));
    }
}
