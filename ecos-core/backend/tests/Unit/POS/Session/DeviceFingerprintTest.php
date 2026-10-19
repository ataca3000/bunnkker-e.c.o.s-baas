<?php

declare(strict_types=1);

namespace Tests\Unit\POS\Session;

use InvalidArgumentException;
use Modules\POS\Session\Domain\ValueObjects\DeviceFingerprint;
use PHPUnit\Framework\TestCase;

/**
 * PKG-POS-004: DeviceFingerprint value object unit tests.
 * Pure unit tests — no database, no Laravel boot.
 */
final class DeviceFingerprintTest extends TestCase
{
    // ── Constructor validation ────────────────────────────────────────────────

    public function test_empty_string_throws(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('Device fingerprint cannot be empty');

        new DeviceFingerprint('');
    }

    public function test_whitespace_only_string_throws(): void
    {
        $this->expectException(InvalidArgumentException::class);

        new DeviceFingerprint('   ');
    }

    public function test_valid_fingerprint_is_stored(): void
    {
        $fp = new DeviceFingerprint('abc123');

        $this->assertSame('abc123', $fp->value);
    }

    public function test_max_length_255_is_accepted(): void
    {
        $value = str_repeat('a', 255);
        $fp = new DeviceFingerprint($value);

        $this->assertSame($value, $fp->value);
    }

    public function test_length_256_throws(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('exceeds maximum length');

        new DeviceFingerprint(str_repeat('a', 256));
    }

    // ── Factory ───────────────────────────────────────────────────────────────

    public function test_of_trims_leading_and_trailing_whitespace(): void
    {
        $fp = DeviceFingerprint::of('  fp-hash-xyz  ');

        $this->assertSame('fp-hash-xyz', $fp->value);
    }

    public function test_of_throws_when_only_whitespace(): void
    {
        $this->expectException(InvalidArgumentException::class);

        DeviceFingerprint::of('   ');
    }

    public function test_of_accepts_typical_hash_fingerprint(): void
    {
        $hash = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4';
        $fp = DeviceFingerprint::of($hash);

        $this->assertSame($hash, $fp->value);
    }

    // ── Equality ──────────────────────────────────────────────────────────────

    public function test_equals_returns_true_for_same_value(): void
    {
        $a = DeviceFingerprint::of('fingerprint-1');
        $b = DeviceFingerprint::of('fingerprint-1');

        $this->assertTrue($a->equals($b));
    }

    public function test_equals_returns_false_for_different_value(): void
    {
        $a = DeviceFingerprint::of('fingerprint-1');
        $b = DeviceFingerprint::of('fingerprint-2');

        $this->assertFalse($a->equals($b));
    }

    public function test_equals_is_case_sensitive(): void
    {
        $a = DeviceFingerprint::of('FP-ABC');
        $b = DeviceFingerprint::of('fp-abc');

        $this->assertFalse($a->equals($b));
    }

    // ── String representation ─────────────────────────────────────────────────

    public function test_to_string_returns_value(): void
    {
        $fp = DeviceFingerprint::of('my-device-hash');

        $this->assertSame('my-device-hash', (string) $fp);
    }
}
