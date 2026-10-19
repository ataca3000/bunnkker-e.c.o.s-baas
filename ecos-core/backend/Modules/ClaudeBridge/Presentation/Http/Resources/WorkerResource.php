<?php

declare(strict_types=1);

namespace Modules\ClaudeBridge\Presentation\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;
use Modules\ClaudeBridge\Domain\Models\Worker;

/** @mixin Worker */
final class WorkerResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'hostname' => $this->hostname,
            'status' => $this->status->value,
            'last_seen_at' => $this->last_seen_at?->toISOString(),
            'claude_version' => $this->claude_version,
            'is_active' => $this->is_active,
            'registered_at' => $this->registered_at->toISOString(),
        ];
    }
}
