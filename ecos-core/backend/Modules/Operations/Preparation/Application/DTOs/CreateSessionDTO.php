<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Application\DTOs;

final class CreateSessionDTO
{
    public function __construct(
        public readonly string $companyId,
        public readonly string $warehouseId,
        public readonly string $planningDate,
        public readonly string $operatorId,
        public readonly string $actorId,
        public readonly ?string $supervisorId = null,
        public readonly ?string $notes = null,
    ) {}
}
