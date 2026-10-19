<?php

declare(strict_types=1);

namespace Tests\Unit\POS\Customer;

use Modules\POS\Customer\Domain\Enums\CustomerLookupType;
use PHPUnit\Framework\TestCase;

final class CustomerLookupTypeTest extends TestCase
{
    public function test_cases_have_correct_values(): void
    {
        $this->assertSame('id', CustomerLookupType::ById->value);
        $this->assertSame('phone', CustomerLookupType::ByPhone->value);
        $this->assertSame('email', CustomerLookupType::ByEmail->value);
        $this->assertSame('code', CustomerLookupType::ByCode->value);
    }

    public function test_labels_are_human_readable(): void
    {
        $this->assertSame('Customer ID', CustomerLookupType::ById->label());
        $this->assertSame('Phone Number', CustomerLookupType::ByPhone->label());
        $this->assertSame('Email Address', CustomerLookupType::ByEmail->label());
        $this->assertSame('Customer Code', CustomerLookupType::ByCode->label());
    }

    public function test_can_create_from_value(): void
    {
        $this->assertSame(CustomerLookupType::ById, CustomerLookupType::from('id'));
        $this->assertSame(CustomerLookupType::ByPhone, CustomerLookupType::from('phone'));
        $this->assertSame(CustomerLookupType::ByEmail, CustomerLookupType::from('email'));
        $this->assertSame(CustomerLookupType::ByCode, CustomerLookupType::from('code'));
    }

    public function test_try_from_returns_null_for_invalid_value(): void
    {
        $this->assertNull(CustomerLookupType::tryFrom('unknown'));
        $this->assertNull(CustomerLookupType::tryFrom(''));
    }

    public function test_all_cases_are_backed_by_strings(): void
    {
        foreach (CustomerLookupType::cases() as $case) {
            $this->assertIsString($case->value);
            $this->assertNotEmpty($case->value);
        }
    }
}
