<?php

declare(strict_types=1);

namespace Modules\Logistics\Distribution\Presentation\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Modules\Logistics\Distribution\Domain\Models\TripSettlement;

/**
 * @mixin TripSettlement
 */
class TripSettlementResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'uuid' => $this->uuid,
            'trip_id' => $this->trip_id,

            'cash_collected' => (float) $this->cash_collected,
            'bank_transfers_pending' => (float) $this->bank_transfers_pending,
            'already_paid' => (float) $this->already_paid,
            'total_collected' => (float) $this->total_collected,
            'cash_expected' => (float) $this->cash_expected,
            'driver_cash_submitted' => $this->driver_cash_submitted !== null
                ? (float) $this->driver_cash_submitted
                : null,
            'discrepancy' => $this->discrepancy !== null ? (float) $this->discrepancy : null,
            'is_balanced' => $this->isBalanced(),
            'is_short' => $this->isShort(),

            'status' => $this->status->value,
            'status_label' => $this->status->label(),
            'allowed_transitions' => array_map(
                static fn ($s) => ['value' => $s->value, 'label' => $s->label()],
                $this->status->allowedTransitions(),
            ),
            'is_final' => $this->isFinal(),

            'submitted_at' => $this->submitted_at?->toIso8601String(),
            'reconciled_at' => $this->reconciled_at?->toIso8601String(),
            'finalized_at' => $this->finalized_at?->toIso8601String(),
            'notes' => $this->notes,
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
