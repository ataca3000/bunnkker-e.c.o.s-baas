<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Application\DTOs;

final readonly class StartPreparationDTO
{
    /**
     * @param  list<array{user_id:string,role:string,name?:string}>  $workers
     * @param  list<string>  $stationIds
     */
    public function __construct(
        public string $actorId,
        public array $workers = [],
        public array $stationIds = [],
        public bool $overrideShortage = false,
    ) {}
}
