<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Presentation\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AgentResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'                  => $this->id,
            'name'                => $this->name,
            'agent_type'          => $this->agent_type,
            'status'              => $this->status->value,
            'status_label'        => $this->status->label(),
            'machine_fingerprint' => $this->machine_fingerprint,
            'os_info'             => $this->os_info,
            'ip_address'          => $this->ip_address,
            'version'             => $this->version,
            'capabilities'        => $this->capabilities,
            'platform_info'       => $this->platform_info,
            'last_seen_at'        => $this->last_seen_at?->toIsoString(),
            'registered_at'       => $this->registered_at?->toIsoString(),
            'is_online'           => $this->isOnline(),
            'created_at'          => $this->created_at->toIsoString(),

            'latest_heartbeat' => $this->whenLoaded('latestHeartbeat', fn () => [
                'status'          => $this->latestHeartbeat->status,
                'cpu_percent'     => $this->latestHeartbeat->cpu_percent,
                'memory_mb_used'  => $this->latestHeartbeat->memory_mb_used,
                'disk_free_gb'    => $this->latestHeartbeat->disk_free_gb,
                'current_task_id' => $this->latestHeartbeat->current_task_id,
                'recorded_at'     => $this->latestHeartbeat->recorded_at?->toIsoString(),
            ]),

            'current_session' => $this->whenLoaded('currentSession', fn () => [
                'id'               => $this->currentSession->id,
                'status'           => $this->currentSession->status->value,
                'progress_percent' => $this->currentSession->progress_percent,
                'progress_message' => $this->currentSession->progress_message,
                'started_at'       => $this->currentSession->started_at?->toIsoString(),
            ]),
        ];
    }
}
