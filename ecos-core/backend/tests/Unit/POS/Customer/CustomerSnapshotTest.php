<?php

declare(strict_types=1);

namespace Tests\Unit\POS\Customer;

use DateTimeImmutable;
use InvalidArgumentException;
use Modules\POS\Customer\Domain\ValueObjects\CustomerSnapshot;
use PHPUnit\Framework\TestCase;

final class CustomerSnapshotTest extends TestCase
{
    private DateTimeImmutable $now;

    protected function setUp(): void
    {
        $this->now = new DateTimeImmutable('2026-07-01T10:00:00Z');
    }

    // ── capture() guards ──────────────────────────────────────────────────────

    public function test_rejects_empty_customer_id(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('Customer ID cannot be empty');

        CustomerSnapshot::capture('', 'C001', 'John Doe', null, null, $this->now);
    }

    public function test_rejects_whitespace_only_customer_id(): void
    {
        $this->expectException(InvalidArgumentException::class);

        CustomerSnapshot::capture('   ', 'C001', 'John Doe', null, null, $this->now);
    }

    public function test_rejects_empty_name(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('Customer name cannot be empty');

        CustomerSnapshot::capture('uuid-123', 'C001', '', null, null, $this->now);
    }

    // ── successful creation ───────────────────────────────────────────────────

    public function test_creates_with_all_fields(): void
    {
        $snapshot = CustomerSnapshot::capture(
            'uuid-123', 'C001', 'John Doe', 'john@example.com', '+201001234567', $this->now,
        );

        $this->assertSame('uuid-123', $snapshot->customerId);
        $this->assertSame('C001', $snapshot->customerCode);
        $this->assertSame('John Doe', $snapshot->name);
        $this->assertSame('john@example.com', $snapshot->email);
        $this->assertSame('+201001234567', $snapshot->phone);
    }

    public function test_creates_with_null_email_and_phone(): void
    {
        $snapshot = CustomerSnapshot::capture('uuid-123', 'C001', 'John Doe', null, null, $this->now);

        $this->assertNull($snapshot->email);
        $this->assertNull($snapshot->phone);
    }

    public function test_normalizes_empty_string_email_to_null(): void
    {
        $snapshot = CustomerSnapshot::capture('uuid-123', 'C001', 'John Doe', '  ', null, $this->now);

        $this->assertNull($snapshot->email);
    }

    public function test_normalizes_empty_string_phone_to_null(): void
    {
        $snapshot = CustomerSnapshot::capture('uuid-123', 'C001', 'John Doe', null, '', $this->now);

        $this->assertNull($snapshot->phone);
    }

    // ── helper methods ────────────────────────────────────────────────────────

    public function test_has_email_returns_true_when_email_present(): void
    {
        $snapshot = CustomerSnapshot::capture('id', 'C1', 'Jane', 'j@example.com', null, $this->now);

        $this->assertTrue($snapshot->hasEmail());
    }

    public function test_has_email_returns_false_when_no_email(): void
    {
        $snapshot = CustomerSnapshot::capture('id', 'C1', 'Jane', null, null, $this->now);

        $this->assertFalse($snapshot->hasEmail());
    }

    public function test_has_phone_returns_true_when_phone_present(): void
    {
        $snapshot = CustomerSnapshot::capture('id', 'C1', 'Jane', null, '0501234567', $this->now);

        $this->assertTrue($snapshot->hasPhone());
    }

    public function test_has_phone_returns_false_when_no_phone(): void
    {
        $snapshot = CustomerSnapshot::capture('id', 'C1', 'Jane', null, null, $this->now);

        $this->assertFalse($snapshot->hasPhone());
    }

    public function test_display_name_includes_code_when_present(): void
    {
        $snapshot = CustomerSnapshot::capture('id', 'C001', 'John Doe', null, null, $this->now);

        $this->assertSame('John Doe (C001)', $snapshot->displayName());
    }

    public function test_display_name_is_just_name_when_code_is_empty(): void
    {
        $snapshot = CustomerSnapshot::capture('id', '', 'John Doe', null, null, $this->now);

        $this->assertSame('John Doe', $snapshot->displayName());
    }

    // ── toArray / fromArray ───────────────────────────────────────────────────

    public function test_to_array_has_expected_keys(): void
    {
        $snapshot = CustomerSnapshot::capture('id', 'C1', 'Jane', 'j@e.com', '050', $this->now);
        $array = $snapshot->toArray();

        $this->assertArrayHasKey('customer_id', $array);
        $this->assertArrayHasKey('customer_code', $array);
        $this->assertArrayHasKey('name', $array);
        $this->assertArrayHasKey('email', $array);
        $this->assertArrayHasKey('phone', $array);
        $this->assertArrayHasKey('captured_at', $array);
    }

    public function test_from_array_round_trips(): void
    {
        $original = CustomerSnapshot::capture('uuid-abc', 'C-99', 'Test User', 'test@x.com', '0501111', $this->now);
        $restored = CustomerSnapshot::fromArray($original->toArray());

        $this->assertSame($original->customerId, $restored->customerId);
        $this->assertSame($original->customerCode, $restored->customerCode);
        $this->assertSame($original->name, $restored->name);
        $this->assertSame($original->email, $restored->email);
        $this->assertSame($original->phone, $restored->phone);
    }
}
