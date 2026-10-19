<?php

declare(strict_types=1);

namespace Modules\POS\Application\Results;

final readonly class OpenCartResult
{
    public function __construct(
        public string $cartId,
    ) {}

    public function toArray(): array
    {
        return ['cart_id' => $this->cartId];
    }
}
