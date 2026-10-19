<?php

declare(strict_types=1);

namespace Modules\POS\Application\Results;

final readonly class AddCartLineResult
{
    public function __construct(
        public string $cartId,
        public string $lineId,
    ) {}

    public function toArray(): array
    {
        return [
            'cart_id' => $this->cartId,
            'line_id' => $this->lineId,
        ];
    }
}
