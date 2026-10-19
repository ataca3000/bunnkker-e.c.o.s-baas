<?php

declare(strict_types=1);

namespace Tests\Unit\POS\ValueObjects;

use InvalidArgumentException;
use Modules\POS\Shared\Domain\ValueObjects\Money;
use Modules\POS\Shared\Domain\ValueObjects\Percentage;
use PHPUnit\Framework\TestCase;

/**
 * PKG-POS-002: Percentage value object unit tests.
 */
final class PercentageTest extends TestCase
{
    public function test_of_factory_normalises_to_four_decimals(): void
    {
        $pct = Percentage::of('14');

        $this->assertSame('14.0000', $pct->value);
    }

    public function test_of_fraction_factory(): void
    {
        $pct = Percentage::ofFraction('0.14');

        $this->assertSame('14.0000', $pct->value);
    }

    public function test_zero_factory(): void
    {
        $pct = Percentage::zero();

        $this->assertTrue($pct->isZero());
    }

    public function test_one_hundred_factory(): void
    {
        $pct = Percentage::oneHundred();

        $this->assertSame('100.0000', $pct->value);
    }

    public function test_rejects_negative_value(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('negative');

        Percentage::of('-1');
    }

    public function test_rejects_value_above_one_hundred(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('exceed 100');

        Percentage::of('101');
    }

    public function test_rejects_non_numeric(): void
    {
        $this->expectException(InvalidArgumentException::class);

        Percentage::of('abc');
    }

    public function test_apply_to_money(): void
    {
        $vat = Percentage::of('14');
        $base = Money::of('100.00', 'EGP');
        $result = $vat->applyTo($base);

        $this->assertSame('14.00', $result->amount);
        $this->assertSame('EGP', $result->currency);
    }

    public function test_apply_to_money_fractional_result(): void
    {
        $pct = Percentage::of('10');
        $base = Money::of('33.33', 'EGP');
        $result = $pct->applyTo($base);

        // 10% of 33.33 = 3.33 (rounded to 2 dp)
        $this->assertSame('3.33', $result->amount);
    }

    public function test_as_fraction(): void
    {
        $pct = Percentage::of('14');

        $this->assertSame('0.1400', $pct->asFraction());
    }

    public function test_add(): void
    {
        $result = Percentage::of('10')->add(Percentage::of('5'));

        $this->assertSame('15.0000', $result->value);
    }

    public function test_subtract(): void
    {
        $result = Percentage::of('20')->subtract(Percentage::of('5'));

        $this->assertSame('15.0000', $result->value);
    }

    public function test_equals(): void
    {
        $this->assertTrue(Percentage::of('14')->equals(Percentage::of('14.0000')));
        $this->assertFalse(Percentage::of('14')->equals(Percentage::of('15')));
    }

    public function test_to_string_appends_percent_sign(): void
    {
        $this->assertSame('14.0000%', (string) Percentage::of('14'));
    }

    public function test_immutability(): void
    {
        $original = Percentage::of('10');
        $original->add(Percentage::of('5'));

        $this->assertSame('10.0000', $original->value);
    }
}
