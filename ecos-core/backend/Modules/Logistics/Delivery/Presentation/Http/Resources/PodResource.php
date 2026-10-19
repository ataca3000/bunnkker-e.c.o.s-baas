<?php

declare(strict_types=1);

namespace Modules\Logistics\Delivery\Presentation\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Modules\Logistics\Delivery\Domain\Models\PodArtifact;
use Modules\Logistics\Delivery\Domain\Models\ProofOfDelivery;

/**
 * @mixin ProofOfDelivery
 */
class PodResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->uuid,
            'uuid' => $this->uuid,
            'attempt_id' => $this->attempt_id,
            'status' => $this->status->value,
            'status_label' => $this->status->label(),
            'is_validated' => $this->isValidated(),
            'required_artifacts' => $this->required_artifacts ?? [],
            'missing_artifacts' => $this->when(
                $this->relationLoaded('artifacts'),
                fn () => $this->missingArtifacts()
            ),
            'is_complete' => $this->when(
                $this->relationLoaded('artifacts'),
                fn () => $this->isComplete()
            ),
            'recipient_name' => $this->recipient_name,
            'notes' => $this->notes,
            'rejection_reason' => $this->rejection_reason,
            'captured_at' => $this->captured_at?->toIso8601String(),
            'validated_at' => $this->validated_at?->toIso8601String(),
            'artifacts' => $this->whenLoaded('artifacts', fn () => $this->artifacts->map(
                static fn (PodArtifact $a) => [
                    'id' => $a->id,
                    'kind' => $a->kind->value,
                    'kind_label' => $a->kind->label(),
                    // file_path is withheld; downloads go through the authenticated endpoint.
                    'file_name' => $a->file_name,
                    'mime_type' => $a->mime_type,
                    'size_bytes' => $a->size_bytes,
                    'reference' => $a->reference,
                    'captured_at' => $a->captured_at?->toIso8601String(),
                ]
            )->all()),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
