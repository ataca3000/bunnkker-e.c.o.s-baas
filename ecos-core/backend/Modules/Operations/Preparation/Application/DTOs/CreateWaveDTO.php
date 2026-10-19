<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Application\DTOs;

final readonly class CreateWaveDTO
{
    /**
     * @param list<array{
     *   order_id: string,
     *   order_number: string,
     *   confirmed_at: string,
     *   customer_name?: string,
     *   delivery_zone?: string,
     *   governorate?: string,
     *   shipping_cost?: float,
     *   is_paid?: bool,
     * }> $orderLines
     */
    public function __construct(
        public string $companyId,
        public string $warehouseId,
        public string $planningDate,
        public array $orderLines,
        public string $actorId,
        public ?string $brandId = null,
        public ?string $channelId = null,
        public ?string $configVersionId = null,
        public ?string $notes = null,
    ) {}
}
