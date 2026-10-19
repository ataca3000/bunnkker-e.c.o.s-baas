<?php

declare(strict_types=1);

namespace Modules\Marketing\CampaignStudio\Presentation\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;

class PublishingJobResource extends JsonResource
{
    /** @param \Illuminate\Http\Request $request */
    public function toArray($request): array
    {
        return [
            'id' => $this->id,
            'campaign_draft_id' => $this->campaign_draft_id,
            'operation' => $this->operation?->value,
            'operation_label' => $this->operation?->label(),
            'status' => $this->status?->value,
            'status_label' => $this->status?->label(),
            'connector_type' => $this->connector_type,
            'connection_id' => $this->connection_id,
            'error_message' => $this->error_message,
            'attempt_count' => $this->attempt_count,
            'max_attempts' => $this->max_attempts,
            'can_retry' => $this->canRetry(),
            'next_retry_at' => $this->next_retry_at?->toIso8601String(),
            'scheduled_at' => $this->scheduled_at?->toIso8601String(),
            'scheduled_timezone' => $this->scheduled_timezone,
            'queued_by' => $this->queued_by,
            'started_at' => $this->started_at?->toIso8601String(),
            'completed_at' => $this->completed_at?->toIso8601String(),
            'result' => $this->when($request->boolean('include_result'), $this->result),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
