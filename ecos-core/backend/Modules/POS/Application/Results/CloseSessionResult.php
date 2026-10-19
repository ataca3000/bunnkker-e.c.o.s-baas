<?php

declare(strict_types=1);

namespace Modules\POS\Application\Results;

final readonly class CloseSessionResult
{
    public function __construct(public string $sessionId) {}
}
