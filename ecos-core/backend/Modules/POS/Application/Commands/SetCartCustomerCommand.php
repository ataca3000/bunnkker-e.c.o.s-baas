<?php

declare(strict_types=1);

namespace Modules\POS\Application\Commands;

final readonly class SetCartCustomerCommand
{
    public function __construct(
        public string $cartId,
        public ?string $customerId,
    ) {}
}
