<?php

declare(strict_types=1);

namespace Modules\ClaudeBridge\Application\DTOs;

final readonly class WorkerDTO
{
    public function __construct(
        public string $companyId,
        public string $registeredBy,
        public string $name,
        public string $hostname,
        public string $tokenHash,
    ) {}
}
