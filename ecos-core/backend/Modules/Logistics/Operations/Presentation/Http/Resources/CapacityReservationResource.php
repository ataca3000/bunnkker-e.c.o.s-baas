<?php

declare(strict_types=1);

namespace Modules\Logistics\Operations\Presentation\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Modules\Logistics\Operations\Domain\Models\CapacityReservation;

/**
 * @mixin CapacityReservation
 */
class CapacityReservationResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->uuid,
            'company_id' => $this->company_id,

            'status' => $this->status->value,
            'status_label' => $this->status->label(),
            'status_tone' => $this->status->tone(),
            'holds_capacity' => $this->holdsCapacity(),
            'allowed_transitions' => array_map(
                static fn ($s) => ['value' => $s->value, 'label' => $s->label()],
                $this->status->allowedTransitions(),
            ),

            // What was asked for — the immutable record of the ask.
            'requested' => [
                'orders' => (int) $this->requested_orders,
                'stops' => (int) $this->requested_stops,
                'weight_kg' => (float) $this->requested_weight_kg,
                'volume_m3' => (float) $this->requested_volume_m3,
            ],

            'slot' => $this->whenLoaded('slot', fn () => $this->slot === null ? null : [
                'id' => $this->slot->uuid,
                // Plain TIME columns on the Network side, not datetimes.
                'window_start' => $this->slot->window_start,
                'window_end' => $this->slot->window_end,
                'utilisation' => $this->slot->utilisation(),
                'is_exhausted' => $this->slot->isExhausted(),
            ]),

            // Network's verdict, read live rather than cached onto this row.
            'ledger_status' => $this->ledgerStatus(),
            'commitment_id' => $this->whenLoaded('commitment', fn () => $this->commitment?->uuid),

            'pool' => $this->whenLoaded('pool', fn () => $this->pool === null ? null : [
                'id' => $this->pool->uuid,
                'name' => $this->pool->name,
            ]),

            'reference_type' => $this->reference_type,
            'reference_id' => $this->reference_id,
            'purpose' => $this->purpose,

            'requested_at' => $this->requested_at?->toIso8601String(),
            'confirmed_at' => $this->confirmed_at?->toIso8601String(),
            'released_at' => $this->released_at?->toIso8601String(),
            'release_reason' => $this->release_reason,

            // Network's own words when it refused. Never paraphrased.
            'failure_reason' => $this->failure_reason,

            'was_rebalanced' => $this->rebalanced_from_slot_id !== null,
        ];
    }
}
