<?php

declare(strict_types=1);

namespace Modules\Marketing\Synchronization\Presentation\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;

final class SyncLogResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'id' => $this->id,
            'marketing_connection_id' => $this->marketing_connection_id,
            'sync_type' => $this->sync_type,
            'status' => $this->status,
            'assets_discovered' => $this->assets_discovered,
            'assets_created' => $this->assets_created,
            'assets_updated' => $this->assets_updated,
            'assets_failed' => $this->assets_failed,
            'started_at' => $this->started_at?->toIso8601String(),
            'completed_at' => $this->completed_at?->toIso8601String(),
            'duration_seconds' => $this->durationSeconds(),
            'triggered_by' => $this->triggered_by,
            'error_message' => $this->error_message,
            'sync_metadata' => $this->sync_metadata,
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
