<?php

declare(strict_types=1);

namespace Modules\POS\Application\Commands;

final readonly class CloseSessionCommand
{
    public function __construct(
        public string $sessionId,
        public string $cashierId,
    ) {}
}
