<?php

declare(strict_types=1);

namespace Modules\POS\Customer\Domain\Services;

use InvalidArgumentException;
use Modules\POS\Customer\Domain\Enums\CustomerLookupType;

final class CustomerValidator
{
    public function validateLookupValue(string $value, CustomerLookupType $type): void
    {
        if (trim($value) === '') {
            throw new InvalidArgumentException(
                "Lookup value for {$type->label()} cannot be empty.",
            );
        }

        match ($type) {
            CustomerLookupType::ByEmail => $this->validateEmail($value),
            CustomerLookupType::ByPhone => $this->validatePhone($value),
            CustomerLookupType::ById => $this->validateCustomerId($value),
            CustomerLookupType::ByCode => null,
        };
    }

    public function validateCustomerId(string $id): void
    {
        if (trim($id) === '') {
            throw new InvalidArgumentException('Customer ID cannot be empty.');
        }

        if (! preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i', $id)) {
            throw new InvalidArgumentException("Invalid customer ID format: '{$id}'.");
        }
    }

    private function validateEmail(string $email): void
    {
        if (! filter_var($email, FILTER_VALIDATE_EMAIL)) {
            throw new InvalidArgumentException("Invalid email address: '{$email}'.");
        }
    }

    private function validatePhone(string $phone): void
    {
        $stripped = preg_replace('/[\s\-\(\)\+]+/', '', $phone);

        if (! preg_match('/^[0-9]{7,15}$/', $stripped)) {
            throw new InvalidArgumentException("Invalid phone number format: '{$phone}'.");
        }
    }
}
