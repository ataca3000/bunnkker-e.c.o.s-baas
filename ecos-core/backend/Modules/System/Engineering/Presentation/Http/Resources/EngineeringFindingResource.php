<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Presentation\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \Modules\System\Engineering\Domain\Models\EngineeringFinding */
final class EngineeringFindingResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'id'                 => $this->id,
            'engineering_run_id' => $this->engineering_run_id,
            'severity'           => $this->severity,
            'category'           => $this->category,
            'file'               => $this->file,
            'line'               => $this->line,
            'title'              => $this->title,
            'description'        => $this->description,
            'fix_suggestion'     => $this->fix_suggestion,
            'created_at'         => $this->created_at?->toIso8601String(),
        ];
    }
}
