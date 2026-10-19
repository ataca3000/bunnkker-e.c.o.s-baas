<?php

declare(strict_types=1);

namespace Modules\Organization\Teams\Presentation\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Modules\Organization\Teams\Domain\Models\Team;

/** @mixin Team */
final class TeamResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'company_id' => $this->company_id,
            'company' => $this->whenLoaded('company', fn (): array => [
                'id' => $this->company->id,
                'code' => $this->company->code,
                'name' => $this->company->name,
            ]),
            'code' => $this->code,
            'name' => $this->name,
            'leader_name' => $this->leader_name,
            'description' => $this->description,
            'is_active' => (bool) $this->is_active,
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
