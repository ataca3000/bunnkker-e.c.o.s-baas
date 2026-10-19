<?php

declare(strict_types=1);

namespace Tests\Unit\POS\Customer;

use InvalidArgumentException;
use Modules\POS\Customer\Domain\Enums\CustomerLookupType;
use Modules\POS\Customer\Domain\Services\CustomerValidator;
use PHPUnit\Framework\TestCase;

final class CustomerValidatorTest extends TestCase
{
    private CustomerValidator $validator;

    protected function setUp(): void
    {
        $this->validator = new CustomerValidator;
    }

    // ── validateCustomerId() ──────────────────────────────────────────────────

    public function test_accepts_valid_uuid(): void
    {
        $this->validator->validateCustomerId('550e8400-e29b-41d4-a716-446655440000');
        $this->assertTrue(true);
    }

    public function test_rejects_empty_customer_id(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('Customer ID cannot be empty');

        $this->validator->validateCustomerId('');
    }

    public function test_rejects_whitespace_customer_id(): void
    {
        $this->expectException(InvalidArgumentException::class);

        $this->validator->validateCustomerId('   ');
    }

    public function test_rejects_non_uuid_format(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('Invalid customer ID format');

        $this->validator->validateCustomerId('not-a-uuid');
    }

    // ── validateLookupValue() — ById ──────────────────────────────────────────

    public function test_accepts_valid_uuid_for_by_id(): void
    {
        $this->validator->validateLookupValue('550e8400-e29b-41d4-a716-446655440000', CustomerLookupType::ById);
        $this->assertTrue(true);
    }

    public function test_rejects_empty_value_for_by_id(): void
    {
        $this->expectException(InvalidArgumentException::class);

        $this->validator->validateLookupValue('', CustomerLookupType::ById);
    }

    // ── validateLookupValue() — ByEmail ──────────────────────────────────────

    public function test_accepts_valid_email(): void
    {
        $this->validator->validateLookupValue('john@example.com', CustomerLookupType::ByEmail);
        $this->assertTrue(true);
    }

    public function test_rejects_invalid_email(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('Invalid email address');

        $this->validator->validateLookupValue('not-an-email', CustomerLookupType::ByEmail);
    }

    public function test_rejects_empty_email(): void
    {
        $this->expectException(InvalidArgumentException::class);

        $this->validator->validateLookupValue('', CustomerLookupType::ByEmail);
    }

    // ── validateLookupValue() — ByPhone ──────────────────────────────────────

    public function test_accepts_valid_phone_with_country_code(): void
    {
        $this->validator->validateLookupValue('+201001234567', CustomerLookupType::ByPhone);
        $this->assertTrue(true);
    }

    public function test_accepts_phone_with_dashes_and_spaces(): void
    {
        $this->validator->validateLookupValue('0501-234-567', CustomerLookupType::ByPhone);
        $this->assertTrue(true);
    }

    public function test_rejects_phone_that_is_too_short(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('Invalid phone number format');

        $this->validator->validateLookupValue('123', CustomerLookupType::ByPhone);
    }

    public function test_rejects_phone_with_letters(): void
    {
        $this->expectException(InvalidArgumentException::class);

        $this->validator->validateLookupValue('abc1234567', CustomerLookupType::ByPhone);
    }

    public function test_rejects_empty_phone(): void
    {
        $this->expectException(InvalidArgumentException::class);

        $this->validator->validateLookupValue('', CustomerLookupType::ByPhone);
    }

    // ── validateLookupValue() — ByCode ───────────────────────────────────────

    public function test_accepts_any_non_empty_string_for_code(): void
    {
        $this->validator->validateLookupValue('CUST-001', CustomerLookupType::ByCode);
        $this->validator->validateLookupValue('ABC', CustomerLookupType::ByCode);
        $this->assertTrue(true);
    }

    public function test_rejects_empty_code(): void
    {
        $this->expectException(InvalidArgumentException::class);

        $this->validator->validateLookupValue('', CustomerLookupType::ByCode);
    }
}
