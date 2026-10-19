<?php

declare(strict_types=1);

namespace Modules\Logistics\Fleet\Presentation\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Modules\Logistics\Fleet\Domain\Models\FuelTransaction;

/**
 * @mixin FuelTransaction
 *
 * D8: an operational expense fact. No settlement figure appears here — trip
 * cash belongs to Distribution, the Single Cash Authority.
 */
class FuelTransactionResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->uuid,
            'uuid' => $this->uuid,
            'fleet_unit_id' => $this->fleet_unit_id,
            'fuel_card_id' => $this->fuel_card_id,

            'status' => $this->status->value,
            'status_label' => $this->status->label(),
            'is_terminal' => $this->isTerminal(),
            'posts_cost' => $this->postsCost(),
            'allowed_transitions' => array_map(
                static fn ($s) => ['value' => $s->value, 'label' => $s->label()],
                $this->status->allowedTransitions(),
            ),

            'source' => $this->source,
            'litres' => (float) $this->litres,
            'cost' => (float) $this->cost,
            'currency' => $this->currency,
            'price_per_litre' => $this->price_per_litre !== null
                ? (float) $this->price_per_litre
                : null,
            'odometer_km' => (float) $this->odometer_km,
            'efficiency_l_per_100km' => $this->efficiency_l_per_100km !== null
                ? (float) $this->efficiency_l_per_100km
                : null,

            'has_anomaly' => $this->has_anomaly,
            'anomaly_flags' => $this->anomalies(),

            'station' => $this->station,
            'reference_number' => $this->reference_number,
            'transacted_at' => $this->transacted_at?->toIso8601String(),
            'reconciled_at' => $this->reconciled_at?->toIso8601String(),
            'reconciled_by' => $this->reconciled_by,

            'photos' => $this->photos ?? [],
            'notes' => $this->notes,
            'resolution_reason' => $this->resolution_reason,

            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
