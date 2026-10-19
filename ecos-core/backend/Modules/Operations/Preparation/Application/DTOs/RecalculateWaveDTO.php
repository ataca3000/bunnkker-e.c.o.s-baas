<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Application\DTOs;

final readonly class RecalculateWaveDTO
{
    /**
     * @param  list<string>  $removeOrderIds
     * @param  list<array{order_id:string,order_number:string,confirmed_at:string,customer_name?:string,delivery_zone?:string}>  $addOrderLines
     */
    public function __construct(
        public string $actorId,
        public array $removeOrderIds = [],
        public array $addOrderLines = [],
    ) {}
}
