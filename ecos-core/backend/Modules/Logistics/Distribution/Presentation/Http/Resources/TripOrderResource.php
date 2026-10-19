<?php

declare(strict_types=1);

namespace Modules\Logistics\Distribution\Presentation\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Modules\Logistics\Distribution\Domain\Models\TripOrder;

/**
 * @mixin TripOrder
 */
class TripOrderResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'trip_id' => $this->trip_id,
            'order_id' => $this->order_id,
            'zone_code_snapshot' => $this->zone_code_snapshot,
            'governorate_snapshot' => $this->governorate_snapshot,
            'assignment_type' => $this->assignment_type,
            'is_manual' => $this->isManual(),
            'assigned_by' => $this->assigned_by,
            'assigned_at' => $this->assigned_at?->toIso8601String(),
        ];
    }
}
