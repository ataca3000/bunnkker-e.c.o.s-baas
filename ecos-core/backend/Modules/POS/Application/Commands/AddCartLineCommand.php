<?php

declare(strict_types=1);

namespace Modules\POS\Application\Commands;

final readonly class AddCartLineCommand
{
    public function __construct(
        public string $cartId,
        public string $productId,
        public string $productName,
        public string $sku,
        public string $quantity,
        public string $unitPrice,
        public string $currency,
        public ?string $discountType = null,
        public ?string $discountValue = null,
    ) {}
}
