<?php

declare(strict_types=1);

namespace Modules\POS\Presentation\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin \Modules\POS\Session\Domain\Models\Session
 */
final class SessionResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'cashier_id' => $this->cashier_id,
            'company_id' => $this->company_id,
            'channel_id' => $this->channel_id,
            'warehouse_id' => $this->warehouse_id,
            'status' => $this->status->value,
            'device_fingerprint' => $this->device_fingerprint,
            'device_type' => $this->device_type?->value,
            'ip_address' => $this->ip_address,
            'opened_at' => $this->opened_at?->toIso8601String(),
            'suspended_at' => $this->suspended_at?->toIso8601String(),
            'closed_at' => $this->closed_at?->toIso8601String(),
        ];
    }
}
