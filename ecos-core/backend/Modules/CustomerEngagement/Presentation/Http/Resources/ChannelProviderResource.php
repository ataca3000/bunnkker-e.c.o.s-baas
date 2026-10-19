<?php

declare(strict_types=1);

namespace Modules\CustomerEngagement\Presentation\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;

class ChannelProviderResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'id' => $this->id,
            'company_id' => $this->company_id,
            'brand_id' => $this->brand_id,
            'channel' => $this->channel,
            'display_name' => $this->display_name,
            'status' => $this->status,
            'phone_number' => $this->phone_number,
            'page_id' => $this->page_id,
            'business_account_id' => $this->business_account_id,
            'last_verified_at' => $this->last_verified_at?->toIso8601String(),
            'last_error' => $this->last_error,
            'created_at' => $this->created_at->toIso8601String(),
        ];
    }
}
