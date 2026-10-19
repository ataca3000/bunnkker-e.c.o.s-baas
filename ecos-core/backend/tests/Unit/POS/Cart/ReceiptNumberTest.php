<?php

declare(strict_types=1);

namespace Tests\Unit\POS\Cart;

use InvalidArgumentException;
use Modules\POS\Cart\Domain\ValueObjects\ReceiptNumber;
use PHPUnit\Framework\TestCase;

/**
 * PKG-POS-006: ReceiptNumber value object unit tests.
 */
final class ReceiptNumberTest extends TestCase
{
    public function test_of_creates_from_valid_string(): void
    {
        $rn = ReceiptNumber::of('RCP-2026-000001');

        $this->assertSame('RCP-2026-000001', $rn->value);
    }

    public function test_of_trims_whitespace(): void
    {
        $rn = ReceiptNumber::of('  RCP-001  ');

        $this->assertSame('RCP-001', $rn->value);
    }

    public function test_empty_string_throws(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('cannot be empty');

        ReceiptNumber::of('');
    }

    public function test_whitespace_only_throws(): void
    {
        $this->expectException(InvalidArgumentException::class);

        ReceiptNumber::of('   ');
    }

    public function test_exceeding_100_chars_throws(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('100 characters');

        ReceiptNumber::of(str_repeat('X', 101));
    }

    public function test_exactly_100_chars_is_accepted(): void
    {
        $rn = ReceiptNumber::of(str_repeat('X', 100));

        $this->assertSame(100, strlen($rn->value));
    }

    public function test_equals_same_value_returns_true(): void
    {
        $a = ReceiptNumber::of('RCP-001');
        $b = ReceiptNumber::of('RCP-001');

        $this->assertTrue($a->equals($b));
    }

    public function test_equals_different_value_returns_false(): void
    {
        $a = ReceiptNumber::of('RCP-001');
        $b = ReceiptNumber::of('RCP-002');

        $this->assertFalse($a->equals($b));
    }

    public function test_to_string_returns_value(): void
    {
        $rn = ReceiptNumber::of('RCP-2026-000042');

        $this->assertSame('RCP-2026-000042', (string) $rn);
    }
}
