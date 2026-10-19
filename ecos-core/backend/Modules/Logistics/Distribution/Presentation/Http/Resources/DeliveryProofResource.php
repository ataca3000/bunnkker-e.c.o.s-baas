<?php

declare(strict_types=1);

namespace Modules\Logistics\Distribution\Presentation\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Modules\Logistics\Distribution\Domain\Models\DeliveryProof;

/**
 * @mixin DeliveryProof
 */
class DeliveryProofResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'stop_id' => $this->stop_id,
            'has_signature' => $this->hasSignature(),
            'photos' => $this->photos ?? [],
            'photo_count' => $this->photoCount(),
            'notes' => $this->notes,
            'captured_at' => $this->captured_at?->toIso8601String(),
            'captured_by' => $this->captured_by,
        ];
    }
}
