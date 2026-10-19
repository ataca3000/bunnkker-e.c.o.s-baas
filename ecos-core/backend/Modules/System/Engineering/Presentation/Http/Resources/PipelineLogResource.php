<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Presentation\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;

class PipelineLogResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'id'               => $this->id,
            'stage'            => $this->stage,
            'stage_label'      => \Modules\System\Engineering\Domain\Enums\PipelineStage::from($this->stage)->label(),
            'status'           => $this->status,
            'started_at'       => $this->started_at?->toISOString(),
            'finished_at'      => $this->finished_at?->toISOString(),
            'duration_seconds' => $this->duration_seconds,
            'message'          => $this->message,
            'payload'          => $this->payload,
            'retry_count'      => $this->retry_count,
        ];
    }
}
