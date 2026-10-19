<?php

declare(strict_types=1);

namespace Modules\Commerce\Synchronization\Presentation\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Modules\Commerce\Synchronization\Domain\Models\SyncLog;

/** @mixin SyncLog */
final class SyncLogResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'channel' => $this->whenLoaded('channel', fn () => [
                'id' => $this->channel->id,
                'name' => $this->channel->name,
            ]),
            'entity_type' => $this->entity_type->value,
            'entity_id' => $this->entity_id,
            'direction' => $this->direction->value,
            'action' => $this->action,
            'status' => $this->status->value,
            'error_message' => $this->error_message,
            'request_payload' => $this->request_payload,
            'response_payload' => $this->response_payload,
            'synced_at' => $this->synced_at?->toISOString(),
            'created_at' => $this->created_at?->toISOString(),
        ];
    }
}
