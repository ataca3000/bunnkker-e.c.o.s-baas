<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Presentation\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \Modules\System\Engineering\Domain\Models\EngineeringRun */
final class EngineeringRunResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'id'            => $this->id,
            'branch'        => $this->branch,
            'commit'        => $this->commit,
            'mode'          => $this->mode,
            'overall_score' => $this->overall_score,
            'release_ready' => $this->release_ready,
            'categories'    => $this->categories,
            'metrics'       => $this->metrics,
            'blockers'      => $this->blockers,
            'report_json'   => $this->when($this->relationLoaded('findings'), $this->report_json),
            'certified_at'  => $this->certified_at?->toIso8601String(),
            'created_at'    => $this->created_at?->toIso8601String(),
            'findings'      => EngineeringFindingResource::collection($this->whenLoaded('findings')),
            'findings_summary' => $this->when(
                $this->relationLoaded('findings'),
                fn () => $this->buildFindingsSummary(),
            ),
        ];
    }

    private function buildFindingsSummary(): array
    {
        $counts = ['CRITICAL' => 0, 'HIGH' => 0, 'MEDIUM' => 0, 'LOW' => 0];
        foreach ($this->findings as $f) {
            $counts[$f->severity] = ($counts[$f->severity] ?? 0) + 1;
        }
        return $counts;
    }
}
