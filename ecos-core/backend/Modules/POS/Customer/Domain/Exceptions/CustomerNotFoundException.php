<?php

declare(strict_types=1);

namespace Modules\POS\Customer\Domain\Exceptions;

use DomainException;

final class CustomerNotFoundException extends DomainException
{
    public static function withId(string $id): self
    {
        return new self("Customer with ID '{$id}' was not found.");
    }

    public static function withPhone(string $phone): self
    {
        return new self("No customer found with phone number '{$phone}'.");
    }

    public static function withEmail(string $email): self
    {
        return new self("No customer found with email '{$email}'.");
    }

    public static function withCode(string $code): self
    {
        return new self("No customer found with code '{$code}'.");
    }
}
