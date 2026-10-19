<?php

declare(strict_types=1);

namespace Tests\Unit\POS\ValueObjects;

use InvalidArgumentException;
use Modules\POS\Shared\Domain\Exceptions\InvalidMoneyOperationException;
use Modules\POS\Shared\Domain\ValueObjects\Money;
use PHPUnit\Framework\TestCase;

/**
 * PKG-POS-002: Money value object unit tests.
 * Pure unit tests — no database, no Laravel boot.
 */
final class MoneyTest extends TestCase
{
    // -------------------------------------------------------------------------
    // Construction
    // -------------------------------------------------------------------------

    public function test_of_factory_normalises_to_two_decimals(): void
    {
        $money = Money::of('10.5', 'EGP');

        $this->assertSame('10.50', $money->amount);
        $this->assertSame('EGP', $money->currency);
    }

    public function test_of_factory_uppercases_currency(): void
    {
        $money = Money::of(100, 'egp');

        $this->assertSame('EGP', $money->currency);
    }

    public function test_zero_factory_returns_zero_amount(): void
    {
        $money = Money::zero('USD');

        $this->assertTrue($money->isZero());
        $this->assertSame('0.00', $money->amount);
        $this->assertSame('USD', $money->currency);
    }

    public function test_constructor_rejects_non_numeric_amount(): void
    {
        $this->expectException(InvalidArgumentException::class);

        new Money('abc', 'EGP');
    }

    public function test_constructor_rejects_empty_currency(): void
    {
        $this->expectException(InvalidArgumentException::class);

        Money::of(100, '');
    }

    // -------------------------------------------------------------------------
    // Arithmetic
    // -------------------------------------------------------------------------

    public function test_add_two_same_currency_values(): void
    {
        $total = Money::of('10.00', 'EGP')->add(Money::of('5.50', 'EGP'));

        $this->assertSame('15.50', $total->amount);
    }

    public function test_subtract_produces_correct_result(): void
    {
        $result = Money::of('20.00', 'EGP')->subtract(Money::of('7.25', 'EGP'));

        $this->assertSame('12.75', $result->amount);
    }

    public function test_subtract_can_produce_negative_result(): void
    {
        $result = Money::of('5.00', 'EGP')->subtract(Money::of('10.00', 'EGP'));

        $this->assertTrue($result->isNegative());
        $this->assertSame('-5.00', $result->amount);
    }

    public function test_multiply_by_integer_factor(): void
    {
        $result = Money::of('15.00', 'EGP')->multiply(3);

        $this->assertSame('45.00', $result->amount);
    }

    public function test_multiply_by_decimal_factor(): void
    {
        $result = Money::of('100.00', 'EGP')->multiply('0.14'); // 14% VAT

        $this->assertSame('14.00', $result->amount);
    }

    public function test_divide_by_integer_divisor(): void
    {
        $result = Money::of('30.00', 'EGP')->divide(3);

        $this->assertSame('10.00', $result->amount);
    }

    public function test_divide_throws_on_zero_divisor(): void
    {
        $this->expectException(InvalidMoneyOperationException::class);

        Money::of('30.00', 'EGP')->divide(0);
    }

    // -------------------------------------------------------------------------
    // Allocation
    // -------------------------------------------------------------------------

    public function test_allocate_divides_evenly(): void
    {
        $parts = Money::of('30.00', 'EGP')->allocate(3);

        $this->assertCount(3, $parts);
        foreach ($parts as $part) {
            $this->assertSame('10.00', $part->amount);
        }
    }

    public function test_allocate_puts_remainder_in_first_part(): void
    {
        // 10.00 / 3 = 3.33 each, but 3 * 3.33 = 9.99, so first part gets +0.01
        $parts = Money::of('10.00', 'EGP')->allocate(3);

        $this->assertSame('3.34', $parts[0]->amount);
        $this->assertSame('3.33', $parts[1]->amount);
        $this->assertSame('3.33', $parts[2]->amount);
    }

