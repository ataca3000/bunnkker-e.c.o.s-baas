<?php

declare(strict_types=1);

namespace Modules\Crm\Customers\Domain\Enums;

/**
 * Whether a customer is a person or an organization. Individuals carry a
 * first/last name; businesses carry a business name and a tax registration.
 */
enum CustomerType: string
{
    case Individual = 'individual';
    case Business = 'business';

    public function isBusiness(): bool
    {
        return $this === self::Business;
    }

    public function label(): string
    {
        return ucfirst($this->value);
    }
}
