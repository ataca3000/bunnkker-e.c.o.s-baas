<?php

declare(strict_types=1);

namespace Modules\Operations\Loading\Presentation\Http\Resources;

use BackedEnum;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

final class ShipmentGroupResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'group_number' => $this->group_number,
            'status' => $this->status instanceof BackedEnum ? $this->status->value : $this->status,
            'shipping_company_id' => $this->shipping_company_id,
            'zone_id' => $this->zone_id,
            'vehicle_assignments_count' => $this->vehicle_assignments_count,
            'orders_count' => $this->orders_count,
            'allocation_coverage_pct' => (float) $this->allocation_coverage_pct,
            'dispatched_at' => $this->dispatched_at?->toIso8601String(),
            'completed_at' => $this->completed_at?->toIso8601String(),
        ];
    }
}