    public function test_allocate_throws_on_zero_parts(): void
    {
        $this->expectException(InvalidMoneyOperationException::class);

        Money::of('10.00', 'EGP')->allocate(0);
    }

    // -------------------------------------------------------------------------
    // Sign helpers
    // -------------------------------------------------------------------------

    public function test_absolute_of_negative_money(): void
    {
        $result = Money::of('-15.00', 'EGP')->absolute();

        $this->assertSame('15.00', $result->amount);
    }

    public function test_absolute_of_positive_money_is_unchanged(): void
    {
        $money = Money::of('15.00', 'EGP');

        $this->assertTrue($money->absolute()->equals($money));
    }

    public function test_negate_flips_sign(): void
    {
        $result = Money::of('20.00', 'EGP')->negate();

        $this->assertSame('-20.00', $result->amount);
    }

    // -------------------------------------------------------------------------
    // Comparison
    // -------------------------------------------------------------------------

    public function test_equals_same_amount_and_currency(): void
    {
        $a = Money::of('10.00', 'EGP');
        $b = Money::of('10.00', 'EGP');

        $this->assertTrue($a->equals($b));
    }

    public function test_equals_false_for_different_currency(): void
    {
        $a = Money::of('10.00', 'EGP');
        $b = Money::of('10.00', 'USD');

        $this->assertFalse($a->equals($b));
    }

    public function test_is_greater_than(): void
    {
        $this->assertTrue(Money::of('20.00', 'EGP')->isGreaterThan(Money::of('10.00', 'EGP')));
        $this->assertFalse(Money::of('10.00', 'EGP')->isGreaterThan(Money::of('20.00', 'EGP')));
    }

    public function test_is_less_than(): void
    {
        $this->assertTrue(Money::of('5.00', 'EGP')->isLessThan(Money::of('10.00', 'EGP')));
    }

    public function test_is_greater_than_or_equal(): void
    {
        $this->assertTrue(Money::of('10.00', 'EGP')->isGreaterThanOrEqual(Money::of('10.00', 'EGP')));
        $this->assertTrue(Money::of('11.00', 'EGP')->isGreaterThanOrEqual(Money::of('10.00', 'EGP')));
        $this->assertFalse(Money::of('9.00', 'EGP')->isGreaterThanOrEqual(Money::of('10.00', 'EGP')));
    }

    // -------------------------------------------------------------------------
    // Cross-currency guard
    // -------------------------------------------------------------------------

    public function test_add_throws_on_currency_mismatch(): void
    {
        $this->expectException(InvalidMoneyOperationException::class);
        $this->expectExceptionMessage('EGP vs USD');

        Money::of('10.00', 'EGP')->add(Money::of('10.00', 'USD'));
    }

    public function test_subtract_throws_on_currency_mismatch(): void
    {
        $this->expectException(InvalidMoneyOperationException::class);

        Money::of('10.00', 'EGP')->subtract(Money::of('5.00', 'USD'));
    }

    public function test_comparison_throws_on_currency_mismatch(): void
    {
        $this->expectException(InvalidMoneyOperationException::class);

        Money::of('10.00', 'EGP')->isGreaterThan(Money::of('5.00', 'USD'));
    }

    // -------------------------------------------------------------------------
    // Serialisation
    // -------------------------------------------------------------------------

    public function test_to_array_contains_amount_and_currency(): void
    {
        $result = Money::of('99.99', 'EGP')->toArray();

        $this->assertSame(['amount' => '99.99', 'currency' => 'EGP'], $result);
    }

    public function test_to_string_format(): void
    {
        $this->assertSame('50.00 EGP', (string) Money::of(50, 'EGP'));
    }

    public function test_immutability_add_does_not_mutate_original(): void
    {
        $original = Money::of('10.00', 'EGP');
        $original->add(Money::of('5.00', 'EGP'));

        $this->assertSame('10.00', $original->amount);
    }
}
