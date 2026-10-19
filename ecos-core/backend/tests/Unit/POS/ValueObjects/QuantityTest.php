<?php

declare(strict_types=1);

namespace Tests\Unit\POS\ValueObjects;

use InvalidArgumentException;
use Modules\POS\Shared\Domain\ValueObjects\Quantity;
use PHPUnit\Framework\TestCase;

/**
 * PKG-POS-002: Quantity value object unit tests.
 */
final class QuantityTest extends TestCase
{
    public function test_of_factory_normalises_to_four_decimals(): void
    {
        $qty = Quantity::of('3.5');

        $this->assertSame('3.5000', $qty->value);
    }

    public function test_zero_factory(): void
    {
        $qty = Quantity::zero();

        $this->assertTrue($qty->isZero());
        $this->assertSame('0.0000', $qty->value);
    }

    public function test_one_factory(): void
    {
        $qty = Quantity::one();

        $this->assertSame('1.0000', $qty->value);
    }

    public function test_constructor_rejects_non_numeric(): void
    {
        $this->expectException(InvalidArgumentException::class);

        Quantity::of('invalid');
    }

    public function test_add(): void
    {
        $result = Quantity::of('2.5')->add(Quantity::of('1.5'));

        $this->assertSame('4.0000', $result->value);
    }

    public function test_subtract(): void
    {
        $result = Quantity::of('5.0')->subtract(Quantity::of('2.5'));

        $this->assertSame('2.5000', $result->value);
    }

    public function test_subtract_can_produce_negative(): void
    {
        $result = Quantity::of('1.0')->subtract(Quantity::of('3.0'));

        $this->assertTrue($result->isNegative());
    }

    public function test_multiply(): void
    {
        $result = Quantity::of('4.0')->multiply(2);

        $this->assertSame('8.0000', $result->value);
    }

    public function test_divide(): void
    {
        $result = Quantity::of('9.0')->divide(3);

        $this->assertSame('3.0000', $result->value);
    }

    public function test_divide_by_zero_throws(): void
    {
        $this->expectException(InvalidArgumentException::class);

        Quantity::of('5.0')->divide(0);
    }

    public function test_absolute_of_negative(): void
    {
        $result = Quantity::of('-3.0')->absolute();

        $this->assertSame('3.0000', $result->value);
        $this->assertTrue($result->isPositive());
    }

    public function test_equals(): void
    {
        $this->assertTrue(Quantity::of('5.0000')->equals(Quantity::of('5')));
        $this->assertFalse(Quantity::of('5.0001')->equals(Quantity::of('5')));
    }

    public function test_greater_than_and_less_than(): void
    {
        $big = Quantity::of('10.0');
        $small = Quantity::of('5.0');

        $this->assertTrue($big->isGreaterThan($small));
        $this->assertTrue($small->isLessThan($big));
        $this->assertFalse($big->isLessThan($small));
    }

    public function test_to_int_truncates_decimal(): void
    {
        $this->assertSame(3, Quantity::of('3.9')->toInt());
    }

    public function test_to_float(): void
    {
        $this->assertEqualsWithDelta(1.5, Quantity::of('1.5')->toFloat(), 0.0001);
    }

    public function test_immutability(): void
    {
        $original = Quantity::of('5.0');
        $original->add(Quantity::of('10.0'));

        $this->assertSame('5.0000', $original->value);
    }
}
