<?php

declare(strict_types=1);

namespace Tests\Unit\POS\Shift;

use InvalidArgumentException;
use Modules\POS\Shift\Domain\ValueObjects\ShiftNumber;
use PHPUnit\Framework\TestCase;

/**
 * PKG-POS-005: ShiftNumber value object unit tests.
 * Pure unit tests — no database, no Laravel boot.
 */
final class ShiftNumberTest extends TestCase
{
    // ── Constructor validation ────────────────────────────────────────────────

    public function test_positive_integer_is_accepted(): void
    {
        $sn = new ShiftNumber(1);

        $this->assertSame(1, $sn->value);
    }

    public function test_zero_throws(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('positive integer');

        new ShiftNumber(0);
    }

    public function test_negative_throws(): void
    {
        $this->expectException(InvalidArgumentException::class);

        new ShiftNumber(-5);
    }

    public function test_large_number_is_accepted(): void
    {
        $sn = new ShiftNumber(99999);

        $this->assertSame(99999, $sn->value);
    }

    // ── Factory ───────────────────────────────────────────────────────────────

    public function test_of_creates_from_positive_integer(): void
    {
        $sn = ShiftNumber::of(42);

        $this->assertSame(42, $sn->value);
    }

    public function test_of_throws_for_zero(): void
    {
        $this->expectException(InvalidArgumentException::class);

        ShiftNumber::of(0);
    }

    // ── next() ────────────────────────────────────────────────────────────────

    public function test_next_returns_incremented_value(): void
    {
        $sn = ShiftNumber::of(5);
        $next = $sn->next();

        $this->assertSame(6, $next->value);
    }

    public function test_next_does_not_mutate_original(): void
    {
        $original = ShiftNumber::of(3);
        $original->next();

        $this->assertSame(3, $original->value, 'readonly — original unchanged');
    }

    public function test_next_chaining(): void
    {
        $sn = ShiftNumber::of(1)->next()->next()->next();

        $this->assertSame(4, $sn->value);
    }

    // ── Equality ──────────────────────────────────────────────────────────────

    public function test_equals_returns_true_for_same_value(): void
    {
        $a = ShiftNumber::of(7);
        $b = ShiftNumber::of(7);

        $this->assertTrue($a->equals($b));
    }

    public function test_equals_returns_false_for_different_value(): void
    {
        $a = ShiftNumber::of(7);
        $b = ShiftNumber::of(8);

        $this->assertFalse($a->equals($b));
    }

    // ── String representation ─────────────────────────────────────────────────

    public function test_to_string_returns_integer_as_string(): void
    {
        $sn = ShiftNumber::of(12);

        $this->assertSame('12', (string) $sn);
    }
}
