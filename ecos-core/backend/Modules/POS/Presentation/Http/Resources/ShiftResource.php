<?php

declare(strict_types=1);

namespace Modules\POS\Presentation\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin \Modules\POS\Shift\Domain\Models\Shift
 */
final class ShiftResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'session_id' => $this->session_id,
            'terminal_id' => $this->terminal_id,
            'cashier_id' => $this->cashier_id,
            'shift_number' => $this->shift_number,
            'status' => $this->status->value,
            'opening_cash' => $this->opening_cash,
            'closing_count' => $this->closing_count,
            'expected_closing' => $this->expected_closing,
            'variance' => $this->variance,
            'opened_at' => $this->opened_at?->toIso8601String(),
            'submitted_at' => $this->submitted_at?->toIso8601String(),
            'closed_at' => $this->closed_at?->toIso8601String(),
        ];
    }
}
