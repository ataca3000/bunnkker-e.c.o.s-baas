<?php

declare(strict_types=1);

namespace Modules\POS\Application\Results;

final readonly class OpenSessionResult
{
    public function __construct(public string $sessionId) {}
}
