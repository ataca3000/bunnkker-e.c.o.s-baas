<?php

declare(strict_types=1);

namespace Modules\POS\Application\Commands;

final readonly class RemoveCartLineCommand
{
    public function __construct(
        public string $cartId,
        public string $lineId,
    ) {}
}
